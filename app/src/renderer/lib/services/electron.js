/**
 * Thin wrapper around window.electronAPI for Svelte components.
 * Provides typed access and handles listener cleanup.
 */
const api = () => window.electronAPI;

export const electron = {
  onFileNew: (cb) => api().onFileNew(cb),
  onFileOpened: (cb) => api().onFileOpened(cb),
  onFileSaveRequest: (cb) => api().onFileSaveRequest(cb),
  onUpdateDarkMode: (cb) => api().onUpdateDarkMode(cb),
  onShowSettings: (cb) => api().onShowSettings(cb),

  saveFile: (data) => api().saveFile(data),
  openFile: () => api().openFile(),
  reloadWindow: () => api().reloadWindow(),

  sendToChatGPT: (text, type) => api().sendToChatGPT(text, type),
  processWithChatGPT: (prompt, body, header) => api().processWithChatGPT(prompt, body, header),
  setApiKey: (key) => api().setApiKey(key),
  getApiKey: () => api().getApiKey(),
  getAIConfig: () => api().getAIConfig(),
  setAIConfig: (config) => api().setAIConfig(config),

  removeListener: (ch, cb) => api().removeListener(ch, cb),
  openExternalLink: (url) => api().openExternalLink(url),
};
