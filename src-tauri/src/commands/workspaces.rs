//! Workspace Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
use serde::Serialize;
use std::{path::PathBuf, sync::Arc};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_core::workspace::context::ContextLoader;
use skilldeck_models::workspaces::{self, Entity as Workspaces};

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceData {
    pub id: String,
    pub path: String,
    pub name: String,
    pub project_type: String,
    pub is_open: bool,
}

/// Detect and open a workspace at the given path, persisting it in the DB.
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

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    // Extract a display name from the last component of the path.
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
        ..Default::default()
    };
    model.insert(db).await.map_err(|e| e.to_string())?;

    Ok(WorkspaceData {
        id: id.to_string(),
        path,
        name,
        project_type: context.project_type.to_string(),
        is_open: true,
    })
}

/// Mark a workspace as closed.
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
