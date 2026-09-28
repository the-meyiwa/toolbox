/* ============================================================
   Right-click menus for the parts of the app that are not a tool's
   own UI: any link to a tool, the tool viewport, the page itself.

   Tools with their own menus (Files, Notes, Calendar, the 3D tools,
   the Playground, the kit shells) handle the event first and call
   preventDefault; this only fills in where nothing else has.
   ============================================================ */

import { BY_ID } from '../registry/index.js';
import { openContextMenu } from './context-menu.js';
import { actionsFor, askAssistant } from './interop.js';
import { recent } from './recent.js';
import { copyText } from '../utils.js';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
const toolUrl = (id) => `${location.origin}${location.pathname}#${id}`;

/** Menu for a tool named by a link or card. */
export function toolLinkItems(tool) {
  return [
    { label: 'Open', action: () => { location.hash = `#${tool.id}`; } },
    { label: 'Open beside current tool', disabled: !document.body.classList.contains('in-tool'), action: async () => (await import('./workspace.js')).openBeside(tool.id) },
    { label: 'Open in new tab', action: () => window.open(toolUrl(tool.id), '_blank', 'noopener') },
    { separator: true },
    { label: 'Copy link', action: () => copyText(toolUrl(tool.id)) },
    { label: `Ask Assistant how to use ${tool.name}`, action: async () => (await import('./assistant-popup.js')).openAssistant({ prompt: `How do I use the ${tool.name} tool? ${tool.description}.`, send: true }) },
  ];
}

/** Recent results as a submenu-like block. */
function recentItems(limit = 4) {
  const r = recent().slice(0, limit);
  if (!r.length) return [];
  return [{ heading: 'Recent work' }, ...r.map((item) => ({
    label: item.name,
    hint: `From ${BY_ID.get(item.from)?.name || 'Toolbox'}`,
    action: (e) => {
      // Open the menu for that item where the page menu was.
      const at = window.__lastMenuPoint || { x: 80, y: 80 };
      openContextMenu({ x: at.x, y: at.y, title: item.name, items: actionsFor(item) });
      void e;
    },
  }))];
}

/**
 * Menu for the open tool: its current result (open elsewhere, save,
 * send beside, ask the Assistant), then workspace and link actions.
 */
export function toolViewportItems({ tool, instance }) {
  const items = [];
  const custom = typeof instance?.getContextMenu === 'function' ? instance.getContextMenu() : null;
  if (custom?.length) items.push(...custom, { separator: true });
  const art = typeof instance?.getArtifact === 'function' ? instance.getArtifact() : null;
  if (art && (art.text || art.blob)) {
    const item = { name: art.name || `${tool.id}-result`, kind: art.kind, text: art.text, blob: art.blob, from: tool.id };
    items.push({ heading: 'This result' });
    if (art.text) items.push({ label: 'Copy result', action: () => copyText(art.text) });
    items.push(...actionsFor(item, { exclude: tool.id }), { separator: true });
  }
  const beside = document.body.classList.contains('has-beside');
  items.push(
    { label: beside ? 'Change the tool beside' : 'Open another tool beside', action: async () => (await import('./workspace.js')).openBeside(null) },
    ...(beside ? [{ label: 'Close the tool beside', action: async () => (await import('./workspace.js')).closeBeside() }] : []),
    { label: `Ask Assistant about ${tool.name}`, action: () => (art && (art.text || art.blob)
      ? askAssistant({ name: art.name || `${tool.id}-result`, kind: art.kind, text: art.text, blob: art.blob }, `This came from ${tool.name}. `)
      : import('./assistant-popup.js').then((m) => m.openAssistant({ prompt: `Help me with ${tool.name}: `, send: false }))) },
    { separator: true },
    { label: 'Copy link to this tool', action: () => copyText(toolUrl(tool.id)) },
  );
  if (new URLSearchParams(location.search).get('standalone') !== 'true') items.push({ label: 'Open in new tab', action: () => window.open(toolUrl(tool.id), '_blank', 'noopener') });
  return items;
}

/** Page-level menu where nothing more specific applies. */
function pageItems() {
  return [
    { label: 'Search tools', shortcut: '/', action: async () => (await import('./palette.js')).openPalette() },
    { label: 'Open Assistant', action: async () => (await import('./assistant-popup.js')).openAssistant({ send: false }) },
    { label: 'Files', action: () => { location.hash = '#saved'; } },
    { label: 'All tools', action: () => { location.hash = '#tools'; } },
    ...recentItems(),
    { separator: true },
    { label: 'Switch light / dark', action: () => document.querySelector('#theme-toggle, [data-act="theme"], .theme-toggle')?.click() },
    { label: 'Reload', action: () => location.reload() },
  ];
}

/**
 * Install once. `getTool()` returns { tool, instance } for the open tool
 * (or null), so the viewport menu reflects the live result.
 */
export function installGlobalMenus({ getTool }) {
  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    const el = e.target instanceof Element ? e.target : e.target?.parentElement;
    if (!el || el.closest(EDITABLE)) return;
    if (el.closest('#toolbox-context-menu, .finder-context-menu, #sv-finder-menu, #cpg-ctx-menu')) return;
    // Text the person selected: let the browser's menu (copy, look up) handle it.
    if (window.getSelection()?.toString().trim()) return;
    window.__lastMenuPoint = { x: e.clientX, y: e.clientY };

    const link = el.closest('a[href^="#"], [data-tool]');
    const id = link ? (link.dataset.tool || link.getAttribute('href').slice(1)) : null;
    const linked = id && BY_ID.get(id);
    if (linked && !el.closest('#viewport-content .kit, .beside-body')) {
      e.preventDefault();
      openContextMenu({ x: e.clientX, y: e.clientY, title: linked.name, items: toolLinkItems(linked) });
      return;
    }
    const open = getTool();
    if (open?.tool && el.closest('#tool-viewport')) {
      e.preventDefault();
      openContextMenu({ x: e.clientX, y: e.clientY, title: open.tool.name, items: toolViewportItems(open) });
      return;
    }
    if (el.closest('.beside')) return;
    if (el.closest('a[href], button, audio, video, img, canvas, iframe')) return;
    e.preventDefault();
    openContextMenu({ x: e.clientX, y: e.clientY, title: 'Toolbox', items: pageItems() });
  });
}
