use sea_orm::FromJsonQueryResult;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult, Type)]
pub struct ContextItems(pub Vec<ContextItem>);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContextItem {
    Skill {
        name: String,
    },
    File {
        path: String,
        name: String,
        size: Option<u64>,
    },
    Folder {
        path: String,
        name: String,
        scope: FolderScope,
        file_count: usize,
    },
}

/// Determines how deeply to traverse a folder when assembling content.
/// Stored as a string in the JSON column (e.g., "shallow" or "deep").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq,Eq Type)]
#[serde(rename_all = "snake_case")]
pub enum FolderScope {
    Shallow, // only direct children
    Deep,    // all nested files recursively
}
