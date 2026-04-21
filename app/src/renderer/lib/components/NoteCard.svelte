<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { renderMarkdown, highlightTags } from '../services/markdown.js';
  import { relativeTime } from '../utils/time.js';
  import { openExternalLink } from '../services/platform.js';

  export let section;

  const dispatch = createEventDispatcher();

  let confirmingDelete = false;
  let confirmTimer = null;

  $: html = highlightTags(renderMarkdown(section.content));

  function handleDelete() {
    if (confirmingDelete) {
      clearTimeout(confirmTimer);
      confirmingDelete = false;
      dispatch('delete', { id: section.id });
    } else {
      confirmingDelete = true;
      confirmTimer = setTimeout(() => { confirmingDelete = false; }, 3000);
    }
  }

  onDestroy(() => {
    if (confirmTimer) clearTimeout(confirmTimer);
  });

  function copyCode(e) {
    const btn = e.target.closest('.copy-button');
    if (!btn || btn.dataset.copying) return;
    const code = btn.closest('pre')?.querySelector('code');
    if (!code) return;
    btn.dataset.copying = '1';
    navigator.clipboard.writeText(code.textContent);
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⧉'; delete btn.dataset.copying; }, 1500);
  }

  function handleClick(e) {
    // Handle tag clicks
    const tagEl = e.target.closest('.tag-link');
    if (tagEl) {
      const tag = tagEl.dataset.tag;
      if (tag) {
        // Could dispatch tag select event
      }
      return;
    }

    // Handle external links
    const link = e.target.closest('a');
    if (link && link.href?.startsWith('http')) {
      e.preventDefault();
      openExternalLink(link.href);
    }

    // Handle copy buttons
    if (e.target.closest('.copy-button')) {
      copyCode(e);
    }
  }
</script>

<article class="note-card" id="section-{section.id}">
  <div class="section-header">
    <div class="header-left">
      <h2>{section.title}</h2>
      {#if section.timestamp}
        <span class="timestamp">{relativeTime(section.timestamp)}</span>
      {/if}
    </div>
    <div class="section-controls">
      <button class="edit-btn" on:click={() => dispatch('edit')} title="Edit">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button
        class="delete-btn"
        class:confirming={confirmingDelete}
        on:click={handleDelete}
        title={confirmingDelete ? 'Click again to confirm' : 'Delete'}
      >
        {#if confirmingDelete}
          <span class="confirm-label">Delete?</span>
        {:else}
          <i class="fa-solid fa-trash"></i>
        {/if}
      </button>
    </div>
  </div>

  {#if section.tags?.length > 0}
    <div class="tags-row">
      {#each section.tags as tag}
        <span class="tag-badge">{tag}</span>
      {/each}
    </div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="markdown-body" role="region" on:click={handleClick}>
    {@html html}
  </div>
</article>

<style>
  .note-card {
    position: relative;
    padding: var(--space-lg);
    margin-bottom: var(--space-md);
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    overflow-x: auto;
    transition: border-color var(--transition), box-shadow var(--transition);
  }

  .note-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .header-left { flex: 1; }

  .section-header h2 {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .timestamp {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 2px;
    display: block;
  }

  .section-controls {
    display: flex;
    gap: var(--space-xs);
    opacity: 0;
    transition: opacity var(--transition);
  }

  .note-card:hover .section-controls,
  .note-card:focus-within .section-controls { opacity: 1; }

  .edit-btn, .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .edit-btn:hover {
    color: var(--accent);
    background: var(--accent-subtle);
  }

  .delete-btn:hover {
    color: var(--danger);
    background: var(--danger-subtle);
  }

  .delete-btn.confirming {
    width: auto;
    min-width: 36px;
    padding: 0 var(--space-sm);
    color: var(--text-on-accent);
    background: var(--danger);
    border-radius: var(--radius-md);
    animation: pulse-confirm 1s ease infinite;
  }
  .delete-btn.confirming:hover {
    background: color-mix(in oklch, var(--danger), black 15%);
  }

  .confirm-label {
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    font-family: var(--font-body);
  }

  @keyframes pulse-confirm {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: var(--space-sm);
  }

  .tag-badge {
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-weight: 500;
  }
</style>
