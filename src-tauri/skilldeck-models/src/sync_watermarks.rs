//! Sync watermark entity (v2 stub) — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "sync_watermarks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub sync_state_id: Uuid,
    pub table_name: String,
    pub last_synced_version: i64,
    pub updated_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "sync_state_id", to = "id")]
    pub sync_state: HasOne<super::sync_state::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
