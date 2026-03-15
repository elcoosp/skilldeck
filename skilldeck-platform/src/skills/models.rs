//! SeaORM models for the platform's skills registry tables.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// ── Skill entity ──────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "skills")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub source: String,
    pub source_url: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub compatibility: Option<String>,
    pub allowed_tools: Option<String>,
    pub content_hash: String,
    pub content: String,
    pub lint_warnings: Option<Json>,
    pub tags: Option<Json>,
    pub category: Option<String>,
    pub embedding: Option<Vec<u8>>,
    pub security_score: Option<i32>,
    pub quality_score: Option<i32>,
    pub metadata_source: Option<String>,
    pub last_linted_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// ── SkillSource entity ────────────────────────────────────────────────────────

pub mod skill_source {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "skill_sources")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub source_type: String,
        pub url: String,
        pub label: Option<String>,
        pub last_crawled_at: Option<DateTimeWithTimeZone>,
        pub is_enabled: bool,
        pub created_at: DateTimeWithTimeZone,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

// ── API response type ─────────────────────────────────────────────────────────

/// Serializable response type sent to clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: String,
    pub source_url: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub lint_warnings: Vec<serde_json::Value>,
    pub security_score: i32,
    pub quality_score: i32,
    /// "author" | "llm_enrichment" — drives AI-generated tag badge.
    pub metadata_source: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Model> for SkillResponse {
    fn from(m: Model) -> Self {
        let tags: Vec<String> = m
            .tags
            .and_then(|t| serde_json::from_value(t).ok())
            .unwrap_or_default();
        let lint_warnings: Vec<serde_json::Value> = m
            .lint_warnings
            .and_then(|w| serde_json::from_value(w).ok())
            .unwrap_or_default();
        Self {
            id: m.id.to_string(),
            name: m.name,
            description: m.description,
            source: m.source,
            source_url: m.source_url,
            version: m.version,
            author: m.author,
            license: m.license,
            tags,
            category: m.category,
            lint_warnings,
            security_score: m.security_score.unwrap_or(5),
            quality_score: m.quality_score.unwrap_or(5),
            metadata_source: m.metadata_source.unwrap_or_else(|| "author".to_string()),
            content: m.content,
            created_at: m.created_at.to_string(),
            updated_at: m.updated_at.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: Option<u64>,
    pub per_page: Option<u64>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub tags: Option<String>,
}
