//! Tool dispatcher — routes ToolCall events to built-ins, MCP servers, or
//! through an approval gate for external side-effecting tools.
//!
//! Auto-approve categories read from `AutoApproveConfig` let the user opt out
//! of the gate for low-risk tool classes (reads, http, etc.) as required by
//! the plan task 1.3.

use serde_json::Value;
use std::sync::Arc;
use tokio::sync::oneshot;

use crate::{
    CoreError,
    agent::load_skill_result::{LoadSkillResult, SkillContentFormat},
    mcp::registry::McpRegistry,
    skills::SkillRegistry,
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
        Self {
            pending: dashmap::DashMap::new(),
        }
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
    fn default() -> Self {
        Self::new()
    }
}

// ── Auto-approve config ───────────────────────────────────────────────────────

/// Categories of MCP tool calls that can be auto-approved without user interaction.
///
/// Populated from the frontend `ToolApprovalSettings` Zustand store via the
/// `set_auto_approve_config` Tauri command (or loaded from stored settings at
/// startup). Matching is done by inspecting the tool name prefix/suffix against
/// known patterns for each category.
#[derive(Debug, Clone, Default)]
pub struct AutoApproveConfig {
    /// Auto-approve all read-like tools (list_*, read_*, get_*, fetch_*).
    pub reads: bool,
    /// Auto-approve all write-like tools (write_*, create_*, update_*, put_*).
    pub writes: bool,
    /// Auto-approve all SQL SELECT tools (query_*, select_*, search_*).
    pub selects: bool,
    /// Auto-approve all mutation tools (insert_*, delete_*, patch_*, mutate_*).
    pub mutations: bool,
    /// Auto-approve all HTTP request tools (http_*, request_*, fetch_*).
    pub http_requests: bool,
    /// Auto-approve all shell/exec tools (run_*, exec_*, shell_*, bash_*).
    pub shell: bool,
}

impl AutoApproveConfig {
    /// Return true if `tool_name` falls into a category the user has auto-approved.
    pub fn is_auto_approved(&self, tool_name: &str) -> bool {
        let n = tool_name.to_lowercase();

        if self.reads && matches_any_prefix(&n, &["list_", "read_", "get_", "fetch_", "show_"]) {
            return true;
        }
        if self.writes && matches_any_prefix(&n, &["write_", "create_", "update_", "put_", "set_"])
        {
            return true;
        }
        if self.selects && matches_any_prefix(&n, &["query_", "select_", "search_", "find_"]) {
            return true;
        }
        if self.mutations
            && matches_any_prefix(&n, &["insert_", "delete_", "patch_", "mutate_", "remove_"])
        {
            return true;
        }
        if self.http_requests
            && matches_any_prefix(&n, &["http_", "request_", "call_", "post_", "download_"])
        {
            return true;
        }
        if self.shell
            && matches_any_prefix(
                &n,
                &["run_", "exec_", "shell_", "bash_", "cmd_", "execute_"],
            )
        {
            return true;
        }

        false
    }
}

fn matches_any_prefix(s: &str, prefixes: &[&str]) -> bool {
    prefixes.iter().any(|p| s.starts_with(p))
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/// Built-in tool names that never require approval.
const BUILTIN_TOOLS: &[&str] = &["loadSkill", "spawnSubagent", "mergeSubagentResults"];

pub struct ToolDispatcher {
    mcp_registry: Arc<McpRegistry>,
    approval_gate: Arc<ApprovalGate>,
    skill_registry: Arc<SkillRegistry>,
    /// Auto-approve policy; updated at runtime via `set_auto_approve`.
    auto_approve: Arc<tokio::sync::RwLock<AutoApproveConfig>>,
    /// Whether the model supports Toon encoding.
    supports_toon: bool,
}

impl ToolDispatcher {
    pub fn new(
        mcp_registry: Arc<McpRegistry>,
        approval_gate: Arc<ApprovalGate>,
        skill_registry: Arc<SkillRegistry>,
        supports_toon: bool,
    ) -> Self {
        Self {
            mcp_registry,
            approval_gate,
            skill_registry,
            auto_approve: Arc::new(tokio::sync::RwLock::new(AutoApproveConfig::default())),
            supports_toon,
        }
    }

    /// Replace the auto-approve config (called when user changes settings).
    pub async fn set_auto_approve(&self, config: AutoApproveConfig) {
        *self.auto_approve.write().await = config;
    }

    /// Route a tool call to the right handler and return a JSON result.
    pub async fn dispatch(&self, tool_call: &ToolCall) -> Result<Value, CoreError> {
        let name = &tool_call.function.name;
        // Parse arguments with proper error handling
        let args: Value = serde_json::from_str(&tool_call.function.arguments).map_err(|e| {
            CoreError::McpToolExecution {
                tool_name: name.clone(),
                message: format!("Invalid JSON arguments: {}", e),
            }
        })?;

        // 1. Try built-ins first — they never go through the gate.
        if let Some(result) = self.dispatch_builtin(name, &args).await {
            return result;
        }

        // 2. Check if this tool needs approval.
        if self.needs_approval(name).await {
            let approval = self
                .approval_gate
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

    async fn dispatch_builtin(&self, name: &str, args: &Value) -> Option<Result<Value, CoreError>> {
        match name {
            "loadSkill" => {
                let skill_name = args["name"].as_str().unwrap_or("unknown");
                match self.skill_registry.get_skill(skill_name).await {
                    Some(skill) => {
                        let (content, format) = if self.supports_toon {
                            match toon_rust::encode(&serde_json::json!(skill.content_md), None) {
                                Ok(encoded) => (encoded, SkillContentFormat::Toon),
                                Err(e) => {
                                    tracing::warn!(
                                        "Toon encoding failed for skill '{}': {}",
                                        skill_name,
                                        e
                                    );
                                    (skill.content_md.clone(), SkillContentFormat::Text)
                                }
                            }
                        } else {
                            (skill.content_md.clone(), SkillContentFormat::Text)
                        };
                        let result = LoadSkillResult {
                            loaded: skill_name.to_string(),
                            content,
                            format,
                        };
                        Some(Ok(serde_json::to_value(result).unwrap()))
                    }
                    None => Some(Err(CoreError::SkillNotInRegistry {
                        name: skill_name.into(),
                    })),
                }
            }
            "spawnSubagent" => Some(Ok(serde_json::json!({ "spawned": true }))),
            "mergeSubagentResults" => Some(Ok(serde_json::json!({ "merged": true }))),
            _ => None,
        }
    }

    async fn dispatch_mcp(&self, tool_name: &str, args: &Value) -> Result<Value, CoreError> {
        let tools = self.mcp_registry.all_tools();
        let (server_name, _) =
            tools
                .iter()
                .find(|(_, t)| t.name == tool_name)
                .ok_or_else(|| CoreError::McpToolNotFound {
                    server_name: String::new(),
                    tool_name: tool_name.to_string(),
                })?;

        let result: McpCallResult = self
            .mcp_registry
            .call_tool(server_name, tool_name, args.clone())
            .await?;

        serde_json::to_value(&result).map_err(|e| CoreError::Internal {
            message: format!("Serialize tool result: {}", e),
        })
    }

    /// Return true if this tool call must be sent to the approval gate.
    ///
    /// Built-in tools always bypass the gate. Then we check the auto-approve
    /// config; only if neither applies does the gate run.
    pub async fn needs_approval(&self, tool_name: &str) -> bool {
        if BUILTIN_TOOLS.contains(&tool_name) {
            return false;
        }
        let cfg = self.auto_approve.read().await;
        !cfg.is_auto_approved(tool_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::SkillRegistry;
    use crate::traits::Skill;

    fn make_dispatcher() -> ToolDispatcher {
        ToolDispatcher::new(
            Arc::new(McpRegistry::new()),
            Arc::new(ApprovalGate::new()),
            Arc::new(SkillRegistry::new()),
            false,
        )
    }

    #[tokio::test]
    async fn builtin_tools_skip_approval() {
        let d = make_dispatcher();
        assert!(!d.needs_approval("loadSkill").await);
        assert!(!d.needs_approval("spawnSubagent").await);
        assert!(!d.needs_approval("mergeSubagentResults").await);
    }

    #[tokio::test]
    async fn external_tools_need_approval_by_default() {
        let d = make_dispatcher();
        assert!(d.needs_approval("read_file").await);
        assert!(d.needs_approval("execute_shell").await);
    }

    #[tokio::test]
    async fn auto_approve_reads_skips_gate() {
        let d = make_dispatcher();
        d.set_auto_approve(AutoApproveConfig {
            reads: true,
            ..Default::default()
        })
        .await;
        assert!(!d.needs_approval("read_file").await);
        assert!(!d.needs_approval("get_contents").await);
        // Writes still need approval.
        assert!(d.needs_approval("write_file").await);
    }

    #[tokio::test]
    async fn auto_approve_shell_skips_gate() {
        let d = make_dispatcher();
        d.set_auto_approve(AutoApproveConfig {
            shell: true,
            ..Default::default()
        })
        .await;
        assert!(!d.needs_approval("run_command").await);
        assert!(!d.needs_approval("exec_process").await);
        assert!(!d.needs_approval("bash_script").await);
    }

    #[tokio::test]
    async fn auto_approve_http_skips_gate() {
        let d = make_dispatcher();
        d.set_auto_approve(AutoApproveConfig {
            http_requests: true,
            ..Default::default()
        })
        .await;
        assert!(!d.needs_approval("http_get").await);
        assert!(!d.needs_approval("post_data").await);
    }

    #[tokio::test]
    async fn builtin_load_skill_returns_json() {
        // Create a registry with a pre‑loaded skill
        let skill_registry = Arc::new(SkillRegistry::new());
        let skill = Skill::new(
            "my-skill".into(),
            "desc".into(),
            "content".into(),
            "test".into(),
        );
        skill_registry
            .register_source("test".into(), vec![skill])
            .await;

        let d = ToolDispatcher::new(
            Arc::new(McpRegistry::new()),
            Arc::new(ApprovalGate::new()),
            skill_registry,
            false,
        );

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

    #[tokio::test]
    async fn malformed_json_arguments_return_error() {
        let d = make_dispatcher();
        let tc = ToolCall {
            id: "tc2".into(),
            r#type: "function".into(),
            function: crate::traits::FunctionCall {
                name: "some_tool".into(),
                arguments: r#"{invalid json"#.into(), // malformed
            },
        };
        let result = d.dispatch(&tc).await;
        assert!(result.is_err());
        if let Err(e) = result {
            match e {
                CoreError::McpToolExecution { tool_name, message } => {
                    assert_eq!(tool_name, "some_tool");
                    assert!(message.contains("Invalid JSON arguments"));
                }
                _ => panic!("expected McpToolExecution error"),
            }
        }
    }

    #[test]
    fn approval_gate_cancel_all_clears_pending() {
        let gate = ApprovalGate::new();
        gate.cancel_all();
        assert!(gate.pending.is_empty());
    }

    #[test]
    fn approval_gate_resolve_unknown_id_errors() {
        let gate = ApprovalGate::new();
        let result = gate.resolve(
            "nonexistent",
            ApprovalResult::Approved { edited_input: None },
        );
        assert!(result.is_err());
    }

    #[test]
    fn auto_approve_config_prefix_matching() {
        let cfg = AutoApproveConfig {
            reads: true,
            shell: true,
            ..Default::default()
        };
        assert!(cfg.is_auto_approved("list_files"));
        assert!(cfg.is_auto_approved("read_contents"));
        assert!(cfg.is_auto_approved("run_command"));
        assert!(!cfg.is_auto_approved("write_file"));
        assert!(!cfg.is_auto_approved("delete_row"));
    }
}
