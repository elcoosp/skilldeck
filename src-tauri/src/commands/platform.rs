//! Tauri commands for SkillDeck Platform integration.
//!
//! All commands that call the platform first check that platform features are
//! enabled and that credentials have been initialised.
use specta::specta;

use std::sync::Arc;
use tauri::State;
use tauri_plugin_keyring::KeyringExt;
use tracing::info;
use uuid::Uuid;

use crate::platform_client::{
    PendingNudge, PlatformError, PlatformPreferences, ReferralStats, UpdatePreferencesRequest,
};
use crate::state::AppState;

const KEYRING_SERVICE: &str = "skilldeck";
const PLATFORM_KEY_ACCOUNT: &str = "platform_api_key";

// ── Error conversion ──────────────────────────────────────────────────────────

fn map_err(e: PlatformError) -> String {
    e.to_string()
}

// ── Registration ──────────────────────────────────────────────────────────────

/// Ensure the app is registered with the platform.
///
/// Called lazily before the first platform feature is used.  If credentials
/// already exist in the keychain the function is a no-op.  Otherwise it
/// registers with the platform, stores the API key in the keychain, and
/// persists the `platform_user_id` in the local `user_preferences` table.
#[specta]
#[tauri::command]
pub async fn ensure_platform_registration(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    // Check whether we already have a stored key.
    let keyring = app.keyring();
    if let Ok(maybe_key) = keyring.get_password(KEYRING_SERVICE, PLATFORM_KEY_ACCOUNT)
        && maybe_key.is_some()
    {
        info!("Platform API key already stored – skipping registration");
        return Ok(());
    }

    // Not yet registered – call the platform.
    let client = state.platform_client.read().await;
    if !client.enabled {
        return Err("Platform features are disabled".to_string());
    }

    let client_id = Uuid::new_v4();
    let resp = client.register(client_id).await.map_err(map_err)?;

    // Persist API key in OS keychain.
    keyring
        .set_password(KEYRING_SERVICE, PLATFORM_KEY_ACCOUNT, &resp.api_key)
        .map_err(|e| format!("Keychain write failed: {e}"))?;

    // Persist user_id in local DB.
    use sea_orm::{ActiveModelTrait, ActiveValue::Set};
    use skilldeck_models::user_preferences;

    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().fixed_offset();
    let pref = user_preferences::ActiveModel {
        id: Set(Uuid::new_v4()),
        platform_user_id: Set(resp.user_id),
        platform_key_stored: Set(true),
        platform_url: Set(None),
        nudge_frequency: Set("important_only".to_string()),
        nudge_opt_out: Set(false),
        notification_channels: Set(serde_json::json!(["in-app"])),
        theme_preference: Set("system".to_string()),
        timezone: Set(None),
        analytics_opt_in: Set(false),
        platform_features_enabled: Set(true),
        created_at: Set(now),
        updated_at: Set(now),
    };
    pref.insert(db).await.map_err(|e| e.to_string())?;

    info!("Registered with platform, user_id = {}", resp.user_id);
    Ok(())
}

// ── Preferences ───────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_platform_preferences(
    state: State<'_, Arc<AppState>>,
) -> Result<PlatformPreferences, String> {
    state
        .platform_client
        .read()
        .await
        .get_preferences(None)
        .await
        .map_err(map_err)
}

#[derive(serde::Deserialize)]
pub struct UpdatePrefsPayload {
    pub email: Option<String>,
    pub nudge_frequency: Option<String>,
    pub nudge_opt_out: Option<bool>,
    pub notification_channels: Option<Vec<String>>,
    pub theme_preference: Option<String>,
    pub timezone: Option<String>,
    pub analytics_opt_in: Option<bool>,
}

#[specta]
#[tauri::command]
pub async fn update_platform_preferences(
    payload: UpdatePrefsPayload,
    state: State<'_, Arc<AppState>>,
) -> Result<PlatformPreferences, String> {
    let req = UpdatePreferencesRequest {
        email: payload.email,
        nudge_frequency: payload.nudge_frequency,
        nudge_opt_out: payload.nudge_opt_out,
        notification_channels: payload.notification_channels,
        theme_preference: payload.theme_preference,
        timezone: payload.timezone,
        analytics_opt_in: payload.analytics_opt_in,
    };
    state
        .platform_client
        .read()
        .await
        .update_preferences(req, None)
        .await
        .map_err(map_err)
}

#[specta]
#[tauri::command]
pub async fn resend_verification_email(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state
        .platform_client
        .read()
        .await
        .resend_verification(None)
        .await
        .map_err(map_err)
}

#[specta]
#[tauri::command]
pub async fn export_gdpr_data(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    state
        .platform_client
        .read()
        .await
        .export_gdpr_data(None)
        .await
        .map_err(map_err)
}

#[specta]
#[tauri::command]
pub async fn delete_platform_account(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    state
        .platform_client
        .read()
        .await
        .delete_account(None)
        .await
        .map_err(map_err)?;

    // Remove keychain entry.
    let keyring = app.keyring();
    let _ = keyring.delete_password(KEYRING_SERVICE, PLATFORM_KEY_ACCOUNT);

    Ok(())
}

// ── Referrals ─────────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn create_referral_code(
    state: State<'_, Arc<AppState>>,
) -> Result<crate::platform_client::ReferralCode, String> {
    state
        .platform_client
        .read()
        .await
        .create_referral_code(None)
        .await
        .map_err(map_err)
}

#[specta]
#[tauri::command]
pub async fn get_referral_stats(state: State<'_, Arc<AppState>>) -> Result<ReferralStats, String> {
    state
        .platform_client
        .read()
        .await
        .get_referral_stats(None)
        .await
        .map_err(map_err)
}

// ── Nudges ────────────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_pending_nudges(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PendingNudge>, String> {
    state
        .platform_client
        .read()
        .await
        .get_pending_nudges(None)
        .await
        .map_err(map_err)
}

// ── Activity events ───────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct ActivityEventPayload {
    pub event_type: String,
    pub metadata: Option<serde_json::Value>,
}

#[specta]
#[tauri::command]
pub async fn send_activity_event(
    payload: ActivityEventPayload,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    // Only forward if analytics consent was given.
    let client = state.platform_client.read().await;
    if !state
        .analytics_opt_in
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Ok(());
    }
    client
        .send_activity_event(
            payload.event_type,
            payload.metadata.unwrap_or(serde_json::json!({})),
            None,
        )
        .await
        .map_err(map_err)
}
