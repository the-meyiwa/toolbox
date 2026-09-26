/* ============================================================
   TOOLBOX — Construction Estimator  (tool id: concrete-estimator)

   A bill of quantities for a building or a container conversion:
   add elements (footings, slabs, columns, blockwork, plaster, tiles,
   paint, roofing …), and the estimate prices them with editable
   Nigerian rates, then aggregates a shopping list of what to buy
   (bags of cement, trips of sand and granite, rods by size, blocks).

   The maths lives in lib/construction/estimate.js (DOM-free, tested
   in node). This file is the interface: element cards, a sticky
   summary, BOQ / shopping list / rates tabs, named projects in
   localStorage, CSV and a print sheet for "Save as PDF".

   Preferences (units, waste, default grade, VAT, region, money
   format) are in Preferences → Tools.
   ============================================================ */

import * as E from '../lib/construction/estimate.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { showToast } from '../utils.js';

const TOOL_ID = 'concrete-estimator';
const STORE = 'toolbox_construction_v1';
export const HANDOFF_KEY = 'toolbox_construction_handoff';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (v, dp = 0) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp }) : '—');
const qtyFmt = (q, unit) => {
  if (['bag', 'nr', 'bucket', 'bags', 'lengths', 'rolls', 'cartons', 'pieces', 'buckets'].includes(unit)) return fmtN(q, 0);
  if (unit === 't') return fmtN(q, q < 10 ? 3 : 2);
  return fmtN(q, 2);
};

const FT = 0.3048, IN = 25.4, FT2 = 0.09290304;

const svg = (p, s = 18, sw = 1.7) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const GLYPH = {
  excavation: '<path d="M3 8h5v8h8V8h5"/><path d="M3 20h18"/>',
  strip_footing: '<path d="M4 16h16v4H4z"/><path d="M9 16V5h6v11"/>',
  pad_footing: '<path d="M5 15h14v5H5z"/><path d="M10 15V5h4v10"/>',
  hardcore: '<path d="M3 20h18"/><circle cx="7" cy="15.5" r="2.2"/><circle cx="13" cy="14.5" r="2.8"/><circle cx="18.5" cy="16.5" r="1.6"/>',
  dpm: '<path d="M3 13c3-2.5 6 2.5 9 0s6-2.5 9 0"/><path d="M3 18h18"/>',
  slab_ground: '<path d="M3 13l9-4 9 4-9 4z"/><path d="M3 13v3l9 4 9-4v-3"/>',
  slab_suspended: '<path d="M3 6h18v4H3z"/><path d="M6 10v10M18 10v10"/>',
  column: '<rect x="9" y="3" width="6" height="18" rx="1"/><path d="M9 8h6M9 13h6M9 18h6"/>',
  beam: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v8M11 8v8M15 8v8M19 8v8"/>',
  lintel: '<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M6 9v11M18 9v11"/>',
  stairs: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>',
  blockwork: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v7M15 12v7"/>',
  plaster: '<path d="M4 16l7-7 5 5-7 7H4z"/><path d="M14 7l3-3 3 3-3 3"/>',
  screed: '<path d="M3 17h18"/><path d="M3 13h18" stroke-dasharray="2.5 2.5"/><path d="M7 9l3-3h4l3 3"/>',
  tiling: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>',
  painting: '<rect x="3" y="4" width="14" height="5" rx="1.2"/><path d="M17 6.5h3v5h-8v3"/><path d="M11 14.5h2v6.5h-2z"/>',
  ceiling: '<path d="M3 5h18"/><path d="M5 5v4h14V5"/><path d="M12 9v5"/><circle cx="12" cy="16" r="2"/>',
  roofing: '<path d="M2 12l10-7 10 7"/><path d="M5 10v10h14V10"/>',
  openings: '<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r=".9"/>',
  formwork: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M4 14h16"/><path d="M8 20v-6"/>',
  custom: '<path d="M12 5v14M5 12h14"/>',
};
const IC = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<line x1="4" y1="7" x2="14" y2="7"/><circle cx="16" cy="7" r="2"/><line x1="10" y1="17" x2="20" y2="17"/><circle cx="8" cy="17" r="2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
};

const TABS = [
  { id: 'elements', label: 'Elements' },
  { id: 'boq', label: 'Bill of quantities' },
  { id: 'shopping', label: 'Shopping list' },
  { id: 'rates', label: 'Rates' },
];

function blankProject() {
  return { name: 'New project', client: '', site: '', gfa: 0, contingency: 5, vat: null, elements: [] };
}

export default {
  render(container, { analytics } = {}) {
    this.container = container;
    this.analytics = analytics;
    this.prefs = getToolSettings(TOOL_ID);
    const saved = this.load();
    this.state = {
      project: E.normaliseProject(saved.current || blankProject()),
      saved: saved.saved || {},
      rates: { overrides: saved.rates?.overrides || {}, trips: { ...E.DEFAULT_TRIPS, ...(saved.rates?.trips || {}) }, updatedAt: saved.rates?.updatedAt || null },
      tab: TABS.some(t => t.id === saved.tab) ? saved.tab : 'elements',
      collapsed: new Set(saved.collapsed || []),
      openPalette: false,
    };
    if (!saved.current) {
      this.state.project.name = 'Sample: 12 × 10 m ground floor';
      this.state.project.elements = E.presetBuilding({ length: 12, width: 10 }).slice(0, 5);
    }
    this.takeHandoff();

    container.innerHTML = this.shell();
    this.bind();
    this.renderAll();
    this.off = onToolSettings(TOOL_ID, (p) => { this.prefs = p; this.renderAll(); });
    this.onBeforePrint = () => this.renderSheet();
    window.addEventListener('beforeprint', this.onBeforePrint);
    analytics?.started?.();
  },

  destroy() {
    this.off?.();
    window.removeEventListener('beforeprint', this.onBeforePrint);
    document.removeEventListener('pointerdown', this.onOutside, true);
    clearTimeout(this.saveT); clearTimeout(this.calcT);
    this.container = null;
  },

  /* ---------------- persistence ---------------- */

  load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } },
  save() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => {
      const s = this.state;
      try {
        localStorage.setItem(STORE, JSON.stringify({ v: 1, current: s.project, saved: s.saved, rates: s.rates, tab: s.tab, collapsed: [...s.collapsed] }));
      } catch { /* storage full or blocked */ }
    }, 250);
  },
  takeHandoff() {
    let h = null;
    try { h = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null'); localStorage.removeItem(HANDOFF_KEY); } catch { h = null; }
    if (!h?.project) return;
    const cur = this.state.project;
    if (cur.elements.length && !this.state.saved[cur.name]) this.state.saved[cur.name] = { project: cur, savedAt: new Date().toISOString() };
    this.state.project = E.normaliseProject(h.project);
    this.state.tab = 'boq';
    this.handoffNote = true;
  },

  /* ---------------- derived ---------------- */

  rates() { return E.resolveRates(this.state.rates.overrides, this.prefs.region); },
  result() {
    return E.estimate(this.state.project, {
      rates: this.rates(), waste: (this.prefs.waste ?? 5) / 100, grade: this.prefs.grade, vat: this.prefs.vat, trips: this.state.rates.trips,
    });
  },
  money(v, { compact = false } = {}) {
    if (!Number.isFinite(v)) return '—';
    const style = this.prefs.currency || 'symbol';
    if ((compact || style === 'compact') && Math.abs(v) >= 1e6) {
      const s = Math.abs(v) >= 1e9 ? `${fmtN(v / 1e9, 2)}bn` : `${fmtN(v / 1e6, 2)}m`;
      return style === 'code' ? `NGN ${s}` : `₦${s}`;
    }
    const s = fmtN(Math.round(v), 0);
    return style === 'code' ? `NGN ${s}` : `₦${s}`;
  },
  ft() { return this.prefs.units === 'ft'; },
  toDisplay(v, kind) {
    const x = Number(v);
    if (!Number.isFinite(x) || !this.ft()) return x;
    const r = kind === 'm' ? x / FT : kind === 'mm' ? x / IN : kind === 'm2' ? x / FT2 : x;
    return Math.round(r * 100) / 100;
  },
  toMetric(v, kind) {
    const x = Number(v);
    if (!Number.isFinite(x) || !this.ft()) return x;
    const r = kind === 'm' ? x * FT : kind === 'mm' ? x * IN : kind === 'm2' ? x * FT2 : x;
    return Math.round(r * 10000) / 10000;
  },
  unitLabel(kind) {
    const ft = this.ft();
    return { m: ft ? 'ft' : 'm', mm: ft ? 'in' : 'mm', m2: ft ? 'ft²' : 'm²', deg: '°', pct: '%', money: '₦' }[kind] || '';
  },

  /* ---------------- markup ---------------- */

  shell() {
    return `
      <div class="cx" data-tab="${this.state.tab}">
        <div class="cx-notice" hidden></div>
        <header class="cx-project">
          <div class="cx-project-main">
            <label class="visually-hidden" for="cx-name">Project name</label>
            <input id="cx-name" class="cx-name" data-proj="name" autocomplete="off" spellcheck="false">
            <div class="cx-project-meta">
              <label><span>Client</span><input data-proj="client" placeholder="Client name" autocomplete="off"></label>
              <label><span>Site</span><input data-proj="site" placeholder="Location" autocomplete="off"></label>
              <label><span>Floor area</span><span class="cx-inline-unit"><input data-proj="gfa" inputmode="decimal" placeholder="auto"><em data-unit="m2"></em></span></label>
            </div>
          </div>
          <div class="cx-project-actions">
            <div class="cx-menu">
              <button type="button" class="btn btn-secondary btn-sm" data-act="projects" aria-haspopup="true" aria-expanded="false">${svg(IC.folder, 15)}<span>Projects</span></button>
              <div class="cx-pop" role="menu" hidden></div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-act="save" title="Save this project (Ctrl+S)">${svg(IC.save, 15)}<span>Save</span></button>
          </div>
        </header>

        <div class="cx-tabbar">
          <div class="cx-tabs" role="tablist" aria-label="Estimator views">
            ${TABS.map((t, i) => `<button type="button" role="tab" data-tab="${t.id}" id="cx-tab-${t.id}" aria-controls="cx-panel" title="${t.label} (${i + 1})">${t.label}<small data-count="${t.id}"></small></button>`).join('')}
          </div>
        </div>

        <div class="cx-layout">
          <main class="cx-main" id="cx-panel" role="tabpanel"></main>
          <aside class="cx-summary" aria-label="Estimate summary"></aside>
        </div>
        <div class="cx-sheet" aria-hidden="true"></div>
      </div>`;
  },

  renderAll() {
    if (!this.container) return;
    const root = this.container.querySelector('.cx');
    root.dataset.tab = this.state.tab;
    const p = this.state.project;
    const set = (sel, v) => { const i = root.querySelector(sel); if (i && document.activeElement !== i) i.value = v; };
    set('[data-proj="name"]', p.name);
    set('[data-proj="client"]', p.client);
    set('[data-proj="site"]', p.site);
    set('[data-proj="gfa"]', p.gfa ? this.toDisplay(p.gfa, 'm2') : '');
    root.querySelectorAll('[data-unit]').forEach(u => { u.textContent = this.unitLabel(u.dataset.unit); });
    root.querySelectorAll('[role="tab"]').forEach(b => {
      const on = b.dataset.tab === this.state.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    root.querySelector('#cx-panel').setAttribute('aria-labelledby', `cx-tab-${this.state.tab}`);
    if (this.handoffNote) {
      const n = root.querySelector('.cx-notice');
      n.hidden = false;
      n.innerHTML = `<span>Loaded <strong>${esc(p.name)}</strong> from the Assistant. Your previous project is under Projects.</span><button type="button" class="btn btn-ghost btn-sm" data-act="dismiss">Dismiss</button>`;
      this.handoffNote = false;
    }
    this.renderPanel();
    this.renderSummary();
  },

  renderPanel() {
    const main = this.container.querySelector('#cx-panel');
    const r = this.result();
    this.last = r;
    if (this.state.tab === 'elements') main.innerHTML = this.elementsView(r);
    else if (this.state.tab === 'boq') main.innerHTML = this.boqView(r);
    else if (this.state.tab === 'shopping') main.innerHTML = this.shoppingView(r);
    else main.innerHTML = this.ratesView();
    this.updateCounts(r);
  },

  updateCounts(r) {
    const c = this.container.querySelector('[data-count="elements"]');
    if (c) c.textContent = r.groups.length ? String(r.groups.length) : '';
    const s = this.container.querySelector('[data-count="shopping"]');
    if (s) s.textContent = r.shopping.length ? String(r.shopping.length) : '';
    const e = Object.keys(this.state.rates.overrides).length;
    const rt = this.container.querySelector('[data-count="rates"]');
    if (rt) rt.textContent = e ? `${e} edited` : '';
  },

  /* ---------- elements tab ---------- */

  elementsView(r) {
    const p = this.state.project;
    const palette = E.ELEMENT_GROUPS.map(g => {
      const items = Object.entries(E.ELEMENT_TYPES).filter(([, d]) => d.group === g.id);
      return `<div class="cx-pal-group"><h4>${g.label}</h4><div class="cx-pal-items">${items.map(([k, d]) =>
        `<button type="button" class="cx-pal-item" data-add="${k}">${svg(GLYPH[k], 16)}<span>${esc(d.label)}</span></button>`).join('')}</div></div>`;
    }).join('');
    const presets = Object.entries(E.PRESETS).map(([k, pr]) => `<button type="button" class="cx-chip" data-preset="${k}">${esc(pr.label)}</button>`).join('');
    const cards = p.elements.map((el, i) => this.cardHtml(el, r.groups[i], i, p.elements.length)).join('');
    return `
      <section class="cx-palette" aria-label="Add an element">
        <div class="cx-pal-head">
          <h3>Add an element</h3>
          <p>Each element becomes a section of the bill. Dimensions are ${this.ft() ? 'in feet and inches' : 'in metres and millimetres'}.</p>
        </div>
        <div class="cx-pal">${palette}</div>
        <div class="cx-presets"><span>Or start from</span>${presets}</div>
      </section>
      ${p.elements.length ? `<div class="cx-list">${cards}</div>` : `
        <div class="cx-empty">
          <strong>No elements yet</strong>
          <p>Add a slab, footing or wall above, or start from one of the outlines.</p>
        </div>`}
      ${p.elements.length > 1 ? `<p class="cx-foot-hint">Alt + ↑ / ↓ moves the focused element. Keys 1–4 switch tabs.</p>` : ''}`;
  },

  cardHtml(el, g, i, count) {
    const def = E.ELEMENT_TYPES[el.type];
    const collapsed = this.state.collapsed.has(el.id);
    const errs = g?.errors || {};
    const fields = def.fields.map(f => this.fieldHtml(el, f, errs[f.key])).join('');
    return `
      <article class="cx-el ${collapsed ? 'is-collapsed' : ''} ${Object.keys(errs).length ? 'has-error' : ''}" data-id="${el.id}" aria-label="${esc(el.name)}">
        <header class="cx-el-head">
          <span class="cx-el-glyph">${svg(GLYPH[el.type], 18)}</span>
          <div class="cx-el-titles">
            <input class="cx-el-name" data-name value="${esc(el.name)}" aria-label="Element name" spellcheck="false">
            <small>${el.name.trim().toLowerCase() === def.label.toLowerCase() ? `${def.fields.length} measurements` : esc(def.label)}</small>
          </div>
          <strong class="cx-el-total u-num" data-el-total>${this.money(g?.subtotal || 0)}</strong>
          <div class="cx-el-actions">
            <button type="button" class="cx-ib" data-el-act="up" title="Move up (Alt+↑)" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${svg(IC.up, 15)}</button>
            <button type="button" class="cx-ib" data-el-act="down" title="Move down (Alt+↓)" aria-label="Move down" ${i === count - 1 ? 'disabled' : ''}>${svg(IC.down, 15)}</button>
            <button type="button" class="cx-ib" data-el-act="dup" title="Duplicate" aria-label="Duplicate">${svg(IC.copy, 15)}</button>
            <button type="button" class="cx-ib cx-ib-danger" data-el-act="del" title="Remove" aria-label="Remove">${svg(IC.trash, 15)}</button>
            <button type="button" class="cx-ib cx-ib-fold" data-el-act="fold" title="${collapsed ? 'Expand' : 'Collapse'}" aria-label="${collapsed ? 'Expand' : 'Collapse'}" aria-expanded="${!collapsed}">${svg(IC.chevron, 16)}</button>
          </div>
        </header>
        <div class="cx-el-body">
          <div class="cx-fields">${fields}</div>
          <div class="cx-el-facts" data-facts>${this.factsHtml(el, g)}</div>
        </div>
      </article>`;
  },

  fieldHtml(el, f, err) {
    const id = `cx-${el.id}-${f.key}`;
    const v = el[f.key];
    if (f.kind === 'bool') {
      return `<label class="cx-f cx-f-bool" for="${id}"><input type="checkbox" id="${id}" data-k="${f.key}" ${v ? 'checked' : ''}><span class="cx-switch" aria-hidden="true"></span><span>${esc(f.label)}</span></label>`;
    }
    if (f.kind === 'select') {
      let opts = f.options;
      if (f.key === 'mix') opts = opts.map(o => (o.value === 'default' ? { ...o, label: `Default (${E.MIXES[E.GRADES[this.prefs.grade] || '1:1.5:3'].label})` } : o));
      return `<div class="cx-f"><label for="${id}">${esc(f.label)}</label><select id="${id}" class="cx-in" data-k="${f.key}">${opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }
    if (f.kind === 'text') {
      return `<div class="cx-f ${f.key === 'desc' ? 'cx-f-wide' : ''}"><label for="${id}">${esc(f.label)}</label><input id="${id}" class="cx-in" data-k="${f.key}" value="${esc(v)}" autocomplete="off"></div>`;
    }
    const unit = this.unitLabel(f.kind);
    const shown = ['m', 'mm', 'm2'].includes(f.kind) ? this.toDisplay(v, f.kind) : v;
    return `<div class="cx-f ${err ? 'is-invalid' : ''}">
      <label for="${id}">${esc(f.label)}</label>
      <div class="cx-in-wrap ${f.kind === 'money' ? 'is-prefix' : ''}">
        <input id="${id}" class="cx-in u-num" data-k="${f.key}" data-kind="${f.kind}" inputmode="decimal" value="${esc(shown)}" aria-invalid="${err ? 'true' : 'false'}" ${err ? `aria-describedby="${id}-err"` : ''} autocomplete="off">
        ${unit ? `<span class="cx-unit">${unit}</span>` : ''}
      </div>
      <span class="cx-err" id="${id}-err" role="alert">${err ? esc(this.errText(err, f)) : ''}</span>
    </div>`;
  },

  errText(err, f) {
    const m = /^(At least|At most) (.+)$/.exec(err);
    if (!m || !['m', 'mm', 'm2'].includes(f.kind) || !this.ft()) return err;
    return `${m[1]} ${fmtN(this.toDisplay(Number(m[2]), f.kind), 2)} ${this.unitLabel(f.kind)}`;
  },

  factsHtml(el, g) {
    if (!g) return '';
    const facts = [];
    const info = g.info || {};
    const bags = g.lines.filter(l => l.rateKey === 'cement').reduce((s, l) => s + l.qty, 0);
    const steelT = g.lines.filter(l => l.rateKey === 'rebar').reduce((s, l) => s + l.qty, 0);
    if (info.volume) facts.push(`<b>${fmtN(info.volume, 2)}</b> m³`);
    if (info.area) facts.push(`<b>${fmtN(info.area, 1)}</b> m²`);
    if (info.blocks) facts.push(`<b>${fmtN(info.blocks)}</b> blocks`);
    if (bags) facts.push(`<b>${fmtN(bags)}</b> bags cement`);
    if (steelT) facts.push(`<b>${fmtN(steelT * 1000)}</b> kg steel`);
    if (info.trusses) facts.push(`<b>${info.trusses}</b> trusses`, `<b>${fmtN(info.area, 1)}</b> m² roof`);
    if (info.litres) facts.push(`<b>${fmtN(info.litres)}</b> L paint`);
    if (!facts.length && g.lines.length) facts.push(`${g.lines.length} line${g.lines.length > 1 ? 's' : ''}`);
    return facts.map(f => `<span>${f}</span>`).join('');
  },

  /* ---------- BOQ tab ---------- */

  boqView(r) {
    if (!r.groups.length) return this.emptyTab('The bill fills in as you add elements.');
    const rows = r.groups.map((g, gi) => `
      <tbody class="cx-boq-group">
        <tr class="cx-boq-head"><th colspan="5" scope="rowgroup"><span class="cx-boq-no">${String.fromCharCode(65 + (gi % 26))}${gi >= 26 ? Math.floor(gi / 26) : ''}</span>${esc(g.name)}</th></tr>
        ${g.lines.map(l => `<tr>
          <td class="cx-boq-desc">${esc(l.desc)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</td>
          <td class="u-num cx-r">${qtyFmt(l.qty, l.unit)}<small class="cx-qu">${esc(l.unit)}</small></td>
          <td class="cx-boq-unit cx-col-unit">${esc(l.unit)}</td>
          <td class="u-num cx-r">${fmtN(l.rate)}</td>
          <td class="u-num cx-r">${fmtN(l.amount)}</td></tr>`).join('')}
        <tr class="cx-boq-sub"><td colspan="2">Subtotal, ${esc(g.name)}</td><td class="cx-col-unit"></td><td></td><td class="u-num cx-r">${fmtN(g.subtotal)}</td></tr>
      </tbody>`).join('');
    return `
      <div class="cx-panel-head">
        <div><h3>Bill of quantities</h3><p>Amounts in naira. Materials include ${this.prefs.waste ?? 5}% waste; labour is on net quantities.</p></div>
        <div class="cx-panel-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-act="csv">${svg(IC.download, 15)}<span>CSV</span></button>
          <button type="button" class="btn btn-primary btn-sm" data-act="print">${svg(IC.print, 15)}<span>Print or save PDF</span></button>
        </div>
      </div>
      <div class="cx-table-wrap"><table class="cx-boq">
        <thead><tr><th scope="col">Description</th><th scope="col" class="cx-r">Qty</th><th scope="col" class="cx-col-unit">Unit</th><th scope="col" class="cx-r">Rate</th><th scope="col" class="cx-r">Amount</th></tr></thead>
        ${rows}
        <tfoot>
          <tr><td colspan="2">Subtotal</td><td class="cx-col-unit"></td><td></td><td class="u-num cx-r">${fmtN(r.subtotal)}</td></tr>
          <tr><td colspan="2">Contingency ${fmtN(r.contingencyPct, 1)}%</td><td class="cx-col-unit"></td><td></td><td class="u-num cx-r">${fmtN(r.contingency)}</td></tr>
          ${r.vatOn ? `<tr><td colspan="2">VAT 7.5%</td><td class="cx-col-unit"></td><td></td><td class="u-num cx-r">${fmtN(r.vat)}</td></tr>` : ''}
          <tr class="cx-boq-grand"><td colspan="2">Grand total</td><td class="cx-col-unit"></td><td></td><td class="u-num cx-r">${this.money(r.total)}</td></tr>
        </tfoot>
      </table></div>`;
  },

  /* ---------- shopping tab ---------- */

  shoppingView(r) {
    if (!r.shopping.length) return this.emptyTab('The shopping list collects what every element needs, in the units suppliers sell.');
    const groups = {};
    for (const s of r.shopping) (groups[s.group] ||= []).push(s);
    return `
      <div class="cx-panel-head">
        <div><h3>Shopping list</h3><p>Everything to order, added up across elements and rounded to what suppliers sell.</p></div>
        <div class="cx-panel-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-act="copy-list">${svg(IC.copy, 15)}<span>Copy</span></button>
          <button type="button" class="btn btn-primary btn-sm" data-act="print">${svg(IC.print, 15)}<span>Print</span></button>
        </div>
      </div>
      <div class="cx-shop">${Object.entries(groups).map(([g, items]) => `
        <section class="cx-shop-group">
          <h4>${esc(g)}</h4>
          <ul>${items.map(s => `<li class="${s.key === 'rebar' ? 'is-total' : ''}">
            <span class="cx-shop-qty u-num"><b>${qtyFmt(s.qty, s.unit)}</b> ${esc(s.unit)}</span>
            <span class="cx-shop-name">${esc(s.label)}${s.detail ? `<small>${esc(s.detail)}</small>` : ''}</span>
            <span class="cx-shop-cost u-num">${s.cost != null ? this.money(s.cost) : ''}</span>
          </li>`).join('')}</ul>
        </section>`).join('')}
      </div>
      <p class="cx-note">Costs here are materials only, at your rates. Sand and granite trips assume ${this.state.rates.trips.sand}-tonne and ${this.state.rates.trips.granite}-tonne tippers; change them on the Rates tab.</p>`;
  },

  /* ---------- rates tab ---------- */

  ratesView() {
    const rates = this.rates();
    const ov = this.state.rates.overrides;
    const base = E.resolveRates({}, this.prefs.region);
    const region = E.REGIONS[this.prefs.region]?.label || 'Lagos';
    const updated = this.state.rates.updatedAt ? new Date(this.state.rates.updatedAt) : new Date(E.RATES_DATE);
    const dateText = updated.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
      <div class="cx-panel-head">
        <div><h3>Rates</h3><p>Built-in rates are <strong>estimates</strong> for ${esc(region)}, 2026. Prices move month to month: check with your suppliers and type your own.</p></div>
        <div class="cx-panel-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-act="rates-export">${svg(IC.download, 15)}<span>Export</span></button>
          <label class="btn btn-secondary btn-sm cx-file">${svg(IC.upload, 15)}<span>Import</span><input type="file" accept="application/json,.json" data-act="rates-import"></label>
          <button type="button" class="btn btn-ghost btn-sm" data-act="rates-reset" ${Object.keys(ov).length ? '' : 'disabled'}>${svg(IC.reset, 15)}<span>Reset all</span></button>
        </div>
      </div>
      <div class="cx-rates-meta">
        <span><small>Rates last updated</small><strong>${esc(dateText)}</strong>${this.state.rates.updatedAt ? '' : ' <em>built-in</em>'}</span>
        <span><small>Region</small><strong>${esc(region)}</strong> <button type="button" class="cx-link" data-act="prefs">Change</button></span>
        <span class="cx-trips"><small>Tipper sizes</small>
          <label>Sand <input class="cx-in u-num" data-trip="sand" value="${this.state.rates.trips.sand}" inputmode="decimal"> t</label>
          <label>Granite <input class="cx-in u-num" data-trip="granite" value="${this.state.rates.trips.granite}" inputmode="decimal"> t</label>
        </span>
      </div>
      ${E.RATE_GROUPS.map(g => `
        <section class="cx-rate-group">
          <h4>${g.label}</h4>
          <div class="cx-rate-rows">${E.DEFAULT_RATES.filter(r => r.group === g.id).map(r => {
            const edited = ov[r.key] != null;
            return `<div class="cx-rate ${edited ? 'is-edited' : ''}">
              <label for="cx-rate-${r.key}"><span>${esc(r.label)}</span>${r.note ? `<small>${esc(r.note)}</small>` : ''}</label>
              <div class="cx-rate-in">
                <div class="cx-in-wrap is-prefix"><input id="cx-rate-${r.key}" class="cx-in u-num" data-rate="${r.key}" value="${rates[r.key]}" inputmode="decimal" autocomplete="off"><span class="cx-unit">₦</span></div>
                <span class="cx-rate-unit">per ${esc(r.unit)}</span>
                <button type="button" class="cx-ib ${edited ? '' : 'is-off'}" data-rate-reset="${r.key}" title="Back to ${fmtN(base[r.key])}" aria-label="Reset ${esc(r.label)}" ${edited ? '' : 'tabindex="-1" aria-hidden="true"'}>${svg(IC.reset, 14)}</button>
              </div>
            </div>`;
          }).join('')}</div>
        </section>`).join('')}`;
  },

  emptyTab(text) {
    return `<div class="cx-empty"><strong>Nothing to show yet</strong><p>${esc(text)}</p><button type="button" class="btn btn-secondary btn-sm" data-tab-go="elements">Add elements</button></div>`;
  },

  /* ---------- summary ---------- */

  renderSummary() {
    const r = this.last || this.result();
    const el = this.container.querySelector('.cx-summary');
    const active = el.contains(document.activeElement) ? document.activeElement : null;
    const keep = active?.dataset?.proj || active?.dataset?.act || null;
    const caret = active && active.tagName === 'INPUT' && active.type !== 'checkbox' ? [active.selectionStart, active.selectionEnd] : null;
    const draft = active && active.dataset?.proj === 'contingency' ? active.value : null;
    this.afterSummary = () => {
      if (!keep) return;
      const again = el.querySelector(`[data-proj="${keep}"], .cx-sum-actions [data-act="${keep}"]`);
      if (!again) return;
      if (draft != null) again.value = draft;
      again.focus({ preventScroll: true });
      if (caret) try { again.setSelectionRange(caret[0], caret[1]); } catch { /* not a text input */ }
    };
    const area = r.floorArea;
    const perUnit = this.ft() ? r.costPerM2 * FT2 : r.costPerM2;
    const matPct = r.subtotal > 0 ? r.materialsCost / r.subtotal * 100 : 0;
    const top = [...r.groups].sort((a, b) => b.subtotal - a.subtotal).slice(0, 4);
    const issues = r.issues.length;
    const bags = r.shopping.find(s => s.key === 'cement')?.qty || 0;
    const steel = r.shopping.find(s => s.key === 'rebar')?.qty || 0;
    const blocks = (r.shopping.find(s => s.key === 'block9')?.qty || 0) + (r.shopping.find(s => s.key === 'block6')?.qty || 0);
    el.innerHTML = `
      <div class="cx-sum-card">
        <small class="cx-sum-label">Estimated total</small>
        <div class="cx-sum-total u-num" data-sum-total>${this.money(r.total, { compact: false })}</div>
        <div class="cx-sum-per u-num">${area > 0 ? `${this.money(perUnit)} per ${this.ft() ? 'ft²' : 'm²'} · ${fmtN(this.ft() ? area / FT2 : area)} ${this.ft() ? 'ft²' : 'm²'}` : 'Add a slab or floor area for cost per m²'}</div>
        ${issues ? `<p class="cx-sum-issue">${svg(IC.alert, 14)}${issues} element${issues > 1 ? 's have' : ' has'} a value out of range</p>` : ''}
        <dl class="cx-sum-rows">
          <div class="cx-sum-detail"><dt>Materials</dt><dd class="u-num">${this.money(r.materialsCost)}</dd></div>
          <div class="cx-sum-detail"><dt>Labour</dt><dd class="u-num">${this.money(r.labourCost)}</dd></div>
          <div class="cx-sum-bar cx-sum-detail" aria-hidden="true"><i style="width:${matPct.toFixed(1)}%"></i></div>
          <div><dt>Subtotal</dt><dd class="u-num">${this.money(r.subtotal)}</dd></div>
          <div><dt><label for="cx-cont">Contingency</label></dt><dd><span class="cx-mini"><input id="cx-cont" class="u-num" data-proj="contingency" value="${r.contingencyPct}" inputmode="decimal" aria-label="Contingency percent">%</span> <span class="u-num">${this.money(r.contingency)}</span></dd></div>
          <div><dt><label class="cx-vat"><input type="checkbox" data-proj="vat" ${r.vatOn ? 'checked' : ''}><span class="cx-switch" aria-hidden="true"></span>VAT 7.5%</label></dt><dd class="u-num">${this.money(r.vat)}</dd></div>
        </dl>
        <div class="cx-sum-actions">
          <button type="button" class="btn btn-primary btn-sm" data-act="print">${svg(IC.print, 15)}<span>Print / PDF</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="csv">${svg(IC.download, 15)}<span>CSV</span></button>
        </div>
      </div>
      <div class="cx-sum-card cx-sum-quick">
        <div class="cx-kpis">
          <span><b class="u-num">${fmtN(bags)}</b><small>bags cement</small></span>
          <span><b class="u-num">${fmtN(steel, 2)}</b><small>t steel</small></span>
          <span><b class="u-num">${fmtN(blocks)}</b><small>blocks</small></span>
        </div>
        ${top.length ? `<h4>Largest sections</h4><ol class="cx-sum-top">${top.map(g => `<li><span>${esc(g.name)}</span><span class="u-num">${this.money(g.subtotal, { compact: true })}</span><i style="width:${r.subtotal ? (g.subtotal / r.subtotal * 100).toFixed(1) : 0}%"></i></li>`).join('')}</ol>` : ''}
        <p class="cx-sum-note">Rates are editable estimates, not quotes.</p>
      </div>`;
    this.afterSummary();
  },

  /* ---------- print sheet ---------- */

  renderSheet() {
    const r = this.result();
    const p = r.project;
    const sheet = this.container?.querySelector('.cx-sheet');
    if (!sheet) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const shopGroups = {};
    for (const s of r.shopping) (shopGroups[s.group] ||= []).push(s);
    sheet.innerHTML = `
      <header class="cxs-head">
        <div><h1>${esc(p.name)}</h1><p>Bill of quantities and cost estimate</p></div>
        <div class="cxs-badge"><span>Estimated total</span><strong>${this.money(r.total)}</strong><span>${date}</span></div>
      </header>
      <div class="cxs-parties">
        <div><h3>Client</h3><p>${esc(p.client || '—')}</p></div>
        <div><h3>Site</h3><p>${esc(p.site || '—')}</p></div>
        <div><h3>Floor area</h3><p>${r.floorArea > 0 ? `${fmtN(r.floorArea, 1)} m² · ${this.money(r.costPerM2)} per m²` : '—'}</p></div>
      </div>
      <table class="cxs-table">
        <thead><tr><th>Item</th><th>Description</th><th class="r">Qty</th><th>Unit</th><th class="r">Rate (₦)</th><th class="r">Amount (₦)</th></tr></thead>
        ${r.groups.map((g, gi) => `<tbody>
          <tr class="cxs-g"><td>${String.fromCharCode(65 + (gi % 26))}</td><td colspan="5">${esc(g.name)}</td></tr>
          ${g.lines.map((l, li) => `<tr><td>${String.fromCharCode(65 + (gi % 26))}${li + 1}</td><td>${esc(l.desc)}</td><td class="r">${qtyFmt(l.qty, l.unit)}</td><td>${esc(l.unit)}</td><td class="r">${fmtN(l.rate)}</td><td class="r">${fmtN(l.amount)}</td></tr>`).join('')}
          <tr class="cxs-sub"><td></td><td colspan="4">Subtotal</td><td class="r">${fmtN(g.subtotal)}</td></tr>
        </tbody>`).join('')}
      </table>
      <section class="cxs-totals">
        <div><span>Subtotal</span><span>${fmtN(r.subtotal)}</span></div>
        <div><span>Contingency ${fmtN(r.contingencyPct, 1)}%</span><span>${fmtN(r.contingency)}</span></div>
        ${r.vatOn ? `<div><span>VAT 7.5%</span><span>${fmtN(r.vat)}</span></div>` : ''}
        <div class="cxs-grand"><span>Grand total</span><span>${this.money(r.total)}</span></div>
      </section>
      <h2>Materials to order</h2>
      <table class="cxs-table cxs-shop">
        <thead><tr><th>Material</th><th class="r">Quantity</th><th>Unit</th><th>Detail</th></tr></thead>
        <tbody>${r.shopping.map(s => `<tr><td>${esc(s.label)}</td><td class="r">${qtyFmt(s.qty, s.unit)}</td><td>${esc(s.unit)}</td><td>${esc(s.detail)}</td></tr>`).join('')}</tbody>
      </table>
      <p class="cxs-foot">Estimate only, prepared with Toolbox. Quantities are measured from the dimensions given; materials include a ${this.prefs.waste ?? 5}% waste allowance and labour is priced on net quantities.
      Rates are ${this.state.rates.updatedAt ? 'as set by the estimator' : 'built-in 2026 market estimates'} and should be confirmed with suppliers. Structural sizes and reinforcement must follow the engineer's drawings.</p>`;
  },

  /* ---------------- events ---------------- */

  bind() {
    const root = this.container.querySelector('.cx');

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button, [data-act]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.tab) return this.setTab(t.dataset.tab);
      if (t.dataset.tabGo) return this.setTab(t.dataset.tabGo);
      if (t.dataset.add) return this.addElement(t.dataset.add);
      if (t.dataset.preset) return this.applyPreset(t.dataset.preset);
      if (t.dataset.elAct) return this.elementAction(t.closest('.cx-el')?.dataset.id, t.dataset.elAct);
      if (t.dataset.rateReset) return this.setRate(t.dataset.rateReset, null);
      if (t.dataset.load) return this.loadProject(t.dataset.load);
      if (t.dataset.remove) return this.removeSaved(t.dataset.remove);
      switch (t.dataset.act) {
        case 'projects': return this.toggleProjects();
        case 'new': return this.newProject();
        case 'save': return this.saveProject();
        case 'print': return this.print();
        case 'csv': return this.exportCsv();
        case 'copy-list': return this.copyList(t);
        case 'rates-export': return this.exportRates();
        case 'rates-reset': return this.resetRates();
        case 'prefs': return openSettings(`tool:${TOOL_ID}`);
        case 'dismiss': root.querySelector('.cx-notice').hidden = true; return undefined;
        default: return undefined;
      }
    });

    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('change', (e) => this.onChange(e));

    root.addEventListener('keydown', (e) => {
      const inField = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.saveProject(); return; }
      if (e.target.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const i = TABS.findIndex(t => t.id === this.state.tab);
        const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
        this.setTab(next);
        root.querySelector(`[role="tab"][data-tab="${next}"]`)?.focus();
        return;
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const card = e.target.closest('.cx-el');
        if (card) { e.preventDefault(); this.elementAction(card.dataset.id, e.key === 'ArrowUp' ? 'up' : 'down', e.target); }
        return;
      }
      if (!inField && !e.altKey && !e.ctrlKey && !e.metaKey && /^[1-4]$/.test(e.key)) { this.setTab(TABS[Number(e.key) - 1].id); return; }
      if (e.key === 'Escape') this.closeProjects();
    });

    this.onOutside = (e) => { if (!e.target.closest?.('.cx-menu')) this.closeProjects(); };
    document.addEventListener('pointerdown', this.onOutside, true);
  },

  onInput(e) {
    const t = e.target;
    const p = this.state.project;
    if (t.dataset.proj) {
      const k = t.dataset.proj;
      if (k === 'vat') return;
      if (k === 'gfa') p.gfa = Math.max(0, this.toMetric(parseFloat(t.value) || 0, 'm2'));
      else if (k === 'contingency') { const v = parseFloat(t.value); p.contingency = Number.isFinite(v) ? Math.min(50, Math.max(0, v)) : 0; }
      else p[k] = t.value;
      this.save();
      if (k === 'gfa' || k === 'contingency') this.recalc({ summaryOnly: this.state.tab !== 'boq' });
      return;
    }
    if (t.dataset.trip) {
      const v = parseFloat(t.value);
      if (Number.isFinite(v) && v > 0) { this.state.rates.trips[t.dataset.trip] = v; this.save(); this.recalc({ summaryOnly: true }); }
      return;
    }
    if (t.dataset.rate) {
      const v = parseFloat(String(t.value).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(v) && v >= 0) this.setRate(t.dataset.rate, v, { quiet: true });
      return;
    }
    const card = t.closest('.cx-el');
    if (!card) return;
    const el = p.elements.find(x => x.id === card.dataset.id);
    if (!el) return;
    if (t.dataset.name !== undefined) { el.name = t.value; this.save(); this.recalc({ summaryOnly: true }); return; }
    const k = t.dataset.k;
    if (!k || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    if (t.dataset.kind) {
      const raw = String(t.value).trim().replace(/,/g, '');
      el[k] = raw === '' ? '' : (Number.isFinite(Number(raw)) ? this.toMetric(Number(raw), t.dataset.kind) : raw);
    } else el[k] = t.value;
    this.save();
    this.recalc({ card });
  },

  onChange(e) {
    const t = e.target;
    const p = this.state.project;
    if (t.dataset.act === 'rates-import') return this.importRates(t);
    if (t.dataset.proj === 'vat') { p.vat = t.checked; this.save(); return this.recalc({ summaryOnly: this.state.tab !== 'boq' }); }
    if (t.dataset.rate) { t.value = this.rates()[t.dataset.rate]; return undefined; }
    const card = t.closest('.cx-el');
    if (!card) return undefined;
    const el = p.elements.find(x => x.id === card.dataset.id);
    if (!el || !t.dataset.k) return undefined;
    if (t.type === 'checkbox') el[t.dataset.k] = t.checked;
    else if (t.tagName === 'SELECT') el[t.dataset.k] = t.value;
    else return undefined;
    this.save();
    return this.recalc({ card });
  },

  /** Recompute; update one card in place (keeps focus), the summary, and the counts. */
  recalc({ card = null, summaryOnly = false } = {}) {
    clearTimeout(this.calcT);
    this.calcT = setTimeout(() => {
      if (!this.container) return;
      const r = this.result();
      this.last = r;
      if (card) {
        const i = this.state.project.elements.findIndex(x => x.id === card.dataset.id);
        const g = r.groups[i];
        if (g) {
          card.querySelector('[data-el-total]').textContent = this.money(g.subtotal);
          card.querySelector('[data-facts]').innerHTML = this.factsHtml(this.state.project.elements[i], g);
          card.classList.toggle('has-error', Object.keys(g.errors).length > 0);
          const def = E.ELEMENT_TYPES[g.type];
          for (const f of def.fields) {
            const input = card.querySelector(`[data-k="${f.key}"]`);
            const wrap = input?.closest('.cx-f');
            const msg = wrap?.querySelector('.cx-err');
            if (!input || !msg) continue;
            const err = g.errors[f.key];
            input.setAttribute('aria-invalid', err ? 'true' : 'false');
            if (err) input.setAttribute('aria-describedby', msg.id); else input.removeAttribute('aria-describedby');
            wrap.classList.toggle('is-invalid', Boolean(err));
            msg.textContent = err ? this.errText(err, f) : '';
          }
        }
      } else if (!summaryOnly) this.renderPanel();
      this.updateCounts(r);
      this.renderSummary();
      this.analytics?.completed?.({ resultCount: r.groups.length });
    }, card ? 90 : 0);
  },

  setTab(id) {
    if (!TABS.some(t => t.id === id)) return;
    this.state.tab = id;
    this.save();
    this.renderAll();
  },

  addElement(type) {
    const el = E.newElement(type);
    const same = this.state.project.elements.filter(x => x.type === type).length;
    if (same) el.name = `${el.name} ${same + 1}`;
    this.state.project.elements.push(el);
    this.save();
    this.renderPanel();
    this.renderSummary();
    const card = this.container.querySelector(`.cx-el[data-id="${el.id}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    card?.querySelector('.cx-in')?.focus({ preventScroll: true });
    card?.classList.add('is-new');
  },

  applyPreset(key) {
    const pr = E.PRESETS[key];
    if (!pr) return;
    const p = this.state.project;
    if (p.elements.length && !confirm(`Replace the ${p.elements.length} element${p.elements.length > 1 ? 's' : ''} in this project with "${pr.label}"?`)) return;
    p.elements = pr.make();
    if (p.name === 'New project') p.name = pr.label;
    this.save();
    this.renderAll();
    showToast(`Started from ${pr.label}. Adjust the dimensions to suit.`, 'success');
  },

  elementAction(id, act, focusEl = null) {
    const list = this.state.project.elements;
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    if (act === 'fold') {
      const c = this.state.collapsed;
      if (c.has(id)) c.delete(id); else c.add(id);
      this.save();
      const card = this.container.querySelector(`.cx-el[data-id="${id}"]`);
      card?.classList.toggle('is-collapsed', c.has(id));
      const b = card?.querySelector('[data-el-act="fold"]');
      b?.setAttribute('aria-expanded', String(!c.has(id)));
      return;
    }
    if (act === 'del') {
      const [removed] = list.splice(i, 1);
      this.save(); this.renderPanel(); this.renderSummary();
      const t = showToast(`Removed ${removed.name}.`, 'info', 5000);
      this.lastRemoved = { el: removed, at: i, toast: t };
      const next = this.container.querySelectorAll('.cx-el')[Math.min(i, list.length - 1)];
      next?.querySelector('.cx-el-name')?.focus({ preventScroll: true });
      return;
    }
    if (act === 'dup') {
      const copy = { ...structuredClone(list[i]), id: E.newElement(list[i].type).id, name: `${list[i].name} (copy)` };
      list.splice(i + 1, 0, copy);
    }
    if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    this.save(); this.renderPanel(); this.renderSummary();
    let key = `[data-el-act="${act}"]`;
    if (focusEl?.dataset?.k) key = `[data-k="${focusEl.dataset.k}"]`;
    else if (focusEl?.dataset?.name !== undefined && focusEl) key = '[data-name]';
    const target = act === 'dup' ? list[i + 1].id : id;
    const card = this.container.querySelector(`.cx-el[data-id="${target}"]`);
    (card?.querySelector(key) || card?.querySelector('.cx-el-name'))?.focus({ preventScroll: false });
  },

  /* ---------- rates ---------- */

  setRate(key, value, { quiet = false } = {}) {
    const ov = this.state.rates.overrides;
    const base = E.resolveRates({}, this.prefs.region)[key];
    if (value == null || value === base) delete ov[key]; else ov[key] = value;
    this.state.rates.updatedAt = Object.keys(ov).length ? new Date().toISOString() : null;
    this.save();
    if (quiet) {
      const row = this.container.querySelector(`[data-rate="${key}"]`)?.closest('.cx-rate');
      row?.classList.toggle('is-edited', ov[key] != null);
      const rb = row?.querySelector('[data-rate-reset]');
      if (rb) {
        const off = ov[key] == null;
        rb.classList.toggle('is-off', off);
        if (off) { rb.tabIndex = -1; rb.setAttribute('aria-hidden', 'true'); } else { rb.removeAttribute('tabindex'); rb.removeAttribute('aria-hidden'); }
      }
      this.recalc({ summaryOnly: true });
    } else { this.renderPanel(); this.renderSummary(); }
  },
  resetRates() {
    if (!confirm('Put every rate back to the built-in estimate?')) return;
    this.state.rates = { overrides: {}, trips: { ...E.DEFAULT_TRIPS }, updatedAt: null };
    this.save(); this.renderPanel(); this.renderSummary();
  },
  exportRates() {
    const data = { kind: 'toolbox-construction-rates', version: 1, currency: 'NGN', region: this.prefs.region, updatedAt: this.state.rates.updatedAt || E.RATES_DATE, trips: this.state.rates.trips, rates: this.rates() };
    download(`construction-rates-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  },
  async importRates(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const src = data.rates || data;
      const ov = {};
      for (const r of E.DEFAULT_RATES) { const v = Number(src[r.key]); if (Number.isFinite(v) && v >= 0) ov[r.key] = v; }
      if (!Object.keys(ov).length) throw new Error('no rates');
      const base = E.resolveRates({}, this.prefs.region);
      for (const k of Object.keys(ov)) if (ov[k] === base[k]) delete ov[k];
      this.state.rates.overrides = ov;
      if (data.trips) for (const k of ['sand', 'granite']) if (Number(data.trips[k]) > 0) this.state.rates.trips[k] = Number(data.trips[k]);
      this.state.rates.updatedAt = data.updatedAt && !Number.isNaN(Date.parse(data.updatedAt)) ? new Date(data.updatedAt).toISOString() : new Date().toISOString();
      this.save(); this.renderPanel(); this.renderSummary();
      showToast(`Imported ${Object.keys(ov).length} rates that differ from the built-in ones.`, 'success');
    } catch {
      showToast('That file is not a rates export.', 'error');
    }
  },

  /* ---------- projects ---------- */

  toggleProjects() {
    const pop = this.container.querySelector('.cx-pop');
    const btn = this.container.querySelector('[data-act="projects"]');
    if (!pop.hidden) return this.closeProjects();
    const saved = Object.entries(this.state.saved).sort((a, b) => String(b[1].savedAt).localeCompare(String(a[1].savedAt)));
    pop.innerHTML = `
      <button type="button" class="cx-pop-item" role="menuitem" data-act="new">${svg(IC.plus, 15)}<span>New blank project</span></button>
      ${saved.length ? `<div class="cx-pop-sep"></div><div class="cx-pop-title">Saved on this device</div>` : '<p class="cx-pop-empty">Saved projects appear here.</p>'}
      ${saved.map(([name, s]) => `<div class="cx-pop-row">
        <button type="button" class="cx-pop-item" role="menuitem" data-load="${esc(name)}"><span>${esc(name)}<small>${s.project?.elements?.length || 0} elements · ${new Date(s.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span></button>
        <button type="button" class="cx-ib cx-ib-danger" data-remove="${esc(name)}" aria-label="Delete ${esc(name)}">${svg(IC.trash, 14)}</button>
      </div>`).join('')}`;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    pop.querySelector('.cx-pop-item')?.focus();
    return undefined;
  },
  closeProjects() {
    const pop = this.container?.querySelector('.cx-pop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    this.container.querySelector('[data-act="projects"]')?.setAttribute('aria-expanded', 'false');
  },
  saveProject() {
    const p = this.state.project;
    const name = (p.name || '').trim() || 'Untitled project';
    p.name = name;
    this.state.saved[name] = { project: structuredClone(p), savedAt: new Date().toISOString() };
    this.save();
    showToast(`Saved "${name}" on this device.`, 'success');
  },
  loadProject(name) {
    const s = this.state.saved[name];
    if (!s) return;
    this.state.project = E.normaliseProject(structuredClone(s.project));
    this.closeProjects();
    this.save(); this.renderAll();
    showToast(`Opened "${name}".`, 'info');
  },
  removeSaved(name) {
    if (!confirm(`Delete the saved project "${name}"?`)) return;
    delete this.state.saved[name];
    this.save();
    this.closeProjects();
    this.toggleProjects();
  },
  newProject() {
    const p = this.state.project;
    if (p.elements.length && !this.state.saved[p.name] && !confirm('Start a new project? The current one is not saved.')) return;
    this.state.project = E.normaliseProject(blankProject());
    this.closeProjects();
    this.save(); this.setTab('elements');
  },

  /* ---------- export ---------- */

  print() {
    this.renderSheet();
    window.print();
  },
  exportCsv() {
    const r = this.result();
    const slug = r.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estimate';
    download(`${slug}-boq.csv`, '﻿' + E.toCSV(r), 'text/csv;charset=utf-8');
  },
  copyList(btn) {
    const r = this.result();
    const text = `${r.project.name} — materials\n` + r.shopping.map(s => `${qtyFmt(s.qty, s.unit)} ${s.unit}  ${s.label}${s.detail ? ` (${s.detail})` : ''}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      const span = btn.querySelector('span'); const prev = span.textContent; span.textContent = 'Copied';
      setTimeout(() => { span.textContent = prev; }, 1400);
    }).catch(() => showToast('Could not copy.', 'error'));
  },
};

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
