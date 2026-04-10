// src-tauri/src/subagent_registry.rs
//! Subagent registry — tracks active subagent servers and their results.

use adk_rust::server::a2a::A2aClient;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::task::JoinHandle;

use crate::subagent_server::SubagentServer;

/// Handle to a running subagent, used to retrieve results and clean up.
pub struct SubagentHandle {
    pub server: SubagentServer,
    pub client: Arc<A2aClient>,
    pub results: Arc<DashMap<String, String>>,
    pub monitor_task: JoinHandle<()>,
}

/// Global registry mapping `subagent_id` to its handle.
pub type SubagentRegistry = Arc<DashMap<String, SubagentHandle>>;
