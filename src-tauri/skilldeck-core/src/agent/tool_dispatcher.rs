//! Tool dispatcher — routes ToolCall events to built-ins, MCP servers, or
//! through an approval gate for external side-effecting tools.

use std::sync::Arc;
use serde_json::Value;
use tokio::sync::oneshot;

use crate::{
    CoreError,
    mcp::registry::McpRegistry,
    traits::{McpCallResult, ToolCall},
};

// ── Approval gate ─────────────────────────────────────────────────────────────

/// Outcome of an approval request.
#[derive(Debug, Clone)]
pub enum ApprovalResult {
    /// User approved, optionally with edited input arguments.
    Approved { edited_input: Option<Value> },
    /// User denied the call.
    Denied { reason: Option<String> },
    /// Approval dialog was cancelled (e.g. conversation ended).
    Cancelled,
}

/// Async approval gate.  Pending requests are keyed by `tool_call_id`.
pub struct ApprovalGate {
    pending: dashmap::DashMap<String, oneshot::Sender<ApprovalResult>>,
}

impl ApprovalGate {
    pub fn new() -> Self {
        Self { pending: dashmap::DashMap::new() }
    }

    /// Suspend the calling task until the frontend resolves the approval.
    pub async fn request_approval(
        &self,
        tool_call_id: String,
        _tool_name: String,
        _input: Value,
    ) -> Result<ApprovalResult, CoreError> {
        let (tx, rx) = oneshot::channel();
        self.pending.insert(tool_call_id.clone(), tx);
        rx.await.map_err(|_| CoreError::Cancelled {
            operation: format!("tool-approval:{}", tool_call_id),
        })
    }

    /// Called from the Tauri command layer when the user responds.
    pub fn resolve(&self, tool_call_id: &str, result: ApprovalResult) -> Result<(), CoreError> {
        if let Some((_, tx)) = self.pending.remove(tool_call_id) {
            let _ = tx.send(result);
            Ok(())
        } else {
            Err(CoreError::Internal {
                message: format!("No pending approval for tool_call_id={}", tool_call_id),
            })
        }
    }

    /// Resolve all pending requests as Cancelled (e.g. on conversation teardown).
    pub fn cancel_all(&self) {
        let ids: Vec<_> = self.pending.iter().map(|e| e.key().clone()).collect();
        for id in ids {
            if let Some((_, tx)) = self.pending.remove(&id) {
                let _ = tx.send(ApprovalResult::Cancelled);
            }
        }
    }
}

impl Default for ApprovalGate {
    fn default() -> Self { Self::new() }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/// Built-in tool names that never require approval.
const BUILTIN_TOOLS: &[&str] = &["loadSkill", "spawnSubagent", "mergeSubagentResults"];

pub struct ToolDispatcher {
    mcp_registry: Arc<McpRegistry>,
    approval_gate: Arc<ApprovalGate>,
}

impl ToolDispatcher {
    pub fn new(mcp_registry: Arc<McpRegistry>, approval_gate: Arc<ApprovalGate>) -> Self {
        Self { mcp_registry, approval_gate }
    }

    /// Route a tool call to the right handler and return a JSON result.
    pub async fn dispatch(&self, tool_call: &ToolCall) -> Result<Value, CoreError> {
        let name = &tool_call.function.name;
        let args: Value = serde_json::from_str(&tool_call.function.arguments)
            .unwrap_or(Value::Null);

        // 1. Try built-ins first.
        if let Some(result) = self.dispatch_builtin(name, &args) {
            return result;
        }

        // 2. Gate external tools.
        if self.needs_approval(name) {
            let approval = self.approval_gate
                .request_approval(tool_call.id.clone(), name.clone(), args.clone())
                .await?;

            let effective_args = match approval {
                ApprovalResult::Approved { edited_input } => edited_input.unwrap_or(args),
                ApprovalResult::Denied { reason } => {
                    return Err(CoreError::McpToolExecution {
                        tool_name: name.clone(),
                        message: reason.unwrap_or_else(|| "Denied by user".into()),
                    });
                }
                ApprovalResult::Cancelled => {
                    return Err(CoreError::Cancelled {
                        operation: format!("tool:{}", name),
                    });
                }
            };

            self.dispatch_mcp(name, &effective_args).await
        } else {
            self.dispatch_mcp(name, &args).await
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn dispatch_builtin(&self, name: &str, args: &Value) -> Option<Result<Value, CoreError>> {
        match name {
            "loadSkill" => {
                let skill_name = args["name"].as_str().unwrap_or("unknown");
                Some(Ok(serde_json::json!({ "loaded": skill_name })))
            }
            "spawnSubagent" => Some(Ok(serde_json::json!({ "spawned": true }))),
            "mergeSubagentResults" => Some(Ok(serde_json::json!({ "merged": true }))),
            _ => None,
        }
    }

    async fn dispatch_mcp(&self, tool_name: &str, args: &Value) -> Result<Value, CoreError> {
        let tools = self.mcp_registry.all_tools();
        let (server_name, _) = tools
            .iter()
            .find(|(_, t)| t.name == tool_name)
            .ok_or_else(|| CoreError::McpToolNotFound {
                server_name: String::new(),
                tool_name: tool_name.to_string(),
            })?;

        let result: McpCallResult = self.mcp_registry
            .call_tool(server_name, tool_name, args.clone())
            .await?;

        serde_json::to_value(&result).map_err(|e| CoreError::Internal {
            message: format!("Serialize tool result: {}", e),
        })
    }

    fn needs_approval(&self, tool_name: &str) -> bool {
        !BUILTIN_TOOLS.contains(&tool_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_dispatcher() -> ToolDispatcher {
        ToolDispatcher::new(Arc::new(McpRegistry::new()), Arc::new(ApprovalGate::new()))
    }

    #[test]
    fn builtin_tools_skip_approval() {
        let d = make_dispatcher();
        assert!(!d.needs_approval("loadSkill"));
        assert!(!d.needs_approval("spawnSubagent"));
        assert!(!d.needs_approval("mergeSubagentResults"));
    }

    #[test]
    fn external_tools_need_approval() {
        let d = make_dispatcher();
        assert!(d.needs_approval("read_file"));
        assert!(d.needs_approval("execute_shell"));
    }

    #[tokio::test]
    async fn builtin_load_skill_returns_json() {
        let d = make_dispatcher();
        let tc = ToolCall {
            id: "tc1".into(),
            r#type: "function".into(),
            function: crate::traits::FunctionCall {
                name: "loadSkill".into(),
                arguments: r#"{"name":"my-skill"}"#.into(),
            },
        };
        let result = d.dispatch(&tc).await.unwrap();
        assert_eq!(result["loaded"], "my-skill");
    }

    #[test]
    fn approval_gate_cancel_all_clears_pending() {
        let gate = ApprovalGate::new();
        // No pending approvals — cancel_all is a no-op.
        gate.cancel_all();
        assert!(gate.pending.is_empty());
    }

    #[test]
    fn approval_gate_resolve_unknown_id_errors() {
        let gate = ApprovalGate::new();
        let result = gate.resolve("nonexistent", ApprovalResult::Approved { edited_input: None });
        assert!(result.is_err());
    }
}
