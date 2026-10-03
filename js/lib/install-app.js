/* ============================================================
   TOOLBOX — Install as an app

   - The banner on Home, just above the footer: shown only in a
     plain browser tab, never once Toolbox is installed.
   - The panel it opens (also reachable from Settings): the browser's
     own install prompt when it has offered one, and an animated guide
     on a drawn phone or computer for everything else, opening on the
     steps for this device. Phone and computer guides sit side by side.
   ============================================================ */

import { detectEnvironment, installTarget, isWebApp, canPromptInstall, promptInstall, onInstallStateChange } from './web-app.js';
import { GUIDES, guideFlows, mountGuide } from './install-guide.js';
import { pushBack } from './back-stack.js';

const SNOOZE_KEY = 'toolbox_install_banner_until';
const SNOOZE_MS = 7 * 86400_000;
const OUT = 'cubic-bezier(.22, 1, .36, 1)';

const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const MARK = '<svg class="ia-mark" viewBox="0 0 12 10" aria-hidden="true"><path d="M4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM3 1h1v1h-1zM8 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM9 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM11 3h1v1h-1zM0 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM11 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM11 5h1v1h-1zM0 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM11 6h1v1h-1zM0 7h1v1h-1zM11 7h1v1h-1zM0 8h1v1h-1zM11 8h1v1h-1zM0 9h1v1h-1zM1 9h1v1h-1zM2 9h1v1h-1zM3 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM6 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1z" fill="currentColor"/></svg>';
const appIcon = (cls = '') => `<span class="ia-appicon ${cls}">${MARK}</span>`;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const readSnooze = () => { try { return Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; } };
const writeSnooze = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ } };

/* ---------------- the panel ---------------- */

let open = null;

/**
 * Opens the install panel. `family` ('phone' | 'computer') and `flow` pick what it opens on;
 * by default it opens on this device's own steps.
 */
export function openInstallGuide({ family, flow } = {}) {
  if (open) return open.focus();
  const env = detectEnvironment();
  const target = installTarget(env);
  let currentFamily = family || target.family;
  let currentFlow = flow && GUIDES[flow] ? flow : (GUIDES[target.flow]?.family === currentFamily ? target.flow : guideFlows(currentFamily)[0]?.id);
  if (target.blocked === 'in-app' && !family && !flow) { currentFamily = 'phone'; currentFlow = 'inapp'; }
  const opener = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'ia-backdrop';
  backdrop.innerHTML = `
    <div class="ia-modal" role="dialog" aria-modal="true" aria-labelledby="ia-title" tabindex="-1">
      <button type="button" class="ia-x" aria-label="Close">${ICON_X}</button>
      <header class="ia-head">${appIcon()}<div><h2 id="ia-title">Install Toolbox</h2><p>Open it from your home screen or Dock, full screen, like any other app.</p></div></header>
      <div class="ia-body"></div>
    </div>`;
  document.body.appendChild(backdrop);
  const modal = backdrop.querySelector('.ia-modal');
  const body = backdrop.querySelector('.ia-body');
  let guide = null;
  let closed = false;

  function renderDone() {
    guide?.destroy(); guide = null;
    body.innerHTML = `<div class="ia-done">${appIcon()}<h3>Toolbox is installed</h3><p>${isWebApp() ? 'You are using it as an app right now.' : 'Open it from your home screen, Dock or Start menu.'}</p></div>
      <div class="ia-foot"><div class="ia-foot-row"><button type="button" class="ia-primary" data-act="close">Done</button></div></div>`;
  }

  function render() {
    if (isWebApp()) { renderDone(); return; }
    const flows = guideFlows(currentFamily);
    if (!flows.some(f => f.id === currentFlow)) currentFlow = flows[0]?.id;
    // This device's own flow first.
    const here = target.family === currentFamily ? target.flow : null;
    const ordered = [...flows].sort((a, b) => (a.id === here ? -1 : b.id === here ? 1 : 0));
    const native = canPromptInstall();
    const flow = GUIDES[currentFlow];
    body.innerHTML = `
      <div class="ia-tabs" role="tablist" data-family="${currentFamily}" aria-label="Device">
        <span class="ia-tab-pill" aria-hidden="true"></span>
        <button type="button" role="tab" class="ia-tab${target.family === 'phone' ? ' is-here' : ''}" data-family="phone" aria-selected="${currentFamily === 'phone'}">Phone &amp; tablet</button>
        <button type="button" role="tab" class="ia-tab${target.family === 'computer' ? ' is-here' : ''}" data-family="computer" aria-selected="${currentFamily === 'computer'}">Computer</button>
      </div>
      <div class="ia-chips" role="group" aria-label="Browser">${ordered.map(f => `<button type="button" class="ia-chip" data-flow="${f.id}" aria-pressed="${f.id === currentFlow}">${esc(f.label)}</button>`).join('')}</div>
      <p class="ia-flow-note">${esc(flow?.note || '')}</p>
      <div class="ia-host"></div>
      <div class="ia-foot">
        <div class="ia-foot-row">
          ${native ? '<button type="button" class="ia-primary" data-act="native">Install Toolbox</button><button type="button" class="ia-ghost" data-act="close">Not now</button>'
            : '<button type="button" class="ia-primary" data-act="close">Got it</button>'}
          ${target.blocked ? '<button type="button" class="ia-ghost" data-act="copy">Copy link</button>' : ''}
        </div>
        ${native ? '<p class="ia-fine">Or follow the steps above if you prefer to do it yourself.</p>' : ''}
      </div>`;
    guide?.destroy();
    guide = mountGuide(body.querySelector('.ia-host'), currentFlow);
  }

  function close() {
    if (closed) return;
    closed = true;
    unregister();
    document.removeEventListener('keydown', onKey, true);
    offState();
    guide?.destroy();
    backdrop.classList.remove('is-open');
    const done = () => { backdrop.remove(); open = null; try { opener?.focus?.({ preventScroll: true }); } catch { /* gone */ } };
    if (reduced()) done(); else setTimeout(done, 380);
  }
  const unregister = pushBack(close);
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  const offState = onInstallStateChange(() => { if (!closed) render(); });
  window.addEventListener('toolbox:appinstalled', renderDone, { once: true });

  backdrop.addEventListener('click', async (e) => {
    if (e.target === backdrop) { close(); return; }
    const tab = e.target.closest('.ia-tab');
    const chip = e.target.closest('.ia-chip');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (e.target.closest('.ia-x')) { close(); return; }
    if (tab && tab.dataset.family !== currentFamily) {
      currentFamily = tab.dataset.family;
      currentFlow = target.family === currentFamily ? target.flow : guideFlows(currentFamily)[0]?.id;
      render();
    } else if (chip && chip.dataset.flow !== currentFlow) {
      currentFlow = chip.dataset.flow;
      render();
    } else if (act === 'close') close();
    else if (act === 'native') {
      const result = await promptInstall();
      if (result === 'accepted') renderDone();
    } else if (act === 'copy') {
      try { await navigator.clipboard.writeText(location.origin); e.target.closest('[data-act]').textContent = 'Copied'; } catch { /* clipboard blocked */ }
    }
  });

  render();
  requestAnimationFrame(() => { backdrop.classList.add('is-open'); modal.focus({ preventScroll: true }); });
  open = { focus: () => modal.querySelector('.ia-x')?.focus(), close };
  return open;
}

/* ---------------- the banner on Home ---------------- */

/**
 * Fills `wrap` with the Add to home screen banner when Toolbox is open in a plain browser tab,
 * and empties it when it is installed or the person has put it off. Re-checks itself when the
 * display mode or the browser's install state changes.
 */
export function mountInstallBanner(wrap) {
  if (!wrap) return;
  let shown = false;
  const wanted = () => !isWebApp() && Date.now() > readSnooze() && !document.documentElement.classList.contains('standalone-embed');

  function paint() {
    const want = wanted();
    if (!want) {
      if (shown) { wrap.hidden = true; wrap.innerHTML = ''; shown = false; }
      return;
    }
    const native = canPromptInstall();
    const label = native ? 'Install' : 'Show me how';
    if (shown) { const cta = wrap.querySelector('.ia-banner-cta'); if (cta) cta.textContent = label; return; }
    shown = true;
    wrap.hidden = false;
    wrap.innerHTML = `<aside class="ia-banner is-in" aria-label="Install Toolbox">
      <span class="ia-banner-icon">${appIcon()}</span>
      <div class="ia-banner-copy"><b>Install Toolbox</b><span>Open it from your home screen or Dock, full screen, like any other app.</span></div>
      <button type="button" class="lp-btn ia-banner-cta">${label}</button>
      <button type="button" class="ia-banner-x" aria-label="Not now" title="Not now">${ICON_X}</button>
    </aside>`;
  }

  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('.ia-banner-x')) {
      writeSnooze();
      const el = wrap.querySelector('.ia-banner');
      const done = () => { shown = false; wrap.hidden = true; wrap.innerHTML = ''; };
      if (!el || reduced() || !el.animate) { done(); return; }
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 280, easing: OUT, fill: 'forwards' }).finished.then(done, done);
      return;
    }
    if (e.target.closest('.ia-banner-cta')) {
      // One tap when the browser has offered its own prompt; otherwise the animated steps.
      if (canPromptInstall()) { const r = await promptInstall(); if (r !== 'unavailable') return; }
      openInstallGuide();
    }
  });
  onInstallStateChange(paint);
  window.addEventListener('toolbox:appinstalled', paint);
  paint();
}
