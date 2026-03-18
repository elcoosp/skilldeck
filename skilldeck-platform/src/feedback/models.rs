//! Feedback domain entities for the internal feedback dashboard.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// -----------------------------------------------------------------------------
// Feedback entity (main feedback items)
// -----------------------------------------------------------------------------
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "feedback")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub source: String,
    pub source_id: Option<String>,
    pub user_email: Option<String>,
    pub user_name: Option<String>,
    pub content: String,
    pub url: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub status: String,
    pub assigned_to: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<Json>,

    #[sea_orm(has_many)]
    pub comments: HasMany<super::feedback_comment::Entity>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::feedback_comment::Entity")]
    Comments,
}

impl Related<super::feedback_comment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Comments.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

// -----------------------------------------------------------------------------
// FeedbackComment entity
// -----------------------------------------------------------------------------
pub mod feedback_comment {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
    #[sea_orm(table_name = "feedback_comments")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub feedback_id: Uuid,
        pub author: String,
        pub comment: String,
        pub created_at: DateTimeWithTimeZone,

        #[sea_orm(belongs_to, from = "feedback_id", to = "id")]
        pub feedback: HasOne<super::Entity>,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::Entity",
            from = "Column::FeedbackId",
            to = "super::Column::Id"
        )]
        Feedback,
    }

    impl Related<super::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Feedback.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}
