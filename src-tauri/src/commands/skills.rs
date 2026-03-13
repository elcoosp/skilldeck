//! Skill Tauri commands.

use serde::Serialize;
use std::sync::Arc;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct SkillData {
    pub name: String,
    pub description: String,
    pub source: String,
    pub is_active: bool,
}

/// List all loaded skills.
#[tauri::command]
pub async fn list_skills(state: State<'_, Arc<AppState>>) -> Result<Vec<SkillData>, String> {
    let registry = &state.registry.skill_registry;
    let skills = registry.skills().await;

    Ok(skills
        .into_iter()
        .map(|s| SkillData {
            name: s.name.clone(),
            description: s.description.clone(),
            source: format!("{:?}", s.source),
            is_active: s.is_active,
        })
        .collect())
}

/// Enable or disable a skill by name.
#[tauri::command]
pub async fn toggle_skill(
    state: State<'_, Arc<AppState>>,
    name: String,
    enabled: bool,
) -> Result<(), String> {
    let registry = &state.registry.skill_registry;
    registry
        .set_enabled(&name, enabled)
        .await
        .map_err(|e: skilldeck_core::CoreError| e.to_string())
}
