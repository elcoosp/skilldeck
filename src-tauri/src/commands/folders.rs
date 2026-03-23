use sea_orm::{ActiveModelTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use sea_query::Expr;
use serde::Serialize;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::conversations::{self, Entity as Conversations};
use skilldeck_models::folders::{self, Entity as Folders};

#[derive(Debug, Clone, Serialize, Type)]
pub struct FolderData {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[specta]
#[tauri::command]
pub async fn list_folders(state: State<'_, Arc<AppState>>) -> Result<Vec<FolderData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let rows = Folders::find()
        .order_by_asc(folders::Column::Name)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|f| FolderData {
            id: f.id.to_string(),
            name: f.name,
            created_at: f.created_at.to_rfc3339(),
        })
        .collect())
}

#[specta]
#[tauri::command]
pub async fn create_folder(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let folder = folders::ActiveModel {
        id: Set(id),
        name: Set(name),
        parent_id: Set(None),
        created_at: Set(now),
    };

    folder.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

#[specta]
#[tauri::command]
pub async fn rename_folder(
    state: State<'_, Arc<AppState>>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let folder = Folders::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Folder not found".to_string())?;

    let mut active: folders::ActiveModel = folder.into();
    active.name = Set(name);
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[specta]
#[tauri::command]
pub async fn delete_folder(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    // First set folder_id to NULL for all conversations in this folder
    Conversations::update_many()
        .col_expr(
            conversations::COLUMN.folder_id,
            Expr::Value(sea_orm::Value::Uuid(None)),
        )
        .filter(conversations::COLUMN.folder_id.eq(uuid))
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;

    // Then delete the folder
    Folders::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[specta]
#[tauri::command]
pub async fn move_conversation_to_folder(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let conv_uuid = Uuid::parse_str(&conversation_id).map_err(|e| e.to_string())?;
    let folder_uuid = folder_id
        .map(|id| Uuid::parse_str(&id))
        .transpose()
        .map_err(|e| e.to_string())?;

    let conv = Conversations::find_by_id(conv_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Conversation not found".to_string())?;

    let mut active: conversations::ActiveModel = conv.into();
    active.folder_id = Set(folder_uuid);
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}
