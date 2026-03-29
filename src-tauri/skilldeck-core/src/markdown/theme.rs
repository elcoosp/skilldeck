// src-tauri/skilldeck-core/src/markdown/theme.rs
use super::error::MarkdownError;
use parking_lot::RwLock;
use std::sync::Arc;
use syntect::highlighting::{Theme, ThemeSet};

#[derive(Clone)]
pub struct SharedTheme(Arc<RwLock<Theme>>);

impl SharedTheme {
    pub fn from_name(name: &str) -> Result<Self, MarkdownError> {
        let ts = ThemeSet::load_defaults();
        let theme = ts
            .themes
            .get(name)
            .ok_or_else(|| MarkdownError::ThemeLoad(format!("theme '{}' not found", name)))?
            .clone();
        Ok(Self(Arc::new(RwLock::new(theme))))
    }

    pub fn from_file(path: &std::path::Path) -> Result<Self, MarkdownError> {
        let theme =
            ThemeSet::get_theme(path).map_err(|e| MarkdownError::InvalidTheme(e.to_string()))?;
        Ok(Self(Arc::new(RwLock::new(theme))))
    }

    pub fn swap_from_name(&self, name: &str) -> Result<(), MarkdownError> {
        let ts = ThemeSet::load_defaults();
        let theme = ts
            .themes
            .get(name)
            .ok_or_else(|| MarkdownError::ThemeLoad(format!("theme '{}' not found", name)))?
            .clone();
        *self.0.write() = theme;
        Ok(())
    }

    pub fn swap_from_file(&self, path: &std::path::Path) -> Result<(), MarkdownError> {
        let theme =
            ThemeSet::get_theme(path).map_err(|e| MarkdownError::InvalidTheme(e.to_string()))?;
        *self.0.write() = theme;
        Ok(())
    }

    pub fn generate_css(&self) -> String {
        let theme = self.0.read();
        syntect::html::css_for_theme_with_class_style(&theme, syntect::html::ClassStyle::Spaced)
            .unwrap_or_default()
    }

    pub fn with_theme<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&Theme) -> R,
    {
        f(&self.0.read())
    }
}
