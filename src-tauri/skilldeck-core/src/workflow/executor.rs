//! Workflow executor — top-level entry point that dispatches to the right
//! execution strategy based on `WorkflowDefinition.pattern`.

use std::sync::Arc;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use super::{
    eval_opt,
    graph::WorkflowGraph,
    parallel, sequential,
    sequential::StepExecutionContext,
    types::{
        StepState, StepStatus, WorkflowDefinition, WorkflowEvent, WorkflowPattern, WorkflowState,
        WorkflowStatus,
    },
};
use crate::{
    CoreError,
    agent::AgentLoopConfig,
    traits::{Database, ModelProvider},
};

pub struct WorkflowExecutor {
    tx: Sender<WorkflowEvent>,
    /// Optional provider context; when present steps run real agent loops.
    ctx: Option<StepExecutionContext>,
    /// Maximum iterations for evaluator-optimizer workflows.
    max_eval_opt_iterations: u32,
}

impl WorkflowExecutor {
    /// Create an executor that uses stub step results (tests / CI).
    pub fn new(tx: Sender<WorkflowEvent>) -> Self {
        Self {
            tx,
            ctx: None,
            max_eval_opt_iterations: 5,
        }
    }

    /// Create an executor that drives real `AgentLoop` instances per step.
    pub fn with_provider(
        tx: Sender<WorkflowEvent>,
        provider: Arc<dyn ModelProvider>,
        model_id: String,
        max_eval_opt_iterations: u32,
        db: Arc<dyn Database>,
    ) -> Self {
        Self {
            tx,
            ctx: Some(StepExecutionContext {
                provider,
                model_id,
                config: AgentLoopConfig::default(),
                db,
            }),
            max_eval_opt_iterations,
        }
    }

    /// Execute the workflow described by `def` and return the final state.
    pub async fn execute(&self, def: WorkflowDefinition) -> Result<WorkflowState, CoreError> {
        let graph = WorkflowGraph::from_definition(&def)?;
        let order = graph.execution_order()?;

        let mut state = WorkflowState {
            id: Uuid::new_v4(),
            steps: def
                .steps
                .iter()
                .map(|s| StepState {
                    id: s.id.clone(),
                    status: StepStatus::Pending,
                    result: None,
                    error: None,
                    tokens_used: 0,
                })
                .collect(),
            definition: def.clone(),
            status: WorkflowStatus::Running,
        };

        let _ = self.tx.send(WorkflowEvent::Started { id: state.id }).await;

        let ctx_ref = self.ctx.as_ref();

        let result = match def.pattern {
            WorkflowPattern::Sequential => {
                sequential::execute(&mut state, &graph, &order, &self.tx, ctx_ref).await
            }
            WorkflowPattern::Parallel => {
                parallel::execute(&mut state, &graph, &self.tx, ctx_ref).await
            }
            WorkflowPattern::EvaluatorOptimizer => {
                eval_opt::execute(
                    &mut state,
                    &graph,
                    &order,
                    &self.tx,
                    ctx_ref,
                    Some(self.max_eval_opt_iterations),
                )
                .await
            }
        };

        match result {
            Ok(()) => {
                state.status = WorkflowStatus::Completed;
                let _ = self
                    .tx
                    .send(WorkflowEvent::Completed { id: state.id })
                    .await;
                Ok(state)
            }
            Err(e) => {
                state.status = WorkflowStatus::Failed;
                let _ = self
                    .tx
                    .send(WorkflowEvent::Failed {
                        id: state.id,
                        error: e.to_string(),
                    })
                    .await;
                Err(e)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::types::*;

    fn single_step_def(pattern: WorkflowPattern) -> WorkflowDefinition {
        WorkflowDefinition {
            name: "test".into(),
            pattern,
            steps: vec![WorkflowStepDefinition {
                id: "step1".into(),
                name: "Step 1".into(),
                skill: None,
                prompt: "Do the thing".into(),
            }],
            dependencies: vec![],
        }
    }

    #[tokio::test]
    async fn single_sequential_step_returns_completed() {
        let (tx, _rx) = tokio::sync::mpsc::channel(64);
        let executor = WorkflowExecutor::new(tx);
        let state = executor
            .execute(single_step_def(WorkflowPattern::Sequential))
            .await
            .unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
    }

    #[tokio::test]
    async fn single_parallel_step_returns_completed() {
        let (tx, _rx) = tokio::sync::mpsc::channel(64);
        let executor = WorkflowExecutor::new(tx);
        let state = executor
            .execute(single_step_def(WorkflowPattern::Parallel))
            .await
            .unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
    }

    #[tokio::test]
    async fn executor_emits_started_and_completed() {
        let (tx, mut rx) = tokio::sync::mpsc::channel(64);
        let executor = WorkflowExecutor::new(tx);
        executor
            .execute(single_step_def(WorkflowPattern::Sequential))
            .await
            .unwrap();
        let mut evts = Vec::new();
        while let Ok(e) = rx.try_recv() {
            evts.push(e);
        }
        assert!(
            evts.iter()
                .any(|e| matches!(e, WorkflowEvent::Started { .. }))
        );
        assert!(
            evts.iter()
                .any(|e| matches!(e, WorkflowEvent::Completed { .. }))
        );
    }
}
