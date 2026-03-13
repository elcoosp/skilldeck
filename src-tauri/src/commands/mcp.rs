//! MCP server Tauri commands.

use sea_orm::EntityTrait;
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, State};
use uuid::Uuid;

use crate::{
    events::{McpEvent, McpToolInfo},
    state::AppState,
};
use skilldeck_core::mcp::McpServerConfig;
use skilldeck_models::mcp_servers::Entity as McpServers;

#[derive(Debug, Clone, Serialize)]
pub struct McpServerData {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub status: String,
    pub tools: Vec<McpToolData>,
}

#[derive(Debug, Clone, Serialize)]
pub struct McpToolData {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// List all configured MCP servers with their live status.
#[tauri::command]
pub async fn list_mcp_servers(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<McpServerData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let rows = McpServers::find()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mcp_registry = &state.registry.mcp_registry;
    let mut result = Vec::with_capacity(rows.len());

    for row in rows {
        let server_id = row.id;
        let status = mcp_registry
            .get(server_id)
            .map(|s| {
                if s.status == skilldeck_core::mcp::ServerStatus::Connected {
                    "connected"
                } else {
                    "disconnected"
                }
            })
            .unwrap_or("disconnected");

        let tools = mcp_registry
            .get(server_id)
            .map(|s| s.tools)
            .unwrap_or_default()
            .into_iter()
            .map(|t| McpToolData {
                name: t.name,
                description: t.description,
                input_schema: t.input_schema,
            })
            .collect();

        result.push(McpServerData {
            id: server_id.to_string(),
            name: row.name,
            transport: row.transport,
            status: status.to_string(),
            tools,
        });
    }

    Ok(result)
}

/// Attempt to connect to an MCP server by its DB id.
#[tauri::command]
pub async fn connect_mcp_server(
    state: State<'_, Arc<AppState>>,
    id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = McpServers::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("MCP server {id} not found"))?;

    // Construct config from database row
    let config = McpServerConfig {
        transport: row.transport,
        config: row.config_json, // assume config_json is already serde_json::Value
    };

    state
        .registry
        .mcp_registry
        .connect(uuid, config)
        .await
        .map_err(|e| e.to_string())?;

    // Announce newly available tools.
    if let Some(server) = state.registry.mcp_registry.get(uuid) {
        for tool in server.tools {
            let _ = app.emit(
                "mcp-event",
                McpEvent::ToolDiscovered {
                    server: row.name.clone(),
                    tool: McpToolInfo {
                        name: tool.name,
                        description: tool.description,
                    },
                },
            );
        }
    }

    let _ = app.emit("mcp-event", McpEvent::ServerConnected { name: row.name });
    Ok(())
}

/// Disconnect an MCP server by its DB id.
#[tauri::command]
pub async fn disconnect_mcp_server(
    state: State<'_, Arc<AppState>>,
    id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = McpServers::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("MCP server {id} not found"))?;

    let name = row.name.clone();

    state.registry.mcp_registry.disconnect(uuid);

    let _ = app.emit("mcp-event", McpEvent::ServerDisconnected { name });
    Ok(())
}
