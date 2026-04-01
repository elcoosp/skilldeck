//! Provider readiness Tauri command.

use crate::state::AppState;
use sea_orm::EntityTrait;
use serde::Serialize;
use skilldeck_core::traits::model_provider::ProviderReadyStatus as CoreProviderReadyStatus;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Type)]
pub struct ProviderReadyInfo {
    pub profile_id: String,
    pub status: ProviderReadyStatus,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ProviderReadyStatus {
    Ready,
    NotReady { reason: String, fix_action: String },
}

#[specta]
#[tauri::command]
pub async fn check_provider_ready(
    profile_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ProviderReadyInfo, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&profile_id).map_err(|e| e.to_string())?;

    let profile = skilldeck_models::profiles::Entity::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Profile {} not found", profile_id))?;

    let provider = match state.registry.get_provider(&profile.model_provider) {
        Some(p) => p,
        None => {
            return Ok(ProviderReadyInfo {
                profile_id,
                status: ProviderReadyStatus::NotReady {
                    reason: format!("{} provider is not configured", profile.model_provider),
                    fix_action: format!(
                        "Add an API key for {} in Settings > Profiles",
                        profile.model_provider
                    ),
                },
            });
        }
    };

    let status = provider.is_ready(&profile.model_id).await;
    let ready_status = match status {
        CoreProviderReadyStatus::Ready => ProviderReadyStatus::Ready,
        CoreProviderReadyStatus::NotReady { reason, fix_action } => {
            ProviderReadyStatus::NotReady { reason, fix_action }
        }
    };

    Ok(ProviderReadyInfo {
        profile_id,
        status: ready_status,
    })
}
