//! `skilldeck-lint` — linting engine for Agent Skill directories.
//!
//! # Usage
//!
//! ```no_run
//! use skilldeck_lint::{lint_skill, LintConfig};
//! use std::path::Path;
//!
//! let config = LintConfig::default();
//! let warnings = lint_skill(Path::new("./my-skill"), &config);
//! for w in &warnings {
//!     println!("{}: {}", w.severity, w.message);
//! }
//! ```

pub mod config;
pub mod rules;
pub mod warning;

pub use config::{LintConfig, default_config_toml};
pub use rules::{LintRule, RuleId};
pub use warning::{LintLocation, LintWarning, Severity};

use std::path::Path;

/// Run all enabled lint rules against the skill directory at `skill_path`.
///
/// Rules whose severity is overridden to `Severity::Off` in the config
/// are skipped entirely.
pub fn lint_skill(skill_path: &Path, config: &LintConfig) -> Vec<LintWarning> {
    let mut warnings = Vec::new();
    for rule in rules::all_rules() {
        if let Some(severity) = config.rule_severity(rule.id()) {
            if severity == Severity::Off {
                continue;
            }
            let mut rule_warnings = rule.check(skill_path, config);
            // Override severity from config (allows users to escalate or downgrade).
            for w in &mut rule_warnings {
                w.severity = severity;
            }
            warnings.extend(rule_warnings);
        }
    }
    warnings
}

/// Compute a security score (1–5) based on lint warnings.
///
/// Each Error-severity security warning reduces the score.
pub fn compute_security_score(warnings: &[LintWarning]) -> u8 {
    let security_errors = warnings
        .iter()
        .filter(|w| {
            w.rule_id.starts_with("sec-") && w.severity == Severity::Error
        })
        .count();

    match security_errors {
        0 => 5,
        1 => 3,
        2 => 2,
        _ => 1,
    }
}

/// Compute a quality score (1–5) based on lint warnings.
pub fn compute_quality_score(warnings: &[LintWarning]) -> u8 {
    let quality_issues = warnings
        .iter()
        .filter(|w| {
            (w.rule_id.starts_with("quality-") || w.rule_id.starts_with("struct-"))
                && w.severity != Severity::Off
                && w.severity != Severity::Info
        })
        .count();

    match quality_issues {
        0 => 5,
        1 => 4,
        2 => 3,
        3 => 2,
        _ => 1,
    }
}
