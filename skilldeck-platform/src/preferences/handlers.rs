//! Preferences domain HTTP handlers.

use axum::{
    Extension, Json,
    extract::{Query, State},
    http::StatusCode,
};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, PaginatorTrait};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{
    app::AppState,
    core::models::users,
    error::{AppError, Result},
    middleware::AuthUser,
    preferences::models::user_preferences,
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PreferencesResponse {
    pub email: Option<String>,
    pub email_verified: bool,
    pub nudge_frequency: String,
    pub nudge_opt_out: bool,
    pub notification_channels: Vec<String>,
    pub theme_preference: String,
    pub timezone: Option<String>,
    pub analytics_opt_in: bool,
}

impl From<user_preferences::Model> for PreferencesResponse {
    fn from(m: user_preferences::Model) -> Self {
        let channels = serde_json::from_value(m.notification_channels).unwrap_or_default();
        Self {
            email: m.email,
            email_verified: m.email_verified,
            nudge_frequency: m.nudge_frequency,
            nudge_opt_out: m.nudge_opt_out,
            notification_channels: channels,
            theme_preference: m.theme_preference,
            timezone: m.timezone,
            analytics_opt_in: m.analytics_opt_in,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub email: Option<String>,
    pub nudge_frequency: Option<String>,
    pub nudge_opt_out: Option<bool>,
    pub notification_channels: Option<Vec<String>>,
    pub theme_preference: Option<String>,
    pub timezone: Option<String>,
    pub analytics_opt_in: Option<bool>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn get_preferences(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<PreferencesResponse>> {
    let prefs = user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Preferences not found".into()))?;
    Ok(Json(prefs.into()))
}

pub async fn update_preferences(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Json(body): Json<UpdatePreferencesRequest>,
) -> Result<Json<PreferencesResponse>> {
    let existing = user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Preferences not found".into()))?;

    let now = chrono::Utc::now().fixed_offset();
    let mut am: user_preferences::ActiveModel = existing.into();
    am.updated_at = Set(now);

    if let Some(email) = body.email {
        // If email changed, re-verify.
        let token = generate_token();
        am.email = Set(Some(email.clone()));
        am.email_verified = Set(false);
        am.verification_token = Set(Some(token.clone()));

        // Fire verification email (best-effort).
        let _ = state.email.send_verification(&email, &token).await;
    }
    if let Some(freq) = body.nudge_frequency {
        am.nudge_frequency = Set(freq);
    }
    if let Some(opt_out) = body.nudge_opt_out {
        am.nudge_opt_out = Set(opt_out);
    }
    if let Some(channels) = body.notification_channels {
        am.notification_channels = Set(serde_json::to_value(channels).unwrap());
    }
    if let Some(theme) = body.theme_preference {
        am.theme_preference = Set(theme);
    }
    if let Some(tz) = body.timezone {
        am.timezone = Set(Some(tz));
    }
    if let Some(opt_in) = body.analytics_opt_in {
        am.analytics_opt_in = Set(opt_in);
    }

    let updated = am.update(&state.db).await.map_err(AppError::Db)?;
    Ok(Json(updated.into()))
}

#[derive(Deserialize)]
pub struct VerifyQuery {
    pub token: String,
}

pub async fn verify_email(
    Query(q): Query<VerifyQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<(StatusCode, Json<serde_json::Value>)> {
    use sea_orm::{ColumnTrait, QueryFilter};

    let prefs = user_preferences::Entity::find()
        .filter(
            user_preferences::COLUMN
                .verification_token
                .eq(q.token.as_str()),
        )
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::BadRequest("Invalid verification token".into()))?;

    let mut am: user_preferences::ActiveModel = prefs.into();
    am.email_verified = Set(true);
    am.verification_token = Set(None);
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&state.db).await.map_err(AppError::Db)?;

    Ok((StatusCode::OK, Json(json!({ "verified": true }))))
}

pub async fn resend_verification(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode> {
    let prefs = user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Preferences not found".into()))?;

    let email = prefs
        .email
        .clone()
        .ok_or_else(|| AppError::BadRequest("No email address set".into()))?;

    let token = generate_token();
    let mut am: user_preferences::ActiveModel = prefs.into();
    am.verification_token = Set(Some(token.clone()));
    am.email_verified = Set(false);
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&state.db).await.map_err(AppError::Db)?;

    let _ = state.email.send_verification(&email, &token).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_gdpr_data(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>> {
    let prefs = user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?;

    Ok(Json(json!({
        "user_id": user_id,
        "preferences": prefs,
    })))
}

pub async fn delete_account(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode> {
    // Cascade deletes handle all child rows via FK.
    users::Entity::delete_by_id(user_id)
        .exec(&state.db)
        .await
        .map_err(AppError::Db)?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn generate_token() -> String {
    use rand::Rng;
    let bytes: [u8; 24] = rand::rng().r#gen();
    hex::encode(bytes)
}
