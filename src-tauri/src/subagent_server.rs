// src-tauri/src/subagent_server.rs

use adk_agent::LlmAgentBuilder;
use adk_core::Agent;
use adk_server::{ServerConfig, SingleAgentLoader, create_app_with_a2a};
use adk_session::InMemorySessionService;
use axum::Router;
use skilldeck_core::skills::SkillRegistry;
use skilldeck_core::traits::ModelProvider;
use std::sync::Arc;
use tokio::sync::oneshot;

pub struct SubagentServer {
    pub url: String,
    shutdown_tx: oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<()>,
}

impl SubagentServer {
    pub async fn spawn(agent: Arc<dyn Agent>) -> Result<Self, Box<dyn std::error::Error>> {
        let session_service = Arc::new(InMemorySessionService::new());
        let loader = Arc::new(SingleAgentLoader::new(agent));
        let config = ServerConfig::new(loader, session_service).with_a2a_base_url(None);
        let app = create_app_with_a2a(config, None);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let url = format!("http://{}", addr);

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                })
                .await
                .unwrap();
        });

        Ok(SubagentServer {
            url,
            shutdown_tx,
            handle,
        })
    }

    pub async fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
        self.handle.await.ok();
    }
}

pub async fn build_subagent_agent(
    provider: Arc<dyn ModelProvider>,
    model_id: String,
    task: String,
    skill_names: Vec<String>,
    skill_registry: Arc<SkillRegistry>,
) -> Result<Arc<dyn Agent>, String> {
    let mut skills_content = Vec::new();
    for name in &skill_names {
        let skill = skill_registry
            .get_skill(name)
            .await
            .ok_or_else(|| format!("Skill '{}' not found", name))?;
        skills_content.push(format!(
            "\n\n---\n\n[Skill: {}]\n{}",
            name, skill.content_md
        ));
    }

    let system_prompt = if skills_content.is_empty() {
        task
    } else {
        format!("{}\n\n{}", task, skills_content.join(""))
    };

    let agent = LlmAgentBuilder::new("subagent")
        .model(provider)
        .instruction(system_prompt)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(Arc::new(agent))
}
