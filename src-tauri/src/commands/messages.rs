// src/commands/messages.rs
//! Message Tauri commands.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, DatabaseConnection,
    DbBackend, EntityTrait, QueryFilter, QueryOrder, Statement,
};
use sea_query::Expr;
use serde::{Deserialize, Serialize};
use skilldeck_core::CoreError;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::artifacts::storage::store_artifact_content;
use crate::commands::headings::{HeadingItem, get_conversation_messages_headings};
use crate::commands::queue;
use crate::{events::AgentEvent, state::AppState};
use async_trait::async_trait;
use skilldeck_core::agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent, all_built_in_tools};
use skilldeck_core::traits::subagent_spawner::SubagentSpawner;
use skilldeck_models::artifacts;
use skilldeck_models::context_item::{ContextItem, ContextItems, FolderScope};
use skilldeck_models::conversations::{self, Entity as Conversations};
use skilldeck_models::messages::{self, Entity as Messages, MessageMetadata};

use skilldeck_core::markdown::streaming::IncrementalStream;
use skilldeck_core::markdown::types::NodeDocument;

/// Serialisable message returned to the frontend.
#[derive(Debug, Clone, Serialize, Type)]
pub struct MessageData {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub compacted: bool,
    pub context_items: Option<Vec<ContextItem>>,
    pub metadata: Option<MessageMetadata>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub seen: bool,
    pub node_document: Option<NodeDocument>,
    pub status: String,
    pub thinking_content: Option<String>,
    pub thinking_document: Option<NodeDocument>,
}

/// Request for searching messages within a conversation.
#[derive(Debug, Deserialize, Type)]
pub struct SearchMessagesRequest {
    pub conversation_id: String,
    pub query: String,
    pub limit: Option<u64>,
}

/// Result of a search within a conversation.
#[derive(Debug, Serialize, Type)]
pub struct SearchMessagesResult {
    pub message_id: String,
    pub snippet: String,
}

/// Request for searching all messages across conversations.
#[derive(Debug, Deserialize, Type)]
pub struct GlobalSearchRequest {
    pub query: String,
    pub limit: Option<u64>,
}

/// Result of a global search across conversations.
#[derive(Debug, Serialize, Type)]
pub struct GlobalSearchResult {
    pub conversation_id: String,
    pub conversation_title: Option<String>,
    pub message_id: String,
    pub message_snippet: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Type)]
pub struct ConversationBootstrapData {
    pub messages: Vec<MessageData>,
    pub branches: Vec<crate::commands::branches::BranchInfo>,
    pub draft: Option<(String, Vec<serde_json::Value>)>,
    pub queued: Vec<crate::commands::queue::QueuedMessage>,
    pub headings: Vec<HeadingItem>,
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
    branch_id: Option<String>,
) -> Result<Vec<MessageData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    let mut query = Messages::find().filter(messages::Column::ConversationId.eq(conv_uuid));

    if let Some(branch_uuid) = branch_uuid {
        use skilldeck_models::conversation_branches::Entity as Branches;
        let branch = Branches::find_by_id(branch_uuid)
            .one(db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Branch {} not found", branch_uuid))?;
        let parent_msg_id = branch.parent_message_id;

        let parent_msg = Messages::find_by_id(parent_msg_id)
            .one(db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Parent message {} not found", parent_msg_id))?;

        use sea_orm::Condition;
        query = query.filter(
            Condition::any()
                .add(messages::Column::BranchId.eq(branch_uuid))
                .add(
                    Condition::all()
                        .add(messages::Column::BranchId.is_null())
                        .add(messages::Column::CreatedAt.lte(parent_msg.created_at)),
                ),
        );
    } else {
        query = query.filter(messages::Column::BranchId.is_null());
    }

    let rows = query
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|m| {
            let context_items = m.context_items.map(|c| c.0);
            let node_document = m
                .node_document
                .and_then(|x| serde_json::from_value::<NodeDocument>(x).ok());
            let thinking_document = m
                .thinking_document
                .and_then(|x| serde_json::from_value::<NodeDocument>(x).ok());
            MessageData {
                id: m.id.to_string(),
                conversation_id: m.conversation_id.to_string(),
                role: m.role,
                compacted: m.compacted,
                content: m.content,
                created_at: m.created_at.to_string(),
                context_items,
                metadata: m.metadata.clone(),
                input_tokens: m.input_tokens,
                output_tokens: m.output_tokens,
                seen: m.seen,
                node_document,
                status: m.status,
                thinking_content: m.thinking_content,
                thinking_document,
            }
        })
        .collect())
}

/// Mark a single message as seen.
#[specta]
#[tauri::command]
pub async fn mark_message_seen(
    state: State<'_, Arc<AppState>>,
    message_id: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let msg_uuid = Uuid::parse_str(&message_id).map_err(|e| e.to_string())?;

    messages::Entity::update_many()
        .col_expr(messages::Column::Seen, Expr::value(true))
        .filter(messages::Column::Id.eq(msg_uuid))
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Search messages within a conversation using FTS5.
#[specta]
#[tauri::command]
pub async fn search_messages(
    state: State<'_, Arc<AppState>>,
    req: SearchMessagesRequest,
) -> Result<Vec<SearchMessagesResult>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&req.conversation_id).map_err(|e| e.to_string())?;
    let limit = req.limit.unwrap_or(50).min(100) as i64;

    let sql = r#"
        SELECT m.id, snippet(messages_fts, 0, '<mark>', '</mark>', '…', 20) as snippet
        FROM messages_fts
        JOIN messages m ON m.id = messages_fts.message_id
        WHERE messages_fts.content MATCH ?
          AND m.conversation_id = ?
        ORDER BY rank
        LIMIT ?
    "#;

    let stmt = Statement::from_sql_and_values(
        DbBackend::Sqlite,
        sql,
        [req.query.into(), conv_uuid.into(), limit.into()],
    );

    let rows = db.query_all_raw(stmt).await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let message_id: String = row.try_get("", "id").map_err(|e| e.to_string())?;
        let snippet: String = row.try_get("", "snippet").map_err(|e| e.to_string())?;
        results.push(SearchMessagesResult {
            message_id,
            snippet,
        });
    }
    Ok(results)
}

/// Search all messages across conversations using FTS5.
#[specta]
#[tauri::command]
pub async fn search_all_messages(
    state: State<'_, Arc<AppState>>,
    req: GlobalSearchRequest,
) -> Result<Vec<GlobalSearchResult>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let limit = req.limit.unwrap_or(50).min(100) as i64;

    let sql = r#"
        SELECT m.id as message_id, m.conversation_id, m.created_at,
               c.title as conversation_title,
               snippet(messages_fts, 0, '<mark>', '</mark>', '…', 20) as message_snippet
        FROM messages_fts
        JOIN messages m ON m.id = messages_fts.message_id
        JOIN conversations c ON c.id = m.conversation_id
        WHERE messages_fts.content MATCH ?
        ORDER BY rank
        LIMIT ?
    "#;

    let stmt =
        Statement::from_sql_and_values(DbBackend::Sqlite, sql, [req.query.into(), limit.into()]);

    let rows = db.query_all_raw(stmt).await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let conversation_id: String = row
            .try_get("", "conversation_id")
            .map_err(|e| e.to_string())?;
        let conversation_title: Option<String> = row.try_get("", "conversation_title").ok();
        let message_id: String = row.try_get("", "message_id").map_err(|e| e.to_string())?;
        let snippet: String = row
            .try_get("", "message_snippet")
            .map_err(|e| e.to_string())?;
        let created_at: chrono::DateTime<chrono::FixedOffset> =
            row.try_get("", "created_at").map_err(|e| e.to_string())?;
        results.push(GlobalSearchResult {
            conversation_id,
            conversation_title,
            message_id,
            message_snippet: snippet,
            created_at: created_at.to_rfc3339(),
        });
    }
    Ok(results)
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
            req.context_items.clone(),
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
        req.branch_id,
        req.context_items,
        app,
        None,
        req.thinking.unwrap_or(false),
    )
    .await
    .map(|_| ())
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

#[specta]
#[tauri::command]
pub async fn mark_messages_seen(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    messages::Entity::update_many()
        .col_expr(messages::COLUMN.seen, Expr::value(true))
        .filter(messages::COLUMN.conversation_id.eq(conv_uuid))
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize, Type)]
pub struct SendMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub branch_id: Option<String>,
    pub context_items: Option<Vec<ContextItem>>,
    pub thinking: Option<bool>,
}

/// Get conversation bootstrap data (messages, branches, draft, queued, headings).
#[specta]
#[tauri::command]
pub async fn get_conversation_bootstrap(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<ConversationBootstrapData, String> {
    let messages = list_messages(state.clone(), conversation_id.clone(), None).await?;
    let branches =
        crate::commands::branches::list_branches(state.clone(), conversation_id.clone()).await?;
    let draft =
        crate::commands::drafts::get_conversation_draft(state.clone(), conversation_id.clone())
            .await?;
    let queued =
        crate::commands::queue::list_queued_messages(state.clone(), conversation_id.clone())
            .await?;
    let headings = get_conversation_messages_headings(state, conversation_id.clone()).await?;

    Ok(ConversationBootstrapData {
        messages,
        branches,
        draft,
        queued,
        headings,
    })
}

// =============================================================================
// Internal send function (returns the user message ID)
// =============================================================================

pub(crate) async fn send_message_internal(
    state: Arc<AppState>,
    conversation_id: String,
    content: String,
    branch_id: Option<String>,
    context_items: Option<Vec<ContextItem>>,
    app: tauri::AppHandle,
    metadata: Option<MessageMetadata>,
    thinking: bool,
) -> Result<Uuid, String> {
    // Validate IDs synchronously – no DB call
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let branch_uuid = branch_id
        .as_ref()
        .map(|id| Uuid::parse_str(id))
        .transpose()
        .map_err(|e| e.to_string())?;
    let msg_id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    // Emit Started FIRST – UI can enter streaming mode immediately
    let _ = app.emit(
        "agent-event",
        AgentEvent::Started {
            conversation_id: conversation_id.clone(),
        },
    );

    // Reset thinking panel before starting
    let _ = app.emit(
        "agent-event",
        AgentEvent::ThinkingDone {
            conversation_id: conversation_id.clone(),
            document: NodeDocument {
                stable_nodes: vec![],
                draft_nodes: vec![],
                toc_items: vec![],
                artifact_specs: vec![],
            },
        },
    );

    // Spawn the heavy work (DB insert + agent loop)
    let state_clone = state.clone();
    let app_clone = app.clone();
    let conversation_id_clone = conversation_id.clone();
    let content_clone = content.clone();
    let context_items_clone = context_items.clone();
    let metadata_clone = metadata;

    // Insert user message immediately (synchronously) so we can return its ID
    let db = match state.registry.db.connection().await {
        Ok(db) => db,
        Err(e) => {
            let _ = app.emit(
                "agent-event",
                AgentEvent::Error {
                    conversation_id: conversation_id.clone(),
                    message: format!("Database connection failed: {}", e),
                },
            );
            return Err(e.to_string());
        }
    };

    let context_items_model = context_items_clone
        .clone()
        .map(ContextItems)
        .unwrap_or_else(|| ContextItems(vec![]));

    let user_msg = messages::ActiveModel {
        id: Set(msg_id),
        conversation_id: Set(conv_uuid),
        branch_id: Set(branch_uuid),
        role: Set("user".to_string()),
        content: Set(content_clone.clone()),
        metadata: Set(metadata_clone),
        context_items: Set(Some(context_items_model)),
        created_at: Set(now),
        seen: Set(false),
        status: Set("active".to_string()),
        ..Default::default()
    };

    if let Err(e) = user_msg.insert(db).await {
        let _ = app.emit(
            "agent-event",
            AgentEvent::Error {
                conversation_id: conversation_id.clone(),
                message: format!("Failed to save user message: {}", e),
            },
        );
        return Err(e.to_string());
    }

    // Emit Persisted after the message is saved – triggers cache refresh
    let _ = app.emit(
        "agent-event",
        AgentEvent::Persisted {
            conversation_id: conversation_id_clone.clone(),
        },
    );

    // Finally start the agent loop (not async, no .await)
    tokio::spawn(async move {
        run_agent_loop(
            state_clone,
            conversation_id_clone,
            content_clone,
            branch_id,
            msg_id,
            context_items_clone,
            app_clone,
            thinking,
        );
    });

    Ok(msg_id)
}

// =============================================================================
// Assistant message persistence helper
// =============================================================================

/// Persist an assistant message with its node document, headings, and artifacts.
///
/// Used both on the success path (status = "active") and on error paths
/// (status = "incomplete") to avoid losing partial streamed content.
async fn persist_assistant_message(
    db: &DatabaseConnection,
    conv_uuid: Uuid,
    branch_uuid: Option<Uuid>,
    content: String,
    status: &str,
    input_tokens: i32,
    output_tokens: i32,
    cache_read_tokens: i32,
    cache_write_tokens: i32,
    doc: NodeDocument,
    thinking_content: Option<String>,
    thinking_document: Option<NodeDocument>,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<Uuid, String> {
    if let Some(ref tc) = thinking_content {
        tracing::debug!(
            target: "agent::thinking",
            content_len = tc.len(),
            "Persisting thinking content"
        );
    }
    if let Some(ref td) = thinking_document {
        tracing::debug!(
            target: "agent::thinking",
            stable_nodes = td.stable_nodes.len(),
            draft_nodes = td.draft_nodes.len(),
            "Persisting thinking document"
        );
    }

    let msg_id = Uuid::new_v4();

    let thinking_doc_json = thinking_document.and_then(|td| serde_json::to_value(td).ok());

    // Insert the assistant message row
    let active = messages::ActiveModel {
        id: Set(msg_id),
        conversation_id: Set(conv_uuid),
        branch_id: Set(branch_uuid),
        role: Set("assistant".to_string()),
        content: Set(content),
        created_at: Set(now),
        context_items: Set(Some(ContextItems(vec![]))),
        seen: Set(false),
        status: Set(status.to_string()),
        input_tokens: Set(Some(input_tokens)),
        output_tokens: Set(Some(output_tokens)),
        cache_read_tokens: Set(Some(cache_read_tokens)),
        cache_write_tokens: Set(Some(cache_write_tokens)),
        thinking_content: Set(thinking_content),
        thinking_document: Set(thinking_doc_json),
        ..Default::default()
    };

    active.insert(db).await.map_err(|e| e.to_string())?;

    // Store node document as JSON
    let node_document_json = serde_json::to_string(&doc)
        .map_err(|e| format!("Failed to serialize node document: {}", e))?;

    messages::Entity::update_many()
        .col_expr(
            messages::Column::NodeDocument,
            Expr::value(node_document_json),
        )
        .filter(messages::Column::Id.eq(msg_id))
        .exec(db)
        .await
        .map_err(|e| format!("Failed to store node document: {}", e))?;

    // Store headings
    use skilldeck_models::message_headings::{
        ActiveModel as HeadingsActiveModel, HeadingsJson, TocItem as DbTocItem,
    };
    let db_toc: Vec<DbTocItem> = doc
        .toc_items
        .iter()
        .map(|t| DbTocItem {
            id: t.id.clone(),
            toc_index: t.toc_index,
            text: t.text.clone(),
            level: t.level,
        })
        .collect();
    let heading_record = HeadingsActiveModel {
        id: Set(Uuid::new_v4()),
        message_id: Set(msg_id),
        headings: Set(HeadingsJson(db_toc)),
        created_at: Set(now),
    };
    if let Err(e) = heading_record.insert(db).await {
        tracing::warn!("Failed to store headings for {}: {}", msg_id, e);
    }

    // Store artifacts
    for spec in &doc.artifact_specs {
        let (storage_path, db_content) = match store_artifact_content(&spec.raw_code).await {
            Ok(Some(path)) => (Some(path.to_string_lossy().to_string()), String::new()),
            Ok(None) => (None, spec.raw_code.clone()),
            Err(e) => {
                tracing::warn!("Artifact storage failed: {}", e);
                (None, spec.raw_code.clone())
            }
        };
        let logical_key = format!("code_{}_{}", spec.language, msg_id);
        let artifact = artifacts::ActiveModel {
            id: Set(spec.id),
            message_id: Set(msg_id),
            branch_id: Set(branch_uuid),
            parent_artifact_id: Set(None),
            logical_key: Set(Some(logical_key)),
            storage_path: Set(storage_path),
            r#type: Set("code".to_string()),
            name: Set(spec.language.clone()),
            content: Set(db_content),
            language: Set(Some(spec.language.clone())),
            metadata: Set(None),
            created_at: Set(now),
        };
        if let Err(e) = artifact.insert(db).await {
            tracing::warn!("Failed to insert artifact {}: {}", spec.id, e);
        }
    }

    Ok(msg_id)
}

// =============================================================================
// Agent loop runner
// =============================================================================

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
        tracing::info!(
            target: "agent::provider",
            provider_id = %profile.model_provider,
            model_id = %profile.model_id,
            conversation_id = %conversation_id,
            "Resolved provider and model"
        );
        (profile.model_provider, profile.model_id)
    } else {
        panic!(
            "Provider '{}' not registered (no API key?)",
            profile.model_provider,
        );
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
#[allow(unused_variables)]
fn run_agent_loop(
    state: Arc<AppState>,
    conversation_id: String,
    user_message: String,
    branch_id: Option<String>,
    current_msg_id: Uuid,
    context_items: Option<Vec<ContextItem>>,
    app: tauri::AppHandle,
    thinking: bool,
) {
    use skilldeck_core::agent::tool_dispatcher::ToolDispatcher;
    use skilldeck_core::traits::ChatMessage;
    use tokio::sync::mpsc;

    tokio::spawn(async move {
        let (provider_id, model_id) = resolve_provider_and_model(&state, &conversation_id).await;

        let provider = match state.registry.get_provider(&provider_id) {
            Some(p) => p,
            None => {
                tracing::error!(
                    target: "agent::provider",
                    provider_id = %provider_id,
                    model_id = %model_id,
                    conversation_id = %conversation_id,
                    "Provider not registered — check API key and base URL"
                );
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
            conversation_id.clone(),
        ));

        // Set initial auto-approve config from global state
        let global_config = state.global_auto_approve.read().await.clone();
        dispatcher.set_auto_approve(global_config).await;

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
            .filter(messages::COLUMN.compacted.eq(false))
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

        // Filter history to include only messages from the current branch
        let branch_uuid = branch_id.as_ref().and_then(|id| Uuid::parse_str(id).ok());
        let history = history_rows
            .into_iter()
            .filter(|m| {
                if m.id == current_msg_id {
                    return false;
                }
                if let Some(branch_uuid) = branch_uuid {
                    m.branch_id == Some(branch_uuid)
                } else {
                    m.branch_id.is_none()
                }
            })
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

        let db_arc = state.registry.db.clone();

        let mut agent = AgentLoop::new(
            provider.clone(),
            model_id,
            AgentLoopConfig::default(),
            tx,
            db_arc,
        )
        .with_history(history)
        .with_dispatcher(dispatcher);

        // Store cancellation token in state
        let cancel_token = agent.cancellation_token();
        state
            .agent_cancel_tokens
            .insert(conversation_id.clone(), cancel_token);

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

        let all_skills = state.registry.skill_registry.skills().await;
        let skill_names: Vec<String> = all_skills.into_iter().map(|s| s.name).collect();
        tracing::info!("Skills in registry: {:?}", skill_names);

        let enriched_user_message = if let Some(items) = context_items {
            tracing::info!("Processing {} context items", items.len());
            let mut combined_context = String::new();

            for item in items {
                match item {
                    ContextItem::File { path, .. } => match std::fs::read_to_string(&path) {
                        Ok(content) => {
                            combined_context
                                .push_str(&format!("--- File: {} ---\n{}\n\n", path, content));
                        }
                        Err(_) => tracing::warn!("Could not read file: {}", path),
                    },
                    ContextItem::Folder { path, scope, .. } => {
                        let deep = matches!(scope, FolderScope::Deep);
                        match crate::skills::folder_assembler::assemble_folder_context(
                            std::path::Path::new(&path),
                            deep,
                            Some(500_000),
                        ) {
                            Ok((content, _)) => {
                                combined_context.push_str(&format!(
                                    "--- Folder: {} (scope: {:?}) ---\n{}\n\n",
                                    path, scope, content
                                ));
                            }
                            Err(e) => tracing::warn!("Could not assemble folder {}: {}", path, e),
                        }
                    }
                    ContextItem::Skill { name } => {
                        tracing::info!("Looking up skill: '{}'", name);
                        match state.registry.skill_registry.get_skill(&name).await {
                            Some(skill) => {
                                tracing::info!(
                                    "Found skill '{}', content length {}",
                                    name,
                                    skill.content_md.len()
                                );
                                combined_context.push_str(&format!(
                                    "--- Skill: {} ---\n{}\n\n",
                                    name, skill.content_md
                                ));
                            }
                            None => tracing::warn!(
                                "Skill '{}' not found in registry. Available: {:?}",
                                name,
                                state
                                    .registry
                                    .skill_registry
                                    .skills()
                                    .await
                                    .iter()
                                    .map(|s| s.name.as_str())
                                    .collect::<Vec<_>>()
                            ),
                        }
                    }
                }
            }

            if combined_context.is_empty() {
                tracing::warn!(
                    "Context items present but combined_context is empty after resolution"
                );
                user_message
            } else {
                tracing::info!(
                    "Injecting {} bytes of context into user turn",
                    combined_context.len()
                );
                format!(
                    "<context>\n{}</context>\n\n{}",
                    combined_context.trim_end(),
                    user_message
                )
            }
        } else {
            user_message
        };

        // ─── Create incremental streamer for this assistant response ───
        let mut streamer = IncrementalStream::new(Arc::clone(&state.markdown));
        let mut final_document: Option<NodeDocument> = None;

        // ─── Create incremental streamer for thinking (only if thinking mode is enabled) ───
        let mut thinking_streamer = if thinking {
            tracing::debug!(
                target: "agent::thinking",
                conversation_id = %conversation_id,
                "Thinking mode ENABLED for this turn"
            );
            Some(IncrementalStream::new(Arc::clone(&state.markdown)))
        } else {
            tracing::debug!(
                target: "agent::thinking",
                conversation_id = %conversation_id,
                "Thinking mode DISABLED for this turn"
            );
            None
        };
        let mut final_thinking_document: Option<NodeDocument> = None;

        // Track accumulated content for error recovery
        let mut accumulated_content = String::new();
        let mut saw_done = false;

        // Ordered event relay using std::sync::mpsc – runs in a dedicated thread
        let (emit_tx, emit_rx) = std::sync::mpsc::channel::<AgentEvent>();
        let app_emitter = app.clone();
        std::thread::spawn(move || {
            while let Ok(event) = emit_rx.recv() {
                let _ = app_emitter.emit("agent-event", event);
            }
        });

        let loop_handle =
            tokio::spawn(async move { agent.run(enriched_user_message, thinking).await });

        while let Some(event) = rx.recv().await {
            match event {
                Ok(AgentLoopEvent::ProviderNotReady { reason, fix_action }) => {
                    tracing::warn!(
                        target: "agent::provider",
                        reason = %reason,
                        fix_action = %fix_action,
                        conversation_id = %conversation_id,
                        "Provider not ready"
                    );
                    let _ = emit_tx.send(AgentEvent::Error {
                        conversation_id: conversation_id.clone(),
                        message: format!("{}\nSuggested fix: {}", reason, fix_action),
                    });
                }
                Ok(AgentLoopEvent::ThinkingToken { delta }) => {
                    tracing::debug!(
                        target: "agent::thinking",
                        conversation_id = %conversation_id,
                        delta_len = delta.len(),
                        "Received thinking token chunk"
                    );
                    if let Some(stream) = thinking_streamer.as_mut() {
                        if let Some(doc) = stream.push(&delta) {
                            tracing::debug!(
                                target: "agent::thinking",
                                conversation_id = %conversation_id,
                                stable_nodes = doc.stable_nodes.len(),
                                draft_nodes = doc.draft_nodes.len(),
                                "Thinking document updated"
                            );
                            let _ = emit_tx.send(AgentEvent::ThinkingStreamUpdate {
                                conversation_id: conversation_id.clone(),
                                document: doc,
                            });
                        }
                    } else {
                        tracing::warn!(
                            target: "agent::thinking",
                            conversation_id = %conversation_id,
                            "Received thinking token but thinking_streamer is None"
                        );
                    }
                }
                Ok(AgentLoopEvent::Token { delta }) => {
                    accumulated_content.push_str(&delta);

                    if let Some(doc) = streamer.push(&delta) {
                        let new_toc = streamer.drain_new_toc_items();
                        let new_artifacts = streamer.drain_new_artifact_specs();
                        let _ = emit_tx.send(AgentEvent::StreamUpdate {
                            conversation_id: conversation_id.clone(),
                            document: doc,
                            new_toc_items: new_toc,
                            new_artifact_specs: new_artifacts,
                        });
                    }
                }
                Ok(AgentLoopEvent::Cancelled) => {
                    tracing::debug!(
                        target: "agent::thinking",
                        conversation_id = %conversation_id,
                        "Agent cancelled, finalizing thinking stream if any"
                    );
                    let _ = emit_tx.send(AgentEvent::Cancelled {
                        conversation_id: conversation_id.clone(),
                    });
                    if let Some(stream) = thinking_streamer.take() {
                        let t_doc = stream.finalize();
                        tracing::debug!(
                            target: "agent::thinking",
                            conversation_id = %conversation_id,
                            stable_nodes = t_doc.stable_nodes.len(),
                            draft_nodes = t_doc.draft_nodes.len(),
                            "Thinking stream finalized (cancelled)"
                        );
                        let _ = emit_tx.send(AgentEvent::ThinkingDone {
                            conversation_id: conversation_id.clone(),
                            document: t_doc,
                        });
                    } else {
                        let _ = emit_tx.send(AgentEvent::ThinkingDone {
                            conversation_id: conversation_id.clone(),
                            document: NodeDocument {
                                stable_nodes: vec![],
                                draft_nodes: vec![],
                                toc_items: vec![],
                                artifact_specs: vec![],
                            },
                        });
                    }
                }
                Ok(AgentLoopEvent::ToolCall { tool_call }) => {
                    let _ = emit_tx.send(AgentEvent::ToolCall {
                        conversation_id: conversation_id.clone(),
                        tool_call: crate::events::AgentToolCall {
                            id: tool_call.id.clone(),
                            name: tool_call.function.name.clone(),
                            arguments: serde_json::from_str(&tool_call.function.arguments)
                                .unwrap_or_default(),
                        },
                    });
                }
                Ok(AgentLoopEvent::Done {
                    input_tokens,
                    output_tokens,
                    cache_read_tokens,
                    cache_write_tokens,
                }) => {
                    tracing::debug!(
                        target: "agent::thinking",
                        conversation_id = %conversation_id,
                        "Agent loop done, finalizing thinking stream"
                    );
                    saw_done = true;

                    let doc = streamer.finalize();
                    final_document = Some(doc.clone());

                    // Finalize thinking stream if it exists
                    if let Some(stream) = thinking_streamer.take() {
                        let t_doc = stream.finalize();
                        tracing::debug!(
                            target: "agent::thinking",
                            conversation_id = %conversation_id,
                            stable_nodes = t_doc.stable_nodes.len(),
                            draft_nodes = t_doc.draft_nodes.len(),
                            toc_items = t_doc.toc_items.len(),
                            "Thinking stream finalized"
                        );
                        final_thinking_document = Some(t_doc.clone());
                        let _ = emit_tx.send(AgentEvent::ThinkingDone {
                            conversation_id: conversation_id.clone(),
                            document: t_doc,
                        });
                    } else {
                        tracing::debug!(
                            target: "agent::thinking",
                            conversation_id = %conversation_id,
                            "No thinking stream to finalize (thinking mode off or already finalized)"
                        );
                        let _ = emit_tx.send(AgentEvent::ThinkingDone {
                            conversation_id: conversation_id.clone(),
                            document: NodeDocument {
                                stable_nodes: vec![],
                                draft_nodes: vec![],
                                toc_items: vec![],
                                artifact_specs: vec![],
                            },
                        });
                    }

                    let _ = emit_tx.send(AgentEvent::StreamUpdate {
                        conversation_id: conversation_id.clone(),
                        document: doc.clone(),
                        new_toc_items: doc.toc_items.clone(),
                        new_artifact_specs: doc.artifact_specs.clone(),
                    });
                    let _ = emit_tx.send(AgentEvent::Done {
                        conversation_id: conversation_id.clone(),
                        input_tokens,
                        output_tokens,
                    });

                    break;
                }
                Err(e) => {
                    tracing::error!(
                        target: "agent::loop",
                        error = ?e,
                        conversation_id = %conversation_id,
                        accumulated_tokens = accumulated_content.len(),
                        "Agent loop stream error"
                    );

                    let _ = emit_tx.send(AgentEvent::Error {
                        conversation_id: conversation_id.clone(),
                        message: e.to_string(),
                    });
                }
            }
        }

        drop(emit_tx);
        let loop_result = loop_handle.await;
        state.agent_cancel_tokens.remove(&conversation_id);

        // Prepare thinking content and document for the last assistant message
        let (result, thinking_content_str) = match loop_result {
            Ok(Ok(res)) => {
                let thinking = res.thinking_content.clone();
                (Ok(res), Some(thinking))
            }
            Ok(Err(e)) => (Err(e), None),
            Err(e) => (
                Err(CoreError::Internal {
                    message: format!("Task join error: {}", e),
                }),
                None,
            ),
        };

        let thinking_content_to_save = thinking_content_str
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        match result {
            Ok(result) => {
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
                let messages_len = result.messages.len();

                for (i, msg) in result.messages.into_iter().enumerate() {
                    let role_str = match msg.role {
                        skilldeck_core::traits::MessageRole::User => "user",
                        skilldeck_core::traits::MessageRole::Assistant => "assistant",
                        skilldeck_core::traits::MessageRole::Tool => "tool",
                        skilldeck_core::traits::MessageRole::System => "system",
                    };

                    if role_str == "assistant" {
                        let doc = if let Some(fp) = &final_document {
                            fp.clone()
                        } else {
                            state.markdown.render_final(&msg.content)
                        };

                        let is_last = i == messages_len - 1;
                        let input_tokens = if is_last {
                            result.input_tokens as i32
                        } else {
                            0
                        };
                        let output_tokens = if is_last {
                            result.output_tokens as i32
                        } else {
                            0
                        };
                        let cache_read_tokens = if is_last {
                            result.cache_read_tokens as i32
                        } else {
                            0
                        };
                        let cache_write_tokens = if is_last {
                            result.cache_write_tokens as i32
                        } else {
                            0
                        };

                        let thinking_content_arg = if is_last {
                            thinking_content_to_save.clone()
                        } else {
                            None
                        };
                        let thinking_doc_arg = if is_last {
                            final_thinking_document.clone()
                        } else {
                            None
                        };

                        if let Err(e) = persist_assistant_message(
                            db,
                            conv_uuid,
                            branch_uuid,
                            msg.content,
                            "active",
                            input_tokens,
                            output_tokens,
                            cache_read_tokens,
                            cache_write_tokens,
                            doc,
                            thinking_content_arg,
                            thinking_doc_arg,
                            now,
                        )
                        .await
                        {
                            tracing::warn!("Failed to persist assistant message: {}", e);
                            let _ = app.emit(
                                "agent-event",
                                AgentEvent::Error {
                                    conversation_id: conversation_id.clone(),
                                    message: format!("Failed to persist assistant message: {}", e),
                                },
                            );
                        }
                    } else {
                        // Non-assistant messages (user, tool, system): insert inline
                        let msg_id = Uuid::new_v4();
                        let mut active = messages::ActiveModel {
                            id: Set(msg_id),
                            conversation_id: Set(conv_uuid),
                            branch_id: Set(branch_uuid),
                            role: Set(role_str.to_string()),
                            content: Set(msg.content.clone()),
                            created_at: Set(now),
                            context_items: Set(Some(ContextItems(vec![]))),
                            seen: Set(false),
                            status: Set("active".to_string()),
                            ..Default::default()
                        };

                        if role_str == "tool" {
                            let meta = MessageMetadata {
                                tool_name: msg.name.clone(),
                                tool_call_id: None,
                                ..Default::default()
                            };
                            active.metadata = Set(Some(meta));
                        }

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
            Err(e) => {
                tracing::error!(
                    target: "agent::loop",
                    error = ?e,
                    conversation_id = %conversation_id,
                    accumulated_tokens = accumulated_content.len(),
                    saw_done = saw_done,
                    "Agent loop returned error after completion"
                );

                let _ = app.emit(
                    "agent-event",
                    AgentEvent::Error {
                        conversation_id: conversation_id.clone(),
                        message: e.to_string(),
                    },
                );

                if saw_done {
                    tracing::warn!(
                        "Agent loop returned error after Done event for conversation {}",
                        conversation_id
                    );
                }

                if !accumulated_content.is_empty() {
                    if let Ok(db) = state.registry.db.connection().await {
                        let doc = state.markdown.render_final(&accumulated_content);
                        // For incomplete messages, we don't have thinking content, but we may have a final thinking document
                        let incomplete_thinking_doc = if let Some(stream) = thinking_streamer.take()
                        {
                            let t_doc = stream.finalize();
                            tracing::debug!(
                                target: "agent::thinking",
                                conversation_id = %conversation_id,
                                stable_nodes = t_doc.stable_nodes.len(),
                                draft_nodes = t_doc.draft_nodes.len(),
                                "Finalized incomplete thinking document in error path"
                            );
                            Some(t_doc)
                        } else {
                            final_thinking_document.clone()
                        };

                        match persist_assistant_message(
                            db,
                            conv_uuid,
                            branch_uuid,
                            accumulated_content,
                            "incomplete",
                            0,
                            0,
                            0,
                            0,
                            doc,
                            None, // no thinking content for incomplete message
                            incomplete_thinking_doc,
                            chrono::Utc::now().fixed_offset(),
                        )
                        .await
                        {
                            Ok(_) => {
                                let _ = app.emit(
                                    "agent-event",
                                    AgentEvent::Persisted {
                                        conversation_id: conversation_id.clone(),
                                    },
                                );
                            }
                            Err(persist_err) => {
                                tracing::warn!(
                                    "Failed to persist incomplete message: {}",
                                    persist_err
                                );
                            }
                        }
                    }
                }
            }
        }
    });
}

#[specta]
#[tauri::command]
pub async fn compact_conversation(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    // Fetch all messages for the conversation
    let messages = Messages::find()
        .filter(messages::Column::ConversationId.eq(conv_uuid))
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    if messages.len() < 10 {
        return Err("Conversation too short to compact".to_string());
    }

    // Split point: keep last 30% of messages
    let split_point = (messages.len() as f64 * 0.7) as usize;
    let old_messages = &messages[..split_point];
    let _keep_messages = &messages[split_point..];

    // Build summary prompt from old messages
    let mut summary_content = String::new();
    for msg in old_messages {
        summary_content.push_str(&format!("{}: {}\n", msg.role, msg.content));
    }

    let summary_prompt = format!(
        "Summarize the following conversation concisely, preserving key decisions, code changes, and important context:\n\n{}",
        summary_content
    );

    // Get provider and model for the conversation
    let conv = Conversations::find_by_id(conv_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Conversation {} not found", conversation_id))?;

    let profile = skilldeck_models::profiles::Entity::find_by_id(conv.profile_id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {} not found", conv.profile_id))?;

    let provider = state
        .registry
        .get_provider(&profile.model_provider)
        .ok_or_else(|| format!("Provider {} not available", profile.model_provider))?;

    // Run a simple completion to get summary
    use skilldeck_core::traits::{ChatMessage, CompletionRequest, MessageRole, ModelParams};
    let request = CompletionRequest {
        messages: vec![ChatMessage {
            role: MessageRole::User,
            content: summary_prompt,
            name: None,
        }],
        system: None,
        tools: vec![],
        tools_toon: None,
        model_params: ModelParams::default(),
        model_id: profile.model_id,
        thinking: false,
    };

    let stream = provider
        .complete(request)
        .await
        .map_err(|e| e.to_string())?;
    use futures::StreamExt;
    let chunks: Vec<_> = stream.collect().await;
    let mut summary = String::new();
    for chunk in chunks {
        if let Ok(skilldeck_core::traits::CompletionChunk::Token { content }) = chunk {
            summary.push_str(&content);
        }
    }

    if summary.is_empty() {
        return Err("Failed to generate summary".to_string());
    }

    // --- FLAG OLD MESSAGES AS COMPACTED (INSTEAD OF DELETING) ---
    use sea_orm::sea_query::Expr;
    messages::Entity::update_many()
        .col_expr(messages::Column::Compacted, Expr::value(true))
        .filter(messages::Column::Id.is_in(old_messages.iter().map(|m| m.id)))
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;

    // Render summary as markdown document
    let node_document = {
        let doc = state.markdown.render_final(&summary);
        serde_json::to_value(doc).map_err(|e| e.to_string())?
    };

    // Insert summary as a system message at the beginning
    let now = chrono::Utc::now().fixed_offset();
    let summary_msg = messages::ActiveModel {
        id: Set(Uuid::new_v4()),
        conversation_id: Set(conv_uuid),
        branch_id: Set(None),
        role: Set("system".to_string()),
        content: Set(format!(
            "[Compacted summary of previous conversation]\n{}",
            summary
        )),
        node_document: Set(Some(node_document)),
        created_at: Set(now),
        context_items: Set(Some(ContextItems(vec![]))),
        seen: Set(false),
        status: Set("active".to_string()),
        ..Default::default()
    };
    summary_msg.insert(db).await.map_err(|e| e.to_string())?;

    // Update conversation updated_at
    let mut conv_active: conversations::ActiveModel = conv.into();
    conv_active.updated_at = Set(now);
    conv_active.update(db).await.map_err(|e| e.to_string())?;

    Ok(summary)
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
