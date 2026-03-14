//! Skill system: loading, resolution, scanning, and hot reload.

pub mod loader;
pub mod resolver;
pub mod scanner;
pub mod watcher;

use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::debug;

use crate::traits::Skill;
use crate::{CoreError, SkillLoader};
use resolver::ResolvedSkills;

/// Registry holding all loaded and resolved skills.
pub struct SkillRegistry {
    /// Raw skills loaded from each source, keyed by source name.
    raw_skills: DashMap<String, Vec<Skill>>,
    /// Resolved skills after applying priority rules.
    resolved: Arc<RwLock<ResolvedSkills>>,
    /// Map of source directory paths to their watchers (for cleanup).
    pub watchers: DashMap<PathBuf, notify::RecommendedWatcher>,
}

impl Default for SkillRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SkillRegistry {
    /// Creates a new empty skill registry.
    pub fn new() -> Self {
        Self {
            raw_skills: DashMap::new(),
            resolved: Arc::new(RwLock::new(ResolvedSkills {
                skills: Vec::new(),
                shadowed: Vec::new(),
            })),
            watchers: DashMap::new(),
        }
    }

    /// Registers a source and its raw skills, then re-resolves all skills.
    pub async fn register_source(&self, source: String, skills: Vec<Skill>) {
        // ← now async
        self.raw_skills.insert(source, skills);
        let _ = self.reload().await;
    }

    /// Loads a skill from a source directory (e.g., after a file watch event).
    /// This updates the raw skills for that source and triggers re‑resolution.
    pub async fn load_skill_from_source(
        &self,
        source: &str,
        skill_dir: PathBuf,
    ) -> Result<(), CoreError> {
        let loader = loader::FilesystemSkillLoader;
        let skill = loader
            .load(&crate::traits::SkillSource::Filesystem(skill_dir))
            .await?;

        if let Some(mut entry) = self.raw_skills.get_mut(source) {
            // Replace or append? For simplicity, we replace any existing skill with same name.
            let skills = entry.value_mut();
            if let Some(existing) = skills.iter_mut().find(|s| s.name == skill.name) {
                *existing = skill;
            } else {
                skills.push(skill);
            }
        } else {
            self.raw_skills.insert(source.to_string(), vec![skill]);
        }

        self.reload().await?;
        Ok(())
    }

    /// Removes a skill from a source (e.g., after a delete event) and re‑resolves.
    pub async fn remove_skill_from_source(&self, source: &str, skill_name: &str) {
        // ← now async
        if let Some(mut entry) = self.raw_skills.get_mut(source) {
            entry.retain(|s| s.name != skill_name);
            let _ = self.reload().await;
        }
    }

    /// Re‑resolves all skills from all sources.
    async fn reload(&self) -> Result<(), CoreError> {
        let sources: Vec<(String, Vec<Skill>)> = self
            .raw_skills
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect();

        let resolved = resolver::resolve(sources);
        let mut guard = self.resolved.write().await; // ← was blocking_write()
        *guard = resolved;

        debug!(
            "Skills reloaded: {} active, {} shadowed",
            guard.skills.len(),
            guard.shadowed.len()
        );
        Ok(())
    }

    /// Returns all currently resolved skills.
    pub async fn skills(&self) -> Vec<Skill> {
        self.resolved.read().await.skills.clone()
    }

    /// Returns all skills, including shadowed ones, for debugging.
    pub async fn all_raw_skills(&self) -> Vec<(String, Vec<Skill>)> {
        self.raw_skills
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect()
    }

    /// Returns a specific skill by name if it exists in the resolved set.
    pub async fn get_skill(&self, name: &str) -> Option<Skill> {
        let guard = self.resolved.read().await;
        guard.skills.iter().find(|s| s.name == name).cloned()
    }

    /// Enables or disables a skill by setting its `is_active` flag.
    pub async fn set_enabled(&self, name: &str, enabled: bool) -> Result<(), CoreError> {
        let mut guard = self.resolved.write().await;
        if let Some(skill) = guard.skills.iter_mut().find(|s| s.name == name) {
            skill.is_active = enabled;
            Ok(())
        } else {
            Err(CoreError::SkillNotInRegistry {
                name: name.to_string(),
            })
        }
    }
}
