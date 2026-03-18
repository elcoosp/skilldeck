//! LLM enrichment — use Ollama to auto-categorise, tag, and score skills.
//!
//! UX intent: AI-generated tags are marked `metadata_source = "llm_enrichment"`
//! so the frontend can display the "AI-generated" badge on them.

use crate::skills::models::{ActiveModel as SkillActiveModel, Entity as Skills};
use anyhow::{Context, Result};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use serde::Deserialize;
use tracing::{info, warn};
use uuid::Uuid;

/// LLM-enrichment response schema.
#[derive(Debug, Deserialize)]
struct EnrichmentResponse {
    tags: Vec<String>,
    category: String,
    quality_score: u8,
    summary: Option<String>,
}

/// Enrich a single skill with LLM-generated metadata.
///
/// Calls the Ollama API with the skill's name, description, and content,
/// then updates the DB record with tags, category, and quality score.
pub async fn enrich_skill(
    db: &DatabaseConnection,
    skill_id: Uuid,
    ollama_host: &str,
) -> Result<()> {
    let skill = Skills::find_by_id(skill_id)
        .one(db)
        .await?
        .context("Skill not found")?;

    let prompt = build_enrichment_prompt(&skill.name, &skill.description, &skill.content);

    let response_text = call_ollama(ollama_host, &prompt).await?;
    let enrichment = parse_enrichment_response(&response_text);

    // Compute security score from existing lint warnings.
    let security_score = compute_security_score_from_warnings(&skill.lint_warnings);
    let quality_score = enrichment.quality_score.min(5).max(1) as i32;

    let tags_json = serde_json::to_value(&enrichment.tags)?;
    let now = chrono::Utc::now().fixed_offset();

    let mut active: SkillActiveModel = skill.into();
    active.tags = Set(Some(tags_json));
    active.category = Set(Some(enrichment.category));
    active.quality_score = Set(Some(quality_score));
    active.security_score = Set(Some(security_score));
    active.metadata_source = Set(Some("llm_enrichment".to_string()));
    active.updated_at = Set(now);
    active.update(db).await?;

    info!(
        "Enriched skill {} (quality={}, security={})",
        skill_id, quality_score, security_score
    );
    Ok(())
}

/// Enrich all skills that have never been enriched (metadata_source = "author").
pub async fn enrich_pending_skills(db: &DatabaseConnection, ollama_host: &str) -> Result<usize> {
    use crate::skills::models::Column;
    use sea_orm::{ColumnTrait, QueryFilter};

    let pending = Skills::find()
        .filter(Column::MetadataSource.eq("author"))
        .all(db)
        .await?;

    let count = pending.len();
    info!("Enriching {} skills with LLM metadata", count);

    for skill in pending {
        if let Err(e) = enrich_skill(db, skill.id, ollama_host).await {
            warn!("Failed to enrich skill {}: {}", skill.id, e);
        }
    }
    Ok(count)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn build_enrichment_prompt(name: &str, description: &str, content: &str) -> String {
    // Truncate content to avoid blowing the context window.
    let content_preview: String = content.chars().take(2000).collect();
    format!(
        r#"You are a skill classifier for an AI agent platform. Given the following skill, respond ONLY with a JSON object (no markdown, no explanation) with these fields:
- "tags": array of 3-6 lowercase keyword strings describing the skill's domain
- "category": exactly one of: "Development", "Data", "Writing", "DevOps", "Security", "Research", "Productivity", "Other"
- "quality_score": integer 1-5 based on clarity and completeness of instructions
- "summary": one-sentence summary (optional)

Skill name: {name}
Description: {description}
Content preview:
{content_preview}

Respond ONLY with valid JSON."#
    )
}

async fn call_ollama(host: &str, prompt: &str) -> Result<String> {
    let url = format!("{}/api/generate", host);
    let body = serde_json::json!({
        "model": "glm4",
        "prompt": prompt,
        "stream": false,
        "format": "json"
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let resp: serde_json::Value = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .context("Failed to call Ollama API")?
        .json()
        .await
        .context("Failed to parse Ollama response")?;

    Ok(resp["response"].as_str().unwrap_or("{}").to_string())
}

fn parse_enrichment_response(text: &str) -> EnrichmentResponse {
    // Strip markdown code fences if present.
    let clean = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str(clean).unwrap_or(EnrichmentResponse {
        tags: vec!["uncategorised".to_string()],
        category: "Other".to_string(),
        quality_score: 3,
        summary: None,
    })
}

fn compute_security_score_from_warnings(warnings: &Option<serde_json::Value>) -> i32 {
    let warnings = match warnings {
        Some(w) => w,
        None => return 5,
    };

    let arr = match warnings.as_array() {
        Some(a) => a,
        None => return 5,
    };

    let security_errors = arr
        .iter()
        .filter(|w| {
            w.get("rule_id")
                .and_then(|id| id.as_str())
                .map(|id| id.starts_with("sec-"))
                .unwrap_or(false)
                && w.get("severity")
                    .and_then(|s| s.as_str())
                    .map(|s| s == "error")
                    .unwrap_or(false)
        })
        .count();

    match security_errors {
        0 => 5,
        1 => 3,
        2 => 2,
        _ => 1,
    }
}
