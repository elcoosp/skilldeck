//! Export Tauri commands.

use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::{Deserialize, Serialize};
use specta::specta;
use std::{io::Write, path::PathBuf, sync::Arc};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::{
    conversations::Entity as Conversations,
    messages::{self as msg_model, Entity as Messages},
};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Markdown,
    Json,
}

/// Lightweight message representation used by the Markdown gist exporter.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MessageExport {
    pub role: String,
    pub content: String,
}

/// Export a conversation to a file on the local filesystem.
#[specta]
#[tauri::command]
pub async fn export_conversation(
    state: State<'_, Arc<AppState>>,
    id: String,
    format: ExportFormat,
    path: PathBuf,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let conv = Conversations::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Conversation {id} not found"))?;

    let messages = Messages::find()
        .filter(msg_model::Column::ConversationId.eq(uuid))
        .order_by_asc(msg_model::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let content = match format {
        ExportFormat::Markdown => {
            let title = conv.title.as_deref().unwrap_or("Conversation");
            let exported = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC");
            let mut md = format!("# {title}\n\n*Exported on {exported}*\n\n---\n\n");

            for msg in &messages {
                let heading = match msg.role.as_str() {
                    "user" => "👤 **User**",
                    "assistant" => "🤖 **Assistant**",
                    "tool" => "🔧 **Tool**",
                    other => other,
                };
                md.push_str(&format!("### {heading}\n\n{}\n\n", msg.content));
            }
            md
        }

        ExportFormat::Json => {
            let payload = serde_json::json!({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "messages": messages.iter().map(|m| serde_json::json!({
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at,
                })).collect::<Vec<_>>()
            });
            serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?
        }
    };

    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}
