/* ============================================================
   TOOLBOX — Unified Settings Menu
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser, updateUserProfile } from './supabase.js';
import { getSettings, updateSettings } from './settings.js';
import { PROFILE_PICTURES, getProfilePictureSrc, getUserAvatarHtml } from './profile-pictures.js';
import { openAccountModal } from '../views/account-modal.js';

let modalEl = null;
let isOpen = false;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    <div class="settings-modal-window" style="max-width: 800px; width: 95%; height: 85vh; display: flex; flex-direction: column;">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      <div class="settings-modal-header" style="flex-shrink: 0;">
        <div class="settings-title-wrap">
          <div class="settings-title-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div>
            <h2 id="settings-modal-title" class="settings-modal-title">Toolbox Settings</h2>
            <p class="settings-modal-subtitle">Appearance, Assistant Configuration, and Cloud Data</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-settings" aria-label="Close Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body" style="flex: 1; overflow-y: auto; padding-bottom: 40px;">
        <!-- PROFILE & DISPLAY PICTURE -->
        <section class="settings-section" id="profile-settings-container">
          <!-- Rendered dynamically -->
        </section>

        <hr style="border: none; border-top: 1px solid var(--g200); margin: 30px 0;">

        <!-- APPEARANCE -->
        <section class="settings-section">
          <div class="settings-section-header">
            <h3 class="settings-section-title">Color Themes</h3>
            <span class="settings-section-hint">Applied instantly across all tools</span>
          </div>
          <div class="theme-grid" id="theme-grid-standard">
            <!-- Rendered dynamically -->
          </div>
        </section>

        <hr style="border: none; border-top: 1px solid var(--g200); margin: 30px 0;">

        <!-- ASSISTANT / AI -->
        <section class="settings-section" id="ai-settings-container">
          <!-- Rendered dynamically -->
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Close triggers
  modalEl.querySelector('#close-settings').addEventListener('click', closeSettings);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeSettings();
  });

  return modalEl;
}

function renderProfileSettings() {
  const container = modalEl.querySelector('#profile-settings-container');
  if (!container) return;

  const user = getCurrentUser();
  const settings = getSettings();
  const activePicId = user?.profilePicture || user?.user_metadata?.profile_picture || settings.profilePicture || 'default';
  const currentDisplayName = user?.displayName || user?.user_metadata?.display_name || settings.displayName || '';

  if (!user) {
    container.innerHTML = `
      <div class="settings-section-header">
        <h3 class="settings-section-title">Profile &amp; Display Picture</h3>
        <span class="settings-section-hint">Signed-in users can customize display name and avatar</span>
      </div>
      <div style="background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${getUserAvatarHtml('default', 42)}
          <div>
            <div style="font-size:0.86rem; font-weight:700; color:var(--black);">Sign in to customize your profile</div>
            <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">Set your display name and choose a minimal profile picture.</div>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-settings-signin" style="font-size:0.8rem; padding:6px 14px;">
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
    <div class="settings-section-header">
      <h3 class="settings-section-title">Profile &amp; Display Picture</h3>
      <span class="settings-section-hint">Customize how your name and avatar appear across Toolbox</span>
    </div>

    <div style="background:var(--g50); border:1px solid var(--g200); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:16px;">
      
      <!-- Top Row: Current Avatar & Display Name Input -->
      <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
        <div id="settings-avatar-current-preview" style="flex-shrink:0;">
          ${getUserAvatarHtml(activePicId, 54)}
        </div>
        <div style="flex:1; min-width:200px;">
          <label for="settings-profile-display-name" style="display:block; font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">
            Display Name
          </label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="settings-profile-display-name" class="tool-input" placeholder="e.g. Alex" value="${escapeHtml(currentDisplayName)}" style="flex:1; height:36px; padding:0 12px; font-size:0.86rem; border-radius:8px;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-settings-save-name" style="padding:0 14px; height:36px; font-size:0.8rem; font-weight:600;">
              Save
            </button>
          </div>
          <div id="settings-profile-msg" style="font-size:0.74rem; color:var(--g600); margin-top:4px;">
            ${escapeHtml(user.email)} · Saved to your account session.
          </div>
        </div>
      </div>

      <!-- Bottom Row: Avatar Selection Grid -->
      <div style="border-top:1px solid var(--g200); padding-top:14px;">
        <div style="font-size:0.78rem; font-weight:700; color:var(--black); margin-bottom:10px;">
          Choose Display Picture
        </div>
        <div class="settings-avatar-grid" id="settings-avatar-picker-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(46px, 1fr)); gap:10px;">
          ${PROFILE_PICTURES.map(pic => {
            const isSelected = pic.id === activePicId;
            const src = getProfilePictureSrc(pic.id);
            return `
              <button type="button" class="avatar-option-btn ${isSelected ? 'is-selected' : ''}" data-avatar-id="${pic.id}" title="${escapeHtml(pic.name)}" style="width:46px; height:46px; border-radius:50%; padding:0; border:${isSelected ? '2px solid var(--black, #000)' : '1px solid var(--border)'}; background:var(--bg-card); cursor:pointer; position:relative; display:flex; align-items:center; justify-content:center; box-shadow:${isSelected ? '0 0 0 2px var(--accent, #3b82f6)' : 'none'}; transition:all 0.15s ease; overflow:hidden;">
                ${src ? `
                  <img src="${src}" alt="${escapeHtml(pic.name)}" style="width:100%; height:100%; object-fit:cover;">
                ` : `
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text);">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                `}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire Save Name button and Enter key
  const nameInput = container.querySelector('#settings-profile-display-name');
  const saveNameBtn = container.querySelector('#btn-settings-save-name');
  const msgEl = container.querySelector('#settings-profile-msg');

  const handleSaveName = () => {
    const val = nameInput.value.trim();
    updateUserProfile({ displayName: val });
    updateSettings({ displayName: val });
    if (msgEl) {
      msgEl.textContent = 'Display name saved!';
      msgEl.style.color = '#10b981';
      setTimeout(() => {
        msgEl.textContent = `${user.email} · Saved to your account session.`;
        msgEl.style.color = 'var(--g600)';
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

  // Wire Avatar selection
  container.querySelectorAll('.avatar-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-avatar-id');
      const src = getProfilePictureSrc(id);
      updateUserProfile({ profilePicture: id, avatarUrl: src });
      updateSettings({ profilePicture: id });
      renderProfileSettings();
    });
  });
}

function renderAiSettings() {
  const container = modalEl.querySelector('#ai-settings-container');
  if (!container) return;

  const user = getCurrentUser();
  const settings = getSettings();
  const quota = user ? QuotaManager.getQuotaSummary() : null;
  const isUnlimited = user ? QuotaManager.isUserUnlimited() : false;

  container.style.display = 'block';

  container.innerHTML = `
    <div class="settings-section-header">
      <h3 class="settings-section-title">Assistant AI</h3>
      <span class="settings-section-hint">Response animation and assistant configuration</span>
    </div>

    <!-- ASSISTANT RESPONSE ANIMATION CONTROLS -->
    <div style="background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:14px 16px; margin-bottom:14px; display:flex; flex-direction:column; gap:12px;">
      <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--black);">Response text animation</div>
          <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">
            Animate assistant message text dynamically as responses are generated
          </div>
        </div>
        <input type="checkbox" id="settings-ast-anim-toggle" class="pref-switch" ${settings.assistantResponseAnimation !== false ? 'checked' : ''}>
      </label>

      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--g200); flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:0.84rem; font-weight:700; color:var(--black);">Animation style</div>
          <div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">
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
      <div style="padding-top:10px; border-top:1px solid var(--g200);">
        <div class="ast-anim-preview-box" id="settings-ast-anim-preview-box" style="justify-content:center; text-align:center;">
          <span class="ast-anim-preview-text" id="settings-ast-anim-preview-text">Animation preview</span>
        </div>
      </div>
    </div>

    ${user ? `
    <!-- QUOTAS & RESET -->
    <div style="background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:0.84rem; font-weight:700; color:var(--black);">Daily Messages</div>
        <div style="font-size:0.75rem; color:var(--g600); font-family:monospace; margin-top:2px;">
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

  // Reset Quota
  const resetBtn = container.querySelector('#btn-reset-quota-modal');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try {
        QuotaManager.resetQuotas();
        renderAiSettings();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

function updateThemeList() {
  const currentId = getStoredTheme();
  const standardGrid = modalEl.querySelector('#theme-grid-standard');

  standardGrid.innerHTML = THEMES.map(t => renderThemeCard(t, currentId)).join('');

  modalEl.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.getAttribute('data-theme-id');
      applyTheme(themeId);
      updateThemeList();
    });
  });
}

export function openSettings() {
  createModal();
  renderProfileSettings();
  updateThemeList();
  renderAiSettings();
  modalEl.style.display = 'flex';
  requestAnimationFrame(() => {
    modalEl.classList.add('is-open');
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
    settingsBtn.addEventListener('click', openSettings);
  }

  // Keyboard shortcut listener (Escape closes modal)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeSettings();
    }
  });
}
