// src-tauri/src/commands/queue.rs
//! Queued message Tauri commands.

use std::pin::Pin;
use std::sync::Arc;

use futures::Future;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryFilter, QueryOrder, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::commands::messages::send_message_internal;
use crate::events::QueueEvent; // NEW import
use crate::state::AppState;
use skilldeck_models::context_item::{ContextItem, ContextItems};
use skilldeck_models::messages::MessageMetadata;
use skilldeck_models::queued_messages::{self, Entity as Queued};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct QueuedMessage {
    pub id: String,
    pub conversation_id: String,
    pub content: String,
    pub position: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<queued_messages::Model> for QueuedMessage {
    fn from(m: queued_messages::Model) -> Self {
        Self {
            id: m.id.to_string(),
            conversation_id: m.conversation_id.to_string(),
            content: m.content,
            position: m.position,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

// =============================================================================
// Internal functions
// =============================================================================

pub async fn add_queued_message_internal(
    state: &AppState,
    conversation_id: &str,
    content: String,
    context_items: Option<Vec<ContextItem>>,
) -> Result<String, String> {
    tracing::info!(
        "add_queued_message_internal: conversation={}",
        conversation_id
    );
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(conversation_id).map_err(|e| e.to_string())?;

    let max_pos = Queued::find()
        .filter(queued_messages::COLUMN.conversation_id.eq(conv_uuid))
        .order_by_desc(queued_messages::COLUMN.position)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .map(|m| m.position)
        .unwrap_or(0);

    let context_items_model = context_items
        .map(ContextItems)
        .unwrap_or_else(|| ContextItems(vec![]));

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = queued_messages::ActiveModel {
        id: Set(id),
        conversation_id: Set(conv_uuid),
        content: Set(content),
        position: Set(max_pos + 1),
        created_at: Set(now),
        updated_at: Set(now),
        context_items: Set(Some(context_items_model)),
    };

    model.insert(db).await.map_err(|e| e.to_string())?;
    tracing::info!("Queued message added with id={}", id);
    Ok(id.to_string())
}

pub async fn list_queued_messages_internal(
    state: &AppState,
    conversation_id: &str,
) -> Result<Vec<QueuedMessage>, String> {
    tracing::debug!(
        "list_queued_messages_internal: conversation_id={}",
        conversation_id
    );
    let db = state.registry.db.connection().await.map_err(|e| {
        tracing::error!("DB connection error: {}", e);
        e.to_string()
    })?;
    let conv_uuid = Uuid::parse_str(conversation_id).map_err(|e| {
        tracing::error!("Invalid UUID: {}", e);
        e.to_string()
    })?;

    let rows = Queued::find()
        .filter(queued_messages::COLUMN.conversation_id.eq(conv_uuid))
        .order_by_asc(queued_messages::COLUMN.position)
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Query error: {}", e);
            e.to_string()
        })?;

    tracing::debug!("Found {} queued messages", rows.len());
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn update_queued_message_internal(
    state: &AppState,
    id: &str,
    content: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(id).map_err(|e| e.to_string())?;

    let row = Queued::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Queued message {} not found", id))?;

    let mut active: queued_messages::ActiveModel = row.into();
    active.content = Set(content);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn delete_queued_message_internal(state: &AppState, id: &str) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(id).map_err(|e| e.to_string())?;

    Queued::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn reorder_queued_messages_internal(
    state: &AppState,
    conversation_id: &str,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(conversation_id).map_err(|e| e.to_string())?;

    let txn = db.begin().await.map_err(|e| e.to_string())?;

    let messages = Queued::find()
        .filter(queued_messages::COLUMN.conversation_id.eq(conv_uuid))
        .all(&txn)
        .await
        .map_err(|e| e.to_string())?;

    let mut by_id = std::collections::HashMap::new();
    for msg in &messages {
        by_id.insert(msg.id.to_string(), msg);
    }

    for (pos, id_str) in ordered_ids.iter().enumerate() {
        if let Some(msg) = by_id.get(id_str) {
            if msg.position != (pos as i32) + 1 {
                let mut active: queued_messages::ActiveModel = (*msg).clone().into();
                active.position = Set((pos as i32) + 1);
                active.updated_at = Set(chrono::Utc::now().fixed_offset());
                active.update(&txn).await.map_err(|e| e.to_string())?;
            }
        } else {
            return Err(format!("Message id {} not found", id_str));
        }
    }

    txn.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn merge_queued_messages_internal(
    state: &AppState,
    ids: Vec<String>,
) -> Result<String, String> {
    if ids.len() < 2 {
        return Err("At least two messages required to merge".to_string());
    }

    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|s| Uuid::parse_str(s).map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;

    let txn = db.begin().await.map_err(|e| e.to_string())?;

    let messages = Queued::find()
        .filter(queued_messages::COLUMN.id.is_in(uuids.clone()))
        .all(&txn)
        .await
        .map_err(|e| e.to_string())?;

    if messages.len() != ids.len() {
        return Err("Some messages not found".to_string());
    }

    let min_position = messages.iter().map(|m| m.position).min().unwrap();
    let conversation_id = messages[0].conversation_id;

    let merged_content = messages
        .iter()
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    for msg in &messages {
        let active: queued_messages::ActiveModel = msg.clone().into();
        active.delete(&txn).await.map_err(|e| e.to_string())?;
    }

    let subsequent = Queued::find()
        .filter(queued_messages::COLUMN.conversation_id.eq(conversation_id))
        .filter(
            queued_messages::COLUMN
                .position
                .gt(min_position + messages.len() as i32 - 1),
        )
        .all(&txn)
        .await
        .map_err(|e| e.to_string())?;

    for msg in subsequent {
        let mut active: queued_messages::ActiveModel = msg.into();
        active.position = Set(active.position.unwrap() - (messages.len() as i32 - 1));
        active.updated_at = Set(chrono::Utc::now().fixed_offset());
        active.update(&txn).await.map_err(|e| e.to_string())?;
    }

    let new_id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();
    let new_msg = queued_messages::ActiveModel {
        id: Set(new_id),
        conversation_id: Set(conversation_id),
        content: Set(merged_content),
        position: Set(min_position),
        created_at: Set(now),
        updated_at: Set(now),
        context_items: Set(Some(ContextItems(vec![]))),
    };
    new_msg.insert(&txn).await.map_err(|e| e.to_string())?;

    txn.commit().await.map_err(|e| e.to_string())?;
    Ok(new_id.to_string())
}

/// Automatically send the next queued message if conditions allow.
pub fn auto_send_next_queued(state: Arc<AppState>, conversation_id: String, app: tauri::AppHandle) {
    tokio::spawn(async move {
        if state.is_agent_running(&conversation_id) {
            return;
        }
        let is_paused = state
            .auto_send_paused
            .get(&conversation_id)
            .map(|r| *r)
            .unwrap_or(false);
        if is_paused {
            return;
        }
        if let Ok(queued) = list_queued_messages_internal(&state, &conversation_id).await {
            if let Some(first) = queued.first() {
                if let Ok(()) = delete_queued_message_internal(&state, &first.id).await {
                    let meta = MessageMetadata {
                        from_queue: Some(true),
                        queued_at: Some(first.created_at.clone()),
                        ..Default::default()
                    };
                    let state_clone = state.clone();
                    let conv_clone = conversation_id.clone();
                    let content_clone = first.content.clone();
                    let app_clone = app.clone();
                    let first_id = first.id.clone();

                    let inner: Pin<Box<dyn Future<Output = ()> + Send + 'static>> =
                        Box::pin(async move {
                            // send_message_internal now returns the user message ID
                            match send_message_internal(
                                state_clone,
                                conv_clone.clone(),
                                content_clone,
                                None, // branch_id
                                None, // context_items
                                app_clone,
                                Some(meta),
                            )
                            .await
                            {
                                Ok(user_message_id) => {
                                    // Emit queue event with the new message ID
                                    let _ = app.emit(
                                        "queue-event",
                                        QueueEvent::MessageSent {
                                            conversation_id: conv_clone,
                                            message_id: user_message_id.to_string(),
                                        },
                                    );
                                }
                                Err(e) => {
                                    tracing::error!("Failed to send queued message: {}", e);
                                }
                            }
                        });
                    tokio::spawn(inner);
                }
            }
        }
    });
}

// =============================================================================
// Tauri command wrappers
// =============================================================================

#[derive(Debug, Deserialize, Type)]
pub struct AddQueuedMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub context_items: Option<Vec<ContextItem>>,
}

#[specta]
#[tauri::command]
pub async fn add_queued_message(
    state: State<'_, Arc<AppState>>,
    req: AddQueuedMessageRequest,
) -> Result<String, String> {
    add_queued_message_internal(&state, &req.conversation_id, req.content, req.context_items).await
}

#[specta]
#[tauri::command]
pub async fn list_queued_messages(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<Vec<QueuedMessage>, String> {
    list_queued_messages_internal(&state, &conversation_id).await
}

#[specta]
#[tauri::command]
pub async fn update_queued_message(
    state: State<'_, Arc<AppState>>,
    id: String,
    content: String,
) -> Result<(), String> {
    update_queued_message_internal(&state, &id, content).await
}

#[specta]
#[tauri::command]
pub async fn delete_queued_message(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    delete_queued_message_internal(&state, &id).await
}

#[specta]
#[tauri::command]
pub async fn reorder_queued_messages(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    reorder_queued_messages_internal(&state, &conversation_id, ordered_ids).await
}

#[specta]
#[tauri::command]
pub async fn merge_queued_messages(
    state: State<'_, Arc<AppState>>,
    ids: Vec<String>,
) -> Result<String, String> {
    merge_queued_messages_internal(&state, ids).await
}

#[specta]
#[tauri::command]
pub async fn set_auto_send_paused(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    paused: bool,
) -> Result<(), String> {
    state.auto_send_paused.insert(conversation_id, paused);
    Ok(())
}

#[specta]
#[tauri::command]
pub async fn process_queued_messages(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    auto_send_next_queued((*state).clone(), conversation_id, app);
    Ok(())
}
