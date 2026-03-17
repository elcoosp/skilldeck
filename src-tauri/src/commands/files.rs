// src-tauri/src/commands/files.rs
//! File-system browsing commands for the Chat Context Injection feature.
//!
//! Provides directory listing and file-count commands consumed by the
//! `FileMentionPicker` and `FolderScopeModal` frontend components.

use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use specta::{Type, specta};
use std::path::PathBuf;

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

        // Use ignore::WalkBuilder to respect .gitignore and hidden files
        let walker = WalkBuilder::new(&dir_path)
            .hidden(true) // skip hidden files/dirs
            .git_ignore(true) // respect .gitignore
            .ignore(true) // respect .ignore
            .max_depth(Some(1)) // immediate children only
            .build();

        for result in walker {
            match result {
                Ok(entry) if entry.depth() > 0 => {
                    let file_type = entry.file_type();
                    let is_dir = file_type.map(|ft| ft.is_dir()).unwrap_or(false);
                    let name = entry.file_name().to_string_lossy().to_string();
                    let size = entry
                        .metadata()
                        .ok()
                        .and_then(|m| if is_dir { None } else { Some(m.len()) });
                    entries.push(FileEntry {
                        name,
                        path: entry.path().to_string_lossy().to_string(),
                        is_dir,
                        size,
                    });
                }
                Err(e) => tracing::warn!("Walk error: {}", e),
                _ => {}
            }
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

        // Shallow: direct file children only (using ignore to filter hidden/build dirs)
        let shallow_builder = WalkBuilder::new(&dir_path)
            .hidden(true)
            .git_ignore(true)
            .ignore(true)
            .max_depth(Some(1))
            .build();

        let shallow = shallow_builder
            .into_iter()
            .filter_map(Result::ok)
            .filter(|e| e.depth() > 0 && e.file_type().map(|ft| ft.is_file()).unwrap_or(false))
            .count();

        // Deep: all files recursively, skipping ignored dirs
        let deep_builder = WalkBuilder::new(&dir_path)
            .hidden(true)
            .git_ignore(true)
            .ignore(true)
            .build();

        let deep = deep_builder
            .into_iter()
            .filter_map(Result::ok)
            .filter(|e| e.file_type().map(|ft| ft.is_file()).unwrap_or(false))
            .count();

        Ok(FolderCounts { shallow, deep })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Open a folder in the system file explorer.
#[specta]
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[derive(Debug, Deserialize, Type)]
pub struct ReadFileRequest {
    pub path: String,
    pub max_bytes: Option<usize>,
}

#[derive(Debug, Serialize, Type)]
pub struct ReadFileResponse {
    pub content: String,
    pub size: u64,
}

#[specta]
#[tauri::command]
pub async fn read_file(req: ReadFileRequest) -> Result<ReadFileResponse, String> {
    tokio::task::spawn_blocking(move || {
        let path = std::path::PathBuf::from(&req.path);
        let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            return Err("Path is not a file".to_string());
        }
        let file_size = metadata.len();
        let content = if let Some(limit) = req.max_bytes {
            if file_size > limit as u64 {
                // read only first `limit` bytes
                let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
                let mut buffer = vec![0; limit];
                use std::io::Read;
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                buffer.truncate(n);
                String::from_utf8(buffer).map_err(|e| e.to_string())?
            } else {
                std::fs::read_to_string(&path).map_err(|e| e.to_string())?
            }
        } else {
            std::fs::read_to_string(&path).map_err(|e| e.to_string())?
        };
        Ok(ReadFileResponse {
            content,
            size: file_size,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
#[derive(Debug, Deserialize, Type)]
pub struct AssembleFolderRequest {
    pub path: String,
    pub deep: bool,
    pub max_bytes: Option<usize>,
}

#[derive(Debug, Serialize, Type)]
pub struct AssembleFolderResponse {
    pub assembled_content: String,
    pub file_count: usize,
}

#[specta]
#[tauri::command]
pub async fn assemble_folder(req: AssembleFolderRequest) -> Result<AssembleFolderResponse, String> {
    tokio::task::spawn_blocking(move || {
        let path = std::path::PathBuf::from(&req.path);
        let (content, count) = crate::skills::folder_assembler::assemble_folder_context(
            &path,
            req.deep,
            req.max_bytes,
        )
        .map_err(|e| e.to_string())?;
        Ok(AssembleFolderResponse {
            assembled_content: content,
            file_count: count,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
