//! Workflow step entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "workflow_steps")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub execution_id: Uuid,
    pub step_name: String,
    pub status: String, // "pending", "running", "completed", "failed", "blocked"
    pub subagent_session_id: Option<Uuid>,
    pub tokens_used: Option<i32>,
    #[sea_orm(column_type = "Text")]
    pub result: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub error: Option<String>,
    pub started_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,

    #[sea_orm(belongs_to, from = "execution_id", to = "id")]
    pub execution: HasOne<super::workflow_executions::Entity>,

    #[sea_orm(belongs_to, from = "subagent_session_id", to = "id")]
    pub subagent_session: HasOne<super::subagent_sessions::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
