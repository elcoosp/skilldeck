# Test Coverage Report

Tracking the `src/` layer coverage toward the 80% goal (see `docs/superpowers/plans/2026-09-09-test-coverage-80.md`).

Measured with `npx vitest run --coverage` (istanbul, whole `src/` tree, auto-generated files excluded).

| Layer | Files | Executable lines | Covered | % |
|---|---|---|---|---|
| store | 12 | 206 | 201 | 97.6% |
| lib | 15 | 232 | 232 | 100.0% |
| hooks | 36 | 937 | 846 | 90.3% |
| components | 114 | 4804 | 1163 | 24.2% |
| routes | 19 | 304 | 0 | 0.0% |
| other (router.ts) | 1 | 1 | 0 | 0.0% |
| **Total** | 197 | 6484 | | |

> Snapshot date: 2026-09-12 (after Task 5.3). Suite state: 95 files / 572 tests, all green.

## Components layer detail

Updated after each 5.x sub-task. Line coverage % per conversation component:

| Component | Lines % | Notes |
|---|---|---|
| thinking-view | 100% | Task 5.1 |
| tool-approval-card | 100% | Task 5.1 |
| artifact-card | 100% | Task 5.1 |
| heading | 100% | Task 5.1 |
| tool-result-bubble | 94% | Task 5.1 |
| pinned-bar | 88% | Task 5.1 |
| branch-nav | 83% | Task 5.1 |
| suggested-prompts | 83% | Task 5.1 |
| subagent-card | 63% | Task 5.1 — happy-path only, defer |
| code-block | 31% | Task 5.1 — huge super-codeblock, defer |
| queue-pause-indicator | 100% | Task 5.2 |
| queue-edit-form | 100% | Task 5.2 |
| queue-header | 100% | Task 5.2 |
| queue-selection-toolbar | 100% | Task 5.2 |
| queue-item | 96% | Task 5.2 |
| queue-list | 59% | Task 5.2 — DnD drag/merge orchestration paths |
| empty-state-local | 100% | Task 5.3 |
| empty-state-registry | 100% | Task 5.3 |
| platform-status-banner | 100% | Task 5.3 |
| trust-badge | 100% | Task 5.3 |
| install-dialog | 86% | Task 5.3 |
| lint-warning-panel | 97% | Task 5.3 |
| share-skill-modal | 91% | Task 5.3 |
| blocked-skill-alert | 80% | Task 5.3 |
| conflict-resolver | 75% | Task 5.3 |
| unified-skill-card | 96% | Task 5.3 |
| skill-detail-panel | 66% | Task 5.3 — mutations/dialogs happy-path, defer |
| unified-skill-list | 54% | Task 5.3 — virtualization tuning |

> Skills layer (12 files, aggregate): statements 66.19%, lines 68.75%, functions 56.86%, branches 68.02%.