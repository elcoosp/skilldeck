use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;
use specta::specta;
use crate::events::RunCodeEvent;
use tracing::{info, error};

#[specta]
#[tauri::command]
pub async fn run_code_snippet(
    app: AppHandle,
    language: String,
    code: String,
    working_dir: Option<String>,
    run_id: Option<String>, // new optional parameter
) -> Result<String, String> {
    // Use provided run_id or generate a new one
    let run_id = run_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    // Whitelist interpreters with better detection
    let (cmd, args) = match language.as_str() {
        "python" | "py" => {
            let python_cmd = if cfg!(target_os = "windows") {
                "python"
            } else {
                if tokio::process::Command::new("python3")
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
        },
        "javascript" | "js" => ("node", vec!["-e", &code]),
        "bash" | "sh" => ("bash", vec!["-c", &code]),
        "ruby" | "rb" => ("ruby", vec!["-e", &code]),
        _ => return Err(format!("Running '{}' is not supported for security reasons", language)),
    };

    info!("Running code snippet: language={}, cmd={}, run_id={}", language, cmd, run_id);

    let working_dir = working_dir.unwrap_or_else(|| ".".to_string());

    let mut child = match Command::new(cmd)
        .args(&args)
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to start interpreter '{}': {}", cmd, e);
            return Err(format!("Failed to start interpreter: {}. Is {} installed?", e, cmd));
        }
    };

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Spawn stdout reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            info!("[{}] stdout: {}", run_id_clone, line);
            let _ = app_clone.emit("run-code-event", RunCodeEvent::Stdout {
                run_id: run_id_clone.clone(),
                line,
            });
        }
    });

    // Spawn stderr reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            info!("[{}] stderr: {}", run_id_clone, line);
            let _ = app_clone.emit("run-code-event", RunCodeEvent::Stderr {
                run_id: run_id_clone.clone(),
                line,
            });
        }
    });

    let start = Instant::now();
    let status = child.wait().await.map_err(|e| format!("Process error: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;

    let code = status.code().unwrap_or(-1);
    info!("[{}] Process exited with code {} after {}ms", run_id, code, elapsed);

    let _ = app.emit("run-code-event", RunCodeEvent::Exit {
        run_id: run_id.clone(),
        code,
        elapsed_ms: elapsed,
    });

    Ok(run_id)
}
