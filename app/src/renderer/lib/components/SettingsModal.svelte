<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { settings } from '../stores/settings.js';
  import { getAIConfig } from '../services/platform.js';

  const dispatch = createEventDispatcher();

  let provider = 'openai';
  let model = '';
  let apiKey = '';
  let providers = [];
  let errorMsg = '';
  let modalEl;
  let previouslyFocused;

  const providerLabels = {
    openai: 'OpenAI API Key:',
    anthropic: 'Anthropic API Key:',
    openrouter: 'OpenRouter API Key:',
  };

  const providerPlaceholders = {
    openai: 'sk-...',
    anthropic: 'sk-ant-...',
    openrouter: 'sk-or-...',
  };

  onMount(async () => {
    previouslyFocused = document.activeElement;

    const config = await getAIConfig();
    provider = config.provider || 'openai';
    model = config.model || '';
    apiKey = config.apiKey || '';
    providers = config.providers || [];

    requestAnimationFrame(() => {
      modalEl?.querySelector('select, input')?.focus();
    });
  });

  onDestroy(() => {
    previouslyFocused?.focus();
  });

  async function handleProviderChange() {
    errorMsg = '';
    const config = await getAIConfig();
    apiKey = '';
    model = '';
    if (provider === config.provider) {
      apiKey = config.apiKey || '';
      model = config.model || '';
    }
  }

  async function save() {
    errorMsg = '';
    if (!apiKey.trim()) {
      errorMsg = 'Please enter an API key';
      return;
    }
    const ok = await settings.save(provider, model.trim(), apiKey.trim());
    if (ok) {
      dispatch('close');
    } else {
      errorMsg = 'Failed to save settings';
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      dispatch('close');
      return;
    }
    if (e.key === 'Tab' && modalEl) {
      const focusable = modalEl.querySelectorAll('select, input, button, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

<div class="modal-backdrop" on:click={handleBackdrop} on:keydown={handleKeydown} role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
  <div class="modal-content" bind:this={modalEl}>
    <div class="modal-header">
      <h2 id="settings-title">Settings</h2>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close settings">&times;</button>
    </div>

    <div class="settings-section">
      <label for="ai-provider">AI Provider:</label>
      <select id="ai-provider" bind:value={provider} on:change={handleProviderChange}>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="openrouter">OpenRouter</option>
      </select>

      <label for="api-key">{providerLabels[provider] || 'API Key:'}</label>
      <input
        id="api-key"
        type="password"
        bind:value={apiKey}
        placeholder={providerPlaceholders[provider] || 'Enter your API key'}
      />

      <label for="ai-model">Model (optional):</label>
      <input
        id="ai-model"
        type="text"
        bind:value={model}
        placeholder="Leave blank for default"
      />

      {#if errorMsg}
        <p class="error-msg" role="alert">{errorMsg}</p>
      {/if}

      <button class="save-btn" on:click={save}>Save Settings</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-content {
    padding: var(--space-xl);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    width: 420px;
    max-width: 90%;
    color: var(--text-primary);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  .modal-header h2 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-tertiary);
    font-size: 1.25em;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition);
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--accent-subtle);
  }

  .settings-section label {
    display: block;
    margin-bottom: var(--space-xs);
    margin-top: var(--space-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .settings-section label:first-of-type { margin-top: 0; }

  .settings-section input,
  .settings-section select {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: 14px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    outline: none;
    box-sizing: border-box;
    transition: border-color var(--transition), background-color var(--transition);
  }

  .settings-section input:focus,
  .settings-section select:focus {
    border-color: var(--border-focus);
  }

  .settings-section select {
    appearance: auto;
    cursor: pointer;
  }

  .save-btn {
    width: 100%;
    margin-top: var(--space-lg);
    padding: var(--space-sm) var(--space-lg);
    font-size: 14px;
    font-weight: 500;
    font-family: var(--font-body);
    color: var(--text-on-accent);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition);
  }

  .save-btn:hover { background: var(--accent-hover); }

  .error-msg {
    margin: var(--space-sm) 0 0;
    padding: 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
