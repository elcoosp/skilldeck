//! Bookmark entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "bookmarks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub message_id: Uuid,
    pub note: Option<String>,
    pub heading_anchor: Option<String>,
    pub label: Option<String>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "message_id", to = "id")]
    pub message: HasOne<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
