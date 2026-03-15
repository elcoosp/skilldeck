//! Growth domain HTTP handlers — referrals, activity events, nudges.

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    app::AppState,
    error::{AppError, Result},
    growth::models::{activity_events, pending_nudges, referral_codes, referral_signups},
    middleware::AuthUser,
    preferences::models::user_preferences,
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ReferralCodeResponse {
    pub id: Uuid,
    pub code: String,
    pub uses: i32,
    pub max_uses: i32,
    pub created_at: String,
}

impl From<referral_codes::Model> for ReferralCodeResponse {
    fn from(m: referral_codes::Model) -> Self {
        Self {
            id: m.id,
            code: m.code,
            uses: m.uses,
            max_uses: m.max_uses,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ReferralStatsResponse {
    pub code: ReferralCodeResponse,
    pub total_signups: u64,
    pub total_conversions: u64,
    pub rewards_earned: String,
}

#[derive(Debug, Serialize)]
pub struct PendingNudgeResponse {
    pub id: Uuid,
    pub message: String,
    pub cta_label: Option<String>,
    pub cta_action: Option<String>,
    pub created_at: String,
}

impl From<pending_nudges::Model> for PendingNudgeResponse {
    fn from(m: pending_nudges::Model) -> Self {
        Self {
            id: m.id,
            message: m.message,
            cta_label: m.cta_label,
            cta_action: m.cta_action,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ActivityEventRequest {
    pub event_type: String,
    pub metadata: Option<serde_json::Value>,
}

// ── Referral handlers ─────────────────────────────────────────────────────────

/// Create (or return existing) referral code for the authenticated user.
pub async fn create_referral_code(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReferralCodeResponse>> {
    // Return existing code if present.
    if let Some(existing) = referral_codes::Entity::find()
        .filter(referral_codes::COLUMN.user_id.eq(user_id))
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
    {
        return Ok(Json(existing.into()));
    }

    let now = chrono::Utc::now().fixed_offset();
    let code = generate_referral_code();

    let record = referral_codes::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        code: Set(code),
        created_at: Set(now),
        uses: Set(0),
        max_uses: Set(10),
    };

    let inserted = record.insert(&state.db).await.map_err(AppError::Db)?;
    Ok(Json(inserted.into()))
}

pub async fn get_referral_stats(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReferralStatsResponse>> {
    let code = referral_codes::Entity::find()
        .filter(referral_codes::COLUMN.user_id.eq(user_id))
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("No referral code found – create one first".into()))?;

    let signups = referral_signups::Entity::find()
        .filter(referral_signups::COLUMN.code_id.eq(code.id))
        .all(&state.db)
        .await
        .map_err(AppError::Db)?;

    let total_signups = signups.len() as u64;
    let total_conversions = signups.iter().filter(|s| s.converted_at.is_some()).count() as u64;
    // Simple reward tier: 1 month free per 5 conversions.
    let months = total_conversions / 5;
    let rewards_earned = if months == 0 {
        "No rewards yet — share your code!".to_string()
    } else {
        format!("{months} month{} free", if months == 1 { "" } else { "s" })
    };

    Ok(Json(ReferralStatsResponse {
        code: code.into(),
        total_signups,
        total_conversions,
        rewards_earned,
    }))
}

/// Validate a referral code and record the signup.
pub async fn validate_referral_code(
    Path(code): Path<String>,
    State(state): State<Arc<AppState>>,
    // IP is read from the forwarded header for fraud prevention.
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
) -> Result<Json<serde_json::Value>> {
    let referral = referral_codes::Entity::find()
        .filter(referral_codes::COLUMN.code.eq(&code))
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Referral code not found".into()))?;

    if referral.uses >= referral.max_uses {
        return Err(AppError::Conflict(
            "Referral code has reached its usage limit".into(),
        ));
    }

    // Fraud prevention: limit 3 signups per IP per 24 h.
    let ip = addr.ip().to_string();
    let cutoff = chrono::Utc::now()
        .fixed_offset()
        .checked_sub_signed(chrono::Duration::hours(24))
        .unwrap();

    let recent_ip_count = referral_signups::Entity::find()
        .filter(referral_signups::COLUMN.referred_ip.eq(ip.as_str()))
        .filter(referral_signups::COLUMN.signed_up_at.gte(cutoff))
        .count(&state.db)
        .await
        .map_err(AppError::Db)?;

    if recent_ip_count >= 3 {
        return Err(AppError::Conflict(
            "Too many signups from this IP in the last 24 hours".into(),
        ));
    }

    let now = chrono::Utc::now().fixed_offset();
    let signup = referral_signups::ActiveModel {
        id: Set(Uuid::new_v4()),
        code_id: Set(referral.id),
        referred_email: Set(None),
        referred_ip: Set(Some(ip)),
        signed_up_at: Set(now),
        converted_at: Set(None),
    };
    signup.insert(&state.db).await.map_err(AppError::Db)?;

    // Increment uses counter.
    let mut code_am: referral_codes::ActiveModel = referral.into();
    code_am.uses = Set({
        let prev = match &code_am.uses {
            sea_orm::ActiveValue::Unchanged(v) => *v,
            _ => 0,
        };
        prev + 1
    });
    code_am.update(&state.db).await.map_err(AppError::Db)?;

    Ok(Json(json!({ "valid": true })))
}

// ── Nudge handlers ────────────────────────────────────────────────────────────

pub async fn get_pending_nudges(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<PendingNudgeResponse>>> {
    let nudges = pending_nudges::Entity::find()
        .filter(pending_nudges::COLUMN.user_id.eq(user_id))
        .filter(pending_nudges::COLUMN.delivered_at.is_null())
        .all(&state.db)
        .await
        .map_err(AppError::Db)?;

    Ok(Json(nudges.into_iter().map(Into::into).collect()))
}

pub async fn mark_nudge_delivered(
    Path(nudge_id): Path<Uuid>,
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode> {
    let nudge = pending_nudges::Entity::find_by_id(nudge_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Nudge not found".into()))?;

    if nudge.user_id != user_id {
        return Err(AppError::Unauthorized);
    }

    let mut am: pending_nudges::ActiveModel = nudge.into();
    am.delivered_at = Set(Some(chrono::Utc::now().fixed_offset()));
    am.update(&state.db).await.map_err(AppError::Db)?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Activity event handler ────────────────────────────────────────────────────

pub async fn track_event(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Json(body): Json<ActivityEventRequest>,
) -> Result<StatusCode> {
    // Only persist if the user has analytics consent.
    let prefs = user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?;

    let analytics_ok = prefs.map(|p| p.analytics_opt_in).unwrap_or(false);
    if !analytics_ok {
        return Ok(StatusCode::NO_CONTENT);
    }

    let record = activity_events::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        event_type: Set(body.event_type),
        metadata: Set(body.metadata.unwrap_or(serde_json::json!({}))),
        created_at: Set(chrono::Utc::now().fixed_offset()),
    };
    record.insert(&state.db).await.map_err(AppError::Db)?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn generate_referral_code() -> String {
    use rand::Rng;
    use rand::distr::Alphanumeric;

    rand::rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(|c| c as char)
        .map(|c| c.to_ascii_uppercase())
        .collect()
}
