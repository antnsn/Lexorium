# CLAUDE.md — Lexorium

> This file provides context for Claude (Anthropic) when working on the Lexorium codebase.
> It covers architecture, critical bugs, conventions, build commands, and strategic guidance.

---

## What Is Lexorium?

Lexorium is a Markdown-powered note and code snippet manager. It stores documents as JSON files containing titled sections with Markdown content. The repository houses **two separate applications**:

1. **Electron app** (`app/`) — The production application (v3.0.4). Cross-platform (macOS, Windows, Linux). Built with vanilla JavaScript, jQuery, and CDN-loaded libraries. Shipped via GitHub Releases, Homebrew cask, and WinGet.

2. **macOS native app** (`macos-app/`) — An experimental SwiftUI rewrite. Uses SQLite (GRDB) instead of JSON files, Keychain for secrets, and Metal for animations. Not yet shipped.

These two apps share a repository but share **zero code or data layer**. The Electron app's JSON format can be imported into the native app via `JSONImporter`.

---

## Quick Reference

### Build & Run

```bash
# Electron app
cd app && npm install && npm start

# macOS native app
cd macos-app && swift build && swift test
```

### Key Paths

| What | Path |
|------|------|
| Electron main process | `app/main.js` |
| Electron UI (monolith) | `app/renderer.js` |
| Electron styles | `app/styles.css` |
| Electron preload/IPC bridge | `app/preload.js` |
| Electron app menu | `app/menu.js` |
| Electron AI integration | `app/chatgpt.js`, `app/ai-provider.js` |
| Electron config helper | `app/utils.js` |
| Native app entry point | `macos-app/Sources/AppExec/AppMain.swift` |
| Native app main view | `macos-app/Sources/AppUI/MainContentView.swift` |
| Native database layer | `macos-app/Sources/StorageKit/DatabaseManager.swift` |
| Native data model | `macos-app/Sources/StorageKit/Note.swift` |
| CI/CD release pipeline | `.github/workflows/release.yml` |

---

## Electron App — Deep Architecture

### How It Works

The Electron app uses a **three-column layout**: left TOC sidebar, center document view, right input panel. Documents are JSON files containing an array of sections, each with Markdown content that gets rendered via `marked.parse()` with `highlight.js` for code blocks.

### IPC Flow

```
main.js ←IPC→ preload.js (contextBridge) ←→ renderer.js
```

`preload.js` exposes `window.electronAPI` with:
- `openFile()` — shows open file dialog, returns `{ filePath, data }`
- `saveFile(data)` — shows save dialog, writes JSON
- `saveToPath(filePath, data)` — writes JSON to specific path
- `getConfig()` / `setConfig(config)` — reads/writes config.json
- `onFileOpened(callback)` — listens for files opened from menu/recent

### Data Format

```json
{
  "version": "1.0",
  "sections": [
    {
      "id": 1,
      "title": "Title",
      "content": "Markdown text with ```code```",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

- Section `id` is an **integer** (auto-incremented via `Math.max(...ids) + 1`)
- `content` is raw Markdown text (rendered at display time)
- `timestamp` is ISO 8601
- See `testNote.json` in repo root for a working example

### State Management

All state is global variables in `renderer.js`:

```javascript
let currentDocument = null;   // The loaded JSON document
let currentFilePath = null;   // Path to the open file
```

There is no state management pattern — any function can read/write these globals. When modifying sections, you must update `currentDocument.sections` and then call `renderDocument(currentDocument)` to re-render.

### Theming

- CSS custom properties in `:root` (light) and `.dark-mode` (dark)
- One Dark / One Light color palette
- Toggle: `document.body.classList.toggle('dark-mode')`
- Persisted in config.json

### AI Integration (`chatgpt.js` + `ai-provider.js`)

- Multi-provider support: **OpenAI**, **Anthropic**, and **OpenRouter**
- Provider abstraction in `ai-provider.js` with factory pattern
- `chatgpt.js` orchestrates config, client lifecycle, and message routing
- Each provider stores its own API key and model in `config.json`
- OpenAI and OpenRouter use the `openai` npm SDK; Anthropic uses `@anthropic-ai/sdk`
- OpenRouter reuses OpenAI SDK with custom `baseURL` and attribution headers
- Backward compatible: legacy `openaiApiKey` config field still works
- API keys stored in `config.json` (plaintext — this is a pre-existing security issue)
- Settings modal allows switching providers, models, and API keys

---

## macOS Native App — Deep Architecture

### SPM Module Layout

```
Package.swift
├── AppExec      → App entry, window configuration
├── AppUI        → SwiftUI views (MainContentView, SettingsView)
├── StorageKit   → DatabaseManager, Note model, JSONImporter, Keychain
└── RendererKit  → MetalView (animated gradient background)
```

### Database (GRDB + SQLite)

- WAL journal mode for concurrent reads
- FTS5 full-text search index on `title` and `content`
- Auto-migrations at startup
- Thread-safe singleton `DatabaseManager`

### Key Differences from Electron App

| Aspect | Electron | Native |
|--------|----------|--------|
| Data storage | JSON files | SQLite (GRDB) |
| Note IDs | Integers | UUID strings |
| API key storage | Plaintext JSON | Keychain |
| Search | Client-side string match | FTS5 full-text search |
| Offline support | ❌ (CDN deps) | ✅ |
| CI/CD | ✅ | ❌ |
| AI integration | Working (gpt-4) | Stub (print statement) |
| Delete notes | ✅ (with confirmation) | ❌ (not implemented) |

---

## Critical Bugs — Fix These First

These are real bugs I found during code analysis, not style opinions.

### 1. `loadDocument()` Ignores File Path (renderer.js ~L88)

```javascript
// BUG: Opens file dialog instead of reading the provided filePath
async function loadDocument(filePath) {
  const result = await window.electronAPI.openFile(); // ← ignores filePath!
  // Should use filePath when provided, dialog only when filePath is null
}
```

**Impact**: Recent files menu, "file-opened" IPC events, and any programmatic file loading don't work. They all trigger a file dialog instead of loading the specified file.

### 2. Triple Undo Event Listener (renderer.js L592, L723, L756)

The undo button gets three identical `addEventListener('click', ...)` calls. On click, the undo action fires three times. Remove the duplicates at L723 and L756.

### 3. `filterNotes()` Selector Bug (renderer.js ~L543)

```javascript
// BUG: TOC items ARE <a> elements, they don't CONTAIN <a> elements
items.forEach(item => {
  const text = item.querySelector('a')?.textContent; // ← returns null
  // Should be: const text = item.textContent;
});
```

**Impact**: Search/filter functionality is broken — it matches nothing.

### 4. CSS `.dark-mode body` Never Matches (styles.css)

```css
/* BUG: dark-mode is applied TO body, not a parent of body */
.dark-mode body { ... }  /* ← never matches */
/* Should be: body.dark-mode { ... } */
```

### 5. Duplicate CSS Blocks

`.input-controls` and `.copy-button` are each defined twice with different properties. The later definition silently wins. Consolidate into single blocks.

### 6. Dead Code

- `updateDocumentView()` (renderer.js ~L182-261) — alternate render path, never called
- `saveToFile()` (renderer.js ~L562-589) — duplicates `saveDocument()`, never called
- `macos-app/LXNative/` — legacy Xcode project stub, superseded by SPM package

---

## Code Conventions to Follow

### JavaScript (Electron App)

- Vanilla JavaScript — no framework, no build step
- `const` / `let` (never `var`)
- Functions at module level (no classes)
- `window.electronAPI.*` for all IPC
- `marked.parse()` for Markdown → HTML
- `hljs.highlightElement(el)` for code highlighting
- Template literals for HTML construction
- Mix of jQuery `$()` and vanilla `document.querySelector()` (prefer vanilla when adding new code)
- Semicolons present but inconsistent — **use semicolons**
- No TypeScript (yet)

### Swift (macOS Native App)

- SwiftUI declarative patterns
- `@Observable` macro for state objects
- GRDB record protocol conformance for database models
- `async`/`await` for database operations
- Module boundaries enforced by SPM targets

### CSS

- Custom properties for theming (`--bg-primary`, `--text-primary`, etc.)
- Dark mode: `.dark-mode` class on `<body>`, override variables
- No CSS framework, no preprocessor
- Desktop-only — no responsive/mobile breakpoints

---

## When Working on This Codebase

### Before You Change Anything

1. **Identify which app** — Electron (`app/`) or native (`macos-app/`)
2. **Check known bugs** — your change might interact with existing issues listed above
3. **Test both themes** — toggle dark/light mode to verify styling
4. **Use `testNote.json`** — load it as a test document

### Gotchas

- `currentDocument` is the global state — always update it before calling `renderDocument()`
- Section IDs are integers, not UUIDs — new sections use `Math.max(...existingIds) + 1`
- `marked.parse()` → `innerHTML` is an XSS vector — no sanitization exists
- No auto-save — users must Cmd+S / Ctrl+S
- All `window.electronAPI` methods return Promises (use `await`)
- CDN-loaded libs (jQuery, marked, hljs, Font Awesome, autosize) won't be available offline
- The Electron app has **no tests** — verify changes manually
- `marked.setOptions()` is called twice in renderer.js — consolidate to one call

### Adding New Features

When adding a feature to the **Electron app**:
1. Add IPC channel to `main.js` (handler) + `preload.js` (bridge) if needed
2. Add UI logic to `renderer.js` (or a new module if you're refactoring)
3. Add styles to `styles.css` with both light and dark theme variants
4. Test with `npm start`

When adding a feature to the **native app**:
1. Determine the correct module (AppUI for views, StorageKit for data)
2. Follow the existing GRDB patterns for data operations
3. Add tests in `Tests/StorageKitTests/` for data layer changes
4. Test with `swift build && swift test`

---

## Strategic Recommendations

### React or Not?

**The current app doesn't need React.** The problems are architectural, not framework-related:

- `renderer.js` is a 758-line monolith — it needs modularization
- jQuery is used for maybe 10 operations — it can be removed
- CDN dependencies need to be bundled locally

**Recommended improvement path:**

1. **Split renderer.js into ES modules** (state.js, toc.js, editor.js, search.js, etc.)
2. **Replace jQuery with vanilla JS** (reduce 87KB dependency)
3. **Bundle CDN deps via npm + esbuild** (enables offline mode)
4. **Add TypeScript incrementally** (start with data model types)
5. **Consider Preact/Svelte only if** the UI grows significantly (tabs, split panes, drag-and-drop)

React is overkill for a note-taking app of this size. If a framework becomes necessary, **Preact** (3KB, React-compatible API) or **Svelte** (compile-time, zero runtime) are better fits for Electron.

### High-Priority Improvements

1. **Fix the bugs** listed above — especially `loadDocument()`, `filterNotes()`, and duplicate listeners
2. **Remove dead code** — `updateDocumentView()`, `saveToFile()`, `LXNative/` directory
3. **Security** — migrate API key to Electron's `safeStorage` API
4. **Offline support** — bundle all CDN dependencies via npm
5. **Code quality** — add ESLint + Prettier, add basic tests
6. **CSP** — add `Content-Security-Policy` meta tag to index.html

### Native App Decisions Needed

- **Is the native app the future, or is Electron the long-term platform?** This determines where to invest effort.
- **If keeping both**: establish shared data format documentation and ensure JSONImporter stays in sync.
- **If going native-only**: prioritize implementing delete, AI integration, and CI/CD before sunsetting Electron.
- **Metal background**: The animated gradient renders at 60 FPS. Consider whether this is worth the GPU overhead for a note-taking app, or if a static gradient would suffice.

---

## CI/CD Reference

### `release.yml` — Electron Release

- Triggers on push to `main`
- Matrix build: `ubuntu-latest`, `macos-latest`, `windows-latest`
- `npm install` → `npm run make` → upload artifacts → create GitHub Release
- Downstream: triggers `homebrew.yml` and `winget.yml`

### `homebrew.yml` — Homebrew Cask Update

- Updates formula in `antnsn/homebrew-lexorium` repository
- Uses `HOMEBREW_TAP_TOKEN` secret

### `winget.yml` — WinGet Update

- Uses `michidk/winget-updater@latest`
- Uses `WINGET_TOKEN` secret

### Missing CI

- No CI for the macOS native app
- No automated tests in CI (none exist for Electron app)
- No linting in CI

---

## File-by-File Reference

### Electron App

| File | LOC | Responsibility |
|------|-----|----------------|
| `main.js` | 185 | Window creation, IPC handlers, file I/O, app lifecycle |
| `renderer.js` | 758 | ALL UI logic — rendering, editing, search, AI settings, events |
| `styles.css` | 1293 | ALL styles — layout, components, theming, animations |
| `index.html` | 122 | HTML shell — 3-column layout, settings modal, CDN script tags |
| `menu.js` | 259 | Application menu (File, Edit, View, Window, Help) |
| `chatgpt.js` | 210 | Multi-provider AI orchestration, config, system prompts |
| `ai-provider.js` | 100 | Provider factory — OpenAI, Anthropic, OpenRouter adapters |
| `utils.js` | 101 | Config persistence, recent files, temp file cleanup |
| `preload.js` | 26 | Context bridge exposing `window.electronAPI` |
| `config.js` | 15 | DEBUG flag object |
| `forge.config.js` | 29 | Electron Forge packaging configuration |

### macOS Native App

| File | LOC | Responsibility |
|------|-----|----------------|
| `Package.swift` | 60 | SPM manifest — 4 modules, dependencies |
| `AppMain.swift` | 23 | App entry point, window configuration |
| `ContentView.swift` | 76 | Simple sidebar + detail view (AppExec) |
| `MainContentView.swift` | 458 | Full editor with preview/edit, ToC, code blocks |
| `SettingsView.swift` | 42 | API key management via Keychain |
| `AppEnvironment.swift` | 32 | Observable app state container |
| `DatabaseManager.swift` | 123 | GRDB singleton, migrations, CRUD, FTS5 |
| `Note.swift` | 23 | Note model with GRDB conformance |
| `JSONImporter.swift` | 39 | Electron JSON → SQLite import |
| `Keychain.swift` | 40 | Keychain read/write helper |
| `MetalView.swift` | 117 | Animated gradient Metal renderer |

---

## Design Context

### Users

Individual developers who want a beautiful, organized way to manage code snippets and technical notes. They reach for Lexorium when they need to capture, categorize, and retrieve code patterns, solutions, and documentation fragments across projects. These are developers who care about their tools — they want something that feels crafted, not just functional.

### Brand Personality

**Technical, Refined, Thoughtful.**

Lexorium should feel like a precision instrument made by someone who deeply understands developers. Every interaction should feel intentional. The interface communicates competence through restraint — no clutter, no unnecessary elements, no visual noise. It earns trust through polish, not through feature density.

**Emotional goal**: Delight through craft. When a developer opens Lexorium, they should feel like they're using something beautifully made — the kind of app you want to show someone. Think of the satisfaction of a well-designed mechanical keyboard or a perfectly typeset book.

### Aesthetic Direction

**Primary reference**: [Bear](https://bear.app) — elegant typography, warm atmosphere, beautiful Markdown rendering, and a sense of calm sophistication. Bear proves that a note app can feel genuinely premium.

**Anti-reference**: Jira, Confluence, and other cluttered enterprise tools. Lexorium must never feel busy, overwhelming, or utilitarian. No information overload, no competing visual hierarchies, no "dashboard syndrome."

**Visual tone**: A code-editor-inspired foundation refined with typographic warmth. The current One Dark/Light palette works well as a starting point but can evolve toward warmer, more refined tones to match the Bear-inspired direction. The monospace font (Fira Code) is core identity for code, but UI chrome and headings may benefit from a proportional typeface to create visual hierarchy and warmth.

**Theme**: Both dark and light modes required. Dark mode is the default/hero experience.

### Existing Design Tokens

```css
/* Core palette (One Dark / One Light) */
--background-color-dark: #282c34;    --background-color-light: #FAFAFA;
--font-color-dark: #abb2bf;          --font-color-light: #383a42;
--accent-color: #4CAF50;             --focus-border-color: #56b6c2;
--highlight-color: #e5c07b;          --red-color: #e06c75;
--link-color-dark: #61afef;          --link-color-light: #4e75c8;

/* Typography */
--font-family: "Fira Code", monospace;

/* Spacing & Motion */
--section-padding: 25px;             --border-radius: 5px;
--transition-duration: 0.3s;
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
