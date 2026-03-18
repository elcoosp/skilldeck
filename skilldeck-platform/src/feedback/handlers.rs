use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, ModelTrait, QueryFilter, QueryOrder, QuerySelect,
    Set,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    app::AppState,
    error::{AppError, Result},
    feedback::models::{self, feedback_comment},
    middleware::AuthUser,
    preferences::models::user_preferences,
};

// -----------------------------------------------------------------------------
// Team membership check
// -----------------------------------------------------------------------------
async fn is_team_member(state: &AppState, user_id: Uuid) -> bool {
    // Fetch user's email from preferences
    let prefs = match user_preferences::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
    {
        Ok(Some(p)) => p,
        _ => return false,
    };

    let email = match prefs.email {
        Some(e) if prefs.email_verified => e,
        _ => return false,
    };

    state.config.team_emails.contains(&email)
}

// -----------------------------------------------------------------------------
// Public endpoint (no auth)
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateFeedbackRequest {
    pub source: String,
    pub source_id: Option<String>,
    pub user_email: Option<String>,
    pub user_name: Option<String>,
    pub content: String,
    pub url: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// POST /api/feedback – public endpoint for docs site feedback.
pub async fn create_feedback(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateFeedbackRequest>,
) -> Result<StatusCode> {
    let now = chrono::Utc::now().fixed_offset();
    let feedback = models::feedback::ActiveModel {
        id: Set(Uuid::new_v4()),
        source: Set(req.source),
        source_id: Set(req.source_id),
        user_email: Set(req.user_email),
        user_name: Set(req.user_name),
        content: Set(req.content),
        url: Set(req.url),
        created_at: Set(now),
        status: Set("new".to_string()),
        assigned_to: Set(None),
        tags: Set(None),
        metadata: Set(req.metadata),
    };
    feedback.insert(&state.db).await.map_err(AppError::Db)?;
    Ok(StatusCode::CREATED)
}

// -----------------------------------------------------------------------------
// Internal endpoints (require auth + team membership)
// -----------------------------------------------------------------------------

// Response DTOs
#[derive(Debug, Serialize)]
pub struct FeedbackResponse {
    pub id: Uuid,
    pub source: String,
    pub source_id: Option<String>,
    pub user_email: Option<String>,
    pub user_name: Option<String>,
    pub content: String,
    pub url: Option<String>,
    pub created_at: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub tags: Vec<String>,
    pub metadata: Option<serde_json::Value>,
    pub comments: Vec<CommentResponse>,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    pub id: Uuid,
    pub author: String,
    pub comment: String,
    pub created_at: String,
}

impl From<models::feedback::Model> for FeedbackResponse {
    fn from(m: models::feedback::Model) -> Self {
        // Convert Json tags back to Vec<String> (if present)
        let tags = m
            .tags
            .and_then(|t| serde_json::from_value(t).ok())
            .unwrap_or_default();

        Self {
            id: m.id,
            source: m.source,
            source_id: m.source_id,
            user_email: m.user_email,
            user_name: m.user_name,
            content: m.content,
            url: m.url,
            created_at: m.created_at.to_rfc3339(),
            status: m.status,
            assigned_to: m.assigned_to,
            tags,
            metadata: m.metadata,
            comments: vec![], // filled separately
        }
    }
}

impl From<feedback_comment::Model> for CommentResponse {
    fn from(m: feedback_comment::Model) -> Self {
        Self {
            id: m.id,
            author: m.author,
            comment: m.comment,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

// Query parameters for list
#[derive(Debug, Deserialize)]
pub struct ListFeedbackParams {
    pub source: Option<String>,
    pub status: Option<String>,
    pub tag: Option<String>,
    pub page: Option<u64>,
    pub per_page: Option<u64>,
}

/// GET /api/feedback – list feedback (team only)
pub async fn list_feedback(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListFeedbackParams>,
) -> Result<Json<Vec<FeedbackResponse>>> {
    if !is_team_member(&state, user_id).await {
        return Err(AppError::Unauthorized);
    }

    let mut query =
        models::feedback::Entity::find().order_by_desc(models::feedback::Column::CreatedAt);

    if let Some(source) = params.source {
        query = query.filter(models::feedback::Column::Source.eq(source));
    }
    if let Some(status) = params.status {
        query = query.filter(models::feedback::Column::Status.eq(status));
    }
    // TODO: tag filtering would require JSONB containment; skip for now
    // if let Some(tag) = params.tag {
    //     query = query.filter(models::feedback::Column::Tags.contains(vec![tag]));
    // }

    let per_page = params.per_page.unwrap_or(50).min(100);
    let page = params.page.unwrap_or(0);
    query = query.limit(per_page).offset(page * per_page);

    let feedback_items = query.all(&state.db).await.map_err(AppError::Db)?;

    // Load comments for all feedback items in one query
    let ids: Vec<Uuid> = feedback_items.iter().map(|f| f.id).collect();
    let comments = feedback_comment::Entity::find()
        .filter(feedback_comment::Column::FeedbackId.is_in(ids))
        .all(&state.db)
        .await
        .map_err(AppError::Db)?;

    // Group comments by feedback_id
    let mut comments_by_feedback = std::collections::HashMap::new();
    for comment in comments {
        comments_by_feedback
            .entry(comment.feedback_id)
            .or_insert_with(Vec::new)
            .push(comment);
    }

    let responses = feedback_items
        .into_iter()
        .map(|f| {
            let mut resp: FeedbackResponse = f.clone().into();
            resp.comments = comments_by_feedback
                .remove(&f.id)
                .unwrap_or_default()
                .into_iter()
                .map(Into::into)
                .collect();
            resp
        })
        .collect();

    Ok(Json(responses))
}

/// GET /api/feedback/:id – get single feedback with comments
pub async fn get_feedback(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<FeedbackResponse>> {
    if !is_team_member(&state, user_id).await {
        return Err(AppError::Unauthorized);
    }

    let feedback = models::feedback::Entity::find_by_id(id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Feedback not found".into()))?;

    let comments = feedback
        .find_related(feedback_comment::Entity)
        .all(&state.db)
        .await
        .map_err(AppError::Db)?;

    let mut resp: FeedbackResponse = feedback.into();
    resp.comments = comments.into_iter().map(Into::into).collect();
    Ok(Json(resp))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFeedbackRequest {
    pub status: Option<String>,
    pub assigned_to: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// PUT /api/feedback/:id – update feedback status, assignee, tags
pub async fn update_feedback(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateFeedbackRequest>,
) -> Result<Json<FeedbackResponse>> {
    if !is_team_member(&state, user_id).await {
        return Err(AppError::Unauthorized);
    }

    let feedback = models::feedback::Entity::find_by_id(id)
        .one(&state.db)
        .await
        .map_err(AppError::Db)?
        .ok_or_else(|| AppError::NotFound("Feedback not found".into()))?;

    let old_status = feedback.status.clone();
    let mut active: models::feedback::ActiveModel = feedback.into();

    if let Some(status) = req.status {
        active.status = Set(status);
    }
    if let Some(assigned_to) = req.assigned_to {
        active.assigned_to = Set(Some(assigned_to));
    }
    if let Some(tags) = req.tags {
        let tags_json = serde_json::to_value(tags)
            .map_err(|_| AppError::BadRequest("Invalid tags format".into()))?;
        active.tags = Set(Some(tags_json));
    }

    let updated: models::feedback::Model = active.update(&state.db).await.map_err(AppError::Db)?;

    // If status changed to resolved, notify user if they left email
    if updated.status == "resolved" && old_status != "resolved" {
        if let Some(email) = updated.user_email.clone() {
            // Clone url before moving into task to avoid partial move
            let url = updated.url.clone();
            let state_clone = state.clone();
            tokio::spawn(async move {
                let _ = notify_resolved(state_clone, email, url.as_deref()).await;
            });
        }
    }

    // Reload comments
    let comments = updated
        .find_related(feedback_comment::Entity)
        .all(&state.db)
        .await
        .map_err(AppError::Db)?;
    let mut resp: FeedbackResponse = updated.into();
    resp.comments = comments.into_iter().map(Into::into).collect();
    Ok(Json(resp))
}

async fn notify_resolved(state: Arc<AppState>, email: String, url: Option<&str>) {
    let subject = "Your feedback has been resolved 🎉";
    let body = format!(
        "Thank you for your feedback. We've addressed it. See here: {}",
        url.unwrap_or("our platform")
    );
    let _ = state.email.send(&email, subject, &body).await;
}

#[derive(Debug, Deserialize)]
pub struct AddCommentRequest {
    pub comment: String,
}

/// POST /api/feedback/:id/comments – add internal comment
pub async fn add_comment(
    Extension(AuthUser(user_id)): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(feedback_id): Path<Uuid>,
    Json(req): Json<AddCommentRequest>,
) -> Result<StatusCode> {
    if !is_team_member(&state, user_id).await {
        return Err(AppError::Unauthorized);
    }

    let now = chrono::Utc::now().fixed_offset();
    let comment = feedback_comment::ActiveModel {
        id: Set(Uuid::new_v4()),
        feedback_id: Set(feedback_id),
        author: Set(user_id.to_string()), // store user id; could fetch name later
        comment: Set(req.comment),
        created_at: Set(now),
    };
    comment.insert(&state.db).await.map_err(AppError::Db)?;
    Ok(StatusCode::CREATED)
}
