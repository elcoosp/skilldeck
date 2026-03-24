//! Skill ingestion from various sources.

use crate::skills::metadata::SkillMetadata;
use crate::skills::models::{ActiveModel as SkillActiveModel, Column, Entity as Skills};
use anyhow::{Context, Result};
use async_trait::async_trait;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use sha2::{Digest, Sha256};
use tracing::{info, warn};
use uuid::Uuid;

// -----------------------------------------------------------------------------
// Registry Adapter Trait
// -----------------------------------------------------------------------------

#[async_trait]
pub trait RegistryAdapter: Send + Sync {
    /// Unique identifier for this adapter (used to match source_type).
    fn source_type(&self) -> &str;

    /// Fetch the list of skill identifiers (slugs/IDs) from the registry.
    async fn fetch_skill_list(&self, base_url: &str) -> Result<Vec<String>, anyhow::Error>;

    /// Fetch the full detail for a given skill identifier.
    async fn fetch_skill_detail(
        &self,
        base_url: &str,
        id: &str,
    ) -> Result<UnifiedSkill, anyhow::Error>;
}

// -----------------------------------------------------------------------------
// Unified Skill Struct
// -----------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct UnifiedSkill {
    pub name: String,
    pub description: String,
    pub content: String,
    pub source: String,
    pub source_url: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub metadata: Option<SkillMetadata>,
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/// Compute SHA-256 hash of a string.
pub fn compute_sha256(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Check if a skill with the given name and source needs to be updated based on content hash.
pub async fn skill_needs_update(
    db: &DatabaseConnection,
    name: &str,
    source: &str,
    new_content_hash: &str,
) -> Result<bool, anyhow::Error> {
    let existing = Skills::find()
        .filter(Column::Name.eq(name))
        .filter(Column::Source.eq(source))
        .one(db)
        .await?;

    Ok(match existing {
        Some(s) => s.content_hash != new_content_hash,
        None => true,
    })
}

/// Upsert a UnifiedSkill into the skills table.
pub async fn upsert_skill(
    db: &DatabaseConnection,
    skill: UnifiedSkill,
) -> Result<Uuid, anyhow::Error> {
    let content_hash = compute_sha256(&skill.content);
    let now = chrono::Utc::now().fixed_offset();

    let existing = Skills::find()
        .filter(Column::Name.eq(&skill.name))
        .filter(Column::Source.eq(&skill.source))
        .one(db)
        .await?;

    let id = if let Some(existing) = existing {
        if existing.content_hash == content_hash {
            return Ok(existing.id);
        }
        let mut active: SkillActiveModel = existing.into();
        active.description = Set(skill.description);
        active.content = Set(skill.content);
        active.content_hash = Set(content_hash);
        active.source_url = Set(skill.source_url);
        active.version = Set(skill.version);
        active.author = Set(skill.author);
        active.license = Set(skill.license);
        active.tags = Set(Some(serde_json::to_value(&skill.tags)?));
        active.category = Set(skill.category);
        active.metadata = Set(skill.metadata);
        active.updated_at = Set(now);
        active.update(db).await?;
        active.id
    } else {
        let id = Uuid::new_v4();
        let active = SkillActiveModel {
            id: Set(id),
            name: Set(skill.name),
            description: Set(skill.description),
            source: Set(skill.source),
            source_url: Set(skill.source_url),
            version: Set(skill.version),
            author: Set(skill.author),
            license: Set(skill.license),
            content_hash: Set(content_hash),
            content: Set(skill.content),
            tags: Set(Some(serde_json::to_value(&skill.tags)?)),
            category: Set(skill.category),
            metadata: Set(skill.metadata),
            security_score: Set(Some(5)),
            quality_score: Set(Some(5)),
            metadata_source: Set(Some("web_registry".to_string())),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        active.insert(db).await?;
        id
    };
    Ok(id)
}

// =============================================================================
// EXISTING GITHUB INGESTION CODE (unchanged)
// =============================================================================

/// Ingest all skills from a GitHub organisation's repositories.
///
/// For each repository, checks whether `SKILL.md` exists in the root and, if
/// so, downloads it, computes a SHA-256 content hash and upserts the record.
pub async fn crawl_github_org(
    db: &DatabaseConnection,
    org: &str,
    github_token: Option<&str>,
) -> Result<Vec<Uuid>> {
    info!("Crawling GitHub org: {}", org);

    let client = build_http_client(github_token)?;

    // List repositories in the org via GitHub REST API.
    let repos_url = format!("https://api.github.com/orgs/{}/repos?per_page=100", org);
    let repos: Vec<serde_json::Value> = client
        .get(&repos_url)
        .send()
        .await
        .context("Failed to list GitHub org repos")?
        .json()
        .await
        .context("Failed to parse repos JSON")?;

    let mut ingested_ids = Vec::new();

    for repo in &repos {
        let repo_name = match repo["name"].as_str() {
            Some(n) => n,
            None => continue,
        };
        let default_branch = repo["default_branch"].as_str().unwrap_or("main");
        let html_url = repo["html_url"].as_str().unwrap_or("");

        match ingest_repo(db, &client, org, repo_name, default_branch, html_url).await {
            Ok(Some(id)) => {
                info!("Ingested skill '{}' from {}/{}", repo_name, org, repo_name);
                ingested_ids.push(id);
            }
            Ok(None) => {} // No SKILL.md found
            Err(e) => {
                warn!("Failed to ingest {}/{}: {}", org, repo_name, e);
            }
        }
    }

    info!(
        "Crawled {} repos, ingested {} skills",
        repos.len(),
        ingested_ids.len()
    );
    Ok(ingested_ids)
}

/// Ingest a single GitHub repository.
///
/// Returns `Ok(Some(id))` if a skill was upserted, `Ok(None)` if no SKILL.md.
pub async fn ingest_repo(
    db: &DatabaseConnection,
    client: &reqwest::Client,
    org: &str,
    repo: &str,
    branch: &str,
    html_url: &str,
) -> Result<Option<Uuid>> {
    // Try to fetch raw SKILL.md content.
    let raw_url = format!(
        "https://raw.githubusercontent.com/{}/{}/{}/SKILL.md",
        org, repo, branch
    );

    let response = client.get(&raw_url).send().await?;
    if !response.status().is_success() {
        return Ok(None); // No SKILL.md in this repo.
    }

    let content = response.text().await?;
    let content_hash = compute_sha256(&content);
    let source_url = format!("{}/blob/{}/SKILL.md", html_url, branch);

    // Parse frontmatter fields.
    let fm = parse_frontmatter_simple(&content);

    let name = fm.get("name").cloned().unwrap_or_else(|| repo.to_string());
    let description = fm
        .get("description")
        .cloned()
        .unwrap_or_else(|| format!("Skill from {}/{}", org, repo));
    let version = fm.get("version").cloned();
    let author = fm.get("author").cloned().or_else(|| Some(org.to_string()));
    let license = fm.get("license").cloned();

    let now = chrono::Utc::now().fixed_offset();

    // Check if we already have this skill (by name + source).
    use crate::skills::models::Column;
    let existing = Skills::find()
        .filter(Column::Name.eq(&name))
        .filter(Column::Source.eq(org))
        .one(db)
        .await?;

    let id = if let Some(existing) = existing {
        // Skip update if content hasn't changed.
        if existing.content_hash == content_hash {
            return Ok(Some(existing.id));
        }
        let mut active: SkillActiveModel = existing.into();
        active.content = Set(content);
        active.content_hash = Set(content_hash);
        active.version = Set(version);
        active.updated_at = Set(now);
        let updated = active.update(db).await?;
        updated.id
    } else {
        let id = Uuid::new_v4();
        let active = SkillActiveModel {
            id: Set(id),
            name: Set(name),
            description: Set(description),
            source: Set(org.to_string()),
            source_url: Set(Some(source_url)),
            version: Set(version),
            author: Set(author),
            license: Set(license),
            content_hash: Set(content_hash),
            content: Set(content),
            metadata_source: Set(Some("author".to_string())),
            security_score: Set(Some(5)),
            quality_score: Set(Some(5)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        active.insert(db).await?;
        id
    };

    Ok(Some(id))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn build_http_client(token: Option<&str>) -> Result<reqwest::Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("skilldeck-platform/0.1"),
    );
    if let Some(t) = token {
        let auth = format!("Bearer {}", t);
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&auth)?,
        );
    }
    Ok(reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(30))
        .build()?)
}

fn parse_frontmatter_simple(content: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    if !content.starts_with("---") {
        return map;
    }
    let rest = &content[3..];
    let end = match rest.find("\n---") {
        Some(e) => e,
        None => return map,
    };
    for line in rest[..end].lines() {
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_string();
            let value = line[colon_pos + 1..].trim().trim_matches('"').to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }
    map
}
