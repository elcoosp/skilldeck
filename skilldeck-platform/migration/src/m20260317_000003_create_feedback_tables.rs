//! Migration: create feedback and feedback_comments tables for the Feedback Dashboard.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Feedback table
        manager
            .create_table(
                Table::create()
                    .table(Feedback::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Feedback::Id).uuid().not_null().primary_key(), // No default – generate UUID in Rust
                    )
                    .col(ColumnDef::new(Feedback::Source).string().not_null())
                    .col(ColumnDef::new(Feedback::SourceId).string())
                    .col(ColumnDef::new(Feedback::UserEmail).string())
                    .col(ColumnDef::new(Feedback::UserName).string())
                    .col(ColumnDef::new(Feedback::Content).text().not_null())
                    .col(ColumnDef::new(Feedback::Url).text())
                    .col(
                        ColumnDef::new(Feedback::CreatedAt)
                            .timestamp() // SQLite compatible
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Feedback::Status)
                            .string()
                            .not_null()
                            .default("new"),
                    )
                    .col(ColumnDef::new(Feedback::AssignedTo).string())
                    .col(ColumnDef::new(Feedback::Tags).json()) // Store as JSON
                    .col(ColumnDef::new(Feedback::Metadata).json())
                    .to_owned(),
            )
            .await?;

        // Feedback comments table
        manager
            .create_table(
                Table::create()
                    .table(FeedbackComment::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(FeedbackComment::Id)
                            .uuid()
                            .not_null()
                            .primary_key(), // No default
                    )
                    .col(
                        ColumnDef::new(FeedbackComment::FeedbackId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(FeedbackComment::Author).string().not_null())
                    .col(ColumnDef::new(FeedbackComment::Comment).text().not_null())
                    .col(
                        ColumnDef::new(FeedbackComment::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_feedback_comment_feedback")
                            .from(FeedbackComment::Table, FeedbackComment::FeedbackId)
                            .to(Feedback::Table, Feedback::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(FeedbackComment::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Feedback::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(Iden)]
enum Feedback {
    Table,
    Id,
    Source,
    SourceId,
    UserEmail,
    UserName,
    Content,
    Url,
    CreatedAt,
    Status,
    AssignedTo,
    Tags,
    Metadata,
}

#[derive(Iden)]
enum FeedbackComment {
    Table,
    Id,
    FeedbackId,
    Author,
    Comment,
    CreatedAt,
}
