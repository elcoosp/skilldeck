//! Filesystem-based skill loader.
//!
//! Parses SKILL.md files with YAML frontmatter.

use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;

use crate::{
    CoreError,
    traits::{Skill, SkillLoader, SkillManifest, SkillSource},
};

/// Filesystem skill loader.
pub struct FilesystemSkillLoader;

impl FilesystemSkillLoader {
    /// Parse a SKILL.md file content into a [`Skill`].
    pub fn parse(content: &str, path: PathBuf, source: String) -> Result<Skill, CoreError> {
        let content = content.trim_start_matches('\u{FEFF}');

        if !content.starts_with("---") {
            return Err(CoreError::SkillParse {
                name: path.display().to_string(),
                message: "SKILL.md missing YAML frontmatter delimiter".into(),
            });
        }

        let rest = &content[3..];
        let end = rest.find("\n---").ok_or_else(|| CoreError::SkillParse {
            name: path.display().to_string(),
            message: "SKILL.md missing closing frontmatter delimiter".into(),
        })?;

        let frontmatter = &rest[..end];
        let body = rest[end + 4..].trim_start_matches('\n');

        let manifest: SkillManifest =
            serde_yaml::from_str(frontmatter).map_err(|e| CoreError::SkillParse {
                name: path.display().to_string(),
                message: format!("Invalid YAML frontmatter: {}", e),
            })?;

        let name = manifest
            .extra
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| CoreError::SkillParse {
                name: path.display().to_string(),
                message: "Skill missing 'name' in frontmatter".into(),
            })?
            .to_string();

        let description = manifest
            .extra
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let content_hash = {
            let mut hasher = Sha256::new();
            hasher.update(body.as_bytes());
            format!("{:x}", hasher.finalize())
        };

        Ok(Skill {
            name,
            description,
            content_md: body.to_string(),
            manifest,
            disk_path: Some(path),
            source,
            content_hash: Some(content_hash),
        })
    }

    /// Hash a skill directory path (stable identifier).
    pub fn compute_dir_hash(skill_dir: &Path) -> String {
        let mut hasher = Sha256::new();
        hasher.update(skill_dir.to_string_lossy().as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[async_trait]
impl SkillLoader for FilesystemSkillLoader {
    async fn load(&self, source: &SkillSource) -> Result<Skill, CoreError> {
        match source {
            SkillSource::Filesystem(path) => {
                let skill_md = path.join("SKILL.md");
                if !skill_md.exists() {
                    return Err(CoreError::SkillNotFound { path: skill_md });
                }
                let content = fs::read_to_string(&skill_md).await?;
                Self::parse(&content, path.clone(), "filesystem".to_string())
            }
            SkillSource::Database(_) => Err(CoreError::NotImplemented {
                feature: "Database skill loading".into(),
            }),
            SkillSource::Remote(_) => Err(CoreError::NotImplemented {
                feature: "Remote skill loading".into(),
            }),
        }
    }

    async fn exists(&self, source: &SkillSource) -> bool {
        match source {
            SkillSource::Filesystem(path) => path.join("SKILL.md").exists(),
            _ => false,
        }
    }

    async fn modified_at(&self, source: &SkillSource) -> Option<std::time::SystemTime> {
        match source {
            SkillSource::Filesystem(path) => fs::metadata(path.join("SKILL.md"))
                .await
                .ok()?
                .modified()
                .ok(),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as std_fs;
    use tempfile::TempDir;

    fn create_skill_dir(name: &str) -> (TempDir, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join(name);
        std_fs::create_dir_all(&dir).unwrap();
        std_fs::write(
            dir.join("SKILL.md"),
            format!(
                "---\nname: {}\ndescription: Test skill\ntriggers:\n  - test\n---\n# {}\nDo something.",
                name, name
            ),
        )
        .unwrap();
        (tmp, dir)
    }

    #[test]
    fn parse_valid_skill() {
        let c = "---\nname: my-skill\ndescription: A test\n---\n# My Skill\nHello";
        let s = FilesystemSkillLoader::parse(c, PathBuf::from("/skills/my-skill"), "test".into())
            .unwrap();
        assert_eq!(s.name, "my-skill");
        assert_eq!(s.description, "A test");
        assert!(s.content_md.contains("Hello"));
        assert!(s.content_hash.is_some());
    }

    #[test]
    fn parse_bom_prefix() {
        let c = "\u{FEFF}---\nname: bom-skill\n---\nbody";
        let s = FilesystemSkillLoader::parse(c, PathBuf::from("/skills/bom"), "t".into()).unwrap();
        assert_eq!(s.name, "bom-skill");
    }

    #[test]
    fn parse_missing_frontmatter_err() {
        assert!(FilesystemSkillLoader::parse(
            "# No front",
            PathBuf::from("/x"),
            "t".into()
        )
        .is_err());
    }

    #[test]
    fn parse_missing_name_err() {
        assert!(FilesystemSkillLoader::parse(
            "---\ndescription: no name\n---\nbody",
            PathBuf::from("/x"),
            "t".into()
        )
        .is_err());
    }

    #[test]
    fn same_body_same_hash() {
        let h1 = FilesystemSkillLoader::parse("---\nname: s\n---\nbody", PathBuf::from("/a"), "t".into())
            .unwrap().content_hash;
        let h2 = FilesystemSkillLoader::parse("---\nname: s\nextra: yes\n---\nbody", PathBuf::from("/b"), "t".into())
            .unwrap().content_hash;
        assert_eq!(h1, h2);
    }

    #[tokio::test]
    async fn load_from_filesystem() {
        let (_tmp, path) = create_skill_dir("test-skill");
        let s = FilesystemSkillLoader.load(&SkillSource::Filesystem(path)).await.unwrap();
        assert_eq!(s.name, "test-skill");
    }

    #[tokio::test]
    async fn load_nonexistent_err() {
        assert!(FilesystemSkillLoader
            .load(&SkillSource::Filesystem(PathBuf::from("/nonexistent")))
            .await
            .is_err());
    }

    #[tokio::test]
    async fn exists_true_when_present() {
        let (_tmp, path) = create_skill_dir("e-skill");
        assert!(FilesystemSkillLoader.exists(&SkillSource::Filesystem(path)).await);
    }

    #[tokio::test]
    async fn exists_false_when_absent() {
        assert!(!FilesystemSkillLoader
            .exists(&SkillSource::Filesystem(PathBuf::from("/no/such/dir")))
            .await);
    }
}
