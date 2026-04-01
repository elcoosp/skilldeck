use crate::state::AppState;
use specta::{Type, specta};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, Type)]
pub struct ThemeInfo {
    pub name: String,
    pub display_name: String,
}

#[specta]
#[tauri::command]
pub async fn get_syntax_css(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    Ok(state.theme.generate_css())
}

#[specta]
#[tauri::command]
pub async fn set_built_in_theme(
    state: State<'_, Arc<AppState>>,
    theme_name: String,
) -> Result<String, String> {
    state
        .theme
        .swap_from_name(&theme_name)
        .map_err(|e| e.to_string())?;
    // Persist preference (optional)
    // In a real implementation, we might store the theme name in a preferences table.
    Ok(state.theme.generate_css())
}

#[specta]
#[tauri::command]
pub async fn set_theme_from_file(
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<String, String> {
    state
        .theme
        .swap_from_file(std::path::Path::new(&path))
        .map_err(|e| e.to_string())?;
    Ok(state.theme.generate_css())
}

#[specta]
#[tauri::command]
pub async fn list_built_in_themes() -> Result<Vec<ThemeInfo>, String> {
    // The built-in themes in syntect are: "base16-ocean.dark", "base16-eighties.dark", etc.
    // We can hardcode a list or scan the default themes.
    Ok(vec![
        ThemeInfo {
            name: "base16-ocean.dark".to_string(),
            display_name: "Base16 Ocean Dark".to_string(),
        },
        ThemeInfo {
            name: "base16-eighties.dark".to_string(),
            display_name: "Base16 Eighties Dark".to_string(),
        },
        ThemeInfo {
            name: "base16-twilight.dark".to_string(),
            display_name: "Base16 Twilight Dark".to_string(),
        },
        ThemeInfo {
            name: "base16-solarized-dark".to_string(),
            display_name: "Solarized Dark".to_string(),
        },
        ThemeInfo {
            name: "base16-solarized-light".to_string(),
            display_name: "Solarized Light".to_string(),
        },
        ThemeInfo {
            name: "base16-monokai".to_string(),
            display_name: "Monokai".to_string(),
        },
    ])
}
