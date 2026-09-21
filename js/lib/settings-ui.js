import { tbAlert, tbConfirm, tbPrompt } from './dialog.js';
/* ============================================================
   TOOLBOX — Unified Settings Menu
   Authoritative source of truth for:
   - User Profile & Unique @username Enforcement
   - Appearance & Theme Engine
   - General Preferences (Editor, Units, Auto-save)
   - Assistant AI & Response Animations
   - Settings Backup & Data Storage
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser, updateUserProfile, claimUsername, getUsernameChangeStatus, signOut, isUsernameAvailable, MADSELKIE_EMAILS } from './supabase.js';
import { getSettings, updateSettings, exportSettings, importSettings } from './settings.js';
import { PROFILE_PICTURES, getProfilePictureSrc, getUserAvatarHtml } from './profile-pictures.js';
import { openAccountModal } from '../views/account-modal.js';
import { NotificationEngine, prepareNotificationSound } from './notifications.js';
import { renderContributionSettings } from './flutterwave-contribution.js';
import { paintSupporterProfile } from './supporter.js';

let modalEl = null;
let isOpen = false;
let closeTimer = 0;
let currentSettingsPage = 'home';

const SETTINGS_PAGES = [
  { id: 'profile', title: 'Profile', hint: 'Account, identity and avatar', icon: '◉', sections: ['sec-profile'] },
  { id: 'general', title: 'General', hint: 'Preferences, settings backup and storage', icon: '⚙', sections: ['sec-preferences', 'sec-storage'] },
  { id: 'appearance', title: 'Appearance', hint: 'Theme and interface style', icon: '◐', sections: ['sec-appearance'] },
  { id: 'notifications', title: 'Notifications', hint: 'Alerts, sounds and badges', icon: '◌', sections: ['sec-notifications'] },
  { id: 'mail', title: 'Mail', hint: 'Connected Gmail and Microsoft accounts', icon: '✉', sections: ['sec-mail'] },
  { id: 'assistant', title: 'Assistant', hint: 'AI usage and conversation sync', icon: '✦', sections: ['sec-ai'] },
  { id: 'support', title: 'Support Toolbox', hint: 'Help fund careful, independent development', icon: '♡', sections: ['sec-contribution'] }
];

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderThemeCard(theme, currentId) {
  const isActive = theme.id === currentId;
  const groupLabel = {
    system: 'System',
    minimal: 'Minimal',
    cultural: 'Cultural / Design',
    brand: 'Brand-Inspired',
    expressive: 'Expressive'
  }[theme.group] || 'Theme';

  return `
    <button type="button" class="theme-card ${isActive ? 'is-active' : ''}" data-theme-id="${theme.id}" data-theme-group="${theme.group}" role="radio" aria-checked="${isActive}">
      <div class="theme-card-preview" style="background: ${theme.preview.bg}; border: 1px solid ${theme.preview.border || 'rgba(0,0,0,0.1)'};">
        <div class="theme-card-preview-bar" style="background: ${theme.preview.card}; border-bottom: 1px solid ${theme.preview.border || 'rgba(0,0,0,0.06)'};">
          <span class="theme-preview-dot" style="background: ${theme.preview.accent};"></span>
          <span class="theme-preview-line" style="background: ${theme.preview.text}; opacity: 0.6;"></span>
        </div>
        <div class="theme-card-preview-body">
          <div class="theme-preview-chip" style="background: ${theme.preview.accent}; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"></div>
          <div class="theme-preview-text" style="color: ${theme.preview.text}; font-weight: 700;">Aa</div>
        </div>
      </div>
      <div class="theme-card-meta">
        <div class="theme-card-header">
          <span class="theme-card-name">${escapeHtml(theme.name)}</span>
          <span class="theme-badge-exp">${escapeHtml(groupLabel)}</span>
        </div>
        <p class="theme-card-desc">${escapeHtml(theme.description)}</p>
      </div>
      <div class="theme-card-palette" aria-hidden="true">
        <span class="theme-palette-dot" style="background: ${theme.preview.accent};" title="Accent"></span>
        <span class="theme-palette-dot" style="background: ${theme.preview.bg}; border: 1px solid ${theme.preview.border || 'rgba(0,0,0,0.15)'};" title="Background"></span>
        <span class="theme-palette-dot" style="background: ${theme.preview.text};" title="Text"></span>
      </div>
      <div class="theme-card-check">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </button>
  `;
}

function setSettingsHeading(title, subtitle, showBack) {
  const back = modalEl.querySelector('#settings-back-btn');
  const icon = modalEl.querySelector('#settings-title-icon');
  if (back) back.style.display = showBack ? 'inline-flex' : 'none';
  if (icon) icon.style.display = showBack ? 'none' : 'flex';
  modalEl.querySelector('#settings-modal-title').textContent = title;
  modalEl.querySelector('#settings-modal-subtitle').textContent = subtitle;
}

function showSettingsHome() {
  currentSettingsPage = 'home';
  const home = modalEl.querySelector('#settings-home-view');
  const detail = modalEl.querySelector('#settings-detail-view');
  if (!home || !detail) return;
  home.hidden = false;
  detail.hidden = true;
  modalEl.querySelector('#settings-avatars-view').style.display = 'none';
  modalEl.querySelector('#settings-modal-scroll').style.display = 'flex';
  modalEl.querySelector('.settings-search-container').style.display = '';
  setSettingsHeading('Settings', 'Toolbox, arranged around the way you use it', false);
  modalEl.querySelector('#settings-modal-scroll').scrollTop = 0;
}

function showSettingsPage(id) {
  const page = SETTINGS_PAGES.find(item => item.id === id);
  if (!page) return showSettingsHome();
  currentSettingsPage = id;
  modalEl.querySelector('#settings-home-view').hidden = true;
  modalEl.querySelector('#settings-detail-view').hidden = false;
  modalEl.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== id; });
  modalEl.querySelector('#settings-avatars-view').style.display = 'none';
  modalEl.querySelector('#settings-modal-scroll').style.display = 'flex';
  modalEl.querySelector('.settings-search-container').style.display = 'none';
  setSettingsHeading(page.title, page.hint, true);
  modalEl.querySelector('#settings-modal-scroll').scrollTop = 0;
}

function organizeSettingsNavigation() {
  const body = modalEl.querySelector('#settings-modal-scroll');
  if (!body || body.dataset.organized) return;
  body.dataset.organized = 'true';
  const search = body.querySelector('.settings-search-container');
  const sections = [...body.querySelectorAll(':scope > .settings-section')];
  const home = document.createElement('div');
  home.id = 'settings-home-view';
  home.className = 'settings-home-view';
  home.innerHTML = `<div class="settings-list" role="list">${SETTINGS_PAGES.map(page => `
    <button type="button" class="settings-list-row" data-settings-page="${page.id}">
      <span class="settings-list-icon" aria-hidden="true">${page.icon}</span>
      <span class="settings-list-copy"><strong>${page.title}</strong><small>${page.hint}</small></span>
      <span class="settings-list-chevron" aria-hidden="true">›</span>
    </button>`).join('')}</div>`;
  const detail = document.createElement('div');
  detail.id = 'settings-detail-view';
  detail.className = 'settings-detail-view';
  detail.hidden = true;
  SETTINGS_PAGES.forEach(page => {
    const panel = document.createElement('div');
    panel.className = 'settings-page-panel';
    panel.dataset.settingsPanel = page.id;
    panel.hidden = true;
    page.sections.forEach(id => {
      const section = sections.find(item => item.id === id);
      if (section) panel.appendChild(section);
    });
    detail.appendChild(panel);
  });
  body.appendChild(home);
  body.appendChild(detail);
  home.querySelectorAll('[data-settings-page]').forEach(button => button.addEventListener('click', () => showSettingsPage(button.dataset.settingsPage)));
  const input = body.querySelector('#settings-search-input');
  input?.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    home.querySelectorAll('.settings-list-row').forEach(row => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query); });
  });
}

function createModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'settings-modal';
  modalEl.className = 'settings-modal-backdrop';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'settings-modal-title');
  modalEl.style.display = 'none';

  modalEl.innerHTML = `
    <div class="settings-modal-window">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      
      <!-- Modal Header -->
      <div class="settings-modal-header" style="flex-shrink: 0; padding: 24px 32px 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); display: flex; align-items: flex-start; justify-content: space-between; z-index: 10;">
        <div class="settings-title-wrap" style="display: flex; align-items: flex-start; gap: 16px; flex: 1; min-width: 0;">
          <button type="button" id="settings-back-btn" aria-label="Back to Settings" style="display: none; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; align-items: center; gap: 6px; flex-shrink: 0; transition: color 0.15s ease;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Back</span>
          </button>
          <div class="settings-title-icon" id="settings-title-icon" style="display: flex; align-items: center; justify-content: center; color: var(--text); flex-shrink: 0; margin-top: 2px;">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div style="min-width: 0; display: flex; flex-direction: column;">
            <h2 id="settings-modal-title" class="settings-modal-title" style="margin: 0; font-size: 1.4rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; letter-spacing: -0.02em;">Toolbox Settings</h2>
            <p id="settings-modal-subtitle" class="settings-modal-subtitle" style="margin: 6px 0 0; font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;">Appearance, Preferences, AI, and Profile Identity</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-settings" aria-label="Close Settings" style="background: var(--bg-subtle); border: 1px solid var(--border); cursor: pointer; color: var(--text); padding: 0; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; box-shadow: 0 2px 4px rgba(0,0,0,0.03); transition: all 0.15s ease; position: relative; z-index: 20;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- View 1: Main Settings Scrollable Body -->
      <div class="settings-modal-body" id="settings-modal-scroll" style="flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 24px; display: flex; flex-direction: column; gap: 28px; position: relative;">
        
        <!-- SEARCH PREFERENCES BAR -->
        <div class="settings-search-container" style="margin-bottom: -4px;">
          <div style="position: relative; width: 100%;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" id="settings-search-input" class="tool-input" placeholder="Search preferences..." autocomplete="off" spellcheck="false" style="width: 100%; padding: 10px 14px 10px 38px; border-radius: 12px; font-size: 0.88rem; background: var(--bg-subtle); border: 1px solid var(--border); outline: none; box-sizing: border-box;">
          </div>
        </div>
        
        <!-- SECTION 1: PROFILE & IDENTITY -->
        <section class="settings-section" id="sec-profile">
          <div id="profile-settings-container"></div>
        </section>

        <!-- SECTION 2: APPEARANCE & THEMES -->
        <section class="settings-section" id="sec-appearance" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div class="settings-section-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Appearance &amp; Themes</h3>
              <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">${THEMES.length} carefully matched Toolbox themes</span>
            </div>
            <div style="position: relative; width: 220px; max-width: 100%;">
              <input type="text" id="theme-filter-search" class="tool-input" placeholder="Filter themes..." autocomplete="off" spellcheck="false" style="width: 100%; height: 32px; padding: 0 10px 0 28px; font-size: 0.78rem; border-radius: 9999px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
          </div>

          <div class="theme-grid" id="theme-grid-standard"></div>
        </section>

        <!-- SECTION 3: GENERAL PREFERENCES -->
        <section class="settings-section" id="sec-preferences" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div class="settings-section-header" style="margin-bottom: 16px;">
            <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">General Preferences</h3>
            <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Editor environment, auto-save behavior, and tactile audio</span>
          </div>
          <div id="preferences-settings-container"></div>
        </section>

        <section class="settings-section" id="sec-notifications">
          <div class="settings-section-header">
            <h3 class="settings-section-title">Notifications</h3>
            <span class="settings-section-hint">Choose how Toolbox can alert you</span>
          </div>
          <div id="notifications-settings-container"></div>
        </section>

        <section class="settings-section" id="sec-mail">
          <div class="settings-section-header">
            <h3 class="settings-section-title">Mail account</h3>
            <span class="settings-section-hint">Connect and manage your inbox provider</span>
          </div>
          <div id="mail-settings-container"></div>
        </section>

        <!-- SECTION 4: ASSISTANT AI -->
        <section class="settings-section" id="sec-ai" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div id="ai-settings-container"></div>
        </section>

        <section class="settings-section" id="sec-contribution">
          <div id="contribution-settings-container"></div>
        </section>

        <!-- SECTION 5: BACKUP & STORAGE -->
        <section class="settings-section" id="sec-storage" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div id="storage-settings-container"></div>
        </section>

      </div>

      <!-- View 2: Dedicated Avatars Page -->
      <div class="settings-modal-body settings-avatar-page" id="settings-avatars-view" style="display: none; flex: 1; overflow-y: auto; padding: 24px; flex-direction: column; gap: 20px;">
        <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="margin:0 0 4px; font-size:1.05rem; font-weight:700; color:var(--text);">Personalities &amp; Legends</h3>
            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
              Choose an avatar that fits your persona. Selected avatars update immediately across your workspace, file explorer, and Spaces.
            </p>
          </div>
        </div>
        <div class="settings-avatar-grid-gallery" id="settings-avatar-gallery"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  organizeSettingsNavigation();

  // Header button triggers
  
  // Search bar live filtering
  const searchInput = modalEl.querySelector('#settings-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const sections = modalEl.querySelectorAll('.settings-section');
      sections.forEach(sec => {
        if (!q) {
          sec.style.display = '';
          return;
        }
        const text = sec.innerText.toLowerCase();
        sec.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  modalEl.querySelector('#close-settings').addEventListener('click', closeSettings);
  modalEl.querySelector('#settings-back-btn')?.addEventListener('click', () => {
    if (window.__returnToAccount) {
      closeSettings();
      window.__returnToAccount = false;
      openAccountModal();
    } else if (currentSettingsPage === 'avatars') {
      showSettingsPage('profile');
    } else {
      showSettingsHome();
    }
  });
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeSettings();
  });

  return modalEl;
}

export function showMainView() {
  if (!modalEl) return;
  const mainScroll = modalEl.querySelector('#settings-modal-scroll');
  const avatarsView = modalEl.querySelector('#settings-avatars-view');
  const backBtn = modalEl.querySelector('#settings-back-btn');
  const titleIcon = modalEl.querySelector('#settings-title-icon');
  const title = modalEl.querySelector('#settings-modal-title');
  const subtitle = modalEl.querySelector('#settings-modal-subtitle');

  if (mainScroll) mainScroll.style.display = 'flex';
  if (avatarsView) avatarsView.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  if (titleIcon) titleIcon.style.display = 'flex';
  if (title) title.textContent = 'Toolbox Settings';
  if (subtitle) subtitle.textContent = 'Appearance, Preferences, AI, and Profile Identity';

  renderProfileSettings();
  showSettingsHome();
}

export function showAvatarView() {
  if (!modalEl) return;
  const mainScroll = modalEl.querySelector('#settings-modal-scroll');
  const avatarsView = modalEl.querySelector('#settings-avatars-view');
  const backBtn = modalEl.querySelector('#settings-back-btn');
  const titleIcon = modalEl.querySelector('#settings-title-icon');
  const title = modalEl.querySelector('#settings-modal-title');
  const subtitle = modalEl.querySelector('#settings-modal-subtitle');

  if (mainScroll) mainScroll.style.display = 'none';
  if (avatarsView) avatarsView.style.display = 'flex';
  if (backBtn) backBtn.style.display = 'inline-flex';
  if (titleIcon) titleIcon.style.display = 'none';
  if (title) title.textContent = 'Choose Your Avatar';
  if (subtitle) subtitle.textContent = 'Character bios and personal companions';
  currentSettingsPage = 'avatars';

  renderAvatarGallery();
}

function renderAvatarGallery() {
  if (!modalEl) return;
  const gallery = modalEl.querySelector('#settings-avatar-gallery');
  if (!gallery) return;

  const user = getCurrentUser();
  const settings = getSettings();
  const activePicId = user?.profilePicture || user?.user_metadata?.profile_picture || settings.profilePicture || 'default';

  gallery.innerHTML = PROFILE_PICTURES.map(pic => {
    const isSelected = pic.id === activePicId;
    const src = getProfilePictureSrc(pic.id);
    return `
      <div class="avatar-story-card ${isSelected ? 'is-active' : ''}" data-avatar-id="${escapeHtml(pic.id)}">
        <div class="avatar-story-header">
          <div class="avatar-story-avatar-wrap">
            ${src ? `
              <img src="${src}" alt="${escapeHtml(pic.name)}">
            ` : `
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text);">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            `}
          </div>
          <div>
            <h4 class="avatar-story-name">${escapeHtml(pic.name)}</h4>
            ${isSelected ? `<span class="avatar-story-badge">Current Avatar</span>` : ''}
          </div>
        </div>
        <p class="avatar-story-bio">${escapeHtml(pic.story || 'A loyal profile avatar for Toolbox.')}</p>
        <div class="avatar-story-action">
          <button type="button" class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-sm btn-pick-avatar" data-avatar-id="${escapeHtml(pic.id)}" style="padding:4px 14px; font-size:0.78rem; font-weight:600;">
            ${isSelected ? 'Active' : 'Choose'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  const pickAvatar = (id) => {
    const found = PROFILE_PICTURES.find(p => p.id === id);
    const src = getProfilePictureSrc(id);
    updateUserProfile({ profilePicture: id, avatarUrl: src });
    updateSettings({ profilePicture: id });
    renderAvatarGallery();
  };

  gallery.querySelectorAll('.avatar-story-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-avatar-id');
      if (id) pickAvatar(id);
    });
  });
}

function renderProfileSettings() {
  const container = modalEl.querySelector('#profile-settings-container');
  if (!container) return;

  const user = getCurrentUser();
  const settings = getSettings();
  const activePicId = user?.profilePicture || user?.user_metadata?.profile_picture || settings.profilePicture || 'default';
  const currentDisplayName = user?.displayName || user?.user_metadata?.display_name || settings.displayName || '';
  const isOwner = user && MADSELKIE_EMAILS.includes((user.email || '').toLowerCase().trim());
  const currentUsername = isOwner ? 'madselkie' : (user?.username || user?.user_metadata?.username || settings.username || '');

  if (!user) {
    container.innerHTML = `
      <div class="settings-section-header" style="margin-bottom: 12px;">
        <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Profile &amp; Identity</h3>
        <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Sign in to claim your unique @username and customize your display profile</span>
      </div>
      <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${getUserAvatarHtml('default', 44)}
          <div>
            <div style="font-size:0.86rem; font-weight:700; color:var(--text);">Sign in to customize your profile</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Unique handles prevent impersonation in Spaces and sync across devices.</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-settings-signin" style="font-size:0.8rem; padding:6px 16px;">
          Sign In
        </button>
      </div>
    `;

    container.querySelector('#btn-settings-signin')?.addEventListener('click', () => {
      closeSettings();
      openAccountModal();
    });
    return;
  }

  container.innerHTML = `
    <div class="settings-section-header" style="margin-bottom: 12px;">
      <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Profile &amp; Identity</h3>
      <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Unique username monitoring for Spaces collaboration and cloud presence</span>
    </div>

    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:18px;">
      
      <!-- Top Row: Avatar + Username + Display Name -->
      <div style="display:flex; align-items:flex-start; gap:18px; flex-wrap:wrap;">
        <div id="settings-avatar-current-preview" style="flex-shrink:0; margin-top:2px;">
          ${getUserAvatarHtml({ ...user, profilePicture: activePicId }, 60)}
        </div>
        
        <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:12px;">
          
          <!-- Unique Username Field -->
          <div>
            <label for="settings-profile-username" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">
              <span>Unique Username</span>
              ${isOwner ? '<span style="color:#10b981; font-weight:600; text-transform:none;">Verified Owner Handle</span>' : ''}
            </label>
            <div style="display:flex; gap:8px;">
              <div style="position:relative; flex:1;">
                <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:0.88rem; font-family:monospace; pointer-events:none;">@</span>
                <input type="text" id="settings-profile-username" class="tool-input" placeholder="username" value="${escapeHtml(currentUsername)}" ${isOwner || (!isOwner && !getUsernameChangeStatus().canChange && getUsernameChangeStatus().reason === 'cooldown') ? 'readonly' : ''} style="width:100%; height:36px; padding:0 12px 0 28px; font-size:0.86rem; border-radius:8px; font-family:monospace; background:${isOwner ? 'var(--bg-card)' : 'transparent'};">
              </div>
              ${!isOwner ? `
                <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-save-username" ${!getUsernameChangeStatus().canChange && getUsernameChangeStatus().reason === 'cooldown' ? 'disabled' : ''} style="padding:0 14px; height:36px; font-size:0.8rem; font-weight:600; ${!getUsernameChangeStatus().canChange && getUsernameChangeStatus().reason === 'cooldown' ? 'opacity:0.6; cursor:not-allowed;' : ''}">
                  Set Handle
                </button>
              ` : ''}
            </div>
            <div id="settings-username-msg" style="font-size:0.74rem; color:var(--text-muted); margin-top:4px;">
              ${isOwner ? 'Permanently bound to your verified accounts.' : (!getUsernameChangeStatus().canChange && getUsernameChangeStatus().reason === 'cooldown' ? getUsernameChangeStatus().message : 'Usernames can only be changed once a week.')}
            </div>
          </div>

          <!-- Display Name Field -->
          <div>
            <label for="settings-profile-display-name" style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">
              Display Name (Free choice)
            </label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="settings-profile-display-name" class="tool-input" placeholder="e.g. Meyiwa" value="${escapeHtml(currentDisplayName)}" style="flex:1; height:36px; padding:0 12px; font-size:0.86rem; border-radius:8px;">
              <button type="button" class="btn btn-primary btn-sm" id="btn-settings-save-name" style="padding:0 14px; height:36px; font-size:0.8rem; font-weight:600;">
                Save Name
              </button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
              <div id="settings-name-msg" style="font-size:0.74rem; color:var(--text-muted);">
                ${escapeHtml(user.email)} · Logged in
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-signout" style="padding:2px 10px; height:24px; font-size:0.72rem; cursor:pointer;">
                Sign Out
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Avatar Preview & Dedicated Change Avatar Action -->
      <div style="border-top:1px solid var(--border); padding-top:14px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div id="settings-avatar-current-preview" style="flex-shrink:0;">
            ${getUserAvatarHtml(activePicId, 56)}
          </div>
          <div>
            <div style="font-size:0.88rem; font-weight:700; color:var(--text);">
              ${escapeHtml(PROFILE_PICTURES.find(p => p.id === activePicId)?.name || 'Minimal Silhouette')}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              Personal avatar shown across your tools, files, and Spaces
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-change-avatar" style="padding:6px 14px; font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Change Avatar</span>
        </button>
      </div>

    </div>
  `;

  // Wire Display Name save
  const nameInput = container.querySelector('#settings-profile-display-name');
  const saveNameBtn = container.querySelector('#btn-settings-save-name');
  const nameMsg = container.querySelector('#settings-name-msg');

  const handleSaveName = () => {
    const val = nameInput.value.trim();
    updateUserProfile({ displayName: val });
    updateSettings({ displayName: val });
    if (nameMsg) {
      nameMsg.textContent = 'Display name updated!';
      nameMsg.style.color = '#10b981';
      setTimeout(() => {
        nameMsg.textContent = `${user.email} · Logged in`;
        nameMsg.style.color = 'var(--text-muted)';
      }, 2500);
    }
  };

  saveNameBtn?.addEventListener('click', handleSaveName);
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    }
  });

  // Wire Sign Out
  const signoutBtn = container.querySelector('#btn-settings-signout');
  signoutBtn?.addEventListener('click', () => {
    signOut();
    renderProfileSettings();
  });

  // Wire Username save
  if (!isOwner) {
    const usernameInput = container.querySelector('#settings-profile-username');
    const saveUsernameBtn = container.querySelector('#btn-settings-save-username');
    const usernameMsg = container.querySelector('#settings-username-msg');

    const handleSaveUsername = () => {
      const raw = usernameInput.value.trim().replace(/^@/, '');
      const res = claimUsername(raw);
      if (res.success) {
        usernameMsg.textContent = `Username claimed: @${res.user.username}. Changes allowed once a week.`;
        usernameMsg.style.color = '#10b981';
        setTimeout(() => {
          renderProfileSettings();
        }, 1200);
      } else {
        usernameMsg.textContent = res.error || 'Username not available.';
        usernameMsg.style.color = '#ef4444';
      }
    };

    saveUsernameBtn?.addEventListener('click', handleSaveUsername);
    usernameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveUsername();
      }
    });
  }

  // Wire Change Avatar button
  container.querySelector('#btn-settings-change-avatar')?.addEventListener('click', () => {
    showAvatarView();
  });
}

function renderPreferencesSettings() {
  const container = modalEl.querySelector('#preferences-settings-container');
  if (!container) return;

  const s = getSettings();

  container.innerHTML = `
    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:16px;">
      
      <!-- Auto-Save -->
      <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Auto-Save to Browser Storage</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Automatically save file edits and scratchpad changes locally</div>
        </div>
        <input type="checkbox" id="pref-opt-autosave" class="pref-switch" ${s.autoSave !== false ? 'checked' : ''}>
      </label>

      <!-- Unit System -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Measurement Unit System</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Units used by default across calculations and engineering tools</div>
        </div>
        <select class="tool-select pref-select" id="pref-opt-units" style="min-width:140px; font-size:0.82rem;">
          <option value="metric" ${s.unitSystem === 'metric' ? 'selected' : ''}>Metric (m, kg, °C)</option>
          <option value="imperial" ${s.unitSystem === 'imperial' ? 'selected' : ''}>Imperial (ft, lbs, °F)</option>
        </select>
      </div>

      <!-- Editor Line Wrap -->
      <label style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); cursor:pointer;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Code Editor Soft Wrap</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Wrap long code and markdown lines in Code Playground</div>
        </div>
        <input type="checkbox" id="pref-opt-wrap" class="pref-switch" ${s.editorWrap ? 'checked' : ''}>
      </label>

      <!-- Editor Font Size -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Code Editor Font Size</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Base typography size for playground editor and terminal</div>
        </div>
        <select class="tool-select pref-select" id="pref-opt-fontsize" style="min-width:140px; font-size:0.82rem;">
          <option value="12" ${s.editorFontSize === 12 ? 'selected' : ''}>12px (Compact)</option>
          <option value="13" ${(s.editorFontSize === 13 || !s.editorFontSize) ? 'selected' : ''}>13px (Default)</option>
          <option value="14" ${s.editorFontSize === 14 ? 'selected' : ''}>14px (Medium)</option>
          <option value="16" ${s.editorFontSize === 16 ? 'selected' : ''}>16px (Large)</option>
        </select>
      </div>

      <!-- Haptic & Audio Feedback -->
      <label style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); cursor:pointer;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Haptic &amp; Tactile Feedback</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Subtle vibration on mobile navigation and interactive controls</div>
        </div>
        <input type="checkbox" id="pref-opt-audio" class="pref-switch" ${s.hapticAudio !== false ? 'checked' : ''}>
      </label>

    </div>
  `;

  container.querySelector('#pref-opt-autosave')?.addEventListener('change', (e) => updateSettings({ autoSave: e.target.checked }));
  container.querySelector('#pref-opt-units')?.addEventListener('change', (e) => updateSettings({ unitSystem: e.target.value }));
  container.querySelector('#pref-opt-wrap')?.addEventListener('change', (e) => updateSettings({ editorWrap: e.target.checked }));
  container.querySelector('#pref-opt-fontsize')?.addEventListener('change', (e) => updateSettings({ editorFontSize: parseInt(e.target.value, 10) }));
  container.querySelector('#pref-opt-audio')?.addEventListener('change', (e) => updateSettings({ hapticAudio: e.target.checked }));
}

function renderAiSettings() {
  const container = modalEl.querySelector('#ai-settings-container');
  if (!container) return;

  const user = getCurrentUser();
  const quota = user ? QuotaManager.getQuotaSummary() : null;
  const isUnlimited = user ? QuotaManager.isUserUnlimited() : false;

  container.innerHTML = `
    <div class="settings-section-header" style="margin-bottom: 12px;">
      <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Assistant</h3>
      <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Conversation persistence and usage</span>
    </div>

    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:16px;">
      
      <!-- Cloud History Status -->
      <div style="padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Cloud Conversation Sync</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            ${user ? 'All conversations are saved to Supabase and restored upon login.' : 'Sign in to sync your conversation history across browsers.'}
          </div>
        </div>
        <span style="font-size:0.78rem; font-weight:600; color:${user ? '#10b981' : 'var(--text-muted)'};">
          ${user ? 'Active' : 'Offline'}
        </span>
      </div>

      ${user && quota ? `
        <!-- QUOTAS -->
        <div style="padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Daily Messages</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; margin-top:2px;">
              ${quota.messagesUsed} / ${quota.messagesLimit} used today
            </div>
          </div>
          ${isUnlimited ? `
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-quota-modal" style="font-size:0.74rem; color:#ef4444;">
              Reset Count
            </button>
          ` : ''}
        </div>
      ` : ''}

    </div>
  `;

  container.querySelector('#btn-reset-quota-modal')?.addEventListener('click', () => {
    try {
      QuotaManager.resetQuotas();
      renderAiSettings();
    } catch (err) {
      tbAlert(err.message, 'Settings Error');
    }
  });

}

function renderStorageSettings() {
  const container = modalEl.querySelector('#storage-settings-container');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-section-header" style="margin-bottom: 12px;">
      <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Backup &amp; Storage</h3>
      <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Export configuration to JSON or import on another machine</span>
    </div>

    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-settings-export" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Settings
        </button>

        <label class="btn btn-secondary btn-sm" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Import Settings
          <input type="file" id="settings-import-file" accept=".json" style="display:none;">
        </label>
      </div>
      <div id="settings-storage-msg" style="font-size:0.75rem; color:var(--text-muted);">
        Toolbox stores data in your browser IndexedDB and localStorage.
      </div>
    </div>
  `;

  container.querySelector('#btn-settings-export')?.addEventListener('click', () => {
    exportSettings();
  });

  container.querySelector('#settings-import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = importSettings(evt.target.result);
        const msg = container.querySelector('#settings-storage-msg');
        if (result.success) {
          if (msg) {
            msg.textContent = 'Settings successfully imported!';
            msg.style.color = '#10b981';
          }
          renderPreferencesSettings();
          renderAiSettings();
          updateThemeList();
        } else if (msg) {
          msg.textContent = 'Import failed: ' + result.error;
          msg.style.color = '#ef4444';
        }
      };
      reader.readAsText(file);
    }
  });
}

let activeThemeSearch = '';

function updateThemeList(search = activeThemeSearch) {
  activeThemeSearch = search;

  const currentId = getStoredTheme();
  const standardGrid = modalEl.querySelector('#theme-grid-standard');
  if (!standardGrid) return;

  const filtered = THEMES.filter(t => {
    const q = activeThemeSearch.toLowerCase().trim();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.group.toLowerCase().includes(q);
    return matchSearch;
  });

  if (filtered.length === 0) {
    standardGrid.innerHTML = `
      <div style="width: 100%; padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No themes found matching "${escapeHtml(activeThemeSearch)}"
      </div>
    `;
  } else {
    standardGrid.innerHTML = filtered.map(t => renderThemeCard(t, currentId)).join('');
  }

  modalEl.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.getAttribute('data-theme-id');
      applyTheme(themeId);
      updateThemeList(activeThemeSearch);
    });
  });

  // Wire search input once
  const searchInput = modalEl.querySelector('#theme-filter-search');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = 'true';
    searchInput.addEventListener('input', (e) => {
      updateThemeList(e.target.value);
    });
  }


}

function renderMailSettings() {
  const container = modalEl?.querySelector('#mail-settings-container');
  if (!container) return;
  import('../views/mail-setup.js').then(({ createMailSetupUI }) => {
    container.innerHTML = '';
    container.appendChild(createMailSetupUI());
  }).catch(() => {});
}

function renderNotificationSettings() {
  const container = modalEl?.querySelector('#notifications-settings-container');
  if (!container) return;
  const current = getSettings();
  container.innerHTML = `
    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:16px;">
      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
        <div>
          <div style="font-size:0.88rem; font-weight:600; color:var(--text);">In-App Notifications</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Show badges and notification alerts for new messages</div>
        </div>
        <input type="checkbox" id="pref-notif-enabled" ${current.notificationsEnabled !== false ? 'checked' : ''}>
      </label>
      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
        <div>
          <div style="font-size:0.88rem; font-weight:600; color:var(--text);">Notification Sounds</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Play audio chime when alerts arrive</div>
        </div>
        <input type="checkbox" id="pref-notif-sound" ${current.notificationSound ? 'checked' : ''}>
      </label>
      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
        <div>
          <div style="font-size:0.88rem; font-weight:600; color:var(--text);">Desktop Alerts</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Allow system notifications while Toolbox is open</div>
          <div id="pref-notif-status" role="status" style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;"></div>
        </div>
        <input type="checkbox" id="pref-notif-push" ${current.notificationsPush ? 'checked' : ''}>
      </label>
    </div>
  `;
  container.querySelector('#pref-notif-enabled')?.addEventListener('change', (e) => {
    updateSettings({ notificationsEnabled: e.target.checked });
  });
  container.querySelector('#pref-notif-sound')?.addEventListener('change', (e) => {
    if (e.target.checked) prepareNotificationSound();
    updateSettings({ notificationSound: e.target.checked });
  });
  container.querySelector('#pref-notif-push')?.addEventListener('change', async (e) => {
    const status = container.querySelector('#pref-notif-status');
    if (!e.target.checked) {
      updateSettings({ notificationsPush: false });
      if (status) status.textContent = 'Desktop alerts disabled.';
      return;
    }
    const result = await NotificationEngine.enableBrowserNotifications();
    e.target.checked = result === 'granted';
    if (status) status.textContent = result === 'granted' ? 'Desktop alerts enabled.' : result === 'unsupported' ? 'Not supported by this browser.' : 'Blocked in browser site settings.';
  });
}

export function openSettings(targetSection = null) {
  createModal();
  renderProfileSettings();
  updateThemeList();
  renderPreferencesSettings();
  renderAiSettings();
  renderStorageSettings();
  renderMailSettings();
  renderNotificationSettings();
  renderContributionSettings(modalEl.querySelector('#contribution-settings-container'), () => {
    closeSettings();
    openAccountModal();
  });
  paintSupporterProfile();

  if (targetSection === 'avatars') {
    showAvatarView();
  } else if (targetSection) {
    const page = targetSection === 'preferences' || targetSection === 'storage' ? 'general' : targetSection === 'ai' ? 'assistant' : targetSection === 'contribution' ? 'support' : targetSection;
    showSettingsPage(page);
  } else {
    showSettingsHome();
  }

  // Clear search input on fresh open
  const searchInput = modalEl.querySelector('#settings-search-input');
  if (searchInput) {
    searchInput.value = '';
    modalEl.querySelectorAll('.settings-section').forEach(s => s.style.display = '');
  }

  // Always reset scroll to top
  const mainScroll = modalEl.querySelector('#settings-modal-scroll');
  if (mainScroll) mainScroll.scrollTop = 0;

  clearTimeout(closeTimer);
  modalEl.style.display = 'flex';

  requestAnimationFrame(() => {
    modalEl.classList.add('is-open');

    if (!targetSection && mainScroll) {
      mainScroll.scrollTop = 0;
    }
  });
  isOpen = true;
}

export function closeSettings() {
  if (!modalEl || !isOpen) return;
  modalEl.classList.remove('is-open');
  isOpen = false;
  closeTimer = setTimeout(() => {
    if (isOpen) return;
    modalEl.style.display = 'none';
  }, 200);
}

export function installSettingsUI() {
  window.addEventListener('toolbox:authchange', () => {
    if (isOpen) openSettings();
  });
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openSettings());
  }

  // Keyboard shortcut listener (Escape closes modal)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeSettings();
    }
  });
}
