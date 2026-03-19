//! Migration registry.

use sea_orm_migration::prelude::*;

mod m20260313_000001_initial;
mod m20260319_000004_add_message_fts; // new

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260313_000001_initial::Migration),
            Box::new(m20260319_000004_add_message_fts::Migration), // new
        ]
    }
}
