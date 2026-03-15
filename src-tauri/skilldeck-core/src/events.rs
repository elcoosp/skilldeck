//! Event types emitted from the Rust core to the React frontend via Tauri IPC.
//!
//! `WorkflowEvent` is re-exported here for convenience even though it lives in
//! the workflow module — the executor emits it on an internal channel.
pub use crate::workflow::types::WorkflowEvent;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// All events the Rust core can emit to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    /// A token chunk streamed from the model.
    TokenChunk {
        conversation_id: Uuid,
        message_id: Uuid,
        delta: String,
    },
    /// The agent has begun processing a new turn.
    TurnStarted {
        conversation_id: Uuid,
        message_id: Uuid,
    },
    /// The agent completed a turn.
    TurnCompleted {
        conversation_id: Uuid,
        message_id: Uuid,
        input_tokens: u32,
        output_tokens: u32,
    },
    /// The agent encountered an error.
    TurnError {
        conversation_id: Uuid,
        message_id: Uuid,
        error_code: String,
        message: String,
        suggested_action: Option<String>,
    },
    /// An MCP tool call was dispatched.
    ToolCallStarted {
        conversation_id: Uuid,
        message_id: Uuid,
        tool_name: String,
        server_name: String,
    },
    /// An MCP tool call returned a result.
    ToolCallCompleted {
        conversation_id: Uuid,
        message_id: Uuid,
        tool_name: String,
        is_error: bool,
    },
    /// The agent requires user approval before executing a tool.
    ToolApprovalRequired {
        conversation_id: Uuid,
        approval_id: Uuid,
        tool_name: String,
        server_name: String,
        arguments: serde_json::Value,
    },
    /// A subagent was spawned for parallel execution.
    SubagentSpawned {
        parent_session_id: Uuid,
        child_session_id: Uuid,
    },
    /// A subagent completed its work.
    SubagentCompleted { session_id: Uuid, success: bool },
    /// Skill registry was reloaded (file watcher triggered).
    SkillsReloaded { source: String, count: usize },
    /// An MCP server changed health status.
    McpServerStatus {
        server_name: String,
        status: McpServerStatus,
    },
}

/// Health status of an MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpServerStatus {
    Connecting,
    Connected,
    Disconnected,
    Restarting { attempt: u32 },
    Failed,
}
