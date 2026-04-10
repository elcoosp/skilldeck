// src-tauri/skilldeck-core/src/providers/ollama.rs
//! Native Ollama provider using `ollama-rs` with thinking support.
//!
//! Talks directly to Ollama's native API and emits `CompletionChunk::Thinking`
//! deltas when `request.thinking == true`.

use async_trait::async_trait;
use futures::StreamExt;
use ollama_rs::{
    Ollama as OllamaClient,
    generation::chat::{ChatMessage as OllamaChatMessage, request::ChatMessageRequest},
};
use tracing::{debug, info, warn};

use crate::{
    CoreError,
    traits::model_provider::ProviderReadyStatus,
    traits::{
        ChatMessage, CompletionChunk, CompletionRequest, CompletionStream, MessageRole,
        ModelCapabilities, ModelInfo, ModelProvider,
    },
};

// ── OllamaProvider (native) ──────────────────────────────────────────────────

pub struct OllamaProvider {
    client: OllamaClient,
    port: u16,
}

impl OllamaProvider {
    pub fn new(port: u16) -> Self {
        Self {
            client: OllamaClient::new("http://localhost", port),
            port,
        }
    }

    /// Convert our `ChatMessage` → `OllamaChatMessage`.
    /// System messages are prepended as the first user message (Ollama doesn't
    /// support a dedicated system role — it's folded into the first message).
    fn convert_messages(
        messages: &[ChatMessage],
        system: &Option<String>,
    ) -> Vec<OllamaChatMessage> {
        let mut out = Vec::with_capacity(messages.len() + 1);

        // If there's a system prompt, prepend it as a user message
        if let Some(sys) = system {
            out.push(OllamaChatMessage::user(sys.clone()));
        }

        for msg in messages {
            let ollama_msg = match msg.role {
                MessageRole::System => {
                    // System messages in the middle of conversation are
                    // converted to user messages in Ollama's API.
                    OllamaChatMessage::user(msg.content.clone())
                }
                MessageRole::User => OllamaChatMessage::user(msg.content.clone()),
                MessageRole::Assistant => OllamaChatMessage::assistant(msg.content.clone()),
                MessageRole::Tool => {
                    // Ollama doesn't natively support tool messages in the
                    // same way. Fold tool results back into the assistant
                    // context as user messages.
                    let content = if let Some(ref name) = msg.name {
                        format!("[Tool result from '{}']\n{}", name, msg.content)
                    } else {
                        format!("[Tool result]\n{}", msg.content)
                    };
                    OllamaChatMessage::user(content)
                }
            };
            out.push(ollama_msg);
        }

        out
    }

    /// Parse the output of `ollama list`.
    pub fn parse_ollama_list(output: &str) -> Vec<String> {
        output
            .lines()
            .skip(1) // skip the header row
            .filter_map(|line| {
                let name = line.split_whitespace().next()?;
                if name.is_empty() {
                    None
                } else {
                    Some(name.to_string())
                }
            })
            .collect()
    }

    pub async fn check_ollama_status() -> OllamaStatus {
        let which = tokio::process::Command::new("which")
            .arg("ollama")
            .output()
            .await;
        if which.map(|w| w.status.success()).unwrap_or(false) {
            let list = tokio::process::Command::new("ollama")
                .arg("list")
                .output()
                .await;
            match list {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let model_ids = Self::parse_ollama_list(&stdout);
                    if model_ids.is_empty() {
                        OllamaStatus::NoModels
                    } else {
                        let models: Vec<ModelInfo> = model_ids
                            .into_iter()
                            .map(|id| ModelInfo {
                                id: id.clone(),
                                name: id,
                                context_length: 128_000,
                                max_output_tokens: 4096,
                                capabilities: ModelCapabilities {
                                    function_calling: false, // native API doesn't support this
                                    vision: false,
                                    code_execution: false,
                                    prompt_caching: false,
                                },
                            })
                            .collect();
                        OllamaStatus::Available(models)
                    }
                }
                _ => OllamaStatus::NotRunning,
            }
        } else {
            OllamaStatus::NotInstalled
        }
    }
}

#[derive(Debug, Clone)]
pub enum OllamaStatus {
    Available(Vec<ModelInfo>),
    NotInstalled,
    NotRunning,
    NoModels,
}

#[async_trait]
impl ModelProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }

    fn display_name(&self) -> &str {
        "Ollama"
    }

    fn supports_toon(&self) -> bool {
        false
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
        match Self::check_ollama_status().await {
            OllamaStatus::Available(models) => Ok(models),
            _ => Ok(vec![]),
        }
    }

    async fn complete(&self, request: CompletionRequest) -> Result<CompletionStream, CoreError> {
        let ollama_messages = Self::convert_messages(&request.messages, &request.system);
        if ollama_messages.is_empty() {
            return Err(CoreError::ModelInvalidResponse {
                provider: "ollama".to_string(),
                message: "No messages to send".to_string(),
            });
        }

        let mut req = ChatMessageRequest::new(request.model_id.clone(), ollama_messages);

        // Enable thinking mode if requested
        if request.thinking {
            req = req.think(true);
        }

        info!(
            "Sending native Ollama request: model={}, thinking={}, messages={}",
            request.model_id,
            request.thinking,
            req.messages.len()
        );

        let stream_result = self
            .client
            .send_chat_messages_stream(req)
            .await
            .map_err(|e| {
                warn!("Native Ollama stream error: {}", e);
                CoreError::ModelConnection {
                    provider: "ollama".to_string(),
                    message: e.to_string(),
                }
            })?;

        let stream = stream_result.filter_map(move |result| async move {
            match result {
                Ok(response) => {
                    debug!(
                        "Ollama response: thinking={:?}, content={:?}, done={}",
                        response.message.thinking, response.message, response.done
                    );

                    let mut items = Vec::new();

                    // Emit thinking delta if present
                    if let Some(ref thinking) = response.message.thinking {
                        if !thinking.is_empty() {
                            items.push(Ok(CompletionChunk::Thinking {
                                delta: thinking.clone(),
                            }));
                        }
                    }

                    // Emit content delta if present
                    let content = &response.message.content;
                    if !content.is_empty() {
                        items.push(Ok(CompletionChunk::Token {
                            content: content.clone(),
                        }));
                    }

                    // Emit Done on final chunk
                    if response.done {
                        items.push(Ok(CompletionChunk::Done {
                            input_tokens: 0,
                            output_tokens: 0,
                            cache_read_tokens: 0,
                            cache_write_tokens: 0,
                        }));
                    }

                    if items.is_empty() {
                        None
                    } else {
                        Some(futures::stream::iter(items))
                    }
                }
                Err(e) => {
                    warn!("Ollama stream item error: {:?}", e);
                    Some(futures::stream::iter(vec![Err(
                        CoreError::ModelConnection {
                            provider: "ollama".to_string(),
                            message: format!("{:?}", e),
                        },
                    )]))
                }
            }
        });

        Ok(Box::pin(stream.flat_map(|s| s)))
    }

    async fn is_ready(&self, model_id: &str) -> ProviderReadyStatus {
        match Self::check_ollama_status().await {
            OllamaStatus::Available(models) => {
                if models.iter().any(|m| m.id == model_id) {
                    ProviderReadyStatus::Ready
                } else {
                    ProviderReadyStatus::NotReady {
                        reason: format!("Model '{}' is not installed in Ollama", model_id),
                        fix_action: format!("Run `ollama pull {}` to install it", model_id),
                    }
                }
            }
            OllamaStatus::NotInstalled => ProviderReadyStatus::NotReady {
                reason: "Ollama is not installed on this machine".to_string(),
                fix_action: "Install Ollama from https://ollama.com/download".to_string(),
            },
            OllamaStatus::NotRunning => ProviderReadyStatus::NotReady {
                reason: "Ollama is installed but not running".to_string(),
                fix_action: "Start the Ollama service (e.g., `ollama serve`)".to_string(),
            },
            OllamaStatus::NoModels => ProviderReadyStatus::NotReady {
                reason: "Ollama is running but no models are installed".to_string(),
                fix_action: "Pull a model, e.g., `ollama pull llama3.2`".to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_id_and_display_name() {
        let p = OllamaProvider::new(11434);
        assert_eq!(p.id(), "ollama");
        assert_eq!(p.display_name(), "Ollama");
        assert!(!p.supports_toon());
    }

    #[test]
    fn parse_ollama_list_typical_output() {
        let output = "NAME                     ID              SIZE    MODIFIED\n\
                      llama3.2:latest          a80c4f17acd5    2.0 GB  3 hours ago\n\
                      codellama:latest         8fdf8f752f6e    3.8 GB  2 days ago\n";
        let models = OllamaProvider::parse_ollama_list(output);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0], "llama3.2:latest");
        assert_eq!(models[1], "codellama:latest");
    }

    #[test]
    fn parse_ollama_list_empty() {
        let models = OllamaProvider::parse_ollama_list("");
        assert!(models.is_empty());
    }

    #[test]
    fn convert_messages_basic() {
        let messages = vec![
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
        let out = OllamaProvider::convert_messages(&messages, &None);
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn convert_messages_with_system_prepended() {
        let messages = vec![ChatMessage {
            role: MessageRole::User,
            content: "Hello".to_string(),
            name: None,
        }];
        let out = OllamaProvider::convert_messages(&messages, &Some("Be helpful.".to_string()));
        assert_eq!(out.len(), 2); // system + user
    }

    #[test]
    fn convert_tool_messages_folded_as_user() {
        let messages = vec![
            ChatMessage {
                role: MessageRole::User,
                content: "Search X".to_string(),
                name: None,
            },
            ChatMessage {
                role: MessageRole::Assistant,
                content: "calling tool".to_string(),
                name: None,
            },
            ChatMessage {
                role: MessageRole::Tool,
                content: "result data".to_string(),
                name: Some("search".to_string()),
            },
        ];
        let out = OllamaProvider::convert_messages(&messages, &None);
        assert_eq!(out.len(), 3);
    }
}
