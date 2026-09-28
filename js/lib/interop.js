/* ============================================================
   Interop: one way for any piece of work to move anywhere.

   A piece of work is { name, kind, text } or { name, kind, blob }.
   From anywhere it can be
     opened in any tool that accepts its kind   (openIn)
     saved to Toolbox Files                     (saveToFiles)
     handed to the Assistant with a question    (askAssistant)
     dropped in the other workspace pane        (sendToPane)
   and every result a tool makes is remembered in Recent (recent.js),
   so the next tool, the Files page and the Assistant can all pick it
   up. Tools never name each other: the registry's accepts/produces
   decide who can take what.
   ============================================================ */

import { BY_ID, toolsAccepting } from '../registry/index.js';
import { kindFromFilename, kindExt, kindMime } from '../registry/kinds.js';
import { handOff } from './artifacts.js';
import { remember } from './recent.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The artifact kind for a file name and/or MIME type. */
export function kindOf(name = '', type = '') {
  const t = String(type).toLowerCase();
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('image/svg')) return 'svg';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return kindFromFilename(name);
}

const isText = (kind) => !['pdf', 'image', 'video', 'audio', 'docx', 'binary', 'archive'].includes(kind);

/** Normalise anything (File, Blob, {name, data}, {text}) into a work item. */
export async function toItem(x, { from = null } = {}) {
  if (!x) return null;
  if (typeof File !== 'undefined' && x instanceof File) return { name: x.name, kind: kindOf(x.name, x.type), blob: x, from };
  const name = x.name || x.filename || 'untitled';
  const kind = x.kind || kindOf(name, x.type || x.data?.type || x.blob?.type || '');
  if (x.text != null) return { name, kind, text: String(x.text), from: x.from || from };
  let blob = x.blob || x.data || x.content || null;
  if (blob && !(blob instanceof Blob)) blob = new Blob([blob], { type: x.type || kindMime(kind) });
  if (blob && isText(kind) && blob.size < 2_000_000) return { name, kind, text: await blob.text(), blob, from: x.from || from };
  return { name, kind, blob, from: x.from || from };
}

/** Tools that can open this kind, most useful first. */
export function targetsFor(kind, { exclude = null } = {}) {
  // Specialists first: a tool that takes anything (checksum, zip) is rarely
  // the one meant, so it sorts after every tool made for this kind.
  const generic = (t) => ((t.accepts || []).length >= 5 ? 1 : 0);
  return toolsAccepting(kind, exclude ? { exclude } : undefined)
    .filter((t) => !t.hidden)
    .sort((a, b) => generic(a) - generic(b) || (b.weight ?? 50) - (a.weight ?? 50));
}

/** Open a work item in a tool. */
export function openIn(toolId, item) {
  const tool = BY_ID.get(toolId);
  if (!tool || !item) return false;
  handOff({ kind: item.kind, name: item.name, text: item.text, blob: item.blob, content: item.blob || item.text, from: item.from || 'interop' });
  window.location.hash = `#${toolId}`;
  return true;
}

/** Save to Toolbox Files, in a folder per source tool. Returns the path. */
export async function saveToFiles(item, { folder = null } = {}) {
  const { fs } = await import('./filesystem.js');
  const dir = folder || `/Toolbox/${item.from && BY_ID.get(item.from) ? BY_ID.get(item.from).name.replace(/[<>:"|?*/\\]/g, '-') : 'Outputs'}`;
  try { await fs.mkdir('/Toolbox'); } catch { /* exists */ }
  try { await fs.mkdir(dir); } catch { /* exists */ }
  let name = item.name || `untitled.${kindExt(item.kind)}`;
  const taken = async (n) => { try { await fs.stat(`${dir}/${n}`); return true; } catch { return false; } };
  for (let i = 2; await taken(name) && i < 100; i++) name = (item.name || 'untitled').replace(/(\.[^.]+)?$/, ` (${i})$1`);
  const path = `${dir}/${name}`;
  if (item.text != null && !item.blob) await fs.writeFile(path, item.text, { mimeType: kindMime(item.kind) });
  else await fs.writeFile(path, item.blob, { encoding: 'blob', mimeType: item.blob.type || kindMime(item.kind) });
  return path;
}

/** Hand the item to the Assistant, with an optional question. */
export async function askAssistant(item, prompt = '') {
  const { openAssistant } = await import('./assistant-popup.js');
  const blob = item.blob || new Blob([item.text ?? ''], { type: kindMime(item.kind) });
  const file = typeof File === 'function' ? new File([blob], item.name || 'file', { type: blob.type || kindMime(item.kind) }) : blob;
  return openAssistant({ prompt, artifact: { file, from: 'ask-assistant', prompt }, send: false });
}

/** Wait briefly for a hand-off whose body is still loading (Files reads it after navigating). */
export async function handoffBlob(item, waitMs = 4000) {
  const start = performance.now();
  while (performance.now() - start < waitMs) {
    const b = item.blob || (item.content instanceof Blob ? item.content : null);
    if (b) return b;
    await new Promise((r) => setTimeout(r, 60));
  }
  return null;
}

/** Put a work item into a tool's own file input and fire its change event, as a drop would. */
export async function deliverToFileInput(host, item) {
  const blob = await handoffBlob(item);
  const input = host.querySelector('input[type="file"]');
  if (!blob || !input || typeof DataTransfer !== 'function') return false;
  const dt = new DataTransfer();
  dt.items.add(new File([blob], item.name || 'file', { type: blob.type }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Give a work item to a mounted tool instance, whichever way it takes work. */
export async function giveToTool(instance, host, item) {
  if (typeof instance?.setArtifact === 'function') { await instance.setArtifact({ ...item, content: item.blob || item.text }); return true; }
  return deliverToFileInput(host, item);
}

/** Remember a result so every other tool, Files and the Assistant can reach it. */
export function publish(item) { if (item) remember(item); return item; }

/* ---------------- the actions menu ---------------- */

/**
 * Context-menu items (js/lib/context-menu.js) for a work item:
 * Open in <each tool that takes it>, Save to Files, Download, Ask Assistant.
 */
export function actionsFor(item, { exclude = null, download = null, notify = () => {} } = {}) {
  const out = [];
  const targets = targetsFor(item.kind, { exclude }).slice(0, 8);
  if (targets.length) {
    out.push({ heading: 'Open in' });
    for (const t of targets) out.push({ label: t.name, icon: t.icon, action: () => openIn(t.id, item) });
    out.push({ separator: true });
  }
  // The workspace: the tool beside this one, or open one there.
  const side = typeof document !== 'undefined' && document.body.classList.contains('has-beside')
    ? document.querySelector('.beside')?.querySelector('.beside-name')?.textContent : null;
  const sideTool = side ? [...BY_ID.values()].find((t) => t.name === side) : null;
  if (sideTool && sideTool.id !== exclude && (sideTool.accepts || []).includes(item.kind)) {
    out.push({ label: `Send to ${sideTool.name} (beside)`, action: async () => (await import('./workspace.js')).sendBeside(item) });
  } else if (targets[0]) {
    out.push({ label: `Open beside in ${targets[0].name}`, action: async () => (await import('./workspace.js')).openBeside(targets[0].id, item) });
  }
  out.push({ label: 'Save to Files', action: async () => { try { notify(`Saved to ${await saveToFiles(item)}`); } catch (e) { notify(`Could not save: ${e.message}`, 'error'); } } });
  if (download) out.push({ label: 'Download', action: download });
  out.push({ label: 'Ask Assistant about this', action: () => askAssistant(item) });
  return out;
}

/** An "Open in…" button that opens the same actions as a dropdown. */
export function actionsButton(item, opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary btn-sm io-open-btn';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.textContent = opts.label || 'Open in…';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const { openContextMenu } = await import('./context-menu.js');
    const r = btn.getBoundingClientRect();
    openContextMenu({ x: r.left, y: r.bottom + 6, items: actionsFor(item, opts), title: item.name, label: `Actions for ${item.name}` });
  });
  return btn;
}

/* ---------------- choosing work from Recent and Files ---------------- */

/**
 * A dialog listing recent results and Toolbox Files of the given kinds.
 * Resolves with the chosen items (loaded, with blobs) or [] if dismissed.
 */
export async function pickWork({ kinds = null, multiple = false, title = 'Use earlier work' } = {}) {
  const { recent } = await import('./recent.js');
  const want = kinds ? new Set([].concat(kinds)) : null;
  const rec = recent(kinds);
  let stored = [];
  try {
    const { fs } = await import('./filesystem.js');
    stored = (await fs.listAllMeta()).filter((m) => !m.isDirectory && (!want || want.has(kindOf(m.name, m.mimeType || m.type || ''))))
      .sort((a, b) => (b.modifiedAt || b.updatedAt || 0) - (a.modifiedAt || a.updatedAt || 0)).slice(0, 60);
  } catch { /* Files unavailable */ }

  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'io-pick';
    const row = (key, name, meta) => `<label class="io-pick-row"><input type="${multiple ? 'checkbox' : 'radio'}" name="io-pick" value="${esc(key)}"><span class="io-pick-name">${esc(name)}</span><span class="io-pick-meta">${esc(meta)}</span></label>`;
    const when = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleDateString(); };
    root.innerHTML = `
      <div class="io-pick-scrim" data-close></div>
      <div class="io-pick-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h3>${esc(title)}</h3>
        <div class="io-pick-list">
          ${rec.length ? `<p class="io-pick-group">Made in this session</p>${rec.map((r) => row(`r:${r.id}`, r.name, `${BY_ID.get(r.from)?.name || 'Toolbox'} · ${when(r.at)}`)).join('')}` : ''}
          ${stored.length ? `<p class="io-pick-group">Toolbox Files</p>${stored.map((m) => row(`f:${m.path}`, m.name, m.path.replace(/\/[^/]*$/, '') || '/')).join('')}` : ''}
          ${!rec.length && !stored.length ? '<p class="kit-note">Nothing suitable yet. Results you make, and files you save, appear here.</p>' : ''}
        </div>
        <div class="kit-actions io-pick-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button><button type="button" class="btn btn-primary btn-sm" data-ok disabled>Use</button></div>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('is-open'));
    const ok = root.querySelector('[data-ok]');
    root.addEventListener('change', () => { ok.disabled = !root.querySelector('input:checked'); });
    const done = async (chosen) => {
      root.classList.remove('is-open');
      setTimeout(() => root.remove(), 220);
      document.removeEventListener('keydown', onKey, true);
      if (!chosen) return resolve([]);
      const out = [];
      for (const key of chosen) {
        if (key.startsWith('r:')) { const r = rec.find((x) => x.id === key.slice(2)); if (r) out.push(r); }
        else {
          const path = key.slice(2);
          const { fs } = await import('./filesystem.js');
          const blob = await fs.readFile(path, { encoding: 'blob' });
          out.push(await toItem({ name: path.split('/').pop(), blob, from: 'files' }));
        }
      }
      resolve(out);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) done(null);
      else if (e.target.closest('[data-ok]')) done([...root.querySelectorAll('input:checked')].map((i) => i.value));
    });
    root.addEventListener('dblclick', (e) => { const i = e.target.closest('.io-pick-row')?.querySelector('input'); if (i && !multiple) done([i.value]); });
    root.querySelector('input')?.focus();
  });
}
