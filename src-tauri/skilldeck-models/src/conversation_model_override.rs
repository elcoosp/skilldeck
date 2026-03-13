//! Conversation model override entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_model_override")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub conversation_id: Uuid,
    pub model_provider: String,
    pub model_id: String,
    pub model_params: Option<Json>,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
