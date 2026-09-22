/* ============================================================
   Code Playground — tool entry.

   Landing page (start from a template, reopen / rename / duplicate /
   download / delete workspaces, import a ZIP, a folder, a GitHub repo
   or a project saved in Toolbox Files) and the IDE itself
   (js/lib/playground/ide.js).

   Workspaces are stored in IndexedDB (js/lib/playground/store.js) and
   autosaved as you type. The IDE has its own Light / Dark mode that
   doesn't follow the Toolbox theme.
   ============================================================ */

import { tbConfirm, tbPrompt, tbAlert } from '../lib/dialog.js';
import { getCurrentUser, onAuthChange } from '../lib/supabase.js';
import { PlaygroundIDE } from '../lib/playground/ide.js';
import {
  listWorkspaces, getWorkspace, putWorkspace, loadFiles, replaceFiles, deleteWorkspace,
  getActiveWorkspaceId, setActiveWorkspaceId, newId,
} from '../lib/playground/store.js';
import { TEMPLATES, TEMPLATE_ORDER, instantiateTemplate } from '../lib/playground/templates.js';
import { normalize } from '../lib/playground/paths.js';
import { langInfo, languageOf, isBinaryPath } from '../lib/playground/languages.js';
import { toBytes } from '../lib/playground/vfs.js';
import { createZip, extractZip } from '../lib/archive-engine.js';

const MODE_KEY = 'toolbox_cpg_theme_mode_v1';

export function getPlaygroundMode() {
  try { return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function setPlaygroundMode(mode) {
  const valid = mode === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(MODE_KEY, valid); } catch { return 'dark'; }
  return valid;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TEMPLATE_BADGE = {
  file: ['MD', '#8a8f98'], globe: ['WEB', '#e34c26'], react: ['JSX', '#149eca'], js: ['JS', '#d4b300'], vue: ['VUE', '#41b883'],
  node: ['NODE', '#539e43'], server: ['API', '#6d5dfc'], python: ['PY', '#3572a5'], chart: ['DATA', '#e07a1f'], cpp: ['C++', '#f34b7d'],
  c: ['C', '#555d6b'], java: ['JAVA', '#b07219'], database: ['SQL', '#336791'], ts: ['TS', '#3178c6'], game: ['GAME', '#c23b8a'], lua: ['LUA', '#5b6ee1'],
};

const DIALOGS = {
  prompt: (msg, def = '', opts = {}) => tbPrompt(msg, def, opts),
  confirm: (msg, opts = {}) => tbConfirm(msg, opts),
  alert: (msg, title) => tbAlert(msg, title),
};

function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return new Date(ms).toLocaleDateString();
}

function safeName(name) { return String(name || 'workspace').replace(/[<>:"|?*/\\]+/g, '-').trim() || 'workspace'; }

/** Drop a single top-level folder shared by every path ("project/src/a.js" → "src/a.js"). */
function stripCommonRoot(paths) {
  if (!paths.length) return (p) => p;
  const first = paths[0].split('/')[0];
  if (paths.every((p) => p.includes('/') && p.split('/')[0] === first)) return (p) => p.slice(first.length + 1);
  return (p) => p;
}

const IGNORED_IMPORT = /(^|\/)(node_modules|\.git|__pycache__|\.DS_Store|dist|build|\.next|\.venv|venv)(\/|$)/;

function hashWorkspace(id) {
  try {
    const h = window.location.hash || '';
    if (!h.startsWith('#code-playground')) return;
    const next = id ? `#code-playground?workspace=${encodeURIComponent(id)}` : '#code-playground';
    if (h !== next) history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${next}`);
  } catch { /* ignore */ }
}

export default {
  async render(container, { analytics, artifact } = {}) {
    this.container = container;
    this.analytics = analytics;
    this._alive = true;
    this._user = getCurrentUser();
    this._authUnsub?.();
    let first = true;
    this._authUnsub = onAuthChange((user) => {
      if (first) { first = false; return; }
      const was = Boolean(this._user);
      this._user = user;
      // The assistant is only for signed-in users: remount so it appears/disappears.
      if (was !== Boolean(user) && this.ide && this._alive) this.openWorkspace(this.ide.meta.id);
    });

    const m = (window.location.hash || '').match(/[?&]workspace=([\w-]+)/);
    if (m) setActiveWorkspaceId(m[1]);

    if (artifact) { await this.setArtifact(artifact); return; }
    const active = getActiveWorkspaceId();
    if (active && await getWorkspace(active).catch(() => null)) await this.openWorkspace(active);
    else await this.renderLanding();
  },

  /* ============================================================
     Landing
     ============================================================ */

  async renderLanding() {
    this.disposeIde();
    setActiveWorkspaceId(null);
    hashWorkspace(null);
    const mode = getPlaygroundMode();
    const container = this.container;
    let list = [];
    try { list = await listWorkspaces(); } catch (err) { console.warn('[playground] could not list workspaces', err); }
    if (!this._alive || this.ide) return;
    const signedIn = Boolean(getCurrentUser());
    const tplCards = TEMPLATE_ORDER.filter((k) => TEMPLATES[k]).map((k) => {
      const t = TEMPLATES[k];
      const [abbr, color] = TEMPLATE_BADGE[t.icon] || ['</>', '#6b7280'];
      return `<button type="button" class="cpg-tpl-card" data-template="${esc(k)}">
        <span class="cpg-tpl-badge" style="--c:${color}">${esc(abbr)}</span>
        <span class="cpg-tpl-text"><b>${esc(t.name)}</b><span>${esc(t.description || '')}</span></span>
      </button>`;
    }).join('');

    container.innerHTML = `
<div class="cpg-landing cpg-mode-${mode}" id="cpg-landing">
  <header class="cpg-landing-head">
    <div>
      <h1>Code Playground</h1>
      <p>A complete development environment in your browser: editor with IntelliSense, a real terminal (npm, git, node, python, g++, sqlite3…), live preview, tests, GitHub, and an AI coding agent. Your work saves automatically.</p>
    </div>
    <div class="cpg-landing-actions">
      <button type="button" class="cpg-btn" data-land="theme" title="Switch between light and dark">${mode === 'dark' ? '☀ Light' : '☾ Dark'}</button>
    </div>
  </header>

  <section class="cpg-landing-section">
    <div class="cpg-section-head"><h2>Start something new</h2>
      <div class="cpg-import-row">
        <button type="button" class="cpg-btn" data-land="import-zip">Import ZIP</button>
        <button type="button" class="cpg-btn" data-land="import-folder">Open folder</button>
        <button type="button" class="cpg-btn" data-land="clone">Clone from GitHub</button>
        <button type="button" class="cpg-btn" data-land="from-files">From Toolbox Files</button>
      </div>
    </div>
    <div class="cpg-tpl-grid">${tplCards}</div>
  </section>

  <section class="cpg-landing-section">
    <div class="cpg-section-head"><h2>Your workspaces <span class="cpg-dim">${list.length || ''}</span></h2>
      ${list.length > 4 ? '<input type="search" class="cpg-input cpg-ws-filter" id="cpg-ws-filter" placeholder="Filter workspaces" aria-label="Filter workspaces">' : ''}
    </div>
    <div class="cpg-ws-list" id="cpg-ws-list">
      ${list.length ? list.map((w) => this.workspaceCard(w)).join('') : '<div class="cpg-empty">No workspaces yet — pick a template above. Everything you create is saved in this browser.</div>'}
    </div>
    <p class="cpg-dim cpg-landing-foot">Workspaces are stored in this browser${signedIn ? '. Use File → Save to Toolbox Files to sync a copy to your account' : ''}. Download a ZIP to move a project to another computer or to VS Code.</p>
  </section>

  <input type="file" id="cpg-land-zip" accept=".zip,application/zip" hidden>
  <input type="file" id="cpg-land-folder" webkitdirectory multiple hidden>
</div>`;

    const root = container.querySelector('#cpg-landing');
    root.addEventListener('click', (e) => this.onLandingClick(e));
    root.querySelector('#cpg-ws-filter')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      root.querySelectorAll('.cpg-ws-card').forEach((c) => { c.hidden = q && !c.dataset.name.toLowerCase().includes(q); });
    });
    root.querySelector('#cpg-land-zip').addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) this.importZip(f); });
    root.querySelector('#cpg-land-folder').addEventListener('change', (e) => { const fl = [...(e.target.files || [])]; e.target.value = ''; if (fl.length) this.importFolder(fl); });
    root.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); root.classList.add('is-drop'); } });
    root.addEventListener('dragleave', (e) => { if (e.target === root) root.classList.remove('is-drop'); });
    root.addEventListener('drop', (e) => {
      root.classList.remove('is-drop');
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return;
      e.preventDefault();
      if (files.length === 1 && /\.zip$/i.test(files[0].name)) this.importZip(files[0]);
      else this.importFolder(files);
    });
  },

  workspaceCard(w) {
    const tpl = TEMPLATES[w.template];
    const [abbr, color] = TEMPLATE_BADGE[tpl?.icon] || (w.activePath ? [langInfo(languageOf(w.activePath)).abbr || '</>', langInfo(languageOf(w.activePath)).color || '#6b7280'] : ['</>', '#6b7280']);
    return `<div class="cpg-ws-card" data-id="${esc(w.id)}" data-name="${esc(w.name)}">
      <button type="button" class="cpg-ws-open" data-ws="open" title="Open ${esc(w.name)}">
        <span class="cpg-tpl-badge" style="--c:${color}">${esc(String(abbr).slice(0, 4))}</span>
        <span class="cpg-ws-text"><b>${esc(w.name)}</b><span class="cpg-dim">${esc(tpl?.name || (w.migratedFrom ? 'Imported from the old playground' : 'Workspace'))} · edited ${esc(timeAgo(w.updatedAt))}${w.git?.repos && Object.keys(w.git.repos).length ? ' · git' : ''}</span></span>
      </button>
      <span class="cpg-ws-actions">
        <button type="button" class="cpg-icon-btn" data-ws="rename" title="Rename">✎</button>
        <button type="button" class="cpg-icon-btn" data-ws="duplicate" title="Duplicate">⧉</button>
        <button type="button" class="cpg-icon-btn" data-ws="download" title="Download as ZIP">⤓</button>
        <button type="button" class="cpg-icon-btn cpg-danger-btn" data-ws="delete" title="Delete">🗑</button>
      </span>
    </div>`;
  },

  async onLandingClick(e) {
    const tpl = e.target.closest('[data-template]');
    if (tpl) { await this.createFromTemplate(tpl.dataset.template); return; }
    const land = e.target.closest('[data-land]')?.dataset.land;
    if (land === 'theme') { setPlaygroundMode(getPlaygroundMode() === 'dark' ? 'light' : 'dark'); this.renderLanding(); return; }
    if (land === 'import-zip') { this.container.querySelector('#cpg-land-zip').click(); return; }
    if (land === 'import-folder') { this.container.querySelector('#cpg-land-folder').click(); return; }
    if (land === 'clone') { await this.cloneRepo(); return; }
    if (land === 'from-files') { await this.importFromToolboxFiles(); return; }
    const act = e.target.closest('[data-ws]')?.dataset.ws;
    const card = e.target.closest('.cpg-ws-card');
    if (!act || !card) return;
    const id = card.dataset.id;
    const meta = await getWorkspace(id);
    if (!meta) { this.renderLanding(); return; }
    if (act === 'open') { await this.openWorkspace(id); return; }
    if (act === 'rename') {
      const name = await tbPrompt('Workspace name:', meta.name, { title: 'Rename workspace' });
      if (!name || !name.trim()) return;
      await putWorkspace({ ...meta, name: name.trim(), updatedAt: Date.now() });
      this.renderLanding();
      return;
    }
    if (act === 'duplicate') {
      const files = await loadFiles(id);
      const copy = { ...meta, id: newId(), name: `${meta.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now(), git: undefined };
      delete copy.git;
      await putWorkspace(copy);
      await replaceFiles(copy.id, files);
      this.renderLanding();
      return;
    }
    if (act === 'download') { await this.downloadWorkspace(meta); return; }
    if (act === 'delete') {
      const ok = await tbConfirm(`Delete “${meta.name}” and all of its files? This can't be undone.`, { title: 'Delete workspace', destructive: true, confirmText: 'Delete' });
      if (!ok) return;
      await deleteWorkspace(id);
      this.renderLanding();
    }
  },

  async createWorkspace({ name, files, dirs = [], open = null, template = 'blank', extra = {} }) {
    const paths = Object.keys(files);
    const first = open && files[open] !== undefined ? open : paths.find((p) => /readme/i.test(p)) || paths[0] || null;
    const meta = {
      id: newId(),
      name: name || 'Untitled workspace',
      template,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openTabs: first ? [first] : [],
      activePath: first,
      settings: {},
      isNew: true,
      ...extra,
    };
    await putWorkspace(meta);
    await replaceFiles(meta.id, { files, dirs });
    return meta;
  },

  async createFromTemplate(key) {
    const t = TEMPLATES[key] || TEMPLATES.blank;
    const name = await tbPrompt('Name your workspace:', t.name === 'Blank' ? 'My project' : `My ${t.name.replace(/\s*\(.*\)$/, '')} app`, { title: 'New workspace' });
    if (name === null || name === undefined) return;
    const inst = instantiateTemplate(key, { name: name.trim() || t.name });
    const meta = await this.createWorkspace({ name: name.trim() || t.name, files: inst.files, open: inst.open, template: key });
    this.analytics?.started?.({ template: key });
    await this.openWorkspace(meta.id);
  },

  async importZip(file) {
    try {
      const entries = await extractZip(new Uint8Array(await file.arrayBuffer()));
      const fileEntries = entries.filter((en) => !en.isDirectory && !IGNORED_IMPORT.test(en.path));
      const strip = stripCommonRoot(fileEntries.map((en) => en.path));
      const files = {};
      for (const en of fileEntries) {
        const p = normalize(strip(en.path));
        if (!p) continue;
        files[p] = isBinaryPath(p) ? new Uint8Array(en.data) : new TextDecoder().decode(en.data);
      }
      if (!Object.keys(files).length) { await tbAlert('That ZIP file has no files in it.', 'Import ZIP'); return; }
      const meta = await this.createWorkspace({ name: file.name.replace(/\.zip$/i, ''), files, template: 'imported' });
      await this.openWorkspace(meta.id);
    } catch (err) {
      await tbAlert(`Couldn't read that ZIP file: ${err.message}`, 'Import ZIP');
    }
  },

  async importFolder(fileList) {
    const items = fileList.map((f) => ({ f, path: (f.webkitRelativePath || f.name).replace(/\\/g, '/') })).filter((x) => !IGNORED_IMPORT.test(x.path));
    if (!items.length) return;
    const root = items[0].path.includes('/') ? items[0].path.split('/')[0] : 'Imported project';
    const strip = stripCommonRoot(items.map((x) => x.path));
    const files = {};
    let skipped = 0;
    for (const { f, path } of items) {
      if (f.size > 8 * 1024 * 1024) { skipped++; continue; }
      const p = normalize(strip(path));
      if (!p) continue;
      files[p] = isBinaryPath(p) ? new Uint8Array(await f.arrayBuffer()) : await f.text();
    }
    const meta = await this.createWorkspace({ name: root, files, template: 'imported' });
    await this.openWorkspace(meta.id);
    if (skipped) this.ide?.toast(`Skipped ${skipped} file${skipped === 1 ? '' : 's'} larger than 8 MB`);
  },

  async cloneRepo() {
    const url = await tbPrompt('GitHub repository URL (public, or private with a token):', 'https://github.com/', { title: 'Clone from GitHub' });
    if (!url || !/github\.com\/[^/]+\/[^/]+/.test(url)) return;
    const name = url.replace(/\.git$/, '').split('/').filter(Boolean).pop();
    const meta = await this.createWorkspace({ name, files: {}, template: 'imported' });
    await this.openWorkspace(meta.id);
    this.ide?.runInTerminal(`git clone ${url.trim()} .`, { focus: true });
  },

  async importFromToolboxFiles() {
    let fs;
    try { ({ fs } = await import('../lib/filesystem.js')); } catch (err) { await tbAlert(`Toolbox Files isn't available: ${err.message}`, 'Open project'); return; }
    const storage = getCurrentUser() ? 'online' : 'offline';
    let folders = [];
    for (const st of storage === 'online' ? ['online', 'offline'] : ['offline']) {
      try {
        const list = await fs.list('/Projects', { storage: st });
        for (const it of list) if (it.isDirectory && !folders.some((f) => f.name === it.name)) folders.push({ name: it.name, path: it.path, storage: st });
      } catch { /* folder may not exist */ }
    }
    if (!folders.length) { await tbAlert('There are no projects in Files → Projects yet. In a workspace, use File → Save to Toolbox Files to put one there.', 'Open from Toolbox Files'); return; }
    const choice = await tbPrompt(`Which project? Type its name:\n\n${folders.map((f) => `• ${f.name}`).join('\n')}`, folders[0].name, { title: 'Open from Toolbox Files' });
    const folder = folders.find((f) => f.name === (choice || '').trim());
    if (!folder) return;
    const files = {};
    const walk = async (dir, rel) => {
      const list = await fs.list(dir, { storage: folder.storage });
      for (const it of list) {
        const r = rel ? `${rel}/${it.name}` : it.name;
        if (IGNORED_IMPORT.test(r)) continue;
        if (it.isDirectory) await walk(it.path, r);
        else if (isBinaryPath(r)) files[r] = toBytes(await fs.readFile(it.path, { encoding: 'binary', storage: folder.storage }));
        else files[r] = await fs.readFile(it.path, { storage: folder.storage });
      }
    };
    try { await walk(folder.path, ''); } catch (err) { await tbAlert(`Couldn't read ${folder.name}: ${err.message}`, 'Open from Toolbox Files'); return; }
    const meta = await this.createWorkspace({ name: folder.name, files, template: 'imported' });
    await this.openWorkspace(meta.id);
  },

  async downloadWorkspace(meta) {
    const { files, dirs } = await loadFiles(meta.id);
    const entries = [
      ...dirs.map((d) => ({ path: `${d}/`, isDirectory: true })),
      ...Object.entries(files).map(([path, data]) => ({ path, data: typeof data === 'string' ? new TextEncoder().encode(data) : data })),
    ];
    const blob = await createZip(entries);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName(meta.name)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },

  /* ============================================================
     IDE
     ============================================================ */

  async openWorkspace(id) {
    const meta = await getWorkspace(id);
    if (!meta) { await this.renderLanding(); return; }
    const files = await loadFiles(id);
    if (!this._alive) return;
    this.disposeIde();
    setActiveWorkspaceId(id);
    hashWorkspace(id);
    const user = getCurrentUser();
    this._user = user;
    this.container.innerHTML = '';
    const ide = new PlaygroundIDE({
      container: this.container,
      meta,
      files,
      theme: getPlaygroundMode(),
      signedIn: Boolean(user),
      getUser: () => getCurrentUser(),
      dialogs: DIALOGS,
      analytics: this.analytics,
      onExit: () => this.renderLanding(),
      onTheme: (m) => setPlaygroundMode(m),
    });
    this.ide = ide;
    await ide.mount();
  },

  disposeIde() {
    if (!this.ide) return;
    try { this.ide.dispose(); } catch (err) { console.warn('[playground] dispose failed', err); }
    this.ide = null;
  },

  /** Open a file handed over from elsewhere in Toolbox (Files, the assistant…) in a new workspace. */
  async setArtifact(incoming) {
    if (!incoming) return;
    let text = incoming.text ?? incoming.content ?? '';
    const name = normalize(incoming.name || (incoming.path ? incoming.path.split('/').pop() : '') || 'script.js') || 'script.js';
    if (!text && incoming.path) {
      try {
        const { fs } = await import('../lib/filesystem.js');
        text = await fs.readFile(incoming.path, { encoding: 'utf-8' });
      } catch { text = ''; }
    }
    const meta = await this.createWorkspace({ name: name.split('/').pop(), files: { [name]: String(text ?? '') }, open: name, template: 'artifact' });
    if (this.container && this._alive !== false) await this.openWorkspace(meta.id);
  },

  /**
   * Run a command in the playground terminal (used by the Toolbox
   * assistant and tests). Resolves { exitCode, stdout, stderr }.
   */
  async executeTerminalCommand(command, { echo = true } = {}) {
    if (!this.ide) throw new Error('Open a workspace first.');
    const session = this.ide.activeSession() || this.ide.newTerminal();
    let res;
    if (echo && !session.busy()) res = await this.ide.runInTerminal(command, { session });
    if (!res || res.busy) {
      // Run on a detached shell sharing the workspace files.
      const out = []; const err = [];
      const code = await session.shell.execute(command, {
        stdout: { write: (t) => out.push(t) },
        stderr: { write: (t) => err.push(t) },
        stdin: { isTTY: false, readLine: async () => null, readAll: async () => '' },
        signal: new AbortController().signal,
        terminal: null,
      });
      res = { code, out: out.join(''), err: err.join('') };
    }
    const strip = (s) => String(s || '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    return { exitCode: res.code, stdout: strip(res.out), stderr: strip(res.err), output: strip(`${res.out}${res.err}`) };
  },

  destroy() {
    this._alive = false;
    this._authUnsub?.();
    this._authUnsub = null;
    this.disposeIde();
  },
};
