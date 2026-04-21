# CLAUDE.md — Lexorium

> Context for AI assistants working on the Lexorium codebase.
> Covers architecture, conventions, build commands, known issues, and design principles.

---

## What Is Lexorium?

Lexorium is a Markdown-powered note and code snippet manager built with **Tauri 2 + Svelte 5**. It stores documents as portable JSON files containing titled sections with Markdown content. Cross-platform: macOS, Windows, Linux.

The repository also contains a **legacy Electron app** (v3.0.4, `app/*.js`) and an **experimental SwiftUI native app** (`macos-app/`). Both are superseded by the Tauri 2 rewrite. **All new work happens in the Tauri + Svelte codebase.**

---

## Quick Reference

### Build & Run

```bash
cd app && npm install
npx tauri dev          # Dev mode with HMR
npx tauri build        # Production build
```

### Key Paths — Tauri + Svelte App

| What | Path |
|------|------|
| **Frontend entry** | `app/src/renderer/App.svelte` |
| **Design tokens / CSS** | `app/src/renderer/app.css` |
| **Platform abstraction** | `app/src/renderer/lib/services/platform.js` |
| **Markdown renderer** | `app/src/renderer/lib/services/markdown.js` |
| **Svelte stores** | `app/src/renderer/lib/stores/` (notes, tags, ui, settings) |
| **UI components** | `app/src/renderer/lib/components/` |
| **Rust backend entry** | `app/src-tauri/src/lib.rs` |
| **Rust commands** | `app/src-tauri/src/commands/` (document, ai, config) |
| **Native menus** | `app/src-tauri/src/menu.rs` |
| **Tauri config** | `app/src-tauri/tauri.conf.json` |
| **Capabilities/permissions** | `app/src-tauri/capabilities/default.json` |
| **Vite config** | `app/vite.config.js` |
| **Package manifest** | `app/package.json` |

### Key Paths — Legacy (reference only)

| What | Path |
|------|------|
| Electron main process | `app/main.js` |
| Electron UI (monolith) | `app/renderer.js` |
| Electron styles | `app/styles.css` |
| Electron AI provider | `app/ai-provider.js`, `app/chatgpt.js` |
| Native macOS app | `macos-app/` |

---

## Architecture

### Frontend (Svelte 5)

**Two-panel layout**: persistent dark sidebar (note list, tags, navigation) + main content area (toolbar, note cards, compose panel). Titlebar overlay mode for Bear-like appearance (traffic lights float over sidebar).

**Component tree:**
```
App.svelte
├── Sidebar.svelte          — Logo, nav, note list, tag tree
│   └── TagTree.svelte      — Hierarchical tag browser
├── Toolbar.svelte          — Search bar, compose/sort buttons
├── ComposePanel.svelte     — New note input (title + markdown + tags)
│   └── TagInput.svelte     — Tag autocomplete input
├── NoteCard.svelte         — Rendered markdown note with edit/delete
├── NoteEditor.svelte       — Inline section editor
├── SettingsModal.svelte    — AI config, theme, preferences
└── EmptyState.svelte       — "No notes" placeholder
```

**Stores** (Svelte writable stores):
- `notes.js` — Document state, sections, undo stack, file path
- `tags.js` — Tag tree, selected tag, filtered notes, all tags list
- `ui.js` — Dark mode, modal visibility, compose state, processing flag
- `settings.js` — App settings (persisted via Rust `get_app_config`/`set_app_config`)

**Services:**
- `platform.js` — ALL backend communication. Wraps Tauri `invoke()` and `listen()`. Components never import Tauri APIs directly. Falls back to no-ops in browser dev mode.
- `markdown.js` — Renders markdown via `marked` v14 + `marked-highlight` + `highlight.js`.

### Backend (Rust / Tauri 2)

**Commands** (invoked from frontend via `platform.js`):
- `document.rs` — `open_document`, `save_document`, `get_recent_files`, `get_last_opened_file`, `save_last_opened_file`
- `ai.rs` — `ai_process`, `get_ai_config`, `set_ai_config` (stub — needs reqwest implementation)
- `config.rs` — `get_app_config`, `set_app_config`

**Menu** (`menu.rs`):
- Native macOS menus: Lexorium, File, Edit, View, Help
- Custom items emit events to frontend: `file-new`, `file-open-request`, `file-save-request`, `dark-mode-toggle`, `toggle-sidebar`, `show-settings`
- `PredefinedMenuItem` items (undo, copy, paste) have native behavior — they don't fire `on_menu_event`

**Config/data storage:**
- App config: `~/.config/com.antnsn.lexorium/`
- Last opened file: `~/.config/com.antnsn.lexorium/last_opened.txt`
- Documents: user-chosen JSON files (portable, cloud-sync friendly)

### IPC Flow

```
Svelte component → platform.js → Tauri invoke() → Rust command → filesystem
                                  Tauri listen()  ← Rust emit() ← menu event
```

### Data Format

```json
{
  "version": "1.0",
  "sections": [
    {
      "id": 1,
      "title": "Section Title",
      "content": "Markdown text with ```code blocks```",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "tags": ["#javascript", "#patterns"]
    }
  ]
}
```

- JSON files — portable, cloud-sync friendly (OneDrive, Dropbox, iCloud)
- Section `id` is an integer (auto-incremented)
- `content` is raw Markdown (rendered at display time)
- `tags` is an optional string array
- `testNote.json` in repo root is a working test document

---

## Critical Knowledge

### Tauri 2 `isTauri()` Detection

```javascript
// CORRECT for Tauri 2:
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// WRONG (Tauri v1 — will silently no-op all backend calls):
const isTauri = () => '__TAURI__' in window;
```

Tauri v2 uses `window.__TAURI_INTERNALS__` for IPC. `window.__TAURI__` only exists when `app.withGlobalTauri: true` is set in config. The `@tauri-apps/api` package uses `__TAURI_INTERNALS__` directly.

### Tauri 2 Permissions

Capabilities live in `app/src-tauri/capabilities/default.json`. Current permissions:
```json
["core:default", "core:menu:default", "core:event:default",
 "core:window:allow-start-dragging", "dialog:default", "shell:allow-open"]
```
- `core:window:allow-start-dragging` — Required for `data-tauri-drag-region` window dragging
- New Tauri features may need additional permissions added here

### Titlebar Overlay (Bear-like)

- `"titleBarStyle": "Overlay"` + `"hiddenTitle": true` in `tauri.conf.json`
- Content needs ~28px top padding for traffic light buttons
- `data-tauri-drag-region` attribute + `-webkit-app-region: drag` CSS enables window dragging
- Interactive elements inside drag regions need `-webkit-app-region: no-drag`

### Markdown Rendering

- `marked` v14 removed the `highlight` option from `setOptions()` — use `marked-highlight` extension
- `marked.use(markedHighlight({ highlight(code, lang) { ... } }))` is the correct pattern
- hljs token CSS is defined in `app.css` (not an imported theme) for full dark/light control

### Event System

- Rust: `app_handle.emit("event-name", payload)` broadcasts to all webviews
- Frontend: `listen("event-name", callback)` via `@tauri-apps/api/event`
- Payload must implement `Serialize + Clone` — string payloads work reliably
- All event listeners are registered in `App.svelte`'s `onMount`

---

## Code Conventions

### Svelte / JavaScript

- **Svelte 5** with `createEventDispatcher` for component events
- ES modules (`import`/`export`), no CommonJS
- `const` / `let` (never `var`), semicolons required
- All backend calls go through `platform.js` — never import Tauri APIs in components
- Stores in `lib/stores/`, services in `lib/services/`, components in `lib/components/`
- Reactive declarations: `$: derived = expression;`

### Rust

- Commands are `#[tauri::command]` async functions in `src/commands/`
- Use `log::info!()` for debugging (visible in terminal during `tauri dev`)
- Menu creation in `menu.rs`, registered in `lib.rs` `setup()`
- All commands registered in `lib.rs` `invoke_handler`

### CSS

- Custom properties (design tokens) in `:root`, dark overrides in `body.dark-mode`
- Three font stacks: `--font-display` (Lora serif), `--font-body` (system sans), `--font-mono` (Fira Code)
- Spacing scale: `--space-xs` (4px) through `--space-2xl` (48px)
- Component styles scoped in Svelte `<style>` blocks
- Global styles in `app.css` (markdown body, code highlighting, scrollbars)
- Desktop-only — no responsive/mobile breakpoints needed

### Git

- Main development branch: `svelte-tauri-rewrite`
- Feature branches off `svelte-tauri-rewrite`
- Commit messages: conventional commits style

---

## When Working on This Codebase

### Before You Change Anything

1. **Work in `app/`** — all new development is Tauri + Svelte
2. **Test both themes** — toggle dark/light via View → Dark Mode (Cmd+Shift+D)
3. **Use `testNote.json`** — load via File → Open for testing
4. **Check the dev server** — `npx tauri dev` in `app/`

### Gotchas

- Svelte component styles are scoped — global styles must go in `app.css`
- `platform.js` functions return `null` when running without Tauri backend (browser-only dev)
- `tauri.conf.json` changes trigger a full Rust rebuild (~10s)
- Svelte/JS/CSS changes use Vite HMR (instant)
- The `marked-highlight` extension is required for syntax highlighting in marked v14+
- Section IDs are integers, not UUIDs
- No auto-save — users Cmd+S / Ctrl+S or use File → Save
- Tags are optional per section — handle `section.tags` as potentially undefined

### Adding New Features

1. **Frontend-only**: Add component in `lib/components/`, wire into `App.svelte`
2. **Needs backend**: Add Rust command in `src/commands/`, register in `lib.rs`, add wrapper in `platform.js`
3. **New Tauri permission**: Add to `capabilities/default.json`
4. **New menu item**: Add to `menu.rs`, add event listener in `App.svelte`
5. **Always**: Test both themes, check for Svelte compile warnings

---

## Known Issues & TODOs

### Current Issues

- `app/src/renderer/lib/services/electron.js` — dead file from Electron era, should be deleted
- Unused CSS selectors in `Sidebar.svelte`: `.undo-container`, `.undo-btn`, `.undo-btn:hover`
- TagTree a11y: `<span>` with click handler needs ARIA role and keyboard handler
- `struct Document` in `document.rs` is never constructed (warning)
- Debug `console.log` statements in `platform.js` `listen()` — remove before release
- Dark mode preference not persisted (resets on restart)
- AI commands in Rust are stubs — need `reqwest` HTTP implementation

### Legacy Files (safe to delete)

- `app/main.js`, `app/renderer.js`, `app/styles.css`, `app/index.html` — old Electron app
- `app/preload.js`, `app/menu.js`, `app/chatgpt.js`, `app/ai-provider.js`, `app/utils.js`, `app/config.js`
- `app/forge.config.js` — Electron Forge config
- `app/src/renderer/lib/services/electron.js` — dead Electron service
- `macos-app/` — experimental SwiftUI app (superseded)

### Roadmap

1. **AI integration** — Port `ai-provider.js` logic to Rust with `reqwest` for HTTP calls
2. **Persist preferences** — Dark mode, sidebar state, window size saved to config
3. **Recent files** — File → Recent submenu using `get_recent_files` command
4. **Code block copy button** — Add copy button to rendered code blocks in NoteCard
5. **Polish** — Vendor Font Awesome, code-split highlight.js, clean up dead files
6. **CI/CD** — Update GitHub Actions for Tauri builds (macOS, Windows, Linux)

---

## Design Context

### Users

Individual developers who want a beautiful, organized way to manage code snippets and technical notes. They reach for Lexorium when they need to capture, categorize, and retrieve code patterns, solutions, and documentation fragments across projects. These are developers who care about their tools — they want something that feels crafted, not just functional. They value portable data (JSON files that sync via OneDrive/Dropbox/iCloud).

### Brand Personality

**Technical, Refined, Thoughtful.**

Lexorium should feel like a precision instrument made by someone who deeply understands developers. Every interaction should feel intentional. The interface communicates competence through restraint — no clutter, no unnecessary elements, no visual noise. It earns trust through polish, not through feature density.

**Emotional goal**: Delight through craft. When a developer opens Lexorium, they should feel like they're using something beautifully made — the kind of app you want to show someone. Think of the satisfaction of a well-designed mechanical keyboard or a perfectly typeset book.

### Aesthetic Direction

**Primary reference**: [Bear](https://bear.app) — elegant typography, warm atmosphere, beautiful Markdown rendering, and a sense of calm sophistication. Bear proves that a note app can feel genuinely premium. Specifically: the persistent dark sidebar, the titlebar overlay with traffic lights over content, the generous whitespace, and the typography-first design.

**Anti-reference**: Jira, Confluence, and other cluttered enterprise tools. Lexorium must never feel busy, overwhelming, or utilitarian. No information overload, no competing visual hierarchies, no "dashboard syndrome."

**Visual tone**: Cool slate sidebar (#2E3235) with warm terracotta accent (#D4654A). Lora serif for display/headings, system sans-serif for body/UI, Fira Code for code. The palette balances code-editor familiarity with typographic warmth.

**Theme**: Both dark and light modes. Dark mode is the hero experience. Sidebar is always dark regardless of theme.

### Design Tokens (Current)

```css
/* Typography */
--font-display: "Lora", Georgia, serif;          /* Headings, logo */
--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;  /* UI, prose */
--font-mono: "Fira Code", "SF Mono", monospace;  /* Code blocks */

/* Colors — Light Mode */
--bg-primary: #FFFFFF;       --bg-secondary: #2E3235;    /* sidebar always dark */
--bg-elevated: #FFFFFF;      --bg-input: #F4F5F6;
--text-primary: #1A1D20;     --text-secondary: #6B7280;
--accent: #D4654A;           --link: #5B7E9E;
--code-bg: #F4F5F6;          --danger: #C0392B;

/* Colors — Dark Mode (body.dark-mode) */
--bg-primary: #2E3235;       --bg-elevated: #363A3E;
--text-primary: #E2E5E9;     --link: #7EB5D6;
--code-bg: #23272A;

/* Spacing */
--space-xs: 4px;  --space-sm: 8px;  --space-md: 16px;
--space-lg: 24px; --space-xl: 32px; --space-2xl: 48px;

/* Radii & Motion */
--radius-sm: 4px;  --radius-md: 8px;  --radius-lg: 12px;
--transition: 0.2s ease;
```

### Accessibility

**WCAG AA compliance** is required:
- Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text
- All interactive elements must be keyboard accessible
- Focus indicators must be visible and high-contrast
- Support `prefers-reduced-motion` — disable transitions/animations when set
- Ensure color is never the sole indicator of state (add icons, text, or patterns)
- Code blocks must remain readable in both themes with sufficient contrast

### Design Principles

1. **Content is sovereign** — The user's notes and code are the center of attention. UI chrome should recede. Maximize the reading/writing area; minimize controls, borders, and decorative elements.

2. **Warmth through typography** — Invest in beautiful type rendering. Generous line heights, considered font sizes, elegant Markdown output. Code in monospace; prose and UI in a warm proportional face. Typography IS the design.

3. **Progressive disclosure** — Show only what's needed at each moment. Editing controls appear on hover/focus. Settings live in modals, not sidebars. The default state is clean and quiet.

4. **Transitions, not teleportation** — Smooth, purposeful animations for state changes (opening sections, switching themes, showing/hiding panels). Motion should feel natural and unhurried — never flashy. Respect `prefers-reduced-motion`.

5. **Polish is the product** — Every pixel matters. Consistent spacing, aligned elements, considered shadows, refined borders. The difference between good and great is in the details that most users feel but can't articulate.
