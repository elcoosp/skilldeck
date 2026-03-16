//! Evaluator-Optimizer workflow pattern.
//!
//! Alternates between a *generator* step and an *evaluator* step. The
//! evaluator's output is parsed for a `PASS` / `FAIL` signal (or falls back
//! to checking completion status). On PASS the loop exits; on FAIL the
//! generator is re-run up to `MAX_ITERATIONS` times.

use tokio::sync::mpsc::Sender;
use tracing::info;

use super::{
    graph::WorkflowGraph,
    sequential::{StepExecutionContext, execute_step},
    types::{StepStatus, WorkflowEvent, WorkflowState},
};
use crate::CoreError;

/// Default maximum generation/evaluation cycles before giving up.
const DEFAULT_MAX_ITERATIONS: u32 = 5;

/// Evaluate-and-optimise execution.
///
/// Convention (v1): the *last* step in `order` is the evaluator; everything
/// before it is setup steps (run once) + generator (re-run each cycle).
///
/// `max_iterations` overrides the default maximum iterations.
pub async fn execute(
    state: &mut WorkflowState,
    _graph: &WorkflowGraph,
    order: &[String],
    tx: &Sender<WorkflowEvent>,
    ctx: Option<&StepExecutionContext>,
    max_iterations: Option<u32>,
) -> Result<(), CoreError> {
    if order.is_empty() {
        return Ok(());
    }

    let max = max_iterations.unwrap_or(DEFAULT_MAX_ITERATIONS);
    let (setup_and_gen, evaluator_slice) = order.split_at(order.len().saturating_sub(1));
    let evaluator_id = evaluator_slice.first().map(String::as_str);

    // Run setup steps once (all but the last of setup_and_gen).
    for step_id in setup_and_gen
        .iter()
        .take(setup_and_gen.len().saturating_sub(1))
    {
        execute_step(state, step_id, tx, ctx).await?;
    }

    let generator_id = setup_and_gen.last().map(String::as_str);

    let mut iteration = 0u32;
    loop {
        iteration += 1;
        if iteration > max {
            info!("EvalOpt: max iterations ({}) reached", max);
            break;
        }
        info!("EvalOpt: iteration {}/{}", iteration, max);

        // Run generator — reset state so execute_step re-runs it.
        if let Some(gen_id) = generator_id {
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == gen_id) {
                step.status = StepStatus::Pending;
                step.result = None;
            }
            execute_step(state, gen_id, tx, ctx).await?;
        }

        // Run evaluator.
        if let Some(eval_id) = evaluator_id {
            if let Some(step) = state.steps.iter_mut().find(|s| s.id == eval_id) {
                step.status = StepStatus::Pending;
                step.result = None;
            }
            execute_step(state, eval_id, tx, ctx).await?;

            // Parse the evaluator output for PASS/FAIL signal.
            let passed = state
                .steps
                .iter()
                .find(|s| s.id == eval_id)
                .map(|s| {
                    if let Some(ref result) = s.result {
                        // Accept "PASS" anywhere in output (case-insensitive).
                        // If not present and not "FAIL", assume pass on first success.
                        let upper = result.to_uppercase();
                        if upper.contains("PASS") {
                            return true;
                        }
                        if upper.contains("FAIL") {
                            return false;
                        }
                    }
                    // Default: pass when step completed successfully.
                    s.status == StepStatus::Completed
                })
                .unwrap_or(false);

            if passed {
                info!("EvalOpt: evaluator passed on iteration {}", iteration);
                break;
            }
            info!("EvalOpt: evaluator did not pass, re-running generator");
        } else {
            // No evaluator — single generation pass.
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
        execute(&mut state, &graph, &order, &tx, None, None)
            .await
            .unwrap();
        let eval_step = state.steps.iter().find(|s| s.id == "eval").unwrap();
        assert_eq!(eval_step.status, StepStatus::Completed);
    }

    #[tokio::test]
    async fn eval_opt_empty_order_is_noop() {
        let (tx, _rx) = tokio::sync::mpsc::channel(4);
        let graph = WorkflowGraph::new();
        let mut state = make_eval_opt_state();
        execute(&mut state, &graph, &[], &tx, None, None)
            .await
            .unwrap();
    }
}
