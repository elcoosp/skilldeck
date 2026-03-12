//! SeaORM 2.0 entity models.
//!
//! Uses `#[sea_orm::model]` with relations defined directly on the `Model`
//! struct — no separate `Relation` enum needed (2.0 pattern).

pub mod profiles;
pub mod conversations;
pub mod messages;
pub mod mcp_servers;
pub mod skills;
pub mod workflow_executions;
pub mod subagent_sessions;
pub mod usage_events;
