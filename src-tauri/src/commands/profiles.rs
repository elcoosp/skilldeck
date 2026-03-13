//! Profile Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryOrder};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::profiles::{self, Entity as Profiles};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileData {
    pub id: String,
    pub name: String,
    pub model_provider: String,
    pub model_id: String,
    pub is_default: bool,
}

/// List all profiles ordered by default-first, then alphabetically.
#[tauri::command]
pub async fn list_profiles(state: State<'_, Arc<AppState>>) -> Result<Vec<ProfileData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let rows = Profiles::find()
        .order_by_desc(profiles::Column::IsDefault)
        .order_by_asc(profiles::Column::Name)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| ProfileData {
            id: r.id.to_string(),
            name: r.name,
            model_provider: r.model_provider,
            model_id: r.model_id,
            is_default: r.is_default,
        })
        .collect())
}

/// Create a new profile.
#[tauri::command]
pub async fn create_profile(
    state: State<'_, Arc<AppState>>,
    name: String,
    model_provider: String,
    model_id: String,
) -> Result<String, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let id = Uuid::new_v4();
    let now = chrono::Utc::now().fixed_offset();

    let model = profiles::ActiveModel {
        id: Set(id),
        name: Set(name),
        model_provider: Set(model_provider),
        model_id: Set(model_id),
        is_default: Set(false),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

/// Partial update — only provided fields are mutated.
#[tauri::command]
pub async fn update_profile(
    state: State<'_, Arc<AppState>>,
    id: String,
    name: Option<String>,
    model_provider: Option<String>,
    model_id: Option<String>,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = Profiles::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {id} not found"))?;

    let mut active: profiles::ActiveModel = row.into();
    if let Some(n) = name {
        active.name = Set(n);
    }
    if let Some(p) = model_provider {
        active.model_provider = Set(p);
    }
    if let Some(m) = model_id {
        active.model_id = Set(m);
    }
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a profile.  Refuses to delete the default profile.
#[tauri::command]
pub async fn delete_profile(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let row = Profiles::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {id} not found"))?;

    if row.is_default {
        return Err("Cannot delete the default profile".to_string());
    }

    let active: profiles::ActiveModel = row.into();
    active.delete(db).await.map_err(|e| e.to_string())?;

    Ok(())
}
