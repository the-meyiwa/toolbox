/* ============================================================
   TOOLBOX — Settings Menu & Theme Customizer Modal
   ============================================================ */

import { THEMES, getStoredTheme, applyTheme } from './theme.js';

let modalEl = null;
let isOpen = false;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderThemeCard(theme, currentId) {
  const isActive = theme.id === currentId;
  const isExperimental = theme.experimental;

  return `
    <button type="button" class="theme-card ${isActive ? 'is-active' : ''} ${isExperimental ? 'is-experimental' : ''}" data-theme-id="${theme.id}" role="radio" aria-checked="${isActive}">
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
          ${isExperimental ? '<span class="theme-badge-exp">Experimental</span>' : ''}
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
    <div class="settings-modal-window">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      <div class="settings-modal-header">
        <div class="settings-title-wrap">
          <div class="settings-title-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div>
            <h2 id="settings-modal-title" class="settings-modal-title">Settings & Appearance</h2>
            <p class="settings-modal-subtitle">Personalize your Toolbox workspace with custom curated themes.</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-settings" aria-label="Close Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body">
        <section class="settings-section">
          <div class="settings-section-header">
            <h3 class="settings-section-title">Color Themes</h3>
            <span class="settings-section-hint">Applied instantly across all tools</span>
          </div>

          <div class="theme-grid" id="theme-grid-standard">
            <!-- Rendered dynamically -->
          </div>
        </section>

        <section class="settings-section" style="margin-top: 24px;">
          <div class="settings-section-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 class="settings-section-title">Experimental UI Themes</h3>
              <span class="theme-badge-exp" style="font-size:0.68rem;">Experimental</span>
            </div>
            <span class="settings-section-hint">High-aesthetic glass, synthwave & parchment layouts</span>
          </div>

          <div class="theme-grid" id="theme-grid-experimental">
            <!-- Rendered dynamically -->
          </div>
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

function updateThemeList() {
  const currentId = getStoredTheme();
  const standardGrid = modalEl.querySelector('#theme-grid-standard');
  const experimentalGrid = modalEl.querySelector('#theme-grid-experimental');

  const standards = THEMES.filter(t => !t.experimental);
  const experimentals = THEMES.filter(t => t.experimental);

  standardGrid.innerHTML = standards.map(t => renderThemeCard(t, currentId)).join('');
  experimentalGrid.innerHTML = experimentals.map(t => renderThemeCard(t, currentId)).join('');

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
