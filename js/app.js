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
import { kindLabel } from './registry/kinds.js';
import { copyText, showToast } from './utils.js';
import { initTheme } from './lib/theme.js';
import { installSettingsUI, openSettings } from './lib/settings-ui.js';
import { hasToolSettings } from './lib/tool-settings.js';
import { installHeaderMenu } from './lib/header-menu.js';
import { getCurrentUser, parseAuthRedirect } from './lib/supabase.js';
import { openAccountModal } from './views/account-modal.js';
import { initWorkspace } from './lib/workspace.js';
import { initScrollNarrative } from './about-scroll.js';
import { initSupporterProfile } from './lib/supporter.js';
import './lib/dialog.js';
import '../css/menu-motion.css';
import '../css/automobile-viewer.css';
import '../css/code-playground.css';
import { initHomeScrollNarrative } from './home-scroll.js';
import { listJoinedSpaces } from './lib/space-engine.js';
import { openContextMenu } from './lib/context-menu.js';
import { initMessageNotifications } from './lib/message-notifications.js';

/* --------------- state --------------- */

let currentToolId = null;
let toolNavigationVersion = 0;
let currentToolInstance = null;
let currentToolObj = null;
let currentSession = null;
let currentPage = 'home';
/** Teardown for whatever the artifact layer mounted around the open tool. */
let unmountArtifacts = null;
/** Teardown for the saved-work view. */
let unmountSaved = null;
/** Watches the open tool so output wells stay free of template whitespace. */
let outputObserver = null;
/** Teardown for the spaces view. */

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
const headerFsExitBtn = $('header-fs-exit-btn');
const searchInput = $('search');
const searchWrapper = $('search-wrapper');
const logo = $('logo');
const grid = $('tool-grid');
const navLinks = document.querySelectorAll('.nav-link');

const savedView = $('saved-view');
const navSaved = $('nav-saved');
const donateView = $('donate-view');

const VIEWS = { home: homeView, tools: toolsView, about: supportView, support: supportView, saved: savedView, files: savedView, donate: supportView, tool: viewport };

const toolModules = import.meta.glob('./tools/*.js');

/* --------------- helpers --------------- */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toolCard(tool, { compact = false, index = 0 } = {}) {
  return `
    <a class="tool-card${compact ? ' tool-card-sm' : ''}" href="#${tool.id}" id="card-${tool.id}" style="--i:${index}">
      <div class="tool-card-icon">${tool.icon}</div>
      <div class="tool-card-info">
        <div class="tool-card-name">${escapeHtml(tool.name)}</div>
        <div class="tool-card-desc">${escapeHtml(tool.description)}</div>
      </div>
      ${tool.badge ? `<span class="tool-card-badge">${escapeHtml(tool.badge)}</span>`
        : tool.offline === false ? '<span class="tool-card-flag" title="Needs an internet connection">Online</span>' : ''}
    </a>`;
}

export const LONG_CONTENT_TOOL_IDS = new Set([
  'wiki', 'dictionary', 'bible', 'quran',
  'case-digest', 'case-comparator', 'legal-document-analyzer', 'legal-research', 'legal-pdf',
  'document-analyzer', 'periodic-table', 'compound-database', 'diseases-database',
  'cap-table', 'amortization-schedule', 'depreciation-calculator', 'invoice-generator',
  'payroll-cost', 'timesheet', 'pto-accrual', 'unit-economics', 'runway-calculator',
  'subscription-analyzer', 'financial-analyzer', 'concrete-estimator', 'beam-calculator',
  'stoichiometry-calculator', 'chemical-equation-balancer', 'math-utility', 'chess', 'tech-device-comparisons'
]);

/* Tools that bring their own full-screen chrome: no panel around them. */
const BARE_TOOL_IDS = new Set([
  'assistant', 'code-playground', 'container-planner', 'mail', 'messaging', 'calendar',
  'notes', 'browser', 'automobile-guide', 'anatomy-explorer', 'interactive-map', 'spotify',
]);
/* Tools that need the whole width of the window. */
const WIDE_TOOL_IDS = new Set([
  ...BARE_TOOL_IDS,
  'flowchart', 'architecture-editor', 'uml-diagram', 'logic-lab', 'algorithm-lab', 'pdf-editor',
  'watermark-remover', 'math-utility', 'periodic-table', 'data-bot', 'financial-analyzer', 'wiki',
  'video-player', 'file-drop', 'compound-database', 'diseases-database', 'calculator', 'case-digest',
  'case-comparator', 'legal-research', 'text-diff', 'tech-device-comparisons', 'sound-effects', 'chess',
]);
/* Tools whose content should stretch to fill the panel's height. */
const FILL_TOOL_IDS = new Set([
  'flowchart', 'architecture-editor', 'uml-diagram', 'logic-lab', 'algorithm-lab', 'pdf-editor',
  'watermark-remover', 'data-bot', 'video-player', 'calculator', 'timer',
]);

export function isFitScreenTool(id) {
  return !LONG_CONTENT_TOOL_IDS.has(id);
}

/* --------------- rendering --------------- */

export function getVisibleTools({ isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768) } = {}) {
  const user = getCurrentUser();
  return TOOLS.filter(t => {
    if (t.hidden) return false;
    if (!user && t.id === 'assistant') return false;
    if (!user && isMobile && t.id === 'code-playground') return false;
    if (user && t.id === 'file-drop') return false;
    return true;
  });
}

function renderGrid(originalList, { query = '', noResult = false } = {}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const user = getCurrentUser();
  const source = originalList || getVisibleTools({ isMobile });
  const list = source.filter(t => {
    if (t.hidden) return false;
    if (!user && t.id === 'assistant') return false;
    if (!user && isMobile && t.id === 'code-playground') return false;
    if (user && t.id === 'file-drop') return false;
    return true;
  });

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
        <section class="grid-category">
          <div class="grid-category-head"><h2 class="category-label">Closest matches</h2></div>
          <div class="category-tools">${list.slice(0, 6).map((t, i) => toolCard(t, { index: i })).join('')}</div>
        </section>` : ''}`;
    return;
  }

  // A search result is a ranked list; browsing is grouped by category.
  if (query) {
    grid.innerHTML = `
      <section class="grid-category">
        <div class="grid-category-head"><h2 class="category-label">Results</h2><span class="category-count">${list.length}</span></div>
        <div class="category-tools">${list.map((t, i) => toolCard(t, { index: i })).join('')}</div>
      </section>`;
    return;
  }

  const popularTools = popular(8).filter(t => list.some(lt => lt.id === t.id));
  const groups = categorised(list);
  const sections = [
    `<section class="grid-category" id="cat-popular">
       <div class="grid-category-head"><h2 class="category-label">Popular</h2><span class="category-count">${popularTools.length}</span></div>
       <p class="category-blurb">What people open most.</p>
       <div class="category-tools">${popularTools.map((t, i) => toolCard(t, { index: i })).join('')}</div>
     </section>`,
    ...groups.map(c => `
      <section class="grid-category" id="cat-${c.id}">
        <div class="grid-category-head"><h2 class="category-label">${escapeHtml(c.label)}</h2><span class="category-count">${c.tools.length}</span></div>
        <p class="category-blurb">${escapeHtml(c.blurb)}</p>
        <div class="category-tools">${c.tools.map((t, i) => toolCard(t, { index: i })).join('')}</div>
      </section>`),
  ];
  grid.innerHTML = sections.join('');
  renderCategoryChips(groups);
  const count = $('tools-count');
  if (count) count.textContent = String(list.length);
}

let prevNavIndicatorLeft = null;
let prevNavIndicatorWidth = null;
let stretchTimer = null;

export function updateMobileNavIndicator() {
  const nav = document.getElementById('mobile-nav');
  const indicator = document.getElementById('mob-nav-indicator');
  if (!nav || !indicator) return;
  const active = nav.querySelector('.mob-nav-item.active');
  if (!active || getComputedStyle(nav).display === 'none') { indicator.style.width = '0px'; return; }
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function renderCategoryChips(groups) {
  const bar = document.getElementById('category-chip-bar');
  if (!bar) return;
  bar.innerHTML = [
    `<button type="button" class="chip category-chip active" data-cat="all">All</button>`,
    `<button type="button" class="chip category-chip" data-cat="popular">Popular</button>`,
    ...groups.map(c => `<button type="button" class="chip category-chip" data-cat="${c.id}">${escapeHtml(c.label)}</button>`),
  ].join('');
  installCategoryChips();
}

function installCategoryChips() {
  const chipBar = document.getElementById('category-chip-bar');
  if (!chipBar) return;
  const chips = chipBar.querySelectorAll('.category-chip');

  chips.forEach(chip => {
    chip.setAttribute('aria-pressed', chip.classList.contains('active') ? 'true' : 'false');
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      try { navigator.vibrate?.(6); } catch (err) {}
      chips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

      const catId = chip.dataset.cat;
      if (catId === 'all') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetEl = document.getElementById(`cat-${catId}`);
      if (targetEl) {
        const headerOffset = 130;
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


const FILE_UPLOAD_TOOL_IDS = new Set([
  'audio-tag-editor',
  'document-analyzer',
  'file-compressor',
  'file-decompressor',
  'file-drop',
  'file-hash',
  'image-compressor',
  'image-converter',
  'image-cropper',
  'image-metadata',
  'image-resizer',
  'image-to-pdf',
  'legal-document-analyzer',
  'legal-pdf',
  'pdf-editor',
  'pdf-merge',
  'pdf-split',
  'video-player',
  'watermark-remover'
]);

function isSimpleFileUploadTool(tool, container) {
  if (!tool) return false;
  if (FILE_UPLOAD_TOOL_IDS.has(tool.id)) return true;
  if (!container) return false;
  const excluded = ['assistant', 'container-planner', 'mail', 'messaging', 'calendar', 'data-bot', 'financial-analyzer', 'notes', 'code-playground', 'flowchart'];
  if (excluded.includes(tool.id)) return false;

  const hasDropzone = !!container.querySelector('.fz, .compressor-dropzone, [id*="dropzone"], [class*="dropzone"], [class*="drop-zone"], [id*="drop-zone"]');
  const hasFileInput = !!container.querySelector('input[type="file"]');
  const hasTextarea = !!container.querySelector('textarea');
  const hasEditor = !!container.querySelector('.editor, [contenteditable="true"], canvas, table');
  return (hasDropzone || hasFileInput) && !hasTextarea && !hasEditor;
}

function renderRelated(tool) {
  if (!relatedBar) return;
  if (document.body.classList.contains('tool-fullscreen') || tool?.id === 'assistant' || tool?.id === 'container-planner') {
    relatedBar.innerHTML = '';
    relatedBar.hidden = true;
    return;
  }
  // User Rule: Remove "Related Tools" from all tools except the ones that simply just ask you to upload a file
  if (!isSimpleFileUploadTool(tool, viewportContent)) {
    relatedBar.innerHTML = '';
    relatedBar.hidden = true;
    return;
  }
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const visible = getVisibleTools({ isMobile });
  const rel = relatedTools(tool, visible, 4);
  if (!rel.length) { relatedBar.innerHTML = ''; relatedBar.hidden = true; return; }
  relatedBar.hidden = false;
  relatedBar.innerHTML = `
    <h2 class="related-h">Related tools</h2>
    <div class="related-list">${rel.map((t, i) => toolCard(t, { compact: true, index: i })).join('')}</div>`;
}


function updateFullscreenBtnState(isFullscreen) {
  if (!popoutBtn) return;
  const expandIcon = popoutBtn.querySelector('.fs-icon-expand');
  const collapseIcon = popoutBtn.querySelector('.fs-icon-collapse');
  const label = popoutBtn.querySelector('.fs-label');
  if (label) label.textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
  popoutBtn.title = isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen';
  popoutBtn.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
}

function toggleToolFullscreen(force) {
  const isFullscreen = document.body.classList.toggle('tool-fullscreen', force);
  updateFullscreenBtnState(isFullscreen);
  if (isFullscreen && relatedBar) {
    relatedBar.hidden = true;
  }
}

/* --------------- routing --------------- */

function showPage(page) {
  teardownTool();

  if (page !== 'saved' && page !== 'files') {
    unmountSaved?.();
    unmountSaved = null;
    if (savedView) savedView.innerHTML = '';
  }

  for (const v of Object.values(VIEWS)) {
    if (!v) continue;
    v.classList.add('hidden');
  }
  const view = VIEWS[page];
  if (view) {
    view.classList.remove('hidden');
    void view.offsetWidth;
  }

  // Route & Scroll Restoration: always start at the top
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const mainEl = document.getElementById('main');
  if (mainEl) mainEl.scrollTop = 0;
  if (view) view.scrollTop = 0;

  // Toggle snap scrolling on html for home
  document.documentElement.classList.toggle('page-snap-active', page === 'home');

  currentPage = page;
  document.body.classList.remove('in-tool');
  document.body.removeAttribute('data-tool-id');
  document.body.classList.remove('tool-fit-screen');
  document.body.classList.remove('tool-bare', 'tool-wide', 'tool-fill');
  document.body.classList.toggle('in-files', page === 'saved' || page === 'files');
  for (const link of navLinks) {
    link.classList.toggle('active', link.dataset.page === page || (page === 'about' && link.dataset.page === 'support') || (page === 'support' && link.dataset.page === 'about'));
  }
  if (page === 'donate') openSettings('contribution');

  requestAnimationFrame(updateMobileNavIndicator);
}

function initAboutShowcase() {
  const nav = document.getElementById('pipeline-flow-nav');
  const details = document.getElementById('pipeline-details');
  if (!nav || !details || nav.dataset.installed) return;
  nav.dataset.installed = 'true';

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.pipeline-step-btn');
    if (!btn) return;
    try { navigator.vibrate?.(6); } catch {}
    const step = btn.dataset.step;
    nav.querySelectorAll('.pipeline-step-btn').forEach(b => b.classList.toggle('active', b === btn));
    details.querySelectorAll('[data-step-panel]').forEach(panel => {
      if (panel.dataset.stepPanel === step) {
        panel.style.display = 'block';
        panel
      } else {
        panel.style.display = 'none';
        panel
      }
    });
  });
}

/* Templates indent their markup, and `.tool-output` renders whitespace as
   written, so a result block would open with the template's own indentation.
   Trimming the whitespace-only edges of every output well once per render
   fixes it everywhere without touching 29 tool templates. */
function tidyOutputs(root) {
  if (!root) return;
  for (const el of root.querySelectorAll('.tool-output')) {
    // A well that mixes elements with template whitespace: drop the blank
    // text nodes between them, they would render as gaps and indentation.
    if (el.firstElementChild) {
      for (const node of [...el.childNodes]) {
        if (node.nodeType === 3 && !node.nodeValue.trim()) node.remove();
      }
    }
    let first = el.firstChild;
    while (first && first.nodeType === 3 && !first.nodeValue.trim()) { first.remove(); first = el.firstChild; }
    let last = el.lastChild;
    while (last && last.nodeType === 3 && !last.nodeValue.trim()) { last.remove(); last = el.lastChild; }
    if (first && first.nodeType === 3) first.nodeValue = first.nodeValue.replace(/^\s*\n\s*/, '');
    if (last && last.nodeType === 3) last.nodeValue = last.nodeValue.replace(/\s*\n\s*$/, '');
  }
}

function teardownTool() {
  toolNavigationVersion++;
  outputObserver?.disconnect();
  outputObserver = null;
  toggleToolFullscreen(false);
  document.body.classList.remove('in-tool');
  document.body.removeAttribute('data-tool-id');
  document.body.classList.remove('tool-fit-screen');
  document.body.classList.remove('tool-bare', 'tool-wide', 'tool-fill');
  unmountArtifacts?.();
  unmountArtifacts = null;
  unmountSaved?.();
  unmountSaved = null;
    currentSession?.dispose();
  currentSession = null;
  try { currentToolInstance?.destroy?.(); }
  catch (err) { console.error('tool failed to clean up', err); }
  currentToolInstance = null;
  currentToolId = null;
  currentToolObj = null;
}

async function openTool(id, routeState = {}) {
  const tool = BY_ID.get(id);
  
  if (id === 'assistant' && !getCurrentUser()) {
    window.location.hash = '';
    showPage('home');
    openAccountModal();
    return;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (id === 'code-playground' && !getCurrentUser() && isMobile) {
    window.location.hash = '#tools';
    showPage('tools');
    showToast('Sign in to access Code Playground on mobile');
    return;
  }

  if (!tool) return showPage('home');

  teardownTool();

  const navigationVersion = toolNavigationVersion;

  for (const v of Object.values(VIEWS)) {
    if (!v) continue;
    v.classList.add('hidden');
  }
  viewportTitle.innerHTML = `<span class="viewport-title-icon" aria-hidden="true">${tool.icon}</span><span>${escapeHtml(tool.name)}</span>`;
  const categoryLink = $('viewport-category');
  if (categoryLink) {
    categoryLink.textContent = CATEGORY_LABELS[tool.category] || 'Tools';
    categoryLink.href = '#tools';
    categoryLink.dataset.cat = tool.category;
  }
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
  freshContent.setAttribute('aria-busy', 'true');
  viewportContent.replaceWith(freshContent);
  viewportContent = freshContent;
  if (relatedBar) relatedBar.hidden = true;
  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
  const isFullscreenByDefault = (id === 'assistant' || id === 'container-planner');
  if (popoutBtn) {
    popoutBtn.style.display = (isDesktop && !isFullscreenByDefault) ? 'inline-flex' : 'none';
    updateFullscreenBtnState(false);
  }
  const prefsBtn = $('tool-prefs-btn');
  if (prefsBtn) prefsBtn.hidden = !hasToolSettings(id);
  viewport.classList.remove('hidden');

  for (const link of navLinks) link.classList.toggle('active', link.dataset.page === 'tools');
  requestAnimationFrame(updateMobileNavIndicator);

  currentPage = 'tool';
  document.body.classList.add('in-tool');
  document.body.classList.remove('in-files');
  document.body.setAttribute('data-tool-id', id);
  document.body.classList.toggle('tool-fit-screen', isFitScreenTool(id));
  document.body.classList.toggle('tool-bare', BARE_TOOL_IDS.has(id));
  document.body.classList.toggle('tool-wide', WIDE_TOOL_IDS.has(id));
  document.body.classList.toggle('tool-fill', FILL_TOOL_IDS.has(id));
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
    if (toolNavigationVersion !== navigationVersion) return;
    currentToolInstance = module.default;
    await currentToolInstance.render(viewportContent, { ...routeState, analytics: session, tool, artifact: incoming });
    if (toolNavigationVersion !== navigationVersion) return;

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
    tidyOutputs(viewportContent);
    outputObserver?.disconnect();
    outputObserver = new MutationObserver(() => tidyOutputs(viewportContent));
    outputObserver.observe(viewportContent, { childList: true, subtree: true });
    freshContent.setAttribute('aria-busy', 'false');
  } catch (err) {
    if (toolNavigationVersion !== navigationVersion) return;
    console.error(err);
    session.error('load_failed');
    viewportContent.innerHTML = `
      <div class="no-results">
        <p class="no-results-title">This tool failed to load</p>
        <p class="no-results-text">Please reopen the tool. If the problem continues, reload Toolbox and check your connection.</p>
      </div>`;
    freshContent.setAttribute('aria-busy', 'false');
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

      const isOwner = (redirect.email && ['meyigbenee@gmail.com', 'meyigbenee@icloud.com', 'laoluwaabiodun1@gmail.com'].includes(redirect.email.toLowerCase()));
      const meta = redirect.userMetadata || {};
      const rawUsername = meta.user_name || meta.preferred_username || meta.username || (redirect.email ? redirect.email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase() : 'user');
      const rawDisplayName = meta.full_name || meta.name || meta.display_name || (redirect.email ? redirect.email.split('@')[0] : 'Toolbox User');

      const userSession = {
        id: redirect.userId || `usr_${Date.now()}`,
        email: redirect.email || 'user@toolbox.app',
        token: redirect.accessToken,
        refreshToken: redirect.refreshToken || '',
        username: isOwner ? 'madselkie' : rawUsername,
        displayName: isOwner ? 'madselkie' : rawDisplayName,
        avatarUrl: meta.avatar_url || meta.picture || '',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('toolbox_supabase_session', JSON.stringify(userSession));
      localStorage.setItem('supabase_auth_session', JSON.stringify(userSession));
      window.dispatchEvent(new CustomEvent('toolbox:authchange', { detail: { user: userSession } }));

      const successMsg = redirect.type === 'email_change'
        ? 'Email address confirmed and updated successfully.'
        : 'Welcome to Toolbox!';
      showToast(successMsg, 'success');
      showPage('home');
      if (redirect.type === 'signup' || localStorage.getItem('toolbox_mail_onboarding_pending')) {
        localStorage.removeItem('toolbox_mail_onboarding_pending');
        openAccountModal('mail-onboarding');
      }
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
  if (raw === 'donate') return showPage('donate');
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

  // #spaces, or #spaces/<code> to join via a shared link - redirect to messaging
  if (raw === 'spaces' || raw.startsWith('spaces/')) {
    const code = raw.startsWith('spaces/') ? raw.slice(7) : '';
    window.location.hash = code ? `#messaging?code=${encodeURIComponent(code)}` : '#messaging';
    return;
  }

  if (raw.startsWith('messaging?')) {
    const messagingParams = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
    const roomCode = messagingParams.get('code');
    const conversationId = messagingParams.get('conversation');
    if (roomCode && /^[A-Za-z0-9_-]{1,80}$/.test(roomCode)) {
      openTool('messaging', { roomCode });
      return;
    }
    openTool('messaging', { conversationId: /^[0-9a-f-]{36}$/i.test(conversationId || '') ? conversationId : null });
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const filteredTools = getVisibleTools({ isMobile });

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
  };

function showTips() {
  const tipsModal = $('tips-modal');
  const tipsContent = $('tips-content');
  const title = $('tips-title');
  tipsContent.innerHTML = '';

  const inTool = currentPage === 'tool' && currentToolObj;
  if (title) title.textContent = inTool ? `Tips · ${currentToolObj.name}` : 'Tips';
  const tips = inTool
    ? [`${escapeHtml(currentToolObj.description)}.`,
       ...(CATEGORY_TIPS[currentToolObj.category] ?? ['Everything runs in your browser.'])]
    : (PAGE_TIPS[currentPage] ?? PAGE_TIPS.tools);

  for (const tip of tips) {
    const li = document.createElement('li');
    li.innerHTML = tip;
    tipsContent.appendChild(li);
  }
  tipsModal.classList.add('is-open');
  $('close-tips')?.focus();
}

function hideTips() {
  $('tips-modal')?.classList.remove('is-open');
  $('tips-fab')?.focus({ preventScroll: true });
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
$('back-btn-mobile')?.addEventListener('click', () => { window.location.hash = '#tools'; });
$('header-search-btn')?.addEventListener('click', () => openPalette());
$('viewport-category')?.addEventListener('click', (e) => {
  const cat = e.currentTarget.dataset.cat;
  if (!cat) return;
  e.preventDefault();
  window.location.hash = '#tools';
  requestAnimationFrame(() => setTimeout(() => {
    document.querySelector(`.category-chip[data-cat="${cat}"]`)?.click();
  }, 60));
});
const onScrollState = () => document.body.classList.toggle('is-scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScrollState, { passive: true });
onScrollState();
$('tool-prefs-btn')?.addEventListener('click', () => { if (currentToolId) openSettings(`tool:${currentToolId}`); });
if (popoutBtn) {
  popoutBtn.addEventListener('click', () => {
    toggleToolFullscreen();
  });
}
if (headerFsExitBtn) {
  headerFsExitBtn.addEventListener('click', () => {
    toggleToolFullscreen(false);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('tool-fullscreen')) {
    toggleToolFullscreen(false);
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth <= 768 && document.body.classList.contains('tool-fullscreen')) {
    toggleToolFullscreen(false);
  }
  if (popoutBtn && currentPage === 'tool') {
    popoutBtn.style.display = window.innerWidth > 768 ? 'inline-flex' : 'none';
  }
});
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
  homeHeroInput.placeholder = user ? 'Search tools or ask the Assistant…' : 'Compress a photo, merge PDFs, format JSON…';
}

export function renderHomeAssistantBanner() {
  const bannerEl = $('home-assistant-banner');
  if (!bannerEl) return;

  const user = getCurrentUser();
  const titleText = user ? 'The Assistant is ready' : 'Meet the Assistant';
  const descText = user
    ? 'Write code, transform files, work out maths and run any tool — just ask.'
    : 'Sign in to have it write code, transform files, work out maths and run tools for you.';
  const btnText = user ? 'Open Assistant' : 'Sign in';

  bannerEl.innerHTML = `
    <div class="home-assistant-card">
      <div class="home-assistant-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/></svg></div>
      <div class="home-assistant-text">
        <h3 class="home-assistant-title">${titleText}</h3>
        <p class="home-assistant-desc">${descText}</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-open-assistant">${btnText}</button>
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  renderGrid(getVisibleTools({ isMobile }));
  renderHomeAssistantBanner();
  renderQuickRow();
  if (window.location.hash === '#assistant') {
    openTool('assistant');
  }
});

if (homeHeroInput && homeHeroDropdown) {
  function renderHomeHeroResults() {
    const q = homeHeroInput.value.trim();
    if (!q) {
      homeHeroDropdown.hidden = true;
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const availableTools = getVisibleTools({ isMobile });
    const isAi = detectAiIntent(q);
    const searchRes = search(q, availableTools, { labels: CATEGORY_LABELS }).results.map(r => r.tool).slice(0, 6);

    const aiHtml = `
      <div class="hero-dd-row hero-dd-ai" role="option" tabindex="-1" data-ai-prompt="${escapeHtml(q)}">
        <span class="hero-dd-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/></svg></span>
        <span class="hero-dd-text">
          <span class="hero-dd-name">Ask the Assistant: “${escapeHtml(q)}”</span>
          <span class="hero-dd-desc">Let it write code, analyse data or run tools for you</span>
        </span>
        <kbd>Enter</kbd>
      </div>`;

    let html = isAi ? aiHtml : '';
    if (searchRes.length) {
      html += `<div class="hero-dd-label">Tools</div>`;
      html += searchRes.map(t => `
        <a href="#${t.id}" class="hero-dd-row" role="option">
          <span class="hero-dd-icon">${t.icon}</span>
          <span class="hero-dd-text">
            <span class="hero-dd-name">${escapeHtml(t.name)}</span>
            <span class="hero-dd-desc">${escapeHtml(t.description)}</span>
          </span>
        </a>`).join('');
    } else {
      html += `<div class="hero-dd-empty">No tool matches yet. Press Enter to ask the Assistant.</div>`;
    }
    if (!isAi) html += aiHtml;

    homeHeroDropdown.innerHTML = html;
    homeHeroDropdown.hidden = false;
  }

  function submitHomeHero() {
    const q = homeHeroInput.value.trim();
    if (!q) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const availableTools = getVisibleTools({ isMobile });
    const isAi = detectAiIntent(q);
    const searchRes = search(q, availableTools, { labels: CATEGORY_LABELS }).results;

    if (!isAi && searchRes.length && searchRes[0].score >= 60) {
      window.location.hash = `#${searchRes[0].tool.id}`;
    } else {
      sessionStorage.setItem('toolbox_pending_prompt', q);
      window.location.hash = '#assistant';
    }
    homeHeroDropdown.hidden = true;
  }

  homeHeroInput.addEventListener('input', renderHomeHeroResults);
  homeHeroInput.addEventListener('focus', renderHomeHeroResults);
  homeHeroInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { homeHeroDropdown.hidden = true; return; }
    if (e.key === 'ArrowDown') {
      const first = homeHeroDropdown.querySelector('.hero-dd-row');
      if (first) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      submitHomeHero();
    }
  });

  homeHeroSubmitBtn?.addEventListener('click', submitHomeHero);
  homeHeroDropdown.addEventListener('keydown', (e) => {
    const rows = [...homeHeroDropdown.querySelectorAll('.hero-dd-row')];
    const i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i > -1) { e.preventDefault(); rows[Math.min(i + 1, rows.length - 1)].focus(); }
    if (e.key === 'ArrowUp' && i > -1) { e.preventDefault(); (i === 0 ? homeHeroInput : rows[i - 1]).focus(); }
    if (e.key === 'Enter' && document.activeElement?.classList.contains('hero-dd-ai')) { e.preventDefault(); document.activeElement.click(); }
    if (e.key === 'Escape') { homeHeroDropdown.hidden = true; homeHeroInput.focus(); }
  });

  homeHeroDropdown.addEventListener('click', (e) => {
    const aiRow = e.target.closest('.hero-dd-ai');
    if (aiRow) {
      const p = aiRow.dataset.aiPrompt || homeHeroInput.value.trim();
      sessionStorage.setItem('toolbox_pending_prompt', p);
      window.location.hash = '#assistant';
      homeHeroDropdown.hidden = true;
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#home-search-wrap')) {
      homeHeroDropdown.hidden = true;
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
    tipsFab.classList.add('is-visible');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => tipsFab.classList.remove('is-visible'), 1800);
  }, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('tips-modal')?.classList.contains('is-open')) hideTips(); });
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

function renderQuickRow() {
  const quickRow = $('home-quick');
  if (!quickRow) return;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const visible = getVisibleTools({ isMobile });
  quickRow.innerHTML = popular(8)
    .filter(t => t.id !== 'assistant' && visible.some(v => v.id === t.id))
    .slice(0, 6)
    .map(t => `
      <a class="home-quick-item" href="#${t.id}">
        <span class="home-quick-icon">${t.icon}</span>
        <span>${escapeHtml(t.name)}</span>
      </a>`).join('');
}
renderQuickRow();

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
  // Primary navigation for Files must always remain visible
  document.querySelectorAll('.nav-link[data-page="saved"]').forEach(el => {
    el.hidden = false;
  });

  const list = $('home-saved-list');
  if (list) {
    list.innerHTML = items.length
      ? items.slice(0, 5).map(m => `
          <a class="home-file-row" href="#saved/${m.id}">
            <span class="home-file-name">${escapeHtml(m.name)}</span>
            <span class="home-file-kind">${escapeHtml(kindLabel(m.kind))}</span>
          </a>`).join('')
      : `<div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <strong>Nothing saved yet</strong>
          <span>Converted files and exports you keep will show up here.</span>
        </div>`;
  }
}

artifacts.onChange(reflectSavedWork);
reflectSavedWork();


viewport.addEventListener('contextmenu', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.closest('[contenteditable="true"]')) return;
  
  let items = [];
  if (currentToolInstance && typeof currentToolInstance.getContextMenu === 'function') {
      const customItems = currentToolInstance.getContextMenu(e);
      if (customItems && customItems.length > 0) {
          items = items.concat(customItems);
      }
  } else if (currentToolObj) {
      // Tailored actions based on category
      switch (currentToolObj.category) {
        case 'text':
          items.push({ label: 'Clear Editor', action: () => { const els = document.querySelectorAll('textarea, input[type="text"]'); els.forEach(el => el.value = ''); } });
          break;
        case 'numbers':
        case 'business':
          items.push({ label: 'Reset Calculation', action: () => { const btn = document.querySelector('button[class*="reset"], button[id*="reset"], button[class*="clear"], button[id*="clear"]'); if(btn) btn.click(); else { document.querySelectorAll('input').forEach(el => el.value = ''); } } });
          break;
        case 'audio':
        case 'music':
          items.push({ label: 'Stop Audio', action: () => { document.querySelectorAll('audio, video').forEach(a => { a.pause(); a.currentTime = 0; }); } });
          break;
      }
  }
  
  if (currentToolObj) {
      if (items.length > 0) items.push({ separator: true });
      items.push({ label: 'Copy Tool Link', action: () => navigator.clipboard.writeText(window.location.href).catch(()=>{}) });
      const standaloneMode = new URLSearchParams(window.location.search).get('standalone') === 'true';
      if (!standaloneMode) {
          items.push({ label: 'Open in new tab', action: () => window.open(window.location.href, '_blank') });
      }
      openContextMenu({ x: e.clientX, y: e.clientY, items, title: currentToolObj.name });
      e.preventDefault();
  }
});

initTheme();

installSettingsUI();
initSupporterProfile();
installHeaderMenu();
initMessageNotifications();
  initWorkspace(openTool);
  initScrollNarrative();
  initHomeScrollNarrative();

const isStandalone = new URLSearchParams(window.location.search).get('standalone') === 'true';
if (isStandalone) {
  document.body.classList.add('standalone-mode');
}

const isMobileInit = typeof window !== 'undefined' && window.innerWidth <= 768;
renderGrid(getVisibleTools({ isMobile: isMobileInit }));
installCategoryChips();
handleHash();

// Mobile Nav Indicator & Micro-haptics
window.addEventListener('resize', updateMobileNavIndicator, { passive: true });
document.getElementById('mobile-nav')?.addEventListener('click', (e) => {
  if (e.target.closest('.mob-nav-item')) {
    try { navigator.vibrate?.(6); } catch (err) {}
    setTimeout(updateMobileNavIndicator, 50);
  }
});
requestAnimationFrame(updateMobileNavIndicator);

