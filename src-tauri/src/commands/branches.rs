//! Branch management Tauri commands.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::conversation_branches::{self, Entity as Branches};
use skilldeck_models::messages::{self, Entity as Messages};

#[derive(Debug, Serialize, Type)]
pub struct BranchInfo {
    pub id: String,
    pub name: Option<String>,
    pub parent_message_id: String,
    pub created_at: String,
    pub message_count: u64,
}

#[derive(Debug, Deserialize, Type)]
pub struct CreateBranchRequest {
    pub conversation_id: String,
    pub parent_message_id: String,
    pub name: Option<String>,
}

/// Create a new branch from a parent message.
#[specta]
#[tauri::command]
pub async fn create_branch(
    state: State<'_, Arc<AppState>>,
    req: CreateBranchRequest,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let conv_uuid = Uuid::parse_str(&req.conversation_id).map_err(|e| e.to_string())?;
    let parent_uuid = Uuid::parse_str(&req.parent_message_id).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = conversation_branches::ActiveModel {
        id: Set(id),
        conversation_id: Set(conv_uuid),
        parent_message_id: Set(parent_uuid),
        name: Set(req.name),
        status: Set("active".to_string()),
        created_at: Set(now),
        merged_at: Set(None),
    };

    model.insert(db).await.map_err(|e| e.to_string())?;

    Ok(id.to_string())
}

/// List all branches for a conversation.
#[specta]
#[tauri::command]
pub async fn list_branches(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<Vec<BranchInfo>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    let branches = Branches::find()
        .filter(conversation_branches::Column::ConversationId.eq(conv_uuid))
        .filter(conversation_branches::Column::Status.eq("active"))
        .order_by_asc(conversation_branches::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(branches.len());
    for b in branches {
        let count = Messages::find()
            .filter(messages::Column::BranchId.eq(b.id))
            .count(db)
            .await
            .unwrap_or(0);

        result.push(BranchInfo {
            id: b.id.to_string(),
            name: b.name,
            parent_message_id: b.parent_message_id.to_string(),
            created_at: b.created_at.to_rfc3339(),
            message_count: count,
        });
    }
    Ok(result)
}

/// Get messages for a specific branch.
#[specta]
#[tauri::command]
pub async fn get_branch_messages(
    state: State<'_, Arc<AppState>>,
    branch_id: String,
) -> Result<Vec<crate::commands::messages::MessageData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let branch_uuid = Uuid::parse_str(&branch_id).map_err(|e| e.to_string())?;

    let messages = Messages::find()
        .filter(messages::Column::BranchId.eq(branch_uuid))
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(messages
        .into_iter()
        .map(|m| {
            let context_items = m.context_items.map(|c| c.0);
            // m.node_document is Option<Json> where Json = serde_json::Value
            let node_document = m
                .node_document
                .and_then(|json| serde_json::from_value(json).ok());
            crate::commands::messages::MessageData {
                id: m.id.to_string(),
                conversation_id: m.conversation_id.to_string(),
                role: m.role,
                content: m.content,
                created_at: m.created_at.to_string(),
                context_items,
                metadata: m.metadata,
                input_tokens: m.input_tokens,
                output_tokens: m.output_tokens,
                seen: m.seen,
                node_document,
                status: m.status,
            }
        })
        .collect())
}
