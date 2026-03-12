//! MCP transport abstraction.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::CoreError;

/// Configuration for an MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    /// Unique server name.
    pub name: String,
    /// Transport type: `"stdio"` or `"sse"`.
    pub transport: String,
    /// Command to run (for stdio transport).
    pub command: Option<String>,
    /// Arguments for the command (for stdio transport).
    pub args: Vec<String>,
    /// URL to connect to (for SSE transport).
    pub url: Option<String>,
    /// Additional environment variables.
    pub env: std::collections::HashMap<String, String>,
}

/// Description of a single MCP tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    /// Tool name as reported by the server.
    pub name: String,
    /// Human-readable description.
    pub description: String,
    /// JSON Schema for the tool's input parameters.
    pub input_schema: Value,
}

/// Result of calling an MCP tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCallResult {
    /// Output content items returned by the tool.
    pub content: Vec<McpContent>,
    /// True if the tool reported an error condition.
    pub is_error: bool,
}

/// A content item within an MCP call result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpContent {
    Text { text: String },
    Image { data: String, mime_type: String },
    Resource { uri: String, text: Option<String> },
}

/// An active MCP session (connected to a server).
#[async_trait]
pub trait McpSession: Send + Sync {
    /// List tools available on this server.
    async fn list_tools(&self) -> Result<Vec<McpTool>, CoreError>;

    /// Call a tool by name with the given arguments.
    async fn call_tool(&self, name: &str, arguments: Value) -> Result<McpCallResult, CoreError>;

    /// Check whether the session is still alive.
    async fn ping(&self) -> Result<(), CoreError>;

    /// Gracefully close the session.
    async fn close(&self) -> Result<(), CoreError>;
}

/// Factory that creates MCP sessions from server configurations.
#[async_trait]
pub trait McpTransport: Send + Sync + 'static {
    /// Transport type identifier (e.g. `"stdio"`, `"sse"`).
    fn transport_type(&self) -> &str;

    /// Establish a session to the given server.
    async fn connect(
        &self,
        config: &McpServerConfig,
    ) -> Result<Box<dyn McpSession>, CoreError>;
}
