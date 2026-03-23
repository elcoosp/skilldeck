use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryFilter};
use specta::specta;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::conversation_drafts::{self, Entity as Drafts};

#[specta]
#[tauri::command]
pub async fn get_conversation_draft(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<Option<(String, Vec<serde_json::Value>)>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    let draft = Drafts::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(d) = draft {
        let text = d.text_content.unwrap_or_default();
        let items = d
            .context_items
            .and_then(|j| serde_json::from_value(j).ok())
            .unwrap_or_default();
        Ok(Some((text, items)))
    } else {
        Ok(None)
    }
}

#[specta]
#[tauri::command]
pub async fn upsert_conversation_draft(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    text_content: Option<String>,
    context_items: Option<Vec<serde_json::Value>>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().fixed_offset();
    let items_json = context_items.map(|items| serde_json::to_value(items).unwrap());

    // Use upsert (insert or replace) for SQLite
    let existing = Drafts::find_by_id(uuid).one(db).await?;
    if let Some(draft) = existing {
        let mut active: conversation_drafts::ActiveModel = draft.into();
        active.text_content = Set(text_content);
        active.context_items = Set(items_json);
        active.updated_at = Set(now);
        active.update(db).await?;
    } else {
        let draft = conversation_drafts::ActiveModel {
            conversation_id: Set(uuid),
            text_content: Set(text_content),
            context_items: Set(items_json),
            updated_at: Set(now),
        };
        draft.insert(db).await?;
    }
    Ok(())
}
