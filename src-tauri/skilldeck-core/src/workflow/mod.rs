//! Workflow execution engine (petgraph DAG, sequential, parallel, eval-opt).

pub mod types;
pub mod graph;
pub mod executor;
pub mod sequential;
pub mod parallel;
pub mod eval_opt;
