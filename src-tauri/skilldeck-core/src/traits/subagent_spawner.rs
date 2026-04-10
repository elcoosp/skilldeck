// src-tauri/skilldeck-core/src/traits/subagent_spawner.rs
use async_trait::async_trait;

#[async_trait]
pub trait SubagentSpawner: Send + Sync {
    /// Spawn a new subagent for a given task and optional skills.
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String>;

    /// Retrieve the final result of a completed subagent.
    async fn get_subagent_result(&self, subagent_id: &str) -> Option<String>;

    /// Merge results from a subagent using the specified strategy.
    async fn merge_subagent_result(
        &self,
        subagent_id: &str,
        strategy: &str,
    ) -> Result<String, String>;
}
