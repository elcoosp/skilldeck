//! Dependency Inversion Principle (DIP) trait definitions.
//!
//! All major subsystem boundaries are expressed as traits here, enabling:
//! - Testability via mock implementations
//! - Provider extensibility (Claude, OpenAI, Ollama, …)
//! - Transport extensibility (stdio, SSE, …)

pub mod model_provider;
pub mod mcp_transport;
pub mod skill_loader;
pub mod database;

pub use model_provider::{CompletionChunk, CompletionRequest, CompletionStream, ModelProvider};
pub use mcp_transport::{McpCallResult, McpServerConfig, McpSession, McpTool, McpTransport};
pub use skill_loader::{Skill, SkillLoader, SkillSource};
pub use database::Database;


