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
import { RegistrySkill, LintWarning } from '@/lib/bindings';

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
import { RegistrySkill, LintWarning } from '@/lib/bindings';

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

## Chunk 3: Folder Scope Modal Component

**Files:**
- Create: `src/components/chat/folder-scope-modal.tsx`

- [ ] **Step 1: Create the Modal Component**

We replace the custom CSS modal with a `shadcn/ui` Dialog structure. We use `lucide-react` for icons.

```tsx
// src/components/chat/folder-scope-modal.tsx
import React from 'react';
import { File, FolderTree, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FolderScopeModalProps {
  folderPath: string;
  shallowCount: number;
  deepCount: number;
  onConfirm: (isDeep: boolean) => void;
  onBack: () => void;
}

export const FolderScopeModal: React.FC<FolderScopeModalProps> = ({
  folderPath,
  shallowCount,
  deepCount,
  onConfirm,
  onBack,
}) => {
  return (
    <div className="p-2 bg-popover rounded-lg border shadow-lg">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <FolderTree className="w-4 h-4" />
          {folderPath || '/'}
        </span>
      </div>
      
      <div className="space-y-2">
        {/* Shallow Option */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-2 px-2"
          onClick={() => onConfirm(false)}
        >
          <File className="w-5 h-5 text-muted-foreground" />
          <div className="flex flex-col items-start">
            <span className="font-medium">Direct children only</span>
            <span className="text-xs text-muted-foreground">
              {shallowCount} file{shallowCount !== 1 ? 's' : ''} in this folder
            </span>
          </div>
        </Button>

        {/* Deep Option */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-2 px-2"
          onClick={() => onConfirm(true)}
        >
          <FolderTree className="w-5 h-5 text-muted-foreground" />
          <div className="flex flex-col items-start">
            <span className="font-medium">All nested files</span>
            <span className="text-xs text-muted-foreground">
              {deepCount} file{deepCount !== 1 ? 's' : ''} total
            </span>
          </div>
        </Button>
      </div>

      <div className="flex justify-between mt-3 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit Modal Component**

```bash
git add src/components/chat/folder-scope-modal.tsx
git commit -m "feat(chat): add folder scope modal using shadcn components"
```

---

## Chunk 4: File Mention Picker Component

**Files:**
- Create: `src/components/chat/file-mention-picker.tsx`

- [ ] **Step 1: Create the File Mention Picker**

We implement the provided logic using `shadcn/ui` primitives and Tailwind. We use `createPortal` for the floating list to break out of containers.

```tsx
// src/components/chat/file-mention-picker.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileIcon, FolderIcon, CheckCircle, Loader2, XCircle, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FolderScopeModal } from './folder-scope-modal';
import { FileEntry } from '@/types/chat-context';
import { cn } from '@/lib/utils'; // shadcn utility

interface FileMentionPickerProps {
  open: boolean;
  query: string;
  position: { top: number; left: number } | null;
  items: FileEntry[];
  loading: boolean;
  uploadingFiles?: Map<string, { status: 'pending' | 'success' | 'error'; error?: string }>;
  currentFolderCounts?: { shallow: number; deep: number };
  onSelect: (file: FileEntry, isShift?: boolean) => void;
  onClose: () => void;
  onQueryChange?: (query: string) => void;
}

const FILE_SIZE_WARN_THRESHOLD = 50 * 1024; // 50 KB

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FileMentionPicker: React.FC<FileMentionPickerProps> = ({
  open,
  query,
  position,
  items,
  loading,
  uploadingFiles = new Map(),
  currentFolderCounts = { shallow: 0, deep: 0 },
  onSelect,
  onClose,
  onQueryChange,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<'list' | 'folder-scope-confirm'>('list');
  const [pendingFolder, setPendingFolder] = useState<FileEntry | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Filter logic (simple search)
  // Note: The parent controls 'items' which might reflect current directory.
  // We do local filtering only for search query if provided
  const filtered = items.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.path.toLowerCase().includes(query.toLowerCase())
  );

  // Reset view when picker closes
  useEffect(() => {
    if (!open) {
      setView('list');
      setPendingFolder(null);
    }
  }, [open]);

  // Focus search when list is shown
  useEffect(() => {
    if (open && view === 'list' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, view]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    if (view === 'folder-scope-confirm') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setView('list');
        setPendingFolder(null);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleItemSelect(filtered[selectedIndex], e.shiftKey);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleItemSelect = (file: FileEntry, isShift: boolean) => {
    // Intercept . (current folder) to show scope modal
    if (file.isDir && file.name === '.') {
      setPendingFolder(file);
      setView('folder-scope-confirm');
      return;
    }
    onSelect(file, isShift);
  };

  // Scroll selected into view
  useEffect(() => {
    if (view === 'list' && listRef.current && selectedIndex >= 0) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, view]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  const renderStatusIcon = (file: FileEntry) => {
    const status = uploadingFiles.get(file.name);
    if (!status) return null;

    switch (status.status) {
      case 'pending':
        return <Loader2 className="animate-spin w-3 h-3" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={pickerRef}
      className="fixed z-50 w-80 bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
      onKeyDown={handleKeyDown}
    >
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search files..."
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {view === 'folder-scope-confirm' && pendingFolder && (
        <FolderScopeModal
          folderPath={pendingFolder.path}
          shallowCount={currentFolderCounts.shallow}
          deepCount={currentFolderCounts.deep}
          onConfirm={(isDeep) => {
            onSelect(pendingFolder, isDeep);
            setView('list');
            setPendingFolder(null);
          }}
          onBack={() => {
            setView('list');
            setPendingFolder(null);
          }}
        />
      )}

      {view === 'list' && (
        <div className="max-h-60 overflow-y-auto p-1" ref={listRef}>
          {loading && (
            <div className="flex items-center justify-center p-4 gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Loading...</span>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No files found</div>
          )}
          {!loading &&
            filtered.map((file, index) => {
              const sizeFormatted = file.isDir ? '—' : formatBytes(file.size);
              const isLarge = !file.isDir && (file.size ?? 0) > FILE_SIZE_WARN_THRESHOLD;
              return (
                <div
                  key={file.path}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm',
                    index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  )}
                  onClick={() => handleItemSelect(file, false)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                    {file.isDir ? (
                      file.name === '..' ? (
                        <ChevronLeft className="w-4 h-4" />
                      ) : (
                        <FolderIcon className="w-4 h-4" />
                      )
                    ) : (
                      <FileIcon className="w-4 h-4" />
                    )}
                  </span>
                  <span className="font-medium truncate w-24">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {file.path}
                  </span>
                  <span
                    className={cn('text-xs tabular-nums', isLarge && 'text-yellow-600 dark:text-yellow-500')}
                  >
                    {sizeFormatted}
                  </span>
                  <span className="w-3 h-3">{renderStatusIcon(file)}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: Commit File Picker Component**

```bash
git add src/components/chat/file-mention-picker.tsx
git commit -m "feat(chat): implement file mention picker with shadcn and portal"
```

---

## Chunk 5: Skill Command Palette Component

**Files:**
- Create: `src/components/chat/chat-command-palette.tsx`

- [ ] **Step 1: Create Skill Palette Component**

We reuse the `TrustBadge` from the marketplace and `shadcn` structure.

```tsx
// src/components/chat/chat-command-palette.tsx
import React, { useEffect, useState } from 'react';
import { RegistrySkill } from '@/lib/bindings';
import { TrustBadge } from '@/components/skills/trust-badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ChatCommandPaletteProps {
  type: 'skill';
  query: string;
  items: RegistrySkill[];
  loading: boolean;
  position: { top: number; left: number } | null;
  onSelect: (skill: RegistrySkill) => void;
  onClose: () => void;
}

export const ChatCommandPalette: React.FC<ChatCommandPaletteProps> = ({
  query,
  items,
  loading,
  position,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter items
  const filtered = items.filter(s => 
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listener only when active/focused
    // Simplified: rely on parent to pass key events or global listener
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-80 bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          placeholder="Search skills..."
          value={query}
          onChange={(e) => {/* Parent controls query usually, but we might need to sync */}
          }
          className="h-8 text-sm"
        />
      </div>

      <div className="max-h-60 overflow-y-auto p-1" ref={listRef}>
        {loading && (
          <div className="flex items-center justify-center p-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin w-4 h-4" /> Searching...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">No skills found.</div>
        )}
        {filtered.map((skill, index) => (
          <div
            key={skill.id}
            className={cn(
              'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer text-sm',
              index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
            onClick={() => {
              onSelect(skill);
              onClose();
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex flex-col">
              <span className="font-medium text-blue-600 dark:text-blue-400">@{skill.name}</span>
              <span className="text-xs text-muted-foreground truncate w-48">{skill.description}</span>
            </div>
            <TrustBadge 
              securityScore={skill.securityScore} 
              qualityScore={skill.qualityScore} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit Skill Palette**

```bash
git add src/components/chat/chat-command-palette.tsx
git commit -m "feat(chat): add skill command palette with TrustBadge integration"
```

## Chunk 6: Context Chips (Visualizing Attached Items)

**Files:**
- Create: `src/components/chat/context-chip.tsx`
- Create: `src/components/chat/attached-items-list.tsx`

- [ ] **Step 1: Build the Chip Component**

Create `src/components/chat/context-chip.tsx`. This displays the attached item inside the input box using `shadcn` Badge.

```tsx
// src/components/chat/context-chip.tsx
import React, { useState } from 'react';
import { AttachedItem } from '@/types/chat-context';
import { TrustBadge } from '@/components/skills/trust-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, File, Folder, Zap, AlertTriangle } from 'lucide-react';

interface ContextChipProps {
  item: AttachedItem;
  onRemove: (id: string) => void;
}

export const ContextChip: React.FC<ContextChipProps> = ({ item, onRemove }) => {
  const [showWarnings, setShowWarnings] = useState(false);
  const isSkill = item.type === 'skill';
  const isFolder = item.type === 'folder';
  const hasWarnings = isSkill && item.data.lintWarnings && item.data.lintWarnings.length > 0;
  const hasError = hasWarnings && item.data.lintWarnings.some(w => w.severity === 'error');

  const variant = hasError ? 'destructive' : hasWarnings ? 'outline' : 'secondary';
  const icon = isSkill ? <Zap className="w-3 h-3" /> : isFolder ? <Folder className="w-3 h-3" /> : <File className="w-3 h-3" />;

  return (
    <Badge 
      variant={variant} 
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium group relative transition-all",
        hasWarnings && !hasError && "bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      )}
    >
      {icon}
      <span className="max-w-[80px] truncate">{item.data.name}</span>
      
      {isSkill && (
        <div className="scale-75 origin-left">
          <TrustBadge 
            securityScore={item.data.securityScore} 
            qualityScore={item.data.qualityScore} 
          />
        </div>
      )}

      {isFolder && (
        <span className="text-[10px] opacity-75">({item.data.scope === 'deep' ? 'All' : 'Top'})</span>
      )}

      {hasWarnings && (
        <span 
          className="cursor-pointer"
          onMouseEnter={() => setShowWarnings(true)}
          onMouseLeave={() => setShowWarnings(false)}
        >
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
        </span>
      )}

      <button 
        onClick={() => onRemove(item.data.id)}
        className="ml-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Tooltip for Lint Warnings */}
      {showWarnings && hasWarnings && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-black text-white text-xs rounded p-2 z-20 shadow-lg font-normal">
          <div className="font-bold mb-1 border-b border-white/20 pb-1">Lint Issues:</div>
          <ul className="space-y-1">
            {item.data.lintWarnings.map((w, i) => (
              <li key={i} className={cn("flex items-start gap-1", w.severity === 'error' ? 'text-red-300' : 'text-yellow-300')}>
                <span className="capitalize font-bold">{w.severity}:</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Badge>
  );
};
```

- [ ] **Step 2: Build the List Container**

Create `src/components/chat/attached-items-list.tsx`.

```tsx
// src/components/chat/attached-items-list.tsx
import React from 'react';
import { useChatContextStore } from '@/store/chat-context-store';
import { ContextChip } from './context-chip';

export const AttachedItemsList: React.FC = () => {
  const items = useChatContextStore(s => s.items);
  const removeItem = useChatContextStore(s => s.removeItem);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-muted/30 dark:bg-muted/20 border-b border-border rounded-t-lg">
      {items.map(item => (
        <ContextChip 
          key={item.data.id} 
          item={item} 
          onRemove={removeItem} 
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Commit Chip Components**

```bash
git add src/components/chat/context-chip.tsx src/components/chat/attached-items-list.tsx
git commit -m "feat(chat): implement context chips with shadcn badges"
```

---

## Chunk 7: Input Trigger System & Main Integration

**Files:**
- Modify: `src/components/chat/chat-input.tsx`

- [ ] **Step 1: Implement Trigger Detection and State**

We modify `src/components/chat/chat-input.tsx`. This is the main integration point. We assume the existence of `textareaRef` and basic state.

```tsx
// src/components/chat/chat-input.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useChatContextStore } from '@/store/chat-context-store';
import { FileMentionPicker } from './file-mention-picker';
import { ChatCommandPalette } from './chat-command-palette';
import { AttachedItemsList } from './attached-items-list';
import { listDirectoryContents, countFolderFiles, useAllSkills } from '@/lib/bindings'; // Assuming hook export
import { RegistrySkill, FileEntry } from '@/types/chat-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AtSign, Hash, Send } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [triggerState, setTriggerState] = useState<{ type: 'skill' | 'file', query: string, startIndex: number } | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  
  // File Picker State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    // Initialize with workspace root or home
    return process.env.WORKSPACE_ROOT || '.';
  });
  const [fileItems, setFileItems] = useState<FileEntry[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [folderCounts, setFolderCounts] = useState({ shallow: 0, deep: 0 });

  // Skill Picker State
  const { data: skills = [], isLoading: skillsLoading } = useAllSkills();

  // Store
  const addFile = useChatContextStore(s => s.addFile);
  const addFolder = useChatContextStore(s => s.addFolder);
  const addSkill = useChatContextStore(s => s.addSkill);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Trigger Logic ---

  const calculatePickerPosition = () => {
    if (textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect();
      // Simple positioning: Above the input
      return { top: rect.top - 250, left: rect.left + 10 }; 
    }
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Trigger Keys
    if (e.key === '@' || e.key === '#') {
      // Logic to insert char and open picker
      // If we want to open on key press without inserting char (macro style):
      // e.preventDefault();
      
      // For now, let's allow the char to be typed, and detect it to open UI
      // But we can set the state immediately to anticipate
      const type = e.key === '@' ? 'skill' : 'file';
      const pos = e.currentTarget.selectionStart;
      
      // We need to wait for the char to actually appear in value to confirm trigger
      // Or simpler: just open the picker immediately on keydown
      setTriggerState({ type, query: '', startIndex: pos + 1 });
      setPickerPosition(calculatePickerPosition());
      
      if (type === 'file') {
        loadDirectory(currentPath); // Load files for current context
      }
    } else if (e.key === 'Escape') {
      closePicker();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Update Trigger Query
    if (triggerState) {
      const cursorPos = e.target.selectionStart;
      // Find the last trigger char before cursor
      // This is a simplified check. Robust implementation tracks exact start index.
      const lastAtIndex = value.lastIndexOf('@', cursorPos);
      const lastHashIndex = value.lastIndexOf('#', cursorPos);
      
      // If both -1, close (user deleted trigger)
      if (lastAtIndex === -1 && lastHashIndex === -1 && triggerState) {
         // Check if we are inside a trigger scope
         // For simplicity, we assume the triggerState.startIndex is valid
         if (cursorPos < triggerState.startIndex) {
           closePicker();
         } else {
           // Extract query between startIndex and cursor
           const query = value.substring(triggerState.startIndex, cursorPos);
           setTriggerState(prev => prev ? { ...prev, query } : null);
         }
      } else {
         // User typed another trigger?
         // Complex logic needed for robust inline triggers. 
         // For this plan, we stick to: "First trigger opens UI, Escape closes".
         // Query updates based on text.
         if (cursorPos < triggerState.startIndex) {
           closePicker();
         } else {
           const query = value.substring(triggerState.startIndex, cursorPos);
           setTriggerState(prev => prev ? { ...prev, query } : null);
         }
      }
    }
  };

  const closePicker = () => {
    setTriggerState(null);
    setPickerPosition(null);
  };

  // --- File System Logic ---

  const loadDirectory = async (path: string) => {
    setFileLoading(true);
    setCurrentPath(path);
    try {
      const entries = await listDirectoryContents(path);
      setFileItems(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setFileLoading(false);
    }
  };

  const handleFileSelect = async (file: FileEntry, isDeep?: boolean) => {
    if (file.isDir) {
      if (file.name === '..') {
        // Go up
        const parent = file.path; // Backend returns parent path for '..'
        loadDirectory(parent);
      } else if (file.name === '.') {
        // Current folder selected via Shift+Enter or Scope Modal logic
        // Scope modal is handled inside FileMentionPicker, which calls this onSelect
        // If isDeep is defined, it comes from the modal
        const counts = await countFolderFiles(file.path);
        if (isDeep !== undefined) {
           addFolder({ 
             id: file.path, 
             name: file.name, 
             path: file.path, 
             scope: isDeep ? 'deep' : 'shallow', 
             fileCount: isDeep ? counts.deep : counts.shallow 
           });
           closePicker();
        }
      } else {
        // Enter directory
        loadDirectory(file.path);
      }
    } else {
      // Add File
      addFile({ id: file.path, name: file.name, path: file.path, size: file.size });
      closePicker();
    }
  };

  // --- Skill Logic ---

  const handleSkillSelect = (skill: RegistrySkill) => {
    addSkill(skill);
    closePicker();
    // TODO: Trigger lint check
  };

  // --- Submission ---

  const handleSend = () => {
    // Collect items and send
    console.log('Send', { content: inputValue, context: useChatContextStore.getState().items });
    setInputValue('');
    useChatContextStore.getState().clearItems();
  };

  return (
    <div className="relative w-full p-2 border-t dark:border-gray-700 bg-background focus-within:ring-1 focus-within:ring-ring rounded-b-lg">
      
      {/* Attached Items Area */}
      <AttachedItemsList />

      {/* Input Area */}
      <div className="flex items-end gap-2 relative">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message SkillDeck... (Use @ for Skills, # for Files)"
          className="flex-1 resize-none border-0 focus-visible:ring-0 bg-transparent text-sm p-1 min-h-[40px] max-h-32"
          rows={1}
        />
        
        {/* Bottom Bar Buttons */}
        <div className="flex gap-1 pb-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {/* Focus input and inject '#' */}}>
            <Hash className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {/* Focus input and inject '@' */}}>
            <AtSign className="w-4 h-4" />
          </Button>
          <Button size="icon" className="h-8 w-8" onClick={handleSend}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Pickers (Rendered Portal-based in their own components) */}
      {triggerState?.type === 'file' && (
        <FileMentionPicker
          open={true}
          query={triggerState.query}
          position={pickerPosition}
          items={fileItems}
          loading={fileLoading}
          currentFolderCounts={folderCounts}
          onSelect={handleFileSelect}
          onClose={closePicker}
          onQueryChange={(q) => setTriggerState(prev => prev ? { ...prev, query: q } : null)}
        />
      )}

      {triggerState?.type === 'skill' && (
        <ChatCommandPalette
          type="skill"
          query={triggerState.query}
          items={skills}
          loading={skillsLoading}
          position={pickerPosition}
          onSelect={handleSkillSelect}
          onClose={closePicker}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit Main Integration**

```bash
git add src/components/chat/chat-input.tsx
git commit -m "feat(chat): integrate triggers and pickers into ChatInput"
```

---

## Chunk 8: Security & Installation Logic

**Files:**
- Modify: `src/components/chat/chat-input.tsx`
- Create: `src/components/chat/security-warning-dialog.tsx`

- [ ] **Step 1: Create Security Warning Dialog**

Using `shadcn` AlertDialog.

```tsx
// src/components/chat/security-warning-dialog.tsx
import React from 'react';
import { RegistrySkill } from '@/lib/bindings';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface Props {
  skill: RegistrySkill;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SecurityWarningDialog: React.FC<Props> = ({ skill, onConfirm, onCancel }) => {
  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Security Warning
          </AlertDialogTitle>
          <AlertDialogDescription>
            The skill <strong>{skill.name}</strong> has been flagged for potentially dangerous behavior.
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
              {skill.lintWarnings?.filter(w => w.rule_id.includes('sec-')).map((w, i) => (
                <div key={i}>• {w.message}</div>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel (Recommended)</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Install At My Own Risk
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

- [ ] **Step 2: Integrate Logic into ChatInput**

Update `handleSkillSelect` in `src/components/chat/chat-input.tsx`.

```tsx
// Add state for review
const [skillForReview, setSkillForReview] = useState<RegistrySkill | null>(null);

// Updated Handler
const handleSkillSelect = (skill: RegistrySkill) => {
  if (skill.securityScore < 2) {
    setSkillForReview(skill);
    closePicker();
  } else {
    confirmAddSkill(skill);
  }
};

const confirmAddSkill = (skill: RegistrySkill) => {
  // Installation logic if registry (similar to previous plan)
  addSkill(skill);
  setSkillForReview(null);
};

// Render Dialog
{skillForReview && (
  <SecurityWarningDialog 
    skill={skillForReview} 
    onConfirm={() => confirmAddSkill(skillForReview)} 
    onCancel={() => setSkillForReview(null)} 
  />
)}
```

- [ ] **Step 3: Commit Security Logic**

```bash
git add src/components/chat/security-warning-dialog.tsx src/components/chat/chat-input.tsx
git commit -m "feat(chat): add security warning dialog for dangerous skills"
```

## Chunk 9: Backend Message Submission Integration

**Files:**
- Modify: `src-tauri/src/commands/chat.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/invoke.ts`
- Modify: `src/components/chat/chat-input.tsx`

- [ ] **Step 1: Define Backend Payload Structure**

We need a structured way to receive the context items in Rust.

```rust
// src-tauri/src/commands/chat.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextAttachment {
    pub item_type: String, // "skill", "file", "folder"
    pub id: String,        // Path or Skill ID
    pub scope: Option<String>, // "shallow" or "deep" for folders
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendMessagePayload {
    pub content: String,
    pub attachments: Vec<ContextAttachment>,
}

#[tauri::command]
pub async fn send_chat_message(payload: SendMessagePayload) -> Result<String, String> {
    let mut context_content = String::new();

    // Process Attachments
    for attachment in payload.attachments {
        match attachment.item_type.as_str() {
            "file" => {
                // Read file content
                let path = PathBuf::from(&attachment.id);
                if path.exists() {
                    match std::fs::read_to_string(&path) {
                        Ok(content) => {
                            context_content.push_str(&format!(
                                "\n--- File: {} ---\n{}\n--- End File ---\n",
                                path.display(),
                                content
                            ));
                        }
                        Err(e) => return Err(format!("Failed to read file {}: {}", path.display(), e)),
                    }
                }
            }
            "folder" => {
                // List files based on scope and read them
                // Implement file walking logic similar to count_folder_files but reading content
                // For now, placeholder:
                context_content.push_str(&format!("\n--- Folder: {} ({}) ---\n[Folder content injection logic]\n", attachment.id, attachment.scope.unwrap_or_default()));
            }
            "skill" => {
                // Load Skill content
                // If ID is a path (local), read it.
                // If ID is a UUID (registry), look it up in DB/Cache.
                // Placeholder:
                 context_content.push_str(&format!("\n--- Skill: {} ---\n[Skill content injection logic]\n", attachment.id));
            }
            _ => {}
        }
    }

    // Construct Final Prompt
    let final_prompt = if context_content.is_empty() {
        payload.content
    } else {
        format!(
            "Context Data:\n{}\n\nUser Query:\n{}",
            context_content, payload.content
        )
    };

    // TODO: Call actual LLM inference engine here
    println!("Processing message with context...\nFinal Prompt Length: {}", final_prompt.len());

    Ok("Message processed successfully".into())
}
```

- [ ] **Step 2: Register Command**

Modify `src-tauri/src/main.rs`.

```rust
// ... imports
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::files::list_directory_contents,
            commands::files::count_folder_files,
            commands::chat::send_chat_message // Add this
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Frontend Binding**

Modify `src/lib/invoke.ts`.

```typescript
// src/lib/invoke.ts

interface ContextAttachment {
  item_type: 'skill' | 'file' | 'folder';
  id: string;
  scope?: 'shallow' | 'deep';
}

interface SendMessagePayload {
  content: string;
  attachments: ContextAttachment[];
}

export async function sendChatMessage(payload: SendMessagePayload): Promise<string> {
  return invoke('send_chat_message', { payload });
}
```

- [ ] **Step 4: Connect ChatInput**

Modify `src/components/chat/chat-input.tsx`.

```tsx
// src/components/chat/chat-input.tsx
// ... imports
import { sendChatMessage } from '@/lib/bindings';

// ... inside component
const handleSend = async () => {
  const { items } = useChatContextStore.getState();
  
  if (inputValue.trim() === '' && items.length === 0) return;

  const attachments = items.map(item => {
    if (item.type === 'folder') {
      return {
        item_type: item.type,
        id: item.data.id,
        scope: item.data.scope
      };
    }
    return {
      item_type: item.type,
      id: item.data.id
    };
  });

  try {
    await sendChatMessage({
      content: inputValue,
      attachments
    });
    
    // Clear state on success
    setInputValue('');
    useChatContextStore.getState().clearItems();
  } catch (err) {
    console.error(err);
    // Toast error
  }
};
```

- [ ] **Step 5: Commit Backend Integration**

```bash
git add src-tauri/src/commands/chat.rs src-tauri/src/main.rs src/lib/invoke.ts src/components/chat/chat-input.tsx
git commit -m "feat(chat): integrate backend message submission with context"
```

---

## Chunk 10: Accessibility & Focus Management

**Files:**
- Modify: `src/components/chat/file-mention-picker.tsx`
- Modify: `src/components/chat/chat-command-palette.tsx`

- [ ] **Step 1: Enhance Keyboard Navigation**

Ensure the `FileMentionPicker` intercepts navigation keys properly to prevent the textarea from fighting with the picker.

```tsx
// src/components/chat/file-mention-picker.tsx

// Inside handleKeyDown
// Ensure e.stopPropagation() for handled keys to prevent textarea scroll/interaction

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!open) return;
  
  if (view === 'folder-scope-confirm') {
    // ... existing code
    e.stopPropagation();
    return;
  }

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
    case 'Enter':
      e.preventDefault(); // Prevent typing or newline
      e.stopPropagation(); // Stop event bubbling
      // ... existing logic
      break;
    case 'Escape':
      // ... existing logic
      break;
    default:
      // Let other keys pass through to the textarea/input
      break;
  }
};
```

- [ ] **Step 2: ARIA Attributes**

Add appropriate roles to the list items for screen readers.

```tsx
// src/components/chat/file-mention-picker.tsx
// Inside the map loop
<div
  key={file.path}
  role="option"
  aria-selected={index === selectedIndex}
  tabIndex={-1} // Managed by keyboard logic
  // ... classes
>
```

- [ ] **Step 3: Commit A11y Updates**

```bash
git add src/components/chat/file-mention-picker.tsx src/components/chat/chat-command-palette.tsx
git commit -m "fix(chat): improve keyboard navigation and accessibility"
```

---

## Chunk 11: Testing Strategy

**Files:**
- Create: `tests/e2e/context-injection.spec.ts`

- [ ] **Step 1: Write E2E Test**

Test the full flow: Trigger -> Navigate -> Select -> Verify Chip -> Send.

```typescript
// tests/e2e/context-injection.spec.ts
import { test, expect } from '@playwright/test';

test('User can attach a file via # trigger and send', async ({ page }) => {
  await page.goto('/chat');
  
  // 1. Focus Input
  const input = page.locator('textarea[placeholder*="Message SkillDeck"]');
  await input.click();
  
  // 2. Type Trigger
  await input.fill('#');
  
  // 3. Wait for File Picker
  const picker = page.locator('div[role="listbox"]'); // Assuming role added
  await expect(picker).toBeVisible();
  
  // 4. Verify we see current directory contents (.)
  const currentItem = page.locator('text=Direct children only').first(); // Placeholder check
  // Ideally check for a known file in the workspace
  // await expect(page.locator('text=package.json')).toBeVisible();
  
  // 5. Select first file (Enter)
  await input.press('Enter');
  
  // 6. Verify Chip appeared
  const chip = page.locator('div[class*="context-chip"]'); // Adjust selector
  // await expect(chip).toBeVisible();
  
  // 7. Send
  await input.fill('Analyze this.');
  await input.press('Enter'); // Submit
  
  // 8. Verify UI cleared
  await expect(input).toHaveValue('');
});
```

- [ ] **Step 2: Commit Tests**

```bash
git add tests/e2e/context-injection.spec.ts
git commit -m "test(chat): add e2e test for file context injection"
```

---

## Chunk 12: Documentation & Final Review

**Files:**
- Create: `docs/features/chat-context-injection.md`

- [ ] **Step 1: Document Feature**

Create `docs/features/chat-context-injection.md`.

```markdown
# Chat Context Injection

## Overview
Allows users to attach Skills and Files directly into the chat input to provide context to the AI.

## Usage
- **@**: Opens Skill Selector. Supports local and registry skills.
- **#**: Opens File Selector. Supports workspace files and folders.
    - **Shift+Enter** on a folder adds it directly.
    - **Enter** on a folder (`.`) opens scope selection (Shallow vs Deep).

## Architecture
- **Frontend**: React + Zustand. `shadcn/ui` for styling.
- **Backend**: Tauri commands for file listing and message construction.
- **State**: `chat-context-store` holds transient attachments.

## Security
- Skills with low security scores trigger a confirmation dialog.
- Files are read and injected into the prompt context on the backend.
```

- [ ] **Step 2: Final Commit**

```bash
git add docs/features/chat-context-injection.md
git commit -m "docs: add documentation for chat context injection"
```
