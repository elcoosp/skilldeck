//! Database connection helpers.

use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use sea_orm_migration::migrator::MigratorTrait;
use tracing::info;

pub async fn connect(database_url: &str) -> anyhow::Result<DatabaseConnection> {
    info!("Connecting to database: {database_url}");
    let mut opt = ConnectOptions::new(database_url.to_owned());
    opt.max_connections(20)
        .min_connections(2)
        .sqlx_logging(false);
    Ok(Database::connect(opt).await?)
}

pub async fn run_migrations(db: &DatabaseConnection) -> anyhow::Result<()> {
    migration::Migrator::up(db, None).await?;
    info!("Migrations applied");
    Ok(())
}
