/* ============================================================
   TOOLBOX — Mail

   A mail client for Gmail and Microsoft 365 / Outlook mailboxes
   connected through /api/mail/* (server-mail.js).

   Layout follows the space it gets:
     wide    folder rail · message list · reading pane
     medium  message list · reading pane (folders in a drawer)
     narrow  message list → message (back), full-screen compose
   The reading pane can sit on the right, below the list, or be off
   (Preferences → Tools → Mail). This file never renders settings.

   Message bodies render in a sandboxed iframe with scripts disabled
   and a CSP that blocks remote content until "Show images".
   ============================================================ */

import { mailApi } from '../lib/mail-provider.js';
import { createMailSetupUI, connectMailbox } from '../views/mail-setup.js';
import { getCurrentUser } from '../lib/supabase.js';
import { openSettings } from '../lib/settings-ui.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';

const DRAFT_KEY = 'toolbox_mail_draft_v2';
const PAGE_SIZE = 30;
const MAX_ATTACH_BYTES = 24 * 1024 * 1024;
const REFRESH_MS = 60_000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/* ---------- icons ---------- */
const P = {
  inbox: '<path d="M3 13h5l1.5 2.5h5L16 13h5"/><path d="M5.6 5h12.8L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  starred: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  important: '<path d="M4 6h11l5 6-5 6H4l4-6z"/>',
  sent: '<path d="M20.5 3.5 10 14"/><path d="m20.5 3.5-6.5 17-4-6.5-6.5-4z"/>',
  drafts: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  all: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  spam: '<path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7z"/><path d="M12 8v5M12 16h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  label: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  compose: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  more: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  reply: '<path d="M10 8 4 13l6 5"/><path d="M4 13h10a6 6 0 0 1 6 6"/>',
  replyAll: '<path d="M11 8 5 13l6 5"/><path d="M7 8l-5 5 5 5"/><path d="M5 13h9a6 6 0 0 1 6 6"/>',
  forward: '<path d="m14 8 6 5-6 5"/><path d="M20 13H10a6 6 0 0 0-6 6"/>',
  clip: '<path d="m20 11.5-8.2 8.2a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  unread: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  read: '<path d="M3 10.5 12 4l9 6.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="m3.5 11 8.5 6 8.5-6"/>',
  move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M11 13h6M14.5 10.5 17 13l-2.5 2.5"/>',
  minimize: '<path d="M5 12h14"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  collapse: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
  download: '<path d="M12 4v11M7 10.5 12 15.5l5-5M5 20h14"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m20.5 16-5-5-9.5 8.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r=".9"/><circle cx="4.5" cy="12" r=".9"/><circle cx="4.5" cy="17" r=".9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mailOpen: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>',
  signout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
};
const icon = (name, cls = '') => `<svg class="ml-i${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.label}</svg>`;
const starIcon = (on) => `<svg class="ml-i" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">${P.starred}</svg>`;
const ROLE_ICON = { inbox: 'inbox', starred: 'starred', important: 'important', sent: 'sent', drafts: 'drafts', all: 'all', archive: 'archive', spam: 'spam', trash: 'trash', label: 'label' };

/* ---------- formatting ---------- */
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function shortDate(iso) {
  const d = new Date(iso), now = new Date();
  if (Number.isNaN(+d)) return '';
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
function longDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
const displayName = (a) => (a?.name || a?.email || 'Unknown').replace(/^"|"$/g, '');
const initial = (a) => (displayName(a).replace(/[^\p{L}\p{N}]/gu, '')[0] || '?').toUpperCase();
function avatar(a, cls = '') {
  // Neutral tone picked from the address so senders are told apart without colour.
  const s = String(a?.email || a?.name || '');
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `<span class="ml-avatar${cls ? ` ${cls}` : ''}" data-tone="${h % 4}" aria-hidden="true">${esc(initial(a))}</span>`;
}
function linkify(text) {
  return esc(text).replace(/\b(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
function textToHtml(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let out = '', inQuote = false;
  for (const line of lines) {
    const q = /^\s*>/.test(line);
    if (q && !inQuote) { out += '<div class="ml-quote">'; inQuote = true; }
    if (!q && inQuote) { out += '</div>'; inQuote = false; }
    out += `${linkify(q ? line.replace(/^\s*>\s?/, '') : line)}\n`;
  }
  if (inQuote) out += '</div>';
  return out;
}
const plainToHtml = (t) => esc(t).replace(/\n/g, '<br>');
function subjectPrefix(prefix, subject) {
  const s = String(subject || '').trim();
  const re = prefix === 'Re:' ? /^re:/i : /^(fwd?|fw):/i;
  return re.test(s) ? s : `${prefix} ${s}`.trim();
}

/* ---------- safe HTML rendering ---------- */
const FRAME_CSS = `html,body{margin:0;padding:0;background:#fff;color:#1a1a1a}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;overflow-wrap:anywhere;word-wrap:break-word;padding:2px}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{color:#0a0a0a}blockquote{margin:0 0 0 .6em;padding-left:.9em;border-left:2px solid #d6d6d4;color:#525252}`;

function sanitizeDoc(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,noscript,iframe,frame,frameset,object,embed,applet,base,meta,template,portal').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') { el.removeAttribute(attr.name); continue; }
      if (['href', 'src', 'action', 'xlink:href', 'background', 'poster'].includes(name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll('form').forEach(f => f.removeAttribute('action'));
  doc.querySelectorAll('a[href]').forEach(a => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); });
  return doc;
}

const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const REMOTE_RE = /^\s*(https?:)?\/\//i;
const CSS_REMOTE_RE = /url\(\s*['"]?\s*(https?:)?\/\//i;
function buildFrame(html, allowRemote) {
  const doc = sanitizeDoc(html);
  let remote = false;
  doc.querySelectorAll('img,source,video,audio,input[type=image]').forEach(el => {
    for (const a of ['src', 'srcset', 'poster']) {
      const v = el.getAttribute(a);
      if (v && (REMOTE_RE.test(v) || (a === 'srcset' && /https?:/.test(v)))) {
        remote = true;
        if (!allowRemote) { el.removeAttribute(a); if (a === 'src' && el.tagName === 'IMG') { const h = parseInt(el.getAttribute('height'), 10); el.setAttribute('src', BLANK_IMG); el.setAttribute('alt', ''); el.style.height = h > 0 ? `${h}px` : '0'; } }
      }
    }
  });
  doc.querySelectorAll('img[src]').forEach(el => { const v = el.getAttribute('src'); if (!/^\s*(data:|https?:|\/\/)/i.test(v)) { el.setAttribute('src', BLANK_IMG); el.setAttribute('alt', ''); } });
  doc.querySelectorAll('[background]').forEach(el => { if (REMOTE_RE.test(el.getAttribute('background'))) { remote = true; if (!allowRemote) el.removeAttribute('background'); } });
  doc.querySelectorAll('[style]').forEach(el => { if (CSS_REMOTE_RE.test(el.getAttribute('style'))) { remote = true; if (!allowRemote) el.setAttribute('style', el.getAttribute('style').replace(/url\([^)]*\)/gi, 'none')); } });
  doc.querySelectorAll('link').forEach(l => { if (/stylesheet/i.test(l.rel) && REMOTE_RE.test(l.getAttribute('href') || '')) { remote = true; if (!allowRemote) l.remove(); } else if (!/stylesheet/i.test(l.rel)) l.remove(); });
  doc.querySelectorAll('style').forEach(s => { if (CSS_REMOTE_RE.test(s.textContent)) remote = true; });
  const ext = allowRemote ? ' https: http:' : '';
  const csp = `default-src 'none'; img-src data:${ext}; style-src 'unsafe-inline'${ext}; font-src data:${ext}; media-src${allowRemote ? ext : " 'none'"}`;
  const headStyles = [...doc.head.querySelectorAll('style,link')].map(n => n.outerHTML).join('');
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width"><base target="_blank"><style>${FRAME_CSS}</style>${headStyles}</head><body>${doc.body.innerHTML}</body></html>`;
  return { srcdoc, remote };
}

function mountFrame(host, srcdoc, onKey = null) {
  const frame = document.createElement('iframe');
  frame.className = 'ml-frame';
  frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('title', 'Message body');
  frame.srcdoc = srcdoc;
  let ro = null;
  const fit = () => {
    const d = frame.contentDocument;
    if (!d?.body) return;
    const body = d.body;
    body.style.zoom = '';
    const cw = frame.clientWidth;
    const sw = d.documentElement.scrollWidth;
    if (cw && sw > cw + 2) body.style.zoom = String(Math.max(0.4, cw / sw));
    frame.style.height = `${Math.max(40, Math.ceil(d.documentElement.scrollHeight))}px`;
  };
  frame.addEventListener('load', () => {
    fit();
    try {
      ro = new ResizeObserver(() => fit());
      ro.observe(frame.contentDocument.body);
      frame.contentDocument.addEventListener('load', fit, true);
      if (onKey) frame.contentDocument.addEventListener('keydown', onKey);
    } catch { /* detached */ }
  });
  host.replaceChildren(frame);
  return () => ro?.disconnect();
}

/* ---------- component state ---------- */
const layoutFor = (w) => (w >= 1060 ? 'wide' : w >= 720 ? 'medium' : 'narrow');

export default {
  render(container) {
    this.container = container;
    this.prefs = getToolSettings('mail');
    this.S = null;
    this.cleanup = [];
    this.pendingSends = [];
    this.offPrefs = onToolSettings('mail', (p) => this.applyPrefs(p));
    const reinit = () => { if (!this.S?.compose?.dirty) this.boot(); };
    const onConfig = (e) => { if (e.detail?.accountId) mailApi.activeAccountId = e.detail.accountId; reinit(); };
    window.addEventListener('toolbox:mailconfigchange', onConfig);
    window.addEventListener('toolbox:authchange', reinit);
    this.cleanup.push(() => { window.removeEventListener('toolbox:mailconfigchange', onConfig); window.removeEventListener('toolbox:authchange', reinit); });
    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey, true);
    // "/" searches mail while Mail is open (the app palette would take it otherwise).
    this.onSlash = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || !this.S || !this.root?.isConnected || !this.prefs.shortcuts) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const input = this.root.querySelector('.ml-search-input');
      if (!input || !input.getClientRects().length) return;
      e.preventDefault();
      e.stopPropagation();
      input.focus();
    };
    window.addEventListener('keydown', this.onSlash, true);
    this.onBeforeUnload = (e) => { if (this.pendingSends.length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.boot();
  },

  destroy() {
    for (const p of this.pendingSends.splice(0)) { clearTimeout(p.timer); void this.deliver(p, { quiet: true }); }
    this.saveDraft();
    this.offPrefs?.();
    this.cleanup?.forEach(fn => fn());
    this.cleanup = [];
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keydown', this.onSlash, true);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.teardownApp();
    this.container = null;
  },

  teardownApp() {
    clearInterval(this.refreshTimer);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.frameCleanups?.forEach(fn => fn());
    this.frameCleanups = [];
    this.closeMenu();
    this.readerAbort?.abort();
  },

  /* ================= boot / connect ================= */
  async boot() {
    if (!this.container) return;
    this.teardownApp();
    const user = getCurrentUser();
    if (!user) { this.renderConnect(); return; }
    this.container.innerHTML = `<div class="ml ml-booting"><div class="ml-boot"><span class="ml-spinner"></span></div></div>`;
    let status;
    try { status = await mailApi.status(); }
    catch (err) {
      if (!this.container) return;
      if (err.code === 'signin') { this.renderConnect(); return; }
      this.renderFatal(err);
      return;
    }
    if (!this.container) return;
    const accounts = status.accounts || [];
    if (!accounts.length) { this.renderConnect(); return; }
    const saved = mailApi.activeAccountId;
    const accountId = accounts.some(a => a.id === saved) ? saved : accounts[0].id;
    mailApi.activeAccountId = accountId;
    this.S = {
      accounts, accountId, user,
      folders: [], folderId: '', foldersLoading: true,
      rows: [], listLoading: true, listError: null, nextPageToken: null, loadingMore: false, threadList: false,
      q: '', searching: false,
      selected: new Set(), cursor: -1,
      openKey: null, reader: null, readerLoading: false, readerError: null,
      imagesFor: new Set(), expanded: new Set(),
      view: 'list', railOpen: false, layout: 'wide',
      compose: null, toastSeq: 0,
      contacts: new Map(),
    };
    this.renderApp();
    this.restoreDraft();
    await this.loadFolders();
    await this.loadList();
    this.refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') void this.refresh({ silent: true }); }, REFRESH_MS);
  },

  renderConnect() {
    this.S = null;
    this.container.innerHTML = '<div class="ml ml-connect"></div>';
    this.container.firstElementChild.appendChild(createMailSetupUI({ variant: 'hero' }));
  },

  renderFatal(err) {
    const unavailable = err.status === 404 || err.status === 503;
    this.container.innerHTML = `
      <div class="ml ml-connect"><div class="ml-state">
        <span class="ml-state-icon">${icon('alert')}</span>
        <h3>${unavailable ? 'Mail isn’t available here' : 'Mail couldn’t load'}</h3>
        <p>${esc(err.message)}</p>
        <button type="button" class="btn btn-secondary btn-sm" data-act="retry-boot">Try again</button>
      </div></div>`;
    this.container.querySelector('[data-act="retry-boot"]').addEventListener('click', () => this.boot());
  },

  /* ================= shell ================= */
  get account() { return this.S?.accounts.find(a => a.id === this.S.accountId) || null; },
  get provider() { return this.account?.provider || 'google'; },
  get folder() { return this.S?.folders.find(f => f.id === this.S.folderId) || null; },
  folderByRole(role) { return this.S.folders.find(f => f.role === role) || null; },
  useThreads() { return !!this.prefs.threading && this.provider === 'google'; },
  keyOf(row) { return this.S.threadList ? row.threadId : row.id; },
  rowByKey(key) { return this.S.rows.find(r => this.keyOf(r) === key) || null; },

  renderApp() {
    const p = this.prefs;
    this.container.innerHTML = `
      <div class="ml" data-pane="${esc(p.readingPane)}" data-density="${esc(p.density)}" data-snippets="${p.snippets ? '1' : '0'}" data-view="list" data-layout="wide">
        <div class="ml-app">
          <aside class="ml-rail" aria-label="Mailboxes"></aside>
          <div class="ml-scrim" data-act="close-rail" aria-hidden="true"></div>
          <div class="ml-main">
            <section class="ml-list" aria-label="Messages">
              <header class="ml-list-head"></header>
              <div class="ml-rows" role="list" tabindex="-1"></div>
            </section>
            <section class="ml-pane" aria-label="Reading pane"></section>
          </div>
        </div>
        <button type="button" class="ml-fab" data-act="compose" aria-label="Compose">${icon('compose')}<span>Compose</span></button>
        <div class="ml-compose-host"></div>
        <div class="ml-toasts" role="status" aria-live="polite"></div>
      </div>`;
    this.root = this.container.querySelector('.ml');
    this.el = {
      rail: this.root.querySelector('.ml-rail'),
      head: this.root.querySelector('.ml-list-head'),
      rows: this.root.querySelector('.ml-rows'),
      pane: this.root.querySelector('.ml-pane'),
      composeHost: this.root.querySelector('.ml-compose-host'),
      toasts: this.root.querySelector('.ml-toasts'),
    };
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    this.root.addEventListener('submit', (e) => this.onSubmit(e));
    this.root.addEventListener('input', (e) => { if (e.target.matches('.ml-search-input')) this.root.querySelector('.ml-search')?.classList.toggle('has-value', !!e.target.value); });
    this.ro = new ResizeObserver(([entry]) => this.setLayout(entry.contentRect.width));
    this.ro.observe(this.root);
    this.setLayout(this.root.clientWidth);
    this.renderRail();
    this.renderHead();
    this.renderRows();
    this.renderPane();
  },

  setLayout(width) {
    if (!this.root || !width) return;
    const layout = layoutFor(width);
    if (layout === this.S.layout && this.root.dataset.layout === layout) return;
    this.S.layout = layout;
    this.root.dataset.layout = layout;
    if (layout === 'wide') this.setRail(false);
    this.renderPane();
  },

  split() { return this.S.layout !== 'narrow' && this.prefs.readingPane !== 'off'; },

  setView(view) {
    this.S.view = view;
    if (this.root) this.root.dataset.view = view;
  },

  setRail(open) {
    this.S.railOpen = open;
    this.root?.classList.toggle('rail-open', open);
  },

  applyPrefs(p) {
    const prev = this.prefs;
    this.prefs = p;
    if (!this.root || !this.S) return;
    this.root.dataset.pane = p.readingPane;
    this.root.dataset.density = p.density;
    this.root.dataset.snippets = p.snippets ? '1' : '0';
    if (prev.threading !== p.threading) { this.closeReader(); void this.loadList(); }
    else { this.renderRows(); this.renderPane(); }
  },

  /* ================= folders / rail ================= */
  async loadFolders() {
    const S = this.S;
    try {
      const data = await mailApi.folders(S.accountId);
      if (this.S !== S) return;
      S.folders = data.folders || [];
      if (!S.folders.some(f => f.id === S.folderId)) S.folderId = (this.folderByRole('inbox') || S.folders[0])?.id || '';
    } catch (err) {
      if (this.S !== S) return;
      if (!S.folders.length) S.folders = this.provider === 'microsoft'
        ? [{ id: 'inbox', name: 'Inbox', role: 'inbox', unread: 0 }]
        : [{ id: 'INBOX', name: 'Inbox', role: 'inbox', unread: 0 }];
      if (!S.folderId) S.folderId = S.folders[0].id;
      if (err.code === 'reauth') S.listError = err;
    }
    S.foldersLoading = false;
    this.renderRail();
    this.renderHead();
  },

  renderRail() {
    const S = this.S, acc = this.account;
    if (!this.el?.rail) return;
    const system = S.folders.filter(f => f.system !== false && f.role !== 'label');
    const labels = S.folders.filter(f => f.role === 'label');
    const item = (f) => {
      const n = f.role === 'drafts' ? (f.total || 0) : f.unread || 0;
      return `<button type="button" class="ml-folder${f.id === S.folderId && !S.searching ? ' is-active' : ''}" data-folder="${esc(f.id)}" ${f.id === S.folderId && !S.searching ? 'aria-current="page"' : ''}>
        ${icon(ROLE_ICON[f.role] || 'label')}<span class="ml-folder-name">${esc(f.name)}</span>${n ? `<span class="ml-folder-count${f.role === 'drafts' ? ' is-muted' : ''}">${n > 999 ? '999+' : n}</span>` : ''}</button>`;
    };
    const skeleton = Array.from({ length: 6 }, () => '<div class="ml-folder ml-skel-line"></div>').join('');
    this.el.rail.innerHTML = `
      <div class="ml-rail-head">
        <button type="button" class="ml-account" data-act="account-menu" aria-haspopup="menu">
          ${avatar({ email: acc?.email, name: acc?.email }, 'is-sm')}
          <span class="ml-account-text"><strong>${esc(acc?.email || '')}</strong><small>${acc?.provider === 'microsoft' ? 'Microsoft' : 'Google'}${S.accounts.length > 1 ? ` · ${S.accounts.length} accounts` : ''}</small></span>
          ${icon('chevron', 'ml-account-chev')}
        </button>
      </div>
      <div class="ml-rail-compose"><button type="button" class="btn btn-primary ml-compose-btn" data-act="compose">${icon('compose')}Compose</button></div>
      <nav class="ml-folders" aria-label="Folders">
        ${S.foldersLoading && !S.folders.length ? skeleton : system.map(item).join('')}
        ${labels.length ? `<div class="ml-rail-label">${this.provider === 'microsoft' ? 'Folders' : 'Labels'}</div>${labels.map(item).join('')}` : ''}
      </nav>
      <div class="ml-rail-foot">
        <button type="button" class="ml-rail-link" data-act="manage">${icon('settings')}<span>Accounts &amp; preferences</span></button>
      </div>`;
  },

  selectFolder(id) {
    const S = this.S;
    S.folderId = id;
    S.q = '';
    S.searching = false;
    S.selected.clear();
    this.setRail(false);
    this.closeReader();
    this.renderRail();
    const input = this.root.querySelector('.ml-search-input');
    if (input) { input.value = ''; input.closest('.ml-search')?.classList.remove('has-value'); }
    void this.loadList();
  },

  /* ================= list ================= */
  renderHead() {
    const S = this.S;
    if (!this.el?.head) return;
    const f = this.folder;
    const selCount = S.selected.size;
    const allSelected = selCount && selCount === S.rows.length;
    const title = S.searching ? 'Search' : (f?.name || 'Inbox');
    const sub = S.searching ? `Results for “${esc(S.q)}”` : (f?.unread && !['sent', 'drafts', 'trash'].includes(f.role) ? `${f.unread.toLocaleString()} unread` : '');
    const role = f?.role;
    const existing = this.el.head.querySelector('.ml-search-input');
    const keepFocus = existing && document.activeElement === existing;
    const qValue = existing ? existing.value : S.q;
    this.el.head.innerHTML = `
      <div class="ml-list-top">
        <button type="button" class="ml-btn ml-menu-btn" data-act="open-rail" aria-label="Folders">${icon('menu')}</button>
        <div class="ml-list-titles"><h2 class="ml-list-title">${esc(title)}</h2>${sub ? `<span class="ml-list-sub">${sub}</span>` : ''}</div>
        <button type="button" class="ml-btn" data-act="refresh" aria-label="Refresh" title="Refresh">${icon('refresh')}</button>
        <button type="button" class="ml-btn ml-head-compose" data-act="compose" aria-label="Compose" title="Compose (c)">${icon('compose')}</button>
      </div>
      <form class="ml-search${qValue ? ' has-value' : ''}" role="search">
        ${icon('search', 'ml-search-icon')}
        <input class="ml-search-input" type="search" name="q" placeholder="Search mail" aria-label="Search mail" value="${esc(qValue)}" autocomplete="off" enterkeyhint="search">
        <button type="button" class="ml-search-clear" data-act="clear-search" aria-label="Clear search">${icon('x')}</button>
      </form>
      <div class="ml-toolbar${selCount ? ' has-selection' : ''}">
        <label class="ml-check" title="Select all"><input type="checkbox" data-role="select-all" ${allSelected ? 'checked' : ''} aria-label="Select all"><span></span></label>
        ${selCount ? `
          <span class="ml-sel-count">${selCount} selected</span>
          <div class="ml-bulk">
            ${this.canArchive(role) ? `<button type="button" class="ml-btn" data-bulk="archive" title="Archive (e)" aria-label="Archive">${icon('archive')}</button>` : ''}
            ${role === 'trash' ? `<button type="button" class="ml-btn" data-bulk="untrash" title="Restore" aria-label="Restore">${icon('inbox')}</button>` : `<button type="button" class="ml-btn" data-bulk="trash" title="Delete (#)" aria-label="Delete">${icon('trash')}</button>`}
            <button type="button" class="ml-btn" data-bulk="${this.selectionAllRead() ? 'unread' : 'read'}" title="${this.selectionAllRead() ? 'Mark as unread' : 'Mark as read'}" aria-label="${this.selectionAllRead() ? 'Mark as unread' : 'Mark as read'}">${icon(this.selectionAllRead() ? 'unread' : 'read')}</button>
            <button type="button" class="ml-btn" data-bulk="${this.selectionAllStarred() ? 'unstar' : 'star'}" title="Star" aria-label="Star">${starIcon(this.selectionAllStarred())}</button>
            <button type="button" class="ml-btn" data-act="move-menu" data-scope="selection" title="Move to" aria-label="Move to">${icon('move')}</button>
            ${role === 'spam' ? `<button type="button" class="ml-btn" data-bulk="notspam" title="Not spam" aria-label="Not spam">${icon('inbox')}</button>` : role !== 'trash' && role !== 'sent' && role !== 'drafts' ? `<button type="button" class="ml-btn" data-bulk="spam" title="Report spam" aria-label="Report spam">${icon('spam')}</button>` : ''}
          </div>
          <button type="button" class="ml-btn ml-sel-clear" data-act="clear-selection" aria-label="Clear selection">${icon('x')}</button>
        ` : `<span class="ml-toolbar-hint">${S.rows.length ? `${S.rows.length}${S.nextPageToken ? '+' : ''} ${S.threadList ? 'conversations' : 'messages'}` : ''}</span>`}
      </div>`;
    const all = this.el.head.querySelector('[data-role="select-all"]');
    if (all) all.indeterminate = selCount > 0 && !allSelected;
    if (keepFocus) { const i = this.el.head.querySelector('.ml-search-input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  },

  canArchive(role) { return !['archive', 'all', 'sent', 'drafts', 'trash', 'spam'].includes(role) && !this.S.searching; },
  selectionRows() { return [...this.S.selected].map(k => this.rowByKey(k)).filter(Boolean); },
  selectionAllRead() { const r = this.selectionRows(); return r.length > 0 && r.every(x => !x.unread); },
  selectionAllStarred() { const r = this.selectionRows(); return r.length > 0 && r.every(x => x.starred); },

  async loadList({ append = false, silent = false } = {}) {
    const S = this.S;
    const token = (this.listToken = (this.listToken || 0) + 1);
    const threads = this.useThreads();
    if (!append && !silent) { S.listLoading = true; S.listError = null; S.rows = []; S.nextPageToken = null; S.selected.clear(); S.cursor = -1; this.renderHead(); this.renderRows(); }
    if (append) { S.loadingMore = true; this.renderMore(); }
    try {
      const folder = S.searching ? (this.provider === 'microsoft' ? '' : 'ALL') : S.folderId;
      const data = await mailApi.messages({ accountId: S.accountId, folder, q: S.q, pageToken: append ? S.nextPageToken : '', limit: PAGE_SIZE, threads });
      if (this.S !== S || token !== this.listToken) return;
      S.threadList = threads;
      const incoming = data.messages || [];
      incoming.forEach(m => this.rememberContact(m.from));
      if (append) {
        const seen = new Set(S.rows.map(r => this.keyOf(r)));
        S.rows.push(...incoming.filter(r => !seen.has(this.keyOf(r))));
        S.nextPageToken = data.nextPageToken || null;
      } else if (silent) {
        const seen = new Map(S.rows.map(r => [this.keyOf(r), r]));
        const fresh = incoming.filter(r => !seen.has(this.keyOf(r)));
        incoming.forEach(r => { const old = seen.get(this.keyOf(r)); if (old) Object.assign(old, { unread: r.unread, starred: r.starred, snippet: r.snippet, threadCount: r.threadCount, date: r.date }); });
        S.rows.unshift(...fresh);
        if (!S.rows.length) S.nextPageToken = data.nextPageToken || null;
      } else {
        S.rows = incoming;
        S.nextPageToken = data.nextPageToken || null;
      }
      S.listError = null;
    } catch (err) {
      if (this.S !== S || token !== this.listToken) return;
      if (!silent) S.listError = err;
    } finally {
      if (this.S === S && token === this.listToken) { S.listLoading = false; S.loadingMore = false; }
    }
    if (this.S !== S || token !== this.listToken) return;
    this.renderHead();
    this.renderRows();
  },

  async refresh({ silent = false } = {}) {
    if (!this.S) return;
    if (!silent) this.root?.querySelector('[data-act="refresh"]')?.classList.add('is-spinning');
    await Promise.all([this.loadFolders(), this.loadList({ silent: true })]);
    this.root?.querySelector('[data-act="refresh"]')?.classList.remove('is-spinning');
  },

  rememberContact(a) {
    if (!a?.email || !this.S) return;
    const key = a.email.toLowerCase();
    if (!this.S.contacts.has(key) || (a.name && !this.S.contacts.get(key).name)) this.S.contacts.set(key, { name: a.name || '', email: a.email });
  },

  rowHtml(r, i) {
    const S = this.S;
    const key = this.keyOf(r);
    const role = this.folder?.role;
    const who = (role === 'sent' || role === 'drafts') && r.to?.length ? `To: ${r.to.map(displayName).join(', ')}` : displayName(r.from);
    const count = r.threadCount > 1 ? `<span class="ml-row-count">${r.threadCount}</span>` : '';
    const selected = S.selected.has(key);
    const selecting = S.selected.size > 0;
    return `
      <div class="ml-row${r.unread ? ' is-unread' : ''}${key === S.openKey ? ' is-open' : ''}${selected ? ' is-selected' : ''}${i === S.cursor ? ' is-cursor' : ''}" role="listitem" data-key="${esc(key)}" data-index="${i}">
        <button type="button" class="ml-row-lead${selecting ? ' is-selecting' : ''}" data-act="toggle-select" aria-pressed="${selected}" aria-label="${selected ? 'Deselect' : 'Select'} message">
          ${avatar(r.from)}<span class="ml-row-checkbox">${icon('check')}</span>
        </button>
        <button type="button" class="ml-row-main" data-act="open">
          <span class="ml-row-line1"><span class="ml-row-from">${esc(who)}</span>${count}<span class="ml-row-date">${esc(shortDate(r.date))}</span></span>
          <span class="ml-row-line2"><span class="ml-row-subject">${esc(r.subject || '(no subject)')}</span><span class="ml-row-sep"> — </span><span class="ml-row-snippet">${esc(r.snippet || '')}</span></span>
        </button>
        <span class="ml-row-meta">
          ${r.hasAttachments ? `<span class="ml-row-clip" title="Has attachments">${icon('clip')}</span>` : ''}
          <button type="button" class="ml-row-star${r.starred ? ' is-on' : ''}" data-act="star-row" aria-pressed="${!!r.starred}" aria-label="${r.starred ? 'Unstar' : 'Star'}">${starIcon(r.starred)}</button>
          <span class="ml-row-date ml-row-date-c">${esc(shortDate(r.date))}</span>
        </span>
        <span class="ml-row-quick" aria-hidden="false">
          ${this.canArchive(role) ? `<button type="button" class="ml-btn is-sm" data-row-act="archive" title="Archive" aria-label="Archive">${icon('archive')}</button>` : ''}
          ${role === 'trash' ? `<button type="button" class="ml-btn is-sm" data-row-act="untrash" title="Restore" aria-label="Restore">${icon('inbox')}</button>` : `<button type="button" class="ml-btn is-sm" data-row-act="trash" title="Delete" aria-label="Delete">${icon('trash')}</button>`}
          <button type="button" class="ml-btn is-sm" data-row-act="${r.unread ? 'read' : 'unread'}" title="${r.unread ? 'Mark as read' : 'Mark as unread'}" aria-label="${r.unread ? 'Mark as read' : 'Mark as unread'}">${icon(r.unread ? 'read' : 'unread')}</button>
        </span>
        ${r.unread ? '<span class="ml-row-dot" aria-label="Unread"></span>' : ''}
      </div>`;
  },

  renderRows() {
    const S = this.S;
    if (!this.el?.rows) return;
    this.io?.disconnect();
    if (S.listLoading && !S.rows.length) {
      this.el.rows.innerHTML = Array.from({ length: 9 }, (_, i) => `
        <div class="ml-row ml-row-skel" aria-hidden="true" style="--d:${i * 60}ms">
          <span class="ml-avatar ml-skel"></span>
          <span class="ml-skel-lines"><span class="ml-skel" style="width:${40 + (i * 13) % 30}%"></span><span class="ml-skel" style="width:${60 + (i * 7) % 30}%"></span><span class="ml-skel ml-skel-snip" style="width:${50 + (i * 11) % 40}%"></span></span>
        </div>`).join('');
      return;
    }
    if (S.listError && !S.rows.length) {
      const reauth = S.listError.code === 'reauth';
      this.el.rows.innerHTML = `
        <div class="ml-state">
          <span class="ml-state-icon">${icon('alert')}</span>
          <h3>${reauth ? 'Reconnect this mailbox' : 'Messages couldn’t load'}</h3>
          <p>${esc(S.listError.message)}</p>
          <button type="button" class="btn btn-secondary btn-sm" data-act="${reauth ? 'reconnect' : 'retry-list'}">${reauth ? 'Reconnect' : 'Try again'}</button>
        </div>`;
      return;
    }
    if (!S.rows.length) {
      const role = this.folder?.role;
      const empty = S.searching
        ? { t: 'No results', p: 'Nothing matches that search. Try other words or a sender’s address.' }
        : role === 'inbox' ? { t: 'You’re all caught up', p: 'New mail will appear here.' }
          : role === 'starred' ? { t: 'No starred messages', p: 'Star messages to find them quickly later.' }
            : role === 'trash' ? { t: 'Trash is empty', p: 'Deleted messages stay here for 30 days.' }
              : role === 'spam' ? { t: 'No spam', p: 'Hooray, nothing suspicious here.' }
                : { t: 'Nothing here', p: 'This folder has no messages.' };
      this.el.rows.innerHTML = `<div class="ml-state is-empty"><span class="ml-state-icon">${icon(S.searching ? 'search' : ROLE_ICON[role] || 'inbox')}</span><h3>${empty.t}</h3><p>${empty.p}</p></div>`;
      return;
    }
    this.el.rows.innerHTML = S.rows.map((r, i) => this.rowHtml(r, i)).join('') + '<div class="ml-more"></div>';
    this.renderMore();
  },

  renderMore() {
    const S = this.S;
    const host = this.el?.rows?.querySelector('.ml-more');
    if (!host) return;
    if (S.loadingMore) host.innerHTML = '<span class="ml-spinner is-sm"></span><span>Loading more…</span>';
    else if (S.nextPageToken) host.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-act="load-more">Load more</button>';
    else host.innerHTML = S.rows.length > 8 ? '<span class="ml-more-end">That’s everything</span>' : '';
    this.io?.disconnect();
    if (S.nextPageToken && !S.loadingMore) {
      this.io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting) && this.S?.nextPageToken && !this.S.loadingMore) void this.loadList({ append: true }); }, { root: this.el.rows, rootMargin: '240px' });
      this.io.observe(host);
    }
  },

  updateRow(key) {
    const S = this.S;
    const i = S.rows.findIndex(r => this.keyOf(r) === key);
    const el = this.el.rows.querySelector(`.ml-row[data-key="${CSS.escape(key)}"]`);
    if (i < 0 || !el) return;
    el.outerHTML = this.rowHtml(S.rows[i], i);
  },

  /* ================= reader ================= */
  async open(key, { focus = false } = {}) {
    const S = this.S;
    const row = this.rowByKey(key);
    if (!row) return;
    S.openKey = key;
    S.cursor = S.rows.indexOf(row);
    S.reader = null;
    S.readerError = null;
    S.readerLoading = true;
    S.expanded = new Set();
    this.setView('message');
    this.el.rows.querySelectorAll('.ml-row.is-open, .ml-row.is-cursor').forEach(el => el.classList.remove('is-open', 'is-cursor'));
    const rowEl = this.el.rows.querySelector(`.ml-row[data-key="${CSS.escape(key)}"]`);
    rowEl?.classList.add('is-open', 'is-cursor');
    rowEl?.scrollIntoView({ block: 'nearest' });
    this.renderPane();
    this.readerAbort?.abort();
    const ctrl = (this.readerAbort = new AbortController());
    try {
      const threaded = !!this.prefs.threading && row.threadId;
      const thread = threaded
        ? await mailApi.thread(S.accountId, row.threadId, ctrl.signal)
        : { id: row.id, subject: row.subject, messages: [await mailApi.message(S.accountId, row.id, ctrl.signal)] };
      if (this.S !== S || S.openKey !== key) return;
      if (!thread.messages?.length) thread.messages = [await mailApi.message(S.accountId, row.id, ctrl.signal)];
      thread.messages.forEach(m => { this.rememberContact(m.from); (m.to || []).forEach(a => this.rememberContact(a)); });
      S.reader = thread;
      const last = thread.messages[thread.messages.length - 1];
      S.expanded = new Set([last.id, ...thread.messages.filter(m => m.unread).map(m => m.id)]);
    } catch (err) {
      if (err?.name === 'AbortError' || this.S !== S || S.openKey !== key) return;
      S.readerError = err;
    }
    S.readerLoading = false;
    this.renderPane();
    if (focus) this.el.pane.querySelector('.ml-read-scroll')?.focus({ preventScroll: true });
    if (row.unread && this.prefs.markRead !== 'manual') {
      const doMark = () => { if (this.S === S && S.openKey === key && row.unread) void this.act('read', [key], { quiet: true }); };
      if (this.prefs.markRead === 'delay') setTimeout(doMark, 3000); else doMark();
    }
  },

  closeReader() {
    const S = this.S;
    if (!S) return;
    this.readerAbort?.abort();
    S.openKey = null;
    S.reader = null;
    S.readerError = null;
    S.readerLoading = false;
    this.setView('list');
    this.el?.rows?.querySelectorAll('.ml-row.is-open').forEach(el => el.classList.remove('is-open'));
    this.renderPane();
  },

  renderPane() {
    const S = this.S;
    if (!this.el?.pane || !S) return;
    this.frameCleanups?.forEach(fn => fn());
    this.frameCleanups = [];
    if (!S.openKey) {
      const f = this.folder;
      this.el.pane.innerHTML = `
        <div class="ml-state is-pane">
          <span class="ml-state-icon is-lg">${icon('mailOpen')}</span>
          <h3>${f?.unread ? `${f.unread.toLocaleString()} unread in ${esc(f.name)}` : 'No message selected'}</h3>
          <p>Choose a message to read it here.${this.prefs.shortcuts ? ' Press <kbd>c</kbd> to write a new one.' : ''}</p>
        </div>`;
      return;
    }
    const row = this.rowByKey(S.openKey);
    const role = this.folder?.role;
    const starred = S.reader ? S.reader.messages.some(m => m.starred) : row?.starred;
    const idx = S.rows.findIndex(r => this.keyOf(r) === S.openKey);
    const bar = `
      <div class="ml-read-bar">
        <button type="button" class="ml-btn ml-back" data-act="back" aria-label="Back to list">${icon('back')}</button>
        <div class="ml-read-actions">
          ${this.canArchive(role) ? `<button type="button" class="ml-btn" data-open-act="archive" title="Archive (e)" aria-label="Archive">${icon('archive')}</button>` : ''}
          ${role === 'trash' ? `<button type="button" class="ml-btn" data-open-act="untrash" title="Restore" aria-label="Restore">${icon('inbox')}</button>` : `<button type="button" class="ml-btn" data-open-act="trash" title="Delete (#)" aria-label="Delete">${icon('trash')}</button>`}
          ${role === 'spam' ? `<button type="button" class="ml-btn" data-open-act="notspam" title="Not spam" aria-label="Not spam">${icon('inbox')}</button>` : role !== 'trash' && role !== 'sent' && role !== 'drafts' ? `<button type="button" class="ml-btn ml-hide-narrow" data-open-act="spam" title="Report spam" aria-label="Report spam">${icon('spam')}</button>` : ''}
          <span class="ml-divider"></span>
          <button type="button" class="ml-btn" data-open-act="unread" title="Mark as unread" aria-label="Mark as unread">${icon('unread')}</button>
          <button type="button" class="ml-btn" data-act="move-menu" data-scope="open" title="Move to" aria-label="Move to">${icon('move')}</button>
          <button type="button" class="ml-btn${starred ? ' is-starred' : ''}" data-open-act="${starred ? 'unstar' : 'star'}" title="Star (s)" aria-label="${starred ? 'Unstar' : 'Star'}" aria-pressed="${!!starred}">${starIcon(starred)}</button>
        </div>
        <div class="ml-read-nav">
          <span class="ml-read-pos">${idx >= 0 ? `${idx + 1} of ${S.rows.length}${S.nextPageToken ? '+' : ''}` : ''}</span>
          <button type="button" class="ml-btn" data-act="prev" aria-label="Newer" title="Newer (k)" ${idx <= 0 ? 'disabled' : ''}>${icon('chevronUp')}</button>
          <button type="button" class="ml-btn" data-act="next" aria-label="Older" title="Older (j)" ${idx < 0 || idx >= S.rows.length - 1 ? 'disabled' : ''}>${icon('chevron')}</button>
        </div>
      </div>`;
    if (S.readerLoading) {
      this.el.pane.innerHTML = `${bar}<div class="ml-read-scroll"><div class="ml-read-inner">
        <h1 class="ml-read-subject">${esc(row?.subject || '(no subject)')}</h1>
        <div class="ml-msg is-open ml-msg-skel"><div class="ml-msg-head">${avatar(row?.from)}<span class="ml-skel-lines"><span class="ml-skel" style="width:40%"></span><span class="ml-skel" style="width:25%"></span></span></div>
        <div class="ml-msg-body"><span class="ml-skel-lines is-body"><span class="ml-skel" style="width:92%"></span><span class="ml-skel" style="width:86%"></span><span class="ml-skel" style="width:70%"></span><span class="ml-skel" style="width:80%"></span><span class="ml-skel" style="width:40%"></span></span></div></div>
      </div></div>`;
      return;
    }
    if (S.readerError) {
      this.el.pane.innerHTML = `${bar}<div class="ml-state is-pane"><span class="ml-state-icon">${icon('alert')}</span><h3>This message couldn’t open</h3><p>${esc(S.readerError.message)}</p><button type="button" class="btn btn-secondary btn-sm" data-act="retry-open">Try again</button></div>`;
      return;
    }
    const t = S.reader;
    if (!t) return;
    const msgs = t.messages;
    const collapsedRun = [];
    let html = '';
    msgs.forEach((m, i) => {
      const open = S.expanded.has(m.id);
      // Long threads: fold the middle into "n older messages".
      if (!open && msgs.length > 4 && i > 0 && i < msgs.length - 2 && !S.showAllInThread) { collapsedRun.push(m); if (i === msgs.length - 3) html += `<button type="button" class="ml-thread-more" data-act="expand-thread"><span>${collapsedRun.length} older message${collapsedRun.length === 1 ? '' : 's'}</span></button>`; return; }
      html += this.messageHtml(m, open);
    });
    const labels = (row?.labels || []).map(id => S.folders.find(f => f.id === id)).filter(Boolean);
    this.el.pane.innerHTML = `${bar}
      <div class="ml-read-scroll" tabindex="-1">
        <div class="ml-read-inner">
          <h1 class="ml-read-subject">${esc(t.subject || msgs[0]?.subject || '(no subject)')}${labels.map(l => `<span class="ml-chip-label">${esc(l.name)}</span>`).join('')}</h1>
          <div class="ml-thread">${html}</div>
          <div class="ml-replybar">
            <button type="button" class="btn btn-secondary btn-sm" data-act="reply">${icon('reply')}Reply</button>
            ${this.canReplyAll(msgs[msgs.length - 1]) ? `<button type="button" class="btn btn-secondary btn-sm" data-act="reply-all">${icon('replyAll')}Reply all</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" data-act="forward">${icon('forward')}Forward</button>
          </div>
        </div>
      </div>`;
    this.el.pane.querySelectorAll('.ml-msg.is-open').forEach(el => this.mountBody(el));
  },

  canReplyAll(m) {
    if (!m) return false;
    const me = (this.account?.email || '').toLowerCase();
    const all = [...(m.to || []), ...(m.cc || [])].filter(a => a.email && a.email.toLowerCase() !== me);
    return all.length > (m.from?.email?.toLowerCase() === me ? 1 : 0);
  },

  messageHtml(m, open) {
    const me = (this.account?.email || '').toLowerCase();
    const names = (list) => (list || []).map(a => (a.email?.toLowerCase() === me ? 'me' : displayName(a))).join(', ');
    const files = (m.attachments || []).filter(a => !a.embedded && !(a.inline && a.mimeType?.startsWith('image/') && a.contentId && !a.filename));
    if (!open) {
      return `<article class="ml-msg" data-mid="${esc(m.id)}">
        <button type="button" class="ml-msg-head is-collapsed" data-act="toggle-msg" aria-expanded="false">
          ${avatar(m.from)}
          <span class="ml-msg-who"><strong>${esc(displayName(m.from))}</strong><span class="ml-msg-snip">${esc(m.snippet || '')}</span></span>
          <span class="ml-msg-date">${m.hasAttachments ? icon('clip') : ''}${esc(shortDate(m.date))}</span>
        </button>
      </article>`;
    }
    return `<article class="ml-msg is-open" data-mid="${esc(m.id)}">
      <div class="ml-msg-head">
        <button type="button" class="ml-msg-toggle" data-act="toggle-msg" aria-expanded="true" aria-label="Collapse message"></button>
        ${avatar(m.from)}
        <div class="ml-msg-who">
          <div class="ml-msg-from"><strong>${esc(displayName(m.from))}</strong>${m.from?.name ? `<span class="ml-msg-addr">&lt;${esc(m.from.email)}&gt;</span>` : ''}</div>
          <div class="ml-msg-to">to ${esc(names(m.to) || 'undisclosed recipients')}${m.cc?.length ? `, cc ${esc(names(m.cc))}` : ''}</div>
        </div>
        <div class="ml-msg-side">
          <span class="ml-msg-date is-long" title="${esc(longDate(m.date))}">${esc(longDate(m.date))}</span>
          <span class="ml-msg-date is-short" title="${esc(longDate(m.date))}">${esc(shortDate(m.date))}</span>
          <button type="button" class="ml-btn is-sm" data-act="reply" data-mid="${esc(m.id)}" aria-label="Reply" title="Reply">${icon('reply')}</button>
          <button type="button" class="ml-btn is-sm" data-act="msg-menu" data-mid="${esc(m.id)}" aria-label="More" title="More">${icon('more')}</button>
        </div>
      </div>
      <div class="ml-msg-banner" hidden></div>
      <div class="ml-msg-body"></div>
      ${files.length ? `<div class="ml-atts">${files.map(a => `
        <button type="button" class="ml-att" data-act="download" data-mid="${esc(m.id)}" data-aid="${esc(a.id)}" title="Download ${esc(a.filename)}">
          <span class="ml-att-icon">${icon(a.mimeType?.startsWith('image/') ? 'image' : 'file')}</span>
          <span class="ml-att-text"><strong>${esc(a.filename)}</strong><small>${esc(fmtSize(a.size) || a.mimeType || '')}</small></span>
          <span class="ml-att-dl">${icon('download')}</span>
        </button>`).join('')}</div>` : ''}
    </article>`;
  },

  mountBody(el) {
    const m = this.S.reader?.messages.find(x => x.id === el.dataset.mid);
    if (!m) return;
    const body = el.querySelector('.ml-msg-body');
    const banner = el.querySelector('.ml-msg-banner');
    if (m.html) {
      const allow = !!this.prefs.remoteImages || this.S.imagesFor.has(m.id);
      const { srcdoc, remote } = buildFrame(m.html, allow);
      body.classList.add('is-html');
      this.frameCleanups.push(mountFrame(body, srcdoc, (e) => this.handleKey(e)));
      if (remote && !allow) {
        banner.hidden = false;
        banner.innerHTML = `${icon('image')}<span>Remote images are hidden to protect your privacy.</span><button type="button" class="ml-link" data-act="show-images" data-mid="${esc(m.id)}">Show images</button>`;
      }
    } else {
      body.innerHTML = `<div class="ml-text">${textToHtml(m.text || m.snippet || '')}</div>`;
    }
  },

  /* ================= actions ================= */
  /**
   * Runs an action on rows identified by list keys. Removal actions update
   * the list at once and offer Undo; the server call happens in the background.
   */
  async act(action, keys, { quiet = false } = {}) {
    const S = this.S;
    keys = keys.filter(Boolean);
    if (!S || !keys.length) return;
    const rows = keys.map(k => this.rowByKey(k)).filter(Boolean);
    const scope = S.threadList ? 'thread' : 'message';
    const f = this.folder;
    const removing = ['archive', 'trash', 'untrash', 'spam', 'notspam'].includes(action);
    const n = rows.length || keys.length;
    const noun = S.threadList ? (n === 1 ? 'conversation' : 'conversations') : (n === 1 ? 'message' : 'messages');

    if (!removing) {
      const field = action === 'read' || action === 'unread' ? 'unread' : 'starred';
      const value = action === 'unread' || action === 'star';
      const before = rows.map(r => r[field]);
      rows.forEach(r => { r[field] = value; });
      if (field === 'unread' && f) { f.unread = Math.max(0, (f.unread || 0) + (value ? 1 : -1) * before.filter(b => b !== value).length); }
      if (S.reader && keys.includes(S.openKey)) S.reader.messages.forEach(m => { if (field === 'starred' && !value) m.starred = false; if (field === 'unread') m.unread = value; });
      if (S.reader && keys.includes(S.openKey) && field === 'starred' && value) S.reader.messages[S.reader.messages.length - 1].starred = true;
      keys.forEach(k => this.updateRow(k));
      this.renderRail(); this.renderHead();
      if (keys.includes(S.openKey) && field === 'starred') this.renderPaneBar();
      if (action === 'unread' && keys.includes(S.openKey) && !this.split()) this.closeReader();
      try {
        await mailApi.action(S.accountId, action, keys, { scope });
        if (!quiet && keys.length > 1) this.toast(`${action === 'read' ? 'Marked as read' : action === 'unread' ? 'Marked as unread' : action === 'star' ? 'Starred' : 'Unstarred'}: ${n} ${noun}`);
      } catch (err) {
        rows.forEach((r, i) => { r[field] = before[i]; });
        keys.forEach(k => this.updateRow(k));
        this.toast(err.message, { tone: 'error' });
      }
      return;
    }

    // Removal: take rows out, keep their positions for Undo.
    const snapshot = rows.map(r => ({ row: r, index: S.rows.indexOf(r) }));
    const wasOpen = keys.includes(S.openKey);
    let nextKey = null;
    if (wasOpen) {
      const idx = S.rows.findIndex(r => this.keyOf(r) === S.openKey);
      const after = S.rows.slice(idx + 1).find(r => !keys.includes(this.keyOf(r)));
      const before = S.rows.slice(0, idx).reverse().find(r => !keys.includes(this.keyOf(r)));
      nextKey = after ? this.keyOf(after) : before ? this.keyOf(before) : null;
    }
    S.rows = S.rows.filter(r => !keys.includes(this.keyOf(r)));
    keys.forEach(k => S.selected.delete(k));
    const unreadGone = rows.filter(r => r.unread).length;
    if (f && unreadGone) f.unread = Math.max(0, (f.unread || 0) - unreadGone);
    S.cursor = S.openKey && !wasOpen ? S.rows.findIndex(r => this.keyOf(r) === S.openKey) : Math.min(S.cursor, S.rows.length - 1);
    this.renderRows(); this.renderHead(); this.renderRail();
    if (wasOpen) { if (nextKey && this.split()) void this.open(nextKey); else this.closeReader(); }

    const label = { archive: 'Archived', trash: 'Moved to Trash', untrash: 'Restored', spam: 'Reported as spam', notspam: 'Moved to Inbox' }[action];
    let results = null;
    const restore = () => {
      snapshot.sort((a, b) => a.index - b.index).forEach(({ row, index }) => S.rows.splice(Math.min(index, S.rows.length), 0, row));
      if (f && unreadGone) f.unread += unreadGone;
      this.renderRows(); this.renderHead(); this.renderRail();
    };
    const request = mailApi.action(S.accountId, action, keys, { scope }).then(d => { results = d.results; }).catch(err => { restore(); this.toast(err.message, { tone: 'error' }); throw err; });
    if (quiet) return request.catch(() => {});
    const undoable = action !== 'untrash' && action !== 'notspam';
    this.toast(`${label}: ${n} ${noun}`, undoable ? {
      action: 'Undo',
      onAction: async () => {
        try { await request; } catch { return; }
        restore();
        const ids = keys.map((k, i) => results?.[i]?.newId || k);
        // Microsoft moves give messages new ids; keep the restored rows addressable.
        if (this.provider === 'microsoft') snapshot.forEach(({ row }, i) => { if (results?.[i]?.newId) row.id = results[i].newId; });
        try {
          await mailApi.action(S.accountId, 'restore', ids, { scope, folder: f?.id, value: action });
          this.renderRows();
          this.toast('Undone');
        } catch (err) { this.toast(err.message, { tone: 'error' }); void this.loadList({ silent: true }); }
      },
    } : {});
    return request.catch(() => {});
  },

  async moveTo(keys, target) {
    const S = this.S;
    const f = this.folder;
    const t = S.folders.find(x => x.id === target);
    if (!t || !keys.length) return;
    if (this.provider === 'google' && t.role === 'label' && f?.role !== 'label') {
      // Applying a label keeps the message where it is.
      try { await mailApi.action(S.accountId, 'label', keys, { scope: S.threadList ? 'thread' : 'message', add: [t.id] }); this.toast(`Labelled “${t.name}”`); }
      catch (err) { this.toast(err.message, { tone: 'error' }); }
      return;
    }
    const rows = keys.map(k => this.rowByKey(k)).filter(Boolean);
    const snapshot = rows.map(r => ({ row: r, index: S.rows.indexOf(r) }));
    S.rows = S.rows.filter(r => !keys.includes(this.keyOf(r)));
    keys.forEach(k => S.selected.delete(k));
    if (keys.includes(S.openKey)) this.closeReader();
    this.renderRows(); this.renderHead();
    try {
      const d = await mailApi.action(S.accountId, 'move', keys, { scope: S.threadList ? 'thread' : 'message', folder: t.id, from: f?.id });
      this.toast(`Moved to ${t.name}`, {
        action: 'Undo',
        onAction: async () => {
          snapshot.sort((a, b) => a.index - b.index).forEach(({ row, index }) => S.rows.splice(Math.min(index, S.rows.length), 0, row));
          this.renderRows(); this.renderHead();
          const ids = keys.map((k, i) => d.results?.[i]?.newId || k);
          try {
            if (this.provider === 'google') await mailApi.action(S.accountId, 'label', ids, { scope: S.threadList ? 'thread' : 'message', add: f?.id && f.id !== 'ALL' ? [f.id] : [], remove: t.id !== 'ALL' ? [t.id] : [] });
            else { await mailApi.action(S.accountId, 'restore', ids, { folder: f?.id }); snapshot.forEach(({ row }, i) => { if (d.results?.[i]?.newId) row.id = d.results[i].newId; }); }
          } catch (err) { this.toast(err.message, { tone: 'error' }); }
        },
      });
    } catch (err) {
      snapshot.forEach(({ row, index }) => S.rows.splice(index, 0, row));
      this.renderRows(); this.renderHead();
      this.toast(err.message, { tone: 'error' });
    }
  },

  renderPaneBar() {
    // Re-render only the bar (keeps iframes mounted).
    const bar = this.el.pane.querySelector('.ml-read-bar');
    if (!bar || !this.S.reader) return;
    const starred = this.S.reader.messages.some(m => m.starred);
    const btn = bar.querySelector('[data-open-act="star"], [data-open-act="unstar"]');
    if (btn) { btn.dataset.openAct = starred ? 'unstar' : 'star'; btn.innerHTML = starIcon(starred); btn.classList.toggle('is-starred', starred); btn.setAttribute('aria-pressed', String(starred)); }
  },

  async download(mid, aid) {
    const m = this.S.reader?.messages.find(x => x.id === mid);
    const att = m?.attachments.find(a => a.id === aid);
    if (!att) return;
    const t = this.toast(`Downloading ${att.filename}…`, { duration: 60000 });
    try {
      const blob = await mailApi.attachment(this.S.accountId, mid, att);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = att.filename || 'attachment';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      t.dismiss();
    } catch (err) { t.dismiss(); this.toast(err.message, { tone: 'error' }); }
  },

  /* ================= events ================= */
  onClick(e) {
    const S = this.S;
    if (!S) return;
    const t = e.target.closest('[data-act], [data-folder], [data-bulk], [data-row-act], [data-open-act]');
    if (!t || !this.root.contains(t)) return;
    const rowEl = t.closest('.ml-row');
    const key = rowEl?.dataset.key;

    if (t.dataset.folder) { this.selectFolder(t.dataset.folder); return; }
    if (t.dataset.bulk) { const keys = [...S.selected]; void this.act(t.dataset.bulk, keys); if (!['archive', 'trash', 'untrash', 'spam', 'notspam'].includes(t.dataset.bulk)) { this.renderHead(); } return; }
    if (t.dataset.rowAct) { e.stopPropagation(); void this.act(t.dataset.rowAct, [key]); return; }
    if (t.dataset.openAct) { void this.act(t.dataset.openAct, [S.openKey]); return; }

    switch (t.dataset.act) {
      case 'open':
        if (S.selected.size && !(e.metaKey || e.ctrlKey)) { this.toggleSelect(key); return; }
        if (e.metaKey || e.ctrlKey) { this.toggleSelect(key); return; }
        if (e.shiftKey && S.cursor >= 0) { this.selectRange(S.cursor, Number(rowEl.dataset.index)); return; }
        void this.open(key); return;
      case 'toggle-select': this.toggleSelect(key, e.shiftKey); return;
      case 'star-row': { const r = this.rowByKey(key); void this.act(r?.starred ? 'unstar' : 'star', [key]); return; }
      case 'clear-selection': S.selected.clear(); this.renderRows(); this.renderHead(); return;
      case 'open-rail': this.setRail(true); return;
      case 'close-rail': this.setRail(false); return;
      case 'refresh': void this.refresh(); return;
      case 'retry-list': void this.loadList(); return;
      case 'reconnect': void this.reconnect(); return;
      case 'load-more': void this.loadList({ append: true }); return;
      case 'clear-search': this.clearSearch(); return;
      case 'back': this.closeReader(); return;
      case 'prev': this.step(-1, true); return;
      case 'next': this.step(1, true); return;
      case 'retry-open': if (S.openKey) void this.open(S.openKey); return;
      case 'compose': this.openCompose({ mode: 'new' }); return;
      case 'reply': this.startReply(this.prefs.replyAll ? 'replyAll' : 'reply', t.dataset.mid); return;
      case 'reply-all': this.startReply('replyAll', t.dataset.mid); return;
      case 'forward': this.startReply('forward', t.dataset.mid); return;
      case 'toggle-msg': {
        const mid = t.closest('.ml-msg')?.dataset.mid;
        if (!mid) return;
        if (S.expanded.has(mid)) S.expanded.delete(mid); else S.expanded.add(mid);
        this.renderPane(); return;
      }
      case 'expand-thread': S.showAllInThread = true; S.reader?.messages.forEach(m => S.expanded.add(m.id)); this.renderPane(); S.showAllInThread = false; return;
      case 'show-images': S.imagesFor.add(t.dataset.mid); this.renderPane(); return;
      case 'download': void this.download(t.dataset.mid, t.dataset.aid); return;
      case 'account-menu': this.accountMenu(t); return;
      case 'move-menu': this.moveMenu(t, t.dataset.scope === 'selection' ? [...S.selected] : [S.openKey]); return;
      case 'msg-menu': this.messageMenu(t, t.dataset.mid); return;
      case 'manage': openSettings('mail'); return;
      default:
    }
  },

  onChange(e) {
    if (e.target.matches('[data-role="select-all"]')) {
      const S = this.S;
      if (e.target.checked) S.rows.forEach(r => S.selected.add(this.keyOf(r))); else S.selected.clear();
      this.renderRows(); this.renderHead();
    }
  },

  onSubmit(e) {
    if (!e.target.matches('.ml-search')) return;
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (!q) { this.clearSearch(); return; }
    const S = this.S;
    S.q = q; S.searching = true;
    this.closeReader();
    this.renderRail();
    e.target.q.blur();
    void this.loadList();
  },

  clearSearch() {
    const S = this.S;
    const input = this.root.querySelector('.ml-search-input');
    if (input) { input.value = ''; input.closest('.ml-search').classList.remove('has-value'); }
    if (!S.searching) return;
    S.q = ''; S.searching = false;
    this.closeReader();
    this.renderRail();
    void this.loadList();
  },

  toggleSelect(key, range = false) {
    const S = this.S;
    if (range && S.lastSelected != null) {
      const a = S.rows.findIndex(r => this.keyOf(r) === S.lastSelected), b = S.rows.findIndex(r => this.keyOf(r) === key);
      if (a >= 0 && b >= 0) { this.selectRange(a, b); return; }
    }
    if (S.selected.has(key)) S.selected.delete(key); else S.selected.add(key);
    S.lastSelected = key;
    this.renderRows(); this.renderHead();
  },

  selectRange(a, b) {
    const S = this.S;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    for (let i = lo; i <= hi; i++) S.selected.add(this.keyOf(S.rows[i]));
    this.renderRows(); this.renderHead();
  },

  step(dir, openIt = false) {
    const S = this.S;
    if (!S.rows.length) return;
    const from = S.openKey ? S.rows.findIndex(r => this.keyOf(r) === S.openKey) : S.cursor;
    const next = Math.max(0, Math.min(S.rows.length - 1, (from < 0 ? (dir > 0 ? -1 : 0) : from) + dir));
    if (openIt || S.openKey) { void this.open(this.keyOf(S.rows[next])); return; }
    S.cursor = next;
    this.el.rows.querySelectorAll('.ml-row.is-cursor').forEach(el => el.classList.remove('is-cursor'));
    const el = this.el.rows.querySelector(`.ml-row[data-index="${next}"]`);
    el?.classList.add('is-cursor');
    el?.scrollIntoView({ block: 'nearest' });
    if (next >= S.rows.length - 3 && S.nextPageToken && !S.loadingMore) void this.loadList({ append: true });
  },

  handleKey(e) {
    const S = this.S;
    if (!S || !this.root?.isConnected || e.defaultPrevented) return;
    const target = e.target;
    const typing = target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (e.key === 'Escape') {
      // Mail runs in the capture phase so it can keep Escape from leaving the tool
      // whenever there is something inside Mail to close first.
      const consume = () => { e.preventDefault(); e.stopPropagation(); };
      if (this.menu) { this.closeMenu(); consume(); return; }
      if (S.compose?.el.querySelector('.ml-suggest:not([hidden])')) return;
      if (typing) {
        if (target.matches('.ml-search-input')) { if (target.value || S.searching) this.clearSearch(); target.blur(); consume(); }
        else if (S.compose && target.closest('.ml-compose')) { this.minimizeCompose(true); target.blur(); consume(); }
        return;
      }
      if (S.compose && !S.compose.minimized) { this.minimizeCompose(true); consume(); return; }
      if (S.railOpen) { this.setRail(false); consume(); return; }
      if (S.selected.size) { S.selected.clear(); this.renderRows(); this.renderHead(); consume(); return; }
      if (S.openKey) { this.closeReader(); consume(); return; }
      if (S.searching) { this.clearSearch(); consume(); return; }
      return;
    }
    if (!this.prefs.shortcuts) return;
    if (typing || e.metaKey || e.ctrlKey || e.altKey || target.closest?.('.ml-menu, .ml-compose')) return;
    // Leave keys alone while another part of the app shows a modal.
    const modalOpen = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], .modal-overlay.open, .settings-modal.open')]
      .some(m => !this.root.contains(m) && m.getClientRects().length > 0 && getComputedStyle(m).visibility !== 'hidden');
    if (modalOpen) return;
    const key = e.key;
    const cur = S.openKey || (S.cursor >= 0 ? this.keyOf(S.rows[S.cursor] || {}) : null);
    const targets = S.selected.size ? [...S.selected] : (cur ? [cur] : []);
    const role = this.folder?.role;
    const handled = () => e.preventDefault();
    if (key === 'c') { handled(); this.openCompose({ mode: 'new' }); }
    else if (key === 'j' || key === 'ArrowDown' && !S.openKey) { handled(); this.step(1, !!S.openKey); }
    else if (key === 'k' || key === 'ArrowUp' && !S.openKey) { handled(); this.step(-1, !!S.openKey); }
    else if ((key === 'o' || (key === 'Enter' && !target.closest?.('button, a'))) && !S.openKey && S.cursor >= 0) { handled(); void this.open(this.keyOf(S.rows[S.cursor])); }
    else if (key === 'u' && S.openKey) { handled(); this.closeReader(); }
    else if (key === 'x' && cur && !S.openKey) { handled(); this.toggleSelect(cur); }
    else if (key === 'e' && targets.length && this.canArchive(role)) { handled(); void this.act('archive', targets); }
    else if (key === '#' && targets.length) { handled(); void this.act(role === 'trash' ? 'untrash' : 'trash', targets); }
    else if (key === 's' && targets.length) { handled(); const r = this.rowByKey(targets[0]); void this.act(r?.starred ? 'unstar' : 'star', targets); }
    else if (key === 'r' && S.reader) { handled(); this.startReply(this.prefs.replyAll ? 'replyAll' : 'reply'); }
    else if (key === 'a' && S.reader) { handled(); this.startReply('replyAll'); }
    else if (key === 'f' && S.reader) { handled(); this.startReply('forward'); }
    else if (key === 'I' && targets.length) { handled(); void this.act('read', targets); }
    else if (key === 'U' && targets.length) { handled(); void this.act('unread', targets); }
  },

  async reconnect() {
    try { await connectMailbox(this.provider); } catch (err) { if (!err.cancelled) this.toast(err.message, { tone: 'error' }); }
  },

  /* ================= menus ================= */
  openMenu(anchor, items, onPick, { align = 'end' } = {}) {
    this.closeMenu();
    const menu = document.createElement('div');
    menu.className = 'ml-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((it, i) => it.sep ? '<div class="ml-menu-sep" role="separator"></div>'
      : it.heading ? `<div class="ml-menu-heading">${esc(it.heading)}</div>`
        : `<button type="button" role="menuitem" class="ml-menu-item${it.danger ? ' is-danger' : ''}${it.checked ? ' is-checked' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>
          ${it.avatar || (it.icon ? icon(it.icon) : '<span class="ml-i"></span>')}<span class="ml-menu-text">${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span>${it.checked ? icon('check', 'ml-menu-check') : ''}</button>`).join('');
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = align === 'start' ? r.left : r.right - mw;
    left = Math.max(8, Math.min(left, vw - mw - 8));
    let top = r.bottom + 6;
    if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.maxHeight = `${vh - 16}px`;
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const it = items[Number(b.dataset.i)];
      this.closeMenu();
      onPick(it);
    });
    const outside = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) this.closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    const onScroll = (e) => { if (!menu.contains(e.target)) this.closeMenu(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    this.menu = { el: menu, off: () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); } };
    menu.querySelector('.ml-menu-item:not([disabled])')?.focus({ preventScroll: true });
    menu.addEventListener('keydown', (e) => {
      const list = [...menu.querySelectorAll('.ml-menu-item:not([disabled])')];
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeMenu(); anchor.focus(); }
    });
  },

  closeMenu() {
    if (!this.menu) return;
    this.menu.off();
    this.menu.el.remove();
    this.menu = null;
  },

  accountMenu(anchor) {
    const S = this.S;
    const items = [
      { heading: 'Mailboxes' },
      ...S.accounts.map(a => ({ label: a.email, hint: a.provider === 'microsoft' ? 'Microsoft' : 'Google', avatar: avatar({ email: a.email }, 'is-xs'), checked: a.id === S.accountId, id: a.id })),
      { sep: true },
      { label: 'Add Google account', icon: 'plus', add: 'google' },
      { label: 'Add Microsoft account', icon: 'plus', add: 'microsoft' },
      { sep: true },
      { label: 'Manage accounts', icon: 'settings', manage: true },
    ];
    this.openMenu(anchor, items, (it) => {
      if (it.id && it.id !== S.accountId) this.switchAccount(it.id);
      else if (it.add) connectMailbox(it.add).catch(err => { if (!err.cancelled) this.toast(err.message, { tone: 'error' }); });
      else if (it.manage) openSettings('mail');
    }, { align: 'start' });
  },

  switchAccount(id) {
    if (this.S?.compose?.dirty) this.saveDraft();
    mailApi.activeAccountId = id;
    void this.boot();
  },

  moveMenu(anchor, keys) {
    const S = this.S;
    keys = keys.filter(Boolean);
    if (!keys.length) return;
    const skip = new Set(['starred', 'important', 'drafts', 'sent', 'all']);
    const folders = S.folders.filter(f => f.id !== S.folderId && !skip.has(f.role) && f.id !== 'flagged');
    const items = [{ heading: this.provider === 'google' ? 'Move to' : 'Move to folder' }, ...folders.filter(f => f.role !== 'label').map(f => ({ label: f.name, icon: ROLE_ICON[f.role], folder: f.id }))];
    const labels = folders.filter(f => f.role === 'label');
    if (labels.length) items.push({ sep: true }, { heading: this.provider === 'google' ? 'Label as' : 'Folders' }, ...labels.map(f => ({ label: f.name, icon: 'label', folder: f.id })));
    this.openMenu(anchor, items, (it) => { if (it.folder) void this.moveTo(keys, it.folder); });
  },

  messageMenu(anchor, mid) {
    const m = this.S.reader?.messages.find(x => x.id === mid);
    if (!m) return;
    const items = [
      { label: 'Reply', icon: 'reply', run: () => this.startReply('reply', mid) },
      ...(this.canReplyAll(m) ? [{ label: 'Reply all', icon: 'replyAll', run: () => this.startReply('replyAll', mid) }] : []),
      { label: 'Forward', icon: 'forward', run: () => this.startReply('forward', mid) },
      { sep: true },
      ...(m.html && !this.prefs.remoteImages && !this.S.imagesFor.has(mid) ? [{ label: 'Show images', icon: 'image', run: () => { this.S.imagesFor.add(mid); this.renderPane(); } }] : []),
      { label: 'Copy sender address', icon: 'mailOpen', run: () => navigator.clipboard?.writeText(m.from?.email || '').then(() => this.toast('Address copied')) },
    ];
    this.openMenu(anchor, items, (it) => it.run?.());
  },

  /* ================= toasts ================= */
  toast(text, { tone = 'info', action = '', onAction = null, duration } = {}) {
    const host = this.el?.toasts;
    if (!host) return { dismiss() {} };
    const el = document.createElement('div');
    el.className = `ml-toast${tone === 'error' ? ' is-error' : ''}`;
    el.innerHTML = `<span class="ml-toast-text"></span>${action ? `<button type="button" class="ml-toast-action">${esc(action)}</button>` : ''}<button type="button" class="ml-toast-close" aria-label="Dismiss">${icon('x')}</button>`;
    el.querySelector('.ml-toast-text').textContent = text;
    while (host.children.length >= 3) host.firstElementChild.remove();
    host.appendChild(el);
    let timer = null;
    const dismiss = () => { clearTimeout(timer); el.classList.add('is-leaving'); setTimeout(() => el.remove(), 180); };
    timer = setTimeout(dismiss, duration ?? (action ? 7000 : tone === 'error' ? 6000 : 3500));
    el.querySelector('.ml-toast-close').addEventListener('click', dismiss);
    el.querySelector('.ml-toast-action')?.addEventListener('click', () => { dismiss(); onAction?.(); });
    return { dismiss, el };
  },

  /* ================= compose ================= */
  startReply(mode, mid) {
    const S = this.S;
    const msgs = S.reader?.messages || [];
    const m = (mid && msgs.find(x => x.id === mid)) || msgs[msgs.length - 1];
    if (!m) return;
    const me = (this.account?.email || '').toLowerCase();
    const notMe = (a) => a?.email && a.email.toLowerCase() !== me;
    let to = [], cc = [];
    if (mode !== 'forward') {
      const fromMe = m.from?.email?.toLowerCase() === me;
      to = fromMe ? (m.to || []).slice() : (m.replyTo?.length ? m.replyTo : [m.from]).filter(Boolean);
      if (mode === 'replyAll') {
        const seen = new Set(to.map(a => a.email.toLowerCase()));
        cc = [...(fromMe ? [] : m.to || []), ...(m.cc || [])].filter(a => notMe(a) && !seen.has(a.email.toLowerCase()) && seen.add(a.email.toLowerCase()));
      }
    }
    const quoted = m.html ? sanitizeDoc(m.html).body.innerHTML : plainToHtml(m.text || m.snippet || '');
    const quoteHtml = mode === 'forward'
      ? `<div class="tb-fwd"><br>---------- Forwarded message ---------<br>From: ${esc(displayName(m.from))} &lt;${esc(m.from?.email || '')}&gt;<br>Date: ${esc(longDate(m.date))}<br>Subject: ${esc(m.subject || '')}<br>To: ${esc((m.to || []).map(a => a.email).join(', '))}<br>${m.cc?.length ? `Cc: ${esc(m.cc.map(a => a.email).join(', '))}<br>` : ''}<br>${quoted}</div>`
      : `<div class="tb-quote"><div>On ${esc(longDate(m.date))}, ${esc(displayName(m.from))} &lt;${esc(m.from?.email || '')}&gt; wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${quoted}</blockquote></div>`;
    const refs = [m.references, m.messageId].filter(Boolean).join(' ').trim();
    const forwardAtts = mode === 'forward' ? (m.attachments || []).filter(a => !a.embedded).map(a => ({ filename: a.filename, mimeType: a.mimeType, size: a.size, ref: { messageId: m.id, attachmentId: a.id } })) : [];
    this.openCompose({
      mode, to, cc,
      subject: subjectPrefix(mode === 'forward' ? 'Fwd:' : 'Re:', m.subject),
      quoteHtml,
      reply: { inReplyTo: mode === 'forward' ? '' : m.messageId, references: mode === 'forward' ? '' : refs, threadId: mode === 'forward' ? '' : m.threadId, replyToId: m.id },
      attachments: forwardAtts,
    });
  },

  openCompose(init = {}) {
    const S = this.S;
    if (!S) return;
    if (S.compose) {
      if (S.compose.dirty && init.mode !== 'restore') {
        this.minimizeCompose(false);
        this.toast('Finish or discard the open draft first.');
        S.compose.el.querySelector('[data-field="to"] input')?.focus();
        return;
      }
      this.closeCompose();
    }
    const c = S.compose = {
      mode: init.mode === 'restore' ? (init.origMode || 'new') : init.mode || 'new',
      to: init.to || [], cc: init.cc || [], bcc: init.bcc || [],
      subject: init.subject || '', bodyHtml: init.bodyHtml || '', quoteHtml: init.quoteHtml || '',
      reply: init.reply || null, attachments: init.attachments || [],
      showCc: !!(init.cc?.length || init.bcc?.length), minimized: !!init.minimized, maximized: false, dirty: !!init.dirty, sending: false,
    };
    const title = { new: 'New message', reply: 'Reply', replyAll: 'Reply all', forward: 'Forward' }[c.mode] || 'New message';
    const el = document.createElement('div');
    el.className = 'ml-compose';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <div class="ml-compose-head" data-cact="toggle-min">
        <strong class="ml-compose-title">${esc(c.subject || title)}</strong>
        <div class="ml-compose-headbtns">
          <button type="button" class="ml-btn is-sm" data-cact="minimize" aria-label="Minimise" title="Minimise">${icon('minimize')}</button>
          <button type="button" class="ml-btn is-sm ml-hide-narrow" data-cact="maximize" aria-label="Expand" title="Expand">${icon('expand')}</button>
          <button type="button" class="ml-btn is-sm" data-cact="close" aria-label="Save and close" title="Save and close">${icon('x')}</button>
        </div>
      </div>
      <div class="ml-compose-body">
        <div class="ml-field ml-from"><span class="ml-field-label">From</span><span class="ml-from-value">${esc(this.account?.email || '')}</span></div>
        <div class="ml-field" data-field="to"><span class="ml-field-label">To</span><div class="ml-chips"></div><button type="button" class="ml-field-toggle" data-cact="show-cc" ${c.showCc ? 'hidden' : ''}>Cc Bcc</button></div>
        <div class="ml-field" data-field="cc" ${c.showCc ? '' : 'hidden'}><span class="ml-field-label">Cc</span><div class="ml-chips"></div></div>
        <div class="ml-field" data-field="bcc" ${c.showCc ? '' : 'hidden'}><span class="ml-field-label">Bcc</span><div class="ml-chips"></div></div>
        <div class="ml-field"><input class="ml-subject" type="text" placeholder="Subject" aria-label="Subject" value="${esc(c.subject)}"></div>
        <div class="ml-editor-wrap">
          <div class="ml-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Message body" data-placeholder="Write your message"></div>
          ${c.quoteHtml ? `<button type="button" class="ml-quote-toggle" data-cact="toggle-quote" aria-expanded="false" title="Show quoted text">${icon('more')}</button><div class="ml-quote-preview" hidden></div>` : ''}
          <div class="ml-compose-atts"></div>
        </div>
      </div>
      <div class="ml-compose-foot">
        <button type="button" class="btn btn-primary ml-send" data-cact="send">Send</button>
        <div class="ml-format">
          <button type="button" class="ml-btn is-sm" data-fmt="bold" aria-label="Bold" title="Bold">${icon('bold')}</button>
          <button type="button" class="ml-btn is-sm" data-fmt="italic" aria-label="Italic" title="Italic">${icon('italic')}</button>
          <button type="button" class="ml-btn is-sm" data-fmt="underline" aria-label="Underline" title="Underline">${icon('underline')}</button>
          <button type="button" class="ml-btn is-sm" data-fmt="insertUnorderedList" aria-label="Bulleted list" title="Bulleted list">${icon('list')}</button>
          <button type="button" class="ml-btn is-sm" data-fmt="createLink" aria-label="Insert link" title="Insert link">${icon('link')}</button>
        </div>
        <span class="ml-compose-spacer"></span>
        <label class="ml-btn" title="Attach files" aria-label="Attach files">${icon('clip')}<input type="file" multiple hidden data-role="files"></label>
        <button type="button" class="ml-btn" data-cact="discard" aria-label="Discard draft" title="Discard draft">${icon('trash')}</button>
      </div>`;
    c.el = el;
    this.el.composeHost.replaceChildren(el);
    const editor = el.querySelector('.ml-editor');
    editor.innerHTML = c.bodyHtml || '';
    for (const f of ['to', 'cc', 'bcc']) this.mountChips(el.querySelector(`[data-field="${f}"] .ml-chips`), f);
    this.renderComposeAtts();
    this.bindCompose(el);
    this.applyComposeState();
    if (!c.minimized) {
      requestAnimationFrame(() => {
        if (c.mode === 'new' && !c.to.length) el.querySelector('[data-field="to"] input')?.focus();
        else { editor.focus(); const sel = window.getSelection(); sel.selectAllChildren(editor); sel.collapseToStart(); }
      });
    }
  },

  applyComposeState() {
    const c = this.S?.compose;
    if (!c) return;
    c.el.classList.toggle('is-min', c.minimized);
    c.el.classList.toggle('is-max', c.maximized);
    this.root.classList.toggle('has-compose', !c.minimized);
    const max = c.el.querySelector('[data-cact="maximize"]');
    if (max) max.innerHTML = icon(c.maximized ? 'collapse' : 'expand');
  },

  minimizeCompose(min = true) {
    const c = this.S?.compose;
    if (!c) return;
    c.minimized = min;
    if (min) c.maximized = false;
    this.applyComposeState();
    if (min) this.saveDraft();
  },

  closeCompose() {
    const c = this.S?.compose;
    if (!c) return;
    c.el.remove();
    this.S.compose = null;
    this.root?.classList.remove('has-compose');
  },

  mountChips(host, field) {
    const c = this.S.compose;
    host.innerHTML = '<input type="text" inputmode="email" autocomplete="off" spellcheck="false" aria-label="' + field + '"><div class="ml-suggest" hidden role="listbox"></div>';
    const input = host.querySelector('input');
    const suggest = host.querySelector('.ml-suggest');
    let active = -1, options = [];
    const render = () => {
      host.querySelectorAll('.ml-chip').forEach(n => n.remove());
      c[field].forEach((a, i) => {
        const chip = document.createElement('span');
        const ok = EMAIL_RE.test(a.email);
        chip.className = `ml-chip${ok ? '' : ' is-invalid'}`;
        chip.title = a.email;
        chip.innerHTML = `<span>${esc(a.name || a.email)}</span><button type="button" aria-label="Remove ${esc(a.email)}">${icon('x')}</button>`;
        chip.querySelector('button').addEventListener('click', () => { c[field].splice(i, 1); c.dirty = true; render(); input.focus(); });
        host.insertBefore(chip, input);
      });
    };
    const parse = (text) => String(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(.*)<([^>]+)>$/);
      return m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { name: '', email: s };
    });
    const commit = () => {
      const v = input.value.trim();
      if (!v) return false;
      c[field].push(...parse(v));
      input.value = '';
      c.dirty = true;
      hide(); render();
      return true;
    };
    const hide = () => { suggest.hidden = true; active = -1; };
    const showSuggest = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hide(); return; }
      const taken = new Set(c[field].map(a => a.email.toLowerCase()));
      options = [...this.S.contacts.values()].filter(a => !taken.has(a.email.toLowerCase()) && (a.email.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))).slice(0, 6);
      if (!options.length) { hide(); return; }
      suggest.innerHTML = options.map((a, i) => `<button type="button" role="option" class="ml-suggest-item${i === active ? ' is-active' : ''}" data-i="${i}">${avatar(a, 'is-xs')}<span><strong>${esc(a.name || a.email)}</strong>${a.name ? `<small>${esc(a.email)}</small>` : ''}</span></button>`).join('');
      suggest.hidden = false;
    };
    suggest.addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      e.preventDefault();
      c[field].push(options[Number(b.dataset.i)]);
      input.value = ''; c.dirty = true; hide(); render(); input.focus();
    });
    input.addEventListener('input', () => { active = -1; if (/[,;]\s*$/.test(input.value)) commit(); else showSuggest(); });
    input.addEventListener('keydown', (e) => {
      if (!suggest.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; showSuggest(); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && !suggest.hidden && active >= 0) { e.preventDefault(); c[field].push(options[active]); input.value = ''; c.dirty = true; hide(); render(); return; }
      if (e.key === 'Enter' || (e.key === 'Tab' && input.value.trim())) { if (commit()) e.preventDefault(); else if (e.key === 'Enter') e.preventDefault(); }
      else if (e.key === 'Backspace' && !input.value && c[field].length) { c[field].pop(); c.dirty = true; render(); }
      else if (e.key === 'Escape' && !suggest.hidden) { e.stopPropagation(); e.preventDefault(); hide(); }
    });
    input.addEventListener('blur', () => { setTimeout(() => { commit(); hide(); }, 120); });
    input.addEventListener('paste', (e) => { const t = e.clipboardData?.getData('text'); if (t && /[,;\n]/.test(t)) { e.preventDefault(); input.value = t; commit(); } });
    host.addEventListener('click', (e) => { if (e.target === host) input.focus(); });
    render();
  },

  renderComposeAtts() {
    const c = this.S.compose;
    const host = c.el.querySelector('.ml-compose-atts');
    host.innerHTML = c.attachments.map((a, i) => `
      <span class="ml-att is-compose">
        <span class="ml-att-icon">${icon(a.mimeType?.startsWith('image/') ? 'image' : 'file')}</span>
        <span class="ml-att-text"><strong>${esc(a.filename)}</strong><small>${a.loading ? 'Reading…' : esc(fmtSize(a.size))}</small></span>
        <button type="button" class="ml-att-remove" data-remove="${i}" aria-label="Remove ${esc(a.filename)}">${icon('x')}</button>
      </span>`).join('');
  },

  addFiles(files) {
    const c = this.S?.compose;
    if (!c) return;
    const limit = this.provider === 'microsoft' ? 3 * 1024 * 1024 : MAX_ATTACH_BYTES;
    let total = c.attachments.reduce((n, a) => n + (a.size || 0), 0);
    for (const file of files) {
      if (this.provider === 'microsoft' ? file.size > limit : total + file.size > limit) {
        this.toast(this.provider === 'microsoft' ? `${file.name} is over 3 MB, the limit for Microsoft accounts here.` : `${file.name} would take the message over 24 MB.`, { tone: 'error' });
        continue;
      }
      total += file.size;
      const att = { filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, loading: true };
      c.attachments.push(att);
      c.dirty = true;
      const reader = new FileReader();
      reader.onload = () => { att.data = String(reader.result).split(',')[1] || ''; att.loading = false; if (this.S?.compose === c) this.renderComposeAtts(); };
      reader.onerror = () => { c.attachments.splice(c.attachments.indexOf(att), 1); if (this.S?.compose === c) this.renderComposeAtts(); this.toast(`Couldn’t read ${file.name}.`, { tone: 'error' }); };
      reader.readAsDataURL(file);
    }
    this.renderComposeAtts();
  },

  bindCompose(el) {
    const c = this.S.compose;
    const editor = el.querySelector('.ml-editor');
    const subject = el.querySelector('.ml-subject');
    const titleEl = el.querySelector('.ml-compose-title');
    let saveTimer = null;
    const touched = () => { c.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(() => this.saveDraft(), 800); };
    editor.addEventListener('input', touched);
    subject.addEventListener('input', () => { c.subject = subject.value; titleEl.textContent = subject.value || 'New message'; touched(); });
    editor.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text == null) return;
      e.preventDefault();
      document.execCommand('insertText', false, text);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void this.sendCompose(); }
      if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && e.target === editor) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
    });
    el.addEventListener('change', (e) => { if (e.target.matches('[data-role="files"]')) { this.addFiles([...e.target.files]); e.target.value = ''; } });
    el.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); el.classList.add('is-drop'); } });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('is-drop'); });
    el.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); el.classList.remove('is-drop'); this.addFiles([...e.dataTransfer.files]); } });
    el.addEventListener('mousedown', (e) => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
    el.addEventListener('click', (e) => {
      const fmt = e.target.closest('[data-fmt]');
      if (fmt) {
        editor.focus();
        if (fmt.dataset.fmt === 'createLink') {
          const url = window.prompt('Link address', 'https://');
          if (url && /^(https?:|mailto:)/i.test(url.trim())) document.execCommand('createLink', false, url.trim());
        } else document.execCommand(fmt.dataset.fmt);
        touched();
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { c.attachments.splice(Number(rm.dataset.remove), 1); this.renderComposeAtts(); touched(); return; }
      const b = e.target.closest('[data-cact]');
      if (!b) return;
      const act = b.dataset.cact;
      if (act === 'toggle-min') { if (e.target.closest('button')) return; if (c.minimized) this.minimizeCompose(false); return; }
      e.stopPropagation();
      if (act === 'minimize') this.minimizeCompose(!c.minimized);
      else if (act === 'maximize') { c.maximized = !c.maximized; c.minimized = false; this.applyComposeState(); }
      else if (act === 'close') { this.saveDraft(); const had = c.dirty; this.closeCompose(); if (had) this.toast('Draft saved on this device', { action: 'Open', onAction: () => this.restoreDraft(true) }); }
      else if (act === 'discard') this.discardCompose();
      else if (act === 'send') void this.sendCompose();
      else if (act === 'show-cc') { c.showCc = true; el.querySelectorAll('[data-field="cc"], [data-field="bcc"]').forEach(n => { n.hidden = false; }); b.hidden = true; el.querySelector('[data-field="cc"] input')?.focus(); }
      else if (act === 'toggle-quote') {
        const prev = el.querySelector('.ml-quote-preview');
        const open = prev.hidden;
        prev.hidden = !open;
        b.setAttribute('aria-expanded', String(open));
        if (open && !prev.firstChild) mountFrame(prev, buildFrame(c.quoteHtml, !!this.prefs.remoteImages).srcdoc);
      }
    });
  },

  collectCompose() {
    const c = this.S.compose;
    const el = c.el;
    for (const f of ['to', 'cc', 'bcc']) {
      const input = el.querySelector(`[data-field="${f}"] input`);
      if (input?.value.trim()) { c[f].push(...input.value.split(/[,;]+/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(.*)<([^>]+)>$/); return m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: s }; })); input.value = ''; }
    }
    c.subject = el.querySelector('.ml-subject').value;
    c.bodyHtml = el.querySelector('.ml-editor').innerHTML;
    return c;
  },

  async sendCompose() {
    const S = this.S;
    const c = S?.compose;
    if (!c || c.sending) return;
    this.collectCompose();
    const all = [...c.to, ...c.cc, ...c.bcc];
    if (!all.length) { this.toast('Add at least one recipient.', { tone: 'error' }); c.el.querySelector('[data-field="to"] input')?.focus(); return; }
    const bad = all.find(a => !EMAIL_RE.test(a.email));
    if (bad) { this.toast(`“${bad.email}” doesn’t look like an email address.`, { tone: 'error' }); return; }
    if (c.attachments.some(a => a.loading)) { this.toast('Attachments are still loading.'); return; }
    const bodyEmpty = !c.el.querySelector('.ml-editor').textContent.trim() && !c.el.querySelector('.ml-editor img');
    if (!c.subject.trim() && bodyEmpty && !c.quoteHtml && !window.confirm('Send this message without a subject or text?')) return;
    const html = `<div>${c.bodyHtml || ''}</div>${c.quoteHtml ? `<br>${c.quoteHtml}` : ''}`;
    const payload = {
      to: c.to, cc: c.cc, bcc: c.bcc,
      subject: c.subject.trim(),
      html,
      mode: c.mode,
      ...(c.reply ? { inReplyTo: c.reply.inReplyTo, references: c.reply.references, threadId: c.reply.threadId, replyToId: c.reply.replyToId } : {}),
      attachments: c.attachments.map(a => (a.ref ? { filename: a.filename, mimeType: a.mimeType, messageId: a.ref.messageId, attachmentId: a.ref.attachmentId } : { filename: a.filename, mimeType: a.mimeType, data: a.data })),
    };
    const snapshot = { mode: 'restore', origMode: c.mode, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject, bodyHtml: c.bodyHtml, quoteHtml: c.quoteHtml, reply: c.reply, attachments: c.attachments, dirty: true };
    this.closeCompose();
    this.clearDraft();
    const job = { payload, snapshot, accountId: S.accountId, timer: null };
    const delay = Math.max(0, Number(this.prefs.undoSend) || 0) * 1000;
    if (!delay) { void this.deliver(job); return; }
    this.pendingSends.push(job);
    const t = this.toast('Sending…', {
      action: 'Undo', duration: delay,
      onAction: () => {
        clearTimeout(job.timer);
        this.pendingSends = this.pendingSends.filter(j => j !== job);
        this.openCompose(snapshot);
        this.toast('Sending undone');
      },
    });
    job.timer = setTimeout(() => { t.dismiss(); this.pendingSends = this.pendingSends.filter(j => j !== job); void this.deliver(job); }, delay);
  },

  async deliver(job, { quiet = false } = {}) {
    try {
      await mailApi.send(job.accountId, job.payload);
      if (quiet || !this.S) return;
      this.toast('Message sent');
      const role = this.folder?.role;
      if (role === 'sent') void this.loadList({ silent: true });
      if (this.S.openKey && job.payload.threadId && this.S.reader?.id === job.payload.threadId) void this.open(this.S.openKey);
    } catch (err) {
      if (quiet || !this.S) return;
      this.toast(`Not sent: ${err.message}`, { tone: 'error', duration: 9000 });
      if (!this.S.compose) this.openCompose(job.snapshot);
    }
  },

  discardCompose() {
    const c = this.S?.compose;
    if (!c) return;
    this.collectCompose();
    const snapshot = { mode: 'restore', origMode: c.mode, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject, bodyHtml: c.bodyHtml, quoteHtml: c.quoteHtml, reply: c.reply, attachments: c.attachments, dirty: true };
    const wasDirty = c.dirty;
    this.closeCompose();
    this.clearDraft();
    if (wasDirty) this.toast('Draft discarded', { action: 'Undo', onAction: () => this.openCompose(snapshot) });
  },

  draftKey() { return `${DRAFT_KEY}:${this.S?.accountId || ''}`; },

  saveDraft() {
    const c = this.S?.compose;
    if (!c || !c.dirty) return;
    try {
      this.collectCompose();
      localStorage.setItem(this.draftKey(), JSON.stringify({ mode: c.mode, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject, bodyHtml: c.bodyHtml, quoteHtml: c.quoteHtml, reply: c.reply, attachments: c.attachments.filter(a => a.ref), savedAt: Date.now() }));
    } catch { /* storage full or blocked */ }
  },

  clearDraft() { try { localStorage.removeItem(this.draftKey()); } catch { /* blocked */ } },

  restoreDraft(open = false) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.draftKey()) || 'null'); } catch { d = null; }
    if (!d || this.S?.compose) return;
    this.openCompose({ ...d, mode: 'restore', origMode: d.mode, minimized: !open, dirty: true });
  },
};
