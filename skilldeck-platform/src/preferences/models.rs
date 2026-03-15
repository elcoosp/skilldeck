//! Preferences domain SeaORM 2.0 entities.

pub mod user_preferences {
    use sea_orm::entity::prelude::*;
    use serde::Serialize;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize)]
    #[sea_orm(table_name = "user_preferences")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub user_id: Uuid,
        pub email: Option<String>,
        pub email_verified: bool,
        pub verification_token: Option<String>,
        /// "daily" | "weekly" | "important_only"
        pub nudge_frequency: String,
        pub nudge_opt_out: bool,
        pub notification_channels: Json,
        /// "system" | "light" | "dark"
        pub theme_preference: String,
        pub timezone: Option<String>,
        pub analytics_opt_in: bool,
        pub created_at: DateTimeWithTimeZone,
        pub updated_at: DateTimeWithTimeZone,

        #[serde(skip)]
        #[sea_orm(belongs_to, from = "user_id", to = "id")]
        pub user: HasOne<crate::core::models::users::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}
