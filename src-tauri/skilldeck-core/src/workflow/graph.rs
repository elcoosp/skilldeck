//! Workflow DAG — petgraph-backed directed acyclic graph with topo-sort.

use petgraph::{Direction, Graph, algo::toposort, graph::NodeIndex};
use std::collections::HashMap;

use super::types::WorkflowDefinition;
use crate::CoreError;

pub struct WorkflowGraph {
    graph: Graph<String, ()>,
    step_indices: HashMap<String, NodeIndex>,
}

impl WorkflowGraph {
    pub fn new() -> Self {
        Self {
            graph: Graph::new(),
            step_indices: HashMap::new(),
        }
    }

    /// Build and validate a graph from a workflow definition.
    pub fn from_definition(def: &WorkflowDefinition) -> Result<Self, CoreError> {
        let mut g = Self::new();
        for step in &def.steps {
            g.add_step(&step.id);
        }
        for dep in &def.dependencies {
            g.add_dependency(&dep.from, &dep.to)?;
        }
        g.validate()?;
        Ok(g)
    }

    fn add_step(&mut self, id: &str) {
        let idx = self.graph.add_node(id.to_string());
        self.step_indices.insert(id.to_string(), idx);
    }

    fn add_dependency(&mut self, from: &str, to: &str) -> Result<(), CoreError> {
        let from_idx = self.step_indices.get(from).copied().ok_or_else(|| {
            CoreError::WorkflowInvalidDefinition {
                message: format!("Unknown step: {}", from),
            }
        })?;
        let to_idx = self.step_indices.get(to).copied().ok_or_else(|| {
            CoreError::WorkflowInvalidDefinition {
                message: format!("Unknown step: {}", to),
            }
        })?;
        self.graph.add_edge(from_idx, to_idx, ());
        Ok(())
    }

    /// Return `Err` if the graph contains a cycle.
    pub fn validate(&self) -> Result<(), CoreError> {
        toposort(&self.graph, None)
            .map(|_| ())
            .map_err(|_| CoreError::WorkflowCycle {
                cycle_path: "Cycle detected in workflow graph".to_string(),
            })
    }

    /// Topological execution order (all steps in a valid sequence).
    pub fn execution_order(&self) -> Result<Vec<String>, CoreError> {
        let sorted = toposort(&self.graph, None).map_err(|_| CoreError::WorkflowCycle {
            cycle_path: "Cycle detected".to_string(),
        })?;
        Ok(sorted
            .into_iter()
            .map(|idx| self.graph[idx].clone())
            .collect())
    }

    /// Steps that `step_id` directly depends on (incoming edges).
    pub fn dependencies(&self, step_id: &str) -> Vec<String> {
        let Some(&idx) = self.step_indices.get(step_id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, Direction::Incoming)
            .map(|i| self.graph[i].clone())
            .collect()
    }

    /// Steps that depend on `step_id` (outgoing edges).
    pub fn dependents(&self, step_id: &str) -> Vec<String> {
        let Some(&idx) = self.step_indices.get(step_id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, Direction::Outgoing)
            .map(|i| self.graph[i].clone())
            .collect()
    }

    /// Steps that have no unfulfilled dependencies among `pending`.
    pub fn ready_steps<'a>(&self, pending: &[&'a str]) -> Vec<&'a str> {
        pending
            .iter()
            .copied()
            .filter(|&id| {
                let deps = self.dependencies(id);
                deps.iter().all(|d| !pending.contains(&d.as_str()))
            })
            .collect()
    }
}

impl Default for WorkflowGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::types::*;

    fn two_step_def() -> WorkflowDefinition {
        WorkflowDefinition {
            name: "test".into(),
            pattern: WorkflowPattern::Sequential,
            steps: vec![
                WorkflowStepDefinition {
                    id: "step1".into(),
                    name: "S1".into(),
                    skill: None,
                    prompt: "p1".into(),
                },
                WorkflowStepDefinition {
                    id: "step2".into(),
                    name: "S2".into(),
                    skill: None,
                    prompt: "p2".into(),
                },
            ],
            dependencies: vec![StepDependency {
                from: "step1".into(),
                to: "step2".into(),
            }],
        }
    }

    #[test]
    fn valid_graph_ok() {
        let g = WorkflowGraph::from_definition(&two_step_def()).unwrap();
        assert!(g.validate().is_ok());
    }

    #[test]
    fn execution_order_is_topo() {
        let g = WorkflowGraph::from_definition(&two_step_def()).unwrap();
        let order = g.execution_order().unwrap();
        assert_eq!(order, vec!["step1", "step2"]);
    }

    #[test]
    fn dependencies_correct() {
        let g = WorkflowGraph::from_definition(&two_step_def()).unwrap();
        assert_eq!(g.dependencies("step2"), vec!["step1"]);
        assert!(g.dependencies("step1").is_empty());
    }

    #[test]
    fn cycle_detection_errors() {
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
        assert!(WorkflowGraph::from_definition(&def).is_err());
    }

    #[test]
    fn unknown_step_dependency_errors() {
        let def = WorkflowDefinition {
            name: "bad".into(),
            pattern: WorkflowPattern::Sequential,
            steps: vec![WorkflowStepDefinition {
                id: "a".into(),
                name: "A".into(),
                skill: None,
                prompt: "".into(),
            }],
            dependencies: vec![StepDependency {
                from: "a".into(),
                to: "nonexistent".into(),
            }],
        };
        assert!(WorkflowGraph::from_definition(&def).is_err());
    }

    #[test]
    fn ready_steps_respects_pending() {
        let g = WorkflowGraph::from_definition(&two_step_def()).unwrap();
        // step2 is blocked because step1 is still pending
        let ready = g.ready_steps(&["step1", "step2"]);
        assert_eq!(ready, vec!["step1"]);
        // once step1 is done (removed from pending), step2 becomes ready
        let ready2 = g.ready_steps(&["step2"]);
        assert_eq!(ready2, vec!["step2"]);
    }
}
