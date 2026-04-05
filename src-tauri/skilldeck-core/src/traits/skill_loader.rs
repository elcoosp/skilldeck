//! Skill Loader trait and related types.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::CoreError;
use skilldeck_lint::LintWarning;

/// Default quality score for skills that don't explicitly set one.
pub const DEFAULT_QUALITY_SCORE: u8 = 5;
/// Default security score for skills that don't explicitly set one.
pub const DEFAULT_SECURITY_SCORE: u8 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillSource {
    Filesystem(PathBuf),
    Database(uuid::Uuid),
    Remote(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub content_md: String,
    pub is_active: bool,
    #[serde(default)]
    pub manifest: SkillManifest,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_path: Option<PathBuf>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
    pub lint_warnings: Option<Vec<LintWarning>>,
    pub security_score: u8,
    pub quality_score: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillManifest {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub triggers: Vec<String>,
    #[serde(default)]
    pub requires: Vec<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl Skill {
    pub fn new(name: String, description: String, content_md: String, source: String) -> Self {
        Self {
            name,
            description,
            content_md,
            is_active: true,
            manifest: SkillManifest::default(),
            disk_path: None,
            source,
            content_hash: None,
            lint_warnings: None,
            security_score: DEFAULT_SECURITY_SCORE,
            quality_score: DEFAULT_QUALITY_SCORE,
        }
    }

    pub fn compute_hash(&self) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.content_md.as_bytes());
        hasher.update(self.name.as_bytes());
        hex::encode(hasher.finalize())
    }
}

#[async_trait]
pub trait SkillLoader: Send + Sync {
    async fn load(&self, source: &SkillSource) -> Result<Skill, CoreError>;
    async fn exists(&self, source: &SkillSource) -> bool;
    async fn modified_at(&self, source: &SkillSource) -> Option<std::time::SystemTime>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_creation() {
        let skill = Skill::new(
            "test-skill".into(),
            "A test skill".into(),
            "# Test\nDo something.".into(),
            "local".into(),
        );
        assert_eq!(skill.name, "test-skill");
        assert!(skill.disk_path.is_none());
        assert!(skill.content_hash.is_none());
        assert!(skill.is_active);
        assert_eq!(skill.security_score, 5);
        assert_eq!(skill.quality_score, 5);
    }

    #[test]
    fn skill_hash_computation() {
        let s1 = Skill::new(
            "test".into(),
            String::new(),
            "content".into(),
            "local".into(),
        );
        let s2 = Skill::new(
            "test".into(),
            String::new(),
            "content".into(),
            "local".into(),
        );
        let s3 = Skill::new(
            "test".into(),
            String::new(),
            "different".into(),
            "local".into(),
        );
        let h1 = s1.compute_hash();
        assert_eq!(h1.len(), 64);
        assert_eq!(h1, s2.compute_hash());
        assert_ne!(h1, s3.compute_hash());
    }

    #[test]
    fn skill_manifest_default() {
        let m = SkillManifest::default();
        assert!(m.version.is_empty());
        assert!(m.triggers.is_empty());
    }

    #[test]
    fn skill_source_serialization() {
        let source = SkillSource::Filesystem(PathBuf::from("/skills/my-skill"));
        let json = serde_json::to_string(&source).unwrap();
        assert!(json.contains("Filesystem"));
        assert!(json.contains("/skills/my-skill"));
    }
}
