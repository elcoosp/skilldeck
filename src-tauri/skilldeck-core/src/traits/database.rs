//! Database trait for dependency inversion.

use async_trait::async_trait;
use sea_orm::DatabaseConnection;

use crate::CoreError;

#[async_trait]
pub trait Database: Send + Sync {
    async fn connection(&self) -> Result<&DatabaseConnection, CoreError>;

    /// Execute a raw SQL statement (uses execute_raw — SeaORM 2.0 API).
    async fn execute_raw(&self, sql: &str) -> Result<(), CoreError> {
        use sea_orm::ConnectionTrait;
        let conn = self.connection().await?;
        conn.execute_unprepared(sql)
            .await
            .map(|_| ())
            .map_err(|e| CoreError::DatabaseQuery {
                message: e.to_string(),
            })
    }
}

/// Default SeaORM database implementation.
pub struct SeaOrmDatabase {
    conn: DatabaseConnection,
}

impl SeaOrmDatabase {
    pub fn new(conn: DatabaseConnection) -> Self {
        Self { conn }
    }
}

#[async_trait]
impl Database for SeaOrmDatabase {
    async fn connection(&self) -> Result<&DatabaseConnection, CoreError> {
        Ok(&self.conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sea_orm_database_is_send_sync() {
        fn _assert_send_sync<T: Send + Sync>() {}
        _assert_send_sync::<SeaOrmDatabase>();
    }
}
