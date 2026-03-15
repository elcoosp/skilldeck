//! Migration: create the `registry_skills` cache table.
//!
//! This table stores skills fetched from the platform registry so the client
//! can search/browse them offline after the last sync.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(RegistrySkills::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RegistrySkills::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(RegistrySkills::RegistryId)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(RegistrySkills::Name).string().not_null())
                    .col(
                        ColumnDef::new(RegistrySkills::Description)
                            .text()
                            .not_null(),
                    )
                    .col(ColumnDef::new(RegistrySkills::Source).string().not_null())
                    .col(ColumnDef::new(RegistrySkills::SourceUrl).string())
                    .col(ColumnDef::new(RegistrySkills::Version).string())
                    .col(ColumnDef::new(RegistrySkills::Author).string())
                    .col(ColumnDef::new(RegistrySkills::License).string())
                    .col(ColumnDef::new(RegistrySkills::Tags).json_binary())
                    .col(ColumnDef::new(RegistrySkills::Category).string())
                    .col(ColumnDef::new(RegistrySkills::LintWarnings).json_binary())
                    .col(
                        ColumnDef::new(RegistrySkills::SecurityScore)
                            .integer()
                            .not_null()
                            .default(5),
                    )
                    .col(
                        ColumnDef::new(RegistrySkills::QualityScore)
                            .integer()
                            .not_null()
                            .default(5),
                    )
                    .col(
                        ColumnDef::new(RegistrySkills::MetadataSource)
                            .string()
                            .not_null()
                            .default("author"),
                    )
                    .col(ColumnDef::new(RegistrySkills::Content).text().not_null())
                    .col(
                        ColumnDef::new(RegistrySkills::SyncedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Index for fast name lookups.
        manager
            .create_index(
                Index::create()
                    .name("idx_registry_skills_name")
                    .table(RegistrySkills::Table)
                    .col(RegistrySkills::Name)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(RegistrySkills::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
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
