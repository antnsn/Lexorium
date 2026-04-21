<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import TagInput from './TagInput.svelte';
  import { processWithAI } from '../services/platform.js';

  export let section;

  const dispatch = createEventDispatcher();

  let title = section.title;
  let content = section.content;
  let tags = [...(section.tags || [])];
  let titleEl;
  let processing = false;
  let aiMessage = '';
  let aiError = false;

  onMount(() => {
    if (titleEl) titleEl.focus();
  });

  function save() {
    if (processing) return;
    dispatch('save', { id: section.id, title, content, tags });
  }

  async function enhanceWithAI() {
    if (processing || !content.trim()) return;
    processing = true;
    aiMessage = '';
    aiError = false;
    try {
      const result = await processWithAI('', content.trim(), title.trim());
      if (result) {
        content = result.response || content;
        title = result.title || title;
        aiMessage = 'AI enhancement applied — review and save';
      }
    } catch (err) {
      console.error('AI enhancement error:', err);
      aiMessage = 'Error: ' + (err.message || err);
      aiError = true;
    } finally {
      processing = false;
    }
  }

  function handleTagChange(e) {
    tags = e.detail;
  }

  function handleKeydown(e) {
    if (processing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      dispatch('cancel');
    }
  }
</script>

<article class="note-editor" id="section-{section.id}">
  <input
    type="text"
    class="edit-title"
    bind:value={title}
    bind:this={titleEl}
    on:keydown={handleKeydown}
    placeholder="Title"
    aria-label="Note title"
    disabled={processing}
  />
  <textarea
    class="edit-content"
    bind:value={content}
    on:keydown={handleKeydown}
    placeholder="Write your note content..."
    aria-label="Note content"
    disabled={processing}
  ></textarea>
  <div class="tags-section">
    <TagInput {tags} on:change={handleTagChange} />
  </div>
  {#if aiMessage}
    <p class="ai-message" class:ai-error={aiError} role="status">{aiMessage}</p>
  {/if}
  <div class="edit-actions">
    <button class="cancel-btn" on:click={() => dispatch('cancel')} disabled={processing}>Cancel</button>
    <button class="enhance-btn" on:click={enhanceWithAI} disabled={processing}>
      <span class="button-content">
        <span>{processing ? 'Enhancing...' : '✦ Enhance with AI'}</span>
        {#if processing}
          <span class="spinner"></span>
        {/if}
      </span>
    </button>
    <button class="save-btn" on:click={save} disabled={processing}>Save</button>
  </div>
</article>

<style>
  .note-editor {
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    border: 1px solid var(--accent);
    box-shadow: 0 0 0 3px var(--accent-subtle);
  }

  .edit-title {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    outline: none;
    margin-bottom: var(--space-md);
    box-sizing: border-box;
    transition: border-color var(--transition);
  }

  .edit-title:focus { border-color: var(--border-focus); }

  .edit-content {
    width: 100%;
    min-height: 120px;
    padding: var(--space-md);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    outline: none;
    resize: vertical;
    margin-bottom: var(--space-md);
    box-sizing: border-box;
    transition: border-color var(--transition);
  }

  .edit-content:focus { border-color: var(--border-focus); }

  .tags-section {
    margin-bottom: var(--space-md);
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .save-btn, .cancel-btn {
    padding: var(--space-sm) var(--space-lg);
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition);
    font-family: var(--font-body);
  }

  .save-btn {
    color: var(--text-on-accent);
    background: var(--accent);
  }
  .save-btn:hover { background: var(--accent-hover); }
  .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .save-btn:disabled:hover { background: var(--accent); }

  .cancel-btn {
    color: var(--text-secondary);
    background: var(--bg-input);
    border: 1px solid var(--border);
  }
  .cancel-btn:hover {
    color: var(--danger);
    border-color: var(--danger);
    background: var(--danger-subtle);
  }
  .cancel-btn:disabled:hover { color: var(--text-secondary); background: var(--bg-input); border-color: var(--border); }

  .enhance-btn {
    padding: var(--space-sm) var(--space-lg);
    font-size: 13px;
    font-weight: 500;
    color: var(--accent);
    background: var(--accent-subtle);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition);
    font-family: var(--font-body);
  }
  .enhance-btn:hover {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .enhance-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .enhance-btn:disabled:hover { background: var(--accent-subtle); color: var(--accent); }

  .button-content {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .ai-message {
    font-size: 13px;
    color: var(--accent);
    margin: 0 0 var(--space-sm);
  }
  .ai-message.ai-error { color: var(--danger); }

  .edit-title:disabled, .edit-content:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
