mod commands;
mod menu;

use commands::{document, ai, config};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            menu::create_menu(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            document::open_document,
            document::save_document,
            document::get_recent_files,
            document::add_recent_file,
            document::get_last_opened_file,
            document::save_last_opened_file,
            ai::ai_process,
            ai::get_ai_config,
            ai::set_ai_config,
            config::get_app_config,
            config::set_app_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
