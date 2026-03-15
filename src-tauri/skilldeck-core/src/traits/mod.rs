//! Dependency Inversion Principle (DIP) trait definitions.

pub mod database;
pub mod mcp_transport;
pub mod model_provider;
pub mod skill_loader;
pub mod sync_backend;

pub use database::{Database, SeaOrmDatabase};
pub use mcp_transport::{
    McpCallResult, McpCapabilities, McpContent, McpResource, McpServerConfig, McpSession,
    McpSessionInner, McpTool, McpTransport,
};
pub use model_provider::{
    ChatMessage, CompletionChunk, CompletionRequest, CompletionResult, CompletionStream,
    FinishReason, FunctionCall, MessageRole, ModelCapabilities, ModelInfo, ModelParams,
    ModelProvider, TokenUsage, ToolCall, ToolDefinition,
};
pub use skill_loader::{Skill, SkillLoader, SkillManifest, SkillSource};
pub use sync_backend::{
    Changeset, ConflictResolution, NoOpSyncBackend, PushResult, SyncBackend, SyncConflict,
    SyncOperation, SyncRecord,
};
