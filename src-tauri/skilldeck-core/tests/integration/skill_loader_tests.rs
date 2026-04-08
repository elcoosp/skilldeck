//! Integration tests for FilesystemSkillLoader.
//!
//! These tests exercise the full load path from disk → parsed Skill struct,
//! covering valid skills, all error modes, and hash stability guarantees.

use skilldeck_core::{
    skills::loader::FilesystemSkillLoader,
    traits::{SkillLoader, SkillSource},
};
use std::fs;
use tempfile::TempDir;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn write_skill(dir: &TempDir, name: &str, content: &str) -> std::path::PathBuf {
    let skill_dir = dir.path().join(name);
    fs::create_dir_all(&skill_dir).unwrap();
    fs::write(skill_dir.join("SKILL.md"), content).unwrap();
    skill_dir
}

fn valid_skill(name: &str) -> String {
    format!(
        "---\nname: {name}\ndescription: Tests the {name} skill\ntriggers:\n  - {name}\n---\n# {name}\nDo something useful.\n"
    )
}

// ── Happy-path loading ────────────────────────────────────────────────────────

#[tokio::test]
async fn load_valid_skill_parses_all_fields() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "code-review", &valid_skill("code-review"));

    let skill = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await
        .unwrap();

    assert_eq!(skill.name, "code-review");
    assert_eq!(skill.description, "Tests the code-review skill");
    assert!(skill.content_md.contains("Do something useful"));
    assert_eq!(skill.manifest.triggers, vec!["code-review"]);
    assert!(skill.content_hash.is_some());
    assert_eq!(skill.source, "filesystem");
}

#[tokio::test]
async fn load_skill_with_extra_frontmatter_fields() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(
        &dir,
        "extra",
        "---\nname: extra\ndescription: Has extras\nauthor: alice\nversion: 2.0\nrequires:\n  - git\n---\nContent.\n",
    );

    let skill = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await
        .unwrap();

    assert_eq!(skill.name, "extra");
    assert_eq!(skill.manifest.author, "alice");
    assert_eq!(skill.manifest.version, "2.0");
    assert_eq!(skill.manifest.requires, vec!["git"]);
}

#[tokio::test]
async fn load_skill_without_description_uses_empty_string() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(
        &dir,
        "nodesc",
        "---\nname: nodesc\n---\nBody content.\n",
    );

    let skill = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await
        .unwrap();

    assert_eq!(skill.name, "nodesc");
    assert_eq!(skill.description, "");
}

#[tokio::test]
async fn load_skill_with_bom_prefix() {
    let dir = TempDir::new().unwrap();
    let skill_dir = dir.path().join("bom-skill");
    fs::create_dir_all(&skill_dir).unwrap();
    // Prepend UTF-8 BOM (0xEF 0xBB 0xBF)
    let content = "\u{FEFF}---\nname: bom-skill\ndescription: BOM test\n---\nBody.\n";
    fs::write(skill_dir.join("SKILL.md"), content).unwrap();

    let skill = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(skill_dir))
        .await
        .unwrap();

    assert_eq!(skill.name, "bom-skill");
}

// ── Error cases ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn load_nonexistent_directory_returns_err() {
    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem("/absolutely/nonexistent/path".into()))
        .await;
    assert!(result.is_err(), "loading a missing directory must fail");
}

#[tokio::test]
async fn load_missing_skill_md_returns_err() {
    let dir = TempDir::new().unwrap();
    // Directory exists but no SKILL.md
    let skill_dir = dir.path().join("empty-skill");
    fs::create_dir_all(&skill_dir).unwrap();

    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(skill_dir))
        .await;
    assert!(result.is_err());
}

#[tokio::test]
async fn load_skill_missing_name_returns_err() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "no-name", "---\ndescription: No name here\n---\nBody.\n");

    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await;
    assert!(result.is_err(), "missing 'name' field must cause a parse error");
}

#[tokio::test]
async fn load_skill_invalid_yaml_returns_err() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(
        &dir,
        "bad-yaml",
        "---\nname: [unclosed bracket\n---\nBody.\n",
    );

    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await;
    assert!(result.is_err(), "malformed YAML must cause a parse error");
}

#[tokio::test]
async fn load_skill_missing_frontmatter_delimiter_returns_err() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "no-front", "# Just a heading\nNo frontmatter.\n");

    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await;
    assert!(result.is_err());
}

#[tokio::test]
async fn load_skill_unclosed_frontmatter_returns_err() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "unclosed", "---\nname: unclosed\ndescription: Missing closing delimiter\n");

    let result = FilesystemSkillLoader
        .load(&SkillSource::Filesystem(path))
        .await;
    assert!(result.is_err());
}

// ── Content hash stability ────────────────────────────────────────────────────

#[tokio::test]
async fn identical_content_produces_identical_hash() {
    let dir = TempDir::new().unwrap();

    let p1 = write_skill(&dir, "skill-a", &valid_skill("skill-a"));
    let p2 = write_skill(&dir, "skill-b", "---\nname: skill-b\ndescription: Same body\n---\nDo something useful.\n");

    // Write skill-a with the same *body* as skill-b (frontmatter differs)
    let p1_same_body = write_skill(
        &dir,
        "skill-a2",
        "---\nname: skill-a2\ndescription: Different desc\n---\nDo something useful.\n",
    );

    let s_a = FilesystemSkillLoader.load(&SkillSource::Filesystem(p1_same_body)).await.unwrap();
    let s_b = FilesystemSkillLoader.load(&SkillSource::Filesystem(p2)).await.unwrap();

    // Hash is computed from body only — same body = same hash
    assert_eq!(
        s_a.content_hash, s_b.content_hash,
        "skills with identical bodies must have the same content hash"
    );
}

#[tokio::test]
async fn different_content_produces_different_hash() {
    let dir = TempDir::new().unwrap();

    let p1 = write_skill(&dir, "v1", "---\nname: v1\n---\nContent version 1.\n");
    let p2 = write_skill(&dir, "v2", "---\nname: v2\n---\nContent version 2.\n");

    let s1 = FilesystemSkillLoader.load(&SkillSource::Filesystem(p1)).await.unwrap();
    let s2 = FilesystemSkillLoader.load(&SkillSource::Filesystem(p2)).await.unwrap();

    assert_ne!(
        s1.content_hash, s2.content_hash,
        "different bodies must produce different hashes"
    );
}

#[tokio::test]
async fn hash_is_deterministic_across_loads() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "stable", &valid_skill("stable"));

    let s1 = FilesystemSkillLoader.load(&SkillSource::Filesystem(path.clone())).await.unwrap();
    let s2 = FilesystemSkillLoader.load(&SkillSource::Filesystem(path)).await.unwrap();

    assert_eq!(s1.content_hash, s2.content_hash, "hash must be deterministic");
}

// ── exists / modified_at ──────────────────────────────────────────────────────

#[tokio::test]
async fn exists_true_when_skill_md_present() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "present", &valid_skill("present"));

    assert!(FilesystemSkillLoader.exists(&SkillSource::Filesystem(path)).await);
}

#[tokio::test]
async fn exists_false_when_no_skill_md() {
    let dir = TempDir::new().unwrap();
    let skill_dir = dir.path().join("empty");
    fs::create_dir_all(&skill_dir).unwrap();

    assert!(!FilesystemSkillLoader.exists(&SkillSource::Filesystem(skill_dir)).await);
}

#[tokio::test]
async fn exists_false_for_missing_directory() {
    assert!(
        !FilesystemSkillLoader
            .exists(&SkillSource::Filesystem("/no/such/skill".into()))
            .await
    );
}

#[tokio::test]
async fn modified_at_returns_some_for_existing_skill() {
    let dir = TempDir::new().unwrap();
    let path = write_skill(&dir, "timed", &valid_skill("timed"));

    let mtime = FilesystemSkillLoader
        .modified_at(&SkillSource::Filesystem(path))
        .await;
    assert!(mtime.is_some(), "modified_at must return Some for a real file");
}

#[tokio::test]
async fn modified_at_returns_none_for_missing_skill() {
    let mtime = FilesystemSkillLoader
        .modified_at(&SkillSource::Filesystem("/no/such/dir".into()))
        .await;
    assert!(mtime.is_none());
}

// ── Unsupported source types ──────────────────────────────────────────────────

#[tokio::test]
async fn load_database_source_returns_not_implemented() {
    let result = FilesystemSkillLoader
        .load(&SkillSource::Database(uuid::Uuid::new_v4()))
        .await;
    assert!(result.is_err(), "Database source must return an error");
}

#[tokio::test]
async fn load_remote_source_returns_not_implemented() {
    let result = FilesystemSkillLoader
        .load(&SkillSource::Remote("https://example.com/skill".into()))
        .await;
    assert!(result.is_err(), "Remote source must return an error");
}





