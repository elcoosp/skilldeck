//! Agent engine: loop, tool dispatch, context building, subagents.

pub mod built_in_tools;
pub mod context_builder;
pub mod load_skill_result;
pub mod r#loop;
pub mod subagent;
pub mod tool_dispatcher;

pub use built_in_tools::all as all_built_in_tools;
pub use context_builder::ContextBuilder;
pub use r#loop::{AgentLoop, AgentLoopConfig, AgentLoopEvent, AgentRunResult};
pub use subagent::{SubagentManager, SubagentSession, SubagentStatus};
pub use tool_dispatcher::{ApprovalGate, ApprovalResult, ToolDispatcher};
