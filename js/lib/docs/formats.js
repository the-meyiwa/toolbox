/* ============================================================
   Document formats — which family a file belongs to, which editor
   opens it, and what it saves back as.

   Pure data and string helpers, so the File Explorer can ask these
   questions without loading any of the heavy parsers.
   ============================================================ */

/**
 * @typedef {'document'|'spreadsheet'|'presentation'|'pdf'|'ebook'} DocFamily
 */

/** Every document extension the toolbox reads, with its family and label. */
export const DOC_FORMATS = {
  docx: { family: 'document', label: 'Word-processor document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc:  { family: 'document', label: 'Legacy document', mime: 'application/msword', legacy: true },
  odt:  { family: 'document', label: 'OpenDocument text', mime: 'application/vnd.oasis.opendocument.text' },
  rtf:  { family: 'document', label: 'Rich text document', mime: 'application/rtf' },
  md:   { family: 'document', label: 'Markdown document', mime: 'text/markdown', text: true },
  markdown: { family: 'document', label: 'Markdown document', mime: 'text/markdown', text: true },
  txt:  { family: 'document', label: 'Plain text', mime: 'text/plain', text: true },

  xlsx: { family: 'spreadsheet', label: 'Spreadsheet', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xlsm: { family: 'spreadsheet', label: 'Spreadsheet with macros', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12' },
  xls:  { family: 'spreadsheet', label: 'Legacy spreadsheet', mime: 'application/vnd.ms-excel', legacy: true },
  ods:  { family: 'spreadsheet', label: 'OpenDocument spreadsheet', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  csv:  { family: 'spreadsheet', label: 'CSV table', mime: 'text/csv', text: true },
  tsv:  { family: 'spreadsheet', label: 'TSV table', mime: 'text/tab-separated-values', text: true },

  pptx: { family: 'presentation', label: 'Presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  ppt:  { family: 'presentation', label: 'Legacy presentation', mime: 'application/vnd.ms-powerpoint', legacy: true },
  odp:  { family: 'presentation', label: 'OpenDocument presentation', mime: 'application/vnd.oasis.opendocument.presentation' },

  pdf:  { family: 'pdf', label: 'PDF document', mime: 'application/pdf' },
  epub: { family: 'ebook', label: 'EPUB e-book', mime: 'application/epub+zip' },
};

/** The editor tool that owns each family. PDFs keep the PDF Editor. */
export const EDITOR_FOR_FAMILY = {
  document: 'scribe',
  spreadsheet: 'ledger',
  presentation: 'podium',
  pdf: 'pdf-editor',
};

/**
 * Formats each editor can write. A legacy binary format is read and then
 * saved as its modern sibling, because writing the old binary layouts
 * would silently lose content.
 */
export const SAVE_FORMATS = {
  scribe: ['docx', 'odt', 'rtf', 'md', 'txt', 'html'],
  ledger: ['xlsx', 'xls', 'ods', 'csv', 'tsv'],
  podium: ['pptx', 'odp'],
};

const LEGACY_SAVE_AS = { doc: 'docx', ppt: 'pptx', xlsm: 'xlsx' };

/** Formats the File Explorer previews through the document readers. */
export const RICH_PREVIEW = new Set(['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xlsm', 'xls', 'ods', 'pptx', 'ppt', 'odp', 'epub']);

export function hasRichPreview(name) {
  return RICH_PREVIEW.has(extOf(name));
}

export function extOf(name = '') {
  const s = String(name).toLowerCase();
  const i = s.lastIndexOf('.');
  return i > 0 && i < s.length - 1 ? s.slice(i + 1) : '';
}

export function stemOf(name = '') {
  const s = String(name);
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(0, i) : s;
}

/** @returns {DocFamily|null} */
export function docFamily(name = '') {
  return DOC_FORMATS[extOf(name)]?.family ?? null;
}

export function isDocFormat(name = '') {
  return extOf(name) in DOC_FORMATS;
}

/** Tool id of the editor for a file, or null. */
export function editorFor(name = '') {
  const family = docFamily(name);
  return family ? EDITOR_FOR_FAMILY[family] ?? null : null;
}

export function mimeFor(name = '') {
  return DOC_FORMATS[extOf(name)]?.mime ?? 'application/octet-stream';
}

/**
 * The format an editor writes when saving a file it opened. Same format
 * where the editor can write it, otherwise the modern sibling.
 */
export function saveFormatFor(name, editor) {
  const ext = extOf(name);
  const allowed = SAVE_FORMATS[editor] ?? [];
  if (allowed.includes(ext)) return ext;
  if (ext === 'markdown') return 'md';
  if (LEGACY_SAVE_AS[ext] && allowed.includes(LEGACY_SAVE_AS[ext])) return LEGACY_SAVE_AS[ext];
  return allowed[0] ?? ext;
}

/** File name to save under: the same name unless the format had to change. */
export function saveNameFor(name, editor) {
  const target = saveFormatFor(name, editor);
  return extOf(name) === target ? name : `${stemOf(name) || 'Untitled'}.${target}`;
}
