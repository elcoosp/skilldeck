# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Desktop app shell: Tauri 2 on macOS/Windows/Linux. The UI surface being designed is the React web layer rendered inside the Tauri window; all design work targets that web view. Inferred from repository: `src-tauri/`, README platform badges. Session runs render the same React UI in a browser via the Vite dev server.)

## Users

Primary user (inferred from README positioning and docs): professional developers and small teams who work with proprietary code and refuse to paste it into cloud AI tools. They run multi-agent coding workflows daily, in long focused sessions, on a desktop workstation, often in dark rooms / dark-mode editors. The job: orchestrate local AI agents (Claude, OpenAI, Ollama) over their own filesystem, skills, and MCP servers with full approval control.

Secondary audience (inferred): open-source contributors evaluating the project's credibility from its UI craft.

## Product Purpose

SkillDeck is a local-first, native desktop AI orchestration platform. It brings branching conversations, multi-agent workflows (sequential / parallel / evaluator-optimizer), filesystem-based skills (`SKILL.md` packages), and MCP integration into one Tauri 2 app so that code, prompts, and API keys never leave the machine. Success means: a developer sets up a workspace, runs an agent conversation or workflow with skills and MCP tools gated by approvals, and trusts the tool enough to keep it open all day as their AI workbench.

## Positioning

The mechanism a cloud assistant cannot copy: everything runs locally — SQLite storage, OS-keychain API keys, local skill resolution (workspace > personal > registry), approval-gated tool calls, and transparent event streams. "Your code stays yours. Your agents work for you." The interface must radiate control, transparency, and privacy-by-construction, not cloud-SaaS playfulness.

## Operating Context

- Three-panel desktop workbench: left rail (workspaces + conversations), center (conversation thread), right panel (Session / Skills / MCP / Artifacts / Files / Workflow / Analytics tabs).
- Settings is a modal overlay with 12 sections (API Keys, Profiles, Tool Approvals, Appearance, Preferences, Platform, Referral, Lint, Skill Sources, Shortcuts, Achievements, Workflows).
- Overlays: onboarding wizard (first run), command palette (⌘K), global search (⌘⇧F), share-skill/install dialogs, splash screen at boot.
- Long-lived sessions: users keep the app open for hours; density and glanceability matter; motion must never delay the task.

## Capabilities and Constraints

- Stack (existing, must preserve): React 19 + TypeScript + Vite 8 + Tailwind CSS 4 (CSS-first tokens in `src/App.css`) + shadcn/ui (new-york, Radix) + TanStack Router/Query + Zustand + framer-motion + lucide-react icons + Lingui i18n + Tauri 2 IPC (`src/lib/bindings.ts`).
- UI copy is internationalized through Lingui macros in many components; visual redesign must not break `t\`\`` usages.
- Feature set fixed: conversations with branches/queue, skills (local/registry with lint + trust scores), MCP servers, workflows (DAG editor), artifacts, files, analytics heatmap, achievements, approvals. The redesign changes the visual world, not the information architecture or features.
- Panel sizes persist to localStorage; theme (light/dark/system) and UI font size are user settings — both light and dark themes must ship at equal fidelity.
- Empty states ship as Lottie/SVG illustrations under `public/illustrations/` and may be restyled but not deleted.

## Brand Commitments

- Name: SkillDeck. Logo: `public/logo.svg` — three overlapping rounded squares fanned like a dealt hand of cards (blue gradient + slate cards). The deck-of-cards metaphor is the brand's own (onboarding copy: "Deal me in", "You're ready to deal!").
- Tagline voice (README): privacy-assertive, engineer-to-engineer, no hype.
- No commercial claims may be invented (no fake customer counts, benchmarks, or prices).

## Evidence on Hand

- README.md, ARCHITECTURE.md, docs/spec + docs/design (SRS, UX docs), skilldeck-user-docs (Starlight docs site), skilldeck-landing (Next.js marketing site — out of scope for this run).
- Existing UI implementation across ~180 TSX components (the incumbent world to be replaced: slate neutrals, blue #3b82f6 primary, orange #ff8a4c accent, Poppins everywhere).
- No testimonials, usage metrics, or customer evidence exist in the repo; none may be fabricated.

## Product Principles

1. **Local means yours** — every surface should make ownership, privacy, and control visible (profiles, approvals, local paths, keys) without shouting.
2. **A workbench, not a website** — dense, scannable, keyboard-first tool UI; the tool disappears into the task; consistency across every screen is the premium signal.
3. **Transparency is the feature** — agent activity, tool calls, tokens, and lint results are first-class citizens of the design, never hidden behind decoration.
4. **Calm authority** — restrained color doing real jobs, one authored moment instead of scattered effects, motion that reports state.
5. **Both themes are the product** — light and dark ship together, same hierarchy, same craft.

## Accessibility & Inclusion

- Desktop tool used for long sessions: body/placeholder contrast ≥4.5:1, large text ≥3:1, visible focus rings, full keyboard operability (existing hotkey system), respect `prefers-reduced-motion` for the framer-motion layer.
- Font-size setting (sm/md/lg) must keep layouts intact.
