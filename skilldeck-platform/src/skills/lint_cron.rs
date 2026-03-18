//! Cron-based linting — periodically re-lint skills whose content has changed.

use crate::skills::models::{ActiveModel as SkillActiveModel, Entity as Skills};
use anyhow::Result;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use skilldeck_lint::{LintConfig, compute_quality_score, compute_security_score, lint_skill};
use tracing::{info, warn};

/// Re-lint all skills in the platform database.
///
/// Skills are written to a temp directory before being linted so the
/// shared `skilldeck-lint` crate (which operates on `Path`) can be used
/// without modification.
pub async fn run_lint_cron(db: &DatabaseConnection) -> Result<()> {
    let skills = Skills::find().all(db).await?;
    info!("Lint cron: processing {} skills", skills.len());

    let config = LintConfig::default();
    let mut updated = 0usize;
    let mut failed = 0usize;

    for skill in skills {
        match lint_one_skill(db, &skill, &config).await {
            Ok(()) => updated += 1,
            Err(e) => {
                warn!("Failed to lint skill '{}': {}", skill.name, e);
                failed += 1;
            }
        }
    }

    info!("Lint cron finished: {} updated, {} failed", updated, failed);
    Ok(())
}

async fn lint_one_skill(
    db: &DatabaseConnection,
    skill: &crate::skills::models::Model,
    config: &LintConfig,
) -> Result<()> {
    // Write the skill content to a temporary directory so the lint crate can
    // operate on it via the filesystem.
    let tmp = tempfile::TempDir::new()?;
    let skill_dir = tmp.path().join(&skill.name);
    std::fs::create_dir_all(&skill_dir)?;
    std::fs::write(skill_dir.join("SKILL.md"), &skill.content)?;

    let warnings = lint_skill(&skill_dir, config);
    let security_score = compute_security_score(&warnings) as i32;
    let quality_score = compute_quality_score(&warnings) as i32;
    let warnings_json = serde_json::to_value(&warnings)?;
    let now = chrono::Utc::now().fixed_offset();

    let mut active: SkillActiveModel = skill.clone().into();
    active.lint_warnings = Set(Some(warnings_json));
    active.security_score = Set(Some(security_score));
    active.quality_score = Set(Some(quality_score));
    active.last_linted_at = Set(Some(now));
    active.updated_at = Set(now);
    active.update(db).await?;

    Ok(())
}
