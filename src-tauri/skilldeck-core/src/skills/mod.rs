//! Skill loading, resolution, and filesystem watching.

pub mod loader;
pub mod resolver;
pub mod watcher;
pub mod scanner;

pub use resolver::SkillRegistry;
