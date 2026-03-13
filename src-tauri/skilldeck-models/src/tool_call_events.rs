//! Tool call event entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "tool_call_events")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub message_id: Uuid,
    pub call_id: String,
    pub tool_name: String,
    pub input_json: Json,
    pub status: String, // "pending", "approved", "denied", "executed", "failed"
    pub result_json: Option<Json>,
    #[sea_orm(column_type = "Text")]
    pub error: Option<String>,
    pub requires_approval: bool,
    pub auto_approved: bool,
    pub created_at: DateTimeWithTimeZone,
    pub completed_at: Option<DateTimeWithTimeZone>,

    #[sea_orm(belongs_to, from = "message_id", to = "id")]
    pub message: HasOne<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
