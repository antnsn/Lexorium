import { writable } from 'svelte/store';

export const darkMode = writable(false);
export const showSettings = writable(false);
export const showCompose = writable(false);
export const editingSection = writable(null);
export const sidebarView = writable('notes'); // 'notes' | 'tags'
export const isProcessing = writable(false);
