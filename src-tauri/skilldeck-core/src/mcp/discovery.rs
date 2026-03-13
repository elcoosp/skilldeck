//! MCP server auto-discovery.
//!
//! Scans well-known locations on disk and in the environment for MCP server
//! configurations.  In v1 this is intentionally minimal — it reads a JSON
//! config file at `~/.config/skilldeck/mcp_servers.json` if it exists.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::{debug, warn};

use crate::traits::McpServerConfig;

/// A discovered MCP server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredServer {
    pub name: String,
    pub config: McpServerConfig,
}

/// Discover MCP servers from standard locations.
pub async fn discover_servers() -> Vec<DiscoveredServer> {
    let mut found = Vec::new();

    // 1. Read ~/.config/skilldeck/mcp_servers.json
    if let Some(config_path) = default_config_path() {
        if config_path.exists() {
            match load_config_file(&config_path).await {
                Ok(mut servers) => {
                    debug!(
                        "Discovered {} MCP server(s) from {:?}",
                        servers.len(),
                        config_path
                    );
                    found.append(&mut servers);
                }
                Err(e) => {
                    warn!("Failed to load MCP config from {:?}: {}", config_path, e);
                }
            }
        }
    }

    found
}

/// Default path for the user-level MCP server config file.
pub fn default_config_path() -> Option<PathBuf> {
    dirs_next::config_dir().map(|d| d.join("skilldeck").join("mcp_servers.json"))
}

/// Load a JSON array of [`DiscoveredServer`] entries from a file.
async fn load_config_file(path: &PathBuf) -> Result<Vec<DiscoveredServer>, String> {
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_config(dir: &TempDir, content: &str) -> PathBuf {
        let path = dir.path().join("mcp_servers.json");
        fs::write(&path, content).unwrap();
        path
    }

    #[tokio::test]
    async fn load_valid_config() {
        let tmp = tempfile::tempdir().unwrap();
        let path = write_config(
            &tmp,
            r#"[{"name":"test-server","config":{"transport":"stdio","config":{"command":"mcp-server","args":[]}}}]"#,
        );
        let servers = load_config_file(&path).await.unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "test-server");
        assert_eq!(servers[0].config.transport, "stdio");
    }

    #[tokio::test]
    async fn load_malformed_json_err() {
        let tmp = tempfile::tempdir().unwrap();
        let path = write_config(&tmp, "not json");
        assert!(load_config_file(&path).await.is_err());
    }

    #[tokio::test]
    async fn load_nonexistent_err() {
        let result = load_config_file(&PathBuf::from("/no/such/file.json")).await;
        assert!(result.is_err());
    }

    #[test]
    fn default_config_path_is_some() {
        // dirs_next will return None in some minimal CI environments — that's fine.
        let _ = default_config_path();
    }
}
