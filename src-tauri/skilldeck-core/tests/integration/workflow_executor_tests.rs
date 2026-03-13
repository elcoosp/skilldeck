//! Integration tests for WorkflowExecutor — event emission and state transitions.
//!
//! WorkflowExecutor owns no model provider; it delegates step execution to the
//! sequential/parallel/eval-opt strategies which produce stub results. These
//! tests verify the event channel contract and final WorkflowState correctness.

use skilldeck_core::workflow::{
    types::{
        StepDependency, StepStatus, WorkflowDefinition, WorkflowEvent, WorkflowPattern,
        WorkflowState, WorkflowStatus, WorkflowStepDefinition,
    },
    WorkflowExecutor,
};
use tokio::sync::mpsc;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_step(id: &str, prompt: &str) -> WorkflowStepDefinition {
    WorkflowStepDefinition {
        id: id.to_string(),
        name: id.to_string(),
        skill: None,
        prompt: prompt.to_string(),
    }
}

fn dep(from: &str, to: &str) -> StepDependency {
    StepDependency { from: from.to_string(), to: to.to_string() }
}

fn single_step_def(pattern: WorkflowPattern) -> WorkflowDefinition {
    WorkflowDefinition {
        name: "test".into(),
        pattern,
        steps: vec![make_step("step1", "Do the thing")],
        dependencies: vec![],
    }
}

fn linear_def(ids: &[&str]) -> WorkflowDefinition {
    let steps: Vec<_> = ids.iter().map(|id| make_step(id, id)).collect();
    let deps: Vec<_> = ids.windows(2).map(|w| dep(w[0], w[1])).collect();
    WorkflowDefinition {
        name: "linear".into(),
        pattern: WorkflowPattern::Sequential,
        steps,
        dependencies: deps,
    }
}

/// Drain the receiver and return all events collected (non-blocking after close).
async fn drain(mut rx: mpsc::Receiver<WorkflowEvent>) -> Vec<WorkflowEvent> {
    let mut events = Vec::new();
    while let Ok(e) = rx.try_recv() {
        events.push(e);
    }
    events
}

// ── Sequential execution ──────────────────────────────────────────────────────

#[tokio::test]
async fn single_sequential_step_returns_completed_state() {
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(single_step_def(WorkflowPattern::Sequential)).await.unwrap();
    assert_eq!(state.status, WorkflowStatus::Completed);
}

#[tokio::test]
async fn single_step_emits_started_then_completed_events() {
    let (tx, mut rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    executor.execute(single_step_def(WorkflowPattern::Sequential)).await.unwrap();

    let mut events = Vec::new();
    while let Ok(e) = rx.try_recv() {
        events.push(e);
    }

    assert!(
        events.iter().any(|e| matches!(e, WorkflowEvent::Started { .. })),
        "must emit Started"
    );
    assert!(
        events.iter().any(|e| matches!(e, WorkflowEvent::Completed { .. })),
        "must emit Completed"
    );
}

#[tokio::test]
async fn linear_three_steps_all_completed_in_state() {
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(linear_def(&["a", "b", "c"])).await.unwrap();

    assert_eq!(state.status, WorkflowStatus::Completed);
    assert_eq!(state.steps.len(), 3);
    for step in &state.steps {
        assert_eq!(
            step.status,
            StepStatus::Completed,
            "step {} should be Completed, got {:?}",
            step.id,
            step.status
        );
    }
}

#[tokio::test]
async fn sequential_emits_step_events_in_order() {
    let (tx, mut rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    executor.execute(linear_def(&["x", "y", "z"])).await.unwrap();

    let mut step_started_ids: Vec<String> = Vec::new();
    while let Ok(event) = rx.try_recv() {
        if let WorkflowEvent::StepStarted { step_id, .. } = event {
            step_started_ids.push(step_id);
        }
    }

    assert_eq!(step_started_ids, vec!["x", "y", "z"]);
}

#[tokio::test]
async fn workflow_state_id_is_unique_per_execution() {
    let (tx1, _) = mpsc::channel(64);
    let (tx2, _) = mpsc::channel(64);
    let e1 = WorkflowExecutor::new(tx1);
    let e2 = WorkflowExecutor::new(tx2);

    let s1 = e1.execute(single_step_def(WorkflowPattern::Sequential)).await.unwrap();
    let s2 = e2.execute(single_step_def(WorkflowPattern::Sequential)).await.unwrap();

    assert_ne!(s1.id, s2.id, "each execution must produce a unique workflow id");
}

// ── Parallel execution ────────────────────────────────────────────────────────

#[tokio::test]
async fn parallel_single_step_completes() {
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(single_step_def(WorkflowPattern::Parallel)).await.unwrap();
    assert_eq!(state.status, WorkflowStatus::Completed);
}

#[tokio::test]
async fn parallel_fan_out_all_steps_complete() {
    // a -> b, a -> c  (b and c run in parallel after a)
    let def = WorkflowDefinition {
        name: "fan-out".into(),
        pattern: WorkflowPattern::Parallel,
        steps: vec![
            make_step("a", "First"),
            make_step("b", "Second"),
            make_step("c", "Third"),
        ],
        dependencies: vec![dep("a", "b"), dep("a", "c")],
    };
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(def).await.unwrap();

    assert_eq!(state.status, WorkflowStatus::Completed);
    assert!(state.steps.iter().all(|s| s.status == StepStatus::Completed));
}

// ── Cycle → execute returns Err ───────────────────────────────────────────────

#[tokio::test]
async fn cyclic_definition_returns_err() {
    let def = WorkflowDefinition {
        name: "cycle".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a", "A"), make_step("b", "B")],
        dependencies: vec![dep("a", "b"), dep("b", "a")],
    };
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let result = executor.execute(def).await;
    assert!(result.is_err(), "cyclic workflow must return Err");
}

#[tokio::test]
async fn cyclic_definition_emits_no_started_event() {
    let def = WorkflowDefinition {
        name: "cycle".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a", "A"), make_step("b", "B")],
        dependencies: vec![dep("a", "b"), dep("b", "a")],
    };
    let (tx, mut rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let _ = executor.execute(def).await;

    let events: Vec<_> = std::iter::from_fn(|| rx.try_recv().ok()).collect();
    assert!(
        !events.iter().any(|e| matches!(e, WorkflowEvent::Started { .. })),
        "cycle error occurs before execution starts — no Started event expected"
    );
}

// ── WorkflowState step structure ──────────────────────────────────────────────

#[tokio::test]
async fn initial_step_states_match_definition_order() {
    let ids = ["alpha", "beta", "gamma"];
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(linear_def(&ids)).await.unwrap();

    let returned_ids: Vec<&str> = state.steps.iter().map(|s| s.id.as_str()).collect();
    assert_eq!(returned_ids, ids);
}

#[tokio::test]
async fn completed_state_has_all_steps_with_non_pending_status() {
    let (tx, _rx) = mpsc::channel(64);
    let executor = WorkflowExecutor::new(tx);
    let state = executor.execute(linear_def(&["p", "q"])).await.unwrap();

    for step in &state.steps {
        assert_ne!(
            step.status,
            StepStatus::Pending,
            "step {} must not be Pending after completion",
            step.id
        );
    }
}
