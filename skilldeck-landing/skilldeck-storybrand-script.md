# SkillDeck StoryBrand Brand Script

---

## SB7 Framework Application

---

### 1. Character (The Hero)

**Who is the customer?**

The customer is a developer who builds software for a living and wants to use AI to work faster and smarter -- but refuses to surrender control of their codebase, their API keys, or their workflow to a cloud service they cannot audit.

**Primary audience:** Power developers building complex AI workflows, coding daily, who have tried cloud AI tools and hit walls around privacy, provider lock-in, and workflow rigidity.

**Secondary audiences:**
- Privacy-conscious developers at companies with strict data policies
- Open-source contributors who extend and customize everything they use
- Tool builders who create MCP servers and reusable AI skill packages

**What they want (the primary desire):**

They want to **own their entire AI workflow** -- the models, the tools, the skills, and the orchestration -- without sending a single line of code to someone else's server. They want AI that works on their machine, with their models, under their rules.

---

### 2. Problem (Three Levels)

**External problem:**
AI coding tools are scattered across different services, each locked to one provider, none supporting multi-agent orchestration or visual workflow automation, and almost all of them require sending your code to the cloud. When you need a tool that can run local models, connect MCP servers, and chain multi-step workflows, nothing exists in one place.

**Internal problem:**
It feels like you are constantly patching together a fragile toolchain. Every AI tool you adopt creates a new dependency and a new risk. You worry about whether your proprietary code is being logged, whether your API keys are stored safely, and whether the tool you invested time learning will change its pricing or shut down. You feel locked in and powerless.

**Philosophical problem:**
Developers should not have to trade privacy for productivity. Open-source should mean actual control, not just visible source code. Your AI workflow is part of your development stack, and it should work the way you want it to -- not the way a vendor decided.

**The Villain:**
The fragmented AI tooling landscape -- a scattered ecosystem of cloud-locked services, each solving one piece of the puzzle while holding your data hostage, limiting your model choices, and preventing you from building the multi-agent, multi-tool workflows you actually need.

---

### 3. Guide (SkillDeck as the Guide)

**Empathy:**
We are developers too. We know what it feels like to juggle five different AI tools, each with its own API key, its own interface, and its own limitations. We built SkillDeck because we were tired of sending our code to services we could not control, and we wanted a single native app that could orchestrate any model, any tool, and any workflow -- locally.

**Authority:**
- Open source under MIT OR Apache-2.0 -- every line of code is auditable
- Four specialized Rust crates powering the core engine, MCP supervisor, skill loader, and database layer
- Tauri 2 native desktop application -- no Electron, no web wrapper, native performance with a 10x smaller binary
- Full MCP protocol implementation (stdio and SSE transports, JSON-RPC 2.0, protocol version 2024-11-05)
- 17 built-in skill lint rules across security, structure, frontmatter, and quality categories
- Three workflow execution patterns: Sequential, Parallel, and Evaluator-Optimizer
- Active development with 50+ database entities, 35+ React hooks, 12 Zustand stores, and comprehensive test coverage

---

### 4. Plan (Three Steps)

**Step 1: Download and install**
Get the native SkillDeck desktop app for your platform. The onboarding wizard walks you through setup in under 60 seconds. No account required. No cloud dependency.

**Step 2: Connect your models and tools**
Add your LLM providers -- OpenAI, Claude, or Ollama for local models. API keys are stored in your OS keychain, never in a database. Browse the MCP Catalog to connect external tools, or add your own custom MCP servers via stdio or SSE.

**Step 3: Build workflows and start shipping**
Browse the Skill Marketplace to install community skills or create your own. Open the Workflow Editor to build multi-step AI pipelines with a visual drag-and-drop graph. Equip agents with skills, spawn parallel subagents, and orchestrate complex tasks -- all from one native app, all on your machine.

---

### 5. Call to Action

**Direct CTA:** "Download SkillDeck -- Free and Open Source"

**Transitional CTAs:**
- "See How It Works"
- "View on GitHub"
- "Browse the Skill Marketplace"

---

### 6. Success (What Life Looks Like When They Win)

**Status:** You are the developer who ships faster because your AI workflows run locally, in parallel, with full tool integration. Your code never leaves your machine, your API keys never touch a database, and you control exactly what every agent can do.

**Completeness:** You have a single desktop app that replaces the scattered collection of AI tools you were patching together. Agent conversations, visual workflows, skill packages, MCP server management, conversation branching, and usage analytics all live in one place. Your AI stack is yours.

**Self-realization:** You are the developer who owns their AI workflow end to end. You choose the models. You write the skills. You build the workflows. You control the permissions. Nobody mines your data, nobody locks you in, and nobody limits what you can build.

---

### 7. Failure (What Happens If They Do Not Act)

If you keep using the same fragmented toolchain, you will spend another year juggling multiple AI services, each with its own login, its own pricing model, and its own limitations. Your code will keep flowing through cloud servers you cannot audit. Every time you need multi-agent orchestration or a custom workflow, you will hit a wall. You will keep compromising on privacy to get AI power, and you will keep rebuilding workflows from scratch instead of reusing them.

---

## One-Liner

We help developers who are frustrated by fragmented, cloud-locked AI tooling build, orchestrate, and control their entire AI workflow locally -- so they can ship faster without sacrificing privacy or flexibility.

---

## Section-by-Section Landing Page Messaging

---

### Section 1: Hero (Above the Fold)

**Headline:**
Your AI workflow. Your machine. Your rules.

**Subheadline:**
SkillDeck is a local-first desktop app that brings multi-agent orchestration, visual workflows, and full model control to one native interface. Your code never leaves your machine.

**Body copy:**
Stop stitching together cloud AI tools that lock you into one provider and send your code to someone else's servers. SkillDeck runs on your desktop, connects to OpenAI, Claude, or Ollama, and gives you agent orchestration, a skill marketplace, MCP server management, and a visual workflow editor -- all open source, all local, all under your control.

**Primary CTA:** Download SkillDeck (Free)
**Secondary CTA:** View on GitHub

---

### Section 2: Logo Cloud (LLM Providers)

**Headline:**
Use any model. Switch anytime.

**Body copy:**
SkillDeck connects to OpenAI (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo), Claude (Claude Sonnet 4.5, Claude Opus 4, Claude 3.5 Sonnet), and any model you run locally through Ollama. Create profiles for different provider and model combinations. No vendor lock-in. Switch between cloud and local models mid-conversation.

**Visual:** Provider logos (OpenAI, Anthropic, Ollama) displayed as a trust bar.

---

### Section 3: Feature Belt (Three Value Props)

**Value Prop 1:**

**Headline:**
Multi-agent orchestration

**Body copy:**
Spawn parallel subagents that work on independent tasks simultaneously. Each subagent runs in its own session, can be equipped with specific skills, and reports results back for merging with concat, summarize, or vote strategies.

**Value Prop 2:**

**Headline:**
Visual workflow builder

**Body copy:**
Design multi-step AI pipelines with a drag-and-drop graph editor. Choose from three execution patterns -- Sequential, Parallel, and Evaluator-Optimizer -- with dependency-aware scheduling powered by a graph engine built on petgraph.

**Value Prop 3:**

**Headline:**
Zero cloud dependency

**Body copy:**
Every conversation, every workflow execution, and every API key is stored locally in SQLite and your OS keychain. SkillDeck works fully offline with local Ollama models. The optional SkillDeck Platform is just that -- optional.

---

### Section 4: Feature -- Agent System

**Headline:**
Agents that actually work together

**Subheadline:**
Not just chat. A streaming agent loop with tool dispatching, subagent spawning, and a safety-first approval gate.

**Body copy:**
The SkillDeck Agent Loop is a streaming async engine that receives your prompt, builds a completion request through the Context Builder, streams tokens from your chosen model, dispatches tool calls through the Tool Dispatcher, and loops until the task is complete.

Three built-in tools never require approval: loadSkill (inject a skill into the current agent context), spawnSubagent (launch a parallel subagent for an independent sub-task), and mergeSubagentResults (collect and synthesize outputs using concat, summarize, or vote strategies).

For everything else, the Tool Approval Gate pauses execution and asks you. Approve, edit the input, or deny. Configure auto-approve categories by pattern -- reads, writes, selects, mutations, HTTP requests, and shell commands -- all off by default for maximum security.

Track every subagent in real time with dedicated Subagent Cards that show status, progress, and results as they complete.

---

### Section 5: Feature -- Skills and MCP

**Headline:**
Skills and tools that plug right in

**Subheadline:**
Markdown-based skill packages with built-in linting. Full MCP protocol support for connecting external tools.

**Body copy:**
Skills are AI instruction packages stored as Markdown files with YAML frontmatter. Each skill declares its name, description, compatible models, and allowed tools. The Skill Loader discovers skills from local directories, the Skill Watcher hot-reloads them when files change, and the Skill Linter runs 17 rules across four categories -- frontmatter, structure, security, and quality -- to catch problems before they reach your agent.

Browse the Unified Skill Marketplace to find community skills alongside your local collection. Create profiles that bundle specific skills and MCP servers for different workflows.

For external tool integration, SkillDeck implements the full MCP protocol (JSON-RPC 2.0, protocol version 2024-11-05) with two transport types: stdio for local MCP servers launched as child processes, and SSE for remote MCP servers over HTTP. The MCP Supervisor monitors server health, reconnects on failure with exponential backoff, and tracks every live connection in the registry. Browse the MCP Catalog for curated servers, or add your own custom servers with the built-in configuration form.

---

### Section 6: Feature -- Workflow Engine

**Headline:**
Build it once. Run it forever.

**Subheadline:**
A visual workflow editor with three execution patterns and real-time step tracking.

**Body copy:**
The Workflow Editor gives you a drag-and-drop canvas powered by React Flow. Build your pipeline visually: define steps, draw dependency edges, and assign skills to individual steps. The graph engine computes execution order from your dependency graph and dispatches steps to the right execution strategy.

Choose from three patterns:

- **Sequential** -- Steps execute one after another, in topological order. Perfect for pipelines where each step depends on the previous output.
- **Parallel** -- Steps execute concurrently, respecting dependency edges. Independent steps launch simultaneously using Tokio's JoinSet for true async parallelism.
- **Evaluator-Optimizer** -- An iterative loop that evaluates output quality and re-optimizes up to five times. Built for tasks that benefit from refinement.

Each step tracks status, result, error, and token usage in real time. Step nodes on the graph update live -- blue for running, green for completed -- so you always know where your workflow stands. Switch between the visual graph and the JSON editor for fine-grained control over workflow definitions.

---

### Section 7: Feature -- Conversations

**Headline:**
Conversations that branch, not break

**Subheadline:**
Non-linear conversation management with threading, branching, artifacts, and a message queue.

**Body copy:**
SkillDeck conversations are not flat chat logs. Create branches from any message to explore different directions without losing context. Navigate between branches with the branch navigator. Thread replies nested under specific messages for focused discussions.

The Artifacts system captures AI-generated code and content into versioned artifacts. Pin important artifacts to the pinned bar, diff between versions, and branch artifacts independently from the conversation.

The Message Queue lets you batch multiple prompts for sequential processing. Add messages to the queue, reorder them, pause processing, and apply bulk actions with the selection toolbar. Perfect for running a series of related tasks without manual intervention.

Organize conversations into folders, tag them for quick filtering, and search across your history with client-side fuzzy search. Auto-generated message headings make long conversations navigable. Drag and drop files directly into conversations, @-mention files in your messages, and share conversations via secure share tokens.

---

### Section 8: Feature -- Privacy and Security

**Headline:**
Your code. Your keys. Your control.

**Subheadline:**
Local-first architecture with an OS keychain, a tool approval gate, and zero mandatory cloud services.

**Body copy:**
Every piece of data in SkillDeck stays on your machine. Conversations, messages, artifacts, workflow definitions, skill files, and usage analytics are all stored in a local SQLite database managed by SeaORM. API keys for OpenAI, Claude, and other providers are stored in your operating system's native keychain -- never in the database, never in plaintext. The codebase includes explicit security tests to verify this.

The Tool Approval Gate is your safety net. Every external tool call -- whether from an MCP server or a third-party skill -- pauses execution and presents the request for your review. You can approve, edit the input before it executes, or deny it entirely. Six auto-approve categories (reads, writes, selects, mutations, HTTP requests, shell commands) are available for convenience, but every single one is off by default.

The Skill Linter runs 17 rules including security checks that detect dangerous patterns in skill content -- things like `rm -rf /`, fork bombs, and `curl | sh` chains. Symlinked skill directories are rejected to prevent path traversal attacks. Skill security and quality scores are computed on a 1-5 scale so you can evaluate third-party skills before loading them.

The SkillDeck Platform is entirely optional. Registration, the skill registry, referrals, and analytics are opt-in features. The app works fully offline with local Ollama models and no network connection whatsoever.

---

### Section 9: Comparison Table

**Headline:**
How SkillDeck compares

**Subheadline:**
A side-by-side look at what sets SkillDeck apart from other AI developer tools.

**Comparison copy:**

| Capability | SkillDeck | Cursor | Continue.dev | Cline |
|---|---|---|---|---|
| Multi-provider support | OpenAI, Claude, Ollama | OpenAI only | Limited | OpenAI + Anthropic |
| Local model support | Full Ollama, works offline | Cloud only | Limited | Limited |
| Skill system | Markdown skills with linting, registry, sharing | None | Basic .clinerules | None |
| Visual workflow editor | Drag-and-drop with 3 patterns | None | None | None |
| Multi-agent orchestration | Parallel subagents with skill equip | Single agent | None | None |
| MCP protocol support | Full client, stdio + SSE, supervisor | None | Added recently | None |
| Tool approval gate | Category-based, off by default | None | None | None |
| Conversation branching | Branch from any message | None | None | None |
| Open source | MIT OR Apache-2.0 | Proprietary | Apache-2.0 | Apache-2.0 |
| Data storage | 100% local, OS keychain for keys | Cloud | Local | Local |
| Application type | Native desktop (Tauri) | Desktop (Electron) | VS Code extension | VS Code extension |

**Supporting copy:**
SkillDeck is not another AI chat extension. It is a full desktop application purpose-built for AI workflow orchestration. No Electron overhead. No VS Code dependency. No cloud requirement.

---

### Section 10: How It Works

**Headline:**
From zero to shipping in three steps

**Step 1:**
**Install SkillDeck**
Download the native desktop app for your platform. The onboarding wizard walks you through setup in under 60 seconds. No account required. Pick your default provider -- Ollama for fully local, or add OpenAI and Claude API keys stored securely in your OS keychain.

**Step 2:**
**Connect your tools**
Browse the MCP Catalog to find and connect external tool servers, or add your own custom servers via stdio or SSE transports. Explore the Skill Marketplace to install community-built AI skill packages, or create your own from a Markdown file with YAML frontmatter. The Skill Linter validates everything automatically.

**Step 3:**
**Build and orchestrate**
Open the Workflow Editor and design multi-step AI pipelines on a visual graph. Equip your agents with skills, spawn parallel subagents for independent tasks, and run workflows with Sequential, Parallel, or Evaluator-Optimizer patterns. Track everything in real time from the three-panel interface.

**CTA:** Get Started for Free

---

### Section 11: Testimonials (Placeholder Quotes)

**Quote 1:**

"I was using three different AI tools and none of them talked to each other. SkillDeck replaced all of them. The workflow engine alone saved me hours a week on code review pipelines."

-- Sarah K., Senior Backend Engineer

**Quote 2:**

"My company has a strict no-cloud policy for proprietary code. SkillDeck lets me use Claude and GPT-4 models through API calls while keeping everything local. The tool approval gate gives our security team exactly what they needed."

-- Marcus L., Staff Engineer at a fintech company

**Quote 3:**

"The skill system is what sold me. I built a skill for our internal code patterns, shared it with the team through the marketplace, and now every developer onboarding gets consistent AI assistance. It's like .editorconfig but for AI behavior."

-- Priya R., Tech Lead

**Quote 4:**

"Being able to spawn subagents that work in parallel is a game changer. I run research, implementation, and test generation simultaneously. The merge strategies make it easy to synthesize results."

-- David C., Full-Stack Developer

**Quote 5:**

"I switched from Cursor because I wanted Ollama support and conversation branching. The fact that it's open source and built with Rust and Tauri instead of Electron is a massive bonus for performance."

-- Alex T., Open-Source Contributor

---

### Section 12: Open Source CTA

**Headline:**
Fully open source. Fully yours.

**Subheadline:**
MIT OR Apache-2.0 dual license. Audit the code. Contribute features. Fork it. Make it yours.

**Body copy:**
SkillDeck is not open-core with premium features locked behind a paywall. Every feature -- the agent loop, the workflow engine, the skill marketplace, the MCP supervisor, the conversation branching -- is open source under a permissive dual license. Four Rust crates, a full React frontend, and comprehensive test suites are all available on GitHub.

The codebase uses industry-standard tools: Tauri 2 for the desktop shell, SeaORM for data modeling, petgraph for workflow dependency resolution, and Tokio for async runtime. The frontend is built with React 19, TanStack Router, Zustand, and shadcn/ui. If you want to understand how it works, extend it, or contribute, the door is wide open.

**Primary CTA:** View on GitHub
**Secondary CTA:** Read the Docs

---

### Section 13: FAQ

**Headline:**
Frequently asked questions

**FAQ Items:**

**Q: Does my code ever leave my machine?**
A: No. SkillDeck is local-first. All conversations, artifacts, and workflow executions are stored in a local SQLite database. When you use OpenAI or Claude, only the prompts you explicitly send reach those APIs. When you use Ollama, everything stays on your machine entirely.

**Q: Where are my API keys stored?**
A: In your operating system's native keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux). They are never written to the database or to any configuration file in plaintext. This is verified by automated security tests in the codebase.

**Q: What is the Skill system?**
A: Skills are Markdown-based AI instruction packages. Each skill is a directory containing a SKILL.md file with YAML frontmatter that declares the skill name, description, compatible models, and allowed tools. Skills are injected into the agent's system prompt to guide its behavior for specific tasks.

**Q: Can I use my own local models?**
A: Yes. SkillDeck detects any model installed through Ollama and makes it available as a provider option. You can run SkillDeck fully offline with no network connection.

**Q: What is MCP and why does it matter?**
A: MCP (Model Context Protocol) is a standard for connecting AI agents to external tools and data sources. SkillDeck implements the full MCP protocol with stdio and SSE transports, so you can connect any MCP-compatible server and give your agents access to file systems, databases, APIs, and more.

**Q: How do the workflows work?**
A: The Workflow Editor provides a visual drag-and-drop canvas where you define steps, draw dependency edges, and assign skills. You choose an execution pattern -- Sequential for ordered pipelines, Parallel for concurrent steps, or Evaluator-Optimizer for iterative refinement. The graph engine computes the correct execution order and runs your workflow with real-time status tracking.

**Q: Is the platform backend required?**
A: No. The SkillDeck Platform is entirely optional. It provides features like the skill registry, referrals, and analytics, but the desktop app works fully without it. Registration is opt-in.

**Q: How does the tool approval gate work?**
A: When an agent attempts to call an external tool (through MCP or a skill), execution pauses and the request is presented to you in the conversation. You can approve it as-is, edit the input before it executes, or deny it entirely. You can configure auto-approve categories for convenience, but all categories are off by default for maximum security.

**Q: What does the Skill Linter check?**
A: The Skill Linter runs 17 rules across four categories. Frontmatter rules validate required fields and formatting. Structure rules check file existence, size limits, and nesting depth. Security rules detect dangerous patterns like shell injections and unmatched tool declarations. Quality rules check for examples, structured instructions, and content clarity.

**Q: Can I use SkillDeck with any text editor?**
A: Yes. SkillDeck is a standalone desktop application, not a plugin or extension. It works alongside any editor, IDE, or development environment you prefer.

---

### Section 14: Waitlist/Download CTA

**Headline:**
Ready to own your AI workflow?

**Subheadline:**
Download SkillDeck for free. Open source. No account required. Works on macOS, Windows, and Linux.

**Body copy:**
Join the developers who stopped compromising on privacy, flexibility, and control. SkillDeck is a native desktop application built with Tauri 2 and Rust -- no Electron, no cloud dependency, no vendor lock-in. Download the installer, run the onboarding wizard, and have your first AI conversation in under 60 seconds.

**Primary CTA:** Download SkillDeck for [Platform]
**Secondary CTA:** Star on GitHub

**Trust indicators below CTA:**
- MIT OR Apache-2.0 License
- 100% local data storage
- OS keychain for API keys
- Works fully offline

---

### Section 15: Footer Tagline

**Tagline:**
Local-first AI orchestration for developers who ship.

**Supporting line:**
Built with Rust, React, and Tauri 2. Open source under MIT OR Apache-2.0.

---

## Brand Voice Guidelines

---

### Tone
Direct, technical, and respectful. SkillDeck speaks to developers as peers. No hype. No marketing fluff. Every claim is backed by a feature that exists in the codebase.

### Language Rules
- Use "you" language in headlines and CTAs. The developer is the hero.
- Use "we" sparingly and only for empathy and authority statements.
- Never position SkillDeck as the hero. It is the guide.
- Write in second person for all user-facing copy.
- Keep headlines under 10 words.
- One message per section. Do not overload.
- No emoji in any copy.
- No CLI references. This is a desktop application.
- No gradient or accent color references in copy.
- Use specific feature names from the codebase (Agent Loop, Tool Approval Gate, Skill Linter, Workflow Editor, MCP Supervisor, Subagent Cards, Unified Skill Marketplace, Message Queue, Conversation Branching).

### Vocabulary
- "Orchestration" not "automation"
- "Local-first" not "offline-capable"
- "Native desktop app" not "application"
- "Skill" (capitalized when referring to the system)
- "MCP server" (not "MCP tool" or "MCP integration")
- "Subagent" (one word, lowercase unless starting a sentence)
- "Workflow" (capitalized when referring to the system feature)

### Things to Avoid
- Superlatives without evidence ("best," "fastest," "most powerful")
- Vague feature descriptions ("AI-powered," "smart," "intelligent")
- Competitor names in headlines or primary copy (save for the comparison table)
- Technical jargon without context (always explain what a feature does, not just what it is)
- Urgency or scarcity language ("limited time," "act now")
- First-person hero framing ("SkillDeck revolutionizes," "We built the ultimate")

---

## Messaging Hierarchy

---

**Level 1 (Homepage headline):** Your AI workflow. Your machine. Your rules.

**Level 2 (Section headlines):** Each section headline reinforces one facet of the core promise: ownership, control, orchestration, privacy, and open-source freedom.

**Level 3 (Body copy):** Specific, evidence-based descriptions of features that exist in the codebase. Named components, named patterns, named protocols.

**Level 4 (Supporting detail):** Technical specifics for developers who want to understand the implementation before committing.

---

*This brand script is a living document. As SkillDeck evolves, each section should be updated to reflect actual shipped features. Every claim here maps to code that exists in the repository.*
