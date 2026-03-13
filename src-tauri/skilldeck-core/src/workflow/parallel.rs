//! Parallel workflow execution — dependency-ready steps run concurrently.
//!
//! Uses a JoinSet to fan-out independent steps and a loop that drains
//! completions and enqueues newly-unblocked steps.

use std::collections::HashSet;
use tokio::sync::mpsc::Sender;
use tokio::task::JoinSet;
use tracing::{error, info};

use super::{
    graph::WorkflowGraph,
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::CoreError;

/// Execute steps with maximum parallelism, respecting the dependency graph.
pub async fn execute(
    state: &mut WorkflowState,
    graph: &WorkflowGraph,
    tx: &Sender<WorkflowEvent>,
) -> Result<(), CoreError> {
    let mut pending: HashSet<String> = state.steps.iter().map(|s| s.id.clone()).collect();
    let mut join_set: JoinSet<Result<String, String>> = JoinSet::new();

    loop {
        // Find steps whose dependencies have all completed.
        // Collect a temporary `Vec<&str>` for the readiness check,
        // then convert the returned `Vec<&str>` into owned `Vec<String>`.
        let ready: Vec<String> = {
            let pending_vec: Vec<&str> = pending.iter().map(String::as_str).collect();
            graph
                .ready_steps(&pending_vec)
                .into_iter()
                .map(String::from)
                .collect()
        };

        for step_id in &ready {
            pending.remove(step_id);

            if let Some(step) = state.steps.iter_mut().find(|s| s.id == *step_id) {
                step.status = StepStatus::Running;
            }

            let _ = tx
                .send(WorkflowEvent::StepStarted {
                    workflow_id: state.id,
                    step_id: step_id.to_string(),
                })
                .await;

            let id = step_id.to_string();
            join_set.spawn(async move {
                // Placeholder: real impl would call an AgentLoop subagent.
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                Ok::<_, String>(id)
            });
        }

        // All steps launched — wait for any one to finish.
        match join_set.join_next().await {
            None => break, // no tasks running and pending is empty
            Some(Ok(Ok(step_id))) => {
                info!("Parallel: step '{}' completed", step_id);
                if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
                    step.status = StepStatus::Completed;
                    step.result = Some(format!("step {} completed", step_id));
                    let _ = tx
                        .send(WorkflowEvent::StepCompleted {
                            workflow_id: state.id,
                            step_id: step.id.clone(),
                            result: step.result.clone(),
                        })
                        .await;
                }
            }
            Some(Ok(Err(e))) => {
                error!("Parallel step failed: {}", e);
            }
            Some(Err(e)) => {
                error!("JoinSet error: {}", e);
            }
        }

        if pending.is_empty() && join_set.is_empty() {
            break;
        }
    }

    Ok(())
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
                pattern: WorkflowPattern::Parallel,
                steps: ids
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
    async fn parallel_completes_independent_steps() {
        let (tx, _rx) = tokio::sync::mpsc::channel(64);
        let graph = WorkflowGraph::new(); // no edges → all independent
        let mut state = make_state(&["x", "y", "z"]);
        execute(&mut state, &graph, &tx).await.unwrap();
        for step in &state.steps {
            assert_eq!(
                step.status,
                StepStatus::Completed,
                "step {} not completed",
                step.id
            );
        }
    }
}
