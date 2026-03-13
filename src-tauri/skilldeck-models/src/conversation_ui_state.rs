//! Conversation UI state entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversation_ui_state")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub conversation_id: Uuid,
    pub active_branch_id: Option<Uuid>,
    pub scroll_position: Option<i32>,
    pub panel_sizes: Option<Json>,
    pub updated_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "conversation_id", to = "id")]
    pub conversation: HasOne<super::conversations::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
