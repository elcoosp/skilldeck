//! MCP (Model Context Protocol) client and supervision.

pub mod discovery;
pub mod registry;
pub mod sse_transport;
pub mod stdio_transport;
pub mod supervisor;
pub mod types;

pub use discovery::{DiscoveredServer, discover_servers};
pub use registry::{LiveServer, McpRegistry, ServerStatus};
pub use sse_transport::SseTransport;
pub use stdio_transport::StdioTransport;
pub use supervisor::{SupervisorCommand, SupervisorConfig, start_supervisor};

// Re-export McpServerConfig so mcp module users don't need to go through traits.
pub use crate::traits::McpServerConfig;
