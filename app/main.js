const {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { initializeOpenAI, sendToChatGPT, loadApiKey, processWithChatGPT } = require('./chatgpt');
const { createMenu, updateMenu } = require('./menu');
const { loadLastOpenedFile, cleanUpTempFiles, saveLastOpenedFile } = require('./utils');
const { DEBUG } = require('./config');

let mainWindow;
let recentFiles = [];
const configPath = path.join(app.getPath("userData"), "config.json");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
  });

  mainWindow.loadFile("index.html");

  // Send the system theme to the renderer process
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send(
      "update-dark-mode",
      nativeTheme.shouldUseDarkColors
    );

    let lastOpenedFile = loadLastOpenedFile();
    if (!lastOpenedFile) {
      lastOpenedFile = createTempFile(); // Create a temporary file if no previous file was opened
    }

    const content = fs.readFileSync(lastOpenedFile, "utf-8");
    mainWindow.webContents.send("file-opened", {
      filePath: lastOpenedFile,
      content,
    });
  });

  // Build and set the application menu
  const template = createMenu(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  updateMenu(mainWindow);
}

// Create a temporary file
function createTempFile() {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  fs.writeFileSync(tempFilePath, "");
  return tempFilePath;
}

// IPC handlers
ipcMain.handle("file:save", async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content);
    saveLastOpenedFile(filePath);
    DEBUG.log('Updating menu after save');
    updateMenu(mainWindow);
    return true;
  } catch (error) {
    DEBUG.error("Error saving file:", error);
    return false;
  }
});

// ChatGPT handlers
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
    DEBUG.error('Error sending to ChatGPT:', error);
    throw error;
  }
});

ipcMain.handle('chatgpt:process', async (event, prompt, bodyContent, headerValue) => {
  try {
    return await processWithChatGPT(prompt, bodyContent, headerValue);
  } catch (error) {
    DEBUG.error('Error processing with ChatGPT:', error);
    throw error;
  }
});

app.on("ready", () => {
  cleanUpTempFiles(); // Ensure any leftover temp files are removed
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  cleanUpTempFiles(); // Clean up temp files on exit
  if (process.platform !== "darwin") app.quit();
});