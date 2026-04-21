<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="empty-state">
  <div class="empty-icon">
    <i class="fa-regular fa-note-sticky"></i>
  </div>
  <h3>No notes yet</h3>
  <p>Create your first note to get started</p>
  <button class="create-btn" on:click={() => dispatch('compose')}>
    <i class="fa-solid fa-edit"></i>
    New Note
  </button>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    text-align: center;
    min-height: 300px;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--text-tertiary);
    margin-bottom: var(--space-lg);
    opacity: 0.5;
  }

  h3 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-sm);
  }

  p {
    color: var(--text-secondary);
    margin: 0 0 var(--space-lg);
    font-size: 14px;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
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

  .create-btn:hover { background: var(--accent-hover); }
</style>
