//! Application configuration loaded from `~/.config/skilldeck/config.toml`.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_PLATFORM_URL: &str = "https://platform.skilldeck.dev";
const DEFAULT_MAX_EVAL_OPT_ITERATIONS: u32 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[derive(Default)]
pub struct AppConfig {
    pub platform: PlatformConfig,
    pub agent: AgentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PlatformConfig {
    pub url: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AgentConfig {
    pub max_eval_opt_iterations: u32,
}


impl Default for PlatformConfig {
    fn default() -> Self {
        Self {
            url: DEFAULT_PLATFORM_URL.to_string(),
            enabled: true,
        }
    }
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_eval_opt_iterations: DEFAULT_MAX_EVAL_OPT_ITERATIONS,
        }
    }
}

impl AppConfig {
    /// Load config from `~/.config/skilldeck/config.toml`.
    /// Returns defaults if the file does not exist or cannot be parsed.
    pub fn load() -> Self {
        if let Some(path) = config_path()
            && path.exists()
        {
            match std::fs::read_to_string(&path) {
                Ok(contents) => match toml::from_str(&contents) {
                    Ok(cfg) => {
                        tracing::info!("Loaded config from {:?}", path);
                        return cfg;
                    }
                    Err(e) => tracing::warn!("Failed to parse config at {:?}: {e}", path),
                },
                Err(e) => tracing::warn!("Failed to read config at {:?}: {e}", path),
            }
        }
        Self::default()
    }
}

fn config_path() -> Option<PathBuf> {
    dirs_next::config_dir().map(|d| d.join("skilldeck").join("config.toml"))
}
