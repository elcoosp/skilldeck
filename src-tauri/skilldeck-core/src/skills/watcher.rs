//! Filesystem watcher for skill directories.
//!
//! Detects SKILL.md create / modify / delete events with a 200 ms debounce
//! window so that editor save-storms don't flood the reload pipeline.

use crate::CoreError;
use crate::traits::SkillEventEmitter;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::{Sender, channel};
use tracing::{info, warn};

/// Events emitted by the skill watcher.
#[derive(Debug, Clone)]
pub enum SkillWatchEvent {
    /// A new skill directory appeared or a SKILL.md was created inside it.
    Created(PathBuf),
    /// An existing skill was modified.
    Modified(PathBuf),
    /// A skill directory / SKILL.md was removed.
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
        // This runs in a thread spawned by notify — no tokio context.
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

    // Spawn a blocking thread that forwards raw notify events into the async channel.
    std::thread::spawn(move || {
        while let Ok(res) = raw_rx.recv() {
            if event_tx.blocking_send(res).is_err() {
                break; // receiver dropped — exit thread
            }
        }
    });

    // Improved debouncer task: aggregate events for 200 ms after the last event,
    // using a `DelayQueue` approach with a timer that resets on each new event.
    tokio::spawn(async move {
        use std::collections::HashMap;
        use tokio::time::Instant;

        let debounce = Duration::from_millis(200);
        let mut pending: Vec<Event> = Vec::new();
        let mut flush_time: Option<Instant> = None;

        loop {
            tokio::select! {
                Some(res) = event_rx.recv() => {
                    match res {
                        Ok(event) => pending.push(event),
                        Err(e) => warn!("File watcher error: {}", e),
                    }
                    // Reset the timer: flush after 200 ms of inactivity
                    flush_time = Some(Instant::now() + debounce);
                }
                _ = async {
                    if let Some(deadline) = flush_time {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending::<()>().await
                    }
                } => {
                    // Debounce period elapsed without new events — process all pending.
                    let events = std::mem::take(&mut pending);
                    flush_time = None;

                    // De-duplicate by skill directory path.
                    // Map skill_dir -> SkillWatchEvent.
                    // We merge events; Deleted takes precedence if detected.
                    let mut final_events: HashMap<PathBuf, SkillWatchEvent> = HashMap::new();

                    for event in events {
                        let kind = event.kind;
                        for path in event.paths {
                            // Determine if this path refers to SKILL.md or a directory
                            let is_skill_file = path.file_name().map(|n| n == "SKILL.md").unwrap_or(false);

                            let (skill_dir, watch_event) = if is_skill_file {
                                // Explicit SKILL.md event
                                let skill_dir = match path.parent() {
                                    Some(p) => p.to_owned(),
                                    None => continue,
                                };
                                let evt = match kind {
                                    EventKind::Create(_) => SkillWatchEvent::Created(skill_dir.clone()),
                                    EventKind::Modify(_) => SkillWatchEvent::Modified(skill_dir.clone()),
                                    EventKind::Remove(_) => SkillWatchEvent::Deleted(skill_dir.clone()),
                                    _ => continue,
                                };
                                (skill_dir, evt)
                            } else {
                                // Directory event (macOS often reports Modify on dir for file deletion)
                                // Check if the path *looks* like a directory we care about.
                                // We assume it's a skill directory candidate.
                                // Note: path.metadata() can fail if deleted, but try_exist is ok.
                                // We rely on checking the existence of SKILL.md inside.

                                let skill_dir = path.clone();
                                let skill_md = skill_dir.join("SKILL.md");

                                // Determine state: does SKILL.md exist?
                                // We use std::fs::metadata here. It blocks the async task briefly,
                                // but acceptable for low-frequency FS events.
                                let exists = skill_md.exists();

                                let evt = if exists {
                                    // Directory modified/created and SKILL.md is present
                                    match kind {
                                        EventKind::Create(_) => SkillWatchEvent::Created(skill_dir.clone()),
                                        // If modified and file exists, treat as modified.
                                        EventKind::Modify(_) => SkillWatchEvent::Modified(skill_dir.clone()),
                                        // If Remove event on directory, treat as deleted
                                        EventKind::Remove(_) => SkillWatchEvent::Deleted(skill_dir.clone()),
                                        _ => continue,
                                    }
                                } else {
                                    // SKILL.md does not exist in this directory.
                                    // If it was a Modify or Remove event on the directory,
                                    // assume the skill was deleted (or directory created but empty).
                                    // Only emit Deleted if it makes sense (e.g. Remove event).
                                    // However, on macOS, deletion of file is Modify on dir, and file is gone.
                                    match kind {
                                        EventKind::Modify(_) | EventKind::Remove(_) => {
                                            SkillWatchEvent::Deleted(skill_dir.clone())
                                        }
                                        // If Create event but no SKILL.md, ignore.
                                        _ => continue,
                                    }
                                };
                                (skill_dir, evt)
                            };

                            // Merge logic: Deleted overwrites Created/Modified.
                            match final_events.entry(skill_dir) {
                                std::collections::hash_map::Entry::Vacant(e) => {
                                    e.insert(watch_event);
                                }
                                std::collections::hash_map::Entry::Occupied(mut e) => {
                                    // If the new event is Deleted, it takes precedence.
                                    if matches!(watch_event, SkillWatchEvent::Deleted(_)) {
                                        e.insert(watch_event);
                                    }
                                    // Otherwise, keep the existing one (Created/Modified).
                                    // Or if existing is Deleted, keep Deleted.
                                }
                            }
                        }
                    }

                    // Send merged events
                    for (_, watch_event) in final_events {
                        if tx.send(watch_event).await.is_err() {
                            warn!("Skill watch event receiver dropped; stopping debouncer");
                            return;
                        }
                    }
                }
            }
        }
    });

    Ok(watcher)
}

/// Convenience: start a watcher for `dir` and drive all events directly into
/// `registry`, using `source_label` to identify which skill source is affected.
///
/// The returned watcher must be kept alive for as long as hot-reload is desired
/// (dropping it unregisters the OS watch). Typically stored in
/// `SkillRegistry::watchers`.
pub fn start_registry_watcher(
    dir: PathBuf,
    source_label: String,
    registry: Arc<super::SkillRegistry>,
    emitter: Option<Arc<dyn SkillEventEmitter>>,
) -> Result<notify::RecommendedWatcher, CoreError> {
    let (tx, mut rx) = channel::<SkillWatchEvent>(128);
    let watcher = start_watcher(dir, tx)?;

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                SkillWatchEvent::Created(skill_dir) | SkillWatchEvent::Modified(skill_dir) => {
                    let lint_config = registry.lint_config.read().await;
                    if registry
                        .load_skill_from_source(&source_label, skill_dir.clone(), &lint_config)
                        .await
                        .is_ok()
                    {
                        if let Some(ref emitter) = emitter {
                            let skill_name =
                                skill_dir.file_name().unwrap().to_string_lossy().to_string();
                            emitter.emit_updated(source_label.clone(), skill_name);
                        }
                    }
                }
                SkillWatchEvent::Deleted(skill_dir) => {
                    let skill_name = skill_dir.file_name().unwrap().to_string_lossy().to_string();
                    registry
                        .remove_skill_from_source(&source_label, &skill_name)
                        .await;
                    if let Some(ref emitter) = emitter {
                        emitter.emit_updated(source_label.clone(), skill_name);
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
        tokio::time::sleep(Duration::from_millis(500)).await;

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

    #[tokio::test]
    async fn watcher_detects_modification() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("existing-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: existing-skill\n---\ncontent",
        )
        .unwrap();

        let (tx, mut rx) = channel(32);
        let _watcher = start_watcher(tmp.path().to_owned(), tx).unwrap();

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Modify the existing SKILL.md.
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\name: existing-skill\n---\nupdated content",
        )
        .unwrap();

        let event = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;
        assert!(
            event.is_ok(),
            "Watcher did not fire on modification within 5 s"
        );
        let event = event.unwrap().unwrap();
        // Some platforms report modification as a Create event; both are acceptable for reload.
        assert!(
            matches!(
                event,
                SkillWatchEvent::Modified(_) | SkillWatchEvent::Created(_)
            ),
            "Expected Modified or Created event, got {:?}",
            event
        );
    }

    #[tokio::test]
    async fn watcher_detects_deletion() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("doomed-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: doomed-skill\n---\ncontent").unwrap();

        let (tx, mut rx) = channel(32);
        let _watcher = start_watcher(tmp.path().to_owned(), tx).unwrap();

        // Longer initial wait for watcher to settle.
        tokio::time::sleep(Duration::from_millis(1000)).await;

        // Delete the SKILL.md file.
        fs::remove_file(&skill_md).unwrap();
        // Give the OS extra time to propagate the event.
        tokio::time::sleep(Duration::from_millis(1000)).await;

        let timeout = Duration::from_secs(10);
        let start = tokio::time::Instant::now();
        let mut deleted_found = false;

        while start.elapsed() < timeout {
            match rx.try_recv() {
                Ok(event) => {
                    eprintln!("Received event: {:?}", event);
                    if let SkillWatchEvent::Deleted(p) = event {
                        // Compare canonical paths to handle /private/var vs /var.
                        let canon_p = p.canonicalize().unwrap_or(p);
                        let canon_dir = skill_dir.canonicalize().unwrap_or(skill_dir.clone());
                        if canon_p == canon_dir {
                            deleted_found = true;
                            break;
                        }
                    }
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
                Err(e) => break,
            }
        }

        assert!(deleted_found, "No Deleted event received for the directory");
    }

    #[tokio::test]
    async fn debouncer_coalesces_multiple_events() {
        let tmp = tempfile::tempdir().unwrap();
        let (tx, mut rx) = channel(32);

        let _watcher = start_watcher(tmp.path().to_owned(), tx).unwrap();
        tokio::time::sleep(Duration::from_millis(500)).await;

        let skill_dir = tmp.path().join("coalesce");
        fs::create_dir_all(&skill_dir).unwrap();

        // Generate three rapid changes
        for i in 1..=3 {
            fs::write(
                skill_dir.join("SKILL.md"),
                format!("---\nname: coalesce\n---\ncontent {}", i),
            )
            .unwrap();
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        // Wait for debouncer (200 ms) plus a little.
        tokio::time::sleep(Duration::from_millis(300)).await;

        let events: Vec<SkillWatchEvent> = std::iter::from_fn(|| rx.try_recv().ok()).collect();
        // Expect exactly one event (Created or Modified) due to deduplication
        assert_eq!(events.len(), 1);
        match &events[0] {
            SkillWatchEvent::Created(p) | SkillWatchEvent::Modified(p) => {
                // Canonicalize both paths to handle /private/var vs /var on macOS
                let canon_skill_dir = skill_dir.canonicalize().unwrap();
                let canon_event_dir = p.canonicalize().unwrap();
                assert_eq!(canon_skill_dir, canon_event_dir);
            }
            _ => panic!("unexpected event type"),
        }
    }
}
