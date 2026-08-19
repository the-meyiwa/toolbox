/* Wiki — a research instrument built on Wikipedia and Wikidata.

   The flow is search → result → article → explore, and everything else
   stays out of the way. The article view is built for reading rather
   than for imitating Wikipedia's chrome: no sidebars, no edit links, no
   navigation boxes. The original page is always one obvious click away,
   because this is a lens on Wikimedia, not a replacement for it. */

import {
  LANGUAGES, searchWikipedia, getSummary, getArticle, getLastModified,
  getRandomArticle, getRelatedArticles, getWikidataEntity, stripTags,
} from '../lib/wiki-api.js';
import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

const RECENT_KEY = 'toolbox.wiki.recent';
const LANG_KEY = 'toolbox.wiki.lang';

const STARTERS = [
  'Alan Turing', 'Photosynthesis', 'Nigeria', 'Black hole', 'Ada Lovelace',
  'Roman Empire', 'Quantum entanglement', 'Great Barrier Reef',
];

export default {
  async render(container, { analytics } = {}) {
    this._alive = true;
    this._abort = null;
    let alive = true;
    this._markDead = () => { alive = false; };

    const state = {
      lang: localStorage.getItem(LANG_KEY) || 'en',
      view: 'home',
      query: '',
      results: [],
      article: null,
      matches: [],
      matchIndex: 0,
    };

    const recent = () => {
      try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
    };
    const remember = (title) => {
      const list = [title, ...recent().filter(t => t !== title)].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode */ }
    };

    container.innerHTML = `
      <div class="wk">
        <div class="wk-searchbar">
          <div class="wk-input-wrap">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="search" id="wk-q" class="wk-input" placeholder="Search Wikipedia…"
                   autocomplete="off" spellcheck="false" aria-label="Search Wikipedia">
          </div>
          <select class="tool-select wk-lang" id="wk-lang" aria-label="Language">
            ${LANGUAGES.map(l => `<option value="${l.code}"${l.code === state.lang ? ' selected' : ''}>${l.name}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="wk-random">Random</button>
        </div>

        <div id="wk-body"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const body = $('wk-body');
    const input = $('wk-q');

    /* One controller for whatever request is in flight, so a fast typist
       never has an old response overwrite a newer one. */
    let controller = null;
    const newRequest = () => {
      controller?.abort();
      controller = new AbortController();
      this._abort = controller;
      return controller.signal;
    };

    const spinner = (label) => `
      <div class="wk-loading"><div class="t3d-spinner"></div><p>${escapeHtml(label)}</p></div>`;

    const errorBlock = (err, retryLabel) => `
      <div class="wk-error">
        <strong>${escapeHtml(err.message || 'Something went wrong.')}</strong>
        ${err.kind === 'offline' ? '<span>Wiki needs a connection — Wikipedia lives on the network.</span>' : ''}
        ${retryLabel ? `<button class="btn btn-sm" id="wk-retry">${retryLabel}</button>` : ''}
      </div>`;

    /* ---------------- home ---------------- */

    function renderHome() {
      state.view = 'home';
      const past = recent();
      body.innerHTML = `
        <div class="wk-home">
          <h2 class="wk-home-title">Search Wikipedia and explore knowledge</h2>
          <p class="wk-home-sub">Type a topic above. Articles open in a reader built for reading,
            with the facts pulled out and the original always one click away.</p>

          ${past.length ? `
            <div class="wk-chip-row">
              <span class="wk-chip-label">Recent</span>
              ${past.map(t => `<button class="wk-chip" data-open="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
            </div>` : ''}

          <div class="wk-chip-row">
            <span class="wk-chip-label">Try</span>
            ${STARTERS.map(t => `<button class="wk-chip" data-open="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
          </div>
        </div>`;
    }

    /* ---------------- results ---------------- */

    async function runSearch(q) {
      state.query = q;
      state.view = 'results';
      body.innerHTML = spinner(`Searching for “${escapeHtml(q)}”…`);

      try {
        const results = await searchWikipedia(q, { lang: state.lang, signal: newRequest() });
        if (!this._alive) return;
        state.results = results;
        renderResults();
        analytics?.completed({ query: q, resultCount: results.length });
        if (!results.length) analytics?.error('no_results');
      } catch (err) {
        if (err.name === 'AbortError') return;
        body.innerHTML = errorBlock(err, 'Try again');
        $('wk-retry')?.addEventListener('click', () => runSearchBound(q));
        analytics?.error(err.kind ?? 'search_failed');
      }
    }
    const runSearchBound = runSearch.bind(this);

    function renderResults() {
      if (!state.results.length) {
        body.innerHTML = `
          <div class="wk-empty">
            <strong>Nothing found for “${escapeHtml(state.query)}”</strong>
            <span>Check the spelling, or try a broader term. Wikipedia matches article text, so a
              distinctive phrase usually works better than a general one.</span>
          </div>`;
        return;
      }

      body.innerHTML = `
        <p class="wk-count">${state.results.length} result${state.results.length === 1 ? '' : 's'}</p>
        <div class="wk-results">
          ${state.results.map(r => `
            <button class="wk-card" data-open="${escapeHtml(r.title)}">
              ${r.thumbnail
                ? `<img class="wk-card-thumb" src="${escapeHtml(r.thumbnail)}" alt="" loading="lazy" decoding="async">`
                : '<span class="wk-card-thumb wk-card-noimg" aria-hidden="true"></span>'}
              <span class="wk-card-body">
                <span class="wk-card-title">${escapeHtml(r.title)}</span>
                ${r.description ? `<span class="wk-card-desc">${escapeHtml(r.description)}</span>` : ''}
                <span class="wk-card-excerpt">${sanitiseExcerpt(r.excerptHtml)}</span>
              </span>
            </button>`).join('')}
        </div>`;
    }

    /* The excerpt carries <span class="searchmatch"> highlighting, which is
       worth keeping — but it is remote HTML, so everything else is stripped
       rather than trusted. */
    function sanitiseExcerpt(html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html ?? '';
      const walk = (node) => {
        for (const child of [...node.childNodes]) {
          if (child.nodeType === 1) {
            if (child.tagName === 'SPAN' && child.classList.contains('searchmatch')) {
              walk(child);
              const mark = document.createElement('mark');
              mark.textContent = child.textContent;
              child.replaceWith(mark);
            } else {
              child.replaceWith(document.createTextNode(child.textContent));
            }
          }
        }
      };
      walk(tmp);
      return tmp.innerHTML;
    }

    /* ---------------- article ---------------- */

    async function openArticle(title) {
      state.view = 'article';
      body.innerHTML = spinner('Loading article…');
      const signal = newRequest();

      try {
        // Summary first: it is small and gives the reader something
        // immediately while the full body is still arriving.
        const summary = await getSummary(title, { lang: state.lang, signal });
        if (!this._alive) return;
        remember(summary.title);
        renderArticleShell(summary);

        const [article, modified] = await Promise.all([
          getArticle(summary.title, { lang: state.lang, signal }),
          getLastModified(summary.title, { lang: state.lang, signal }),
        ]);
        if (!this._alive) return;

        state.article = { summary, article, modified };
        renderArticleBody(summary, article, modified);

        // Facts and related load after the article is readable, so they
        // never delay the thing the user actually came for.
        loadExtras(summary);
        analytics?.completed({ resultTop: summary.title });
      } catch (err) {
        if (err.name === 'AbortError') return;
        body.innerHTML = errorBlock(err, 'Back to search');
        $('wk-retry')?.addEventListener('click', renderHome);
        analytics?.error(err.kind ?? 'article_failed');
      }
    }
    const openArticleBound = openArticle.bind(this);

    function renderArticleShell(s) {
      body.innerHTML = `
        <article class="wk-article">
          <button class="wk-back" id="wk-back">← Back</button>

          <header class="wk-head">
            ${s.image || s.thumbnail
              ? `<img class="wk-hero" src="${escapeHtml(s.image || s.thumbnail)}" alt="" loading="lazy" decoding="async">`
              : ''}
            <div class="wk-head-text">
              <h1>${escapeHtml(s.title)}</h1>
              ${s.description ? `<p class="wk-desc">${escapeHtml(s.description)}</p>` : ''}
              <div class="wk-actions">
                <a class="btn btn-sm" href="${escapeHtml(s.pageUrl)}" target="_blank" rel="noopener">Open on Wikipedia</a>
                <button class="btn btn-sm" id="wk-cite">Cite</button>
                <button class="btn btn-sm" id="wk-copy">Copy summary</button>
              </div>
            </div>
          </header>

          <p class="wk-lead">${escapeHtml(s.extract)}</p>

          <div id="wk-facts"></div>

          <div class="wk-find">
            <input type="search" id="wk-find-q" class="tool-input" placeholder="Find in this article…" aria-label="Find in article">
            <span class="wk-find-count" id="wk-find-count"></span>
            <button class="btn btn-sm" id="wk-find-prev" aria-label="Previous match">↑</button>
            <button class="btn btn-sm" id="wk-find-next" aria-label="Next match">↓</button>
          </div>

          <div class="wk-layout">
            <nav class="wk-toc" id="wk-toc" aria-label="Contents"></nav>
            <div class="wk-content" id="wk-content">${spinner('Loading the full article…')}</div>
          </div>

          <div id="wk-related"></div>
        </article>`;

      $('wk-back').addEventListener('click', () => (state.results.length ? renderResults() : renderHome()));
      $('wk-cite').addEventListener('click', (e) => showCite(s, e.target));
      $('wk-copy').addEventListener('click', (e) => copyText(`${s.title} — ${s.extract}\n\n${s.pageUrl}`, e.target));
    }

    function renderArticleBody(s, article, modified) {
      $('wk-toc').innerHTML = article.sections.length
        ? `<span class="wk-toc-label">Contents</span>
           <ol>${article.sections.map(sec =>
             `<li class="wk-toc-l${sec.level}"><a href="#wk-sec-${escapeHtml(sec.anchor)}"
                data-anchor="${escapeHtml(sec.anchor)}">${escapeHtml(sec.line)}</a></li>`).join('')}</ol>`
        : '';

      const content = $('wk-content');
      content.innerHTML = cleanArticleHtml(article.html, s);

      if (modified) {
        content.insertAdjacentHTML('beforeend', `
          <p class="wk-modified">Last edited ${new Date(modified.timestamp).toLocaleDateString(undefined,
            { day: 'numeric', month: 'long', year: 'numeric' })} · <a href="${escapeHtml(s.pageUrl)}"
            target="_blank" rel="noopener">view on Wikipedia</a></p>`);
      }
    }

    /**
     * Wikipedia's parsed HTML carries a lot that only makes sense on
     * Wikipedia: edit links, navboxes, coordinates widgets, reference
     * backlinks. Stripping them is what turns a page into something
     * readable rather than a broken copy of the original.
     */
    function cleanArticleHtml(html, summary) {
      const root = document.createElement('div');
      root.innerHTML = html;

      const drop = [
        '.mw-editsection', '.navbox', '.vertical-navbox', '.metadata', '.ambox',
        '.hatnote', '.mw-empty-elt', '.noprint', '.mw-jump-link', '.shortdescription',
        'style', 'script', '.mw-references-columns .mw-cite-backlink',
        '.infobox', 'table.sidebar', '.thumbcaption .magnify', '#coordinates',
      ];
      for (const sel of drop) root.querySelectorAll(sel).forEach(el => el.remove());

      // Section headings get ids the table of contents can jump to.
      root.querySelectorAll('h2, h3, h4').forEach(h => {
        const anchor = h.querySelector('.mw-headline')?.id || h.id;
        if (anchor) h.id = `wk-sec-${anchor}`;
      });

      // Internal links stay in the tool; external ones open in a new tab.
      root.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') ?? '';
        if (href.startsWith('/wiki/')) {
          const title = decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' ');
          if (/^(File|Category|Help|Template|Special|Portal|Wikipedia):/i.test(title)) {
            a.replaceWith(document.createTextNode(a.textContent));
            return;
          }
          a.setAttribute('href', '#');
          a.dataset.wikiLink = title;
          a.classList.add('wk-link');
        } else if (href.startsWith('#')) {
          a.setAttribute('href', `#wk-sec-${href.slice(1)}`);
          a.dataset.anchor = href.slice(1);
        } else if (/^https?:/.test(href)) {
          a.target = '_blank';
          a.rel = 'noopener nofollow';
          a.classList.add('wk-ext');
        } else {
          a.replaceWith(document.createTextNode(a.textContent));
        }
      });

      // Protocol-relative image sources, and lazy loading for the rest.
      root.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') ?? '';
        if (src.startsWith('//')) img.src = `https:${src}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.removeAttribute('srcset');
      });

      return root.innerHTML;
    }

    /* ---------------- quick facts & related ---------------- */

    async function loadExtras(summary) {
      const signal = controller?.signal;

      if (summary.wikidataId) {
        try {
          const entity = await getWikidataEntity(summary.wikidataId, { signal, lang: state.lang });
          if (!alive || !entity?.facts.length) return renderRelated(summary);
          $('wk-facts').innerHTML = `
            <section class="wk-facts">
              <h2 class="wk-facts-title">Quick facts</h2>
              <dl>
                ${entity.facts.map(f => `
                  <div class="wk-fact">
                    <dt>${escapeHtml(f.label)}</dt>
                    <dd>${f.values.map(v => escapeHtml(v)).join(', ')}</dd>
                  </div>`).join('')}
              </dl>
              <a class="wk-facts-src" href="${escapeHtml(entity.url)}" target="_blank" rel="noopener">From Wikidata ${escapeHtml(entity.id)}</a>
            </section>`;
        } catch { /* facts are a bonus; never break the article for them */ }
      }
      renderRelated(summary);
    }

    async function renderRelated(summary) {
      try {
        const related = await getRelatedArticles(summary.title, { lang: state.lang, signal: controller?.signal });
        if (!alive || !related.length) return;
        $('wk-related').innerHTML = `
          <section class="wk-related">
            <h2 class="wk-facts-title">Related</h2>
            <div class="wk-related-grid">
              ${related.map(r => `
                <button class="wk-rel" data-open="${escapeHtml(r.title)}">
                  ${r.thumbnail ? `<img src="${escapeHtml(r.thumbnail)}" alt="" loading="lazy" decoding="async">` : ''}
                  <span class="wk-rel-title">${escapeHtml(r.title)}</span>
                  <span class="wk-rel-desc">${escapeHtml(r.description || r.extract.slice(0, 90))}</span>
                </button>`).join('')}
            </div>
          </section>`;
      } catch { /* related is optional on many language editions */ }
    }

    /* ---------------- citation ---------------- */

    function showCite(s, anchor) {
      const now = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      const year = new Date().getFullYear();
      const formats = {
        Plain: `“${s.title}.” Wikipedia. ${s.pageUrl} (accessed ${now}).`,
        APA: `${s.title}. (${year}). In Wikipedia. Retrieved ${now}, from ${s.pageUrl}`,
        MLA: `“${s.title}.” Wikipedia, Wikimedia Foundation, ${now}, ${s.pageUrl}.`,
      };

      const panel = document.createElement('div');
      panel.className = 'wk-cite';
      panel.innerHTML = `
        ${Object.entries(formats).map(([k, v]) => `
          <div class="wk-cite-row">
            <span class="wk-cite-label">${k}</span>
            <code>${escapeHtml(v)}</code>
            <button class="btn btn-sm" data-cite="${escapeHtml(v)}">Copy</button>
          </div>`).join('')}
        <p class="wk-cite-note">A convenience, not an authority — check it against whatever style guide you are held to.</p>`;

      anchor.closest('.wk-head').insertAdjacentElement('afterend', panel);
      panel.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cite]');
        if (t) { copyText(t.dataset.cite, t); analytics?.copied({ outputKind: 'text' }); }
      });
      anchor.disabled = true;
    }

    /* ---------------- find in article ---------------- */

    function clearHighlights() {
      const content = $('wk-content');
      if (!content) return;
      for (const m of content.querySelectorAll('mark.wk-hit')) {
        m.replaceWith(document.createTextNode(m.textContent));
      }
      content.normalize();
      state.matches = [];
    }

    function findInArticle(term) {
      clearHighlights();
      const content = $('wk-content');
      if (!content || term.trim().length < 2) { updateFindCount(); return; }

      const needle = term.trim().toLowerCase();
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('script, style')
          ? NodeFilter.FILTER_REJECT
          : n.nodeValue.toLowerCase().includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });

      const targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);

      // Collected first, then mutated — editing while walking invalidates
      // the walker and silently drops matches.
      for (const node of targets.slice(0, 400)) {
        const parts = node.nodeValue.split(new RegExp(`(${escapeRegex(term.trim())})`, 'ig'));
        if (parts.length < 2) continue;
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (part.toLowerCase() === needle) {
            const mark = document.createElement('mark');
            mark.className = 'wk-hit';
            mark.textContent = part;
            frag.appendChild(mark);
          } else if (part) {
            frag.appendChild(document.createTextNode(part));
          }
        }
        node.replaceWith(frag);
      }

      state.matches = [...content.querySelectorAll('mark.wk-hit')];
      state.matchIndex = 0;
      focusMatch(0);
      updateFindCount();
    }

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function focusMatch(i) {
      if (!state.matches.length) return;
      state.matchIndex = (i + state.matches.length) % state.matches.length;
      state.matches.forEach((m, idx) => m.classList.toggle('is-current', idx === state.matchIndex));
      state.matches[state.matchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
      updateFindCount();
    }

    function updateFindCount() {
      const el = $('wk-find-count');
      if (!el) return;
      el.textContent = state.matches.length
        ? `${state.matchIndex + 1} of ${state.matches.length}`
        : ($('wk-find-q')?.value.trim().length >= 2 ? 'No matches' : '');
    }

    /* ---------------- events ---------------- */

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = input.value.trim();
      if (!q) { renderHome(); return; }
      // One request after the typing stops, not one per keystroke.
      debounce = setTimeout(() => runSearchBound(q), 420);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(debounce); if (input.value.trim()) runSearchBound(input.value.trim()); }
    });

    $('wk-lang').addEventListener('change', (e) => {
      state.lang = e.target.value;
      try { localStorage.setItem(LANG_KEY, state.lang); } catch { /* private mode */ }
      if (state.query) runSearchBound(state.query); else renderHome();
    });

    $('wk-random').addEventListener('click', async () => {
      body.innerHTML = spinner('Finding something…');
      try {
        const r = await getRandomArticle({ lang: state.lang, signal: newRequest() });
        if (this._alive) openArticleBound(r.title);
      } catch (err) {
        if (err.name !== 'AbortError') body.innerHTML = errorBlock(err, null);
      }
    });

    body.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) { openArticleBound(open.dataset.open); return; }

      const link = e.target.closest('[data-wiki-link]');
      if (link) { e.preventDefault(); openArticleBound(link.dataset.wikiLink); return; }

      const anchor = e.target.closest('[data-anchor]');
      if (anchor) {
        e.preventDefault();
        document.getElementById(`wk-sec-${anchor.dataset.anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    });

    body.addEventListener('input', (e) => {
      if (e.target.id !== 'wk-find-q') return;
      clearTimeout(this._findTimer);
      this._findTimer = setTimeout(() => findInArticle(e.target.value), 250);
    });

    body.addEventListener('keydown', (e) => {
      if (e.target.id === 'wk-find-q' && e.key === 'Enter') {
        e.preventDefault();
        focusMatch(state.matchIndex + (e.shiftKey ? -1 : 1));
      }
    });

    body.addEventListener('click', (e) => {
      if (e.target.id === 'wk-find-next') focusMatch(state.matchIndex + 1);
      if (e.target.id === 'wk-find-prev') focusMatch(state.matchIndex - 1);
    });

    renderHome();
    input.focus();
    analytics?.started();
  },

  destroy() {
    this._alive = false;
    this._markDead?.();
    this._abort?.abort();
    clearTimeout(this._findTimer);
  },
};
