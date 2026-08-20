/* Bible — read, find and take passages with you.

   The thing most online Bibles get wrong is selection: you can read a
   chapter but not easily take three verses out of it in a form worth
   pasting. Here every verse is selectable, and what you copy comes out
   formatted the way people actually quote scripture. */

import { BOOKS, TRANSLATIONS, parseReference, formatReference } from '../lib/bible-data.js';
import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

const API = 'https://bible-api.com';
const PREFS = 'toolbox.bible';

export default {
  async render(container, { analytics } = {}) {
    this._alive = true;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { /* ignore */ }

    const state = {
      translation: TRANSLATIONS.some(t => t.id === saved.translation) ? saved.translation : 'web',
      book: BOOKS[42],          // John
      chapter: 3,
      verses: [],
      selected: new Set(),
      reference: null,
      bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks : [],
    };

    const persist = () => {
      try {
        localStorage.setItem(PREFS, JSON.stringify({
          translation: state.translation, bookmarks: state.bookmarks,
        }));
      } catch { /* private mode */ }
    };

    container.innerHTML = `
      <div class="bib">
        <div class="bib-bar">
          <div class="wk-input-wrap bib-search">
            <input type="search" id="bb-ref" class="wk-input" placeholder="Go to a passage — John 3:16, Ps 23, 1 Cor 13"
                   autocomplete="off" spellcheck="false" aria-label="Reference">
          </div>
          <select class="tool-select" id="bb-trans" aria-label="Translation">
            ${TRANSLATIONS.map(t => `<option value="${t.id}"${t.id === state.translation ? ' selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>

        <div class="bib-nav">
          <select class="tool-select" id="bb-book" aria-label="Book">
            <optgroup label="Old Testament">
              ${BOOKS.filter(b => b.testament === 'ot').map(b => `<option value="${b.index}">${b.name}</option>`).join('')}
            </optgroup>
            <optgroup label="New Testament">
              ${BOOKS.filter(b => b.testament === 'nt').map(b => `<option value="${b.index}">${b.name}</option>`).join('')}
            </optgroup>
          </select>
          <select class="tool-select" id="bb-chapter" aria-label="Chapter"></select>
          <button class="btn btn-sm" id="bb-prev">← Previous</button>
          <button class="btn btn-sm" id="bb-next">Next →</button>
        </div>

        <div class="bib-selbar" id="bb-selbar" hidden>
          <span id="bb-selcount"></span>
          <div class="bib-selbar-actions">
            <button class="btn btn-sm" id="bb-copy">Copy</button>
            <button class="btn btn-sm" id="bb-copy-ref">Copy with reference</button>
            <button class="btn btn-sm" id="bb-bookmark">Save</button>
            <button class="btn btn-sm" id="bb-clearsel">Clear</button>
          </div>
        </div>

        <div id="bb-body"></div>

        <div id="bb-saved"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const body = $('bb-body');

    /* ---------------- fetching ---------------- */

    async function load(ref) {
      state.reference = ref;
      state.selected.clear();
      updateSelBar();

      const passage = ref.verseStart
        ? `${ref.book.slug}+${ref.chapter}:${ref.verseStart}${ref.verseEnd && ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : ''}`
        : `${ref.book.slug}+${ref.chapter}`;

      body.innerHTML = `<div class="wk-loading"><div class="t3d-spinner"></div><p>Loading ${escapeHtml(formatReference(ref))}…</p></div>`;

      this._abort?.abort();
      this._abort = new AbortController();

      try {
        const res = await fetch(`${API}/${passage}?translation=${state.translation}`, { signal: this._abort.signal });
        if (!res.ok) throw new Error(res.status === 404 ? 'That passage could not be found in this translation.' : `The server returned ${res.status}.`);
        const data = await res.json();
        if (!this._alive) return;

        state.verses = (data.verses ?? []).map(v => ({
          chapter: v.chapter,
          verse: v.verse,
          text: String(v.text).replace(/\s+/g, ' ').trim(),
        }));
        render();
        analytics?.completed({ resultCount: state.verses.length });
      } catch (err) {
        if (err.name === 'AbortError') return;
        body.innerHTML = `<div class="wk-error">
          <strong>${escapeHtml(err.message)}</strong>
          <span>${navigator.onLine ? 'Some translations do not carry every book.' : 'You appear to be offline.'}</span>
        </div>`;
        analytics?.error('fetch_failed');
      }
    }
    const loadBound = load.bind(this);

    /* ---------------- rendering ---------------- */

    function render() {
      const ref = state.reference;
      $('bb-book').value = String(ref.book.index);
      fillChapters();
      $('bb-chapter').value = String(ref.chapter);

      body.innerHTML = `
        <div class="bib-head">
          <h2>${escapeHtml(formatReference(ref))}</h2>
          <span class="bib-trans">${escapeHtml(TRANSLATIONS.find(t => t.id === state.translation).name)}</span>
        </div>
        <div class="bib-text" id="bb-verses">
          ${state.verses.map(v => `
            <p class="bib-verse" data-v="${v.verse}" data-c="${v.chapter}">
              <span class="bib-num">${v.verse}</span>${escapeHtml(v.text)}
            </p>`).join('')}
        </div>
        <p class="biz-hint">Click a verse to select it. Shift-click to take a run of verses.</p>`;
    }

    function fillChapters() {
      const b = state.reference?.book ?? state.book;
      $('bb-chapter').innerHTML = Array.from({ length: b.chapters }, (_, i) =>
        `<option value="${i + 1}">Chapter ${i + 1}</option>`).join('');
    }

    /* ---------------- selection ---------------- */

    let lastClicked = null;

    function updateSelBar() {
      const n = state.selected.size;
      $('bb-selbar').hidden = n === 0;
      $('bb-selcount').textContent = `${n} verse${n === 1 ? '' : 's'} selected`;
      for (const el of container.querySelectorAll('.bib-verse')) {
        el.classList.toggle('is-selected', state.selected.has(Number(el.dataset.v)));
      }
    }

    /** The selected verses as text, in the order they appear. */
    function selectedVerses() {
      return state.verses.filter(v => state.selected.has(v.verse));
    }

    /** Collapse selected verse numbers into "3:16-18, 20" style ranges. */
    function selectionReference() {
      const nums = [...state.selected].sort((a, b) => a - b);
      if (!nums.length) return formatReference(state.reference);
      const parts = [];
      let start = nums[0], prev = nums[0];
      for (let i = 1; i <= nums.length; i++) {
        if (nums[i] !== prev + 1) {
          parts.push(start === prev ? `${start}` : `${start}-${prev}`);
          start = nums[i];
        }
        prev = nums[i];
      }
      return `${state.reference.book.name} ${state.reference.chapter}:${parts.join(', ')}`;
    }

    body.addEventListener('click', (e) => {
      const verse = e.target.closest('.bib-verse');
      if (!verse) return;
      const n = Number(verse.dataset.v);

      if (e.shiftKey && lastClicked !== null) {
        const [lo, hi] = [Math.min(lastClicked, n), Math.max(lastClicked, n)];
        for (const v of state.verses) if (v.verse >= lo && v.verse <= hi) state.selected.add(v.verse);
      } else if (state.selected.has(n)) {
        state.selected.delete(n);
      } else {
        state.selected.add(n);
      }
      lastClicked = n;
      updateSelBar();
    });

    $('bb-copy').addEventListener('click', (e) => {
      const text = selectedVerses().map(v => v.text).join(' ');
      if (text) { copyText(text, e.target); analytics?.copied({ outputKind: 'text' }); }
    });

    $('bb-copy-ref').addEventListener('click', (e) => {
      const verses = selectedVerses();
      if (!verses.length) return;
      // Numbered when it is a passage, plain when it is a single verse —
      // which is how people actually quote it.
      const text = verses.length > 1
        ? verses.map(v => `${v.verse}. ${v.text}`).join('\n')
        : verses[0].text;
      const trans = TRANSLATIONS.find(t => t.id === state.translation).name;
      copyText(`${text}\n\n— ${selectionReference()} (${trans})`, e.target);
      analytics?.copied({ outputKind: 'text' });
    });

    $('bb-clearsel').addEventListener('click', () => { state.selected.clear(); lastClicked = null; updateSelBar(); });

    $('bb-bookmark').addEventListener('click', () => {
      const ref = selectionReference();
      if (!state.bookmarks.includes(ref)) state.bookmarks.unshift(ref);
      state.bookmarks = state.bookmarks.slice(0, 30);
      persist();
      renderSaved();
    });

    /* ---------------- saved passages ---------------- */

    function renderSaved() {
      $('bb-saved').innerHTML = state.bookmarks.length ? `
        <section class="bib-saved">
          <h3 class="cq-h">Saved passages</h3>
          <div class="wk-chip-row">
            ${state.bookmarks.map(b => `
              <span class="bib-chip">
                <button data-goto="${escapeHtml(b)}">${escapeHtml(b)}</button>
                <button class="bib-chip-x" data-drop="${escapeHtml(b)}" aria-label="Remove">×</button>
              </span>`).join('')}
          </div>
        </section>` : '';
    }

    $('bb-saved').addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) {
        const ref = parseReference(go.dataset.goto);
        if (ref) { $('bb-ref').value = go.dataset.goto; loadBound(ref); }
        return;
      }
      const drop = e.target.closest('[data-drop]');
      if (drop) {
        state.bookmarks = state.bookmarks.filter(b => b !== drop.dataset.drop);
        persist();
        renderSaved();
      }
    });

    /* ---------------- navigation ---------------- */

    let debounce;
    $('bb-ref').addEventListener('input', (e) => {
      clearTimeout(debounce);
      const raw = e.target.value.trim();
      if (!raw) return;
      debounce = setTimeout(() => {
        const ref = parseReference(raw);
        if (ref) loadBound(ref);
      }, 500);
    });

    $('bb-ref').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      clearTimeout(debounce);
      const ref = parseReference(e.target.value);
      if (ref) loadBound(ref);
    });

    $('bb-book').addEventListener('change', (e) => {
      const book = BOOKS[Number(e.target.value)];
      loadBound({ book, chapter: 1, verseStart: null, verseEnd: null });
    });

    $('bb-chapter').addEventListener('change', (e) => {
      loadBound({ book: state.reference.book, chapter: Number(e.target.value), verseStart: null, verseEnd: null });
    });

    const step = (dir) => {
      const { book, chapter } = state.reference;
      let idx = book.index, ch = chapter + dir;
      // Walking off the end of a book continues into the next one, the
      // way turning a page would.
      if (ch < 1) { idx--; if (idx < 0) return; ch = BOOKS[idx].chapters; }
      else if (ch > book.chapters) { idx++; if (idx >= BOOKS.length) return; ch = 1; }
      loadBound({ book: BOOKS[idx], chapter: ch, verseStart: null, verseEnd: null });
    };
    $('bb-prev').addEventListener('click', () => step(-1));
    $('bb-next').addEventListener('click', () => step(1));

    $('bb-trans').addEventListener('change', (e) => {
      state.translation = e.target.value;
      persist();
      if (state.reference) loadBound(state.reference);
    });

    /* ---------------- go ---------------- */

    fillChapters();
    renderSaved();
    await loadBound({ book: BOOKS[42], chapter: 3, verseStart: null, verseEnd: null });
    analytics?.started();
  },

  destroy() {
    this._alive = false;
    this._abort?.abort();
  },
};
