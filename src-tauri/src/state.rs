// src-tauri/src/state.rs
//! Application state management.

use dashmap::DashMap;
use sea_orm::EntityTrait;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_keyring::KeyringExt;
use tokio::sync::{RwLock, Semaphore};
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use skilldeck_core::{
    Registry, SeaOrmDatabase,
    agent::tool_dispatcher::ApprovalGate,
    db::open_db,
    mcp::{
        SseTransport, StdioTransport,
        supervisor::{SupervisorCommand, SupervisorConfig, start_supervisor},
    },
    providers::{ClaudeProvider, OllamaProvider, OpenAiProvider},
    skills::{scanner, watcher::start_registry_watcher},
    workspace::ContextLoader,
};
use skilldeck_lint::LintConfig;
use skilldeck_models::mcp_servers;

use crate::subagent_monitor::monitor_subagent;
use crate::subagent_server::SubagentServer;
use adk_rust::server::a2a::A2aClient;

const KEYRING_SERVICE: &str = "skilldeck";

/// Reload persisted MCP servers from the database into the registry.
pub async fn reload_mcp_servers_from_db(
    db: &Arc<dyn skilldeck_core::traits::Database>,
    registry: &Arc<skilldeck_core::mcp::McpRegistry>,
) {
    let conn = match db.connection().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("reload_mcp_servers: DB connection failed: {e}");
            return;
        }
    };

    match mcp_servers::Entity::find().all(conn).await {
        Ok(rows) => {
            for row in rows {
                if row.status != "enabled" {
                    continue;
                }
                let mcp_config = skilldeck_core::traits::McpServerConfig {
                    transport: row.transport.clone(),
                    config: row.config_json,
                };
                registry.add_server_with_id(row.id, row.name, mcp_config);
            }
            tracing::info!("Loaded {} MCP server(s) from DB", registry.list().len());
        }
        Err(e) => tracing::error!("reload_mcp_servers: query failed: {e}"),
    }
}

/// Top-level shared application state injected into every Tauri command.
pub struct AppState {
    /// Core registry: DB connection + provider map + MCP/skill registries.
    pub registry: Arc<Registry>,
    /// Async approval gate: suspends agent tasks awaiting user approval.
    pub approval_gate: Arc<ApprovalGate>,
    /// MCP supervisor command channel (used to register configs and trigger restarts).
    #[allow(dead_code)]
    pub supervisor_tx: tokio::sync::mpsc::Sender<SupervisorCommand>,
    /// Per-conversation cancellation tokens so callers can abort agent loops.
    pub agent_cancel_tokens: Arc<DashMap<String, CancellationToken>>,
    /// Canonical SQLite path – e.g. "/Users/alice/Library/…/skilldeck.db".
    /// Kept as a plain `String` so background tasks can open a fresh connection.
    pub db_url: String,
    /// HTTP client for the optional SkillDeck Platform.
    pub platform_client: tokio::sync::RwLock<crate::platform_client::PlatformClient>,
    /// Whether the user has opted in to anonymous analytics (mirrored from DB).
    pub analytics_opt_in: std::sync::atomic::AtomicBool,
    /// Merged lint configuration — starts from `~/.config/skilldeck/skilldeck-lint.toml`
    /// and can be updated at runtime via the `disable_lint_rule` command.
    pub lint_config: Arc<RwLock<LintConfig>>,
    /// Subagent servers indexed by subagent ID.
    pub subagent_servers: Arc<DashMap<String, SubagentServer>>,
    /// Semaphore to limit concurrent subagents (default 3).
    pub subagent_semaphore: Arc<Semaphore>,
    /// A2A clients for active subagents (wrapped in Arc for sharing).
    pub subagent_clients: Arc<DashMap<String, Arc<A2aClient>>>,
    /// Final results of completed subagents (for mergeSubagentResult).
    pub subagent_results: Arc<DashMap<String, String>>,
    /// Tauri app handle (needed to emit events from background tasks).
    pub app_handle: tauri::AppHandle,
}

impl AppState {
    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("skilldeck.db");
        let db_url = db_path.to_string_lossy().to_string();
        info!("Database path: {}", db_url);

        let conn = open_db(&db_url, true).await?;
        let db = SeaOrmDatabase::new(conn);
        let registry = Arc::new(Registry::new(db));

        // Register transports — now takes &self so works through Arc.
        registry
            .mcp_registry
            .register_transport(StdioTransport::new());
        registry
            .mcp_registry
            .register_transport(SseTransport::new());

        // ── Load persisted MCP servers from database ───────────────────────────
        reload_mcp_servers_from_db(&registry.db, &registry.mcp_registry).await;

        // ── Register model providers ──────────────────────────────────────────
        let keyring = app.keyring();

        match keyring.get_password(KEYRING_SERVICE, "claude") {
            Ok(key) if key.is_some() => {
                info!("Registering Claude provider");
                registry.register_provider(ClaudeProvider::new(key.unwrap()));
            }
            Ok(_) => warn!("Claude API key is empty — not registering"),
            Err(_) => warn!("No Claude API key stored — not registering"),
        }

        match keyring.get_password(KEYRING_SERVICE, "openai") {
            Ok(key) if key.is_some() => {
                info!("Registering OpenAI provider");
                registry.register_provider(OpenAiProvider::new(key.unwrap()));
            }
            Ok(_) => warn!("OpenAI API key is empty — not registering"),
            Err(_) => warn!("No OpenAI API key stored — not registering"),
        }

        info!("Registering Ollama provider (port 11434)");
        registry.register_provider(OllamaProvider::new(11434));

        let approval_gate = Arc::new(ApprovalGate::new());

        // ── Lint config ───────────────────────────────────────────────────────
        let global_config_path =
            dirs_next::config_dir().map(|d| d.join("skilldeck").join("skilldeck-lint.toml"));

        let lint_config =
            LintConfig::from_files(global_config_path.as_deref(), None).unwrap_or_default();

        info!(
            "Loaded lint config: {} rule overrides",
            lint_config.rules.len()
        );

        // ── Start MCP supervisor ──────────────────────────────────────────────
        let supervisor_tx = start_supervisor(
            Arc::clone(&registry.mcp_registry),
            SupervisorConfig::default(),
        );

        // ── Re-register stored MCP server configs with the supervisor ─────────
        for entry in registry.mcp_registry.stored_configs.iter() {
            let _ = supervisor_tx.try_send(SupervisorCommand::RegisterConfig(
                *entry.key(),
                entry.value().clone(),
            ));
        }

        let agent_cancel_tokens = Arc::new(DashMap::new());

        // ── Platform client ────────────────────────────────────────────────────
        let app_config = crate::config::AppConfig::load();
        let mut platform_client = crate::platform_client::PlatformClient::new(
            app_config.platform.url.clone(),
            app_config.platform.enabled,
        );

        // Load API key from keychain if it exists.
        let mut analytics_opt_in_val = false;
        {
            let keyring = app.keyring();
            match keyring.get_password(KEYRING_SERVICE, "platform_api_key") {
                Ok(Some(key)) => {
                    platform_client.set_api_key(key);
                    info!("Platform API key loaded from keychain");
                }
                _ => info!("No platform API key in keychain – will register on first use"),
            }

            // Read analytics opt-in from local DB.
            if let Ok(conn) = open_db(&db_url, false).await {
                use sea_orm::EntityTrait;
                if let Ok(Some(pref)) = skilldeck_models::user_preferences::Entity::find()
                    .one(&conn)
                    .await
                {
                    analytics_opt_in_val = pref.analytics_opt_in;
                }
            }
        }

        let subagent_semaphore = Arc::new(Semaphore::new(3));
        let subagent_servers = Arc::new(DashMap::new());
        let subagent_clients = Arc::new(DashMap::new());
        let subagent_results = Arc::new(DashMap::new());

        let state = Self {
            registry: Arc::clone(&registry),
            approval_gate,
            supervisor_tx,
            agent_cancel_tokens,
            db_url,
            platform_client: tokio::sync::RwLock::new(platform_client),
            analytics_opt_in: std::sync::atomic::AtomicBool::new(analytics_opt_in_val),
            lint_config: Arc::new(RwLock::new(lint_config)),
            subagent_servers,
            subagent_semaphore,
            subagent_clients,
            subagent_results,
            app_handle: app.clone(),
        };

        state.ensure_default_profile().await;

        let workspace_root = std::env::current_dir().unwrap_or_else(|_| data_dir.clone());
        let ctx = ContextLoader::load(&workspace_root).await;

        let skill_dirs = match ctx {
            Ok(ref c) => c.skill_directories.clone(),
            Err(_) => {
                if let Some(home) = dirs_next::home_dir() {
                    let global = home.join(".agents").join("skills");
                    if global.exists() {
                        vec![("personal".to_string(), global)]
                    } else {
                        vec![]
                    }
                } else {
                    vec![]
                }
            }
        };

        if skill_dirs.is_empty() {
            warn!("No skill directories found — skills will not be loaded");
        } else {
            // Ensure each skill directory exists before scanning
            for (_label, path) in &skill_dirs {
                if !path.exists() {
                    tokio::fs::create_dir_all(path).await.map_err(|e| {
                        tracing::error!("Failed to create skill directory {:?}: {}", path, e);
                        e
                    })?;
                }
            }

            // --- PARALLEL SCANNING (changed) ---
            use futures::future::join_all;
            let scan_futures = skill_dirs.iter().map(|(label, path)| {
                let path = path.clone();
                async move {
                    let skills = scanner::scan_directory(&path).await.unwrap_or_else(|e| {
                        tracing::warn!("Failed to scan skill directory {:?}: {}", path, e);
                        vec![]
                    });
                    (label.clone(), skills)
                }
            });
            let scanned_results = join_all(scan_futures).await;

            for (label, skills) in scanned_results {
                info!(
                    "Registering {} skills from source '{}'",
                    skills.len(),
                    label
                );
                state
                    .registry
                    .skill_registry
                    .register_source(label, skills)
                    .await;
            }
            // --- END PARALLEL SCANNING ---

            for (label, path) in &skill_dirs {
                match start_registry_watcher(
                    path.clone(),
                    label.clone(),
                    Arc::clone(&state.registry.skill_registry),
                ) {
                    Ok(w) => {
                        state
                            .registry
                            .skill_registry
                            .watchers
                            .insert(path.clone(), w);
                    }
                    Err(e) => warn!("Could not start watcher for '{}': {}", label, e),
                }
            }
        }

        Ok(state)
    }

    /// Cancel an in-flight agent loop for the given conversation.
    pub fn cancel_agent(&self, conversation_id: &str) {
        if let Some(token) = self.agent_cancel_tokens.get(conversation_id) {
            token.cancel();
        }
        self.agent_cancel_tokens.remove(conversation_id);
        // Also cancel any pending tool approvals for this conversation.
        self.approval_gate.cancel_all();
    }

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

    /// Actual spawn logic (called from the SpawnerWithContext in messages.rs).
    pub async fn do_spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
        provider: Arc<dyn skilldeck_core::traits::ModelProvider>,
        model_id: String,
    ) -> Result<String, String> {
        let _permit = self
            .subagent_semaphore
            .acquire()
            .await
            .map_err(|e| e.to_string())?;

        let agent = crate::subagent_server::build_subagent_agent(
            provider,
            model_id,
            task.clone(),
            skill_names,
            self.registry.skill_registry.clone(),
        )
        .await?;

        let server = crate::subagent_server::SubagentServer::spawn(agent)
            .await
            .map_err(|e| e.to_string())?;
        let url = server.url.clone();
        let subagent_id = uuid::Uuid::new_v4().to_string();

        // Store server
        self.subagent_servers.insert(subagent_id.clone(), server);

        // Create A2A client
        let client = A2aClient::from_url(&url).await.map_err(|e| e.to_string())?;
        let client_arc = Arc::new(client);
        self.subagent_clients
            .insert(subagent_id.clone(), client_arc.clone());

        // Spawn monitor task
        let app_handle = self.app_handle.clone();
        let subagent_id_clone = subagent_id.clone();
        let results_map = self.subagent_results.clone();
        tokio::spawn(async move {
            monitor_subagent(subagent_id_clone, client_arc, app_handle, results_map).await;
        });

        Ok(subagent_id)
    }
}
