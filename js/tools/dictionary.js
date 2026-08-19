/* Dictionary — every word, not one dictionary's idea of the words.

   Two sources, because neither alone is complete. The Free Dictionary
   gives clean definitions, pronunciation and audio for common English.
   Wiktionary covers everything else: technical terms, dialect, slang,
   archaic forms, proper nouns and words other dictionaries decided were
   not real yet.

   The first source is tried, and the second fills whatever it missed —
   so a rare word still returns something rather than "not found". */

import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

const FREE_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKT = 'https://en.wiktionary.org';

const RECENT_KEY = 'toolbox.dictionary.recent';

const SAMPLES = ['serendipity', 'ubiquitous', 'petrichor', 'defenestrate', 'ephemeral', 'sonder', 'quotidian'];

export default {
  render(container, { analytics } = {}) {
    this._alive = true;

    const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
    const remember = (w) => {
      const list = [w, ...recent().filter(x => x !== w)].slice(0, 10);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode */ }
    };

    container.innerHTML = `
      <div class="dct">
        <div class="wk-input-wrap dct-search">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="search" id="dc-q" class="wk-input" placeholder="Look up any word…"
                 autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Word">
        </div>
        <div id="dc-body"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const body = $('dc-body');
    const input = $('dc-q');

    /* ---------------- sources ---------------- */

    async function fromFreeDictionary(word, signal) {
      const res = await fetch(`${FREE_API}/${encodeURIComponent(word)}`, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;

      const phonetics = data.flatMap(e => e.phonetics ?? []).filter(p => p.text || p.audio);
      return {
        word: data[0].word,
        source: 'Free Dictionary',
        phonetic: data.find(e => e.phonetic)?.phonetic ?? phonetics.find(p => p.text)?.text ?? '',
        audio: phonetics.find(p => p.audio)?.audio ?? null,
        origin: data.find(e => e.origin)?.origin ?? '',
        groups: data.flatMap(entry => (entry.meanings ?? []).map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: (m.definitions ?? []).map(d => ({
            text: d.definition,
            example: d.example ?? '',
            synonyms: d.synonyms ?? [],
            antonyms: d.antonyms ?? [],
          })),
          synonyms: m.synonyms ?? [],
          antonyms: m.antonyms ?? [],
        }))),
      };
    }

    async function fromWiktionary(word, signal) {
      const res = await fetch(`${WIKT}/api/rest_v1/page/definition/${encodeURIComponent(word)}`, { signal });
      if (!res.ok) return null;
      const data = await res.json();

      // Keyed by language; English first, then anything else, because a
      // word may only exist in Latin or French.
      const langs = Object.entries(data);
      if (!langs.length) return null;
      const ordered = [...langs].sort((a, b) => (a[0] === 'en' ? -1 : b[0] === 'en' ? 1 : 0));

      const groups = [];
      for (const [langCode, entries] of ordered.slice(0, 3)) {
        for (const entry of entries) {
          const defs = (entry.definitions ?? [])
            .map(d => ({
              text: stripHtml(d.definition),
              example: (d.parsedExamples ?? d.examples ?? [])
                .map(x => stripHtml(typeof x === 'string' ? x : x.example ?? ''))[0] ?? '',
              synonyms: [], antonyms: [],
            }))
            .filter(d => d.text);
          if (defs.length) {
            groups.push({
              partOfSpeech: entry.partOfSpeech,
              language: entry.language,
              foreign: langCode !== 'en',
              definitions: defs,
              synonyms: [], antonyms: [],
            });
          }
        }
      }
      return groups.length ? { word, source: 'Wiktionary', phonetic: '', audio: null, origin: '', groups } : null;
    }

    const stripHtml = (html) => {
      const el = document.createElement('div');
      el.innerHTML = html ?? '';
      return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    };

    /** Suggestions when nothing matched, so a typo is recoverable. */
    async function suggest(word, signal) {
      try {
        const res = await fetch(`${WIKT}/w/rest.php/v1/search/page?q=${encodeURIComponent(word)}&limit=8`, { signal });
        if (!res.ok) return [];
        const d = await res.json();
        return (d.pages ?? []).map(p => p.title).filter(t => t.toLowerCase() !== word.toLowerCase()).slice(0, 6);
      } catch { return []; }
    }

    /* ---------------- lookup ---------------- */

    async function lookup(raw) {
      const word = raw.trim().toLowerCase();
      if (!word) { renderHome(); return; }

      body.innerHTML = `<div class="wk-loading"><div class="t3d-spinner"></div><p>Looking up “${escapeHtml(word)}”…</p></div>`;

      this._abort?.abort();
      this._abort = new AbortController();
      const signal = this._abort.signal;

      try {
        // Both are asked at once; whichever answers is used, and the
        // second fills in what the first did not have.
        const [free, wikt] = await Promise.all([
          fromFreeDictionary(word, signal).catch(() => null),
          fromWiktionary(word, signal).catch(() => null),
        ]);
        if (!this._alive) return;

        if (!free && !wikt) {
          const alts = await suggest(word, signal);
          if (!this._alive) return;
          body.innerHTML = `
            <div class="wk-empty">
              <strong>No entry for “${escapeHtml(word)}”</strong>
              <span>Neither dictionary has this one. Check the spelling, or try a base form —
                dictionaries list <em>run</em> rather than <em>running</em>.</span>
              ${alts.length ? `<div class="wk-chip-row" style="margin-top:14px;">
                <span class="wk-chip-label">Did you mean</span>
                ${alts.map(a => `<button class="wk-chip" data-word="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')}
              </div>` : ''}
            </div>`;
          analytics?.error('not_found');
          return;
        }

        remember(word);
        renderEntry(word, free, wikt);
        analytics?.completed({ resultCount: (free?.groups.length ?? 0) + (wikt?.groups.length ?? 0) });
      } catch (err) {
        if (err.name === 'AbortError') return;
        body.innerHTML = `<div class="wk-error"><strong>Could not look that up.</strong>
          <span>${navigator.onLine ? escapeHtml(err.message) : 'You appear to be offline.'}</span></div>`;
        analytics?.error('lookup_failed');
      }
    }
    const lookupBound = lookup.bind(this);

    /* ---------------- rendering ---------------- */

    function renderEntry(word, free, wikt) {
      const primary = free ?? wikt;
      // Wiktionary is shown as a supplement only when it adds parts of
      // speech the first source did not cover.
      const seen = new Set((free?.groups ?? []).map(g => g.partOfSpeech?.toLowerCase()));
      const extra = free && wikt
        ? wikt.groups.filter(g => g.foreign || !seen.has(g.partOfSpeech?.toLowerCase()))
        : (free ? [] : wikt.groups);

      const groups = [...(free?.groups ?? []), ...extra];

      body.innerHTML = `
        <article class="dct-entry">
          <header class="dct-head">
            <div>
              <h2>${escapeHtml(primary.word || word)}</h2>
              ${primary.phonetic ? `<span class="dct-phon">${escapeHtml(primary.phonetic)}</span>` : ''}
            </div>
            <div class="dct-head-actions">
              ${primary.audio ? `<button class="btn btn-sm" id="dc-say">Pronounce</button>` : ''}
              <button class="btn btn-sm" id="dc-copy">Copy</button>
            </div>
          </header>

          ${primary.origin ? `<p class="dct-origin"><strong>Origin.</strong> ${escapeHtml(primary.origin)}</p>` : ''}

          ${groups.map(g => `
            <section class="dct-group">
              <h3 class="dct-pos">
                ${escapeHtml(g.partOfSpeech ?? 'definition')}
                ${g.foreign ? `<span class="dct-lang">${escapeHtml(g.language)}</span>` : ''}
              </h3>
              <ol class="dct-defs">
                ${g.definitions.slice(0, 12).map(d => `
                  <li>
                    <span class="dct-def">${escapeHtml(d.text)}</span>
                    ${d.example ? `<span class="dct-eg">“${escapeHtml(d.example)}”</span>` : ''}
                    ${d.synonyms?.length ? `<span class="dct-syn">Similar: ${d.synonyms.slice(0, 6).map(s =>
                      `<button data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join(', ')}</span>` : ''}
                  </li>`).join('')}
              </ol>
              ${g.synonyms?.length ? `<p class="dct-syn">Synonyms: ${g.synonyms.slice(0, 10).map(s =>
                `<button data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join(', ')}</p>` : ''}
              ${g.antonyms?.length ? `<p class="dct-syn">Opposites: ${g.antonyms.slice(0, 10).map(s =>
                `<button data-word="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join(', ')}</p>` : ''}
            </section>`).join('')}

          <p class="dct-sources">
            From ${[free && 'the Free Dictionary', wikt && 'Wiktionary'].filter(Boolean).join(' and ')} ·
            <a href="${WIKT}/wiki/${encodeURIComponent(word)}" target="_blank" rel="noopener">open on Wiktionary</a>
          </p>
        </article>`;

      if (primary.audio) {
        $('dc-say').addEventListener('click', () => { new Audio(primary.audio).play().catch(() => {}); });
      }
      $('dc-copy').addEventListener('click', (e) => {
        const first = groups[0]?.definitions[0]?.text ?? '';
        copyText(`${primary.word || word}${primary.phonetic ? ` ${primary.phonetic}` : ''}\n${groups[0]?.partOfSpeech ?? ''}: ${first}`, e.target);
        analytics?.copied({ outputKind: 'text' });
      });
    }

    function renderHome() {
      const past = recent();
      body.innerHTML = `
        <div class="wk-home">
          <h2 class="wk-home-title">Look up any word</h2>
          <p class="wk-home-sub">Two dictionaries at once — a clean everyday one, and Wiktionary for the
            technical, dialect, archaic and slang words the first has never heard of.</p>
          ${past.length ? `<div class="wk-chip-row"><span class="wk-chip-label">Recent</span>
            ${past.map(w => `<button class="wk-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join('')}</div>` : ''}
          <div class="wk-chip-row"><span class="wk-chip-label">Try</span>
            ${SAMPLES.map(w => `<button class="wk-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join('')}</div>
        </div>`;
    }

    /* ---------------- events ---------------- */

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const v = input.value.trim();
      if (!v) { renderHome(); return; }
      // Waits for a pause: a dictionary lookup per keystroke is both
      // useless and rude to the API.
      debounce = setTimeout(() => lookupBound(v), 450);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(debounce); lookupBound(input.value); }
    });

    body.addEventListener('click', (e) => {
      const w = e.target.closest('[data-word]');
      if (!w) return;
      input.value = w.dataset.word;
      lookupBound(w.dataset.word);
    });

    renderHome();
    input.focus();
    analytics?.started();
  },

  destroy() {
    this._alive = false;
    this._abort?.abort();
  },
};
