//! Core warning types for skilldeck-lint.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Severity level of a lint warning.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Off,
    Info,
    Warning,
    Error,
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Off => write!(f, "off"),
            Self::Info => write!(f, "info"),
            Self::Warning => write!(f, "warning"),
            Self::Error => write!(f, "error"),
        }
    }
}

/// File location for a warning.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LintLocation {
    pub file: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

/// A single lint warning emitted by a rule.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LintWarning {
    pub rule_id: String,
    pub severity: Severity,
    pub message: String,
    pub location: Option<LintLocation>,
    /// UX Addition: Allows the UI to suggest/auto-apply a fix.
    pub suggested_fix: Option<String>,
}
