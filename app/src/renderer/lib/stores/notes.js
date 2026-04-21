import { writable, derived, get } from 'svelte/store';

function createNotesStore() {
  const { subscribe, set, update } = writable({
    version: '1.0',
    sections: [],
  });

  const filePath = writable('');
  const undoStack = writable([]);
  const sortAscending = writable(false);
  const filterText = writable('');

  const sorted = derived(
    [{ subscribe }, sortAscending],
    ([$doc, $asc]) => {
      const copy = [...$doc.sections];
      copy.sort((a, b) => {
        const da = parseTimestamp(a.timestamp);
        const db = parseTimestamp(b.timestamp);
        return $asc ? da - db : db - da;
      });
      return copy;
    }
  );

  const filtered = derived(
    [sorted, filterText],
    ([$sorted, $filter]) => {
      if (!$filter) return $sorted;
      const term = $filter.toLowerCase();
      return $sorted.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.content.toLowerCase().includes(term)
      );
    }
  );

  function parseTimestamp(ts) {
    if (!ts) return new Date(0);
    if (ts.includes('T')) return new Date(ts);
    const [datePart, timePart] = ts.split(' - ');
    if (!datePart || !timePart) return new Date(0);
    const [day, month, year] = datePart.split('.');
    const [hours, minutes] = timePart.split(':');
    return new Date(year, month - 1, day, hours, minutes);
  }

  function timestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function genId() {
    return Math.random().toString(36).substring(2, 11);
  }

  return {
    subscribe,
    filePath,
    undoStack,
    sortAscending,
    filterText,
    sorted,
    filtered,

    load(data, path) {
      const doc = typeof data === 'string' ? JSON.parse(data) : data;
      if (!doc.version) doc.version = '1.0';
      if (!doc.sections) doc.sections = [];
      set(doc);
      filePath.set(path || '');
      undoStack.set([]);
    },

    reset() {
      set({ version: '1.0', sections: [] });
      filePath.set('');
      undoStack.set([]);
    },

    addSection(title, content, tags = []) {
      const section = {
        id: genId(),
        title: title || timestamp(),
        content,
        tags,
        timestamp: timestamp(),
      };
      update((doc) => {
        doc.sections.push(section);
        return doc;
      });
      return section;
    },

    updateSection(id, title, content) {
      update((doc) => {
        const idx = doc.sections.findIndex((s) => s.id === id);
        if (idx !== -1) {
          doc.sections[idx].title = title;
          doc.sections[idx].content = content;
          // Re-extract tags
          doc.sections[idx].tags = extractTags(content);
        }
        return doc;
      });
    },

    deleteSection(id) {
      let deleted = null;
      update((doc) => {
        const idx = doc.sections.findIndex((s) => s.id === id);
        if (idx !== -1) {
          deleted = doc.sections.splice(idx, 1)[0];
        }
        return doc;
      });
      if (deleted) {
        undoStack.update((stack) => [...stack, deleted]);
      }
    },

    undoDelete() {
      let restored = null;
      undoStack.update((stack) => {
        if (stack.length === 0) return stack;
        restored = stack.pop();
        return [...stack];
      });
      if (restored) {
        update((doc) => {
          doc.sections.push(restored);
          return doc;
        });
      }
    },

    toggleSort() {
      sortAscending.update((v) => !v);
    },

    toJSON() {
      return JSON.stringify(get({ subscribe }), null, 2);
    },

    convertMarkdown(markdown) {
      const parts = markdown.split(/(?=## )/);
      const sections = [];
      for (const part of parts) {
        if (!part.trim()) continue;
        const headerMatch = part.match(/^## (.*?)$/m);
        if (!headerMatch) continue;
        const header = headerMatch[1];
        let content = part.substring(part.indexOf('\n') + 1).trim();
        const startMatch = content.match(/<!--\s*start-section-([a-z0-9]+)\s*-->/);
        const endMatch = content.match(/<!--\s*end-section-([a-z0-9]+)\s*-->/);
        const id = startMatch ? startMatch[1] : genId();
        if (startMatch && endMatch) {
          content = content.substring(
            startMatch.index + startMatch[0].length,
            endMatch.index
          ).trim();
        }
        sections.push({
          id,
          title: header,
          content,
          tags: extractTags(content),
          timestamp: timestamp(),
        });
      }
      return { version: '1.0', sections };
    },
  };
}

/** Extract #tags from content. Supports nested tags: #project/lexorium */
export function extractTags(content) {
  if (!content) return [];
  const matches = content.match(/#[a-zA-Z0-9_/]+/g);
  if (!matches) return [];
  // Deduplicate, normalize to lowercase
  return [...new Set(matches.map((t) => t.toLowerCase()))];
}

export const notes = createNotesStore();
