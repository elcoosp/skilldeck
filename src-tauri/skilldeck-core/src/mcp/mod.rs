//! MCP (Model Context Protocol) client and supervision.

pub mod types;
pub mod stdio_transport;
pub mod sse_transport;
pub mod registry;
pub mod supervisor;
pub mod discovery;

pub use registry::McpRegistry;
