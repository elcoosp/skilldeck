//! Workspace detection — identifies the project type in a directory by
//! examining characteristic files.

use std::path::Path;
use tracing::{debug, info};

// ── ProjectType ───────────────────────────────────────────────────────────────

/// Detected project ecosystem.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectType {
    Rust,
    Node,
    Python,
    Go,
    Java,
    DotNet,
    Generic,
}

impl std::fmt::Display for ProjectType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Rust => "rust",
            Self::Node => "node",
            Self::Python => "python",
            Self::Go => "go",
            Self::Java => "java",
            Self::DotNet => "dotnet",
            Self::Generic => "generic",
        };
        write!(f, "{}", s)
    }
}

// ── WorkspaceDetector ────────────────────────────────────────────────────────

pub struct WorkspaceDetector;

impl WorkspaceDetector {
    /// Detect the project type for the directory at `path`.
    ///
    /// Detection is in priority order: the first match wins.
    pub async fn detect<P: AsRef<Path>>(path: P) -> ProjectType {
        let p = path.as_ref();

        if p.join("Cargo.toml").exists() {
            info!("Detected Rust project at {:?}", p);
            return ProjectType::Rust;
        }

        if p.join("package.json").exists() {
            info!("Detected Node.js project at {:?}", p);
            return ProjectType::Node;
        }

        if p.join("pyproject.toml").exists()
            || p.join("setup.py").exists()
            || p.join("requirements.txt").exists()
        {
            info!("Detected Python project at {:?}", p);
            return ProjectType::Python;
        }

        if p.join("go.mod").exists() {
            info!("Detected Go project at {:?}", p);
            return ProjectType::Go;
        }

        if p.join("pom.xml").exists()
            || p.join("build.gradle").exists()
            || p.join("build.gradle.kts").exists()
        {
            info!("Detected Java/JVM project at {:?}", p);
            return ProjectType::Java;
        }

        // .NET: scan directory entries for *.csproj / *.fsproj / *.vbproj
        // (Path::join with a glob pattern never matches — use read_dir instead.)
        if has_dotnet_project_file(p) {
            info!("Detected .NET project at {:?}", p);
            return ProjectType::DotNet;
        }

        debug!(
            "No specific project type detected at {:?}, falling back to Generic",
            p
        );
        ProjectType::Generic
    }

    /// Skill names that are recommended for a given project type.
    pub fn recommended_skills(project_type: ProjectType) -> Vec<&'static str> {
        match project_type {
            ProjectType::Rust => vec!["rust-best-practices", "cargo-expert"],
            ProjectType::Node => vec!["nodejs-patterns", "npm-expert"],
            ProjectType::Python => vec!["python-best-practices", "pytest-expert"],
            ProjectType::Go => vec!["go-best-practices", "go-modules"],
            ProjectType::Java => vec!["java-patterns", "maven-expert"],
            ProjectType::DotNet => vec!["dotnet-patterns", "nuget-expert"],
            ProjectType::Generic => vec![],
        }
    }

    /// Context files that are worth loading for a given project type.
    ///
    /// Returns them in decreasing priority order (most important first).
    pub fn context_files(project_type: ProjectType) -> Vec<&'static str> {
        let mut files = vec!["CLAUDE.md", "README.md", ".gitignore"];
        match project_type {
            ProjectType::Rust => files.extend_from_slice(&["Cargo.toml", "Cargo.lock"]),
            ProjectType::Node => files.extend_from_slice(&["package.json", "tsconfig.json"]),
            ProjectType::Python => files.extend_from_slice(&["pyproject.toml", "requirements.txt"]),
            ProjectType::Go => files.push("go.mod"),
            ProjectType::Java => files.extend_from_slice(&["pom.xml", "build.gradle"]),
            ProjectType::DotNet => files.push("*.csproj"), // documentation only
            ProjectType::Generic => {}
        }
        files
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Return `true` if any entry in `dir` has a `.csproj`, `.fsproj`, or
/// `.vbproj` extension.
fn has_dotnet_project_file(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let path = entry.path();
        matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("csproj" | "fsproj" | "vbproj")
        )
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn display() {
        assert_eq!(ProjectType::Rust.to_string(), "rust");
        assert_eq!(ProjectType::Node.to_string(), "node");
        assert_eq!(ProjectType::Python.to_string(), "python");
        assert_eq!(ProjectType::Go.to_string(), "go");
        assert_eq!(ProjectType::Java.to_string(), "java");
        assert_eq!(ProjectType::DotNet.to_string(), "dotnet");
        assert_eq!(ProjectType::Generic.to_string(), "generic");
    }

    #[tokio::test]
    async fn detect_rust() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("Cargo.toml"), "[package]\nname=\"t\"").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Rust
        );
    }

    #[tokio::test]
    async fn detect_node() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("package.json"), "{}").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Node
        );
    }

    #[tokio::test]
    async fn detect_python_pyproject() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("pyproject.toml"), "[project]").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Python
        );
    }

    #[tokio::test]
    async fn detect_python_requirements() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("requirements.txt"), "requests").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Python
        );
    }

    #[tokio::test]
    async fn detect_go() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("go.mod"), "module example.com/foo").unwrap();
        assert_eq!(WorkspaceDetector::detect(dir.path()).await, ProjectType::Go);
    }

    #[tokio::test]
    async fn detect_java_maven() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("pom.xml"), "<project/>").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Java
        );
    }

    #[tokio::test]
    async fn detect_dotnet_csproj() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("MyApp.csproj"), "<Project/>").unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::DotNet
        );
    }

    #[tokio::test]
    async fn detect_generic_empty() {
        let dir = TempDir::new().unwrap();
        assert_eq!(
            WorkspaceDetector::detect(dir.path()).await,
            ProjectType::Generic
        );
    }

    #[test]
    fn recommended_skills_non_empty_for_known_types() {
        for pt in [
            ProjectType::Rust,
            ProjectType::Node,
            ProjectType::Python,
            ProjectType::Go,
            ProjectType::Java,
            ProjectType::DotNet,
        ] {
            assert!(
                !WorkspaceDetector::recommended_skills(pt).is_empty(),
                "{:?} should have recommended skills",
                pt
            );
        }
        assert!(WorkspaceDetector::recommended_skills(ProjectType::Generic).is_empty());
    }

    #[test]
    fn context_files_always_includes_readme() {
        for pt in [
            ProjectType::Rust,
            ProjectType::Node,
            ProjectType::Python,
            ProjectType::Go,
            ProjectType::Java,
            ProjectType::DotNet,
            ProjectType::Generic,
        ] {
            let files = WorkspaceDetector::context_files(pt);
            assert!(files.contains(&"README.md"), "{:?} missing README.md", pt);
        }
    }

    #[test]
    fn context_files_rust_includes_cargo() {
        assert!(WorkspaceDetector::context_files(ProjectType::Rust).contains(&"Cargo.toml"));
    }
}
