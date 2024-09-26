const { app, Menu, dialog, nativeTheme } = require("electron");
const fs = require("fs");
const { promptForApiKey } = require("./chatgpt"); 
const { saveLastOpenedFile } = require("./utils"); 

module.exports = function(mainWindow) {
  const isMac = process.platform === "darwin";

  const aboutMenuItem = {
    label: 'About',
    click: () => {
      dialog.showMessageBox({
        type: 'none',  // No sound or icon
        title: 'About Lexorium',
        message: `Lexorium \n\nVersion: ${app.getVersion()}\n\nVisit our GitHub page:`,
        buttons: ['Open GitHub', 'Close'],
        defaultId: 0,
        icon: 'assets/icon.png',  // Optional: Path to an app icon
      }).then(result => {
        if (result.response === 0) {
          const { shell } = require("electron");
          shell.openExternal("https://github.com/antnsn/lexorium");
        }
      });
    }
  };

  const menu = Menu.buildFromTemplate([
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              aboutMenuItem,
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
                const { saveLastOpenedFile } = require('./utils');
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
                const { saveLastOpenedFile } = require('./utils');
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
          label: 'Enter ChatGPT API Key',
          click: async () => {
              try {
                  const apiKey = await promptForApiKey(mainWindow); // Pass mainWindow
                  if (apiKey) {
                      await mainWindow.webContents.send('save-api-key', apiKey);
                      dialog.showMessageBox(mainWindow, {
                          type: 'info',
                          title: 'API Key',
                          message: 'API Key saved successfully!',
                      });
                  }
              } catch (error) {
                  console.error("Error during API Key prompt:", error);
                  dialog.showMessageBox(mainWindow, {
                      type: 'error',
                      title: 'Error',
                      message: 'Failed to save API Key.',
                  });
              }
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
        aboutMenuItem, 
      ],
    },
  ]);

  return menu;
};