// src-tauri/src/state.rs
//! Application state management.

use dashmap::DashMap;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter}; // Added imports
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_keyring::KeyringExt;
use tokio::sync::{RwLock, Semaphore};
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use skilldeck_core::{
    Registry, SeaOrmDatabase,
    agent::{SubagentManager, tool_dispatcher::AutoApproveConfig},
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
use crate::subagent_registry::{SubagentHandle, SubagentRegistry};
use crate::subagent_server::SubagentServer;
use adk_rust::server::a2a::A2aClient;

// Import traits
use async_trait::async_trait;
use skilldeck_core::traits::SkillEventEmitter;
use skilldeck_core::traits::ToolApprovalEmitter;
use skilldeck_core::traits::subagent_spawner::SubagentSpawner;

// Import core event types
use skilldeck_core::events::McpEvent as CoreMcpEvent;

// Import markdown pipeline
use skilldeck_core::markdown::{renderer::MarkdownPipeline, theme::SharedTheme};

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

/// Tauri‑specific implementation of the SkillEventEmitter.
struct TauriSkillEventEmitter {
    app_handle: tauri::AppHandle,
}

impl SkillEventEmitter for TauriSkillEventEmitter {
    fn emit_updated(&self, source_label: String, skill_name: String) {
        use crate::events::SkillEvent;
        let _ = self.app_handle.emit(
            "skill-event",
            SkillEvent::Updated {
                source_label,
                skill_name,
            },
        );
    }
}

/// Tauri‑specific implementation of ToolApprovalEmitter.
struct TauriToolApprovalEmitter {
    app_handle: tauri::AppHandle,
}

impl ToolApprovalEmitter for TauriToolApprovalEmitter {
    fn emit_tool_approval_required(
        &self,
        conversation_id: &str,
        tool_call_id: &str,
        tool_name: &str,
        arguments: &serde_json::Value,
    ) {
        use crate::events::AgentEvent;
        let _ = self.app_handle.emit(
            "agent-event",
            AgentEvent::ToolApprovalRequired {
                conversation_id: conversation_id.to_string(),
                tool_call_id: tool_call_id.to_string(),
                tool_name: tool_name.to_string(),
                arguments: arguments.clone(),
            },
        );
    }
}

/// Wrapper to implement SubagentSpawner for Arc<AppState> without orphan rule issues.
pub struct AppStateSpawner {
    pub state: Arc<AppState>,
}

#[async_trait]
impl SubagentSpawner for AppStateSpawner {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String> {
        self.state.spawn_subagent_internal(task, skill_names).await
    }

    async fn get_subagent_result(&self, subagent_id: &str) -> Option<String> {
        self.state.get_subagent_result_internal(subagent_id).await
    }

    async fn merge_subagent_result(
        &self,
        subagent_id: &str,
        strategy: &str,
    ) -> Result<String, String> {
        self.state
            .merge_subagent_result_internal(subagent_id, strategy)
            .await
    }
}

/// Top-level shared application state injected into every Tauri command.
pub struct AppState {
    // ── Core Registry ──────────────────────────────────────────
    /// Core registry: DB connection + provider map + MCP/skill registries.
    pub registry: Arc<Registry>,

    // ── Agent Runtime ──────────────────────────────────────────
    /// Async approval gate: suspends agent tasks awaiting user approval.
    pub approval_gate: Arc<skilldeck_core::agent::ApprovalGate>,
    /// MCP supervisor command channel (used to register configs and trigger restarts).
    #[allow(dead_code)]
    pub supervisor_tx: tokio::sync::mpsc::Sender<SupervisorCommand>,
    /// Per-conversation cancellation tokens so callers can abort agent loops.
    pub agent_cancel_tokens: Arc<DashMap<String, CancellationToken>>,
    /// Per-conversation flag to pause auto-send when editing/dragging/selecting.
    pub auto_send_paused: Arc<DashMap<String, bool>>,
    /// Global auto-approve configuration (shared by all ToolDispatcher instances).
    pub global_auto_approve: Arc<RwLock<AutoApproveConfig>>,
    /// Subagent servers indexed by subagent ID.
    pub subagent_servers: Arc<DashMap<String, SubagentServer>>,
    /// Semaphore to limit concurrent subagents (default 3).
    pub subagent_semaphore: Arc<Semaphore>,
    /// A2A clients for active subagents (wrapped in Arc for sharing).
    pub subagent_clients: Arc<DashMap<String, Arc<A2aClient>>>,
    /// Final results of completed subagents (for mergeSubagentResult).
    pub subagent_results: Arc<DashMap<String, String>>,
    /// Subagent session manager.
    pub subagent_manager: Arc<tokio::sync::Mutex<SubagentManager>>,
    /// Subagent registry (tracks active subagents for result merging).
    pub subagent_registry: SubagentRegistry,

    // ── Database ───────────────────────────────────────────────
    /// Canonical SQLite path – e.g. "/Users/alice/Library/…/skilldeck.db".
    /// Kept as a plain `String` so background tasks can open a fresh connection.
    pub db_url: String,

    // ── Platform Integration ───────────────────────────────────
    /// HTTP client for the optional SkillDeck Platform.
    pub platform_client: tokio::sync::RwLock<crate::platform_client::PlatformClient>,
    /// Whether the user has opted in to anonymous analytics (mirrored from DB).
    pub analytics_opt_in: std::sync::atomic::AtomicBool,
    pub config: crate::config::AppConfig,

    // ── Configuration ──────────────────────────────────────────
    /// Merged lint configuration — starts from `~/.config/skilldeck/skilldeck-lint.toml`
    /// and can be updated at runtime via the `disable_lint_rule` command.
    pub lint_config: Arc<RwLock<LintConfig>>,

    // ── Presentation ───────────────────────────────────────────
    /// Shared theme for syntax highlighting (live-swappable).
    pub theme: SharedTheme,
    /// Markdown pipeline (uses the same theme).
    pub markdown: Arc<MarkdownPipeline>,

    // ── App Handle ─────────────────────────────────────────────
    /// Tauri app handle (needed to emit events from background tasks).
    pub app_handle: tauri::AppHandle,
}

impl AppState {
    pub fn is_agent_running(&self, conversation_id: &str) -> bool {
        self.agent_cancel_tokens.contains_key(conversation_id)
    }

    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("skilldeck.db");
        let db_url = db_path.to_string_lossy().to_string();
        info!("Database path: {}", db_url);

        let conn = open_db(&db_url, true).await?;
        let db = SeaOrmDatabase::new(conn);

        // Load lint config
        let global_config_path =
            dirs_next::config_dir().map(|d| d.join("skilldeck").join("skilldeck-lint.toml"));
        let lint_config = Arc::new(RwLock::new(
            LintConfig::from_files(global_config_path.as_deref(), None).unwrap_or_default(),
        ));

        // Create registry with lint config
        let registry = Arc::new(Registry::with_lint_config(db, lint_config.clone()));

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

        // Register the native Ollama provider (now with ID "ollama")
        info!("Registering Ollama provider (port 11434)");
        registry.register_provider(OllamaProvider::new(11434));

        // Create the tool approval emitter
        let tool_approval_emitter = TauriToolApprovalEmitter {
            app_handle: app.clone(),
        };

        // Create the approval gate with the emitter
        let approval_gate = Arc::new(skilldeck_core::agent::ApprovalGate::new(Some(Arc::new(
            tool_approval_emitter,
        )
            as Arc<dyn ToolApprovalEmitter>)));

        // ── Start MCP supervisor with event emitter ────────────────────────────
        let app_handle = app.clone();
        let event_emitter = move |event: CoreMcpEvent| {
            use crate::events::McpEvent;
            let tauri_event = match event {
                CoreMcpEvent::ServerConnected { name } => McpEvent::ServerConnected { name },
                CoreMcpEvent::ServerDisconnected { name } => McpEvent::ServerDisconnected { name },
                CoreMcpEvent::ServerFailed { name, message } => {
                    McpEvent::ServerFailed { name, message }
                }
                CoreMcpEvent::ToolDiscovered { server, tool } => McpEvent::ToolDiscovered {
                    server,
                    tool: crate::events::McpToolInfo {
                        name: tool.name,
                        description: tool.description,
                    },
                },
            };
            let _ = app_handle.emit("mcp-event", tauri_event);
        };

        let supervisor_tx = start_supervisor(
            Arc::clone(&registry.mcp_registry),
            SupervisorConfig::default(),
            Some(Box::new(event_emitter)),
        );

        // ── Re-register stored MCP server configs with the supervisor ─────────
        for entry in registry.mcp_registry.stored_configs.iter() {
            let _ = supervisor_tx.try_send(SupervisorCommand::RegisterConfig(
                *entry.key(),
                entry.value().clone(),
            ));
        }

        let agent_cancel_tokens = Arc::new(DashMap::new());
        let auto_send_paused = Arc::new(DashMap::new());

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
        let subagent_registry = Arc::new(DashMap::new());

        // ─── Markdown pipeline ─────────────────────────────────────────────────
        // Load default theme (we can later load from user preferences)
        let theme = SharedTheme::from_name("base16-ocean.dark").map_err(|e| e.to_string())?;
        let markdown = Arc::new(MarkdownPipeline::new(theme.clone()));

        let state = Self {
            registry: Arc::clone(&registry),
            approval_gate,
            supervisor_tx,
            agent_cancel_tokens,
            db_url,
            config: app_config,
            platform_client: tokio::sync::RwLock::new(platform_client),
            analytics_opt_in: std::sync::atomic::AtomicBool::new(analytics_opt_in_val),
            lint_config,
            subagent_servers,
            subagent_semaphore,
            subagent_clients,
            subagent_results,
            subagent_registry,
            app_handle: app.clone(),
            auto_send_paused,
            global_auto_approve: Arc::new(RwLock::new(AutoApproveConfig::default())),
            subagent_manager: Arc::new(tokio::sync::Mutex::new(SubagentManager::new())),
            theme,
            markdown,
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

            // --- PARALLEL SCANNING with lint config ---
            use futures::future::join_all;
            // Acquire a read lock on lint_config for scanning
            let lint_config_read = state.lint_config.read().await;
            let scan_futures = skill_dirs.iter().map(|(label, path)| {
                let path = path.clone();
                let config = lint_config_read.clone(); // clone the LintConfig (cheap)
                async move {
                    let skills = scanner::scan_directory(&path, &config)
                        .await
                        .unwrap_or_else(|e| {
                            tracing::warn!("Failed to scan skill directory {:?}: {}", path, e);
                            vec![]
                        });
                    (label.clone(), skills)
                }
            });
            let scanned_results = join_all(scan_futures).await;
            drop(lint_config_read); // release lock before long-running operations

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

            // Create event emitter for watchers
            let emitter = Arc::new(TauriSkillEventEmitter {
                app_handle: app.clone(),
            });

            for (label, path) in &skill_dirs {
                match start_registry_watcher(
                    path.clone(),
                    label.clone(),
                    Arc::clone(&state.registry.skill_registry),
                    Some(emitter.clone() as Arc<dyn SkillEventEmitter>),
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
        use skilldeck_core::providers::ollama::OllamaStatus;
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

        match OllamaProvider::check_ollama_status().await {
            OllamaStatus::Available(models) => {
                let first = models.into_iter().next().unwrap();
                let now = chrono::Utc::now().fixed_offset();
                let id = uuid::Uuid::new_v4();

                let profile = profiles::ActiveModel {
                    id: Set(id),
                    name: Set("Local (Ollama)".to_string()),
                    description: Set(Some(
                        "Default local profile — no API key required".to_string(),
                    )),
                    model_provider: Set("ollama".to_string()),
                    model_id: Set(first.id.clone()),
                    is_default: Set(true),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                };

                match profile.insert(db).await {
                    Ok(_) => info!("Seeded default Ollama profile with model: {}", first.id),
                    Err(e) => warn!("Failed to seed default profile: {}", e),
                }
            }
            OllamaStatus::NotInstalled | OllamaStatus::NotRunning | OllamaStatus::NoModels => {
                // No profile created; emit event that setup is needed
                info!("No working Ollama found; profile setup needed.");
                let _ = self.app_handle.emit("skilldeck:setup-needed", ());
            }
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

        let client = A2aClient::from_url(&url).await.map_err(|e| e.to_string())?;
        let client_arc = Arc::new(client);
        let results_map = Arc::new(DashMap::new());

        // Spawn monitor task
        let app_handle = self.app_handle.clone();
        let subagent_id_clone = subagent_id.clone();
        let results_map_clone = results_map.clone();
        let client_arc_clone = client_arc.clone();
        let monitor_task = tokio::spawn(async move {
            monitor_subagent(
                subagent_id_clone,
                client_arc_clone,
                app_handle,
                results_map_clone,
            )
            .await;
        });

        // Register handle
        let handle = SubagentHandle {
            server,
            client: client_arc,
            results: results_map,
            monitor_task,
        };
        self.subagent_registry.insert(subagent_id.clone(), handle);

        Ok(subagent_id)
    }

    // Internal methods for SubagentSpawner implementation
    async fn spawn_subagent_internal(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String> {
        let db = self
            .registry
            .db
            .connection()
            .await
            .map_err(|e| e.to_string())?;
        let default_profile = skilldeck_models::profiles::Entity::find()
            .filter(skilldeck_models::profiles::Column::IsDefault.eq(true))
            .one(db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "No default profile found".to_string())?;
        let provider = self
            .registry
            .get_provider(&default_profile.model_provider)
            .ok_or_else(|| format!("Provider {} not available", default_profile.model_provider))?;
        let model_id = default_profile.model_id;
        self.do_spawn_subagent(task, skill_names, provider, model_id)
            .await
    }

    async fn get_subagent_result_internal(&self, subagent_id: &str) -> Option<String> {
        if let Some(handle) = self.subagent_registry.get(subagent_id) {
            handle
                .results
                .iter()
                .next()
                .map(|entry| entry.value().clone())
        } else {
            None
        }
    }

    async fn merge_subagent_result_internal(
        &self,
        subagent_id: &str,
        strategy: &str,
    ) -> Result<String, String> {
        let handle = self
            .subagent_registry
            .get(subagent_id)
            .ok_or_else(|| format!("Subagent {} not found", subagent_id))?;

        let results: Vec<String> = handle.results.iter().map(|e| e.value().clone()).collect();

        if results.is_empty() {
            return Err("No results available".to_string());
        }

        let merged = match strategy {
            "concat" => results.join("\n\n---\n\n"),
            "summarize" => {
                format!("[Summary of {} results]\n{}", results.len(), results[0])
            }
            "vote" => {
                use std::collections::HashMap;
                let mut counts = HashMap::new();
                for r in &results {
                    *counts.entry(r).or_insert(0) += 1;
                }
                counts
                    .into_iter()
                    .max_by_key(|(_, count)| *count)
                    .map(|(r, _)| r.clone())
                    .unwrap_or_else(|| results[0].clone())
            }
            _ => return Err(format!("Unknown strategy: {}", strategy)),
        };

        // Clean up handle after merge
        drop(handle);
        self.subagent_registry.remove(subagent_id);

        Ok(merged)
    }
}
