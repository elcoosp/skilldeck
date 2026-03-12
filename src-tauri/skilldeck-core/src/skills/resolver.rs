//! Skill resolver — stub for Chunk 5.

use dashmap::DashMap;
use crate::traits::Skill;

/// In-memory registry of loaded skills, keyed by skill name.
///
/// When multiple skills share the same name, the highest-priority source wins
/// (Workspace > User > Builtin).
pub struct SkillRegistry {
    skills: DashMap<String, Skill>,
}

impl SkillRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self {
            skills: DashMap::new(),
        }
    }

    /// Insert or replace a skill in the registry.
    pub fn upsert(&self, skill: Skill) {
        self.skills.insert(skill.metadata.name.clone(), skill);
    }

    /// Look up a skill by name.
    pub fn get(&self, name: &str) -> Option<Skill> {
        self.skills.get(name).map(|r| r.clone())
    }

    /// Return all registered skills.
    pub fn all(&self) -> Vec<Skill> {
        self.skills.iter().map(|e| e.value().clone()).collect()
    }

    /// Number of registered skills.
    pub fn len(&self) -> usize {
        self.skills.len()
    }

    /// True if no skills are registered.
    pub fn is_empty(&self) -> bool {
        self.skills.is_empty()
    }
}

impl Default for SkillRegistry {
    fn default() -> Self {
        Self::new()
    }
}
