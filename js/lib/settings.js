/* ============================================================
   TOOLBOX — Centralized Settings & Preferences Engine
   Provides reliable schema validation, change listeners,
   localStorage persistence, and import/export capabilities.
   ============================================================ */

import { getStoredTheme, applyTheme } from './theme.js';

const STORAGE_KEY = 'toolbox_settings';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'default',
  autoSave: true,
  unitSystem: 'metric', // 'metric' | 'imperial'
  editorWrap: false,
  editorFontSize: 13,   // in pixels
  hapticAudio: true,
  offlineFirst: true,
  assistantResponseAnimation: true,
  assistantAnimationStyle: 'color rave', // 'color rave' | 'glow' | 'Plain Fade' | 'Pop In'
  displayName: '',
  profilePicture: 'default', // 'default' | '<image_file_name>'
});

let currentSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set();

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function loadSettings() {
  const store = getStorage();
  if (store) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.warn('Could not parse stored settings, using defaults.', err);
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  }

  // Ensure theme syncs with theme module if available
  try {
    currentSettings.theme = getStoredTheme();
  } catch {}
  
  return currentSettings;
}

function saveSettings() {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (err) {
    console.error('Failed to persist settings to localStorage:', err);
  }
}

export function getSettings() {
  return { ...currentSettings };
}

export function getSetting(key) {
  return currentSettings[key] !== undefined ? currentSettings[key] : DEFAULT_SETTINGS[key];
}

export function updateSettings(partial) {
  const previous = { ...currentSettings };
  currentSettings = { ...currentSettings, ...partial };

  if (partial.theme && partial.theme !== previous.theme) {
    try {
      applyTheme(partial.theme);
    } catch {}
  }

  saveSettings();
  notifyListeners(currentSettings, previous);
  return currentSettings;
}

export function resetSettings() {
  return updateSettings({ ...DEFAULT_SETTINGS });
}

export function exportSettings() {
  const data = JSON.stringify(currentSettings, null, 2);
  if (typeof Blob === 'undefined' || typeof document === 'undefined') return data;

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `toolbox-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return data;
}

export function importSettings(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid settings JSON');
    
    const valid = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (parsed[key] !== undefined) {
        valid[key] = parsed[key];
      }
    }

    updateSettings(valid);
    return { success: true, settings: currentSettings };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners(current, previous) {
  for (const fn of listeners) {
    try {
      fn(current, previous);
    } catch (e) {
      console.error('Settings listener error:', e);
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toolbox:settingschange', { detail: { settings: current, previous } }));
  }
}

// Initialize on load
loadSettings();
