//! Workflow executor — top-level entry point that dispatches to the right
//! execution strategy based on `WorkflowDefinition.pattern`.

use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use super::{
    eval_opt,
    graph::WorkflowGraph,
    parallel, sequential,
    types::{
        StepState, StepStatus, WorkflowDefinition, WorkflowEvent, WorkflowPattern, WorkflowState,
        WorkflowStatus,
    },
};
use crate::CoreError;

pub struct WorkflowExecutor {
    tx: Sender<WorkflowEvent>,
}

impl WorkflowExecutor {
    pub fn new(tx: Sender<WorkflowEvent>) -> Self {
        Self { tx }
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

        let result = match def.pattern {
            WorkflowPattern::Sequential => {
                sequential::execute(&mut state, &graph, &order, &self.tx).await
            }
            WorkflowPattern::Parallel => parallel::execute(&mut state, &graph, &self.tx).await,
            WorkflowPattern::EvaluatorOptimizer => {
                eval_opt::execute(&mut state, &graph, &order, &self.tx).await
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

    fn two_step_def() -> WorkflowDefinition {
        WorkflowDefinition {
            name: "two-step".into(),
            pattern: WorkflowPattern::Sequential,
            steps: vec![
                WorkflowStepDefinition {
                    id: "s1".into(),
                    name: "S1".into(),
                    skill: None,
                    prompt: "p1".into(),
                },
                WorkflowStepDefinition {
                    id: "s2".into(),
                    name: "S2".into(),
                    skill: None,
                    prompt: "p2".into(),
                },
            ],
            dependencies: vec![StepDependency {
                from: "s1".into(),
                to: "s2".into(),
            }],
        }
    }

    #[tokio::test]
    async fn sequential_completes() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let executor = WorkflowExecutor::new(tx);
        let state = executor
            .execute(single_step_def(WorkflowPattern::Sequential))
            .await
            .unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
        assert_eq!(state.steps[0].status, StepStatus::Completed);
    }

    #[tokio::test]
    async fn parallel_completes() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let executor = WorkflowExecutor::new(tx);
        let state = executor
            .execute(single_step_def(WorkflowPattern::Parallel))
            .await
            .unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
    }

    #[tokio::test]
    async fn eval_opt_completes() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let executor = WorkflowExecutor::new(tx);
        let def = WorkflowDefinition {
            name: "eo".into(),
            pattern: WorkflowPattern::EvaluatorOptimizer,
            steps: vec![
                WorkflowStepDefinition {
                    id: "gen".into(),
                    name: "Gen".into(),
                    skill: None,
                    prompt: "generate".into(),
                },
                WorkflowStepDefinition {
                    id: "eval".into(),
                    name: "Eval".into(),
                    skill: None,
                    prompt: "evaluate".into(),
                },
            ],
            dependencies: vec![StepDependency {
                from: "gen".into(),
                to: "eval".into(),
            }],
        };
        let state = executor.execute(def).await.unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
    }

    #[tokio::test]
    async fn two_step_sequential_order() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let executor = WorkflowExecutor::new(tx);
        let state = executor.execute(two_step_def()).await.unwrap();
        assert_eq!(state.status, WorkflowStatus::Completed);
        assert!(
            state
                .steps
                .iter()
                .all(|s| s.status == StepStatus::Completed)
        );
    }

    #[tokio::test]
    async fn cyclic_definition_errors() {
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let executor = WorkflowExecutor::new(tx);
        let def = WorkflowDefinition {
            name: "cyclic".into(),
            pattern: WorkflowPattern::Sequential,
            steps: vec![
                WorkflowStepDefinition {
                    id: "a".into(),
                    name: "A".into(),
                    skill: None,
                    prompt: "".into(),
                },
                WorkflowStepDefinition {
                    id: "b".into(),
                    name: "B".into(),
                    skill: None,
                    prompt: "".into(),
                },
            ],
            dependencies: vec![
                StepDependency {
                    from: "a".into(),
                    to: "b".into(),
                },
                StepDependency {
                    from: "b".into(),
                    to: "a".into(),
                },
            ],
        };
        assert!(executor.execute(def).await.is_err());
    }
}
