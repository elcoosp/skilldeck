//! Workspace Tauri commands.
use ignore::WalkBuilder;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::{collections::HashMap, path::PathBuf, sync::Arc};
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
    pub context_files: Vec<String>,
    pub indexed_file_count: u64,
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
        avatar_style,
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

/// List files and folders in a workspace directory up to a specified depth,
/// respecting .gitignore and other ignore files.
#[specta]
#[tauri::command]
pub async fn list_workspace_files(
    workspace_path: String,
    max_depth: Option<u32>,
) -> Result<Vec<FileEntry>, String> {
    let max_depth = max_depth.unwrap_or(4);

    // Run the blocking walk on a dedicated thread pool.
    tauri::async_runtime::spawn_blocking(move || {
        // Canonicalize to an absolute path to avoid relative‑path pitfalls.
        let canonical_root = std::fs::canonicalize(&workspace_path)
            .map_err(|e| format!("Invalid workspace path '{}': {}", workspace_path, e))?;

        // Build the walker with .gitignore / .ignore support.
        let walker = WalkBuilder::new(&canonical_root)
            .standard_filters(true) // Respect .gitignore, .ignore, etc.
            .hidden(true) // Skip hidden files/directories
            .max_depth(Some(max_depth as usize))
            .build();

        // Collect all entries, skipping the root directory itself.
        let mut all_entries: Vec<FileEntry> = Vec::new();
        for result in walker {
            match result {
                Ok(entry) => {
                    // Skip the root directory; we only want its children.
                    if entry.path() == canonical_root {
                        continue;
                    }
                    let entry_path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();
                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

                    all_entries.push(FileEntry {
                        name,
                        path: entry_path.to_string_lossy().to_string(),
                        is_dir,
                        children: Vec::new(),
                    });
                }
                Err(err) => {
                    eprintln!("Walk error: {}", err);
                }
            }
        }

        // Build a map from path to index in `all_entries`.
        let mut path_to_index: HashMap<String, usize> = HashMap::new();
        for (idx, entry) in all_entries.iter().enumerate() {
            path_to_index.insert(entry.path.clone(), idx);
        }

        // Group children by parent index.
        let root_path_str = canonical_root.to_string_lossy().to_string();
        let mut root_children_indices: Vec<usize> = Vec::new();
        let mut parent_to_children: HashMap<usize, Vec<usize>> = HashMap::new();

        for (idx, entry) in all_entries.iter().enumerate() {
            let entry_path = std::path::Path::new(&entry.path);
            if let Some(parent_path) = entry_path.parent() {
                let parent_path_str = parent_path.to_string_lossy().to_string();
                if parent_path_str == root_path_str {
                    // Direct child of the workspace root.
                    root_children_indices.push(idx);
                } else if let Some(&parent_idx) = path_to_index.get(&parent_path_str) {
                    parent_to_children.entry(parent_idx).or_default().push(idx);
                } else {
                    // Parent not in our entries (e.g., ignored or above max depth).
                    // Treat as a root child to avoid losing the entry.
                    root_children_indices.push(idx);
                }
            } else {
                // Entry has no parent (should not happen for a valid file path).
                root_children_indices.push(idx);
            }
        }

        // Recursively assemble the tree.
        fn assemble_tree(
            idx: usize,
            all_entries: &mut Vec<FileEntry>,
            parent_to_children: &HashMap<usize, Vec<usize>>,
        ) -> FileEntry {
            let mut entry = all_entries[idx].clone();
            if let Some(child_indices) = parent_to_children.get(&idx) {
                let mut children: Vec<FileEntry> = child_indices
                    .iter()
                    .map(|&child_idx| assemble_tree(child_idx, all_entries, parent_to_children))
                    .collect();
                // Sort each level: directories first, then alphabetically.
                children.sort_by(|a, b| {
                    if a.is_dir && !b.is_dir {
                        std::cmp::Ordering::Less
                    } else if !a.is_dir && b.is_dir {
                        std::cmp::Ordering::Greater
                    } else {
                        a.name.to_lowercase().cmp(&b.name.to_lowercase())
                    }
                });
                entry.children = children;
            }
            entry
        }

        let mut root_entries: Vec<FileEntry> = root_children_indices
            .into_iter()
            .map(|idx| assemble_tree(idx, &mut all_entries, &parent_to_children))
            .collect();

        // Sort the root level as well.
        root_entries.sort_by(|a, b| {
            if a.is_dir && !b.is_dir {
                std::cmp::Ordering::Less
            } else if !a.is_dir && b.is_dir {
                std::cmp::Ordering::Greater
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        Ok(root_entries)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[specta]
#[tauri::command]
pub async fn list_git_status(workspace_path: String) -> Result<HashMap<String, String>, String> {
    let output = tokio::process::Command::new("git")
        .args(["status", "--porcelain", "-z"])
        .current_dir(&workspace_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err("Git command failed".to_string());
    }

    // Parse null-delimited porcelain output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut map = HashMap::new();

    // Format: XY PATH\0  (for renames: XY ORIG\0 RENAMED\0)
    let mut parts = stdout.split('\0');
    while let Some(entry) = parts.next() {
        if entry.is_empty() {
            continue;
        }

        // First two chars are status codes
        if entry.len() < 3 {
            continue;
        }
        let status = &entry[..2];
        let path = entry[3..].trim();

        // Handle renames: next part is the new path
        if status.starts_with('R') {
            if let Some(new_path) = parts.next() {
                map.insert(new_path.to_string(), "R".to_string());
            }
        } else {
            // Use the first non-space status char
            let code = if status.chars().next() == Some(' ') {
                status.chars().nth(1).unwrap().to_string()
            } else {
                status.chars().next().unwrap().to_string()
            };
            map.insert(path.to_string(), code);
        }
    }

    Ok(map)
}
