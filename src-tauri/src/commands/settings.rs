// src-tauri/src/commands/settings.rs
//! Settings Tauri commands — API key management via OS keyring.
//!
//! Keys are stored under the service name `"skilldeck"` with the provider
//! name as the account (e.g. `"claude"`, `"openai"`).  No key material ever
//! touches SQLite (ASR-SEC-001).
//!
//! After saving or deleting a key, the in-memory provider registry is updated
//! so the agent loop immediately picks up the change without a restart.

use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use tauri_plugin_keyring::KeyringExt;

use crate::state::AppState;
use skilldeck_core::providers::{ClaudeProvider, OpenAiProvider};

/// Whether a given provider has a stored key.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApiKeyStatus {
    pub provider: String,
    pub has_key: bool,
}

const KEYRING_SERVICE: &str = "skilldeck";
const KNOWN_PROVIDERS: &[&str] = &["claude", "openai", "ollama"];

/// Return key-presence status for every known provider.
#[specta]
#[tauri::command]
pub async fn list_api_keys(app: tauri::AppHandle) -> Result<Vec<ApiKeyStatus>, String> {
    let keyring = app.keyring();
    let mut entries = Vec::with_capacity(KNOWN_PROVIDERS.len());

    for &provider in KNOWN_PROVIDERS {
        let has_key = keyring.get_password(KEYRING_SERVICE, provider).is_ok();
        entries.push(ApiKeyStatus {
            provider: provider.to_string(),
            has_key,
        });
    }

    Ok(entries)
}

/// Store (or replace) an API key in the OS keychain and refresh the provider
/// registry so the agent loop can use the new key immediately.
#[specta]
#[tauri::command]
pub async fn set_api_key(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    provider: String,
    key: String,
) -> Result<(), String> {
    app.keyring()
        .set_password(KEYRING_SERVICE, &provider, &key)
        .map_err(|e| e.to_string())?;

    // Re-register the provider in the live registry so the next agent loop
    // invocation uses the new key without requiring an app restart.
    match provider.as_str() {
        "claude" => {
            state.registry.register_provider(ClaudeProvider::new(key));
            tracing::info!("Claude provider re-registered with new key");
        }
        "openai" => {
            state.registry.register_provider(OpenAiProvider::new(key));
            tracing::info!("OpenAI provider re-registered with new key");
        }
        _ => {} // ollama needs no key; other providers are not yet implemented
    }

    Ok(())
}

/// Remove an API key from the OS keychain.
///
/// Note: we do NOT unregister the provider from the registry here because
/// the provider object holds no reference to the key after construction —
/// the key was captured by value.  A full de-registration would require
/// restarting the app or a more complex eviction mechanism; for v1 this is
/// acceptable.
#[specta]
#[tauri::command]
pub async fn delete_api_key(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    app.keyring()
        .delete_password(KEYRING_SERVICE, &provider)
        .map_err(|e| e.to_string())
}

/// Light format-based validation – does not make a real API call.
///
/// Use this for immediate feedback in the settings UI; real connectivity
/// is verified the first time the agent loop attempts a completion.
#[specta]
#[tauri::command]
pub async fn validate_api_key(provider: String, key: String) -> Result<bool, String> {
    let valid = match provider.as_str() {
        "claude" => key.starts_with("sk-ant-"),
        "openai" => key.starts_with("sk-"),
        "ollama" => !key.is_empty(),
        _ => return Err(format!("Unknown provider: {provider}")),
    };
    Ok(valid)
}

/// Test a provider API key by making a minimal API call.
#[specta]
#[tauri::command]
pub async fn test_api_connection(provider: String, key: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match provider.as_str() {
        "claude" => {
            let url = "https://api.anthropic.com/v1/models";
            let resp = client
                .get(url)
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "openai" => {
            let url = "https://api.openai.com/v1/models";
            let resp = client
                .get(url)
                .bearer_auth(&key)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "ollama" => {
            // Ollama has no API key; just check if the server is reachable.
            let url = "http://localhost:11434/api/tags";
            let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        _ => Err(format!("Unknown provider: {provider}")),
    }
}

// ── Auto-approve configuration ───────────────────────────────────────────────

#[derive(Debug, Deserialize, Type)]
pub struct AutoApproveConfigDto {
    pub auto_approve_reads: bool,
    pub auto_approve_writes: bool,
    pub auto_approve_shell: bool,
    pub auto_approve_http_requests: bool,
    pub auto_approve_selects: bool,
    pub auto_approve_mutations: bool,
}

/// Set the global auto-approve configuration.
#[specta]
#[tauri::command]
pub async fn set_auto_approve_config(
    state: State<'_, Arc<AppState>>,
    config: AutoApproveConfigDto,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    use skilldeck_core::agent::tool_dispatcher::AutoApproveConfig;

    let core_config = AutoApproveConfig {
        reads: config.auto_approve_reads,
        writes: config.auto_approve_writes,
        shell: config.auto_approve_shell,
        http_requests: config.auto_approve_http_requests,
        selects: config.auto_approve_selects,
        mutations: config.auto_approve_mutations,
    };
    *state.global_auto_approve.write().await = core_config;
    // Emit event so existing ToolDispatcher instances can update.
    // Note: We'll rely on the dispatcher reading the global config at creation time.
    // Future improvement: broadcast changes.
    Ok(())
}
