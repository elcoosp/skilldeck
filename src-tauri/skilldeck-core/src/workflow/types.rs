//! Workflow type definitions — patterns, definitions, runtime state.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Definition types (static, serialisable) ───────────────────────────────────

/// Which execution pattern drives this workflow.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowPattern {
    Sequential,
    Parallel,
    EvaluatorOptimizer,
}

/// Static workflow definition (user-authored).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub name: String,
    pub pattern: WorkflowPattern,
    pub steps: Vec<WorkflowStepDefinition>,
    pub dependencies: Vec<StepDependency>,
}

/// A single step within a workflow definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStepDefinition {
    pub id: String,
    pub name: String,
    pub skill: Option<String>,
    pub prompt: String,
}

/// A directed dependency between two steps: `from` must complete before `to`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepDependency {
    pub from: String,
    pub to: String,
}

// ── Runtime types (mutable, not serialised) ───────────────────────────────────

/// Full runtime state of a running or completed workflow.
#[derive(Debug, Clone)]
pub struct WorkflowState {
    pub id: Uuid,
    pub definition: WorkflowDefinition,
    pub steps: Vec<StepState>,
    pub status: WorkflowStatus,
}

/// Runtime state of a single workflow step.
#[derive(Debug, Clone)]
pub struct StepState {
    pub id: String,
    pub status: StepStatus,
    pub result: Option<String>,
    pub error: Option<String>,
    pub tokens_used: u64,
}

/// Top-level workflow execution status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

/// Per-step execution status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Blocked,
    Running,
    Completed,
    Failed,
}

// ── Events emitted during execution ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowEvent {
    Started {
        id: Uuid,
    },
    StepStarted {
        workflow_id: Uuid,
        step_id: String,
    },
    StepCompleted {
        workflow_id: Uuid,
        step_id: String,
        result: Option<String>,
    },
    StepFailed {
        workflow_id: Uuid,
        step_id: String,
        error: String,
    },
    Completed {
        id: Uuid,
    },
    Failed {
        id: Uuid,
        error: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_pattern_serde() {
        let p = WorkflowPattern::Sequential;
        let json = serde_json::to_string(&p).unwrap();
        assert_eq!(json, "\"sequential\"");
        let back: WorkflowPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(back, WorkflowPattern::Sequential);
    }

    #[test]
    fn step_status_serde() {
        let s = StepStatus::Completed;
        let json = serde_json::to_string(&s).unwrap();
        assert_eq!(json, "\"completed\"");
    }

    #[test]
    fn workflow_definition_serde() {
        let def = WorkflowDefinition {
            name: "test".into(),
            pattern: WorkflowPattern::Sequential,
            steps: vec![WorkflowStepDefinition {
                id: "s1".into(),
                name: "Step 1".into(),
                skill: None,
                prompt: "Do it".into(),
            }],
            dependencies: vec![],
        };
        let json = serde_json::to_string(&def).unwrap();
        assert!(json.contains("test"));
        assert!(json.contains("s1"));
    }
}
