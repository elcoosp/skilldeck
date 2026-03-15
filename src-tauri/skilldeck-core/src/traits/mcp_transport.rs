//! MCP Transport trait and related types.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::CoreError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub transport: String,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCallResult {
    pub content: Vec<McpContent>,
    #[serde(default)]
    pub is_error: bool,
}

// Keep McpToolResult as an alias for back-compat with other modules
pub type McpToolResult = McpCallResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpContent {
    Text { text: String },
    Image { data: String, mime_type: String },
    Resource { resource: McpResource },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpCapabilities {
    #[serde(default)]
    pub tools: bool,
    #[serde(default)]
    pub resources: bool,
    #[serde(default)]
    pub prompts: bool,
}

/// An active MCP server session.
pub struct McpSession {
    pub server_name: String,
    pub tools: Vec<McpTool>,
    pub capabilities: McpCapabilities,
    inner: Box<dyn McpSessionInner>,
}

impl McpSession {
    pub fn new(
        server_name: String,
        tools: Vec<McpTool>,
        capabilities: McpCapabilities,
        inner: Box<dyn McpSessionInner>,
    ) -> Self {
        Self {
            server_name,
            tools,
            capabilities,
            inner,
        }
    }

    pub async fn call_tool(
        &self,
        name: &str,
        arguments: serde_json::Value,
    ) -> Result<McpCallResult, CoreError> {
        self.inner.call_tool(name, arguments).await
    }

    pub async fn list_resources(&self) -> Result<Vec<McpResource>, CoreError> {
        self.inner.list_resources().await
    }

    pub async fn read_resource(&self, uri: &str) -> Result<Vec<McpContent>, CoreError> {
        self.inner.read_resource(uri).await
    }
}

#[async_trait]
pub trait McpSessionInner: Send + Sync {
    async fn call_tool(
        &self,
        name: &str,
        arguments: serde_json::Value,
    ) -> Result<McpCallResult, CoreError>;

    async fn list_resources(&self) -> Result<Vec<McpResource>, CoreError>;

    async fn read_resource(&self, uri: &str) -> Result<Vec<McpContent>, CoreError>;
}

#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn connect(
        &self,
        config: &McpServerConfig,
        server_name: &str,
    ) -> Result<McpSession, CoreError>;

    fn supports(&self, config: &McpServerConfig) -> bool;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_server_config_serialization() {
        let config = McpServerConfig {
            transport: "stdio".to_string(),
            config: serde_json::json!({ "command": "mcp-server-sqlite", "args": ["--db-path", "/data.db"] }),
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("stdio"));
        assert!(json.contains("mcp-server-sqlite"));
    }

    #[test]
    fn mcp_tool_serialization() {
        let tool = McpTool {
            name: "query".to_string(),
            description: "Execute SQL query".to_string(),
            input_schema: serde_json::json!({ "type": "object", "properties": { "sql": { "type": "string" } }, "required": ["sql"] }),
        };
        let json = serde_json::to_string(&tool).unwrap();
        assert!(json.contains("query"));
        assert!(json.contains("sql"));
    }

    #[test]
    fn mcp_content_text() {
        let content = McpContent::Text {
            text: "Hello".to_string(),
        };
        let json = serde_json::to_string(&content).unwrap();
        assert!(json.contains("text"));
        assert!(json.contains("Hello"));
    }
}
