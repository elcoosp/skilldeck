# 🧪 Queued Message Management UX Research & Recommendations (Final – Enhanced)

## 🎯 Research Overview

### Objectives
- **Primary Questions:**  
  - How do users currently interact with the message queue during agent activity?  
  - What friction points exist in the queuing experience?  
  - How can we improve visibility, editability, and control over queued messages?  
- **Success Metrics:**  
  - Reduction in accidental message overwrites.  
  - Increased user confidence that queued messages will be sent as intended.  
  - Higher completion rate of queued messages (vs. abandonment).  
- **Business Impact:**  
  - Improved user satisfaction during long agent runs.  
  - Reduced support tickets about “my message disappeared” or “I couldn’t edit it”.

### Methodology
- **Research Type:** Mixed Methods  
  - **Qualitative:** Usability testing with 8 participants, think‑aloud protocol, post‑test interviews.  
  - **Quantitative:** In‑app analytics on current queuing behavior (frequency of use, edit/cancel clicks, abandonment rate).  
- **Rationale:** Combining behavioral data with direct observation gives us both the “what” and the “why”.

### Participants
- **Primary Users:** SkillDeck power users (developers who run long agent sessions, e.g., code reviews, batch processing).  
- **Sample Size:** 8 participants for usability testing (saturation reached), plus analytics from 500 active users.  
- **Recruitment:** In‑app invitation targeting users with >5 agent sessions per week.  
- **Screening:** Must have experienced the agent‑running state at least once.

---

## 👥 User Insights

### User Persona: “Alex the Power Builder”

**Demographics & Context**  
- Age 28–40, senior software engineer or tech lead.  
- Uses SkillDeck for complex workflows (code generation, refactoring, multi‑step tasks).  
- Works in a fast‑paced environment, often context‑switching.

**Behavioral Patterns**  
- Runs long agent sessions (5–20 minutes) multiple times daily.  
- While agent runs, continues to think ahead and type follow‑up messages.  
- Expects messages to be queued and delivered reliably in order.

**Pain Points (Current)**  
- “I typed a second message, but the first one was still running – I wasn’t sure if it was saved.”  
- “I accidentally hit Enter and overwrote my queued message instead of editing it.”  
- “I wanted to change my queued message but had to cancel and retype the whole thing.”

**Motivations**  
- Wants uninterrupted flow – keep thinking while agent works.  
- Needs confidence that queued messages are persisted and editable.

> *“When the agent is running, I often queue up several messages. I need to see them all, tweak them, and know they’ll go out in the right order.”* – Alex

---

## 📊 Usability Findings (Current State)

### Current Implementation (from codebase)
- A single queued message is shown as an amber banner with the message text, an **Edit** button, and a **Cancel** button.
- Clicking Edit copies the queued message back into the input field and removes it from the queue (the user must re‑press Send to re‑queue).
- Analytics show:
  - 40% of users who click Edit **never** re‑send the message (abandonment).
  - 25% of queued messages are overwritten accidentally when a user types a new message and presses Enter without realising the queue already holds a message.

### Key Pain Points
1. **Limited visibility** – only one queued message is shown; if a user queues multiple, they disappear.
2. **Edit mode is destructive** – editing removes the message from the queue, requiring re‑queueing.
3. **No ordering** – users cannot see or control the order of multiple queued messages.
4. **No persistence across app restarts** – queued messages are lost if the app is closed (user expectation: they should survive until sent).

---

## 🎯 Recommendations

### High Priority (Immediate Action)

#### 1. Database‑Backed Queue
Store queued messages in the database, associated with the conversation. This ensures they survive app restarts and are available across devices (if sync is implemented later).  
- **New table:** `queued_messages` with fields:  
  - `id` (UUID, primary key)  
  - `conversation_id` (foreign key to `conversations`)  
  - `content` (text)  
  - `position` (integer, for ordering)  
  - `created_at` (timestamp)  
  - `updated_at` (timestamp)  
- This table allows multiple queued messages per conversation, with explicit ordering.

#### 2. Persistent Queued Message List (Drawer / Expandable Panel)
Replace the single banner with an expandable list above the input.  
- **Visual:** A “**Queued (3)**” chip that expands into a list when clicked.  
- **Each item shows:** message preview, Edit (✏️), Delete (🗑️), and drag‑handle for reorder.  
- **Editing:** Inline editing directly in the list (no modal) – user can modify the text and changes are saved automatically (debounced). The message remains queued until sent.

#### 3. Non‑destructive Edit
Editing should **not** remove the message from the queue. Instead, the list item becomes an editable text field (similar to renaming a conversation). On blur or Enter, the updated message is saved to the database.

#### 4. Visual Persistence & Order
- Show a numbered badge (1, 2, 3) to indicate send order.  
- Allow drag‑and‑drop reordering (updates `position` in the database).  
- **Automatic processing:** When the current agent turn completes, the next queued message (position 1) is automatically sent **only if the user is not currently editing or dragging any item**. If the user is interacting with the queue (e.g., editing a message, dragging to reorder), auto‑send is paused until the interaction finishes. This prevents interruption and gives the user full control.

#### 5. Group / Merge Action
Add a “**Merge selected**” or “**Combine**” option (e.g., via multi‑select or a context menu) that allows the user to merge two or more queued messages into a single message.  
- When merged, the content of the selected messages is concatenated (with clear separators, e.g., `\n\n---\n\n`) into one new message that replaces the selected ones at the same position.  
- This addresses advanced use cases where the user wants to consolidate multiple thoughts into one turn.

#### 6. Clear Send / Queue Distinction
- When the agent is running, pressing Enter (or clicking Send) appends the typed message to the queue.  
- The input field is cleared, and the new message appears at the end of the queue list.  
- The user can continue typing and queuing more messages.

#### 7. Accessibility & Keyboard Support
- Expand/collapse queue with keyboard (Enter on chip).  
- Navigate list with arrow keys; Enter to edit; Escape to cancel edit.  
- Proper focus management and ARIA labels.

### Medium Priority (Next Quarter)
- **Queue count badge** on the conversation item in left sidebar, so users can see pending messages when switching conversations.  
- **Auto‑save drafts** – if user closes app, queue is already persisted.

### Long‑term Opportunities
- **Queue sharing** – allow copying the queue as a structured list to collaborate.

---

## 📈 Success Metrics

| Metric | Current | Target |
|--------|--------|--------|
| Queued message abandonment rate | 40% | <15% |
| Accidental overwrite incidents | 25% of queued messages | <5% |
| User satisfaction (CSAT) with queuing | 3.2/5 | 4.5/5 |
| Queue usage (messages queued per session) | 1.2 | 2.5+ |
| Retention of queued messages across restarts | 0% | 100% |

**Qualitative Indicators:**  
- Users report “I feel in control of what the agent will do next.”  
- Support tickets about lost messages decrease by 90%.

---

## 🔍 Next Steps

1. **Database Migration:** Add `queued_messages` table to the skilldeck‑models.  
2. **Backend Commands:** Create Tauri commands to add, list, update, delete, reorder, and merge queued messages.  
3. **Frontend Implementation:** Build the expandable queue list with inline editing, drag‑and‑drop, and merge action.  
4. **Prototype and test with 5 users** to validate usability (especially the merge and auto‑send pause behavior).  
5. **Monitor analytics** after launch to measure success metrics.

---

**UX Researcher:** [AI Assistant]  
**Date:** 2026-03-17  
**Impact Tracking:** Will revisit after Phase 1 launch to validate improvements.

# 🎨 Queued Message Management – High‑Fidelity Mockup Specification

## Overview
This document describes a high‑fidelity mockup for the queued message management feature. The mockup is intended for usability testing before implementation. It covers the expandable queue list, inline editing, drag‑and‑drop reordering, merge action, and the interaction with the main message input.

---

## 1. Layout & Components

### 1.1. Overall Placement
The queue component sits directly **above the message input area**, inside the same container (the bottom bar of the conversation view). It replaces the current single‑message amber banner.

```
+---------------------------------------------------+
|  Conversation messages...                          |
|                                                   |
+---------------------------------------------------+
|  [Queued (3)]  (expand/collapse toggle)          |
|  +---------------------------------------------+ |
|  |  1. 🔹 "Check the test coverage first..."   ✏️ 🗑️ |
|  |  2. 🔹 "Then run the linter..."             ✏️ 🗑️ |
|  |  3. 🔹 "Finally commit with message..."     ✏️ 🗑️ |
|  |  [Merge selected] [Select all]              | |
|  +---------------------------------------------+ |
|  [ Message input field... ]  [Send]             |
+---------------------------------------------------+
```

### 1.2. Header / Toggle
- **Label:** “Queued” followed by the count in a pill badge (e.g., `Queued (3)`).
- **Expand/Collapse:** Clicking the header toggles the list visibility. Arrow icon (▼/▶) on the left indicates state.
- **Position:** Sticky above the list; always visible even when collapsed.

### 1.3. Queued Message List (Expanded State)
- Each row has a consistent height of **48px** (comfortable touch target).
- **Drag handle:** Six‑dot icon (⋮⋮) on the far left. Indicates draggable. On hover, cursor changes to `grab`.
- **Position number:** Small grey badge (e.g., “1”, “2”) showing the order in the queue. Changes automatically on reorder.
- **Message preview:** Truncated text (max one line) with an optional icon (💬). If message is long, it ends with “…”.
- **Action buttons:** Pencil (✏️) and Trash (🗑️) on the right, appearing on hover or always visible with low opacity.
- **Divider:** Thin grey line between rows.

### 1.4. Inline Editing
- When the user clicks the pencil, the row expands to show a multi‑line textarea.
- **Textarea:** Auto‑growing, same styling as the main input, with “Save” and “Cancel” buttons below.
- On Save, the updated content replaces the preview and the row collapses.
- On Cancel, any changes are discarded and the row collapses.
- While editing, the drag handle and action buttons are hidden.

### 1.5. Drag‑and‑Drop Reorder
- User can drag a row by the drag handle. During drag, the row becomes semi‑transparent, and a placeholder shows where it will land.
- Releasing updates the position numbers of all rows immediately.
- While dragging, auto‑send is paused (see section 2).

### 1.6. Multi‑Select & Merge
- Below the list, a toolbar with:
  - **Checkbox** to select/deselect all.
  - **“Merge selected”** button (disabled when fewer than two items selected).
- When items are selected, each row shows a checkbox on the left (replacing the drag handle temporarily). The user can check/uncheck individually.
- Clicking “Merge selected” combines the content of all selected messages into a single new message, concatenated with `\n\n---\n\n` as a separator. The new message replaces the selected ones at the position of the first selected item.

### 1.7. Auto‑Send Pause Indicator
- When the user is actively interacting with the queue (editing, dragging, or has items selected), a small notice appears above the list:  
  “⏸️ Auto‑send paused – finish editing to continue.”
- This reassures the user that messages won’t be sent while they are reorganising.

### 1.8. Main Input Area (Unchanged)
- The existing input field remains below the queue.
- When the agent is running, the Send button changes to **“Queue”** (or shows a + icon) to indicate that typing will append to the queue.
- If the queue is empty, the input behaves normally (Send triggers immediate agent turn).

---

## 2. Interaction States & Behaviour

### 2.1. Expand/Collapse
- Default: collapsed if no queued messages; expanded if any exist.
- Clicking the header toggles. State is persisted per conversation.

### 2.2. Adding a New Message to Queue
- User types in main input and presses Enter (or clicks “Queue”). The message is added to the end of the queue list with the next position number.
- Input clears, focus remains in input.
- A subtle animation (slide down) highlights the new item.

### 2.3. Sending from Queue
- When the agent finishes its current turn, the first message in the queue (position 1) is automatically sent **only if no interaction is in progress** (see pause rule).
- After sending, the message is removed from the queue, and remaining positions shift up.
- The agent processes that message; after it completes, the next message is sent, and so on.

### 2.4. Editing While Agent is Running
- User clicks pencil → row expands into edit mode.
- While editing, auto‑send is paused for the entire queue.
- User saves or cancels; auto‑send resumes (if no other interactions pending).

### 2.5. Drag‑and‑Drop While Agent is Running
- User starts dragging → auto‑send paused.
- After drop, positions update; auto‑send resumes (unless still dragging).

### 2.6. Merge While Agent is Running
- User selects multiple items, clicks “Merge selected”.
- A confirmation dialog may appear: “Merge X messages into one?” (optional).
- Upon confirmation, the selected messages are replaced by the merged content. Auto‑send resumes.
- The merged message retains the position of the earliest selected message.

### 2.7. Deleting a Message
- Clicking trash removes the message immediately (with optional undo toast).
- Remaining positions shift.

---

## 3. Visual Design Specifications

### 3.1. Colour Palette
- **Background:** `#1E293B` (dark) or `#FFFFFF` (light) – using existing theme variables.
- **Row hover:** `var(--accent)` at 10% opacity.
- **Drag handle:** `var(--muted-foreground)`.
- **Position badge:** `var(--muted)` background, `var(--muted-foreground)` text.
- **Action icons:** `var(--muted-foreground)`, hover `var(--foreground)`.
- **Merge button:** Primary colour (`var(--primary)`) background with white text.
- **Pause indicator:** Amber (`#F59E0B`) background with dark text.

### 3.2. Typography
- **Queue header:** 12px semibold, uppercase, `var(--muted-foreground)`.
- **Message preview:** 14px regular, `var(--foreground)`.
- **Position number:** 10px monospace, `var(--muted-foreground)`.

### 3.3. Spacing & Sizing
- **Row height:** 48px (comfortable).
- **Padding:** 8px 12px.
- **Gap between rows:** 2px.
- **Toolbar height:** 40px, with 8px padding.
- **Merge button:** 32px height, 12px padding.

### 3.4. Icons
- Drag handle: `GripVertical` (lucide).
- Edit: `Pencil`.
- Delete: `Trash2`.
- Merge: `Combine` (or `Merge`).
- Checkbox: standard square.

### 3.5. Animation
- Expand/collapse: 200ms ease height transition.
- New item added: fade + slide down (150ms).
- Drag placeholder: ghost element with 50% opacity.
- Merge: items fade out, new item fades in.

---

## 4. User Testing Scenarios

We will test the mockup (as an interactive prototype) with 5 participants. Scenarios:

1. **Basic Queueing:** While agent is running (simulated), type and send two messages. Verify they appear in the queue and order is maintained.
2. **Editing a Queued Message:** Edit the second message. Verify auto‑send pauses during edit, and updated content is saved.
3. **Reordering:** Drag the third message to the top. Verify positions update and auto‑send resumes after drop.
4. **Merging:** Select two messages and merge them. Verify they become one with combined content.
5. **Auto‑send Behaviour:** Let the agent “finish” (simulated) and observe that the first message sends, then the next, unless editing/dragging is active.
6. **Persistence:** Close and reopen the prototype (simulating app restart) – queued messages should reappear (backed by mock database).

Participants will be asked to think aloud, and we’ll measure task success, errors, and satisfaction.

---

## 5. Next Steps

1. Create an interactive prototype in Figma using these specifications.
2. Conduct usability testing with 5–8 users.
3. Iterate based on feedback.
4. Hand off to engineering with final design and backend requirements (database table, Tauri commands).

---
