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
    conversations::{
        create_conversation, delete_conversation, list_conversations, rename_conversation,
    },
    export::export_conversation,
    gist::{
        export_conversation_as_markdown, has_github_token, import_skill_from_gist,
        import_workflow_from_gist, set_github_token, share_skill_as_gist, share_workflow_as_gist,
    },
    mcp::{
        add_mcp_server, connect_mcp_server, disconnect_mcp_server, list_mcp_servers,
        remove_mcp_server,
    },
    messages::{list_messages, resolve_tool_approval, send_message},
    ollama::list_ollama_models,
    platform::{
        create_referral_code, delete_platform_account, ensure_platform_registration,
        export_gdpr_data, get_pending_nudges, get_platform_preferences, get_referral_stats,
        resend_verification_email, send_activity_event, update_platform_preferences,
    },
    profiles::{create_profile, delete_profile, list_profiles, update_profile},
    settings::{delete_api_key, list_api_keys, set_api_key, validate_api_key},
    skills::{
        // Existing
        list_skills,
        toggle_skill,
        // Lint
        lint_skill,
        lint_all_local_sources,
        get_lint_rules,
        disable_lint_rule,
        // Installation
        install_skill,
        uninstall_skill,
        diff_skill_versions,
        // Sources
        list_skill_sources,
        add_skill_source,
        remove_skill_source,
    },
    workspaces::{close_workspace, list_workspaces, open_workspace},
};
use state::AppState;
use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

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

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let state = AppState::initialize(&handle)
                    .await
                    .expect("Failed to initialize AppState");
                let state = Arc::new(state);

                nudge_poller::start_nudge_poller(handle.clone(), Arc::clone(&state));

                handle.manage(state);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
