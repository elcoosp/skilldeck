//! Quality lint rules — check that skill content provides clear guidance.

use crate::{LintConfig, LintRule, LintWarning, Severity};
use std::fs;
use std::path::Path;

/// `quality-content-examples`: skill should provide usage examples.
pub struct ContentExamples;

impl LintRule for ContentExamples {
    fn id(&self) -> &'static str {
        "quality-content-examples"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        let has_examples = content.contains("## Example")
            || content.contains("## Usage")
            || content.contains("```")
            || content.to_lowercase().contains("for example")
            || content.to_lowercase().contains("e.g.");

        if !has_examples {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill has no examples or usage section".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_path
                        .join("SKILL.md")
                        .to_string_lossy()
                        .into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add an '## Examples' section with at least one concrete example".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `quality-content-steps`: skill should have structured steps or instructions.
pub struct ContentSteps;

impl LintRule for ContentSteps {
    fn id(&self) -> &'static str {
        "quality-content-steps"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        let has_steps = content.contains("## Steps")
            || content.contains("## Instructions")
            || content.contains("1.")
            || content.contains("- [ ]")
            || content.contains("* Step");

        // Only warn if body is non-trivial.
        if !has_steps && content.len() > 200 {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill content lacks numbered steps or a structured instructions section"
                    .to_string(),
                location: Some(crate::LintLocation {
                    file: skill_path
                        .join("SKILL.md")
                        .to_string_lossy()
                        .into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add an '## Instructions' section with numbered steps for clarity".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `quality-content-clarity`: skill body should have reasonable length.
pub struct ContentClarity;

impl LintRule for ContentClarity {
    fn id(&self) -> &'static str {
        "quality-content-clarity"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        let word_count = content.split_whitespace().count();

        if word_count < 10 {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Warning,
                message: format!(
                    "Skill body is very short ({} words). It may not provide enough guidance.",
                    word_count
                ),
                location: Some(crate::LintLocation {
                    file: skill_path
                        .join("SKILL.md")
                        .to_string_lossy()
                        .into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Expand the skill body with clear instructions, context, and examples"
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `quality-progressive-disclosure`: skill should use headings to organize content.
pub struct ProgressiveDisclosure;

impl LintRule for ProgressiveDisclosure {
    fn id(&self) -> &'static str {
        "quality-progressive-disclosure"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        // Only check if the body is substantial.
        if content.split_whitespace().count() < 100 {
            return vec![];
        }

        let has_headings = content.contains("\n## ") || content.contains("\n# ");
        if !has_headings {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Long skill content has no section headings (##)".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_path
                        .join("SKILL.md")
                        .to_string_lossy()
                        .into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Use ## headings to divide content into Overview, Instructions, Examples, etc."
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `quality-dependencies`: if skill references external packages, list them.
pub struct Dependencies;

impl LintRule for Dependencies {
    fn id(&self) -> &'static str {
        "quality-dependencies"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        // Check if the skill mentions pip install / npm install but has no deps section.
        let mentions_install =
            content.contains("pip install") || content.contains("npm install") || content.contains("cargo add");
        let has_deps_section = content.contains("## Dependencies")
            || content.contains("## Requirements")
            || content.contains("## Prerequisites");

        if mentions_install && !has_deps_section {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill mentions package installation but has no '## Dependencies' section"
                    .to_string(),
                location: Some(crate::LintLocation {
                    file: skill_path
                        .join("SKILL.md")
                        .to_string_lossy()
                        .into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add a '## Dependencies' or '## Prerequisites' section listing required packages"
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `quality-platform`: skill should not have platform-specific hard-coded paths.
pub struct Platform;

impl LintRule for Platform {
    fn id(&self) -> &'static str {
        "quality-platform"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_body(skill_path) {
            Some(c) => c,
            None => return vec![],
        };

        let mut warnings = Vec::new();

        let windows_paths = [r"C:\", r"D:\", r"C:/Windows"];
        for path in &windows_paths {
            if content.contains(path) {
                warnings.push(LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Info,
                    message: format!(
                        "Hard-coded Windows path '{}' found — skill may not work cross-platform",
                        path
                    ),
                    location: Some(crate::LintLocation {
                        file: skill_path
                            .join("SKILL.md")
                            .to_string_lossy()
                            .into_owned(),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(
                        "Use relative paths or environment variables instead of hard-coded absolute paths"
                            .to_string(),
                    ),
                });
            }
        }
        warnings
    }
}

/// `quality-freshness`: skill should declare a version or last-updated date.
pub struct Freshness;

impl LintRule for Freshness {
    fn id(&self) -> &'static str {
        "quality-freshness"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md_path = skill_path.join("SKILL.md");
        let content = match fs::read_to_string(&skill_md_path) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let has_version_or_date = content.contains("version:")
            || content.contains("last_updated:")
            || content.contains("updated_at:");

        if !has_version_or_date {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message:
                    "Skill has no 'version' or 'last_updated' field — freshness cannot be determined"
                        .to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md_path.to_string_lossy().into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add 'version: \"1.0.0\"' or 'last_updated: \"2026-01-01\"' to frontmatter"
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Read only the body portion of SKILL.md (after the frontmatter block).
fn read_body(skill_path: &Path) -> Option<String> {
    let path = skill_path.join("SKILL.md");
    let content = fs::read_to_string(path).ok()?;

    // Skip past the closing `---` of the frontmatter.
    if content.starts_with("---") {
        let rest = &content[3..];
        if let Some(end) = rest.find("\n---") {
            return Some(rest[end + 4..].to_string());
        }
    }
    // No frontmatter — return full content.
    Some(content)
}
