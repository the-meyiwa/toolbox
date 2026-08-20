/* ============================================================
   Saved work.

   The smallest honest version of a workbench: a list of what you kept,
   what made it, and what can take it next. No panes, no console, no
   project model — those are only worth building once people actually
   have work here to organise.

   It exists in the navigation only when there is something in it, so a
   person who came to format some JSON never meets it.
   ============================================================ */

import * as store from '../lib/artifacts.js';
import { kindLabel } from '../registry/kinds.js';
import { BY_ID, toolsAccepting } from '../registry/index.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const when = (ts) => new Date(ts).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const size = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);

/**
 * @param {HTMLElement} host
 * @param {string|null} selectedId
 * @returns {() => void} teardown
 */
export function renderSaved(host, selectedId = null) {
  let teardown = () => {};

  /* Deleting the last item, or importing a bundle, has to redraw the page it
     happened on. Repainting in place is simpler and more reliable than
     routing back to a hash the browser already thinks it is at. */
  const refresh = (nextId = null) => {
    teardown();
    teardown = paint(host, nextId, refresh);
  };

  refresh(selectedId);
  return () => teardown();
}

function paint(host, selectedId, refresh) {
  const items = store.list();
  const selected = selectedId && items.some(m => m.id === selectedId)
    ? store.get(selectedId)
    : (items.length ? store.get(items[0].id) : null);

  host.innerHTML = items.length ? full(items, selected) : empty();
  return wire(host, selected, refresh);
}

function empty() {
  return `
    <div class="sv-empty">
      <h1 class="sv-title">Saved work</h1>
      <p class="sv-lede">Nothing saved yet. Some tools make something you might want to keep — a tidied-up
        document, a converted file, a diagram, some code. Those show a <strong>Save</strong>
        button underneath. What you save stays in this browser and turns up here.</p>
      <div class="sv-empty-actions">
        <a class="btn btn-primary" href="#tools">Browse tools</a>
        <button class="btn btn-secondary" data-act="import">Open a saved file</button>
      </div>
      ${storageNote()}
    </div>`;
}

function full(items, selected) {
  const use = store.usage();
  return `
    <div class="sv">
      <header class="sv-head">
        <div>
          <h1 class="sv-title">Saved work</h1>
          <p class="sv-lede">${items.length} item${items.length === 1 ? '' : 's'} · ${size(use.used)} of the space this browser allows</p>
        </div>
        <div class="sv-head-actions">
          <button class="btn btn-secondary btn-sm" data-act="import">Open a file</button>
          <button class="btn btn-secondary btn-sm" data-act="export-all">Download all</button>
        </div>
      </header>

      <div class="sv-body">
        <ul class="sv-list">
          ${items.map(m => `
            <li>
              <button class="sv-item${selected && m.id === selected.id ? ' is-open' : ''}" data-pick="${m.id}">
                <strong>${escapeHtml(m.name)}</strong>
                <em>${kindLabel(m.kind)} · ${size(m.bytes ?? 0)}${m.from && BY_ID.has(m.from) ? ` · from ${escapeHtml(BY_ID.get(m.from).name)}` : ''}</em>
              </button>
            </li>`).join('')}
        </ul>

        <section class="sv-detail">${selected ? detail(selected) : ''}</section>
      </div>

      ${storageNote()}
    </div>`;
}

function detail(art) {
  const targets = toolsAccepting(art.kind);
  return `
    <div class="sv-detail-head">
      <input type="text" class="tool-input sv-rename" value="${escapeHtml(art.name)}" aria-label="Name" spellcheck="false">
      <div class="sv-detail-actions">
        <button class="btn btn-secondary btn-sm" data-act="export-one">Download</button>
        <button class="btn btn-secondary btn-sm sv-danger" data-act="delete">Delete</button>
      </div>
    </div>
    <p class="sv-meta">${kindLabel(art.kind)} · saved ${when(art.updatedAt)}</p>

    ${targets.length ? `
      <p class="sv-open-label">Open in</p>
      <div class="sv-open">
        ${targets.map(t => `
          <button class="sv-open-btn" data-open="${t.id}">
            <span class="sv-open-icon">${t.icon}</span>
            <span>${escapeHtml(t.name)}</span>
          </button>`).join('')}
      </div>`
    : `<p class="sv-meta">No other tool takes ${kindLabel(art.kind)} yet — download it to use it elsewhere.</p>`}

    <p class="sv-open-label">Contents</p>
    <pre class="sv-preview">${escapeHtml(art.text.slice(0, 4000))}${art.text.length > 4000 ? '\n…' : ''}</pre>`;
}

function storageNote() {
  return store.persistent
    ? `<p class="sv-note">This lives in this browser only. Clearing your browsing data removes it, and it will not follow you to your phone or another browser. Download anything you would be sorry to lose.</p>`
    : `<p class="sv-note is-warn">This browser will not keep saved work — private browsing, or storage is switched off. Anything here lasts until you close the tab. Download it to keep it.</p>`;
}

/* ---------------- behaviour ---------------- */

function wire(host, selected, refresh) {
  let current = selected;

  const importer = document.createElement('input');
  importer.type = 'file';
  importer.accept = 'application/json,.json';
  importer.hidden = true;
  host.appendChild(importer);

  const flash = (message, tone = 'good') => {
    let el = host.querySelector('.sv-flash');
    if (!el) {
      el = document.createElement('p');
      el.className = 'sv-flash';
      host.prepend(el);
    }
    el.textContent = message;
    el.classList.toggle('is-bad', tone === 'bad');
  };

  const onClick = (e) => {
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    if (pick) {
      // Keep the address bar honest so the item can be linked to and
      // reloaded, but repaint directly rather than waiting on the router.
      history.replaceState(null, '', `#saved/${pick}`);
      refresh(pick);
      return;
    }

    const openIn = e.target.closest('[data-open]')?.dataset.open;
    if (openIn && current) {
      store.handOff({ ...current });
      window.location.hash = `#${openIn}`;
      return;
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'import') { importer.click(); return; }

    if (act === 'export-all') {
      const n = store.exportAll();
      flash(`Downloaded ${n} item${n === 1 ? '' : 's'}.`);
      return;
    }

    if (act === 'export-one' && current) {
      store.exportOne(current);
      flash(`Downloaded ${current.name}.`);
      return;
    }

    if (act === 'delete' && current) {
      const btn = e.target.closest('[data-act]');
      // Two-step rather than a modal: the second click is the confirmation.
      if (btn.dataset.armed !== 'yes') {
        btn.dataset.armed = 'yes';
        btn.textContent = 'Delete for good?';
        setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Delete'; }, 4000);
        return;
      }
      store.remove(current.id);
      history.replaceState(null, '', '#saved');
      refresh(null);
    }
  };

  const onRename = (e) => {
    if (!e.target.classList.contains('sv-rename') || !current) return;
    const next = store.rename(current.id, e.target.value);
    if (next) current = { ...current, name: next.name };
  };

  const onImport = async () => {
    const file = importer.files?.[0];
    if (!file) return;
    try {
      const { imported, skipped } = store.importBundle(await file.text());
      importer.value = '';
      refresh(null);
      flash(`Imported ${imported} item${imported === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`);
      return;
    } catch (err) {
      flash(err.message, 'bad');
    }
    importer.value = '';
  };

  host.addEventListener('click', onClick);
  host.addEventListener('change', onRename);
  importer.addEventListener('change', onImport);

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('change', onRename);
  };
}
