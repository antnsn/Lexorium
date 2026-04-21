const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { DEBUG } = require('./config');

const configPath = path.join(app.getPath("userData"), "config.json");
const MAX_RECENT_FILES = 10;

function loadConfig() {
    DEBUG.log('Loading config from:', configPath);
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath));
            DEBUG.log('Loaded config:', config);
            return config;
        } catch (error) {
            DEBUG.error('Error loading config:', error);
            return { lastOpenedFile: null, recentFiles: [] };
        }
    }
    DEBUG.log('No config file exists, creating new one');
    return { lastOpenedFile: null, recentFiles: [] };
}

function saveConfig(config) {
    DEBUG.log('Saving config:', config);
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        DEBUG.error('Error saving config:', error);
    }
}

function saveLastOpenedFile(filePath) {
    DEBUG.log('Saving last opened file:', filePath);
    const config = loadConfig();
    config.lastOpenedFile = filePath;
    
    // Update recent files
    if (!config.recentFiles) {
        config.recentFiles = [];
    }
    
    // Remove if already exists
    config.recentFiles = config.recentFiles.filter(file => file !== filePath);
    
    // Add to beginning only if filePath is not null
    if (filePath) {
        config.recentFiles.unshift(filePath);
        
        // Keep only MAX_RECENT_FILES
        config.recentFiles = config.recentFiles.slice(0, MAX_RECENT_FILES);
    }
    
    saveConfig(config);
}

function loadLastOpenedFile() {
    const config = loadConfig();
    if (config.lastOpenedFile && fs.existsSync(config.lastOpenedFile)) {
        return config.lastOpenedFile;
    }
    return null;
}

function getRecentFiles() {
    DEBUG.log('Getting recent files');
    const config = loadConfig();
    // Filter out files that no longer exist
    const existingFiles = (config.recentFiles || []).filter(file => {
        const exists = fs.existsSync(file);
        if (!exists) {
            DEBUG.log('File no longer exists:', file);
        }
        return exists;
    });
    
    DEBUG.log('Existing files:', existingFiles);
    
    if (existingFiles.length !== (config.recentFiles || []).length) {
        config.recentFiles = existingFiles;
        saveConfig(config);
    }
    
    return existingFiles;
}

function cleanUpTempFiles() {
    const tempFilePath = path.join(app.getPath("userData"), "temp.md");
    if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
    }
}

module.exports = {
    saveLastOpenedFile,
    loadLastOpenedFile,
    getRecentFiles,
    cleanUpTempFiles,
    configPath
};
