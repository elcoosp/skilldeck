use migration::{Migrator, MigratorTrait};
use sea_orm::Database;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle();
            tauri::async_runtime::spawn(async move {
                // Get app data directory
                let app_dir = app.path().app_data_dir().expect("Failed to get app dir");
                std::fs::create_dir_all(&app_dir).expect("Failed to create app dir");

                let db_path = app_dir.join("skilldeck.db");
                let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

                println!("Database path: {}", db_path.display());

                // Connect to SQLite
                let db = Database::connect(&db_url)
                    .await
                    .expect("Failed to connect to DB");

                // Run migrations
                Migrator::up(&db, None)
                    .await
                    .expect("Failed to run migrations");

                println!("Migrations completed successfully");
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
