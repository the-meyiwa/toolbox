/* ============================================================
   POSIX-style path helpers for Code Playground workspaces.

   Workspace paths are always relative to the workspace root and use
   forward slashes ("src/app.js"). The root itself is "". Shell and
   runtime code can also pass absolute forms ("/src/app.js",
   "/workspace/src/app.js"); normalize() maps all of them to the same
   relative key so the file system has exactly one name per file.
   ============================================================ */

export const WORKSPACE_ROOT = '/workspace';

/** Collapse ".", "..", duplicate and trailing slashes. Never escapes the root. */
export function normalize(input = '') {
  let p = String(input ?? '').replace(/\\/g, '/').trim();
  if (p === WORKSPACE_ROOT || p.startsWith(`${WORKSPACE_ROOT}/`)) p = p.slice(WORKSPACE_ROOT.length);
  const out = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

/** Resolve `target` against a working directory (both workspace-relative). */
export function resolve(cwd = '', target = '') {
  const t = String(target ?? '').replace(/\\/g, '/');
  if (t === '~' || t.startsWith('~/')) return normalize(t.slice(1));
  if (t.startsWith('/')) return normalize(t);
  return normalize(`${cwd}/${t}`);
}

export function join(...parts) {
  return normalize(parts.filter((p) => p !== undefined && p !== null && p !== '').join('/'));
}

export function dirname(p = '') {
  const n = normalize(p);
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
}

export function basename(p = '', ext = '') {
  const n = normalize(p);
  const b = n.slice(n.lastIndexOf('/') + 1);
  return ext && b.endsWith(ext) && b !== ext ? b.slice(0, -ext.length) : b;
}

/** ".js" for "src/app.js", "" for "Makefile" and ".gitignore". */
export function extname(p = '') {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i);
}

/** Path of `to` relative to directory `from`. */
export function relative(from = '', to = '') {
  const a = normalize(from).split('/').filter(Boolean);
  const b = normalize(to).split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/') || '.';
}

/** Display form used by the shell: "/workspace/src". */
export function toDisplay(p = '') {
  const n = normalize(p);
  return n ? `${WORKSPACE_ROOT}/${n}` : WORKSPACE_ROOT;
}

/** True when `child` is `parent` or inside it. */
export function isInside(parent = '', child = '') {
  const a = normalize(parent);
  const b = normalize(child);
  return !a || a === b || b.startsWith(`${a}/`);
}

/** Minimal glob → RegExp: supports **, *, ?, {a,b} and character classes. */
export function globToRegExp(glob = '') {
  let re = '';
  const g = String(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end === -1) { re += '\\{'; continue; }
      re += `(?:${g.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|')})`;
      i = end;
    } else if (c === '[') {
      const end = g.indexOf(']', i);
      if (end === -1) { re += '\\['; continue; }
      re += g.slice(i, end + 1).replace(/^\[!/, '[^');
      i = end;
    } else re += c.replace(/[.+^$()|\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Split "a/b/c" into ["a", "a/b", "a/b/c"]. */
export function ancestors(p = '') {
  const parts = normalize(p).split('/').filter(Boolean);
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
