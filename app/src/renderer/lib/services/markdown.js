import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

// Use a dedicated instance so Vite HMR doesn't double-register extensions
const md = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
  { breaks: true, gfm: true }
);

/**
 * Render markdown to sanitized HTML.
 * DOMPurify strips script/iframe/event handlers/javascript: URLs to prevent XSS.
 */
export function renderMarkdown(content) {
  if (!content) return '';
  const raw = md.parse(content);
  const safe = DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['form', 'input', 'button', 'style'],
  });
  return addCopyButtons(safe);
}

function addCopyButtons(html) {
  return html.replace(
    /<pre>/g,
    '<pre class="code-block"><button class="copy-button" title="Copy code">⧉</button>'
  );
}

/**
 * Highlight a specific tag in rendered content.
 * Tags are rendered as clickable spans.
 */
export function highlightTags(html) {
  return html.replace(
    /#([a-zA-Z0-9_/]+)/g,
    '<span class="tag-link" data-tag="#$1">#$1</span>'
  );
}
