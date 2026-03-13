//! Conversation-tag junction entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_tags")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub tag_id: Uuid,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,

    #[sea_orm(belongs_to, from = "tag_id", to = "id")]
    pub tag: HasOne<super::tags::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
