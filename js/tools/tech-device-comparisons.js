/* ============================================================
   TOOLBOX — Tech Device Comparisons

   Opens on one search bar, the same as the home page's. It searches
   every category at once — type a device to open its profile, or
   "A vs B" to compare two straight away. A profile shows the score,
   where the device ranks, its benchmarks and full spec sheet, and
   real rivals to compare it with. A comparison shows two verdicts
   ("Better tech" judges specs alone, "Better buy" weighs them against
   the launch price), the score breakdown, the reasons each one wins,
   benchmarks and both spec sheets with the better value marked.
   Rankings list a whole category; the online spec-sheet lookup
   (Icecat) covers products outside the built-in database.

   1,500+ devices across phones, tablets, laptops, TVs, monitors,
   chips, graphics cards, watches, audio, consoles, power, office,
   music gear and electric cars live in lib/devices/data.
   Settings: Preferences → Tools.

   Every block arrives with motion (lib/reveal-motion.js): headlines
   rise word by word, rings and bars fill, numbers count up, rows
   cascade, and the search bar glides to the top when you pick.
   ============================================================ */

import {
  CATEGORIES, CATEGORY_ORDER, CATEGORY_GROUPS, loadCategory, reasons, formatValue, winner, searchDevices,
  suggestions, popular, verdicts, fmtDate,
} from '../lib/devices/db.js';
import { searchAllDevices, matchCategories, splitVsQuery, quickDeviceLookup } from '../lib/devices/quick-search.js';
import IcecatPanel from '../lib/devices/icecat-panel.js';
import { RevealMotion, flip, pointerLight } from '../lib/reveal-motion.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { getSetting } from '../lib/settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { copyText, showToast } from '../utils.js';

const STORE = 'toolbox_devices_v2';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BENCH_KEYS = ['gb6s', 'gb6m', 'antutu', 'cb24s', 'cb24m', 'timespy', 'steelnomad', 'wildlife'];
const RANK_PAGE = 40;
/* Categories sampled for the search bar's "Popular" list before anything is typed. */
const IDLE_CATS = ['phones', 'laptops', 'gpus', 'audio', 'tvs', 'watches'];
const IDLE_PAIRS = ['phones', 'laptops', 'cpus'];

/* Motion: [selector, kind]; kinds live in css/motion.css (.rv-u[data-rv]). */
const MOTION = {
  titles: '.dv-hero-name, .dv-ov-head h2',
  units: [
    ['.dv-hero-name, .dv-ov-head h2', 'title'],
    ['.dv-hero-solo, .dv-ov-head', 'card'],
    ['.dv-hero-card[data-side="a"]', 'left'],
    ['.dv-hero-card[data-side="b"]', 'right'],
    ['.dv-vs', 'pop'],
    ['.dv-verdict', 'flip'],
    ['.dv-sec-head h3, .dv-why-card h3, .dv-related h3, .dv-rivals h3, .dv-ov-col h3', 'rule'],
    ['.dv-bf, .dv-sbar, .dv-bench-item, .dv-stand-row, .dv-rank-row', 'row'],
    ['.dv-table tr', 'rowl'],
    ['.dv-why-card li, .dv-ov-item', 'li'],
    ['.dv-rival', 'card'],
    ['.dv-related-item, .dv-keyspec, .dv-inside a, .dv-badge, .dv-ring, .dv-rank-tools > *, .dv-legend, .dv-sec-tools, .dv-why-buy, .dv-sec-head > .btn', 'pop'],
    ['.dv-note, .dv-rank-count, .dv-verdict-sum, .dv-hero-sub, .dv-brand, .dv-ov-head p', 'fade'],
    ['.dv-card, .dv-sheets, .dv-qs', 'panel'],
    ['p', 'up'],
  ],
  atomic: '.dv-bf, .dv-sbar, .dv-bench-item, .dv-stand-row, .dv-rank-row, tr, .dv-why-card li, .dv-ov-item, .dv-rival, .dv-related-item, .dv-keyspec, .dv-verdict-head, .dv-picker, .dv-legend, .dv-sec-tools, .dv-rank-tools > *',
  fill: '.dv-bf-bar i, .dv-bench-bar i, .dv-ring, .dv-sbar-bar i, .dv-stand-bar i',
  skip: '.dv-pop, .dv-qs-dd',
};
const VIEW_ORDER = ['compare', 'rank', 'sheets'];
/* lower-case a label but keep acronyms such as TVs */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLAT_CATS = CATEGORY_GROUPS.flatMap(g => g.cats);
const lc = (t) => String(t).split(' ').map(w => (/^[A-Z]{2,}/.test(w) ? w : w.toLowerCase())).join(' ');

/* Category glyphs, drawn at 48×48. */
const GLYPH = {
  phones: '<rect x="15" y="5" width="18" height="38" rx="4"/><path d="M21 9h6"/><circle cx="24" cy="38" r="1.2"/>',
  tablets: '<rect x="9" y="6" width="30" height="36" rx="4"/><circle cx="24" cy="38" r="1.2"/>',
  laptops: '<rect x="10" y="11" width="28" height="19" rx="2.5"/><path d="M5 35h38l-3 4H8z"/>',
  tvs: '<rect x="5" y="9" width="38" height="24" rx="2.5"/><path d="M17 40h14M24 33v7"/>',
  monitors: '<rect x="6" y="7" width="36" height="24" rx="2.5"/><path d="M24 31v6M16 41h16"/><path d="M6 26h36"/>',
  socs: '<rect x="13" y="13" width="22" height="22" rx="3"/><rect x="19" y="19" width="10" height="10" rx="1.5"/><path d="M18 8v5M24 8v5M30 8v5M18 35v5M24 35v5M30 35v5M8 18h5M8 24h5M8 30h5M35 18h5M35 24h5M35 30h5"/>',
  cpus: '<rect x="11" y="11" width="26" height="26" rx="3"/><rect x="17" y="17" width="14" height="14" rx="2"/><path d="M16 6v5M22 6v5M28 6v5M34 6v5M16 37v5M22 37v5M28 37v5M34 37v5M6 16h5M6 22h5M6 28h5M6 34h5M37 16h5M37 22h5M37 28h5M37 34h5"/>',
  gpus: '<rect x="5" y="14" width="38" height="18" rx="3"/><circle cx="17" cy="23" r="5"/><circle cx="31" cy="23" r="5"/><path d="M9 32v4M14 32v3M19 32v3M24 32v3"/>',
  watches: '<rect x="13" y="13" width="22" height="22" rx="6"/><path d="M17 13l2-7h10l2 7M17 35l2 7h10l2-7M24 19v5l3 3"/>',
  audio: '<path d="M10 28v-4a14 14 0 0 1 28 0v4"/><rect x="8" y="27" width="7" height="12" rx="3"/><rect x="33" y="27" width="7" height="12" rx="3"/>',
  speakers: '<rect x="13" y="6" width="22" height="36" rx="6"/><circle cx="24" cy="29" r="7"/><circle cx="24" cy="29" r="2"/><circle cx="24" cy="14" r="2.5"/>',
  chargers: '<rect x="12" y="14" width="24" height="22" rx="4"/><path d="M19 8v6M29 8v6M20 36v4a4 4 0 0 0 8 0v-4"/><path d="M25 19l-4 6h6l-4 6"/>',
  powerbanks: '<rect x="9" y="12" width="30" height="24" rx="4"/><path d="M39 20h3v8h-3"/><path d="M15 18h8v12h-8z"/><path d="M27 18h6"/>',
  printers: '<path d="M14 18V7h20v11"/><rect x="6" y="18" width="36" height="16" rx="3"/><path d="M14 30h20v11H14z"/><circle cx="35" cy="23" r="1.3"/>',
  copiers: '<rect x="7" y="16" width="34" height="26" rx="3"/><path d="M11 16l3-8h20l3 8"/><path d="M13 24h22M13 30h22M13 36h14"/>',
  coffee: '<path d="M10 18h24v12a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"/><path d="M34 21h3a4 4 0 0 1 0 8h-3"/><path d="M17 6c-2 3 2 5 0 8M24 6c-2 3 2 5 0 8"/>',
  inverters: '<rect x="10" y="6" width="28" height="36" rx="3"/><path d="M16 16c2-4 4-4 6 0s4 4 6 0 4-4 4 0"/><path d="M16 28h16M16 34h10"/>',
  ups: '<rect x="12" y="5" width="24" height="38" rx="3"/><path d="M25 12l-5 8h7l-5 8"/><path d="M18 35h12"/>',
  guitars: '<path d="M30 6l6 6-9 9"/><path d="M27 21c3 3 3 8-1 10 1 4-2 9-7 9-6 0-11-5-11-11 0-5 5-8 9-7 2-4 7-4 10-1z"/><circle cx="18" cy="31" r="2.5"/><path d="M34 4l4 4"/>',
  keyboards: '<rect x="4" y="14" width="40" height="22" rx="3"/><path d="M11 14v22M18 14v22M25 14v22M32 14v22M39 14v22"/><path d="M9 14v12M16 14v12M23 14v12M30 14v12M37 14v12" stroke-width="3"/>',
  evs: '<path d="M8 32v-8l5-9h22l5 9v8"/><path d="M5 24h38v8H5z"/><circle cx="14" cy="33" r="4"/><circle cx="34" cy="33" r="4"/><path d="M25 17l-3 5h4l-3 5"/>',
  consoles: '<path d="M14 16h20a9 9 0 0 1 8.7 11.3l-1.4 5.4a4.5 4.5 0 0 1-7.7 1.9L30 31H18l-3.6 3.6a4.5 4.5 0 0 1-7.7-1.9l-1.4-5.4A9 9 0 0 1 14 16z"/><path d="M15 21v6M12 24h6"/><circle cx="31" cy="22" r="1.3"/><circle cx="34" cy="26" r="1.3"/>',
};
/* Small glyphs get a heavier stroke so they read at 16–22px like the interface icons. */
const glyph = (cat, size = 48) => `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${size <= 22 ? 3 : size <= 32 ? 2.4 : 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[cat]}</svg>`;
const ic = {
  swap: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  chevronR: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevronL: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  vs: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/></svg>',
  list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="14" y2="7"/><circle cx="16" cy="7" r="2"/><line x1="10" y1="17" x2="20" y2="17"/><circle cx="8" cy="17" r="2"/></svg>',
};

export default {
  async render(container, { analytics } = {}) {
    this.container = container;
    this.prefs = getToolSettings('tech-device-comparisons');
    const saved = this.load();
    // A device or comparison handed over by the Assistant or the home search
    // (quick-search.js#openQuickResult) opens straight away; otherwise the
    // tool opens on its search bar alone.
    const handoff = saved.handoff && CATEGORIES[saved.handoff.cat] && Array.isArray(saved.handoff.pair) ? saved.handoff : null;
    if (handoff) this.clearHandoff(saved);
    this.state = {
      mode: handoff ? 'work' : 'home',
      cat: handoff ? handoff.cat : saved.cat && CATEGORIES[saved.cat] ? saved.cat : this.prefs.defaultCategory,
      view: 'compare',
      pairs: {},
      diffOnly: this.prefs.differencesOnly,
      rank: { q: '', brand: '', year: '', sort: 'score', shown: RANK_PAGE },
    };
    this.counts = saved.counts || {};
    this.renderShell();
    this.motion = new RevealMotion(this.el.body, MOTION);
    this.unlight = pointerLight(this.el.root, '.dv-hero-card, .dv-card, .dv-rival, .dv-ov-item', '.dv-rival');
    if (handoff) {
      const data = await loadCategory(handoff.cat);
      if (!this.container) return;
      this.data = data;
      this.state.pairs[handoff.cat] = handoff.pair.map(id => (data.byId.has(id) ? id : null)).filter(Boolean).slice(0, 2);
      this.renderView(0);
    } else {
      this.enterHome();
    }
    this.off = onToolSettings('tech-device-comparisons', (p) => {
      const diffChanged = p.differencesOnly !== this.prefs.differencesOnly;
      this.prefs = p;
      if (diffChanged) this.state.diffOnly = p.differencesOnly;
      this.renderView();
    });
    analytics?.started?.();
    // warm every category (search spans them all) and the counts, without blocking
    Promise.all(CATEGORY_ORDER.map(c => loadCategory(c).then(d => { this.counts[c] = d.devices.length; })))
      .then(() => { this.renderCats(); this.save(); this.setGlobalPlaceholder(); }).catch(() => {});
  },

  destroy() {
    this.off?.();
    this.ro?.disconnect();
    this.sheets?.destroy?.();
    this.motion?.reset();
    this.unlight?.();
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.container = null;
  },

  load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } },
  save() {
    try { localStorage.setItem(STORE, JSON.stringify({ cat: this.state.cat, counts: this.counts })); } catch { /* private mode */ }
  },
  clearHandoff(saved) {
    try { const { handoff, ...rest } = saved; localStorage.setItem(STORE, JSON.stringify(rest)); } catch { /* private mode */ }
  },
  units() { return this.prefs.units === 'auto' ? (getSetting('unitSystem') === 'imperial' ? 'imperial' : 'metric') : this.prefs.units; },
  fmtScore(v) {
    if (v == null) return '';
    return this.prefs.scoreScale === '10' ? (v / 10).toFixed(1) : String(v);
  },
  /** A score that counts up when it arrives. */
  scoreHtml(v) {
    if (v == null) return '';
    return this.prefs.scoreScale === '10'
      ? `<span data-count="${(v / 10).toFixed(1)}" data-dec="1">${(v / 10).toFixed(1)}</span>`
      : `<span data-count="${v}">${v}</span>`;
  },
  price(d) { return this.prefs.showPrices && d.price ? `$${Number(d.price).toLocaleString('en-US')}` : ''; },

  /* ---------------- shell ---------------- */
  renderShell() {
    this.container.innerHTML = `
      <div class="dv${this.state.mode === 'home' ? ' is-home' : ''}">
        <div class="dv-top">
          ${this.qsHtml('global', 'Search phones, laptops, chips, TVs… or compare two with “vs”', 'Search every device, or type two names with vs between them to compare')}
          <div class="dv-bar" data-pane="groups">
            <button type="button" class="dv-cc" aria-expanded="false" aria-controls="dv-nav" aria-label="Comparison category">
              <span class="dv-cc-icon" aria-hidden="true"></span>
              <span class="dv-cc-text"><small>Category</small><span class="dv-cc-cur"></span></span>
              <span class="dv-cc-chev" aria-hidden="true">${ic.chevronR}</span>
            </button>
            <div class="dv-stage">
              <div class="dv-tools">
                <div class="dv-views" role="tablist" aria-label="View">
                  <span class="dv-views-ind" aria-hidden="true"></span>
                  <button type="button" role="tab" data-view="compare">Overview</button>
                  <button type="button" role="tab" data-view="rank">Rankings</button>
                  <button type="button" role="tab" data-view="sheets">Spec sheet lookup</button>
                </div>
                <button type="button" class="btn btn-ghost btn-sm dv-prefs" data-act="prefs">${ic.sliders}<span>Comparison preferences</span></button>
              </div>
              <div class="dv-nav" id="dv-nav" role="group" aria-label="Choose a comparison category">
                <div class="dv-pane dv-pane-groups" role="list"></div>
                <div class="dv-pane dv-pane-cats" role="list"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="dv-body"></div>
      </div>`;
    const q = (sel) => this.container.querySelector(sel);
    this.el = {
      root: q('.dv'), top: q('.dv-top'), qs: q('.dv-qs[data-qs="global"]'),
      bar: q('.dv-bar'), cc: q('.dv-cc'), ccIcon: q('.dv-cc-icon'), ccCur: q('.dv-cc-cur'),
      groupsPane: q('.dv-pane-groups'), catsPane: q('.dv-pane-cats'),
      body: q('.dv-body'), views: q('.dv-views'), ind: q('.dv-views-ind'),
    };
    this.navGroup = null;
    this.container.addEventListener('click', (e) => this.onClick(e));
    this.container.addEventListener('input', (e) => this.onInput(e));
    this.container.addEventListener('change', (e) => this.onChange(e));
    this.container.addEventListener('keydown', (e) => this.onKeydown(e));
    this.container.addEventListener('focusin', (e) => {
      const wrap = e.target.closest?.('[data-qs-input]') && e.target.closest('.dv-qs');
      if (wrap && !this.quietFocus) this.fillDropdown(wrap);
    });
    this.container.addEventListener('focusout', (e) => {
      const wrap = e.target.closest?.('.dv-qs');
      if (wrap && !wrap.contains(e.relatedTarget)) this.closeDropdown(wrap);
    });
    this.onOutside = (e) => {
      if (!e.target.closest?.('.dv-picker')) this.closePickers();
      if (this.navOpen() && !e.target.closest?.('.dv-bar')) this.closeNav();
      this.container?.querySelectorAll('.dv-qs').forEach(w => { if (!w.contains(e.target)) this.closeDropdown(w); });
    };
    document.addEventListener('pointerdown', this.onOutside, true);
    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(() => this.placeViewIndicator(false));
      this.ro.observe(this.el.views);
    }
    this.renderCats();
    this.setGlobalPlaceholder();
  },

  /** A search bar drawn like the home page's. kind: 'global' (every device), 'rival' (compare with), 'cat' (this category). */
  qsHtml(kind, placeholder, label) {
    return `<div class="home-search-wrap dv-qs dv-qs-${kind}" data-qs="${kind}"${kind === 'global' ? ' data-flip="qs"' : ''}>
      <div class="home-search-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input type="text" class="home-search-input" data-qs-input placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" aria-label="${esc(label)}" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="dv-dd-${kind}">
        <button type="button" class="btn-icon btn-primary home-search-submit" data-qs-go aria-label="Open the top match" title="Open the top match (Enter)">${ic.arrow}</button>
      </div>
      <div class="home-hero-dropdown dv-qs-dd" id="dv-dd-${kind}" role="listbox" hidden></div>
      ${kind === 'global' ? '<p class="home-search-keys dv-qs-keys"><span><kbd>Enter</kbd> open the top match</span><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span>Type <kbd>vs</kbd> between two names to compare</span></p>' : ''}
    </div>`;
  },

  /** Names two real, popular devices in the hint once the database has loaded. */
  async setGlobalPlaceholder() {
    const input = this.el?.qs?.querySelector('[data-qs-input]');
    if (!input) return;
    try {
      const phones = await loadCategory('phones');
      const [a, b] = popular(phones, 2);
      const total = CATEGORY_ORDER.reduce((n, c) => n + (this.counts[c] || 0), 0);
      if (!a || !b || !this.container) return;
      const count = total ? `${total.toLocaleString('en-US')} devices` : 'every device';
      const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;
      input.placeholder = narrow ? `Search ${count}, or A vs B` : `Search ${count}, or compare: ${a.name} vs ${b.name}`;
    } catch { /* keep the generic hint */ }
  },

  /* ---------------- home: the search bar alone ---------------- */
  enterHome() {
    const root = this.el.root;
    root.classList.add('is-home');
    this.state.mode = 'home';
    this.el.body.innerHTML = '';
    // Focus the bar without opening its list, so the page shows only the bar.
    if (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      this.quietFocus = true;
      requestAnimationFrame(() => { this.el?.qs.querySelector('[data-qs-input]')?.focus({ preventScroll: true }); this.quietFocus = false; });
    }
  },

  /** The bar glides from the middle of the page to the top; the workspace arrives under it. */
  leaveHome(paint) {
    const root = this.el.root;
    const f = flip(root, { scale: false, duration: 700 });
    root.classList.remove('is-home');
    root.classList.add('is-arriving');
    this.state.mode = 'work';
    this.renderCats();
    paint();
    f.play();
    requestAnimationFrame(() => this.placeViewIndicator(false));
    setTimeout(() => root.classList.remove('is-arriving'), 1000);
  },

  groupOf(cat) { return CATEGORY_GROUPS.find(g => g.cats.includes(cat)) || CATEGORY_GROUPS[0]; },

  /** The first tab names what it shows: the category overview, one device, or a comparison. */
  mainLabel() {
    const pair = this.state.pairs[this.state.cat] || [];
    const n = pair.filter(Boolean).length;
    return n >= 2 ? 'Compare' : n === 1 ? 'Device' : 'Overview';
  },

  renderCats() {
    if (!this.el) return;
    const cat = this.state.cat, group = this.groupOf(cat), def = CATEGORIES[cat];
    const cur = this.el.ccCur;
    if (cur.dataset.cat !== cat) {
      const animate = !!cur.dataset.cat && !reducedMotion();
      cur.dataset.cat = cat;
      cur.innerHTML = `<b>${esc(def.label)}</b><span>${esc(group.label)}</span>`;
      this.el.ccIcon.innerHTML = glyph(cat, 22);
      if (animate) {
        for (const n of [cur, this.el.ccIcon]) { n.classList.remove('is-swapping'); void n.offsetWidth; n.classList.add('is-swapping'); }
      }
    }
    const main = this.el.views.querySelector('[data-view="compare"]');
    const label = this.mainLabel();
    if (main.textContent !== label) {
      main.textContent = label;
      if (!reducedMotion()) { main.classList.remove('is-relabel'); void main.offsetWidth; main.classList.add('is-relabel'); }
    }
    this.el.bar.classList.toggle('is-sheets', this.state.view === 'sheets');
    if (this.state.view === 'sheets' && this.navOpen()) this.closeNav();
    if (!this.navOpen()) this.renderPanes();
    this.el.views.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === this.state.view)));
    this.placeViewIndicator(true);
  },

  renderPanes() {
    const curGroup = this.groupOf(this.state.cat);
    const browse = CATEGORY_GROUPS.find(g => g.id === this.navGroup) || curGroup;
    const count = (g) => g.cats.reduce((n, c) => n + (this.counts[c] || 0), 0);
    this.el.groupsPane.innerHTML = CATEGORY_GROUPS.map((g, i) => `
      <button type="button" role="listitem" class="dv-chip dv-chip-group" data-group="${g.id}" style="--i:${i}" aria-current="${g === curGroup}">
        <span class="dv-chip-glyphs" aria-hidden="true">${g.cats.slice(0, 3).map(c => glyph(c, 16)).join('')}</span>
        <span>${esc(g.label)}</span>${count(g) ? `<small>${count(g)}</small>` : ''}
        <span class="dv-chip-go" aria-hidden="true">${ic.chevronR}</span>
      </button>`).join('');
    this.el.catsPane.innerHTML = `
      <button type="button" class="dv-chip dv-chip-back" data-nav-back style="--i:0" aria-label="Back to all comparison groups">${ic.chevronL}<span>${esc(browse.label)}</span></button>
      ${browse.cats.map((c, i) => `<button type="button" role="listitem" class="dv-chip dv-chip-cat" data-cat="${c}" style="--i:${i + 1}" aria-current="${c === this.state.cat}">
        <span class="dv-cat-icon">${glyph(c, 18)}</span><span>${esc(CATEGORIES[c].label)}</span>${this.counts[c] ? `<small>${this.counts[c]}</small>` : ''}</button>`).join('')}`;
  },

  navOpen() { return !!this.el?.bar.classList.contains('is-open'); },

  openNav() {
    if (!this.el || this.state.view === 'sheets') return;
    this.navGroup = null;
    this.el.bar.dataset.pane = 'groups';
    this.renderPanes();
    this.el.bar.classList.add('is-open');
    this.el.cc.setAttribute('aria-expanded', 'true');
    const cur = this.el.groupsPane.querySelector('[aria-current="true"]');
    requestAnimationFrame(() => {
      (cur || this.el.groupsPane.querySelector('.dv-chip'))?.focus({ preventScroll: true });
      if (cur) this.scrollChipIntoView(cur);
    });
  },

  closeNav({ focus = false } = {}) {
    if (!this.navOpen()) return;
    this.el.bar.classList.remove('is-open');
    this.el.cc.setAttribute('aria-expanded', 'false');
    if (focus) this.el.cc.focus({ preventScroll: true });
  },

  showPane(pane, groupId) {
    const bar = this.el.bar;
    if (groupId) { this.navGroup = groupId; this.renderPanes(); }
    // restart the stagger for the pane coming in
    const incoming = pane === 'cats' ? this.el.catsPane : this.el.groupsPane;
    incoming.classList.add('is-restaging');
    void incoming.offsetWidth;
    bar.dataset.pane = pane;
    incoming.classList.remove('is-restaging');
    incoming.scrollLeft = 0;
    const target = incoming.querySelector(pane === 'cats' ? '[data-cat][aria-current="true"], [data-cat]' : `[data-group="${this.navGroup || this.groupOf(this.state.cat).id}"]`);
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  },

  scrollChipIntoView(chip) {
    const pane = chip.parentElement;
    if (pane.scrollWidth <= pane.clientWidth) return;
    const left = chip.offsetLeft - pane.offsetLeft;
    if (left < pane.scrollLeft || left + chip.offsetWidth > pane.scrollLeft + pane.clientWidth) pane.scrollLeft = Math.max(0, left - 24);
  },

  /** Slides the pill behind Overview / Rankings / Spec sheet lookup to the selected tab. */
  placeViewIndicator(animate) {
    const sel = this.el?.views.querySelector('[aria-selected="true"]');
    const ind = this.el?.ind;
    if (!sel || !ind || !sel.offsetWidth) return;
    if (!animate || !ind.dataset.ready) ind.style.transition = 'none';
    ind.style.width = `${sel.offsetWidth}px`;
    ind.style.transform = `translateX(${sel.offsetLeft - 3}px)`;
    if (!ind.dataset.ready || !animate) { void ind.offsetWidth; ind.style.transition = ''; }
    ind.dataset.ready = '1';
  },

  /** Index of `from`/`to` in `list`: 1 moving forward, -1 back, 0 if either is missing or unchanged. */
  dirOf(list, from, to) {
    const i = list.indexOf(from), j = list.indexOf(to);
    if (i < 0 || j < 0 || i === j) return 0;
    return j > i ? 1 : -1;
  },

  /** Slides the current body content out, runs `fn` to replace it, then the new
      content arrives from the side you travelled toward, block by block.
      `dir`: 1 = a later tab or category, -1 = an earlier one, 0 = rises in place. */
  animateBody(dir, fn) {
    const body = this.el?.body;
    const paint = () => {
      this.motion.reset();
      fn();
      this.motion.enter(body, { mode: dir > 0 ? 'forward' : dir < 0 ? 'back' : 'up' });
    };
    if (!body || !dir || reducedMotion() || !body.firstChild) { paint(); return; }
    let settled = false;
    const enter = () => {
      if (settled) return;
      settled = true;
      body.classList.remove('dv-out-l', 'dv-out-r');
      paint();
    };
    body.classList.add(dir > 0 ? 'dv-out-l' : 'dv-out-r');
    body.addEventListener('animationend', enter, { once: true });
    setTimeout(enter, 200);
  },

  /** Opens a category / device / comparison / view — from the search bar, a rival, a ranking row… */
  async go({ cat = this.state.cat, pair, view = 'compare', sheetsQuery = '' } = {}) {
    this.closeAllDropdowns();
    const data = await loadCategory(cat);
    if (!this.container) return;
    const prevCat = this.state.cat, prevView = this.state.view;
    const catChanged = !this.data || this.data.cat !== cat;
    this.data = data;
    this.state.cat = cat;
    this.counts[cat] = data.devices.length;
    if (catChanged) this.state.rank = { q: '', brand: '', year: '', sort: 'score', shown: RANK_PAGE };
    if (pair) this.state.pairs[cat] = pair.filter(id => id && data.byId.has(id)).slice(0, 2);
    this.state.view = view;
    this.pendingSheetsQuery = sheetsQuery;
    this.save();
    if (this.state.mode === 'home') { this.leaveHome(() => this.renderView(0, { force: true })); return; }
    const dir = prevCat !== cat ? (this.dirOf(FLAT_CATS, prevCat, cat) || 1) : (this.dirOf(VIEW_ORDER, prevView, view) || 1);
    this.renderView(dir);
    const top = this.el.root.getBoundingClientRect().top;
    if (top < -40) this.el.root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  },

  async showCategory(cat, dir = 0) {
    this.state.cat = cat;
    this.state.rank = { q: '', brand: '', year: '', sort: 'score', shown: RANK_PAGE };
    this.renderCats();
    const data = await loadCategory(cat);
    if (!this.container || this.state.cat !== cat) return;
    this.data = data;
    this.counts[cat] = data.devices.length;
    this.save();
    this.renderView(dir);
  },

  renderView(dir = 0, { force = false } = {}) {
    if (!this.container || !this.data || (this.state.mode === 'home' && !force)) return;
    this.renderCats();
    if (this.state.view !== 'sheets' && this.sheets) { this.sheets.destroy?.(); this.sheets = null; }
    this.animateBody(dir, () => {
      if (this.state.view === 'compare') this.renderMain();
      else if (this.state.view === 'rank') this.renderRank();
      else this.renderSheets();
    });
  },

  /** Redraws the first tab in place (a pick, a swap, closing a comparison): new blocks arrive quickly. */
  repaintMain({ flipFrom = null } = {}) {
    this.motion.reset();
    this.renderCats();
    this.renderMain();
    const body = this.el.body;
    if (flipFrom) {
      body.querySelectorAll('[data-flip]').forEach(el => { el.classList.add('rv-arrived'); this.motion.fillIn(el); });
      flipFrom.play();
    }
    this.motion.enter(body, { mode: 'quick' });
  },

  /* ---------------- the first tab: overview · device · compare ---------------- */
  pair() {
    const [a, b] = this.state.pairs[this.state.cat] || [];
    return [this.data.byId.get(a), this.data.byId.get(b)];
  },

  renderMain() {
    const [A, B] = this.pair();
    if (A && B) this.renderCompare(A, B);
    else if (A || B) this.renderProfile(A || B);
    else this.renderOverview();
  },

  ranked() {
    if (this.data._rankedList) return this.data._rankedList;
    this.data._rankedList = this.data.devices.filter(d => d._score != null).sort((a, b) => b._score - a._score);
    return this.data._rankedList;
  },
  byValue() {
    if (this.data._valueList) return this.data._valueList;
    this.data._valueList = this.data.devices.filter(d => d._value != null && d.price > 0).sort((a, b) => b._value - a._value);
    return this.data._valueList;
  },

  ringHtml(d, win = false) {
    if (d._score == null) return '';
    const total = this.ranked().length;
    return `<div class="dv-ring${win ? ' win' : ''}">${ring(d._score)}<span class="dv-ring-val">${this.scoreHtml(d._score)}</span><span class="dv-ring-cap">#${d._rank} of ${total}</span></div>`;
  },

  /** Links to the parts inside a device that have their own pages here (a phone's chip, a laptop's processor and graphics). */
  insideHtml(d) {
    const links = [];
    const add = (cat, id) => {
      if (!id || !CATEGORIES[cat]) return;
      links.push(`<a href="#" data-open="${cat}|${esc(id)}" data-inside-name="${esc(id)}">${glyph(cat, 16)}<span>${esc(CATEGORIES[cat].singular[0].toUpperCase() + CATEGORIES[cat].singular.slice(1))}</span><b></b></a>`);
    };
    add(d._chipCat, d._chip);
    add('cpus', d._cpu);
    add('gpus', d._gpu);
    return links.length ? `<div class="dv-inside">${links.join('')}</div>` : '';
  },
  /** Fills in the names of the linked parts (their categories load on demand). */
  async nameInside(scope) {
    for (const a of scope.querySelectorAll('[data-inside-name]')) {
      const [cat, id] = a.dataset.open.split('|');
      const data = await loadCategory(cat).catch(() => null);
      const d = data?.byId.get(id);
      if (d) a.querySelector('b').textContent = d.name; else a.remove();
    }
  },

  /** No device chosen in this category yet: the category at a glance, all real devices. */
  renderOverview() {
    const cat = this.state.cat, def = CATEGORIES[cat], data = this.data;
    const n = data.devices.length;
    const years = data.years;
    const best = this.ranked().slice(0, 5);
    const value = this.prefs.showPrices ? this.byValue().slice(0, 5) : [];
    const newest = data.devices.slice().sort((a, b) => (b.released || '').localeCompare(a.released || '') || (b._score || 0) - (a._score || 0)).slice(0, 5);
    const item = (d, i, metric) => `<button type="button" class="dv-ov-item" data-open-id="${esc(d.id)}">
        <span class="dv-ov-pos">${i + 1}</span>
        <span class="dv-ov-text"><strong>${esc(d.name)}</strong><small>${esc([d.brand, fmtDate(d.released), metric].filter(Boolean).join(' · '))}</small></span>
        ${d._score != null ? `<span class="dv-ov-score" style="--s:${d._score}">${this.fmtScore(d._score)}</span>` : ''}
      </button>`;
    const col = (title, sub, list, metric = () => '') => list.length ? `<section class="dv-card dv-ov-col"><h3>${esc(title)}</h3><p class="dv-muted">${esc(sub)}</p>${list.map((d, i) => item(d, i, metric(d))).join('')}</section>` : '';
    const pop = popular(data, 6);
    const pairs = [];
    for (let i = 0; i + 1 < pop.length; i += 2) pairs.push([pop[i], pop[i + 1]]);
    this.el.body.innerHTML = `
      <section class="dv-ov">
        <header class="dv-ov-head">
          <span class="dv-ov-glyph">${glyph(cat, 56)}</span>
          <div><h2>${esc(def.label)}</h2><p>${n.toLocaleString('en-US')} ${esc(lc(def.label))} · ${data.brands.length} brands${years.length ? ` · ${esc(years[years.length - 1])}–${esc(years[0])}` : ''}</p></div>
        </header>
        ${this.qsHtml('cat', `Search ${n.toLocaleString('en-US')} ${lc(def.label)}`, `Search ${lc(def.label)}`)}
        <div class="dv-ov-grid">
          ${col('Best tech', 'Highest score from the specs', best)}
          ${col('Best buy', 'Most score for the launch price', value, d => this.price(d))}
          ${col('Newest', 'Latest releases', newest)}
        </div>
        ${pairs.length ? `<section class="dv-related"><h3>Popular ${esc(lc(def.label))} comparisons</h3><div class="dv-related-list">${pairs.map(([a, b]) => `<button type="button" class="dv-related-item" data-pair="${esc(a.id)}|${esc(b.id)}"><span>${esc(a.name)}</span><em>vs</em><span>${esc(b.name)}</span></button>`).join('')}</div></section>` : ''}
        ${def.note ? `<p class="dv-note dv-cat-note">${esc(def.note)}</p>` : ''}
      </section>`;
  },

  /** One device: its score, standing, benchmarks, specs and the rivals worth comparing it with. */
  renderProfile(A) {
    const cat = this.state.cat, def = CATEGORIES[cat], units = this.units();
    const ranked = this.ranked(), byValue = this.byValue();
    const vRank = this.prefs.showPrices ? byValue.indexOf(A) + 1 : 0;
    const specs = this.keySpecs(A);
    const rivals = suggestions(this.data, A.id, 6);
    const diff = (d) => {
      if (d._score == null || A._score == null) return '';
      const x = d._score - A._score;
      const pts = this.prefs.scoreScale === '10' ? (Math.abs(x) / 10).toFixed(1) : Math.abs(x);
      return x === 0 ? '<span class="dv-rival-diff">Same score</span>'
        : `<span class="dv-rival-diff ${x > 0 ? 'up' : 'down'}">${x > 0 ? ic.up : ic.down}${pts} ${x > 0 ? 'higher' : 'lower'}</span>`;
    };
    const hero = `
      <div class="dv-hero-card dv-hero-solo" data-side="a" data-flip="dev-${esc(A.id)}">
        <div class="dv-hero-main">
          <span class="dv-hero-glyph">${glyph(cat, 56)}</span>
          <div class="dv-hero-meta">
            <span class="dv-brand">${esc(A.brand)}</span>
            <strong class="dv-hero-name">${esc(A.name)}</strong>
            <span class="dv-hero-sub">${esc([fmtDate(A.released), this.price(A), A.type || A.segment || ''].filter(Boolean).join(' · '))}</span>
            ${A._rank || vRank ? `<span class="dv-badges">${A._rank ? `<span class="dv-badge tech">${ic.bolt}#${A._rank} of ${ranked.length} for tech</span>` : ''}${vRank ? `<span class="dv-badge buy">${ic.tag}#${vRank} of ${byValue.length} for value</span>` : ''}</span>` : ''}
          </div>
        </div>
        ${this.ringHtml(A, true)}
        ${specs.length ? `<div class="dv-keyspecs">${specs.map(t => `<span class="dv-keyspec">${esc(t)}</span>`).join('')}</div>` : ''}
        ${this.insideHtml(A)}
      </div>`;
    const rivalsHtml = `
      <section class="dv-card dv-rivals">
        <h3>Compare with</h3>
        ${this.qsHtml('rival', `Search ${this.data.devices.length.toLocaleString('en-US')} ${lc(def.label)}`, `Find a ${def.singular} to compare with ${A.name}`)}
        ${rivals.length ? `<div class="dv-rival-list">${rivals.map(d => `
          <button type="button" class="dv-rival" data-rival="${esc(d.id)}">
            <span class="dv-rival-top"><span class="dv-rival-name">${esc(d.name)}</span>${d._score != null ? `<span class="dv-rival-score">${this.fmtScore(d._score)}</span>` : ''}</span>
            <span class="dv-rival-meta">${esc([d.brand, fmtDate(d.released), this.price(d)].filter(Boolean).join(' · '))}</span>
            ${diff(d)}
          </button>`).join('')}</div>` : ''}
      </section>`;

    const subs = this.data.scores.filter(s => A._scores[s.key] != null);
    const breakdown = subs.length ? `
      <section class="dv-card dv-breakdown">
        <header class="dv-sec-head"><h3>Score breakdown</h3><span class="dv-muted">Out of 100, against every ${esc(def.singular)} here</span></header>
        ${subs.map(s => `<div class="dv-sbar"><span class="dv-sbar-label">${esc(s.label)}</span><div class="dv-sbar-bar"><i style="--w:${A._scores[s.key]}%"></i></div><span class="dv-sbar-val">${this.scoreHtml(A._scores[s.key])}</span></div>`).join('')}
      </section>` : '';

    let standing = '';
    if (A._rank) {
      const i = A._rank - 1;
      const from = Math.max(0, Math.min(i - 2, ranked.length - 5));
      const near = ranked.slice(from, from + 5);
      standing = `
        <section class="dv-card dv-standing">
          <header class="dv-sec-head"><h3>Where it ranks</h3><button type="button" class="btn btn-ghost btn-sm" data-act="rank">All ${esc(lc(def.label))}${ic.chevronR}</button></header>
          ${near.map(d => `<button type="button" class="dv-stand-row${d === A ? ' is-self' : ''}" ${d === A ? 'aria-current="true" tabindex="-1"' : `data-open-id="${esc(d.id)}"`}>
            <span class="dv-stand-pos">${d._rank}</span>
            <span class="dv-stand-name">${esc(d.name)}<small>${esc([d.brand, fmtDate(d.released)].filter(Boolean).join(' · '))}</small></span>
            <span class="dv-stand-bar"><i style="--w:${d._score}%"></i></span>
            <span class="dv-stand-val">${this.fmtScore(d._score)}</span>
          </button>`).join('')}
        </section>`;
    }

    const benchFields = this.prefs.showBenchmarks ? def.fields.filter(f => BENCH_KEYS.includes(f.key) && A[f.key] != null) : [];
    const bench = benchFields.length ? `
      <section class="dv-card dv-bench">
        <header class="dv-sec-head"><h3>Benchmarks</h3><span class="dv-muted">Against the best ${esc(def.singular)} here</span></header>
        ${benchFields.map(f => {
          const top = this.data.devices.reduce((m, d) => (d[f.key] != null && (!m || d[f.key] > m[f.key]) ? d : m), null);
          const max = top?.[f.key] || A[f.key];
          const row = (d, cls, label) => `<div class="dv-bench-row ${cls}"><span class="dv-bench-name">${label}</span><div class="dv-bench-bar"><i style="--w:${Math.max(2, d[f.key] / max * 100)}%"></i></div><span class="dv-bench-val">${Number(d[f.key]).toLocaleString('en-US')}${d._derived?.[f.key] ? `<sup title="${esc(d._derived[f.key])}">*</sup>` : ''}</span></div>`;
          return `<div class="dv-bench-item"><div class="dv-bench-label">${esc(f.label)}</div>${row(A, 'a win', esc(A.name))}${top && top !== A ? row(top, 'b', `Best: ${esc(top.name)}`) : ''}</div>`;
        }).join('')}
      </section>` : '';

    const groups = [];
    for (const f of def.fields) {
      if (/Id$/.test(f.key) || A[f.key] == null) continue;
      if (!this.prefs.showPrices && f.key === 'price') continue;
      if (!this.prefs.showBenchmarks && BENCH_KEYS.includes(f.key)) continue;
      let g = groups.find(x => x.name === f.group);
      if (!g) groups.push(g = { name: f.group, rows: [] });
      g.rows.push(f);
    }
    const cell = (f, v) => f.type === 'bool'
      ? `<td><span class="dv-bool ${v ? 'yes' : 'no'}">${v ? ic.check : ic.cross}${v ? 'Yes' : 'No'}</span></td>`
      : `<td>${esc(formatValue(f, v, units))}${A._derived?.[f.key] ? `<sup title="${esc(A._derived[f.key])}">*</sup>` : ''}</td>`;
    const specsHtml = groups.length ? `
      <section class="dv-card dv-specs">
        <header class="dv-sec-head"><h3>Full specifications</h3><div class="dv-sec-tools"><button type="button" class="btn btn-ghost btn-sm" data-act="copy-md">Copy as table</button></div></header>
        <div class="dv-table-wrap">
          <table class="dv-table dv-table-one">
            <colgroup><col class="dv-col-label"><col></colgroup>
            ${groups.map(g => `<tbody><tr class="dv-group"><th colspan="2" scope="colgroup">${esc(g.name)}</th></tr>
              ${g.rows.map(f => `<tr><th scope="row">${esc(f.label)}</th>${cell(f, A[f.key])}</tr>`).join('')}</tbody>`).join('')}
          </table>
        </div>
      </section>` : '';

    this.el.body.innerHTML = `
      <section class="dv-profile">${hero}${rivalsHtml}</section>
      ${breakdown}
      ${standing}
      ${bench}
      ${specsHtml}
      ${def.note ? `<p class="dv-note dv-cat-note">${esc(def.note)}</p>` : ''}
      <p class="dv-note">Scores compare each device with the rest of its category from the listed specs and ignore price; they are not a review. Value weighs that score against the US launch price. Benchmark figures are typical published results and vary with software and cooling.${Object.keys(A._derived || {}).length ? ' <sup>*</sup> marks a value taken from the device’s chip or calculated from its other specs.' : ''}</p>`;
    this.nameInside(this.el.body);
  },

  renderCompare(A, B) {
    const cat = this.state.cat, def = CATEGORIES[cat];
    const units = this.units();
    const V = verdicts(cat, A, B);
    const aWins = V.tech.winner === 'a', bWins = V.tech.winner === 'b';
    const lim = this.prefs.reasons;
    const filter = (list) => list.filter(r => (this.prefs.showBenchmarks || !BENCH_KEYS.includes(r.key)));
    const whyA = filter(reasons(cat, A, B, units, lim + 4)).slice(0, lim), whyB = filter(reasons(cat, B, A, units, lim + 4)).slice(0, lim);

    const heroCard = (d, win, side) => `
      <div class="dv-hero-card${win ? ' win' : ''}" data-side="${side}" data-flip="dev-${esc(d.id)}">
        ${this.pickerHtml(d, side)}
        <div class="dv-hero-main">
          <span class="dv-hero-glyph">${glyph(cat, 56)}</span>
          <div class="dv-hero-meta">
            <span class="dv-brand">${esc(d.brand)}</span>
            <strong class="dv-hero-name">${esc(d.name)}</strong>
            <span class="dv-hero-sub">${esc([fmtDate(d.released), this.price(d), d.type || d.segment || ''].filter(Boolean).join(' · '))}</span>
            ${(V.tech.winner === side || V.buy.winner === side) ? `<span class="dv-badges">${V.tech.winner === side ? `<span class="dv-badge tech">${ic.bolt}Better tech</span>` : ''}${V.buy.winner === side ? `<span class="dv-badge buy">${ic.tag}Better buy</span>` : ''}</span>` : ''}
          </div>
        </div>
        ${this.ringHtml(d, win)}
      </div>`;

    const vCard = (kind, v, title, sub) => `
      <div class="dv-card dv-verdict ${kind}${v.winner === 'a' || v.winner === 'b' ? ' has-win' : ''}">
        <div class="dv-verdict-head"><span class="dv-verdict-icon">${kind === 'tech' ? ic.bolt : ic.tag}</span><span class="dv-verdict-kind">${title}</span><small>${sub}</small></div>
        <strong class="dv-verdict-name">${esc(v.headline)}</strong>
        <p>${esc(v.text)}</p>
        ${v.figures ? `<span class="dv-verdict-fig">${esc(this.prefs.scoreScale === '10' ? v.figures.replace(/\b(Score|Value) (\d+) vs (\d+)/, (m, k, x, y) => `${k} ${(x / 10).toFixed(1)} vs ${(y / 10).toFixed(1)}`) : v.figures)}</span>` : ''}
      </div>`;
    const verdictHtml = `
      <section class="dv-verdicts" aria-label="Verdict">
        ${vCard('tech', V.tech, 'Better tech', 'Specs only, price ignored')}
        ${this.prefs.showPrices ? vCard('buy', V.buy, 'Better buy', 'Score for the money, at launch price') : ''}
        ${V.summary && this.prefs.showPrices && !V.same ? `<p class="dv-verdict-sum">${esc(V.summary)}</p>` : ''}
      </section>`;

    const subs = this.data.scores.filter(s => A._scores[s.key] != null || B._scores[s.key] != null);
    const scoresHtml = subs.map(s => {
      const a = A._scores[s.key], b = B._scores[s.key];
      const w = a != null && b != null ? (a > b ? 'a' : b > a ? 'b' : '') : '';
      return `<div class="dv-bf">
        <span class="dv-bf-val a${w === 'a' ? ' win' : ''}">${a != null ? this.scoreHtml(a) : '—'}</span>
        <div class="dv-bf-bar a"><i style="--w:${a ?? 0}%"></i></div>
        <span class="dv-bf-label">${esc(s.label)}</span>
        <div class="dv-bf-bar b"><i style="--w:${b ?? 0}%"></i></div>
        <span class="dv-bf-val b${w === 'b' ? ' win' : ''}">${b != null ? this.scoreHtml(b) : '—'}</span>
      </div>`;
    }).join('');

    const priceNote = (d, other) => {
      if (!this.prefs.showPrices || !(d.price > 0) || !(other.price > 0) || d.price >= other.price) return '';
      return `<div class="dv-why-buy"><span class="dv-why-buy-icon">${ic.tag}</span><span><strong>$${Number(other.price - d.price).toLocaleString('en-US')} cheaper at launch</strong><small>$${Number(d.price).toLocaleString('en-US')} vs $${Number(other.price).toLocaleString('en-US')} · counts towards Better buy, not Better tech</small></span></div>`;
    };
    const whyCard = (d, other, list, side) => `
      <div class="dv-card dv-why-card" data-side="${side}">
        <h3>Where ${esc(d.name)} has better tech</h3>
        ${list.length ? `<ul>${list.map(r => `<li><span class="dv-check">${ic.check}</span><span><strong>${esc(r.title)}</strong>${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</span></li>`).join('')}</ul>` : `<p class="dv-muted">${esc(other.name)} matches or beats it on every listed spec.</p>`}
        ${priceNote(d, other)}
      </div>`;

    // benchmarks
    const benchFields = def.fields.filter(f => BENCH_KEYS.includes(f.key) && (A[f.key] != null || B[f.key] != null));
    const benchHtml = this.prefs.showBenchmarks && benchFields.length ? `
      <section class="dv-card dv-bench">
        <header class="dv-sec-head"><h3>Benchmarks</h3><span class="dv-muted">Typical published results</span></header>
        ${benchFields.map(f => {
          const max = Math.max(...this.data.devices.map(d => d[f.key] || 0));
          const a = A[f.key], b = B[f.key], w = winner(f, a, b);
          const row = (d, v, isWin, side) => `<div class="dv-bench-row ${side}${isWin ? ' win' : ''}"><span class="dv-bench-name">${esc(d.name)}</span><div class="dv-bench-bar"><i style="--w:${v ? Math.max(2, v / max * 100) : 0}%"></i></div><span class="dv-bench-val">${v != null ? Number(v).toLocaleString('en-US') : '—'}${d._derived?.[f.key] ? '<sup title="' + esc(d._derived[f.key]) + '">*</sup>' : ''}</span></div>`;
          return `<div class="dv-bench-item"><div class="dv-bench-label">${esc(f.label)}</div>${row(A, a, w === 1, 'a')}${row(B, b, w === -1, 'b')}</div>`;
        }).join('')}
      </section>` : '';

    const related = suggestions(this.data, A.id, 6).filter(d => d.id !== B.id).slice(0, 5);
    const relatedHtml = related.length ? `
      <section class="dv-related">
        <h3>Compare ${esc(A.name)} with</h3>
        <div class="dv-related-list">${related.map(d => `<button type="button" class="dv-related-item" data-pair="${esc(A.id)}|${esc(d.id)}"><span>${esc(A.name)}</span><em>vs</em><span>${esc(d.name)}</span></button>`).join('')}</div>
      </section>` : '';

    this.el.body.innerHTML = `
      <section class="dv-hero">
        ${heroCard(A, aWins, 'a')}
        <div class="dv-vs"><button type="button" class="dv-swap" data-act="swap" aria-label="Swap devices" title="Swap">${ic.swap}</button><span>VS</span><button type="button" class="dv-clear" data-act="clear" aria-label="Close the comparison and show ${esc(A.name)}" title="Close comparison">${ic.cross}</button></div>
        ${heroCard(B, bWins, 'b')}
      </section>
      ${verdictHtml}
      ${subs.length ? `<section class="dv-card dv-breakdown"><header class="dv-sec-head"><h3>Score breakdown</h3><div class="dv-legend"><span class="a">${esc(A.name)}</span><span class="b">${esc(B.name)}</span></div></header>${scoresHtml}</section>` : ''}
      <section class="dv-why">${whyCard(A, B, whyA, 'a')}${whyCard(B, A, whyB, 'b')}</section>
      ${benchHtml}
      ${this.specTableHtml(A, B)}
      ${relatedHtml}
      ${def.note ? `<p class="dv-note dv-cat-note">${esc(def.note)}</p>` : ''}
      <p class="dv-note">Scores compare each device with the rest of its category from the listed specs and ignore price; they are not a review. Better buy weighs that score against the US launch price (street prices fall over time, especially for older models). Benchmark figures are typical published results and vary with software and cooling. <sup>*</sup> marks a value taken from the device's chip. Launch prices are US list prices for the base model.</p>`;
  },

  /** Both spec sheets side by side, the better value marked; redrawn alone when "Only differences" flips. */
  specTableHtml(A, B) {
    const def = CATEGORIES[this.state.cat], units = this.units();
    const groups = [];
    for (const f of def.fields) {
      if (/Id$/.test(f.key)) continue;
      if (!this.prefs.showPrices && f.key === 'price') continue;
      if (!this.prefs.showBenchmarks && BENCH_KEYS.includes(f.key)) continue;
      const va = A[f.key], vb = B[f.key];
      if (va == null && vb == null) continue;
      const ta = formatValue(f, va, units), tb = formatValue(f, vb, units);
      const same = ta === tb;
      if (this.state.diffOnly && same) continue;
      let g = groups.find(x => x.name === f.group);
      if (!g) groups.push(g = { name: f.group, rows: [] });
      const w = this.prefs.highlightWinners ? winner(f, va, vb) : 0;
      g.rows.push({ f, ta, tb, w, va, vb });
    }
    const cell = (f, t, v, win, derived) => {
      if (v == null) return `<td class="dv-na">—</td>`;
      if (f.type === 'bool') return `<td class="${win ? 'win' : ''}"><span class="dv-bool ${v ? 'yes' : 'no'}">${v ? ic.check : ic.cross}${v ? 'Yes' : 'No'}</span></td>`;
      return `<td class="${win ? 'win' : ''}">${esc(t)}${derived ? `<sup title="${esc(derived)}">*</sup>` : ''}</td>`;
    };
    return `
      <section class="dv-card dv-specs">
        <header class="dv-sec-head">
          <h3>Full specifications</h3>
          <div class="dv-sec-tools">
            <label class="dv-switch"><input type="checkbox" class="switch" data-act="diff" ${this.state.diffOnly ? 'checked' : ''}><span>Only differences</span></label>
            <button type="button" class="btn btn-ghost btn-sm" data-act="copy-md">Copy as table</button>
          </div>
        </header>
        <div class="dv-table-wrap">
          <table class="dv-table">
            <colgroup><col class="dv-col-label"><col><col></colgroup>
            <thead><tr><th scope="col"><span class="visually-hidden">Specification</span></th><th scope="col">${esc(A.name)}</th><th scope="col">${esc(B.name)}</th></tr></thead>
            ${groups.map(g => `<tbody><tr class="dv-group"><th colspan="3" scope="colgroup">${esc(g.name)}</th></tr>
              ${g.rows.map(r => `<tr><th scope="row">${esc(r.f.label)}</th>${cell(r.f, r.ta, r.va, r.w === 1, A._derived?.[r.f.key])}${cell(r.f, r.tb, r.vb, r.w === -1, B._derived?.[r.f.key])}</tr>`).join('')}</tbody>`).join('')
              || '<tbody><tr><td colspan="3" class="dv-muted">These two match on every listed spec.</td></tr></tbody>'}
          </table>
        </div>
      </section>`;
  },

  pickerHtml(d, side) {
    const def = CATEGORIES[this.state.cat];
    return `<div class="dv-picker" data-slot="${side}">
      <button type="button" class="dv-picker-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Change ${esc(d.name)}">
        <span class="dv-picker-name">${esc(d.name)}</span>${ic.chevron}
      </button>
      <div class="dv-pop" hidden>
        <label class="dv-pop-search">${ic.search}<input type="search" placeholder="Search ${esc(lc(def.label))}" aria-label="Search ${esc(lc(def.label))}" autocomplete="off"></label>
        <ul class="dv-pop-list" role="listbox"></ul>
      </div>
    </div>`;
  },

  /* ---------------- search bars ---------------- */
  ddRow({ attrs, icon, name, desc, trail = '' }, i) {
    return `<div class="hero-dd-row dv-dd-row" role="option" tabindex="-1" aria-selected="false" ${attrs} style="--i:${i}">
      <span class="hero-dd-icon">${icon}</span>
      <span class="hero-dd-text"><span class="hero-dd-name">${name}</span><span class="hero-dd-desc">${desc}</span></span>
      ${trail}
    </div>`;
  },
  deviceRow(cat, d, i, attrs = `data-open="${cat}|${esc(d.id)}"`) {
    return this.ddRow({
      attrs, icon: glyph(cat, 18), name: esc(d.name),
      desc: esc([d.brand, CATEGORIES[cat].label, (d.released || '').slice(0, 4), this.price(d)].filter(Boolean).join(' · ')),
      trail: d._score != null ? `<span class="dv-dd-score">${this.fmtScore(d._score)}</span>` : '',
    }, i);
  },
  compareRow(cat, a, b, i) {
    return this.ddRow({
      attrs: `data-compare="${cat}|${esc(a.id)}|${esc(b.id)}"`, icon: ic.vs,
      name: `${esc(a.name)} <em class="dv-dd-vs">vs</em> ${esc(b.name)}`,
      desc: `${esc(CATEGORIES[cat].label)} · Better tech and better buy`,
    }, i);
  },
  rankRow(cat, i, label) {
    return this.ddRow({
      attrs: `data-rank-cat="${cat}"`, icon: ic.list, name: esc(label || `${CATEGORIES[cat].label} rankings`),
      desc: `${(this.counts[cat] || '').toLocaleString?.('en-US') || ''} ${esc(lc(CATEGORIES[cat].label))} ranked by score, value and more`.trim(),
    }, i);
  },
  sheetsRow(q, i) {
    return this.ddRow({
      attrs: `data-sheets="${esc(q)}"`, icon: ic.globe,
      name: q ? `Look up “${esc(q)}” online` : 'Look up any product’s spec sheet online',
      desc: 'Official spec sheets by model number or barcode',
    }, i);
  },

  async globalRows(q) {
    let i = 0, html = '';
    const label = (t) => `<div class="hero-dd-label">${esc(t)}</div>`;
    if (!q) {
      const cats = await Promise.all(IDLE_CATS.map(c => loadCategory(c)));
      const devs = cats.map(d => [d.cat, popular(d, 1)[0]]).filter(([, d]) => d);
      html += label('Popular right now') + devs.map(([c, d]) => this.deviceRow(c, d, i++)).join('');
      const pairs = (await Promise.all(IDLE_PAIRS.map(c => loadCategory(c)))).map(d => [d.cat, popular(d, 2)]).filter(([, p]) => p.length === 2);
      html += label('Popular comparisons') + pairs.map(([c, [a, b]]) => this.compareRow(c, a, b, i++)).join('');
      html += label('Browse') + this.rankRow(this.state.cat, i++, `All ${lc(CATEGORIES[this.state.cat].label)}, ranked`) + this.sheetsRow('', i++);
      return html;
    }
    const vs = splitVsQuery(q);
    const base = q.replace(/\s+(?:vs\.?|versus)\s*$/i, '').trim();
    const seen = new Set();
    if (vs) {
      const hit = await quickDeviceLookup(q);
      const rows = [];
      if (hit?.kind === 'compare') { rows.push(this.compareRow(hit.category, hit.a, hit.b, i++)); seen.add(`${hit.a.id}|${hit.b.id}`); }
      // the first name resolved: offer it against the best matches for the second
      const [aHit] = await searchAllDevices(vs[0], { limit: 1 });
      if (aHit) {
        searchDevices(aHit.data, vs[1], 5).filter(d => d.id !== aHit.device.id && !seen.has(`${aHit.device.id}|${d.id}`))
          .slice(0, 4).forEach(d => rows.push(this.compareRow(aHit.category, aHit.device, d, i++)));
      }
      if (rows.length) html += label('Compare') + rows.join('');
    }
    const hits = await searchAllDevices(vs ? vs[0] : base, { limit: vs ? 3 : 8 });
    if (hits.length) html += label(vs ? `Matches for “${vs[0]}”` : 'Devices') + hits.map(h => this.deviceRow(h.category, h.device, i++)).join('');
    const cats = vs ? [] : matchCategories(base).slice(0, 2);
    if (cats.length) {
      html += label('Rankings') + cats.map(c => this.rankRow(c.category, i++)).join('');
      // a category named outright ("graphics cards"): its leaders, ready to open
      if (!hits.length) {
        const top = await loadCategory(cats[0].category);
        html += label(`Top ${lc(CATEGORIES[top.cat].label)}`) + this.ranked.call({ data: top }).slice(0, 4).map(d => this.deviceRow(top.cat, d, i++)).join('');
      }
    }
    if (!html) html += `<div class="hero-dd-empty">No device here matches “${esc(q)}”.</div>`;
    html += label('Online') + this.sheetsRow(q, i++);
    return html;
  },

  rivalRows(q) {
    const [A] = this.pair();
    if (!A) return '';
    const list = q ? searchDevices(this.data, q, 9).filter(d => d.id !== A.id).slice(0, 8) : suggestions(this.data, A.id, 6);
    if (!list.length) return `<div class="hero-dd-empty">No ${esc(lc(CATEGORIES[this.state.cat].label))} match “${esc(q)}”.</div>`;
    return `<div class="hero-dd-label">${q ? 'Compare with' : 'Close matches'}</div>` + list.map((d, i) => this.deviceRow(this.state.cat, d, i, `data-rival="${esc(d.id)}"`)).join('');
  },

  catRows(q) {
    const cat = this.state.cat;
    const list = q ? searchDevices(this.data, q, 8) : popular(this.data, 6);
    if (!list.length) return `<div class="hero-dd-empty">No ${esc(lc(CATEGORIES[cat].label))} match “${esc(q)}”.</div>`;
    return `<div class="hero-dd-label">${q ? esc(CATEGORIES[cat].label) : 'Popular right now'}</div>` + list.map((d, i) => this.deviceRow(cat, d, i)).join('');
  },

  async fillDropdown(wrap) {
    const input = wrap.querySelector('[data-qs-input]'), dd = wrap.querySelector('.dv-qs-dd');
    const q = input.value.trim();
    const gen = (wrap._gen = (wrap._gen || 0) + 1);
    const kind = wrap.dataset.qs;
    let html = '';
    try {
      html = kind === 'global' ? await this.globalRows(q) : kind === 'rival' ? this.rivalRows(q) : this.catRows(q);
    } catch { html = ''; }
    if (gen !== wrap._gen || !this.container || document.activeElement !== input) return;
    dd.innerHTML = html;
    dd.hidden = !html;
    wrap.classList.toggle('is-open', !!html);
    input.setAttribute('aria-expanded', String(!!html));
    this.setActive(wrap, 0);
  },
  closeDropdown(wrap) {
    const dd = wrap?.querySelector('.dv-qs-dd');
    if (!dd || dd.hidden) return;
    wrap._gen = (wrap._gen || 0) + 1;
    dd.hidden = true;
    wrap.classList.remove('is-open');
    wrap.querySelector('[data-qs-input]')?.setAttribute('aria-expanded', 'false');
  },
  closeAllDropdowns() { this.container?.querySelectorAll('.dv-qs').forEach(w => this.closeDropdown(w)); },
  setActive(wrap, i) {
    const rows = [...wrap.querySelectorAll('.dv-dd-row')];
    if (!rows.length) return;
    const j = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, k) => { r.classList.toggle('is-active', k === j); r.setAttribute('aria-selected', String(k === j)); });
    rows[j].scrollIntoView?.({ block: 'nearest' });
  },
  async activate(row) {
    const wrap = row.closest('.dv-qs');
    const input = wrap?.querySelector('[data-qs-input]');
    if (input) { input.value = ''; input.blur(); }
    if (row.dataset.open) { const [cat, id] = row.dataset.open.split('|'); await this.go({ cat, pair: [id] }); return; }
    if (row.dataset.compare) { const [cat, a, b] = row.dataset.compare.split('|'); await this.go({ cat, pair: [a, b] }); return; }
    if (row.dataset.rival) { const [A] = this.pair(); this.comparePair(A.id, row.dataset.rival); return; }
    if (row.dataset.rankCat) { await this.go({ cat: row.dataset.rankCat, view: 'rank' }); return; }
    if (row.dataset.sheets != null) { await this.go({ view: 'sheets', sheetsQuery: row.dataset.sheets }); }
  },
  /** Enter / the arrow button: the highlighted row, or the best match for what was typed. */
  async submit(wrap) {
    let row = wrap.querySelector('.dv-dd-row.is-active') || wrap.querySelector('.dv-dd-row');
    if (!row) {
      await this.fillDropdown(wrap);
      row = wrap.querySelector('.dv-dd-row');
    }
    if (row) this.activate(row);
  },

  /** Compare two devices of the current category, in place when the first tab is showing. */
  comparePair(a, b) {
    const cat = this.state.cat;
    if (!a || !b || a === b) return;
    this.state.pairs[cat] = [a, b];
    this.closeAllDropdowns();
    if (this.state.view !== 'compare') { this.go({ pair: [a, b] }); return; }
    this.repaintMain({ flipFrom: flip(this.el.body) });
    const top = this.el.root.getBoundingClientRect().top;
    if (top < -40) this.el.root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  },

  /* ---------------- device picker (change one side of a comparison) ---------------- */
  openPicker(slotEl) {
    this.closePickers(slotEl);
    const pop = slotEl.querySelector('.dv-pop');
    const btn = slotEl.querySelector('.dv-picker-btn');
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    const input = pop.querySelector('input');
    input.value = '';
    this.fillPicker(slotEl, '');
    input.focus();
  },
  closePickers(except) {
    this.container?.querySelectorAll('.dv-picker').forEach(p => {
      if (p === except) return;
      const pop = p.querySelector('.dv-pop');
      if (pop && !pop.hidden) { pop.hidden = true; p.querySelector('.dv-picker-btn')?.setAttribute('aria-expanded', 'false'); }
    });
  },
  fillPicker(slotEl, q) {
    const list = slotEl.querySelector('.dv-pop-list');
    const current = this.state.pairs[this.state.cat] || [];
    const other = current[slotEl.dataset.slot === 'a' ? 1 : 0];
    const found = searchDevices(this.data, q, 40).filter(d => d.id !== other);
    list.innerHTML = found.length ? found.map((d, i) => `<li role="option" tabindex="-1" data-pick="${esc(d.id)}" class="${i === 0 ? 'active' : ''}" aria-selected="${i === 0}" style="--i:${Math.min(i, 14)}">
      <span class="dv-pop-name">${esc(d.name)}</span><span class="dv-pop-meta">${esc(d.brand)} · ${esc(fmtDate(d.released))}</span><span class="dv-pop-score">${this.fmtScore(d._score)}</span></li>`).join('')
      : `<li class="dv-pop-empty">No ${esc(lc(CATEGORIES[this.state.cat].label))} match “${esc(q)}”.</li>`;
  },
  pick(slot, id) {
    const pair = [...(this.state.pairs[this.state.cat] || [])];
    pair[slot === 'a' ? 0 : 1] = id;
    this.state.pairs[this.state.cat] = pair.filter(Boolean);
    this.closePickers();
    this.repaintMain();
  },

  /* ---------------- rankings ---------------- */
  rankList() {
    const r = this.state.rank, def = CATEGORIES[this.state.cat];
    let list = r.q ? searchDevices(this.data, r.q, 9999) : this.data.devices.slice();
    if (r.brand) list = list.filter(d => d.brand === r.brand);
    if (r.year) list = list.filter(d => (d.released || '').startsWith(r.year));
    const key = r.sort;
    const sub = this.data.scores.find(s => s.key === key);
    const field = def.fields.find(f => f.key === key);
    const val = (d) => key === 'score' ? d._score : key === 'value' ? d._value : key === 'newest' ? (d.released || '') : sub ? d._scores[key] : d[key];
    list = list.filter(d => val(d) != null || key === 'score');
    list.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null) return 1; if (y == null) return -1;
      if (key === 'newest') return String(y).localeCompare(String(x));
      if (field?.better === 'low') return x - y;
      return y - x;
    });
    return list;
  },
  keySpecs(d) {
    const pick = {
      phones: ['chip', 'displaySize', 'battery', 'camMain'], tablets: ['chip', 'displaySize', 'ram', 'weight'],
      laptops: ['cpu', 'gpu', 'displaySize', 'weight'], socs: ['node', 'cores', 'maxClock', 'gpu'], cpus: ['cores', 'threads', 'boostClock', 'tdp'],
      gpus: ['vram', 'shaders', 'boostClock', 'tdp'], watches: ['displaySize', 'batteryDays', 'gps', 'water'], audio: ['type', 'anc', 'battery', 'codecs'],
      consoles: ['type', 'tflops', 'ram', 'storage'],
      speakers: ['type', 'outputW', 'battery', 'water'], chargers: ['type', 'maxW', 'ports', 'data'], powerbanks: ['type', 'capacity', 'wh', 'maxOut'],
      printers: ['type', 'ppmBlack', 'cppBlack', 'duplex'], copiers: ['type', 'ppmBlack', 'paperMax', 'scanIpm'], coffee: ['type', 'grinder', 'milk', 'tank'],
      inverters: ['type', 'ratedW', 'pvW', 'batteryV'], ups: ['type', 'va', 'watts', 'runtimeHalf'], guitars: ['shape', 'pickups', 'frets', 'madeIn'],
      keyboards: ['type', 'keys', 'action', 'polyphony'], evs: ['body', 'drive', 'batteryKwh', 'dcKw'],
      tvs: ['panel', 'displaySize', 'nits', 'refresh'], monitors: ['panel', 'displaySize', 'displayRes', 'refresh'],
    }[this.state.cat] || [];
    const units = this.units();
    return pick.map(k => CATEGORIES[this.state.cat].fields.find(f => f.key === k)).filter(f => f && d[f.key] != null)
      .map(f => f.type === 'bool' ? (d[f.key] ? f.label : '') : f.type === 'num' && !f.unit ? `${formatValue(f, d[f.key], units)} ${f.label.toLowerCase()}` : formatValue(f, d[f.key], units)).filter(Boolean);
  },
  renderRank() {
    const r = this.state.rank, def = CATEGORIES[this.state.cat];
    const hasValue = this.prefs.showPrices && this.data.devices.some(d => d._value != null);
    const sortOpts = [['score', 'Tech score'], ...(hasValue ? [['value', 'Best value (score for the money)']] : []), ['newest', 'Newest'], ...this.data.scores.map(s => [s.key, s.label]),
      ...def.fields.filter(f => f.better && f.type === 'num' && this.data.devices.some(d => d[f.key] != null) && (this.prefs.showPrices || f.key !== 'price') && (this.prefs.showBenchmarks || !BENCH_KEYS.includes(f.key))).map(f => [f.key, f.label])];
    this.el.body.innerHTML = `
      <section class="dv-card dv-rank">
        <div class="dv-rank-tools">
          <label class="dv-rank-search">${ic.search}<input type="search" data-rank="q" value="${esc(r.q)}" placeholder="Search ${esc(lc(def.label))}" aria-label="Search"></label>
          <select class="tool-select" data-rank="brand" aria-label="Brand"><option value="">All brands</option>${this.data.brands.map(b => `<option ${b === r.brand ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
          <select class="tool-select" data-rank="year" aria-label="Year"><option value="">Any year</option>${this.data.years.map(y => `<option ${y === r.year ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select>
          <select class="tool-select" data-rank="sort" aria-label="Sort by">${sortOpts.map(([k, l]) => `<option value="${k}" ${k === r.sort ? 'selected' : ''}>Sort: ${esc(l)}</option>`).join('')}</select>
        </div>
        ${def.note ? `<p class="dv-note dv-cat-note">${esc(def.note)}</p>` : ''}
        <div class="dv-rank-results">${this.rankResultsHtml()}</div>
      </section>`;
  },
  /** The ranked list alone — redrawn as the filters change, so the filters themselves stay put. */
  rankResultsHtml(from = 0) {
    const r = this.state.rank, def = CATEGORIES[this.state.cat];
    const list = this.rankList();
    const [cur] = this.pair();
    const sortField = def.fields.find(f => f.key === r.sort);
    const sub = this.data.scores.find(s => s.key === r.sort);
    const units = this.units();
    const rows = list.slice(from, r.shown).map((d, k) => {
      const i = from + k;
      const metric = sortField ? formatValue(sortField, d[r.sort], units) : sub ? this.fmtScore(d._scores[r.sort]) : r.sort === 'value' ? `Value ${this.fmtScore(d._value)}${d.price ? ` · $${Number(d.price).toLocaleString('en-US')}` : ''}` : '';
      return `<li class="dv-rank-row${cur && cur.id === d.id ? ' is-current' : ''}">
        <span class="dv-rank-pos">${i + 1}</span>
        <span class="dv-rank-glyph">${glyph(this.state.cat, 28)}</span>
        <button type="button" class="dv-rank-main" data-open-id="${esc(d.id)}" title="Open ${esc(d.name)}">
          <strong>${esc(d.name)}</strong>
          <span class="dv-muted">${esc([d.brand, fmtDate(d.released), ...this.keySpecs(d)].join(' · '))}</span>
        </button>
        ${metric && r.sort !== 'score' && r.sort !== 'newest' ? `<span class="dv-rank-metric">${esc(metric)}</span>` : ''}
        ${d._score != null ? `<span class="dv-rank-score" style="--s:${d._score}">${this.fmtScore(d._score)}</span>` : '<span></span>'}
        <div class="dv-rank-actions">
          ${cur && cur.id !== d.id ? `<button type="button" class="btn btn-sm btn-secondary" data-rival="${esc(d.id)}" title="Compare with ${esc(cur.name)}">Compare</button>` : ''}
        </div>
      </li>`;
    }).join('');
    if (from) return rows;
    return `<p class="dv-muted dv-rank-count">${list.length} ${esc(list.length === 1 ? def.singular : lc(def.label))}${cur ? ` · Compare puts one next to ${esc(cur.name)}` : ''}</p>
      <ol class="dv-rank-list">${rows || `<li class="dv-empty">Nothing matches those filters. Clear the search or pick another brand or year.</li>`}</ol>
      ${list.length > r.shown ? `<div class="dv-more"><button type="button" class="btn btn-secondary" data-act="more">Show ${Math.min(RANK_PAGE, list.length - r.shown)} more</button></div>` : ''}`;
  },
  /** Filters changed: only the results redraw, and arrive quickly. */
  refreshRank() {
    const box = this.el.body.querySelector('.dv-rank-results');
    if (!box) { this.renderRank(); return; }
    this.motion.reset();
    box.innerHTML = this.rankResultsHtml();
    this.motion.enter(box, { mode: 'quick' });
  },
  /** "Show more": the next page joins the list and cascades in. */
  moreRank() {
    const r = this.state.rank, from = r.shown;
    r.shown += RANK_PAGE;
    const box = this.el.body.querySelector('.dv-rank-results');
    const ol = box?.querySelector('.dv-rank-list');
    if (!ol) { this.refreshRank(); return; }
    ol.insertAdjacentHTML('beforeend', this.rankResultsHtml(from));
    const list = this.rankList();
    box.querySelector('.dv-more')?.remove();
    if (list.length > r.shown) box.insertAdjacentHTML('beforeend', `<div class="dv-more"><button type="button" class="btn btn-secondary" data-act="more">Show ${Math.min(RANK_PAGE, list.length - r.shown)} more</button></div>`);
    this.motion.enter(box, { mode: 'quick' });
  },

  /* ---------------- online sheets ---------------- */
  renderSheets() {
    if (!this.sheets) {
      this.el.body.innerHTML = '<div class="dv-sheets"></div>';
      this.sheets = Object.create(IcecatPanel);
      this.sheets.render(this.el.body.querySelector('.dv-sheets'));
    }
    // "Look up … online" from the search bar: carry the words over as the model to find.
    const q = this.pendingSheetsQuery;
    this.pendingSheetsQuery = '';
    const input = q && this.el.body.querySelector('#dc-lookup [name="query"]');
    if (input) {
      input.value = q;
      requestAnimationFrame(() => this.el?.body.querySelector('#dc-lookup [name="brand"]')?.focus({ preventScroll: true }));
    }
  },

  /* ---------------- events ---------------- */
  onClick(e) {
    const t = e.target;
    const row = t.closest('.dv-dd-row');
    if (row) { e.preventDefault(); this.activate(row); return; }
    const go = t.closest('[data-qs-go]');
    if (go) { this.submit(go.closest('.dv-qs')); return; }
    if (t.closest('.dv-cc')) { this.navOpen() ? this.closeNav() : this.openNav(); return; }
    if (t.closest('[data-nav-back]')) { this.showPane('groups'); return; }
    const grp = t.closest('[data-group]');
    if (grp) { this.showPane('cats', grp.dataset.group); return; }
    const cat = t.closest('[data-cat]');
    if (cat) {
      this.closeNav({ focus: true });
      if (cat.dataset.cat !== this.state.cat) this.showCategory(cat.dataset.cat, this.dirOf(FLAT_CATS, this.state.cat, cat.dataset.cat));
      return;
    }
    const view = t.closest('[data-view]');
    if (view) {
      if (view.dataset.view === this.state.view) return;
      const dir = this.dirOf(VIEW_ORDER, this.state.view, view.dataset.view);
      this.state.view = view.dataset.view; this.save(); this.renderView(dir);
      return;
    }
    const pickBtn = t.closest('.dv-picker-btn');
    if (pickBtn) {
      const slot = pickBtn.closest('.dv-picker');
      slot.querySelector('.dv-pop').hidden ? this.openPicker(slot) : this.closePickers();
      return;
    }
    const opt = t.closest('[data-pick]');
    if (opt) { this.pick(opt.closest('.dv-picker').dataset.slot, opt.dataset.pick); return; }
    const open = t.closest('[data-open]');
    if (open) { e.preventDefault(); const [c, id] = open.dataset.open.split('|'); this.go({ cat: c, pair: [id] }); return; }
    const openId = t.closest('[data-open-id]');
    if (openId) { this.go({ pair: [openId.dataset.openId] }); return; }
    const rival = t.closest('[data-rival]');
    if (rival) { const [A] = this.pair(); if (A) this.comparePair(A.id, rival.dataset.rival); return; }
    const pairBtn = t.closest('[data-pair]');
    if (pairBtn) { const [a, b] = pairBtn.dataset.pair.split('|'); this.comparePair(a, b); return; }
    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'swap': {
        const f = flip(this.el.body);
        this.state.pairs[this.state.cat] = [...(this.state.pairs[this.state.cat] || [])].reverse();
        this.repaintMain({ flipFrom: f });
        break;
      }
      case 'clear': {
        // close the comparison: back to the first device on its own
        const f = flip(this.el.body);
        this.state.pairs[this.state.cat] = (this.state.pairs[this.state.cat] || []).slice(0, 1);
        this.repaintMain({ flipFrom: f });
        break;
      }
      case 'rank': this.go({ view: 'rank' }); break;
      case 'prefs': openSettings('tool:tech-device-comparisons'); break;
      case 'more': this.moreRank(); break;
      case 'copy-md': copyText(this.markdown()); showToast('Specs copied as a Markdown table'); break;
      default: break;
    }
  },
  onInput(e) {
    const t = e.target;
    if (t.matches('[data-qs-input]')) { this.fillDropdown(t.closest('.dv-qs')); return; }
    if (t.closest('.dv-pop-search')) { this.fillPicker(t.closest('.dv-picker'), t.value); return; }
    if (t.dataset.rank === 'q') {
      this.state.rank.q = t.value; this.state.rank.shown = RANK_PAGE;
      this.refreshRank();
    }
  },
  onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'diff') {
      this.state.diffOnly = t.checked;
      const [A, B] = this.pair();
      const old = this.el.body.querySelector('.dv-specs');
      if (!A || !B || !old) { this.repaintMain(); return; }
      const tmp = document.createElement('div');
      tmp.innerHTML = this.specTableHtml(A, B);
      const fresh = tmp.firstElementChild;
      old.replaceWith(fresh);
      // the card stays; its rows arrive again
      fresh.classList.add('rv-arrived');
      fresh.querySelector('.dv-sec-head')?.querySelectorAll('*').forEach(n => n.classList.add('rv-arrived'));
      this.motion.enter(fresh, { mode: 'quick' });
      fresh.querySelector('[data-act="diff"]')?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.rank && t.dataset.rank !== 'q') { this.state.rank[t.dataset.rank] = t.value; this.state.rank.shown = RANK_PAGE; this.refreshRank(); }
  },
  onKeydown(e) {
    const qsInput = e.target.closest?.('[data-qs-input]');
    if (qsInput) {
      const wrap = qsInput.closest('.dv-qs');
      const dd = wrap.querySelector('.dv-qs-dd');
      const rows = [...wrap.querySelectorAll('.dv-dd-row')];
      const i = rows.findIndex(r => r.classList.contains('is-active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (dd.hidden) { this.fillDropdown(wrap); return; }
        this.setActive(wrap, e.key === 'ArrowDown' ? i + 1 : i - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.submit(wrap);
      } else if (e.key === 'Escape') {
        if (!dd.hidden) { e.preventDefault(); e.stopPropagation(); this.closeDropdown(wrap); }
      }
      return;
    }
    if (this.navOpen() && e.target.closest?.('.dv-bar')) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeNav({ focus: true }); return; }
      const pane = e.target.closest('.dv-pane');
      if (pane && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
        const chips = [...pane.querySelectorAll('.dv-chip')];
        const i = chips.indexOf(e.target.closest('.dv-chip'));
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : Math.max(0, Math.min(chips.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        e.preventDefault();
        chips[j]?.focus({ preventScroll: true });
        if (chips[j]) this.scrollChipIntoView(chips[j]);
        return;
      }
      if (pane?.classList.contains('dv-pane-cats') && e.key === 'Backspace') { e.preventDefault(); this.showPane('groups'); return; }
    }
    const pop = e.target.closest?.('.dv-pop');
    if (!pop) return;
    const items = [...pop.querySelectorAll('[data-pick]')];
    let i = items.findIndex(x => x.classList.contains('active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      items.forEach((x, j) => { x.classList.toggle('active', j === i); x.setAttribute('aria-selected', String(j === i)); });
      items[i]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[i]) this.pick(pop.closest('.dv-picker').dataset.slot, items[i].dataset.pick);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); this.closePickers();
      pop.closest('.dv-picker').querySelector('.dv-picker-btn').focus();
    }
  },

  markdown() {
    const [A, B] = this.pair();
    const units = this.units(), def = CATEGORIES[this.state.cat];
    const c = (s) => String(s ?? '—').replace(/\|/g, '\\|');
    if (A && !B) {
      let one = `| | ${c(A.name)} |\n| --- | --- |\n| Tech score | ${this.fmtScore(A._score) || '—'} |\n`;
      for (const f of def.fields) if (!/Id$/.test(f.key) && A[f.key] != null) one += `| ${c(f.label)} | ${c(formatValue(f, A[f.key], units))} |\n`;
      return one;
    }
    let md = `| | ${c(A.name)} | ${c(B.name)} |\n| --- | --- | --- |\n| Tech score | ${this.fmtScore(A._score)} | ${this.fmtScore(B._score)} |\n| Value score | ${this.fmtScore(A._value)} | ${this.fmtScore(B._value)} |\n`;
    for (const f of def.fields) {
      if (/Id$/.test(f.key) || (A[f.key] == null && B[f.key] == null)) continue;
      md += `| ${c(f.label)} | ${c(formatValue(f, A[f.key], units) || '—')} | ${c(formatValue(f, B[f.key], units) || '—')} |\n`;
    }
    const V = verdicts(this.state.cat, A, B);
    md += `\n**Better tech:** ${V.tech.headline}. ${V.tech.text}\n\n**Better buy:** ${V.buy.headline}. ${V.buy.text}\n`;
    return md;
  },
};

/** Circular score gauge. */
function ring(score) {
  const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score || 0));
  return `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="dv-ring-track"/><circle cx="40" cy="40" r="${r}" class="dv-ring-fill" style="--c:${c.toFixed(1)};--o:${(c * (1 - v / 100)).toFixed(1)}" transform="rotate(-90 40 40)"/></svg>`;
}
