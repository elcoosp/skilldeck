//! Profile Tauri commands.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryOrder, QueryFilter};
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;
use skilldeck_models::profiles::{self, Entity as Profiles};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ProfileData {
    pub id: String,
    pub name: String,
    pub model_provider: String,
    pub model_id: String,
    pub is_default: bool,
    pub system_prompt: Option<String>,
    pub deleted_at: Option<String>, // ISO timestamp if deleted
}

impl From<profiles::Model> for ProfileData {
    fn from(p: profiles::Model) -> Self {
        Self {
            id: p.id.to_string(),
            name: p.name,
            model_provider: p.model_provider,
            model_id: p.model_id,
            is_default: p.is_default,
            system_prompt: p.system_prompt,
            deleted_at: p.deleted_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// List all profiles ordered by default-first, then alphabetically.
#[specta]
#[tauri::command]
pub async fn list_profiles(
    state: State<'_, Arc<AppState>>,
    include_deleted: Option<bool>,
) -> Result<Vec<ProfileData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let mut query = Profiles::find()
        .order_by_desc(profiles::Column::IsDefault)
        .order_by_asc(profiles::Column::Name);

    if !include_deleted.unwrap_or(false) {
        query = query.filter(profiles::Column::DeletedAt.is_null());
    }

    let rows = query.all(db).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(Into::into).collect())
}

/// Create a new profile, optionally with a system prompt.
#[specta]
#[tauri::command]
pub async fn create_profile(
    state: State<'_, Arc<AppState>>,
    name: String,
    model_provider: String,
    model_id: String,
    system_prompt: Option<String>,
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
        system_prompt: Set(system_prompt),
        created_at: Set(now),
        updated_at: Set(now),
        deleted_at: Set(None),
        ..Default::default()
    };

    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

/// Partial update — only provided fields are mutated.
#[specta]
#[tauri::command]
pub async fn update_profile(
    state: State<'_, Arc<AppState>>,
    id: String,
    name: Option<String>,
    model_provider: Option<String>,
    model_id: Option<String>,
    system_prompt: Option<String>,
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
    if let Some(sp) = system_prompt {
        active.system_prompt = Set(Some(sp));
    }
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Set a profile as the default, clearing the flag on all others.
#[specta]
#[tauri::command]
pub async fn set_default_profile(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    // Clear is_default on all active profiles first.
    let all = Profiles::find()
        .filter(profiles::Column::DeletedAt.is_null())
        .all(db)
        .await
        .map_err(|e| e.to_string())?;
    for row in all {
        if row.is_default {
            let mut active: profiles::ActiveModel = row.into();
            active.is_default = Set(false);
            active.updated_at = Set(chrono::Utc::now().fixed_offset());
            active.update(db).await.map_err(|e| e.to_string())?;
        }
    }

    // Set the chosen profile as default.
    let row = Profiles::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {id} not found"))?;

    let mut active: profiles::ActiveModel = row.into();
    active.is_default = Set(true);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Soft delete a profile. Refuses to delete the last remaining active profile.
#[specta]
#[tauri::command]
pub async fn delete_profile(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    // Count active (non-deleted) profiles
    let active_count = Profiles::find()
        .filter(profiles::Column::DeletedAt.is_null())
        .count(db)
        .await
        .map_err(|e| e.to_string())?;
    if active_count <= 1 {
        return Err("Cannot delete the only remaining profile".to_string());
    }

    let profile = Profiles::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {id} not found"))?;

    let was_default = profile.is_default;
    let now = chrono::Utc::now().fixed_offset();

    let mut active: profiles::ActiveModel = profile.into();
    active.deleted_at = Set(Some(now));
    active.updated_at = Set(now);
    active.update(db).await.map_err(|e| e.to_string())?;

    // If it was default, set another active profile as default
    if was_default {
        if let Some(first) = Profiles::find()
            .filter(profiles::Column::DeletedAt.is_null())
            .order_by_asc(profiles::Column::Name)
            .one(db)
            .await
            .map_err(|e| e.to_string())?
        {
            let mut new_default: profiles::ActiveModel = first.into();
            new_default.is_default = Set(true);
            new_default.updated_at = Set(chrono::Utc::now().fixed_offset());
            new_default.update(db).await.map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Restore a soft-deleted profile. Ensures the profile is not marked as default.
#[specta]
#[tauri::command]
pub async fn restore_profile(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;

    let profile = Profiles::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {id} not found"))?;

    if profile.deleted_at.is_none() {
        return Err("Profile is not deleted".to_string());
    }

    let mut active: profiles::ActiveModel = profile.into();
    active.deleted_at = Set(None);
    active.is_default = Set(false); // Ensure restored profile is not default
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(db).await.map_err(|e| e.to_string())?;

    Ok(())
}
