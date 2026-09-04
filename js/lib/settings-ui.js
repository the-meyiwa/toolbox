/* ============================================================
   TOOLBOX — Unified Settings Menu
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser } from './supabase.js';
import { getSettings, updateSettings } from './settings.js';

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
