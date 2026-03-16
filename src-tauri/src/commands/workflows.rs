//! Workflow definition Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryOrder};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::workflow_definitions::{self, Entity as WorkflowDefs};

#[derive(Debug, Deserialize, Type)]
pub struct SaveWorkflowDefinitionRequest {
    pub name: String,
    pub definition: serde_json::Value,
}

#[derive(Debug, Serialize, Type)]
pub struct WorkflowDefinitionResponse {
    pub id: String,
    pub name: String,
    pub definition: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

/// Save a new workflow definition.
#[specta]
#[tauri::command]
pub async fn save_workflow_definition(
    state: State<'_, Arc<AppState>>,
    req: SaveWorkflowDefinitionRequest,
) -> Result<WorkflowDefinitionResponse, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = workflow_definitions::ActiveModel {
        id: Set(id),
        name: Set(req.name.clone()),
        definition_json: Set(req.definition.clone()),
        created_at: Set(now),
        updated_at: Set(now),
    };

    model.insert(db).await.map_err(|e| e.to_string())?;

    Ok(WorkflowDefinitionResponse {
        id: id.to_string(),
        name: req.name,
        definition: req.definition,
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
    })
}

/// List all workflow definitions.
#[specta]
#[tauri::command]
pub async fn list_workflow_definitions(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<WorkflowDefinitionResponse>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let defs = WorkflowDefs::find()
        .order_by_desc(workflow_definitions::Column::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(defs
        .into_iter()
        .map(|d| WorkflowDefinitionResponse {
            id: d.id.to_string(),
            name: d.name,
            definition: d.definition_json,
            created_at: d.created_at.to_rfc3339(),
            updated_at: d.updated_at.to_rfc3339(),
        })
        .collect())
}

/// Get a single workflow definition by ID.
#[specta]
#[tauri::command]
pub async fn get_workflow_definition(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<WorkflowDefinitionResponse, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let def = WorkflowDefs::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Workflow definition not found".to_string())?;

    Ok(WorkflowDefinitionResponse {
        id: def.id.to_string(),
        name: def.name,
        definition: def.definition_json,
        created_at: def.created_at.to_rfc3339(),
        updated_at: def.updated_at.to_rfc3339(),
    })
}

/// Delete a workflow definition.
#[specta]
#[tauri::command]
pub async fn delete_workflow_definition(
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

    WorkflowDefs::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
