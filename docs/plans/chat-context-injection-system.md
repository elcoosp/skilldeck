I'm using the writing-plans skill to create the implementation plan.

# Chat Context Injection System Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Skill Marketplace and File Attachment features directly into the chat input using a unified "Context Injection" pattern (`@` for Skills, `#` for Files) with visual chips, security linting, and discovery buttons.

**Architecture:** Event-driven React frontend with Tauri backend integration. The chat input acts as a command line, triggering "Command Palettes" for discovery and selection. Selected items are managed in a React Context and rendered as "Chips" with real-time metadata (Lint Status, Trust Badges).

**Tech Stack:** React, TypeScript, Tailwind CSS (UI), Tauri (Backend Commands), Zustand (State Management), `skilldeck-lint` (Integration).

---

## File Structure

We will organize the code by responsibility within the chat feature module to keep files focused and maintainable.

- **`src/store/chat-context-store.ts`**
  - **Responsibility:** Manages the state of attached skills and files. Handles adding, removing, and updating context items. Single source of truth for what is currently "attached" to the draft message.

- **`src/components/chat/input/chat-input.tsx`**
  - **Responsibility:** The main container. It orchestrates the layout: Chips area, Textarea, Bottom Bar. It passes data between the store and UI elements.

- **`src/components/chat/input/chat-input-textarea.tsx`**
  - **Responsibility:** The actual text entry field. Handles the low-level DOM events (`onKeyDown`, `onInput`) to detect trigger characters (`@`, `#`) and cursor position. Pure UI, minimal logic.

- **`src/components/chat/input/command-palette.tsx`**
  - **Responsibility:** The floating "autocomplete" menu. Handles the display of search results, keyboard navigation, and selection. Agnostic to whether it's showing Files or Skills.

- **`src/components/chat/input/context-chip.tsx`**
  - **Responsibility:** Renders a single attached item (Skill or File). Handles visual styles (Security/Lint badges) and "Remove" action.

- **`src/components/chat/input/attachment-button.tsx`**
  - **Responsibility:** The bottom bar buttons. Highly reusable component that injects trigger characters into the textarea focus.

- **`src-tauri/src/commands/context_search.rs`**
  - **Responsibility:** Backend command to search for Skills (via Registry/Local) and Files. Aggregates results for the command palette.

---

## Chunk 1: Context State Architecture & Types

**Files:**
- Create: `src/types/chat-context.ts`
- Create: `src/store/chat-context-store.ts`
- Create: `src/hooks/use-chat-context.ts`

- [ ] **Step 1: Define the Context Types**

Create `src/types/chat-context.ts`. This ensures type safety across the feature.

```typescript
// src/types/chat-context.ts
import { LintWarning } from './lint'; // Assuming existing lint types

export type ContextItemType = 'skill' | 'file';

export interface ContextItem {
  id: string;
  type: ContextItemType;
  name: string;
  status: 'loading' | 'ready' | 'error';
  metadata?: SkillMetadata | FileMetadata;
  lintWarnings?: LintWarning[];
}

export interface SkillMetadata {
  source: 'workspace' | 'personal' | 'registry';
  securityScore: number;
  qualityScore: number;
  version: string;
}

export interface FileMetadata {
  path: string;
  size: number;
  mimeType: string;
}
```

- [ ] **Step 2: Create the Zustand Store**

Create `src/store/chat-context-store.ts`. This manages the list of attached items.

```typescript
// src/store/chat-context-store.ts
import { create } from 'zustand';
import { ContextItem } from '@/types/chat-context';

interface ChatContextState {
  items: ContextItem[];
  addItem: (item: ContextItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ContextItem>) => void;
  clearItems: () => void;
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter((i) => i.id !== id) 
  })),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
  })),
  clearItems: () => set({ items: [] }),
}));
```

- [ ] **Step 3: Create the Hook Wrapper**

Create `src/hooks/use-chat-context.ts` for cleaner imports in components.

```typescript
// src/hooks/use-chat-context.ts
export { useChatContextStore } from '@/store/chat-context-store';
```

- [ ] **Step 4: Commit**

```bash
git add src/types/chat-context.ts src/store/chat-context-store.ts src/hooks/use-chat-context.ts
git commit -m "feat(chat): add state management for context injection"
```

---

## Chunk 2: Input Trigger System (The "Smart" Textarea)

**Files:**
- Create: `src/components/chat/input/chat-input-textarea.tsx`
- Create: `src/hooks/use-input-triggers.ts`
- Modify: `src/components/chat/input/chat-input.tsx` (Shell integration)

- [ ] **Step 1: Implement Trigger Detection Hook**

Create `src/hooks/use-input-triggers.ts`. This isolates the logic of detecting `@` and `#`.

```typescript
// src/hooks/use-input-triggers.ts
import { useCallback, useState } from 'react';

type TriggerType = 'skill' | 'file' | null;

interface TriggerState {
  type: TriggerType;
  startIndex: number;
  query: string;
}

export function useInputTriggers(onTriggerChange: (state: TriggerState | null) => void) {
  const [trigger, setTrigger] = useState<TriggerState | null>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, value: string) => {
    const cursorPos = e.currentTarget.selectionStart;
    
    // Detect '@' for Skills
    if (e.key === '@') {
      const newTrigger = { type: 'skill' as const, startIndex: cursorPos, query: '' };
      setTrigger(newTrigger);
      onTriggerChange(newTrigger);
    }
    // Detect '#' for Files
    else if (e.key === '#') {
      const newTrigger = { type: 'file' as const, startIndex: cursorPos, query: '' };
      setTrigger(newTrigger);
      onTriggerChange(newTrigger);
    }
    // Handle Escape or Space to close
    else if (e.key === 'Escape' || (e.key === ' ' && trigger)) {
      setTrigger(null);
      onTriggerChange(null);
    }
    // Handle Backspace to close if trigger char is deleted
    else if (e.key === 'Backspace' && trigger && cursorPos === trigger.startIndex) {
      setTrigger(null);
      onTriggerChange(null);
    }
    // Update query for filtering
    else if (trigger && e.key.length === 1) {
      setTrigger(prev => prev ? { ...prev, query: prev.query + e.key } : null);
    }
  }, [trigger, onTriggerChange]);

  const closeTrigger = useCallback(() => {
    setTrigger(null);
    onTriggerChange(null);
  }, [onTriggerChange]);

  return { trigger, handleKeyDown, closeTrigger };
}
```

- [ ] **Step 2: Build the Smart Textarea**

Create `src/components/chat/input/chat-input-textarea.tsx`.

```tsx
// src/components/chat/input/chat-input-textarea.tsx
import React, { useRef } from 'react';
import { useInputTriggers } from '@/hooks/use-input-triggers';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onTriggerActive: (type: 'skill' | 'file' | null, query: string) => void;
}

export const ChatInputTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ value, onChange, onTriggerActive }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as any) || internalRef;

    const handleTriggerChange = (state: any) => {
      onTriggerActive(state?.type || null, state?.query || '');
    };

    const { handleKeyDown, closeTrigger } = useInputTriggers(handleTriggerChange);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-resize logic here...
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => handleKeyDown(e, value)}
        placeholder="Message SkillDeck... (Use @ for Skills, # for Files)"
        className="w-full resize-none bg-transparent focus:outline-none text-sm p-2"
        rows={1}
      />
    );
  }
);
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-input-triggers.ts src/components/chat/input/chat-input-textarea.tsx
git commit -m "feat(chat): implement smart input triggers for @ and #"
```

---

## Chunk 3: The Command Palette UI

**Files:**
- Create: `src/components/chat/input/command-palette.tsx`
- Create: `src/components/chat/input/command-palette-item.tsx`

- [ ] **Step 1: Build the Palette Container**

Create `src/components/chat/input/command-palette.tsx`. This component positions the menu relative to the cursor.

```tsx
// src/components/chat/input/command-palette.tsx
import React from 'react';
import { ContextItem } from '@/types/chat-context';

interface Props {
  isOpen: boolean;
  position: { top: number; left: number };
  type: 'skill' | 'file' | null;
  items: ContextItem[];
  loading: boolean;
  onSelect: (item: ContextItem) => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({
  isOpen,
  position,
  items,
  loading,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="absolute z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
        {type === 'skill' ? 'Search Skills...' : 'Search Files...'}
      </div>
      <ul className="max-h-60 overflow-y-auto">
        {loading ? (
          <li className="p-2 text-sm text-gray-500">Searching...</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between"
              onClick={() => onSelect(item)}
            >
              <span className="font-medium">{item.name}</span>
              {item.type === 'skill' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  {(item.metadata as SkillMetadata).source}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
```

- [ ] **Step 2: Integrate Palette in ChatInput**

Update `src/components/chat/input/chat-input.tsx` to render the palette when a trigger is active.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/input/command-palette.tsx
git commit -m "feat(chat): add command palette component"
```

---

## Chunk 4: Skill Integration & Metadata

**Files:**
- Modify: `src-tauri/src/commands/skills.rs` (Add search command)
- Modify: `src/lib/invoke.ts`
- Modify: `src/components/chat/input/chat-input.tsx` (Connect data)

- [ ] **Step 1: Add Tauri Search Command**

Modify `src-tauri/src/commands/skills.rs`.

```rust
#[tauri::command]
pub async fn search_skills_for_context(query: String) -> Result<Vec<ContextSkill>, String> {
    // 1. Search Local (Workspace/Personal) via skilldeck-core
    // 2. Search Registry (Platform API) via http req
    // 3. Merge results respecting priority
    // 4. Return simplified DTO for UI
    Ok(vec![]) // Placeholder
}
```

- [ ] **Step 2: Connect Frontend to Backend**

In `chat-input.tsx`, use `useQuery` to fetch items when `trigger` is active.

```typescript
// Inside chat-input.tsx
const { data: searchResults, isLoading } = useQuery({
  queryKey: ['context-search', triggerType, triggerQuery],
  queryFn: () => invoke('search_skills_for_context', { query: triggerQuery }),
  enabled: triggerType !== null,
});
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/skills.rs src/components/chat/input/chat-input.tsx
git commit -m "feat(chat): connect skill search to command palette"
```

---

## Chunk 5: Context Chips & Linting Visualization

**Files:**
- Create: `src/components/chat/input/context-chip.tsx`
- Modify: `src/components/chat/input/chat-input.tsx` (Render chips)

- [ ] **Step 1: Build the Chip Component**

Create `src/components/chat/input/context-chip.tsx`. This implements the visual feedback system.

```tsx
// src/components/chat/input/context-chip.tsx
import React from 'react';
import { ContextItem } from '@/types/chat-context';

interface Props {
  item: ContextItem;
  onRemove: (id: string) => void;
}

export const ContextChip: React.FC<Props> = ({ item, onRemove }) => {
  const isError = item.lintWarnings?.some(w => w.severity === 'error');
  const isWarning = item.lintWarnings?.some(w => w.severity === 'warning');

  const bgColor = isError 
    ? 'bg-red-100 border-red-500 text-red-800' 
    : isWarning 
    ? 'bg-yellow-100 border-yellow-500 text-yellow-800' 
    : 'bg-blue-100 border-blue-500 text-blue-800';

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${bgColor} group relative`}>
      <span className="font-semibold">{item.type === 'skill' ? '@' : '#'}</span>
      <span>{item.name}</span>
      
      {/* Security/Trust Badge for Skills */}
      {item.type === 'skill' && (
        <span className="opacity-75">
          🛡️ {(item.metadata as any).securityScore}/5
        </span>
      )}

      {/* Remove Button */}
      <button 
        onClick={() => onRemove(item.id)}
        className="ml-1 hover:text-red-600 font-bold"
      >
        ×
      </button>

      {/* Lint Warning Tooltip on Hover */}
      {item.lintWarnings && item.lintWarnings.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-black text-white text-xs rounded p-2 hidden group-hover:block z-10">
          {item.lintWarnings.map((w, i) => (
            <div key={i} className="mb-1">
              <span className="font-bold capitalize">{w.severity}:</span> {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Render Chips in Input**

In `chat-input.tsx`, render the chips above the textarea.

```tsx
// Inside chat-input.tsx
const { items, removeItem } = useChatContextStore();

return (
  <div className="relative w-full">
    {/* Chips Container */}
    <div className="flex flex-wrap gap-1 p-2">
      {items.map(item => (
        <ContextChip key={item.id} item={item} onRemove={removeItem} />
      ))}
    </div>
    
    {/* Textarea */}
    <ChatInputTextarea ... />
  </div>
);
```

- [ ] **Step 3: Implement Lint Fetching on Select**

When an item is selected in `command-palette`, trigger a lint check.

```typescript
// Handle selection
const handleSelectItem = async (item: ContextItem) => {
  additem(item); // Add immediately
  
  if (item.type === 'skill') {
    // Fetch lint status in background
    const warnings = await invoke('lint_skill', { path: item.id });
    updateItem(item.id, { lintWarnings: warnings, status: 'ready' });
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/input/context-chip.tsx src/components/chat/input/chat-input.tsx
git commit -m "feat(chat): implement context chips with lint visualization"
```

---

## Chunk 6: Bottom Bar "Bridge" Buttons

**Files:**
- Create: `src/components/chat/input/attachment-button.tsx`
- Modify: `src/components/chat/input/chat-input.tsx`

- [ ] **Step 1: Create Button Component**

```tsx
// src/components/chat/input/attachment-button.tsx
import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  triggerChar: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onClick?: () => void;
}

export const AttachmentButton: React.FC<Props> = ({ icon, label, triggerChar, inputRef }) => {
  const handleClick = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Focus input
    textarea.focus();
    
    // Inject trigger char
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    
    const newValue = value.substring(0, start) + triggerChar + value.substring(end);
    // We need to simulate an event or use a state updater passed from parent
    // For simplicity, assuming parent handles state update via onChange
    
    // Dispatch input event to trigger the logic in ChatInputTextarea
    // (Implementation details depend on how strictly you control input)
    
    // Easier path: Just focus and let user type, or trigger the palette manually
    // via the onTriggerActive prop passed down.
  };

  return (
    <button 
      onClick={handleClick}
      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
      title={label}
    >
      {icon}
    </button>
  );
};
```

- [ ] **Step 2: Add Buttons to ChatInput**

```tsx
// chat-input.tsx
<div className="flex items-center border-t border-gray-100 p-1">
  <AttachmentButton 
    icon={<AtSignIcon />} 
    label="Skill" 
    triggerChar="@" 
    inputRef={textareaRef} 
  />
  <AttachmentButton 
    icon={<HashIcon />} 
    label="File" 
    triggerChar="#" 
    inputRef={textareaRef} 
  />
  {/* Send Button */}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/input/attachment-button.tsx
git commit -m "feat(chat): add bottom bar buttons to inject triggers"
```

## Chunk 7: Backend Context Search Aggregation

**Files:**
- Create: `src-tauri/src/commands/context.rs`
- Modify: `src-tauri/src/main.rs` (register commands)
- Modify: `src-tauri/Cargo.toml` (add dependencies if needed)

- [ ] **Step 1: Define the Search Logic**

We need a command that merges results from local sources (Workspace, Personal) and the Platform Registry. This implements the "Shadowing" logic defined in the UX research.

```rust
// src-tauri/src/commands/context.rs
use crate::state::AppState;
use skilldeck_core::skills::SkillSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSkillResult {
    id: String,
    name: String,
    source: String, // "workspace", "personal", "registry"
    security_score: i32,
    quality_score: i32,
    is_installed: bool,
}

#[tauri::command]
pub async fn search_context_skills(
    state: tauri::State<'_, AppState>,
    query: String,
) -> Result<Vec<ContextSkillResult>, String> {
    let registry = &state.skill_registry;
    
    // 1. Search Local (Workspace & Personal)
    // Assuming `search_local` returns skills with their source priority
    let local_results = registry.search_local(&query).await.map_err(|e| e.to_string())?;
    
    // 2. Search Platform Registry (if online)
    let mut platform_results = match registry.search_platform(&query).await {
        Ok(res) => res,
        Err(_) => vec![], // Fail gracefully if offline
    };

    // 3. Merge & Filter
    // If a skill exists locally, we hide the registry version (Shadowing)
    let local_names: Vec<String> = local_results.iter().map(|s| s.name.clone()).collect();
    
    let mut final_results: Vec<ContextSkillResult> = local_results.into_iter().map(|s| ContextSkillResult {
        id: s.id,
        name: s.name,
        source: s.source.to_string(),
        security_score: s.security_score.unwrap_or(5), // Default for local
        quality_score: s.quality_score.unwrap_or(5),
        is_installed: true,
    }).collect();

    for p_skill in platform_results {
        if !local_names.contains(&p_skill.name) {
            final_results.push(ContextSkillResult {
                id: p_skill.id,
                name: p_skill.name,
                source: "registry".to_string(),
                security_score: p_skill.security_score,
                quality_score: p_skill.quality_score,
                is_installed: false,
            });
        }
    }

    Ok(final_results)
}
```

- [ ] **Step 2: Register Command in Main**

Modify `src-tauri/src/main.rs`.

```rust
fn main() {
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            commands::context::search_context_skills
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/context.rs src-tauri/src/main.rs
git commit -m "feat(chat): add backend command for context skill search"
```

---

## Chunk 8: Security Interstitial & Trust Modals

**Files:**
- Create: `src/components/chat/input/security-warning-modal.tsx`
- Modify: `src/components/chat/input/chat-input.tsx` (Trigger modal)

- [ ] **Step 1: Build the Warning Modal**

This implements the "High Risk Skill" mitigation strategy.

```tsx
// src/components/chat/input/security-warning-modal.tsx
import React from 'react';
import { ContextItem } from '@/types/chat-context';
import { Dialog } from '@/components/ui/dialog'; // Assuming UI lib

interface Props {
  skill: ContextItem;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SecurityWarningModal: React.FC<Props> = ({ skill, onConfirm, onCancel }) => {
  const warnings = skill.lintWarnings || [];
  const dangerousWarnings = warnings.filter(w => w.rule_id.includes('sec-'));

  return (
    <Dialog open={true} onClose={onCancel}>
      <Dialog.Header>
        <span className="text-red-600 font-bold">⚠️ Security Warning</span>
      </Dialog.Header>
      <Dialog.Content>
        <p className="mb-2">
          The skill <strong>{skill.name}</strong> has been flagged for potentially dangerous behavior.
        </p>
        <div className="bg-red-50 p-3 rounded border border-red-200 text-sm">
          <ul className="list-disc pl-4">
            {dangerousWarnings.map((w, i) => (
              <li key={i} className="text-red-800">{w.message}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs mt-2 text-gray-500">
          Installing this skill might expose your system to malicious commands. Proceed with caution.
        </p>
      </Dialog.Content>
      <Dialog.Footer>
        <button 
          onClick={onCancel} 
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Cancel (Recommended)
        </button>
        <button 
          onClick={onConfirm} 
          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 ml-2"
        >
          Install At My Own Risk
        </button>
      </Dialog.Footer>
    </Dialog>
  );
};
```

- [ ] **Step 2: Integrate Modal Logic**

Update `chat-input.tsx` to intercept selection based on security score.

```typescript
// chat-input.tsx
const [pendingSkill, setPendingSkill] = useState<ContextItem | null>(null);

const handleSelectItem = (item: ContextItem) => {
  // Security Check
  if (item.type === 'skill' && item.metadata.securityScore < 2) {
    setPendingSkill(item); // Trigger modal
  } else {
    confirmAddItem(item);
  }
};

const confirmAddItem = (item: ContextItem) => {
  addItem(item);
  closePalette();
  // Run background lint check
  // ...
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/input/security-warning-modal.tsx
git commit -m "feat(chat): add security warning modal for dangerous skills"
```

---

## Chunk 9: Skill Installation Flow (Registry to Local)

**Files:**
- Create: `src-tauri/src/commands/install.rs`
- Modify: `src/components/chat/input/chat-input.tsx`

- [ ] **Step 1: Implement Install Command**

When a user selects a Registry skill, we must copy it to a local source to use it.

```rust
// src-tauri/src/commands/install.rs
use std::path::PathBuf;
use crate::state::AppState;

#[tauri::command]
pub async fn install_registry_skill(
    state: tauri::State<'_, AppState>,
    skill_id: String,
    target_source: String, // "workspace" or "personal"
) -> Result<String, String> {
    // 1. Fetch Skill Content from Platform API
    let skill_content = state.platform_client.fetch_skill(&skill_id).await.map_err(|e| e.to_string())?;
    
    // 2. Determine Target Path
    let base_path = match target_source.as_str() {
        "workspace" => std::env::current_dir().unwrap().join(".skilldeck/skills"),
        "personal" => dirs::home_dir().unwrap().join(".agents/skills"),
        _ => return Err("Invalid source".into()),
    };

    // 3. Write Skill
    let skill_dir = base_path.join(&skill_content.name);
    std::fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;
    std::fs::write(skill_dir.join("SKILL.md"), &skill_content.content).map_err(|e| e.to_string())?;

    // 4. Return new local path
    Ok(skill_dir.to_string_lossy().to_string())
}
```

- [ ] **Step 2: Handle Installation in UI**

If `item.is_installed === false`, show a small loader/install step in the chip.

```tsx
// chat-input.tsx
const handleInstall = async (item: ContextItem) => {
  updateItem(item.id, { status: 'loading' });
  try {
    const localPath = await invoke('install_registry_skill', { 
      skillId: item.id, 
      targetSource: 'personal' 
    });
    
    // Update item to be local
    updateItem(item.id, { 
      source: 'personal', 
      is_installed: true, 
      status: 'ready',
      id: localPath 
    });
  } catch (e) {
    removeItem(item.id);
    toast.error("Failed to install skill");
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/install.rs src/components/chat/input/chat-input.tsx
git commit -m "feat(chat): implement skill installation flow from registry"
```

---

## Chunk 10: Final Integration & Testing

**Files:**
- Modify: `src/components/chat/input/chat-input.tsx` (Final Polish)
- Create: `tests/e2e/context-injection.spec.ts`

- [ ] **Step 1: Integrate with Chat Submission**

Ensure attached items are passed to the backend when the user hits "Send".

```typescript
// chat-input.tsx
const handleSend = () => {
  const context = items.map(item => ({
    type: item.type,
    id: item.id, // Path for local, URL for registry
  }));

  onSend({ message: inputValue, context });
  
  // Clear state
  setInputValue('');
  clearItems();
};
```

- [ ] **Step 2: Write E2E Test**

Test the full flow: Trigger -> Search -> Select -> Chip -> Send.

```typescript
// tests/e2e/context-injection.spec.ts
import { test, expect } from '@playwright/test';

test('User can inject a skill via @ and send', async ({ page }) => {
  await page.goto('/chat');
  
  // Focus input
  await page.click('[data-testid="chat-input"]');
  
  // Type trigger
  await page.keyboard.type('@DataCleaner');
  
  // Wait for palette
  await expect(page.locator('text=Data-Cleaner')).toBeVisible();
  
  // Select
  await page.keyboard.press('Enter');
  
  // Verify Chip
  await expect(page.locator('[data-testid="context-chip"]')).toContainText('Data-Cleaner');
  
  // Send
  await page.keyboard.type('Clean this data.');
  await page.click('[data-testid="send-button"]');
  
  // Verify message sent (mock response or check UI state)
});
```

- [ ] **Step 3: Final Commit**

```bash
git add .
git commit -m "feat(chat): finalize context injection system and tests"
```

---

## 🏁 Summary

This plan delivers a robust "Chat Context Injection" system that seamlessly bridges the Skill Marketplace and Chat Interface.

1.  **Architecture**: Built a dedicated state store (`chat-context-store`) to handle the complexity of attached items.
2.  **UX**: Implemented a unified trigger system (`@` and `#`) accessible via both keyboard and mouse, satisfying both power users and novices.
3.  **Safety**: Integrated real-time linting and security modals directly into the selection flow, preventing users from accidentally activating dangerous skills.
4.  **Integration**: Created the backend logic to search, resolve (shadowing), and install skills directly from the chat input context.
