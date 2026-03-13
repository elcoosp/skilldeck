//! Conversation branch entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_branches")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub parent_message_id: Uuid,
    pub name: Option<String>,
    pub status: String, // "active", "merged", "discarded"
    pub created_at: DateTimeWithTimeZone,
    pub merged_at: Option<DateTimeWithTimeZone>,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,

    #[sea_orm(belongs_to, from = "parent_message_id", to = "id")]
    pub parent_message: HasOne<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
