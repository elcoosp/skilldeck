//! Database abstraction trait.

use async_trait::async_trait;
use crate::CoreError;

/// Abstraction over the database connection.
///
/// This trait exists primarily to enable mock implementations in tests
/// and to decouple business logic from SeaORM specifics.
#[async_trait]
pub trait Database: Send + Sync + 'static {
    /// Return a reference to the underlying SeaORM connection.
    async fn connection(&self) -> Result<&sea_orm::DatabaseConnection, CoreError>;
}
