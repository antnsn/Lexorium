import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked once
marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

/**
 * Render markdown to sanitized HTML.
 * Strips dangerous tags (script, iframe, etc.) to prevent XSS.
 */
export function renderMarkdown(content) {
  if (!content) return '';
  const raw = marked.parse(content);
  return sanitize(raw);
}

const DANGEROUS_TAGS = /(<script[\s>].*?<\/script>|<iframe[\s>].*?<\/iframe>|<object[\s>].*?<\/object>|<embed[\s>].*?<\/embed>|<form[\s>].*?<\/form>|on\w+\s*=\s*["'][^"']*["'])/gi;

function sanitize(html) {
  return html.replace(DANGEROUS_TAGS, '');
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
