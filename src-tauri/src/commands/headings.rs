use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::message_headings::Entity as HeadingsEntity;
use skilldeck_models::messages::Entity as Messages;

#[derive(Debug, Serialize, Type)]
pub struct HeadingItem {
    pub id: String,
    pub message_id: String,
    pub toc_index: i32,
    pub text: String,
    pub level: i32,
}

#[specta]
#[tauri::command]
pub async fn get_conversation_messages_headings(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<Vec<HeadingItem>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    // Get all assistant message IDs in this conversation
    let message_ids = Messages::find()
        .filter(skilldeck_models::messages::Column::ConversationId.eq(conv_uuid))
        .filter(skilldeck_models::messages::Column::Role.eq("assistant"))
        .select_only()
        .column(skilldeck_models::messages::Column::Id)
        .into_tuple::<Uuid>()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    if message_ids.is_empty() {
        return Ok(vec![]);
    }

    let headings = HeadingsEntity::find()
        .filter(skilldeck_models::message_headings::Column::MessageId.is_in(message_ids))
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for h in headings {
        for item in h.headings.0 {
            items.push(HeadingItem {
                id: item.id,
                message_id: h.message_id.to_string(),
                toc_index: item.toc_index,
                text: item.text,
                level: item.level,
            });
        }
    }
    Ok(items)
}
