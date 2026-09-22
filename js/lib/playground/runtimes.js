/* ============================================================
   Runtime manager (page side).

   Starts the language workers in public/playground/, connects their
   output, input and file-system traffic to a terminal session, and
   applies the files programs write back to the workspace.

   Heavy engines come from CDNs the first time they are used (Pyodide,
   sql.js, wasmoon) and from esm.sh for npm packages; the interpreter
   for C/C++ and the TypeScript compiler are served by Toolbox itself.
   Tests and self-hosted deployments can override every URL through
   window.__PG_CDN__.
   ============================================================ */

import { normalize, extname, dirname } from './paths.js';
import { isBinaryPath } from './languages.js';

const DEFAULT_CDN = {
  pyodide: 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/',
  sqljs: 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/',
  wasmoon: 'https://cdn.jsdelivr.net/npm/wasmoon@1.16.0/+esm',
  esm: 'https://esm.sh/',
  typescript: '/vendor/typescript/typescript.min.js',
  jscpp: '/vendor/jscpp/JSCPP.es5.min.js',
  workers: '/playground/',
  sync: '/__pg_sync/',
  sw: '/pg-sw.js',
};

export function cdn(key) {
  const override = typeof window !== 'undefined' && window.__PG_CDN__ ? window.__PG_CDN__[key] : undefined;
  return override ?? DEFAULT_CDN[key];
}

/* ---------------- synchronous input bridge (service worker) ---------------- */

let bridgePromise = null;

/** Register the input-bridge service worker once; resolves true when it controls this page. */
export function ensureSyncBridge({ timeout = 4000 } = {}) {
  if (bridgePromise) return bridgePromise;
  bridgePromise = (async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof window === 'undefined') return false;
      if (!window.isSecureContext) return false;
      await navigator.serviceWorker.register(cdn('sw'), { scope: '/' });
      if (navigator.serviceWorker.controller) return true;
      return await new Promise((resolve) => {
        const t = setTimeout(() => resolve(Boolean(navigator.serviceWorker.controller)), timeout);
        navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); resolve(true); }, { once: true });
      });
    } catch (err) {
      console.warn('[playground] input bridge unavailable:', err?.message || err);
      return false;
    }
  })();
  return bridgePromise;
}

export function syncBridgeReady() {
  return typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller);
}

export function answerSync(id, value) {
  const c = typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null;
  if (c) c.postMessage({ type: 'pg-sync-write', id, value });
}

/* ---------------- worker processes ---------------- */

/**
 * Connects a worker to a terminal context.
 * @param {object} o
 * @param {Worker} o.worker
 * @param {object} o.io  { write(text), writeErr(text), readLine(): Promise<string|null>, prompt?(text):Promise<string|null>, signal?:AbortSignal }
 * @param {import('./vfs.js').WorkspaceFS} [o.vfs]
 * @param {string} [o.fsRoot]  workspace-relative folder programs see as their root ('' = whole workspace)
 * @param {(msg:any)=>boolean|void} [o.onMessage]  extra handler; return true when handled
 * @param {boolean} [o.keepAlive]  do not terminate on exit
 * @returns {{ done: Promise<{code:number, errors:any[]}>, post(msg):void, kill():void }}
 */
export function attachWorker({ worker, io, vfs = null, fsRoot = '', onMessage = null, keepAlive = false }) {
  const errors = [];
  let settled = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const finish = (code) => {
    if (settled) return;
    settled = true;
    if (!keepAlive) try { worker.terminate(); } catch { /* ignore */ }
    io.signal?.removeEventListener?.('abort', onAbort);
    resolveDone({ code, errors });
  };
  const onAbort = () => {
    try { worker.terminate(); } catch { /* ignore */ }
    finish(130);
  };
  if (io.signal?.aborted) queueMicrotask(onAbort);
  io.signal?.addEventListener?.('abort', onAbort, { once: true });

  const rel = (p) => normalize(fsRoot ? `${fsRoot}/${p}` : p);

  worker.onmessage = async (e) => {
    const m = e.data || {};
    if (onMessage && onMessage(m) === true) return;
    switch (m.type) {
      case 'stdout': io.write(m.data); break;
      case 'stderr': io.writeErr(m.data); break;
      case 'status': io.status?.(m.text); break;
      case 'clear': io.clear?.(); break;
      case 'stdin-request': {
        const line = await io.readLine();
        if (!settled) worker.postMessage({ type: 'stdin', data: line === null ? null : `${line}\n` });
        break;
      }
      case 'sync-request': {
        let value;
        if (m.kind === 'prompt') {
          const line = await (io.prompt ? io.prompt(m.payload?.message || '') : (io.write(`${m.payload?.message || ''} `), io.readLine()));
          value = { value: line };
        } else if (m.kind === 'confirm') {
          io.write(`${m.payload?.message || ''} [y/N] `);
          const line = await io.readLine();
          value = { value: /^y(es)?$/i.test(String(line || '').trim()) };
        } else {
          const line = await io.readLine();
          value = line === null ? { eof: true } : { value: line };
        }
        answerSync(m.id, value);
        break;
      }
      case 'fs': if (vfs) applyFsOp(vfs, m, rel); break;
      case 'error': errors.push(m); break;
      case 'image': io.image?.(m); break;
      case 'exit': finish(Number(m.code) || 0); break;
      default: break;
    }
  };
  worker.onerror = (e) => {
    e.preventDefault?.();
    io.writeErr(`\x1b[31m${e.message || 'The runtime crashed.'}\x1b[0m\n`);
    finish(1);
  };
  return {
    done,
    post: (msg, transfer) => worker.postMessage(msg, transfer || []),
    kill: () => onAbort(),
    worker,
  };
}

export function applyFsOp(vfs, m, rel = normalize) {
  try {
    if (m.op === 'write') vfs.writeFile(rel(m.path), m.content);
    else if (m.op === 'mkdir') vfs.mkdir(rel(m.path));
    else if (m.op === 'rm') vfs.rm(rel(m.path), { recursive: true, force: true });
    else if (m.op === 'rename') vfs.rename(rel(m.path), rel(m.to), { overwrite: true });
  } catch (err) {
    console.warn('[playground] fs op failed', m, err);
  }
}

export function workerUrl(name) {
  return `${cdn('workers')}${name}`;
}

/** Text files (and optionally binary) under a folder, as {relativePath: content}. */
export function collectFiles(vfs, { under = '', binary = false, exclude = /(^|\/)(node_modules|\.git)(\/|$)/ } = {}) {
  const out = {};
  const base = normalize(under);
  for (const p of vfs.listFiles(base)) {
    if (exclude && exclude.test(p)) continue;
    const bin = isBinaryPath(p);
    if (bin && !binary) continue;
    const key = base ? p.slice(base.length + 1) : p;
    out[key] = bin ? vfs.readBinary(p) : vfs.readFile(p);
  }
  return out;
}

/* ---------------- npm packages via esm.sh ---------------- */

const NODE_BUILTINS = new Set(['fs', 'fs/promises', 'path', 'events', 'util', 'assert', 'assert/strict', 'readline', 'readline/promises',
  'process', 'os', 'crypto', 'url', 'querystring', 'buffer', 'timers', 'timers/promises', 'string_decoder', 'child_process', 'http', 'https',
  'net', 'stream', 'worker_threads', 'perf_hooks', 'test', 'zlib', 'tty', 'module', 'v8', 'vm', 'dns', 'cluster']);
export const VIRTUAL_PACKAGES = new Set(['express', 'body-parser', 'cors', 'dotenv', 'morgan', 'nodemon', 'vitest', '@jest/globals', 'jest', 'nodemon', 'vite', '@vitejs/plugin-react', 'typescript', 'prettier', 'eslint', 'tsx', 'ts-node']);

const IMPORT_RE = /(?:import\s+(?:[\w*{}\s,$]+\s+from\s+)?|export\s+(?:[\w*{}\s,$]+\s+from\s+)|require\s*\(\s*|import\s*\(\s*)['"]([^'"\n]+)['"]/g;

/** Bare package specifiers imported by the given sources. */
export function scanImports(sources) {
  const found = new Set();
  for (const code of sources) {
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(code))) {
      const spec = m[1];
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || /^(node:|https?:|data:|blob:)/.test(spec)) continue;
      const bare = spec.replace(/^node:/, '');
      if (NODE_BUILTINS.has(bare) || VIRTUAL_PACKAGES.has(packageName(spec))) continue;
      found.add(spec);
    }
  }
  return [...found];
}

export function packageName(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function readDependencies(vfs, root = '') {
  const p = normalize(root ? `${root}/package.json` : 'package.json');
  try {
    const pkg = JSON.parse(vfs.readFile(p));
    return { ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) };
  } catch { return {}; }
}

/** esm.sh URL for a specifier, pinned to the version in package.json when present. */
export function esmUrl(spec, deps = {}, { target = 'es2022', dev = false } = {}) {
  const name = packageName(spec);
  const sub = spec.slice(name.length);
  let version = deps[name] ? String(deps[name]).replace(/^[\^~>=<\s]+/, '').split(/\s|\|\|/)[0] : '';
  if (!/^\d|^latest|^next/.test(version)) version = '';
  const base = cdn('esm');
  return `${base}${name}${version ? `@${version}` : ''}${sub}${sub.includes('?') ? '&' : '?'}target=${target}${dev ? '&dev' : ''}`;
}

/** Look up a package on the npm registry (CORS-enabled). */
export async function fetchPackageInfo(spec, { signal } = {}) {
  const at = spec.lastIndexOf('@');
  const name = at > 0 ? spec.slice(0, at) : spec;
  const range = at > 0 ? spec.slice(at + 1) : 'latest';
  const res = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}`, { signal, headers: { Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8' } });
  if (res.status === 404) throw Object.assign(new Error(`404 Not Found - '${name}' is not in the npm registry.`), { code: 'E404' });
  if (!res.ok) throw new Error(`npm registry responded ${res.status}`);
  const data = await res.json();
  const tags = data['dist-tags'] || {};
  let version = tags[range] || (data.versions?.[range] ? range : null);
  if (!version) version = maxSatisfying(Object.keys(data.versions || {}), range) || tags.latest;
  const v = data.versions?.[version] || {};
  return {
    name: data.name || name,
    version,
    description: v.description || data.description || '',
    dependencies: v.dependencies || {},
    license: v.license || '',
    homepage: v.homepage || '',
    deprecated: v.deprecated || null,
  };
}

/** Tiny semver range matcher for ^, ~, >=, x-ranges and exact versions. */
export function maxSatisfying(versions, range) {
  const parse = (v) => String(v).replace(/^v/, '').split(/[-+]/)[0].split('.').map((n) => parseInt(n, 10) || 0);
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  const r = String(range || '').trim();
  const stable = versions.filter((v) => !/-/.test(v));
  const ok = (v) => {
    if (!r || r === '*' || r === 'latest' || r === 'x') return true;
    const pv = parse(v);
    if (r.startsWith('^')) { const b = parse(r.slice(1)); return cmp(pv, b) >= 0 && (b[0] > 0 ? pv[0] === b[0] : b[1] > 0 ? pv[0] === 0 && pv[1] === b[1] : pv[0] === 0 && pv[1] === 0 && pv[2] === b[2]); }
    if (r.startsWith('~')) { const b = parse(r.slice(1)); return cmp(pv, b) >= 0 && pv[0] === b[0] && pv[1] === b[1]; }
    if (r.startsWith('>=')) return cmp(pv, parse(r.slice(2))) >= 0;
    if (/x|\*/.test(r)) { const parts = r.split('.'); return parts.every((p, i) => p === 'x' || p === '*' || Number(p) === pv[i]); }
    if (/^\d+$/.test(r)) return pv[0] === Number(r);
    if (/^\d+\.\d+$/.test(r)) { const b = parse(r); return pv[0] === b[0] && pv[1] === b[1]; }
    return v === r;
  };
  return stable.filter(ok).sort((a, b) => cmp(parse(b), parse(a)))[0] || null;
}

/* ---------------- entry points & project detection ---------------- */

export function isTestFile(p) {
  return /(^|\/)(__tests__\/.*\.[cm]?[jt]sx?|.*\.(test|spec)\.[cm]?[jt]sx?)$/.test(p);
}

export function findTestFiles(vfs, under = '') {
  return vfs.listFiles(under).filter((p) => !/(^|\/)node_modules\//.test(p) && isTestFile(p));
}

export function pythonTestFiles(vfs, under = '') {
  return vfs.listFiles(under).filter((p) => /(^|\/)(test_[^/]*|[^/]*_test)\.py$/.test(p));
}

/** Guess what "run the project" means for a workspace folder. */
export function detectProject(vfs, root = '') {
  const r = normalize(root);
  const j = (p) => normalize(r ? `${r}/${p}` : p);
  const has = (p) => vfs.isFile(j(p));
  let pkg = null;
  if (has('package.json')) { try { pkg = JSON.parse(vfs.readFile(j('package.json'))); } catch { pkg = {}; } }
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const isWeb = has('index.html') || Boolean(deps.react || deps.vue || deps.vite || deps.svelte || deps['react-dom']);
  const isServer = Boolean(deps.express) || /app\.listen|createServer/.test([pkg?.main, 'server.js', 'app.js', 'index.js'].filter(Boolean).map((f) => (has(f) ? vfs.readFile(j(f)) : '')).join('\n'));
  return {
    pkg,
    deps,
    isWeb,
    isServer,
    python: has('main.py') ? j('main.py') : has('app.py') ? j('app.py') : null,
    node: pkg?.main && has(pkg.main) ? j(pkg.main) : ['index.js', 'main.js', 'server.js', 'app.js', 'src/index.js', 'index.ts', 'src/index.ts', 'main.ts'].map(j).find((p) => vfs.isFile(p)) || null,
    cpp: ['main.cpp', 'src/main.cpp', 'main.cc', 'main.c', 'src/main.c'].map(j).find((p) => vfs.isFile(p)) || null,
    html: has('index.html') ? j('index.html') : null,
  };
}

export { extname, dirname };
