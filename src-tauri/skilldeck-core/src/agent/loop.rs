//! Core agent loop implementation.
//!
//! 1. Receive user message
//! 2. Build context (history + skills + system prompt)
//! 3. Call model provider (streaming)
//! 4. Debounce token emission (50 ms / 100-char buffer)
//! 5. Handle tool calls via ToolDispatcher
//! 6. Repeat until no tool calls or cancellation

use futures::StreamExt;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{Instant, timeout};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, instrument, warn};

use crate::{
    CoreError,
    agent::load_skill_result::{LoadSkillResult, SkillContentFormat},
    agent::tool_dispatcher::ToolDispatcher,
    traits::{
        ChatMessage, CompletionChunk, CompletionRequest, MessageRole, ModelParams, ModelProvider,
        ToolCall, ToolDefinition,
    },
};

// ── Internal event type (loop → caller) ──────────────────────────────────────

#[derive(Debug, Clone)]
pub enum AgentLoopEvent {
    Token {
        delta: String,
    },
    ToolCall {
        tool_call: ToolCall,
    },
    Done {
        input_tokens: u32,
        output_tokens: u32,
        cache_read_tokens: u32,
        cache_write_tokens: u32,
    },
    Cancelled,
}

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct AgentLoopConfig {
    pub debounce_ms: u64,
    pub max_context_messages: usize,
    pub max_tool_iterations: u32,
}

impl Default for AgentLoopConfig {
    fn default() -> Self {
        Self {
            debounce_ms: 50,
            max_context_messages: 100,
            max_tool_iterations: 10,
        }
    }
}

// ── AgentLoop ─────────────────────────────────────────────────────────────────

pub struct AgentLoop {
    config: AgentLoopConfig,
    provider: Arc<dyn ModelProvider>,
    model_id: String,
    system_prompt: Option<String>,
    messages: Vec<ChatMessage>,
    skills: Vec<String>,
    tools: Vec<ToolDefinition>,
    dispatcher: Option<Arc<ToolDispatcher>>,
    tx: mpsc::Sender<Result<AgentLoopEvent, CoreError>>,
    /// Cancellation token — set by `cancel()` or passed in from outside.
    cancel_token: CancellationToken,
    /// Whether the model supports Toon encoding.
    supports_toon: bool,
    /// Database connection (for persisting cancellation status)
    db: Arc<dyn crate::traits::Database>,
}

/// Result returned by the agent loop, containing new messages and token usage.
#[derive(Debug, Clone)]
pub struct AgentRunResult {
    pub messages: Vec<ChatMessage>,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_read_tokens: u32,
    pub cache_write_tokens: u32,
}

// Helper macro to send events and abort on receiver drop.
macro_rules! send_event {
    ($self:expr, $event:expr) => {{
        if $self.tx.send(Ok($event)).await.is_err() {
            return Err(CoreError::Cancelled {
                operation: "agent-loop:receiver-dropped".into(),
            });
        }
    }};
}

impl AgentLoop {
    pub fn new(
        provider: Arc<dyn ModelProvider>,
        model_id: String,
        config: AgentLoopConfig,
        tx: mpsc::Sender<Result<AgentLoopEvent, CoreError>>,
        db: Arc<dyn crate::traits::Database>,
    ) -> Self {
        let supports_toon = provider.supports_toon();
        Self {
            config,
            provider,
            model_id,
            system_prompt: None,
            messages: Vec::new(),
            skills: Vec::new(),
            tools: Vec::new(),
            dispatcher: None,
            tx,
            cancel_token: CancellationToken::new(),
            supports_toon,
            db,
        }
    }

    pub fn with_system_prompt(mut self, prompt: String) -> Self {
        self.system_prompt = Some(prompt);
        self
    }

    pub fn with_skill(mut self, skill_content: String) -> Self {
        self.skills.push(skill_content);
        self
    }

    pub fn with_tool(mut self, tool: ToolDefinition) -> Self {
        self.tools.push(tool);
        self
    }

    pub fn with_history(mut self, messages: Vec<ChatMessage>) -> Self {
        self.messages = messages;
        self
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<ToolDispatcher>) -> Self {
        self.dispatcher = Some(dispatcher);
        self
    }

    /// Wire an external cancellation token so the parent can cancel this loop.
    pub fn with_cancel_token(mut self, token: CancellationToken) -> Self {
        self.cancel_token = token;
        self
    }

    /// Return a child token that the caller can use to cancel this loop.
    pub fn cancellation_token(&self) -> CancellationToken {
        self.cancel_token.child_token()
    }

    /// Cancel the running loop.  Safe to call from any thread / task.
    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }

    /// Run the agent loop for a single user turn.
    #[instrument(skip(self), fields(model = %self.model_id))]
    pub async fn run(mut self, user_message: String) -> Result<AgentRunResult, CoreError> {
        info!("Agent loop starting");

        self.messages.push(ChatMessage {
            role: MessageRole::User,
            content: user_message,
            name: None,
        });

        let after_user_len = self.messages.len();
        let mut iteration = 0u32;

        // Accumulate final token usage
        let mut final_input_tokens = 0;
        let mut final_output_tokens = 0;
        let mut final_cache_read_tokens = 0;
        let mut final_cache_write_tokens = 0;

        loop {
            // Check cancellation at the top of each iteration.
            if self.cancel_token.is_cancelled() {
                info!("Agent loop cancelled");
                send_event!(self, AgentLoopEvent::Cancelled);

                // Mark the last assistant message as cancelled in DB.
                if let Some(last_assistant) = self
                    .messages
                    .iter()
                    .rev()
                    .find(|m| m.role == MessageRole::Assistant)
                {
                    let conn = self.db.connection().await?;
                    use sea_orm::{EntityTrait, QueryFilter};
                    use skilldeck_models::messages::{self, Entity as Messages};
                    Messages::update_many()
                        .col_expr(messages::COLUMN.status, "cancelled".into())
                        .filter(messages::COLUMN.content.eq(&last_assistant.content))
                        .exec(conn)
                        .await?;
                }

                return Err(CoreError::Cancelled {
                    operation: "agent-loop".into(),
                });
            }

            iteration += 1;
            if iteration > self.config.max_tool_iterations {
                warn!(
                    "Max tool iterations ({}) reached",
                    self.config.max_tool_iterations
                );
                break;
            }

            info!("Agent iteration {} starting", iteration);
            let request = self.build_request()?;

            // === DIAGNOSTIC: log the entire request (especially tool messages) ===
            debug!(
                "Sending request to provider:\n  model: {}\n  system: {:?}\n  messages: {:#?}\n  tools (raw): {}",
                request.model_id,
                request.system,
                request.messages,
                request.tools.len()
            );
            // If there are tool messages, log them in detail
            for msg in &request.messages {
                if msg.role == MessageRole::Tool {
                    debug!(
                        "Tool message: name={:?}, content={:?}",
                        msg.name, msg.content
                    );
                }
            }

            let stream = tokio::select! {
                res = self.provider.complete(request) => res?,
                _ = self.cancel_token.cancelled() => {
                    info!("Agent loop cancelled during provider call");
                    send_event!(self, AgentLoopEvent::Cancelled);
                    return Err(CoreError::Cancelled { operation: "agent-loop:complete".into() });
                }
            };

            let result = tokio::select! {
                res = self.process_stream(stream) => res?,
                _ = self.cancel_token.cancelled() => {
                    info!("Agent loop cancelled during stream processing");
                    send_event!(self, AgentLoopEvent::Cancelled);
                    return Err(CoreError::Cancelled { operation: "agent-loop:stream".into() });
                }
            };

            self.messages.push(ChatMessage {
                role: MessageRole::Assistant,
                content: result.content.clone(),
                name: None,
            });

            // Update final token counts from this iteration
            final_input_tokens += result.input_tokens;
            final_output_tokens += result.output_tokens;
            final_cache_read_tokens += result.cache_read_tokens;
            final_cache_write_tokens += result.cache_write_tokens;

            info!(
                "Iteration {}: content length={}, tool_calls={}, tokens (in/out/cacheR/cacheW) = {}/{}/{}/{}",
                iteration,
                result.content.len(),
                result.tool_calls.len(),
                result.input_tokens,
                result.output_tokens,
                result.cache_read_tokens,
                result.cache_write_tokens
            );

            if result.tool_calls.is_empty() {
                send_event!(
                    self,
                    AgentLoopEvent::Done {
                        input_tokens: result.input_tokens,
                        output_tokens: result.output_tokens,
                        cache_read_tokens: result.cache_read_tokens,
                        cache_write_tokens: result.cache_write_tokens,
                    }
                );
                break;
            }

            for tool_call in result.tool_calls {
                if self.cancel_token.is_cancelled() {
                    send_event!(self, AgentLoopEvent::Cancelled);
                    return Err(CoreError::Cancelled {
                        operation: "agent-loop:tool".into(),
                    });
                }

                let tool_call_clone: ToolCall = tool_call.clone();
                send_event!(
                    self,
                    AgentLoopEvent::ToolCall {
                        tool_call: tool_call_clone,
                    }
                );

                info!("Executing tool: {:?}", tool_call);
                // Wrap the tool execution in a 30-second timeout to prevent hangs
                let tool_result = timeout(Duration::from_secs(30), self.execute_tool(&tool_call))
                    .await
                    .map_err(|_| {
                        error!("Tool '{}' timed out after 30s", tool_call.function.name);
                        CoreError::Internal {
                            message: format!("Tool '{}' timed out", tool_call.function.name),
                        }
                    })
                    .and_then(|res| res); // flatten the Result<Result<_, _>, _>

                let content = match tool_result {
                    Ok(v) => {
                        let json = serde_json::to_string(&v).unwrap_or_default();
                        debug!("Tool result: {}", json);
                        json
                    }
                    Err(e) => {
                        error!("Tool execution error: {}", e);
                        format!("{{\"error\":\"{}\"}}", e)
                    }
                };

                // Diagnostic: log the tool call ID (if present) to help debug missing tool_call_id.
                debug!(
                    "Tool call id: {:?}, but ChatMessage does not store it yet. The provider may reject this message.",
                    tool_call.id
                );

                self.messages.push(ChatMessage {
                    role: MessageRole::Tool,
                    content: content.clone(),
                    name: Some(tool_call.function.name.clone()),
                });

                // Handle loadSkill result
                if tool_call.function.name == "loadSkill" {
                    match serde_json::from_str::<LoadSkillResult>(&content) {
                        Ok(load_result) => {
                            let final_content = match load_result.format {
                                SkillContentFormat::Toon => {
                                    match toon_rust::decode(&load_result.content, None) {
                                        Ok(value) => value
                                            .as_str()
                                            .unwrap_or(&load_result.content)
                                            .to_string(),
                                        Err(e) => {
                                            tracing::error!(
                                                "Failed to decode Toon skill content: {}",
                                                e
                                            );
                                            load_result.content
                                        }
                                    }
                                }
                                SkillContentFormat::Text => load_result.content,
                            };
                            self.skills.push(final_content);
                            info!("Dynamically loaded skill '{}'", load_result.loaded);
                        }
                        Err(e) => {
                            error!("Failed to parse loadSkill result: {}", e);
                        }
                    }
                }
            }
        }

        info!("Agent loop completed after {} iteration(s)", iteration);
        let new_messages = self.messages[after_user_len..].to_vec();
        Ok(AgentRunResult {
            messages: new_messages,
            input_tokens: final_input_tokens,
            output_tokens: final_output_tokens,
            cache_read_tokens: final_cache_read_tokens,
            cache_write_tokens: final_cache_write_tokens,
        })
    }

    fn build_request(&self) -> Result<CompletionRequest, CoreError> {
        let mut system_parts = Vec::new();
        if let Some(ref p) = self.system_prompt {
            system_parts.push(p.clone());
        }
        for skill in &self.skills {
            system_parts.push(skill.clone());
        }

        let system = if system_parts.is_empty() {
            None
        } else {
            Some(system_parts.join("\n\n---\n\n"))
        };

        let messages = if self.messages.len() > self.config.max_context_messages {
            let skip = self.messages.len() - self.config.max_context_messages;
            self.messages[skip..].to_vec()
        } else {
            self.messages.clone()
        };

        let tools_toon = if self.supports_toon && !self.tools.is_empty() {
            let tools_json =
                serde_json::to_value(&self.tools).map_err(|e| CoreError::Internal {
                    message: format!("Failed to serialize tools: {}", e),
                })?;

            match toon_rust::encode(&tools_json, Some(&toon_rust::EncodeOptions::default())) {
                Ok(encoded) => Some(encoded),
                Err(e) => {
                    tracing::error!("Failed to encode tools as Toon: {}", e);
                    None
                }
            }
        } else {
            None
        };

        Ok(CompletionRequest {
            messages,
            system,
            tools: if tools_toon.is_some() {
                vec![]
            } else {
                self.tools.clone()
            },
            tools_toon,
            model_params: ModelParams::default(),
            model_id: self.model_id.clone(),
        })
    }

    async fn process_stream(
        &self,
        mut stream: crate::traits::CompletionStream,
    ) -> Result<StreamResult, CoreError> {
        let mut content = String::new();
        let mut tool_calls: Vec<ToolCall> = Vec::new();
        let mut input_tokens = 0u32;
        let mut output_tokens = 0u32;
        let mut cache_read_tokens = 0u32;
        let mut cache_write_tokens = 0u32;

        let mut buffer = String::new();
        let debounce = Duration::from_millis(self.config.debounce_ms);
        let mut last_emit = Instant::now();

        while let Some(chunk) = stream.next().await {
            if self.cancel_token.is_cancelled() {
                return Err(CoreError::Cancelled {
                    operation: "stream".into(),
                });
            }
            match chunk? {
                CompletionChunk::Token { content: token } => {
                    debug!("Token chunk: {:?}", token);
                    content.push_str(&token);
                    buffer.push_str(&token);

                    if last_emit.elapsed() >= debounce || buffer.len() > 100 {
                        debug!("Flushing buffer (size={})", buffer.len());
                        send_event!(
                            self,
                            AgentLoopEvent::Token {
                                delta: buffer.clone(),
                            }
                        );
                        buffer.clear();
                        last_emit = Instant::now();
                    }
                }
                CompletionChunk::ToolCall { tool_call } => {
                    debug!("Tool call chunk: {:?}", tool_call);
                    if !buffer.is_empty() {
                        debug!("Flushing buffer before tool call");
                        send_event!(
                            self,
                            AgentLoopEvent::Token {
                                delta: buffer.clone(),
                            }
                        );
                        buffer.clear();
                    }
                    tool_calls.push(tool_call);
                }
                CompletionChunk::Done {
                    input_tokens: it,
                    output_tokens: ot,
                    cache_read_tokens: crt,
                    cache_write_tokens: cwt,
                } => {
                    // Flush any remaining buffered tokens before processing Done
                    if !buffer.is_empty() {
                        debug!("Flushing buffer on Done (size={})", buffer.len());
                        send_event!(
                            self,
                            AgentLoopEvent::Token {
                                delta: buffer.clone(),
                            }
                        );
                        buffer.clear();
                    }
                    debug!(
                        "Done chunk: in={}, out={}, cacheR={}, cacheW={}",
                        it, ot, crt, cwt
                    );
                    input_tokens = it;
                    output_tokens = ot;
                    cache_read_tokens = crt;
                    cache_write_tokens = cwt;
                }
            }
        }

        // Final flush in case the stream ended without a Done chunk
        if !buffer.is_empty() {
            debug!("Final flush after stream ended");
            send_event!(
                self,
                AgentLoopEvent::Token {
                    delta: buffer.clone(),
                }
            );
        }

        Ok(StreamResult {
            content,
            tool_calls,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens,
        })
    }

    async fn execute_tool(&self, tool_call: &ToolCall) -> Result<serde_json::Value, CoreError> {
        if let Some(dispatcher) = &self.dispatcher {
            dispatcher.dispatch(tool_call).await
        } else {
            Ok(serde_json::json!({"error": "No tool dispatcher configured"}))
        }
    }
}

struct StreamResult {
    content: String,
    tool_calls: Vec<ToolCall>,
    input_tokens: u32,
    output_tokens: u32,
    cache_read_tokens: u32,
    cache_write_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_default() {
        let c = AgentLoopConfig::default();
        assert_eq!(c.debounce_ms, 50);
        assert_eq!(c.max_context_messages, 100);
        assert_eq!(c.max_tool_iterations, 10);
    }

    #[test]
    fn agent_loop_event_is_clone() {
        let e = AgentLoopEvent::Token { delta: "hi".into() };
        let _ = e.clone();
    }

    #[test]
    fn cancellation_token_propagates() {
        let (tx, _rx) = mpsc::channel(1);
        let provider: Arc<dyn ModelProvider> =
            Arc::new(crate::providers::OllamaProvider::new(11434));
        let db = Arc::new(crate::db::SqliteDatabase::open(":memory:").await.unwrap());
        let agent = AgentLoop::new(provider, "test".into(), AgentLoopConfig::default(), tx, db);
        let child = agent.cancellation_token();
        agent.cancel();
        assert!(child.is_cancelled());
    }
}
