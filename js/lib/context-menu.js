/* ============================================================
   TOOLBOX — Unified Context Menu Engine
   Shared between Files, Notes, and other Toolbox modules.
   Guarantees no item overlap, text wrapping fixes, and smart
   viewport boundary collision detection.
   ============================================================ */

import { removeMenu } from './menu-motion.js';
let activeMenu = null;

/* ---- Native menu guard ----------------------------------------------
   Toolbox draws its own menus, so the browser's menu must never appear
   on top of them. Two cases slipped through before:
   1. Openers that react to pointerup (the 3D viewer, so a right-drag can
      still pan) or to a touch long-press. On Windows the `contextmenu`
      event fires *after* mouseup, and by then our menu is sitting under
      the cursor, so the event targets the menu itself - an element no
      opener listens on - and the native menu opened over ours.
   2. Right-clicking inside an open Toolbox menu.
   One capture listener covers every menu in the app (the shared engine
   plus the Files and Playground menus). Editable fields are left alone
   so copy/paste/spellcheck still work there. */
const TOOLBOX_MENU_SELECTOR = '#toolbox-context-menu, #sv-finder-menu, #cpg-ctx-menu, .finder-context-menu';
const SAME_GESTURE_MS = 600;
let lastMenuOpenedAt = -Infinity;

function isEditableTarget(el) {
  return Boolean(el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'));
}

function eventElement(e) {
  const t = e.target;
  return t instanceof Element ? t : t?.parentElement || null;
}

function justOpenedMenu() {
  return performance.now() - lastMenuOpenedAt < SAME_GESTURE_MS && document.querySelector(TOOLBOX_MENU_SELECTOR);
}

if (typeof window !== 'undefined' && !window.__toolboxNativeMenuGuard) {
  window.__toolboxNativeMenuGuard = true;
  window.addEventListener('contextmenu', (e) => {
    const el = eventElement(e);
    if (!el) return;
    if (isEditableTarget(el)) return;
    if (el.closest(TOOLBOX_MENU_SELECTOR)) { e.preventDefault(); return; }
    if (justOpenedMenu()) e.preventDefault();
  }, true);
  // Menus built outside this engine (Files, Playground) are stamped as they
  // mount; observer callbacks run before the next input event is dispatched.
  const stamp = (records) => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType === 1 && n.matches(TOOLBOX_MENU_SELECTOR)) lastMenuOpenedAt = performance.now();
    }
  };
  const observe = () => new MutationObserver(stamp).observe(document.body, { childList: true });
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
}

/**
 * Open a styled context menu
 * @param {Object} options
 * @param {number} options.x - Cursor X coordinate
 * @param {number} options.y - Cursor Y coordinate
 * @param {string} [options.title] - Optional header title
 * @param {Array<Object>} options.items - Menu action items
 */
export function openContextMenu({ x, y, title = '', items = [], className = '', focusFirst = false, label = '' }) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'toolbox-context-menu';
  menu.className = `finder-context-menu ${className}`.trim();
  menu.setAttribute('role', 'menu');
  if (label || title) menu.setAttribute('aria-label', label || title);

  let html = '';
  if (title) {
    html += `<div class="finder-menu-title">${escapeHtml(title)}</div>`;
  }

  items.forEach((item, index) => {
    if (item.separator) {
      html += '<div class="finder-menu-separator"></div>';
      return;
    }
    if (item.customHtml) {
      html += item.customHtml;
      return;
    }
    if (item.heading) {
      html += `<div class="finder-menu-heading" role="presentation">${escapeHtml(item.heading)}</div>`;
      return;
    }

    html += `
      <div class="finder-menu-item ${item.destructive ? 'destructive' : ''}" data-item-index="${index}" role="menuitem" tabindex="0"${item.disabled ? ' aria-disabled="true"' : ''}${item.hint ? ` title="${escapeHtml(item.hint)}"` : ''}>
        <div class="finder-menu-item-left">
          ${item.icon ? `<span class="finder-menu-icon">${item.icon}</span>` : ''}
          <span class="finder-menu-label">${escapeHtml(item.label || '')}</span>
        </div>
        ${item.shortcut ? `<span class="finder-menu-shortcut">${escapeHtml(item.shortcut)}</span>` : ''}
      </div>
    `;
  });

  lastMenuOpenedAt = performance.now();
  menu.innerHTML = html;
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);

  // Smart Viewport Collision Detection
  // Layout size, not getBoundingClientRect: the open animation starts the
  // menu scaled and tilted, which under-measures it and lets the bottom of a
  // tall menu run off the screen.
  const box = menu.getBoundingClientRect();
  const rect = { width: menu.offsetWidth || box.width, height: menu.offsetHeight || box.height };
  const margin = 10;
  let left = x;
  let top = y;

  if (left + rect.width > window.innerWidth - margin) {
    left = window.innerWidth - rect.width - margin;
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = window.innerHeight - rect.height - margin;
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';
  if (focusFirst) menu.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();

  // Event handlers
  const onMenuClick = (e) => {
    const itemEl = e.target.closest('[data-item-index]');
    if (itemEl) {
      const idx = parseInt(itemEl.dataset.itemIndex, 10);
      const item = items[idx];
      if (item && !item.disabled && typeof item.action === 'function') {
        closeContextMenu();
        item.action();
      }
    }
  };

  const onGlobalPointerDown = (e) => {
    if (!menu.contains(e.target)) {
      closeContextMenu();
    }
  };

  // A right-click elsewhere closes this menu - but not the very event that
  // belongs to the gesture which opened it (Windows fires it after mouseup).
  const onGlobalContextMenu = (e) => {
    const el = eventElement(e);
    if (el && menu.contains(el)) return;
    if (performance.now() - lastMenuOpenedAt < SAME_GESTURE_MS && el && !isEditableTarget(el)) return;
    closeContextMenu();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeContextMenu();
    }
    const entries = [...menu.querySelectorAll('[role="menuitem"]')];
    const index = entries.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? entries.length - 1
        : (index + (e.key === 'ArrowUp' ? -1 : 1) + entries.length) % entries.length;
      entries[next]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (index >= 0) { e.preventDefault(); entries[index].click(); }
    }
  };

  menu.addEventListener('click', onMenuClick);
  // Delay global listeners so the triggering click doesn't instantly dismiss
  const listenerTimer = setTimeout(() => {
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    window.addEventListener('contextmenu', onGlobalContextMenu, true);
    window.addEventListener('scroll', closeContextMenu, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown, true);
  }, 10);

  activeMenu = {
    element: menu,
    cleanup: () => {
      clearTimeout(listenerTimer);
      window.removeEventListener('pointerdown', onGlobalPointerDown, true);
      window.removeEventListener('contextmenu', onGlobalContextMenu, true);
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('keydown', onKeyDown, true);
      removeMenu(menu);
    }
  };
}

export function closeContextMenu() {
  if (activeMenu) {
    activeMenu.cleanup();
    activeMenu = null;
  }
  const existing = document.getElementById('toolbox-context-menu');
  if (existing) existing.remove();
  const legacy = document.getElementById('sv-finder-menu');
  if (legacy) removeMenu(legacy);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
