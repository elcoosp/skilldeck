//! RegistrySkill entity — cached skills fetched from the platform registry.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "registry_skills")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// The platform's UUID for this skill.
    #[sea_orm(unique)]
    pub registry_id: String,
    pub name: String,
    pub description: String,
    pub source: String,
    pub source_url: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Option<Json>,
    pub category: Option<String>,
    pub lint_warnings: Option<Json>,
    pub security_score: i32,
    pub quality_score: i32,
    pub metadata_source: String,
    pub content: String,
    pub synced_at: DateTimeWithTimeZone,
}

impl ActiveModelBehavior for ActiveModel {}
