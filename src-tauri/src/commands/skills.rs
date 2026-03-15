//! Skill-related Tauri commands.
//!
//! Extends the existing list/toggle commands with:
//! - lint_skill / lint_all_local_sources
//! - install_skill / uninstall_skill
//! - source management (add/remove/list)
//! - registry skill fetching (platform proxy)
//! - config management (disable rule)
//! - diff for conflict resolution

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_lint::{LintConfig, LintWarning, lint_skill as do_lint};

// ── Existing commands (list/toggle) ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub source: String,
    pub path: Option<String>,
}

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
            path: s.disk_path.map(|p| p.to_string_lossy().into_owned()), // <-- fixed
        })
        .collect())
}

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
#[tauri::command]
pub async fn lint_skill(
    state: State<'_, Arc<AppState>>,
    path: PathBuf,
    workspace_config_path: Option<PathBuf>,
) -> Result<Vec<LintWarning>, String> {
    let base_config = state.lint_config.read().await.clone();
    // Merge workspace config on top of the global one if provided.
    let config = if let Some(ws_path) = workspace_config_path {
        LintConfig::from_files(None, Some(&ws_path)).unwrap_or(base_config)
    } else {
        base_config
    };

    let result = tokio::task::spawn_blocking(move || do_lint(&path, &config))
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Lint all known local skill source directories.
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
                // Use source_type as key prefix (since label is gone)
                results.insert(format!("{}:{}", source.source_type, skill_name), warnings);
            }
        }
    }
    Ok(results)
}

/// Get all available lint rule IDs.
#[tauri::command]
pub async fn get_lint_rules() -> Result<Vec<String>, String> {
    Ok(skilldeck_lint::rules::all_rules()
        .iter()
        .map(|r| r.id().to_string())
        .collect())
}

// ── Installation commands ─────────────────────────────────────────────────────

use crate::skills::installer::{InstallResult, InstallTarget, install_skill as do_install};

/// Install a skill into the personal or workspace location.
#[tauri::command]
pub async fn install_skill(
    skill_name: String,
    skill_content: String,
    target: InstallTarget,
) -> Result<InstallResult, String> {
    tokio::task::spawn_blocking(move || {
        do_install(&skill_name, &skill_content, &target).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Uninstall a locally installed skill.
#[tauri::command]
pub async fn uninstall_skill(skill_name: String, target: InstallTarget) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::skills::installer::uninstall_skill(&skill_name, &target).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Diff / conflict resolution ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DiffResult {
    pub diff: String,
    pub has_changes: bool,
}

/// Compute a unified diff between the locally installed skill and a registry version.
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

    // Produce a simple line-by-line diff representation.
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

    // Simple unified-like diff (not a full Myers diff — sufficient for UI display).
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfigScope {
    Global,
    Workspace,
}

/// Disable a lint rule by adding it to the TOML config file.
#[tauri::command]
pub async fn disable_lint_rule(
    state: State<'_, Arc<AppState>>,
    rule_id: String,
    scope: ConfigScope,
) -> Result<(), String> {
    let config_path = match scope {
        ConfigScope::Global => dirs::config_dir()
            .ok_or("Cannot find config dir")?
            .join("skilldeck")
            .join("skilldeck-lint.toml"),
        ConfigScope::Workspace => std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(".skilldeck")
            .join("skilldeck-lint.toml"),
    };

    // Read existing config or start fresh.
    let mut content = if config_path.exists() {
        tokio::fs::read_to_string(&config_path)
            .await
            .unwrap_or_default()
    } else {
        String::from("[defaults]\nseverity = \"warning\"\n\n[rules]\n")
    };

    // Append the rule override if not already present.
    let rule_entry = format!("\"{}\" = \"off\"", rule_id);
    if !content.contains(&rule_entry) {
        if !content.contains("[rules]") {
            content.push_str("\n[rules]\n");
        }
        content.push_str(&format!("{}\n", rule_entry));
    }

    // Write back.
    if let Some(parent) = config_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&config_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    // Reload the in-memory global config.
    if matches!(scope, ConfigScope::Global) {
        if let Ok(new_config) = LintConfig::from_files(Some(&config_path), None) {
            *state.lint_config.write().await = new_config;
        }
    }

    Ok(())
}

// ── Source management ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSourceInfo {
    pub id: String,
    pub source_type: String, // "local_path" | "registry"
    pub path: String,
    pub label: Option<String>,
}

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
            label: None, // no label in DB
        })
        .collect())
}

#[tauri::command]
pub async fn add_skill_source(
    state: State<'_, Arc<AppState>>,
    source_type: String,
    path: String,
    label: Option<String>, // kept for API, but ignored
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
        priority: Set(0),   // default priority
        enabled: Set(true), // default enabled
        created_at: Set(now),
        ..Default::default()
    };
    active.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}
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
