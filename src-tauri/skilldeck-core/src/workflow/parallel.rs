//! Parallel workflow execution — dependency-ready steps run concurrently.

use std::collections::HashSet;
use tokio::sync::mpsc::Sender;
use tokio::task::JoinSet;
use tracing::{error, info};

use super::{
    graph::WorkflowGraph,
    sequential::{StepExecutionContext, run_step_with_agent_pub},
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::CoreError;

/// Execute steps with maximum parallelism, respecting the dependency graph.
pub async fn execute(
    state: &mut WorkflowState,
    graph: &WorkflowGraph,
    tx: &Sender<WorkflowEvent>,
    ctx: Option<&StepExecutionContext>,
) -> Result<(), CoreError> {
    let mut pending: HashSet<String> = state.steps.iter().map(|s| s.id.clone()).collect();

    let step_defs: std::collections::HashMap<String, (String, Option<String>)> = state
        .definition
        .steps
        .iter()
        .map(|s| (s.id.clone(), (s.prompt.clone(), s.skill.clone())))
        .collect();

    let mut join_set: JoinSet<Result<(String, String), (String, String)>> = JoinSet::new();

    loop {
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
            let (prompt, skill) = step_defs
                .get(step_id)
                .cloned()
                .unwrap_or_else(|| (format!("Execute step {}", step_id), None));
            let ctx_clone = ctx.cloned();

            join_set.spawn(async move {
                let result = if let Some(ref c) = ctx_clone {
                    run_step_with_agent_pub(&prompt, skill.as_deref(), c).await
                } else {
                    Ok(format!("step {} completed", id))
                };
                match result {
                    Ok(out) => Ok((id, out)),
                    Err(e) => Err((id, e.to_string())),
                }
            });
        }

        match join_set.join_next().await {
            None => break,
            Some(Ok(Ok((step_id, output)))) => {
                info!("Parallel: step '{}' completed", step_id);
                if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
                    step.status = StepStatus::Completed;
                    step.result = Some(output.clone());
                }
                let _ = tx
                    .send(WorkflowEvent::StepCompleted {
                        workflow_id: state.id,
                        step_id: step_id.clone(),
                        result: Some(output),
                    })
                    .await;
            }
            Some(Ok(Err((step_id, err)))) => {
                error!("Parallel: step '{}' failed: {}", step_id, err);
                if let Some(step) = state.steps.iter_mut().find(|s| s.id == step_id) {
                    step.status = StepStatus::Failed;
                    step.error = Some(err.clone());
                }
                let _ = tx
                    .send(WorkflowEvent::StepFailed {
                        workflow_id: state.id,
                        step_id: step_id.clone(),
                        error: err,
                    })
                    .await;
            }
            Some(Err(e)) => error!("JoinSet error: {}", e),
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
    async fn parallel_completes_independent_steps() {
        let (tx, _rx) = tokio::sync::mpsc::channel(64);
        let graph = WorkflowGraph::new();
        let mut state = make_state(&["x", "y", "z"]);
        execute(&mut state, &graph, &tx, None).await.unwrap();
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
