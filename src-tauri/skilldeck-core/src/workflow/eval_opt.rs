//! Evaluator-Optimizer workflow pattern.
//!
//! Alternates between a *generator* step and an *evaluator* step.  If the
//! evaluator marks the result as passing, the workflow completes; otherwise
//! the generator is re-run up to `max_iterations` times.
//!
//! In v1 the actual model calls are stubs — the iteration bookkeeping and
//! event emission are the production-grade parts.

use tokio::sync::mpsc::Sender;
use tracing::info;

use super::{
    graph::WorkflowGraph,
    sequential::execute_step,
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::CoreError;

/// Maximum generation/evaluation cycles before giving up.
const MAX_ITERATIONS: u32 = 5;

/// Evaluate-and-optimise execution.
///
/// Assumes the definition has at least two steps: the *first* is treated as
/// the generator and the *last* as the evaluator.  All other steps are run
/// sequentially before the eval loop begins (setup steps).
pub async fn execute(
    state: &mut WorkflowState,
    _graph: &WorkflowGraph,
    order: &[String],
    tx: &Sender<WorkflowEvent>,
) -> Result<(), CoreError> {
    if order.is_empty() {
        return Ok(());
    }

    // Split: everything but the last step is "setup + generator", the last is
    // the "evaluator".  Simple convention for v1.
    let (setup_and_gen, evaluator) = order.split_at(order.len().saturating_sub(1));
    let evaluator_id = evaluator.first().map(String::as_str);

    // Run setup steps once.
    for step_id in setup_and_gen
        .iter()
        .take(setup_and_gen.len().saturating_sub(1))
    {
        execute_step(state, step_id, tx).await?;
    }

    let generator_id = setup_and_gen.last().map(String::as_str);

    let mut iteration = 0u32;
    loop {
        iteration += 1;
        if iteration > MAX_ITERATIONS {
            info!("EvalOpt: max iterations ({}) reached", MAX_ITERATIONS);
            break;
        }

        info!("EvalOpt: iteration {}/{}", iteration, MAX_ITERATIONS);

        // Run generator.
        if let Some(gen_id) = generator_id {
            // Reset to allow re-run.
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == gen_id) {
                step.status = StepStatus::Pending;
                step.result = None;
            }
            execute_step(state, gen_id, tx).await?;
        }

        // Run evaluator.
        if let Some(eval_id) = evaluator_id {
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == eval_id) {
                step.status = StepStatus::Pending;
                step.result = None;
            }
            execute_step(state, eval_id, tx).await?;

            // In production: parse evaluator output to decide whether to
            // continue.  For v1, always exit after the first successful eval.
            let passed = state
                .steps
                .iter()
                .find(|s| s.id == eval_id)
                .map(|s| s.status == StepStatus::Completed)
                .unwrap_or(false);

            if passed {
                info!("EvalOpt: evaluator passed on iteration {}", iteration);
                break;
            }
        } else {
            // No evaluator step — treat as done after one generation pass.
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

    fn make_eval_opt_state() -> WorkflowState {
        WorkflowState {
            id: Uuid::new_v4(),
            definition: WorkflowDefinition {
                name: "eval-opt".into(),
                pattern: WorkflowPattern::EvaluatorOptimizer,
                steps: vec![
                    WorkflowStepDefinition {
                        id: "gen".into(),
                        name: "Generator".into(),
                        skill: None,
                        prompt: "generate".into(),
                    },
                    WorkflowStepDefinition {
                        id: "eval".into(),
                        name: "Evaluator".into(),
                        skill: None,
                        prompt: "evaluate".into(),
                    },
                ],
                dependencies: vec![StepDependency {
                    from: "gen".into(),
                    to: "eval".into(),
                }],
            },
            steps: vec![
                StepState {
                    id: "gen".into(),
                    status: StepStatus::Pending,
                    result: None,
                    error: None,
                    tokens_used: 0,
                },
                StepState {
                    id: "eval".into(),
                    status: StepStatus::Pending,
                    result: None,
                    error: None,
                    tokens_used: 0,
                },
            ],
            status: WorkflowStatus::Running,
        }
    }

    #[tokio::test]
    async fn eval_opt_runs_and_completes() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let graph = WorkflowGraph::new();
        let mut state = make_eval_opt_state();
        let order = vec!["gen".to_string(), "eval".to_string()];
        execute(&mut state, &graph, &order, &tx).await.unwrap();
        // Both steps should have been run at least once.
        let eval_step = state.steps.iter().find(|s| s.id == "eval").unwrap();
        assert_eq!(eval_step.status, StepStatus::Completed);
    }
}
