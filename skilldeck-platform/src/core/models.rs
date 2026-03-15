//! Core domain SeaORM 2.0 entities.

pub mod users {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "users")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub created_at: DateTimeWithTimeZone,
        pub last_seen: Option<DateTimeWithTimeZone>,

        #[sea_orm(has_one)]
        pub preferences: HasOne<crate::preferences::models::user_preferences::Entity>,
        #[sea_orm(has_many)]
        pub api_keys: HasMany<crate::core::models::api_keys::Entity>,
        #[sea_orm(has_many)]
        pub referral_codes: HasMany<crate::growth::models::referral_codes::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod api_keys {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "api_keys")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub user_id: Uuid,
        /// Argon2id hash of the raw API key.
        pub key_hash: String,
        pub created_at: DateTimeWithTimeZone,

        #[sea_orm(belongs_to, from = "user_id", to = "id")]
        pub user: HasOne<crate::core::models::users::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}
