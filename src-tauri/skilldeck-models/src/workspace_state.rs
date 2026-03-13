//! Workspace UI state entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "workspace_state")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub workspace_id: Uuid,
    pub expanded_folders: Option<Json>,
    pub sort_order: Option<Json>,
    pub updated_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "workspace_id", to = "id")]
    pub workspace: HasOne<super::workspaces::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
