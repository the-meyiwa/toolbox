/* ============================================================
   The artifact strip.

   One control strip, shared by every tool that has something worth
   keeping. It appears under the tool and nowhere else, and only for
   tools that declare `getArtifact()` — so a person who came to count
   words never sees a single word about saving, workspaces or files.

   The strip pulls from the tool rather than the tool pushing to it:
   nothing is read until the user actually asks for Save, Download or
   Open in. That keeps the coupling to one optional method.
   ============================================================ */

import * as store from './artifacts.js';
import { kindLabel, kindExt } from '../registry/kinds.js';
import { toolsAccepting } from '../registry/index.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {HTMLElement} host      Where the strip is mounted.
 * @param {object}      opts
 * @param {object}      opts.tool      Registry entry for the open tool.
 * @param {object}      opts.instance  The tool module's default export.
 * @param {object|null} opts.incoming  Artifact this tool was opened with.
 * @returns {() => void} teardown
 */
export function mountArtifactStrip(host, { tool, instance, incoming }) {
  if (typeof instance?.getArtifact !== 'function') return () => {};

  const produces = tool.produces ?? [];
  if (!produces.length) return () => {};

  /* The id of the saved artifact this strip is currently attached to.
     Set when the tool was opened from saved work, or after a first save,
     so Save updates in place instead of piling up copies. */
  let boundId = incoming?.id ?? null;
  let boundName = incoming?.name ?? '';

  const strip = document.createElement('div');
  strip.className = 'art-strip';
  strip.innerHTML = `
    <div class="art-strip-main">
      <label class="art-name-label" for="art-name">Name</label>
      <input type="text" class="tool-input art-name" id="art-name" spellcheck="false" autocomplete="off"
             placeholder="untitled.${kindExt(produces[0])}" value="${escapeHtml(boundName)}">
      <div class="art-actions">
        <button class="btn btn-primary btn-sm" data-act="save">Save</button>
        <button class="btn btn-secondary btn-sm" data-act="export">Download</button>
        <div class="art-menu-wrap">
          <button class="btn btn-secondary btn-sm" data-act="open-in" aria-haspopup="true" aria-expanded="false">Open in…</button>
          <div class="art-menu" hidden></div>
        </div>
      </div>
    </div>
    <p class="art-note" id="art-note"></p>`;

  host.appendChild(strip);

  const nameInput = strip.querySelector('#art-name');
  const note = strip.querySelector('#art-note');
  const menu = strip.querySelector('.art-menu');
  const openInBtn = strip.querySelector('[data-act="open-in"]');

  /* The strip is the one place that has to be straight with people about
     whether saving actually keeps anything in this browser. */
  const baseNote = store.persistent
    ? 'Saved work stays in this browser. Download it to keep a copy anywhere else.'
    : 'This browser will not keep saved work — private mode, or storage is switched off. Download it to a file instead.';

  function say(message, tone = '') {
    note.textContent = message || baseNote;
    note.className = `art-note${tone ? ` is-${tone}` : ''}`;
  }
  say();

  /** Read the tool's current work, or explain why there is none. */
  function pull() {
    let art;
    try {
      art = instance.getArtifact();
    } catch (err) {
      console.error('tool could not produce an artifact', err);
      say('This tool could not hand over its result.', 'bad');
      return null;
    }
    if (!art || typeof art.text !== 'string' || !art.text.trim()) {
      say('There is nothing to save yet — use the tool first.', 'warn');
      return null;
    }
    return {
      kind: art.kind ?? produces[0],
      text: art.text,
      name: nameInput.value.trim() || art.name || `untitled.${kindExt(art.kind ?? produces[0])}`,
    };
  }

  function doSave() {
    const art = pull();
    if (!art) return;
    try {
      const saved = store.save({ id: boundId ?? undefined, name: art.name, kind: art.kind, text: art.text, from: tool.id });
      boundId = saved.id;
      boundName = saved.name;
      nameInput.value = saved.name;
      say(store.persistent
        ? `Saved as ${saved.name}. It is in this browser only.`
        : `Held as ${saved.name} for this session only — this browser will not keep it.`, 'good');
    } catch (err) {
      say(err.message, 'bad');
    }
  }

  function doExport() {
    const art = pull();
    if (!art) return;
    store.exportOne(art);
    say(`Downloaded ${art.name}.`, 'good');
  }

  function buildMenu() {
    const art = pull();
    if (!art) return false;
    const targets = toolsAccepting(art.kind, { exclude: tool.id });
    if (!targets.length) {
      say(`Nothing else takes ${kindLabel(art.kind)} yet. Download it instead.`, 'warn');
      return false;
    }
    menu.innerHTML = `
      <p class="art-menu-head">Send this ${kindLabel(art.kind)} to</p>
      ${targets.map(t => `
        <button class="art-menu-item" data-to="${t.id}">
          <span class="art-menu-icon">${t.icon}</span>
          <span><strong>${escapeHtml(t.name)}</strong><em>${escapeHtml(t.description)}</em></span>
        </button>`).join('')}`;
    return true;
  }

  function closeMenu() {
    menu.hidden = true;
    openInBtn.setAttribute('aria-expanded', 'false');
  }

  strip.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') return doSave();
    if (act === 'export') return doExport();
    if (act === 'open-in') {
      if (!menu.hidden) return closeMenu();
      if (!buildMenu()) return;
      menu.hidden = false;
      openInBtn.setAttribute('aria-expanded', 'true');
      return;
    }

    const to = e.target.closest('[data-to]')?.dataset.to;
    if (to) {
      const art = pull();
      closeMenu();
      if (!art) return;
      // Handed over in memory, not saved: sending is a navigation, not a
      // decision to keep something.
      store.handOff({ ...art, from: tool.id });
      window.location.hash = `#${to}`;
    }
  });

  const onOutside = (e) => { if (!strip.contains(e.target)) closeMenu(); };
  const onEscape = (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); };
  document.addEventListener('click', onOutside);
  document.addEventListener('keydown', onEscape);

  return () => {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onEscape);
    strip.remove();
  };
}

/**
 * A quiet line above the tool saying what it was handed and where it came
 * from, so an unexpectedly full input is never a mystery.
 */
export function incomingBanner(artifact, fromTool) {
  const el = document.createElement('p');
  el.className = 'art-incoming';
  el.innerHTML = `Opened <strong>${escapeHtml(artifact.name)}</strong>`
    + (fromTool ? ` from ${escapeHtml(fromTool.name)}` : '')
    + ` · <a href="#saved">saved work</a>`;
  return el;
}
