//! Profile MCP association entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "profile_mcps")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub profile_id: Uuid,
    pub mcp_server_id: Uuid,
    pub enabled: bool,
    pub overrides: Option<Json>,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "profile_id", to = "id")]
    pub profile: HasOne<super::profiles::Entity>,

    #[sea_orm(belongs_to, from = "mcp_server_id", to = "id")]
    pub mcp_server: HasOne<super::mcp_servers::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
