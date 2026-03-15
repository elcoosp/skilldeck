//! Workflow engine: DAG execution with sequential, parallel, and
//! evaluator-optimizer patterns.

pub mod eval_opt;
pub mod executor;
pub mod graph;
pub mod parallel;
pub mod sequential;
pub mod types;

pub use executor::WorkflowExecutor;
pub use graph::WorkflowGraph;
pub use types::{
    StepDependency, StepState, StepStatus, WorkflowDefinition, WorkflowEvent, WorkflowPattern,
    WorkflowState, WorkflowStatus, WorkflowStepDefinition,
};
