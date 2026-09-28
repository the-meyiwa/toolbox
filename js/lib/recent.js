/* ============================================================
   Recent work: the last results any tool made, in this session.

   Every file a tool produces lands here, so the next tool can take it
   without a download and re-upload, the Assistant can say "that PDF"
   and mean the one just made, and the split pane can pass work across.
   It is memory only and bounded; Save to Files is what keeps things.
   ============================================================ */

const MAX = 24;
const MAX_BYTES = 400 * 1024 * 1024;
let items = [];
let seq = 0;

const sizeOf = (i) => i.blob?.size ?? (i.text ? i.text.length * 2 : 0);

/** Add a work item ({ name, kind, text|blob, from }). Returns it with an id and time. */
export function remember(item) {
  if (!item || (!item.blob && item.text == null)) return null;
  const entry = { ...item, id: `r${Date.now().toString(36)}${(seq++).toString(36)}`, at: Date.now() };
  items = [entry, ...items.filter((i) => !(i.name === entry.name && i.from === entry.from && sizeOf(i) === sizeOf(entry)))];
  while (items.length > MAX || (items.length > 1 && items.reduce((n, i) => n + sizeOf(i), 0) > MAX_BYTES)) items.pop();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toolbox:recent', { detail: entry }));
  return entry;
}

/** Newest first; optionally only these kinds. */
export function recent(kinds = null) {
  const set = kinds ? new Set([].concat(kinds)) : null;
  return set ? items.filter((i) => set.has(i.kind)) : [...items];
}

export const latest = (kinds = null) => recent(kinds)[0] || null;
export const getRecent = (id) => items.find((i) => i.id === id) || null;
export function forget(id) { items = items.filter((i) => i.id !== id); }
export function clearRecent() { items = []; }
