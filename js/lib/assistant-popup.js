/* ============================================================
   TOOLBOX — Assistant pop-up

   "Ask Assistant" anywhere in Toolbox opens the Assistant in a
   floating panel over the current page (a full-screen sheet on
   phones) instead of switching to the Assistant tool. It is the
   same Assistant, chats and all: "Open full page" continues the
   conversation in the tool.

   openAssistant({ prompt, artifact, send })
     prompt   — question to ask (sent straight away when signed in)
     artifact — { from: 'ask-assistant', file, prompt } to attach a file
   ============================================================ */

import { getCurrentUser } from './supabase.js';
import { getSetting } from './settings.js';

let panel = null;
let body = null;
let mod = null;          // the Assistant tool module
let mounted = false;
let lastFocus = null;

const ICONS = {
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/>',
  expand: '<path d="M14 4h6v6"/><path d="M20 4l-7 7"/><path d="M10 20H4v-6"/><path d="M4 20l7-7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const svg = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

const onAssistantPage = () => /^#assistant(\/|$)/.test(window.location.hash || '');

function build() {
  panel = document.createElement('section');
  panel.className = 'asp';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Assistant');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="asp-head">
      <span class="asp-mark">${svg(ICONS.spark)}</span>
      <strong class="asp-title">Assistant</strong>
      <span class="beta-badge" title="The Assistant is in beta: answers can be wrong, so check anything important.">Beta</span>
      <span class="asp-space"></span>
      <button type="button" class="asp-btn" data-asp="expand" aria-label="Open the full Assistant" title="Open full page">${svg(ICONS.expand)}</button>
      <button type="button" class="asp-btn" data-asp="close" aria-label="Close the Assistant" title="Close (Esc)">${svg(ICONS.close)}</button>
    </header>
    <div class="asp-body"></div>`;
  document.body.appendChild(panel);
  body = panel.querySelector('.asp-body');

  panel.addEventListener('click', (e) => {
    const act = e.target.closest('[data-asp]')?.dataset.asp;
    if (act === 'close') closeAssistant();
    if (act === 'expand') {
      // Keep the live request attached to this tab. The full page adopts its
      // existing chat view when the route opens.
      if (getSetting('assistantNewTab') && openAssistantTab()) {
        closeAssistant({ restoreFocus: false });
      } else {
        window.location.hash = '#assistant';
      }
    }
  });
  panel.addEventListener('keydown', (e) => {
    // Escape closes the panel unless a menu or dialog inside it is using it.
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (panel.querySelector('.ast-pop:not([hidden])') || document.querySelector('body > .ast-ctx')) return;
    e.preventDefault();
    closeAssistant();
  });
  // The whole panel takes files: from the computer, or dragged from the Toolbox Files app.
  // Drops on the chat itself are handled by the Assistant; anywhere else on the panel
  // (header, edges) is forwarded to it.
  const carriesFiles = (e) => { const t = [...(e.dataTransfer?.types || [])]; return t.includes('Files') || t.includes('application/toolbox-path'); };
  let depth = 0;
  panel.addEventListener('dragenter', (e) => { if (!carriesFiles(e)) return; e.preventDefault(); depth++; panel.classList.add('is-drop'); });
  panel.addEventListener('dragover', (e) => { if (!carriesFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  panel.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) panel.classList.remove('is-drop'); });
  panel.addEventListener('drop', (e) => {
    depth = 0;
    panel.classList.remove('is-drop');
    if (!carriesFiles(e) || e.defaultPrevented) return;   // the Assistant already took it
    e.preventDefault();
    const paths = (e.dataTransfer.getData('application/toolbox-path') || '').split('\n').map(x => x.trim()).filter(Boolean);
    window.dispatchEvent(new CustomEvent('toolbox:assistant-drop', { detail: { files: [...(e.dataTransfer.files || [])], paths } }));
  });
  // The full Assistant page takes over the same chat.
  // A button in the chat that opens a tool ("Open in Maps", "Open in Mail"…) is followed by
  // a route change: step aside so the person sees that tool. The chat is kept for next time.
  let clickedInside = 0;
  panel.addEventListener('click', () => { clickedInside = Date.now(); }, true);
  const toolOpenedFromChat = () => isAssistantOpen() && Date.now() - clickedInside < 1500;
  window.addEventListener('hashchange', () => {
    if ((onAssistantPage() || toolOpenedFromChat()) && isAssistantOpen()) closeAssistant({ restoreFocus: false });
  });
  window.addEventListener('toolbox:maps-handoff', () => { if (toolOpenedFromChat()) closeAssistant({ restoreFocus: false }); });
}

/** Opens the full Assistant in a new browser tab. False if the browser blocked it. */
export function openAssistantTab() {
  const w = window.open(`${window.location.pathname}${window.location.search}#assistant`, '_blank');
  if (!w) return false;
  try { w.opener = null; } catch { /* cross-origin guard */ }
  return true;
}

export const isAssistantOpen = () => !!panel && !panel.hidden;

function popupEnabled() {
  try { return JSON.parse(localStorage.getItem('toolbox_settings') || '{}').assistantPopup !== false; } catch { return true; }
}

/* Pop-up off: the question (and any file) goes with the Assistant to its own tab. This tab
   leaves a short-lived id in localStorage; the new tab claims it and asks for the rest over
   a BroadcastChannel, which carries File objects as they are. */
const HANDOFF_KEY = 'toolbox_assistant_handoff';
const HANDOFF_CHANNEL = 'toolbox-assistant-handoff';

function handOff(ask) {
  if (typeof BroadcastChannel === 'undefined') return null;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const ch = new BroadcastChannel(HANDOFF_CHANNEL);
  const cancel = () => { clearTimeout(timer); ch.close(); };
  const timer = setTimeout(cancel, 30_000);
  ch.onmessage = ({ data }) => {
    if (data?.want !== id) return;
    try { ch.postMessage({ id, ask }); } catch { ch.postMessage({ id, ask: { prompt: ask.prompt, send: ask.send } }); }
    cancel();
  };
  try { localStorage.setItem(HANDOFF_KEY, JSON.stringify({ id, at: Date.now() })); } catch { cancel(); return null; }
  return { cancel: () => { cancel(); try { localStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ } } };
}

/** On a freshly opened Assistant tab: the question another tab sent with it, or null. */
export function claimHandoff() {
  let rec = null;
  try { rec = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null'); if (rec) localStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ }
  if (!rec?.id || !(Date.now() - rec.at < 20_000) || typeof BroadcastChannel === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new BroadcastChannel(HANDOFF_CHANNEL);
    const finish = (v) => { clearTimeout(t); ch.close(); resolve(v); };
    const t = setTimeout(() => finish(null), 4000);
    ch.onmessage = ({ data }) => { if (data?.id === rec.id) finish(data.ask || null); };
    ch.postMessage({ want: rec.id });
  });
}

export async function openAssistant({ prompt = '', artifact = null, send = true } = {}) {
  // Already on the Assistant page: hand the question to it.
  if (onAssistantPage()) {
    window.dispatchEvent(new CustomEvent('toolbox:assistant-ask', { detail: { prompt, artifact, send } }));
    return;
  }
  // Settings → Assistant → pop-up off: use this tab unless the person chose a new tab.
  if (!popupEnabled()) {
    if (getCurrentUser()) {
      if (getSetting('assistantNewTab')) {
        const handoff = prompt || artifact ? handOff({ prompt, artifact, send }) : null;
        if (openAssistantTab()) return;
        handoff?.cancel();
      }
    }
    window.__toolboxQueuedAsk = { prompt, artifact, send, at: Date.now() };
    window.location.hash = '#assistant';
    return;
  }
  if (!panel) build();
  // A prior popup chat may have moved into the full-page viewport.
  if (mounted && !body.querySelector('.ast')) mounted = false;
  const wasOpen = isAssistantOpen();
  if (!wasOpen) lastFocus = document.activeElement;
  panel.hidden = false;
  document.body.classList.add('has-assistant-popup');
  requestAnimationFrame(() => panel.classList.add('is-open'));
  mod = mod || (await import('../tools/assistant.js')).default;
  if (!mounted) {
    mounted = true;
    mod.render(body, { compact: true, prompt, send, artifact });
  } else if (prompt || artifact) {
    window.dispatchEvent(new CustomEvent('toolbox:assistant-ask', { detail: { prompt, artifact, send } }));
  } else if (!wasOpen) {
    // Reopened: the Assistant decides (per Settings) whether to start fresh.
    window.dispatchEvent(new CustomEvent('toolbox:assistant-reopened'));
    body.querySelector('.ast-input')?.focus({ preventScroll: true });
  } else {
    body.querySelector('.ast-input')?.focus({ preventScroll: true });
  }
}

export function closeAssistant({ restoreFocus = true } = {}) {
  if (!panel || panel.hidden) return;
  panel.classList.remove('is-open');
  panel.hidden = true;
  document.body.classList.remove('has-assistant-popup');
  // Keep the mounted chat alive while hidden. Streaming work and tool calls
  // remain attached, and reopening the popup shows the same live request.
  if (restoreFocus && lastFocus?.isConnected) lastFocus.focus?.({ preventScroll: true });
}

export function toggleAssistant() {
  if (isAssistantOpen()) closeAssistant(); else openAssistant();
}
