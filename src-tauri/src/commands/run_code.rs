use std::io::Write;
use std::time::Instant;
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use serde::Serialize;
use specta::Type;
use tempfile::Builder as TempFileBuilder;

#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RunOutput {
    Stdout { line: String },
    Stderr { line: String },
    Exit { code: i32, elapsed_ms: u64 },
}

#[tauri::command]
#[specta::specta]
pub async fn run_code_snippet(
    channel: Channel<RunOutput>,
    language: String,
    code: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    // Resolve working directory once
    let working_dir = working_dir.unwrap_or_else(|| ".".to_string());

    // Determine interpreter/compiler and arguments (owned values)
    let (cmd, args): (String, Vec<String>) = match language.as_str() {
        "python" | "py" => {
            let python_cmd = if cfg!(target_os = "windows") {
                "python".to_string()
            } else {
                if Command::new("python3")
                    .arg("--version")
                    .output()
                    .await
                    .map(|o| o.status.success())
                    .unwrap_or(false)
                {
                    "python3".to_string()
                } else {
                    "python".to_string()
                }
            };
            (python_cmd, vec!["-c".to_string(), code])
        }
        "javascript" | "js" => ("node".to_string(), vec!["-e".to_string(), code]),
        "bash" | "sh" => ("bash".to_string(), vec!["-c".to_string(), code]),
        "ruby" | "rb" => ("ruby".to_string(), vec!["-e".to_string(), code]),
        "rust" | "rs" => {
            // Create a temporary file for the Rust source code
            let mut temp_file = TempFileBuilder::new()
                .suffix(".rs")
                .tempfile()
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            temp_file
                .write_all(code.as_bytes())
                .map_err(|e| format!("Failed to write temp file: {}", e))?;
            let source_path = temp_file.path().to_path_buf();

            // Prepare the output binary path (same as source but without .rs)
            let mut binary_path = source_path.clone();
            binary_path.set_extension("");
            if cfg!(target_os = "windows") {
                binary_path.set_extension("exe");
            }

            // Compile with rustc
            let compile_output = Command::new("rustc")
                .arg(&source_path)
                .arg("-o")
                .arg(&binary_path)
                .current_dir(&working_dir)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start rustc: {}. Is Rust installed?", e))?;

            let compile_result = compile_output
                .wait_with_output()
                .await
                .map_err(|e| format!("Failed to wait for rustc: {}", e))?;

            // Forward compilation stderr to the frontend
            if !compile_result.stderr.is_empty() {
                let stderr_str = String::from_utf8_lossy(&compile_result.stderr);
                for line in stderr_str.lines() {
                    let _ = channel.send(RunOutput::Stderr {
                        line: line.to_string(),
                    });
                }
            }

            if !compile_result.status.success() {
                // Compilation failed – send exit and return early
                let elapsed = Instant::now().elapsed().as_millis() as u64;
                let code = compile_result.status.code().unwrap_or(-1);
                let _ = channel.send(RunOutput::Exit {
                    code,
                    elapsed_ms: elapsed,
                });
                return Ok(());
            }

            // Compilation succeeded – return binary path as command with no args
            let binary_str = binary_path
                .to_str()
                .ok_or("Invalid binary path")?
                .to_string();
            (binary_str, vec![])
        }
        _ => {
            return Err(format!(
                "Running '{}' is not supported for security reasons",
                language
            ))
        }
    };

    let mut child = Command::new(&cmd)
        .args(&args)
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start interpreter: {}. Is {} installed?", e, cmd))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Spawn stdout reader
    let channel_clone = channel.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = channel_clone.send(RunOutput::Stdout { line });
        }
    });

    // Spawn stderr reader
    let channel_clone = channel.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = channel_clone.send(RunOutput::Stderr { line });
        }
    });

    let start = Instant::now();
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Process error: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;
    let code = status.code().unwrap_or(-1);

    let _ = channel.send(RunOutput::Exit {
        code,
        elapsed_ms: elapsed,
    });

    Ok(())
}
