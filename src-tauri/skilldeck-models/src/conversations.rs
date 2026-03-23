//! Conversation entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "conversations")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub profile_id: Uuid,
    pub title: Option<String>,
    pub workspace_id: Option<Uuid>,
    pub folder_id: Option<Uuid>,
    pub status: String,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub archived_at: Option<DateTimeWithTimeZone>,
    pub pinned: bool,

    // Relations
    #[sea_orm(belongs_to, from = "profile_id", to = "id")]
    pub profile: HasOne<super::profiles::Entity>,

    #[sea_orm(belongs_to, from = "workspace_id", to = "id")]
    pub workspace: HasOne<super::workspaces::Entity>,

    #[sea_orm(belongs_to, from = "folder_id", to = "id")]
    pub folder: HasOne<super::folders::Entity>,

    #[sea_orm(has_many)]
    pub messages: HasMany<super::messages::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
