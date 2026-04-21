use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const MAX_RECENT_FILES: usize = 10;

#[tauri::command]
pub fn open_document(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn save_document(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let config_path = get_config_dir(&app)?.join("recent_files.json");
    if config_path.exists() {
        let data = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read recent files: {}", e))?;
        let files: Vec<String> = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse recent files: {}", e))?;
        // Only return files that still exist on disk
        Ok(files.into_iter().filter(|f| std::path::Path::new(f).exists()).collect())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn add_recent_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let config_dir = get_config_dir(&app)?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let config_path = config_dir.join("recent_files.json");
    let mut files: Vec<String> = if config_path.exists() {
        let data = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    // Remove if already present, then prepend
    files.retain(|f| f != &path);
    files.insert(0, path);
    files.truncate(MAX_RECENT_FILES);

    let json = serde_json::to_string_pretty(&files)
        .map_err(|e| format!("Failed to serialize recent files: {}", e))?;
    fs::write(&config_path, json)
        .map_err(|e| format!("Failed to save recent files: {}", e))
}

#[tauri::command]
pub fn get_last_opened_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config_path = get_config_dir(&app)?.join("last_opened.txt");
    if config_path.exists() {
        let path = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read last opened: {}", e))?;
        let trimmed = path.trim().to_string();
        if std::path::Path::new(&trimmed).exists() {
            Ok(Some(trimmed))
        } else {
            Ok(None)
        }
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
