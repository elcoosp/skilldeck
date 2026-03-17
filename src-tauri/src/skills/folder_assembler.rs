//! Folder content assembler — walks a directory and concatenates file contents.
//! Uses the `ignore` crate to respect .gitignore, hidden files, etc.

use anyhow::Result;
use ignore::WalkBuilder;
use std::fs;
use std::path::Path;

/// Recursively walk a directory, respecting ignore rules, and return (content_string, file_count)
pub fn assemble_folder_context(
    folder_path: &Path,
    deep: bool,
    max_total_bytes: Option<usize>,
) -> Result<(String, usize)> {
    let mut builder = WalkBuilder::new(folder_path);
    builder.hidden(true).git_ignore(true).ignore(true);
    if !deep {
        builder.max_depth(Some(1));
    }

    let walk = builder.build();
    let mut output = String::new();
    let mut file_count = 0;
    let mut total_bytes = 0;

    for entry in walk {
        let entry = entry?;
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(folder_path)
            .unwrap_or(path)
            .to_string_lossy();

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Could not read {}: {}", path.display(), e);
                continue;
            }
        };

        if let Some(limit) = max_total_bytes {
            if total_bytes + content.len() > limit {
                let remaining = limit.saturating_sub(total_bytes);
                output.push_str(&content[..remaining]);
                total_bytes = limit;
                break;
            }
        }

        output.push_str(&format!("=== File: {} ===\n{}\n\n", relative, content));
        total_bytes += content.len();
        file_count += 1;
    }

    Ok((output, file_count))
}
