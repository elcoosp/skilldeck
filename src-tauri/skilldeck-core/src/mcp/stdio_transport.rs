//! Stdio transport for MCP servers.
//!
//! Spawns a subprocess and communicates via newline-delimited JSON-RPC 2.0
//! over the process's stdin/stdout.

use async_trait::async_trait;
use serde_json::Value;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::{
    CoreError,
    mcp::types::*,
    traits::{McpCapabilities, McpContent, McpResource, McpCallResult as McpToolResult, McpServerConfig, McpSession, McpTool, McpTransport},
};

// ── Transport ─────────────────────────────────────────────────────────────────

pub struct StdioTransport;

impl StdioTransport {
    /// Extract `command` and `args` from the config JSON blob.
    pub fn parse_config(config: &Value) -> Result<(String, Vec<String>), CoreError> {
        let command = config["command"]
            .as_str()
            .ok_or_else(|| CoreError::InvalidConfiguration {
                message: "Missing 'command' in stdio config".to_string(),
            })?
            .to_string();

        let args = config["args"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        Ok((command, args))
    }
}

#[async_trait]
impl McpTransport for StdioTransport {
    async fn connect(&self, config: &McpServerConfig, server_name: &str) -> Result<McpSession, CoreError> {
        let (command, args) = Self::parse_config(&config.config)?;
        info!("Starting MCP server '{}': {} {:?}", server_name, command, args);

        let mut child = Command::new(&command)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| CoreError::McpConnectionFailed {
                server_name: server_name.to_string(),
                message: format!("Failed to spawn process: {}", e),
            })?;

        let stdin = child.stdin.take().ok_or_else(|| CoreError::McpConnectionFailed {
            server_name: server_name.to_string(),
            message: "Failed to capture stdin".to_string(),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| CoreError::McpConnectionFailed {
            server_name: server_name.to_string(),
            message: "Failed to capture stdout".to_string(),
        })?;

        let inner = StdioSessionInner::new(stdin, stdout, child);
        let capabilities = inner.initialize().await?;
        let tools = inner.list_tools().await?;

        Ok(McpSession::new(server_name.to_string(), tools, capabilities, Box::new(inner)))
    }

    fn supports(&self, config: &McpServerConfig) -> bool {
        config.transport == "stdio"
    }
}

// ── Session inner ─────────────────────────────────────────────────────────────

struct StdioSessionInner {
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Arc<Mutex<BufReader<ChildStdout>>>,
    child: Arc<Mutex<Option<Child>>>,
    request_id: AtomicU64,
}

impl StdioSessionInner {
    fn new(stdin: ChildStdin, stdout: ChildStdout, child: Child) -> Self {
        Self {
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            child: Arc::new(Mutex::new(Some(child))),
            request_id: AtomicU64::new(1),
        }
    }

    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<JsonRpcResponse, CoreError> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let req = {
            let r = JsonRpcRequest::new(id, method);
            if let Some(p) = params { r.with_params(p) } else { r }
        };

        let line = serde_json::to_string(&req).map_err(|e| CoreError::Internal {
            message: format!("Serialize request: {}", e),
        })? + "\n";

        debug!("→ MCP stdio: {}", line.trim());

        {
            let mut stdin = self.stdin.lock().await;
            stdin.write_all(line.as_bytes()).await.map_err(|e| CoreError::McpConnectionFailed {
                server_name: String::new(),
                message: format!("stdin write: {}", e),
            })?;
            stdin.flush().await.map_err(|e| CoreError::McpConnectionFailed {
                server_name: String::new(),
                message: format!("stdin flush: {}", e),
            })?;
        }

        let response_line = {
            let mut stdout = self.stdout.lock().await;
            let mut line = String::new();
            stdout.read_line(&mut line).await.map_err(|e| CoreError::McpConnectionFailed {
                server_name: String::new(),
                message: format!("stdout read: {}", e),
            })?;
            line
        };

        debug!("← MCP stdio: {}", response_line.trim());

        let resp: JsonRpcResponse = serde_json::from_str(response_line.trim())
            .map_err(|e| CoreError::McpJsonRpc {
                code: -32700,
                message: format!("Parse response: {}", e),
            })?;

        if let Some(err) = &resp.error {
            return Err(CoreError::McpJsonRpc { code: err.code, message: err.message.clone() });
        }
        Ok(resp)
    }

    async fn initialize(&self) -> Result<McpCapabilities, CoreError> {
        let params = serde_json::to_value(InitializeParams::default())
            .map_err(|e| CoreError::Internal { message: format!("Serialize init: {}", e) })?;

        let resp = self.send_request("initialize", Some(params)).await?;
        let result: InitializeResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603,
                message: "No result in initialize response".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse init: {}", e) })?;

        info!("MCP server initialized: {} v{} (proto {})",
            result.server_info.name, result.server_info.version, result.protocol_version);

        // Notify server we're done initializing
        let _ = self.send_request("notifications/initialized", None).await;

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
                code: -32603,
                message: "No result in tools/list".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse tools: {}", e) })?;

        Ok(result.tools.into_iter().map(|t| McpTool {
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
        }).collect())
    }
}

fn map_content(content: Vec<Content>) -> Vec<McpContent> {
    content.into_iter().map(|c| match c {
        Content::Text { text } => McpContent::Text { text },
        Content::Image { data, mime_type } => McpContent::Image { data, mime_type },
        Content::Resource { resource } => McpContent::Resource {
            resource: McpResource {
                uri: resource.uri,
                name: String::new(),
                description: None,
                mime_type: resource.mime_type,
            },
        },
    }).collect()
}

#[async_trait]
impl crate::traits::McpSessionInner for StdioSessionInner {
    async fn call_tool(&self, name: &str, arguments: Value) -> Result<McpToolResult, CoreError> {
        let params = serde_json::to_value(CallToolParams {
            name: name.to_string(),
            arguments: Some(arguments),
        })
        .map_err(|e| CoreError::Internal { message: format!("Serialize call_tool: {}", e) })?;

        let resp = self.send_request("tools/call", Some(params)).await?;
        let result: CallToolResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603,
                message: "No result in tools/call".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse call_tool: {}", e) })?;

        Ok(McpToolResult { content: map_content(result.content), is_error: result.is_error })
    }

    async fn list_resources(&self) -> Result<Vec<McpResource>, CoreError> {
        let params = serde_json::to_value(ListResourcesParams::default())
            .map_err(|e| CoreError::Internal { message: format!("Serialize list_resources: {}", e) })?;

        let resp = self.send_request("resources/list", Some(params)).await?;
        let result: ListResourcesResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603,
                message: "No result in resources/list".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse resources: {}", e) })?;

        Ok(result.resources.into_iter().map(|r| McpResource {
            uri: r.uri, name: r.name, description: r.description, mime_type: r.mime_type,
        }).collect())
    }

    async fn read_resource(&self, uri: &str) -> Result<Vec<McpContent>, CoreError> {
        let params = serde_json::to_value(ReadResourceParams { uri: uri.to_string() })
            .map_err(|e| CoreError::Internal { message: format!("Serialize read_resource: {}", e) })?;

        let resp = self.send_request("resources/read", Some(params)).await?;
        let result: ReadResourceResult = serde_json::from_value(
            resp.result.ok_or_else(|| CoreError::McpJsonRpc {
                code: -32603,
                message: "No result in resources/read".into(),
            })?,
        )
        .map_err(|e| CoreError::McpJsonRpc { code: -32603, message: format!("Parse read_resource: {}", e) })?;

        Ok(result.contents.into_iter().map(|c| match (c.text, c.blob) {
            (Some(text), _) => McpContent::Text { text },
            (_, Some(_)) => McpContent::Text { text: "[Binary content]".to_string() },
            _ => McpContent::Text { text: String::new() },
        }).collect())
    }
}

impl Drop for StdioSessionInner {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.child.try_lock()
            && let Some(mut child) = guard.take() {
                let _ = child.start_kill();
                warn!("Killed MCP server process on drop");
            }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_config_ok() {
        let config = serde_json::json!({"command": "mcp-server-sqlite", "args": ["--db-path", "/data.db"]});
        let (cmd, args) = StdioTransport::parse_config(&config).unwrap();
        assert_eq!(cmd, "mcp-server-sqlite");
        assert_eq!(args, vec!["--db-path", "/data.db"]);
    }

    #[test]
    fn parse_config_missing_command_err() {
        let config = serde_json::json!({"args": ["--help"]});
        assert!(StdioTransport::parse_config(&config).is_err());
    }

    #[test]
    fn parse_config_no_args() {
        let config = serde_json::json!({"command": "my-server"});
        let (_, args) = StdioTransport::parse_config(&config).unwrap();
        assert!(args.is_empty());
    }

    #[test]
    fn supports_stdio_only() {
        let t = StdioTransport;
        assert!(t.supports(&McpServerConfig { transport: "stdio".into(), config: serde_json::json!({}) }));
        assert!(!t.supports(&McpServerConfig { transport: "sse".into(), config: serde_json::json!({}) }));
    }
}
