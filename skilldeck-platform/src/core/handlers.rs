//! Core domain HTTP handlers.

use axum::{Json, extract::State};
use sea_orm::ActiveModelTrait;
use sea_orm::ActiveValue::Set;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    app::AppState,
    core::models::{api_keys, users},
    error::{AppError, Result},
};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    /// A client-generated UUID stable per installation.
    pub client_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub user_id: Uuid,
    /// Raw API key – stored by the client in the OS keychain.
    /// This is the ONLY time the raw key is returned.
    pub api_key: String,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>> {
    let now = chrono::Utc::now().fixed_offset();
    let user_id = body.client_id; // reuse client_id as user_id for stable identity

    // Idempotent: if a user with this id already exists, issue a fresh API key.
    let user_exists = users::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .is_some();

    if !user_exists {
        let user = users::ActiveModel {
            id: Set(user_id),
            created_at: Set(now),
            last_seen: Set(Some(now)),
        };
        user.insert(&state.db).await.map_err(AppError::Db)?;

        // Create default preferences row.
        use crate::preferences::models::user_preferences;
        let prefs = user_preferences::ActiveModel {
            user_id: Set(user_id),
            email: Set(None),
            email_verified: Set(false),
            verification_token: Set(None),
            nudge_frequency: Set("important_only".to_string()),
            nudge_opt_out: Set(false),
            notification_channels: Set(serde_json::json!(["in-app"])),
            theme_preference: Set("system".to_string()),
            timezone: Set(None),
            analytics_opt_in: Set(false),
            created_at: Set(now),
            updated_at: Set(now),
        };
        prefs.insert(&state.db).await.map_err(AppError::Db)?;
    }

    // Generate a fresh random API key.
    let raw_key = generate_api_key();
    let hash = hash_api_key(&raw_key);

    let key_record = api_keys::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        key_hash: Set(hash),
        created_at: Set(now),
    };
    key_record.insert(&state.db).await.map_err(AppError::Db)?;

    Ok(Json(RegisterResponse {
        user_id,
        api_key: raw_key,
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn generate_api_key() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::rng().r#gen();
    format!("sk_{}", hex::encode(bytes))
}

fn hash_api_key(key: &str) -> String {
    use argon2::{
        Argon2,
        password_hash::{PasswordHasher, SaltString},
    };
    use rand::Rng;

    let mut rng = rand::rng();
    let salt = SaltString::generate(&mut rng);
    Argon2::default()
        .hash_password(key.as_bytes(), &salt)
        .expect("hash failed")
        .to_string()
}
