//! Initial migration: all 39+ database tables for SkillDeck v1.
//! Includes core tables, MCP, profiles, skills, workflows, analytics,
//! UI state, sync, plus user preferences, nudge cache, registry skills cache,
//! and queued messages.
//!
//! Uses SeaORM 2.0 migration API and ActiveModel for seed data.

use chrono::Utc;
use sea_orm::{ActiveModelTrait, Iden, Set};
use sea_orm_migration::{prelude::*, schema::*};
use skilldeck_models::*;
use uuid::Uuid;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // =====================================================================
        // CORE TABLES
        // =====================================================================

        // workspaces
        manager
            .create_table(
                Table::create()
                    .table(Workspaces::Table)
                    .if_not_exists()
                    .col(uuid(Workspaces::Id).primary_key())
                    .col(string(Workspaces::Path).not_null().unique_key())
                    .col(string(Workspaces::Name).not_null())
                    .col(string(Workspaces::ProjectType).null())
                    .col(boolean(Workspaces::IsOpen).not_null().default(false))
                    .col(timestamp_with_time_zone(Workspaces::LastOpenedAt).null())
                    .col(
                        timestamp_with_time_zone(Workspaces::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // profiles
        manager
            .create_table(
                Table::create()
                    .table(Profiles::Table)
                    .if_not_exists()
                    .col(uuid(Profiles::Id).primary_key())
                    .col(string(Profiles::Name).not_null())
                    .col(string(Profiles::Description).null())
                    .col(string(Profiles::SystemPrompt).null())
                    .col(string(Profiles::ModelProvider).not_null().default("claude"))
                    .col(
                        string(Profiles::ModelId)
                            .not_null()
                            .default("claude-sonnet-4-5"),
                    )
                    .col(json(Profiles::ModelParams).null())
                    .col(boolean(Profiles::IsDefault).not_null().default(false))
                    .col(
                        timestamp_with_time_zone(Profiles::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Profiles::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )

                    .col(timestamp_with_time_zone(Profiles::DeletedAt).null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .table(Profiles::Table)
                    .name("idx_profiles_is_default")
                    .col(Profiles::IsDefault)
                    .to_owned(),
            )
            .await?;

        // user_preferences (new)
        manager
            .create_table(
                Table::create()
                    .table(UserPreferences::Table)
                    .if_not_exists()
                    .col(uuid(UserPreferences::Id).primary_key())
                    .col(uuid(UserPreferences::PlatformUserId).not_null())
                    .col(
                        boolean(UserPreferences::PlatformKeyStored)
                            .not_null()
                            .default(false),
                    )
                    .col(string(UserPreferences::PlatformUrl).null())
                    .col(
                        string(UserPreferences::NudgeFrequency)
                            .not_null()
                            .default("important_only"),
                    )
                    .col(
                        boolean(UserPreferences::NudgeOptOut)
                            .not_null()
                            .default(false),
                    )
                    .col(
                        json(UserPreferences::NotificationChannels)
                            .not_null()
                            .default("[\"in-app\"]"),
                    )
                    .col(
                        string(UserPreferences::ThemePreference)
                            .not_null()
                            .default("system"),
                    )
                    .col(string(UserPreferences::Timezone).null())
                    .col(
                        boolean(UserPreferences::AnalyticsOptIn)
                            .not_null()
                            .default(false),
                    )
                    .col(
                        boolean(UserPreferences::PlatformFeaturesEnabled)
                            .not_null()
                            .default(true),
                    )
                    .col(timestamp_with_time_zone(UserPreferences::CreatedAt).not_null())
                    .col(timestamp_with_time_zone(UserPreferences::UpdatedAt).not_null())
                    .to_owned(),
            )
            .await?;

        // registry_skills cache (new)
        manager
            .create_table(
                Table::create()
                    .table(RegistrySkills::Table)
                    .if_not_exists()
                    .col(uuid(RegistrySkills::Id).primary_key())
                    .col(string(RegistrySkills::RegistryId).not_null().unique_key())
                    .col(string(RegistrySkills::Name).not_null())
                    .col(text(RegistrySkills::Description).not_null())
                    .col(string(RegistrySkills::Source).not_null())
                    .col(string(RegistrySkills::SourceUrl).null())
                    .col(string(RegistrySkills::Version).null())
                    .col(string(RegistrySkills::Author).null())
                    .col(string(RegistrySkills::License).null())
                    .col(json_binary(RegistrySkills::Tags).null())
                    .col(string(RegistrySkills::Category).null())
                    .col(json_binary(RegistrySkills::LintWarnings).null())
                    .col(integer(RegistrySkills::SecurityScore).not_null().default(5))
                    .col(integer(RegistrySkills::QualityScore).not_null().default(5))
                    .col(
                        string(RegistrySkills::MetadataSource)
                            .not_null()
                            .default("author"),
                    )
                    .col(text(RegistrySkills::Content).not_null())
                    .col(timestamp_with_time_zone(RegistrySkills::SyncedAt).not_null())
                    .to_owned(),
            )
            .await?;

        // conversations
        manager
            .create_table(
                Table::create()
                    .table(Conversations::Table)
                    .if_not_exists()
                    .col(uuid(Conversations::Id).primary_key())
                    .col(uuid(Conversations::ProfileId).not_null())
                    .col(string(Conversations::Title).null())
                    .col(uuid(Conversations::WorkspaceId).null())
                    .col(string(Conversations::Status).not_null().default("active"))
                    .col(
                        timestamp_with_time_zone(Conversations::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Conversations::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone(Conversations::ArchivedAt).null())
                    .col(boolean(Conversations::Pinned).not_null().default(false)) // <-- added
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversations_profile_id")
                            .from(Conversations::Table, Conversations::ProfileId)
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversations_workspace_id")
                            .from(Conversations::Table, Conversations::WorkspaceId)
                            .to(Workspaces::Table, Workspaces::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            ("idx_conversations_profile_id", Conversations::ProfileId),
            ("idx_conversations_workspace_id", Conversations::WorkspaceId),
            ("idx_conversations_status", Conversations::Status),
        ] {
            manager
                .create_index(
                    Index::create()
                        .table(Conversations::Table)
                        .name(name)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // messages
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .if_not_exists()
                    .col(uuid(Messages::Id).primary_key())
                    .col(uuid(Messages::ConversationId).not_null())
                    .col(uuid(Messages::ParentId).null())
                    .col(uuid(Messages::BranchId).null())
                    .col(string(Messages::Role).not_null())
                    .col(text(Messages::Content).not_null())
                    .col(json(Messages::Metadata).null())
                    .col(integer(Messages::InputTokens).null())
                    .col(json(Messages::ContextItems))
                    .col(integer(Messages::OutputTokens).null())
                    .col(integer(Messages::CacheReadTokens).null())
                    .col(integer(Messages::CacheWriteTokens).null())
                    .col(
                        timestamp_with_time_zone(Messages::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_messages_conversation_id")
                            .from(Messages::Table, Messages::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_messages_parent_id")
                            .from(Messages::Table, Messages::ParentId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            ("idx_messages_conversation_id", Messages::ConversationId),
            ("idx_messages_parent_id", Messages::ParentId),
        ] {
            manager
                .create_index(
                    Index::create()
                        .table(Messages::Table)
                        .name(name)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // conversation_branches
        manager
            .create_table(
                Table::create()
                    .table(ConversationBranches::Table)
                    .if_not_exists()
                    .col(uuid(ConversationBranches::Id).primary_key())
                    .col(uuid(ConversationBranches::ConversationId).not_null())
                    .col(uuid(ConversationBranches::ParentMessageId).not_null())
                    .col(string(ConversationBranches::Name).null())
                    .col(
                        string(ConversationBranches::Status)
                            .not_null()
                            .default("active"),
                    )
                    .col(
                        timestamp_with_time_zone(ConversationBranches::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone(ConversationBranches::MergedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_branches_conversation_id")
                            .from(
                                ConversationBranches::Table,
                                ConversationBranches::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_branches_parent_message_id")
                            .from(
                                ConversationBranches::Table,
                                ConversationBranches::ParentMessageId,
                            )
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // QUEUED MESSAGES TABLE (NEW)
        // =====================================================================
        manager
            .create_table(
                Table::create()
                    .table(QueuedMessages::Table)
                    .if_not_exists()
                    .col(uuid(QueuedMessages::Id).primary_key())
                    .col(uuid(QueuedMessages::ConversationId).not_null())
                    .col(text(QueuedMessages::Content).not_null())
                    .col(json(QueuedMessages::ContextItems))
                    .col(integer(QueuedMessages::Position).not_null())
                    .col(
                        timestamp_with_time_zone(QueuedMessages::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(QueuedMessages::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_queued_messages_conversation_id")
                            .from(QueuedMessages::Table, QueuedMessages::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .table(QueuedMessages::Table)
                    .name("idx_queued_conversation_position")
                    .col(QueuedMessages::ConversationId)
                    .col(QueuedMessages::Position)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // MCP TABLES
        // =====================================================================

        // mcp_servers
        manager
            .create_table(
                Table::create()
                    .table(McpServers::Table)
                    .if_not_exists()
                    .col(uuid(McpServers::Id).primary_key())
                    .col(string(McpServers::Name).not_null().unique_key())
                    .col(string(McpServers::Transport).not_null())
                    .col(json(McpServers::ConfigJson).not_null())
                    .col(
                        string(McpServers::Status)
                            .not_null()
                            .default("disconnected"),
                    )
                    .col(text(McpServers::LastError).null())
                    .col(integer(McpServers::ErrorCount).not_null().default(0))
                    .col(timestamp_with_time_zone(McpServers::LastConnectedAt).null())
                    .col(
                        timestamp_with_time_zone(McpServers::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(McpServers::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .table(McpServers::Table)
                    .name("idx_mcp_servers_status")
                    .col(McpServers::Status)
                    .to_owned(),
            )
            .await?;

        // mcp_tool_cache
        manager
            .create_table(
                Table::create()
                    .table(McpToolCache::Table)
                    .if_not_exists()
                    .col(uuid(McpToolCache::Id).primary_key())
                    .col(uuid(McpToolCache::McpServerId).not_null())
                    .col(string(McpToolCache::ToolName).not_null())
                    .col(text(McpToolCache::Description).null())
                    .col(json(McpToolCache::InputSchema).not_null())
                    .col(
                        timestamp_with_time_zone(McpToolCache::CachedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_mcp_tool_cache_mcp_server_id")
                            .from(McpToolCache::Table, McpToolCache::McpServerId)
                            .to(McpServers::Table, McpServers::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // PROFILE CONFIGURATION TABLES
        // =====================================================================

        // profile_mcps
        manager
            .create_table(
                Table::create()
                    .table(ProfileMcps::Table)
                    .if_not_exists()
                    .col(uuid(ProfileMcps::Id).primary_key())
                    .col(uuid(ProfileMcps::ProfileId).not_null())
                    .col(uuid(ProfileMcps::McpServerId).not_null())
                    .col(boolean(ProfileMcps::Enabled).not_null().default(true))
                    .col(json(ProfileMcps::Overrides).null())
                    .col(
                        timestamp_with_time_zone(ProfileMcps::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_profile_mcps_profile_id")
                            .from(ProfileMcps::Table, ProfileMcps::ProfileId)
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_profile_mcps_mcp_server_id")
                            .from(ProfileMcps::Table, ProfileMcps::McpServerId)
                            .to(McpServers::Table, McpServers::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // profile_skills
        manager
            .create_table(
                Table::create()
                    .table(ProfileSkills::Table)
                    .if_not_exists()
                    .col(uuid(ProfileSkills::Id).primary_key())
                    .col(uuid(ProfileSkills::ProfileId).not_null())
                    .col(string(ProfileSkills::SkillName).not_null())
                    .col(string(ProfileSkills::SkillSource).not_null())
                    .col(boolean(ProfileSkills::Enabled).not_null().default(true))
                    .col(
                        timestamp_with_time_zone(ProfileSkills::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_profile_skills_profile_id")
                            .from(ProfileSkills::Table, ProfileSkills::ProfileId)
                            .to(Profiles::Table, Profiles::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // conversation_mcp_overrides
        manager
            .create_table(
                Table::create()
                    .table(ConversationMcpOverrides::Table)
                    .if_not_exists()
                    .col(uuid(ConversationMcpOverrides::Id).primary_key())
                    .col(uuid(ConversationMcpOverrides::ConversationId).not_null())
                    .col(uuid(ConversationMcpOverrides::McpServerId).not_null())
                    .col(boolean(ConversationMcpOverrides::Enabled).not_null())
                    .col(json(ConversationMcpOverrides::Overrides).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_mcp_overrides_conversation_id")
                            .from(
                                ConversationMcpOverrides::Table,
                                ConversationMcpOverrides::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_mcp_overrides_mcp_server_id")
                            .from(
                                ConversationMcpOverrides::Table,
                                ConversationMcpOverrides::McpServerId,
                            )
                            .to(McpServers::Table, McpServers::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // conversation_skill_overrides
        manager
            .create_table(
                Table::create()
                    .table(ConversationSkillOverrides::Table)
                    .if_not_exists()
                    .col(uuid(ConversationSkillOverrides::Id).primary_key())
                    .col(uuid(ConversationSkillOverrides::ConversationId).not_null())
                    .col(string(ConversationSkillOverrides::SkillName).not_null())
                    .col(boolean(ConversationSkillOverrides::Enabled).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_skill_overrides_conversation_id")
                            .from(
                                ConversationSkillOverrides::Table,
                                ConversationSkillOverrides::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // conversation_model_override
        manager
            .create_table(
                Table::create()
                    .table(ConversationModelOverride::Table)
                    .if_not_exists()
                    .col(uuid(ConversationModelOverride::Id).primary_key())
                    .col(
                        uuid(ConversationModelOverride::ConversationId)
                            .not_null()
                            .unique_key(),
                    )
                    .col(string(ConversationModelOverride::ModelProvider).not_null())
                    .col(string(ConversationModelOverride::ModelId).not_null())
                    .col(json(ConversationModelOverride::ModelParams).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_model_override_conversation_id")
                            .from(
                                ConversationModelOverride::Table,
                                ConversationModelOverride::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // SKILLS TABLES
        // =====================================================================

        // skills
        manager
            .create_table(
                Table::create()
                    .table(Skills::Table)
                    .if_not_exists()
                    .col(uuid(Skills::Id).primary_key())
                    .col(string(Skills::Name).not_null())
                    .col(string(Skills::Source).not_null())
                    .col(text(Skills::Description).null())
                    .col(text(Skills::ContentMd).not_null())
                    .col(json(Skills::Manifest).null())
                    .col(string(Skills::DiskPath).null())
                    .col(string(Skills::ContentHash).null())
                    .col(boolean(Skills::IsShadowed).not_null().default(false))
                    .col(
                        timestamp_with_time_zone(Skills::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Skills::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .table(Skills::Table)
                    .name("idx_skills_name_source")
                    .col(Skills::Name)
                    .col(Skills::Source)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // skill_source_dirs
        manager
            .create_table(
                Table::create()
                    .table(SkillSourceDirs::Table)
                    .if_not_exists()
                    .col(uuid(SkillSourceDirs::Id).primary_key())
                    .col(string(SkillSourceDirs::SourceType).not_null())
                    .col(string(SkillSourceDirs::Path).not_null())
                    .col(integer(SkillSourceDirs::Priority).not_null())
                    .col(boolean(SkillSourceDirs::Enabled).not_null().default(true))
                    .col(
                        timestamp_with_time_zone(SkillSourceDirs::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // registry_skills cache (new)
        manager
            .create_table(
                Table::create()
                    .table(RegistrySkills::Table)
                    .if_not_exists()
                    .col(uuid(RegistrySkills::Id).primary_key())
                    .col(string(RegistrySkills::RegistryId).not_null().unique_key())
                    .col(string(RegistrySkills::Name).not_null())
                    .col(text(RegistrySkills::Description).not_null())
                    .col(string(RegistrySkills::Source).not_null())
                    .col(string(RegistrySkills::SourceUrl).null())
                    .col(string(RegistrySkills::Version).null())
                    .col(string(RegistrySkills::Author).null())
                    .col(string(RegistrySkills::License).null())
                    .col(json_binary(RegistrySkills::Tags).null())
                    .col(string(RegistrySkills::Category).null())
                    .col(json_binary(RegistrySkills::LintWarnings).null())
                    .col(integer(RegistrySkills::SecurityScore).not_null().default(5))
                    .col(integer(RegistrySkills::QualityScore).not_null().default(5))
                    .col(
                        string(RegistrySkills::MetadataSource)
                            .not_null()
                            .default("author"),
                    )
                    .col(text(RegistrySkills::Content).not_null())
                    .col(timestamp_with_time_zone(RegistrySkills::SyncedAt).not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_registry_skills_name")
                    .table(RegistrySkills::Table)
                    .col(RegistrySkills::Name)
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // WORKFLOW TABLES
        // =====================================================================

        // workflow_executions
        manager
            .create_table(
                Table::create()
                    .table(WorkflowExecutions::Table)
                    .if_not_exists()
                    .col(uuid(WorkflowExecutions::Id).primary_key())
                    .col(uuid(WorkflowExecutions::ConversationId).not_null())
                    .col(string(WorkflowExecutions::Name).not_null())
                    .col(string(WorkflowExecutions::Pattern).not_null())
                    .col(json(WorkflowExecutions::DefinitionJson).not_null())
                    .col(
                        string(WorkflowExecutions::Status)
                            .not_null()
                            .default("pending"),
                    )
                    .col(timestamp_with_time_zone(WorkflowExecutions::StartedAt).null())
                    .col(timestamp_with_time_zone(WorkflowExecutions::CompletedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_workflow_executions_conversation_id")
                            .from(
                                WorkflowExecutions::Table,
                                WorkflowExecutions::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // workflow_definitions (new table for saved workflows)
        manager
            .create_table(
                Table::create()
                    .table(WorkflowDefinitions::Table)
                    .if_not_exists()
                    .col(uuid(WorkflowDefinitions::Id).primary_key())
                    .col(string(WorkflowDefinitions::Name).not_null())
                    .col(json(WorkflowDefinitions::DefinitionJson).not_null())
                    .col(
                        timestamp_with_time_zone(WorkflowDefinitions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(WorkflowDefinitions::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // subagent_sessions
        manager
            .create_table(
                Table::create()
                    .table(SubagentSessions::Table)
                    .if_not_exists()
                    .col(uuid(SubagentSessions::Id).primary_key())
                    .col(uuid(SubagentSessions::ParentConversationId).not_null())
                    .col(uuid(SubagentSessions::ParentMessageId).not_null())
                    .col(uuid(SubagentSessions::WorkflowStepId).null())
                    .col(string(SubagentSessions::TaskDescription).not_null())
                    .col(
                        string(SubagentSessions::Status)
                            .not_null()
                            .default("running"),
                    )
                    .col(text(SubagentSessions::ResultSummary).null())
                    .col(
                        timestamp_with_time_zone(SubagentSessions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone(SubagentSessions::CompletedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_subagent_sessions_parent_conversation_id")
                            .from(
                                SubagentSessions::Table,
                                SubagentSessions::ParentConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_subagent_sessions_parent_message_id")
                            .from(SubagentSessions::Table, SubagentSessions::ParentMessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // workflow_steps
        manager
            .create_table(
                Table::create()
                    .table(WorkflowSteps::Table)
                    .if_not_exists()
                    .col(uuid(WorkflowSteps::Id).primary_key())
                    .col(uuid(WorkflowSteps::ExecutionId).not_null())
                    .col(string(WorkflowSteps::StepName).not_null())
                    .col(string(WorkflowSteps::Status).not_null().default("pending"))
                    .col(uuid(WorkflowSteps::SubagentSessionId).null())
                    .col(integer(WorkflowSteps::TokensUsed).null())
                    .col(text(WorkflowSteps::Result).null())
                    .col(text(WorkflowSteps::Error).null())
                    .col(timestamp_with_time_zone(WorkflowSteps::StartedAt).null())
                    .col(timestamp_with_time_zone(WorkflowSteps::CompletedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_workflow_steps_execution_id")
                            .from(WorkflowSteps::Table, WorkflowSteps::ExecutionId)
                            .to(WorkflowExecutions::Table, WorkflowExecutions::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // CONTENT TABLES
        // =====================================================================

        // artifacts
        manager
            .create_table(
                Table::create()
                    .table(Artifacts::Table)
                    .if_not_exists()
                    .col(uuid(Artifacts::Id).primary_key())
                    .col(uuid(Artifacts::MessageId).not_null())
                    .col(string(Artifacts::Type).not_null())
                    .col(string(Artifacts::Name).not_null())
                    .col(text(Artifacts::Content).not_null())
                    .col(string(Artifacts::Language).null())
                    .col(
                        timestamp_with_time_zone(Artifacts::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_artifacts_message_id")
                            .from(Artifacts::Table, Artifacts::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // attachments
        manager
            .create_table(
                Table::create()
                    .table(Attachments::Table)
                    .if_not_exists()
                    .col(uuid(Attachments::Id).primary_key())
                    .col(uuid(Attachments::MessageId).not_null())
                    .col(string(Attachments::Filename).not_null())
                    .col(string(Attachments::MimeType).not_null())
                    .col(big_integer(Attachments::SizeBytes).not_null())
                    .col(string(Attachments::StoragePath).not_null())
                    .col(
                        timestamp_with_time_zone(Attachments::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_attachments_message_id")
                            .from(Attachments::Table, Attachments::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // templates
        manager
            .create_table(
                Table::create()
                    .table(Templates::Table)
                    .if_not_exists()
                    .col(uuid(Templates::Id).primary_key())
                    .col(string(Templates::Name).not_null())
                    .col(string(Templates::Category).null())
                    .col(text(Templates::Content).not_null())
                    .col(json(Templates::Variables).null())
                    .col(
                        timestamp_with_time_zone(Templates::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // folders
        manager
            .create_table(
                Table::create()
                    .table(Folders::Table)
                    .if_not_exists()
                    .col(uuid(Folders::Id).primary_key())
                    .col(string(Folders::Name).not_null())
                    .col(uuid(Folders::ParentId).null())
                    .col(
                        timestamp_with_time_zone(Folders::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // tags
        manager
            .create_table(
                Table::create()
                    .table(Tags::Table)
                    .if_not_exists()
                    .col(uuid(Tags::Id).primary_key())
                    .col(string(Tags::Name).not_null().unique_key())
                    .col(string(Tags::Color).null())
                    .col(
                        timestamp_with_time_zone(Tags::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // conversation_tags (junction)
        manager
            .create_table(
                Table::create()
                    .table(ConversationTags::Table)
                    .if_not_exists()
                    .col(uuid(ConversationTags::Id).primary_key())
                    .col(uuid(ConversationTags::ConversationId).not_null())
                    .col(uuid(ConversationTags::TagId).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_tags_conversation_id")
                            .from(ConversationTags::Table, ConversationTags::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_tags_tag_id")
                            .from(ConversationTags::Table, ConversationTags::TagId)
                            .to(Tags::Table, Tags::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // prompts
        manager
            .create_table(
                Table::create()
                    .table(Prompts::Table)
                    .if_not_exists()
                    .col(uuid(Prompts::Id).primary_key())
                    .col(string(Prompts::Name).not_null())
                    .col(text(Prompts::Content).not_null())
                    .col(string(Prompts::Category).null())
                    .col(
                        timestamp_with_time_zone(Prompts::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Prompts::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // prompt_variables
        manager
            .create_table(
                Table::create()
                    .table(PromptVariables::Table)
                    .if_not_exists()
                    .col(uuid(PromptVariables::Id).primary_key())
                    .col(uuid(PromptVariables::PromptId).not_null())
                    .col(string(PromptVariables::Name).not_null())
                    .col(text(PromptVariables::Description).null())
                    .col(string(PromptVariables::DefaultValue).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_prompt_variables_prompt_id")
                            .from(PromptVariables::Table, PromptVariables::PromptId)
                            .to(Prompts::Table, Prompts::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // ANALYTICS TABLES
        // =====================================================================

        // usage_events
        manager
            .create_table(
                Table::create()
                    .table(UsageEvents::Table)
                    .if_not_exists()
                    .col(uuid(UsageEvents::Id).primary_key())
                    .col(uuid(UsageEvents::ConversationId).null())
                    .col(string(UsageEvents::EventType).not_null())
                    .col(string(UsageEvents::ModelProvider).null())
                    .col(string(UsageEvents::ModelId).null())
                    .col(integer(UsageEvents::InputTokens).null())
                    .col(integer(UsageEvents::OutputTokens).null())
                    .col(integer(UsageEvents::CacheReadTokens).null())
                    .col(integer(UsageEvents::CacheWriteTokens).null())
                    .col(big_integer(UsageEvents::CostCents).null())
                    .col(
                        timestamp_with_time_zone(UsageEvents::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_usage_events_conversation_id")
                            .from(UsageEvents::Table, UsageEvents::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            (
                "idx_usage_events_conversation_id",
                UsageEvents::ConversationId,
            ),
            ("idx_usage_events_created_at", UsageEvents::CreatedAt),
        ] {
            manager
                .create_index(
                    Index::create()
                        .table(UsageEvents::Table)
                        .name(name)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // model_pricing
        manager
            .create_table(
                Table::create()
                    .table(ModelPricing::Table)
                    .if_not_exists()
                    .col(uuid(ModelPricing::Id).primary_key())
                    .col(string(ModelPricing::ModelProvider).not_null())
                    .col(string(ModelPricing::ModelId).not_null())
                    .col(big_integer(ModelPricing::InputCostPer1kTokens).not_null())
                    .col(big_integer(ModelPricing::OutputCostPer1kTokens).not_null())
                    .col(big_integer(ModelPricing::CacheReadCostPer1kTokens).null())
                    .col(big_integer(ModelPricing::CacheWriteCostPer1kTokens).null())
                    .col(
                        timestamp_with_time_zone(ModelPricing::ValidFrom)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // UI STATE TABLES
        // =====================================================================

        // workspace_state
        manager
            .create_table(
                Table::create()
                    .table(WorkspaceState::Table)
                    .if_not_exists()
                    .col(uuid(WorkspaceState::Id).primary_key())
                    .col(uuid(WorkspaceState::WorkspaceId).not_null().unique_key())
                    .col(json(WorkspaceState::ExpandedFolders).null())
                    .col(json(WorkspaceState::SortOrder).null())
                    .col(
                        timestamp_with_time_zone(WorkspaceState::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_workspace_state_workspace_id")
                            .from(WorkspaceState::Table, WorkspaceState::WorkspaceId)
                            .to(Workspaces::Table, Workspaces::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // conversation_ui_state
        manager
            .create_table(
                Table::create()
                    .table(ConversationUiState::Table)
                    .if_not_exists()
                    .col(uuid(ConversationUiState::Id).primary_key())
                    .col(
                        uuid(ConversationUiState::ConversationId)
                            .not_null()
                            .unique_key(),
                    )
                    .col(uuid(ConversationUiState::ActiveBranchId).null())
                    .col(integer(ConversationUiState::ScrollPosition).null())
                    .col(json(ConversationUiState::PanelSizes).null())
                    .col(
                        timestamp_with_time_zone(ConversationUiState::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_conversation_ui_state_conversation_id")
                            .from(
                                ConversationUiState::Table,
                                ConversationUiState::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // bookmarks
        manager
            .create_table(
                Table::create()
                    .table(Bookmarks::Table)
                    .if_not_exists()
                    .col(uuid(Bookmarks::Id).primary_key())
                    .col(uuid(Bookmarks::MessageId).not_null())
                    .col(string(Bookmarks::Note).null())
                    .col(
                        timestamp_with_time_zone(Bookmarks::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_bookmarks_message_id")
                            .from(Bookmarks::Table, Bookmarks::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // EXPORT & SEARCH TABLES
        // =====================================================================

        // export_jobs
        manager
            .create_table(
                Table::create()
                    .table(ExportJobs::Table)
                    .if_not_exists()
                    .col(uuid(ExportJobs::Id).primary_key())
                    .col(string(ExportJobs::Type).not_null())
                    .col(json(ExportJobs::ConversationIds).not_null())
                    .col(string(ExportJobs::Status).not_null().default("pending"))
                    .col(string(ExportJobs::OutputPath).null())
                    .col(text(ExportJobs::Error).null())
                    .col(timestamp_with_time_zone(ExportJobs::StartedAt).null())
                    .col(timestamp_with_time_zone(ExportJobs::CompletedAt).null())
                    .col(
                        timestamp_with_time_zone(ExportJobs::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // message_embeddings
        manager
            .create_table(
                Table::create()
                    .table(MessageEmbeddings::Table)
                    .if_not_exists()
                    .col(uuid(MessageEmbeddings::Id).primary_key())
                    .col(uuid(MessageEmbeddings::MessageId).not_null().unique_key())
                    .col(blob(MessageEmbeddings::Embedding).null())
                    .col(string(MessageEmbeddings::Model).null())
                    .col(timestamp_with_time_zone(MessageEmbeddings::GeneratedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_message_embeddings_message_id")
                            .from(MessageEmbeddings::Table, MessageEmbeddings::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // SYNC TABLES (v2 stub)
        // =====================================================================

        // sync_state
        manager
            .create_table(
                Table::create()
                    .table(SyncState::Table)
                    .if_not_exists()
                    .col(uuid(SyncState::Id).primary_key())
                    .col(string(SyncState::BackendType).not_null())
                    .col(string(SyncState::Status).not_null().default("disconnected"))
                    .col(timestamp_with_time_zone(SyncState::LastSyncAt).null())
                    .col(text(SyncState::LastError).null())
                    .col(
                        timestamp_with_time_zone(SyncState::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // sync_watermarks
        manager
            .create_table(
                Table::create()
                    .table(SyncWatermarks::Table)
                    .if_not_exists()
                    .col(uuid(SyncWatermarks::Id).primary_key())
                    .col(uuid(SyncWatermarks::SyncStateId).not_null())
                    .col(string(SyncWatermarks::TableName).not_null())
                    .col(big_integer(SyncWatermarks::LastSyncedVersion).not_null())
                    .col(
                        timestamp_with_time_zone(SyncWatermarks::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_sync_watermarks_sync_state_id")
                            .from(SyncWatermarks::Table, SyncWatermarks::SyncStateId)
                            .to(SyncState::Table, SyncState::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // local_nudge_cache (new)
        manager
            .create_table(
                Table::create()
                    .table(LocalNudgeCache::Table)
                    .if_not_exists()
                    .col(uuid(LocalNudgeCache::Id).primary_key())
                    .col(
                        uuid(LocalNudgeCache::PlatformNudgeId)
                            .not_null()
                            .unique_key(),
                    )
                    .col(timestamp_with_time_zone(LocalNudgeCache::ShownAt).not_null())
                    .to_owned(),
            )
            .await?;

        // =====================================================================
        // SEED DATA USING ACTIVE MODEL
        // =====================================================================

        let db = manager.get_connection();

        // 1. Default profile
        let default_profile = profiles::ActiveModel {
            id: Set(Uuid::nil()),
            name: Set("Default".to_owned()),
            description: Set(None),
            model_provider: Set("claude".to_owned()),
            model_id: Set("claude-sonnet-4-5".to_owned()),
            model_params: Set(None),
            system_prompt: Set(None),
            is_default: Set(true),
            created_at: Set(Utc::now().into()),
            updated_at: Set(Utc::now().into()),
            deleted_at: Set(None),
        };
        default_profile.insert(db).await?;

        // 2. Skill source directories
        let source_dirs = [
            ("workspace", ".skilldeck/skills", 1_i32),
            ("personal", "~/.skilldeck/skills", 2),
            ("superpowers", "~/.skilldeck/superpowers", 3),
            ("marketplace", "~/.skilldeck/marketplace", 4),
        ];

        for (idx, (source_type, path, priority)) in source_dirs.iter().enumerate() {
            let id = Uuid::parse_str(&format!("00000000-0000-0000-0000-00000000000{}", idx + 1))
                .unwrap();
            let source_dir = skill_source_dirs::ActiveModel {
                id: Set(id),
                source_type: Set((*source_type).to_owned()),
                path: Set((*path).to_owned()),
                priority: Set(*priority),
                enabled: Set(true),
                created_at: Set(Utc::now().into()),
            };
            source_dir.insert(db).await?;
        }

        // 3. Model pricing
        let pricing = [
            (
                "claude",
                "claude-sonnet-4-5",
                300_i64,
                1500_i64,
                30_i64,
                375_i64,
            ),
            ("claude", "claude-opus-4", 1500, 7500, 150, 1875),
            ("openai", "gpt-4o", 250, 1000, 125, 250),
            ("openai", "gpt-4o-mini", 15, 60, 8, 15),
        ];

        for (i, (provider, model, input_c, output_c, cache_r, cache_w)) in
            pricing.iter().enumerate()
        {
            let id =
                Uuid::parse_str(&format!("10000000-0000-0000-0000-00000000000{}", i + 1)).unwrap();
            let pricing = model_pricing::ActiveModel {
                id: Set(id),
                model_provider: Set((*provider).to_owned()),
                model_id: Set((*model).to_owned()),
                input_cost_per_1k_tokens: Set(*input_c),
                output_cost_per_1k_tokens: Set(*output_c),
                cache_read_cost_per_1k_tokens: Set(Some(*cache_r)),
                cache_write_cost_per_1k_tokens: Set(Some(*cache_w)),
                valid_from: Set(Utc::now().into()),
            };
            pricing.insert(db).await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop in reverse FK dependency order (new tables inserted appropriately)
        let tables = [
            "sync_watermarks",
            "local_nudge_cache",
            "sync_state",
            "message_embeddings",
            "export_jobs",
            "bookmarks",
            "conversation_ui_state",
            "workspace_state",
            "model_pricing",
            "usage_events",
            "prompt_variables",
            "prompts",
            "attachments",
            "conversation_tags",
            "tags",
            "folders",
            "templates",
            "artifacts",
            "workflow_steps",
            "subagent_sessions",
            "workflow_definitions",
            "workflow_executions",
            "skill_source_dirs",
            "registry_skills",
            "skills",
            "mcp_servers",
            "mcp_tool_cache",
            "conversation_model_override",
            "conversation_skill_overrides",
            "conversation_mcp_overrides",
            "profile_skills",
            "profile_mcps",
            "queued_messages", // <-- new table added
            "tool_call_events",
            "conversation_branches",
            "messages",
            "conversations",
            "user_preferences",
            "workspaces",
            "profiles",
        ];
        for table in &tables {
            manager
                .drop_table(Table::drop().table(Alias::new(*table)).to_owned())
                .await?;
        }

        Ok(())
    }
}

// =============================================================================
// Table / Column DeriveIden enums
// =============================================================================

#[derive(DeriveIden)]
enum Profiles {
    Table,
    Id,
    Name,
    SystemPrompt,
    Description,
    ModelProvider,
    ModelId,
    ModelParams,
    IsDefault,
    CreatedAt,
    UpdatedAt,
    DeletedAt
}

#[derive(DeriveIden)]
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

#[derive(DeriveIden)]
enum Workspaces {
    Table,
    Id,
    Path,
    Name,
    ProjectType,
    IsOpen,
    LastOpenedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Conversations {
    Table,
    Id,
    ProfileId,
    Title,
    WorkspaceId,
    Status,
    CreatedAt,
    UpdatedAt,
    ArchivedAt,
    Pinned, // <-- added
}

#[derive(DeriveIden)]
enum Messages {
    Table,
    Id,
    ContextItems,
    ConversationId,
    ParentId,
    BranchId,
    Role,
    Content,
    Metadata,
    InputTokens,
    OutputTokens,
    CacheReadTokens,
    CacheWriteTokens,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ConversationBranches {
    Table,
    Id,
    ConversationId,
    ParentMessageId,
    Name,
    Status,
    CreatedAt,
    MergedAt,
}

#[derive(DeriveIden)]
enum QueuedMessages {
    Table,
    Id,
    ContextItems,
    ConversationId,
    Content,
    Position,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ToolCallEvents {
    Table,
    Id,
    MessageId,
    CallId,
    ToolName,
    InputJson,
    Status,
    ResultJson,
    Error,
    RequiresApproval,
    AutoApproved,
    CreatedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum ProfileMcps {
    Table,
    Id,
    ProfileId,
    McpServerId,
    Enabled,
    Overrides,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ProfileSkills {
    Table,
    Id,
    ProfileId,
    SkillName,
    SkillSource,
    Enabled,
    CreatedAt,
}

#[derive(DeriveIden)]
enum McpServers {
    Table,
    Id,
    Name,
    Transport,
    ConfigJson,
    Status,
    LastError,
    ErrorCount,
    LastConnectedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum McpToolCache {
    Table,
    Id,
    McpServerId,
    ToolName,
    Description,
    InputSchema,
    CachedAt,
}

#[derive(DeriveIden)]
enum ConversationMcpOverrides {
    Table,
    Id,
    ConversationId,
    McpServerId,
    Enabled,
    Overrides,
}

#[derive(DeriveIden)]
enum ConversationSkillOverrides {
    Table,
    Id,
    ConversationId,
    SkillName,
    Enabled,
}

#[derive(DeriveIden)]
enum ConversationModelOverride {
    Table,
    Id,
    ConversationId,
    ModelProvider,
    ModelId,
    ModelParams,
}

#[derive(DeriveIden)]
enum Skills {
    Table,
    Id,
    Name,
    Source,
    Description,
    ContentMd,
    Manifest,
    DiskPath,
    ContentHash,
    IsShadowed,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SkillSourceDirs {
    Table,
    Id,
    SourceType,
    Path,
    Priority,
    Enabled,
    CreatedAt,
}

#[derive(DeriveIden)]
enum RegistrySkills {
    Table,
    Id,
    RegistryId,
    Name,
    Description,
    Source,
    SourceUrl,
    Version,
    Author,
    License,
    Tags,
    Category,
    LintWarnings,
    SecurityScore,
    QualityScore,
    MetadataSource,
    Content,
    SyncedAt,
}

#[derive(DeriveIden)]
enum WorkflowExecutions {
    Table,
    Id,
    ConversationId,
    Name,
    Pattern,
    DefinitionJson,
    Status,
    StartedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum WorkflowDefinitions {
    Table,
    Id,
    Name,
    DefinitionJson,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum WorkflowSteps {
    Table,
    Id,
    ExecutionId,
    StepName,
    Status,
    SubagentSessionId,
    TokensUsed,
    Result,
    Error,
    StartedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum SubagentSessions {
    Table,
    Id,
    ParentConversationId,
    ParentMessageId,
    WorkflowStepId,
    TaskDescription,
    Status,
    ResultSummary,
    CreatedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum Artifacts {
    Table,
    Id,
    MessageId,
    Type,
    Name,
    Content,
    Language,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Attachments {
    Table,
    Id,
    MessageId,
    Filename,
    MimeType,
    SizeBytes,
    StoragePath,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Templates {
    Table,
    Id,
    Name,
    Category,
    Content,
    Variables,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Folders {
    Table,
    Id,
    Name,
    ParentId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Tags {
    Table,
    Id,
    Name,
    Color,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ConversationTags {
    Table,
    Id,
    ConversationId,
    TagId,
}

#[derive(DeriveIden)]
enum Prompts {
    Table,
    Id,
    Name,
    Content,
    Category,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum PromptVariables {
    Table,
    Id,
    PromptId,
    Name,
    Description,
    DefaultValue,
}

#[derive(DeriveIden)]
enum UsageEvents {
    Table,
    Id,
    ConversationId,
    EventType,
    ModelProvider,
    ModelId,
    InputTokens,
    OutputTokens,
    CacheReadTokens,
    CacheWriteTokens,
    CostCents,
    CreatedAt,
}

#[derive(DeriveIden)]
enum WorkspaceState {
    Table,
    Id,
    WorkspaceId,
    ExpandedFolders,
    SortOrder,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ConversationUiState {
    Table,
    Id,
    ConversationId,
    ActiveBranchId,
    ScrollPosition,
    PanelSizes,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Bookmarks {
    Table,
    Id,
    MessageId,
    Note,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ExportJobs {
    Table,
    Id,
    Type,
    ConversationIds,
    Status,
    OutputPath,
    Error,
    StartedAt,
    CompletedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum MessageEmbeddings {
    Table,
    Id,
    MessageId,
    Embedding,
    Model,
    GeneratedAt,
}

#[derive(DeriveIden)]
enum SyncState {
    Table,
    Id,
    BackendType,
    Status,
    LastSyncAt,
    LastError,
    CreatedAt,
}

#[derive(DeriveIden)]
enum SyncWatermarks {
    Table,
    Id,
    SyncStateId,
    TableName,
    LastSyncedVersion,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum LocalNudgeCache {
    Table,
    Id,
    PlatformNudgeId,
    ShownAt,
}

// =============================================================================
// Manual Iden implementation for ModelPricing (SeaORM 2.0 style)
// =============================================================================
pub enum ModelPricing {
    Table,
    Id,
    ModelProvider,
    ModelId,
    InputCostPer1kTokens,
    OutputCostPer1kTokens,
    CacheReadCostPer1kTokens,
    CacheWriteCostPer1kTokens,
    ValidFrom,
}

impl Iden for ModelPricing {
    fn unquoted(&self) -> &str {
        match self {
            ModelPricing::Table => "model_pricing",
            ModelPricing::Id => "id",
            ModelPricing::ModelProvider => "model_provider",
            ModelPricing::ModelId => "model_id",
            ModelPricing::InputCostPer1kTokens => "input_cost_per_1k_tokens",
            ModelPricing::OutputCostPer1kTokens => "output_cost_per_1k_tokens",
            ModelPricing::CacheReadCostPer1kTokens => "cache_read_cost_per_1k_tokens",
            ModelPricing::CacheWriteCostPer1kTokens => "cache_write_cost_per_1k_tokens",
            ModelPricing::ValidFrom => "valid_from",
        }
    }
}
