/* ============================================================
   Workspace virtual file system.

   A real directory tree held in memory: files (text or binary) and
   folders, with Node-style errors so the shell, the runtimes and the
   assistant all see the same semantics a student would meet on a real
   machine (ENOENT, EISDIR, ENOTEMPTY, ...). Persistence lives in
   store.js; this module only emits change events.
   ============================================================ */

import { normalize, dirname, basename, ancestors, globToRegExp, isInside } from './paths.js';

export class FsError extends Error {
  constructor(code, syscall, path, detail) {
    const text = {
      ENOENT: 'no such file or directory',
      EEXIST: 'file already exists',
      EISDIR: 'illegal operation on a directory',
      ENOTDIR: 'not a directory',
      ENOTEMPTY: 'directory not empty',
      EINVAL: 'invalid argument',
    }[code] || code;
    super(`${code}: ${detail || text}, ${syscall} '${path}'`);
    this.name = 'FsError';
    this.code = code;
    this.syscall = syscall;
    this.path = path;
  }
}

const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

export function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return enc ? enc.encode(String(content ?? '')) : new Uint8Array(0);
}

export function toText(content) {
  if (typeof content === 'string') return content;
  if (content instanceof Uint8Array) return dec ? dec.decode(content) : '';
  if (content instanceof ArrayBuffer) return dec ? dec.decode(new Uint8Array(content)) : '';
  return String(content ?? '');
}

export function sizeOf(content) {
  if (content instanceof Uint8Array) return content.byteLength;
  return enc ? enc.encode(String(content ?? '')).byteLength : String(content ?? '').length;
}

export class WorkspaceFS {
  constructor(initial = null) {
    /** @type {Map<string, {content: string|Uint8Array, mtime: number}>} */
    this.files = new Map();
    /** @type {Set<string>} explicit directories (implicit ones come from file paths) */
    this.dirs = new Set();
    this.listeners = new Set();
    this.version = 0;
    if (initial) this.load(initial);
  }

  /* ---------------- events ---------------- */

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    this.version++;
    for (const fn of [...this.listeners]) {
      try { fn(event); } catch (err) { console.error('[vfs] listener error', err); }
    }
  }

  /* ---------------- queries ---------------- */

  isFile(p) { return this.files.has(normalize(p)); }

  isDir(p) {
    const n = normalize(p);
    if (n === '') return true;
    if (this.dirs.has(n)) return true;
    const prefix = `${n}/`;
    for (const k of this.files.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }

  exists(p) { return this.isFile(p) || this.isDir(p); }

  stat(p) {
    const n = normalize(p);
    const f = this.files.get(n);
    if (f) return { type: 'file', size: sizeOf(f.content), mtime: f.mtime, binary: f.content instanceof Uint8Array };
    if (this.isDir(n)) return { type: 'dir', size: 0, mtime: 0 };
    throw new FsError('ENOENT', 'stat', p);
  }

  readFile(p) {
    const n = normalize(p);
    const f = this.files.get(n);
    if (f) return toText(f.content);
    if (this.isDir(n)) throw new FsError('EISDIR', 'read', p);
    throw new FsError('ENOENT', 'open', p);
  }

  readBinary(p) {
    const n = normalize(p);
    const f = this.files.get(n);
    if (f) return toBytes(f.content);
    if (this.isDir(n)) throw new FsError('EISDIR', 'read', p);
    throw new FsError('ENOENT', 'open', p);
  }

  /** Raw stored value (string or Uint8Array). */
  readRaw(p) {
    const f = this.files.get(normalize(p));
    if (!f) throw new FsError('ENOENT', 'open', p);
    return f.content;
  }

  /** Children of a directory, folders first, both alphabetical. */
  readdir(p = '') {
    const n = normalize(p);
    if (this.files.has(n)) throw new FsError('ENOTDIR', 'scandir', p);
    if (!this.isDir(n)) throw new FsError('ENOENT', 'scandir', p);
    const prefix = n ? `${n}/` : '';
    const entries = new Map();
    const consider = (full, isFile) => {
      if (!full.startsWith(prefix) || full === n) return;
      const rest = full.slice(prefix.length);
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      if (!name) return;
      const childPath = prefix + name;
      if (slash === -1 && isFile) {
        const f = this.files.get(full);
        entries.set(name, { name, path: childPath, type: 'file', size: sizeOf(f.content), mtime: f.mtime });
      } else if (!entries.has(name)) {
        entries.set(name, { name, path: childPath, type: 'dir', size: 0, mtime: 0 });
      }
    };
    for (const k of this.files.keys()) consider(k, true);
    for (const d of this.dirs) consider(d, false);
    return [...entries.values()].sort((a, b) =>
      (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  /** Every file path, sorted. */
  listFiles(under = '') {
    const n = normalize(under);
    return [...this.files.keys()].filter((k) => isInside(n, k)).sort();
  }

  /** Every directory path (explicit and implied), sorted. */
  listDirs() {
    const all = new Set(this.dirs);
    for (const k of this.files.keys()) for (const a of ancestors(dirname(k))) all.add(a);
    return [...all].filter(Boolean).sort();
  }

  /** Glob search, e.g. "src/**\/*.js". Matches file paths. */
  glob(pattern) {
    const re = globToRegExp(normalize(pattern) || '**');
    return this.listFiles().filter((p) => re.test(p));
  }

  /* ---------------- mutations ---------------- */

  assertParentWritable(n, syscall, original) {
    for (const a of ancestors(dirname(n))) {
      if (this.files.has(a)) throw new FsError('ENOTDIR', syscall, original);
    }
  }

  writeFile(p, content, { silent = false, mtime = Date.now(), createOnly = false } = {}) {
    const n = normalize(p);
    if (!n) throw new FsError('EISDIR', 'open', p || '/');
    if (this.isDir(n) && !this.files.has(n)) throw new FsError('EISDIR', 'open', p);
    if (createOnly && this.files.has(n)) throw new FsError('EEXIST', 'open', p);
    this.assertParentWritable(n, 'open', p);
    const existed = this.files.has(n);
    const value = content instanceof ArrayBuffer ? new Uint8Array(content) : (content instanceof Uint8Array ? content : String(content ?? ''));
    const prev = this.files.get(n);
    if (prev && prev.content === value) return false;
    this.files.set(n, { content: value, mtime });
    for (const a of ancestors(dirname(n))) this.dirs.add(a);
    if (!silent) this.emit({ type: existed ? 'change' : 'create', path: n });
    return true;
  }

  appendFile(p, content) {
    const n = normalize(p);
    const prev = this.files.has(n) ? this.readFile(n) : '';
    return this.writeFile(n, prev + String(content ?? ''));
  }

  mkdir(p, { recursive = true, silent = false } = {}) {
    const n = normalize(p);
    if (!n) return false;
    if (this.files.has(n)) throw new FsError('EEXIST', 'mkdir', p);
    if (this.isDir(n)) {
      if (!recursive) throw new FsError('EEXIST', 'mkdir', p);
      return false;
    }
    const parent = dirname(n);
    if (!recursive && parent && !this.isDir(parent)) throw new FsError('ENOENT', 'mkdir', p);
    this.assertParentWritable(n, 'mkdir', p);
    for (const a of ancestors(n)) this.dirs.add(a);
    if (!silent) this.emit({ type: 'mkdir', path: n });
    return true;
  }

  rm(p, { recursive = false, force = false, silent = false } = {}) {
    const n = normalize(p);
    if (!n) throw new FsError('EINVAL', 'rm', p || '/', 'refusing to remove the workspace root');
    if (this.files.has(n)) {
      this.files.delete(n);
      if (!silent) this.emit({ type: 'delete', path: n });
      return true;
    }
    if (this.isDir(n)) {
      const inside = [...this.files.keys()].filter((k) => k.startsWith(`${n}/`));
      const subdirs = [...this.dirs].filter((d) => d === n || d.startsWith(`${n}/`));
      if (!recursive && (inside.length || subdirs.some((d) => d !== n))) throw new FsError('ENOTEMPTY', 'rmdir', p);
      for (const k of inside) this.files.delete(k);
      for (const d of subdirs) this.dirs.delete(d);
      if (!silent) this.emit({ type: 'delete', path: n, dir: true });
      return true;
    }
    if (force) return false;
    throw new FsError('ENOENT', 'rm', p);
  }

  rename(from, to, { overwrite = false, silent = false } = {}) {
    const a = normalize(from);
    const b = normalize(to);
    if (!a || !b) throw new FsError('EINVAL', 'rename', from);
    if (a === b) return false;
    if (!this.exists(a)) throw new FsError('ENOENT', 'rename', from);
    if (isInside(a, b) && this.isDir(a)) throw new FsError('EINVAL', 'rename', from, 'cannot move a directory into itself');
    if (this.exists(b)) {
      if (!overwrite || this.isDir(b)) throw new FsError('EEXIST', 'rename', to);
      this.files.delete(b);
    }
    this.assertParentWritable(b, 'rename', to);
    if (this.files.has(a)) {
      const f = this.files.get(a);
      this.files.delete(a);
      this.files.set(b, { ...f, mtime: Date.now() });
      for (const d of ancestors(dirname(b))) this.dirs.add(d);
    } else {
      const moves = [...this.files.entries()].filter(([k]) => k.startsWith(`${a}/`));
      for (const [k, f] of moves) {
        this.files.delete(k);
        this.files.set(b + k.slice(a.length), f);
      }
      const dmoves = [...this.dirs].filter((d) => d === a || d.startsWith(`${a}/`));
      for (const d of dmoves) { this.dirs.delete(d); this.dirs.add(b + d.slice(a.length)); }
      for (const d of ancestors(b)) this.dirs.add(d);
    }
    if (!silent) this.emit({ type: 'rename', path: b, from: a });
    return true;
  }

  copy(from, to, { recursive = false, overwrite = true } = {}) {
    const a = normalize(from);
    const b = normalize(to);
    if (this.files.has(a)) {
      if (this.isDir(b)) return this.copy(a, `${b}/${basename(a)}`, { recursive, overwrite });
      if (!overwrite && this.files.has(b)) throw new FsError('EEXIST', 'copyfile', to);
      const f = this.files.get(a);
      const content = f.content instanceof Uint8Array ? new Uint8Array(f.content) : f.content;
      return this.writeFile(b, content);
    }
    if (this.isDir(a)) {
      if (!recursive) throw new FsError('EISDIR', 'copyfile', from, `-r not specified; omitting directory`);
      if (isInside(a, b)) throw new FsError('EINVAL', 'cp', from, 'cannot copy a directory into itself');
      const dest = this.isDir(b) ? `${b}/${basename(a)}` : b;
      this.mkdir(dest, { silent: true });
      for (const d of [...this.dirs].filter((x) => x.startsWith(`${a}/`))) this.dirs.add(dest + d.slice(a.length));
      for (const [k, f] of [...this.files.entries()].filter(([k]) => k.startsWith(`${a}/`))) {
        this.writeFile(dest + k.slice(a.length), f.content instanceof Uint8Array ? new Uint8Array(f.content) : f.content, { silent: true });
      }
      this.emit({ type: 'create', path: dest, dir: true });
      return true;
    }
    throw new FsError('ENOENT', 'copyfile', from);
  }

  /* ---------------- snapshots & serialization ---------------- */

  /** Plain object {path: content} for checkpoints and runtimes. */
  snapshot({ textOnly = false } = {}) {
    const out = {};
    for (const [k, f] of this.files) {
      if (textOnly && f.content instanceof Uint8Array) continue;
      out[k] = f.content;
    }
    return { files: out, dirs: [...this.dirs] };
  }

  /** Replace everything with a snapshot; emits one 'reset' event. */
  restore(snap, { silent = false } = {}) {
    this.files.clear();
    this.dirs.clear();
    const now = Date.now();
    for (const [k, v] of Object.entries(snap?.files || {})) {
      const n = normalize(k);
      if (!n) continue;
      this.files.set(n, { content: v, mtime: now });
      for (const a of ancestors(dirname(n))) this.dirs.add(a);
    }
    for (const d of snap?.dirs || []) { const n = normalize(d); if (n) for (const a of ancestors(n)) this.dirs.add(a); }
    if (!silent) this.emit({ type: 'reset', path: '' });
  }

  load(data) { this.restore(data, { silent: true }); }

  totalSize() {
    let n = 0;
    for (const f of this.files.values()) n += sizeOf(f.content);
    return n;
  }
}

/** Render a tree view string like `tree` does. */
export function renderTree(vfs, root = '', { maxDepth = 12, showHidden = false } = {}) {
  const lines = [];
  let files = 0;
  let dirs = 0;
  const walk = (p, prefix, depth) => {
    if (depth > maxDepth) return;
    const kids = vfs.readdir(p).filter((e) => showHidden || !e.name.startsWith('.'));
    kids.forEach((e, i) => {
      const last = i === kids.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${e.name}${e.type === 'dir' ? '/' : ''}`);
      if (e.type === 'dir') { dirs++; walk(e.path, prefix + (last ? '    ' : '│   '), depth + 1); } else files++;
    });
  };
  walk(normalize(root), '', 0);
  return { text: lines.join('\n'), files, dirs };
}
