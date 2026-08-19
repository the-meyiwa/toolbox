/* ============================================================
   TOOLBOX — app shell.

   This file routes, renders and instruments. It holds no tool metadata:
   that all lives in js/registry/, and search ranking lives in
   js/lib/search.js, so adding a tool never means editing the shell.
   ============================================================ */

import { TOOLS, CATEGORIES, CATEGORY_LABELS, categorised, popular, resolveId, BY_ID } from './registry/index.js';
import { search, relatedTools } from './lib/search.js';
import { track, toolSession } from './lib/analytics.js';

/* --------------- state --------------- */

let currentToolId = null;
let currentToolInstance = null;
let currentToolObj = null;
let currentSession = null;
let currentPage = 'home';

/* --------------- DOM --------------- */

const $ = (id) => document.getElementById(id);

const homeView = $('home-view');
const toolsView = $('tools-view');
const viewport = $('tool-viewport');
const supportView = $('support-view');
const viewportTitle = $('viewport-title');
let viewportContent = $('viewport-content');
const relatedBar = $('tool-related');
const backBtn = $('back-btn');
const searchInput = $('search');
const searchWrapper = $('search-wrapper');
const logo = $('logo');
const grid = $('tool-grid');
const navLinks = document.querySelectorAll('.nav-link');

const VIEWS = { home: homeView, tools: toolsView, support: supportView, tool: viewport };

const toolModules = import.meta.glob('./tools/*.js');

/* --------------- helpers --------------- */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toolCard(tool, { compact = false } = {}) {
  return `
    <a class="tool-card${compact ? ' tool-card-sm' : ''}" href="#${tool.id}" id="card-${tool.id}">
      <div class="tool-card-icon">${tool.icon}</div>
      <div class="tool-card-info">
        <div class="tool-card-name">${escapeHtml(tool.name)}</div>
        <div class="tool-card-desc">${escapeHtml(tool.description)}</div>
      </div>
      ${tool.offline === false ? '<span class="tool-card-flag" title="Needs an internet connection">online</span>' : ''}
    </a>`;
}

/* --------------- rendering --------------- */

function renderGrid(list, { query = '', noResult = false } = {}) {
  grid.innerHTML = '';

  // A weak best match is still a miss. Showing one barely-related card with
  // no explanation is worse than saying plainly that nothing fits, so the
  // prompt appears whenever the engine reports no useful result — and any
  // near-misses are demoted to "closest matches" rather than passed off
  // as answers.
  if (query && noResult) {
    grid.innerHTML = `
      <div class="no-results">
        <p class="no-results-title">No tool for “${escapeHtml(query)}” yet</p>
        <p class="no-results-text">Try describing the job — “compress photo”, “png to webp”, “format json”.</p>
        <a class="btn btn-secondary btn-sm" href="mailto:meyigbenee@icloud.com?subject=${encodeURIComponent('Toolbox: no tool for "' + query + '"')}">Ask for this tool</a>
      </div>
      ${list.length ? `
        <section class="grid-category fade-in">
          <h2 class="category-label">Closest matches</h2>
          <div class="category-tools">${list.slice(0, 6).map(t => toolCard(t)).join('')}</div>
        </section>` : ''}`;
    return;
  }

  // A search result is a ranked list; browsing is grouped by category.
  if (query) {
    grid.innerHTML = `
      <section class="grid-category fade-in">
        <h2 class="category-label">${list.length} result${list.length === 1 ? '' : 's'}</h2>
        <div class="category-tools">${list.map(t => toolCard(t)).join('')}</div>
      </section>`;
    return;
  }

  const sections = [
    `<section class="grid-category fade-in">
       <h2 class="category-label">Popular</h2>
       <p class="category-blurb">What people open most.</p>
       <div class="category-tools">${popular(8).map(t => toolCard(t)).join('')}</div>
     </section>`,
    ...categorised(list).map(c => `
      <section class="grid-category fade-in">
        <h2 class="category-label">${escapeHtml(c.label)}</h2>
        <p class="category-blurb">${escapeHtml(c.blurb)}</p>
        <div class="category-tools">${c.tools.map(t => toolCard(t)).join('')}</div>
      </section>`),
  ];
  grid.innerHTML = sections.join('');
}

function renderRelated(tool) {
  if (!relatedBar) return;
  const rel = relatedTools(tool, TOOLS, 4);
  if (!rel.length) { relatedBar.innerHTML = ''; relatedBar.hidden = true; return; }
  relatedBar.hidden = false;
  relatedBar.innerHTML = `
    <h3 class="related-h">Related tools</h3>
    <div class="related-list">${rel.map(t => toolCard(t, { compact: true })).join('')}</div>`;
}

/* --------------- routing --------------- */

function showPage(page) {
  teardownTool();

  for (const v of Object.values(VIEWS)) {
    if (!v) continue;
    v.classList.add('hidden');
    v.classList.remove('fade-in');
  }
  const view = VIEWS[page];
  if (view) {
    view.classList.remove('hidden');
    void view.offsetWidth;
    view.classList.add('fade-in');
  }

  currentPage = page;
  for (const link of navLinks) link.classList.toggle('active', link.dataset.page === page);
  searchWrapper.style.display = page === 'tools' ? '' : 'none';
}

function teardownTool() {
  currentSession?.dispose();
  currentSession = null;
  try { currentToolInstance?.destroy?.(); }
  catch (err) { console.error('tool failed to clean up', err); }
  currentToolInstance = null;
  currentToolId = null;
  currentToolObj = null;
}

async function openTool(id) {
  const tool = BY_ID.get(id);
  if (!tool) return showPage('home');

  teardownTool();

  for (const v of Object.values(VIEWS)) {
    if (!v) continue;
    v.classList.add('hidden');
    v.classList.remove('fade-in');
  }
  searchWrapper.style.display = 'none';

  viewportTitle.textContent = tool.name;

  // Swap in a fresh container rather than clearing the old one.
  // 17 tools bind input/change listeners to the container itself (biz.js
  // liveCompute does exactly that), and innerHTML = '' clears children
  // while leaving those listeners attached. They then fired on the *next*
  // tool's inputs and threw on elements that no longer existed. Replacing
  // the node drops every listener bound to it, for every tool at once.
  const freshContent = document.createElement('div');
  freshContent.id = 'viewport-content';
  viewportContent.replaceWith(freshContent);
  viewportContent = freshContent;
  if (relatedBar) relatedBar.hidden = true;
  viewport.classList.remove('hidden');
  void viewport.offsetWidth;
  viewport.classList.add('fade-in');

  for (const link of navLinks) link.classList.toggle('active', link.dataset.page === 'tools');

  currentPage = 'tool';
  currentToolObj = tool;
  currentToolId = id;

  // Give the tool its own instrumentation handle. Success is the tool's
  // to declare; the shell only records that it was opened.
  const session = toolSession(tool.id, tool.category);
  currentSession = session;
  session.viewed();

  try {
    const loader = toolModules[`./tools/${id}.js`];
    if (!loader) throw new Error(`No module for "${id}"`);
    const module = await loader();
    // Guard against a fast back-navigation resolving into a dead viewport.
    if (currentToolId !== id) return;
    currentToolInstance = module.default;
    await currentToolInstance.render(viewportContent, { analytics: session, tool });
    renderRelated(tool);
  } catch (err) {
    console.error(err);
    session.error('load_failed');
    viewportContent.innerHTML = `
      <div class="no-results">
        <p class="no-results-title">This tool failed to load</p>
        <p class="no-results-text">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function handleHash() {
  const raw = decodeURIComponent(window.location.hash.slice(1) || 'home');

  if (raw === '' || raw === 'home') return showPage('home');
  if (raw === 'tools') { showPage('tools'); return; }
  if (raw === 'support') return showPage('support');

  const { id, redirected } = resolveId(raw);
  if (!id) return showPage('home');
  if (redirected) {
    // Replace so a retired link does not linger in history.
    window.location.replace(`#${id}`);
    return;
  }
  openTool(id);
}

/* --------------- search --------------- */

let searchTimer = null;
let lastLoggedQuery = '';

function runSearch() {
  const q = searchInput.value.trim();
  if (!q) { renderGrid(TOOLS); return; }

  const { results, noResult } = search(q, TOOLS, { labels: CATEGORY_LABELS });
  renderGrid(results.map(r => r.tool), { query: q, noResult });

  // Debounced so a single search is logged, not every keystroke.
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (q === lastLoggedQuery || q.length < 2) return;
    lastLoggedQuery = q;
    track('search_performed', { query: q, queryLength: q.length, resultCount: results.length, resultTop: results[0]?.tool.id });
    // The queries nobody can serve are the roadmap.
    if (noResult) track('search_no_result', { query: q, queryLength: q.length });
  }, 700);
}

/* --------------- tips --------------- */

const CATEGORY_TIPS = {
  'images-files': ['Files are processed on your device — nothing is uploaded.', 'Drag a file straight onto the drop zone, or paste from the clipboard.'],
  'text': ['Type or paste into the main box.', 'Results update as you type; the copy button takes the lot.'],
  'developer': ['Paste your code or data into the input.', 'Output updates live, and everything runs locally.'],
  'numbers': ['Enter a value and the conversions appear immediately.'],
  'business': ['Fill in what you know — results recalculate as you type.', 'Figures stay on your device.'],
  'design': ['Adjust the inputs and the preview updates live.'],
  'security': ['Generated secrets never leave your browser and are never logged.'],
  'networking': ['Enter the IP, domain or URL to look up.', 'These tools query a public service, so they need a connection.'],
  'modeling': ['Drag to rotate, scroll to zoom.', 'Use the left panel to show or hide parts, then click one to read about it.'],
  'everyday': ['Enter a place or value to get started.'],
};

const PAGE_TIPS = {
  home: ['Welcome to Toolbox.', 'Hit <strong>Browse Tools</strong>, or press <kbd>/</kbd> anywhere to search.'],
  tools: [
    'Search by <em>what you want to do</em>, not the tool name — “compress photo”, “png to webp”, “format json” all work.',
    'Typos are fine.',
    'Press <kbd>/</kbd> to jump to search.',
  ],
  support: ['Found a bug? Use <strong>Complain about a tool</strong>.', 'Want something built? Use <strong>Ask for a tool</strong>.'],
};

function showTips() {
  const tipsModal = $('tips-modal');
  const tipsContent = $('tips-content');
  const modalInner = tipsModal.querySelector('div');
  tipsContent.innerHTML = '';

  const tips = currentPage === 'tool' && currentToolObj
    ? [`<strong>${escapeHtml(currentToolObj.name)}</strong> — ${escapeHtml(currentToolObj.description)}.`,
       ...(CATEGORY_TIPS[currentToolObj.category] ?? ['Everything runs in your browser.'])]
    : (PAGE_TIPS[currentPage] ?? PAGE_TIPS.tools);

  for (const tip of tips) {
    const li = document.createElement('li');
    li.innerHTML = tip;
    tipsContent.appendChild(li);
  }

  tipsModal.style.display = 'flex';
  requestAnimationFrame(() => {
    tipsModal.style.opacity = '1';
    modalInner.style.transform = 'translateY(0)';
  });
}

function hideTips() {
  const tipsModal = $('tips-modal');
  const modalInner = tipsModal.querySelector('div');
  tipsModal.style.opacity = '0';
  modalInner.style.transform = 'translateY(20px)';
  setTimeout(() => { tipsModal.style.display = 'none'; }, 200);
}

/* --------------- bindings --------------- */

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
    e.preventDefault();
    if (currentPage !== 'tools') window.location.hash = '#tools';
    setTimeout(() => searchInput.focus(), 60);
  }
  if (e.key === 'Escape') {
    if (document.activeElement === searchInput) {
      searchInput.blur();
      if (searchInput.value) { searchInput.value = ''; runSearch(); }
    } else if (currentPage === 'tool') {
      window.location.hash = '#tools';
    }
  }
});

searchInput.addEventListener('input', runSearch);
grid.addEventListener('click', (e) => {
  const card = e.target.closest('.tool-card');
  if (card && searchInput.value.trim()) {
    track('search_selected', { query: searchInput.value.trim(), resultTop: card.id.replace(/^card-/, '') });
  }
});
backBtn.addEventListener('click', () => { window.location.hash = '#tools'; });
logo.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#home'; });
window.addEventListener('hashchange', handleHash);
window.addEventListener('pagehide', () => currentSession?.dispose());

const tipsFab = $('tips-fab');
if (tipsFab) {
  tipsFab.addEventListener('click', showTips);
  $('close-tips').addEventListener('click', hideTips);
  $('tips-modal').addEventListener('click', (e) => { if (e.target === $('tips-modal')) hideTips(); });
}

/* --------------- init --------------- */

// Both the hero eyebrow and the feature tile count come from the registry,
// so the number on the page can never drift from the number of tools.
for (const id of ['home-tool-count', 'home-eyebrow-count']) {
  const el = $(id);
  if (el) el.textContent = `${TOOLS.length}`;
}

const quickRow = $('home-quick');
if (quickRow) {
  quickRow.innerHTML = popular(6).map(t => `
    <a class="home-quick-item" href="#${t.id}">
      <span class="home-quick-icon">${t.icon}</span>
      <span>${escapeHtml(t.name)}</span>
    </a>`).join('');
}

renderGrid(TOOLS);
handleHash();
