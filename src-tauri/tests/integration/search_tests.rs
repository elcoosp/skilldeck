use anyhow::Result;
use sea_orm::{DbBackend, Statement};
use skilldeck_core::db::open_db;
use skilldeck_models::messages;
use uuid::Uuid;

async fn setup_test_db() -> sea_orm::DatabaseConnection {
    let db = open_db(":memory:", true).await.unwrap();

    // Insert a test conversation
    let conv_id = Uuid::new_v4();
    let profile_id = Uuid::new_v4();

    sqlx::query("INSERT INTO conversations (id, profile_id, title, status, created_at, updated_at, pinned) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 0)")
        .bind(conv_id.to_string())
        .bind(profile_id.to_string())
        .bind("Test Conv")
        .bind("active")
        .execute(&db)
        .await
        .unwrap();

    // Insert some test messages
    let messages = vec![
        ("The quick brown fox jumps over the lazy dog", "user"),
        ("This is a test message about rust programming", "assistant"),
        ("Another message with some random text", "user"),
        ("I love eating pizza on Fridays", "assistant"),
    ];

    for (content, role) in messages {
        let msg_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        )
        .bind(msg_id.to_string())
        .bind(conv_id.to_string())
        .bind(role)
        .bind(content)
        .execute(&db)
        .await
        .unwrap();
    }

    db
}

#[tokio::test]
async fn test_fts5_search() -> Result<()> {
    let db = setup_test_db().await;

    // Wait a bit for FTS to index (SQLite is fast)
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    // Search for "fox"
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            r#"
            SELECT m.id, snippet(messages_fts, 0, '<mark>', '</mark>', '…', 20) as snippet
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.message_id
            WHERE messages_fts.content MATCH ?
            "#,
            ["fox".into()],
        ))
        .await?;

    assert_eq!(rows.len(), 1);
    let snippet: String = rows[0].try_get("", "snippet")?;
    assert!(snippet.contains("fox"));
    assert!(snippet.contains("<mark>fox</mark>"));

    // Search for "rust"
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "SELECT id, content FROM messages_fts WHERE content MATCH ?",
            ["rust".into()],
        ))
        .await?;

    assert_eq!(rows.len(), 1);
    let content: String = rows[0].try_get("", "content")?;
    assert!(content.contains("rust"));

    // Search for "pizza"
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "SELECT id FROM messages_fts WHERE content MATCH ?",
            ["pizza".into()],
        ))
        .await?;

    assert_eq!(rows.len(), 1);

    Ok(())
}

#[tokio::test]
async fn test_search_within_conversation() -> Result<()> {
    let db = setup_test_db().await;
    let conv_id = sqlx::query_scalar::<_, String>("SELECT id FROM conversations LIMIT 1")
        .fetch_one(&db)
        .await?;

    let rows = db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            r#"
            SELECT m.id
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.message_id
            WHERE messages_fts.content MATCH ? AND m.conversation_id = ?
            "#,
            ["fox".into(), conv_id.into()],
        ))
        .await?;

    assert_eq!(rows.len(), 1);

    // Search for a term not in this conversation
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            r#"
            SELECT m.id
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.message_id
            WHERE messages_fts.content MATCH ? AND m.conversation_id = ?
            "#,
            ["nonexistent".into(), conv_id.into()],
        ))
        .await?;

    assert_eq!(rows.len(), 0);

    Ok(())
}
