I'm using the writing-plans skill to create the implementation plan.

# Unified Skill Marketplace Plan (Virtualized)

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Skills Tab into a high-performance, unified marketplace that merges local and registry skills. Use TanStack Virtual to ensure the UI remains responsive even with thousands of skills.

**Architecture:** Hybrid Data Fetching. The client independently fetches Local (Tauri Command) and Registry (Platform Proxy) data. A React hook merges these streams into a `UnifiedSkill[]` array based on matching `name` and `content_hash`. The UI renders this array using a virtualized grid.

**Tech Stack:** Rust (Tauri, Reqwest), React, TypeScript, TanStack Query, TanStack Virtual (`@tanstack/react-virtual`).

---

## Chunk 1: Backend - Platform Proxy & Data Fetching

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/commands/platform.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (assuming standard Tauri 2.0 structure)

- [ ] **Step 1: Add Dependencies**

Modify `src-tauri/Cargo.toml` to include `reqwest` for fetching from the platform.

```toml
# src-tauri/Cargo.toml

[dependencies]
# ... existing dependencies
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Define Registry Skill Struct**

Create `src-tauri/src/commands/platform.rs`. We define the shape of a remote skill here.

```rust
// src-tauri/src/commands/platform.rs
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: Option<String>,
    pub version: String,
    pub tags: Vec<String>,
    pub content_hash: String,
}

#[command]
pub async fn fetch_registry_skills() -> Result<Vec<RegistrySkill>, String> {
    // TODO: Move this URL to a configuration file later
    let url = "http://localhost:3000/api/v1/skills";
    
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Platform returned status: {}", response.status()));
    }

    let skills = response
        .json::<Vec<RegistrySkill>>()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(skills)
}
```

- [ ] **Step 3: Register Module and Command**

Modify `src-tauri/src/commands/mod.rs` to expose the new module.

```rust
// src-tauri/src/commands/mod.rs
pub mod platform;
// ... other modules
```

Modify `src-tauri/src/lib.rs` (or `main.rs` if using older structure) to register the command in the invoke handler.

```rust
// src-tauri/src/lib.rs
// Inside the invoke_handler! macro
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::platform::fetch_registry_skills
])
```

- [ ] **Step 4: Generate Bindings**

Since you use auto-generated bindings, run the generation script (often `pnpm tauri dev` or a specific `cargo test` script depending on your setup) to update the TypeScript definitions.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/platform.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(backend): add platform proxy command for registry skills"
```

---

## Chunk 2: Frontend Types & Merged Data Hook

**Files:**
- Modify: `src/types/skills.ts` (or equivalent types file)
- Create: `src/hooks/use-unified-skills.ts`

- [ ] **Step 1: Define Unified Types**

Modify `src/types/skills.ts`. We need interfaces that represent both the local and remote state.

```typescript
// src/types/skills.ts

// Matches Rust struct in platform.rs
export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  tags: string[];
  content_hash: string;
}

// Assuming this exists or matches your local skill structure
export interface LocalSkill {
  name: string;
  path: string;
  description?: string;
  content_hash?: string; // Ensure this exists for comparison
}

// The combined view for the UI
export type SkillStatus = 'installed' | 'available' | 'update_available' | 'local_only';

export interface UnifiedSkill {
  id: string;
  name: string;
  description: string;
  status: SkillStatus;
  localData?: LocalSkill;
  registryData?: RegistrySkill;
}
```

- [ ] **Step 2: Create Unified Hook**

Create `src/hooks/use-unified-skills.ts`. This handles the logic of merging the two data sources.

```typescript
// src/hooks/use-unified-skills.ts
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import type { LocalSkill, RegistrySkill, UnifiedSkill } from '@/types/skills';
import { useMemo } from 'react';

// Hook for local skills (ensure command name matches your backend)
function useLocalSkills() {
  return useQuery<LocalSkill[]>({
    queryKey: ['local_skills'],
    queryFn: () => invoke('list_skills'), 
  });
}

// Hook for registry skills
function useRegistrySkills() {
  return useQuery<RegistrySkill[]>({
    queryKey: ['registry_skills'],
    queryFn: () => invoke('fetch_registry_skills'),
    // Don't retry automatically on failure to avoid spamming logs if offline
    retry: false, 
  });
}

export function useUnifiedSkills() {
  const { data: localSkills = [], isLoading: loadingLocal } = useLocalSkills();
  const { data: registrySkills = [], isLoading: loadingRegistry } = useRegistrySkills();

  const isLoading = loadingLocal || loadingRegistry;

  const unifiedSkills = useMemo(() => {
    const map = new Map<string, UnifiedSkill>();

    // 1. Populate Registry Skills (Base Layer)
    registrySkills.forEach((reg) => {
      map.set(reg.name, {
        id: reg.id,
        name: reg.name,
        description: reg.description,
        status: 'available',
        registryData: reg,
      });
    });

    // 2. Overlay Local Skills (Override Layer)
    localSkills.forEach((local) => {
      const existing = map.get(local.name);

      if (existing) {
        // Skill exists in both: Check for updates
        const isDifferent = local.content_hash && existing.registryData?.content_hash !== local.content_hash;
        
        map.set(local.name, {
          ...existing,
          status: isDifferent ? 'update_available' : 'installed',
          localData: local,
        });
      } else {
        // Skill only exists locally
        map.set(local.name, {
          id: local.name, // Use name as ID for local-only
          name: local.name,
          description: local.description || 'Local skill (not in registry)',
          status: 'local_only',
          localData: local,
        });
      }
    });

    // Convert map to array and sort: Installed first, then Alphabetical
    return Array.from(map.values()).sort((a, b) => {
      const statusOrder = (s: SkillStatus) => {
        if (s === 'installed' || s === 'local_only') return 0;
        if (s === 'update_available') return 1;
        return 2;
      };
      
      if (statusOrder(a.status) !== statusOrder(b.status)) {
        return statusOrder(a.status) - statusOrder(b.status);
      }
      return a.name.localeCompare(b.name);
    });

  }, [localSkills, registrySkills]);

  return { unifiedSkills, isLoading };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/skills.ts src/hooks/use-unified-skills.ts
git commit -m "feat(data): add unified skills hook with merge logic"
```

---

## Chunk 3: Virtualized UI - List & Cards

**Files:**
- Run: `pnpm add @tanstack/react-virtual`
- Create: `src/components/skills/unified-skill-list.tsx`
- Create: `src/components/skills/unified-skill-card.tsx`

- [ ] **Step 1: Install Virtual Dependency**

```bash
pnpm add @tanstack/react-virtual
```

- [ ] **Step 2: Create Unified Skill Card**

Create `src/components/skills/unified-skill-card.tsx`. This is a presentational component.

```tsx
// src/components/skills/unified-skill-card.tsx
import React from 'react';
import type { UnifiedSkill } from '@/types/skills';
import { Badge } from '@/components/ui/badge'; // Assuming shadcn
import { clsx } from 'clsx'; // or tailwind-merge

interface Props {
  skill: UnifiedSkill;
  onClick: (skill: UnifiedSkill) => void;
}

export function UnifiedSkillCard({ skill, onClick }: Props) {
  const statusStyles = {
    installed: 'border-green-500 bg-green-50 dark:bg-green-950',
    local_only: 'border-green-500 bg-green-50 dark:bg-green-950',
    available: 'border-border bg-card',
    update_available: 'border-orange-500 bg-orange-50 dark:bg-orange-950',
  };

  const badgeVariant = {
    installed: 'default',
    local_only: 'secondary',
    available: 'outline',
    update_available: 'destructive',
  } as const;

  return (
    <div
      className={clsx(
        'p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md h-full flex flex-col',
        statusStyles[skill.status]
      )}
      onClick={() => onClick(skill)}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg truncate pr-2">{skill.name}</h3>
        <Badge variant={badgeVariant[skill.status]}>
          {skill.status === 'local_only' ? 'Installed' : skill.status.replace('_', ' ')}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
        {skill.description}
      </p>

      <div className="mt-4 pt-2 border-t border-dashed flex justify-between text-xs text-muted-foreground">
        <span>{skill.registryData?.author || 'Local'}</span>
        {skill.registryData?.tags?.[0] && (
          <span className="bg-secondary px-1.5 py-0.5 rounded">{skill.registryData.tags[0]}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Virtualized List**

Create `src/components/skills/unified-skill-list.tsx`. This handles the performance optimization.

```tsx
// src/components/skills/unified-skill-list.tsx
import React, { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useUnifiedSkills } from '@/hooks/use-unified-skills';
import { UnifiedSkillCard } from './unified-skill-card';
import { SkillDetailPanel } from './skill-detail-panel'; // Created next
import type { UnifiedSkill } from '@/types/skills';

export function UnifiedSkillList() {
  const { unifiedSkills, isLoading } = useUnifiedSkills();
  const [selectedSkill, setSelectedSkill] = useState<UnifiedSkill | null>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer configured for a 3-column grid
  const columnCount = 3;
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(unifiedSkills.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160, // Estimated row height in px
    overscan: 5,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading Skill Marketplace...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Main List Area */}
      <div ref={parentRef} className="flex-1 h-full overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Skill Marketplace</h1>
          <p className="text-muted-foreground">
            {unifiedSkills.filter(s => s.status === 'installed' || s.status === 'local_only').length} Installed · {unifiedSkills.length} Total
          </p>
        </div>

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columnCount;
            const rowItems = unifiedSkills.slice(startIndex, startIndex + columnCount);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                  gap: '1rem',
                  paddingLeft: '0.25rem',
                  paddingRight: '0.25rem',
                }}
              >
                {rowItems.map((skill) => (
                  <div key={skill.id} className="flex-1">
                    <UnifiedSkillCard skill={skill} onClick={setSelectedSkill} />
                  </div>
                ))}
                {/* Spacer elements if row is not full */}
                {rowItems.length < columnCount &&
                  Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex-1" />
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedSkill && (
        <SkillDetailPanel 
          skill={selectedSkill} 
          onClose={() => setSelectedSkill(null)} 
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/skills/unified-skill-list.tsx src/components/skills/unified-skill-card.tsx
git commit -m "feat(ui): implement virtualized skill list with cards"
```

---

## Chunk 4: UI Components - Detail Panel

**Files:**
- Create: `src/components/skills/skill-detail-panel.tsx`

- [ ] **Step 1: Create Detail Panel**

Create `src/components/skills/skill-detail-panel.tsx`. This component allows the user to install/uninstall.

```tsx
// src/components/skills/skill-detail-panel.tsx
import React from 'react';
import type { UnifiedSkill } from '@/types/skills';
import { Button } from '@/components/ui/button';
import { X, Download, Trash2, ExternalLink } from 'lucide-react';

interface Props {
  skill: UnifiedSkill;
  onClose: () => void;
}

export function SkillDetailPanel({ skill, onClose }: Props) {
  const isInstalled = skill.status === 'installed' || skill.status === 'local_only';
  const canInstall = skill.registryData && !isInstalled;

  return (
    <div className="w-96 border-l bg-background flex flex-col h-full shadow-lg z-50">
      {/* Header */}
      <div className="p-6 border-b flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{skill.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{skill.status.replace('_', ' ')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Description</h3>
          <p className="text-sm leading-relaxed">{skill.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Author</span>
            <p className="font-medium">{skill.registryData?.author || 'Local'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Version</span>
            <p className="font-medium">{skill.registryData?.version || 'N/A'}</p>
          </div>
        </div>

        {skill.registryData?.tags && skill.registryData.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {skill.registryData.tags.map(tag => (
                <span key={tag} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {skill.localData && (
           <div>
             <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Local Path</h3>
             <code className="block p-2 bg-muted rounded text-xs break-all">{skill.localData.path}</code>
           </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t space-y-2">
        {canInstall && (
          <Button className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Install Skill
          </Button>
        )}
        
        {isInstalled && (
          <>
            <Button variant="outline" className="w-full" onClick={() => console.log("Open folder logic")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Folder
            </Button>
            <Button variant="destructive" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Uninstall
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/skill-detail-panel.tsx
git commit -m "feat(ui): add skill detail panel for installation actions"
```

---

## Chunk 5: Integration into Application

**Files:**
- Modify: `src/App.tsx` (or main router/layout file)

- [ ] **Step 1: Integrate View**

Locate the Skills Tab or route in your application (e.g., inside `src/App.tsx` or a `Layout` component). Replace the existing skills list reference with `UnifiedSkillList`.

```tsx
// Example integration
import { UnifiedSkillList } from '@/components/skills/unified-skill-list';

// Inside your component/route definition
<Route path="/skills" element={<UnifiedSkillList />} />

// OR if using Tabs
<TabPanel value="skills">
  <UnifiedSkillList />
</TabPanel>
```

- [ ] **Step 2: Verify Functionality**

1.  Run `pnpm tauri dev`.
2.  Ensure the platform backend (Axum) is running or `fetch_registry_skills` handles errors gracefully.
3.  Navigate to Skills Tab.
4.  Verify you see a unified list (Local + Registry mocked data).
5.  Scroll the list to verify virtualization (lag-free).
6.  Click a skill to open the side panel.

- [ ] **Step 3: Final Commit**

```bash
git add src/App.tsx
git commit -m "feat(integration): activate unified skill marketplace view"
```
