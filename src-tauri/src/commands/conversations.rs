//! Conversation Tauri commands.
//!
//! All DB access goes through the `Database` trait so the layer remains
//! testable without a real SQLite file.

use sea_orm::PaginatorTrait;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect,
};
use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::conversations::{self, Entity as Conversation};
use skilldeck_models::messages::{self as msg_model, Entity as Messages};

/// Lightweight summary used by the sidebar list.
#[derive(Debug, Clone, Serialize)]
pub struct ConversationSummary {
    pub id: String,
    pub title: Option<String>,
    pub profile_id: String,
    pub workspace_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u64,
}

/// Create a new conversation for the given profile.
#[tauri::command]
pub async fn create_conversation(
    state: State<'_, Arc<AppState>>,
    profile_id: String,
    title: Option<String>,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let profile_uuid = Uuid::parse_str(&profile_id).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = conversations::ActiveModel {
        id: Set(id),
        profile_id: Set(profile_uuid),
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
#[tauri::command]
pub async fn list_conversations(
    state: State<'_, Arc<AppState>>,
    profile_id: Option<String>,
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
        let uuid = Uuid::parse_str(&pid).map_err(|e| e.to_string())?;
        query = query.filter(conversations::Column::ProfileId.eq(uuid));
    }

    let rows = query.all(db).await.map_err(|e| e.to_string())?;

    // Build summaries with message counts.
    let mut summaries = Vec::with_capacity(rows.len());
    for row in rows {
        let count = Messages::find()
            .filter(msg_model::Column::ConversationId.eq(row.id))
            .count(db)
            .await
            .unwrap_or(0);

        summaries.push(ConversationSummary {
            id: row.id.to_string(),
            title: row.title,
            profile_id: row.profile_id.to_string(),
            workspace_id: row.workspace_id.map(|id| id.to_string()),
            created_at: row.created_at.to_string(),
            updated_at: row.updated_at.to_string(),
            message_count: count,
        });
    }

    Ok(summaries)
}

/// Soft-delete a conversation.
#[tauri::command]
pub async fn delete_conversation(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = Conversation::find_by_id(uuid)
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
#[tauri::command]
pub async fn rename_conversation(
    state: State<'_, Arc<AppState>>,
    id: String,
    title: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = Conversation::find_by_id(uuid)
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
