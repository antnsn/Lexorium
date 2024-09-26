const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  on: (channel, func) => {
    const validChannels = ["file-opened", "api-key-saved", "update-dark-mode"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  send: (channel, data) => {
    const validChannels = ["api-key-saved"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: (channel, data) => {
    const validChannels = [
      "file:save",
      "get-api-key",
      "save-api-key",
      "initialize-openai",
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
  loadApiKey: () => ipcRenderer.invoke("get-api-key"),
  saveFile: (filePath, content) =>
    ipcRenderer.send("save-file", filePath, content),
  initializeOpenAI: (apiKey) => ipcRenderer.send("initialize-openai", apiKey),
  promptForApiKey: () => ipcRenderer.invoke("prompt-for-api-key"),
  sendToChatGPT: (promptText) =>
    ipcRenderer.invoke("send-to-chatgpt", promptText),
  loadAndSendLastOpenedFile: () =>
    ipcRenderer.invoke("load-and-send-last-opened-file"),
});
