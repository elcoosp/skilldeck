//! Message entity — SeaORM 2.0 format.

use sea_orm::{FromJsonQueryResult, entity::prelude::*};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::context_item::ContextItems;

/// Typed metadata stored on every message row.
#[derive(
    Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq, FromJsonQueryResult, Type,
)]
pub struct MessageMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_queue: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub queued_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
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
    pub parent_id: Option<Uuid>,
    pub branch_id: Option<Uuid>,
    pub seen: bool,
    pub role: String,
    #[sea_orm(column_type = "Text")]
    pub content: String,
    pub metadata: Option<MessageMetadata>,
    pub node_document: Option<Json>,
    pub context_items: Option<ContextItems>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_read_tokens: Option<i32>,
    pub cache_write_tokens: Option<i32>,
    #[sea_orm(default_value = "active")]
    pub status: String,
    /// Full thinking text for assistant messages when thinking mode was enabled.
    pub thinking_content: Option<String>,
    /// Structured NodeDocument for the thinking content (streamed incrementally).
    pub thinking_document: Option<Json>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
