import { writable } from 'svelte/store';

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
        const config = await window.electronAPI.getAIConfig();
        set(config);
      } catch (e) {
        console.error('Failed to load AI config:', e);
      }
    },

    async save(provider, model, apiKey) {
      try {
        const ok = await window.electronAPI.setAIConfig({ provider, model, apiKey });
        if (ok) {
          update((s) => ({ ...s, provider, model, apiKey }));
        }
        return ok;
      } catch (e) {
        console.error('Failed to save AI config:', e);
        return false;
      }
    },

    async hasApiKey() {
      const config = await window.electronAPI.getAIConfig();
      return !!config?.apiKey;
    },
  };
}

export const settings = createSettingsStore();
