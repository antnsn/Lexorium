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

if (require("electron-squirrel-startup")) {
  // Squirrel event handled and app will exit in 1000ms, so don't do anything else
  app.quit();
}

let mainWindow;
let recentFiles = [];

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
                addToRecentFiles(filePath);
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
                addToRecentFiles(filePath);
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
      if (data.filePath) {
        fs.writeFileSync(data.filePath, data.content);
        addToRecentFiles(data.filePath);
      } else {
        const savePath = dialog.showSaveDialogSync(mainWindow, {
          title: "Save Markdown File",
          defaultPath: "untitled.md",
          filters: [{ name: "Markdown Files", extensions: ["md"] }],
        });

        if (savePath) {
          fs.writeFileSync(savePath, data.content);
          addToRecentFiles(savePath);
          mainWindow.webContents.send("file-opened", {
            filePath: savePath,
            content: data.content,
          });
        }
      }
    } catch (error) {
      console.error("Error saving file:", error);
    }
  });
}

function addToRecentFiles(filePath) {
  if (!recentFiles.includes(filePath)) {
    recentFiles.unshift(filePath);
    if (recentFiles.length > 5) {
      recentFiles.pop();
    }
    updateMenu();
  }
}

function updateMenu() {
  try {
    const menu = Menu.getApplicationMenu();
    const recentFilesMenu = menu.getMenuItemById("recent-files");

    if (recentFilesMenu) {
      recentFilesMenu.submenu.clear();

      recentFiles.forEach((filePath) => {
        recentFilesMenu.submenu.append(
          new MenuItem({
            label: path.basename(filePath),
            click: () => {
              const content = fs.readFileSync(filePath, "utf-8");
              mainWindow.webContents.send("file-opened", { filePath, content });
            },
          })
        );
      });

      Menu.setApplicationMenu(menu);
    }
  } catch (error) {
    console.error("Error updating menu:", error);
  }
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require("child_process");
  const path = require("path");

  const appFolder = path.resolve(process.execPath, "..");
  const rootAtomFolder = path.resolve(appFolder, "..");
  const updateDotExe = path.resolve(path.join(rootAtomFolder, "Update.exe"));
  const exeName = path.basename(process.execPath);

  const spawn = function (command, args) {
    let spawnedProcess;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (error) {
      return;
    }

    spawnedProcess.on("close", () => {
      app.quit();
    });
  };

  const spawnUpdate = function (args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case "--squirrel-install":
    case "--squirrel-updated":
      // Install desktop and start menu shortcuts
      spawnUpdate(["--createShortcut", exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-uninstall":
      // Remove desktop and start menu shortcuts
      spawnUpdate(["--removeShortcut", exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-obsolete":
      app.quit();
      return true;
  }
}

if (handleSquirrelEvent()) {
  // Squirrel event handled and app will exit in 1000ms, so don't do anything else
  app.quit();
}

app.on("ready", () => {
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
