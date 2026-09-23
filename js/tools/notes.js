/* ============================================================
   TOOLBOX — Notes

   A three-pane notes app: library (all, pinned, folders, tags,
   trash) · note list · editor. Notes are stored as Markdown-flavoured
   plain text in localStorage `toolbox_notes_v1`, the same shape the
   Assistant reads and writes:
     { id, title, body, folder, pinned, updatedAt }
   plus optional fields this tool adds:
     createdAt, tags: string[], trashed: boolean, trashedAt
   (legacy `hashtags: ['#tag']` is still read.)

   The editor is a contenteditable surface that renders the Markdown
   body and turns it back into Markdown on save, so a note written in
   the editor stays readable to the Assistant and in exports.

   Typography, page style, sort and list options live in
   Preferences → Tools → Notes. This file never renders settings.
   ============================================================ */

import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
import { tbConfirm, tbPrompt } from '../lib/dialog.js';
import { getToolSettings, onToolSettings, setToolSetting } from '../lib/tool-settings.js';
import { openSettings } from '../lib/settings-ui.js';

const KEY = 'toolbox_notes_v1';
const FOLDERS_KEY = 'toolbox_notes_folders_v1';
const LEGACY_PREFS_KEY = 'toolbox_notes_font_prefs_v1';
const TRASH_DAYS = 30;
const DAY = 86400000;

const FONT_FAMILIES = { sans: 'var(--font-sans)', serif: '"New York", "Iowan Old Style", Charter, Georgia, serif', mono: 'var(--font-mono)' };
const FONT_SIZES = { small: '15px', normal: '16px', large: '18px', xl: '20px' };
const LINE_HEIGHTS = { compact: '1.4', standard: '1.65', relaxed: '1.95' };
const DEFAULT_FOLDERS = [
  { id: 'quick', name: 'Quick Notes' },
  { id: 'work', name: 'Work' },
  { id: 'personal', name: 'Personal' },
];
const KNOWN_FOLDER_NAMES = { quick: 'Quick Notes', work: 'Work', personal: 'Personal', archive: 'Archive' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- icons ---------------- */
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const ICON = {
  compose: I('<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M18.4 3.6a2 2 0 0 1 2.9 2.9L12.5 15.3 9 16l.7-3.5z"/>'),
  notes: I('<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'),
  pin: I('<path d="M12 17v4.5"/><path d="M8.5 3.5h7l-1 6 3 3.5v1.5h-11V13l3-3.5z"/>'),
  pinFill: I('<path d="M12 17v4.5"/><path d="M8.5 3.5h7l-1 6 3 3.5v1.5h-11V13l3-3.5z" fill="currentColor"/>'),
  folder: I('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  folderPlus: I('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>'),
  hash: I('<path d="M5 9h15M4 15h15M10 3.5 8 20.5M16 3.5l-2 17"/>'),
  trash: I('<path d="M4 6.5h16"/><path d="M9 6.5V4.5h6v2"/><path d="M18.5 6.5l-.8 12.6a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6.5"/><path d="M10 11v5.5M14 11v5.5"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  sort: I('<path d="M4 7h10M4 12h7M4 17h4"/><path d="M17.5 5v14M14.5 16l3 3 3-3"/>'),
  sidebar: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>'),
  back: I('<path d="m14.5 18-6-6 6-6"/>'),
  more: I('<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
  plus: I('<path d="M12 5.5v13M5.5 12h13"/>'),
  check: I('<path d="M19.5 6.5 9 17l-4.5-4.5"/>'),
  close: I('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  restore: I('<path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5"/><path d="M4 4v4.5h4.5"/>'),
  copy: I('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
  download: I('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>'),
  print: I('<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6H7z"/>'),
  edit: I('<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>'),
  sliders: I('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  bold: I('<path d="M7 5h5.5a3.5 3.5 0 0 1 0 7H7zM7 12h6.5a3.5 3.5 0 0 1 0 7H7z"/>', ' stroke-width="2.1"'),
  italic: I('<path d="M18 5h-8M14 19H6M14.5 5l-5 14"/>'),
  underline: I('<path d="M7 4.5v6a5 5 0 0 0 10 0v-6M5.5 20h13"/>'),
  strike: I('<path d="M16 6.5A4 4 0 0 0 12.5 5h-1a3.5 3.5 0 0 0-1.2 6.8M8 17.5A4 4 0 0 0 11.5 19h1a3.5 3.5 0 0 0 3.3-4.6M4.5 12h15"/>'),
  ul: I('<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><circle cx="5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>'),
  ol: I('<path d="M10.5 6.5h9M10.5 12h9M10.5 17.5h9"/><path d="M4.5 5l1.2-.7V9M4.3 13.1a1.3 1.3 0 0 1 2.5.3c0 .9-2.6 1.6-2.6 3.1h2.7" stroke-width="1.4"/>'),
  checklist: I('<rect x="3.5" y="4.5" width="6" height="6" rx="1.6"/><path d="m5 7.6 1.1 1.1 2-2.1"/><rect x="3.5" y="13.5" width="6" height="6" rx="1.6"/><path d="M13 7.5h7.5M13 16.5h7.5"/>'),
  quote: I('<path d="M5 6.5v11M9.5 8h10M9.5 12h10M9.5 16h6"/>'),
  code: I('<path d="m15.5 17.5 5-5.5-5-5.5M8.5 6.5l-5 5.5 5 5.5"/>'),
  link: I('<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>'),
  divider: I('<path d="M3.5 12h17"/><path d="M8 6.5h8M8 17.5h8" opacity=".45"/>'),
  searchOff: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8.5 11h5"/>'),
};

/* ============================================================
   Markdown  ⇄  editor HTML
   One source line maps to one block, so plain-text notes round-trip.
   ============================================================ */
const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;
function safeUrl(u) {
  let url = String(u || '').trim();
  if (!url) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[#/]/.test(url)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
    else return '';
  }
  return SAFE_URL.test(url) ? url : '';
}

function inlineHtml(text) {
  const slots = [];
  const put = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = String(text);
  s = s.replace(/`([^`\n]+)`/g, (_, c) => put(`<code>${esc(c)}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    const url = safeUrl(u);
    return url ? put(`<a href="${esc(url)}">${inlineHtml(t)}</a>`) : m;
  });
  s = s.replace(/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/g, (u) => put(`<a href="${esc(u)}">${esc(u)}</a>`));
  s = esc(s);
  s = s.replace(/&lt;u&gt;([\s\S]+?)&lt;\/u&gt;/g, '<u>$1</u>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_(?=[^\s_])([^_]*?[^\s_])_(?![_\w])/g, '$1<em>$2</em>');
  for (let k = 0; k < 3 && s.includes('\u0000'); k++) s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
  return s;
}

const LIST_RE = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(?:\[([ xX])\](?:[ \t]+|$))?(.*)$/;
const LEGACY_CHECK_RE = /^([ \t]*)\[([ xX])\](?:[ \t]+|$)(.*)$/;

function mdToHtml(md) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const root = document.createElement('div');
  let stack = [];      // open lists: { el, kind, level }
  let quote = null;    // open blockquote
  const p = (html) => { const el = document.createElement('p'); el.innerHTML = html || '<br>'; return el; };
  const indentLevel = (ws) => Math.floor(ws.replace(/\t/g, '    ').length / 2);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
    if (fence) {
      stack = []; quote = null;
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      const pre = document.createElement('pre');
      if (fence[1]) pre.dataset.lang = fence[1];
      pre.textContent = buf.join('\n') + '\n';
      root.append(pre);
      continue;
    }
    let m = line.match(LIST_RE);
    let kind, level, text, checked = false;
    if (m) {
      level = indentLevel(m[1]);
      kind = m[3] !== undefined ? 'check' : /\d/.test(m[2]) ? 'ol' : 'ul';
      checked = /x/i.test(m[3] || '');
      text = m[4];
    } else if ((m = line.match(LEGACY_CHECK_RE))) {
      level = indentLevel(m[1]); kind = 'check'; checked = /x/i.test(m[2]); text = m[3];
    }
    if (kind) {
      quote = null;
      while (stack.length && stack[stack.length - 1].level > level) stack.pop();
      let top = stack[stack.length - 1];
      if (top && top.level === level && top.kind !== kind) { stack.pop(); top = stack[stack.length - 1]; }
      if (!top || top.level < level) {
        const list = document.createElement(kind === 'ol' ? 'ol' : 'ul');
        if (kind === 'check') list.dataset.type = 'check';
        if (top) (top.el.lastElementChild || top.el).append(list);
        else root.append(list);
        top = { el: list, kind, level };
        stack.push(top);
      }
      const li = document.createElement('li');
      li.innerHTML = inlineHtml(text) || '<br>';
      if (kind === 'check') li.dataset.checked = String(checked);
      top.el.append(li);
      continue;
    }
    stack = [];
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) {
      if (!quote) { quote = document.createElement('blockquote'); root.append(quote); }
      quote.append(p(inlineHtml(q[1])));
      continue;
    }
    quote = null;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const el = document.createElement('h' + Math.min(h[1].length, 3));
      el.innerHTML = inlineHtml(h[2]) || '<br>';
      root.append(el);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { root.append(document.createElement('hr')); continue; }
    root.append(p(inlineHtml(line)));
  }
  // Trailing empty paragraphs are the result of the final newline; keep one block to type in.
  return root.innerHTML;
}

const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|PRE|BLOCKQUOTE|HR|TABLE|THEAD|TBODY|TR|SECTION|ARTICLE|HEADER|FOOTER|FIGURE|DL|DT|DD|ADDRESS|MAIN|NAV|ASIDE)$/;

function wrapMark(inner, mark) {
  if (!inner.trim()) return inner;
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

function inlineMd(nodes, opt) {
  let s = '';
  for (const c of nodes) {
    if (c.nodeType === 3) {
      let t = c.data.replace(/ /g, ' ').replace(/​/g, '');
      if (opt.collapse) t = t.replace(/\s+/g, ' ');
      s += t;
      continue;
    }
    if (c.nodeType !== 1) continue;
    const t = c.tagName;
    if (t === 'BR') { s += '\n'; continue; }
    if (t === 'SCRIPT' || t === 'STYLE' || t === 'INPUT' || t === 'BUTTON') continue;
    if (t === 'CODE') { s += '`' + c.textContent.replace(/`/g, '') + '`'; continue; }
    if (t === 'IMG') { if (c.alt) s += c.alt; continue; }
    const inner = inlineMd(c.childNodes, opt);
    const st = c.style || {};
    const bold = t === 'B' || t === 'STRONG' || /^(bold|[6-9]00)$/.test(st.fontWeight || '');
    const ital = t === 'I' || t === 'EM' || st.fontStyle === 'italic';
    const strike = t === 'S' || t === 'STRIKE' || t === 'DEL' || /line-through/.test(st.textDecoration || st.textDecorationLine || '');
    const under = t === 'U' || t === 'INS' || (t !== 'A' && /underline/.test(st.textDecoration || st.textDecorationLine || ''));
    let out = inner;
    if (t === 'A') {
      const href = c.getAttribute('href') || '';
      out = !href ? inner : (inner === href ? href : `[${inner}](${href})`);
    }
    if (strike) out = wrapMark(out, '~~');
    if (ital) out = wrapMark(out, '*');
    if (bold) out = wrapMark(out, '**');
    if (under && out.trim()) out = `<u>${out}</u>`;
    s += out;
  }
  return s;
}

function preText(el) {
  let s = '';
  el.childNodes.forEach((c) => {
    if (c.nodeType === 3) s += c.data.replace(/ /g, ' ');
    else if (c.nodeType === 1) {
      if (c.tagName === 'BR') s += '\n';
      else if (BLOCK_TAGS.test(c.tagName)) { if (s && !s.endsWith('\n')) s += '\n'; s += preText(c); }
      else s += preText(c);
    }
  });
  return s;
}

function listLines(list, depth, out, opt, inheritCheck = false) {
  const kind = list.tagName === 'OL' ? 'ol' : (list.dataset.type === 'check' || (inheritCheck && !list.dataset.type)) ? 'check' : 'ul';
  let n = parseInt(list.getAttribute('start') || '1', 10) || 1;
  for (const li of list.children) {
    if (li.tagName === 'UL' || li.tagName === 'OL') { listLines(li, depth + 1, out, opt, kind === 'check'); continue; }
    const inline = [], nested = [];
    li.childNodes.forEach((c) => (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL') ? nested : inline).push(c));
    const flat = [];
    inline.forEach((c) => { if (c.nodeType === 1 && BLOCK_TAGS.test(c.tagName)) flat.push(...c.childNodes, document.createTextNode(' ')); else flat.push(c); });
    const text = inlineMd(flat, opt).replace(/\s*\n\s*/g, ' ').trim();
    const marker = kind === 'ol' ? `${n++}. ` : kind === 'check' ? `- [${li.dataset.checked === 'true' ? 'x' : ' '}] ` : '- ';
    out.push('  '.repeat(depth) + marker + text);
    nested.forEach((l) => listLines(l, depth + 1, out, opt, kind === 'check'));
  }
}

function blockLines(el, out, opt) {
  let run = [];
  const flush = () => {
    if (!run.length) return;
    let text = inlineMd(run, opt);
    run = [];
    if (opt.collapse) { text = text.replace(/^ +| +$/gm, ''); if (!text) return; }
    text = text.replace(/\n$/, '');       // trailing <br> is a placeholder
    text.split('\n').forEach((l) => out.push(l));
  };
  for (const c of el.childNodes) {
    if (c.nodeType === 3) {
      if (/^\s*$/.test(c.data) && (opt.collapse || c.data.includes('\n'))) continue;
      run.push(c); continue;
    }
    if (c.nodeType !== 1) continue;
    const t = c.tagName;
    if (!BLOCK_TAGS.test(t)) { run.push(c); continue; }
    flush();
    if (/^H[1-6]$/.test(t)) {
      out.push('#'.repeat(Math.min(+t[1], 3)) + ' ' + inlineMd(c.childNodes, opt).replace(/\s*\n\s*/g, ' ').trim());
    } else if (t === 'UL' || t === 'OL') {
      listLines(c, 0, out, opt);
    } else if (t === 'PRE') {
      out.push('```' + (c.dataset.lang || ''));
      preText(c).replace(/\n$/, '').split('\n').forEach((l) => out.push(l));
      out.push('```');
    } else if (t === 'BLOCKQUOTE') {
      const sub = [];
      blockLines(c, sub, opt);
      (sub.length ? sub : ['']).forEach((l) => out.push(l ? '> ' + l : '>'));
    } else if (t === 'HR') {
      out.push('---');
    } else {
      const before = out.length;
      blockLines(c, out, opt);
      if (out.length === before && !opt.collapse) out.push('');
    }
  }
  flush();
}

function htmlToMd(root, opt = {}) {
  const out = [];
  blockLines(root, out, opt);
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/* Markdown → one-line plain text for previews, search and .txt */
function mdToPlain(md, { keepLines = false } = {}) {
  const lines = String(md || '').split('\n').filter((l) => !/^\s*```/.test(l)).map((l) => l
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^(\s*)(?:(?:[-*+]|\d+[.)])\s+)?\[([ xX])\](\s+|$)/, (_, ws, c) => (keepLines ? `${ws}${/x/i.test(c) ? '[x]' : '[ ]'} ` : ws))
    .replace(/^\s*[-*+]\s+/, keepLines ? '- ' : '')
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<\/?u>/g, '')
    .replace(/(\*\*|~~|`)/g, '')
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1$2'));
  return keepLines ? lines.join('\n') : lines.join(' ').replace(/\s+/g, ' ').trim();
}

/* ---------------- storage ---------------- */
function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => n && typeof n === 'object' && n.id != null) : [];
  } catch { return []; }
}
function writeRaw(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; } catch { return false; }
}

function welcomeNotes() {
  const now = Date.now();
  return [{
    id: 'welcome-note',
    title: 'Welcome to Notes',
    body: [
      'Everything you write here is saved on this device as you type.',
      '',
      '## Try it',
      '- [x] Open this note',
      '- [ ] Type `# ` at the start of a line for a heading',
      '- [ ] Type `[] ` for a checklist, `- ` for a bullet, `> ` for a quote',
      '- [ ] Select text and press **Ctrl B**, *Ctrl I* or <u>Ctrl U</u>',
      '',
      '> Tag a note by writing a word like #ideas anywhere in it.',
      '',
      'Folders, pinned notes, tags and the Trash are in the sidebar.',
    ].join('\n'),
    folder: 'quick',
    pinned: true,
    tags: ['welcome'],
    createdAt: now,
    updatedAt: now,
  }];
}

function readFolders() {
  try {
    const arr = JSON.parse(localStorage.getItem(FOLDERS_KEY) || 'null');
    if (Array.isArray(arr)) return arr.filter((f) => f && f.id && typeof f.name === 'string');
  } catch { /* fall through */ }
  return DEFAULT_FOLDERS.map((f) => ({ ...f }));
}
function writeFolders(arr) { try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(arr)); } catch { /* full */ } }

const folderIdOf = (n) => (n.folder && String(n.folder)) || 'quick';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const INLINE_TAG_RE = /(^|[\s(])#([\p{L}][\p{L}\p{N}_/-]*)/gu;
function normTag(t) { return String(t || '').trim().replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_/-]/gu, ''); }
function explicitTags(n) {
  const out = [];
  [...(Array.isArray(n.tags) ? n.tags : []), ...(Array.isArray(n.hashtags) ? n.hashtags : [])].forEach((t) => {
    const k = normTag(t); if (k && !out.includes(k)) out.push(k);
  });
  return out;
}
function inlineTags(n) {
  const out = [];
  const text = `${n.title || ''}\n${String(n.body || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']')}`;
  for (const m of text.matchAll(INLINE_TAG_RE)) { const k = normTag(m[2]); if (k && !out.includes(k)) out.push(k); }
  return out;
}
function tagsOf(n) {
  const all = explicitTags(n);
  inlineTags(n).forEach((t) => { if (!all.includes(t)) all.push(t); });
  return all;
}
const createdOf = (n) => Number(n.createdAt) || Number(n.updatedAt) || 0;
const editedOf = (n) => Number(n.updatedAt) || 0;

function titleOf(n) {
  const t = String(n.title || '').trim();
  if (t) return t;
  const first = mdToPlain(String(n.body || '').split('\n').find((l) => l.trim()) || '');
  return first.slice(0, 80);
}

function checklistStats(body) {
  let done = 0, total = 0;
  String(body || '').split('\n').forEach((l) => {
    const m = l.match(/^\s*(?:(?:[-*+]|\d+[.)])\s+)?\[([ xX])\]/);
    if (m) { total++; if (/x/i.test(m[1])) done++; }
  });
  return { done, total };
}

/* ---------------- dates ---------------- */
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function relDate(t) {
  if (!t) return '';
  const now = Date.now();
  const d = new Date(t);
  const today = startOfDay(now);
  if (t >= today) {
    if (now - t < 60000) return 'Just now';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (t >= today - DAY) return 'Yesterday';
  if (t >= today - 6 * DAY) return d.toLocaleDateString([], { weekday: 'long' });
  if (d.getFullYear() === new Date(now).getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
function longDate(t) {
  if (!t) return '';
  const d = new Date(t);
  const today = startOfDay(Date.now());
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (t >= today) return `today at ${time}`;
  if (t >= today - DAY) return `yesterday at ${time}`;
  return `${d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })} at ${time}`;
}
function dateBucket(t) {
  const today = startOfDay(Date.now());
  if (t >= today) return 'Today';
  if (t >= today - DAY) return 'Yesterday';
  if (t >= today - 7 * DAY) return 'Previous 7 days';
  if (t >= today - 30 * DAY) return 'Previous 30 days';
  const d = new Date(t);
  if (d.getFullYear() === new Date().getFullYear()) return d.toLocaleDateString([], { month: 'long' });
  return String(d.getFullYear());
}

/* One-time move of typography chosen before it lived in Preferences. */
function migrateLegacyPrefs() {
  let old;
  try { old = JSON.parse(localStorage.getItem(LEGACY_PREFS_KEY) || 'null'); } catch { old = null; }
  if (!old || typeof old !== 'object') return;
  const back = (map, v) => Object.keys(map).find((k) => map[k] === v);
  const LEGACY_SIZES = { small: '0.875rem', normal: '0.95rem', large: '1.1rem', xl: '1.3rem' };
  const LEGACY_LH = { compact: '1.3', standard: '1.7', relaxed: '2.1' };
  const LEGACY_FAM = { sans: 'var(--sans)', serif: 'Georgia, serif', mono: 'var(--mono)' };
  const fam = back(LEGACY_FAM, old.fontFamily), size = back(LEGACY_SIZES, old.fontSize), lh = back(LEGACY_LH, old.lineHeight);
  if (fam) setToolSetting('notes', 'fontFamily', fam);
  if (size) setToolSetting('notes', 'fontSize', size);
  if (lh) setToolSetting('notes', 'lineHeight', lh);
  if (old.paper && ['blank', 'lined', 'grid', 'dot'].includes(old.paper)) setToolSetting('notes', 'paper', old.paper);
  try { localStorage.removeItem(LEGACY_PREFS_KEY); } catch { /* ignore */ }
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileName = (n) => (titleOf(n) || 'Note').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Note';

/* ============================================================ */

export default {
  render(container) {
    this.destroy();
    const cleanups = [];
    this._cleanups = cleanups;
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

    migrateLegacyPrefs();
    let prefs = getToolSettings('notes');

    let notes = readRaw();
    if (notes === null) { notes = welcomeNotes(); writeRaw(notes); }
    let folders = readFolders();

    const st = {
      view: { type: 'all' },
      activeId: null,
      query: '',
      pane: 'list',
      layout: 3,
      sideOpen: false,
      freshId: null,
      pending: false,
    };
    let saveTimer = null;
    let savedTimer = null;
    let lastRange = null;

    /* ---------- data helpers ---------- */
    const getNote = (id) => notes.find((n) => n.id === id);
    function syncFolders() {
      const known = new Set(folders.map((f) => f.id));
      let changed = false;
      notes.forEach((n) => {
        const id = folderIdOf(n);
        if (!known.has(id)) { known.add(id); folders.push({ id, name: KNOWN_FOLDER_NAMES[id] || cap(id.replace(/[-_]+/g, ' ')) }); changed = true; }
      });
      if (!folders.some((f) => f.id === 'quick')) { folders.unshift({ id: 'quick', name: 'Quick Notes' }); changed = true; }
      if (changed) writeFolders(folders);
    }
    const folderName = (id) => (folders.find((f) => f.id === id) || { name: KNOWN_FOLDER_NAMES[id] || cap(String(id)) }).name;

    /* Every write re-reads storage first so edits made elsewhere
       (the Assistant, another tab) are never overwritten. */
    function commit(mutator) {
      const fresh = readRaw() || [];
      mutator(fresh);
      writeRaw(fresh);
      notes = fresh;
      syncFolders();
    }
    const withNote = (id, fn) => commit((list) => { const n = list.find((x) => x.id === id); if (n) fn(n, list); });

    function purgeTrash() {
      const limit = Date.now() - TRASH_DAYS * DAY;
      if (notes.some((n) => n.trashed && Number(n.trashedAt) && n.trashedAt < limit)) {
        commit((list) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].trashed && Number(list[i].trashedAt) && list[i].trashedAt < limit) list.splice(i, 1); });
      }
    }
    syncFolders();
    purgeTrash();

    /* ---------- markup ---------- */
    const fmtBtn = (cmd, icon, label, keys) => `<button type="button" class="nt-fb" data-cmd="${cmd}" title="${esc(label)}${keys ? ` (${keys})` : ''}" aria-label="${esc(label)}">${icon}</button>`;
    const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl+';
    const alt = mod === '⌘' ? '⌥' : 'Alt+';
    const shift = mod === '⌘' ? '⇧' : 'Shift+';

    container.innerHTML = `
      <div class="nt" data-layout="3" data-pane="list">
        <aside class="nt-side" aria-label="Library">
          <div class="nt-side-head">
            <span class="nt-side-title">Library</span>
            <button type="button" class="nt-ib nt-side-close" data-act="close-side" title="Close" aria-label="Close sidebar">${ICON.close}</button>
          </div>
          <nav class="nt-side-scroll">
            <div class="nt-nav" data-el="lib"></div>
            <div class="nt-sec">
              <div class="nt-sec-head"><span>Folders</span><button type="button" class="nt-ib nt-ib-sm" data-act="new-folder" title="New folder" aria-label="New folder">${ICON.plus}</button></div>
              <div class="nt-nav" data-el="folders"></div>
            </div>
            <div class="nt-sec" data-el="tags-sec">
              <div class="nt-sec-head"><span>Tags</span></div>
              <div class="nt-nav" data-el="tags"></div>
            </div>
          </nav>
          <div class="nt-side-foot"><div class="nt-nav" data-el="trash"></div></div>
        </aside>
        <div class="nt-scrim" data-act="close-side"></div>

        <section class="nt-list" aria-label="Notes">
          <header class="nt-list-head">
            <div class="nt-list-bar">
              <button type="button" class="nt-ib nt-open-side" data-act="open-side" title="Folders" aria-label="Show folders">${ICON.sidebar}</button>
              <button type="button" class="nt-backlink nt-to-nav" data-act="to-nav">${ICON.back}<span>Folders</span></button>
              <div class="nt-list-titles">
                <h2 class="nt-list-title" data-el="list-title">All notes</h2>
                <span class="nt-list-count" data-el="list-count"></span>
              </div>
              <button type="button" class="nt-ib" data-act="sort" title="Sort" aria-label="Sort notes">${ICON.sort}</button>
              <button type="button" class="nt-ib" data-act="empty-trash" title="Empty Trash" aria-label="Empty Trash" hidden>${ICON.trash}</button>
              <button type="button" class="nt-ib nt-ib-ink" data-act="new" title="New note (${mod}${alt}N)" aria-label="New note">${ICON.compose}</button>
            </div>
            <label class="nt-search">
              ${ICON.search}
              <input type="search" data-el="search" placeholder="Search" aria-label="Search notes" autocomplete="off" spellcheck="false">
              <kbd aria-hidden="true">/</kbd>
            </label>
          </header>
          <div class="nt-list-scroll" data-el="items" role="listbox" aria-label="Notes"></div>
        </section>

        <section class="nt-editor" aria-label="Editor">
          <header class="nt-ed-top">
            <button type="button" class="nt-backlink nt-to-list" data-act="to-list">${ICON.back}<span data-el="back-label">Notes</span></button>
            <button type="button" class="nt-chip" data-act="move" title="Move to folder">${ICON.folder}<span data-el="folder-name"></span></button>
            <span class="nt-saved" data-el="saved" aria-live="polite"></span>
            <span class="nt-grow"></span>
            <button type="button" class="nt-ib" data-act="pin" aria-pressed="false" title="Pin note" aria-label="Pin note">${ICON.pin}</button>
            <button type="button" class="nt-ib" data-act="trash-note" title="Move to Trash" aria-label="Move to Trash">${ICON.trash}</button>
            <button type="button" class="nt-ib" data-act="more" title="More" aria-label="More actions">${ICON.more}</button>
          </header>
          <div class="nt-fmt" role="toolbar" aria-label="Formatting">
            <div class="nt-fmt-in">
              <button type="button" class="nt-fb nt-fb-txt" data-cmd="h1" title="Title (${mod}${alt}1)">H1</button>
              <button type="button" class="nt-fb nt-fb-txt" data-cmd="h2" title="Heading (${mod}${alt}2)">H2</button>
              <button type="button" class="nt-fb nt-fb-txt" data-cmd="h3" title="Subheading (${mod}${alt}3)">H3</button>
              <span class="nt-fsep"></span>
              ${fmtBtn('bold', ICON.bold, 'Bold', `${mod}B`)}
              ${fmtBtn('italic', ICON.italic, 'Italic', `${mod}I`)}
              ${fmtBtn('underline', ICON.underline, 'Underline', `${mod}U`)}
              ${fmtBtn('strikeThrough', ICON.strike, 'Strikethrough', `${mod}${shift}X`)}
              <span class="nt-fsep"></span>
              ${fmtBtn('ul', ICON.ul, 'Bulleted list', `${mod}${shift}8`)}
              ${fmtBtn('ol', ICON.ol, 'Numbered list', `${mod}${shift}7`)}
              ${fmtBtn('check', ICON.checklist, 'Checklist', `${mod}${shift}L`)}
              <span class="nt-fsep"></span>
              ${fmtBtn('quote', ICON.quote, 'Quote', `${mod}${shift}.`)}
              ${fmtBtn('pre', ICON.code, 'Code block', `${mod}${alt}C`)}
              ${fmtBtn('link', ICON.link, 'Link', `${mod}K`)}
              ${fmtBtn('hr', ICON.divider, 'Divider', '')}
            </div>
          </div>
          <div class="nt-ed-scroll" data-el="scroll">
            <div class="nt-trashbar" data-el="trashbar" hidden>
              <span>This note is in the Trash.</span>
              <span class="nt-grow"></span>
              <button type="button" class="nt-btn" data-act="restore">${ICON.restore}Restore</button>
              <button type="button" class="nt-btn nt-btn-danger" data-act="delete-forever">Delete</button>
            </div>
            <article class="nt-page">
              <textarea class="nt-title" data-el="title" rows="1" placeholder="Title" aria-label="Title"></textarea>
              <div class="nt-meta" data-el="meta"></div>
              <div class="nt-tags" data-el="tags-row"></div>
              <div class="nt-body" data-el="body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-placeholder="Start writing…"></div>
            </article>
          </div>
          <footer class="nt-ed-foot" data-el="foot"><span data-el="wc"></span><span data-el="wc2"></span></footer>
          <div class="nt-ed-empty" data-el="ed-empty"></div>
        </section>
        <div class="nt-toast" data-el="toast" role="status" hidden></div>
      </div>`;

    const root = container.querySelector('.nt');
    const $ = (name) => root.querySelector(`[data-el="${name}"]`);
    const el = {
      lib: $('lib'), folders: $('folders'), tags: $('tags'), tagsSec: $('tags-sec'), trash: $('trash'),
      items: $('items'), listTitle: $('list-title'), listCount: $('list-count'), search: $('search'),
      title: $('title'), body: $('body'), meta: $('meta'), tagsRow: $('tags-row'), scroll: $('scroll'),
      saved: $('saved'), folderName: $('folder-name'), backLabel: $('back-label'), trashbar: $('trashbar'),
      wc: $('wc'), wc2: $('wc2'), foot: $('foot'), edEmpty: $('ed-empty'), toast: $('toast'),
      fmt: root.querySelector('.nt-fmt'),
      pinBtn: root.querySelector('[data-act="pin"]'),
      emptyTrashBtn: root.querySelector('[data-act="empty-trash"]'),
      sortBtn: root.querySelector('[data-act="sort"]'),
    };

    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch { /* old engines */ }

    /* ---------- layout ---------- */
    function updateFmtClip() {
      const inner = el.fmt.firstElementChild;
      el.fmt.classList.toggle('is-clipped', inner.scrollLeft + inner.clientWidth < inner.scrollWidth - 2);
    }
    function computeLayout() {
      updateFmtClip();
      const w = root.clientWidth || container.clientWidth || window.innerWidth;
      const layout = w >= 940 ? 3 : w >= 600 ? 2 : 1;
      if (layout !== st.layout) {
        st.layout = layout;
        root.dataset.layout = String(layout);
        if (layout !== 2) setSide(false);
        if (layout !== 1 && !st.activeId) selectFirst();
      }
    }
    function setPane(p) { st.pane = p; root.dataset.pane = p; if (p === 'editor') el.scroll.scrollTop = 0; }
    function setSide(open) { st.sideOpen = open; root.classList.toggle('is-side-open', open); }

    /* ---------- preferences ---------- */
    function applyPrefs() {
      prefs = getToolSettings('notes');
      const page = root.querySelector('.nt-page');
      page.style.setProperty('--nt-font', FONT_FAMILIES[prefs.fontFamily] || FONT_FAMILIES.sans);
      page.style.setProperty('--nt-size', FONT_SIZES[prefs.fontSize] || FONT_SIZES.normal);
      page.style.setProperty('--nt-lh', LINE_HEIGHTS[prefs.lineHeight] || LINE_HEIGHTS.standard);
      root.dataset.paper = prefs.paper || 'blank';
      root.classList.toggle('is-wide', prefs.readableWidth === false);
      root.classList.toggle('no-preview', prefs.showPreview === false);
      el.body.spellcheck = prefs.spellcheck !== false;
      el.title.spellcheck = prefs.spellcheck !== false;
      el.foot.hidden = prefs.showWordCount === false;
    }

    /* ---------- views ---------- */
    const viewKey = (v) => v.type === 'folder' ? `f:${v.id}` : v.type === 'tag' ? `t:${v.tag}` : v.type;
    function viewName(v = st.view) {
      if (v.type === 'all') return 'All notes';
      if (v.type === 'pinned') return 'Pinned';
      if (v.type === 'trash') return 'Trash';
      if (v.type === 'folder') return folderName(v.id);
      if (v.type === 'tag') return `#${v.tag}`;
      return 'Notes';
    }
    const live = () => notes.filter((n) => !n.trashed);

    function matchesQuery(n, q) {
      if (!q) return true;
      const hay = `${titleOf(n)}\n${n.body || ''}\n${tagsOf(n).map((t) => '#' + t).join(' ')}\n${folderName(folderIdOf(n))}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    }

    function visible() {
      const v = st.view;
      const q = st.query.trim().toLowerCase();
      let arr = v.type === 'trash' ? notes.filter((n) => n.trashed) : live();
      if (v.type === 'pinned') arr = arr.filter((n) => n.pinned);
      else if (v.type === 'folder') arr = arr.filter((n) => folderIdOf(n) === v.id);
      else if (v.type === 'tag') arr = arr.filter((n) => tagsOf(n).includes(v.tag));
      arr = arr.filter((n) => matchesQuery(n, q));
      const sort = v.type === 'trash' ? 'trashed' : prefs.sort || 'edited';
      const cmp = {
        edited: (a, b) => editedOf(b) - editedOf(a),
        created: (a, b) => createdOf(b) - createdOf(a),
        title: (a, b) => (titleOf(a) || '￿').localeCompare(titleOf(b) || '￿', undefined, { sensitivity: 'base', numeric: true }),
        trashed: (a, b) => (Number(b.trashedAt) || 0) - (Number(a.trashedAt) || 0),
      }[sort] || ((a, b) => editedOf(b) - editedOf(a));
      return arr.sort(cmp);
    }

    function groups(arr) {
      const v = st.view;
      if (v.type === 'trash') return [{ label: '', items: arr }];
      const pinned = v.type === 'pinned' ? [] : arr.filter((n) => n.pinned);
      const rest = v.type === 'pinned' ? arr : arr.filter((n) => !n.pinned);
      const out = [];
      if (pinned.length) out.push({ label: 'Pinned', items: pinned });
      const sort = prefs.sort || 'edited';
      if (prefs.groupByDate !== false && sort !== 'title' && !st.query) {
        const key = sort === 'created' ? createdOf : editedOf;
        rest.forEach((n) => {
          const label = dateBucket(key(n));
          const g = out[out.length - 1];
          if (g && g.label === label && g.bucket) g.items.push(n);
          else out.push({ label, items: [n], bucket: true });
        });
      } else if (rest.length) out.push({ label: pinned.length ? 'Notes' : '', items: rest });
      return out;
    }

    /* ---------- sidebar ---------- */
    function navItem(key, icon, label, count, { more = false, drop = false } = {}) {
      const active = viewKey(st.view) === key;
      return `<div class="nt-nav-row${active ? ' is-active' : ''}${more ? ' has-more' : ''}" ${drop ? `data-drop="${esc(key)}"` : ''}>
        <button type="button" class="nt-nav-item" data-nav="${esc(key)}"${active ? ' aria-current="true"' : ''}>
          <span class="nt-nav-ic">${icon}</span><span class="nt-nav-label">${esc(label)}</span><span class="nt-nav-count">${count || ''}</span>
        </button>
        ${more ? `<button type="button" class="nt-nav-more" data-folder-more="${esc(key.slice(2))}" title="Folder options" aria-label="Options for ${esc(label)}">${ICON.more}</button>` : ''}
      </div>`;
    }

    function renderSidebar() {
      const lv = live();
      el.lib.innerHTML = navItem('all', ICON.notes, 'All notes', lv.length, { drop: true })
        + navItem('pinned', ICON.pin, 'Pinned', lv.filter((n) => n.pinned).length, { drop: true });
      el.folders.innerHTML = folders.map((f) => navItem(`f:${f.id}`, ICON.folder, f.name, lv.filter((n) => folderIdOf(n) === f.id).length, { more: true, drop: true })).join('');
      const tagCounts = new Map();
      lv.forEach((n) => tagsOf(n).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
      const tags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b));
      el.tagsSec.hidden = !tags.length;
      el.tags.innerHTML = tags.map((t) => navItem(`t:${t}`, ICON.hash, t, tagCounts.get(t))).join('');
      el.trash.innerHTML = navItem('trash', ICON.trash, 'Trash', notes.filter((n) => n.trashed).length, { drop: true });
    }

    /* ---------- list ---------- */
    function snippet(n, q) {
      let plain = mdToPlain(n.body || '');
      const t = String(n.title || '').trim();
      if (!t) { const first = titleOf(n); if (plain.startsWith(first)) plain = plain.slice(first.length).trim(); }
      if (q) {
        const words = q.split(/\s+/).filter(Boolean);
        const idx = words.map((w) => plain.toLowerCase().indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
        if (idx > 40) plain = '…' + plain.slice(idx - 30);
        let html = esc(plain.slice(0, 220));
        words.forEach((w) => {
          const re = new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          html = html.replace(re, '<mark>$1</mark>');
        });
        return html;
      }
      return esc(plain.slice(0, 220));
    }
    function hl(text, q) {
      let html = esc(text);
      if (!q) return html;
      q.split(/\s+/).filter(Boolean).forEach((w) => {
        const re = new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(re, '<mark>$1</mark>');
      });
      return html;
    }

    function itemHtml(n) {
      const q = st.query.trim().toLowerCase();
      const active = n.id === st.activeId;
      const date = st.view.type === 'trash' ? Number(n.trashedAt) || editedOf(n) : (prefs.sort === 'created' ? createdOf(n) : editedOf(n));
      const title = titleOf(n);
      const snip = snippet(n, q);
      const cl = checklistStats(n.body);
      const meta = [];
      if (st.view.type !== 'folder') meta.push(`<span class="nt-item-folder">${ICON.folder}${esc(folderName(folderIdOf(n)))}</span>`);
      if (cl.total) meta.push(`<span class="nt-item-check${cl.done === cl.total ? ' is-done' : ''}">${ICON.checklist}${cl.done}/${cl.total}</span>`);
      const tags = tagsOf(n).slice(0, 2);
      if (tags.length && st.view.type !== 'tag') meta.push(`<span class="nt-item-tags">${tags.map((t) => '#' + esc(t)).join(' ')}</span>`);
      return `<button type="button" class="nt-item${active ? ' is-active' : ''}" data-id="${esc(n.id)}" role="option" aria-selected="${active}" draggable="true" tabindex="${active ? 0 : -1}">
        <span class="nt-item-top"><span class="nt-item-title${title ? '' : ' is-untitled'}">${title ? hl(title, q) : 'New note'}</span>${n.pinned && st.view.type !== 'trash' ? `<span class="nt-item-pin" title="Pinned">${ICON.pinFill}</span>` : ''}</span>
        <span class="nt-item-sub"><time>${esc(relDate(date))}</time><span class="nt-item-snip">${snip || '<span class="nt-dim">No additional text</span>'}</span></span>
        ${meta.length ? `<span class="nt-item-meta">${meta.join('')}</span>` : ''}
      </button>`;
    }

    function emptyState(kind) {
      const q = st.query.trim();
      const S = {
        search: [ICON.searchOff, 'No results', `Nothing matches “${esc(q)}”${st.view.type !== 'all' ? ` in ${esc(viewName())}` : ''}.`, st.view.type !== 'all' ? '<button type="button" class="nt-btn" data-act="search-all">Search all notes</button>' : ''],
        all: [ICON.notes, 'No notes yet', 'Capture a thought, a list or a plan. Everything stays on this device.', `<button type="button" class="nt-btn nt-btn-ink" data-act="new">${ICON.compose}New note</button>`],
        pinned: [ICON.pin, 'Nothing pinned', 'Pin the notes you come back to and they stay at the top.', ''],
        folder: [ICON.folder, 'This folder is empty', 'Create a note here, or drag notes onto the folder.', `<button type="button" class="nt-btn nt-btn-ink" data-act="new">${ICON.compose}New note</button>`],
        tag: [ICON.hash, 'No notes with this tag', 'Write the tag anywhere in a note to add it.', ''],
        trash: [ICON.trash, 'Trash is empty', `Deleted notes stay here for ${TRASH_DAYS} days, then disappear for good.`, ''],
      }[kind];
      return `<div class="nt-empty"><span class="nt-empty-ic">${S[0]}</span><strong>${S[1]}</strong><p>${S[2]}</p>${S[3]}</div>`;
    }

    function renderList() {
      const arr = visible();
      const q = st.query.trim();
      el.listTitle.textContent = viewName();
      el.listCount.textContent = q ? `${arr.length} result${arr.length === 1 ? '' : 's'}` : `${arr.length} note${arr.length === 1 ? '' : 's'}`;
      el.emptyTrashBtn.hidden = !(st.view.type === 'trash' && arr.length);
      el.sortBtn.hidden = st.view.type === 'trash';
      root.dataset.view = st.view.type;
      if (!arr.length) {
        el.items.innerHTML = emptyState(q ? 'search' : st.view.type);
        return;
      }
      const trashNote = st.view.type === 'trash' ? `<p class="nt-list-hint">Notes are deleted ${TRASH_DAYS} days after they are moved here.</p>` : '';
      el.items.innerHTML = trashNote + groups(arr).map((g) => `
        <div class="nt-group">
          ${g.label ? `<div class="nt-group-label">${esc(g.label)}</div>` : ''}
          ${g.items.map(itemHtml).join('')}
        </div>`).join('');
    }

    function markActiveInList() {
      el.items.querySelectorAll('.nt-item').forEach((b) => {
        const on = b.dataset.id === st.activeId;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }

    function renderAll() { renderSidebar(); renderList(); renderEditor(); }

    /* ---------- editor ---------- */
    function autosizeTitle() {
      el.title.style.height = 'auto';
      el.title.style.height = `${el.title.scrollHeight}px`;
    }
    function ensureBody() {
      const last = el.body.lastElementChild;
      if (!last) el.body.innerHTML = '<p><br></p>';
      else if (/^(PRE|HR|BLOCKQUOTE)$/.test(last.tagName)) el.body.append(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
    }
    function updatePlaceholder() {
      const kids = el.body.children;
      const empty = !el.body.textContent.trim() && kids.length <= 1 && (!kids[0] || kids[0].tagName === 'P');
      el.body.classList.toggle('is-empty', empty);
    }
    function renderMeta(n) {
      if (!n) { el.meta.textContent = ''; return; }
      const parts = [];
      if (n.trashed && n.trashedAt) parts.push(`Deleted ${longDate(n.trashedAt)}`);
      parts.push(`Edited ${longDate(editedOf(n))}`);
      if (n.createdAt && Math.abs(n.createdAt - editedOf(n)) > 60000) parts.push(`Created ${longDate(n.createdAt)}`);
      el.meta.textContent = parts.join('  ·  ');
    }
    function renderTagsRow(n) {
      if (!n) { el.tagsRow.innerHTML = ''; return; }
      const ex = explicitTags(n);
      const inl = inlineTags(n).filter((t) => !ex.includes(t));
      const ro = !!n.trashed;
      el.tagsRow.innerHTML = ex.map((t) => `<span class="nt-tag">#${esc(t)}${ro ? '' : `<button type="button" data-untag="${esc(t)}" title="Remove tag" aria-label="Remove tag ${esc(t)}">${ICON.close}</button>`}</span>`).join('')
        + inl.map((t) => `<span class="nt-tag is-inline" title="Tagged in the text">#${esc(t)}</span>`).join('')
        + (ro ? '' : `<input class="nt-tag-input" data-el="tag-input" placeholder="${ex.length || inl.length ? 'Add tag' : 'Add a tag'}" aria-label="Add tag" maxlength="40" spellcheck="false">`);
    }
    function updateCounts() {
      const text = mdToPlain(htmlToMd(el.body));
      const words = (text.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
      const chars = text.replace(/\s/g, '').length;
      const mins = Math.max(1, Math.round(words / 230));
      el.wc.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
      el.wc2.textContent = `${chars.toLocaleString()} character${chars === 1 ? '' : 's'} · ${mins} min read`;
    }
    function updateChrome(n) {
      el.pinBtn.setAttribute('aria-pressed', String(!!n?.pinned));
      el.pinBtn.innerHTML = n?.pinned ? ICON.pinFill : ICON.pin;
      el.pinBtn.title = n?.pinned ? 'Unpin note' : 'Pin note';
      el.folderName.textContent = n ? folderName(folderIdOf(n)) : '';
      el.backLabel.textContent = viewName();
    }

    function renderEditor({ keepScroll = false } = {}) {
      const n = getNote(st.activeId);
      root.classList.toggle('has-note', !!n);
      if (!n) {
        el.title.value = ''; el.body.innerHTML = '';
        el.edEmpty.innerHTML = `<div class="nt-empty"><span class="nt-empty-ic">${ICON.notes}</span><strong>No note selected</strong><p>Pick a note from the list, or start a new one.</p><button type="button" class="nt-btn nt-btn-ink" data-act="new">${ICON.compose}New note</button><span class="nt-empty-keys">${mod}${alt}N</span></div>`;
        return;
      }
      const top = el.scroll.scrollTop;
      const ro = !!n.trashed;
      el.title.value = n.title || '';
      el.title.readOnly = ro;
      el.body.innerHTML = mdToHtml(n.body || '');
      el.body.querySelectorAll('a').forEach((a) => { a.title = `${a.getAttribute('href')} — ${mod}click to open`; });
      ensureBody();
      el.body.contentEditable = ro ? 'false' : 'true';
      el.trashbar.hidden = !ro;
      root.classList.toggle('is-readonly', ro);
      renderMeta(n); renderTagsRow(n); updateChrome(n); updateCounts(); updatePlaceholder();
      setSaved('idle');
      requestAnimationFrame(autosizeTitle);
      if (keepScroll) el.scroll.scrollTop = top; else el.scroll.scrollTop = 0;
    }

    function setSaved(state) {
      clearTimeout(savedTimer);
      el.saved.dataset.state = state;
      if (state === 'saving') el.saved.innerHTML = '<i></i>Saving…';
      else if (state === 'saved') {
        el.saved.innerHTML = `${ICON.check}Saved`;
        savedTimer = setTimeout(() => { el.saved.dataset.state = 'idle'; }, 2200);
      } else el.saved.innerHTML = '';
    }

    function markDirty() {
      st.pending = true;
      updatePlaceholder();
      setSaved('saving');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 450);
    }

    function saveNow() {
      clearTimeout(saveTimer); saveTimer = null;
      if (!st.pending) return;
      st.pending = false;
      const id = st.activeId;
      const n = getNote(id);
      if (!n || n.trashed) return;
      const title = el.title.value.replace(/\s*\n\s*/g, ' ');
      const body = htmlToMd(el.body);
      if ((n.title || '') === title && (n.body || '') === body) { setSaved('saved'); return; }
      withNote(id, (x) => {
        if (!x.createdAt) x.createdAt = Number(x.updatedAt) || Date.now();
        x.title = title; x.body = body; x.updatedAt = Date.now();
      });
      if (st.freshId === id && (title.trim() || body.trim())) st.freshId = null;
      setSaved('saved');
      const cur = getNote(id);
      renderMeta(cur); renderTagsRow(cur);
      renderSidebar(); renderList();
    }

    /* ---------- selection & navigation ---------- */
    function discardFresh(exceptId) {
      const id = st.freshId;
      if (!id || id === exceptId) return;
      st.freshId = null;
      const n = getNote(id);
      if (n && !String(n.title || '').trim() && !String(n.body || '').trim()) commit((list) => { const i = list.findIndex((x) => x.id === id); if (i >= 0) list.splice(i, 1); });
    }

    function openNote(id, { focus = false, pane = true } = {}) {
      if (id !== st.activeId) { saveNow(); discardFresh(id); }
      st.activeId = id;
      renderEditor();
      renderSidebar(); renderList();
      if (st.layout === 1 && pane && id) setPane('editor');
      if (focus) focusEnd();
    }
    function selectFirst() {
      const first = visible()[0];
      st.activeId = first ? first.id : null;
    }
    function selectView(v) {
      saveNow(); discardFresh();
      st.view = v;
      st.query = ''; el.search.value = '';
      const arr = visible();
      if (st.layout !== 1 && (!st.activeId || !arr.some((n) => n.id === st.activeId))) st.activeId = arr[0]?.id || null;
      renderAll();
      setSide(false);
      if (st.layout === 1) setPane('list');
      el.items.scrollTop = 0;
    }

    function focusEnd() {
      el.body.focus();
      const r = document.createRange();
      r.selectNodeContents(el.body.lastElementChild || el.body);
      r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }

    function newNote() {
      saveNow();
      discardFresh();
      const now = Date.now();
      const v = st.view;
      const n = {
        id: `note-${now}-${Math.random().toString(36).slice(2, 7)}`,
        title: '', body: '',
        folder: v.type === 'folder' ? v.id : 'quick',
        pinned: v.type === 'pinned',
        createdAt: now, updatedAt: now,
      };
      if (v.type === 'tag') n.tags = [v.tag];
      if (v.type === 'trash') st.view = { type: 'all' };
      commit((list) => list.unshift(n));
      st.query = ''; el.search.value = '';
      st.activeId = n.id;
      renderAll();
      st.freshId = n.id;
      setSide(false);
      if (st.layout === 1) setPane('editor');
      el.title.focus();
    }

    /* ---------- note actions ---------- */
    const undoable = { timer: null };
    function toast(msg, undo) {
      clearTimeout(undoable.timer);
      el.toast.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" data-act="undo">Undo</button>' : ''}`;
      el.toast.hidden = false;
      el.toast.classList.remove('is-in'); void el.toast.offsetWidth; el.toast.classList.add('is-in');
      undoable.fn = undo || null;
      undoable.timer = setTimeout(() => { el.toast.hidden = true; undoable.fn = null; }, 5000);
    }

    function neighbourAfterRemoval(id) {
      const arr = visible();
      const i = arr.findIndex((n) => n.id === id);
      return (arr[i + 1] || arr[i - 1] || {}).id || null;
    }

    function togglePin(id) {
      saveNow();
      withNote(id, (x) => { x.pinned = !x.pinned; });
      const n = getNote(id);
      if (id === st.activeId) updateChrome(n);
      renderSidebar(); renderList();
    }

    function trashNote(id) {
      saveNow();
      const n = getNote(id); if (!n) return;
      const next = neighbourAfterRemoval(id);
      if (st.freshId === id && !String(n.title || '').trim() && !String(n.body || '').trim()) {
        st.freshId = null;
        commit((list) => { const i = list.findIndex((x) => x.id === id); if (i >= 0) list.splice(i, 1); });
      } else {
        withNote(id, (x) => { x.trashed = true; x.trashedAt = Date.now(); });
        toast('Moved to Trash', () => { restoreNote(id, { silent: true }); openNote(id, { pane: false }); });
      }
      if (st.activeId === id) {
        st.activeId = st.layout === 1 ? null : next;
        if (st.layout === 1) setPane('list');
      }
      renderAll();
    }

    function restoreNote(id, { silent = false } = {}) {
      withNote(id, (x) => { delete x.trashed; delete x.trashedAt; });
      if (!silent) {
        toast(`Restored to ${folderName(folderIdOf(getNote(id) || {}))}`);
        if (st.view.type === 'trash' && st.activeId === id) st.activeId = st.layout === 1 ? null : neighbourAfterRemoval(id);
        if (st.layout === 1 && !st.activeId) setPane('list');
      }
      renderAll();
    }

    async function deleteForever(id) {
      const n = getNote(id); if (!n) return;
      const ok = await tbConfirm(`“${titleOf(n) || 'New note'}” will be deleted immediately. This can’t be undone.`, { title: 'Delete note?', confirmText: 'Delete', destructive: true });
      if (!ok) return;
      const next = neighbourAfterRemoval(id);
      commit((list) => { const i = list.findIndex((x) => x.id === id); if (i >= 0) list.splice(i, 1); });
      if (st.activeId === id) { st.activeId = st.layout === 1 ? null : next; if (st.layout === 1) setPane('list'); }
      renderAll();
    }

    async function emptyTrash() {
      const count = notes.filter((n) => n.trashed).length;
      if (!count) return;
      const ok = await tbConfirm(`${count} note${count === 1 ? '' : 's'} will be deleted immediately. This can’t be undone.`, { title: 'Empty Trash?', confirmText: 'Empty Trash', destructive: true });
      if (!ok) return;
      commit((list) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].trashed) list.splice(i, 1); });
      if (!getNote(st.activeId)) st.activeId = null;
      renderAll();
    }

    function duplicateNote(id) {
      saveNow();
      const src = getNote(id); if (!src) return;
      const now = Date.now();
      const copy = { ...JSON.parse(JSON.stringify(src)), id: `note-${now}-${Math.random().toString(36).slice(2, 7)}`, title: `${titleOf(src) || 'New note'} copy`, pinned: false, createdAt: now, updatedAt: now };
      delete copy.trashed; delete copy.trashedAt;
      commit((list) => { const i = list.findIndex((x) => x.id === id); list.splice(i < 0 ? 0 : i, 0, copy); });
      openNote(copy.id);
      toast('Note duplicated');
    }

    function moveNote(id, folderId) {
      saveNow();
      withNote(id, (x) => { x.folder = folderId; });
      if (id === st.activeId) updateChrome(getNote(id));
      renderSidebar(); renderList();
      toast(`Moved to ${folderName(folderId)}`);
    }

    function addTag(id, raw) {
      const t = normTag(raw); if (!t) return;
      saveNow();
      withNote(id, (x) => {
        const tags = Array.isArray(x.tags) ? x.tags.map(normTag) : [];
        if (!tags.includes(t) && !explicitTags(x).includes(t)) tags.push(t);
        x.tags = tags;
      });
      const n = getNote(id);
      renderTagsRow(n); renderSidebar(); renderList();
      el.tagsRow.querySelector('[data-el="tag-input"]')?.focus();
    }
    function removeTag(id, t) {
      saveNow();
      withNote(id, (x) => {
        if (Array.isArray(x.tags)) x.tags = x.tags.filter((y) => normTag(y) !== t);
        if (Array.isArray(x.hashtags)) x.hashtags = x.hashtags.filter((y) => normTag(y) !== t);
      });
      renderTagsRow(getNote(id)); renderSidebar(); renderList();
    }

    function exportNote(id, kind) {
      saveNow();
      const n = getNote(id); if (!n) return;
      const title = titleOf(n);
      if (kind === 'md') download(`${fileName(n)}.md`, `${title ? `# ${title}\n\n` : ''}${n.body || ''}\n`, 'text/markdown;charset=utf-8');
      else download(`${fileName(n)}.txt`, `${title ? `${title}\n\n` : ''}${mdToPlain(n.body || '', { keepLines: true })}\n`, 'text/plain;charset=utf-8');
    }

    function printNote(id) {
      saveNow();
      const n = getNote(id); if (!n) return;
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.append(frame);
      const doc = frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titleOf(n) || 'Note')}</title><style>
        body{font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;max-width:680px;margin:32px auto;padding:0 24px}
        h1.t{font-size:28px;line-height:1.2;margin:0 0 4px;letter-spacing:-.02em}.m{color:#777;font-size:12px;margin-bottom:24px}
        h1{font-size:24px}h2{font-size:20px}h3{font-size:17px}h1,h2,h3{margin:1em 0 .3em}p{margin:0;min-height:1em}
        blockquote{margin:.5em 0;padding-left:14px;border-left:3px solid #ccc;color:#555}
        pre{background:#f4f4f3;border-radius:8px;padding:10px 12px;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}
        code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;background:#f4f4f3;padding:0 .3em;border-radius:4px}pre code{background:none;padding:0}
        hr{border:0;border-top:1px solid #ddd;margin:1em 0}a{color:inherit}
        ul[data-type=check]{list-style:none;padding-left:0}ul[data-type=check] li::before{content:"";display:inline-block;width:11px;height:11px;border:1.5px solid #888;border-radius:3px;margin-right:8px;vertical-align:-1px}
        ul[data-type=check] li[data-checked=true]{color:#888;text-decoration:line-through}ul[data-type=check] li[data-checked=true]::before{background:#111;border-color:#111}
      </style></head><body><h1 class="t">${esc(titleOf(n) || 'Untitled')}</h1><div class="m">${esc(new Date(editedOf(n)).toLocaleString())}</div>${mdToHtml(n.body || '')}</body></html>`);
      doc.close();
      setTimeout(() => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* blocked */ }
        setTimeout(() => frame.remove(), 1500);
      }, 60);
    }

    async function copyMarkdown(id) {
      saveNow();
      const n = getNote(id); if (!n) return;
      try { await navigator.clipboard.writeText(`${titleOf(n) ? `# ${titleOf(n)}\n\n` : ''}${n.body || ''}`); toast('Copied as Markdown'); } catch { toast('Couldn’t copy'); }
    }

    /* ---------- folders ---------- */
    async function newFolder({ thenMove } = {}) {
      const name = await tbPrompt('Name the new folder.', '', { title: 'New folder', confirmText: 'Create', placeholder: 'Folder name' });
      const clean = String(name || '').trim().slice(0, 60);
      if (!clean) return;
      folders = readFolders(); syncFolders();
      const existing = folders.find((f) => f.name.toLowerCase() === clean.toLowerCase());
      let id = existing?.id;
      if (!id) {
        const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `folder-${Date.now().toString(36)}`;
        id = base; let k = 2;
        while (folders.some((f) => f.id === id) || ['all', 'pinned', 'trash'].includes(id)) id = `${base}-${k++}`;
        folders.push({ id, name: clean });
        writeFolders(folders);
      }
      if (thenMove) moveNote(thenMove, id);
      else selectView({ type: 'folder', id });
    }
    async function renameFolder(id) {
      const f = folders.find((x) => x.id === id); if (!f) return;
      const name = await tbPrompt('Rename this folder.', f.name, { title: 'Rename folder', confirmText: 'Rename', placeholder: 'Folder name' });
      const clean = String(name || '').trim().slice(0, 60);
      if (!clean || clean === f.name) return;
      f.name = clean; writeFolders(folders);
      renderAll();
    }
    async function deleteFolder(id) {
      if (id === 'quick') return;
      const f = folders.find((x) => x.id === id); if (!f) return;
      const count = notes.filter((n) => folderIdOf(n) === id).length;
      const ok = await tbConfirm(count ? `The ${count} note${count === 1 ? '' : 's'} in “${f.name}” will move to ${folderName('quick')}.` : `“${f.name}” is empty.`, { title: 'Delete folder?', confirmText: 'Delete folder', destructive: true });
      if (!ok) return;
      saveNow();
      if (count) commit((list) => list.forEach((n) => { if (folderIdOf(n) === id) n.folder = 'quick'; }));
      folders = folders.filter((x) => x.id !== id); writeFolders(folders);
      if (st.view.type === 'folder' && st.view.id === id) selectView({ type: 'all' });
      else renderAll();
    }

    /* ---------- menus ---------- */
    const menuAt = (anchor) => { const r = anchor.getBoundingClientRect(); return { x: Math.max(8, Math.min(r.left, window.innerWidth - 240)), y: r.bottom + 6 }; };
    const small = (svg) => svg.replace('<svg ', '<svg width="15" height="15" ');

    function moveMenu(id, pos) {
      const n = getNote(id); if (!n) return;
      openContextMenu({
        ...pos, title: 'Move to',
        items: [
          ...folders.map((f) => ({ label: f.name, icon: small(folderIdOf(n) === f.id ? ICON.check : ICON.folder), action: () => { if (folderIdOf(n) !== f.id) moveNote(id, f.id); } })),
          { separator: true },
          { label: 'New folder…', icon: small(ICON.folderPlus), action: () => newFolder({ thenMove: id }) },
        ],
      });
    }

    function noteMenuItems(id, { fromList = false } = {}) {
      const n = getNote(id); if (!n) return [];
      if (n.trashed) {
        return [
          { label: 'Restore', icon: small(ICON.restore), action: () => restoreNote(id) },
          { separator: true },
          { label: 'Delete permanently', icon: small(ICON.trash), destructive: true, action: () => deleteForever(id) },
        ];
      }
      return [
        ...(fromList ? [{ label: 'Open', icon: small(ICON.notes), action: () => openNote(id) }] : []),
        { label: n.pinned ? 'Unpin' : 'Pin', icon: small(ICON.pin), action: () => togglePin(id) },
        { label: 'Duplicate', icon: small(ICON.copy), action: () => duplicateNote(id) },
        { label: 'Move to folder…', icon: small(ICON.folder), action: () => setTimeout(() => moveMenu(id, lastMenuPos), 0) },
        { separator: true },
        { label: 'Export as Markdown', icon: small(ICON.download), action: () => exportNote(id, 'md') },
        { label: 'Export as plain text', icon: small(ICON.download), action: () => exportNote(id, 'txt') },
        { label: 'Copy as Markdown', icon: small(ICON.copy), action: () => copyMarkdown(id) },
        { label: 'Print…', icon: small(ICON.print), action: () => printNote(id) },
        ...(!fromList ? [{ separator: true }, { label: 'Editor preferences…', icon: small(ICON.sliders), action: () => openSettings('tool:notes') }] : []),
        { separator: true },
        { label: 'Move to Trash', icon: small(ICON.trash), destructive: true, shortcut: fromList ? '' : `${mod}⌫`.replace('Ctrl+⌫', 'Ctrl+Del'), action: () => trashNote(id) },
      ];
    }
    let lastMenuPos = { x: 40, y: 40 };

    function sortMenu(anchor) {
      const cur = prefs.sort || 'edited';
      const opts = [['edited', 'Date edited'], ['created', 'Date created'], ['title', 'Title']];
      openContextMenu({
        ...menuAt(anchor), title: 'Sort by',
        items: [
          ...opts.map(([k, label]) => ({ label, icon: k === cur ? small(ICON.check) : '<span style="width:15px;display:inline-block"></span>', action: () => { setToolSetting('notes', 'sort', k); } })),
          { separator: true },
          { label: prefs.groupByDate === false ? 'Group by date' : 'Don’t group by date', icon: '<span style="width:15px;display:inline-block"></span>', action: () => setToolSetting('notes', 'groupByDate', prefs.groupByDate === false) },
        ],
      });
    }

    function folderMenu(id, pos) {
      const items = [{ label: 'Rename…', icon: small(ICON.edit), action: () => renameFolder(id) }];
      if (id !== 'quick') items.push({ separator: true }, { label: 'Delete folder…', icon: small(ICON.trash), destructive: true, action: () => deleteFolder(id) });
      openContextMenu({ ...pos, title: folderName(id), items });
    }

    /* ---------- formatting ---------- */
    const exec = (cmd, val = null) => { try { return document.execCommand(cmd, false, val); } catch { return false; } };
    const inBody = (node) => node && (node === el.body || el.body.contains(node));
    function restoreSelection() {
      const s = getSelection();
      if (s.rangeCount && inBody(s.anchorNode)) return;
      el.body.focus({ preventScroll: true });
      if (lastRange) { s.removeAllRanges(); s.addRange(lastRange); }
    }
    function currentBlock() {
      const s = getSelection(); if (!s.rangeCount) return null;
      let node = s.anchorNode;
      if (!inBody(node)) return null;
      while (node && node !== el.body) {
        if (node.nodeType === 1 && /^(P|DIV|H[1-6]|LI|PRE|BLOCKQUOTE)$/.test(node.tagName)) return node;
        node = node.parentNode;
      }
      return null;
    }
    const closestIn = (node, sel) => { let n = node?.nodeType === 1 ? node : node?.parentElement; n = n?.closest(sel); return n && inBody(n) && n !== el.body ? n : null; };
    function caretOffsetIn(block) {
      const s = getSelection(); if (!s.rangeCount) return -1;
      const r = s.getRangeAt(0);
      const pre = document.createRange();
      pre.selectNodeContents(block);
      pre.setEnd(r.startContainer, r.startOffset);
      return pre.toString().length;
    }
    function placeCaret(node, atEnd = false) {
      const r = document.createRange();
      r.selectNodeContents(node);
      r.collapse(!atEnd);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function newP(html = '<br>') { const p = document.createElement('p'); p.innerHTML = html; return p; }

    function toggleHeading(tag) {
      const blk = currentBlock();
      const same = blk && blk.tagName === tag.toUpperCase();
      exec('formatBlock', same ? '<p>' : `<${tag}>`);
    }
    function setCaretOffset(node, off) {
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let t, left = Math.max(0, off);
      while ((t = w.nextNode())) {
        if (left <= t.data.length) {
          const r = document.createRange(); r.setStart(t, left); r.collapse(true);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          return;
        }
        left -= t.data.length;
      }
      placeCaret(node, true);
    }
    /* Paragraph-like blocks touched by the selection (never inside lists or code). */
    function selectedBlocks() {
      const s = getSelection(); if (!s.rangeCount) return [];
      const r = s.getRangeAt(0);
      const cur = currentBlock();
      if (r.collapsed) return cur && /^(P|DIV|H[1-6])$/.test(cur.tagName) ? [cur] : [];
      return [...el.body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6')].filter((b) => !b.closest('li, pre') && !b.querySelector('p, div, h1, h2, h3, ul, ol, pre, blockquote') && r.intersectsNode(b));
    }
    const listKind = (l) => l.tagName === 'OL' ? 'ol' : l.dataset.type === 'check' ? 'check' : 'ul';
    function mergeSiblingLists(list) {
      const same = (a, b) => a && b && a.tagName === b.tagName && listKind(a) === listKind(b);
      let cur = list;
      const prev = cur.previousElementSibling;
      if (same(prev, cur)) { while (cur.firstChild) prev.append(cur.firstChild); cur.remove(); cur = prev; }
      const next = cur.nextElementSibling;
      if (same(cur, next)) { while (next.firstChild) cur.append(next.firstChild); next.remove(); }
      return cur;
    }
    function wrapQuoteChildren(bq) {
      if (!bq) return;
      const kids = [...bq.childNodes];
      const inline = kids.some((c) => c.nodeType === 3 ? c.data.trim() : !BLOCK_TAGS.test(c.tagName));
      if (!inline) return;
      if (kids.length && kids[kids.length - 1].nodeName === 'BR') kids.pop();
      const lines = []; let cur = [];
      kids.forEach((c) => { if (c.nodeName === 'BR') { lines.push(cur); cur = []; } else cur.push(c); });
      lines.push(cur);
      bq.innerHTML = '';
      lines.forEach((nodes) => { const p = newP(''); nodes.forEach((x) => p.append(x)); if (!p.childNodes.length) p.innerHTML = '<br>'; bq.append(p); });
    }
    function toggleQuote() {
      const s = getSelection();
      const cur = currentBlock();
      const off = cur ? caretOffsetIn(cur) : 0;
      const bq = closestIn(s.anchorNode, 'blockquote');
      if (bq) {
        wrapQuoteChildren(bq);
        const kids = [...bq.children];
        bq.replaceWith(...kids);
        const target = cur && kids.includes(cur) ? cur : kids[kids.length - 1];
        if (target) setCaretOffset(target, off);
      } else {
        const blocks = selectedBlocks();
        if (!blocks.length) return;
        const q = document.createElement('blockquote');
        blocks[0].before(q);
        let caretEl = null;
        blocks.forEach((b) => {
          let node = b;
          if (b.tagName !== 'P') { node = newP(''); while (b.firstChild) node.append(b.firstChild); if (!node.childNodes.length) node.innerHTML = '<br>'; b.remove(); }
          q.append(node);
          if (b === cur) caretEl = node;
        });
        const prev = q.previousElementSibling;
        if (prev && prev.tagName === 'BLOCKQUOTE') { while (q.firstChild) prev.append(q.firstChild); q.remove(); }
        setCaretOffset(caretEl || blocks[blocks.length - 1], off);
      }
      ensureBody();
    }
    function makeList(kind, checked) {
      const blocks = selectedBlocks();
      const cur = currentBlock();
      const off = cur ? caretOffsetIn(cur) : 0;
      if (!blocks.length) return;
      const list = document.createElement(kind === 'ol' ? 'ol' : 'ul');
      if (kind === 'check') list.dataset.type = 'check';
      blocks[0].before(list);
      let caretLi = null;
      blocks.forEach((b) => {
        const li = document.createElement('li');
        while (b.firstChild) li.append(b.firstChild);
        if (!li.textContent && !li.querySelector('br')) li.innerHTML = '<br>';
        if (kind === 'check') li.dataset.checked = String(!!checked);
        list.append(li);
        if (b === cur) caretLi = li;
        b.remove();
      });
      const merged = mergeSiblingLists(list);
      setCaretOffset(caretLi || merged.lastElementChild, off);
    }
    function unlistItems(list) {
      const s = getSelection();
      const r = s.getRangeAt(0);
      const curLi = closestIn(s.anchorNode, 'li');
      const off = curLi ? caretOffsetIn(curLi) : 0;
      const items = [...list.children].filter((li) => li.tagName === 'LI' && (li === curLi || r.intersectsNode(li)));
      const after = document.createElement(list.tagName);
      if (list.dataset.type) after.dataset.type = list.dataset.type;
      const out = [];
      let passed = false, caretP = null;
      [...list.children].forEach((ch) => {
        if (items.includes(ch)) {
          passed = true;
          const p = newP('');
          const nested = [];
          [...ch.childNodes].forEach((c) => { if (c.nodeName === 'UL' || c.nodeName === 'OL') nested.push(c); else p.append(c); });
          if (!p.childNodes.length) p.innerHTML = '<br>';
          out.push(p, ...nested);
          if (ch === curLi) caretP = p;
          ch.remove();
        } else if (passed) after.append(ch);
      });
      list.after(...out);
      if (after.children.length) out[out.length - 1].after(after);
      if (!list.children.length) list.remove();
      if (caretP) setCaretOffset(caretP, off);
    }
    function toggleList(kind, checked = false) {
      const s = getSelection();
      const list = closestIn(s.anchorNode, 'ul,ol');
      if (list && listKind(list) === kind) { unlistItems(list); return; }
      if (list) {
        const nl = document.createElement(kind === 'ol' ? 'ol' : 'ul');
        if (kind === 'check') nl.dataset.type = 'check';
        const cur = closestIn(s.anchorNode, 'li');
        const off = cur ? caretOffsetIn(cur) : 0;
        while (list.firstChild) {
          const li = list.firstChild;
          if (li.nodeType === 1 && li.tagName === 'LI') { if (kind === 'check') { if (!li.dataset.checked) li.dataset.checked = String(!!checked && li === cur); } else delete li.dataset.checked; }
          nl.append(li);
        }
        list.replaceWith(nl);
        const merged = mergeSiblingLists(nl);
        if (cur) setCaretOffset(cur, off); else placeCaret(merged, true);
        return;
      }
      makeList(kind, checked);
    }
    const toggleChecklist = (checked = false) => toggleList('check', checked);
    /* Chrome can leave block elements inside a <p>; lift them out. */
    function fixNesting() {
      el.body.querySelectorAll('p').forEach((p) => {
        if (!p.querySelector(':scope > :is(ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6, p, div, hr)')) return;
        const s = getSelection();
        const keep = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
        const parts = []; let run = null;
        [...p.childNodes].forEach((c) => {
          if (c.nodeType === 1 && BLOCK_TAGS.test(c.tagName)) { run = null; parts.push(c); }
          else { if (!run) { run = newP(''); parts.push(run); } run.append(c); }
        });
        p.replaceWith(...parts.filter((x) => x.tagName !== 'P' || x.textContent.trim() || x.querySelector('br, img')));
        if (keep) { s.removeAllRanges(); s.addRange(keep); }
      });
    }
    function toggleCodeBlock() {
      const s = getSelection();
      const pre = closestIn(s.anchorNode, 'pre');
      if (pre) {
        const lines = preText(pre).replace(/\n$/, '').split('\n');
        const ps = lines.map((l) => newP(esc(l) || '<br>'));
        pre.replaceWith(...ps);
        placeCaret(ps[ps.length - 1], true);
      } else {
        const blk = currentBlock();
        const text = blk ? blk.innerText.replace(/\n$/, '') : '';
        const p = document.createElement('pre');
        p.textContent = text + '\n';
        if (blk && blk.parentNode === el.body) blk.replaceWith(p);
        else if (blk && blk.tagName === 'LI') { const list = blk.closest('ul,ol'); blk.remove(); list.after(p); if (!list.children.length) list.remove(); }
        else { el.body.append(p); }
        const r = document.createRange();
        r.setStart(p.firstChild, text.length); r.collapse(true);
        s.removeAllRanges(); s.addRange(r);
      }
      ensureBody();
    }
    function insertDivider() {
      const blk = currentBlock();
      const hr = document.createElement('hr');
      const p = newP();
      let anchor = blk;
      while (anchor && anchor.parentNode !== el.body) anchor = anchor.parentNode;
      if (anchor && anchor.tagName === 'P' && !anchor.textContent.trim()) { anchor.replaceWith(hr); hr.after(p); }
      else if (anchor) { anchor.after(hr); hr.after(p); }
      else { el.body.append(hr, p); }
      placeCaret(p);
    }
    async function editLink() {
      const s = getSelection();
      const range = s.rangeCount && inBody(s.anchorNode) ? s.getRangeAt(0).cloneRange() : lastRange;
      const existing = closestIn(range?.startContainer, 'a');
      const url = await tbPrompt(existing ? 'Edit the link address. Leave it empty to remove the link.' : 'Paste or type a link address.', existing?.getAttribute('href') || 'https://', { title: existing ? 'Edit link' : 'Add link', confirmText: existing ? 'Save' : 'Add link', placeholder: 'https://example.com' });
      if (url === null || url === undefined || url === false) return;
      el.body.focus({ preventScroll: true });
      if (range) { s.removeAllRanges(); s.addRange(range); }
      const clean = safeUrl(url);
      if (existing) {
        if (!String(url).trim() || !clean) { const r = document.createRange(); r.selectNodeContents(existing); s.removeAllRanges(); s.addRange(r); exec('unlink'); }
        else existing.setAttribute('href', clean);
      } else if (clean) {
        if (range && !range.collapsed) exec('createLink', clean);
        else exec('insertHTML', `<a href="${esc(clean)}">${esc(clean)}</a>&nbsp;`);
      }
      markDirty();
    }

    function runCommand(cmd) {
      const n = getNote(st.activeId);
      if (!n || n.trashed) return;
      restoreSelection();
      switch (cmd) {
        case 'h1': case 'h2': case 'h3': toggleHeading(cmd); break;
        case 'p': exec('formatBlock', '<p>'); break;
        case 'bold': case 'italic': case 'underline': case 'strikeThrough': exec(cmd); break;
        case 'ul': toggleList('ul'); break;
        case 'ol': toggleList('ol'); break;
        case 'check': toggleChecklist(); break;
        case 'quote': toggleQuote(); break;
        case 'pre': toggleCodeBlock(); break;
        case 'hr': insertDivider(); break;
        case 'link': editLink(); return;
        default: return;
      }
      markDirty();
      updateToolbar();
    }

    function updateToolbar() {
      const s = getSelection();
      if (!s.rangeCount || !inBody(s.anchorNode)) { el.fmt.querySelectorAll('.nt-fb').forEach((b) => b.classList.remove('is-on')); return; }
      lastRange = s.getRangeAt(0).cloneRange();
      const blk = currentBlock();
      const tag = blk?.tagName;
      const list = closestIn(s.anchorNode, 'ul,ol');
      const state = {
        h1: tag === 'H1', h2: tag === 'H2', h3: tag === 'H3',
        bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline') && !closestIn(s.anchorNode, 'a'), strikeThrough: document.queryCommandState('strikeThrough'),
        ul: list?.tagName === 'UL' && list.dataset.type !== 'check', ol: list?.tagName === 'OL', check: list?.dataset.type === 'check',
        quote: !!closestIn(s.anchorNode, 'blockquote'), pre: !!closestIn(s.anchorNode, 'pre'), link: !!closestIn(s.anchorNode, 'a'),
      };
      el.fmt.querySelectorAll('.nt-fb').forEach((b) => b.classList.toggle('is-on', !!state[b.dataset.cmd]));
    }

    /* ---------- markdown shortcuts ---------- */
    function deleteBeforeCaret(block, count) {
      const s = getSelection();
      const r = s.getRangeAt(0).cloneRange();
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let left = count, first = null, offset = 0;
      while (walker.nextNode()) {
        const t = walker.currentNode;
        if (!first) first = t;
        if (left <= t.data.length) { offset = left; r.setStart(first, 0); break; }
        left -= t.data.length;
      }
      if (!first) return;
      r.setStart(first, 0);
      s.removeAllRanges(); s.addRange(r);
      exec('delete');
    }

    function mdShortcut() {
      const blk = currentBlock(); if (!blk) return false;
      const off = caretOffsetIn(blk); if (off < 0) return false;
      const before = blk.textContent.slice(0, off).replace(/ /g, ' ');
      const tag = blk.tagName;
      let action = null;
      if ((tag === 'P' || tag === 'DIV') && !closestIn(blk, 'blockquote')) {
        if (/^#{1,3} $/.test(before)) action = () => exec('formatBlock', `<h${before.length - 1}>`);
        else if (/^[-*+] $/.test(before)) action = () => toggleList('ul');
        else if (/^1[.)] $/.test(before)) action = () => toggleList('ol');
        else if (/^(- )?\[[ xX]?\] $/.test(before)) action = () => toggleChecklist(/x/i.test(before));
        else if (/^> $/.test(before)) action = () => toggleQuote();
      } else if (tag === 'LI' && closestIn(blk, 'ul')?.dataset.type !== 'check') {
        if (/^\[[ xX]?\] $/.test(before)) action = () => toggleChecklist(/x/i.test(before));
      }
      if (!action) return false;
      deleteBeforeCaret(blk, before.length);
      action();
      return true;
    }
    /* **bold**, *italic*, _italic_, ~~strike~~ and `code` turn into formatting as the closing mark is typed. */
    const INLINE_RULES = [
      [/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, 'strong'],
      [/~~([^~\s](?:[^~]*[^~\s])?)~~$/, 's'],
      [/(?:^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'em'],
      [/(?:^|[^_\w])_([^_\s](?:[^_]*[^_\s])?)_$/, 'em'],
      [/`([^`]+)`$/, 'code'],
    ];
    function inlineShortcut() {
      const s = getSelection();
      if (!s.rangeCount || !s.isCollapsed) return false;
      const node = s.anchorNode;
      if (!node || node.nodeType !== 3 || closestIn(node, 'pre, code')) return false;
      const before = node.data.slice(0, s.anchorOffset);
      for (const [re, tag] of INLINE_RULES) {
        const m = before.match(re);
        if (!m) continue;
        const inner = m[1];
        const whole = m[0].slice(m[0].indexOf(tag === 'strong' ? '**' : tag === 's' ? '~~' : tag === 'code' ? '`' : m[0].match(/[*_]/)[0]));
        const start = s.anchorOffset - whole.length;
        const r = document.createRange();
        r.setStart(node, start); r.setEnd(node, s.anchorOffset);
        r.deleteContents();
        const elx = document.createElement(tag);
        elx.textContent = inner;
        r.insertNode(elx);
        const after = document.createTextNode('\u200b');
        elx.after(after);
        const c = document.createRange(); c.setStart(after, 1); c.collapse(true);
        s.removeAllRanges(); s.addRange(c);
        return true;
      }
      return false;
    }
    function insertPreNewline(pre) {
      const s = getSelection();
      const r = s.getRangeAt(0);
      r.deleteContents();
      const nl = document.createTextNode('\n');
      r.insertNode(nl);
      const off = caretOffsetIn(pre) + 0;
      const pos = (() => { const x = document.createRange(); x.selectNodeContents(pre); x.setEndAfter(nl); return x.toString().length; })();
      pre.normalize();
      if (!pre.textContent.slice(pos)) pre.append('\n');   // a trailing newline needs a sentinel to show
      pre.normalize();
      setCaretOffset(pre, pos);
      void off;
    }
    function fenceShortcut() {
      const blk = currentBlock(); if (!blk || blk.tagName !== 'P') return false;
      const off = caretOffsetIn(blk);
      const text = blk.textContent.replace(/ /g, ' ');
      if (text.slice(0, off) !== '```' || closestIn(blk, 'blockquote,li')) return false;
      const rest = text.slice(off);
      const pre = document.createElement('pre');
      pre.textContent = rest + '\n';
      blk.replaceWith(pre);
      const r = document.createRange(); r.setStart(pre.firstChild, 0); r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      ensureBody();
      return true;
    }

    function normalizeRoot() {
      fixNesting();
      const stray = [...el.body.childNodes].some((c) => (c.nodeType === 3 && c.data.length) || (c.nodeType === 1 && !BLOCK_TAGS.test(c.tagName) && c.tagName !== 'BR'));
      if (stray) exec('formatBlock', '<p>');
      if (!el.body.firstChild) el.body.innerHTML = '<p><br></p>';
    }

    /* ---------- editor events ---------- */
    on(el.title, 'input', () => { autosizeTitle(); markDirty(); });
    on(el.title, 'keydown', (e) => {
      if (e.key === 'Enter' || (e.key === 'ArrowDown' && el.title.selectionStart === el.title.value.length)) {
        e.preventDefault();
        el.body.focus();
        const first = el.body.firstElementChild || el.body;
        placeCaret(first);
      }
    });
    on(el.title, 'paste', () => setTimeout(() => { el.title.value = el.title.value.replace(/\s*\n\s*/g, ' '); autosizeTitle(); }, 0));

    function dropZeroWidth() {
      const s = getSelection();
      const n = s.anchorNode;
      if (!n || n.nodeType !== 3 || n.data.length < 2 || !n.data.includes('\u200b')) return;
      const off = s.anchorOffset;
      const lost = (n.data.slice(0, off).match(/\u200b/g) || []).length;
      n.data = n.data.replace(/\u200b/g, '');
      const r = document.createRange(); r.setStart(n, Math.max(0, off - lost)); r.collapse(true);
      s.removeAllRanges(); s.addRange(r);
    }
    on(el.body, 'input', (e) => {
      normalizeRoot();
      if (e.inputType === 'insertText') dropZeroWidth();
      if (e.inputType === 'insertText' && (e.data === ' ' || e.data === ' ')) mdShortcut();
      else if (e.inputType === 'insertText' && e.data === '`') { if (!fenceShortcut()) inlineShortcut(); }
      else if (e.inputType === 'insertText' && /^[*_~]$/.test(e.data || '')) inlineShortcut();
      else if (e.inputType === 'insertParagraph') {
        const li = closestIn(getSelection().anchorNode, 'li');
        if (li && closestIn(li, 'ul')?.dataset.type === 'check' && !li.textContent.trim()) li.dataset.checked = 'false';
      }
      markDirty();
      updateCounts();
      updateToolbar();
    });

    on(el.body, 'keydown', (e) => {
      const modKey = e.metaKey || e.ctrlKey;
      const s = getSelection();
      const blk = currentBlock();
      // --- shortcuts
      if (modKey && !e.altKey && e.shiftKey && (e.code === 'KeyX')) { e.preventDefault(); runCommand('strikeThrough'); return; }
      if (modKey && e.shiftKey && (e.code === 'Digit8')) { e.preventDefault(); runCommand('ul'); return; }
      if (modKey && e.shiftKey && (e.code === 'Digit7')) { e.preventDefault(); runCommand('ol'); return; }
      if (modKey && e.shiftKey && (e.code === 'KeyL' || e.code === 'Digit9')) { e.preventDefault(); runCommand('check'); return; }
      if (modKey && e.shiftKey && e.code === 'Period') { e.preventDefault(); runCommand('quote'); return; }
      if (modKey && e.altKey && /^Digit[0-3]$/.test(e.code)) { e.preventDefault(); runCommand(e.code === 'Digit0' ? 'p' : `h${e.code.slice(-1)}`); return; }
      if (modKey && e.altKey && e.code === 'KeyC') { e.preventDefault(); runCommand('pre'); return; }
      if (modKey && !e.shiftKey && e.code === 'KeyK') { e.preventDefault(); runCommand('link'); return; }
      if (modKey && e.key === 'Enter') {
        const li = closestIn(s.anchorNode, 'li');
        if (li && closestIn(li, 'ul')?.dataset.type === 'check') { e.preventDefault(); li.dataset.checked = String(li.dataset.checked !== 'true'); markDirty(); }
        return;
      }
      // --- structure
      const pre = closestIn(s.anchorNode, 'pre');
      if (e.key === 'Enter' && !modKey && pre) {
        e.preventDefault();
        const off = caretOffsetIn(pre);
        const text = preText(pre);
        const atEnd = !text.slice(off).replace(/\n$/, '');
        if (atEnd && text.slice(0, off).endsWith('\n') && !e.shiftKey) {
          pre.textContent = text.slice(0, off - 1) + '\n';
          const p = newP();
          pre.after(p); placeCaret(p);
        } else insertPreNewline(pre);
        markDirty();
        return;
      }
      if (e.key === 'Tab') {
        if (pre) { e.preventDefault(); const r = s.getRangeAt(0); r.deleteContents(); const t = document.createTextNode('  '); r.insertNode(t); r.setStartAfter(t); r.collapse(true); s.removeAllRanges(); s.addRange(r); markDirty(); return; }
        if (closestIn(s.anchorNode, 'li')) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); markDirty(); return; }
        if (!e.shiftKey) { e.preventDefault(); exec('insertText', '\t'); return; }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && blk && blk.tagName === 'P' && blk.parentNode === el.body && /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(blk.textContent)) {
        e.preventDefault();
        const hr = document.createElement('hr'); const p = newP();
        blk.replaceWith(hr); hr.after(p); placeCaret(p);
        markDirty(); return;
      }
      if (e.key === 'Enter' && !e.shiftKey && blk && blk.tagName === 'P' && blk.parentNode?.tagName === 'BLOCKQUOTE' && !blk.textContent.trim() && blk === blk.parentNode.lastElementChild) {
        e.preventDefault();
        const bq = blk.parentNode;
        bq.after(blk);
        if (!bq.children.length) bq.remove();
        placeCaret(blk); markDirty(); return;
      }
      if (e.key === 'Backspace' && s.isCollapsed && blk && caretOffsetIn(blk) === 0) {
        if (/^H[1-6]$/.test(blk.tagName)) { e.preventDefault(); exec('formatBlock', '<p>'); markDirty(); return; }
        if (blk.tagName === 'P' && blk.parentNode?.tagName === 'BLOCKQUOTE' && blk === blk.parentNode.firstElementChild) {
          e.preventDefault();
          const bq = blk.parentNode; bq.before(blk); if (!bq.children.length) bq.remove();
          placeCaret(blk); markDirty(); return;
        }
        if (pre && !preText(pre).replace(/\n$/, '')) { e.preventDefault(); const p = newP(); pre.replaceWith(p); placeCaret(p); markDirty(); }
      }
    });

    // Check boxes live in the list item's left gutter.
    on(el.body, 'pointerdown', (e) => {
      const li = e.target.closest?.('li');
      if (!li || !inBody(li)) return;
      const list = li.parentElement;
      const isCheck = list?.dataset.type === 'check' || (list?.tagName === 'UL' && list.closest('ul[data-type="check"]'));
      if (!isCheck) return;
      const r = li.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(li).lineHeight) || 24;
      if (e.clientX - r.left > 28 || e.clientY - r.top > lh + 2) return;
      e.preventDefault();
      if (getNote(st.activeId)?.trashed) return;
      li.dataset.checked = String(li.dataset.checked !== 'true');
      markDirty();
    });
    on(el.body, 'click', (e) => {
      const a = e.target.closest?.('a');
      if (a && (e.metaKey || e.ctrlKey || el.body.contentEditable === 'false')) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
    });
    on(el.body, 'paste', (e) => {
      const dt = e.clipboardData; if (!dt) return;
      const html = dt.getData('text/html');
      const text = dt.getData('text/plain');
      if (closestIn(getSelection().anchorNode, 'pre')) { e.preventDefault(); exec('insertText', text); return; }
      if (html) {
        e.preventDefault();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const md = htmlToMd(doc.body, { collapse: true });
        exec('insertHTML', mdToHtml(md));
      } else if (text && text.includes('\n')) {
        e.preventDefault();
        exec('insertHTML', mdToHtml(text));
      }
    });
    on(document, 'selectionchange', () => { if (root.isConnected) updateToolbar(); });
    on(el.body, 'blur', () => saveNow());
    on(el.title, 'blur', () => saveNow());

    // toolbar: keep focus in the editor
    on(el.fmt.firstElementChild, 'scroll', updateFmtClip, { passive: true });
    on(el.fmt, 'pointerdown', (e) => { if (e.target.closest('.nt-fb')) e.preventDefault(); });
    on(el.fmt, 'click', (e) => { const b = e.target.closest('.nt-fb'); if (b) runCommand(b.dataset.cmd); });

    // tags row
    on(el.tagsRow, 'click', (e) => {
      const b = e.target.closest('[data-untag]');
      if (b) removeTag(st.activeId, b.dataset.untag);
    });
    on(el.tagsRow, 'keydown', (e) => {
      const input = e.target.closest('[data-el="tag-input"]'); if (!input) return;
      if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && input.value.trim()) { e.preventDefault(); addTag(st.activeId, input.value); }
      else if (e.key === 'Backspace' && !input.value) {
        const ex = explicitTags(getNote(st.activeId) || {});
        if (ex.length) { e.preventDefault(); removeTag(st.activeId, ex[ex.length - 1]); el.tagsRow.querySelector('[data-el="tag-input"]')?.focus(); }
      } else if (e.key === 'Escape') { input.value = ''; input.blur(); }
    });
    on(el.tagsRow, 'focusout', (e) => { const input = e.target.closest('[data-el="tag-input"]'); if (input && input.value.trim()) addTag(st.activeId, input.value); });

    /* ---------- list & sidebar events ---------- */
    on(el.search, 'input', () => {
      st.query = el.search.value;
      renderList();
      const arr = visible();
      if (st.layout !== 1 && arr.length && !arr.some((n) => n.id === st.activeId)) { saveNow(); st.activeId = arr[0].id; renderEditor(); markActiveInList(); }
    });
    on(el.search, 'keydown', (e) => {
      if (e.key === 'Escape') { el.search.value = ''; st.query = ''; renderList(); el.search.blur(); }
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); const first = el.items.querySelector('.nt-item.is-active') || el.items.querySelector('.nt-item'); first?.focus(); if (e.key === 'Enter' && first) openNote(first.dataset.id); }
    });

    on(el.items, 'click', (e) => {
      const item = e.target.closest('.nt-item');
      if (item) { openNote(item.dataset.id); return; }
    });
    on(el.items, 'keydown', (e) => {
      const item = e.target.closest('.nt-item'); if (!item) return;
      const all = [...el.items.querySelectorAll('.nt-item')];
      const i = all.indexOf(item);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = all[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) { openNote(next.dataset.id, { pane: false }); el.items.querySelector(`.nt-item[data-id="${CSS.escape(next.dataset.id)}"]`)?.focus(); }
      } else if (e.key === 'Enter') { e.preventDefault(); openNote(item.dataset.id); if (st.layout !== 1) focusEnd(); }
      else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); const n = getNote(item.dataset.id); if (n?.trashed) deleteForever(n.id); else trashNote(item.dataset.id); }
    });
    on(el.items, 'contextmenu', (e) => {
      const item = e.target.closest('.nt-item');
      if (!item) return;
      e.preventDefault();
      lastMenuPos = { x: e.clientX, y: e.clientY };
      const n = getNote(item.dataset.id); if (!n) return;
      openContextMenu({ x: e.clientX, y: e.clientY, title: titleOf(n) || 'New note', items: noteMenuItems(n.id, { fromList: true }) });
    });

    // drag notes onto folders / pinned / trash
    on(el.items, 'dragstart', (e) => {
      const item = e.target.closest('.nt-item'); if (!item) return;
      saveNow();
      e.dataTransfer.setData('text/x-note-id', item.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      root.classList.add('is-dragging');
    });
    on(el.items, 'dragend', () => { root.classList.remove('is-dragging'); root.querySelectorAll('.is-drop').forEach((x) => x.classList.remove('is-drop')); });
    const side = root.querySelector('.nt-side');
    on(side, 'dragover', (e) => {
      const row = e.target.closest('[data-drop]'); if (!row || !e.dataTransfer.types.includes('text/x-note-id')) return;
      e.preventDefault();
      side.querySelectorAll('.is-drop').forEach((x) => x !== row && x.classList.remove('is-drop'));
      row.classList.add('is-drop');
    });
    on(side, 'dragleave', (e) => { const row = e.target.closest('[data-drop]'); if (row && !row.contains(e.relatedTarget)) row.classList.remove('is-drop'); });
    on(side, 'drop', (e) => {
      const row = e.target.closest('[data-drop]'); if (!row) return;
      const id = e.dataTransfer.getData('text/x-note-id'); if (!id) return;
      e.preventDefault();
      row.classList.remove('is-drop');
      const key = row.dataset.drop;
      const n = getNote(id); if (!n) return;
      if (key === 'trash') { if (!n.trashed) trashNote(id); }
      else if (key === 'pinned') { if (!n.pinned) togglePin(id); }
      else if (key.startsWith('f:')) { if (n.trashed) restoreNote(id, { silent: true }); moveNote(id, key.slice(2)); renderAll(); }
      else if (key === 'all' && n.trashed) restoreNote(id);
    });

    on(side, 'click', (e) => {
      const more = e.target.closest('[data-folder-more]');
      if (more) { e.stopPropagation(); folderMenu(more.dataset.folderMore, menuAt(more)); return; }
      const nav = e.target.closest('[data-nav]');
      if (!nav) return;
      const k = nav.dataset.nav;
      selectView(k.startsWith('f:') ? { type: 'folder', id: k.slice(2) } : k.startsWith('t:') ? { type: 'tag', tag: k.slice(2) } : { type: k });
    });
    on(side, 'contextmenu', (e) => {
      const nav = e.target.closest('[data-nav^="f:"]'); if (!nav) return;
      e.preventDefault();
      folderMenu(nav.dataset.nav.slice(2), { x: e.clientX, y: e.clientY });
    });

    /* ---------- actions (buttons anywhere) ---------- */
    on(root, 'click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b || !root.contains(b)) return;
      const id = st.activeId;
      switch (b.dataset.act) {
        case 'new': newNote(); break;
        case 'open-side': if (st.layout === 1) setPane('nav'); else setSide(true); break;
        case 'close-side': setSide(false); break;
        case 'to-nav': setPane('nav'); break;
        case 'to-list': saveNow(); discardFresh(); setPane('list'); renderSidebar(); renderList(); break;
        case 'sort': sortMenu(b); break;
        case 'empty-trash': emptyTrash(); break;
        case 'search-all': { const q = st.query; selectView({ type: 'all' }); el.search.value = q; st.query = q; renderList(); break; }
        case 'pin': if (id) togglePin(id); break;
        case 'trash-note': if (id) trashNote(id); break;
        case 'move': if (id) { lastMenuPos = menuAt(b); moveMenu(id, lastMenuPos); } break;
        case 'more': if (id) { lastMenuPos = menuAt(b); openContextMenu({ ...lastMenuPos, x: Math.max(8, b.getBoundingClientRect().right - 230), items: noteMenuItems(id) }); } break;
        case 'restore': if (id) restoreNote(id); break;
        case 'delete-forever': if (id) deleteForever(id); break;
        case 'new-folder': newFolder(); break;
        case 'undo': { const fn = undoable.fn; el.toast.hidden = true; undoable.fn = null; fn?.(); break; }
        default: break;
      }
    });

    /* ---------- global keys ---------- */
    on(window, 'keydown', (e) => {
      if (!root.isConnected) return;
      if (document.querySelector('.tb-dialog-backdrop, .dialog-backdrop, [role="dialog"][aria-modal="true"]')?.offsetParent) return;
      const modKey = e.metaKey || e.ctrlKey;
      const typing = e.target.closest?.('input, textarea, [contenteditable="true"]');
      if (modKey && e.altKey && e.code === 'KeyN') { e.preventDefault(); newNote(); return; }
      if (modKey && !e.shiftKey && !e.altKey && e.code === 'KeyS') { e.preventDefault(); st.pending = true; saveNow(); return; }
      if (modKey && e.shiftKey && e.code === 'KeyP' && st.activeId) { e.preventDefault(); togglePin(st.activeId); return; }
      if (modKey && e.altKey && e.code === 'KeyF') { e.preventDefault(); if (st.layout === 1) setPane('list'); el.search.focus(); el.search.select(); return; }
      if (!typing && e.key === '/' && !modKey) { e.preventDefault(); if (st.layout === 1) setPane('list'); el.search.focus(); return; }
      if (e.key === 'Escape' && st.sideOpen) { setSide(false); }
    });

    /* ---------- external changes (Assistant, other tabs) ---------- */
    function refreshFromStorage() {
      const fresh = readRaw(); if (!fresh) return;
      const before = getNote(st.activeId);
      const same = JSON.stringify(fresh) === JSON.stringify(notes);
      if (same) return;
      notes = fresh;
      folders = readFolders(); syncFolders();
      const after = getNote(st.activeId);
      if (!after) {
        st.pending = false; clearTimeout(saveTimer);
        if (st.layout !== 1) selectFirst(); else { st.activeId = null; setPane('list'); }
        renderAll();
        return;
      }
      if (!before || before.body !== after.body || before.title !== after.title || before.updatedAt !== after.updatedAt || !!before.trashed !== !!after.trashed) {
        st.pending = false; clearTimeout(saveTimer);
        renderEditor({ keepScroll: true });
      } else { updateChrome(after); renderTagsRow(after); }
      renderSidebar(); renderList();
    }
    on(window, 'toolbox:notes-changed', refreshFromStorage);
    on(window, 'storage', (e) => { if (e.key === KEY || e.key === FOLDERS_KEY || e.key === null) refreshFromStorage(); });
    on(window, 'focus', () => { if (!st.pending) refreshFromStorage(); });
    on(document, 'visibilitychange', () => { if (document.hidden) saveNow(); });
    on(window, 'pagehide', () => saveNow());

    /* ---------- prefs ---------- */
    const offPrefs = onToolSettings('notes', () => { applyPrefs(); renderList(); });
    cleanups.push(() => offPrefs?.());

    /* ---------- resize ---------- */
    const ro = new ResizeObserver(() => computeLayout());
    ro.observe(root);
    cleanups.push(() => ro.disconnect());

    /* ---------- init ---------- */
    applyPrefs();
    const w0 = container.clientWidth || window.innerWidth;
    st.layout = w0 >= 940 ? 3 : w0 >= 600 ? 2 : 1;
    root.dataset.layout = String(st.layout);
    if (st.layout !== 1) selectFirst();
    renderAll();

    this._flush = () => { saveNow(); discardFresh(); };
    this._api = { refresh: refreshFromStorage, mdToHtml, htmlToMd };
  },

  destroy() {
    try { this._flush?.(); } catch { /* ignore */ }
    this._flush = null;
    closeContextMenu?.();
    (this._cleanups || []).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    this._cleanups = null;
    this._api = null;
  },
};

export { mdToHtml, htmlToMd, mdToPlain };
