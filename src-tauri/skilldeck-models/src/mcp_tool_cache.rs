//! MCP tool cache entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "mcp_tool_cache")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub mcp_server_id: Uuid,
    pub tool_name: String,
    #[sea_orm(column_type = "Text")]
    pub description: Option<String>,
    pub input_schema: Json,
    pub cached_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "mcp_server_id", to = "id")]
    pub mcp_server: HasOne<super::mcp_servers::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
