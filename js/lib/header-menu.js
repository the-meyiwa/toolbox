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

      <!-- Assistant Response Animation -->
      <label class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Assistant response animation</span>
          <span class="pref-option-desc">Animate assistant message text dynamically as responses are generated.</span>
        </div>
        <input type="checkbox" id="pref-ast-anim" class="pref-switch" ${current.assistantResponseAnimation !== false ? 'checked' : ''}>
      </label>

      <!-- Assistant Animation Style -->
      <div class="pref-option-row">
        <div class="pref-option-info">
          <span class="pref-option-title">Assistant animation style</span>
          <span class="pref-option-desc">Visual effect rendered on assistant response text.</span>
        </div>
        <select class="tool-select pref-select" id="pref-ast-anim-style">
          <option value="color rave" ${(current.assistantAnimationStyle || 'color rave') === 'color rave' ? 'selected' : ''}>color rave</option>
          <option value="glow" ${(current.assistantAnimationStyle === 'glow' || current.assistantAnimationStyle === 'Pixel') ? 'selected' : ''}>glow</option>
          <option value="Plain Fade" ${current.assistantAnimationStyle === 'Plain Fade' ? 'selected' : ''}>Plain Fade</option>
          <option value="Pop In" ${current.assistantAnimationStyle === 'Pop In' ? 'selected' : ''}>Pop In</option>
        </select>
      </div>

      <!-- Animation Live Preview -->
      <div class="pref-option-row" style="margin-top: 4px; border-bottom: none; padding-bottom: 0;">
        <div class="pref-option-info" style="width: 100%;">
          <div class="ast-anim-preview-box" id="pref-ast-anim-preview-box" style="width: 100%; justify-content: center; text-align: center;">
            <span class="ast-anim-preview-text" id="pref-ast-anim-preview-text">Animation preview</span>
          </div>
        </div>
      </div>
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

  const updatePreview = () => {
    const isEnabled = body.querySelector('#pref-ast-anim')?.checked;
    const style = body.querySelector('#pref-ast-anim-style')?.value || 'color rave';
    const previewEl = body.querySelector('#pref-ast-anim-preview-text');
    if (!previewEl) return;
    previewEl.className = 'ast-anim-preview-text';
    if (!isEnabled) {
      previewEl.textContent = 'Animations disabled';
      previewEl.style.opacity = '0.4';
      previewEl.style.fontStyle = 'italic';
    } else {
      previewEl.textContent = 'Animation preview';
      previewEl.style.opacity = '1';
      previewEl.style.fontStyle = 'normal';
      let animClass = 'ast-anim-color-rave';
      if (style === 'glow' || style === 'Pixel') animClass = 'ast-anim-glow';
      else if (style === 'Plain Fade') animClass = 'ast-anim-plain-fade';
      else if (style === 'Pop In') animClass = 'ast-anim-pop-in';
      previewEl.classList.add(animClass);
    }
  };

  updatePreview();

  body.querySelector('#pref-ast-anim')?.addEventListener('change', (e) => {
    updateSettings({ assistantResponseAnimation: e.target.checked });
    updatePreview();
  });

  body.querySelector('#pref-ast-anim-style')?.addEventListener('change', (e) => {
    updateSettings({ assistantAnimationStyle: e.target.value });
    updatePreview();
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
    notifPanelEl.style.cssText = `
      position: fixed;
      top: 56px;
      right: 16px;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: min(480px, calc(100dvh - 72px));
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      z-index: 2000;
      display: none;
      flex-direction: column;
      overflow: hidden;
      transform-origin: top right;
      transition: opacity 0.15s, transform 0.15s;
    `;
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
    <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: color-mix(in srgb, var(--bg-card) 90%, transparent); backdrop-filter: blur(12px);">
      <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text);">Notifications</h4>
      <div style="display:flex; gap: 8px;">
        ${unreadCount > 0 ? `<button type="button" id="notif-mark-read" style="background:none; border:none; color:var(--accent); font-size:0.75rem; cursor:pointer; font-weight:600;">Mark all read</button>` : ''}
        <button type="button" id="notif-clear-all" style="background:none; border:none; color:var(--text-muted); font-size:0.75rem; cursor:pointer;">Clear</button>
      </div>
    </div>
    <div style="flex: 1; overflow-y: auto; max-height: 400px;" id="notif-list-container">
  `;

  if (notifications.length === 0) {
    html += `
      <div style="padding: 40px 24px; text-align: center; color: var(--text-muted);">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="opacity: 0.3; margin-bottom: 12px;">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <div style="font-size: 0.85rem; font-weight: 600;">You're all caught up</div>
      </div>
    `;
  } else {
    notifications.forEach(n => {
      const isUnread = !n.read;
      const timeStr = new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
      html += `
        <button type="button" class="notif-item" data-id="${escapeHtml(n.id)}" aria-label="${escapeHtml(`${isUnread ? 'Unread: ' : ''}${n.title}`)}" style="padding: 12px 16px; border-bottom: 1px solid var(--border); background: ${isUnread ? 'var(--bg-subtle)' : 'transparent'}; cursor: pointer; transition: background 0.15s; position: relative;">
          ${isUnread ? '<div style="position:absolute; left:6px; top:18px; width:6px; height:6px; border-radius:50%; background:var(--accent);"></div>' : ''}
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; padding-left: ${isUnread ? '8px' : '0'};">
            <span style="font-weight: 600; font-size: 0.82rem; color: var(--text);">${escapeHtml(n.title)}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">${timeStr}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); padding-left: ${isUnread ? '8px' : '0'}; line-height: 1.4;">${escapeHtml(n.message)}</div>
        </button>
      `;
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
      notifPanelEl.style.display = 'flex';
      // Trigger reflow for animation
      void notifPanelEl.offsetWidth;
      notifPanelEl.style.opacity = '1';
      notifPanelEl.style.transform = 'scale(1)';
      notifPanelEl.classList.add('is-open');
      document.getElementById('header-notif-btn')?.setAttribute('aria-expanded', 'true');
    });
  }
}

function closeNotificationPanel() {
  document.getElementById('header-notif-btn')?.setAttribute('aria-expanded', 'false');
  if (!notifPanelEl) return;
  notifPanelEl.style.opacity = '0';
  notifPanelEl.style.transform = 'scale(0.95)';
  notifPanelEl.classList.remove('is-open');
  setTimeout(() => {
    if (!notifPanelEl.classList.contains('is-open')) {
      notifPanelEl.style.display = 'none';
    }
  }, 150);
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
      btn.innerHTML = `<img src="${src}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
      return;
    }
  }

  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text);">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  `;
}
