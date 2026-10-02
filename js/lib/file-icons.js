/* ============================================================
   TOOLBOX — File & folder icons

   Every kind of file has its own colour and emblem, so a folder
   reads at a glance: a red PDF with a signature stroke, a green
   sheet with its grid, orange slides, a violet picture, code in
   its language's colour. At 28 px and up the extension is printed
   on a tab across the page; smaller sizes keep only the emblem.
   Folders are two-tone, and the well-known ones (Documents,
   Images, Projects, Downloads…) carry an emblem of their own.

   Pure SVG strings (no ids, no external refs), safe in lists that
   render hundreds of rows. Strictly zero emojis.
   ============================================================ */

/**
 * Maps filename extension or kind to a standardized file category
 */
export function detectFileCategory(filename = '', kind = '') {
  if (kind === true || kind === 'folder' || filename === 'folder') return 'folder';
  if (typeof kind === 'object' && (kind?.isFolder || kind?.isDirectory)) return 'folder';
  const name = String(filename || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const k = String(kind || '').toLowerCase();

  if (k === 'folder' || ext === 'folder' || name === 'folder') return 'folder';
  if (ext === 'pdf' || k === 'pdf') return 'pdf';
  if (['csv', 'tsv', 'xlsx', 'xlsm', 'xls', 'ods', 'numbers'].includes(ext) || k === 'csv' || k === 'spreadsheet') return 'spreadsheet';
  if (['doc', 'docx', 'rtf', 'odt', 'epub', 'pages'].includes(ext) || k === 'document') return 'document';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext) || k === 'presentation') return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'tiff', 'avif', 'heic'].includes(ext) || k === 'image' || k === 'svg') return 'image';
  if (['json', 'json5', 'jsonld'].includes(ext) || k === 'json') return 'json';
  if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'ipynb', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'sql', 'sh', 'bash', 'c', 'cpp', 'h', 'hpp', 'cc', 'rs', 'go', 'java', 'kt', 'swift', 'rb', 'php', 'cs', 'dart', 'lua', 'r', 'yaml', 'yml', 'toml', 'xml', 'vue', 'svelte'].includes(ext) || k === 'code' || k === 'html') return 'code';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'mid', 'midi'].includes(ext) || k === 'audio') return 'audio';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(ext) || k === 'video') return 'video';
  if (['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2', 'xz'].includes(ext) || k === 'archive') return 'archive';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext) || k === 'font') return 'font';
  if (['txt', 'text', 'log', 'ini', 'cfg', 'env'].includes(ext) || k === 'text') return 'text';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx' || k === 'markdown') return 'markdown';
  return 'generic';
}

/* ---------------- emblems (32 × 32 grid, centred near 16,19) ---------------- */
const EMBLEM = {
  sign: '<path d="M10.5 22c1.6-4.2 2.6-7.4 3.6-7.4 1.3 0 .4 6.1 2.3 6.1 1.3 0 1.6-2.2 2.9-2.2.8 0 1.1.9 1.7 1.5"/><path d="M10.5 24.6h11"/>',
  lines: '<path d="M11 15.5h10M11 19h10M11 22.5h6.5"/>',
  grid: '<rect x="10.5" y="14" width="11" height="10" rx="1.2"/><path d="M10.5 17.4h11M10.5 20.7h11M14.3 14v10"/>',
  slides: '<rect x="9.8" y="14" width="12.4" height="9" rx="1.2"/><path d="M13 20.5v-2.2M16 20.5v-4M19 20.5v-3"/>',
  picture: '<rect x="10" y="13.8" width="12" height="10.2" rx="1.6"/><circle cx="13.6" cy="17.2" r="1.2"/><path d="m10.6 23.2 3.8-3.8 2.8 2.8 1.8-1.8 2.4 2.4"/>',
  play: '<path d="M13.6 14.6v8.8l7.2-4.4z" fill="currentColor"/>',
  note: '<path d="M14.2 22.6v-8.3l6.8-1.5v8.3"/><circle cx="12.7" cy="22.6" r="1.6"/><circle cx="19.5" cy="21.1" r="1.6"/>',
  code: '<path d="m13 15.2-3.6 3.8 3.6 3.8M19 15.2l3.6 3.8-3.6 3.8"/>',
  braces: '<path d="M13.6 14.2c-1.5 0-2.1.7-2.1 2.1v1.3c0 .9-.5 1.4-1.4 1.4.9 0 1.4.5 1.4 1.4v1.3c0 1.4.6 2.1 2.1 2.1M18.4 14.2c1.5 0 2.1.7 2.1 2.1v1.3c0 .9.5 1.4 1.4 1.4-.9 0-1.4.5-1.4 1.4v1.3c0 1.4-.6 2.1-2.1 2.1"/>',
  zip: '<path d="M16 3.4v1.6M16 6.6v1.6M16 9.8v1.6"/><rect x="13.8" y="13.2" width="4.4" height="6" rx="1.2"/><path d="M16 16.4v1"/>',
  markdown: '<path d="M10 22.6v-7l3 3.6 3-3.6v7M19.6 15.6v7M17.6 20.6l2 2 2-2"/>',
  font: '<path d="m10.6 23.4 4-9.8h.8l4 9.8M12 20.2h6"/><path d="M20.8 16.8v6.6M20.8 19.6c0-1.6 1-2.8 2.4-2.8"/>',
  dots: '<circle cx="12.4" cy="19.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="19.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="19.6" cy="19.5" r="1.1" fill="currentColor" stroke="none"/>',
  /* folder emblems */
  house: '<path d="M11.4 19.6 16 15.6l4.6 4V24h-9.2z"/><path d="M14.6 24v-2.6h2.8V24"/>',
  down: '<path d="M16 14.4v8.2M12.6 19.4 16 22.8l3.4-3.4"/>',
  spark: '<path d="M16 13.6l1.3 3.6 3.6 1.3-3.6 1.3-1.3 3.6-1.3-3.6-3.6-1.3 3.6-1.3z"/>',
  share: '<circle cx="12.2" cy="19" r="1.7"/><circle cx="19.6" cy="15.6" r="1.7"/><circle cx="19.6" cy="22.4" r="1.7"/><path d="m13.8 18.2 4.2-1.9M13.8 19.8l4.2 1.9"/>',
  box: '<path d="M11 16.2h10v6.6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z"/><path d="M10.4 14.2h11.2v2H10.4zM14.4 19h3.2"/>',
};

/* ---------------- what each kind looks like ---------------- */
const KIND = {
  pdf:          { color: '#E5484D', emblem: 'sign' },
  document:     { color: '#2F6FEB', emblem: 'lines' },
  spreadsheet:  { color: '#2B9A66', emblem: 'grid' },
  presentation: { color: '#E8701A', emblem: 'slides' },
  image:        { color: '#8E4EC6', emblem: 'picture' },
  video:        { color: '#0B8FB8', emblem: 'play' },
  audio:        { color: '#D6409F', emblem: 'note' },
  code:         { color: '#4A5568', emblem: 'code' },
  json:         { color: '#C98A00', emblem: 'braces' },
  archive:      { color: '#A0703C', emblem: 'zip' },
  markdown:     { color: '#30363D', emblem: 'markdown' },
  font:         { color: '#6E56CF', emblem: 'font' },
  text:         { color: '#6B7280', emblem: 'lines' },
  generic:      { color: '#8B8D98', emblem: 'dots' },
};
/* Code takes its language's own colour, so a folder of sources is easy to scan. */
const EXT_COLOR = {
  html: '#E34F26', htm: '#E34F26', css: '#2965F1', scss: '#C6538C', sass: '#C6538C', less: '#1D365D',
  js: '#C9A400', mjs: '#C9A400', cjs: '#C9A400', jsx: '#0EA5C6', ts: '#3178C6', tsx: '#3178C6',
  py: '#3572A5', ipynb: '#DA5B0B', sql: '#D9822B', sh: '#2F3E46', bash: '#2F3E46', rs: '#B7410E', go: '#00ADD8',
  java: '#B07219', kt: '#7F52FF', swift: '#F05138', rb: '#CC342D', php: '#777BB4', cs: '#178600', dart: '#00B4AB',
  c: '#555F6D', cpp: '#F34B7D', h: '#555F6D', hpp: '#F34B7D', vue: '#41B883', svelte: '#FF3E00',
  yaml: '#CB171E', yml: '#CB171E', toml: '#9C4221', xml: '#0060AC', csv: '#2B9A66', tsv: '#2B9A66',
};

const PAGE = 'M8.5 2.6h10.4c.6 0 1.1.2 1.5.6l6.2 6.2c.4.4.6.9.6 1.5V27a2.4 2.4 0 0 1-2.4 2.4H8.5A2.4 2.4 0 0 1 6.1 27V5a2.4 2.4 0 0 1 2.4-2.4z';
const FOLD = 'M18.8 2.9V8.2a1.9 1.9 0 0 0 1.9 1.9h5.3';

function fileIcon(cat, ext, size) {
  const style = KIND[cat] || KIND.generic;
  const color = (cat === 'code' || cat === 'spreadsheet') && EXT_COLOR[ext] ? EXT_COLOR[ext] : style.color;
  const label = size >= 28 && ext ? ext.slice(0, 4).toUpperCase() : '';
  const tabW = label ? Math.max(12, label.length * 4.1 + 5) : 0;
  // With a tab across the page the emblem moves up to make room.
  const lift = label ? ' transform="translate(0 -3.8)"' : '';
  // Small icons draw heavier lines so the emblem still reads in a list row.
  const edge = size < 24 ? 1.7 : 1.35, mark = size < 24 ? 2.1 : 1.55;
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" class="file-icon file-icon-${cat}" style="color:${color}" aria-hidden="true">`
    + `<path d="${PAGE}" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="${edge}" stroke-linejoin="round"/>`
    + `<path d="${FOLD}" fill="currentColor" fill-opacity=".24" stroke="currentColor" stroke-width="${edge}" stroke-linejoin="round"/>`
    + `<g stroke="currentColor" stroke-width="${mark}" stroke-linecap="round" stroke-linejoin="round"${lift}>${EMBLEM[style.emblem] || ''}</g>`
    + (label ? `<rect x="2.6" y="21.4" width="${tabW.toFixed(1)}" height="7.2" rx="1.8" fill="currentColor"/><text x="${(2.6 + tabW / 2).toFixed(1)}" y="26.75" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="5.3" font-weight="750" letter-spacing=".2" fill="#fff">${label}</text>` : '')
    + '</svg>';
}

/* Well-known folders carry an emblem on their front flap. */
const FOLDER_EMBLEM = [
  [/^(home)$/i, 'house'], [/^(documents?|docs|papers)$/i, 'lines'], [/^(images?|pictures?|photos?|screenshots?)$/i, 'picture'],
  [/^(music|audio|sounds?|podcasts?)$/i, 'note'], [/^(videos?|movies?|clips?)$/i, 'play'], [/^(projects?|code|src|source|dev|repos?)$/i, 'code'],
  [/^(downloads?)$/i, 'down'], [/^(assistant|ai)$/i, 'spark'], [/^(shared|public|team)$/i, 'share'], [/^(archives?|backups?|old)$/i, 'box'],
  [/^(spreadsheets?|sheets|data|finance|budgets?)$/i, 'grid'], [/^(presentations?|slides|decks?)$/i, 'slides'],
];
const FOLDER_COLOR = '#4C82F7';

function folderIcon(name, size) {
  const base = String(name || '').split('/').filter(Boolean).pop() || '';
  const emblem = FOLDER_EMBLEM.find(([re]) => re.test(base))?.[1];
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" class="file-icon file-icon-folder" style="color:${FOLDER_COLOR}" aria-hidden="true">`
    + '<path d="M3 8.4A2.4 2.4 0 0 1 5.4 6h6.3c.6 0 1.2.3 1.6.8L15.4 9h11.2A2.4 2.4 0 0 1 29 11.4v13.2A2.4 2.4 0 0 1 26.6 27H5.4A2.4 2.4 0 0 1 3 24.6z" fill="currentColor" fill-opacity=".55"/>'
    + '<path d="M3 13.2a2.4 2.4 0 0 1 2.4-2.4h21.2A2.4 2.4 0 0 1 29 13.2v11.4A2.4 2.4 0 0 1 26.6 27H5.4A2.4 2.4 0 0 1 3 24.6z" fill="currentColor"/>'
    + '<path d="M5 11.6h22" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>'
    + (emblem && size >= 16 ? `<g stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="#fff" transform="translate(0 .4)">${EMBLEM[emblem]}</g>` : '')
    + '</svg>';
}

/** The colour that represents a file's kind (for tints around previews and tiles). */
export function getFileTypeColor(filename = '', kind = '') {
  const cat = detectFileCategory(filename, kind);
  if (cat === 'folder') return FOLDER_COLOR;
  const ext = String(filename || '').toLowerCase().split('.').pop();
  return (cat === 'code' || cat === 'spreadsheet') && EXT_COLOR[ext] ? EXT_COLOR[ext] : (KIND[cat] || KIND.generic).color;
}

/**
 * Returns the SVG icon for a file or folder.
 * @param {string} filename  name (or path) of the item
 * @param {string|boolean|object} kind  'folder' for folders, or the item's kind
 * @param {number} size  pixel size
 */
export function getFileTypeIcon(filename = '', kind = '', size = 18) {
  const s = Number(size) || 18;
  const cat = detectFileCategory(filename, kind);
  if (cat === 'folder') return folderIcon(filename, s);
  const name = String(filename || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop().replace(/[^a-z0-9]/g, '') : '';
  return fileIcon(cat, ext, s);
}
