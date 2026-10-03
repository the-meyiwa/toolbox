import { shouldInvokeAssistant } from './text-action-policy.js';

/* Two ways to the Assistant from the keyboard:
   Ctrl/Cmd+K  everywhere, always a pop-up over the page, bringing what is open as context
               (js/lib/assistant-context.js); pressed again, it closes.
   Alt+X       the older shortcut, where no editor or dialog wants the key. */
export function installAssistantShortcut() {
  if (window.__toolboxAssistantShortcut) return;
  window.__toolboxAssistantShortcut = true;
  preloadWhenIdle();
  // Capture: Ctrl/Cmd+K is Toolbox's before any tool's.
  window.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.repeat || event.isComposing) return;
    if (event.code !== 'KeyK' && String(event.key).toLowerCase() !== 'k') return;
    event.preventDefault();
    event.stopPropagation();
    toggleWithContext();
  }, true);
  // Bubble at window: editors and other tools have first refusal.
  window.addEventListener('keydown', (event) => {
    const blockedOverlay = !!document.querySelector('.custom-dialog-backdrop, .settings-overlay:not([hidden]), #toolbox-context-menu, .sv-modal-backdrop, [aria-modal="true"]:not([hidden])');
    if (!shouldInvokeAssistant(event, { activeElement: document.activeElement, hash: location.hash, blockedOverlay })) return;
    event.preventDefault();
    import('./assistant-popup.js').then(m => m.toggleAssistant());
  });
}

/* The Assistant is a large module. For someone signed in, fetch it (and wake the gateway's
   connection) while the browser is idle, so Ctrl/Cmd+K and the first message open at once. */
function preloadWhenIdle() {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
  idle(async () => {
    try {
      const { getCurrentUser } = await import('./supabase.js');
      if (!getCurrentUser()) return;
      import('../tools/assistant.js').catch(() => {});
      import('./model-gateway.js').then(m => m.warmGateway()).catch(() => {});
    } catch { /* offline: it loads on first use */ }
  }, { timeout: 6000 });
}

let opening = false;
async function toggleWithContext() {
  if (opening) return;
  opening = true;
  try {
    const popup = await import('./assistant-popup.js');
    if (popup.isAssistantOpen()) { popup.closeAssistant(); return; }
    // The module, the gateway and the context are fetched together, not one after another.
    import('../tools/assistant.js').catch(() => {});
    import('./model-gateway.js').then(m => m.warmGateway()).catch(() => {});
    const { collectContext } = await import('./assistant-context.js');
    const context = await collectContext().catch(() => null);
    await popup.openAssistant({ context, send: false, forcePopup: true });
  } finally {
    opening = false;
  }
}
