/* ============================================================
   TOOLBOX — Theme Management Engine
   Supports 4 canonical themes (Default, White-on-Black, Linux Mint, Ubuntu)
   ============================================================ */

export const THEMES = [
  // --- SYSTEM (15) ---
  {
    id: 'yosemite',
    name: 'Yosemite',
    group: 'system',
    preview: { bg: '#e8ecf2', card: '#ffffff', text: '#1d1d1f', accent: '#007aff', border: 'rgba(0,0,0,0.12)' },
    description: 'Translucent glass surfaces, subtle blur, and Apple system blue.'
  },
  {
    id: 'yosemite-night',
    name: 'Yosemite Night',
    group: 'system',
    preview: { bg: '#14171d', card: '#1c212a', text: '#f5f5f7', accent: '#0a84ff', border: 'rgba(255,255,255,0.12)' },
    description: 'Dark translucent glass, deep contrast, and luminous Apple system blue.'
  },
  {
    id: 'windows-11',
    name: 'Windows 11',
    group: 'system',
    preview: { bg: '#f3f3f3', card: '#ffffff', text: '#1b1b1b', accent: '#0067c0', border: 'rgba(0,0,0,0.08)' },
    description: 'Fluent Design with cool neutral surfaces, subtle layers, and soft blue accents.'
  },
  {
    id: 'macos-sonoma',
    name: 'macOS Sonoma',
    group: 'system',
    preview: { bg: '#eceef2', card: '#ffffff', text: '#1d1d1f', accent: '#0071e3', border: 'rgba(0,0,0,0.1)' },
    description: 'Sophisticated translucent surfaces, subtle depth, and polished system controls.'
  },
  {
    id: 'macos-big-sur',
    name: 'macOS Big Sur',
    group: 'system',
    preview: { bg: '#e4e7ed', card: '#ffffff', text: '#161617', accent: '#147efb', border: 'rgba(0,0,0,0.12)' },
    description: 'Dimensional surfaces, soft glass, rounded cards, and vibrant system color.'
  },
  {
    id: 'gnome',
    name: 'GNOME',
    group: 'system',
    preview: { bg: '#242424', card: '#303030', text: '#ffffff', accent: '#3584e4', border: 'rgba(255,255,255,0.08)' },
    description: 'Adwaita minimal slate, calm spacing, and clean typography.'
  },
  {
    id: 'kde-plasma',
    name: 'KDE Plasma',
    group: 'system',
    preview: { bg: '#232629', card: '#31363b', text: '#eff0f1', accent: '#3daee9', border: 'rgba(255,255,255,0.1)' },
    description: 'Breeze desktop with cool surfaces, clear panel separation, and cyan blue.'
  },
  {
    id: 'elementary-os',
    name: 'elementary OS',
    group: 'system',
    preview: { bg: '#fafafa', card: '#ffffff', text: '#333333', accent: '#3689e6', border: 'rgba(0,0,0,0.1)' },
    description: 'Pantheon elegance with soft light surfaces, refined borders, and subtle shadows.'
  },
  {
    id: 'fedora',
    name: 'Fedora',
    group: 'system',
    preview: { bg: '#1e252b', card: '#29313a', text: '#f1f3f5', accent: '#3c6eb4', border: 'rgba(255,255,255,0.09)' },
    description: 'Modern workstation character with cool neutral surfaces and Fedora blue.'
  },
  {
    id: 'pop-os',
    name: 'Pop!_OS',
    group: 'system',
    preview: { bg: '#2b2b2b', card: '#363636', text: '#f6f6f6', accent: '#48b9c7', border: 'rgba(255,255,255,0.08)' },
    description: 'COSMIC dark desktop with warm/cool contrast and dimensional panels.'
  },
  {
    id: 'zorin-os',
    name: 'Zorin OS',
    group: 'system',
    preview: { bg: '#1e222b', card: '#282e3a', text: '#f0f2f5', accent: '#15aabf', border: 'rgba(255,255,255,0.09)' },
    description: 'Approachable desktop aesthetic with balanced surfaces and friendly teal.'
  },
  {
    id: 'deepin',
    name: 'Deepin',
    group: 'system',
    preview: { bg: '#1c202a', card: '#252b38', text: '#f4f6fa', accent: '#0081ff', border: 'rgba(255,255,255,0.12)' },
    description: 'Visually expressive desktop with layered glass, rich depth, and vivid accents.'
  },
  {
    id: 'chromeos',
    name: 'ChromeOS',
    group: 'system',
    preview: { bg: '#f8f9fa', card: '#ffffff', text: '#202124', accent: '#1a73e8', border: 'rgba(0,0,0,0.08)' },
    description: 'Clean and lightweight with bright surfaces and Google-like balanced accents.'
  },
  {
    id: 'linux-mint',
    name: 'Linux Mint',
    group: 'system',
    preview: { bg: '#2f343f', card: '#262930', text: '#f3f4f6', accent: '#87cf3e', border: '#3d4250' },
    description: 'Iconic Cinnamon desktop with charcoal slate & fresh mint green.'
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    group: 'system',
    preview: { bg: '#242424', card: '#2c2c2c', text: '#f7f7f7', accent: '#e95420', border: '#424242' },
    description: 'Authentic Yaru dark desktop with warm aubergine and vibrant orange.'
  },

  // --- MINIMAL / CLASSIC (4) ---
  {
    id: 'default',
    name: 'Black on White',
    group: 'minimal',
    preview: { bg: '#ffffff', card: '#f7f7f7', text: '#000000', accent: '#000000', border: '#dddddd' },
    description: 'Clean, timeless Swiss-inspired monochrome.'
  },
  {
    id: 'white-on-black',
    name: 'White on Black',
    group: 'minimal',
    preview: { bg: '#0d0d0d', card: '#1a1a1a', text: '#ffffff', accent: '#ffffff', border: '#333333' },
    description: 'High-contrast pure dark mode with crisp white typography.'
  },
  {
    id: 'nord',
    name: 'Nord',
    group: 'minimal',
    preview: { bg: '#2e3440', card: '#3b4252', text: '#eceff4', accent: '#88c0d0', border: '#4c566a' },
    description: 'Arctic blue-gray palette with very calm, restrained surfaces and subtle depth.'
  },
  {
    id: 'solarized',
    name: 'Solarized',
    group: 'minimal',
    preview: { bg: '#002b36', card: '#073642', text: '#93a1a1', accent: '#2aa198', border: '#586e75' },
    description: 'Carefully calculated color relationships with low glare and muted contrast.'
  },

  // --- DEVELOPER (5) ---
  {
    id: 'dracula',
    name: 'Dracula',
    group: 'developer',
    preview: { bg: '#282a36', card: '#343746', text: '#f8f8f2', accent: '#bd93f9', border: '#6272a4' },
    description: 'Dark theme with balanced purple, pink, cyan, green, and yellow accents.'
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    group: 'developer',
    preview: { bg: '#181825', card: '#1e1e2e', text: '#cdd6f4', accent: '#b4befe', border: '#313244' },
    description: 'Mocha soft dark palette with soothing lavender, pink, and blue tones.'
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    group: 'developer',
    preview: { bg: '#282828', card: '#3c3836', text: '#ebdbb2', accent: '#fe8019', border: '#504945' },
    description: 'Tactile and warm retro groove with charcoal, cream, orange, and gold.'
  },
  {
    id: 'monokai',
    name: 'Monokai',
    group: 'developer',
    preview: { bg: '#1e1f1c', card: '#272822', text: '#f8f8f2', accent: '#a6e22e', border: '#3e3d32' },
    description: 'Dark code-editor contrast with strategic green, pink, yellow, and cyan.'
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    group: 'developer',
    preview: { bg: '#21252b', card: '#282c34', text: '#abb2bf', accent: '#61afef', border: '#3e4451' },
    description: 'Iconic editor atmosphere with charcoal, cool gray, and refined accent roles.'
  },

  // --- EXPRESSIVE (2) ---
  {
    id: 'material-you',
    name: 'Material You',
    group: 'expressive',
    preview: { bg: '#1c1b1f', card: '#2b2930', text: '#e6e1e5', accent: '#d0bcff', border: 'rgba(255,255,255,0.12)' },
    description: 'Dynamic tonal surfaces with rounded cards, expressive accents, and elevation.'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    group: 'expressive',
    preview: { bg: '#0b0c16', card: '#131424', text: '#f0f3ff', accent: '#00f0ff', border: 'rgba(0,240,255,0.22)' },
    description: 'Tactical near-black with restrained neon cyan, magenta, and violet highlights.'
  }
];

const THEME_ALIASES = {
  'black-on-white': 'default'
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
