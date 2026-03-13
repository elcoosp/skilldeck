//! Tag entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(has_many)]
    pub conversation_tags: HasMany<super::conversation_tags::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
