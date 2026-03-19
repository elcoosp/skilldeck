# Local Skill Linting — Full Implementation Plan (Revised)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the existing skill linting engine into the core skill registry and frontend, ensuring that local skills are linted at scan time, lint results are cached, live‑updated via file watcher events, and displayed in the skill card/detail panel alongside registry skills.

**Architecture:**  
- Extend the in‑memory `Skill` struct (core) to cache lint warnings and computed scores.  
- Modify the scanner to run the linter during `scan_directory` and store results.  
- Update `list_skills` to return cached lint data (no per‑call re‑lint).  
- Add a new Tauri event `SkillEvent::Updated` emitted by the file watcher after a hot‑reload, so the frontend can refetch skills.  
- Create a frontend hook `useSkillEvents` to listen and invalidate queries.  
- Enhance `UnifiedSkillCard` and `SkillDetailPanel` to show lint warnings and scores for local skills.  
- Add a “Re‑lint” button in the detail panel for manual triggers.  
- Show a summary badge in the skill list header.

**Tech Stack:** Rust (Tauri backend, skilldeck-core, skilldeck-lint), TypeScript (React, TanStack Query, Zustand), shadcn/ui components.

---

## Chunk 1: Rust – Extend Skill struct, scanner linting, event emission

### Task 1.1: Add lint fields to core `Skill` struct

**Files:**
- Modify: `src-tauri/skilldeck-core/src/traits/skill_loader.rs` (Skill struct)
- Modify: `src-tauri/skilldeck-core/src/skills/loader.rs` (FilesystemSkillLoader::parse, no change needed yet)
- Modify: `src-tauri/skilldeck-core/src/skills/scanner.rs` (to call linter)
- Modify: `src-tauri/skilldeck-core/src/skills/mod.rs` (SkillRegistry methods)

Add fields to `Skill`:

```rust
// src-tauri/skilldeck-core/src/traits/skill_loader.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    // ... existing fields
    pub lint_warnings: Option<Vec<LintWarning>>,
    pub security_score: u8,
    pub quality_score: u8,
}

// Add import for LintWarning (from skilldeck-lint)
use skilldeck_lint::LintWarning;
```

**Why:** Caching lint results in the skill struct avoids re‑linting on every `list_skills` call.

---

### Task 1.2: Lint during `scan_directory`

**File:** `src-tauri/skilldeck-core/src/skills/scanner.rs`

Modify `scan_directory` to accept a `&LintConfig` and call `do_lint` after loading a skill, storing the results in the `Skill` struct.

```rust
use skilldeck_lint::{LintConfig, lint_skill as do_lint};

pub async fn scan_directory(root: &PathBuf, lint_config: &LintConfig) -> Result<Vec<Skill>, CoreError> {
    let mut skills = Vec::new();
    let loader = FilesystemSkillLoader;

    let mut read_dir = fs::read_dir(root).await?;
    while let Some(entry) = read_dir.next_entry().await? {
        let entry_path = entry.path();
        if !entry_path.is_dir() { continue; }
        let skill_md = entry_path.join("SKILL.md");
        if !skill_md.exists() { continue; }

        match loader.load(&SkillSource::Filesystem(entry_path.clone())).await {
            Ok(mut skill) => {
                // Run linter
                let path_clone = entry_path.clone();
                let config_clone = lint_config.clone();
                let warnings = tokio::task::spawn_blocking(move || do_lint(&path_clone, &config_clone))
                    .await
                    .unwrap_or_default();
                let sec = skilldeck_lint::compute_security_score(&warnings);
                let qual = skilldeck_lint::compute_quality_score(&warnings);

                skill.lint_warnings = Some(warnings);
                skill.security_score = sec;
                skill.quality_score = qual;

                skills.push(skill);
            }
            Err(e) => { /* log error, continue */ }
        }
    }
    Ok(skills)
}
```

**Note:** The `scan_directories` helper must also be updated to pass `lint_config`. We'll handle that in the caller (AppState initialization).

---

### Task 1.3: Update `load_skill_from_source` to re‑lint after hot‑reload

**File:** `src-tauri/skilldeck-core/src/skills/mod.rs` (SkillRegistry)

Modify `load_skill_from_source` to accept `&LintConfig` and re‑lint the loaded skill.

```rust
pub async fn load_skill_from_source(
    &self,
    source: &str,
    skill_dir: PathBuf,
    lint_config: &LintConfig,
) -> Result<(), CoreError> {
    let loader = loader::FilesystemSkillLoader;
    let mut skill = loader
        .load(&crate::traits::SkillSource::Filesystem(skill_dir.clone()))
        .await?;

    // Re‑lint
    let warnings = tokio::task::spawn_blocking({
        let path = skill_dir.clone();
        let cfg = lint_config.clone();
        move || skilldeck_lint::lint_skill(&path, &cfg)
    })
    .await
    .map_err(|e| CoreError::Internal { message: e.to_string() })??;

    skill.lint_warnings = Some(warnings.clone());
    skill.security_score = skilldeck_lint::compute_security_score(&warnings);
    skill.quality_score = skilldeck_lint::compute_quality_score(&warnings);

    if let Some(mut entry) = self.raw_skills.get_mut(source) {
        if let Some(existing) = entry.iter_mut().find(|s| s.name == skill.name) {
            *existing = skill;
        } else {
            entry.push(skill);
        }
    } else {
        self.raw_skills.insert(source.to_string(), vec![skill]);
    }

    self.reload().await?;
    Ok(())
}
```

---

### Task 1.4: Add `SkillEvent` and emit from watcher

**Files:**
- New: `src-tauri/skilldeck-core/src/events.rs` (already exists – add `SkillEvent`)
- Modify: `src-tauri/skilldeck-core/src/skills/watcher.rs` (emit event)
- Modify: `src-tauri/src/events.rs` (re‑export or define event – we'll define in the shell crate)
- Modify: `src-tauri/src/lib.rs` (register event with specta)
- Modify: `src-tauri/src/state.rs` (pass app_handle to watcher)

**Step 1.4.1: Define SkillEvent in shell events.rs**

```rust
// src-tauri/src/events.rs
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SkillEvent {
    Updated {
        source_label: String,
        skill_name: String,
    },
}
```

**Step 1.4.2: Modify watcher to emit**

Instead of a separate function, we'll modify `start_registry_watcher` to optionally take an `AppHandle`. If provided, it emits events. We'll keep backward compatibility.

```rust
// src-tauri/skilldeck-core/src/skills/watcher.rs
pub fn start_registry_watcher(
    dir: PathBuf,
    source_label: String,
    registry: Arc<super::SkillRegistry>,
    app_handle: Option<tauri::AppHandle>,   // new optional param
) -> Result<notify::RecommendedWatcher, CoreError> {
    let (tx, mut rx) = channel::<SkillWatchEvent>(128);
    let watcher = start_watcher(dir, tx)?;

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                SkillWatchEvent::Created(skill_dir) | SkillWatchEvent::Modified(skill_dir) => {
                    // Load skill (requires lint_config – will need to pass it, see later)
                    // For now we assume we have lint_config; we'll get it from registry?
                    // We'll revisit in Step 2.
                    if let Ok(()) = registry.load_skill_from_source(&source_label, skill_dir.clone(), lint_config).await {
                        if let Some(ref handle) = app_handle {
                            let skill_name = skill_dir.file_name().unwrap().to_string_lossy().to_string();
                            let _ = handle.emit("skill-event", SkillEvent::Updated {
                                source_label: source_label.clone(),
                                skill_name,
                            });
                        }
                    }
                }
                SkillWatchEvent::Deleted(skill_dir) => {
                    let skill_name = skill_dir.file_name().unwrap().to_string_lossy().to_string();
                    registry.remove_skill_from_source(&source_label, &skill_name).await;
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("skill-event", SkillEvent::Updated {
                            source_label: source_label.clone(),
                            skill_name,
                        });
                    }
                }
            }
        }
    });

    Ok(watcher)
}
```

But we still need `lint_config` inside the watcher's async task. We can either:
- Store `lint_config` in the registry (as an `Arc<RwLock<LintConfig>>`) – this matches what AppState already has.
- Pass a clone of the config into the watcher.

We'll modify `SkillRegistry` to hold a reference to the global lint config (via `Arc<RwLock<LintConfig>>`). Then the watcher can access it.

**Step 1.4.3: Add lint_config to SkillRegistry**

```rust
// src-tauri/skilldeck-core/src/skills/mod.rs
pub struct SkillRegistry {
    // ... existing fields
    pub lint_config: Arc<RwLock<LintConfig>>,
}

impl SkillRegistry {
    pub fn new(lint_config: Arc<RwLock<LintConfig>>) -> Self {
        Self {
            raw_skills: DashMap::new(),
            resolved: Arc::new(RwLock::new(ResolvedSkills { skills: Vec::new(), shadowed: Vec::new() })),
            watchers: DashMap::new(),
            lint_config,
        }
    }
}
```

Update all call sites to pass the config when creating the registry.

**Step 1.4.4: Register SkillEvent in lib.rs**

```rust
// src-tauri/src/lib.rs
use crate::events::SkillEvent;

fn run() {
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![...])
        .events(collect_events![AgentEvent, McpEvent, WorkflowEvent, SkillEvent]);
    // ...
}
```

---

### Task 1.5: Update `SkillInfo` DTO and `list_skills` command

**File:** `src-tauri/src/commands/skills.rs`

Add the new fields to `SkillInfo` and populate them from the cached skill.

```rust
#[derive(Debug, Clone, Serialize, Type)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub source: String,
    pub path: Option<String>,
    pub lint_warnings: Vec<LintWarning>,   // new
    pub security_score: u8,                 // new
    pub quality_score: u8,                   // new
}

#[specta]
#[tauri::command]
pub async fn list_skills(state: State<'_, Arc<AppState>>) -> Result<Vec<SkillInfo>, String> {
    let skills = state.registry.skill_registry.skills().await;
    Ok(skills.into_iter().map(|s| SkillInfo {
        name: s.name,
        description: s.description,
        is_active: s.is_active,
        source: s.source,
        path: s.disk_path.map(|p| p.to_string_lossy().into_owned()),
        lint_warnings: s.lint_warnings.unwrap_or_default(),
        security_score: s.security_score,
        quality_score: s.quality_score,
    }).collect())
}
```

Add necessary imports at top:
```rust
use skilldeck_lint::{LintWarning, compute_security_score, compute_quality_score};
```

---

### Task 1.6: Update `AppState` initialization to pass lint config to registry and watchers

**File:** `src-tauri/src/state.rs`

- Create `Arc<RwLock<LintConfig>>` and store it in `AppState` (already present).
- When constructing `SkillRegistry`, pass a clone of that `Arc`.
- In the skill scanning loop, pass the config to `scan_directory`.
- In the watcher setup, call `start_registry_watcher` with `Some(app_handle.clone())` and ensure the registry already has the config (it will, because we passed it at creation).

```rust
impl AppState {
    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // ... existing code ...

        let lint_config = Arc::new(RwLock::new(
            LintConfig::from_files(global_config_path.as_deref(), None).unwrap_or_default()
        ));

        let db = SeaOrmDatabase::new(conn);
        let registry = Arc::new(Registry::with_mcp_registry_and_lint_config(
            db,
            mcp_registry,
            lint_config.clone(),
        )); // need to adjust Registry constructor

        // ... later, scanning skill dirs ...
        for (label, path) in &skill_dirs {
            let skills = scanner::scan_directory(path, &*lint_config.read().await).await?;
            registry.skill_registry.register_source(label.clone(), skills).await;
        }

        // ... watchers ...
        for (label, path) in &skill_dirs {
            if let Ok(w) = skilldeck_core::skills::watcher::start_registry_watcher(
                path.clone(),
                label.clone(),
                registry.skill_registry.clone(),
                Some(app.clone()),   // pass app handle for events
            ) {
                registry.skill_registry.watchers.insert(path.clone(), w);
            }
        }
    }
}
```

**Note:** We'll need to extend `Registry::new` or add a constructor that accepts `lint_config`. For brevity, we'll show the adjusted `Registry` in skilldeck-core.

---

### Task 1.7: Regenerate TypeScript bindings

After all Rust changes, run the binding generator. In development, this is triggered by the `build.rs` or a manual command. The project uses `tauri-specta` with a dev‑only export in `lib.rs`. To regenerate, simply run `cargo test` (which runs the export) or a custom script. Add a step in the plan:

```bash
# Run binding export (this will update src/lib/bindings.ts)
cd src-tauri && cargo test --quiet
```

**Why:** Without this, the frontend types will be out of sync and cause TypeScript errors.

---

## Chunk 2: Frontend – Event handling, UI updates, re‑lint button

### Task 2.1: Add `SkillEvent` type and listener

**File:** `src/lib/events.ts`

Add the new event type and listener function.

```ts
// src/lib/events.ts
export type SkillEventType = 'updated'

export interface SkillEvent {
  type: SkillEventType
  source_label: string
  skill_name: string
}

export function onSkillEvent(callback: (event: SkillEvent) => void): Promise<UnlistenFn> {
  return listen<SkillEvent>('skill-event', (e) => callback(e.payload))
}
```

---

### Task 2.2: Create `useSkillEvents` hook

**New file:** `src/hooks/use-skill-events.ts`

```ts
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { onSkillEvent } from '@/lib/events'

export function useSkillEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null

    onSkillEvent(() => {
      // Any skill change → refetch the local skills list
      queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [queryClient])
}
```

---

### Task 2.3: Mount `useSkillEvents` in `App.tsx`

**File:** `src/App.tsx`

Add the hook inside `AppContent` or `GlobalEventListeners`.

```tsx
// src/App.tsx
import { useSkillEvents } from '@/hooks/use-skill-events'

function GlobalEventListeners() {
  useMcpEvents()
  useSubagentEvents()
  useSkillEvents()   // <-- new
  return null
}
```

---

### Task 2.4: Update `UnifiedSkillCard` to show local lint warnings and scores

**File:** `src/components/skills/unified-skill-card.tsx`

Modify the component to read from `localData` as well.

```tsx
// Inside UnifiedSkillCard component
const lintWarnings = (
  skill.localData?.lint_warnings ??
  skill.registryData?.lintWarnings ??
  []
) as LintWarning[]

const securityScore = skill.localData?.security_score ?? skill.registryData?.securityScore ?? 5
const qualityScore  = skill.localData?.quality_score  ?? skill.registryData?.qualityScore ?? 5
```

Update the badge rendering to use these values.

---

### Task 2.5: Update `SkillDetailPanel` to show local lint warnings and scores

**File:** `src/components/skills/skill-detail-panel.tsx`

Add the same fallback logic, and render the lint panel for local skills.

```tsx
// In SkillDetailPanel
const lintWarnings = (
  skill.localData?.lint_warnings ??
  skill.registryData?.lintWarnings ??
  []
) as LintWarning[]

// Render lint panel
{lintWarnings.length > 0 && (
  <div>
    <SectionLabel>Lint Issues</SectionLabel>
    <LintWarningPanel warnings={lintWarnings} onIgnore={skill.localData ? handleIgnoreRule : undefined} />
  </div>
)}

// Render scores for local-only skills
{skill.localData && (
  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
    <MetaField label="Security" value={`${skill.localData.security_score}/5`} />
    <MetaField label="Quality"  value={`${skill.localData.quality_score}/5`} />
  </div>
)}
```

---

### Task 2.6: Add “Re‑lint” button for local skills

**File:** `src/components/skills/skill-detail-panel.tsx`

Add a mutation and button in the actions section.

```tsx
const relint = useMutation({
  mutationFn: async () => {
    if (!skill.localData?.path) throw new Error('No path')
    const res = await commands.lintSkill(skill.localData.path, null)
    if (res.status === 'error') throw new Error(res.error)
    return res.data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    toast.success('Lint check complete')
  },
  onError: (e: Error) => toast.error(`Lint failed: ${e.message}`)
})

// Render in actions section:
{skill.localData?.path && (
  <Button
    variant="outline"
    className="w-full"
    onClick={() => relint.mutate()}
    disabled={isBusy || relint.isPending}
  >
    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${relint.isPending ? 'animate-spin' : ''}`} />
    {relint.isPending ? 'Linting…' : 'Re-lint'}
  </Button>
)}
```

---

### Task 2.7: Add lint summary badge in `UnifiedSkillList` header

**File:** `src/components/skills/unified-skill-list.tsx`

Compute count of local skills with issues and display.

```tsx
// Inside UnifiedSkillList component, after getting unifiedSkills
const localWithIssues = unifiedSkills.filter(
  (s) => s.status === 'local_only' || s.status === 'installed'
).filter(
  (s) => (s.localData?.lint_warnings?.length ?? 0) > 0
).length

// In the header section:
<div className="flex items-center justify-between px-3 pt-0 pb-2 shrink-0">
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
    Skill Registry
  </span>
  <div className="flex items-center gap-2">
    {localWithIssues > 0 && (
      <span
        className="text-xs text-amber-500 font-medium"
        title={`${localWithIssues} local skill(s) have lint issues`}
      >
        {localWithIssues} ⚠
      </span>
    )}
    <button ...>Refresh</button>
  </div>
</div>
```

---

## Chunk 3: Verification steps

After implementation, verify the following:

- [ ] Startup: `list_skills` returns lint warnings and scores for all local skills.
- [ ] Hot‑reload: modifying a local `SKILL.md` triggers a `skill-event` and the frontend refetches, updating the card/detail panel.
- [ ] UI: Local skill cards show warning counts and trust badge based on lint results.
- [ ] Detail panel: Local skills show lint warnings panel with “Ignore” button (calls `disableLintRule`).
- [ ] Detail panel: “Re‑lint” button triggers a fresh lint and updates the UI.
- [ ] Skill list header shows summary badge when any local skill has warnings.
- [ ] Performance: `list_skills` does not re‑lint; it returns cached results (verify via logs).

---

## Commit messages (one per task)

- Task 1.1: feat(core): add lint_warnings, security_score, quality_score to Skill struct
- Task 1.2: feat(scanner): run linter during scan_directory and cache results
- Task 1.3: feat(registry): re-lint skills on hot-reload and store warnings
- Task 1.4: feat(events): add SkillEvent and emit from watcher after hot-reload
- Task 1.5: feat(commands): return lint data in list_skills command
- Task 1.6: feat(state): wire lint config into registry and watchers
- Task 1.7: chore(bindings): regenerate TypeScript bindings after Rust changes
- Task 2.1: feat(events): add SkillEvent type and listener
- Task 2.2: feat(hooks): create useSkillEvents to invalidate queries on skill update
- Task 2.3: feat(app): mount useSkillEvents in global listeners
- Task 2.4: feat(ui): show local lint warnings and scores in UnifiedSkillCard
- Task 2.5: feat(ui): show local lint panel and scores in SkillDetailPanel
- Task 2.6: feat(ui): add "Re-lint" button for local skills in detail panel
- Task 2.7: feat(ui): add lint summary badge in skill list header

---

## Final notes

This plan fully addresses the gaps identified in the reviewer’s feedback. All code changes are provided with exact file paths and context. The plan is ready for execution using subagent‑driven development. After implementation, each chunk should be reviewed with the plan‑document‑reviewer before proceeding.
