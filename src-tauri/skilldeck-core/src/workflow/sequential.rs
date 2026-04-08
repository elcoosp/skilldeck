//! Sequential workflow execution — steps run one after another in topo order.

use std::sync::Arc;
use tokio::sync::mpsc::{self, Sender};
use tracing::{error, info};

use super::{
    graph::WorkflowGraph,
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::{
    CoreError,
    agent::{AgentLoop, AgentLoopConfig, AgentLoopEvent},
    traits::{Database, ModelProvider},
};

// ── Execution context ─────────────────────────────────────────────────────────

/// Carries provider + model + db so each step can spawn its own `AgentLoop`.
/// When `None` is passed to `execute` / `execute_step`, the stub path runs.
#[derive(Clone)]
pub struct StepExecutionContext {
    pub provider: Arc<dyn ModelProvider>,
    pub model_id: String,
    pub config: AgentLoopConfig,
    pub db: Arc<dyn Database>, // <-- new
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Execute all steps in topological order.
pub async fn execute(
    state: &mut WorkflowState,
    _graph: &WorkflowGraph,
    order: &[String],
    tx: &Sender<WorkflowEvent>,
    ctx: Option<&StepExecutionContext>,
) -> Result<(), CoreError> {
    for step_id in order {
        execute_step(state, step_id, tx, ctx).await?;
    }
    Ok(())
}

/// Execute a single step, delegating to an `AgentLoop` when `ctx` is present.
pub async fn execute_step(
    state: &mut WorkflowState,
    step_id: &str,
    tx: &Sender<WorkflowEvent>,
    ctx: Option<&StepExecutionContext>,
) -> Result<(), CoreError> {
    info!("Sequential: running step '{}'", step_id);

    let _ = tx
        .send(WorkflowEvent::StepStarted {
            workflow_id: state.id,
            step_id: step_id.to_string(),
        })
        .await;

    let (prompt, skill) = state
        .definition
        .steps
        .iter()
        .find(|s| s.id == step_id)
        .map(|s| (s.prompt.clone(), s.skill.clone()))
        .unwrap_or_else(|| (format!("Execute step {}", step_id), None));

    if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
        step.status = StepStatus::Running;
    }

    let result = if let Some(c) = ctx {
        run_step_with_agent_pub(&prompt, skill.as_deref(), c).await
    } else {
        Ok(format!("step {} completed", step_id))
    };

    match result {
        Ok(output) => {
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
                step.status = StepStatus::Completed;
                step.result = Some(output.clone());
            }
            let _ = tx
                .send(WorkflowEvent::StepCompleted {
                    workflow_id: state.id,
                    step_id: step_id.to_string(),
                    result: Some(output),
                })
                .await;
        }
        Err(e) => {
            error!("Step '{}' failed: {}", step_id, e);
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
                step.status = StepStatus::Failed;
                step.error = Some(e.to_string());
            }
            let _ = tx
                .send(WorkflowEvent::StepFailed {
                    workflow_id: state.id,
                    step_id: step_id.to_string(),
                    error: e.to_string(),
                })
                .await;
            return Err(e);
        }
    }
    Ok(())
}

/// Shared helper used by `parallel.rs` to avoid duplication.
pub async fn run_step_with_agent_pub(
    prompt: &str,
    skill: Option<&str>,
    ctx: &StepExecutionContext,
) -> Result<String, CoreError> {
    run_step_with_agent(prompt, skill, ctx).await
}

// ── Internal ──────────────────────────────────────────────────────────────────

async fn run_step_with_agent(
    prompt: &str,
    _skill: Option<&str>,
    ctx: &StepExecutionContext,
) -> Result<String, CoreError> {
    let (event_tx, mut event_rx) = mpsc::channel::<Result<AgentLoopEvent, CoreError>>(128);

    let agent = AgentLoop::new(
        Arc::clone(&ctx.provider),
        ctx.model_id.clone(),
        ctx.config.clone(),
        event_tx,
        ctx.db.clone(), // <-- pass the database
    );

    let prompt_owned = prompt.to_string();
    let loop_handle = tokio::spawn(async move { agent.run(prompt_owned, false).await });

    let mut streamed = String::new();
    while let Some(event) = event_rx.recv().await {
        if let Ok(AgentLoopEvent::Token { delta }) = event {
            streamed.push_str(&delta);
        }
    }

    let agent_result = loop_handle.await.map_err(|e| CoreError::Internal {
        message: e.to_string(),
    })??;

    let result = agent_result
        .messages
        .iter()
        .rev()
        .find(|m| matches!(m.role, crate::traits::MessageRole::Assistant))
        .map(|m| m.content.clone())
        .unwrap_or(streamed);

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::types::*;
    use uuid::Uuid;

    fn make_state(ids: &[&str]) -> WorkflowState {
        WorkflowState {
            id: Uuid::new_v4(),
            definition: WorkflowDefinition {
                name: "t".into(),
                pattern: WorkflowPattern::Sequential,
                steps: ids
                    .iter()
                    .map(|&id| WorkflowStepDefinition {
                        id: id.into(),
                        name: id.into(),
                        skill: None,
                        prompt: format!("Do {id}"),
                    })
                    .collect(),
                dependencies: vec![],
            },
            steps: ids
                .iter()
                .map(|&id| StepState {
                    id: id.into(),
                    status: StepStatus::Pending,
                    result: None,
                    error: None,
                    tokens_used: 0,
                })
                .collect(),
            status: WorkflowStatus::Running,
        }
    }

    #[tokio::test]
    async fn sequential_completes_all_steps() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let graph = WorkflowGraph::new();
        let mut state = make_state(&["a", "b", "c"]);
        let order = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        execute(&mut state, &graph, &order, &tx, None)
            .await
            .unwrap();
        for step in &state.steps {
            assert_eq!(
                step.status,
                StepStatus::Completed,
                "step {} incomplete",
                step.id
            );
        }
    }

    #[tokio::test]
    async fn step_emits_started_and_completed() {
        let (tx, mut rx) = tokio::sync::mpsc::channel(32);
        let graph = WorkflowGraph::new();
        let mut state = make_state(&["x"]);
        execute(&mut state, &graph, &["x".to_string()], &tx, None)
            .await
            .unwrap();
        drop(tx);
        let mut evts: Vec<WorkflowEvent> = Vec::new();
        while let Ok(e) = rx.try_recv() {
            evts.push(e);
        }
        assert!(
            evts.iter()
                .any(|e| matches!(e, WorkflowEvent::StepStarted { .. }))
        );
        assert!(
            evts.iter()
                .any(|e| matches!(e, WorkflowEvent::StepCompleted { .. }))
        );
    }
}
