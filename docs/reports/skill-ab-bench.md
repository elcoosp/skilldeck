Let me dig into this one properly — it's deceptively deep once you trace all the existing infrastructure it can build on.

## Skill A/B bench — replay with swapped skills

The core UX is simple: pick any past conversation, swap one or more skills, and see the responses side-by-side. But the interesting part is *how much of this is already built*.Here's the full picture, starting with how the data flow actually works:Now here's what the actual UI surface would look like — the bench configuration step is where most of the UX design lives:Here's the full breakdown of what makes this feature tick:

---

## What you'd actually be building

**The data layer is almost free.** `conversation_skill_overrides` already exists in `skilldeck-models`. Every conversation already stores which skills were active. The replay mechanism just needs to: (1) load a conversation's message history, (2) strip the last N assistant turns, (3) re-run the agent loop from message K with a different `skill_overrides` payload. The agent loop, streaming, and context builder are all already there in `skilldeck-core`.

**The `version-diff-modal.tsx` extension.** Right now it diffs artifact content between branches. You'd extend it to accept two streaming `AgentResponse` streams side by side, and run a word-level diff on the assistant messages once both streams complete. `react-diff-viewer-continued` is already in your dependencies — you're literally one component away.

**The "replay from message K" optimization** is the killer UX detail. Long conversations have a lot of agreed context in the early messages — re-running all 12 messages just to compare the last 3 is wasteful and slow. Letting users pick a "fork point" makes benching fast enough to feel iterative. This maps directly to the branching model you already have: it's essentially creating a temporary branch at message K with a different skill override.

---

## The three moments that make it delightful

**The configuration step** (top of the mockup) is where you set Run A vs B. The key detail is that you can optionally override the model for B only — this unlocks "does this skill perform better with Opus vs Sonnet?" as a question, which no other tool answers cleanly. The "replay from message 6" checkbox is the usability detail that turns a 30-second operation into a 4-second one.

**The metrics row** (the four cards) is what makes results shareable and trustworthy. Response length delta, latency delta, "N/12 messages differ" — these are the signals that tell a skill author at a glance whether v1.3-beta is meaningfully different or just noise. No competitor gives skill authors quantitative feedback about their own changes.

**"Promote B as active skill"** closes the loop. Instead of the user manually going to settings and swapping the skill, one click makes B the active skill for this conversation (and optionally globally). This is what turns a debugging tool into a workflow.

---

## The non-obvious tricky bit

Model non-determinism means Run A and Run B will never be exactly the same even with identical inputs. You need to decide whether to freeze Run A (use the stored messages) or re-run it live. Re-running both gives you a fair comparison at the cost of 2x API calls. Using the stored Run A messages is faster and cheaper but subtly unfair if the stored response is from a different model temperature session. The right default is probably "use stored Run A, re-run only Run B" — which is also what makes the feature feel instantaneous rather than slow.
I appreciate the redirection. A split‑view of the entire `MessageThread` is indeed heavy—both in terms of performance and cognitive load. Let me propose a lighter, more focused UX that integrates seamlessly into the existing SkillDeck interface, leveraging components already in use.

---

# UX Research: Skill A/B Bench – Compact Comparison Mode

## 🎯 Design Principle
**Compare the *outputs*, not the *entire conversations*.**  
The user already knows the context (the conversation history leading up to the message). They only need to evaluate the **assistant response** produced by the alternate skill.

---

## 🧩 Proposed UX: The "Diff Card" Pattern

Instead of splitting the thread, we introduce an **inline comparison card** that appears directly beneath the original assistant message. This pattern is inspired by the `ToolResultBubble` and `ThinkingView`—components that expand in place without disrupting the flow of the conversation.

### Visual Sketch (Mental Model)

```
┌─────────────────────────────────────────────────┐
│ 👤 User: "Review this code..."                  │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 🤖 Assistant (code-review v1.2)                 │
│                                                 │
│ "The code looks good, but consider adding..."   │
│                                                 │
│ [ 📊 Compare with v1.3 ]  ← Trigger button      │
└─────────────────────────────────────────────────┘
     │
     ▼ (user clicks)
┌─────────────────────────────────────────────────┐
│ 🔬 Skill Comparison                              │
│ ┌─────────────────────────────────────────────┐ │
│ │ Run A: v1.2 (original)                      │ │
│ │ Run B: v1.3 (preview)                       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [ Split Diff ] [ Unified Diff ] [ Metrics ]     │ ← Tabs
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ The code looks good, but consider adding    │ │
│ │ - error handling for the API call.          │ │
│ │ + error handling and retry logic for the    │ │
│ │   API call.                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📊 Tokens: 124 → 156 (+32)    ⏱️ 1.2s → 1.8s   │
│                                                 │
│ [ Keep Original ]  [ ✨ Promote v1.3 ]          │
└─────────────────────────────────────────────────┘
```

---

## 🔗 Integration with Existing SkillDeck Components

| Feature | **Existing Component** | **How We Reuse It** |
| :--- | :--- | :--- |
| **Trigger** | Message dropdown menu | Add "Compare with another skill..." option (similar to "Branch from here"). |
| **Comparison Container** | `Collapsible` from `ThinkingView` or `ToolResultBubble` | The comparison card expands inline, pushing subsequent messages down. |
| **Diff Display** | `VersionDiffModal`'s `react-diff-viewer-continued` | Embed the diff viewer directly in the card, with tabs for split/unified view. |
| **Metrics** | `Card` components from `ui/card.tsx` | Display small metric badges (tokens, latency) above the diff. |
| **Promote Action** | `Button` with `Sparkles` icon | Promotes the new skill for this conversation (updates `conversation_skill_overrides`). |

---

## 👤 User Flow (Refined)

### Step 1: Initiate
User hovers over an **assistant message** that was generated using a skill. The message dropdown (`...`) includes a new item:
> 🔬 **Compare with another skill version...**

Clicking opens a small dialog (similar to `CreateBranchModal`) but focused on skill selection.

### Step 2: Configure
A compact modal appears:
- **Base Skill**: `code-review v1.2` (read‑only)
- **Compare with**: Dropdown of available versions of `code-review` (e.g., `v1.3-beta`, `v1.1`).
- **Replay from**: Optionally choose a fork point (defaults to the message before this assistant response).
- **Preview** button.

### Step 3: Generate & Display
The backend runs the alternate skill and streams the response.  
The UI inserts a **comparison card** directly below the original assistant message.  
The card loads incrementally (streaming tokens appear in the diff view).

### Step 4: Evaluate
The user can:
- Switch between **Split** and **Unified** diff views.
- View metrics (token count, latency delta).
- Scroll the diff independently.

### Step 5: Act
- **Keep Original**: Dismisses the comparison card (or collapses it).
- **Promote v1.3**: Updates the conversation's skill override and **replaces** the original assistant message content with the new response (using the existing `useEditMessage` flow). The comparison card disappears, and the message bubble updates.

---

## 🎨 UX Advantages Over Split‑View

1. **Preserves Conversation Context**  
   The user doesn't lose their place in the thread. The comparison is anchored to the specific message they're inspecting.

2. **Leverages Existing Mental Models**  
   The expand/collapse pattern (`ThinkingView`, `ToolResultBubble`) is familiar. The diff view reuses the `VersionDiffModal` internals.

3. **Performance Lightweight**  
   Only one copy of the conversation history exists. The alternate response is rendered in a dedicated container, not a full `MessageThread`.

4. **Progressive Disclosure**  
   The comparison is hidden until requested. It doesn't clutter the UI for users who never use the feature.

5. **Seamless Promotion**  
   Replacing the message content aligns with the "Edit Message" workflow, making the promotion feel like a natural refinement of the conversation.

---

## 🧪 Potential Edge Cases & Solutions

| Edge Case | **UX Mitigation** |
| :--- | :--- |
| The original assistant message is very long. | The comparison card has a **max height** and internal scrolling, just like code blocks. |
| User wants to compare skills on a **tool call** or **artifact**. | Disable the option for non‑assistant messages. For artifacts, we already have `VersionDiffModal`. |
| The user switches to a different conversation while comparison is open. | Auto‑dismiss the card (ephemeral state). |
| The "Promote" action should be reversible. | Use the existing "Edit Message" → "Edit in Place" pattern; the user can always undo via the edit history (future). |

---

## 📋 Implementation Checklist (Frontend Highlights)

- [ ] Add "Compare with another skill version" to `MessageBubble` dropdown (only for assistant messages that have an associated skill in context).
- [ ] Create `SkillComparisonModal` (or dialog) for selecting the alternate skill and fork point.
- [ ] Build `ComparisonCard` component that:
  - Fetches the alternate response via a new Tauri command (e.g., `preview_skill_response`).
  - Renders a `ReactDiffViewer` with the two texts.
  - Shows metrics cards.
- [ ] Reuse `useEditMessage` for the "Promote" action.
- [ ] Ensure the card is inserted into the `MessageThread` virtual list (may require a temporary state in `useUIEphemeralStore`).

---

## 💬 Final Recommendation

**Adopt the inline "Diff Card" pattern.**  
It feels native to SkillDeck, requires no new layout engine, and provides a focused, low‑friction way for skill authors to validate changes. The split‑view approach would overcomplicate the UI for a feature that only a subset of power users will employ regularly.
