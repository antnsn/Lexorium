<script>
  import { createEventDispatcher } from 'svelte';

  export let node;
  export let selectedTag = null;
  export let depth = 0;

  const dispatch = createEventDispatcher();

  $: children = Object.values(node.children || {});
  $: hasChildren = children.length > 0;

  let expanded = depth < 2;

  function toggle() {
    if (hasChildren) expanded = !expanded;
  }

  function select(tag) {
    dispatch('select', tag);
  }
</script>

{#if depth > 0}
  <div class="tag-item" class:active={selectedTag === node.fullPath} style="padding-left: {depth * 16}px">
    <div class="tag-row">
      {#if hasChildren}
        <button type="button" class="chevron" class:open={expanded} on:click={toggle} aria-label="{expanded ? 'Collapse' : 'Expand'} {node.name}" aria-expanded={expanded}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      {:else}
        <span class="dot"></span>
      {/if}
      <button class="tag-btn" on:click={() => select(node.fullPath)}>
        <span class="tag-name">{node.name}</span>
        {#if node.count > 0}
          <span class="tag-count">{node.count}</span>
        {/if}
      </button>
    </div>
  </div>
{/if}

{#if expanded && hasChildren}
  {#each children as child (child.fullPath)}
    <svelte:self node={child} {selectedTag} depth={depth + 1} on:select />
  {/each}
{/if}

<style>
  .tag-item {
    margin-bottom: 1px;
  }

  .tag-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .tag-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text-secondary);
    font-size: 12px;
    font-family: var(--font-body);
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }

  .tag-btn:hover {
    background: var(--accent-subtle);
    color: var(--sidebar-text);
  }

  .tag-item.active .tag-btn {
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font-size: 8px;
    cursor: pointer;
    transition: transform var(--transition);
  }

  .chevron.open { transform: rotate(90deg); }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--sidebar-text-tertiary);
    margin: 0 4px;
  }

  .tag-name { flex: 1; }

  .tag-count {
    font-size: 10px;
    color: var(--sidebar-text-tertiary);
  }
</style>
