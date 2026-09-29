import { tbAlert, tbConfirm } from '../lib/dialog.js';
/* ============================================================
   Container Builder

   One app window: a parts library on the left, the 3D site in the
   middle, an inspector on the right and a status bar with the live
   price. Build with any number of containers and cabins, side by side
   or stacked, then specify, price and print the quotation.

   Interaction: click to select, drag a selected part or unit to move
   it (units snap to each other's edges), right-click or long-press
   anywhere for actions, Delete / R / Ctrl+D / arrows on the keyboard.

   The parts, presets and construction notes live in
   js/lib/container-library.js; pricing in container-catalog.js and
   container-quote.js. Styles live in css/container-builder.css.
   ============================================================ */

import { money, num, parseNum, escapeHtml, downloadCSV } from '../lib/biz.js';
import {
  SERVICES, LOGISTICS, UNITS, COMMERCIAL_DEFAULTS, RATES_REVISED,
  defaultRateBook, elementsWith, CUSTOM_TARGETS,
} from '../lib/container-catalog.js';
import { buildQuote, groupLines } from '../lib/container-quote.js';
import {
  PARTS, PART, CATEGORIES, UNIT_TYPES, UNIT_TYPE, WALLS, SHELL_COLORS, PRESETS, PRESET,
  extOf, unitRect, layoutUnits, partNotes,
} from '../lib/container-library.js';
import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
import { icon } from '../lib/icons.js';

const M_PER_FT = 0.3048;
const LS_RATES = 'toolbox.container.rates';
const LS_COMPANY = 'toolbox.container.company';
const LS_MATERIALS = 'toolbox.container.materials';
const LS_PROJECT = 'toolbox.container.project';
const LS_UI = 'toolbox.container.ui';
const HANDOFF_KEY = 'toolbox.container.handoff';

const DEFAULT_SPEC = {
  shell: 'buy-20', prep: 'full', exterior: 'paint', insulation: 'pu25', framing: 'steel40', interior: 'ply9',
  ceiling: 'pvc', floor: 'vinyl', subfloor: 'marine18', paint: 'emulsion', glazing: 'standard', roofing: 'coating', foundation: 'pads',
};

/* ---------------- formatting ---------------- */

function fmtLen(metres, unit) {
  if (unit === 'm') return `${metres.toFixed(2)} m`;
  const totalIn = metres / M_PER_FT * 12;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1} ft` : inch ? `${ft} ft ${inch} in` : `${ft} ft`;
}
const fmtArea = (m2, u) => u === 'm' ? `${m2.toFixed(1)} m²` : `${(m2 * 10.7639).toFixed(0)} sq ft`;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const hexOf = (id) => (SHELL_COLORS.find(c => c.id === id) || SHELL_COLORS[0]).hex;
const cssHex = (h) => `#${h.toString(16).padStart(6, '0')}`;

/* ---------------- icons ---------------- */

const ic = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  insp: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  box: '<path d="M3 8 12 3l9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  stack: '<path d="M4 15h16v5H4zM4 8h16v5H4z"/>',
  roof: '<path d="M3 11 12 4l9 7"/><path d="M6 10v9h12v-9"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  plan: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h8V4M12 12v8"/>',
  cube3: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  warn: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  place: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  wall: '<path d="M4 20V6l8-3 8 3v14"/><path d="M4 12h16"/>',
};

/* Tiny plan of a preset for the gallery: units as rectangles, upper levels darker. */
function presetPlanSvg(p) {
  const units = p.units.map((u, i) => ({ ...u, id: `p${i}` }));
  const rects = units.map(u => ({ ...unitRect(u), level: u.level || 0 }));
  const site = (p.site || []).map(s => { const pt = PART[s.type] || {}; const w = s.w ?? pt.w ?? 1, d = s.d ?? pt.d ?? 1; const [dx, dz] = (s.rot || 0) % 2 ? [d, w] : [w, d]; return { x0: s.x - dx / 2, x1: s.x + dx / 2, z0: s.z - dz / 2, z1: s.z + dz / 2 }; });
  const all = [...rects, ...site];
  const x0 = Math.min(...all.map(r => r.x0)), x1 = Math.max(...all.map(r => r.x1)), z0 = Math.min(...all.map(r => r.z0)), z1 = Math.max(...all.map(r => r.z1));
  const W = 160, H = 96, pad = 8, s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
  const ox = (W - (x1 - x0) * s) / 2, oz = (H - (z1 - z0) * s) / 2;
  const R = (r, cls) => `<rect class="${cls}" x="${(ox + (r.x0 - x0) * s).toFixed(1)}" y="${(oz + (r.z0 - z0) * s).toFixed(1)}" width="${((r.x1 - r.x0) * s).toFixed(1)}" height="${((r.z1 - r.z0) * s).toFixed(1)}" rx="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="cb-plan-svg" aria-hidden="true">${site.map(r => R(r, 'cb-plan-site')).join('')}${rects.sort((a, b) => a.level - b.level).map(r => R(r, `cb-plan-u cb-plan-l${Math.min(r.level, 2)}`)).join('')}</svg>`;
}

/* ============================================================ */

export default {
  async render(container) {
    this._alive = true;
    container.innerHTML = `<div class="cb-loading"><div class="cb-spinner"></div><p>Getting the builder ready…</p></div>`;

    let THREE, Viewer3D, buildUnit, placeOnWall, material, FLOOR_DEPTH, ROOF_DEPTH, checkStructure, partModel, planSize;
    try {
      [{ Viewer3D, THREE }, { buildUnit, placeOnWall }, { material }, { FLOOR_DEPTH, ROOF_DEPTH, checkStructure }, { partModel, planSize }] = await Promise.all([
        import('../lib/viewer3d.js'),
        import('../lib/container-mesh.js'),
        import('../lib/render-materials.js'),
        import('../lib/container-structure.js'),
        import('../lib/container-parts.js'),
      ]);
    } catch (err) {
      container.innerHTML = `<div class="no-results"><p class="no-results-title">Could not start the 3D view</p><p class="no-results-text">${escapeHtml(err.message)}</p></div>`;
      return;
    }
    if (!this._alive) return;

    /* ---------------- state ---------------- */

    const saved = (key, fallback) => {
      try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...fallback }; }
    };
    const loadJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };

    const state = {
      name: 'Untitled build',
      units: [], site: [], nextKey: 1, nextUnit: 1,
      sel: null,
      unit: 'ft', currency: 'NGN', showRoof: true, level: 'all',
      spec: { ...DEFAULT_SPEC },
      services: {}, logistics: {}, overrides: {}, removed: [], customLines: [],
      customMaterials: loadJSON(LS_MATERIALS, []),
      commercial: { ...COMMERCIAL_DEFAULTS, discount: 0 },
      company: (() => {
        const res = saved(LS_COMPANY, {
          name: '', address: '', phone: '', email: '', regNo: '', client: '', clientAddress: '',
          quoteNo: `Q-${new Date().getFullYear()}-001`, date: today(), scope: '',
          terms: 'Prices valid for 30 days. 70% deposit on order, balance on delivery.\nLead time 3–4 weeks from receipt of deposit.\nPrices subject to change if material costs move before order confirmation.',
        });
        return res;
      })(),
      rates: saved(LS_RATES, {}),
      tab: 'design',
      placeAt: null,
      clipboard: null,
    };
    const ui = saved(LS_UI, { side: 'open', insp: 'open' });

    /* ---------------- model helpers ---------------- */

    const U = (id) => state.units.find(u => u.id === id);
    const wallSpan = (u, wall) => (wall === 'front' || wall === 'back') ? u.wid : u.len;
    const unitName = (u) => u.name || `${UNIT_TYPE[u.preset]?.name || 'Unit'}`;
    const levelName = (L) => L === 0 ? 'Ground' : `Level ${L}`;

    function mkUnit(preset, cx = 0, cz = 0, o = {}) {
      const t = UNIT_TYPE[preset] || UNIT_TYPE['20ft'];
      return { id: `u${state.nextUnit++}`, name: '', preset: t.id, len: t.len, wid: t.wid, hgt: t.hgt, cx, cz, rot: 0, level: 0, color: 'green', items: [], ...o };
    }

    /** Fill a placed part's size and position from the library, clamped to its unit. */
    function prepItem(raw, u) {
      const p = PART[raw.type];
      const it = { ...raw, key: state.nextKey++ };
      if (!p) return it;
      if (it.kind === 'opening' || it.kind === 'facade') {
        it.wall = WALLS.some(w => w.id === it.wall) ? it.wall : 'left';
        const span = wallSpan(u, it.wall);
        it.w = clamp(it.w ?? p.w, 0.1, span - 0.1);
        it.h = clamp(it.h ?? p.h, 0.05, it.kind === 'facade' ? u.hgt + 0.4 : u.hgt - 0.02);
        it.sill = clamp(it.sill ?? p.sill ?? 0, it.kind === 'facade' ? -0.2 : 0, Math.max(0, u.hgt - (it.kind === 'facade' ? 0.1 : it.h)));
        it.along = clamp(it.along ?? span / 2, it.w / 2, span - it.w / 2);
        if (p.proj && it.proj == null) it.proj = p.proj;
      } else if (it.kind === 'fitting') {
        it.w = it.w ?? p.w; it.d = it.d ?? p.d; it.h = it.h ?? p.h; it.rot = ((Number(it.rot) || 0) % 4 + 4) % 4;
        if (p.deck && it.deck == null) it.deck = p.deck;
        if (p.stair && it.type !== 'spiral-in' && raw.h == null) it.h = Math.min(it.h, u.hgt - 0.05);
        const { dx, dz } = planSize(it);
        it.x = clamp(it.x ?? u.len / 2, Math.min(dx / 2, u.len / 2), Math.max(u.len - dx / 2, u.len / 2));
        it.z = clamp(it.z ?? u.wid / 2, Math.min(dz / 2, u.wid / 2), Math.max(u.wid - dz / 2, u.wid / 2));
      } else if (it.kind === 'roof') {
        const e = extOf(u);
        it.w = Math.min(it.w ?? p.w, p.cover ? e.len + 0.6 : e.len); it.d = Math.min(it.d ?? p.d, p.cover ? e.wid + 0.6 : e.wid);
        if (p.h && it.h == null) it.h = p.h;
        it.x = clamp(it.x ?? u.len / 2, -0.5, u.len + 0.5); it.z = clamp(it.z ?? u.wid / 2, -0.5, u.wid + 0.5);
      }
      return it;
    }
    function prepSite(raw) {
      const p = PART[raw.type] || {};
      return { ...raw, kind: 'site', key: state.nextKey++, w: raw.w ?? p.w, d: raw.d ?? p.d, h: raw.h ?? p.h, rot: ((Number(raw.rot) || 0) % 4 + 4) % 4, x: raw.x ?? 0, z: raw.z ?? 0 };
    }

    function loadPreset(p) {
      state.units = []; state.site = [];
      for (const pu of p.units) {
        const u = mkUnit(pu.preset, pu.cx, pu.cz, { rot: pu.rot || 0, level: pu.level || 0, color: pu.color || 'green', name: pu.name || '' });
        u.items = (pu.items || []).map(it => prepItem(it, u));
        state.units.push(u);
      }
      state.site = (p.site || []).map(prepSite);
      state.name = p.name;
      state.sel = null;
      state.showRoof = true;
      state.level = 'all';
      if (!['buy-20', 'new-20', 'client'].includes(state.spec.shell)) state.spec.shell = 'buy-20';
      state.overrides = {}; state.removed = [];
    }

    /* ---------------- persistence ---------------- */

    const PROJECT_FIELDS = ['name', 'units', 'site', 'nextKey', 'nextUnit', 'unit', 'currency', 'spec', 'services', 'logistics', 'overrides', 'removed', 'customLines', 'commercial', 'showRoof'];
    let saveTimer = null;
    const persist = () => {
      try {
        localStorage.setItem(LS_RATES, JSON.stringify(state.rates));
        localStorage.setItem(LS_COMPANY, JSON.stringify(state.company));
        localStorage.setItem(LS_MATERIALS, JSON.stringify(state.customMaterials));
      } catch { /* private mode */ }
    };
    const saveProject = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { localStorage.setItem(LS_PROJECT, JSON.stringify(Object.fromEntries(PROJECT_FIELDS.map(k => [k, state[k]])))); } catch { /* storage full */ }
      }, 400);
    };
    const saveUi = () => { try { localStorage.setItem(LS_UI, JSON.stringify(ui)); } catch { /* ignore */ } };

    // Start from: an Assistant hand-off, else the last project, else the 20 ft studio.
    let handoff = null;
    try { handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || sessionStorage.getItem(HANDOFF_KEY) || 'null'); localStorage.removeItem(HANDOFF_KEY); sessionStorage.removeItem(HANDOFF_KEY); } catch { handoff = null; }
    const project = loadJSON(LS_PROJECT, null);
    if (handoff && (Array.isArray(handoff.units) || Array.isArray(handoff.items))) {
      const hu = Array.isArray(handoff.units) && handoff.units.length ? handoff.units : [{ preset: handoff.preset, len: handoff.len, wid: handoff.wid, hgt: handoff.hgt, cx: 0, cz: 0, color: handoff.color, items: handoff.items }];
      for (const h of hu) {
        const u = mkUnit(UNIT_TYPE[h.preset] ? h.preset : '20ft', h.cx || 0, h.cz || 0, { rot: h.rot || 0, level: h.level || 0, color: SHELL_COLORS.some(c => c.id === h.color) ? h.color : 'green', name: h.name || '' });
        if (!UNIT_TYPE[h.preset] && h.len > 0) Object.assign(u, { preset: 'custom', len: h.len, wid: h.wid, hgt: h.hgt });
        u.items = (h.items || []).filter(it => PART[it.type] && ['opening', 'fitting', 'facade', 'roof'].includes(it.kind)).map(it => prepItem(it, u));
        state.units.push(u);
      }
      state.site = (handoff.site || []).filter(s => PART[s.type]).map(prepSite);
      state.name = (Array.isArray(handoff.units) ? String(handoff.name || '').split(' · ')[0] : handoff.name) || 'From the Assistant';
      state.spec = { ...state.spec, ...(handoff.spec || {}) };
    } else if (project && Array.isArray(project.units) && project.units.length) {
      for (const k of PROJECT_FIELDS) if (project[k] !== undefined) state[k] = project[k];
      state.spec = { ...DEFAULT_SPEC, ...state.spec };
      state.spec.shell = state.spec.shell === 'client' ? 'client' : String(state.spec.shell).startsWith('new-') ? 'new-20' : 'buy-20';
      state.commercial = { ...COMMERCIAL_DEFAULTS, discount: 0, ...state.commercial };
    } else {
      loadPreset(PRESET.studio20);
    }

    /* ---------------- markup ---------------- */

    const cats = CATEGORIES.map(c => ({ ...c, parts: PARTS.filter(p => p.cat === c.id) }));
    const sizeLabel = (p) => p.kind === 'site' || p.kind === 'roof' || (p.kind === 'fitting' && !p.isWall)
      ? `${p.w} × ${p.d} m` : p.isWall ? 'wall' : `${p.w} × ${p.h} m`;

    container.innerHTML = `
      <div class="cb" data-side="${ui.side}" data-insp="${ui.insp}" data-tab="design" data-narrow="false" tabindex="-1">
        <aside class="cb-side" aria-label="Parts library">
          <div class="cb-side-head">
            <div class="cb-search">${ic(I.search, 14)}<input type="search" id="cb-search" placeholder="Search parts" autocomplete="off" aria-label="Search parts"><kbd>/</kbd></div>
            <button type="button" class="btn btn-secondary btn-sm cb-presets-btn" data-act="presets">${ic(I.grid, 14)}<span>Designs</span></button>
          </div>
          <div class="cb-place" id="cb-place" hidden></div>
          <div class="cb-units-add">
            <span class="cb-lib-h">Add a unit</span>
            <div class="cb-unit-chips">
              ${['20ft', '40ft', '40hc', 'pc20'].map(id => `<button type="button" class="cb-chip" data-add-unit="${id}">${ic(I.plus, 12)}${escapeHtml(UNIT_TYPE[id].name.replace(' container', ''))}</button>`).join('')}
            </div>
          </div>
          <div class="cb-lib" id="cb-lib">
            ${cats.map(c => `
              <details class="cb-cat" data-cat="${c.id}" ${['doors', 'glazing'].includes(c.id) ? 'open' : ''}>
                <summary><span>${escapeHtml(c.name)}</span><span class="cb-count">${c.parts.length}</span></summary>
                <div class="cb-parts">
                  ${c.parts.map(p => `<button type="button" class="cb-part" data-part="${p.id}" draggable="true" title="${escapeHtml(p.spec || p.name)}">
                    <span class="cb-part-name">${escapeHtml(p.name)}</span><span class="cb-part-size">${sizeLabel(p)}</span></button>`).join('')}
                </div>
              </details>`).join('')}
            <p class="cb-empty" id="cb-lib-empty" hidden>No parts match.</p>
          </div>
        </aside>
        <div class="cb-scrim" data-act="close-drawers"></div>

        <section class="cb-main">
          <header class="cb-bar">
            <button type="button" class="cb-icon-btn cb-side-toggle" data-act="toggle-side" aria-label="Parts library" title="Parts library">${ic(I.side)}</button>
            <input class="cb-title" id="cb-name" value="${escapeHtml(state.name)}" aria-label="Build name" spellcheck="false">
            <div class="cb-tabs" role="tablist">
              ${[['design', 'Design'], ['spec', 'Specification'], ['quote', 'Quote'], ['rates', 'Rates']].map(([id, n]) => `<button type="button" role="tab" class="cb-tab${id === 'design' ? ' is-active' : ''}" data-tab="${id}" aria-selected="${id === 'design'}">${n}</button>`).join('')}
            </div>
            <div class="cb-bar-right">
              <button type="button" class="cb-icon-btn" data-act="undo" aria-label="Undo" title="Undo (Ctrl+Z)">${ic(I.undo)}</button>
              <button type="button" class="cb-icon-btn" data-act="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${ic(I.redo)}</button>
              <button type="button" class="cb-icon-btn cb-insp-toggle" data-act="toggle-insp" aria-label="Inspector" title="Inspector">${ic(I.insp)}</button>
              <button type="button" class="cb-icon-btn" data-act="more" aria-label="More" title="More">${ic(I.more)}</button>
            </div>
          </header>

          <div class="cb-body">
            <div class="cb-panel cb-design" data-panel="design">
              <div class="cb-stage">
                <div class="cb-canvas" id="cb-canvas"></div>
                <div class="cb-float cb-float-left">
                  <div class="cb-seg" id="cb-levels" role="group" aria-label="Levels"></div>
                  <button type="button" class="cb-pill" data-act="roof" aria-pressed="true">${ic(I.roof, 14)}<span>Roof</span></button>
                </div>
                <div class="cb-float cb-float-right">
                  <div class="cb-seg" id="cb-views" role="group" aria-label="View">
                    <button type="button" class="is-active" data-view="iso" title="3D view (1)">${ic(I.cube3, 14)}<span>3D</span></button>
                    <button type="button" data-view="top" title="Plan (2)">${ic(I.plan, 14)}<span>Plan</span></button>
                    <button type="button" data-view="front" title="Front (3)"><span>Front</span></button>
                    <button type="button" data-view="left" title="Side (4)"><span>Side</span></button>
                  </div>
                  <button type="button" class="cb-pill cb-pill-icon" data-act="fit" title="Fit view (F)" aria-label="Fit view">${ic(I.fit, 14)}</button>
                </div>
                <div class="cb-toast" id="cb-toast" role="status" aria-live="polite"></div>
              </div>
              <aside class="cb-insp" id="cb-insp" aria-label="Inspector">
                <div class="cb-insp-grab" data-act="sheet"><span></span></div>
                <div class="cb-insp-body" id="cb-insp-body"></div>
              </aside>
            </div>

            <!-- ============ SPECIFICATION ============ -->
            <div class="cb-panel cb-scroll" data-panel="spec" hidden>
              <div class="cq-spec">
                <div>
                  <h3 class="cq-h">Build-up</h3>
                  <p class="biz-hint">Choose what each part is made from. Quantities come off the model automatically, across every unit.</p>
                  <div id="cq-elements"></div>
                </div>
                <div>
                  <h3 class="cq-h">Services &amp; installations</h3>
                  <p class="biz-hint">Suggested from the floor area. Change any figure to suit the job.</p>
                  <div id="cq-services"></div>
                  <h3 class="cq-h" style="margin-top:28px;">Logistics</h3>
                  <div id="cq-logistics"></div>
                </div>
              </div>
              <div id="cq-takeoff" class="cq-takeoff"></div>
            </div>

            <!-- ============ QUOTE ============ -->
            <div class="cb-panel cb-scroll" data-panel="quote" hidden>
              <div class="cq-meta">
                <div class="biz-field"><label class="tool-label" for="cq-currency">Currency</label>
                  <select class="tool-select" id="cq-currency">
                    <option value="NGN">NGN — Nigerian Naira (₦)</option><option value="USD">USD — US Dollar ($)</option>
                    <option value="GBP">GBP — British Pound (£)</option><option value="EUR">EUR — Euro (€)</option>
                    <option value="GHS">GHS — Ghanaian Cedi (₵)</option><option value="ZAR">ZAR — South African Rand (R)</option>
                  </select></div>
                <div class="biz-field"><label class="tool-label" for="cq-quoteno">Quote number</label><input type="text" class="tool-input" id="cq-quoteno"></div>
                <div class="biz-field"><label class="tool-label" for="cq-date">Date</label><input type="date" class="tool-input" id="cq-date"></div>
                <div class="biz-field"><label class="tool-label" for="cq-client">Client</label><input type="text" class="tool-input" id="cq-client" placeholder="Client name"></div>
              </div>
              <div id="cq-lines"></div>
              <div class="cq-bottom">
                <div class="cq-commercial">
                  <h3 class="cq-h">Mark-ups</h3>
                  <div class="cq-comm-grid">
                    <label class="cb-field"><span>Overheads %</span><input type="number" class="tool-input" data-comm="overheadPct" step="0.5" min="0"></label>
                    <label class="cb-field"><span>Contingency %</span><input type="number" class="tool-input" data-comm="contingencyPct" step="0.5" min="0"></label>
                    <label class="cb-field"><span>Profit %</span><input type="number" class="tool-input" data-comm="profitPct" step="0.5" min="0"></label>
                    <label class="cb-field"><span>VAT %</span><input type="number" class="tool-input" data-comm="vatPct" step="0.5" min="0"></label>
                    <label class="cb-field"><span>Discount</span><input type="number" class="tool-input" data-comm="discount" step="1000" min="0"></label>
                  </div>
                  <div class="tool-controls" style="margin-top:16px;">
                    <button class="btn btn-secondary btn-sm" id="cq-add-line">Add a line</button>
                    <button class="btn btn-secondary btn-sm" id="cq-csv">Download CSV</button>
                    <button class="btn btn-primary btn-sm" id="cq-print">Print / save as PDF</button>
                  </div>
                </div>
                <div class="cq-totals" id="cq-totals"></div>
              </div>
              <details class="cq-details">
                <summary>Company &amp; terms shown on the printed quote</summary>
                <div class="cq-company-grid">
                  <div class="biz-field"><label class="tool-label" for="co-name">Your company</label><input type="text" class="tool-input" id="co-name"></div>
                  <div class="biz-field"><label class="tool-label" for="co-phone">Phone</label><input type="text" class="tool-input" id="co-phone"></div>
                  <div class="biz-field"><label class="tool-label" for="co-email">Email</label><input type="text" class="tool-input" id="co-email"></div>
                  <div class="biz-field"><label class="tool-label" for="co-regno">RC / VAT number</label><input type="text" class="tool-input" id="co-regno"></div>
                  <div class="biz-field cq-wide"><label class="tool-label" for="co-address">Your address</label><input type="text" class="tool-input" id="co-address"></div>
                  <div class="biz-field cq-wide"><label class="tool-label" for="co-clientaddress">Client address</label><input type="text" class="tool-input" id="co-clientaddress"></div>
                  <div class="biz-field cq-wide"><label class="tool-label" for="co-scope">Scope of works</label><textarea class="tool-textarea" id="co-scope" rows="2"></textarea></div>
                  <div class="biz-field cq-wide"><label class="tool-label" for="co-terms">Terms</label><textarea class="tool-textarea" id="co-terms" rows="4"></textarea></div>
                </div>
              </details>
            </div>

            <!-- ============ RATES ============ -->
            <div class="cb-panel cb-scroll" data-panel="rates" hidden>
              <div class="cq-rates-head">
                <div>
                  <h3 class="cq-h">Rate book</h3>
                  <p class="biz-hint">Seed rates were last reviewed <strong>${fmtDate(RATES_REVISED)}</strong>. Prices move — edit anything here and it is saved in this browser. Export the file to back it up or share it.</p>
                </div>
                <div class="tool-controls">
                  <button class="btn btn-secondary btn-sm" id="cq-rates-export">Export rates</button>
                  <button class="btn btn-secondary btn-sm" id="cq-rates-import">Import rates</button>
                  <button class="btn btn-secondary btn-sm" id="cq-rates-reset">Reset to defaults</button>
                  <input type="file" id="cq-rates-file" accept="application/json" hidden>
                </div>
              </div>
              <div class="cq-materials">
                <div class="cq-mat-head">
                  <div>
                    <h3 class="cq-h">Your own materials</h3>
                    <p class="biz-hint">Anything the catalogue does not carry. Added materials show up in the specification dropdowns and price like any other.</p>
                  </div>
                  <button class="btn btn-primary btn-sm" id="cq-mat-add">Add a material</button>
                </div>
                <form class="cq-mat-form" id="cq-mat-form" hidden>
                  <div class="cq-mat-grid">
                    <label class="cb-field"><span>What is it called?</span><input type="text" class="tool-input" id="mat-name" placeholder="e.g. 18 mm birch ply" required></label>
                    <label class="cb-field"><span>Where does it go?</span><select class="tool-select" id="mat-element">${CUSTOM_TARGETS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></label>
                    <label class="cb-field"><span>Sold by</span><select class="tool-select" id="mat-unit">${Object.entries(UNITS).map(([k, v]) => `<option value="${k}"${k === 'area' ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
                    <label class="cb-field" id="mat-cov-wrap" hidden><span>Covers (m² per sheet)</span><input type="number" class="tool-input" id="mat-coverage" value="2.98" step="0.01" min="0.01"></label>
                    <label class="cb-field"><span>Material cost per unit</span><input type="number" class="tool-input" id="mat-rate" value="0" min="0" step="100"></label>
                    <label class="cb-field"><span>Labour per unit</span><input type="number" class="tool-input" id="mat-labour" value="0" min="0" step="100"></label>
                    <label class="cb-field"><span>Wastage %</span><input type="number" class="tool-input" id="mat-wastage" value="10" min="0" max="60" step="1"></label>
                  </div>
                  <div class="tool-controls">
                    <button type="submit" class="btn btn-primary btn-sm">Save material</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="cq-mat-cancel">Cancel</button>
                  </div>
                </form>
                <div id="cq-mat-list"></div>
              </div>
              <h3 class="cq-h" style="margin-top:34px;">Catalogue rates</h3>
              <input type="text" class="tool-input" id="cq-rates-filter" placeholder="Filter rates…" style="max-width:340px; margin:10px 0 16px;">
              <div id="cq-rates-table"></div>
            </div>
          </div>

          <footer class="cb-status">
            <span class="cb-status-sel" id="cb-status-sel"></span>
            <span class="cb-status-stats" id="cb-status-stats"></span>
            <button type="button" class="cb-status-total" id="cb-status-total" data-tab="quote" title="Open the quote"></button>
          </footer>
        </section>

        <div class="cb-modal" id="cb-modal" hidden></div>
      </div>
      <div class="cq-sheet" id="cq-sheet" aria-hidden="true"></div>`;

    const root = container.querySelector('.cb');
    const $ = (s) => root.querySelector(s);
    const toastEl = $('#cb-toast');
    let toastTimer = null;
    const toast = (msg) => {
      toastEl.textContent = msg; toastEl.classList.add('is-on');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
    };

    /* ---------------- 3D scene ---------------- */

    const mount = $('#cb-canvas');
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const viewer = new Viewer3D(mount, { realism: true, environment: 'outdoor', dark, ground: true, grid: true, groundSize: 60, fov: 40, renderOnDemand: true });
    this._viewer = viewer;
    viewer.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    const PAD_H = 0.1;
    const BASE = FLOOR_DEPTH + PAD_H;            // world y of a ground-floor unit's internal floor
    const scene = new THREE.Group();
    viewer.scene.add(scene);
    let layout = new Map();
    const unitGroups = new Map();
    const objByRef = new Map();                 // "item:u1:5" | "site:7" | "unit:u1" → Object3D
    const refKey = (ref) => ref ? (ref.t === 'item' ? `item:${ref.id}:${ref.key}` : ref.t === 'site' ? `site:${ref.key}` : `unit:${ref.id}`) : '';

    function disposeTree(g) {
      g.traverse(n => { if (n.isMesh) n.geometry?.dispose(); });
    }
    const topLevel = () => Math.max(0, ...state.units.map(u => u.level || 0));
    const specOf = (u) => ({ size: u.preset, len: u.len, wid: u.wid, hgt: u.hgt });

    // Built units are cached by everything that shapes them, so an edit
    // rebuilds only the unit that changed (the costly part on a phone).
    let unitCache = new Map();
    function rebuild() {
      const keep = new Set();
      // Clear highlights first: cached models are reused and must come back clean.
      suppressSelect = true; viewer.select(null); viewer._setHovered?.(null); suppressSelect = false;
      const cachedGroups = new Set([...unitCache.values()].map(v => v.group));
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const c = scene.children[i];
        if (!cachedGroups.has(c)) disposeTree(c);
        scene.remove(c);
      }
      viewer.pickables.length = 0;
      viewer._pickRootMap = new WeakMap();
      unitGroups.clear(); objByRef.clear();
      layout = layoutUnits(state.units);
      const lined = state.spec.interior && state.spec.interior !== 'none';
      const maxL = state.level === 'all' ? Infinity : state.level;
      const padMat = material('concrete', 0xb3afa6);

      for (const u of state.units) {
        const L = u.level || 0;
        if (L > maxL) continue;
        const info = layout.get(u.id);
        const covered = info.covered > 0.5 && state.level === 'all';
        const cutHere = state.level !== 'all' && L === maxL;
        const roofOn = (state.showRoof && !cutHere) || covered;
        const showRoofItems = !(!state.showRoof || covered || cutHere);
        const cacheKey = JSON.stringify([u.id, u.preset, u.len, u.wid, u.hgt, u.color, u.items, roofOn, lined, showRoofItems, L === 0]);
        const cached = unitCache.get(cacheKey);
        if (cached) {
          keep.add(cacheKey);
          const { group } = cached;
          group.position.set(u.cx, BASE + info.elev, u.cz);
          group.rotation.y = -(u.rot || 0) * Math.PI / 2;
          group.userData.ref = { t: 'unit', id: u.id };
          scene.add(group);
          unitGroups.set(u.id, group);
          objByRef.set(refKey(group.userData.ref), group);
          viewer.registerPickable(group);
          for (const obj of cached.picks) {
            obj.userData.ref = { t: 'item', id: u.id, key: obj.userData.ref.key };
            objByRef.set(refKey(obj.userData.ref), obj);
            viewer.registerPickable(obj);
          }
          continue;
        }
        const picks = [];
        const openings = u.items.filter(i => i.kind === 'opening').map(i => ({ ...i, _item: i }));
        const { group, ext } = buildUnit({ size: u.preset, len: u.len, wid: u.wid, hgt: u.hgt, color: hexOf(u.color), openings, roof: roofOn, lined });
        keep.add(cacheKey);
        unitCache.set(cacheKey, { group, picks });
        group.position.set(u.cx, BASE + info.elev, u.cz);
        group.rotation.y = -(u.rot || 0) * Math.PI / 2;
        group.userData.ref = { t: 'unit', id: u.id };
        scene.add(group);
        unitGroups.set(u.id, group);
        objByRef.set(refKey(group.userData.ref), group);
        viewer.registerPickable(group);
        for (const child of [...group.children]) {
          const it = child.userData.opening?._item;
          if (!it) continue;
          child.userData.ref = { t: 'item', id: u.id, key: it.key };
          objByRef.set(refKey(child.userData.ref), child);
          viewer.registerPickable(child);
          picks.push(child);
        }
        for (const it of u.items) {
          if (it.kind === 'opening') continue;
          if (it.kind === 'roof' && !showRoofItems) continue;
          const obj = partModel(it, { unit: u });
          placePart(obj, it, u);
          obj.userData.ref = { t: 'item', id: u.id, key: it.key };
          group.add(obj);
          objByRef.set(refKey(obj.userData.ref), obj);
          viewer.registerPickable(obj);
          picks.push(obj);
        }
        if (L === 0) {
          const xs = ext.len > 7 ? [-1, 0, 1] : [-1, 1];
          for (const sx of xs) for (const sz of [-1, 1]) {
            const pad = new THREE.Mesh(new THREE.BoxGeometry(0.6, PAD_H + 0.02, 0.6), padMat);
            pad.position.set(sx * (ext.len / 2 - 0.2), -FLOOR_DEPTH - (PAD_H + 0.02) / 2 + 0.01, sz * (ext.wid / 2 - 0.2));
            pad.castShadow = true; pad.receiveShadow = true;
            group.add(pad);
          }
        }
      }
      for (const it of state.site) {
        if (state.level !== 'all' && (it.elev || 0) > 0.5 + (state.level) * 2.9) continue;
        const obj = partModel(it, {});
        obj.position.set(it.x, it.elev || 0, it.z);
        obj.rotation.y = -(it.rot || 0) * Math.PI / 2;
        obj.userData.ref = { t: 'site', key: it.key };
        scene.add(obj);
        objByRef.set(refKey(obj.userData.ref), obj);
        viewer.registerPickable(obj);
      }
      // Free units that are no longer in the build.
      for (const [k, v] of unitCache) if (!keep.has(k)) { disposeTree(v.group); unitCache.delete(k); }
      const sel = objByRef.get(refKey(state.sel)) || null;
      viewer.selected = null;
      viewer.invalidate(200);
      suppressSelect = true; viewer.select(sel); suppressSelect = false;
      renderLevels();
    }

    function placePart(obj, it, u) {
      const p = PART[it.type] || {};
      if (it.kind === 'fitting') {
        obj.position.set(it.x - u.len / 2, p.mount || 0, it.z - u.wid / 2);
        obj.rotation.y = -(it.rot || 0) * Math.PI / 2;
      } else if (it.kind === 'facade') {
        placeOnWall(obj, it, specOf(u));
      } else if (it.kind === 'roof') {
        obj.position.set(it.x - u.len / 2, u.hgt + ROOF_DEPTH + 0.002, it.z - u.wid / 2);
      }
    }

    function frameAll() {
      viewer.setView('iso', scene);
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const span = Math.max(s.x, s.z, s.y);
      viewer.controls.target.copy(c);
      viewer.camera.position.set(c.x + span * 0.75, c.y + span * 0.6, c.z + span * 0.95);
      viewer.controls.update();
      viewer.frame(scene, 1.15);
    }

    /* ---------------- selection ---------------- */

    let suppressSelect = false;
    const selItem = () => {
      const s = state.sel;
      if (!s) return null;
      if (s.t === 'item') { const u = U(s.id); const it = u?.items.find(i => i.key === s.key); return it ? { u, it } : null; }
      if (s.t === 'site') { const it = state.site.find(i => i.key === s.key); return it ? { it } : null; }
      if (s.t === 'unit') { const u = U(s.id); return u ? { u } : null; }
      return null;
    };
    function select(ref, { fromViewer = false } = {}) {
      state.sel = ref && (ref.t === 'unit' ? U(ref.id) : true) ? ref : null;
      if (!fromViewer) { suppressSelect = true; viewer.select(objByRef.get(refKey(state.sel)) || null); suppressSelect = false; }
      renderInspector(); renderStatus();
      if (state.sel && root.dataset.narrow === 'true') { root.dataset.insp = 'peek'; }
    }
    viewer.onSelect((obj) => {
      if (suppressSelect || dragging) return;
      select(obj?.userData.ref || null, { fromViewer: true });
    });

    /* ---------------- history ---------------- */

    const undoStack = [], redoStack = [];
    const snap = () => JSON.stringify({ units: state.units, site: state.site, name: state.name });
    function checkpoint() {
      undoStack.push(snap());
      if (undoStack.length > 60) undoStack.shift();
      redoStack.length = 0;
    }
    function restore(json) {
      const d = JSON.parse(json);
      state.units = d.units; state.site = d.site; state.name = d.name;
      if (state.sel && !selItem()) state.sel = null;
      $('#cb-name').value = state.name;
      commit();
    }
    const undo = () => { if (!undoStack.length) return toast('Nothing to undo'); redoStack.push(snap()); restore(undoStack.pop()); };
    const redo = () => { if (!redoStack.length) return toast('Nothing to redo'); undoStack.push(snap()); restore(redoStack.pop()); };

    /** After any change to the model: rebuild the scene and everything that reads it. */
    function commit({ geometry = true } = {}) {
      if (geometry) rebuild();
      renderInspector(); renderStatus(); saveProject();
      if (state.tab !== 'design') renderQuoteDependents();
    }

    /* ---------------- adding parts ---------------- */

    const targetUnit = () => {
      const s = state.sel;
      if (s?.t === 'unit' || s?.t === 'item') return U(s.id);
      return state.units[state.units.length - 1];
    };

    /** A free spot on a wall for an opening or facade part of width w. */
    function freeAlong(u, wall, w) {
      const span = wallSpan(u, wall);
      const taken = u.items.filter(i => (i.kind === 'opening' || i.kind === 'facade') && i.wall === wall).map(i => [i.along - i.w / 2 - 0.15, i.along + i.w / 2 + 0.15]);
      const edge = (wall === 'left' || wall === 'right') && u.preset !== 'custom' && !UNIT_TYPE[u.preset]?.shell?.startsWith('fab') ? 0.3 : 0.12;
      for (let t = 0; t <= 1; t += 0.05) {
        for (const a of [span / 2 + t * span / 2, span / 2 - t * span / 2]) {
          const lo = a - w / 2, hi = a + w / 2;
          if (lo < edge || hi > span - edge) continue;
          if (!taken.some(([x, y]) => hi > x && lo < y)) return a;
        }
      }
      return null;
    }

    function addPart(type, at = state.placeAt) {
      const p = PART[type];
      if (!p) return;
      checkpoint();
      if (p.kind === 'site' || (p.siteOk && at?.kind === 'site')) {
        const u = targetUnit();
        let x = at?.x, z = at?.z;
        if (x == null) {
          if (u) { const r = unitRect(u); x = u.cx; z = r.z0 - (p.d || 1) / 2 - 0.4; }
          else { x = 0; z = 0; }
        }
        const it = prepSite({ type, x: r3(x), z: r3(z), rot: 0, ...(p.stair && u ? { h: r3(BASE + (layout.get(u.id)?.elev || 0) + extOf(u).hgt) } : {}) });
        state.site.push(it);
        state.sel = { t: 'site', key: it.key };
      } else {
        const u = at?.unitId ? U(at.unitId) : targetUnit();
        if (!u) { state.site.push(prepSite({ type, x: 0, z: 0 })); undoStack.pop(); return tbAlert('Add a container first.'); }
        let raw = { kind: p.kind, type };
        if (p.kind === 'opening' || p.kind === 'facade') {
          let wall = at?.wall;
          if (!wall) wall = /door|garage|roller|fold/.test(type) && !u.items.some(i => i.kind === 'opening' && i.wall === 'front') ? 'front' : 'left';
          const w = Math.min(p.w, wallSpan(u, wall) - 0.2);
          let along = at?.along ?? freeAlong(u, wall, w);
          if (along == null) { for (const alt of ['right', 'left', 'back', 'front']) { const a = freeAlong(u, alt, Math.min(p.w, wallSpan(u, alt) - 0.2)); if (a != null) { wall = alt; along = a; break; } } }
          raw = { ...raw, wall, along: along ?? wallSpan(u, wall) / 2 };
        } else if (p.kind === 'fitting') {
          raw = { ...raw, x: at?.x ?? u.len / 2, z: at?.z ?? u.wid / 2, rot: p.isWall ? 0 : (p.w > u.wid - 0.3 ? 1 : 0) };
          if (p.isWall) raw.d = Math.min(p.d, u.wid);
          if (p.id === 'mezzanine') { raw.x = at?.x ?? 1.25; raw.d = u.wid; raw.deck = clamp(u.hgt - 0.9, 1.4, 2.2); }
        } else if (p.kind === 'roof') {
          raw = { ...raw, x: at?.x ?? u.len / 2, z: at?.z ?? u.wid / 2 };
          if (p.cover) { raw.x = u.len / 2; raw.z = u.wid / 2; }
          if (['roof-deck', 'green-roof', 'solar'].includes(type) && at?.x == null) { raw.w = Math.min(p.w, extOf(u).len - 0.2); }
        }
        const it = prepItem(raw, u);
        u.items.push(it);
        state.sel = { t: 'item', id: u.id, key: it.key };
        if (p.kind === 'roof' && !state.showRoof) { state.showRoof = true; toast('Roof shown so you can see it'); }
        if (p.kind === 'fitting' && state.showRoof && !(layout.get(u.id)?.covered > 0.5)) { state.showRoof = false; toast('Roof hidden to show the inside'); }
      }
      state.placeAt = null;
      renderPlace();
      commit();
      if (root.dataset.narrow === 'true') { root.dataset.side = 'closed'; }
    }

    function addUnit(preset, at = null) {
      checkpoint();
      let cx = at?.x, cz = at?.z, level = at?.level ?? 0;
      const u = mkUnit(preset, 0, 0, { color: targetUnit()?.color || 'green' });
      if (cx == null) {
        // Alongside the last unit on the ground.
        const ground = state.units.filter(x => (x.level || 0) === 0);
        if (ground.length) { const r = ground.map(unitRect).reduce((a, b) => ({ z1: Math.max(a.z1, b.z1), x0: Math.min(a.x0, b.x0) })); const e = extOf(u); cx = r.x0 + e.len / 2; cz = r.z1 + e.wid / 2; }
        else { cx = 0; cz = 0; }
      }
      Object.assign(u, { cx: r3(cx), cz: r3(cz), level });
      state.units.push(u);
      state.sel = { t: 'unit', id: u.id };
      commit();
      toast(`${unitName(u)} added${level ? ` on ${levelName(level).toLowerCase()}` : ''}`);
    }

    function stackOn(u) {
      checkpoint();
      const n = mkUnit(u.preset, u.cx, u.cz, { rot: u.rot, level: (u.level || 0) + 1, color: u.color });
      state.units.push(n);
      state.sel = { t: 'unit', id: n.id };
      state.showRoof = true;
      commit();
      toast('Stacked corner to corner');
    }
    function duplicateUnit(u) {
      checkpoint();
      const e = extOf(u), turned = (u.rot || 0) % 2;
      const n = { ...clone(u), id: `u${state.nextUnit++}`, name: '', cx: turned ? u.cx + e.wid : u.cx, cz: turned ? u.cz : u.cz + e.wid };
      n.items = n.items.map(it => ({ ...it, key: state.nextKey++ }));
      state.units.push(n);
      state.sel = { t: 'unit', id: n.id };
      commit();
    }
    function duplicateSel() {
      const s = selItem();
      if (!s) return;
      if (state.sel.t === 'unit') return duplicateUnit(s.u);
      checkpoint();
      const it = { ...clone(s.it), key: state.nextKey++ };
      if (state.sel.t === 'site') { it.x += 0.5; it.z += 0.5; state.site.push(it); state.sel = { t: 'site', key: it.key }; }
      else {
        const u = s.u;
        if (it.kind === 'opening' || it.kind === 'facade') { const a = freeAlong(u, it.wall, it.w); if (a != null) it.along = a; else it.along = clamp(it.along + it.w + 0.3, it.w / 2, wallSpan(u, it.wall) - it.w / 2); }
        else { it.x = clamp(it.x + 0.4, 0, u.len); it.z = clamp(it.z, 0, u.wid); }
        u.items.push(it); state.sel = { t: 'item', id: u.id, key: it.key };
      }
      commit();
    }
    function removeSel() {
      const s = selItem();
      if (!s) return;
      checkpoint();
      if (state.sel.t === 'unit') {
        const above = state.units.filter(x => (layout.get(x.id)?.below || []).includes(s.u.id));
        state.units = state.units.filter(x => x.id !== s.u.id);
        if (above.length) toast(`${above.length} unit${above.length > 1 ? 's' : ''} above now ${above.length > 1 ? 'have' : 'has'} nothing under ${above.length > 1 ? 'them' : 'it'}`);
      } else if (state.sel.t === 'site') state.site = state.site.filter(i => i.key !== s.it.key);
      else s.u.items = s.u.items.filter(i => i.key !== s.it.key);
      state.sel = null;
      commit();
    }
    function rotateSel(dir = 1) {
      const s = selItem();
      if (!s) return;
      checkpoint();
      const target = state.sel.t === 'unit' ? s.u : s.it;
      if (state.sel.t === 'item' && (s.it.kind === 'opening' || s.it.kind === 'facade')) {
        const order = ['front', 'right', 'back', 'left'];
        s.it.wall = order[(order.indexOf(s.it.wall) + (dir > 0 ? 1 : 3)) % 4];
        s.it.w = Math.min(s.it.w, wallSpan(s.u, s.it.wall) - 0.2);
        s.it.along = freeAlong(s.u, s.it.wall, s.it.w) ?? wallSpan(s.u, s.it.wall) / 2;
      } else if (state.sel.t === 'item' && s.it.kind === 'roof') {
        [s.it.w, s.it.d] = [Math.min(s.it.d, extOf(s.u).len + 0.6), Math.min(s.it.w, extOf(s.u).wid + 0.6)];
      } else {
        target.rot = (((target.rot || 0) + dir) % 4 + 4) % 4;
        if (state.sel.t === 'item') { const { dx, dz } = planSize(s.it); s.it.x = clamp(s.it.x, dx / 2, Math.max(dx / 2, s.u.len - dx / 2)); s.it.z = clamp(s.it.z, dz / 2, Math.max(dz / 2, s.u.wid - dz / 2)); }
      }
      commit();
    }
    function nudge(dx, dz) {
      const s = selItem();
      if (!s) return;
      const t = state.sel.t;
      if (t === 'unit') { s.u.cx = r3(s.u.cx + dx); s.u.cz = r3(s.u.cz + dz); }
      else if (t === 'site') { s.it.x = r3(s.it.x + dx); s.it.z = r3(s.it.z + dz); }
      else if (s.it.kind === 'opening' || s.it.kind === 'facade') { s.it.along = clamp(r3(s.it.along + (dx || dz)), s.it.w / 2, wallSpan(s.u, s.it.wall) - s.it.w / 2); }
      else {
        // Arrow keys move in site directions; convert into the unit's own axes.
        const r = s.u.rot || 0;
        const [lx, lz] = [[dx, dz], [dz, -dx], [-dx, -dz], [-dz, dx]][r];
        s.it.x = r3(s.it.x + lx); s.it.z = r3(s.it.z + lz);
      }
      commit();
    }

    /* ---------------- dragging parts and units ---------------- */

    let dragging = null;          // { ref, obj, plane, startJson, offset, moved }
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitOn = (plane, e) => {
      const rect = viewer.renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      viewer.camera.updateMatrixWorld();
      ray.setFromCamera(ndc, viewer.camera);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out : null;
    };
    const pickAt = (e) => {
      const rect = viewer.renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      viewer.camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
      ray.setFromCamera(ndc, viewer.camera);
      const hits = ray.intersectObjects(viewer.pickables.filter(o => o.visible), true);
      for (const h of hits) {
        let n = h.object;
        while (n && !n.userData?.ref) n = n.parent;
        if (n) return { ref: n.userData.ref, point: h.point, obj: n };
      }
      const g = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      return { ref: null, point: g };
    };

    const WALL_N = { left: [0, 0, -1], right: [0, 0, 1], front: [1, 0, 0], back: [-1, 0, 0] };
    function dragPlaneFor(ref) {
      const gy = (u) => BASE + (layout.get(u.id)?.elev || 0);
      if (ref.t === 'unit') return new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy(U(ref.id)));
      if (ref.t === 'site') { const it = state.site.find(i => i.key === ref.key); return new THREE.Plane(new THREE.Vector3(0, 1, 0), -(it?.elev || 0)); }
      const u = U(ref.id), it = u.items.find(i => i.key === ref.key), g = unitGroups.get(u.id);
      if (it.kind === 'opening' || it.kind === 'facade') {
        const n = new THREE.Vector3(...WALL_N[it.wall]).applyQuaternion(g.quaternion);
        const e = extOf(u);
        const local = it.wall === 'left' || it.wall === 'right' ? new THREE.Vector3(0, 0, (it.wall === 'left' ? -1 : 1) * e.wid / 2) : new THREE.Vector3((it.wall === 'back' ? -1 : 1) * e.len / 2, 0, 0);
        return new THREE.Plane().setFromNormalAndCoplanarPoint(n, g.localToWorld(local));
      }
      if (it.kind === 'roof') return new THREE.Plane(new THREE.Vector3(0, 1, 0), -(gy(u) + u.hgt + ROOF_DEPTH));
      return new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy(u));
    }

    /** Snap a unit's centre to the grid and to the edges of units on its level (and centres below). */
    function snapUnit(u, cx, cz) {
      const e = extOf(u), turned = (u.rot || 0) % 2;
      const hx = (turned ? e.wid : e.len) / 2, hz = (turned ? e.len : e.wid) / 2;
      let bx = Math.round(cx / 0.05) * 0.05, bz = Math.round(cz / 0.05) * 0.05, dxBest = 0.35, dzBest = 0.35, snapped = false;
      const L = u.level || 0;
      for (const o of state.units) {
        if (o.id === u.id) continue;
        const r = unitRect(o), lo = o.level || 0;
        if (lo === L) {
          for (const x of [r.x0 - hx, r.x1 + hx, r.x0 + hx, r.x1 - hx, (r.x0 + r.x1) / 2]) if (Math.abs(cx - x) < dxBest) { dxBest = Math.abs(cx - x); bx = x; snapped = true; }
          for (const z of [r.z0 - hz, r.z1 + hz, r.z0 + hz, r.z1 - hz, (r.z0 + r.z1) / 2]) if (Math.abs(cz - z) < dzBest) { dzBest = Math.abs(cz - z); bz = z; snapped = true; }
        } else if (lo === L - 1) {
          for (const x of [o.cx, r.x0 + hx, r.x1 - hx]) if (Math.abs(cx - x) < dxBest) { dxBest = Math.abs(cx - x); bx = x; snapped = true; }
          for (const z of [o.cz, r.z0 + hz, r.z1 - hz]) if (Math.abs(cz - z) < dzBest) { dzBest = Math.abs(cz - z); bz = z; snapped = true; }
        }
      }
      return { cx: r3(bx), cz: r3(bz), snapped };
    }

    function applyDrag(e) {
      const d = dragging;
      viewer.invalidate(300);
      const p = hitOn(d.plane, e);
      if (!p) return;
      const ref = d.ref;
      if (ref.t === 'unit') {
        const u = U(ref.id);
        const s = snapUnit(u, p.x - d.offset.x, p.z - d.offset.z);
        u.cx = s.cx; u.cz = s.cz;
        d.obj.position.x = u.cx; d.obj.position.z = u.cz;
        statusSel.textContent = `${unitName(u)} · ${fmtLen(u.cx, state.unit)}, ${fmtLen(u.cz, state.unit)}${s.snapped ? ' · snapped' : ''}`;
      } else if (ref.t === 'site') {
        const it = state.site.find(i => i.key === ref.key);
        it.x = r3(Math.round((p.x - d.offset.x) / 0.05) * 0.05); it.z = r3(Math.round((p.z - d.offset.z) / 0.05) * 0.05);
        d.obj.position.x = it.x; d.obj.position.z = it.z;
      } else {
        const u = U(ref.id), it = u.items.find(i => i.key === ref.key), g = unitGroups.get(u.id);
        const lp = g.worldToLocal(p.clone());
        if (it.kind === 'opening' || it.kind === 'facade') {
          const a = it.wall === 'left' ? lp.x + u.len / 2 : it.wall === 'right' ? u.len / 2 - lp.x : it.wall === 'front' ? lp.z + u.wid / 2 : u.wid / 2 - lp.z;
          it.along = r3(clamp(Math.round(a / 0.025) * 0.025, it.w / 2, wallSpan(u, it.wall) - it.w / 2));
          placeOnWall(d.obj, it, specOf(u));
          if (it.kind === 'opening') d.obj.position.y = it.sill;
        } else {
          const { dx, dz } = it.kind === 'fitting' ? planSize(it) : { dx: 0.2, dz: 0.2 };
          const lo = it.kind === 'roof' ? -0.3 : 0;
          it.x = r3(clamp(Math.round((lp.x + u.len / 2 - d.offset.x) / 0.025) * 0.025, lo + dx / 2, u.len - lo - dx / 2));
          it.z = r3(clamp(Math.round((lp.z + u.wid / 2 - d.offset.z) / 0.025) * 0.025, lo + dz / 2, u.wid - lo - dz / 2));
          placePart(d.obj, it, u);
        }
        statusSel.textContent = describeSel();
      }
    }

    const canvasEl = viewer.renderer.domElement;
    let press = null, longTimer = null;
    mount.addEventListener('pointerdown', (e) => {
      closeContextMenu();
      press = { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType, id: e.pointerId };
      if (e.button === 0 && e.pointerType === 'touch') {
        clearTimeout(longTimer);
        longTimer = setTimeout(() => { if (press && !dragging) { viewer._downAt = null; viewer.controls.enabled = false; openCanvasMenu(e); press = null; setTimeout(() => { viewer.controls.enabled = true; }, 50); } }, 550);
      }
      if (e.button !== 0 || !state.sel) return;
      const hit = pickAt(e);
      if (!hit.ref || refKey(hit.ref) !== refKey(state.sel)) return;
      // Pressing on the selected part starts a move instead of an orbit.
      const plane = dragPlaneFor(hit.ref);
      const p = hitOn(plane, e);
      if (!p) return;
      viewer.controls.enabled = false;
      let offset = new THREE.Vector3();
      if (hit.ref.t === 'unit') { const u = U(hit.ref.id); offset.set(p.x - u.cx, 0, p.z - u.cz); }
      else if (hit.ref.t === 'site') { const it = state.site.find(i => i.key === hit.ref.key); offset.set(p.x - it.x, 0, p.z - it.z); }
      else {
        const u = U(hit.ref.id), it = u.items.find(i => i.key === hit.ref.key);
        if (it.kind === 'fitting' || it.kind === 'roof') { const lp = unitGroups.get(u.id).worldToLocal(p.clone()); offset.set(lp.x + u.len / 2 - it.x, 0, lp.z + u.wid / 2 - it.z); }
      }
      dragging = { ref: hit.ref, obj: objByRef.get(refKey(hit.ref)), plane, startJson: snap(), offset, moved: false };
      try { canvasEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }, true);

    mount.addEventListener('pointermove', (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearTimeout(longTimer);
      if (!dragging) return;
      if (!dragging.moved && press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) return;
      dragging.moved = true;
      mount.classList.add('is-dragging');
      applyDrag(e);
    }, true);

    const endPress = (e) => {
      clearTimeout(longTimer);
      if (dragging) {
        const d = dragging;
        dragging = null;
        mount.classList.remove('is-dragging');
        viewer.controls.enabled = true;
        try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (d.moved) { undoStack.push(d.startJson); redoStack.length = 0; viewer._downAt = null; commit(); }
      }
      if (press && e.type === 'pointerup' && press.button === 2 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) openCanvasMenu(e);
      press = null;
    };
    mount.addEventListener('pointerup', endPress, true);
    mount.addEventListener('pointercancel', endPress, true);
    // Right-click opens on release (so a right-drag can still pan); the contextmenu
    // event covers Ctrl-click on a Mac and the keyboard menu key.
    mount.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (press && press.button === 2) return;
      if (performance.now() - menuOpenedAt > 400) openCanvasMenu(e);
    });

    /* Parts dragged in from the library drop where they land. */
    mount.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('text/x-cb-part')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    mount.addEventListener('drop', (e) => {
      const type = e.dataTransfer?.getData('text/x-cb-part');
      if (!type) return;
      e.preventDefault();
      const at = placementAt(pickAt(e), PART[type]);
      addPart(type, at);
    });

    /** Where a part of kind p would go for a pick result. */
    function placementAt(hit, p) {
      if (!hit) return null;
      if (hit.ref?.t === 'unit' || hit.ref?.t === 'item') {
        const u = U(hit.ref.id);
        const g = unitGroups.get(u.id);
        const lp = g.worldToLocal(hit.point.clone());
        const e = extOf(u);
        const wall = Math.abs(lp.z) > u.wid / 2 - 0.12 ? (lp.z < 0 ? 'left' : 'right') : Math.abs(lp.x) > u.len / 2 - 0.12 ? (lp.x > 0 ? 'front' : 'back') : null;
        const onRoof = lp.y > u.hgt - 0.05;
        if (p?.kind === 'opening' || p?.kind === 'facade') {
          const w = wall || (Math.abs(lp.z) / (e.wid / 2) > Math.abs(lp.x) / (e.len / 2) ? (lp.z < 0 ? 'left' : 'right') : (lp.x > 0 ? 'front' : 'back'));
          const a = w === 'left' ? lp.x + u.len / 2 : w === 'right' ? u.len / 2 - lp.x : w === 'front' ? lp.z + u.wid / 2 : u.wid / 2 - lp.z;
          return { kind: 'wall', unitId: u.id, wall: w, along: r3(a) };
        }
        if (p?.kind === 'roof' || (onRoof && !p)) return { kind: 'roof', unitId: u.id, x: r3(lp.x + u.len / 2), z: r3(lp.z + u.wid / 2) };
        if (p?.kind === 'site') return { kind: 'site', x: r3(hit.point.x), z: r3(hit.point.z) };
        return { kind: 'floor', unitId: u.id, x: r3(clamp(lp.x + u.len / 2, 0.2, u.len - 0.2)), z: r3(clamp(lp.z + u.wid / 2, 0.2, u.wid - 0.2)), wall };
      }
      if (hit.point) return { kind: 'site', x: r3(hit.point.x), z: r3(hit.point.z) };
      return null;
    }

    /* ---------------- context menus ---------------- */

    const quick = { wall: ['personnel-door', 'window', 'sliding-door', 'picture-window', 'clerestory'], floor: ['partition', 'kitchen', 'sofa', 'double-bed', 'shower'], roof: ['roof-deck', 'solar', 'skylight'], site: ['deck', 'pergola', 'ext-stair'] };

    let menuOpenedAt = -Infinity;
    function openCanvasMenu(e) {
      if (performance.now() - menuOpenedAt < 400) return;
      menuOpenedAt = performance.now();
      const hit = pickAt(e);
      const x = e.clientX, y = e.clientY;
      if (hit.ref) select(hit.ref);
      const items = [];
      const placeHere = (at, list, label) => {
        items.push({ heading: label });
        for (const t of list) items.push({ label: PART[t].name, icon: ic(I.plus, 14), action: () => addPart(t, at) });
        items.push({ label: 'More parts here…', icon: ic(I.place, 14), action: () => startPlace(at) });
      };
      if (hit.ref?.t === 'item' || hit.ref?.t === 'site') {
        const s = selItem();
        const p = PART[s.it.type];
        items.push({ label: 'Properties', icon: ic(I.info, 14), shortcut: '↵', action: () => { ui.insp = 'open'; root.dataset.insp = 'open'; renderInspector(); } });
        items.push({ label: 'Duplicate', icon: ic(I.copy, 14), shortcut: 'Ctrl D', action: duplicateSel });
        if (s.it.kind === 'opening' || s.it.kind === 'facade') {
          items.push({ heading: 'Move to wall' });
          for (const w of WALLS) if (w.id !== s.it.wall) items.push({ label: w.name, action: () => { checkpoint(); s.it.wall = w.id; s.it.w = Math.min(s.it.w, wallSpan(s.u, w.id) - 0.2); s.it.along = freeAlong(s.u, w.id, s.it.w) ?? wallSpan(s.u, w.id) / 2; commit(); } });
          items.push({ label: 'Centre on this wall', action: () => { checkpoint(); s.it.along = wallSpan(s.u, s.it.wall) / 2; commit(); } });
        } else items.push({ label: 'Turn 90°', icon: ic(I.rotate, 14), shortcut: 'R', action: () => rotateSel(1) });
        if (p?.how) items.push({ label: 'How it’s built', icon: ic(I.info, 14), action: () => { ui.insp = 'open'; root.dataset.insp = 'open'; renderInspector(); $('#cb-how')?.setAttribute('open', ''); $('#cb-how')?.scrollIntoView({ block: 'nearest' }); } });
        items.push({ label: 'Copy', shortcut: 'Ctrl C', action: copySel });
        items.push({ separator: true });
        items.push({ label: 'Delete', icon: ic(I.trash, 14), shortcut: 'Del', destructive: true, action: removeSel });
        openContextMenu({ x, y, title: p?.name || 'Part', items, label: 'Part actions' });
        return;
      }
      if (hit.ref?.t === 'unit') {
        const u = U(hit.ref.id);
        const at = placementAt(hit, null);
        if (at.kind === 'floor' && at.wall) placeHere({ kind: 'wall', unitId: u.id, wall: at.wall, along: (() => { const g = unitGroups.get(u.id); const lp = g.worldToLocal(hit.point.clone()); return r3(at.wall === 'left' ? lp.x + u.len / 2 : at.wall === 'right' ? u.len / 2 - lp.x : at.wall === 'front' ? lp.z + u.wid / 2 : u.wid / 2 - lp.z); })() }, quick.wall, `Add to the ${WALLS.find(w => w.id === at.wall).name.toLowerCase()}`);
        else if (at.kind === 'roof') placeHere(at, quick.roof, 'Add to the roof');
        else placeHere(at, quick.floor, 'Add here');
        items.push({ separator: true });
        items.push({ heading: unitName(u) });
        items.push({ label: 'Stack a unit on top', icon: ic(I.stack, 14), action: () => stackOn(u) });
        items.push({ label: 'Duplicate alongside', icon: ic(I.copy, 14), shortcut: 'Ctrl D', action: () => duplicateUnit(u) });
        items.push({ label: 'Turn 90°', icon: ic(I.rotate, 14), shortcut: 'R', action: () => { state.sel = { t: 'unit', id: u.id }; rotateSel(1); } });
        items.push({ label: state.showRoof ? 'Hide roofs' : 'Show roofs', icon: ic(I.roof, 14), action: toggleRoof });
        if (clipboardOk(u)) items.push({ label: 'Paste into this unit', shortcut: 'Ctrl V', action: () => paste(u, at) });
        items.push({ separator: true });
        items.push({ label: 'Remove unit', icon: ic(I.trash, 14), destructive: true, action: () => { state.sel = { t: 'unit', id: u.id }; removeSel(); } });
        openContextMenu({ x, y, title: `${unitName(u)} · ${levelName(u.level || 0)}`, items, label: 'Unit actions' });
        return;
      }
      if (hit.point) {
        const at = { kind: 'site', x: r3(hit.point.x), z: r3(hit.point.z) };
        items.push({ heading: 'Add a unit here' });
        for (const id of ['20ft', '40ft', '40hc', 'pc20']) items.push({ label: UNIT_TYPE[id].name, icon: ic(I.box, 14), action: () => addUnit(id, { x: at.x, z: at.z }) });
        placeHere(at, quick.site, 'Add to the site');
        items.push({ separator: true });
        if (state.clipboard?.kind === 'site') items.push({ label: 'Paste here', shortcut: 'Ctrl V', action: () => paste(null, at) });
        items.push({ label: 'Start from a design…', icon: ic(I.grid, 14), action: openPresets });
        items.push({ label: 'Fit view', icon: ic(I.fit, 14), shortcut: 'F', action: frameAll });
        items.push({ label: state.showRoof ? 'Hide roofs' : 'Show roofs', icon: ic(I.roof, 14), action: toggleRoof });
      }
      openContextMenu({ x, y, title: 'Site', items, label: 'Site actions' });
    }

    function copySel() {
      const s = selItem();
      if (!s || state.sel.t === 'unit') return;
      state.clipboard = clone(s.it);
      toast(`${PART[s.it.type]?.name || 'Part'} copied`);
    }
    const clipboardOk = (u) => state.clipboard && state.clipboard.kind !== 'site' && !!u;
    function paste(u, at) {
      const c = state.clipboard;
      if (!c) return;
      if (c.kind === 'site') { checkpoint(); const it = { ...clone(c), key: state.nextKey++, x: at?.x ?? c.x + 0.5, z: at?.z ?? c.z + 0.5 }; state.site.push(it); state.sel = { t: 'site', key: it.key }; return commit(); }
      u = u || targetUnit();
      if (!u) return;
      checkpoint();
      const it = prepItem({ ...clone(c), ...(at?.kind === 'floor' && c.kind === 'fitting' ? { x: at.x, z: at.z } : {}), ...(at?.kind === 'wall' && (c.kind === 'opening' || c.kind === 'facade') ? { wall: at.wall, along: at.along } : {}) }, u);
      if ((it.kind === 'opening' || it.kind === 'facade') && !at) it.along = freeAlong(u, it.wall, it.w) ?? it.along;
      u.items.push(it);
      state.sel = { t: 'item', id: u.id, key: it.key };
      commit();
    }

    /* ---------------- place mode ---------------- */

    function startPlace(at) {
      state.placeAt = at;
      ui.side = 'open'; root.dataset.side = 'open';
      renderPlace();
      $('#cb-search').focus();
    }
    const placeKinds = (at) => at?.kind === 'wall' ? ['opening', 'facade'] : at?.kind === 'floor' ? ['fitting'] : at?.kind === 'roof' ? ['roof'] : at?.kind === 'site' ? ['site'] : null;
    function renderPlace() {
      const el = $('#cb-place');
      const at = state.placeAt;
      el.hidden = !at;
      if (at) {
        const u = at.unitId ? U(at.unitId) : null;
        const where = at.kind === 'wall' ? `on the ${WALLS.find(w => w.id === at.wall).name.toLowerCase()} of ${unitName(u)}` : at.kind === 'floor' ? `inside ${unitName(u)}` : at.kind === 'roof' ? `on the roof of ${unitName(u)}` : 'on the site';
        el.innerHTML = `${ic(I.place, 14)}<span>Choose a part to place ${escapeHtml(where)}</span><button type="button" class="cb-icon-btn" data-act="cancel-place" aria-label="Cancel">${ic(I.close, 14)}</button>`;
      }
      filterLibrary();
    }
    function filterLibrary() {
      const q = ($('#cb-search').value || '').trim().toLowerCase();
      const kinds = placeKinds(state.placeAt);
      let shown = 0;
      for (const cat of root.querySelectorAll('.cb-cat')) {
        let n = 0;
        for (const b of cat.querySelectorAll('.cb-part')) {
          const p = PART[b.dataset.part];
          const ok = (!q || `${p.name} ${p.spec || ''} ${p.cat}`.toLowerCase().includes(q)) && (!kinds || kinds.includes(p.kind) || (kinds.includes('site') && p.siteOk));
          b.hidden = !ok; if (ok) n++;
        }
        cat.hidden = !n;
        if ((q || kinds) && n) cat.open = true;
        shown += n;
      }
      $('#cb-lib-empty').hidden = shown > 0;
    }

    /* ---------------- presets ---------------- */

    function openPresets() {
      const m = $('#cb-modal');
      m.hidden = false;
      m.innerHTML = `
        <div class="cb-modal-card" role="dialog" aria-modal="true" aria-labelledby="cb-presets-h">
          <header class="cb-modal-head"><h2 id="cb-presets-h">Start from a design</h2>
            <button type="button" class="cb-icon-btn" data-act="close-modal" aria-label="Close">${ic(I.close)}</button></header>
          <p class="cb-modal-sub">Every layout uses real ISO sizes and carries notes on how it is built. Loading one replaces the current build (undo brings it back).</p>
          <div class="cb-presets">
            ${PRESETS.map(p => `<button type="button" class="cb-preset" data-preset="${p.id}">
              ${presetPlanSvg(p)}
              <span class="cb-preset-name">${escapeHtml(p.name)}</span>
              <span class="cb-preset-tag">${escapeHtml(p.tag)}</span>
              <span class="cb-preset-blurb">${escapeHtml(p.blurb)}</span></button>`).join('')}
          </div>
        </div>`;
      m.querySelector('.cb-preset')?.focus();
    }
    const closeModal = () => { const m = $('#cb-modal'); m.hidden = true; m.innerHTML = ''; };

    /* ---------------- inspector ---------------- */

    const inspBody = $('#cb-insp-body');
    const toDisp = (m) => state.unit === 'm' ? +m.toFixed(3) : +(m / M_PER_FT).toFixed(2);
    const fromDisp = (v) => state.unit === 'm' ? v : v * M_PER_FT;
    const uw = () => state.unit === 'm' ? 'm' : 'ft';
    const numField = (label, f, v, { step, min, max, hint } = {}) => `<label class="cb-field"><span>${label}</span><span class="cb-num"><input type="number" class="tool-input" data-f="${f}" value="${toDisp(v)}" step="${step ?? (state.unit === 'm' ? 0.05 : 0.25)}"${min != null ? ` min="${toDisp(min)}"` : ''}${max != null ? ` max="${toDisp(max)}"` : ''}><em>${uw()}</em></span>${hint ? `<small>${hint}</small>` : ''}</label>`;

    function structureFor() {
      const modules = state.units.map(u => {
        const turned = (u.rot || 0) % 2;
        const L = turned ? u.wid : u.len, W = turned ? u.len : u.wid;
        return { id: u.id, name: unitName(u), size: u.preset, len: u.len, wid: u.wid, hgt: u.hgt, x: u.cx - L / 2, z: u.cz - W / 2, rot: turned ? 90 : 0, level: u.level || 0, items: u.items.filter(i => i.kind === 'opening') };
      });
      try { return checkStructure({ modules, roofs: [], use: 'home' }, {}); } catch { return null; }
    }

    function layoutWarnings() {
      const out = [];
      const L = layoutUnits(state.units);
      const cols = state.site.filter(s => s.type === 'column');
      for (let i = 0; i < state.units.length; i++) for (let k = i + 1; k < state.units.length; k++) {
        const a = state.units[i], b = state.units[k];
        if ((a.level || 0) !== (b.level || 0)) continue;
        const ra = unitRect(a), rb = unitRect(b);
        const ov = Math.max(0, Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0)) * Math.max(0, Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0));
        if (ov > 0.2) out.push({ level: 'bad', text: `${unitName(a)} and ${unitName(b)} overlap on ${levelName(a.level || 0).toLowerCase()}.` });
      }
      for (const u of state.units) {
        const info = L.get(u.id);
        if (!info.supported) out.push({ level: 'bad', text: `${unitName(u)} on ${levelName(u.level).toLowerCase()} has nothing under it: move it onto a unit or prop it on steel posts.` });
        const e = extOf(u), len = (u.rot || 0) % 2 ? e.len : e.len;
        const r = unitRect(u);
        const propped = cols.some(c => c.x > r.x0 - 0.3 && c.x < r.x1 + 0.3 && c.z > r.z0 - 0.3 && c.z < r.z1 + 0.3);
        if (info.overhang > 0.3 && !propped && info.overhang > (len - info.overhang) / 1.5) out.push({ level: 'bad', text: `${unitName(u)} overhangs ${info.overhang.toFixed(1)} m on ${(len - info.overhang).toFixed(1)} m of support: keep the back-span at least 1.5 × the overhang, or prop it on posts.` });
        else if (info.overhang > 0.3) out.push({ level: 'warn', text: `${unitName(u)} overhangs its supports by ${info.overhang.toFixed(1)} m in total${propped ? ' (propped on posts)' : ''}: steel I-beams under both bottom rails, engineered connections.` });
      }
      return out;
    }

    function howBlock(p) {
      if (!p?.how && !p?.spec) return '';
      return `<details class="cb-how" id="cb-how"><summary>${ic(I.info, 14)}<span>How it’s built</span></summary>
        ${p.spec ? `<p class="cb-how-spec">${escapeHtml(p.spec)}</p>` : ''}${p.how ? `<p>${escapeHtml(p.how)}</p>` : ''}</details>`;
    }
    const priceOf = (key, qty) => {
      const b = { ...defaultRateBook(state.customMaterials), ...state.rates }[key];
      if (!b) return '';
      const rate = (state.overrides[key]?.rate ?? b.rate) + (state.overrides[key]?.labour ?? b.labour);
      return rate ? money(rate * qty, state.currency) : '';
    };

    function renderInspector() {
      const s = selItem();
      if (!s) { inspBody.innerHTML = projectPanel(); return; }
      if (state.sel.t === 'unit') { inspBody.innerHTML = unitPanel(s.u); return; }
      const it = s.it, p = PART[it.type] || {}, u = s.u;
      const kindName = { opening: 'Wall opening', fitting: 'Inside', facade: 'Facade', roof: 'Roof', site: 'Site' }[it.kind];
      const notes = [...partNotes(it, u)];
      let fields = '';
      if (it.kind === 'opening' || it.kind === 'facade') {
        const span = wallSpan(u, it.wall);
        fields = `
          <label class="cb-field cb-wide"><span>Wall</span><select class="tool-select" data-f="wall">${WALLS.map(w => `<option value="${w.id}"${w.id === it.wall ? ' selected' : ''}>${w.name}</option>`).join('')}</select></label>
          ${numField('From the left corner', 'along', it.along, { min: it.w / 2, max: span - it.w / 2, hint: 'to the centre, looking at the wall from outside' })}
          ${numField('Width', 'w', it.w, { min: 0.1, max: span })}
          ${numField('Height', 'h', it.h, { min: 0.05 })}
          ${numField(it.kind === 'facade' ? 'Bottom above floor' : 'Sill above floor', 'sill', it.sill, { min: 0 })}
          ${it.proj != null ? numField('Projection', 'proj', it.proj, { min: 0.05 }) : ''}`;
      } else if (it.kind === 'fitting') {
        fields = `
          ${numField('From the back end', 'x', it.x, { min: 0, max: u.len })}
          ${numField('From the left side', 'z', it.z, { min: 0, max: u.wid })}
          ${p.isWall ? numField('Length', 'd', it.d ?? p.d, { min: 0.3, max: u.wid }) : numField('Width', 'w', it.w ?? p.w, { min: 0.2 })}
          ${p.isWall ? '' : numField('Depth', 'd', it.d ?? p.d, { min: 0.2 })}
          ${it.deck != null ? numField('Deck height', 'deck', it.deck, { min: 1.0, max: u.hgt - 0.3 }) : ''}
          ${p.stair ? numField('Rise', 'h', it.h ?? p.h, { min: 0.5 }) : ''}
          <div class="cb-field"><span>Facing</span><button type="button" class="btn btn-secondary btn-sm" data-act="rotate">${ic(I.rotate, 14)}Turn 90°</button></div>`;
      } else if (it.kind === 'roof') {
        fields = `${numField('From the back end', 'x', it.x)}${numField('From the left side', 'z', it.z)}${numField('Length', 'w', it.w)}${numField('Width', 'd', it.d)}`;
        if (p.panel) { const n = Math.max(1, Math.floor(it.w / p.panel.w)) * Math.max(1, Math.floor(it.d / p.panel.d)); notes.unshift(`${n} panels, about ${(n * p.panel.watts / 1000).toFixed(1)} kWp.`); }
      } else {
        fields = `${numField('East–west (x)', 'x', it.x)}${numField('North–south (z)', 'z', it.z)}${numField(p.unit === 'length' && p.lengthOf !== 'd' ? 'Length' : 'Width', 'w', it.w ?? p.w, { min: 0.1 })}${numField(p.lengthOf === 'd' || p.stair ? 'Run' : 'Depth', 'd', it.d ?? p.d, { min: 0.05 })}${numField(p.stair || ['deck', 'walkway', 'ramp', 'steps'].includes(it.type) ? 'Rise / height' : 'Height', 'h', it.h ?? p.h, { min: 0.05 })}${numField('Raised by', 'elev', it.elev || 0, { min: 0 })}
          <div class="cb-field"><span>Facing</span><button type="button" class="btn btn-secondary btn-sm" data-act="rotate">${ic(I.rotate, 14)}Turn 90°</button></div>`;
        if (p.stair) { const n = Math.max(2, Math.round((it.h ?? p.h) / 0.18)); const going = (it.d ?? p.d) * (it.type === 'ext-stair' ? 0.76 : 1) / n; if (it.type !== 'spiral') notes.unshift(`${n} risers of ${Math.round((it.h ?? p.h) / n * 1000)} mm, goings about ${Math.round(going * 1000)} mm${going < 0.25 ? ' (under 250 mm: lengthen the run)' : ''}.`); }
      }
      const key = `${it.kind}:${it.type}`;
      const qty = p.unit === 'area' ? (p.isWall ? (it.d ?? p.d) * (it.h ?? p.h) : (it.kind === 'opening' || it.kind === 'facade') ? it.w * it.h : (it.w ?? p.w) * (it.d ?? p.d)) : p.unit === 'length' ? (p.lengthOf === 'd' ? it.d : it.w) : p.unit === 'panel' ? Math.max(1, Math.floor(it.w / p.panel.w)) * Math.max(1, Math.floor(it.d / p.panel.d)) : 1;
      const price = priceOf(key, qty);
      inspBody.innerHTML = `
        <header class="cb-insp-head">
          <div><span class="cb-kicker">${kindName}${u ? ` · ${escapeHtml(unitName(u))}` : ''}</span><h3>${escapeHtml(p.name || it.type)}</h3></div>
          <button type="button" class="cb-icon-btn" data-act="deselect" aria-label="Close">${ic(I.close)}</button>
        </header>
        ${price ? `<p class="cb-price">${price}<span> supply &amp; fit</span></p>` : ''}
        <div class="cb-fields">${fields}</div>
        ${notes.length ? `<ul class="cb-notes">${notes.map(n => `<li>${ic(I.info, 14)}<span>${escapeHtml(n)}</span></li>`).join('')}</ul>` : ''}
        ${howBlock(p)}
        <div class="cb-insp-acts">
          <button type="button" class="btn btn-secondary btn-sm" data-act="duplicate">${ic(I.copy, 14)}Duplicate</button>
          <button type="button" class="btn btn-secondary btn-sm cb-danger" data-act="delete">${ic(I.trash, 14)}Delete</button>
        </div>`;
    }

    function unitPanel(u) {
      const info = layout.get(u.id) || {};
      const st = structureFor();
      const r = st?.modules.find(m => m.id === u.id);
      const pct = (v) => `${Math.round(v * 100)}%`;
      const badge = r ? ({ ok: ['Checks pass', 'is-ok'], close: ['Close to limits', 'is-close'], 'needs-engineer': ['Needs an engineer', 'is-bad'] }[r.status] || ['', '']) : ['', ''];
      const rows = r ? [
        ['Racking, across', `${r.racking.transverse.demandKn} of ${r.racking.transverse.capacityKn} kN (${pct(r.racking.transverse.ratio)})`],
        ['Racking, along', `${r.racking.longitudinal.demandKn} of ${r.racking.longitudinal.capacityKn} kN (${pct(r.racking.longitudinal.ratio)})`],
        r.stacking ? ['Load on corner posts', `${(r.stacking.perPostKg / 1000).toFixed(1)} t per post (${pct(r.stacking.utilisation)} of 192 t)`] : null,
        ...r.lintels.map(l => [`Lintel over ${l.opening.replace(/-/g, ' ')}`, `${l.section}`]),
        r.footings && (u.level || 0) === 0 ? ['Footings', `${r.footings.supports} pads, ${fmtLen(r.footings.padSideM, state.unit)} square`] : null,
        info.overhang > 0.3 ? ['Cantilever', fmtLen(info.overhang, state.unit)] : null,
      ].filter(Boolean) : [];
      const t = UNIT_TYPE[u.preset];
      const itemsList = u.items.map(it => `<button type="button" class="cb-row" data-select-item="${u.id}:${it.key}"><span>${escapeHtml(PART[it.type]?.name || it.type)}</span><small>${it.kind === 'opening' || it.kind === 'facade' ? escapeHtml(WALLS.find(w => w.id === it.wall)?.name || '') : it.kind === 'roof' ? 'Roof' : 'Inside'}</small></button>`).join('');
      return `
        <header class="cb-insp-head">
          <div><span class="cb-kicker">Unit · ${levelName(u.level || 0)}</span><input class="cb-name-in" data-f="name" value="${escapeHtml(unitName(u))}" aria-label="Unit name"></div>
          <button type="button" class="cb-icon-btn" data-act="deselect" aria-label="Close">${ic(I.close)}</button>
        </header>
        <div class="cb-fields">
          <label class="cb-field cb-wide"><span>Size</span><select class="tool-select" data-f="preset">
            ${UNIT_TYPES.map(g => `<optgroup label="${g.group}">${g.items.map(x => `<option value="${x.id}"${x.id === u.preset ? ' selected' : ''}>${x.name}</option>`).join('')}</optgroup>`).join('')}
            ${u.preset === 'custom' ? '<option value="custom" selected>Custom size</option>' : ''}</select>
            <small>${t ? `Inside ${fmtLen(u.len, state.unit)} × ${fmtLen(u.wid, state.unit)} × ${fmtLen(u.hgt, state.unit)}` : ''}</small></label>
          ${numField('Position x', 'cx', u.cx)}
          ${numField('Position z', 'cz', u.cz)}
          <label class="cb-field"><span>Level</span><span class="cb-stepper"><button type="button" data-act="level-down" aria-label="Down a level">−</button><strong>${u.level || 0}</strong><button type="button" data-act="level-up" aria-label="Up a level">+</button></span></label>
          <div class="cb-field"><span>Facing</span><button type="button" class="btn btn-secondary btn-sm" data-act="rotate">${ic(I.rotate, 14)}Turn 90°</button></div>
          <div class="cb-field cb-wide"><span>Colour</span><div class="cb-swatches">${SHELL_COLORS.map(c => `<button type="button" class="cb-swatch${c.id === u.color ? ' is-active' : ''}" data-color="${c.id}" title="${c.name}" aria-label="${c.name}" style="--c:${cssHex(c.hex)}"></button>`).join('')}</div></div>
        </div>
        <div class="cb-insp-acts">
          <button type="button" class="btn btn-secondary btn-sm" data-act="stack">${ic(I.stack, 14)}Stack on top</button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="duplicate">${ic(I.copy, 14)}Alongside</button>
        </div>
        ${r ? `<section class="cb-sec"><h4>Structure <span class="cb-badge ${badge[1]}">${badge[0]}</span></h4>
          <dl class="cb-dl">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
          ${r.notes.length ? `<ul class="cb-notes">${r.notes.map(n => `<li>${ic(I.info, 14)}<span>${escapeHtml(n)}</span></li>`).join('')}</ul>` : ''}</section>` : ''}
        <section class="cb-sec"><h4>In this unit <span class="cb-count">${u.items.length}</span></h4>${itemsList || '<p class="cb-empty">Nothing yet. Pick parts from the library, or right-click a wall.</p>'}</section>
        <div class="cb-insp-acts"><button type="button" class="btn btn-secondary btn-sm cb-danger" data-act="delete">${ic(I.trash, 14)}Remove unit</button></div>`;
    }

    function projectPanel() {
      const q = currentQuote();
      const st = structureFor();
      const warns = [...layoutWarnings(), ...(st?.warnings || [])];
      const levels = [...new Set(state.units.map(u => u.level || 0))].sort();
      return `
        <header class="cb-insp-head"><div><span class="cb-kicker">Build</span><h3>${escapeHtml(state.name)}</h3></div></header>
        <dl class="cb-dl cb-dl-stats">
          <div><dt>Floor area</dt><dd>${fmtArea(q.quantities.floorArea || 0, state.unit)}</dd></div>
          <div><dt>Units</dt><dd>${state.units.length}</dd></div>
          <div><dt>Levels</dt><dd>${levels.length}</dd></div>
          <div><dt>Quoted price</dt><dd>${money(q.totals.grandTotal, state.currency)}</dd></div>
        </dl>
        ${warns.length ? `<section class="cb-sec"><h4>To resolve <span class="cb-count">${warns.length}</span></h4><ul class="cb-notes">${warns.map(w => `<li data-level="${w.level || 'warn'}">${ic(I.warn, 14)}<span>${escapeHtml(w.text)}</span></li>`).join('')}</ul></section>` : `<p class="cb-ok">${ic(I.info, 14)}No layout problems found. Have the final design checked by a structural engineer.</p>`}
        ${levels.map(L => `<section class="cb-sec"><h4>${levelName(L)}</h4>${state.units.filter(u => (u.level || 0) === L).map(u => `<button type="button" class="cb-row" data-select-unit="${u.id}"><i class="cb-dot" style="--c:${cssHex(hexOf(u.color))}"></i><span>${escapeHtml(unitName(u))}</span><small>${u.items.length} parts</small></button>`).join('')}</section>`).join('')}
        ${state.site.length ? `<section class="cb-sec"><h4>Site <span class="cb-count">${state.site.length}</span></h4>${state.site.map(s => `<button type="button" class="cb-row" data-select-site="${s.key}"><span>${escapeHtml(PART[s.type]?.name || s.type)}</span></button>`).join('')}</section>` : ''}
        <p class="cb-tip">Right-click (or long-press) a wall, a floor or the ground to add parts there. Drag a selected unit to move it; units snap to each other.</p>`;
    }

    inspBody.addEventListener('change', (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      const s = selItem();
      if (!s) return;
      checkpoint();
      if (state.sel.t === 'unit') {
        const u = s.u;
        if (f === 'name') u.name = e.target.value.trim();
        else if (f === 'preset') {
          const t = UNIT_TYPE[e.target.value];
          if (t) { Object.assign(u, { preset: t.id, len: t.len, wid: t.wid, hgt: t.hgt }); u.items = u.items.map(it => prepItem({ ...it }, u)); }
        } else { const v = parseFloat(e.target.value); if (Number.isFinite(v)) u[f] = r3(fromDisp(v)); }
        return commit();
      }
      const it = s.it, u = s.u;
      if (f === 'wall') { it.wall = e.target.value; it.w = Math.min(it.w, wallSpan(u, it.wall) - 0.2); it.along = freeAlong(u, it.wall, it.w) ?? wallSpan(u, it.wall) / 2; }
      else {
        const v = parseFloat(e.target.value);
        if (!Number.isFinite(v)) return;
        it[f] = r3(fromDisp(v));
        if (u && (it.kind === 'opening' || it.kind === 'facade')) {
          const span = wallSpan(u, it.wall);
          it.w = clamp(it.w, 0.1, span - 0.1);
          it.h = clamp(it.h, 0.05, it.kind === 'facade' ? u.hgt + 0.4 : u.hgt - 0.02);
          if (it.kind === 'opening') it.sill = clamp(it.sill, 0, Math.max(0, u.hgt - it.h));
          it.along = clamp(it.along, it.w / 2, span - it.w / 2);
        }
        if (u && it.kind === 'fitting' && it.deck != null) it.deck = clamp(it.deck, 1.0, u.hgt - 0.3);
      }
      commit();
    });
    inspBody.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.selectUnit) return select({ t: 'unit', id: b.dataset.selectUnit });
      if (b.dataset.selectSite) return select({ t: 'site', key: Number(b.dataset.selectSite) });
      if (b.dataset.selectItem) { const [id, key] = b.dataset.selectItem.split(':'); return select({ t: 'item', id, key: Number(key) }); }
      if (b.dataset.color) { const s = selItem(); if (s?.u) { checkpoint(); s.u.color = b.dataset.color; commit(); } return; }
      const s = selItem();
      switch (b.dataset.act) {
        case 'deselect': select(null); break;
        case 'rotate': rotateSel(1); break;
        case 'duplicate': duplicateSel(); break;
        case 'delete': removeSel(); break;
        case 'stack': if (s?.u) stackOn(s.u); break;
        case 'level-up': case 'level-down': if (s?.u) { checkpoint(); s.u.level = Math.max(0, (s.u.level || 0) + (b.dataset.act === 'level-up' ? 1 : -1)); state.showRoof = true; commit(); } break;
        default:
      }
    });

    /* ---------------- status bar, levels ---------------- */

    const statusSel = $('#cb-status-sel');
    function describeSel() {
      const s = selItem();
      if (!s) return state.placeAt ? 'Choose a part to place' : 'Nothing selected — right-click for actions';
      if (state.sel.t === 'unit') return `${unitName(s.u)} · ${levelName(s.u.level || 0)} · ${s.u.items.length} parts`;
      const p = PART[s.it.type];
      if (s.it.kind === 'opening' || s.it.kind === 'facade') return `${p?.name} · ${WALLS.find(w => w.id === s.it.wall)?.name} · ${fmtLen(s.it.along, state.unit)} along`;
      if (state.sel.t === 'site') return `${p?.name} · site`;
      return `${p?.name} · ${unitName(s.u)}`;
    }
    function renderStatus() {
      statusSel.textContent = describeSel();
      const q = currentQuote();
      const levels = new Set(state.units.map(u => u.level || 0)).size;
      $('#cb-status-stats').textContent = `${state.units.length} unit${state.units.length === 1 ? '' : 's'} · ${levels} level${levels === 1 ? '' : 's'} · ${fmtArea(q.quantities.floorArea || 0, state.unit)}`;
      $('#cb-status-total').textContent = money(q.totals.grandTotal, state.currency);
    }
    function renderLevels() {
      const top = topLevel();
      const el = $('#cb-levels');
      el.hidden = top === 0;
      el.innerHTML = top === 0 ? '' : [['all', 'All'], ...Array.from({ length: top + 1 }, (_, i) => [i, i === 0 ? 'G' : `L${i}`])].map(([v, n]) => `<button type="button" data-level="${v}" class="${String(state.level) === String(v) ? 'is-active' : ''}" title="${v === 'all' ? 'All levels' : levelName(v)}">${n}</button>`).join('');
      const rb = root.querySelector('[data-act="roof"]');
      rb.setAttribute('aria-pressed', String(state.showRoof));
      rb.classList.toggle('is-active', state.showRoof);
    }
    const toggleRoof = () => { state.showRoof = !state.showRoof; rebuild(); saveProject(); toast(state.showRoof ? 'Roofs shown' : 'Roofs hidden — look inside'); };

    /* ---------------- toolbar, tabs, library ---------------- */

    function setTab(tab) {
      state.tab = tab;
      root.dataset.tab = tab;
      for (const b of root.querySelectorAll('.cb-tab')) { b.classList.toggle('is-active', b.dataset.tab === tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab)); }
      for (const p of root.querySelectorAll('.cb-panel')) p.hidden = p.dataset.panel !== tab;
      if (tab === 'design') requestAnimationFrame(() => viewer.resize());
      if (tab === 'spec') renderQuoteDependents();
      if (tab === 'quote') { renderLines(); renderTotals(); }
      if (tab === 'rates') { renderMaterials(); renderRates(); }
    }

    function moreMenu(anchor) {
      const r = anchor.getBoundingClientRect();
      openContextMenu({
        x: r.right - 240, y: r.bottom + 6, title: 'Build', label: 'Build menu', className: 'cb-menu',
        items: [
          { label: 'Start from a design…', icon: ic(I.grid, 14), action: openPresets },
          { label: 'New empty build', icon: ic(I.plus, 14), action: async () => { if (await tbConfirm?.('Start a new build? The current one can be brought back with Undo.') === false) return; checkpoint(); state.units = [mkUnit('20ft')]; state.site = []; state.name = 'Untitled build'; $('#cb-name').value = state.name; state.sel = null; commit(); frameAll(); } },
          { separator: true },
          { label: state.unit === 'ft' ? 'Measure in metres' : 'Measure in feet', action: () => { state.unit = state.unit === 'ft' ? 'm' : 'ft'; commit({ geometry: false }); } },
          { label: state.showRoof ? 'Hide roofs' : 'Show roofs', icon: ic(I.roof, 14), action: toggleRoof },
          { label: 'Fit view', icon: ic(I.fit, 14), shortcut: 'F', action: frameAll },
          { separator: true },
          { label: 'Save image (PNG)', icon: ic(I.download, 14), action: savePng },
          { label: 'Export 3D model (GLB)', icon: ic(I.download, 14), action: saveGlb },
          { separator: true },
          { heading: 'Keys: click select · drag selected to move · R turn · Del delete · Ctrl D duplicate · arrows nudge · 1–4 views · F fit' },
        ],
      });
    }

    async function savePng() {
      if (viewer.composer) viewer.composer.render(); else viewer.renderer.render(viewer.scene, viewer.camera);
      viewer.renderer.domElement.toBlob((blob) => { if (blob) download(blob, `${slug(state.name)}.png`); }, 'image/png');
    }
    async function saveGlb() {
      try {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        new GLTFExporter().parse(scene, (out) => download(new Blob([out], { type: 'model/gltf-binary' }), `${slug(state.name)}.glb`), () => tbAlert('The 3D model could not be exported.'), { binary: true });
      } catch { tbAlert('The 3D exporter could not load.'); }
    }
    const slug = (s) => String(s || 'build').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'build';
    function download(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button, [data-act]');
      if (!b || !root.contains(b)) return;
      if (b.dataset.tab) return setTab(b.dataset.tab);
      if (b.dataset.part) {
        if (b.closest('.cb-lib')) return addPart(b.dataset.part);
      }
      if (b.dataset.addUnit) return addUnit(b.dataset.addUnit);
      if (b.dataset.preset) {
        checkpoint(); loadPreset(PRESET[b.dataset.preset]); $('#cb-name').value = state.name; closeModal(); commit(); frameAll();
        return toast(`${PRESET[b.dataset.preset].name} loaded`);
      }
      if (b.dataset.view) {
        for (const x of root.querySelectorAll('#cb-views button')) x.classList.toggle('is-active', x === b);
        return b.dataset.view === 'iso' ? frameAll() : viewer.setView(b.dataset.view, scene);
      }
      if (b.dataset.level !== undefined && b.closest('#cb-levels')) { state.level = b.dataset.level === 'all' ? 'all' : Number(b.dataset.level); return rebuild(); }
      switch (b.dataset.act) {
        case 'toggle-side': ui.side = root.dataset.side === 'open' ? 'closed' : 'open'; root.dataset.side = ui.side; saveUi(); requestAnimationFrame(() => viewer.resize()); break;
        case 'toggle-insp': ui.insp = root.dataset.insp === 'closed' ? 'open' : 'closed'; root.dataset.insp = ui.insp; saveUi(); requestAnimationFrame(() => viewer.resize()); break;
        case 'close-drawers': root.dataset.side = 'closed'; if (root.dataset.narrow === 'true') root.dataset.insp = state.sel ? 'peek' : 'closed'; break;
        case 'sheet': root.dataset.insp = root.dataset.insp === 'open' ? 'peek' : 'open'; break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'more': moreMenu(b); break;
        case 'presets': openPresets(); break;
        case 'close-modal': closeModal(); break;
        case 'roof': toggleRoof(); break;
        case 'fit': frameAll(); break;
        case 'cancel-place': state.placeAt = null; renderPlace(); break;
        default:
      }
    });
    $('#cb-modal').addEventListener('click', (e) => { if (e.target.id === 'cb-modal') closeModal(); });
    root.querySelector('#cb-lib').addEventListener('dragstart', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      e.dataTransfer.setData('text/x-cb-part', b.dataset.part);
      e.dataTransfer.effectAllowed = 'copy';
    });
    $('#cb-search').addEventListener('input', filterLibrary);
    $('#cb-name').addEventListener('change', (e) => { checkpoint(); state.name = e.target.value.trim() || 'Untitled build'; commit({ geometry: false }); });

    const keyHandler = (e) => {
      if (!this._alive || !root.isConnected) return;
      if (e.defaultPrevented || document.querySelector('#toolbox-context-menu, .custom-dialog-backdrop')) return;
      const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (!$('#cb-modal').hidden) return closeModal();
        if (state.placeAt) { state.placeAt = null; return renderPlace(); }
        if (typing) return e.target.blur();
        if (state.sel) return select(null);
      }
      if (typing) return;
      if (state.tab !== 'design' && !mod) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
      if (mod && k === 'y') { e.preventDefault(); return redo(); }
      if (state.tab !== 'design') return;
      if (mod && k === 'd') { e.preventDefault(); return duplicateSel(); }
      if (mod && k === 'c') { e.preventDefault(); return copySel(); }
      if (mod && k === 'v') { e.preventDefault(); return paste(state.sel?.t === 'unit' || state.sel?.t === 'item' ? U(state.sel.id) : null); }
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if (state.sel) { e.preventDefault(); removeSel(); } return; }
      if (k === 'r') return rotateSel(e.shiftKey ? -1 : 1);
      if (k === 'f') return frameAll();
      if (e.key === '/') { e.preventDefault(); ui.side = 'open'; root.dataset.side = 'open'; return $('#cb-search').focus(); }
      if (['1', '2', '3', '4'].includes(e.key)) { const v = ['iso', 'top', 'front', 'left'][Number(e.key) - 1]; root.querySelector(`#cb-views [data-view="${v}"]`)?.click(); return; }
      if (e.key === 'Enter' && state.sel) { ui.insp = 'open'; root.dataset.insp = 'open'; return; }
      const step = e.shiftKey ? 0.25 : 0.05;
      const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (arrows[e.key] && state.sel) {
        e.preventDefault();
        if (!e.repeat) checkpoint();
        nudge(...arrows[e.key]);
      }
    };
    document.addEventListener('keydown', keyHandler);
    this._keyHandler = keyHandler;

    // Narrow windows: library becomes a drawer, the inspector a bottom sheet.
    const measure = () => {
      const narrow = root.getBoundingClientRect().width < 820;
      if (String(narrow) !== root.dataset.narrow) {
        root.dataset.narrow = String(narrow);
        if (narrow) { root.dataset.side = 'closed'; root.dataset.insp = state.sel ? 'peek' : 'closed'; }
        else { root.dataset.side = ui.side; root.dataset.insp = ui.insp; }
      }
      viewer.resize();
    };
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(measure); this._ro.observe(root); }
    measure();

    /* ================= specification ================= */

    const elementsEl = $('#cq-elements'), servicesEl = $('#cq-services'), logisticsEl = $('#cq-logistics');
    const currentQuote = () => buildQuote(state, state.rates, { overrides: state.overrides, removed: state.removed });

    function renderSpec() {
      elementsEl.innerHTML = elementsWith(state.customMaterials).map(el => `
        <div class="cq-spec-row">
          <label class="tool-label" for="spec-${el.id}">${el.name}</label>
          <select class="tool-select" id="spec-${el.id}" data-spec="${el.id}">
            ${el.options.filter(o => el.id !== 'shell' || SHELL_CHOICES.includes(o.id)).map(o => `<option value="${o.id}"${state.spec[el.id] === o.id ? ' selected' : ''}>${el.id === 'shell' ? shellLabel(o) : o.name}</option>`).join('')}
          </select>
          ${el.help ? `<p class="biz-hint">${el.help}</p>` : ''}
        </div>`).join('');
      const q = currentQuote().quantities;
      servicesEl.innerHTML = SERVICES.map(s => {
        const auto = state.services[s.id] !== undefined ? state.services[s.id] : (s.autoFrom ? (q[s.autoFrom] ?? 0) : (s.unit === 'area' ? q.floorArea : s.auto(q.floorArea)));
        return `<div class="cq-qty-row"><span class="cq-qty-name">${s.name}</span>
          <input type="number" class="tool-input" data-service="${s.id}" value="${Number(auto).toFixed(s.unit === 'area' || s.unit === 'length' ? 1 : 0)}" min="0" step="${s.unit === 'each' ? 1 : 0.5}">
          <span class="cq-qty-unit">${UNITS[s.unit].label}</span></div>`;
      }).join('');
      logisticsEl.innerHTML = LOGISTICS.map(l => {
        const def = l.id === 'haulage' ? Math.ceil(q.fortyEquivalents || 1) : l.id === 'offload' ? (q.stacked ? 2 : 1) : l.qty;
        return `<div class="cq-qty-row"><span class="cq-qty-name">${l.name}</span>
          <input type="number" class="tool-input" data-logistics="${l.id}" value="${state.logistics[l.id] ?? def}" min="0" step="1">
          <span class="cq-qty-unit">${UNITS[l.unit].label}</span></div>`;
      }).join('');
    }
    // With several units the shell choice sets where they come from; each unit is priced at its own size.
    const SHELL_CHOICES = ['buy-20', 'new-20', 'client'];
    const shellLabel = (o) => ({ 'buy-20': 'Used containers, each at its size (cabins fabricated)', 'new-20': 'One-trip containers, each at its size (cabins fabricated)', client: 'Client supplies the units' }[o.id] || o.name);

    function renderTakeoff() {
      const q = currentQuote().quantities;
      const u = state.unit;
      const stat = (v, l) => `<div class="cb-stat"><span class="cb-stat-v">${v}</span><span class="cb-stat-l">${l}</span></div>`;
      $('#cq-takeoff').innerHTML = `<h3 class="cq-h">Measured off the model</h3><div class="cb-stats">
        ${stat(fmtArea(q.floorArea, u), 'Floor')}${stat(fmtArea(q.interiorArea, u), 'Interior lining')}${stat(fmtArea(q.exteriorArea, u), 'External walls')}
        ${stat(fmtArea(q.roofArea, u), 'Exposed roof')}${stat(fmtArea(q.glazingArea || 0, u), 'Glazing')}${stat(fmtArea(q.openingArea, u), 'Openings')}
        ${stat(`${num(q.studLength, 0)} m`, 'Stud framing')}${stat(q.supports, 'Supports')}${q.stacked ? stat(q.stacked, 'Units stacked') : ''}${q.joins ? stat(q.joins, 'Unit joints') : ''}</div>`;
    }

    root.querySelector('[data-panel="spec"]').addEventListener('change', (e) => {
      if (e.target.dataset.spec) { state.spec[e.target.dataset.spec] = e.target.value; if (e.target.dataset.spec === 'interior') rebuild(); renderQuoteDependents(); renderStatus(); saveProject(); }
    });
    root.querySelector('[data-panel="spec"]').addEventListener('input', (e) => {
      if (e.target.dataset.service) { state.services[e.target.dataset.service] = parseNum(e.target); renderQuoteDependents({ keepSpec: true }); renderStatus(); saveProject(); }
      if (e.target.dataset.logistics) { state.logistics[e.target.dataset.logistics] = parseNum(e.target); renderQuoteDependents({ keepSpec: true }); renderStatus(); saveProject(); }
    });

    /* ================= quote ================= */

    const linesEl = $('#cq-lines'), totalsEl = $('#cq-totals');

    function renderLines() {
      const { lines } = currentQuote();
      const cur = state.currency;
      if (!lines.length) { linesEl.innerHTML = `<div class="tool-output biz-explain">Nothing to price yet. Set a specification on the previous tab.</div>`; return; }
      linesEl.innerHTML = groupLines(lines).map(group => `
        <div class="cq-group">
          <div class="cq-group-head"><h4>${escapeHtml(group.name)}</h4><span>${money(group.subtotal, cur)}</span></div>
          <div class="cq-line cq-line-head"><span>Material</span><span>Unit</span><span class="ta-right">Qty</span><span class="ta-right">Waste</span><span class="ta-right">Material</span><span class="ta-right">Labour</span><span class="ta-right">Total</span><span></span></div>
          ${group.items.map(l => `
            <div class="cq-line" data-line="${escapeHtml(l.id)}">
              <span class="cq-line-name" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>
              <span class="cq-line-unit">${UNITS[l.unit]?.label ?? l.unit}</span>
              <input type="number" class="tool-input ta-right" data-f="qty" value="${l.qty.toFixed(l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}" min="0" step="0.5" aria-label="Quantity">
              <input type="number" class="tool-input ta-right" data-f="wastage" value="${l.wastage}" min="0" max="60" step="1" aria-label="Wastage %">
              <span class="ta-right cq-cell" data-c="material">${money(l.materialCost, cur)}</span>
              <span class="ta-right cq-cell" data-c="labour">${money(l.labourCost, cur)}</span>
              <span class="ta-right cq-cell cq-line-total" data-c="total">${money(l.total, cur)}</span>
              <button class="ct-del" data-remove="${escapeHtml(l.id)}" aria-label="Remove line">${icon('x')}</button>
            </div>
            <div class="cq-line cq-line-rates">
              <span></span><span></span>
              <label class="cq-rate-mini">rate <input type="number" class="tool-input" data-f="rate" value="${l.rate}" min="0" step="100"></label>
              <label class="cq-rate-mini">labour <input type="number" class="tool-input" data-f="labour" value="${l.labour}" min="0" step="100"></label>
              <span class="cq-line-note">${l.unit === 'sheet' && l.coverage ? `1 sheet ≈ ${l.coverage.toFixed(2)} m²` : ''}</span>
              <span></span><span></span><span></span>
            </div>`).join('')}
        </div>`).join('');
    }

    function renderTotals() {
      const { totals, lines, quantities } = currentQuote();
      const cur = state.currency;
      const area = quantities.floorArea || 0;
      totalsEl.innerHTML = `
        <h3 class="cq-h">Quote summary</h3>
        <div class="cq-total-rows">
          <div><span>Materials</span><span>${money(totals.material, cur)}</span></div>
          <div><span>Labour</span><span>${money(totals.labour, cur)}</span></div>
          <div class="cq-sub"><span>Prime cost</span><span>${money(totals.prime, cur)}</span></div>
          <div><span>Overheads</span><span>${money(totals.overhead, cur)}</span></div>
          <div><span>Contingency</span><span>${money(totals.contingency, cur)}</span></div>
          <div><span>Profit</span><span>${money(totals.profit, cur)}</span></div>
          ${totals.discount ? `<div><span>Discount</span><span>−${money(totals.discount, cur)}</span></div>` : ''}
          <div class="cq-sub"><span>Net total</span><span>${money(totals.netTotal, cur)}</span></div>
          <div><span>VAT</span><span>${money(totals.vat, cur)}</span></div>
          <div class="cq-grand"><span>Quoted price</span><span>${money(totals.grandTotal, cur)}</span></div>
        </div>
        <div class="cq-metrics">
          <div><strong>${money(area > 0 ? totals.grandTotal / area : 0, cur)}</strong><span>per m² of floor</span></div>
          <div><strong>${lines.length}</strong><span>priced lines</span></div>
          <div><strong>${totals.prime > 0 ? (totals.labour / totals.prime * 100).toFixed(0) : 0}%</strong><span>is labour</span></div>
        </div>`;
    }

    function repriceRow(rowEl, lineId) {
      const { lines } = currentQuote();
      const l = lines.find(x => x.id === lineId);
      if (!l) { renderLines(); renderTotals(); return; }
      const cur = state.currency;
      rowEl.querySelector('[data-c="material"]').textContent = money(l.materialCost, cur);
      rowEl.querySelector('[data-c="labour"]').textContent = money(l.labourCost, cur);
      rowEl.querySelector('[data-c="total"]').textContent = money(l.total, cur);
      renderTotals(); renderStatus();
    }
    linesEl.addEventListener('input', (e) => {
      const field = e.target.dataset.f;
      if (!field) return;
      const row = e.target.closest('[data-line]') || e.target.closest('.cq-line-rates')?.previousElementSibling;
      if (!row) return;
      const id = row.dataset.line;
      state.overrides[id] = { ...state.overrides[id], [field]: parseNum(e.target) };
      repriceRow(row, id); saveProject();
    });
    linesEl.addEventListener('click', (e) => {
      const id = e.target.dataset.remove;
      if (!id) return;
      state.removed.push(id);
      renderLines(); renderTotals(); renderStatus(); saveProject();
    });
    root.querySelector('.cq-commercial').addEventListener('input', (e) => {
      const k = e.target.dataset.comm;
      if (!k) return;
      state.commercial[k] = parseNum(e.target);
      renderTotals(); renderStatus(); saveProject();
    });
    $('#cq-add-line').addEventListener('click', () => {
      state.customLines.push({ id: `custom:${Date.now()}`, name: 'New item', unit: 'each', qty: 1, wastage: 0, rate: 0, labour: 0 });
      renderLines(); renderTotals(); saveProject();
    });

    /* ================= rate book ================= */

    const ratesTableEl = $('#cq-rates-table');
    function renderRates() {
      const book = { ...defaultRateBook(state.customMaterials), ...state.rates };
      const q = ($('#cq-rates-filter').value || '').toLowerCase();
      const cur = state.currency;
      const byGroup = new Map();
      for (const [key, v] of Object.entries(book)) {
        if (q && !v.name.toLowerCase().includes(q) && !(v.group || '').toLowerCase().includes(q)) continue;
        if (!byGroup.has(v.group)) byGroup.set(v.group, []);
        byGroup.get(v.group).push([key, v]);
      }
      ratesTableEl.innerHTML = [...byGroup.entries()].map(([group, entries]) => `
        <div class="cq-group">
          <div class="cq-group-head"><h4>${escapeHtml(group || 'Other')}</h4><span>${entries.length} items</span></div>
          <div class="cq-rate-row cq-rate-head"><span>Item</span><span>Unit</span><span class="ta-right">Material rate (${cur})</span><span class="ta-right">Labour rate (${cur})</span><span class="ta-right">Waste %</span></div>
          ${entries.map(([key, v]) => `
            <div class="cq-rate-row" data-rate="${escapeHtml(key)}">
              <span class="cq-line-name">${escapeHtml(v.name)}</span>
              <span class="cq-line-unit">${UNITS[v.unit]?.label ?? v.unit}</span>
              <input type="number" class="tool-input ta-right" data-r="rate" value="${v.rate}" min="0" step="500" aria-label="Material rate">
              <input type="number" class="tool-input ta-right" data-r="labour" value="${v.labour}" min="0" step="500" aria-label="Labour rate">
              <input type="number" class="tool-input ta-right" data-r="wastage" value="${v.wastage}" min="0" max="60" step="1" aria-label="Wastage %">
            </div>`).join('')}
        </div>`).join('') || `<p class="cb-empty">Nothing matches that.</p>`;
    }

    const matListEl = $('#cq-mat-list'), matForm = $('#cq-mat-form'), matUnit = $('#mat-unit');
    function renderMaterials() {
      if (!state.customMaterials.length) { matListEl.innerHTML = '<p class="cb-empty">No materials of your own yet.</p>'; return; }
      const byElement = new Map(CUSTOM_TARGETS.map(t => [t.id, t.name]));
      matListEl.innerHTML = state.customMaterials.map(m => `
        <div class="cq-mat-row">
          <div class="fz-name"><strong>${escapeHtml(m.name)}</strong>
            <span class="fz-meta">${escapeHtml(byElement.get(m.element) ?? m.element)} · ${money(m.rate, state.currency)} + ${money(m.labour, state.currency)} labour per ${UNITS[m.unit]?.label ?? m.unit}${m.wastage ? ' · ' + m.wastage + '% wastage' : ''}</span></div>
          <button class="btn btn-sm ct-del" data-mat-remove="${escapeHtml(m.id)}" aria-label="Remove ${escapeHtml(m.name)}">${icon('x')}</button>
        </div>`).join('');
    }
    const syncMatUnit = () => { $('#mat-cov-wrap').hidden = matUnit.value !== 'sheet'; };
    matUnit.addEventListener('change', syncMatUnit);
    $('#cq-mat-add').addEventListener('click', () => { matForm.hidden = !matForm.hidden; if (!matForm.hidden) $('#mat-name').focus(); });
    $('#cq-mat-cancel').addEventListener('click', () => { matForm.hidden = true; });
    matForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#mat-name').value.trim();
      if (!name) return;
      const unit = matUnit.value;
      state.customMaterials.push({
        id: `mine-${Date.now().toString(36)}`, element: $('#mat-element').value, name, unit,
        coverage: unit === 'sheet' ? parseNum($('#mat-coverage')) : null,
        rate: parseNum($('#mat-rate')), labour: parseNum($('#mat-labour')), wastage: parseNum($('#mat-wastage')),
      });
      persist(); matForm.reset(); matForm.hidden = true; syncMatUnit();
      renderMaterials(); renderSpec(); renderRates();
    });
    matListEl.addEventListener('click', (e) => {
      const id = e.target.dataset.matRemove;
      if (!id) return;
      state.customMaterials = state.customMaterials.filter(m => m.id !== id);
      for (const [k, v] of Object.entries(state.spec)) if (v === id) state.spec[k] = 'none';
      persist(); renderMaterials(); renderSpec(); renderRates(); renderLines(); renderTotals();
    });
    ratesTableEl.addEventListener('input', (e) => {
      const f = e.target.dataset.r;
      if (!f) return;
      const key = e.target.closest('[data-rate]').dataset.rate;
      const book = defaultRateBook(state.customMaterials);
      state.rates[key] = { ...book[key], ...state.rates[key], [f]: parseNum(e.target) };
      persist(); renderStatus();
    });
    $('#cq-rates-filter').addEventListener('input', renderRates);
    $('#cq-rates-export').addEventListener('click', () => {
      const payload = { exported: new Date().toISOString(), currency: state.currency, materials: state.customMaterials, rates: { ...defaultRateBook(state.customMaterials), ...state.rates } };
      download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `rate-book-${today()}.json`);
    });
    const fileInput = $('#cq-rates-file');
    $('#cq-rates-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        state.rates = data.rates || data;
        if (Array.isArray(data.materials)) state.customMaterials = data.materials;
        persist(); renderMaterials(); renderRates(); renderSpec(); renderLines(); renderTotals(); renderStatus();
      } catch { tbAlert('That file could not be read as a rate book.'); }
      fileInput.value = '';
    });
    $('#cq-rates-reset').addEventListener('click', () => { state.rates = {}; persist(); renderRates(); renderLines(); renderTotals(); renderStatus(); });

    /* ================= company, CSV, print ================= */

    const coIds = { name: 'co-name', phone: 'co-phone', email: 'co-email', regNo: 'co-regno', address: 'co-address', clientAddress: 'co-clientaddress', scope: 'co-scope', terms: 'co-terms' };
    for (const [f, id] of Object.entries(coIds)) $(`#${id}`).value = state.company[f] ?? '';
    $('#cq-quoteno').value = state.company.quoteNo;
    $('#cq-date').value = state.company.date;
    $('#cq-client').value = state.company.client;
    root.querySelector('[data-panel="quote"]').addEventListener('input', (e) => {
      for (const [f, id] of Object.entries(coIds)) if (e.target.id === id) { state.company[f] = e.target.value; persist(); }
      if (e.target.id === 'cq-quoteno') { state.company.quoteNo = e.target.value; persist(); }
      if (e.target.id === 'cq-date') { state.company.date = e.target.value; persist(); }
      if (e.target.id === 'cq-client') { state.company.client = e.target.value; persist(); }
    });
    $('#cq-currency').addEventListener('change', (e) => { state.currency = e.target.value; renderLines(); renderTotals(); renderRates(); renderStatus(); saveProject(); });

    $('#cq-csv').addEventListener('click', () => {
      const { lines, totals } = currentQuote();
      const cur = state.currency;
      downloadCSV(`quote-${state.company.quoteNo || 'container'}`,
        ['Group', 'Material', 'Unit', 'Quantity', 'Wastage %', 'Charged qty', `Rate (${cur})`, `Material cost (${cur})`, `Labour (${cur})`, `Total (${cur})`],
        [
          ...lines.map(l => [l.group, l.name, UNITS[l.unit]?.label ?? l.unit, l.qty.toFixed(2), l.wastage, l.chargeQty.toFixed(2), l.rate.toFixed(2), l.materialCost.toFixed(2), l.labourCost.toFixed(2), l.total.toFixed(2)]),
          ['', 'PRIME COST', '', '', '', '', '', totals.material.toFixed(2), totals.labour.toFixed(2), totals.prime.toFixed(2)],
          ['', 'QUOTED PRICE (incl. VAT)', '', '', '', '', '', '', '', totals.grandTotal.toFixed(2)],
        ]);
    });

    const sheetEl = container.querySelector('#cq-sheet');
    $('#cq-print').addEventListener('click', () => {
      const { lines, totals, quantities } = currentQuote();
      const cur = state.currency, co = state.company, u = state.unit;
      const unitsList = state.units.map(x => `${escapeHtml(unitName(x))}${x.level ? ` (${levelName(x.level).toLowerCase()})` : ''}`).join(', ');
      sheetEl.innerHTML = `
        <header class="cqs-head">
          <div><h1>${escapeHtml(co.name || 'Quotation')}</h1><div class="cqs-sub">${escapeHtml(co.address || '')}</div>
            <div class="cqs-sub">${[co.phone, co.email, co.regNo && `RC ${co.regNo}`].filter(Boolean).map(escapeHtml).join(' · ')}</div></div>
          <div class="cqs-badge"><span>Quotation</span><strong>${escapeHtml(co.quoteNo || '')}</strong><span>${fmtDate(co.date)}</span></div>
        </header>
        <section class="cqs-parties">
          <div><h3>Prepared for</h3><div>${escapeHtml(co.client || '—')}</div><div>${escapeHtml(co.clientAddress || '')}</div></div>
          <div><h3>${escapeHtml(state.name)}</h3><div>${unitsList}</div><div>${fmtArea(quantities.floorArea, u)} floor area</div></div>
          <div><h3>Validity</h3><div>${COMMERCIAL_DEFAULTS.validityDays} days from ${fmtDate(co.date)}</div></div>
        </section>
        ${co.scope ? `<section class="cqs-scope"><h3>Scope of works</h3><p>${escapeHtml(co.scope)}</p></section>` : ''}
        ${groupLines(lines).map(group => `
          <table class="cqs-table">
            <thead><tr><th colspan="7" class="cqs-group">${escapeHtml(group.name)}</th></tr>
              <tr><th>Material</th><th>Unit</th><th class="ta-right">Qty</th><th class="ta-right">Waste</th><th class="ta-right">Material</th><th class="ta-right">Labour</th><th class="ta-right">Total</th></tr></thead>
            <tbody>
              ${group.items.map(l => `<tr><td>${escapeHtml(l.name)}</td><td>${UNITS[l.unit]?.label ?? l.unit}</td><td class="ta-right">${num(l.qty, l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}</td>
                <td class="ta-right">${l.wastage ? l.wastage + '%' : '—'}</td><td class="ta-right">${money(l.materialCost, cur)}</td><td class="ta-right">${money(l.labourCost, cur)}</td><td class="ta-right">${money(l.total, cur)}</td></tr>`).join('')}
              <tr class="cqs-subtotal"><td colspan="6">${escapeHtml(group.name)} subtotal</td><td class="ta-right">${money(group.subtotal, cur)}</td></tr>
            </tbody></table>`).join('')}
        <section class="cqs-totals">
          <div><span>Materials</span><span>${money(totals.material, cur)}</span></div>
          <div><span>Labour</span><span>${money(totals.labour, cur)}</span></div>
          <div class="cqs-line"><span>Prime cost</span><span>${money(totals.prime, cur)}</span></div>
          <div><span>Overheads &amp; contingency</span><span>${money(totals.overhead + totals.contingency, cur)}</span></div>
          <div><span>Profit</span><span>${money(totals.profit, cur)}</span></div>
          ${totals.discount ? `<div><span>Discount</span><span>−${money(totals.discount, cur)}</span></div>` : ''}
          <div class="cqs-line"><span>Net total</span><span>${money(totals.netTotal, cur)}</span></div>
          <div><span>VAT @ ${num(state.commercial.vatPct, 1)}%</span><span>${money(totals.vat, cur)}</span></div>
          <div class="cqs-grand"><span>Total quoted price</span><span>${money(totals.grandTotal, cur)}</span></div>
        </section>
        ${co.terms ? `<section class="cqs-terms"><h3>Terms</h3>${escapeHtml(co.terms).split('\n').map(l => `<p>${l}</p>`).join('')}</section>` : ''}
        <section class="cqs-sign"><div><span>For ${escapeHtml(co.name || '')}</span><div class="cqs-rule"></div></div><div><span>Accepted by the client</span><div class="cqs-rule"></div></div></section>
        <p class="cqs-foot">Quantities measured from the modelled units. Material rates include a wastage allowance; labour is charged on net measured quantity. Structural items are preliminary and subject to an engineer's design. Prepared with Toolbox.</p>`;
      window.print();
    });

    function renderQuoteDependents({ keepSpec = false } = {}) {
      if (!keepSpec) renderSpec();
      renderTakeoff(); renderLines(); renderTotals();
    }

    /* ---------------- go ---------------- */

    for (const [k, v] of Object.entries(state.commercial)) { const el = root.querySelector(`[data-comm="${k}"]`); if (el) el.value = v; }
    $('#cq-currency').value = state.currency;
    rebuild();
    renderInspector();
    renderStatus();
    renderPlace();
    frameAll();
    renderMaterials();
    if (handoff?.notes?.length) toast(`From the Assistant: ${handoff.notes.slice(0, 2).join('; ')}`);
  },

  destroy() {
    this._alive = false;
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._ro?.disconnect();
    closeContextMenu();
    this._viewer?.dispose();
    this._viewer = null;
  },
};
