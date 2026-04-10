//! Core event types (not Tauri-specific).

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::markdown::types::{ArtifactSpec, NodeDocument, TocItem};

// ── Agent events ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Cancelled {
        conversation_id: String,
    },
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
    Persisted {
        conversation_id: String,
    },
    StreamUpdate {
        conversation_id: String,
        document: NodeDocument,
        new_toc_items: Vec<TocItem>,
        new_artifact_specs: Vec<ArtifactSpec>,
    },
    ProviderNotReady {
        conversation_id: String,
        reason: String,
        fix_action: String,
    },
    ThinkingStreamUpdate {
        conversation_id: String,
        document: NodeDocument,
    },
    ThinkingDone {
        conversation_id: String,
        document: NodeDocument,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AgentToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

// ── MCP events ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum McpEvent {
    ServerConnected { name: String },
    ServerDisconnected { name: String },
    ServerFailed { name: String, message: String },
    ToolDiscovered { server: String, tool: McpToolInfo },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct McpToolInfo {
    pub name: String,
    pub description: String,
}

// ── Workflow events ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    StepFailed {
        workflow_id: String,
        step_id: String,
        error: String,
    },
    Completed {
        id: String,
    },
    Failed {
        id: String,
        error: String,
    },
}
