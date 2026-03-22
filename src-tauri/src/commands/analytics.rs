//! Analytics Tauri command.
//! Aggregates real usage data from the local database.

use chrono::{Duration, Utc};
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use specta::{Type, specta}; // <-- import specta macro
use std::sync::Arc;
use tauri::State;

use crate::state::AppState;
use skilldeck_models::{
    conversations::Column as ConversationColumn,
    conversations::Entity as Conversations,
    messages::Column as MessageColumn,
    // usage_events::Column as UsageColumn, // <-- removed unused import
    messages::Entity as Messages,
    usage_events::Entity as UsageEvents,
};

#[derive(Debug, Serialize, Type)]
pub struct AnalyticsData {
    total_conversations: u64,
    total_messages: u64,
    messages_per_day: Vec<DailyCount>,
    skills_used: Vec<SkillUsage>,
    token_usage: TokenTotals,
}

#[derive(Debug, Serialize, Type)]
pub struct DailyCount {
    date: String,
    count: u64,
}

#[derive(Debug, Serialize, Type)]
pub struct SkillUsage {
    name: String,
    count: u64,
}

#[derive(Debug, Serialize, Type, Default)]
pub struct TokenTotals {
    input_tokens: i64,
    output_tokens: i64,
    total_tokens: i64,
}

#[specta]
#[tauri::command]
pub async fn get_analytics(state: State<'_, Arc<AppState>>) -> Result<AnalyticsData, String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;

    // Total active conversations
    let total_conversations = Conversations::find()
        .filter(ConversationColumn::Status.eq("active"))
        .count(db)
        .await
        .map_err(|e| e.to_string())?;

    // Total messages
    let total_messages = Messages::find()
        .count(db)
        .await
        .map_err(|e| e.to_string())?;

    // Messages per day for the last 30 days
    let thirty_days_ago = Utc::now() - Duration::days(30);
    let messages = Messages::find()
        .filter(MessageColumn::CreatedAt.gte(thirty_days_ago)) // <-- removed .into()
        .order_by_asc(MessageColumn::CreatedAt)
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut daily_counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for msg in messages {
        let date = msg.created_at.format("%Y-%m-%d").to_string();
        *daily_counts.entry(date).or_insert(0) += 1;
    }

    let mut messages_per_day: Vec<DailyCount> = daily_counts
        .into_iter()
        .map(|(date, count)| DailyCount { date, count })
        .collect();
    messages_per_day.sort_by(|a, b| a.date.cmp(&b.date));

    // Skills used (count occurrences in context_items JSON)
    let messages_with_context = Messages::find()
        .filter(MessageColumn::ContextItems.is_not_null())
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut skill_counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for msg in messages_with_context {
        if let Some(context_json) = msg.context_items {
            if let Ok(items) = serde_json::from_value::<Vec<serde_json::Value>>(context_json) {
                for item in items {
                    if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                        if item_type == "skill" {
                            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                                *skill_counts.entry(name.to_string()).or_insert(0) += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    let skills_used: Vec<SkillUsage> = skill_counts
        .into_iter()
        .map(|(name, count)| SkillUsage { name, count })
        .collect();

    // Token usage totals
    let usage_events = UsageEvents::find()
        .all(db)
        .await
        .map_err(|e| e.to_string())?;

    let mut token_totals = TokenTotals::default();
    for event in usage_events {
        token_totals.input_tokens += event.input_tokens.unwrap_or(0) as i64;
        token_totals.output_tokens += event.output_tokens.unwrap_or(0) as i64;
    }
    token_totals.total_tokens = token_totals.input_tokens + token_totals.output_tokens;

    Ok(AnalyticsData {
        total_conversations,
        total_messages,
        messages_per_day,
        skills_used,
        token_usage: token_totals,
    })
}
