/* ============================================================
   TOOLBOX — Tech Device Comparisons

   Head-to-head comparisons in the style of spec-comparison sites:
   pick two devices, see an overall score, a score breakdown, the
   reasons each one wins, benchmarks and the full spec sheet with
   the better value marked on every row. Rankings list the whole
   category. The online spec-sheet lookup (Icecat) remains as the
   third tab for products outside the built-in database.

   1,300+ devices across phones, tablets, laptops, mobile chips,
   processors, graphics cards, smartwatches, headphones and consoles
   live in lib/devices/data. Settings: Preferences → Tools.
   ============================================================ */

import {
  CATEGORIES, CATEGORY_ORDER, loadCategory, reasons, formatValue, winner, searchDevices,
  defaultPair, suggestions, fmtDate,
} from '../lib/devices/db.js';
import IcecatPanel from '../lib/devices/icecat-panel.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { getSetting } from '../lib/settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { copyText, showToast } from '../utils.js';

const STORE = 'toolbox_devices_v2';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BENCH_KEYS = ['gb6s', 'gb6m', 'antutu', 'cb24s', 'cb24m', 'timespy', 'steelnomad', 'wildlife'];
const RANK_PAGE = 40;

/* Category glyphs, drawn at 48×48. */
const GLYPH = {
  phones: '<rect x="15" y="5" width="18" height="38" rx="4"/><path d="M21 9h6"/><circle cx="24" cy="38" r="1.2"/>',
  tablets: '<rect x="9" y="6" width="30" height="36" rx="4"/><circle cx="24" cy="38" r="1.2"/>',
  laptops: '<rect x="10" y="11" width="28" height="19" rx="2.5"/><path d="M5 35h38l-3 4H8z"/>',
  socs: '<rect x="13" y="13" width="22" height="22" rx="3"/><rect x="19" y="19" width="10" height="10" rx="1.5"/><path d="M18 8v5M24 8v5M30 8v5M18 35v5M24 35v5M30 35v5M8 18h5M8 24h5M8 30h5M35 18h5M35 24h5M35 30h5"/>',
  cpus: '<rect x="11" y="11" width="26" height="26" rx="3"/><rect x="17" y="17" width="14" height="14" rx="2"/><path d="M16 6v5M22 6v5M28 6v5M34 6v5M16 37v5M22 37v5M28 37v5M34 37v5M6 16h5M6 22h5M6 28h5M6 34h5M37 16h5M37 22h5M37 28h5M37 34h5"/>',
  gpus: '<rect x="5" y="14" width="38" height="18" rx="3"/><circle cx="17" cy="23" r="5"/><circle cx="31" cy="23" r="5"/><path d="M9 32v4M14 32v3M19 32v3M24 32v3"/>',
  watches: '<rect x="13" y="13" width="22" height="22" rx="6"/><path d="M17 13l2-7h10l2 7M17 35l2 7h10l2-7M24 19v5l3 3"/>',
  audio: '<path d="M10 28v-4a14 14 0 0 1 28 0v4"/><rect x="8" y="27" width="7" height="12" rx="3"/><rect x="33" y="27" width="7" height="12" rx="3"/>',
  consoles: '<path d="M14 16h20a9 9 0 0 1 8.7 11.3l-1.4 5.4a4.5 4.5 0 0 1-7.7 1.9L30 31H18l-3.6 3.6a4.5 4.5 0 0 1-7.7-1.9l-1.4-5.4A9 9 0 0 1 14 16z"/><path d="M15 21v6M12 24h6"/><circle cx="31" cy="22" r="1.3"/><circle cx="34" cy="26" r="1.3"/>',
};
const glyph = (cat, size = 48) => `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[cat]}</svg>`;
const ic = {
  swap: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="14" y2="7"/><circle cx="16" cy="7" r="2"/><line x1="10" y1="17" x2="20" y2="17"/><circle cx="8" cy="17" r="2"/></svg>',
};

export default {
  async render(container, { analytics } = {}) {
    this.container = container;
    this.prefs = getToolSettings('tech-device-comparisons');
    const saved = this.load();
    this.state = {
      cat: saved.cat && CATEGORIES[saved.cat] ? saved.cat : this.prefs.defaultCategory,
      view: ['compare', 'rank', 'sheets'].includes(saved.view) ? saved.view : 'compare',
      pairs: saved.pairs || {},
      diffOnly: this.prefs.differencesOnly,
      rank: { q: '', brand: '', year: '', sort: 'score', shown: RANK_PAGE },
    };
    this.counts = saved.counts || {};
    this.renderShell();
    await this.showCategory(this.state.cat);
    this.off = onToolSettings('tech-device-comparisons', (p) => {
      const diffChanged = p.differencesOnly !== this.prefs.differencesOnly;
      this.prefs = p;
      if (diffChanged) this.state.diffOnly = p.differencesOnly;
      this.renderView();
    });
    analytics?.started?.();
    // warm the counts for the category chips without blocking
    Promise.all(CATEGORY_ORDER.map(c => loadCategory(c).then(d => { this.counts[c] = d.devices.length; }))).then(() => { this.renderCats(); this.save(); }).catch(() => {});
  },

  destroy() {
    this.off?.();
    this.sheets?.destroy?.();
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.container = null;
  },

  load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } },
  save() {
    try { localStorage.setItem(STORE, JSON.stringify({ cat: this.state.cat, view: this.state.view, pairs: this.state.pairs, counts: this.counts })); } catch { /* private mode */ }
  },
  units() { return this.prefs.units === 'auto' ? (getSetting('unitSystem') === 'imperial' ? 'imperial' : 'metric') : this.prefs.units; },
  fmtScore(v) {
    if (v == null) return '—';
    return this.prefs.scoreScale === '10' ? (v / 10).toFixed(1) : String(v);
  },

  /* ---------------- shell ---------------- */
  renderShell() {
    this.container.innerHTML = `
      <div class="dv">
        <div class="dv-top">
          <div class="dv-cats" role="tablist" aria-label="Device category"></div>
          <div class="dv-toprow">
            <div class="dv-views" role="tablist" aria-label="View">
              <button type="button" role="tab" data-view="compare">Compare</button>
              <button type="button" role="tab" data-view="rank">Rankings</button>
              <button type="button" role="tab" data-view="sheets">Spec sheet lookup</button>
            </div>
            <button type="button" class="btn btn-ghost btn-sm dv-prefs" data-act="prefs">${ic.sliders}<span>Comparison preferences</span></button>
          </div>
        </div>
        <div class="dv-body"></div>
      </div>`;
    this.el = { cats: this.container.querySelector('.dv-cats'), body: this.container.querySelector('.dv-body'), views: this.container.querySelector('.dv-views') };
    this.container.addEventListener('click', (e) => this.onClick(e));
    this.container.addEventListener('input', (e) => this.onInput(e));
    this.container.addEventListener('change', (e) => this.onChange(e));
    this.container.addEventListener('keydown', (e) => this.onKeydown(e));
    this.onOutside = (e) => { if (!e.target.closest?.('.dv-picker')) this.closePickers(); };
    document.addEventListener('pointerdown', this.onOutside, true);
    this.renderCats();
  },

  renderCats() {
    if (!this.el) return;
    this.el.cats.innerHTML = CATEGORY_ORDER.map(c => `<button type="button" role="tab" class="dv-cat" data-cat="${c}" aria-selected="${c === this.state.cat}">
      <span class="dv-cat-icon">${glyph(c, 20)}</span><span>${esc(CATEGORIES[c].label)}</span>${this.counts[c] ? `<small>${this.counts[c]}</small>` : ''}</button>`).join('');
    this.el.views.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === this.state.view)));
    this.el.cats.hidden = this.state.view === 'sheets';
  },

  async showCategory(cat) {
    this.state.cat = cat;
    this.state.rank = { q: '', brand: '', year: '', sort: 'score', shown: RANK_PAGE };
    this.renderCats();
    if (this.state.view !== 'sheets') this.el.body.innerHTML = `<div class="dv-loading"><span></span><span></span><span></span></div>`;
    this.data = await loadCategory(cat);
    if (!this.container || this.state.cat !== cat) return;
    this.counts[cat] = this.data.devices.length;
    const pair = this.state.pairs[cat];
    if (!pair || !this.data.byId.has(pair[0]) || !this.data.byId.has(pair[1])) this.state.pairs[cat] = defaultPair(this.data);
    this.save();
    this.renderCats();
    this.renderView();
  },

  renderView() {
    if (!this.container || !this.data) return;
    this.renderCats();
    if (this.state.view !== 'sheets' && this.sheets) { this.sheets.destroy?.(); this.sheets = null; }
    if (this.state.view === 'compare') this.renderCompare();
    else if (this.state.view === 'rank') this.renderRank();
    else this.renderSheets();
  },

  /* ---------------- compare ---------------- */
  pair() {
    const [a, b] = this.state.pairs[this.state.cat] || [];
    return [this.data.byId.get(a), this.data.byId.get(b)];
  },

  renderCompare() {
    const [A, B] = this.pair();
    const cat = this.state.cat, def = CATEGORIES[cat];
    if (!A || !B) { this.el.body.innerHTML = '<p class="dv-empty">Pick two devices to compare.</p>'; return; }
    const units = this.units();
    const aWins = (A._score ?? -1) > (B._score ?? -1), bWins = (B._score ?? -1) > (A._score ?? -1);
    const lim = this.prefs.reasons;
    const filter = (list) => list.filter(r => (this.prefs.showPrices || r.key !== 'price') && (this.prefs.showBenchmarks || !BENCH_KEYS.includes(r.key)));
    const whyA = filter(reasons(cat, A, B, units, lim + 4)).slice(0, lim), whyB = filter(reasons(cat, B, A, units, lim + 4)).slice(0, lim);

    const heroCard = (d, win, side) => `
      <div class="dv-hero-card${win ? ' win' : ''}" data-side="${side}">
        <div class="dv-picker" data-slot="${side}">
          <button type="button" class="dv-picker-btn" aria-haspopup="listbox" aria-expanded="false">
            <span class="dv-picker-name">${esc(d.name)}</span>${ic.chevron}
          </button>
          <div class="dv-pop" hidden>
            <label class="dv-pop-search">${ic.search}<input type="search" placeholder="Search ${esc(def.label.toLowerCase())}" aria-label="Search ${esc(def.label.toLowerCase())}" autocomplete="off"></label>
            <ul class="dv-pop-list" role="listbox"></ul>
          </div>
        </div>
        <div class="dv-hero-main">
          <span class="dv-hero-glyph">${glyph(cat, 56)}</span>
          <div class="dv-hero-meta">
            <span class="dv-brand">${esc(d.brand)}</span>
            <strong class="dv-hero-name">${esc(d.name)}</strong>
            <span class="dv-hero-sub">${esc([fmtDate(d.released), this.prefs.showPrices && d.price ? `$${Number(d.price).toLocaleString('en-US')}` : '', d.type || d.segment || ''].filter(Boolean).join(' · '))}</span>
          </div>
        </div>
        <div class="dv-ring${win ? ' win' : ''}">${ring(d._score)}<span class="dv-ring-val">${this.fmtScore(d._score)}</span><span class="dv-ring-cap">${d._rank ? `#${d._rank} of ${this.data.devices.length}` : 'Not ranked'}</span></div>
      </div>`;

    const subs = this.data.scores.filter(s => A._scores[s.key] != null || B._scores[s.key] != null);
    const scoresHtml = subs.map(s => {
      const a = A._scores[s.key], b = B._scores[s.key];
      const w = a != null && b != null ? (a > b ? 'a' : b > a ? 'b' : '') : '';
      return `<div class="dv-bf">
        <span class="dv-bf-val a${w === 'a' ? ' win' : ''}">${this.fmtScore(a)}</span>
        <div class="dv-bf-bar a"><i style="--w:${a ?? 0}%"></i></div>
        <span class="dv-bf-label">${esc(s.label)}</span>
        <div class="dv-bf-bar b"><i style="--w:${b ?? 0}%"></i></div>
        <span class="dv-bf-val b${w === 'b' ? ' win' : ''}">${this.fmtScore(b)}</span>
      </div>`;
    }).join('');

    const whyCard = (d, other, list, side) => `
      <div class="dv-card dv-why-card" data-side="${side}">
        <h3>Why is ${esc(d.name)} better than ${esc(other.name)}?</h3>
        ${list.length ? `<ul>${list.map(r => `<li><span class="dv-check">${ic.check}</span><span><strong>${esc(r.title)}</strong>${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</span></li>`).join('')}</ul>` : `<p class="dv-muted">Nothing stands out on paper.</p>`}
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

    // full spec sheet
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
    const specHtml = `
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

    const related = suggestions(this.data, A.id, 6).filter(d => d.id !== B.id).slice(0, 5);
    const relatedHtml = related.length ? `
      <section class="dv-related">
        <h3>Compare ${esc(A.name)} with</h3>
        <div class="dv-related-list">${related.map(d => `<button type="button" class="dv-related-item" data-pair="${esc(A.id)}|${esc(d.id)}"><span>${esc(A.name)}</span><em>vs</em><span>${esc(d.name)}</span></button>`).join('')}</div>
      </section>` : '';

    this.el.body.innerHTML = `
      <section class="dv-hero">
        ${heroCard(A, aWins, 'a')}
        <div class="dv-vs"><button type="button" class="dv-swap" data-act="swap" aria-label="Swap devices" title="Swap">${ic.swap}</button><span>VS</span></div>
        ${heroCard(B, bWins, 'b')}
      </section>
      ${subs.length ? `<section class="dv-card dv-breakdown"><header class="dv-sec-head"><h3>Score breakdown</h3><div class="dv-legend"><span class="a">${esc(A.name)}</span><span class="b">${esc(B.name)}</span></div></header>${scoresHtml}</section>` : ''}
      <section class="dv-why">${whyCard(A, B, whyA, 'a')}${whyCard(B, A, whyB, 'b')}</section>
      ${benchHtml}
      ${specHtml}
      ${relatedHtml}
      <p class="dv-note">Scores compare each device with the rest of its category from the listed specs; they are not a review. Benchmark figures are typical published results and vary with software and cooling. <sup>*</sup> marks a value taken from the device's chip. Launch prices are US list prices for the base model.</p>`;
    requestAnimationFrame(() => this.el.body.querySelectorAll('.dv-bf-bar i, .dv-bench-bar i, .dv-ring').forEach(n => n.classList.add('in')));
  },

  /* ---------------- device picker ---------------- */
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
    const current = this.state.pairs[this.state.cat];
    const other = current[slotEl.dataset.slot === 'a' ? 1 : 0];
    const found = searchDevices(this.data, q, 40).filter(d => d.id !== other);
    list.innerHTML = found.length ? found.map((d, i) => `<li role="option" tabindex="-1" data-pick="${esc(d.id)}" class="${i === 0 ? 'active' : ''}" aria-selected="${i === 0}">
      <span class="dv-pop-name">${esc(d.name)}</span><span class="dv-pop-meta">${esc(d.brand)} · ${esc(fmtDate(d.released))}</span><span class="dv-pop-score">${this.fmtScore(d._score)}</span></li>`).join('')
      : `<li class="dv-pop-empty">No ${esc(CATEGORIES[this.state.cat].label.toLowerCase())} match “${esc(q)}”.</li>`;
  },
  pick(slot, id) {
    const pair = [...this.state.pairs[this.state.cat]];
    pair[slot === 'a' ? 0 : 1] = id;
    this.state.pairs[this.state.cat] = pair;
    this.save();
    this.closePickers();
    this.renderCompare();
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
    const val = (d) => key === 'score' ? d._score : key === 'newest' ? (d.released || '') : sub ? d._scores[key] : d[key];
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
    }[this.state.cat];
    const units = this.units();
    return pick.map(k => CATEGORIES[this.state.cat].fields.find(f => f.key === k)).filter(f => f && d[f.key] != null)
      .map(f => f.type === 'bool' ? (d[f.key] ? f.label : '') : f.type === 'num' && !f.unit ? `${formatValue(f, d[f.key], units)} ${f.label.toLowerCase()}` : formatValue(f, d[f.key], units)).filter(Boolean);
  },
  renderRank() {
    const r = this.state.rank, def = CATEGORIES[this.state.cat];
    const sortOpts = [['score', 'Overall score'], ['newest', 'Newest'], ...this.data.scores.map(s => [s.key, s.label]),
      ...def.fields.filter(f => f.better && f.type === 'num' && this.data.devices.some(d => d[f.key] != null) && (this.prefs.showPrices || f.key !== 'price') && (this.prefs.showBenchmarks || !BENCH_KEYS.includes(f.key))).map(f => [f.key, f.label])];
    const list = this.rankList();
    const [pa, pb] = this.state.pairs[this.state.cat];
    const sortField = def.fields.find(f => f.key === r.sort);
    const sub = this.data.scores.find(s => s.key === r.sort);
    const units = this.units();
    const shown = list.slice(0, r.shown);
    this.el.body.innerHTML = `
      <section class="dv-card dv-rank">
        <div class="dv-rank-tools">
          <label class="dv-rank-search">${ic.search}<input type="search" data-rank="q" value="${esc(r.q)}" placeholder="Search ${esc(def.label.toLowerCase())}" aria-label="Search"></label>
          <select class="tool-select" data-rank="brand" aria-label="Brand"><option value="">All brands</option>${this.data.brands.map(b => `<option ${b === r.brand ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
          <select class="tool-select" data-rank="year" aria-label="Year"><option value="">Any year</option>${this.data.years.map(y => `<option ${y === r.year ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select>
          <select class="tool-select" data-rank="sort" aria-label="Sort by">${sortOpts.map(([k, l]) => `<option value="${k}" ${k === r.sort ? 'selected' : ''}>Sort: ${esc(l)}</option>`).join('')}</select>
        </div>
        <p class="dv-muted dv-rank-count">${list.length} ${esc(list.length === 1 ? def.singular : def.label.toLowerCase())}</p>
        <ol class="dv-rank-list">
          ${shown.map((d, i) => {
            const metric = sortField ? formatValue(sortField, d[r.sort], units) : sub ? this.fmtScore(d._scores[r.sort]) : '';
            return `<li class="dv-rank-row">
              <span class="dv-rank-pos">${i + 1}</span>
              <span class="dv-rank-glyph">${glyph(this.state.cat, 28)}</span>
              <div class="dv-rank-main">
                <strong>${esc(d.name)}</strong>
                <span class="dv-muted">${esc([d.brand, fmtDate(d.released), ...this.keySpecs(d)].join(' · '))}</span>
              </div>
              ${metric && r.sort !== 'score' && r.sort !== 'newest' ? `<span class="dv-rank-metric">${esc(metric)}</span>` : ''}
              <span class="dv-rank-score" style="--s:${d._score ?? 0}">${this.fmtScore(d._score)}</span>
              <div class="dv-rank-actions">
                <button type="button" class="btn btn-sm ${d.id === pa ? 'btn-primary' : 'btn-secondary'}" data-slot-set="a" data-id="${esc(d.id)}" title="Compare as the first device">A</button>
                <button type="button" class="btn btn-sm ${d.id === pb ? 'btn-primary' : 'btn-secondary'}" data-slot-set="b" data-id="${esc(d.id)}" title="Compare as the second device">B</button>
              </div>
            </li>`;
          }).join('') || `<li class="dv-empty">Nothing matches those filters.</li>`}
        </ol>
        ${list.length > r.shown ? `<div class="dv-more"><button type="button" class="btn btn-secondary" data-act="more">Show ${Math.min(RANK_PAGE, list.length - r.shown)} more</button></div>` : ''}
      </section>`;
  },

  /* ---------------- online sheets ---------------- */
  renderSheets() {
    if (this.sheets) return;
    this.el.body.innerHTML = '<div class="dv-sheets"></div>';
    this.sheets = Object.create(IcecatPanel);
    this.sheets.render(this.el.body.querySelector('.dv-sheets'));
  },

  /* ---------------- events ---------------- */
  onClick(e) {
    const t = e.target;
    const cat = t.closest('[data-cat]');
    if (cat) { if (cat.dataset.cat !== this.state.cat) this.showCategory(cat.dataset.cat); return; }
    const view = t.closest('[data-view]');
    if (view) { this.state.view = view.dataset.view; this.save(); this.renderView(); return; }
    const pickBtn = t.closest('.dv-picker-btn');
    if (pickBtn) {
      const slot = pickBtn.closest('.dv-picker');
      slot.querySelector('.dv-pop').hidden ? this.openPicker(slot) : this.closePickers();
      return;
    }
    const opt = t.closest('[data-pick]');
    if (opt) { this.pick(opt.closest('.dv-picker').dataset.slot, opt.dataset.pick); return; }
    const pairBtn = t.closest('[data-pair]');
    if (pairBtn) { this.state.pairs[this.state.cat] = pairBtn.dataset.pair.split('|'); this.save(); this.renderCompare(); this.container.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const setSlot = t.closest('[data-slot-set]');
    if (setSlot) {
      const pair = [...this.state.pairs[this.state.cat]];
      const idx = setSlot.dataset.slotSet === 'a' ? 0 : 1;
      if (pair[1 - idx] === setSlot.dataset.id) pair[1 - idx] = pair[idx];
      pair[idx] = setSlot.dataset.id;
      this.state.pairs[this.state.cat] = pair; this.save();
      showToast(`${this.data.byId.get(setSlot.dataset.id).name} set as device ${idx ? 'B' : 'A'}`);
      this.renderRank();
      return;
    }
    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'swap': this.state.pairs[this.state.cat] = [...this.state.pairs[this.state.cat]].reverse(); this.save(); this.renderCompare(); break;
      case 'prefs': openSettings('tool:tech-device-comparisons'); break;
      case 'more': this.state.rank.shown += RANK_PAGE; this.renderRank(); break;
      case 'copy-md': copyText(this.markdown()); showToast('Comparison copied as a Markdown table'); break;
      default: break;
    }
  },
  onInput(e) {
    const t = e.target;
    if (t.closest('.dv-pop-search')) { this.fillPicker(t.closest('.dv-picker'), t.value); return; }
    if (t.dataset.rank === 'q') {
      this.state.rank.q = t.value; this.state.rank.shown = RANK_PAGE;
      const pos = t.selectionStart;
      this.renderRank();
      const again = this.el.body.querySelector('[data-rank="q"]');
      again.focus(); again.setSelectionRange(pos, pos);
    }
  },
  onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'diff') { this.state.diffOnly = t.checked; this.renderCompare(); return; }
    if (t.dataset.rank && t.dataset.rank !== 'q') { this.state.rank[t.dataset.rank] = t.value; this.state.rank.shown = RANK_PAGE; this.renderRank(); }
  },
  onKeydown(e) {
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
    let md = `| | ${c(A.name)} | ${c(B.name)} |\n| --- | --- | --- |\n| Score | ${this.fmtScore(A._score)} | ${this.fmtScore(B._score)} |\n`;
    for (const f of def.fields) {
      if (/Id$/.test(f.key) || (A[f.key] == null && B[f.key] == null)) continue;
      md += `| ${c(f.label)} | ${c(formatValue(f, A[f.key], units) || '—')} | ${c(formatValue(f, B[f.key], units) || '—')} |\n`;
    }
    return md;
  },
};

/** Circular score gauge. */
function ring(score) {
  const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score || 0));
  return `<svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="dv-ring-track"/><circle cx="40" cy="40" r="${r}" class="dv-ring-fill" style="--c:${c.toFixed(1)};--o:${(c * (1 - v / 100)).toFixed(1)}" transform="rotate(-90 40 40)"/></svg>`;
}
