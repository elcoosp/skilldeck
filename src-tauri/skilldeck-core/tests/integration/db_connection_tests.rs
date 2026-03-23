// src-tauri/skilldeck-core/tests/unit/db_connection_tests.rs
use migration::Migrator;
use skilldeck_core::db::open_db;

#[tokio::test]
async fn db_migration_idempotent() {
    let db = open_db(":memory:", true).await.unwrap();
    // run migrations again, should not error
    Migrator::up(&db, None).await.unwrap();
}

#[tokio::test]
async fn stats_returns_known_tables() {
    let db = open_db(":memory:", true).await.unwrap();
    let stats = skilldeck_core::db::get_stats(&db).await.unwrap();
    assert!(stats.contains_key("profiles"));
    assert!(stats.contains_key("conversations"));
}
