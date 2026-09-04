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
import { installPalette, openPalette, detectAiIntent } from './lib/palette.js';
import { renderSaved } from './views/saved.js';
import { renderSpaces } from './views/spaces.js';
import { copyText, showToast } from './utils.js';
import { initTheme } from './lib/theme.js';
import { installSettingsUI } from './lib/settings-ui.js';
import { installHeaderMenu } from './lib/header-menu.js';
import { getCurrentUser, validateSession, parseAuthRedirect } from './lib/supabase.js';
import { openAccountModal } from './views/account-modal.js';
import { initFlutterwaveContribution } from './lib/flutterwave-contribution.js';

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
const popoutBtn = $('popout-btn');
const searchInput = $('search');
const searchWrapper = $('search-wrapper');
const logo = $('logo');
const grid = $('tool-grid');
const navLinks = document.querySelectorAll('.nav-link');

const savedView = $('saved-view');
const navSaved = $('nav-saved');
const spacesView = $('spaces-view');

const VIEWS = { home: homeView, tools: toolsView, about: supportView, support: supportView, saved: savedView, files: savedView, spaces: spacesView, tool: viewport };

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

function renderGrid(originalList, { query = '', noResult = false } = {}) {
  const user = getCurrentUser();
  const list = originalList.filter(t => !t.hidden && (user || t.id !== 'assistant'));

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
    `<section class="grid-category fade-in" id="cat-popular">
       <h2 class="category-label">Popular</h2>
       <p class="category-blurb">What people open most.</p>
       <div class="category-tools">${popular(8).filter(t => user || t.id !== 'assistant').map(t => toolCard(t)).join('')}</div>
     </section>`,
    ...categorised(list).map(c => `
      <section class="grid-category fade-in" id="cat-${c.id}">
        <h2 class="category-label">${escapeHtml(c.label)}</h2>
        <p class="category-blurb">${escapeHtml(c.blurb)}</p>
        <div class="category-tools">${c.tools.map(t => toolCard(t)).join('')}</div>
      </section>`),
  ];
  grid.innerHTML = sections.join('');
}

export function updateMobileNavIndicator() {
  const nav = document.getElementById('mobile-nav');
  const indicator = document.getElementById('mob-nav-indicator');
  if (!nav || !indicator) return;
  const activeItem = nav.querySelector('.mob-nav-item.active');
  if (!activeItem || activeItem.offsetParent === null) {
    indicator.style.opacity = '0';
    return;
  }
  const left = activeItem.offsetLeft;
  const width = activeItem.offsetWidth;
  if (!width) return;
  indicator.style.opacity = '1';
  indicator.style.transform = `translate3d(${left}px, 0, 0)`;
  indicator.style.width = `${width}px`;
}

function installCategoryChips() {
  const chipBar = document.getElementById('category-chip-bar');
  if (!chipBar) return;
  const chips = chipBar.querySelectorAll('.category-chip');

  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      try { navigator.vibrate?.(6); } catch (err) {}
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const catId = chip.dataset.cat;
      if (catId === 'all') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetEl = document.getElementById(`cat-${catId}`);
      if (targetEl) {
        const headerOffset = 70;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

function renderRelated(tool) {
  if (!relatedBar) return;
  const user = getCurrentUser();
  const rel = relatedTools(tool, TOOLS, 4).filter(t => user || t.id !== 'assistant');
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
  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.page === page || (page === 'about' && link.dataset.page === 'support') || (page === 'support' && link.dataset.page === 'about'));
  }
  searchWrapper.style.display = page === 'tools' ? '' : 'none';
  if (page === 'about' || page === 'support') {
    initFlutterwaveContribution();
  }
  requestAnimationFrame(updateMobileNavIndicator);
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
  
  if (id === 'assistant' && !getCurrentUser()) {
    window.location.hash = '';
    showPage('home');
    openAccountModal();
    return;
  }

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
  if (popoutBtn) popoutBtn.style.display = tool.standalone ? 'inline-flex' : 'none';
  viewport.classList.remove('hidden');
  void viewport.offsetWidth;
  viewport.classList.add('fade-in');

  for (const link of navLinks) link.classList.toggle('active', link.dataset.page === 'tools');
  requestAnimationFrame(updateMobileNavIndicator);

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
  // Check for auth recovery, email confirmation, or redirect parameters
  const redirect = parseAuthRedirect();
  if (redirect) {
    if (redirect.type === 'recovery' && redirect.accessToken) {
      try {
        window.history.replaceState(null, '', window.location.pathname + '#home');
      } catch {}
      openAccountModal('set-new-password', redirect);
      showPage('home');
      return;
    }

    if ((redirect.type === 'signup' || redirect.type === 'email_change' || redirect.type === 'token') && redirect.accessToken) {
      try {
        window.history.replaceState(null, '', window.location.pathname + '#home');
      } catch {}

      const userSession = {
        id: redirect.userId || `usr_${Date.now()}`,
        email: redirect.email || 'user@toolbox.app',
        token: redirect.accessToken,
        refreshToken: redirect.refreshToken || '',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('toolbox_supabase_session', JSON.stringify(userSession));
      localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));

      const successMsg = redirect.type === 'email_change'
        ? 'Email address confirmed and updated successfully.'
        : 'Email verified successfully! Welcome to Toolbox.';
      showToast(successMsg, 'success');
      showPage('home');
      return;
    }

    if (redirect.type === 'error') {
      try {
        window.history.replaceState(null, '', window.location.pathname + '#home');
      } catch {}
      showToast(redirect.error || 'Authentication error during verification.', 'error', 5000);
      showPage('home');
      return;
    }
  }

  const raw = decodeURIComponent(window.location.hash.slice(1) || 'home');

  if (raw === '' || raw === 'home') return showPage('home');
  if (raw === 'tools') { showPage('tools'); return; }
  if (raw === 'about' || raw === 'support') return showPage('about');
  if (raw === 'set-new-password') {
    openAccountModal('set-new-password');
    return showPage('home');
  }
  if (raw === 'reset' || raw === 'reset-password') {
    openAccountModal('reset');
    return showPage('home');
  }
  if (raw === 'verify-pending') {
    openAccountModal('verify-pending');
    return showPage('home');
  }

  // #saved or #files, or #saved/<artifact id> / #files/<artifact id>
  if (raw === 'saved' || raw.startsWith('saved/') || raw === 'files' || raw.startsWith('files/')) {
    showPage('saved');
    const fileId = raw.startsWith('files/') ? raw.slice(6) : (raw.startsWith('saved/') ? raw.slice(6) : null);
    unmountSaved = renderSaved(savedView, fileId || null);
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
  const user = getCurrentUser();
  const filteredTools = user ? TOOLS : TOOLS.filter(t => t.id !== 'assistant');

  if (!q) { renderGrid(filteredTools); return; }

  const { results, noResult } = search(q, filteredTools, { labels: CATEGORY_LABELS });
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
if (popoutBtn) {
  popoutBtn.addEventListener('click', () => {
    if (!currentToolId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('standalone', 'true');
    window.open(url.toString(), '_blank');
  });
}
logo.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#home'; });
window.addEventListener('hashchange', handleHash);
window.addEventListener('pagehide', () => currentSession?.dispose());

// Central Search & AI Prompt Box on Home Page
const homeHeroInput = $('home-hero-input');
const homeHeroDropdown = $('home-hero-dropdown');
const homeHeroSubmitBtn = $('home-hero-submit-btn');

function updateSearchPlaceholder() {
  if (!homeHeroInput) return;
  const user = getCurrentUser();
  homeHeroInput.placeholder = user ? 'Search 100+ tools or prompt Assistant…' : 'Search 100+ tools…';
}

export function renderHomeAssistantBanner() {
  const bannerEl = $('home-assistant-banner');
  if (!bannerEl) return;

  const user = getCurrentUser();
  const titleText = user ? 'Assistant is Ready' : 'Sign in for a whole new experience';
  const descText = user 
    ? 'Multi-model AI layer: write code, transform files, calculate math, and execute tools.'
    : 'Unlock the multi-model AI layer to write code, transform files, calculate math, and execute tools.';
  const btnText = user ? 'Open Assistant &rarr;' : 'Sign In to Assistant &rarr;';

  bannerEl.innerHTML = `
    <div class="home-assistant-card" style="padding:20px 24px; background:var(--g100); border:1px solid var(--g300); border-radius:18px; display:flex; align-items:center; justify-content:space-between; gap:16px; box-shadow:0 6px 20px rgba(0,0,0,0.03);">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:42px; height:42px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:6px;">
            <h3 style="margin:0; font-size:1.02rem; font-weight:800; color:var(--black); letter-spacing:-0.01em;">${titleText}</h3>
          </div>
          <p style="margin:2px 0 0; font-size:0.82rem; color:var(--g600); line-height:1.4;">${descText}</p>
        </div>
      </div>
      <button type="button" class="btn btn-primary" id="btn-open-assistant" style="padding:9px 20px; font-size:0.86rem; font-weight:700; border-radius:9999px; white-space:nowrap; flex-shrink:0; cursor:pointer;">
        ${btnText}
      </button>
    </div>
  `;

  bannerEl.querySelector('#btn-open-assistant')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!getCurrentUser()) {
      openAccountModal();
      return;
    }
    window.location.hash = '#assistant';
    openTool('assistant');
  });
}

updateSearchPlaceholder();
renderHomeAssistantBanner();
window.addEventListener('toolbox:authchange', () => {
  updateSearchPlaceholder();
  const user = getCurrentUser();
  renderGrid(user ? TOOLS : TOOLS.filter(t => t.id !== 'assistant'));
  renderHomeAssistantBanner();
  if (window.location.hash === '#assistant' && user) {
    openTool('assistant');
  }
});

if (homeHeroInput && homeHeroDropdown) {
  function renderHomeHeroResults() {
    const q = homeHeroInput.value.trim();
    if (!q) {
      homeHeroDropdown.style.display = 'none';
      return;
    }

    const user = getCurrentUser();
    const availableTools = user ? TOOLS : TOOLS.filter(t => t.id !== 'assistant');
    const isAi = detectAiIntent(q);
    const searchRes = search(q, availableTools, { labels: CATEGORY_LABELS }).results.map(r => r.tool).slice(0, 6);

    let html = '';

    const aiHtml = `
      <div class="home-hero-ai-row" style="padding:10px 14px; background:var(--g100); border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; border:1px solid var(--g300);" data-ai-prompt="${escapeHtml(q)}">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:28px; height:28px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div>
            <div style="font-size:0.86rem; font-weight:700; color:var(--black);">Ask Assistant: “${escapeHtml(q)}”</div>
            <div style="font-size:0.72rem; color:var(--g600);">Let Assistant write code, analyze data, or execute tools for you</div>
          </div>
        </div>
        <kbd style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:var(--white); border:1px solid var(--g300);">Enter ↵</kbd>
      </div>
    `;

    if (isAi) {
      html += aiHtml;
    }

    if (searchRes.length) {
      html += `<div style="font-size:0.72rem; font-weight:700; color:var(--g500); padding:4px 8px; text-transform:uppercase; letter-spacing:0.04em;">Matched Tools</div>`;
      for (const t of searchRes) {
        html += `
          <a href="#${t.id}" class="home-hero-tool-row" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; text-decoration:none; color:var(--black); transition:background 0.15s;">
            <span style="font-size:1.1rem;">${t.icon}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-size:0.86rem; font-weight:600;">${escapeHtml(t.name)}</div>
              <div style="font-size:0.72rem; color:var(--g500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.description)}</div>
            </div>
          </a>
        `;
      }
    } else {
      html += `<div style="padding:10px; font-size:0.82rem; color:var(--g500); text-align:center;">No direct matching tool. Press Enter to ask Assistant.</div>`;
    }

    if (!isAi) {
      html += `<div style="margin-top:6px;">${aiHtml}</div>`;
    }

    homeHeroDropdown.innerHTML = html;
    homeHeroDropdown.style.display = 'block';
  }

  function submitHomeHero() {
    const q = homeHeroInput.value.trim();
    if (!q) return;
    const user = getCurrentUser();
    const availableTools = user ? TOOLS : TOOLS.filter(t => t.id !== 'assistant');
    const isAi = detectAiIntent(q);
    const searchRes = search(q, availableTools, { labels: CATEGORY_LABELS }).results;

    if (!isAi && searchRes.length && searchRes[0].score >= 60) {
      window.location.hash = `#${searchRes[0].tool.id}`;
    } else {
      sessionStorage.setItem('toolbox_pending_prompt', q);
      window.location.hash = '#assistant';
    }
    homeHeroDropdown.style.display = 'none';
  }

  homeHeroInput.addEventListener('input', renderHomeHeroResults);
  homeHeroInput.addEventListener('focus', renderHomeHeroResults);
  homeHeroInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitHomeHero();
    }
  });

  homeHeroSubmitBtn?.addEventListener('click', submitHomeHero);

  homeHeroDropdown.addEventListener('click', (e) => {
    const aiRow = e.target.closest('.home-hero-ai-row');
    if (aiRow) {
      const p = aiRow.dataset.aiPrompt || homeHeroInput.value.trim();
      sessionStorage.setItem('toolbox_pending_prompt', p);
      window.location.hash = '#assistant';
      homeHeroDropdown.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#home-search-wrap')) {
      homeHeroDropdown.style.display = 'none';
    }
  });
}


const tipsFab = $('tips-fab');
if (tipsFab) {
  tipsFab.addEventListener('click', showTips);
  $('close-tips')?.addEventListener('click', hideTips);
  $('tips-modal')?.addEventListener('click', (e) => { if (e.target === $('tips-modal')) hideTips(); });

  let scrollTimeout = null;
  window.addEventListener('scroll', () => {
    tipsFab.style.opacity = '1';
    tipsFab.style.pointerEvents = 'auto';
    tipsFab.style.transform = 'translateY(0)';
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      tipsFab.style.opacity = '0';
      tipsFab.style.pointerEvents = 'none';
      tipsFab.style.transform = 'translateY(10px)';
    }, 1500);
  }, { passive: true });
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
  document.querySelectorAll('[data-page="saved"]').forEach(el => {
    el.hidden = items.length === 0;
  });

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

const isStandalone = new URLSearchParams(window.location.search).get('standalone') === 'true';
if (isStandalone) {
  document.body.classList.add('standalone-mode');
}

const initialUser = getCurrentUser();
renderGrid(initialUser ? TOOLS : TOOLS.filter(t => t.id !== 'assistant'));
installCategoryChips();
handleHash();

// Prune invalid or deleted accounts against Supabase in background
validateSession().catch(() => {});

// Mobile Nav Indicator & Micro-haptics
window.addEventListener('resize', updateMobileNavIndicator, { passive: true });
document.getElementById('mobile-nav')?.addEventListener('click', (e) => {
  if (e.target.closest('.mob-nav-item')) {
    try { navigator.vibrate?.(6); } catch (err) {}
    setTimeout(updateMobileNavIndicator, 50);
  }
});
requestAnimationFrame(updateMobileNavIndicator);

