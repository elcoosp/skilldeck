Let me dig deeper into the specific files mentioned before writing the plan.Now I have a complete picture. Let me write the implementation plan:Based on a thorough read of `scanner.rs`, `watcher.rs`, `state.rs`, `commands/skills.rs`, `use-unified-skills.ts`, `unified-skill-card.tsx`, `skill-detail-panel.tsx`, `events.rs`, and the lint lib — here is the implementation plan:

---

# Local Skill Linting — Full Implementation Plan

## The Actual Gap, Precisely

The linting engine is complete and performant. The Tauri commands `lint_skill` and `lint_all_local_sources` are registered and working. The UI components (`LintWarningPanel`, `TrustBadge`) exist. The only missing pieces are:

1. **`SkillInfo` has no `lint_warnings` field** — the struct returned by `list_skills` never carries warnings
2. **Scanner doesn't lint** — `scan_directory` loads skills but doesn't call `do_lint`
3. **Hot-reload doesn't re-lint** — `start_registry_watcher` reloads but doesn't update lint results
4. **No `skill-updated` event** — the frontend has no way to know lint results changed
5. **`UnifiedSkillCard` and `SkillDetailPanel` only read `registryData?.lintWarnings`** — `localData` has no lint field
6. **No on-demand lint in the UI** — no "Run lint" button for local-only skills

---

## Step 1 — Rust: Add `lint_warnings` to `SkillInfo`

**File: `src-tauri/src/commands/skills.rs`**

Extend the existing `SkillInfo` struct and populate it in `list_skills` by running the linter during the map:

```rust
#[derive(Debug, Clone, Serialize, Type)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub source: String,
    pub path: Option<String>,
    pub lint_warnings: Vec<LintWarning>,  // NEW
    pub security_score: u8,              // NEW
    pub quality_score: u8,               // NEW
}
```

In `list_skills`, run the linter inline for skills that have a `disk_path`:

```rust
pub async fn list_skills(state: State<'_, Arc<AppState>>) -> Result<Vec<SkillInfo>, String> {
    let skills = state.registry.skill_registry.skills().await;
    let config = state.lint_config.read().await.clone();

    // Lint in parallel using spawn_blocking per skill
    let futs = skills.into_iter().map(|s| {
        let config = config.clone();
        async move {
            let (warnings, sec, qual) = if let Some(ref path) = s.disk_path {
                let p = path.clone();
                let c = config.clone();
                let warnings = tokio::task::spawn_blocking(move || do_lint(&p, &c))
                    .await
                    .unwrap_or_default();
                let sec = compute_security_score(&warnings);
                let qual = compute_quality_score(&warnings);
                (warnings, sec, qual)
            } else {
                (vec![], 5, 5)
            };
            SkillInfo {
                name: s.name,
                description: s.description,
                is_active: s.is_active,
                source: s.source,
                path: s.disk_path.map(|p| p.to_string_lossy().into_owned()),
                lint_warnings: warnings,
                security_score: sec,
                quality_score: qual,
            }
        }
    });

    Ok(futures::future::join_all(futs).await)
}
```

> **Performance note**: `~/.agents/skills/` typically has <50 skills. Parallel spawn_blocking is fast enough for startup. Cache invalidation (not re-linting on every `list_skills` call) is handled in Step 2.

---

## Step 2 — Rust: Emit `skill-updated` event from watcher after hot-reload

**File: `src-tauri/src/events.rs`**

Add a new event:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SkillEvent {
    /// A local skill was created, modified, or removed.
    Updated {
        source_label: String,
        skill_name: String,
    },
}
```

**File: `src-tauri/src/lib.rs`**

Register `SkillEvent` in `collect_events!` and `collect_commands!`.

**File: `src-tauri/skilldeck-core/src/skills/watcher.rs`**

The `start_registry_watcher` function needs access to the `AppHandle` to emit. Change its signature (or create a new `start_registry_watcher_with_emit` variant) to emit `SkillEvent::Updated` after a successful hot-reload:

```rust
pub fn start_registry_watcher_with_emit(
    dir: PathBuf,
    source_label: String,
    registry: Arc<super::SkillRegistry>,
    app_handle: tauri::AppHandle,   // NEW
) -> Result<notify::RecommendedWatcher, CoreError> {
    // ... existing channel setup ...

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                SkillWatchEvent::Created(skill_dir) | SkillWatchEvent::Modified(skill_dir) => {
                    let skill_name = skill_dir.file_name()...;
                    if registry.load_skill_from_source(&source_label, skill_dir).await.is_ok() {
                        // Emit so frontend knows to refetch list_skills
                        let _ = SkillEvent::Updated {
                            source_label: source_label.clone(),
                            skill_name,
                        }.emit(&app_handle);
                    }
                }
                SkillWatchEvent::Deleted(skill_dir) => {
                    // ... existing removal logic ...
                    let _ = SkillEvent::Updated { ... }.emit(&app_handle);
                }
            }
        }
    });

    Ok(watcher)
}
```

**File: `src-tauri/src/state.rs`** — update the watcher startup loop to call `start_registry_watcher_with_emit` passing `app.clone()` (already stored as `state.app_handle`).

---

## Step 3 — Frontend: Update types and `useLocalSkills` to carry warnings

**Auto-generated: `src/lib/bindings.ts`** — `specta` will regenerate `SkillInfo` automatically once Step 1 is done.

**File: `src/hooks/use-unified-skills.ts`**

`useLocalSkills` already fetches `SkillInfo[]`. After Step 1, each `SkillInfo` in `localData` now has `lint_warnings`, `security_score`, `quality_score`. No change needed here beyond the type update.

**File: `src/lib/events.ts`** — add the new event type:

```ts
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

## Step 4 — Frontend: `useSkillEvents` hook (live invalidation)

**New file: `src/hooks/use-skill-events.ts`**

```ts
export function useSkillEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null

    onSkillEvent(() => {
      // Any skill change → refetch the local skills list (which now includes lint results)
      queryClient.invalidateQueries({ queryKey: ['local_skills'] })
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [queryClient])
}
```

Mount this hook once in `App.tsx` (alongside `useMcpEvents`).

---

## Step 5 — Frontend: Surface lint results for local skills in the card and detail panel

**File: `src/components/skills/unified-skill-card.tsx`**

The card already reads `skill.registryData?.lintWarnings`. Add a fallback to `localData`:

```ts
const lintWarnings = (
  skill.localData?.lint_warnings ??
  skill.registryData?.lintWarnings ??
  []
) as LintWarning[]

const securityScore = skill.localData?.security_score ?? skill.registryData?.securityScore
const qualityScore  = skill.localData?.quality_score  ?? skill.registryData?.qualityScore
```

The existing error/warning count badges and `TrustBadge` then work for local skills automatically.

**File: `src/components/skills/skill-detail-panel.tsx`**

In the "Lint Issues" section, read from both data sources:

```tsx
const lintWarnings = (
  skill.localData?.lint_warnings ??
  skill.registryData?.lintWarnings ??
  []
) as LintWarning[]

// Replace the existing guard:
{lintWarnings.length > 0 && (
  <div>
    <SectionLabel>Lint Issues</SectionLabel>
    <LintWarningPanel warnings={lintWarnings} onIgnore={skill.localData ? handleIgnoreRule : undefined} />
  </div>
)}
```

Also surface computed scores for local-only skills:

```tsx
{skill.localData && (
  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
    <MetaField label="Security" value={`${skill.localData.security_score}/5`} />
    <MetaField label="Quality"  value={`${skill.localData.quality_score}/5`} />
  </div>
)}
```

---

## Step 6 — Frontend: "Re-lint" on-demand button in `SkillDetailPanel`

For local-only skills, add a manual lint trigger. This is useful when the user edits `SKILL.md` externally and wants an instant result without waiting for the file watcher.

```tsx
// In skill-detail-panel.tsx actions section:
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

// Render:
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

The button emits a `skill-updated` event through the `lint_skill` command result, or simply invalidates `local_skills` directly on success — either way the card and detail panel update immediately.

---

## Step 7 — Frontend: Lint summary in `unified-skill-list.tsx` header

Add a small summary badge to the installed-skills section header so users can spot issues at a glance without opening each card:

```tsx
// Compute from unifiedSkills
const localWithIssues = unifiedSkills.filter(
  (s) => s.status === 'local_only' || s.status === 'installed'
).filter(
  (s) => (s.localData?.lint_warnings?.length ?? 0) > 0
).length

// In the header:
{localWithIssues > 0 && (
  <span
    className="text-xs text-amber-500 font-medium"
    title={`${localWithIssues} local skill(s) have lint issues`}
  >
    {localWithIssues} ⚠
  </span>
)}
```

---

## Step 8 — Performance: Cache lint results in the in-memory skill registry

**File: `src-tauri/skilldeck-core/src/skills/` (SkillRegistry or Skill struct)**

Add `lint_warnings: Option<Vec<LintWarning>>` to the in-memory `Skill` struct. Populate it during `scan_directory` (at startup) and `load_skill_from_source` (on hot-reload). This means `list_skills` can just read the cached value instead of re-running the linter on every call.

```rust
// In scanner.rs, after loader.load():
let warnings = do_lint(&entry_path, &config);
let mut skill = loader.load(...).await?;
skill.lint_warnings = Some(warnings);
```

Pass `lint_config` into `scan_directory` and `load_skill_from_source` (or read it from the registry which can hold a reference).

---

## Summary of changes

| Layer | File | Change |
|---|---|---|
| Rust | `skilldeck-lint/src/lib.rs` | No change (already has `compute_security_score`, `compute_quality_score`) |
| Rust | `src-tauri/src/commands/skills.rs` | Add `lint_warnings`, `security_score`, `quality_score` to `SkillInfo`; populate in `list_skills` |
| Rust | `src-tauri/src/events.rs` | Add `SkillEvent::Updated` |
| Rust | `src-tauri/skilldeck-core/src/skills/watcher.rs` | Emit `SkillEvent` after hot-reload |
| Rust | `src-tauri/src/state.rs` | Pass `app_handle` to watcher; lint during `scan_directory` |
| Rust | `src-tauri/src/lib.rs` | Register `SkillEvent`, `relint` command |
| TS | `src/lib/events.ts` | Add `SkillEvent`, `onSkillEvent` |
| TS | `src/hooks/use-skill-events.ts` | New hook — invalidates `local_skills` on `skill-updated` |
| TS | `src/App.tsx` | Mount `useSkillEvents()` |
| TSX | `src/components/skills/unified-skill-card.tsx` | Read `localData.lint_warnings` / scores |
| TSX | `src/components/skills/skill-detail-panel.tsx` | Show lint panel + scores for local skills; add Re-lint button |
| TSX | `src/components/skills/unified-skill-list.tsx` | Add lint issues summary badge in header |
