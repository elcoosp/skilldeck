//! Skill resolution with priority ordering.
//!
//! When the same skill name appears in multiple source directories, the
//! highest-priority source wins: workspace > personal > superpowers > marketplace.

use crate::traits::Skill;
use std::collections::HashMap;

/// Source priority — lower index = higher priority.
const SOURCE_PRIORITY: &[&str] = &["workspace", "personal", "superpowers", "marketplace"];

fn priority_of(source: &str) -> usize {
    SOURCE_PRIORITY
        .iter()
        .position(|&s| s == source)
        .unwrap_or(usize::MAX)
}

/// Result of resolving skills from multiple sources.
#[derive(Debug)]
pub struct ResolvedSkills {
    /// De-duplicated skills (one per name, highest-priority source wins).
    pub skills: Vec<Skill>,
    /// Skills that lost a name conflict.
    pub shadowed: Vec<ShadowedSkill>,
}

/// A skill that was shadowed by a higher-priority source.
#[derive(Debug)]
pub struct ShadowedSkill {
    pub name: String,
    pub source: String,
    pub shadowed_by: String,
}

/// Resolve skill name conflicts using source priority.
///
/// `sources` is a list of `(source_label, skills)` pairs.  Order within the
/// vec does not matter — priority is determined by `SOURCE_PRIORITY`.
pub fn resolve(sources: Vec<(String, Vec<Skill>)>) -> ResolvedSkills {
    // Map: skill_name -> (skill, source_label, priority)
    let mut by_name: HashMap<String, (Skill, String, usize)> = HashMap::new();
    let mut shadowed: Vec<ShadowedSkill> = Vec::new();

    // Sort inputs so higher-priority sources are processed first (optional,
    // but makes the conflict logic below slightly simpler to reason about).
    let mut sorted = sources;
    sorted.sort_by_key(|(label, _)| priority_of(label));

    for (source_label, skills) in sorted {
        let p = priority_of(&source_label);
        for skill in skills {
            match by_name.get(&skill.name) {
                Some((_, existing_label, existing_p)) => {
                    if p < *existing_p {
                        // New skill has higher priority — replace the winner.
                        shadowed.push(ShadowedSkill {
                            name: skill.name.clone(),
                            source: existing_label.clone(),
                            shadowed_by: source_label.clone(),
                        });
                        by_name.insert(skill.name.clone(), (skill, source_label.clone(), p));
                    } else {
                        // Existing skill has higher or equal priority — new one loses.
                        shadowed.push(ShadowedSkill {
                            name: skill.name.clone(),
                            source: source_label.clone(),
                            shadowed_by: existing_label.clone(),
                        });
                    }
                }
                None => {
                    by_name.insert(skill.name.clone(), (skill, source_label.clone(), p));
                }
            }
        }
    }

    let skills = by_name.into_values().map(|(s, _, _)| s).collect();
    ResolvedSkills { skills, shadowed }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn make(name: &str, source: &str) -> Skill {
        Skill {
            name: name.into(),
            is_active: true,
            description: "test".into(),
            content_md: "content".into(),
            manifest: Default::default(),
            disk_path: Some(PathBuf::new()),
            source: source.into(),
            content_hash: None,
        }
    }

    #[test]
    fn single_source_no_conflict() {
        let r = resolve(vec![("workspace".into(), vec![make("fmt", "workspace")])]);
        assert_eq!(r.skills.len(), 1);
        assert!(r.shadowed.is_empty());
    }

    #[test]
    fn workspace_overrides_personal() {
        let r = resolve(vec![
            ("personal".into(), vec![make("fmt", "personal")]),
            ("workspace".into(), vec![make("fmt", "workspace")]),
        ]);
        assert_eq!(r.skills.len(), 1);
        assert_eq!(r.skills[0].source, "workspace");
        assert_eq!(r.shadowed.len(), 1);
        assert_eq!(r.shadowed[0].source, "personal");
        assert_eq!(r.shadowed[0].shadowed_by, "workspace");
    }

    #[test]
    fn multiple_skills_no_conflict() {
        let r = resolve(vec![
            ("workspace".into(), vec![make("ws-skill", "workspace")]),
            ("personal".into(), vec![make("personal-skill", "personal")]),
        ]);
        assert_eq!(r.skills.len(), 2);
        assert!(r.shadowed.is_empty());
    }

    #[test]
    fn full_priority_stack() {
        let r = resolve(vec![
            ("marketplace".into(), vec![make("test", "marketplace")]),
            ("superpowers".into(), vec![make("test", "superpowers")]),
            ("personal".into(), vec![make("test", "personal")]),
            ("workspace".into(), vec![make("test", "workspace")]),
        ]);
        assert_eq!(r.skills.len(), 1);
        assert_eq!(r.skills[0].source, "workspace");
        assert_eq!(r.shadowed.len(), 3);
    }

    #[test]
    fn unknown_source_gets_lowest_priority() {
        let r = resolve(vec![
            ("personal".into(), vec![make("test", "personal")]),
            ("custom-src".into(), vec![make("test", "custom-src")]),
        ]);
        assert_eq!(r.skills.len(), 1);
        assert_eq!(r.skills[0].source, "personal");
    }
}
