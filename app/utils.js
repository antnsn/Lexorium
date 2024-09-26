const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const configPath = path.join(app.getPath("userData"), "config.json");


// Read configuration from config.json
const readConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf-8");
      return configData ? JSON.parse(configData) : {};
    }
  } catch (error) {
    console.error("Error reading config file: ", error);
  }
  return {};
};

// Write configuration to config.json
const writeConfig = (config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Configuration saved successfully.");
  } catch (error) {
    console.error("Error saving configuration:", error);
  }
};

// Get the last opened file path or create a temporary file
const getLastOpenedFile = () => {
  const config = readConfig();
  return config.lastOpenedFile || createTempFile();
};

// Save the last opened file path to config.json
const saveLastOpenedFile = (filePath) => {
  if (filePath && filePath.trim() !== "") {
    const config = readConfig();
    config.lastOpenedFile = filePath;
    writeConfig(config);
  }
};

// Load the last opened file from config.json
const loadLastOpenedFile = () => {
  const config = readConfig();
  if (config.lastOpenedFile) {
    console.log("Checking existence of:", config.lastOpenedFile);
    if (fs.existsSync(config.lastOpenedFile)) {
      console.log("File exists:", config.lastOpenedFile);
      return config.lastOpenedFile;
    } else {
      console.log("File does not exist:", config.lastOpenedFile);
    }
  }
  return null;
};

// Create a temporary file
const createTempFile = () => {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  console.log("Creating temp file at: ", tempFilePath);
  fs.writeFileSync(tempFilePath, "");
  return tempFilePath;
};

// Clean up temporary files
const cleanUpTempFiles = () => {
  const tempFilePath = path.join(app.getPath("userData"), "temp.md");
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
    console.log("Temporary file cleaned up:", tempFilePath);
  }
};

// Load the last opened file and send its content
const loadAndSendLastOpenedFile = (mainWindow) => {
  const lastOpenedFile = loadLastOpenedFile();

  if (lastOpenedFile) {
    try {
      if (fs.existsSync(lastOpenedFile)) {
        const content = fs.readFileSync(lastOpenedFile, "utf-8");
        console.log(
          "File content loaded successfully:",
          content.slice(0, 100) + "..."
        ); // Log the first 100 characters for verification

        // Send content to the renderer
        mainWindow.webContents.send("file-opened", {
          filePath: lastOpenedFile,
          content,
        });
      } else {
        console.error("The last opened file does not exist:", lastOpenedFile);
      }
    } catch (error) {
      console.error("Failed to read the file:", error);
    }
  } else {
    console.warn("No last opened file found.");
  }
};

// Export the functions
module.exports = {
  saveLastOpenedFile,
  loadLastOpenedFile,
  createTempFile,
  cleanUpTempFiles,
  readConfig,
  writeConfig,
  loadAndSendLastOpenedFile,
  getLastOpenedFile,
};
