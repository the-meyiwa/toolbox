/* ============================================================
   Container & Cabin Quote Builder

   Model the unit in 3D, specify what it is built from, and the bill of
   quantities prices itself off the geometry. Every quantity, rate and
   labour figure stays editable, because a quote the estimator cannot
   overrule is useless.

   Rates live in the browser and can be exported, so the price book
   survives a market that moves monthly.
   ============================================================ */

import { money, num, parseNum, escapeHtml, downloadCSV } from '../lib/biz.js';
import {
  SERVICES,
  LOGISTICS,
  UNITS,
  COMMERCIAL_DEFAULTS,
  RATES_REVISED,
  defaultRateBook,
  elementsWith,
  CUSTOM_TARGETS,
} from '../lib/container-catalog.js';
import { buildQuote, groupLines } from '../lib/container-quote.js';

const M_PER_FT = 0.3048;
const LS_RATES   = 'toolbox.container.rates';
const LS_COMPANY = 'toolbox.container.company';
const LS_MATERIALS = 'toolbox.container.materials';

/* ---------------- presets (metres, internal usable size) ---------------- */

const PRESETS = [
  { group: 'Shipping containers', items: [
    { id: '10ft', name: '10 ft container',   len: 2.831,  wid: 2.352, hgt: 2.393, shell: 'buy-20' },
    { id: '20ft', name: '20 ft container',   len: 5.898,  wid: 2.352, hgt: 2.393, shell: 'buy-20' },
    { id: '40ft', name: '40 ft container',   len: 12.032, wid: 2.352, hgt: 2.393, shell: 'buy-40' },
    { id: '40hc', name: '40 ft high cube',   len: 12.032, wid: 2.352, hgt: 2.698, shell: 'buy-40hc' },
    { id: '45hc', name: '45 ft high cube',   len: 13.556, wid: 2.352, hgt: 2.698, shell: 'buy-40hc' },
  ]},
  { group: 'Portacabins', items: [
    { id: 'pc12', name: '12 ft × 8 ft cabin',  len: 3.658, wid: 2.438, hgt: 2.400, shell: 'fabricate' },
    { id: 'pc16', name: '16 ft × 8 ft cabin',  len: 4.877, wid: 2.438, hgt: 2.400, shell: 'fabricate' },
    { id: 'pc20', name: '20 ft × 8 ft cabin',  len: 6.096, wid: 2.438, hgt: 2.400, shell: 'fabricate' },
    { id: 'pc24', name: '24 ft × 9 ft cabin',  len: 7.315, wid: 2.743, hgt: 2.500, shell: 'fabricate' },
    { id: 'pc32', name: '32 ft × 10 ft cabin', len: 9.754, wid: 3.048, hgt: 2.500, shell: 'fabricate' },
  ]},
];

const OPENINGS = {
  'personnel-door': { name: 'Door',            w: 0.90, h: 2.00, sill: 0,    color: 0x6b4c33 },
  'double-door':    { name: 'Double door',     w: 1.80, h: 2.00, sill: 0,    color: 0x6b4c33 },
  'roller-door':    { name: 'Roller shutter',  w: 2.20, h: 2.10, sill: 0,    color: 0x9aa3a8 },
  'window':         { name: 'Window',          w: 1.20, h: 1.00, sill: 0.95, color: 0x9fc6d8 },
  'small-window':   { name: 'Small window',    w: 0.60, h: 0.60, sill: 1.30, color: 0x9fc6d8 },
  'vent':           { name: 'Air vent',        w: 0.30, h: 0.25, sill: 2.00, color: 0x8a9298 },
};

const FITTINGS = {
  partition: { name: 'Partition wall', w: 0.10, d: 2.35, h: 2.30, color: 0xe4e0d8, isWall: true },
  desk:      { name: 'Desk',           w: 1.40, d: 0.70, h: 0.75, color: 0xb08d5f },
  chair:     { name: 'Chair',          w: 0.55, d: 0.55, h: 0.95, color: 0x555b60 },
  bed:       { name: 'Bed',            w: 0.90, d: 1.90, h: 0.55, color: 0x8f7f6a },
  bunk:      { name: 'Bunk beds',      w: 0.90, d: 1.90, h: 1.70, color: 0x8f7f6a },
  kitchen:   { name: 'Kitchen unit',   w: 1.80, d: 0.60, h: 0.90, color: 0xc9c4bb },
  toilet:    { name: 'Toilet cubicle', w: 0.90, d: 1.20, h: 2.10, color: 0xdfe3e6 },
  shower:    { name: 'Shower',         w: 0.90, d: 0.90, h: 2.10, color: 0xdfe3e6 },
  rack:      { name: 'Storage rack',   w: 1.80, d: 0.50, h: 2.00, color: 0x7d8388 },
  cabinet:   { name: 'Cabinet',        w: 0.80, d: 0.45, h: 1.80, color: 0xa89a86 },
  table:     { name: 'Table',          w: 1.60, d: 0.80, h: 0.75, color: 0xb08d5f },
};

const WALLS = [
  { id: 'front', name: 'Front (door end)' },
  { id: 'back',  name: 'Back end' },
  { id: 'left',  name: 'Left side' },
  { id: 'right', name: 'Right side' },
];

const SHELL_COLORS = [
  { id: 'green', name: 'Green', hex: 0x3f6b52 }, { id: 'blue',  name: 'Blue',  hex: 0x2f5f86 },
  { id: 'red',   name: 'Red',   hex: 0x8d3a32 }, { id: 'grey',  name: 'Grey',  hex: 0x6f7479 },
  { id: 'white', name: 'White', hex: 0xdedbd4 }, { id: 'sand',  name: 'Sand',  hex: 0xbfa87e },
];

/* Subtract a hole from a set of rectangles so a wall can be built as
   flat panels around its openings without needing CSG. */
function subtractRect(rects, hole) {
  const out = [];
  for (const r of rects) {
    const overlaps = hole.x0 < r.x1 && hole.x1 > r.x0 && hole.y0 < r.y1 && hole.y1 > r.y0;
    if (!overlaps) { out.push(r); continue; }
    if (hole.y0 > r.y0) out.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: hole.y0 });
    if (hole.y1 < r.y1) out.push({ x0: r.x0, x1: r.x1, y0: hole.y1, y1: r.y1 });
    const yLo = Math.max(r.y0, hole.y0), yHi = Math.min(r.y1, hole.y1);
    if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, y0: yLo, y1: yHi });
    if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, y0: yLo, y1: yHi });
  }
  return out.filter(r => r.x1 - r.x0 > 0.002 && r.y1 - r.y0 > 0.002);
}

function fmtLen(metres, unit) {
  if (unit === 'm') return `${metres.toFixed(2)} m`;
  const totalIn = metres / M_PER_FT * 12;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1} ft` : inch ? `${ft} ft ${inch} in` : `${ft} ft`;
}

const fmtArea = (m2, u) => u === 'm' ? `${m2.toFixed(1)} m²` : `${(m2 * 10.7639).toFixed(0)} sq ft`;
const fmtVol  = (m3, u) => u === 'm' ? `${m3.toFixed(1)} m³` : `${(m3 * 35.3147).toFixed(0)} cu ft`;

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined,
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/* ============================================================ */

export default {
  async render(container) {
    this._alive = true;

    container.innerHTML = `<div class="t3d-loading"><div class="t3d-spinner"></div><p>Getting the workspace ready…</p></div>`;

    let THREE, Viewer3D;
    try {
      ({ Viewer3D, THREE } = await import('../lib/viewer3d.js'));
    } catch (err) {
      container.innerHTML = `<div class="no-results"><p class="no-results-title">Could not start the 3D view</p>
        <p class="no-results-text">${err.message}</p></div>`;
      return;
    }
    if (!this._alive) return;

    /* ---------------- state ---------------- */

    const saved = (key, fallback) => {
      try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
      catch { return { ...fallback }; }
    };

    const state = {
      preset: '20ft',
      len: 5.898, wid: 2.352, hgt: 2.393,
      unit: 'ft', currency: 'NGN', color: 'green',
      showRoof: false,
      items: [], selected: null, nextKey: 1,

      spec: {
        shell: 'buy-20', prep: 'full', exterior: 'paint', insulation: 'pu25',
        framing: 'steel40', interior: 'ply9', ceiling: 'pvc', floor: 'vinyl',
        subfloor: 'marine18', paint: 'emulsion',
      },
      services: {}, logistics: {},
      overrides: {}, removed: [], customLines: [],

      // Materials the user added themselves. These behave exactly like
      // catalogue entries: same dropdowns, same pricing, same export.
      customMaterials: (() => {
        try { return JSON.parse(localStorage.getItem(LS_MATERIALS) || '[]'); }
        catch { return []; }
      })(),
      commercial: { ...COMMERCIAL_DEFAULTS, discount: 0 },

      company: saved(LS_COMPANY, {
        name: 'Neoterm Projects',
        address: '35 Ladipo Labinjo Crescent, Surulere, Lagos',
        phone: '', email: '', regNo: '',
        client: '', clientAddress: '',
        quoteNo: `NP-${new Date().getFullYear()}-001`,
        date: today(),
        scope: 'Supply and conversion of a shipping container into a fitted office unit.',
        terms: 'Prices valid for 30 days. 70% deposit on order, balance on delivery.\nLead time 3–4 weeks from receipt of deposit.\nPrices subject to change if material costs move before order confirmation.',
      }),
      rates: saved(LS_RATES, {}),
      tab: 'layout',
    };

    const persist = () => {
      try {
        localStorage.setItem(LS_RATES, JSON.stringify(state.rates));
        localStorage.setItem(LS_COMPANY, JSON.stringify(state.company));
        localStorage.setItem(LS_MATERIALS, JSON.stringify(state.customMaterials));
      } catch { /* private mode — not worth interrupting the user */ }
    };

    /* ---------------- shell markup ---------------- */

    const presetOptions = PRESETS.map(g =>
      `<optgroup label="${g.group}">${g.items.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</optgroup>`
    ).join('') + `<optgroup label="Other"><option value="custom">Custom size…</option></optgroup>`;

    container.innerHTML = `
      <div class="cq">
        <nav class="cq-tabs" id="cq-tabs" role="tablist">
          <button class="cq-tab is-active" data-tab="layout">1 · Layout</button>
          <button class="cq-tab" data-tab="spec">2 · Specification</button>
          <button class="cq-tab" data-tab="quote">3 · Quote</button>
          <button class="cq-tab" data-tab="rates">4 · Rates</button>
        </nav>

        <!-- ============ LAYOUT ============ -->
        <section class="cq-panel" data-panel="layout">
          <div class="cp">
            <aside class="cp-panel">
              <section class="cp-step">
                <h3 class="cp-step-h"><span class="cp-num">1</span> Choose the unit</h3>
                <select id="cp-preset" class="tool-select cp-big">${presetOptions}</select>
                <div id="cp-custom" class="cp-custom" hidden>
                  <label class="cp-field"><span>Length</span><input type="number" id="cp-len" class="tool-input" step="0.1" min="1"></label>
                  <label class="cp-field"><span>Width</span><input type="number" id="cp-wid" class="tool-input" step="0.1" min="1"></label>
                  <label class="cp-field"><span>Height</span><input type="number" id="cp-hgt" class="tool-input" step="0.1" min="1.5"></label>
                </div>
                <div class="cp-row">
                  <span class="cp-row-label">Measure in</span>
                  <div class="btn-group t3d-seg" id="cp-unit">
                    <button class="btn btn-sm is-active" data-unit="ft">Feet</button>
                    <button class="btn btn-sm" data-unit="m">Metres</button>
                  </div>
                </div>
                <div class="cp-row">
                  <span class="cp-row-label">Colour</span>
                  <div class="cp-swatches" id="cp-colors">
                    ${SHELL_COLORS.map(c => `<button class="cp-swatch${c.id === 'green' ? ' is-active' : ''}" data-color="${c.id}"
                       title="${c.name}" aria-label="${c.name}" style="background:#${c.hex.toString(16).padStart(6, '0')}"></button>`).join('')}
                  </div>
                </div>
              </section>

              <section class="cp-step">
                <h3 class="cp-step-h"><span class="cp-num">2</span> Doors &amp; windows</h3>
                <div class="cp-add-grid" id="cp-add-openings">
                  ${Object.entries(OPENINGS).map(([k, v]) => `<button class="cp-add" data-opening="${k}">+ ${v.name}</button>`).join('')}
                </div>
              </section>

              <section class="cp-step">
                <h3 class="cp-step-h"><span class="cp-num">3</span> Walls &amp; furniture</h3>
                <div class="cp-add-grid" id="cp-add-fittings">
                  ${Object.entries(FITTINGS).map(([k, v]) => `<button class="cp-add" data-fitting="${k}">+ ${v.name}</button>`).join('')}
                </div>
              </section>

              <section class="cp-step">
                <h3 class="cp-step-h"><span class="cp-num">4</span> What you have added</h3>
                <div id="cp-items" class="cp-items"></div>
              </section>
            </aside>

            <div class="t3d-stage">
              <div class="t3d-canvas" id="cp-canvas"></div>
              <div class="t3d-toolbar">
                <div class="btn-group t3d-seg" id="cp-views">
                  <button class="btn btn-sm is-active" data-view="iso">3D view</button>
                  <button class="btn btn-sm" data-view="top">Floor plan</button>
                  <button class="btn btn-sm" data-view="front">Front</button>
                  <button class="btn btn-sm" data-view="left">Side</button>
                </div>
                <div class="t3d-toolbar-right">
                  <label class="tool-checkbox"><input type="checkbox" id="cp-roof"> <span>Show roof</span></label>
                </div>
              </div>
              <div class="cp-summary" id="cp-summary"></div>
              <div class="cp-editor" id="cp-editor" hidden></div>
            </div>
          </div>
        </section>

        <!-- ============ SPECIFICATION ============ -->
        <section class="cq-panel" data-panel="spec" hidden>
          <div class="cq-spec">
            <div>
              <h3 class="cq-h">Build-up</h3>
              <p class="biz-hint" style="margin-bottom:18px;">Choose what each part is made from. Quantities come off the model automatically.</p>
              <div id="cq-elements"></div>
            </div>
            <div>
              <h3 class="cq-h">Services &amp; installations</h3>
              <p class="biz-hint" style="margin-bottom:18px;">Suggested from the floor area. Change any figure to suit the job.</p>
              <div id="cq-services"></div>

              <h3 class="cq-h" style="margin-top:28px;">Logistics</h3>
              <div id="cq-logistics"></div>
            </div>
          </div>
          <div id="cq-takeoff" class="cq-takeoff"></div>
        </section>

        <!-- ============ QUOTE ============ -->
        <section class="cq-panel" data-panel="quote" hidden>
          <div class="cq-meta">
            <div class="biz-field"><label class="tool-label" for="cq-currency">Currency</label>
              <select class="tool-select" id="cq-currency">
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GHS">GHS — Ghanaian Cedi (₵)</option>
                <option value="ZAR">ZAR — South African Rand (R)</option>
              </select></div>
            <div class="biz-field"><label class="tool-label" for="cq-quoteno">Quote number</label>
              <input type="text" class="tool-input" id="cq-quoteno"></div>
            <div class="biz-field"><label class="tool-label" for="cq-date">Date</label>
              <input type="date" class="tool-input" id="cq-date"></div>
            <div class="biz-field"><label class="tool-label" for="cq-client">Client</label>
              <input type="text" class="tool-input" id="cq-client" placeholder="Client name"></div>
          </div>

          <div id="cq-lines"></div>

          <div class="cq-bottom">
            <div class="cq-commercial">
              <h3 class="cq-h">Mark-ups</h3>
              <div class="cq-comm-grid">
                <label class="cp-field"><span>Overheads %</span><input type="number" class="tool-input" data-comm="overheadPct" step="0.5" min="0"></label>
                <label class="cp-field"><span>Contingency %</span><input type="number" class="tool-input" data-comm="contingencyPct" step="0.5" min="0"></label>
                <label class="cp-field"><span>Profit %</span><input type="number" class="tool-input" data-comm="profitPct" step="0.5" min="0"></label>
                <label class="cp-field"><span>VAT %</span><input type="number" class="tool-input" data-comm="vatPct" step="0.5" min="0"></label>
                <label class="cp-field"><span>Discount</span><input type="number" class="tool-input" data-comm="discount" step="1000" min="0"></label>
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
        </section>

        <!-- ============ RATES ============ -->
        <section class="cq-panel" data-panel="rates" hidden>
          <div class="cq-rates-head">
            <div>
              <h3 class="cq-h">Rate book</h3>
              <p class="biz-hint">Seed rates were last reviewed <strong>${fmtDate(RATES_REVISED)}</strong>.
                Prices move — edit anything here and it is saved in this browser.
                Export the file to back it up or share it with someone else.</p>
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
                <p class="biz-hint">Anything the catalogue does not carry — your supplier's board, a finish
                  you use often. Added materials show up in the specification dropdowns and price like any other.</p>
              </div>
              <button class="btn btn-primary btn-sm" id="cq-mat-add">Add a material</button>
            </div>
            <form class="cq-mat-form" id="cq-mat-form" hidden>
              <div class="cq-mat-grid">
                <label class="cp-field"><span>What is it called?</span>
                  <input type="text" class="tool-input" id="mat-name" placeholder="e.g. 18 mm birch ply" required></label>
                <label class="cp-field"><span>Where does it go?</span>
                  <select class="tool-select" id="mat-element">
                    ${CUSTOM_TARGETS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                  </select></label>
                <label class="cp-field"><span>Sold by</span>
                  <select class="tool-select" id="mat-unit">
                    ${Object.entries(UNITS).map(([k, v]) => `<option value="${k}"${k === 'area' ? ' selected' : ''}>${v.label}</option>`).join('')}
                  </select></label>
                <label class="cp-field" id="mat-cov-wrap" hidden><span>Covers (m² per sheet)</span>
                  <input type="number" class="tool-input" id="mat-coverage" value="2.98" step="0.01" min="0.01"></label>
                <label class="cp-field"><span>Material cost per unit</span>
                  <input type="number" class="tool-input" id="mat-rate" value="0" min="0" step="100"></label>
                <label class="cp-field"><span>Labour per unit</span>
                  <input type="number" class="tool-input" id="mat-labour" value="0" min="0" step="100"></label>
                <label class="cp-field"><span>Wastage %</span>
                  <input type="number" class="tool-input" id="mat-wastage" value="10" min="0" max="60" step="1"></label>
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
        </section>
      </div>

      <div class="cq-sheet" id="cq-sheet" aria-hidden="true"></div>`;

    /* ---------------- 3D scene ---------------- */

    const mount  = container.querySelector('#cp-canvas');
    const viewer = new Viewer3D(mount, { background: 0xeceae6, ground: true, groundSize: 24, fov: 40 });
    this._viewer = viewer;
    viewer.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    const shell = new THREE.Group();
    viewer.scene.add(shell);

    const matCache = new Map();
    const M = (color, opts = {}) => {
      const key = `${color}|${JSON.stringify(opts)}`;
      if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({
          color, roughness: opts.rough ?? 0.78, metalness: opts.metal ?? 0.06,
          transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1, side: THREE.DoubleSide,
        }));
      }
      return matCache.get(key);
    };

    const WALL_T = 0.06;

    function clearGroup(g) {
      for (let i = g.children.length - 1; i >= 0; i--) {
        const c = g.children[i];
        c.traverse?.(n => { if (n.isMesh) n.geometry.dispose(); });
        g.remove(c);
      }
    }

    const wallSpan = (id) => (id === 'front' || id === 'back') ? state.wid : state.len;

    const holesFor = (wallId) => state.items
      .filter(it => it.kind === 'opening' && it.wall === wallId)
      .map(it => ({ x0: it.along - it.w / 2, x1: it.along + it.w / 2, y0: it.sill, y1: it.sill + it.h }));

    function placePanel(wallId, r, thickness, material) {
      const { len, wid } = state;
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      let mesh;
      if (wallId === 'front' || wallId === 'back') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, h, w), material);
        const sign = wallId === 'front' ? 1 : -1;
        mesh.position.set(sign * (len / 2 + thickness / 2), cy, sign * (cx - wid / 2));
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), material);
        const sign = wallId === 'left' ? -1 : 1;
        mesh.position.set(-(cx - len / 2) * sign, cy, sign * (wid / 2 + thickness / 2));
      }
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    }

    function buildShell() {
      clearGroup(shell);
      viewer.pickables.length = 0;
      const { len, wid, hgt } = state;
      const shellHex = SHELL_COLORS.find(c => c.id === state.color).hex;

      const floor = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T * 2, 0.08, wid + WALL_T * 2), M(0x8b8378, { rough: 0.95 }));
      floor.position.y = -0.04; floor.receiveShadow = true; floor.name = '__floor';
      shell.add(floor);

      const inner = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), M(0xb9ac97, { rough: 1 }));
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.002;
      inner.receiveShadow = true; inner.name = '__floorface';
      shell.add(inner);

      for (const wall of WALLS) {
        let rects = [{ x0: 0, x1: wallSpan(wall.id), y0: 0, y1: hgt }];
        for (const hole of holesFor(wall.id)) rects = subtractRect(rects, hole);
        for (const r of rects) shell.add(placePanel(wall.id, r, WALL_T, M(shellHex)));
      }

      if (state.showRoof) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T * 2, 0.07, wid + WALL_T * 2), M(shellHex, { rough: 0.7 }));
        roof.position.y = hgt + 0.035; roof.castShadow = true; roof.name = '__roof';
        shell.add(roof);
      }

      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, 1]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.17), M(0x4a4d50, { metal: 0.4, rough: 0.5 }));
        c.position.set(sx * (len / 2 + WALL_T - 0.06), sy ? hgt - 0.06 : 0.06, sz * (wid / 2 + WALL_T - 0.06));
        c.name = '__corner';
        shell.add(c);
      }

      buildItems();
      updateSummary();
    }

    function buildItems() {
      for (const it of state.items) {
        const group = new THREE.Group();
        group.userData.item = it;

        if (it.kind === 'opening') {
          const spec = OPENINGS[it.type];
          const isGlass = it.type.includes('window');
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, it.h, it.w),
            M(spec.color, isGlass ? { opacity: 0.42, rough: 0.15, metal: 0.1 } : { rough: 0.6 }));
          const { len, wid } = state;
          if (it.wall === 'front' || it.wall === 'back') {
            const sign = it.wall === 'front' ? 1 : -1;
            panel.position.set(sign * (len / 2 + WALL_T / 2), it.sill + it.h / 2, sign * (it.along - wid / 2));
          } else {
            const sign = it.wall === 'left' ? -1 : 1;
            panel.geometry.dispose();
            panel.geometry = new THREE.BoxGeometry(it.w, it.h, 0.03);
            panel.position.set(-(it.along - len / 2) * sign, it.sill + it.h / 2, sign * (wid / 2 + WALL_T / 2));
          }
          panel.castShadow = !isGlass;
          group.add(panel);
        } else {
          const spec = FITTINGS[it.type];
          const w = it.rot % 2 ? spec.d : spec.w;
          const d = it.rot % 2 ? spec.w : spec.d;
          const h = spec.isWall ? Math.min(spec.h, state.hgt) : spec.h;
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(spec.color, { rough: 0.85 }));
          body.position.set(it.x - state.len / 2, h / 2, it.z - state.wid / 2);
          body.castShadow = true; body.receiveShadow = true;
          group.add(body);
        }

        shell.add(group);
        viewer.registerPickable(group);
      }

      const sel = state.selected != null ? shell.children.find(c => c.userData.item?.key === state.selected) : null;
      viewer.selected = null;
      viewer.select(sel || null);
    }

    /* ---------------- layout summary & item editing ---------------- */

    const summaryEl = container.querySelector('#cp-summary');
    const itemsEl   = container.querySelector('#cp-items');
    const editorEl  = container.querySelector('#cp-editor');

    const itemName = (it) => it.kind === 'opening' ? OPENINGS[it.type].name : FITTINGS[it.type].name;

    function updateSummary() {
      const u = state.unit;
      const gross = state.len * state.wid;
      const doors   = state.items.filter(i => i.kind === 'opening' && i.type.includes('door')).length;
      const windows = state.items.filter(i => i.kind === 'opening' && i.type.includes('window')).length;
      summaryEl.innerHTML = `
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.len, u)}</span><span class="cp-stat-l">Length</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.wid, u)}</span><span class="cp-stat-l">Width</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.hgt, u)}</span><span class="cp-stat-l">Height</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtArea(gross, u)}</span><span class="cp-stat-l">Floor area</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtVol(gross * state.hgt, u)}</span><span class="cp-stat-l">Volume</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${doors}</span><span class="cp-stat-l">Doors</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${windows}</span><span class="cp-stat-l">Windows</span></div>`;
    }

    function renderItems() {
      if (!state.items.length) {
        itemsEl.innerHTML = `<p class="cp-empty">Nothing added yet. Use the buttons above to add a door, a window, or some furniture.</p>`;
        return;
      }
      itemsEl.innerHTML = state.items.map(it => `
        <button class="cp-item${state.selected === it.key ? ' is-selected' : ''}" data-key="${it.key}">
          <span class="cp-item-name">${itemName(it)}</span>
          <span class="cp-item-where">${it.kind === 'opening'
            ? WALLS.find(w => w.id === it.wall).name
            : `${fmtLen(it.x, state.unit)} from back`}</span>
        </button>`).join('');
    }

    function renderEditor() {
      const it = state.items.find(i => i.key === state.selected);
      if (!it) { editorEl.hidden = true; editorEl.innerHTML = ''; return; }
      editorEl.hidden = false;
      const u = state.unit;
      const toDisplay = (m) => u === 'm' ? m.toFixed(2) : (m / M_PER_FT).toFixed(2);
      const step = u === 'm' ? 0.05 : 0.25;
      const unitWord = u === 'm' ? 'metres' : 'feet';

      if (it.kind === 'opening') {
        editorEl.innerHTML = `
          <div class="cp-editor-head"><h4>${itemName(it)}</h4>
            <button class="btn btn-sm cp-delete" id="cp-del">Remove this</button></div>
          <div class="cp-editor-grid">
            <label class="cp-field"><span>Which wall</span>
              <select class="tool-select" data-prop="wall">
                ${WALLS.map(w => `<option value="${w.id}"${w.id === it.wall ? ' selected' : ''}>${w.name}</option>`).join('')}
              </select></label>
            <label class="cp-field"><span>Distance from the left corner (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="along" step="${step}" min="0" max="${toDisplay(wallSpan(it.wall))}" value="${toDisplay(it.along)}"></label>
            <label class="cp-field"><span>Width (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="w" step="${step}" min="0.1" value="${toDisplay(it.w)}"></label>
            <label class="cp-field"><span>Height (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="h" step="${step}" min="0.1" value="${toDisplay(it.h)}"></label>
            <label class="cp-field"><span>Height off the floor (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="sill" step="${step}" min="0" value="${toDisplay(it.sill)}"></label>
          </div>
          <p class="cp-hint">Measured from the left-hand corner as you look at that wall from outside.</p>`;
      } else {
        editorEl.innerHTML = `
          <div class="cp-editor-head"><h4>${itemName(it)}</h4>
            <div class="cp-editor-actions">
              <button class="btn btn-sm" id="cp-rotate">Turn 90°</button>
              <button class="btn btn-sm cp-delete" id="cp-del">Remove this</button>
            </div></div>
          <div class="cp-editor-grid">
            <label class="cp-field"><span>Distance from the back end (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="x" step="${step}" min="0" max="${toDisplay(state.len)}" value="${toDisplay(it.x)}"></label>
            <label class="cp-field"><span>Distance from the left side (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="z" step="${step}" min="0" max="${toDisplay(state.wid)}" value="${toDisplay(it.z)}"></label>
          </div>
          <p class="cp-hint">Measured to the centre of the item.</p>`;
      }
    }

    function refreshLayout({ geometry = true } = {}) {
      if (geometry) buildShell(); else updateSummary();
      renderItems();
      renderEditor();
      renderQuoteDependents();
    }

    /* ---------------- adding items ---------------- */

    function addOpening(type) {
      const spec = OPENINGS[type];
      const wall = type.includes('door') ? 'front' : 'left';
      const span = wallSpan(wall);
      const it = {
        key: state.nextKey++, kind: 'opening', type, wall,
        along: Math.min(span / 2, span - spec.w / 2 - 0.1),
        w: Math.min(spec.w, span - 0.2),
        h: Math.min(spec.h, state.hgt - 0.1),
        sill: Math.min(spec.sill, Math.max(state.hgt - spec.h - 0.05, 0)),
      };
      state.items.push(it);
      state.selected = it.key;
      refreshLayout();
    }

    function addFitting(type) {
      const spec = FITTINGS[type];
      const it = {
        key: state.nextKey++, kind: 'fitting', type, rot: 0,
        x: Math.min(state.len / 2, state.len - spec.w / 2),
        z: Math.min(state.wid / 2, state.wid - spec.d / 2),
      };
      state.items.push(it);
      state.selected = it.key;
      refreshLayout();
    }

    container.querySelector('#cp-add-openings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-opening]'); if (b) addOpening(b.dataset.opening);
    });
    container.querySelector('#cp-add-fittings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fitting]'); if (b) addFitting(b.dataset.fitting);
    });

    itemsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]'); if (!b) return;
      state.selected = Number(b.dataset.key);
      refreshLayout({ geometry: false });
      viewer.select(shell.children.find(c => c.userData.item?.key === state.selected) || null);
    });

    editorEl.addEventListener('input', (e) => {
      const prop = e.target.dataset.prop; if (!prop) return;
      const it = state.items.find(i => i.key === state.selected); if (!it) return;
      if (prop === 'wall') {
        it.wall = e.target.value;
        it.along = Math.min(it.along, wallSpan(it.wall) - it.w / 2);
      } else {
        const raw = parseFloat(e.target.value);
        if (!Number.isFinite(raw)) return;
        it[prop] = state.unit === 'm' ? raw : raw * M_PER_FT;
      }
      buildShell(); renderItems(); renderQuoteDependents();
    });

    editorEl.addEventListener('click', (e) => {
      const it = state.items.find(i => i.key === state.selected); if (!it) return;
      if (e.target.id === 'cp-del') {
        state.items = state.items.filter(i => i.key !== it.key);
        state.selected = null;
        refreshLayout();
      } else if (e.target.id === 'cp-rotate') {
        it.rot = (it.rot + 1) % 4;
        refreshLayout();
      }
    });

    viewer.onSelect((obj) => {
      state.selected = obj?.userData.item?.key ?? null;
      renderItems(); renderEditor();
    });

    /* ---------------- size / unit / colour ---------------- */

    const presetSel = container.querySelector('#cp-preset');
    const customBox = container.querySelector('#cp-custom');
    const lenIn = container.querySelector('#cp-len');
    const widIn = container.querySelector('#cp-wid');
    const hgtIn = container.querySelector('#cp-hgt');

    function syncCustomInputs() {
      const f = state.unit === 'm' ? 1 : 1 / M_PER_FT;
      lenIn.value = (state.len * f).toFixed(2);
      widIn.value = (state.wid * f).toFixed(2);
      hgtIn.value = (state.hgt * f).toFixed(2);
      customBox.querySelectorAll('.cp-field > span').forEach((s, i) => {
        s.textContent = ['Length', 'Width', 'Height'][i] + (state.unit === 'm' ? ' (metres)' : ' (feet)');
      });
    }

    function clampItems() {
      for (const it of state.items) {
        if (it.kind === 'opening') {
          it.h = Math.min(it.h, state.hgt);
          it.sill = Math.min(it.sill, Math.max(state.hgt - it.h, 0));
          const span = wallSpan(it.wall);
          it.w = Math.min(it.w, span);
          it.along = Math.min(Math.max(it.along, it.w / 2), span - it.w / 2);
        } else {
          it.x = Math.min(Math.max(it.x, 0), state.len);
          it.z = Math.min(Math.max(it.z, 0), state.wid);
        }
      }
    }

    function frameShell() {
      const span = Math.max(state.len, state.wid, state.hgt);
      viewer.controls.target.set(0, state.hgt / 2, 0);
      viewer.camera.position.set(span * 0.85, span * 0.72, span * 1.05);
      viewer.controls.update();
      viewer.frame(shell, 1.25);
    }

    presetSel.addEventListener('change', () => {
      state.preset = presetSel.value;
      if (state.preset === 'custom') {
        customBox.hidden = false;
      } else {
        customBox.hidden = true;
        const p = PRESETS.flatMap(g => g.items).find(p => p.id === state.preset);
        Object.assign(state, { len: p.len, wid: p.wid, hgt: p.hgt });
        // Keep the shell line honest: a 40 ft model should not quote a 20 ft container.
        state.spec.shell = p.shell;
        renderSpec();
      }
      syncCustomInputs(); clampItems(); refreshLayout(); frameShell();
    });

    for (const el of [lenIn, widIn, hgtIn]) {
      el.addEventListener('input', () => {
        const f = state.unit === 'm' ? 1 : M_PER_FT;
        const v = parseFloat(el.value);
        if (!Number.isFinite(v)) return;
        if (el === lenIn) state.len = Math.max(v * f, 1);
        if (el === widIn) state.wid = Math.max(v * f, 1);
        if (el === hgtIn) state.hgt = Math.max(v * f, 1.5);
        clampItems(); refreshLayout();
      });
    }

    container.querySelector('#cp-unit').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unit]'); if (!b) return;
      for (const x of container.querySelectorAll('#cp-unit .btn')) x.classList.toggle('is-active', x === b);
      state.unit = b.dataset.unit;
      syncCustomInputs(); refreshLayout({ geometry: false });
    });

    container.querySelector('#cp-colors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]'); if (!b) return;
      for (const x of container.querySelectorAll('.cp-swatch')) x.classList.toggle('is-active', x === b);
      state.color = b.dataset.color;
      buildShell();
    });

    container.querySelector('#cp-roof').addEventListener('change', (e) => {
      state.showRoof = e.target.checked; buildShell();
    });

    container.querySelector('#cp-views').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]'); if (!b) return;
      for (const x of container.querySelectorAll('#cp-views .btn')) x.classList.toggle('is-active', x === b);
      if (b.dataset.view === 'iso') frameShell(); else viewer.setView(b.dataset.view, shell);
    });

    /* ---------------- specification panel ---------------- */

    const elementsEl  = container.querySelector('#cq-elements');
    const servicesEl  = container.querySelector('#cq-services');
    const logisticsEl = container.querySelector('#cq-logistics');

    function renderSpec() {
      elementsEl.innerHTML = elementsWith(state.customMaterials).map(el => `
        <div class="cq-spec-row">
          <label class="tool-label" for="spec-${el.id}">${el.name}</label>
          <select class="tool-select" id="spec-${el.id}" data-spec="${el.id}">
            ${el.options.map(o => `<option value="${o.id}"${state.spec[el.id] === o.id ? ' selected' : ''}>${o.name}</option>`).join('')}
          </select>
          ${el.help ? `<p class="biz-hint">${el.help}</p>` : ''}
        </div>`).join('');

      const q = currentQuote().quantities;
      servicesEl.innerHTML = SERVICES.map(s => {
        const auto = state.services[s.id] !== undefined
          ? state.services[s.id]
          : (s.autoFrom ? (q[s.autoFrom] ?? 0) : (s.unit === 'area' ? q.floorArea : s.auto(q.floorArea)));
        return `
          <div class="cq-qty-row">
            <span class="cq-qty-name">${s.name}</span>
            <input type="number" class="tool-input" data-service="${s.id}" value="${Number(auto).toFixed(s.unit === 'area' || s.unit === 'length' ? 1 : 0)}" min="0" step="${s.unit === 'each' ? 1 : 0.5}">
            <span class="cq-qty-unit">${UNITS[s.unit].label}</span>
          </div>`;
      }).join('');

      logisticsEl.innerHTML = LOGISTICS.map(l => `
        <div class="cq-qty-row">
          <span class="cq-qty-name">${l.name}</span>
          <input type="number" class="tool-input" data-logistics="${l.id}" value="${state.logistics[l.id] ?? l.qty}" min="0" step="1">
          <span class="cq-qty-unit">${UNITS[l.unit].label}</span>
        </div>`).join('');
    }

    function renderTakeoff() {
      const q = currentQuote().quantities;
      const u = state.unit;
      container.querySelector('#cq-takeoff').innerHTML = `
        <h3 class="cq-h">Measured off the model</h3>
        <div class="cp-summary">
          <div class="cp-stat"><span class="cp-stat-v">${fmtArea(q.floorArea, u)}</span><span class="cp-stat-l">Floor / ceiling</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${fmtArea(q.interiorArea, u)}</span><span class="cp-stat-l">Interior lining</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${fmtArea(q.exteriorArea, u)}</span><span class="cp-stat-l">External cladding</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${fmtArea(q.envelopeArea, u)}</span><span class="cp-stat-l">Insulated envelope</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${fmtArea(q.openingArea, u)}</span><span class="cp-stat-l">Openings deducted</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${num(q.studLength, 0)} m</span><span class="cp-stat-l">Stud framing</span></div>
          <div class="cp-stat"><span class="cp-stat-v">${num(q.perimeter, 1)} m</span><span class="cp-stat-l">Perimeter</span></div>
        </div>`;
    }

    container.querySelector('[data-panel="spec"]').addEventListener('change', (e) => {
      if (e.target.dataset.spec) { state.spec[e.target.dataset.spec] = e.target.value; renderQuoteDependents(); }
    });
    container.querySelector('[data-panel="spec"]').addEventListener('input', (e) => {
      if (e.target.dataset.service)   { state.services[e.target.dataset.service] = parseNum(e.target); renderQuoteDependents({ keepSpec: true }); }
      if (e.target.dataset.logistics) { state.logistics[e.target.dataset.logistics] = parseNum(e.target); renderQuoteDependents({ keepSpec: true }); }
    });

    /* ---------------- quote ---------------- */

    const linesEl  = container.querySelector('#cq-lines');
    const totalsEl = container.querySelector('#cq-totals');

    const currentQuote = () => buildQuote(state, state.rates, { overrides: state.overrides, removed: state.removed });

    function renderLines() {
      const { lines } = currentQuote();
      const cur = state.currency;

      if (!lines.length) {
        linesEl.innerHTML = `<div class="tool-output biz-explain">Nothing to price yet. Set a specification on the previous tab.</div>`;
        return;
      }

      linesEl.innerHTML = groupLines(lines).map(group => `
        <div class="cq-group">
          <div class="cq-group-head"><h4>${group.name}</h4><span>${money(group.subtotal, cur)}</span></div>
          <div class="cq-line cq-line-head">
            <span>Material</span><span>Unit</span><span class="ta-right">Qty</span>
            <span class="ta-right">Waste</span><span class="ta-right">Material</span>
            <span class="ta-right">Labour</span><span class="ta-right">Total</span><span></span>
          </div>
          ${group.items.map(l => `
            <div class="cq-line" data-line="${escapeHtml(l.id)}">
              <span class="cq-line-name" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>
              <span class="cq-line-unit">${UNITS[l.unit]?.label ?? l.unit}</span>
              <input type="number" class="tool-input ta-right" data-f="qty" value="${l.qty.toFixed(l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}" min="0" step="0.5">
              <input type="number" class="tool-input ta-right" data-f="wastage" value="${l.wastage}" min="0" max="60" step="1">
              <span class="ta-right cq-cell" data-c="material">${money(l.materialCost, cur)}</span>
              <span class="ta-right cq-cell" data-c="labour">${money(l.labourCost, cur)}</span>
              <span class="ta-right cq-cell cq-line-total" data-c="total">${money(l.total, cur)}</span>
              <button class="ct-del" data-remove="${escapeHtml(l.id)}" aria-label="Remove line">×</button>
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
      const { totals, lines } = currentQuote();
      const cur = state.currency;
      const area = state.len * state.wid;
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

    // Recompute just the money cells for one row, so typing never
    // rebuilds the table and steals focus.
    function repriceRow(rowEl, lineId) {
      const { lines } = currentQuote();
      const l = lines.find(x => x.id === lineId);
      if (!l) { renderLines(); renderTotals(); return; }
      const cur = state.currency;
      rowEl.querySelector('[data-c="material"]').textContent = money(l.materialCost, cur);
      rowEl.querySelector('[data-c="labour"]').textContent   = money(l.labourCost, cur);
      rowEl.querySelector('[data-c="total"]').textContent    = money(l.total, cur);
      renderTotals();
    }

    linesEl.addEventListener('input', (e) => {
      const field = e.target.dataset.f;
      if (!field) return;
      const row = e.target.closest('[data-line]') || e.target.closest('.cq-line-rates')?.previousElementSibling;
      if (!row) return;
      const id = row.dataset.line;
      state.overrides[id] = { ...state.overrides[id], [field]: parseNum(e.target) };
      repriceRow(row, id);
    });

    linesEl.addEventListener('click', (e) => {
      const id = e.target.dataset.remove;
      if (!id) return;
      state.removed.push(id);
      renderLines(); renderTotals();
    });

    container.querySelector('.cq-commercial').addEventListener('input', (e) => {
      const k = e.target.dataset.comm;
      if (!k) return;
      state.commercial[k] = parseNum(e.target);
      renderTotals();
    });

    container.querySelector('#cq-add-line').addEventListener('click', () => {
      state.customLines.push({
        id: `custom:${Date.now()}`, name: 'New item', unit: 'each',
        qty: 1, wastage: 0, rate: 0, labour: 0,
      });
      renderLines(); renderTotals();
    });

    /* ---------------- rate book ---------------- */

    const ratesTableEl = container.querySelector('#cq-rates-table');

    function renderRates() {
      const book = { ...defaultRateBook(state.customMaterials), ...state.rates };
      const q = (container.querySelector('#cq-rates-filter').value || '').toLowerCase();
      const cur = state.currency;

      const rows = Object.entries(book)
        .filter(([, v]) => !q || v.name.toLowerCase().includes(q) || (v.group || '').toLowerCase().includes(q));

      const byGroup = new Map();
      for (const [key, v] of rows) {
        if (!byGroup.has(v.group)) byGroup.set(v.group, []);
        byGroup.get(v.group).push([key, v]);
      }

      ratesTableEl.innerHTML = [...byGroup.entries()].map(([group, entries]) => `
        <div class="cq-group">
          <div class="cq-group-head"><h4>${escapeHtml(group || 'Other')}</h4><span>${entries.length} items</span></div>
          <div class="cq-rate-row cq-rate-head">
            <span>Item</span><span>Unit</span>
            <span class="ta-right">Material rate (${cur})</span>
            <span class="ta-right">Labour rate (${cur})</span>
            <span class="ta-right">Waste %</span>
          </div>
          ${entries.map(([key, v]) => `
            <div class="cq-rate-row" data-rate="${escapeHtml(key)}">
              <span class="cq-line-name">${escapeHtml(v.name)}</span>
              <span class="cq-line-unit">${UNITS[v.unit]?.label ?? v.unit}</span>
              <input type="number" class="tool-input ta-right" data-r="rate" value="${v.rate}" min="0" step="500">
              <input type="number" class="tool-input ta-right" data-r="labour" value="${v.labour}" min="0" step="500">
              <input type="number" class="tool-input ta-right" data-r="wastage" value="${v.wastage}" min="0" max="60" step="1">
            </div>`).join('')}
        </div>`).join('') || `<p class="cp-empty">Nothing matches that.</p>`;
    }

    /* ---------------- user-defined materials ---------------- */

    const matListEl = container.querySelector('#cq-mat-list');
    const matForm   = container.querySelector('#cq-mat-form');
    const matUnit   = container.querySelector('#mat-unit');

    function renderMaterials() {
      if (!state.customMaterials.length) {
        matListEl.innerHTML = '<p class="cp-empty">No materials of your own yet.</p>';
        return;
      }
      const byElement = new Map(CUSTOM_TARGETS.map(t => [t.id, t.name]));
      matListEl.innerHTML = state.customMaterials.map(m => `
        <div class="cq-mat-row">
          <div class="fz-name">
            <strong>${escapeHtml(m.name)}</strong>
            <span class="fz-meta">${escapeHtml(byElement.get(m.element) ?? m.element)} ·
              ${money(m.rate, state.currency)} + ${money(m.labour, state.currency)} labour per ${UNITS[m.unit]?.label ?? m.unit}
              ${m.wastage ? '· ' + m.wastage + '% wastage' : ''}</span>
          </div>
          <button class="btn btn-sm ct-del" data-mat-remove="${escapeHtml(m.id)}" aria-label="Remove ${escapeHtml(m.name)}">×</button>
        </div>`).join('');
    }

    // A sheet needs to know what area it covers; nothing else does.
    const syncMatUnit = () => {
      container.querySelector('#mat-cov-wrap').hidden = matUnit.value !== 'sheet';
    };
    matUnit.addEventListener('change', syncMatUnit);

    container.querySelector('#cq-mat-add').addEventListener('click', () => {
      matForm.hidden = !matForm.hidden;
      if (!matForm.hidden) container.querySelector('#mat-name').focus();
    });
    container.querySelector('#cq-mat-cancel').addEventListener('click', () => { matForm.hidden = true; });

    matForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = container.querySelector('#mat-name').value.trim();
      if (!name) return;
      const unit = matUnit.value;
      state.customMaterials.push({
        // Prefixed so a user material can never collide with a catalogue id.
        id: `mine-${Date.now().toString(36)}`,
        element: container.querySelector('#mat-element').value,
        name,
        unit,
        coverage: unit === 'sheet' ? parseNum(container.querySelector('#mat-coverage')) : null,
        rate: parseNum(container.querySelector('#mat-rate')),
        labour: parseNum(container.querySelector('#mat-labour')),
        wastage: parseNum(container.querySelector('#mat-wastage')),
      });
      persist();
      matForm.reset();
      matForm.hidden = true;
      syncMatUnit();
      renderMaterials();
      renderSpec();
      renderRates();
    });

    matListEl.addEventListener('click', (e) => {
      const id = e.target.dataset.matRemove;
      if (!id) return;
      state.customMaterials = state.customMaterials.filter(m => m.id !== id);
      // Any element still pointing at the deleted material falls back.
      for (const [k, v] of Object.entries(state.spec)) if (v === id) state.spec[k] = 'none';
      persist();
      renderMaterials(); renderSpec(); renderRates(); renderLines(); renderTotals();
    });

    ratesTableEl.addEventListener('input', (e) => {
      const f = e.target.dataset.r;
      if (!f) return;
      const key = e.target.closest('[data-rate]').dataset.rate;
      const book = defaultRateBook(state.customMaterials);
      state.rates[key] = { ...book[key], ...state.rates[key], [f]: parseNum(e.target) };
      persist();
    });

    container.querySelector('#cq-rates-filter').addEventListener('input', renderRates);

    container.querySelector('#cq-rates-export').addEventListener('click', () => {
      const payload = {
        exported: new Date().toISOString(),
        currency: state.currency,
        materials: state.customMaterials,
        rates: { ...defaultRateBook(state.customMaterials), ...state.rates },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `rate-book-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const fileInput = container.querySelector('#cq-rates-file');
    container.querySelector('#cq-rates-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        state.rates = data.rates || data;
        if (Array.isArray(data.materials)) state.customMaterials = data.materials;
        persist(); renderMaterials(); renderRates(); renderSpec(); renderLines(); renderTotals();
      } catch {
        alert('That file could not be read as a rate book.');
      }
      fileInput.value = '';
    });

    container.querySelector('#cq-rates-reset').addEventListener('click', () => {
      // Only seed rates are restored. Materials the user typed in are
      // their work, not a setting, so resetting must not wipe them.
      state.rates = {};
      persist(); renderRates(); renderLines(); renderTotals();
    });

    /* ---------------- company fields ---------------- */

    const coFields = ['name', 'phone', 'email', 'regNo', 'address', 'clientAddress', 'scope', 'terms'];
    const coIds = { name: 'co-name', phone: 'co-phone', email: 'co-email', regNo: 'co-regno',
                    address: 'co-address', clientAddress: 'co-clientaddress', scope: 'co-scope', terms: 'co-terms' };
    for (const f of coFields) container.querySelector(`#${coIds[f]}`).value = state.company[f] ?? '';
    container.querySelector('#cq-quoteno').value = state.company.quoteNo;
    container.querySelector('#cq-date').value    = state.company.date;
    container.querySelector('#cq-client').value  = state.company.client;

    container.querySelector('[data-panel="quote"]').addEventListener('input', (e) => {
      for (const f of coFields) if (e.target.id === coIds[f]) { state.company[f] = e.target.value; persist(); }
      if (e.target.id === 'cq-quoteno') { state.company.quoteNo = e.target.value; persist(); }
      if (e.target.id === 'cq-date')    { state.company.date = e.target.value; persist(); }
      if (e.target.id === 'cq-client')  { state.company.client = e.target.value; persist(); }
    });

    container.querySelector('#cq-currency').addEventListener('change', (e) => {
      state.currency = e.target.value;
      renderLines(); renderTotals(); renderRates();
    });

    /* ---------------- CSV & print ---------------- */

    container.querySelector('#cq-csv').addEventListener('click', () => {
      const { lines, totals } = currentQuote();
      const cur = state.currency;
      downloadCSV(`quote-${state.company.quoteNo || 'container'}`,
        ['Group', 'Material', 'Unit', 'Quantity', 'Wastage %', 'Charged qty', `Rate (${cur})`,
         `Material cost (${cur})`, `Labour (${cur})`, `Total (${cur})`],
        [
          ...lines.map(l => [l.group, l.name, UNITS[l.unit]?.label ?? l.unit, l.qty.toFixed(2), l.wastage,
                             l.chargeQty.toFixed(2), l.rate.toFixed(2),
                             l.materialCost.toFixed(2), l.labourCost.toFixed(2), l.total.toFixed(2)]),
          ['', 'PRIME COST', '', '', '', '', '', totals.material.toFixed(2), totals.labour.toFixed(2), totals.prime.toFixed(2)],
          ['', 'QUOTED PRICE (incl. VAT)', '', '', '', '', '', '', '', totals.grandTotal.toFixed(2)],
        ]);
    });

    const sheetEl = container.querySelector('#cq-sheet');

    container.querySelector('#cq-print').addEventListener('click', () => {
      const { lines, totals, quantities } = currentQuote();
      const cur = state.currency;
      const co = state.company;
      const u = state.unit;
      const presetName = state.preset === 'custom' ? 'Custom unit'
        : PRESETS.flatMap(g => g.items).find(p => p.id === state.preset)?.name ?? 'Unit';

      sheetEl.innerHTML = `
        <header class="cqs-head">
          <div>
            <h1>${escapeHtml(co.name || 'Quotation')}</h1>
            <div class="cqs-sub">${escapeHtml(co.address || '')}</div>
            <div class="cqs-sub">${[co.phone, co.email, co.regNo && `RC ${co.regNo}`].filter(Boolean).map(escapeHtml).join(' · ')}</div>
          </div>
          <div class="cqs-badge">
            <span>Quotation</span>
            <strong>${escapeHtml(co.quoteNo || '')}</strong>
            <span>${fmtDate(co.date)}</span>
          </div>
        </header>

        <section class="cqs-parties">
          <div><h3>Prepared for</h3>
            <div>${escapeHtml(co.client || '—')}</div>
            <div>${escapeHtml(co.clientAddress || '')}</div></div>
          <div><h3>Unit</h3>
            <div>${escapeHtml(presetName)}</div>
            <div>${fmtLen(state.len, u)} × ${fmtLen(state.wid, u)} × ${fmtLen(state.hgt, u)}</div>
            <div>${fmtArea(quantities.floorArea, u)} floor area</div></div>
          <div><h3>Validity</h3>
            <div>${COMMERCIAL_DEFAULTS.validityDays} days from ${fmtDate(co.date)}</div></div>
        </section>

        ${co.scope ? `<section class="cqs-scope"><h3>Scope of works</h3><p>${escapeHtml(co.scope)}</p></section>` : ''}

        ${groupLines(lines).map(group => `
          <table class="cqs-table">
            <thead>
              <tr><th colspan="7" class="cqs-group">${escapeHtml(group.name)}</th></tr>
              <tr>
                <th>Material</th><th>Unit</th><th class="ta-right">Qty</th><th class="ta-right">Waste</th>
                <th class="ta-right">Material</th><th class="ta-right">Labour</th><th class="ta-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${group.items.map(l => `<tr>
                <td>${escapeHtml(l.name)}</td>
                <td>${UNITS[l.unit]?.label ?? l.unit}</td>
                <td class="ta-right">${num(l.qty, l.unit === 'each' || l.unit === 'sheet' ? 0 : 1)}</td>
                <td class="ta-right">${l.wastage ? l.wastage + '%' : '—'}</td>
                <td class="ta-right">${money(l.materialCost, cur)}</td>
                <td class="ta-right">${money(l.labourCost, cur)}</td>
                <td class="ta-right">${money(l.total, cur)}</td>
              </tr>`).join('')}
              <tr class="cqs-subtotal">
                <td colspan="6">${escapeHtml(group.name)} subtotal</td>
                <td class="ta-right">${money(group.subtotal, cur)}</td>
              </tr>
            </tbody>
          </table>`).join('')}

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

        <section class="cqs-sign">
          <div><span>For ${escapeHtml(co.name || '')}</span><div class="cqs-rule"></div></div>
          <div><span>Accepted by the client</span><div class="cqs-rule"></div></div>
        </section>

        <p class="cqs-foot">Quantities measured from the modelled unit. Material rates include a wastage
        allowance; labour is charged on net measured quantity. Prepared with Toolbox.</p>`;

      window.print();
    });

    /* ---------------- tabs ---------------- */

    function renderQuoteDependents({ keepSpec = false } = {}) {
      if (!keepSpec) renderSpec();
      renderTakeoff();
      renderLines();
      renderTotals();
    }

    container.querySelector('#cq-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.dataset.tab;
      for (const b of container.querySelectorAll('.cq-tab')) b.classList.toggle('is-active', b === btn);
      for (const p of container.querySelectorAll('.cq-panel')) p.hidden = p.dataset.panel !== state.tab;
      if (state.tab === 'layout') viewer.resize();
      if (state.tab === 'spec')   renderQuoteDependents();
      if (state.tab === 'quote')  { renderLines(); renderTotals(); }
      if (state.tab === 'rates')  { renderMaterials(); renderRates(); }
    });

    /* ---------------- go ---------------- */

    for (const [k, v] of Object.entries(state.commercial)) {
      const el = container.querySelector(`[data-comm="${k}"]`);
      if (el) el.value = v;
    }
    container.querySelector('#cq-currency').value = state.currency;

    // A realistic opening layout beats an empty box.
    addOpening('personnel-door');
    addOpening('window');

    syncCustomInputs();
    refreshLayout();
    frameShell();
    renderMaterials();
    renderRates();
  },

  destroy() {
    this._alive = false;
    this._viewer?.dispose();
    this._viewer = null;
  },
};
