/* ============================================================
   TOOLBOX — Unified Context Menu Engine
   Shared between Files, Notes, and other Toolbox modules.
   Guarantees no item overlap, text wrapping fixes, and smart
   viewport boundary collision detection.
   ============================================================ */

import { removeMenu } from './menu-motion.js';
let activeMenu = null;

/**
 * Open a styled context menu
 * @param {Object} options
 * @param {number} options.x - Cursor X coordinate
 * @param {number} options.y - Cursor Y coordinate
 * @param {string} [options.title] - Optional header title
 * @param {Array<Object>} options.items - Menu action items
 */
export function openContextMenu({ x, y, title = '', items = [] }) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'toolbox-context-menu';
  menu.className = 'finder-context-menu';
  menu.setAttribute('role', 'menu');

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

    html += `
      <div class="finder-menu-item ${item.destructive ? 'destructive' : ''}" data-item-index="${index}" role="menuitem" tabindex="0">
        <div class="finder-menu-item-left">
          ${item.icon ? `<span class="finder-menu-icon">${item.icon}</span>` : ''}
          <span class="finder-menu-label">${escapeHtml(item.label || '')}</span>
        </div>
        ${item.shortcut ? `<span class="finder-menu-shortcut">${escapeHtml(item.shortcut)}</span>` : ''}
      </div>
    `;
  });

  menu.innerHTML = html;
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);

  // Smart Viewport Collision Detection
  const rect = menu.getBoundingClientRect();
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

  // Event handlers
  const onMenuClick = (e) => {
    const itemEl = e.target.closest('[data-item-index]');
    if (itemEl) {
      const idx = parseInt(itemEl.dataset.itemIndex, 10);
      const item = items[idx];
      if (item && typeof item.action === 'function') {
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
    window.addEventListener('contextmenu', onGlobalPointerDown, true);
    window.addEventListener('scroll', closeContextMenu, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown, true);
  }, 10);

  activeMenu = {
    element: menu,
    cleanup: () => {
      clearTimeout(listenerTimer);
      window.removeEventListener('pointerdown', onGlobalPointerDown, true);
      window.removeEventListener('contextmenu', onGlobalPointerDown, true);
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
