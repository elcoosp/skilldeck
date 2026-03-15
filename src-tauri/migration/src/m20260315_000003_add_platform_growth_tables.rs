//! Migration: local nudge delivery cache.
//!
//! Stores a minimal record of which platform nudges have been shown to the
//! user so the poller can avoid re-showing them after a restart even if the
//! server hasn't yet received the delivery confirmation.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(LocalNudgeCache::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(LocalNudgeCache::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(LocalNudgeCache::PlatformNudgeId)
                            .uuid()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(LocalNudgeCache::ShownAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(LocalNudgeCache::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum LocalNudgeCache {
    Table,
    Id,
    PlatformNudgeId,
    ShownAt,
}
