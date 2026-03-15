//! Background nudge poller.
//!
//! Runs on a tokio interval, polls the platform for pending nudges, and emits
//! Tauri events to the frontend so it can display toast notifications.

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tracing::{debug, warn};
use uuid::Uuid;

use crate::platform_client::PendingNudge;
use crate::state::AppState;

const POLL_INTERVAL_SECS: u64 = 3600; // 1 hour

/// Payload sent to the frontend via the `nudge://pending` Tauri event.
#[derive(Debug, Clone, serde::Serialize)]
pub struct NudgeEventPayload {
    pub id: String,
    pub message: String,
    pub cta_label: Option<String>,
    pub cta_action: Option<String>,
}

impl From<PendingNudge> for NudgeEventPayload {
    fn from(n: PendingNudge) -> Self {
        Self {
            id: n.id.to_string(),
            message: n.message,
            cta_label: n.cta_label,
            cta_action: n.cta_action,
        }
    }
}

/// Spawn the nudge poller.  Returns immediately; the task runs in the
/// background until the app exits.
pub fn start_nudge_poller(app: AppHandle, state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_SECS));
        // First tick fires immediately so we load nudges on startup.
        loop {
            interval.tick().await;
            poll_once(&app, &state).await;
        }
    });
}

async fn poll_once(app: &AppHandle, state: &Arc<AppState>) {
    let client = state.platform_client.read().await;
    if !client.is_configured() {
        debug!("Nudge poller: client not configured, skipping");
        return;
    }

    match client.get_pending_nudges().await {
        Ok(nudges) => {
            for nudge in nudges {
                let nudge_id = nudge.id;
                let payload = NudgeEventPayload::from(nudge);
                if let Err(e) = app.emit("nudge://pending", &payload) {
                    warn!("Failed to emit nudge event: {e}");
                }
                // Best-effort mark as delivered.
                let _ = client.mark_nudge_delivered(nudge_id).await;
            }
        }
        Err(e) => debug!("Nudge poll failed: {e}"),
    }
}
