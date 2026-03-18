// -----------------------------------------------------------------------------
// FeedbackComment entity – defined first so it's in scope for the main entity
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

        // Belongs-to relation – the foreign key in this table is "feedback_id"
        // and it references the "id" column in the feedback table.
        #[sea_orm(belongs_to, from = "feedback_id", to = "id")]
        pub feedback: HasOne<crate::feedback::models::feedback::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

// -----------------------------------------------------------------------------
// Feedback entity (main feedback items)
// -----------------------------------------------------------------------------
pub mod feedback {
    use sea_orm::entity::prelude::*;
    use serde::{Deserialize, Serialize};
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
        #[sea_orm(column_type = "Json")]
        pub tags: Option<Json>,
        pub metadata: Option<Json>,
        #[sea_orm(has_many)]
        pub comments: HasMany<crate::feedback::models::feedback_comment::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}
