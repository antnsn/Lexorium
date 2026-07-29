<script>
  import { onMount, onDestroy } from 'svelte';
  import { notes } from './lib/stores/notes.js';
  import { tagTree, selectedTag, tagFilteredNotes, allTags } from './lib/stores/tags.js';
  import { settings } from './lib/stores/settings.js';
  import { darkMode, showSettings, showCompose, editingSection, isProcessing } from './lib/stores/ui.js';
  import { platform } from './lib/services/platform.js';
  import Sidebar from './lib/components/Sidebar.svelte';
  import Toolbar from './lib/components/Toolbar.svelte';
  import ComposePanel from './lib/components/ComposePanel.svelte';
  import NoteCard from './lib/components/NoteCard.svelte';
  import NoteEditor from './lib/components/NoteEditor.svelte';
  import SettingsModal from './lib/components/SettingsModal.svelte';
  import EmptyState from './lib/components/EmptyState.svelte';

  let displayedNotes = [];
  let undoAvailable = false;
  let currentFilePath = '';
  let sidebarVisible = true;
  let recentFiles = [];
  let cleanups = [];

  const unsubFilePath = notes.filePath.subscribe(v => currentFilePath = v);
  const unsubUndo = notes.undoStack.subscribe(v => undoAvailable = v.length > 0);

  $: displayedNotes = $tagFilteredNotes;

  // Documents are JSON; fall back to legacy markdown conversion.
  function loadFromContent(content, filePath) {
    try {
      notes.load(JSON.parse(content), filePath);
    } catch {
      notes.load(notes.convertMarkdown(content), filePath);
    }
  }

  onMount(async () => {
    settings.load();
    await loadRecentFiles();

    // Auto-load last opened file
    try {
      const lastPath = await platform.getLastOpenedFile();
      if (lastPath) {
        const result = await platform.openDocument(lastPath);
        if (result?.content) {
          loadFromContent(result.content, result.filePath);
          await loadRecentFiles();
        }
      }
    } catch (err) {
      console.warn('Could not restore last file:', err);
    }

    cleanups.push(await platform.onFileNew(() => {
      notes.reset();
    }));

    cleanups.push(await platform.onFileOpened((data) => {
      if (data?.content) {
        loadFromContent(data.content, data.filePath);
        loadRecentFiles();
      }
    }));

    cleanups.push(await platform.onFileOpenRequest(async () => {
      const result = await platform.openDocument();
      if (result?.content) {
        loadFromContent(result.content, result.filePath);
        await loadRecentFiles();
      }
    }));

    cleanups.push(await platform.onFileSaveRequest(async () => {
      await saveDocument();
    }));

    cleanups.push(await platform.onFileSaveAsRequest(async () => {
      await saveDocumentAs();
    }));

    cleanups.push(await platform.onDarkModeToggle(() => {
      darkMode.update(v => !v);
    }));

    cleanups.push(await platform.onDarkModeChange((isDark) => {
      darkMode.set(isDark);
    }));

    cleanups.push(await platform.onShowSettings(() => {
      showSettings.set(true);
    }));

    cleanups.push(await platform.onToggleSidebar(() => {
      sidebarVisible = !sidebarVisible;
    }));
  });

  onDestroy(() => {
    unsubFilePath();
    unsubUndo();
    cleanups.forEach(fn => fn && fn());
  });

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('dark-mode', $darkMode);
  }

  async function handleAddNote(e) {
    const { title, content, tags, useAI } = e.detail;
    isProcessing.set(true);
    try {
      let finalTitle = title;
      let finalContent = content;

      if (useAI) {
        const result = await platform.processWithAI('', content, title);
        finalTitle = result?.title || title;
        finalContent = result?.response || content;
      }

      notes.addSection(finalTitle, finalContent, tags || []);
      await saveDocument();
      showCompose.set(false);
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Error: ' + (err.message || err));
    } finally {
      isProcessing.set(false);
    }
  }

  async function handleSaveEdit(e) {
    const { id, title, content, tags } = e.detail;
    notes.updateSection(id, title, content, tags || []);
    editingSection.set(null);
    await saveDocument();
  }

  async function handleDelete(e) {
    const { id } = e.detail;
    notes.deleteSection(id);
    await saveDocument();
  }

  async function handleUndo() {
    notes.undoDelete();
    await saveDocument();
  }

  async function saveDocument() {
    if (currentFilePath) {
      await platform.saveDocument(currentFilePath, notes.toJSON());
    } else {
      await saveDocumentAs();
    }
  }

  async function saveDocumentAs() {
    const newPath = await platform.saveDocumentAs(notes.toJSON());
    if (newPath) {
      notes.filePath.set(newPath);
      await loadRecentFiles();
    }
  }

  async function loadRecentFiles() {
    try {
      recentFiles = (await platform.getRecentFiles()) || [];
    } catch {
      recentFiles = [];
    }
  }

  async function openRecentFile(filePath) {
    try {
      const result = await platform.openDocument(filePath);
      if (result?.content) {
        loadFromContent(result.content, result.filePath);
        await loadRecentFiles();
      }
    } catch (err) {
      console.error('Failed to open recent file:', err);
    }
  }

  function handleSearch(e) {
    notes.filterText.set(e.detail);
  }

  function handleTagSelect(e) {
    selectedTag.set(e.detail);
  }
</script>

<div class="app-container">
  {#if sidebarVisible}
    <Sidebar
      notes={displayedNotes}
      tagTree={$tagTree}
      selectedTag={$selectedTag}
      {recentFiles}
      on:tagSelect={handleTagSelect}
      on:noteClick={(e) => {
        const el = document.getElementById(`section-${e.detail}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      on:openRecent={(e) => openRecentFile(e.detail)}
      on:undo={handleUndo}
      on:openSettings={() => showSettings.set(true)}
      hasUndo={undoAvailable}
    />
  {/if}

  <main class="main-area">
    <Toolbar
      on:search={handleSearch}
      on:toggleCompose={() => showCompose.update(v => !v)}
      on:toggleSort={() => notes.toggleSort()}
      composeActive={$showCompose}
    />

    {#if $showCompose}
      <ComposePanel
        on:submit={handleAddNote}
        on:cancel={() => showCompose.set(false)}
        processing={$isProcessing}
      />
    {/if}

    <div class="document-view">
      {#if displayedNotes.length === 0}
        <EmptyState on:compose={() => showCompose.set(true)} />
      {:else}
        {#each displayedNotes as section (section.id)}
          {#if $editingSection === section.id}
            <NoteEditor
              {section}
              on:save={handleSaveEdit}
              on:cancel={() => editingSection.set(null)}
            />
          {:else}
            <NoteCard
              {section}
              on:edit={() => editingSection.set(section.id)}
              on:delete={handleDelete}
            />
          {/if}
        {/each}
      {/if}
    </div>
  </main>
</div>

{#if $showSettings}
  <SettingsModal on:close={() => showSettings.set(false)} />
{/if}

<style>
  .app-container {
    display: flex;
    height: 100vh;
    width: 100%;
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
    transition: background-color var(--transition);
  }

  .document-view {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl) var(--space-xl) var(--space-2xl);
  }
</style>
