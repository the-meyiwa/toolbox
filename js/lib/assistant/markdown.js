/* ============================================================
   TOOLBOX — Assistant Markdown

   Streaming-safe Markdown for chat replies:
   - GFM (headings, lists, task lists, tables, blockquotes, code)
   - LaTeX: $…$, $$…$$, \(…\), \[…\] (KaTeX from the CDN, loaded
     only when a reply contains math; the built-in MathML renderer
     is the fallback until it arrives or if it cannot load)
   - Code blocks get a language label and a copy button
   - Tables sit in horizontal scroll wrappers
   - Links open in a new tab
   - patchHtml() updates only the blocks that changed, so a
     streaming reply never flickers or loses scroll position
   ============================================================ */

import { Marked } from 'marked';
import { sanitizeUserFacingText, sanitizeRenderedHtml } from '../../utils.js';
import { renderMath } from '../math-renderer.js';

const md = new Marked({ gfm: true, breaks: false });

const KATEX_VERSION = '0.16.22';
const KATEX_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
let katexPromise = null;
let katexFailed = false;

/** Loads KaTeX once. Resolves to window.katex or null. */
export function ensureKatex() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.katex) return Promise.resolve(window.katex);
  if (katexFailed) return Promise.resolve(null);
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${KATEX_BASE}/katex.min.css`;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = `${KATEX_BASE}/katex.min.js`;
    script.crossOrigin = 'anonymous';
    script.async = true;
    const fail = () => { katexFailed = true; resolve(null); };
    const timer = setTimeout(fail, 12000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.katex) {
        resolve(window.katex);
        window.dispatchEvent(new CustomEvent('toolbox:katex-ready'));
      } else fail();
    };
    script.onerror = () => { clearTimeout(timer); fail(); };
    document.head.appendChild(script);
  });
  return katexPromise;
}

export function katexReady() {
  return typeof window !== 'undefined' && Boolean(window.katex);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTex(tex, display) {
  const src = String(tex || '').trim();
  if (!src) return '';
  if (katexReady()) {
    try {
      const html = window.katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml', trust: false });
      return display ? `<div class="md-math md-math-display">${html}</div>` : `<span class="md-math">${html}</span>`;
    } catch { /* fall through */ }
  }
  try {
    const html = renderMath(src, { displayMode: display });
    if (html) return display ? `<div class="md-math md-math-display md-math-fallback">${html}</div>` : `<span class="md-math md-math-fallback">${html.replace(/^<div/, '<span').replace(/<\/div>$/, '</span>')}</span>`;
  } catch { /* fall through */ }
  return `<code class="md-math-raw">${escapeHtml(src)}</code>`;
}

/** Masks fenced and inline code so math/cleanup never touches it. */
function maskCode(text) {
  const blocks = [];
  let out = text.replace(/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(\n\2[ \t]*(?=\n|$)|$)/g, (m, lead) => {
    blocks.push(m.slice(lead.length));
    return `${lead}\uE010${blocks.length - 1}\uE011`;
  });
  out = out.replace(/`[^`\n]+`/g, (m) => {
    blocks.push(m);
    return `\uE010${blocks.length - 1}\uE011`;
  });
  return { text: out, unmask: (s) => s.replace(/\uE010(\d+)\uE011/g, (_, i) => blocks[Number(i)] ?? '') };
}

/** Replaces math with placeholder tokens; returns the stash to restore after Markdown parsing. */
function extractMath(text) {
  const stash = [];
  const put = (tex, display) => {
    stash.push({ tex, display });
    return display ? `\n\n\uE000M${stash.length - 1}\uE001\n\n` : `\uE000M${stash.length - 1}\uE001`;
  };
  let out = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => put(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => put(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => put(t, false))
    // Inline $…$: opening $ not followed by space, closing $ not preceded by space nor followed by a digit ("$5 and $10" stays text).
    .replace(/(^|[^\\$\w])\$(?!\s)([^$\n]+?)(?<![\s\\])\$(?!\d)/g, (m, pre, t) => {
      if (/^\d+([.,]\d+)*$/.test(t.trim())) return m;
      return `${pre}${put(t, false)}`;
    });
  return { text: out, stash, hasMath: stash.length > 0 };
}

/** While streaming, hide an unfinished $$ block or trailing half table row so it doesn't flash as raw text. */
function trimForStreaming(text) {
  let t = text;
  const { text: masked } = maskCode(t);
  const dd = (masked.match(/\$\$/g) || []).length;
  if (dd % 2 === 1) {
    const at = t.lastIndexOf('$$');
    if (at >= 0) t = `${t.slice(0, at)}`;
  }
  // Unclosed fence: close it so the partial code still renders as code.
  const fences = (t.match(/(^|\n)(```|~~~)/g) || []).length;
  if (fences % 2 === 1) t += '\n```';
  return t;
}

const EMOJI = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]\uFE0F?/gu;

// Typographic symbols models use in tables and lists; everything else in the emoji ranges is dropped.
const KEEP_SYMBOLS = new Set([0x2713, 0x2714, 0x2717, 0x2718, 0x2605, 0x2606, 0x2610, 0x2611, 0x2612, 0x2660, 0x2663, 0x2665, 0x2666, 0x2654, 0x2655, 0x2656, 0x2657, 0x2658, 0x2659, 0x265A, 0x265B, 0x265C, 0x265D, 0x265E, 0x265F].map(c => String.fromCodePoint(c)));

/** Cleans text whose code spans are already masked. */
function cleanMasked(masked) {
  let t = masked
    .replace(/\[Completed Actions:[\s\S]*?\]/gi, '')
    .replace(/^Executing tool\s+.*$/gim, '')
    .replace(/^Action result:\s+.*$/gim, '')
    .replace(EMOJI, (m) => (KEEP_SYMBOLS.has(m[0]) ? m : ''))
    .replace(/\n{3,}/g, '\n\n');
  try { t = sanitizeUserFacingText(t); } catch { /* keep */ }
  return t;
}

export function cleanReplyText(text) {
  if (!text) return '';
  const { text: masked, unmask } = maskCode(String(text));
  return unmask(cleanMasked(masked));
}

const LANG_NAMES = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', py: 'Python', python: 'Python',
  sh: 'Shell', bash: 'Bash', zsh: 'Shell', shell: 'Shell', html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL', cpp: 'C++', 'c++': 'C++',
  c: 'C', java: 'Java', go: 'Go', rust: 'Rust', rs: 'Rust', rb: 'Ruby', ruby: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin', kotlin: 'Kotlin',
  yaml: 'YAML', yml: 'YAML', xml: 'XML', md: 'Markdown', markdown: 'Markdown', csv: 'CSV', tex: 'LaTeX', latex: 'LaTeX', jsx: 'JSX', tsx: 'TSX',
  dart: 'Dart', r: 'R', lua: 'Lua', scss: 'SCSS', txt: 'Text', text: 'Text', plaintext: 'Text', diff: 'Diff', dockerfile: 'Dockerfile',
};

const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

/** Post-processes parsed HTML: code headers, table wrappers, links, task lists. */
function decorate(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;
  root.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement;
    const cls = [...code.classList].find(c => c.startsWith('language-'));
    const lang = cls ? cls.slice(9).toLowerCase() : '';
    const label = LANG_NAMES[lang] || (lang ? lang : 'Code');
    const wrap = document.createElement('div');
    wrap.className = 'md-code';
    wrap.innerHTML = `<div class="md-code-head"><span class="md-code-lang">${escapeHtml(label)}</span><button type="button" class="md-code-copy" data-md-copy aria-label="Copy code">${COPY_ICON}<span>Copy</span></button></div>`;
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
  });
  root.querySelectorAll('table').forEach((table) => {
    const wrap = document.createElement('div');
    wrap.className = 'md-table';
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^\s*javascript:/i.test(href)) { a.removeAttribute('href'); return; }
    if (!href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  root.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
  });
  root.querySelectorAll('li > input[type="checkbox"]').forEach((box) => {
    box.disabled = true;
    box.parentElement.classList.add('md-task');
    box.parentElement.parentElement?.classList.add('md-tasks');
  });
  const div = document.createElement('div');
  div.appendChild(root);
  return div.innerHTML;
}

/**
 * Markdown → safe HTML.
 * @returns {{ html: string, hasMath: boolean }}
 */
export function renderMarkdown(text, { streaming = false } = {}) {
  if (!text) return { html: '', hasMath: false };
  let src = String(text);
  if (streaming) src = trimForStreaming(src);
  const { text: masked, unmask } = maskCode(src);
  const math = extractMath(masked);
  const body = unmask(cleanMasked(math.text));
  let html;
  try {
    html = md.parse(body);
  } catch {
    html = `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`;
  }
  html = sanitizeRenderedHtml(html);
  html = decorate(html);
  if (math.hasMath) {
    html = html
      .replace(/<p>\s*\uE000M(\d+)\uE001\s*<\/p>/g, (_, i) => renderTex(math.stash[i].tex, true))
      .replace(/\uE000M(\d+)\uE001/g, (_, i) => renderTex(math.stash[i].tex, math.stash[i].display));
    if (!katexReady()) ensureKatex();
  }
  return { html, hasMath: math.hasMath };
}

/**
 * Updates `el` to `html`, replacing only top-level blocks that changed.
 * Keeps nodes (and their state, e.g. loaded images) that did not change.
 */
export function patchHtml(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const next = [...tpl.content.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
  const prev = [...el.childNodes].filter(n => !(n.nodeType === 1 && n.classList?.contains('md-caret')));
  const caret = el.querySelector(':scope > .md-caret');
  let i = 0;
  for (; i < next.length; i++) {
    const n = next[i];
    const p = prev[i];
    if (p && p.nodeType === n.nodeType && (p.nodeType === 3 ? p.textContent === n.textContent : p.outerHTML === n.outerHTML)) continue;
    if (p) el.replaceChild(n, p);
    else if (caret) el.insertBefore(n, caret);
    else el.appendChild(n);
  }
  for (; i < prev.length; i++) prev[i].remove();
}

/** Delegated handler for code-block copy buttons. */
export function handleMarkdownClick(event) {
  const btn = event.target.closest?.('[data-md-copy]');
  if (!btn) return false;
  const code = btn.closest('.md-code')?.querySelector('pre code');
  if (!code) return true;
  const text = code.textContent || '';
  const done = () => {
    btn.classList.add('is-done');
    const label = btn.querySelector('span');
    if (label) label.textContent = 'Copied';
    setTimeout(() => { btn.classList.remove('is-done'); if (label) label.textContent = 'Copy'; }, 1400);
  };
  navigator.clipboard?.writeText(text).then(done).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { /* ignore */ }
    ta.remove();
  });
  return true;
}
