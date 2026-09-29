/* ============================================================
   TOOLBOX — Interface icons

   One line-icon family for the small symbols inside buttons,
   status lines and badges (check, close, play, warning…), drawn
   on the same 24px grid, stroke and round joins as the tool icons
   in the registry. Use these instead of text glyphs such as
   ✓ ✕ ▶ ⚠ ★, which render differently on every platform and
   never line up with the text beside them.

   icon('check')                 → 1em, inherits the text colour
   icon('play', { size: 16 })    → fixed pixel size
   statusHtml('ok', message)     → escaped "✓ message" with a real icon
   ============================================================ */

const P = {
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  alert: '<path d="M10.3 4.2 2.8 17.5a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/>',
  pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="m14.5 5.5 3 3"/>',
  play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.5-6.8a.8.8 0 0 0 0-1.4L8.7 4.5a.8.8 0 0 0-1.2.7z" fill="currentColor"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor" stroke="none"/>',
  'skip-back': '<path d="M18.5 6v12a.8.8 0 0 1-1.2.7l-9-6a.8.8 0 0 1 0-1.4l9-6a.8.8 0 0 1 1.2.7z" fill="currentColor"/><path d="M5.5 5v14"/>',
  'skip-forward': '<path d="M5.5 6v12a.8.8 0 0 0 1.2.7l9-6a.8.8 0 0 0 0-1.4l-9-6a.8.8 0 0 0-1.2.7z" fill="currentColor"/><path d="M18.5 5v14"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  swap: '<path d="M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  'star-fill': '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>',
  sparkle: '<path d="M12 3.5l1.7 4.6a2 2 0 0 0 1.2 1.2l4.6 1.7-4.6 1.7a2 2 0 0 0-1.2 1.2L12 18.5l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 11l4.6-1.7a2 2 0 0 0 1.2-1.2z"/>',
  external: '<path d="M7 17 17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'chevron-up': '<path d="m5 15 7-7 7 7"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4v5h-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  replace: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  grid: '<path d="M9 4v16M15 4v16M4 9h16M4 15h16"/>',
  'folder-plus': '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  collapse: '<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>',
  maximize: '<path d="M14.5 4H20v5.5M9.5 20H4v-5.5M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
  'clear-all': '<path d="M4 6h16M4 11h10M4 16h7"/><path d="m15 14 5 5M20 14l-5 5"/>',
  backspace: '<path d="M20 5H9.2a1 1 0 0 0-.8.4L3.5 12l4.9 6.6a1 1 0 0 0 .8.4H20a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  save: '<path d="M5 3.5h11l3.5 3.5v12.5a1 1 0 0 1-1 1h-13.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M8 3.5v5h7v-5M7.5 20.5v-6h9v6"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z"/>',
  copy: '<rect x="8" y="8" width="12.5" height="12.5" rx="2.5"/><path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  paperclip: '<path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L6 19.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  message: '<path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  dot: '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>',
  circle: '<circle cx="12" cy="12" r="7"/>',
};

export const ICON_NAMES = Object.keys(P);

/** An interface icon as an SVG string. Unknown names give an empty string. */
export function icon(name, { size = null, className = '', label = '' } = {}) {
  const body = P[name];
  if (!body) return '';
  const dims = size ? ` width="${size}" height="${size}"` : '';
  const a11y = label ? ` role="img" aria-label="${label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"` : ' aria-hidden="true"';
  return `<svg class="tb-i${className ? ` ${className}` : ''}" viewBox="0 0 24 24"${dims} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false"${a11y}>${body}</svg>`;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A status line: an icon for ok / error / warn / info, then the (escaped) text. */
export function statusHtml(kind, text) {
  const name = { ok: 'check', error: 'x-circle', warn: 'alert', info: 'info' }[kind] || 'info';
  return `<span class="tb-status tb-status-${kind}">${icon(name)}<span>${escapeHtml(text)}</span></span>`;
}

/** Sets a status line on an element (textContent-safe). */
export function setStatus(el, kind, text) {
  if (el) el.innerHTML = statusHtml(kind, text);
}

/** Button label with an icon, e.g. iconLabel('check', 'Copied'). */
export const iconLabel = (name, text) => `<span class="tb-il">${icon(name)}<span>${escapeHtml(text)}</span></span>`;
