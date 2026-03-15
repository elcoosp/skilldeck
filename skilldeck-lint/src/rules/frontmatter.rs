//! Frontmatter lint rules — validate the YAML front-matter block in SKILL.md.
//!
//! Expected SKILL.md structure:
//! ```
//! ---
//! name: my-skill
//! description: "A clear description of at least 20 chars"
//! license: MIT
//! compatibility: ["claude-3", "gpt-4"]
//! allowed_tools: ["read_file", "write_file"]
//! ---
//! ... skill body ...
//! ```

use crate::{LintConfig, LintRule, LintWarning, Severity};
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Parse the YAML frontmatter block from a SKILL.md file.
/// Returns `(frontmatter_string, body_string)` or `None` if no frontmatter.
fn parse_frontmatter(content: &str) -> Option<HashMap<String, String>> {
    let content = content.trim_start_matches('\u{feff}'); // strip BOM
    if !content.starts_with("---") {
        return None;
    }
    let rest = &content[3..];
    let end = rest.find("\n---")?;
    let fm_str = &rest[..end];

    // Very simple line-by-line key: value parser for flat frontmatter.
    let mut map = HashMap::new();
    for line in fm_str.lines() {
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_string();
            let value = line[colon_pos + 1..].trim().trim_matches('"').to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }
    Some(map)
}

fn read_skill_md(skill_path: &Path) -> Option<String> {
    let path = skill_path.join("SKILL.md");
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn skill_md_location(skill_path: &Path) -> String {
    skill_path.join("SKILL.md").to_string_lossy().into_owned()
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/// `fm-name-format`: skill name must be lowercase with hyphens, matching directory name.
pub struct NameFormat;

impl LintRule for NameFormat {
    fn id(&self) -> &'static str {
        "fm-name-format"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };
        let name = match fm.get("name") {
            Some(n) => n.clone(),
            None => {
                return vec![LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: "Frontmatter missing required 'name' field".to_string(),
                    location: Some(crate::LintLocation {
                        file: skill_md_location(skill_path),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(
                        "Add 'name: your-skill-name' to the frontmatter".to_string(),
                    ),
                }]
            }
        };

        let re = Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap();
        if !re.is_match(&name) {
            let suggested = name.to_lowercase().replace(' ', "-");
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Error,
                message: format!(
                    "Skill name '{}' must be lowercase kebab-case (letters, digits, hyphens)",
                    name
                ),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(format!("name: {}", suggested)),
            }];
        }

        // Also check directory name matches.
        if let Some(dir_name) = skill_path.file_name().and_then(|n| n.to_str()) {
            if name != dir_name {
                return vec![LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: format!(
                        "Skill name '{}' does not match directory name '{}'",
                        name, dir_name
                    ),
                    location: Some(crate::LintLocation {
                        file: skill_md_location(skill_path),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(format!(
                        "Rename directory to '{}' or change frontmatter name to '{}'",
                        name, dir_name
                    )),
                }];
            }
        }

        vec![]
    }
}

/// `fm-description-length`: description must be at least 20 characters.
pub struct DescriptionLength;

impl LintRule for DescriptionLength {
    fn id(&self) -> &'static str {
        "fm-description-length"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };
        let desc = match fm.get("description") {
            Some(d) => d.clone(),
            None => {
                return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Error,
                message: "Frontmatter missing required 'description' field".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add 'description: \"A clear description of this skill\"' to the frontmatter"
                        .to_string(),
                ),
            }]
            }
        };

        if desc.len() < 20 {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Warning,
                message: format!(
                    "Description is too short ({} chars). Minimum is 20 characters.",
                    desc.len()
                ),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Expand description to clearly explain what the skill does".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `fm-description-content`: description should not be generic/placeholder.
pub struct DescriptionContent;

impl LintRule for DescriptionContent {
    fn id(&self) -> &'static str {
        "fm-description-content"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };
        let desc = match fm.get("description") {
            Some(d) => d.to_lowercase(),
            None => return vec![],
        };

        let placeholders = [
            "todo",
            "fixme",
            "placeholder",
            "description here",
            "add description",
            "my skill",
            "untitled",
        ];

        for placeholder in &placeholders {
            if desc.contains(placeholder) {
                return vec![LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Warning,
                    message: format!(
                        "Description appears to contain a placeholder: '{}'",
                        placeholder
                    ),
                    location: Some(crate::LintLocation {
                        file: skill_md_location(skill_path),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(
                        "Replace the placeholder with a meaningful description".to_string(),
                    ),
                }];
            }
        }
        vec![]
    }
}

/// `fm-license-present`: skill should declare a license.
pub struct LicensePresent;

impl LintRule for LicensePresent {
    fn id(&self) -> &'static str {
        "fm-license-present"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };

        if !fm.contains_key("license") || fm["license"].is_empty() {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill does not declare a license".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add 'license: MIT' or another SPDX identifier to frontmatter".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `fm-license-format`: license should be a valid SPDX identifier.
pub struct LicenseFormat;

impl LintRule for LicenseFormat {
    fn id(&self) -> &'static str {
        "fm-license-format"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };

        let license = match fm.get("license") {
            Some(l) if !l.is_empty() => l.clone(),
            _ => return vec![],
        };

        // Common valid SPDX identifiers.
        let valid_spdx = [
            "MIT",
            "Apache-2.0",
            "GPL-2.0",
            "GPL-3.0",
            "LGPL-2.1",
            "LGPL-3.0",
            "BSD-2-Clause",
            "BSD-3-Clause",
            "ISC",
            "MPL-2.0",
            "AGPL-3.0",
            "CC0-1.0",
            "Unlicense",
            "MIT OR Apache-2.0",
        ];

        if !valid_spdx.iter().any(|s| license.eq_ignore_ascii_case(s)) {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: format!("'{}' may not be a valid SPDX license identifier", license),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Use a standard SPDX identifier like 'MIT', 'Apache-2.0', or 'GPL-3.0'"
                        .to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `fm-compatibility-length`: compatibility list should not be empty.
pub struct CompatibilityLength;

impl LintRule for CompatibilityLength {
    fn id(&self) -> &'static str {
        "fm-compatibility-length"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };

        // Get the compatibility value as a &str, defaulting to empty if missing.
        let compatibility = fm.get("compatibility").map(|s| s.as_str()).unwrap_or("");
        if compatibility.is_empty() || compatibility == "[]" {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill does not declare a 'compatibility' list".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add 'compatibility: [\"claude-3\", \"gpt-4\"]' to frontmatter".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `fm-allowed-tools`: allowed_tools should be declared.
pub struct AllowedTools;

impl LintRule for AllowedTools {
    fn id(&self) -> &'static str {
        "fm-allowed-tools"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => return vec![],
        };

        if !fm.contains_key("allowed_tools") {
            return vec![LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Info,
                message: "Skill does not declare 'allowed_tools'".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md_location(skill_path),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Add 'allowed_tools: []' or list specific tools the skill requires".to_string(),
                ),
            }];
        }
        vec![]
    }
}

/// `fm-metadata-keys`: required frontmatter keys should be present.
pub struct MetadataKeys;

impl LintRule for MetadataKeys {
    fn id(&self) -> &'static str {
        "fm-metadata-keys"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let content = match read_skill_md(skill_path) {
            Some(c) => c,
            None => return vec![],
        };
        let fm = match parse_frontmatter(&content) {
            Some(f) => f,
            None => {
                return vec![LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: "SKILL.md has no YAML frontmatter block".to_string(),
                    location: Some(crate::LintLocation {
                        file: skill_md_location(skill_path),
                        line: Some(1),
                        column: None,
                    }),
                    suggested_fix: Some(
                        "Add a frontmatter block starting with '---' at the top of SKILL.md"
                            .to_string(),
                    ),
                }];
            }
        };

        let required_keys = ["name", "description"];
        let mut warnings = Vec::new();

        for key in &required_keys {
            if !fm.contains_key(*key) {
                warnings.push(LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: format!("Frontmatter missing required key: '{}'", key),
                    location: Some(crate::LintLocation {
                        file: skill_md_location(skill_path),
                        line: None,
                        column: None,
                    }),
                    suggested_fix: Some(format!("Add '{}: ...' to the YAML frontmatter", key)),
                });
            }
        }
        warnings
    }
}
