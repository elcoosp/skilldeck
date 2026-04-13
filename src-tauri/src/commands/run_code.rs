use std::time::Instant;
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use serde::Serialize;
use specta::Type;

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
    // Whitelist interpreters
    let (cmd, args) = match language.as_str() {
        "python" | "py" => {
            let python_cmd = if cfg!(target_os = "windows") {
                "python"
            } else {
                if Command::new("python3")
                    .arg("--version")
                    .output()
                    .await
                    .map(|o| o.status.success())
                    .unwrap_or(false)
                {
                    "python3"
                } else {
                    "python"
                }
            };
            (python_cmd, vec!["-c", &code])
        }
        "javascript" | "js" => ("node", vec!["-e", &code]),
        "bash" | "sh" => ("bash", vec!["-c", &code]),
        "ruby" | "rb" => ("ruby", vec!["-e", &code]),
        _ => return Err(format!("Running '{}' is not supported for security reasons", language)),
    };

    let working_dir = working_dir.unwrap_or_else(|| ".".to_string());

    let mut child = Command::new(cmd)
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
    let status = child.wait().await.map_err(|e| format!("Process error: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;
    let code = status.code().unwrap_or(-1);

    let _ = channel.send(RunOutput::Exit { code, elapsed_ms: elapsed });

    Ok(())
}
