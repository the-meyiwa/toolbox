/* ============================================================
   TOOLBOX — Theme
   Two themes, one system: Light and Dark (Soft Monochrome), plus
   "System", which follows the operating system and keeps following it.
   The resolved theme is written to <html data-theme="light|dark">;
   every colour in the product reads from tokens keyed on that.
   ============================================================ */

export const THEMES = [
  { id: 'system', name: 'System', description: 'Follow your device setting.' },
  { id: 'light', name: 'Light', description: 'Near-black ink on warm white paper.' },
  { id: 'dark', name: 'Dark', description: 'Soft white ink on near-black.' },
];

/* Old palette themes resolve to the side they looked like. */
const DARK_LEGACY = new Set([
  'white-on-black', 'yosemite-night', 'linux-mint', 'ubuntu', 'art-deco', 'lagos',
  'african-textile', 'british-racing-green', 'wimbledon', 'coca-cola', 'mcdonalds',
  'playstation', 'miami-vice', 'cyberpunk', 'cyberpunk-amber', 'neon-tokyo',
]);

const STORAGE_KEY = 'toolbox_theme';
const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function normalise(id) {
  if (id === 'system' || id === 'light' || id === 'dark') return id;
  if (!id) return 'system';
  return DARK_LEGACY.has(id) ? 'dark' : 'light';
}

/** The stored preference: 'system' | 'light' | 'dark'. */
export function getStoredTheme() {
  try { return normalise(localStorage.getItem(STORAGE_KEY)); }
  catch { return 'system'; }
}

/** The theme actually on screen: 'light' | 'dark'. */
export function getResolvedTheme(pref = getStoredTheme()) {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

function paint(mode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#0a0a0a' : '#f7f7f6');
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

export function applyTheme(themeId) {
  const pref = normalise(themeId);
  const mode = getResolvedTheme(pref);

  // Cross-fade the switch instead of snapping every surface at once.
  const root = document.documentElement;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && root.getAttribute('data-theme') && root.getAttribute('data-theme') !== mode) {
    root.classList.add('theme-transition');
    clearTimeout(applyTheme._t);
    applyTheme._t = setTimeout(() => root.classList.remove('theme-transition'), 320);
  }

  paint(mode);
  try { localStorage.setItem(STORAGE_KEY, pref); } catch {}
  window.dispatchEvent(new CustomEvent('toolbox:themechange', { detail: { theme: mode, preference: pref } }));
  return pref;
}

/** Flip between light and dark from whatever is showing now. */
export function toggleTheme() {
  return applyTheme(getResolvedTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  const pref = getStoredTheme();
  paint(getResolvedTheme(pref));
  media?.addEventListener?.('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  return pref;
}
