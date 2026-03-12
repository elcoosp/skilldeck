mod commands;

use tauri_specta::{collect, Builder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Create Specta Builder with collected commands
    let builder = Builder::new().commands(collect![commands::greet]);

    // 2. Export Typescript bindings (only in debug/dev builds)
    #[cfg(debug_assertions)]
    builder
        .export("../src/lib/bindings.ts") // Path relative to Cargo.toml
        .expect("Failed to export typescript bindings");

    // 3. Build Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(builder.invoke_handler()) // <--- Use Specta's handler
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
