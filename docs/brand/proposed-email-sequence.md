# SkillDeck Launch Email Sequence

## Sequence Overview

**Sequence Name:** SkillDeck Welcome & Onboarding
**Trigger:** User signs up for SkillDeck (or downloads the app)
**Goal:** Activate developers as active users of SkillDeck’s AI agent chat
**Length:** 6 emails
**Timing:** Over 14 days
**Exit Conditions:** User opens a workspace and runs their first agent session

---

## Email 1: Welcome to SkillDeck

**Send:** Immediately after signup/download

**Subject:** Welcome to SkillDeck — your AI agent playground 👋

**Preview:** Start building AI workflows in minutes

**Body:**
Hi [First Name],

Thanks for joining SkillDeck! You’ve just taken the first step toward full control over your AI agent workflows.

SkillDeck is a **Tauri‑based desktop app** designed for developers like you who want:
- A local‑first, private AI chat with branching conversations
- Full compatibility with the Superpowers skill ecosystem (`SKILL.md` manifests, priority‑ordered skill directories)
- Seamless integration with MCP servers (local discovery + remote registry)
- A flexible agent loop with tool approval, subagents, and TOON encoding for token efficiency

To get started right away:
1. **Open a workspace** – Click `⌘O` and select any project folder. SkillDeck will auto‑detect project type (Rust, Node, Python, etc.) and inject context from `README.md` or `CLAUDE.md`.
2. **Choose a profile** – Pick a model (Claude, GPT‑4, Gemini, or local Ollama) and start chatting.
3. **Ask your first question** – Try “Explain this codebase” or “Help me debug this error.”

[Button: Open SkillDeck Now]

If you need help, just reply — I’m here to assist.

— The SkillDeck Team

**CTA:** Open SkillDeck Now → [app launch deep link]

---

## Email 2: Quick Win — Load Your First Skill

**Send:** Day 2

**Subject:** [First Name], here’s how to extend SkillDeck in 30 seconds

**Preview:** Skills are your superpowers

**Body:**
Hi [First Name],

One of SkillDeck’s most powerful features is its **skill system**, fully compatible with Superpowers. Skills are just directories with a `SKILL.md` file — they can inject prompts, run scripts, or bundle references.

Here’s a quick win:
1. Press `⌘K` to open the command palette.
2. Type “@skill” and choose a skill from the list (e.g., `code‑review` or `email‑sequence`).
3. The agent will load that skill dynamically and use it in your conversation.

That’s it! You’ve just extended your agent’s capabilities without touching a line of code.

[Button: Browse All Skills]

Want to create your own skill? Use the built‑in `skill‑create` template — just ask your agent “Create a new skill for me.”

— The SkillDeck Team

**CTA:** Browse All Skills → [link to marketplace overlay]

---

## Email 3: Why We Built SkillDeck

**Send:** Day 4

**Subject:** The problem that led to SkillDeck

**Preview:** A story about control and local‑first AI

**Body:**
Hi [First Name],

Before SkillDeck, we were frustrated. Every AI chat tool was either:
- A walled garden with no way to customize the agent’s tools or skills
- Cloud‑only, sending our code to servers we didn’t trust
- Lacking real branching — you couldn’t explore multiple approaches without losing context

So we built SkillDeck: a **local‑first, open‑extensible agent chat** that puts you in control.

- **Workspace‑scoped file access** – Your agent can only read/write inside your project (respecting `.gitignore`). No accidental leaks.
- **MCP discovery** – Automatically find running MCP servers on localhost or add them from a curated registry.
- **Subagents** – Spawn isolated child agents to tackle subtasks, then merge results back into the main conversation.

We believe the best AI tools are the ones you can truly own. SkillDeck is our contribution to that vision.

If you ever wonder “why did you build it this way?”, just ask — we’re happy to explain.

— The SkillDeck Team

*(No CTA, just connection)*

---

## Email 4: See How Developers Are Using SkillDeck

**Send:** Day 6

**Subject:** How [Developer Name] saved hours with SkillDeck

**Preview:** Real‑world use cases

**Body:**
Hi [First Name],

We’ve been blown away by how early users are using SkillDeck. Here’s one story:

Meet [Alex], a Rust developer who was struggling to onboard a new team member. He opened his project in SkillDeck, and the agent automatically read `CLAUDE.md` and the codebase structure. Within minutes, it generated a tailored onboarding guide and even wrote a test suite for a new module — all while staying inside the workspace.

> “SkillDeck let me focus on architecture while the agent handled the boilerplate. The subagent feature is a game‑changer.” — [Alex]

Another user, [Jordan], uses SkillDeck to review pull requests. The agent loads the `code‑review` skill, examines the diff, and provides line‑by‑line suggestions — right in the chat.

Ready to try it yourself?

[Button: Read More Case Studies]

— The SkillDeck Team

**CTA:** Read More Case Studies → [link to blog/case studies]

---

## Email 5: Worried About Privacy or Complexity?

**Send:** Day 9

**Subject:** [First Name], your data never leaves your machine

**Preview:** Local‑first means private by default

**Body:**
Hi [First Name],

We know that for developers, privacy isn’t optional. That’s why SkillDeck is designed to be **local‑first**:
- All conversations, skills, and configurations are stored in a local SQLite database.
- API keys are saved in your OS keychain, never in plain text.
- The agent’s file access is sandboxed to your active workspace — it can’t read or write outside that root.
- Optional cloud sync is just that: optional, end‑to‑end encrypted, and you control when it runs.

And if you’re worried SkillDeck is too complex, don’t be. We’ve built the UI to feel familiar:
- Three‑panel layout with resizable panels
- Inline branch navigation (just click `< 1/3 >` to switch between approaches)
- Command palette (`⌘K`) for everything
- Tool approval cards that pause the agent until you confirm destructive actions

Ready to see for yourself?

[Button: Open SkillDeck and Try It]

— The SkillDeck Team

**CTA:** Open SkillDeck and Try It → [deep link]

---

## Email 6: Go Further — Subagents, TOON, and Beyond

**Send:** Day 14

**Subject:** [First Name], ready to level up with subagents?

**Preview:** Advanced features you haven’t tried yet

**Body:**
Hi [First Name],

You’ve been using SkillDeck for a couple of weeks — awesome! 🎉 Now it’s time to unlock even more power.

**Subagents**: Ever wished you could delegate a subtask while the main agent keeps working? With the built‑in `spawnSubagent` tool, your agent can fork a new conversation, run it in parallel, and merge the results back. Perfect for code reviews, research, or writing documentation.

**TOON encoding**: All structured data (tool schemas, skill metadata, MCP server lists) is sent to the LLM in **TOON**, a compact format that uses ~40% fewer tokens than JSON — saving you money and improving accuracy.

**MCP discovery**: SkillDeck automatically scans localhost for MCP servers and lets you browse a remote registry. Add a server with one click, and its tools become available to your agent instantly.

**Branching**: Every edit creates a new branch — no data is ever lost. You can name branches (e.g., “approach A”) and switch between them anytime.

Which of these would help you most right now? Let us know, and we’ll send you a custom guide.

[Button: Explore All Features]

— The SkillDeck Team

**CTA:** Explore All Features → [link to docs/features]

---

## Metrics to Track

- Open rates (aim >40%)
- Click‑through rates (>5% good, >10% excellent)
- Activation: User opens a workspace and sends at least one message
- Skill usage: Percentage of users who load a skill
- Subagent usage
- Unsubscribe rate (<0.5% per email)

---

## Next Steps

1. Set up this sequence in your email tool (Customer.io, Mailchimp, Resend, etc.).
2. Customize placeholders like [Alex] with real beta tester stories if available.
3. Link to your actual docs, case studies, and app deep links.
4. Monitor metrics and iterate.

Need help tailoring any specific email? Just ask!