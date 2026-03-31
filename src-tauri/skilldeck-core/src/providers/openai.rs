//! OpenAI model provider implementation.

use async_trait::async_trait;
use backoff::{self, ExponentialBackoff, future::retry};
use bytes::Bytes;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tracing::{debug, info, instrument, trace, warn};

use crate::{
    CoreError,
    traits::{
        ChatMessage, CompletionChunk, CompletionRequest, CompletionStream, FunctionCall,
        MessageRole, ModelCapabilities, ModelInfo, ModelProvider, ToolCall, ToolDefinition,
    },
};

// ── Wire types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct OpenAiMessage {
    role: String,
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OpenAiToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAiToolCall {
    id: String,
    r#type: String,
    function: OpenAiFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAiFunction {
    name: String,
    arguments: String,
}

#[derive(Debug, Serialize)]
pub struct OpenAiTool {
    r#type: String,
    function: OpenAiFunctionDef,
}

#[derive(Debug, Serialize)]
struct OpenAiFunctionDef {
    name: String,
    description: String,
    parameters: Value,
}

#[derive(Debug, Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    stream: bool,
    stream_options: Option<Value>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<OpenAiTool>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChunk {
    #[serde(default)]
    choices: Vec<OpenAiChoice>,
    #[serde(default)]
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    #[serde(default)]
    delta: OpenAiDelta,
    #[allow(dead_code)]
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenAiDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<OpenAiToolCall>>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    #[serde(default)]
    prompt_tokens_details: Option<OpenAiUsageDetails>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsageDetails {
    #[serde(default)]
    cached_tokens: u32,
}

/// Error envelope that some OpenAI-compatible APIs send mid-stream with 200 status.
#[derive(Debug, Deserialize)]
struct OpenAiErrorEnvelope {
    error: OpenAiErrorDetail,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorDetail {
    message: String,
    #[serde(default)]
    code: Option<String>,
}

// ── Provider ─────────────────────────────────────────────────────────────────

pub struct OpenAiProvider {
    client: Client,
    api_key: String,
    pub(crate) base_url: String,
}

impl OpenAiProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .expect("Failed to build HTTP client"),
            api_key,
            base_url: "https://api.openai.com/v1".to_string(),
        }
    }

    pub fn with_base_url(mut self, url: String) -> Self {
        self.base_url = url;
        self
    }

    pub fn convert_messages(messages: &[ChatMessage]) -> Vec<OpenAiMessage> {
        messages
            .iter()
            .map(|msg| {
                let role = match msg.role {
                    MessageRole::System => "system",
                    MessageRole::User => "user",
                    MessageRole::Assistant => "assistant",
                    MessageRole::Tool => "tool",
                };
                OpenAiMessage {
                    role: role.to_string(),
                    content: Some(msg.content.clone()),
                    tool_calls: None,
                    tool_call_id: None,
                }
            })
            .collect()
    }

    pub fn convert_tools(tools: &[ToolDefinition]) -> Vec<OpenAiTool> {
        tools
            .iter()
            .map(|t| OpenAiTool {
                r#type: "function".to_string(),
                function: OpenAiFunctionDef {
                    name: t.name.clone(),
                    description: t.description.clone(),
                    parameters: t.input_schema.clone(),
                },
            })
            .collect()
    }
}

#[async_trait]
impl ModelProvider for OpenAiProvider {
    fn id(&self) -> &str {
        "openai"
    }
    fn display_name(&self) -> &str {
        "OpenAI"
    }
    fn supports_toon(&self) -> bool {
        true
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        Ok(vec![
            ModelInfo {
                id: "gpt-4o".to_string(),
                name: "GPT-4o".to_string(),
                context_length: 128_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
            ModelInfo {
                id: "gpt-4o-mini".to_string(),
                name: "GPT-4o Mini".to_string(),
                context_length: 128_000,
                max_output_tokens: 16384,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
            ModelInfo {
                id: "gpt-4-turbo".to_string(),
                name: "GPT-4 Turbo".to_string(),
                context_length: 128_000,
                max_output_tokens: 4096,
                capabilities: ModelCapabilities {
                    function_calling: true,
                    vision: true,
                    code_execution: false,
                    prompt_caching: false,
                },
            },
        ])
    }

    #[instrument(skip(self, request))]
    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        let messages = Self::convert_messages(&request.messages);
        let tools = Self::convert_tools(&request.tools);

        let openai_request = OpenAiRequest {
            model: request.model_id.clone(),
            messages,
            max_tokens: request.model_params.max_tokens,
            temperature: request.model_params.temperature,
            stream: true,
            stream_options: Some(json!({"include_usage": true})),
            tools,
        };

        let client = self.client.clone();
        let api_key = self.api_key.clone();
        let base_url = self.base_url.clone();

        let operation = || {
            let client = client.clone();
            let api_key = api_key.clone();
            let base_url = base_url.clone();
            let body = serde_json::to_value(&openai_request).unwrap();
            async move {
                let response = client
                    .post(format!("{}/chat/completions", base_url))
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| {
                        warn!("OpenAI request failed: {}", e);
                        backoff::Error::transient(CoreError::ModelConnection {
                            provider: "openai".to_string(),
                            message: e.to_string(),
                        })
                    })?;

                let status = response.status();
                if !status.is_success() {
                    let error_body = response.text().await.unwrap_or_default();
                    warn!("OpenAI API error: {} - {}", status, error_body);
                    return if status.as_u16() == 429 {
                        Err(backoff::Error::transient(CoreError::ModelRateLimited {
                            provider: "openai".to_string(),
                            retry_after_ms: 1000,
                        }))
                    } else if status.is_server_error() {
                        Err(backoff::Error::transient(CoreError::ModelInternal {
                            provider: "openai".to_string(),
                            message: format!("{}: {}", status, error_body),
                        }))
                    } else {
                        Err(backoff::Error::permanent(CoreError::ModelRequestRejected {
                            provider: "openai".to_string(),
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

        // ── LOGGING: Log raw HTTP response status + headers before decoding ──
        tracing::debug!(
            target: "openai::stream",
            status = %response.status(),
            content_type = ?response.headers().get("content-type"),
            "OpenAI HTTP response received"
        );

        // ── LOGGING: Stream opened ──
        info!(
            target: "openai::stream",
            model = %request.model_id,
            "Stream opened"
        );

        // Counters for stream lifecycle logging
        let chunk_count = Arc::new(AtomicU64::new(0));
        let token_count = Arc::new(AtomicU64::new(0));
        let chunk_count_clone = chunk_count.clone();
        let token_count_clone = token_count.clone();
        let model_id_for_log = request.model_id.clone();

        // BUG FIX: Use `scan` to maintain a line buffer across TCP chunks.
        // `bytes_stream()` yields raw TCP chunks, not logical SSE lines.
        // A single `data: {...}\n` event can be split across multiple chunks,
        // and a single chunk can contain multiple events.
        let stream = response
            .bytes_stream()
            .scan(
                String::new(), // line_buf: accumulates partial lines across chunks
                move |line_buf, result: Result<Bytes, reqwest::Error>| {
                    let mut items: Vec<Result<CompletionChunk, CoreError>> = Vec::new();

                    match result {
                        Ok(bytes) => {
                            // ── LOGGING: Log raw bytes before any parsing ──
                            tracing::trace!(
                                target: "openai::stream",
                                raw_bytes_len = bytes.len(),
                                raw_bytes = ?bytes,
                                "Raw chunk received"
                            );

                            let text = String::from_utf8_lossy(&bytes);
                            debug!(
                                provider = "openai",
                                chunk_len = bytes.len(),
                                raw = %text,
                                "received SSE chunk"
                            );

                            // Append to buffer — may complete a line that was split
                            line_buf.push_str(&text);

                            // Process all complete lines (terminated by \n)
                            while let Some(newline_pos) = line_buf.find('\n') {
                                let line =
                                    line_buf[..newline_pos].trim_end_matches('\r').to_string();
                                line_buf.drain(..=newline_pos);

                                // Skip empty lines and SSE comment lines (e.g., `: keep-alive`)
                                if line.is_empty() || line.starts_with(':') {
                                    continue;
                                }

                                if let Some(data) = line.strip_prefix("data: ") {
                                    // ── LOGGING: Log every SSE line before decode ──
                                    trace!(
                                        target: "openai::stream",
                                        line = %data,
                                        "SSE line received"
                                    );

                                    if data == "[DONE]" {
                                        // ── LOGGING: Stream closed with [DONE] ──
                                        info!(
                                            target: "openai::stream",
                                            chunks_received = chunk_count_clone.load(Ordering::Relaxed),
                                            tokens_emitted = token_count_clone.load(Ordering::Relaxed),
                                            terminated_by = "[DONE]",
                                            "Stream closed"
                                        );
                                        continue;
                                    }

                                    // BUG FIX: Check for inline error envelope before parsing as chunk.
                                    // Some OpenAI-compatible APIs send error objects mid-stream with
                                    // a 200 status code (rate limits, content filters, etc.).
                                    if let Ok(err_envelope) =
                                        serde_json::from_str::<OpenAiErrorEnvelope>(data)
                                    {
                                        warn!(
                                            provider = "openai",
                                            message = %err_envelope.error.message,
                                            code = ?err_envelope.error.code,
                                            "SSE error envelope received"
                                        );
                                        items.push(Err(CoreError::ModelRequestRejected {
                                            provider: "openai".to_string(),
                                            message: format!(
                                                "{} (code: {:?})",
                                                err_envelope.error.message, err_envelope.error.code
                                            ),
                                        }));
                                        continue;
                                    }

                                    // BUG FIX: Use `match` instead of `if let Ok` to log parse failures.
                                    // Previously errors were silently swallowed, making diagnosis impossible.
                                    match serde_json::from_str::<OpenAiChunk>(data) {
                                        Ok(chunk) => {
                                            chunk_count_clone.fetch_add(1, Ordering::Relaxed);

                                            if let Some(choice) = chunk.choices.first() {
                                                if let Some(content) = &choice.delta.content {
                                                    if !content.is_empty() {
                                                        token_count_clone.fetch_add(content.len() as u64, Ordering::Relaxed);
                                                        items.push(Ok(CompletionChunk::Token {
                                                            content: content.clone(),
                                                        }));
                                                    }
                                                }
                                                if let Some(tool_calls) = &choice.delta.tool_calls {
                                                    if let Some(tc) = tool_calls.first() {
                                                        items.push(Ok(CompletionChunk::ToolCall {
                                                            tool_call: ToolCall {
                                                                id: tc.id.clone(),
                                                                r#type: tc.r#type.clone(),
                                                                function: FunctionCall {
                                                                    name: tc.function.name.clone(),
                                                                    arguments: tc
                                                                        .function
                                                                        .arguments
                                                                        .clone(),
                                                                },
                                                            },
                                                        }));
                                                    }
                                                }
                                            }
                                            if let Some(usage) = &chunk.usage {
                                                items.push(Ok(CompletionChunk::Done {
                                                    input_tokens: usage.prompt_tokens,
                                                    output_tokens: usage.completion_tokens,
                                                    cache_read_tokens: usage
                                                        .prompt_tokens_details
                                                        .as_ref()
                                                        .map(|d| d.cached_tokens)
                                                        .unwrap_or(0),
                                                    cache_write_tokens: 0,
                                                }));
                                            }
                                        }
                                        Err(e) => {
                                            // ── LOGGING: Log raw bytes on decode failure ──
                                            tracing::error!(
                                                target: "openai::stream",
                                                raw_bytes = ?&data[..data.len().min(500)],
                                                error = %e,
                                                "Stream chunk decode failed"
                                            );
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            // Check if this is a timeout or network error
                            let is_timeout = e.to_string().contains("timed out") || e.to_string().contains("timeout");
                            let is_network = e.to_string().contains("connection") || e.to_string().contains("network");

                            tracing::error!(
                                target: "openai::stream",
                                error = %e,
                                chunks_received = chunk_count_clone.load(Ordering::Relaxed),
                                is_timeout = is_timeout,
                                is_network = is_network,
                                "Stream read error"
                            );

                            let user_message = if is_timeout {
                                "Request timed out. The model may be overloaded. Please try again.".to_string()
                            } else if is_network {
                                "Network connection lost. Please check your internet connection.".to_string()
                            } else {
                                format!("Stream read error: {}. This may be a temporary issue.", e)
                            };

                            items.push(Err(CoreError::ModelConnection {
                                provider: "openai".to_string(),
                                message: user_message,
                            }));
                        }
                    }

                    async move { Some(futures::stream::iter(items)) }
                },
            )
            .flat_map(|s| s);

        // NOTE (Bug 4): The Done chunk may never be emitted if:
        // - The connection drops before the final usage chunk
        // - The model hits max_tokens and the API ends without usage
        // - include_usage is not supported by the endpoint
        //
        // The agent loop consuming this stream MUST handle stream-end-without-Done
        // by treating clean stream termination as an implicit Done with zeroed tokens.

        Ok(Box::pin(stream))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_id() {
        let p = OpenAiProvider::new("test-key".to_string());
        assert_eq!(p.id(), "openai");
        assert_eq!(p.display_name(), "OpenAI");
    }

    #[test]
    fn message_conversion_keeps_system() {
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
        ];
        let out = OpenAiProvider::convert_messages(&messages);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].role, "system");
        assert_eq!(out[1].role, "user");
    }

    #[tokio::test]
    async fn list_models_returns_gpt4o() {
        let p = OpenAiProvider::new("test-key".to_string());
        let models = p.list_models().await.unwrap();
        assert!(models.iter().any(|m| m.id == "gpt-4o"));
    }

    #[test]
    fn custom_base_url() {
        let p = OpenAiProvider::new("key".to_string())
            .with_base_url("http://localhost:11434/v1".to_string());
        assert_eq!(p.base_url, "http://localhost:11434/v1");
    }
}
