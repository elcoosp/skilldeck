//! E2E/demo provisioning.
//!
//! When the app runs with `--features e2e-testing` against a fresh (empty)
//! database, this module seeds exactly the state the demo needs so the app
//! boots into a usable workspace without driving the native folder picker:
//! one default profile and one open workspace at `SKILLDECK_DEMO_WORKSPACE`
//! (defaults to the process working directory).
//!
//! Every provisioning step is idempotent: with an existing database nothing
//! is changed, so the normal app data dir is never mutated in demo runs.
#![cfg(feature = "e2e-testing")]

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait,
    QueryFilter,
};
use std::path::PathBuf;
use tracing::warn;
use uuid::Uuid;

use skilldeck_models::profiles::{self, Entity as Profiles};
use skilldeck_models::workspaces::{self, Entity as Workspaces};

/// Default profile inserted on a fresh demo database.
const DEMO_PROFILE_NAME: &str = "Local (Ollama)";
const DEMO_PROFILE_PROVIDER: &str = "ollama";
const DEMO_PROFILE_MODEL: &str = "glm-5:cloud";

/// Insert a default profile when the profiles table is empty.
async fn ensure_default_profile(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    let existing = Profiles::find().count(db).await?;
    if existing > 0 {
        return Ok(());
    }
    let now = chrono::Utc::now().fixed_offset();
    let model = profiles::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(DEMO_PROFILE_NAME.to_string()),
        model_provider: Set(DEMO_PROFILE_PROVIDER.to_string()),
        model_id: Set(DEMO_PROFILE_MODEL.to_string()),
        is_default: Set(true),
        system_prompt: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
        deleted_at: Set(None),
        ..Default::default()
    };
    model.insert(db).await?;
    Ok(())
}

/// Open (create or mark open) the demo workspace at `SKILLDECK_DEMO_WORKSPACE`
/// when it is not already registered.
async fn ensure_workspace(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    let raw_path = std::env::var("SKILLDECK_DEMO_WORKSPACE")
        .map(PathBuf::from)
        .or_else(|_| std::env::current_dir())
        .unwrap_or_default();
    let path_buf = raw_path.canonicalize().unwrap_or(raw_path.clone());
    if !path_buf.exists() {
        warn!("SKILLDECK_DEMO_WORKSPACE does not exist, skipping provisioning: {path_buf:?}");
        return Ok(());
    }
    let path = path_buf.to_string_lossy().to_string();

    let existing = Workspaces::find()
        .filter(workspaces::Column::Path.eq(&path))
        .one(db)
        .await?;
    let now = chrono::Utc::now().fixed_offset();

    if let Some(row) = existing {
        let mut active: workspaces::ActiveModel = row.into();
        active.is_open = Set(true);
        active.last_opened_at = Set(Some(now));
        active.update(db).await?;
        return Ok(());
    }

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("workspace")
        .to_string();
    let model = workspaces::ActiveModel {
        id: Set(Uuid::new_v4()),
        path: Set(path),
        name: Set(name),
        project_type: Set(None),
        is_open: Set(true),
        created_at: Set(now),
        last_opened_at: Set(Some(now)),
        avatar_style: Set("linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)".to_string()),
        ..Default::default()
    };
    model.insert(db).await?;
    Ok(())
}

/// Seed a fresh database with the state the demo workflow expects. Idempotent.
pub async fn provision(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    ensure_default_profile(db).await?;
    ensure_workspace(db).await?;
    Ok(())
}