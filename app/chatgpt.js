const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const OpenAI = require("openai");

const configPath = path.join(app.getPath("userData"), "config.json");

let openai;

// Function to write the config to the file
const writeConfig = (config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error writing config file:", error);
  }
};

// Function to read the config from the file
const readConfig = () => {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath));
    } catch (error) {
      console.error("Error reading config file:", error);
      return {};
    }
  }
  return {};
};

// Function to save the API key to the config file
function saveApiKey(apiKey) {
  const config = readConfig(); // Read existing config
  config.apiKey = apiKey; // Add or update the API key
  writeConfig(config); // Save back to the config file
  console.log("API Key saved to config.json.");
}

// Function to load the API key from the config file
function loadApiKey() {
  const config = readConfig();
  const apiKey = config.apiKey; // Adjust this key according to your actual config structure
  if (apiKey) {
    console.log("API Key loaded from config.json.");
  } else {
    console.log("API Key not found in config.json.");
  }
  return apiKey;
}

// Function to initialize OpenAI with the loaded API key
function initializeOpenAI() {
  const apiKey = loadApiKey();
  if (apiKey) {
    openai = new OpenAI({ apiKey }); // Set the OpenAI API key
  } else {
    throw new Error("API key not found. Please set the API key first.");
  }
}

// Function to send prompts to ChatGPT
async function sendToChatGPT(promptText) {
  // Check if OpenAI is initialized
  if (!openai) {
    throw new Error("OpenAI is not initialized. Please set the API key first.");
  }

  const modifiedPrompt = `
You are an assistant designed to provide detailed and relevant responses.

1. **Initial Query**: Please respond to my initial query: "${promptText}".
2. Provide the query back the same way it was sent. with the header "Initial Query". no other text should be added.
3 **Code Handling**: This can be skipped If the input is not code else do as follows.:
! important ! chatgpts justification of why its not mentioning that there is no code in the input is not needed.
   - Provide a brief description of what the code does.
   - Format the code using Markdown syntax, including proper syntax highlighting.

Remember, if there is no code, dont mention anything about code.
Thank you!
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: modifiedPrompt }],
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error communicating with ChatGPT:", error);
    throw new Error("Failed to get a response from ChatGPT.");
  }
}

// Listen for the 'send-to-chatgpt' channel from the renderer process
ipcMain.handle("send-to-chatgpt", async (event, promptText) => {
  // Ensure OpenAI is initialized
  if (!openai) {
    const apiKey = await promptForApiKey(); // Prompt for API key
    initializeOpenAI(apiKey); // Initialize OpenAI with the entered API key
  }

  return await sendToChatGPT(promptText);
});

// Function to prompt the user for an API key using a modal window
function promptForApiKey(mainWindow) {
  return new Promise((resolve) => {
    const apiKeyWindow = new BrowserWindow({
      width: 400,
      height: 250,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    apiKeyWindow.loadFile("apiKeyPrompt.html"); // Load the HTML for API key input

    // Listen for the API key submission from the renderer process
    ipcMain.once("save-api-key", (event, apiKey) => {
      saveApiKey(apiKey); // Save API key to config.json
      resolve(apiKey); // Resolve the promise with the API key
      apiKeyWindow.close(); // Close the dialog
    });
  });
}

// Export functions as needed
module.exports = {
  promptForApiKey,
  sendToChatGPT,
  saveApiKey,
  loadApiKey,
  initializeOpenAI,
};

// Initialize OpenAI if the API key is available at startup
try {
  initializeOpenAI();
} catch (error) {
  console.error(error.message);
}
