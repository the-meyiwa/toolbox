/* ============================================================
   TOOLBOX — app shell.

   This file routes, renders and instruments. It holds no tool metadata:
   that all lives in js/registry/, and search ranking lives in
   js/lib/search.js, so adding a tool never means editing the shell.
   ============================================================ */

import { TOOLS, CATEGORY_LABELS, OFFLINE_TOOLS, categorised, byTask, popular, resolveRoute, BY_ID } from './registry/index.js';
import { search, relatedTools } from './lib/search.js';
import { track, toolSession } from './lib/analytics.js';
import * as artifacts from './lib/artifacts.js';
import { mountArtifactStrip, incomingBanner } from './lib/artifact-ui.js';
import { installPalette, openPalette, openSearch, detectAiIntent } from './lib/palette.js';
import { openAssistant, openAssistantTab } from './lib/assistant-popup.js';
import { getSetting } from './lib/settings.js';
import { quickDeviceLookup, openQuickResult, quickResultHint, quickResultTitle } from './lib/devices/quick-search.js';
import { renderSaved } from './views/saved.js';
import { kindLabel } from './registry/kinds.js';
import { getFileTypeIcon, getFileTypeColor } from './lib/file-icons.js';
import { copyText, showToast } from './utils.js';
import { initTheme } from './lib/theme.js';
import { installSettingsUI, openSettings } from './lib/settings-ui.js';
import { hasToolSettings } from './lib/tool-settings.js';
import { installHeaderMenu } from './lib/header-menu.js';
import { getCurrentUser, parseAuthRedirect, validateSession } from './lib/supabase.js';
import { isTestAccountEmail, isIssuedAccessToken, TEST_ACCOUNT_MESSAGE } from './lib/account-policy.js';
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
import { deliverToFileInput } from './lib/interop.js';
import { installGlobalMenus, installLongPress } from './lib/global-menus.js';
import { installTextActions } from './lib/text-actions.js';
import { installAssistantShortcut } from './lib/assistant-shortcut.js';
import { installFileSurface } from './lib/file-surface.js';
import { installMotion } from './lib/motion.js';
import { initMessageNotifications } from './lib/message-notifications.js';
import { installSessionKeeper } from './lib/session-keeper.js';
import { startReminderClock } from './lib/reminders.js';
import { startAutomationClock } from './lib/automations.js';
import { icon as uiIcon } from './lib/icons.js';

installSessionKeeper();
// Check the stored session with the auth provider once the page has settled. Sessions it never
// issued (old simulated or test accounts) are signed out; a real one keeps the provider's identity.
(window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(() => { validateSession().catch(() => {}); });

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
// Warm the large 3D modules only when someone approaches Container Builder.
// The blank initial canvas then needs no unit mesh on its first frame.
let containerWarmup = null;
document.addEventListener('pointerover', e => {
  if (containerWarmup || !e.target.closest?.('a[href="#container-planner"], [data-tool="container-planner"]')) return;
  containerWarmup = Promise.allSettled([
    import('./lib/viewer3d.js'), import('./lib/container-mesh.js'),
    import('./lib/render-materials.js'), import('./lib/container-structure.js'), import('./lib/container-parts.js'),
  ]);
}, { passive: true });

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
      ${tool.badge === 'Beta' ? '<span class="tool-card-badge beta-badge">Beta</span>' : tool.badge ? `<span class="tool-card-badge">${escapeHtml(tool.badge)}</span>`
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
  'stoichiometry-calculator', 'chemical-equation-balancer', 'math-utility', 'chess', 'tech-device-comparisons',
  'cosmetics-database', 'mind',
]);

/* Tools that bring their own full-screen chrome: no panel around them. */
const BARE_TOOL_IDS = new Set([
  'assistant', 'code-playground', 'container-planner', 'mail', 'messaging', 'calendar',
  'notes', 'browser', 'automobile-guide', 'anatomy-explorer', 'interactive-map', 'spotify', '3d-lab', 'mind',
]);
/* Tools that need the whole width of the window. */
const WIDE_TOOL_IDS = new Set([
  ...BARE_TOOL_IDS,
  'flowchart', 'architecture-editor', 'uml-diagram', 'logic-lab', 'algorithm-lab', 'pdf-editor',
  'watermark-remover', 'math-utility', 'periodic-table', 'data-bot', 'financial-analyzer', 'wiki',
  'video-player', 'file-drop', 'compound-database', 'diseases-database', 'calculator', 'case-digest',
  'case-comparator', 'legal-research', 'text-diff', 'tech-device-comparisons', 'sound-effects', 'chess',
  'scribe', 'ledger', 'podium', 'cosmetics-database',
]);
/* Tools whose content should stretch to fill the panel's height. */
const FILL_TOOL_IDS = new Set([
  'flowchart', 'architecture-editor', 'uml-diagram', 'logic-lab', 'algorithm-lab', 'pdf-editor',
  'watermark-remover', 'data-bot', 'video-player', 'calculator', 'timer',
  'assistant', 'container-planner', 'scribe', 'ledger', 'podium', '3d-lab',
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
  if (tool?.id === 'assistant' || tool?.id === 'container-planner') {
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
  viewportTitle.innerHTML = `<span class="viewport-title-icon" aria-hidden="true">${tool.icon}</span><span>${escapeHtml(tool.name)}</span>${tool.badge === 'Beta' ? '<span class="beta-badge" title="In beta: still being improved, so expect rough edges.">Beta</span>' : ''}`;
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
    if (incoming && typeof currentToolInstance.setArtifact !== 'function') {
      // A file tool with no artifact hook still has a file input: hand it the
      // file exactly as if it had been dropped there.
      deliverToFileInput(viewportContent, incoming).then((ok) => {
        if (ok && !currentToolInstance?.ownFileChrome) viewportContent.prepend(incomingBanner(incoming, BY_ID.get(incoming.from)));
      });
    }
    if (incoming && typeof currentToolInstance.setArtifact === 'function') {
      try {
        currentToolInstance.setArtifact(incoming);
        if (!currentToolInstance.ownFileChrome) viewportContent.prepend(incomingBanner(incoming, BY_ID.get(incoming.from)));
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

let lastRoutedHash = null;
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

      // Only a token the auth provider issued, for a real person's address, becomes a session.
      if (!isIssuedAccessToken(redirect.accessToken) || !redirect.userId || isTestAccountEmail(redirect.email)) {
        showToast(isTestAccountEmail(redirect.email) ? TEST_ACCOUNT_MESSAGE : 'That sign-in link is not valid. Please sign in again.', 'error', 6000);
        showPage('home');
        return;
      }

      const isOwner = (redirect.email && ['meyigbenee@gmail.com', 'meyigbenee@icloud.com', 'laoluwaabiodun1@gmail.com'].includes(redirect.email.toLowerCase()));
      const meta = redirect.userMetadata || {};
      const rawUsername = meta.user_name || meta.preferred_username || meta.username || (redirect.email ? redirect.email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase() : 'user');
      const rawDisplayName = meta.full_name || meta.name || meta.display_name || (redirect.email ? redirect.email.split('@')[0] : 'Toolbox User');

      const userSession = {
        id: redirect.userId,
        email: String(redirect.email || '').toLowerCase(),
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
      // Confirm the identity with the auth provider; anything that does not check out is signed out.
      validateSession().catch(() => {});

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
  const cameFrom = lastRoutedHash;
  lastRoutedHash = window.location.hash || '#home';

  // The Assistant always gets its own tab. A tab opened straight onto #assistant keeps it.
  if (raw === 'assistant' && cameFrom !== null && cameFrom !== '#assistant' && getCurrentUser() && getSetting('assistantNewTab') && openAssistantTab()) {
    lastRoutedHash = cameFrom;
    try { window.history.replaceState(null, '', cameFrom); } catch { /* ignore */ }
    return;
  }

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

  const { id, redirected, query } = resolveRoute(raw);
  if (!id) return showPage('home');
  if (redirected) {
    // Replace so a retired link does not linger in history.
    window.location.replace(`#${id}${query}`);
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
  'pdf': ['PDFs are processed on your device — nothing is uploaded.', 'Chain several jobs at once with PDF Workflow.'],
  'media': ['Video and audio are processed on your device.', 'The first job downloads the video engine once; after that it is cached.'],
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
$('header-search-btn')?.addEventListener('click', () => openSearch());
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
logo.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = '#home'; });
// The pixel mark assembles once on entry; drop the class afterwards so ending
// a hover ripple doesn't replay the entrance (shell.css .logo.is-entering).
setTimeout(() => logo.classList.remove('is-entering'), 1100);
window.addEventListener('hashchange', handleHash);
// Plain clicks on Assistant links open it in a new tab straight from the click,
// so popup blockers see a user gesture. Signed out, the normal route shows sign-in.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href="#assistant"]');
  if (!a || window.location.hash === '#assistant' || !getCurrentUser() || !getSetting('assistantNewTab')) return;
  if (!openAssistantTab()) return;
  e.preventDefault();
}, true);
window.addEventListener('pagehide', () => currentSession?.dispose());

// Central Search & AI Prompt Box on Home Page
const homeHeroInput = $('home-hero-input');
const homeHeroDropdown = $('home-hero-dropdown');
const homeHeroSubmitBtn = $('home-hero-submit-btn');

function updateSearchPlaceholder() {
  if (!homeHeroInput) return;
  const user = getCurrentUser();
  const narrow = window.innerWidth <= 560;
  homeHeroInput.placeholder = user || narrow ? 'Ask anything, or search tools…' : 'Ask anything, or search: compress a photo, merge PDFs…';
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')) document.querySelectorAll('#home-search-keys .k-mod').forEach(k => { k.textContent = '⌘'; });
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
    <div class="lp-head" style="--hue:262">
      <span class="lp-head-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/></svg></span>
      <div class="lp-head-text">
        <small>Assistant</small>
        <h3 class="home-assistant-title">${titleText}</h3>
        <p class="home-assistant-desc">${descText}</p>
      </div>
      <button type="button" class="lp-btn lp-btn-primary" id="btn-open-assistant">${btnText}</button>
    </div>
  `;

  bannerEl.querySelector('#btn-open-assistant')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!getCurrentUser()) {
      openAccountModal();
      return;
    }
    openAssistant();
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
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const firstKey = isMac ? '⌘ Enter' : 'Ctrl Enter';
  let heroTools = [];
  let heroDevice = null;   // quick device/compare match for the current query, once resolved
  let heroGen = 0;

  function deviceRowHtml(hit) {
    return `
      <div class="hero-dd-row hero-dd-device" role="option" tabindex="-1">
        <span class="hero-dd-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="7" height="12" rx="1.5"/><rect x="13" y="8" width="7" height="12" rx="1.5"/><path d="M7.5 16v2M16.5 20v2"/></svg></span>
        <span class="hero-dd-text">
          <span class="hero-dd-name">${escapeHtml(quickResultTitle(hit))}</span>
          <span class="hero-dd-desc">${escapeHtml(quickResultHint(hit))}</span>
        </span>
        <kbd>Enter</kbd>
      </div>`;
  }

  function renderHomeHeroResults() {
    const q = homeHeroInput.value.trim();
    const gen = ++heroGen;
    if (!q) {
      homeHeroDropdown.hidden = true;
      heroTools = [];
      heroDevice = null;
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const availableTools = getVisibleTools({ isMobile });
    heroTools = search(q, availableTools, { labels: CATEGORY_LABELS }).results.map(r => r.tool).slice(0, 6);
    heroDevice = null;

    // Enter opens a confident device/comparison match directly; otherwise it
    // asks the Assistant. Ctrl/Cmd+Enter opens the first suggestion either way.
    const aiHtml = `
      <div class="hero-dd-row hero-dd-ai" role="option" tabindex="-1" data-ai-prompt="${escapeHtml(q)}">
        <span class="hero-dd-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/></svg></span>
        <span class="hero-dd-text">
          <span class="hero-dd-name">Ask Assistant: “${escapeHtml(q)}”</span>
          <span class="hero-dd-desc">Answers here, over this page</span>
        </span>
        <kbd>Enter</kbd>
      </div>`;
    let html = aiHtml;
    if (heroTools.length) {
      html += `<div class="hero-dd-label">Tools</div>`;
      html += heroTools.map((t, i) => `
        <a href="#${t.id}" class="hero-dd-row" role="option">
          <span class="hero-dd-icon">${t.icon}</span>
          <span class="hero-dd-text">
            <span class="hero-dd-name">${escapeHtml(t.name)}</span>
            <span class="hero-dd-desc">${escapeHtml(t.description)}</span>
          </span>
          ${i === 0 && !isMobile ? `<kbd>${firstKey}</kbd>` : ''}
        </a>`).join('');
    } else {
      html += `<div class="hero-dd-empty">No tool matches. Press Enter to ask the Assistant.</div>`;
    }

    homeHeroDropdown.innerHTML = html;
    homeHeroDropdown.hidden = false;

    if (q.length >= 3) {
      setTimeout(() => {
        if (gen !== heroGen) return;
        quickDeviceLookup(q).then(hit => {
          if (gen !== heroGen || !hit) return;
          heroDevice = hit;
          // The device match takes Enter; demote the Assistant row's own hint accordingly.
          homeHeroDropdown.innerHTML = deviceRowHtml(hit) + html.replace(aiHtml, aiHtml.replace('<kbd>Enter</kbd>', ''));
        }).catch(() => {});
      }, 150);
    }
  }

  function askFromHome(q) {
    if (!q) return;
    homeHeroDropdown.hidden = true;
    homeHeroInput.value = '';
    homeHeroInput.blur();
    openAssistant({ prompt: q });
  }

  function openDevice(hit) {
    homeHeroDropdown.hidden = true;
    homeHeroInput.value = '';
    homeHeroInput.blur();
    openQuickResult(hit);
  }

  function openFirstSuggestion() {
    if (!heroTools.length && !heroDevice) renderHomeHeroResults();
    if (heroDevice) { openDevice(heroDevice); return true; }
    const first = heroTools[0];
    if (!first) return false;
    homeHeroDropdown.hidden = true;
    window.location.hash = `#${first.id}`;
    return true;
  }

  function submitHomeHero() {
    if (heroDevice) { openDevice(heroDevice); return; }
    askFromHome(homeHeroInput.value.trim());
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
      if (e.ctrlKey || e.metaKey) { if (!openFirstSuggestion()) submitHomeHero(); }
      else submitHomeHero();
    }
  });

  homeHeroSubmitBtn?.addEventListener('click', submitHomeHero);
  homeHeroDropdown.addEventListener('keydown', (e) => {
    const rows = [...homeHeroDropdown.querySelectorAll('.hero-dd-row')];
    const i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i > -1) { e.preventDefault(); rows[Math.min(i + 1, rows.length - 1)].focus(); }
    if (e.key === 'ArrowUp' && i > -1) { e.preventDefault(); (i === 0 ? homeHeroInput : rows[i - 1]).focus(); }
    if (e.key === 'Enter' && document.activeElement?.classList.contains('hero-dd-row') && document.activeElement.tagName !== 'A') { e.preventDefault(); document.activeElement.click(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openFirstSuggestion(); }
    if (e.key === 'Escape') { homeHeroDropdown.hidden = true; homeHeroInput.focus(); }
  });

  homeHeroDropdown.addEventListener('click', (e) => {
    const deviceRow = e.target.closest('.hero-dd-device');
    if (deviceRow && heroDevice) { openDevice(heroDevice); return; }
    const aiRow = e.target.closest('.hero-dd-ai');
    if (aiRow) askFromHome(aiRow.dataset.aiPrompt || homeHeroInput.value.trim());
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
for (const id of ['home-tool-count']) {
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
    .map((t, i) => `
      <a class="home-quick-item lp-chip" href="#${t.id}" style="--k:${i}">
        <span class="home-quick-icon">${t.icon}</span>
        <span>${escapeHtml(t.name)}</span>
      </a>`).join('');
}
renderQuickRow();

/* Each area of Toolbox has its own colour and emblem, used on its orbit tile and its card. */
const TASK_LOOK = {
  files: [214, '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>'],
  numbers: [152, '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  writing: [32, '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'],
  lookup: [188, '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'],
  everyday: [42, '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  design: [292, '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/><path d="M12 21a3 3 0 0 1 0-6h1.5a2.5 2.5 0 0 0 0-5"/>'],
  law: [6, '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>'],
  science: [262, '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>'],
  code: [230, '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14"/>'],
};
const taskLook = (id) => TASK_LOOK[id] || [214, '<circle cx="12" cy="12" r="8"/>'];
const taskIcon = (id, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${taskLook(id)[1]}</svg>`;
const homeTasks = byTask(TOOLS);

/* Hero: the areas orbit the question, joined to it by tethers (motion in js/home-scroll.js). */
(function renderHomeOrbit() {
  const orbit = document.querySelector('.lp-orbit');
  const tethers = document.querySelector('.lp-tethers');
  if (!orbit || !tethers) return;
  const n = homeTasks.length;
  const spots = homeTasks.map((task, i) => {
    // Start just right of the top and go round; the ellipse keeps tiles clear of the centre.
    const theta = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
    return { task, x: +(Math.cos(theta) * 41).toFixed(2), y: +(Math.sin(theta) * 40).toFixed(2) };
  });
  tethers.innerHTML = spots.map(({ task, x, y }) => `<line x1="50" y1="50" x2="${50 + x}" y2="${50 + y}" style="--hue:${taskLook(task.id)[0]}"/>`).join('');
  orbit.innerHTML = spots.map(({ task, x, y }, i) => `
    <a class="lp-tile" href="#home-task-${task.id}" data-task="${task.id}" style="--x:${x}%;--y:${y}%;--hue:${taskLook(task.id)[0]};--order:${i}">
      <span class="lp-ico">${taskIcon(task.id, 16)}</span>
      <strong>${escapeHtml(task.label)}</strong>
      <span class="lp-meta"><b class="lp-count" data-count="${task.tools.length}">${task.tools.length}</b> tools</span>
    </a>`).join('');
})();

/* The task lens. Categories answer "what subject is this?"; the home page
   has to answer "what am I trying to do?", which is a different question
   and the only one a first-time visitor is actually asking. */
const taskGrid = $('home-tasks');
if (taskGrid) {
  taskGrid.innerHTML = homeTasks.map((task, i) => `
    <section class="lp-card" id="home-task-${task.id}" style="--hue:${taskLook(task.id)[0]};--order:${i}">
      <div class="lp-card-top"><span class="lp-ico">${taskIcon(task.id, 17)}</span><h3 class="lp-card-label">${escapeHtml(task.label)}</h3><span class="lp-pill"><b class="lp-count" data-count="${task.tools.length}">${task.tools.length}</b></span></div>
      <p class="lp-card-blurb">${escapeHtml(task.blurb)}</p>
      <div class="lp-card-tools">
        ${task.tools.slice(0, 6).map(t => `
          <a class="lp-tool" href="#${t.id}">
            <span class="lp-tool-icon">${t.icon}</span>
            <span>${escapeHtml(t.name)}</span>
          </a>`).join('')}
      </div>
      <a class="lp-card-more" href="#tools">All ${task.tools.length} ${uiIcon('chevron-right')}</a>
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
      ? items.slice(0, 6).map((m, i) => `
          <a class="lp-file" href="#saved/${m.id}" style="--tint:${getFileTypeColor(m.name, m.kind)};--order:${i}">
            <span class="lp-file-icon">${getFileTypeIcon(m.name, m.kind, 40)}</span>
            <span class="lp-file-text"><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(kindLabel(m.kind))}</small></span>
          </a>`).join('')
      : `<div class="empty-state lp-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <strong>Nothing saved yet</strong>
          <span>Converted files and exports you keep will show up here.</span>
        </div>`;
  }
}

artifacts.onChange(reflectSavedWork);
reflectSavedWork();

/* At a glance: counted from the registry and storage, never typed in. */
function renderHomeStats() {
  const el = document.querySelector('.lp-stats');
  if (!el) return;
  const stat = (n, label, hint, hue) => `<div class="lp-stat" style="--hue:${hue}"><strong class="lp-count" data-count="${n}">${n}</strong><span>${label}</span><small>${hint}</small></div>`;
  el.innerHTML = stat(TOOLS.length, 'Tools', 'One place for the small jobs', 214)
    + stat(OFFLINE_TOOLS.length, 'Work offline', 'Nothing leaves your browser', 152)
    + stat(homeTasks.length, 'Areas', 'From files to law to code', 262)
    + stat(artifacts.list().length, 'Saved files', 'Kept in this browser', 32);
}
renderHomeStats();
artifacts.onChange(renderHomeStats);


// Right-click menus for tool links, the open tool and the page (js/lib/global-menus.js).
installLongPress();
// Files behave the same everywhere: drag, Space to preview, the file menu (before the page menu).
installFileSurface();
installGlobalMenus({ getTool: () => (currentPage === 'tool' && currentToolObj ? { tool: currentToolObj, instance: currentToolInstance } : null) });
installTextActions();
installAssistantShortcut();

initTheme();
installMotion();

installSettingsUI();
initSupporterProfile();
installHeaderMenu();
initMessageNotifications();
startReminderClock();
startAutomationClock();
// Signed-in visitors usually ask the Assistant something: wake its service early, off the critical path.
if (getCurrentUser()) (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(() => {
  import('./lib/model-gateway.js').then(m => m.warmGateway()).catch(() => {});
  // Fetch the Assistant's code ahead of time, so the pop-up opens and answers without a download.
  if (!navigator.connection?.saveData) import('./tools/assistant.js').catch(() => {});
}, { timeout: 6000 });
  initWorkspace({ main: () => ({ id: currentPage === 'tool' ? currentToolId : null, instance: currentToolInstance, host: viewportContent }) });
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

// Assistant evaluation harness (js/lib/assistant/eval/README.md). Lazy: nothing loads until called.
window.toolboxEvalLoad = () => import('./lib/assistant/eval/runner.js');
if (/assistant-eval/.test(window.location.search) || window.__TOOLBOX_EVAL__) {
  window.toolboxEvalLoad().then((m) => { window.toolboxEval = { run: m.run, cases: m.cases }; }).catch(() => {});
}

