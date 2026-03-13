//! Typed IPC event payloads emitted from Rust to the React frontend.
//!
//! All event names use kebab-case and match the listeners in `src/lib/events.ts`.

use serde::{Deserialize, Serialize};

// ── Agent events ─────────────────────────────────────────────────────────────

/// Payload for the `"agent-event"` Tauri channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Started {
        conversation_id: String,
    },
    Token {
        conversation_id: String,
        delta: String,
    },
    ToolCall {
        conversation_id: String,
        tool_call: AgentToolCall,
    },
    ToolResult {
        conversation_id: String,
        tool_call_id: String,
        result: String,
    },
    Done {
        conversation_id: String,
        input_tokens: u32,
        output_tokens: u32,
    },
    Error {
        conversation_id: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

// ── MCP events ────────────────────────────────────────────────────────────────

/// Payload for the `"mcp-event"` Tauri channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum McpEvent {
    ServerConnected { name: String },
    ServerDisconnected { name: String },
    ToolDiscovered { server: String, tool: McpToolInfo },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolInfo {
    pub name: String,
    pub description: String,
}

// ── Workflow events ───────────────────────────────────────────────────────────

/// Payload for the `"workflow-event"` Tauri channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkflowEvent {
    Started {
        id: String,
    },
    StepStarted {
        workflow_id: String,
        step_id: String,
    },
    StepCompleted {
        workflow_id: String,
        step_id: String,
        result: Option<String>,
    },
    Completed {
        id: String,
    },
    Failed {
        id: String,
        message: String,
    },
}
