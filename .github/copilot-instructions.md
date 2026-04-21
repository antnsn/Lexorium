# Copilot Instructions — Lexorium

## Project Overview

Lexorium is a cross-platform note/snippet manager that renders Markdown content with syntax-highlighted code blocks. The repository contains **two independent applications**:

| App | Path | Stack | Status |
|-----|------|-------|--------|
| **Electron app** | `app/` | Electron 32 + vanilla JS + jQuery | Production (v3.0.4) |
| **macOS native app** | `macos-app/` | SwiftUI + GRDB + Metal | Experimental / in-progress |

Only the Electron app is currently shipped via CI/CD. The macOS native app is an early-stage rewrite.

---

## Repository Structure

```
Lexorium/
├── app/                          # Electron application
│   ├── main.js                   # Main process — window, IPC, file I/O
│   ├── preload.js                # Context bridge (electronAPI)
│   ├── renderer.js               # All UI logic (758 LOC monolith)
│   ├── styles.css                # All styles + theming (1293 LOC)
│   ├── index.html                # Single-page shell (3-column layout)
│   ├── menu.js                   # Application menu builder
│   ├── chatgpt.js                # Multi-provider AI orchestration
│   ├── ai-provider.js            # Provider factory (OpenAI, Anthropic, OpenRouter)
│   ├── config.js                 # Debug flag
│   ├── utils.js                  # Config persistence, recent files
│   ├── forge.config.js           # Electron Forge config
│   ├── package.json              # v3.0.4, Electron Forge
│   └── entitlements.plist        # macOS sandbox entitlements
│
├── macos-app/                    # Native macOS application
│   ├── Package.swift             # SPM manifest (4 modules)
│   ├── Sources/
│   │   ├── AppExec/              # Entry point (AppMain.swift, ContentView.swift)
│   │   ├── AppUI/                # Full UI (MainContentView.swift, SettingsView.swift)
│   │   ├── StorageKit/           # Data layer (DatabaseManager, Note model, JSONImporter)
│   │   └── RendererKit/          # Metal animated background (MetalView.swift)
│   ├── Tests/StorageKitTests/    # Unit tests for storage layer
│   └── LXNative/                 # Legacy Xcode project stub (can be removed)
│
├── .github/
│   └── workflows/
│       ├── release.yml           # Build + publish Electron to GitHub Releases
│       ├── homebrew.yml          # Update Homebrew cask formula
│       └── winget.yml            # Update WinGet manifest
│
├── testNote.json                 # Sample data file
└── readme.md                     # Project README
```

---

## Electron App — Architecture & Conventions

### Tech Stack

- **Runtime**: Electron 32.1.2 via Electron Forge 7.4.0
- **UI**: Vanilla JavaScript + jQuery 3.7.1
- **Markdown**: `marked` v4.0.2 (CDN)
- **Syntax Highlighting**: `highlight.js` v11.10.0 (CDN)
- **AI**: Multi-provider support — OpenAI (`openai` v4.76.1), Anthropic (`@anthropic-ai/sdk`), OpenRouter (via OpenAI SDK)
- **Icons**: Font Awesome 6.7.1 (CDN)
- **Textarea**: autosize 6.0.1 (CDN)
- **Packaging**: Electron Forge makers for macOS (zip), Windows (Squirrel), Linux (deb/rpm)

### IPC Architecture

```
main.js (Node.js)  ←→  preload.js (contextBridge)  ←→  renderer.js (browser)
```

The `preload.js` exposes `window.electronAPI` with these channels:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `openFile` | renderer → main | Open file dialog |
| `saveFile` | renderer → main | Save file dialog |
| `saveToPath` | renderer → main | Save to specific path |
| `getConfig` | renderer → main | Read config.json |
| `setConfig` | renderer → main | Write config.json |
| `file-opened` | main → renderer | File opened from menu/recent |
| `chatgpt:send` | renderer → main | Send text to AI (legacy name) |
| `chatgpt:process` | renderer → main | Process content with AI (legacy name) |
| `chatgpt:set-api-key` | renderer → main | Set OpenAI API key (legacy) |
| `chatgpt:get-api-key` | renderer → main | Get OpenAI API key (legacy) |
| `ai:get-config` | renderer → main | Get full AI provider config |
| `ai:set-config` | renderer → main | Save AI provider config |

### Data Format

Documents are JSON files (NOT markdown files):

```json
{
  "version": "1.0",
  "sections": [
    {
      "id": 1,
      "title": "Section Title",
      "content": "Markdown content with ```code blocks```",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

- Each section's `content` is Markdown text rendered via `marked.parse()`
- Sections have auto-incrementing integer `id`s
- `timestamp` is ISO 8601 format

### Config Storage

Config is stored in Electron's `userData` directory as `config.json`:

```json
{
  "aiProvider": "openai",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-4o",
  "anthropicApiKey": "sk-ant-...",
  "anthropicModel": "claude-sonnet-4-20250514",
  "openrouterApiKey": "sk-or-...",
  "openrouterModel": "openai/gpt-4o",
  "recentFiles": ["/path/to/file.json"],
  "lastOpenedFile": "/path/to/file.json"
}
```

**Security note**: API keys are stored in plaintext. This should be migrated to the OS keychain.

### UI Layout

Three-column layout:

```
┌──────────────┬──────────────────────────┬──────────────────┐
│   TOC (left) │   Document View (center) │  New Note (right)│
│              │                          │                  │
│  - Section 1 │   Rendered Markdown      │  Title: [      ] │
│  - Section 2 │   with code blocks       │  Content: [    ] │
│  - Section 3 │                          │  [Add Note]      │
│              │                          │                  │
│  [Search]    │                          │  [Analyze w/ AI] │
└──────────────┴──────────────────────────┴──────────────────┘
```

Settings modal is toggled via gear icon (stores AI provider config, API keys, theme preference).

### Theming

- CSS variables defined in `:root` (light) and `.dark-mode` (dark)
- One Dark / One Light color scheme
- Toggle via settings modal, persisted in config
- Key variables: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--accent-color`

### Key Functions in renderer.js

| Function | Line | Purpose |
|----------|------|---------|
| `renderDocument(data)` | ~14 | Main render — builds TOC + document view from JSON |
| `updateTOC(sections)` | ~67 | Populates left sidebar table of contents |
| `editSection(id)` | ~400 | Replaces section content with textarea for editing |
| `saveSection(id)` | ~433 | Saves edited section back to data model |
| `deleteSection(id)` | ~477 | Removes section with confirmation |
| `filterNotes(query)` | ~543 | Searches sections by title/content |
| `addNote` handler | ~607 | Creates new section from input fields |

### Development Commands

```bash
cd app
npm install
npm start            # Run in development
npm run package      # Build for current platform
npm run make         # Create distributable
npm run publish      # Publish to GitHub Releases
```

---

## macOS Native App — Architecture & Conventions

### Tech Stack

- **Language**: Swift 5.9+, macOS 13+ deployment target
- **UI**: SwiftUI with NavigationSplitView
- **Database**: GRDB.swift (SQLite with FTS5 full-text search, WAL mode)
- **Markdown**: MarkdownUI
- **Syntax Highlighting**: Highlightr
- **Graphics**: Metal (animated gradient background)
- **Security**: Keychain for API key storage

### Module Architecture (SPM)

```
Package.swift
├── AppExec     → Entry point, depends on AppUI
├── AppUI       → SwiftUI views, depends on StorageKit + RendererKit
├── StorageKit  → Database, models, JSON import
└── RendererKit → Metal-based animated background
```

### Data Model (SQLite)

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,     -- UUID string
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL,  -- ISO 8601
  updatedAt TEXT NOT NULL   -- ISO 8601
);

-- Full-text search index
CREATE VIRTUAL TABLE notes_ft USING fts5(title, content, content='notes', content_rowid='rowid');
```

### Key Types

| Type | File | Purpose |
|------|------|---------|
| `Note` | StorageKit/Note.swift | Model conforming to GRDB protocols |
| `DatabaseManager` | StorageKit/DatabaseManager.swift | Singleton, migrations, CRUD, FTS5 search |
| `JSONImporter` | StorageKit/JSONImporter.swift | Imports Electron JSON format |
| `MainContentView` | AppUI/MainContentView.swift | Full-featured editor with preview/edit modes |
| `SettingsView` | AppUI/SettingsView.swift | API key management via Keychain |
| `AppEnvironment` | AppUI/AppEnvironment.swift | Observable state container |
| `MetalView` | RendererKit/MetalView.swift | Animated gradient NSView |

### Build Commands

```bash
cd macos-app
swift build
swift test
```

Or open the Xcode project:
```bash
open macos-app/LXNative/LXNative.xcodeproj
```

---

## Known Bugs & Issues

### Critical

1. **`loadDocument()` ignores filePath param** (`renderer.js` ~L88): Calls `window.electronAPI.openFile()` (opens dialog) instead of reading the passed `filePath`. Recent files and "file-opened" events don't work correctly.

2. **Duplicate undo event listeners** (`renderer.js` L592, L723, L756): The undo button gets 3 event listeners attached, causing triple-execution.

3. **`filterNotes()` broken** (`renderer.js` ~L543): Searches for `item.querySelector('a')` but TOC items ARE `<a>` elements, not containers of them. Search likely returns no results.

4. **`saveToFile()` extracts innerHTML** (`renderer.js` ~L562): Would save rendered HTML instead of raw Markdown content, corrupting data. Function appears unused (dead code).

### Important

5. **CDN dependencies = no offline support**: jQuery, marked, highlight.js, Font Awesome, autosize all loaded from CDN URLs. App is broken without internet.

6. **API keys in plaintext**: Stored in `config.json` in userData directory. Multiple provider keys now stored. Should use OS keychain (like the Swift app does).

7. **`updateDocumentView()` is dead code** (`renderer.js` ~L182-261): An alternate rendering path that's never called. Has a different copy button style than `renderDocument()`.

8. **CSS `.dark-mode body` selector** (`styles.css`): This selector looks for `<body>` inside an element with class `dark-mode`, but `dark-mode` is applied TO the `<body>`. The selector never matches.

9. **Duplicate CSS rule blocks**: `.input-controls` and `.copy-button` are each defined twice with different properties — later definition silently overrides.

10. **marked.setOptions called twice** (`renderer.js`): Configured at ~L190 and again at ~L224 with slightly different options.

### Minor

11. **No input validation**: Section title/content can be empty strings.
12. **No error boundaries**: Rendering errors crash the entire view.
13. **Global function exposure**: `editSection`, `saveSection`, `cancelEdit`, `deleteSection` exposed on `window` for inline `onclick` handlers.
14. **macOS native app AI is a stub**: `aiAssist()` just prints to console.
15. **macOS native app has no delete**: Can create/save notes but cannot delete them.
16. **`LXNative/` directory**: Legacy Xcode project stub inside `macos-app/` — likely dead code.

---

## Code Style & Conventions

### JavaScript (Electron app)

- **No framework** — vanilla JS with jQuery for some DOM operations
- **No module system** — all renderer code in one file with global state
- **No TypeScript** — plain JavaScript, no type checking
- **No linting/formatting** — no ESLint, Prettier, or similar configured
- **No tests** — no test framework, no test files
- **Inline event handlers** — `onclick="editSection(${id})"` pattern used alongside `addEventListener`
- **jQuery mixed with vanilla DOM** — inconsistent; some operations use `$()`, others use `document.querySelector()`
- **Template literals for HTML** — multi-line HTML strings built with backticks and `${}` interpolation

When writing new JavaScript for this project:
- Match existing style (vanilla JS, no semicolons at statement ends in some places but present in others — prefer semicolons)
- Use `const` / `let` (never `var`)
- Keep functions at module level (no classes)
- Use `window.electronAPI` for all IPC communication
- Use `marked.parse()` for Markdown rendering
- Use `hljs.highlightElement()` for code block highlighting

### Swift (macOS native app)

- Standard Swift conventions, SwiftUI declarative patterns
- `@Observable` / `@State` / `@Binding` for state management
- GRDB record protocol conformance for models
- Async/await for database operations
- Modular SPM package structure

### CSS

- CSS custom properties (variables) for theming
- BEM-like naming in some places, flat names in others
- Mobile-first is NOT used — desktop-only app
- Dark mode via `.dark-mode` class on `<body>`

---

## CI/CD

### Release Pipeline (`release.yml`)

Triggers on push to `main`:
1. Builds on `ubuntu-latest`, `macos-latest`, `windows-latest`
2. Runs `npm install` → `npm run make`
3. Uploads artifacts
4. Creates GitHub Release with all platform builds
5. Triggers `homebrew.yml` and `winget.yml` for package manager updates

### Homebrew (`homebrew.yml`)

Updates cask formula in `antnsn/homebrew-lexorium` repo.

### WinGet (`winget.yml`)

Uses `michidk/winget-updater` action to update WinGet manifest.

**Note**: No CI/CD exists for the macOS native app.

---

## Improvement Roadmap

### Should You Use React?

**Short answer: Not necessary, but beneficial if the UI grows in complexity.**

The current problems stem from **lack of structure, not lack of a framework**:

- `renderer.js` is a 758-line monolith mixing state, DOM, events, and business logic
- Global state variables (`currentDocument`, `currentFilePath`) have no protection
- No component model — every UI update is manual DOM manipulation

**Recommended path (incremental, no rewrite needed):**

1. **Phase 1 — Modularize**: Split `renderer.js` into ES modules:
   - `state.js` — document state management
   - `toc.js` — table of contents rendering
   - `editor.js` — section editing logic
   - `renderer.js` — document rendering
   - `search.js` — filter/search functionality
   - `chatgpt-ui.js` — AI settings and chat panel logic
   - `settings.js` — settings modal

2. **Phase 2 — Remove jQuery**: Replace `$()` calls with vanilla `document.querySelector()`. jQuery adds 87KB for minimal usage.

3. **Phase 3 — Bundle CDN deps**: Install marked, highlight.js, Font Awesome, autosize via npm. Use a bundler (esbuild or webpack via Forge plugin) to bundle them. This enables offline support.

4. **Phase 4 — Add TypeScript**: Gradually add `.ts` files. Type the data model first (`Section`, `Document`, `Config`).

5. **Phase 5 — Consider a framework** (optional): If the UI needs significant new features (tabs, split views, drag-and-drop reordering), consider:
   - **Preact** (3KB) — React API compatible, tiny footprint, ideal for Electron
   - **Svelte** — compile-time framework, zero runtime overhead
   - **React** — only if you need the ecosystem (component libraries, etc.)

### Other High-Priority Improvements

- Fix the critical bugs listed above (especially `loadDocument`, duplicate listeners, `filterNotes`)
- Remove dead code (`updateDocumentView`, `saveToFile`, `LXNative/` directory)
- Add ESLint + Prettier configuration
- Add basic tests (at minimum for data model operations)
- Migrate API keys to OS keychain via `safeStorage` (Electron has built-in support)
- Add `Content-Security-Policy` meta tag to `index.html`
- Consider electron-store or similar for config instead of raw JSON file I/O

---

## Working With This Codebase

### Before Making Changes

1. Identify which app you're modifying (Electron vs. native)
2. Check the known bugs list — your change might interact with existing issues
3. Test with both light and dark themes
4. Test with an actual JSON document file (see `testNote.json` for format)

### Common Gotchas

- `renderer.js` global state: `currentDocument` holds the active document data. Always update it when modifying sections.
- The `id` field on sections is an integer, not a UUID. New sections use `Math.max(...ids) + 1`.
- `marked.parse()` returns HTML — it's inserted via `innerHTML` which is an XSS vector.
- The Electron app has no auto-save. Users must explicitly save (Cmd+S / Ctrl+S).
- `window.electronAPI` methods are async (return Promises).
- The native app uses UUID strings for note IDs vs. integer IDs in Electron — the `JSONImporter` handles conversion.
