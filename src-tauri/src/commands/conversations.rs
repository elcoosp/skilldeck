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
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::platform_client::{HydrateResponse, SharedConversationPayload};
use crate::state::AppState;
use skilldeck_models::conversations::{self, Entity as Conversation};
use skilldeck_models::messages::{self as msg_model, Entity as Messages};
use skilldeck_models::profiles::Entity as Profiles;

/// Lightweight summary used by the sidebar list.
#[derive(Debug, Clone, Serialize, Type)]
pub struct ConversationSummary {
    pub id: String,
    pub title: Option<String>,
    pub profile_id: String,
    pub profile_name: Option<String>,
    pub profile_deleted: bool,
    pub workspace_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u64,
    pub folder_id: Option<Uuid>,
    pub pinned: bool,
}

/// Create a new conversation for the given profile.
#[specta]
#[tauri::command]
pub async fn create_conversation(
    state: State<'_, Arc<AppState>>,
    profile_id: Uuid,
    title: Option<String>,
    workspace_id: Option<Uuid>,
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
        workspace_id: Set(workspace_id),
        status: Set("active".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        pinned: Set(false),
        ..Default::default()
    };

    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

/// Return conversations for a profile (or all profiles if profile_id is null), most-recently-updated first.
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

    // Build query with join to profiles
    let mut query = Conversation::find()
        .find_also_related(Profiles)
        .filter(conversations::Column::Status.eq("active"))
        .order_by_desc(conversations::Column::Pinned)
        .order_by_desc(conversations::Column::UpdatedAt)
        .limit(limit);

    if let Some(pid) = profile_id {
        query = query.filter(conversations::Column::ProfileId.eq(pid));
    }

    let rows = query.all(db).await.map_err(|e| e.to_string())?;

    let mut summaries = Vec::with_capacity(rows.len());
    for (conv, profile_opt) in rows {
        let count = Messages::find()
            .filter(msg_model::Column::ConversationId.eq(conv.id))
            .count(db)
            .await
            .unwrap_or(0);

        summaries.push(ConversationSummary {
            id: conv.id.to_string(),
            title: conv.title,
            profile_id: conv.profile_id.to_string(),
            profile_name: profile_opt.as_ref().map(|p| p.name.clone()),
            profile_deleted: profile_opt.map(|p| p.deleted_at.is_some()).unwrap_or(false),
            workspace_id: conv.workspace_id.map(|id| id.to_string()),
            created_at: conv.created_at.to_string(),
            updated_at: conv.updated_at.to_string(),
            message_count: count,
            folder_id: conv.folder_id,
            pinned: conv.pinned,
        });
    }

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

/// Pin a conversation.
#[specta]
#[tauri::command]
pub async fn pin_conversation(state: State<'_, Arc<AppState>>, id: Uuid) -> Result<(), String> {
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
    active.pinned = Set(true);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Unpin a conversation.
#[specta]
#[tauri::command]
pub async fn unpin_conversation(state: State<'_, Arc<AppState>>, id: Uuid) -> Result<(), String> {
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
    active.pinned = Set(false);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Update the workspace assignment of a conversation.
#[specta]
#[tauri::command]
pub async fn update_conversation_workspace(
    state: State<'_, Arc<AppState>>,
    id: Uuid,
    workspace_id: Option<Uuid>,
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
    active.workspace_id = Set(workspace_id);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

// ── Hydrate shared conversation ─────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn hydrate_shared_conversation(
    state: State<'_, Arc<AppState>>,
    payload: SharedConversationPayload,
) -> Result<HydrateResponse, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().fixed_offset();

    // Check if conversation already exists by ID (if the payload ID is a UUID)
    let conv_uuid = Uuid::parse_str(&payload.id).unwrap_or_else(|_| Uuid::new_v4());

    let existing = Conversation::find_by_id(conv_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?;

    let final_id = if let Some(conv) = existing {
        // Conversation already exists locally – do nothing
        conv.id
    } else {
        // Create a new conversation
        // Need a default profile ID – use the first active profile
        use skilldeck_models::profiles::Entity as Profiles;
        let default_profile = Profiles::find()
            .filter(skilldeck_models::profiles::Column::DeletedAt.is_null())
            .one(db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| {
                "No active profile found to own the imported conversation".to_string()
            })?;

        let new_conv = conversations::ActiveModel {
            id: Set(conv_uuid),
            profile_id: Set(default_profile.id),
            title: Set(Some(payload.title.clone())),
            workspace_id: Set(None),
            folder_id: Set(None),
            status: Set("active".to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            archived_at: Set(None),
            pinned: Set(false),
        };
        new_conv.insert(db).await.map_err(|e| e.to_string())?;
        conv_uuid
    };

    // Insert messages that don't already exist
    for msg in &payload.messages {
        let msg_uuid = Uuid::parse_str(&msg.id).unwrap_or_else(|_| Uuid::new_v4());
        let existing_msg = skilldeck_models::messages::Entity::find_by_id(msg_uuid)
            .one(db)
            .await
            .map_err(|e| e.to_string())?;

        if existing_msg.is_none() {
            let msg_created_at = chrono::DateTime::parse_from_rfc3339(&msg.created_at)
                .map(|dt| dt.with_timezone(&chrono::Utc).fixed_offset())
                .unwrap_or(now);

            let new_msg = skilldeck_models::messages::ActiveModel {
                id: Set(msg_uuid),
                conversation_id: Set(final_id),
                parent_id: Set(None),
                branch_id: Set(msg
                    .branch_id
                    .as_ref()
                    .and_then(|id| Uuid::parse_str(id).ok())),
                seen: Set(false),
                role: Set(msg.role.clone()),
                content: Set(msg.content.clone()),
                metadata: Set(None),
                node_document: Set(None),
                context_items: Set(None),
                input_tokens: Set(None),
                compacted: Set(false),
                output_tokens: Set(None),
                cache_read_tokens: Set(None),
                cache_write_tokens: Set(None),
                status: Set("active".to_string()),
                thinking_content: Set(None),
                thinking_document: Set(None),
                created_at: Set(msg_created_at),
            };
            new_msg.insert(db).await.map_err(|e| e.to_string())?;
        }
    }

    Ok(HydrateResponse {
        local_id: final_id.to_string(),
    })
}
