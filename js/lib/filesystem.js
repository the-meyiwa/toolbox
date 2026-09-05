/* ============================================================
   TOOLBOX — Authoritative Hierarchical Filesystem (ToolboxFilesystem)
   Standardized browser-based filesystem abstraction with nested folders,
   dual Offline (IndexedDB / Local) and Online (Supabase) providers,
   streaming binary/blob support, PKZIP compression/decompression,
   and bidirectional synchronization with legacy Saved Work artifacts.
   ============================================================ */

import { createZip, extractZip } from './archive-engine.js';
import * as legacyArtifacts from './artifacts.js';
import { getCurrentUser, uploadToSupabaseStorage, getSupabaseConfig } from './supabase.js';

const DB_NAME = 'toolbox_filesystem_db_v1';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_META = 'metadata';

const LOCAL_FALLBACK_INDEX = 'toolbox.fs.index.v1';
const LOCAL_FALLBACK_PREFIX = 'toolbox.fs.file.v1.';

/**
 * Normalizes filesystem path (e.g. "Projects\\MyApp/index.html" -> "/Projects/MyApp/index.html")
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p = '/') {
  let str = String(p || '/').trim().replace(/\\/g, '/');
  if (!str.startsWith('/')) str = '/' + str;
  str = str.replace(/\/+/g, '/');
  if (str.length > 1 && str.endsWith('/')) {
    str = str.slice(0, -1);
  }
  return str || '/';
}

/**
 * Computes parent path (e.g. "/Projects/MyApp" -> "/Projects", "/Projects" -> "/")
 */
export function getParentPath(p = '/') {
  const norm = normalizePath(p);
  if (norm === '/' || !norm) return '/';
  const idx = norm.lastIndexOf('/');
  if (idx <= 0) return '/';
  return norm.slice(0, idx);
}

/**
 * Computes base name from path
 */
export function getBaseName(p = '') {
  const norm = normalizePath(p);
  if (norm === '/') return 'Home';
  return norm.split('/').pop() || '';
}

/**
 * Determines MIME type from extension
 */
export function getMimeType(filename = '') {
  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  const map = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'json': 'application/json',
    'csv': 'text/csv',
    'tsv': 'text/tab-separated-values',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'webm': 'video/webm'
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * IndexedDB Driver for large files and binary blobs
 */
class IndexedDBDriver {
  constructor() {
    this.dbPromise = null;
    this.isSupported = typeof indexedDB !== 'undefined';
  }

  async getDB() {
    if (!this.isSupported) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_FILES)) {
            db.createObjectStore(STORE_FILES, { keyPath: 'path' });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            const metaStore = db.createObjectStore(STORE_META, { keyPath: 'path' });
            metaStore.createIndex('parentPath', 'parentPath', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('[ToolboxFilesystem] IndexedDB open error, falling back to local store');
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async get(path) {
    const db = await this.getDB();
    if (!db) return this.getFallback(path);

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_FILES], 'readonly');
        const req = tx.objectStore(STORE_FILES).get(path);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async put(fileRecord) {
    // Keep in-memory and local fallback synchronized so listSync & statSync always have immediate data
    this.putFallback(fileRecord);
    const db = await this.getDB();
    if (!db) return true;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
        const { content, binaryData, ...meta } = fileRecord;
        tx.objectStore(STORE_FILES).put(fileRecord);
        tx.objectStore(STORE_META).put(meta);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(path) {
    this.deleteFallback(path);
    const db = await this.getDB();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
        tx.objectStore(STORE_FILES).delete(path);
        tx.objectStore(STORE_META).delete(path);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async listAllMeta() {
    const db = await this.getDB();
    if (!db) return this.listAllMetaFallback();

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_META], 'readonly');
        const req = tx.objectStore(STORE_META).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  // LocalStorage / In-memory fallback
  getFallback(path) {
    try {
      if (typeof localStorage === 'undefined') return inMemoryStore.get(path) || null;
      const raw = localStorage.getItem(LOCAL_FALLBACK_PREFIX + path);
      if (!raw) return inMemoryStore.get(path) || null;
      const rec = JSON.parse(raw);
      if (rec && rec.binaryData && !(rec.binaryData instanceof Uint8Array)) {
        rec.binaryData = new Uint8Array(Object.values(rec.binaryData));
      }
      return rec;
    } catch {
      return inMemoryStore.get(path) || null;
    }
  }

  putFallback(record) {
    try {
      inMemoryStore.set(record.path, record);
      if (typeof localStorage === 'undefined') {
        return true;
      }
      localStorage.setItem(LOCAL_FALLBACK_PREFIX + record.path, JSON.stringify(record));
      const index = this.listAllMetaFallback();
      const meta = { ...record };
      delete meta.content;
      delete meta.binaryData;
      const nextIndex = index.filter(m => m.path !== record.path).concat([meta]);
      localStorage.setItem(LOCAL_FALLBACK_INDEX, JSON.stringify(nextIndex));
      return true;
    } catch {
      inMemoryStore.set(record.path, record);
      return true;
    }
  }

  deleteFallback(path) {
    try {
      inMemoryStore.delete(path);
      if (typeof localStorage === 'undefined') {
        return true;
      }
      localStorage.removeItem(LOCAL_FALLBACK_PREFIX + path);
      const index = this.listAllMetaFallback();
      localStorage.setItem(LOCAL_FALLBACK_INDEX, JSON.stringify(index.filter(m => m.path !== path)));
      return true;
    } catch {
      return false;
    }
  }

  listAllMetaFallback() {
    const map = new Map();
    for (const [k, v] of inMemoryStore.entries()) {
      const { content, binaryData, ...m } = v;
      map.set(k, m);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_FALLBACK_INDEX);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            for (const item of arr) {
              map.set(item.path, item);
            }
          }
        }
      }
    } catch {}
    return Array.from(map.values());
  }
}

const inMemoryStore = new Map();
const dbDriver = new IndexedDBDriver();

/**
 * Standard System Default Folders
 */
const DEFAULT_FOLDERS = [
  { path: '/Home', name: 'Home' },
  { path: '/Projects', name: 'Projects' },
  { path: '/Documents', name: 'Documents' },
  { path: '/Images', name: 'Images' },
  { path: '/Downloads', name: 'Downloads' }
];

// Pre-seed default folders into in-memory store so listSync('/') always works immediately
for (const f of DEFAULT_FOLDERS) {
  inMemoryStore.set(f.path, {
    path: f.path,
    name: f.name,
    parentPath: '/',
    isDirectory: true,
    type: 'directory',
    size: 0,
    mimeType: 'inode/directory',
    createdAt: 0,
    updatedAt: 0,
    storage: 'offline'
  });
}

export class ToolboxFilesystem {
  constructor() {
    this._listeners = new Set();
    this._initialized = false;
  }

  /**
   * Subscribe to filesystem mutations
   * @param {() => void} fn
   * @returns {() => void} unsubscribe
   */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn(); } catch (err) { console.error('[ToolboxFilesystem] listener error', err); }
    }
  }

  /**
   * Initializes standard folders and migrates legacy artifacts
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // 0. Hydrate in-memory and local fallback store from IndexedDB if available
    try {
      const db = await dbDriver.getDB();
      if (db) {
        const allMeta = await dbDriver.listAllMeta();
        for (const m of allMeta) {
          dbDriver.putFallback(m);
        }
      }
    } catch (err) {
      console.warn('[ToolboxFilesystem] Hydration warning:', err);
    }

    // 1. Ensure default root folders exist
    for (const f of DEFAULT_FOLDERS) {
      const existing = await dbDriver.get(f.path);
      if (!existing) {
        await dbDriver.put({
          path: f.path,
          name: f.name,
          parentPath: '/',
          isDirectory: true,
          type: 'directory',
          size: 0,
          mimeType: 'inode/directory',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          storage: 'offline'
        });
      }
    }

    // 2. Synchronize legacy artifacts from artifacts.js
    try {
      const legacyList = legacyArtifacts.list ? legacyArtifacts.list() : [];
      for (const item of legacyList) {
        const destPath = `/Documents/${item.name}`;
        const existing = await dbDriver.get(destPath);
        if (!existing) {
          const full = legacyArtifacts.get(item.id);
          if (full && full.text != null) {
            await dbDriver.put({
              id: item.id,
              path: destPath,
              name: item.name,
              parentPath: '/Documents',
              isDirectory: false,
              size: item.bytes || new Blob([full.text]).size,
              mimeType: getMimeType(item.name),
              kind: item.kind,
              createdAt: item.createdAt || Date.now(),
              updatedAt: item.updatedAt || Date.now(),
              storage: 'offline',
              content: full.text
            });
          }
        }
      }
    } catch (err) {
      console.warn('[ToolboxFilesystem] Legacy sync skipped:', err);
    }
  }

  /**
   * Synchronous listing for immediate DOM rendering & tests
   */
  listSync(dirPath = '/', { storage = 'offline' } = {}) {
    const target = normalizePath(dirPath);
    let all = dbDriver.listAllMetaFallback() || [];

    // Include legacy artifacts if available
    try {
      const legacy = legacyArtifacts.list ? legacyArtifacts.list() : [];
      for (const item of legacy) {
        if (!all.some(m => m.name === item.name || m.id === item.id)) {
          all.push({
            id: item.id,
            path: `/Documents/${item.name}`,
            name: item.name,
            parentPath: '/Documents',
            isDirectory: false,
            size: item.bytes || 0,
            mimeType: getMimeType(item.name),
            kind: item.kind,
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
            storage: 'offline'
          });
        }
      }
    } catch {}

    const children = all.filter(item => {
      const p = normalizePath(item.parentPath || getParentPath(item.path));
      return (p === target || (target === '/Home' && p === '/Documents')) && normalizePath(item.path) !== target;
    });

    return children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Synchronous stat lookup
   */
  statSync(filePath) {
    const norm = normalizePath(filePath);
    const all = dbDriver.listAllMetaFallback() || [];
    const match = all.find(m => m.path === norm || m.id === filePath);
    if (match) return match;
    try {
      const art = legacyArtifacts.get(filePath);
      if (art) {
        return {
          id: art.id,
          name: art.name,
          path: `/Documents/${art.name}`,
          parentPath: '/Documents',
          isDirectory: false,
          size: art.bytes || 0,
          mimeType: getMimeType(art.name),
          kind: art.kind,
          storage: 'offline'
        };
      }
    } catch {}
    return null;
  }

  /**
   * Synchronous file read from memory/fallback cache
   */
  readFileSync(filePath, { encoding = 'utf-8' } = {}) {
    const norm = normalizePath(filePath);
    const rec = dbDriver.getFallback(norm);
    if (!rec || rec.isDirectory) {
      try {
        const art = legacyArtifacts.get(filePath);
        if (art && art.text != null) return art.text;
      } catch {}
      return null;
    }
    if (typeof rec.content === 'string') {
      return rec.content;
    }
    if (rec.binaryData) {
      const bytes = rec.binaryData instanceof Uint8Array ? rec.binaryData : new Uint8Array(Object.values(rec.binaryData));
      if (encoding === 'utf8' || encoding === 'utf-8') {
        try {
          return new TextDecoder().decode(bytes);
        } catch {
          return '';
        }
      }
    }
    return rec.content != null ? String(rec.content) : null;
  }

  /**
   * List files and folders inside a given directory path
   * @param {string} dirPath
   * @param {{storage?: 'offline'|'online'}} options
   * @returns {Promise<Array<Object>>}
   */
  async list(dirPath = '/', { storage = 'offline' } = {}) {
    await this.init();
    const target = normalizePath(dirPath);

    if (storage === 'online') {
      return this._listOnline(target);
    }

    const all = await dbDriver.listAllMeta();
    const children = all.filter(item => {
      const p = normalizePath(item.parentPath || getParentPath(item.path));
      return p === target && normalizePath(item.path) !== target;
    });

    return children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get metadata for a file or directory
   * @param {string} filePath
   * @param {{storage?: 'offline'|'online'}} options
   * @returns {Promise<Object|null>}
   */
  async stat(filePath, { storage = 'offline' } = {}) {
    await this.init();
    const norm = normalizePath(filePath);
    if (norm === '/') {
      return {
        path: '/',
        name: 'Root',
        parentPath: '',
        isDirectory: true,
        type: 'directory',
        size: 0,
        mimeType: 'inode/directory',
        createdAt: 0,
        updatedAt: 0,
        storage
      };
    }

    const rec = await dbDriver.get(norm);
    if (!rec) return null;
    const { content, binaryData, ...meta } = rec;
    meta.type = meta.isDirectory ? 'directory' : 'file';
    return meta;
  }

  /**
   * Reads content of a file
   * @param {string} filePath
   * @param {{encoding?: 'utf-8'|'binary'|'blob'|'dataurl', storage?: 'offline'|'online'}} options
   * @returns {Promise<string|Uint8Array|Blob>}
   */
  async readFile(filePath, { encoding = 'utf-8', storage = 'offline' } = {}) {
    await this.init();
    const norm = normalizePath(filePath);
    const rec = await dbDriver.get(norm);

    if (!rec) throw new Error(`File not found: ${norm}`);
    if (rec.isDirectory) throw new Error(`Cannot read directory as file: ${norm}`);

    if (rec.binaryData) {
      let bytes;
      if (rec.binaryData instanceof Uint8Array) {
        bytes = rec.binaryData;
      } else if (Array.isArray(rec.binaryData) || (typeof rec.binaryData === 'object' && rec.binaryData !== null)) {
        bytes = new Uint8Array(Object.values(rec.binaryData));
      } else {
        bytes = new Uint8Array(0);
      }
      if (encoding === 'binary') return bytes;
      if (encoding === 'blob') return new Blob([bytes], { type: rec.mimeType || 'application/octet-stream' });
      if (encoding === 'dataurl') {
        const base64 = btoa(String.fromCharCode(...bytes));
        return `data:${rec.mimeType || 'application/octet-stream'};base64,${base64}`;
      }
      return new TextDecoder('utf-8').decode(bytes);
    }

    const text = rec.content || '';
    if (encoding === 'binary') return new TextEncoder().encode(text);
    if (encoding === 'blob') return new Blob([text], { type: rec.mimeType || 'text/plain' });
    if (encoding === 'dataurl') {
      return `data:${rec.mimeType || 'text/plain'};charset=utf-8,${encodeURIComponent(text)}`;
    }
    return text;
  }

  /**
   * Write file to filesystem
   * @param {string} filePath
   * @param {string|Uint8Array|ArrayBuffer|Blob} content
   * @param {{encoding?: string, mimeType?: string, storage?: 'offline'|'online'}} options
   * @returns {Promise<Object>} File metadata
   */
  async writeFile(filePath, content, { encoding = 'utf-8', mimeType = '', storage = 'offline' } = {}) {
    await this.init();
    const norm = normalizePath(filePath);
    const name = getBaseName(norm);

    if (!name || name === '.' || name === '..' || /[<>:"|?*]/.test(name)) {
      throw new Error(`Invalid file name: "${name}"`);
    }

    const parentPath = getParentPath(norm);

    // Auto-create parent directory recursively if it does not exist
    if (parentPath !== '/' && !(await this.stat(parentPath))) {
      await this.mkdir(parentPath, { storage });
    }

    const existing = await dbDriver.get(norm);
    if (existing && existing.isDirectory) {
      throw new Error(`A directory already exists at ${norm}`);
    }

    const now = Date.now();
    const calculatedMime = mimeType || getMimeType(name);

    let isBinary = false;
    let binaryData = null;
    let textContent = '';
    let size = 0;

    if (content instanceof Uint8Array || content instanceof ArrayBuffer || (typeof Blob !== 'undefined' && content instanceof Blob)) {
      isBinary = true;
      if (content instanceof Blob) {
        binaryData = new Uint8Array(await content.arrayBuffer());
      } else if (content instanceof ArrayBuffer) {
        binaryData = new Uint8Array(content);
      } else {
        binaryData = content;
      }
      size = binaryData.length;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:') && content.includes(';base64,')) {
        // Base64 Data URL to binary
        const parts = content.split(';base64,');
        const b64 = parts[1];
        const binStr = atob(b64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
        isBinary = true;
        binaryData = bytes;
        size = bytes.length;
      } else {
        textContent = content;
        size = new TextEncoder().encode(content).length;
      }
    }

    const record = {
      id: existing?.id || `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      path: norm,
      name,
      parentPath,
      isDirectory: false,
      type: 'file',
      size,
      mimeType: calculatedMime,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      storage,
      content: isBinary ? '' : textContent,
      binaryData: isBinary ? binaryData : null
    };

    await dbDriver.put(record);

    // Mirror to legacy artifacts if text-based and within limit
    if (!isBinary && size < 1_000_000) {
      try {
        legacyArtifacts.save({
          id: record.id,
          name: record.name,
          kind: legacyArtifacts.kindFromFilename ? legacyArtifacts.kindFromFilename(record.name) : 'text',
          text: textContent,
          from: 'filesystem'
        });
      } catch (err) {}
    }

    // Sync to Supabase Online if requested and signed in
    if (storage === 'online') {
      await this._syncOnline(record);
    }

    this._notify();
    const { content: c, binaryData: b, ...meta } = record;
    return meta;
  }

  /**
   * Creates directory recursively
   * @param {string} dirPath
   * @param {{storage?: 'offline'|'online'}} options
   * @returns {Promise<Object>} Directory metadata
   */
  async mkdir(dirPath, { storage = 'offline' } = {}) {
    await this.init();
    const norm = normalizePath(dirPath);
    if (norm === '/') return await this.stat('/');

    const name = getBaseName(norm);
    if (!name || name === '.' || name === '..' || /[<>:"|?*]/.test(name)) {
      throw new Error(`Invalid folder name: "${name}"`);
    }

    const existing = await dbDriver.get(norm);
    if (existing) {
      if (existing.isDirectory) return existing;
      throw new Error(`A file already exists at ${norm}`);
    }

    const parentPath = getParentPath(norm);
    if (parentPath !== '/' && !(await this.stat(parentPath))) {
      await this.mkdir(parentPath, { storage });
    }

    const now = Date.now();
    const dirRecord = {
      path: norm,
      name,
      parentPath,
      isDirectory: true,
      type: 'directory',
      size: 0,
      mimeType: 'inode/directory',
      createdAt: now,
      updatedAt: now,
      storage
    };

    await dbDriver.put(dirRecord);
    this._notify();
    return dirRecord;
  }

  /**
   * Renames or moves a file or directory
   * @param {string} oldPath
   * @param {string} newPath
   * @returns {Promise<Object>}
   */
  async rename(oldPath, newPath) {
    await this.init();
    const src = normalizePath(oldPath);
    const targetDst = newPath.includes('/') ? newPath : `${getParentPath(src)}/${newPath}`;
    const dst = normalizePath(targetDst);
    if (src === dst) return await this.stat(src);

    const record = await dbDriver.get(src);
    if (!record) throw new Error(`Not found: ${src}`);

    if (record.isDirectory) {
      // Move directory and all descendants
      const all = await dbDriver.listAllMeta();
      const descendants = all.filter(m => m.path === src || m.path.startsWith(src + '/'));

      for (const item of descendants) {
        const full = await dbDriver.get(item.path);
        const subSuffix = item.path.slice(src.length);
        const nextSubPath = normalizePath(dst + subSuffix);
        const nextSubParent = getParentPath(nextSubPath);

        await dbDriver.delete(item.path);
        await dbDriver.put({
          ...full,
          path: nextSubPath,
          name: getBaseName(nextSubPath),
          parentPath: nextSubParent,
          updatedAt: Date.now()
        });
      }
    } else {
      await dbDriver.delete(src);
      const updated = {
        ...record,
        path: dst,
        name: getBaseName(dst),
        parentPath: getParentPath(dst),
        updatedAt: Date.now()
      };
      await dbDriver.put(updated);
    }

    this._notify();
    return await this.stat(dst);
  }

  /**
   * Moves a file or directory
   * @param {string} srcPath
   * @param {string} dstPath
   */
  async move(srcPath, dstPath) {
    return await this.rename(srcPath, dstPath);
  }

  /**
   * Copies a file or folder
   * @param {string} srcPath
   * @param {string} dstPath
   */
  async copy(srcPath, dstPath) {
    const src = normalizePath(srcPath);
    const dst = normalizePath(dstPath);
    const record = await dbDriver.get(src);
    if (!record) throw new Error(`Source not found: ${src}`);

    if (record.isDirectory) {
      await this.mkdir(dst);
      const all = await dbDriver.listAllMeta();
      const descendants = all.filter(m => m.path.startsWith(src + '/'));
      for (const item of descendants) {
        const full = await dbDriver.get(item.path);
        const suffix = item.path.slice(src.length);
        const targetPath = normalizePath(dst + suffix);
        if (full.isDirectory) {
          await this.mkdir(targetPath);
        } else {
          await this.writeFile(targetPath, full.binaryData || full.content || '', {
            mimeType: full.mimeType
          });
        }
      }
    } else {
      await this.writeFile(dst, record.binaryData || record.content || '', {
        mimeType: record.mimeType
      });
    }

    this._notify();
    return await this.stat(dst);
  }

  /**
   * Deletes a file or directory recursively
   * @param {string} targetPath
   * @returns {Promise<boolean>}
   */
  async delete(targetPath) {
    await this.init();
    const norm = normalizePath(targetPath);
    if (norm === '/' || DEFAULT_FOLDERS.some(f => f.path === norm)) {
      throw new Error(`Cannot delete protected system directory: ${norm}`);
    }

    const record = await dbDriver.get(norm);
    if (!record) return false;

    if (record.isDirectory) {
      const all = await dbDriver.listAllMeta();
      const targets = all.filter(m => m.path === norm || m.path.startsWith(norm + '/'));
      for (const t of targets) {
        await dbDriver.delete(t.path);
      }
    } else {
      await dbDriver.delete(norm);
      if (record.id) {
        try { legacyArtifacts.remove(record.id); } catch {}
      }
    }

    this._notify();
    return true;
  }

  /**
   * Returns all file and directory metadata records across the filesystem
   * @returns {Promise<Array<Object>>}
   */
  async listAllMeta() {
    await this.init();
    return dbDriver.listAllMeta();
  }

  /**
   * Deletes a file
   * @param {string} targetPath
   */
  async deleteFile(targetPath) {
    return this.delete(targetPath);
  }

  /**
   * Deletes a folder and all its contents
   * @param {string} targetPath
   */
  async deleteFolder(targetPath) {
    return this.delete(targetPath);
  }

  /**
   * Sets tags for a file or directory
   * @param {string} targetPath
   * @param {Array<string>} tags
   * @returns {Promise<Object|null>}
   */
  async setTags(targetPath, tags = []) {
    await this.init();
    const norm = normalizePath(targetPath);
    const record = await dbDriver.get(norm);
    if (!record) return null;
    const cleanTags = Array.isArray(tags) ? Array.from(new Set(tags.map(t => String(t).trim()).filter(Boolean))) : [];
    const updated = { ...record, tags: cleanTags, updatedAt: Date.now() };
    await dbDriver.put(updated);
    this._notify();
    return updated;
  }

  /**
   * Retrieves tags for a file or directory
   * @param {string} targetPath
   * @returns {Promise<Array<string>>}
   */
  async getTags(targetPath) {
    await this.init();
    const norm = normalizePath(targetPath);
    const record = await dbDriver.get(norm);
    return record?.tags || [];
  }

  /**
   * Adds a single tag
   * @param {string} targetPath
   * @param {string} tag
   */
  async addTag(targetPath, tag) {
    if (!tag) return;
    const current = await this.getTags(targetPath);
    if (!current.includes(tag)) {
      await this.setTags(targetPath, [...current, tag]);
    }
  }

  /**
   * Removes a single tag
   * @param {string} targetPath
   * @param {string} tag
   */
  async removeTag(targetPath, tag) {
    if (!tag) return;
    const current = await this.getTags(targetPath);
    await this.setTags(targetPath, current.filter(t => t !== tag));
  }

  /**
   * Search filesystem for matching names and text contents
   * @param {string} query
   * @param {string} rootPath
   * @returns {Promise<Array<Object>>}
   */
  async search(query = '', rootPath = '/') {
    await this.init();
    const q = String(query).toLowerCase().trim();
    if (!q) return [];
    const root = normalizePath(rootPath);

    const all = await dbDriver.listAllMeta();
    const inRoot = all.filter(m => root === '/' || m.path.startsWith(root + '/') || m.path === root);

    const results = [];
    for (const meta of inRoot) {
      if (meta.name.toLowerCase().includes(q) || meta.path.toLowerCase().includes(q)) {
        results.push(meta);
        continue;
      }
      if (!meta.isDirectory && (meta.size || 0) < 500_000) {
        try {
          const content = await this.readFile(meta.path, { encoding: 'utf-8' });
          if (content.toLowerCase().includes(q)) {
            results.push({ ...meta, matchedContent: true });
          }
        } catch {}
      }
    }
    return results;
  }

  /**
   * Compresses a folder into a ZIP archive saved in destination path
   * @param {string} sourceDirPath
   * @param {string} destZipPath
   * @returns {Promise<Object>} Metadata of created ZIP file
   */
  async compressDirectory(sourceDirPath, destZipPath) {
    const src = normalizePath(sourceDirPath);
    let dst = normalizePath(destZipPath);
    if (!dst.endsWith('.zip')) dst += '.zip';

    const all = await dbDriver.listAllMeta();
    const targets = all.filter(m => !m.isDirectory && m.path.startsWith(src + '/'));

    if (!targets.length) {
      throw new Error(`Directory is empty or contains no files to compress: ${src}`);
    }

    const zipEntries = [];
    for (const item of targets) {
      const relativePath = item.path.slice(src.length + 1);
      const data = await this.readFile(item.path, { encoding: 'binary' });
      zipEntries.push({ path: relativePath, data });
    }

    const zipBlob = await createZip(zipEntries);
    const savedMeta = await this.writeFile(dst, zipBlob, { mimeType: 'application/zip' });
    savedMeta.fileCount = targets.length;
    return savedMeta;
  }

  /**
   * Extracts a ZIP archive into a destination directory
   * @param {string} zipPath
   * @param {string} targetDirPath
   * @returns {Promise<Array<Object>>} List of extracted files
   */
  async extractArchive(zipPath, targetDirPath = '/') {
    const zipNorm = normalizePath(zipPath);
    const targetNorm = normalizePath(targetDirPath);

    const data = await this.readFile(zipNorm, { encoding: 'binary' });
    const entries = await extractZip(data);

    await this.mkdir(targetNorm);
    const createdFiles = [];

    for (const entry of entries) {
      const fullPath = normalizePath(`${targetNorm}/${entry.path}`);
      if (entry.isDirectory) {
        await this.mkdir(fullPath);
      } else {
        const fileMeta = await this.writeFile(fullPath, entry.data, {
          mimeType: getMimeType(entry.name)
        });
        createdFiles.push(fileMeta);
      }
    }

    return {
      extractedCount: createdFiles.length,
      files: createdFiles,
      targetDir: targetNorm
    };
  }

  /* ---------------- Supabase Online Support ---------------- */

  async _listOnline(dirPath) {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('Authentication required for Online Files.');
    }
    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) return [];

    try {
      const res = await fetch(`${config.url}/rest/v1/saved_artifacts?user_id=eq.${user.id}`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map(item => ({
        id: item.id,
        name: item.name,
        path: `/Online/${item.name}`,
        parentPath: '/Online',
        isDirectory: false,
        size: item.payload?.bytes || 0,
        mimeType: getMimeType(item.name),
        kind: item.kind,
        createdAt: new Date(item.created_at).getTime(),
        updatedAt: new Date(item.updated_at).getTime(),
        storage: 'online'
      }));
    } catch {
      return [];
    }
  }

  async _syncOnline(record) {
    const user = getCurrentUser();
    if (!user) return;
    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) return;

    try {
      // 1. Upload to Supabase Storage if binary
      let storageUrl = null;
      if (record.binaryData) {
        const uploadRes = await uploadToSupabaseStorage('toolbox-files', record.name, new Blob([record.binaryData], { type: record.mimeType }));
        storageUrl = uploadRes?.url || null;
      }

      // 2. Sync to saved_artifacts table
      await fetch(`${config.url}/rest/v1/saved_artifacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': `Bearer ${user.token}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: record.id,
          user_id: user.id,
          name: record.name,
          kind: record.kind || 'text',
          storage_url: storageUrl,
          payload: {
            ...record,
            storageUrl
          },
          updated_at: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[ToolboxFilesystem] Online sync warning:', err);
    }
  }
}

export const fs = new ToolboxFilesystem();
ToolboxFilesystem.listAllMeta = async function() {
  return fs.listAllMeta();
};
