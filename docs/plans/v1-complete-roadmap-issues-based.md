# SkillDeck v1 Roadmap

This roadmap outlines the remaining work to complete the SkillDeck v1 release, based on the current state of the codebase and the detailed issue tracking. It prioritises stability, core functionality, and the new context‑injection features recently added.

## Current Status Overview

The project is in a strong state: all foundational layers (database, error handling, plugin traits, model providers, MCP client, skill system, Tauri shell, and React foundation) are implemented and closed. Several features are already functional:

- Conversations, profiles, and settings management
- Agent loop with streaming and debouncing (core loop works)
- Skill loading, resolution, and hot‑reload
- MCP server management (stdio/SSE transports, registry)
- Basic conversation UI with virtualisation
- Platform integration (nudges, referrals, preferences)
- Context injection (`@` for skills, `#` for files) – **new**

However, a number of tasks remain open or are partially complete, and several new features need polish and testing. The roadmap below groups work into logical phases, each delivering a coherent increment towards the final v1.0.

---

## Phase 1: Core Stability & Agent Loop Completion
**Goal:** Ensure the agent loop is robust, cancellable, and fully tested; wire up built‑in tools and auto‑approval.

| Task | Issue | Effort |
|------|-------|--------|
| Wire cancellation token to `cancel_agent` command | #2 | 0.5d |
| Implement real `spawnSubagent` and `mergeSubagentResults` | #3 | 1d |
| Connect auto‑approve settings to tool dispatcher | #30 | 0.5d |
| Add integration tests for Claude provider (mock) | #4 | 1d |
| Add integration tests for MCP stdio transport (mock) | #13 | 1d |
| Implement actual reconnection in MCP supervisor | #14 | 1d |
| **Phase 1 total** | | **4d** |

---

## Phase 2: Skill Marketplace Polish
**Goal:** Deliver a seamless skill browsing and installation experience, including conflict resolution and offline handling.

| Task | Issue | Effort |
|------|-------|--------|
| Implement TOON encoding in context builder | #5 | 1d |
| Wire up real agent calls in workflow executor | #31 | 2d |
| Add multiple‑conversation export (ZIP) | #27 | 0.5d |
| Ensure platform sync works with offline registry fallback | (new) | 1d |
| Add unit tests for `use-unified-skills` hook | (new) | 0.5d |
| **Phase 2 total** | | **5d** |

---

## Phase 3: Context Injection & Chat Experience
**Goal:** Complete the new context‑injection features and integrate them with the agent loop.

| Task | Issue | Effort |
|------|-------|--------|
| Finalise file picker error handling (permissions, large files) | (new) | 0.5d |
| Add skill lint warnings display in context chips | (new) | 0.5d |
| Ensure security warning dialog appears for high‑risk skills | (new) | 0.5d |
| Implement message queuing while agent runs (already partial) | (new) | 0.5d |
| Write E2E tests for all context‑injection flows | (new) | 1d |
| **Phase 3 total** | | **3d** |

---

## Phase 4: Workflow Engine & Subagents
**Goal:** Make workflows truly multi‑agent, with visual feedback and persistent sessions.

| Task | Issue | Effort |
|------|-------|--------|
| Wire subagent spawning to real agent loop instances | #24 | 2d |
| Implement DAG visualisation in Workflow tab | #20 | 2d |
| Add real token usage data to Analytics tab | #20 | 1d |
| Emit workflow events to Tauri (bridge) | #28 | 0.5d |
| **Phase 4 total** | | **5.5d** |

---

## Phase 5: Onboarding & Progressive Unlock
**Goal:** Guide new users and gradually reveal advanced features.

| Task | Issue | Effort |
|------|-------|--------|
| Implement unlock notifications when features become available | #17 | 1d |
| Wire `unlockStage` in UI store to actual feature gates | #17 | 0.5d |
| Add playground banner for first‑time users | (new) | 0.5d |
| **Phase 5 total** | | **2d** |

---

## Phase 6: Testing – Unit, Integration, BDD, NFR
**Goal:** Achieve high confidence through comprehensive testing.

| Task | Issue | Effort |
|------|-------|--------|
| Write missing unit tests for provider, database, agent loop | #39 | 2d |
| Write integration tests for skill resolution, MCP client | #37 | 2d |
| Write BDD scenarios for critical user journeys | #36 | 3d |
| Write NFR tests (performance, security, accessibility) | #38 | 2d |
| **Phase 6 total** | | **9d** |

---

## Phase 7: Final Polish & Release Readiness
**Goal:** Ensure the application is performant, accessible, and ready for distribution.

| Task | Issue | Effort |
|------|-------|--------|
| Verify keyboard navigation (WCAG) | #19 | 0.5d |
| Verify responsive layout on all supported panel sizes | #19 | 0.5d |
| Check colour contrast and screen‑reader labels | #38 | 0.5d |
| Run full end‑to‑end test suite (Playwright) | (new) | 0.5d |
| Update documentation (README, contributing guide) | (new) | 1d |
| **Phase 7 total** | | **3d** |

---

## Summary of Remaining Effort

| Phase | Effort |
|-------|--------|
| 1 – Core Stability | 4d |
| 2 – Skill Marketplace | 5d |
| 3 – Context Injection | 3d |
| 4 – Workflow Engine | 5.5d |
| 5 – Onboarding | 2d |
| 6 – Testing | 9d |
| 7 – Polish | 3d |
| **Total** | **31.5d** |

This is a realistic estimate assuming focused work; parallelisation can shorten the calendar time. The roadmap is designed to deliver value incrementally – after Phase 1 the agent loop will be robust, after Phase 2 the skill marketplace will be feature‑complete, and so on.

---

## How to Use This Roadmap

- Each phase can be worked on concurrently by different team members (frontend/backend).
- Issues marked with `(new)` are not yet tracked in GitHub; they should be created as separate issues.
- Progress should be tracked against the issue numbers provided; when an issue is closed, update this roadmap accordingly.
- At the end of each phase, a brief demo/validation is recommended to ensure the goals are met.

**Let’s ship SkillDeck v1!**
