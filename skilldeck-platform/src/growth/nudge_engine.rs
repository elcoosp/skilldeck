//! Nudge engine — hourly background scheduler.
//!
//! Evaluates every active user's activity to decide whether a nudge is
//! warranted, picks a template (rotating through active ones for A/B testing),
//! creates a `pending_nudges` row, and optionally sends an email if the user
//! has opted in to email notifications.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, PaginatorTrait, QueryFilter};
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    app::AppState,
    core::models::users,
    growth::models::{activity_events, nudge_templates, pending_nudges},
    preferences::models::user_preferences,
};

pub fn start(state: Arc<AppState>) {
    tokio::spawn(async move {
        let sched = match JobScheduler::new().await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to create nudge scheduler: {e}");
                return;
            }
        };

        let state_clone = Arc::clone(&state);
        let job = Job::new_async("0 0 * * * *", move |_, _| {
            let s = Arc::clone(&state_clone);
            Box::pin(async move {
                run_nudge_cycle(&s).await;
            })
        });

        match job {
            Ok(j) => {
                if let Err(e) = sched.add(j).await {
                    error!("Failed to add nudge job: {e}");
                    return;
                }
            }
            Err(e) => {
                error!("Failed to build nudge job: {e}");
                return;
            }
        }

        if let Err(e) = sched.start().await {
            error!("Failed to start nudge scheduler: {e}");
        }
    });
}

async fn run_nudge_cycle(state: &Arc<AppState>) {
    info!("Nudge engine: starting cycle");

    // Fetch active templates.
    let templates = match nudge_templates::Entity::find()
        .filter(nudge_templates::COLUMN.active.eq(true))
        .all(&state.db)
        .await
    {
        Ok(t) => t,
        Err(e) => {
            error!("Nudge engine: failed to load templates: {e}");
            return;
        }
    };

    if templates.is_empty() {
        info!("Nudge engine: no active templates, seeding defaults");
        seed_default_templates(state).await;
        return;
    }

    // Fetch all users who have not opted out.
    let users = match users::Entity::find().all(&state.db).await {
        Ok(u) => u,
        Err(e) => {
            error!("Nudge engine: failed to load users: {e}");
            return;
        }
    };

    let mut nudges_created = 0usize;
    let now = chrono::Utc::now().fixed_offset();
    let cutoff = now
        .checked_sub_signed(chrono::Duration::days(7))
        .unwrap_or(now);

    for user in users {
        // Check preferences.
        let prefs = match user_preferences::Entity::find_by_id(user.id)
            .one(&state.db)
            .await
        {
            Ok(Some(p)) => p,
            _ => continue,
        };

        if prefs.nudge_opt_out {
            continue;
        }

        // Skip if user already has an undelivered nudge.
        let has_pending = pending_nudges::Entity::find()
            .filter(pending_nudges::COLUMN.user_id.eq(user.id))
            .filter(pending_nudges::COLUMN.delivered_at.is_null())
            .count(&state.db)
            .await
            .unwrap_or(0);

        if has_pending > 0 {
            continue;
        }

        // Frequency gate.
        let should_nudge = match prefs.nudge_frequency.as_str() {
            "daily" => true,
            "weekly" => {
                // Only nudge if there is no nudge delivered in the last 7 days.
                let recent = pending_nudges::Entity::find()
                    .filter(pending_nudges::COLUMN.user_id.eq(user.id))
                    .filter(pending_nudges::COLUMN.delivered_at.gte(cutoff))
                    .count(&state.db)
                    .await
                    .unwrap_or(1);
                recent == 0
            }
            // "important_only" — only nudge on inactivity (no events in 7 days).
            _ => {
                let recent_events = activity_events::Entity::find()
                    .filter(activity_events::COLUMN.user_id.eq(user.id))
                    .filter(activity_events::COLUMN.created_at.gte(cutoff))
                    .count(&state.db)
                    .await
                    .unwrap_or(1);
                recent_events == 0
            }
        };

        if !should_nudge {
            continue;
        }

        // Rotate templates (simple round-robin by nudge count).
        let idx = nudges_created % templates.len();
        let template = &templates[idx];

        let nudge = pending_nudges::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user.id),
            message: Set(template.body_html.clone()),
            cta_label: Set(template.cta_label.clone()),
            cta_action: Set(template.cta_action.clone()),
            created_at: Set(now),
            delivered_at: Set(None),
        };

        if let Err(e) = nudge.insert(&state.db).await {
            error!("Nudge engine: failed to insert nudge for {}: {e}", user.id);
            continue;
        }

        // Send email nudge if opted in.
        let channels: Vec<String> =
            serde_json::from_value(prefs.notification_channels.clone()).unwrap_or_default();
        if channels.contains(&"email".to_string()) {
            if let Some(email) = &prefs.email {
                if prefs.email_verified {
                    let cta = template.cta_label.as_deref();
                    let _ = state
                        .email
                        .send_nudge(email, &template.body_html, cta.map(|_| ""))
                        .await;
                }
            }
        }

        nudges_created += 1;
    }

    info!("Nudge engine: created {nudges_created} nudge(s)");
}

async fn seed_default_templates(state: &Arc<AppState>) {
    let now = chrono::Utc::now().fixed_offset();
    let defaults = [
        (
            "skill_sharing",
            "Share Your Skills with Your Team",
            r#"<p>Your best prompts shouldn't die in a chat window. <strong>Share a skill</strong> with your team and watch knowledge compound. Every skill shared multiplies team productivity.</p>"#,
            Some("Share a skill now"),
            Some("open:skills"),
            Some("team_knowledge"),
        ),
        (
            "referral_invite",
            "Invite a Colleague, Earn Rewards",
            r#"<p>Developers who share SkillDeck bring an average of 3 teammates on board. <strong>Share your referral link</strong> and earn free months while helping your team move faster.</p>"#,
            Some("Get your referral link"),
            Some("open:referral"),
            Some("team_knowledge"),
        ),
        (
            "privacy_reminder",
            "Your Code Stays Local — Always",
            r#"<p>Unlike cloud AI tools, SkillDeck keeps your code on your machine. API keys live in your OS keychain. You control what leaves your device. <strong>You own your context.</strong></p>"#,
            Some("Learn more"),
            Some("open:privacy"),
            Some("privacy"),
        ),
        (
            "workflow_discovery",
            "Turn Complex Tasks into Orchestrated Intelligence",
            r#"<p>Multi-agent workflows let you split complex tasks across parallel agents. What used to take hours of back-and-forth can now run in minutes. <strong>Try a workflow today.</strong></p>"#,
            Some("Explore workflows"),
            Some("open:workflows"),
            Some("intelligence"),
        ),
    ];

    for (name, subject, body, cta_label, cta_action, win_theme) in defaults {
        let template = nudge_templates::ActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(name.to_string()),
            subject: Set(subject.to_string()),
            body_html: Set(body.to_string()),
            cta_label: Set(cta_label.map(String::from)),
            cta_action: Set(cta_action.map(String::from)),
            win_theme: Set(win_theme.map(String::from)),
            active: Set(true),
            created_at: Set(now),
        };
        let _ = template.insert(&state.db).await;
    }
}
