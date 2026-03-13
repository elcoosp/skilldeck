//! Prompt variable entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "prompt_variables")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub prompt_id: Uuid,
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub description: Option<String>,
    pub default_value: Option<String>,

    #[sea_orm(belongs_to, from = "prompt_id", to = "id")]
    pub prompt: HasOne<super::prompts::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
