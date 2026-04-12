use crate::events::RunCodeEvent;
use specta::specta;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

#[specta]
#[tauri::command]
pub async fn run_code_snippet(
    app: AppHandle,
    language: String,
    code: String,
    working_dir: Option<String>,
) -> Result<String, String> {
    // Whitelist interpreters
    let (cmd, args) = match language.as_str() {
        "python" | "py" => ("python3", vec!["-c", &code]),
        "javascript" | "js" => ("node", vec!["-e", &code]),
        "bash" | "sh" => ("bash", vec!["-c", &code]),
        "ruby" | "rb" => ("ruby", vec!["-e", &code]),
        _ => {
            return Err(format!(
                "Running '{}' is not supported for security reasons",
                language
            ));
        }
    };

    let run_id = Uuid::new_v4().to_string();
    let working_dir = working_dir.unwrap_or_else(|| ".".to_string());

    let mut child = Command::new(cmd)
        .args(&args)
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start interpreter: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Spawn stdout reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone.emit(
                "run-code-event",
                RunCodeEvent::Stdout {
                    run_id: run_id_clone.clone(),
                    line,
                },
            );
        }
    });

    // Spawn stderr reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone.emit(
                "run-code-event",
                RunCodeEvent::Stderr {
                    run_id: run_id_clone.clone(),
                    line,
                },
            );
        }
    });

    let start = Instant::now();
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Process error: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;

    let _ = app.emit(
        "run-code-event",
        RunCodeEvent::Exit {
            run_id: run_id.clone(),
            code: status.code().unwrap_or(-1),
            elapsed_ms: elapsed,
        },
    );

    Ok(run_id)
}
