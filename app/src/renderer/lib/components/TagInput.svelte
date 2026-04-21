<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { allTags } from '../stores/tags.js';

  export let tags = [];

  const dispatch = createEventDispatcher();

  let inputValue = '';
  let inputEl;
  let suggestions = [];
  let showSuggestions = false;
  let selectedIndex = -1;

  $: {
    if (inputValue.length > 0) {
      const term = inputValue.toLowerCase().replace(/^#/, '');
      suggestions = $allTags
        .filter((t) => {
          const clean = t.replace(/^#/, '');
          return clean.includes(term) && !tags.includes(t);
        })
        .slice(0, 6);
      showSuggestions = suggestions.length > 0;
    } else {
      suggestions = [];
      showSuggestions = false;
    }
    selectedIndex = -1;
  }

  function addTag(tag) {
    const normalized = tag.toLowerCase().replace(/^#/, '');
    const full = `#${normalized}`;
    if (!normalized || tags.includes(full)) return;
    tags = [...tags, full];
    dispatch('change', tags);
    inputValue = '';
    showSuggestions = false;
    inputEl?.focus();
  }

  function removeTag(tag) {
    tags = tags.filter((t) => t !== tag);
    dispatch('change', tags);
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        addTag(suggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (e.key === 'Escape') {
      showSuggestions = false;
    }
  }

  function handleBlur() {
    // Delay to allow suggestion clicks to register
    setTimeout(() => { showSuggestions = false; }, 150);
  }
</script>

<div class="tag-input-container">
  <div class="tag-chips">
    {#each tags as tag}
      <span class="tag-chip">
        {tag}
        <button class="tag-remove" on:click={() => removeTag(tag)} type="button">×</button>
      </span>
    {/each}
    <input
      bind:this={inputEl}
      bind:value={inputValue}
      on:keydown={handleKeydown}
      on:blur={handleBlur}
      on:focus={() => { if (suggestions.length) showSuggestions = true; }}
      class="tag-text-input"
      placeholder={tags.length === 0 ? 'Add tags… (#design, #project/name)' : 'Add tag…'}
      type="text"
    />
  </div>

  {#if showSuggestions}
    <ul class="tag-suggestions">
      {#each suggestions as suggestion, i}
        <li class:selected={i === selectedIndex}>
          <button type="button" on:mousedown|preventDefault={() => addTag(suggestion)}>
            {suggestion}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tag-input-container {
    position: relative;
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    min-height: 32px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-input);
    transition: border-color var(--transition);
    cursor: text;
  }

  .tag-chips:focus-within {
    border-color: var(--border-focus);
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    background: var(--accent-subtle);
    border-radius: 10px;
    white-space: nowrap;
    user-select: none;
  }

  .tag-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    margin-left: 2px;
    font-size: 13px;
    line-height: 1;
    color: var(--accent);
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity var(--transition);
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .tag-text-input {
    flex: 1;
    min-width: 100px;
    padding: 2px 0;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: transparent;
    border: none;
    outline: none;
  }

  .tag-text-input::placeholder {
    color: var(--text-tertiary);
  }

  .tag-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 4px 0 0;
    padding: 4px 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    list-style: none;
    z-index: 20;
    max-height: 160px;
    overflow-y: auto;
  }

  .tag-suggestions li button {
    display: block;
    width: 100%;
    padding: 6px 12px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--text-primary);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition);
  }

  .tag-suggestions li button:hover,
  .tag-suggestions li.selected button {
    background: var(--accent-subtle);
    color: var(--accent);
  }
</style>
