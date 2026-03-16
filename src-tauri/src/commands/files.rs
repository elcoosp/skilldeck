// src-tauri/src/commands/files.rs
//! File-system browsing commands for the Chat Context Injection feature.
//!
//! Provides directory listing and file-count commands consumed by the
//! `FileMentionPicker` and `FolderScopeModal` frontend components.

use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

/// A single file or directory entry returned by `list_directory_contents`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

/// Shallow vs deep file counts for a folder, used by `FolderScopeModal`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FolderCounts {
    pub shallow: usize,
    pub deep: usize,
}

/// List the contents of a directory, including a `..` parent entry.
///
/// Hidden files, `node_modules`, and `target` are excluded.
/// I/O is offloaded to a blocking thread to avoid stalling the async runtime.
#[specta]
#[tauri::command]
pub async fn list_directory_contents(path: String) -> Result<Vec<FileEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let dir_path = PathBuf::from(&path);

        if !dir_path.exists() || !dir_path.is_dir() {
            return Err(format!("'{}' is not a valid directory", path));
        }

        let mut entries: Vec<FileEntry> = Vec::new();

        // Parent directory navigation entry
        if let Some(parent) = dir_path.parent() {
            entries.push(FileEntry {
                name: "..".to_string(),
                path: parent.to_string_lossy().to_string(),
                is_dir: true,
                size: None,
            });
        }

        // Current directory selection entry (triggers scope modal)
        entries.push(FileEntry {
            name: ".".to_string(),
            path: dir_path.to_string_lossy().to_string(),
            is_dir: true,
            size: None,
        });

        // Directory children
        match fs::read_dir(&dir_path) {
            Ok(read_dir) => {
                let mut children: Vec<FileEntry> = read_dir
                    .flatten()
                    .filter_map(|entry| {
                        let name = entry.file_name().to_string_lossy().to_string();
                        // Skip hidden files and common build/dependency dirs
                        if name.starts_with('.')
                            || name == "node_modules"
                            || name == "target"
                            || name == "dist"
                        {
                            return None;
                        }
                        let meta = entry.metadata().ok();
                        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                        let size = if is_dir {
                            None
                        } else {
                            meta.as_ref().map(|m| m.len())
                        };
                        Some(FileEntry {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                            is_dir,
                            size,
                        })
                    })
                    .collect();

                // Dirs first, then files, each group sorted alphabetically
                children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                });

                entries.extend(children);
            }
            Err(e) => return Err(format!("Failed to read directory: {}", e)),
        }

        Ok(entries)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Count files inside a folder at two depths: direct children only (shallow)
/// and all nested files recursively (deep).
///
/// Hidden files and `node_modules` / `target` are excluded from both counts.
#[specta]
#[tauri::command]
pub async fn count_folder_files(path: String) -> Result<FolderCounts, String> {
    tokio::task::spawn_blocking(move || {
        let dir_path = PathBuf::from(&path);

        if !dir_path.exists() || !dir_path.is_dir() {
            return Err(format!("'{}' is not a valid directory", path));
        }

        // Shallow: direct file children only
        let shallow = fs::read_dir(&dir_path)
            .map(|rd| {
                rd.flatten()
                    .filter(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        !name.starts_with('.')
                            && name != "node_modules"
                            && name != "target"
                            && e.path().is_file()
                    })
                    .count()
            })
            .unwrap_or(0);

        // Deep: all files recursively, skipping ignored dirs
        let deep = WalkDir::new(&dir_path)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                !name.starts_with('.') && name != "node_modules" && name != "target"
            })
            .flatten()
            .filter(|e| e.file_type().is_file())
            .count();

        Ok(FolderCounts { shallow, deep })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
