//! Workspace entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "workspaces")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub path: String,
    pub name: String,
    pub project_type: Option<String>,
    pub is_open: bool,
    pub avatar_style: String,
    pub last_opened_at: Option<DateTimeWithTimeZone>,

    pub created_at: DateTimeWithTimeZone,

    // Reverse relation to conversations (optional)
    #[sea_orm(has_many)]
    pub conversations: HasMany<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
