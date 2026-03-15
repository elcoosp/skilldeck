// File: skilldeck-core/src/agent/loop.rs
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
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, instrument, warn};

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
}

impl AgentLoop {
    pub fn new(
        provider: Arc<dyn ModelProvider>,
        model_id: String,
        config: AgentLoopConfig,
        tx: mpsc::Sender<Result<AgentLoopEvent, CoreError>>,
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
    pub async fn run(mut self, user_message: String) -> Result<Vec<ChatMessage>, CoreError> {
        info!("Agent loop starting");

        self.messages.push(ChatMessage {
            role: MessageRole::User,
            content: user_message,
            name: None,
        });

        let after_user_len = self.messages.len();
        let mut iteration = 0u32;

        loop {
            // Check cancellation at the top of each iteration.
            if self.cancel_token.is_cancelled() {
                info!("Agent loop cancelled");
                let _ = self.tx.send(Ok(AgentLoopEvent::Cancelled)).await;
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

            let request = self.build_request()?;

            let stream = tokio::select! {
                res = self.provider.complete(request) => res?,
                _ = self.cancel_token.cancelled() => {
                    info!("Agent loop cancelled during provider call");
                    let _ = self.tx.send(Ok(AgentLoopEvent::Cancelled)).await;
                    return Err(CoreError::Cancelled { operation: "agent-loop:complete".into() });
                }
            };

            let result = tokio::select! {
                res = self.process_stream(stream) => res?,
                _ = self.cancel_token.cancelled() => {
                    info!("Agent loop cancelled during stream processing");
                    let _ = self.tx.send(Ok(AgentLoopEvent::Cancelled)).await;
                    return Err(CoreError::Cancelled { operation: "agent-loop:stream".into() });
                }
            };

            self.messages.push(ChatMessage {
                role: MessageRole::Assistant,
                content: result.content.clone(),
                name: None,
            });

            if result.tool_calls.is_empty() {
                let _ = self
                    .tx
                    .send(Ok(AgentLoopEvent::Done {
                        input_tokens: result.input_tokens,
                        output_tokens: result.output_tokens,
                        cache_read_tokens: result.cache_read_tokens,
                        cache_write_tokens: result.cache_write_tokens,
                    }))
                    .await;
                break;
            }

            for tool_call in result.tool_calls {
                if self.cancel_token.is_cancelled() {
                    let _ = self.tx.send(Ok(AgentLoopEvent::Cancelled)).await;
                    return Err(CoreError::Cancelled {
                        operation: "agent-loop:tool".into(),
                    });
                }

                // FIX 2: Give the compiler an explicit type for the clone so it
                // can resolve the ToolCall variant without ambiguity (E0282).
                let tool_call_clone: ToolCall = tool_call.clone();
                let _ = self
                    .tx
                    .send(Ok(AgentLoopEvent::ToolCall {
                        tool_call: tool_call_clone,
                    }))
                    .await;

                let tool_result = self.execute_tool(&tool_call).await;
                let content = match tool_result {
                    Ok(v) => serde_json::to_string(&v).unwrap_or_default(),
                    Err(e) => {
                        error!("Tool execution error: {}", e);
                        format!("{{\"error\":\"{}\"}}", e)
                    }
                };

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
                                    // Decode the Toon back to the original markdown
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
                                            load_result.content // fallback to raw string
                                        }
                                    }
                                }
                                SkillContentFormat::Text => load_result.content,
                            };
                            self.skills.push(final_content);
                            tracing::info!("Dynamically loaded skill '{}'", load_result.loaded);
                        }
                        Err(e) => {
                            tracing::error!("Failed to parse loadSkill result: {}", e);
                        }
                    }
                }
            }
        }

        info!("Agent loop completed after {} iteration(s)", iteration);
        let new_messages = self.messages[after_user_len..].to_vec();
        Ok(new_messages)
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

        // Encode tools as Toon if supported
        let tools_toon = if self.supports_toon && !self.tools.is_empty() {
            // Convert tools to a JSON array
            let tools_json =
                serde_json::to_value(&self.tools).map_err(|e| CoreError::Internal {
                    message: format!("Failed to serialize tools: {}", e),
                })?;

            match toon_rust::encode(&tools_json, Some(&toon_rust::EncodeOptions::default())) {
                Ok(encoded) => Some(encoded),
                Err(e) => {
                    tracing::error!("Failed to encode tools as Toon: {}", e);
                    None // fall back to regular tools
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
            match chunk? {
                CompletionChunk::Token { content: token } => {
                    content.push_str(&token);
                    buffer.push_str(&token);

                    if last_emit.elapsed() >= debounce || buffer.len() > 100 {
                        let _ = self
                            .tx
                            .send(Ok(AgentLoopEvent::Token {
                                delta: buffer.clone(),
                            }))
                            .await;
                        buffer.clear();
                        last_emit = Instant::now();
                    }
                }
                CompletionChunk::ToolCall { tool_call } => {
                    if !buffer.is_empty() {
                        let _ = self
                            .tx
                            .send(Ok(AgentLoopEvent::Token {
                                delta: buffer.clone(),
                            }))
                            .await;
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
                    input_tokens = it;
                    output_tokens = ot;
                    cache_read_tokens = crt;
                    cache_write_tokens = cwt;
                }
            }
        }

        if !buffer.is_empty() {
            let _ = self
                .tx
                .send(Ok(AgentLoopEvent::Token { delta: buffer }))
                .await;
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
        let agent = AgentLoop::new(provider, "test".into(), AgentLoopConfig::default(), tx);
        let child = agent.cancellation_token();
        agent.cancel();
        assert!(child.is_cancelled());
    }
}
