//! Tauri application entry point (library form for testability).
//!
//! This module wires together:
//! - `AppState` initialization (DB + Registry + ApprovalGate)
//! - All IPC command handlers
//! - Tauri plugins (keyring, shell, store, dialog)
//! - Tracing subscriber

mod commands;
mod events;
mod state;

use commands::{
    conversations::{
        create_conversation, delete_conversation, list_conversations, rename_conversation,
    },
    export::export_conversation,
    mcp::{connect_mcp_server, disconnect_mcp_server, list_mcp_servers},
    messages::{list_messages, resolve_tool_approval, send_message},
    ollama::list_ollama_models,
    profiles::{create_profile, delete_profile, list_profiles, update_profile},
    settings::{delete_api_key, list_api_keys, set_api_key, validate_api_key},
    skills::{list_skills, toggle_skill},
    workspaces::{close_workspace, list_workspaces, open_workspace},
};
use state::AppState;
use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialise structured logging (RUST_LOG=info by default).
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("skilldeck=info".parse().unwrap())
                .add_directive("skilldeck_core=info".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        // OS-level plugins.
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init()) // <-- new
        // Async setup: build AppState before any command can run.
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let state = AppState::initialize(&handle)
                    .await
                    .expect("Failed to initialize AppState");
                handle.manage(Arc::new(state));
            });
            Ok(())
        })
        // Register every IPC command.
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
            // skills
            list_skills,
            toggle_skill,
            // mcp
            list_mcp_servers,
            connect_mcp_server,
            disconnect_mcp_server,
            // export
            export_conversation,
            // workspaces
            open_workspace,
            close_workspace,
            list_workspaces,
            // ollama
            list_ollama_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
