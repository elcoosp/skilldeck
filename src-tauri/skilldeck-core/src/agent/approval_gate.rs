//! ApprovalGate is implemented in tool_dispatcher.rs and re-exported from
//! agent/mod.rs.  This file is intentionally kept as a shim so the original
//! stub path continues to compile.
pub use crate::agent::tool_dispatcher::{ApprovalGate, ApprovalResult};
