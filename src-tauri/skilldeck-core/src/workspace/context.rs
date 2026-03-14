//! Workspace context loading.
//!
//! Loads context files (CLAUDE.md, README, etc.) for AI context.

use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

use super::detector::ProjectType;
use crate::CoreError;

/// Loaded workspace context.
#[derive(Debug, Clone)]
pub struct WorkspaceContext {
    /// Workspace root path.
    pub root: PathBuf,
    /// Project type.
    pub project_type: ProjectType,
    /// Loaded context files.
    pub context_files: Vec<ContextFile>,
    /// Skill directories path.
    pub skill_directories: Vec<(String, PathBuf)>,
    /// Whether this is a git repository.
    pub is_git_repo: bool,
    /// Gitignore patterns.
    pub gitignore_patterns: Vec<String>,
}

/// A loaded context file.
#[derive(Debug, Clone)]
pub struct ContextFile {
    pub name: String,
    pub path: PathBuf,
    pub content: String,
    pub priority: u32,
}

/// Context loader.
pub struct ContextLoader;

impl ContextLoader {
    /// Load workspace context from a directory.
    pub async fn load<P: AsRef<Path>>(root: P) -> Result<WorkspaceContext, CoreError> {
        let root = root.as_ref().to_path_buf();

        // Detect project type
        let project_type = super::detector::WorkspaceDetector::detect(&root).await;

        info!("Loading context for {:?} ({})", root, project_type);

        // Load context files
        let context_files = Self::load_context_files(&root, project_type).await?;

        // Check for skill directory (workspace-local first, then global ~/.agents/skills)
        let skill_directories = Self::find_skill_directories(&root).await;

        // Check for git
        let is_git_repo = root.join(".git").exists();

        // Load gitignore
        let gitignore_patterns = if is_git_repo {
            Self::load_gitignore(&root).await.unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(WorkspaceContext {
            root,
            project_type,
            context_files,
            skill_directories,
            is_git_repo,
            gitignore_patterns,
        })
    }

    async fn load_context_files(
        root: &Path,
        project_type: ProjectType,
    ) -> Result<Vec<ContextFile>, CoreError> {
        let mut files = Vec::new();

        // Priority order for context files
        let context_specs = vec![("CLAUDE.md", 100), ("README.md", 50), ("README", 40)];

        for (name, priority) in context_specs {
            let path = root.join(name);
            if path.exists() {
                match fs::read_to_string(&path).await {
                    Ok(content) => {
                        info!("Loaded context file: {}", name);
                        files.push(ContextFile {
                            name: name.to_string(),
                            path: path.clone(),
                            content,
                            priority,
                        });
                    }
                    Err(e) => {
                        warn!("Failed to read {}: {}", name, e);
                    }
                }
            }
        }

        // Project-specific files
        match project_type {
            ProjectType::Rust => {
                Self::try_load(root, "Cargo.toml", 30, &mut files).await;
            }
            ProjectType::Node => {
                Self::try_load(root, "package.json", 30, &mut files).await;
            }
            ProjectType::Python => {
                Self::try_load(root, "pyproject.toml", 30, &mut files).await;
            }
            _ => {}
        }

        // Sort by priority (highest first)
        files.sort_by(|a, b| b.priority.cmp(&a.priority));

        Ok(files)
    }

    async fn try_load(root: &Path, name: &str, priority: u32, files: &mut Vec<ContextFile>) {
        let path = root.join(name);
        if let Ok(content) = fs::read_to_string(&path).await {
            files.push(ContextFile {
                name: name.to_string(),
                path,
                content,
                priority,
            });
        }
    }

    /// Locate a skills directory.
    ///
    /// Search order:
    /// 1. Workspace-local `.skilldeck/skills/`
    /// 2. Workspace-local `.claude/skills/`
    /// 3. Global `~/.agents/skills/`
    /// Returns all discovered skill directories with their source labels,
    /// in priority order: workspace-local first, then global.
    async fn find_skill_directories(root: &Path) -> Vec<(String, PathBuf)> {
        let mut found = Vec::new();

        let local_candidates = [
            ("workspace", root.join(".skilldeck").join("skills")),
            ("workspace", root.join(".claude").join("skills")),
        ];
        for (label, candidate) in &local_candidates {
            if candidate.exists() && candidate.is_dir() {
                info!("Found workspace skill directory: {:?}", candidate);
                found.push((label.to_string(), candidate.clone()));
                break; // only need one local source
            }
        }

        if let Some(home) = dirs_next::home_dir() {
            let global = home.join(".agents").join("skills");
            if global.exists() && global.is_dir() {
                info!("Found global skill directory: {:?}", global);
                found.push(("personal".to_string(), global));
            }
        }

        if found.is_empty() {
            debug!("No skill directory found");
        }
        found
    }

    async fn load_gitignore(root: &Path) -> Result<Vec<String>, CoreError> {
        let gitignore_path = root.join(".gitignore");
        if !gitignore_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&gitignore_path).await?;

        let patterns: Vec<String> = content
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .map(String::from)
            .collect();

        debug!("Loaded {} gitignore patterns", patterns.len());
        Ok(patterns)
    }

    /// Build context string for AI.
    pub fn build_context_string(context: &WorkspaceContext) -> String {
        let mut parts = Vec::new();

        // Add project type info
        parts.push(format!("Project type: {}\n", context.project_type));

        // Add context files
        for file in &context.context_files {
            parts.push(format!("=== {} ===\n{}\n", file.name, file.content));
        }

        parts.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn load_readme_only() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("README.md"), "# Test Project").unwrap();
        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
        assert_eq!(ctx.context_files.len(), 1);
        assert_eq!(ctx.context_files[0].name, "README.md");
    }

    #[tokio::test]
    async fn detect_git() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();

        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
        assert!(ctx.is_git_repo);
    }

    #[tokio::test]
    async fn load_gitignore() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".gitignore"), "node_modules\ntarget\n").unwrap();

        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
        assert!(ctx.gitignore_patterns.contains(&"node_modules".to_string()));
        assert!(
            !ctx.gitignore_patterns
                .iter()
                .any(|p: &String| p.starts_with('#'))
        );
    }

    #[tokio::test]
    async fn skill_directory_discovered() {
        let dir = TempDir::new().unwrap();
        let skill_dir = dir.path().join(".skilldeck").join("skills");
        fs::create_dir_all(&skill_dir).unwrap();

        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
        assert!(
            ctx.skill_directories
                .contains(&("workspace".to_string(), skill_dir))
        );
    }
    #[tokio::test]
    async fn skill_directory_claude_fallback() {
        let dir = TempDir::new().unwrap();
        let skill_dir = dir.path().join(".claude").join("skills");
        fs::create_dir_all(&skill_dir).unwrap();

        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
        assert!(
            ctx.skill_directories
                .contains(&("workspace".to_string(), skill_dir))
        );
    }
    #[tokio::test]
    async fn rust_project_loads_cargo_toml() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("Cargo.toml"), "[package]\nname = \"test\"").unwrap();

        let ctx: WorkspaceContext = ContextLoader::load(dir.path()).await.unwrap();
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
            skill_directories: vec![],
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
            skill_directories: vec![],
            is_git_repo: false,
            gitignore_patterns: vec![],
        };
        let s = ContextLoader::build_context_string(&ctx);
        assert!(s.contains("generic"));
    }
}
