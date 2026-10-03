import { tbAlert } from './dialog.js';
/* ============================================================
   TOOLBOX — Settings

   One window, two layouts:
   - wide screens: a sidebar (your profile, search, grouped pages
     with a sliding indicator) beside the open page;
   - phones: the page list, and each page pushed in from the right
     (back slides it away), like the system Settings app.

   Search looks through every setting on every page, not just page
   names, and jumps to the row it found. Changes save as they are
   made; a small "Saved" tick confirms it.

   Pages: profile (and the avatar gallery), appearance, general
   (preferences, backup), notifications, tools (per-tool settings),
   assistant, mail, support.
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser, updateUserProfile, persistUserProfile, claimUsername, getUsernameChangeStatus, signOut, MADSELKIE_EMAILS } from './supabase.js';
import { getSettings, updateSettings, exportSettings, importSettings } from './settings.js';
import { PROFILE_PICTURES, getProfilePictureSrc, getUserAvatarHtml, warmProfilePictures } from './profile-pictures.js';
import { personaChoices as PERSONA_CHOICES } from './assistant/personas.js';
import { openAccountModal } from '../views/account-modal.js';
import { NotificationEngine, prepareNotificationSound } from './notifications.js';
import { renderContributionSettings } from './flutterwave-contribution.js';
import { paintSupporterProfile } from './supporter.js';
import { renderToolPreferences } from './tool-settings-ui.js';
import { animateSettingsPanel } from './settings-motion.js';
import { TOOLS } from '../registry/tools.js';
import { search as searchTools } from './search.js';
import { MAX_SHORTCUTS, isCustomShortcuts, editableShortcutIds, setShortcutIds } from './home-shortcuts.js';

let modalEl = null;
let isOpen = false;
let closeTimer = 0;
let currentPage = null;
let savedTimer = 0;
let cancelPanelMotion = () => {};
const LAST_PAGE = 'toolbox_settings_page';
const NARROW = '(max-width: 760px)';

const ICONS = {
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  appearance: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>',
  general: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  assistant: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  support: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
};
const icon = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const PAGES = [
  { id: 'profile', title: 'Profile', hint: 'Your name, @username and avatar', group: 'Account' },
  { id: 'appearance', title: 'Appearance', hint: 'Light, dark or match your device', group: 'Personalise' },
  { id: 'general', title: 'General', hint: 'Units, editor, feedback and backups', group: 'Personalise' },
  { id: 'notifications', title: 'Notifications', hint: 'Alerts, sounds and badges', group: 'Personalise' },
  { id: 'tools', title: 'Tools', hint: 'Chess, Device Comparisons, Notes and more', group: 'Apps' },
  { id: 'assistant', title: 'Assistant', hint: 'Usage, sync and what it remembers', group: 'Apps' },
  { id: 'mail', title: 'Mail', hint: 'Connected Gmail and Microsoft accounts', group: 'Apps' },
  { id: 'support', title: 'Support Toolbox', hint: 'Help fund independent development', group: 'Toolbox' },
];
const PAGE_BY_ID = new Map(PAGES.map(p => [p.id, p]));
const ORDER = PAGES.map(p => p.id);

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- markup helpers ---------------- */

/** A setting row: copy on the left, its control on the right. */
function row({ title, hint = '', control = '', forId = '', tag = 'label', cls = '' }) {
  const attrs = tag === 'label' && forId ? ` for="${forId}"` : '';
  return `<${tag} class="stg-row${cls ? ` ${cls}` : ''}"${attrs}>
    <span class="stg-row-copy"><span class="stg-row-title">${title}</span>${hint ? `<span class="stg-row-hint">${hint}</span>` : ''}</span>
    ${control ? `<span class="stg-row-control">${control}</span>` : ''}
  </${tag}>`;
}
const switchInput = (id, on) => `<input type="checkbox" class="switch stg-switch" id="${id}" ${on ? 'checked' : ''}>`;
const section = (title, hint, body, extra = '') => `<section class="stg-section"${extra}>${title ? `<header class="stg-section-head"><h3 class="stg-section-title">${title}</h3>${hint ? `<p class="stg-section-hint">${hint}</p>` : ''}</header>` : ''}${body}</section>`;

/* ---------------- shell ---------------- */

const media = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false });
function isNarrow() { return media(NARROW).matches; }
const reducedMotion = () => media('(prefers-reduced-motion: reduce)').matches;

function renderMe() {
  const me = modalEl?.querySelector('.stg-me');
  if (!me) return;
  const user = getCurrentUser();
  const s = getSettings();
  if (!user) {
    me.innerHTML = `<span class="stg-me-avatar">${getUserAvatarHtml('default', 40)}</span>
      <span class="stg-me-copy"><strong>Sign in</strong><small>Sync settings, chats and your @username</small></span>
      <span class="stg-me-chev">${icon('chevron', 16)}</span>`;
    return;
  }
  const pic = user.profilePicture || user.user_metadata?.profile_picture || s.profilePicture || 'default';
  const isOwner = MADSELKIE_EMAILS.includes((user.email || '').toLowerCase().trim());
  const name = user.displayName || user.user_metadata?.display_name || s.displayName || user.email?.split('@')[0] || 'You';
  const handle = isOwner ? 'madselkie' : (user.username || user.user_metadata?.username || s.username || '');
  me.innerHTML = `<span class="stg-me-avatar" data-supporter-account>${getUserAvatarHtml({ ...user, profilePicture: pic }, 40)}</span>
    <span class="stg-me-copy"><strong>${escapeHtml(name)}</strong><small>${handle ? `@${escapeHtml(handle)}` : escapeHtml(user.email || '')}</small></span>
    <span class="stg-me-chev">${icon('chevron', 16)}</span>`;
}

function createModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.id = 'settings-modal';
  modalEl.className = 'settings-modal-backdrop stg-backdrop';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'stg-title');
  modalEl.style.display = 'none';

  const groups = [...new Set(PAGES.map(p => p.group))];
  modalEl.innerHTML = `
    <div class="stg" data-view="home">
      <aside class="stg-nav" aria-label="Settings sections">
        <div class="stg-nav-top">
          <div class="stg-brand"><span class="stg-brand-mark">${icon('gear', 17)}</span><strong>Settings</strong>
            <button type="button" class="stg-icon-btn stg-close-narrow" data-stg="close" aria-label="Close settings">${icon('close', 18)}</button></div>
          <button type="button" class="stg-me" data-page="profile" aria-label="Your profile"></button>
          <label class="stg-search">${icon('search', 16)}<input type="search" id="settings-search-input" placeholder="Search settings" autocomplete="off" spellcheck="false" aria-label="Search settings" aria-controls="stg-results"><kbd>/</kbd></label>
        </div>
        <div class="stg-nav-scroll">
          <div class="stg-results" id="stg-results" role="listbox" aria-label="Matching settings" hidden></div>
          <nav class="stg-groups">
            <span class="stg-link-ind" aria-hidden="true"></span>
            ${groups.map(g => `<div class="stg-navgroup"><p class="stg-navgroup-label">${g}</p>
              ${PAGES.filter(p => p.group === g).map((p, i) => `<button type="button" class="stg-link" data-page="${p.id}" style="--i:${i}">
                <span class="stg-link-icon stg-ic-${p.id}">${icon(p.id, 17)}</span>
                <span class="stg-link-copy"><span class="stg-link-title">${p.title}</span><span class="stg-link-hint">${p.hint}</span></span>
                <span class="stg-link-chev">${icon('chevron', 16)}</span></button>`).join('')}</div>`).join('')}
          </nav>
        </div>
        <p class="stg-nav-foot">Changes save as you make them. <a href="#about" class="stg-about" data-stg="close">About Toolbox</a></p>
      </aside>

      <section class="stg-main" aria-live="off">
        <header class="stg-head">
          <button type="button" class="stg-icon-btn stg-back" data-stg="back" aria-label="Back">${icon('back', 20)}</button>
          <div class="stg-head-copy"><h2 id="stg-title">Settings</h2><p id="stg-sub"></p></div>
          <span class="stg-saved" role="status" aria-live="polite"><span>${icon('check', 14)}</span>Saved</span>
          <button type="button" class="stg-icon-btn stg-close" data-stg="close" aria-label="Close settings" title="Close (Esc)">${icon('close', 18)}</button>
        </header>
        <div class="stg-scroll" id="settings-modal-scroll">
          <div class="stg-page" data-settings-panel="profile" hidden><div id="profile-settings-container"></div></div>
          <div class="stg-page" data-settings-panel="avatars" hidden><div class="stg-avatar-intro"><p>Pick the avatar shown on your messages, files and Spaces. It changes everywhere straight away.</p></div><div class="settings-avatar-grid-gallery" id="settings-avatar-gallery"></div></div>
          <div class="stg-page" data-settings-panel="appearance" hidden>
            ${section('Theme', 'Follow your device, or keep Toolbox light or dark.', '<div class="theme-choice stg-themes" id="theme-grid-standard" role="radiogroup" aria-label="Theme"></div>')}
          </div>
          <div class="stg-page" data-settings-panel="general" hidden>
            <div id="preferences-settings-container"></div>
            <div id="storage-settings-container"></div>
          </div>
          <div class="stg-page" data-settings-panel="notifications" hidden><div id="notifications-settings-container"></div></div>
          <div class="stg-page" data-settings-panel="tools" hidden>
            <p class="stg-lede">Each tool reads its settings from here. Changes apply straight away, even to a tool that is open.</p>
            <div id="tool-settings-container"></div>
          </div>
          <div class="stg-page" data-settings-panel="assistant" hidden><div id="ai-settings-container"></div><div id="ai-memory-container" class="stg-memory"></div></div>
          <div class="stg-page" data-settings-panel="mail" hidden>${section('', '', '<div id="mail-settings-container"></div>')}</div>
          <div class="stg-page" data-settings-panel="support" hidden><div id="contribution-settings-container" class="stg-support"></div></div>
        </div>
      </section>
    </div>`;
  document.body.appendChild(modalEl);

  const win = modalEl.querySelector('.stg');
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) { closeSettings(); return; }
    const act = e.target.closest('[data-stg]')?.dataset.stg;
    if (act === 'close') { closeSettings(); return; }
    if (act === 'back') { goBack(); return; }
    const link = e.target.closest('[data-page]');
    if (link && win.contains(link)) { showPage(link.dataset.page); return; }
    const hit = e.target.closest('[data-hit]');
    if (hit) { openHit(Number(hit.dataset.hit)); }
  });

  // "Saved" tick for settings that apply on change (text fields have their own Save buttons).
  modalEl.querySelector('.stg-scroll').addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('input[type="text"], input[type="search"], input[type="file"], input:not([type])')) return;
    flashSaved();
  });

  const input = modalEl.querySelector('#settings-search-input');
  input.addEventListener('input', () => runSearch(input.value));
  input.addEventListener('keydown', (e) => {
    const items = [...modalEl.querySelectorAll('.stg-hit')];
    const cur = items.findIndex(x => x.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, cur + 1) : Math.max(0, cur - 1);
      items.forEach((x, i) => x.classList.toggle('is-active', i === next));
      items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items[Math.max(0, cur)];
      if (target) openHit(Number(target.dataset.hit));
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault(); e.stopPropagation();
      input.value = ''; runSearch('');
    }
  });

  // Arrow keys move between pages in the sidebar.
  modalEl.querySelector('.stg-groups').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...modalEl.querySelectorAll('.stg-link')];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length];
    next.focus();
    if (!isNarrow()) showPage(next.dataset.page);
  });

  media(NARROW).addEventListener?.('change', () => { if (isOpen) syncLayout(); });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => placeIndicator(false)).observe(modalEl.querySelector('.stg-groups'));
  return modalEl;
}

function syncLayout() {
  const win = modalEl.querySelector('.stg');
  if (isNarrow()) win.dataset.view = currentPage ? 'page' : 'home';
  else { win.dataset.view = 'page'; if (!currentPage) showPage(sessionPage() || 'profile', { instant: true }); }
  placeIndicator(false);
}

function sessionPage() { try { return sessionStorage.getItem(LAST_PAGE); } catch { return null; } }

function placeIndicator(animate = true) {
  const ind = modalEl?.querySelector('.stg-link-ind');
  const active = modalEl?.querySelector('.stg-link.is-active');
  if (!ind) return;
  if (!active || isNarrow()) { ind.style.opacity = '0'; return; }
  const nav = modalEl.querySelector('.stg-groups');
  const top = active.getBoundingClientRect().top - nav.getBoundingClientRect().top;
  if (!animate) ind.style.transition = 'none';
  ind.style.opacity = '1';
  ind.style.height = `${active.offsetHeight}px`;
  ind.style.transform = `translateY(${top}px)`;
  if (!animate) { void ind.offsetWidth; ind.style.transition = ''; }
}

/** Opens a page. Pages slide in from the side they sit on in the list (phones: from the right). */
function showPage(id, { instant = false } = {}) {
  if (id === 'avatars') { showAvatarView(); return; }
  const page = PAGE_BY_ID.get(id);
  if (!page) return;
  const win = modalEl.querySelector('.stg');
  delete win.dataset.sub;
  const prev = currentPage;
  const dir = prev && prev !== 'avatars' ? Math.sign(ORDER.indexOf(id) - ORDER.indexOf(prev)) : 0;
  currentPage = id;
  try { sessionStorage.setItem(LAST_PAGE, id); } catch { /* ignore */ }
  modalEl.querySelectorAll('.stg-link').forEach(l => {
    const on = l.dataset.page === id;
    l.classList.toggle('is-active', on);
    if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
  });
  modalEl.querySelector('.stg-me')?.classList.toggle('is-active', id === 'profile');
  setHeading(page.title, page.hint);
  swapPanel(id, instant ? 0 : dir, { instant });
  if (isNarrow()) win.dataset.view = 'page';
  placeIndicator(!instant);
}

function swapPanel(id, dir, { instant = false } = {}) {
  const scroll = modalEl.querySelector('.stg-scroll');
  const previous = modalEl.querySelector('[data-settings-panel]:not([hidden])');
  if (previous?.dataset.settingsPanel === id) return;
  cancelPanelMotion();
  let active = null;
  modalEl.querySelectorAll('[data-settings-panel]').forEach(panel => {
    const on = panel.dataset.settingsPanel === id;
    panel.hidden = !on;
    if (on) active = panel;
  });
  scroll.scrollTop = 0;
  if (!instant) cancelPanelMotion = animateSettingsPanel(active, dir, { reduced: reducedMotion(), narrow: isNarrow() });
}

function setHeading(title, sub) {
  modalEl.querySelector('#stg-title').textContent = title;
  modalEl.querySelector('#stg-sub').textContent = sub || '';
}

function goBack() {
  if (window.__returnToAccount) {
    closeSettings();
    window.__returnToAccount = false;
    openAccountModal();
    return;
  }
  if (currentPage === 'avatars') { showPage('profile'); return; }
  if (isNarrow()) {
    modalEl.querySelector('.stg').dataset.view = 'home';
    currentPage = null;
    modalEl.querySelectorAll('.stg-link').forEach(l => l.classList.remove('is-active'));
  }
}

function flashSaved() {
  const el = modalEl?.querySelector('.stg-saved');
  if (!el) return;
  el.classList.remove('is-on');
  void el.offsetWidth;
  el.classList.add('is-on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('is-on'), 1700);
}

/* ---------------- search across every setting ---------------- */

let searchIndex = [];

function buildIndex() {
  searchIndex = [];
  const add = (page, el, title, sub = '') => { if (title && el) searchIndex.push({ page, el, title: title.trim().replace(/\s+/g, ' '), sub: sub.trim().replace(/\s+/g, ' ') }); };
  for (const p of PAGES) add(p.id, modalEl.querySelector(`.stg-link[data-page="${p.id}"]`), p.title, p.hint);
  modalEl.querySelectorAll('[data-settings-panel]').forEach(panel => {
    const page = panel.dataset.settingsPanel;
    if (page === 'avatars') return;
    panel.querySelectorAll('.stg-row').forEach(r => add(page, r, r.querySelector('.stg-row-title')?.textContent || '', r.querySelector('.stg-row-hint')?.textContent || ''));
    panel.querySelectorAll('.tp-row').forEach(r => add(page, r, r.querySelector('.tp-label')?.textContent || '', `${r.closest('.tp-card')?.querySelector('.tp-card-title strong')?.textContent || ''} · ${r.querySelector('.tp-help')?.textContent || ''}`));
    panel.querySelectorAll('.tp-card').forEach(c => add(page, c, c.querySelector('.tp-card-title strong')?.textContent || '', 'Tool settings'));
    panel.querySelectorAll('.theme-option').forEach(o => add(page, o, `${o.querySelector('.theme-option-name')?.textContent || ''} theme`, o.querySelector('.theme-option-desc')?.textContent || ''));
    panel.querySelectorAll('.stg-section-title, .settings-section-title').forEach(h => add(page, h.closest('.stg-section, section') || h, h.textContent, ''));
  });
}

function runSearch(raw) {
  const q = raw.trim().toLowerCase();
  const results = modalEl.querySelector('.stg-results');
  const groups = modalEl.querySelector('.stg-groups');
  if (!q) { results.hidden = true; results.innerHTML = ''; groups.hidden = false; placeIndicator(false); return; }
  if (!searchIndex.length) buildIndex();
  const words = q.split(/\s+/);
  const scored = searchIndex.map((e, i) => {
    const t = e.title.toLowerCase(), s = e.sub.toLowerCase();
    if (!words.every(w => t.includes(w) || s.includes(w))) return null;
    return { i, e, score: (t.startsWith(q) ? 3 : 0) + (t.includes(q) ? 2 : 0) + words.filter(w => t.includes(w)).length };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const seen = new Set();
  const top = scored.filter(({ e }) => { const k = `${e.page}|${e.title}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 9);
  const hi = (text) => escapeHtml(text).replace(new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<mark>$1</mark>');
  results.innerHTML = top.length
    ? top.map(({ i, e }, n) => `<button type="button" class="stg-hit${n === 0 ? ' is-active' : ''}" role="option" data-hit="${i}" style="--i:${n}">
        <span class="stg-hit-icon stg-ic-${e.page}">${icon(e.page, 15)}</span>
        <span class="stg-hit-copy"><span class="stg-hit-title">${hi(e.title)}</span><span class="stg-hit-sub">${escapeHtml(PAGE_BY_ID.get(e.page)?.title || '')}${e.sub ? ` · ${hi(e.sub.slice(0, 70))}` : ''}</span></span></button>`).join('')
    : `<p class="stg-noresults">Nothing matches “${escapeHtml(raw.trim())}”.</p>`;
  results.hidden = false;
  groups.hidden = true;
}

function openHit(i) {
  const hit = searchIndex[i];
  if (!hit) return;
  const input = modalEl.querySelector('#settings-search-input');
  input.value = '';
  runSearch('');
  showPage(hit.page);
  if (hit.el.classList.contains('stg-link')) return;
  requestAnimationFrame(() => {
    hit.el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    hit.el.classList.remove('stg-flash');
    void hit.el.offsetWidth;
    hit.el.classList.add('stg-flash');
    const ctl = hit.el.querySelector('input, select, button');
    setTimeout(() => ctl?.focus({ preventScroll: true }), 420);
  });
}

/* ---------------- views used by other modules ---------------- */

export function showMainView() {
  if (!modalEl) return;
  renderProfileSettings();
  renderMe();
  if (isNarrow()) goHome(); else showPage(currentPage && currentPage !== 'avatars' ? currentPage : 'profile');
}

function goHome() {
  currentPage = null;
  modalEl.querySelector('.stg').dataset.view = 'home';
  modalEl.querySelectorAll('.stg-link').forEach(l => l.classList.remove('is-active'));
}

export function showAvatarView() {
  if (!modalEl) return;
  const prev = currentPage;
  currentPage = 'avatars';
  modalEl.querySelectorAll('.stg-link').forEach(l => l.classList.toggle('is-active', l.dataset.page === 'profile'));
  setHeading('Choose your avatar', 'Shown across your tools, files and Spaces');
  modalEl.querySelector('.stg').dataset.view = 'page';
  modalEl.querySelector('.stg').dataset.sub = 'avatars';
  renderAvatarGallery();
  swapPanel('avatars', prev ? 1 : 0);
  placeIndicator();
}

function renderAvatarGallery() {
  if (!modalEl) return;
  const gallery = modalEl.querySelector('#settings-avatar-gallery');
  if (!gallery) return;
  const user = getCurrentUser();
  const settings = getSettings();
  const activePicId = user?.profilePicture || user?.user_metadata?.profile_picture || settings.profilePicture || 'default';

  gallery.innerHTML = PROFILE_PICTURES.map((pic, i) => {
    const isSelected = pic.id === activePicId;
    const src = getProfilePictureSrc(pic.id);
    return `
      <button type="button" class="avatar-story-card stg-avatar${isSelected ? ' is-active' : ''}" data-avatar-id="${escapeHtml(pic.id)}" aria-pressed="${isSelected}" style="--i:${Math.min(i, 14)}">
        <span class="avatar-story-header">
          <span class="avatar-story-avatar-wrap">${src ? `<img src="${src}" alt="" width="48" height="48" decoding="async" fetchpriority="${i < 8 ? 'high' : 'auto'}">` : icon('profile', 26)}</span>
          <span><span class="avatar-story-name">${escapeHtml(pic.name)}</span>${isSelected ? '<span class="avatar-story-badge">Current</span>' : ''}</span>
        </span>
        <span class="avatar-story-bio">${escapeHtml(pic.story || 'A profile avatar for Toolbox.')}</span>
      </button>`;
  }).join('');

  gallery.querySelectorAll('.avatar-story-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.avatarId;
      if (!id || card.classList.contains('is-active')) return;
      card.classList.add('is-saving');
      try {
        await persistUserProfile({ profilePicture: id, avatarUrl: getProfilePictureSrc(id) });
        updateSettings({ profilePicture: id });
        renderAvatarGallery();
        renderMe();
        renderProfileSettings();
        flashSaved();
      } catch (error) {
        card.classList.remove('is-saving');
        await tbAlert(error.message, 'Avatar not saved');
      }
    });
  });
}

/* ---------------- pages ---------------- */

function renderProfileSettings() {
  const container = modalEl.querySelector('#profile-settings-container');
  if (!container) return;
  const user = getCurrentUser();
  const settings = getSettings();

  if (!user) {
    container.innerHTML = `
      <div class="stg-hero">
        <span class="stg-hero-avatar">${getUserAvatarHtml('default', 64)}</span>
        <h3>Make Toolbox yours</h3>
        <p>Sign in to claim a unique @username, pick an avatar and keep your settings, chats and files in sync across devices.</p>
        <button type="button" class="btn btn-primary" id="btn-settings-signin">Sign in or create an account</button>
      </div>`;
    container.querySelector('#btn-settings-signin')?.addEventListener('click', () => { closeSettings(); openAccountModal(); });
    return;
  }

  const activePicId = user.profilePicture || user.user_metadata?.profile_picture || settings.profilePicture || 'default';
  const currentDisplayName = user.displayName || user.user_metadata?.display_name || settings.displayName || '';
  const isOwner = MADSELKIE_EMAILS.includes((user.email || '').toLowerCase().trim());
  const currentUsername = isOwner ? 'madselkie' : (user.username || user.user_metadata?.username || settings.username || '');
  const status = getUsernameChangeStatus();
  const locked = isOwner || (!status.canChange && status.reason === 'cooldown');
  const avatarName = PROFILE_PICTURES.find(p => p.id === activePicId)?.name || 'Minimal Silhouette';

  container.innerHTML = `
    <div class="stg-identity">
      <button type="button" class="stg-identity-avatar" id="btn-settings-change-avatar" aria-label="Change avatar" data-supporter-account>
        ${getUserAvatarHtml({ ...user, profilePicture: activePicId }, 76)}
        <span class="stg-identity-edit">Change</span>
      </button>
      <div class="stg-identity-copy">
        <h3>${escapeHtml(currentDisplayName || user.email?.split('@')[0] || 'You')}</h3>
        <p>${currentUsername ? `@${escapeHtml(currentUsername)}` : 'No @username yet'}${isOwner ? ' <span class="stg-badge">Verified owner</span>' : ''}</p>
        <p class="stg-dim">${escapeHtml(user.email || '')}</p>
      </div>
    </div>

    ${section('Identity', 'How you appear in Spaces, Messages and shared files.', `
      <div class="stg-card">
        <div class="stg-row stg-row-field">
          <span class="stg-row-copy"><label class="stg-row-title" for="settings-profile-display-name">Display name</label><span class="stg-row-hint" id="settings-name-msg">Any name you like.</span></span>
          <span class="stg-field-line">
            <input type="text" id="settings-profile-display-name" class="stg-input" placeholder="e.g. Meyiwa" value="${escapeHtml(currentDisplayName)}" maxlength="60">
            <button type="button" class="stg-btn" id="btn-settings-save-name">Save</button>
          </span>
        </div>
        <div class="stg-row stg-row-field">
          <span class="stg-row-copy"><label class="stg-row-title" for="settings-profile-username">Username</label>
            <span class="stg-row-hint" id="settings-username-msg">${isOwner ? 'Permanently bound to your verified accounts.' : (locked ? escapeHtml(status.message) : 'Unique across Toolbox. You can change it once a week.')}</span></span>
          <span class="stg-field-line">
            <span class="stg-input-at"><span>@</span><input type="text" id="settings-profile-username" class="stg-input" placeholder="username" value="${escapeHtml(currentUsername)}" ${locked ? 'readonly' : ''} autocapitalize="off" spellcheck="false" maxlength="30"></span>
            ${isOwner ? '' : `<button type="button" class="stg-btn" id="btn-settings-save-username" ${locked ? 'disabled' : ''}>Set</button>`}
          </span>
        </div>
        <button type="button" class="stg-row stg-row-link" data-open-avatars>
          <span class="stg-row-copy"><span class="stg-row-title">Avatar</span><span class="stg-row-hint">${escapeHtml(avatarName)}</span></span>
          <span class="stg-row-control stg-row-avatar">${getUserAvatarHtml(activePicId, 30)}${icon('chevron', 16)}</span>
        </button>
      </div>`)}

    ${section('', '', `<div class="stg-card"><button type="button" class="stg-row stg-row-link stg-row-danger" id="btn-settings-signout">
      <span class="stg-row-copy"><span class="stg-row-title">Sign out</span><span class="stg-row-hint">Signed in as ${escapeHtml(user.email || '')}</span></span>
      <span class="stg-row-control">${icon('logout', 17)}</span></button></div>`)}`;

  const nameInput = container.querySelector('#settings-profile-display-name');
  const nameMsg = container.querySelector('#settings-name-msg');
  const saveName = () => {
    const val = nameInput.value.trim();
    updateUserProfile({ displayName: val });
    updateSettings({ displayName: val });
    nameMsg.textContent = 'Saved.';
    nameMsg.dataset.tone = 'ok';
    flashSaved();
    renderMe();
    setTimeout(() => { nameMsg.textContent = 'Any name you like.'; delete nameMsg.dataset.tone; }, 2400);
  };
  container.querySelector('#btn-settings-save-name')?.addEventListener('click', saveName);
  nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });

  container.querySelector('#btn-settings-signout')?.addEventListener('click', () => { signOut(); renderProfileSettings(); renderMe(); });
  container.querySelector('#btn-settings-change-avatar')?.addEventListener('click', showAvatarView);
  container.querySelector('[data-open-avatars]')?.addEventListener('click', showAvatarView);

  if (!isOwner) {
    const usernameInput = container.querySelector('#settings-profile-username');
    const usernameMsg = container.querySelector('#settings-username-msg');
    const saveUsername = () => {
      const res = claimUsername(usernameInput.value.trim().replace(/^@/, ''));
      if (res.success) {
        usernameMsg.textContent = `You're @${res.user.username}. You can change it again in a week.`;
        usernameMsg.dataset.tone = 'ok';
        flashSaved();
        setTimeout(() => { renderProfileSettings(); renderMe(); }, 1200);
      } else {
        usernameMsg.textContent = res.error || 'That username is taken.';
        usernameMsg.dataset.tone = 'error';
      }
    };
    container.querySelector('#btn-settings-save-username')?.addEventListener('click', saveUsername);
    usernameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveUsername(); } });
  }
}

function renderPreferencesSettings() {
  const container = modalEl.querySelector('#preferences-settings-container');
  if (!container) return;
  const s = getSettings();
  const fs = s.editorFontSize || 13;
  container.innerHTML = `
    ${section('Units', '', `<div class="stg-card">
      ${row({ title: 'Measurement system', hint: 'Used by calculators, converters and engineering tools', forId: 'pref-opt-units', control: `
        <span class="stg-seg" role="radiogroup" aria-label="Measurement system">
          <input type="radio" name="pref-units" id="pref-units-metric" value="metric" ${s.unitSystem !== 'imperial' ? 'checked' : ''}><label for="pref-units-metric">Metric</label>
          <input type="radio" name="pref-units" id="pref-units-imperial" value="imperial" ${s.unitSystem === 'imperial' ? 'checked' : ''}><label for="pref-units-imperial">Imperial</label>
        </span>`, tag: 'div' })}
    </div>`)}
    ${section('Editing', '', `<div class="stg-card">
      ${row({ title: 'Auto-save', hint: 'Save file edits and scratchpad changes in this browser as you type', forId: 'pref-opt-autosave', control: switchInput('pref-opt-autosave', s.autoSave !== false) })}
      ${row({ title: 'Wrap long lines', hint: 'Soft-wrap code and markdown in the Code Playground', forId: 'pref-opt-wrap', control: switchInput('pref-opt-wrap', !!s.editorWrap) })}
      ${row({ title: 'Code font size', hint: 'Editor and terminal text', forId: 'pref-opt-fontsize', control: `
        <select class="stg-select" id="pref-opt-fontsize">
          ${[[12, 'Compact · 12'], [13, 'Default · 13'], [14, 'Medium · 14'], [16, 'Large · 16']].map(([v, l]) => `<option value="${v}" ${fs === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>` })}
    </div>`)}
    ${section('Feedback', '', `<div class="stg-card">
      ${row({ title: 'Haptics', hint: 'A light vibration on phones when you tap controls and switch views', forId: 'pref-opt-audio', control: switchInput('pref-opt-audio', s.hapticAudio !== false) })}
    </div>`)}
    ${section('Home shortcuts', `The tools under the search on Home. Pick up to ${MAX_SHORTCUTS}, in your order.`, '<div class="stg-card stg-shortcuts" id="stg-home-shortcuts"></div>', ' id="stg-shortcuts-section"')}`;
  renderShortcutEditor(container.querySelector('#stg-home-shortcuts'));

  container.querySelector('#pref-opt-autosave')?.addEventListener('change', (e) => updateSettings({ autoSave: e.target.checked }));
  container.querySelectorAll('input[name="pref-units"]').forEach(r => r.addEventListener('change', (e) => { if (e.target.checked) updateSettings({ unitSystem: e.target.value }); }));
  container.querySelector('#pref-opt-wrap')?.addEventListener('change', (e) => updateSettings({ editorWrap: e.target.checked }));
  container.querySelector('#pref-opt-fontsize')?.addEventListener('change', (e) => updateSettings({ editorFontSize: parseInt(e.target.value, 10) }));
  container.querySelector('#pref-opt-audio')?.addEventListener('change', (e) => updateSettings({ hapticAudio: e.target.checked }));
}

/** Home shortcuts: the chosen tools in order (move, remove), a finder to add more, and a way back to automatic. */
function renderShortcutEditor(host) {
  if (!host) return;
  const tools = TOOLS.filter(t => !t.hidden && t.id !== 'assistant');
  const byId = new Map(tools.map(t => [t.id, t]));
  const ids = editableShortcutIds(tools).filter(id => byId.has(id));
  const custom = isCustomShortcuts();
  const full = ids.length >= MAX_SHORTCUTS;
  host.innerHTML = `
    <ol class="stg-sc-list" aria-label="Home shortcuts">
      ${ids.map((id, i) => { const t = byId.get(id); return `<li class="stg-sc-item" data-id="${escapeHtml(id)}">
        <span class="stg-sc-icon" aria-hidden="true">${t.icon}</span>
        <span class="stg-sc-name">${escapeHtml(t.name)}</span>
        <span class="stg-sc-acts">
          <button type="button" class="stg-sc-btn" data-sc="up" aria-label="Move ${escapeHtml(t.name)} earlier" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg></button>
          <button type="button" class="stg-sc-btn" data-sc="down" aria-label="Move ${escapeHtml(t.name)} later" ${i === ids.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
          <button type="button" class="stg-sc-btn" data-sc="remove" aria-label="Remove ${escapeHtml(t.name)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </span>
      </li>`; }).join('')}
    </ol>
    ${ids.length ? '' : '<p class="stg-sc-empty">No shortcuts. Home will show just the search.</p>'}
    <div class="stg-sc-add">
      <input type="search" class="stg-sc-input" placeholder="${full ? `You have ${MAX_SHORTCUTS}. Remove one to add another.` : 'Add a tool…'}" aria-label="Add a tool to Home shortcuts" autocomplete="off" ${full ? 'disabled' : ''}>
      <div class="stg-sc-results" role="listbox" hidden></div>
    </div>
    <div class="stg-sc-foot">
      <span class="stg-row-hint">${custom ? 'Your own selection.' : 'Automatic: the tools you use most.'}</span>
      ${custom ? '<button type="button" class="stg-sc-reset" data-sc="reset">Back to automatic</button>' : ''}
    </div>`;

  const commit = (next) => { setShortcutIds(next); renderShortcutEditor(host); };
  host.onclick = (e) => {
    const b = e.target.closest('[data-sc]');
    if (!b) return;
    const act = b.dataset.sc;
    if (act === 'reset') { updateSettings({ homeShortcuts: [] }); renderShortcutEditor(host); return; }
    if (act === 'add') { commit([...ids, b.dataset.id]); requestAnimationFrame(() => host.querySelector('.stg-sc-input')?.focus()); return; }
    const id = b.closest('.stg-sc-item')?.dataset.id;
    const i = ids.indexOf(id);
    if (i < 0) return;
    const next = ids.slice();
    if (act === 'remove') next.splice(i, 1);
    if (act === 'up' && i > 0) [next[i - 1], next[i]] = [next[i], next[i - 1]];
    if (act === 'down' && i < next.length - 1) [next[i + 1], next[i]] = [next[i], next[i + 1]];
    commit(next);
    host.querySelector(`.stg-sc-item[data-id="${CSS.escape(id)}"] [data-sc="${act}"]:not(:disabled)`)?.focus();
  };
  const input = host.querySelector('.stg-sc-input');
  const results = host.querySelector('.stg-sc-results');
  input?.addEventListener('input', () => {
    const q = input.value.trim();
    const pool = tools.filter(t => !ids.includes(t.id));
    const found = q ? searchTools(q, pool).results.map(r => r.tool).slice(0, 6) : [];
    results.hidden = !found.length;
    results.innerHTML = found.map(t => `<button type="button" class="stg-sc-result" role="option" data-sc="add" data-id="${escapeHtml(t.id)}"><span class="stg-sc-icon" aria-hidden="true">${t.icon}</span><span>${escapeHtml(t.name)}</span></button>`).join('');
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); results.querySelector('.stg-sc-result')?.click(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); results.querySelector('.stg-sc-result')?.focus(); }
  });
}

function renderAiSettings(refreshQuota = true) {
  const container = modalEl.querySelector('#ai-settings-container');
  if (!container) return;
  import('./assistant/memory-ui.js').then(m => m.renderAssistantMemory(modalEl.querySelector('#ai-memory-container'))).catch(() => {});
  const user = getCurrentUser();
  const quota = user ? QuotaManager.getQuotaSummary() : null;
  const isUnlimited = user ? QuotaManager.isUserUnlimited() : false;
  if (user && refreshQuota && quota?.source === 'local-estimate') {
    QuotaManager.refreshServerQuota().then(() => renderAiSettings(false)).catch(() => {});
  }
  const pct = quota && quota.messagesLimit ? Math.min(100, Math.round((quota.messagesUsed / quota.messagesLimit) * 100)) : 0;

  const openTo = getSettings().assistantOpenTo === 'last' ? 'last' : 'new';
  const persona = getSettings().assistantPersona || '';
  const personas = PERSONA_CHOICES();
  container.innerHTML = section('Personality', 'Give the Assistant the voice of one of the avatars. Only the voice changes: answers, figures and tools work the same.', `<div class="stg-card stg-persona-card">
    <div class="stg-persona-grid" role="radiogroup" aria-label="Assistant personality">
      <button type="button" class="stg-persona${persona ? '' : ' is-on'}" role="radio" aria-checked="${!persona}" data-persona="">
        <span class="stg-persona-img stg-persona-std" aria-hidden="true">${icon('sparkles', 20)}</span><span class="stg-persona-name">Standard</span><span class="stg-persona-tag">Clear and professional</span></button>
      ${personas.map(p => `<button type="button" class="stg-persona${persona === p.id ? ' is-on' : ''}" role="radio" aria-checked="${persona === p.id}" data-persona="${escapeHtml(p.id)}">
        <img class="stg-persona-img" src="${escapeHtml(p.src)}" alt="" loading="lazy" width="44" height="44"><span class="stg-persona-name">${escapeHtml(p.name)}</span><span class="stg-persona-tag">${escapeHtml(p.tagline)}</span></button>`).join('')}
    </div></div>`) + section('Pop-up', '', `<div class="stg-card">
    ${row({ title: 'Open the Assistant as a pop-up', hint: 'On: “Ask Assistant” opens a floating panel over what you are doing. Off: it opens the full Assistant page.', forId: 'ai-popup', control: switchInput('ai-popup', getSettings().assistantPopup !== false) })}
    ${row({ title: 'Open full Assistant in a new tab', hint: 'Off: the full Assistant opens here. On: open a separate browser tab.', forId: 'ai-new-tab', control: switchInput('ai-new-tab', getSettings().assistantNewTab === true) })}
  </div>`) + section('Conversations', '', `<div class="stg-card">
    ${row({ title: 'When the Assistant opens', hint: 'Start fresh each time, or pick up the chat you had open last. Past chats are always in the list.', tag: 'div', control: `
      <span class="stg-seg" role="radiogroup" aria-label="When the Assistant opens">
        <input type="radio" name="ai-open-to" id="ai-open-new" value="new" ${openTo === 'new' ? 'checked' : ''}><label for="ai-open-new">New chat</label>
        <input type="radio" name="ai-open-to" id="ai-open-last" value="last" ${openTo === 'last' ? 'checked' : ''}><label for="ai-open-last">Last chat</label>
      </span>` })}
  </div>`) + section('Usage and sync', '', `<div class="stg-card">
    ${row({ title: 'Conversation sync', hint: user ? 'Your chats are saved to your account and restored when you sign in.' : 'Sign in to keep your chats on every device.', tag: 'div',
      control: `<span class="stg-pill ${user ? 'is-on' : ''}">${user ? 'On' : 'Off'}</span>` })}
    ${user && quota ? `<div class="stg-row stg-row-stack">
      <span class="stg-row-copy"><span class="stg-row-title">Messages today</span><span class="stg-row-hint">${isUnlimited ? 'Unlimited access' : `${quota.messagesUsed.toLocaleString()} of ${quota.messagesLimit.toLocaleString()} used`}${quota.source === 'local-estimate' ? ' · updating' : ''} · resets at midnight UTC</span></span>
      ${isUnlimited ? '' : `<span class="stg-meter" role="meter" aria-valuemin="0" aria-valuemax="${quota.messagesLimit}" aria-valuenow="${quota.messagesUsed}" aria-label="Messages used today"><i style="--p:${pct}%"></i></span>`}
    </div>` : ''}
  </div>`);

  container.querySelector('.stg-persona-grid')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-persona]');
    if (!b) return;
    updateSettings({ assistantPersona: b.dataset.persona });
    container.querySelectorAll('[data-persona]').forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
    flashSaved();
  });
  container.querySelector('#ai-popup')?.addEventListener('change', (e) => { updateSettings({ assistantPopup: e.target.checked }); flashSaved(); });
  container.querySelector('#ai-new-tab')?.addEventListener('change', (e) => { updateSettings({ assistantNewTab: e.target.checked }); flashSaved(); });
  container.querySelectorAll('input[name="ai-open-to"]').forEach((r) => r.addEventListener('change', (e) => { if (e.target.checked) { updateSettings({ assistantOpenTo: e.target.value }); flashSaved(); } }));
}

function renderStorageSettings() {
  const container = modalEl.querySelector('#storage-settings-container');
  if (!container) return;
  container.innerHTML = section('Backup', 'Move your settings to another browser or device.', `<div class="stg-card">
    <button type="button" class="stg-row stg-row-link" id="btn-settings-export">
      <span class="stg-row-copy"><span class="stg-row-title">Export settings</span><span class="stg-row-hint">Download them as a JSON file</span></span>
      <span class="stg-row-control">${icon('download', 17)}</span></button>
    <label class="stg-row stg-row-link" for="settings-import-file">
      <span class="stg-row-copy"><span class="stg-row-title">Import settings</span><span class="stg-row-hint" id="settings-storage-msg">Load a file you exported earlier</span></span>
      <span class="stg-row-control">${icon('upload', 17)}</span>
      <input type="file" id="settings-import-file" accept=".json,application/json" hidden></label>
  </div>
  <p class="stg-footnote">Toolbox keeps your data in this browser (IndexedDB and local storage) and, when you're signed in, in your account.</p>`);

  container.querySelector('#btn-settings-export')?.addEventListener('click', () => exportSettings());
  container.querySelector('#settings-import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = importSettings(evt.target.result);
      const msg = container.querySelector('#settings-storage-msg');
      if (result.success) {
        if (msg) { msg.textContent = 'Imported. Your settings are updated.'; msg.dataset.tone = 'ok'; }
        renderPreferencesSettings(); renderAiSettings(); updateThemeList(); flashSaved();
      } else if (msg) { msg.textContent = `Import failed: ${result.error}`; msg.dataset.tone = 'error'; }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

const THEME_SWATCH = {
  system: '<span class="theme-swatch theme-swatch-system"><i></i><i></i></span>',
  light: '<span class="theme-swatch theme-swatch-light"><i></i><i></i></span>',
  dark: '<span class="theme-swatch theme-swatch-dark"><i></i><i></i></span>',
};

function updateThemeList() {
  const grid = modalEl?.querySelector('#theme-grid-standard');
  if (!grid) return;
  const current = getStoredTheme();
  grid.innerHTML = THEMES.map(t => `
    <button type="button" class="theme-option${t.id === current ? ' is-active' : ''}" role="radio" aria-checked="${t.id === current}" data-theme-id="${t.id}">
      ${THEME_SWATCH[t.id] || ''}
      <span class="theme-option-name">${escapeHtml(t.name)}</span>
      <span class="theme-option-desc">${escapeHtml(t.description)}</span>
      <span class="stg-theme-check">${icon('check', 13)}</span>
    </button>`).join('');
  grid.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-active')) return;
      applyTheme(btn.dataset.themeId);
      updateThemeList();
      flashSaved();
    });
  });
}

function renderMailSettings() {
  const container = modalEl?.querySelector('#mail-settings-container');
  if (!container) return;
  import('../views/mail-setup.js').then(({ createMailSetupUI }) => {
    container.innerHTML = '';
    container.appendChild(createMailSetupUI());
    searchIndex = [];
  }).catch(() => {});
}

function renderNotificationSettings() {
  const container = modalEl?.querySelector('#notifications-settings-container');
  if (!container) return;
  const current = getSettings();
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  container.innerHTML = section('Alerts', '', `<div class="stg-card">
      ${row({ title: 'In-app notifications', hint: 'Badges and alerts for new messages and reminders', forId: 'pref-notif-enabled', control: switchInput('pref-notif-enabled', current.notificationsEnabled !== false) })}
      ${row({ title: 'Sounds', hint: 'A soft chime when an alert arrives', forId: 'pref-notif-sound', control: switchInput('pref-notif-sound', !!current.notificationSound) })}
      ${row({ title: 'Test', hint: 'Send a sample alert through the channels that are on', forId: 'pref-notif-test', control: '<button type="button" class="btn btn-secondary btn-sm" id="pref-notif-test">Send test</button>' })}
      ${row({ title: 'System alerts', hint: `Phone and desktop notifications when Toolbox is in the background<span class="stg-row-status" id="pref-notif-status" role="status">${permission === 'denied' ? 'Blocked in your browser’s site settings.' : permission === 'unsupported' ? 'Not supported by this browser.' : ''}</span>`, forId: 'pref-notif-push', control: switchInput('pref-notif-push', !!current.notificationsPush) })}
    </div>`);
  container.querySelector('#pref-notif-enabled')?.addEventListener('change', (e) => updateSettings({ notificationsEnabled: e.target.checked }));
  container.querySelector('#pref-notif-test')?.addEventListener('click', async () => {
    const status = container.querySelector('#pref-notif-status');
    const sent = await NotificationEngine.sendTest();
    if (!sent && status) status.textContent = 'In-app notifications are off.';
  });
  container.querySelector('#pref-notif-sound')?.addEventListener('change', (e) => {
    if (e.target.checked) prepareNotificationSound();
    updateSettings({ notificationSound: e.target.checked });
  });
  container.querySelector('#pref-notif-push')?.addEventListener('change', async (e) => {
    const status = container.querySelector('#pref-notif-status');
    if (!e.target.checked) {
      updateSettings({ notificationsPush: false });
      if (status) status.textContent = '';
      return;
    }
    const result = await NotificationEngine.enableBrowserNotifications();
    e.target.checked = result === 'granted';
    if (status) status.textContent = result === 'granted' ? '' : result === 'unsupported' ? 'Not supported by this browser.' : 'Blocked in your browser’s site settings.';
  });
}

/* ---------------- open / close ---------------- */

export function openSettings(targetSection = null) {
  createModal();
  renderMe();
  renderProfileSettings();
  updateThemeList();
  renderPreferencesSettings();
  renderAiSettings();
  renderStorageSettings();
  renderMailSettings();
  renderNotificationSettings();
  renderContributionSettings(modalEl.querySelector('#contribution-settings-container'), () => { closeSettings(); openAccountModal(); });
  paintSupporterProfile();
  const toolFocus = typeof targetSection === 'string' && targetSection.startsWith('tool:') ? targetSection.slice(5) : null;
  renderToolPreferences(modalEl.querySelector('#tool-settings-container'), toolFocus);
  searchIndex = [];

  const input = modalEl.querySelector('#settings-search-input');
  input.value = '';
  runSearch('');
  delete modalEl.querySelector('.stg').dataset.sub;

  const alias = { preferences: 'general', storage: 'general', ai: 'assistant', contribution: 'support', shortcuts: 'general' };
  const target = toolFocus ? 'tools' : targetSection ? (alias[targetSection] || targetSection) : null;
  currentPage = null;
  if (target === 'avatars') showAvatarView();
  else if (target && PAGE_BY_ID.has(target)) showPage(target, { instant: true });
  else if (isNarrow()) goHome();
  else showPage(sessionPage() || 'profile', { instant: true });
  if (targetSection === 'shortcuts') requestAnimationFrame(() => modalEl.querySelector('#stg-shortcuts-section')?.scrollIntoView?.({ block: 'start' }));
  if (toolFocus) requestAnimationFrame(() => modalEl.querySelector(`[data-tool-card="${toolFocus.replace(/[^a-z0-9-]/gi, '')}"]`)?.scrollIntoView?.({ block: 'start' }));

  clearTimeout(closeTimer);
  modalEl.style.display = 'flex';
  requestAnimationFrame(() => {
    modalEl.classList.add('is-open');
    placeIndicator(false);
    if (!isNarrow() && !target) input.focus({ preventScroll: true });
  });
  isOpen = true;
}

export function closeSettings() {
  if (!modalEl || !isOpen) return;
  cancelPanelMotion();
  clearTimeout(savedTimer);
  modalEl.classList.remove('is-open');
  isOpen = false;
  closeTimer = setTimeout(() => { if (!isOpen) modalEl.style.display = 'none'; }, reducedMotion() ? 0 : 260);
}

export function installSettingsUI() {
  warmProfilePictures();
  window.addEventListener('toolbox:authchange', () => { if (isOpen) openSettings(currentPage); });
  document.getElementById('settings-btn')?.addEventListener('click', () => openSettings());
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if (isNarrow() && modalEl.querySelector('.stg').dataset.view === 'page') { goBack(); return; }
      closeSettings();
      return;
    }
    if (e.key === '/' && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
      e.preventDefault();
      if (isNarrow()) goHome();
      modalEl.querySelector('#settings-search-input')?.focus();
    }
  });
}
