//! Local user-preferences entity — SeaORM 2.0 format.
//!
//! Stores the platform credentials (user-id + hashed API key reference) and
//! UI preferences that live in the desktop SQLite database.  The raw API key
//! is **never** persisted here; only the `platform_user_id` UUID is stored so
//! we can look up the actual secret in the OS keychain at runtime.

use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "user_preferences")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// UUID issued by the SkillDeck Platform on first registration.
    pub platform_user_id: Uuid,
    /// The API-key is stored in the OS keychain; this flag signals that a key
    /// has been stored so the app knows to retrieve it.
    pub platform_key_stored: bool,
    /// Platform base URL (allows pointing to self-hosted instances).
    pub platform_url: Option<String>,
    /// Nudge delivery frequency: "daily" | "weekly" | "important_only"
    pub nudge_frequency: String,
    /// Whether the user has opted out of nudges entirely.
    pub nudge_opt_out: bool,
    /// JSON array of enabled notification channels, e.g. `["in-app","email"]`.
    pub notification_channels: Json,
    /// UI theme: "system" | "light" | "dark"
    pub theme_preference: String,
    /// IANA timezone string, e.g. "Europe/Paris". Nullable = use system default.
    pub timezone: Option<String>,
    /// Whether the user has opted in to anonymous analytics.
    pub analytics_opt_in: bool,
    /// Whether the platform feature flag is enabled for this installation.
    pub platform_features_enabled: bool,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

impl ActiveModelBehavior for ActiveModel {}
