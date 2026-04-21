# Lexorium — Impeccable Audit Report

> Full diagnostic scan across Accessibility, Performance, Theming, Responsive Design, and Anti-Patterns.
> Measured against WCAG AA, frontend-design skill DON'Ts, and Bear-app design aspirations.

---

## Anti-Patterns Verdict: ⚠️ MODERATE RISK

Lexorium is **not AI slop** — it has genuine design intent (One Dark palette, SVG gradient logo, clean three-column layout). However, it suffers from **structural decay**: duplicate CSS rules, dead code, broken selectors, and accessibility gaps that undermine the craftsmanship the design aspires to.

The codebase reads like a product that grew organically without periodic refactoring. The aesthetic foundation is solid — the problems are engineering, not taste.

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 6 |
| 🟠 High | 9 |
| 🟡 Medium | 12 |
| 🔵 Low | 8 |
| **Total** | **35** |

---

## 🔴 Critical Findings (6)

### C1. Dark mode body selector is dead code
**File:** `styles.css:53`
**Issue:** `.dark-mode body {}` never matches. The `.dark-mode` class is toggled on `<body>` itself, so the selector should be `body.dark-mode {}`.
**Impact:** Dark mode base colors (background, text) are never applied via this rule. Dark mode only works because child selectors (`.dark-mode h2`, `.dark-mode #input-section`, etc.) compensate — but the root background/text fallback is broken.
**Fix:** Change `.dark-mode body` → `body.dark-mode`

### C2. Triple undo event listeners
**File:** `renderer.js:592, 723, 756`
**Issue:** `undoButton.addEventListener("click", ...)` is attached three times with identical handlers. Each click fires `undoDelete()` three times, potentially restoring three sections at once.
**Impact:** Data corruption — users undo more than intended.
**Fix:** Remove lines 722-725 and 755-758.

### C3. `loadDocument()` ignores its `filePath` parameter
**File:** `renderer.js:88-91`
**Issue:** The function signature accepts `filePath` but immediately calls `window.electronAPI.openFile()` which opens a file dialog, ignoring the passed path.
**Impact:** Programmatic file loading is broken. The `filePath` parameter is unused.
**Fix:** Add IPC handler for reading a specific file path, or remove the unused parameter.

### C4. `filterNotes()` — `.toc-item` querySelector bug
**File:** `renderer.js:542-544`
**Issue:** `item.querySelector('a')` searches for `<a>` inside each `.toc-item`, but TOC items ARE `<a>` elements (see `updateTOC()` at L69-73: `<a href="#${id}" class="toc-item">`). So `querySelector('a')` returns `null`.
**Impact:** Search filtering silently fails to update TOC visibility. TOC items remain visible even when their sections are hidden.
**Fix:** Since `.toc-item` IS the `<a>`, use `item` directly instead of `item.querySelector('a')`.

### C5. No keyboard focus indicators
**File:** `styles.css:189-192, 589-592, 600-602`
**Issue:** Multiple `outline: none` declarations remove browser default focus rings without providing replacement focus styles. Only `:focus` border-color changes are used, which are insufficient for WCAG AA compliance.
**WCAG:** 2.4.7 Focus Visible (Level AA) — FAIL
**Fix:** Replace `outline: none` with `:focus-visible` styles using a visible ring (e.g., `outline: 2px solid var(--focus-border-color); outline-offset: 2px`).

### C6. No ARIA roles or semantic landmarks
**File:** `index.html`
**Issue:** The entire UI is built with `<div>` elements. No `<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`, `<section>`, or ARIA landmarks. Screen readers see an undifferentiated wall of content.
**WCAG:** 1.3.1 Info and Relationships (Level A) — FAIL
**Impact:** Assistive technology cannot navigate the interface.
**Fix:**
- TOC section → `<nav aria-label="Table of Contents">`
- Document section → `<main>`
- Input section → `<aside>` or `<section aria-label="New Note">`
- Settings modal → add `role="dialog"` and `aria-modal="true"` and `aria-labelledby`

---

## 🟠 High Findings (9)

### H1. CDN dependencies — no offline support, no SRI
**File:** `index.html:8-19, 94-101`
**Issue:** 6 external CDN scripts/stylesheets loaded without:
- Subresource Integrity (SRI) hashes — vulnerable to CDN compromise
- Offline fallbacks — app is unusable without internet
- CSP headers — no Content Security Policy meta tag
**CDN deps:** Font Awesome, highlight.js CSS, Google Fonts, highlight.js, marked.js, jQuery, autosize
**Fix:** Bundle all deps locally via npm/webpack. Add SRI hashes as interim measure.

### H2. Duplicate CSS rule blocks
**File:** `styles.css`
**Issue:** Multiple selectors are defined two or three times with conflicting properties:
- `.copy-button`: L668-680 and L733-745 (completely different positioning, padding, colors)
- `.input-controls`: L611-617, L955-960, and L975-980 (three separate definitions!)
- `.checkbox-label`: L888-894 and L962-967 (two definitions)
- `.dark-mode .copy-button`: L686-689 and L755-758 (two definitions)
**Impact:** Last-defined wins (CSS cascade), but the intent is unclear. Earlier rules become dead code with no indication which is intentional.
**Fix:** Consolidate each selector into a single definition.

### H3. Hardcoded color values throughout CSS
**File:** `styles.css`
**Issue:** Despite having a design token system in `:root`, dozens of hardcoded color values appear:
- `#f5f5f5` (L672, L937)
- `#333` (L33, L676)
- `#ccc` (L21, L34, L689)
- `#f44336` (L807)
- `#4CAF50` (L35, L901, L907)
- `#45a049` (L915)
- `white` (L20, L136, L312, L374, L469)
- `rgba(0,0,0,0.5)` (L821)
**Impact:** Theme changes require hunting through the entire file. Color consistency is impossible to maintain.
**Fix:** Replace all hardcoded values with CSS custom properties.

### H4. Monospace font for everything
**File:** `styles.css:2`
**Issue:** `--font-family: "Fira Code", monospace` is used as the universal font. Body text, headings, labels, buttons, and UI chrome all render in monospace.
**Anti-pattern:** Per frontend-design typography reference: "DON'T use monospace typography as lazy shorthand for 'technical/developer' vibes."
**Design context:** User wants Bear-app refinement. Bear uses proportional serif/sans-serif for body text and reserves monospace for code blocks only.
**Fix:** Introduce a proportional body font (e.g., Inter, Source Sans 3, or a warmer option). Reserve Fira Code for `code`, `pre`, `textarea.body-input`.

### H5. Modal content has wrong light-mode text color
**File:** `styles.css:830`
**Issue:** `.modal-content { color: var(--font-color-dark); }` uses the dark theme text color (#abb2bf) in light mode. This creates low-contrast gray text on a white background.
**WCAG:** 1.4.3 Contrast (Minimum) — likely FAIL (gray on white)
**Fix:** Use `var(--font-color-light)` for light mode, override in `.dark-mode .modal-content`.

### H6. Edit/delete buttons lack accessible labels
**File:** `renderer.js:30-39`
**Issue:** Edit and delete buttons contain only SVG icons with no text, `aria-label`, or `title` attribute. Screen readers announce them as empty buttons.
**WCAG:** 4.1.2 Name, Role, Value (Level A) — FAIL
**Fix:** Add `aria-label="Edit section"` and `aria-label="Delete section"` to the buttons.

### H7. `outline: none` on all buttons and inputs
**File:** `styles.css:189-192, 249-252, 589-592`
**Issue:** Three separate rules suppress focus outlines globally:
- `#undo:focus { outline: none; }`
- `textarea:focus { outline: none; }`
- `button:focus { outline: none; }`
No `:focus-visible` replacement is provided anywhere.
**WCAG:** 2.4.7 Focus Visible (Level AA) — systemic FAIL
**Fix:** Remove all `outline: none` rules. Add global `:focus-visible` style.

### H8. Search input has no label
**File:** `index.html:31`
**Issue:** `<input type="text" id="search-input" placeholder="Search..." />` has only a placeholder, no `<label>` element or `aria-label`.
**WCAG:** 1.3.1 Info and Relationships (Level A) — FAIL
**Fix:** Add `aria-label="Search notes"`.

### H9. Dead code — `updateDocumentView()` and `saveToFile()`
**File:** `renderer.js:182-261, 562-589`
**Issue:** Two large functions (~160 lines total) are never called anywhere:
- `updateDocumentView()` — a legacy markdown renderer
- `saveToFile()` — a legacy file saver using innerHTML extraction
These contain duplicate `marked.setOptions()` calls (L190, L202) and register TOC click handlers that conflict with the active code path.
**Impact:** Maintenance burden, confusion for contributors, potential for accidental invocation.
**Fix:** Remove both functions entirely.

---

## 🟡 Medium Findings (12)

### M1. `marked.setOptions()` called twice
**File:** `renderer.js:190, 202` (inside dead `updateDocumentView()`)
**Issue:** Two calls with different `highlight` functions — the second overwrites the first.
**Fix:** Will be resolved when dead code (H9) is removed.

### M2. Settings modal lacks keyboard trap
**File:** `index.html:80-92`, `renderer.js:344-353`
**Issue:** When the settings modal opens, focus is not trapped inside it. Users can Tab out of the modal into the background. Pressing Escape does not close it (only click on ✕ or backdrop).
**WCAG:** 2.4.3 Focus Order (Level A)
**Fix:** Add focus trapping. Add Escape key handler. Set `role="dialog"`, `aria-modal="true"`.

### M3. `alert()` used for error/success notifications
**File:** `renderer.js:359, 366, 378, 617, 665`
**Issue:** 5 uses of `alert()` for user communication. Native alerts are:
- Not stylable (breaks the polished aesthetic)
- Blocking (freezes the entire process)
- Not announced properly by some screen readers
**Fix:** Replace with in-app toast/notification system.

### M4. `onclick` inline event handlers
**File:** `renderer.js:30, 35, 414, 415`
**Issue:** Edit, delete, save, and cancel buttons use `onclick="editSection('...')"` inline handlers instead of delegated event listeners.
**Impact:** CSP violations if Content Security Policy is ever added. Harder to maintain.
**Fix:** Use event delegation on the document section.

### M5. No heading hierarchy
**File:** `index.html:26, 28, 58`
**Issue:** `<h1>` (logo) then `<h2>` "Table of Contents" and `<h2>` "New Note" are siblings. The document structure doesn't reflect the visual hierarchy.
**WCAG:** 1.3.1 Info and Relationships — heading order should be logical.
**Fix:** The logo could be a styled `<span>` instead of `<h1>`. Or restructure with proper heading nesting.

### M6. No empty state for document view
**File:** `renderer.js:14-65`, `index.html:50`
**Issue:** When no document is loaded, `#document-view` is empty — a blank white panel. Per frontend-design skill: "Design empty states that teach the interface."
**Fix:** Add an empty state with instructions like "Open a file or create a new note to get started."

### M7. Color contrast — light mode link color
**Issue:** `--link-color-light: #4e75c8` on `--background-color-light: #FAFAFA`
**Contrast ratio:** ~4.2:1 — passes AA for normal text but marginal. On `.markdown-section` background (`--scrollbar-track-light: #e5e5e6`) it drops to ~3.4:1 — FAILS AA.
**Fix:** Darken link color slightly or ensure links only appear on white backgrounds.

### M8. Sort button touch target too small
**File:** `styles.css:1262-1274`
**Issue:** `#sort-order` is 33×33px. While this is a desktop app, WCAG 2.5.8 recommends minimum 44×44px interactive targets.
**Fix:** Increase to at least 44×44px or add padding to increase the hit area.

### M9. No transition on theme switch for all elements
**Issue:** `body` transitions background-color, but many child elements don't include transition properties for their dark mode switches. This causes visible jumps for elements like `.copy-button`, `.modal-content`, section backgrounds.
**Fix:** Add `transition: background-color var(--transition-duration), color var(--transition-duration)` to all elements that change in dark mode.

### M10. jQuery and vanilla JS mixed inconsistently
**File:** `renderer.js`
**Issue:** `$(documentView).html(html)` alongside `document.querySelectorAll()`, `document.getElementById()`. No pattern for when to use which.
**Impact:** Larger bundle size (jQuery is 87KB minified), inconsistent code style.
**Fix:** Remove jQuery dependency. Replace `$(x).html()`, `$(x).find()`, `$(x).addClass()` with vanilla equivalents.

### M11. Checkbox label color hardcoded to dark theme
**File:** `styles.css:892`
**Issue:** `.checkbox-label { color: var(--font-color-dark); }` — the "Analyze with ChatGPT" label always uses dark theme text color, even in light mode.
**Fix:** Use `var(--font-color-light)` with `.dark-mode .checkbox-label { color: var(--font-color-dark); }` override.

### M12. `var(--border-color)` undefined
**File:** `styles.css:231, 739, 827, 868`
**Issue:** Several rules reference `var(--border-color)` which is never defined in `:root`. Only `--border-color-light` and `--border-color-dark` exist. The browser falls back to the initial value (empty string), meaning these borders are invisible.
**Fix:** Either define `--border-color` or replace with the theme-specific variables.

---

## 🔵 Low Findings (8)

### L1. Logo uses gradient text (anti-pattern signal)
**File:** `styles.css:75-100`
**Issue:** Per frontend-design skill: "DON'T use gradient text for 'impact'." The SVG background-clip technique is creative but trips the anti-pattern detector.
**Verdict:** Keep — this is a deliberate brand choice, not generic AI slop. The inline SVG approach is actually unusual and distinctive.

### L2. `overflow-y: hidden` on textarea
**File:** `styles.css:239`
**Issue:** `textarea { overflow-y: hidden; }` combined with autosize means users can't scroll if autosize fails. A safer approach would be `overflow-y: auto`.
**Fix:** Change to `overflow-y: auto`.

### L3. Inconsistent spacing tokens
**Issue:** The CSS uses a mix of `px`, `rem`, `em`, and `%` for spacing. No spacing scale is defined in `:root`. Values like `25px`, `20px`, `10px`, `15px`, `8px`, `5px` appear frequently with no rhythm.
**Fix:** Define a spacing scale (e.g., 4px base: 4, 8, 12, 16, 24, 32, 48) and use consistent tokens.

### L4. `width: 98%` on search input
**File:** `styles.css:630`
**Issue:** `#search-input { width: 98%; }` is a magic number. Should be `width: 100%` with proper padding/box-sizing.
**Fix:** Use `width: 100%; box-sizing: border-box;`

### L5. Commented-out CSS blocks
**File:** `styles.css:1235-1243`
**Issue:** `.search-container` and `.sort-container` rules are commented out. Dead code in CSS.
**Fix:** Remove commented blocks.

### L6. Two `generateId()` functions
**File:** `renderer.js:178, 396`
**Issue:** `generateId()` and `generateRandomId()` both generate random IDs with identical logic (slightly different substring indices). Redundant.
**Fix:** Consolidate into one function.

### L7. No prefers-reduced-motion support
**Issue:** The CSS uses `transition-duration: 0.3s` for many properties but never checks `@media (prefers-reduced-motion: reduce)`.
**WCAG:** 2.3.3 Animation from Interactions (Level AAA, but good practice)
**Fix:** Add `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }`

### L8. No `lang` attribute for content regions
**File:** `index.html:2`
**Issue:** `<html lang="en">` is correctly set, which is good. However, user content (notes) may be in other languages. No mechanism to set per-section lang.
**Verdict:** Acceptable for now. Would matter for a multi-language note app.

---

## Systemic Patterns

### Pattern 1: CSS Entropy
The stylesheet has grown by accretion. Rules are added at the bottom without checking for existing selectors. This creates:
- 3 definitions of `.input-controls`
- 2 definitions of `.copy-button`
- 2 definitions of `.checkbox-label`
- Conflicting properties that only work because later rules cascade
**Remedy:** Full CSS audit + consolidation pass.

### Pattern 2: Accessibility Afterthought
Zero ARIA attributes in the entire codebase. No semantic HTML landmarks. Focus outlines suppressed everywhere. No skip links. This isn't a single bug — it's a systemic gap.
**Remedy:** Dedicated accessibility pass as a first-priority task.

### Pattern 3: Dual-mode Dead Code
~160 lines of dead JavaScript (`updateDocumentView`, `saveToFile`), duplicate undo listeners, and legacy function variants suggest the codebase was refactored from a single-document viewer to a section-based system but the old code was never cleaned up.
**Remedy:** Remove dead code, consolidate duplicate logic.

### Pattern 4: Theme System Half-Built
The CSS variable system in `:root` is well-conceived but under-utilized. ~30+ hardcoded color values bypass the token system. The dark mode toggle mechanism (class on body) is correct, but the `.dark-mode body {}` selector bug means the root rule doesn't work.
**Remedy:** Complete the theme token migration.

---

## Positive Findings ✅

1. **Design tokens exist** — The `:root` variable system is a strong foundation. Most of the theming infrastructure is already in place.
2. **SVG logo is distinctive** — The gradient background-clip approach is genuinely creative and brand-reinforcing.
3. **Data model is clean** — The JSON format `{ version, sections: [{ id, title, content, timestamp }] }` is simple and extensible.
4. **Editing UX is solid** — In-place editing with save/cancel, autosize textareas, and undo support shows good UX thinking.
5. **Dark/Light mode exists** — While the implementation has bugs, the intent and infrastructure for dual theming is present.
6. **Code block syntax highlighting** — highlight.js integration with theme-switching is well-executed.
7. **External link handling** — Proper `rel="noopener noreferrer"` and Electron shell.openExternal for links.
8. **Transition system** — CSS transitions on theme changes show polish awareness.

---

## Prioritized Recommendations

### Phase 1: Critical Fixes (do first)
1. Fix `.dark-mode body` selector → `body.dark-mode` (C1)
2. Remove duplicate undo listeners (C2)
3. Fix `loadDocument()` parameter (C3)
4. Fix `filterNotes()` TOC item bug (C4)
5. Add `:focus-visible` styles, remove `outline: none` (C5, H7)
6. Add semantic HTML landmarks and ARIA (C6, H6, H8)

### Phase 2: Quality & Consistency
7. Consolidate duplicate CSS rules (H2)
8. Replace hardcoded colors with tokens (H3)
9. Fix modal text color (H5)
10. Remove dead code — `updateDocumentView()`, `saveToFile()` (H9)
11. Fix undefined `--border-color` variable (M12)
12. Fix checkbox label color (M11)

### Phase 3: Design Elevation (toward Bear-like quality)
13. Introduce proportional body font, reserve monospace for code (H4)
14. Add empty state for document view (M6)
15. Replace `alert()` with toast notifications (M3)
16. Define spacing scale tokens (L3)
17. Add `prefers-reduced-motion` support (L7)
18. Add keyboard trap for settings modal (M2)

### Phase 4: Engineering Modernization
19. Bundle CDN dependencies locally (H1)
20. Remove jQuery, use vanilla JS (M10)
21. Replace inline `onclick` with event delegation (M4)
22. Add Content Security Policy (H1)
23. Consolidate duplicate ID generators (L6)
24. Clean up commented CSS (L5)

---

## Suggested Skill Commands

After addressing critical fixes:
- **`/polish`** — Fix alignment, spacing consistency, and detail issues
- **`/harden`** — Improve error handling, add edge case management
- **`/clarify`** — Improve UX copy, labels, empty states
- **`/animate`** — Add purposeful micro-interactions (note add/delete transitions)
- **`/colorize`** — Evolve the palette toward warmth (per user preference)
- **`/distill`** — Strip unnecessary complexity from the CSS

---

*Audit completed. 35 findings across 4 severity levels. The foundation is solid — the codebase needs cleanup and accessibility work, not a rewrite.*
