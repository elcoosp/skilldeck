//! Model provider abstraction.

use async_trait::async_trait;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

use crate::CoreError;

/// A single chunk yielded during streaming completion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionChunk {
    /// Incremental text delta (may be empty for non-text events).
    pub delta: String,
    /// True when this is the final chunk in the stream.
    pub is_final: bool,
    /// Approximate input tokens consumed (populated on final chunk only).
    pub input_tokens: Option<u32>,
    /// Approximate output tokens generated (populated on final chunk only).
    pub output_tokens: Option<u32>,
}

/// A pinned async stream of completion chunks.
pub type CompletionStream =
    Pin<Box<dyn Stream<Item = Result<CompletionChunk, CoreError>> + Send + 'static>>;

/// A message in the conversation history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: MessageRole,
    pub content: String,
}

/// Role of a conversation participant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
}

/// Request payload sent to a model provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    /// The model identifier (e.g. `"claude-3-5-sonnet-20241022"`).
    pub model: String,
    /// System prompt injected before the conversation.
    pub system: Option<String>,
    /// Full conversation history.
    pub messages: Vec<ConversationMessage>,
    /// Maximum tokens to generate.
    pub max_tokens: u32,
    /// Sampling temperature (0.0–1.0).
    pub temperature: Option<f32>,
    /// Whether to stream the response.
    pub stream: bool,
}

/// Abstraction over AI model providers (Claude, OpenAI, Ollama, …).
#[async_trait]
pub trait ModelProvider: Send + Sync + 'static {
    /// Unique provider identifier (e.g. `"claude"`, `"openai"`, `"ollama"`).
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// List of model identifiers available via this provider.
    async fn list_models(&self) -> Result<Vec<String>, CoreError>;

    /// Non-streaming completion. Returns the full response text.
    async fn complete(&self, request: CompletionRequest) -> Result<String, CoreError>;

    /// Streaming completion. Yields chunks as they arrive.
    async fn stream(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError>;

    /// Check provider health (API reachable, credentials valid).
    async fn health_check(&self) -> Result<(), CoreError>;
}
