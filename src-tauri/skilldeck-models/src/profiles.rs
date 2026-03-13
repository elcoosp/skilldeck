//! Profile entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "profiles")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub model_provider: String,
    pub model_id: String,
    pub model_params: Option<Json>,
    pub is_default: bool,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    // Relations (2.0: defined inline on the Model)
    #[sea_orm(has_many)]
    pub conversations: HasMany<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
