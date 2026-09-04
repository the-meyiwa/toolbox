/* ============================================================
   The artifact strip.

   One control strip, shared by every tool that has something worth
   keeping. It appears under the tool and nowhere else, and only for
   tools that declare `getArtifact()` — so a person who came to count
   words never sees a single word about saving, workspaces or files.

   "Local by default. Shared by intention."
   ============================================================ */

import * as store from './artifacts.js';
import { kindLabel, kindExt } from '../registry/kinds.js';
import { toolsAccepting } from '../registry/index.js';
import { listJoinedSpaces, SpaceEngine, getUserProfile } from './space-engine.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
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

  /* The id of the saved artifact this strip is currently attached to. */
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
        <button class="btn btn-secondary btn-sm" data-act="share-space">Share to Space</button>
        <div class="art-menu-wrap">
          <button class="btn btn-secondary btn-sm" data-act="open-in" aria-haspopup="true" aria-expanded="false">Open in…</button>
          <div class="art-menu" hidden></div>
        </div>
      </div>
    </div>
    <div class="art-space-modal" id="art-space-modal" hidden></div>
    <p class="art-note" id="art-note"></p>`;

  host.appendChild(strip);

  const nameInput = strip.querySelector('#art-name');
  const note = strip.querySelector('#art-note');
  const menu = strip.querySelector('.art-menu');
  const openInBtn = strip.querySelector('[data-act="open-in"]');
  const spaceModal = strip.querySelector('#art-space-modal');

  const baseNote = store.persistent
    ? 'Saved work stays in this browser. Download it to keep a copy anywhere else.'
    : 'This browser will not keep saved work — private mode, or storage is switched off. Download it to a file instead.';

  function say(message, tone = '') {
    if (message && message.includes('<a')) {
      note.innerHTML = message;
    } else {
      note.textContent = message || baseNote;
    }
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

  function toggleSpaceModal() {
    if (!spaceModal.hidden) {
      spaceModal.hidden = true;
      return;
    }
    const art = pull();
    if (!art) return;

    const spaces = listJoinedSpaces();
    spaceModal.innerHTML = `
      <div class="art-space-box">
        <div class="art-space-head">
          <h4>Share to Space</h4>
          <button class="art-space-close" data-act="close-space-modal">✕</button>
        </div>
        <p class="art-space-blurb">Copies <strong>${escapeHtml(art.name)}</strong> into a shared space for all members to view, download, or open.</p>

        ${spaces.length ? `
          <div class="art-space-list">
            <label class="sp-form-label">Choose a Space:</label>
            ${spaces.map(s => `
              <button class="art-space-item" data-share-code="${s.id}" data-space-name="${escapeHtml(s.name)}">
                <strong>${escapeHtml(s.name)}</strong>
                <span class="sp-code-pill">${s.id}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div class="art-space-custom">
          <label class="sp-form-label">Or enter room code:</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="tool-input art-space-code-input" placeholder="6-char code" maxlength="6" style="text-transform:uppercase; font-family:var(--mono);">
            <button class="btn btn-primary btn-sm" data-act="share-code-submit">Share</button>
          </div>
        </div>
      </div>
    `;
    spaceModal.hidden = false;
  }

  async function executeShare(code, spaceName = '') {
    const art = pull();
    if (!art) return;
    spaceModal.hidden = true;
    say(`Connecting to space ${code}…`, 'warn');

    try {
      const profile = getUserProfile();
      const eng = new SpaceEngine();
      await eng.join({ roomCode: code, displayName: profile.name || 'Toolbox User' });

      // Allow awareness and state to settle
      setTimeout(() => {
        eng.shareArtifact({
          name: art.name,
          kind: art.kind,
          text: art.text,
          from: tool.name || tool.id,
        });

        say(`Shared "${escapeHtml(art.name)}" to ${escapeHtml(spaceName || code)}. <a href="#spaces/${code}/artifacts" style="color:inherit; font-weight:600; text-decoration:underline;">Open in Space →</a>`, 'good');

        setTimeout(() => eng.leave(), 2000);
      }, 500);
    } catch (err) {
      console.error('Failed to share artifact to space', err);
      say(`Could not share to space ${code}.`, 'bad');
    }
  }

  const yieldPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

  strip.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') { await yieldPaint(); return doSave(); }
    if (act === 'export') { await yieldPaint(); return doExport(); }
    if (act === 'share-space') { await yieldPaint(); return toggleSpaceModal(); }
    if (act === 'close-space-modal') { spaceModal.hidden = true; return; }

    if (act === 'share-code-submit') {
      const input = spaceModal.querySelector('.art-space-code-input');
      const code = input?.value.trim().toUpperCase();
      if (code && code.length >= 4) {
        await yieldPaint();
        executeShare(code);
      }
      return;
    }

    const shareItem = e.target.closest('[data-share-code]');
    if (shareItem) {
      const code = shareItem.dataset.shareCode;
      const spaceName = shareItem.dataset.spaceName;
      await yieldPaint();
      executeShare(code, spaceName);
      return;
    }

    if (act === 'open-in') {
      if (!menu.hidden) return closeMenu();
      await yieldPaint();
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
      store.handOff({ ...art, from: tool.id });
      window.location.hash = `#${to}`;
    }
  });

  const onOutside = (e) => {
    if (!strip.contains(e.target)) {
      closeMenu();
      spaceModal.hidden = true;
    }
  };
  const onEscape = (e) => {
    if (e.key === 'Escape') {
      if (!menu.hidden) closeMenu();
      spaceModal.hidden = true;
    }
  };
  document.addEventListener('click', onOutside);
  document.addEventListener('keydown', onEscape);

  return () => {
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onEscape);
    strip.remove();
  };
}

/**
 * A quiet line above the tool saying what it was handed and where it came from.
 */
export function incomingBanner(artifact, fromTool) {
  const el = document.createElement('p');
  el.className = 'art-incoming';
  const fromText = fromTool ? ` from ${escapeHtml(fromTool.name)}` : (artifact.from === 'spaces' ? ' from Shared Space' : '');
  el.innerHTML = `Opened <strong>${escapeHtml(artifact.name)}</strong>${fromText} · <a href="#saved">saved work</a>`;
  return el;
}
