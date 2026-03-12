mod commands;

// 1. Change 'collect' to 'collect_commands'
// 2. Add import for Typescript
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Use the new 'collect_commands!' macro
    let builder = Builder::new().commands(collect_commands![commands::greet]);

    // 2. Update export arguments: (Language, Path)
    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/lib/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(builder.invoke_handler())
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
