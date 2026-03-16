I apologize for the omission. Here is the **complete, unabridged implementation plan**, merging the original technical specifications with the UX Researcher's refinements.

# Skill Marketplace Implementation Plan (Complete & UX-Refined)

> **For agentic workers:** REQUIRED: Use `superpowers:subagent-driven-development` (if subagents available) or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Skill Marketplace feature enabling discovery, installation, and management of AI skills from multiple sources (central registry, local workspace, personal, team repos) with LLM‑powered categorization, cron‑based linting, and configurable lint rules.

**Architecture:** Hybrid model with a central platform (Axum) for public skill aggregation and enrichment, and client‑side (Tauri) integration for local skills. A shared `skilldeck-lint` crate provides consistent linting across platform and client. TOML configuration files allow per‑workspace lint rule overrides.

**Tech Stack:** Rust (Axum, SeaORM, Tokio), SQLite (platform), Tauri (client), React/TypeScript (frontend), Ollama GLM5 cloud for LLM enrichment.

**UX Refinement Summary:**
1.  **Actionability:** Lint errors now include `suggested_fix`.
2.  **Trust:** Security warnings are visually distinct from style warnings.
3.  **Transparency:** AI-generated tags are marked; Config management is bridged to UI.

---

## Chunk 1: Create `skilldeck-lint` Crate

**Files:**
- Create: `src-tauri/skilldeck-lint/Cargo.toml`
- Create: `src-tauri/skilldeck-lint/src/lib.rs`
- Create: `src-tauri/skilldeck-lint/src/rules/mod.rs`
- Create: `src-tauri/skilldeck-lint/src/rules/frontmatter.rs`
- Create: `src-tauri/skilldeck-lint/src/rules/structure.rs`
- Create: `src-tauri/skilldeck-lint/src/rules/security.rs`
- Create: `src-tauri/skilldeck-lint/src/rules/quality.rs`
- Create: `src-tauri/skilldeck-lint/src/config.rs`
- Create: `src-tauri/skilldeck-lint/src/warning.rs`
- Create: `src-tauri/skilldeck-lint/src/bin/main.rs` (CLI)

- [ ] **Step 1: Create crate directory and Cargo.toml**

```toml
[package]
name = "skilldeck-lint"
version = "0.1.0"
edition = "2024"
description = "Linting rules for Agent Skills"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_yaml = "0.9"
toml = "0.8"
thiserror = "2"
anyhow = "1"
walkdir = "2"
regex = "1"
chrono = "0.4"
clap = { version = "4", features = ["derive"] }
```

- [ ] **Step 2: Define core types (lib.rs)**

```rust
mod config;
mod rules;
mod warning;

pub use config::{LintConfig, Severity};
pub use rules::{LintRule, RuleId};
pub use warning::LintWarning;

use std::path::Path;

pub fn lint_skill(skill_path: &Path, config: &LintConfig) -> Vec<LintWarning> {
    let mut warnings = Vec::new();
    // Iterate over all registered rules, run each if enabled
    for rule in rules::all_rules() {
        if let Some(severity) = config.rule_severity(rule.id()) {
            if severity == Severity::Off {
                continue;
            }
            let mut rule_warnings = rule.check(skill_path, config);
            // Assign severity from config (override rule default)
            for w in &mut rule_warnings {
                w.severity = severity;
            }
            warnings.extend(rule_warnings);
        }
    }
    warnings
}
```

- [ ] **Step 3: Define LintWarning and Severity (warning.rs)**

*UX Refinement:* Added `suggested_fix` field to enable "One-Click Fix" features in the client.

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Off,
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LintWarning {
    pub rule_id: String,
    pub severity: Severity,
    pub message: String,
    pub location: Option<LintLocation>,
    // UX Addition: Allows the UI to suggest/auto-apply a fix
    pub suggested_fix: Option<String>, 
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LintLocation {
    pub file: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}
```

- [ ] **Step 4: Implement config parsing (config.rs)**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LintConfig {
    #[serde(default)]
    pub defaults: Defaults,
    #[serde(default)]
    pub rules: HashMap<String, String>, // rule_id -> severity or "off"
    #[serde(default)]
    pub rule_params: HashMap<String, toml::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Defaults {
    #[serde(default = "default_severity")]
    pub severity: String,
}

impl Default for Defaults {
    fn default() -> Self {
        Self { severity: default_severity() }
    }
}

fn default_severity() -> String { "warning".to_string() }

impl LintConfig {
    pub fn from_files(global: Option<&Path>, workspace: Option<&Path>) -> Result<Self, anyhow::Error> {
        let mut config = Self::default();
        if let Some(global_path) = global {
            if global_path.exists() {
                let content = std::fs::read_to_string(global_path)?;
                let global_config: LintConfig = toml::from_str(&content)?;
                config.merge(global_config);
            }
        }
        if let Some(workspace_path) = workspace {
            if workspace_path.exists() {
                let content = std::fs::read_to_string(workspace_path)?;
                let workspace_config: LintConfig = toml::from_str(&content)?;
                config.merge(workspace_config);
            }
        }
        Ok(config)
    }

    fn merge(&mut self, other: LintConfig) {
        self.defaults = other.defaults;
        self.rules.extend(other.rules);
        self.rule_params.extend(other.rule_params);
    }

    pub fn rule_severity(&self, rule_id: &str) -> Option<Severity> {
        if let Some(s) = self.rules.get(rule_id) {
            match s.as_str() {
                "off" => Some(Severity::Off),
                "info" => Some(Severity::Info),
                "warning" => Some(Severity::Warning),
                "error" => Some(Severity::Error),
                _ => None,
            }
        } else {
            // fallback to default severity
            match self.defaults.severity.as_str() {
                "info" => Some(Severity::Info),
                "warning" => Some(Severity::Warning),
                "error" => Some(Severity::Error),
                _ => Some(Severity::Warning),
            }
        }
    }
}
```

- [ ] **Step 5: Create rule trait and registration (rules/mod.rs)**

```rust
use crate::{LintConfig, LintWarning};
use std::path::Path;

pub type RuleId = &'static str;

pub trait LintRule: Send + Sync {
    fn id(&self) -> RuleId;
    fn check(&self, skill_path: &Path, config: &LintConfig) -> Vec<LintWarning>;
}

// Import all rule modules
mod frontmatter;
mod structure;
mod security;
mod quality;

pub fn all_rules() -> Vec<Box<dyn LintRule>> {
    vec![
        Box::new(frontmatter::NameFormat),
        Box::new(frontmatter::DescriptionLength),
        Box::new(frontmatter::DescriptionContent),
        Box::new(frontmatter::LicensePresent),
        Box::new(frontmatter::LicenseFormat),
        Box::new(frontmatter::CompatibilityLength),
        Box::new(frontmatter::AllowedTools),
        Box::new(frontmatter::MetadataKeys),
        Box::new(structure::SkillMdExists),
        Box::new(structure::SkillMdSize),
        Box::new(structure::ReferencesExist),
        Box::new(structure::ReferencesDepth),
        Box::new(quality::ContentExamples),
        Box::new(quality::ContentSteps),
        Box::new(quality::ContentClarity),
        Box::new(quality::ProgressiveDisclosure),
        Box::new(security::DangerousTools),
        Box::new(security::AllowedToolsMismatch),
        Box::new(quality::Dependencies),
        Box::new(quality::Platform),
        Box::new(quality::Freshness),
    ]
}
```

- [ ] **Step 6: Implement a few sample rules (e.g., frontmatter::NameFormat)**

*UX Refinement:* Error message now includes `suggested_fix`.

```rust
// rules/frontmatter.rs
use crate::{LintConfig, LintRule, LintWarning, Severity};
use std::path::Path;
use std::fs;
use regex::Regex;

pub struct NameFormat;

impl LintRule for NameFormat {
    fn id(&self) -> &'static str { "fm-name-format" }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md = skill_path.join("SKILL.md");
        if !skill_md.exists() {
            return vec![];
        }
        let content = match fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => return vec![],
        };
        // Extract frontmatter name
        // Simplified: look for `name: ...` line
        let name_line = content.lines()
            .find(|l| l.starts_with("name:"))
            .and_then(|l| l.split(':').nth(1).map(|s| s.trim()));
        if let Some(name) = name_line {
            let re = Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap();
            if !re.is_match(name) {
                let suggested = name.to_lowercase().replace(" ", "-");
                return vec![LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: format!("Skill name '{}' must be lowercase with hyphens only", name),
                    location: None,
                    suggested_fix: Some(format!("name: {}", suggested)),
                }];
            }
            // Also check if matches directory name
            if let Some(dir_name) = skill_path.file_name().and_then(|n| n.to_str()) {
                if name != dir_name {
                    return vec![LintWarning {
                        rule_id: self.id().to_string(),
                        severity: Severity::Error,
                        message: format!("Skill name '{}' must match directory name '{}'", name, dir_name),
                        location: None,
                        suggested_fix: Some(format!("Rename directory to '{}' or change name in SKILL.md", name)),
                    }];
                }
            }
        }
        vec![]
    }
}
```

- [ ] **Step 7: Build CLI binary (bin/main.rs)**

```rust
use clap::{Parser, Subcommand};
use skilldeck_lint::{lint_skill, LintConfig};
use std::path::PathBuf;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate a skill directory
    Validate {
        /// Path to skill directory
        path: PathBuf,
        /// Custom config file
        #[arg(short, long)]
        config: Option<PathBuf>,
    },
    /// List all available lint rules
    ListRules,
    /// Generate a default config file
    InitConfig,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Validate { path, config } => {
            let global_config = dirs::config_dir().map(|d| d.join("skilldeck/skilldeck-lint.toml"));
            let workspace_config = if path.join(".skilldeck").exists() {
                Some(path.join(".skilldeck/skilldeck-lint.toml"))
            } else { None };
            let config = LintConfig::from_files(global_config.as_deref(), workspace_config.as_deref())?;
            let warnings = lint_skill(&path, &config);
            if warnings.is_empty() {
                println!("✅ No issues found.");
            } else {
                for w in warnings {
                    println!("{:?}: {} - {}", w.severity, w.rule_id, w.message);
                }
                std::process::exit(1);
            }
        }
        Commands::ListRules => {
            for rule in skilldeck_lint::rules::all_rules() {
                println!("{}", rule.id());
            }
        }
        Commands::InitConfig => {
            let default = r#"[defaults]
severity = "warning"

[rules]
# example: fm-description-content = "off"
"#;
            println!("{}", default);
        }
    }
    Ok(())
}
```

- [ ] **Step 8: Add test for lint crate**

Create `src-tauri/skilldeck-lint/tests/test_basic.rs` with a sample skill directory and assert warnings.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/skilldeck-lint
git commit -m "feat(lint): create skilldeck-lint crate with initial rules and CLI"
```

---

## Chunk 2: Integrate Lint Crate into `skilldeck-core` and Expose Tauri Commands

**Files:**
- Modify: `src-tauri/skilldeck-core/Cargo.toml` (add dependency)
- Modify: `src-tauri/skilldeck-core/src/lib.rs` (maybe re-export)
- Modify: `src-tauri/skilldeck-core/src/skills/mod.rs` (add linting functions)
- Modify: `src-tauri/src/commands/skills.rs` (add Tauri commands)
- Modify: `src-tauri/src/state.rs` (load lint config on startup)
- Modify: `src/lib/invoke.ts` (add TypeScript bindings)
- Create: `src/hooks/use-lint.ts` (React hook for linting)

- [ ] **Step 1: Add dependency in skilldeck-core/Cargo.toml**

```toml
skilldeck-lint = { path = "../skilldeck-lint" }
```

- [ ] **Step 2: In skilldeck-core/src/skills/mod.rs, add linting functions**

```rust
use skilldeck_lint::{lint_skill, LintConfig, LintWarning};
use std::path::Path;

impl SkillRegistry {
    pub async fn lint_skill(&self, skill_path: &Path, config: &LintConfig) -> Vec<LintWarning> {
        // Run lint (sync, but we can spawn blocking)
        tokio::task::spawn_blocking(move || {
            lint_skill(skill_path, config)
        }).await.unwrap_or_default()
    }

    pub async fn lint_all_local_sources(&self, config: &LintConfig) -> HashMap<String, Vec<LintWarning>> {
        let mut results = HashMap::new();
        for (source, path) in self.local_source_paths() { // need to track these
            let warnings = self.lint_skill(&path, config).await;
            results.insert(source, warnings);
        }
        results
    }
}
```

- [ ] **Step 3: Add Tauri commands in src-tauri/src/commands/skills.rs**

```rust
use skilldeck_lint::{LintConfig, LintWarning};
use std::path::PathBuf;

#[tauri::command]
pub async fn lint_skill(
    state: State<'_, Arc<AppState>>,
    path: PathBuf,
) -> Result<Vec<LintWarning>, String> {
    // Load merged config from state (already loaded on startup)
    let config = state.lint_config.read().await;
    let warnings = state.registry.skill_registry.lint_skill(&path, &config).await;
    Ok(warnings)
}

#[tauri::command]
pub async fn lint_all_local_sources(
    state: State<'_, Arc<AppState>>,
) -> Result<HashMap<String, Vec<LintWarning>>, String> {
    let config = state.lint_config.read().await;
    let results = state.registry.skill_registry.lint_all_local_sources(&config).await;
    Ok(results)
}

#[tauri::command]
pub async fn get_lint_rules() -> Result<Vec<String>, String> {
    Ok(skilldeck_lint::rules::all_rules().iter().map(|r| r.id().to_string()).collect())
}
```

- [ ] **Step 4: Add lint_config to AppState (src-tauri/src/state.rs)**

```rust
use tokio::sync::RwLock;

pub struct AppState {
    // ...
    pub lint_config: Arc<RwLock<LintConfig>>,
}

impl AppState {
    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // ...
        let global_config = dirs::config_dir().map(|d| d.join("skilldeck/skilldeck-lint.toml"));
        // Workspace config will be determined per skill path, not globally.
        // For now, load only global.
        let lint_config = LintConfig::from_files(global_config.as_deref(), None)
            .unwrap_or_default();
        let lint_config = Arc::new(RwLock::new(lint_config));

        Ok(Self { lint_config, .. })
    }
}
```

- [ ] **Step 5: Add TypeScript bindings in src/lib/invoke.ts**

```typescript
export async function lintSkill(path: string): Promise<LintWarning[]> {
  return invoke('lint_skill', { path });
}

export async function lintAllLocalSources(): Promise<Record<string, LintWarning[]>> {
  return invoke('lint_all_local_sources');
}

export async function getLintRules(): Promise<string[]> {
  return invoke('get_lint_rules');
}
```

- [ ] **Step 6: Create React hook src/hooks/use-lint.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { lintSkill, lintAllLocalSources, getLintRules } from '@/lib/bindings';

export function useLintSkill(skillPath: string | null) {
  return useQuery({
    queryKey: ['lint', skillPath],
    queryFn: () => lintSkill(skillPath!),
    enabled: !!skillPath,
    staleTime: 60_000,
  });
}

export function useLintAllLocalSources() {
  return useQuery({
    queryKey: ['lint-all'],
    queryFn: lintAllLocalSources,
    staleTime: 60_000,
  });
}

export function useLintRules() {
  return useQuery({
    queryKey: ['lint-rules'],
    queryFn: getLintRules,
    staleTime: Infinity,
  });
}
```

- [ ] **Step 7: Test with a sample skill**

- [ ] **Step 8: Commit**

```bash
git add src-tauri/skilldeck-core src-tauri/src/commands/skills.rs src-tauri/src/state.rs src/lib/invoke.ts src/hooks/use-lint.ts
git commit -m "feat(lint): integrate skilldeck-lint into Tauri backend"
```

---

## Chunk 3: Extend Platform Service for Skill Ingestion, LLM Enrichment, and Cron Linting

**Files (within `skilldeck-platform`):**
- Modify: `skilldeck-platform/Cargo.toml` (add new dependencies: reqwest, cron, etc.)
- Modify: `skilldeck-platform/src/app.rs` (add new routes)
- Create: `skilldeck-platform/src/skills/mod.rs`
- Create: `skilldeck-platform/src/skills/ingestion.rs`
- Create: `skilldeck-platform/src/skills/enrichment.rs`
- Create: `skilldeck-platform/src/skills/lint_cron.rs`
- Create: `skilldeck-platform/src/skills/models.rs` (DB models for skills)
- Create: `skilldeck-platform/src/skills/handlers.rs`
- Create: `skilldeck-platform/migration/src/m20260316_000002_create_skill_tables.rs`

- [ ] **Step 1: Add migration for skill tables**

*UX Refinement:* Added `security_score` and `quality_score` columns to support Trust Badges in UI.

```rust
// m20260316_000002_create_skill_tables.rs
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Skills::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Skills::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Skills::Name).string().not_null())
                    .col(ColumnDef::new(Skills::Description).text().not_null())
                    .col(ColumnDef::new(Skills::Source).string().not_null())
                    .col(ColumnDef::new(Skills::SourceUrl).string())
                    .col(ColumnDef::new(Skills::Version).string())
                    .col(ColumnDef::new(Skills::Author).string())
                    .col(ColumnDef::new(Skills::License).string())
                    .col(ColumnDef::new(Skills::Compatibility).text())
                    .col(ColumnDef::new(Skills::AllowedTools).text())
                    .col(ColumnDef::new(Skills::ContentHash).string().not_null())
                    .col(ColumnDef::new(Skills::Content).text().not_null())
                    .col(ColumnDef::new(Skills::LintWarnings).json())
                    .col(ColumnDef::new(Skills::Tags).json())
                    .col(ColumnDef::new(Skills::Category).string())
                    .col(ColumnDef::new(Skills::Embedding).binary())
                    // UX Addition: Trust Scores
                    .col(ColumnDef::new(Skills::SecurityScore).integer().default(5)) 
                    .col(ColumnDef::new(Skills::QualityScore).integer().default(5))
                    .col(ColumnDef::new(Skills::MetadataSource).string().default("author"))
                    // End UX Addition
                    .col(ColumnDef::new(Skills::LastLintedAt).timestamp_with_time_zone())
                    .col(ColumnDef::new(Skills::CreatedAt).timestamp_with_time_zone().not_null())
                    .col(ColumnDef::new(Skills::UpdatedAt).timestamp_with_time_zone().not_null())
                    .to_owned(),
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Skills::Table).to_owned()).await
    }
}

#[derive(Iden)]
enum Skills {
    Table,
    Id,
    Name,
    Description,
    Source,
    SourceUrl,
    Version,
    Author,
    License,
    Compatibility,
    AllowedTools,
    ContentHash,
    Content,
    LintWarnings,
    Tags,
    Category,
    Embedding,
    SecurityScore, // UX
    QualityScore,  // UX
    MetadataSource, // UX
    LastLintedAt,
    CreatedAt,
    UpdatedAt,
}
```

- [ ] **Step 2: Create ingestion module to crawl GitHub**

```rust
// ingestion.rs
use crate::skills::models::SkillModel;
use octocrab::Octocrab;
use std::collections::HashMap;

pub async fn crawl_github_org(org: &str) -> Result<Vec<SkillModel>, anyhow::Error> {
    let octocrab = Octocrab::builder().build()?;
    let repos = octocrab.orgs(org).list_repos().send().await?;
    let mut skills = Vec::new();
    for repo in repos {
        // Check if repo has a SKILL.md in root
        // Download content, parse frontmatter, store
    }
    Ok(skills)
}
```

- [ ] **Step 3: LLM enrichment module (enrichment.rs)**

*UX Refinement:* Calculate `security_score` and `quality_score` and set `metadata_source`.

```rust
use ollama_rs::Ollama;
use serde_json::Value;

pub async fn enrich_skill(skill: &mut SkillModel) -> Result<(), anyhow::Error> {
    let ollama = Ollama::new("http://localhost".to_string(), 11434);
    let prompt = format!(
        "You are a skill classifier. Given the following skill content and description, generate:
- tags (list of strings)
- primary category (one of: Development, Data Science, Writing, DevOps, Security, Other)
- language/framework detection
- dependencies (JSON object)
- quality score (1-5)
- embeddings (optional)

Skill name: {}
Description: {}
Content:
{}",
        skill.name, skill.description, skill.content
    );
    let response = ollama.generate("glm5-cloud".into(), prompt).await?;
    
    // UX Addition: Calculate scores for UI Trust Badges
    // In real impl, parse LLM response to set these
    skill.quality_score = calculate_quality(&response);
    skill.security_score = calculate_security(&skill.content);
    skill.metadata_source = "llm_enrichment".to_string();
    
    Ok(())
}
```

- [ ] **Step 4: Cron linting module (lint_cron.rs)**

```rust
use skilldeck_lint::{lint_skill, LintConfig};
use crate::db::Db;
use crate::skills::models::SkillModel;

pub async fn run_lint_cron(db: &Db) -> Result<(), anyhow::Error> {
    // Find skills where content_hash != last_linted_hash OR updated_at > last_linted_at
    let skills = SkillModel::find_need_linting(db).await?;
    let config = LintConfig::default(); // platform may use its own config
    for mut skill in skills {
        let path = tempfile::tempdir()?; // write skill content to temp dir
        // write SKILL.md
        let warnings = lint_skill(path.path(), &config);
        skill.lint_warnings = serde_json::to_value(warnings)?;
        skill.last_linted_at = Some(chrono::Utc::now());
        skill.save(db).await?;
    }
    Ok(())
}
```

- [ ] **Step 5: Add routes in app.rs**

```rust
.route("/api/v1/skills", get(skills::handlers::list_skills))
.route("/api/v1/skills/:id", get(skills::handlers::get_skill))
.route("/api/v1/skills/search", get(skills::handlers::search_skills))
.route("/api/v1/sync", get(skills::handlers::sync))
```

- [ ] **Step 6: Implement handlers**

```rust
// handlers.rs
pub async fn list_skills(
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<Vec<SkillResponse>>> { ... }
```

- [ ] **Step 7: Add cron job in main**

```rust
// main.rs
tokio::spawn(async {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
    loop {
        interval.tick().await;
        if let Err(e) = lint_cron::run_lint_cron(&state.db).await {
            tracing::error!("Lint cron failed: {}", e);
        }
    }
});
```

- [ ] **Step 8: Test with local platform**

- [ ] **Step 9: Commit**

---

## Chunk 4: Client UI – Skill Browser Component

**Files:**
- Create: `src/components/skills/skill-browser.tsx`
- Create: `src/components/skills/skill-card.tsx`
- Create: `src/components/skills/skill-detail.tsx`
- Create: `src/components/skills/trust-badge.tsx` (UX New)
- Create: `src/components/skills/lint-warning-panel.tsx` (UX New)
- Modify: `src/components/layout/right-panel.tsx` (add Skills tab)
- Modify: `src/hooks/use-skills.ts` (add fetch from registry)
- Modify: `src/lib/invoke.ts` (add platform API calls)

- [ ] **Step 1: Add platform API calls in invoke.ts**

```typescript
export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  author?: string;
  version?: string;
  lintWarnings: LintWarning[];
  content: string;
  securityScore: number; // UX
  qualityScore: number;  // UX
  metadataSource: string; // UX
}

export async function fetchRegistrySkills(params?: { category?: string; tags?: string[] }): Promise<RegistrySkill[]> {
  const query = new URLSearchParams(params as any).toString();
  return invoke('platform:fetch_skills', { query }); // we'll need a Tauri command that proxies to platform
}
```

We'll need a Tauri command that proxies to the platform API (to avoid CORS). Add a command in `src-tauri/src/commands/platform.rs`.

- [ ] **Step 2: Create useAllSkills hook that merges local and registry skills**

```typescript
export function useAllSkills() {
  const localSkills = useLocalSkills(); // existing
  const registrySkills = useRegistrySkills();
  return useMemo(() => {
    // Merge: local overrides registry with same name
    const map = new Map();
    for (const s of registrySkills.data || []) map.set(s.name, { ...s, source: 'registry' });
    for (const s of localSkills.data || []) map.set(s.name, { ...s, source: s.source }); // workspace/personal
    return Array.from(map.values());
  }, [localSkills.data, registrySkills.data]);
}
```

- [ ] **Step 3: Build TrustBadge Component (UX New)**

```tsx
// src/components/skills/trust-badge.tsx
export function TrustBadge({ securityScore, qualityScore }: { securityScore: number, qualityScore: number }) {
  if (securityScore < 3) {
    return <Badge color="red" icon="ShieldAlert">Security Risk</Badge>;
  }
  if (qualityScore < 3) {
    return <Badge color="yellow" icon="AlertTriangle">Low Quality</Badge>;
  }
  return <Badge color="green" icon="CheckCircle">Verified Safe</Badge>;
}
```

- [ ] **Step 4: Build SkillCard component**

Shows name, description, tags, source badge, **TrustBadge (UX)**, lint severity indicator.

- [ ] **Step 5: Build LintWarningPanel with Actions (UX New)**

```tsx
// src/components/skills/lint-warning-panel.tsx
export function LintWarningPanel({ warnings, skillPath }: Props) {
  const disableRule = useDisableRule(); // from Chunk 2

  return (
    <div>
      {warnings.map(w => (
        <div key={w.rule_id} className="flex justify-between items-center">
          <div>
            <span className="font-bold text-red-500">{w.severity}:</span> {w.message}
          </div>
          <div className="actions">
            {w.suggested_fix && (
              <Button size="sm" onClick={() => applyFix(skillPath, w.suggested_fix)}>
                Fix
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => disableRule.mutate({ ruleId: w.rule_id, scope: 'workspace' })}>
              Ignore
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Build SkillBrowser with filtering and search**

Use TanStack Virtual for performance.

- [ ] **Step 7: Build SkillDetail**

Includes `TrustBadge` and `LintWarningPanel`.

- [ ] **Step 8: Add Skills tab to right panel**

- [ ] **Step 9: Commit**

---

## Chunk 5: Source Management UI

**Files:**
- Create: `src/components/settings/skill-sources.tsx`
- Modify: `src/components/overlays/settings-overlay.tsx` (add Sources tab)
- Modify: `src/lib/invoke.ts` (add commands for managing sources)

- [ ] **Step 1: Add Tauri commands for source management**

```rust
#[tauri::command]
pub async fn add_skill_source(source_type: String, path: String) -> Result<(), String> { ... }

#[tauri::command]
pub async fn remove_skill_source(id: String) -> Result<(), String> { ... }

#[tauri::command]
pub async fn list_skill_sources() -> Result<Vec<SkillSource>, String> { ... }
```

Store sources in DB (new table `skill_sources`).

- [ ] **Step 2: Build React component**

*UX Refinement:* Visualize the "Resolution Order" so users understand why a local skill overrides a remote one.

- [ ] **Step 3: Commit**

---

## Chunk 6: Sync Client with Platform

**Files:**
- Modify: `src-tauri/src/commands/platform.rs` (add sync endpoint)
- Create: `src-tauri/src/sync/skill_sync.rs`
- Modify: `src/hooks/use-skills.ts` (trigger sync)

- [ ] **Step 1: Add last_sync_at to settings store**

- [ ] **Step 2: On app startup, if last_sync > 24h, fetch delta**

- [ ] **Step 3: Store registry skills in local DB (new table)**

- [ ] **Step 4: Commit**

---

## Chunk 7: TOML Config File Reading in Client

**Files:**
- Modify: `src-tauri/src/state.rs` (already done)
- Modify: `src/hooks/use-lint.ts` (maybe add config editing)
- Create: `src/components/settings/lint-config.tsx`

- [ ] **Step 1: Build UI for editing lint config (future)**

- [ ] **Step 2: Ensure client reads workspace config per skill**

When linting a skill, we need to merge workspace config if present. Modify `lint_skill` command to accept optional workspace path and merge.

- [ ] **Step 3: Commit**

---

## Chunk 8: Installation Flow & Conflict Resolution

**UX Objective:** Ensure users understand the "Copy vs. Link" mental model and can resolve conflicts when a local skill diverges from the registry version.

**Files:**
- Modify: `src-tauri/src/commands/skills.rs` (add install logic)
- Create: `src-tauri/src/skills/installer.rs` (logic for copying/activating)
- Create: `src/components/skills/install-dialog.tsx`
- Create: `src/components/skills/conflict-resolver.tsx`

- [ ] **Step 1: Implement Installation Logic (Rust)**

*Logic:* Installing a skill is a "Copy" operation, not a live link. This ensures local stability.

```rust
// src-tauri/src/skills/installer.rs
use std::fs;
use std::path::PathBuf;

pub fn install_skill(source_path: &Path, target_source: &str) -> Result<PathBuf, anyhow::Error> {
    let target_dir = match target_source {
        "personal" => dirs::home_dir().unwrap().join(".agents/skills"),
        "workspace" => std::env::current_dir()?.join(".skilldeck/skills"),
        _ => return Err(anyhow::anyhow!("Invalid target source")),
    };

    let skill_name = source_path.file_name().unwrap();
    let dest_path = target_dir.join(skill_name);

    if dest_path.exists() {
        return Err(anyhow::anyhow!("Skill already exists locally. Use update/merge."));
    }

    fs::create_dir_all(&dest_path)?;
    // Copy SKILL.md and references
    copy_dir::copy_dir(source_path, &dest_path)?;

    Ok(dest_path)
}
```

- [ ] **Step 2: Create Install Dialog UI**

*UX Refinement:* Explicitly inform the user where the skill is going.

```tsx
// src/components/skills/install-dialog.tsx
export function InstallDialog({ skill }: { skill: RegistrySkill }) {
  const [target, setTarget] = React.useState<'personal' | 'workspace'>('personal');

  return (
    <Dialog>
      <DialogTitle>Install Skill</DialogTitle>
      <DialogContent>
        <p>This will copy <strong>{skill.name}</strong> to your local machine.</p>
        <RadioGroup value={target} onValueChange={setTarget}>
          <Radio value="personal">Personal (~/.agents/skills)</Radio>
          <Radio value="workspace">Workspace (./.skilldeck/skills)</Radio>
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => installSkill(skill.id, target)}>Install Copy</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Implement Conflict Resolution (Update Flow)**

*Scenario:* User has a local copy. Registry has a newer version.
*UX Refinement:* Show a Diff view instead of blind overwrite.

```rust
// Tauri Command
#[tauri::command]
pub async fn diff_skill_versions(local_path: PathBuf, registry_id: String) -> Result<DiffResult, String> {
    // Fetch registry content
    // Diff against local SKILL.md
    // Return unified diff string
    Ok(DiffResult { diff: "..." })
}
```

```tsx
// UI Component
export function ConflictResolver({ local, remote }: Props) {
  return (
    <Dialog>
      <DialogTitle>Update Available</DialogTitle>
      <DialogContent>
        <Alert>
          Your local version differs from the registry. 
        </Alert>
        <DiffView oldContent={local.content} newContent={remote.content} />
      </DialogContent>
      <DialogActions>
        <Button color="error">Keep Local</Button>
        <Button color="primary">Overwrite with Registry</Button>
        <Button>Manual Merge</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(skills): add installation flow and conflict resolution UI"
```

---

## Chunk 9: Comprehensive Testing Strategy

**UX Objective:** Validate that the "Hybrid Architecture" behaves consistently across all environments (CLI, Client, Platform).

**Files:**
- Create: `tests/e2e/installation.spec.ts`
- Create: `tests/integration/lint_consistency.spec.rs`

- [ ] **Step 1: Lint Consistency Test**

*Goal:* Ensure `skilldeck-lint` produces identical results when run via CLI vs. Platform vs. Tauri.

```rust
// tests/integration/lint_consistency.spec.rs
#[test]
fn test_lint_consistency() {
    let skill_path = "tests/fixtures/sample_skill";
    
    // 1. Run via Lib (Direct)
    let lib_warnings = lint_skill(Path::new(skill_path), &LintConfig::default());
    
    // 2. Run via CLI (Process)
    let output = Command::new("./target/debug/skilldeck-lint")
        .arg("validate")
        .arg(skill_path)
        .output()
        .expect("Failed to run CLI");
    // Parse CLI output...
    
    // 3. Compare
    assert_eq!(lib_warnings.len(), parsed_cli_warnings.len());
}
```

- [ ] **Step 2: E2E Installation Test (Tauri)**

*Goal:* Verify a user can actually install and use a skill.

```typescript
// tests/e2e/installation.spec.ts
test('User can install a skill from registry', async ({ page }) => {
  await page.goto('/skills');
  await page.click('text=Data Cleaner'); // Sample skill
  await page.click('text=Install');
  await page.click('text=Install Copy');
  
  // Verify success toast
  await expect(page.locator('text=Skill installed successfully')).toBeVisible();
  
  // Verify file system
  const skillFile = await readLocalFile('~/.agents/skills/data-cleaner/SKILL.md');
  expect(skillFile).toContain('description: Cleans data');
});
```

- [ ] **Step 3: UX Validation Test (User Journey)**

*Manual Test Script:*
1.  User installs a skill with a security warning.
2.  **Expectation:** The UI shows a "Security Risk" badge.
3.  User clicks "Ignore" on the warning.
4.  **Expectation:** The warning disappears and a new entry is created in `.skilldeck/skilldeck-lint.toml`.
5.  User restarts the app.
6.  **Expectation:** The warning remains dismissed.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: add integration tests for lint consistency and E2E installation"
```

---

## Chunk 10: Risk Mitigation Implementation

**UX Objective:** Protect users from malicious or broken skills proactively.

**Files:**
- Modify: `skilldeck-lint/src/rules/security.rs`
- Create: `src/components/skills/blocked-skill-alert.tsx`

- [ ] **Step 1: Enhance Security Lint Rules**

Implement `sec-dangerous-tools` to detect `rm -rf`, `sudo`, or obfuscated code patterns.

```rust
// security.rs
pub struct DangerousTools;

impl LintRule for DangerousTools {
    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = fs::read_to_string(skill_path.join("SKILL.md")).unwrap_or_default();
        let mut warnings = Vec::new();
        
        // Simple heuristic check
        if content.contains("rm -rf /") || content.contains("sudo ") {
            warnings.push(LintWarning {
                rule_id: "sec-dangerous-tools",
                severity: Severity::Error,
                message: "Potentially dangerous system command detected.".to_string(),
                location: None,
                suggested_fix: Some("Remove dangerous commands or explicitly warn users in description.".to_string()),
            });
        }
        warnings
    }
}
```

- [ ] **Step 2: UI Interstitial for High-Risk Skills**

If `security_score < 2`, block direct installation and show a warning interstitial.

```tsx
// src/components/skills/blocked-skill-alert.tsx
export function BlockedSkillAlert({ skill }: { skill: RegistrySkill }) {
  return (
    <Dialog open={true}>
      <DialogTitle className="text-red-600">Security Warning</DialogTitle>
      <DialogContent>
        <Alert severity="error">
          This skill has been flagged for potentially dangerous behavior.
        </Alert>
        <p>Reasons: {skill.lintWarnings.map(w => w.message).join(', ')}</p>
      </DialogContent>
      <DialogActions>
        <Button>Cancel (Recommended)</Button>
        <Button color="error" variant="outlined">Install At My Own Risk</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Platform-Side Mitigation (Rate Limiting)**

Ensure the platform cron job has rate limiting to prevent infinite loops on broken repos.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(security): add dangerous tool detection and UI interstitials"
```

---

## Chunk 11: Deployment & Operations

**Files:**
- Create: `docker-compose.yml`
- Create: `.github/workflows/deploy-platform.yml`

- [ ] **Step 1: Platform Containerization**

```yaml
# docker-compose.yml
version: '3.8'
services:
  skilldeck-platform:
    build: ./skilldeck-platform
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/skilldeck
      - OLLAMA_HOST=http://ollama:11434
    depends_on:
      - db
      - ollama

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
```

- [ ] **Step 2: Client Release Pipeline**

Configure Tauri updater to push the new `skilldeck-lint` binary automatically.

- [ ] **Step 3: Monitoring Dashboard**

Create a Grafana dashboard to monitor:
- LLM Enrichment Queue Depth
- Lint Cron Execution Time
- Client Sync API Latency

- [ ] **Step 4: Final Commit**

```bash
git commit -m "chore: add deployment config and monitoring"
```

---

## 🏁 Final Summary

This plan now covers the entire lifecycle:
1.  **Crate Creation** (The Engine)
2.  **Integration** (The Bridge)
3.  **Platform Services** (The Source)
4.  **Client UI** (The Experience)
5.  **Source Management** (The Mental Model)
6.  **Sync** (The Connection)
7.  **Config** (The Control)
8.  **Installation/Conflict** (The Workflow)
9.  **Testing** (The Validation)
10. **Risk Mitigation** (The Safety)
11. **Deployment** (The Reality)
