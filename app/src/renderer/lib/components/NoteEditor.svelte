<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import TagInput from './TagInput.svelte';

  export let section;

  const dispatch = createEventDispatcher();

  let title = section.title;
  let content = section.content;
  let tags = [...(section.tags || [])];
  let titleEl;

  onMount(() => {
    if (titleEl) titleEl.focus();
  });

  function save() {
    dispatch('save', { id: section.id, title, content, tags });
  }

  function handleTagChange(e) {
    tags = e.detail;
  }

  function handleKeydown(e) {
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
  />
  <textarea
    class="edit-content"
    bind:value={content}
    on:keydown={handleKeydown}
    placeholder="Write your note content..."
    aria-label="Note content"
  ></textarea>
  <div class="tags-section">
    <TagInput {tags} on:change={handleTagChange} />
  </div>
  <div class="edit-actions">
    <button class="cancel-btn" on:click={() => dispatch('cancel')}>Cancel</button>
    <button class="save-btn" on:click={save}>Save</button>
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
</style>
