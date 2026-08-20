/* ============================================================
   The artifact store.

   One place where saved work lives, so a tool never has to know that
   another tool exists. A tool hands over {kind, name, text}; the shell
   stores it, lists it, exports it, and offers it to whichever tools
   declared they accept that kind.

   Three rules this file exists to enforce:

     1. Local means local. Nothing here touches the network, ever.
     2. Nothing is saved that the user did not ask to save. There is no
        autosave, no history, no "recently used".
     3. The store never lies about itself. If the browser will not
        persist — private mode, storage disabled, quota full — that is
        reported rather than swallowed, so the interface can say so
        instead of implying work is safe when it is not.
   ============================================================ */

import { KIND_IDS, kindExt, kindMime } from '../registry/kinds.js';

const INDEX_KEY = 'toolbox.artifacts.index.v1';
const BODY_PREFIX = 'toolbox.artifact.v1.';

/* Bodies are stored one key per artifact so saving a new one does not
   rewrite every other one. The index carries only metadata. */

/** Single artifact cap. Comfortably larger than any hand-edited file. */
export const MAX_ARTIFACT_BYTES = 1_000_000;
/** Total cap, kept well under the ~5 MB a browser typically allows. */
export const MAX_TOTAL_BYTES = 4_000_000;

/**
 * @typedef {object} Artifact
 * @property {string} id
 * @property {string} name        What the user calls it, with extension.
 * @property {import('../registry/kinds.js').ArtifactKind} kind
 * @property {string} text        The content. Text only, deliberately.
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string} [from]      Id of the tool that produced it.
 */

/* ---------------- storage capability ---------------- */

/* Probed once. Safari in private mode used to throw on every write, and
   some managed browsers disable storage outright; either way the store
   still works for the session, it just cannot promise to keep anything. */
function probe() {
  try {
    const k = '__toolbox_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const persistent = probe();

/** In-memory mirror. It is the whole store when persistence is unavailable. */
const memory = new Map();

/* ---------------- change notification ---------------- */

const listeners = new Set();

/** Subscribe to any change in the store. Returns an unsubscribe. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce() {
  for (const fn of listeners) {
    try { fn(); } catch (err) { console.error('artifact listener failed', err); }
  }
}

/* ---------------- index ---------------- */

function readIndex() {
  if (!persistent) return [...memory.values()].map(stripBody);
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(isMeta) : [];
  } catch {
    // A corrupt index is not worth taking the app down for.
    return [];
  }
}

function writeIndex(list) {
  if (!persistent) return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

const isMeta = (m) => m && typeof m.id === 'string' && typeof m.name === 'string';
const stripBody = ({ text, ...meta }) => meta;

/* ---------------- reading ---------------- */

/** Metadata for everything saved, newest first. No bodies loaded. */
export function list() {
  return readIndex().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/** Saved artifacts of these kinds, newest first. */
export function listOfKind(kinds) {
  const wanted = new Set([].concat(kinds));
  return list().filter(m => wanted.has(m.kind));
}

/** One artifact, body included, or null. */
export function get(id) {
  if (!persistent) return memory.get(id) ?? null;
  const meta = readIndex().find(m => m.id === id);
  if (!meta) return null;
  const text = localStorage.getItem(BODY_PREFIX + id);
  return text == null ? null : { ...meta, text };
}

/** Bytes currently held, for an honest "how full is this" figure. */
export function usage() {
  const used = readIndex().reduce((sum, m) => sum + (m.bytes ?? 0), 0);
  return { used, limit: MAX_TOTAL_BYTES, count: readIndex().length };
}

/* ---------------- writing ---------------- */

const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const byteLength = (s) => new Blob([s]).size;

export class ArtifactError extends Error {}

/**
 * Save new work, or overwrite an existing artifact when `id` is given.
 * Throws ArtifactError with a message worth showing to a person.
 * @param {{id?: string, name: string, kind: string, text: string, from?: string}} input
 * @returns {Artifact}
 */
export function save({ id, name, kind, text, from } = {}) {
  if (typeof text !== 'string') throw new ArtifactError('There is nothing to save yet.');
  if (!KIND_IDS.has(kind)) throw new ArtifactError(`"${kind}" is not a kind of file Toolbox knows about.`);

  const bytes = byteLength(text);
  if (bytes > MAX_ARTIFACT_BYTES) {
    throw new ArtifactError('That is too large to keep in browser storage. Export it to a file instead.');
  }

  const index = readIndex();
  const existing = id ? index.find(m => m.id === id) : null;
  const otherBytes = index.reduce((sum, m) => sum + (m === existing ? 0 : (m.bytes ?? 0)), 0);
  if (otherBytes + bytes > MAX_TOTAL_BYTES) {
    throw new ArtifactError('Saved work has filled the space this browser allows. Export and remove something first.');
  }

  const now = Date.now();
  const meta = {
    id: existing?.id ?? id ?? newId(),
    name: uniqueName(cleanName(name, kind), index, existing?.id),
    kind,
    from: from ?? existing?.from,
    bytes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const artifact = { ...meta, text };

  if (!persistent) {
    memory.set(meta.id, artifact);
    announce();
    return artifact;
  }

  try {
    localStorage.setItem(BODY_PREFIX + meta.id, text);
  } catch {
    throw new ArtifactError('This browser refused to store that. It may be full, or storage may be turned off.');
  }

  const next = existing
    ? index.map(m => (m.id === meta.id ? meta : m))
    : [...index, meta];
  try {
    writeIndex(next);
  } catch {
    localStorage.removeItem(BODY_PREFIX + meta.id);
    throw new ArtifactError('This browser refused to store that. It may be full, or storage may be turned off.');
  }

  announce();
  return artifact;
}

/** Rename in place. */
export function rename(id, name) {
  const index = readIndex();
  const meta = index.find(m => m.id === id);
  if (!meta) return null;
  meta.name = uniqueName(cleanName(name, meta.kind), index, id);
  meta.updatedAt = Date.now();
  if (persistent) writeIndex(index);
  else memory.set(id, { ...memory.get(id), name: meta.name, updatedAt: meta.updatedAt });
  announce();
  return meta;
}

/** Delete one artifact. Irreversible, and the caller is expected to confirm. */
export function remove(id) {
  if (!persistent) { memory.delete(id); announce(); return; }
  localStorage.removeItem(BODY_PREFIX + id);
  writeIndex(readIndex().filter(m => m.id !== id));
  announce();
}

/* Passing work between tools carries its name along, so saving the result
   of a chain would otherwise leave two files called the same thing and no
   way to tell them apart in the list. */
function uniqueName(name, index, keepId) {
  const taken = new Set(index.filter(m => m.id !== keepId).map(m => m.name));
  if (!taken.has(name)) return name;

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; n < 999; n++) {
    const candidate = `${stem} ${n}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} ${Date.now()}${ext}`;
}

function cleanName(name, kind) {
  const trimmed = String(name ?? '').trim().replace(/[\\/:*?"<>|]/g, '-');
  const base = trimmed || `untitled.${kindExt(kind)}`;
  return base.includes('.') ? base : `${base}.${kindExt(kind)}`;
}

/* ---------------- handing work between tools ----------------

   Deliberately *not* persisted. Sending a result to another tool is a
   navigation, not a decision to keep something, so it lives in memory
   for exactly one hop and is taken rather than read. */

let pending = null;

/** Park an artifact for the next tool that opens. */
export function handOff(artifact) { pending = artifact; }

/** Collect whatever was parked, once. */
export function takeHandoff() {
  const held = pending;
  pending = null;
  return held;
}

/* ---------------- moving work in and out ---------------- */

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save one artifact to a real file on the user's machine. */
export function exportOne({ name, kind, text }) {
  download(cleanName(name, kind), text, kindMime(kind));
}

/** Everything saved, as one file that `importBundle` can read back. */
export function exportAll() {
  const items = list().map(m => get(m.id)).filter(Boolean);
  const bundle = { format: 'toolbox.artifacts', version: 1, exportedAt: new Date().toISOString(), items };
  download(`toolbox-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2), 'application/json');
  return items.length;
}

/**
 * Read a bundle back. Ids are reissued so importing never overwrites
 * work that happens to share an id.
 * @returns {{imported: number, skipped: number}}
 */
export function importBundle(json) {
  let bundle;
  try { bundle = JSON.parse(json); }
  catch { throw new ArtifactError('That file is not readable as a Toolbox export.'); }

  if (bundle?.format !== 'toolbox.artifacts' || !Array.isArray(bundle.items)) {
    throw new ArtifactError('That file is not a Toolbox export.');
  }

  let imported = 0;
  let skipped = 0;
  for (const item of bundle.items) {
    try {
      save({ name: item.name, kind: item.kind, text: item.text, from: item.from });
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}
