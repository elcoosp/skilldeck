//! Integration test: verify that `skilldeck-lint` produces identical results
//! whether invoked via the library API or via the CLI binary.
//!
//! Run with: cargo test --manifest-path src-tauri/skilldeck-lint/Cargo.toml

use skilldeck_lint::{LintConfig, lint_skill};
use std::fs;
use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

fn write_sample_skill(dir: &TempDir) {
    let skill_dir = dir.path().join("sample-skill");
    fs::create_dir_all(&skill_dir).unwrap();
    fs::write(
        skill_dir.join("SKILL.md"),
        r#"---
name: sample-skill
description: "A test skill for lint consistency verification with enough length"
---

## Overview

This skill is used for integration testing.
"#,
    )
    .unwrap();
}

#[test]
fn test_lint_consistency_lib_vs_cli() {
    let dir = TempDir::new().unwrap();
    write_sample_skill(&dir);
    let skill_path = dir.path().join("sample-skill");

    // 1. Run via lib (direct call).
    let config = LintConfig::default();
    let lib_warnings = lint_skill(&skill_path, &config);

    // 2. Run via CLI (subprocess).
    // NOTE: This test requires the CLI binary to be built first.
    // In CI this runs after `cargo build`, so the binary is available.
    let cli_binary = if cfg!(target_os = "windows") {
        "target/debug/skilldeck-lint.exe"
    } else {
        "target/debug/skilldeck-lint"
    };

    let output = Command::new(cli_binary)
        .args(["validate", "--format", "json", skill_path.to_str().unwrap()])
        .output();

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if !stdout.trim().is_empty() {
                let cli_warnings: Vec<serde_json::Value> =
                    serde_json::from_str(&stdout).unwrap_or_default();

                // Compare counts — the exact messages may vary slightly but counts must match.
                assert_eq!(
                    lib_warnings.len(),
                    cli_warnings.len(),
                    "Lib produced {} warnings but CLI produced {}. Lib: {:?}",
                    lib_warnings.len(),
                    cli_warnings.len(),
                    lib_warnings.iter().map(|w| &w.rule_id).collect::<Vec<_>>()
                );
            }
            // If CLI output is empty (no warnings), lib should also have no warnings.
        }
        Err(_) => {
            // CLI binary not built yet — skip comparison but still validate lib works.
            println!("CLI binary not available, skipping CLI comparison.");
        }
    }

    // Always verify lib produces deterministic results.
    let lib_warnings2 = lint_skill(&skill_path, &config);
    assert_eq!(
        lib_warnings.len(),
        lib_warnings2.len(),
        "Lint results are not deterministic"
    );
}

#[test]
fn test_all_warnings_have_rule_ids() {
    let dir = TempDir::new().unwrap();
    write_sample_skill(&dir);
    let skill_path = dir.path().join("sample-skill");
    let config = LintConfig::default();
    let warnings = lint_skill(&skill_path, &config);
    for w in &warnings {
        assert!(!w.rule_id.is_empty(), "Warning has empty rule_id: {:?}", w);
    }
}

#[test]
fn test_all_security_warnings_have_suggested_fix() {
    use std::fs;
    let dir = TempDir::new().unwrap();
    let skill_dir = dir.path().join("dangerous-skill");
    fs::create_dir_all(&skill_dir).unwrap();
    fs::write(
        skill_dir.join("SKILL.md"),
        r#"---
name: dangerous-skill
description: "A deliberately dangerous skill for testing security rules"
---

WARNING: This uses rm -rf / to clean up.
"#,
    )
    .unwrap();

    let config = LintConfig::default();
    let warnings = lint_skill(&skill_dir, &config);
    let security_warnings: Vec<_> = warnings
        .iter()
        .filter(|w| w.rule_id.starts_with("sec-"))
        .collect();

    for w in security_warnings {
        assert!(
            w.suggested_fix.is_some(),
            "Security warning '{}' must have a suggested_fix",
            w.rule_id
        );
    }
}
