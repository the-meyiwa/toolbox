import { escapeHtml } from './biz.js';
let current = null;

/** One lightweight, themed text utility panel with a shared dismissal lifecycle. */
export function openTextPopup(title, { onClose = () => {} } = {}) {
  current?.close();
  const previous = document.activeElement;
  const panel = document.createElement('section');
  panel.className = 'tb-text-popup';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = `<header class="tb-text-popup-head"><strong>${escapeHtml(title)}</strong><button type="button" class="asp-btn" aria-label="Close ${escapeHtml(title)}" title="Close (Esc)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="tb-text-popup-body"></div>`;
  document.body.appendChild(panel);
  const close = () => {
    if (!panel.isConnected) return;
    onClose(); panel.remove();
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('hashchange', close);
    window.removeEventListener('toolbox:authchange', close);
    if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    if (current?.element === panel) current = null;
  };
  const keydown = e => {
    if (e.key === 'Escape' && !document.querySelector('#toolbox-context-menu')) { e.preventDefault(); e.stopPropagation(); close(); }
  };
  panel.querySelector('button').addEventListener('click', close);
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('hashchange', close);
  window.addEventListener('toolbox:authchange', close);
  current = { element: panel, body: panel.querySelector('.tb-text-popup-body'), close };
  return current;
}
