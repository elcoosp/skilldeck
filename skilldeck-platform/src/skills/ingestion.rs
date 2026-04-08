//! Skill ingestion from various sources.

use crate::skills::metadata::{ClawhubMetadata, SkillMetadata};
use crate::skills::models::skill_source::{Column as SourceColumn, Entity as SkillSources};
use crate::skills::models::{
    ActiveModel as SkillActiveModel, Column as SkillColumn, Entity as Skills,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use once_cell::sync::Lazy;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tracing::{info, warn};
use uuid::Uuid;

// -----------------------------------------------------------------------------
// Registry Adapter Trait
// -----------------------------------------------------------------------------

#[async_trait]
pub trait RegistryAdapter: Send + Sync {
    fn source_type(&self) -> &str;
    async fn fetch_skill_list(&self, base_url: &str) -> Result<Vec<String>, anyhow::Error>;
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

pub fn compute_sha256(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

pub async fn skill_needs_update(
    db: &DatabaseConnection,
    name: &str,
    source: &str,
    new_content_hash: &str,
) -> Result<bool, anyhow::Error> {
    let existing = Skills::find()
        .filter(SkillColumn::Name.eq(name))
        .filter(SkillColumn::Source.eq(source))
        .one(db)
        .await?;

    Ok(match existing {
        Some(s) => s.content_hash != new_content_hash,
        None => true,
    })
}

pub async fn upsert_skill(
    db: &DatabaseConnection,
    skill: UnifiedSkill,
) -> Result<Uuid, anyhow::Error> {
    let content_hash = compute_sha256(&skill.content);
    let now = chrono::Utc::now().fixed_offset();

    let existing = Skills::find()
        .filter(SkillColumn::Name.eq(&skill.name))
        .filter(SkillColumn::Source.eq(&skill.source))
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
        let updated = active.update(db).await?;
        updated.id
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

// -----------------------------------------------------------------------------
// ClawHub Adapter
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize, Serialize)]
struct ClawhubListResponse {
    skills: Vec<ClawhubListSkill>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ClawhubListSkill {
    slug: String,
    name: String,
    description: String,
    downloads: u64,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ClawhubSkillDetail {
    name: String,
    description: String,
    content: String,
    version: Option<String>,
    author: Option<String>,
    license: Option<String>,
    tags: Vec<String>,
    category: Option<String>,
}

pub struct ClawhubAdapter;

#[async_trait]
impl RegistryAdapter for ClawhubAdapter {
    fn source_type(&self) -> &str {
        "clawhub"
    }

    async fn fetch_skill_list(&self, _base_url: &str) -> Result<Vec<String>, anyhow::Error> {
        let url = "https://wry-manatee-359.convex.cloud/api/query";
        let client = reqwest::Client::new();
        let mut offset = 0;
        let num_items = 200;
        let mut slugs = Vec::new();

        loop {
            let body = serde_json::json!({
                "path": "skills:listPublicPageV4",
                "format": "convex_encoded_json",
                "args": [{
                    "dir": "desc",
                    "highlightedOnly": false,
                    "nonSuspiciousOnly": false,
                    "numItems": num_items,
                    "sort": "downloads",
                    "offset": offset
                }]
            });
            let resp = client.post(url).json(&body).send().await?;
            if !resp.status().is_success() {
                anyhow::bail!("ClawHub API error: {}", resp.status());
            }
            let data: ClawhubListResponse = resp.json().await?;
            if data.skills.is_empty() {
                break;
            }
            slugs.extend(data.skills.iter().map(|s| s.slug.clone()));
            if data.skills.len() < num_items {
                break;
            }
            offset += num_items;
        }
        Ok(slugs)
    }

    async fn fetch_skill_detail(
        &self,
        _base_url: &str,
        slug: &str,
    ) -> Result<UnifiedSkill, anyhow::Error> {
        let url = "https://wry-manatee-359.convex.cloud/api/query";
        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "path": "skills:getBySlug",
            "format": "convex_encoded_json",
            "args": [{ "slug": slug }]
        });
        let resp = client.post(url).json(&body).send().await?;
        let detail: ClawhubSkillDetail = resp.json().await?;

        let metadata = SkillMetadata::Clawhub(ClawhubMetadata {
            slug: slug.to_string(),
            downloads: 0,
            tags: detail.tags.clone(),
            original_data: serde_json::to_value(&detail)?,
        });

        Ok(UnifiedSkill {
            name: detail.name,
            description: detail.description,
            content: detail.content,
            source: self.source_type().to_string(),
            source_url: Some(format!("https://clawhub.ai/skill/{}", slug)),
            version: detail.version,
            author: detail.author,
            license: detail.license,
            tags: detail.tags,
            category: detail.category,
            metadata: Some(metadata),
        })
    }
}

// -----------------------------------------------------------------------------
// Skills.sh Adapter (stub for now)
// -----------------------------------------------------------------------------

pub struct SkillsShAdapter;

#[async_trait]
impl RegistryAdapter for SkillsShAdapter {
    fn source_type(&self) -> &str {
        "skills.sh"
    }

    async fn fetch_skill_list(&self, _base_url: &str) -> Result<Vec<String>, anyhow::Error> {
        todo!("Implement skills.sh list")
    }

    async fn fetch_skill_detail(
        &self,
        _base_url: &str,
        _id: &str,
    ) -> Result<UnifiedSkill, anyhow::Error> {
        todo!("Implement skills.sh detail")
    }
}

// -----------------------------------------------------------------------------
// Adapter Registry
// -----------------------------------------------------------------------------

static ADAPTERS: Lazy<HashMap<String, Box<dyn RegistryAdapter>>> = Lazy::new(|| {
    let mut m: HashMap<String, Box<dyn RegistryAdapter>> = HashMap::new();
    m.insert("clawhub".to_string(), Box::new(ClawhubAdapter));
    m.insert("skills.sh".to_string(), Box::new(SkillsShAdapter));
    m
});

fn get_adapter(source_type: &str) -> Option<&'static Box<dyn RegistryAdapter>> {
    ADAPTERS.get(source_type)
}

// -----------------------------------------------------------------------------
// Daily Crawler for All Enabled Sources
// -----------------------------------------------------------------------------

/// Crawl all enabled web registry sources and upsert skills.
pub async fn crawl_all_enabled_sources(db: &DatabaseConnection) -> Result<usize, anyhow::Error> {
    let sources = SkillSources::find()
        .filter(SourceColumn::IsEnabled.eq(true))
        .filter(SourceColumn::SourceType.eq("web_registry"))
        .all(db)
        .await?;

    let mut total = 0;
    for source in sources {
        let adapter = if source.url.contains("clawhub.ai") {
            get_adapter("clawhub")
        } else if source.url.contains("skills.sh") {
            get_adapter("skills.sh")
        } else {
            tracing::warn!("No adapter for URL: {}", source.url);
            continue;
        }
        .ok_or_else(|| anyhow::anyhow!("Adapter not found"))?;

        tracing::info!("Crawling source {}", source.url);
        let ids = adapter.fetch_skill_list(&source.url).await?;
        tracing::info!("Found {} skills in source", ids.len());

        let mut inserted = 0;
        let mut skipped = 0;

        for id in ids {
            let skill = match adapter.fetch_skill_detail(&source.url, &id).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("Failed to fetch detail for {}: {}", id, e);
                    continue;
                }
            };

            let hash = compute_sha256(&skill.content);
            if !skill_needs_update(db, &skill.name, &skill.source, &hash).await? {
                tracing::debug!("Skill {} unchanged, skipping", skill.name);
                skipped += 1;
                continue;
            }

            let _ = upsert_skill(db, skill).await?;
            inserted += 1;
        }

        total += inserted;
        tracing::info!(
            "Source {}: {} inserted, {} skipped",
            source.url,
            inserted,
            skipped
        );

        // Update last_crawled_at
        let mut active: crate::skills::models::skill_source::ActiveModel = source.into();
        active.last_crawled_at = Set(Some(chrono::Utc::now().fixed_offset()));
        active.update(db).await?;
    }
    Ok(total)
}

// =============================================================================
// EXISTING GITHUB INGESTION CODE (unchanged)
// =============================================================================

pub async fn crawl_github_org(
    db: &DatabaseConnection,
    org: &str,
    github_token: Option<&str>,
) -> Result<Vec<Uuid>> {
    info!("Crawling GitHub org: {}", org);

    let client = build_http_client(github_token)?;

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
            Ok(None) => {}
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

pub async fn ingest_repo(
    db: &DatabaseConnection,
    client: &reqwest::Client,
    org: &str,
    repo: &str,
    branch: &str,
    html_url: &str,
) -> Result<Option<Uuid>> {
    let raw_url = format!(
        "https://raw.githubusercontent.com/{}/{}/{}/SKILL.md",
        org, repo, branch
    );

    let response = client.get(&raw_url).send().await?;
    if !response.status().is_success() {
        return Ok(None);
    }

    let content = response.text().await?;
    let content_hash = compute_sha256(&content);
    let source_url = format!("{}/blob/{}/SKILL.md", html_url, branch);

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

    let existing = Skills::find()
        .filter(SkillColumn::Name.eq(&name))
        .filter(SkillColumn::Source.eq(org))
        .one(db)
        .await?;

    let id = if let Some(existing) = existing {
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
