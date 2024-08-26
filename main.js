const {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  MenuItem,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let recentFiles = [];
const configPath = path.join(app.getPath("userData"), "config.json");

function saveLastOpenedFile(filePath) {
  const config = { lastOpenedFile: filePath };
  fs.writeFileSync(configPath, JSON.stringify(config));
}

function loadLastOpenedFile() {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath));
    if (config.lastOpenedFile && fs.existsSync(config.lastOpenedFile)) {
      return config.lastOpenedFile;
    }
  }
  return null;
}

function createTempFile() {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  fs.writeFileSync(tempFilePath, ""); // Create an empty temporary markdown file
  return tempFilePath;
}

function cleanUpTempFiles() {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
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

  const isMac = process.platform === "darwin";

  const menu = Menu.buildFromTemplate([
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: isMac ? "Cmd+N" : "Ctrl+N",
          click: async () => {
            try {
              const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: "Create New Markdown File",
                defaultPath: "untitled.md",
                filters: [{ name: "Markdown Files", extensions: ["md"] }],
              });

              if (filePath) {
                fs.writeFileSync(filePath, ""); // Create an empty markdown file
                saveLastOpenedFile(filePath);
                mainWindow.webContents.send("file-opened", {
                  filePath,
                  content: "",
                });
              }
            } catch (error) {
              console.error("Error creating new file:", error);
            }
          },
        },
        {
          label: "Open",
          accelerator: isMac ? "Cmd+O" : "Ctrl+O",
          click: async () => {
            try {
              const { canceled, filePaths } = await dialog.showOpenDialog(
                mainWindow,
                {
                  properties: ["openFile"],
                  filters: [{ name: "Markdown Files", extensions: ["md"] }],
                }
              );
              if (!canceled && filePaths.length > 0) {
                const filePath = filePaths[0];
                const content = fs.readFileSync(filePath, "utf-8");
                saveLastOpenedFile(filePath);
                mainWindow.webContents.send("file-opened", {
                  filePath,
                  content,
                });
              }
            } catch (error) {
              console.error("Error opening file:", error);
            }
          },
        },
        {
          id: "recent-files",
          label: "Recent Files",
          submenu: [],
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: isMac ? "Cmd+S" : "Ctrl+S",
          click: () => {
            mainWindow.webContents.send("file-save-request");
          },
        },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Dark Mode",
          type: "radio",
          click: () => {
            nativeTheme.themeSource = "dark";
            mainWindow.webContents.send("update-dark-mode", true);
          },
        },
        {
          label: "Light Mode",
          type: "radio",
          click: () => {
            nativeTheme.themeSource = "light";
            mainWindow.webContents.send("update-dark-mode", false);
          },
        },
        {
          label: "System Theme",
          type: "radio",
          click: () => {
            nativeTheme.themeSource = "system";
            mainWindow.webContents.send(
              "update-dark-mode",
              nativeTheme.shouldUseDarkColors
            );
          },
        },
        { type: "separator" },
        { role: "reload" },
        { role: "toggledevtools" },
      ],
    },
    {
      label: "Window",
      role: "window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
    {
      label: "Help",
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://electronjs.org");
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);

  ipcMain.handle("file:save", (event, data) => {
    try {
      if (data.filePath.includes("temp.md")) {
        const savePath = dialog.showSaveDialogSync(mainWindow, {
          title: "Save Markdown File",
          defaultPath: "untitled.md",
          filters: [{ name: "Markdown Files", extensions: ["md"] }],
        });

        if (savePath) {
          fs.writeFileSync(savePath, data.content);
          saveLastOpenedFile(savePath);
          fs.unlinkSync(data.filePath); // Remove the temporary file after saving
          mainWindow.webContents.send("file-opened", {
            filePath: savePath,
            content: data.content,
          });
        }
      } else {
        fs.writeFileSync(data.filePath, data.content);
        saveLastOpenedFile(data.filePath);
      }
    } catch (error) {
      console.error("Error saving file:", error);
    }
  });
}

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