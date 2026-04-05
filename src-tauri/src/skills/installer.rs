//! Skill installation logic — copy a skill from a registry source to local storage.
//!
//! Installing is a "copy" operation (not a live link), ensuring local stability
//! regardless of registry changes.

use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::PathBuf;
use tracing::info;

/// Target location for installing a skill.
#[derive(Debug, Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum InstallTarget {
    /// `~/.agents/skills/<name>/`
    Personal,
    /// `./.skilldeck/skills/<name>/` relative to cwd
    Workspace,
}

/// Result returned after a successful installation.
#[derive(Debug, Clone, Serialize, Type)]
pub struct InstallResult {
    pub skill_name: String,
    pub installed_path: String,
    pub target: InstallTarget,
}

/// Install a skill from the given source directory into the chosen target.
///
/// Fails if the skill already exists at the target. Use `update_skill` to
/// overwrite.
pub fn install_skill(
    skill_name: &str,
    skill_content: &str,
    target: &InstallTarget,
) -> Result<InstallResult> {
    let target_dir = resolve_target_dir(target)?;
    let dest_path = target_dir.join(skill_name);

    if dest_path.exists() {
        bail!(
            "Skill '{}' already exists at '{}'. Use update to overwrite.",
            skill_name,
            dest_path.display()
        );
    }

    fs::create_dir_all(&dest_path)?;

    // Write to a temporary file first, then atomically rename to prevent
    // partial writes from leaving corrupt skill files on disk.
    let skill_file = dest_path.join("SKILL.md");
    let tmp_path = skill_file.with_extension("tmp");
    fs::write(&tmp_path, skill_content)?;
    fs::rename(&tmp_path, &skill_file)?;

    info!(
        "Installed skill '{}' to '{}'",
        skill_name,
        dest_path.display()
    );

    Ok(InstallResult {
        skill_name: skill_name.to_string(),
        installed_path: dest_path.to_string_lossy().into_owned(),
        target: target.clone(),
    })
}

/// Remove an installed skill directory.
pub fn uninstall_skill(skill_name: &str, target: &InstallTarget) -> Result<()> {
    let target_dir = resolve_target_dir(target)?;
    let dest_path = target_dir.join(skill_name);

    if !dest_path.exists() {
        bail!("Skill '{}' is not installed at {:?}", skill_name, target);
    }

    fs::remove_dir_all(&dest_path)?;
    info!("Uninstalled skill '{}'", skill_name);
    Ok(())
}

#[allow(dead_code)]
/// Overwrite an existing skill with new content.
pub fn update_skill(
    skill_name: &str,
    new_content: &str,
    target: &InstallTarget,
) -> Result<InstallResult> {
    let target_dir = resolve_target_dir(target)?;
    let dest_path = target_dir.join(skill_name);

    fs::create_dir_all(&dest_path)?;

    // Atomic write: temp file then rename.
    let skill_file = dest_path.join("SKILL.md");
    let tmp_path = skill_file.with_extension("tmp");
    fs::write(&tmp_path, new_content)?;
    fs::rename(&tmp_path, &skill_file)?;

    info!(
        "Updated skill '{}' at '{}'",
        skill_name,
        dest_path.display()
    );

    Ok(InstallResult {
        skill_name: skill_name.to_string(),
        installed_path: dest_path.to_string_lossy().into_owned(),
        target: target.clone(),
    })
}

/// Read the current content of a locally installed skill.
pub fn read_local_skill(skill_name: &str, target: &InstallTarget) -> Result<String> {
    let target_dir = resolve_target_dir(target)?;
    let skill_md = target_dir.join(skill_name).join("SKILL.md");
    Ok(fs::read_to_string(skill_md)?)
}

/// Resolve the target directory for a given install target.
pub fn resolve_target_dir(target: &InstallTarget) -> Result<PathBuf> {
    match target {
        InstallTarget::Personal => {
            let home = dirs_next::home_dir()
                .ok_or_else(|| anyhow::anyhow!("Cannot determine home directory"))?;
            Ok(home.join(".agents").join("skills"))
        }
        InstallTarget::Workspace => Ok(std::env::current_dir()?.join(".skilldeck").join("skills")),
    }
}
