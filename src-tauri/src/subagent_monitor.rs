// src-tauri/src/subagent_monitor.rs
//! Subagent monitoring — listens to A2A event streams and forwards to Tauri frontend.

use adk_rust::server::a2a::{A2aClient, Message, Part, Role, UpdateEvent};
use dashmap::DashMap;
use futures::StreamExt;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tracing::error;

pub async fn monitor_subagent(
    subagent_id: String,
    client: Arc<A2aClient>,
    app_handle: AppHandle,
    results_map: Arc<DashMap<String, String>>,
) {
    // Send a start message to kick off the subagent
    let message = Message::builder()
        .role(Role::User)
        .parts(vec![Part::text("Start".to_string())])
        .message_id(uuid::Uuid::new_v4().to_string())
        .build();

    let stream = match client.send_streaming_message(message).await {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to start subagent {}: {}", subagent_id, e);
            return;
        }
    };

    let mut stream = Box::pin(stream);
    let mut last_result = String::new();

    while let Some(event) = stream.next().await {
        match event {
            Ok(UpdateEvent::TaskStatusUpdate(status)) => {
                let _ = app_handle.emit(
                    "subagent-status",
                    serde_json::json!({
                        "subagentId": subagent_id,
                        "status": status.status.state,
                    }),
                );
            }
            Ok(UpdateEvent::TaskArtifactUpdate(artifact)) => {
                // Access the nested artifact field and extract text from parts
                let text = artifact.artifact.parts.iter().find_map(|part| match part {
                    Part::Text { text, .. } => Some(text.clone()), // ignore metadata with `..`
                    _ => None,
                });
                if let Some(text) = text {
                    last_result = text;
                    let _ = app_handle.emit(
                        "subagent-artifact",
                        serde_json::json!({
                            "subagentId": subagent_id,
                            "artifact": artifact,
                        }),
                    );
                }
            }
            Err(e) => {
                error!("Subagent {} stream error: {}", subagent_id, e);
                break;
            }
        }
    }

    // When stream ends, store the final result
    if !last_result.is_empty() {
        results_map.insert(subagent_id.clone(), last_result);
    }
}
