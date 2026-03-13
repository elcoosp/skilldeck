//! Application state management.
//!
//! `AppState` is constructed once during Tauri setup and shared via `Arc`
//! across every command handler.  It intentionally holds *only* things that
//! cannot live inside `skilldeck-core`'s `Registry` — i.e. OS-level concerns
//! such as the approval gate (oneshot channels) and the keyring handle.

use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_keyring::KeyringExt;
use tracing::{info, warn};

use skilldeck_core::{
    agent::tool_dispatcher::ApprovalGate,
    db::open_db,
    providers::{ClaudeProvider, OllamaProvider, OpenAiProvider},
    Registry, SeaOrmDatabase,
};

const KEYRING_SERVICE: &str = "skilldeck";

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

        // ── Register model providers based on stored API keys ─────────────────
        //
        // `get_password` returns `Result<String, _>` — Err means no key stored.
        // Ollama is always registered as a keyless local fallback.
        let keyring = app.keyring();

        match keyring.get_password(KEYRING_SERVICE, "claude") {
            Ok(key) if !key.is_none() => {
                info!("Registering Claude provider");
                registry.register_provider(ClaudeProvider::new(key.unwrap()));
            }
            Ok(_) => warn!("Claude API key is empty — not registering"),
            Err(_) => warn!("No Claude API key stored — not registering"),
        }

        match keyring.get_password(KEYRING_SERVICE, "openai") {
            Ok(key) if !key.is_none() => {
                info!("Registering OpenAI provider");
                registry.register_provider(OpenAiProvider::new(key.unwrap()));
            }
            Ok(_) => warn!("OpenAI API key is empty — not registering"),
            Err(_) => warn!("No OpenAI API key stored — not registering"),
        }

        // Ollama is always available — no key required.
        info!("Registering Ollama provider (port 11434)");
        registry.register_provider(OllamaProvider::new(11434));

        let approval_gate = Arc::new(ApprovalGate::new());
        let state = Self {
            registry,
            approval_gate,
        };

        // ── Seed a default Ollama profile if the DB has none ──────────────────
        //
        // On a fresh install there are no profiles, so "New Chat" would fail
        // immediately with "No profile found". We create one pointing at the
        // local Ollama instance so the app is usable out of the box.
        state.ensure_default_profile().await;

        Ok(state)
    }

    /// Create a default Ollama profile if no profiles exist yet.
    async fn ensure_default_profile(&self) {
        use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
        use skilldeck_models::profiles;

        let db = match self.registry.db.connection().await {
            Ok(db) => db,
            Err(e) => {
                warn!("Could not check profiles: {}", e);
                return;
            }
        };

        let count = profiles::Entity::find()
            .all(db)
            .await
            .map(|v| v.len())
            .unwrap_or(0);

        if count > 0 {
            return;
        }

        // Pick the first installed Ollama model, fall back to a known default.
        let model_id = OllamaProvider::fetch_installed_models()
            .await
            .into_iter()
            .next()
            .map(|m| m.id)
            .unwrap_or_else(|| "llama3.2:latest".to_string());

        let now = chrono::Utc::now().fixed_offset();
        let id = uuid::Uuid::new_v4();

        let profile = profiles::ActiveModel {
            id: Set(id),
            name: Set("Local (Ollama)".to_string()),
            description: Set(Some(
                "Default local profile — no API key required".to_string(),
            )),
            model_provider: Set("ollama".to_string()),
            model_id: Set(model_id.clone()),
            is_default: Set(true),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        match profile.insert(db).await {
            Ok(_) => info!("Seeded default Ollama profile (model: {})", model_id),
            Err(e) => warn!("Failed to seed default profile: {}", e),
        }
    }
}
