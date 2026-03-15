//! Local nudge cache – tracks which platform nudges have been shown.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "local_nudge_cache")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub platform_nudge_id: Uuid,
    pub shown_at: DateTimeWithTimeZone,
}

impl ActiveModelBehavior for ActiveModel {}
