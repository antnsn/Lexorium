const {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const {
  loadAndSendLastOpenedFile,
  saveLastOpenedFile,
  loadLastOpenedFile,
  createTempFile,
  cleanUpTempFiles,
  getLastOpenedFile,
} = require("./utils");

const { promptForApiKey, loadApiKey, initializeOpenAI } = require("./chatgpt");

// Declare global variable for the current file path
let currentFilePath = null; // Declare globally

// Getter and setter for currentFilePath
function setCurrentFilePath(filePath) {
  currentFilePath = filePath;
}

function getCurrentFilePath() {
  return currentFilePath;
}

let mainWindow;
const configPath = path.join(app.getPath("userData"), "config.json");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, // Ensure security
      contextIsolation: true, // Must be true if using contextBridge
    },
  });

  mainWindow.loadFile("index.html");

  console.log("Config Path: ", configPath);
  console.log(
    "Temp Markdown File Path: ",
    path.join(app.getPath("userData"), "temp.md")
  );

  mainWindow.webContents.on("did-finish-load", async () => {
    mainWindow.webContents.send(
      "update-dark-mode",
      nativeTheme.shouldUseDarkColors
    );

    let content = "";
    let lastOpenedFile = loadLastOpenedFile();

    if (!lastOpenedFile) {
      lastOpenedFile = createTempFile(); // Create a temporary file if no previous file was opened
      console.log("Created a temporary file:", lastOpenedFile);
    } else {
      // Read and send content of last opened file to the renderer
      content = fs.readFileSync(lastOpenedFile, "utf-8");
      mainWindow.webContents.send("file-opened", {
        filePath: lastOpenedFile,
        content,
      });
      console.log("Loaded content from:", lastOpenedFile);
    }

    // Set currentFilePath for future saving operations
    setCurrentFilePath(lastOpenedFile); // Use setter to set currentFilePath

    if (!content || content.trim() === "") {
      console.log("The loaded file is empty.");
    }

    // Load and initialize OpenAI API with the saved key (if available)
    initializeOpenAI();
  });

  // Create the application menu
  const menu = require("./menu")(mainWindow);
  Menu.setApplicationMenu(menu);
}

// Save API key to config.json
ipcMain.handle("save-api-key", async (event, apiKey) => {
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  config.apiKey = apiKey;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return "API key saved successfully!";
});

// Load API key from config.json
ipcMain.handle("get-api-key", async () => {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { apiKey: config.apiKey };
  }
  return { apiKey: null }; // Return null if no key is found
});

// Inform the renderer when a file is opened
ipcMain.on("file-opened", (event, { filePath }) => {
  setCurrentFilePath(filePath); // Use setter to set currentFilePath
  console.log("Current file path set to:", getCurrentFilePath()); // Use getter
  saveLastOpenedFile(filePath);

  const content = fs.readFileSync(filePath, "utf-8");
  mainWindow.webContents.send("file-opened", {
    filePath,
    content,
  });
});

// Clean up temporary files and create window when the app is ready
app.whenReady().then(() => {
  cleanUpTempFiles();
  createWindow(); // Create the window

  ipcMain.handle("file-open", (event, filePath) => {
    setCurrentFilePath(filePath); // Update current file path when a file is opened
  });

  ipcMain.handle("file-save", (event, filePath) => {
    setCurrentFilePath(filePath); // Update current file path when a file is saved
  });

  // Handle file save from the renderer via the main process
  ipcMain.handle("file:save", async (event, { content }) => {
    const filePath = getCurrentFilePath(); // Use the getter to get the current file path
    if (!filePath) {
      console.error("No file path is set. Cannot save file.");
      return false; // Return failure
    }
    
    try {
      await fs.promises.writeFile(filePath, content);
      return true; // Return success
    } catch (error) {
      console.error("Error saving file:", error);
      return false; // Return failure
    }
  });
});

// Ensure proper cleanup on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS specific behavior when re-activating the app
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});