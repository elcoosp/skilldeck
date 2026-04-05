//! Full-text search module.
//!
//! TODO: Implement SQLite FTS5 or tantivy-based search for conversations and skills.

/// Search conversations and skills by query string.
pub async fn search(_query: &str) -> Result<Vec<SearchResult>, crate::error::CoreError> {
    todo!("Full-text search is not yet implemented. See issue #2.");
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub kind: SearchResultKind,
}

#[derive(Debug, Clone)]
pub enum SearchResultKind {
    Conversation,
    Message,
    Skill,
}
