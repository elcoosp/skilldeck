//! Background nudge poller.
//!
//! Runs on a tokio interval, polls the platform for pending nudges, and emits
//! Tauri events to the frontend so it can display toast notifications.

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tracing::{debug, warn};

use crate::platform_client::PendingNudge;
use crate::state::AppState;

const BASE_INTERVAL_SECS: u64 = 3600; // 1 hour
const MAX_INTERVAL_SECS: u64 = 86400; // 24 hours

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
        // Track consecutive failures for exponential backoff.
        let mut consecutive_failures: u32 = 0;

        loop {
            match poll_once(&app, &state).await {
                Ok(_) => {
                    consecutive_failures = 0; // reset on success
                }
                Err(e) => {
                    consecutive_failures += 1;
                    warn!(
                        "Nudge poll failed (attempt {}): {}",
                        consecutive_failures, e
                    );
                }
            }

            let backoff = std::cmp::min(
                BASE_INTERVAL_SECS * (1 << consecutive_failures.min(4)),
                MAX_INTERVAL_SECS,
            );
            tokio::time::sleep(Duration::from_secs(backoff)).await;
        }
    });
}

async fn poll_once(app: &AppHandle, state: &Arc<AppState>) -> Result<(), String> {
    let client = state.platform_client.read().await;
    if !client.is_configured() {
        debug!("Nudge poller: client not configured, skipping");
        return Ok(());
    }

    match client.get_pending_nudges(None).await {
        // <-- added None
        Ok(nudges) => {
            for nudge in nudges {
                let nudge_id = nudge.id;
                let payload = NudgeEventPayload::from(nudge);
                if let Err(e) = app.emit("nudge://pending", &payload) {
                    warn!("Failed to emit nudge event: {e}");
                }
                // Best-effort mark as delivered.
                let _ = client.mark_nudge_delivered(nudge_id, None).await; // <-- added None
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}
