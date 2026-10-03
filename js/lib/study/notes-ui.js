/* ============================================================
   Study — Notes mode (mixed into the Study tool)

   The session's notes, readable and selectable:
   - a reader for each note: its text in paragraphs, with the
     pictures found in it shown where they belong (PDF pages) or
     after the text
   - text selection uses Toolbox's own selection; a Study menu
     appears on it: Explain (word by word, phrase by phrase or
     sentence by sentence), Simplify, Summarize, Define, Quiz me,
     Ask, Copy
   - pictures are selectable: a click selects the whole picture, a
     drag selects a region of it; the same menu explains it
   - whole-note actions: Summarize, Simplify, Explain
   - every answer becomes an insight card that streams in, saved
     with the session

   Motion: cards slide in at the top while the others move down
   (transform), text settles as it streams, the menu and the picture
   region grow from where they are. No bounce, no fades on their own.
   ============================================================ */

import { run, UNITS, parseExplain, explainedSoFar, pieces } from './notes.js';
import { openContextMenu, closeContextMenu } from '../context-menu.js';
import { renderMarkdown } from '../assistant/markdown.js';
import { showToast, copyText } from '../../utils.js';

const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';
const SOFT = 'cubic-bezier(.32, .72, 0, 1)';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  explain: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4V14"/><path d="M12 17h.01"/>'),
  simplify: svg('<path d="M4 7h16M7 12h10M10 17h4"/>'),
  summary: svg('<path d="M5 5h14M5 10h14M5 15h9"/><path d="M17 15l2 2 3-3"/>'),
  define: svg('<path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-4a3 3 0 0 0-3 3"/>'),
  quiz: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  ask: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  word: svg('<path d="M4 7h4M4 12h7M4 17h5"/><path d="M15 7h5v10h-5z"/>'),
  phrase: svg('<path d="M4 9h7M4 15h12"/><path d="M14 6l3 3-3 3"/>'),
  sentence: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  picture: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 13),
  pin: svg('<path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>', 13),
};
const KIND = { summarize: 'Summary', simplify: 'In simpler words', explain: 'Explained', define: 'Definition', ask: 'Answer', picture: 'Picture explained' };
const reduced = () => typeof document === 'undefined' || typeof document.body?.animate !== 'function' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const SHOW_CHARS = 60000;

export const NotesUI = {
  /* ---------- layout ---------- */

  notesHtml() {
    const files = this.session.files || [];
    if (!files.length) {
      return `<div class="st-empty">
        <span class="st-empty-mark">${svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>', 26)}</span>
        <h3>Read and work through your notes</h3>
        <p>Add a PDF, Word or PowerPoint file, an image or pasted notes above. Select any part of it to have it explained word by word, phrase by phrase or sentence by sentence, simplified or summarized. Pictures in your notes can be selected too.</p>
      </div>`;
    }
    if (!files.some(f => f.id === this.noteId)) this.noteId = files[0].id;
    return `<div class="st-notes">
      <section class="st-reader-col">
        <nav class="st-note-tabs" aria-label="Notes">${files.map(f => `<button type="button" class="st-note-tab${f.id === this.noteId ? ' is-on' : ''}" data-act="note" data-id="${esc(f.id)}" title="${esc(f.name)}"><span>${esc(f.name)}</span></button>`).join('')}<button type="button" class="st-note-tab st-note-add" data-act="attach" aria-label="Add notes">${svg('<path d="M12 5v14M5 12h14"/>', 15)}</button></nav>
        <div class="st-note-tools">
          <button type="button" class="st-tool" data-act="note-summarize">${I.summary}<span>Summarize</span></button>
          <button type="button" class="st-tool" data-act="note-simplify">${I.simplify}<span>Simplify</span></button>
          <span class="st-tool-wrap"><button type="button" class="st-tool" data-act="note-explain-menu" aria-haspopup="menu">${I.explain}<span>Explain</span></button></span>
          <span class="st-note-hint">Select text or a picture for more</span>
          <button type="button" class="st-tool st-ins-open" data-act="insights-open" aria-label="Insights">${svg('<path d="M4 6h16M4 12h16M4 18h10"/>')}<span class="st-ins-count"></span></button>
        </div>
        <article class="st-reader" data-study-reader data-selection-menu tabindex="-1" aria-label="Note"><div class="st-reader-loading"><i></i><i></i><i></i></div></article>
      </section>
      <aside class="st-insights" aria-label="Insights">
        <header class="st-ins-head"><strong>Insights</strong><span class="st-ins-count"></span><button type="button" class="st-icon is-sm st-ins-close" data-act="insights-close" aria-label="Close insights">${I.x}</button></header>
        <ol class="st-ins-list" role="list"></ol>
      </aside>
    </div>`;
  },

  /** Loads the open note into the reader and the session's insights into the panel. */
  async mountNotes({ first = false } = {}) {
    const reader = this.stage?.querySelector('.st-reader');
    if (!reader) return;
    this.bindReader(reader);
    this.paintInsights({ first });
    const id = this.noteId;
    const note = await this.store.readFile(id).catch(() => null);
    if (this.dead || this.noteId !== id || !reader.isConnected) return;
    this.note = note ? { ...(this.session.files.find(f => f.id === id) || {}), text: note.text || '', images: note.images || [] } : null;
    reader.innerHTML = this.readerHtml(this.note);
    if (reduced()) return;
    const blocks = [...reader.children].slice(0, 14);
    blocks.forEach((b, i) => b.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60 + i * 45, easing: GLIDE, fill: 'backwards' }));
  },

  readerHtml(note) {
    if (!note) return '<p class="st-muted">This note could not be opened.</p>';
    const text = note.text.length > SHOW_CHARS ? note.text.slice(0, SHOW_CHARS) : note.text;
    const byPage = new Map();
    const loose = [];
    (note.images || []).forEach((img, i) => { if (img.page) { if (!byPage.has(img.page)) byPage.set(img.page, []); byPage.get(img.page).push(i); } else loose.push(i); });
    const fig = (i) => {
      const img = note.images[i];
      return `<figure class="st-fig" data-img="${i}"><div class="st-fig-frame" style="aspect-ratio:${img.w || 4}/${img.h || 3}"><img src="${img.src}" alt="${esc(img.label || 'Picture')}" draggable="false" loading="lazy" decoding="async"></div><figcaption>${esc(img.label || 'Picture')}</figcaption></figure>`;
    };
    let html = '';
    let page = null;
    const flushPage = () => { if (page != null && byPage.has(page)) { html += byPage.get(page).map(fig).join(''); byPage.delete(page); } };
    for (const block of text.split(/\n{2,}/)) {
      const b = block.trim();
      if (!b) continue;
      const marker = /^\[(Page|Slide) (\d+)\]\s*/.exec(b);
      if (marker) {
        flushPage();
        page = marker[1] === 'Page' ? Number(marker[2]) : null;
        html += `<p class="st-page-mark">${marker[1]} ${marker[2]}</p>`;
        const rest = b.slice(marker[0].length).trim();
        if (rest) html += rest.split(/\n/).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
        continue;
      }
      html += `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
    }
    flushPage();
    const rest = [...byPage.values()].flat().concat(loose);
    if (rest.length) html += `${text.trim() ? '<p class="st-page-mark">Pictures</p>' : ''}${rest.map(fig).join('')}`;
    if (note.text.length > SHOW_CHARS) html += `<p class="st-muted">The rest of this note (${(note.text.length - SHOW_CHARS).toLocaleString()} more characters) is used by the Assistant but not shown here.</p>`;
    return html || '<p class="st-muted">No readable text or pictures were found in this note.</p>';
  },

  /* ---------- selection ---------- */

  bindReader(reader) {
    if (reader._bound) return;
    reader._bound = true;
    reader.addEventListener('toolbox:selection', (e) => this.textMenu(e.detail));
    // Pictures: a click selects the whole picture, a drag selects a region of it.
    reader.addEventListener('pointerdown', (e) => {
      const frame = e.target.closest('.st-fig-frame');
      if (!frame || e.button > 0) return;
      e.preventDefault();
      const box = frame.getBoundingClientRect();
      const x0 = (e.clientX - box.left) / box.width, y0 = (e.clientY - box.top) / box.height;
      let region = null;
      const move = (ev) => {
        const x1 = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)), y1 = Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height));
        if (!region && Math.hypot((x1 - x0) * box.width, (y1 - y0) * box.height) < 8) return;
        region = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
        this.showRegion(frame, region, { live: true });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.selectPicture(frame.closest('.st-fig'), region && region.w > 0.03 && region.h > 0.03 ? region : null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  },

  showRegion(frame, r, { live = false } = {}) {
    let el = frame.querySelector('.st-fig-region');
    const fresh = !el;
    if (!el) { el = document.createElement('span'); el.className = 'st-fig-region'; frame.appendChild(el); }
    el.style.left = `${r.x * 100}%`; el.style.top = `${r.y * 100}%`; el.style.width = `${r.w * 100}%`; el.style.height = `${r.h * 100}%`;
    if (fresh && !live && !reduced()) el.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: GLIDE });
  },

  selectPicture(fig, region) {
    this.clearPictures(fig);
    const frame = fig.querySelector('.st-fig-frame');
    if (region) this.showRegion(frame, region);
    else {
      frame.querySelector('.st-fig-region')?.remove();
      fig.classList.add('is-selected');
      if (!reduced()) frame.animate([{ transform: 'scale(.985)' }, { transform: 'none' }], { duration: 420, easing: GLIDE });
    }
    const i = Number(fig.dataset.img);
    const r = (region ? frame.querySelector('.st-fig-region') : frame).getBoundingClientRect();
    openContextMenu({
      x: r.left, y: Math.min(window.innerHeight - 56, r.bottom + 10), presentation: 'horizontal', className: 'tb-selection-menu st-sel-menu', label: 'Picture actions',
      items: [
        { label: region ? 'Explain this part' : 'Explain picture', icon: I.picture, action: () => this.explainPicture(i, region) },
        { label: 'Quiz me on it', icon: I.quiz, action: () => this.quizFrom(`the picture "${this.note.images[i].label}"`, { picture: i, region }) },
        { label: 'Clear', icon: I.x, action: () => this.clearPictures() },
      ],
    });
  },

  clearPictures(except) {
    this.stage?.querySelectorAll('.st-fig').forEach(f => {
      if (f === except) return;
      f.classList.remove('is-selected');
      const reg = f.querySelector('.st-fig-region');
      if (reg) { if (reduced()) reg.remove(); else reg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => reg.remove(), () => reg.remove()); }
    });
  },

  /** Study's own menu for selected text. */
  textMenu(snap) {
    const text = snap.text.trim();
    if (!text) return;
    this.clearPictures();
    const words = text.split(/\s+/).length;
    const word = words === 1 && /^[\p{L}\p{M}'’-]+$/u.test(text.replace(/[.,;:!?)"']+$/, ''));
    const around = this.contextAround(snap);
    const explain = (unit) => this.act('explain', { text, unit, excerpt: text });
    const items = word ? [
      { label: 'Define', icon: I.define, action: () => this.act('define', { text, context: around, excerpt: text }) },
      { label: 'Quiz me', icon: I.quiz, action: () => this.quizFrom(`the word "${text}" as used in my notes`) },
      { label: 'Ask', icon: I.ask, action: () => this.askAbout(text) },
      { label: 'Copy', icon: I.copy, action: () => copyText(text) },
    ] : [
      { label: 'Explain', icon: I.explain, children: [
        { label: UNITS.word, icon: I.word, action: () => explain('word') },
        { label: UNITS.phrase, icon: I.phrase, action: () => explain('phrase') },
        { label: UNITS.sentence, icon: I.sentence, action: () => explain('sentence') },
      ] },
      { label: 'Simplify', icon: I.simplify, action: () => this.act('simplify', { text, excerpt: text }) },
      ...(words > 25 ? [{ label: 'Summarize', icon: I.summary, action: () => this.act('summarize', { text, excerpt: text }) }] : []),
      { label: 'Quiz me', icon: I.quiz, action: () => this.quizFrom(`this passage from my notes: "${text.slice(0, 1500)}"`) },
      { label: 'Ask', icon: I.ask, action: () => this.askAbout(text) },
      { label: 'Copy', icon: I.copy, action: () => copyText(text) },
    ];
    const r = snap.rect;
    openContextMenu({ x: r.left, y: Math.min(window.innerHeight - 56, r.bottom + 10), items, presentation: 'horizontal', className: 'tb-selection-menu st-sel-menu', label: 'Study actions' });
  },

  contextAround(snap) {
    const p = snap.target?.closest?.('p') || snap.target;
    const parts = [p?.previousElementSibling, p, p?.nextElementSibling].filter(Boolean).map(n => n.textContent);
    return parts.join('\n').slice(0, 4000);
  },

  askAbout(text) {
    this.setMode('notes');
    this.input.value = `About “${text.length > 160 ? `${text.slice(0, 160)}…` : text}”: `;
    this.grow(this.input);
    this.input.focus();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.pendingAsk = text;
  },

  quizFrom(what, { picture = null } = {}) {
    void picture;
    this.setMode('mcq');
    this.makeQuiz(`A quiz on ${what}`);
  },

  /* ---------- running actions ---------- */

  noteActions(kind, anchor) {
    if (!this.note) return;
    if (kind === 'explain-menu') {
      const r = anchor.getBoundingClientRect();
      openContextMenu({ x: r.left, y: r.bottom + 8, label: 'Explain the note', items: Object.entries(UNITS).map(([unit, label]) => ({ label, icon: I[unit], action: () => this.act('explain', { text: this.firstPart(unit), unit, whole: true, title: this.note.name, excerpt: this.note.name }) })) });
      return;
    }
    this.act(kind, { text: this.note.text, whole: true, title: this.note.name, excerpt: this.note.name });
  },

  /** Explaining a whole note piece by piece is long: start with its opening, the person can go on from there. */
  firstPart(unit) {
    const t = this.note.text.replace(/\[(Page|Slide) \d+\]/g, ' ');
    const n = unit === 'word' ? 600 : unit === 'phrase' ? 1600 : 2600;
    return t.slice(0, n);
  },

  async explainPicture(i, region) {
    const img = this.note?.images?.[i];
    if (!img) return;
    const src = region ? await crop(img.src, region) : img.src;
    const base64 = src.split(',')[1];
    this.act('picture', { title: this.note.name, context: this.note.text.slice(0, 3000), excerpt: `${img.label}${region ? ' (selected part)' : ''}` }, { image: { base64, type: 'image/jpeg' }, thumb: await thumb(src) });
  },

  async act(kind, opts, { image = null, thumb: preview = null } = {}) {
    if (!this.session.files?.length && kind !== 'ask') return;
    // The selection has done its job; the reader may reflow as the panel opens.
    try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    this.session.insights = this.session.insights || [];
    const ins = { id: this.store.uid('in'), kind, unit: opts.unit || null, excerpt: String(opts.excerpt || '').slice(0, 400), fileId: this.noteId, text: '', items: null, thumb: preview, at: Date.now(), pending: true };
    this.session.insights.unshift(ins);
    if (this.session.insights.length > 80) this.session.insights.length = 80;
    this.openInsights();
    const card = this.addInsightCard(ins);
    const body = card.querySelector('.st-ins-body');
    const controller = new AbortController();
    card._abort = controller;
    let shownItems = 0;
    try {
      const { text, list } = await run(kind, opts, {
        signal: controller.signal, image,
        onText: (t) => {
          if (kind === 'explain') {
            const n = explainedSoFar(t);
            if (n > shownItems) { this.paintExplain(body, parseLoose(t, opts.text, opts.unit), shownItems); shownItems = n; }
          } else this.streamInto(body, t);
        },
      });
      if (kind === 'explain') {
        ins.items = parseExplain(text, list || pieces(opts.text, opts.unit));
        if (!ins.items.length) throw new Error('The Assistant did not explain the pieces. Try again or choose a smaller selection.');
        this.paintExplain(body, ins.items, shownItems);
      } else { ins.text = text; this.streamInto(body, text, { done: true }); }
      ins.pending = false;
      card.classList.remove('is-pending');
      await this.commitInsight();
    } catch (err) {
      ins.pending = false;
      if (controller.signal.aborted) return;
      this.session.insights = this.session.insights.filter(x => x !== ins);
      this.removeInsightCard(card);
      showToast(err?.message || 'The Assistant could not answer.', 'error', 5000);
    }
  },

  async commitInsight() {
    const save = { ...this.session, insights: (this.session.insights || []).filter(x => !x.pending) };
    if (!this.sessions.some(s => s.id === this.session.id)) await this.commit();
    else await this.store.save(save, { quiet: true });
    this.paintInsightCount();
  },

  /* ---------- insights panel ---------- */

  openInsights() {
    const notes = this.stage?.querySelector('.st-notes');
    if (!notes || notes.classList.contains('has-insights')) return;
    notes.classList.add('has-insights');
  },

  paintInsights({ first = false } = {}) {
    const list = this.stage?.querySelector('.st-ins-list');
    if (!list) return;
    const all = (this.session.insights || []).filter(x => !x.pending);
    // Desktop keeps the panel beside the note; on phones it is a sheet that opens when asked.
    if (all.length && window.innerWidth > 760) this.stage.querySelector('.st-notes')?.classList.add('has-insights');
    list.innerHTML = all.map(ins => this.insightHtml(ins)).join('') || '<li class="st-ins-empty">Explanations, summaries and simpler versions you ask for collect here.</li>';
    list.querySelectorAll('.st-ins').forEach((card) => {
      const ins = all.find(x => x.id === card.dataset.id);
      const body = card.querySelector('.st-ins-body');
      if (ins.kind === 'explain') this.paintExplain(body, ins.items || [], ins.items?.length || 0, { quiet: true });
      else body.innerHTML = renderMarkdown(ins.text || '').html;
    });
    this.paintInsightCount();
    if (first && !reduced()) [...list.children].slice(0, 6).forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 140 + i * 60, easing: GLIDE, fill: 'backwards' }));
  },

  paintInsightCount() {
    const n = (this.session.insights || []).filter(x => !x.pending).length;
    this.stage?.querySelectorAll('.st-ins-count').forEach(el => { el.textContent = n ? String(n) : ''; });
  },

  insightHtml(ins) {
    const label = ins.kind === 'explain' ? `${KIND.explain} · ${UNITS[ins.unit]?.toLowerCase() || ''}` : KIND[ins.kind] || 'Insight';
    return `<li class="st-ins${ins.pending ? ' is-pending' : ''}" data-id="${esc(ins.id)}">
      <header class="st-ins-top"><span class="st-ins-kind">${esc(label)}</span>
        <button type="button" class="st-icon is-sm" data-act="insight-remove" aria-label="Remove">${I.x}</button></header>
      ${ins.thumb ? `<img class="st-ins-thumb" src="${ins.thumb}" alt="">` : ''}
      ${ins.excerpt ? `<p class="st-ins-src">${esc(ins.excerpt.length > 180 ? `${ins.excerpt.slice(0, 180)}…` : ins.excerpt)}</p>` : ''}
      <div class="st-ins-body md">${ins.pending ? '<span class="st-ins-wait"><i></i><i></i><i></i></span>' : ''}</div>
    </li>`;
  },

  /** A new card slides in at the top; the cards below move down to make room. */
  addInsightCard(ins) {
    const list = this.stage.querySelector('.st-ins-list');
    list.querySelector('.st-ins-empty')?.remove();
    const before = new Map([...list.children].map(c => [c, c.getBoundingClientRect().top]));
    list.insertAdjacentHTML('afterbegin', this.insightHtml(ins));
    const card = list.firstElementChild;
    this.paintInsightCount();
    if (!reduced()) {
      for (const [c, top] of before) { const dy = top - c.getBoundingClientRect().top; if (Math.abs(dy) > 0.5) c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: SOFT }); }
      card.animate([{ opacity: 0, transform: 'translateY(-14px) scale(.985)', clipPath: 'inset(0 0 100% 0 round 16px)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0 round 16px)' }], { duration: 560, easing: SOFT });
    }
    list.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    return card;
  },

  removeInsightCard(card) {
    const list = card.parentElement;
    const sibs = [...list.children].filter(c => c !== card);
    const before = new Map(sibs.map(c => [c, c.getBoundingClientRect().top]));
    const done = () => {
      card.remove();
      if (!reduced()) for (const [c, top] of before) { const dy = top - c.getBoundingClientRect().top; if (Math.abs(dy) > 0.5) c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: SOFT }); }
      if (!list.children.length) list.innerHTML = '<li class="st-ins-empty">Explanations, summaries and simpler versions you ask for collect here.</li>';
      this.paintInsightCount();
    };
    if (reduced()) { done(); return; }
    card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 300, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.then(done, done);
  },

  /** Streaming Markdown: paragraphs that are new settle in; the rest is patched in place. */
  streamInto(body, text, { done = false } = {}) {
    const html = renderMarkdown(text, { streaming: !done }).html;
    const had = body.children.length;
    const wait = body.querySelector('.st-ins-wait');
    if (wait) wait.remove();
    body.innerHTML = html;
    if (reduced()) return;
    [...body.children].slice(had ? had - 1 : 0).forEach((n, i) => { if (i === 0 && had) return; n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: GLIDE }); });
  },

  paintExplain(body, items, from = 0, { quiet = false } = {}) {
    body.querySelector('.st-ins-wait')?.remove();
    let ol = body.querySelector('.st-ex');
    if (!ol) { ol = document.createElement('ol'); ol.className = 'st-ex'; body.appendChild(ol); }
    for (let i = ol.children.length; i < items.length; i++) {
      const li = document.createElement('li');
      li.innerHTML = `<mark class="st-ex-piece">${esc(items[i].piece)}</mark><p>${esc(items[i].explanation)}</p>`;
      ol.appendChild(li);
      if (!quiet && !reduced()) li.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: Math.max(0, i - from) * 70, easing: GLIDE, fill: 'backwards' });
    }
  },

  async removeInsight(card) {
    const id = card.dataset.id;
    card._abort?.abort();
    this.session.insights = (this.session.insights || []).filter(x => x.id !== id);
    this.removeInsightCard(card);
    await this.store.save(this.session, { quiet: true });
  },

  closeInsights() {
    const notes = this.stage?.querySelector('.st-notes');
    notes?.classList.remove('has-insights');
  },

  /** A question typed in Notes mode is answered from the open note. */
  askNotes(question) {
    const text = this.pendingAsk ? `${question}` : question;
    this.pendingAsk = null;
    this.act('ask', { text, context: this.note?.text || '', excerpt: question });
  },

  closeMenus() { closeContextMenu({ instant: true }); },
};

/** Items finished so far in a streaming explain reply. */
function parseLoose(t, text, unit) {
  const out = [];
  const re = /\{\s*"piece"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = re.exec(t))) { try { out.push({ piece: JSON.parse(`"${m[1]}"`), explanation: JSON.parse(`"${m[2]}"`) }); } catch { /* partial */ } }
  void text; void unit;
  return out;
}

function loadImage(src) { return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; }); }

/** The selected part of a picture, as a JPEG data URL. */
async function crop(src, r) {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(img.naturalWidth * r.w));
  c.height = Math.max(8, Math.round(img.naturalHeight * r.h));
  c.getContext('2d').drawImage(img, img.naturalWidth * r.x, img.naturalHeight * r.y, c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function thumb(src) {
  const img = await loadImage(src);
  const k = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
