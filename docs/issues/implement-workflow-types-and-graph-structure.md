---
id: implement-workflow-types-and-graph-structure
title: Implement workflow types and graph structure
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#11-chunk-8-workflow-engine
state: open
createdAt: '2026-03-12T13:56:20.461Z'
priority: should
effort: 1d
---
## Context

Workflows are defined as directed acyclic graphs (DAGs) with steps and dependencies. We need to define the type system and graph structure for workflow execution.

**Related Plan Section:**
- [Chunk 8: Workflow Engine](../plans/v1.md#11-chunk-8-workflow-engine)

**Related Requirements:**
- [REQ-FUNC-085](../spec/srs.md#req-func-085) - Define workflow with DAG
- [REQ-FUNC-086](../spec/srs.md#req-func-086) - Reject workflow with cycle
- [REQ-FUNC-087](../spec/srs.md#req-func-087) - Support three patterns
- [BR-009](../spec/bsr.md#br-009) - Workflow steps execute in topological order

**Related Architecture:**
- [ASR-STR-003](../spec/archi.md#asr-str-003) - Multi-agent workflows
- [ADR-006](../spec/archi.md#adr-006-petgraph-for-workflow-dag-execution) - Petgraph for workflow DAG

## Problem Statement

We need to implement the workflow type system including workflow definitions, step definitions, dependencies, and the graph structure using petgraph.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/workflow/mod.rs` — Workflow module
- `src-tauri/skilldeck-core/src/workflow/types.rs` — Type definitions
- `src-tauri/skilldeck-core/src/workflow/graph.rs` — Graph structure

**WorkflowPattern enum:**
- `Sequential` — Steps execute one after another
- `Parallel` — Independent steps execute concurrently
- `EvaluatorOptimizer` — Generator/evaluator loop

**WorkflowDefinition:**
- `name` — Workflow name
- `pattern` — Workflow pattern
- `steps` — List of step definitions
- `dependencies` — Step dependencies

**WorkflowStepDefinition:**
- `id` — Step identifier
- `name` — Human-readable name
- `skill` — Optional skill to use
- `prompt` — Task description

**StepDependency:**
- `from` — Source step ID
- `to` — Target step ID

**WorkflowGraph:**
- Uses `petgraph::DiGraph` for DAG representation
- `from_definition(def)` — Create graph from definition
- `validate()` — Check for cycles
- `execution_order()` — Topological sort
- `dependencies(step_id)` — Get dependencies
- `dependents(step_id)` — Get dependents

## Acceptance Criteria

- [ ] WorkflowDefinition serializes/deserializes correctly
- [ ] WorkflowPattern enum covers all patterns
- [ ] Graph validates for cycles
- [ ] Graph provides topological order
- [ ] Graph provides dependencies
- [ ] Graph provides dependents
- [ ] Unit tests verify cycle detection
- [ ] Unit tests verify execution order

## Testing Requirements

**Unit tests:**
- `valid_graph` — Valid workflow creates graph
- `execution_order` — Topological order is correct
- `dependencies` — Dependencies are returned
- `cycle_detection` — Cycles are detected

## Dependencies

- **Blocked by:** None
- **Blocks:** Workflow executor

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
