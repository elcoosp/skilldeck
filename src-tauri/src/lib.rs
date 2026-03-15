//! Tauri application entry point (library form for testability).
//!
//! This module wires together:
//! - `AppState` initialization (DB + Registry + ApprovalGate + LintConfig)
//! - All IPC command handlers (extended with marketplace commands)
//! - Tauri plugins (keyring, shell, store, dialog)
//! - Tracing subscriber

mod commands;
mod config;
mod events;
mod nudge_poller;
mod platform_client;
mod skills;
mod state;
mod sync;

use commands::{
    conversations::*, export::*, gist::*, mcp::*, messages::*, ollama::*, platform::*, profiles::*,
    settings::*, skills::*, workspaces::*,
};
use events::{AgentEvent, McpEvent, WorkflowEvent};
use state::AppState;
use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{EnvFilter, fmt};

// Specta bindings export
use specta::collect_types;
use tauri_specta::{js, ts};

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

    // Build invoke handler with specta for TypeScript bindings
    let (invoke_handler, register_events) = {
        // Collect all commands with their specta types
        let builder = ts::builder()
            .commands(tauri_specta::collect_commands![
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
            ])
            .events(tauri_specta::collect_events![
                AgentEvent,
                McpEvent,
                WorkflowEvent
            ]);

        #[cfg(debug_assertions)]
        let builder = builder.path("../src/bindings.ts");

        builder.build().unwrap()
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // Register event listeners for Tauri Specta
            register_events(app);

            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let state = AppState::initialize(&handle)
                    .await
                    .expect("Failed to initialize AppState");
                let state = Arc::new(state);

                // Start nudge poller
                nudge_poller::start_nudge_poller(handle.clone(), Arc::clone(&state));

                // Start skill sync poller (hourly)
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

                handle.manage(state);
            });
            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
