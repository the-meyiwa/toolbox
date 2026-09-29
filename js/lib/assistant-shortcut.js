import { shouldInvokeAssistant } from './text-action-policy.js';

export function installAssistantShortcut() {
  if (window.__toolboxAssistantShortcut) return;
  window.__toolboxAssistantShortcut = true;
  // Bubble at window: editors and other tools have first refusal.
  window.addEventListener('keydown', (event) => {
    const blockedOverlay = !!document.querySelector('.custom-dialog-backdrop, .settings-overlay:not([hidden]), #toolbox-context-menu, .sv-modal-backdrop, [aria-modal="true"]:not([hidden])');
    if (!shouldInvokeAssistant(event, { activeElement: document.activeElement, hash: location.hash, blockedOverlay })) return;
    event.preventDefault();
    import('./assistant-popup.js').then(m => m.toggleAssistant());
  });
}
