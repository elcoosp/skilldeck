// src-tauri/src/commands/skills.rs
//! Skill-related Tauri commands.
//!
//! Extends the existing list/toggle commands with:
//! - sync_registry_skills
//! - fetch_registry_skills
//! - lint commands, installation, source management, etc.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, Condition, EntityTrait, QueryFilter,
    QueryOrder,
};
use serde::{Deserialize, Serialize};
use skilldeck_lint::LintWarning;
use specta::{Type, specta};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use crate::sync::skill_sync::sync_registry_skills as do_sync;
use skilldeck_lint::{LintConfig, lint_skill as do_lint};

// ── Existing commands (list/toggle) ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Type)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub source: String,
    pub path: Option<String>,
    pub lint_warnings: Vec<LintWarning>,
    pub security_score: u8,
    pub quality_score: u8,
}

#[specta]
#[tauri::command]
pub async fn list_skills(state: State<'_, Arc<AppState>>) -> Result<Vec<SkillInfo>, String> {
    let skills = state.registry.skill_registry.skills().await;
    Ok(skills
        .into_iter()
        .map(|s| SkillInfo {
            name: s.name,
            description: s.description,
            is_active: s.is_active,
            source: s.source,
            path: s.disk_path.map(|p| p.to_string_lossy().into_owned()),
            lint_warnings: s.lint_warnings.unwrap_or_default(),
            security_score: s.security_score,
            quality_score: s.quality_score,
        })
        .collect())
}

#[specta]
#[tauri::command]
pub async fn toggle_skill(
    state: State<'_, Arc<AppState>>,
    name: String,
    active: bool,
) -> Result<(), String> {
    state
        .registry
        .skill_registry
        .set_enabled(&name, active)
        .await
        .map_err(|e: skilldeck_core::CoreError| e.to_string())
}

// ── Lint commands ─────────────────────────────────────────────────────────────

/// Lint a single skill directory, merging workspace config if present.
#[specta]
#[tauri::command]
pub async fn lint_skill(
    state: State<'_, Arc<AppState>>,
    path: PathBuf,
    workspace_config_path: Option<PathBuf>,
) -> Result<Vec<LintWarning>, String> {
    // Read the global config from the shared state.
    let global_config = state.lint_config.read().await.clone();

    // If a workspace config path is provided, merge it on top.
    let final_config = if let Some(ws_path) = workspace_config_path {
        LintConfig::from_files(None, Some(&ws_path)).unwrap_or(global_config)
    } else {
        global_config
    };

    let result = tokio::task::spawn_blocking(move || do_lint(&path, &final_config))
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Lint all known local skill source directories.
#[specta]
#[tauri::command]
pub async fn lint_all_local_sources(
    state: State<'_, Arc<AppState>>,
) -> Result<HashMap<String, Vec<LintWarning>>, String> {
    use skilldeck_models::skill_source_dirs::Entity as SkillSourceDirs;
    use tokio::fs;

    let config = state.lint_config.read().await.clone();
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let sources = SkillSourceDirs::find()
        .filter(skilldeck_models::skill_source_dirs::Column::Enabled.eq(true))
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = HashMap::new();
    for source in sources {
        let dir_path = std::path::PathBuf::from(&source.path);
        if !dir_path.exists() {
            continue;
        }
        let mut entries = fs::read_dir(&dir_path).await.map_err(|e| e.to_string())?;
        while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
            let path = entry.path();
            if path.is_dir() {
                let skill_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                let config_clone = config.clone();
                let path_clone = path.clone();
                let warnings =
                    tokio::task::spawn_blocking(move || do_lint(&path_clone, &config_clone))
                        .await
                        .unwrap_or_default();
                results.insert(format!("{}:{}", source.source_type, skill_name), warnings);
            }
        }
    }
    Ok(results)
}

/// Get all available lint rule IDs.
#[specta]
#[tauri::command]
pub async fn get_lint_rules() -> Result<Vec<String>, String> {
    Ok(skilldeck_lint::rules::all_rules()
        .iter()
        .map(|r| r.id().to_string())
        .collect())
}

// ── Installation commands ─────────────────────────────────────────────────────

use crate::skills::installer::{InstallResult, InstallTarget, install_skill as do_install};

/// Validate skill name – only allow alphanumeric, underscore, hyphen.
fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Skill name cannot be empty".to_string());
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Skill name contains invalid characters (only letters, numbers, underscores, and hyphens allowed)".to_string());
    }
    Ok(())
}

/// Install a skill into the personal or workspace location.
#[specta]
#[tauri::command]
pub async fn install_skill(
    skill_name: String,
    skill_content: String,
    target: InstallTarget,
    overwrite: Option<bool>,
) -> Result<InstallResult, String> {
    validate_skill_name(&skill_name)?;
    tokio::task::spawn_blocking(move || {
        if overwrite.unwrap_or(false) {
            // If overwrite is true, we need to remove existing first
            let target_dir =
                crate::skills::installer::resolve_target_dir(&target).map_err(|e| e.to_string())?;
            let dest_path = target_dir.join(&skill_name);
            if dest_path.exists() {
                std::fs::remove_dir_all(&dest_path).map_err(|e| e.to_string())?;
            }
        }
        do_install(&skill_name, &skill_content, &target).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Uninstall a locally installed skill.
#[specta]
#[tauri::command]
pub async fn uninstall_skill(skill_name: String, target: InstallTarget) -> Result<(), String> {
    validate_skill_name(&skill_name)?;
    tokio::task::spawn_blocking(move || {
        crate::skills::installer::uninstall_skill(&skill_name, &target).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Conflict resolution helpers ───────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_installed_skill_content(
    skill_name: String,
    target: InstallTarget,
) -> Result<Option<String>, String> {
    use crate::skills::installer::read_local_skill;
    match read_local_skill(&skill_name, &target) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.to_string().contains("not installed") => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[specta]
#[tauri::command]
pub async fn get_installed_skill_path(
    skill_name: String,
    target: InstallTarget,
) -> Result<Option<String>, String> {
    use crate::skills::installer::resolve_target_dir;
    let target_dir = resolve_target_dir(&target).map_err(|e| e.to_string())?;
    let skill_path = target_dir.join(&skill_name);
    if skill_path.exists() {
        Ok(Some(skill_path.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

// ── Diff / conflict resolution ────────────────────────────────────────────────

#[derive(Debug, Serialize, Type)]
pub struct DiffResult {
    pub diff: String,
    pub has_changes: bool,
}

/// Compute a unified diff between the locally installed skill and a registry version.
#[specta]
#[tauri::command]
pub async fn diff_skill_versions(
    local_path: PathBuf,
    registry_content: String,
) -> Result<DiffResult, String> {
    let local_content = tokio::fs::read_to_string(&local_path.join("SKILL.md"))
        .await
        .unwrap_or_default();

    if local_content == registry_content {
        return Ok(DiffResult {
            diff: String::new(),
            has_changes: false,
        });
    }

    let diff = produce_simple_diff(&local_content, &registry_content);
    Ok(DiffResult {
        diff,
        has_changes: true,
    })
}

fn produce_simple_diff(old: &str, new: &str) -> String {
    let mut output = String::new();
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    let max = old_lines.len().max(new_lines.len());
    for i in 0..max {
        match (old_lines.get(i), new_lines.get(i)) {
            (Some(o), Some(n)) if o == n => {
                output.push_str(&format!("  {}\n", o));
            }
            (Some(o), Some(n)) => {
                output.push_str(&format!("- {}\n", o));
                output.push_str(&format!("+ {}\n", n));
            }
            (Some(o), None) => {
                output.push_str(&format!("- {}\n", o));
            }
            (None, Some(n)) => {
                output.push_str(&format!("+ {}\n", n));
            }
            (None, None) => {}
        }
    }
    output
}

// ── Lint config management ────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ConfigScope {
    Global,
    Workspace,
}

/// Disable a lint rule by adding it to the TOML config file.
#[specta]
#[tauri::command]
pub async fn disable_lint_rule(
    state: State<'_, Arc<AppState>>,
    rule_id: String,
    scope: ConfigScope,
) -> Result<(), String> {
    let config_path = match scope {
        ConfigScope::Global => dirs_next::config_dir()
            .ok_or("Cannot find config dir")?
            .join("skilldeck")
            .join("skilldeck-lint.toml"),
        ConfigScope::Workspace => std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(".skilldeck")
            .join("skilldeck-lint.toml"),
    };

    let mut content = if config_path.exists() {
        tokio::fs::read_to_string(&config_path)
            .await
            .unwrap_or_default()
    } else {
        String::from("[defaults]\nseverity = \"warning\"\n\n[rules]\n")
    };

    let rule_entry = format!("\"{}\" = \"off\"", rule_id);
    if !content.contains(&rule_entry) {
        if !content.contains("[rules]") {
            content.push_str("\n[rules]\n");
        }
        content.push_str(&format!("{}\n", rule_entry));
    }

    if let Some(parent) = config_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&config_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    if matches!(scope, ConfigScope::Global)
        && let Ok(new_config) = LintConfig::from_files(Some(&config_path), None)
    {
        *state.lint_config.write().await = new_config;
    }

    Ok(())
}

// ── Source management ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillSourceInfo {
    pub id: String,
    pub source_type: String, // "local_path" | "registry"
    pub path: String,
    pub label: Option<String>,
}

#[specta]
#[tauri::command]
pub async fn list_skill_sources(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SkillSourceInfo>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use skilldeck_models::skill_source_dirs::Entity as SkillSourceDirs;
    let rows = SkillSourceDirs::find()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| SkillSourceInfo {
            id: r.id.to_string(),
            source_type: r.source_type,
            path: r.path,
            label: None,
        })
        .collect())
}

#[specta]
#[tauri::command]
pub async fn add_skill_source(
    state: State<'_, Arc<AppState>>,
    source_type: String,
    path: String,
    _label: Option<String>, // kept for API compatibility, but ignored
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use skilldeck_models::skill_source_dirs::ActiveModel;
    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();
    let active = ActiveModel {
        id: Set(id),
        source_type: Set(source_type),
        path: Set(path),
        priority: Set(0),
        enabled: Set(true),
        created_at: Set(now),
    };
    active.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

#[specta]
#[tauri::command]
pub async fn remove_skill_source(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    use skilldeck_models::skill_source_dirs::Entity as SkillSourceDirs;
    SkillSourceDirs::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Registry sync commands ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySkillData {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: String,
    pub source_url: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub lint_warnings: Vec<serde_json::Value>,
    pub security_score: i32,
    pub quality_score: i32,
    pub metadata_source: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<skilldeck_models::registry_skills::Model> for RegistrySkillData {
    fn from(m: skilldeck_models::registry_skills::Model) -> Self {
        Self {
            id: m.id.to_string(),
            name: m.name,
            description: m.description,
            source: m.source,
            source_url: m.source_url,
            version: m.version,
            author: m.author,
            license: m.license,
            tags: m
                .tags
                .and_then(|j| serde_json::from_value(j).ok())
                .unwrap_or_default(),
            category: m.category,
            lint_warnings: m
                .lint_warnings
                .and_then(|j| serde_json::from_value(j).ok())
                .unwrap_or_default(),
            security_score: m.security_score,
            quality_score: m.quality_score,
            metadata_source: m.metadata_source,
            content: m.content,
            created_at: m.synced_at.to_rfc3339(),
            updated_at: m.synced_at.to_rfc3339(),
        }
    }
}

/// Background-friendly sync function – takes `&AppState` directly.
pub async fn sync_registry_skills_background(state: &AppState) -> Result<usize, String> {
    let client = state.platform_client.read().await;
    if !client.is_configured() {
        return Err("Platform not configured".to_string());
    }
    let platform_url = client.base_url().to_string();
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use sea_orm::EntityTrait;
    use skilldeck_models::registry_skills::Entity as RegistrySkills;

    let last_sync = RegistrySkills::find()
        .order_by_desc(skilldeck_models::registry_skills::Column::SyncedAt)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .map(|row| row.synced_at.to_rfc3339());

    let count = do_sync(db, &platform_url, last_sync.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(count)
}

/// Synchronize skills from the platform registry (Tauri command).
#[specta]
#[tauri::command]
pub async fn sync_registry_skills(state: State<'_, Arc<AppState>>) -> Result<usize, String> {
    sync_registry_skills_background(&state).await
}

/// Fetch registry skills from the local cache.
#[specta]
#[tauri::command]
pub async fn fetch_registry_skills(
    state: State<'_, Arc<AppState>>,
    category: Option<String>,
    search: Option<String>,
) -> Result<Vec<RegistrySkillData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    use sea_orm::QueryFilter;
    use skilldeck_models::registry_skills::{Column, Entity as RegistrySkills};

    let mut query = RegistrySkills::find();
    if let Some(cat) = category {
        query = query.filter(Column::Category.eq(cat));
    }
    if let Some(term) = search {
        let pattern = format!("%{}%", term);
        query = query.filter(
            Condition::any()
                .add(Column::Name.like(&pattern))
                .add(Column::Description.like(&pattern)),
        );
    }
    let skills = query.all(db).await.map_err(|e| e.to_string())?;
    Ok(skills.into_iter().map(Into::into).collect())
}

/// Install a skill from the registry by ID.
#[specta]
#[tauri::command]
pub async fn install_registry_skill(
    state: State<'_, Arc<AppState>>,
    skill_id: String,
    target: InstallTarget,
    overwrite: Option<bool>,
) -> Result<InstallResult, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use skilldeck_models::registry_skills::Entity as RegistrySkills;
    let uuid = Uuid::parse_str(&skill_id).map_err(|e| e.to_string())?;

    let skill = RegistrySkills::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Skill not found in registry".to_string())?;

    install_skill(skill.name, skill.content, target, overwrite).await
}
