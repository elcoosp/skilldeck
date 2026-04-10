//! Workspace Tauri commands.
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::pin::Pin;
use std::{path::PathBuf, sync::Arc};
use tauri::State;
use tokio::fs;
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
    pub avatar_style: String,
    pub context_files: Vec<String>, // <-- new field
    pub indexed_file_count: u64,    // <-- new field
}
#[specta]
#[tauri::command]
pub async fn update_workspace(
    state: State<'_, Arc<AppState>>,
    id: Uuid,
    avatar_style: Option<String>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let workspace = Workspaces::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workspace {id} not found"))?;

    let mut active: workspaces::ActiveModel = workspace.into();
    if let Some(avatar_style) = avatar_style {
        active.avatar_style = Set(avatar_style);
    }
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
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

    let (id, avatar_style) = if let Some(row) = existing {
        let id = row.id;
        let avatar_style = row.avatar_style.clone(); // Preserve existing style
        // Reopen: update is_open and last_opened_at
        let mut active: workspaces::ActiveModel = row.into();
        active.is_open = Set(true);
        active.last_opened_at = Set(Some(now));
        active.update(db).await.map_err(|e| e.to_string())?;
        (id, avatar_style)
    } else {
        // Insert new workspace
        let id = Uuid::new_v4();
        let default_style = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)".to_string();
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
            avatar_style: Set(default_style.clone()),
        };
        model.insert(db).await.map_err(|e| e.to_string())?;
        (id, default_style)
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
        avatar_style, // Now correctly uses the stored style for existing workspaces
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
            avatar_style: r.avatar_style,
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileEntry>,
}

/// Recursively read a directory up to a maximum depth.
fn read_dir_recursive<'a>(
    path: &'a std::path::Path,
    max_depth: u32,
    current_depth: u32,
) -> Pin<Box<dyn Future<Output = Result<Vec<FileEntry>, String>> + Send + 'a>> {
    Box::pin(async move {
        if current_depth > max_depth {
            return Ok(Vec::new());
        }

        let mut entries = Vec::new();

        let mut dir_entries = fs::read_dir(path)
            .await
            .map_err(|e| format!("Failed to read directory {}: {}", path.display(), e))?;

        while let Ok(Some(entry)) = dir_entries.next_entry().await {
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and directories (e.g., .git, .env, .vscode)
            if file_name.starts_with('.') {
                continue;
            }

            let entry_path = entry.path();
            let metadata = entry.metadata().await.map_err(|e| {
                format!(
                    "Failed to read metadata for {}: {}",
                    entry_path.display(),
                    e
                )
            })?;

            let is_dir = metadata.is_dir();

            let children = if is_dir {
                read_dir_recursive(&entry_path, max_depth, current_depth + 1).await?
            } else {
                Vec::new()
            };

            entries.push(FileEntry {
                name: file_name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                children,
            });
        }

        // Sort: Folders first, then alphabetically case-insensitive
        entries.sort_by(|a, b| {
            if a.is_dir && !b.is_dir {
                std::cmp::Ordering::Less
            } else if !a.is_dir && b.is_dir {
                std::cmp::Ordering::Greater
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        Ok(entries)
    })
}

/// List files and folders in a workspace directory up to a specified depth.
#[specta]
#[tauri::command]
pub async fn list_workspace_files(
    workspace_path: String, // Tauri automatically maps from camelCase in TS
    max_depth: Option<u32>,
) -> Result<Vec<FileEntry>, String> {
    let path = std::path::Path::new(&workspace_path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", workspace_path));
    }

    let max_depth = max_depth.unwrap_or(4);

    read_dir_recursive(path, max_depth, 0).await
}
