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

let modalEl = null;
let isOpen = false;

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderThemeCard(theme, currentId) {
  const isActive = theme.id === currentId;

  return `
    <button type="button" class="theme-card ${isActive ? 'is-active' : ''}" data-theme-id="${theme.id}" role="radio" aria-checked="${isActive}">
      <div class="theme-card-preview" style="background: ${theme.preview.bg}; border-color: ${theme.preview.accent}44;">
        <div class="theme-card-preview-bar" style="background: ${theme.preview.card};">
          <span class="theme-preview-dot" style="background: ${theme.preview.accent};"></span>
          <span class="theme-preview-line" style="background: ${theme.preview.text}; opacity: 0.7;"></span>
        </div>
        <div class="theme-card-preview-body">
          <div class="theme-preview-chip" style="background: ${theme.preview.accent}; color: ${theme.preview.bg};"></div>
          <div class="theme-preview-text" style="color: ${theme.preview.text};">Aa</div>
        </div>
      </div>
      <div class="theme-card-meta">
        <div class="theme-card-header">
          <span class="theme-card-name">${escapeHtml(theme.name)}</span>
        </div>
        <p class="theme-card-desc">${escapeHtml(theme.description)}</p>
      </div>
      <div class="theme-card-check">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </button>
  `;
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
    <div class="settings-modal-window" style="max-width: 820px; width: 95%; height: 86vh; max-height: 840px; display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.2);">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      
      <!-- Modal Header -->
      <div class="settings-modal-header" style="flex-shrink: 0; padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
        <div class="settings-title-wrap" style="display: flex; align-items: center; gap: 12px;">
          <button type="button" id="settings-back-btn" aria-label="Back to Settings" style="display: none; background: none; border: 1px solid var(--border); cursor: pointer; color: var(--text); padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Back</span>
          </button>
          <div class="settings-title-icon" id="settings-title-icon" style="width: 36px; height: 36px; border-radius: 10px; background: var(--bg-subtle); display: flex; align-items: center; justify-content: center; color: var(--text);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div>
            <h2 id="settings-modal-title" class="settings-modal-title" style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text);">Toolbox Settings</h2>
            <p id="settings-modal-subtitle" class="settings-modal-subtitle" style="margin: 2px 0 0; font-size: 0.76rem; color: var(--text-muted);">Appearance, Preferences, AI, and Profile Identity</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-settings" aria-label="Close Settings" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 6px; border-radius: 6px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- View 1: Main Settings Scrollable Body -->
      <div class="settings-modal-body" id="settings-modal-scroll" style="flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 32px;">
        
        <!-- SECTION 1: PROFILE & IDENTITY -->
        <section class="settings-section" id="sec-profile">
          <div id="profile-settings-container"></div>
        </section>

        <!-- SECTION 2: APPEARANCE & THEMES -->
        <section class="settings-section" id="sec-appearance" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div class="settings-section-header" style="margin-bottom: 16px;">
            <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Appearance &amp; Themes</h3>
            <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Applied instantly across all tools, code playground, and file explorer</span>
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

        <!-- SECTION 4: ASSISTANT AI -->
        <section class="settings-section" id="sec-ai" style="border-top: 1px solid var(--border); padding-top: 28px;">
          <div id="ai-settings-container"></div>
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

  // Header button triggers
  modalEl.querySelector('#close-settings').addEventListener('click', closeSettings);
  modalEl.querySelector('#settings-back-btn')?.addEventListener('click', showMainView);
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
          ${getUserAvatarHtml(activePicId, 60)}
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
    renderSettingsContent();
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
          renderSettingsContent();
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
  const settings = getSettings();
  const quota = user ? QuotaManager.getQuotaSummary() : null;
  const isUnlimited = user ? QuotaManager.isUserUnlimited() : false;

  container.innerHTML = `
    <div class="settings-section-header" style="margin-bottom: 12px;">
      <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Assistant AI</h3>
      <span class="settings-section-hint" style="font-size: 0.76rem; color: var(--text-muted);">Response text animations and Cloud Conversation persistence</span>
    </div>

    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:16px;">
      
      <!-- Response text animation toggle -->
      <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Response text animation</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            Animate assistant message text dynamically as responses are generated
          </div>
        </div>
        <input type="checkbox" id="settings-ast-anim-toggle" class="pref-switch" ${settings.assistantResponseAnimation !== false ? 'checked' : ''}>
      </label>

      <!-- Animation style picker -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--text);">Animation style</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            Visual effect applied to the assistant's response text
          </div>
        </div>
        <select class="tool-select pref-select" id="settings-ast-anim-style" style="min-width:160px; font-size:0.82rem;">
          <option value="color rave" ${(settings.assistantAnimationStyle || 'color rave') === 'color rave' ? 'selected' : ''}>color rave</option>
          <option value="glow" ${(settings.assistantAnimationStyle === 'glow' || settings.assistantAnimationStyle === 'Pixel') ? 'selected' : ''}>glow</option>
          <option value="Plain Fade" ${settings.assistantAnimationStyle === 'Plain Fade' ? 'selected' : ''}>Plain Fade</option>
          <option value="Pop In" ${settings.assistantAnimationStyle === 'Pop In' ? 'selected' : ''}>Pop In</option>
        </select>
      </div>

      <!-- Animation Live Preview -->
      <div style="padding-top:10px; border-top:1px solid var(--border);">
        <div class="ast-anim-preview-box" id="settings-ast-anim-preview-box" style="justify-content:center; text-align:center; padding:12px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border);">
          <span class="ast-anim-preview-text" id="settings-ast-anim-preview-text">Animation preview</span>
        </div>
      </div>

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

  // Attach animation preview & listeners
  const updateSettingsAnimPreview = () => {
    const isEnabled = container.querySelector('#settings-ast-anim-toggle')?.checked;
    const style = container.querySelector('#settings-ast-anim-style')?.value || 'color rave';
    const previewEl = container.querySelector('#settings-ast-anim-preview-text');
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

  updateSettingsAnimPreview();

  container.querySelector('#settings-ast-anim-toggle')?.addEventListener('change', (e) => {
    updateSettings({ assistantResponseAnimation: e.target.checked });
    updateSettingsAnimPreview();
  });

  container.querySelector('#settings-ast-anim-style')?.addEventListener('change', (e) => {
    updateSettings({ assistantAnimationStyle: e.target.value });
    updateSettingsAnimPreview();
  });

  container.querySelector('#btn-reset-quota-modal')?.addEventListener('click', () => {
    try {
      QuotaManager.resetQuotas();
      renderAiSettings();
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderStorageSettings() {
  const container = modalEl.querySelector('#storage-settings-container');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-section-header" style="margin-bottom: 12px;">
      <h3 class="settings-section-title" style="font-size: 0.96rem; font-weight: 700; color: var(--text); margin: 0 0 4px;">Settings Backup &amp; Storage</h3>
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

function updateThemeList() {
  const currentId = getStoredTheme();
  const standardGrid = modalEl.querySelector('#theme-grid-standard');
  if (!standardGrid) return;

  standardGrid.innerHTML = THEMES.map(t => renderThemeCard(t, currentId)).join('');

  modalEl.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.getAttribute('data-theme-id');
      applyTheme(themeId);
      updateThemeList();
    });
  });
}

export function openSettings(targetSection = null) {
  createModal();
  renderProfileSettings();
  updateThemeList();
  renderPreferencesSettings();
  renderAiSettings();
  renderStorageSettings();

  if (targetSection === 'avatars') {
    showAvatarView();
  } else {
    showMainView();
  }

  modalEl.style.display = 'flex';
  requestAnimationFrame(() => {
    modalEl.classList.add('is-open');

    if (targetSection && targetSection !== 'avatars') {
      const sectionEl = modalEl.querySelector(`#sec-${targetSection}`);
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
  isOpen = true;
}

export function closeSettings() {
  if (!modalEl || !isOpen) return;
  modalEl.classList.remove('is-open');
  setTimeout(() => {
    modalEl.style.display = 'none';
    isOpen = false;
  }, 200);
}

export function installSettingsUI() {
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
