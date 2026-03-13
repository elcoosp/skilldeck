//! Filesystem watcher for skill directories.
//!
//! Detects SKILL.md create / modify / delete events with a 200 ms debounce
//! window so that editor save-storms don't flood the reload pipeline.

use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::mpsc::{Sender, channel};
use tracing::{info, warn};

use crate::CoreError;

/// Events emitted by the skill watcher.
#[derive(Debug, Clone)]
pub enum SkillWatchEvent {
    /// A new skill directory appeared.
    Created(PathBuf),
    /// An existing skill was modified.
    Modified(PathBuf),
    /// A skill directory was removed.
    Deleted(PathBuf),
}

/// Start watching `dir` recursively.
///
/// Returns the [`notify::RecommendedWatcher`] (keep it alive — dropping it stops the watcher).
/// Events are debounced for 200 ms and then sent on `tx`.
pub fn start_watcher(
    dir: PathBuf,
    tx: Sender<SkillWatchEvent>,
) -> Result<notify::RecommendedWatcher, CoreError> {
    // Sync channel between notify callback and a forwarding thread.
    let (raw_tx, raw_rx) = std::sync::mpsc::channel();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        // This runs in a thread spawned by notify – no tokio context.
        let _ = raw_tx.send(res); // Ignore error if receiver is gone.
    })
    .map_err(|e| CoreError::Internal {
        message: format!("Failed to create file watcher: {}", e),
    })?;

    watcher
        .watch(&dir, RecursiveMode::Recursive)
        .map_err(|e| CoreError::FileOperation {
            path: dir.clone(),
            message: format!("Failed to start watcher on {:?}: {}", dir, e),
        })?;

    info!("Started skill watcher for {:?}", dir);

    // Async channel for the debouncer task.
    let (event_tx, mut event_rx) = channel(128);

    // Spawn a blocking thread that forwards raw events to the async channel.
    std::thread::spawn(move || {
        while let Ok(res) = raw_rx.recv() {
            if event_tx.blocking_send(res).is_err() {
                break; // receiver dropped, exit thread.
            }
        }
    });

    // Debouncer task: aggregate events for 200 ms.
    tokio::spawn(async move {
        let mut pending: Vec<Event> = Vec::new();
        let mut debounce_timer: Option<tokio::time::Instant> = None;

        loop {
            tokio::select! {
                Some(res) = event_rx.recv() => {
                    match res {
                        Ok(event) => pending.push(event),
                        Err(e) => warn!("File watcher error: {}", e),
                    }
                    if debounce_timer.is_none() {
                        debounce_timer = Some(tokio::time::Instant::now() + Duration::from_millis(200));
                    }
                }
                _ = async {
                    if let Some(deadline) = debounce_timer {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending().await
                    }
                } => {
                    // Debounce period elapsed: process all pending events.
                    let events = std::mem::take(&mut pending);
                    debounce_timer = None;

                    for event in events {
                        for path in event.paths {
                            if path.file_name().map(|n| n == "SKILL.md").unwrap_or(false) {
                                let skill_dir = match path.parent() {
                                    Some(p) => p.to_owned(),
                                    None => continue,
                                };

                                let watch_event = match event.kind {
                                    EventKind::Create(_) => SkillWatchEvent::Created(skill_dir),
                                    EventKind::Modify(_) => SkillWatchEvent::Modified(skill_dir),
                                    EventKind::Remove(_) => SkillWatchEvent::Deleted(skill_dir),
                                    _ => continue,
                                };

                                if tx.send(watch_event).await.is_err() {
                                    warn!("Skill watch event receiver dropped; stopping debouncer");
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tokio::sync::mpsc::channel;

    #[tokio::test]
    async fn watcher_detects_new_skill() {
        let tmp = tempfile::tempdir().unwrap();
        let (tx, mut rx) = channel(32);

        let _watcher = start_watcher(tmp.path().to_owned(), tx).unwrap();

        // Let the watcher initialise.
        tokio::time::sleep(Duration::from_millis(250)).await;

        let skill_dir = tmp.path().join("new-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: new-skill\n---\ncontent",
        )
        .unwrap();

        let event = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;
        assert!(event.is_ok(), "Watcher did not fire within 5 s");
    }

    #[tokio::test]
    async fn watcher_on_bad_path_returns_err() {
        let (tx, _rx) = channel(32);
        let result = start_watcher(PathBuf::from("/this/does/not/exist"), tx);
        assert!(result.is_err());
    }
}
