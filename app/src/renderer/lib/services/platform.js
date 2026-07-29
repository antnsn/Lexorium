/**
 * Platform abstraction layer.
 * Wraps Tauri invoke/events so Svelte components never import Electron or Tauri directly.
 * Falls back to no-ops when running in a plain browser (dev mode without backend).
 */

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Cache dynamic imports so each Tauri module loads once, not per call.
const tauriModules = {};
async function tauriImport(name, loader) {
  if (!tauriModules[name]) tauriModules[name] = loader();
  return tauriModules[name];
}

async function invoke(cmd, args) {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await tauriImport('core', () => import('@tauri-apps/api/core'));
    return tauriInvoke(cmd, args);
  }
  console.warn(`[platform] No backend for command: ${cmd}`);
  return null;
}

async function listen(event, handler) {
  if (isTauri()) {
    const { listen: tauriListen } = await tauriImport('event', () => import('@tauri-apps/api/event'));
    return tauriListen(event, (e) => handler(e.payload));
  }
  return () => {};
}

// --- Document operations ---

export async function openDocument(filePath) {
  if (isTauri()) {
    let path = filePath;
    if (!path) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      path = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
    }
    if (!path) return null;
    const content = await invoke('open_document', { path });
    if (content) {
      await saveLastOpenedFile(path);
      await addRecentFile(path);
    }
    return { content, filePath: path };
  }
  return null;
}

export async function saveDocument(filePath, content) {
  const result = await invoke('save_document', { path: filePath, content });
  if (filePath) {
    await saveLastOpenedFile(filePath);
    await addRecentFile(filePath);
  }
  return result;
}

export async function saveDocumentAs(content) {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: 'notes.json',
    });
    if (!path) return null;
    await invoke('save_document', { path, content });
    await saveLastOpenedFile(path);
    await addRecentFile(path);
    return path;
  }
  return null;
}

export async function getLastOpenedFile() {
  return invoke('get_last_opened_file');
}

export async function saveLastOpenedFile(filePath) {
  return invoke('save_last_opened_file', { path: filePath });
}

export async function getRecentFiles() {
  return (await invoke('get_recent_files')) ?? [];
}

export async function addRecentFile(filePath) {
  return invoke('add_recent_file', { path: filePath });
}

// --- AI operations ---

export async function processWithAI(prompt, content, title) {
  return invoke('ai_process', { prompt, content, title });
}

export async function getAIConfig() {
  const result = await invoke('get_ai_config');
  return result || {
    provider: 'openai',
    model: '',
    apiKey: '',
    providers: [
      { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o' },
      { id: 'anthropic', name: 'Anthropic', defaultModel: 'claude-sonnet-5' },
      { id: 'openrouter', name: 'OpenRouter', defaultModel: 'openai/gpt-4o' },
    ],
  };
}

export async function setAIConfig(config) {
  return invoke('set_ai_config', { config });
}

// --- App events ---

export function onFileNew(handler) {
  return listen('file-new', handler);
}

export function onFileOpened(handler) {
  return listen('file-opened', handler);
}

export function onFileOpenRequest(handler) {
  return listen('file-open-request', handler);
}

export function onFileSaveRequest(handler) {
  return listen('file-save-request', handler);
}

export function onFileSaveAsRequest(handler) {
  return listen('file-save-as-request', handler);
}

export function onDarkModeToggle(handler) {
  return listen('dark-mode-toggle', handler);
}

export function onDarkModeChange(handler) {
  return listen('dark-mode-changed', handler);
}

export function onShowSettings(handler) {
  return listen('show-settings', handler);
}

export function onToggleSidebar(handler) {
  return listen('toggle-sidebar', handler);
}

// --- Shell / misc ---

export async function openExternalLink(url) {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell');
    return open(url);
  }
  window.open(url, '_blank');
}

export async function reloadWindow() {
  window.location.reload();
}

// Convenience namespace matching old electron.js interface
export const platform = {
  openDocument,
  saveDocument,
  saveDocumentAs,
  getLastOpenedFile,
  saveLastOpenedFile,
  getRecentFiles,
  addRecentFile,
  processWithAI,
  getAIConfig,
  setAIConfig,
  onFileNew,
  onFileOpened,
  onFileOpenRequest,
  onFileSaveRequest,
  onFileSaveAsRequest,
  onDarkModeToggle,
  onDarkModeChange,
  onShowSettings,
  onToggleSidebar,
  openExternalLink,
  reloadWindow,
};
