//! MCP server registry — tracks live connections and dispatches tool calls.

use dashmap::DashMap;
use parking_lot::RwLock;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    CoreError,
    mcp::McpServerConfig,
    traits::{McpCallResult as McpToolResult, McpCapabilities, McpSession, McpTool},
};

// ── Status ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ServerStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
    /// Terminal state: max restart attempts exceeded; no more retries.
    Failed,
}

// ── Live server record ────────────────────────────────────────────────────────

pub struct LiveServer {
    pub id: Uuid,
    pub name: String,
    pub status: ServerStatus,
    pub session: Option<Arc<McpSession>>,
    pub error_count: u32,
    pub last_error: Option<String>,
    pub tools: Vec<McpTool>,
    pub capabilities: McpCapabilities,
}

impl Clone for LiveServer {
    fn clone(&self) -> Self {
        Self {
            id: self.id,
            name: self.name.clone(),
            status: self.status.clone(),
            session: self.session.clone(),
            error_count: self.error_count,
            last_error: self.last_error.clone(),
            tools: self.tools.clone(),
            capabilities: self.capabilities.clone(),
        }
    }
}

// ── Registry ──────────────────────────────────────────────────────────────────

pub struct McpRegistry {
    servers: DashMap<Uuid, LiveServer>,
    /// Stored configs keyed by server id, used by the supervisor to reconnect.
    pub stored_configs: DashMap<Uuid, McpServerConfig>,
    /// RwLock so transports can be registered through &self (e.g. through Arc).
    /// Arc wrapping lets us clone a handle out before dropping the lock,
    /// which is required to avoid holding the guard across an .await point.
    transports: RwLock<Vec<Arc<dyn crate::traits::McpTransport + Send + Sync>>>,
}

impl McpRegistry {
    pub fn new() -> Self {
        Self {
            servers: DashMap::new(),
            stored_configs: DashMap::new(),
            transports: RwLock::new(vec![]),
        }
    }

    /// Register a transport through a shared reference — works through `Arc<McpRegistry>`.
    pub fn register_transport(
        &self,
        transport: impl crate::traits::McpTransport + Send + Sync + 'static,
    ) {
        self.transports.write().push(Arc::new(transport));
    }

    /// Register a server under a *caller-supplied* UUID (e.g. the persisted DB id).
    pub fn add_server_with_id(&self, id: Uuid, name: String, config: McpServerConfig) {
        if self.servers.contains_key(&id) {
            return;
        }
        self.servers.insert(
            id,
            LiveServer {
                id,
                name,
                status: ServerStatus::Disconnected,
                session: None,
                error_count: 0,
                last_error: None,
                tools: Vec::new(),
                capabilities: McpCapabilities::default(),
            },
        );
        self.stored_configs.insert(id, config);
    }

    /// Register a server without connecting yet, storing the config for later reconnects.
    pub fn add_server(&self, name: String, config: McpServerConfig) -> Uuid {
        let id = Uuid::new_v4();
        self.stored_configs.insert(id, config);
        self.servers.insert(
            id,
            LiveServer {
                id,
                name,
                status: ServerStatus::Disconnected,
                session: None,
                error_count: 0,
                last_error: None,
                tools: Vec::new(),
                capabilities: McpCapabilities::default(),
            },
        );
        id
    }

    /// Connect a previously-registered server, storing the config for future reconnects.
    pub async fn connect(&self, id: Uuid, config: McpServerConfig) -> Result<(), CoreError> {
        self.stored_configs.insert(id, config.clone());

        {
            let mut entry = self
                .servers
                .get_mut(&id)
                .ok_or(CoreError::McpServerNotFound { server_id: id })?;
            entry.status = ServerStatus::Connecting;
        }

        let server_name = self
            .servers
            .get(&id)
            .map(|s| s.name.clone())
            .ok_or(CoreError::McpServerNotFound { server_id: id })?;

        // Clone an Arc handle to the matching transport, then drop the read
        // guard immediately — parking_lot guards are !Send so they cannot be
        // held across an .await point.
        let transport: Arc<dyn crate::traits::McpTransport + Send + Sync> = {
            let transports = self.transports.read();
            transports
                .iter()
                .find(|t| t.supports(&config))
                .cloned()
                .ok_or_else(|| CoreError::InvalidConfiguration {
                    message: format!("No transport registered for type: {}", config.transport),
                })?
        }; // guard dropped here

        match transport.connect(&config, &server_name).await {
            Ok(session) => {
                let mut entry = self.servers.get_mut(&id).unwrap();
                entry.tools = session.tools.clone();
                entry.capabilities = session.capabilities.clone();
                entry.session = Some(Arc::new(session));
                entry.status = ServerStatus::Connected;
                entry.error_count = 0;
                entry.last_error = None;
                Ok(())
            }
            Err(e) => {
                if let Some(mut entry) = self.servers.get_mut(&id) {
                    entry.status = ServerStatus::Error;
                    entry.error_count += 1;
                    entry.last_error = Some(e.to_string());
                }
                Err(e)
            }
        }
    }

    pub fn disconnect(&self, id: Uuid) {
        if let Some(mut entry) = self.servers.get_mut(&id) {
            entry.session = None;
            entry.status = ServerStatus::Disconnected;
        }
    }

    /// Promote a server to `Failed` — supervisor calls this when max attempts exceeded.
    pub fn mark_failed(&self, id: Uuid) {
        if let Some(mut entry) = self.servers.get_mut(&id) {
            entry.session = None;
            entry.status = ServerStatus::Failed;
        }
    }

    pub fn get(&self, id: Uuid) -> Option<LiveServer> {
        self.servers.get(&id).map(|s| s.clone())
    }

    pub fn list(&self) -> Vec<LiveServer> {
        self.servers.iter().map(|s| s.clone()).collect()
    }

    /// Collect tools from all connected servers, tagged with the server name.
    pub fn all_tools(&self) -> Vec<(String, McpTool)> {
        self.servers
            .iter()
            .filter(|s| s.status == ServerStatus::Connected)
            .flat_map(|s| {
                let name = s.name.clone();
                s.tools
                    .iter()
                    .map(move |t| (name.clone(), t.clone()))
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    /// Call a tool on the named server.
    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<McpToolResult, CoreError> {
        let entry = self
            .servers
            .iter()
            .find(|s| s.name == server_name && s.status == ServerStatus::Connected)
            .ok_or_else(|| CoreError::McpToolNotFound {
                server_name: server_name.to_string(),
                tool_name: tool_name.to_string(),
            })?;

        let session = entry
            .session
            .as_ref()
            .ok_or_else(|| CoreError::McpDisconnected {
                server_name: server_name.to_string(),
                message: "No active session".to_string(),
            })?;

        session.call_tool(tool_name, arguments).await
    }
}

impl Default for McpRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_server_disconnected() {
        let r = McpRegistry::new();
        let id = r.add_server(
            "test-server".into(),
            McpServerConfig {
                transport: "stdio".into(),
                config: serde_json::json!({}),
            },
        );
        let s = r.get(id).unwrap();
        assert_eq!(s.name, "test-server");
        assert_eq!(s.status, ServerStatus::Disconnected);
    }

    #[test]
    fn add_server_stores_config() {
        let r = McpRegistry::new();
        let cfg = McpServerConfig {
            transport: "stdio".into(),
            config: serde_json::json!({"cmd": "echo"}),
        };
        let id = r.add_server("s".into(), cfg.clone());
        assert!(r.stored_configs.get(&id).is_some());
    }

    #[test]
    fn list_servers() {
        let r = McpRegistry::new();
        r.add_server(
            "s1".into(),
            McpServerConfig {
                transport: "stdio".into(),
                config: serde_json::json!({}),
            },
        );
        r.add_server(
            "s2".into(),
            McpServerConfig {
                transport: "sse".into(),
                config: serde_json::json!({}),
            },
        );
        assert_eq!(r.list().len(), 2);
    }

    #[test]
    fn all_tools_empty_when_disconnected() {
        let r = McpRegistry::new();
        r.add_server(
            "s".into(),
            McpServerConfig {
                transport: "stdio".into(),
                config: serde_json::json!({}),
            },
        );
        assert!(r.all_tools().is_empty());
    }

    #[test]
    fn disconnect_clears_session() {
        let r = McpRegistry::new();
        let id = r.add_server(
            "s".into(),
            McpServerConfig {
                transport: "stdio".into(),
                config: serde_json::json!({}),
            },
        );
        r.disconnect(id);
        let s = r.get(id).unwrap();
        assert_eq!(s.status, ServerStatus::Disconnected);
        assert!(s.session.is_none());
    }

    #[test]
    fn mark_failed_transitions_to_failed() {
        let r = McpRegistry::new();
        let id = r.add_server(
            "s".into(),
            McpServerConfig {
                transport: "stdio".into(),
                config: serde_json::json!({}),
            },
        );
        r.mark_failed(id);
        let s = r.get(id).unwrap();
        assert_eq!(s.status, ServerStatus::Failed);
    }

    #[test]
    fn register_transport_through_arc() {
        use crate::traits::{McpServerConfig, McpSession, McpTransport};
        use async_trait::async_trait;

        struct DummyTransport;
        #[async_trait]
        impl McpTransport for DummyTransport {
            async fn connect(&self, _: &McpServerConfig, _: &str) -> Result<McpSession, CoreError> {
                Err(CoreError::NotImplemented {
                    feature: "dummy".into(),
                })
            }
            fn supports(&self, c: &McpServerConfig) -> bool {
                c.transport == "dummy"
            }
        }

        let r = Arc::new(McpRegistry::new());
        r.register_transport(DummyTransport); // &self + Send+Sync bound, works through Arc
        assert_eq!(r.transports.read().len(), 1);
    }
}
