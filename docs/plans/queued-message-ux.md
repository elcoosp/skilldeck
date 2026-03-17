# 🎨 Queued Message Management – Final UX Specification

## 1. Overview & Goals

The queued message feature allows users to continue composing messages while the agent is processing a previous turn. Messages are stored in a persistent, editable list and are automatically sent in order when the agent becomes idle. This design aims to:

- **Increase visibility** – users can see all pending messages at a glance.
- **Maintain flow** – typing is never blocked by a running agent.
- **Provide control** – edit, delete, reorder, or merge queued messages without disrupting the ongoing conversation.
- **Ensure predictability** – auto‑send only occurs when the user is not actively manipulating the queue.

## 2. High‑Level User Flow

1. **Agent is running** → Input field’s Send button becomes “Queue”.  
   - User types a message and presses Enter (or clicks Queue).  
   - Message is appended to the queue list, input clears.  
   - Queue expands (if collapsed) to show the new item.

2. **Queue management**  
   - User can expand/collapse the queue via the header.  
   - Within the expanded list:  
     - **Reorder** via drag handle (⋮⋮).  
     - **Edit** inline – click pencil, row expands to textarea.  
     - **Delete** – click trash, item removed (with optional undo toast).  
     - **Merge** – enter selection mode, select multiple items, click “Merge”.

3. **Auto‑send**  
   - When agent finishes a turn, the first item in the queue is sent automatically **only if**:
     - No item is being edited.
     - No drag is in progress.
     - Selection mode is inactive.
   - After sending, the item is removed from the queue, and remaining items shift up.

4. **Queue persistence**  
   - Queue state (items, order) is persisted in the database per conversation, surviving app restarts.

## 3. Detailed Component Specification

### 3.1. Queue Header
- **Always visible** above the input area.
- **Content:**
  - Arrow icon (▼/▶) indicating expand/collapse state.
  - Label: “Queued”
  - Badge with current count (e.g., `(3)`).
- **Interaction:** Click toggles expanded state. Hover background changes (`var(--accent)` at 10%).
- **Accessibility:** `role="button"`, `aria-expanded`, keyboard focusable.

### 3.2. Queue List (Expanded State)
- **Container** with fixed maximum height (e.g., `200px`) and scrollable if needed.
- **Rows** – each represents a queued message.
  - **Height:** `48px` (comfortable touch target).
  - **Layout:**  
    `[drag handle] [position badge] [message preview] [edit] [delete]`
  - **Drag handle:** Six‑dot icon (`⋮⋮`), visible on hover (or always with low opacity). Cursor changes to `grab`.
  - **Position badge:** Small grey circle with the item’s order number (1,2,3…). Updates on reorder.
  - **Message preview:** Single‑line truncation with ellipsis. Font size `14px`.
  - **Action icons:** Pencil and trash, appear on hover (or always with `0.4` opacity).
- **Hover state:** Light background (`var(--accent)` at 5%) and border.
- **Focus state:** Outline ring for keyboard navigation.

### 3.3. Inline Editing
- **Trigger:** Click pencil icon.
- **Visual:** Row expands to accommodate a multi‑line textarea (min-height `60px`). Drag handle and position badge are hidden.
- **Textarea:** Auto‑growing, same styling as main input, with “Save” and “Cancel” buttons below.
- **Behavior:**
  - While editing, auto‑send is paused (pause indicator appears).
  - Save updates the message content and collapses the row.
  - Cancel discards changes and collapses.
  - Pressing `Enter` in the textarea does **not** submit (to allow line breaks); `Cmd+Enter` can be used for save.

### 3.4. Drag‑and‑Drop Reorder
- **Trigger:** Drag by the handle.
- **Visual:**
  - Ghost element follows cursor with `opacity: 0.7`.
  - Placeholder shows where item will land (grey dashed border).
  - While dragging, auto‑send is paused (pause indicator appears).
- **After drop:** Position badges of all items update immediately.

### 3.5. Selection Mode & Merging
- **Enter selection mode:** Click “Select” button in toolbar.
- **Visual:** Each row shows a checkbox on the left, replacing drag handle and position badge. Action icons (edit/delete) are hidden.
- **Toolbar changes:** Shows “Select all” checkbox, “Merge selected” button, and “Cancel” link.
- **Merge action:**
  - Enabled only when ≥2 items selected.
  - Clicking merges selected items into one new message, concatenating content with `\n\n---\n\n` separator.
  - New message replaces selected items at the position of the earliest selected item.
  - Selection mode ends automatically.

### 3.6. Pause Indicator (No Layout Shift)
- **Position:** Placed **above** the queue list but **inside** the queue container, using absolute positioning within a reserved space.
- **Implementation:** The queue container has a fixed top padding (e.g., `8px`) that accommodates the indicator without shifting the list.
  - Indicator is absolutely positioned within that padding, with `top: 0`, `left: 0`, `right: 0`, `height: 28px`.
  - When hidden, the space is empty but the layout remains stable.
- **Content:** “⏸️ Auto‑send paused – finish editing to continue.” with amber background.
- **Shown when:** Editing, dragging, or selection mode is active.

### 3.7. Main Input Area
- **Input field:** Standard text input with placeholder.
- **Send/Queue button:** Changes label based on agent state:
  - Agent idle → “Send”
  - Agent running → “Queue”
- **Behavior when agent running:**
  - Clicking or pressing Enter **appends** the message to the queue (does not send immediately).
  - Input clears, focus remains.
  - If queue was collapsed, it expands to show the new item.

### 3.8. Auto‑Send Logic
- **Trigger:** Agent completes a turn (e.g., after receiving a final response).
- **Check:** 
  - Queue not empty.
  - No editing in progress.
  - No drag in progress.
  - Selection mode inactive.
- **Action:** Remove first item from queue and send it as a user message. The agent will process it as usual.
- **After send:** Queue updates (remaining items shift). If more items exist, they will be sent after each subsequent agent completion (auto‑send continues until queue empty).
- **Edge case:** If user adds a new message while auto‑send is in progress (e.g., after the first item was sent but before the second), the new message is appended to the end; order is preserved.

## 4. Micro‑interactions & Animations

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Expand/collapse queue | Height transition | 200ms | ease |
| New item added | Slide down + fade | 150ms | ease-out |
| Item removed | Fade out + slide up | 150ms | ease-in |
| Drag start | Ghost scale 0.98 | 100ms | ease |
| Drop | Ghost scale to 1 | 100ms | ease |
| Position badge update | Quick number change (no animation) | – | – |
| Pause indicator appear/disappear | Fade | 150ms | ease |

All animations respect `prefers-reduced-motion`.

## 5. Accessibility (a11y)

- **Keyboard navigation:**
  - Queue header focusable, `Enter` toggles expand.
  - Arrow keys navigate rows when expanded.
  - `Enter` on a row (if not editing) activates edit (or opens context menu).
  - `Tab` moves through actions within a row.
  - `Escape` cancels edit or selection mode.
- **ARIA:**
  - Queue container has `role="list"`, rows have `role="listitem"`.
  - Expand button has `aria-expanded`.
  - Edit mode: `aria-label` on textarea, buttons have accessible names.
- **Focus management:** When entering edit mode, focus moves to the textarea. When exiting, focus returns to the row’s pencil button.
- **Color contrast:** All text meets WCAG AA (minimum 4.5:1). Pause indicator uses amber with dark text for readability.

## 6. Visual Design Tokens (Reusing existing theme)

| Token | Usage |
|-------|-------|
| `--background` | Queue container background |
| `--accent` | Hover states |
| `--muted` | Position badge background |
| `--muted-foreground` | Position badge text, action icons default |
| `--primary` | Merge button, Send button |
| `--destructive` | Delete icon hover (optional) |
| `--warning` (new) | Pause indicator background (`#FEF3C7`) |
| `--warning-foreground` | Pause indicator text (`#92400E`) |

## 7. Implementation Notes

### 7.1. Database Schema (Additions)
```sql
CREATE TABLE queued_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_queued_conversation_position ON queued_messages(conversation_id, position);
```

### 7.2. Backend Commands (Tauri)
- `add_queued_message(conversation_id, content) → id`
- `list_queued_messages(conversation_id) → Vec<QueuedMessage>`
- `update_queued_message(id, content)`
- `delete_queued_message(id)`
- `reorder_queued_messages(conversation_id, ordered_ids)` – updates positions atomically.
- `merge_queued_messages(ids) → new_id` – deletes given ids, inserts merged message at appropriate position.

### 7.3. Frontend State Management
- Use Zustand store (or React Query) to sync queue with backend.
- Optimistic updates for reorder, edit, delete – rollback on error.
- Polling or event listening for auto‑send triggers (agent‑done event).

## 8. Usability Testing Plan

1. **Participants:** 5–8 SkillDeck users (mix of new and power users).
2. **Tasks:**
   - While agent is running, queue three messages.
   - Edit the second message.
   - Reorder the list (move third to top).
   - Merge the last two messages.
   - Observe auto‑send after simulated agent completion.
3. **Metrics:**
   - Task completion rate.
   - Time on task.
   - Number of errors/clicks.
   - Subjective satisfaction (Likert scale).
4. **Success criteria:**
   - 90% of users complete tasks without assistance.
   - No user reports confusion about auto‑send pauses.
   - Average satisfaction ≥ 4.5/5.

## 9. Summary

This specification provides a complete, polished UX for queued message management. It addresses the key pain points: visibility, editability, order control, and predictable auto‑send. The design ensures no layout shifts, smooth micro‑interactions, and full accessibility. Implementation should follow the database schema and backend commands outlined, with frontend components matching the detailed behavior described.
