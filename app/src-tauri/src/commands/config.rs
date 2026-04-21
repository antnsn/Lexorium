use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub font_size: u32,
}

#[tauri::command]
pub fn get_app_config() -> Result<AppConfig, String> {
    Ok(AppConfig {
        theme: "system".to_string(),
        font_size: 14,
    })
}

#[tauri::command]
pub fn set_app_config(_config: AppConfig) -> Result<(), String> {
    // Stub — will persist in Phase 5
    Ok(())
}
