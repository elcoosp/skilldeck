//! Server configuration loaded from environment variables / `.env`.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Database URL – e.g. `sqlite:./platform.db`
    #[serde(default = "default_db_url")]
    pub database_url: String,

    /// TCP address to bind – e.g. `0.0.0.0:8080`
    #[serde(default = "default_listen_addr")]
    pub listen_addr: String,

    /// Resend API key for transactional email.
    pub resend_api_key: Option<String>,

    /// Base URL for email verification links (no trailing slash).
    /// e.g. `https://platform.skilldeck.dev`
    #[serde(default = "default_platform_url")]
    pub platform_url: String,

    /// From address used for emails.
    #[serde(default = "default_from_email")]
    pub from_email: String,
    #[serde(default)]
    pub team_emails: Vec<String>,
}

fn default_db_url() -> String {
    "sqlite:./platform.db".into()
}

fn default_listen_addr() -> String {
    "0.0.0.0:8080".into()
}

fn default_platform_url() -> String {
    "https://platform.skilldeck.dev".into()
}

fn default_from_email() -> String {
    "noreply@skilldeck.dev".into()
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .build()?
            .try_deserialize()?;
        Ok(cfg)
    }
}
