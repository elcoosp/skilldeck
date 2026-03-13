# Product Vision & Strategic Alignment — SkillDeck v1

### 1. Vision Statement

**SkillDeck** is a local-first desktop application that gives software developers a privacy-respecting AI assistant with branching conversations, composable filesystem-based skills, and multi-agent workflow orchestration — transforming AI from a single chat partner into a coordinated team of specialized collaborators.

---

### 2. Elevator Pitch

> **For** software developers and engineering teams **who** are dissatisfied with cloud-dependent AI assistants that lack transparency, workflow complexity, and data sovereignty, **our product** is a local-first desktop AI orchestration platform **that provides** branching conversations, filesystem-based composable skills, and multi-agent workflow patterns. **Unlike** Cursor, Windsurf, or Claude Desktop which offer single-threaded interactions with limited orchestration, **our product** enables developers to run parallel subagents, compose reusable skills across projects, and maintain complete control over their data and tooling — all without a cloud dependency.

---

### 3. Problem Statement & Business Context

#### The Problem

Modern AI-assisted development tools have achieved remarkable capability, but they suffer from three fundamental limitations that constrain their utility for serious software engineering work:

**1. Cloud Dependency & Data Sovereignty**
Most AI development tools (Cursor, Windsurf, GitHub Copilot) require internet connectivity and transmit code, context, and conversations to cloud infrastructure. This creates:

- Security and compliance concerns for organizations with sensitive codebases
- Privacy risks for developers working on proprietary or regulated software
- Reliability issues when connectivity is intermittent or unavailable
- Vendor lock-in where switching costs include loss of accumulated context and skills

**2. Single-Threaded Interaction Model**
Current AI assistants operate as a single conversational agent. When a complex task requires:

- Parallel exploration of multiple solution approaches
- Specialized subtasks (code generation, testing, documentation, review)
- Iterative refinement with evaluation loops
- Coordination between multiple tools or data sources

The user must manually orchestrate these as sequential conversations, losing context, repeating instructions, and managing mental overhead.

**3. Opaque Tool Integration**
While tools like Claude Desktop and Cursor support MCP (Model Context Protocol) servers and extensions, they offer limited visibility into:

- What tools are being called and with what parameters
- How to create, share, and version control custom skills
- How to compose multiple tools into reliable workflows
- How to debug when AI-tool interactions fail

This opacity creates a "black box" experience that limits developer control and trust.

#### Why Now?

- **MCP ecosystem maturing** — The Model Context Protocol has gained significant adoption in 2024-2025, with dozens of high-quality servers for databases, APIs, file systems, and development tools. A desktop client that embraces MCP as a first-class concept can leverage this ecosystem immediately.
- **Local LLM capabilities** — Ollama and local inference have reached sufficient quality for many coding tasks, making local-first AI viable for users who need complete data sovereignty.
- **Multi-agent research** — The AI research community has produced robust patterns for multi-agent orchestration (evaluator-optimizer, parallel exploration, hierarchical decomposition) that are ready for practical implementation.
- **Developer tooling gap** — No existing tool combines local-first architecture, branching conversations, filesystem-based skills, and multi-agent workflows in a cohesive desktop experience.

#### Business Context

SkillDeck v1 is positioned as:

- **Open-source community project** — Primary distribution via GitHub, encouraging community contributions of skills, MCP integrations, and workflow patterns.
- **Personal productivity tool** — Serves the creator's own development workflow needs while remaining broadly useful to others.
- **Potential commercial foundation** — Architecture supports future enterprise features (team sync, cloud hosting, enterprise compliance) without requiring v1 scope expansion.

---

### 4. Target Users & Customers

#### Primary Target Group

**Software developers and engineers** who:

- Work with AI assistants daily for coding, debugging, documentation, and exploration
- Value privacy and data sovereignty over their codebase and AI conversations
- Use multiple AI tools (Claude, GPT, local models) and want a unified interface
- Need more than single-threaded chat — they want orchestrated workflows
- Prefer local-first tools that work without internet dependency

#### Secondary Target Groups

**Engineering teams** who:

- Want to standardize AI-assisted development practices across the team
- Need to share and version-control reusable skills and prompts
- Require on-premises or air-gapped AI tooling for compliance reasons
- Want visibility into AI tool usage for debugging and optimization

**Power users and automation enthusiasts** who:

- Create custom MCP servers and want a client that exposes their full capabilities
- Want to compose complex multi-step AI workflows
- Value extensibility and control over ease-of-use

#### Explicitly NOT Targeted (Non-Users)

- **Non-technical users** seeking a simple AI chat interface
- **Enterprise teams requiring SSO/SAML** (deferred to future versions)
- **Mobile users** — desktop-only for v1
- **Users needing real-time collaboration** — no cloud sync in v1

---

### 5. User Needs & Value Proposition

#### Primary User Needs

**N-1: Data Sovereignty**

> "I need my AI assistant to work with my code without sending it to third-party clouds. My codebase may contain sensitive intellectual property, customer data, or regulated information."

**N-2: Workflow Complexity**

> "I need to decompose complex tasks into parallel subtasks, run specialized agents for different aspects, and aggregate results — not manage everything in a single conversation thread."

**N-3: Skill Portability & Control**

> "I want to create reusable skills that live as files in my repository, can be version-controlled, shared across projects, and composed together — not locked in a proprietary skill store."

**N-4: Transparency & Control**

> "I want to see exactly what tools the AI is calling, approve or edit tool invocations before execution, and understand the reasoning behind multi-step workflows."

**N-5: Provider Flexibility**

> "I want to use Claude for complex reasoning, GPT for certain tasks, and Ollama for local inference — switching between them seamlessly without managing multiple apps."

#### Value Proposition

SkillDeck delivers a **privacy-respecting AI orchestration platform** that transforms AI from a single chat partner into a **coordinated team of specialized collaborators**:

| Need                 | How SkillDeck Addresses It                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Data sovereignty     | Local-first architecture with optional cloud models; all conversations, skills, and workflows stored locally in SQLite |
| Workflow complexity  | Multi-agent orchestration with sequential, parallel, and evaluator-optimizer workflow patterns                         |
| Skill portability    | Filesystem-based skills (SKILL.md) that can be version-controlled, shared, and composed                                |
| Transparency         | Inline tool call cards with approval gates, subagent visibility, and workflow DAG visualization                        |
| Provider flexibility | Unified interface supporting Claude, OpenAI, and Ollama with profile-based configuration                               |

#### Key Differentiators

vs. **Cursor / Windsurf / Continue.dev**:

- Local-first with no cloud dependency
- Branching conversations with full history
- Multi-agent workflows vs. single-threaded chat
- Filesystem skills vs. proprietary extensions

vs. **Claude Desktop**:

- Branching conversations
- Multi-agent orchestration
- Skill system with priority resolution
- Workflow visualization

vs. **Jupyter/Notebook AI**:

- Native desktop performance (Tauri/Rust)
- Real-time streaming with interactive approval gates
- Branching and history navigation
- First-class MCP client with supervision

---

### 6. Desired Outcomes & Success Metrics

#### Business Outcomes

| ID       | Outcome                                                                              | Key Results                                                                       | Measurement Method                       |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------- |
| **BO-1** | Establish SkillDeck as the leading open-source local-first AI orchestration platform | KR-1.1: 1,000+ GitHub stars within 6 months of v1 release                         | GitHub stars counter                     |
|          |                                                                                      | KR-1.2: 50+ community-contributed skills in shared repositories within 6 months   | Manual curation of community skill repos |
|          |                                                                                      | KR-1.3: Featured in 3+ major developer newsletters/publications                   | Press monitoring                         |
| **BO-2** | Validate market demand for privacy-respecting AI development tools                   | KR-2.1: 500+ active monthly users within 3 months of v1 release                   | Anonymous usage analytics (opt-in)       |
|          |                                                                                      | KR-2.2: 20+ users reporting daily active usage (10+ sessions/week)                | Analytics                                |
|          |                                                                                      | KR-2.3: NPS score ≥ 40 from opt-in user surveys                                   | Survey                                   |
| **BO-3** | Create foundation for future commercial offerings                                    | KR-3.1: Architecture supports cloud sync extension point (validated by prototype) | Technical review                         |
|          |                                                                                      | KR-3.2: 5+ enterprise organizations express interest in team/enterprise features  | Lead tracking                            |
|          |                                                                                      | KR-3.3: Clear product roadmap for v2 based on user feedback                       | Documented roadmap                       |

#### Product Outcomes

| ID       | Outcome                                              | Key Results                                                                       | Measurement Method   |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| **PO-1** | Users successfully orchestrate multi-agent workflows | KR-1.1: 30% of active users use workflow features at least once per week          | Analytics            |
|          |                                                      | KR-1.2: Average workflow contains 3+ steps                                        | Analytics            |
|          |                                                      | KR-1.3: Workflow completion rate ≥ 80%                                            | Analytics            |
| **PO-2** | Users create and share composable skills             | KR-2.1: 40% of active users have at least one custom skill                        | Analytics / DB query |
|          |                                                      | KR-2.2: Average user has 5+ skills enabled                                        | Analytics            |
|          |                                                      | KR-2.3: Skill resolution produces < 5% shadowed warnings (indicating good naming) | Analytics            |
| **PO-3** | Users leverage branching for complex conversations   | KR-3.1: 25% of active users create at least one branch per week                   | Analytics            |
|          |                                                      | KR-3.2: Average branch depth ≤ 3 (not excessive forking)                          | Analytics            |
|          |                                                      | KR-3.3: Branch navigation used in ≥ 10% of conversation views                     | Analytics            |
| **PO-4** | Users trust tool visibility and approval gates       | KR-4.1: Approval gate used in ≥ 60% of tool calls requiring external access       | Analytics            |
|          |                                                      | KR-4.2: Tool call rejection rate < 10%                                            | Analytics            |
|          |                                                      | KR-4.3: User reports "increased trust in AI tool usage" in qualitative feedback   | Survey               |

---

### 7. Strategic Constraints

#### Technical Constraints

| ID       | Constraint                                                  | Rationale                                                                               |
| -------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **TC-1** | Desktop-only: macOS, Windows, Linux via Tauri               | Local-first architecture; mobile/web would require significant scope expansion          |
| **TC-2** | No cloud backend in v1                                      | Architecture supports future cloud sync, but v1 scope focused on local-first value prop |
| **TC-3** | External model providers only — no built-in local inference | Ollama integration provides local LLM option; building inference engine out of scope    |
| **TC-4** | SQLite as sole database                                     | Local-first simplicity; PostgreSQL/could DB deferred to v2                              |
| **TC-5** | MCP as primary tool extension mechanism                     | Leverages growing MCP ecosystem rather than building proprietary plugin system          |
| **TC-6** | React frontend must communicate only via Tauri IPC          | Ensures frontend remains a pure view layer; all business logic in Rust core             |

#### Business Constraints

| ID       | Constraint                                       | Rationale                                                                     |
| -------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| **BC-1** | Open-source distribution (MIT or Apache 2.0)     | Community-driven growth; enables contributions and trust                      |
| **BC-2** | No paid marketing in v1                          | Grassroots adoption via developer communities, conferences, and word-of-mouth |
| **BC-3** | No enterprise sales/support infrastructure in v1 | Focus on product-market fit with individual developers first                  |

#### Regulatory Constraints

| ID       | Constraint                                          | Rationale                                                         |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| **RC-1** | User-controlled API keys stored in OS keychain      | Users own their API relationships; SkillDeck doesn't intermediate |
| **RC-2** | No collection of usage data without explicit opt-in | Privacy-first positioning; telemetry optional and transparent     |

---

### 8. Goals and Non-Goals

#### Goals (What v1 Will Deliver)

| ID      | Goal                                                                           | Success Indicator                                                                                 |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **G-1** | Branching conversation system with full history navigation                     | Users can create, navigate, and compare conversation branches                                     |
| **G-2** | Filesystem-based skill system with priority resolution                         | Skills live as SKILL.md files; resolution order: workspace > personal > superpowers > marketplace |
| **G-3** | Multi-agent workflow orchestration (sequential, parallel, evaluator-optimizer) | Users can define and execute workflows with multiple coordinated agents                           |
| **G-4** | MCP server discovery, supervision, and tool integration                        | MCP servers auto-discovered on localhost; tools exposed with approval gates                       |
| **G-5** | Unified model provider interface (Claude, OpenAI, Ollama)                      | Users configure profiles with different models; seamless switching                                |
| **G-6** | Three-panel reactive UI with workflow visualization                            | Left panel (conversations), center (thread), right (session/workflow/analytics)                   |
| **G-7** | Progressive onboarding with Playground experience                              | New users successfully complete setup and run first workflow in < 10 minutes                      |
| **G-8** | Internationalization foundation (Lingui)                                       | Architecture supports translations; English default                                               |
| **G-9** | Comprehensive error handling and user guidance                                 | Errors surface with actionable guidance; no silent failures                                       |

#### Non-Goals (What v1 Will NOT Deliver)

| ID        | Non-Goal                                                      | Why It's Out of Scope                                                                            |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **NG-1**  | Cloud sync and real-time collaboration                        | Requires significant infrastructure; v1 focused on local-first value                             |
| **NG-2**  | Mobile or web versions                                        | Desktop-first architecture; cross-platform mobile is a different product                         |
| **NG-3**  | Built-in local LLM inference                                  | Ollama integration provides this; building inference engine is a different domain                |
| **NG-4**  | Enterprise SSO, SAML, or compliance certifications            | Enterprise features require sales/support infrastructure; v1 targets individual developers       |
| **NG-5**  | Native IDE integration (VS Code, JetBrains)                   | IDE extensions require separate engineering effort; v1 is standalone desktop app                 |
| **NG-6**  | Skill marketplace with monetization                           | Community-driven skill sharing via GitHub; marketplace infrastructure is v2+                     |
| **NG-7**  | Team features (shared profiles, centralized skill management) | Requires cloud sync and team infrastructure; deferred to v2                                      |
| **NG-8**  | Semantic search across conversation history                   | SQLite-vss optional; v1 uses basic text search; semantic search is a quality-of-life improvement |
| **NG-9**  | Native PDF export                                             | Markdown and JSON export sufficient; PDF requires additional rendering pipeline                  |
| **NG-10** | Production-grade sync backend                                 | Sync architecture has extension point in v1 but no operational backend                           |

#### Anti-Scope (Explicitly Rejected Ideas)

| ID       | Rejected Feature                       | Reason for Rejection                                                                                            |
| -------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **AS-1** | Proprietary skill format               | Filesystem-based SKILL.md enables version control and sharing; lock-in contradicts open-source values           |
| **AS-2** | Cloud-first architecture               | Local-first is core differentiator; cloud-first would sacrifice privacy positioning                             |
| **AS-3** | "AI does everything autonomously" mode | Developer control and transparency are core values; autonomous execution without approval gates is antithetical |

---

### 9. Operational Concept & High-Level Scenarios

#### Concept of Operations

SkillDeck operates as a **developer's AI command center** — a desktop application that lives alongside IDEs, terminals, and documentation. Unlike cloud-based AI tools that require context uploads, SkillDeck maintains local conversation history, discovers MCP tools in the developer's environment, and orchestrates AI workloads across multiple model providers.

**Typical usage patterns:**

1. **Daily coding companion** — Developer keeps SkillDeck open alongside their IDE. They ask questions, get code suggestions, and iterate on solutions. Branching allows exploring alternatives without losing the main thread.

2. **Complex task orchestration** — Developer defines a multi-step workflow: analyze codebase → generate tests → run tests → fix failures → generate documentation. SkillDeck coordinates specialized subagents through the pipeline.

3. **Skill-driven development** — Developer creates filesystem skills for project-specific conventions (naming, architecture, patterns). SkillDeck loads these automatically and applies them to all relevant requests.

4. **MCP tool exploration** — Developer connects to MCP servers for databases, APIs, or local tools. SkillDeck discovers tools, presents them with approval gates, and integrates results into the conversation.

#### High-Level Scenarios

**Scenario 1: First-Time User Onboarding (Happy Path)**

> A developer downloads SkillDeck from GitHub releases. On first launch, they see a three-step wizard: (1) Enter API key for preferred model provider, (2) Create or select a profile, (3) Launch Playground with a sample conversation. Within 5 minutes, they've sent their first message and received a response. Tool tips explain branching, skills, and MCP concepts progressively.

**Scenario 2: Branching for Alternative Approaches**

> Developer is working on a database migration script. They're unsure whether to use a direct migration or a blue-green approach. They branch the conversation at the decision point, explore both options in parallel branches, compare results, and merge the chosen approach back into the main thread.

**Scenario 3: Multi-Agent Workflow Execution**

> Developer wants to refactor a legacy module. They define a workflow: Agent A reads and summarizes the module, Agent B proposes a refactoring plan, Agent C implements the plan, Agent D reviews and tests. SkillDeck visualizes the DAG, executes in dependency order, and surfaces results with merge/discard options.

**Scenario 4: Skill Creation and Sharing**

> Developer creates a SKILL.md file in their project's `.skilldeck/skills/` directory with conventions for their team's API patterns. Team members clone the repo and automatically have the skill available. The skill shadows any similarly-named skill from lower-priority sources.

**Scenario 5: MCP Tool Approval Flow**

> AI suggests using a database query tool via MCP. SkillDeck shows an approval card with the proposed query. Developer reviews, edits the query if needed, and approves execution. Results stream into the conversation. This is captured for future reference.

---

### 10. Stakeholders, Sponsorship & Governance

#### Stakeholder Map

| Stakeholder               | Role                            | Primary Concerns                                       | Influence                   |
| ------------------------- | ------------------------------- | ------------------------------------------------------ | --------------------------- |
| **Project Lead**          | Creator & architect             | Product vision, technical quality, user adoption       | High                        |
| **Core Contributors**     | Engineers implementing features | Code quality, architecture integrity, sustainable pace | High                        |
| **Community Users**       | Open-source adopters            | Feature needs, stability, documentation                | Medium (via issues/Discord) |
| **Model Providers**       | Claude, OpenAI, Ollama          | API usage, terms compliance                            | Low (external dependency)   |
| **MCP Server Developers** | Tool ecosystem creators         | Integration quality, discovery UX                      | Medium                      |

#### Sponsorship

- **Executive Sponsor**: [TBD — Project Lead self-sponsors or seeks organizational backing]
- **Product Owner**: Project Lead (for v1)
- **Technical Lead**: Project Lead

#### Governance Model

**Decision Authority:**

- **Product decisions** (scope, priorities): Project Lead with community input via GitHub discussions
- **Technical decisions** (architecture, implementation): Project Lead with contributor review
- **Release decisions**: Project Lead

**Change Process:**

- Minor changes (bug fixes, clarifications): Direct merge with contributor approval
- Material changes (new features, scope adjustments): Documented in ADRs, discussed in issues/Discord
- Strategic changes (vision, goals): Documented in updated vision doc, announced via GitHub releases

**Review Cadence:**

- Vision document: **Annually** or on major strategic pivot
- Goals/roadmap: **Quarterly** review against user feedback
- Weekly contributor sync (if team forms)

---

### 11. Risks, Assumptions & Open Questions

#### Key Risks

| ID      | Risk                                                      | Probability | Impact | Mitigation                                                                           |
| ------- | --------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------ |
| **R-1** | MCP ecosystem fails to achieve critical mass              | Medium      | High   | Design skill system as primary; MCP as augmentation. Monitor ecosystem health.       |
| **R-2** | Model provider API changes break compatibility            | Medium      | Medium | Abstract providers behind trait; version-specific adapters.                          |
| **R-3** | Performance issues with large conversation histories      | Medium      | Medium | Ring buffer + pagination; embedding-based search (optional).                         |
| **R-4** | Desktop app distribution friction (signing, notarization) | High        | Low    | Invest in CI/CD for releases; document manual process.                               |
| **R-5** | Community adoption slower than expected                   | Medium      | Medium | Aggressive documentation; conference talks; collaborate with MCP ecosystem projects. |
| **R-6** | Subagent orchestration proves too complex for users       | Medium      | High   | Strong defaults; progressive disclosure; clear examples in Playground.               |

#### Key Assumptions

| ID      | Assumption                                                                                          | Validation Method                                        |
| ------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **A-1** | Developers value local-first architecture enough to choose SkillDeck over cloud-native alternatives | User interviews; early adopter feedback                  |
| **A-2** | Branching conversations are useful, not confusing                                                   | User testing; analytics on branch usage                  |
| **A-3** | Multi-agent workflows are intuitive enough for mainstream adoption                                  | Playground tutorials; user feedback on workflow creation |
| **A-4** | MCP ecosystem continues to grow                                                                     | Monitoring MCP server registry; community engagement     |
| **A-5** | Ollama provides sufficient local LLM capability for users needing full sovereignty                  | Testing against common coding tasks                      |
| **A-6** | Users are comfortable managing their own API keys via OS keychain                                   | User feedback; support inquiries                         |

#### Open Questions

| ID      | Question                                                                        | Owner        | Target Resolution | Status |
| ------- | ------------------------------------------------------------------------------- | ------------ | ----------------- | ------ |
| **Q-1** | What is the optimal default skill set to include with SkillDeck?                | Project Lead | Pre-alpha         | Open   |
| **Q-2** | Should SkillDeck include a curated "verified MCP servers" list?                 | Project Lead | v1 beta           | Open   |
| **Q-3** | What telemetry is acceptable to privacy-conscious users?                        | Project Lead | v1 beta           | Open   |
| **Q-4** | How should skill conflicts (same name, different sources) be surfaced to users? | Project Lead | v1 alpha          | Open   |
| **Q-5** | What is the minimum viable workflow creation UX?                                | Project Lead | v1 alpha          | Open   |

---

### 12. Traceability & Alignment Notes

#### Goal → Feature → Metric Mapping

| Goal                   | Primary Features                                                           | Key Metrics                               |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| **G-1** Branching      | Branching data model, branch navigator UI, merge/discard actions           | PO-3 KR-3.1, KR-3.2, KR-3.3               |
| **G-2** Skills         | FilesystemSkillLoader, skill resolver, SKILL.md format, watcher            | PO-2 KR-2.1, KR-2.2, KR-2.3               |
| **G-3** Workflows      | WorkflowExecutor, sequential/parallel/eval_opt patterns, DAG visualization | PO-1 KR-1.1, KR-1.2, KR-1.3               |
| **G-4** MCP            | McpTransport trait, discovery, supervision, tool approval UI               | PO-4 KR-4.1, KR-4.2, KR-4.3               |
| **G-5** Providers      | ModelProvider trait, Claude/OpenAI/Ollama implementations                  | Usage analytics per provider              |
| **G-6** UI             | Three-panel layout, virtualized lists, responsive design                   | Daily active users (BO-2)                 |
| **G-7** Onboarding     | Wizard, Playground, progressive unlock                                     | Time to first successful workflow         |
| **G-8** i18n           | Lingui integration, message extraction                                     | Open issue count for translation requests |
| **G-9** Error handling | Error taxonomy, user-facing guidance, logging                              | Support ticket volume                     |

#### Alignment with Standards

This vision document serves as the **Business Requirements Specification** as defined in ISO/IEC/IEEE 29148:2018, providing:

- Business purpose and scope
- Major stakeholders
- Business environment and constraints
- High-level operational concept
- Success metrics

It precedes and guides the **Stakeholder Requirements Specification** (next document) and **Software Requirements Specification** (subsequent document).

---

## Summary

SkillDeck v1 addresses a clear market opportunity: developers who want **privacy-respecting, locally-controlled AI assistance** with **workflow complexity beyond single-threaded chat** and **composable, portable skills**.

The vision establishes:

- **Clear target users**: Software developers valuing sovereignty, control, and orchestration
- **Differentiated value**: Local-first architecture + branching + workflows + filesystem skills
- **Measurable success**: Community adoption, feature usage, and foundation for commercial potential
- **Constrained scope**: Desktop-only, no cloud sync, no enterprise features in v1
- **Risk awareness**: MCP ecosystem dependency, adoption uncertainty, complexity concerns
