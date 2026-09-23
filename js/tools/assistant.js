/* ============================================================
   TOOLBOX — Assistant

   Chat agent UI on top of js/lib/ai-provider.js:
   - conversation sidebar (history, search, rename, delete,
     local + cloud persistence via lib/assistant/conversations.js)
   - message column: user bubbles, full-width assistant prose
   - live reply: thinking (animated, then "Thought for 6s"),
     a step timeline for tool calls, a live plan card, result
     cards in order, streaming Markdown with math and code
   - composer: growing textarea, attachments (drop, paste,
     picker, Toolbox Files), mode picker, send / stop
   ============================================================ */

import { tbConfirm, tbPrompt, tbAlert } from '../lib/dialog.js';
import { streamChatCompletion, getActiveAiMode, setActiveAiMode, AI_MODES } from '../lib/ai-provider.js';
import { QuotaManager } from '../lib/quota-manager.js';
import { getCurrentUser } from '../lib/supabase.js';
import { openAccountModal } from '../views/account-modal.js';
import { AssistantAudioManager } from '../lib/assistant-audio.js';
import { ConversationIntegrationManager } from '../lib/assistant-integration.js';
import { isPlainTextResult } from '../lib/assistant-result-renderer.js';
import { ToolboxFilesystem, fs } from '../lib/filesystem.js';
import { renderMarkdown, patchHtml, handleMarkdownClick, cleanReplyText } from '../lib/assistant/markdown.js';
import { ConversationStore, newId } from '../lib/assistant/conversations.js';
import '../lib/assistant/renderers.js';

/* Files from Toolbox Files arrive as raw bytes. */
function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript', py: 'text/x-python', xml: 'application/xml', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip' };
function mimeFromName(name = '') { return MIME_BY_EXT[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream'; }


/* ---------------- helpers ---------------- */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/>',
  compose: '<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  clip: '<path d="m20.5 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  spark: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9z"/>',
  // tool icons
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  chess: '<path d="M8 21h8M9 17h6l1 4H8z"/><path d="M9.5 17c0-3-1.5-4.5-1.5-7.5A4 4 0 0 1 12 5.5c2.5 0 4 1.8 4 4.2 0 1.4-.6 2.3-1.8 2.8L15 17"/>',
  device: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3 12h18v4.5H3z"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5"/><path d="m3.5 12 1.5 1.5L7.5 11"/><circle cx="5" cy="18" r="1.3"/>',
  body: '<circle cx="12" cy="5" r="2"/><path d="M12 7v7M8 10h8M9.5 21l2.5-7 2.5 7"/>',
};
const icon = (name, size = 18, sw = 1.8) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.spark}</svg>`;
const STOP_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
const GLYPH = '<span class="ast-glyph" aria-hidden="true"><i class="ast-glyph-core"></i><i class="ast-glyph-ring r1"><b></b><b></b><b></b></i><i class="ast-glyph-ring r2"><b></b></i></span>';

/* ---------------- tool labels ---------------- */

export function formatToolProgressStatus(toolName, toolArgs = {}) {
  switch (toolName) {
    case 'search_places_nearby': return `Searching verified places for "${toolArgs?.query || 'locations'}"...`;
    case 'render_map': return 'Rendering interactive map...';
    case 'search_web':
    case 'browse_web': return `Searching the web for "${toolArgs?.query || toolArgs?.url || 'information'}"...`;
    case 'search_images': return `Searching verified images for "${toolArgs?.query || 'subject'}"...`;
    case 'browser_navigate': return `Navigating to ${toolArgs?.url || 'requested site'}...`;
    case 'browser_scrape': return `Extracting structured content from ${hostOf(toolArgs?.url) || 'website'}...`;
    case 'browser_extract_images': return `Extracting images and media from ${hostOf(toolArgs?.url) || 'webpage'}...`;
    case 'browser_crawl': return `Crawling pages across ${hostOf(toolArgs?.url) || 'site'}...`;
    case 'calculate_math': {
      const op = String(toolArgs?.operation || '').toLowerCase();
      if (op === 'collatz') return 'Calculating Collatz sequence and trajectory...';
      if (op === 'graph' || op === 'plot') return 'Generating mathematical function plot...';
      if (op === 'newton_raphson') return 'Computing Newton-Raphson numerical roots...';
      if (op === 'ode' || op === 'euler_ode' || op === 'ode_rk4') return 'Computing numerical ODE trajectory...';
      if (op === 'linear_regression') return 'Computing linear regression and metrics...';
      if (/^matrix|eigen|solve_system/.test(op)) return 'Performing matrix linear algebra...';
      if (/integral/.test(op)) return 'Evaluating the integral...';
      if (/derivative/.test(op)) return 'Differentiating...';
      return 'Performing mathematical computation...';
    }
    case 'query_math_knowledge': return 'Consulting mathematical knowledge base...';
    case 'generate_csv': return 'Building and verifying CSV dataset...';
    case 'create_file':
    case 'save_file':
    case 'save_toolbox_artifact': return 'Saving file to workspace artifacts...';
    case 'play_sound': return `Finding audio tracks for "${toolArgs?.query || 'audio'}"...`;
    case 'calendar_add_event':
    case 'calendar_get_events': return 'Updating calendar and schedule...';
    case 'execute_code':
    case 'code_execute': return 'Running sandboxed code execution...';
    case 'explore_anatomy': return `Isolating 3D anatomical structure: ${toolArgs?.structure || ''}...`;
    default: return 'Processing request...';
  }
}

function hostOf(url) { try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { return ''; } }

const TOOL_META = {
  update_plan: ['plan', 'Updating the plan', 'Updated the plan'],
  chess_analyze: ['chess', 'Analysing the position', 'Analysed the position'],
  chess_play: ['chess', 'Playing a move', 'Played a move'],
  chess_open_board: ['chess', 'Opening the Chess board', 'Opened the Chess board'],
  device_specs: ['device', 'Looking up device specs', 'Looked up device specs'],
  device_compare: ['device', 'Comparing devices', 'Compared devices'],
  vehicle_lookup: ['car', 'Looking up the vehicle', 'Looked up the vehicle'],
  create_note: ['note', 'Writing a note', 'Saved a note'],
  update_note: ['note', 'Updating a note', 'Updated a note'],
  list_notes: ['note', 'Reading your notes', 'Read your notes'],
  get_note: ['note', 'Opening a note', 'Opened a note'],
  draw_illustration: ['pen', 'Drawing', 'Drew an illustration'],
  illustrator: ['pen', 'Drawing', 'Drew an illustration'],
  find_toolbox_tools: ['search', 'Finding the right tool', 'Found matching tools'],
  lookup_toolbox_tool: ['search', 'Finding the right tool', 'Found matching tools'],
  run_toolbox_tool: ['tool', 'Running a Toolbox tool', 'Ran a Toolbox tool'],
  open_toolbox_tool: ['tool', 'Opening a tool', 'Opened a tool'],
  calculate_math: ['sigma', 'Calculating', 'Calculated'],
  evaluate_math_expression: ['sigma', 'Calculating', 'Calculated'],
  query_math_knowledge: ['sigma', 'Checking the math library', 'Checked the math library'],
  calculate_chemistry: ['flask', 'Working through the chemistry', 'Worked through the chemistry'],
  explore_elements: ['flask', 'Looking up elements', 'Looked up elements'],
  calculate_financial: ['chart', 'Running the numbers', 'Ran the numbers'],
  browse_web: ['globe', 'Searching the web', 'Searched the web'],
  search_web: ['globe', 'Searching the web', 'Searched the web'],
  web_search: ['globe', 'Searching the web', 'Searched the web'],
  browser_navigate: ['globe', 'Opening a page', 'Read a page'],
  browser_scrape: ['globe', 'Reading a page', 'Read a page'],
  browser_crawl: ['globe', 'Crawling the site', 'Crawled the site'],
  browser_extract_images: ['image', 'Collecting images', 'Collected images'],
  search_images: ['image', 'Finding images', 'Found images'],
  generate_csv: ['table', 'Building a CSV', 'Built a CSV'],
  csv_analyze_and_chart: ['chart', 'Analysing the data', 'Analysed the data'],
  visualize_data: ['chart', 'Charting the data', 'Charted the data'],
  create_file: ['file', 'Creating a file', 'Created a file'],
  save_file: ['file', 'Saving to Files', 'Saved to Files'],
  save_toolbox_artifact: ['file', 'Saving to Files', 'Saved to Files'],
  read_file: ['file', 'Reading a file', 'Read a file'],
  list_files: ['folder', 'Listing your files', 'Listed your files'],
  pdf_process: ['file', 'Processing the PDF', 'Processed the PDF'],
  code_execute: ['code', 'Running code', 'Ran code'],
  execute_code: ['code', 'Running code', 'Ran code'],
  ide_write_file: ['code', 'Writing code', 'Wrote code'],
  ide_create_project: ['code', 'Creating a project', 'Created a project'],
  ide_build_and_preview: ['code', 'Building the app', 'Built the app'],
  ide_run_command: ['code', 'Running a command', 'Ran a command'],
  ide_run_tests: ['code', 'Running tests', 'Ran tests'],
  search_places_nearby: ['pin', 'Finding places', 'Found places'],
  render_map: ['pin', 'Drawing a map', 'Drew a map'],
  get_current_location: ['pin', 'Finding your location', 'Found your location'],
  play_sound: ['music', 'Finding audio', 'Found audio'],
  calendar_add_event: ['calendar', 'Adding to your calendar', 'Added to your calendar'],
  calendar_get_events: ['calendar', 'Checking your calendar', 'Checked your calendar'],
  weather_forecast: ['cloud', 'Checking the weather', 'Checked the weather'],
  bible_quran_lookup: ['book', 'Reading scripture', 'Read scripture'],
  explore_anatomy: ['body', 'Opening the anatomy model', 'Opened the anatomy model'],
  search_diseases: ['body', 'Searching the disease database', 'Searched the disease database'],
};

const humanize = (name) => String(name || 'tool').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

function toolMeta(name, args = {}, done = false) {
  const m = TOOL_META[name];
  let label;
  if (m) label = done ? m[2] : m[1];
  else {
    const legacy = formatToolProgressStatus(name, args);
    label = legacy !== 'Processing request...' ? legacy.replace(/\.\.\.$/, '').replace(/\s*"[^"]*"$/, '') : humanize(name);
  }
  return { icon: m?.[0] || 'tool', label };
}

function toolDetail(name, a = {}) {
  if (!a || typeof a !== 'object') return '';
  if (name === 'device_compare' && a.a && a.b) return `${a.a} vs ${a.b}`;
  if (name === 'update_plan') return a.title || '';
  if (/^chess_/.test(name)) {
    if (Array.isArray(a.moves) && a.moves.length) return a.moves.length > 8 ? `${a.moves.slice(0, 8).join(' ')} …` : a.moves.join(' ');
    if (a.pgn) return 'PGN game';
    if (a.fen) return a.fen.split(' ')[0];
  }
  if (name === 'calculate_math') return [a.operation, a.expression].filter(Boolean).join(' · ');
  const v = a.query || a.url || a.expression || a.title || a.tool_id || a.structure || a.formula || a.reference || a.passage || a.path || a.filename || a.name || a.language || '';
  return typeof v === 'string' ? v : '';
}

function fmtDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function compactJson(value, limit = 4000) {
  const seen = new WeakSet();
  let text;
  try {
    text = JSON.stringify(value, (k, v) => {
      if (k === 'svg' && typeof v === 'string') return `[SVG, ${v.length} characters]`;
      if (typeof v === 'string' && /^data:[\w/+.-]+;base64,/.test(v) && v.length > 200) return `[data, ${Math.round(v.length * 0.75 / 1024)} KB]`;
      if (typeof v === 'string' && v.length > 1200) return `${v.slice(0, 1200)}… (${v.length - 1200} more)`;
      if (v && typeof v === 'object') { if (seen.has(v)) return '[circular]'; seen.add(v); }
      return v;
    }, 2);
  } catch { text = String(value); }
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}

const isFailed = (r) => r && (r.status === 'error' || r.success === false);

/* ---------------- suggestions ---------------- */

const SUGGESTIONS = [
  { icon: 'chess', title: 'Analyse a chess position', sub: 'Two Knights Defence, 4.Ng5', prompt: 'Analyse the position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5. What is the best move for Black, and is 4...Nxe4 a mistake?' },
  { icon: 'device', title: 'Compare two phones', sub: 'iPhone 17 Pro vs Galaxy S25 Ultra', prompt: 'Compare the iPhone 17 Pro and the Samsung Galaxy S25 Ultra. Which is better for photography and battery life?' },
  { icon: 'sigma', title: 'Solve a hard integral', sub: 'Step by step, then verified', prompt: 'Evaluate $\\int_0^\\infty x^2 e^{-x} \\sin x \\, dx$ step by step, then verify the result numerically.' },
  { icon: 'table', title: 'Research and make a CSV', sub: 'Live prices, with sources', prompt: 'Research the current prices of five popular laptops in Nigeria on the web and put them in a CSV with the source for each price.' },
  { icon: 'pen', title: 'Draw an illustration', sub: 'A lighthouse at dusk', prompt: 'Draw a minimalist line illustration of a lighthouse at dusk.' },
  { icon: 'code', title: 'Build a small app', sub: 'A focus timer in the Playground', prompt: 'Build a small Pomodoro focus timer web app in the Code Playground, with start, pause and reset.' },
  { icon: 'book', title: 'Read a scripture passage', sub: 'Psalm 23 and Al-Fatiha', prompt: 'Read Psalm 23 and Surah Al-Fatiha, and give a short reflection on each.' },
  { icon: 'file', title: 'Summarise a document', sub: 'Attach a PDF or file', prompt: 'Summarise the attached document into its key points.', attach: true },
];

/* ---------------- attachments ---------------- */

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|js|mjs|ts|tsx|jsx|py|html|css|xml|yml|yaml|sql|log|ini|toml|sh|c|cpp|h|java|go|rs|rb|php|swift|kt)$/i;
const isTextFile = (file) => /^text\//.test(file.type) || /json|xml|javascript|yaml|csv|sql/.test(file.type) || TEXT_EXT.test(file.name);
const MAX_ATTACH = 20 * 1024 * 1024;

function b64FromText(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fmtSize(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const extOf = (name) => (String(name || '').includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : 'FILE');

function makeThumb(dataUrl, max = 160) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      try { resolve(c.toDataURL('image/jpeg', 0.8)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function readAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const text = isTextFile(file) && !/^image\//.test(file.type);
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.onload = async () => {
      const raw = reader.result;
      const att = { id: newId('f'), name: file.name || 'file', size: file.size, type: file.type || (text ? 'text/plain' : 'application/octet-stream') };
      if (text) {
        att.text = String(raw);
        att.base64 = b64FromText(att.text);
        att.isText = true;
      } else {
        att.dataUrl = String(raw);
        att.base64 = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : null;
        if (/^image\//.test(att.type)) att.thumb = await makeThumb(att.dataUrl);
      }
      resolve(att);
    };
    if (text) reader.readAsText(file); else reader.readAsDataURL(file);
  });
}

function attachmentChip(a, { removable = false } = {}) {
  const thumb = a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : `<span class="ast-file-ext">${esc(extOf(a.name))}</span>`;
  return `<div class="ast-file ${a.thumb ? 'has-thumb' : ''}" data-id="${esc(a.id || '')}" title="${esc(a.name)}">
    <span class="ast-file-thumb">${thumb}</span>
    <span class="ast-file-meta"><span class="ast-file-name">${esc(a.name)}</span><span class="ast-file-size">${esc([extOf(a.name), fmtSize(a.size)].filter(Boolean).join(' · '))}</span></span>
    ${removable ? `<button type="button" class="ast-file-x" data-remove="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${icon('x', 12, 2.2)}</button>` : ''}
  </div>`;
}

/* ============================================================
   Tool component
   ============================================================ */

let active = null;

export default {
  render(container, state = {}) {
    active?.teardown?.();
    active = mountAssistant(container, state);
  },
  destroy() {
    active?.teardown?.();
    active = null;
    AssistantAudioManager.destroyAll();
  },
};

function mountAssistant(container, state) {
  const disposers = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); disposers.push(() => target.removeEventListener(type, fn, opts)); };

  const integration = new ConversationIntegrationManager({ history: [], keepContext: true, audioManager: AssistantAudioManager });
  const store = new ConversationStore();
  const taskState = { activeToolId: state.tool?.id || null, attachedFiles: [] };

  let conv = null;          // active conversation
  let messages = [];        // its messages
  let attachments = [];
  let mode = getActiveAiMode();
  let running = null;       // { conv, abort, view }
  let stick = true;
  let dead = false;

  container.innerHTML = `
    <div class="ast" data-side="${initialSidebar()}">
      <aside class="ast-side" aria-label="Chats">
        <div class="ast-side-head">
          <button type="button" class="ast-newchat" data-act="new">${icon('compose', 17)}<span>New chat</span></button>
          <button type="button" class="ast-ib" data-act="side-close" aria-label="Hide chats" title="Hide chats">${icon('sidebar', 18)}</button>
        </div>
        <label class="ast-search">${icon('search', 15)}<input type="search" placeholder="Search chats" aria-label="Search chats" autocomplete="off"></label>
        <nav class="ast-convs" aria-label="Chat history"></nav>
        <div class="ast-side-foot"></div>
      </aside>
      <div class="ast-scrim" data-act="side-close"></div>
      <section class="ast-main">
        <header class="ast-top">
          <button type="button" class="ast-ib ast-side-open" data-act="side-open" aria-label="Show chats" title="Show chats">${icon('sidebar', 18)}</button>
          <div class="ast-top-title" aria-live="polite"></div>
          <button type="button" class="ast-ib ast-top-new" data-act="new" aria-label="New chat" title="New chat">${icon('compose', 18)}</button>
        </header>
        <div class="ast-scroll">
          <div class="ast-thread" role="log" aria-live="polite" aria-relevant="additions"></div>
        </div>
        <div class="ast-dock">
          <button type="button" class="ast-jump" data-act="jump" aria-label="Scroll to latest" hidden>${icon('down', 16, 2)}</button>
          <form class="ast-composer" autocomplete="off">
            <div class="ast-files" hidden></div>
            <textarea class="ast-input" rows="1" placeholder="Message Assistant" aria-label="Message Assistant"></textarea>
            <div class="ast-bar">
              <div class="ast-pop-wrap">
                <button type="button" class="ast-ib ast-attach" data-act="attach-menu" aria-label="Add files" aria-haspopup="menu" aria-expanded="false" title="Add files">${icon('plus', 19, 2)}</button>
                <div class="ast-pop ast-attach-pop" role="menu" hidden>
                  <button type="button" role="menuitem" data-act="pick-device">${icon('upload', 17)}<span><strong>Upload files</strong><small>Images, PDFs, spreadsheets, code</small></span></button>
                  <button type="button" role="menuitem" data-act="pick-toolbox">${icon('folder', 17)}<span><strong>From Toolbox Files</strong><small>Your saved work</small></span></button>
                </div>
              </div>
              <div class="ast-pop-wrap">
                <button type="button" class="ast-mode" data-act="mode-menu" aria-haspopup="menu" aria-expanded="false"><span class="ast-mode-name"></span>${icon('chevDown', 14, 2)}</button>
                <div class="ast-pop ast-mode-pop" role="menu" hidden></div>
              </div>
              <span class="ast-bar-space"></span>
              <button type="submit" class="ast-send" aria-label="Send" title="Send">${icon('up', 18, 2.2)}</button>
            </div>
          </form>
          <p class="ast-note">Assistant can make mistakes. Check important information.</p>
        </div>
        <div class="ast-drop" aria-hidden="true"><div>${icon('upload', 22)}<strong>Drop files to attach</strong><span>Images, PDFs, spreadsheets, documents and code</span></div></div>
        <input type="file" class="ast-file-input" multiple hidden>
      </section>
    </div>`;

  const root = container.querySelector('.ast');
  const $ = (sel) => root.querySelector(sel);
  const side = $('.ast-side');
  const convList = $('.ast-convs');
  const searchInput = $('.ast-search input');
  const topTitle = $('.ast-top-title');
  const scroller = $('.ast-scroll');
  const thread = $('.ast-thread');
  const jumpBtn = $('.ast-jump');
  const form = $('.ast-composer');
  const input = $('.ast-input');
  const filesRow = $('.ast-files');
  const sendBtn = $('.ast-send');
  const fileInput = $('.ast-file-input');
  const attachPop = $('.ast-attach-pop');
  const modePop = $('.ast-mode-pop');
  const sideFoot = $('.ast-side-foot');

  /* ---------------- sidebar ---------------- */

  function initialSidebar() {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return 'closed';
    try { return localStorage.getItem('toolbox_assistant_sidebar') === 'closed' ? 'closed' : 'open'; } catch { return 'open'; }
  }
  const isDrawer = () => window.innerWidth < 1024;
  function setSidebar(open) {
    root.dataset.side = open ? 'open' : 'closed';
    if (!isDrawer()) { try { localStorage.setItem('toolbox_assistant_sidebar', open ? 'open' : 'closed'); } catch { /* ignore */ } }
    if (open && isDrawer()) setTimeout(() => searchInput.focus({ preventScroll: true }), 50);
  }
  let lastWide = !isDrawer();
  on(window, 'resize', () => {
    const wide = !isDrawer();
    if (wide !== lastWide) root.dataset.side = wide ? initialSidebar() : 'closed';
    lastWide = wide;
    placeholder();
  });

  function dayGroup(ts) {
    const d = new Date(ts), now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= startToday) return 'Today';
    if (ts >= startToday - 86400000) return 'Yesterday';
    if (ts >= startToday - 6 * 86400000) return 'Previous 7 days';
    if (ts >= startToday - 29 * 86400000) return 'Previous 30 days';
    return d.toLocaleDateString(undefined, { month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function renderConvList() {
    const q = searchInput.value.trim().toLowerCase();
    const list = store.conversations.filter(c => c.messages?.length).filter(c => !q
      || c.title?.toLowerCase().includes(q)
      || c.messages.some(m => String(m.displayText ?? m.content ?? '').toLowerCase().includes(q)));
    if (!list.length) {
      convList.innerHTML = `<p class="ast-convs-empty">${q ? 'No chats match your search.' : 'Your chats will appear here.'}</p>`;
    } else {
      let html = '', group = '';
      for (const c of list) {
        const g = dayGroup(c.updatedAt || c.createdAt || Date.now());
        if (g !== group) { html += `<h3 class="ast-convs-h">${esc(g)}</h3>`; group = g; }
        const isActive = conv && c.id === conv.id;
        const busy = running && running.conv.id === c.id;
        html += `<div class="ast-conv ${isActive ? 'is-active' : ''}" data-id="${esc(c.id)}">
          <button type="button" class="ast-conv-open" data-act="open-conv" ${isActive ? 'aria-current="page"' : ''}>${busy ? '<span class="ast-conv-busy" aria-label="Replying"></span>' : ''}<span>${esc(c.title || 'New chat')}</span></button>
          <button type="button" class="ast-conv-more" data-act="conv-menu" aria-label="Chat options for ${esc(c.title || 'chat')}" aria-haspopup="menu">${icon('more', 16)}</button>
        </div>`;
      }
      convList.innerHTML = html;
    }
    const user = getCurrentUser();
    const sync = { syncing: 'Syncing…', synced: 'Synced to your account', offline: 'Saved on this device', idle: user ? 'Saved to your account' : 'Saved on this device' }[store.syncState] || '';
    sideFoot.innerHTML = user ? `
      <div class="ast-me"><span class="ast-me-av">${esc((user.displayName || user.username || user.email || '?').slice(0, 1).toUpperCase())}</span>
      <span class="ast-me-meta"><strong>${esc(user.displayName || user.username || 'You')}</strong><small>${esc(sync)}</small></span></div>` : '';
  }

  function openConvMenu(button, id) {
    closePops();
    const menu = document.createElement('div');
    menu.className = 'ast-pop ast-conv-pop';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" role="menuitem" data-act="rename">${icon('edit', 16)}<span><strong>Rename</strong></span></button>
      <button type="button" role="menuitem" data-act="delete" class="is-danger">${icon('trash', 16)}<span><strong>Delete</strong></span></button>`;
    button.closest('.ast-conv').appendChild(menu);
    button.setAttribute('aria-expanded', 'true');
    menu.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      menu.remove();
      const c = store.conversations.find(x => x.id === id);
      if (!c) return;
      if (act === 'rename') {
        const name = await tbPrompt('Name this chat', c.title || '', { title: 'Rename chat', confirmText: 'Save' });
        if (name && name.trim()) { store.rename(id, name); if (conv?.id === id) conv.title = c.title; renderTitle(); }
      } else if (act === 'delete') {
        const ok = await tbConfirm(`"${c.title || 'This chat'}" will be deleted from this device and your account.`, { title: 'Delete chat?', confirmText: 'Delete', destructive: true });
        if (!ok) return;
        if (running?.conv.id === id) running.abort.abort();
        store.remove(id);
        if (conv?.id === id) startNewChat();
      }
    });
    menu.querySelector('button')?.focus();
  }

  /* ---------------- conversations ---------------- */

  function renderTitle() {
    topTitle.textContent = conv && messages.length ? (conv.title || 'New chat') : 'New chat';
  }

  function startNewChat() {
    if (!guardSwitch()) return;
    conv = { id: newId(), title: 'New chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    store.activeId = conv.id;
    messages = [];
    renderThread();
    renderConvList();
    renderTitle();
    if (isDrawer()) setSidebar(false);
    input.focus();
  }

  function openConversation(id) {
    if (conv?.id === id) { if (isDrawer()) setSidebar(false); return; }
    if (!guardSwitch()) return;
    const c = store.conversations.find(x => x.id === id);
    if (!c) return;
    conv = c;
    messages = (c.messages || []).map(m => ({ ...m }));
    store.select(c.id);
    renderThread();
    renderConvList();
    renderTitle();
    if (isDrawer()) setSidebar(false);
    scrollToBottom(true);
  }

  function guardSwitch() {
    if (!running || running.conv !== conv) return true;
    // Leaving a chat mid-reply stops it; the partial reply is kept.
    running.abort.abort();
    return true;
  }

  function persist(targetConv = conv, targetMessages = messages) {
    if (!targetConv || !targetMessages.length) return;
    store.put(targetConv, targetMessages);
    if (targetConv === conv) renderTitle();
  }

  /* ---------------- thread ---------------- */

  function renderThread() {
    thread.innerHTML = '';
    if (!getCurrentUser()) { thread.appendChild(signInView()); updateComposerState(); return; }
    if (!messages.length) { thread.appendChild(emptyView()); updateComposerState(); return; }
    for (const m of messages) {
      if (m.role === 'user') thread.appendChild(userView(m));
      else if (m.role === 'assistant' || m.role === 'model') {
        if (running && running.msg === m) thread.appendChild(running.view.el);
        else thread.appendChild(new TurnView(m, { live: false }).el);
      }
    }
    updateComposerState();
  }

  function greeting() {
    const h = new Date().getHours();
    const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const u = getCurrentUser();
    const name = String(u?.displayName || u?.user_metadata?.full_name || u?.username || '').split(/[\s@]/)[0];
    return name ? `${part}, ${name.charAt(0).toUpperCase()}${name.slice(1)}` : part;
  }

  function emptyView() {
    const el = document.createElement('div');
    el.className = 'ast-empty';
    el.innerHTML = `
      <div class="ast-empty-mark" aria-hidden="true">${icon('spark', 22, 1.6)}</div>
      <h2 class="ast-empty-title">${esc(greeting())}</h2>
      <p class="ast-empty-sub">What should we work on? I can use 100+ Toolbox tools, browse the web and run code.</p>
      <div class="ast-sugs">
        ${SUGGESTIONS.map((s, i) => `<button type="button" class="ast-sug" data-sug="${i}" style="--i:${i}">
          <span class="ast-sug-icon">${icon(s.icon, 17)}</span>
          <span class="ast-sug-text"><strong>${esc(s.title)}</strong><small>${esc(s.sub)}</small></span>
        </button>`).join('')}
      </div>`;
    return el;
  }

  function signInView() {
    const el = document.createElement('div');
    el.className = 'ast-empty ast-signin';
    el.innerHTML = `
      <div class="ast-empty-mark" aria-hidden="true">${icon('lock', 22, 1.6)}</div>
      <h2 class="ast-empty-title">Sign in to use Assistant</h2>
      <p class="ast-empty-sub">Assistant runs on Toolbox's servers, so there is no API key to set up. Sign in and your chats sync across your devices.</p>
      <button type="button" class="btn btn-primary" data-act="sign-in">Sign in</button>`;
    return el;
  }

  function userView(m) {
    const el = document.createElement('div');
    el.className = 'ast-turn ast-turn-user';
    el.dataset.id = m.id;
    const text = m.displayText ?? m.content ?? '';
    const atts = m.attachments?.length ? m.attachments : (m.filePreview ? [{ name: m.filePreview.name, size: m.filePreview.size }] : []);
    el.innerHTML = `
      <div class="ast-user">
        ${atts.length ? `<div class="ast-user-files">${atts.map(a => attachmentChip(a)).join('')}</div>` : ''}
        ${text ? `<div class="ast-bubble">${esc(text)}</div>` : ''}
        <div class="ast-acts">
          <button type="button" class="ast-act" data-act="copy-user" aria-label="Copy message" title="Copy">${icon('copy', 15)}</button>
          <button type="button" class="ast-act" data-act="edit-user" aria-label="Edit message" title="Edit">${icon('edit', 15)}</button>
        </div>
      </div>`;
    return el;
  }

  function beginEdit(turnEl, m) {
    if (running) return;
    const box = turnEl.querySelector('.ast-user');
    const original = m.displayText ?? m.content ?? '';
    box.classList.add('is-editing');
    box.innerHTML = `
      <div class="ast-edit">
        <textarea class="ast-edit-input" rows="1" aria-label="Edit message">${esc(original)}</textarea>
        <div class="ast-edit-bar"><button type="button" class="btn btn-ghost btn-sm" data-act="edit-cancel">Cancel</button><button type="button" class="btn btn-primary btn-sm" data-act="edit-send">Send</button></div>
      </div>`;
    const ta = box.querySelector('textarea');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`; };
    grow();
    ta.addEventListener('input', grow);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const cancel = () => turnEl.replaceWith(userView(m));
    const send = () => {
      const text = ta.value.trim();
      if (!text) return;
      const idx = messages.indexOf(m);
      if (idx < 0) return;
      const extra = m.content && m.displayText != null && m.content !== m.displayText ? m.content.slice(m.displayText.length) : '';
      m.displayText = text;
      m.content = `${text}${extra}`;
      m.timestamp = Date.now();
      messages.length = idx + 1;
      persist();
      renderThread();
      runTurn();
    };
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
      if (e.key === 'Escape') cancel();
    });
    box.querySelector('[data-act="edit-cancel"]').addEventListener('click', cancel);
    box.querySelector('[data-act="edit-send"]').addEventListener('click', send);
  }

  /* ---------------- assistant turn view ---------------- */

  class TurnView {
    constructor(msg, { live }) {
      this.msg = msg;
      this.live = live;
      this.el = document.createElement('div');
      this.el.className = 'ast-turn ast-turn-ai';
      this.el.dataset.id = msg.id;
      this.el.innerHTML = `<div class="ast-ai"><div class="ast-flow"></div><div class="ast-live" hidden></div><div class="ast-foot" hidden></div></div>`;
      this.flow = this.el.querySelector('.ast-flow');
      this.liveEl = this.el.querySelector('.ast-live');
      this.foot = this.el.querySelector('.ast-foot');
      this.segEls = [];
      this.raf = 0;
      this.timers = [];
      if (!msg.segments) msg.segments = legacySegments(msg);
      if (!msg.toolResults) msg.toolResults = [];
      msg.segments.forEach((seg, i) => this.mountSegment(seg, i));
      if (live) this.setWaiting(true);
      else this.finish();
    }

    /* segments */
    mountSegment(seg, i) {
      let el;
      if (seg.k === 'think') el = this.thinkEl(seg);
      else if (seg.k === 'text') el = this.textEl(seg);
      else if (seg.k === 'tools') el = this.toolsEl(seg);
      else if (seg.k === 'plan') el = this.planEl(seg);
      if (!el) return;
      this.segEls[i] = el;
      this.flow.appendChild(el);
    }
    last() { return this.msg.segments[this.msg.segments.length - 1]; }
    push(seg) { this.msg.segments.push(seg); this.mountSegment(seg, this.msg.segments.length - 1); return seg; }
    elOf(seg) { return this.segEls[this.msg.segments.indexOf(seg)]; }

    /* thinking */
    thinkEl(seg) {
      const el = document.createElement('div');
      el.className = `ast-think${seg.live ? ' is-live' : ''}`;
      el.innerHTML = `
        <button type="button" class="ast-think-head" aria-expanded="false">
          <span class="ast-think-icon">${seg.live ? GLYPH : '<span class="ast-think-done" aria-hidden="true"></span>'}</span>
          <span class="ast-think-label">${seg.live ? '<span class="ast-shimmer">Thinking</span>' : esc(thoughtLabel(seg.ms))}</span>
          <span class="ast-think-time u-num"></span>
          <span class="ast-think-chev">${icon('chev', 14, 2)}</span>
        </button>
        <div class="ast-think-peek" aria-hidden="true"><p></p></div>
        <div class="ast-think-body" hidden><div class="ast-md ast-md-muted"></div></div>`;
      const head = el.querySelector('.ast-think-head');
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(open));
        el.classList.toggle('is-open', open);
        const body = el.querySelector('.ast-think-body');
        body.hidden = !open;
        if (open) renderMdInto(body.firstElementChild, seg.text || '_No thoughts were shared._', false);
      });
      if (seg.live) this.tickThink(el, seg);
      else el.querySelector('.ast-think-peek').remove();
      return el;
    }
    tickThink(el, seg) {
      const t = el.querySelector('.ast-think-time');
      const tick = () => { if (seg.live) { t.textContent = `${Math.floor((Date.now() - seg.start) / 1000)}s`; } };
      tick();
      this.timers.push(setInterval(tick, 1000));
    }
    thinking(chunk) {
      let seg = this.last();
      if (!seg || seg.k !== 'think' || !seg.live) {
        this.setWaiting(false);
        seg = this.push({ k: 'think', text: '', live: true, start: Date.now() });
      }
      seg.text += chunk;
      const peek = this.elOf(seg)?.querySelector('.ast-think-peek p');
      if (peek) {
        const tail = seg.text.replace(/\s+/g, ' ').trim();
        peek.textContent = tail.length > 280 ? `…${tail.slice(-280)}` : tail;
      }
      const body = this.elOf(seg)?.querySelector('.ast-think-body');
      if (body && !body.hidden) this.scheduleMd(body.firstElementChild, () => seg.text);
      onContent();
    }
    endThinking() {
      const seg = this.last();
      if (!seg || seg.k !== 'think' || !seg.live) return;
      seg.live = false;
      seg.ms = Date.now() - seg.start;
      delete seg.start;
      const el = this.elOf(seg);
      if (!el) return;
      el.classList.remove('is-live');
      el.classList.add('is-settling');
      el.querySelector('.ast-think-icon').innerHTML = '<span class="ast-think-done" aria-hidden="true"></span>';
      el.querySelector('.ast-think-label').textContent = thoughtLabel(seg.ms);
      el.querySelector('.ast-think-time').textContent = '';
      el.querySelector('.ast-think-peek')?.remove();
    }

    /* text */
    textEl(seg) {
      const el = document.createElement('div');
      el.className = 'ast-md';
      if (seg.text) renderMdInto(el, seg.text, false);
      return el;
    }
    text(chunk) {
      this.endThinking();
      this.setWaiting(false);
      let seg = this.last();
      if (!seg || seg.k !== 'text') seg = this.push({ k: 'text', text: '' });
      seg.text += chunk;
      this.msg.content = (this.msg.content || '') + chunk;
      this.scheduleMd(this.elOf(seg), () => seg.text, true);
    }
    scheduleMd(el, getText, streaming = false) {
      if (!el) return;
      el._pending = getText;
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        for (const node of this.flow.querySelectorAll('.ast-md')) {
          if (!node._pending) continue;
          const text = node._pending();
          node._pending = null;
          renderMdInto(node, text, streaming);
        }
        onContent();
      });
    }

    /* tools */
    toolsEl(seg) {
      const el = document.createElement('div');
      el.className = 'ast-work';
      el.innerHTML = '<ol class="ast-steps"></ol><div class="ast-cards"></div>';
      for (const run of seg.runs) this.addStepEl(el, run);
      for (const run of seg.runs) if (run.r != null) this.addCard(el, run);
      return el;
    }
    addStepEl(groupEl, run) {
      const li = document.createElement('li');
      li.className = 'ast-step';
      li.dataset.run = run.id;
      groupEl.querySelector('.ast-steps').appendChild(li);
      this.paintStep(li, run);
      li.addEventListener('click', (e) => {
        const head = e.target.closest('.ast-step-head');
        if (!head) return;
        const open = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(open));
        li.classList.toggle('is-open', open);
        const body = li.querySelector('.ast-step-body');
        body.hidden = !open;
        if (open) this.paintStepBody(body, run);
      });
      return li;
    }
    paintStep(li, run) {
      const done = run.status !== 'running';
      const meta = toolMeta(run.name, run.args, done);
      const detail = toolDetail(run.name, run.args);
      const result = run.r != null ? this.msg.toolResults[run.r] : null;
      const errText = run.status === 'error' ? (result?.error || result?.message || 'Failed') : '';
      li.dataset.status = run.status;
      const wasOpen = li.classList.contains('is-open');
      li.innerHTML = `
        <button type="button" class="ast-step-head" aria-expanded="${wasOpen}">
          <span class="ast-step-node">${icon(meta.icon, 14, 1.9)}<span class="ast-step-badge" aria-hidden="true">${run.status === 'done' ? icon('check', 9, 3.2) : run.status === 'error' ? '!' : ''}</span></span>
          <span class="ast-step-text"><span class="ast-step-label">${esc(run.status === 'error' ? `${meta.label} — failed` : meta.label)}</span>${detail || errText ? `<span class="ast-step-detail">${esc(errText || detail)}</span>` : ''}</span>
          <span class="ast-step-time u-num">${run.status === 'running' ? '' : esc(fmtDuration(run.ms))}</span>
          <span class="ast-step-chev">${icon('chev', 13, 2)}</span>
        </button>
        <div class="ast-step-body" ${wasOpen ? '' : 'hidden'}></div>`;
      if (wasOpen) this.paintStepBody(li.querySelector('.ast-step-body'), run);
    }
    paintStepBody(body, run) {
      const result = run.r != null ? this.msg.toolResults[run.r] : null;
      const args = compactJson(run.args || {}, 3000);
      const out = result ? compactJson(result, 5000) : (run.status === 'running' ? 'Running…' : 'No output recorded.');
      body.innerHTML = `
        <div class="ast-io"><span class="ast-io-h">Input</span><pre>${esc(args || '{}')}</pre></div>
        <div class="ast-io"><span class="ast-io-h">Output</span><pre>${esc(out)}</pre></div>`;
    }
    addCard(groupEl, run) {
      const result = this.msg.toolResults[run.r];
      if (!result || isFailed(result) || result.type === 'map-view-ref' || result.silent) return;
      let normalized;
      try { normalized = integration.normalizeToolResult(result, run.name); } catch { return; }
      if (normalized.renderer === 'task-plan' || isPlainTextResult(normalized)) return;
      const host = document.createElement('div');
      host.className = 'ast-card';
      host.dataset.run = run.id;
      groupEl.querySelector('.ast-cards').appendChild(host);
      Promise.resolve(integration.renderToolResult(result, host, run.name)).then(() => {
        if (!host.childElementCount) host.remove();
        onContent();
      }).catch(() => host.remove());
    }
    toolStart(name, args, id) {
      this.endThinking();
      this.setWaiting(false);
      if (name === 'update_plan') { this.planStart(args); return; }
      let seg = this.last();
      if (!seg || seg.k !== 'tools') seg = this.push({ k: 'tools', runs: [] });
      const run = { id: id || newId('t'), name, args: args || {}, status: 'running', t0: Date.now() };
      seg.runs.push(run);
      this.addStepEl(this.elOf(seg), run);
      onContent();
    }
    toolResult(name, result, id) {
      const r = this.msg.toolResults.push(result) - 1;
      if (name === 'update_plan') { this.planResult(r); this.afterTool(); return; }
      let run = null, seg = null;
      for (let i = this.msg.segments.length - 1; i >= 0 && !run; i--) {
        const s = this.msg.segments[i];
        if (s.k !== 'tools') continue;
        run = s.runs.find(x => (id && x.id === id) || (!id && x.name === name && x.status === 'running'));
        if (run) seg = s;
      }
      if (!run) {   // result without a start event
        seg = this.last()?.k === 'tools' ? this.last() : this.push({ k: 'tools', runs: [] });
        run = { id: id || newId('t'), name, args: {}, status: 'running', t0: Date.now() };
        seg.runs.push(run);
        this.addStepEl(this.elOf(seg), run);
      }
      run.status = isFailed(result) ? 'error' : 'done';
      run.ms = Date.now() - (run.t0 || Date.now());
      delete run.t0;
      run.r = r;
      const groupEl = this.elOf(seg);
      const li = groupEl?.querySelector(`.ast-step[data-run="${CSS.escape(run.id)}"]`);
      if (li) this.paintStep(li, run);
      if (groupEl) this.addCard(groupEl, run);
      this.afterTool();
    }
    afterTool() {
      const anyRunning = this.msg.segments.some(s => s.k === 'tools' && s.runs.some(r => r.status === 'running'));
      if (!anyRunning) this.setWaiting(true);
      onContent();
    }

    /* plan */
    planEl(seg) {
      const el = document.createElement('div');
      el.className = 'ast-plan';
      this.paintPlan(el, seg);
      return el;
    }
    paintPlan(el, seg) {
      const data = seg.r != null ? this.msg.toolResults[seg.r] : seg.pending;
      if (!data) return;
      el.innerHTML = '';
      integration.renderToolResult({ ...data, renderer: 'task-plan', type: 'task-plan', status: 'success' }, el, 'update_plan');
    }
    planStart(args) {
      let seg = this.msg.segments.find(s => s.k === 'plan');
      const pending = { title: args?.title || 'Plan', steps: Array.isArray(args?.steps) ? args.steps : [] };
      if (!seg) seg = this.push({ k: 'plan', r: null, pending });
      else { seg.pending = pending; seg.r = null; }
      this.paintPlan(this.elOf(seg), seg);
      onContent();
    }
    planResult(r) {
      let seg = this.msg.segments.find(s => s.k === 'plan');
      if (!seg) seg = this.push({ k: 'plan', r });
      seg.r = r;
      delete seg.pending;
      this.paintPlan(this.elOf(seg), seg);
    }

    /* waiting indicator */
    setWaiting(on) {
      if (!this.live) { this.liveEl.hidden = true; return; }
      if (on) {
        if (!this.liveEl.hidden) return;
        this.waitStart = Date.now();
        const label = this.msg.segments.length ? 'Working' : 'Thinking';
        this.liveEl.innerHTML = `${GLYPH}<span class="ast-shimmer">${label}</span><span class="ast-live-time u-num"></span>`;
        this.liveEl.hidden = false;
        const t = this.liveEl.querySelector('.ast-live-time');
        clearInterval(this.waitTimer);
        this.waitTimer = setInterval(() => {
          const s = Math.floor((Date.now() - this.waitStart) / 1000);
          t.textContent = s >= 2 ? `${s}s` : '';
        }, 1000);
      } else {
        this.liveEl.hidden = true;
        clearInterval(this.waitTimer);
      }
    }

    /* done */
    finish() {
      this.live = false;
      this.endThinking();
      this.setWaiting(false);
      this.timers.forEach(clearInterval);
      this.timers = [];
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
      // Final, non-streaming render of every text block.
      this.msg.segments.forEach((seg, i) => { if (seg.k === 'text' && this.segEls[i]) renderMdInto(this.segEls[i], seg.text, false); });
      for (const seg of this.msg.segments) if (seg.k === 'tools') for (const run of seg.runs) if (run.status === 'running') run.status = 'error';
      this.el.querySelectorAll('.ast-step[data-status="running"]').forEach(li => { li.dataset.status = 'stopped'; });
      this.el.querySelector('.ast-plan')?.classList.add('is-settled');
      this.el.querySelectorAll('.ast-think.is-live').forEach(el => el.classList.remove('is-live'));
      this.paintFoot();
    }
    paintFoot() {
      const m = this.msg;
      const hasText = Boolean(String(m.content || '').trim());
      const model = [m.providerLabel || m.provider, m.model].filter(Boolean).join(' · ');
      let errorHtml = '';
      if (m.status === 'failed' || (m.error && m.status !== 'stopped')) {
        const needsSignIn = m.errorCode === 401 || /sign in/i.test(m.error || '');
        errorHtml = `<div class="ast-error" role="alert">${icon('alert', 16)}<div><p>${esc(m.error || 'Something went wrong.')}</p><div class="ast-error-acts">
          ${needsSignIn ? '<button type="button" class="btn btn-primary btn-sm" data-act="sign-in">Sign in</button>' : ''}
          <button type="button" class="btn btn-secondary btn-sm" data-act="retry">${icon('retry', 14)}Try again</button></div></div></div>`;
      }
      this.flow.querySelector(':scope > .ast-error')?.remove();
      if (errorHtml) this.flow.insertAdjacentHTML('beforeend', errorHtml);
      if (!hasText && !m.toolResults?.length && !errorHtml && m.status !== 'stopped') {
        this.flow.insertAdjacentHTML('beforeend', '<p class="ast-muted-line">No reply was returned.</p>');
      }
      this.foot.hidden = false;
      this.foot.innerHTML = `
        ${hasText ? `<button type="button" class="ast-act" data-act="copy-ai" aria-label="Copy reply" title="Copy">${icon('copy', 15)}</button>` : ''}
        <button type="button" class="ast-act" data-act="regenerate" aria-label="Regenerate reply" title="Regenerate">${icon('retry', 15)}</button>
        ${m.status === 'stopped' ? '<span class="ast-tag">Stopped</span>' : ''}
        ${model ? `<span class="ast-model" title="Answered by ${esc(model)}">${esc(model)}</span>` : ''}`;
    }
    dispose() { this.timers.forEach(clearInterval); clearInterval(this.waitTimer); if (this.raf) cancelAnimationFrame(this.raf); }
  }

  function thoughtLabel(ms) {
    if (ms == null) return 'Thoughts';
    const s = Math.round(ms / 1000);
    if (s < 1) return 'Thought for a moment';
    if (s < 60) return `Thought for ${s}s`;
    return `Thought for ${Math.floor(s / 60)}m ${s % 60}s`;
  }

  /** Builds segments for messages saved before segments existed. */
  function legacySegments(m) {
    const segs = [];
    if (m.thinking) segs.push({ k: 'think', text: m.thinking, ms: m.thinkingMs });
    const results = m.toolResults || [];
    const runs = [];
    results.forEach((r, i) => {
      const data = r?.data && (r.renderer || r.toolCallId !== undefined) ? r.data : r;
      if (data !== r) results[i] = data;
      const name = data?.toolName || r?.toolName || 'tool';
      if (name === 'update_plan' || data?.renderer === 'task-plan') { segs.push({ k: 'plan', r: i }); return; }
      runs.push({ id: `legacy_${i}`, name, args: {}, status: isFailed(data) ? 'error' : 'done', r: i });
    });
    if (runs.length) segs.push({ k: 'tools', runs });
    if (m.content) segs.push({ k: 'text', text: m.content });
    return segs;
  }

  function renderMdInto(el, text, streaming) {
    const { html, hasMath } = renderMarkdown(text, { streaming });
    patchHtml(el, html);
    if (hasMath) { el.dataset.math = '1'; el._src = text; } else if (el.dataset.math) delete el.dataset.math;
  }

  // Swap MathML fallbacks for KaTeX once it arrives.
  on(window, 'toolbox:katex-ready', () => {
    thread.querySelectorAll('.ast-md[data-math="1"]').forEach(el => { if (el._src) renderMdInto(el, el._src, false); });
    onContent();
  });

  /* ---------------- scrolling ---------------- */

  function nearBottom() { return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96; }
  function scrollToBottom(force = false) {
    if (force) stick = true;
    if (!stick) return;
    scroller.scrollTop = scroller.scrollHeight;
  }
  function onContent() {
    if (stick) scroller.scrollTop = scroller.scrollHeight;
    jumpBtn.hidden = stick || nearBottom();
  }
  on(scroller, 'scroll', () => {
    stick = nearBottom();
    jumpBtn.hidden = stick;
  }, { passive: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (stick) scroller.scrollTop = scroller.scrollHeight; }) : null;
  ro?.observe(thread);
  disposers.push(() => ro?.disconnect());

  /* ---------------- composer ---------------- */

  function placeholder() {
    input.placeholder = window.innerWidth < 600 ? 'Message Assistant' : 'Message Assistant — ask, attach files, or give it a task';
  }
  placeholder();

  function grow() {
    input.style.height = 'auto';
    const max = Math.min(260, Math.round(window.innerHeight * 0.36));
    input.style.height = `${Math.min(input.scrollHeight, max)}px`;
    input.style.overflowY = input.scrollHeight > max ? 'auto' : 'hidden';
  }

  function updateComposerState() {
    const signedIn = Boolean(getCurrentUser());
    const busy = Boolean(running && running.conv === conv);
    const canSend = signedIn && (input.value.trim() || attachments.length);
    root.classList.toggle('is-busy', busy);
    input.disabled = !signedIn;
    sendBtn.disabled = busy ? false : !canSend;
    sendBtn.type = busy ? 'button' : 'submit';
    sendBtn.dataset.act = busy ? 'stop' : '';
    sendBtn.setAttribute('aria-label', busy ? 'Stop' : 'Send');
    sendBtn.title = busy ? 'Stop' : 'Send';
    sendBtn.innerHTML = busy ? STOP_ICON : icon('up', 18, 2.2);
  }

  function renderModeButton() {
    const m = AI_MODES[mode] || AI_MODES.auto;
    root.querySelector('.ast-mode-name').textContent = m.name;
    modePop.innerHTML = `<div class="ast-pop-h">Mode</div>${Object.values(AI_MODES).map(x => `
      <button type="button" role="menuitemradio" aria-checked="${x.id === mode}" data-mode="${x.id}">
        <span><strong>${esc(x.name)}</strong><small>${esc(x.description)}</small></span>
        <span class="ast-pop-check">${x.id === mode ? icon('check', 15, 2.2) : ''}</span>
      </button>`).join('')}`;
  }

  function renderFiles() {
    filesRow.hidden = !attachments.length;
    filesRow.innerHTML = attachments.map(a => attachmentChip(a, { removable: true })).join('');
    updateComposerState();
  }

  async function addFiles(fileList) {
    const files = [...(fileList || [])];
    for (const file of files) {
      if (file.size > MAX_ATTACH) { tbAlert(`${file.name} is larger than 20 MB.`, 'File too large'); continue; }
      try {
        const att = await readAttachment(file);
        if (!att.isText) {
          // The engine sends one image or document per message; text files are inlined.
          const prev = attachments.find(a => !a.isText);
          if (prev) attachments = attachments.filter(a => a !== prev);
        }
        attachments.push(att);
        if (attachments.length > 6) attachments = attachments.slice(-6);
      } catch (err) {
        tbAlert(err?.message || 'Could not read that file.', 'Attachment');
      }
    }
    renderFiles();
    input.focus();
  }

  async function openToolboxFilePicker() {
    const backdrop = document.createElement('div');
    backdrop.className = 'ast-modal';
    backdrop.innerHTML = `
      <div class="ast-modal-card" role="dialog" aria-modal="true" aria-label="Attach from Toolbox Files">
        <div class="ast-modal-head"><div><h3>Attach from Files</h3><p>Choose something you saved in Toolbox</p></div><button type="button" class="ast-ib" data-close aria-label="Close">${icon('x', 18)}</button></div>
        <label class="ast-search">${icon('search', 15)}<input type="search" placeholder="Search files" aria-label="Search files"></label>
        <div class="ast-modal-list"><p class="ast-convs-empty">Loading your files…</p></div>
      </div>`;
    document.body.appendChild(backdrop);
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.closest('[data-close]')) close(); });
    const list = backdrop.querySelector('.ast-modal-list');
    const search = backdrop.querySelector('input');
    try {
      const meta = await fs.listAllMeta();
      const files = (meta || []).filter(f => !f.isDirectory);
      const paint = () => {
        const q = search.value.trim().toLowerCase();
        const shown = files.filter(f => !q || f.name?.toLowerCase().includes(q) || f.path?.toLowerCase().includes(q)).slice(0, 200);
        list.innerHTML = shown.length ? shown.map(f => `
          <button type="button" class="ast-modal-row" data-path="${esc(f.path)}">
            <span class="ast-file-ext">${esc(extOf(f.name))}</span>
            <span class="ast-modal-row-meta"><strong>${esc(f.name)}</strong><small>${esc(f.path || '')} · ${esc(fmtSize(f.size || 0))}</small></span>
          </button>`).join('') : `<p class="ast-convs-empty">${q ? 'No files match.' : 'No saved files yet.'}</p>`;
      };
      paint();
      search.addEventListener('input', paint);
      search.focus();
      list.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-path]');
        if (!row) return;
        const f = files.find(x => x.path === row.dataset.path);
        row.classList.add('is-loading');
        try {
          const type = f.mimeType || mimeFromName(f.name);
          const pseudo = { name: f.name, size: f.size || 0, type };
          let att;
          if (isTextFile(pseudo) && !/^image\//.test(type)) {
            const text = String(await fs.readFile(f.path, { encoding: 'utf-8' }));
            att = { id: newId('f'), ...pseudo, text, base64: b64FromText(text), isText: true, path: f.path };
          } else {
            const bytes = await fs.readFile(f.path, { encoding: 'binary' });
            const base64 = bytesToBase64(bytes);
            const dataUrl = `data:${type};base64,${base64}`;
            att = { id: newId('f'), ...pseudo, size: pseudo.size || bytes.length, dataUrl, base64, path: f.path };
            if (/^image\//.test(type)) att.thumb = await makeThumb(dataUrl);
            const prev = attachments.find(a => !a.isText);
            if (prev) attachments = attachments.filter(a => a !== prev);
          }
          attachments.push(att);
          renderFiles();
          close();
          input.focus();
        } catch (err) {
          row.classList.remove('is-loading');
          tbAlert(`Could not read that file: ${err?.message || err}`);
        }
      });
    } catch (err) {
      list.innerHTML = `<p class="ast-convs-empty">Could not load your files: ${esc(err?.message || err)}</p>`;
    }
  }

  function closePops() {
    root.querySelectorAll('.ast-pop').forEach(p => { if (p.classList.contains('ast-conv-pop')) p.remove(); else p.hidden = true; });
    root.querySelectorAll('[aria-expanded="true"][aria-haspopup]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function togglePop(pop, button) {
    const open = pop.hidden;
    closePops();
    pop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('button')?.focus({ preventScroll: true });
  }

  /* ---------------- sending ---------------- */

  function handleSubmit() {
    if (running && running.conv === conv) return;
    if (!getCurrentUser()) { openAccountModal(); return; }
    const text = input.value.trim();
    if (!text && !attachments.length) return;
    const quota = QuotaManager.canSendMessage();
    if (!quota.allowed) { tbAlert(quota.reason || 'You have reached your message limit.', 'Assistant'); return; }

    const primary = attachments.find(a => !a.isText) || attachments[0] || null;
    const inlined = attachments.filter(a => a !== primary && a.isText);
    let modelContent = text || (primary ? `Please look at the attached file "${primary.name}".` : '');
    for (const a of inlined) modelContent += `\n\nAttached file "${a.name}":\n\`\`\`\n${String(a.text || '').slice(0, 60000)}\n\`\`\``;

    if (!conv) startNewChat();
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg = {
      id: newId('m'), turnId, role: 'user', content: modelContent, displayText: text,
      fileData: primary ? { name: primary.name, type: primary.type, size: primary.size, base64: primary.base64, text: primary.text || null } : null,
      attachments: attachments.map(a => ({ name: a.name, size: a.size, type: a.type, thumb: a.thumb || null })),
      timestamp: Date.now(),
    };
    if (!messages.length) thread.innerHTML = '';
    messages.push(msg);
    thread.appendChild(userView(msg));
    input.value = '';
    attachments = [];
    renderFiles();
    grow();
    persist();
    renderConvList();
    scrollToBottom(true);
    runTurn();
  }

  async function runTurn() {
    const targetConv = conv;
    const targetMessages = messages;
    const userMsg = [...targetMessages].reverse().find(m => m.role === 'user');
    if (!userMsg) return;
    const history = targetMessages.slice();
    const msg = { id: newId('m'), turnId: userMsg.turnId, role: 'assistant', content: '', segments: [], toolResults: [], status: 'streaming', timestamp: Date.now() };
    const view = new TurnView(msg, { live: true });
    const abort = new AbortController();
    running = { conv: targetConv, msg, view, abort };
    targetMessages.push(msg);
    if (conv === targetConv) { thread.appendChild(view.el); scrollToBottom(true); }
    updateComposerState();
    renderConvList();

    // Abort only when nothing has arrived for a long time (long agent runs are fine).
    let lastEvent = Date.now();
    const bump = () => { lastEvent = Date.now(); };
    const idle = setInterval(() => { if (Date.now() - lastEvent > 150000) abort.abort(); }, 5000);
    const started = Date.now();

    try {
      const result = await streamChatCompletion({
        mode,
        history,
        turnId: userMsg.turnId,
        idempotencyKey: `${userMsg.turnId}_${msg.id}`,
        systemInstruction: `The person is using the Toolbox Assistant. Active tool: ${taskState.activeToolId || 'Assistant'}.`,
        currentFile: userMsg.fileData?.base64 ? userMsg.fileData : null,
        taskState,
        signal: abort.signal,
        onToken: (t) => { bump(); view.text(t); },
        onThinking: (t) => { bump(); view.thinking(t); },
        onToolCallStart: (name, args, id) => { bump(); view.toolStart(name, args, id); },
        onToolCallResult: (name, res, id) => { bump(); view.toolResult(name, res, id); },
        onStatus: (s) => { bump(); if (s?.type === 'continuing') { view.endThinking(); view.setWaiting(true); } },
        onProvider: (p) => { bump(); msg.provider = p?.provider || null; msg.providerLabel = p?.label || p?.provider || null; msg.model = p?.model || null; },
      });
      if (!String(msg.content || '').trim() && result?.text) view.text(result.text);
      msg.model = msg.model || result?.model || null;
      msg.providerLabel = msg.providerLabel || result?.provider || null;
      msg.status = abort.signal.aborted ? 'stopped' : 'success';
    } catch (err) {
      const aborted = err?.name === 'AbortError' || abort.signal.aborted;
      msg.status = aborted ? 'stopped' : 'failed';
      if (!aborted) {
        msg.error = err?.message || 'The Assistant could not answer.';
        msg.errorCode = err?.status || null;
      } else if (Date.now() - lastEvent > 150000) {
        msg.status = 'failed';
        msg.error = 'The reply stopped responding. Try again.';
      }
    } finally {
      clearInterval(idle);
      msg.ms = Date.now() - started;
      msg.content = cleanReplyText(msg.content || '');
      view.finish();
      running = null;
      persist(targetConv, targetMessages);
      if (conv === targetConv) { updateComposerState(); onContent(); }
      renderConvList();
    }
  }

  function regenerate(aiId) {
    if (running) return;
    const idx = messages.findIndex(m => m.id === aiId);
    if (idx < 0) return;
    let u = idx - 1;
    while (u >= 0 && messages[u].role !== 'user') u--;
    if (u < 0) return;
    messages.length = u + 1;
    persist();
    renderThread();
    runTurn();
  }

  /* ---------------- events ---------------- */

  on(root, 'click', async (e) => {
    if (handleMarkdownClick(e)) return;
    const t = e.target.closest('[data-act], [data-sug], [data-mode], [data-remove]');
    if (!t) {
      if (!e.target.closest('.ast-pop')) closePops();
      return;
    }
    if (t.dataset.remove) { attachments = attachments.filter(a => a.id !== t.dataset.remove); renderFiles(); return; }
    if (t.dataset.mode) { mode = t.dataset.mode; setActiveAiMode(mode); renderModeButton(); closePops(); input.focus(); return; }
    if (t.dataset.sug != null) {
      const s = SUGGESTIONS[Number(t.dataset.sug)];
      input.value = s.prompt;
      grow();
      updateComposerState();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      if (s.attach) fileInput.click();
      return;
    }
    const act = t.dataset.act;
    if (act !== 'attach-menu' && act !== 'mode-menu' && act !== 'conv-menu') closePops();
    const turn = t.closest('.ast-turn');
    const msg = turn ? messages.find(m => m.id === turn.dataset.id) : null;
    switch (act) {
      case 'new': startNewChat(); break;
      case 'side-open': setSidebar(true); break;
      case 'side-close': setSidebar(false); break;
      case 'open-conv': openConversation(t.closest('.ast-conv').dataset.id); break;
      case 'conv-menu': openConvMenu(t, t.closest('.ast-conv').dataset.id); break;
      case 'jump': scrollToBottom(true); jumpBtn.hidden = true; break;
      case 'attach-menu': togglePop(attachPop, t); break;
      case 'mode-menu': togglePop(modePop, t); break;
      case 'pick-device': fileInput.click(); break;
      case 'pick-toolbox': openToolboxFilePicker(); break;
      case 'stop': running?.abort.abort(); break;
      case 'sign-in': openAccountModal(); break;
      case 'copy-user': if (msg) copyWithFeedback(msg.displayText ?? msg.content ?? '', t); break;
      case 'edit-user': if (msg) beginEdit(turn, msg); break;
      case 'copy-ai': if (msg) copyWithFeedback(msg.content || '', t); break;
      case 'regenerate':
      case 'retry': if (msg) regenerate(msg.id); break;
      default: break;
    }
  });

  function copyWithFeedback(text, button) {
    navigator.clipboard?.writeText(text).then(() => {
      button.classList.add('is-done');
      button.innerHTML = icon('check', 15, 2.2);
      setTimeout(() => { button.classList.remove('is-done'); button.innerHTML = icon('copy', 15); }, 1400);
    }).catch(() => {});
  }

  on(root, 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (root.querySelector('.ast-pop:not([hidden])')) { closePops(); return; }
      if (isDrawer() && root.dataset.side === 'open') { setSidebar(false); return; }
    }
  });

  on(form, 'submit', (e) => { e.preventDefault(); handleSubmit(); });
  on(input, 'input', () => { grow(); updateComposerState(); });
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!(running && running.conv === conv)) handleSubmit();
    } else if (e.key === 'ArrowUp' && !input.value) {
      const last = [...messages].reverse().find(m => m.role === 'user');
      if (last) { e.preventDefault(); input.value = last.displayText ?? last.content ?? ''; grow(); updateComposerState(); }
    } else if (e.key === 'Escape' && running && running.conv === conv) {
      running.abort.abort();
    }
  });
  on(input, 'paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  on(fileInput, 'change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  on(searchInput, 'input', renderConvList);

  // Drag & drop anywhere on the chat
  let dragDepth = 0;
  const main = $('.ast-main');
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  on(main, 'dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; root.classList.add('is-dragging'); });
  on(main, 'dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  on(main, 'dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) root.classList.remove('is-dragging'); });
  on(main, 'drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove('is-dragging');
    if (!getCurrentUser()) return;
    addFiles(e.dataTransfer.files);
  });

  on(window, 'toolbox:aimodechange', (e) => { mode = e.detail?.mode || getActiveAiMode(); renderModeButton(); });
  on(window, 'toolbox:authchange', async () => {
    if (dead) return;
    await store.load();
    conv = null; messages = [];
    startNewChat();
    store.pullCloud().then(changed => { if (changed && !dead) renderConvList(); });
  });
  disposers.push(store.onChange(() => { if (!dead) renderConvList(); }));

  /* ---------------- boot ---------------- */

  renderModeButton();
  renderFiles();
  (async () => {
    await store.load();
    if (dead) return;
    const last = store.active && store.active.messages?.length ? store.active : null;
    if (last) { conv = last; messages = last.messages.map(m => ({ ...m })); }
    else { conv = { id: newId(), title: 'New chat', createdAt: Date.now(), updatedAt: Date.now(), messages: [] }; store.activeId = conv.id; }
    renderThread();
    renderConvList();
    renderTitle();
    scrollToBottom(true);
    const changed = await store.pullCloud().catch(() => false);
    if (dead) return;
    if (changed) {
      const fresh = store.conversations.find(c => c.id === conv.id);
      if (fresh && !running && fresh.messages?.length !== messages.length) { conv = fresh; messages = fresh.messages.map(m => ({ ...m })); renderThread(); scrollToBottom(true); }
      renderConvList();
    }
  })();
  setTimeout(() => { if (!dead && window.innerWidth >= 768) input.focus({ preventScroll: true }); }, 60);

  return {
    teardown() {
      dead = true;
      // A reply that is still streaming keeps going and is saved when it ends.
      disposers.forEach(fn => { try { fn(); } catch { /* ignore */ } });
    },
  };
}
