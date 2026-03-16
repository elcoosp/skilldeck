//! HTTP client for the SkillDeck Platform API.
//!
//! All requests are authenticated with a bearer token (the platform API key)
//! retrieved from the OS keychain. The client is intentionally thin – it
//! serialises request bodies, deserialises responses, and propagates errors;
//! higher-level logic lives in the Tauri command handlers.

use reqwest::{Client, StatusCode};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;
use tokio_util::sync::CancellationToken;
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

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
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

#[derive(Debug, Serialize, Type)]
pub struct UpdatePreferencesRequest {
    pub email: Option<String>,
    pub nudge_frequency: Option<String>,
    pub nudge_opt_out: Option<bool>,
    pub notification_channels: Option<Vec<String>>,
    pub theme_preference: Option<String>,
    pub timezone: Option<String>,
    pub analytics_opt_in: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct ReferralCode {
    pub id: Uuid,
    pub code: String,
    pub uses: i32,
    pub max_uses: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ReferralStats {
    pub code: ReferralCode,
    pub total_signups: i64,
    pub total_conversions: i64,
    pub rewards_earned: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct PendingNudge {
    pub id: Uuid,
    pub message: String,
    pub cta_label: Option<String>,
    pub cta_action: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Type)]
pub struct ActivityEventRequest {
    pub event_type: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RegisterRequest {
    pub client_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RegisterResponse {
    pub user_id: Uuid,
    pub api_key: String,
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

    // Helper to classify reqwest errors as transient
    fn is_transient_reqwest(e: &reqwest::Error) -> bool {
        e.is_timeout() || e.is_connect() || e.is_request()
    }

    // Retry helper with cancellation support
    async fn retry<F, Fut, T>(
        &self,
        mut f: F,
        cancel: Option<CancellationToken>,
    ) -> Result<T, PlatformError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<reqwest::Response, PlatformError>>,
        T: serde::de::DeserializeOwned,
    {
        let mut delay = std::time::Duration::from_millis(100);
        for attempt in 0..3 {
            // Check cancellation before each attempt
            if let Some(ref token) = cancel {
                if token.is_cancelled() {
                    return Err(PlatformError::Cancelled);
                }
            }
            let future = f();
            let result = if let Some(ref token) = cancel {
                tokio::select! {
                    res = future => res,
                    _ = token.cancelled() => return Err(PlatformError::Cancelled),
                }
            } else {
                future.await
            };
            match result {
                Ok(resp) => return Ok(resp.json().await?),
                Err(e) if e.is_transient() && attempt < 2 => {
                    // Also check cancellation during backoff sleep
                    if let Some(ref token) = cancel {
                        tokio::select! {
                            _ = tokio::time::sleep(delay) => {}
                            _ = token.cancelled() => return Err(PlatformError::Cancelled),
                        }
                    } else {
                        tokio::time::sleep(delay).await;
                    }
                    delay *= 2;
                }
                Err(e) => return Err(e),
            }
        }
        unreachable!()
    }

    // For methods that return no content (204)
    async fn retry_no_content<F, Fut>(
        &self,
        mut f: F,
        cancel: Option<CancellationToken>,
    ) -> Result<(), PlatformError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<reqwest::Response, PlatformError>>,
    {
        let mut delay = std::time::Duration::from_millis(100);
        for attempt in 0..3 {
            if let Some(ref token) = cancel {
                if token.is_cancelled() {
                    return Err(PlatformError::Cancelled);
                }
            }
            let future = f();
            let result = if let Some(ref token) = cancel {
                tokio::select! {
                    res = future => res,
                    _ = token.cancelled() => return Err(PlatformError::Cancelled),
                }
            } else {
                future.await
            };
            match result {
                Ok(_resp) => return Ok(()),
                Err(e) if e.is_transient() && attempt < 2 => {
                    if let Some(ref token) = cancel {
                        tokio::select! {
                            _ = tokio::time::sleep(delay) => {}
                            _ = token.cancelled() => return Err(PlatformError::Cancelled),
                        }
                    } else {
                        tokio::time::sleep(delay).await;
                    }
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
        let fut = || async {
            let resp = self
                .http
                .post(&url)
                .json(&RegisterRequest { client_id })
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, None).await
    }

    // ── Preferences ───────────────────────────────────────────────────────────

    pub async fn get_preferences(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<PlatformPreferences, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, cancel).await
    }

    pub async fn update_preferences(
        &self,
        req: UpdatePreferencesRequest,
        cancel: Option<CancellationToken>,
    ) -> Result<PlatformPreferences, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .put(&url)
                .header("Authorization", &auth)
                .json(&req)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, cancel).await
    }

    pub async fn resend_verification(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/resend-verification", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry_no_content(fut, cancel).await
    }

    pub async fn export_gdpr_data(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<serde_json::Value, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/export", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, cancel).await
    }

    pub async fn delete_account(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/preferences/account", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .delete(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry_no_content(fut, cancel).await
    }

    // ── Growth / Referrals ────────────────────────────────────────────────────

    pub async fn create_referral_code(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<ReferralCode, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/referral", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, cancel).await
    }

    pub async fn get_referral_stats(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<ReferralStats, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/referral/stats", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry(fut, cancel).await
    }

    // ── Nudges ────────────────────────────────────────────────────────────────

    pub async fn get_pending_nudges(
        &self,
        cancel: Option<CancellationToken>,
    ) -> Result<Vec<PendingNudge>, PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/nudges/pending", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .get(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            if resp.status() == StatusCode::NO_CONTENT {
                // Return an empty vec without parsing
                return Err(PlatformError::Http {
                    status: 204,
                    body: "".to_string(),
                });
            }
            Self::check_response(resp).await
        };
        match self.retry(fut, cancel).await {
            Ok(v) => Ok(v),
            Err(PlatformError::Http { status, .. }) if status == 204 => Ok(vec![]),
            Err(e) => Err(e),
        }
    }

    pub async fn mark_nudge_delivered(
        &self,
        nudge_id: Uuid,
        cancel: Option<CancellationToken>,
    ) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/nudges/{nudge_id}/delivered", self.base_url);
        let fut = || async {
            let resp = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .send()
                .await?;
            Self::check_response(resp).await
        };
        self.retry_no_content(fut, cancel).await
    }

    // ── Activity events ───────────────────────────────────────────────────────

    /// Send an analytics event.  Only called when the user has opted in.
    pub async fn send_activity_event(
        &self,
        event_type: impl Into<String> + Clone,
        metadata: serde_json::Value,
        cancel: Option<CancellationToken>,
    ) -> Result<(), PlatformError> {
        self.check_enabled()?;
        let auth = self.auth_header()?;
        let url = format!("{}/api/growth/event", self.base_url);
        let event_type_str = event_type.into();

        // Manual retry loop with cancellation
        let mut delay = std::time::Duration::from_millis(100);
        for attempt in 0..3 {
            if let Some(ref token) = cancel {
                if token.is_cancelled() {
                    return Err(PlatformError::Cancelled);
                }
            }
            let req = ActivityEventRequest {
                event_type: event_type_str.clone(),
                metadata: metadata.clone(),
            };
            let resp_result = self
                .http
                .post(&url)
                .header("Authorization", &auth)
                .json(&req)
                .send()
                .await;

            match resp_result {
                Ok(resp) => match Self::check_response(resp).await {
                    Ok(_) => return Ok(()),
                    Err(e) if e.is_transient() && attempt < 2 => {
                        if let Some(ref token) = cancel {
                            tokio::select! {
                                _ = tokio::time::sleep(delay) => {}
                                _ = token.cancelled() => return Err(PlatformError::Cancelled),
                            }
                        } else {
                            tokio::time::sleep(delay).await;
                        }
                        delay *= 2;
                        continue;
                    }
                    Err(e) => return Err(e),
                },
                Err(e) if Self::is_transient_reqwest(&e) && attempt < 2 => {
                    if let Some(ref token) = cancel {
                        tokio::select! {
                            _ = tokio::time::sleep(delay) => {}
                            _ = token.cancelled() => return Err(PlatformError::Cancelled),
                        }
                    } else {
                        tokio::time::sleep(delay).await;
                    }
                    delay *= 2;
                    continue;
                }
                Err(e) => return Err(PlatformError::Network(e)),
            }
        }
        unreachable!()
    }
}
