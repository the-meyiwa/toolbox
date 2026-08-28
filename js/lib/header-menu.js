/* ============================================================
   TOOLBOX — Header Dropdown Menu & Quick Action Hub
   Provides access to Themes, Browser Storage, Preferences, and Credits.
   ============================================================ */

import { openSettings } from './settings-ui.js';
import { openStorageModal } from './storage-ui.js';
import { getSettings, updateSettings, exportSettings, importSettings } from './settings.js';

let menuEl = null;
let isMenuOpen = false;
let prefModalEl = null;

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
          alert('Settings imported successfully!');
          renderPreferencesContent();
        } else {
          alert('Failed to import settings: ' + result.error);
        }
      };
      reader.readAsText(file);
    }
  });
}

export function openPreferencesModal() {
  createPreferencesModal();
  renderPreferencesContent();
  prefModalEl.style.display = 'flex';
  requestAnimationFrame(() => {
    prefModalEl.classList.add('is-open');
  });
}

export function closePreferencesModal() {
  if (!prefModalEl) return;
  prefModalEl.classList.remove('is-open');
  setTimeout(() => {
    prefModalEl.style.display = 'none';
  }, 200);
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
  const container = document.getElementById('header-actions');
  if (!container) return;

  const btn = document.getElementById('header-menu-btn');
  menuEl = document.getElementById('header-dropdown-menu');

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderMenu();
    });
  }

  // Handle menu item actions
  const itemTheme = document.getElementById('menu-item-theme');
  if (itemTheme) {
    itemTheme.addEventListener('click', () => {
      closeHeaderMenu();
      openSettings();
    });
  }

  const itemStorage = document.getElementById('menu-item-storage');
  if (itemStorage) {
    itemStorage.addEventListener('click', () => {
      closeHeaderMenu();
      openStorageModal();
    });
  }

  const itemSettings = document.getElementById('menu-item-settings');
  if (itemSettings) {
    itemSettings.addEventListener('click', () => {
      closeHeaderMenu();
      openPreferencesModal();
    });
  }

  const itemCredits = document.getElementById('menu-item-credits');
  if (itemCredits) {
    itemCredits.addEventListener('click', () => {
      closeHeaderMenu();
      window.location.hash = '#support';
      const creditsEl = document.getElementById('support-credits');
      if (creditsEl) {
        creditsEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Outside click listener
  window.addEventListener('click', (e) => {
    if (isMenuOpen && menuEl && !menuEl.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
      closeHeaderMenu();
    }
  });

  // Escape key handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isMenuOpen) closeHeaderMenu();
      if (prefModalEl?.classList.contains('is-open')) closePreferencesModal();
    }
  });
}
