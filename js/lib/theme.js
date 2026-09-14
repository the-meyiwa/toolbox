/* ============================================================
   TOOLBOX — Theme Management Engine
   Supports 28 canonical themes across System, Minimal, Cultural, Brand, and Expressive
   ============================================================ */

export const THEMES = [
  // --- SYSTEM (4) ---
  {
    id: 'yosemite',
    name: 'Yosemite',
    group: 'system',
    preview: { bg: '#e8ecf2', surface: '#ffffff', card: '#ffffff', text: '#1d1d1f', accent: '#007aff', border: 'rgba(0,0,0,0.12)' },
    description: 'Translucent glass surfaces, subtle blur, and Apple system blue.'
  },
  {
    id: 'yosemite-night',
    name: 'Yosemite Night',
    group: 'system',
    preview: { bg: '#14171d', surface: '#1c212a', card: '#1c212a', text: '#f5f5f7', accent: '#0a84ff', border: 'rgba(255,255,255,0.12)' },
    description: 'Dark translucent glass, deep contrast, and luminous Apple system blue.'
  },
  {
    id: 'linux-mint',
    name: 'Linux Mint',
    group: 'system',
    preview: { bg: '#2f343f', surface: '#262930', card: '#262930', text: '#f3f4f6', accent: '#87cf3e', border: 'rgba(255,255,255,0.08)' },
    description: 'Clean desktop palette with signature Mint leaf-green accents.'
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    group: 'system',
    preview: { bg: '#242424', surface: '#2c2c2c', card: '#2c2c2c', text: '#f7f7f7', accent: '#e95420', border: 'rgba(255,255,255,0.09)' },
    description: 'Modern desktop palette with signature Ubuntu aubergine and warm orange.'
  },

  // --- MINIMAL (3) ---
  {
    id: 'default',
    name: 'Black on White',
    group: 'minimal',
    preview: { bg: '#ffffff', surface: '#ffffff', card: '#ffffff', text: '#000000', accent: '#000000', border: '#dddddd' },
    description: 'Pure high-contrast minimalism inspired by classic Swiss typography.'
  },
  {
    id: 'white-on-black',
    name: 'White on Black',
    group: 'minimal',
    preview: { bg: '#000000', surface: '#111111', card: '#111111', text: '#ffffff', accent: '#ffffff', border: '#262626' },
    description: 'Pitch-black darkroom aesthetic with sharp monochromatic precision.'
  },
  {
    id: 'swiss',
    name: 'Swiss / International Style',
    group: 'minimal',
    preview: { bg: '#f4f4f4', surface: '#ffffff', card: '#ffffff', text: '#111111', accent: '#ff0000', border: '#d1d5db' },
    description: 'Rigorous objective typography, architectural light gray, and strict Swiss red accent.'
  },

  // --- CULTURAL / DESIGN (10) ---
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    group: 'cultural',
    preview: { bg: '#f7f4ea', surface: '#ffffff', card: '#ffffff', text: '#121212', accent: '#d62828', border: '#dcd5c4' },
    description: 'Warm off-white parchment, bold primary red, deep blue, and geometric harmony.'
  },
  {
    id: 'mondrian',
    name: 'Mondrian / De Stijl',
    group: 'cultural',
    preview: { bg: '#fcfbfa', surface: '#ffffff', card: '#ffffff', text: '#0a0a0a', accent: '#df2020', border: '#1a1a1a' },
    description: 'De Stijl canvas defined by structural black outlines and pure primary red and blue.'
  },
  {
    id: 'memphis',
    name: 'Memphis',
    group: 'cultural',
    preview: { bg: '#fef7ff', surface: '#ffffff', card: '#ffffff', text: '#1e1428', accent: '#00d2c4', border: '#e2d0f0' },
    description: 'Playful Italian post-modernism with vibrant turquoise, hot pink, and lilac undertones.'
  },
  {
    id: 'art-deco',
    name: 'Art Deco',
    group: 'cultural',
    preview: { bg: '#111417', surface: '#1a1f24', card: '#1a1f24', text: '#f3eed9', accent: '#d4af37', border: 'rgba(218,165,32,0.25)' },
    description: '1920s luxury black slate, antique gold metallic trim, and rich cream typography.'
  },
  {
    id: 'mid-century',
    name: 'Mid-Century Modern',
    group: 'cultural',
    preview: { bg: '#f5f0e8', surface: '#ffffff', card: '#ffffff', text: '#2c2621', accent: '#d97724', border: '#d9cfc1' },
    description: 'Warm linen, burnt orange, olive avocado accents, and organic tactile geometry.'
  },
  {
    id: 'japanese-traditional',
    name: 'Japanese Traditional',
    group: 'cultural',
    preview: { bg: '#f8f6f0', surface: '#ffffff', card: '#ffffff', text: '#1a202c', accent: '#1b3b6f', border: '#ded9cf' },
    description: 'Washi cream, sumi ink charcoal, aizome indigo, and refined vermilion accents.'
  },
  {
    id: 'lagos',
    name: 'Lagos',
    group: 'cultural',
    preview: { bg: '#0f1a14', surface: '#16261d', card: '#16261d', text: '#f0faf4', accent: '#00a859', border: 'rgba(0,168,89,0.22)' },
    description: 'Energetic modern Nigerian aesthetic with vibrant emerald green and warm solar gold.'
  },
  {
    id: 'african-textile',
    name: 'African Textile',
    group: 'cultural',
    preview: { bg: '#1c1815', surface: '#27211d', card: '#27211d', text: '#f5efe6', accent: '#d98224', border: 'rgba(217,131,36,0.25)' },
    description: 'West African kente traditions with rich mahogany, earthen ochre gold, and terracotta.'
  },
  {
    id: 'british-racing-green',
    name: 'British Racing Green',
    group: 'cultural',
    preview: { bg: '#0b1712', surface: '#12241c', card: '#12241c', text: '#f4f0e6', accent: '#237844', border: 'rgba(201,162,79,0.25)' },
    description: 'Deep automotive racing green, warm vintage cream, and brushed brass gold borders.'
  },
  {
    id: 'wimbledon',
    name: 'Wimbledon',
    group: 'cultural',
    preview: { bg: '#101913', surface: '#17251c', card: '#17251c', text: '#f7fbf8', accent: '#662d91', border: 'rgba(102,45,145,0.35)' },
    description: 'Deep championship court green, understated crisp white, and royal purple trim.'
  },

  // --- BRAND-INSPIRED (10) ---
  {
    id: 'barbie',
    name: 'Barbie',
    group: 'brand',
    preview: { bg: '#fff5f9', surface: '#ffffff', card: '#ffffff', text: '#28141e', accent: '#e0218a', border: '#ffd1e6' },
    description: 'Culturally recognizable bubblegum and hot pink palette with bright polished contrast.'
  },
  {
    id: 'tiffany',
    name: 'Tiffany',
    group: 'brand',
    preview: { bg: '#f3fbfb', surface: '#ffffff', card: '#ffffff', text: '#142828', accent: '#0abab5', border: '#c5ecea' },
    description: 'Iconic robin’s-egg cyan blue, luminous frosted white, and refined silver accents.'
  },
  {
    id: 'coca-cola',
    name: 'Coca-Cola',
    group: 'brand',
    preview: { bg: '#121212', surface: '#1c1c1c', card: '#1c1c1c', text: '#ffffff', accent: '#f40009', border: 'rgba(255,255,255,0.1)' },
    description: 'Sleek dark charcoal foundation with signature controlled red accent and crisp white.'
  },
  {
    id: 'mcdonalds',
    name: 'McDonald’s',
    group: 'brand',
    preview: { bg: '#1a1614', surface: '#25201c', card: '#25201c', text: '#fdfbf7', accent: '#ffc72c', border: 'rgba(255,199,44,0.22)' },
    description: 'Warm espresso charcoal background with golden yellow arch highlights and warm red.'
  },
  {
    id: 'lego',
    name: 'LEGO',
    group: 'brand',
    preview: { bg: '#fdfdfd', surface: '#ffffff', card: '#ffffff', text: '#18181b', accent: '#d01012', border: '#e4e4e7' },
    description: 'Crisp bright canvas with playful primary red, blue, and yellow geometric accents.'
  },
  {
    id: 'nintendo',
    name: 'Nintendo',
    group: 'brand',
    preview: { bg: '#fafafa', surface: '#ffffff', card: '#ffffff', text: '#1c1c1f', accent: '#e60012', border: '#dedfe4' },
    description: 'Cheerful, clean, and polished light gray with signature Nintendo red accents.'
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    group: 'brand',
    preview: { bg: '#0a0f1d', surface: '#11182c', card: '#11182c', text: '#f2f5fc', accent: '#0070d1', border: 'rgba(0,112,209,0.28)' },
    description: 'Deep universe midnight navy with iconic PlayStation blue and subtle action accents.'
  },
  {
    id: 'ikea',
    name: 'IKEA',
    group: 'brand',
    preview: { bg: '#f7f9fc', surface: '#ffffff', card: '#ffffff', text: '#1a202c', accent: '#0058a3', border: '#cbd5e1' },
    description: 'Scandinavian clean functional design with IKEA blue and warm yellow highlights.'
  },
  {
    id: 'google',
    name: 'Google',
    group: 'brand',
    preview: { bg: '#ffffff', surface: '#ffffff', card: '#ffffff', text: '#202124', accent: '#1a73e8', border: '#dadce0' },
    description: 'Familiar four-color harmony with clean white surfaces and Google system blue.'
  },
  {
    id: 'claude',
    name: 'Claude',
    group: 'brand',
    preview: { bg: '#fbf8f3', surface: '#ffffff', card: '#ffffff', text: '#2c2724', accent: '#c25e2e', border: '#dfd5c7' },
    description: 'Calm literary editorial atmosphere with warm linen, soft beige, and terracotta accent.'
  },

  // --- EXPRESSIVE (1) ---
  {
    id: 'miami-vice',
    name: 'Miami Vice',
    group: 'expressive',
    preview: { bg: '#0e101f', surface: '#171b30', card: '#171b30', text: '#fdf6fc', accent: '#00f0ff', border: 'rgba(0,240,255,0.22)' },
    description: '1980s neon aesthetic with glowing cyan, vibrant magenta, and deep violet navy.'
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
