You're absolutely right to investigate this. The linting feature for local skills is **partially implemented but not fully integrated** into the user experience. Here's the current state based on the codebase:

## ✅ What's Implemented

### 1. **Lint Engine (`skilldeck-lint/`) - Complete**
The linting engine itself is fully functional:
- **Rules implemented**: Frontmatter validation, security checks, quality checks, structure validation
- **Config system**: TOML-based config with global (`~/.config/skilldeck/skilldeck-lint.toml`) and workspace overrides
- **Rule categories**:
  - Security (`sec-dangerous-tools`, `sec-allowed-tools-mismatch`)
  - Frontmatter (`fm-name-format`, `fm-description-length`, etc.)
  - Quality (`quality-content-examples`, `quality-content-steps`, etc.)
  - Structure (`struct-skill-md-exists`, `struct-skill-md-size`, etc.)

### 2. **Lint Results Storage**
The `registry_skills` table in the platform DB stores lint warnings:
```rust
// From skilldeck-platform/migration/src/m20260316_000002_create_skill_tables.rs
pub struct Model {
    // ...
    pub lint_warnings: Option<Json>,
    pub security_score: i32,
    pub quality_score: i32,
    // ...
}
```

### 3. **UI Components - Exist But Not Connected**
- `LintWarningPanel.tsx` - Displays warnings with severity colors
- `TrustBadge.tsx` - Shows security/quality scores
- Warning display in `ContextChip.tsx` and `UnifiedSkillCard.tsx`

## ❌ What's Missing for Local Skills

### 1. **No Automatic Linting of Local Skills**
The critical gap: **local skills in `~/.agents/skills/` are never linted**. Looking at the code:

```rust
// In src-tauri/src/state.rs - AppState initialization
let skill_dirs = match ctx {
    Ok(ref c) => c.skill_directories.clone(),
    Err(_) => {
        if let Some(home) = dirs_next::home_dir() {
            let global = home.join(".agents").join("skills");  // <-- This is scanned
            // ...
        }
    }
};

// Skills are loaded but NOT linted during initialization
for (label, skills) in scanned_results {
    state.registry.skill_registry.register_source(label, skills).await;  // No linting here
}
```

### 2. **Lint Commands Exist But Not Triggered**
The Tauri commands for linting exist but aren't called automatically:

```rust
// In src-tauri/src/commands/skills.rs
#[specta]
#[tauri::command]
pub async fn lint_skill(  // <-- This exists but isn't called automatically
    state: State<'_, Arc<AppState>>,
    path: PathBuf,
    workspace_config_path: Option<PathBuf>,
) -> Result<Vec<LintWarning>, String> {
    // ... implementation
}

#[specta]
#[tauri::command]
pub async fn lint_all_local_sources(  // <-- This exists but isn't triggered
    state: State<'_, Arc<AppState>>,
) -> Result<HashMap<String, Vec<LintWarning>>, String> {
    // ... queries skill_source_dirs table and lints each
}
```

### 3. **UI Not Connected to Local Linting**
While `LintWarningPanel.tsx` exists, it's only shown for registry skills:

```typescript
// In UnifiedSkillCard.tsx
const lintWarnings = (skill.registryData?.lintWarnings || []) as unknown as LintWarning[];
//                                      ^^^^^^^^^^^
// Only registry skills have lintWarnings, local skills don't
```

### 4. **Missing Background Lint Worker**
There's no background process that:
- Watches `~/.agents/skills/` for changes
- Automatically lints modified skills
- Updates the UI with new warnings

## 🔍 The Integration Gaps

### Where Linting Should Happen

1. **During skill scanning**:
```rust
// In skilldeck-core/src/skills/scanner.rs
pub async fn scan_directory(root: &PathBuf) -> Result<Vec<Skill>, CoreError> {
    let mut skills = Vec::new();
    let loader = FilesystemSkillLoader;
    
    while let Some(entry) = read_dir.next_entry().await? {
        // Loads skill but doesn't lint it
        let skill = loader.load(&SkillSource::Filesystem(entry_path.clone())).await?;
        skills.push(skill);  // <-- Should lint here and attach warnings
    }
    Ok(skills)
}
```

2. **During hot reload**:
```rust
// In skilldeck-core/src/skills/watcher.rs
pub fn start_registry_watcher(
    dir: PathBuf,
    source_label: String,
    registry: Arc<super::SkillRegistry>,
) -> Result<notify::RecommendedWatcher, CoreError> {
    // Watches for changes but doesn't trigger linting
    // Should call lint_skill when SKILL.md changes
}
```

3. **On demand via UI**:
- No "Lint Now" button in the skill detail panel
- No way to manually trigger linting for a local skill

## 📋 Required Changes

### High Priority
1. **Add linting to skill loading pipeline**:
```rust
// In scanner.rs or loader.rs, after loading a skill:
let warnings = skilldeck_lint::lint_skill(&skill_dir, &lint_config);
skill.lint_warnings = Some(warnings);
```

2. **Create background lint worker**:
```rust
// In state.rs initialization:
tokio::spawn(async move {
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        // When SKILL.md changes, re-lint and update registry
    })?;
});
```

3. **Store lint results in local DB**:
Add a `lint_warnings` column to the local `skills` table (currently only in `registry_skills`)

### Medium Priority
4. **Add "Lint" button to skill detail panel**:
```typescript
// In SkillDetailPanel.tsx
{skill.localData && (
  <Button onClick={() => lintLocalSkill(skill.name)}>
    <AlertTriangle className="mr-2 h-3.5 w-3.5" />
    Run Lint Check
  </Button>
)}
```

5. **Show lint warnings for local skills in UI**:
```typescript
// In UnifiedSkillCard.tsx - use local warnings too
const lintWarnings = skill.localData?.lintWarnings || skill.registryData?.lintWarnings || [];
```

### Low Priority
6. **Add lint configuration UI for local skills** (currently only in TOML files)

## 🎯 Impact

Currently, users have **no visibility** into:
- Security issues in their locally created skills
- Quality problems (missing descriptions, examples, etc.)
- Frontmatter validation errors
- Whether their skills follow best practices

The linting engine is powerful and ready to use - it just needs to be connected to the local skill pipeline and surfaced in the UI.
