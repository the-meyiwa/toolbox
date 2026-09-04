/* ============================================================
   TOOLBOX — Centralized File & Folder Type Icon System
   Minimal, coherent vector SVG icons assigned automatically
   based on file extension and artifact kind.
   Strictly zero emojis. Highly readable across all themes.
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

  // Folder
  if (k === 'folder' || ext === 'folder' || name === 'folder') return 'folder';

  // PDF
  if (ext === 'pdf' || k === 'pdf') return 'pdf';

  // Spreadsheets & CSV
  if (ext === 'csv' || ext === 'tsv' || ext === 'xlsx' || ext === 'xls' || k === 'csv' || k === 'spreadsheet') {
    return 'spreadsheet';
  }

  // Word & Rich Documents
  if (ext === 'doc' || ext === 'docx' || ext === 'rtf' || ext === 'odt' || k === 'document') {
    return 'document';
  }

  // Presentations
  if (ext === 'ppt' || ext === 'pptx' || ext === 'odp' || ext === 'key' || k === 'presentation') {
    return 'presentation';
  }

  // Images
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'tiff'].includes(ext) || k === 'image' || k === 'svg') {
    return 'image';
  }

  // JSON
  if (ext === 'json' || ext === 'json5' || ext === 'jsonld' || k === 'json') {
    return 'json';
  }

  // Code & Scripts (All languages map to 'code' as standardized category)
  if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'ipynb', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'sql', 'sh', 'bash', 'c', 'cpp', 'h', 'hpp', 'cc', 'rs', 'go', 'java', 'yaml', 'yml'].includes(ext) || k === 'code' || k === 'html') {
    return 'code';
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || k === 'audio') {
    return 'audio';
  }

  // Video
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) || k === 'video') {
    return 'video';
  }

  // Archives
  if (['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2'].includes(ext) || k === 'archive') {
    return 'archive';
  }

  // Plain Text / Markdown
  if (ext === 'txt' || ext === 'text' || ext === 'log') {
    return 'text';
  }

  if (ext === 'md' || ext === 'markdown' || k === 'markdown') {
    return 'markdown';
  }

  return 'generic';
}

/**
 * Returns clean SVG icon string for the specified file category
 */
export function getFileTypeIcon(filename = '', kind = '', size = 18) {
  const cat = detectFileCategory(filename, kind);
  const s = Number(size) || 18;

  switch (cat) {
    case 'folder':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

    case 'pdf':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-pdf"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;

    case 'spreadsheet':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-spreadsheet"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>`;

    case 'document':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-document"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

    case 'presentation':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-presentation"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

    case 'image':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-image"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

    case 'json':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-json"><path d="M8 3H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2"/><path d="M16 3h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2"/></svg>`;

    case 'code':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-code"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

    case 'audio':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-audio"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

    case 'video':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-video"><rect x="2" y="4" width="20" height="16" rx="2.18"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`;

    case 'archive':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-archive"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;

    case 'markdown':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-markdown"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="7 15 7 9 10 12 13 9 13 15"/><polyline points="17 12 17 15 15 15"/><line x1="17" y1="9" x2="17" y2="12"/></svg>`;

    case 'text':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-text"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`;

    case 'generic':
    default:
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon file-icon-generic"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }
}
