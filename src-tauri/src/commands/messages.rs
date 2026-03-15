// File: src-tauri/src/commands/messages.rs
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
use specta::specta;
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::{events::AgentEvent, state::AppState};
use skilldeck_core::agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent, all_built_in_tools};
use skilldeck_models::conversations::{self, Entity as Conversations};
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

#[specta]
#[tauri::command]
pub async fn cancel_agent(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<(), String> {
    state.cancel_agent(&conversation_id);
    Ok(())
}

/// List all messages for a conversation, oldest-first.
///
/// `branch_id` is reserved for branch-aware retrieval (v1.1).
#[specta]
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
#[specta]
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
#[specta]
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

/// Convert an MCP tool into a core `ToolDefinition`.
use skilldeck_core::traits::{McpTool, ToolDefinition};

fn mcp_tool_to_tool_def(mcp_tool: &McpTool) -> ToolDefinition {
    ToolDefinition {
        name: mcp_tool.name.clone(),
        description: mcp_tool.description.clone(),
        input_schema: mcp_tool.input_schema.clone(),
    }
}

/// Resolve which provider and model ID to use for a conversation.
///
/// Lookup order:
/// 1. Read the conversation's profile from the DB.
/// 2. If the profile's provider is registered in the registry, use it.
/// 3. Otherwise fall back to `"ollama"` with its first available model.
///
/// Returns `(provider_id, model_id)`.
async fn resolve_provider_and_model(state: &AppState, conversation_id: &str) -> (String, String) {
    use skilldeck_models::{conversations::Entity as Conversations, profiles::Entity as Profiles};

    const FALLBACK_PROVIDER: &str = "ollama";
    const FALLBACK_MODEL: &str = "llama3.2:latest";

    // Try to read conversation → profile from DB.
    let db = match state.registry.db.connection().await {
        Ok(db) => db,
        Err(_) => return (FALLBACK_PROVIDER.into(), FALLBACK_MODEL.into()),
    };
    let conv_uuid = match Uuid::parse_str(conversation_id) {
        Ok(u) => u,
        Err(_) => return (FALLBACK_PROVIDER.into(), FALLBACK_MODEL.into()),
    };

    let conv = match Conversations::find_by_id(conv_uuid).one(db).await {
        Ok(Some(c)) => c,
        _ => return (FALLBACK_PROVIDER.into(), FALLBACK_MODEL.into()),
    };

    let profile = match Profiles::find_by_id(conv.profile_id).one(db).await {
        Ok(Some(p)) => p,
        _ => return (FALLBACK_PROVIDER.into(), FALLBACK_MODEL.into()),
    };

    // Use the profile's provider if it's registered; otherwise fall back.
    if state
        .registry
        .get_provider(&profile.model_provider)
        .is_some()
    {
        (profile.model_provider, profile.model_id)
    } else {
        tracing::warn!(
            "Provider '{}' not registered (no API key?), falling back to {}",
            profile.model_provider,
            FALLBACK_PROVIDER
        );
        // Pick the first available ollama model, or the known fallback.
        let model = skilldeck_core::providers::OllamaProvider::fetch_installed_models()
            .await
            .into_iter()
            .next()
            .map(|m| m.id)
            .unwrap_or_else(|| FALLBACK_MODEL.into());
        (FALLBACK_PROVIDER.into(), model)
    }
}

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
    use skilldeck_core::traits::ChatMessage;
    use tokio::sync::mpsc;

    // Resolve provider + model from the conversation's profile.
    let (provider_id, model_id) = resolve_provider_and_model(&state, &conversation_id).await;

    let provider = match state.registry.get_provider(&provider_id) {
        Some(p) => p,
        None => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!(
                        "No model provider registered for '{}'. \
                         Add an API key in Settings or install Ollama.",
                        provider_id
                    ),
                },
            );
            return;
        }
    };

    tracing::info!(
        "Agent loop: conversation={} provider={} model={}",
        conversation_id,
        provider_id,
        model_id
    );

    let (tx, mut rx) = mpsc::channel::<Result<AgentLoopEvent, skilldeck_core::CoreError>>(128);

    // Create ToolDispatcher with all required arguments
    let dispatcher = Arc::new(ToolDispatcher::new(
        Arc::clone(&state.registry.mcp_registry),
        Arc::clone(&state.approval_gate),
        Arc::clone(&state.registry.skill_registry),
        provider.supports_toon(),
    ));

    // Load existing messages to provide history.
    let db = match state.registry.db.connection().await {
        Ok(conn) => conn,
        Err(e) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!("Failed to get database connection: {}", e),
                },
            );
            return;
        }
    };
    let conv_uuid = match Uuid::parse_str(&conversation_id) {
        Ok(u) => u,
        Err(e) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!("Invalid conversation ID: {}", e),
                },
            );
            return;
        }
    };
    let history_rows = match Messages::find()
        .filter(messages::Column::ConversationId.eq(conv_uuid))
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await
    {
        Ok(rows) => rows,
        Err(e) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!("Failed to load message history: {}", e),
                },
            );
            return;
        }
    };

    let history = history_rows
        .into_iter()
        .map(|m| ChatMessage {
            role: match m.role.as_str() {
                "user" => skilldeck_core::traits::MessageRole::User,
                "assistant" => skilldeck_core::traits::MessageRole::Assistant,
                "tool" => skilldeck_core::traits::MessageRole::Tool,
                _ => skilldeck_core::traits::MessageRole::System,
            },
            content: m.content,
            name: None,
        })
        .collect();

    let mut agent = AgentLoop::new(provider.clone(), model_id, AgentLoopConfig::default(), tx)
        .with_history(history)
        .with_dispatcher(dispatcher);

    // Inject MCP tools (from all connected servers)
    let all_mcp_tools = state.registry.mcp_registry.all_tools();
    for (server_name, mcp_tool) in all_mcp_tools {
        let tool_def = mcp_tool_to_tool_def(&mcp_tool);
        agent = agent.with_tool(tool_def);
        tracing::debug!(
            "Added MCP tool '{}' from server '{}'",
            mcp_tool.name,
            server_name
        );
    }

    // Inject built-in tools (always available)
    let built_in_tools = all_built_in_tools();
    for tool_def in built_in_tools {
        tracing::debug!("Added built-in tool '{}'", tool_def.name);
        agent = agent.with_tool(tool_def);
    }

    // Inject skill catalog (Toon if supported)
    let skills = state.registry.skill_registry.skills().await;
    let active_skills: Vec<(String, String)> = skills
        .into_iter()
        .filter(|s| s.is_active)
        .map(|s| (s.name, s.description))
        .collect();

    if !active_skills.is_empty() {
        if provider.supports_toon() {
            // Build a JSON array of skill objects
            let skills_json: Vec<serde_json::Value> = active_skills
                .iter()
                .map(|(name, desc)| serde_json::json!({ "name": name, "description": desc }))
                .collect();

            let toon_catalog = toon_rust::encode(
                &serde_json::json!({ "skills": skills_json }),
                Some(&toon_rust::EncodeOptions {
                    delimiter: Some(toon_rust::options::Delimiter::Tab),
                    ..Default::default()
                }),
            )
            .map_err(|e| {
                tracing::error!("Failed to encode skill catalog as Toon: {}", e);
                e
            })
            .ok();

            if let Some(catalog) = toon_catalog {
                agent = agent.with_skill(format!("<toon>\n{}\n</toon>", catalog));
            } else {
                // Fallback to markdown
                let mut catalog = String::from("\n\n## Available Skills\n");
                for (name, desc) in active_skills {
                    catalog.push_str(&format!("- **{}**: {}\n", name, desc));
                }
                agent = agent.with_skill(catalog);
            }
        } else {
            // Fallback to markdown catalog
            let mut catalog = String::from("\n\n## Available Skills\n");
            for (name, desc) in active_skills {
                catalog.push_str(&format!("- **{}**: {}\n", name, desc));
            }
            agent = agent.with_skill(catalog);
        }
    }

    // Run the loop concurrently while we drain the event channel.
    let loop_handle = tokio::spawn(async move { agent.run(user_message).await });

    // Forward loop events to Tauri event bus.
    while let Some(event) = rx.recv().await {
        let tauri_event = match event {
            Ok(AgentLoopEvent::Token { delta }) => AgentEvent::Token {
                conversation_id: conversation_id.clone(),
                delta,
            },
            Ok(AgentLoopEvent::Cancelled) => AgentEvent::Cancelled {
                conversation_id: conversation_id.clone(),
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

    // Loop has finished. Retrieve new messages and persist them.
    let loop_result = loop_handle.await;
    match loop_result {
        Ok(Ok(new_messages)) => {
            let db = match state.registry.db.connection().await {
                Ok(conn) => conn,
                Err(e) => {
                    let _ = app.emit(
                        "agent-event",
                        AgentEvent::Error {
                            conversation_id: conversation_id.clone(),
                            message: format!("Failed to get DB connection for persistence: {}", e),
                        },
                    );
                    return;
                }
            };
            let now = chrono::Utc::now().fixed_offset();

            // Insert each new message.
            for msg in new_messages {
                let role_str = match msg.role {
                    skilldeck_core::traits::MessageRole::User => "user",
                    skilldeck_core::traits::MessageRole::Assistant => "assistant",
                    skilldeck_core::traits::MessageRole::Tool => "tool",
                    skilldeck_core::traits::MessageRole::System => "system",
                };
                let msg_id = Uuid::new_v4();
                let active = messages::ActiveModel {
                    id: Set(msg_id),
                    conversation_id: Set(conv_uuid),
                    role: Set(role_str.to_string()),
                    content: Set(msg.content),
                    created_at: Set(now),
                    ..Default::default()
                };
                if let Err(e) = active.insert(db).await {
                    let _ = app.emit(
                        "agent-event",
                        AgentEvent::Error {
                            conversation_id: conversation_id.clone(),
                            message: format!("Failed to persist message: {}", e),
                        },
                    );
                    // Continue trying to persist other messages.
                }
            }

            // Update conversation's updated_at timestamp.
            if let Ok(Some(conv)) = Conversations::find_by_id(conv_uuid).one(db).await {
                let mut active: conversations::ActiveModel = conv.into();
                active.updated_at = Set(now);
                if let Err(e) = active.update(db).await {
                    tracing::warn!("Failed to update conversation timestamp: {}", e);
                }
            }

            // Emit persisted event to notify frontend to refresh.
            let _ = app.emit(
                "agent-event",
                AgentEvent::Persisted {
                    conversation_id: conversation_id.clone(),
                },
            );
        }
        Ok(Err(e)) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: e.to_string(),
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!("Agent loop panicked: {}", e),
                },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_mcp_tool_conversion() {
        let mcp_tool = McpTool {
            name: "read_file".to_string(),
            description: "Read a file".to_string(),
            input_schema: json!({"type":"object"}),
        };
        let def = mcp_tool_to_tool_def(&mcp_tool);
        assert_eq!(def.name, "read_file");
        assert_eq!(def.description, "Read a file");
        assert_eq!(def.input_schema, json!({"type":"object"}));
    }
}
