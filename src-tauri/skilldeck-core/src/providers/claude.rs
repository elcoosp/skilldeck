//! Claude (Anthropic) model provider implementation.

use async_trait::async_trait;
use backoff::{self, ExponentialBackoff, future::retry};
use bytes::Bytes;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tracing::{debug, instrument, warn};

use crate::{
    CoreError,
    traits::{
        ChatMessage, CompletionChunk, CompletionRequest, CompletionStream, MessageRole,
        ModelCapabilities, ModelInfo, ModelProvider, ToolDefinition,
    },
};

// ── Wire types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ClaudeMessage {
    role: String,
    content: ClaudeContent,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum ClaudeContent {
    Text(String),
    #[allow(dead_code)] // Used for future tool call support
    Blocks(Vec<ClaudeContentBlock>),
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClaudeContentBlock {
    #[allow(dead_code)]
    Text { text: String },
    #[allow(dead_code)]
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    #[allow(dead_code)]
    ToolResult {
        tool_use_id: String,
        content: String,
        is_error: bool,
    },
}

#[derive(Debug, Serialize)]
struct ClaudeTool {
    name: String,
    description: String,
    input_schema: Value,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<ClaudeTool>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct ClaudeEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<ClaudeDelta>,
    #[serde(default)]
    message: Option<ClaudeMessageResponse>,
    #[serde(default)]
    usage: Option<ClaudeUsage>,
    #[allow(dead_code)]
    #[serde(default)]
    index: Option<u32>,
    #[allow(dead_code)]
    #[serde(default)]
    content_block: Option<ClaudeContentBlockResponse>,
}

#[derive(Debug, Deserialize)]
struct ClaudeDelta {
    #[serde(default)]
    text: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeMessageResponse {
    #[allow(dead_code)]
    #[serde(default)]
    id: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    role: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    content: Vec<ClaudeContentBlockResponse>,
    #[allow(dead_code)]
    #[serde(default)]
    model: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    stop_reason: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    usage: Option<ClaudeUsage>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContentBlockResponse {
    #[allow(dead_code)]
    #[serde(rename = "type", default)]
    block_type: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    text: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    id: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    name: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    input: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    #[serde(default)]
    input_tokens: u32,
    #[serde(default)]
    output_tokens: u32,
    #[serde(default)]
    cache_read_input_tokens: Option<u32>,
    #[serde(default)]
    cache_creation_input_tokens: Option<u32>,
}

// ── Provider ─────────────────────────────────────────────────────────────────

pub struct ClaudeProvider {
    client: Client,
    api_key: String,
    base_url: String,
}

impl ClaudeProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .expect("Failed to build HTTP client"),
            api_key,
            base_url: "https://api.anthropic.com/v1".to_string(),
        }
    }

    pub fn with_base_url(mut self, url: String) -> Self {
        self.base_url = url;
        self
    }

    fn convert_messages(messages: &[ChatMessage]) -> Result<Vec<ClaudeMessage>, CoreError> {
        let mut out = Vec::new();
        for msg in messages {
            let role = match msg.role {
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::System => continue, // handled separately
                MessageRole::Tool => "user",     // tool results go in user turn
            };
            out.push(ClaudeMessage {
                role: role.to_string(),
                content: ClaudeContent::Text(msg.content.clone()),
            });
        }
        Ok(out)
    }

    fn convert_tools(tools: &[ToolDefinition]) -> Vec<ClaudeTool> {
        tools
            .iter()
            .map(|t| ClaudeTool {
                name: t.name.clone(),
                description: t.description.clone(),
                input_schema: t.input_schema.clone(),
            })
            .collect()
    }
}

#[async_trait]
impl ModelProvider for ClaudeProvider {
    fn id(&self) -> &str {
        "claude"
    }
    fn display_name(&self) -> &str {
        "Anthropic Claude"
    }
    fn supports_toon(&self) -> bool {
        true
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(vec![
            ModelInfo {
                id: "claude-sonnet-4-5".to_string(),
                name: "Claude Sonnet 4.5".to_string(),
                context_length: 200_000,
                max_output_tokens: 8192,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: false,
                    prompt_caching: true,
                },
            },
            ModelInfo {
                id: "claude-opus-4".to_string(),
                name: "Claude Opus 4".to_string(),
                context_length: 200_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: false,
                    prompt_caching: true,
                },
            },
            ModelInfo {
                id: "claude-3-5-sonnet".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                context_length: 200_000,
                max_output_tokens: 8192,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: true,
                    prompt_caching: true,
                },
            },
        ])
    }

    #[instrument(skip(self, request))]
    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        let messages = Self::convert_messages(&request.messages)?;
        let tools = Self::convert_tools(&request.tools);

        // If tools_toon is present, add it as a system message
        let mut system = request.system.clone();
        if let Some(toon) = &request.tools_toon {
            let tool_msg = format!("Available tools are provided in TOON format:\n{}", toon);
            system = match system {
                Some(s) => Some(format!("{}\n\n{}", s, tool_msg)),
                None => Some(tool_msg),
            };
        }

        let claude_request = ClaudeRequest {
            model: request.model_id.clone(),
            max_tokens: request.model_params.max_tokens.unwrap_or(8192),
            messages,
            system,
            tools,
            stream: true,
            temperature: request.model_params.temperature,
        };

        debug!("Sending request to Claude API");

        let client = self.client.clone();
        let api_key = self.api_key.clone();
        let base_url = self.base_url.clone();

        let operation = || {
            let client = client.clone();
            let api_key = api_key.clone();
            let base_url = base_url.clone();
            let body = serde_json::to_value(&claude_request).unwrap();
            async move {
                let response = client
                    .post(format!("{}/messages", base_url))
                    .header("x-api-key", &api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| {
                        warn!("Claude API request failed: {}", e);
                        backoff::Error::transient(CoreError::ModelConnection {
                            provider: "claude".to_string(),
                            message: e.to_string(),
                        })
                    })?;

                let status = response.status();
                if !status.is_success() {
                    let error_body = response.text().await.unwrap_or_default();
                    warn!("Claude API error: {} - {}", status, error_body);
                    return if status.as_u16() == 429 {
                        Err(backoff::Error::transient(CoreError::ModelRateLimited {
                            provider: "claude".to_string(),
                            retry_after_ms: 1000,
                        }))
                    } else if status.is_server_error() {
                        Err(backoff::Error::transient(CoreError::ModelInternal {
                            provider: "claude".to_string(),
                            message: format!("{}: {}", status, error_body),
                        }))
                    } else {
                        Err(backoff::Error::permanent(CoreError::ModelRequestRejected {
                            provider: "claude".to_string(),
                            message: format!("{}: {}", status, error_body),
                        }))
                    };
                }
                Ok(response)
            }
        };

        let backoff = ExponentialBackoff {
            initial_interval: Duration::from_millis(100),
            max_interval: Duration::from_secs(10),
            multiplier: 2.0,
            max_elapsed_time: Some(Duration::from_secs(60)),
            ..Default::default()
        };

        let response = retry(backoff, operation).await?;

        let stream =
            response
                .bytes_stream()
                .flat_map(move |result: Result<Bytes, reqwest::Error>| {
                    let items: Vec<Result<CompletionChunk, CoreError>> = match result {
                        Ok(bytes) => {
                            let text = String::from_utf8_lossy(&bytes);
                            let mut chunks = Vec::new();

                            for line in text.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        continue;
                                    }
                                    if let Ok(event) = serde_json::from_str::<ClaudeEvent>(data) {
                                        if let Some(delta) = &event.delta {
                                            if let Some(text) = &delta.text {
                                                if !text.is_empty() {
                                                    chunks.push(Ok(CompletionChunk::Token {
                                                        content: text.clone(),
                                                    }));
                                                }
                                            }
                                        }
                                        if event.event_type == "message_stop" {
                                            let usage = event
                                                .message
                                                .as_ref()
                                                .and_then(|m| m.usage.as_ref())
                                                .or(event.usage.as_ref());
                                            if let Some(usage) = usage {
                                                chunks.push(Ok(CompletionChunk::Done {
                                                    input_tokens: usage.input_tokens,
                                                    output_tokens: usage.output_tokens,
                                                    cache_read_tokens: usage
                                                        .cache_read_input_tokens
                                                        .unwrap_or(0),
                                                    cache_write_tokens: usage
                                                        .cache_creation_input_tokens
                                                        .unwrap_or(0),
                                                }));
                                            }
                                        }
                                    }
                                }
                            }
                            chunks
                        }
                        Err(e) => vec![Err(CoreError::ModelConnection {
                            provider: "claude".to_string(),
                            message: e.to_string(),
                        })],
                    };
                    futures::stream::iter(items)
                });

        Ok(Box::pin(stream))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn provider_id() {
        let p = ClaudeProvider::new("test-key".to_string());
        assert_eq!(p.id(), "claude");
        assert_eq!(p.display_name(), "Anthropic Claude");
        assert!(p.supports_toon());
    }

    #[test]
    fn message_conversion_skips_system() {
        let messages = vec![
            ChatMessage {
                role: MessageRole::System,
                content: "Be helpful".to_string(),
                name: None,
            },
            ChatMessage {
                role: MessageRole::User,
                content: "Hello".to_string(),
                name: None,
            },
            ChatMessage {
                role: MessageRole::Assistant,
                content: "Hi!".to_string(),
                name: None,
            },
        ];
        let out = ClaudeProvider::convert_messages(&messages).unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].role, "user");
        assert_eq!(out[1].role, "assistant");
    }

    #[test]
    fn tool_conversion() {
        let tools = vec![ToolDefinition {
            name: "test".to_string(),
            description: "A test tool".to_string(),
            input_schema: json!({"type": "object"}),
        }];
        let out = ClaudeProvider::convert_tools(&tools);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].name, "test");
    }

    #[tokio::test]
    async fn list_models_returns_claude() {
        let p = ClaudeProvider::new("test-key".to_string());
        let models = p.list_models().await.unwrap();
        assert!(!models.is_empty());
        assert!(models.iter().any(|m| m.id == "claude-sonnet-4-5"));
    }
}
