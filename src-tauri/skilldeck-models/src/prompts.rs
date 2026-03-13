//! Prompt entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "prompts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub content: String,
    pub category: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,

    #[sea_orm(has_many)]
    pub variables: HasMany<super::prompt_variables::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
