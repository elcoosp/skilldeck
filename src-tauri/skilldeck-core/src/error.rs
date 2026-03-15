//! Core error types for the skilldeck-core crate.
//!
//! This module defines a comprehensive error taxonomy that covers all failure modes
//! in the system. Each variant provides enough context for meaningful error messages
//! and potential recovery actions.

use thiserror::Error;

/// The main error type for the skilldeck-core library.
///
/// This error type is designed to be:
/// - **Specific**: Each variant represents a distinct failure mode
/// - **Actionable**: Error messages include context for debugging
/// - **Propagable**: Works well with `?` operator and `anyhow`
/// - **Serializable**: Can be sent across the Tauri IPC boundary
#[derive(Debug, Error)]
pub enum CoreError {
    // =========================================================================
    // Model Provider Errors
    // =========================================================================
    #[error("Model provider '{provider}' rejected request: {message}")]
    ModelRequestRejected { provider: String, message: String },

    #[error("Model provider '{provider}' rate limited. Retry after {retry_after_ms}ms")]
    ModelRateLimited {
        provider: String,
        retry_after_ms: u64,
    },

    #[error("Model provider '{provider}' internal error: {message}")]
    ModelInternal { provider: String, message: String },

    #[error("Model provider '{provider}' connection failed: {message}")]
    ModelConnection { provider: String, message: String },

    #[error("Model provider '{provider}' returned invalid response: {message}")]
    ModelInvalidResponse { provider: String, message: String },

    #[error("Model provider '{provider}' authentication failed: {message}")]
    ModelAuthentication { provider: String, message: String },

    #[error("Model provider '{provider}' request timed out after {timeout_ms}ms")]
    ModelTimeout { provider: String, timeout_ms: u64 },

    // =========================================================================
    // MCP Errors
    // =========================================================================
    #[error("MCP server '{server_id}' not found")]
    McpServerNotFound { server_id: uuid::Uuid },

    #[error("MCP server '{server_name}' connection failed: {message}")]
    McpConnectionFailed {
        server_name: String,
        message: String,
    },

    #[error("MCP server '{server_name}' disconnected: {message}")]
    McpDisconnected {
        server_name: String,
        message: String,
    },

    #[error("MCP tool '{tool_name}' not found on server '{server_name}'")]
    McpToolNotFound {
        server_name: String,
        tool_name: String,
    },

    #[error("MCP tool '{tool_name}' execution failed: {message}")]
    McpToolExecution { tool_name: String, message: String },

    #[error("MCP tool '{tool_name}' timed out after {timeout_ms}ms")]
    McpToolTimeout { tool_name: String, timeout_ms: u64 },

    #[error("MCP JSON-RPC error (code {code}): {message}")]
    McpJsonRpc { code: i32, message: String },

    #[error("MCP server '{server_name}' exceeded max restart attempts ({attempts})")]
    McpMaxRestarts { server_name: String, attempts: u32 },

    // =========================================================================
    // Skill Errors
    // =========================================================================
    #[error("Skill file not found at '{path}'")]
    SkillNotFound { path: std::path::PathBuf },

    #[error("Failed to parse skill '{name}': {message}")]
    SkillParse { name: String, message: String },

    #[error("Invalid YAML frontmatter in skill '{path}': {message}")]
    SkillInvalidYaml {
        path: std::path::PathBuf,
        message: String,
    },

    #[error("Skill '{name}' not found in registry")]
    SkillNotInRegistry { name: String },

    #[error("Skill directory traversal not allowed: '{path}'")]
    SkillTraversalNotAllowed { path: std::path::PathBuf },

    #[error("Skill source directory '{path}' not found")]
    SkillSourceNotFound { path: std::path::PathBuf },

    // =========================================================================
    // Workflow Errors
    // =========================================================================
    #[error("Workflow contains a cycle: {cycle_path}")]
    WorkflowCycle { cycle_path: String },

    #[error("Workflow step '{step_id}' not found")]
    WorkflowStepNotFound { step_id: uuid::Uuid },

    #[error("Workflow execution failed at step '{step_name}': {message}")]
    WorkflowExecution { step_name: String, message: String },

    #[error("Invalid workflow definition: {message}")]
    WorkflowInvalidDefinition { message: String },

    #[error("Failed to spawn subagent: {message}")]
    SubagentSpawn { message: String },

    #[error("Subagent '{session_id}' execution failed: {message}")]
    SubagentExecution {
        session_id: uuid::Uuid,
        message: String,
    },

    #[error("Maximum subagent depth ({max_depth}) exceeded")]
    SubagentMaxDepth { max_depth: u32 },

    // =========================================================================
    // Database Errors
    // =========================================================================
    #[error("Database connection failed: {message}")]
    DatabaseConnection { message: String },

    #[error("Database query failed: {message}")]
    DatabaseQuery { message: String },

    #[error("Database migration failed: {message}")]
    DatabaseMigration { message: String },

    #[error("{entity_type} with id '{id}' not found")]
    DatabaseEntityNotFound { entity_type: String, id: String },

    #[error("Database transaction failed: {message}")]
    DatabaseTransaction { message: String },

    // =========================================================================
    // Workspace Errors
    // =========================================================================
    #[error("Workspace '{path}' not found")]
    WorkspaceNotFound { path: std::path::PathBuf },

    #[error("Failed to detect workspace type: {message}")]
    WorkspaceDetection { message: String },

    #[error("Workspace context file '{filename}' not found")]
    WorkspaceContextNotFound { filename: String },

    // =========================================================================
    // I/O Errors
    // =========================================================================
    #[error("File operation failed for '{path}': {message}")]
    FileOperation {
        path: std::path::PathBuf,
        message: String,
    },

    #[error("Permission denied for '{path}'")]
    FilePermissionDenied { path: std::path::PathBuf },

    #[error("Directory operation failed for '{path}': {message}")]
    DirectoryOperation {
        path: std::path::PathBuf,
        message: String,
    },

    // =========================================================================
    // Internal Errors
    // =========================================================================
    #[error("Internal error: {message}")]
    Internal { message: String },

    #[error("Operation cancelled: {operation}")]
    Cancelled { operation: String },

    #[error("Feature not implemented: {feature}")]
    NotImplemented { feature: String },

    #[error("Invalid configuration: {message}")]
    InvalidConfiguration { message: String },

    #[error("Channel error: {message}")]
    Channel { message: String },

    #[error("Lock acquisition failed: {resource}")]
    LockAcquisition { resource: String },
}

// =============================================================================
// From Implementations
// =============================================================================

impl From<std::io::Error> for CoreError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::PermissionDenied => CoreError::FilePermissionDenied {
                path: std::path::PathBuf::new(),
            },
            _ => CoreError::FileOperation {
                path: std::path::PathBuf::new(),
                message: err.to_string(),
            },
        }
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(err: serde_json::Error) -> Self {
        CoreError::Internal {
            message: format!("JSON error: {err}"),
        }
    }
}

impl From<serde_yaml::Error> for CoreError {
    fn from(err: serde_yaml::Error) -> Self {
        CoreError::Internal {
            message: format!("YAML error: {err}"),
        }
    }
}

impl From<sea_orm::DbErr> for CoreError {
    fn from(err: sea_orm::DbErr) -> Self {
        match &err {
            sea_orm::DbErr::RecordNotFound(msg) => CoreError::DatabaseEntityNotFound {
                entity_type: "Record".to_string(),
                id: msg.clone(),
            },
            sea_orm::DbErr::ConnectionAcquire(_) => CoreError::DatabaseConnection {
                message: err.to_string(),
            },
            _ => CoreError::DatabaseQuery {
                message: err.to_string(),
            },
        }
    }
}

impl From<tokio::task::JoinError> for CoreError {
    fn from(err: tokio::task::JoinError) -> Self {
        CoreError::Internal {
            message: format!("Task join error: {err}"),
        }
    }
}

// =============================================================================
// Helper Methods
// =============================================================================

impl CoreError {
    /// Returns true if this error is retryable.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            CoreError::ModelRateLimited { .. }
                | CoreError::ModelConnection { .. }
                | CoreError::ModelTimeout { .. }
                | CoreError::McpDisconnected { .. }
                | CoreError::McpToolTimeout { .. }
                | CoreError::DatabaseConnection { .. }
        )
    }

    /// Returns the suggested retry delay in milliseconds, if applicable.
    pub fn retry_after_ms(&self) -> Option<u64> {
        match self {
            CoreError::ModelRateLimited { retry_after_ms, .. } => Some(*retry_after_ms),
            CoreError::McpToolTimeout { timeout_ms, .. } => Some(*timeout_ms),
            _ => None,
        }
    }

    /// Returns a user-friendly error code for the frontend.
    pub fn error_code(&self) -> &'static str {
        match self {
            // Model errors
            CoreError::ModelRequestRejected { .. } => "MODEL_REQUEST_REJECTED",
            CoreError::ModelRateLimited { .. } => "MODEL_RATE_LIMITED",
            CoreError::ModelInternal { .. } => "MODEL_INTERNAL",
            CoreError::ModelConnection { .. } => "MODEL_CONNECTION",
            CoreError::ModelInvalidResponse { .. } => "MODEL_INVALID_RESPONSE",
            CoreError::ModelAuthentication { .. } => "MODEL_AUTHENTICATION",
            CoreError::ModelTimeout { .. } => "MODEL_TIMEOUT",
            // MCP errors
            CoreError::McpServerNotFound { .. } => "MCP_SERVER_NOT_FOUND",
            CoreError::McpConnectionFailed { .. } => "MCP_CONNECTION_FAILED",
            CoreError::McpDisconnected { .. } => "MCP_DISCONNECTED",
            CoreError::McpToolNotFound { .. } => "MCP_TOOL_NOT_FOUND",
            CoreError::McpToolExecution { .. } => "MCP_TOOL_EXECUTION",
            CoreError::McpToolTimeout { .. } => "MCP_TOOL_TIMEOUT",
            CoreError::McpJsonRpc { .. } => "MCP_JSON_RPC",
            CoreError::McpMaxRestarts { .. } => "MCP_MAX_RESTARTS",
            // Skill errors
            CoreError::SkillNotFound { .. } => "SKILL_NOT_FOUND",
            CoreError::SkillParse { .. } => "SKILL_PARSE",
            CoreError::SkillInvalidYaml { .. } => "SKILL_INVALID_YAML",
            CoreError::SkillNotInRegistry { .. } => "SKILL_NOT_IN_REGISTRY",
            CoreError::SkillTraversalNotAllowed { .. } => "SKILL_TRAVERSAL_NOT_ALLOWED",
            CoreError::SkillSourceNotFound { .. } => "SKILL_SOURCE_NOT_FOUND",
            // Workflow errors
            CoreError::WorkflowCycle { .. } => "WORKFLOW_CYCLE",
            CoreError::WorkflowStepNotFound { .. } => "WORKFLOW_STEP_NOT_FOUND",
            CoreError::WorkflowExecution { .. } => "WORKFLOW_EXECUTION",
            CoreError::WorkflowInvalidDefinition { .. } => "WORKFLOW_INVALID_DEFINITION",
            CoreError::SubagentSpawn { .. } => "SUBAGENT_SPAWN",
            CoreError::SubagentExecution { .. } => "SUBAGENT_EXECUTION",
            CoreError::SubagentMaxDepth { .. } => "SUBAGENT_MAX_DEPTH",
            // Database errors
            CoreError::DatabaseConnection { .. } => "DATABASE_CONNECTION",
            CoreError::DatabaseQuery { .. } => "DATABASE_QUERY",
            CoreError::DatabaseMigration { .. } => "DATABASE_MIGRATION",
            CoreError::DatabaseEntityNotFound { .. } => "DATABASE_ENTITY_NOT_FOUND",
            CoreError::DatabaseTransaction { .. } => "DATABASE_TRANSACTION",
            // Workspace errors
            CoreError::WorkspaceNotFound { .. } => "WORKSPACE_NOT_FOUND",
            CoreError::WorkspaceDetection { .. } => "WORKSPACE_DETECTION",
            CoreError::WorkspaceContextNotFound { .. } => "WORKSPACE_CONTEXT_NOT_FOUND",
            // I/O errors
            CoreError::FileOperation { .. } => "FILE_OPERATION",
            CoreError::FilePermissionDenied { .. } => "FILE_PERMISSION_DENIED",
            CoreError::DirectoryOperation { .. } => "DIRECTORY_OPERATION",
            // Internal errors
            CoreError::Internal { .. } => "INTERNAL",
            CoreError::Cancelled { .. } => "CANCELLED",
            CoreError::NotImplemented { .. } => "NOT_IMPLEMENTED",
            CoreError::InvalidConfiguration { .. } => "INVALID_CONFIGURATION",
            CoreError::Channel { .. } => "CHANNEL",
            CoreError::LockAcquisition { .. } => "LOCK_ACQUISITION",
        }
    }

    /// Returns a suggested action for the user.
    pub fn suggested_action(&self) -> Option<&'static str> {
        match self {
            CoreError::ModelRateLimited { .. } => Some("Wait a moment and try again"),
            CoreError::ModelAuthentication { .. } => Some("Check your API key in settings"),
            CoreError::ModelTimeout { .. } => Some("Try again with a shorter message"),
            CoreError::McpConnectionFailed { .. } => Some("Check if the MCP server is running"),
            CoreError::McpMaxRestarts { .. } => Some("Restart the MCP server manually"),
            CoreError::SkillNotFound { .. } => Some("Check the skill file path"),
            CoreError::SkillInvalidYaml { .. } => Some("Fix the YAML frontmatter in SKILL.md"),
            CoreError::FilePermissionDenied { .. } => Some("Check file permissions"),
            CoreError::DatabaseEntityNotFound { .. } => Some("The item may have been deleted"),
            _ => None,
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_code_consistency() {
        let errors: Vec<CoreError> = vec![
            CoreError::ModelRequestRejected {
                provider: "test".into(),
                message: "test".into(),
            },
            CoreError::ModelRateLimited {
                provider: "test".into(),
                retry_after_ms: 1000,
            },
            CoreError::McpServerNotFound {
                server_id: uuid::Uuid::nil(),
            },
            CoreError::SkillNotFound {
                path: std::path::PathBuf::new(),
            },
            CoreError::WorkflowCycle {
                cycle_path: "A -> B".into(),
            },
            CoreError::DatabaseConnection {
                message: "test".into(),
            },
            CoreError::Internal {
                message: "test".into(),
            },
        ];

        for err in errors {
            assert!(!err.error_code().is_empty());
        }
    }

    #[test]
    fn retryable_classification() {
        let retryable = CoreError::ModelRateLimited {
            provider: "test".into(),
            retry_after_ms: 1000,
        };
        assert!(retryable.is_retryable());

        let not_retryable = CoreError::ModelAuthentication {
            provider: "test".into(),
            message: "Invalid key".into(),
        };
        assert!(!not_retryable.is_retryable());
    }

    #[test]
    fn suggested_action_present_for_common_errors() {
        let rate_limited = CoreError::ModelRateLimited {
            provider: "test".into(),
            retry_after_ms: 1000,
        };
        assert!(rate_limited.suggested_action().is_some());

        let auth_failed = CoreError::ModelAuthentication {
            provider: "test".into(),
            message: "Invalid key".into(),
        };
        assert!(auth_failed.suggested_action().is_some());
    }
}
