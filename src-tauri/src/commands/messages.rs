// File: src-tauri/src/commands/messages.rs
//! Message Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryFilter, QueryOrder};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::pin::Pin;
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::commands::queue;
use crate::{events::AgentEvent, state::AppState};
use async_trait::async_trait;
use futures::Future;
use skilldeck_core::agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent, all_built_in_tools};
use skilldeck_core::traits::subagent_spawner::SubagentSpawner;
use skilldeck_models::context_item::{ContextItem, FolderScope};
use skilldeck_models::conversations::{self, Entity as Conversations};
use skilldeck_models::messages::{self, Entity as Messages};

/// Serialisable message returned to the frontend.
#[derive(Debug, Clone, Serialize, Type)]
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
        .filter(messages::COLUMN.conversation_id.eq(conv_uuid))
        .order_by_asc(messages::COLUMN.created_at)
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

// =============================================================================
// Internal send function
// =============================================================================

pub(crate) async fn send_message_internal(
    state: Arc<AppState>,
    conversation_id: String,
    content: String,
    context_items: Option<Vec<ContextItem>>,
    app: tauri::AppHandle,
    metadata: Option<serde_json::Value>,
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

    // Convert context_items to JSON, default to empty array if None
    let items_json = context_items
        .as_ref()
        .map(|items| serde_json::to_value(items).map_err(|e| e.to_string()))
        .transpose()?
        .unwrap_or(serde_json::Value::Array(vec![]));

    let user_msg = messages::ActiveModel {
        id: Set(msg_id),
        conversation_id: Set(conv_uuid),
        role: Set("user".to_string()),
        content: Set(content.clone()),
        metadata: Set(metadata),
        context_items: Set(Some(items_json)),
        created_at: Set(now),
        ..Default::default()
    };
    user_msg.insert(db).await.map_err(|e| e.to_string())?;

    let _ = app.emit(
        "agent-event",
        AgentEvent::Persisted {
            conversation_id: conversation_id.clone(),
        },
    );

    let _ = app.emit(
        "agent-event",
        AgentEvent::Started {
            conversation_id: conversation_id.clone(),
        },
    );

    let state_arc = state.clone();
    let conv_id_clone = conversation_id.clone();
    let content_clone = content.clone();
    let app_clone = app.clone();
    let context_items_clone = context_items;

    let future: Pin<Box<dyn Future<Output = ()> + Send + 'static>> = Box::pin(async move {
        run_agent_loop(
            state_arc,
            conv_id_clone,
            content_clone,
            context_items_clone,
            app_clone,
        )
    });
    tokio::spawn(future);

    Ok(())
}

#[derive(Debug, Deserialize, Type)]
pub struct SendMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub context_items: Option<Vec<ContextItem>>,
}

#[specta]
#[tauri::command]
pub async fn send_message(
    state: State<'_, Arc<AppState>>,
    req: SendMessageRequest,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if state.is_agent_running(&req.conversation_id) {
        let id = queue::add_queued_message_internal(
            &state,
            &req.conversation_id,
            req.content,
            req.context_items,
        )
        .await?;
        let _ = app.emit(
            "queued-message-added",
            serde_json::json!({
                "conversation_id": req.conversation_id,
                "id": id
            }),
        );
        return Ok(());
    }

    let state_clone = (*state).clone();
    send_message_internal(
        state_clone,
        req.conversation_id,
        req.content,
        req.context_items,
        app,
        None,
    )
    .await
}

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

use skilldeck_core::traits::{McpTool, ToolDefinition};

fn mcp_tool_to_tool_def(mcp_tool: &McpTool) -> ToolDefinition {
    ToolDefinition {
        name: mcp_tool.name.clone(),
        description: mcp_tool.description.clone(),
        input_schema: mcp_tool.input_schema.clone(),
    }
}

async fn resolve_provider_and_model(state: &AppState, conversation_id: &str) -> (String, String) {
    use skilldeck_models::{conversations::Entity as Conversations, profiles::Entity as Profiles};

    const FALLBACK_PROVIDER: &str = "ollama";
    const FALLBACK_MODEL: &str = "llama3.2:latest";

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
        let model = skilldeck_core::providers::OllamaProvider::fetch_installed_models()
            .await
            .into_iter()
            .next()
            .map(|m| m.id)
            .unwrap_or_else(|| FALLBACK_MODEL.into());
        (FALLBACK_PROVIDER.into(), model)
    }
}

struct SpawnerWithContext {
    state: Arc<AppState>,
    provider: Arc<dyn skilldeck_core::traits::ModelProvider>,
    model_id: String,
}

#[async_trait]
impl SubagentSpawner for SpawnerWithContext {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String> {
        self.state
            .do_spawn_subagent(
                task,
                skill_names,
                self.provider.clone(),
                self.model_id.clone(),
            )
            .await
    }

    async fn get_subagent_result(&self, subagent_id: &str) -> Option<String> {
        self.state
            .subagent_results
            .get(subagent_id)
            .map(|r| r.clone())
    }
}

fn is_retryable_error(e: &skilldeck_core::CoreError) -> bool {
    matches!(
        e,
        skilldeck_core::CoreError::ModelConnection { .. }
            | skilldeck_core::CoreError::ModelRateLimited { .. }
            | skilldeck_core::CoreError::ModelTimeout { .. }
            | skilldeck_core::CoreError::ModelInternal { .. }
    )
}

/// Run the agent loop in a spawned task.
fn run_agent_loop(
    state: Arc<AppState>,
    conversation_id: String,
    user_message: String,
    context_items: Option<Vec<ContextItem>>,
    app: tauri::AppHandle,
) {
    use skilldeck_core::agent::tool_dispatcher::ToolDispatcher;
    use skilldeck_core::traits::ChatMessage;
    use tokio::sync::mpsc;

    tokio::spawn(async move {
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

        let spawner = Arc::new(SpawnerWithContext {
            state: state.clone(),
            provider: provider.clone(),
            model_id: model_id.clone(),
        });

        let dispatcher = Arc::new(ToolDispatcher::new(
            Arc::clone(&state.registry.mcp_registry),
            Arc::clone(&state.approval_gate),
            Arc::clone(&state.registry.skill_registry),
            provider.supports_toon(),
            Some(spawner as Arc<dyn SubagentSpawner>),
        ));

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
            .filter(messages::COLUMN.conversation_id.eq(conv_uuid))
            .order_by_asc(messages::COLUMN.created_at)
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

        let built_in_tools = all_built_in_tools();
        for tool_def in built_in_tools {
            tracing::debug!("Added built-in tool '{}'", tool_def.name);
            agent = agent.with_tool(tool_def);
        }

        let skills = state.registry.skill_registry.skills().await;
        let active_skills: Vec<(String, String)> = skills
            .into_iter()
            .filter(|s| s.is_active)
            .map(|s| (s.name, s.description))
            .collect();

        if !active_skills.is_empty() {
            if provider.supports_toon() {
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
                    let mut catalog = String::from("\n\n## Available Skills\n");
                    for (name, desc) in active_skills {
                        catalog.push_str(&format!("- **{}**: {}\n", name, desc));
                    }
                    agent = agent.with_skill(catalog);
                }
            } else {
                let mut catalog = String::from("\n\n## Available Skills\n");
                for (name, desc) in active_skills {
                    catalog.push_str(&format!("- **{}**: {}\n", name, desc));
                }
                agent = agent.with_skill(catalog);
            }
        }

        // Inject attached context items (if any)
        if let Some(items) = context_items {
            let mut combined_context = String::new();
            for item in items {
                match item {
                    ContextItem::File { path, .. } => {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            combined_context
                                .push_str(&format!("--- File: {} ---\n{}\n\n", path, content));
                        } else {
                            tracing::warn!("Could not read file: {}", path);
                        }
                    }
                    ContextItem::Folder { path, scope, .. } => {
                        let deep = match scope {
                            FolderScope::Shallow => false,
                            FolderScope::Deep => true,
                        };
                        if let Ok((content, _)) =
                            crate::skills::folder_assembler::assemble_folder_context(
                                std::path::Path::new(&path),
                                deep,
                                Some(500_000),
                            )
                        {
                            combined_context.push_str(&format!(
                                "--- Folder: {} (scope: {:?}) ---\n{}\n\n",
                                path, scope, content
                            ));
                        }
                    }
                    ContextItem::Skill { name } => {
                        if let Some(skill) = state.registry.skill_registry.get_skill(&name).await {
                            combined_context.push_str(&format!(
                                "--- Skill: {} ---\n{}\n\n",
                                name, skill.content_md
                            ));
                        } else {
                            tracing::warn!("Skill not found: {}", name);
                        }
                    }
                }
            }
            if !combined_context.is_empty() {
                agent = agent.with_skill(combined_context);
            }
        }

        let loop_handle = tokio::spawn(async move { agent.run(user_message).await });

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
                                message: format!(
                                    "Failed to get DB connection for persistence: {}",
                                    e
                                ),
                            },
                        );
                        return;
                    }
                };
                let now = chrono::Utc::now().fixed_offset();

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
                    }
                }

                if let Ok(Some(conv)) = Conversations::find_by_id(conv_uuid).one(db).await {
                    let mut active: conversations::ActiveModel = conv.into();
                    active.updated_at = Set(now);
                    if let Err(e) = active.update(db).await {
                        tracing::warn!("Failed to update conversation timestamp: {}", e);
                    }
                }

                let _ = app.emit(
                    "agent-event",
                    AgentEvent::Persisted {
                        conversation_id: conversation_id.clone(),
                    },
                );

                queue::auto_send_next_queued(state.clone(), conversation_id.clone(), app.clone());
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
    });
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
