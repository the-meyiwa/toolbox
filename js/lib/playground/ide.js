/* ============================================================
   Code Playground IDE.

   Wires the pieces into one workspace window:
     explorer (folders, drag & drop, context menus, uploads)
     editor tabs (CodeMirror, IntelliSense, diagnostics)
     terminals (several sessions over one shell/file system)
     preview (live web pages and virtual servers)
     problems / browser console panels
     search, source control and the coding agent
     menus, command palette, keyboard shortcuts, status bar
   Everything a student creates is autosaved to IndexedDB.
   ============================================================ */

import { marked } from 'marked';
import { WorkspaceFS } from './vfs.js';
import { AutoSaver, putWorkspace, putObjects, getObject } from './store.js';
import { Shell, StringInput } from './shell.js';
import { registerCoreCommands } from './commands-core.js';
import { registerDevCommands, runCommandFor } from './commands-dev.js';
import { GitStore, registerGit } from './git.js';
import { TerminalView, stripAnsi } from './terminal-ui.js';
import { CodeEditor } from './editor.js';
import { PreviewController } from './ide-preview.js';
import { SearchPanel, GitPanel, esc, fileIcon, diffHtml } from './ide-panels.js';
import { AssistantPanel } from './ide-assistant.js';
import { languageOf, langInfo, pickerGroups, LANGS, DEFAULT_EXT, isBinaryPath, mimeFor } from './languages.js';
import { normalize, dirname, basename, extname } from './paths.js';
import { ensureSyncBridge, detectProject, findTestFiles, pythonTestFiles, cdn, workerUrl } from './runtimes.js';
import { buildPreview, staticSource, dataUrl } from './preview.js';
import { createZip, extractZip } from '../archive-engine.js';
import { TEMPLATES } from './templates.js';

const PREFS_KEY = 'toolbox_cpg_prefs_v3';
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';

function loadPrefs() {
  try { return { fontSize: 14, wrap: false, autoComplete: true, sidebarWidth: 240, panelHeight: 240, previewWidth: 0.45, assistantWidth: 360, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { fontSize: 14, wrap: false, autoComplete: true, sidebarWidth: 240, panelHeight: 240, previewWidth: 0.45, assistantWidth: 360 }; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

export function renderMarkdown(md) {
  try { return (typeof marked?.parse === 'function' ? marked.parse(String(md || '')) : marked(String(md || ''))); } catch { return `<pre>${esc(md)}</pre>`; }
}

/* ============================================================
   TypeScript language service client
   ============================================================ */

class TsService {
  constructor() { this.worker = null; this.seq = 0; this.waiters = new Map(); this.synced = new Map(); }
  start() {
    if (this.worker) return;
    if (typeof Worker === 'undefined') return;
    this.worker = new Worker(workerUrl('ts-worker.js'));
    this.worker.onmessage = (e) => { const m = e.data; const w = this.waiters.get(m.id); if (w) { this.waiters.delete(m.id); if (m.error) w.reject(new Error(m.error)); else w.resolve(m.result); } };
    this.worker.onerror = () => { /* surfaced per call */ };
    this.call('init', { tsUrl: cdn('typescript'), libUrl: '/vendor/typescript/lib.json', nodeTypesUrl: '/vendor/typescript/node-types.json' }).catch(() => {});
  }
  call(type, payload = {}, timeout = 20000) {
    if (!this.worker) return Promise.reject(new Error('TypeScript service not started'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.waiters.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, ...payload });
      setTimeout(() => { if (this.waiters.has(id)) { this.waiters.delete(id); reject(new Error('timeout')); } }, timeout);
    });
  }
  sync(vfs) {
    if (!this.worker) return Promise.resolve();
    const files = {};
    const removed = [];
    const now = new Set();
    for (const p of vfs.listFiles()) {
      if (!/\.(m?[jt]sx?|cts|json)$/.test(p) || /(^|\/)(node_modules|dist)\//.test(p)) continue;
      now.add(p);
      const text = vfs.readFile(p);
      if (this.synced.get(p) !== text) { files[p] = text; this.synced.set(p, text); }
    }
    for (const p of this.synced.keys()) if (!now.has(p)) { removed.push(p); this.synced.delete(p); }
    if (!Object.keys(files).length && !removed.length) return Promise.resolve();
    return this.call('sync', { files, removed }).catch(() => {});
  }
  dispose() { try { this.worker?.terminate(); } catch { /* ignore */ } this.worker = null; }
}

/* ============================================================
   Terminal session
   ============================================================ */

let pidSeq = 100;

class TerminalSession {
  constructor(ide, { name = 'bash', cwd = '' } = {}) {
    this.ide = ide;
    this.id = `t${++pidSeq}`;
    this.name = name;
    this.el = document.createElement('div');
    this.el.className = 'cpg-term-host';
    this.el.dataset.session = this.id;
    this.shell = new Shell({ vfs: ide.vfs, host: this.host() });
    this.shell.cwd = cwd;
    registerCoreCommands(this.shell);
    this.devApi = registerDevCommands(this.shell, this.shell.host);
    registerGit(this.shell, ide.git, {
      getAuthor: () => ide.author(),
      onChange: () => ide.gitChanged(),
      prompt: (ctx, text, opts = {}) => this.promptLine(text, opts),
    });
    this.view = new TerminalView(this.el, {
      onCommand: (line) => this.onCommand(line),
      complete: (line, cursor) => this.shell.complete(line, cursor),
      onInterrupt: () => this.interrupt(),
      onLink: (file, line, col) => ide.openFile(normalize(file), { line, col }),
      isLight: () => ide.theme === 'light',
    });
    this.current = null;
    this.override = null;
    this.updatePrompt();
  }

  host() {
    const ide = this.ide;
    const self = this;
    return {
      clearTerminal: () => self.view.clear(),
      openFile: (p) => ide.openFile(p),
      download: (p) => ide.downloadPath(p),
      onCwdChange: () => self.updatePrompt(),
      onRename: () => {},
      status: (t) => ide.setNote(t),
      showImage: (m) => {
        const blob = new Blob([m.data], { type: m.mime || 'image/png' });
        self.view.image(URL.createObjectURL(blob), m.name || 'figure');
      },
      setDiagnostics: (src, list) => ide.setDiagnostics(src, list),
      registerServer: (port, proc) => ide.registerServer(port, proc, self),
      unregisterServer: (port) => ide.unregisterServer(port),
      unregisterServersOf: (proc) => ide.unregisterServersOf(proc),
      resolveServerResponse: (m) => ide.resolveServerResponse(m),
      hasServer: (port) => ide.servers.has(port),
      requestServer: (port, req) => ide.requestServer(port, req),
      testReport: (r) => ide.testReport(r),
      workspaceName: () => ide.meta.name,
      refreshTree: () => ide.renderTree(),
      buildStatic: (root, out) => ide.buildStatic(root, out),
      openPreview: (t) => ide.openPreview(t),
      setDevServer: (root, on) => ide.setDevServer(root, on, self),
      typeCheck: (files, opts) => ide.typeCheck(files, opts),
      formatCode: (path, src) => ide.formatSource(path, src),
      getSetting: (k) => ide.meta.settings?.[k],
      activeFile: () => ide.activePath,
      processes: () => ide.processList(),
      killProcess: (t) => ide.killProcess(t),
      gitBranch: () => {
        const root = ide.git.findRoot(self.shell.cwd);
        if (root === null) return null;
        const r = ide.git.repo(root);
        return r.head.detached ? r.head.detached.slice(0, 7) : r.head.branch;
      },
    };
  }

  updatePrompt() { this.view.setPrompt(this.shell.prompt()); }

  ttyInput() {
    const view = this.view;
    return {
      isTTY: true,
      readLine: () => view.readLine(),
      async readAll() { let s = ''; for (;;) { const l = await view.readLine(); if (l === null) break; s += `${l}\n`; } return s; },
    };
  }

  async promptLine(text, { secret = false } = {}) {
    this.view.write(text);
    if (secret) this.view.input.type = 'password';
    const line = await this.view.readLine();
    this.view.input.type = 'text';
    return line;
  }

  async onCommand(line) {
    const controller = new AbortController();
    const ov = this.override;
    this.override = null;
    this.current = { pid: ++pidSeq, cmd: line, controller, started: Date.now() };
    this.ide.sessionStateChanged();
    if (line.trim()) this.shell.history.push(line);
    const capture = ov?.capture;
    const out = { write: (t) => { this.view.write(t); if (capture) capture.out += t; } };
    const err = { write: (t) => { this.view.write(t); if (capture) capture.err += t; } };
    const io = { stdout: out, stderr: err, stdin: ov?.stdin != null ? new StringInput(ov.stdin) : this.ttyInput(), signal: controller.signal, terminal: this.view };
    let code = 0;
    try {
      code = await this.shell.execute(line, io);
    } finally {
      if (capture) capture.code = code;
      this.current = null;
      this.updatePrompt();
      this.ide.sessionStateChanged();
    }
    return code;
  }

  interrupt() {
    if (this.current) this.current.controller.abort();
  }

  /** Run a command as if typed; resolves {code, out, err}. */
  async run(line, { stdin = null, echo = true } = {}) {
    const capture = { out: '', err: '', code: 0 };
    this.override = { capture, stdin };
    const ok = await this.view.type(line, { echo });
    if (ok === false) { this.override = null; return { code: -1, out: '', err: 'terminal is busy', busy: true }; }
    return { code: capture.code, out: capture.out, err: capture.err };
  }

  busy() { return Boolean(this.current); }

  dispose() {
    this.interrupt();
    this.view.dispose();
    this.el.remove();
  }
}

/* ============================================================
   The IDE
   ============================================================ */

export class PlaygroundIDE {
  /**
   * @param {object} o
   * @param {HTMLElement} o.container
   * @param {object} o.meta   workspace record
   * @param {{files:object, dirs:string[]}} o.files
   * @param {'dark'|'light'} o.theme
   * @param {boolean} o.signedIn
   * @param {()=>any} o.getUser
   * @param {object} o.dialogs { prompt, confirm, alert }
   * @param {()=>void} o.onExit
   * @param {(mode)=>void} o.onTheme
   */
  constructor(o) {
    this.o = o;
    this.container = o.container;
    this.meta = o.meta;
    this.meta.settings = this.meta.settings || {};
    this.meta.openTabs = (this.meta.openTabs || []).filter(Boolean);
    this.theme = o.theme || 'dark';
    this.prefs = loadPrefs();
    this.diagnostics = new Map();
    this.servers = new Map();
    this.serverWaiters = new Map();
    this.serverSeq = 0;
    this.sessions = [];
    this.disposers = [];
    this.alive = true;
    this.fromEditor = null;
    this.pendingPaths = new Set();
    this.structureChanged = false;
    this.ts = new TsService();
    this.expanded = new Set(this.meta.expanded || []);
  }

  /* ---------------- lifecycle ---------------- */

  async mount() {
    this.vfs = new WorkspaceFS(this.o.files);
    this.saver = new AutoSaver(this.meta.id, this.vfs, { onSaved: () => this.flashSaved(), onError: (err) => this.toast(`Could not save: ${err.message}`) });
    this.git = new GitStore({
      vfs: this.vfs,
      getMeta: () => { this.meta.git = this.meta.git || {}; return this.meta.git; },
      saveMeta: () => this.saveMeta(true),
      putObjects: (objs) => putObjects(this.meta.id, objs),
      getObject: (h) => getObject(this.meta.id, h),
    });
    this.renderLayout();
    this.bindChrome();
    this.editor = new CodeEditor(this.$('#cpg-editor-host'), {
      theme: this.theme,
      fontSize: this.prefs.fontSize,
      wrap: this.prefs.wrap,
      autoComplete: this.prefs.autoComplete,
      onChange: (path, value) => this.onEditorChange(path, value),
      onCursor: (pos, sel) => this.onCursor(pos, sel),
      complete: (path, offset) => this.completions(path, offset),
      hover: (path, offset) => this.quickInfo(path, offset),
      onRun: () => this.runActive(),
      onSave: () => this.saveNow(),
      onFormat: () => this.formatDocument(),
    });
    this.editor.setTheme(this.theme);
    this.preview = new PreviewController({
      frame: this.$('#cpg-preview'),
      vfs: this.vfs,
      requestServer: (port, req) => this.requestServer(port, req),
      hasServer: (port) => this.servers.has(port),
      onConsole: (entry) => this.onBrowserConsole(entry),
      onState: (s) => this.onPreviewState(s),
      renderMarkdown,
    });
    this.searchPanel = new SearchPanel(this.$('#cpg-panel-search'), { vfs: this.vfs, openAt: (f, line, col) => this.openFile(f, { line, col }) });
    this.gitPanel = new GitPanel(this.$('#cpg-panel-scm'), {
      git: this.git,
      vfs: this.vfs,
      cwd: () => this.activeSession()?.shell.cwd || '',
      run: (cmd) => this.runInTerminal(cmd, { focus: true }),
      openDiff: (d) => this.openDiff(d),
      openFile: (p) => this.openFile(p),
      author: () => this.author(),
      ask: (q, d) => this.o.dialogs.prompt(q, d, { title: 'Source Control' }),
      confirm: (q) => this.o.dialogs.confirm(q, { title: 'Source Control', destructive: true }),
      toast: (t) => this.toast(t),
      cloneDialog: () => this.cloneFromGitHub(),
      onCommitted: () => this.updateStatusBar(),
    });
    if (this.o.signedIn) this.mountAssistant();

    this.newTerminal();
    this.disposers.push(this.vfs.onChange((e) => this.onFsChange(e)));
    this.renderTree();
    this.restoreTabs();
    this.applyLayoutPrefs();
    this.updateStatusBar();
    this.renderLangSelect();
    ensureSyncBridge().then((ok) => { if (!ok && this.alive) this.setNote('Interactive input for Python/Lua needs a reload once (service worker).'); });
    // Start IntelliSense early when the project has JS/TS.
    if (this.vfs.listFiles().some((p) => /\.(m?[jt]sx?)$/.test(p))) setTimeout(() => this.ensureTs(), 400);
    this.o.analytics?.completed?.({ outputKind: 'workspace' });
    // The editor bundle loads in the background; files opened before it
    // is ready are queued by CodeEditor and shown as soon as it is.
    this.editorReady = this.editor.ready().then(() => {
      if (!this.alive) return;
      this.refreshEditorDiagnostics();
      this.editor.setTheme(this.theme);
    });
    const tpl = TEMPLATES[this.meta.template];
    if (tpl?.preview && this.meta.isNew) setTimeout(() => this.runActive({ previewOnly: true }), 300);
    if (this.meta.isNew) { delete this.meta.isNew; this.saveMeta(); }
  }

  dispose() {
    this.alive = false;
    for (const d of this.disposers) try { d(); } catch { /* ignore */ }
    this.saver?.flush().catch(() => {});
    this.saver?.dispose();
    this.saveMeta(true);
    for (const s of this.sessions) s.dispose();
    this.editor?.dispose();
    this.preview?.dispose();
    this.ts.dispose();
    this.assistant?.agent?.stop();
    document.getElementById('cpg-ctx-menu')?.remove();
  }

  $(sel) { return this.container.querySelector(sel); }
  $$(sel) { return [...this.container.querySelectorAll(sel)]; }

  /* ---------------- layout ---------------- */

  renderLayout() {
    const signedIn = this.o.signedIn;
    const menus = this.menuModel();
    const menuHtml = Object.entries(menus).map(([key, m]) => `
      <nav class="cpg-menu-item" data-menu="${key}">
        <button type="button" class="cpg-menu-trigger" id="cpg-menu-${key}-btn" aria-haspopup="true" aria-expanded="false">${m.label}</button>
        <div class="cpg-dropdown-menu" id="cpg-menu-${key}" role="menu" hidden>
          ${m.items.map((it) => (it === '-' ? '<div class="cpg-menu-sep" role="separator"></div>' : `<button type="button" class="cpg-dropdown-item" role="menuitem" data-action="${it.action}"${it.signedIn && !signedIn ? ' hidden' : ''}><span>${esc(it.label)}</span>${it.kbd ? `<kbd class="cpg-kbd">${esc(it.kbd)}</kbd>` : ''}</button>`)).join('')}
        </div>
      </nav>`).join('');

    this.container.innerHTML = `
<div class="ide-root cpg-mode-${this.theme}" id="cpg-root" data-mob-view="editor" data-sidebar="explorer">
  <header id="cpg-header" class="cpg-header">
    <div class="cpg-header-left">
      <button type="button" class="cpg-menu-trigger cpg-back" id="cpg-close-ws-btn" title="Back to your workspaces">←<span class="cpg-hide-sm"> Workspaces</span></button>
      <div class="cpg-menubar" role="menubar">${menuHtml}</div>
    </div>
    <div id="cpg-header-controls" class="cpg-header-right">
      <span id="cpg-project-name" class="cpg-project-name" title="Rename workspace"><span class="cpg-dot"></span><span class="cpg-project-label">${esc(this.meta.name)}</span></span>
      <span id="cpg-save-state" class="cpg-save-state" aria-live="polite"></span>
      <button type="button" class="cpg-menu-trigger cpg-hide-sm" id="cpg-cmd-palette" title="Command palette (${MOD}+Shift+P)"><kbd class="cpg-kbd">${MOD}⇧P</kbd></button>
      <button type="button" class="cpg-btn cpg-btn-ghost" id="cpg-top-preview-btn" title="Toggle the preview pane">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M13 3v18"/></svg><span class="cpg-hide-sm">Preview</span>
      </button>
      <button type="button" class="cpg-btn cpg-btn-run" id="cpg-run" title="Run (${MOD}+Enter)">
        <svg class="cpg-run-ico" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg><span class="cpg-run-label">Run</span><kbd class="cpg-hide-sm">⌃↵</kbd>
      </button>
    </div>
  </header>

  <nav class="cpg-mobile-nav" id="cpg-mobile-nav" aria-label="Playground views">
    <button type="button" class="cpg-mob-tab" data-tab="files">Files</button>
    <button type="button" class="cpg-mob-tab active" data-tab="editor">Code</button>
    <button type="button" class="cpg-mob-tab" data-tab="preview">Preview</button>
    <button type="button" class="cpg-mob-tab" data-tab="terminal">Terminal</button>
    ${signedIn ? '<button type="button" class="cpg-mob-tab" data-tab="assistant">AI</button>' : ''}
  </nav>

  <div class="cpg-body">
    <nav class="cpg-activitybar" aria-label="Side bar views">
      <button type="button" class="cpg-activity active" data-side="explorer" title="Explorer (${MOD}+Shift+E)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></button>
      <button type="button" class="cpg-activity" data-side="search" title="Search (${MOD}+Shift+F)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button>
      <button type="button" class="cpg-activity" data-side="scm" title="Source control (${MOD}+Shift+G)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M18 11.5c0 3-3 4-7 4.5"/></svg><span class="cpg-activity-badge" id="cpg-scm-badge" hidden></span></button>
      ${signedIn ? `<button type="button" class="cpg-activity cpg-activity-ai" data-side="assistant" title="AI assistant"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg></button>` : ''}
    </nav>

    <aside id="cpg-sidebar" class="cpg-sidebar ide-sidebar">
      <section class="cpg-side-panel" id="cpg-panel-explorer" data-panel="explorer">
        <div class="cpg-panel-head">
          <span>Explorer</span>
          <span class="cpg-panel-actions">
            <div class="cpg-plus-wrap">
              <button type="button" id="cpg-plus-btn" class="cpg-icon-btn" title="New…" aria-label="Add Item" aria-haspopup="true">+</button>
              <div id="cpg-plus-dropdown" class="cpg-dropdown-menu" hidden>
                <button type="button" class="cpg-dropdown-item" data-add="file"><span>New File…</span><kbd class="cpg-kbd">${MOD}+Alt+N</kbd></button>
                <button type="button" class="cpg-dropdown-item" data-add="folder"><span>New Folder…</span></button>
                <button type="button" class="cpg-dropdown-item" data-add="component"><span>HTML / Web Page…</span></button>
                <button type="button" class="cpg-dropdown-item" data-add="test"><span>Test File…</span></button>
                <div class="cpg-menu-sep"></div>
                <button type="button" class="cpg-dropdown-item" data-add="upload"><span>Upload Files…</span></button>
                <button type="button" class="cpg-dropdown-item" data-add="upload-folder"><span>Upload Folder…</span></button>
              </div>
            </div>
            <button type="button" class="cpg-icon-btn" id="cpg-new-folder-btn" title="New folder">⊞</button>
            <button type="button" class="cpg-icon-btn" id="cpg-collapse-btn" title="Collapse folders">⊟</button>
          </span>
        </div>
        <div class="cpg-ws-title" id="cpg-project-badge" title="/workspace">/workspace</div>
        <div id="cpg-file-tree" class="cpg-tree" role="tree" tabindex="0"></div>
        <div id="cpg-stdin-wrap" class="cpg-stdin-wrap" hidden>
          <label for="cpg-stdin">Program input (optional)</label>
          <textarea id="cpg-stdin" rows="3" placeholder="Lines sent to the program when it isn't run interactively"></textarea>
        </div>
      </section>
      <section class="cpg-side-panel" id="cpg-panel-search" data-panel="search" hidden></section>
      <section class="cpg-side-panel" id="cpg-panel-scm" data-panel="scm" hidden></section>
    </aside>
    <div class="cpg-splitter cpg-splitter-v" data-split="sidebar" aria-hidden="true"></div>

    <main class="cpg-main">
      <div id="cpg-center-split" class="cpg-center">
        <section class="cpg-editor-col" id="cpg-editor-col">
          <div id="cpg-tabs-bar" class="cpg-tabs" role="tablist"></div>
          <div id="cpg-breadcrumbs" class="cpg-breadcrumbs"></div>
          <div id="cpg-editor-wrap" class="cpg-editor-wrap">
            <div id="cpg-editor-host" class="cpg-editor-host"></div>
            <div id="cpg-media-view" class="cpg-media-view" hidden></div>
            <div id="cpg-welcome" class="cpg-welcome" hidden></div>
          </div>
          <div class="cpg-symbolbar" id="cpg-symbolbar" aria-label="Insert symbol">
            ${['⇥', '{', '}', '(', ')', '[', ']', ';', ':', '"', "'", '<', '>', '=', '+', '-', '*', '/', '_', '!', '&', '|', '#', '.', ','].map((s) => `<button type="button" data-sym="${esc(s === '⇥' ? '\t' : s)}">${esc(s)}</button>`).join('')}
          </div>
        </section>
        <div class="cpg-splitter cpg-splitter-v" data-split="preview" aria-hidden="true"></div>
        <section id="cpg-preview-pane" class="cpg-preview-pane" hidden>
          <div class="cpg-preview-bar">
            <button type="button" class="cpg-icon-btn" data-pv="back" title="Back">‹</button>
            <button type="button" class="cpg-icon-btn" data-pv="forward" title="Forward">›</button>
            <button type="button" class="cpg-icon-btn" data-pv="reload" title="Reload">⟳</button>
            <input type="text" class="cpg-preview-url" id="cpg-preview-url" spellcheck="false" aria-label="Preview address" placeholder="index.html or localhost:3000/">
            <select class="cpg-select-sm" id="cpg-preview-device" aria-label="Device size" title="Device size">
              <option value="full">Responsive</option>
              <option value="390">Phone</option>
              <option value="820">Tablet</option>
              <option value="1280">Laptop</option>
            </select>
            <button type="button" class="cpg-icon-btn" data-pv="popout" title="Open in a new tab">⧉</button>
            <button type="button" class="cpg-icon-btn" data-pv="close" title="Close preview">✕</button>
          </div>
          <div class="cpg-preview-stage" id="cpg-preview-stage">
            <iframe id="cpg-preview" title="Preview" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock" allow="clipboard-write; fullscreen; geolocation; microphone; camera; midi; gamepad"></iframe>
          </div>
        </section>
      </div>
      <div class="cpg-splitter cpg-splitter-h" data-split="panel" aria-hidden="true"></div>
      <section id="cpg-bottom-drawer" class="cpg-panel">
        <div class="cpg-panel-tabs" role="tablist">
          <button type="button" class="cpg-drawer-tab active" data-tab="terminal">Terminal</button>
          <button type="button" class="cpg-drawer-tab" data-tab="problems">Problems <span class="cpg-badge" id="cpg-problems-count" hidden>0</span></button>
          <button type="button" class="cpg-drawer-tab" data-tab="output">Console <span class="cpg-badge" id="cpg-console-count" hidden>0</span></button>
          <div class="cpg-term-tabs" id="cpg-term-tabs"></div>
          <div class="cpg-panel-tools">
            <span id="cpg-proc-status" class="cpg-proc-status" hidden>RUNNING</span>
            <span id="cpg-timing" class="cpg-dim"></span>
            <button type="button" class="cpg-icon-btn" id="cpg-term-new" title="New terminal">＋</button>
            <button type="button" class="cpg-icon-btn" id="cpg-proc-stop-btn" title="Stop (Ctrl+C)" hidden>■</button>
            <button type="button" class="cpg-icon-btn" id="cpg-term-clear-btn" title="Clear">⌫</button>
            <button type="button" class="cpg-icon-btn" id="cpg-term-kill" title="Kill this terminal">🗑</button>
            <button type="button" class="cpg-icon-btn" id="cpg-term-max" title="Maximize panel">⤢</button>
            <button type="button" class="cpg-icon-btn" id="cpg-term-close-btn" title="Hide panel (${MOD}+\`)">✕</button>
          </div>
        </div>
        <div id="cpg-pane-terminal" class="cpg-drawer-pane cpg-term-stack"></div>
        <div id="cpg-pane-problems" class="cpg-drawer-pane" hidden><div id="cpg-problems-content" class="cpg-problems">No problems have been detected in the workspace.</div></div>
        <div id="cpg-pane-output" class="cpg-drawer-pane" hidden><div id="cpg-console" class="cpg-console"></div></div>
      </section>
    </main>

    ${signedIn ? '<div class="cpg-splitter cpg-splitter-v" data-split="assistant" aria-hidden="true"></div><aside id="cpg-assistant-panel" class="cpg-assistant" hidden></aside>' : ''}
  </div>

  <footer id="cpg-status-bar" class="cpg-status">
    <div class="cpg-status-left">
      <button type="button" class="cpg-status-btn" id="cpg-status-branch" title="Source control" hidden></button>
      <button type="button" class="cpg-status-btn" id="cpg-status-problems" title="Problems"><span class="cpg-err">⊗ 0</span> <span class="cpg-warn">⚠ 0</span></button>
      <button type="button" class="cpg-status-btn" id="cpg-status-term-toggle" title="Toggle terminal">Terminal</button>
      <span id="cpg-status-pos" class="cpg-hide-sm">Ln 1, Col 1</span>
      <span id="cpg-status-spaces" class="cpg-hide-sm">Spaces: 2</span>
      <span id="cpg-status-encoding" class="cpg-hide-sm">UTF-8</span>
      <span id="cpg-note" class="cpg-note"></span>
    </div>
    <div id="cpg-status-langs-wrap" class="cpg-status-right">
      <select id="cpg-cpp-engine" class="cpg-status-select" aria-label="C/C++ engine" title="How C and C++ programs run" hidden>
        <option value="auto">C++: Auto</option>
        <option value="interpreter">C++: In-browser (JSCPP)</option>
        <option value="compiler">C++: g++ 13 (Wandbox)</option>
      </select>
      ${signedIn ? `<button type="button" class="cpg-status-btn cpg-ai-btn" id="cpg-status-ast-btn" title="AI assistant"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg><span>Assistant</span></button>` : ''}
      <select class="cpg-status-select" id="cpg-langs" aria-label="Language mode" title="Language of the current file"></select>
    </div>
  </footer>

  <div id="cpg-palette-modal" class="cpg-palette" hidden role="dialog" aria-label="Command palette">
    <input type="text" id="cpg-palette-input" class="cpg-palette-input" placeholder="Type a command, or a file name…" autocomplete="off" spellcheck="false">
    <div id="cpg-palette-list" class="cpg-palette-list" role="listbox"></div>
  </div>
  <div id="cpg-modal" class="cpg-modal" hidden></div>
  <div id="cpg-toast" class="cpg-toast" hidden></div>
  <input type="file" id="cpg-upload-files" multiple hidden>
  <input type="file" id="cpg-upload-folder" webkitdirectory multiple hidden>
  <input type="file" id="cpg-upload-zip" accept=".zip,application/zip" hidden>
</div>`;
    this.root = this.$('#cpg-root');
  }

  menuModel() {
    return {
      file: { label: 'File', items: [
        { action: 'new-file', label: 'New File…', kbd: `${MOD}+Alt+N` },
        { action: 'new-folder', label: 'New Folder…' },
        { action: 'insert-example', label: 'Insert Example Code' },
        '-',
        { action: 'upload-files', label: 'Upload Files…' },
        { action: 'upload-folder', label: 'Upload Folder…' },
        { action: 'import-zip', label: 'Import .zip…' },
        { action: 'clone-github', label: 'Clone from GitHub…' },
        '-',
        { action: 'save-workspace', label: 'Save', kbd: `${MOD}+S` },
        { action: 'save-to-files', label: 'Save a Copy to Toolbox Files' },
        { action: 'package-zip', label: 'Download as ZIP' },
        '-',
        { action: 'rename-workspace', label: 'Rename Workspace…' },
        { action: 'close-workspace', label: 'Close Workspace' },
      ] },
      edit: { label: 'Edit', items: [
        { action: 'undo', label: 'Undo', kbd: `${MOD}+Z` },
        { action: 'redo', label: 'Redo', kbd: `${MOD}+Y` },
        '-',
        { action: 'find', label: 'Find', kbd: `${MOD}+F` },
        { action: 'replace', label: 'Replace', kbd: `${MOD}+H` },
        { action: 'find-in-files', label: 'Find in Files', kbd: `${MOD}+Shift+F` },
        { action: 'goto-line', label: 'Go to Line…', kbd: `${MOD}+G` },
        '-',
        { action: 'toggle-comment', label: 'Toggle Comment', kbd: `${MOD}+/` },
        { action: 'format-code', label: 'Format Document', kbd: 'Shift+Alt+F' },
        { action: 'clear-editor', label: 'Clear Editor' },
        '-',
        { action: 'clear-console', label: 'Clear Console & Terminal' },
      ] },
      view: { label: 'View', items: [
        { action: 'palette', label: 'Command Palette…', kbd: `${MOD}+Shift+P` },
        { action: 'quick-open', label: 'Go to File…', kbd: `${MOD}+P` },
        '-',
        { action: 'toggle-sidebar', label: 'Toggle Sidebar', kbd: `${MOD}+B` },
        { action: 'show-explorer', label: 'Explorer', kbd: `${MOD}+Shift+E` },
        { action: 'show-search', label: 'Search', kbd: `${MOD}+Shift+F` },
        { action: 'show-scm', label: 'Source Control', kbd: `${MOD}+Shift+G` },
        { action: 'toggle-terminal', label: 'Toggle Terminal', kbd: `${MOD}+\`` },
        { action: 'toggle-preview', label: 'Toggle Preview' },
        { action: 'toggle-assistant', label: 'Toggle AI Assistant', signedIn: true },
        '-',
        { action: 'toggle-wrap', label: 'Word Wrap', kbd: 'Alt+Z' },
        { action: 'toggle-autocomplete', label: 'Autocomplete While Typing' },
        { action: 'zoom-in', label: 'Zoom In', kbd: `${MOD}+=` },
        { action: 'zoom-out', label: 'Zoom Out', kbd: `${MOD}+-` },
        '-',
        { action: 'theme-dark', label: 'Dark Mode' },
        { action: 'theme-light', label: 'Light Mode' },
      ] },
      run: { label: 'Run', items: [
        { action: 'run-code', label: 'Run Active File', kbd: `${MOD}+Enter` },
        { action: 'run-project', label: 'Run Project', kbd: 'F5' },
        { action: 'stop-execution', label: 'Stop', kbd: 'Ctrl+C' },
        '-',
        { action: 'open-preview', label: 'Open Preview' },
        { action: 'preview-new-tab', label: 'Open Preview in New Tab' },
        '-',
        { action: 'run-terminal', label: 'Run Command in Terminal…' },
        { action: 'build-project', label: 'Build Web App (dist/)' },
      ] },
      terminal: { label: 'Terminal', items: [
        { action: 'new-terminal', label: 'New Terminal', kbd: `${MOD}+Shift+\`` },
        { action: 'clear-terminal', label: 'Clear Terminal' },
        { action: 'kill-terminal', label: 'Kill Terminal' },
        '-',
        { action: 'terminal-help', label: 'Show Available Commands' },
      ] },
      test: { label: 'Test', items: [
        { action: 'run-tests', label: 'Run All Tests' },
        { action: 'run-file-tests', label: 'Run Tests in Current File' },
        { action: 'check-problems', label: 'Check Syntax & Types' },
        { action: 'test-preview', label: 'Test in Browser Preview' },
      ] },
      help: { label: 'Help', items: [
        { action: 'shortcuts', label: 'Keyboard Shortcuts' },
        { action: 'terminal-help', label: 'Terminal Commands' },
        { action: 'about', label: 'About Code Playground' },
      ] },
    };
  }

  applyLayoutPrefs() {
    const p = this.prefs;
    this.root.style.setProperty('--cpg-sidebar-w', `${p.sidebarWidth}px`);
    this.root.style.setProperty('--cpg-panel-h', `${p.panelHeight}px`);
    this.root.style.setProperty('--cpg-preview-w', `${Math.round(p.previewWidth * 100)}%`);
    this.root.style.setProperty('--cpg-assistant-w', `${p.assistantWidth}px`);
    if (this.meta.settings.cppEngine) this.$('#cpg-cpp-engine').value = this.meta.settings.cppEngine;
  }

  /* ---------------- chrome bindings ---------------- */

  bindChrome() {
    const root = this.root;
    const on = (el, ev, fn, opts) => { if (!el) return; el.addEventListener(ev, fn, opts); this.disposers.push(() => el.removeEventListener(ev, fn, opts)); };

    on(this.$('#cpg-close-ws-btn'), 'click', () => this.o.onExit?.());
    on(this.$('#cpg-project-name'), 'click', () => this.renameWorkspace());
    on(this.$('#cpg-run'), 'click', () => (this.mainSession()?.busy() ? this.stopMain() : this.runActive()));
    on(this.$('#cpg-top-preview-btn'), 'click', () => this.togglePreview());
    on(this.$('#cpg-cmd-palette'), 'click', () => this.openPalette('>'));

    // Menus
    let openMenu = null;
    const closeMenus = () => {
      this.$$('.cpg-dropdown-menu').forEach((m) => { m.hidden = true; });
      this.$$('.cpg-menu-trigger[aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      openMenu = null;
    };
    this.closeMenus = closeMenus;
    this.$$('.cpg-menu-item').forEach((item) => {
      const btn = item.querySelector('.cpg-menu-trigger');
      const dd = item.querySelector('.cpg-dropdown-menu');
      on(btn, 'click', (e) => {
        e.stopPropagation();
        const wasOpen = openMenu === dd;
        closeMenus();
        if (!wasOpen) { dd.hidden = false; btn.setAttribute('aria-expanded', 'true'); openMenu = dd; this.updateMenuChecks(); }
      });
      on(item, 'mouseenter', () => {
        if (openMenu && openMenu !== dd) { closeMenus(); dd.hidden = false; btn.setAttribute('aria-expanded', 'true'); openMenu = dd; this.updateMenuChecks(); }
      });
    });
    on(root, 'click', (e) => {
      const item = e.target.closest('.cpg-dropdown-item');
      if (item && (item.dataset.action || item.dataset.add)) {
        e.stopPropagation();
        closeMenus();
        this.$('#cpg-plus-dropdown').hidden = true;
        if (item.dataset.add) this.addItem(item.dataset.add);
        else this.action(item.dataset.action);
        return;
      }
      if (!e.target.closest('.cpg-menu-item') && !e.target.closest('.cpg-plus-wrap')) { closeMenus(); this.$('#cpg-plus-dropdown').hidden = true; }
    });
    on(document, 'click', (e) => { if (!this.container.contains(e.target)) { closeMenus(); const pd = this.$('#cpg-plus-dropdown'); if (pd) pd.hidden = true; } });
    on(this.$('#cpg-plus-btn'), 'click', (e) => { e.stopPropagation(); const pd = this.$('#cpg-plus-dropdown'); const show = pd.hidden; closeMenus(); pd.hidden = !show; });
    on(this.$('#cpg-new-folder-btn'), 'click', () => this.addItem('folder'));
    on(this.$('#cpg-collapse-btn'), 'click', () => { this.expanded.clear(); this.renderTree(); this.saveMeta(); });

    // Activity bar & mobile nav
    this.$$('.cpg-activity').forEach((b) => on(b, 'click', () => {
      if (b.dataset.side === 'assistant') { this.toggleAssistant(); return; }
      this.showSidePanel(b.dataset.side, { toggle: true });
    }));
    this.$$('.cpg-mob-tab').forEach((b) => on(b, 'click', () => this.setMobileView(b.dataset.tab)));

    // Symbol bar (touch keyboards)
    on(this.$('#cpg-symbolbar'), 'mousedown', (e) => e.preventDefault());
    on(this.$('#cpg-symbolbar'), 'click', (e) => { const b = e.target.closest('[data-sym]'); if (b) this.editor.insert(b.dataset.sym); });

    // Bottom panel
    this.$$('.cpg-drawer-tab').forEach((t) => on(t, 'click', () => this.showPanelTab(t.dataset.tab)));
    on(this.$('#cpg-term-new'), 'click', () => this.newTerminal({ focus: true }));
    on(this.$('#cpg-term-kill'), 'click', () => this.killTerminal());
    on(this.$('#cpg-term-clear-btn'), 'click', () => this.clearPanel());
    on(this.$('#cpg-term-close-btn'), 'click', () => this.togglePanel(false));
    on(this.$('#cpg-term-max'), 'click', () => root.classList.toggle('cpg-panel-max'));
    on(this.$('#cpg-proc-stop-btn'), 'click', () => this.activeSession()?.interrupt());
    on(this.$('#cpg-status-term-toggle'), 'click', () => this.togglePanel());
    on(this.$('#cpg-status-problems'), 'click', () => { this.togglePanel(true); this.showPanelTab('problems'); });
    on(this.$('#cpg-status-branch'), 'click', () => this.showSidePanel('scm'));
    on(this.$('#cpg-status-ast-btn'), 'click', () => this.toggleAssistant());
    on(this.$('#cpg-langs'), 'change', (e) => this.changeLanguage(e.target.value));
    on(this.$('#cpg-cpp-engine'), 'change', (e) => { this.meta.settings.cppEngine = e.target.value; this.saveMeta(); this.toast(`C/C++ will run with: ${e.target.selectedOptions[0].textContent.replace('C++: ', '')}`); });
    on(this.$('#cpg-problems-content'), 'click', (e) => { const r = e.target.closest('[data-file]'); if (r) this.openFile(r.dataset.file, { line: Number(r.dataset.line), col: Number(r.dataset.col) }); });
    on(this.$('#cpg-console'), 'click', (e) => { const r = e.target.closest('[data-file]'); if (r && r.dataset.file) this.openFile(r.dataset.file, { line: Number(r.dataset.line) || 1 }); });

    // Preview bar
    on(this.$('.cpg-preview-bar'), 'click', (e) => {
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      const a = b.dataset.pv;
      if (a === 'back') this.preview.back();
      else if (a === 'forward') this.preview.fwd();
      else if (a === 'reload') this.preview.reload();
      else if (a === 'popout') this.preview.openInNewTab();
      else if (a === 'close') this.togglePreview(false);
    });
    on(this.$('#cpg-preview-url'), 'keydown', (e) => { if (e.key === 'Enter') this.navigatePreview(e.target.value); });
    on(this.$('#cpg-preview-device'), 'change', (e) => {
      const stage = this.$('#cpg-preview-stage');
      stage.dataset.device = e.target.value;
      this.$('#cpg-preview').style.width = e.target.value === 'full' ? '' : `${e.target.value}px`;
    });

    // Uploads
    on(this.$('#cpg-upload-files'), 'change', (e) => this.importFileList(e.target.files, this.uploadTarget || ''));
    on(this.$('#cpg-upload-folder'), 'change', (e) => this.importFileList(e.target.files, this.uploadTarget || ''));
    on(this.$('#cpg-upload-zip'), 'change', (e) => this.importZipFile(e.target.files?.[0], this.uploadTarget || ''));

    // Splitters
    this.$$('.cpg-splitter').forEach((s) => on(s, 'pointerdown', (e) => this.startSplit(e, s.dataset.split)));

    // Keyboard shortcuts
    on(window, 'keydown', (e) => this.onGlobalKey(e), true);

    // Palette
    on(this.$('#cpg-palette-input'), 'input', () => this.renderPalette());
    on(this.$('#cpg-palette-input'), 'keydown', (e) => this.onPaletteKey(e));
    on(this.$('#cpg-palette-list'), 'click', (e) => { const it = e.target.closest('[data-idx]'); if (it) this.choosePalette(Number(it.dataset.idx)); });
    on(this.$('#cpg-palette-modal'), 'mousedown', (e) => { if (e.target.id === 'cpg-palette-modal') this.closePalette(); });

    // Drag & drop files from the computer onto the IDE
    on(this.$('#cpg-sidebar'), 'dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); this.$('#cpg-sidebar').classList.add('is-drop'); } });
    on(this.$('#cpg-sidebar'), 'dragleave', () => this.$('#cpg-sidebar').classList.remove('is-drop'));
    on(this.$('#cpg-sidebar'), 'drop', (e) => {
      this.$('#cpg-sidebar').classList.remove('is-drop');
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const row = e.target.closest('.cpg-tree-row');
      const target = row ? (row.dataset.type === 'dir' ? row.dataset.path : dirname(row.dataset.path)) : '';
      this.importDataTransfer(e.dataTransfer, target);
    });

    // Leaving the page: flush saves
    const beforeUnload = () => { this.saver?.flush(); this.saveMeta(true); };
    on(window, 'beforeunload', beforeUnload);
    on(window, 'pagehide', beforeUnload);
    const onResize = () => this.editor?.refresh();
    on(window, 'resize', onResize);
  }

  onGlobalKey(e) {
    if (!this.alive || !this.container.isConnected) return;
    if (!this.container.contains(document.activeElement) && document.activeElement !== document.body) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const kl = k.length === 1 ? k.toLowerCase() : k;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (!this.$('#cpg-palette-modal').hidden && k === 'Escape') { stop(); this.closePalette(); return; }
    if (!this.$('#cpg-modal').hidden && k === 'Escape') { stop(); this.closeModal(); return; }
    if (mod && e.shiftKey && kl === 'p') { stop(); this.openPalette('>'); return; }
    if (mod && !e.shiftKey && kl === 'p') { stop(); this.openPalette(''); return; }
    if (mod && e.shiftKey && kl === 'f') { stop(); this.showSidePanel('search'); this.searchPanel.focus(this.editor.selection()); return; }
    if (mod && e.shiftKey && kl === 'e') { stop(); this.showSidePanel('explorer'); return; }
    if (mod && e.shiftKey && kl === 'g') { stop(); this.showSidePanel('scm'); return; }
    if (mod && e.shiftKey && (k === '`' || k === '~')) { stop(); this.newTerminal({ focus: true }); return; }
    if (mod && k === '`') { stop(); this.togglePanel(); return; }
    if (mod && !e.shiftKey && kl === 'b') { stop(); this.toggleSidebar(); return; }
    if (mod && kl === 's') { stop(); this.saveNow(); return; }
    if (mod && e.altKey && kl === 'n') { stop(); this.addItem('file'); return; }
    if (mod && k === 'Enter' && !this.$('#cpg-editor-host').contains(e.target)) { stop(); this.runActive(); return; }
    if (k === 'F5') { stop(); this.runProject(); return; }
    if (e.altKey && kl === 'z') { stop(); this.action('toggle-wrap'); return; }
    if (mod && (k === '=' || k === '+')) { stop(); this.action('zoom-in'); return; }
    if (mod && k === '-') { stop(); this.action('zoom-out'); return; }
    if (k === 'Escape') { this.closeMenus?.(); document.getElementById('cpg-ctx-menu')?.remove(); }
  }

  /* ---------------- actions (menus / palette) ---------------- */

  async action(a) {
    switch (a) {
      case 'new-file': return this.addItem('file');
      case 'new-folder': return this.addItem('folder');
      case 'insert-example': return this.insertExample();
      case 'upload-files': this.uploadTarget = this.selectedFolder(); return this.$('#cpg-upload-files').click();
      case 'upload-folder': this.uploadTarget = this.selectedFolder(); return this.$('#cpg-upload-folder').click();
      case 'import-zip': this.uploadTarget = this.selectedFolder(); return this.$('#cpg-upload-zip').click();
      case 'clone-github': return this.cloneFromGitHub();
      case 'save-workspace': return this.saveNow();
      case 'save-to-files': return this.saveToToolboxFiles();
      case 'package-zip': return this.downloadPath('');
      case 'rename-workspace': return this.renameWorkspace();
      case 'close-workspace': return this.o.onExit?.();
      case 'undo': return this.editor.exec('undo');
      case 'redo': return this.editor.exec('redo');
      case 'find': return this.editor.exec('find');
      case 'replace': return this.editor.exec('replace');
      case 'find-in-files': this.showSidePanel('search'); return this.searchPanel.focus(this.editor.selection());
      case 'goto-line': return this.editor.exec('gotoLine');
      case 'toggle-comment': return this.editor.exec('comment');
      case 'format-code': return this.formatDocument();
      case 'clear-editor': {
        if (!this.activePath) return;
        if (!(await this.o.dialogs.confirm(`Remove all the code in ${basename(this.activePath)}?`, { title: 'Clear Editor', destructive: true }))) return;
        this.vfs.writeFile(this.activePath, '');
        return;
      }
      case 'clear-console': this.activeSession()?.view.clear(); this.$('#cpg-console').innerHTML = ''; this.updateConsoleCount(0); return;
      case 'palette': return this.openPalette('>');
      case 'quick-open': return this.openPalette('');
      case 'toggle-sidebar': return this.toggleSidebar();
      case 'show-explorer': return this.showSidePanel('explorer');
      case 'show-search': this.showSidePanel('search'); return this.searchPanel.focus();
      case 'show-scm': return this.showSidePanel('scm');
      case 'toggle-terminal': return this.togglePanel();
      case 'toggle-preview': return this.togglePreview();
      case 'toggle-assistant': return this.toggleAssistant();
      case 'toggle-wrap': this.prefs.wrap = !this.prefs.wrap; savePrefs(this.prefs); this.editor.setWrap(this.prefs.wrap); return this.toast(`Word wrap ${this.prefs.wrap ? 'on' : 'off'}`);
      case 'toggle-autocomplete': this.prefs.autoComplete = !this.prefs.autoComplete; savePrefs(this.prefs); this.editor.o.autoComplete = this.prefs.autoComplete; return this.toast(`Autocomplete while typing ${this.prefs.autoComplete ? 'on' : 'off'} (${MOD}+Space always works)`);
      case 'zoom-in': this.prefs.fontSize = Math.min(26, this.prefs.fontSize + 1); savePrefs(this.prefs); return this.editor.setFontSize(this.prefs.fontSize);
      case 'zoom-out': this.prefs.fontSize = Math.max(10, this.prefs.fontSize - 1); savePrefs(this.prefs); return this.editor.setFontSize(this.prefs.fontSize);
      case 'theme-dark': return this.setTheme('dark');
      case 'theme-light': return this.setTheme('light');
      case 'run-code': return this.runActive();
      case 'run-project': return this.runProject();
      case 'stop-execution': return this.stopMain();
      case 'open-preview': return this.togglePreview(true);
      case 'preview-new-tab': await this.togglePreview(true); return this.preview.openInNewTab();
      case 'run-terminal': this.togglePanel(true); this.showPanelTab('terminal'); return this.activeSession()?.view.focus();
      case 'build-project': return this.runInTerminal('npx vite build', { focus: true });
      case 'new-terminal': return this.newTerminal({ focus: true });
      case 'clear-terminal': return this.activeSession()?.view.clear();
      case 'kill-terminal': return this.killTerminal();
      case 'terminal-help': return this.runInTerminal('help', { focus: true });
      case 'run-tests': return this.runTests();
      case 'run-file-tests': return this.runTests(this.activePath);
      case 'check-problems': return this.checkProblems();
      case 'test-preview': return this.testInBrowser();
      case 'shortcuts': return this.showShortcuts();
      case 'about': return this.showAbout();
      default: return undefined;
    }
  }

  updateMenuChecks() {
    const mark = (action, on) => { const b = this.$(`[data-action="${action}"] span`); if (b) b.textContent = `${on ? '✓ ' : ''}${b.textContent.replace(/^✓ /, '')}`; };
    mark('theme-dark', this.theme === 'dark');
    mark('theme-light', this.theme === 'light');
    mark('toggle-wrap', this.prefs.wrap);
    mark('toggle-autocomplete', this.prefs.autoComplete);
    mark('toggle-sidebar', !this.root.classList.contains('cpg-no-sidebar'));
    mark('toggle-terminal', !this.root.classList.contains('cpg-no-panel'));
    mark('toggle-preview', !this.$('#cpg-preview-pane').hidden);
  }

  setTheme(mode) {
    this.theme = mode;
    this.root.classList.remove('cpg-mode-dark', 'cpg-mode-light');
    this.root.classList.add(`cpg-mode-${mode}`);
    this.editor.setTheme(mode);
    this.o.onTheme?.(mode);
  }

  /* ---------------- side bar ---------------- */

  showSidePanel(name, { toggle = false } = {}) {
    const current = this.root.dataset.sidebar;
    if (toggle && current === name && !this.root.classList.contains('cpg-no-sidebar')) { this.toggleSidebar(false); return; }
    this.root.classList.remove('cpg-no-sidebar');
    this.root.dataset.sidebar = name;
    this.$$('.cpg-side-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    this.$$('.cpg-activity').forEach((b) => b.classList.toggle('active', b.dataset.side === name));
    if (name === 'scm') this.gitPanel.render();
    if (this.isMobile()) this.setMobileView('files');
  }

  toggleSidebar(force) {
    const hidden = this.root.classList.contains('cpg-no-sidebar');
    const show = typeof force === 'boolean' ? force : hidden;
    this.root.classList.toggle('cpg-no-sidebar', !show);
    setTimeout(() => this.editor.refresh(), 10);
  }

  isMobile() { return window.innerWidth <= 768; }

  setMobileView(tab) {
    this.root.dataset.mobView = tab;
    this.$$('.cpg-mob-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'preview') { this.togglePreview(true); }
    if (tab === 'terminal') { this.togglePanel(true); this.showPanelTab('terminal'); setTimeout(() => this.activeSession()?.view.focus(), 50); }
    if (tab === 'assistant') this.toggleAssistant(true);
    if (tab === 'editor') setTimeout(() => this.editor.refresh(), 30);
  }

  /* ---------------- explorer ---------------- */

  selectedFolder() {
    const sel = this.selectedTreePath;
    if (sel && this.vfs.isDir(sel)) return sel;
    if (sel) return dirname(sel);
    return this.activePath ? dirname(this.activePath) : '';
  }

  renderTree() {
    const tree = this.$('#cpg-file-tree');
    if (!tree) return;
    const rows = [];
    const walk = (dir, depth) => {
      let entries;
      try { entries = this.vfs.readdir(dir); } catch { return; }
      for (const e of entries) {
        if (e.name === '.git') continue;
        const open = this.expanded.has(e.path);
        const active = e.path === this.activePath;
        const selected = e.path === this.selectedTreePath;
        rows.push(`<div class="cpg-tree-row ide-tree-item${active ? ' active' : ''}${selected ? ' selected' : ''}${e.name.startsWith('.') ? ' is-hidden' : ''}" role="treeitem" draggable="true" data-path="${esc(e.path)}" data-id="${esc(e.path)}" data-type="${e.type}" style="--depth:${depth}" ${e.type === 'dir' ? `aria-expanded="${open}"` : ''} title="${esc(e.path)}">
          <span class="cpg-twisty">${e.type === 'dir' ? (open ? '▾' : '▸') : ''}</span>${fileIcon(e.path, e.type, open)}<span class="cpg-tree-name">${esc(e.name)}</span>
          <button type="button" class="cpg-tree-more" data-more="1" title="More actions" aria-label="More actions for ${esc(e.name)}">⋯</button>
        </div>`);
        if (e.type === 'dir' && open) walk(e.path, depth + 1);
      }
    };
    walk('', 0);
    tree.innerHTML = rows.join('') || `<div class="cpg-empty cpg-tree-empty">No files yet.<br><button type="button" class="cpg-link" data-empty-new="1">Create a file</button></div>`;
    if (!tree.dataset.bound) {
      tree.dataset.bound = '1';
      tree.addEventListener('click', (e) => this.onTreeClick(e));
      tree.addEventListener('dblclick', (e) => { const r = e.target.closest('.cpg-tree-row'); if (r && r.dataset.type === 'file') this.editor.focus(); });
      tree.addEventListener('contextmenu', (e) => {
        const r = e.target.closest('.cpg-tree-row');
        e.preventDefault();
        this.treeContextMenu(r, e.clientX, e.clientY);
      });
      tree.addEventListener('keydown', (e) => this.onTreeKey(e));
      tree.addEventListener('dragstart', (e) => {
        const r = e.target.closest('.cpg-tree-row');
        if (!r) return;
        e.dataTransfer.setData('application/x-cpg-path', r.dataset.path);
        e.dataTransfer.effectAllowed = 'move';
      });
      tree.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('application/x-cpg-path')) return;
        e.preventDefault();
        tree.querySelectorAll('.is-drop-target').forEach((x) => x.classList.remove('is-drop-target'));
        const r = e.target.closest('.cpg-tree-row');
        (r && r.dataset.type === 'dir' ? r : tree).classList.add('is-drop-target');
      });
      tree.addEventListener('dragleave', () => tree.querySelectorAll('.is-drop-target').forEach((x) => x.classList.remove('is-drop-target')));
      tree.addEventListener('drop', (e) => {
        const src = e.dataTransfer.getData('application/x-cpg-path');
        tree.classList.remove('is-drop-target');
        tree.querySelectorAll('.is-drop-target').forEach((x) => x.classList.remove('is-drop-target'));
        if (!src) return;
        e.preventDefault();
        e.stopPropagation();
        const r = e.target.closest('.cpg-tree-row');
        const dest = r ? (r.dataset.type === 'dir' ? r.dataset.path : dirname(r.dataset.path)) : '';
        const to = normalize(dest ? `${dest}/${basename(src)}` : basename(src));
        if (to === src || to.startsWith(`${src}/`)) return;
        this.movePath(src, to);
      });
      let pressTimer = null;
      tree.addEventListener('touchstart', (e) => {
        const r = e.target.closest('.cpg-tree-row');
        if (!r) return;
        const t = e.touches[0];
        pressTimer = setTimeout(() => this.treeContextMenu(r, t.clientX, t.clientY), 550);
      }, { passive: true });
      tree.addEventListener('touchend', () => clearTimeout(pressTimer));
      tree.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
    }
    this.$('#cpg-project-badge').textContent = `/workspace · ${this.vfs.listFiles().length} files`;
  }

  onTreeClick(e) {
    if (e.target.closest('[data-empty-new]')) { this.addItem('file'); return; }
    const r = e.target.closest('.cpg-tree-row');
    if (!r) { this.selectedTreePath = null; this.$$('.cpg-tree-row.selected').forEach((x) => x.classList.remove('selected')); return; }
    const path = r.dataset.path;
    if (e.target.closest('[data-more]')) { const b = e.target.getBoundingClientRect(); this.treeContextMenu(r, b.left, b.bottom); return; }
    this.selectedTreePath = path;
    if (r.dataset.type === 'dir') {
      if (this.expanded.has(path)) this.expanded.delete(path); else this.expanded.add(path);
      this.renderTree();
      this.saveMeta();
    } else {
      this.openFile(path);
      if (this.isMobile()) this.setMobileView('editor');
    }
  }

  onTreeKey(e) {
    const rows = this.$$('.cpg-tree-row');
    const idx = rows.findIndex((r) => r.dataset.path === this.selectedTreePath);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) { this.selectedTreePath = next.dataset.path; this.renderTree(); this.$(`.cpg-tree-row[data-path="${CSS.escape(next.dataset.path)}"]`)?.scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'Enter' && idx !== -1) {
      e.preventDefault();
      const r = rows[idx];
      if (r.dataset.type === 'dir') { if (this.expanded.has(r.dataset.path)) this.expanded.delete(r.dataset.path); else this.expanded.add(r.dataset.path); this.renderTree(); } else this.openFile(r.dataset.path);
    } else if (e.key === 'F2' && idx !== -1) { e.preventDefault(); this.renamePath(rows[idx].dataset.path); }
    else if (e.key === 'Delete' && idx !== -1) { e.preventDefault(); this.deletePath(rows[idx].dataset.path); }
  }

  treeContextMenu(row, x, y) {
    const path = row?.dataset.path || '';
    const isDir = !row || row.dataset.type === 'dir';
    const folder = isDir ? path : dirname(path);
    if (row) this.selectedTreePath = path;
    const items = [
      { label: 'New File…', run: () => this.addItem('file', folder) },
      { label: 'New Folder…', run: () => this.addItem('folder', folder) },
      { label: 'Upload Files Here…', run: () => { this.uploadTarget = folder; this.$('#cpg-upload-files').click(); } },
    ];
    if (row) {
      items.push('-');
      if (!isDir) {
        const cmd = runCommandFor(this.vfs, path, '');
        if (cmd) items.push({ label: 'Run', run: () => { this.openFile(path); this.runActive(); } });
        if (/\.(html?|md|svg)$/i.test(path)) items.push({ label: 'Open Preview', run: () => this.openPreview({ file: path }) });
      }
      items.push({ label: 'Open in Terminal', run: () => this.runInTerminal(`cd ${quoteArg(`/workspace/${folder}`)}`, { focus: true }) });
      items.push('-');
      items.push({ label: 'Rename…', kbd: 'F2', run: () => this.renamePath(path) });
      items.push({ label: 'Duplicate', run: () => this.duplicatePath(path) });
      items.push({ label: 'Copy Path', run: () => navigator.clipboard?.writeText(path).then(() => this.toast('Path copied')) });
      items.push({ label: isDir ? 'Download as ZIP' : 'Download', run: () => this.downloadPath(path) });
      items.push('-');
      items.push({ label: 'Delete', kbd: 'Del', danger: true, run: () => this.deletePath(path) });
    }
    this.contextMenu(x, y, items, path || 'Workspace');
  }

  contextMenu(x, y, items, title = '') {
    document.getElementById('cpg-ctx-menu')?.remove();
    const m = document.createElement('div');
    m.id = 'cpg-ctx-menu';
    m.className = `cpg-dropdown-menu cpg-ctx cpg-mode-${this.theme}`;
    m.setAttribute('role', 'menu');
    m.innerHTML = `${title ? `<div class="cpg-ctx-title">${esc(title)}</div>` : ''}${items.map((it, i) => (it === '-' ? '<div class="cpg-menu-sep"></div>' : `<button type="button" class="cpg-dropdown-item${it.danger ? ' is-danger' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.kbd ? `<kbd class="cpg-kbd">${esc(it.kbd)}</kbd>` : ''}</button>`)).join('')}`;
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(6, Math.min(x, window.innerWidth - r.width - 6))}px`;
    m.style.top = `${Math.max(6, Math.min(y, window.innerHeight - r.height - 6))}px`;
    const close = () => { m.remove(); document.removeEventListener('mousedown', outside, true); };
    const outside = (e) => { if (!m.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      close();
      items[Number(b.dataset.i)].run();
    });
    m.querySelector('button')?.focus();
    m.addEventListener('keydown', (e) => {
      const btns = [...m.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
      if (e.key === 'Escape') close();
    });
  }

  /** Inline name input inside the tree (new file/folder, rename). */
  inlineName({ parent = '', kind = 'file', initial = '', renameOf = null } = {}) {
    return new Promise((resolve) => {
      if (parent) this.expanded.add(parent);
      this.renderTree();
      const tree = this.$('#cpg-file-tree');
      const row = document.createElement('div');
      row.className = 'cpg-tree-row cpg-tree-edit';
      const depth = parent ? parent.split('/').length : 0;
      row.style.setProperty('--depth', renameOf ? Math.max(0, renameOf.split('/').length - 1) : depth);
      row.innerHTML = `<span class="cpg-twisty"></span>${fileIcon(initial || (kind === 'folder' ? '' : 'x.txt'), kind === 'folder' ? 'dir' : 'file')}<input type="text" class="cpg-tree-input" spellcheck="false" autocomplete="off" aria-label="${kind === 'folder' ? 'Folder' : 'File'} name">`;
      const input = row.querySelector('input');
      input.value = initial;
      const anchor = renameOf ? tree.querySelector(`.cpg-tree-row[data-path="${CSS.escape(renameOf)}"]`) : parent ? tree.querySelector(`.cpg-tree-row[data-path="${CSS.escape(parent)}"]`) : null;
      if (renameOf && anchor) { anchor.replaceWith(row); } else if (anchor) anchor.after(row); else tree.prepend(row);
      input.focus();
      const dot = initial.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 && kind !== 'folder' ? dot : initial.length);
      let done = false;
      const finish = (value) => { if (done) return; done = true; row.remove(); resolve(value); };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim()); }
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
        e.stopPropagation();
      });
      input.addEventListener('blur', () => setTimeout(() => finish(input.value.trim() || null), 80));
    });
  }

  async addItem(kind, parent = null) {
    const folder = parent ?? this.selectedFolder();
    if (this.isMobile() && this.root.dataset.mobView !== 'files') this.setMobileView('files');
    this.showSidePanel('explorer');
    if (kind === 'upload') { this.uploadTarget = folder; this.$('#cpg-upload-files').click(); return; }
    if (kind === 'upload-folder') { this.uploadTarget = folder; this.$('#cpg-upload-folder').click(); return; }
    const suggestions = { file: '', folder: '', component: 'page.html', test: this.suggestTestName() };
    const name = await this.inlineName({ parent: folder, kind: kind === 'folder' ? 'folder' : 'file', initial: suggestions[kind] || '' });
    if (!name) return;
    const path = normalize(folder ? `${folder}/${name}` : name);
    if (this.vfs.exists(path)) { this.toast(`${name} already exists`); return; }
    if (/[<>:"|?*]/.test(name)) { this.toast('File names can’t contain < > : " | ? *'); return; }
    if (kind === 'folder') {
      this.vfs.mkdir(path);
      this.expanded.add(path);
      this.renderTree();
      return;
    }
    let file = path;
    if (kind === 'component' && !/\.html?$/i.test(file)) file += '.html';
    let content = '';
    if (kind === 'component') content = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${basename(file).replace(/\.html?$/, '')}</title>\n</head>\n<body>\n  <h1>${basename(file).replace(/\.html?$/, '')}</h1>\n</body>\n</html>\n`;
    else if (kind === 'test') content = testTemplate(file, this.activePath);
    else content = starterFor(file);
    this.vfs.writeFile(file, content);
    this.openFile(file);
    if (this.isMobile()) this.setMobileView('editor');
  }

  suggestTestName() {
    const a = this.activePath;
    if (a && /\.(m?[jt]sx?)$/.test(a) && !/\.(test|spec)\./.test(a)) return basename(a).replace(/(\.[^.]+)$/, '.test$1');
    if (a && /\.py$/.test(a)) return `test_${basename(a)}`;
    return 'app.test.js';
  }

  async renamePath(path) {
    const name = await this.inlineName({ parent: dirname(path), kind: this.vfs.isDir(path) ? 'folder' : 'file', initial: basename(path), renameOf: path });
    if (!name || name === basename(path)) return;
    const to = normalize(`${dirname(path)}/${name}`);
    this.movePath(path, to);
  }

  movePath(from, to) {
    if (this.vfs.exists(to)) { this.toast(`${to} already exists`); return; }
    try { this.vfs.rename(from, to); } catch (err) { this.toast(err.message); }
  }

  duplicatePath(path) {
    const ext = extname(path);
    const stem = this.vfs.isDir(path) ? path : path.slice(0, path.length - ext.length);
    let n = 1;
    let to;
    do { to = this.vfs.isDir(path) ? `${stem} copy${n > 1 ? ` ${n}` : ''}` : `${stem} copy${n > 1 ? ` ${n}` : ''}${ext}`; n++; } while (this.vfs.exists(to));
    this.vfs.copy(path, to, { recursive: true });
    if (this.vfs.isFile(to)) this.openFile(to);
  }

  async deletePath(path) {
    const isDir = this.vfs.isDir(path);
    const count = isDir ? this.vfs.listFiles(path).length : 1;
    const ok = await this.o.dialogs.confirm(isDir ? `Delete the folder “${basename(path)}” and its ${count} file${count === 1 ? '' : 's'}?` : `Delete “${basename(path)}”?`, { title: 'Delete', destructive: true });
    if (!ok) return;
    this.vfs.rm(path, { recursive: true, force: true });
    this.toast(`Deleted ${basename(path)}`);
  }

  /* ---------------- tabs & editor ---------------- */

  restoreTabs() {
    const tabs = this.meta.openTabs.filter((p) => this.vfs.isFile(p));
    this.meta.openTabs = tabs;
    let active = this.meta.activePath && this.vfs.isFile(this.meta.activePath) ? this.meta.activePath : tabs[0];
    if (!active) {
      const files = this.vfs.listFiles().filter((p) => !isBinaryPath(p));
      const p = detectProject(this.vfs);
      active = p.node || p.python || p.cpp || p.html || files.find((f) => /readme/i.test(f)) || files[0];
    }
    if (active) this.openFile(active, { focus: false });
    else this.renderTabs();
    for (const t of this.meta.openTabs) for (let d = dirname(t); d; d = dirname(d)) this.expanded.add(d);
    this.renderTree();
  }

  openFile(path, { line = 0, col = 1, focus = true } = {}) {
    const p = normalize(path);
    if (!this.vfs.isFile(p)) { this.toast(`File not found: ${p}`); return; }
    if (!this.meta.openTabs.includes(p)) this.meta.openTabs.push(p);
    this.activePath = p;
    this.meta.activePath = p;
    for (let d = dirname(p); d; d = dirname(d)) this.expanded.add(d);
    const media = this.$('#cpg-media-view');
    const lang = languageOf(p);
    if (isBinaryPath(p)) {
      media.hidden = false;
      this.$('#cpg-editor-host').hidden = true;
      const bytes = this.vfs.readBinary(p);
      const size = bytes.byteLength;
      if (lang === 'image') media.innerHTML = `<figure><img alt="${esc(basename(p))}" src="${dataUrl(mimeFor(p), bytes)}"><figcaption>${esc(basename(p))} · ${formatBytes(size)}</figcaption></figure>`;
      else if (/\.(mp3|wav|ogg)$/i.test(p)) media.innerHTML = `<figure><audio controls src="${dataUrl(mimeFor(p), bytes)}"></audio><figcaption>${esc(basename(p))} · ${formatBytes(size)}</figcaption></figure>`;
      else if (/\.(mp4|webm)$/i.test(p)) media.innerHTML = `<figure><video controls src="${dataUrl(mimeFor(p), bytes)}"></video><figcaption>${esc(basename(p))}</figcaption></figure>`;
      else media.innerHTML = `<div class="cpg-empty"><p><b>${esc(basename(p))}</b> is a binary file (${formatBytes(size)}).</p><button type="button" class="cpg-btn" data-dl="${esc(p)}">Download</button></div>`;
      media.querySelector('[data-dl]')?.addEventListener('click', () => this.downloadPath(p));
    } else {
      media.hidden = true;
      media.innerHTML = '';
      this.$('#cpg-editor-host').hidden = false;
      this.editor.open(p, this.vfs.readFile(p));
      this.refreshEditorDiagnostics();
      if (line) setTimeout(() => this.editor.goto(line, col), 20);
      else if (focus && !this.isMobile()) this.editor.focus();
    }
    this.renderTabs();
    this.renderTree();
    this.renderLangSelect();
    this.renderBreadcrumbs();
    this.updateStatusBar();
    this.saveMeta();
    if (/\.(m?[jt]sx?)$/.test(p)) this.ensureTs();
    if (!this.$('#cpg-preview-pane').hidden && this.preview.state?.kind !== 'server') {
      const t = this.preview.targetForFile(p);
      if (t && (t.kind === 'markdown' || !this.preview.state || this.preview.state.kind === 'markdown')) this.preview.show(t, { push: false });
    }
    if (this.isMobile() && line) this.setMobileView('editor');
  }

  closeTab(path) {
    const i = this.meta.openTabs.indexOf(path);
    if (i === -1) return;
    this.meta.openTabs.splice(i, 1);
    this.editor.close(path);
    if (this.activePath === path) {
      const next = this.meta.openTabs[Math.min(i, this.meta.openTabs.length - 1)];
      this.activePath = null;
      if (next) this.openFile(next);
      else { this.meta.activePath = null; this.showWelcome(); }
    }
    this.renderTabs();
    this.saveMeta();
  }

  showWelcome() {
    const w = this.$('#cpg-welcome');
    this.$('#cpg-editor-host').hidden = true;
    this.$('#cpg-media-view').hidden = true;
    w.hidden = false;
    w.innerHTML = `<div class="cpg-welcome-inner"><h2>${esc(this.meta.name)}</h2><p>Open a file from the Explorer, or:</p>
      <button type="button" class="cpg-btn" data-w="new">New file</button>
      <button type="button" class="cpg-btn" data-w="palette">Command palette</button>
      <button type="button" class="cpg-btn" data-w="terminal">Open terminal</button>
      <p class="cpg-dim">${MOD}+P to open a file · ${MOD}+Shift+P for commands · ${MOD}+\` for the terminal</p></div>`;
    w.onclick = (e) => {
      const b = e.target.closest('[data-w]');
      if (!b) return;
      if (b.dataset.w === 'new') this.addItem('file');
      if (b.dataset.w === 'palette') this.openPalette('>');
      if (b.dataset.w === 'terminal') { this.togglePanel(true); this.activeSession()?.view.focus(); }
    };
    this.renderBreadcrumbs();
    this.renderLangSelect();
  }

  renderTabs() {
    const bar = this.$('#cpg-tabs-bar');
    const names = new Map();
    for (const p of this.meta.openTabs) names.set(basename(p), (names.get(basename(p)) || 0) + 1);
    bar.innerHTML = this.meta.openTabs.map((p) => {
      const active = p === this.activePath;
      const dup = names.get(basename(p)) > 1;
      const diag = this.fileDiagnostics(p);
      const hasErr = diag.some((d) => d.severity === 'error');
      return `<div class="cpg-tab ide-tab${active ? ' active' : ''}${hasErr ? ' has-error' : ''}" role="tab" aria-selected="${active}" data-path="${esc(p)}" data-id="${esc(p)}" title="${esc(p)}" draggable="true">
        ${fileIcon(p)}<span class="cpg-tab-name">${esc(basename(p))}</span>${dup ? `<span class="cpg-dim cpg-tab-dir">${esc(dirname(p) || '/')}</span>` : ''}
        <button type="button" class="cpg-tab-close ide-tab-close" data-close="${esc(p)}" title="Close (${MOD}+W)" aria-label="Close ${esc(basename(p))}">×</button>
      </div>`;
    }).join('');
    if (!bar.dataset.bound) {
      bar.dataset.bound = '1';
      bar.addEventListener('click', (e) => {
        const close = e.target.closest('[data-close]');
        if (close) { e.stopPropagation(); this.closeTab(close.dataset.close); return; }
        const t = e.target.closest('.cpg-tab');
        if (t) this.openFile(t.dataset.path);
      });
      bar.addEventListener('auxclick', (e) => { const t = e.target.closest('.cpg-tab'); if (t && e.button === 1) this.closeTab(t.dataset.path); });
      bar.addEventListener('contextmenu', (e) => {
        const t = e.target.closest('.cpg-tab');
        if (!t) return;
        e.preventDefault();
        const p = t.dataset.path;
        this.contextMenu(e.clientX, e.clientY, [
          { label: 'Close', run: () => this.closeTab(p) },
          { label: 'Close Others', run: () => { for (const x of [...this.meta.openTabs]) if (x !== p) this.closeTab(x); } },
          { label: 'Close All', run: () => { for (const x of [...this.meta.openTabs]) this.closeTab(x); } },
          '-',
          { label: 'Reveal in Explorer', run: () => { this.selectedTreePath = p; this.showSidePanel('explorer'); this.renderTree(); } },
          { label: 'Copy Path', run: () => navigator.clipboard?.writeText(p) },
        ], basename(p));
      });
      let dragFrom = null;
      bar.addEventListener('dragstart', (e) => { const t = e.target.closest('.cpg-tab'); dragFrom = t?.dataset.path || null; });
      bar.addEventListener('dragover', (e) => { if (dragFrom) e.preventDefault(); });
      bar.addEventListener('drop', (e) => {
        const t = e.target.closest('.cpg-tab');
        if (!dragFrom || !t) return;
        e.preventDefault();
        const tabs = this.meta.openTabs;
        const from = tabs.indexOf(dragFrom);
        const to = tabs.indexOf(t.dataset.path);
        tabs.splice(to, 0, tabs.splice(from, 1)[0]);
        dragFrom = null;
        this.renderTabs();
        this.saveMeta();
      });
    }
    bar.querySelector('.cpg-tab.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (this.activePath) this.$('#cpg-welcome').hidden = true;
  }

  renderBreadcrumbs() {
    const el = this.$('#cpg-breadcrumbs');
    if (!this.activePath) { el.innerHTML = ''; return; }
    const parts = this.activePath.split('/');
    el.innerHTML = parts.map((p, i) => `<span class="${i === parts.length - 1 ? 'cpg-bc-file' : ''}">${esc(p)}</span>`).join('<span class="cpg-bc-sep">›</span>');
  }

  onEditorChange(path, value) {
    this.fromEditor = path;
    try { this.vfs.writeFile(path, value); } catch (err) { this.toast(err.message); }
    this.fromEditor = null;
  }

  onCursor(pos, sel) {
    const el = this.$('#cpg-status-pos');
    if (el) el.textContent = `Ln ${pos.line}, Col ${pos.ch}${sel ? ` (${sel} selected)` : ''}`;
    this.cursor = pos;
  }

  /* ---------------- file system events ---------------- */

  onFsChange(e) {
    if (['create', 'delete', 'rename', 'mkdir', 'reset'].includes(e.type)) this.structureChanged = true;
    if (e.type === 'rename') {
      // keep tabs pointing at moved files
      const map = (p) => (p === e.from ? e.path : p.startsWith(`${e.from}/`) ? e.path + p.slice(e.from.length) : p);
      this.meta.openTabs = this.meta.openTabs.map((p) => { const n = map(p); if (n !== p) this.editor.rename(p, n); return n; });
      if (this.activePath) { const n = map(this.activePath); if (n !== this.activePath) { this.activePath = n; this.meta.activePath = n; } }
      this.pendingPaths.add(e.from);
    }
    if (e.type === 'delete' || e.type === 'reset') {
      for (const p of [...this.meta.openTabs]) if (!this.vfs.isFile(p)) { this.meta.openTabs = this.meta.openTabs.filter((x) => x !== p); this.editor.close(p); if (this.activePath === p) this.activePath = null; }
    }
    this.pendingPaths.add(e.path);
    if (e.type === 'change' || e.type === 'create') {
      if (this.fromEditor !== e.path && this.meta.openTabs.includes(e.path) && this.vfs.isFile(e.path) && !isBinaryPath(e.path)) {
        this.editor.updateContent(e.path, this.vfs.readFile(e.path));
      }
    }
    clearTimeout(this.fsTimer);
    this.fsTimer = setTimeout(() => this.flushFsChanges(), 60);
  }

  flushFsChanges() {
    if (!this.alive) return;
    const paths = [...this.pendingPaths];
    this.pendingPaths.clear();
    if (this.structureChanged) {
      this.structureChanged = false;
      this.renderTree();
      this.renderTabs();
      if (!this.activePath) { const next = this.meta.openTabs[0]; if (next) this.openFile(next, { focus: false }); else this.showWelcome(); }
      this.saveMeta();
    }
    this.preview?.filesChanged(paths);
    if (paths.some((p) => /\.(m?[jt]sx?|json)$/.test(p))) this.scheduleTsCheck();
    if (this.root.dataset.sidebar === 'scm' && !this.root.classList.contains('cpg-no-sidebar')) { clearTimeout(this.scmTimer); this.scmTimer = setTimeout(() => this.gitPanel.render(), 400); }
    clearTimeout(this.badgeTimer);
    this.badgeTimer = setTimeout(() => this.updateScmBadge(), 600);
    this.setSaveState('saving');
  }

  /* ---------------- terminals ---------------- */

  newTerminal({ focus = false, name = null, cwd = null } = {}) {
    const s = new TerminalSession(this, { name: name || (this.sessions.length ? `bash ${this.sessions.length + 1}` : 'bash'), cwd: cwd ?? (this.activeSession()?.shell.cwd || '') });
    this.sessions.push(s);
    this.$('#cpg-pane-terminal').appendChild(s.el);
    if (this.sessions.length === 1) {
      s.view.writeln(`\x1b[1mCode Playground terminal\x1b[0m \x1b[90m· runs in your browser · type \x1b[0mhelp\x1b[90m for commands\x1b[0m`);
    }
    this.setActiveSession(s);
    if (focus) { this.togglePanel(true); this.showPanelTab('terminal'); setTimeout(() => s.view.focus(), 30); }
    return s;
  }

  setActiveSession(s) {
    this.activeSessionId = s.id;
    for (const x of this.sessions) x.el.hidden = x !== s;
    this.renderTermTabs();
  }

  activeSession() { return this.sessions.find((s) => s.id === this.activeSessionId) || this.sessions[0]; }
  mainSession() { return this.sessions[0]; }

  renderTermTabs() {
    const el = this.$('#cpg-term-tabs');
    if (!el) return;
    el.innerHTML = this.sessions.length > 1 ? this.sessions.map((s) => `<button type="button" class="cpg-term-tab${s.id === this.activeSessionId ? ' active' : ''}" data-sid="${s.id}" title="${esc(s.current?.cmd || s.name)}">${s.current ? '● ' : ''}${esc(s.name)}</button>`).join('') : '';
    el.onclick = (e) => {
      const b = e.target.closest('[data-sid]');
      if (!b) return;
      const s = this.sessions.find((x) => x.id === b.dataset.sid);
      if (s) { this.setActiveSession(s); this.showPanelTab('terminal'); s.view.focus(); }
    };
  }

  killTerminal() {
    const s = this.activeSession();
    if (!s) return;
    s.dispose();
    this.sessions = this.sessions.filter((x) => x !== s);
    if (!this.sessions.length) this.newTerminal();
    else this.setActiveSession(this.sessions[this.sessions.length - 1]);
  }

  sessionStateChanged() {
    const running = this.mainSession()?.busy();
    const runBtn = this.$('#cpg-run');
    runBtn?.classList.toggle('is-stop', Boolean(running));
    const label = runBtn?.querySelector('.cpg-run-label');
    if (label) label.textContent = running ? 'Stop' : 'Run';
    const act = this.activeSession();
    this.$('#cpg-proc-status').hidden = !act?.busy();
    this.$('#cpg-proc-stop-btn').hidden = !act?.busy();
    this.renderTermTabs();
  }

  async runInTerminal(line, { session = null, focus = false, interrupt = false } = {}) {
    let s = session || this.activeSession();
    if (!s) s = this.newTerminal();
    if (s.busy()) {
      if (interrupt) { s.interrupt(); await waitFor(() => !s.busy(), 3000); }
      if (s.busy()) { s = this.sessions.find((x) => !x.busy()) || this.newTerminal({ name: `bash ${this.sessions.length + 1}` }); }
    }
    this.togglePanel(true);
    this.showPanelTab('terminal');
    this.setActiveSession(s);
    if (focus) setTimeout(() => s.view.focus(), 30);
    return s.run(line);
  }

  stopMain() { this.mainSession()?.interrupt(); }

  processList() {
    const list = [];
    this.sessions.forEach((s, i) => { if (s.current) list.push({ pid: s.current.pid, cmd: s.current.cmd, tty: i }); });
    for (const [port, srv] of this.servers) list.push({ pid: srv.pid, cmd: `server :${port}`, tty: this.sessions.indexOf(srv.session) });
    return list;
  }

  killProcess(target) {
    const t = String(target);
    if (t.startsWith(':')) { const srv = this.servers.get(Number(t.slice(1))); if (!srv) return false; srv.proc.kill(); srv.session.interrupt(); return true; }
    const pid = Number(t.replace(/^%/, ''));
    const s = this.sessions.find((x) => x.current && (x.current.pid === pid || String(this.sessions.indexOf(x) + 1) === t.replace(/^%/, '')));
    if (s) { s.interrupt(); return true; }
    for (const [port, srv] of this.servers) if (srv.pid === pid) { srv.proc.kill(); this.unregisterServer(port); return true; }
    return false;
  }

  /* ---------------- servers ---------------- */

  registerServer(port, proc, session) {
    this.servers.set(port, { proc, session, pid: ++pidSeq });
    session.view.writeln(`\x1b[90m➜ Your server is running in the browser. Open it in the Preview, or run \x1b[0mcurl localhost:${port}\x1b[90m in another terminal (${MOD}+Shift+\`).\x1b[0m`);
    if (!this.preview.state || this.preview.state.kind !== 'server' || this.preview.state.port === port) this.openPreview({ port, path: this.preview.state?.kind === 'server' ? this.preview.state.path : '/' });
  }

  unregisterServer(port) {
    this.servers.delete(port);
    this.preview?.serverStopped(port);
  }

  unregisterServersOf(proc) {
    for (const [port, srv] of [...this.servers]) if (srv.proc === proc) this.unregisterServer(port);
  }

  requestServer(port, req) {
    const srv = this.servers.get(Number(port));
    if (!srv) return Promise.resolve({ status: 502, headers: { 'content-type': 'text/plain' }, body: `Nothing is listening on port ${port}.` });
    const id = ++this.serverSeq;
    return new Promise((resolve) => {
      this.serverWaiters.set(id, resolve);
      srv.proc.post({ type: 'http-request', id, port: Number(port), method: req.method || 'GET', url: req.url || '/', headers: req.headers || {}, body: req.body ?? null });
      setTimeout(() => { if (this.serverWaiters.has(id)) { this.serverWaiters.delete(id); resolve({ status: 504, headers: { 'content-type': 'text/plain' }, body: 'The server did not respond within 30 seconds. Does every route call res.send() / res.json() / res.end()?' }); } }, 30000);
    });
  }

  resolveServerResponse(m) {
    const w = this.serverWaiters.get(m.id);
    if (w) { this.serverWaiters.delete(m.id); w(m); }
  }

  /* ---------------- run ---------------- */

  isBrowserScript(path) {
    if (!/\.(m?js|ts)$/.test(path)) return false;
    const text = this.vfs.readFile(path);
    for (const h of this.vfs.listFiles().filter((f) => /\.html?$/.test(f))) {
      const html = this.vfs.readFile(h);
      if (html.includes(basename(path)) && /<script[^>]+src=/i.test(html)) {
        const re = /<script[^>]+src=["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(html))) {
          const src = m[1];
          if (/^https?:/.test(src)) continue;
          const resolved = normalize(src.startsWith('/') ? src : `${dirname(h)}/${src}`);
          if (resolved === path) return true;
        }
      }
    }
    const browserish = /\b(document\.|window\.|localStorage|querySelector|addEventListener\s*\(\s*['"](click|DOMContentLoaded|load|submit|keydown))/.test(text);
    const nodeish = /\brequire\s*\(|\bprocess\.|from ['"](fs|path|readline|http|express|node:)/.test(text);
    if (browserish && !nodeish) return Boolean(this.preview.targetForFile(path));
    return false;
  }

  async runActive({ previewOnly = false } = {}) {
    const path = this.activePath;
    if (!path) { if (!previewOnly) this.runProject(); return; }
    const lang = languageOf(path);
    const info = langInfo(lang);
    const webFile = ['html', 'css', 'svg', 'scss', 'vue'].includes(lang) || info.runner === 'markdown' || ((lang === 'jsx' || lang === 'tsx') && !/\.(test|spec)\./.test(path)) || this.isBrowserScript(path);
    if (webFile) {
      const target = this.preview.targetForFile(path);
      if (target) { await this.openPreview(target); if (this.isMobile()) this.setMobileView('preview'); return; }
    }
    if (previewOnly) return;
    if (info.runner === null) { this.toast(`${info.name} files don’t run on their own. Open a program file (.js, .py, .cpp…) or an .html page.`); return; }
    const s = this.mainSession();
    const cmd = runCommandFor(this.vfs, path, s.shell.cwd);
    if (!cmd) { this.toast(`Don't know how to run ${basename(path)}`); return; }
    if (cmd.startsWith('preview')) { this.openPreview({ file: path }); return; }
    this.$('#cpg-stdin-wrap').hidden = true;
    if (this.isMobile()) this.setMobileView('terminal');
    const started = performance.now();
    this.setTiming('');
    const res = await this.runInTerminal(cmd, { session: s, interrupt: true, focus: true });
    this.setTiming(res?.code === 130 ? 'stopped' : `exit ${res?.code ?? 0} · ${formatMs(performance.now() - started)}`);
  }

  async runProject() {
    const s = this.mainSession();
    const root = this.devRoot();
    const p = detectProject(this.vfs, root);
    const scripts = p.pkg?.scripts || {};
    let cmd = null;
    if (p.isWeb && (scripts.dev || !p.isServer)) {
      if (scripts.dev && /vite|next|parcel|webpack|serve/.test(scripts.dev)) cmd = 'npm run dev';
      else { await this.openPreview({ root, path: '/index.html' }); if (this.isMobile()) this.setMobileView('preview'); return; }
    } else if (scripts.start) cmd = 'npm start';
    else if (scripts.dev) cmd = 'npm run dev';
    else if (p.node) cmd = `node ${quoteArg(p.node)}`;
    else if (p.python) cmd = `python ${quoteArg(p.python)}`;
    else if (p.cpp) cmd = runCommandFor(this.vfs, p.cpp, s.shell.cwd);
    else if (p.html) { await this.openPreview({ file: p.html }); return; }
    if (!cmd) return this.runActive();
    if (this.isMobile()) this.setMobileView('terminal');
    return this.runInTerminal(cmd, { session: s, interrupt: true, focus: true });
  }

  devRoot() {
    let d = this.activePath ? dirname(this.activePath) : '';
    for (;;) {
      if (this.vfs.isFile(d ? `${d}/package.json` : 'package.json') || this.vfs.isFile(d ? `${d}/index.html` : 'index.html')) return d;
      if (!d) return '';
      d = dirname(d);
    }
  }

  async runTests(file = null) {
    const f = file && /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.py$/.test(file) ? file : null;
    let cmd;
    if (f) cmd = /\.py$/.test(f) ? `pytest ${quoteArg(f)}` : `npx vitest run ${quoteArg(f)}`;
    else {
      const js = findTestFiles(this.vfs).length;
      const py = pythonTestFiles(this.vfs).length;
      if (!js && !py) { this.toast('No test files found. Create one with + → Test File.'); this.addItem('test'); return; }
      const pkg = detectProject(this.vfs, '').pkg;
      cmd = js ? (pkg?.scripts?.test ? 'npm test' : 'npx vitest run') : 'pytest';
      if (js && py) cmd = `${cmd}; pytest`;
    }
    if (this.isMobile()) this.setMobileView('terminal');
    return this.runInTerminal(cmd, { session: this.mainSession(), interrupt: true, focus: true });
  }

  testReport(results) {
    const failed = [];
    for (const f of results.files || []) for (const t of f.tests) if (t.status === 'fail' && t.error?.file) failed.push({ file: t.error.file, line: t.error.line || 1, column: t.error.column || 1, message: `${t.name}: ${t.error.message}`, severity: 'error' });
    this.setDiagnostics('tests', failed);
  }

  async testInBrowser() {
    const target = this.activePath ? this.preview.targetForFile(this.activePath) : null;
    await this.openPreview(target || { root: '', path: '/index.html' });
    await this.preview.waitReady(3000);
    const snap = await this.preview.snapshot();
    const errors = this.preview.logs.filter((l) => l.level === 'error');
    this.showPanelTab('output');
    this.togglePanel(true);
    this.consoleLine({ level: errors.length ? 'error' : 'info', text: snap ? `Browser test: page “${snap.title || 'untitled'}” rendered ${snap.text.length} characters of text, ${snap.buttons?.length || 0} buttons, ${snap.inputs?.length || 0} inputs; ${errors.length} error${errors.length === 1 ? '' : 's'}.` : 'Browser test: the page did not respond.', source: 'test' });
  }

  /* ---------------- preview ---------------- */

  async openPreview(target = {}) {
    let t = target;
    if (t.file) t = this.preview.targetForFile(t.file) || { kind: 'static', root: dirname(t.file), path: `/${basename(t.file)}` };
    else if (t.port) t = { kind: 'server', port: Number(t.port), path: t.path || '/' };
    else if (!t.kind) {
      const root = t.root ?? this.devRoot();
      t = { kind: 'static', root, path: t.path || '/index.html' };
      if (!this.vfs.isFile(normalize(`${root}/${t.path}`))) {
        const html = this.vfs.listFiles(root).find((f) => /\.html?$/.test(f));
        if (html) t = { kind: 'static', root: dirname(html), path: `/${basename(html)}` };
      }
    }
    this.togglePreview(true, { noRender: true });
    await this.preview.show(t);
  }

  togglePreview(force, { noRender = false } = {}) {
    const pane = this.$('#cpg-preview-pane');
    const show = typeof force === 'boolean' ? force : pane.hidden;
    pane.hidden = !show;
    this.root.classList.toggle('cpg-has-preview', show);
    this.$('#cpg-top-preview-btn').classList.toggle('active', show);
    if (show && !noRender && !this.preview.state) {
      const t = (this.activePath && this.preview.targetForFile(this.activePath)) || (this.servers.size ? { kind: 'server', port: [...this.servers.keys()][0], path: '/' } : null);
      if (t) this.preview.show(t);
      else {
        const html = this.vfs.listFiles().find((f) => /\.html?$/.test(f));
        if (html) this.preview.show({ kind: 'static', root: dirname(html), path: `/${basename(html)}` });
        else this.$('#cpg-preview').srcdoc = '<!DOCTYPE html><body style="font:14px system-ui;color:#64748b;display:grid;place-items:center;height:90vh;margin:0;text-align:center">Nothing to preview yet.<br>Create an <b>index.html</b>, open a Markdown file, or start a server (node server.js).</body>';
      }
    }
    setTimeout(() => this.editor.refresh(), 20);
  }

  navigatePreview(value) {
    const v = String(value || '').trim();
    const m = /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1):(\d+)(\/.*)?$/.exec(v);
    if (m) { this.preview.show({ kind: 'server', port: Number(m[1]), path: m[2] || '/' }); return; }
    const p = normalize(v.replace(/^\/?workspace\//, ''));
    if (this.vfs.isFile(p)) { this.openPreview({ file: p }); return; }
    if (this.vfs.isDir(p)) { this.openPreview({ root: p, path: '/index.html' }); return; }
    const s = this.preview.state;
    if (s?.kind === 'static') this.preview.show({ kind: 'static', root: s.root, path: `/${v.replace(/^\//, '')}` });
  }

  onPreviewState(s) {
    const url = this.$('#cpg-preview-url');
    if (url && document.activeElement !== url && s.address !== undefined) url.value = s.address;
    this.$('#cpg-preview-pane').dataset.status = s.status || '';
  }

  setDevServer(root, on) {
    this.devServer = on ? root : null;
    if (on) this.openPreview({ root, path: '/index.html' });
  }

  onBrowserConsole(entry) {
    this.consoleLine(entry);
    if (entry.level === 'error' && entry.source === 'browser') {
      const list = (this.diagnostics.get('browser') || []).slice(-30);
      if (entry.file && entry.line) list.push({ file: entry.file.replace(/^\//, ''), line: entry.line, column: entry.column || 1, message: entry.text, severity: 'error' });
      this.setDiagnostics('browser', list);
    }
  }

  consoleLine(entry) {
    const el = this.$('#cpg-console');
    if (!el) return;
    const div = document.createElement('div');
    div.className = `cpg-console-line is-${entry.level || 'log'}`;
    const where = entry.file ? `<span class="cpg-dim cpg-console-src" data-file="${esc(entry.file.replace(/^\//, ''))}" data-line="${entry.line || 1}">${esc(entry.file.replace(/^\//, ''))}:${entry.line || ''}</span>` : '';
    div.innerHTML = `<span class="cpg-console-level">${{ error: '⊗', warn: '⚠', info: 'ℹ' }[entry.level] || '›'}</span><span class="cpg-console-text">${esc(entry.text)}</span>${where}`;
    el.appendChild(div);
    while (el.children.length > 800) el.firstChild.remove();
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
    this.consoleCount = (this.consoleCount || 0) + (entry.level === 'error' ? 1 : 0);
    this.updateConsoleCount(this.consoleCount);
  }

  updateConsoleCount(n) {
    this.consoleCount = n;
    const b = this.$('#cpg-console-count');
    if (b) { b.hidden = !n; b.textContent = String(n); }
  }

  async buildStatic(root, out) {
    const r = normalize(root);
    const source = staticSource(this.vfs, r);
    if (!(await source.fetch('/index.html'))) return null;
    const { html } = await buildPreview({ source, path: '/index.html', vfs: this.vfs, channel: 'static-build' });
    this.vfs.writeFile(normalize(`${out}/index.html`), html.replace(/<script>\(function\(\)\{\s*var CH=[\s\S]*?\}\)\(\);<\/script>/, ''));
    return { files: 1 };
  }

  /* ---------------- problems ---------------- */

  setDiagnostics(source, list) {
    this.diagnostics.set(source, (list || []).map((d) => ({ ...d, file: d.file ? normalize(String(d.file).replace(/^\/?workspace\//, '')) : d.file, source })));
    clearTimeout(this.diagTimer);
    this.diagTimer = setTimeout(() => this.renderProblems(), 30);
  }

  allDiagnostics() { return [...this.diagnostics.values()].flat().filter((d) => d.file); }

  fileDiagnostics(path) { return this.allDiagnostics().filter((d) => d.file === path); }

  refreshEditorDiagnostics() {
    if (!this.editor) return;
    for (const p of this.meta.openTabs) this.editor.setDiagnostics(p, this.fileDiagnostics(p));
  }

  renderProblems() {
    const all = this.allDiagnostics();
    const errors = all.filter((d) => d.severity === 'error').length;
    const warns = all.length - errors;
    const badge = this.$('#cpg-problems-count');
    if (badge) { badge.hidden = !all.length; badge.textContent = String(all.length); }
    const st = this.$('#cpg-status-problems');
    if (st) st.innerHTML = `<span class="cpg-err">⊗ ${errors}</span> <span class="cpg-warn">⚠ ${warns}</span>`;
    const byFile = new Map();
    for (const d of all) { if (!byFile.has(d.file)) byFile.set(d.file, []); byFile.get(d.file).push(d); }
    const el = this.$('#cpg-problems-content');
    if (el) {
      el.innerHTML = all.length ? [...byFile].map(([f, list]) => `<div class="cpg-prob-file">${fileIcon(f)}<b>${esc(basename(f))}</b> <span class="cpg-dim">${esc(dirname(f))}</span> <span class="cpg-badge">${list.length}</span></div>${list.sort((a, b) => a.line - b.line).map((d) => `<div class="cpg-prob-row is-${d.severity}" data-file="${esc(f)}" data-line="${d.line}" data-col="${d.column || 1}"><span class="cpg-prob-ico">${d.severity === 'error' ? '⊗' : '⚠'}</span><span class="cpg-prob-msg">${esc(d.message)}</span><span class="cpg-dim">${d.source && d.source !== 'run' ? `${esc(d.source)} ` : ''}[Ln ${d.line}, Col ${d.column || 1}]</span></div>`).join('')}`).join('') : 'No problems have been detected in the workspace.';
    }
    this.refreshEditorDiagnostics();
    this.renderTabs();
  }

  async checkProblems() {
    this.togglePanel(true);
    this.showPanelTab('problems');
    const p = this.activePath;
    if (p && /\.(m?[jt]sx?)$/.test(p)) { await this.ensureTs(); await this.runTsCheck(true); }
    else if (p && /\.py$/.test(p)) await this.runInTerminal(`python -c "import ast,sys; ast.parse(open(${JSON.stringify(p)}).read(), ${JSON.stringify(p)}); print('No syntax errors in ${p}')"`, { session: this.mainSession() });
    else if (p && /\.(c|cpp|cc|h|hpp)$/.test(p)) { const cmd = runCommandFor(this.vfs, p, ''); this.toast('C/C++ problems are reported when you build and run.'); if (cmd) await this.runInTerminal(cmd, { session: this.mainSession(), interrupt: true }); }
    else this.toast('Syntax and type checking is available for JavaScript, TypeScript and Python.');
  }

  /* ---------------- TypeScript service ---------------- */

  ensureTs() {
    if (!this.tsStarted) {
      this.tsStarted = true;
      this.ts.start();
      this.scheduleTsCheck();
    }
    return this.ts.sync(this.vfs);
  }

  scheduleTsCheck() {
    if (!this.tsStarted) return;
    clearTimeout(this.tsTimer);
    this.tsTimer = setTimeout(() => this.runTsCheck(), 700);
  }

  async runTsCheck(all = false) {
    if (!this.tsStarted) return;
    await this.ts.sync(this.vfs);
    const targets = all ? this.vfs.listFiles().filter((p) => /\.(m?[jt]sx?)$/.test(p) && !/(^|\/)(node_modules|dist)\//.test(p)) : this.meta.openTabs.filter((p) => /\.(m?[jt]sx?)$/.test(p));
    try {
      const diags = await this.ts.call('diagnostics', { files: targets }, 30000);
      this.setDiagnostics('ts', diags);
    } catch { /* service unavailable: ignore */ }
  }

  async completions(path, offset) {
    await this.ensureTs();
    this.ts.synced.delete(path);
    await this.ts.sync(this.vfs);
    return this.ts.call('completions', { file: path, offset }, 8000);
  }

  async quickInfo(path, offset) {
    if (!this.tsStarted) return null;
    return this.ts.call('quickinfo', { file: path, offset }, 5000);
  }

  async typeCheck(files, { emit = true, outDir = null } = {}) {
    await this.ensureTs();
    await this.ts.sync(this.vfs);
    if (emit) {
      const res = await this.ts.call('emit', { files, outDir }, 60000);
      for (const [p, text] of Object.entries(res.files || {})) this.vfs.writeFile(p, text);
      this.setDiagnostics('ts', res.diagnostics);
      return { diagnostics: res.diagnostics, emitted: Object.keys(res.files || {}) };
    }
    const diagnostics = await this.ts.call('diagnostics', { files }, 60000);
    this.setDiagnostics('ts', diagnostics);
    return { diagnostics: diagnostics.filter((d) => d.severity === 'error'), emitted: [] };
  }

  /* ---------------- formatting ---------------- */

  async loadPrettier(parserPlugins) {
    const base = '/vendor/prettier/';
    const load = (name) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-prettier="${name}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = `${base}${name}.js`;
      s.dataset.prettier = name;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Could not load the formatter (${name})`));
      document.head.appendChild(s);
    });
    await load('standalone');
    for (const p of parserPlugins) await load(p);
    return window.prettier;
  }

  async formatSource(path, src) {
    const lang = languageOf(path);
    const map = {
      javascript: ['babel', ['babel', 'estree']], jsx: ['babel', ['babel', 'estree']],
      typescript: ['typescript', ['typescript', 'estree']], tsx: ['typescript', ['typescript', 'estree']],
      json: ['json', ['babel', 'estree']], css: ['css', ['postcss']], scss: ['scss', ['postcss']],
      html: ['html', ['html', 'postcss', 'babel', 'estree']], vue: ['vue', ['html', 'postcss', 'babel', 'estree']],
      markdown: ['markdown', ['markdown']], yaml: ['yaml', ['yaml']],
    };
    const cfg = map[lang];
    if (!cfg) return null;
    const prettier = await this.loadPrettier(cfg[1]);
    const plugins = Object.values(window.prettierPlugins || {});
    return prettier.format(src, { parser: cfg[0], plugins, singleQuote: true, tabWidth: 2, printWidth: 100 });
  }

  async formatDocument() {
    const p = this.activePath;
    if (!p || isBinaryPath(p)) return;
    const lang = languageOf(p);
    try {
      const out = await this.formatSource(p, this.vfs.readFile(p));
      if (out != null) {
        if (out !== this.vfs.readFile(p)) this.editor.updateContent(p, out);
        this.vfs.writeFile(p, out);
        this.toast('Formatted');
        return;
      }
      if (['cpp', 'c', 'header', 'java', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala', 'sql', 'lua'].includes(lang)) {
        this.editor.exec('indentAll');
        this.toast('Re-indented');
        return;
      }
      this.toast(`Formatting isn't available for ${langInfo(lang).name}.`);
    } catch (err) {
      this.toast(`Couldn't format: ${String(err.message || err).split('\n')[0]}`);
    }
  }

  /* ---------------- language picker ---------------- */

  renderLangSelect() {
    const sel = this.$('#cpg-langs');
    if (!sel) return;
    const cur = this.activePath ? languageOf(this.activePath) : '';
    const groups = pickerGroups();
    const known = new Set(groups.flatMap((g) => g.ids));
    sel.innerHTML = `${cur && !known.has(cur) ? `<option value="${cur}">${esc(LANGS[cur]?.name || cur)}</option>` : ''}${groups.map((g) => `<optgroup label="${esc(g.label)}">${g.ids.map((id) => `<option value="${id}">${esc(LANGS[id].name)}</option>`).join('')}</optgroup>`).join('')}`;
    sel.value = cur || 'text';
    const isC = ['cpp', 'c', 'header'].includes(cur);
    this.$('#cpg-cpp-engine').hidden = !isC;
    const stdin = this.$('#cpg-stdin-wrap');
    if (stdin) stdin.hidden = true;
    const spaces = this.$('#cpg-status-spaces');
    if (spaces) spaces.textContent = `Spaces: ${['python', 'java', 'csharp', 'cpp', 'c', 'header', 'go', 'rust', 'php'].includes(cur) ? 4 : 2}`;
    const note = this.$('#cpg-note');
    if (note && !this.noteLocked) {
      const info = langInfo(cur);
      note.textContent = info.runner === 'remote' ? `${info.name} is compiled on Wandbox (code is sent to wandbox.org)` : cur === 'python' ? 'Python 3 (Pyodide) · runs in your browser' : isC ? 'C/C++: in-browser interpreter or g++ (see engine)' : '';
    }
  }

  async changeLanguage(id) {
    const p = this.activePath;
    const ext = DEFAULT_EXT[id] || '.txt';
    if (!p) {
      const name = `main${ext}`;
      let path = name;
      let n = 2;
      while (this.vfs.exists(path)) path = `main${n++}${ext}`;
      this.vfs.writeFile(path, starterFor(path));
      this.openFile(path);
      return;
    }
    if (languageOf(p) === id) return;
    const stem = p.slice(0, p.length - extname(p).length);
    let to = `${stem}${ext}`;
    if (this.vfs.exists(to)) { this.toast(`${basename(to)} already exists`); this.renderLangSelect(); return; }
    const content = this.vfs.readFile(p);
    this.vfs.rename(p, to);
    if (!content.trim()) this.vfs.writeFile(to, starterFor(to));
    this.toast(`Renamed to ${basename(to)} (${LANGS[id]?.name || id})`);
    this.openFile(to);
  }

  insertExample() {
    const p = this.activePath;
    if (!p) { this.addItem('file'); return; }
    const sample = exampleFor(p);
    if (!sample) { this.toast('No example for this file type.'); return; }
    this.vfs.writeFile(p, sample);
    this.toast('Example code inserted (undo with Ctrl+Z)');
  }

  /* ---------------- bottom panel ---------------- */

  togglePanel(force) {
    const hidden = this.root.classList.contains('cpg-no-panel');
    const show = typeof force === 'boolean' ? force : hidden;
    this.root.classList.toggle('cpg-no-panel', !show);
    if (show && this.panelTab === 'terminal') setTimeout(() => this.activeSession()?.view.focus(), 30);
    setTimeout(() => this.editor.refresh(), 20);
  }

  showPanelTab(tab) {
    this.panelTab = tab;
    this.$$('.cpg-drawer-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    this.$('#cpg-pane-terminal').hidden = tab !== 'terminal';
    this.$('#cpg-pane-problems').hidden = tab !== 'problems';
    this.$('#cpg-pane-output').hidden = tab !== 'output';
    this.$('#cpg-term-tabs').hidden = tab !== 'terminal';
    if (tab === 'terminal') setTimeout(() => this.activeSession()?.view.focus(), 20);
    if (tab === 'output') this.updateConsoleCount(0);
  }

  clearPanel() {
    if (this.panelTab === 'output') { this.$('#cpg-console').innerHTML = ''; this.updateConsoleCount(0); return; }
    if (this.panelTab === 'problems') { this.diagnostics.clear(); this.renderProblems(); return; }
    this.activeSession()?.view.clear();
  }

  setTiming(t) { const el = this.$('#cpg-timing'); if (el) el.textContent = t; }

  /* ---------------- splitters ---------------- */

  startSplit(e, kind) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const p = this.prefs;
    const start = { sidebar: p.sidebarWidth, panel: p.panelHeight, preview: p.previewWidth, assistant: p.assistantWidth };
    const center = this.$('#cpg-center-split').getBoundingClientRect();
    const main = this.$('.cpg-main').getBoundingClientRect();
    this.root.classList.add('is-resizing');
    const move = (ev) => {
      if (kind === 'sidebar') p.sidebarWidth = clamp(start.sidebar + ev.clientX - startX, 160, 520);
      else if (kind === 'panel') p.panelHeight = clamp(start.panel - (ev.clientY - startY), 80, main.height - 120);
      else if (kind === 'preview') p.previewWidth = clamp((center.right - ev.clientX) / center.width, 0.2, 0.8);
      else if (kind === 'assistant') p.assistantWidth = clamp(start.assistant - (ev.clientX - startX), 280, 640);
      this.applyLayoutPrefs();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.root.classList.remove('is-resizing');
      savePrefs(p);
      this.editor.refresh();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* ---------------- command palette ---------------- */

  commandList() {
    const menus = this.menuModel();
    const list = [];
    for (const m of Object.values(menus)) for (const it of m.items) if (it !== '-' && (!it.signedIn || this.o.signedIn)) list.push({ label: `${m.label}: ${it.label.replace(/…$/, '')}`, kbd: it.kbd, run: () => this.action(it.action) });
    list.push({ label: 'Terminal: Run Command…', run: () => this.action('run-terminal') });
    list.push({ label: 'Git: Initialize Repository', run: () => this.runInTerminal('git init', { focus: true }) });
    list.push({ label: 'Git: Commit All…', run: () => this.showSidePanel('scm') });
    list.push({ label: 'Git: Push', run: () => this.runInTerminal('git push', { focus: true }) });
    list.push({ label: 'Git: Pull', run: () => this.runInTerminal('git pull', { focus: true }) });
    list.push({ label: 'npm: Install Dependencies', run: () => this.runInTerminal('npm install', { focus: true }) });
    list.push({ label: 'Python: Start REPL', run: () => this.runInTerminal('python', { focus: true }) });
    list.push({ label: 'Node: Start REPL', run: () => this.runInTerminal('node', { focus: true }) });
    list.push({ label: 'C++ Engine: Auto', run: () => { this.$('#cpg-cpp-engine').value = 'auto'; this.$('#cpg-cpp-engine').dispatchEvent(new Event('change')); } });
    list.push({ label: 'C++ Engine: In-browser interpreter', run: () => { this.$('#cpg-cpp-engine').value = 'interpreter'; this.$('#cpg-cpp-engine').dispatchEvent(new Event('change')); } });
    list.push({ label: 'C++ Engine: g++ on Wandbox', run: () => { this.$('#cpg-cpp-engine').value = 'compiler'; this.$('#cpg-cpp-engine').dispatchEvent(new Event('change')); } });
    list.push({ label: 'Preferences: Increase Font Size', run: () => this.action('zoom-in') });
    list.push({ label: 'Preferences: Decrease Font Size', run: () => this.action('zoom-out') });
    list.push({ label: 'Editor: Fold All', run: () => this.editor.exec('foldAll') });
    list.push({ label: 'Editor: Unfold All', run: () => this.editor.exec('unfoldAll') });
    list.push({ label: 'Editor: Trigger Suggest', kbd: `${MOD}+Space`, run: () => this.editor.exec('complete') });
    return list;
  }

  openPalette(prefix = '') {
    const modal = this.$('#cpg-palette-modal');
    modal.hidden = false;
    const input = this.$('#cpg-palette-input');
    input.value = prefix;
    this.paletteIndex = 0;
    this.renderPalette();
    setTimeout(() => input.focus(), 0);
  }

  closePalette() { this.$('#cpg-palette-modal').hidden = true; if (!this.isMobile()) this.editor.focus(); }

  renderPalette() {
    const input = this.$('#cpg-palette-input');
    const raw = input.value;
    let items;
    if (raw.startsWith('>')) {
      const q = raw.slice(1).trim().toLowerCase();
      items = this.commandList().filter((c) => !q || fuzzyMatch(q, c.label.toLowerCase()));
    } else if (raw.startsWith(':')) {
      const n = parseInt(raw.slice(1), 10);
      items = [{ label: Number.isFinite(n) ? `Go to line ${n}` : 'Type a line number', run: () => Number.isFinite(n) && this.editor.goto(n) }];
    } else {
      const q = raw.trim().toLowerCase();
      items = this.vfs.listFiles().filter((f) => !/(^|\/)(node_modules|\.git)\//.test(f)).filter((f) => !q || fuzzyMatch(q, f.toLowerCase())).sort((a, b) => scoreMatch(q, b) - scoreMatch(q, a)).slice(0, 60).map((f) => ({ label: basename(f), detail: dirname(f), icon: fileIcon(f), run: () => this.openFile(f) }));
      if (!raw) items.unshift({ label: '> Show commands', detail: `${MOD}+Shift+P`, run: () => { input.value = '>'; this.renderPalette(); return 'keep'; } });
    }
    this.paletteItems = items;
    this.paletteIndex = Math.min(this.paletteIndex || 0, Math.max(0, items.length - 1));
    this.$('#cpg-palette-list').innerHTML = items.map((it, i) => `<div class="cpg-palette-item${i === this.paletteIndex ? ' active' : ''}" role="option" data-idx="${i}">${it.icon || ''}<span>${esc(it.label)}</span>${it.detail ? `<span class="cpg-dim">${esc(it.detail)}</span>` : ''}${it.kbd ? `<kbd class="cpg-kbd">${esc(it.kbd)}</kbd>` : ''}</div>`).join('') || '<div class="cpg-palette-item cpg-dim">No matches</div>';
  }

  onPaletteKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.paletteIndex = clamp(this.paletteIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, this.paletteItems.length - 1));
      this.renderPalette();
      this.$('#cpg-palette-list .active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); this.choosePalette(this.paletteIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); this.closePalette(); }
  }

  choosePalette(i) {
    const it = this.paletteItems?.[i];
    if (!it) return;
    const r = it.run();
    if (r !== 'keep') this.closePalette();
  }

  /* ---------------- modal / toast ---------------- */

  openModal(html, { wide = false } = {}) {
    const m = this.$('#cpg-modal');
    m.innerHTML = `<div class="cpg-modal-card${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-modal-close]')) this.closeModal(); };
    return m.firstElementChild;
  }

  closeModal() { const m = this.$('#cpg-modal'); m.hidden = true; m.innerHTML = ''; }

  openDiff({ title, diff, path }) {
    const card = this.openModal(`<div class="cpg-modal-head"><b>${esc(title)}</b><span>${path ? `<button type="button" class="cpg-btn-sm" data-open="${esc(path)}">Open file</button>` : ''}<button type="button" class="cpg-icon-btn" data-modal-close title="Close">✕</button></span></div><div class="cpg-diff">${diffHtml(diff)}</div>`, { wide: true });
    card.querySelector('[data-open]')?.addEventListener('click', () => { this.closeModal(); if (this.vfs.isFile(path)) this.openFile(path); });
  }

  showShortcuts() {
    const rows = [
      [`${MOD}+Enter`, 'Run the active file'], ['F5', 'Run the project'], ['Ctrl+C (terminal)', 'Stop the running program'],
      [`${MOD}+S`, 'Save (autosave is always on)'], [`${MOD}+P`, 'Go to file'], [`${MOD}+Shift+P`, 'Command palette'],
      [`${MOD}+Space`, 'Suggestions'], [`${MOD}+/`, 'Toggle comment'], ['Shift+Alt+F', 'Format document'],
      [`${MOD}+F / ${MOD}+H`, 'Find / replace'], [`${MOD}+Shift+F`, 'Search in all files'], [`${MOD}+G`, 'Go to line'],
      [`${MOD}+D`, 'Select next occurrence'], ['Alt+↑/↓', 'Move line'], ['Shift+Alt+↓', 'Duplicate line'],
      [`${MOD}+\``, 'Toggle terminal'], [`${MOD}+Shift+\``, 'New terminal'], [`${MOD}+B`, 'Toggle sidebar'],
      ['Tab (terminal)', 'Complete command or file name'], ['↑/↓ (terminal)', 'Command history'],
    ];
    this.openModal(`<div class="cpg-modal-head"><b>Keyboard shortcuts</b><button type="button" class="cpg-icon-btn" data-modal-close>✕</button></div><table class="cpg-kbd-table">${rows.map(([k, d]) => `<tr><td><kbd class="cpg-kbd">${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`);
  }

  showAbout() {
    this.openModal(`<div class="cpg-modal-head"><b>About Code Playground</b><button type="button" class="cpg-icon-btn" data-modal-close>✕</button></div>
      <div class="cpg-modal-body">
        <p>A complete development environment that runs in your browser. Your workspaces are saved on this device (IndexedDB).</p>
        <ul>
          <li><b>JavaScript / TypeScript</b> — Node.js APIs, npm packages (esm.sh), Express-style servers, tests (vitest/jest syntax), IntelliSense and type checking.</li>
          <li><b>Web</b> — HTML/CSS/JS, React, Vue and ES modules with live preview.</li>
          <li><b>Python 3</b> — Pyodide: input(), files, pip, pytest, numpy, pandas, matplotlib.</li>
          <li><b>C / C++</b> — JSCPP interpreter in the browser (interactive cin), or real g++ 13 on Wandbox.</li>
          <li><b>SQL</b> (SQLite), <b>Lua</b>, and Java, Go, Rust, C#, PHP, Ruby, Swift… compiled on Wandbox.</li>
          <li><b>Git</b> with push, pull and clone to GitHub.</li>
        </ul>
        <p class="cpg-dim">Editor: CodeMirror 5 · C/C++ interpreter: JSCPP (JSCPP-NG) · Python: Pyodide · SQL: sql.js · Formatter: Prettier · Types: TypeScript.</p>
      </div>`);
  }

  toast(text) {
    const t = this.$('#cpg-toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  setNote(text) {
    const n = this.$('#cpg-note');
    if (!n) return;
    n.textContent = text || '';
    this.noteLocked = Boolean(text);
    clearTimeout(this.noteTimer);
    if (text) this.noteTimer = setTimeout(() => { this.noteLocked = false; this.renderLangSelect(); }, 6000);
  }

  setSaveState(state) {
    const el = this.$('#cpg-save-state');
    if (!el) return;
    el.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : '';
    el.dataset.state = state;
  }

  flashSaved() {
    this.setSaveState('saved');
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.setSaveState(''), 1500);
  }

  async saveNow() {
    await this.saver.flush();
    await this.saveMeta(true);
    this.flashSaved();
    this.toast('All changes saved on this device');
  }

  /* ---------------- persistence ---------------- */

  saveMeta(now = false) {
    this.meta.expanded = [...this.expanded];
    this.meta.updatedAt = Date.now();
    this.meta.fileCount = this.vfs?.listFiles().length || 0;
    const job = () => putWorkspace(this.meta).catch(() => {});
    clearTimeout(this.metaTimer);
    if (now) return job();
    this.metaTimer = setTimeout(job, 400);
    return Promise.resolve();
  }

  async renameWorkspace() {
    const name = await this.o.dialogs.prompt('Workspace name:', this.meta.name, { title: 'Rename Workspace' });
    if (!name || !name.trim()) return;
    this.meta.name = name.trim().slice(0, 80);
    this.$('.cpg-project-label').textContent = this.meta.name;
    this.saveMeta(true);
  }

  author() {
    const u = this.o.getUser?.();
    const cfg = this.meta.git?.globalConfig || {};
    return { name: cfg['user.name'] || u?.displayName || u?.username || 'Student', email: cfg['user.email'] || u?.email || 'student@toolbox.local' };
  }

  gitChanged() {
    this.updateStatusBar();
    this.sessions.forEach((s) => s.updatePrompt());
    if (this.root.dataset.sidebar === 'scm') this.gitPanel.render();
    this.updateScmBadge();
  }

  async updateScmBadge() {
    const badge = this.$('#cpg-scm-badge');
    if (!badge) return;
    const root = this.git.findRoot('');
    if (root === null) { badge.hidden = true; return; }
    try {
      const st = await this.git.status(root);
      const n = st.staged.length + st.unstaged.length + st.untracked.length;
      badge.hidden = !n;
      badge.textContent = n > 99 ? '99+' : String(n);
    } catch { badge.hidden = true; }
  }

  updateStatusBar() {
    const b = this.$('#cpg-status-branch');
    if (!b) return;
    const root = this.git.findRoot(this.activePath ? dirname(this.activePath) : '');
    if (root === null) { b.hidden = true; return; }
    const r = this.git.repo(root);
    b.hidden = false;
    b.textContent = `⎇ ${r.head.detached ? r.head.detached.slice(0, 7) : r.head.branch}`;
  }

  /* ---------------- import / export ---------------- */

  async importFileList(fileList, target = '') {
    const files = [...(fileList || [])];
    if (!files.length) return;
    let n = 0;
    for (const f of files) {
      const rel = f.webkitRelativePath || f.name;
      const p = normalize(target ? `${target}/${rel}` : rel);
      if (/(^|\/)(node_modules|\.git)\//.test(p)) continue;
      if (/\.zip$/i.test(f.name) && files.length === 1 && await this.o.dialogs.confirm(`Extract ${f.name} into the workspace?`, { title: 'Import ZIP' })) { await this.importZipFile(f, target); return; }
      await this.writeUploaded(p, f);
      n++;
    }
    this.$('#cpg-upload-files').value = '';
    this.$('#cpg-upload-folder').value = '';
    this.toast(`Added ${n} file${n === 1 ? '' : 's'}`);
  }

  async writeUploaded(path, file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let content = buf;
    if (!isBinaryPath(path) && buf.length < 5_000_000) {
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { content = buf; }
    }
    this.vfs.writeFile(path, content);
  }

  async importDataTransfer(dt, target) {
    const items = [...(dt.items || [])];
    const entries = items.map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
    if (!entries.length) { await this.importFileList(dt.files, target); return; }
    let n = 0;
    const readEntry = async (entry, base) => {
      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        const p = normalize(`${base}/${entry.name}`);
        if (/(^|\/)(node_modules|\.git)\//.test(p)) return;
        await this.writeUploaded(p, file);
        n++;
      } else if (entry.isDirectory) {
        if (entry.name === 'node_modules' || entry.name === '.git') return;
        const reader = entry.createReader();
        const all = [];
        for (;;) { const batch = await new Promise((res) => reader.readEntries(res, () => res([]))); if (!batch.length) break; all.push(...batch); }
        this.vfs.mkdir(normalize(`${base}/${entry.name}`));
        for (const c of all) await readEntry(c, normalize(`${base}/${entry.name}`));
      }
    };
    for (const e of entries) await readEntry(e, target);
    this.toast(`Added ${n} file${n === 1 ? '' : 's'}`);
  }

  async importZipFile(file, target = '') {
    if (!file) return;
    try {
      const entries = await extractZip(new Uint8Array(await file.arrayBuffer()));
      // Strip a single top-level folder (GitHub "Download ZIP" style)
      const tops = new Set(entries.map((e) => e.path.split('/')[0]));
      const strip = tops.size === 1 && entries.every((e) => e.path.includes('/')) ? `${[...tops][0]}/` : '';
      let n = 0;
      for (const e of entries) {
        const rel = e.path.slice(strip.length);
        if (!rel || /(^|\/)(node_modules|\.git|__MACOSX)\//.test(rel)) continue;
        const p = normalize(target ? `${target}/${rel}` : rel);
        if (e.isDirectory) { this.vfs.mkdir(p); continue; }
        let content = e.data;
        if (!isBinaryPath(p)) { try { content = new TextDecoder('utf-8', { fatal: true }).decode(e.data); } catch { /* binary */ } }
        this.vfs.writeFile(p, content);
        n++;
      }
      this.toast(`Imported ${n} files from ${file.name}`);
    } catch (err) {
      this.toast(`Couldn't read the zip: ${err.message}`);
    }
    this.$('#cpg-upload-zip').value = '';
  }

  async downloadPath(path) {
    const p = normalize(path);
    let blob;
    let name;
    if (p && this.vfs.isFile(p)) {
      const raw = this.vfs.readRaw(p);
      blob = new Blob([raw], { type: mimeFor(p) });
      name = basename(p);
    } else {
      const files = this.vfs.listFiles(p).filter((f) => !/(^|\/)node_modules\//.test(f));
      const entries = files.map((f) => ({ path: p ? f.slice(p.length + 1) : f, data: this.vfs.readRaw(f) }));
      blob = await createZip(entries);
      name = `${(p ? basename(p) : this.meta.name).replace(/[^\w.-]+/g, '-')}.zip`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async saveToToolboxFiles() {
    try {
      const { fs } = await import('../filesystem.js');
      const signedIn = Boolean(this.o.getUser?.());
      const dir = `/Projects/${this.meta.name.replace(/[<>:"|?*/\\]+/g, '-')}`;
      await fs.mkdir(dir, { storage: signedIn ? 'online' : 'offline' });
      let n = 0;
      for (const f of this.vfs.listFiles()) {
        if (/(^|\/)node_modules\//.test(f)) continue;
        await fs.writeFile(`${dir}/${f}`, this.vfs.readRaw(f), { storage: signedIn ? 'online' : 'offline' });
        n++;
      }
      this.toast(`Saved ${n} files to Files → ${dir}${signedIn ? ' (synced)' : ''}`);
    } catch (err) {
      this.toast(`Couldn't save to Files: ${err.message}`);
    }
  }

  async cloneFromGitHub() {
    const url = await this.o.dialogs.prompt('GitHub repository URL:', 'https://github.com/', { title: 'Clone from GitHub' });
    if (!url || !/github\.com\/.+\/.+/.test(url)) return;
    const empty = !this.vfs.listFiles().length;
    this.runInTerminal(`git clone ${quoteArg(url.trim())}${empty ? ' .' : ''}`, { focus: true });
  }

  /* ---------------- assistant ---------------- */

  mountAssistant() {
    const el = this.$('#cpg-assistant-panel');
    if (!el) return;
    this.assistant = new AssistantPanel(el, {
      vfs: this.vfs,
      renderMarkdown,
      openFile: (p, line) => this.openFile(p, line ? { line } : {}),
      openDiff: (d) => this.openDiff(d),
      onClose: () => this.toggleAssistant(false),
      insertAtCursor: (code) => { if (this.activePath) this.editor.replaceSelection(code); },
      toast: (t) => this.toast(t),
      ide: this.agentIntegration(),
    });
  }

  toggleAssistant(force) {
    const el = this.$('#cpg-assistant-panel');
    if (!el) return;
    const show = typeof force === 'boolean' ? force : el.hidden;
    el.hidden = !show;
    this.root.classList.toggle('cpg-has-assistant', show);
    this.$$('.cpg-activity-ai').forEach((b) => b.classList.toggle('active', show));
    if (show) {
      const sel = this.editor.selection();
      this.assistant?.updateContext(this.activePath ? `Context: ${this.activePath}${sel ? ' (selection)' : ''}` : '');
      setTimeout(() => this.assistant?.focus(), 30);
      if (this.isMobile() && this.root.dataset.mobView !== 'assistant') this.setMobileView('assistant');
    }
    setTimeout(() => this.editor.refresh(), 20);
  }

  agentIntegration() {
    const ide = this;
    return {
      token: () => ide.o.getUser?.()?.token || null,
      context: () => ({
        workspaceName: ide.meta.name,
        activeFile: ide.activePath,
        cursorLine: ide.cursor?.line,
        selection: ide.editor.selection(),
        openFiles: ide.meta.openTabs,
        problems: ide.allDiagnostics().slice(0, 20),
        terminal: stripAnsi(ide.mainSession()?.view.text() || '').split('\n').slice(-40).join('\n'),
      }),
      fileTouched: (p) => { if (ide.meta.openTabs.includes(p) || !ide.activePath) ide.openFile(p, { focus: false }); },
      runCommand: async (cmd, { stdin, timeout, signal }) => {
        let s = ide.sessions.find((x) => x.name === 'agent' && !x.busy());
        if (!s) s = ide.newTerminal({ name: 'agent' });
        ide.togglePanel(true);
        ide.showPanelTab('terminal');
        ide.setActiveSession(s);
        const before = new Map(ide.vfs.listFiles().map((f) => [f, ide.vfs.stat(f).mtime]));
        const run = s.run(cmd, { stdin: stdin ?? '' });
        let timedOut = false;
        const onAbort = () => s.interrupt();
        signal?.addEventListener('abort', onAbort, { once: true });
        const res = await Promise.race([run, new Promise((r) => setTimeout(() => { timedOut = true; r(null); }, timeout))]);
        signal?.removeEventListener('abort', onAbort);
        const out = stripAnsi(res ? `${res.out}` : s.view.text().split('\n').slice(-120).join('\n'));
        const changed = ide.vfs.listFiles().filter((f) => before.get(f) !== ide.vfs.stat(f).mtime);
        return {
          exit_code: res ? res.code : null,
          timed_out: timedOut,
          output: out.slice(-12000) || '(no output)',
          ...(timedOut ? { note: `Still running after ${Math.round(timeout / 1000)}s (it keeps running in the "${s.name}" terminal). ${ide.servers.size ? `Servers listening: ${[...ide.servers.keys()].map((p) => `localhost:${p}`).join(', ')}.` : ''}` } : {}),
          changedFiles: changed,
        };
      },
      problems: async (path) => {
        if (ide.vfs.listFiles().some((p) => /\.(m?[jt]sx?)$/.test(p))) { await ide.ensureTs(); await ide.runTsCheck(true); }
        const all = ide.allDiagnostics();
        return path ? all.filter((d) => d.file === path) : all;
      },
      preview: async ({ path, port, wait }) => {
        const before = ide.preview.logs.length;
        if (port) await ide.openPreview({ port, path: path || '/' });
        else if (path) await ide.openPreview(ide.vfs.isDir(path) ? { root: path, path: '/index.html' } : { file: path });
        else await ide.openPreview({});
        await ide.preview.waitReady(Math.max(1500, wait));
        await new Promise((r) => setTimeout(r, wait));
        const snap = await ide.preview.snapshot();
        const logs = ide.preview.logs.slice(before);
        return {
          address: ide.preview.address(),
          title: snap?.title || '',
          text: (snap?.text || '').slice(0, 6000),
          buttons: snap?.buttons?.slice(0, 20),
          inputs: snap?.inputs?.slice(0, 20),
          console: logs.map((l) => `[${l.level}] ${l.text}`).join('\n').slice(-4000) || '(no console output)',
          ...(snap ? {} : { error: 'The page did not respond (it may have crashed or be blank).' }),
        };
      },
      previewInteract: async (actions) => {
        const before = ide.preview.logs.length;
        const r = await ide.preview.interact(actions);
        const logs = ide.preview.logs.slice(before);
        if (!r) return { error: 'The preview did not respond. Open it first with open_preview.' };
        return { results: r.results, title: r.title, text: (r.text || '').slice(0, 6000), console: logs.map((l) => `[${l.level}] ${l.text}`).join('\n').slice(-4000) || '(no console output)' };
      },
    };
  }
}

/* ============================================================
   helpers
   ============================================================ */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function waitFor(cond, ms) { return new Promise((resolve) => { const start = Date.now(); const tick = () => { if (cond() || Date.now() - start > ms) resolve(); else setTimeout(tick, 30); }; tick(); }); }
function quoteArg(a) { return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${String(a).replace(/'/g, "'\\''")}'`; }
function formatMs(ms) { return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`; }
function formatBytes(n) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`; }
function fuzzyMatch(q, s) { let i = 0; for (const c of s) if (c === q[i]) i++; return i === q.length; }
function scoreMatch(q, f) { if (!q) return 0; const b = basename(f).toLowerCase(); return (b === q ? 100 : 0) + (b.startsWith(q) ? 50 : 0) + (b.includes(q) ? 20 : 0) - f.length / 100; }

export function starterFor(path) {
  const lang = languageOf(path);
  const name = basename(path).replace(/\.[^.]+$/, '');
  switch (lang) {
    case 'python': return `def main():\n    print("Hello from ${name}.py")\n\n\nif __name__ == "__main__":\n    main()\n`;
    case 'cpp': return `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from ${name}.cpp" << endl;\n    return 0;\n}\n`;
    case 'c': return `#include <stdio.h>\n\nint main(void) {\n    printf("Hello from ${name}.c\\n");\n    return 0;\n}\n`;
    case 'header': return `#pragma once\n\n`;
    case 'java': return `public class ${/^[A-Z]/.test(name) ? name : 'Main'} {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java");\n    }\n}\n`;
    case 'html': return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n</head>\n<body>\n  <h1>${name}</h1>\n</body>\n</html>\n`;
    case 'css': return '/* styles */\nbody {\n  font-family: system-ui, sans-serif;\n}\n';
    case 'sql': return '-- SQLite\nSELECT 1 + 1 AS answer;\n';
    case 'go': return 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Go")\n}\n';
    case 'rust': return 'fn main() {\n    println!("Hello from Rust");\n}\n';
    case 'lua': return 'print("Hello from Lua")\n';
    case 'markdown': return `# ${name}\n\n`;
    case 'json': return '{\n  \n}\n';
    case 'typescript': return `const greeting: string = 'Hello from ${name}.ts';\nconsole.log(greeting);\n`;
    case 'jsx': return `export default function ${/^[A-Z]/.test(name) ? name : 'Component'}() {\n  return <div>${name}</div>;\n}\n`;
    case 'tsx': return `type Props = { title?: string };\n\nexport default function ${/^[A-Z]/.test(name) ? name : 'Component'}({ title = '${name}' }: Props) {\n  return <h2>{title}</h2>;\n}\n`;
    case 'javascript': return /\.test\.|\.spec\./.test(path) ? testTemplate(path) : '';
    default: return '';
  }
}

function testTemplate(file, active) {
  if (/\.py$/.test(file)) {
    const mod = active && /\.py$/.test(active) && !/test_/.test(active) ? basename(active, '.py') : null;
    return `${mod ? `from ${mod} import *\n\n\n` : ''}def test_addition():\n    assert 1 + 1 == 2\n`;
  }
  const mod = active && /\.(m?[jt]sx?)$/.test(active) && !/\.(test|spec)\./.test(active) ? `./${basename(active).replace(/\.(m?[jt]sx?)$/, '.$1')}` : null;
  return `${mod ? `// import { yourFunction } from '${mod}';\n\n` : ''}describe('my feature', () => {\n  it('works', () => {\n    expect(1 + 1).toBe(2);\n  });\n});\n`;
}

function exampleFor(path) {
  const lang = languageOf(path);
  const tpl = { python: 'python', cpp: 'cpp', c: 'c', java: 'java', sql: 'sql', lua: 'lua', html: 'web' }[lang];
  if (tpl) {
    const files = TEMPLATES[tpl].files();
    const main = TEMPLATES[tpl].open;
    return files[main];
  }
  if (lang === 'javascript') return TEMPLATES['node-cli'].files()['index.js'];
  if (lang === 'typescript') return TEMPLATES.typescript.files()['src/index.ts'];
  if (lang === 'jsx') return TEMPLATES['vite-react'].files()['src/App.jsx'];
  if (lang === 'css') return TEMPLATES.web.files()['style.css'];
  return null;
}
