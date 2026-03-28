use thiserror::Error;

#[derive(Debug, Error)]
pub enum MarkdownError {
    #[error("Theme error: {0}")]
    ThemeLoad(String),
    #[error("Invalid theme file: {0}")]
    InvalidTheme(String),
}
