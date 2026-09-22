/* ============================================================
   TOOLBOX — Per-tool preferences
   Every tool that has settings declares them in
   js/registry/tool-settings.js. Values live inside the main
   settings object (settings.tools[toolId]) so they travel with
   settings export / import, and they are edited only from
   Preferences → Tools.
   ============================================================ */

import { getSetting, updateSettings, onSettingsChange } from './settings.js';
import { TOOL_SETTINGS } from '../registry/tool-settings.js';

const EVENT = 'toolbox:toolsettings';

function fieldsOf(id) {
  const schema = TOOL_SETTINGS[id];
  if (!schema) return [];
  return schema.groups.flatMap(g => g.fields);
}

export function hasToolSettings(id) { return Boolean(TOOL_SETTINGS[id]); }
export function getToolSettingsSchema(id) { return TOOL_SETTINGS[id] || null; }
export function listToolSettings() {
  return Object.entries(TOOL_SETTINGS).map(([id, schema]) => ({ id, ...schema }));
}

export function toolDefaults(id) {
  const out = {};
  for (const field of fieldsOf(id)) out[field.key] = field.default;
  return out;
}

/** Current values for a tool: defaults merged with anything the person changed. */
export function getToolSettings(id) {
  const stored = (getSetting('tools') || {})[id] || {};
  const out = toolDefaults(id);
  for (const field of fieldsOf(id)) {
    const v = stored[field.key];
    if (v === undefined) continue;
    if (field.type === 'toggle' && typeof v !== 'boolean') continue;
    if (field.type === 'range' && (typeof v !== 'number' || v < field.min || v > field.max)) continue;
    out[field.key] = v;
  }
  return out;
}

let quiet = false;   // set while this module writes, so the generic listener does not fire twice

function writeTools(all) {
  quiet = true;
  try { updateSettings({ tools: all }); } finally { quiet = false; }
}

export function setToolSetting(id, key, value) {
  const all = { ...(getSetting('tools') || {}) };
  all[id] = { ...(all[id] || {}), [key]: value };
  writeTools(all);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, key, value, settings: getToolSettings(id) } }));
}

export function resetToolSettings(id) {
  const all = { ...(getSetting('tools') || {}) };
  delete all[id];
  writeTools(all);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, key: null, value: null, settings: getToolSettings(id) } }));
}

/** Subscribe to one tool's settings. Also fires when settings are imported or reset globally. */
export function onToolSettings(id, fn) {
  const handler = (e) => { if (e.detail?.id === id) fn(e.detail.settings, e.detail.key); };
  window.addEventListener(EVENT, handler);
  const off = onSettingsChange((cur, prev) => {
    if (!quiet && cur.tools !== prev.tools) fn(getToolSettings(id), null);
  });
  return () => { window.removeEventListener(EVENT, handler); off(); };
}
