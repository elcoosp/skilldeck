//! Conversation skill override entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_skill_overrides")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub skill_name: String,
    pub enabled: bool,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
