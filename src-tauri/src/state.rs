//! Application state management.
//!
//! `AppState` is constructed once during Tauri setup and shared via `Arc`
//! across every command handler.  It intentionally holds *only* things that
//! cannot live inside `skilldeck-core`'s `Registry` — i.e. OS-level concerns
//! such as the approval gate (oneshot channels) and the keyring handle.

use std::sync::Arc;
use tauri::Manager;
use tracing::info;

use skilldeck_core::{agent::tool_dispatcher::ApprovalGate, db::open_db, Registry, SeaOrmDatabase};

/// Top-level shared application state injected into every Tauri command.
pub struct AppState {
    /// Core registry: DB connection + provider map + MCP/skill registries.
    pub registry: Arc<Registry>,
    /// Async approval gate: suspends agent tasks awaiting user approval.
    pub approval_gate: Arc<ApprovalGate>,
}

impl AppState {
    /// Build `AppState` from a running `AppHandle`.
    ///
    /// Called exactly once inside the Tauri `setup` closure.
    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("skilldeck.db");
        let db_url = db_path.to_string_lossy().to_string();
        info!("Database path: {}", db_url);

        let conn = open_db(&db_url, true).await?;
        let db = SeaOrmDatabase::new(conn);

        let registry = Arc::new(Registry::new(db));
        let approval_gate = Arc::new(ApprovalGate::new());

        Ok(Self {
            registry,
            approval_gate,
        })
    }
}
