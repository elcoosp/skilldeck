# Steps to Build Awesome User-Facing Documentation for SkillDeck with Astro

As a brilliant documenter, you need a systematic approach that balances deep technical understanding with a clear user perspective. Below is a phased plan to transform your codebase into clear, actionable, and delightful documentation.

## 📊 Documentation Status

### 🚀 Implemented
- **Platform**: [Astro Starlight](https://starlight.astro.build) with custom theming.
- **Internationalization**: English (`en`) and French (`fr`) – fully configured with locale‑aware routing.
- **Versioning**: Three version folders (`latest`, `v0-2`, `v0-1`) automatically synced from a base version.
- **Custom Header**: Includes version switcher, language switcher, search, theme toggle, and social links.
- **Reusable MDX Components**: `Nudge`, `Checkpoint`, `Feedback` for interactive documentation.
- **Analytics**: Plausible integration with custom event tracking.
- **Content Sync Script**: `scripts/sync-versions.js` copies content across versions to avoid duplication.

### 🏗️ In Progress (Sprint 1)
- **Version Switcher** – now fixed to use correct folder names (`v0-2`, `v0-1`).
- **CI/CD** – GitHub Actions workflow for linting, building, and testing.
- **Contribution Guidelines** for the documentation site.

### 📅 Planned (Sprints 2–6)
- **Getting Started** guides (installation, first conversation, first skill).
- **Tutorials** (build a skill, create workflows).
- **How‑to Guides** (install a skill, add MCP servers, configure profiles).
- **Reference** (error codes, configuration, API).
- **Market Insights** hub (local AI, MCP ecosystem).
- **Community** features (skill showcase, contributor spotlight).

### ✅ Done (Sprint 1 Foundation)
- [x] Astro Starlight setup with custom theme
- [x] i18n configuration (en, fr)
- [x] Versioned content structure (`latest`, `v0-2`, `v0-1`)
- [x] Custom header with version/language switchers
- [x] Feedback widget and analytics
- [x] MDX components (Nudge, Checkpoint, Feedback)
- [x] Content sync script

---

## Phase 1: Brainstorm & Research  
**Goal:** Understand the product, its users, and their needs before writing a single word.

### 1.1 Immerse Yourself in the Codebase
- **Install and run the app** locally. Experience the onboarding flow, create a conversation, install a skill, configure an MCP server, etc.
- **Review the directory structure** and key files:
  - `src/` – React UI components, hooks, stores → reveals user workflows.
  - `src-tauri/` – Rust core, commands, models → reveals backend capabilities, data flow, and configuration.
  - `skilldeck-core/` – Business logic (agent, MCP, skills, workflows) → core concepts.
  - `skilldeck-platform/` – Optional cloud features (referrals, nudges).
  - Configuration files (`biome.json`, `lefthook.yml`, etc.) – development setup, but may hint at user‑facing config.

### 1.2 Identify User Personas and Scenarios
- **Primary persona**: Developer wanting to automate tasks, orchestrate AI agents, and share reusable “skills” with their team.
- **Secondary personas**: Team lead evaluating the tool, contributor wanting to extend it.
- **Key scenarios**:
  - Installing and setting up SkillDeck for the first time.
  - Creating a conversation and using the agent.
  - Discovering, installing, and managing skills (local vs. registry).
  - Adding MCP servers to give the agent new tools.
  - Setting up profiles with different AI providers (Claude, OpenAI, Ollama).
  - Using workspaces to inject project context.
  - Sharing skills as GitHub Gists.
  - Configuring platform features (email nudges, referrals).

### 1.3 Extract Feature Deep‑Dives
- **Read through the UI components** (e.g., `src/components/skills/`) to understand how users interact with skills.
- **Study the Tauri command handlers** (`src-tauri/src/commands/`) – each command corresponds to a user action (install skill, list MCP servers, etc.).
- **Note configuration locations**:
  - `~/.config/skilldeck/config.toml` – main app config.
  - `~/.config/skilldeck/skilldeck-lint.toml` – lint rule overrides.
  - `~/.agents/skills/` – personal skill storage.
  - `.skilldeck/skills/` – workspace‑local skills.
- **Gather error codes and suggestions** from `CoreError` – these will inform troubleshooting guides.

---

## Phase 2: Analysis & Structuring  
**Goal:** Design a documentation architecture that is easy to navigate and logically organised.

### 2.1 Define the Information Hierarchy
Use a structure typical for developer tools:

1. **Overview** – What is SkillDeck? Core philosophy (local‑first, AI orchestration, skills as code).
2. **Getting Started** – Installation, first run, onboarding wizard, creating your first conversation.
3. **Core Concepts** – Explain key ideas in plain language:
   - Skills and the Skill Registry
   - Profiles and Model Providers
   - MCP (Model Context Protocol) Servers
   - Workspaces and Context Injection
   - Agent Loop and Tool Approvals
   - Workflows (Sequential, Parallel, Evaluator‑Optimizer)
   - Platform Features (optional cloud sync, nudges, referrals)
4. **How‑To Guides** – Step‑by‑step tasks:
   - Installing and managing skills
   - Adding and configuring MCP servers
   - Setting up API keys (Claude, OpenAI) and profiles
   - Using workspaces to give the agent project context
   - Sharing skills via GitHub Gists
   - Creating and running workflows
   - Enabling platform features (email, referrals)
5. **Reference** – Detailed technical documentation:
   - Configuration files (`config.toml`, `skilldeck-lint.toml`)
   - Command‑line interface (if any)
   - Tauri command reference (for advanced users/extending)
   - Database schema (if relevant for power users)
   - Error codes and troubleshooting
6. **FAQ & Troubleshooting** – Common issues and solutions.
7. **Contributing** – How to build from source, run tests, contribute skills.

### 2.2 Plan Astro Implementation
- Use **Starlight** (Astro’s documentation template) for a polished, searchable site.
- Organise content in `src/content/docs/` with subdirectories matching the hierarchy.
- Leverage **MDX** for interactive examples (e.g., embedded code sandboxes).
- Include **code snippets** extracted from the codebase (e.g., configuration examples, command invocations).
- Add **screenshots** of the UI where helpful (install dialogs, settings panels, etc.).

### 2.3 Create a Content Inventory
List every page and the key points it should cover. For example:
- **Getting Started/Installation**: System requirements, download options, first launch, onboarding.
- **Core Concepts/Skills**: What is a skill? How is it structured (SKILL.md with frontmatter)? Local vs. registry skills, linting, trust badges.
- **How‑To/Install a Skill**: Search the registry, review lint warnings, choose install target (personal/workspace), confirmation.
- **Reference/Configuration**: Format of `skilldeck-lint.toml` with examples.

---

## Phase 3: Copywriting & Creation  
**Goal:** Write clear, accurate, and engaging content.

### 3.1 Write for the User
- **Use active voice and second person** (“You can install a skill by…”).
- **Start each page with a clear goal** (“In this guide you will learn how to…”).
- **Break long procedures into numbered steps**.
- **Include code blocks** with syntax highlighting, and always specify the file path for configuration examples.
- **Provide concrete examples** (e.g., “To install the ‘code‑review’ skill, click the Skills tab, search for ‘code‑review’, and click Install.”).

### 3.2 Leverage the Codebase for Accuracy
- Extract command names from `src/lib/bindings.ts` to ensure they match.
- Verify configuration file paths from `dirs_next` usage in Rust.
- Use actual error messages from `CoreError` in troubleshooting sections.
- Validate steps by executing them in a clean environment.

### 3.3 Create Visual Aids
- Take **screenshots** of key UI elements: the main interface, the Skills tab, the install dialog, the settings overlay.
- Annotate screenshots to highlight important areas.
- Consider short **screen recordings** for complex workflows (e.g., attaching a folder to a message).

### 3.4 Build with Astro
- Set up a new Astro project with Starlight: `npm create astro@latest -- --template starlight`.
- Configure `astro.config.mjs` for your documentation structure.
- Write content in Markdown/MDX, using frontmatter for title, description, sidebar position.
- Add a **search bar** (built into Starlight).
- Enable **last updated dates** to show freshness.

### 3.5 Review and Iterate
- **Self‑review**: Read each page for clarity and technical correctness.
- **Peer review**: Have a developer (or another documenter) test the instructions.
- **User testing**: Ask someone unfamiliar with the app to follow the guides.
- **Iterate** based on feedback, fixing any gaps or confusing parts.

---

## Phase 4: Refinement & Launch  
**Goal:** Polish the documentation and make it easily discoverable.

### 4.1 Polish
- Ensure consistent tone and terminology throughout.
- Check all links (internal and external).
- Validate code snippets by copying them into a real environment.
- Optimise images for web.

### 4.2 Add Final Touches
- Write a compelling **landing page** that explains what SkillDeck is and directs users to the right starting point.
- Include a **table of contents** on long pages.
- Add **“Edit this page”** links to encourage community contributions.

### 4.3 Publish and Promote
- Deploy the Astro site (e.g., to Vercel, Netlify, or GitHub Pages).
- Link to the docs from the app’s README and in‑app help links.
- Announce the documentation on community channels (Discord, GitHub Discussions).

---

By following this structured process, you’ll create documentation that not only explains *how* to use SkillDeck but also conveys *why* its design decisions matter—making it a true asset for your users.
