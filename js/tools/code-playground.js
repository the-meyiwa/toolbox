/* ============================================================
   TOOLBOX — Code Playground
   Multi-file in-browser desktop-grade IDE with workspaces,
   dockable bottom terminal, interactive shell, project explorer,
   tabbed buffers, line numbers gutter, visual minimap, command palette,
   live sandbox preview, custom editor themes, fullscreen mode,
   local Web Worker / in-browser C++ runtimes, and remote compilers.
   ============================================================ */

import { LANGUAGES, makeWorker, transpileTypeScript } from '../lib/code-runtimes.js';
import { WEB_FRAMEWORKS, buildPreviewDocument } from '../lib/runtimes-extra.js';
import { REMOTE_LANGUAGES, compileRemote } from '../lib/remote-compile.js';
import { fs } from '../lib/filesystem.js';

const ALL = { ...LANGUAGES, ...REMOTE_LANGUAGES };
const isRemote = (id) => Object.hasOwn(REMOTE_LANGUAGES, id);
const isPreview = (id) => !!LANGUAGES[id]?.preview;

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STORAGE_WORKSPACES_KEY = 'toolbox_cpg_workspaces_v2';
const STORAGE_ACTIVE_WS_KEY = 'toolbox_cpg_active_ws_v2';

const RUN_TIMEOUT_MS = {
  javascript: 10000, typescript: 10000, python: 60000, cpp: 30000, sql: 20000, lua: 30000,
};
const DEFAULT_TIMEOUT_MS = 30000;

const IDE_THEMES = {
  'monokai': {
    name: 'Monokai Dark',
    bg: '#1e1e1e',
    sidebar: '#252526',
    header: '#252526',
    tabActive: '#1e1e1e',
    tabInactive: '#2d2d2d',
    text: '#e6db74',
    gutter: '#5a5a5a',
    terminalBg: '#141414',
    terminalText: '#a6e22e',
    accent: '#f97316'
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    bg: '#1a1b26',
    sidebar: '#16161e',
    header: '#1f2335',
    tabActive: '#1a1b26',
    tabInactive: '#24283b',
    text: '#c0caf5',
    gutter: '#565f89',
    terminalBg: '#13141c',
    terminalText: '#7aa2f7',
    accent: '#bb9af7'
  },
  'dracula': {
    name: 'Dracula',
    bg: '#282a36',
    sidebar: '#21222c',
    header: '#191a21',
    tabActive: '#282a36',
    tabInactive: '#343746',
    text: '#f8f8f2',
    gutter: '#6272a4',
    terminalBg: '#1e1f29',
    terminalText: '#50fa7b',
    accent: '#ff79c6'
  },
  'one-dark': {
    name: 'One Dark',
    bg: '#282c34',
    sidebar: '#21252b',
    header: '#1e2227',
    tabActive: '#282c34',
    tabInactive: '#2c313a',
    text: '#abb2bf',
    gutter: '#5c6370',
    terminalBg: '#1b1d23',
    terminalText: '#98c379',
    accent: '#61afef'
  },
  'cyber-matrix': {
    name: 'Cyber Matrix',
    bg: '#050d08',
    sidebar: '#08140c',
    header: '#0a1a0f',
    tabActive: '#050d08',
    tabInactive: '#0d2214',
    text: '#00ff66',
    gutter: '#006622',
    terminalBg: '#020604',
    terminalText: '#00ff66',
    accent: '#00ff66'
  },
  'github-light': {
    name: 'GitHub Light',
    bg: '#ffffff',
    sidebar: '#f6f8fa',
    header: '#f6f8fa',
    tabActive: '#ffffff',
    tabInactive: '#eaeef2',
    text: '#24292f',
    gutter: '#8c959f',
    terminalBg: '#f6f8fa',
    terminalText: '#0969da',
    accent: '#0969da'
  }
};

const TEMPLATES = {
  'cpp': {
    name: 'C++ Algorithm',
    files: [
      {
        id: 'f-1',
        name: 'main.cpp',
        lang: 'cpp',
        content: `// In-browser offline C++ compilation
#include <iostream>
#include <vector>
#include <cmath>

using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "=== C++ In-Browser Execution ===" << endl;
    cout << "Fibonacci(10) = " << fibonacci(10) << endl;

    vector<int> numbers = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    cout << "Sum of vector elements: " << sum << endl;
    return 0;
}
`
      }
    ]
  },
  'web': {
    name: 'Web Application',
    files: [
      {
        id: 'f-1',
        name: 'index.html',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Interactive App</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; }
    h1 { color: #2563eb; }
    button { padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h1>Interactive Sandbox</h1>
  <p>Live preview with real-time editing.</p>
  <button id="btn">Click me</button>
  <p id="msg"></p>
  <script>
    let count = 0;
    document.getElementById('btn').onclick = () => {
      count++;
      document.getElementById('msg').textContent = 'Clicks: ' + count;
    };
  </script>
</body>
</html>
`
      }
    ]
  },
  'python': {
    name: 'Python Script',
    files: [
      {
        id: 'f-1',
        name: 'main.py',
        lang: 'python',
        content: `# Python in-browser local runtime
import math

def calculate_primes(limit):
    primes = []
    for num in range(2, limit + 1):
        if all(num % p != 0 for p in primes if p * p <= num):
            primes.append(num)
    return primes

print("=== Python 3 In-Browser Runtime ===")
primes = calculate_primes(50)
print("Primes up to 50:", primes)
print("Total found:", len(primes))
`
      }
    ]
  },
  'js': {
    name: 'JavaScript REPL',
    files: [
      {
        id: 'f-1',
        name: 'index.js',
        lang: 'javascript',
        content: `// JavaScript in-browser execution
const data = [
  { item: 'Laptop', price: 1200, count: 2 },
  { item: 'Monitor', price: 350, count: 3 },
  { item: 'Keyboard', price: 85, count: 5 }
];

const total = data.reduce((sum, row) => sum + (row.price * row.count), 0);
console.log('Order items:');
console.table(data);
console.log('Total order value: $' + total.toLocaleString());
`
      }
    ]
  },
  'blank': {
    name: 'Blank Workspace',
    files: [
      {
        id: 'f-1',
        name: 'main.js',
        lang: 'javascript',
        content: `console.log("Workspace initialized.");\n`
      }
    ]
  }
};

function getSavedWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_WORKSPACES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveWorkspaces(list) {
  try {
    localStorage.setItem(STORAGE_WORKSPACES_KEY, JSON.stringify(list));
  } catch {}
}

function getActiveWorkspaceId() {
  try {
    return localStorage.getItem(STORAGE_ACTIVE_WS_KEY) || null;
  } catch {
    return null;
  }
}

function setActiveWorkspaceId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_ACTIVE_WS_KEY, id);
    else localStorage.removeItem(STORAGE_ACTIVE_WS_KEY);
  } catch {}
}

export default {
  render(container, { analytics } = {}) {
    this._alive = true;
    this._workers = {};
    this.container = container;
    this.analytics = analytics;

    injectIdeStyles();

    // Check if a specific workspace is requested in hash: #code-playground?workspace=...
    const hash = window.location.hash || '';
    const wsMatch = hash.match(/[?&]workspace=([a-zA-Z0-9_-]+)/);
    if (wsMatch) {
      setActiveWorkspaceId(wsMatch[1]);
    }

    this.checkAndRender();
  },

  checkAndRender() {
    const activeId = getActiveWorkspaceId();
    const workspaces = getSavedWorkspaces();
    const currentWs = activeId ? workspaces.find(w => w.id === activeId) : null;

    if (!currentWs) {
      this.renderLanding(this.container);
    } else {
      this.renderIde(this.container, currentWs);
    }
  },

  /* -------------------------------------------------------------
     LANDING SCREEN (Empty State when no workspace is open)
     ------------------------------------------------------------- */
  renderLanding(container) {
    const workspaces = getSavedWorkspaces();

    container.innerHTML = `
      <div class="cpg-landing" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:680px; padding:40px 20px; background:var(--bg, #121214); color:var(--text, #e4e4e7); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width:640px; width:100%;">
          
          <!-- Minimal Brand Header -->
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:32px;">
            <div style="width:44px; height:44px; border-radius:12px; background:var(--bg-card, #1c1c1f); border:1px solid var(--border, #27272a); display:flex; align-items:center; justify-content:center; color:var(--text, #ffffff);">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </div>
            <div>
              <h1 style="margin:0; font-size:1.5rem; font-weight:700; color:var(--text, #ffffff); letter-spacing:-0.02em;">Code Playground</h1>
              <p style="margin:3px 0 0; font-size:0.84rem; color:var(--text-secondary, #a1a1aa);">Lightweight, in-browser workspace environment</p>
            </div>
          </div>

          <!-- Primary Actions (Minimal Cards) -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:32px;">
            <div class="cpg-card-action" id="cpg-action-new" style="background:var(--bg-card, #18181b); border:1px solid var(--border, #27272a); border-radius:12px; padding:18px 20px; cursor:pointer; transition:all 0.15s ease;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <div style="width:28px; height:28px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid var(--border, #27272a); display:flex; align-items:center; justify-content:center; color:var(--text, #ffffff);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span style="font-weight:600; font-size:0.95rem; color:var(--text, #ffffff);">New Workspace</span>
              </div>
              <p style="margin:0; font-size:0.78rem; color:var(--text-secondary, #a1a1aa); line-height:1.4;">Create a blank workspace or start fresh.</p>
            </div>

            <div class="cpg-card-action" id="cpg-action-open" style="background:var(--bg-card, #18181b); border:1px solid var(--border, #27272a); border-radius:12px; padding:18px 20px; cursor:pointer; transition:all 0.15s ease;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <div style="width:28px; height:28px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid var(--border, #27272a); display:flex; align-items:center; justify-content:center; color:var(--text, #ffffff);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span style="font-weight:600; font-size:0.95rem; color:var(--text, #ffffff);">Open Workspace</span>
              </div>
              <p style="margin:0; font-size:0.78rem; color:var(--text-secondary, #a1a1aa); line-height:1.4;">Open an existing saved workspace.</p>
            </div>
          </div>

          <!-- Quick Templates (Minimal Pill Group) -->
          <div style="margin-bottom:32px;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted, #71717a); font-weight:700; margin-bottom:10px;">Quick Templates</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <button type="button" class="cpg-tpl-pill" data-tpl="cpp">C++ Algorithm</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="web">Web App</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="python">Python Script</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="js">JavaScript REPL</button>
            </div>
          </div>

          <!-- Recent Workspaces -->
          <div>
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted, #71717a); font-weight:700; margin-bottom:10px;">Recent Workspaces</div>
            ${workspaces.length === 0 ? `
              <div style="background:var(--bg-card, #18181b); border:1px dashed var(--border, #27272a); border-radius:10px; padding:22px; text-align:center; color:var(--text-muted, #71717a); font-size:0.82rem;">
                No open workspaces. Create a workspace or select a template above to begin.
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${workspaces.slice(0, 6).map(w => `
                  <div class="cpg-recent-row" data-ws-id="${w.id}" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card, #18181b); border:1px solid var(--border, #27272a); border-radius:8px; padding:9px 14px; cursor:pointer; transition:all 0.15s ease;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted, #71717a);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span style="font-size:0.85rem; font-weight:600; color:var(--text, #fff);">${escapeHtml(w.name)}</span>
                      <span style="font-size:0.72rem; color:var(--text-muted, #71717a); font-family:monospace;">${w.files?.length || 0} file${w.files?.length === 1 ? '' : 's'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="font-size:0.72rem; color:var(--text-muted, #71717a);">${new Date(w.updatedAt || Date.now()).toLocaleDateString()}</span>
                      <button type="button" class="cpg-del-ws-btn" data-del-id="${w.id}" title="Delete workspace" style="background:none; border:none; color:var(--text-muted, #71717a); cursor:pointer; padding:4px; border-radius:4px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>
      </div>
    `;

    // Hook template buttons
    container.querySelectorAll('.cpg-tpl-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tplKey = btn.dataset.tpl;
        const tpl = TEMPLATES[tplKey];
        if (!tpl) return;
        const newWs = {
          id: `ws-${Date.now()}`,
          name: tpl.name,
          files: JSON.parse(JSON.stringify(tpl.files)),
          activeFileId: tpl.files[0]?.id || 'f-1',
          framework: 'none',
          theme: 'monokai',
          updatedAt: Date.now()
        };
        const list = getSavedWorkspaces();
        list.unshift(newWs);
        saveWorkspaces(list);
        setActiveWorkspaceId(newWs.id);
        this.checkAndRender();
      });
    });

    // Hook action buttons
    container.querySelector('#cpg-action-new')?.addEventListener('click', () => {
      const defaultName = `Workspace ${workspaces.length + 1}`;
      const name = prompt('Enter workspace name:', defaultName) || defaultName;
      const cleanName = name.trim() || defaultName;
      const newWs = {
        id: `ws-${Date.now()}`,
        name: cleanName,
        files: JSON.parse(JSON.stringify(TEMPLATES.blank.files)),
        activeFileId: 'f-1',
        framework: 'none',
        theme: 'monokai',
        updatedAt: Date.now()
      };
      const list = getSavedWorkspaces();
      list.unshift(newWs);
      saveWorkspaces(list);
      setActiveWorkspaceId(newWs.id);
      this.checkAndRender();
    });

    container.querySelector('#cpg-action-open')?.addEventListener('click', () => {
      const list = getSavedWorkspaces();
      if (!list.length) {
        // If none saved, create one immediately
        const newWs = {
          id: `ws-${Date.now()}`,
          name: 'My Workspace',
          files: JSON.parse(JSON.stringify(TEMPLATES.blank.files)),
          activeFileId: 'f-1',
          framework: 'none',
          theme: 'monokai',
          updatedAt: Date.now()
        };
        list.unshift(newWs);
        saveWorkspaces(list);
        setActiveWorkspaceId(newWs.id);
        this.checkAndRender();
        return;
      }
      // Open the most recent one or cycle
      setActiveWorkspaceId(list[0].id);
      this.checkAndRender();
    });

    // Hook recent workspace clicks
    container.querySelectorAll('.cpg-recent-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.cpg-del-ws-btn')) return;
        const wsId = row.dataset.wsId;
        setActiveWorkspaceId(wsId);
        this.checkAndRender();
      });
    });

    // Hook delete workspace buttons
    container.querySelectorAll('.cpg-del-ws-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wsId = btn.dataset.delId;
        if (confirm('Delete this workspace?')) {
          let list = getSavedWorkspaces();
          list = list.filter(w => w.id !== wsId);
          saveWorkspaces(list);
          if (getActiveWorkspaceId() === wsId) setActiveWorkspaceId(null);
          this.checkAndRender();
        }
      });
    });
  },

  /* -------------------------------------------------------------
     FULL IDE WORKSPACE VIEW
     ------------------------------------------------------------- */
  renderIde(container, workspace) {
    const self_ = this;
    let state = {
      workspaceId: workspace.id,
      projectName: workspace.name,
      files: workspace.files || [],
      activeFileId: workspace.activeFileId || workspace.files?.[0]?.id || 'f-1',
      framework: workspace.framework || 'none',
      stdin: '',
      theme: workspace.theme || 'monokai',
      running: false,
      sidebarOpen: true,
      minimapOpen: true,
      terminalDrawerOpen: false, // Collapsed by default as requested
      activeDrawerTab: 'terminal', // 'terminal' | 'output' | 'problems'
      splitMode: 'code-only', // 'code-only' | 'split' | 'preview-only'
    };

    if (!state.files.length) {
      state.files = JSON.parse(JSON.stringify(TEMPLATES.blank.files));
      state.activeFileId = state.files[0].id;
    }

    container.innerHTML = `
      <div class="ide-root" id="cpg-root" style="display:flex; flex-direction:column; height:760px; background:#18181b; border:1px solid #27272a; border-radius:14px; overflow:hidden; color:#d4d4d4; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; transition:all 0.2s ease;">
        
        <!-- TOP TOOLBAR & CONTROLS -->
        <div id="cpg-header" style="background:#1f1f23; border-bottom:1px solid #27272a; padding:6px 12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <!-- Left: Workspaces back button, Sidebar toggle, Workspace Name, Language -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="ide-btn" id="cpg-close-ws-btn" title="Close workspace and return to workspaces list" style="font-weight:600;">
              ← Workspaces
            </button>
            <button type="button" class="ide-btn" id="cpg-toggle-sidebar" title="Toggle Sidebar (Ctrl+B)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
            <span style="font-weight:700; font-size:0.82rem; color:#fff; display:flex; align-items:center; gap:6px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <span id="cpg-logo-dot" style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#a1a1aa;"></span>
              ${escapeHtml(state.projectName)}
            </span>

            <select class="ide-select" id="cpg-langs" aria-label="Language Mode" style="font-size:0.78rem;">
              <optgroup label="Runs on your device (Offline)">
                ${Object.entries(LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
              <optgroup label="Compiled on a server">
                ${Object.entries(REMOTE_LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
            </select>

            <select class="ide-select" id="cpg-fw" hidden aria-label="CSS framework" style="font-size:0.78rem;">
              ${Object.entries(WEB_FRAMEWORKS).map(([id, f]) =>
                `<option value="${id}"${id === state.framework ? ' selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Right: Terminal Toggle, Theme, Palette, Layout, Clear, Run -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="ide-btn" id="cpg-toggle-term-top" title="Toggle Terminal Drawer (Ctrl+\`)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Terminal
            </button>

            <!-- Theme selector -->
            <select class="ide-select" id="cpg-theme-select" aria-label="Editor Theme" style="font-size:0.76rem;">
              ${Object.entries(IDE_THEMES).map(([k, t]) =>
                `<option value="${k}"${k === state.theme ? ' selected' : ''}>${t.name}</option>`).join('')}
            </select>

            <button type="button" class="ide-btn" id="cpg-cmd-palette" title="Command Palette (Ctrl+Shift+P)">
              <kbd style="font-size:0.68rem; background:#27272a; padding:2px 5px; border-radius:3px;">⌘⇧P</kbd>
            </button>
            <button type="button" class="ide-btn" id="cpg-layout-btn" title="Toggle Live Preview">Preview</button>
            <button type="button" class="ide-btn" id="cpg-package-zip" title="Package Workspace to ZIP">Package ZIP</button>
            <button type="button" class="ide-btn" id="cpg-sample">Example</button>
            <button type="button" class="ide-btn ide-btn-run" id="cpg-run" style="background:rgba(255,255,255,0.12); color:#ffffff; font-weight:600;">
              Run <kbd style="font-size:0.68rem; background:rgba(255,255,255,0.15); padding:1px 4px; border-radius:3px; margin-left:4px;">⌃↵</kbd>
            </button>
          </div>
        </div>

        <!-- MAIN WORKSPACE BODY (SIDEBAR + EDITOR + DOCKED TERMINAL) -->
        <div style="display:flex; flex:1; overflow:hidden; position:relative;">
          
          <!-- SIDEBAR FILE EXPLORER -->
          <div id="cpg-sidebar" style="width:200px; background:#252526; border-right:1px solid #333; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div id="cpg-project-badge" style="padding:5px 12px; font-size:0.72rem; color:#60a5fa; font-family:monospace; font-weight:600; border-bottom:1px solid #333; background:rgba(0,0,0,0.2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                /workspaces/${escapeHtml(state.projectName)}
              </div>
              <div style="padding:8px 12px; font-size:0.72rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center;">
                <span>Files</span>
                <button type="button" id="cpg-new-file" style="background:none; border:none; color:#bbb; cursor:pointer; font-size:1rem; padding:0 4px;" title="New File">+</button>
              </div>
              <div id="cpg-file-tree" style="display:flex; flex-direction:column;"></div>
            </div>

            <!-- Stdin Box for remote runs / C++ stdin -->
            <div id="cpg-stdin-wrap" hidden style="padding:10px; border-top:1px solid #333; background:#1e1e1e;">
              <div style="font-size:0.7rem; color:#888; margin-bottom:4px; font-weight:600;">Standard Input (stdin)</div>
              <textarea id="cpg-stdin" placeholder="cin input..." style="width:100%; height:50px; background:#2d2d2d; border:1px solid #444; color:#fff; font-family:monospace; font-size:0.74rem; padding:4px; resize:none; outline:none; border-radius:4px;"></textarea>
            </div>
          </div>

          <!-- EDITOR + PREVIEW + DOCKED BOTTOM TERMINAL -->
          <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#1e1e1e;">
            
            <!-- TABS BAR -->
            <div id="cpg-tabs-bar" style="background:#2d2d2d; border-bottom:1px solid #1e1e1e; display:flex; overflow-x:auto; scrollbar-width:none;"></div>

            <!-- CENTER SPLIT (CODE EDITOR + OPTIONAL PREVIEW) -->
            <div id="cpg-center-split" style="flex:1; display:flex; overflow:hidden; position:relative;">
              <!-- Editor Container -->
              <div id="cpg-editor-wrap" style="flex:1; display:flex; overflow:hidden; position:relative; background:#1e1e1e;">
                <div id="cpg-gutter" style="width:48px; background:#1e1e1e; color:#5a5a5a; font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px 6px; text-align:right; user-select:none; border-right:1px solid #2d2d2d; overflow:hidden;"></div>
                <textarea id="cpg-code" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" wrap="off" style="flex:1; background:#1e1e1e; color:#e6db74; font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px; border:none; outline:none; resize:none; white-space:pre; overflow:auto;"></textarea>
              </div>

              <!-- Visual Minimap -->
              <div id="cpg-minimap" style="width:80px; background:#181818; border-left:1px solid #282828; padding:8px 4px; overflow:hidden; user-select:none; opacity:0.65; cursor:pointer;" title="Visual Minimap">
                <div id="cpg-minimap-content" style="font-size:3px; line-height:4px; color:#a6e22e; font-family:monospace; white-space:pre; pointer-events:none;"></div>
              </div>

              <!-- Live Preview Pane (Hidden by default unless HTML preview is open) -->
              <div id="cpg-preview-pane" style="width:45%; background:#ffffff; border-left:1px solid #333; display:none; flex-direction:column; overflow:hidden;">
                <iframe id="cpg-preview" style="flex:1; width:100%; border:none; background:#fff;" sandbox="allow-scripts allow-modals allow-popups allow-forms"></iframe>
              </div>
            </div>

            <!-- DOCKED COLLAPSIBLE BOTTOM TERMINAL DRAWER -->
            <div id="cpg-bottom-drawer" style="display:none; height:200px; background:#141414; border-top:1px solid #333; flex-direction:column; overflow:hidden;">
              <!-- Drawer Header / Tabs -->
              <div style="background:#1f1f1f; border-bottom:1px solid #2d2d2d; padding:0 8px; display:flex; justify-content:space-between; align-items:center; height:32px;">
                <div style="display:flex; gap:4px; height:100%;">
                  <button type="button" class="cpg-drawer-tab active" data-tab="terminal">Terminal</button>
                  <button type="button" class="cpg-drawer-tab" data-tab="output">Output</button>
                  <button type="button" class="cpg-drawer-tab" data-tab="problems">Problems</button>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span id="cpg-timing" style="color:#a1a1aa; font-size:0.72rem; font-family:monospace;"></span>
                  <button type="button" class="ide-btn-icon" id="cpg-term-clear-btn" title="Clear Console">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                  <button type="button" class="ide-btn-icon" id="cpg-term-close-btn" title="Close Terminal (Ctrl+\`)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <!-- Tab Panes -->
              <div id="cpg-pane-terminal" class="cpg-drawer-pane" style="flex:1; overflow:auto; padding:8px 12px; font-family:'Fira Code', Consolas, monospace; font-size:0.8rem; color:#e4e4e7;">
                <div id="cpg-term-history" style="white-space:pre-wrap; line-height:1.45;"></div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                  <span style="color:#a1a1aa; font-weight:600;">workspace $</span>
                  <input type="text" id="cpg-term-input" autocomplete="off" spellcheck="false" style="flex:1; background:transparent; border:none; outline:none; color:#ffffff; font-family:inherit; font-size:inherit;" />
                </div>
              </div>

              <div id="cpg-pane-output" class="cpg-drawer-pane" style="display:none; flex:1; overflow:auto; padding:8px 12px; font-family:'Fira Code', Consolas, monospace; font-size:0.8rem; color:#d4d4d4; white-space:pre-wrap; line-height:1.45;">
                <div id="cpg-console"></div>
              </div>

              <div id="cpg-pane-problems" class="cpg-drawer-pane" style="display:none; flex:1; overflow:auto; padding:12px; font-size:0.8rem; color:#888;">
                <div id="cpg-problems-content">No errors detected in workspace.</div>
              </div>
            </div>

          </div>

        </div>

        <!-- STATUS BAR -->
        <div id="cpg-status-bar" style="background:#18181b; border-top:1px solid #27272a; color:#a1a1aa; padding:4px 12px; font-size:0.72rem; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:14px; align-items:center;">
            <button type="button" id="cpg-status-term-toggle" style="background:none; border:none; color:#a1a1aa; cursor:pointer; font-size:inherit; display:flex; align-items:center; gap:5px; padding:0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Terminal
            </button>
            <span id="cpg-status-pos">Line 1, Column 1</span>
            <span id="cpg-status-spaces">Spaces: 2</span>
            <span id="cpg-status-encoding">UTF-8</span>
          </div>
          <div style="display:flex; gap:14px; align-items:center;">
            <span id="cpg-note" style="color:#a1a1aa; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
            <span id="cpg-status-lang" style="font-weight:600; text-transform:uppercase;">JAVASCRIPT</span>
          </div>
        </div>

        <!-- COMMAND PALETTE MODAL (HIDDEN) -->
        <div id="cpg-palette-modal" style="display:none; position:absolute; top:40px; left:50%; transform:translateX(-50%); width:480px; max-width:90%; background:#252526; border:1px solid #454545; border-radius:8px; box-shadow:0 16px 48px rgba(0,0,0,0.6); z-index:100; overflow:hidden;">
          <input type="text" id="cpg-palette-input" placeholder="Type a command or language..." style="width:100%; padding:10px 14px; background:#1e1e1e; border:none; border-bottom:1px solid #333; color:#fff; font-size:0.86rem; outline:none;">
          <div id="cpg-palette-list" style="max-height:240px; overflow-y:auto;"></div>
        </div>

      </div>
    `;

    // References
    const rootEl = container.querySelector('#cpg-root');
    const headerEl = container.querySelector('#cpg-header');
    const codeEl = container.querySelector('#cpg-code');
    const gutterEl = container.querySelector('#cpg-gutter');
    const editorWrap = container.querySelector('#cpg-editor-wrap');
    const minimapEl = container.querySelector('#cpg-minimap');
    const minimapContent = container.querySelector('#cpg-minimap-content');
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
    const layoutBtn = container.querySelector('#cpg-layout-btn');
    const themeSelect = container.querySelector('#cpg-theme-select');
    const packageZipBtn = container.querySelector('#cpg-package-zip');
    const runBtn = container.querySelector('#cpg-run');
    const noteEl = container.querySelector('#cpg-note');
    const timingEl = container.querySelector('#cpg-timing');
    const consoleEl = container.querySelector('#cpg-console');
    const bottomDrawer = container.querySelector('#cpg-bottom-drawer');
    const termHistory = container.querySelector('#cpg-term-history');
    const termInput = container.querySelector('#cpg-term-input');
    const problemsContent = container.querySelector('#cpg-problems-content');

    // Return to Workspaces Landing
    container.querySelector('#cpg-close-ws-btn')?.addEventListener('click', () => {
      persist();
      setActiveWorkspaceId(null);
      self_.checkAndRender();
    });

    // Theme Application
    function applyTheme(themeKey) {
      const th = IDE_THEMES[themeKey] || IDE_THEMES.monokai;
      state.theme = themeKey;
      rootEl.style.background = th.bg;
      headerEl.style.background = th.header;
      sidebar.style.background = th.sidebar;
      editorWrap.style.background = th.bg;
      codeEl.style.background = th.bg;
      codeEl.style.color = th.text;
      gutterEl.style.background = th.bg;
      gutterEl.style.color = th.gutter;
      minimapContent.style.color = th.terminalText;
      persist();
    }

    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    applyTheme(state.theme);

    this._onThemeChange = (e) => {
      const gTheme = e.detail?.theme;
      if (gTheme === 'neon-tokyo' || gTheme === 'cyber-neon') applyTheme('cyber-matrix');
      else if (gTheme === 'solar-blue') applyTheme('tokyo-night');
      else if (gTheme === 'white-on-black') applyTheme('monokai');
      else if (gTheme === 'default' || gTheme === 'cozy-pink') applyTheme('github-light');
      themeSelect.value = state.theme;
    };
    window.addEventListener('toolbox:themechange', this._onThemeChange);

    function getActiveFile() {
      return state.files.find(f => f.id === state.activeFileId) || state.files[0];
    }

    function renderTabs() {
      const th = IDE_THEMES[state.theme] || IDE_THEMES.monokai;
      tabsBar.innerHTML = state.files.map(f => `
        <div class="ide-tab ${f.id === state.activeFileId ? 'active' : ''}" data-id="${f.id}" style="padding:6px 14px; font-size:0.78rem; font-family:monospace; background:${f.id === state.activeFileId ? th.tabActive : th.tabInactive}; color:${f.id === state.activeFileId ? '#fff' : '#888'}; border-right:1px solid rgba(0,0,0,0.2); cursor:pointer; display:flex; align-items:center; gap:8px;">
          <span>${escapeHtml(f.name)}</span>
          ${state.files.length > 1 ? `<span class="ide-tab-close" data-id="${f.id}" style="color:#666; font-size:0.9rem; line-height:1;">&times;</span>` : ''}
        </div>
      `).join('');

      tabsBar.querySelectorAll('.ide-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          if (e.target.classList.contains('ide-tab-close')) return;
          state.activeFileId = tab.dataset.id;
          loadFile();
          renderTabs();
          renderFileTree();
        });
      });

      tabsBar.querySelectorAll('.ide-tab-close').forEach(closeBtn => {
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
        <div class="ide-tree-item ${f.id === state.activeFileId ? 'active' : ''}" data-id="${f.id}" style="padding:5px 14px; font-size:0.78rem; font-family:monospace; color:${f.id === state.activeFileId ? '#fff' : '#aaa'}; background:${f.id === state.activeFileId ? 'rgba(255,255,255,0.08)' : 'transparent'}; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          <span>${escapeHtml(f.name)}</span>
        </div>
      `).join('');

      fileTree.querySelectorAll('.ide-tree-item').forEach(item => {
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
      const statusLang = container.querySelector('#cpg-status-lang');
      if (statusLang) statusLang.textContent = (file.lang || 'javascript').toUpperCase();
      applyLanguage(file.lang || 'javascript');
      renderGutterAndMinimap();
    }

    function persist() {
      try {
        const list = getSavedWorkspaces();
        const wsIdx = list.findIndex(w => w.id === state.workspaceId);
        const updated = {
          id: state.workspaceId,
          name: state.projectName,
          files: state.files,
          activeFileId: state.activeFileId,
          framework: state.framework,
          theme: state.theme,
          updatedAt: Date.now()
        };
        if (wsIdx !== -1) list[wsIdx] = updated;
        else list.unshift(updated);
        saveWorkspaces(list);
      } catch {}

      // Write active file to filesystem
      const cur = getActiveFile();
      if (cur) {
        fs.writeFile(`/Projects/${state.projectName}/${cur.name}`, cur.content).catch(() => {});
      }
    }

    codeEl.addEventListener('input', () => {
      const file = getActiveFile();
      if (file) {
        file.content = codeEl.value;
        persist();
      }
      renderGutterAndMinimap();
    });

    codeEl.addEventListener('scroll', () => {
      gutterEl.scrollTop = codeEl.scrollTop;
    });

    codeEl.addEventListener('keyup', updateCursorPosition);
    codeEl.addEventListener('click', updateCursorPosition);

    function updateCursorPosition() {
      const selStart = codeEl.selectionStart;
      const text = codeEl.value.substring(0, selStart);
      const lines = text.split('\n');
      const lineNum = lines.length;
      const colNum = lines[lines.length - 1].length + 1;
      const posEl = container.querySelector('#cpg-status-pos');
      if (posEl) posEl.textContent = `Line ${lineNum}, Column ${colNum}`;
    }

    // Sidebar Toggle
    toggleSidebarBtn.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      sidebar.style.display = state.sidebarOpen ? 'flex' : 'none';
    });

    // Terminal Drawer Toggle Handlers
    function toggleTerminalDrawer(forceState) {
      if (typeof forceState === 'boolean') {
        state.terminalDrawerOpen = forceState;
      } else {
        state.terminalDrawerOpen = !state.terminalDrawerOpen;
      }
      bottomDrawer.style.display = state.terminalDrawerOpen ? 'flex' : 'none';
      if (state.terminalDrawerOpen && state.activeDrawerTab === 'terminal') {
        termInput.focus();
      }
    }

    container.querySelector('#cpg-toggle-term-top')?.addEventListener('click', () => toggleTerminalDrawer());
    container.querySelector('#cpg-status-term-toggle')?.addEventListener('click', () => toggleTerminalDrawer());
    container.querySelector('#cpg-term-close-btn')?.addEventListener('click', () => toggleTerminalDrawer(false));

    // Drawer Tabs switching
    container.querySelectorAll('.cpg-drawer-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        container.querySelectorAll('.cpg-drawer-tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
        state.activeDrawerTab = tabBtn.dataset.tab;

        container.querySelectorAll('.cpg-drawer-pane').forEach(p => p.style.display = 'none');
        if (state.activeDrawerTab === 'terminal') {
          container.querySelector('#cpg-pane-terminal').style.display = 'flex';
          termInput.focus();
        } else if (state.activeDrawerTab === 'output') {
          container.querySelector('#cpg-pane-output').style.display = 'block';
        } else if (state.activeDrawerTab === 'problems') {
          container.querySelector('#cpg-pane-problems').style.display = 'block';
        }
      });
    });

    // Terminal clear
    container.querySelector('#cpg-term-clear-btn')?.addEventListener('click', () => {
      if (state.activeDrawerTab === 'terminal') {
        termHistory.innerHTML = '';
      } else {
        consoleEl.innerHTML = '';
        timingEl.textContent = '';
      }
    });

    // Interactive Terminal Shell
    const termCommandHistory = [];
    let termHistoryCursor = -1;

    function printTerm(line, color = '#a6e22e') {
      const el = document.createElement('div');
      el.style.color = color;
      el.textContent = line;
      termHistory.appendChild(el);
      termHistory.parentElement.scrollTop = termHistory.parentElement.scrollHeight;
    }

    printTerm(`Toolbox Terminal v2.1.0 [Workspace: ${state.projectName}]`, '#38bdf8');
    printTerm(`Type 'help' for available commands. Run 'run' to execute active file.\n`, '#71717a');

    termInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        termInput.value = '';
        if (!cmd) return;

        printTerm(`workspace $ ${cmd}`, '#ffffff');
        termCommandHistory.push(cmd);
        termHistoryCursor = termCommandHistory.length;

        const parts = cmd.split(' ');
        const main = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ').trim();

        switch (main) {
          case 'help':
            printTerm('Available commands:');
            printTerm('  run             Compile and run active file');
            printTerm('  ls              List all workspace files');
            printTerm('  cat <filename>  Print file contents');
            printTerm('  clear           Clear terminal screen');
            printTerm('  pwd             Show workspace path');
            printTerm('  help            Display this help reference');
            break;
          case 'pwd':
            printTerm(`/workspaces/${state.projectName}`);
            break;
          case 'ls':
            state.files.forEach(f => {
              printTerm(`  ${f.name.padEnd(20)} (${f.lang || 'text'}, ${f.content.length} bytes)`, '#38bdf8');
            });
            break;
          case 'cat':
            if (!arg) {
              printTerm('Usage: cat <filename>', '#ef4444');
            } else {
              const target = state.files.find(f => f.name.toLowerCase() === arg.toLowerCase());
              if (target) printTerm(target.content, '#d4d4d4');
              else printTerm(`File not found: ${arg}`, '#ef4444');
            }
            break;
          case 'clear':
            termHistory.innerHTML = '';
            break;
          case 'run':
            run();
            break;
          default:
            printTerm(`Command not recognized: ${main}. Type 'help' for commands.`, '#ef4444');
        }
      } else if (e.key === 'ArrowUp') {
        if (termHistoryCursor > 0) {
          termHistoryCursor--;
          termInput.value = termCommandHistory[termHistoryCursor] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (termHistoryCursor < termCommandHistory.length - 1) {
          termHistoryCursor++;
          termInput.value = termCommandHistory[termHistoryCursor] || '';
        } else {
          termHistoryCursor = termCommandHistory.length;
          termInput.value = '';
        }
      }
    });

    // Shortcut: Ctrl+` toggles terminal drawer
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminalDrawer();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    });

    // New File creation
    newFileBtn.addEventListener('click', () => {
      const name = prompt('Enter new filename:', `script_${state.files.length + 1}.js`);
      if (!name || !name.trim()) return;
      let ext = name.split('.').pop().toLowerCase();
      let lang = 'javascript';
      if (ext === 'py') lang = 'python';
      if (ext === 'html') lang = 'html';
      if (ext === 'sql') lang = 'sql';
      if (ext === 'ts') lang = 'typescript';
      if (ext === 'cpp' || ext === 'cc') lang = 'cpp';

      const newFile = {
        id: `f-${Date.now()}`,
        name: name.trim(),
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

    // Package ZIP Button
    if (packageZipBtn) {
      packageZipBtn.addEventListener('click', async () => {
        packageZipBtn.disabled = true;
        packageZipBtn.textContent = 'Packaging...';
        try {
          const projDir = `/Projects/${state.projectName}`;
          await fs.mkdir(projDir);
          for (const f of state.files) {
            await fs.writeFile(`${projDir}/${f.name}`, f.content);
          }
          const zipPath = `/Projects/${state.projectName}.zip`;
          const res = await fs.compressDirectory(projDir, zipPath);
          packageZipBtn.textContent = 'Packaged!';
          printTerm(`[Package] Saved ${res.path} (${res.size} bytes). Visible in Files.`, '#38bdf8');
          setTimeout(() => { packageZipBtn.textContent = 'Package ZIP'; packageZipBtn.disabled = false; }, 2500);
        } catch (err) {
          packageZipBtn.textContent = 'Error';
          printTerm(`[Package Error] ${err.message}`, '#ef4444');
          setTimeout(() => { packageZipBtn.textContent = 'Package ZIP'; packageZipBtn.disabled = false; }, 2500);
        }
      });
    }

    // Toggle Preview layout
    layoutBtn.addEventListener('click', () => {
      if (state.splitMode === 'code-only') {
        state.splitMode = 'split';
        previewPane.style.display = 'flex';
        layoutBtn.textContent = 'Split ▾';
      } else {
        state.splitMode = 'code-only';
        previewPane.style.display = 'none';
        layoutBtn.textContent = 'Preview';
      }
    });

    // Console output logger
    function line(level, text) {
      const el = document.createElement('div');
      el.className = `cpg-line cpg-${level}`;
      el.style.color = level === 'error' ? '#ef4444' : (level === 'muted' ? '#71717a' : (level === 'warn' ? '#eab308' : '#a6e22e'));
      el.textContent = text;
      consoleEl.appendChild(el);
      consoleEl.parentElement.scrollTop = consoleEl.parentElement.scrollHeight;

      if (level === 'error') {
        problemsContent.textContent = text;
        problemsContent.style.color = '#ef4444';
      }
    }

    function clearConsole() {
      consoleEl.innerHTML = '';
      timingEl.textContent = '';
      problemsContent.textContent = 'No errors detected in workspace.';
      problemsContent.style.color = '#71717a';
    }

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

      // Open terminal drawer to Output tab automatically on run
      toggleTerminalDrawer(true);
      container.querySelectorAll('.cpg-drawer-tab').forEach(t => t.classList.remove('active'));
      container.querySelector('[data-tab="output"]')?.classList.add('active');
      container.querySelectorAll('.cpg-drawer-pane').forEach(p => p.style.display = 'none');
      container.querySelector('#cpg-pane-output').style.display = 'block';

      const lang = langsSelect.value;
      let source = codeEl.value;

      if (!source.trim()) { line('muted', 'Nothing to run.'); idle(); return; }

      if (isPreview(lang)) {
        previewPane.style.display = 'flex';
        previewEl.srcdoc = buildPreviewDocument(source, state.framework);
        line('muted', 'Sandbox preview updated.');
        timingEl.textContent = WEB_FRAMEWORKS[state.framework]?.name || 'HTML';
        idle();
        self_.analytics?.completed?.({ outputKind: 'html' });
        return;
      }

      if (isRemote(lang)) {
        const meta = REMOTE_LANGUAGES[lang];
        line('muted', `Compiling ${meta.name} on remote server...`);
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
          if (err.name === 'AbortError') {
            line('muted', 'Stopped.');
          } else {
            line('warn', `Offline note: ${meta.name} requires remote server connection. Switch to C++, Python, JavaScript, or TypeScript for offline execution.`);
          }
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
        else if (type === 'status') line('muted', text);
        else if (type === 'done') {
          timingEl.textContent = `finished in ${Number(text).toLocaleString()} ms`;
          idle();
        }
      };

      worker.onerror = (err) => abort(err.message || 'Runtime execution failed.');
      const limit = RUN_TIMEOUT_MS[lang] ?? DEFAULT_TIMEOUT_MS;
      self_._timer = setTimeout(() => abort(`Execution timeout after ${limit / 1000}s.`), limit);
      worker.postMessage({ code: source, stdin: stdinEl.value });
    }

    runBtn.addEventListener('click', run);

    function applyLanguage(id) {
      const l = ALL[id];
      const remote = isRemote(id);
      const preview = isPreview(id);

      noteEl.innerHTML = remote
        ? `Compiled with ${l.compiler} on remote server.`
        : `${l.note || ''}`;

      if (preview) {
        previewPane.style.display = 'flex';
        previewEl.srcdoc = buildPreviewDocument(codeEl.value, state.framework);
        fwEl.hidden = false;
      } else {
        if (state.splitMode === 'code-only') previewPane.style.display = 'none';
        fwEl.hidden = true;
      }

      stdinWrap.hidden = !remote && id !== 'cpp';
    }

    langsSelect.addEventListener('change', (e) => {
      const file = getActiveFile();
      if (file) {
        file.lang = e.target.value;
        const statusLang = container.querySelector('#cpg-status-lang');
        if (statusLang) statusLang.textContent = file.lang.toUpperCase();
        persist();
      }
      applyLanguage(e.target.value);
    });

    container.querySelector('#cpg-sample')?.addEventListener('click', () => {
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
    if (this._onThemeChange) window.removeEventListener('toolbox:themechange', this._onThemeChange);
    for (const w of Object.values(this._workers || {})) w.terminate();
    this._workers = {};
    clearTimeout(this._timer);
  }
};

function injectIdeStyles() {
  if (document.getElementById('ide-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'ide-editor-styles';
  style.textContent = `
    .ide-btn {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #cccccc;
      border-radius: 9999px;
      padding: 4px 10px;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .ide-btn:hover { background: rgba(255,255,255,0.18); color: #ffffff; }
    .ide-btn-icon {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
    }
    .ide-btn-icon:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .ide-select {
      background: #1e1e1e;
      border: 1px solid rgba(255,255,255,0.15);
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 9999px;
      outline: none;
    }
    .ide-tab:hover { background: rgba(255,255,255,0.08) !important; color: #ffffff !important; }
    .ide-tree-item:hover { background: rgba(255,255,255,0.06) !important; color: #ffffff !important; }
    .cpg-card-action:hover {
      border-color: #60a5fa !important;
      background: #2d2d30 !important;
      transform: translateY(-1px);
    }
    .cpg-tpl-pill {
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 9999px;
      padding: 6px 14px;
      color: #e4e4e7;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .cpg-tpl-pill:hover {
      border-color: #38bdf8;
      color: #38bdf8;
      background: #3f3f46;
    }
    .cpg-recent-row:hover {
      border-color: #52525b !important;
      background: #323236 !important;
    }
    .cpg-drawer-tab {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: #888;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 0 10px;
      cursor: pointer;
      height: 100%;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cpg-drawer-tab:hover { color: #ddd; }
    .cpg-drawer-tab.active {
      color: #fff;
      border-bottom-color: #38bdf8;
    }
  `;
  document.head.appendChild(style);
}
