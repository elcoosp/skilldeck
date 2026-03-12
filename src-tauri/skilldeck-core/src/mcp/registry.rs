//! MCP server registry — stub for Chunk 6.

use dashmap::DashMap;
use uuid::Uuid;

/// Runtime registry of known MCP servers.
pub struct McpRegistry {
    servers: DashMap<Uuid, String>,
}

impl McpRegistry {
    pub fn new() -> Self {
        Self {
            servers: DashMap::new(),
        }
    }
}

impl Default for McpRegistry {
    fn default() -> Self {
        Self::new()
    }
}
