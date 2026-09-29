/* ============================================================
   Music Theory Library — theory from first notes to post-tonal
   analysis, world traditions, instrument tutorials with roadmaps,
   and interactive labs (scales, chords, progressions, circle of
   fifths, ear training, rhythm) that you can see and hear.

   Content: js/lib/music/library/*   Engine: js/lib/music/theory.js
   Sound: js/lib/music/audio.js      Drawings: js/lib/music/widgets.js
   Styles: css/music-library.css
   ============================================================ */

import { SECTIONS, TOPICS, INSTRUMENTS, GLOSSARY, LEVELS, getTopic, getInstrument, resolveId, topicsIn, searchLibrary } from '../lib/music/library/index.js';
import * as T from '../lib/music/theory.js';
import { staffSvg, pianoSvg, fretboardSvg, circleSvg, FRET_TUNINGS } from '../lib/music/widgets.js';
import * as A from '../lib/music/audio.js';
import { icon } from '../lib/icons.js';
import { LibraryMotion, movePill, pointerLight } from '../lib/music/library-motion.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** **bold**, *italic*, [[id|text]] → HTML. */
const md = (s) => esc(s)
  .replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, (_, id, t) => `<a href="#" class="mtl-link" data-go="${id}">${t}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const pretty = (n) => n.replace(/#/g, '♯').replace(/b/g, '♭');
const PREF_KEY = 'toolbox.music.level';
const nn = (n, o = false) => T.noteName(n, { octave: o });
const mid = (n) => T.midi(n);
const TABS = [['learn', 'Learn'], ['instruments', 'Instruments'], ['roadmaps', 'Roadmaps'], ['labs', 'Labs'], ['glossary', 'Glossary']];

const LABS = [
  { id: 'scale', title: 'Scale explorer', blurb: 'Any scale on any root: staff, keyboard, guitar and sound.', demo: { type: 'scale', tonic: 'C4', scale: 'major', choose: true, fretboard: true } },
  { id: 'chord', title: 'Chord explorer', blurb: 'Every chord type, with inversions and voicing.', demo: { type: 'chord', root: 'C4', quality: 'maj7', choose: Object.keys(T.CHORDS).filter(q => q !== '7alt'), inversions: true } },
  { id: 'chordname', title: 'What chord is this?', blurb: 'Tap notes on the keyboard and get the chord name.', demo: { type: 'chordname' } },
  { id: 'circle', title: 'Circle of fifths', blurb: 'Keys, signatures, relatives and chords.', demo: { type: 'circle' } },
  { id: 'progression', title: 'Progression player', blurb: 'Hear common progressions in any key.', demo: { type: 'progression', tonic: 'C4', numerals: 'I V vi IV', choose: ['I V vi IV', 'I vi IV V', 'ii7 V7 Imaj7', 'I IV V I', 'vi IV I V', 'i bVII bVI V', 'I bVII IV I', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'IV V iii vi', 'iiø7 V7 i'], free: true } },
  { id: 'diatonic', title: 'Chords in a key', blurb: 'The diatonic triads and sevenths of any key.', demo: { type: 'diatonic', tonic: 'C4', scale: 'major' } },
  { id: 'eartrainer', title: 'Interval ear trainer', blurb: 'Hear an interval, name it, keep score.', demo: { type: 'eartrainer' } },
  { id: 'intervals', title: 'Interval reference', blurb: 'All intervals with sounds and reference songs.', demo: { type: 'intervals' } },
  { id: 'metronome', title: 'Metronome', blurb: 'Steady beat with accents.', demo: { type: 'metronome', tempo: 90, beats: 4 } },
  { id: 'polyrhythm', title: 'Polyrhythm', blurb: 'Hear and see 3:2, 4:3, 5:4.', demo: { type: 'polyrhythm', a: 3, b: 2, choose: true } },
  { id: 'bell', title: 'Bell patterns and clave', blurb: 'West African bell, tresillo, son and rumba clave.', demo: { type: 'bell', choose: true } },
  { id: 'meter', title: 'Time signatures', blurb: 'Simple, compound and odd meters explained and played.', demo: { type: 'meter', meters: ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8', '5/4', '7/8', '11/8'] } },
  { id: 'keysig', title: 'Key signatures', blurb: 'Every major and minor key signature.', demo: { type: 'keysig' } },
  { id: 'transpose', title: 'Transposing instruments', blurb: 'Written to concert pitch and back.', demo: { type: 'transpose' } },
  { id: 'harmonics', title: 'Harmonic series', blurb: 'The overtones inside a note.', demo: { type: 'harmonics', fundamental: 'C2' } },
];

const BELLS = {
  'Standard bell (12/8)': { pattern: 'x.x.xx.x.x.x', pulses: 12 },
  'Tresillo (3-3-2)': { pattern: 'x..x..x.', pulses: 8 },
  'Son clave 3-2': { pattern: 'x..x..x...x.x...', pulses: 16 },
  'Rumba clave 3-2': { pattern: 'x..x...x..x.x...', pulses: 16 },
  'Bossa nova': { pattern: 'x..x..x...x..x..', pulses: 16 },
};

export default {
  render(container) {
    this.destroy();
    this.container = container;
    let level = 'beginner';
    try { level = localStorage.getItem(PREF_KEY) || 'beginner'; } catch { /* default */ }
    this.state = { tab: 'learn', view: { kind: 'home' }, history: [], level, query: '' };
    this.demos = new Map();
    this.stopFns = new Set();

    container.innerHTML = `
      <div class="mtl-root" data-level="${level}">
        <header class="mtl-head">
          <div class="mtl-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" id="mtl-q" placeholder="Search theory, instruments, terms… (e.g. Dorian, ii–V–I, how to play violin)" autocomplete="off" aria-label="Search the Music Theory Library">
          </div>
          <div class="mtl-level" role="group" aria-label="Explanation depth">
            <button type="button" data-level="beginner" aria-pressed="${level === 'beginner'}">Beginner</button>
            <button type="button" data-level="expert" aria-pressed="${level === 'expert'}">Expert</button>
          </div>
        </header>
        <nav class="mtl-tabs" role="tablist" aria-label="Library sections">
          ${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === 'learn'}">${label}</button>`).join('')}
        </nav>
        <main class="mtl-main" id="mtl-main" tabindex="-1"></main>
      </div>`;

    this.main = container.querySelector('#mtl-main');
    this.motion = new LibraryMotion(this.main);
    this._unlight = pointerLight(container);
    const levelEl = container.querySelector('.mtl-level');
    requestAnimationFrame(() => movePill(levelEl));
    if (typeof ResizeObserver !== 'undefined') { this._pillRO = new ResizeObserver(() => movePill(levelEl)); this._pillRO.observe(levelEl); }
    // "In depth" opening plays its content in, one piece after another.
    container.addEventListener('toggle', this._onToggle = (e) => { if (e.target.matches?.('details.mtl-deep') && e.target.open) this.motion.replay(e.target.querySelector(':scope > div')); }, true);
    this._onClick = (e) => this.onClick(e);
    this._onChange = (e) => this.onChange(e);
    this._onInput = (e) => { if (e.target.id === 'mtl-q') { clearTimeout(this._qt); this._qt = setTimeout(() => this.search(e.target.value), 140); } };
    container.addEventListener('click', this._onClick);
    container.addEventListener('change', this._onChange);
    container.addEventListener('input', this._onInput);
    container.addEventListener('keydown', this._onKey = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-circle]')) { e.preventDefault(); e.target.closest('[data-circle]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });

    // Opened from the Assistant or elsewhere: { topic | instrument | lab | query }.
    let focus = null;
    try { focus = JSON.parse(localStorage.getItem('toolbox.music.focus') || 'null'); localStorage.removeItem('toolbox.music.focus'); } catch { /* none */ }
    if (focus?.topic && getTopic(focus.topic)) this.go({ kind: 'topic', id: focus.topic }, false);
    else if (focus?.instrument && getInstrument(focus.instrument)) { this.setTab('instruments', false); this.go({ kind: 'instrument', id: focus.instrument }, false); }
    else if (focus?.lab) { this.setTab('labs', false); this.go({ kind: 'lab', id: focus.lab, demo: focus.demo }, false); }
    else if (focus?.query) { container.querySelector('#mtl-q').value = focus.query; this.search(focus.query); }
    else this.renderView();
  },

  /* ---------------- navigation ---------------- */

  setTab(tab, render = true) {
    this.state.tab = tab;
    this.container.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const btn = this.container.querySelector(`[data-tab="${tab}"]`);
    if (btn && !this.motion?.off) { btn.classList.remove('is-picked'); void btn.offsetWidth; btn.classList.add('is-picked'); }
    if (render) { this.state.history = []; this.state.view = { kind: 'home' }; this.renderView('tab'); }
  },

  go(view, push = true) {
    if (push) this.state.history.push(this.state.view);
    this.state.view = view;
    if (view.kind === 'instrument' && this.state.tab !== 'instruments') this.setTab('instruments', false);
    if (view.kind === 'topic' && !['learn', 'roadmaps'].includes(this.state.tab)) this.setTab(getTopic(view.id)?.section === 'roadmaps' ? 'roadmaps' : 'learn', false);
    this.renderView(push ? 'forward' : 'tab');
    // The tool card scrolls internally on desktop and the window scrolls on phones: reset whichever applies.
    const scroller = this.container.closest('#viewport-content');
    if (scroller && scroller.scrollHeight > scroller.clientHeight) scroller.scrollTop = 0;
    const top = this.container.getBoundingClientRect().top;
    if (top < 0) window.scrollTo?.({ top: Math.max(0, top + window.scrollY - 70), behavior: 'instant' });
  },

  back() {
    this.state.view = this.state.history.pop() || { kind: 'home' };
    this.renderView('back');
  },

  /** mode: how the new view arrives — 'forward' (opened), 'back', 'tab' or 'search'. */
  renderView(mode = 'tab') {
    A.stopAll();
    this.stopFns.forEach(f => f()); this.stopFns.clear();
    this.demos.clear();
    this.motion?.reset();
    const v = this.state.view;
    let html = '';
    if (v.kind === 'search') html = this.searchHtml(v.query);
    else if (v.kind === 'topic') html = this.topicHtml(getTopic(v.id));
    else if (v.kind === 'instrument') html = this.instrumentHtml(getInstrument(v.id));
    else if (v.kind === 'section') html = this.sectionHtml(v.id);
    else if (v.kind === 'lab') html = this.labHtml(v.id, v.demo);
    else html = ({ learn: () => this.homeHtml(), instruments: () => this.instrumentsHtml(), roadmaps: () => this.roadmapsHtml(), labs: () => this.labsHtml(), glossary: () => this.glossaryHtml() })[this.state.tab]();
    this.main.innerHTML = html;
    this.main.querySelectorAll('[data-demo]').forEach(el => this.paintDemo(el, { animate: false }));
    this.motion?.enter(this.main, { mode });
  },

  search(q) {
    this.state.query = q;
    if (!q.trim()) { this.state.view = this.state.history.pop() || { kind: 'home' }; this.renderView('back'); return; }
    if (this.state.view.kind !== 'search') this.state.history.push(this.state.view);
    this.state.view = { kind: 'search', query: q };
    this.renderView('search');
  },

  backBar(label) {
    return `<div class="mtl-crumbs"><button type="button" class="mtl-back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>${label}</div>`;
  },

  /* ---------------- pages ---------------- */

  homeHtml() {
    return `
      <section class="mtl-hero">
        ${this.heroArt()}
        <h2>Music theory, from your first note to expert analysis</h2>
        <p>Everything you can see, you can hear: tap the play buttons and the keyboard.</p>
        <div class="mtl-stats">
          <div><strong data-count="${TOPICS.length}">${TOPICS.length}</strong><span>topics</span></div>
          <div><strong data-count="${INSTRUMENTS.length}">${INSTRUMENTS.length}</strong><span>instrument guides</span></div>
          <div><strong data-count="${LABS.length}">${LABS.length}</strong><span>interactive labs</span></div>
          <div><strong data-count="${GLOSSARY.length}">${GLOSSARY.length}</strong><span>terms</span></div>
        </div>
        <div class="mtl-hero-actions">
          <button type="button" class="mtl-btn mtl-btn-primary" data-go="theory-roadmap">Start here: the theory roadmap</button>
          <button type="button" class="mtl-btn" data-tab-go="labs">Open the labs</button>
          <button type="button" class="mtl-btn" data-tab-go="instruments">Learn an instrument</button>
        </div>
      </section>
      <div class="mtl-grid">${SECTIONS.filter(s => topicsIn(s.id).length).map(s => `
        <button type="button" class="mtl-card" data-section="${s.id}">
          <span class="mtl-card-title">${esc(s.title)}</span>
          <span class="mtl-card-text">${esc(s.blurb)}</span>
          <span class="mtl-card-meta">${topicsIn(s.id).length} topics · ${this.levelSpread(topicsIn(s.id))}</span>
        </button>`).join('')}
      </div>`;
  },

  /** A staff that draws itself behind the hero, with a rising melody landing on it. */
  heroArt() {
    const lines = [0, 1, 2, 3, 4].map(i => `<path pathLength="1" style="--l:${i}" d="M8 ${56 + i * 18}H512"/>`).join('');
    // C D E G A C' E' G' — the pentatonic climbing the staff.
    const notes = [[70, 146], [128, 137], [186, 128], [244, 110], [302, 101], [360, 83], [418, 65], [476, 47]]
      .map(([x, y], i) => `<g class="mha-note" style="--c:${i}"><ellipse cx="${x}" cy="${y}" rx="11" ry="8" transform="rotate(-20 ${x} ${y})"/><path d="M${x + 10} ${y - 2}V${y - 58}"/></g>`).join('');
    return `<svg class="mtl-hero-art" viewBox="0 0 520 200" aria-hidden="true" focusable="false"><g class="mha-lines">${lines}</g>${notes}</svg>`;
  },

  levelSpread(list) {
    const lo = Math.min(...list.map(t => t.level)), hi = Math.max(...list.map(t => t.level));
    return lo === hi ? LEVELS[lo] : `${LEVELS[lo]} → ${LEVELS[hi]}`;
  },

  sectionHtml(id) {
    const s = SECTIONS.find(x => x.id === id);
    const list = topicsIn(id).slice().sort((a, b) => a.level - b.level);
    return `${this.backBar(`<span>${esc(s.title)}</span>`)}
      <p class="mtl-lede">${esc(s.blurb)}</p>
      <div class="mtl-list">${list.map(t => this.topicRow(t)).join('')}</div>`;
  },

  topicRow(t) {
    return `<button type="button" class="mtl-row" data-go="${t.id}">
      <span class="mtl-lvl mtl-lvl-${t.level}">${LEVELS[t.level]}</span>
      <span class="mtl-row-main"><span class="mtl-row-title">${esc(t.title)}</span><span class="mtl-row-text">${esc(t.summary)}</span></span>
      <svg class="mtl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
  },

  topicHtml(t) {
    if (!t) return '<p>Topic not found.</p>';
    const s = SECTIONS.find(x => x.id === t.section);
    const peers = topicsIn(t.section);
    const i = peers.findIndex(p => p.id === t.id);
    const expert = this.state.level === 'expert';
    return `${this.backBar(`<button type="button" class="mtl-crumb" data-section="${s.id}">${esc(s.title)}</button>`)}
      <article class="mtl-topic">
        <header class="mtl-topic-head">
          <span class="mtl-lvl mtl-lvl-${t.level}">${LEVELS[t.level]}</span>
          <h2>${esc(t.title)}</h2>
          <span class="mtl-staffline" aria-hidden="true"></span>
          <p class="mtl-lede">${esc(t.summary)}</p>
        </header>
        <section class="mtl-simple">${this.blocks(t.simple)}</section>
        ${t.deep?.length ? `<details class="mtl-deep"${expert ? ' open' : ''}>
          <summary><span class="mtl-pm" aria-hidden="true"></span><span>In depth</span><small>${expert ? 'For advanced study' : 'Tap to go deeper'}</small></summary>
          <div>${this.blocks(t.deep)}</div></details>` : ''}
        ${t.related?.length ? `<section class="mtl-related"><h3>Related</h3><div class="mtl-chips">${t.related.map(r => { const x = resolveId(r); return x ? `<button type="button" class="mtl-chip" data-go="${r}">${esc(x.item.title || x.item.name)}</button>` : ''; }).join('')}</div></section>` : ''}
        <nav class="mtl-pager">
          ${i > 0 ? `<button type="button" class="mtl-btn" data-go="${peers[i - 1].id}">${icon('arrow-left')}<span>${esc(peers[i - 1].title)}</span></button>` : '<span></span>'}
          ${i < peers.length - 1 ? `<button type="button" class="mtl-btn" data-go="${peers[i + 1].id}"><span>${esc(peers[i + 1].title)}</span>${icon('arrow-right')}</button>` : ''}
        </nav>
      </article>`;
  },

  blocks(list = []) {
    return list.map(b => {
      if (typeof b === 'string') return `<p>${md(b)}</p>`;
      if (b.list) return `<ul>${b.list.map(x => `<li>${md(x)}</li>`).join('')}</ul>`;
      if (b.steps) return `<ol class="mtl-steps">${b.steps.map(x => `<li>${md(x)}</li>`).join('')}</ol>`;
      if (b.tip) return `<p class="mtl-tip">${md(b.tip)}</p>`;
      if (b.table) return `<div class="mtl-table-wrap"><table class="mtl-table"><thead><tr>${b.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map(c => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      if (b.roadmap) return this.roadmapHtml(b.roadmap);
      if (b.example) return this.demoSlot(b.example);
      return '';
    }).join('');
  },

  roadmapHtml(stages) {
    return `<ol class="mtl-road">${stages.map((st, i) => `<li><span class="mtl-road-dot">${i + 1}</span><div><h4>${esc(st.stage)}</h4><ul>${(st.items || st.goals).map(x => `<li>${md(x)}</li>`).join('')}</ul></div></li>`).join('')}</ol>`;
  },

  instrumentsHtml() {
    const fam = [...new Set(INSTRUMENTS.map(i => i.family.split(' (')[0]))];
    return `<p class="mtl-lede">How each instrument works and is played, a first-lessons plan for teachers, practice routines and a roadmap from first week to expert.</p>
      ${fam.map(f => `<h3 class="mtl-h3">${esc(f)}</h3><div class="mtl-grid mtl-grid-sm">${INSTRUMENTS.filter(i => i.family.startsWith(f)).map(i => `
        <button type="button" class="mtl-card" data-inst="${i.id}"><span class="mtl-card-title">${esc(i.name)}</span><span class="mtl-card-text">${esc(i.overview.split('. ')[0])}.</span></button>`).join('')}</div>`).join('')}`;
  },

  instrumentHtml(i) {
    if (!i) return '<p>Instrument not found.</p>';
    const sec = (title, body) => body ? `<section class="mtl-isec"><h3>${title}</h3>${body}</section>` : '';
    return `${this.backBar('<button type="button" class="mtl-crumb" data-tab-go="instruments">Instruments</button>')}
      <article class="mtl-topic">
        <header class="mtl-topic-head"><span class="mtl-lvl">${esc(i.family)}</span><h2>${esc(i.name)}</h2><span class="mtl-staffline" aria-hidden="true"></span><p class="mtl-lede">${md(i.overview)}</p></header>
        ${i.demo ? this.demoSlot(i.demo) : ''}
        <div class="mtl-facts">
          <div><h4>How it makes sound</h4><p>${md(i.sound)}</p></div>
          <div><h4>Range and notation</h4><p>${md(i.range)}</p></div>
          <div><h4>Tuning</h4><p>${md(i.tuning)}</p></div>
          ${i.parts?.length ? `<div><h4>Parts</h4><ul>${i.parts.map(p => `<li>${md(p)}</li>`).join('')}</ul></div>` : ''}
        </div>
        ${sec('How it is played', (i.howToPlay || []).map(h => `<h4>${esc(h.h)}</h4><p>${md(h.text)}</p>`).join(''))}
        ${sec('First lessons <small>(a teaching sequence)</small>', i.firstLessons?.length ? `<ol class="mtl-steps">${i.firstLessons.map(x => `<li>${md(x)}</li>`).join('')}</ol>` : '')}
        ${sec('Practice routine', i.practice?.length ? `<ul>${i.practice.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '')}
        ${sec('Common problems to watch for', i.mistakes?.length ? `<ul>${i.mistakes.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '')}
        ${sec('Care', i.care?.length ? `<ul>${i.care.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '')}
        ${sec('Roadmap', this.roadmapHtml(i.roadmap || []) + (i.grades ? `<p class="mtl-tip">${md(i.grades)}</p>` : ''))}
        ${i.topics?.length ? `<section class="mtl-related"><h3>Theory for this instrument</h3><div class="mtl-chips">${i.topics.map(r => { const x = resolveId(r); return x ? `<button type="button" class="mtl-chip" data-go="${r}">${esc(x.item.title || x.item.name)}</button>` : ''; }).join('')}</div></section>` : ''}
      </article>`;
  },

  roadmapsHtml() {
    const theory = getTopic('theory-roadmap');
    return `<p class="mtl-lede">Simple paths through the library and through each instrument.</p>
      <section class="mtl-isec"><h3>${esc(theory.title)}</h3>${this.blocks(theory.simple)}</section>
      ${this.blocks([{ roadmap: [
        { stage: 'Reading music', items: ['[[reading-music-roadmap|How to learn to read music]]'] },
        { stage: 'Ear and musicianship', items: ['[[ear-training|Ear training]]', '[[solfege|Solfège]]', '[[practice-methods|How to practise]]', '[[improvisation-basics|Starting to improvise]]'] },
        { stage: 'Jazz path', items: ['[[seventh-chords|Seventh chords]]', '[[jazz-harmony|Jazz harmony essentials]]', '[[voicings|Voicings]]', '[[chord-scale-theory|Chord–scale theory]]', '[[bebop-language|Bebop language]]', '[[tritone-substitution|Reharmonisation]]'] },
        { stage: 'Songwriting and production path', items: ['[[common-progressions|Common progressions]]', '[[song-forms|Song sections]]', '[[songwriting|Songwriting]]', '[[arranging|Arranging]]', '[[music-production|Production basics]]'] },
      ] }])}
      <h3 class="mtl-h3">Instrument roadmaps</h3>
      <div class="mtl-grid mtl-grid-sm">${INSTRUMENTS.map(i => `<button type="button" class="mtl-card" data-inst="${i.id}"><span class="mtl-card-title">${esc(i.name)}</span><span class="mtl-card-meta">${i.roadmap.length} stages</span></button>`).join('')}</div>`;
  },

  labsHtml() {
    return `<p class="mtl-lede">Hands-on tools. Everything plays sound: turn your volume up.</p>
      <div class="mtl-grid">${LABS.map(l => `<button type="button" class="mtl-card" data-lab="${l.id}"><span class="mtl-card-title">${esc(l.title)}</span><span class="mtl-card-text">${esc(l.blurb)}</span></button>`).join('')}</div>`;
  },

  labHtml(id, demo) {
    const lab = LABS.find(l => l.id === id);
    if (!lab) return '';
    return `${this.backBar('<button type="button" class="mtl-crumb" data-tab-go="labs">Labs</button>')}
      <article class="mtl-topic"><header class="mtl-topic-head"><h2>${esc(lab.title)}</h2><span class="mtl-staffline" aria-hidden="true"></span><p class="mtl-lede">${esc(lab.blurb)}</p></header>${this.demoSlot({ ...lab.demo, ...(demo || {}) })}</article>`;
  },

  glossaryHtml() {
    const letters = [...new Set(GLOSSARY.map(g => g.term[0].toUpperCase()))];
    return `<nav class="mtl-az">${letters.map(l => `<a href="#" data-az="${l}">${l}</a>`).join('')}</nav>
      <dl class="mtl-gloss">${GLOSSARY.map(g => `<div id="mtl-az-${g.term[0].toUpperCase()}" data-letter="${g.term[0].toUpperCase()}"><dt>${esc(g.term)}</dt><dd>${esc(g.def)}${g.topic ? ` <a href="#" class="mtl-link" data-go="${g.topic}">More</a>` : ''}</dd></div>`).join('')}</dl>`;
  },

  searchHtml(q) {
    const hits = searchLibrary(q, { limit: 30 });
    if (!hits.length) return `<p class="mtl-lede">Nothing matches “${esc(q)}”. Try a term like “seventh chord”, “Dorian” or “trumpet”.</p>`;
    return `<p class="mtl-lede">${hits.length} result${hits.length > 1 ? 's' : ''} for “${esc(q)}”</p>
      <div class="mtl-list">${hits.map(h => h.kind === 'topic' ? this.topicRow(getTopic(h.id))
        : h.kind === 'instrument' ? `<button type="button" class="mtl-row" data-inst="${h.id}"><span class="mtl-lvl">Instrument</span><span class="mtl-row-main"><span class="mtl-row-title">${esc(h.title)}</span><span class="mtl-row-text">${esc(getInstrument(h.id).overview.split('. ')[0])}.</span></span></button>`
          : `<button type="button" class="mtl-row" ${h.topic ? `data-go="${h.topic}"` : ''}><span class="mtl-lvl">Term</span><span class="mtl-row-main"><span class="mtl-row-title">${esc(h.title)}</span><span class="mtl-row-text">${esc(h.def)}</span></span></button>`).join('')}</div>`;
  },

  /* ---------------- demos ---------------- */

  demoSlot(demo) {
    const key = `d${this.demos.size + 1}`;
    this.demos.set(key, { ...demo });
    return `<div class="mtl-demo" data-demo="${key}"></div>`;
  },

  paintDemo(el, { animate = true } = {}) {
    const d = this.demos.get(el.dataset.demo);
    if (!d) return;
    const painter = this.painters[d.type];
    el.innerHTML = painter ? painter.call(this, d) : '';
    if (animate) this.motion?.repaint(el);
  },

  repaint(el) { this.paintDemo(el.closest('[data-demo]')); },

  rootSelect(value, name = 'root') {
    const cur = value.replace(/-?\d+$/, '');
    return `<select class="mtl-select" data-k="${name}" aria-label="Root">${ROOTS.map(r => `<option value="${r}"${r === cur ? ' selected' : ''}>${pretty(r)}</option>`).join('')}</select>`;
  },

  painters: {
    scale(d) {
      const tonic = T.parseNote(d.tonic);
      const notes = T.scaleNotes(tonic, d.scale).concat([{ ...tonic, oct: tonic.oct + 1 }]);
      const s = T.SCALES[d.scale];
      const scales = d.choose ? Object.entries(T.SCALES).filter(([, v]) => d.choose === true || !d.family || v.family === d.family) : null;
      const midis = notes.map(mid);
      const marks = new Map(notes.map((n, i) => [mid(n), { label: nn(n), tone: i === 0 || i === notes.length - 1 ? 'root' : 'on' }]));
      const pcs = new Map(notes.slice(0, -1).map((n, i) => [T.pc(n), { label: nn(n), tone: i === 0 ? 'root' : 'on' }]));
      const lo = Math.min(...midis), from = lo - (lo % 12), to = Math.max(from + 23, Math.max(...midis) + (11 - (Math.max(...midis) % 12)));
      return `<div class="mtl-demo-bar">
          ${this.rootSelect(d.tonic)}
          ${scales ? `<select class="mtl-select" data-k="scale" aria-label="Scale">${scales.map(([k, v]) => `<option value="${k}"${k === d.scale ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : `<strong>${esc(s.name)}</strong>`}
          <button type="button" class="mtl-play" data-act="play-scale">${icon('play')}Play</button>
          <button type="button" class="mtl-play mtl-play-soft" data-act="play-scale-updown" aria-label="Play up and down">${icon('arrow-up')}${icon('arrow-down')}</button>
        </div>
        ${d.compare ? `<div class="mtl-chips">${[d.scale, ...d.compare.filter(c => c !== d.scale), ...(d._orig && !d.compare.includes(d._orig) && d._orig !== d.scale ? [d._orig] : [])].map(k => `<button type="button" class="mtl-chip${k === d.scale ? ' is-on' : ''}" data-set="scale" data-v="${k}">${esc(T.SCALES[k].name)}</button>`).join('')}</div>` : ''}
        <div class="mtl-scroll">${staffSvg(notes, { labels: notes.map((n, i) => i < notes.length - 1 ? String(i + 1) : '8') })}</div>
        <div class="mtl-scroll">${pianoSvg({ from, to, marks })}</div>
        ${d.fretboard ? `<div class="mtl-scroll">${fretboardSvg({ tuning: d.tuning || 'guitar', frets: 12, pcs })}</div>` : ''}
        <table class="mtl-table mtl-mini"><thead><tr><th>Degree</th>${notes.slice(0, -1).map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>
          <tr><td>Note</td>${notes.slice(0, -1).map(n => `<td>${nn(n)}</td>`).join('')}</tr>
          <tr><td>Interval</td>${s.steps.map(x => `<td>${x}</td>`).join('')}</tr></tbody></table>
        <p class="mtl-note"><strong>${esc(s.name)}.</strong> ${esc(s.mood)} ${esc(s.uses)}</p>`;
    },

    chord(d) {
      const root = T.parseNote(d.root);
      const base = T.chordNotes(root, d.quality);
      const inv = d.inv || 0;
      const voiced = base.map((n, i) => (i < inv ? { ...n, oct: n.oct + 1 } : n));
      const sorted = [...voiced].sort((a, b) => mid(a) - mid(b));
      const def = T.CHORDS[d.quality];
      const marks = new Map(sorted.map(n => [mid(n), { label: nn(n), tone: T.pc(n) === T.pc(root) ? 'root' : 'on' }]));
      const lo = Math.min(...sorted.map(mid)), from = lo - (lo % 12);
      const symbol = `${nn(root)}${d.quality}${inv ? '/' + nn(sorted[0]) : ''}`;
      return `<div class="mtl-demo-bar">${this.rootSelect(d.root)}<strong class="mtl-sym">${esc(symbol)}</strong>
          <button type="button" class="mtl-play" data-act="play-chord">${icon('play')}Play</button><button type="button" class="mtl-play mtl-play-soft" data-act="play-arp">Arpeggio</button></div>
        ${d.choose ? `<div class="mtl-chips">${d.choose.map(q => `<button type="button" class="mtl-chip${q === d.quality ? ' is-on' : ''}" data-set="quality" data-v="${esc(q)}">${esc(nn(root) + q)}</button>`).join('')}</div>` : ''}
        ${d.inversions ? `<div class="mtl-seg">${['Root position', '1st inversion', '2nd inversion', '3rd inversion'].slice(0, base.length).map((l, i) => `<button type="button" data-set="inv" data-v="${i}" aria-pressed="${i === inv}">${l}</button>`).join('')}</div>` : ''}
        <div class="mtl-scroll">${staffSvg([sorted])}</div>
        <div class="mtl-scroll">${pianoSvg({ from, to: from + 23 + (Math.max(...sorted.map(mid)) - from > 23 ? 12 : 0), marks })}</div>
        <p class="mtl-note"><strong>${esc(def.name)}</strong>: ${def.steps.map(s => `${T.intervalLongName(s)}`).join(', ')} above the root → ${base.map(n => nn(n)).join(' – ')}.</p>`;
    },

    staff(d) {
      const notes = d.notes.map(n => T.parseNote(n));
      return `<figure class="mtl-fig"><div class="mtl-scroll">${staffSvg(notes, { clef: d.clef, labels: d.labels || [] })}</div>
        <figcaption><button type="button" class="mtl-play mtl-play-soft" data-act="play-seq" data-midis="${notes.map(mid).join(',')}">${icon('play')}Play</button> ${esc(d.caption || '')}</figcaption></figure>`;
    },

    piano(d) {
      const marks = new Map();
      if (d.label === 'names') for (let m = d.from; m <= d.to; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) marks.set(m, { label: T.LETTERS[[0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][m % 12]], tone: m === 60 ? 'root' : 'soft' });
      return `<div class="mtl-scroll">${pianoSvg({ from: d.from, to: d.to, marks })}</div><p class="mtl-note">Tap any key to hear it.${d.label === 'names' ? ' Middle C is highlighted.' : ''}</p>`;
    },

    fretboard(d) {
      const pcs = new Map([0, 2, 4, 5, 7, 9, 11].map(p => [p, { label: T.LETTERS[[0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][p]], tone: p === 0 ? 'root' : 'soft' }]));
      return `<div class="mtl-demo-bar"><select class="mtl-select" data-k="tuning" aria-label="Tuning">${Object.entries(FRET_TUNINGS).map(([k, v]) => `<option value="${k}"${k === d.tuning ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select><span class="mtl-note">Natural notes; C highlighted. Tap to hear.</span></div>
        <div class="mtl-scroll">${fretboardSvg({ tuning: d.tuning, frets: d.frets || 12, pcs })}</div>`;
    },

    intervals() {
      return `<div class="mtl-table-wrap"><table class="mtl-table"><thead><tr><th></th><th>Interval</th><th>Half steps</th><th>From C</th><th>Sounds like</th></tr></thead><tbody>
        ${T.INTERVALS.map(iv => { const top = T.transpose(T.parseNote('C4'), iv.id); return `<tr><td><button type="button" class="mtl-play mtl-play-sm" data-act="play-seq" data-midis="60,${mid(top)}" aria-label="Play ${esc(iv.name)}">${icon('play')}</button></td><td><strong>${esc(iv.name)}</strong><br><small>${esc(iv.sound)}</small></td><td>${iv.semis}</td><td>C–${nn(top)}</td><td>${esc(iv.song)}</td></tr>`; }).join('')}
      </tbody></table></div>`;
    },

    harmonics(d) {
      const hs = T.harmonicSeries(d.fundamental, 16);
      return `<div class="mtl-demo-bar"><button type="button" class="mtl-play" data-act="play-harmonics" data-f="${d.fundamental}">${icon('play')}Play the series</button></div>
        <div class="mtl-table-wrap"><table class="mtl-table mtl-mini"><thead><tr><th>Harmonic</th><th>Hz</th><th>Nearest note</th><th>Cents off</th></tr></thead><tbody>${hs.map(h => `<tr><td>${h.harmonic}</td><td>${h.hz}</td><td>${h.note}</td><td>${h.centsOff > 0 ? '+' : ''}${h.centsOff}</td></tr>`).join('')}</tbody></table></div>`;
    },

    just() {
      return `<div class="mtl-table-wrap"><table class="mtl-table mtl-mini"><thead><tr><th>Interval</th><th>Just ratio</th><th>Cents (just)</th><th>vs equal temperament</th></tr></thead><tbody>${T.JUST_MAJOR.map(j => `<tr><td>${T.intervalLongName(j.id)}</td><td>${j.ratio}</td><td>${j.cents}</td><td>${j.vsEqual > 0 ? '+' : ''}${j.vsEqual}</td></tr>`).join('')}</tbody></table></div>`;
    },

    circle(d) {
      const sel = d.sel ?? 0;
      const k = T.circleOfFifths()[sel];
      const tonicName = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'][sel];
      const chords = T.diatonicChords(T.parseNote(`${tonicName}4`), 'major');
      const sig = T.keySignature(tonicName);
      return `<div class="mtl-circle-wrap"><div class="mtl-circle">${circleSvg({ selected: sel })}</div>
        <div class="mtl-circle-info"><h4>${esc(k.major)} major / ${esc(k.minor.replace('m', ''))} minor</h4>
          <p>${esc(sig.text)}</p>
          <div class="mtl-scroll">${staffSvg([], { keySig: sig.fifths, width: 120 })}</div>
          <p class="mtl-note">Chords in ${esc(k.major)} major (tap to hear):</p>
          <div class="mtl-chips">${chords.map(c => `<button type="button" class="mtl-chip" data-act="play-midis" data-midis="${c.notes.map(mid).join(',')}"><b>${c.numeral}</b> ${esc(c.symbol.replace(/b/g, '♭').replace(/#/g, '♯'))}</button>`).join('')}</div>
          <button type="button" class="mtl-play" data-act="play-prog" data-prog="I IV V I" data-tonic="${tonicName}4">${icon('play')}I – IV – V – I</button>
          <p class="mtl-note">Neighbours on the circle (${esc(T.circleOfFifths()[(sel + 11) % 12].major)} and ${esc(T.circleOfFifths()[(sel + 1) % 12].major)}) are the closest keys.</p>
        </div></div>`;
    },

    keysig(d) {
      const tonic = d.key || 'D', mode = d.mode || 'major';
      const sig = T.keySignature(tonic, mode);
      const ok = Boolean(sig);
      return `<div class="mtl-demo-bar">${this.rootSelect(tonic, 'key')}<div class="mtl-seg">${['major', 'minor'].map(m => `<button type="button" data-set="mode" data-v="${m}" aria-pressed="${m === mode}">${m}</button>`).join('')}</div></div>
        ${ok ? `<div class="mtl-scroll">${staffSvg([], { keySig: sig.fifths, width: 140 })}${staffSvg([], { clef: 'bass', keySig: sig.fifths, width: 140 })}</div><p class="mtl-note"><strong>${pretty(tonic)} ${mode}</strong>: ${esc(sig.text)}.${mode === 'minor' ? ` Relative major: ${nn(T.transpose(T.parseNote(tonic + '4'), 'm3'))}.` : ` Relative minor: ${nn(T.transpose(T.parseNote(tonic + '4'), 'M6'))}.`}</p>` : `<p class="mtl-note">${pretty(tonic)} ${mode} is not used as a key (it would need double sharps or flats); use its enharmonic equivalent.</p>`}`;
    },

    diatonic(d) {
      const tonic = T.parseNote(d.tonic);
      const scales = ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor', 'dorian', 'mixolydian'];
      const chords = T.diatonicChords(tonic, d.scale, { sevenths: d.sevenths });
      return `<div class="mtl-demo-bar">${this.rootSelect(d.tonic, 'tonic')}<select class="mtl-select" data-k="scale">${scales.map(k => `<option value="${k}"${k === d.scale ? ' selected' : ''}>${esc(T.SCALES[k].name)}</option>`).join('')}</select>
          <div class="mtl-seg"><button type="button" data-set="sevenths" data-v="" aria-pressed="${!d.sevenths}">Triads</button><button type="button" data-set="sevenths" data-v="1" aria-pressed="${Boolean(d.sevenths)}">Sevenths</button></div></div>
        <div class="mtl-scroll">${staffSvg(chords.map(c => c.notes), { labels: chords.map(c => c.numeral) })}</div>
        <div class="mtl-table-wrap"><table class="mtl-table mtl-mini"><thead><tr><th></th><th>Numeral</th><th>Chord</th><th>Notes</th><th>Function</th></tr></thead><tbody>${chords.map(c => `<tr><td><button type="button" class="mtl-play mtl-play-sm" data-act="play-midis" data-midis="${c.notes.map(mid).join(',')}">${icon('play')}</button></td><td><b>${c.numeral}</b></td><td>${esc(pretty(c.symbol.replace(/♯/g, '#').replace(/♭/g, 'b')))}</td><td>${c.notes.map(n => nn(n)).join(' ')}</td><td>${esc(c.function)}</td></tr>`).join('')}</tbody></table></div>`;
    },

    progression(d) {
      const tonic = T.parseNote(d.tonic);
      const prog = T.progression(tonic, d.numerals);
      const cmp = d.compare ? T.progression(tonic, d.compare) : null;
      const row = (p, which) => `<div class="mtl-prog" data-prog-row="${which}">${p.map((c, i) => `<button type="button" class="mtl-pchord" data-act="play-midis" data-midis="${c.error ? '' : this.voiceLead(p, i).join(',')}" data-i="${i}"><b>${esc(c.numeral)}</b><span>${c.error ? '?' : esc(pretty(c.symbol.replace(/♯/g, '#').replace(/♭/g, 'b')))}</span></button>`).join('')}</div>`;
      return `<div class="mtl-demo-bar">${this.rootSelect(d.tonic, 'tonic')}<button type="button" class="mtl-play" data-act="play-progression" data-which="a">${icon('play')}Play</button>${cmp ? `<button type="button" class="mtl-play mtl-play-soft" data-act="play-progression" data-which="b">${icon('play')}Play the alternative</button>` : ''}
          <label class="mtl-tempo">Tempo <input type="range" min="50" max="160" value="${d.tempo || 84}" data-k="tempo"></label></div>
        ${d.choose ? `<div class="mtl-chips">${d.choose.map(p => `<button type="button" class="mtl-chip${p === d.numerals ? ' is-on' : ''}" data-set="numerals" data-v="${esc(p)}">${esc(p.length > 22 ? '12-bar blues' : p.replace(/b/g, '♭'))}</button>`).join('')}</div>` : ''}
        ${d.free ? `<label class="mtl-free">Your own: <input class="mtl-input" data-k="numerals-free" value="${esc(d.numerals)}" placeholder="e.g. I vi ii V" aria-label="Your own progression in Roman numerals"></label>` : ''}
        ${row(prog, 'a')}${cmp ? `<p class="mtl-note">Alternative:</p>${row(cmp, 'b')}` : ''}`;
    },

    chordname(d) {
      const sel = d.sel || [60, 64, 67];
      const names = T.identifyChord(sel);
      const marks = new Map(sel.map(m => [m, { label: '', tone: 'on' }]));
      return `<p class="mtl-note">Tap keys to add or remove notes.</p>
        <div class="mtl-scroll">${pianoSvg({ from: 48, to: 83, marks })}</div>
        <div class="mtl-demo-bar"><button type="button" class="mtl-play" data-act="play-midis" data-midis="${sel.join(',')}">${icon('play')}Play</button><button type="button" class="mtl-play mtl-play-soft" data-act="clear-notes">Clear</button></div>
        <div class="mtl-answer">${sel.length < 2 ? 'Choose at least two notes.' : names.length ? `<strong>${esc(pretty(names[0].symbol.replace(/♯/g, '#').replace(/♭/g, 'b')))}</strong> — ${esc(names[0].name)}${names.length > 1 ? `<br><small>Also: ${names.slice(1, 4).map(n => esc(n.symbol)).join(', ')}</small>` : ''}` : 'No standard chord name for this set of notes.'}</div>`;
    },

    eartrainer(d) {
      const pool = d.pool || ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
      const q = d.q || null;
      return `<div class="mtl-demo-bar"><button type="button" class="mtl-play" data-act="ear-new">${q ? `${icon('play')}Hear it again` : `${icon('play')}New interval`}</button>${q ? '<button type="button" class="mtl-play mtl-play-soft" data-act="ear-next">Next</button>' : ''}<span class="mtl-score">Score ${d.right || 0} / ${d.total || 0}</span>
          <div class="mtl-seg"><button type="button" data-set="dir" data-v="up" aria-pressed="${(d.dir || 'up') === 'up'}">Up</button><button type="button" data-set="dir" data-v="down" aria-pressed="${d.dir === 'down'}">Down</button><button type="button" data-set="dir" data-v="together" aria-pressed="${d.dir === 'together'}">Together</button></div></div>
        <div class="mtl-ear">${pool.map(id => `<button type="button" class="mtl-ear-btn${d.answered && id === q?.id ? ' is-right' : d.answered === id && id !== q?.id ? ' is-wrong' : ''}" data-act="ear-answer" data-v="${id}"${!q || d.answered ? ' disabled' : ''}>${esc(T.intervalLongName(id))}</button>`).join('')}</div>
        <p class="mtl-note">${q && d.answered ? (d.answered === q.id ? `${icon('check-circle')} Correct!` : `${icon('x-circle')} It was a ${esc(T.intervalLongName(q.id))}.`) + ` Reference: ${esc(T.INTERVALS.find(i => i.id === q.id)?.song || '')}` : 'Listen, then choose the interval.'}</p>`;
    },

    metronome(d) {
      return `<div class="mtl-demo-bar"><button type="button" class="mtl-play" data-act="metro">${d.on ? `${icon('stop')}Stop` : `${icon('play')}Start`}</button>
          <label class="mtl-tempo"><span data-bpm>${d.tempo}</span> BPM <input type="range" min="30" max="240" value="${d.tempo}" data-k="tempo"></label>
          <select class="mtl-select" data-k="beats">${[2, 3, 4, 5, 6, 7].map(b => `<option value="${b}"${b === d.beats ? ' selected' : ''}>${b} beats</option>`).join('')}</select></div>
        <div class="mtl-beats">${Array.from({ length: d.beats }, (_, i) => `<span data-beat="${i}"${i === 0 ? ' class="is-accent"' : ''}></span>`).join('')}</div>
        <p class="mtl-note">${esc(T.describeMeter(`${d.beats}/4`)?.text || '')}</p>`;
    },

    meter(d) {
      const cur = d.cur || d.meters[0];
      const m = T.describeMeter(cur);
      return `<div class="mtl-chips">${d.meters.map(x => `<button type="button" class="mtl-chip${x === cur ? ' is-on' : ''}" data-set="cur" data-v="${x}">${x}</button>`).join('')}</div>
        <p class="mtl-note"><strong>${cur}</strong> — ${esc(m.text)}</p>
        <button type="button" class="mtl-play" data-act="play-meter" data-meter="${cur}">${icon('play')}Hear two bars</button>`;
    },

    polyrhythm(d) {
      const a = d.a, b = d.b;
      const lane = (n, cls) => `<div class="mtl-lane ${cls}">${Array.from({ length: n }, (_, i) => `<span style="left:${(i / n) * 100}%"></span>`).join('')}</div>`;
      return `${d.choose ? `<div class="mtl-chips">${[[3, 2], [4, 3], [5, 4], [3, 4], [5, 3], [7, 4]].map(([x, y]) => `<button type="button" class="mtl-chip${x === a && y === b ? ' is-on' : ''}" data-set="ab" data-v="${x}:${y}">${x} : ${y}</button>`).join('')}</div>` : ''}
        <div class="mtl-poly">${lane(a, 'mtl-lane-a')}${lane(b, 'mtl-lane-b')}</div>
        <button type="button" class="mtl-play" data-act="play-poly">${icon('play')}Play ${a} against ${b}</button>
        <p class="mtl-note">High clicks: ${a} even beats. Low clicks: ${b} even beats, in the same time span.</p>`;
    },

    bell(d) {
      const name = d.name || Object.keys(BELLS)[0];
      const p = d.pattern ? { pattern: d.pattern, pulses: d.pulses } : BELLS[name];
      return `${d.choose ? `<div class="mtl-chips">${Object.keys(BELLS).map(k => `<button type="button" class="mtl-chip${k === name ? ' is-on' : ''}" data-set="name" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}
        <div class="mtl-bell" style="--n:${p.pulses}">${[...p.pattern].map((c, i) => `<span class="${c === 'x' ? 'is-hit' : ''}">${i + 1}</span>`).join('')}</div>
        <button type="button" class="mtl-play" data-act="play-bell" data-pattern="${p.pattern}">${icon('play')}Play with a steady beat</button>`;
    },

    groove() {
      const grid = { 'Hi-hat': [0, 1, 2, 3, 4, 5, 6, 7], Snare: [2, 6], Kick: [0, 4, 5] };
      return `<div class="mtl-grid8">${Object.entries(grid).map(([k, hits]) => `<div class="mtl-grid8-row"><span>${k}</span>${Array.from({ length: 8 }, (_, i) => `<i class="${hits.includes(i) ? 'is-hit' : ''}"></i>`).join('')}</div>`).join('')}</div>
        <button type="button" class="mtl-play" data-act="play-groove">${icon('play')}Play a basic rock beat</button>
        <p class="mtl-note">Eight eighth notes per bar: hi-hat on every eighth, snare on beats 2 and 4, kick on 1, 3 and the “and” of 3.</p>`;
    },

    transpose(d) {
      const inst = d.inst || 'B♭ trumpet', written = d.written || 'C5';
      const concert = T.writtenToConcert(written, inst);
      return `<div class="mtl-demo-bar"><select class="mtl-select" data-k="inst">${Object.keys(T.TRANSPOSING).map(k => `<option${k === inst ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>
          <label>Written note <select class="mtl-select" data-k="written">${['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'].map(n => `<option${n === written ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="mtl-scroll mtl-pair"><div>${staffSvg([T.parseNote(written)], { labels: ['Written'] })}</div><div>${staffSvg([concert], { labels: ['Sounds'] })}</div></div>
        <p class="mtl-note">A written <strong>${written.replace(/\d/, '')}</strong> on ${esc(inst)} sounds <strong>${nn(concert, true)}</strong>. ${esc(T.TRANSPOSING[inst].note)}</p>`;
    },
  },

  /** A smooth voicing of chord i in a progression: the root in the bass, upper notes near middle C. */
  voiceLead(prog, i) {
    const c = prog[i];
    const bass = 36 + ((T.pc(c.root) + 12 - 0) % 12);
    const bassNote = bass < 40 ? bass + 12 : bass;
    const upper = c.notes.map(n => { let m = 48 + T.pc(n); while (m < 55) m += 12; while (m > 67) m -= 12; return m; });
    return [bassNote, ...upper.sort((a, b) => a - b)];
  },

  /* ---------------- events ---------------- */

  onClick(e) {
    const t = e.target;
    const key = t.closest('.mk-key, .fb-note');
    if (key && !t.closest('[data-demo]')?.dataset.demo?.startsWith('x')) {
      const demoEl = key.closest('[data-demo]');
      const d = demoEl && this.demos.get(demoEl.dataset.demo);
      const m = Number(key.dataset.midi);
      if (d?.type === 'chordname') {
        const sel = new Set(d.sel || [60, 64, 67]);
        sel.has(m) ? sel.delete(m) : sel.add(m);
        d.sel = [...sel].sort((a, b) => a - b);
        A.playChord([m], { dur: 0.8 });
        this.paintDemo(demoEl);
        return;
      }
      A.playChord([m], { dur: 1.1 });
      key.classList.add('is-pressed'); setTimeout(() => key.classList.remove('is-pressed'), 220);
      this.motion.flash(key, 360);
      return;
    }
    const tab = t.closest('[data-tab]'); if (tab) { this.setTab(tab.dataset.tab); this.clearSearch(); return; }
    const tabGo = t.closest('[data-tab-go]'); if (tabGo) { this.setTab(tabGo.dataset.tabGo); return; }
    const lvl = t.closest('[data-level]'); if (lvl && lvl.tagName === 'BUTTON') { this.setLevel(lvl.dataset.level); return; }
    if (t.closest('[data-back]')) { this.back(); return; }
    const go = t.closest('[data-go]'); if (go) { e.preventDefault(); const r = resolveId(go.dataset.go); if (r) this.go({ kind: r.kind, id: go.dataset.go }); return; }
    const sec = t.closest('[data-section]'); if (sec) { this.go({ kind: 'section', id: sec.dataset.section }); return; }
    const inst = t.closest('[data-inst]'); if (inst) { this.go({ kind: 'instrument', id: inst.dataset.inst }); return; }
    const lab = t.closest('[data-lab]'); if (lab) { this.go({ kind: 'lab', id: lab.dataset.lab }); return; }
    const az = t.closest('[data-az]'); if (az) { e.preventDefault(); this.main.querySelector(`[data-letter="${az.dataset.az}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const circle = t.closest('[data-circle]');
    if (circle) { const el = circle.closest('[data-demo]'); const d = this.demos.get(el.dataset.demo); d.sel = Number(circle.dataset.circle); this.paintDemo(el); return; }
    const set = t.closest('[data-set]');
    if (set) {
      const el = set.closest('[data-demo]'); const d = this.demos.get(el.dataset.demo);
      const k = set.dataset.set, v = set.dataset.v;
      if (k === 'ab') { const [a, b] = v.split(':').map(Number); d.a = a; d.b = b; }
      else if (k === 'inv') d.inv = Number(v);
      else if (k === 'sevenths') d.sevenths = Boolean(v);
      else if (k === 'scale') { d._orig ??= d.scale; d.scale = v; }
      else if (k === 'quality') { d.quality = v; d.inv = 0; }
      else if (k === 'dir') d.dir = v;
      else d[k] = v;
      this.paintDemo(el);
      return;
    }
    const act = t.closest('[data-act]');
    if (act) this.act(act);
  },

  onChange(e) {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const demoEl = el.closest('[data-demo]');
    const d = demoEl && this.demos.get(demoEl.dataset.demo);
    if (!d) return;
    const k = el.dataset.k, v = el.value;
    if (k === 'root') { if (d.type === 'scale') d.tonic = `${v}4`; else d.root = `${v}${d.type === 'chord' ? 4 : 4}`; }
    else if (k === 'tonic') d.tonic = `${v}${d.type === 'progression' ? 4 : 4}`;
    else if (k === 'key') d.key = v;
    else if (k === 'tempo') { d.tempo = Number(v); if (d.type === 'metronome' && d.on) { this.metroStop?.(); this.startMetro(demoEl, d); } }
    else if (k === 'beats') { d.beats = Number(v); if (d.on) { this.metroStop?.(); d.on = false; } }
    else if (k === 'numerals-free') d.numerals = v;
    else d[k] = v;
    if (k !== 'tempo' || d.type !== 'metronome') this.paintDemo(demoEl);
    else demoEl.querySelector('[data-bpm]').textContent = v;
  },

  setLevel(level) {
    this.state.level = level;
    try { localStorage.setItem(PREF_KEY, level); } catch { /* ok */ }
    this.container.querySelector('.mtl-root').dataset.level = level;
    this.container.querySelectorAll('.mtl-level [data-level]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
    movePill(this.container.querySelector('.mtl-level'));
    this.main.querySelectorAll('details.mtl-deep').forEach(det => { det.open = level === 'expert'; const sm = det.querySelector('summary small'); if (sm) sm.textContent = level === 'expert' ? 'For advanced study' : 'Tap to go deeper'; });
  },

  clearSearch() { const q = this.container.querySelector('#mtl-q'); if (q) q.value = ''; },

  startMetro(el, d) {
    const dots = () => el.querySelectorAll('[data-beat]');
    this.metroStop = A.metronome({ tempo: d.tempo, beats: d.beats, onBeat: (b) => dots().forEach((s, i) => s.classList.toggle('is-now', i === b)) });
    this.stopFns.add(this.metroStop);
  },

  /* Playback lights what is sounding: keys and fret positions by pitch, staff notes by column. */
  lightNotes(el, midis) { midis.forEach(m => el?.querySelectorAll(`[data-midi="${m}"]`).forEach(k => this.motion.flash(k, 340))); },
  lightCol(el, i) { el?.querySelectorAll(`.ms-col[data-col="${i}"]`).forEach(c => this.motion.flash(c, 340)); },

  act(btn) {
    const el = btn.closest('[data-demo]');
    const d = el && this.demos.get(el.dataset.demo);
    const a = btn.dataset.act;
    const midis = (s) => String(s || '').split(',').filter(Boolean).map(Number);
    if (a.startsWith('play') || a === 'metro' || a.startsWith('ear')) this.motion.flash(btn, 420);
    if (a === 'play-midis') {
      const ms = midis(btn.dataset.midis);
      A.playChord(ms);
      this.lightNotes(el, ms);
      const row = btn.closest('tbody tr');
      if (row) { this.motion.flash(row, 600); this.lightCol(el, [...row.parentElement.children].indexOf(row)); }
      return;
    }
    if (a === 'play-seq') {
      const ms = midis(btn.dataset.midis);
      const row = btn.closest('tr');
      if (row) this.motion.flash(row, ms.length * 560);
      A.playSequence(ms, { tempo: 110, onNote: (i) => { this.lightNotes(el || btn.closest('.mtl-fig'), [ms[i]]); this.lightCol(btn.closest('.mtl-fig') || el, i); } });
      return;
    }
    if (!d) return;
    if (a === 'play-scale' || a === 'play-scale-updown') {
      const tonic = T.parseNote(d.tonic);
      const ms = T.scaleNotes(tonic, d.scale).concat([{ ...tonic, oct: tonic.oct + 1 }]).map(mid);
      const seq = a === 'play-scale' ? ms : ms.concat(ms.slice(0, -1).reverse());
      A.playSequence(seq, { tempo: 150, onNote: (i) => { this.lightNotes(el, [seq[i]]); this.lightCol(el, i < ms.length ? i : 2 * ms.length - 2 - i); } });
    } else if (a === 'play-chord' || a === 'play-arp') {
      const root = T.parseNote(d.root);
      const ms = T.chordNotes(root, d.quality).map((n, i) => mid(i < (d.inv || 0) ? { ...n, oct: n.oct + 1 } : n)).sort((x, y) => x - y);
      if (a === 'play-chord') { A.playChord(ms); this.lightNotes(el, ms); this.lightCol(el, 0); }
      else {
        A.playArpeggioChord(ms, { onNote: (i) => this.lightNotes(el, [ms[i]]) });
        setTimeout(() => { this.lightNotes(el, ms); this.lightCol(el, 0); }, ms.length * (60 / 220) * 1000);
      }
    } else if (a === 'play-harmonics') {
      const f = mid(T.parseNote(btn.dataset.f));
      const rows = el.querySelectorAll('tbody tr');
      A.playSequence(T.harmonicSeries(btn.dataset.f, 12).map(h => Math.round(f + 12 * Math.log2(h.harmonic))), { tempo: 140, onNote: (i) => this.motion.flash(rows[i], 420) });
    } else if (a === 'play-prog') {
      const p = T.progression(T.parseNote(btn.dataset.tonic), btn.dataset.prog);
      const chips = el.querySelectorAll('.mtl-circle-info .mtl-chip');
      const at = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5 };
      const order = btn.dataset.prog.split(/\s+/).map(n => at[n] ?? -1);
      A.playProgression(p.map((_, i) => this.voiceLead(p, i)), { tempo: 90, onChord: (i) => { if (i >= 0) this.motion.flash(chips[order[i]], 600); } });
    } else if (a === 'play-progression') {
      const p = T.progression(T.parseNote(d.tonic), btn.dataset.which === 'b' ? d.compare : d.numerals).filter(c => !c.error);
      const row = el.querySelector(`[data-prog-row="${btn.dataset.which}"]`);
      A.playProgression(p.map((_, i) => this.voiceLead(p, i)), { tempo: d.tempo || 84, beatsEach: d.beats || 2, onChord: (i) => row?.querySelectorAll('.mtl-pchord').forEach((c, j) => c.classList.toggle('is-now', j === i)) });
    } else if (a === 'clear-notes') { d.sel = []; this.paintDemo(el); }
    else if (a === 'ear-new' || a === 'ear-next') {
      if (!d.q || a === 'ear-next' || d.answered) {
        const pool = d.pool || ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
        const id = pool[Math.floor(Math.random() * pool.length)];
        const base = 55 + Math.floor(Math.random() * 10);
        d.q = { id, base, top: base + T.parseInterval(id).semitones };
        d.answered = null;
        this.paintDemo(el);
      }
      const { base, top } = d.q;
      d.dir === 'together' ? A.playChord([base, top]) : A.playSequence(d.dir === 'down' ? [top, base] : [base, top], { tempo: 100 });
    } else if (a === 'ear-answer') {
      if (!d.q || d.answered) return;
      d.answered = btn.dataset.v; d.total = (d.total || 0) + 1; if (d.answered === d.q.id) d.right = (d.right || 0) + 1;
      this.paintDemo(el);
    } else if (a === 'metro') {
      if (d.on) { this.metroStop?.(); d.on = false; this.paintDemo(el); }
      else { d.on = true; this.paintDemo(el); this.startMetro(el, d); }
    } else if (a === 'play-meter') {
      const m = T.describeMeter(btn.dataset.meter);
      const [top] = btn.dataset.meter.split('/').map(Number);
      const groups = !m.simple ? Array.from({ length: m.beats }, (_, i) => i * 3) : m.kind.startsWith('irregular') ? ({ 5: [0, 3], 7: [0, 2, 4], 9: [0, 2, 4, 6], 11: [0, 2, 4, 7, 9] }[top] || [0]) : Array.from({ length: top }, (_, i) => i);
      A.playRhythm([{ pulses: top, accents: new Set([0]) }, { pulses: top, hits: groups.filter(g => g > 0), pitch: 1480 }], { tempo: 60 * top / (m.simple && !m.kind.startsWith('irregular') ? 4 : 2) * (m.simple && !m.kind.startsWith('irregular') ? 1.6 : 1.1), beatsPerBar: top * (m.simple && !m.kind.startsWith('irregular') ? 1 : 0.5), bars: 2, onHit: (li) => { if (li === 0) this.motion.flash(el.querySelector('.mtl-chip.is-on'), 160); } });
    } else if (a === 'play-poly') {
      const lanes = el.querySelectorAll('.mtl-lane');
      A.playRhythm([{ pulses: d.a, pitch: 1760 }, { pulses: d.b, pitch: 880 }], { tempo: 60, beatsPerBar: 2, bars: 3, onHit: (li, i) => this.motion.flash(lanes[li]?.children[i], 220) });
    } else if (a === 'play-bell') {
      const p = btn.dataset.pattern;
      const hits = [...p].map((c, i) => (c === 'x' ? i : -1)).filter(i => i >= 0);
      const beats = p.length === 12 ? 4 : p.length === 8 ? 2 : 4;
      const cells = el.querySelectorAll('.mtl-bell span');
      A.playRhythm([{ pulses: p.length, hits, pitch: 2100, accents: new Set(hits) }, { pulses: beats, pitch: 520 }], { tempo: 100, beatsPerBar: beats, bars: 3, onHit: (li, i) => { if (li === 0) this.motion.flash(cells[i], 200); } });
    } else if (a === 'play-groove') {
      const rows = el.querySelectorAll('.mtl-grid8-row');
      A.playRhythm([{ pulses: 8, pitch: 3200 }, { pulses: 8, hits: [2, 6], pitch: 900, accents: new Set([2, 6]) }, { pulses: 8, hits: [0, 4, 5], pitch: 180, accents: new Set([0, 4, 5]) }], { tempo: 100, beatsPerBar: 4, bars: 4, onHit: (li, i) => this.motion.flash(rows[li]?.querySelectorAll('i')[i], 180) });
    }
  },

  destroy() {
    A.stopAll();
    this.motion?.reset();
    this._unlight?.();
    this._pillRO?.disconnect();
    if (this.container && this._onToggle) this.container.removeEventListener('toggle', this._onToggle, true);
    this.stopFns?.forEach(f => f()); this.stopFns?.clear();
    clearTimeout(this._qt);
    if (this.container && this._onClick) {
      this.container.removeEventListener('click', this._onClick);
      this.container.removeEventListener('change', this._onChange);
      this.container.removeEventListener('input', this._onInput);
      this.container.removeEventListener('keydown', this._onKey);
    }
    this.container = null;
  },
};
