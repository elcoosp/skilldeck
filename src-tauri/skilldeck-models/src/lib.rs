//! SeaORM 2.0 entity models.
//!
//! Uses `#[sea_orm::model]` with relations defined directly on the `Model`
//! struct — no separate `Relation` enum needed (2.0 pattern).

pub mod artifacts;
pub mod attachments;
pub mod bookmarks;
pub mod conversation_branches;
pub mod conversation_mcp_overrides;
pub mod conversation_model_override;
pub mod conversation_skill_overrides;
pub mod conversation_tags;
pub mod conversation_ui_state;
pub mod conversations;
pub mod export_jobs;
pub mod folders;
pub mod local_nudge_cache;
pub mod mcp_servers;
pub mod mcp_tool_cache;
pub mod message_embeddings;
pub mod messages;
pub mod model_pricing; // <-- add
pub mod profile_mcps;
pub mod profile_skills;
pub mod profiles;
pub mod prompt_variables;
pub mod prompts;
pub mod registry_skills;
pub mod skill_source_dirs; // <-- add
pub mod skills;
pub mod subagent_sessions;
pub mod sync_state;
pub mod sync_watermarks;
pub mod tags;
pub mod templates;
pub mod tool_call_events;
pub mod usage_events;
pub mod user_preferences;
pub mod workflow_executions;
pub mod workflow_steps;
pub mod workspace_state;
pub mod workspaces; // <-- add
