use crate::app::AppState;
use anyhow::Result;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use std::sync::Arc;
use uuid::Uuid;

/// Fetch GitHub issues with label "documentation" and store as feedback.
pub async fn fetch_github_issues(
    state: Arc<AppState>,
    repo: &str,
    token: Option<&str>,
) -> Result<()> {
    // Use octocrab or reqwest to call GitHub API.
    // For each issue, check if already exists (by source_id = issue number).
    // If not, create feedback entry.

    // Example (pseudo-code):
    // let client = octocrab::Octocrab::builder()
    //     .personal_token(token.unwrap_or("").to_string())
    //     .build()?;
    // let issues = client.issues(repo).list().labels(&["documentation"]).send().await?;
    // for issue in issues {
    //     let exists = crate::feedback::models::Entity::find()
    //         .filter(crate::feedback::models::Column::SourceId.eq(issue.number.to_string()))
    //         .one(&state.db).await?.is_some();
    //     if !exists {
    //         let now = chrono::Utc::now().fixed_offset();
    //         let feedback = crate::feedback::models::ActiveModel {
    //             id: Set(Uuid::new_v4()),
    //             source: Set("github".to_string()),
    //             source_id: Set(Some(issue.number.to_string())),
    //             user_email: Set(None),
    //             user_name: Set(issue.user.login),
    //             content: Set(issue.body.unwrap_or_default()),
    //             url: Set(issue.html_url),
    //             created_at: Set(now),
    //             status: Set("new".to_string()),
    //             assigned_to: Set(None),
    //             tags: Set(Some(vec!["github".to_string()])),
    //             metadata: Set(Some(serde_json::json!({
    //                 "state": issue.state,
    //                 "title": issue.title,
    //             }))),
    //             comments: Default::default(),
    //         };
    //         feedback.insert(&state.db).await?;
    //     }
    // }
    Ok(())
}

/// Fetch Discord messages from a specific channel and store as feedback.
pub async fn fetch_discord_messages(
    state: Arc<AppState>,
    channel_id: &str,
    bot_token: &str,
) -> Result<()> {
    // Use reqwest to call Discord API.
    // For each message, store as feedback (maybe only those with certain keywords?).
    // Deduplicate by source_id (message ID).
    Ok(())
}
