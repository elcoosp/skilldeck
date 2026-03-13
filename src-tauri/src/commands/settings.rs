//! Settings Tauri commands — API key management via OS keyring.
//!
//! Keys are stored under the service name `"skilldeck"` with the provider
//! name as the account (e.g. `"claude"`, `"openai"`).  No key material ever
//! touches SQLite (ASR-SEC-001).

use serde::{Deserialize, Serialize};
use tauri_plugin_keyring::KeyringExt;

/// Whether a given provider has a stored key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub provider: String,
    pub has_key: bool,
}

const KEYRING_SERVICE: &str = "skilldeck";
const KNOWN_PROVIDERS: &[&str] = &["claude", "openai", "ollama"];

/// Return key-presence status for every known provider.
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

/// Store (or replace) an API key in the OS keychain.
#[tauri::command]
pub async fn set_api_key(
    app: tauri::AppHandle,
    provider: String,
    key: String,
) -> Result<(), String> {
    app.keyring()
        .set_password(KEYRING_SERVICE, &provider, &key)
        .map_err(|e| e.to_string())
}

/// Remove an API key from the OS keychain.
#[tauri::command]
pub async fn delete_api_key(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    app.keyring()
        .delete_password(KEYRING_SERVICE, &provider)
        .map_err(|e| e.to_string())
}

/// Light format-based validation — does not make a real API call.
///
/// Use this for immediate feedback in the settings UI; real connectivity
/// is verified the first time the agent loop attempts a completion.
#[tauri::command]
pub async fn validate_api_key(provider: String, key: String) -> Result<bool, String> {
    let valid = match provider.as_str() {
        "claude" => key.starts_with("sk-ant-"),
        "openai" => key.starts_with("sk-"),
        "ollama" => !key.is_empty(), // Ollama is typically keyless but we accept a token
        _ => return Err(format!("Unknown provider: {provider}")),
    };
    Ok(valid)
}
