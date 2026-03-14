//! MCP server supervisor — health monitoring and exponential-backoff restart.
//!
//! The supervisor runs as a long-lived Tokio task. On each tick it inspects
//! every server in the registry and, for those in `Error` state whose
//! backoff timer has elapsed, attempts a real `registry.connect()` call with
//! the stored configuration.  Servers that succeed transition back to
//! `Connected`; those that fail increment their attempt counter until
//! `max_attempts` is reached, at which point they are promoted to `Failed`
//! and no further retries are made.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::mcp::registry::{McpRegistry, ServerStatus};
use crate::traits::McpServerConfig;

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct SupervisorConfig {
    /// How often to run the health check loop.
    pub check_interval: Duration,
    /// Initial restart delay.
    pub initial_delay: Duration,
    /// Cap on restart delay.
    pub max_delay: Duration,
    /// Delay multiplier per failure.
    pub multiplier: f64,
    /// Give up after this many consecutive failures.
    pub max_attempts: u32,
}

impl Default for SupervisorConfig {
    fn default() -> Self {
        Self {
            check_interval: Duration::from_secs(30),
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            multiplier: 2.0,
            max_attempts: 5,
        }
    }
}

// ── Restart state ─────────────────────────────────────────────────────────────

struct RestartState {
    attempts: u32,
    next_delay: Duration,
    last_attempt: Instant,
}

impl RestartState {
    fn new(initial_delay: Duration) -> Self {
        Self {
            attempts: 0,
            next_delay: initial_delay,
            last_attempt: Instant::now(),
        }
    }

    /// Record a failure and return the delay that was *used* (i.e. the one
    /// callers should wait before retrying).
    fn record_failure(&mut self, cfg: &SupervisorConfig) -> Duration {
        self.attempts += 1;
        self.last_attempt = Instant::now();
        let used = self.next_delay;
        self.next_delay = Duration::from_secs_f64(
            (self.next_delay.as_secs_f64() * cfg.multiplier).min(cfg.max_delay.as_secs_f64()),
        );
        used
    }

    fn reset(&mut self, cfg: &SupervisorConfig) {
        self.attempts = 0;
        self.next_delay = cfg.initial_delay;
    }

    fn ready_to_retry(&self) -> bool {
        Instant::now().duration_since(self.last_attempt) >= self.next_delay
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum SupervisorCommand {
    Stop,
    /// Manually trigger a reconnect attempt for `id`, resetting the backoff.
    Restart(uuid::Uuid),
    /// Reset the backoff counter for `id` without triggering an immediate connect.
    Reset(uuid::Uuid),
    /// Register (or update) the stored config for `id` so the supervisor can
    /// reconnect autonomously.
    RegisterConfig(uuid::Uuid, McpServerConfig),
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Spawn the supervisor task and return the command sender.
pub fn start_supervisor(
    registry: Arc<McpRegistry>,
    config: SupervisorConfig,
) -> mpsc::Sender<SupervisorCommand> {
    let (tx, mut rx) = mpsc::channel::<SupervisorCommand>(32);

    tokio::spawn(async move {
        let mut states: HashMap<uuid::Uuid, RestartState> = HashMap::new();
        // Configs stored by `RegisterConfig` commands so we can reconnect.
        let mut configs: HashMap<uuid::Uuid, McpServerConfig> = HashMap::new();
        let mut tick = tokio::time::interval(config.check_interval);

        loop {
            tokio::select! {
                _ = tick.tick() => {
                    // Collect ids + statuses first to avoid holding the
                    // registry lock across the async connect call.
                    let servers = registry.list();

                    for server in servers {
                        match server.status {
                            ServerStatus::Error => {
                                let state = states.entry(server.id)
                                    .or_insert_with(|| RestartState::new(config.initial_delay));

                                if state.attempts >= config.max_attempts {
                                    warn!(
                                        "Server '{}' exceeded max restart attempts ({}); marking Failed",
                                        server.name, config.max_attempts
                                    );
                                    registry.mark_failed(server.id);
                                    continue;
                                }

                                if !state.ready_to_retry() {
                                    continue;
                                }

                                // Only attempt if we have the config stored.
                                let Some(server_config) = configs.get(&server.id).cloned() else {
                                    warn!(
                                        "No config stored for server '{}'; cannot reconnect automatically",
                                        server.name
                                    );
                                    continue;
                                };

                                info!("Supervisor: attempting reconnect of '{}'", server.name);
                                let delay = state.record_failure(&config);
                                info!("Next reconnect of '{}' in {:?}", server.name, delay);

                                match registry.connect(server.id, server_config).await {
                                    Ok(()) => {
                                        info!("Supervisor: '{}' reconnected successfully", server.name);
                                        if let Some(s) = states.get_mut(&server.id) {
                                            s.reset(&config);
                                        }
                                    }
                                    Err(e) => {
                                        error!("Supervisor: reconnect of '{}' failed: {}", server.name, e);
                                    }
                                }
                            }
                            ServerStatus::Connected => {
                                // Reset backoff on healthy servers.
                                if let Some(state) = states.get_mut(&server.id) {
                                    state.reset(&config);
                                }
                            }
                            _ => {}
                        }
                    }
                }

                Some(cmd) = rx.recv() => {
                    match cmd {
                        SupervisorCommand::Stop => {
                            info!("MCP supervisor stopping");
                            break;
                        }
                        SupervisorCommand::RegisterConfig(id, server_config) => {
                            configs.insert(id, server_config);
                        }
                        SupervisorCommand::Restart(id) => {
                            if let Some(server) = registry.get(id) {
                                info!("Manual restart requested for '{}'", server.name);

                                // Reset backoff so the next tick retries immediately.
                                states.entry(id)
                                    .or_insert_with(|| RestartState::new(config.initial_delay))
                                    .reset(&config);

                                // Attempt reconnect right now if config is available.
                                if let Some(server_config) = configs.get(&id).cloned() {
                                    match registry.connect(id, server_config).await {
                                        Ok(()) => info!("Manual reconnect of '{}' succeeded", server.name),
                                        Err(e) => error!("Manual reconnect of '{}' failed: {}", server.name, e),
                                    }
                                }
                            }
                        }
                        SupervisorCommand::Reset(id) => {
                            if let Some(state) = states.get_mut(&id) {
                                state.reset(&config);
                            }
                        }
                    }
                }
            }
        }
    });

    tx
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restart_state_exponential_backoff() {
        let cfg = SupervisorConfig::default();
        let mut s = RestartState::new(cfg.initial_delay);

        assert_eq!(s.attempts, 0);

        let d1 = s.record_failure(&cfg);
        assert_eq!(d1, Duration::from_secs(1));
        assert_eq!(s.attempts, 1);

        let d2 = s.record_failure(&cfg);
        assert_eq!(d2, Duration::from_secs(2));

        let d3 = s.record_failure(&cfg);
        assert_eq!(d3, Duration::from_secs(4));

        s.reset(&cfg);
        assert_eq!(s.attempts, 0);
        assert_eq!(s.next_delay, Duration::from_secs(1));
    }

    #[test]
    fn restart_state_caps_at_max_delay() {
        let cfg = SupervisorConfig {
            max_delay: Duration::from_secs(10),
            multiplier: 2.0,
            ..Default::default()
        };
        let mut s = RestartState::new(cfg.initial_delay);
        for _ in 0..10 {
            s.record_failure(&cfg);
        }
        assert!(s.next_delay <= cfg.max_delay);
    }

    #[tokio::test]
    async fn stop_command_terminates_supervisor() {
        let registry = Arc::new(McpRegistry::new());
        let tx = start_supervisor(registry, SupervisorConfig::default());
        tx.send(SupervisorCommand::Stop).await.unwrap();
        // No panic = success.
    }

    #[tokio::test]
    async fn register_config_command_accepted() {
        let registry = Arc::new(McpRegistry::new());
        let tx = start_supervisor(registry, SupervisorConfig::default());
        let cfg = McpServerConfig {
            transport: "stdio".into(),
            config: serde_json::json!({"command": "echo"}),
        };
        tx.send(SupervisorCommand::RegisterConfig(uuid::Uuid::new_v4(), cfg))
            .await
            .unwrap();
        tx.send(SupervisorCommand::Stop).await.unwrap();
    }
}
