//! Sequential workflow execution — steps run one after another in topo order.

use tokio::sync::mpsc::Sender;
use tracing::info;

use super::{
    graph::WorkflowGraph,
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::CoreError;

/// Execute all steps in topological order, blocking on each one.
pub async fn execute(
    state: &mut WorkflowState,
    _graph: &WorkflowGraph,
    order: &[String],
    tx: &Sender<WorkflowEvent>,
) -> Result<(), CoreError> {
    for step_id in order {
        execute_step(state, step_id, tx).await?;
    }
    Ok(())
}

pub async fn execute_step(
    state: &mut WorkflowState,
    step_id: &str,
    tx: &Sender<WorkflowEvent>,
) -> Result<(), CoreError> {
    info!("Sequential: running step '{}'", step_id);

    let _ = tx
        .send(WorkflowEvent::StepStarted {
            workflow_id: state.id,
            step_id: step_id.to_string(),
        })
        .await;

    if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
        step.status = StepStatus::Running;

        // Placeholder: in production this would invoke an AgentLoop subagent.
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        step.status = StepStatus::Completed;
        step.result = Some(format!("step {} completed", step_id));

        let _ = tx
            .send(WorkflowEvent::StepCompleted {
                workflow_id: state.id,
                step_id: step_id.to_string(),
                result: step.result.clone(),
            })
            .await;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::types::*;
    use uuid::Uuid;

    fn make_state(step_ids: &[&str]) -> WorkflowState {
        WorkflowState {
            id: Uuid::new_v4(),
            definition: WorkflowDefinition {
                name: "t".into(),
                pattern: WorkflowPattern::Sequential,
                steps: step_ids
                    .iter()
                    .map(|&id| WorkflowStepDefinition {
                        id: id.into(),
                        name: id.into(),
                        skill: None,
                        prompt: "".into(),
                    })
                    .collect(),
                dependencies: vec![],
            },
            steps: step_ids
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
        execute(&mut state, &graph, &order, &tx).await.unwrap();
        for step in &state.steps {
            assert_eq!(step.status, StepStatus::Completed);
        }
    }
}
