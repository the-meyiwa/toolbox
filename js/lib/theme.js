/* ============================================================
   TOOLBOX — Theme Management Engine
   Supports all 9 canonical palettes + curated experimental UI themes
   with instant hydration, persistent storage, and reactive switching.
   ============================================================ */

export const THEMES = [
  // --- Standard Themes ---
  {
    id: 'default',
    name: 'Default (Black-on-white)',
    category: 'standard',
    preview: {
      bg: '#ffffff',
      card: '#f7f7f7',
      text: '#000000',
      accent: '#000000',
    },
    description: 'Clean, timeless Swiss-inspired monochrome.',
  },
  {
    id: 'white-on-black',
    name: 'White-on-Black',
    category: 'standard',
    preview: {
      bg: '#0d0d0d',
      card: '#1a1a1a',
      text: '#ffffff',
      accent: '#ffffff',
    },
    description: 'High-contrast pure dark mode with crisp white typography.',
  },
  {
    id: 'burgundy',
    name: 'Burgundy Gradient',
    category: 'standard',
    preview: {
      bg: '#1b0711',
      card: '#2f0d1f',
      text: '#fcebf0',
      accent: '#e05375',
    },
    description: 'Rich royal wine gradient with warm rose accents.',
  },
  {
    id: 'cozy-pink',
    name: 'Cozy Pink',
    category: 'standard',
    preview: {
      bg: '#fdf2f4',
      card: '#ffffff',
      text: '#4a1d2f',
      accent: '#d64573',
    },
    description: 'Soft pastel blush with dusty strawberry and cream tones.',
  },
  {
    id: 'solar-blue',
    name: 'Solar Blue',
    category: 'standard',
    preview: {
      bg: '#081226',
      card: '#0d1f3d',
      text: '#e0f4ff',
      accent: '#00d2ff',
    },
    description: 'Luminous cyan highlights on deep sapphire midnight.',
  },
  {
    id: 'nocturne-blue',
    name: 'Nocturne Blue',
    category: 'standard',
    preview: {
      bg: '#0f172a',
      card: '#1e293b',
      text: '#f8fafc',
      accent: '#818cf8',
    },
    description: 'Calm twilight slate with glowing periwinkle indigo.',
  },
  {
    id: 'alpine-green',
    name: 'Alpine Green',
    category: 'standard',
    preview: {
      bg: '#0b1f17',
      card: '#15382b',
      text: '#e6f7ef',
      accent: '#22c55e',
    },
    description: 'Deep evergreen pine forest with vibrant fresh mint foliage.',
  },
  {
    id: 'canary-yellow',
    name: 'Canary Yellow',
    category: 'standard',
    preview: {
      bg: '#121212',
      card: '#1f1f1f',
      text: '#ffffff',
      accent: '#ffd600',
    },
    description: 'Industrial high-contrast obsidian with vivid canary neon.',
  },
  {
    id: 'espresso',
    name: 'Espresso with Cream',
    category: 'standard',
    preview: {
      bg: '#1c1410',
      card: '#2b1e19',
      text: '#f5ebe6',
      accent: '#d4a373',
    },
    description: 'Dark roasted coffee beans with velvety caramel cream.',
  },

  // --- Experimental & Cyberpunk UI Options ---
  {
    id: 'neon-tokyo',
    name: 'Neon Tokyo',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#090514',
      card: '#170c2e',
      text: '#f2e8ff',
      accent: '#ff007f',
    },
    description: 'Synthwave night city with hot neon magenta & electric cyan borders.',
  },
  {
    id: 'cyber-matrix',
    name: 'Cyber Matrix',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#040d07',
      card: '#0a1a0f',
      text: '#d8ffea',
      accent: '#00ff66',
    },
    description: 'Phosphor green terminal matrix on deep radioactive obsidian.',
  },
  {
    id: 'akira-crimson',
    name: 'Akira Crimson',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#0e0a0d',
      card: '#1c1218',
      text: '#ffebed',
      accent: '#ff2a2a',
    },
    description: 'High-octane warning scarlet on pitch black industrial asphalt.',
  },
  {
    id: 'cyber-cyan',
    name: 'Cyber Cyan',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#06101e',
      card: '#0d1e36',
      text: '#e1f8ff',
      accent: '#00e5ff',
    },
    description: 'Holographic ice cyan neural interface with luminous glass sheen.',
  },
  {
    id: 'nordic-slate',
    name: 'Nordic Slate & Teal',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#181e24',
      card: '#222b34',
      text: '#f1f5f9',
      accent: '#2dd4bf',
    },
    description: 'Minimalist Scandinavian arctic slate with aurora teal glow.',
  },
  {
    id: 'sunset-ember',
    name: 'Sunset Ember',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#160d1a',
      card: '#25142b',
      text: '#fdf4eb',
      accent: '#f97316',
    },
    description: 'Dusky twilight purple fading into blazing ember orange.',
  },
  {
    id: 'paper-ink',
    name: 'Paper & Ink',
    category: 'experimental',
    experimental: true,
    preview: {
      bg: '#f4eedb',
      card: '#faf6ec',
      text: '#1f1e1c',
      accent: '#c2593f',
    },
    description: 'Warm textured newsprint parchment with charcoal sumi ink.',
  },
];

const THEME_ALIASES = {
  'cyber-neon': 'neon-tokyo',
};

const STORAGE_KEY = 'toolbox_theme';

export function getStoredTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || 'default';
    return THEME_ALIASES[raw] || raw;
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

  // Dispatch custom event for reactive tools (like WebGL / Canvas / Charts)
  window.dispatchEvent(new CustomEvent('toolbox:themechange', { detail: { theme: targetTheme } }));
  return targetTheme;
}

export function initTheme() {
  const current = getStoredTheme();
  applyTheme(current);
  return current;
}
