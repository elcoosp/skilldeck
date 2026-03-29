//! Message entity — SeaORM 2.0 format.
//!
//! The `parent_id` self-reference enables branching conversation trees.
//! The `branch_id` links a message to a specific branch; NULL means main trunk.

use sea_orm::{FromJsonQueryResult, entity::prelude::*};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::context_item::ContextItems;

/// Typed metadata stored on every message row.
/// All fields are optional — missing fields mean "not applicable for this role".
#[derive(
    Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult, Type,
)]
pub struct MessageMetadata {
    /// Set on `role = user` messages sent from the queue.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_queue: Option<bool>,

    /// ISO-8601 timestamp of when the message entered the queue.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub queued_at: Option<String>,

    /// Set on `role = tool` messages — the name of the tool that produced this result.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,

    /// Set on `role = tool` messages — the tool_call_id that pairs this result
    /// with the assistant's tool_use block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    /// Optional parent message — `None` for root messages.
    pub parent_id: Option<Uuid>,
    /// Optional branch — `None` for main trunk.
    pub branch_id: Option<Uuid>,

    pub seen: bool,
    pub role: String,
    #[sea_orm(column_type = "Text")]
    pub content: String,
    pub metadata: Option<MessageMetadata>,
    // TODO extract markdown in a crate to expose type
    pub node_document: Option<Json>,
    pub context_items: Option<ContextItems>,
    pub stable_html: Option<String>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_read_tokens: Option<i32>,
    pub cache_write_tokens: Option<i32>,
    #[sea_orm(default_value = "active")]
    pub status: String,
    pub created_at: DateTimeWithTimeZone,
    // Relations
    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
