//! TOML-based lint configuration parsing.
//!
//! Supports global (`~/.config/skilldeck/skilldeck-lint.toml`) and
//! workspace-level (`.skilldeck/skilldeck-lint.toml`) config files with
//! workspace settings taking precedence (merged on top).

use crate::warning::Severity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Top-level lint configuration structure.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LintConfig {
    #[serde(default)]
    pub defaults: Defaults,
    /// Maps rule_id → severity string ("off" | "info" | "warning" | "error").
    #[serde(default)]
    pub rules: HashMap<String, String>,
    /// Optional rule-specific parameters.
    #[serde(default)]
    pub rule_params: HashMap<String, toml::Value>,
}

/// Default severity settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Defaults {
    #[serde(default = "default_severity")]
    pub severity: String,
}

impl Default for Defaults {
    fn default() -> Self {
        Self {
            severity: default_severity(),
        }
    }
}

fn default_severity() -> String {
    "warning".to_string()
}

impl LintConfig {
    /// Load and merge global + workspace configs.
    ///
    /// Workspace settings override global settings.
    pub fn from_files(
        global: Option<&Path>,
        workspace: Option<&Path>,
    ) -> Result<Self, anyhow::Error> {
        let mut config = Self::default();
        if let Some(global_path) = global {
            if global_path.exists() {
                let content = std::fs::read_to_string(global_path)?;
                let global_config: LintConfig = toml::from_str(&content)?;
                config.merge(global_config);
            }
        }
        if let Some(workspace_path) = workspace {
            if workspace_path.exists() {
                let content = std::fs::read_to_string(workspace_path)?;
                let workspace_config: LintConfig = toml::from_str(&content)?;
                config.merge(workspace_config);
            }
        }
        Ok(config)
    }

    /// Merge another config on top of this one (other takes precedence).
    fn merge(&mut self, other: LintConfig) {
        self.defaults = other.defaults;
        self.rules.extend(other.rules);
        self.rule_params.extend(other.rule_params);
    }

    /// Resolve the effective severity for a rule ID.
    ///
    /// Looks up explicit rule overrides first, then falls back to the
    /// `defaults.severity` field.
    pub fn rule_severity(&self, rule_id: &str) -> Option<Severity> {
        if let Some(s) = self.rules.get(rule_id) {
            Some(parse_severity(s))
        } else {
            Some(parse_severity(&self.defaults.severity))
        }
    }

    /// Get a rule parameter value if set.
    pub fn rule_param(&self, rule_id: &str) -> Option<&toml::Value> {
        self.rule_params.get(rule_id)
    }
}

fn parse_severity(s: &str) -> Severity {
    match s {
        "off" => Severity::Off,
        "info" => Severity::Info,
        "warning" => Severity::Warning,
        "error" => Severity::Error,
        _ => Severity::Warning,
    }
}

/// Generate a default config file content.
pub fn default_config_toml() -> &'static str {
    r#"[defaults]
severity = "warning"

[rules]
# Override severity for specific rules:
# "fm-name-format" = "error"
# "sec-dangerous-tools" = "error"
# "fm-license-present" = "off"

[rule_params]
# Rule-specific parameters can go here
"#
}
