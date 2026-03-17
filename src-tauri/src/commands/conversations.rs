//! Conversation Tauri commands.
//!
//! All DB access goes through the `Database` trait so the layer remains
//! testable without a real SQLite file.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, FromQueryResult, QueryFilter,
    QueryOrder, QuerySelect,
};
use serde::Serialize;
use specta::{Type, specta};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::conversations::{self, Entity as Conversation};
use skilldeck_models::messages;

/// Lightweight summary used by the sidebar list.
#[derive(Debug, Clone, Serialize, Type)]
pub struct ConversationSummary {
    pub id: String,
    pub title: Option<String>,
    pub profile_id: String,
    pub workspace_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u64,
}

/// Helper struct for batch message count.
#[derive(Debug, FromQueryResult)]
struct MessageCount {
    conversation_id: Uuid,
    count: i64,
}

/// Create a new conversation for the given profile.
#[specta]
#[tauri::command]
pub async fn create_conversation(
    state: State<'_, Arc<AppState>>,
    profile_id: Uuid,
    title: Option<String>,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = conversations::ActiveModel {
        id: Set(id),
        profile_id: Set(profile_id),
        title: Set(title),
        status: Set("active".to_string()),
        workspace_id: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

/// Return conversations for a profile, most-recently-updated first.
#[specta]
#[tauri::command]
pub async fn list_conversations(
    state: State<'_, Arc<AppState>>,
    profile_id: Option<Uuid>,
    limit: Option<u64>,
) -> Result<Vec<ConversationSummary>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut query = Conversation::find()
        .filter(conversations::Column::Status.eq("active"))
        .order_by_desc(conversations::Column::UpdatedAt)
        .limit(limit);

    if let Some(pid) = profile_id {
        query = query.filter(conversations::Column::ProfileId.eq(pid));
    }

    let rows = query.all(db).await.map_err(|e| e.to_string())?;
    if rows.is_empty() {
        return Ok(vec![]);
    }

    // Batch fetch message counts for all conversation IDs in a single query.
    let conv_ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();

    use messages::Column as MsgColumn;

    let counts = messages::Entity::find()
        .select_only()
        .column(MsgColumn::ConversationId)
        .column_as(MsgColumn::Id.count(), "count")
        .filter(MsgColumn::ConversationId.is_in(conv_ids))
        .group_by(MsgColumn::ConversationId)
        .into_model::<MessageCount>()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let count_map: HashMap<Uuid, u64> = counts
        .into_iter()
        .map(|mc| (mc.conversation_id, mc.count as u64))
        .collect();

    // Build summaries using the batch‑loaded counts.
    let summaries: Vec<ConversationSummary> = rows
        .into_iter()
        .map(|row| ConversationSummary {
            id: row.id.to_string(),
            title: row.title,
            profile_id: row.profile_id.to_string(),
            workspace_id: row.workspace_id.map(|id| id.to_string()),
            created_at: row.created_at.to_string(),
            updated_at: row.updated_at.to_string(),
            message_count: count_map.get(&row.id).copied().unwrap_or(0),
        })
        .collect();

    Ok(summaries)
}

/// Soft-delete a conversation.
#[specta]
#[tauri::command]
pub async fn delete_conversation(state: State<'_, Arc<AppState>>, id: Uuid) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let row = Conversation::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Conversation {id} not found"))?;

    let mut active: conversations::ActiveModel = row.into();
    active.status = Set("deleted".to_string());
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Rename a conversation.
#[specta]
#[tauri::command]
pub async fn rename_conversation(
    state: State<'_, Arc<AppState>>,
    id: Uuid,
    title: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let row = Conversation::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Conversation {id} not found"))?;

    let mut active: conversations::ActiveModel = row.into();
    active.title = Set(Some(title));
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}
