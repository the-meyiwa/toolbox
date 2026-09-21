/* ============================================================
   TOOLBOX — Theme Management Engine
   Seven curated themes with complete semantic-token coverage.
   ============================================================ */

export const THEMES = [
  { id: 'default', name: 'Black on White', group: 'minimal', preview: { bg: '#ffffff', surface: '#ffffff', card: '#ffffff', text: '#000000', accent: '#000000', border: '#dddddd' }, description: 'Precise monochrome with a bright canvas.' },
  { id: 'white-on-black', name: 'White on Black', group: 'minimal', preview: { bg: '#000000', surface: '#111111', card: '#111111', text: '#ffffff', accent: '#ffffff', border: '#262626' }, description: 'Focused monochrome for low-light work.' },
  { id: 'claude', name: 'Claude', group: 'signature', preview: { bg: '#f7f3ee', surface: '#fcfaf7', card: '#fcfaf7', text: '#2f2a25', accent: '#c15f3c', border: '#ded5ca' }, description: 'Warm, editorial, and quietly tactile.' },
  { id: 'ubuntu', name: 'Ubuntu', group: 'signature', preview: { bg: '#242424', surface: '#2c2c2c', card: '#2c2c2c', text: '#f7f7f7', accent: '#e95420', border: 'rgba(255,255,255,0.09)' }, description: 'Deep aubergine surfaces with warm orange accents.' },
  { id: 'cyberpunk', name: 'Cyberpunk', group: 'signature', preview: { bg: '#07080d', surface: '#10131c', card: '#111622', text: '#f4f7ff', accent: '#68f7d4', border: 'rgba(104,247,212,0.28)' }, description: 'Dark technical glass with electric mint and violet signals.' },
  { id: 'neon-tokyo', name: 'Neon Tokyo', group: 'signature', preview: { bg: '#090611', surface: '#171022', card: '#1d132b', text: '#fff4fc', accent: '#ff4fc8', border: 'rgba(77,238,255,0.3)' }, description: 'Midnight violet glass with electric pink and cyan light.' },
  { id: 'cyberpunk-amber', name: 'Cyberpunk Amber', group: 'signature', preview: { bg: '#0b0905', surface: '#18130b', card: '#21180c', text: '#fff8e8', accent: '#ffb000', border: 'rgba(255,176,0,0.3)' }, description: 'Industrial black glass with amber terminals and cool blue signals.' }
];

const THEME_ALIASES = {
  'black-on-white': 'default',
  'yosemite': 'default',
  'yosemite-night': 'white-on-black',
  'linux-mint': 'ubuntu',
  'mondrian': 'default',
  'memphis': 'default',
  'art-deco': 'white-on-black',
  'mid-century': 'claude',
  'japanese-traditional': 'claude',
  'lagos': 'ubuntu',
  'african-textile': 'ubuntu',
  'british-racing-green': 'ubuntu',
  'wimbledon': 'claude',
  'barbie': 'claude',
  'tiffany': 'default',
  'coca-cola': 'default',
  'mcdonalds': 'default',
  'playstation': 'white-on-black',
  'ikea': 'default',
  'google': 'default',
  'miami-vice': 'cyberpunk'
};
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
