import { derived } from 'svelte/store';
import { notes } from './notes.js';

/**
 * Derived store that builds a tag tree from all notes.
 * Each tag is in the form #topic or #topic/subtopic.
 * The tree structure:
 * { name, fullPath, count, children: { ... } }
 */
export const tagTree = derived(notes, ($doc) => {
  const counts = new Map();

  for (const section of $doc.sections) {
    const tags = section.tags || [];
    for (const tag of tags) {
      const key = tag.startsWith('#') ? tag : `#${tag}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const root = { name: 'Tags', fullPath: '', count: 0, children: {} };

  for (const [tag, count] of counts) {
    const path = tag.replace(/^#/, '');
    const parts = path.split('/');
    let node = root;
    let accumulated = '#';

    for (let i = 0; i < parts.length; i++) {
      accumulated += (i === 0 ? '' : '/') + parts[i];
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = {
          name: parts[i],
          fullPath: accumulated,
          count: 0,
          children: {},
        };
      }
      node = node.children[parts[i]];
    }
    node.count += count;
  }

  return root;
});

/** All unique tags as flat sorted list */
export const allTags = derived(notes, ($doc) => {
  const set = new Set();
  for (const section of $doc.sections) {
    for (const tag of section.tags || []) {
      set.add(tag);
    }
  }
  return [...set].sort();
});

/** Currently selected tag filter */
import { writable } from 'svelte/store';
export const selectedTag = writable(null);

/** Notes filtered by selected tag */
export const tagFilteredNotes = derived(
  [notes.filtered, selectedTag],
  ([$filtered, $tag]) => {
    if (!$tag) return $filtered;
    return $filtered.filter((s) =>
      (s.tags || []).some((t) => t === $tag || t.startsWith($tag + '/'))
    );
  }
);
