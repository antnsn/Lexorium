<script>
  import { createEventDispatcher } from 'svelte';
  import TagTree from './TagTree.svelte';

  export let notes = [];
  export let tagTree = null;
  export let selectedTag = null;
  export let hasUndo = false;

  const dispatch = createEventDispatcher();

  let view = 'notes'; // 'notes' | 'tags'
</script>

<aside class="sidebar">
  <div class="titlebar-drag" data-tauri-drag-region></div>
  <div class="sidebar-header">
    <h1 class="logo">Lexorium</h1>
  </div>

  <nav class="sidebar-nav" aria-label="Main navigation">
    <button
      class="nav-btn" class:active={view === 'notes' && !selectedTag}
      on:click={() => { view = 'notes'; dispatch('tagSelect', null); }}
    >
      <i class="fa-solid fa-layer-group"></i>
      <span>All Notes</span>
      <span class="count">{notes.length}</span>
    </button>
    <button
      class="nav-btn" class:active={view === 'tags'}
      on:click={() => { view = 'tags'; }}
    >
      <i class="fa-solid fa-hashtag"></i>
      <span>Tags</span>
    </button>
  </nav>

  {#if view === 'tags'}
    <div class="tag-section">
      {#if tagTree && Object.keys(tagTree.children).length > 0}
        <TagTree
          node={tagTree}
          {selectedTag}
          on:select={(e) => dispatch('tagSelect', e.detail)}
        />
      {:else}
        <div class="tag-empty">
          <p>No tags yet</p>
          <p class="tag-hint">Add <code>#tags</code> in your notes or use the tag input when editing.</p>
        </div>
      {/if}
    </div>
  {/if}

  <div class="note-list">
    {#each notes as note (note.id)}
      <button
        class="toc-item"
        on:click={() => dispatch('noteClick', note.id)}
        title={note.title}
      >
        {note.title}
      </button>
    {/each}
  </div>

  <div class="sidebar-footer">
    {#if hasUndo}
      <button class="footer-btn" on:click={() => dispatch('undo')} title="Undo delete">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    min-width: 200px;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    padding: 0 var(--space-md) var(--space-lg);
    transition: background-color var(--transition);
    overflow: hidden;
    color: var(--sidebar-text);
    box-shadow: 2px 0 6px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }

  .titlebar-drag {
    height: 28px;
    flex-shrink: 0;
    -webkit-app-region: drag;
  }

  .sidebar-header {
    margin-top: var(--space-sm);
    margin-bottom: var(--space-lg);
  }

  .logo {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--space-md);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--transition);
    text-align: left;
    font-family: var(--font-body);
  }

  .nav-btn:hover { background: var(--accent-subtle); }
  .nav-btn.active {
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .nav-btn i { width: 16px; text-align: center; font-size: 12px; }
  .nav-btn .count {
    margin-left: auto;
    font-size: 11px;
    color: var(--sidebar-text-tertiary);
  }

  .tag-section {
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--sidebar-border);
    margin-bottom: var(--space-sm);
    max-height: 200px;
    overflow-y: auto;
  }

  .tag-empty {
    padding: var(--space-md) var(--space-md);
    text-align: center;
  }

  .tag-empty p {
    margin: 0;
    font-size: 12px;
    color: var(--sidebar-text-tertiary);
  }

  .tag-hint {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.4;
  }

  .tag-empty code {
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .note-list {
    flex: 1;
    overflow-y: auto;
  }

  .toc-item {
    display: block;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    margin-bottom: 2px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    text-decoration: none;
    color: var(--sidebar-text);
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-body);
    line-height: 1.4;
    transition: background-color var(--transition);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    text-align: left;
  }

  .toc-item:hover {
    background: var(--accent-subtle);
  }

  .sidebar-footer {
    padding-top: var(--space-sm);
    display: flex;
    gap: var(--space-xs);
  }

  .footer-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--sidebar-text-tertiary);
    cursor: pointer;
    font-size: 13px;
    transition: all var(--transition);
  }

  .footer-btn:hover {
    color: var(--accent);
    background: var(--accent-subtle);
  }
</style>
