// src-tauri/src/subagent_server.rs

use adk_rust::prelude::{InMemorySessionService, LlmAgentBuilder};
use adk_rust::server::{ServerConfig, create_app_with_a2a};
use adk_rust::{
    AdkError, Agent, Content, FinishReason, Llm, LlmRequest, LlmResponse, LlmResponseStream, Part,
    SingleAgentLoader, UsageMetadata,
};
use async_trait::async_trait;
use futures::StreamExt;
use serde_json::Value;
use skilldeck_core::skills::SkillRegistry;
use skilldeck_core::traits::ModelProvider;
use skilldeck_core::{
    ChatMessage, CompletionChunk, CompletionRequest, CoreError, MessageRole, ModelParams,
};
use std::sync::Arc;
use tokio::sync::oneshot;

// Adapter to convert ModelProvider to Llm trait for ADK
struct LlmAdapter {
    provider: Arc<dyn ModelProvider>,
    model_id: String,
}

#[async_trait]
impl Llm for LlmAdapter {
    fn name(&self) -> &str {
        &self.model_id
    }

    async fn generate_content(
        &self,
        request: LlmRequest,
        _stream: bool, // skilldeck‑core always streams, we ignore this flag.
    ) -> Result<LlmResponseStream, AdkError> {
        let provider = self.provider.clone();
        let model_id = self.model_id.clone();

        // Convert ADK request to skilldeck‑core CompletionRequest.
        let completion_req = convert_request(request, model_id)
            .map_err(|e| AdkError::model(format!("request conversion failed: {e}")))?;

        // Obtain the raw stream from the provider.
        let raw_stream = provider
            .complete(completion_req)
            .await
            .map_err(|e| AdkError::model(format!("provider error: {e}")))?;

        // Map each chunk from skilldeck‑core to ADK LlmResponse.
        let mapped_stream = raw_stream.map(|chunk_result| match chunk_result {
            Ok(chunk) => match chunk {
                CompletionChunk::Token { content } => {
                    // A token chunk – produce a partial text response.
                    Ok(LlmResponse {
                        content: Some(Content {
                            role: "model".to_string(),
                            parts: vec![Part::Text { text: content }],
                        }),
                        partial: true,
                        turn_complete: false,
                        ..Default::default()
                    })
                }
                CompletionChunk::ToolCall { tool_call } => {
                    // A tool call chunk – map to a FunctionCall part.
                    // The arguments are a JSON string inside tool_call.function.
                    let args: Value =
                        serde_json::from_str(&tool_call.function.arguments).unwrap_or(Value::Null);

                    let part = Part::FunctionCall {
                        name: tool_call.function.name,
                        args,
                        id: Some(tool_call.id),
                        thought_signature: None,
                    };
                    Ok(LlmResponse {
                        content: Some(Content {
                            role: "model".to_string(),
                            parts: vec![part],
                        }),
                        partial: false, // tool calls are usually final
                        turn_complete: true,
                        finish_reason: Some(FinishReason::Stop),
                        ..Default::default()
                    })
                }
                CompletionChunk::Done {
                    input_tokens,
                    output_tokens,
                    cache_read_tokens: _,
                    cache_write_tokens: _,
                } => {
                    // Final chunk with usage metadata – no content, just usage.
                    let usage = UsageMetadata {
                        prompt_token_count: input_tokens as i32,
                        candidates_token_count: output_tokens as i32,
                        total_token_count: (input_tokens + output_tokens) as i32,
                        ..Default::default()
                    };
                    Ok(LlmResponse {
                        usage_metadata: Some(usage),
                        partial: false,
                        turn_complete: true,
                        finish_reason: Some(FinishReason::Stop),
                        ..Default::default()
                    })
                }
            },
            Err(e) => Err(AdkError::model(format!("stream error: {e}"))),
        });

        Ok(Box::pin(mapped_stream))
    }
}

/// Convert an ADK `LlmRequest` into a skilldeck‑core `CompletionRequest`.
fn convert_request(req: LlmRequest, model_id: String) -> Result<CompletionRequest, CoreError> {
    let mut messages = Vec::new();
    let mut system = None;

    for content in req.contents {
        let role_str = content.role.as_str();

        // Combine all text parts from this content into a single string.
        let text_parts: Vec<String> = content
            .parts
            .iter()
            .filter_map(|p| match p {
                Part::Text { text } => Some(text.clone()),
                Part::Thinking { thinking, .. } => Some(thinking.clone()),
                _ => None,
            })
            .collect();
        let content_str = text_parts.join("\n");
        if content_str.is_empty() {
            continue;
        }

        match role_str {
            "system" => {
                // skilldeck‑core has a dedicated system field.
                system = Some(content_str);
            }
            "user" | "model" | "assistant" | "tool" => {
                let role = match role_str {
                    "user" => MessageRole::User,
                    "model" | "assistant" => MessageRole::Assistant,
                    "tool" => MessageRole::Tool,
                    _ => MessageRole::User, // fallback
                };
                messages.push(ChatMessage {
                    role,
                    content: content_str,
                    name: None,
                });
            }
            _ => {}
        }
    }

    // Extract generation parameters from the request config.
    let (temperature, max_tokens) = req
        .config
        .as_ref()
        .map(|cfg| (cfg.temperature, cfg.max_output_tokens))
        .unwrap_or((None, None));

    // Build ModelParams, including required stop and top_p fields.
    let model_params = ModelParams {
        temperature,
        max_tokens: max_tokens.map(|t| t as u32),
        top_p: None,
        stop: Vec::new(),
    };

    // Tools are not yet implemented in this adapter.
    let tools = Vec::new();
    let tools_toon = None;

    Ok(CompletionRequest {
        model_id,
        messages,
        system,
        tools,
        tools_toon,
        model_params,
    })
}

pub struct SubagentServer {
    pub url: String,
    shutdown_tx: oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<()>,
}

impl SubagentServer {
    pub async fn spawn(agent: Arc<dyn Agent>) -> Result<Self, Box<dyn std::error::Error>> {
        let session_service = Arc::new(InMemorySessionService::new());
        let loader = Arc::new(SingleAgentLoader::new(agent));
        let config = ServerConfig::new(loader, session_service);
        let app = create_app_with_a2a(config, None);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let url = format!("http://{}", addr);

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                })
                .await
                .expect("axum serve failed");
        });

        Ok(SubagentServer {
            url,
            shutdown_tx,
            handle,
        })
    }

    pub async fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
        self.handle.await.ok();
    }
}

pub async fn build_subagent_agent(
    provider: Arc<dyn ModelProvider>,
    model_id: String,
    task: String,
    skill_names: Vec<String>,
    skill_registry: Arc<SkillRegistry>,
) -> Result<Arc<dyn Agent>, String> {
    let mut skills_content = Vec::new();
    for name in &skill_names {
        let skill = skill_registry
            .get_skill(name)
            .await
            .ok_or_else(|| format!("Skill '{}' not found", name))?;
        skills_content.push(format!(
            "\n\n---\n\n[Skill: {}]\n{}",
            name, skill.content_md
        ));
    }

    let system_prompt = if skills_content.is_empty() {
        task
    } else {
        format!("{}\n\n{}", task, skills_content.join(""))
    };

    let llm_adapter = Arc::new(LlmAdapter { provider, model_id });

    let agent = LlmAgentBuilder::new("subagent")
        .model(llm_adapter)
        .instruction(system_prompt)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(Arc::new(agent))
}
