use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// AES-256-GCM encryption for API keys at rest
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use sha2::{Sha256, Digest};
use rand::RngCore;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AIProvider {
    pub id: String,
    pub name: String,
    pub default_model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AIConfigFile {
    provider: String,
    model: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfigResponse {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub providers: Vec<AIProvider>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfigInput {
    pub provider: String,
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
pub struct AIResponse {
    pub title: String,
    pub response: String,
}

/// Encrypted key entry stored on disk
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedEntry {
    ciphertext: String, // base64
    nonce: String,      // base64
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

fn get_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(dir)
}

fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join("ai-config.json"))
}

fn get_keys_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join(".ai-keys.enc"))
}

fn get_machine_key_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join(".machine-key"))
}

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM with a machine-local key
// ---------------------------------------------------------------------------

/// Derive a 256-bit encryption key.
/// Uses a per-install random seed stored in .machine-key (mode 600).
fn derive_key(app: &tauri::AppHandle) -> Result<[u8; 32], String> {
    let seed_path = get_machine_key_path(app)?;
    let seed = if seed_path.exists() {
        fs::read(&seed_path).map_err(|e| format!("Failed to read machine key: {}", e))?
    } else {
        let mut buf = [0u8; 64];
        rand::thread_rng().fill_bytes(&mut buf);
        fs::write(&seed_path, &buf)
            .map_err(|e| format!("Failed to write machine key: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&seed_path, fs::Permissions::from_mode(0o600));
        }
        buf.to_vec()
    };

    let mut hasher = Sha256::new();
    hasher.update(b"lexorium-api-key-encryption-v1");
    hasher.update(&seed);
    let result = hasher.finalize();
    Ok(result.into())
}

fn encrypt_value(key: &[u8; 32], plaintext: &str) -> Result<EncryptedEntry, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Cipher init failed: {}", e))?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok(EncryptedEntry {
        ciphertext: BASE64.encode(&ciphertext),
        nonce: BASE64.encode(nonce_bytes),
    })
}

fn decrypt_value(key: &[u8; 32], entry: &EncryptedEntry) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Cipher init failed: {}", e))?;
    let ciphertext = BASE64.decode(&entry.ciphertext)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    let nonce_bytes = BASE64.decode(&entry.nonce)
        .map_err(|e| format!("Base64 nonce decode failed: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext)
        .map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

// ---------------------------------------------------------------------------
// Key store (encrypted file)
// ---------------------------------------------------------------------------

fn read_key_store(app: &tauri::AppHandle) -> HashMap<String, EncryptedEntry> {
    let path = match get_keys_path(app) {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };
    if !path.exists() {
        return HashMap::new();
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn write_key_store(app: &tauri::AppHandle, store: &HashMap<String, EncryptedEntry>) -> Result<(), String> {
    let path = get_keys_path(app)?;
    let content = serde_json::to_string(store)
        .map_err(|e| format!("Failed to serialize key store: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write key store: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn get_api_key(app: &tauri::AppHandle, provider: &str) -> String {
    let key = match derive_key(app) {
        Ok(k) => k,
        Err(_) => return String::new(),
    };
    let store = read_key_store(app);
    match store.get(provider) {
        Some(entry) => decrypt_value(&key, entry).unwrap_or_default(),
        None => String::new(),
    }
}

fn set_api_key(app: &tauri::AppHandle, provider: &str, plaintext: &str) -> Result<(), String> {
    let key = derive_key(app)?;
    let mut store = read_key_store(app);
    if plaintext.is_empty() {
        store.remove(provider);
    } else {
        store.insert(provider.to_string(), encrypt_value(&key, plaintext)?);
    }
    write_key_store(app, &store)
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

fn default_providers() -> Vec<AIProvider> {
    vec![
        AIProvider { id: "openai".into(), name: "OpenAI".into(), default_model: "gpt-4o".into() },
        AIProvider { id: "anthropic".into(), name: "Anthropic".into(), default_model: "claude-sonnet-4-20250514".into() },
        AIProvider { id: "openrouter".into(), name: "OpenRouter".into(), default_model: "openai/gpt-4o".into() },
    ]
}

fn read_config_file(app: &tauri::AppHandle) -> Result<AIConfigFile, String> {
    let path = get_config_path(app)?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read AI config: {}", e))?;
        Ok(serde_json::from_str::<AIConfigFile>(&content).unwrap_or(AIConfigFile {
            provider: "openai".into(),
            model: String::new(),
        }))
    } else {
        Ok(AIConfigFile {
            provider: "openai".into(),
            model: String::new(),
        })
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_ai_config(app: tauri::AppHandle) -> Result<AIConfigResponse, String> {
    let file_config = read_config_file(&app)?;
    let api_key = get_api_key(&app, &file_config.provider);

    Ok(AIConfigResponse {
        provider: file_config.provider,
        model: file_config.model,
        api_key,
        providers: default_providers(),
    })
}

#[tauri::command]
pub fn set_ai_config(app: tauri::AppHandle, config: AIConfigInput) -> Result<(), String> {
    set_api_key(&app, &config.provider, &config.api_key)?;

    let file_config = AIConfigFile {
        provider: config.provider,
        model: config.model,
    };
    let path = get_config_path(&app)?;
    let content = serde_json::to_string_pretty(&file_config)
        .map_err(|e| format!("Failed to serialize AI config: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write AI config: {}", e))?;

    log::info!("AI config saved (API key encrypted at rest)");
    Ok(())
}

#[tauri::command]
pub async fn ai_process(
    app: tauri::AppHandle,
    prompt: String,
    content: String,
    title: Option<String>,
) -> Result<AIResponse, String> {
    log::info!("ai_process called — prompt={}, content_len={}, title={:?}", prompt.len(), content.len(), title);

    let config = read_config_file(&app)?;
    log::info!("ai_process provider={}, model={}", config.provider, config.model);

    let api_key = get_api_key(&app, &config.provider);
    log::info!("ai_process api_key present={}, len={}", !api_key.is_empty(), api_key.len());

    if api_key.is_empty() {
        return Err("No API key configured. Open Settings to add one.".into());
    }

    let system = if prompt.is_empty() {
        "You are a helpful assistant. Analyze the input based on these rules:\n\n\
        For code, return in this format:\n\
        [A clear explanation]\n\n\
        ```[language]\n\
        [Formatted code]\n\
        ```\n\n\
        Rules:\n\
        1. For code: Use proper language tags (javascript, python, etc)\n\
        2. For code: Show it only once, properly formatted\n\
        3. For questions/requests: Just give a direct, natural response\n\
        4. No code blocks if input isn't code\n\
        For text/questions:\n\
        1. If asked to analyze/explain: provide your analysis\n\
        2. If asked to improve/modify: provide the improved version\n\
        3. If asked to generate: provide the generated text\n\
        4. Include relevant parts of the original text when improving or modifying\n\
        5. Use markdown formatting when appropriate".to_string()
    } else {
        prompt
    };

    let user_msg = match &title {
        Some(t) if !t.is_empty() => format!("Title: {}\n\n{}", t, content),
        _ => content.clone(),
    };

    let response_text = match config.provider.as_str() {
        "openai" | "openrouter" => {
            call_openai_compatible(&config, &api_key, &system, &user_msg).await?
        }
        "anthropic" => {
            call_anthropic(&config, &api_key, &system, &user_msg).await?
        }
        other => return Err(format!("Unknown provider: {}", other)),
    };

    log::info!("ai_process success — response_len={}", response_text.len());

    // Generate a title if none was provided
    let final_title = match &title {
        Some(t) if !t.is_empty() => t.clone(),
        _ => {
            let title_prompt = "Generate a concise title (max 5 words) that describes the main purpose. Return ONLY the title, with no extra text, no 'Title:' prefix, and no formatting.";
            match config.provider.as_str() {
                "openai" | "openrouter" => {
                    call_openai_compatible(&config, &api_key, title_prompt, &content).await
                        .unwrap_or_default()
                }
                "anthropic" => {
                    call_anthropic(&config, &api_key, title_prompt, &content).await
                        .unwrap_or_default()
                }
                _ => String::new(),
            }
        }
    };

    Ok(AIResponse {
        title: final_title,
        response: response_text,
    })
}

// ---------------------------------------------------------------------------
// Provider API calls
// ---------------------------------------------------------------------------

async fn call_openai_compatible(
    config: &AIConfigFile,
    api_key: &str,
    system: &str,
    user_msg: &str,
) -> Result<String, String> {
    let base_url = if config.provider == "openrouter" {
        "https://openrouter.ai/api/v1"
    } else {
        "https://api.openai.com/v1"
    };

    let model = if config.model.is_empty() {
        if config.provider == "openrouter" { "openai/gpt-4o" } else { "gpt-4o" }.to_string()
    } else {
        config.model.clone()
    };

    let client = reqwest::Client::new();
    let mut req = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json");

    if config.provider == "openrouter" {
        req = req.header("HTTP-Referer", "https://github.com/antnsn/Lexorium");
    }

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_msg }
        ],
        "temperature": 0.7
    });

    let resp = req.json(&body).send().await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, text));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in API response".into())
}

async fn call_anthropic(
    config: &AIConfigFile,
    api_key: &str,
    system: &str,
    user_msg: &str,
) -> Result<String, String> {
    let model = if config.model.is_empty() {
        "claude-sonnet-4-20250514".to_string()
    } else {
        config.model.clone()
    };

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [
            { "role": "user", "content": user_msg }
        ]
    });

    let resp = reqwest::Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, text));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    data["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in API response".into())
}
