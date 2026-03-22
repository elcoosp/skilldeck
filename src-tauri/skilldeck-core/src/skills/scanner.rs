//! Skill directory scanner.
//!
//! Walks one or more root directories looking for sub-directories that contain
//! a `SKILL.md` file, then loads each one via [`FilesystemSkillLoader`] and runs the linter.

use std::path::PathBuf;
use tokio::fs;
use tracing::{debug, warn};

use crate::{
    CoreError,
    skills::loader::FilesystemSkillLoader,
    traits::{Skill, SkillLoader, SkillSource},
};

use skilldeck_lint::{LintConfig, lint_skill as do_lint};

/// Scan a single root directory for skills.
///
/// Each immediate sub-directory that contains a `SKILL.md` file is loaded,
/// linted, and the lint results stored in the Skill struct.
/// Load errors are logged and skipped rather than propagated so that one bad
/// skill does not prevent the rest from loading.
pub async fn scan_directory(
    root: &PathBuf,
    lint_config: &LintConfig,
) -> Result<Vec<Skill>, CoreError> {
    let mut skills = Vec::new();
    let loader = FilesystemSkillLoader;

    let mut read_dir = fs::read_dir(root)
        .await
        .map_err(|e| CoreError::FileOperation {
            path: root.clone(),
            message: format!("Cannot read skill directory: {}", e),
        })?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| CoreError::FileOperation {
            path: root.clone(),
            message: format!("Error iterating directory: {}", e),
        })?
    {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }

        let skill_md = entry_path.join("SKILL.md");
        if !skill_md.exists() {
            debug!("Skipping {:?} — no SKILL.md", entry_path);
            continue;
        }

        match loader
            .load(&SkillSource::Filesystem(entry_path.clone()))
            .await
        {
            Ok(mut skill) => {
                // Run linter
                let path_clone = entry_path.clone();
                let config_clone = lint_config.clone();
                let warnings =
                    tokio::task::spawn_blocking(move || do_lint(&path_clone, &config_clone))
                        .await
                        .unwrap_or_default();
                let sec = skilldeck_lint::compute_security_score(&warnings);
                let qual = skilldeck_lint::compute_quality_score(&warnings);

                skill.lint_warnings = Some(warnings);
                skill.security_score = sec;
                skill.quality_score = qual;

                debug!("Loaded skill '{}' from {:?}", skill.name, entry_path);
                skills.push(skill);
            }
            Err(e) => {
                warn!("Failed to load skill from {:?}: {}", entry_path, e);
            }
        }
    }

    Ok(skills)
}

/// Scan multiple root directories and combine results.
///
/// Returns `(source_label, skills)` pairs suitable for feeding into
/// [`crate::skills::resolver::resolve`].
pub async fn scan_directories(
    roots: &[(String, PathBuf)],
    lint_config: &LintConfig,
) -> Vec<(String, Vec<Skill>)> {
    let mut results = Vec::new();

    for (label, path) in roots {
        match scan_directory(path, lint_config).await {
            Ok(skills) => {
                debug!("Scanned '{}' — {} skills", label, skills.len());
                results.push((label.clone(), skills));
            }
            Err(e) => {
                warn!(
                    "Could not scan skill directory '{}' ({:?}): {}",
                    label, path, e
                );
                results.push((label.clone(), vec![]));
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as std_fs;

    fn write_skill(dir: &std::path::Path, name: &str) {
        let skill_dir = dir.join(name);
        std_fs::create_dir_all(&skill_dir).unwrap();
        std_fs::write(
            skill_dir.join("SKILL.md"),
            format!("---\nname: {}\ndescription: test\n---\ncontent", name),
        )
        .unwrap();
    }

    #[tokio::test]
    async fn scan_finds_skills() {
        let tmp = tempfile::tempdir().unwrap();
        write_skill(tmp.path(), "alpha");
        write_skill(tmp.path(), "beta");

        let config = LintConfig::default();
        let skills = scan_directory(&tmp.path().to_owned(), &config)
            .await
            .unwrap();
        assert_eq!(skills.len(), 2);
        let mut names: Vec<_> = skills.iter().map(|s| s.name.as_str()).collect();
        names.sort();
        assert_eq!(names, ["alpha", "beta"]);
    }

    #[tokio::test]
    async fn scan_skips_non_skill_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        write_skill(tmp.path(), "good-skill");
        // A sub-dir with no SKILL.md
        std_fs::create_dir_all(tmp.path().join("not-a-skill")).unwrap();

        let config = LintConfig::default();
        let skills = scan_directory(&tmp.path().to_owned(), &config)
            .await
            .unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].name, "good-skill");
    }

    #[tokio::test]
    async fn scan_nonexistent_dir_returns_err() {
        let config = LintConfig::default();
        let result = scan_directory(&PathBuf::from("/does/not/exist"), &config).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn scan_directories_multi() {
        let tmp1 = tempfile::tempdir().unwrap();
        let tmp2 = tempfile::tempdir().unwrap();
        write_skill(tmp1.path(), "skill-a");
        write_skill(tmp2.path(), "skill-b");

        let roots = vec![
            ("personal".to_string(), tmp1.path().to_owned()),
            ("workspace".to_string(), tmp2.path().to_owned()),
        ];
        let config = LintConfig::default();
        let results = scan_directories(&roots, &config).await;
        assert_eq!(results.len(), 2);
        let total: usize = results.iter().map(|(_, v)| v.len()).sum();
        assert_eq!(total, 2);
    }

    #[tokio::test]
    async fn scan_directories_missing_root_yields_empty_vec() {
        let roots = vec![("ghost".to_string(), PathBuf::from("/ghost/path"))];
        let config = LintConfig::default();
        let results = scan_directories(&roots, &config).await;
        assert_eq!(results.len(), 1);
        assert!(results[0].1.is_empty());
    }
}
