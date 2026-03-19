// src-tauri/src/lib.rs
//! Tauri application entry point (library form for testability).
//!
//! This module wires together:
//! - `AppState` initialization (DB + Registry + ApprovalGate + LintConfig)
//! - All IPC command handlers (extended with marketplace + file-browsing commands)
//! - Tauri plugins (keyring, shell, store, dialog)
//! - Tracing subscriber
//! - Splashscreen handling (two‑window approach)

mod commands;
mod config;
mod events;
mod nudge_poller;
mod platform_client;
mod skills;
mod state;
mod subagent_monitor;
mod subagent_server;
mod sync;

pub use subagent_server::SubagentServer;

use commands::{
    branches::*, conversations::*, export::*, files::*, gist::*, mcp::*, messages::*, ollama::*,
    platform::*, profiles::*, queue::*, settings::*, skills::*, workflows::*, workspaces::*,
};
use events::{AgentEvent, McpEvent, WorkflowEvent};
use state::AppState;
use std::sync::Arc;
use tauri::{Listener, Manager};
use tracing_subscriber::{EnvFilter, fmt};

// Specta bindings export
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri_specta::{Builder, collect_commands, collect_events};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("skilldeck=info".parse().unwrap())
                .add_directive("skilldeck_core=info".parse().unwrap())
                .add_directive("skilldeck_lint=info".parse().unwrap()),
        )
        .init();

    // Build Tauri Specta builder with all commands and events
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            process_queued_messages,
            set_auto_send_paused,
            create_branch,
            list_branches,
            get_branch_messages,
            save_workflow_definition,
            list_workflow_definitions,
            get_workflow_definition,
            delete_workflow_definition,
            get_installed_skill_content,
            get_installed_skill_path,
            install_registry_skill,
            open_folder,
            // skills — registry sync
            sync_registry_skills,
            fetch_registry_skills,
            // conversations
            create_conversation,
            list_conversations,
            delete_conversation,
            rename_conversation,
            // messages
            list_messages,
            send_message,
            resolve_tool_approval,
            // profiles
            list_profiles,
            create_profile,
            update_profile,
            delete_profile,
            set_default_profile,
            // settings / keys
            list_api_keys,
            set_api_key,
            delete_api_key,
            validate_api_key,
            // skills — basic
            list_skills,
            toggle_skill,
            // skills — lint
            lint_skill,
            lint_all_local_sources,
            get_lint_rules,
            disable_lint_rule,
            // skills — installation
            install_skill,
            uninstall_skill,
            diff_skill_versions,
            // skills — source management
            list_skill_sources,
            add_skill_source,
            remove_skill_source,
            // mcp
            list_mcp_servers,
            connect_mcp_server,
            disconnect_mcp_server,
            add_mcp_server,
            remove_mcp_server,
            // export
            export_conversation,
            // gist
            share_skill_as_gist,
            share_workflow_as_gist,
            import_skill_from_gist,
            import_workflow_from_gist,
            export_conversation_as_markdown,
            has_github_token,
            set_github_token,
            // workspaces
            open_workspace,
            close_workspace,
            list_workspaces,
            // ollama
            list_ollama_models,
            // platform
            ensure_platform_registration,
            get_platform_preferences,
            update_platform_preferences,
            get_pending_nudges,
            send_activity_event,
            get_referral_stats,
            create_referral_code,
            resend_verification_email,
            export_gdpr_data,
            delete_platform_account,
            // agent
            cancel_agent,
            // settings
            test_api_connection,
            // file browsing (chat context injection)
            list_directory_contents,
            count_folder_files,
            read_file,
            assemble_folder,
            // queued messages
            add_queued_message,
            list_queued_messages,
            update_queued_message,
            delete_queued_message,
            reorder_queued_messages,
            merge_queued_messages,
            // pin/unpin conversations
            pin_conversation,
            unpin_conversation,
            // new command for updating conversation workspace
            update_conversation_workspace,
        ])
        .events(collect_events![AgentEvent, McpEvent, WorkflowEvent]);

    #[cfg(debug_assertions)]
    {
        // Create a Typescript exporter with String behavior for BigInts
        let ts = Typescript::default().bigint(BigIntExportBehavior::String);
        builder
            .export(ts, "../src/lib/bindings.ts")
            .expect("Failed to export TypeScript bindings");
    }

    // Get the invoke handler (borrows builder, does not consume it)
    let invoke_handler = builder.invoke_handler();

    tauri::Builder::default()
        // Splashscreen is handled via two windows – no separate plugin needed
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // Mount events for Tauri Specta (consumes builder)
            builder.mount_events(app);

            // Get references to the splashscreen and main windows (must match labels in tauri.conf.json)
            let splash_window = app
                .get_webview_window("splashscreen")
                .expect("splashscreen window not found");
            let main_window = app
                .get_webview_window("main")
                .expect("main window not found");

            // Create a oneshot channel to wait for the frontend ready signal
            let (tx, rx) = tokio::sync::oneshot::channel::<()>();

            // Register a one‑time global event listener – `once` is FnOnce, so we can move tx.
            app.once("splashscreen-frontend-ready", move |_| {
                // Ignore errors if the receiver is already dropped
                let _ = tx.send(());
            });

            let handle = app.handle().clone();

            // Perform heavy initialization (DB, skill scanning, etc.) – this runs synchronously
            // inside `block_on` to wait for completion before the app starts.
            tauri::async_runtime::block_on(async move {
                let state = AppState::initialize(&handle)
                    .await
                    .expect("Failed to initialize AppState");
                let state = Arc::new(state);

                // Start background tasks (nudge poller, skill sync)
                nudge_poller::start_nudge_poller(handle.clone(), Arc::clone(&state));

                let sync_state = Arc::clone(&state);
                tokio::spawn(async move {
                    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
                    loop {
                        interval.tick().await;
                        if let Err(e) =
                            commands::skills::sync_registry_skills_background(&sync_state).await
                        {
                            tracing::warn!("Background skill sync failed: {}", e);
                        }
                    }
                });

                // Store the state so commands can access it
                handle.manage(state);
            });

            // Spawn a task that waits for the frontend ready event, then closes the splashscreen
            // and shows the main window.  Add a timeout to avoid hanging forever.
            tauri::async_runtime::spawn(async move {
                // Wait for the event to be received, with a timeout (e.g., 5 seconds) as fallback.
                match tokio::time::timeout(std::time::Duration::from_secs(5), rx).await {
                    Ok(Ok(())) => {
                        // Frontend ready – normal path
                    }
                    _ => {
                        // Timeout or channel error – still close splashscreen to avoid blocking.
                        tracing::warn!(
                            "Splashscreen frontend ready event timeout – proceeding anyway"
                        );
                    }
                }

                // All done – close splashscreen and reveal main window
                let _ = splash_window.close();
                let _ = main_window.show();
            });

            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
