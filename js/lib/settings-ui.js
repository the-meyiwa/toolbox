/* ============================================================
   TOOLBOX — Unified Settings Menu
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';
import {
  getActiveAiMode,
  setActiveAiMode,
  getGeminiApiKey,
  setGeminiApiKey,
  testAiProviderConnection,
  AI_MODES
} from './ai-provider.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser } from './supabase.js';

let modalEl = null;
let isOpen = false;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MODE_ICONS = {
  auto: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  reasoning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>`,
  code: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  science: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31L4.15 19.3A2 2 0 0 0 5.86 22h12.28a2 2 0 0 0 1.71-2.7L14 9.31V2"/></svg>`,
  files: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
};

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
  const user = getCurrentUser();
  const container = modalEl.querySelector('#ai-settings-container');
  if (!container) return;

  const hr = container.previousElementSibling;
  if (!user) {
    container.style.display = 'none';
    if (hr && hr.tagName === 'HR') hr.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  if (hr && hr.tagName === 'HR') hr.style.display = 'block';

  const currentMode = getActiveAiMode();
  const currentApiKey = getGeminiApiKey();
  const quota = QuotaManager.getQuotaSummary();
  const isUnlimited = QuotaManager.isUserUnlimited();

  container.innerHTML = `
    <div class="settings-section-header">
      <h3 class="settings-section-title">Assistant AI</h3>
      <span class="settings-section-hint">Configure reasoning mode and view assistant capabilities</span>
    </div>



    <!-- MODE SELECTION CARDS -->
    <div style="margin-bottom: 20px;">
      <label style="font-size:0.75rem; font-weight:700; color:var(--g700); text-transform:uppercase; display:block; margin-bottom:8px;">
        Reasoning Mode
      </label>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:12px;" id="ai-modes-list">
        ${Object.values(AI_MODES).map(m => {
          const isActive = m.id === currentMode;
          const iconSvg = MODE_ICONS[m.id] || MODE_ICONS.auto;
          return `
            <div class="ai-mode-card ${isActive ? 'active' : ''}" data-mode="${m.id}" style="border:2px solid ${isActive ? 'var(--black)' : 'var(--g200)'}; background:${isActive ? 'var(--g100)' : 'var(--white)'}; border-radius:12px; padding:12px 14px; cursor:pointer; transition:all 0.15s; display:flex; align-items:flex-start; gap:12px;">
              <div style="width:34px; height:34px; border-radius:8px; background:${isActive ? 'var(--black)' : 'var(--g200)'}; color:${isActive ? 'var(--white)' : 'var(--black)'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${iconSvg}
              </div>
              <div style="flex: 1;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                  <span style="font-size:0.88rem; font-weight:700; color:var(--black);">${m.name}</span>
                  ${isActive ? '<span style="font-size:0.62rem; background:var(--black); color:#fff; padding:1px 6px; border-radius:999px; font-weight:700;">Active</span>' : ''}
                </div>
                <div style="font-size:0.75rem; color:var(--g600); margin-top:4px; line-height:1.35;">${m.description}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- QUOTAS & RESET -->
    <div style="background:var(--g50); border:1px solid var(--g200); border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:0.8rem; font-weight:700; color:var(--black);">Daily Messages</div>
        <div style="font-size:0.74rem; color:var(--g600); font-family:monospace; margin-top:2px;">
          ${quota.messagesUsed} / ${quota.messagesLimit} used today
        </div>
      </div>
      ${isUnlimited ? `
      <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-quota-modal" style="font-size:0.74rem; color:#ef4444;">
        Reset Count
      </button>
      ` : ''}
    </div>
  `;



  // Mode Selection
  container.querySelectorAll('.ai-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.getAttribute('data-mode');
      setActiveAiMode(mode);
      renderAiSettings();
    });
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
