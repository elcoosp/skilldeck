//! Growth domain SeaORM 2.0 entities.

pub mod referral_codes {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "referral_codes")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub user_id: Uuid,
        #[sea_orm(unique)]
        pub code: String,
        pub created_at: DateTimeWithTimeZone,
        pub uses: i32,
        pub max_uses: i32,

        #[sea_orm(belongs_to, from = "user_id", to = "id")]
        pub user: HasOne<crate::core::models::users::Entity>,
        #[sea_orm(has_many)]
        pub signups: HasMany<crate::growth::models::referral_signups::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod referral_signups {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "referral_signups")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub code_id: Uuid,
        pub referred_email: Option<String>,
        pub referred_ip: Option<String>,
        pub signed_up_at: DateTimeWithTimeZone,
        pub converted_at: Option<DateTimeWithTimeZone>,

        #[sea_orm(belongs_to, from = "code_id", to = "id")]
        pub referral_code: HasOne<crate::growth::models::referral_codes::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod activity_events {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "activity_events")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub user_id: Uuid,
        pub event_type: String,
        pub metadata: Json,
        pub created_at: DateTimeWithTimeZone,

        #[sea_orm(belongs_to, from = "user_id", to = "id")]
        pub user: HasOne<crate::core::models::users::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod nudge_templates {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "nudge_templates")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub name: String,
        pub subject: String,
        #[sea_orm(column_type = "Text")]
        pub body_html: String,
        pub cta_label: Option<String>,
        pub cta_action: Option<String>,
        /// "privacy" | "team_knowledge" | "intelligence"
        pub win_theme: Option<String>,
        pub active: bool,
        pub created_at: DateTimeWithTimeZone,
    }

    impl ActiveModelBehavior for ActiveModel {}
}

pub mod pending_nudges {
    use sea_orm::entity::prelude::*;

    #[sea_orm::model]
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "pending_nudges")]
    pub struct Model {
        #[sea_orm(primary_key, auto_increment = false)]
        pub id: Uuid,
        pub user_id: Uuid,
        pub message: String,
        pub cta_label: Option<String>,
        pub cta_action: Option<String>,
        pub created_at: DateTimeWithTimeZone,
        pub delivered_at: Option<DateTimeWithTimeZone>,

        #[sea_orm(belongs_to, from = "user_id", to = "id")]
        pub user: HasOne<crate::core::models::users::Entity>,
    }

    impl ActiveModelBehavior for ActiveModel {}
}
