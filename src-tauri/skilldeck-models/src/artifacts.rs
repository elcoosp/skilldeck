//! Artifact entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "artifacts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub message_id: Uuid,
    pub r#type: String,
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub content: String,
    pub language: Option<String>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "message_id", to = "id")]
    pub message: HasOne<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
