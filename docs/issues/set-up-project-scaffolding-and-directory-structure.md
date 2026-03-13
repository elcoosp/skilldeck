---
id: set-up-project-scaffolding-and-directory-structure
title: Set up project scaffolding and directory structure
labels:
  - infrastructure
  - 'priority:must'
  - 'type:chore'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#3-project-scaffolding
state: in-progress
createdAt: '2026-03-12T13:51:42.837Z'
priority: must
effort: 1d
---
## Context

This issue establishes the foundational project structure for SkillDeck v1. The project uses a Tauri 2 desktop application with a Rust core (`skilldeck-core`) and React frontend. Proper scaffolding ensures consistent development workflow and clear separation of concerns.

**Related Plan Section:**
- [Project Scaffolding](../plans/v1.md#3-project-scaffolding) - Canonical file structure

**Related Requirements:**
- [REQ-CON-002](../spec/srs.md#req-con-002) - Tauri 2 framework
- [REQ-CON-006](../spec/srs.md#req-con-006) - React frontend communicates only via Tauri IPC
- [REQ-CON-007](../spec/srs.md#req-con-007) - All business logic in Rust core

**Related Architecture:**
- [ADR-001](../spec/archi.md#adr-001-three-layer-architecture-rust-core--tauri-shell--react-ui) - Three-layer architecture

## Problem Statement

We need to create the complete project scaffolding including the Tauri shell, Rust core library crate, and React frontend with all necessary configuration files, dependencies, and build tooling.

## Solution Approach

### Implementation Details

**Files to create:**

1. **Root configuration files:**
   - `package.json` — Frontend dependencies (React 19, TanStack Query, Zustand, shadcn/ui, etc.)
   - `tsconfig.json` — TypeScript configuration with strict mode
   - `vite.config.ts` — Vite build configuration
   - `tailwind.config.ts` — Tailwind CSS configuration
   - `postcss.config.js` — PostCSS configuration
   - `.eslintrc.cjs` — ESLint configuration
   - `.prettierrc` — Prettier configuration
   - `lingui.config.ts` — i18n configuration

2. **Tauri configuration:**
   - `src-tauri/Cargo.toml` — Workspace with skilldeck-core member
   - `src-tauri/tauri.conf.json` — Tauri configuration
   - `src-tauri/build.rs` — Build script
   - `src-tauri/src/main.rs` — Entry point
   - `src-tauri/src/lib.rs` — Library root

3. **Rust core library:**
   - `src-tauri/skilldeck-core/Cargo.toml` — Core dependencies
   - `src-tauri/skilldeck-core/src/lib.rs` — Core library entry
   - `src-tauri/skilldeck-core/src/error.rs` — Core error types (stub)

4. **Frontend structure:**
   - `src/main.tsx` — React entry point
   - `src/App.tsx` — Root component
   - `src/index.css` — Global styles
   - `src/lib/` — Utility libraries
   - `src/store/` — Zustand stores
   - `src/hooks/` — React hooks
   - `src/components/` — UI components
   - `src/locales/` — i18n messages
   - `src/test/` — Test setup

5. **Test directories:**
   - `tests/features/` — BDD feature files
   - `tests/integration/` — Integration tests
   - `tests/performance/` — Performance benchmarks
   - `tests/security/` — Security tests

**Key interfaces:**
- `skilldeck-core` crate must have zero Tauri dependencies
- React frontend must communicate only via `@tauri-apps/api` invoke

## Acceptance Criteria

- [x] Project structure matches canonical file structure in plan (core library exists with modules)
- [ ] `cargo build` succeeds for both Tauri app and skilldeck-core (Tauri app not present)
- [ ] `pnpm install` succeeds with all frontend dependencies (frontend not present)
- [ ] `pnpm tauri dev` launches development server (not present)
- [x] `cargo test` runs without errors (core library tests pass)
- [ ] `pnpm test` runs without errors (no frontend)
- [ ] ESLint and Prettier configurations are valid (not present)
- [ ] TypeScript compiles without errors (not present)

## Testing Requirements

**Unit tests:**
- [x] Verify Cargo.toml workspace configuration (core library has its own Cargo.toml)

**Integration tests:**
- [ ] Verify Tauri dev server starts

## Dependencies

- **Blocked by:** None
- **Blocks:** All subsequent implementation issues

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** The Rust core library is fully scaffolded with modules. The Tauri shell and React frontend are not present. The project scaffolding is partially complete.
