/* ============================================================
   Workspace persistence for Code Playground.

   Workspaces live in IndexedDB so a project can hold hundreds of files
   and binary assets without hitting the 5 MB localStorage ceiling:
     workspaces  one record per workspace (name, tabs, settings, git refs)
     files       one record per file, keyed "<wsId>\u0000<path>"
     objects     content-addressed git blobs, keyed "<wsId>\u0000<hash>"

   Saves are incremental: the VFS reports which paths changed and only
   those records are written. When IndexedDB is unavailable (private
   mode in some browsers, Node test runs) everything falls back to an
   in-memory store mirrored into localStorage.

   Older playground versions kept every workspace as JSON in
   localStorage ("toolbox_cpg_workspaces_v2"); those are migrated into
   the new store once, the first time the playground opens.
   ============================================================ */

import { normalize } from './paths.js';

const DB_NAME = 'toolbox-code-playground';
const DB_VERSION = 1;
const LEGACY_KEY = 'toolbox_cpg_workspaces_v2';
const MIGRATED_KEY = 'toolbox_cpg_migrated_v3';
const FALLBACK_KEY = 'toolbox_cpg_fallback_v3';
const ACTIVE_KEY = 'toolbox_cpg_active_ws_v3';
const SEP = '\u0000';

let dbPromise = null;
let memory = null; // fallback store

function hasIDB() {
  try { return typeof indexedDB !== 'undefined' && indexedDB && typeof indexedDB.open === 'function'; } catch { return false; }
}

function openDB() {
  if (!hasIDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'key' });
        s.createIndex('ws', 'ws', { unique: false });
      }
      if (!db.objectStoreNames.contains('objects')) {
        const s = db.createObjectStore('objects', { keyPath: 'key' });
        s.createIndex('ws', 'ws', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/* ---------------- in-memory / localStorage fallback ---------------- */

function mem() {
  if (memory) return memory;
  memory = { workspaces: new Map(), files: new Map(), objects: new Map() };
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const w of data.workspaces || []) memory.workspaces.set(w.id, w);
      for (const f of data.files || []) memory.files.set(f.key, f);
      for (const o of data.objects || []) memory.objects.set(o.key, o);
    }
  } catch { /* corrupt fallback: start empty */ }
  return memory;
}

function persistMem() {
  if (!memory) return;
  try {
    const textOnly = (arr) => arr.filter((r) => typeof r.content === 'string');
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({
      workspaces: [...memory.workspaces.values()],
      files: textOnly([...memory.files.values()]),
      objects: textOnly([...memory.objects.values()]),
    }));
  } catch { /* quota: memory copy still works for this session */ }
}

/* ---------------- public API ---------------- */

export function newId(prefix = 'ws') {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export async function listWorkspaces() {
  await migrateLegacy();
  const db = await openDB();
  let list;
  if (db) {
    const tx = db.transaction('workspaces', 'readonly');
    list = await reqP(tx.objectStore('workspaces').getAll());
  } else {
    list = [...mem().workspaces.values()];
  }
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getWorkspace(id) {
  const db = await openDB();
  if (db) return (await reqP(db.transaction('workspaces', 'readonly').objectStore('workspaces').get(id))) || null;
  return mem().workspaces.get(id) || null;
}

export async function putWorkspace(meta) {
  const record = { ...meta, updatedAt: meta.updatedAt || Date.now() };
  const db = await openDB();
  if (db) {
    const tx = db.transaction('workspaces', 'readwrite');
    tx.objectStore('workspaces').put(record);
    await txDone(tx);
  } else {
    mem().workspaces.set(record.id, record);
    persistMem();
  }
  return record;
}

/** Load every file of a workspace: { files: {path: content}, dirs: [] }. */
export async function loadFiles(wsId) {
  const db = await openDB();
  let rows;
  if (db) {
    const tx = db.transaction('files', 'readonly');
    rows = await reqP(tx.objectStore('files').index('ws').getAll(wsId));
  } else {
    rows = [...mem().files.values()].filter((r) => r.ws === wsId);
  }
  const files = {};
  const dirs = [];
  for (const r of rows) {
    if (r.dir) dirs.push(r.path);
    else files[r.path] = r.content;
  }
  return { files, dirs };
}

/**
 * Write changed files and delete removed ones in one transaction.
 * @param {string} wsId
 * @param {{ put?: Array<{path:string, content:any, dir?:boolean}>, del?: string[] }} changes
 */
export async function saveFiles(wsId, { put = [], del = [] } = {}) {
  if (!put.length && !del.length) return;
  const db = await openDB();
  if (db) {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    for (const p of del) store.delete(wsId + SEP + normalize(p));
    for (const f of put) {
      const path = normalize(f.path);
      store.put({ key: wsId + SEP + path, ws: wsId, path, content: f.dir ? null : f.content, dir: Boolean(f.dir), mtime: Date.now() });
    }
    await txDone(tx);
  } else {
    const m = mem();
    for (const p of del) m.files.delete(wsId + SEP + normalize(p));
    for (const f of put) {
      const path = normalize(f.path);
      m.files.set(wsId + SEP + path, { key: wsId + SEP + path, ws: wsId, path, content: f.dir ? null : f.content, dir: Boolean(f.dir) });
    }
    persistMem();
  }
}

/** Replace a workspace's whole file set (import, restore, template). */
export async function replaceFiles(wsId, snapshot) {
  const db = await openDB();
  const put = [
    ...Object.entries(snapshot.files || {}).map(([path, content]) => ({ path, content })),
    ...(snapshot.dirs || []).map((path) => ({ path, dir: true })),
  ];
  if (db) {
    const existing = await reqP(db.transaction('files', 'readonly').objectStore('files').index('ws').getAllKeys(wsId));
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    for (const k of existing) store.delete(k);
    for (const f of put) {
      const path = normalize(f.path);
      if (!path) continue;
      store.put({ key: wsId + SEP + path, ws: wsId, path, content: f.dir ? null : f.content, dir: Boolean(f.dir), mtime: Date.now() });
    }
    await txDone(tx);
  } else {
    const m = mem();
    for (const k of [...m.files.keys()]) if (k.startsWith(wsId + SEP)) m.files.delete(k);
    await saveFiles(wsId, { put });
  }
}

export async function deleteWorkspace(id) {
  const db = await openDB();
  if (db) {
    const keys = await reqP(db.transaction('files', 'readonly').objectStore('files').index('ws').getAllKeys(id));
    const okeys = await reqP(db.transaction('objects', 'readonly').objectStore('objects').index('ws').getAllKeys(id));
    const tx = db.transaction(['workspaces', 'files', 'objects'], 'readwrite');
    tx.objectStore('workspaces').delete(id);
    for (const k of keys) tx.objectStore('files').delete(k);
    for (const k of okeys) tx.objectStore('objects').delete(k);
    await txDone(tx);
  } else {
    const m = mem();
    m.workspaces.delete(id);
    for (const k of [...m.files.keys()]) if (k.startsWith(id + SEP)) m.files.delete(k);
    for (const k of [...m.objects.keys()]) if (k.startsWith(id + SEP)) m.objects.delete(k);
    persistMem();
  }
  if (getActiveWorkspaceId() === id) setActiveWorkspaceId(null);
}

/* ---------------- git object storage ---------------- */

export async function putObjects(wsId, objects) {
  const entries = Object.entries(objects || {});
  if (!entries.length) return;
  const db = await openDB();
  if (db) {
    const tx = db.transaction('objects', 'readwrite');
    const s = tx.objectStore('objects');
    for (const [hash, content] of entries) s.put({ key: wsId + SEP + hash, ws: wsId, hash, content });
    await txDone(tx);
  } else {
    const m = mem();
    for (const [hash, content] of entries) m.objects.set(wsId + SEP + hash, { key: wsId + SEP + hash, ws: wsId, hash, content });
    persistMem();
  }
}

export async function getObject(wsId, hash) {
  const db = await openDB();
  if (db) {
    const r = await reqP(db.transaction('objects', 'readonly').objectStore('objects').get(wsId + SEP + hash));
    return r ? r.content : undefined;
  }
  return mem().objects.get(wsId + SEP + hash)?.content;
}

/* ---------------- active workspace pointer ---------------- */

export function getActiveWorkspaceId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}

export function setActiveWorkspaceId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
}

/* ---------------- legacy migration ---------------- */

let migrating = null;

export function migrateLegacy() {
  if (migrating) return migrating;
  migrating = (async () => {
    let raw = null;
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return 0;
      raw = localStorage.getItem(LEGACY_KEY);
    } catch { return 0; }
    let list = [];
    try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
    let count = 0;
    for (const old of Array.isArray(list) ? list : []) {
      if (!old?.id || !Array.isArray(old.files)) continue;
      const files = {};
      for (const f of old.files) {
        const path = normalize(f?.name || '');
        if (!path) continue;
        files[path] = typeof f.content === 'string' ? f.content : '';
      }
      const active = old.files.find((f) => f.id === old.activeFileId);
      await putWorkspace({
        id: old.id,
        name: old.name || 'Workspace',
        createdAt: old.updatedAt || Date.now(),
        updatedAt: old.updatedAt || Date.now(),
        openTabs: active ? [normalize(active.name)] : Object.keys(files).slice(0, 1),
        activePath: active ? normalize(active.name) : Object.keys(files)[0] || '',
        settings: {},
        migratedFrom: 'v2',
      });
      await replaceFiles(old.id, { files, dirs: [] });
      count++;
    }
    try {
      localStorage.setItem(MIGRATED_KEY, String(Date.now()));
      const legacyActive = localStorage.getItem('toolbox_cpg_active_ws_v2');
      if (legacyActive && !getActiveWorkspaceId()) setActiveWorkspaceId(legacyActive);
    } catch { /* ignore */ }
    return count;
  })();
  return migrating;
}

/** Test hook: forget cached connections and fallback state. */
export function __resetStoreForTests() {
  dbPromise = null;
  memory = null;
  migrating = null;
}

/**
 * Tracks VFS changes and flushes them to storage in batches.
 * Call `flush()` before anything that must see saved data.
 */
export class AutoSaver {
  constructor(wsId, vfs, { delay = 350, onSaved = null, onError = null } = {}) {
    this.wsId = wsId;
    this.vfs = vfs;
    this.delay = delay;
    this.onSaved = onSaved;
    this.onError = onError;
    this.dirty = new Set();
    this.deleted = new Set();
    this.timer = null;
    this.saving = null;
    this.fullRewrite = false;
    this.unsub = vfs.onChange((e) => this.track(e));
  }

  track(e) {
    if (e.type === 'reset') { this.fullRewrite = true; }
    else if (e.type === 'rename') {
      this.markDeletedTree(e.from);
      this.markTree(e.path);
    } else if (e.type === 'delete') {
      this.markDeletedTree(e.path);
    } else {
      this.markTree(e.path);
    }
    this.schedule();
  }

  markTree(p) {
    if (this.vfs.isFile(p)) { this.dirty.add(p); this.deleted.delete(p); return; }
    this.dirty.add(p);
    for (const f of this.vfs.listFiles(p)) { this.dirty.add(f); this.deleted.delete(f); }
  }

  markDeletedTree(p) {
    // We no longer know what was inside, so remember the prefix and resolve at flush time.
    this.deleted.add(p);
    this.dirty.delete(p);
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, this.delay);
  }

  async flush() {
    clearTimeout(this.timer);
    if (this.saving) await this.saving.catch(() => {});
    if (!this.fullRewrite && !this.dirty.size && !this.deleted.size) return;
    const job = (async () => {
      try {
        if (this.fullRewrite) {
          this.fullRewrite = false;
          this.dirty.clear();
          this.deleted.clear();
          await replaceFiles(this.wsId, this.vfs.snapshot());
        } else {
          const put = [];
          const del = new Set();
          for (const p of this.dirty) {
            if (this.vfs.isFile(p)) put.push({ path: p, content: this.vfs.readRaw(p) });
            else if (this.vfs.isDir(p)) put.push({ path: p, dir: true });
          }
          if (this.deleted.size) {
            const stored = await loadFiles(this.wsId);
            const storedPaths = [...Object.keys(stored.files), ...stored.dirs];
            for (const gone of this.deleted) {
              for (const sp of storedPaths) {
                if ((sp === gone || sp.startsWith(`${gone}/`)) && !this.vfs.exists(sp)) del.add(sp);
              }
            }
          }
          this.dirty.clear();
          this.deleted.clear();
          await saveFiles(this.wsId, { put, del: [...del] });
        }
        this.onSaved?.();
      } catch (err) {
        this.onError?.(err);
        throw err;
      }
    })();
    this.saving = job;
    try { await job; } finally { if (this.saving === job) this.saving = null; }
  }

  dispose() {
    this.unsub?.();
    clearTimeout(this.timer);
  }
}
