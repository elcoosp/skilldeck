use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryFilter, QueryOrder};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::bookmarks::{self, Entity as Bookmarks};

#[derive(Debug, Clone, Serialize, Type)]
pub struct BookmarkData {
    pub id: String,
    pub message_id: String,
    pub heading_anchor: Option<String>,
    pub label: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize, Type)]
pub struct CreateBookmarkRequest {
    pub conversation_id: String,
    pub message_id: String,
    pub heading_anchor: Option<String>,
    pub label: Option<String>,
}

#[specta]
#[tauri::command]
pub async fn add_bookmark(
    state: State<'_, Arc<AppState>>,
    req: CreateBookmarkRequest,
) -> Result<BookmarkData, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().fixed_offset();
    let id = Uuid::new_v4();
    let model = bookmarks::ActiveModel {
        id: Set(id),
        message_id: Set(Uuid::parse_str(&req.message_id).map_err(|e| e.to_string())?),
        heading_anchor: Set(req.heading_anchor),
        label: Set(req.label),
        created_at: Set(now),
    };
    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(BookmarkData {
        id: id.to_string(),
        message_id: req.message_id,
        heading_anchor: req.heading_anchor,
        label: req.label,
        created_at: now.to_rfc3339(),
    })
}

#[specta]
#[tauri::command]
pub async fn remove_bookmark(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    Bookmarks::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[specta]
#[tauri::command]
pub async fn list_bookmarks(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<Vec<BookmarkData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;

    // We need to join messages to filter by conversation_id
    let sql = r#"
        SELECT b.id, b.message_id, b.heading_anchor, b.label, b.created_at
        FROM bookmarks b
        INNER JOIN messages m ON m.id = b.message_id
        WHERE m.conversation_id = $1
        ORDER BY b.created_at ASC
    "#;
    let rows = db
        .query_all(sea_orm::Statement::from_sql_and_values(
            sea_orm::DbBackend::Sqlite,
            sql,
            [conv_uuid.into()],
        ))
        .await
        .map_err(|e| e.to_string())?;
    let mut bookmarks = Vec::new();
    for row in rows {
        let id: String = row.try_get("", "id").map_err(|e| e.to_string())?;
        let message_id: String = row.try_get("", "message_id").map_err(|e| e.to_string())?;
        let heading_anchor: Option<String> = row.try_get("", "heading_anchor").ok();
        let label: Option<String> = row.try_get("", "label").ok();
        let created_at: chrono::DateTime<chrono::FixedOffset> =
            row.try_get("", "created_at").map_err(|e| e.to_string())?;
        bookmarks.push(BookmarkData {
            id,
            message_id,
            heading_anchor,
            label,
            created_at: created_at.to_rfc3339(),
        });
    }
    Ok(bookmarks)
}

#[specta]
#[tauri::command]
pub async fn toggle_bookmark(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    message_id: String,
    heading_anchor: Option<String>,
    label: Option<String>,
) -> Result<Option<BookmarkData>, String> {
    // Check if exists
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let msg_uuid = Uuid::parse_str(&message_id).map_err(|e| e.to_string())?;
    let existing = Bookmarks::find()
        .filter(bookmarks::Column::MessageId.eq(msg_uuid))
        .filter(bookmarks::Column::HeadingAnchor.eq(heading_anchor.clone()))
        .one(db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(b) = existing {
        // Delete
        Bookmarks::delete_by_id(b.id)
            .exec(db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(None)
    } else {
        // Create
        let req = CreateBookmarkRequest {
            conversation_id,
            message_id,
            heading_anchor,
            label,
        };
        let data = add_bookmark(state, req).await?;
        Ok(Some(data))
    }
}
