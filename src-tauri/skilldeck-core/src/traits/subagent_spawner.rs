use async_trait::async_trait;
use std::sync::Arc;

use crate::traits::ModelProvider;

#[async_trait]
pub trait SubagentSpawner: Send + Sync {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String>;
}
