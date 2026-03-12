//! Skill loading abstraction.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::CoreError;

/// Priority tier determining skill resolution order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillSource {
    /// Built-in skills shipped with SkillDeck (lowest priority).
    Builtin = 0,
    /// User-level skills in `~/.skilldeck/skills/`.
    User = 1,
    /// Workspace-level skills in `<project>/.skilldeck/skills/` (highest priority).
    Workspace = 2,
}

/// Metadata parsed from a SKILL.md frontmatter block.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    /// Skill name (used as the lookup key).
    pub name: String,
    /// Short description shown in the UI.
    pub description: Option<String>,
    /// Semantic version string.
    pub version: Option<String>,
    /// Author name or email.
    pub author: Option<String>,
    /// Arbitrary tags for filtering/search.
    pub tags: Vec<String>,
}

/// A fully loaded skill (frontmatter + body).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    /// Parsed metadata from YAML frontmatter.
    pub metadata: SkillMetadata,
    /// Markdown body of the skill file (the system prompt content).
    pub body: String,
    /// Absolute path to the source file.
    pub path: PathBuf,
    /// Source tier (builtin / user / workspace).
    pub source: SkillSource,
    /// SHA-256 hex digest of the file contents.
    pub content_hash: String,
}

/// Loads skills from a given source directory.
#[async_trait]
pub trait SkillLoader: Send + Sync + 'static {
    /// Return all skills found under the configured source directory.
    async fn load_all(&self) -> Result<Vec<Skill>, CoreError>;

    /// Load a single skill by its file path.
    async fn load_one(&self, path: &std::path::Path) -> Result<Skill, CoreError>;

    /// The source tier this loader serves.
    fn source(&self) -> SkillSource;
}
