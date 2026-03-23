// src-tauri/skilldeck-core/src/traits/tool_approval_emitter.rs
use serde_json::Value;

/// Trait for emitting tool approval requests from the core to the shell (Tauri).
pub trait ToolApprovalEmitter: Send + Sync {
    /// Emit a request for user approval of a tool call.
    fn emit_tool_approval_required(
        &self,
        conversation_id: &str,
        tool_call_id: &str,
        tool_name: &str,
        arguments: &Value,
    );
}
