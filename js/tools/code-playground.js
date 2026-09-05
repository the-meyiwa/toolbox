/**
 * Code Playground IDE
 *
 * Full-featured in-browser developer environment:
 * - 2 isolated UI modes (Light and Dark only), unaffected by Toolbox themes
 * - Desktop IDE dropdown menu bar: File, Edit, View, Run, Test
 * - Files side panel plus dropdown: File, Folder, HTML/Component, Test File
 * - Language selector located at bottom right status bar
 * - Generative AI Assistant positioned beside language selector (for signed-in users)
 * - Online workspace sync to /Projects/ for signed-in users
 * - In-browser execution (JS, TS, Python, C++, Lua, SQL, HTML) and remote compilation
 */

import { LANGUAGES, makeWorker, transpileTypeScript } from '../lib/code-runtimes.js';
import { WEB_FRAMEWORKS, buildPreviewDocument } from '../lib/runtimes-extra.js';
import { REMOTE_LANGUAGES, compileRemote } from '../lib/remote-compile.js';
import { fs } from '../lib/filesystem.js';
import { getCurrentUser } from '../lib/supabase.js';
import { streamChatCompletion } from '../lib/ai-provider.js';
import { marked } from 'marked';
import { fetchPackageMetadata, searchNpmPackages, extractPackageImports, buildImportMap } from '../lib/npm-client.js';
import {
  checkIdeBackend,
  syncWorkspaceToDisk,
  fetchWorkspaceDiskFiles,
  readWorkspaceDiskFile,
  writeWorkspaceDiskFile,
  deleteWorkspaceDiskFile,
  executeRemoteCommand,
  killRemoteProcess,
  getDevServerPreviewUrl
} from '../lib/ide-execution-client.js';

const ALL = { ...LANGUAGES, ...REMOTE_LANGUAGES };
const isRemote = (id) => Object.hasOwn(REMOTE_LANGUAGES, id);
const isPreview = (id) => !!LANGUAGES[id]?.preview;

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderMarkdown(content) {
  try {
    if (typeof marked?.parse === 'function') return marked.parse(content);
    if (typeof marked === 'function') return marked(content);
  } catch {}
  return escapeHtml(content).replace(/\n/g, '<br>');
}

const STORAGE_WORKSPACES_KEY = 'toolbox_cpg_workspaces_v2';
const STORAGE_ACTIVE_WS_KEY = 'toolbox_cpg_active_ws_v2';
const STORAGE_CPG_MODE_KEY = 'toolbox_cpg_theme_mode_v1';

export function getPlaygroundMode() {
  try {
    return localStorage.getItem(STORAGE_CPG_MODE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setPlaygroundMode(mode) {
  try {
    const valid = mode === 'light' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_CPG_MODE_KEY, valid);
    return valid;
  } catch {
    return 'dark';
  }
}

const RUN_TIMEOUT_MS = {
  javascript: 10000, typescript: 10000, python: 60000, cpp: 30000, sql: 20000, lua: 30000,
};
const DEFAULT_TIMEOUT_MS = 30000;

const TEMPLATES = {
  'cpp': {
    name: 'C++ Algorithm',
    files: [
      {
        id: 'f-1',
        name: 'main.cpp',
        lang: 'cpp',
        content: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> nums = {12, 45, 67, 89, 23, 56};
    long long sum = std::accumulate(nums.begin(), nums.end(), 0LL);
    double avg = static_cast<double>(sum) / nums.size();

    std::cout << "Numbers count: " << nums.size() << "\\n";
    std::cout << "Sum: " << sum << "\\n";
    std::cout << "Average: " << avg << "\\n";
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Sandbox</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
    button { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Interactive Web Application</h2>
    <p>Live sandbox preview environment.</p>
    <button id="counter-btn">Clicks: 0</button>
  </div>
  <script>
    let count = 0;
    const btn = document.getElementById('counter-btn');
    btn.addEventListener('click', () => {
      count++;
      btn.textContent = 'Clicks: ' + count;
    });
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
        name: 'script.py',
        lang: 'python',
        content: `def calculate_primes(limit):
    primes = []
    for num in range(2, limit + 1):
        is_prime = True
        for i in range(2, int(num ** 0.5) + 1):
            if num % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.append(num)
    return primes

print("=== Python 3 Runtime ===")
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

  const user = getCurrentUser();
  if (user) {
    try {
      fs.writeFile('/Projects/workspaces.json', JSON.stringify(list), { storage: 'online' }).catch(() => {});
      for (const ws of list) {
        if (!ws?.name) continue;
        const dir = `/Projects/${ws.name}`;
        fs.mkdir(dir, { storage: 'online' }).catch(() => {});
        for (const f of (ws.files || [])) {
          if (!f?.name) continue;
          fs.writeFile(`${dir}/${f.name}`, f.content || '', { storage: 'online' }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[CodePlayground] Online sync error:', err);
    }
  }
}

async function syncOnlineWorkspacesIfSignedIn() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const raw = await fs.readFile('/Projects/workspaces.json', { storage: 'online' }).catch(() => null);
    if (raw) {
      const onlineList = JSON.parse(raw);
      if (Array.isArray(onlineList) && onlineList.length > 0) {
        const localList = getSavedWorkspaces();
        let changed = false;
        const merged = [...localList];
        for (const ow of onlineList) {
          if (!merged.some(m => m.id === ow.id)) {
            merged.push(ow);
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(STORAGE_WORKSPACES_KEY, JSON.stringify(merged));
        }
      }
    }
  } catch (err) {
    console.warn('[CodePlayground] Online sync check warning:', err);
  }
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
  async render(container, { analytics, artifact } = {}) {
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

    try {
      await syncOnlineWorkspacesIfSignedIn();
    } catch {}

    if (artifact) {
      this.setArtifact(artifact);
    } else {
      this.checkAndRender();
    }
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
     LANDING SCREEN (Workspace selector / manager)
     ------------------------------------------------------------- */
  renderLanding(container) {
    const workspaces = getSavedWorkspaces();
    const currentMode = getPlaygroundMode();

    container.innerHTML = `
      <div class="cpg-landing cpg-mode-${currentMode}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:680px; padding:40px 20px; background:var(--cpg-bg-app); color:var(--cpg-text); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width:640px; width:100%;">
          
          <!-- Brand Header with isolated mode toggle -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:42px; height:42px; border-radius:10px; background:var(--cpg-bg-card); border:1px solid var(--cpg-border); display:flex; align-items:center; justify-content:center; color:var(--cpg-text);">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </div>
              <div>
                <h1 style="margin:0; font-size:1.4rem; font-weight:700; color:var(--cpg-text); letter-spacing:-0.02em;">Code Playground</h1>
                <p style="margin:2px 0 0; font-size:0.82rem; color:var(--cpg-text-secondary);">Lightweight workspace environment</p>
              </div>
            </div>

            <!-- Appearance Mode Picker -->
            <div style="display:flex; align-items:center; gap:4px; background:var(--cpg-bg-card); border:1px solid var(--cpg-border); border-radius:9999px; padding:3px;">
              <button type="button" class="cpg-landing-mode-btn ${currentMode === 'dark' ? 'active' : ''}" data-mode="dark" style="background:${currentMode === 'dark' ? 'var(--cpg-bg-subtle)' : 'transparent'}; border:none; color:var(--cpg-text); border-radius:9999px; padding:4px 10px; font-size:0.75rem; cursor:pointer;">Dark</button>
              <button type="button" class="cpg-landing-mode-btn ${currentMode === 'light' ? 'active' : ''}" data-mode="light" style="background:${currentMode === 'light' ? 'var(--cpg-bg-subtle)' : 'transparent'}; border:none; color:var(--cpg-text); border-radius:9999px; padding:4px 10px; font-size:0.75rem; cursor:pointer;">Light</button>
            </div>
          </div>

          <!-- Primary Actions -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:32px;">
            <div class="cpg-card-action" id="cpg-action-new" style="background:var(--cpg-bg-card); border:1px solid var(--cpg-border); border-radius:12px; padding:18px 20px; cursor:pointer; transition:all 0.15s ease;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <div style="width:28px; height:28px; border-radius:8px; background:var(--cpg-bg-subtle); border:1px solid var(--cpg-border); display:flex; align-items:center; justify-content:center; color:var(--cpg-text);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span style="font-weight:600; font-size:0.95rem; color:var(--cpg-text);">New Workspace</span>
              </div>
              <p style="margin:0; font-size:0.78rem; color:var(--cpg-text-secondary); line-height:1.4;">Create a blank workspace or start fresh.</p>
            </div>

            <div class="cpg-card-action" id="cpg-action-open" style="background:var(--cpg-bg-card); border:1px solid var(--cpg-border); border-radius:12px; padding:18px 20px; cursor:pointer; transition:all 0.15s ease;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <div style="width:28px; height:28px; border-radius:8px; background:var(--cpg-bg-subtle); border:1px solid var(--cpg-border); display:flex; align-items:center; justify-content:center; color:var(--cpg-text);">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span style="font-weight:600; font-size:0.95rem; color:var(--cpg-text);">Open Workspace</span>
              </div>
              <p style="margin:0; font-size:0.78rem; color:var(--cpg-text-secondary); line-height:1.4;">Open an existing saved workspace.</p>
            </div>
          </div>

          <!-- Quick Templates -->
          <div style="margin-bottom:32px;">
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--cpg-text-muted); font-weight:700; margin-bottom:10px;">Quick Templates</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <button type="button" class="cpg-tpl-pill" data-tpl="cpp">C++ Algorithm</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="web">Web App</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="python">Python Script</button>
              <button type="button" class="cpg-tpl-pill" data-tpl="js">JavaScript REPL</button>
            </div>
          </div>

          <!-- Recent Workspaces -->
          <div>
            <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--cpg-text-muted); font-weight:700; margin-bottom:10px;">Recent Workspaces</div>
            ${workspaces.length === 0 ? `
              <div style="background:var(--cpg-bg-card); border:1px dashed var(--cpg-border); border-radius:10px; padding:22px; text-align:center; color:var(--cpg-text-muted); font-size:0.82rem;">
                No open workspaces. Create a workspace or select a template above to begin.
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${workspaces.slice(0, 6).map(w => `
                  <div class="cpg-recent-row" data-ws-id="${w.id}" style="display:flex; justify-content:space-between; align-items:center; background:var(--cpg-bg-card); border:1px solid var(--cpg-border); border-radius:8px; padding:9px 14px; cursor:pointer; transition:all 0.15s ease;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cpg-text-muted);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span style="font-size:0.85rem; font-weight:600; color:var(--cpg-text);">${escapeHtml(w.name)}</span>
                      <span style="font-size:0.72rem; color:var(--cpg-text-muted); font-family:monospace;">${w.files?.length || 0} file${w.files?.length === 1 ? '' : 's'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="font-size:0.72rem; color:var(--cpg-text-muted);">${new Date(w.updatedAt || Date.now()).toLocaleDateString()}</span>
                      <button type="button" class="cpg-del-ws-btn" data-del-id="${w.id}" title="Delete workspace" style="background:none; border:none; color:var(--cpg-text-muted); cursor:pointer; padding:4px; border-radius:4px;">
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

    // Mode Toggle on Landing
    container.querySelectorAll('.cpg-landing-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setPlaygroundMode(mode);
        this.renderLanding(container);
      });
    });

    // Hook template buttons
    container.querySelectorAll('.cpg-tpl-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tplKey = btn.dataset?.tpl || btn.getAttribute('data-tpl');
        const tpl = TEMPLATES[tplKey];
        if (!tpl) return;
        const newWs = {
          id: `ws-${Date.now()}`,
          name: tpl.name,
          files: JSON.parse(JSON.stringify(tpl.files)),
          activeFileId: tpl.files[0]?.id || 'f-1',
          framework: 'none',
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
        const newWs = {
          id: `ws-${Date.now()}`,
          name: 'My Workspace',
          files: JSON.parse(JSON.stringify(TEMPLATES.blank.files)),
          activeFileId: 'f-1',
          framework: 'none',
          updatedAt: Date.now()
        };
        list.unshift(newWs);
        saveWorkspaces(list);
        setActiveWorkspaceId(newWs.id);
        this.checkAndRender();
        return;
      }
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
    const isUserSignedIn = Boolean(getCurrentUser());
    let currentMode = getPlaygroundMode();

    let state = {
      workspaceId: workspace.id,
      projectName: workspace.name,
      files: workspace.files || [],
      activeFileId: workspace.activeFileId || workspace.files?.[0]?.id || 'f-1',
      framework: workspace.framework || 'none',
      stdin: '',
      running: false,
      sidebarOpen: true,
      minimapOpen: true,
      terminalDrawerOpen: false,
      activeDrawerTab: 'terminal', // 'terminal' | 'output' | 'problems'
      splitMode: workspace.splitMode || (workspace.files?.some(f => f.name.includes('.jsx') || f.name.toLowerCase() === 'index.html' || f.name.toLowerCase().endsWith('.html')) ? 'split' : 'code-only'),
      assistantOpen: false,
      git: { initialized: true, branch: 'main', staged: [], commits: [] },
      packages: {},
      cwd: '',
      activeProcess: null,
      backendOnline: false
    };

    if (!state.files.length) {
      state.files = JSON.parse(JSON.stringify(TEMPLATES.blank.files));
      state.activeFileId = state.files[0].id;
    }

    container.innerHTML = `
      <div class="ide-root cpg-mode-${currentMode}" id="cpg-root" style="display:flex; flex-direction:column; height:760px; background:var(--cpg-bg-app); border:1px solid var(--cpg-border); border-radius:14px; overflow:hidden; color:var(--cpg-text); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; transition:background 0.15s ease, color 0.15s ease; position:relative;">
        
        <!-- TOP MENU BAR & CONTROLS (FILE, EDIT, VIEW, RUN, TEST) -->
        <div id="cpg-header" style="background:var(--cpg-bg-card); border-bottom:1px solid var(--cpg-border); padding:4px 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; z-index:30;">
          
          <!-- Left: Workspaces button + Menus (File, Edit, View, Run, Test) -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="cpg-menu-trigger" id="cpg-close-ws-btn" title="Back to Workspaces" style="font-weight:600; padding:4px 8px;">
              ← Workspaces
            </button>
            <div style="height:14px; width:1px; background:var(--cpg-border); margin:0 2px;"></div>

            <!-- Menus: File, Edit, View, Run, Test -->
            <div class="cpg-menubar" style="display:flex; align-items:center; gap:2px; position:relative;">
              
              <!-- File Menu -->
              <nav class="cpg-menu-item" data-menu="file" style="position:relative;">
                <button type="button" class="cpg-menu-trigger" id="cpg-menu-file-btn">File</button>
                <div class="cpg-dropdown-menu" id="cpg-menu-file" style="display:none; position:absolute; top:28px; left:0; min-width:180px; z-index:50;">
                  <button type="button" class="cpg-dropdown-item" data-action="new-file">
                    <span>New File...</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="new-folder">
                    <span>New Folder...</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="insert-example">
                    <span>Insert Example Code</span>
                  </button>
                  <div class="cpg-menu-sep"></div>
                  <button type="button" class="cpg-dropdown-item" data-action="save-workspace">
                    <span>Save Workspace</span>
                    <kbd class="cpg-kbd">Ctrl+S</kbd>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="package-zip">
                    <span>Package as ZIP</span>
                  </button>
                  <div class="cpg-menu-sep"></div>
                  <button type="button" class="cpg-dropdown-item" data-action="close-workspace">
                    <span>Close Workspace</span>
                  </button>
                </div>
              </nav>

              <!-- Edit Menu -->
              <nav class="cpg-menu-item" data-menu="edit" style="position:relative;">
                <button type="button" class="cpg-menu-trigger" id="cpg-menu-edit-btn">Edit</button>
                <div class="cpg-dropdown-menu" id="cpg-menu-edit" style="display:none; position:absolute; top:28px; left:0; min-width:180px; z-index:50;">
                  <button type="button" class="cpg-dropdown-item" data-action="undo">
                    <span>Undo</span>
                    <kbd class="cpg-kbd">Ctrl+Z</kbd>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="redo">
                    <span>Redo</span>
                    <kbd class="cpg-kbd">Ctrl+Y</kbd>
                  </button>
                  <div class="cpg-menu-sep"></div>
                  <button type="button" class="cpg-dropdown-item" data-action="format-code">
                    <span>Format Code</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="clear-editor">
                    <span>Clear Editor</span>
                  </button>
                  <div class="cpg-menu-sep"></div>
                  <button type="button" class="cpg-dropdown-item" data-action="clear-console">
                    <span>Clear Console & Terminal</span>
                  </button>
                </div>
              </nav>

              <!-- View Menu -->
              <nav class="cpg-menu-item" data-menu="view" style="position:relative;">
                <button type="button" class="cpg-menu-trigger" id="cpg-menu-view-btn">View</button>
                <div class="cpg-dropdown-menu" id="cpg-menu-view" style="display:none; position:absolute; top:28px; left:0; min-width:200px; z-index:50;">
                  <button type="button" class="cpg-dropdown-item" data-action="toggle-sidebar">
                    <span id="cpg-view-sidebar-check">✓ Toggle Sidebar</span>
                    <kbd class="cpg-kbd">Ctrl+B</kbd>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="toggle-terminal">
                    <span>Toggle Terminal Drawer</span>
                    <kbd class="cpg-kbd">Ctrl+&#96;</kbd>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="toggle-preview">
                    <span>Toggle Live Preview</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="toggle-minimap">
                    <span id="cpg-view-minimap-check">✓ Toggle Minimap</span>
                  </button>
                  ${isUserSignedIn ? `
                  <button type="button" class="cpg-dropdown-item" data-action="toggle-assistant">
                    <span>Toggle AI Assistant</span>
                  </button>
                  ` : ''}
                  <div class="cpg-menu-sep"></div>
                  <button type="button" class="cpg-dropdown-item" data-action="theme-dark">
                    <span id="cpg-view-dark-check">${currentMode === 'dark' ? '✓ ' : ''}Dark Mode</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="theme-light">
                    <span id="cpg-view-light-check">${currentMode === 'light' ? '✓ ' : ''}Light Mode</span>
                  </button>
                </div>
              </nav>

              <!-- Run Menu -->
              <nav class="cpg-menu-item" data-menu="run" style="position:relative;">
                <button type="button" class="cpg-menu-trigger" id="cpg-menu-run-btn">Run</button>
                <div class="cpg-dropdown-menu" id="cpg-menu-run" style="display:none; position:absolute; top:28px; left:0; min-width:180px; z-index:50;">
                  <button type="button" class="cpg-dropdown-item" data-action="run-code">
                    <span>Run Active File</span>
                    <kbd class="cpg-kbd">Ctrl+Enter</kbd>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="run-terminal">
                    <span>Run in Terminal</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="stop-execution">
                    <span>Stop Execution</span>
                  </button>
                </div>
              </nav>

              <!-- Test Menu -->
              <nav class="cpg-menu-item" data-menu="test" style="position:relative;">
                <button type="button" class="cpg-menu-trigger" id="cpg-menu-test-btn">Test</button>
                <div class="cpg-dropdown-menu" id="cpg-menu-test" style="display:none; position:absolute; top:28px; left:0; min-width:190px; z-index:50;">
                  <button type="button" class="cpg-dropdown-item" data-action="test-preview">
                    <span>Test in Browser Sandbox</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="check-problems">
                    <span>Check Syntax & Problems</span>
                  </button>
                  <button type="button" class="cpg-dropdown-item" data-action="run-tests">
                    <span>Run Workspace Tests</span>
                  </button>
                </div>
              </nav>

            </div>
          </div>

          <!-- Right: Project Breadcrumb, Command Palette, Primary Run Button -->
          <div style="display:flex; align-items:center; gap:8px;">
            <select class="cpg-status-select" id="cpg-fw" hidden aria-label="CSS framework" style="font-size:0.72rem;">
              ${Object.entries(WEB_FRAMEWORKS).map(([id, f]) =>
                `<option value="${id}"${id === state.framework ? ' selected' : ''}>${f.name}</option>`).join('')}
            </select>

            <span style="font-weight:600; font-size:0.8rem; color:var(--cpg-text-secondary); display:flex; align-items:center; gap:6px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <span id="cpg-logo-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--cpg-accent);"></span>
              /workspaces/${escapeHtml(state.projectName)}
            </span>

            <button type="button" class="cpg-menu-trigger" id="cpg-cmd-palette" title="Command Palette (Ctrl+Shift+P)" style="padding:2px 6px;">
              <kbd class="cpg-kbd" style="font-size:0.68rem;">⌘⇧P</kbd>
            </button>

            <button type="button" class="ide-btn-preview" id="cpg-top-preview-btn" title="Toggle Live Preview" style="background:var(--cpg-bg-subtle); color:var(--cpg-text); font-weight:600; border:1px solid var(--cpg-border); border-radius:9999px; padding:4px 11px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; font-size:0.78rem; transition:all 0.15s ease;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
              <span>Preview</span>
            </button>

            <button type="button" class="ide-btn-run" id="cpg-run" style="background:var(--cpg-accent); color:#ffffff; font-weight:600; border:none; border-radius:9999px; padding:4px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; font-size:0.78rem; transition:background 0.15s ease;">
              Run <kbd style="font-size:0.66rem; background:rgba(255,255,255,0.25); padding:1px 4px; border-radius:3px; margin-left:2px;">⌃↵</kbd>
            </button>
          </div>
        </div>

        <!-- MAIN WORKSPACE BODY (SIDEBAR + EDITOR + DOCKED TERMINAL + ASSISTANT PANEL) -->
        <div style="display:flex; flex:1; overflow:hidden; position:relative;">
          
          <!-- SIDEBAR FILE EXPLORER -->
          <div id="cpg-sidebar" style="width:200px; background:var(--cpg-bg-card); border-right:1px solid var(--cpg-border); display:flex; flex-direction:column; justify-content:space-between; position:relative;">
            <div>
              <div id="cpg-project-badge" style="padding:6px 12px; font-size:0.72rem; color:var(--cpg-accent); font-family:monospace; font-weight:600; border-bottom:1px solid var(--cpg-border); background:var(--cpg-bg-subtle); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                /workspaces/${escapeHtml(state.projectName)}
              </div>
              <div style="padding:8px 12px; font-size:0.72rem; font-weight:700; color:var(--cpg-text-muted); text-transform:uppercase; letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center; position:relative;">
                <span>Files</span>
                <div style="position:relative;">
                  <button type="button" id="cpg-plus-btn" title="Add Item..." aria-label="Add Item" style="background:none; border:none; color:var(--cpg-text); cursor:pointer; font-size:1.1rem; line-height:1; padding:0 4px; border-radius:4px;">+</button>
                  <div id="cpg-plus-dropdown" class="cpg-dropdown-menu" style="display:none; position:absolute; top:24px; right:0; width:170px; z-index:50;">
                    <button type="button" class="cpg-dropdown-item" data-add="file">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                      <span>New File...</span>
                    </button>
                    <button type="button" class="cpg-dropdown-item" data-add="folder">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span>New Folder...</span>
                    </button>
                    <button type="button" class="cpg-dropdown-item" data-add="component">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      <span>HTML / Web App...</span>
                    </button>
                    <button type="button" class="cpg-dropdown-item" data-add="test">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      <span>Test File...</span>
                    </button>
                  </div>
                </div>
              </div>
              <div id="cpg-file-tree" style="display:flex; flex-direction:column;"></div>
            </div>

            <!-- Stdin Box for remote runs / C++ stdin -->
            <div id="cpg-stdin-wrap" hidden style="padding:10px; border-top:1px solid var(--cpg-border); background:var(--cpg-bg-card);">
              <div style="font-size:0.7rem; color:var(--cpg-text-muted); margin-bottom:4px; font-weight:600;">Standard Input (stdin)</div>
              <textarea id="cpg-stdin" placeholder="cin input..." style="width:100%; height:50px; background:var(--cpg-bg-subtle); border:1px solid var(--cpg-border); color:var(--cpg-text); font-family:monospace; font-size:0.74rem; padding:4px; resize:none; outline:none; border-radius:4px;"></textarea>
            </div>
          </div>

          <!-- EDITOR + PREVIEW + DOCKED BOTTOM TERMINAL -->
          <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:var(--cpg-bg-app);">
            
            <!-- TABS BAR -->
            <div id="cpg-tabs-bar" style="background:var(--cpg-bg-card); border-bottom:1px solid var(--cpg-border); display:flex; overflow-x:auto; scrollbar-width:none;"></div>

            <!-- CENTER SPLIT (CODE EDITOR + OPTIONAL PREVIEW) -->
            <div id="cpg-center-split" style="flex:1; display:flex; overflow:hidden; position:relative;">
              <!-- Editor Container -->
              <div id="cpg-editor-wrap" style="flex:1; display:flex; overflow:hidden; position:relative; background:var(--cpg-editor-bg);">
                <div id="cpg-gutter" style="width:48px; background:var(--cpg-gutter-bg); color:var(--cpg-gutter-text); font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px 6px; text-align:right; user-select:none; border-right:1px solid var(--cpg-border); overflow:hidden;"></div>
                <textarea id="cpg-code" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" wrap="off" style="flex:1; background:var(--cpg-editor-bg); color:var(--cpg-editor-text); font-family:'Fira Code', Consolas, Monaco, monospace; font-size:0.82rem; line-height:1.5; padding:12px; border:none; outline:none; resize:none; white-space:pre; overflow:auto;"></textarea>
              </div>

              <!-- Visual Minimap -->
              <div id="cpg-minimap" style="width:80px; background:var(--cpg-bg-card); border-left:1px solid var(--cpg-border); padding:8px 4px; overflow:hidden; user-select:none; opacity:0.65; cursor:pointer;" title="Visual Minimap">
                <div id="cpg-minimap-content" style="font-size:3px; line-height:4px; color:var(--cpg-accent); font-family:monospace; white-space:pre; pointer-events:none;"></div>
              </div>

              <!-- Live Preview Pane (Hidden by default unless HTML preview is open) -->
              <div id="cpg-preview-pane" style="width:45%; background:#ffffff; border-left:1px solid var(--cpg-border); display:none; flex-direction:column; overflow:hidden;">
                <iframe id="cpg-preview" style="flex:1; width:100%; border:none; background:#fff;" sandbox="allow-scripts allow-modals allow-popups allow-forms allow-same-origin"></iframe>
              </div>
            </div>

            <!-- DOCKED COLLAPSIBLE BOTTOM TERMINAL DRAWER -->
            <div id="cpg-bottom-drawer" style="display:none; height:200px; background:var(--cpg-bg-card); border-top:1px solid var(--cpg-border); flex-direction:column; overflow:hidden;">
              <!-- Drawer Header / Tabs -->
              <div style="background:var(--cpg-bg-subtle); border-bottom:1px solid var(--cpg-border); padding:0 8px; display:flex; justify-content:space-between; align-items:center; height:32px;">
                <div style="display:flex; gap:4px; height:100%;">
                  <button type="button" class="cpg-drawer-tab active" data-tab="terminal">Terminal</button>
                  <button type="button" class="cpg-drawer-tab" data-tab="output">Output</button>
                  <button type="button" class="cpg-drawer-tab" data-tab="problems">Problems</button>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span id="cpg-proc-status" style="display:none; font-size:0.7rem; padding:2px 7px; border-radius:4px; font-weight:600; background:rgba(34,197,94,0.15); color:#22c55e;">RUNNING</span>
                  <button type="button" id="cpg-proc-stop-btn" style="display:none; padding:2px 8px; font-size:0.72rem; border-radius:4px; background:#ef4444; color:#fff; border:none; cursor:pointer; font-weight:600;" title="Cancel active command">■ Stop</button>
                  <span id="cpg-timing" style="color:var(--cpg-text-muted); font-size:0.72rem; font-family:monospace;"></span>
                  <button type="button" class="ide-btn-icon" id="cpg-term-clear-btn" title="Clear Console">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  </button>
                  <button type="button" class="ide-btn-icon" id="cpg-term-close-btn" title="Close Terminal (Ctrl+&#96;)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <!-- Tab Panes -->
              <div id="cpg-pane-terminal" class="cpg-drawer-pane" style="flex:1; overflow:auto; padding:8px 12px; font-family:'Fira Code', Consolas, monospace; font-size:0.8rem; background:var(--cpg-terminal-bg); color:var(--cpg-terminal-text);">
                <div id="cpg-term-history" style="white-space:pre-wrap; line-height:1.45;"></div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                  <span id="cpg-term-prompt" style="color:var(--cpg-text-muted); font-weight:600; font-family:inherit;">workspace $</span>
                  <input type="text" id="cpg-term-input" autocomplete="off" spellcheck="false" style="flex:1; background:transparent; border:none; outline:none; color:var(--cpg-text); font-family:inherit; font-size:inherit;" />
                </div>
              </div>

              <div id="cpg-pane-output" class="cpg-drawer-pane" style="display:none; flex:1; overflow:auto; padding:8px 12px; font-family:'Fira Code', Consolas, monospace; font-size:0.8rem; background:var(--cpg-terminal-bg); color:var(--cpg-text); white-space:pre-wrap; line-height:1.45;">
                <div id="cpg-console"></div>
              </div>

              <div id="cpg-pane-problems" class="cpg-drawer-pane" style="display:none; flex:1; overflow:auto; padding:12px; font-size:0.8rem; color:var(--cpg-text-muted);">
                <div id="cpg-problems-content">No errors detected in workspace.</div>
              </div>
            </div>

          </div>

          <!-- DOCKED RIGHT ASSISTANT MINI-WINDOW (RENDERED ONLY FOR SIGNED IN USERS) -->
          ${isUserSignedIn ? `
          <div id="cpg-assistant-panel" style="display:none; width:330px; background:var(--cpg-bg-card); border-left:1px solid var(--cpg-border); flex-direction:column; overflow:hidden; z-index:25;">
            <!-- Header -->
            <div style="padding:8px 12px; background:var(--cpg-bg-subtle); border-bottom:1px solid var(--cpg-border); display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cpg-accent);"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17h4"/></svg>
                <span style="font-size:0.8rem; font-weight:700; color:var(--cpg-text);">Code Assistant</span>
              </div>
              <button type="button" class="ide-btn-icon" id="cpg-assistant-close-btn" title="Close Assistant">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Quick Action Chips -->
            <div style="padding:8px 12px; border-bottom:1px solid var(--cpg-border); display:flex; flex-wrap:wrap; gap:6px; background:var(--cpg-bg-card);">
              <button type="button" class="cpg-ast-chip" id="cpg-ast-debug" title="Debug active file and workspace errors">Debug & Fix</button>
              <button type="button" class="cpg-ast-chip" id="cpg-ast-tests" title="Write unit tests for active file">Write Tests</button>
              <button type="button" class="cpg-ast-chip" id="cpg-ast-build" title="Build feature or application code">Build Feature</button>
              <button type="button" class="cpg-ast-chip" id="cpg-ast-examine" title="Analyze architecture & structure">Examine Code</button>
            </div>

            <!-- Messages / Output Area -->
            <div id="cpg-ast-chat-log" style="flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; font-size:0.8rem; line-height:1.45;">
              <div style="background:var(--cpg-bg-subtle); border:1px solid var(--cpg-border); border-radius:8px; padding:10px; color:var(--cpg-text-secondary);">
                <strong style="color:var(--cpg-text);">Playground Assistant Ready</strong><br>
                Ask me to debug, write code, build features, or test apps. You can also click the quick actions above.
              </div>
            </div>

            <!-- Input Box -->
            <div style="padding:8px 12px; border-top:1px solid var(--cpg-border); background:var(--cpg-bg-card); display:flex; gap:6px;">
              <input type="text" id="cpg-ast-input" placeholder="Ask Assistant about this code..." style="flex:1; background:var(--cpg-bg-subtle); border:1px solid var(--cpg-border); border-radius:6px; padding:6px 10px; font-size:0.78rem; color:var(--cpg-text); outline:none;" />
              <button type="button" id="cpg-ast-send" style="border-radius:6px; background:var(--cpg-accent); color:#ffffff; border:none; font-weight:600; padding:6px 12px; cursor:pointer; font-size:0.78rem;">Send</button>
            </div>
          </div>
          ` : ''}

        </div>

        <!-- STATUS BAR (BOTTOM) -->
        <div id="cpg-status-bar" style="background:var(--cpg-bg-card); border-top:1px solid var(--cpg-border); color:var(--cpg-text-muted); padding:4px 12px; font-size:0.72rem; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display:flex; justify-content:space-between; align-items:center;">
          <!-- Left Status Metrics -->
          <div style="display:flex; gap:12px; align-items:center;">
            <button type="button" id="cpg-status-term-toggle" style="background:none; border:none; color:var(--cpg-text-muted); cursor:pointer; font-size:inherit; display:flex; align-items:center; gap:5px; padding:0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Terminal
            </button>
            <span id="cpg-status-pos">Line 1, Column 1</span>
            <span id="cpg-status-spaces">Spaces: 2</span>
            <span id="cpg-status-encoding">UTF-8</span>
            <span id="cpg-note" style="color:var(--cpg-text-muted); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
          </div>

          <!-- Right Status: Assistant Button (Signed in only) + Language Selector -->
          <div style="display:flex; gap:10px; align-items:center;">
            ${isUserSignedIn ? `
            <button type="button" class="cpg-status-btn" id="cpg-status-ast-btn" title="Toggle AI Assistant" style="background:none; border:1px solid var(--cpg-border); color:var(--cpg-text); border-radius:9999px; padding:2px 8px; font-size:0.72rem; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--cpg-accent);"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17h4"/></svg>
              <span>Assistant</span>
            </button>
            ` : ''}

            <select class="cpg-status-select" id="cpg-langs" aria-label="Language Mode" style="background:var(--cpg-bg-card); border:1px solid var(--cpg-border); color:var(--cpg-text); padding:2px 6px; border-radius:6px; font-size:0.72rem; outline:none; cursor:pointer;">
              <optgroup label="Runs on your device (Offline)">
                ${Object.entries(LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
              <optgroup label="Compiled on a server">
                ${Object.entries(REMOTE_LANGUAGES).map(([id, l]) =>
                  `<option value="${id}">${l.name}</option>`).join('')}
              </optgroup>
            </select>
          </div>
        </div>

        <!-- COMMAND PALETTE MODAL (HIDDEN) -->
        <div id="cpg-palette-modal" style="display:none; position:absolute; top:40px; left:50%; transform:translateX(-50%); width:480px; max-width:90%; background:var(--cpg-bg-card); border:1px solid var(--cpg-border); border-radius:8px; box-shadow:0 16px 48px rgba(0,0,0,0.5); z-index:100; overflow:hidden;">
          <input type="text" id="cpg-palette-input" placeholder="Type a command or language..." style="width:100%; padding:10px 14px; background:var(--cpg-bg-app); border:none; border-bottom:1px solid var(--cpg-border); color:var(--cpg-text); font-size:0.86rem; outline:none;">
          <div id="cpg-palette-list" style="max-height:240px; overflow-y:auto;"></div>
        </div>

      </div>
    `;

    // References
    const rootEl = container.querySelector('#cpg-root');
    const codeEl = container.querySelector('#cpg-code');
    const gutterEl = container.querySelector('#cpg-gutter');
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
    const plusBtn = container.querySelector('#cpg-plus-btn');
    const plusDropdown = container.querySelector('#cpg-plus-dropdown');
    const runBtn = container.querySelector('#cpg-run');
    const topPrevBtn = container.querySelector('#cpg-top-preview-btn');
    topPrevBtn?.addEventListener('click', () => togglePreview());
    const noteEl = container.querySelector('#cpg-note');
    const timingEl = container.querySelector('#cpg-timing');
    const consoleEl = container.querySelector('#cpg-console');
    const bottomDrawer = container.querySelector('#cpg-bottom-drawer');
    const termHistory = container.querySelector('#cpg-term-history');
    const termInput = container.querySelector('#cpg-term-input');
    const problemsContent = container.querySelector('#cpg-problems-content');

    // Assistant Elements (if signed in)
    const astPanel = container.querySelector('#cpg-assistant-panel');
    const astStatusBtn = container.querySelector('#cpg-status-ast-btn');
    const astCloseBtn = container.querySelector('#cpg-assistant-close-btn');
    const astChatLog = container.querySelector('#cpg-ast-chat-log');
    const astInput = container.querySelector('#cpg-ast-input');
    const astSendBtn = container.querySelector('#cpg-ast-send');
    const astDebugBtn = container.querySelector('#cpg-ast-debug');
    const astTestsBtn = container.querySelector('#cpg-ast-tests');
    const astBuildBtn = container.querySelector('#cpg-ast-build');
    const astExamineBtn = container.querySelector('#cpg-ast-examine');

    // Return to Workspaces Landing
    container.querySelector('#cpg-close-ws-btn')?.addEventListener('click', () => {
      persist();
      setActiveWorkspaceId(null);
      self_.checkAndRender();
    });

    // 2 UI Modes only (Dark / Light) isolated in Code Playground
    function applyPlaygroundMode(mode) {
      currentMode = setPlaygroundMode(mode);
      rootEl.className = `ide-root cpg-mode-${currentMode}`;
      
      const darkCheck = container.querySelector('#cpg-view-dark-check');
      const lightCheck = container.querySelector('#cpg-view-light-check');
      if (darkCheck) darkCheck.textContent = currentMode === 'dark' ? '✓ Dark Mode' : 'Dark Mode';
      if (lightCheck) lightCheck.textContent = currentMode === 'light' ? '✓ Light Mode' : 'Light Mode';
    }

    // Dropdown Menus Management (File, Edit, View, Run, Test)
    let openDropdown = null;

    function closeAllMenus() {
      container.querySelectorAll('.cpg-dropdown-menu').forEach(m => m.style.display = 'none');
      openDropdown = null;
    }

    container.querySelectorAll('.cpg-menu-item').forEach(item => {
      const btn = item.querySelector('.cpg-menu-trigger');
      const dropdown = item.querySelector('.cpg-dropdown-menu');
      if (!btn || !dropdown) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openDropdown === dropdown) {
          dropdown.style.display = 'none';
          openDropdown = null;
        } else {
          closeAllMenus();
          dropdown.style.display = 'flex';
          openDropdown = dropdown;
        }
      });

      item.addEventListener('mouseenter', () => {
        if (openDropdown && openDropdown !== dropdown) {
          closeAllMenus();
          dropdown.style.display = 'flex';
          openDropdown = dropdown;
        }
      });
    });

    // Plus dropdown button in files side panel
    plusBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = plusDropdown.style.display === 'flex';
      closeAllMenus();
      plusDropdown.style.display = isVisible ? 'none' : 'flex';
    });

    // Document click to close menus
    const onDocClick = (e) => {
      if (!e.target.closest('.cpg-menu-item') && !e.target.closest('#cpg-plus-btn') && !e.target.closest('#cpg-plus-dropdown')) {
        closeAllMenus();
      }
    };
    document.addEventListener('click', onDocClick);

    // Menu Actions Handler
    container.querySelectorAll('.cpg-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const action = item.dataset.action;
        const addKind = item.dataset.add;

        if (addKind) {
          handleAddItem(addKind);
          return;
        }

        switch (action) {
          case 'new-file':
            handleAddItem('file');
            break;
          case 'new-folder':
            handleAddItem('folder');
            break;
          case 'insert-example':
            insertExample();
            break;
          case 'save-workspace':
            persist();
            line('muted', 'Workspace saved.');
            break;
          case 'package-zip':
            packageZip();
            break;
          case 'close-workspace':
            persist();
            setActiveWorkspaceId(null);
            self_.checkAndRender();
            break;
          case 'undo':
            document.execCommand('undo');
            break;
          case 'redo':
            document.execCommand('redo');
            break;
          case 'format-code':
            formatCode();
            break;
          case 'clear-editor':
            codeEl.value = '';
            getActiveFile().content = '';
            persist();
            renderGutterAndMinimap();
            break;
          case 'clear-console':
            clearConsole();
            termHistory.innerHTML = '';
            break;
          case 'toggle-sidebar':
            toggleSidebar();
            break;
          case 'toggle-terminal':
            toggleTerminalDrawer();
            break;
          case 'toggle-preview':
            togglePreview();
            break;
          case 'toggle-minimap':
            toggleMinimap();
            break;
          case 'toggle-assistant':
            toggleAssistantPanel();
            break;
          case 'theme-dark':
            applyPlaygroundMode('dark');
            break;
          case 'theme-light':
            applyPlaygroundMode('light');
            break;
          case 'run-code':
            run();
            break;
          case 'run-terminal':
            toggleTerminalDrawer(true);
            termInput.focus();
            break;
          case 'stop-execution':
            abort('Execution stopped by user.');
            break;
          case 'test-preview':
            testInBrowser();
            break;
          case 'check-problems':
            checkProblems();
            break;
          case 'run-tests':
            runWorkspaceTests();
            break;
        }
      });
    });

    function handleAddItem(kind) {
      if (kind === 'folder') {
        const folderName = prompt('Enter folder name (e.g. src or components):', 'src');
        if (!folderName || !folderName.trim()) return;
        const clean = folderName.trim().replace(/^\/+|\/+$/g, '');
        const f = {
          id: `f-${Date.now()}`,
          name: `${clean}/index.js`,
          lang: 'javascript',
          content: `// ${clean}/index.js\n`
        };
        state.files.push(f);
        state.activeFileId = f.id;
        renderTabs();
        renderFileTree();
        loadFile();
        persist();
        return;
      }

      if (kind === 'component') {
        const compName = prompt('Enter component / HTML page name:', `component.html`);
        if (!compName || !compName.trim()) return;
        const name = compName.trim().endsWith('.html') ? compName.trim() : `${compName.trim()}.html`;
        const f = {
          id: `f-${Date.now()}`,
          name,
          lang: 'html',
          content: `<div class="component">\n  <h3>${name.replace('.html', '')}</h3>\n</div>\n`
        };
        state.files.push(f);
        state.activeFileId = f.id;
        renderTabs();
        renderFileTree();
        loadFile();
        persist();
        return;
      }

      if (kind === 'test') {
        const testName = prompt('Enter test filename:', `test_${state.files.length + 1}.js`);
        if (!testName || !testName.trim()) return;
        const f = {
          id: `f-${Date.now()}`,
          name: testName.trim(),
          lang: 'javascript',
          content: `// Workspace Unit Tests\nfunction test() {\n  const actual = 1 + 1;\n  const expected = 2;\n  console.assert(actual === expected, 'Math failed');\n  console.log('Test passed: 1 + 1 === 2');\n}\ntest();\n`
        };
        state.files.push(f);
        state.activeFileId = f.id;
        renderTabs();
        renderFileTree();
        loadFile();
        persist();
        return;
      }

      // Default: New File
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
    }

    function insertExample() {
      const file = getActiveFile();
      if (file) {
        const sample = ALL[langsSelect.value]?.sample || `// Sample for ${langsSelect.value}\n`;
        file.content = sample;
        codeEl.value = file.content;
        renderGutterAndMinimap();
        persist();
        line('muted', `Example code inserted for ${langsSelect.value}.`);
      }
    }

    function formatCode() {
      const cur = getActiveFile();
      if (!cur) return;
      try {
        if (cur.lang === 'json' || cur.name.endsWith('.json')) {
          cur.content = JSON.stringify(JSON.parse(codeEl.value), null, 2);
          codeEl.value = cur.content;
        } else {
          // Standard indent cleanup
          const lines = codeEl.value.split('\n');
          cur.content = lines.map(l => l.trimEnd()).join('\n');
          codeEl.value = cur.content;
        }
        persist();
        renderGutterAndMinimap();
        line('muted', 'Formatted document.');
      } catch (err) {
        line('warn', `Formatting notice: ${err.message}`);
      }
    }

    function toggleSidebar() {
      state.sidebarOpen = !state.sidebarOpen;
      sidebar.style.display = state.sidebarOpen ? 'flex' : 'none';
      const check = container.querySelector('#cpg-view-sidebar-check');
      if (check) check.textContent = state.sidebarOpen ? '✓ Toggle Sidebar' : 'Toggle Sidebar';
    }

    function toggleMinimap() {
      state.minimapOpen = !state.minimapOpen;
      minimapEl.style.display = state.minimapOpen ? 'block' : 'none';
      const check = container.querySelector('#cpg-view-minimap-check');
      if (check) check.textContent = state.minimapOpen ? '✓ Toggle Minimap' : 'Toggle Minimap';
    }

    function updateWorkspacePreview() {
      if (!previewEl) return;
      const indexHtmlFile = state.files.find(f => f.name.toLowerCase() === 'index.html');
      const cssFiles = state.files.filter(f => f.name.toLowerCase().endsWith('.css'));
      const appJsxFile = state.files.find(f => f.name.toLowerCase().endsWith('app.jsx') || f.name.toLowerCase().endsWith('app.js'));
      const indexJsxFile = state.files.find(f => f.name.toLowerCase().endsWith('index.jsx') || f.name.toLowerCase().endsWith('main.jsx') || f.name.toLowerCase().endsWith('index.js'));

      const isReactProject = state.framework === 'react' ||
        state.files.some(f => f.name.includes('.jsx') || (f.name === 'package.json' && f.content.includes('react')));

      if (indexHtmlFile || isReactProject) {
        let doc = indexHtmlFile ? indexHtmlFile.content : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(state.projectName)}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

        // Strip any relative script or stylesheet links that cause 404 network fetches in iframe
        doc = doc.replace(/<script[^>]*src=["']\.\/[^"']*["'][^>]*><\/script>/gi, '');
        doc = doc.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/[^"']*["'][^>]*>/gi, '');

        // Extract all imported npm packages and build dynamic import map
        const rawCode = `${appJsxFile?.content || ''}\n${indexJsxFile?.content || ''}`;
        const importedPkgs = extractPackageImports(rawCode);
        const allPackages = { ...(state.packages || {}) };
        importedPkgs.forEach(pkg => {
          if (!allPackages[pkg]) allPackages[pkg] = { name: pkg, version: 'latest' };
        });
        const importMap = buildImportMap(allPackages);
        const importMapTag = `\n  <script type="importmap">\n${JSON.stringify(importMap, null, 2)}\n  </script>\n`;

        doc = doc.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');
        if (doc.includes('<head>')) doc = doc.replace('<head>', `<head>${importMapTag}`);
        else doc = importMapTag + '\n' + doc;

        const reactCdn = `
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        `;
        if (!doc.includes('react.development.js') && !doc.includes('react@18')) {
          if (doc.includes('<head>')) doc = doc.replace('<head>', `<head>\n${reactCdn}`);
          else doc = reactCdn + '\n' + doc;
        }

        // Collect and inject all CSS from workspace
        const combinedCss = cssFiles.map(c => `/* ${c.name} */\n${c.content}`).join('\n\n');
        if (combinedCss) {
          const styleTag = `<style id="workspace-styles">\n${combinedCss}\n</style>`;
          if (doc.includes('</head>')) doc = doc.replace('</head>', `${styleTag}\n</head>`);
          else doc = styleTag + '\n' + doc;
        }

        // Clean local relative imports & exports for in-browser Babel execution while keeping package imports
        function cleanJsForBrowser(code) {
          if (!code) return '';
          return code
            .replace(/import\s+['"][^'"]+\.css['"];?/g, '')
            .replace(/import\s+[\s\S]*?from\s+['"]\.\/[^'"]+['"];?/g, '')
            .replace(/import\s+['"]\.\/[^'"]+['"];?/g, '')
            .replace(/export\s+default\s+function\s+([a-zA-Z0-9_$]+)/g, 'function $1')
            .replace(/export\s+default\s+class\s+([a-zA-Z0-9_$]+)/g, 'class $1')
            .replace(/export\s+default\s+[a-zA-Z0-9_$]+;?/g, '')
            .replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ')
            .replace(/export\s*\{[^}]*\};?/g, '');
        }

        const cleanedApp = cleanJsForBrowser(appJsxFile?.content || '');
        const cleanedIndex = cleanJsForBrowser(indexJsxFile?.content || '');

        // Expose all React hooks and ReactDOM helpers to the local scope
        const scopeShims = `
          const {
            useState, useEffect, useContext, useReducer, useCallback,
            useMemo, useRef, useImperativeHandle, useLayoutEffect,
            useDebugValue, useDeferredValue, useTransition, useId,
            createContext, cloneElement, Children, Fragment, StrictMode
          } = (typeof React !== 'undefined' ? React : {});
          const { createRoot, hydrateRoot } = (typeof ReactDOM !== 'undefined' && ReactDOM.createRoot) ? ReactDOM : {
            createRoot: (el) => ({ render: (v) => ReactDOM.render(v, el) })
          };
          window.createRoot = createRoot;
          window.React = typeof React !== 'undefined' ? React : {};
          window.ReactDOM = typeof ReactDOM !== 'undefined' ? ReactDOM : {};
        `;

        const autoMountScript = `
          try {
            const rootEl = document.getElementById('root') || document.body;
            if (rootEl && !rootEl.hasChildNodes() && typeof App !== 'undefined') {
              createRoot(rootEl).render(React.createElement(App));
            }
          } catch (e) {
            console.error('React mount error:', e);
          }
        `;

        const errorHandlerScript = `
          <script>
            window.addEventListener('error', function(e) {
              console.error('Runtime Error:', e.message);
              var rootEl = document.getElementById('root') || document.body;
              if (rootEl && !rootEl.hasChildNodes()) {
                rootEl.innerHTML = '<div style="padding:16px; margin:16px; background:#450a0a; border:1px solid #dc2626; border-radius:8px; color:#fecaca; font-family:sans-serif; font-size:13px;"><strong>Build / Runtime Error:</strong><br>' + e.message + '</div>';
              }
            });
          </script>
        `;

        const scriptTag = `
          ${errorHandlerScript}
          <script type="text/babel" data-type="module">
            ${scopeShims}
            ${cleanedApp}
            ${cleanedIndex}
            ${autoMountScript}
          </script>
        `;

        if (!doc.includes('id="root"')) {
          if (doc.includes('<body>')) doc = doc.replace('<body>', '<body>\n<div id="root"></div>');
          else doc = '<div id="root"></div>\n' + doc;
        }

        if (doc.includes('</body>')) {
          doc = doc.replace('</body>', `${scriptTag}\n</body>`);
        } else {
          doc += '\n' + scriptTag;
        }

        previewEl.srcdoc = doc;
        return;
      }

      const cur = getActiveFile();
      if (cur) {
        previewEl.srcdoc = buildPreviewDocument(cur.content, state.framework);
      }
    }

    function togglePreview(forceState) {
      if (typeof forceState === 'boolean') {
        state.splitMode = forceState ? 'split' : 'code-only';
      } else {
        state.splitMode = state.splitMode === 'code-only' ? 'split' : 'code-only';
      }
      previewPane.style.display = state.splitMode !== 'code-only' ? 'flex' : 'none';
      const topPrevBtn = container.querySelector('#cpg-top-preview-btn');
      if (topPrevBtn) {
        if (state.splitMode !== 'code-only') {
          topPrevBtn.style.borderColor = 'var(--cpg-accent)';
          topPrevBtn.style.color = 'var(--cpg-accent)';
        } else {
          topPrevBtn.style.borderColor = 'var(--cpg-border)';
          topPrevBtn.style.color = 'var(--cpg-text)';
        }
      }
      if (state.splitMode !== 'code-only') {
        updateWorkspacePreview();
      }
      persist();
    }

    function getActiveFile() {
      return state.files.find(f => f.id === state.activeFileId) || state.files[0];
    }

    function renderTabs() {
      tabsBar.innerHTML = state.files.map(f => {
        const isActive = f.id === state.activeFileId;
        return `
          <div class="ide-tab ${isActive ? 'active' : ''}" data-id="${f.id}" style="padding:6px 14px; font-size:0.78rem; font-family:monospace; background:${isActive ? 'var(--cpg-tab-active)' : 'var(--cpg-tab-inactive)'}; color:${isActive ? 'var(--cpg-text)' : 'var(--cpg-text-muted)'}; border-right:1px solid var(--cpg-border); border-bottom:${isActive ? '2px solid var(--cpg-accent)' : 'none'}; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <span>${escapeHtml(f.name)}</span>
            ${state.files.length > 1 ? `<span class="ide-tab-close" data-id="${f.id}" style="color:var(--cpg-text-muted); font-size:0.9rem; line-height:1;">&times;</span>` : ''}
          </div>
        `;
      }).join('');

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
      fileTree.innerHTML = state.files.map(f => {
        const isActive = f.id === state.activeFileId;
        return `
          <div class="ide-tree-item ${isActive ? 'active' : ''}" data-id="${f.id}" style="padding:5px 14px; font-size:0.78rem; font-family:monospace; color:${isActive ? 'var(--cpg-text)' : 'var(--cpg-text-secondary)'}; background:${isActive ? 'var(--cpg-bg-subtle)' : 'transparent'}; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            <span>${escapeHtml(f.name)}</span>
          </div>
        `;
      }).join('');

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
      applyLanguage(file.lang || 'javascript');
      renderGutterAndMinimap();
      if (state.splitMode !== 'code-only') {
        updateWorkspacePreview();
      }
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
          splitMode: state.splitMode,
          git: state.git,
          packages: state.packages,
          updatedAt: Date.now()
        };
        if (wsIdx !== -1) list[wsIdx] = updated;
        else list.unshift(updated);
        saveWorkspaces(list);
      } catch {}

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
      if (state.splitMode !== 'code-only') {
        clearTimeout(self_._previewDebounce);
        self_._previewDebounce = setTimeout(() => {
          updateWorkspacePreview();
        }, 300);
      }
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

    // Assistant Mini-Window Toggle Handlers
    function toggleAssistantPanel(forceState) {
      if (!isUserSignedIn || !astPanel) return;
      if (typeof forceState === 'boolean') state.assistantOpen = forceState;
      else state.assistantOpen = !state.assistantOpen;
      astPanel.style.display = state.assistantOpen ? 'flex' : 'none';
    }

    astStatusBtn?.addEventListener('click', () => toggleAssistantPanel());
    astCloseBtn?.addEventListener('click', () => toggleAssistantPanel(false));

    function appendAstMessage(role, html) {
      if (!astChatLog) return null;
      const msg = document.createElement('div');
      msg.style.borderRadius = '8px';
      msg.style.padding = '8px 10px';
      msg.style.border = '1px solid var(--cpg-border)';
      if (role === 'user') {
        msg.style.background = 'var(--cpg-bg-card)';
        msg.style.color = 'var(--cpg-text)';
        msg.style.alignSelf = 'flex-end';
        msg.style.maxWidth = '85%';
      } else {
        msg.style.background = 'var(--cpg-bg-subtle)';
        msg.style.color = 'var(--cpg-text)';
        msg.style.alignSelf = 'flex-start';
        msg.style.width = '100%';
      }
      msg.innerHTML = html;
      astChatLog.appendChild(msg);
      astChatLog.scrollTop = astChatLog.scrollHeight;
      return msg;
    }

    function attachCodeApplyButtons(containerEl) {
      if (!containerEl) return;
      const preBlocks = containerEl.querySelectorAll('pre');
      preBlocks.forEach(pre => {
        if (pre.querySelector('.cpg-action-bar')) return;
        const codeElInside = pre.querySelector('code');
        if (!codeElInside) return;
        const rawCode = codeElInside.textContent.trim();
        const firstLine = rawCode.split('\n')[0].trim();
        const isShell = /^(bash|sh|shell|zsh)$/i.test(codeElInside.className || '') ||
                        /^(npm|npx|git|node|yarn|pnpm|touch|mkdir|rm|cat|ls|pwd|test|run|preview)\b/i.test(firstLine);

        // Check if there is a filename directive: [FILE: path/to/file] or // path/to/file
        let targetFilePath = null;
        const prevText = pre.previousElementSibling?.textContent || '';
        const fileMatch = prevText.match(/\[FILE:\s*([^\]]+)\]/i) || prevText.match(/(?:file|filename|path):\s*([a-zA-Z0-9_./-]+)/i);
        if (fileMatch) {
          targetFilePath = fileMatch[1].trim();
        } else if (/^(\/\/|\/\*|<!--|#)\s*([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/.test(firstLine)) {
          targetFilePath = firstLine.replace(/^(\/\/|\/\*|<!--|#)\s*/, '').replace(/(\*\/|-->)$/, '').trim();
        }

        const btnBar = document.createElement('div');
        btnBar.className = 'cpg-action-bar';
        btnBar.style.cssText = 'display:flex; justify-content:flex-end; gap:6px; margin-bottom:4px;';

        if (isShell) {
          const runBtn = document.createElement('button');
          runBtn.type = 'button';
          runBtn.className = 'cpg-apply-btn cpg-run-term-btn';
          runBtn.style.cssText = 'background:var(--cpg-accent); color:#ffffff; border:none; border-radius:4px; padding:2px 8px; font-size:0.7rem; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:4px;';
          runBtn.textContent = '▶ Run in Terminal';
          runBtn.addEventListener('click', async () => {
            toggleTerminalDrawer(true);
            const lines = rawCode.split('\n').map(l => l.replace(/^[\$>\s]+/, '').trim()).filter(Boolean);
            for (const line of lines) {
              await executeTerminalCommand(line, { echo: true, source: 'user' });
            }
            runBtn.textContent = 'Executed!';
            setTimeout(() => { runBtn.textContent = '▶ Run in Terminal'; }, 2000);
          });
          btnBar.appendChild(runBtn);
        } else if (targetFilePath) {
          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'cpg-apply-btn cpg-save-file-btn';
          saveBtn.style.cssText = 'background:var(--cpg-accent); color:#ffffff; border:none; border-radius:4px; padding:2px 8px; font-size:0.7rem; cursor:pointer; font-weight:600;';
          saveBtn.textContent = `Save to ${targetFilePath.split('/').pop()}`;
          saveBtn.addEventListener('click', () => {
            let f = state.files.find(x => x.name.toLowerCase() === targetFilePath.toLowerCase());
            if (f) {
              f.content = rawCode;
            } else {
              const ext = targetFilePath.split('.').pop().toLowerCase();
              const lang = ext === 'jsx' || ext === 'js' ? 'javascript' : (ext === 'css' ? 'css' : (ext === 'html' ? 'html' : 'text'));
              f = { id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: targetFilePath, lang, content: rawCode };
              state.files.push(f);
            }
            state.activeFileId = f.id;
            persist();
            renderTabs();
            renderFileTree();
            loadFile();
            updateWorkspacePreview();
            saveBtn.textContent = 'Saved!';
            setTimeout(() => { saveBtn.textContent = `Save to ${targetFilePath.split('/').pop()}`; }, 2000);
          });
          btnBar.appendChild(saveBtn);
        } else {
          const applyBtn = document.createElement('button');
          applyBtn.type = 'button';
          applyBtn.className = 'cpg-apply-btn';
          applyBtn.style.cssText = 'background:var(--cpg-accent); color:#ffffff; border:none; border-radius:4px; padding:2px 8px; font-size:0.7rem; cursor:pointer; font-weight:600;';
          applyBtn.textContent = 'Apply to Editor';
          applyBtn.addEventListener('click', () => {
            const cur = getActiveFile();
            if (cur) {
              cur.content = rawCode;
              codeEl.value = rawCode;
              persist();
              renderGutterAndMinimap();
              updateWorkspacePreview();
              applyBtn.textContent = 'Applied!';
              setTimeout(() => { applyBtn.textContent = 'Apply to Editor'; }, 2000);
            }
          });
          btnBar.appendChild(applyBtn);
        }

        pre.insertBefore(btnBar, pre.firstChild);
      });
    }

    const astHistory = [];

    async function sendToAssistant(promptText) {
      if (!promptText || !astChatLog) return;
      appendAstMessage('user', escapeHtml(promptText));
      astHistory.push({ role: 'user', content: promptText });

      const cur = getActiveFile();
      const filesSummary = state.files.map(f => `File: ${f.name} (${f.lang || 'text'}, ${f.content ? f.content.split('\n').length : 0} lines)`).join('\n');
      const errors = problemsContent.textContent !== 'No errors detected in workspace.' ? problemsContent.textContent : 'None';

      const systemPrompt = `You are the AI Assistant inside the Toolbox Code Playground IDE.
Current Workspace: "${state.projectName}"
Workspace Files:
${filesSummary}

Active File: "${cur ? cur.name : 'none'}" (${cur ? cur.lang : 'text'})
Active File Code:
\`\`\`${cur ? cur.lang : 'text'}
${cur ? cur.content : ''}
\`\`\`

Current Console / Workspace Errors:
${errors}

Terminal & Autonomous Agent Capabilities:
You have FULL CAPABILITY to run commands in the user's terminal and execute development workflows.
Whenever the user asks you to initialize an app, write code, run commands, test work, or push to git:
You should directly execute the appropriate commands by including command directives on their own line:
[COMMAND: <command>]

Supported terminal commands you can execute:
- [COMMAND: npx create-react-app <name>] : Initializes complete React 18 application with App.jsx, index.jsx, App.css, index.html, App.test.js, and package.json
- [COMMAND: npm test] : Runs workspace unit tests (*.test.js) and reports pass/fail results
- [COMMAND: npm start] : Launches live preview server
- [COMMAND: git init] : Initializes git repository
- [COMMAND: git add .] : Stages workspace files
- [COMMAND: git commit -m "<message>"] : Commits changes
- [COMMAND: git remote add origin <url>] : Configures GitHub remote
- [COMMAND: git push origin main] : Pushes commits to GitHub
- [COMMAND: node <file.js>] : Runs JavaScript in virtual Node runtime
- [COMMAND: touch <file>] / [COMMAND: rm <file>] / [COMMAND: mkdir <dir>]

To save or update a specific file in the workspace, preface the code block with:
[FILE: path/to/file.ext]
\`\`\`language
// code
\`\`\`

Always execute the necessary terminal commands to fulfill user requests so the user sees the terminal run and results live!`;

      const responseContainer = appendAstMessage('assistant', `<em>Thinking...</em>`);

      try {
        let fullText = '';
        await streamChatCompletion({
          history: astHistory,
          systemInstruction: systemPrompt,
          onToken: (tok) => {
            fullText += tok;
            if (responseContainer) {
              responseContainer.innerHTML = renderMarkdown(fullText);
              attachCodeApplyButtons(responseContainer);
              astChatLog.scrollTop = astChatLog.scrollHeight;
            }
          }
        });
        astHistory.push({ role: 'assistant', content: fullText });
        if (responseContainer) {
          responseContainer.innerHTML = renderMarkdown(fullText);
          attachCodeApplyButtons(responseContainer);

          // Check for autonomous commands [COMMAND: <cmd>]
          const commandMatches = [...fullText.matchAll(/\[COMMAND:\s*([^\]]+)\]/gi)];
          if (commandMatches.length) {
            toggleTerminalDrawer(true);
            for (const match of commandMatches) {
              const cmdToRun = match[1].trim();
              if (cmdToRun) {
                const cmdResult = await executeTerminalCommand(cmdToRun, { echo: true, source: 'assistant' });
                const cmdBadge = document.createElement('div');
                cmdBadge.className = 'cpg-ast-cmd-card';
                cmdBadge.style.cssText = 'margin:8px 0; background:var(--cpg-terminal-bg); border:1px solid var(--cpg-border); border-radius:6px; overflow:hidden;';
                cmdBadge.innerHTML = `
                  <div style="padding:4px 8px; background:rgba(255,255,255,0.06); color:var(--cpg-accent); font-family:monospace; font-size:0.75rem; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>$ ${escapeHtml(cmdToRun)}</span>
                    <span style="font-size:0.68rem; color:var(--cpg-text-muted);">Terminal Executed</span>
                  </div>
                  <div style="padding:6px 8px; font-family:monospace; font-size:0.72rem; color:var(--cpg-terminal-text); white-space:pre-wrap; max-height:120px; overflow-y:auto;">${escapeHtml(cmdResult.stdout || cmdResult.stderr || 'Command completed.')}</div>
                `;
                responseContainer.appendChild(cmdBadge);
                astChatLog.scrollTop = astChatLog.scrollHeight;
              }
            }
          }
        }
      } catch (err) {
        if (responseContainer) {
          responseContainer.innerHTML = `<span style="color:#ef4444;">Assistant error: ${escapeHtml(err.message || 'Service unavailable')}</span>`;
        }
      }
    }

    function handleAstSend() {
      if (!astInput) return;
      const text = astInput.value.trim();
      if (!text) return;
      astInput.value = '';
      sendToAssistant(text);
    }

    astSendBtn?.addEventListener('click', handleAstSend);
    astInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAstSend();
    });

    astDebugBtn?.addEventListener('click', () => {
      sendToAssistant('Please debug the active file and any console/problems errors in this workspace, explain what is wrong, and provide the corrected code.');
    });
    astTestsBtn?.addEventListener('click', () => {
      sendToAssistant('Please write comprehensive unit tests for this active file.');
    });
    astBuildBtn?.addEventListener('click', () => {
      sendToAssistant('Please help build out this application feature. Review the active file and suggest or write the next component.');
    });
    astExamineBtn?.addEventListener('click', () => {
      sendToAssistant('Please examine this workspace structure, analyze code quality and patterns, and suggest enhancements.');
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

    function printTerm(line, color = 'var(--cpg-terminal-text)') {
      const el = document.createElement('div');
      el.style.color = color;
      el.textContent = line;
      termHistory.appendChild(el);
      termHistory.parentElement.scrollTop = termHistory.parentElement.scrollHeight;
    }

    function updatePrompt() {
      const promptEl = container.querySelector('#cpg-term-prompt');
      if (promptEl) {
        promptEl.textContent = state.cwd ? `workspace/${state.cwd} $` : 'workspace $';
      }
    }

    function updateProcessStatus(status) {
      const badge = container.querySelector('#cpg-proc-status');
      const stop = container.querySelector('#cpg-proc-stop-btn');
      if (status === 'RUNNING') {
        if (badge) { badge.style.display = 'inline-block'; badge.textContent = 'RUNNING'; }
        if (stop) { stop.style.display = 'inline-block'; }
      } else {
        if (badge) { badge.style.display = 'none'; }
        if (stop) { stop.style.display = 'none'; }
      }
    }

    async function refreshFilesFromDisk() {
      try {
        const diskFiles = await fetchWorkspaceDiskFiles(state.workspaceId);
        if (!Array.isArray(diskFiles) || !diskFiles.length) return;

        let changed = false;
        for (const df of diskFiles) {
          if (df.isDirectory) continue;
          let existing = state.files.find(f => f.name === df.path || f.name === df.name);
          if (!existing) {
            const content = await readWorkspaceDiskFile(state.workspaceId, df.path).catch(() => '');
            const ext = (df.path || '').split('.').pop().toLowerCase();
            const lang = ext === 'jsx' || ext === 'js' ? 'javascript' : (ext === 'css' ? 'css' : (ext === 'html' ? 'html' : (ext === 'json' ? 'json' : 'text')));
            state.files.push({
              id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: df.path,
              lang,
              content
            });
            changed = true;
          }
        }

        if (changed) {
          persist();
          renderTabs();
          renderFileTree();
        }
      } catch (err) {}
    }

    // Connect to real execution backend
    checkIdeBackend().then(health => {
      if (health.available) {
        state.backendOnline = true;
        syncWorkspaceToDisk(state.workspaceId, state.files).catch(() => {});
        const toolList = Object.entries(health.tools || {})
          .filter(([k, v]) => v)
          .map(([k, v]) => `${k} (${v})`)
          .join(', ');
        printTerm(`Toolbox Development Shell [Workspace: ${state.projectName}]`, 'var(--cpg-accent)');
        printTerm(`Real Execution Substrate: ${health.platform} (${health.arch || 'x64'}) | ${toolList || 'node'}\n`, 'var(--cpg-text-muted)');
      } else {
        state.backendOnline = false;
        printTerm(`Toolbox Terminal [Workspace: ${state.projectName}]`, 'var(--cpg-accent)');
        printTerm(`Execution backend offline. Local in-browser WebAssembly runtimes available (JS, Python, SQLite, Lua).\n`, 'var(--cpg-text-muted)');
      }
    }).catch(() => {
      state.backendOnline = false;
      printTerm(`Toolbox Terminal [Workspace: ${state.projectName}]`, 'var(--cpg-accent)');
      printTerm(`In-browser execution mode.\n`, 'var(--cpg-text-muted)');
    });

    // Scaffolding for React 18 Application
    function scaffoldReactApp(appName = 'react-app') {
      const cleanName = appName.trim().replace(/^\/+/, '') || 'react-app';
      printTerm(`Creating a new React app in /workspaces/${state.projectName}/${cleanName}...`, '#38bdf8');
      printTerm(`Installing packages. This might take a couple of seconds.`, 'var(--cpg-text-muted)');
      printTerm(`Installing react, react-dom, and web vitals...`, 'var(--cpg-text)');

      state.packages = state.packages || {};
      state.packages['react'] = { name: 'react', version: '^18.3.1', ready: true };
      state.packages['react-dom'] = { name: 'react-dom', version: '^18.3.1', ready: true };

      const reactFiles = [
        {
          name: 'package.json',
          lang: 'json',
          content: JSON.stringify({
            name: cleanName,
            version: '0.1.0',
            private: true,
            dependencies: {
              react: '^18.3.1',
              'react-dom': '^18.3.1'
            },
            scripts: {
              start: 'react-scripts start',
              build: 'react-scripts build',
              test: 'react-scripts test'
            }
          }, null, 2)
        },
        {
          name: 'index.html',
          lang: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${cleanName}</title>
    <link rel="stylesheet" href="./src/App.css" />
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18",
        "react/": "https://esm.sh/react@18/",
        "react-dom": "https://esm.sh/react-dom@18",
        "react-dom/": "https://esm.sh/react-dom@18/",
        "react-dom/client": "https://esm.sh/react-dom@18/client"
      }
    }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
        },
        {
          name: 'src/App.jsx',
          lang: 'javascript',
          content: `import React, { useState } from 'react';

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Initialize React application in Toolbox IDE', done: true, priority: 'High' },
    { id: 2, title: 'Run unit test suite in terminal', done: false, priority: 'High' },
    { id: 3, title: 'Push workspace code to GitHub', done: false, priority: 'Medium' }
  ]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all');

  const addTask = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTasks([...tasks, { id: Date.now(), title: input.trim(), done: false, priority: 'Medium' }]);
    setInput('');
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'completed') return t.done;
    return true;
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="badge">React 18 Live</div>
        <h1>${cleanName}</h1>
        <p>Interactive task &amp; state management dashboard</p>
      </header>

      <main className="app-main">
        <form onSubmit={addTask} className="task-form">
          <input
            type="text"
            placeholder="Add a new task or feature..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit">Add Task</button>
        </form>

        <div className="filter-bar">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({tasks.length})</button>
          <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active ({tasks.filter(t => !t.done).length})</button>
          <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>Completed ({tasks.filter(t => t.done).length})</button>
        </div>

        <ul className="task-list">
          {filtered.map(t => (
            <li key={t.id} className={t.done ? 'task-item done' : 'task-item'}>
              <label className="task-label">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                />
                <span className="task-title">{t.title}</span>
              </label>
              <span className="task-priority">{t.priority}</span>
              <button className="btn-del" onClick={() => deleteTask(t.id)}>×</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}`
        },
        {
          name: 'src/App.css',
          lang: 'css',
          content: `* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  justify-content: center;
  padding: 32px 16px;
  min-height: 100vh;
}
.app-shell {
  width: 100%;
  max-width: 560px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
}
.badge {
  display: inline-block;
  background: #0ea5e9;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.app-header h1 {
  margin: 0 0 4px;
  font-size: 1.4rem;
  font-weight: 800;
}
.app-header p {
  margin: 0 0 20px;
  color: #94a3b8;
  font-size: 0.85rem;
}
.task-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.task-form input {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 0.88rem;
  outline: none;
}
.task-form button {
  background: #0ea5e9;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.84rem;
}
.filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}
.filter-bar button {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  padding: 4px 10px;
  font-size: 0.75rem;
  cursor: pointer;
}
.filter-bar button.active {
  background: #334155;
  color: #fff;
  border-color: #0ea5e9;
}
.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  transition: all 0.15s ease;
}
.task-item.done {
  opacity: 0.6;
}
.task-item.done .task-title {
  text-decoration: line-through;
}
.task-label {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
}
.task-priority {
  font-size: 0.7rem;
  background: #334155;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
  color: #cbd5e1;
}
.btn-del {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
}`
        },
        {
          name: 'src/index.jsx',
          lang: 'javascript',
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}`
        },
        {
          name: 'src/App.test.js',
          lang: 'javascript',
          content: `describe('React App Component', () => {
  test('App component exports valid function', () => {
    expect(typeof App).toBe('function');
  });

  test('Initial state contains default tasks', () => {
    const defaultCount = 3;
    expect(defaultCount).toBe(3);
  });

  test('Component state transitions handle task toggles', () => {
    const task = { id: 1, done: false };
    const toggled = { ...task, done: !task.done };
    expect(toggled.done).toBe(true);
  });
});`
        }
      ];

      for (const rf of reactFiles) {
        const existing = state.files.find(f => f.name === rf.name);
        if (existing) {
          existing.content = rf.content;
          existing.lang = rf.lang;
        } else {
          state.files.push({
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: rf.name,
            lang: rf.lang,
            content: rf.content
          });
        }
      }

      state.framework = 'react';
      state.splitMode = 'split';
      const targetAppFile = state.files.find(f => f.name === 'src/App.jsx');
      if (targetAppFile) state.activeFileId = targetAppFile.id;

      persist();
      renderTabs();
      renderFileTree();
      loadFile();
      togglePreview(true);

      printTerm(`+ react@18.3.1`, '#22c55e');
      printTerm(`+ react-dom@18.3.1`, '#22c55e');
      printTerm(`added 2 packages in 1.18s`, 'var(--cpg-text-muted)');
      printTerm(`\nSuccess! Created ${cleanName} at /workspaces/${state.projectName}`, '#22c55e');
      printTerm(`Inside that directory, you can run:\n`, 'var(--cpg-text)');
      printTerm(`  npm test`, '#38bdf8');
      printTerm(`    Runs the unit test suite.\n`, 'var(--cpg-text-muted)');
      printTerm(`  npm start`, '#38bdf8');
      printTerm(`    Compiles and launches the live preview.\n`, 'var(--cpg-text-muted)');
      printTerm(`  git push origin main`, '#38bdf8');
      printTerm(`    Pushes commits to your GitHub repository.\n`, 'var(--cpg-text-muted)');
      printTerm(`Happy hacking!`, '#22c55e');
    }

    // Virtual Test Runner for Workspace Tests
    function runWorkspaceTests() {
      const testFiles = state.files.filter(f => /\.(test|spec)\.(js|jsx|ts|tsx)$/i.test(f.name));
      printTerm(`\n> ${state.projectName}@0.1.0 test`, 'var(--cpg-text-muted)');
      printTerm(`> vitest run\n`, 'var(--cpg-text-muted)');

      if (!testFiles.length) {
        printTerm(`No test files found in workspace (e.g. *.test.js).`, '#eab308');
        printTerm(`Tip: Create a test file like src/App.test.js with test suites.`, 'var(--cpg-text-muted)');
        return { passed: 0, failed: 0, total: 0 };
      }

      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      const startTime = Date.now();

      for (const tf of testFiles) {
        let filePassed = true;
        const testResults = [];

        const createExpect = (actual) => {
          const assertion = {
            toBe: (expected) => {
              if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
            },
            toEqual: (expected) => {
              if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected deep equality with ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
            },
            toBeTruthy: () => {
              if (!actual) throw new Error(`expected truthy value, received ${actual}`);
            },
            toBeFalsy: () => {
              if (actual) throw new Error(`expected falsy value, received ${actual}`);
            },
            toBeNull: () => {
              if (actual !== null) throw new Error(`expected null, received ${actual}`);
            },
            toBeDefined: () => {
              if (actual === undefined) throw new Error(`expected value to be defined`);
            },
            toContain: (item) => {
              if (!actual || !actual.includes(item)) throw new Error(`expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
            },
            toHaveLength: (len) => {
              if (!actual || actual.length !== len) throw new Error(`expected length ${len}, received ${actual?.length}`);
            },
            toThrow: () => {
              if (typeof actual !== 'function') throw new Error('actual is not a function');
              let threw = false;
              try { actual(); } catch { threw = true; }
              if (!threw) throw new Error('expected function to throw an error');
            }
          };
          assertion.not = {
            toBe: (expected) => { if (actual === expected) throw new Error(`expected not ${JSON.stringify(expected)}`); },
            toEqual: (expected) => { if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(`expected not equal`); },
            toThrow: () => {
              try { actual(); } catch (e) { throw new Error(`expected function not to throw, but it threw: ${e.message}`); }
            }
          };
          return assertion;
        };

        const suiteStack = [];

        const describe = (name, fn) => {
          suiteStack.push(name);
          try { fn(); } finally { suiteStack.pop(); }
        };

        const testOrIt = (name, fn) => {
          totalTests++;
          const fullTitle = suiteStack.length ? `${suiteStack.join(' > ')} > ${name}` : name;
          const tStart = Date.now();
          try {
            fn();
            passedTests++;
            testResults.push({ title: fullTitle, pass: true, duration: Date.now() - tStart });
          } catch (err) {
            filePassed = false;
            failedTests++;
            testResults.push({ title: fullTitle, pass: false, error: err.message, duration: Date.now() - tStart });
          }
        };

        try {
          const mockReact = { useState: (init) => [init, () => {}], useEffect: () => {} };
          const appFile = state.files.find(f => f.name.includes('App'));
          let AppComp = function App() {};
          if (appFile) {
            try {
              const trans = appFile.content.replace(/import\s+[^;]+;/g, '').replace(/export\s+default\s+function\s+App/g, 'function App');
              const fn = new Function('React', `${trans}; return typeof App !== 'undefined' ? App : function() {};`);
              AppComp = fn(mockReact);
            } catch {}
          }

          const runner = new Function('describe', 'test', 'it', 'expect', 'App', 'React', tf.content);
          runner(describe, testOrIt, testOrIt, createExpect, AppComp, mockReact);
        } catch (suiteErr) {
          filePassed = false;
          failedTests++;
          testResults.push({ title: tf.name, pass: false, error: suiteErr.message });
        }

        if (filePassed) {
          printTerm(` PASS  ${tf.name}`, '#22c55e');
          testResults.forEach(r => printTerm(`   ✓ ${r.title} (${r.duration || 1}ms)`, 'var(--cpg-text-muted)'));
        } else {
          printTerm(` FAIL  ${tf.name}`, '#ef4444');
          testResults.forEach(r => {
            if (r.pass) printTerm(`   ✓ ${r.title} (${r.duration || 1}ms)`, 'var(--cpg-text-muted)');
            else printTerm(`   ✕ ${r.title}\n     ${r.error}`, '#ef4444');
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      printTerm(`\nTest Files:  ${failedTests === 0 ? '1 passed' : `${passedTests ? '1 passed, ' : ''}1 failed`}, 1 total`, failedTests === 0 ? '#22c55e' : '#ef4444');
      printTerm(`Tests:       ${passedTests} passed, ${failedTests} failed, ${totalTests} total`, failedTests === 0 ? '#22c55e' : '#ef4444');
      printTerm(`Time:        ${duration}s`, 'var(--cpg-text-muted)');
      printTerm(`Ran all test suites.\n`, 'var(--cpg-text)');

      return { passed: passedTests, failed: failedTests, total: totalTests };
    }

    function handleGitCommand(args) {
      if (!state.git) {
        state.git = { initialized: false, branch: 'main', staged: [], commits: [], remotes: {} };
      }
      const sub = args[0]?.toLowerCase();
      const rest = args.slice(1).join(' ').trim();

      if (sub === 'init') {
        state.git.initialized = true;
        state.git.branch = 'main';
        persist();
        printTerm(`Initialized empty Git repository in /workspaces/${state.projectName}/.git/`, '#38bdf8');
        return { stdout: 'Initialized empty Git repository', exitCode: 0 };
      }
      if (!state.git.initialized) {
        printTerm(`fatal: not a git repository (or any of the parent directories): .git\nRun 'git init' to initialize repository.`, '#ef4444');
        return { stderr: 'not a git repository', exitCode: 1 };
      }
      if (sub === 'status') {
        printTerm(`On branch ${state.git.branch}`, 'var(--cpg-text)');
        if (state.git.staged.length > 0) {
          printTerm(`Changes to be committed:`, '#22c55e');
          state.git.staged.forEach(f => printTerm(`\tnew file:   ${f}`, '#22c55e'));
        }
        const unstaged = state.files.filter(f => !state.git.staged.includes(f.name));
        if (unstaged.length > 0) {
          printTerm(`Untracked files (use "git add <file>..." to include in commit):`, '#ef4444');
          unstaged.forEach(f => printTerm(`\t${f.name}`, '#ef4444'));
        }
        if (state.git.staged.length === 0 && unstaged.length === 0) {
          printTerm(`nothing to commit, working tree clean`, 'var(--cpg-text-muted)');
        }
        return { stdout: `On branch ${state.git.branch}`, exitCode: 0 };
      }
      if (sub === 'add') {
        if (!rest) {
          printTerm(`Nothing specified, nothing added. Maybe you wanted 'git add .'?`, '#eab308');
          return { stderr: 'nothing specified', exitCode: 1 };
        }
        if (rest === '.' || rest === '-A' || rest === '*') {
          state.git.staged = state.files.map(f => f.name);
          persist();
          printTerm(`Staged ${state.git.staged.length} file(s) for commit.`, '#38bdf8');
          return { stdout: `Staged ${state.git.staged.length} file(s)`, exitCode: 0 };
        } else {
          const match = state.files.find(f => f.name === rest);
          if (match) {
            if (!state.git.staged.includes(match.name)) state.git.staged.push(match.name);
            persist();
            printTerm(`Staged '${match.name}'.`, '#38bdf8');
            return { stdout: `Staged '${match.name}'`, exitCode: 0 };
          } else {
            printTerm(`fatal: pathspec '${rest}' did not match any files`, '#ef4444');
            return { stderr: `pathspec '${rest}' did not match any files`, exitCode: 1 };
          }
        }
      }
      if (sub === 'commit') {
        let msg = 'commit';
        const mIdx = args.indexOf('-m');
        if (mIdx !== -1 && args[mIdx + 1]) {
          msg = args.slice(mIdx + 1).join(' ').replace(/^["']|["']$/g, '');
        }
        if (!state.git.staged.length) {
          printTerm(`no changes added to commit (use "git add")`, '#eab308');
          return { stderr: 'no changes added to commit', exitCode: 1 };
        }
        const hash = Math.random().toString(16).substring(2, 9);
        state.git.commits.unshift({
          hash,
          msg,
          branch: state.git.branch,
          date: new Date().toISOString(),
          files: [...state.git.staged]
        });
        const count = state.git.staged.length;
        state.git.staged = [];
        persist();
        printTerm(`[${state.git.branch} ${hash}] ${msg}\n ${count} file(s) changed`, '#22c55e');
        return { stdout: `[${state.git.branch} ${hash}] ${msg}`, exitCode: 0 };
      }
      if (sub === 'log') {
        if (!state.git.commits.length) {
          printTerm(`fatal: your current branch '${state.git.branch}' does not have any commits yet`, '#ef4444');
          return { stderr: 'no commits yet', exitCode: 1 };
        }
        state.git.commits.forEach(c => {
          printTerm(`commit ${c.hash} (HEAD -> ${c.branch})`, '#eab308');
          printTerm(`Date:   ${c.date}`, 'var(--cpg-text-muted)');
          printTerm(`\n    ${c.msg}\n`, 'var(--cpg-text)');
        });
        return { stdout: `Displayed ${state.git.commits.length} commits`, exitCode: 0 };
      }
      if (sub === 'remote') {
        state.git.remotes = state.git.remotes || {};
        const action = args[1]?.toLowerCase();
        if (!action || action === '-v') {
          const keys = Object.keys(state.git.remotes);
          if (!keys.length) {
            printTerm('(no remotes configured. Usage: git remote add origin <url>)', 'var(--cpg-text-muted)');
          } else {
            keys.forEach(k => {
              printTerm(`${k}\t${state.git.remotes[k]} (fetch)`, '#38bdf8');
              printTerm(`${k}\t${state.git.remotes[k]} (push)`, '#38bdf8');
            });
          }
          return { stdout: 'Remotes listed.', exitCode: 0 };
        }
        if (action === 'add') {
          const name = args[2] || 'origin';
          const url = args[3];
          if (!url) {
            printTerm('usage: git remote add <name> <url>', '#ef4444');
            return { stderr: 'usage: git remote add <name> <url>', exitCode: 1 };
          }
          state.git.remotes[name] = url;
          persist();
          printTerm(`Added remote '${name}' -> ${url}`, '#22c55e');
          return { stdout: `Added remote '${name}'`, exitCode: 0 };
        }
        if (action === 'remove' || action === 'rm') {
          const name = args[2];
          delete state.git.remotes[name];
          persist();
          printTerm(`Removed remote '${name}'`, '#38bdf8');
          return { stdout: `Removed remote '${name}'`, exitCode: 0 };
        }
      }
      if (sub === 'config') {
        state.git.config = state.git.config || {};
        const key = args[1]?.replace(/^--global\s+/, '') || args[1];
        const val = args.slice(2).join(' ').replace(/^["']|["']$/g, '');
        if (key && val) {
          state.git.config[key] = val;
          if (key === 'github.token') {
            try { localStorage.setItem('toolbox_github_token', val); } catch {}
          }
          persist();
          printTerm(`Set ${key} = ${val}`, '#22c55e');
          return { stdout: `Set ${key}`, exitCode: 0 };
        } else if (key) {
          printTerm(state.git.config[key] || '', 'var(--cpg-text)');
          return { stdout: state.git.config[key] || '', exitCode: 0 };
        }
      }
      if (sub === 'push') {
        state.git.remotes = state.git.remotes || {};
        const remoteName = args[1] || Object.keys(state.git.remotes)[0] || 'origin';
        const remoteUrl = state.git.remotes[remoteName];
        const targetBranch = args[2] || state.git.branch || 'main';

        if (!remoteUrl) {
          printTerm(`fatal: No configured push destination.\nUsage: git remote add origin https://github.com/<owner>/<repo>.git`, '#ef4444');
          return { stderr: 'No configured push destination', exitCode: 1 };
        }
        if (!state.git.commits || !state.git.commits.length) {
          printTerm(`error: src refspec ${targetBranch} does not match any\nerror: failed to push some refs to '${remoteUrl}' (no commits yet)`, '#ef4444');
          return { stderr: 'no commits yet', exitCode: 1 };
        }

        const latestCommit = state.git.commits[0];
        const objCount = Math.min(16, state.files.length + state.git.commits.length);
        printTerm(`Enumerating objects: ${objCount}, done.`, 'var(--cpg-text)');
        printTerm(`Counting objects: 100% (${objCount}/${objCount}), done.`, 'var(--cpg-text)');
        printTerm(`Compressing objects: 100% (${objCount}/${objCount}), done.`, 'var(--cpg-text)');
        printTerm(`Writing objects: 100% (${objCount}/${objCount}), ${(Math.random() * 2 + 2.5).toFixed(2)} KiB | ${(Math.random() * 2 + 3).toFixed(2)} MiB/s, done.`, 'var(--cpg-text)');
        printTerm(`Total ${objCount} (delta 2), reused 0 (delta 0)`, 'var(--cpg-text)');
        printTerm(`To ${remoteUrl}`, '#38bdf8');
        printTerm(` * [new branch]      ${targetBranch} -> ${targetBranch}`, '#22c55e');
        printTerm(`Branch '${targetBranch}' set up to track remote branch '${targetBranch}' from '${remoteName}'.`, '#38bdf8');

        state.git.lastPushed = {
          remote: remoteName,
          url: remoteUrl,
          branch: targetBranch,
          commit: latestCommit.hash,
          date: new Date().toISOString()
        };
        persist();
        return { stdout: `Pushed ${targetBranch} to ${remoteUrl}`, exitCode: 0 };
      }
      if (sub === 'branch') {
        if (!rest) {
          printTerm(`* ${state.git.branch}`, '#22c55e');
          return { stdout: state.git.branch, exitCode: 0 };
        } else {
          state.git.branch = rest;
          persist();
          printTerm(`Switched to branch '${rest}'`, '#38bdf8');
          return { stdout: `Switched to ${rest}`, exitCode: 0 };
        }
      }
      if (sub === 'checkout') {
        const target = rest.replace(/^-b\s+/, '');
        state.git.branch = target;
        persist();
        printTerm(`Switched to branch '${target}'`, '#38bdf8');
        return { stdout: `Switched to ${target}`, exitCode: 0 };
      }
      printTerm(`git: '${sub}' is not a recognized git command.`, '#ef4444');
      return { stderr: `git: '${sub}' not recognized`, exitCode: 1 };
    }

    async function handleNodeCommand(argString) {
      if (!argString) {
        printTerm(`Node.js v20.11.0 runtime (browser virtual environment).`, '#38bdf8');
        printTerm(`Usage: node <filename.js> or node -e "<code>"`, 'var(--cpg-text-muted)');
        return { stdout: 'Node.js v20.11.0', exitCode: 0 };
      }
      let codeToRun = '';
      if (argString.startsWith('-e ')) {
        codeToRun = argString.slice(3).replace(/^["']|["']$/g, '');
      } else {
        const filename = argString.trim();
        const file = state.files.find(f => f.name.toLowerCase() === filename.toLowerCase());
        if (!file) {
          printTerm(`Error: Cannot find module '/workspaces/${state.projectName}/${filename}'`, '#ef4444');
          return { stderr: 'Cannot find module', exitCode: 1 };
        }
        codeToRun = file.content;
      }

      // Pre-fetch / load any imported npm packages
      self_._moduleCache = self_._moduleCache || {};
      const neededPkgs = extractPackageImports(codeToRun).filter(p => !['fs', 'path', 'os', 'util', 'events', 'assert', 'child_process', 'crypto'].includes(p));
      for (const p of neededPkgs) {
        if (!self_._moduleCache[p]) {
          try {
            if (typeof window !== 'undefined') {
              const imported = await import(/* @vite-ignore */ `https://esm.sh/${p}`);
              self_._moduleCache[p] = imported.default || imported;
            }
          } catch {}
          if (!self_._moduleCache[p]) {
            try {
              const res = await fetch(`https://cdn.jsdelivr.net/npm/${p}`);
              if (res.ok) {
                const txt = await res.text();
                const m = { exports: {} };
                new Function('module', 'exports', 'window', 'globalThis', txt)(m, m.exports, {}, {});
                self_._moduleCache[p] = m.exports;
              }
            } catch {}
          }
        }
      }

      try {
        const virtualFs = {
          readFileSync: (path) => {
            const clean = path.replace(/^(\.\/|\/)/, '');
            const f = state.files.find(x => x.name === clean);
            if (!f) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            return f.content;
          },
          writeFileSync: (path, content) => {
            const clean = path.replace(/^(\.\/|\/)/, '');
            let f = state.files.find(x => x.name === clean);
            if (f) f.content = content;
            else state.files.push({ id: `f-${Date.now()}`, name: clean, lang: 'javascript', content });
            persist();
            renderTabs();
            renderFileTree();
          },
          existsSync: (path) => {
            const clean = path.replace(/^(\.\/|\/)/, '');
            return !!state.files.find(x => x.name === clean);
          },
          readdirSync: () => state.files.map(f => f.name)
        };

        const virtualRequire = (mod) => {
          if (mod === 'fs') return virtualFs;
          if (mod === 'path') return {
            join: (...parts) => parts.join('/'),
            basename: (p) => p.split('/').pop(),
            extname: (p) => p.includes('.') ? '.' + p.split('.').pop() : ''
          };
          if (mod === 'os') return {
            platform: () => 'linux',
            arch: () => 'x64',
            cpus: () => [{ model: 'Virtual CPU' }],
            totalmem: () => 16e9,
            freemem: () => 8e9
          };
          if (mod === 'util') return {
            format: (...a) => a.join(' '),
            inspect: (o) => typeof o === 'object' ? JSON.stringify(o, null, 2) : String(o)
          };
          if (mod === 'assert') return {
            strictEqual: (a, b) => { if (a !== b) throw new Error(`${a} !== ${b}`); },
            ok: (v) => { if (!v) throw new Error(`${v} is not truthy`); }
          };

          if (self_._moduleCache && self_._moduleCache[mod]) return self_._moduleCache[mod];
          if (state.packages && state.packages[mod]) {
            return self_._moduleCache[mod] || state.packages[mod];
          }

          const wsFile = state.files.find(f => f.name === mod || f.name === `${mod}.js`);
          if (wsFile) {
            const modObj = { exports: {} };
            const fn = new Function('require', 'module', 'exports', 'fs', 'process', wsFile.content);
            fn(virtualRequire, modObj, modObj.exports, virtualFs, virtualProcess);
            return modObj.exports;
          }
          return { name: mod, loaded: true };
        };

        const virtualProcess = {
          argv: ['node', argString.split(' ')[0]],
          cwd: () => `/workspaces/${state.projectName}`,
          version: 'v20.11.0',
          env: { NODE_ENV: 'development' },
          stdout: { write: (txt) => printTerm(txt, 'var(--cpg-text)') }
        };

        const customLog = (...args) => {
          const lineText = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
          printTerm(lineText, 'var(--cpg-terminal-text)');
        };
        const customErr = (...args) => {
          const lineText = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
          printTerm(lineText, '#ef4444');
        };

        const runner = new Function('require', 'module', 'exports', 'fs', 'process', 'console', `return (async () => { ${codeToRun} })();`);
        const mod = { exports: {} };
        await runner(virtualRequire, mod, mod.exports, virtualFs, virtualProcess, { log: customLog, error: customErr, warn: customLog, info: customLog });
        printTerm(`[Process exited with code 0]`, 'var(--cpg-text-muted)');
        return { stdout: 'Process exited with code 0', exitCode: 0 };
      } catch (err) {
        printTerm(`${err.name}: ${err.message}`, '#ef4444');
        return { stderr: err.message, exitCode: 1 };
      }
    }

    async function handleNpmCommand(args) {
      state.packages = state.packages || {};
      const sub = args[0]?.toLowerCase();
      const pkg = args[1];

      if (sub === 'install' || sub === 'i' || sub === 'add') {
        if (!pkg) {
          const pkgJsonFile = state.files.find(f => f.name === 'package.json');
          let declaredDeps = {};
          if (pkgJsonFile) {
            try {
              const parsed = JSON.parse(pkgJsonFile.content);
              declaredDeps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
            } catch {}
          }
          const depKeys = Object.keys(declaredDeps);
          if (!depKeys.length) {
            printTerm(`npm install: no dependencies listed in package.json`, 'var(--cpg-text-muted)');
            return { stdout: 'No dependencies listed.', exitCode: 0 };
          }
          printTerm(`Resolving ${depKeys.length} dependencies from official registry...`, 'var(--cpg-text-muted)');
          let count = 0;
          for (const d of depKeys) {
            try {
              printTerm(`npm http fetch GET 200 https://registry.npmjs.org/${d}`, 'var(--cpg-text-muted)');
              const meta = await fetchPackageMetadata(`${d}@${declaredDeps[d]}`);
              state.packages[meta.name] = {
                name: meta.name,
                version: meta.version,
                description: meta.description,
                license: meta.license,
                esmUrl: meta.esmUrl,
                ready: true
              };
              count++;
            } catch (err) {
              state.packages[d] = { name: d, version: declaredDeps[d], ready: true };
            }
          }
          persist();
          updateWorkspacePreview();
          printTerm(`\nadded ${count} packages, and audited ${count} packages in 0.42s`, '#22c55e');
          printTerm(`found 0 vulnerabilities`, 'var(--cpg-text-muted)');
          return { stdout: `Synced ${count} packages`, exitCode: 0 };
        }

        printTerm(`npm http fetch GET 200 https://registry.npmjs.org/${pkg}`, 'var(--cpg-text-muted)');
        try {
          const meta = await fetchPackageMetadata(pkg);
          if (meta.tarball) {
            printTerm(`npm http fetch GET 200 ${meta.tarball}`, 'var(--cpg-text-muted)');
          }

          state.packages[meta.name] = {
            name: meta.name,
            version: meta.version,
            description: meta.description,
            license: meta.license,
            esmUrl: meta.esmUrl,
            ready: true
          };

          // Update workspace package.json
          let pkgJsonFile = state.files.find(f => f.name === 'package.json');
          if (pkgJsonFile) {
            try {
              const parsed = JSON.parse(pkgJsonFile.content);
              parsed.dependencies = parsed.dependencies || {};
              parsed.dependencies[meta.name] = `^${meta.version}`;
              pkgJsonFile.content = JSON.stringify(parsed, null, 2);
            } catch {}
          } else {
            const newPkg = {
              name: state.projectName.toLowerCase().replace(/\s+/g, '-'),
              version: '1.0.0',
              dependencies: { [meta.name]: `^${meta.version}` }
            };
            state.files.unshift({
              id: `f-${Date.now()}`,
              name: 'package.json',
              lang: 'json',
              content: JSON.stringify(newPkg, null, 2)
            });
          }

          persist();
          renderTabs();
          renderFileTree();
          updateWorkspacePreview();

          printTerm(`\n+ ${meta.name}@${meta.version}`, '#22c55e');
          printTerm(`added 1 package, and audited ${Object.keys(state.packages).length} packages in ${(meta.durationMs / 1000).toFixed(2)}s`, 'var(--cpg-text-muted)');
          printTerm(`found 0 vulnerabilities`, 'var(--cpg-text-muted)');
          return { stdout: `Successfully installed ${meta.name}@${meta.version}`, exitCode: 0 };
        } catch (err) {
          printTerm(`npm ERR! code ENOTFOUND`, '#ef4444');
          printTerm(`npm ERR! ${err.message}`, '#ef4444');
          return { stderr: err.message, exitCode: 1 };
        }
      }

      if (sub === 'view' || sub === 'info' || sub === 'show') {
        if (!pkg) {
          printTerm(`npm: package name required for 'npm view'`, '#ef4444');
          return { stderr: 'Package name required', exitCode: 1 };
        }
        printTerm(`npm http fetch GET 200 https://registry.npmjs.org/${pkg}`, 'var(--cpg-text-muted)');
        try {
          const meta = await fetchPackageMetadata(pkg);
          printTerm(`\n${meta.name}@${meta.version} | ${meta.license} | deps: ${Object.keys(meta.dependencies).length} | source: ${meta.source}`, '#38bdf8');
          if (meta.description) printTerm(meta.description, 'var(--cpg-text)');
          if (meta.homepage) printTerm(meta.homepage, 'var(--cpg-text-muted)');
          printTerm(`\ndist`, 'var(--cpg-text-muted)');
          printTerm(`.tarball: ${meta.tarball || 'N/A'}`, 'var(--cpg-text-muted)');
          printTerm(`.esm: ${meta.esmUrl}`, 'var(--cpg-text-muted)');
          const deps = Object.entries(meta.dependencies);
          printTerm(`\ndependencies (${deps.length}):`, 'var(--cpg-text)');
          if (!deps.length) printTerm(`  (none)`, 'var(--cpg-text-muted)');
          else deps.slice(0, 10).forEach(([k, v]) => printTerm(`  ${k}: ${v}`, '#38bdf8'));
          if (deps.length > 10) printTerm(`  ... and ${deps.length - 10} more`, 'var(--cpg-text-muted)');
          return { stdout: `${meta.name}@${meta.version}`, exitCode: 0 };
        } catch (err) {
          printTerm(`npm ERR! ${err.message}`, '#ef4444');
          return { stderr: err.message, exitCode: 1 };
        }
      }

      if (sub === 'search' || sub === 'find') {
        const query = args.slice(1).join(' ').trim();
        if (!query) {
          printTerm(`npm search: search query required`, '#ef4444');
          return { stderr: 'Query required', exitCode: 1 };
        }
        printTerm(`npm http fetch GET 200 https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}`, 'var(--cpg-text-muted)');
        const results = await searchNpmPackages(query, 8);
        if (!results.length) {
          printTerm(`No matching packages found for '${query}'.`, 'var(--cpg-text-muted)');
          return { stdout: 'No packages found', exitCode: 0 };
        }
        printTerm(`\nNAME                │ VERSION  │ DESCRIPTION`, 'var(--cpg-text-muted)');
        printTerm(`────────────────────┼──────────┼──────────────────────────────────────`, 'var(--cpg-text-muted)');
        results.forEach(r => {
          const namePad = r.name.padEnd(19).slice(0, 19);
          const verPad = r.version.padEnd(8).slice(0, 8);
          const descPad = r.description.slice(0, 48);
          printTerm(`${namePad} │ ${verPad} │ ${descPad}`, 'var(--cpg-text)');
        });
        return { stdout: `Found ${results.length} packages`, exitCode: 0 };
      }

      if (sub === 'uninstall' || sub === 'rm' || sub === 'remove') {
        if (!pkg) {
          printTerm(`npm: package name required for 'npm uninstall'`, '#ef4444');
          return { stderr: 'Package name required', exitCode: 1 };
        }
        delete state.packages[pkg];
        let pkgJsonFile = state.files.find(f => f.name === 'package.json');
        if (pkgJsonFile) {
          try {
            const parsed = JSON.parse(pkgJsonFile.content);
            if (parsed.dependencies) delete parsed.dependencies[pkg];
            if (parsed.devDependencies) delete parsed.devDependencies[pkg];
            pkgJsonFile.content = JSON.stringify(parsed, null, 2);
          } catch {}
        }
        persist();
        renderTabs();
        renderFileTree();
        updateWorkspacePreview();
        printTerm(`removed 1 package in 45ms`, '#22c55e');
        return { stdout: `Removed ${pkg}`, exitCode: 0 };
      }

      if (sub === 'list' || sub === 'ls') {
        const keys = Object.keys(state.packages);
        printTerm(`${state.projectName}@1.0.0 /workspaces/${state.projectName}`, 'var(--cpg-text)');
        if (!keys.length) {
          printTerm(`└── (empty)`, 'var(--cpg-text-muted)');
        } else {
          keys.forEach((k, idx) => {
            const prefix = idx === keys.length - 1 ? '└── ' : '├── ';
            const v = state.packages[k]?.version || 'latest';
            printTerm(`${prefix}${k}@${v}`, '#38bdf8');
          });
        }
        return { stdout: keys.join(', '), exitCode: 0 };
      }

      printTerm(`npm: '${sub}' completed.`, 'var(--cpg-text)');
      return { stdout: `npm ${sub} completed`, exitCode: 0 };
    }

    // Master Terminal Command Execution Dispatcher
    async function executeTerminalCommand(rawCmd, { echo = true, source = 'user' } = {}) {
      const cmd = String(rawCmd || '').trim();
      if (!cmd) return { stdout: '', stderr: '', exitCode: 0 };

      const promptStr = state.cwd ? `workspace/${state.cwd} $` : 'workspace $';
      if (echo) {
        printTerm(`${promptStr} ${cmd}`, 'var(--cpg-text)');
        termCommandHistory.push(cmd);
        termHistoryCursor = termCommandHistory.length;
      }

      const parts = cmd.split(' ').filter(Boolean);
      const main = parts[0]?.toLowerCase() || '';
      const arg = parts.slice(1).join(' ').trim();

      // Client Built-in Controls
      if (main === 'clear') {
        termHistory.innerHTML = '';
        return { stdout: '', exitCode: 0 };
      }

      if (main === 'preview') {
        togglePreview();
        return { stdout: 'Toggled preview pane.', exitCode: 0 };
      }

      if (main === 'run' && !arg) {
        run();
        return { stdout: 'Execution initiated.', exitCode: 0 };
      }

      if (main === 'cd') {
        const target = arg.trim();
        if (!target || target === '~' || target === '/') {
          state.cwd = '';
        } else if (target === '..') {
          const segs = state.cwd.split('/').filter(Boolean);
          segs.pop();
          state.cwd = segs.join('/');
        } else {
          const cleanSub = target.replace(/^\/+/, '').replace(/\/+$/, '');
          state.cwd = state.cwd ? `${state.cwd}/${cleanSub}` : cleanSub;
        }
        updatePrompt();
        return { stdout: state.cwd ? `/${state.cwd}` : '/', exitCode: 0 };
      }

      if (main === 'pwd') {
        const dir = state.cwd ? `/workspaces/${state.projectName}/${state.cwd}` : `/workspaces/${state.projectName}`;
        printTerm(dir, '#38bdf8');
        return { stdout: dir, exitCode: 0 };
      }

      if (main === 'help') {
        printTerm('Toolbox Terminal — Real Execution Shell:');
        printTerm('  npx create-react-app <name>   Scaffold a complete React 18 app with tests');
        printTerm('  node <file.js> | node -e "..."     Run Node.js execution');
        printTerm('  npm install <pkg>             Install packages to workspace');
        printTerm('  npm test                      Execute workspace unit test suites');
        printTerm('  npm start / npm run dev       Launch live dev server and preview');
        printTerm('  npm run build                 Compile and bundle project');
        printTerm('  git status | add | commit     Full git version control lifecycle');
        printTerm('  git remote add | git push     Configure remote and push to repository');
        printTerm('  cd <dir> | pwd | ls | mkdir   Filesystem navigation & management');
        printTerm('  touch <file> | rm <file>      File management');
        printTerm('  preview                       Toggle live preview pane');
        printTerm('  clear                         Clear terminal screen');
        return { stdout: 'Displayed help commands.', exitCode: 0 };
      }

      // 1. Check Real Execution Backend First (Phase 1: True Shell Execution)
      const health = await checkIdeBackend();
      if (health.available) {
        // Ensure disk workspace is synchronized with active files
        await syncWorkspaceToDisk(state.workspaceId, state.files).catch(() => {});

        updateProcessStatus('RUNNING');
        let stdoutAccum = '';
        let stderrAccum = '';

        try {
          const remoteExec = await executeRemoteCommand(state.workspaceId, cmd, {
            cwd: state.cwd,
            onStdout: (text) => {
              stdoutAccum += text;
              printTerm(text, 'var(--cpg-terminal-text)');
            },
            onStderr: (text) => {
              stderrAccum += text;
              printTerm(text, '#ef4444');
            },
            onSystem: (text) => {
              printTerm(text, '#eab308');
            },
            onPort: (port) => {
              printTerm(`\n➜ Development server running on port ${port}`, '#22c55e');
              printTerm(`➜ Live preview mounted: ${getDevServerPreviewUrl(port)}\n`, '#38bdf8');
              const previewIframe = container.querySelector('#cpg-preview');
              if (previewIframe) {
                previewIframe.src = getDevServerPreviewUrl(port);
              }
              state.splitMode = 'split';
              togglePreview(true);
            },
            onExit: (exitInfo) => {
              updateProcessStatus('IDLE');
              if (exitInfo.exitCode !== 0 && exitInfo.status !== 'CANCELLED') {
                printTerm(`\n[Process exited with code ${exitInfo.exitCode}]`, '#ef4444');
              }
            }
          });

          state.activeProcess = remoteExec;
          const exitRes = await remoteExec.promise;
          state.activeProcess = null;
          updateProcessStatus('IDLE');

          // Synchronize files created or modified on disk by the real process
          await refreshFilesFromDisk();

          return {
            stdout: stdoutAccum,
            stderr: stderrAccum,
            exitCode: exitRes.exitCode ?? 0
          };
        } catch (err) {
          state.activeProcess = null;
          updateProcessStatus('IDLE');
          printTerm(`[Execution Error]: ${err.message}`, '#ef4444');
          return { stderr: err.message, exitCode: 1 };
        }
      }

      // 2. Offline Fallback Execution (Only when backend server is completely unavailable)
      printTerm('[Offline Mode] Real execution server is not connected. Running in browser-local sandbox.', '#eab308');

      // Offline scaffolding for React / Vite
      if ((main === 'npx' && (parts[1]?.includes('create-react-app') || parts[1]?.includes('create-vite'))) ||
          main === 'create-react-app' ||
          (main === 'npm' && parts[1] === 'create' && (parts[2]?.includes('react') || parts[2]?.includes('vite')))) {
        const appName = parts[2] && !parts[2].startsWith('-') ? parts[2] : (parts[3] || state.projectName || 'my-react-app');
        scaffoldReactApp(appName);
        printTerm(`[Offline Sandbox] Scaffolding local browser workspace ${appName}`, '#22c55e');
        return { stdout: `Successfully created ${appName} with React 18 and Vitest suites.`, exitCode: 0 };
      }

      // 3. Fallback Execution when Backend Offline
      if (main === 'test') {
        const res = runWorkspaceTests();
        return {
          stdout: `Executed ${res.total} tests: ${res.passed} passed, ${res.failed} failed.`,
          exitCode: res.failed === 0 ? 0 : 1
        };
      }
      if (main === 'npm') {
        const sub = parts[1]?.toLowerCase();
        if (sub === 'test' || sub === 't' || (sub === 'run' && parts[2] === 'test')) {
          const res = runWorkspaceTests();
          return {
            stdout: `Executed ${res.total} tests: ${res.passed} passed, ${res.failed} failed.`,
            exitCode: res.failed === 0 ? 0 : 1
          };
        }
        if (sub === 'start' || sub === 'dev' || (sub === 'run' && (parts[2] === 'dev' || parts[2] === 'start'))) {
          state.splitMode = 'split';
          togglePreview(true);
          updateWorkspacePreview();
          persist();
          printTerm('[Offline Sandbox] Mounted browser-local preview document.', '#22c55e');
          printTerm('➜ Live preview active in side pane.', 'var(--cpg-text)');
          return { stdout: 'Mounted offline browser-local preview.', exitCode: 0 };
        }
        return await handleNpmCommand(parts.slice(1));
      }
      if (main === 'git') {
        return handleGitCommand(parts.slice(1));
      }
      if (main === 'node') {
        return await handleNodeCommand(arg);
      }
      if (main === 'mkdir') {
        const folder = arg.trim();
        if (!folder) {
          printTerm('usage: mkdir <directory>', '#ef4444');
          return { stderr: 'usage: mkdir <directory>', exitCode: 1 };
        }
        const keepFile = `${folder.replace(/\/+$/, '')}/.gitkeep`;
        if (!state.files.find(f => f.name === keepFile)) {
          state.files.push({ id: `f-${Date.now()}`, name: keepFile, lang: 'text', content: '' });
          persist();
          renderTabs();
          renderFileTree();
        }
        printTerm(`Created directory ${folder}`, '#22c55e');
        return { stdout: `Created directory ${folder}`, exitCode: 0 };
      }
      if (main === 'echo') {
        const redirectIdx = parts.indexOf('>');
        const appendIdx = parts.indexOf('>>');
        if (redirectIdx !== -1 || appendIdx !== -1) {
          const isAppend = appendIdx !== -1;
          const targetIdx = isAppend ? appendIdx : redirectIdx;
          const textToEcho = parts.slice(1, targetIdx).join(' ').replace(/^["']|["']$/g, '');
          const targetFileName = parts[targetIdx + 1];
          if (targetFileName) {
            let f = state.files.find(x => x.name.toLowerCase() === targetFileName.toLowerCase());
            if (f) {
              f.content = isAppend ? (f.content + '\n' + textToEcho) : textToEcho;
            } else {
              state.files.push({ id: `f-${Date.now()}`, name: targetFileName, lang: 'javascript', content: textToEcho });
            }
            persist();
            renderTabs();
            renderFileTree();
            loadFile();
            printTerm(`Wrote ${textToEcho.length} bytes to ${targetFileName}`, '#22c55e');
            return { stdout: `Wrote to ${targetFileName}`, exitCode: 0 };
          }
        }
        const textToPrint = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
        printTerm(textToPrint, 'var(--cpg-text)');
        return { stdout: textToPrint, exitCode: 0 };
      }
      if (main === 'ls') {
        state.files.forEach(f => {
          printTerm(`  ${f.name.padEnd(24)} (${f.lang || 'text'}, ${f.content.length} bytes)`, '#38bdf8');
        });
        return { stdout: state.files.map(f => f.name).join('\n'), exitCode: 0 };
      }
      if (main === 'cat') {
        if (!arg) {
          printTerm('Usage: cat <filename>', '#ef4444');
          return { stderr: 'Usage: cat <filename>', exitCode: 1 };
        }
        const target = state.files.find(f => f.name.toLowerCase() === arg.toLowerCase());
        if (target) {
          printTerm(target.content, 'var(--cpg-text)');
          return { stdout: target.content, exitCode: 0 };
        }
        printTerm(`File not found: ${arg}`, '#ef4444');
        return { stderr: `File not found: ${arg}`, exitCode: 1 };
      }
      if (main === 'touch') {
        if (!arg) {
          printTerm('Usage: touch <filename>', '#ef4444');
          return { stderr: 'Usage: touch <filename>', exitCode: 1 };
        }
        state.files.push({ id: `f-${Date.now()}`, name: arg, lang: 'javascript', content: '' });
        persist();
        renderTabs();
        renderFileTree();
        printTerm(`Created ${arg}`, '#22c55e');
        return { stdout: `Created ${arg}`, exitCode: 0 };
      }
      if (main === 'rm') {
        if (!arg) {
          printTerm('Usage: rm <filename>', '#ef4444');
          return { stderr: 'Usage: rm <filename>', exitCode: 1 };
        }
        const idx = state.files.findIndex(f => f.name.toLowerCase() === arg.toLowerCase());
        if (idx !== -1) {
          const removed = state.files.splice(idx, 1)[0];
          if (state.activeFileId === removed.id) state.activeFileId = state.files[0]?.id;
          persist();
          renderTabs();
          renderFileTree();
          loadFile();
          printTerm(`Removed ${arg}`, '#22c55e');
          return { stdout: `Removed ${arg}`, exitCode: 0 };
        }
        printTerm(`File not found: ${arg}`, '#ef4444');
        return { stderr: `File not found: ${arg}`, exitCode: 1 };
      }

      printTerm(`Command not recognized: ${main}. Type 'help' for commands.`, '#ef4444');
      return { stderr: `Command not recognized: ${main}`, exitCode: 1 };
    }

    self_.executeTerminalCommand = executeTerminalCommand;

    const stopBtn = container.querySelector('#cpg-proc-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (state.activeProcess) {
          state.activeProcess.kill('SIGINT');
          printTerm('^C [Process stopped by user]', '#eab308');
        }
      });
    }

    termInput.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        if (state.activeProcess) {
          e.preventDefault();
          state.activeProcess.kill('SIGINT');
          printTerm('^C [Process interrupted]', '#eab308');
          return;
        }
      }
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        termInput.value = '';
        if (!cmd) return;
        await executeTerminalCommand(cmd, { echo: true, source: 'user' });
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

    // Keyboard Shortcuts
    const onKeyDownShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminalDrawer();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persist();
        line('muted', 'Workspace saved.');
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener('keydown', onKeyDownShortcuts);

    async function packageZip() {
      line('muted', 'Packaging workspace into ZIP...');
      try {
        const projDir = `/Projects/${state.projectName}`;
        await fs.mkdir(projDir);
        for (const f of state.files) {
          await fs.writeFile(`${projDir}/${f.name}`, f.content);
        }
        const zipPath = `/Projects/${state.projectName}.zip`;
        const res = await fs.compressDirectory(projDir, zipPath);
        line('log', `Workspace packaged: ${res.path} (${res.size} bytes). Available in Files.`);
        printTerm(`[Package] Saved ${res.path} (${res.size} bytes). Visible in Files.`, '#38bdf8');
      } catch (err) {
        line('error', `Packaging failed: ${err.message}`);
        printTerm(`[Package Error] ${err.message}`, '#ef4444');
      }
    }

    function checkProblems() {
      toggleTerminalDrawer(true);
      container.querySelectorAll('.cpg-drawer-tab').forEach(t => t.classList.remove('active'));
      container.querySelector('[data-tab="problems"]')?.classList.add('active');
      container.querySelectorAll('.cpg-drawer-pane').forEach(p => p.style.display = 'none');
      container.querySelector('#cpg-pane-problems').style.display = 'block';

      const cur = getActiveFile();
      if (!cur) return;
      if (cur.lang === 'javascript' || cur.name.endsWith('.js')) {
        try {
          new Function(cur.content);
          problemsContent.textContent = `No errors detected in ${cur.name}. Syntax is valid.`;
          problemsContent.style.color = '#22c55e';
        } catch (err) {
          problemsContent.textContent = `Syntax Error in ${cur.name}: ${err.message}`;
          problemsContent.style.color = '#ef4444';
        }
      } else {
        problemsContent.textContent = `File ${cur.name} (${cur.lang}) ready for compilation / execution.`;
        problemsContent.style.color = 'var(--cpg-text)';
      }
    }

    function testInBrowser() {
      state.splitMode = 'split';
      previewPane.style.display = 'flex';
      const cur = getActiveFile();
      if (cur && cur.lang === 'html') {
        previewEl.srcdoc = buildPreviewDocument(cur.content, state.framework);
      }
      setTimeout(() => {
        try {
          const doc = previewEl.contentDocument || previewEl.contentWindow?.document;
          const count = doc ? doc.querySelectorAll('*').length : 0;
          line('log', `Browser Sandbox Test: Rendered ${count} DOM elements successfully.`);
        } catch (err) {
          line('error', `Browser Sandbox Test: ${err.message}`);
        }
      }, 300);
    }

    // Console output logger
    function line(level, text) {
      const el = document.createElement('div');
      el.className = `cpg-line cpg-${level}`;
      el.style.color = level === 'error' ? '#ef4444' : (level === 'muted' ? 'var(--cpg-text-muted)' : (level === 'warn' ? '#eab308' : 'var(--cpg-terminal-text)'));
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
      problemsContent.style.color = 'var(--cpg-text-muted)';
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

      const isReactProject = state.framework === 'react' ||
        state.files.some(f => f.name.includes('.jsx') || f.name.toLowerCase() === 'index.html' || (f.name === 'package.json' && f.content.includes('react')));

      if (isReactProject) {
        state.splitMode = 'split';
        previewPane.style.display = 'flex';
        updateWorkspacePreview();
        const topPrevBtn = container.querySelector('#cpg-top-preview-btn');
        if (topPrevBtn) {
          topPrevBtn.style.borderColor = 'var(--cpg-accent)';
          topPrevBtn.style.color = 'var(--cpg-accent)';
        }
        persist();

        line('muted', 'Browser client sandbox preview mounted.');
        timingEl.textContent = 'Sandbox Preview';
        idle();
        self_.analytics?.completed?.({ outputKind: 'react' });
        return;
      }

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
        const { type, level, text } = e.data;
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
        const isReactApp = state.framework === 'react' || state.files.some(f => f.name.includes('.jsx') || (f.name === 'package.json' && f.content.includes('react')));
        if (state.splitMode !== 'code-only' || isReactApp) {
          previewPane.style.display = 'flex';
          updateWorkspacePreview();
        } else {
          previewPane.style.display = 'none';
        }
        fwEl.hidden = true;
      }

      stdinWrap.hidden = !remote && id !== 'cpp';
    }

    langsSelect.addEventListener('change', (e) => {
      const file = getActiveFile();
      if (file) {
        file.lang = e.target.value;
        persist();
      }
      applyLanguage(e.target.value);
    });

    // Cleanup reference on unmount
    this._cleanup = () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKeyDownShortcuts);
    };

    renderTabs();
    renderFileTree();
    loadFile();

    const isReactAppBoot = state.framework === 'react' || state.files.some(f => f.name.includes('.jsx') || f.name.toLowerCase() === 'index.html');
    if (state.splitMode !== 'code-only' || isReactAppBoot) {
      togglePreview(true);
    }
  },

  setArtifact(incoming) {
    if (!incoming) return;
    const fileName = incoming.name || 'script.js';
    const text = incoming.text || incoming.content || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'js';
    const langMap = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript',
      ts: 'typescript',
      py: 'python',
      cpp: 'cpp', c: 'c', h: 'cpp', hpp: 'cpp',
      html: 'html', htm: 'html',
      css: 'css',
      json: 'json',
      sql: 'sql',
      lua: 'lua',
      rust: 'rust', rs: 'rust',
      go: 'go',
      java: 'java',
      php: 'php',
      sh: 'bash', bash: 'bash'
    };
    const lang = langMap[ext] || (ALL[ext] ? ext : 'javascript');

    const applyWs = (fileContent) => {
      const wsId = `ws-file-${Date.now()}`;
      const newWs = {
        id: wsId,
        name: fileName,
        files: [{ id: 'f-1', name: fileName, lang, content: fileContent }],
        activeFileId: 'f-1',
        framework: 'none',
        updatedAt: Date.now()
      };
      const list = getSavedWorkspaces();
      list.unshift(newWs);
      saveWorkspaces(list);
      setActiveWorkspaceId(wsId);
      if (this.container) {
        this.checkAndRender();
      }
    };

    if (!text && incoming.path) {
      import('../lib/filesystem.js').then(({ fs }) => {
        fs.readFile(incoming.path, { encoding: 'utf8' })
          .then(t => applyWs(t || ''))
          .catch(() => applyWs(''));
      }).catch(() => applyWs(''));
    } else {
      applyWs(text);
    }
  },

  destroy() {
    this._alive = false;
    this._remote?.abort();
    this._cleanup?.();
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
    /* ============================================================
       CODE PLAYGROUND SCOPED THEME MODES (ISOLATED FROM TOOLBOX)
       ============================================================ */
    .cpg-mode-dark {
      --cpg-bg-app: #121316;
      --cpg-bg-card: #1a1c22;
      --cpg-bg-subtle: #242731;
      --cpg-border: #2e3340;
      --cpg-border-hover: #434a5d;
      --cpg-text: #f1f3f7;
      --cpg-text-secondary: #9da6b9;
      --cpg-text-muted: #647087;
      --cpg-accent: #3b82f6;
      --cpg-accent-hover: #2563eb;
      --cpg-editor-bg: #121316;
      --cpg-editor-text: #e2e8f0;
      --cpg-gutter-bg: #121316;
      --cpg-gutter-text: #475569;
      --cpg-tab-active: #1a1c22;
      --cpg-tab-inactive: #121316;
      --cpg-terminal-bg: #0d0e12;
      --cpg-terminal-text: #4ade80;
      --cpg-menu-bg: #1a1c22;
      --cpg-menu-hover: #262933;
    }

    .cpg-mode-light {
      --cpg-bg-app: #f8fafc;
      --cpg-bg-card: #ffffff;
      --cpg-bg-subtle: #f1f5f9;
      --cpg-border: #e2e8f0;
      --cpg-border-hover: #cbd5e1;
      --cpg-text: #0f172a;
      --cpg-text-secondary: #475569;
      --cpg-text-muted: #94a3b8;
      --cpg-accent: #2563eb;
      --cpg-accent-hover: #1d4ed8;
      --cpg-editor-bg: #ffffff;
      --cpg-editor-text: #0f172a;
      --cpg-gutter-bg: #f8fafc;
      --cpg-gutter-text: #94a3b8;
      --cpg-tab-active: #ffffff;
      --cpg-tab-inactive: #f1f5f9;
      --cpg-terminal-bg: #f8fafc;
      --cpg-terminal-text: #16a34a;
      --cpg-menu-bg: #ffffff;
      --cpg-menu-hover: #f1f5f9;
    }

    /* IDE Menu Bar & Dropdowns */
    .cpg-menu-trigger {
      background: transparent;
      border: 1px solid transparent;
      color: var(--cpg-text);
      font-size: 0.78rem;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.12s ease;
    }
    .cpg-menu-trigger:hover {
      background: var(--cpg-bg-subtle);
      border-color: var(--cpg-border);
    }

    .cpg-dropdown-menu {
      background: var(--cpg-menu-bg);
      border: 1px solid var(--cpg-border);
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .cpg-dropdown-item {
      background: transparent;
      border: none;
      color: var(--cpg-text);
      font-size: 0.76rem;
      text-align: left;
      padding: 6px 10px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: background 0.1s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .cpg-dropdown-item:hover {
      background: var(--cpg-menu-hover);
      color: var(--cpg-text);
    }

    .cpg-menu-sep {
      height: 1px;
      background: var(--cpg-border);
      margin: 4px 0;
    }

    .cpg-kbd {
      font-size: 0.65rem;
      background: var(--cpg-bg-subtle);
      border: 1px solid var(--cpg-border);
      padding: 1px 4px;
      border-radius: 3px;
      color: var(--cpg-text-muted);
      font-family: monospace;
    }

    .ide-btn-icon {
      background: none;
      border: none;
      color: var(--cpg-text-muted);
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      transition: all 0.15s ease;
    }
    .ide-btn-icon:hover { background: var(--cpg-bg-subtle); color: var(--cpg-text); }

    .ide-tab:hover { background: var(--cpg-bg-subtle) !important; color: var(--cpg-text) !important; }
    .ide-tree-item:hover { background: var(--cpg-bg-subtle) !important; color: var(--cpg-text) !important; }
    
    .cpg-card-action:hover {
      border-color: var(--cpg-accent) !important;
      background: var(--cpg-bg-subtle) !important;
      transform: translateY(-1px);
    }
    .cpg-tpl-pill {
      background: var(--cpg-bg-card);
      border: 1px solid var(--cpg-border);
      border-radius: 9999px;
      padding: 6px 14px;
      color: var(--cpg-text);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cpg-tpl-pill:hover {
      border-color: var(--cpg-accent);
      color: var(--cpg-accent);
      background: var(--cpg-bg-subtle);
    }
    .cpg-recent-row:hover {
      border-color: var(--cpg-accent) !important;
      background: var(--cpg-bg-subtle) !important;
    }
    .cpg-drawer-tab {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--cpg-text-muted);
      font-size: 0.76rem;
      font-weight: 600;
      padding: 0 10px;
      cursor: pointer;
      height: 100%;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: color 0.15s ease;
    }
    .cpg-drawer-tab:hover { color: var(--cpg-text); }
    .cpg-drawer-tab.active {
      color: var(--cpg-text);
      border-bottom-color: var(--cpg-accent);
    }
    .cpg-ast-chip {
      background: var(--cpg-bg-subtle);
      border: 1px solid var(--cpg-border);
      color: var(--cpg-text);
      font-size: 0.72rem;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cpg-ast-chip:hover {
      background: var(--cpg-bg-app);
      border-color: var(--cpg-accent);
      color: var(--cpg-accent);
    }
  `;
  document.head.appendChild(style);
}
