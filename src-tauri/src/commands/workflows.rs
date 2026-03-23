// src-tauri/src/commands/workflows.rs
//! Workflow definition Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryOrder};
use serde::{Deserialize, Serialize};
use skilldeck_core::workflow::{WorkflowDefinition, WorkflowExecutor};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::events::WorkflowEvent;
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

/// Run a workflow definition and emit events.
#[specta]
#[tauri::command]
pub async fn run_workflow_definition(
    state: State<'_, std::sync::Arc<AppState>>,
    id: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let def = skilldeck_models::workflow_definitions::Entity::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow definition {} not found", id))?;

    let definition: WorkflowDefinition =
        serde_json::from_value(def.definition_json).map_err(|e| e.to_string())?;

    let (tx, mut rx) = tokio::sync::mpsc::channel::<skilldeck_core::workflow::WorkflowEvent>(128);

    let provider_id = "ollama".to_string();
    let provider = state
        .registry
        .get_provider(&provider_id)
        .ok_or_else(|| format!("Provider {} not available", provider_id))?;
    let model_id = skilldeck_core::providers::OllamaProvider::fetch_installed_models()
        .await
        .into_iter()
        .next()
        .map(|m| m.id)
        .unwrap_or_else(|| "llama3.2:latest".to_string());

    let executor = WorkflowExecutor::with_provider(
        tx,
        provider,
        model_id,
        state.config.agent.max_eval_opt_iterations,
    );

    let execution_id = Uuid::new_v4();
    let execution_id_str = execution_id.to_string();
    let app_handle = state.app_handle.clone();

    tokio::spawn(async move {
        let _ = executor.execute(definition).await;
        while let Some(event) = rx.recv().await {
            // Convert core event to Tauri event with proper string conversions
            let tauri_event = match event {
                skilldeck_core::workflow::WorkflowEvent::Started { id } => {
                    WorkflowEvent::Started { id: id.to_string() }
                }
                skilldeck_core::workflow::WorkflowEvent::StepStarted {
                    workflow_id,
                    step_id,
                } => WorkflowEvent::StepStarted {
                    workflow_id: workflow_id.to_string(),
                    step_id,
                },
                skilldeck_core::workflow::WorkflowEvent::StepCompleted {
                    workflow_id,
                    step_id,
                    result,
                } => WorkflowEvent::StepCompleted {
                    workflow_id: workflow_id.to_string(),
                    step_id,
                    result,
                },
                skilldeck_core::workflow::WorkflowEvent::StepFailed {
                    workflow_id,
                    step_id,
                    error,
                } => WorkflowEvent::StepFailed {
                    workflow_id: workflow_id.to_string(),
                    step_id,
                    error,
                },
                skilldeck_core::workflow::WorkflowEvent::Completed { id } => {
                    WorkflowEvent::Completed { id: id.to_string() }
                }
                skilldeck_core::workflow::WorkflowEvent::Failed { id, error } => {
                    WorkflowEvent::Failed {
                        id: id.to_string(),
                        message: error,
                    }
                }
            };
            let _ = app_handle.emit("workflow-event", tauri_event);
        }
    });

    Ok(execution_id_str)
}
