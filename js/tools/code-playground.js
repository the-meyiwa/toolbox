/* ============================================================
   TOOLBOX — Code Playground & Sublime IDE
   Full-featured in-browser IDE inspired by Sublime Text with
   multi-file project explorer, tabbed workspace, line numbers,
   visual minimap, command palette, live sandbox preview,
   integrated console, and Web Worker / compiler runtimes.
   ============================================================ */

import { LANGUAGES, makeWorker, transpileTypeScript } from '../lib/code-runtimes.js';
import { WEB_FRAMEWORKS, buildPreviewDocument } from '../lib/runtimes-extra.js';
import { REMOTE_LANGUAGES, compileRemote } from '../lib/remote-compile.js';

const ALL = { ...LANGUAGES, ...REMOTE_LANGUAGES };
const isRemote = (id) => Object.hasOwn(REMOTE_LANGUAGES, id);
const isPreview = (id) => !!LANGUAGES[id]?.preview;

const STORAGE_KEY = 'toolbox.sublime_playground_v2';
const RUN_TIMEOUT_MS = {
  javascript: 10000, typescript: 10000, python: 60000, sql: 20000, lua: 30000,
};
const DEFAULT_TIMEOUT_MS = 30000;

export default {
  render(container, { analytics } = {}) {
    this._alive = true;
    this._workers = {};

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}

    const defaultFiles = [
      { id: 'f-1', name: 'main.js', lang: 'javascript', content: LANGUAGES.javascript?.sample || 'console.log("Hello, Sublime IDE!");' },
      { id: 'f-2', name: 'index.html', lang: 'html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>App</title>\n</head>\n<body>\n  <h1 style="font-family:sans-serif;">Welcome to Sublime IDE</h1>\n</body>\n</html>' },
      { id: 'f-3', name: 'script.py', lang: 'python', content: LANGUAGES.python?.sample || 'print("Hello from Python in-browser!")' }
    ];

    const state = {
      files: saved.files?.length ? saved.files : defaultFiles,
      activeFileId: saved.activeFileId || 'f-1',
      framework: WEB_FRAMEWORKS[saved.framework] ? saved.framework : 'bootstrap',
      stdin: saved.stdin || '',
      running: false,
      sidebarOpen: true,
      minimapOpen: true,
      splitMode: 'split', // 'split' | 'code-only' | 'preview-only'
    };

    container.innerHTML = `
      <div class="sublime-ide-root" style="display:flex; flex-direction:column; height:740px; background:#1e1e1e; border:1px solid #333; border-radius:14px; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,0.4); color:#d4d4d4; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        
        <!-- TOP TOOLBAR & CONTROLS -->
        <div style="background:#252526; border-bottom:1px solid #333; padding:6px 12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <!-- Left: Sidebar toggle, Language, Project Name -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="sublime-btn" id="cpg-toggle-sidebar" title="Toggle Sidebar (Ctrl+B)">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
            <span style="font-weight:700; font-size:0.84rem; color:#fff; display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f97316;"></span>
              Sublime IDE
            </span>

            <select class="sublime-select" id="cpg-langs" aria-label="Language Mode" style="font-size:0.78rem;">
              <optgroup label="Runs on your device">
                ${Object.entries(LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
              <optgroup label="Compiled on a server">
                ${Object.entries(REMOTE_LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
            </select>

            <select class="sublime-select" id="cpg-fw" hidden aria-label="CSS framework" style="font-size:0.78rem;">
              ${Object.entries(WEB_FRAMEWORKS).map(([id, f]) =>
                `<option value="${id}"${id === state.framework ? ' selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Right: Command Palette, Layout, Clear, Run -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="sublime-btn" id="cpg-cmd-palette" title="Command Palette (Ctrl+Shift+P)">
              <kbd style="font-size:0.68rem; background:#333; padding:2px 5px; border-radius:3px;">⌘⇧P</kbd> Palette
            </button>
            <button type="button" class="sublime-btn" id="cpg-layout-btn" title="Toggle Layout Split">Split ▾</button>
            <button type="button" class="sublime-btn" id="cpg-sample">Example</button>
            <button type="button" class="sublime-btn" id="cpg-clear">Clear</button>
            <button type="button" class="sublime-btn" id="cpg-reset" hidden>Reset DB</button>
            <button type="button" class="sublime-btn sublime-btn-run" id="cpg-run" style="background:#22c55e; color:#000; font-weight:700;">
              Run <kbd style="font-size:0.68rem; background:rgba(0,0,0,0.2); padding:1px 4px; border-radius:3px; margin-left:4px;">⌃↵</kbd>
            </button>
          </div>
        </div>

        <!-- MAIN WORKSPACE (SIDEBAR + EDITOR + CONSOLE) -->
        <div style="display:flex; flex:1; overflow:hidden; position:relative;">
          
          <!-- SIDEBAR FILE EXPLORER -->
          <div id="cpg-sidebar" style="width:200px; background:#252526; border-right:1px solid #333; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="padding:8px 12px; font-size:0.72rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center;">
                <span>Folders</span>
                <button type="button" id="cpg-new-file" style="background:none; border:none; color:#bbb; cursor:pointer; font-size:1rem; padding:0 4px;" title="New File">+</button>
              </div>
              <div id="cpg-file-tree" style="display:flex; flex-direction:column;"></div>
            </div>

            <!-- Stdin Box for remote runs -->
            <div id="cpg-stdin-wrap" hidden style="padding:10px; border-top:1px solid #333; background:#1e1e1e;">
              <div style="font-size:0.7rem; color:#888; margin-bottom:4px; font-weight:600;">Standard Input (stdin)</div>
              <textarea id="cpg-stdin" style="width:100%; height:50px; background:#2d2d2d; border:1px solid #444; color:#fff; font-family:monospace; font-size:0.74rem; padding:4px; resize:none; outline:none; border-radius:4px;"></textarea>
            </div>
          </div>

          <!-- EDITOR & CONSOLE SPLIT AREA -->
          <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#1e1e1e;">
            
            <!-- TABS BAR -->
            <div id="cpg-tabs-bar" style="background:#2d2d2d; border-bottom:1px solid #1e1e1e; display:flex; overflow-x:auto; scrollbar-width:none;"></div>

            <!-- CODE EDITOR WITH GUTTER & MINIMAP -->
            <div id="cpg-center-split" style="flex:1; display:flex; overflow:hidden; position:relative;">
              
              <!-- Editor Container -->
              <div style="flex:1; display:flex; overflow:hidden; position:relative; background:#1e1e1e;">
                <div id="cpg-gutter" style="width:48px; background:#1e1e1e; color:#5a5a5a; font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px 6px; text-align:right; user-select:none; border-right:1px solid #2d2d2d; overflow:hidden;"></div>
                <textarea id="cpg-code" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" wrap="off" style="flex:1; background:#1e1e1e; color:#e6db74; font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px; border:none; outline:none; resize:none; white-space:pre; overflow:auto;"></textarea>
              </div>

              <!-- Sublime Visual Minimap -->
              <div id="cpg-minimap" style="width:80px; background:#181818; border-left:1px solid #282828; padding:8px 4px; overflow:hidden; user-select:none; opacity:0.65; cursor:pointer;" title="Sublime Minimap">
                <div id="cpg-minimap-content" style="font-size:3px; line-height:4px; color:#a6e22e; font-family:monospace; white-space:pre; pointer-events:none;"></div>
              </div>

              <!-- Live Preview / Console Split Pane -->
              <div id="cpg-preview-pane" style="width:42%; background:#141414; border-left:1px solid #333; display:flex; flex-direction:column; overflow:hidden;">
                <iframe id="cpg-preview" hidden style="flex:1; width:100%; border:none; background:#fff;" sandbox="allow-scripts allow-modals allow-popups allow-forms"></iframe>
                
                <div class="cpg-console-wrap" style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#141414;">
                  <div style="padding:6px 12px; background:#222; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-family:monospace; color:#888;">
                    <span>Terminal / Console</span>
                    <span id="cpg-timing" style="color:#22c55e;"></span>
                  </div>
                  <div id="cpg-console" style="flex:1; overflow:auto; padding:10px 12px; font-family:'Fira Code', Consolas, monospace; font-size:0.78rem; line-height:1.45; color:#a6e22e; white-space:pre-wrap;"></div>
                </div>
              </div>

            </div>

          </div>

        </div>

        <!-- SUBLIME STATUS BAR -->
        <div style="background:#007acc; color:#fff; padding:3px 12px; font-size:0.72rem; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:14px;">
            <span id="cpg-status-pos">Line 1, Column 1</span>
            <span id="cpg-status-spaces">Spaces: 2</span>
            <span id="cpg-status-encoding">UTF-8</span>
          </div>
          <div style="display:flex; gap:14px; align-items:center;">
            <span id="cpg-note" style="color:#e0f2fe; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
            <span id="cpg-status-lang" style="font-weight:600; text-transform:uppercase;">JAVASCRIPT</span>
          </div>
        </div>

        <!-- SUBLIME COMMAND PALETTE MODAL (HIDDEN) -->
        <div id="cpg-palette-modal" style="display:none; position:absolute; top:40px; left:50%; transform:translateX(-50%); width:480px; max-width:90%; background:#252526; border:1px solid #454545; border-radius:8px; box-shadow:0 16px 48px rgba(0,0,0,0.6); z-index:100; overflow:hidden;">
          <input type="text" id="cpg-palette-input" placeholder="Type a command or language..." style="width:100%; padding:10px 14px; background:#1e1e1e; border:none; border-bottom:1px solid #333; color:#fff; font-size:0.86rem; outline:none;">
          <div id="cpg-palette-list" style="max-height:240px; overflow-y:auto;"></div>
        </div>

      </div>
    `;

    injectSublimeStyles();

    const codeEl = container.querySelector('#cpg-code');
    const gutterEl = container.querySelector('#cpg-gutter');
    const minimapEl = container.querySelector('#cpg-minimap');
    const minimapContent = container.querySelector('#cpg-minimap-content');
    const consoleEl = container.querySelector('#cpg-console');
    const timingEl = container.querySelector('#cpg-timing');
    const runBtn = container.querySelector('#cpg-run');
    const noteEl = container.querySelector('#cpg-note');
    const previewEl = container.querySelector('#cpg-preview');
    const previewPane = container.querySelector('#cpg-preview-pane');
    const fwEl = container.querySelector('#cpg-fw');
    const stdinWrap = container.querySelector('#cpg-stdin-wrap');
    const stdinEl = container.querySelector('#cpg-stdin');
    const langsSelect = container.querySelector('#cpg-langs');
    const tabsBar = container.querySelector('#cpg-tabs-bar');
    const fileTree = container.querySelector('#cpg-file-tree');
    const sidebar = container.querySelector('#cpg-sidebar');
    const toggleSidebarBtn = container.querySelector('#cpg-toggle-sidebar');
    const newFileBtn = container.querySelector('#cpg-new-file');
    const resetBtn = container.querySelector('#cpg-reset');
    const layoutBtn = container.querySelector('#cpg-layout-btn');
    const cmdPaletteBtn = container.querySelector('#cpg-cmd-palette');
    const paletteModal = container.querySelector('#cpg-palette-modal');
    const paletteInput = container.querySelector('#cpg-palette-input');
    const paletteList = container.querySelector('#cpg-palette-list');
    const statusPos = container.querySelector('#cpg-status-pos');
    const statusLang = container.querySelector('#cpg-status-lang');

    const self_ = this;

    function getActiveFile() {
      return state.files.find(f => f.id === state.activeFileId) || state.files[0];
    }

    function renderTabs() {
      tabsBar.innerHTML = state.files.map(f => `
        <div class="sublime-tab ${f.id === state.activeFileId ? 'active' : ''}" data-id="${f.id}" style="padding:6px 14px; font-size:0.78rem; font-family:monospace; background:${f.id === state.activeFileId ? '#1e1e1e' : '#2d2d2d'}; color:${f.id === state.activeFileId ? '#fff' : '#888'}; border-right:1px solid #1e1e1e; cursor:pointer; display:flex; align-items:center; gap:8px;">
          <span>${f.name}</span>
          ${state.files.length > 1 ? `<span class="sublime-tab-close" data-id="${f.id}" style="color:#666; font-size:0.9rem; line-height:1;">&times;</span>` : ''}
        </div>
      `).join('');

      tabsBar.querySelectorAll('.sublime-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          if (e.target.classList.contains('sublime-tab-close')) return;
          state.activeFileId = tab.dataset.id;
          loadFile();
          renderTabs();
          renderFileTree();
        });
      });

      tabsBar.querySelectorAll('.sublime-tab-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = closeBtn.dataset.id;
          state.files = state.files.filter(f => f.id !== id);
          if (state.activeFileId === id) state.activeFileId = state.files[0]?.id;
          renderTabs();
          renderFileTree();
          loadFile();
          persist();
        });
      });
    }

    function renderFileTree() {
      fileTree.innerHTML = state.files.map(f => `
        <div class="sublime-tree-item ${f.id === state.activeFileId ? 'active' : ''}" data-id="${f.id}" style="padding:5px 14px; font-size:0.78rem; font-family:monospace; color:${f.id === state.activeFileId ? '#fff' : '#aaa'}; background:${f.id === state.activeFileId ? '#37373d' : 'transparent'}; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          <span>${f.name}</span>
        </div>
      `).join('');

      fileTree.querySelectorAll('.sublime-tree-item').forEach(item => {
        item.addEventListener('click', () => {
          state.activeFileId = item.dataset.id;
          loadFile();
          renderTabs();
          renderFileTree();
        });
      });
    }

    function renderGutterAndMinimap() {
      const text = codeEl.value;
      const lines = text.split('\n').length;
      gutterEl.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      gutterEl.scrollTop = codeEl.scrollTop;
      minimapContent.textContent = text.slice(0, 3000);
    }

    function loadFile() {
      const file = getActiveFile();
      if (!file) return;
      codeEl.value = file.content;
      langsSelect.value = file.lang || 'javascript';
      statusLang.textContent = file.lang?.toUpperCase() || 'JAVASCRIPT';
      applyLanguage(file.lang || 'javascript');
      renderGutterAndMinimap();
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          files: state.files,
          activeFileId: state.activeFileId,
          framework: state.framework,
          stdin: state.stdin,
        }));
      } catch {}
    }

    codeEl.addEventListener('input', () => {
      const file = getActiveFile();
      if (file) {
        file.content = codeEl.value;
        persist();
      }
      renderGutterAndMinimap();
      updateStatusPos();
    });

    codeEl.addEventListener('scroll', () => {
      gutterEl.scrollTop = codeEl.scrollTop;
    });

    codeEl.addEventListener('click', updateStatusPos);
    codeEl.addEventListener('keyup', updateStatusPos);

    function updateStatusPos() {
      const text = codeEl.value.slice(0, codeEl.selectionStart);
      const lines = text.split('\n');
      const row = lines.length;
      const col = lines[lines.length - 1].length + 1;
      statusPos.textContent = `Line ${row}, Column ${col}`;
    }

    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: en, value } = codeEl;
        if (s !== en || e.shiftKey) {
          const lineStart = value.lastIndexOf('\n', s - 1) + 1;
          const chunk = value.slice(lineStart, en);
          const updated = e.shiftKey ? chunk.replace(/^ {1,2}/gm, '') : chunk.replace(/^/gm, '  ');
          codeEl.setRangeText(updated, lineStart, en, 'select');
        } else {
          codeEl.setRangeText('  ', s, en, 'end');
        }
        codeEl.dispatchEvent(new Event('input'));
        return;
      }

      if (e.key === 'Enter') {
        const { selectionStart: s, value } = codeEl;
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const line = value.slice(lineStart, s);
        const indent = (line.match(/^[ \t]*/) || [''])[0];
        const deeper = /[{([:]\s*$/.test(line) ? '  ' : '';
        if (indent || deeper) {
          e.preventDefault();
          codeEl.setRangeText('\n' + indent + deeper, s, codeEl.selectionEnd, 'end');
          codeEl.dispatchEvent(new Event('input'));
        }
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    });

    toggleSidebarBtn.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      sidebar.style.display = state.sidebarOpen ? 'flex' : 'none';
    });

    newFileBtn.addEventListener('click', () => {
      const name = prompt('Enter new filename:', `script_${state.files.length + 1}.js`);
      if (!name) return;
      let ext = name.split('.').pop();
      let lang = 'javascript';
      if (ext === 'py') lang = 'python';
      if (ext === 'html') lang = 'html';
      if (ext === 'sql') lang = 'sql';
      if (ext === 'ts') lang = 'typescript';
      if (ext === 'rs') lang = 'rust';
      if (ext === 'cpp' || ext === 'c') lang = 'cpp';

      const newFile = {
        id: `f-${Date.now()}`,
        name,
        lang,
        content: ALL[lang]?.sample || `// ${name}\n`
      };
      state.files.push(newFile);
      state.activeFileId = newFile.id;
      renderTabs();
      renderFileTree();
      loadFile();
      persist();
    });

    layoutBtn.addEventListener('click', () => {
      if (state.splitMode === 'split') {
        state.splitMode = 'code-only';
        previewPane.style.display = 'none';
        layoutBtn.textContent = 'Code Only';
      } else if (state.splitMode === 'code-only') {
        state.splitMode = 'preview-only';
        previewPane.style.display = 'flex';
        previewPane.style.width = '100%';
        layoutBtn.textContent = 'Preview Only';
      } else {
        state.splitMode = 'split';
        previewPane.style.display = 'flex';
        previewPane.style.width = '42%';
        layoutBtn.textContent = 'Split ▾';
      }
    });

    /* Command Palette Handlers */
    cmdPaletteBtn.addEventListener('click', togglePalette);
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        togglePalette();
      }
    });

    function togglePalette() {
      const show = paletteModal.style.display === 'none';
      paletteModal.style.display = show ? 'block' : 'none';
      if (show) {
        paletteInput.value = '';
        renderPaletteCommands();
        paletteInput.focus();
      }
    }

    const PALETTE_COMMANDS = [
      { name: 'Run Code / Compile Program', action: () => run() },
      { name: 'Format / Beautify Code', action: () => formatCode() },
      { name: 'Toggle Minimap', action: () => { minimapEl.style.display = minimapEl.style.display === 'none' ? 'block' : 'none'; } },
      { name: 'Toggle Word Wrap', action: () => { codeEl.wrap = codeEl.wrap === 'off' ? 'on' : 'off'; } },
      { name: 'Clear Terminal Output', action: () => clearConsole() },
      { name: 'New File', action: () => newFileBtn.click() },
      { name: 'Export Project to ZIP', action: () => exportZip() },
      ...Object.entries(ALL).map(([k, v]) => ({
        name: `Set Syntax: ${v.name}`,
        action: () => {
          const file = getActiveFile();
          if (file) file.lang = k;
          langsSelect.value = k;
          applyLanguage(k);
        }
      }))
    ];

    function renderPaletteCommands() {
      const q = paletteInput.value.toLowerCase().trim();
      const filtered = PALETTE_COMMANDS.filter(c => c.name.toLowerCase().includes(q));
      paletteList.innerHTML = filtered.map((c, i) => `
        <div class="sublime-palette-item" data-idx="${i}" style="padding:8px 14px; font-size:0.8rem; font-family:monospace; color:#ddd; cursor:pointer; border-bottom:1px solid #333;">
          ${c.name}
        </div>
      `).join('');

      paletteList.querySelectorAll('.sublime-palette-item').forEach(item => {
        item.addEventListener('click', () => {
          filtered[parseInt(item.dataset.idx, 10)].action();
          paletteModal.style.display = 'none';
        });
      });
    }
    paletteInput.addEventListener('input', renderPaletteCommands);

    function formatCode() {
      const src = codeEl.value;
      try {
        if (langsSelect.value === 'javascript' || langsSelect.value === 'json') {
          const obj = JSON.parse(src);
          codeEl.value = JSON.stringify(obj, null, 2);
          codeEl.dispatchEvent(new Event('input'));
        }
      } catch {}
    }

    async function exportZip() {
      // Export all project files
      const blobParts = state.files.map(f => `${f.name}:\n${f.content}\n\n====================\n\n`).join('');
      const blob = new Blob([blobParts], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sublime_project_export.txt';
      a.click();
    }

    /* Console & Line Logger */
    function line(level, text) {
      const el = document.createElement('div');
      el.className = `cpg-line cpg-${level}`;
      el.style.color = level === 'error' ? '#ef4444' : (level === 'muted' ? '#777' : '#a6e22e');
      el.textContent = text;
      consoleEl.appendChild(el);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function resultTable({ columns, values }) {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.innerHTML = `
        <table class="calc-table" style="background:#1e1e1e; font-size:0.75rem; color:#fff;">
          <thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${values.map(row => `<tr>${row.map(v => `<td>${v !== null ? v : 'NULL'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div style="font-size:0.7rem; color:#888; margin-top:2px;">${values.length} rows returned</div>`;
      consoleEl.appendChild(wrap);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function clearConsole() {
      consoleEl.innerHTML = '';
      timingEl.textContent = '';
    }
    container.querySelector('#cpg-clear').addEventListener('click', clearConsole);

    /* Worker Management */
    function getWorker(lang) {
      if (!self_._workers[lang]) self_._workers[lang] = makeWorker(lang);
      return self_._workers[lang];
    }
    function killWorker(lang) {
      const w = self_._workers[lang];
      if (w) { w.terminate(); delete self_._workers[lang]; }
    }
    function idle() {
      clearTimeout(self_._timer);
      state.running = false;
      runBtn.textContent = 'Run ';
      runBtn.appendChild(Object.assign(document.createElement('kbd'), { textContent: '⌃↵' }));
    }
    function abort(reason) {
      killWorker(langsSelect.value);
      idle();
      if (reason) line('error', reason);
    }

    async function run() {
      if (state.running) {
        if (self_._remote) { self_._remote.abort(); self_._remote = null; }
        else abort('Stopped.');
        return;
      }

      clearConsole();
      state.running = true;
      runBtn.textContent = 'Stop';

      const lang = langsSelect.value;
      let source = codeEl.value;

      if (!source.trim()) { line('muted', 'Nothing to run.'); idle(); return; }

      if (isPreview(lang)) {
        previewEl.srcdoc = buildPreviewDocument(source, state.framework);
        previewEl.hidden = false;
        line('muted', 'Sandbox preview updated.');
        timingEl.textContent = WEB_FRAMEWORKS[state.framework].name;
        idle();
        analytics?.completed({ outputKind: 'html' });
        return;
      }

      if (isRemote(lang)) {
        const meta = REMOTE_LANGUAGES[lang];
        line('muted', `Compiling ${meta.name} ${meta.version} on remote server...`);
        self_._remote = new AbortController();
        try {
          const res = await compileRemote(lang, source, {
            stdin: stdinEl.value,
            signal: self_._remote.signal,
          });
          if (!self_._alive) return;
          clearConsole();
          if (res.compileError) for (const l of res.compileError.split('\n')) line('error', l);
          if (res.output) for (const l of res.output.split('\n')) line('log', l);
          if (res.runtimeError) for (const l of res.runtimeError.split('\n')) line('error', l);
          timingEl.textContent = `${meta.name} · ${res.ms} ms`;
        } catch (err) {
          if (!self_._alive) return;
          if (err.name === 'AbortError') line('muted', 'Stopped.');
          else line('error', err.message);
        } finally {
          self_._remote = null;
          idle();
        }
        return;
      }

      if (lang === 'typescript') {
        line('muted', 'Transpiling TypeScript...');
        try {
          const { code, errors } = await transpileTypeScript(source);
          if (errors.length) { for (const e of errors) line('error', e); idle(); return; }
          source = code;
        } catch (err) {
          line('error', err.message);
          idle();
          return;
        }
      }

      const worker = getWorker(lang);
      worker.onmessage = (e) => {
        const { type, level, text, payload } = e.data;
        if (type === 'out') line(level, text);
        else if (type === 'table') resultTable(payload);
        else if (type === 'status') line('muted', text);
        else if (type === 'done') {
          timingEl.textContent = `finished in ${Number(text).toLocaleString()} ms`;
          idle();
        }
      };

      worker.onerror = (err) => abort(err.message || 'Runtime execution failed.');
      const limit = RUN_TIMEOUT_MS[lang] ?? DEFAULT_TIMEOUT_MS;
      self_._timer = setTimeout(() => abort(`Execution timeout after ${limit / 1000}s.`), limit);
      worker.postMessage({ code: source });
    }

    runBtn.addEventListener('click', run);

    resetBtn.addEventListener('click', () => {
      if (state.running) return;
      clearConsole();
      state.running = true;
      runBtn.textContent = 'Stop';
      const worker = getWorker('sql');
      worker.onmessage = (e) => {
        const { type, level, text } = e.data;
        if (type === 'out' || type === 'status') line(level || 'muted', text);
        else if (type === 'done') idle();
      };
      worker.postMessage({ reset: true });
    });

    function applyLanguage(id) {
      const l = ALL[id];
      const remote = isRemote(id);
      const preview = isPreview(id);

      noteEl.innerHTML = remote
        ? `Compiled with ${l.compiler} on remote server.`
        : `${l.note || ''}`;

      previewEl.hidden = !preview;
      consoleEl.parentElement.hidden = preview && state.splitMode !== 'split';
      fwEl.hidden = !preview;
      stdinWrap.hidden = !remote;
      resetBtn.hidden = id !== 'sql';

      if (preview) previewEl.srcdoc = buildPreviewDocument(codeEl.value, state.framework);
    }

    langsSelect.addEventListener('change', (e) => {
      const file = getActiveFile();
      if (file) {
        file.lang = e.target.value;
        statusLang.textContent = file.lang.toUpperCase();
        persist();
      }
      applyLanguage(e.target.value);
    });

    container.querySelector('#cpg-sample').addEventListener('click', () => {
      const file = getActiveFile();
      if (file) {
        file.content = ALL[langsSelect.value]?.sample || '';
        codeEl.value = file.content;
        renderGutterAndMinimap();
        persist();
      }
    });

    renderTabs();
    renderFileTree();
    loadFile();
  },

  destroy() {
    this._alive = false;
    this._remote?.abort();
    for (const w of Object.values(this._workers || {})) w.terminate();
    this._workers = {};
    clearTimeout(this._timer);
  }
};

function injectSublimeStyles() {
  if (document.getElementById('sublime-ide-styles')) return;
  const style = document.createElement('style');
  style.id = 'sublime-ide-styles';
  style.textContent = `
    .sublime-btn {
      background: #333333;
      border: 1px solid #444444;
      color: #cccccc;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .sublime-btn:hover { background: #444444; color: #ffffff; }
    .sublime-select {
      background: #1e1e1e;
      border: 1px solid #444;
      color: #ffffff;
      padding: 3px 6px;
      border-radius: 4px;
      outline: none;
    }
    .sublime-tab:hover { background: #37373d !important; color: #ffffff !important; }
    .sublime-tree-item:hover { background: #2a2d2e !important; color: #ffffff !important; }
    .sublime-palette-item:hover { background: #094771 !important; color: #ffffff !important; }
  `;
  document.head.appendChild(style);
}
