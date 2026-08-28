/* ============================================================
   TOOLBOX — app shell.

   This file routes, renders and instruments. It holds no tool metadata:
   that all lives in js/registry/, and search ranking lives in
   js/lib/search.js, so adding a tool never means editing the shell.
   ============================================================ */

import { TOOLS, CATEGORY_LABELS, OFFLINE_TOOLS, categorised, byTask, popular, resolveId, BY_ID } from './registry/index.js';
import { search, relatedTools } from './lib/search.js';
import { track, toolSession } from './lib/analytics.js';
import * as artifacts from './lib/artifacts.js';
import { mountArtifactStrip, incomingBanner } from './lib/artifact-ui.js';
import { installPalette, openPalette } from './lib/palette.js';
import { renderSaved } from './views/saved.js';
import { renderSpaces } from './views/spaces.js';
import { kindLabel } from './registry/kinds.js';
import { copyText } from './utils.js';
import { initTheme } from './lib/theme.js';
import { installSettingsUI } from './lib/settings-ui.js';
import { installHeaderMenu } from './lib/header-menu.js';

/* --------------- state --------------- */

let currentToolId = null;
let currentToolInstance = null;
let currentToolObj = null;
let currentSession = null;
let currentPage = 'home';
/** Teardown for whatever the artifact layer mounted around the open tool. */
let unmountArtifacts = null;
/** Teardown for the saved-work view. */
let unmountSaved = null;
/** Teardown for the spaces view. */
let unmountSpaces = null;

/* --------------- DOM --------------- */

const $ = (id) => document.getElementById(id);

const homeView = $('home-view');
const toolsView = $('tools-view');
const viewport = $('tool-viewport');
const supportView = $('support-view');
const viewportTitle = $('viewport-title');
const viewportDesc = $('viewport-desc');
let viewportContent = $('viewport-content');
const relatedBar = $('tool-related');
const backBtn = $('back-btn');
const searchInput = $('search');
const searchWrapper = $('search-wrapper');
const logo = $('logo');
const grid = $('tool-grid');
const navLinks = document.querySelectorAll('.nav-link');

const savedView = $('saved-view');
const navSaved = $('nav-saved');
const spacesView = $('spaces-view');

const VIEWS = { home: homeView, tools: toolsView, support: supportView, saved: savedView, spaces: spacesView, tool: viewport };

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
      ${tool.badge ? `<span class="tool-card-badge">${escapeHtml(tool.badge)}</span>` : ''}
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
  unmountArtifacts?.();
  unmountArtifacts = null;
  unmountSaved?.();
  unmountSaved = null;
  unmountSpaces?.();
  unmountSpaces = null;
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
  // Name and description both come from the registry, so a tool can
  // never describe itself differently here than on its card.
  if (viewportDesc) viewportDesc.textContent = tool.description;

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

  // Anything another tool (or the saved list) handed over, collected once.
  const incoming = artifacts.takeHandoff();

  try {
    const loader = toolModules[`./tools/${id}.js`];
    if (!loader) throw new Error(`No module for "${id}"`);
    const module = await loader();
    // Guard against a fast back-navigation resolving into a dead viewport.
    if (currentToolId !== id) return;
    currentToolInstance = module.default;
    await currentToolInstance.render(viewportContent, { analytics: session, tool, artifact: incoming });
    if (currentToolId !== id) return;

    /* The artifact layer wraps the tool rather than living inside it: a tool
       that declares neither hook gets nothing, sees nothing, and is
       completely unaffected by any of this. */
    if (incoming && typeof currentToolInstance.setArtifact === 'function') {
      try {
        currentToolInstance.setArtifact(incoming);
        viewportContent.prepend(incomingBanner(incoming, BY_ID.get(incoming.from)));
      } catch (err) {
        console.error('tool could not accept the artifact', err);
      }
    }
    unmountArtifacts = mountArtifactStrip(viewportContent, {
      tool, instance: currentToolInstance, incoming,
    });

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

  // #saved, or #saved/<artifact id> to land on one directly.
  if (raw === 'saved' || raw.startsWith('saved/')) {
    showPage('saved');
    unmountSaved = renderSaved(savedView, raw.slice(6) || null);
    return;
  }

  // #spaces, or #spaces/<code> to join via a shared link.
  if (raw === 'spaces' || raw.startsWith('spaces/')) {
    showPage('spaces');
    unmountSpaces = renderSpaces(spacesView, raw.slice(7) || null);
    return;
  }

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
  'law': ['Paste or upload legal judgments, contracts or statutes — everything stays private on your device.', 'Export structured briefs, digests, or Bates-numbered PDF bundles.'],
  'design': ['Adjust the inputs and the preview updates live.'],
  'security': ['Generated secrets never leave your browser and are never logged.'],
  'networking': ['Enter the IP, domain or URL to look up.', 'These tools query a public service, so they need a connection.'],
  'modeling': ['Drag to rotate, scroll to zoom.', 'Use the left panel to show or hide parts, then click one to read about it.'],
  'everyday': ['Enter a place or value to get started.'],
};

const PAGE_TIPS = {
  home: [
    'Press <kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd> anywhere to search every tool and anything you have saved.',
    'Describe the job rather than the tool — “compress photo”, “format json”.',
  ],
  tools: [
    'Search by <em>what you want to do</em>, not the tool name — “compress photo”, “png to webp”, “format json” all work.',
    'Typos are fine.',
    'Press <kbd>/</kbd> to search from anywhere.',
  ],
  saved: [
    'Everything here lives in this browser only. <strong>Export</strong> anything you would be sorry to lose.',
    '<strong>Open in</strong> hands a file straight to another tool that can take it.',
    '<strong>Export all</strong> writes one file you can import again later, or on another machine.',
  ],
  support: ['Found a bug? Use <strong>Complain about a tool</strong>.', 'Want something built? Use <strong>Ask for a tool</strong>.'],
  spaces: ['No account needed — just a display name.', 'Share the room code or link to invite others.', 'Everything stays between participants — nothing is stored.'],
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

/* `/` and ⌘K both open the palette, which is the one way in from anywhere.
   The Tools page keeps its own filter box: that one narrows a grid you are
   already looking at, which is a different job from going somewhere. */
installPalette();

document.addEventListener('keydown', (e) => {
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

$('home-search')?.addEventListener('click', () => openPalette());

/* Surprise Me. Toggles the reveal and keeps aria-expanded honest, so a
   screen reader is told the panel exists rather than left guessing. */
const surpriseBtn = $('surprise-btn');
if (surpriseBtn) {
  const reveal = $('surprise-reveal');
  const label = surpriseBtn.querySelector('.surprise-label');

  surpriseBtn.addEventListener('click', () => {
    const open = reveal.hidden;
    reveal.hidden = !open;
    surpriseBtn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Much appreciated 🖤' : 'Surprise Me';
    surpriseBtn.setAttribute('aria-label', open
      ? 'Hide the details for tipping the creator'
      : 'Surprise me — show details for tipping the creator');
    if (open) reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('surprise-copy')?.addEventListener('click', (e) => {
    copyText($('surprise-number').textContent.trim(), e.currentTarget);
  });
}

const tipsFab = $('tips-fab');
if (tipsFab) {
  tipsFab.addEventListener('click', showTips);
  $('close-tips').addEventListener('click', hideTips);
  $('tips-modal').addEventListener('click', (e) => { if (e.target === $('tips-modal')) hideTips(); });
}

/* Mailto link reliability on desktop & mobile */
document.addEventListener('click', (e) => {
  const mailAnchor = e.target.closest('a[href^="mailto:"]');
  if (mailAnchor) {
    mailAnchor.setAttribute('target', '_top');
  }
});

/* --------------- init --------------- */

// Both the hero eyebrow and the feature tile count come from the registry,
// so the number on the page can never drift from the number of tools.
for (const id of ['home-tool-count', 'home-eyebrow-count']) {
  const el = $(id);
  if (el) el.textContent = `${TOOLS.length}`;
}

// The privacy claim is counted, not asserted: mark one more tool `offline:
// false` and the sentence on the home page corrects itself.
const onlineCount = $('home-online-count');
if (onlineCount) onlineCount.textContent = `${TOOLS.length - OFFLINE_TOOLS.length}`;

const quickRow = $('home-quick');
if (quickRow) {
  quickRow.innerHTML = popular(6).map(t => `
    <a class="home-quick-item" href="#${t.id}">
      <span class="home-quick-icon">${t.icon}</span>
      <span>${escapeHtml(t.name)}</span>
    </a>`).join('');
}

/* The task lens. Categories answer "what subject is this?"; the home page
   has to answer "what am I trying to do?", which is a different question
   and the only one a first-time visitor is actually asking. */
const taskGrid = $('home-tasks');
if (taskGrid) {
  taskGrid.innerHTML = byTask(TOOLS).map(task => `
    <section class="home-task">
      <h2 class="home-task-label">${escapeHtml(task.label)}</h2>
      <p class="home-task-blurb">${escapeHtml(task.blurb)}</p>
      <div class="home-task-tools">
        ${task.tools.slice(0, 6).map(t => `
          <a class="home-task-tool" href="#${t.id}">
            <span class="home-task-icon">${t.icon}</span>
            <span>${escapeHtml(t.name)}</span>
          </a>`).join('')}
      </div>
      <a class="home-task-more" href="#tools">All ${task.tools.length} →</a>
    </section>`).join('');
}

/* Saved work is surfaced only once it exists. Until then the home page and
   the navigation carry no trace of it, which is the whole point: the
   product must not look like a workspace to somebody who does not want one. */
function reflectSavedWork() {
  const items = artifacts.list();
  if (navSaved) navSaved.hidden = items.length === 0;

  const strip = $('home-saved');
  if (!strip) return;
  strip.hidden = items.length === 0;
  if (!items.length) return;

  strip.innerHTML = `
    <div class="home-saved-head">
      <h2 class="home-task-label">Your saved work</h2>
      <a class="home-task-more" href="#saved">Open all ${items.length} →</a>
    </div>
    <div class="home-task-tools">
      ${items.slice(0, 5).map(m => `
        <a class="home-task-tool" href="#saved/${m.id}">
          <span>${escapeHtml(m.name)}</span>
          <em>${escapeHtml(kindLabel(m.kind))}</em>
        </a>`).join('')}
    </div>`;
}

artifacts.onChange(reflectSavedWork);
reflectSavedWork();

initTheme();
installSettingsUI();
installHeaderMenu();

renderGrid(TOOLS);
handleHash();
