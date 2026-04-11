// src-tauri/src/lib.rs
//! Tauri application entry point (library form for testability).
//!
//! This module wires together:
//! - `AppState` initialization (DB + Registry + ApprovalGate + LintConfig)
//! - All IPC command handlers (extended with marketplace + file-browsing commands)
//! - Tauri plugins (keyring, shell, store, dialog)
//! - Tracing subscriber
//! - Nudge poller and background skill sync

mod artifacts;
mod commands;
mod config;
mod events;
mod nudge_poller;
mod platform_client;
mod skills;
mod state;
mod subagent_monitor;
mod subagent_registry;
mod subagent_server;
mod sync; // NEW

pub use subagent_server::SubagentServer;

use commands::{
    achievements::*, analytics::*, artifacts::*, attachments::*, bookmarks::*, branches::*,
    conversations::*, drafts::*, export::*, files::*, folders::*, gist::*, headings::*,
    home_dir::*, mcp::*, messages::*, ollama::*, platform::*, profiles::*, provider_ready::*,
    queue::*, settings::*, skills::*, theme::*, workflows::*, workspaces::*,
};
use events::{AgentEvent, McpEvent, SkillEvent, WorkflowEvent};
use state::AppState;
use std::sync::Arc;
use tauri::Manager;

// Specta bindings export
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri_specta::{Builder, collect_commands, collect_events};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tracing_subscriber::{EnvFilter, fmt};
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("skilldeck=info".parse().unwrap())
                .add_directive("skilldeck_core=info".parse().unwrap())
                .add_directive("skilldeck_lint=info".parse().unwrap()),
        )
        .init();
    // }
    // Build Tauri Specta builder with all commands and events
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            list_git_status,
            list_workspace_files,
            update_workspace,
            unlock_achievement,
            list_achievements,
            compact_conversation,
            check_provider_ready,
            get_artifact_content,
            list_built_in_themes,
            get_syntax_css,
            set_built_in_theme,
            set_theme_from_file,
            get_conversation_bootstrap,
            pin_artifact,
            unpin_artifact,
            list_pinned_artifacts,
            list_artifact_versions,
            copy_artifact_to_branch,
            list_artifacts,
            get_home_dir,
            get_conversation_draft,
            upsert_conversation_draft,
            attach_files_to_conversation,
            list_folders,
            create_folder,
            rename_folder,
            delete_folder,
            move_conversation_to_folder,
            set_auto_approve_config,
            add_bookmark,
            remove_bookmark,
            list_bookmarks,
            toggle_bookmark,
            get_analytics,
            process_queued_messages,
            set_auto_send_paused,
            create_branch,
            list_branches,
            get_branch_messages,
            save_workflow_definition,
            list_workflow_definitions,
            get_workflow_definition,
            delete_workflow_definition,
            update_workflow_definition, // NEW
            run_workflow_definition,    // NEW
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
            search_messages,
            mark_message_seen,
            send_message,
            resolve_tool_approval,
            // profiles
            list_profiles,
            create_profile,
            update_profile,
            delete_profile,
            set_default_profile,
            restore_profile,
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
            // shared conversation commands
            get_shared_conversation,
            check_sync_status,
            share_conversation,
            sync_conversation_to_platform,
            hydrate_shared_conversation,
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
            // headings
            get_conversation_messages_headings,
        ])
        .events(collect_events![
            AgentEvent,
            McpEvent,
            WorkflowEvent,
            SkillEvent
        ]);

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
    // Start building the Tauri app
    let mut tauri_builder = tauri::Builder::default();
    // Conditionally add the playwright plugin for E2E testing
    #[cfg(feature = "e2e-testing")]
    {
        tauri_builder = tauri_builder.plugin(tauri_plugin_playwright::init());
    }
    // Add single-instance plugin first (desktop only)
    #[cfg(desktop)]
    {
        tauri_builder =
            tauri_builder.plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
                println!("new instance opened with {argv:?}, deep-link event already handled");
            }));
    }

    // Add deep-link plugin (required for custom scheme handling)
    tauri_builder = tauri_builder.plugin(tauri_plugin_deep_link::init());

    // Conditionally add the devtools plugin only for debug builds
    // #[cfg(debug_assertions)]
    // {
    //     let devtools = tauri_plugin_devtools::init();
    //     tauri_builder = tauri_builder.plugin(devtools);
    // }

    tauri_builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            builder.mount_events(app);

            let handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                let state = AppState::initialize(&handle)
                    .await
                    .expect("Failed to initialize AppState");
                let state = Arc::new(state);

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

                handle.manage(state);
            });

            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
