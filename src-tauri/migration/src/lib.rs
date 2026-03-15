//! Migration registry.

use sea_orm_migration::prelude::*;

mod m20260313_000001_initial;
mod m20260314_000002_add_user_preferences;
mod m20260315_000003_add_platform_growth_tables;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260313_000001_initial::Migration),
            Box::new(m20260314_000002_add_user_preferences::Migration),
            Box::new(m20260315_000003_add_platform_growth_tables::Migration),
        ]
    }
}
