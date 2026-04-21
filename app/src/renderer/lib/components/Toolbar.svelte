<script>
  import { createEventDispatcher } from 'svelte';

  export let composeActive = false;

  const dispatch = createEventDispatcher();

  let searchValue = '';

  function handleSearch() {
    dispatch('search', searchValue);
  }
</script>

<div class="toolbar">
  <div class="toolbar-drag" data-tauri-drag-region></div>
  <div class="toolbar-content">
    <div class="search-wrapper">
      <i class="fa-solid fa-magnifying-glass search-icon"></i>
      <input
        type="text"
        class="search-input"
        placeholder="Search notes..."
        bind:value={searchValue}
        on:input={handleSearch}
        aria-label="Search notes"
      />
    </div>

    <div class="toolbar-actions">
      <button
        class="toolbar-btn" class:active={composeActive}
        on:click={() => dispatch('toggleCompose')}
        title="New note"
        aria-label="New note"
      >
        <i class="fa-solid fa-edit"></i>
      </button>
      <button class="toolbar-btn" on:click={() => dispatch('toggleSort')} title="Sort notes" aria-label="Sort notes">
        <i class="fa-solid fa-arrow-up-wide-short"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-primary);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .toolbar-drag {
    height: 28px;
    flex-shrink: 0;
    -webkit-app-region: drag;
  }

  .toolbar-content {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-xl) var(--space-md);
  }

  .search-wrapper {
    flex: 1;
    position: relative;
    max-width: 400px;
  }

  .search-icon {
    position: absolute;
    left: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    font-size: 12px;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md) var(--space-sm) 34px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--transition), background-color var(--transition);
  }

  .search-input:focus { border-color: var(--border-focus); }
  .search-input::placeholder { color: var(--text-tertiary); }

  .toolbar-actions {
    display: flex;
    gap: var(--space-xs);
  }

  .toolbar-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
    transition: all var(--transition);
  }

  .toolbar-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-subtle);
  }

  .toolbar-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
</style>
