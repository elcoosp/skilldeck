// src-tauri/skilldeck-core/src/traits/subagent_spawner.rs
use async_trait::async_trait;

#[async_trait]
pub trait SubagentSpawner: Send + Sync {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String>;

    /// Retrieve the final result of a completed subagent.
    async fn get_subagent_result(&self, subagent_id: &str) -> Option<String>;
}
