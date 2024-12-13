const { app, dialog, nativeTheme, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { saveLastOpenedFile, getRecentFiles } = require('./utils');
const { DEBUG } = require('./config');

function buildRecentFilesSubmenu(mainWindow) {
    const recentFiles = getRecentFiles();
    DEBUG.log('Building recent files submenu with files:', recentFiles);
    
    if (recentFiles.length === 0) {
        return [{
            label: 'No Recent Files',
            enabled: false
        }];
    }
    
    const submenu = recentFiles.map(filePath => ({
        label: path.basename(filePath),
        click: () => {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                saveLastOpenedFile(filePath);
                mainWindow.webContents.send('file-opened', {
                    filePath,
                    content
                });
                // Rebuild the entire menu after opening a recent file
                const template = createMenu(mainWindow);
                const menu = Menu.buildFromTemplate(template);
                Menu.setApplicationMenu(menu);
            } catch (error) {
                DEBUG.error('Error opening recent file:', error);
                dialog.showErrorBox('Error', `Could not open file: ${filePath}`);
            }
        }
    }));
    
    submenu.push(
        { type: 'separator' },
        {
            label: 'Clear Recent Files',
            click: () => {
                saveLastOpenedFile(null);
                // Rebuild the entire menu after clearing
                const template = createMenu(mainWindow);
                const menu = Menu.buildFromTemplate(template);
                Menu.setApplicationMenu(menu);
            }
        }
    );
    
    return submenu;
}

function createMenu(mainWindow) {
    const isMac = process.platform === "darwin";

    const template = [
        ...(isMac
            ? [{
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
            }]
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
                                // Rebuild menu after creating new file
                                const template = createMenu(mainWindow);
                                const menu = Menu.buildFromTemplate(template);
                                Menu.setApplicationMenu(menu);
                            }
                        } catch (error) {
                            DEBUG.error("Error creating new file:", error);
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
                                // Rebuild menu after opening file
                                const template = createMenu(mainWindow);
                                const menu = Menu.buildFromTemplate(template);
                                Menu.setApplicationMenu(menu);
                            }
                        } catch (error) {
                            DEBUG.error("Error opening file:", error);
                        }
                    },
                },
                {
                    label: "Recent Files",
                    submenu: buildRecentFilesSubmenu(mainWindow)
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
            submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "About Lexorium",
                    click: () => {
                        dialog.showMessageBox({
                            type: 'none',
                            title: 'About Lexorium',
                            message: `Lexorium \n\nVersion: ${app.getVersion()}\n\nVisit our GitHub page:`,
                            buttons: ['Open GitHub', 'Close'],
                            defaultId: 0,
                            icon: 'assets/icon.png',
                        }).then(result => {
                            if (result.response === 0) {
                                const { shell } = require("electron");
                                shell.openExternal("https://github.com/antnsn/lexorium");
                            }
                        });
                    },
                },
            ],
        },
    ];

    return template;
}

// Update the menu when a file is saved
function updateMenu(mainWindow) {
    const template = createMenu(mainWindow);
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = { createMenu, updateMenu };
