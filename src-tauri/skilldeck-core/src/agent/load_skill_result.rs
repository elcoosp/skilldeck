//! Strongly typed result for the `loadSkill` built-in tool.

use serde::{Deserialize, Serialize};

/// Format of the skill content returned by `loadSkill`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SkillContentFormat {
    /// Plain text (markdown) content.
    #[default]
    Text,
    /// Toon-encoded content.
    Toon,
}

/// Result returned by the `loadSkill` tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadSkillResult {
    /// Name of the skill that was loaded.
    pub loaded: String,
    /// The skill content (may be Toon-encoded).
    pub content: String,
    /// Format of the content.
    #[serde(default)]
    pub format: SkillContentFormat,
}
