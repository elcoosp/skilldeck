//! Workspace context loading.
//!
//! Reads context files from a workspace root (CLAUDE.md, README, project
//! manifests, .gitignore) and assembles them into a `WorkspaceContext` that
//! the agent loop injects into its system prompt.

use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

use crate::CoreError;
use super::detector::{ProjectType, WorkspaceDetector};

// ── Public types ──────────────────────────────────────────────────────────────

/// All context gathered from a workspace root.
#[derive(Debug, Clone)]
pub struct WorkspaceContext {
    /// Absolute workspace root path.
    pub root: PathBuf,
    /// Detected project ecosystem.
    pub project_type: ProjectType,
    /// Loaded context files, sorted highest-priority first.
    pub context_files: Vec<ContextFile>,
    /// Path to a `.skilldeck/skills` or `.claude/skills` directory, if present.
    pub skill_directory: Option<PathBuf>,
    /// Whether a `.git` directory exists at the root.
    pub is_git_repo: bool,
    /// Non-comment, non-blank lines from `.gitignore`.
    pub gitignore_patterns: Vec<String>,
}

/// A single loaded context file.
#[derive(Debug, Clone)]
pub struct ContextFile {
    /// File name (without path).
    pub name: String,
    /// Full path.
    pub path: PathBuf,
    /// File contents.
    pub content: String,
    /// Higher = more important (used for sort order).
    pub priority: u32,
}

// ── ContextLoader ─────────────────────────────────────────────────────────────

pub struct ContextLoader;

impl ContextLoader {
    /// Load the full workspace context rooted at `root`.
    pub async fn load<P: AsRef<Path>>(root: P) -> Result<WorkspaceContext, CoreError> {
        let root = root.as_ref().to_path_buf();
        let project_type = WorkspaceDetector::detect(&root).await;
        info!("Loading workspace context for {:?} ({})", root, project_type);

        let context_files = Self::load_context_files(&root, project_type).await?;
        let skill_directory = Self::find_skill_directory(&root).await;
        let is_git_repo = root.join(".git").exists();
        let gitignore_patterns = if is_git_repo {
            Self::load_gitignore(&root).await.unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(WorkspaceContext { root, project_type, context_files, skill_directory,
            is_git_repo, gitignore_patterns })
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    async fn load_context_files(
        root: &Path,
        project_type: ProjectType,
    ) -> Result<Vec<ContextFile>, CoreError> {
        let mut files: Vec<ContextFile> = Vec::new();

        // Base context files in decreasing priority.
        for &(name, priority) in &[
            ("CLAUDE.md",  100u32),
            ("README.md",   50),
            ("readme.md",   50),
            ("README",      40),
        ] {
            Self::try_load(root, name, priority, &mut files).await;
        }

        // Project-type-specific manifests.
        match project_type {
            ProjectType::Rust   => Self::try_load(root, "Cargo.toml",    30, &mut files).await,
            ProjectType::Node   => Self::try_load(root, "package.json",  30, &mut files).await,
            ProjectType::Python => Self::try_load(root, "pyproject.toml", 30, &mut files).await,
            ProjectType::Go     => Self::try_load(root, "go.mod",        30, &mut files).await,
            ProjectType::Java   => {
                Self::try_load(root, "pom.xml",        30, &mut files).await;
                Self::try_load(root, "build.gradle",   25, &mut files).await;
            }
            ProjectType::DotNet | ProjectType::Generic => {}
        }

        // Highest-priority first.
        files.sort_by(|a, b| b.priority.cmp(&a.priority));
        Ok(files)
    }

    /// Load a single file if it exists; silently skip on any error.
    async fn try_load(root: &Path, name: &str, priority: u32, files: &mut Vec<ContextFile>) {
        let path = root.join(name);
        match fs::read_to_string(&path).await {
            Ok(content) => {
                info!("Loaded context file: {}", name);
                files.push(ContextFile { name: name.to_string(), path, content, priority });
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => warn!("Could not read context file {}: {}", name, e),
        }
    }

    /// Probe for a workspace-local skill directory.
    async fn find_skill_directory(root: &Path) -> Option<PathBuf> {
        for candidate in &[
            root.join(".skilldeck").join("skills"),
            root.join(".claude").join("skills"),
        ] {
            if candidate.is_dir() {
                info!("Found workspace skill directory: {:?}", candidate);
                return Some(candidate.clone());
            }
        }
        debug!("No workspace skill directory found under {:?}", root);
        None
    }

    /// Parse `.gitignore` and return non-empty, non-comment lines.
    async fn load_gitignore(root: &Path) -> Result<Vec<String>, CoreError> {
        let path = root.join(".gitignore");
        if !path.exists() {
            return Ok(Vec::new());
        }
        let content = fs::read_to_string(&path).await?;
        let patterns = content
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .map(String::from)
            .collect();
        debug!("Loaded gitignore from {:?}", path);
        Ok(patterns)
    }

    /// Build a single string that can be prepended to the agent system prompt.
    pub fn build_context_string(ctx: &WorkspaceContext) -> String {
        let mut parts = Vec::new();
        parts.push(format!("Project type: {}\n", ctx.project_type));
        for file in &ctx.context_files {
            parts.push(format!("=== {} ===\n{}\n", file.name, file.content));
        }
        parts.join("\n")
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn load_readme_only() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("README.md"), "# Test Project").unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.context_files.len(), 1);
        assert_eq!(ctx.context_files[0].name, "README.md");
        assert!(ctx.context_files[0].content.contains("Test Project"));
    }

    #[tokio::test]
    async fn claude_md_has_higher_priority_than_readme() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("CLAUDE.md"),  "Instructions").unwrap();
        fs::write(dir.path().join("README.md"),  "Overview").unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.context_files[0].name, "CLAUDE.md");
    }

    #[tokio::test]
    async fn detect_git_repo() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert!(ctx.is_git_repo);
    }

    #[tokio::test]
    async fn not_a_git_repo() {
        let dir = TempDir::new().unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert!(!ctx.is_git_repo);
        assert!(ctx.gitignore_patterns.is_empty());
    }

    #[tokio::test]
    async fn load_gitignore_patterns() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".gitignore"), "# comment\nnode_modules\ntarget\n\n").unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert!(ctx.gitignore_patterns.contains(&"node_modules".to_string()));
        assert!(ctx.gitignore_patterns.contains(&"target".to_string()));
        // Comments and blank lines excluded.
        assert!(!ctx.gitignore_patterns.iter().any(|p| p.starts_with('#')));
    }

    #[tokio::test]
    async fn skill_directory_discovered() {
        let dir = TempDir::new().unwrap();
        let skill_dir = dir.path().join(".skilldeck").join("skills");
        fs::create_dir_all(&skill_dir).unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.skill_directory, Some(skill_dir));
    }

    #[tokio::test]
    async fn skill_directory_claude_fallback() {
        let dir = TempDir::new().unwrap();
        let skill_dir = dir.path().join(".claude").join("skills");
        fs::create_dir_all(&skill_dir).unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.skill_directory, Some(skill_dir));
    }

    #[tokio::test]
    async fn rust_project_loads_cargo_toml() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("Cargo.toml"), "[package]\nname=\"x\"").unwrap();
        let ctx = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.project_type, ProjectType::Rust);
        assert!(ctx.context_files.iter().any(|f| f.name == "Cargo.toml"));
    }

    #[test]
    fn build_context_string_contains_project_type_and_content() {
        let ctx = WorkspaceContext {
            root: PathBuf::from("/workspace"),
            project_type: ProjectType::Rust,
            context_files: vec![ContextFile {
                name: "README.md".into(),
                path: PathBuf::from("/workspace/README.md"),
                content: "# My Crate".into(),
                priority: 50,
            }],
            skill_directory: None,
            is_git_repo: false,
            gitignore_patterns: vec![],
        };
        let s = ContextLoader::build_context_string(&ctx);
        assert!(s.contains("Project type: rust"));
        assert!(s.contains("README.md"));
        assert!(s.contains("My Crate"));
    }

    #[test]
    fn build_context_string_empty_files() {
        let ctx = WorkspaceContext {
            root: PathBuf::from("/workspace"),
            project_type: ProjectType::Generic,
            context_files: vec![],
            skill_directory: None,
            is_git_repo: false,
            gitignore_patterns: vec![],
        };
        let s = ContextLoader::build_context_string(&ctx);
        assert!(s.contains("generic"));
    }
}
