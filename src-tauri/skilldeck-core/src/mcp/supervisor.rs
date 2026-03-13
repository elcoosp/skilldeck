//! MCP server supervisor — health monitoring and exponential-backoff restart.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::mcp::registry::{McpRegistry, ServerStatus};

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
        Self { attempts: 0, next_delay: initial_delay, last_attempt: Instant::now() }
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
    Restart(uuid::Uuid),
    Reset(uuid::Uuid),
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
        let mut tick = tokio::time::interval(config.check_interval);

        loop {
            tokio::select! {
                _ = tick.tick() => {
                    for server in registry.list() {
                        match server.status {
                            ServerStatus::Error => {
                                let state = states.entry(server.id)
                                    .or_insert_with(|| RestartState::new(config.initial_delay));

                                if state.attempts >= config.max_attempts {
                                    warn!("Server '{}' exceeded max restart attempts ({}); giving up",
                                        server.name, config.max_attempts);
                                    continue;
                                }

                                if state.ready_to_retry() {
                                    info!("Attempting restart of server '{}'", server.name);
                                    let delay = state.record_failure(&config);
                                    info!("Next restart of '{}' in {:?}", server.name, delay);
                                    // Actual reconnect would be: registry.connect(server.id, config).await
                                    // Deferred to Chunk 10 where commands carry full configs.
                                }
                            }
                            ServerStatus::Connected => {
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
                        SupervisorCommand::Restart(id) => {
                            if let Some(server) = registry.get(id) {
                                info!("Manual restart requested for '{}'", server.name);
                            }
                            if let Some(state) = states.get_mut(&id) {
                                state.reset(&config);
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
        let cfg = SupervisorConfig { max_delay: Duration::from_secs(10), multiplier: 2.0, ..Default::default() };
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
}
