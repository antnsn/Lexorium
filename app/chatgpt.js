const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { PROVIDERS, createClient, sendMessage } = require('./ai-provider');

let currentClient = null;
let currentProvider = null;
let currentModel = null;
const configPath = path.join(app.getPath('userData'), 'config.json');

function readConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath));
        } catch (error) {
            console.error('Error reading config:', error);
            return {};
        }
    }
    return {};
}

function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error writing config:', error);
    }
}

function resolveProvider(config) {
    return config.aiProvider || 'openai';
}

function resolveModel(config, provider) {
    const providerInfo = PROVIDERS[provider];
    if (!providerInfo) return 'gpt-4';

    const modelField = providerInfo.modelField;
    if (config[modelField]) return config[modelField];

    // Legacy compat: existing OpenAI users keep gpt-4
    if (provider === 'openai' && !config.aiProvider) {
        return providerInfo.legacyModel || providerInfo.defaultModel;
    }

    return providerInfo.defaultModel;
}

function resolveApiKey(config, provider) {
    const providerInfo = PROVIDERS[provider];
    if (!providerInfo) return null;
    return config[providerInfo.keyField] || null;
}

// Ensure a client is ready, lazily creating from saved config
function ensureClient() {
    if (currentClient) return;

    const config = readConfig();
    const provider = resolveProvider(config);
    const apiKey = resolveApiKey(config, provider);

    if (!apiKey) {
        throw new Error(
            `No API key configured for ${PROVIDERS[provider]?.name || provider}. ` +
            'Please set your API key in Settings.'
        );
    }

    currentClient = createClient(provider, apiKey);
    currentProvider = provider;
    currentModel = resolveModel(config, provider);
}

// Legacy: initialize with an OpenAI key (backward compat)
async function initializeOpenAI(apiKey) {
    try {
        if (!apiKey) return false;

        const config = readConfig();
        config.openaiApiKey = apiKey;
        // Only set provider to openai if no provider was explicitly chosen
        if (!config.aiProvider) {
            config.aiProvider = 'openai';
        }
        writeConfig(config);

        // Reinitialize if current provider is openai
        if (!config.aiProvider || config.aiProvider === 'openai') {
            currentClient = createClient('openai', apiKey);
            currentProvider = 'openai';
            currentModel = resolveModel(config, 'openai');
        }

        return true;
    } catch (error) {
        console.error('Error initializing OpenAI:', error);
        return false;
    }
}

// Legacy: load the OpenAI API key
function loadApiKey() {
    const config = readConfig();
    return config.openaiApiKey || null;
}

// Get full AI configuration for the settings UI
function getAIConfig() {
    const config = readConfig();
    const provider = resolveProvider(config);
    const model = resolveModel(config, provider);
    const apiKey = resolveApiKey(config, provider);

    const providers = Object.values(PROVIDERS).map((p) => ({
        id: p.id,
        name: p.name,
        defaultModel: p.defaultModel,
    }));

    return {
        provider,
        model,
        apiKey: apiKey || '',
        providers,
    };
}

// Save AI configuration from the settings UI
function setAIConfig({ provider, model, apiKey }) {
    if (!PROVIDERS[provider]) {
        throw new Error(`Unknown provider: ${provider}`);
    }
    if (!apiKey || !apiKey.trim()) {
        throw new Error(`API key is required for ${PROVIDERS[provider].name}`);
    }

    const providerInfo = PROVIDERS[provider];
    const config = readConfig();

    config.aiProvider = provider;
    config[providerInfo.keyField] = apiKey.trim();
    config[providerInfo.modelField] = model?.trim() || providerInfo.defaultModel;

    writeConfig(config);

    // Reset client so next call uses updated config
    currentClient = null;
    currentProvider = null;
    currentModel = null;

    return true;
}

function getSystemPrompt(type) {
    if (type === 'title') {
        return "Generate a concise title (max 5 words) that describes the main purpose. Return ONLY the title, with no extra text, no 'Title:' prefix, and no formatting.";
    }

    return 'You are a helpful assistant. Analyze the input based on these rules:\n\n' +
           'For code, return in this format:\n' +
           '[A clear explanation]\n\n' +
           '```[language]\n' +
           '[Formatted code]\n' +
           '```\n\n' +
           'Rules:\n' +
           '1. For code: Use proper language tags (javascript, python, etc)\n' +
           '2. For code: Show it only once, properly formatted\n' +
           '3. For questions/requests: Just give a direct, natural response\n' +
           '4. No code blocks if input isn\'t code\n' +
           'For text/questions:\n' +
           '1. If asked to analyze/explain: provide your analysis\n' +
           '2. If asked to improve/modify: provide the improved version\n' +
           '3. If asked to generate: provide the generated text\n' +
           '4. Include relevant parts of the original text when improving or modifying\n' +
           '5. Use markdown formatting when appropriate';
}

async function sendToChatGPT(text, type = 'content') {
    ensureClient();

    try {
        const systemPrompt = getSystemPrompt(type);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
        ];

        const result = await sendMessage(currentClient, messages, currentModel);
        const response = result.text;

        if (type === 'title') {
            return response;
        }

        // Ensure properly formatted markdown with code blocks
        const parts = response.split('```');
        if (parts.length >= 3) {
            const explanation = parts[0].trim();
            const codeBlock = parts[1];
            const firstLineBreak = codeBlock.indexOf('\n');
            const language = codeBlock.substring(0, firstLineBreak).trim();
            const code = codeBlock.substring(firstLineBreak).trim();
            return `${explanation}\n\n\`\`\`${language}\n${code}\n\`\`\``;
        }

        return response;
    } catch (error) {
        const providerName = PROVIDERS[currentProvider]?.name || 'AI';
        console.error(`Error calling ${providerName}:`, error);
        throw new Error(`Failed to get response from ${providerName}: ${error.message}`);
    }
}

async function processWithChatGPT(prompt, bodyContent = '', headerValue = '') {
    try {
        let finalHeaderValue = headerValue;
        if (!finalHeaderValue && (prompt || bodyContent)) {
            finalHeaderValue = await sendToChatGPT(bodyContent || prompt, 'title');
            finalHeaderValue = finalHeaderValue.replace(/['"]/g, '');
        }

        const response = await sendToChatGPT(bodyContent || prompt, 'content');

        return { title: finalHeaderValue, response };
    } catch (error) {
        console.error('Error processing with AI:', error);
        throw error;
    }
}

module.exports = {
    initializeOpenAI,
    sendToChatGPT,
    loadApiKey,
    processWithChatGPT,
    getAIConfig,
    setAIConfig,
};
