//! Database connection management.
//!
//! Handles SQLite initialization, WAL mode, PRAGMAs, and migration execution.

use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, Statement};
use sea_orm_migration::migrator::MigratorTrait;
use std::time::Duration;
use tracing::info;

use crate::CoreError;
use migration::Migrator;

/// Opens a SQLite database, applies PRAGMAs for WAL + safety, and optionally
/// runs pending migrations.
pub async fn open_db(url: &str, run_migrations: bool) -> Result<DatabaseConnection, CoreError> {
    let db_url = if url == ":memory:" {
        "sqlite::memory:".to_owned()
    } else {
        format!("sqlite://{}?mode=rwc", url)
    };

    let mut opts = ConnectOptions::new(db_url);
    opts.max_connections(5)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(30))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Some(Duration::from_secs(300)))
        .max_lifetime(Some(Duration::from_secs(1800)))
        .sqlx_logging(false);

    info!(
        "Connecting to database: {}",
        if url == ":memory:" { "memory" } else { url }
    );

    let db = Database::connect(opts)
        .await
        .map_err(|e| CoreError::DatabaseConnection {
            message: format!("Failed to connect: {e}"),
        })?;

    apply_pragmas(&db).await?;
    info!("Database connection established with WAL mode");

    if run_migrations {
        info!("Running database migrations...");
        Migrator::up(&db, None)
            .await
            .map_err(|e| CoreError::DatabaseMigration {
                message: format!("Migration failed: {e}"),
            })?;
        info!("Database migrations completed");
    }

    Ok(db)
}

/// Applies all required SQLite PRAGMAs after connection.
async fn apply_pragmas(db: &DatabaseConnection) -> Result<(), CoreError> {
    let pragmas = [
        "PRAGMA journal_mode=WAL",
        "PRAGMA foreign_keys=ON",
        "PRAGMA busy_timeout=5000",
        "PRAGMA synchronous=NORMAL",
        "PRAGMA cache_size=-64000",
        "PRAGMA temp_store=MEMORY",
    ];

    for pragma in &pragmas {
        db.execute_raw(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            pragma.to_string(),
        ))
        .await
        .map_err(|e| CoreError::DatabaseQuery {
            message: format!("Failed to apply PRAGMA `{pragma}`: {e}"),
        })?;
    }

    Ok(())
}

/// Verifies the SQLite file is not corrupted.
pub async fn check_integrity(db: &DatabaseConnection) -> Result<(), CoreError> {
    let result = db
        .query_one_raw(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "PRAGMA integrity_check".to_owned(),
        ))
        .await
        .map_err(|e| CoreError::DatabaseQuery {
            message: format!("Integrity check query failed: {e}"),
        })?;

    if let Some(row) = result {
        let check: String = row.try_get("", "integrity_check").unwrap_or_default();
        if check != "ok" {
            return Err(CoreError::DatabaseQuery {
                message: format!("Database integrity check failed: {check}"),
            });
        }
    }

    Ok(())
}

/// Returns approximate row counts for the primary application tables.
/// Now uses entity-specific counts to avoid raw SQL.
pub async fn get_stats(
    db: &DatabaseConnection,
) -> Result<std::collections::HashMap<String, i64>, CoreError> {
    use sea_orm::EntityTrait;
    use skilldeck_models::{
        conversations::Entity as Conversations, mcp_servers::Entity as McpServers,
        messages::Entity as Messages, profiles::Entity as Profiles, skills::Entity as Skills,
        subagent_sessions::Entity as SubagentSessions, usage_events::Entity as UsageEvents,
        workflow_executions::Entity as WorkflowExecutions, workspaces::Entity as Workspaces,
    };

    let mut stats = std::collections::HashMap::new();

    // Count each table using the entity's count method.
    stats.insert(
        "conversations".to_string(),
        Conversations::find().count(db).await? as i64,
    );
    stats.insert(
        "messages".to_string(),
        Messages::find().count(db).await? as i64,
    );
    stats.insert(
        "profiles".to_string(),
        Profiles::find().count(db).await? as i64,
    );
    stats.insert("skills".to_string(), Skills::find().count(db).await? as i64);
    stats.insert(
        "mcp_servers".to_string(),
        McpServers::find().count(db).await? as i64,
    );
    stats.insert(
        "subagent_sessions".to_string(),
        SubagentSessions::find().count(db).await? as i64,
    );
    stats.insert(
        "workflow_executions".to_string(),
        WorkflowExecutions::find().count(db).await? as i64,
    );
    stats.insert(
        "workspaces".to_string(),
        Workspaces::find().count(db).await? as i64,
    );
    stats.insert(
        "usage_events".to_string(),
        UsageEvents::find().count(db).await? as i64,
    );

    Ok(stats)
}

// =============================================================================
// SqliteDatabase — traits::Database impl
// =============================================================================

use crate::traits;
use async_trait::async_trait;

/// Wraps a [`DatabaseConnection`] and implements [`traits::Database`].
pub struct SqliteDatabase {
    conn: DatabaseConnection,
}

impl SqliteDatabase {
    pub async fn open(url: &str) -> Result<Self, CoreError> {
        let conn = open_db(url, false).await?;
        Ok(Self { conn })
    }
}

#[async_trait]
impl traits::Database for SqliteDatabase {
    async fn connection(&self) -> Result<&DatabaseConnection, CoreError> {
        Ok(&self.conn)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn db_opens_in_memory() {
        let result = open_db(":memory:", true).await;
        assert!(result.is_ok(), "DB open failed: {:?}", result.err());
    }

    #[tokio::test]
    async fn wal_pragma_executes() {
        let db = open_db(":memory:", false).await.unwrap();
        let result = db
            .query_one_raw(Statement::from_string(
                sea_orm::DatabaseBackend::Sqlite,
                "PRAGMA journal_mode".to_owned(),
            ))
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn integrity_check_passes() {
        let db = open_db(":memory:", true).await.unwrap();
        assert!(check_integrity(&db).await.is_ok());
    }

    #[tokio::test]
    async fn migrations_create_profiles_table() {
        let db = open_db(":memory:", true).await.unwrap();
        let result = db
            .query_one_raw(Statement::from_string(
                sea_orm::DatabaseBackend::Sqlite,
                "SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'".to_owned(),
            ))
            .await;
        assert!(
            result.unwrap().is_some(),
            "profiles table should exist after migration"
        );
    }

    #[tokio::test]
    async fn stats_returns_known_tables() {
        let db = open_db(":memory:", true).await.unwrap();
        let stats = get_stats(&db).await.unwrap();
        assert!(stats.contains_key("profiles"));
        assert!(stats.contains_key("conversations"));
    }
}
