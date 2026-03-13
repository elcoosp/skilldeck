//! Folder entity — SeaORM 2.0 format.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "folders")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTimeWithTimeZone,

    // Self-referential relation: parent folder (belongs to)
    #[sea_orm(
        self_ref,
        relation_enum = "Parent",
        relation_reverse = "Children",
        from = "parent_id",
        to = "id"
    )]
    pub parent: HasOne<Entity>,

    // Self-referential relation: child folders (has many)
    #[sea_orm(self_ref, relation_enum = "Children", relation_reverse = "Parent")]
    pub children: HasMany<Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
