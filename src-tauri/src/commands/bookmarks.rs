use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::bookmarks::{self, Entity as Bookmarks};
use skilldeck_models::messages::{self, Entity as Messages};

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

async fn add_bookmark_internal(
    db: &sea_orm::DatabaseConnection,
    req: CreateBookmarkRequest,
) -> Result<BookmarkData, String> {
    let now = chrono::Utc::now().fixed_offset();
    let id = Uuid::new_v4();
    let model = bookmarks::ActiveModel {
        id: Set(id),
        message_id: Set(Uuid::parse_str(&req.message_id).map_err(|e| e.to_string())?),
        heading_anchor: Set(req.heading_anchor.clone()),
        label: Set(req.label.clone()),
        note: Set(None),
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
    add_bookmark_internal(&db, req).await
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

    let bookmarks = Bookmarks::find()
        .inner_join(Messages)
        .filter(messages::Column::ConversationId.eq(conv_uuid))
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    bookmarks
        .into_iter()
        .map(|b| {
            Ok(BookmarkData {
                id: b.id.to_string(),
                message_id: b.message_id.to_string(),
                heading_anchor: b.heading_anchor,
                label: b.label,
                created_at: b.created_at.to_rfc3339(),
            })
        })
        .collect()
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
        Bookmarks::delete_by_id(b.id)
            .exec(db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(None)
    } else {
        let req = CreateBookmarkRequest {
            conversation_id,
            message_id,
            heading_anchor,
            label,
        };
        let data = add_bookmark_internal(db, req).await?;
        Ok(Some(data))
    }
}
