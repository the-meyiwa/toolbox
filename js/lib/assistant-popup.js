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
    if (act === 'expand') { closeAssistant({ restoreFocus: false }); window.location.hash = '#assistant'; }
  });
  panel.addEventListener('keydown', (e) => {
    // Escape closes the panel unless a menu or dialog inside it is using it.
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (panel.querySelector('.ast-pop:not([hidden])') || document.querySelector('body > .ast-ctx')) return;
    e.preventDefault();
    closeAssistant();
  });
  // The full Assistant page takes over the same chat.
  window.addEventListener('hashchange', () => { if (onAssistantPage() && isAssistantOpen()) closeAssistant({ restoreFocus: false }); });
}

export const isAssistantOpen = () => !!panel && !panel.hidden;

export async function openAssistant({ prompt = '', artifact = null, send = true } = {}) {
  // Already on the Assistant page: hand the question to it.
  if (onAssistantPage()) {
    window.dispatchEvent(new CustomEvent('toolbox:assistant-ask', { detail: { prompt, artifact, send } }));
    return;
  }
  if (!panel) build();
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
  } else {
    body.querySelector('.ast-input')?.focus({ preventScroll: true });
  }
}

export function closeAssistant({ restoreFocus = true } = {}) {
  if (!panel || panel.hidden) return;
  panel.classList.remove('is-open');
  panel.hidden = true;
  document.body.classList.remove('has-assistant-popup');
  // Only tear down our own instance: the page may already have mounted its own.
  if (mounted && !onAssistantPage()) { try { mod?.destroy?.(); } catch { /* ignore */ } }
  mounted = false;
  body.innerHTML = '';
  if (restoreFocus && lastFocus?.isConnected) lastFocus.focus?.({ preventScroll: true });
}

export function toggleAssistant() {
  if (isAssistantOpen()) closeAssistant(); else openAssistant();
}
