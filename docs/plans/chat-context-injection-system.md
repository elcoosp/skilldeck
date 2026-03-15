# Chat Context Injection System Implementation Plan (Part 1)

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Skill Marketplace and File Attachment features directly into the chat input using a unified "Context Injection" pattern (`@` for Skills, `#` for Files), reusing existing marketplace components and `shadcn/ui` for styling.

**Architecture:** Event-driven React frontend extending the existing `ChatInput` component. The File Picker uses a portal-based, stateful component to handle navigation and scope selection, while the Skill Picker reuses the lightweight palette approach.

**Tech Stack:** React, TypeScript, Tailwind CSS, `shadcn/ui`, Tauri, Zustand.

---

## File Structure

We adhere to `kebab-case` file names and use `shadcn/ui` components.

- **Create: `src/types/chat-context.ts`**
  - **Responsibility:** Defines TypeScript interfaces for Context Items (Skills, Files, Folders).

- **Create: `src/store/chat-context-store.ts`**
  - **Responsibility:** Manages the transient state of "what is attached" to the current draft message.

- **Create: `src/components/chat/file-mention-picker.tsx`**
  - **Responsibility:** The portal-based file browser with folder navigation and scope selection.

- **Create: `src/components/chat/folder-scope-modal.tsx`**
  - **Responsibility:** Modal for selecting "Shallow" vs "Deep" folder inclusion using `shadcn` Dialog.

- **Create: `src/components/chat/chat-command-palette.tsx`**
  - **Responsibility:** The lightweight autocomplete menu for Skills (reusing Marketplace logic).

- **Modify: `src/components/chat/chat-input.tsx`**
  - **Responsibility:** Main entry point. Manages trigger detection (`@`, `#`) and renders the pickers.

---

## Chunk 1: Context State Architecture & Types

**Files:**
- Create: `src/types/chat-context.ts`
- Create: `src/store/chat-context-store.ts`
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Define Context Types**

Create `src/types/chat-context.ts`. We extend types to handle Folder scopes.

```typescript
// src/types/chat-context.ts
import { RegistrySkill, LintWarning } from '@/lib/invoke';

export type ContextItemType = 'skill' | 'file' | 'folder';

export interface AttachedSkill {
  type: 'skill';
  data: RegistrySkill;
}

export interface AttachedFile {
  type: 'file';
  data: {
    id: string; // Path
    name: string;
    path: string;
    size?: number;
  };
}

export interface AttachedFolder {
  type: 'folder';
  data: {
    id: string; // Path
    name: string;
    path: string;
    scope: 'shallow' | 'deep';
    fileCount: number;
  };
}

export type AttachedItem = AttachedSkill | AttachedFile | AttachedFolder;

export interface TriggerState {
  type: 'skill' | 'file';
  query: string;
  startIndex: number;
}

// Interface matching the FileMentionPicker props
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
}
```

- [ ] **Step 2: Verify invoke.ts Exports**

Check `src/lib/invoke.ts` to ensure `RegistrySkill` and `LintWarning` are exported (as per previous steps).

- [ ] **Step 3: Create the Context Store**

Create `src/store/chat-context-store.ts`.

```typescript
// src/store/chat-context-store.ts
import { create } from 'zustand';
import { AttachedItem, AttachedSkill, AttachedFile, AttachedFolder } from '@/types/chat-context';
import { RegistrySkill, LintWarning } from '@/lib/invoke';

interface ChatContextState {
  items: AttachedItem[];
  addSkill: (skill: RegistrySkill) => void;
  addFile: (file: AttachedFile['data']) => void;
  addFolder: (folder: AttachedFolder['data']) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  updateSkillLintResults: (skillId: string, warnings: LintWarning[]) => void;
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  items: [],

  addSkill: (skill) => set((state) => {
    if (state.items.some(item => item.type === 'skill' && item.data.id === skill.id)) return state;
    return { items: [...state.items, { type: 'skill', data: skill }] };
  }),

  addFile: (file) => set((state) => {
    if (state.items.some(item => item.type === 'file' && item.data.id === file.id)) return state;
    return { items: [...state.items, { type: 'file', data: file }] };
  }),

  addFolder: (folder) => set((state) => {
    if (state.items.some(item => item.type === 'folder' && item.data.id === folder.id)) return state;
    return { items: [...state.items, { type: 'folder', data: folder }] };
  }),

  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.data.id !== id)
  })),

  clearItems: () => set({ items: [] }),

  updateSkillLintResults: (skillId, warnings) => set((state) => ({
    items: state.items.map(item => {
      if (item.type === 'skill' && item.data.id === skillId) {
        return { ...item, data: { ...item.data, lintWarnings: warnings } };
      }
      return item;
    })
  }))
}));
```

- [ ] **Step 4: Commit State Management**

```bash
git add src/types/chat-context.ts src/store/chat-context-store.ts src/lib/invoke.ts
git commit -m "feat(chat): add state management for context injection with folder support"
```

---

## Chunk 2: Backend File System Commands

**Files:**
- Create: `src-tauri/src/commands/files.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Create Directory Listing Command**

We need a command that lists files and provides counts for the scope modal.

```rust
// src-tauri/src/commands/files.rs
use std::path::PathBuf;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderCounts {
    pub shallow: usize,
    pub deep: usize,
}

#[tauri::command]
pub fn list_directory_contents(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);
    
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("Path is not a valid directory".into());
    }

    let mut entries = Vec::new();
    
    // Add parent directory (..)
    if let Some(parent) = dir_path.parent() {
        entries.push(FileEntry {
            name: "..".to_string(),
            path: parent.to_string_lossy().to_string(),
            is_dir: true,
            size: None,
        });
    }

    // Add current directory (.)
    entries.push(FileEntry {
        name: ".".to_string(),
        path: dir_path.to_string_lossy().to_string(),
        is_dir: true,
        size: None,
    });

    // Read directory
    if let Ok(read_dir) = fs::read_dir(&dir_path) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            
            // Basic ignore
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                continue;
            }

            let metadata = entry.metadata().ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            let size = metadata.as_ref().map(|m| m.len()).ok();

            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                size,
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn count_folder_files(path: String) -> Result<FolderCounts, String> {
    let dir_path = PathBuf::from(&path);
    
    let mut shallow_count = 0;
    let mut deep_count = 0;

    if let Ok(read_dir) = fs::read_dir(&dir_path) {
        for entry in read_dir.flatten() {
            // Shallow count (direct children that are files)
            if entry.path().is_file() {
                shallow_count += 1;
            }
        }
    }

    // Deep count (recursive)
    let walker = WalkDir::new(&dir_path).into_iter();
    for entry in walker.filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            deep_count += 1;
        }
    }

    Ok(FolderCounts {
        shallow: shallow_count,
        deep: deep_count, 
    })
}
```

- [ ] **Step 2: Register Commands**

Modify `src-tauri/src/main.rs`.

```rust
mod commands;
// ...
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing
            commands::files::list_directory_contents,
            commands::files::count_folder_files
        ])
        // ...
}
```

- [ ] **Step 3: Add Frontend Bindings**

Modify `src/lib/invoke.ts`.

```typescript
// src/lib/invoke.ts
// ... existing imports
import { FileEntry, FolderCounts } from '@/types/chat-context';

export async function listDirectoryContents(path: string): Promise<FileEntry[]> {
  return invoke('list_directory_contents', { path });
}

export async function countFolderFiles(path: string): Promise<FolderCounts> {
  return invoke('count_folder_files', { path });
}
```

- [ ] **Step 4: Commit Backend**

```bash
git add src-tauri/src/commands/files.rs src-tauri/src/main.rs src/lib/invoke.ts
git commit -m "feat(chat): add backend commands for file browsing and counting"
```
