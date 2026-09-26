/* ============================================================
   TOOLBOX — Assistant engine

   One tool-calling loop for every model. The browser sends the
   conversation and the tool list to the Toolbox server
   (/api/assistant/v2/chat), which picks a model provider
   (Gemini, OpenAI, DeepSeek, Groq, OpenRouter — whichever are
   configured, failing over in order) and streams its answer
   back in the OpenAI chat-completions format.

   Tool calls run here in the browser, where the tools live:
   chess engine, device database, notes, files, calculators,
   the code playground, web browsing through the server, and
   every Toolbox tool through run_toolbox_tool. Results go back
   to the model until it answers without asking for a tool.
   ============================================================ */

import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } from './assistant-tools.js';
import { EXTRA_TOOL_DECLARATIONS, EXTRA_TOOL_NAMES, executeExtraTool } from './assistant/extra-tools.js';
import { CORE_TOOLS, TOOL_GROUPS, LOAD_TOOLS_DECLARATION, selectGroups, groupOfTool } from './assistant/tool-groups.js';
import { QuotaManager } from './quota-manager.js';
import { tbConfirm } from './dialog.js';
import { getCurrentUser, refreshUserSession } from './supabase.js';
import { TOOLS } from '../registry/index.js';

export const STORAGE_GEMINI_KEY = 'toolbox_assistant_api_key';
export const STORAGE_AI_MODE = 'toolbox_ai_mode';
export const STORAGE_AI_MODEL = 'toolbox_ai_model';
export const STORAGE_AI_PROVIDER = 'toolbox_ai_provider';

export const AI_MODES = {
  auto: {
    id: 'auto', name: 'Auto', badge: 'Auto', model: 'auto',
    description: 'Balanced thinking. Uses tools whenever they help.',
  },
  fast: {
    id: 'fast', name: 'Fast', badge: 'Fast', model: 'auto',
    description: 'Quick answers with light thinking.',
  },
  reasoning: {
    id: 'reasoning', name: 'Deep thinking', badge: 'Deep thinking', model: 'auto',
    description: 'Thinks longer. For proofs, hard problems and long multi-step tasks.',
  },
  code: {
    id: 'code', name: 'Build', badge: 'Build', model: 'auto',
    description: 'Writes, runs and fixes code; builds apps in the Code Playground.',
  },
  science: {
    id: 'science', name: 'Math & science', badge: 'Math & science', model: 'auto',
    description: 'Works problems through the math, chemistry and physics tools.',
  },
  files: {
    id: 'files', name: 'Files', badge: 'Files', model: 'auto',
    description: 'Reads, converts and edits images, PDFs, spreadsheets and documents.',
  },
};

const MODE_EFFORT = { auto: 'auto', fast: 'fast', reasoning: 'reasoning', code: 'auto', science: 'auto', files: 'auto' };
const MODE_GUIDANCE = {
  code: 'The person is building. Prefer running code over describing it: write complete programs, execute them with the code tools, read the output, fix errors and run again. For apps, open or populate the Code Playground.',
  science: 'Work every numeric step through calculate_math / calculate_chemistry or the relevant Toolbox tool and show the working. Verify results before answering.',
  files: 'Focus on the attached or saved files. Inspect them with the file tools before answering and save outputs back to Files.',
  reasoning: 'Take the time to think carefully. For multi-step work, start with update_plan, then carry out every step with tools and verify the result.',
  fast: 'Be brief. Use a tool only when it is needed for a correct answer.',
};

/* ---------------- stored preferences (kept for older callers) ---------------- */

export function getGeminiApiKey() {
  try {
    return (localStorage.getItem(STORAGE_GEMINI_KEY) || localStorage.getItem('gemini_api_key') || localStorage.getItem('toolbox_gemini_api_key') || '').trim();
  } catch { return ''; }
}

export function setGeminiApiKey(key) {
  try {
    const trimmed = (key || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_GEMINI_KEY, trimmed);
    else localStorage.removeItem(STORAGE_GEMINI_KEY);
    window.dispatchEvent(new CustomEvent('toolbox:apikeychange', { detail: { key: trimmed } }));
  } catch { /* storage unavailable */ }
}

export function getActiveAiMode() {
  try { const m = localStorage.getItem(STORAGE_AI_MODE); return AI_MODES[m] ? m : 'auto'; } catch { return 'auto'; }
}

export function setActiveAiMode(mode) {
  try {
    localStorage.setItem(STORAGE_AI_MODE, mode);
    window.dispatchEvent(new CustomEvent('toolbox:aimodechange', { detail: { mode } }));
  } catch { /* storage unavailable */ }
}

/** Preferred provider id ('' = let the server choose). */
export function getPreferredProvider() {
  try { return localStorage.getItem(STORAGE_AI_PROVIDER) || ''; } catch { return ''; }
}
export function setPreferredProvider(id) {
  try { if (id) localStorage.setItem(STORAGE_AI_PROVIDER, id); else localStorage.removeItem(STORAGE_AI_PROVIDER); } catch { /* storage unavailable */ }
}

/* ---------------- long-term memory ---------------- */

// Short facts the person asked the Assistant to keep (company name, usual rates, preferences…).
// Stored on this device; included in every conversation; editable with the remember/forget tool.
export const STORAGE_AI_MEMORY = 'toolbox_assistant_memory_v1';
const MEMORY_LIMIT = 60;

export function getAssistantMemory() {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_AI_MEMORY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveAssistantMemory(list) {
  try { localStorage.setItem(STORAGE_AI_MEMORY, JSON.stringify(list.slice(-MEMORY_LIMIT))); } catch { /* storage full or blocked */ }
  try { window.dispatchEvent(new CustomEvent('toolbox:assistant-memory', { detail: { memory: list } })); } catch { /* no window */ }
}
export function clearAssistantMemory() { saveAssistantMemory([]); }

const MEMORY_DECLARATION = {
  name: 'update_memory',
  description: 'Keeps or removes a lasting fact about the person or their business so future conversations can use it (e.g. company name, usual VAT treatment, preferred currency, clients, rates, how they like answers). Use when they ask you to remember or forget something, or state a lasting preference. Never store passwords, card or account numbers, or ID numbers.',
  parameters: {
    type: 'object',
    properties: {
      remember: { type: 'array', items: { type: 'string' }, description: 'Facts to keep, each one short sentence.' },
      forget: { type: 'array', items: { type: 'string' }, description: 'Facts (or keywords) to remove.' },
    },
  },
};

function applyMemory({ remember = [], forget = [] } = {}) {
  let list = getAssistantMemory();
  const norm = (x) => String(x || '').toLowerCase().trim();
  const forgetKeys = (Array.isArray(forget) ? forget : [forget]).map(norm).filter(Boolean);
  if (forgetKeys.length) list = list.filter(f => !forgetKeys.some(k => norm(f.text).includes(k) || k.includes(norm(f.text))));
  const secret = /\b(password|passcode|pin|cvv|card number|account number|bvn|nin)\b|\b\d{10,19}\b/i;
  const added = [];
  for (const raw of (Array.isArray(remember) ? remember : [remember])) {
    const text = String(raw || '').trim().slice(0, 240);
    if (!text || secret.test(text)) continue;
    if (list.some(f => norm(f.text) === norm(text))) continue;
    list.push({ text, at: Date.now() });
    added.push(text);
  }
  saveAssistantMemory(list);
  return { status: 'success', silent: true, remembered: added, forgotten: forgetKeys, memory: list.map(f => f.text), message: `${added.length ? `Remembered: ${added.join('; ')}. ` : ''}${forgetKeys.length ? 'Forgot the matching facts.' : ''}`.trim() || 'Memory unchanged.' };
}

/* ---------------- actions that need the person's OK ---------------- */

const CONFIRM_TOOLS = {
  send_space_message: (a) => `Send this message${a.recipient || a.to || a.username ? ` to ${a.recipient || a.to || a.username}` : ''}?\n\n${String(a.message || a.text || a.content || '').slice(0, 400)}`,
  delete_file: (a) => `Delete ${a.path || a.name || 'this file'} from Files? This cannot be undone.`,
  request_file_deletion: (a) => `Delete ${a.path || a.name || 'this file'} from Files?`,
  delete_artifact: (a) => `Delete the saved item ${a.id || a.name || ''}? This cannot be undone.`,
  calendar_cancel_event: (a) => `Cancel the calendar event ${a.title || a.id || ''}?`,
  ide_git_push: (a) => `Push the Code Playground project to ${a.repo || a.remote || 'the remote repository'}?`,
  move_file: (a) => `Move ${a.from || a.source || a.path || 'the file'} to ${a.to || a.destination || 'the new location'}?`,
  rename_file: (a) => `Rename ${a.path || a.from || 'the file'} to ${a.newName || a.to || 'the new name'}?`,
};

// Evaluation harness hook: when set, decides confirmations instead of showing the dialog.
let confirmOverride = null;
export function setConfirmOverride(fn) { confirmOverride = typeof fn === 'function' ? fn : null; }

async function confirmAction(name, args) {
  const describe = CONFIRM_TOOLS[name];
  if (!describe) return true;
  if (confirmOverride) {
    try { return Boolean(await confirmOverride(name, args || {}, describe(args || {}))); } catch { return false; }
  }
  try {
    return Boolean(await tbConfirm(describe(args || {}), { title: 'The Assistant wants to do this', confirmText: 'Allow', cancelText: 'Don\'t allow', destructive: /delete|cancel/.test(name) }));
  } catch { return false; }
}

/* ---------------- tool list ---------------- */

/** Gemini-style schemas ('OBJECT', 'STRING') → JSON Schema every provider accepts. */
const UNSUPPORTED_SCHEMA_KEYS = new Set(['additionalProperties', 'default', 'examples', 'example', '$schema', '$id', 'pattern', 'minLength', 'maxLength', 'title', 'const']);

function normalizeSchema(node) {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (v === undefined || v === null) continue;
    if (UNSUPPORTED_SCHEMA_KEYS.has(k)) continue;   // keys some providers (Gemini) reject
    if (k === 'type' && typeof v === 'string') out.type = v.toLowerCase();
    else if (k === 'properties' && v && typeof v === 'object') {
      out.properties = {};
      for (const [pk, pv] of Object.entries(v)) out.properties[pk] = normalizeSchema(pv);
    } else if (k === 'nullable' || k === 'format' && typeof v === 'string' && !/^(date-time|date|email|uri|enum)$/.test(v)) {
      continue;
    } else out[k] = normalizeSchema(v);
  }
  if (out.type === 'array' && !out.items) out.items = { type: 'string' };
  if (out.type === 'object' && !out.properties) out.properties = {};
  if (Array.isArray(out.required) && out.properties) {
    out.required = out.required.filter(r => r in out.properties);
    if (!out.required.length) delete out.required;
  }
  if (Array.isArray(out.enum)) out.enum = out.enum.map(String);
  return out;
}


function buildToolList(declarations) {
  const seen = new Set();
  const list = [];
  for (const d of declarations) {
    if (!d?.name || seen.has(d.name)) continue;
    seen.add(d.name);
    list.push({
      type: 'function',
      function: {
        name: d.name,
        description: String(d.description || '').slice(0, 1000),
        parameters: normalizeSchema(d.parameters || { type: 'object', properties: {} }),
      },
    });
  }
  return list;
}

let defaultTools = null;
/** Core tools + the capability pack. Per-tool navigation declarations are replaced by find/run/open_toolbox_tool. */
function defaultToolList() {
  if (defaultTools) return defaultTools;
  // ASSISTANT_TOOL_DECLARATIONS mixes hand-written tools (Gemini-style 'OBJECT' schemas) with one
  // generated "open this tool" declaration per registry tool (lowercase 'object'). Several share a
  // name (unit_converter, weather_forecast, regex_tester…), so keep the hand-written one by shape,
  // not by name; the generated ones are covered by find/run/open_toolbox_tool.
  const handWritten = ASSISTANT_TOOL_DECLARATIONS.filter(d => d?.name && String(d.parameters?.type || '').toUpperCase() === 'OBJECT' && d.parameters?.type !== 'object' && !EXTRA_TOOL_NAMES.has(d.name));
  defaultTools = buildToolList([LOAD_TOOLS_DECLARATION, MEMORY_DECLARATION, ...EXTRA_TOOL_DECLARATIONS, ...handWritten]).slice(0, 128);
  return defaultTools;
}

/* ---------------- conversation → chat messages ---------------- */

const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|csv|sql|x-sh))/;

function decodeBase64Text(b64) {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

/* PDFs are read here, before the request: the text of every page (with page markers) goes to the
   model, and a scanned PDF with little text is sent as page images so a vision model can read it. */
const PDF_TEXT_LIMIT = 150_000;
const SCAN_PAGES = 4;
const pdfCache = new WeakMap();   // file object → { text, pages, images }; kept off the stored message

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// pdf.js 6 uses Map#getOrInsertComputed, which older browsers lack.
function polyfillMapUpserts() {
  for (const C of [Map, WeakMap]) {
    if (!C.prototype.getOrInsertComputed) {
      Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true, value(key, fn) { if (!this.has(key)) this.set(key, fn(key)); return this.get(key); } });
    }
    if (!C.prototype.getOrInsert) {
      Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true, value(key, v) { if (!this.has(key)) this.set(key, v); return this.get(key); } });
    }
  }
}

async function preparePdf(file) {
  if (!file?.base64 || pdfCache.has(file)) return;
  const type = file.type || file.mimeType || '';
  if (!/pdf/i.test(type) && !/\.pdf$/i.test(file.name || '')) return;
  const info = { text: '', pages: 0, images: [] };
  pdfCache.set(file, info);
  try {
    polyfillMapUpserts();
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const doc = await pdfjs.getDocument({ data: base64ToBytes(file.base64) }).promise;
    info.pages = doc.numPages;
    let text = '';
    for (let n = 1; n <= doc.numPages && text.length < PDF_TEXT_LIMIT; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').trim();
      text += `\n\n[Page ${n}]\n${pageText}`;
    }
    info.text = text.trim().slice(0, PDF_TEXT_LIMIT);
    // Little text per page → probably scanned: render the first pages for a vision model.
    if (info.text.replace(/\[Page \d+\]/g, '').trim().length < 25 * Math.min(doc.numPages, SCAN_PAGES)) {
      for (let n = 1; n <= Math.min(doc.numPages, SCAN_PAGES); n++) {
        const page = await doc.getPage(n);
        const vp = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(vp.width, 1800); canvas.height = Math.round(vp.height * (canvas.width / vp.width));
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: 1.6 * canvas.width / vp.width }) }).promise;
        info.images.push(canvas.toDataURL('image/jpeg', 0.82));
      }
    }
    doc.destroy?.();
  } catch (err) {
    info.error = err?.message || 'could not read the PDF';
  }
}

/* Word (.docx) and Excel (.xlsx) attachments are turned into text the same way. */
const docCache = new WeakMap();

async function unzipEntry(bytes, wanted) {
  // Minimal ZIP reader: find the entry in the central directory, inflate it with the browser.
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let p = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return dec.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extra + comment;
  }
  return null;
}

async function prepareOffice(file) {
  if (!file?.base64 || docCache.has(file)) return;
  const name = file.name || '';
  const type = file.type || file.mimeType || '';
  const isDocx = /\.docx$/i.test(name) || /wordprocessingml/.test(type);
  const isXlsx = /\.xlsx$/i.test(name) || /spreadsheetml/.test(type);
  if (!isDocx && !isXlsx) return;
  const info = { text: '', kind: isDocx ? 'Word document' : 'Excel workbook' };
  docCache.set(file, info);
  try {
    const bytes = base64ToBytes(file.base64);
    if (isDocx) {
      const xml = await unzipEntry(bytes, 'word/document.xml') || '';
      info.text = xml
        .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n').trim();
    } else {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bytes.buffer);
      const out = [];
      wb.eachSheet((sheet) => {
        out.push(`[Sheet: ${sheet.name}]`);
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const cells = (row.values || []).slice(1).map(v => {
            if (v == null) return '';
            if (typeof v === 'object') return v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : v instanceof Date ? v.toISOString().slice(0, 10) : '');
            return v;
          });
          out.push(cells.join(','));
        });
      });
      info.text = out.join('\n');
    }
    info.text = info.text.slice(0, PDF_TEXT_LIMIT);
  } catch (err) {
    info.error = err?.message || 'could not read the file';
  }
}

function fileParts(file) {
  if (!file?.base64) return [];
  const type = file.type || file.mimeType || 'application/octet-stream';
  const name = file.name || 'attachment';
  const office = docCache.get(file);
  if (office && !office.error && office.text) {
    return [{ type: 'text', text: `Attached ${office.kind} "${name}"${office.text.length >= PDF_TEXT_LIMIT ? ' (long: end cut off)' : ''}:\n${office.text}` }];
  }
  const pdf = pdfCache.get(file);
  if (pdf && !pdf.error) {
    const { text, pages, images } = pdf;
    const parts = [];
    if (images.length) {
      parts.push({ type: 'text', text: `Attached PDF "${name}" (${pages} page${pages === 1 ? '' : 's'}) looks scanned; the first ${images.length} page${images.length === 1 ? ' is' : 's are'} attached as images. Read them carefully.` });
      images.forEach(url => parts.push({ type: 'image_url', image_url: { url } }));
    }
    if (text.replace(/\[Page \d+\]/g, '').trim()) {
      parts.push({ type: 'text', text: `Attached PDF "${name}" (${pages} pages). Text by page${text.length >= PDF_TEXT_LIMIT ? ' (long document: later pages cut off)' : ''}:\n${text}\n\nWhen you answer from it, cite the page numbers.` });
    }
    if (parts.length) return parts;
  }
  if (type.startsWith('image/')) {
    return [{ type: 'image_url', image_url: { url: `data:${type};base64,${file.base64}` } }];
  }
  if (TEXT_TYPES.test(type) || /\.(txt|md|csv|json|js|ts|py|html|css|xml|yml|yaml|sql|log)$/i.test(name)) {
    const text = decodeBase64Text(file.base64);
    return [{ type: 'text', text: `Attached file "${name}" (${type}):\n\`\`\`\n${text.slice(0, 60000)}${text.length > 60000 ? '\n… (truncated)' : ''}\n\`\`\`` }];
  }
  return [{ type: 'text', text: `Attached file "${name}" (${type}, ${Math.round(file.base64.length * 0.75 / 1024)} KB). Its bytes are available to the file tools (PDF, image, dataset and conversion tools) as the current file.` }];
}

function toolContextOf(msg) {
  if (!msg.toolResults?.length) return '';
  const lines = [];
  for (const r of msg.toolResults) {
    const data = r?.data || r || {};
    const name = r?.toolName || data.type || 'tool';
    const summary = data.message || data.summary || data.title || '';
    const bits = [];
    if (data.url) bits.push(`URL: ${data.url}`);
    if (data.excerpt || data.aboutExcerpt) bits.push(String(data.excerpt || data.aboutExcerpt).slice(0, 800));
    if (typeof data.content === 'string') bits.push(data.content.slice(0, 1200));
    if (data.fen) bits.push(`FEN: ${data.fen}`);
    lines.push(`- ${name}: ${summary}${bits.length ? `\n  ${bits.join('\n  ')}` : ''}`);
  }
  return `\n\n[Tools used in this reply]\n${lines.join('\n')}`;
}

const RECENT_TURNS = 6;          // messages sent in full; older ones are shortened
const OLD_MESSAGE_CHARS = 1500;
const MAX_HISTORY = 40;          // messages sent at all

function shorten(text, max) {
  const t = String(text || '');
  return t.length > max ? `${t.slice(0, max)}… [earlier text shortened]` : t;
}

function buildMessages(history, currentFile, system) {
  const out = [{ role: 'system', content: system }];
  const recent = history.slice(-MAX_HISTORY);
  const cut = recent.length - RECENT_TURNS;
  // Attachments are re-read only for the last two user messages; older ones are named, not resent.
  const userIdx = recent.map((m, i) => (m.role === 'user' ? i : -1)).filter(i => i >= 0);
  const fileTurns = new Set(userIdx.slice(-2));
  recent.forEach((msg, i) => {
    const isLatest = i === recent.length - 1;
    const old = i < cut;
    if (msg.role === 'user') {
      const parts = [];
      const file = msg.fileData?.base64 ? msg.fileData : (isLatest ? currentFile : null);
      if (file && fileTurns.has(i)) parts.push(...fileParts(file));
      else if (file) parts.push({ type: 'text', text: `[Earlier attachment: ${file.name || 'file'} (${file.type || 'file'})]` });
      if (msg.content) parts.push({ type: 'text', text: old ? shorten(msg.content, OLD_MESSAGE_CHARS) : String(msg.content) });
      if (!parts.length) return;
      out.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      const text = old ? shorten(msg.content, OLD_MESSAGE_CHARS) : `${msg.content || ''}${toolContextOf(msg)}`.trim();
      if (text) out.push({ role: 'assistant', content: text });
    }
  });
  // Providers require the conversation to end on a user turn.
  if (out.length === 1 || out[out.length - 1].role !== 'user') out.push({ role: 'user', content: 'Continue.' });
  return out;
}

/* ---------------- tool results → model ---------------- */

function compactForModel(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^data:[\w/+.-]+;base64,/.test(value) && value.length > 400) return `[binary data, ${Math.round(value.length * 0.75 / 1024)} KB]`;
    return value.length > 6000 ? `${value.slice(0, 6000)}… (${value.length - 6000} more characters)` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth > 6) return '[…]';
  if (Array.isArray(value)) {
    const items = value.slice(0, 60).map(v => compactForModel(v, depth + 1));
    if (value.length > 60) items.push(`… ${value.length - 60} more`);
    return items;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'function' || k === 'element' || k === 'node') continue;
    if (k === 'svg' && typeof v === 'string') { out[k] = `[SVG drawing, ${v.length} characters, shown to the person]`; continue; }
    if (k === 'design' && value.renderer === 'container-design') { out[k] = '[full design shown to the person in the preview card]'; continue; }
    out[k] = compactForModel(v, depth + 1);
  }
  return out;
}

function toolResultText(result) {
  let text;
  try { text = JSON.stringify(compactForModel(result)); } catch { text = String(result); }
  return text.length > 24000 ? `${text.slice(0, 24000)}… (truncated)` : text;
}

/* ---------------- figure check ---------------- */

// Models sometimes retype a tool's figure wrongly (₦2,878,750 → ₦2,875,750). After a reply,
// any large number in the text that is almost — but not exactly — a number a tool returned
// is corrected to the tool's value.
function toolNumbers(results) {
  const out = new Set();
  const walk = (v, depth = 0) => {
    if (depth > 6 || v == null) return;
    if (typeof v === 'number' && Number.isFinite(v)) { out.add(v); out.add(Math.round(v * 100) / 100); return; }
    if (typeof v === 'string') {
      for (const m of v.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) { const n = Number(m[0].replace(/,/g, '')); if (Number.isFinite(n)) out.add(n); }
      return;
    }
    if (Array.isArray(v)) { v.slice(0, 200).forEach(x => walk(x, depth + 1)); return; }
    if (typeof v === 'object') for (const x of Object.values(v)) walk(x, depth + 1);
  };
  results.forEach(r => walk(r));
  return [...out];
}

function formatLike(original, value) {
  const decimals = (original.split('.')[1] || '').length;
  const fixed = value.toFixed(decimals);
  if (!original.includes(',')) return fixed;
  const [int, dec] = fixed.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
}

export function checkFigures(text, results) {
  const known = toolNumbers(results).filter(n => Math.abs(n) >= 1000);
  if (!known.length || !text) return [];
  const fixes = [];
  const seen = new Set();
  for (const m of String(text).matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{4,}(?:\.\d+)?/g)) {
    const raw = m[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    const value = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < 1000) continue;
    if (/^(19|20)\d\d$/.test(raw)) continue;                          // years
    if (known.some(k => Math.abs(k - value) < 0.005)) continue;       // exact (to the cent)
    // Near miss: same number of integer digits and within 0.5%.
    const digits = String(Math.trunc(Math.abs(value))).length;
    const close = known.filter(k => String(Math.trunc(Math.abs(k))).length === digits && Math.abs(k - value) / Math.abs(k) < 0.005);
    if (close.length !== 1) continue;                                 // ambiguous or unrelated: leave it
    // Only typo-like slips: at most two digits differ, and the tool's figure is not already quoted
    // elsewhere in the reply (then the other number is probably deliberate).
    const a = String(Math.trunc(Math.abs(value))), b = String(Math.trunc(Math.abs(close[0])));
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    if (diff > 2) continue;
    const plain = String(text).replace(/,/g, '');
    if (plain.includes(b)) continue;
    fixes.push({ from: raw, to: formatLike(raw, close[0]) });
  }
  return fixes;
}

/* ---------------- streaming ---------------- */

async function authHeader(forceRefresh = false) {
  let user = getCurrentUser();
  if (forceRefresh && user?.refreshToken) user = await refreshUserSession();
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}

class GatewayError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function openGateway(body, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('/api/assistant/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(attempt > 0)) },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok && res.body) {
      if (!/event-stream/i.test(res.headers.get('content-type') || '')) {
        const txt = await res.text().catch(() => '');
        let msg = '';
        try { msg = JSON.parse(txt).error || ''; } catch { /* not JSON */ }
        throw new GatewayError(msg || 'The Toolbox server answered in an unexpected format. Redeploy the API on Render so it has the new Assistant service.', 502);
      }
      return res;
    }
    const payload = await res.json().catch(() => ({}));
    if (res.status === 401 && attempt === 0 && getCurrentUser()?.refreshToken) continue;
    if (res.status === 404) throw new GatewayError('The Assistant service is not available on this server yet. Redeploy the Toolbox API.', 404);
    throw new GatewayError(payload.error || `The Assistant service answered with ${res.status}.`, res.status);
  }
  throw new GatewayError('Sign in to Toolbox to use the Assistant.', 401);
}

/**
 * Reads one streamed model turn.
 * Returns { text, thinking, toolCalls, finish, provider }.
 */
async function readTurn(res, { onText, onThinking, onProvider, signal }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let text = '', thinking = '', finish = null, provider = null;
  const calls = [];
  let inThought = false, pending = '';   // Gemini wraps thoughts in <thought>…</thought> inside content

  const emitContent = (chunk) => {
    pending += chunk;
    for (;;) {
      if (!inThought) {
        const at = pending.indexOf('<thought>');
        if (at === -1) {
          // Hold back a partial "<thought" at the end of the chunk.
          const keep = partialTagTail(pending, '<thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { text += out; onText(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { text += out; onText(out); }
        pending = pending.slice(at + 9);
        inThought = true;
      } else {
        const at = pending.indexOf('</thought>');
        if (at === -1) {
          const keep = partialTagTail(pending, '</thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { thinking += out; onThinking(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { thinking += out; onThinking(out); }
        pending = pending.slice(at + 10);
        inThought = false;
      }
    }
  };

  const handle = (evt, data) => {
    if (data === '[DONE]') return;
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (evt === 'provider') { provider = json; onProvider(json); return; }
    if (evt === 'error' || (json.error && !json.choices)) {
      throw new GatewayError(json.error?.message || json.error || 'The model stopped unexpectedly.', 502);
    }
    const choice = json.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || choice.message || {};
    const reasoning = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
    if (typeof reasoning === 'string' && reasoning) { thinking += reasoning; onThinking(reasoning); }
    if (typeof delta.content === 'string' && delta.content) emitContent(delta.content);
    for (const tc of delta.tool_calls || []) {
      const idx = typeof tc.index === 'number' ? tc.index : calls.length;
      const slot = calls[idx] || (calls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
      if (tc.extra_content) slot.extra_content = tc.extra_content;   // Gemini thought signatures
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line) { event = 'message'; continue; }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
        if (line.startsWith('data:')) handle(event, line.slice(5).trim());
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  if (pending) {
    if (inThought) { thinking += pending; onThinking(pending); } else { text += pending; onText(pending); }
  }
  if (!provider && !text && !thinking && !calls.length && !signal?.aborted) {
    throw new GatewayError('The model service closed the connection without answering. Try again in a moment.', 502);
  }
  const toolCalls = calls.filter(c => c && c.function.name).map((c, i) => ({ ...c, id: c.id || `call_${Date.now().toString(36)}_${i}` }));
  return { text, thinking, toolCalls, finish, provider };
}

function partialTagTail(s, tag) {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch {
    // Some models close the JSON early or add trailing text.
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    return { input: String(raw) };
  }
}

/* ---------------- system prompt ---------------- */

const CAPABILITIES = `You are Toolbox Assistant, the agent built into Toolbox — a workspace of 100+ tools — created by Meyiwa-Meyigbene Nifemi Edun. You do things, not just describe them. You have real tools and you should use them freely and chain them to finish the whole job.

How you work
- For jobs with three or more distinct steps (research, building something, analysing files), call update_plan first with short steps (skip it for simple questions), then do the steps with tools, updating the plan as each finishes. Keep going until the task is complete; do not stop to ask permission for ordinary steps.
- Prefer computing to guessing: arithmetic and algebra go through calculate_math, chemistry through calculate_chemistry, code through the code execution tools. Check results before you report them.
- Only some tools are loaded at a time. If you need one you don't have, call load_tools with its group first (the groups are listed in load_tools).
- Any Toolbox tool can be used: call find_toolbox_tools to discover the right one, run_toolbox_tool to run it on input directly, and open_toolbox_tool to open it for the person.
- Chess: chess_analyze evaluates a position or game (best move, evaluation, opening, move quality); chess_play plays a move and lets the engine answer; chess_open_board opens a position on the Chess board. Never invent evaluations — use the engine.
- Devices: device_specs and device_compare cover 1,300+ phones, tablets, laptops, chips, CPUs, GPUs, watches, headphones and consoles from the Toolbox database.
- Vehicles: vehicle_lookup decodes VINs and gives specifications for cars by make, model and year.
- Web: browse_web / browser_navigate / browser_scrape / browser_crawl read live pages; search_images finds pictures. Cite the pages you used.
- Visuals: draw_illustration draws SVG illustrations and diagrams; csv_analyze_and_chart and the chart tools make charts; render_map shows places.
- Container buildings: design_container designs and previews container/portacabin offices, shops, cafés, homes, site offices and stacked or joined structures from a brief or exact specs (3D preview, floor plan, NGN estimate); revise the same design with revise + changes when the person asks for edits.
- Notes and files: create_note, update_note, list_notes, get_note; create_file, save_file and the artifact tools keep work in Files.
- Scripture: the Bible and Quran tools read verses and passages; quote them exactly as returned.
- Building apps: write complete working code and put it in the Code Playground (or run it with the code tools), then report what you built.

How you answer
- Numbers from tools are final: copy every figure exactly as the tool returned it (with thousands separators), never retype or recompute it yourself, and never invent derived figures (per-person costs, percentages) unless you computed them with a tool.
- Lead with the answer. Use Markdown: short headings when the reply is long, lists, tables for comparisons, fenced code with a language, and LaTeX ($…$ inline, $$…$$ display) for math.
- When a tool shows a card (board, map, chart, device comparison, illustration, note), do not repeat its contents; add only what the card does not say.
- Never mention internal tool names, renderers or JSON to the person.
`;

const LEGACY_RULES = `- Currency: default to Nigerian Naira (₦, NGN) for prices, invoices and quotes unless the person asks for another currency. Nigerian VAT is 7.5%.
- Use a tool only when it fits the request. Medical conditions and symptoms: search_diseases. Chemical compositions of foods or plants: answer in text or use calculate_chemistry; never the disease or anatomy tools.
- Places: for "nearest", named businesses or directions, use search_places_nearby and keep the exact business name in query (e.g. "Shoprite"), separate from category and location. Lead with the nearest result and its distance. The map card already lists the places, so do not repeat them as a list, and do not call render_map after search_places_nearby.
- Audio: "play …" requests use play_sound.
- Maths: every computation goes through calculate_math (never compute in your head); references and theorems through query_math_knowledge. Never present conjectures (Collatz, Goldbach, Riemann) as proven. Show the equation, the result, the key steps and a check.
- Anatomy: explore_anatomy with the exact structure name.
- Web: never guess URLs; pass the question as query unless the person gave a site. Read what the pages say and answer from it with sources; follow links to subpages when the answer is not on the homepage. Never invent prices; mark unknowns as N/A. For "what does X look like", use search_images.
- Notes, files, calendar: create_note, save_file/create_file, calendar_add_event/calendar_get_events as asked.
- Files the person has not attached: ask them to attach or drop the file.
- Formatting: real symbols (→ ° ± × ≤ ≠ π) or LaTeX, never HTML entities or escape codes. Structured Markdown, no emojis, a polished professional tone. Complete, runnable code in fenced blocks.
- The current date and time are in the Current environment section below.`;

/* ---------------- main entry ---------------- */

export async function streamChatCompletion({
  mode = null,
  history = [],
  systemInstruction = '',
  currentFile = null,
  taskState = {},
  turnId = null,
  idempotencyKey = null,
  onToken = () => {},
  onThinking = () => {},
  onToolCallStart = () => {},
  onToolCallResult = () => {},
  onStatus = () => {},
  onProvider = () => {},
  signal = null,
  scope = 'global',
  toolDeclarations = null,
  toolExecutor = null,
  maxSteps = null,
  provider = null,
}) {
  QuotaManager.recordMessage?.();

  const selectedMode = AI_MODES[mode] ? mode : getActiveAiMode();
  const isRealBrowser = typeof window !== 'undefined' && Boolean(window.location?.hostname);
  if (!isRealBrowser) {
    const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || 'Hello';
    const mockText = `Response to: ${lastUser}`;
    onToken(mockText);
    return { text: mockText, taskState, toolResults: [] };
  }

  const now = new Date();
  const environment = `\nCurrent environment\n- Date and time: ${now.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})\n- App: ${window.location.origin}\n- Active tool: ${taskState?.activeToolId || 'Home'}\n`;
  const memory = getAssistantMemory();
  const memoryBlock = memory.length ? `\nWhat you know about this person (they asked you to keep this; use it where it helps, don't recite it):\n${memory.map(f => `- ${f.text}`).join('\n')}\n` : '';
  const guidance = MODE_GUIDANCE[selectedMode] ? `\nMode: ${AI_MODES[selectedMode].name}. ${MODE_GUIDANCE[selectedMode]}\n` : '';
  const system = scope === 'global'
    ? `${CAPABILITIES}\nHouse rules\n${LEGACY_RULES}\n${environment}${memoryBlock}${guidance}${systemInstruction ? `\n${systemInstruction}` : ''}`
    : `${systemInstruction || ''}\n${environment}`;

  // Tools: a caller-supplied list as is; otherwise the core set plus the groups this conversation needs.
  const fullList = toolDeclarations ? buildToolList(toolDeclarations) : defaultToolList();
  const byName = new Map(fullList.map(t => [t.function.name, t]));
  const activeGroups = toolDeclarations ? null : selectGroups({ history, hasFile: Boolean(currentFile?.base64 || history.at(-1)?.fileData?.base64), fileType: currentFile?.type || history.at(-1)?.fileData?.type || '' });
  const toolsForStep = () => {
    if (!activeGroups) return fullList;
    const names = new Set(CORE_TOOLS);
    for (const g of activeGroups) for (const t of TOOL_GROUPS[g]?.tools || []) names.add(t);
    return [...names].map(n => byName.get(n)).filter(Boolean);
  };
  // Read attached PDFs (last two user messages) before building the request.
  const recentFiles = [currentFile, ...history.filter(m => m.role === 'user').slice(-2).map(m => m.fileData)].filter(Boolean);
  await Promise.all(recentFiles.flatMap(f => [preparePdf(f).catch(() => {}), prepareOffice(f).catch(() => {})]));
  const messages = buildMessages(history, currentFile, system);
  let sticky = provider || getPreferredProvider() || undefined;
  const limit = maxSteps || (selectedMode === 'fast' ? 6 : selectedMode === 'auto' || selectedMode === 'files' ? 16 : 24);

  let fullText = '';
  let fullThinking = '';
  let providerInfo = null;
  const executed = [];
  const cache = new Map();

  const runTool = async (name, args, id) => {
    const key = `${name}:${JSON.stringify(args || {})}`;
    if (cache.has(key)) return cache.get(key);
    if (name === 'render_map' && executed.some(r => r?.renderer === 'map-view')) {
      const ref = { status: 'success', type: 'map-view-ref', message: 'The map is already shown above.' };
      cache.set(key, ref);
      return ref;
    }
    if (name === 'update_memory') {
      const res = applyMemory(args || {});
      cache.set(key, res);
      return res;
    }
    if (CONFIRM_TOOLS[name] && !(await confirmAction(name, args))) {
      const res = { status: 'cancelled', success: false, message: 'The person did not allow this action. Do not retry it; ask what they would like instead.' };
      onToolCallStart(name, args, id);
      onToolCallResult(name, { ...res, toolName: name }, id);
      return res;
    }
    if (name === 'load_tools') {
      const wanted = (Array.isArray(args?.groups) ? args.groups : [args?.groups]).map(String).filter(g => TOOL_GROUPS[g]);
      wanted.forEach(g => activeGroups?.add(g));
      const loaded = wanted.flatMap(g => TOOL_GROUPS[g].tools).filter(n => byName.has(n));
      const res = { status: 'success', silent: true, loaded: wanted, tools: loaded, message: wanted.length ? `Loaded: ${loaded.join(', ')}.` : `Unknown group. Groups: ${Object.keys(TOOL_GROUPS).join(', ')}.` };
      cache.set(key, res);
      return res;
    }
    // A tool from a group that is not loaded yet still runs; load its group for the next step.
    const g = groupOfTool(name);
    if (g && activeGroups && !activeGroups.has(g)) activeGroups.add(g);
    onToolCallStart(name, args, id);
    let result;
    try {
      if (toolExecutor) result = await toolExecutor(name, args);
      if (result === undefined && EXTRA_TOOL_NAMES.has(name)) result = await executeExtraTool(name, args);
      if (result === undefined) result = await executeAssistantTool(name, args, { currentFile, taskState });
      if (result == null || typeof result !== 'object') result = { status: 'success', message: String(result ?? 'Done.') };
    } catch (err) {
      result = { status: 'error', success: false, error: err?.message || 'The tool failed.', message: `That did not work: ${err?.message || 'unknown error'}` };
    }
    if (!result.toolName) result.toolName = name;
    cache.set(key, result);
    executed.push(result);
    onToolCallResult(name, result, id);
    return result;
  };

  for (let step = 0; step < limit; step++) {
    if (signal?.aborted) break;
    onStatus({ type: step === 0 ? 'thinking' : 'continuing', step });
    const tools = toolsForStep();
    const res = await openGateway({
      messages,
      tools: tools.length ? tools : undefined,
      mode: MODE_EFFORT[selectedMode] || 'auto',
      provider: sticky,
      turnId, idempotencyKey,
    }, signal);

    const turn = await readTurn(res, {
      signal,
      onText: (t) => { fullText += t; onToken(t); },
      onThinking: (t) => { fullThinking += t; onThinking(t); },
      onProvider: (p) => { providerInfo = p; onProvider(p); },
    });
    // Later steps of this reply stay with the model that answered (keeps its context and signatures).
    if (providerInfo?.provider) sticky = providerInfo.provider;

    if (!turn.toolCalls.length) break;

    // Keep the model's own words (and Gemini's signatures) with its tool calls.
    messages.push({
      role: 'assistant',
      content: turn.text || null,
      tool_calls: turn.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments || '{}' }, ...(c.extra_content ? { extra_content: c.extra_content } : {}) })),
    });
    if (turn.text && !/\s$/.test(fullText)) { fullText += '\n\n'; onToken('\n\n'); }

    // Independent calls from one step run at the same time; results go back in the model's order.
    const results = await Promise.all(turn.toolCalls.map(call => (signal?.aborted
      ? Promise.resolve({ status: 'error', message: 'Stopped.' })
      : runTool(call.function.name, parseArgs(call.function.arguments), call.id))));
    turn.toolCalls.forEach((call, i) => {
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolResultText(results[i]) });
    });

    if (step === limit - 1 && !signal?.aborted) {
      // Out of steps: ask for a final answer without tools.
      messages.push({ role: 'user', content: 'You have used the available tool steps. Summarise what you did and give your final answer now, without calling more tools.' });
      const last = await openGateway({ messages, mode: MODE_EFFORT[selectedMode] || 'auto', provider: providerInfo?.provider }, signal);
      await readTurn(last, {
        signal,
        onText: (t) => { fullText += t; onToken(t); },
        onThinking: (t) => { fullThinking += t; onThinking(t); },
        onProvider: () => {},
      });
    }
  }

  if (!fullText.trim() && executed.length) {
    const failed = executed.filter(r => r.status === 'error' || r.success === false);
    const ok = executed.filter(r => !failed.includes(r));
    const lines = [...ok.map(r => r.message).filter(Boolean), ...failed.map(r => `Could not finish: ${r.error || r.message}`)];
    fullText = lines.join('\n') || 'Done.';
    onToken(fullText);
  }

  const fixes = executed.length ? checkFigures(fullText, executed) : [];
  for (const f of fixes) fullText = fullText.split(f.from).join(f.to);

  onStatus({ type: 'done' });
  return {
    fixes,
    text: fullText,
    thinking: fullThinking,
    taskState,
    toolResults: executed,
    provider: providerInfo?.label || providerInfo?.provider || null,
    model: providerInfo?.model || null,
  };
}

/** Checks the server gateway and lists the model providers it can use. */
export async function testAiProviderConnection() {
  const start = Date.now();
  try {
    const res = await fetch('/api/assistant/v2/providers', { headers: await authHeader() });
    if (!res.ok) return { success: false, message: res.status === 404 ? 'The Assistant service is not deployed on the server yet.' : `The server answered with ${res.status}.` };
    const { providers = [] } = await res.json();
    if (!providers.length) return { success: false, providers, message: 'No model provider keys are set on the server.' };
    return { success: true, providers, latencyMs: Date.now() - start, message: `Connected. Models available: ${providers.map(p => p.label).join(', ')}.` };
  } catch (err) {
    return { success: false, message: err?.message || 'Could not reach the Toolbox server.' };
  }
}

export async function listAiProviders() {
  const r = await testAiProviderConnection();
  return r.providers || [];
}

export async function generateIntelligentResponse(prompt, options = {}) {
  return streamChatCompletion({ history: [{ role: 'user', content: prompt }], ...options });
}
