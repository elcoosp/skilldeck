// src-tauri/skilldeck-core/src/traits/model_provider.rs
//! Model Provider trait and related types.

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::pin::Pin;

use crate::CoreError;

pub type CompletionStream = Pin<Box<dyn Stream<Item = Result<CompletionChunk, CoreError>> + Send>>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatMessage {
    pub role: MessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageRole::System => write!(f, "system"),
            MessageRole::User => write!(f, "user"),
            MessageRole::Assistant => write!(f, "assistant"),
            MessageRole::Tool => write!(f, "tool"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(default = "default_tool_type")]
    pub r#type: String,
    pub function: FunctionCall,
}

fn default_tool_type() -> String {
    "function".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub stop: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub system: Option<String>,
    pub tools: Vec<ToolDefinition>,
    /// Toon‑encoded tool list (if `Some`, `tools` is ignored).
    pub tools_toon: Option<String>,
    pub model_params: ModelParams,
    pub model_id: String,
    /// Enable extended thinking mode (Claude only for now)
    pub thinking: bool, // <-- ADDED
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CompletionChunk {
    Token {
        content: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResult {
    pub content: String,
    pub tool_calls: Vec<ToolCall>,
    pub usage: TokenUsage,
    pub model: String,
    pub finish_reason: FinishReason,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_read_tokens: u32,
    pub cache_write_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    Stop,
    ToolCalls,
    Length,
    ContentFilter,
    Error,
}

/// Information about a specific model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_length: u32,
    pub max_output_tokens: u32,
    pub capabilities: ModelCapabilities,
}

/// Capabilities supported by a model.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelCapabilities {
    pub function_calling: bool,
    pub vision: bool,
    pub code_execution: bool,
    pub prompt_caching: bool,
}

// =============================================================================
// ProviderReadyStatus
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ProviderReadyStatus {
    Ready,
    NotReady { reason: String, fix_action: String },
}

#[async_trait]
pub trait ModelProvider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;

    /// Whether this provider supports Toon‑encoded tools and skill catalogs.
    fn supports_toon(&self) -> bool {
        true
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError>;

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError>;

    async fn complete_sync(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResult, CoreError> {
        use futures::StreamExt;

        let stream = self.complete(request).await?;
        let collected = stream.collect::<Vec<_>>().await;

        let mut content = String::new();
        let mut tool_calls = Vec::new();
        let mut usage = TokenUsage::default();

        for chunk in collected.into_iter().flatten() {
            match chunk {
                CompletionChunk::Token { content: token } => content.push_str(&token),
                CompletionChunk::ToolCall { tool_call } => tool_calls.push(tool_call),
                CompletionChunk::Done {
                    input_tokens,
                    output_tokens,
                    cache_read_tokens,
                    cache_write_tokens,
                } => {
                    usage = TokenUsage {
                        input_tokens,
                        output_tokens,
                        cache_read_tokens,
                        cache_write_tokens,
                    };
                }
            }
        }

        let finish_reason = if tool_calls.is_empty() {
            FinishReason::Stop
        } else {
            FinishReason::ToolCalls
        };

        Ok(CompletionResult {
            content,
            tool_calls,
            usage,
            model: String::new(),
            finish_reason,
        })
    }

    /// Check if the provider is ready to serve the given model.
    async fn is_ready(&self, _model_id: &str) -> ProviderReadyStatus {
        ProviderReadyStatus::Ready
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_chunk_token_round_trips() {
        let chunk = CompletionChunk::Token {
            content: "Hello".to_string(),
        };
        let json = serde_json::to_string(&chunk).unwrap();
        assert!(json.contains("token"));
        let decoded: CompletionChunk = serde_json::from_str(&json).unwrap();
        match decoded {
            CompletionChunk::Token { content } => assert_eq!(content, "Hello"),
            _ => panic!("Wrong variant"),
        }
    }
}
