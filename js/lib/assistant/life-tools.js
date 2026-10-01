/* ============================================================
   TOOLBOX — Assistant: everyday-life tools

   The tools that let the Assistant act on the person's own
   things rather than only answer questions:

   - Calendar: move or edit an event; set, list and cancel
     reminders (delivered through the notification bell).
   - Files: search everything in Files by name and by what the
     documents say (text, Markdown, CSV, Word and PDF), and read
     a document so it can be summarised or questioned.

   Registered as tool packs, so they load with the existing
   "calendar" and "files" groups.
   ============================================================ */

import { registerToolPack } from './tool-packs.js';
import { loadEvents, updateEvent } from '../calendar-store.js';
import { addReminder, cancelReminder, upcomingReminders, followEvent, localIso } from '../reminders.js';

/* ---------------- calendar ---------------- */

const CALENDAR_DECLARATIONS = [
  {
    name: 'calendar_update_event',
    description: 'Moves or edits an existing calendar event: new date or time, title, location, notes or category. Find it by eventId (from calendar_get_events) or by title (plus its current date when there could be several). When only the start time changes, the event keeps its length. Reminders attached to the event move with it.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event id, when known.' },
        title: { type: 'string', description: 'Current title (or part of it) of the event to change.' },
        date: { type: 'string', description: 'Current date of the event (YYYY-MM-DD), to tell apart events with the same title.' },
        newDate: { type: 'string', description: 'New date, YYYY-MM-DD.' },
        newStartTime: { type: 'string', description: 'New start time, 24h HH:MM.' },
        newEndTime: { type: 'string', description: 'New end time, 24h HH:MM.' },
        newTitle: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string', description: 'work, personal, meeting, deadline, holiday, health or family.' },
        isAllDay: { type: 'boolean' },
      },
    },
  },
  {
    name: 'set_reminder',
    description: 'Sets a reminder that pops up in the Toolbox notification bell (and as a desktop alert if allowed). Either give "at" (a local date and time), or tie it to a calendar event with eventId or eventTitle plus "before" (e.g. "1 day", "2 hours", "30 min"); a reminder tied to an event follows the event if it moves.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind them about, as they would want to read it.' },
        at: { type: 'string', description: 'Local date-time, YYYY-MM-DDTHH:MM (a bare date means 09:00).' },
        eventId: { type: 'string' },
        eventTitle: { type: 'string', description: 'Title of the event to remind them about, if the id is unknown.' },
        before: { type: 'string', description: 'How long before the event, e.g. "1 day", "2 hours", "15 min". Default 1 hour.' },
      },
    },
  },
  {
    name: 'list_reminders',
    description: 'Lists the reminders still to come.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancels upcoming reminders by id or by words in their text.',
    parameters: { type: 'object', properties: { reminder: { type: 'string', description: 'Reminder id or words from its text.' } }, required: ['reminder'] },
  },
];

const today = () => localIso(new Date()).slice(0, 10);
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = (n) => { const v = Math.max(0, Math.min(23 * 60 + 59, n)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
const when = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Finds one event by id, or by title (preferring the given date, then the next one to come). */
export function findEvent({ eventId, title, date } = {}, events = loadEvents()) {
  if (eventId) return events.find(e => e.id === eventId) || null;
  const q = String(title || '').trim().toLowerCase();
  if (!q) return null;
  let matches = events.filter(e => e.title.toLowerCase() === q);
  if (!matches.length) matches = events.filter(e => `${e.title} ${e.description || ''} ${e.location || ''}`.toLowerCase().includes(q));
  if (date) {
    const onDay = matches.filter(e => e.date === date);
    if (onDay.length) matches = onDay;
  }
  if (matches.length <= 1) return matches[0] || null;
  const now = today();
  const upcoming = matches.filter(e => e.date >= now).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  return upcoming[0] || matches[matches.length - 1];
}

function updateCalendarEvent(args) {
  const ev = findEvent(args);
  if (!ev) return { status: 'error', success: false, message: `No calendar event matches ${args.eventId || `"${args.title || ''}"`}. List the events first to find it.` };
  const patch = {};
  if (args.newDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.newDate)) return { status: 'error', success: false, message: 'newDate must be YYYY-MM-DD.' };
    patch.date = args.newDate;
  }
  if (args.isAllDay != null) patch.isAllDay = Boolean(args.isAllDay);
  if (args.newStartTime) {
    if (!HHMM.test(args.newStartTime)) return { status: 'error', success: false, message: 'newStartTime must be HH:MM (24h).' };
    patch.startTime = args.newStartTime.padStart(5, '0');
    patch.isAllDay = false;
    if (!args.newEndTime) {
      const len = HHMM.test(ev.startTime || '') && HHMM.test(ev.endTime || '') ? Math.max(15, toMin(ev.endTime) - toMin(ev.startTime)) : 60;
      patch.endTime = fromMin(toMin(patch.startTime) + len);
    }
  }
  if (args.newEndTime) {
    if (!HHMM.test(args.newEndTime)) return { status: 'error', success: false, message: 'newEndTime must be HH:MM (24h).' };
    patch.endTime = args.newEndTime.padStart(5, '0');
  }
  if (patch.isAllDay) { patch.startTime = ''; patch.endTime = ''; }
  if (args.newTitle) patch.title = String(args.newTitle).trim();
  for (const k of ['location', 'description', 'category']) if (args[k] != null) patch[k] = String(args[k]).trim();
  if (!Object.keys(patch).length) return { status: 'error', success: false, message: 'Nothing to change: give a new date, time, title, location, notes or category.' };
  const updated = updateEvent(ev.id, patch);
  followEvent(updated);
  const moved = patch.date || patch.startTime || patch.isAllDay != null;
  const slot = updated.isAllDay ? 'all day' : `${updated.startTime} – ${updated.endTime}`;
  return {
    status: 'success',
    type: 'calendar-event',
    renderer: 'calendar-card',
    action: 'updated',
    event: updated,
    previous: { date: ev.date, startTime: ev.startTime, endTime: ev.endTime },
    message: moved ? `Moved "${updated.title}" from ${ev.date}${ev.startTime ? ` ${ev.startTime}` : ''} to ${updated.date}, ${slot}.` : `Updated "${updated.title}" (${updated.date}, ${slot}).`,
  };
}

function setReminder(args) {
  let eventId = args.eventId;
  if (!eventId && args.eventTitle) {
    const ev = findEvent({ title: args.eventTitle });
    if (!ev) return { status: 'error', success: false, message: `No calendar event matches "${args.eventTitle}". Create it first, or give a time for the reminder.` };
    eventId = ev.id;
  }
  try {
    const r = addReminder({ text: args.text, at: args.at, eventId, before: args.before });
    if (r.at < Date.now() - 60_000) return { status: 'success', reminder: r, message: `Set, but ${when(r.at)} has already passed, so it will show straight away. Check the time with them.` };
    return { status: 'success', type: 'reminder', reminder: r, message: `Reminder set for ${when(r.at)}: ${r.text}.` };
  } catch (err) {
    return { status: 'error', success: false, message: err.message };
  }
}

async function executeCalendar(name, args) {
  switch (name) {
    case 'calendar_update_event': return updateCalendarEvent(args);
    case 'set_reminder': return setReminder(args);
    case 'list_reminders': {
      const events = new Map(loadEvents().map(e => [e.id, e]));
      const list = upcomingReminders().filter(r => !r.eventId || events.has(r.eventId));
      return {
        status: 'success',
        reminders: list.map(r => ({ id: r.id, text: r.text, at: localIso(new Date(r.at)), event: r.eventId ? events.get(r.eventId)?.title : undefined })),
        message: list.length ? list.map(r => `- ${when(r.at)}: ${r.text}`).join('\n') : 'No reminders to come.',
      };
    }
    case 'cancel_reminder': {
      const gone = cancelReminder(args.reminder);
      return gone.length
        ? { status: 'success', cancelled: gone.map(r => r.text), message: `Cancelled: ${gone.map(r => r.text).join('; ')}.` }
        : { status: 'error', success: false, message: `No upcoming reminder matches "${args.reminder}".` };
    }
    default: return undefined;
  }
}

/* ---------------- files ---------------- */

const FILE_DECLARATIONS = [
  {
    name: 'search_files',
    description: 'Searches the person\'s Files (folders and saved work) by file name and by what the documents say, including Word and PDF contents. Returns the best matches with a short snippet. Use it to find "the lease I uploaded", "my receipts", etc., before reading or summarising.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for (names, topics, phrases).' },
        limit: { type: 'number', description: 'Most results to return (default 8).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_document',
    description: 'Reads the text of a document in Files (text, Markdown, CSV, JSON, Word .docx, PDF) so you can summarise it, answer questions about it or pull out dates and figures. Give the path from search_files, or a name to look up.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path (e.g. "/Documents/Lease.pdf") or saved-work id from search_files; a file name also works.' },
        maxChars: { type: 'number', description: 'Most characters to return (default 12000, up to 40000).' },
        offset: { type: 'number', description: 'Character to start from, to read on after a truncated read.' },
        find: { type: 'string', description: 'Words to look for: returns only the passages that mention them (faster and cheaper than reading a long document whole).' },
      },
      required: ['path'],
    },
  },
];

const STOP = new Set('a an and are as at be by for from i in is it me my of on or our that the this to we with your file files doc docs document documents find where what which show open'.split(' '));
const TEXTY = /\.(txt|md|markdown|csv|tsv|json|html?|xml|ya?ml|log|ini|toml|rtf|js|mjs|ts|py|css|sql)$/i;
const isPdf = (m) => /pdf/i.test(m.mimeType || '') || /\.pdf$/i.test(m.name || '');
const isDocx = (m) => /wordprocessingml/i.test(m.mimeType || '') || /\.docx$/i.test(m.name || '');
const readable = (m) => TEXTY.test(m.name || '') || /^text\//.test(m.mimeType || '') || /json|xml|csv/.test(m.mimeType || '') || isPdf(m) || isDocx(m);

const textCache = new Map();

async function loadFs() {
  const { fs } = await import('../filesystem.js');
  return fs;
}

/** Plain text of a file in the Toolbox filesystem (Word and PDF included), cached per version. */
export async function fileText(meta, { fsImpl } = {}) {
  const key = `${meta.path}:${meta.updatedAt || meta.modifiedAt || meta.size || ''}`;
  if (textCache.has(key)) return textCache.get(key);
  const fs = fsImpl || await loadFs();
  let text = '';
  if (isPdf(meta) || isDocx(meta)) {
    const bytes = await fs.readFile(meta.path, { encoding: 'binary' });
    const { pdfText, docxText } = await import('../legal/doc-text.js');
    text = (isPdf(meta) ? await pdfText(bytes.slice().buffer, { maxPages: 60 }) : await docxText(bytes)).text || '';
  } else {
    text = await fs.readFile(meta.path, { encoding: 'utf-8' });
  }
  text = String(text).replace(/\r\n?/g, '\n');
  if (textCache.size > 60) textCache.delete(textCache.keys().next().value);
  textCache.set(key, text);
  return text;
}

async function savedWork() {
  try { const store = await import('../artifacts.js'); return store.list() || []; } catch { return []; }
}

function snippetAround(text, terms) {
  const low = text.toLowerCase();
  let at = -1;
  for (const t of terms) { at = low.indexOf(t); if (at >= 0) break; }
  if (at < 0) return text.slice(0, 160).replace(/\s+/g, ' ').trim();
  const start = Math.max(0, at - 70);
  return `${start ? '…' : ''}${text.slice(start, at + 110).replace(/\s+/g, ' ').trim()}…`;
}

/** Ranks files and saved work against a query by name (weighted) and contents. */
export async function searchFiles(query, { limit = 8, fsImpl, artifacts } = {}) {
  const terms = String(query || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1 && !STOP.has(t));
  if (!terms.length) return [];
  const fs = fsImpl || await loadFs();
  const metas = (await fs.listAllMeta().catch(() => [])).filter(m => !m.isDirectory);
  const results = [];
  let extracted = 0;
  for (const m of metas) {
    const name = `${m.name} ${m.path}`.toLowerCase();
    let score = terms.reduce((s, t) => s + (name.includes(t) ? 3 : 0), 0);
    let snippet = '';
    // Contents: text files under 1 MB; Word and PDF under 8 MB, at most 25 per search.
    const heavy = isPdf(m) || isDocx(m);
    if (readable(m) && (m.size || 0) < (heavy ? 8_000_000 : 1_000_000) && (!heavy || extracted < 25)) {
      if (heavy) extracted++;
      try {
        const text = await fileText(m, { fsImpl: fs });
        const low = text.toLowerCase();
        const hits = terms.filter(t => low.includes(t)).length;
        if (hits) { score += hits; snippet = snippetAround(text, terms); }
      } catch { /* unreadable file: name match only */ }
    }
    if (score) results.push({ path: m.path, name: m.name, size: m.size, updated: m.updatedAt || m.modifiedAt || null, score, snippet });
  }
  for (const a of artifacts || await savedWork()) {
    const name = String(a.name || '').toLowerCase();
    const text = String(a.text || '');
    const low = text.toLowerCase();
    const score = terms.reduce((s, t) => s + (name.includes(t) ? 3 : 0) + (low.includes(t) ? 1 : 0), 0);
    if (score) results.push({ path: `saved:${a.id}`, name: a.name || 'Untitled', size: a.bytes || text.length, updated: a.updatedAt || a.createdAt || null, score, snippet: low ? snippetAround(text, terms) : '' });
  }
  return results.sort((a, b) => b.score - a.score || (b.updated || 0) - (a.updated || 0)).slice(0, Math.max(1, Math.min(25, Number(limit) || 8)));
}

/** Paragraphs of text that mention the query words, with their character offsets. */
export function findPassages(text, query, cap = 12_000) {
  const words = String(query || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !STOP.has(w));
  if (!words.length) return null;
  // Split by page markers first, then into paragraphs, so each passage knows its page.
  const paras = [];
  const chunks = String(text).split(/\[Page (\d+)\]/);
  for (let c = 0; c < chunks.length; c += 2) {
    const page = c > 0 ? chunks[c - 1] : null;
    for (const para of chunks[c].split(/\n\s*\n/)) if (para.trim()) paras.push({ page, text: para.trim() });
  }
  const scored = paras.map((p, i) => {
    const low = p.text.toLowerCase();
    const score = words.reduce((s, w) => s + (low.includes(w) ? 1 : 0), 0);
    return { ...p, i, score };
  }).filter(p => p.score > 0).sort((a, b) => b.score - a.score || a.i - b.i);
  const out = [];
  let used = 0;
  for (const p of scored) {
    const block = `${p.page ? `(page ${p.page}) ` : ''}${p.text}`;
    if (used + block.length > cap) break;
    out.push({ i: p.i, block });
    used += block.length;
  }
  return { matches: scored.length, content: out.sort((a, b) => a.i - b.i).map(o => o.block).join('\n\n…\n\n') };
}

async function readDocument({ path, maxChars, offset, find } = {}, { fsImpl, artifacts } = {}) {
  const raw = String(path || '').trim();
  if (!raw) return { status: 'error', success: false, message: 'Give the path or name of the document.' };
  const cap = Math.max(500, Math.min(40_000, Number(maxChars) || 12_000));
  const done = (name, where, text) => {
    const found = find ? findPassages(text, find, cap) : null;
    if (found) {
      return {
        status: 'success', type: 'document-text', path: where, name, chars: text.length,
        matches: found.matches,
        content: found.content || `Nothing in ${name} mentions "${find}".`,
        message: `Found ${found.matches} passage${found.matches === 1 ? '' : 's'} about "${find}" in ${name}.`,
      };
    }
    const start = Math.max(0, Math.min(text.length, Math.floor(Number(offset) || 0)));
    const slice = text.slice(start, start + cap);
    const rest = text.length - start - slice.length;
    return {
      status: 'success',
      type: 'document-text',
      path: where,
      name,
      chars: text.length,
      offset: start,
      truncated: rest > 0,
      content: rest > 0 ? `${slice}\n[… ${rest} more characters; read on with offset ${start + slice.length}, or use find]` : slice,
      message: `Read ${name} (${text.length.toLocaleString()} characters).`,
    };
  };
  if (raw.startsWith('saved:')) {
    const a = (artifacts || await savedWork()).find(x => x.id === raw.slice(6));
    return a ? done(a.name || 'Untitled', raw, String(a.text || '')) : { status: 'error', success: false, message: 'That saved item no longer exists.' };
  }
  const fs = fsImpl || await loadFs();
  const metas = (await fs.listAllMeta().catch(() => [])).filter(m => !m.isDirectory);
  const norm = raw.startsWith('/') ? raw : `/${raw}`;
  let meta = metas.find(m => m.path === norm) || metas.find(m => m.name.toLowerCase() === raw.toLowerCase().split('/').pop());
  if (!meta) {
    const [best] = await searchFiles(raw, { limit: 1, fsImpl: fs, artifacts });
    if (best?.path.startsWith('saved:')) return readDocument({ path: best.path, maxChars, offset, find }, { fsImpl, artifacts });
    meta = best && metas.find(m => m.path === best.path);
  }
  if (!meta) return { status: 'error', success: false, message: `No file called "${raw}" in Files. Search for it first, or ask them to upload it.` };
  if (!readable(meta)) return { status: 'error', success: false, message: `${meta.name} is not a text, Word or PDF document, so it cannot be read as text here.` };
  try {
    const text = await fileText(meta, { fsImpl: fs });
    if (!text.trim()) return { status: 'error', success: false, message: `${meta.name} has no readable text (it may be a scanned PDF).` };
    return done(meta.name, meta.path, text);
  } catch (err) {
    return { status: 'error', success: false, message: `Could not read ${meta.name}: ${err.message}` };
  }
}

async function executeFiles(name, args, ctx) {
  if (name === 'search_files') {
    const results = await searchFiles(args.query, { limit: args.limit, fsImpl: ctx.fsImpl, artifacts: ctx.artifacts });
    return {
      status: 'success',
      query: args.query,
      results: results.map(({ score, ...r }) => r),
      message: results.length ? `Found ${results.length} match${results.length === 1 ? '' : 'es'} for "${args.query}".` : `Nothing in Files matches "${args.query}".`,
    };
  }
  if (name === 'read_document') return readDocument(args, ctx);
  return undefined;
}

/* ---------------- registration ---------------- */

export const LIFE_TOOL_DECLARATIONS = [...CALENDAR_DECLARATIONS, ...FILE_DECLARATIONS];

export async function executeLifeTool(name, args = {}, ctx = {}) {
  return (await executeCalendar(name, args)) ?? executeFiles(name, args, ctx);
}

registerToolPack({
  id: 'calendar-life',
  declarations: CALENDAR_DECLARATIONS,
  execute: executeCalendar,
  groups: {
    calendar: {
      label: 'Calendar: add, list, move, edit and cancel events; set, list and cancel reminders',
      tools: CALENDAR_DECLARATIONS.map(d => d.name),
      match: /\b(calendar|schedule|reschedule|meeting|appointment|remind|reminders?|event|tomorrow|tonight|my day|my week|this week|next week|coming week|upcoming (?:events?|meetings?|appointments?|plans?)|weekend|move (my|the)|push (my|the)|postpone|what'?s on|agenda|on (mon|tues|wednes|thurs|fri|satur|sun)day)\b/i,
    },
  },
});

registerToolPack({
  id: 'files-life',
  declarations: FILE_DECLARATIONS,
  execute: executeFiles,
  groups: {
    files: {
      label: 'Files: search files by name and contents, read and summarise documents, create, move, rename, zip and save files and artifacts',
      tools: FILE_DECLARATIONS.map(d => d.name),
      match: /\b(files?|folder|save|saved|download|zip|unzip|archive|rename|move|delete|artifact|documents?|export|uploaded|receipts?|lease|contract|pdf|summari[sz]e|find (my|the))\b/i,
    },
  },
});

