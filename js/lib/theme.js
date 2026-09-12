/* ============================================================
   TOOLBOX — Theme Management Engine
   Supports 4 canonical themes (Default, White-on-Black, Linux Mint, Ubuntu)
   ============================================================ */

export const THEMES = [
  {
    id: 'default',
    name: 'Default (Black-on-white)',
    category: 'standard',
    preview: { bg: '#ffffff', card: '#f7f7f7', text: '#000000', accent: '#000000' },
    description: 'Clean, timeless Swiss-inspired monochrome.'
  },
  {
    id: 'white-on-black',
    name: 'White-on-Black',
    category: 'standard',
    preview: { bg: '#0d0d0d', card: '#1a1a1a', text: '#ffffff', accent: '#ffffff' },
    description: 'High-contrast pure dark mode with crisp white typography.'
  },
  {
    id: 'linux-mint',
    name: 'Linux Mint (Mint-Y)',
    category: 'standard',
    preview: { bg: '#2f343f', card: '#262930', text: '#f3f4f6', accent: '#87cf3e' },
    description: 'Iconic Cinnamon desktop with charcoal slate & fresh mint green.'
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu (Yaru)',
    category: 'standard',
    preview: { bg: '#242424', card: '#2c2c2c', text: '#f7f7f7', accent: '#e95420' },
    description: 'Authentic Yaru dark desktop with warm aubergine and vibrant orange.'
  }
];

const THEME_ALIASES = {};
const STORAGE_KEY = 'toolbox_theme';

export function getStoredTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || 'default';
    const resolved = THEME_ALIASES[raw] || raw;
    return THEMES.find(t => t.id === resolved) ? resolved : 'default';
  } catch {
    return 'default';
  }
}

export function applyTheme(themeId) {
  const resolved = THEME_ALIASES[themeId] || themeId;
  const targetTheme = THEMES.find(t => t.id === resolved) ? resolved : 'default';
  
  if (targetTheme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', targetTheme);
  }

  try {
    localStorage.setItem(STORAGE_KEY, targetTheme);
  } catch {}

  // Dispatch custom event for reactive tools
  window.dispatchEvent(new CustomEvent('toolbox:themechange', { detail: { theme: targetTheme } }));
  return targetTheme;
}

export function initTheme() {
  const current = getStoredTheme();
  applyTheme(current);
  return current;
}
