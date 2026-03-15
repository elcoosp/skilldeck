//! Initial platform schema.
//!
//! Creates all tables for the Core, Preferences, and Growth domains.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // ── Core: users ───────────────────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).uuid().not_null().primary_key())
                    .col(
                        ColumnDef::new(Users::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Users::LastSeen).timestamp_with_time_zone())
                    .to_owned(),
            )
            .await?;

        // ── Core: api_keys ────────────────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(ApiKeys::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ApiKeys::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(ApiKeys::UserId).uuid().not_null())
                    .col(ColumnDef::new(ApiKeys::KeyHash).string().not_null())
                    .col(
                        ColumnDef::new(ApiKeys::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-api-keys-user-id")
                            .from(ApiKeys::Table, ApiKeys::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Preferences: user_preferences ────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(UserPreferences::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(UserPreferences::UserId)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(UserPreferences::Email).string())
                    .col(
                        ColumnDef::new(UserPreferences::EmailVerified)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(UserPreferences::VerificationToken).string())
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
                        ColumnDef::new(UserPreferences::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UserPreferences::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-user-preferences-user-id")
                            .from(UserPreferences::Table, UserPreferences::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Growth: referral_codes ────────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(ReferralCodes::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ReferralCodes::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ReferralCodes::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(ReferralCodes::Code)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(ReferralCodes::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ReferralCodes::Uses)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(ReferralCodes::MaxUses)
                            .integer()
                            .not_null()
                            .default(10),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-referral-codes-user-id")
                            .from(ReferralCodes::Table, ReferralCodes::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Growth: referral_signups ──────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(ReferralSignups::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ReferralSignups::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ReferralSignups::CodeId).uuid().not_null())
                    .col(ColumnDef::new(ReferralSignups::ReferredEmail).string())
                    .col(ColumnDef::new(ReferralSignups::ReferredIp).string())
                    .col(
                        ColumnDef::new(ReferralSignups::SignedUpAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ReferralSignups::ConvertedAt).timestamp_with_time_zone())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-referral-signups-code-id")
                            .from(ReferralSignups::Table, ReferralSignups::CodeId)
                            .to(ReferralCodes::Table, ReferralCodes::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Growth: activity_events ───────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(ActivityEvents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ActivityEvents::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(ActivityEvents::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(ActivityEvents::EventType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ActivityEvents::Metadata)
                            .json()
                            .not_null()
                            .default("{}"),
                    )
                    .col(
                        ColumnDef::new(ActivityEvents::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-activity-events-user-id")
                            .from(ActivityEvents::Table, ActivityEvents::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Growth: nudge_templates ───────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(NudgeTemplates::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(NudgeTemplates::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(NudgeTemplates::Name).string().not_null())
                    .col(ColumnDef::new(NudgeTemplates::Subject).string().not_null())
                    .col(ColumnDef::new(NudgeTemplates::BodyHtml).text().not_null())
                    .col(ColumnDef::new(NudgeTemplates::CtaLabel).string())
                    .col(ColumnDef::new(NudgeTemplates::CtaAction).string())
                    .col(ColumnDef::new(NudgeTemplates::WinTheme).string())
                    .col(
                        ColumnDef::new(NudgeTemplates::Active)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .col(
                        ColumnDef::new(NudgeTemplates::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Growth: pending_nudges ────────────────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(PendingNudges::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(PendingNudges::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(PendingNudges::UserId).uuid().not_null())
                    .col(ColumnDef::new(PendingNudges::Message).text().not_null())
                    .col(ColumnDef::new(PendingNudges::CtaLabel).string())
                    .col(ColumnDef::new(PendingNudges::CtaAction).string())
                    .col(
                        ColumnDef::new(PendingNudges::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(PendingNudges::DeliveredAt).timestamp_with_time_zone())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-pending-nudges-user-id")
                            .from(PendingNudges::Table, PendingNudges::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        for table in [
            PendingNudges::Table.into_iden(),
            NudgeTemplates::Table.into_iden(),
            ActivityEvents::Table.into_iden(),
            ReferralSignups::Table.into_iden(),
            ReferralCodes::Table.into_iden(),
            UserPreferences::Table.into_iden(),
            ApiKeys::Table.into_iden(),
            Users::Table.into_iden(),
        ] {
            manager
                .drop_table(Table::drop().table(table).if_exists().to_owned())
                .await?;
        }
        Ok(())
    }
}

#[derive(Iden)] enum Users { Table, Id, CreatedAt, LastSeen }
#[derive(Iden)] enum ApiKeys { Table, Id, UserId, KeyHash, CreatedAt }
#[derive(Iden)] enum UserPreferences { Table, UserId, Email, EmailVerified, VerificationToken, NudgeFrequency, NudgeOptOut, NotificationChannels, ThemePreference, Timezone, AnalyticsOptIn, CreatedAt, UpdatedAt }
#[derive(Iden)] enum ReferralCodes { Table, Id, UserId, Code, CreatedAt, Uses, MaxUses }
#[derive(Iden)] enum ReferralSignups { Table, Id, CodeId, ReferredEmail, ReferredIp, SignedUpAt, ConvertedAt }
#[derive(Iden)] enum ActivityEvents { Table, Id, UserId, EventType, Metadata, CreatedAt }
#[derive(Iden)] enum NudgeTemplates { Table, Id, Name, Subject, BodyHtml, CtaLabel, CtaAction, WinTheme, Active, CreatedAt }
#[derive(Iden)] enum PendingNudges { Table, Id, UserId, Message, CtaLabel, CtaAction, CreatedAt, DeliveredAt }
