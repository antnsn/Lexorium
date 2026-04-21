const OpenAI = require('openai');

const PROVIDERS = {
    openai: {
        id: 'openai',
        name: 'OpenAI',
        defaultModel: 'gpt-4o',
        legacyModel: 'gpt-4',
        keyField: 'openaiApiKey',
        modelField: 'openaiModel',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        defaultModel: 'claude-sonnet-4-20250514',
        keyField: 'anthropicApiKey',
        modelField: 'anthropicModel',
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        defaultModel: 'openai/gpt-4o',
        keyField: 'openrouterApiKey',
        modelField: 'openrouterModel',
    },
};

function createClient(provider, apiKey) {
    switch (provider) {
        case 'openai':
            return { type: 'openai', client: new OpenAI({ apiKey }) };

        case 'openrouter':
            return {
                type: 'openrouter',
                client: new OpenAI({
                    apiKey,
                    baseURL: 'https://openrouter.ai/api/v1',
                    defaultHeaders: {
                        'HTTP-Referer': 'https://github.com/antnsn/Lexorium',
                        'X-Title': 'Lexorium',
                    },
                }),
            };

        case 'anthropic': {
            let Anthropic;
            try {
                Anthropic = require('@anthropic-ai/sdk');
            } catch (e) {
                throw new Error(
                    'Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk'
                );
            }
            // Handle both ESM default export and direct constructor
            const AnthropicClass = Anthropic.default || Anthropic;
            return { type: 'anthropic', client: new AnthropicClass({ apiKey }) };
        }

        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

// Separate system prompt from messages for Anthropic compatibility
function splitSystemAndMessages(messages) {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');
    const system = systemMessages.map((m) => m.content).join('\n') || undefined;
    return { system, messages: userMessages };
}

async function sendMessage(wrappedClient, messages, model) {
    const { type, client } = wrappedClient;

    switch (type) {
        case 'openai':
        case 'openrouter': {
            const completion = await client.chat.completions.create({
                model,
                messages,
            });
            return { text: completion.choices[0].message.content.trim() };
        }

        case 'anthropic': {
            const { system, messages: userMsgs } = splitSystemAndMessages(messages);
            const response = await client.messages.create({
                model,
                max_tokens: 4096,
                ...(system && { system }),
                messages: userMsgs,
            });
            const text = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('')
                .trim();
            return { text };
        }

        default:
            throw new Error(`Unknown client type: ${type}`);
    }
}

module.exports = { PROVIDERS, createClient, sendMessage };
