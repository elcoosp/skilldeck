//! Message embedding entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "message_embeddings")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub message_id: Uuid,
    pub embedding: Option<Vec<u8>>, // blob
    pub model: Option<String>,
    pub generated_at: Option<DateTimeWithTimeZone>,

    #[sea_orm(belongs_to, from = "message_id", to = "id")]
    pub message: HasOne<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
