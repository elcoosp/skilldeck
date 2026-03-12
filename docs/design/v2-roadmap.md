# 🚀 SkillDeck v2: Complete Detailed Roadmap

**Last updated:** 2026-03-12  
**Status:** Draft – open for community feedback  

This roadmap outlines the planned features for SkillDeck v2, organized into five strategic phases. Each phase builds on the previous one, delivering incremental value while maintaining a sustainable development pace. All features are derived from community brainstorming and have been trimmed using the YAGNI principle to focus on the highest‑impact ideas.

**How to use this roadmap**  
- Features are listed with estimated complexity (Low/Medium/High) – these are rough guides, not commitments.  
- Dependencies indicate which features must be completed first.  
- The timeline is indicative and will be adjusted based on development progress and community feedback.

We welcome your input! Join the discussion on [GitHub Discussions](https://github.com/bmad-code-org/skilldeck/discussions) or [Discord](https://discord.gg/...).

---

## 📋 Feature Summary

| Cluster | Features |
|--------|----------|
| Memory & Learning | 13 |
| Advanced Workflows | 6 |
| Ecosystem & Skills | 4 |
| UX & Platform | 5 |
| Analytics & Observability | 3 |
| Developer Integrations | 3 |
| **Total** | **34** |

---

## 🏗️ Phase 1: Memory Foundation & UX Quick Wins

**Target:** Q2 2026  
**Theme:** Establish the core memory system and deliver immediate usability improvements that make daily use more efficient.

| ID | Feature | Description | Dependencies | Effort |
|----|---------|-------------|--------------|--------|
| **1.2** | **User‑declared memory items** | Users can explicitly add key‑value facts (e.g., “name: Alex”, “preferred language: Rust”) that persist across conversations. | None | Medium |
| **1.10** | **Memory editing UI** | A dedicated panel to view, edit, and delete memory items. | 1.2 | Low |
| **1.1** | **Persistent conversation summaries** | Auto‑generate a concise summary of each conversation; optionally inject into future system prompts. | None | Medium |
| **1.8** | **Per‑workspace memory** | Memory items are isolated per workspace (e.g., project‑specific preferences). | 1.2 | Low |
| **1.5** | **Memory search / recall** | Basic keyword search across memory items (accessible from memory panel). | 1.10 | Low |
| **5.2** | **Workspace dashboard** | Overview of all open workspaces with recent activity, pending approvals, and quick access. | None | Low |
| **5.1** | **Customizable command palette** | Users can add/remove/reorder commands and assign custom keyboard shortcuts. | None | Medium |

**Phase 1 delivers:** A solid memory foundation, full user control over memories, and immediate UX polish.

---

## 🧠 Phase 2: Intelligent Memory & Personalization

**Target:** Q3 2026  
**Theme:** Make memory smarter and proactive – the agent learns from user behavior and adapts its style.

| ID | Feature | Description | Dependencies | Effort |
|----|---------|-------------|--------------|--------|
| **1.3** | **AI‑suggested memory** | Agent proposes facts to remember (e.g., “Would you like me to remember your database connection string?”); user approves. | 1.10, approval UI | Medium |
| **3.1** | **Style learning** | Agent observes user’s preferred verbosity, tone, and response format; stores preferences in memory. | 1.2 | Medium |
| **3.2** | **Feedback loop** | Thumbs up/down on responses influences future behavior (locally via prompt adjustments). | 1.2, 3.1 | Medium |
| **1.14** | **Conversation threading with memory** | When starting a new conversation, agent suggests continuing a past thread based on recent memories. | 1.5, 1.1 | Medium |
| **2.3** | **Semantic search across all data** | Unified search (using embeddings) across conversations, memories, skills, and MCP tools. | 1.5, conversation storage | High |
| **5.4** | **Dark/light theme per workspace** | Independent theme settings for each workspace. | None | Low |
| **5.7** | **Voice input** | Local speech‑to‑text (whisper.cpp) for hands‑free message entry. | None | Medium |

**Phase 2 delivers:** A proactive, learning assistant that feels personal and responsive.

---

## ⚙️ Phase 3: Advanced Workflows & Multi‑Agent Power

**Target:** Q4 2026  
**Theme:** Unlock complex task orchestration with richer workflow patterns and agent collaboration.

| ID | Feature | Description | Dependencies | Effort |
|----|---------|-------------|--------------|--------|
| **7.4** | **Conditional branching** | Workflow steps can branch based on previous step outputs (if/then logic). | Workflow engine (v1) | Medium |
| **7.5** | **Human‑in‑the‑loop steps** | Pause workflow for manual approval/intervention; resume later. | Approval gate (v1) | Medium |
| **7.2** | **Workflow templates library** | Community‑shared workflow templates (YAML files) that users can install and customize. | None | Low |
| **4.2** | **Agent‑to‑agent communication** | Subagents can send messages directly to each other (not just via parent). | Subagent system (v1) | High |
| **4.5** | **Workflow handoff** | Agents can pass control and context to another agent, like a handoff in a call center. | 4.2 | Medium |
| **4.7** | **Conflict resolution UI for parallel agents** | When parallel agents produce divergent results, show side‑by‑side comparison with merge options. | Parallel workflows (v1) | Medium |
| **5.3** | **Multi‑window support** | Open conversations or workflows in separate windows (useful for multi‑monitor). | None | Medium |

**Phase 3 delivers:** Powerful, flexible workflows that can handle real‑world complexity.

---

## 🔌 Phase 4: Ecosystem & Developer Integrations

**Target:** Q1 2027  
**Theme:** Make SkillDeck a central part of the developer’s toolkit by deepening integrations and strengthening the skill/MCP ecosystem.

| ID | Feature | Description | Dependencies | Effort |
|----|---------|-------------|--------------|--------|
| **6.1** | **Skill dependency management** | Skills can declare dependencies on other skills; resolver loads them automatically. | Skill system (v1) | Medium |
| **6.2** | **Skill versioning** | Track skill versions via frontmatter; allow pinning to a specific version. | 6.1 | Medium |
| **6.4** | **MCP server marketplace with reviews** | Curated list of MCP servers with community ratings and reviews; one‑click install. | None | Medium |
| **6.7** | **Skill testing sandbox** | Test a skill in an isolated conversation before using it in production. | Skill system | Medium |
| **9.1** | **IDE extensions (VS Code)** | Official VS Code extension to interact with SkillDeck from within the editor (e.g., send selection, insert response). | IPC API | High |
| **9.2** | **Git integration** | Auto‑commit conversations/skills to a repo; blame view for skills. | Git binary | Medium |
| **9.6** | **Webhook triggers** | Trigger workflows from external events (GitHub push, calendar, etc.) via HTTP endpoints. | Workflow engine | Medium |

**Phase 4 delivers:** A rich, interconnected ecosystem and seamless integration into existing workflows.

---

## 📊 Phase 5: Analytics & Advanced Capabilities

**Target:** Q2 2027+  
**Theme:** Provide deep insights into usage and unlock cutting‑edge AI features for power users.

| ID | Feature | Description | Dependencies | Effort |
|----|---------|-------------|--------------|--------|
| **7.6** | **Workflow analytics dashboard** | Execution history, step‑level latency, token usage, and cost breakdown per workflow. | Workflow engine | Medium |
| **8.1** | **Cost forecasting** | Predict monthly spend based on usage trends (simple linear projection). | Usage events | Low |
| **8.4** | **Agent loop profiler** | Time breakdown of context building, model call, tool execution. | Agent loop | Medium |
| **2.7** | **RAG pipeline** | Retrieve relevant memories via embeddings to augment prompts; full RAG implementation. | 2.3, 1.1, 1.5 | High |
| **10.5** | **Fine‑tuning integration** | Allow users to fine‑tune models on their own data via provider APIs (e.g., OpenAI fine‑tuning). | Model provider | High |

**Phase 5 delivers:** Advanced observability and state‑of‑the‑art AI customization.

---

## 📅 Timeline Overview

```
Q2 2026 – Phase 1: Memory Foundation & UX Quick Wins
Q3 2026 – Phase 2: Intelligent Memory & Personalization
Q4 2026 – Phase 3: Advanced Workflows & Multi‑Agent Power
Q1 2027 – Phase 4: Ecosystem & Developer Integrations
Q2 2027+ – Phase 5: Analytics & Advanced Capabilities
```

*Note: This timeline assumes a small core team with community contributions. Milestones may shift based on contributor availability and feedback.*

---

## 🙌 How to Contribute

- **Comment on this roadmap** – open an issue or discussion.  
- **Pick a feature** – if you’re interested in implementing something, let us know! We’ll help with design and review.  
- **Test prototypes** – as features land, try them out and report bugs or suggestions.

Together, we’ll make SkillDeck v2 the ultimate local‑first AI orchestration platform.
