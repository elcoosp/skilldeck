use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
use serde::Serialize;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;

use crate::state::AppState;
use skilldeck_models::achievements::{self, Entity as Achievements};

#[derive(Debug, Clone, Serialize, Type)]
pub struct AchievementData {
    pub id: String,
    pub unlocked_at: String,
}

#[specta]
#[tauri::command]
pub async fn unlock_achievement(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let existing = Achievements::find_by_id(&id)
        .one(db)
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        return Ok(());
    }

    let now = chrono::Utc::now().fixed_offset();
    let model = achievements::ActiveModel {
        id: Set(id),
        unlocked_at: Set(now),
    };
    model.insert(db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[specta]
#[tauri::command]
pub async fn list_achievements(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<AchievementData>, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    let rows = Achievements::find()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| AchievementData {
            id: r.id,
            unlocked_at: r.unlocked_at.to_rfc3339(),
        })
        .collect())
}
