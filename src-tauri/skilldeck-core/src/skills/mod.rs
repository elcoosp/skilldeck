//! Skill system: loading, scanning, resolving, and watching.

pub mod loader;
pub mod resolver;
pub mod scanner;
pub mod watcher;

pub use loader::FilesystemSkillLoader;
pub use resolver::{ResolvedSkills, ShadowedSkill, resolve};
pub use scanner::{scan_directories, scan_directory};
pub use watcher::{SkillWatchEvent, start_watcher};

// Temporary stub – replace with real implementation later
pub struct SkillRegistry;

impl Default for SkillRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SkillRegistry {
    pub fn new() -> Self {
        Self
    }
}
