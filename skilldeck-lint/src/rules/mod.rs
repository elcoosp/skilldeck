//! Rule registry and trait definition.

use crate::{LintConfig, LintWarning};
use std::path::Path;

pub mod frontmatter;
pub mod quality;
pub mod security;
pub mod structure;

/// Stable identifier for a lint rule.
pub type RuleId = &'static str;

/// Trait that all lint rules must implement.
pub trait LintRule: Send + Sync {
    /// Unique rule identifier, e.g. `"fm-name-format"`.
    fn id(&self) -> RuleId;
    /// Run the rule against the skill directory and return any warnings.
    fn check(&self, skill_path: &Path, config: &LintConfig) -> Vec<LintWarning>;
}

/// Returns all registered lint rules in evaluation order.
pub fn all_rules() -> Vec<Box<dyn LintRule>> {
    vec![
        // Metadata / frontmatter
        Box::new(frontmatter::MetadataKeys),
        Box::new(frontmatter::NameFormat),
        Box::new(frontmatter::DescriptionLength),
        Box::new(frontmatter::DescriptionContent),
        Box::new(frontmatter::LicensePresent),
        Box::new(frontmatter::LicenseFormat),
        Box::new(frontmatter::CompatibilityLength),
        Box::new(frontmatter::AllowedTools),
        // Structure
        Box::new(structure::SkillMdExists),
        Box::new(structure::SkillMdSize),
        Box::new(structure::ReferencesExist),
        Box::new(structure::ReferencesDepth),
        // Security (high-severity, checked early)
        Box::new(security::DangerousTools),
        Box::new(security::AllowedToolsMismatch),
        // Quality
        Box::new(quality::ContentClarity),
        Box::new(quality::ContentExamples),
        Box::new(quality::ContentSteps),
        Box::new(quality::ProgressiveDisclosure),
        Box::new(quality::Dependencies),
        Box::new(quality::Platform),
        Box::new(quality::Freshness),
    ]
}
