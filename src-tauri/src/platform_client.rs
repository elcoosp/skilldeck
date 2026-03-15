//! HTTP client for the SkillDeck Platform API.
//!
//! All requests are authenticated with a bearer token (the platform API key)
//! retrieved from the OS keychain. The client is intentionally thin – it
//! serialises request bodies, deserialises responses, and propagates errors;
//! higher-level logic lives in the Tauri command handlers.

use reqwest::{Client, StatusCode};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

// ── Error ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum PlatformError {
    #[error("HTTP error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Not configured – call ensure_platform_registration first")]
    NotConfigured,
    #[error("Platform features are disabled in config")]
    Disabled,
    #[error("Operation cancelled")]
    Cancelled,
}

impl PlatformError {
    /// Returns true if the error is transient and the operation may be retried.
    pub fn is_transient(&self) -> bool {
        match self {
            PlatformError::Network(_) => true,
            PlatformError::Http { status, .. } => *status >= 500 || *status == 429,
            _ => false,
        }
    }
}

// ── Request / response DTOs ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RegisterRequest {
    pub client_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct RegisterResponse {
    pub user_id: Uuid,
    pub api_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformPreferences {
    pub email: Option<String>,
    pub email_verified: bool,
    pub nudge_frequency: String,
    pub nudge_opt_out: bool,
    pub notification_channels: Vec<String>,
    pub theme_preference: String,
    pub timezone: Option<String>,
    pub analytics_opt_in: bool,
}

#[derive(Debug, Serialize)]
pub struct UpdatePreferencesRequest {
    pub email: Option<String>,
    pub nudge_frequency: Option<String>,
    pub nudge_opt_out: Option<bool>,
    pub notification_channels: Option<Vec<String>>,
    pub theme_preference: Option<String>,
    pub timezone: Option<String>,
    pub analytics_opt_in: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReferralCode {
    pub id: Uuid,
    pub code: String,
    pub uses: i32,
    pub max_uses: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferralStats {
    pub code: ReferralCode,
    pub total_signups: i64,
    pub total_conversions: i64,
    pub rewards_earned: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingNudge {
    pub id: Uuid,
    pub message: String,
    pub cta_label: Option<String>,
    pub cta_action: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ActivityEventRequest {
    pub event_type: String,
    pub metadata: serde_json::Value,
}

// ── Client ────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct PlatformClient {
    http: Client,
    base_url: String,
    api_key: Option<SecretString>,
    pub enabled: bool,
}

impl PlatformClient {
    pub fn new(base_url: String, enabled: bool) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("failed to build HTTP client"),
            base_url,
            api_key: None,
            enabled,
        }
    }

    pub fn set_api_key(&mut self, key: String) {
        self.api_key = Some(SecretString::from(key));
    }

    pub fn is_configured(&self) -> bool {
        self.api_key.is_some()
    }

    /// Get the base URL of the platform.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn check_enabled(&self) -> Result<(), PlatformError> {
        if !self.enabled {
            return Err(PlatformError::Disabled);
        }
        Ok(())
    }

    fn auth_header(&self) -> Result<String, PlatformError> {
        self.api_key
            .as_ref()
            .map(|key| format!("Bearer {}", key.expose_secret()))
            .ok_or(PlatformError::NotConfigured)
    }

    async fn check_response(resp: reqwest::Response) -> Result<reqwest::Response, PlatformError> {
        let status = resp.status();
        if status.is_success() {
            return Ok(resp);
        }
        let body = resp.text().await.unwrap_or_default();
        Err(PlatformError::Http {
            status: status.as_u16(),
            body,
        })
    }

    // Simple retry helper with exponential backoff.
    async fn retry<F, Fut, T>(&self, mut f: F) -> Result<T, PlatformError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, PlatformError>>,
    {
        let mut delay = std::time::Duration::from_millis(100);
        for attempt in 0..3 {
            match f().await {
                Ok(v) => return Ok(v),
                Err(e) if e.is_transient() && attempt < 2 => {
                    tokio::time::sleep(delay).await;
                    delay *= 2;
                }
                Err(e) => return Err(e),
            }
        }
        unreachable!()
    }

    // ── Auth-free endpoints ───────────────────────────────────────────────────

    /// Register a new client installation.  Returns `(user_id, raw_api_key)`.
    pub async fn register(&self, client_id: Uuid) -> Result<RegisterResponse, PlatformError> {
        self.check_enabled()?;
        let url = format!("{}/api/core/register", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .post(&url)
                .json(&RegisterRequest { client_id })
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    // ── Preferences ───────────────────────────────────────────────────────────

    pub async fn get_preferences(&self) -> Result<PlatformPreferences, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    pub async fn update_preferences(
        &self,
        req: UpdatePreferencesRequest,
    ) -> Result<PlatformPreferences, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .put(&url)
                .header("Authorization", &auth)
                .json(&req)
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    pub async fn resend_verification(&self) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/resend-verification", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await.map(drop)
        })
        .await
    }

    pub async fn export_gdpr_data(&self) -> Result<serde_json::Value, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/export", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    pub async fn delete_account(&self) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/account", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .delete(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await.map(drop)
        })
        .await
    }

    // ── Growth / Referrals ────────────────────────────────────────────────────

    pub async fn create_referral_code(&self) -> Result<ReferralCode, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/referral", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    pub async fn get_referral_stats(&self) -> Result<ReferralStats, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/referral/stats", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    // ── Nudges ────────────────────────────────────────────────────────────────

    pub async fn get_pending_nudges(&self) -> Result<Vec<PendingNudge>, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/nudges/pending", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            if resp.status() == StatusCode::NO_CONTENT {
                return Ok(vec![]);
            }
            Self::check_response(resp).await
        })
        .await?
        .json()
        .await
        .map_err(Into::into)
    }

    pub async fn mark_nudge_delivered(&self, nudge_id: Uuid) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/nudges/{nudge_id}/delivered", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await.map(drop)
        })
        .await
    }

    // ── Activity events ───────────────────────────────────────────────────────

    /// Send an analytics event.  Only called when the user has opted in.
    pub async fn send_activity_event(
        &self,
        event_type: impl Into<String>,
        metadata: serde_json::Value,
    ) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/event", self.base_url);
        self.retry(|| async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .json(&ActivityEventRequest {
                    event_type: event_type.into(),
                    metadata,
                })
                .send()
                .await?;
            Self::check_response(resp).await.map(drop)
        })
        .await
    }
}
