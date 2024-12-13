const { contextBridge, ipcRenderer, shell } = require('electron');

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    onFileNew: (callback) => ipcRenderer.on('file-new', callback),
    onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
    onFileSaveRequest: (callback) => ipcRenderer.on('file-save-request', callback),
    onUpdateDarkMode: (callback) => ipcRenderer.on('update-dark-mode', callback),
    onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
    saveFile: (data) => ipcRenderer.invoke('file:save', data),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    reloadWindow: () => ipcRenderer.invoke('window:reload'),
    
    // ChatGPT APIs
    sendToChatGPT: (text, type) => ipcRenderer.invoke('chatgpt:send', text, type),
    processWithChatGPT: (prompt, bodyContent, headerValue) => ipcRenderer.invoke('chatgpt:process', prompt, bodyContent, headerValue),
    setApiKey: (apiKey) => ipcRenderer.invoke('chatgpt:set-api-key', apiKey),
    getApiKey: () => ipcRenderer.invoke('chatgpt:get-api-key'),
    
    // Remove event listeners when needed
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    
    // External link handling
    openExternalLink: (url) => ipcRenderer.invoke('open-external-url', url)
});
