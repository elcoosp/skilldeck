//! Unit tests for WorkflowGraph — cycle detection, topological ordering,
//! dependency queries, and ready-step selection.

use skilldeck_core::workflow::{
    graph::WorkflowGraph,
    types::{StepDependency, WorkflowDefinition, WorkflowPattern, WorkflowStepDefinition},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_step(id: &str) -> WorkflowStepDefinition {
    WorkflowStepDefinition {
        id: id.to_string(),
        name: id.to_string(),
        skill: None,
        prompt: format!("Do {}", id),
    }
}

fn dep(from: &str, to: &str) -> StepDependency {
    StepDependency {
        from: from.to_string(),
        to: to.to_string(),
    }
}

fn linear_def(steps: &[&str]) -> WorkflowDefinition {
    let step_defs: Vec<_> = steps.iter().map(|s| make_step(s)).collect();
    let deps: Vec<_> = steps
        .windows(2)
        .map(|w| dep(w[0], w[1]))
        .collect();
    WorkflowDefinition {
        name: "test".into(),
        pattern: WorkflowPattern::Sequential,
        steps: step_defs,
        dependencies: deps,
    }
}

// ── Construction ──────────────────────────────────────────────────────────────

#[test]
fn empty_graph_is_valid() {
    let g = WorkflowGraph::new();
    assert!(g.validate().is_ok());
}

#[test]
fn single_step_graph_is_valid() {
    let def = WorkflowDefinition {
        name: "single".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a")],
        dependencies: vec![],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.validate().is_ok());
}

#[test]
fn linear_chain_builds_correctly() {
    let def = linear_def(&["a", "b", "c"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.validate().is_ok());
}

// ── Cycle detection ───────────────────────────────────────────────────────────

#[test]
fn direct_cycle_is_rejected() {
    // a -> b -> a
    let def = WorkflowDefinition {
        name: "cycle".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a"), make_step("b")],
        dependencies: vec![dep("a", "b"), dep("b", "a")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(
        g.validate().is_err(),
        "direct cycle a->b->a must be rejected"
    );
}

#[test]
fn self_loop_is_rejected() {
    let def = WorkflowDefinition {
        name: "self-loop".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a")],
        dependencies: vec![dep("a", "a")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.validate().is_err(), "self-loop must be rejected");
}

#[test]
fn longer_cycle_is_rejected() {
    // a -> b -> c -> a
    let def = WorkflowDefinition {
        name: "tri-cycle".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a"), make_step("b"), make_step("c")],
        dependencies: vec![dep("a", "b"), dep("b", "c"), dep("c", "a")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.validate().is_err());
}

#[test]
fn diamond_dag_is_valid() {
    // a -> b, a -> c, b -> d, c -> d  (diamond, no cycle)
    let def = WorkflowDefinition {
        name: "diamond".into(),
        pattern: WorkflowPattern::Parallel,
        steps: vec![make_step("a"), make_step("b"), make_step("c"), make_step("d")],
        dependencies: vec![dep("a", "b"), dep("a", "c"), dep("b", "d"), dep("c", "d")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.validate().is_ok(), "diamond DAG must be valid");
}

// ── Topological order ─────────────────────────────────────────────────────────

#[test]
fn linear_chain_order_is_sequential() {
    let def = linear_def(&["step1", "step2", "step3"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    let order = g.execution_order().unwrap();
    // step1 must come before step2, step2 before step3
    let pos = |id: &str| order.iter().position(|s| s == id).unwrap();
    assert!(pos("step1") < pos("step2"));
    assert!(pos("step2") < pos("step3"));
}

#[test]
fn diamond_order_respects_dependencies() {
    let def = WorkflowDefinition {
        name: "diamond".into(),
        pattern: WorkflowPattern::Parallel,
        steps: vec![make_step("a"), make_step("b"), make_step("c"), make_step("d")],
        dependencies: vec![dep("a", "b"), dep("a", "c"), dep("b", "d"), dep("c", "d")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    let order = g.execution_order().unwrap();
    let pos = |id: &str| order.iter().position(|s| s == id).unwrap();
    assert!(pos("a") < pos("b"));
    assert!(pos("a") < pos("c"));
    assert!(pos("b") < pos("d"));
    assert!(pos("c") < pos("d"));
}

#[test]
fn cyclic_graph_returns_err_from_execution_order() {
    let def = WorkflowDefinition {
        name: "cycle".into(),
        pattern: WorkflowPattern::Sequential,
        steps: vec![make_step("a"), make_step("b")],
        dependencies: vec![dep("a", "b"), dep("b", "a")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert!(g.execution_order().is_err());
}

// ── dependencies / dependents ─────────────────────────────────────────────────

#[test]
fn dependencies_returns_prerequisites() {
    // b depends on a, c depends on b
    let def = linear_def(&["a", "b", "c"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert_eq!(g.dependencies("a"), Vec::<String>::new());
    assert_eq!(g.dependencies("b"), vec!["a"]);
    assert_eq!(g.dependencies("c"), vec!["b"]);
}

#[test]
fn dependents_returns_successors() {
    let def = linear_def(&["a", "b", "c"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    assert_eq!(g.dependents("a"), vec!["b"]);
    assert_eq!(g.dependents("b"), vec!["c"]);
    assert_eq!(g.dependents("c"), Vec::<String>::new());
}

// ── ready_steps ───────────────────────────────────────────────────────────────

#[test]
fn first_step_is_ready_when_no_deps_completed() {
    let def = linear_def(&["a", "b", "c"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    // Nothing completed yet — only "a" has no prerequisites
    let pending = vec!["a", "b", "c"];
    let ready = g.ready_steps(&pending);
    assert_eq!(ready, vec!["a"]);
}

#[test]
fn next_steps_unlock_after_completion() {
    let def = linear_def(&["a", "b", "c"]);
    let g = WorkflowGraph::from_definition(&def).unwrap();
    // "a" is done — "b" and "c" are pending, but only "b" is ready
    let pending = vec!["b", "c"];
    let ready = g.ready_steps(&pending);
    assert_eq!(ready, vec!["b"]);
}

#[test]
fn parallel_steps_are_both_ready_when_deps_met() {
    // a -> b, a -> c  (b and c both depend only on a)
    let def = WorkflowDefinition {
        name: "fan-out".into(),
        pattern: WorkflowPattern::Parallel,
        steps: vec![make_step("a"), make_step("b"), make_step("c")],
        dependencies: vec![dep("a", "b"), dep("a", "c")],
    };
    let g = WorkflowGraph::from_definition(&def).unwrap();
    let pending = vec!["b", "c"];
    let ready = g.ready_steps(&pending);
    assert_eq!(ready.len(), 2, "both b and c should be ready after a completes");
    assert!(ready.contains(&"b"));
    assert!(ready.contains(&"c"));
}


