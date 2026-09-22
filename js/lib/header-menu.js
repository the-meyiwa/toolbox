import { tbAlert } from './dialog.js';
/* ============================================================
   TOOLBOX — Header Dropdown Menu & Quick Action Hub
   Provides access to Themes, Browser Storage, Preferences, and Credits.
   ============================================================ */

import { openSettings } from './settings-ui.js';
import { openStorageModal } from './storage-ui.js';
import { openAccountModal } from '../views/account-modal.js';
import { getSettings, updateSettings, exportSettings, importSettings } from './settings.js';
import { getCurrentUser } from './supabase.js';
import { getProfilePictureSrc } from './profile-pictures.js';
import { NotificationEngine, safeNotificationLink, prepareNotificationSound } from './notifications.js';
import { sendMessage } from './messaging-service.js';

let menuEl = null;
let isMenuOpen = false;
let prefModalEl = null;

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function createPreferencesModal() {
  if (prefModalEl) return prefModalEl;

  prefModalEl = document.createElement('div');
  prefModalEl.id = 'preferences-modal';
  prefModalEl.className = 'settings-modal-backdrop';
  prefModalEl.setAttribute('role', 'dialog');
  prefModalEl.setAttribute('aria-modal', 'true');
  prefModalEl.setAttribute('aria-labelledby', 'pref-modal-title');
  prefModalEl.style.display = 'none';

  prefModalEl.innerHTML = `
    <div class="settings-modal-window" style="max-width: 580px;">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      <div class="settings-modal-header">
        <div class="settings-title-wrap">
          <div class="settings-title-icon" style="background:var(--black); color:var(--white);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div>
            <h2 id="pref-modal-title" class="settings-modal-title">General Preferences</h2>
            <p class="settings-modal-subtitle">Configure workflow and editor preferences.</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-pref" aria-label="Close Preferences">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body" id="pref-modal-body">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  document.body.appendChild(prefModalEl);

  prefModalEl.querySelector('#close-pref').addEventListener('click', closePreferencesModal);
  prefModalEl.addEventListener('click', (e) => {
    if (e.target === prefModalEl) closePreferencesModal();
  });

  return prefModalEl;
}

function renderPreferencesContent() {
  const body = prefModalEl.querySelector('#pref-modal-body');
  const current = getSettings();

  body.innerHTML = `
    <div class="pref-options-list">
      <!-- Auto Save -->
      <label class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Auto-save completed work</span>
          <span class="pref-option-desc">Automatically keep converted or edited files in your browser's Saved tab.</span>
        </div>
        <input type="checkbox" id="pref-autosave" class="pref-switch" ${current.autoSave ? 'checked' : ''}>
      </label>

      <!-- Unit System -->
      <div class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Default measurement system</span>
          <span class="pref-option-desc">Used for engineering, chemistry, and metric tools.</span>
        </div>
        <select class="tool-select pref-select" id="pref-units">
          <option value="metric" ${current.unitSystem === 'metric' ? 'selected' : ''}>Metric (m, kg, °C)</option>
          <option value="imperial" ${current.unitSystem === 'imperial' ? 'selected' : ''}>Imperial (ft, lbs, °F)</option>
        </select>
      </div>

      <!-- Code Editor Wrap -->
      <label class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Code Editor word wrap</span>
          <span class="pref-option-desc">Wrap long code lines inside the Code Playground and text editors.</span>
        </div>
        <input type="checkbox" id="pref-wrap" class="pref-switch" ${current.editorWrap ? 'checked' : ''}>
      </label>

      <!-- Code Editor Font Size -->
      <div class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Editor font size</span>
          <span class="pref-option-desc">Base typography scale for code text and gutters.</span>
        </div>
        <select class="tool-select pref-select" id="pref-fontsize">
          <option value="12" ${current.editorFontSize === 12 ? 'selected' : ''}>12px (Compact)</option>
          <option value="13" ${current.editorFontSize === 13 ? 'selected' : ''}>13px (Default)</option>
          <option value="14" ${current.editorFontSize === 14 ? 'selected' : ''}>14px (Comfortable)</option>
          <option value="16" ${current.editorFontSize === 16 ? 'selected' : ''}>16px (Large)</option>
        </select>
      </div>

      <!-- Audio Feedback -->
      <label class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Audio feedback & metronome sounds</span>
          <span class="pref-option-desc">Enable Web Audio synth synthesis for music & timer tools.</span>
        </div>
        <input type="checkbox" id="pref-audio" class="pref-switch" ${current.hapticAudio ? 'checked' : ''}>
      </label>

    </div>

    <!-- Backup / Restore -->
    <div class="pref-backup-section">
      <h3 class="settings-section-title">Settings Backup & Sync</h3>
      <p class="settings-section-hint">Export your configurations to a JSON file or import onto another device.</p>
      <div class="pref-backup-buttons">
        <button type="button" class="btn btn-sm btn-secondary" id="pref-export-btn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Settings
        </button>
        <label class="btn btn-sm btn-secondary" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Import Settings
          <input type="file" id="pref-import-file" accept=".json" style="display:none;">
        </label>
      </div>
    </div>
  `;

  // Attach dynamic setting listeners
  body.querySelector('#pref-autosave').addEventListener('change', (e) => {
    updateSettings({ autoSave: e.target.checked });
  });

  body.querySelector('#pref-units').addEventListener('change', (e) => {
    updateSettings({ unitSystem: e.target.value });
  });

  body.querySelector('#pref-wrap').addEventListener('change', (e) => {
    updateSettings({ editorWrap: e.target.checked });
  });

  body.querySelector('#pref-fontsize').addEventListener('change', (e) => {
    updateSettings({ editorFontSize: parseInt(e.target.value, 10) });
  });

  body.querySelector('#pref-audio').addEventListener('change', (e) => {
    updateSettings({ hapticAudio: e.target.checked });
  });

  body.querySelector('#pref-export-btn').addEventListener('click', () => {
    exportSettings();
  });

  body.querySelector('#pref-import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = importSettings(evt.target.result);
        if (result.success) {
          tbAlert('Settings imported successfully!');
          renderPreferencesContent();
        } else {
          tbAlert('Failed to import settings: ' + result.error);
        }
      };
      reader.readAsText(file);
    }
  });
}

export function openPreferencesModal(section = null) {
  openSettings(section);
}

export function closePreferencesModal() {
  closeSettings();
}

export function toggleHeaderMenu() {
  if (!menuEl) return;
  isMenuOpen = !isMenuOpen;
  const btn = document.getElementById('header-menu-btn');

  if (isMenuOpen) {
    menuEl.classList.add('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    menuEl.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

export function closeHeaderMenu() {
  if (!menuEl || !isMenuOpen) return;
  isMenuOpen = false;
  menuEl.classList.remove('is-open');
  const btn = document.getElementById('header-menu-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export function installHeaderMenu() {
  const btn = document.getElementById('header-menu-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettings();
    });
  }

  // Setup Notification Center
  const notifBtn = document.getElementById('header-notif-btn');
  if (notifBtn) {
    notifBtn.setAttribute('aria-expanded', 'false');
    notifBtn.setAttribute('aria-controls', 'header-notif-panel');
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationPanel();
      if (getSettings().notificationSound) prepareNotificationSound();
    });
  }

  // Escape key handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (prefModalEl?.classList.contains('is-open')) closePreferencesModal();
      if (notifPanelEl?.classList.contains('is-open')) closeNotificationPanel();
    }
  });

  updateHeaderAvatar();
  updateNotificationBadge();
  window.addEventListener('toolbox:authchange', updateHeaderAvatar);
  const refreshNotifications = () => {
    updateNotificationBadge();
    if (notifPanelEl?.classList.contains('is-open')) renderNotificationPanel();
  };
  window.addEventListener('toolbox:notifications-updated', refreshNotifications);
  window.addEventListener('toolbox:authchange', refreshNotifications);
  window.addEventListener('toolbox:settingschange', refreshNotifications);
  window.addEventListener('storage', event => {
    if (!event.key || event.key.startsWith('toolbox_notifications_') || event.key === 'toolbox_supabase_session') refreshNotifications();
  });
}

let notifPanelEl = null;

async function updateNotificationBadge() {
  const badge = document.getElementById('header-notif-badge');
  if (!badge) return;
  const count = await NotificationEngine.getUnreadCount();
  document.getElementById('header-notif-btn')?.setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');

  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function renderNotificationPanel() {
  if (!notifPanelEl) {
    notifPanelEl = document.createElement('div');
    notifPanelEl.id = 'header-notif-panel';
    notifPanelEl.setAttribute('role', 'region');
    notifPanelEl.setAttribute('aria-label', 'Notifications');
    notifPanelEl.className = 'header-dropdown-menu header-notif-panel';
    notifPanelEl.classList.add('notif-panel');
    notifPanelEl.style.cssText = 'top: calc(var(--header-h) - 4px); right: 16px; width: 360px; max-width: calc(100vw - 32px); max-height: min(520px, calc(100dvh - 88px));';
    document.body.appendChild(notifPanelEl);

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (notifPanelEl.classList.contains('is-open') && !notifPanelEl.contains(e.target) && !document.getElementById('header-notif-btn').contains(e.target)) {
        closeNotificationPanel();
      }
    });
  }

  const notifications = await NotificationEngine.getNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  let html = `
    <div class="notif-head">
      <h3>Notifications</h3>
      <div class="notif-head-actions">
        ${unreadCount > 0 ? `<button type="button" class="btn btn-ghost btn-sm" id="notif-mark-read">Mark all read</button>` : ''}
        ${notifications.length ? `<button type="button" class="btn btn-ghost btn-sm" id="notif-clear-all">Clear</button>` : ''}
      </div>
    </div>
    <div class="notif-list" id="notif-list-container">
  `;

  if (notifications.length === 0) {
    html += `
      <div class="notif-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <strong>You're all caught up</strong>
      </div>`;
  } else {
    notifications.forEach(n => {
      const isUnread = !n.read;
      const timeStr = new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `
        <div class="notif-item${isUnread ? ' is-unread' : ''}" data-id="${escapeHtml(n.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${isUnread ? 'Unread: ' : ''}${n.title}`)}">
          <div class="notif-item-top">
            <span class="notif-item-title">${escapeHtml(n.title)}</span>
            <span class="notif-item-time">${timeStr}</span>
          </div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
          ${n.type === 'message' && n.data?.conversationId ? `<button type="button" class="notif-reply-action" data-reply-id="${escapeHtml(n.id)}">Reply</button>` : ''}
        </div>`;
    });
  }

  html += `</div><div class="notif-preferences-link"><button type="button" id="notif-open-preferences">Notification preferences</button></div>`;
  notifPanelEl.innerHTML = html;
  notifPanelEl.querySelector('#notif-open-preferences')?.addEventListener('click', () => {
    closeNotificationPanel();
    openSettings('notifications');
  });

  const listContainer = notifPanelEl.querySelector('#notif-list-container');
  listContainer.addEventListener('click', async (e) => {
    if (e.target.closest('.notif-inline-reply')) return;
    const replyAction = e.target.closest('.notif-reply-action');
    if (replyAction) {
      e.stopPropagation();
      const item = replyAction.closest('.notif-item');
      item.querySelector('.notif-inline-reply')?.remove();
      item.insertAdjacentHTML('beforeend', `<form class="notif-inline-reply"><input type="text" maxlength="2000" placeholder="Write a reply" aria-label="Reply to message"><button type="submit">Send</button></form>`);
      const form = item.querySelector('.notif-inline-reply');
      form.querySelector('input').focus();
      form.addEventListener('submit', async event => {
        event.preventDefault();event.stopPropagation();
        const notification = notifications.find(n => n.id === item.dataset.id);
        const input = form.querySelector('input');const value = input.value.trim();
        if (!value || !notification?.data?.conversationId) return;
        const submit = form.querySelector('button');submit.disabled = true;
        try {
          await sendMessage(notification.data.conversationId, value);
          await NotificationEngine.clearConversation(notification.data.conversationId);
          closeNotificationPanel();
          window.location.hash = `#messaging?conversation=${encodeURIComponent(notification.data.conversationId)}`;
        } catch (error) { submit.disabled = false; await tbAlert(error.message, 'Reply not sent'); }
      });
      return;
    }
    const item = e.target.closest('.notif-item');
    if (item) {
      const id = item.getAttribute('data-id');
      const targetNotif = notifications.find(n => n.id === id);
      await NotificationEngine.markAsRead(id);
      const link = safeNotificationLink(targetNotif?.link);
      if (link) {
        closeNotificationPanel();
        if (link.startsWith('#')) {
          window.location.hash = link;
        } else {
          window.location.href = link;
        }
      } else {
        renderNotificationPanel(); // Re-render to clear dot
      }
    }
  });

  const btnMark = notifPanelEl.querySelector('#notif-mark-read');
  if (btnMark) btnMark.addEventListener('click', async () => {
    await NotificationEngine.markAllAsRead();
    renderNotificationPanel();
  });

  const btnClear = notifPanelEl.querySelector('#notif-clear-all');
  if (btnClear) btnClear.addEventListener('click', async () => {
    await NotificationEngine.clearAll();
    renderNotificationPanel();
  });
}

function toggleNotificationPanel() {
  if (notifPanelEl && notifPanelEl.classList.contains('is-open')) {
    closeNotificationPanel();
  } else {
    renderNotificationPanel().then(() => {
      void notifPanelEl.offsetWidth;
      notifPanelEl.classList.add('is-open');
      document.getElementById('header-notif-btn')?.setAttribute('aria-expanded', 'true');
    });
  }
}

function closeNotificationPanel() {
  document.getElementById('header-notif-btn')?.setAttribute('aria-expanded', 'false');
  notifPanelEl?.classList.remove('is-open');
}

export function updateHeaderAvatar() {
  const btn = document.getElementById('header-menu-btn');
  if (!btn) return;
  const user = getCurrentUser();
  const settings = getSettings();
  const activePic = user?.profilePicture || user?.user_metadata?.profile_picture || settings?.profilePicture;

  if (user && activePic && activePic !== 'default') {
    const src = getProfilePictureSrc(activePic);
    if (src) {
      btn.innerHTML = `<img src="${src}" alt="">`;
      return;
    }
  }

  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
  `;
}
