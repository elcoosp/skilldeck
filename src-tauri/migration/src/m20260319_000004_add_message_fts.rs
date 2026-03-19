//! Migration: create messages_fts FTS5 virtual table and triggers.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create FTS5 virtual table for messages content.
        // We'll store the message content and reference the original message id.
        let sql = r#"
            CREATE VIRTUAL TABLE messages_fts USING fts5(content, message_id UNINDEXED);

            -- Trigger after insert on messages
            CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
                INSERT INTO messages_fts(rowid, content, message_id) VALUES (new.id, new.content, new.id);
            END;

            -- Trigger after update on messages (if content changes)
            CREATE TRIGGER messages_au AFTER UPDATE OF content ON messages BEGIN
                UPDATE messages_fts SET content = new.content WHERE rowid = new.id;
            END;

            -- Trigger after delete on messages
            CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
                DELETE FROM messages_fts WHERE rowid = old.id;
            END;

            -- Initial population
            INSERT INTO messages_fts(rowid, content, message_id) SELECT id, content, id FROM messages;
        "#;

        manager.get_connection().execute_unprepared(sql).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let sql = r#"
            DROP TABLE IF EXISTS messages_fts;
            DROP TRIGGER IF EXISTS messages_ai;
            DROP TRIGGER IF EXISTS messages_au;
            DROP TRIGGER IF EXISTS messages_ad;
        "#;
        manager.get_connection().execute_unprepared(sql).await?;
        Ok(())
    }
}
