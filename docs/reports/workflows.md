Let me read the key workflow-related files and the rest of the codebase in detail.Now I have a thorough understanding of the entire workflow system. Let me synthesize everything I've found.Now I have everything I need. Let me create the comprehensive plan.Here's the full deep-dive and plan.

---

## What I found in the codebase

**The workflow engine is complete and production-quality.** The Rust core has a full DAG executor with three patterns (`sequential`, `parallel`, `evaluator_optimizer`), live event streaming via Tokio channels, DB models for definitions/executions/steps, and five Tauri commands (`save`, `list`, `get`, `delete`, `run`). The frontend has `use-workflow-definitions.ts`, `use-workflow-events.ts`, `workflow-editor.tsx`, and `workflow-graph.tsx` — all wired up.

**The UX problem:** Everything is buried inside `WorkflowTab()` in `right-panel.tsx` — a narrow `ScrollArea` column that shares real estate with Session, Skills, MCP, Analytics, and Artifacts. Creating a workflow means editing a raw JSON textarea (a `<Textarea rows={20} className="font-mono text-xs"/>`). The `WorkflowGraph` component (ReactFlow) is only rendered when you manually select a saved workflow from the list. The live execution progress from `useWorkflowEvents` never shows the graph updating. The whole tab is also gated behind `unlockStage >= 3`, so most users never reach it.

---

## The plan, phase by phase

**Phase 1 — Visual builder** (replace the JSON textarea in `workflow-editor.tsx`)

The `WorkflowDefinition` type is clean: `name`, `pattern` enum, `steps[]`, and `dependencies[]`. Build a `WorkflowBuilder` component that renders a list of `WorkflowStepCard` components — each card has inputs for `id`, `name`, `prompt`, and a skill picker (`useUnifiedSkills` already exists). A separate row of chip selectors handles `pattern`. Dependencies can be expressed as a simple "depends on" multi-select per step. The `WorkflowGraph` (ReactFlow) should sit live in the editor, updating as you add/remove steps, not just on save. The `dependencies` array maps directly to ReactFlow edges.

**Phase 2 — Live execution panel** (upgrade `WorkflowTab` during a run)

`useWorkflowEvents` already tracks `started / step_started / step_completed / step_failed / completed / failed`. Right now the tab renders a collapsed list with a dot and status text. It should switch to a timeline view when a workflow is running: each step gets a pill that animates between `pending → running (pulse) → completed/failed`. The `WorkflowGraph` should be mounted persistently and receive `stepStatuses` from the event hook so node borders animate in real time. Step results should expand inline (the accordion pattern is already there, just needs richer presentation). The `error` field surfaces as a banner, not just a red dot.

**Phase 3 — Entry points** (make workflows reachable)

Right now there's no way to trigger a workflow except by clicking a tiny play button in a narrow right-panel tab. Three additions:

- The **command palette** (`command-palette.tsx`) should have a "Run workflow…" action that lists saved definitions. The command palette already has a search-and-select pattern.
- A **/workflow** slash command in `message-input.tsx` — the input already handles `@mentions` and context chips; a `/workflow <name>` slash trigger fits naturally and would run a workflow in the context of the current conversation.
- The **library view** in `WorkflowTab` should show cards with last-run date, last status (a colored badge), and a one-click Run button — not a row of tiny icon buttons.

**Phase 4 — Full-panel surface** (promote workflows from a tab to a first-class section)

The left panel currently only lists conversations. Add a "Workflows" nav item (a `GitBranch` icon already imported in `right-panel.tsx`) that switches `CenterPanel` into a workflow-focused view. This view has two columns: a library list on the left and the builder/run-panel on the right. This also removes the `unlockStage >= 3` gate — or at minimum reduces it to stage 1 so users see it earlier.

The `workflow_executions` and `workflow_steps` DB models are already defined in `skilldeck-models` but have no corresponding Tauri query commands — adding `list_workflow_executions` would unlock an execution history view showing past runs with their step results and token costs (the `tokens_used` field is already on `StepState`).

---

## Quick wins to do first

The two lowest-effort, highest-impact changes: replace the JSON textarea with a structured step-card form (pure frontend, no Rust changes needed), and add `WorkflowGraph` as a persistent live preview in the tab (it already exists, just needs to be mounted unconditionally and fed `progress.steps` as `stepStatuses`). Both can ship in isolation and immediately make the feature feel intentional.
