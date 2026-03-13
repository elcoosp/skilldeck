//! Message Tauri commands.
//!
//! `send_message` is the critical hot-path: it persists the user turn,
//! then spawns a detached Tokio task running the `AgentLoop`.  The loop
//! emits `AgentEvent` payloads to the frontend via the Tauri event bus at the
//! 50 ms / 100-char debounce cadence required by ASR-PERF-001.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::{events::AgentEvent, state::AppState};
use skilldeck_core::agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent};
use skilldeck_models::messages::{self, Entity as Messages};

/// Serialisable message returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct MessageData {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

/// List all messages for a conversation, oldest-first.
///
/// `branch_id` is reserved for branch-aware retrieval (v1.1).
#[tauri::command]
pub async fn list_messages(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    #[allow(unused_variables)] branch_id: Option<String>,
) -> Result<Vec<MessageData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    let rows = Messages::find()
        .filter(messages::Column::ConversationId.eq(conv_uuid))
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|m| MessageData {
            id: m.id.to_string(),
            conversation_id: m.conversation_id.to_string(),
            role: m.role,
            content: m.content,
            created_at: m.created_at.to_string(),
        })
        .collect())
}

/// Persist the user turn and kick off the agent loop on a background task.
///
/// Returns immediately once the message is persisted; the agent loop emits
/// `agent-event` payloads asynchronously.
#[tauri::command]
pub async fn send_message(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    content: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let msg_id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    // Persist user message.
    let user_msg = messages::ActiveModel {
        id: Set(msg_id),
        conversation_id: Set(conv_uuid),
        role: Set("user".to_string()),
        content: Set(content.clone()),
        created_at: Set(now),
        ..Default::default()
    };
    user_msg.insert(db).await.map_err(|e| e.to_string())?;

    // Emit "started" immediately so the UI can show a spinner.
    let _ = app.emit(
        "agent-event",
        AgentEvent::Started {
            conversation_id: conversation_id.clone(),
        },
    );

    // Clone what the background task needs (Arc clones are cheap).
    let state_arc = Arc::clone(&state);
    let conv_id_clone = conversation_id.clone();
    let content_clone = content.clone();
    let app_clone = app.clone();

    // Spawn detached — the Tauri command returns right away.
    tokio::spawn(async move {
        run_agent_loop(state_arc, conv_id_clone, content_clone, app_clone).await;
    });

    Ok(())
}

/// Resolve a pending tool-approval from the frontend.
///
/// Called when the user clicks "Approve" or "Deny" on a `ToolApprovalCard`.
#[tauri::command]
pub async fn resolve_tool_approval(
    state: State<'_, Arc<AppState>>,
    tool_call_id: String,
    approved: bool,
    edited_input: Option<serde_json::Value>,
) -> Result<(), String> {
    use skilldeck_core::agent::tool_dispatcher::ApprovalResult;

    let result = if approved {
        ApprovalResult::Approved { edited_input }
    } else {
        ApprovalResult::Denied { reason: None }
    };

    state
        .approval_gate
        .resolve(&tool_call_id, result)
        .map_err(|e| e.to_string())
}

// ── Internal helper ───────────────────────────────────────────────────────────

/// Drive the `AgentLoop` and forward every event to the Tauri bus.
///
/// This function runs on a background Tokio task and never panics — all errors
/// are emitted as `AgentEvent::Error` so the frontend can display them.
async fn run_agent_loop(
    state: Arc<AppState>,
    conversation_id: String,
    user_message: String,
    app: tauri::AppHandle,
) {
    use skilldeck_core::agent::tool_dispatcher::ToolDispatcher;
    use tokio::sync::mpsc;

    // Resolve profile + provider for this conversation.
    let provider = match state.registry.get_provider("claude") {
        Some(p) => p,
        None => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: "No model provider registered".to_string(),
                },
            );
            return;
        }
    };

    let (tx, mut rx) = mpsc::channel::<Result<AgentLoopEvent, skilldeck_core::CoreError>>(128);

    let dispatcher = Arc::new(ToolDispatcher::new(
        Arc::clone(&state.registry.mcp_registry),
        Arc::clone(&state.approval_gate),
    ));

    let agent = AgentLoop::new(
        provider,
        "claude-sonnet-4-5".to_string(),
        AgentLoopConfig::default(),
        tx,
    )
    .with_dispatcher(dispatcher);

    // Run the loop concurrently while we drain the event channel.
    let conv_id_for_loop = conversation_id.clone();
    let loop_handle = tokio::spawn(async move { agent.run(user_message).await });

    // Forward loop events to Tauri event bus.
    while let Some(event) = rx.recv().await {
        let tauri_event = match event {
            Ok(AgentLoopEvent::Token { delta }) => AgentEvent::Token {
                conversation_id: conversation_id.clone(),
                delta,
            },
            Ok(AgentLoopEvent::ToolCall { tool_call }) => AgentEvent::ToolCall {
                conversation_id: conversation_id.clone(),
                tool_call: crate::events::AgentToolCall {
                    id: tool_call.id.clone(),
                    name: tool_call.function.name.clone(),
                    arguments: serde_json::from_str(&tool_call.function.arguments)
                        .unwrap_or_default(),
                },
            },
            Ok(AgentLoopEvent::Done {
                input_tokens,
                output_tokens,
                ..
            }) => AgentEvent::Done {
                conversation_id: conversation_id.clone(),
                input_tokens,
                output_tokens,
            },
            Err(e) => AgentEvent::Error {
                conversation_id: conversation_id.clone(),
                message: e.to_string(),
            },
        };

        let _ = app.emit("agent-event", tauri_event);
    }

    // Propagate any loop-level error.
    if let Err(e) = loop_handle.await.unwrap_or_else(|e| {
        Err(skilldeck_core::CoreError::Internal {
            message: e.to_string(),
        })
    }) {
        let _ = app.emit(
            "agent-event",
            AgentEvent::Error {
                conversation_id: conv_id_for_loop,
                message: e.to_string(),
            },
        );
    }
}
