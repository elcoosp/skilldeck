//! Migration: create skills and skill_sources tables for the platform registry.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Skills table
        manager
            .create_table(
                Table::create()
                    .table(Skills::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Skills::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Skills::Name).string().not_null())
                    .col(ColumnDef::new(Skills::Description).text().not_null())
                    .col(ColumnDef::new(Skills::Source).string().not_null())
                    .col(ColumnDef::new(Skills::SourceUrl).string())
                    .col(ColumnDef::new(Skills::Version).string())
                    .col(ColumnDef::new(Skills::Author).string())
                    .col(ColumnDef::new(Skills::License).string())
                    .col(ColumnDef::new(Skills::Compatibility).text())
                    .col(ColumnDef::new(Skills::AllowedTools).text())
                    .col(
                        ColumnDef::new(Skills::ContentHash)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Skills::Content).text().not_null())
                    .col(ColumnDef::new(Skills::LintWarnings).json_binary())
                    .col(ColumnDef::new(Skills::Tags).json_binary())
                    .col(ColumnDef::new(Skills::Category).string())
                    .col(ColumnDef::new(Skills::Embedding).blob(BlobSize::Long))
                    // UX: Trust scores used by TrustBadge component
                    .col(
                        ColumnDef::new(Skills::SecurityScore)
                            .integer()
                            .default(5),
                    )
                    .col(
                        ColumnDef::new(Skills::QualityScore)
                            .integer()
                            .default(5),
                    )
                    /// "author" | "llm_enrichment" — drives AI tag badge in UI
                    .col(
                        ColumnDef::new(Skills::MetadataSource)
                            .string()
                            .default("author"),
                    )
                    .col(ColumnDef::new(Skills::LastLintedAt).timestamp_with_time_zone())
                    .col(
                        ColumnDef::new(Skills::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Skills::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Unique index on (name, source) so the same skill name from two sources is allowed.
        manager
            .create_index(
                Index::create()
                    .name("idx_skills_name_source")
                    .table(Skills::Table)
                    .col(Skills::Name)
                    .col(Skills::Source)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // SkillSources table — registry source URLs crawled by the platform.
        manager
            .create_table(
                Table::create()
                    .table(SkillSources::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(SkillSources::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(SkillSources::SourceType)
                            .string()
                            .not_null(),
                    ) // "github_org" | "github_repo" | "url"
                    .col(
                        ColumnDef::new(SkillSources::Url)
                            .string()
                            .not_null()
                            .unique(),
                    )
                    .col(ColumnDef::new(SkillSources::Label).string())
                    .col(ColumnDef::new(SkillSources::LastCrawledAt).timestamp_with_time_zone())
                    .col(ColumnDef::new(SkillSources::IsEnabled).boolean().default(true))
                    .col(
                        ColumnDef::new(SkillSources::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Skills::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SkillSources::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(Iden)]
enum Skills {
    Table,
    Id,
    Name,
    Description,
    Source,
    SourceUrl,
    Version,
    Author,
    License,
    Compatibility,
    AllowedTools,
    ContentHash,
    Content,
    LintWarnings,
    Tags,
    Category,
    Embedding,
    SecurityScore,
    QualityScore,
    MetadataSource,
    LastLintedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
enum SkillSources {
    Table,
    Id,
    SourceType,
    Url,
    Label,
    LastCrawledAt,
    IsEnabled,
    CreatedAt,
}
