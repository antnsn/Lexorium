import { writable } from 'svelte/store';
import { getAIConfig, setAIConfig } from '../services/platform.js';

function createSettingsStore() {
  const { subscribe, set, update } = writable({
    provider: 'openai',
    model: '',
    apiKey: '',
    providers: [],
  });

  return {
    subscribe,

    async load() {
      try {
        const config = await getAIConfig();
        set(config);
      } catch (e) {
        console.error('Failed to load AI config:', e);
      }
    },

    async save(provider, model, apiKey) {
      try {
        const ok = await setAIConfig({ provider, model, apiKey });
        if (ok !== false) {
          update((s) => ({ ...s, provider, model, apiKey }));
          return true;
        }
        return false;
      } catch (e) {
        console.error('Failed to save AI config:', e);
        return false;
      }
    },

    async hasApiKey() {
      const config = await getAIConfig();
      return !!config?.apiKey;
    },
  };
}

export const settings = createSettingsStore();
