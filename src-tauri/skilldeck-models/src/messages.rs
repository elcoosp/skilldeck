//! Message entity — SeaORM 2.0 format.
//!
//! The `parent_id` self-reference enables branching conversation trees.
//! The `branch_id` links a message to a specific branch; NULL means main trunk.

use sea_orm::entity::prelude::*;

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
    pub metadata: Option<Json>,
    pub context_items: Option<Json>, // <-- added
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_read_tokens: Option<i32>,
    pub cache_write_tokens: Option<i32>,
    pub status: String, // <-- added
    pub created_at: DateTimeWithTimeZone,
    // Relations
    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
