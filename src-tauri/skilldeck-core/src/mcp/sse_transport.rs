//! SSE transport for MCP servers.
//!
//! Communicates with HTTP-based MCP servers by posting JSON-RPC requests and
//! reading newline-delimited JSON from the SSE response body.

use async_trait::async_trait;
use futures::StreamExt;
use reqwest::Client;
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing::{debug, info};

use crate::{
    CoreError,
    mcp::types::*,
    traits::{McpCapabilities, McpContent, McpResource, McpCallResult as McpToolResult, McpServerConfig, McpSession, McpTool, McpTransport},
};

// ── Transport ─────────────────────────────────────────────────────────────────

pub struct SseTransport {
    client: Client,
}

impl SseTransport {
    pub fn new() -> Self {
        Self { client: Client::new() }
    }

    pub fn parse_url(config: &Value) -> Result<String, CoreError> {
        config["url"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| CoreError::InvalidConfiguration {
                message: "Missing 'url' in sse config".to_string(),
            })
    }
}

impl Default for SseTransport {
    fn default() -> Self { Self::new() }
}

#[async_trait]
impl McpTransport for SseTransport {
    async fn connect(&self, config: &McpServerConfig, server_name: &str) -> Result<McpSession, CoreError> {
        let url = Self::parse_url(&config.config)?;
        info!("Connecting to SSE MCP server '{}' at {}", server_name, url);

        let inner = Arc::new(SseSessionInner::new(self.client.clone(), url, server_name.to_string()));
        let capabilities = inner.initialize().await?;
        let tools = inner.list_tools().await?;

        Ok(McpSession::new(server_name.to_string(), tools, capabilities, Box::new(SseInnerWrapper(inner))))
    }

    fn supports(&self, config: &McpServerConfig) -> bool {
        config.transport == "sse"
    }
}

// ── Session inner ─────────────────────────────────────────────────────────────

struct SseSessionInner {
    client: Client,
    base_url: String,
    server_name: String,
    request_id: AtomicU64,
}

impl SseSessionInner {
    fn new(client: Client, base_url: String, server_name: String) -> Self {
        Self { client, base_url, server_name, request_id: AtomicU64::new(1) }
    }

    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<JsonRpcResponse, CoreError> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let req = {
            let r = JsonRpcRequest::new(id, method);
            if let Some(p) = params { r.with_params(p) } else { r }
        };

        let url = format!("{}/mcp", self.base_url);
        debug!("SSE → {}: {:?}", url, method);

        let response = self.client.post(&url).json(&req).send().await
            .map_err(|e| CoreError::McpConnectionFailed {
                server_name: self.server_name.clone(),
                message: format!("HTTP request failed: {}", e),
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(CoreError::McpConnectionFailed {
                server_name: self.server_name.clone(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        // Buffer the full SSE body, then parse the first `data:` line.
        let mut stream = response.bytes_stream();
        let mut body = String::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => body.push_str(&String::from_utf8_lossy(&bytes)),
                Err(e) => return Err(CoreError::McpConnectionFailed {
                    server_name: self.server_name.clone(),
                    message: format!("Stream error: {}", e),
                }),
            }
        }

        for line in body.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(resp) = serde_json::from_str::<JsonRpcResponse>(data) {
                    if let Some(err) = &resp.error {
                        return Err(CoreError::McpJsonRpc { code: err.code, message: err.message.clone() });
                    }
                    return Ok(resp);
                }
            }
        }

        Err(CoreError::McpJsonRpc { code: -32603, message: "No valid JSON-RPC response in SSE stream".into() })
    }

    async fn initialize(&self) -> Result<McpCapabilities, CoreError> {
        let params = serde_json::to_value(InitializeParams::default())
            .map_err(|e| CoreError::Internal { message: format!("Serialize init: {}", e) })?;

        let resp = self.send_request("initialize", Some(params)).await?;
        let result: InitializeResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603, message: "No result in initialize".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse init: {}", e) })?;

        info!("SSE MCP server initialized: {} v{}", result.server_info.name, result.server_info.version);

        Ok(McpCapabilities {
            tools: result.capabilities.tools.is_some(),
            resources: result.capabilities.resources.is_some(),
            prompts: result.capabilities.prompts.is_some(),
        })
    }

    async fn list_tools(&self) -> Result<Vec<McpTool>, CoreError> {
        let params = serde_json::to_value(ListToolsParams::default())
            .map_err(|e| CoreError::Internal { message: format!("Serialize list_tools: {}", e) })?;

        let resp = self.send_request("tools/list", Some(params)).await?;
        let result: ListToolsResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603, message: "No result in tools/list".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse tools: {}", e) })?;

        Ok(result.tools.into_iter().map(|t| McpTool {
            name: t.name, description: t.description, input_schema: t.input_schema,
        }).collect())
    }
}

fn map_content(content: Vec<Content>) -> Vec<McpContent> {
    content.into_iter().map(|c| match c {
        Content::Text { text } => McpContent::Text { text },
        Content::Image { data, mime_type } => McpContent::Image { data, mime_type },
        Content::Resource { resource } => McpContent::Resource {
            resource: McpResource {
                uri: resource.uri, name: String::new(),
                description: None, mime_type: resource.mime_type,
            },
        },
    }).collect()
}

/// `Arc<SseSessionInner>` wrapper that satisfies `McpSessionInner` (Send + Sync).
struct SseInnerWrapper(Arc<SseSessionInner>);

#[async_trait]
impl crate::traits::McpSessionInner for SseInnerWrapper {
    async fn call_tool(&self, name: &str, arguments: Value) -> Result<McpToolResult, CoreError> {
        let params = serde_json::to_value(CallToolParams { name: name.to_string(), arguments: Some(arguments) })
            .map_err(|e| CoreError::Internal { message: format!("Serialize call_tool: {}", e) })?;

        let resp = self.0.send_request("tools/call", Some(params)).await?;
        let result: CallToolResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc { code: -32603, message: "No result in tools/call".into() })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse call_tool: {}", e) })?;

        Ok(McpToolResult { content: map_content(result.content), is_error: result.is_error })
    }

    async fn list_resources(&self) -> Result<Vec<McpResource>, CoreError> {
        let params = serde_json::to_value(ListResourcesParams::default())
            .map_err(|e| CoreError::Internal { message: format!("Serialize list_resources: {}", e) })?;

        let resp = self.0.send_request("resources/list", Some(params)).await?;
        let result: ListResourcesResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc { code: -32603, message: "No result in resources/list".into() })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse resources: {}", e) })?;

        Ok(result.resources.into_iter().map(|r| McpResource {
            uri: r.uri, name: r.name, description: r.description, mime_type: r.mime_type,
        }).collect())
    }

    async fn read_resource(&self, uri: &str) -> Result<Vec<McpContent>, CoreError> {
        let params = serde_json::to_value(ReadResourceParams { uri: uri.to_string() })
            .map_err(|e| CoreError::Internal { message: format!("Serialize read_resource: {}", e) })?;

        let resp = self.0.send_request("resources/read", Some(params)).await?;
        let result: ReadResourceResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc { code: -32603, message: "No result in resources/read".into() })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse read_resource: {}", e) })?;

        Ok(result.contents.into_iter().map(|c| match (c.text, c.blob) {
            (Some(text), _) => McpContent::Text { text },
            (_, Some(_)) => McpContent::Text { text: "[Binary content]".to_string() },
            _ => McpContent::Text { text: String::new() },
        }).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_url_ok() {
        let config = serde_json::json!({"url": "http://localhost:3000"});
        assert_eq!(SseTransport::parse_url(&config).unwrap(), "http://localhost:3000");
    }

    #[test]
    fn parse_url_missing_err() {
        assert!(SseTransport::parse_url(&serde_json::json!({})).is_err());
    }

    #[test]
    fn supports_sse_only() {
        let t = SseTransport::new();
        assert!(t.supports(&McpServerConfig { transport: "sse".into(), config: serde_json::json!({"url": "http://localhost"}) }));
        assert!(!t.supports(&McpServerConfig { transport: "stdio".into(), config: serde_json::json!({}) }));
    }
}
