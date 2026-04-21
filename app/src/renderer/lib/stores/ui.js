import { writable } from 'svelte/store';

function createDarkModeStore() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lexorium-dark-mode') : null;
  let initial;
  if (stored !== null) {
    initial = stored === 'true';
  } else {
    initial = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  const { subscribe, set: _set, update: _update } = writable(initial);

  return {
    subscribe,
    set: (value) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem('lexorium-dark-mode', String(value));
      _set(value);
    },
    update: (fn) => {
      _update(v => {
        const next = fn(v);
        if (typeof localStorage !== 'undefined') localStorage.setItem('lexorium-dark-mode', String(next));
        return next;
      });
    },
  };
}

export const darkMode = createDarkModeStore();
export const showSettings = writable(false);
export const showCompose = writable(false);
export const editingSection = writable(null);
export const sidebarView = writable('notes'); // 'notes' | 'tags'
export const isProcessing = writable(false);
