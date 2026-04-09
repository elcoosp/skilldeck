// src-tauri/src/commands/ollama.rs
//! Ollama-specific Tauri commands.

use serde::Serialize;
use skilldeck_core::providers::ollama::{OllamaProvider, OllamaStatus};
use specta::{Type, specta};

#[derive(Debug, Clone, Serialize, Type)]
pub struct OllamaModelInfo {
    pub id: String,
    pub name: String,
}

#[specta]
#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<OllamaModelInfo>, String> {
    match OllamaProvider::check_ollama_status().await {
        OllamaStatus::Available(models) => Ok(models
            .into_iter()
            .map(|m| OllamaModelInfo {
                id: m.id.clone(),
                name: m.name,
            })
            .collect()),
        _ => Ok(vec![]),
    }
}
