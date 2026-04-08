//! Workspace Tauri commands.

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::{path::PathBuf, sync::Arc};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_core::workspace::context::ContextLoader;
use skilldeck_models::workspaces::{self, Entity as Workspaces};

#[derive(Debug, Clone, Serialize, Type)]
pub struct WorkspaceData {
    pub id: String,
    pub path: String,
    pub name: String,
    pub project_type: String,
    pub is_open: bool,
    pub context_files: Vec<String>, // <-- new field
    pub indexed_file_count: u64,    // <-- new field
}

/// Detect and open a workspace at the given path.
/// If the workspace already exists in the DB, it is reopened (updated) instead of inserted.
#[specta]
#[tauri::command]
pub async fn open_workspace(
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<WorkspaceData, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let path_buf = PathBuf::from(&path);

    // Use ContextLoader to load workspace metadata.
    let context = ContextLoader::load(&path_buf)
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().fixed_offset();

    // Check if a workspace with this path already exists.
    let existing = Workspaces::find()
        .filter(workspaces::Column::Path.eq(&path))
        .one(db)
        .await
        .map_err(|e| e.to_string())?;

    let (id, _is_new) = if let Some(row) = existing {
        let id = row.id;
        // Reopen: update is_open and last_opened_at
        let mut active: workspaces::ActiveModel = row.into();
        active.is_open = Set(true);
        active.last_opened_at = Set(Some(now));
        active.update(db).await.map_err(|e| e.to_string())?;
        (id, false)
    } else {
        // Insert new workspace
        let id = Uuid::new_v4();
        let name = context
            .root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("workspace")
            .to_string();

        let model = workspaces::ActiveModel {
            id: Set(id),
            path: Set(path.clone()),
            name: Set(name.clone()),
            project_type: Set(Some(context.project_type.to_string())),
            is_open: Set(true),
            created_at: Set(now),
            last_opened_at: Set(Some(now)),
        };
        model.insert(db).await.map_err(|e| e.to_string())?;
        (id, true)
    };

    // Gather context files (first 10 for preview)
    let context_files: Vec<String> = context
        .context_files
        .iter()
        .take(10)
        .map(|f| f.name.clone())
        .collect();

    let indexed_file_count = context.context_files.len() as u64;

    Ok(WorkspaceData {
        id: id.to_string(),
        path,
        name: context
            .root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("workspace")
            .to_string(),
        project_type: context.project_type.to_string(),
        is_open: true,
        context_files,
        indexed_file_count,
    })
}

/// Mark a workspace as closed.
#[specta]
#[tauri::command]
pub async fn close_workspace(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = Workspaces::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workspace {id} not found"))?;

    let mut active: workspaces::ActiveModel = row.into();
    active.is_open = Set(false);
    active.last_opened_at = Set(Some(chrono::Utc::now().fixed_offset()));
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// List all workspaces (both open and closed)
#[specta]
#[tauri::command]
pub async fn list_workspaces(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<WorkspaceData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let rows = Workspaces::find()
        .order_by_desc(workspaces::Column::LastOpenedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::with_capacity(rows.len());
    for r in rows {
        // For listing, we don't have the context files loaded – we could optionally load them again,
        // but for simplicity we return empty lists and let the UI fetch fresh data when needed.
        result.push(WorkspaceData {
            id: r.id.to_string(),
            path: r.path.clone(),
            name: r.name,
            project_type: r.project_type.unwrap_or_else(|| "generic".to_string()),
            is_open: r.is_open,
            context_files: Vec::new(),
            indexed_file_count: 0,
        });
    }
    Ok(result)
}
// src-tauri/src/commands/workspace.rs
// Add this new command at the end of the file, before the closing of the module

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GitStatus {
    pub is_git_repo: bool,
    pub has_uncommitted: bool,
}

/// Check if the given workspace path is a git repository and whether it has uncommitted changes.
#[specta]
#[tauri::command]
pub async fn check_git_status(workspace_path: String) -> Result<GitStatus, String> {
    let is_git_repo = std::process::Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&workspace_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let has_uncommitted = if is_git_repo {
        std::process::Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&workspace_path)
            .output()
            .map(|o| !o.stdout.is_empty())
            .unwrap_or(false)
    } else {
        false
    };

    Ok(GitStatus {
        is_git_repo,
        has_uncommitted,
    })
}
#[specta]
#[tauri::command]
pub async fn git_init(path: String) -> Result<(), String> {
    std::process::Command::new("git")
        .arg("init")
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git init: {}", e))?;
    Ok(())
}
