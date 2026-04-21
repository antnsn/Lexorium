const {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  shell,
  dialog
} = require("electron");
const path = require("path");
const fs = require("fs");
const { initializeOpenAI, sendToChatGPT, loadApiKey, processWithChatGPT, getAIConfig, setAIConfig } = require('./main-process/chatgpt');
const { createMenu, updateMenu } = require('./main-process/menu');
const { loadLastOpenedFile, cleanUpTempFiles, saveLastOpenedFile } = require('./main-process/utils');
const { DEBUG } = require('./main-process/config');

let mainWindow;
let recentFiles = [];
const configPath = path.join(app.getPath("userData"), "config.json");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // MAIN_WINDOW_VITE_DEV_SERVER_URL is set by @electron-forge/plugin-vite
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send(
      "update-dark-mode",
      nativeTheme.shouldUseDarkColors
    );

    let lastOpenedFile = loadLastOpenedFile();
    if (!lastOpenedFile) {
      lastOpenedFile = createTempFile();
    }

    const content = fs.readFileSync(lastOpenedFile, "utf-8");
    mainWindow.webContents.send("file-opened", {
      filePath: lastOpenedFile,
      content,
    });
  });

  const template = createMenu(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  updateMenu(mainWindow);
}

function createTempFile() {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  fs.writeFileSync(tempFilePath, "");
  return tempFilePath;
}

// IPC handlers
ipcMain.handle("open-external-url", async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Error opening external URL:', error);
    throw error;
  }
});

ipcMain.handle("window:reload", () => {
  mainWindow.reload();
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Markdown Files', extensions: ['md'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return { filePath, content };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          filePath,
          content: JSON.stringify({
            version: "1.0",
            sections: []
          }, null, 2)
        };
      }
      throw error;
    }
  }
  return null;
});

ipcMain.handle('file:save', async (event, { filePath, content }) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
});

ipcMain.handle('chatgpt:set-api-key', async (event, apiKey) => {
  try {
    return await initializeOpenAI(apiKey);
  } catch (error) {
    DEBUG.error('Error setting API key:', error);
    return false;
  }
});

ipcMain.handle('chatgpt:get-api-key', async () => {
  return loadApiKey();
});

ipcMain.handle('chatgpt:send', async (event, text, type) => {
  try {
    return await sendToChatGPT(text, type);
  } catch (error) {
    DEBUG.error('Error sending to AI:', error);
    throw error;
  }
});

ipcMain.handle('chatgpt:process', async (event, prompt, bodyContent, headerValue) => {
  try {
    return await processWithChatGPT(prompt, bodyContent, headerValue);
  } catch (error) {
    DEBUG.error('Error processing with AI:', error);
    throw error;
  }
});

ipcMain.handle('ai:get-config', async () => {
  try {
    return getAIConfig();
  } catch (error) {
    DEBUG.error('Error getting AI config:', error);
    throw error;
  }
});

ipcMain.handle('ai:set-config', async (event, config) => {
  try {
    return setAIConfig(config);
  } catch (error) {
    DEBUG.error('Error setting AI config:', error);
    throw error;
  }
});

app.on("ready", () => {
  cleanUpTempFiles();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  cleanUpTempFiles();
  if (process.platform !== "darwin") app.quit();
});
