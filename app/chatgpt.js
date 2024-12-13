const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

let openai = null;
const configPath = path.join(app.getPath('userData'), 'config.json');

// Read config file
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

// Write config file
function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error writing config:', error);
    }
}

// Save API key
function saveApiKey(apiKey) {
    const config = readConfig();
    config.openaiApiKey = apiKey;
    writeConfig(config);
}

// Load API key
function loadApiKey() {
    const config = readConfig();
    return config.openaiApiKey;
}

// Initialize OpenAI with API key
async function initializeOpenAI(apiKey) {
    try {
        if (apiKey) {
            openai = new OpenAI({ apiKey });
            await saveApiKey(apiKey);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error initializing OpenAI:', error);
        return false;
    }
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
           '4. No code blocks if input isn\'t code' + 
            'For text/questions:\n' +
           '1. If asked to analyze/explain: provide your analysis\n' +
           '2. If asked to improve/modify: provide the improved version\n' +
           '3. If asked to generate: provide the generated text\n' +
           '4. Include relevant parts of the original text when improving or modifying\n' +
           '5. Use markdown formatting when appropriate';    
}

// Send message to ChatGPT
async function sendToChatGPT(text, type = 'content') {
    if (!openai) {
        const apiKey = loadApiKey();
        if (!apiKey || !(await initializeOpenAI(apiKey))) {
            throw new Error('OpenAI not initialized. Please set your API key.');
        }
    }

    try {
        let systemPrompt = getSystemPrompt(type);

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ]
        });

        const response = completion.choices[0].message.content.trim();

        if (type === 'title') {
            return response;
        }

        // For descriptions, ensure we're returning properly formatted markdown
        // Split response into explanation and code block if present
        const parts = response.split('```');
        if (parts.length >= 3) {
            // parts[0] is explanation
            // parts[1] is language+code
            // parts[2] is empty or additional content
            const explanation = parts[0].trim();
            const codeBlock = parts[1];
            
            // Extract language and code
            const firstLineBreak = codeBlock.indexOf('\n');
            const language = codeBlock.substring(0, firstLineBreak).trim();
            const code = codeBlock.substring(firstLineBreak).trim();

            // Return formatted response
            return `${explanation}\n\n\`\`\`${language}\n${code}\n\`\`\``;
        }

        // If no code block, return the response as is
        return response;
    } catch (error) {
        console.error('Error calling ChatGPT:', error);
        throw new Error('Failed to get response from ChatGPT: ' + error.message);
    }
}

// Process the content with ChatGPT
async function processWithChatGPT(prompt, bodyContent = '', headerValue = '') {
    try {
        // Get title from ChatGPT if no header provided
        let finalHeaderValue = headerValue;
        if (!finalHeaderValue && (prompt || bodyContent)) {
            finalHeaderValue = await sendToChatGPT(bodyContent || prompt, 'title');
        }

        // Get the main response
        const response = await sendToChatGPT(bodyContent || prompt, 'content');

        return {
            title: finalHeaderValue,
            response
        };
    } catch (error) {
        console.error('Error processing with ChatGPT:', error);
        throw error;
    }
}

module.exports = {
    initializeOpenAI,
    sendToChatGPT,
    loadApiKey,
    processWithChatGPT
};
