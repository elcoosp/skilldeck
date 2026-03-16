// src-tauri/src/subagent_monitor.rs
//! Subagent monitoring — listens to A2A event streams and forwards to Tauri frontend.

use adk_server::a2a::{A2aClient, UpdateEvent};
use dashmap::DashMap;
use futures::StreamExt;
use std::sync::Arc;
use tauri::AppHandle;
use tracing::error;

pub async fn monitor_subagent(
    subagent_id: String,
    client: A2aClient,
    app_handle: AppHandle,
    results_map: Arc<DashMap<String, String>>,
) {
    // Send a start message to kick off the subagent
    let message = adk_server::a2a::Message::builder()
        .role(adk_server::a2a::Role::User)
        .parts(vec![adk_server::a2a::Part::text("Start".to_string())])
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
                // Store the latest artifact as the result
                if let Some(text) = artifact.parts.first().and_then(|p| p.text()) {
                    last_result = text.to_string();
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
