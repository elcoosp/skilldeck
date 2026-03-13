//! Export job entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "export_jobs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub r#type: String,
    pub conversation_ids: Json,
    pub status: String, // "pending", "running", "completed", "failed"
    pub output_path: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub error: Option<String>,
    pub started_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
}

impl ActiveModelBehavior for ActiveModel {}
