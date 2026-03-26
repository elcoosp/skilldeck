use specta::specta;
use std::sync::Arc;
use tauri::State;

#[specta]
#[tauri::command]
pub async fn get_home_dir() -> Result<String, String> {
    dirs_next::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "Could not determine home directory".to_string())
}
