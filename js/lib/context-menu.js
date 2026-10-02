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
let lastOpenPoint = null;

/** True while a menu opened by the current gesture is on screen (long-press handlers use it). */
export function menuOpenedRecently(ms = SAME_GESTURE_MS) {
  return performance.now() - lastMenuOpenedAt < ms && Boolean(document.querySelector(TOOLBOX_MENU_SELECTOR));
}

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
export function openContextMenu({ x, y, title = '', items = [], className = '', focusFirst = false, label = '', presentation = 'regular' }) {
  // One gesture, one menu. A long press can reach here twice (a tool's own touch timer, then
  // the system's contextmenu event) and a right-click can bubble to two listeners: the second
  // request at the same spot keeps the menu that is already open instead of flickering it.
  const now = performance.now();
  if (activeMenu && lastOpenPoint && now - lastOpenPoint.at < 700 && Math.hypot(x - lastOpenPoint.x, y - lastOpenPoint.y) < 24) return;
  lastOpenPoint = { x, y, at: now };
  closeContextMenu();

  // A menu tree shares a lifetime, focus handling and outside-click boundary.
  // Existing callers keep the regular menu; selected text uses the horizontal bar.
  const panels = [];
  let hoverTimer;
  const previousFocus = document.activeElement;
  const closeChildren = (level) => {
    while (panels.length > level + 1) {
      const removed = panels.pop();
      removed.parent?.setAttribute('aria-expanded', 'false');
      removeMenu(removed.element);
    }
  };
  const showChildren = (entry, item, level, keyboard = false) => {
    clearTimeout(hoverTimer);
    if (panels[level + 1]?.parent === entry) return;
    closeChildren(level);
    const rect = entry.getBoundingClientRect();
    entry.setAttribute('aria-expanded', 'true');
    const child = buildPanel(item.children, rect.right + 3, rect.top, level + 1, entry);
    if (keyboard) child.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  };

  function buildPanel(entries, px, py, level = 0, parent = null) {

  const menu = document.createElement('div');
  if (!level) menu.id = 'toolbox-context-menu';
  const mode = level && presentation === 'horizontal' ? 'regular' : presentation;
  menu.className = `finder-context-menu ${className} ${mode !== 'regular' ? `tb-menu-${mode}` : ''}`.trim();
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', parent?.getAttribute('aria-label') || label || title || 'Actions');
  if (mode === 'horizontal') menu.setAttribute('aria-orientation', 'horizontal');

  let html = '';
  if (title && !level && mode === 'regular') {
    html += `<div class="finder-menu-title">${escapeHtml(title)}</div>`;
  }

  entries.forEach((item, index) => {
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
      <div class="finder-menu-item ${item.destructive ? 'destructive' : ''}" style="--i:${Math.min(index, 14)}" data-item-index="${index}" role="menuitem" tabindex="-1" aria-label="${escapeHtml(item.label || '')}"${item.disabled ? ' aria-disabled="true"' : ''} title="${escapeHtml(item.hint || item.label || '')}"${item.children?.length ? ' aria-haspopup="menu" aria-expanded="false"' : ''}>
        <div class="finder-menu-item-left">
          ${item.icon ? `<span class="finder-menu-icon">${item.icon}</span>` : ''}
          <span class="finder-menu-label">${escapeHtml(item.label || '')}</span>
        </div>
        ${item.children?.length ? '<span class="finder-menu-chevron" aria-hidden="true">›</span>' : item.shortcut ? `<span class="finder-menu-shortcut">${escapeHtml(item.shortcut)}</span>` : ''}
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
  const width = rect.width;
  let left = px;
  let top = py;

  if (left + width > window.innerWidth - margin) {
    left = parent ? parent.getBoundingClientRect().left - width - 3 : window.innerWidth - width - margin;
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = window.innerHeight - rect.height - margin;
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  // Unfold from the point that was clicked, even when the menu had to be
  // pushed back from a screen edge.
  menu.style.transformOrigin = `${Math.max(0, Math.min(rect.width, px - left))}px ${Math.max(0, Math.min(rect.height, py - top))}px`;
  menu.style.visibility = 'visible';
  panels.push({ element: menu, entries, parent });
  if (!level && focusFirst) menu.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();

  // Event handlers
  const onMenuClick = (e) => {
    const itemEl = e.target.closest('[data-item-index]');
    if (itemEl) {
      const idx = parseInt(itemEl.dataset.itemIndex, 10);
      const item = entries[idx];
      if (item?.children?.length && !item.disabled) { showChildren(itemEl, item, level, true); return; }
      if (item && !item.disabled && typeof item.action === 'function') {
        // The chosen row flashes while the menu fades, so the click visibly landed.
        itemEl.classList.add('is-chosen');
        closeContextMenu();
        item.action();
      }
    }
  };

  menu.addEventListener('click', onMenuClick);
  menu.addEventListener('pointerdown', (e) => { if (e.target.closest('[role="menuitem"]')) e.preventDefault(); });
  menu.addEventListener('pointerover', (e) => {
    clearTimeout(hoverTimer);
    const entry = e.target.closest('[data-item-index]');
    if (!entry) return;
    const item = entries[Number(entry.dataset.itemIndex)];
    if (item?.children?.length && !item.disabled) hoverTimer = setTimeout(() => showChildren(entry, item, level), 180);
    else closeChildren(level);
  });
  menu.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
  return menu;
  }

  const menu = buildPanel(items, x, y);
  const contains = (target) => panels.some(p => p.element.contains(target));

  const onGlobalPointerDown = (e) => {
    if (!contains(e.target)) {
      closeContextMenu();
    }
  };

  // A right-click elsewhere closes this menu - but not the very event that
  // belongs to the gesture which opened it (Windows fires it after mouseup).
  const onGlobalContextMenu = (e) => {
    const el = eventElement(e);
    if (el && contains(el)) return;
    if (performance.now() - lastMenuOpenedAt < SAME_GESTURE_MS && el && !isEditableTarget(el)) return;
    closeContextMenu();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      closeContextMenu();
      previousFocus?.focus?.({ preventScroll: true });
      return;
    }
    if (e.key === 'Tab') { closeContextMenu(); return; }
    const level = Math.max(0, panels.findIndex(p => p.element.contains(document.activeElement)));
    const current = panels[level];
    const horizontal = current.element.classList.contains('tb-menu-horizontal');
    const entries = [...current.element.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    const index = entries.indexOf(document.activeElement);
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if ([nextKey, prevKey, 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? entries.length - 1
        : (index < 0 ? (e.key === prevKey ? entries.length - 1 : 0) : (index + (e.key === prevKey ? -1 : 1) + entries.length) % entries.length);
      entries[next]?.focus();
    } else if (e.key === 'ArrowRight' || (horizontal && e.key === 'ArrowDown')) {
      const entry = entries[index];
      const item = entry && current.entries[Number(entry.dataset.itemIndex)];
      if (item?.children?.length) { e.preventDefault(); showChildren(entry, item, level, true); }
    } else if (e.key === 'ArrowLeft' && level) {
      e.preventDefault(); const parent = current.parent; closeChildren(level - 1); parent?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (index >= 0) { e.preventDefault(); entries[index].click(); }
    }
  };

  // Delay global listeners so the triggering click doesn't instantly dismiss
  const listenerTimer = setTimeout(() => {
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    window.addEventListener('contextmenu', onGlobalContextMenu, true);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown, true);
  }, 10);
  function onScroll(e) { if (!contains(e.target)) closeContextMenu(); }

  activeMenu = {
    element: menu,
    cleanup: () => {
      clearTimeout(listenerTimer);
      clearTimeout(hoverTimer);
      window.removeEventListener('pointerdown', onGlobalPointerDown, true);
      window.removeEventListener('contextmenu', onGlobalContextMenu, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKeyDown, true);
      panels.forEach(p => removeMenu(p.element));
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

/** Opens a menu under a button (an overflow "…" button), aligned to its edge. */
export function openMenuFromButton(button, options) {
  const r = button.getBoundingClientRect();
  button.setAttribute('aria-expanded', 'true');
  openContextMenu({ ...options, x: r.left, y: r.bottom + 6, focusFirst: true });
  const menu = document.getElementById('toolbox-context-menu');
  if (!menu) return;
  // Right-align when the button sits at the right of its row.
  if (r.left + menu.offsetWidth > window.innerWidth - 10) menu.style.left = `${Math.max(10, r.right - menu.offsetWidth)}px`;
  menu.style.transformOrigin = r.left + menu.offsetWidth > window.innerWidth - 10 ? '100% 0' : '0 0';
  const done = new MutationObserver(() => { if (!menu.isConnected || !menu.id) { button.setAttribute('aria-expanded', 'false'); done.disconnect(); } });
  done.observe(document.body, { childList: true });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
