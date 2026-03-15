//! Migration: add local `user_preferences` table (platform credentials + UX settings).

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserPreferences::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(UserPreferences::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::PlatformUserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::PlatformKeyStored)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(UserPreferences::PlatformUrl).string())
                    .col(
                        ColumnDef::new(UserPreferences::NudgeFrequency)
                            .string()
                            .not_null()
                            .default("important_only"),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::NudgeOptOut)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::NotificationChannels)
                            .json()
                            .not_null()
                            .default(r#"["in-app"]"#),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::ThemePreference)
                            .string()
                            .not_null()
                            .default("system"),
                    )
                    .col(ColumnDef::new(UserPreferences::Timezone).string())
                    .col(
                        ColumnDef::new(UserPreferences::AnalyticsOptIn)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::PlatformFeaturesEnabled)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserPreferences::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum UserPreferences {
    Table,
    Id,
    PlatformUserId,
    PlatformKeyStored,
    PlatformUrl,
    NudgeFrequency,
    NudgeOptOut,
    NotificationChannels,
    ThemePreference,
    Timezone,
    AnalyticsOptIn,
    PlatformFeaturesEnabled,
    CreatedAt,
    UpdatedAt,
}
