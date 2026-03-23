// src-tauri/tests/security/symlink_skill_directory_skipped.rs
use skilldeck_lint::{LintConfig, lint_skill};
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[test]
fn symlink_skill_directory_skipped() {
    let temp_dir = TempDir::new().unwrap();
    let real_skill = temp_dir.path().join("real-skill");
    fs::create_dir_all(&real_skill).unwrap();
    fs::write(real_skill.join("SKILL.md"), "---\nname: real\n---\ncontent").unwrap();
    let symlink = temp_dir.path().join("symlink-skill");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&real_skill, &symlink).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(&real_skill, &symlink).unwrap();

    // Lint the symlink directory (should skip because it's a symlink)
    let config = LintConfig::default();
    let warnings = lint_skill(&symlink, &config);
    // No warnings because it's not a real skill directory
    assert!(warnings.is_empty());
}
