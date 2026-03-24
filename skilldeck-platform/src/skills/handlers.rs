//! Axum HTTP handlers for the skills registry API.

use crate::app::AppState;
use crate::skills::models::{Entity as Skills, Pagination, SkillResponse};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use std::sync::Arc;
use uuid::Uuid;

/// GET /api/skills
///
/// List skills with optional filtering by category, tags, and free-text search.
pub async fn list_skills(
    State(state): State<Arc<AppState>>, // Changed from State<AppState> to State<Arc<AppState>>
    Query(params): Query<Pagination>,
) -> Result<Json<Vec<SkillResponse>>, (StatusCode, String)> {
    use crate::skills::models::Column;

    let db = &state.db;
    let per_page = params.per_page.unwrap_or(50).min(200);
    let page = params.page.unwrap_or(0);

    let mut query = Skills::find()
        .order_by_desc(Column::QualityScore)
        .order_by_desc(Column::UpdatedAt)
        .limit(per_page)
        .offset(page * per_page);

    if let Some(ref category) = params.category {
        query = query.filter(Column::Category.eq(category));
    }

    if let Some(ref search) = params.search {
        // Simple LIKE search on name and description.
        use sea_orm::Condition;
        let pattern = format!("%{}%", search);
        query = query.filter(
            Condition::any()
                .add(Column::Name.like(pattern.clone()))
                .add(Column::Description.like(pattern)),
        );
    }

    let skills = query
        .all(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(skills.into_iter().map(SkillResponse::from).collect()))
}

/// GET /api/skills/:id
pub async fn get_skill(
    State(state): State<Arc<AppState>>, // Changed
    Path(id): Path<String>,
) -> Result<Json<SkillResponse>, (StatusCode, String)> {
    let uuid =
        Uuid::parse_str(&id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid UUID".to_string()))?;

    let skill = Skills::find_by_id(uuid)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Skill {} not found", id)))?;

    Ok(Json(SkillResponse::from(skill)))
}

/// GET /api/skills/search?q=...
pub async fn search_skills(
    State(state): State<Arc<AppState>>, // Changed
    Query(params): Query<Pagination>,
) -> Result<Json<Vec<SkillResponse>>, (StatusCode, String)> {
    // Delegate to list_skills with search param forwarded.
    list_skills(State(state), Query(params)).await
}

/// GET /api/skills/sync?since=<timestamp>
///
/// Returns skills updated after the given timestamp for delta syncing.
pub async fn sync(
    State(state): State<Arc<AppState>>, // Changed
    Query(params): Query<SyncParams>,
) -> Result<Json<SyncResponse>, (StatusCode, String)> {
    use crate::skills::models::Column;

    let since = params
        .since
        .and_then(|ts| chrono::DateTime::parse_from_rfc3339(&ts).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc).fixed_offset());

    let mut query = Skills::find().order_by_asc(Column::UpdatedAt);
    if let Some(since_dt) = since {
        query = query.filter(Column::UpdatedAt.gt(since_dt));
    }

    let skills = query
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let responses: Vec<SkillResponse> = skills.into_iter().map(SkillResponse::from).collect();
    let now = chrono::Utc::now().to_rfc3339();

    Ok(Json(SyncResponse {
        skills: responses,
        synced_at: now,
    }))
}

#[derive(serde::Deserialize)]
pub struct SyncParams {
    pub since: Option<String>,
}

#[derive(serde::Serialize)]
pub struct SyncResponse {
    pub skills: Vec<SkillResponse>,
    pub synced_at: String,
}
