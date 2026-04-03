// src-tauri/src/commands/platform.rs
//! Platform-related Tauri commands (preferences, referrals, nudges, sharing)

use crate::platform_client::{
    ActivityEventRequest, PendingNudge, PlatformPreferences, ReferralCode, ReferralStats,
    ShareResponse, SharedConversationPayload, SyncConversationRequest, SyncConversationResponse,
    SyncStatusResponse, UpdatePreferencesRequest,
};
use crate::state::AppState;
use specta::specta;
use std::sync::Arc;
use tauri::Manager; // <-- add for .path()
use tauri::State;
use tauri_plugin_keyring::KeyringExt; // <-- add for .keyring()
use uuid::Uuid;

// ── Registration ─────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn ensure_platform_registration(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let client_id = {
        let data_dir = state
            .app_handle
            .path()
            .app_data_dir()
            .map_err(|e: tauri::Error| e.to_string())?;
        let id_file = data_dir.join("client_id");
        if id_file.exists() {
            let id_str = tokio::fs::read_to_string(&id_file)
                .await
                .map_err(|e: std::io::Error| e.to_string())?;
            Uuid::parse_str(&id_str).map_err(|e| e.to_string())?
        } else {
            let id = Uuid::new_v4();
            tokio::fs::write(&id_file, id.to_string())
                .await
                .map_err(|e: std::io::Error| e.to_string())?;
            id
        }
    };

    let (user_id, api_key) = {
        let client = state.platform_client.read().await;
        let resp = client
            .register(client_id) // <-- removed extra None argument
            .await
            .map_err(|e| e.to_string())?;
        (resp.user_id, resp.api_key)
    };

    // Store API key in keychain
    let keyring = state.app_handle.keyring();
    keyring
        .set_password("skilldeck", "platform_api_key", &api_key)
        .map_err(|e| e.to_string())?;

    // Store user_id in local DB preferences
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
    use skilldeck_models::user_preferences::Entity as UserPrefs;

    let existing = UserPrefs::find().one(db).await.map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().fixed_offset();
    if let Some(prefs) = existing {
        let mut active: skilldeck_models::user_preferences::ActiveModel = prefs.into();
        active.platform_user_id = Set(user_id);
        active.platform_key_stored = Set(true);
        active.updated_at = Set(now);
        active.update(db).await.map_err(|e| e.to_string())?;
    } else {
        let new_prefs = skilldeck_models::user_preferences::ActiveModel {
            id: Set(Uuid::new_v4()),
            platform_user_id: Set(user_id),
            platform_key_stored: Set(true),
            platform_url: Set(Some(state.config.platform.url.clone())),
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
        new_prefs.insert(db).await.map_err(|e| e.to_string())?;
    }

    // Update in-memory client with the new API key
    {
        let mut client = state.platform_client.write().await;
        client.set_api_key(api_key);
    }

    Ok(())
}

// ── Preferences ─────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_platform_preferences(
    state: State<'_, Arc<AppState>>,
) -> Result<PlatformPreferences, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use sea_orm::EntityTrait;
    use skilldeck_models::user_preferences::Entity as UserPrefs;

    let prefs = UserPrefs::find()
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Platform preferences not initialized".to_string())?;

    Ok(PlatformPreferences {
        email: None,
        email_verified: false,
        nudge_frequency: prefs.nudge_frequency,
        nudge_opt_out: prefs.nudge_opt_out,
        notification_channels: serde_json::from_value(prefs.notification_channels)
            .unwrap_or_default(),
        theme_preference: prefs.theme_preference,
        timezone: prefs.timezone,
        analytics_opt_in: prefs.analytics_opt_in,
    })
}

#[specta]
#[tauri::command]
pub async fn update_platform_preferences(
    state: State<'_, Arc<AppState>>,
    payload: UpdatePreferencesRequest,
) -> Result<PlatformPreferences, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
    use skilldeck_models::user_preferences::Entity as UserPrefs;

    let existing = UserPrefs::find()
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Platform preferences not initialized".to_string())?;

    let mut active: skilldeck_models::user_preferences::ActiveModel = existing.into();
    let now = chrono::Utc::now().fixed_offset();

    // Borrow fields to avoid moving payload
    if let Some(ref freq) = payload.nudge_frequency {
        active.nudge_frequency = Set(freq.clone());
    }
    if let Some(ref opt_out) = payload.nudge_opt_out {
        active.nudge_opt_out = Set(*opt_out);
    }
    if let Some(ref channels) = payload.notification_channels {
        active.notification_channels = Set(serde_json::to_value(channels).unwrap());
    }
    if let Some(ref theme) = payload.theme_preference {
        active.theme_preference = Set(theme.clone());
    }
    if let Some(ref tz) = payload.timezone {
        active.timezone = Set(Some(tz.clone()));
    }
    if let Some(ref analytics) = payload.analytics_opt_in {
        active.analytics_opt_in = Set(*analytics);
    }
    active.updated_at = Set(now);
    active.update(db).await.map_err(|e| e.to_string())?;

    // Also sync to platform if configured – drop the read guard before calling other functions
    {
        let client = state.platform_client.read().await;
        if client.is_configured() {
            // Clone payload to avoid moving; we already borrowed above
            let _ = client.update_preferences(payload, None).await;
        }
    } // client guard dropped here

    get_platform_preferences(state).await
}

#[specta]
#[tauri::command]
pub async fn resend_verification_email(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let client = state.platform_client.read().await;
    client
        .resend_verification(None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn export_gdpr_data(
    state: State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let client = state.platform_client.read().await;
    client
        .export_gdpr_data(None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn delete_platform_account(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let client = state.platform_client.read().await;
    client.delete_account(None).await.map_err(|e| e.to_string())
}

// ── Referrals ────────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn create_referral_code(state: State<'_, Arc<AppState>>) -> Result<ReferralCode, String> {
    let client = state.platform_client.read().await;
    client
        .create_referral_code(None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn get_referral_stats(state: State<'_, Arc<AppState>>) -> Result<ReferralStats, String> {
    let client = state.platform_client.read().await;
    client
        .get_referral_stats(None)
        .await
        .map_err(|e| e.to_string())
}

// ── Nudges ───────────────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_pending_nudges(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PendingNudge>, String> {
    let client = state.platform_client.read().await;
    client
        .get_pending_nudges(None)
        .await
        .map_err(|e| e.to_string())
}

// ── Activity events ──────────────────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn send_activity_event(
    state: State<'_, Arc<AppState>>,
    payload: ActivityEventRequest,
) -> Result<(), String> {
    let client = state.platform_client.read().await;
    client
        .send_activity_event(payload.event_type, payload.metadata, None)
        .await
        .map_err(|e| e.to_string())
}

// ── Shared conversation commands ────────────────────────────────────────────

#[specta]
#[tauri::command]
pub async fn get_shared_conversation(
    state: State<'_, Arc<AppState>>,
    share_token: String,
) -> Result<SharedConversationPayload, String> {
    let client = state.platform_client.read().await;
    client
        .get_shared_conversation(&share_token, None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn check_sync_status(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<SyncStatusResponse, String> {
    let client = state.platform_client.read().await;
    client
        .check_sync_status(&conversation_id, None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn share_conversation(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<ShareResponse, String> {
    let client = state.platform_client.read().await;
    client
        .share_conversation(&conversation_id, None)
        .await
        .map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn sync_conversation_to_platform(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    payload: SyncConversationRequest,
) -> Result<SyncConversationResponse, String> {
    let client = state.platform_client.read().await;
    client
        .sync_conversation_to_platform(&conversation_id, payload, None)
        .await
        .map_err(|e| e.to_string())
}
