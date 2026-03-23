// src-tauri/src/commands/attachments.rs
use serde_json::json;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::{Emitter, State};

use crate::state::AppState;

#[derive(Debug, Clone, serde::Serialize, Type)]
pub struct AttachFilesPayload {
    pub conversation_id: String,
    pub paths: Vec<String>,
}

#[specta]
#[tauri::command]
pub async fn attach_files_to_conversation(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    paths: Vec<String>,
) -> Result<(), String> {
    let payload = json!({
        "conversation_id": conversation_id,
        "paths": paths,
    });

    state
        .app_handle
        .emit("skilldeck:attach-files", &payload)
        .map_err(|e| e.to_string())?;

    Ok(())
}
