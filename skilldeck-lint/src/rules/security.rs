//! Security lint rules — detect dangerous patterns in skill content.
//!
//! These rules are tagged with Error severity by default and produce
//! a `suggested_fix` to help the user understand what to do.
//!
//! UX Note: Security warnings render with a distinct red "Security Risk"
//! badge in the UI (Severity::Error), separate from style warnings.

use crate::{LintConfig, LintRule, LintWarning, Severity};
use std::fs;
use std::path::Path;

/// `sec-dangerous-tools`: detect potentially dangerous shell commands.
pub struct DangerousTools;

impl LintRule for DangerousTools {
    fn id(&self) -> &'static str {
        "sec-dangerous-tools"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md = skill_path.join("SKILL.md");
        let content = match fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let mut warnings = Vec::new();

        let dangerous_patterns: &[(&str, &str)] = &[
            ("rm -rf /", "Recursive root deletion detected"),
            ("rm -rf /*", "Recursive root deletion pattern detected"),
            ("sudo rm", "Privileged file deletion detected"),
            (":(){:|:&};:", "Fork bomb pattern detected"),
            ("mkfs", "Filesystem format command detected"),
            ("dd if=/dev/zero", "Disk overwrite command detected"),
            ("chmod 777 /", "Recursive world-writable permission change on root"),
            ("> /etc/passwd", "Overwrite of system credentials file"),
            ("curl | sh", "Piping remote script to shell detected"),
            ("wget -O- | sh", "Piping remote script to shell detected"),
            ("eval $(", "Dynamic code evaluation detected"),
            ("base64 -d | sh", "Base64-decoded shell execution detected"),
        ];

        for (pattern, description) in dangerous_patterns {
            if content.contains(pattern) {
                warnings.push(LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Error,
                    message: format!(
                        "Security: {} — pattern '{}' found in skill content",
                        description, pattern
                    ),
                    location: Some(crate::LintLocation {
                        file: skill_md.to_string_lossy().into_owned(),
                        line: find_line_number(&content, pattern),
                        column: None,
                    }),
                    suggested_fix: Some(
                        "Remove or replace dangerous commands. If intentional, document the reason clearly in the description and consider adding a user warning.".to_string()
                    ),
                });
            }
        }

        // Check for obfuscation patterns.
        let obfuscation_re =
            regex::Regex::new(r"\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2}){4,}").unwrap();
        if obfuscation_re.is_match(&content) {
            warnings.push(LintWarning {
                rule_id: self.id().to_string(),
                severity: Severity::Error,
                message: "Potential obfuscated code detected (hex encoding pattern)".to_string(),
                location: Some(crate::LintLocation {
                    file: skill_md.to_string_lossy().into_owned(),
                    line: None,
                    column: None,
                }),
                suggested_fix: Some(
                    "Replace obfuscated content with clear, readable instructions".to_string(),
                ),
            });
        }

        warnings
    }
}

/// `sec-allowed-tools-mismatch`: tools used in skill body should be declared in `allowed_tools`.
pub struct AllowedToolsMismatch;

impl LintRule for AllowedToolsMismatch {
    fn id(&self) -> &'static str {
        "sec-allowed-tools-mismatch"
    }

    fn check(&self, skill_path: &Path, _config: &LintConfig) -> Vec<LintWarning> {
        let skill_md = skill_path.join("SKILL.md");
        let content = match fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        // Parse allowed_tools from frontmatter.
        let fm = match parse_allowed_tools_from_content(&content) {
            Some(t) => t,
            None => return vec![],
        };

        // Find tool invocations in the body (common pattern: `tool_name(` or `use tool_name`).
        // This is a heuristic check.
        let known_tools = [
            "read_file",
            "write_file",
            "execute_shell",
            "list_directory",
            "web_search",
            "web_fetch",
            "bash",
            "python",
            "run_code",
        ];

        let mut warnings = Vec::new();
        for tool in &known_tools {
            if content.contains(tool) && !fm.contains(&tool.to_string()) {
                warnings.push(LintWarning {
                    rule_id: self.id().to_string(),
                    severity: Severity::Warning,
                    message: format!(
                        "Tool '{}' appears to be used but is not listed in 'allowed_tools'",
                        tool
                    ),
                    location: Some(crate::LintLocation {
                        file: skill_md.to_string_lossy().into_owned(),
                        line: find_line_number(&content, tool),
                        column: None,
                    }),
                    suggested_fix: Some(format!(
                        "Add '{}' to the 'allowed_tools' list in frontmatter, or remove its usage",
                        tool
                    )),
                });
            }
        }
        warnings
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_line_number(content: &str, pattern: &str) -> Option<usize> {
    content
        .lines()
        .enumerate()
        .find(|(_, line)| line.contains(pattern))
        .map(|(i, _)| i + 1)
}

fn parse_allowed_tools_from_content(content: &str) -> Option<Vec<String>> {
    // Look for `allowed_tools: [...]` in frontmatter.
    let fm_end = content.find("\n---")?;
    let fm = &content[..fm_end];
    let line = fm
        .lines()
        .find(|l| l.trim_start().starts_with("allowed_tools:"))?;
    let value_part = line.splitn(2, ':').nth(1)?.trim();

    // Parse a simple bracketed list: ["a", "b"] or [a, b].
    let inner = value_part
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim();
    if inner.is_empty() {
        return Some(vec![]);
    }

    let tools: Vec<String> = inner
        .split(',')
        .map(|s| {
            s.trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string()
        })
        .filter(|s| !s.is_empty())
        .collect();

    Some(tools)
}
