//! Conversation MCP override entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_mcp_overrides")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub mcp_server_id: Uuid,
    pub enabled: bool,
    pub overrides: Option<Json>,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,

    #[sea_orm(belongs_to, from = "mcp_server_id", to = "id")]
    pub mcp_server: HasOne<super::mcp_servers::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
