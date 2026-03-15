//! Ollama-specific Tauri commands.
//!
//! These are thin wrappers that invoke the Ollama CLI or HTTP API to fetch
//! runtime information such as the list of locally installed models.
use specta::specta;

use serde::Serialize;
use skilldeck_core::providers::ollama::OllamaProvider;

/// A minimal model descriptor returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct OllamaModelInfo {
    pub id: String,
    pub name: String,
}

/// Return the list of models currently installed in Ollama.
///
/// Runs `ollama list` under the hood via `OllamaProvider::fetch_installed_models()`.
/// Falls back to a minimal default list if the `ollama` binary is not found.
#[specta]
#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModelInfo>, String> {
    let models = OllamaProvider::fetch_installed_models().await;
    Ok(models
        .into_iter()
        .map(|m| OllamaModelInfo {
            id: m.id.clone(),
            name: m.name,
        })
        .collect())
}
