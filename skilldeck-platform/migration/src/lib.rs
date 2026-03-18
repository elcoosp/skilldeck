//! Migration registry for the SkillDeck Platform.

use sea_orm_migration::prelude::*;

mod m20260315_000001_create_platform_schema;
mod m20260316_000002_create_skill_tables;
mod m20260317_000003_create_feedback_tables;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260315_000001_create_platform_schema::Migration),
            Box::new(m20260316_000002_create_skill_tables::Migration),
            Box::new(m20260317_000003_create_feedback_tables::Migration),
        ]
    }
}
