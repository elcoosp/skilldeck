//! Filesystem watcher for skill directories.
//!
//! Detects skill file changes with 200ms debouncing.

use notify::{EventKind, RecursiveMode, Watcher as NotifyWatcher};
use notify_debouncer_mini::{DebouncedEvent, new_debouncer};
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::mpsc::Sender;
use tracing::{info, warn};

use crate::CoreError;

/// Events emitted by the skill watcher.
#[derive(Debug, Clone)]
pub enum SkillWatchEvent {
    /// A skill was created.
    Created(PathBuf),
    /// A skill was modified.
    Modified(PathBuf),
    /// A skill was deleted.
    Deleted(PathBuf),
}

/// Start watching a skill directory.
pub fn start_watcher(
    dir: PathBuf,
    tx: Sender<SkillWatchEvent>,
) -> Result<impl NotifyWatcher, CoreError> {
    let (debounce_tx, debounce_rx) = std::sync::mpsc::channel();

    let mut debouncer =
        new_debouncer(Duration::from_millis(200), None, debounce_tx).map_err(|e| {
            CoreError::Internal {
                message: format!("Failed to create debouncer: {}", e),
            }
        })?;

    debouncer
        .watcher()
        .watch(&dir, RecursiveMode::Recursive)
        .map_err(|e| CoreError::FileOperation {
            path: dir.clone(),
            message: format!("Failed to start watcher: {}", e),
        })?;

    info!("Started skill watcher for {:?}", dir);

    // Spawn a blocking task to receive events from the debouncer and forward them to the tokio channel.
    tokio::task::spawn_blocking(move || {
        while let Ok(result) = debounce_rx.recv() {
            if let Ok(events) = result {
                for DebouncedEvent { path, kind } in events {
                    // Only watch SKILL.md files
                    if path.file_name().map(|n| n == "SKILL.md").unwrap_or(false) {
                        // Get the skill directory (parent of SKILL.md)
                        if let Some(skill_dir) = path.parent() {
                            let event = match kind {
                                notify::EventKind::Create(_) => {
                                    SkillWatchEvent::Created(skill_dir.to_owned())
                                }
                                notify::EventKind::Modify(_) => {
                                    SkillWatchEvent::Modified(skill_dir.to_owned())
                                }
                                notify::EventKind::Remove(_) => {
                                    SkillWatchEvent::Deleted(skill_dir.to_owned())
                                }
                                _ => continue,
                            };

                            if tx.blocking_send(event).is_err() {
                                warn!("Failed to send skill watch event");
                                return;
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(debouncer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Duration;
    use tokio::time::timeout;

    #[tokio::test]
    async fn watcher_detects_new_skill() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, mut rx) = tokio::sync::mpsc::channel(32);
        let _watcher = start_watcher(dir.path().to_owned(), tx).unwrap();

        // Give watcher time to initialize
        tokio::time::sleep(Duration::from_millis(250)).await;

        // Create a skill
        let skill_dir = dir.path().join("new-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: new-skill\n---\ncontent",
        )
        .unwrap();

        // Wait for event
        let event = timeout(Duration::from_secs(3), rx.recv()).await;
        assert!(event.is_ok(), "Watcher did not fire within 3 seconds");
    }
}
