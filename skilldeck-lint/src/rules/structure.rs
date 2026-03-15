//! Structure lint rules — validate SKILL.md file existence and size.

use crate::{LintConfig, LintRule, LintWarning, Severity};
use std::fs;
use std::path::Path;

const MAX_SKILL_MD_BYTES: u64 = 100 * 1024; // 100 KB
const MAX_REFERENCE_DEPTH: usize = 3;

/// `struct-skill-md-exists`: SKILL.md must exist in the skill directory.
pub struct SkillMdExists;

impl LintRule for SkillMdExists {
    fn id(&self) -> &'static str {
        "struct-skill-md-exists"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md = skill_path.join("SKILL.md");
        if !skill_md.exists() {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Error,
                message: "SKILL.md not found in skill directory".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md.to_string_lossy().into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Create a SKILL.md file with frontmatter and skill instructions".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `struct-skill-md-size`: SKILL.md should not be too large.
pub struct SkillMdSize;

impl LintRule for SkillMdSize {
    fn id(&self) -> &'static str {
        "struct-skill-md-size"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md = skill_path.join("SKILL.md");
        let metadata = match fs::metadata(&skill_md) {
            Ok(m) => m,
            Err(_) => return vec![],
        };
        let size = metadata.len();
        if size > MAX_SKILL_MD_BYTES {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Warning,
                message: format!(
                    "SKILL.md is {}KB, exceeding the recommended limit of {}KB. Large skills slow context loading.",
                    size / 1024,
                    MAX_SKILL_MD_BYTES / 1024
                ),
                location: Some(crate::LintLocation {
                    file: skill_md.to_string_lossy().into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Split the skill into smaller sub-skills or move large content to referenced files"
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `struct-references-exist`: referenced files in SKILL.md must exist.
pub struct ReferencesExist;

impl LintRule for ReferencesExist {
    fn id(&self) -> &'static str {
        "struct-references-exist"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md_path = skill_path.join("SKILL.md");
        let content = match fs::read_to_string(&skill_md_path) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let mut warnings = Vec::new();

        // Look for markdown links to local files: [text](./path) or [text](path.md)
        let link_re = regex::Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap();
        for cap in link_re.captures_iter(&content) {
            let href = &cap[2];
            // Only check local relative paths, not http(s) or anchors.
            if href.starts_with("http") || href.starts_with('#') {
                continue;
            }
            let referenced = skill_path.join(href.trim_start_matches("./"));
            if !referenced.exists() {
                warnings.push(LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Warning,
                    message: format!("Referenced file '{}' does not exist", href),
                    location: Some(crate::LintLocation {
                        file: skill_md_path.to_string_lossy().into_owned(),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(format!(
                        "Create the file '{}' or remove the broken link",
                        href
                    )),
                });
            }
        }
        warnings
    }
}

/// `struct-references-depth`: skill directory nesting should not be too deep.
pub struct ReferencesDepth;

impl LintRule for ReferencesDepth {
    fn id(&self) -> &'static str {
        "struct-references-depth"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let mut warnings = Vec::new();
        check_depth(skill_path, skill_path, 0, MAX_REFERENCE_DEPTH, &mut warnings);
        warnings
    }
}

fn check_depth(
    base: &Path,
    current: &Path,
    depth: usize,
    max_depth: usize,
    warnings: &mut Vec<LintWarning>,
) {
    if depth > max_depth {
        warnings.push(LintWarning {
            rule_id: "struct-references-depth".to_string(),
            severity: Severity::Info,
            message: format!(
                "Directory nesting depth {} exceeds recommended maximum of {}",
                depth, max_depth
            ),
            location: Some(crate::LintLocation {
                file: current.to_string_lossy().into_owned(),
                line: None,
                column: None,
            }),
            suggested_fix: Some(
                "Flatten the directory structure to reduce cognitive complexity".to_string(),
            ),
        });
        return;
    }
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                check_depth(base, &entry.path(), depth + 1, max_depth, warnings);
            }
        }
    }
}
