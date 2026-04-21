use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct Document {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn open_document(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn save_document(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let config_path = get_config_dir(&app)?.join("recent_files.json");
    if config_path.exists() {
        let data = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read recent files: {}", e))?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse recent files: {}", e))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn get_last_opened_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config_path = get_config_dir(&app)?.join("last_opened.txt");
    if config_path.exists() {
        let path = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read last opened: {}", e))?;
        Ok(Some(path.trim().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_last_opened_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let config_dir = get_config_dir(&app)?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    fs::write(config_dir.join("last_opened.txt"), path)
        .map_err(|e| format!("Failed to save last opened: {}", e))
}

fn get_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {}", e))?;
    Ok(path)
}
