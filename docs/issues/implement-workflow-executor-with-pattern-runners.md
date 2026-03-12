---
id: implement-workflow-executor-with-pattern-runners
title: Implement workflow executor with pattern runners
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#11-chunk-8-workflow-engine
state: open
createdAt: '2026-03-12T13:56:20.462Z'
priority: should
effort: 2d
dependencies:
  - Implement workflow types and graph structure
---
## Context

The workflow executor orchestrates workflow execution, running steps in dependency order and supporting sequential, parallel, and evaluator-optimizer patterns.

**Related Plan Section:**
- [Chunk 8: Workflow Engine](../plans/v1.md#11-chunk-8-workflow-engine)

**Related Requirements:**
- [REQ-FUNC-090](../spec/srs.md#req-func-090) - Execute in topological order
- [REQ-FUNC-091](../spec/srs.md#req-func-091) - Execute independent steps in parallel
- [REQ-FUNC-092](../spec/srs.md#req-func-092) - Display DAG visualization
- [REQ-FUNC-093](../spec/srs.md#req-func-093) - Block dependent steps on failure
- [REQ-FUNC-094](../spec/srs.md#req-func-094) - Notify workflow completion

## Problem Statement

We need to implement the workflow executor that runs workflows according to their pattern, manages step state, and emits events for UI updates.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/workflow/executor.rs` — WorkflowExecutor implementation
- `src-tauri/skilldeck-core/src/workflow/sequential.rs` — Sequential runner
- `src-tauri/skilldeck-core/src/workflow/parallel.rs` — Parallel runner
- `src-tauri/skilldeck-core/src/workflow/eval_opt.rs` — Evaluator-optimizer runner

**WorkflowExecutor:**
- `new(tx)` — Create executor with event channel
- `execute(definition)` — Execute workflow
- `execute_sequential(workflow, graph, order)` — Run sequential pattern
- `execute_parallel(workflow, graph)` — Run parallel pattern
- `execute_eval_opt(workflow, graph, order)` — Run evaluator-optimizer pattern
- `execute_step(workflow, step_id)` — Execute single step

**WorkflowState:**
- `id` — Execution ID
- `definition` — Workflow definition
- `steps` — Step states
- `status` — Workflow status

**StepStatus:**
- `Pending` — Not started
- `Blocked` — Waiting for dependencies
- `Running` — Currently executing
- `Completed` — Finished successfully
- `Failed` — Errored

**WorkflowEvent:**
- `Started { id }`
- `StepStarted { workflow_id, step_id }`
- `StepCompleted { workflow_id, step_id, result }`
- `Completed { id }`

## Acceptance Criteria

- [ ] Executes sequential workflows correctly
- [ ] Executes parallel workflows with JoinSet
- [ ] Executes evaluator-optimizer loops
- [ ] Blocks dependent steps on failure
- [ ] Emits workflow events
- [ ] Manages step state
- [ ] Unit tests verify execution
- [ ] Integration tests verify patterns

## Testing Requirements

**Unit tests:**
- `executor_creates_workflow` — Workflow is created

**Integration tests:**
- `sequential_execution` — Steps execute in order
- `parallel_execution` — Independent steps run concurrently
- `evaluator_optimizer` — Loop iterates correctly

**BDD scenarios:**
- [SC-FUNC-021](../spec/test-verification.md#sc-func-021) - Define workflow with DAG
- [SC-FUNC-022](../spec/test-verification.md#sc-func-022) - Execute sequential workflow
- [SC-FUNC-023](../spec/test-verification.md#sc-func-023) - Execute parallel workflow
- [SC-FUNC-025](../spec/test-verification.md#sc-func-025) - Evaluator-optimizer pattern

## Dependencies

- **Blocked by:** Workflow types and graph
- **Blocks:** Subagent management

## Effort Estimate

- **Complexity:** High
- **Effort:** 2d
