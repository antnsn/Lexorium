# Copilot Instructions — Lexorium

## Project Overview

Lexorium is a cross-platform Markdown note/snippet manager built with **Tauri 2 + Svelte 5**. It stores documents as portable JSON files. Target platforms: macOS, Windows, Linux.

The repo also contains legacy code (Electron app files at `app/*.js`, SwiftUI native app at `macos-app/`). **All new work uses the Tauri + Svelte codebase.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Svelte 5, Vite 8, ES modules |
| **Backend** | Rust (Tauri 2) |
| **Markdown** | `marked` v14 + `marked-highlight` + `highlight.js` |
| **Styling** | CSS custom properties, scoped Svelte styles |
| **Typography** | Lora (serif display), system sans (body), Fira Code (mono) |
| **Icons** | Font Awesome 6 (CDN — needs vendoring) |
| **Packaging** | Tauri bundler (dmg, msi, deb, AppImage) |

---

## Repository Structure

```
Lexorium/
├── app/                              # Application root
│   ├── src/
│   │   └── renderer/                 # Svelte frontend
│   │       ├── App.svelte            # Root component
│   │       ├── app.css               # Design tokens + global styles
│   │       └── lib/
│   │           ├── components/       # UI components
│   │           │   ├── Sidebar.svelte
│   │           │   ├── Toolbar.svelte
│   │           │   ├── NoteCard.svelte
│   │           │   ├── NoteEditor.svelte
│   │           │   ├── ComposePanel.svelte
│   │           │   ├── TagInput.svelte
│   │           │   ├── TagTree.svelte
│   │           │   ├── SettingsModal.svelte
│   │           │   └── EmptyState.svelte
│   │           ├── services/
│   │           │   ├── platform.js   # ALL backend communication
│   │           │   └── markdown.js   # Markdown rendering
│   │           ├── stores/           # Svelte writable stores
│   │           │   ├── notes.js
│   │           │   ├── tags.js
│   │           │   ├── ui.js
│   │           │   └── settings.js
│   │           └── utils/
│   │               ├── id.js
│   │               └── time.js
│   ├── src-tauri/                    # Rust backend
│   │   ├── src/
│   │   │   ├── lib.rs               # Plugin setup, command registration
│   │   │   ├── main.rs              # Entry point
│   │   │   ├── menu.rs              # Native macOS menus
│   │   │   └── commands/
│   │   │       ├── document.rs      # File I/O commands
│   │   │       ├── ai.rs            # AI provider commands (stub)
│   │   │       └── config.rs        # App config commands
│   │   ├── tauri.conf.json          # Tauri window/build config
│   │   └── capabilities/
│   │       └── default.json         # Permission grants
│   ├── package.json
│   └── vite.config.js
│
├── CLAUDE.md                         # Detailed AI context
├── testNote.json                     # Sample test document
└── readme.md
```

---

## Architecture

### IPC Flow

```
Svelte component → platform.js → Tauri invoke() → Rust command → filesystem
                                  Tauri listen()  ← Rust emit() ← menu event
```

**Rule**: Components never import Tauri APIs directly. All backend calls go through `platform.js`.

### Data Format

JSON files with sections containing Markdown:

```json
{
  "version": "1.0",
  "sections": [
    {
      "id": 1,
      "title": "Title",
      "content": "Markdown with ```code```",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "tags": ["#javascript"]
    }
  ]
}
```

### Key Patterns

- **Platform detection**: `'__TAURI_INTERNALS__' in window` (NOT `__TAURI__` — that's v1)
- **Event system**: Rust `emit()` → frontend `listen()` via `@tauri-apps/api/event`
- **Titlebar overlay**: `data-tauri-drag-region` + `core:window:allow-start-dragging` permission
- **Markdown**: `marked.use(markedHighlight({...}))` — NOT `marked.setOptions({ highlight })`
- **Theming**: CSS variables in `:root` (light) and `body.dark-mode` (dark)

---

## Development

```bash
cd app
npm install
npx tauri dev          # Dev with HMR
npx tauri build        # Production build
```

- `tauri.conf.json` changes → full Rust rebuild (~10s)
- Svelte/JS/CSS changes → Vite HMR (instant)
- Test with `testNote.json` via File → Open

---

## Code Conventions

- **Svelte 5** components with `createEventDispatcher`
- **ES modules**, `const`/`let` (never `var`), semicolons required
- **CSS**: Custom properties for tokens, scoped component styles, global styles in `app.css`
- **Rust**: `#[tauri::command]` async functions, `log::info!()` for debugging
- **Three font stacks**: `--font-display` (Lora), `--font-body` (system sans), `--font-mono` (Fira Code)
- **Desktop-only** — no responsive/mobile breakpoints

---

## Design Principles

1. **Content is sovereign** — Notes and code are center stage. UI chrome recedes.
2. **Warmth through typography** — Lora serif for headings, generous line heights, beautiful Markdown rendering.
3. **Progressive disclosure** — Controls appear on hover/focus. Default state is clean.
4. **Transitions, not teleportation** — Smooth, purposeful animations. Respect `prefers-reduced-motion`.
5. **Polish is the product** — Every pixel matters. Consistent spacing, aligned elements, refined details.

**Primary reference**: [Bear](https://bear.app) — elegant, warm, typography-first.
**Anti-reference**: Jira/Confluence — cluttered, utilitarian, overwhelming.

---

## Known Issues

- AI commands in Rust are stubs (need `reqwest` implementation)
- Dark mode preference not persisted across restarts
- `electron.js` service file is dead code (legacy)
- Debug `console.log` in `platform.js` `listen()` should be removed
- Font Awesome loaded from CDN (needs vendoring for offline)
- Legacy Electron files (`main.js`, `renderer.js`, etc.) still in `app/` root
