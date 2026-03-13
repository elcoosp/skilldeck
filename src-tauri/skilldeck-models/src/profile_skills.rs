//! Profile skill association entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "profile_skills")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub profile_id: Uuid,
    pub skill_name: String,
    pub skill_source: String,
    pub enabled: bool,
    pub created_at: DateTimeWithTimeZone,

    #[sea_orm(belongs_to, from = "profile_id", to = "id")]
    pub profile: HasOne<super::profiles::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
