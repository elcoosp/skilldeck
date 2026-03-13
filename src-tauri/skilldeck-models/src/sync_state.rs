//! Sync state entity (v2 stub) — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "sync_state")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub backend_type: String,
    pub status: String, // "disconnected", "connecting", "connected", "error"
    pub last_sync_at: Option<DateTimeWithTimeZone>,
    #[sea_orm(column_type = "Text")]
    pub last_error: Option<String>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(has_many)]
    pub watermarks: HasMany<super::sync_watermarks::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
