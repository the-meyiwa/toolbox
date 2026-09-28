/* ============================================================
   TOOLBOX — Safe HTML

   Markdown and HTML that came from a person, a file, another
   tool or a model is cleaned before it is put in the page:
   no scripts, no event handlers, no javascript: links. Anything
   that runs there runs with the person's Toolbox session.
   ============================================================ */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

const OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

let hooked = false;
function purifier() {
  if (!hooked && typeof DOMPurify.addHook === 'function') {
    // Links leave Toolbox in a new tab without handing it a reference to this page.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href') && !node.getAttribute('href').startsWith('#')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  return DOMPurify;
}

/** Cleans an HTML string for innerHTML. */
export function cleanHtml(html) {
  const p = purifier();
  if (typeof p.sanitize !== 'function' || !p.isSupported) {
    // No DOM to sanitise with (tests, workers): escape instead of trusting it.
    return String(html ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  return p.sanitize(String(html ?? ''), OPTIONS);
}

/** Markdown → cleaned HTML. */
export function safeMarkdown(md, options = { gfm: true, breaks: true }) {
  return cleanHtml(marked.parse(String(md ?? ''), options));
}
