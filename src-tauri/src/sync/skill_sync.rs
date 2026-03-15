//! Skill sync — fetch delta updates from the platform registry and cache locally.

use anyhow::Result;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use uuid::Uuid;

/// Payload returned by the platform's `/api/v1/sync` endpoint.
#[derive(Debug, Deserialize)]
pub struct SyncResponse {
    pub skills: Vec<RegistrySkillDto>,
    #[allow(dead_code)] // Used only for deserialization
    pub synced_at: String,
}

/// A single skill record from the registry API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySkillDto {
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
    pub metadata_source: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Sync registry skills into the local `registry_skills` cache table.
///
/// Fetches only skills updated since `last_sync_at` (delta sync).
pub async fn sync_registry_skills(
    db: &DatabaseConnection,
    platform_url: &str,
    last_sync_at: Option<&str>,
) -> Result<usize> {
    let url = build_sync_url(platform_url, last_sync_at);
    info!("Syncing skills from {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let sync_resp: SyncResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let count = sync_resp.skills.len();
    info!("Received {} skills from registry", count);

    for skill in &sync_resp.skills {
        if let Err(e) = upsert_registry_skill(db, skill).await {
            warn!("Failed to upsert skill '{}': {}", skill.name, e);
        }
    }

    Ok(count)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn build_sync_url(platform_url: &str, last_sync_at: Option<&str>) -> String {
    let base = format!("{}/api/v1/sync", platform_url.trim_end_matches('/'));
    if let Some(since) = last_sync_at {
        format!("{}?since={}", base, urlencoding_simple(since))
    } else {
        base
    }
}

fn urlencoding_simple(s: &str) -> String {
    s.replace(':', "%3A").replace('+', "%2B")
}

async fn upsert_registry_skill(db: &DatabaseConnection, dto: &RegistrySkillDto) -> Result<()> {
    // Use the registry_skills table from the local client migration.
    use skilldeck_models::registry_skills::{ActiveModel, Column, Entity};

    let existing = Entity::find()
        .filter(Column::RegistryId.eq(&dto.id))
        .one(db)
        .await?;

    let tags_json = serde_json::to_value(&dto.tags)?;
    let warnings_json = serde_json::to_value(&dto.lint_warnings)?;
    let now = chrono::Utc::now().fixed_offset();

    if let Some(existing) = existing {
        let mut active: ActiveModel = existing.into();
        active.name = Set(dto.name.clone());
        active.description = Set(dto.description.clone());
        active.tags = Set(Some(tags_json));
        active.category = Set(dto.category.clone());
        active.lint_warnings = Set(Some(warnings_json));
        active.security_score = Set(dto.security_score);
        active.quality_score = Set(dto.quality_score);
        active.metadata_source = Set(dto.metadata_source.clone());
        active.content = Set(dto.content.clone());
        active.synced_at = Set(now);
        active.update(db).await?;
    } else {
        let active = ActiveModel {
            id: Set(Uuid::new_v4()),
            registry_id: Set(dto.id.clone()),
            name: Set(dto.name.clone()),
            description: Set(dto.description.clone()),
            source: Set(dto.source.clone()),
            source_url: Set(dto.source_url.clone()),
            version: Set(dto.version.clone()),
            author: Set(dto.author.clone()),
            license: Set(dto.license.clone()),
            tags: Set(Some(tags_json)),
            category: Set(dto.category.clone()),
            lint_warnings: Set(Some(warnings_json)),
            security_score: Set(dto.security_score),
            quality_score: Set(dto.quality_score),
            metadata_source: Set(dto.metadata_source.clone()),
            content: Set(dto.content.clone()),
            synced_at: Set(now),
        };
        active.insert(db).await?;
    }

    Ok(())
}
