/* ============================================================
   Git for Code Playground.

   A real version-control system over the workspace, with the everyday
   git command line students learn: init, status, add, rm, commit, log,
   diff, show, branch, checkout/switch, restore, reset, merge, stash,
   tag, remote, config — plus clone / pull / push to GitHub through the
   GitHub REST API (CORS-enabled), so work genuinely lands in a GitHub
   repository.

   Storage: file contents are content-addressed with git's own blob hash
   (SHA-1 of "blob <size>\0<data>"), so a blob pushed to or cloned from
   GitHub has the same id locally and remotely. Commits and trees are
   kept as small JSON records; repository metadata (refs, index, config)
   lives with the workspace. A workspace can hold several repositories
   (e.g. after `git clone` into a sub-folder); commands use the nearest
   repository above the current folder, exactly like git.
   ============================================================ */

import { normalize, dirname, relative, globToRegExp } from './paths.js';
import { toBytes, toText } from './vfs.js';
import { unifiedDiff, colorizeDiff, diffLines } from './commands-core.js';
import { parseArgs, color } from './shell.js';
import { isBinaryPath } from './languages.js';

const TOKEN_KEY = 'toolbox_pg_github_token';

/* ---------------- hashing ---------------- */

async function sha1Hex(bytes) {
  const buf = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function blobHash(content) {
  const data = toBytes(content);
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const all = new Uint8Array(header.length + data.length);
  all.set(header);
  all.set(data, header.length);
  return sha1Hex(all);
}

async function objectHash(obj) {
  return sha1Hex(new TextEncoder().encode(JSON.stringify(obj)));
}

/* ---------------- ignore rules ---------------- */

function ignoreMatcher(vfs, root) {
  const rules = [{ re: /(^|\/)node_modules(\/|$)/, neg: false }, { re: /(^|\/)\.git(\/|$)/, neg: false }, { re: /(^|\/)__pycache__(\/|$)/, neg: false }, { re: /(^|\/)\.DS_Store$/, neg: false }];
  const file = normalize(root ? `${root}/.gitignore` : '.gitignore');
  if (vfs.isFile(file)) {
    for (let line of vfs.readFile(file).split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const neg = line.startsWith('!');
      if (neg) line = line.slice(1);
      const anchored = line.startsWith('/') || line.slice(0, -1).includes('/');
      let pat = line.replace(/^\//, '');
      const dirOnly = pat.endsWith('/');
      if (dirOnly) pat = pat.slice(0, -1);
      const base = globToRegExp(pat).source.slice(1, -1);
      const re = new RegExp(`${anchored ? '^' : '(^|/)'}${base}${dirOnly ? '/' : '(/|$)'}`);
      rules.push({ re, neg });
    }
  }
  return (rel) => {
    let ignored = false;
    for (const r of rules) if (r.re.test(rel)) ignored = !r.neg;
    return ignored;
  };
}

/* ---------------- repository ---------------- */

export class GitStore {
  /**
   * @param {object} o
   * @param {import('./vfs.js').WorkspaceFS} o.vfs
   * @param {()=>any} o.getMeta      returns the persisted git metadata object (mutated in place)
   * @param {()=>Promise<void>} o.saveMeta
   * @param {(objects:Record<string,any>)=>Promise<void>} o.putObjects
   * @param {(hash:string)=>Promise<any>} o.getObject
   */
  constructor({ vfs, getMeta, saveMeta, putObjects, getObject }) {
    this.vfs = vfs;
    this.getMeta = getMeta;
    this.saveMeta = saveMeta;
    this.putObjects = putObjects;
    this.getObjectRaw = getObject;
    this.cache = new Map();
  }

  get meta() {
    const m = this.getMeta();
    if (!m.repos) m.repos = {};
    return m;
  }

  /** Repository root containing `path` (workspace-relative), or null. */
  findRoot(path = '') {
    const roots = Object.keys(this.meta.repos).sort((a, b) => b.length - a.length);
    const p = normalize(path);
    return roots.find((r) => !r || p === r || p.startsWith(`${r}/`)) ?? null;
  }

  repo(root) { return this.meta.repos[root]; }

  async getObject(hash) {
    if (this.cache.has(hash)) return this.cache.get(hash);
    const v = await this.getObjectRaw(hash);
    if (v !== undefined) this.cache.set(hash, v);
    return v;
  }

  async storeObjects(objs) {
    for (const [k, v] of Object.entries(objs)) this.cache.set(k, v);
    await this.putObjects(objs);
  }

  async init(root, { branch = 'main' } = {}) {
    const r = normalize(root);
    const existing = this.meta.repos[r];
    if (existing) return { reinit: true };
    this.meta.repos[r] = { head: { branch }, branches: { [branch]: null }, index: {}, config: {}, remotes: {}, tags: {}, stash: [], upstream: {}, synced: {} };
    await this.saveMeta();
    return { reinit: false };
  }

  /* ---------- snapshots ---------- */

  /** Map of repo-relative path → content for the working tree (ignored files excluded). */
  workingFiles(root) {
    const ignored = ignoreMatcher(this.vfs, root);
    const out = new Map();
    for (const p of this.vfs.listFiles(root)) {
      const rel = root ? p.slice(root.length + 1) : p;
      // nested repositories belong to themselves
      if (Object.keys(this.meta.repos).some((r) => r !== root && r && (p === r || p.startsWith(`${r}/`)) && (!root || r.startsWith(`${root}/`)))) continue;
      if (ignored(rel)) continue;
      out.set(rel, p);
    }
    return out;
  }

  async workingHashes(root) {
    const out = {};
    for (const [rel, p] of this.workingFiles(root)) out[rel] = await blobHash(this.vfs.readRaw(p));
    return out;
  }

  headCommitId(repo) {
    if (repo.head.detached) return repo.head.detached;
    return repo.branches[repo.head.branch] ?? null;
  }

  async commitTree(commitId) {
    if (!commitId) return {};
    const c = await this.getObject(commitId);
    return c?.tree || {};
  }

  async resolveRev(repo, rev) {
    if (!rev || rev === 'HEAD') return this.headCommitId(repo);
    const m = /^(.+?)((?:[~^]\d*)+)$/.exec(rev);
    if (m) {
      let id = await this.resolveRev(repo, m[1]);
      const steps = m[2].match(/[~^]\d*/g);
      for (const s of steps) {
        const n = s.length > 1 ? Number(s.slice(1)) : 1;
        for (let i = 0; i < (s[0] === '~' ? n : 1); i++) {
          const c = id ? await this.getObject(id) : null;
          id = s[0] === '^' && n > 1 ? c?.parents?.[n - 1] ?? null : c?.parents?.[0] ?? null;
        }
      }
      return id;
    }
    if (rev in repo.branches) return repo.branches[rev];
    if (repo.tags?.[rev]) return repo.tags[rev];
    // short id
    const all = await this.allCommits(repo);
    const hit = all.filter((id) => id.startsWith(rev));
    if (hit.length === 1) return hit[0];
    return undefined;
  }

  async allCommits(repo) {
    const seen = new Set();
    const stack = [...Object.values(repo.branches), ...Object.values(repo.tags || {})].filter(Boolean);
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const c = await this.getObject(id);
      for (const p of c?.parents || []) stack.push(p);
    }
    return [...seen];
  }

  async log(repo, from, limit = 1000) {
    const out = [];
    const seen = new Set();
    const queue = from ? [from] : [];
    while (queue.length && out.length < limit) {
      // newest first by date
      queue.sort((a, b) => (this.cache.get(b)?.date || 0) - (this.cache.get(a)?.date || 0));
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const c = await this.getObject(id);
      if (!c) continue;
      out.push({ id, ...c });
      for (const p of c.parents || []) { await this.getObject(p); queue.push(p); }
    }
    return out;
  }

  async isAncestor(a, b) {
    // is commit a an ancestor of (or equal to) b?
    if (!a) return true;
    const seen = new Set();
    const stack = [b];
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      if (id === a) return true;
      seen.add(id);
      const c = await this.getObject(id);
      for (const p of c?.parents || []) stack.push(p);
    }
    return false;
  }

  async mergeBase(a, b) {
    const ancestorsA = new Set();
    const stack = [a];
    while (stack.length) {
      const id = stack.pop();
      if (!id || ancestorsA.has(id)) continue;
      ancestorsA.add(id);
      const c = await this.getObject(id);
      for (const p of c?.parents || []) stack.push(p);
    }
    const queue = [b];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      if (ancestorsA.has(id)) return id;
      seen.add(id);
      const c = await this.getObject(id);
      for (const p of c?.parents || []) queue.push(p);
    }
    return null;
  }

  /** Changes between HEAD, index and working tree. */
  async status(root) {
    const repo = this.repo(root);
    const headTree = await this.commitTree(this.headCommitId(repo));
    const index = repo.index;
    const work = await this.workingHashes(root);
    const staged = [];
    const unstaged = [];
    const untracked = [];
    const paths = new Set([...Object.keys(headTree), ...Object.keys(index)]);
    for (const p of [...paths].sort()) {
      const h = headTree[p];
      const i = index[p];
      if (h !== i) staged.push({ path: p, kind: !h ? 'new file' : !i ? 'deleted' : 'modified' });
    }
    for (const p of Object.keys(index).sort()) {
      if (!(p in work)) unstaged.push({ path: p, kind: 'deleted' });
      else if (work[p] !== index[p]) unstaged.push({ path: p, kind: 'modified' });
    }
    for (const p of Object.keys(work).sort()) if (!(p in index)) untracked.push(p);
    return { staged, unstaged, untracked, work, headTree };
  }

  async add(root, pathspecs, { all = false, update = false } = {}) {
    const repo = this.repo(root);
    const work = await this.workingHashes(root);
    const blobs = {};
    const matchers = pathspecs.map((s) => {
      const n = normalize(s);
      if (!n || n === '.') return () => true;
      if (/[*?[]/.test(n)) { const re = globToRegExp(n); const re2 = globToRegExp(`${n}/**`); return (p) => re.test(p) || re2.test(p); }
      return (p) => p === n || p.startsWith(`${n}/`);
    });
    const matches = (p) => all || matchers.some((m) => m(p));
    let matchedAny = all || pathspecs.some((s) => !normalize(s) || normalize(s) === '.');
    for (const [rel, hash] of Object.entries(work)) {
      if (!matches(rel)) continue;
      if (update && !(rel in repo.index)) continue;
      matchedAny = true;
      if (repo.index[rel] !== hash) {
        repo.index[rel] = hash;
        const abs = normalize(root ? `${root}/${rel}` : rel);
        blobs[hash] = this.vfs.readRaw(abs);
      }
    }
    for (const rel of Object.keys(repo.index)) {
      if (matches(rel) && !(rel in work)) { delete repo.index[rel]; matchedAny = true; }
    }
    await this.storeObjects(blobs);
    await this.saveMeta();
    return { matchedAny };
  }

  async commit(root, message, { author, amend = false, parentsOverride = null } = {}) {
    const repo = this.repo(root);
    const headId = this.headCommitId(repo);
    let parents = headId ? [headId] : [];
    if (amend && headId) parents = (await this.getObject(headId))?.parents || [];
    if (parentsOverride) parents = parentsOverride;
    const tree = { ...repo.index };
    const commit = { tree, parents, message, author, date: Date.now() };
    const id = await objectHash(commit);
    await this.storeObjects({ [id]: commit });
    if (repo.head.detached) repo.head.detached = id; else repo.branches[repo.head.branch] = id;
    await this.saveMeta();
    return { id, commit };
  }

  /** Write a tree into the working directory (removes tracked files not in it). */
  async writeTree(root, tree, { previous = {} } = {}) {
    for (const rel of Object.keys(previous)) {
      if (!(rel in tree)) this.vfs.rm(normalize(root ? `${root}/${rel}` : rel), { force: true });
    }
    for (const [rel, hash] of Object.entries(tree)) {
      const abs = normalize(root ? `${root}/${rel}` : rel);
      const content = await this.getObject(hash);
      if (content === undefined) throw new Error(`missing object ${hash} for ${rel}`);
      const cur = this.vfs.isFile(abs) ? this.vfs.readRaw(abs) : undefined;
      if (cur === undefined || (await blobHash(cur)) !== hash) this.vfs.writeFile(abs, content);
    }
  }

  /** Tree-level three-way merge. Returns {tree, conflicts, blobs}. */
  async threeWay(base, ours, theirs) {
    const tree = {};
    const conflicts = [];
    const blobs = {};
    const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
    for (const p of paths) {
      const b = base[p]; const o = ours[p]; const t = theirs[p];
      if (o === t) { if (o) tree[p] = o; continue; }
      if (o === b) { if (t) tree[p] = t; continue; }
      if (t === b) { if (o) tree[p] = o; continue; }
      // both changed differently
      if (o && t && !isBinaryPath(p)) {
        const merged = merge3(toText(b ? await this.getObject(b) : ''), toText(await this.getObject(o)), toText(await this.getObject(t)));
        const h = await blobHash(merged.text);
        blobs[h] = merged.text;
        tree[p] = h;
        if (merged.conflict) conflicts.push(p);
      } else {
        conflicts.push(p);
        tree[p] = o || t;
      }
    }
    return { tree, conflicts, blobs };
  }
}

/** Line-level three-way merge with conflict markers. */
export function merge3(base, ours, theirs, labels = ['HEAD', 'theirs']) {
  if (ours === theirs) return { text: ours, conflict: false };
  if (base === ours) return { text: theirs, conflict: false };
  if (base === theirs) return { text: ours, conflict: false };
  const B = base.split('\n');
  const opsO = diffLines(B, ours.split('\n'));
  const opsT = diffLines(B, theirs.split('\n'));
  // Build per-base-line change maps: for each base index, what replaced it
  const chunks = (ops) => {
    const res = []; // {start, end, lines}
    let bi = 0;
    let cur = null;
    for (const op of ops) {
      if (op.type === '=') { if (cur) { res.push(cur); cur = null; } bi = op.a + 1; continue; }
      if (!cur) cur = { start: op.type === '-' ? op.a : bi, end: op.type === '-' ? op.a : bi, lines: [] };
      if (op.type === '-') { cur.end = op.a + 1; bi = op.a + 1; } else cur.lines.push(op.line);
    }
    if (cur) res.push(cur);
    return res;
  };
  const co = chunks(opsO);
  const ct = chunks(opsT);
  const out = [];
  let conflict = false;
  let bi = 0;
  let i = 0; let j = 0;
  while (i < co.length || j < ct.length) {
    const a = co[i]; const b = ct[j];
    const next = (!b || (a && a.start <= b.start)) ? a : b;
    while (bi < next.start) out.push(B[bi++]);
    if (a && b && a.start < Math.max(b.end, b.start + 1) && b.start < Math.max(a.end, a.start + 1)) {
      const start = Math.min(a.start, b.start);
      const end = Math.max(a.end, b.end);
      const oursLines = [...B.slice(start, a.start), ...a.lines, ...B.slice(a.end, end)];
      const theirsLines = [...B.slice(start, b.start), ...b.lines, ...B.slice(b.end, end)];
      if (oursLines.join('\n') === theirsLines.join('\n')) out.push(...oursLines);
      else { conflict = true; out.push(`<<<<<<< ${labels[0]}`, ...oursLines, '=======', ...theirsLines, `>>>>>>> ${labels[1]}`); }
      bi = end; i++; j++;
    } else {
      out.push(...next.lines);
      bi = next.end;
      if (next === a) i++; else j++;
    }
  }
  while (bi < B.length) out.push(B[bi++]);
  return { text: out.join('\n'), conflict };
}

/* ---------------- GitHub API ---------------- */

export function parseGitHubUrl(url) {
  const m = /github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/.exec(String(url || '').trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function getGitHubToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setGitHubToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

async function gh(path, { token, method = 'GET', body, signal } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.message ? `${data.message}${res.status === 401 ? ' (check your GitHub token)' : ''}` : `GitHub API ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64decode(str) {
  const s = atob(String(str).replace(/\s/g, ''));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/* ---------------- command ---------------- */

export function registerGit(shell, store, { getAuthor, onChange, prompt } = {}) {
  const w = (ctx, s = '') => ctx.stdout.write(`${s}\n`);
  const e = (ctx, s) => ctx.stderr.write(`${s}\n`);
  const short = (id) => (id ? id.slice(0, 7) : '0000000');
  const fmtDate = (ms) => new Date(ms).toString().replace(/ \(.*\)$/, '');

  const requireRepo = (ctx) => {
    const root = store.findRoot(shell.cwd);
    if (root === null) { e(ctx, 'fatal: not a git repository (or any of the parent directories): .git'); return null; }
    return root;
  };
  const relToRepo = (root, arg) => {
    const abs = shell.resolve(arg);
    if (root && !(abs === root || abs.startsWith(`${root}/`))) return null;
    return root ? (abs === root ? '' : abs.slice(root.length + 1)) : abs;
  };
  const author = () => {
    const a = getAuthor?.() || {};
    return { name: a.name || 'Student', email: a.email || 'student@toolbox.local' };
  };
  const hasUncommitted = async (root) => {
    const st = await store.status(root);
    return st.staged.length || st.unstaged.length;
  };

  const sub = {
    async init(ctx, args) {
      const target = shell.resolve(args.find((a) => !a.startsWith('-')) || '.');
      const { flags } = parseArgs(args, { string: ['b', 'initial-branch'] });
      if (!store.vfs.isDir(target)) store.vfs.mkdir(target);
      const res = await store.init(target, { branch: flags.b || flags['initial-branch'] || 'main' });
      w(ctx, `${res.reinit ? 'Reinitialized existing' : 'Initialized empty'} Git repository in ${target ? `/workspace/${target}` : '/workspace'}/.git/`);
      onChange?.();
      return 0;
    },

    async status(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const st = await store.status(root);
      const shortMode = args.includes('-s') || args.includes('--short');
      if (shortMode) {
        const rows = new Map();
        for (const s of st.staged) rows.set(s.path, [s.kind === 'new file' ? 'A' : s.kind === 'deleted' ? 'D' : 'M', ' ']);
        for (const u of st.unstaged) { const r = rows.get(u.path) || [' ', ' ']; r[1] = u.kind === 'deleted' ? 'D' : 'M'; rows.set(u.path, r); }
        for (const [p, [x, y]] of [...rows].sort()) w(ctx, `${color('green', x)}${color('red', y)} ${p}`);
        for (const p of st.untracked) w(ctx, `${color('red', '??')} ${p}`);
        return 0;
      }
      w(ctx, repo.head.detached ? `HEAD detached at ${short(repo.head.detached)}` : `On branch ${repo.head.branch}`);
      const headId = store.headCommitId(repo);
      const up = repo.upstream?.[repo.head.branch];
      if (up && headId) {
        const synced = repo.synced?.[`${up.remote}/${up.branch}`];
        const ahead = synced ? (await store.log(repo, headId)).findIndex((c) => c.id === synced.local) : -1;
        if (ahead > 0) w(ctx, `Your branch is ahead of '${up.remote}/${up.branch}' by ${ahead} commit${ahead === 1 ? '' : 's'}.\n  (use "git push" to publish your local commits)`);
        else if (ahead === 0) w(ctx, `Your branch is up to date with '${up.remote}/${up.branch}'.`);
      }
      if (!headId) w(ctx, '\nNo commits yet');
      if (repo.merging) w(ctx, `\nYou have unmerged paths.\n  (fix conflicts and run "git commit")`);
      if (st.staged.length) {
        w(ctx, '\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)');
        for (const s of st.staged) w(ctx, color('green', `\t${(`${s.kind}:`).padEnd(12)}${s.path}`));
      }
      if (st.unstaged.length) {
        w(ctx, '\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)');
        for (const s of st.unstaged) w(ctx, color('red', `\t${(`${s.kind}:`).padEnd(12)}${s.path}`));
      }
      if (st.untracked.length) {
        w(ctx, '\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)');
        for (const p of st.untracked) w(ctx, color('red', `\t${p}`));
      }
      if (!st.staged.length && !st.unstaged.length && !st.untracked.length) w(ctx, `${headId ? '\n' : ''}nothing to commit, working tree clean`);
      else if (!st.staged.length) w(ctx, `\nno changes added to commit (use "git add" and/or "git commit -a")`);
      return 0;
    },

    async add(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const { flags, positional } = parseArgs(args, { alias: { all: 'A', update: 'u' } });
      if (!positional.length && !flags.A && !flags.u) { e(ctx, 'Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?'); return 0; }
      const specs = [];
      for (const p of positional) {
        const r = relToRepo(root, p);
        if (r === null) { e(ctx, `fatal: ${p}: '${p}' is outside repository`); return 128; }
        specs.push(r);
      }
      const res = await store.add(root, specs, { all: Boolean(flags.A), update: Boolean(flags.u) });
      if (!res.matchedAny) { e(ctx, `fatal: pathspec '${positional[0]}' did not match any files`); return 128; }
      if (flags.v) w(ctx, 'staged changes');
      onChange?.();
      return 0;
    },

    async rm(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const { flags, positional } = parseArgs(args);
      const repo = store.repo(root);
      for (const p of positional) {
        const r = relToRepo(root, p);
        const hits = Object.keys(repo.index).filter((k) => k === r || (flags.r && k.startsWith(`${r}/`)));
        if (!hits.length) { e(ctx, `fatal: pathspec '${p}' did not match any files`); return 128; }
        for (const h of hits) {
          delete repo.index[h];
          if (!flags.cached) store.vfs.rm(normalize(root ? `${root}/${h}` : h), { force: true });
          w(ctx, `rm '${h}'`);
        }
      }
      await store.saveMeta();
      onChange?.();
      return 0;
    },

    async commit(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const { flags } = parseArgs(args, { string: ['m', 'message'], alias: { all: 'a', message: 'm' } });
      const repo = store.repo(root);
      let msg = flags.m;
      // support multiple -m flags
      const ms = [];
      for (let i = 0; i < args.length; i++) if ((args[i] === '-m' || args[i] === '--message') && args[i + 1] !== undefined) ms.push(args[++i]); else if (args[i].startsWith('-m') && args[i].length > 2 && !args[i].startsWith('-m=')) ms.push(args[i].slice(2)); else if (/^-a?m$/.test(args[i]) && args[i + 1] !== undefined) ms.push(args[++i]);
      if (ms.length) msg = ms.join('\n\n');
      if (flags.a || /^-am$/.test(args[0] || '')) await store.add(root, [], { all: true, update: true });
      if (!msg && !flags.amend) {
        msg = await (prompt ? prompt(ctx, 'Commit message: ') : null);
        if (!msg) { e(ctx, 'Aborting commit due to empty commit message.'); return 1; }
      }
      const st = await store.status(root);
      if (!st.staged.length && !flags.amend && !repo.merging && !flags['allow-empty']) {
        w(ctx, repo.head.detached ? `HEAD detached at ${short(repo.head.detached)}` : `On branch ${repo.head.branch}`);
        if (st.unstaged.length || st.untracked.length) w(ctx, 'Changes not staged for commit. Use "git add" to stage them (or "git commit -a").');
        else w(ctx, 'nothing to commit, working tree clean');
        return 1;
      }
      if (Object.values(repo.index).length) {
        // refuse to commit unresolved conflict markers
        for (const rel of repo.merging?.conflicts || []) {
          const abs = normalize(root ? `${root}/${rel}` : rel);
          if (store.vfs.isFile(abs) && /^<<<<<<< /m.test(store.vfs.readFile(abs))) { e(ctx, `error: ${rel} still contains conflict markers. Fix it, then git add it.`); return 1; }
        }
      }
      const headBefore = store.headCommitId(repo);
      const prevMsg = headBefore && flags.amend ? (await store.getObject(headBefore))?.message : null;
      const parentsOverride = repo.merging ? [headBefore, repo.merging.theirs].filter(Boolean) : null;
      const { id } = await store.commit(root, msg || prevMsg || 'amend', { author: author(), amend: Boolean(flags.amend), parentsOverride });
      delete repo.merging;
      await store.saveMeta();
      const stat = st.staged;
      w(ctx, `[${repo.head.detached ? 'detached HEAD' : repo.head.branch}${headBefore ? '' : ' (root-commit)'} ${short(id)}] ${(msg || prevMsg || '').split('\n')[0]}`);
      if (stat.length) w(ctx, ` ${stat.length} file${stat.length === 1 ? '' : 's'} changed`);
      for (const s of stat.filter((x) => x.kind !== 'modified')) w(ctx, ` ${s.kind === 'new file' ? 'create' : 'delete'} mode 100644 ${s.path}`);
      onChange?.();
      return 0;
    },

    async log(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const { flags, positional } = parseArgs(args, { string: ['n', 'max-count'] });
      const repo = store.repo(root);
      const start = await store.resolveRev(repo, positional[0] || 'HEAD');
      if (!start) { e(ctx, `fatal: your current branch '${repo.head.branch}' does not have any commits yet`); return 128; }
      const n = Number(flags.n || flags['max-count'] || (args.find((a) => /^-\d+$/.test(a)) || '').slice(1) || 1000);
      const list = await store.log(repo, start, n);
      const labels = new Map();
      for (const [b, id] of Object.entries(repo.branches)) if (id) labels.set(id, [...(labels.get(id) || []), b === repo.head.branch && !repo.head.detached ? `${color('bcyan', 'HEAD ->')} ${color('bgreen', b)}` : color('bgreen', b)]);
      for (const [t, id] of Object.entries(repo.tags || {})) labels.set(id, [...(labels.get(id) || []), color('byellow', `tag: ${t}`)]);
      for (const [key, s] of Object.entries(repo.synced || {})) if (s.local) labels.set(s.local, [...(labels.get(s.local) || []), color('bred', key)]);
      const deco = (id) => (labels.has(id) ? ` ${color('yellow', '(')}${labels.get(id).join(color('yellow', ', '))}${color('yellow', ')')}` : '');
      for (const c of list) {
        if (flags.oneline) { w(ctx, `${color('yellow', short(c.id))}${deco(c.id)} ${c.message.split('\n')[0]}`); continue; }
        w(ctx, `${color('yellow', `commit ${c.id}`)}${deco(c.id)}`);
        if (c.parents?.length > 1) w(ctx, `Merge: ${c.parents.map(short).join(' ')}`);
        w(ctx, `Author: ${c.author?.name} <${c.author?.email}>`);
        w(ctx, `Date:   ${fmtDate(c.date)}`);
        w(ctx, `\n${c.message.split('\n').map((l) => `    ${l}`).join('\n')}\n`);
      }
      return 0;
    },

    async diff(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const { flags, positional } = parseArgs(args);
      const repo = store.repo(root);
      const staged = flags.staged || flags.cached;
      const abs = (p) => normalize(root ? `${root}/${p}` : p);
      const revs = [];
      while (positional.length && !store.vfs.exists(shell.resolve(positional[0]))) {
        const id = await store.resolveRev(repo, positional[0]);
        if (id === undefined || id === null) break;
        revs.push(id);
        positional.shift();
      }
      let a; let b; let bIsWorking = false;
      if (revs.length >= 2) { a = await store.commitTree(revs[0]); b = await store.commitTree(revs[1]); }
      else if (revs.length === 1) { a = await store.commitTree(revs[0]); b = await store.workingHashes(root); bIsWorking = true; }
      else if (staged) { a = await store.commitTree(store.headCommitId(repo)); b = { ...repo.index }; }
      else {
        a = { ...repo.index };
        b = await store.workingHashes(root);
        bIsWorking = true;
        for (const k of Object.keys(b)) if (!(k in a)) delete b[k];
      }
      const filter = positional.map((p) => relToRepo(root, p));
      const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]).filter((p) => !filter.length || filter.some((f) => p === f || p.startsWith(`${f}/`))).sort();
      let out = '';
      for (const p of paths) {
        if (flags['name-only']) { out += `${p}\n`; continue; }
        if (isBinaryPath(p)) { out += `diff --git a/${p} b/${p}\nBinary files differ\n`; continue; }
        const before = a[p] ? toText(await store.getObject(a[p])) : '';
        const after = !b[p] ? '' : bIsWorking ? toText(store.vfs.readRaw(abs(p))) : toText(await store.getObject(b[p]));
        const d = unifiedDiff(before, after, a[p] ? `a/${p}` : '/dev/null', b[p] ? `b/${p}` : '/dev/null');
        out += `${color('bold', `diff --git a/${p} b/${p}`)}\n${d}`;
      }
      if (flags.stat) { for (const p of paths) w(ctx, ` ${p}`); w(ctx, ` ${paths.length} file${paths.length === 1 ? '' : 's'} changed`); return 0; }
      ctx.stdout.write(ctx.piped ? out.replace(/\x1b\[[0-9;]*m/g, '') : colorizeDiff(out));
      return 0;
    },

    async show(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const rev = args.find((x) => !x.startsWith('-')) || 'HEAD';
      if (rev.includes(':')) {
        const [r, file] = rev.split(':');
        const tree = await store.commitTree(await store.resolveRev(repo, r || 'HEAD'));
        if (!tree[file]) { e(ctx, `fatal: path '${file}' does not exist in '${r || 'HEAD'}'`); return 128; }
        ctx.stdout.write(toText(await store.getObject(tree[file])));
        return 0;
      }
      const id = await store.resolveRev(repo, rev);
      if (!id) { e(ctx, `fatal: bad revision '${rev}'`); return 128; }
      const c = await store.getObject(id);
      w(ctx, color('yellow', `commit ${id}`));
      w(ctx, `Author: ${c.author?.name} <${c.author?.email}>\nDate:   ${fmtDate(c.date)}\n\n${c.message.split('\n').map((l) => `    ${l}`).join('\n')}\n`);
      const parentTree = await store.commitTree(c.parents?.[0]);
      let out = '';
      for (const p of [...new Set([...Object.keys(parentTree), ...Object.keys(c.tree)])].sort()) {
        if (parentTree[p] === c.tree[p]) continue;
        const before = parentTree[p] ? toText(await store.getObject(parentTree[p])) : '';
        const after = c.tree[p] ? toText(await store.getObject(c.tree[p])) : '';
        out += `${color('bold', `diff --git a/${p} b/${p}`)}\n${unifiedDiff(before, after, parentTree[p] ? `a/${p}` : '/dev/null', c.tree[p] ? `b/${p}` : '/dev/null')}`;
      }
      ctx.stdout.write(colorizeDiff(out));
      return 0;
    },

    async branch(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const { flags, positional } = parseArgs(args, { alias: { delete: 'd', move: 'm' } });
      if (flags.d || flags.D) {
        for (const b of positional) {
          if (!(b in repo.branches)) { e(ctx, `error: branch '${b}' not found.`); return 1; }
          if (b === repo.head.branch && !repo.head.detached) { e(ctx, `error: Cannot delete branch '${b}' checked out`); return 1; }
          if (!flags.D && !(await store.isAncestor(repo.branches[b], store.headCommitId(repo)))) { e(ctx, `error: The branch '${b}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${b}'.`); return 1; }
          w(ctx, `Deleted branch ${b} (was ${short(repo.branches[b])}).`);
          delete repo.branches[b];
        }
        await store.saveMeta();
        return 0;
      }
      if (flags.m && positional.length) {
        const [from, to] = positional.length === 2 ? positional : [repo.head.branch, positional[0]];
        if (!(from in repo.branches)) { e(ctx, `error: branch '${from}' not found`); return 1; }
        repo.branches[to] = repo.branches[from];
        delete repo.branches[from];
        if (repo.head.branch === from) repo.head.branch = to;
        await store.saveMeta();
        onChange?.();
        return 0;
      }
      if (positional.length) {
        const name = positional[0];
        if (!/^[\w./-]+$/.test(name) || name.includes('..')) { e(ctx, `fatal: '${name}' is not a valid branch name`); return 128; }
        if (name in repo.branches) { e(ctx, `fatal: a branch named '${name}' already exists`); return 128; }
        const at = await store.resolveRev(repo, positional[1] || 'HEAD');
        if (!at) { e(ctx, `fatal: Not a valid object name: '${positional[1] || repo.head.branch}'.`); return 128; }
        repo.branches[name] = at;
        await store.saveMeta();
        return 0;
      }
      for (const b of Object.keys(repo.branches).sort()) {
        const cur = b === repo.head.branch && !repo.head.detached;
        w(ctx, cur ? `* ${color('green', b)}` : `  ${b}`);
      }
      if (repo.head.detached) w(ctx, `* ${color('green', `(HEAD detached at ${short(repo.head.detached)})`)}`);
      return 0;
    },

    async checkout(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const { flags, positional } = parseArgs(args, { string: ['b', 'B', 'c', 'C'], alias: { force: 'f' } });
      const dashdash = args.indexOf('--');
      if (dashdash !== -1 || (positional.length && positional.every((p) => store.vfs.exists(shell.resolve(p))) && !(positional[0] in repo.branches))) {
        // restore files from index (or given commit)
        const files = dashdash !== -1 ? args.slice(dashdash + 1) : positional;
        const from = dashdash > 0 && !args[0].startsWith('-') ? await store.resolveRev(repo, args[0]) : null;
        const source = from ? await store.commitTree(from) : repo.index;
        for (const f of files) {
          const rel = relToRepo(root, f);
          const hits = Object.keys(source).filter((k) => k === rel || k.startsWith(`${rel}/`));
          if (!hits.length) { e(ctx, `error: pathspec '${f}' did not match any file(s) known to git`); return 1; }
          for (const h of hits) store.vfs.writeFile(normalize(root ? `${root}/${h}` : h), await store.getObject(source[h]));
        }
        onChange?.();
        return 0;
      }
      const newBranch = flags.b || flags.B || flags.c || flags.C;
      const target = newBranch ? (positional[0] || 'HEAD') : positional[0];
      if (!target) { e(ctx, 'usage: git checkout <branch> | git checkout -b <new-branch> | git checkout -- <file>'); return 1; }
      const targetId = await store.resolveRev(repo, target);
      if (targetId === undefined && !newBranch) { e(ctx, `error: pathspec '${target}' did not match any file(s) known to git`); return 1; }
      if (newBranch && newBranch in repo.branches && !(flags.B || flags.C)) { e(ctx, `fatal: a branch named '${newBranch}' already exists`); return 128; }
      const currentId = store.headCommitId(repo);
      if (targetId !== currentId && !flags.f) {
        // Refuse when local changes would be overwritten.
        const st = await store.status(root);
        const targetTree = await store.commitTree(targetId);
        const curTree = await store.commitTree(currentId);
        const clobbered = [...st.staged, ...st.unstaged].map((s) => s.path).filter((p) => targetTree[p] !== curTree[p]);
        if (clobbered.length) {
          e(ctx, `error: Your local changes to the following files would be overwritten by checkout:\n${clobbered.map((p) => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you switch branches.\nAborting`);
          return 1;
        }
      }
      const prevTree = await store.commitTree(currentId);
      const nextTree = await store.commitTree(targetId);
      if (targetId !== currentId) {
        await store.writeTree(root, nextTree, { previous: prevTree });
        // keep uncommitted (compatible) index entries, otherwise reset to target tree
        repo.index = { ...nextTree };
      }
      if (newBranch) {
        repo.branches[newBranch] = targetId;
        repo.head = { branch: newBranch };
        w(ctx, `Switched to a new branch '${newBranch}'`);
      } else if (target in repo.branches) {
        repo.head = { branch: target };
        w(ctx, `Switched to branch '${target}'`);
      } else {
        repo.head = { branch: repo.head.branch, detached: targetId };
        w(ctx, `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state. You can look around and make experimental\nchanges and commit them; create a branch to keep them: git switch -c <name>\n\nHEAD is now at ${short(targetId)}`);
      }
      await store.saveMeta();
      onChange?.();
      return 0;
    },

    async switch(ctx, args) {
      const { flags, positional } = parseArgs(args, { string: ['c', 'C'] });
      if (flags.c || flags.C) return sub.checkout(ctx, ['-b', flags.c || flags.C, ...positional]);
      const root = requireRepo(ctx); if (root === null) return 128;
      if (positional[0] && !(positional[0] in store.repo(root).branches) && positional[0] !== '-') { e(ctx, `fatal: invalid reference: ${positional[0]}`); return 128; }
      return sub.checkout(ctx, positional);
    },

    async restore(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const { flags, positional } = parseArgs(args, { string: ['source', 's'] });
      if (!positional.length) { e(ctx, 'fatal: you must specify path(s) to restore'); return 128; }
      const headTree = await store.commitTree(store.headCommitId(repo));
      for (const f of positional) {
        const rel = relToRepo(root, f);
        const matchKeys = (obj) => Object.keys(obj).filter((k) => !rel || k === rel || k.startsWith(`${rel}/`));
        if (flags.staged) {
          const keys = new Set([...matchKeys(repo.index), ...matchKeys(headTree)]);
          for (const k of keys) { if (headTree[k]) repo.index[k] = headTree[k]; else delete repo.index[k]; }
        } else {
          const src = flags.source || flags.s ? await store.commitTree(await store.resolveRev(repo, flags.source || flags.s)) : repo.index;
          const keys = matchKeys(src);
          if (!keys.length) { e(ctx, `error: pathspec '${f}' did not match any file(s) known to git`); return 1; }
          for (const k of keys) store.vfs.writeFile(normalize(root ? `${root}/${k}` : k), await store.getObject(src[k]));
        }
      }
      await store.saveMeta();
      onChange?.();
      return 0;
    },

    async reset(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const { flags, positional } = parseArgs(args);
      let target = 'HEAD';
      if (positional.length && (await store.resolveRev(repo, positional[0])) !== undefined && !store.vfs.exists(shell.resolve(positional[0]))) target = positional[0];
      const files = positional.filter((p) => p !== target);
      if (files.length) return sub.restore(ctx, ['--staged', ...files]);
      const id = await store.resolveRev(repo, target || 'HEAD');
      if (id === undefined) { e(ctx, `fatal: ambiguous argument '${target}': unknown revision`); return 128; }
      const prev = await store.commitTree(store.headCommitId(repo));
      const tree = await store.commitTree(id);
      if (repo.head.detached) repo.head.detached = id; else repo.branches[repo.head.branch] = id;
      if (!flags.soft) repo.index = { ...tree };
      if (flags.hard) {
        const work = await store.workingHashes(root);
        const merged = { ...prev };
        for (const k of Object.keys(work)) if (k in prev || k in tree) merged[k] = work[k];
        await store.writeTree(root, tree, { previous: merged });
        w(ctx, `HEAD is now at ${short(id)} ${(await store.getObject(id))?.message.split('\n')[0] || ''}`);
      } else if (!flags.soft) {
        const st = await store.status(root);
        if (st.unstaged.length) w(ctx, `Unstaged changes after reset:\n${st.unstaged.map((s) => `${s.kind === 'deleted' ? 'D' : 'M'}\t${s.path}`).join('\n')}`);
      }
      delete repo.merging;
      await store.saveMeta();
      onChange?.();
      return 0;
    },

    async merge(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      if (args[0] === '--abort') {
        if (!repo.merging) { e(ctx, 'fatal: There is no merge to abort (MERGE_HEAD missing).'); return 128; }
        return sub.reset(ctx, ['--hard', 'HEAD']);
      }
      const name = args.find((a) => !a.startsWith('-'));
      const theirs = await store.resolveRev(repo, name);
      if (!theirs) { e(ctx, `merge: ${name} - not something we can merge`); return 1; }
      const ours = store.headCommitId(repo);
      if (await hasUncommitted(root)) { e(ctx, 'error: Your local changes would be overwritten by merge. Commit or stash them first.'); return 1; }
      if (await store.isAncestor(theirs, ours)) { w(ctx, 'Already up to date.'); return 0; }
      if (!ours || (await store.isAncestor(ours, theirs))) {
        await store.writeTree(root, await store.commitTree(theirs), { previous: await store.commitTree(ours) });
        repo.index = { ...(await store.commitTree(theirs)) };
        if (repo.head.detached) repo.head.detached = theirs; else repo.branches[repo.head.branch] = theirs;
        await store.saveMeta();
        w(ctx, `Updating ${short(ours)}..${short(theirs)}\nFast-forward`);
        onChange?.();
        return 0;
      }
      const base = await store.mergeBase(ours, theirs);
      const res = await store.threeWay(await store.commitTree(base), await store.commitTree(ours), await store.commitTree(theirs));
      await store.storeObjects(res.blobs);
      await store.writeTree(root, res.tree, { previous: await store.commitTree(ours) });
      repo.index = { ...res.tree };
      if (res.conflicts.length) {
        repo.merging = { theirs, conflicts: res.conflicts };
        for (const c of res.conflicts) w(ctx, `CONFLICT (content): Merge conflict in ${c}`);
        w(ctx, 'Automatic merge failed; fix conflicts and then commit the result.');
        await store.saveMeta();
        onChange?.();
        return 1;
      }
      await store.commit(root, `Merge branch '${name}' into ${repo.head.branch}`, { author: author(), parentsOverride: [ours, theirs] });
      w(ctx, "Merge made by the 'ort' strategy.");
      onChange?.();
      return 0;
    },

    async stash(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      repo.stash = repo.stash || [];
      const action = args[0] && !args[0].startsWith('-') ? args[0] : 'push';
      if (action === 'list') { repo.stash.forEach((s, i) => w(ctx, `stash@{${i}}: On ${s.branch}: ${s.message}`)); return 0; }
      if (action === 'push' || action === 'save') {
        const st = await store.status(root);
        if (!st.staged.length && !st.unstaged.length) { w(ctx, 'No local changes to save'); return 0; }
        const work = await store.workingHashes(root);
        const blobs = {};
        const tracked = {};
        for (const [rel, h] of Object.entries(work)) if (rel in repo.index || rel in st.headTree) { tracked[rel] = h; blobs[h] = store.vfs.readRaw(normalize(root ? `${root}/${rel}` : rel)); }
        await store.storeObjects(blobs);
        const mIdx = args.indexOf('-m');
        const message = mIdx !== -1 ? args[mIdx + 1] : `WIP on ${repo.head.branch}`;
        repo.stash.unshift({ tree: tracked, index: { ...repo.index }, branch: repo.head.branch, message, base: store.headCommitId(repo) });
        await store.writeTree(root, st.headTree, { previous: tracked });
        repo.index = { ...st.headTree };
        await store.saveMeta();
        w(ctx, `Saved working directory and index state ${message}`);
        onChange?.();
        return 0;
      }
      if (action === 'pop' || action === 'apply') {
        const s = repo.stash[0];
        if (!s) { e(ctx, 'No stash entries found.'); return 1; }
        const headTree = await store.commitTree(store.headCommitId(repo));
        const res = await store.threeWay(await store.commitTree(s.base), headTree, s.tree);
        await store.storeObjects(res.blobs);
        await store.writeTree(root, res.tree, { previous: headTree });
        if (res.conflicts.length) { for (const c of res.conflicts) w(ctx, `CONFLICT (content): Merge conflict in ${c}`); }
        if (action === 'pop' && !res.conflicts.length) { repo.stash.shift(); w(ctx, 'Dropped refs/stash@{0}'); }
        await store.saveMeta();
        onChange?.();
        return res.conflicts.length ? 1 : 0;
      }
      if (action === 'drop') { repo.stash.shift(); await store.saveMeta(); w(ctx, 'Dropped refs/stash@{0}'); return 0; }
      if (action === 'clear') { repo.stash = []; await store.saveMeta(); return 0; }
      e(ctx, `error: unknown stash subcommand '${action}'`);
      return 1;
    },

    async tag(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      repo.tags = repo.tags || {};
      const { flags, positional } = parseArgs(args);
      if (flags.d) { for (const t of positional) delete repo.tags[t]; await store.saveMeta(); return 0; }
      if (!positional.length) { for (const t of Object.keys(repo.tags).sort()) w(ctx, t); return 0; }
      const id = await store.resolveRev(repo, positional[1] || 'HEAD');
      if (!id) { e(ctx, 'fatal: Failed to resolve HEAD as a valid ref.'); return 128; }
      repo.tags[positional[0]] = id;
      await store.saveMeta();
      return 0;
    },

    async remote(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const action = args[0];
      if (!action || action === '-v') {
        for (const [n, u] of Object.entries(repo.remotes)) { if (action === '-v') { w(ctx, `${n}\t${u} (fetch)`); w(ctx, `${n}\t${u} (push)`); } else w(ctx, n); }
        return 0;
      }
      if (action === 'add') {
        const [, name, url] = args;
        if (!name || !url) { e(ctx, 'usage: git remote add <name> <url>'); return 129; }
        if (repo.remotes[name]) { e(ctx, `error: remote ${name} already exists.`); return 3; }
        repo.remotes[name] = url;
        if (!parseGitHubUrl(url)) w(ctx, color('yellow', 'warning: only GitHub remotes (https://github.com/<owner>/<repo>.git) can be pushed to from the playground.'));
      } else if (action === 'remove' || action === 'rm') {
        if (!repo.remotes[args[1]]) { e(ctx, `error: No such remote: '${args[1]}'`); return 2; }
        delete repo.remotes[args[1]];
      } else if (action === 'set-url') {
        repo.remotes[args[1]] = args[2];
      } else if (action === 'get-url') {
        if (!repo.remotes[args[1]]) { e(ctx, `error: No such remote '${args[1]}'`); return 2; }
        w(ctx, repo.remotes[args[1]]);
        return 0;
      } else if (action === 'rename') {
        repo.remotes[args[2]] = repo.remotes[args[1]]; delete repo.remotes[args[1]];
      } else { e(ctx, `error: Unknown subcommand: ${action}`); return 129; }
      await store.saveMeta();
      return 0;
    },

    async config(ctx, args) {
      const { flags, positional } = parseArgs(args);
      const root = store.findRoot(shell.cwd);
      const global = flags.global || root === null;
      const target = global ? (store.meta.globalConfig = store.meta.globalConfig || {}) : store.repo(root).config;
      if (flags.list || flags.l) {
        for (const [k, v] of Object.entries({ ...(store.meta.globalConfig || {}), ...(root !== null ? store.repo(root).config : {}) })) w(ctx, `${k}=${v}`);
        return 0;
      }
      const [key, ...rest] = positional;
      if (!key) { e(ctx, 'usage: git config [--global] <name> [<value>]'); return 129; }
      if (key === 'github.token' || key === 'credential.token') {
        if (rest.length) { setGitHubToken(rest.join(' ')); w(ctx, 'GitHub token saved in this browser.'); } else w(ctx, getGitHubToken() ? '(set)' : '');
        return 0;
      }
      if (!rest.length) {
        const v = (root !== null ? store.repo(root).config[key] : undefined) ?? store.meta.globalConfig?.[key];
        if (v === undefined) return 1;
        w(ctx, v);
        return 0;
      }
      target[key] = rest.join(' ');
      await store.saveMeta();
      return 0;
    },

    /* ---------- GitHub ---------- */

    async push(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const { flags, positional } = parseArgs(args, { alias: { 'set-upstream': 'u', force: 'f' } });
      const branch = positional[1] || repo.head.branch;
      const remoteName = positional[0] || repo.upstream?.[branch]?.remote || (repo.remotes.origin ? 'origin' : Object.keys(repo.remotes)[0]);
      if (!remoteName || !repo.remotes[remoteName]) {
        e(ctx, 'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add origin https://github.com/<you>/<repo>.git\n\nand then push using the remote name\n\n    git push -u origin main');
        return 128;
      }
      const gh = parseGitHubUrl(repo.remotes[remoteName]);
      if (!gh) { e(ctx, `fatal: '${repo.remotes[remoteName]}' is not a GitHub repository URL. The playground can push to GitHub only.`); return 128; }
      const localId = repo.branches[branch];
      if (!localId) { e(ctx, `error: src refspec ${branch} does not match any\nerror: failed to push some refs to '${repo.remotes[remoteName]}'\nhint: make a commit first (git add . && git commit -m "message")`); return 1; }
      const token = await ensureToken(ctx);
      if (!token) return 1;
      const key = `${remoteName}/${branch}`;
      repo.synced = repo.synced || {};
      try {
        await pushToGitHub({ ctx, store, repo, root, gh, branch, localId, token, force: Boolean(flags.f), key, prompt });
      } catch (err) {
        e(ctx, `${color('red', 'error:')} ${err.message}`);
        if (err.status === 404) e(ctx, 'hint: check the repository name, and that your token can access it.');
        return 1;
      }
      if (flags.u || !repo.upstream?.[branch]) {
        repo.upstream = repo.upstream || {};
        repo.upstream[branch] = { remote: remoteName, branch };
        if (flags.u) w(ctx, `branch '${branch}' set up to track '${remoteName}/${branch}'.`);
      }
      await store.saveMeta();
      onChange?.();
      return 0;
    },

    async clone(ctx, args) {
      const { flags, positional } = parseArgs(args, { string: ['b', 'branch', 'depth'] });
      const url = positional[0];
      const gh = parseGitHubUrl(url);
      if (!gh) { e(ctx, `fatal: repository '${url || ''}' not supported — the playground clones GitHub repositories (https://github.com/<owner>/<repo>).`); return 128; }
      const dir = positional[1] !== undefined ? shell.resolve(positional[1]) : shell.resolve(gh.repo);
      if (store.vfs.exists(dir) && (store.vfs.isFile(dir) || store.vfs.readdir(dir).length)) { e(ctx, `fatal: destination path '${positional[1] || gh.repo}' already exists and is not an empty directory.`); return 128; }
      w(ctx, `Cloning into '${positional[1] || gh.repo}'...`);
      try {
        const res = await cloneFromGitHub({ ctx, store, gh, dir, branch: flags.b || flags.branch, token: getGitHubToken() });
        w(ctx, `Receiving objects: 100% (${res.files}/${res.files}), done.`);
        if (res.skipped) w(ctx, color('yellow', `note: ${res.skipped} large or binary file(s) over 5 MB were skipped.`));
      } catch (err) {
        e(ctx, `fatal: ${err.message}`);
        if (err.status === 403) e(ctx, 'hint: GitHub limits anonymous API use to 60 requests an hour. Save a token with: git config --global github.token <token>');
        return 128;
      }
      onChange?.();
      return 0;
    },

    async pull(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const branch = args[1] || repo.head.branch;
      const remoteName = args[0] || repo.upstream?.[branch]?.remote || 'origin';
      const gh = parseGitHubUrl(repo.remotes[remoteName]);
      if (!gh) { e(ctx, `fatal: '${remoteName}' does not appear to be a GitHub repository`); return 128; }
      if (await hasUncommitted(root)) { e(ctx, 'error: You have local changes. Commit or stash them before pulling.'); return 1; }
      try {
        return await pullFromGitHub({ ctx, store, repo, root, gh, branch, key: `${remoteName}/${branch}`, token: getGitHubToken(), author: author(), onChange });
      } catch (err) {
        e(ctx, `fatal: ${err.message}`);
        return 1;
      }
    },

    async fetch(ctx, args) {
      const root = requireRepo(ctx); if (root === null) return 128;
      const repo = store.repo(root);
      const remoteName = args[0] || 'origin';
      const gh = parseGitHubUrl(repo.remotes[remoteName]);
      if (!gh) { e(ctx, `fatal: '${remoteName}' does not appear to be a GitHub repository`); return 128; }
      const branch = repo.head.branch;
      try {
        const ref = await gh_getRef(gh, branch, getGitHubToken());
        const synced = repo.synced?.[`${remoteName}/${branch}`];
        if (!ref) w(ctx, `The remote has no branch '${branch}' yet.`);
        else if (synced?.remote === ref) w(ctx, 'Already up to date with the remote.');
        else w(ctx, `From github.com:${gh.owner}/${gh.repo}\n   ${short(synced?.remote)}..${short(ref)}  ${branch} -> ${remoteName}/${branch}\nRun "git pull" to bring these changes in.`);
      } catch (err) { e(ctx, `fatal: ${err.message}`); return 1; }
      return 0;
    },
  };

  const aliases = { co: 'checkout', br: 'branch', ci: 'commit', st: 'status' };

  async function ensureToken(ctx) {
    let token = getGitHubToken();
    if (token) return token;
    w(ctx, 'To push to GitHub, the playground needs a personal access token with access to this repository.');
    w(ctx, `Create one at ${color('bcyan', 'https://github.com/settings/tokens?type=beta')} (Contents: read & write), then paste it here.`);
    w(ctx, color('gray', 'The token is stored only in this browser. Remove it any time with: git config --global github.token ""'));
    token = (await (prompt ? prompt(ctx, 'GitHub token: ', { secret: true }) : null) || '').trim();
    if (!token) { ctx.stderr.write('Push cancelled (no token).\n'); return null; }
    setGitHubToken(token);
    return token;
  }

  shell.register('git', async (ctx) => {
    const [cmd, ...rest] = ctx.args;
    if (!cmd || cmd === 'help' || cmd === '--help') {
      w(ctx, 'usage: git <command> [<args>]\n');
      w(ctx, 'start a working area      init, clone');
      w(ctx, 'work on the current change add, rm, restore, reset, stash');
      w(ctx, 'examine history and state status, log, diff, show');
      w(ctx, 'grow and tweak history    commit, branch, checkout, switch, merge, tag');
      w(ctx, 'collaborate (GitHub)      remote, push, pull, fetch');
      return 0;
    }
    if (cmd === '--version' || cmd === 'version') { w(ctx, 'git version 2.46.0 (Toolbox playground)'); return 0; }
    const fn = sub[aliases[cmd] || cmd];
    if (!fn) { e(ctx, `git: '${cmd}' is not a git command. See 'git --help'.`); return 1; }
    return fn(ctx, rest);
  }, { usage: 'git <command>', desc: 'Version control; push, pull and clone GitHub repositories', group: 'Developer tools' });
}

/* ---------------- GitHub transport ---------------- */

async function gh_getRef(target, branch, token) {
  try {
    const r = await gh(`/repos/${target.owner}/${target.repo}/git/ref/heads/${encodeURIComponent(branch)}`, { token });
    return r?.object?.sha || null;
  } catch (err) {
    if (err.status === 404 || err.status === 409) return null;
    throw err;
  }
}

async function pushToGitHub({ ctx, store, repo, root, gh: target, branch, localId, token, force, key, prompt }) {
  const w = (s) => ctx.stdout.write(`${s}\n`);
  const api = (path, o = {}) => gh(`/repos/${target.owner}/${target.repo}${path}`, { token, ...o });
  // Repository must exist (offer to create it)
  let info;
  try { info = await api(''); } catch (err) {
    if (err.status !== 404) throw err;
    const answer = prompt ? await prompt(ctx, `Repository ${target.owner}/${target.repo} was not found. Create it as a private repository? [y/N] `) : 'n';
    if (!/^y/i.test(String(answer || '').trim())) throw Object.assign(new Error('Repository not found.'), { status: 404 });
    const me = await gh('/user', { token });
    const path = me.login.toLowerCase() === target.owner.toLowerCase() ? '/user/repos' : `/orgs/${target.owner}/repos`;
    info = await gh(path, { token, method: 'POST', body: { name: target.repo, private: true, auto_init: false } });
    w(`Created repository ${info.full_name}`);
  }
  let remoteHead = await gh_getRef(target, branch, token);
  const synced = repo.synced[key];
  if (remoteHead && !force) {
    const known = synced && synced.remote === remoteHead;
    if (!known) {
      // Remote has commits we have never seen.
      throw new Error(`Updates were rejected because the remote contains work that you do not have locally.\nhint: run "git pull" first, or "git push --force" to overwrite the remote (careful!).`);
    }
  }
  // Commits to send: local commits after the last synced one, oldest first.
  const history = await store.log(repo, localId);
  const lastSyncedLocal = remoteHead && synced && synced.remote === remoteHead ? synced.local : null;
  let toSend = [];
  for (const c of history) { if (c.id === lastSyncedLocal) break; toSend.push(c); }
  toSend = toSend.reverse();
  if (!toSend.length) { w('Everything up-to-date'); return; }
  // Empty repositories reject the Git Data API until they have one commit.
  if (!remoteHead) {
    const empty = await isEmptyRepo(target, token);
    if (empty) {
      const init = await api('/contents/.toolbox-init', { method: 'PUT', body: { message: 'Initialize repository', content: btoa('init\n'), branch } }).catch(() => null);
      remoteHead = init?.commit?.sha || await gh_getRef(target, branch, token);
      force = true;
    } else {
      const def = info?.default_branch && info.default_branch !== branch ? await gh_getRef(target, info.default_branch, token) : null;
      remoteHead = def; // new branch starts from nothing; parent optional
      if (remoteHead) force = true;
    }
  }
  let remoteTreeShas = {};
  if (remoteHead) {
    const commit = await api(`/git/commits/${remoteHead}`);
    const tree = await api(`/git/trees/${commit.tree.sha}?recursive=1`);
    for (const t of tree.tree || []) if (t.type === 'blob') remoteTreeShas[t.path] = t.sha;
  }
  let parent = remoteHead;
  const total = toSend.length;
  let n = 0;
  for (const c of toSend) {
    n++;
    const entries = [];
    for (const [path, hash] of Object.entries(c.tree)) {
      if (remoteTreeShas[path] === hash) { entries.push({ path, mode: '100644', type: 'blob', sha: hash }); continue; }
      const content = await store.getObject(hash);
      const bytes = toBytes(content);
      const isText = typeof content === 'string';
      if (isText && bytes.length < 900000) entries.push({ path, mode: '100644', type: 'blob', content });
      else {
        const blob = await api('/git/blobs', { method: 'POST', body: { content: b64encode(bytes), encoding: 'base64' } });
        entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }
    const tree = await api('/git/trees', { method: 'POST', body: { tree: entries } });
    const commit = await api('/git/commits', {
      method: 'POST',
      body: {
        message: c.message,
        tree: tree.sha,
        parents: parent ? [parent] : [],
        author: { name: c.author?.name || 'Student', email: c.author?.email || 'student@toolbox.local', date: new Date(c.date).toISOString() },
      },
    });
    parent = commit.sha;
    // next commits can reuse unchanged blobs
    remoteTreeShas = {};
    const t2 = await api(`/git/trees/${tree.sha}?recursive=1`).catch(() => null);
    for (const t of t2?.tree || []) if (t.type === 'blob') remoteTreeShas[t.path] = t.sha;
    ctx.stdout.write(`\rWriting commits: ${Math.round((n / total) * 100)}% (${n}/${total})`);
  }
  ctx.stdout.write('\n');
  const existing = await gh_getRef(target, branch, token);
  if (existing) await api(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: { sha: parent, force: Boolean(force) } });
  else await api('/git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: parent } });
  repo.synced[key] = { local: localId, remote: parent };
  w(`To https://github.com/${target.owner}/${target.repo}.git`);
  w(`   ${(remoteHead || '0000000').slice(0, 7)}..${parent.slice(0, 7)}  ${branch} -> ${branch}`);
}

async function isEmptyRepo(target, token) {
  try {
    await gh(`/repos/${target.owner}/${target.repo}/commits?per_page=1`, { token });
    return false;
  } catch (err) {
    return err.status === 409;
  }
}

async function fetchTree(target, ref, token) {
  const commit = await gh(`/repos/${target.owner}/${target.repo}/commits/${encodeURIComponent(ref)}`, { token });
  const tree = await gh(`/repos/${target.owner}/${target.repo}/git/trees/${commit.commit.tree.sha}?recursive=1`, { token });
  return { sha: commit.sha, message: commit.commit.message, author: commit.commit.author, entries: (tree.tree || []).filter((t) => t.type === 'blob'), truncated: tree.truncated };
}

async function downloadBlob(target, sha, path, commitSha, token) {
  // raw.githubusercontent.com is not rate-limited and allows CORS.
  const res = await fetch(`https://raw.githubusercontent.com/${target.owner}/${target.repo}/${commitSha}/${path.split('/').map(encodeURIComponent).join('/')}`);
  if (res.ok) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf;
  }
  const blob = await gh(`/repos/${target.owner}/${target.repo}/git/blobs/${sha}`, { token });
  return b64decode(blob.content);
}

function decodeMaybeText(bytes, path) {
  if (isBinaryPath(path)) return bytes;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return bytes; }
}

async function cloneFromGitHub({ ctx, store, gh: target, dir, branch, token }) {
  const info = await gh(`/repos/${target.owner}/${target.repo}`, { token });
  const ref = branch || info.default_branch || 'main';
  const snap = await fetchTree(target, ref, token);
  const blobs = {};
  const tree = {};
  let files = 0;
  let skipped = 0;
  const queue = [...snap.entries];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      if (entry.size > 5 * 1024 * 1024) { skipped++; continue; }
      const bytes = await downloadBlob(target, entry.sha, entry.path, snap.sha, token);
      const content = decodeMaybeText(bytes, entry.path);
      const abs = normalize(dir ? `${dir}/${entry.path}` : entry.path);
      store.vfs.writeFile(abs, content);
      const h = await blobHash(content);
      blobs[h] = content;
      tree[entry.path] = h;
      files++;
      if (files % 10 === 0) ctx.stdout.write(`\rReceiving objects: ${Math.round((files / snap.entries.length) * 100)}% (${files}/${snap.entries.length})`);
    }
  });
  await Promise.all(workers);
  ctx.stdout.write('\r');
  await store.storeObjects(blobs);
  await store.init(dir, { branch: ref });
  const repo = store.repo(dir);
  repo.index = { ...tree };
  repo.remotes.origin = `https://github.com/${target.owner}/${target.repo}.git`;
  const { id } = await store.commit(dir, `${snap.message.split('\n')[0]}\n\n(cloned from github.com/${target.owner}/${target.repo} at ${snap.sha.slice(0, 7)})`, { author: { name: snap.author?.name || target.owner, email: snap.author?.email || '' } });
  repo.synced = { [`origin/${ref}`]: { local: id, remote: snap.sha } };
  repo.upstream = { [ref]: { remote: 'origin', branch: ref } };
  await store.saveMeta();
  return { files, skipped, sha: snap.sha };
}

async function pullFromGitHub({ ctx, store, repo, root, gh: target, branch, key, token, author, onChange }) {
  const w = (s) => ctx.stdout.write(`${s}\n`);
  const remoteHead = await gh_getRef(target, branch, token);
  if (!remoteHead) { w(`The remote has no branch '${branch}'.`); return 1; }
  repo.synced = repo.synced || {};
  const synced = repo.synced[key];
  if (synced?.remote === remoteHead) { w('Already up to date.'); return 0; }
  const snap = await fetchTree(target, remoteHead, token);
  const theirs = {};
  const blobs = {};
  for (const entry of snap.entries) {
    const bytes = await downloadBlob(target, entry.sha, entry.path, snap.sha, token);
    const content = decodeMaybeText(bytes, entry.path);
    const h = await blobHash(content);
    blobs[h] = content;
    theirs[entry.path] = h;
  }
  await store.storeObjects(blobs);
  const localId = store.headCommitId(repo);
  const ours = await store.commitTree(localId);
  const base = synced ? await store.commitTree(synced.local) : {};
  const res = await store.threeWay(base, ours, theirs);
  await store.storeObjects(res.blobs);
  await store.writeTree(root, res.tree, { previous: ours });
  repo.index = { ...res.tree };
  // Record the remote commit locally so history continues from it.
  const remoteCommit = { tree: theirs, parents: synced ? [synced.local] : [], message: snap.message, author: { name: snap.author?.name, email: snap.author?.email }, date: Date.parse(snap.author?.date) || Date.now() };
  const remoteLocalId = await objectHash(remoteCommit);
  await store.storeObjects({ [remoteLocalId]: remoteCommit });
  if (res.conflicts.length) {
    repo.merging = { theirs: remoteLocalId, conflicts: res.conflicts };
    repo.synced[key] = { local: remoteLocalId, remote: remoteHead };
    await store.saveMeta();
    for (const c of res.conflicts) w(`CONFLICT (content): Merge conflict in ${c}`);
    w('Automatic merge failed; fix conflicts and then commit the result.');
    onChange?.();
    return 1;
  }
  const oursChanged = localId && (!synced || localId !== synced.local);
  if (oursChanged) {
    await store.commit(root, `Merge branch '${branch}' of github.com:${target.owner}/${target.repo}`, { author, parentsOverride: [localId, remoteLocalId] });
    w('Merge made by the \'ort\' strategy.');
  } else {
    if (repo.head.detached) repo.head.detached = remoteLocalId; else repo.branches[repo.head.branch] = remoteLocalId;
    w(`Updating ${(localId || '').slice(0, 7)}..${remoteHead.slice(0, 7)}\nFast-forward`);
  }
  repo.synced[key] = { local: remoteLocalId, remote: remoteHead };
  await store.saveMeta();
  onChange?.();
  return 0;
}

export { relative, dirname };
