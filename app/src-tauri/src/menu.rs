use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, CheckMenuItemBuilder},
    App, AppHandle, Emitter,
};

pub fn create_menu(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    // ── App submenu (macOS "About" slot) ──
    let app_menu = SubmenuBuilder::new(handle, "Lexorium")
        .about(None)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "Settings…")
            .accelerator("CmdOrCtrl+,")
            .build(handle)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // ── File ──
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&MenuItemBuilder::with_id("file-new", "New Document")
            .accelerator("CmdOrCtrl+N")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("file-open", "Open…")
            .accelerator("CmdOrCtrl+O")
            .build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("file-save", "Save")
            .accelerator("CmdOrCtrl+S")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("file-save-as", "Save As…")
            .accelerator("CmdOrCtrl+Shift+S")
            .build(handle)?)
        .separator()
        .close_window()
        .build()?;

    // ── Edit ──
    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // ── View ──
    let dark_mode_item = CheckMenuItemBuilder::new("Dark Mode")
        .id("toggle-dark-mode")
        .accelerator("CmdOrCtrl+Shift+D")
        .build(handle)?;

    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&dark_mode_item)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-sidebar", "Toggle Sidebar")
            .accelerator("CmdOrCtrl+\\")
            .build(handle)?)
        .build()?;

    // ── Help ──
    let help_menu = SubmenuBuilder::new(handle, "Help")
        .item(&MenuItemBuilder::with_id("open-repo", "Lexorium on GitHub")
            .build(handle)?)
        .build()?;

    let menu = MenuBuilder::new(handle)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    // ── Handle menu events ──
    app.on_menu_event(move |app_handle, event| {
        let id = event.id().as_ref();
        log::info!("Menu event fired: {}", id);
        match id {
            "file-new" => {
                log::info!("Emitting file-new event");
                let _ = app_handle.emit("file-new", "new");
            }
            "file-open" => {
                log::info!("Emitting file-open-request event");
                let _ = app_handle.emit("file-open-request", "open");
            }
            "file-save" => {
                log::info!("Emitting file-save-request event");
                let _ = app_handle.emit("file-save-request", "save");
            }
            "file-save-as" => {
                log::info!("Emitting file-save-as-request event");
                let _ = app_handle.emit("file-save-as-request", "save-as");
            }
            "settings" => {
                log::info!("Emitting show-settings event");
                let _ = app_handle.emit("show-settings", "settings");
            }
            "toggle-dark-mode" => {
                log::info!("Emitting dark-mode-toggle event");
                let _ = app_handle.emit("dark-mode-toggle", "toggle");
            }
            "toggle-sidebar" => {
                log::info!("Emitting toggle-sidebar event");
                let _ = app_handle.emit("toggle-sidebar", "sidebar");
            }
            "open-repo" => {
                open_url(app_handle, "https://github.com/antnsn/Lexorium");
            }
            _ => {
                log::debug!("Unhandled menu event: {}", id);
            }
        }
    });

    Ok(())
}

fn open_url(_app: &AppHandle, url: &str) {
    let _ = open::that(url);
}
