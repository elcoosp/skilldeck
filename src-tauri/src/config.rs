//! Application configuration loaded from `~/.config/skilldeck/config.toml`.
//!
//! All fields have sensible defaults so the file is optional.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_PLATFORM_URL: &str = "https://platform.skilldeck.dev";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub platform: PlatformConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PlatformConfig {
    /// Base URL of the SkillDeck Platform API.
    pub url: String,
    /// Master switch for all platform features (referrals, nudges, analytics).
    /// Set to `false` to run in fully air-gapped / private mode.
    pub enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            platform: PlatformConfig::default(),
        }
    }
}

impl Default for PlatformConfig {
    fn default() -> Self {
        Self {
            url: DEFAULT_PLATFORM_URL.to_string(),
            enabled: true,
        }
    }
}

impl AppConfig {
    /// Load config from `~/.config/skilldeck/config.toml`.
    /// Returns defaults if the file does not exist or cannot be parsed.
    pub fn load() -> Self {
        if let Some(path) = config_path() {
            if path.exists() {
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
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let path = config_path().ok_or("Cannot determine config directory")?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let contents = toml::to_string_pretty(self)?;
        std::fs::write(&path, contents)?;
        Ok(())
    }
}

fn config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("skilldeck").join("config.toml"))
}
