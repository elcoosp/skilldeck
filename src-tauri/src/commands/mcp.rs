// src-tauri/src/commands/mcp.rs
//! Tauri commands for MCP server management.
use specta::{Type, specta};

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::AppState;
use skilldeck_core::CoreError;

// ── Shared response types ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Type)]
pub struct McpToolResponse {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Type)]
pub struct McpServerResponse {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub status: String,
    pub tools: Vec<McpToolResponse>,
}

// ── add_mcp_server ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AddMcpServerPayload {
    pub name: String,
    pub transport: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub url: Option<String>,
    pub env: Option<std::collections::HashMap<String, String>>,
}

#[specta]
#[tauri::command]
pub async fn add_mcp_server(
    payload: AddMcpServerPayload,
    state: State<'_, Arc<AppState>>, // Arc<AppState> — matches handle.manage(Arc::new(state))
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let config_json = match payload.transport.as_str() {
        "stdio" => {
            let command = payload
                .command
                .ok_or_else(|| "command is required for stdio transport".to_string())?;
            serde_json::json!({
                "command": command,
                "args": payload.args.unwrap_or_default(),
                "env": payload.env.unwrap_or_default(),
            })
        }
        "sse" => {
            let url = payload
                .url
                .ok_or_else(|| "url is required for sse transport".to_string())?;
            serde_json::json!({ "url": url })
        }
        other => return Err(format!("Unknown transport: {other}")),
    };

    use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};
    use skilldeck_models::mcp_servers::{ActiveModel, Column, Entity as McpServers};

    let now = chrono::Utc::now().fixed_offset();

    // If a row with the same name already exists (e.g. a previous add that
    // failed to connect), reuse it — update its config and reset its status
    // rather than hitting the UNIQUE constraint with a second insert.
    let existing = McpServers::find()
        .filter(Column::Name.eq(&payload.name))
        .one(db)
        .await
        .map_err(|e| format!("DB lookup failed: {e}"))?;

    let id = if let Some(row) = existing {
        let id = row.id;
        let mut active: ActiveModel = row.into();
        active.transport = Set(payload.transport.clone());
        active.config_json = Set(config_json.clone());
        active.status = Set("enabled".to_string());
        active.updated_at = Set(now);
        active
            .update(db)
            .await
            .map_err(|e| format!("DB update failed: {e}"))?;
        id
    } else {
        let id = Uuid::new_v4();
        let model = ActiveModel {
            id: Set(id),
            name: Set(payload.name.clone()),
            transport: Set(payload.transport.clone()),
            config_json: Set(config_json.clone()),
            status: Set("enabled".to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        model
            .insert(db)
            .await
            .map_err(|e| format!("DB insert failed: {e}"))?;
        id
    };

    let registry = &state.registry.mcp_registry;
    let mcp_config = skilldeck_core::traits::McpServerConfig {
        transport: payload.transport,
        config: config_json,
    };
    registry.add_server_with_id(id, payload.name, mcp_config);

    {
        let registry = state.registry.mcp_registry.clone();
        let db_url = state.db_url.clone();
        tokio::spawn(async move {
            if let Err(e) = connect_server_by_id(&registry, id, &db_url).await {
                tracing::warn!("Auto-connect for {id} failed: {e}");
            }
        });
    }

    Ok(id.to_string())
}

// ── remove_mcp_server ─────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn remove_mcp_server(
    id: String,
    state: State<'_, Arc<AppState>>, // Arc<AppState>
) -> Result<(), String> {
    let parsed_id: Uuid = id.parse().map_err(|e| format!("Invalid id: {e}"))?;

    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    state.registry.mcp_registry.disconnect(parsed_id);

    use sea_orm::{EntityTrait, ModelTrait};
    use skilldeck_models::mcp_servers::Entity as McpServers;

    let record = McpServers::find_by_id(parsed_id)
        .one(db)
        .await
        .map_err(|e| format!("DB find failed: {e}"))?
        .ok_or_else(|| format!("MCP server {parsed_id} not found"))?;

    record
        .delete(db)
        .await
        .map_err(|e| format!("DB delete failed: {e}"))?;

    Ok(())
}

// ── list_mcp_servers ──────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn list_mcp_servers(
    state: State<'_, Arc<AppState>>, // Arc<AppState>
) -> Result<Vec<McpServerResponse>, String> {
    let servers = state.registry.mcp_registry.list();

    Ok(servers
        .into_iter()
        .map(|s| McpServerResponse {
            id: s.id.to_string(),
            name: s.name,
            transport: "unknown".to_string(),
            status: match s.status {
                skilldeck_core::mcp::ServerStatus::Connected => "connected",
                skilldeck_core::mcp::ServerStatus::Connecting => "connecting",
                skilldeck_core::mcp::ServerStatus::Error => "error",
                skilldeck_core::mcp::ServerStatus::Failed => "failed",
                skilldeck_core::mcp::ServerStatus::Disconnected => "disconnected",
            }
            .to_string(),
            tools: s
                .tools
                .into_iter()
                .map(|t| McpToolResponse {
                    name: t.name,
                    description: t.description,
                    input_schema: t.input_schema,
                })
                .collect(),
        })
        .collect())
}

// ── connect_mcp_server ────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn connect_mcp_server(
    id: String,
    state: State<'_, Arc<AppState>>, // Arc<AppState>
) -> Result<(), String> {
    let parsed_id: Uuid = id.parse().map_err(|e| format!("Invalid id: {e}"))?;

    connect_server_by_id(&state.registry.mcp_registry, parsed_id, &state.db_url)
        .await
        .map_err(|e| e.to_string())
}

// ── disconnect_mcp_server ─────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn disconnect_mcp_server(
    id: String,
    state: State<'_, Arc<AppState>>, // Arc<AppState>
) -> Result<(), String> {
    let parsed_id: Uuid = id.parse().map_err(|e| format!("Invalid id: {e}"))?;

    state.registry.mcp_registry.disconnect(parsed_id);
    Ok(())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async fn connect_server_by_id(
    registry: &std::sync::Arc<skilldeck_core::mcp::McpRegistry>,
    id: Uuid,
    db_url: &str,
) -> Result<(), CoreError> {
    let db = skilldeck_core::open_db(db_url, false).await?;

    use sea_orm::EntityTrait;
    use skilldeck_models::mcp_servers::Entity as McpServers;

    let record = McpServers::find_by_id(id)
        .one(&db)
        .await
        .map_err(|e| CoreError::DatabaseQuery {
            message: e.to_string(),
        })?
        .ok_or_else(|| CoreError::DatabaseEntityNotFound {
            entity_type: "McpServer".into(),
            id: id.to_string(),
        })?;

    let mcp_config = skilldeck_core::traits::McpServerConfig {
        transport: record.transport,
        config: record.config_json,
    };

    registry.connect(id, mcp_config).await
}
