<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import TagInput from './TagInput.svelte';

  export let processing = false;

  const dispatch = createEventDispatcher();

  let title = '';
  let content = '';
  let tags = [];
  let useAI = false;
  let bodyEl;
  let errorMsg = '';

  onMount(() => {
    if (bodyEl) bodyEl.focus();
  });

  function submit() {
    errorMsg = '';
    if (!content.trim()) {
      errorMsg = 'Note body cannot be empty.';
      return;
    }
    dispatch('submit', { title: title.trim(), content: content.trim(), tags, useAI });
  }

  function handleTagChange(e) {
    tags = e.detail;
  }

  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }
</script>

<div class="compose-panel">
  <input
    type="text"
    class="header-input"
    placeholder="Title (optional)"
    bind:value={title}
    aria-label="Note title"
  />
  <textarea
    class="body-input"
    placeholder="Write your note... (Markdown supported)"
    bind:value={content}
    bind:this={bodyEl}
    on:keydown={handleKeydown}
    aria-label="Note content"
  ></textarea>
  <div class="tags-section">
    <TagInput {tags} on:change={handleTagChange} />
  </div>
  <div class="compose-controls">
    {#if errorMsg}
      <p class="error-msg" role="alert">{errorMsg}</p>
    {/if}
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={useAI} />
      Enhance with AI
    </label>
    <div class="compose-actions">
      <button class="btn-secondary" on:click={() => dispatch('cancel')}>
        Cancel
      </button>
      <button class="btn-primary" on:click={submit} disabled={processing}>
        <span class="button-content">
          <span>{processing ? 'Processing...' : 'Add Note'}</span>
          {#if processing}
            <span class="spinner"></span>
          {/if}
        </span>
      </button>
    </div>
  </div>
</div>

<style>
  .compose-panel {
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
    flex-shrink: 0;
  }

  .header-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: 1.1rem;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    outline: none;
    margin-bottom: var(--space-sm);
    transition: border-color var(--transition);
  }

  .header-input:focus { border-bottom-color: var(--accent); }
  .header-input::placeholder { color: var(--text-tertiary); font-weight: 400; }

  .body-input {
    width: 100%;
    min-height: 80px;
    max-height: 200px;
    padding: var(--space-sm) var(--space-md);
    font-size: 14px;
    font-family: var(--font-body);
    line-height: 1.6;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-radius: 0;
    outline: none;
    resize: none;
    margin-bottom: var(--space-sm);
  }

  .body-input::placeholder { color: var(--text-tertiary); }

  .tags-section {
    margin-bottom: var(--space-sm);
  }

  .compose-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input {
    width: 14px;
    height: 14px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--accent);
  }

  .compose-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .btn-primary {
    padding: var(--space-sm) var(--space-lg);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-on-accent);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition);
    font-family: var(--font-body);
  }

  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-secondary {
    padding: var(--space-sm) var(--space-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition);
    font-family: var(--font-body);
  }

  .btn-secondary:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .button-content {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .error-msg {
    margin: 0 0 var(--space-sm);
    font-size: 13px;
    color: var(--danger);
  }
</style>
