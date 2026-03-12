//! SubagentSession entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "subagent_sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub parent_conversation_id: Uuid,
    pub parent_message_id: Uuid,
    pub workflow_step_id: Option<Uuid>,
    pub task_description: String,
    pub status: String,
    #[sea_orm(column_type = "Text")]
    pub result_summary: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub completed_at: Option<DateTimeWithTimeZone>,
    // Relations
    #[sea_orm(belongs_to, from = "parent_conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
