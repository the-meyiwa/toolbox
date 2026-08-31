/* Quran — read, listen, and take verses with you.

   Built for how the Quran is actually read rather than as a generic text
   viewer: the Arabic is the primary text and is never truncated or
   reflowed away, translation and transliteration sit under it by choice,
   recitation plays verse by verse with the line highlighted as it goes,
   and where you stopped is remembered.

   Text, translations and recitations come from the Quran.com API. */

import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

const API = 'https://api.quran.com/api/v4';
const PREFS = 'toolbox.quran';

/* Translation ids are not stable across the API's own catalogue: a
   hardcoded default silently returned *no* translation when that id was
   not in the English list, leaving verses with Arabic and nothing else.
   So the default is chosen from whatever the API actually offers,
   preferring well-known renderings in order. */
const PREFERRED_TRANSLATIONS = [
  'Abdel Haleem', 'Saheeh International', 'Sahih International',
  'Usmani', 'Maududi', 'Pickthall', 'Yusuf Ali',
];
const DEFAULT_RECITER = 7;   // Mishari Rashid al-Afasy

function pickTranslation(list, saved) {
  if (saved && list.some(t => t.id === saved)) return saved;
  for (const wanted of PREFERRED_TRANSLATIONS) {
    const hit = list.find(t => (t.name || '').toLowerCase().includes(wanted.toLowerCase()));
    if (hit) return hit.id;
  }
  return list[0]?.id ?? null;
}

export default {
  async render(container, { analytics } = {}) {
    this._alive = true;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { /* ignore */ }

    const state = {
      chapters: [],
      chapter: saved.chapter ?? 1,
      lastVerse: saved.lastVerse ?? null,
      translation: saved.translation ?? null,   // resolved once the catalogue loads
      reciter: saved.reciter ?? DEFAULT_RECITER,
      showTranslation: saved.showTranslation !== false,
      showTransliteration: saved.showTransliteration ?? false,
      arabicSize: saved.arabicSize ?? 2,
      verses: [],
      audio: null,
      playingVerse: null,
      bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks : [],
    };

    const persist = () => {
      try {
        localStorage.setItem(PREFS, JSON.stringify({
          chapter: state.chapter, lastVerse: state.lastVerse,
          translation: state.translation, reciter: state.reciter,
          showTranslation: state.showTranslation, showTransliteration: state.showTransliteration,
          arabicSize: state.arabicSize, bookmarks: state.bookmarks,
        }));
      } catch { /* private mode */ }
    };

    container.innerHTML = `<div class="wk-loading"><div class="t3d-spinner"></div><p>Loading the Quran…</p></div>`;

    /* ---------------- initial data ---------------- */

    let translations = [], reciters = [];
    try {
      const [ch, tr, rc] = await Promise.all([
        fetch(`${API}/chapters?language=en`).then(r => r.json()),
        fetch(`${API}/resources/translations?language=en`).then(r => r.json()),
        fetch(`${API}/resources/recitations?language=en`).then(r => r.json()),
      ]);
      if (!this._alive) return;
      state.chapters = ch.chapters ?? [];
      // English translations first; the list is otherwise unusable.
      translations = (tr.translations ?? []).filter(t => t.language_name === 'english');
      state.translation = pickTranslation(translations, state.translation);
      reciters = rc.recitations ?? [];
    } catch (err) {
      container.innerHTML = `<div class="wk-error">
        <strong>Could not load the Quran.</strong>
        <span>${navigator.onLine ? 'The Quran.com service could not be reached.' : 'You appear to be offline.'}</span>
      </div>`;
      analytics?.error('load_failed');
      return;
    }

    container.innerHTML = `
      <div class="qrn">
        <div class="qrn-bar">
          <select class="tool-select qrn-surah" id="qr-surah" aria-label="Surah">
            ${state.chapters.map(c => `
              <option value="${c.id}"${c.id === state.chapter ? ' selected' : ''}>
                ${c.id}. ${escapeHtml(c.name_simple)} — ${escapeHtml(c.translated_name.name)}
              </option>`).join('')}
          </select>
          <button class="btn btn-sm" id="qr-prev">←</button>
          <button class="btn btn-sm" id="qr-next">→</button>
          <button class="btn btn-sm" id="qr-settings-btn">Settings</button>
        </div>

        <details class="qrn-settings" id="qr-settings">
          <summary>Reading settings</summary>
          <div class="qrn-settings-grid">
            <label class="fz-ctl"><span>Translation</span>
              <select class="tool-select" id="qr-translation">
                ${translations.map(t => `<option value="${t.id}"${t.id === state.translation ? ' selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select></label>
            <label class="fz-ctl"><span>Reciter</span>
              <select class="tool-select" id="qr-reciter">
                ${reciters.map(r => `<option value="${r.id}"${r.id === state.reciter ? ' selected' : ''}>${escapeHtml(r.reciter_name)}${r.style ? ` (${escapeHtml(r.style)})` : ''}</option>`).join('')}
              </select></label>
            <label class="fz-ctl"><span>Arabic size</span>
              <input type="range" class="tool-range" id="qr-size" min="1" max="4" step="1" value="${state.arabicSize}"></label>
            <div class="qrn-toggles">
              <label class="tool-checkbox"><input type="checkbox" id="qr-show-tr"${state.showTranslation ? ' checked' : ''}> <span>Translation</span></label>
              <label class="tool-checkbox"><input type="checkbox" id="qr-show-tl"${state.showTransliteration ? ' checked' : ''}> <span>Transliteration</span></label>
            </div>
          </div>
        </details>

        <div class="qrn-head" id="qr-head"></div>
        <div id="qr-body"></div>
        <div id="qr-saved"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const body = $('qr-body');

    /* ---------------- loading a surah ---------------- */

    async function loadChapter(id, scrollToVerse = null) {
      state.chapter = id;
      stopAudio();
      const info = state.chapters.find(c => c.id === id);

      $('qr-head').innerHTML = `
        <div class="qrn-surah-head">
          <div>
            <h2>${escapeHtml(info.name_simple)} <span class="qrn-arabic-name">${escapeHtml(info.name_arabic)}</span></h2>
            <p>${escapeHtml(info.translated_name.name)} · ${info.verses_count} verses ·
              revealed in ${escapeHtml(info.revelation_place)}</p>
          </div>
          <button class="btn btn-sm" id="qr-play-all">Play surah</button>
        </div>`;
      $('qr-play-all').addEventListener('click', () => playFrom(state.verses[0]?.number ?? 1));

      body.innerHTML = `<div class="wk-loading"><div class="t3d-spinner"></div><p>Loading…</p></div>`;

      this._abort?.abort();
      this._abort = new AbortController();
      const signal = this._abort.signal;

      try {
        const params = new URLSearchParams({
          language: 'en',
          words: 'false',
          translations: String(state.translation),
          fields: 'text_uthmani',
          per_page: '300',
        });
        const [verseData, audioData] = await Promise.all([
          fetch(`${API}/verses/by_chapter/${id}?${params}`, { signal }).then(r => r.json()),
          // Recitation audio is a separate resource; failure here should
          // not stop the text from being readable.
          fetch(`${API}/recitations/${state.reciter}/by_chapter/${id}?per_page=300`, { signal })
            .then(r => r.json()).catch(() => ({ audio_files: [] })),
        ]);
        if (!this._alive) return;

        const audioByKey = new Map(
          (audioData.audio_files ?? []).map(a => [a.verse_key, a.url]),
        );

        state.verses = (verseData.verses ?? []).map(v => ({
          key: v.verse_key,
          number: v.verse_number,
          arabic: v.text_uthmani,
          translation: (v.translations?.[0]?.text ?? '').replace(/<sup[^>]*>.*?<\/sup>/g, ''),
          sajdah: v.sajdah_number ?? null,
          juz: v.juz_number,
          page: v.page_number,
          audio: audioByKey.get(v.verse_key)
            ? `https://verses.quran.foundation/${audioByKey.get(v.verse_key)}`
            : null,
        }));

        render();
        persist();
        analytics?.completed({ resultCount: state.verses.length });

        if (scrollToVerse) {
          container.querySelector(`[data-verse="${scrollToVerse}"]`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        body.innerHTML = `<div class="wk-error"><strong>Could not load this surah.</strong>
          <span>${escapeHtml(err.message)}</span></div>`;
        analytics?.error('chapter_failed');
      }
    }
    const loadChapterBound = loadChapter.bind(this);

    /* ---------------- rendering ---------------- */

    function render() {
      const info = state.chapters.find(c => c.id === state.chapter);
      // Every surah opens with the Bismillah except At-Tawbah (9), where
      // its absence is itself significant — so it is never inserted there.
      const showBismillah = info.bismillah_pre && state.chapter !== 9;

      body.innerHTML = `
        ${showBismillah ? `<p class="qrn-bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>` : ''}
        <div class="qrn-verses size-${state.arabicSize}">
          ${state.verses.map(v => `
            <article class="qrn-verse" data-verse="${v.number}" id="qr-v-${v.number}">
              <div class="qrn-verse-side">
                <span class="qrn-num">${v.key}</span>
                <button class="qrn-icon" data-play="${v.number}" title="Play this verse" aria-label="Play verse ${v.number}"
                        ${v.audio ? '' : 'disabled'}>▸</button>
                <button class="qrn-icon" data-copy="${v.number}" title="Copy" aria-label="Copy verse ${v.number}">⧉</button>
                <button class="qrn-icon" data-save="${v.number}" title="Save" aria-label="Save verse ${v.number}"></button>
              </div>
              <div class="qrn-verse-body">
                <p class="qrn-arabic" dir="rtl" lang="ar">${escapeHtml(v.arabic)}</p>
                ${state.showTransliteration ? `<p class="qrn-translit" id="qr-tl-${v.number}"></p>` : ''}
                ${state.showTranslation ? `<p class="qrn-translation">${escapeHtml(v.translation)}</p>` : ''}
                ${v.sajdah ? `<p class="qrn-sajdah">Verse of prostration (sajdah)</p>` : ''}
              </div>
            </article>`).join('')}
        </div>
        <p class="biz-hint">Juz ${state.verses[0]?.juz ?? '—'} · page ${state.verses[0]?.page ?? '—'} in the standard mushaf.</p>`;

      if (state.showTransliteration) loadTransliteration();
    }

    /* Transliteration is a separate translation resource (id 57), fetched
       only when the reader has asked to see it. */
    async function loadTransliteration() {
      try {
        const r = await fetch(`${API}/quran/translations/57?chapter_number=${state.chapter}`);
        const d = await r.json();
        if (!this._alive) return;
        (d.translations ?? []).forEach((t, i) => {
          const el = container.querySelector(`#qr-tl-${i + 1}`);
          if (el) el.textContent = String(t.text).replace(/<[^>]+>/g, '');
        });
      } catch { /* transliteration is optional */ }
    }
    const loadTransliterationBound = loadTransliteration.bind(this);

    /* ---------------- audio ---------------- */

    function stopAudio() {
      state.audio?.pause();
      state.audio = null;
      state.playingVerse = null;
      for (const el of container.querySelectorAll('.qrn-verse')) el.classList.remove('is-playing');
    }

    function playFrom(verseNumber) {
      const verse = state.verses.find(v => v.number === verseNumber);
      if (!verse?.audio) return;

      stopAudio();
      state.playingVerse = verseNumber;
      const el = container.querySelector(`[data-verse="${verseNumber}"]`);
      el?.classList.add('is-playing');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });

      state.audio = new Audio(verse.audio);
      // Continue into the next verse so a surah plays through, which is
      // how recitation is normally listened to.
      state.audio.addEventListener('ended', () => {
        const next = state.verses.find(v => v.number === verseNumber + 1);
        if (next && this._alive) playFrom(next.number);
        else stopAudio();
      });
      state.audio.addEventListener('error', () => {
        el?.classList.remove('is-playing');
        analytics?.error('audio_failed');
      });
      state.audio.play().catch(() => { /* autoplay refused until a gesture */ });

      state.lastVerse = verseNumber;
      persist();
    }
    const playFromBound = playFrom.bind(this);

    /* ---------------- actions ---------------- */

    body.addEventListener('click', (e) => {
      const play = e.target.closest('[data-play]');
      if (play) {
        const n = Number(play.dataset.play);
        state.playingVerse === n ? stopAudio() : playFromBound(n);
        return;
      }

      const copy = e.target.closest('[data-copy]');
      if (copy) {
        const v = state.verses.find(x => x.number === Number(copy.dataset.copy));
        const info = state.chapters.find(c => c.id === state.chapter);
        const parts = [v.arabic];
        if (state.showTranslation && v.translation) parts.push(v.translation);
        parts.push(`— Quran ${v.key} (Surah ${info.name_simple})`);
        copyText(parts.join('\n\n'), copy);
        analytics?.copied({ outputKind: 'text' });
        return;
      }

      const save = e.target.closest('[data-save]');
      if (save) {
        const n = Number(save.dataset.save);
        const key = `${state.chapter}:${n}`;
        if (!state.bookmarks.includes(key)) state.bookmarks.unshift(key);
        state.bookmarks = state.bookmarks.slice(0, 40);
        persist();
        renderSaved();
      }
    });

    function renderSaved() {
      $('qr-saved').innerHTML = state.bookmarks.length ? `
        <section class="bib-saved">
          <h3 class="cq-h">Saved verses</h3>
          <div class="wk-chip-row">
            ${state.bookmarks.map(k => {
              const [c, v] = k.split(':');
              const name = state.chapters.find(x => x.id === Number(c))?.name_simple ?? c;
              return `<span class="bib-chip">
                <button data-goto="${escapeHtml(k)}">${escapeHtml(name)} ${escapeHtml(k)}</button>
                <button class="bib-chip-x" data-drop="${escapeHtml(k)}" aria-label="Remove">×</button>
              </span>`;
            }).join('')}
          </div>
        </section>` : '';
    }

    $('qr-saved').addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) {
        const [c, v] = go.dataset.goto.split(':').map(Number);
        $('qr-surah').value = String(c);
        loadChapterBound(c, v);
        return;
      }
      const drop = e.target.closest('[data-drop]');
      if (drop) {
        state.bookmarks = state.bookmarks.filter(b => b !== drop.dataset.drop);
        persist();
        renderSaved();
      }
    });

    /* ---------------- controls ---------------- */

    $('qr-surah').addEventListener('change', (e) => loadChapterBound(Number(e.target.value)));
    $('qr-prev').addEventListener('click', () => {
      if (state.chapter > 1) { $('qr-surah').value = String(state.chapter - 1); loadChapterBound(state.chapter - 1); }
    });
    $('qr-next').addEventListener('click', () => {
      if (state.chapter < 114) { $('qr-surah').value = String(state.chapter + 1); loadChapterBound(state.chapter + 1); }
    });
    $('qr-settings-btn').addEventListener('click', () => { $('qr-settings').open = !$('qr-settings').open; });

    $('qr-translation').addEventListener('change', (e) => { state.translation = Number(e.target.value); persist(); loadChapterBound(state.chapter); });
    $('qr-reciter').addEventListener('change', (e) => { state.reciter = Number(e.target.value); persist(); loadChapterBound(state.chapter); });
    $('qr-size').addEventListener('input', (e) => {
      state.arabicSize = Number(e.target.value);
      container.querySelector('.qrn-verses')?.setAttribute('class', `qrn-verses size-${state.arabicSize}`);
      persist();
    });
    $('qr-show-tr').addEventListener('change', (e) => { state.showTranslation = e.target.checked; persist(); render(); });
    $('qr-show-tl').addEventListener('change', (e) => { state.showTransliteration = e.target.checked; persist(); render(); });

    renderSaved();
    await loadChapterBound(state.chapter, state.lastVerse);
    analytics?.started();
  },

  destroy() {
    this._alive = false;
    this._abort?.abort();
  },
};
