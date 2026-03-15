//! # skilldeck-core
//!
//! The core library for SkillDeck — all business logic, zero Tauri dependency.
//!
//! ## Architecture
//!
//! - [`error`]     — Core error taxonomy
//! - [`db`]        — SQLite connection and migrations
//! - [`models`]    — SeaORM entity models
//! - [`traits`]    — Dependency inversion interfaces
//! - [`providers`] — Model provider implementations
//! - [`skills`]    — Skill loading, resolution, and watching
//! - [`mcp`]       — MCP client and supervision
//! - [`agent`]     — Agent loop and tool dispatch
//! - [`workflow`]  — Workflow execution engine
//! - [`workspace`] — Workspace detection and context
//! - [`events`]    — IPC event types

pub mod agent;
pub mod db;
pub mod error;
pub mod events;
pub mod mcp;
pub mod providers;
pub mod search;
pub mod skills;
pub mod toon;
pub mod traits;
pub mod workflow;
pub mod workspace;

// Re-export commonly used types.
pub use db::{SqliteDatabase, open_db};
pub use error::CoreError;
pub use events::AgentEvent;
pub use traits::{
    // model provider
    ChatMessage,
    CompletionChunk,
    CompletionRequest,
    CompletionResult,
    CompletionStream,
    // database
    Database,
    FinishReason,
    FunctionCall,
    // mcp
    McpCallResult,
    McpCapabilities,
    McpContent,
    McpResource,
    McpServerConfig,
    McpSession,
    McpTool,
    McpTransport,
    MessageRole,
    ModelCapabilities,
    ModelInfo,
    ModelParams,
    ModelProvider,
    // sync (v2 stub)
    NoOpSyncBackend,
    SeaOrmDatabase,
    // skills
    Skill,
    SkillLoader,
    SkillManifest,
    SkillSource,
    SyncBackend,
    TokenUsage,
    ToolCall,
    ToolDefinition,
};

use std::sync::Arc;

/// Top-level runtime registry that wires together all subsystems.
///
/// Constructed once at application startup and shared via [`Arc`] throughout
/// the Tauri shell.
pub struct Registry {
    pub db: Arc<dyn Database>,
    pub mcp_registry: Arc<mcp::McpRegistry>,
    pub skill_registry: Arc<skills::SkillRegistry>,
    providers: dashmap::DashMap<String, Arc<dyn ModelProvider>>,
}

impl Registry {
    /// Create a new registry backed by `db`.
    pub fn new(db: impl Database + 'static) -> Self {
        Self {
            db: Arc::new(db),
            providers: dashmap::DashMap::new(),
            mcp_registry: Arc::new(mcp::McpRegistry::new()),
            skill_registry: Arc::new(skills::SkillRegistry::new()),
        }
    }
    /// Create a registry using a pre-built [`McpRegistry`].
    ///
    /// Use when you need to register transports before wrapping in `Arc`
    /// (transports require `&mut self` which is unavailable through `Arc`).
    pub fn with_mcp_registry(db: impl Database + 'static, mcp_registry: mcp::McpRegistry) -> Self {
        Self {
            db: Arc::new(db),
            providers: dashmap::DashMap::new(),
            mcp_registry: Arc::new(mcp_registry),
            skill_registry: Arc::new(skills::SkillRegistry::new()),
        }
    }
    /// Register a model provider.
    pub fn register_provider(&self, provider: impl ModelProvider + 'static) {
        let id = provider.id().to_string();
        self.providers.insert(id, Arc::new(provider));
    }

    /// Retrieve a model provider by its ID.
    pub fn get_provider(&self, id: &str) -> Option<Arc<dyn ModelProvider>> {
        self.providers.get(id).map(|r| Arc::clone(r.value()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use futures::stream;

    struct MockDb;

    #[async_trait]
    impl Database for MockDb {
        async fn connection(&self) -> Result<&sea_orm::DatabaseConnection, CoreError> {
            Err(CoreError::NotImplemented {
                feature: "MockDb::connection".into(),
            })
        }
    }

    #[test]
    fn registry_creation_compiles() {
        let _registry = Registry::new(MockDb);
    }

    #[test]
    fn provider_round_trip() {
        use crate::traits::{CompletionRequest, CompletionStream, ModelInfo};

        struct NoopProvider;

        #[async_trait]
        impl ModelProvider for NoopProvider {
            fn id(&self) -> &str {
                "noop"
            }
            fn display_name(&self) -> &str {
                "Noop"
            }
            fn supports_toon(&self) -> bool {
                false
            }

            async fn list_models(&self) -> Result<Vec<ModelInfo>, CoreError> {
                Ok(vec![])
            }

            async fn complete(
                &self,
                _request: CompletionRequest,
            ) -> Result<CompletionStream, CoreError> {
                // Return an empty stream
                let empty: CompletionStream = Box::pin(stream::empty());
                Ok(empty)
            }
        }

        let registry = Registry::new(MockDb);
        registry.register_provider(NoopProvider);
        assert!(registry.get_provider("noop").is_some());
        assert!(registry.get_provider("missing").is_none());
    }
}
