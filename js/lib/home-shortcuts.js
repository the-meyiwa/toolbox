/* ============================================================
   TOOLBOX — Home shortcuts

   The row of tools under the Home search. By default it follows what
   is used most; in Settings → General → Home shortcuts a person can
   pick their own (up to MAX, in their own order). An empty choice
   means "automatic" again.
   ============================================================ */

import { BY_ID, popular } from '../registry/index.js';
import { getSetting, updateSettings } from './settings.js';

export const MAX_SHORTCUTS = 8;
const AUTO_COUNT = 6;

/** The ids the person picked, cleaned of tools that no longer exist. */
export function chosenShortcutIds() {
  const raw = getSetting('homeShortcuts');
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(id => typeof id === 'string' && BY_ID.has(id) && !BY_ID.get(id).hidden && !seen.has(id) && seen.add(id)).slice(0, MAX_SHORTCUTS);
}

/** True once the person has chosen (including choosing none at all). */
export const isCustomShortcuts = () => { const raw = getSetting('homeShortcuts'); return Array.isArray(raw) && raw.length > 0; };
const NONE = '__none__';

/** The tools to show, limited to `visible` (what this person and device can open). */
export function homeShortcutTools(visible) {
  const allowed = new Set(visible.map(t => t.id));
  if (isCustomShortcuts()) return chosenShortcutIds().filter(id => allowed.has(id)).map(id => BY_ID.get(id));
  return popular(12).filter(t => t.id !== 'assistant' && allowed.has(t.id)).slice(0, AUTO_COUNT);
}

export function setShortcutIds(ids) {
  const clean = [];
  for (const id of ids) if (BY_ID.has(id) && !clean.includes(id)) clean.push(id);
  // An explicit empty choice is remembered as such, so it does not fall back to automatic.
  updateSettings({ homeShortcuts: clean.length ? clean.slice(0, MAX_SHORTCUTS) : [NONE] });
}

/** Starting point for editing: the person's own list, or what "automatic" shows today. */
export function editableShortcutIds(visible) {
  return isCustomShortcuts() ? chosenShortcutIds() : homeShortcutTools(visible).map(t => t.id);
}
