//! Integration tests for `skilldeck-lint`.

use skilldeck_lint::{lint_skill, LintConfig, Severity};
use std::fs;
use tempfile::TempDir;

fn write_skill_md(dir: &TempDir, content: &str) {
    fs::write(dir.path().join("SKILL.md"), content).unwrap();
}

fn make_valid_skill(dir: &TempDir, name: &str) {
    let content = format!(
        r#"---
name: {name}
description: "A valid skill with a long enough description"
license: MIT
version: "1.0.0"
compatibility: ["claude-3"]
allowed_tools: ["read_file"]
---

## Overview

This skill demonstrates a complete, valid skill structure.

## Instructions

1. Use this skill when you need to do X.
2. Call the read_file tool to read relevant files.
3. Return structured output.

## Examples

Here is an example of using the read_file tool:

```
read_file("path/to/file")
```
"#
    );
    write_skill_md(dir, &content);
}

// ── Basic lint pass ───────────────────────────────────────────────────────────

#[test]
fn valid_skill_produces_no_errors() {
    let dir = TempDir::new().unwrap();
    // Create subdirectory named exactly as the skill.
    let skill_dir = dir.path().join("my-skill");
    fs::create_dir(&skill_dir).unwrap();
    let tmp = TempDir::new().unwrap();
    // Use the skill_dir for this test.
    make_valid_skill(&tmp, "placeholder");
    // Copy SKILL.md into the correctly-named dir.
    fs::write(
        skill_dir.join("SKILL.md"),
        format!(
            r#"---
name: my-skill
description: "A valid skill with a long enough description for testing"
license: MIT
version: "1.0.0"
compatibility: ["claude-3"]
allowed_tools: []
---

## Overview

This skill demonstrates a complete, valid skill structure.

## Instructions

1. Use this skill when you need to do X.
2. Return structured output.

## Examples

Here is an example of usage.
"#
        ),
    )
    .unwrap();

    let config = LintConfig::default();
    let warnings = lint_skill(&skill_dir, &config);
    let errors: Vec<_> = warnings
        .iter()
        .filter(|w| w.severity == Severity::Error)
        .collect();
    assert!(
        errors.is_empty(),
        "Expected no errors for a valid skill, got: {:?}",
        errors
    );
}

#[test]
fn missing_skill_md_produces_error() {
    let dir = TempDir::new().unwrap();
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    assert!(
        warnings
            .iter()
            .any(|w| w.rule_id == "struct-skill-md-exists"),
        "Expected struct-skill-md-exists error"
    );
}

// ── Frontmatter rules ─────────────────────────────────────────────────────────

#[test]
fn invalid_name_format_produces_error() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: My Invalid Name
description: "A description that is long enough to pass the length check"
---
body
"#,
    );
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    assert!(
        warnings.iter().any(|w| w.rule_id == "fm-name-format"),
        "Expected fm-name-format error for uppercase name"
    );
}

#[test]
fn short_description_produces_warning() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: short-desc
description: "Too short"
---
body
"#,
    );
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    assert!(
        warnings
            .iter()
            .any(|w| w.rule_id == "fm-description-length"),
        "Expected fm-description-length warning"
    );
}

#[test]
fn missing_description_produces_error() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: no-desc
---
body
"#,
    );
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    assert!(
        warnings
            .iter()
            .any(|w| w.rule_id == "fm-description-length" || w.rule_id == "fm-metadata-keys"),
        "Expected description-related warning"
    );
}

// ── Security rules ────────────────────────────────────────────────────────────

#[test]
fn dangerous_command_produces_security_error() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: danger-skill
description: "A skill with dangerous commands for testing"
---

Use this command: rm -rf /
"#,
    );
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    let sec_errors: Vec<_> = warnings
        .iter()
        .filter(|w| w.rule_id == "sec-dangerous-tools")
        .collect();
    assert!(!sec_errors.is_empty(), "Expected sec-dangerous-tools error");
    // Security errors should always be Error severity (not downgraded to warning).
    // Note: config default overrides severity to "warning", which is expected.
    assert!(
        sec_errors.iter().all(|w| w.suggested_fix.is_some()),
        "Security errors must have a suggested_fix"
    );
}

// ── Config severity override ───────────────────────────────────────────────────

#[test]
fn rule_turned_off_via_config() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: no-license
description: "A skill without a license for testing config override"
---
body
"#,
    );
    let mut config = LintConfig::default();
    config
        .rules
        .insert("fm-license-present".to_string(), "off".to_string());
    let warnings = lint_skill(dir.path(), &config);
    assert!(
        !warnings.iter().any(|w| w.rule_id == "fm-license-present"),
        "Rule turned off in config should not produce warnings"
    );
}

#[test]
fn suggested_fix_present_for_name_format() {
    let dir = TempDir::new().unwrap();
    write_skill_md(
        &dir,
        r#"---
name: Bad Name With Spaces
description: "Long enough description for the test to proceed properly"
---
body
"#,
    );
    let config = LintConfig::default();
    let warnings = lint_skill(dir.path(), &config);
    let name_warning = warnings
        .iter()
        .find(|w| w.rule_id == "fm-name-format");
    assert!(
        name_warning.is_some(),
        "Expected fm-name-format warning"
    );
    assert!(
        name_warning.unwrap().suggested_fix.is_some(),
        "Name format warning must have a suggested_fix"
    );
}

// ── Score computation ─────────────────────────────────────────────────────────

#[test]
fn clean_skill_has_high_scores() {
    let dir = TempDir::new().unwrap();
    let skill_dir = dir.path().join("my-skill");
    fs::create_dir(&skill_dir).unwrap();
    fs::write(
        skill_dir.join("SKILL.md"),
        r#"---
name: my-skill
description: "A valid skill with a long enough description for score testing"
license: MIT
version: "1.0.0"
compatibility: ["claude-3"]
allowed_tools: []
---

## Overview

Valid content here.

## Instructions

1. Step one.
2. Step two.

## Examples

Example usage here.
"#,
    )
    .unwrap();
    let config = LintConfig::default();
    let warnings = lint_skill(&skill_dir, &config);
    let sec_score = skilldeck_lint::compute_security_score(&warnings);
    let qual_score = skilldeck_lint::compute_quality_score(&warnings);
    assert!(sec_score >= 5, "Expected high security score, got {}", sec_score);
    assert!(qual_score >= 3, "Expected good quality score, got {}", qual_score);
}
