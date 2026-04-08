//! Axum authentication middleware.
//!
//! Extracts the bearer token from the `Authorization` header, looks up the
//! hashed value in `api_keys`, and injects `AuthUser` into request extensions.

use axum::{
    extract::State,
    http::{HeaderMap, Request},
    middleware::Next,
    response::Response,
};
use sea_orm::EntityTrait;
use std::sync::Arc;
use uuid::Uuid;

use crate::{app::AppState, core::models as core_models, error::AppError};

/// The authenticated user id, injected by `auth_middleware`.
#[derive(Debug, Clone)]
pub struct AuthUser(pub Uuid);

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AppError> {
    let headers = req.headers();
    let token = extract_bearer(headers).ok_or(AppError::Unauthorized)?;

    let user_id = verify_api_key(&state.db, &token).await?;
    req.extensions_mut().insert(AuthUser(user_id));

    // Update last_seen.
    use sea_orm::ActiveModelTrait;
    let now = chrono::Utc::now().fixed_offset();
    let user_am = core_models::users::ActiveModel {
        id: sea_orm::ActiveValue::Unchanged(user_id),
        last_seen: sea_orm::ActiveValue::Set(Some(now)),
        ..Default::default()
    };
    let _ = user_am.update(&state.db).await;

    Ok(next.run(req).await)
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_owned())
}

async fn verify_api_key(db: &sea_orm::DatabaseConnection, token: &str) -> Result<Uuid, AppError> {
    // TODO: Add key_prefix column (first 8 chars) for indexed lookup to avoid
    // scanning all rows. For now, fetch all rows but the table is expected to be small.
    let rows = core_models::api_keys::Entity::find()
        .all(db)
        .await
        .map_err(AppError::Db)?;

    for row in rows {
        if argon2_verify(&row.key_hash, token) {
            return Ok(row.user_id);
        }
    }
    Err(AppError::Unauthorized)
}

fn argon2_verify(hash: &str, password: &str) -> bool {
    use argon2::Argon2;
    use argon2::password_hash::{PasswordVerifier, phc::PasswordHash};
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}
