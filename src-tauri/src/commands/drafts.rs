use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
use specta::specta;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::context_item::ContextItems;
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
        // Convert ContextItems to Vec<serde_json::Value> for frontend compatibility
        let items: Vec<serde_json::Value> = if let Some(context) = d.context_items {
            context
                .0
                .into_iter()
                .map(|item| serde_json::to_value(item).map_err(|e| e.to_string()))
                .collect::<Result<Vec<_>, _>>()?
        } else {
            Vec::new()
        };
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

    // Convert Vec<serde_json::Value> to Option<ContextItems> (if present)
    let context_items_model = if let Some(items) = context_items {
        // Convert each value to ContextItem
        let mut vec = Vec::new();
        for val in items {
            let item: skilldeck_models::context_item::ContextItem =
                serde_json::from_value(val).map_err(|e| e.to_string())?;
            vec.push(item);
        }
        Some(ContextItems(vec))
    } else {
        None
    };

    let existing = Drafts::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(draft) = existing {
        let mut active: conversation_drafts::ActiveModel = draft.into();
        active.text_content = Set(text_content);
        active.context_items = Set(context_items_model);
        active.updated_at = Set(now);
        active.update(db).await.map_err(|e| e.to_string())?;
    } else {
        let draft = conversation_drafts::ActiveModel {
            conversation_id: Set(uuid),
            text_content: Set(text_content),
            context_items: Set(context_items_model),
            updated_at: Set(now),
        };
        draft.insert(db).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
