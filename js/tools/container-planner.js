/* ============================================================
   Container & Cabin Planner

   Lay out a shipping container or portacabin: pick a size, cut in
   doors and windows, drop in partitions and furniture, print a spec.

   Written for someone who does not use CAD. Every control is a plain
   number or a big button, everything is named in ordinary words
   ("Distance from the left corner", not "X offset"), and nothing has
   to be dragged in 3D to work.
   ============================================================ */

const M_PER_FT = 0.3048;

/* ---------------- presets (metres, internal usable size) ---------------- */

const PRESETS = [
  { group: 'Shipping containers', items: [
    { id: '10ft',    name: '10 ft container',        len: 2.831,  wid: 2.352, hgt: 2.393 },
    { id: '20ft',    name: '20 ft container',        len: 5.898,  wid: 2.352, hgt: 2.393 },
    { id: '40ft',    name: '40 ft container',        len: 12.032, wid: 2.352, hgt: 2.393 },
    { id: '40hc',    name: '40 ft high cube',        len: 12.032, wid: 2.352, hgt: 2.698 },
    { id: '45hc',    name: '45 ft high cube',        len: 13.556, wid: 2.352, hgt: 2.698 },
  ]},
  { group: 'Portacabins', items: [
    { id: 'pc12',    name: '12 ft × 8 ft cabin',     len: 3.658,  wid: 2.438, hgt: 2.400 },
    { id: 'pc16',    name: '16 ft × 8 ft cabin',     len: 4.877,  wid: 2.438, hgt: 2.400 },
    { id: 'pc20',    name: '20 ft × 8 ft cabin',     len: 6.096,  wid: 2.438, hgt: 2.400 },
    { id: 'pc24',    name: '24 ft × 9 ft cabin',     len: 7.315,  wid: 2.743, hgt: 2.500 },
    { id: 'pc32',    name: '32 ft × 10 ft cabin',    len: 9.754,  wid: 3.048, hgt: 2.500 },
  ]},
];

/* ---------------- catalogue of things you can add ---------------- */

const OPENINGS = {
  'personnel-door': { name: 'Door',         w: 0.90, h: 2.00, sill: 0,    color: 0x6b4c33 },
  'double-door':    { name: 'Double door',  w: 1.80, h: 2.00, sill: 0,    color: 0x6b4c33 },
  'roller-door':    { name: 'Roller shutter', w: 2.20, h: 2.10, sill: 0,  color: 0x9aa3a8 },
  'window':         { name: 'Window',       w: 1.20, h: 1.00, sill: 0.95, color: 0x9fc6d8 },
  'small-window':   { name: 'Small window', w: 0.60, h: 0.60, sill: 1.30, color: 0x9fc6d8 },
  'vent':           { name: 'Air vent',     w: 0.30, h: 0.25, sill: 2.00, color: 0x8a9298 },
};

const FITTINGS = {
  'partition':  { name: 'Partition wall', w: 0.10, d: 2.35, h: 2.30, color: 0xe4e0d8, isWall: true },
  'desk':       { name: 'Desk',           w: 1.40, d: 0.70, h: 0.75, color: 0xb08d5f },
  'chair':      { name: 'Chair',          w: 0.55, d: 0.55, h: 0.95, color: 0x555b60 },
  'bed':        { name: 'Bed',            w: 0.90, d: 1.90, h: 0.55, color: 0x8f7f6a },
  'bunk':       { name: 'Bunk beds',      w: 0.90, d: 1.90, h: 1.70, color: 0x8f7f6a },
  'kitchen':    { name: 'Kitchen unit',   w: 1.80, d: 0.60, h: 0.90, color: 0xc9c4bb },
  'toilet':     { name: 'Toilet cubicle', w: 0.90, d: 1.20, h: 2.10, color: 0xdfe3e6 },
  'shower':     { name: 'Shower',         w: 0.90, d: 0.90, h: 2.10, color: 0xdfe3e6 },
  'rack':       { name: 'Storage rack',   w: 1.80, d: 0.50, h: 2.00, color: 0x7d8388 },
  'cabinet':    { name: 'Cabinet',        w: 0.80, d: 0.45, h: 1.80, color: 0xa89a86 },
  'table':      { name: 'Table',          w: 1.60, d: 0.80, h: 0.75, color: 0xb08d5f },
};

const WALLS = [
  { id: 'front', name: 'Front (door end)' },
  { id: 'back',  name: 'Back end' },
  { id: 'left',  name: 'Left side' },
  { id: 'right', name: 'Right side' },
];

const SHELL_COLORS = [
  { id: 'green',  name: 'Green',  hex: 0x3f6b52 },
  { id: 'blue',   name: 'Blue',   hex: 0x2f5f86 },
  { id: 'red',    name: 'Red',    hex: 0x8d3a32 },
  { id: 'grey',   name: 'Grey',   hex: 0x6f7479 },
  { id: 'white',  name: 'White',  hex: 0xdedbd4 },
  { id: 'sand',   name: 'Sand',   hex: 0xbfa87e },
];

/* ---------------- geometry helper: rectangle with holes ---------------- */

/* Subtract a hole from a set of rectangles, splitting each overlapping
   rectangle into up to four pieces. Lets a wall be built as flat panels
   around its openings without needing CSG. */
function subtractRect(rects, hole) {
  const out = [];
  for (const r of rects) {
    const overlaps = hole.x0 < r.x1 && hole.x1 > r.x0 && hole.y0 < r.y1 && hole.y1 > r.y0;
    if (!overlaps) { out.push(r); continue; }

    if (hole.y0 > r.y0) out.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: hole.y0 });
    if (hole.y1 < r.y1) out.push({ x0: r.x0, x1: r.x1, y0: hole.y1, y1: r.y1 });

    const yLo = Math.max(r.y0, hole.y0);
    const yHi = Math.min(r.y1, hole.y1);
    if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, y0: yLo, y1: yHi });
    if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, y0: yLo, y1: yHi });
  }
  return out.filter(r => r.x1 - r.x0 > 0.002 && r.y1 - r.y0 > 0.002);
}

/* ---------------- unit formatting ---------------- */

function fmtLen(metres, unit) {
  if (unit === 'm') return `${metres.toFixed(2)} m`;
  const totalIn = metres / M_PER_FT * 12;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1} ft` : inch ? `${ft} ft ${inch} in` : `${ft} ft`;
}

function fmtArea(m2, unit) {
  return unit === 'm' ? `${m2.toFixed(1)} m²` : `${(m2 * 10.7639).toFixed(0)} sq ft`;
}

function fmtVol(m3, unit) {
  return unit === 'm' ? `${m3.toFixed(1)} m³` : `${(m3 * 35.3147).toFixed(0)} cu ft`;
}

/* ============================================================ */

export default {
  async render(container) {
    this._alive = true;

    container.innerHTML = `
      <div class="t3d-loading"><div class="t3d-spinner"></div><p>Getting the workspace ready…</p></div>`;

    let THREE, Viewer3D;
    try {
      ({ Viewer3D, THREE } = await import('../lib/viewer3d.js'));
    } catch (err) {
      container.innerHTML = `<div class="no-results">
        <p class="no-results-title">Could not start the 3D view</p>
        <p class="no-results-text">${err.message}</p></div>`;
      return;
    }
    if (!this._alive) return;

    /* ---------------- state ---------------- */

    const state = {
      preset: '20ft',
      len: 5.898, wid: 2.352, hgt: 2.393,
      unit: 'ft',
      color: 'green',
      showRoof: false,
      items: [],          // { key, kind: 'opening'|'fitting', type, wall?, along?, x?, z?, rot?, w, h, sill? }
      selected: null,
      nextKey: 1,
    };

    /* ---------------- markup ---------------- */

    const presetOptions = PRESETS.map(g =>
      `<optgroup label="${g.group}">${g.items.map(p =>
        `<option value="${p.id}">${p.name}</option>`).join('')}</optgroup>`).join('')
      + `<optgroup label="Other"><option value="custom">Custom size…</option></optgroup>`;

    container.innerHTML = `
      <div class="cp">
        <aside class="cp-panel">

          <section class="cp-step">
            <h3 class="cp-step-h"><span class="cp-num">1</span> Choose the unit</h3>
            <select id="cp-preset" class="tool-select cp-big">${presetOptions}</select>

            <div id="cp-custom" class="cp-custom" hidden>
              <label class="cp-field"><span>Length</span>
                <input type="number" id="cp-len" class="tool-input" step="0.1" min="1"></label>
              <label class="cp-field"><span>Width</span>
                <input type="number" id="cp-wid" class="tool-input" step="0.1" min="1"></label>
              <label class="cp-field"><span>Height</span>
                <input type="number" id="cp-hgt" class="tool-input" step="0.1" min="1.5"></label>
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
                ${SHELL_COLORS.map(c => `<button class="cp-swatch${c.id === 'green' ? ' is-active' : ''}"
                   data-color="${c.id}" title="${c.name}" aria-label="${c.name}"
                   style="background:#${c.hex.toString(16).padStart(6, '0')}"></button>`).join('')}
              </div>
            </div>
          </section>

          <section class="cp-step">
            <h3 class="cp-step-h"><span class="cp-num">2</span> Add doors &amp; windows</h3>
            <div class="cp-add-grid" id="cp-add-openings">
              ${Object.entries(OPENINGS).map(([k, v]) =>
                `<button class="cp-add" data-opening="${k}">+ ${v.name}</button>`).join('')}
            </div>
          </section>

          <section class="cp-step">
            <h3 class="cp-step-h"><span class="cp-num">3</span> Add walls &amp; furniture</h3>
            <div class="cp-add-grid" id="cp-add-fittings">
              ${Object.entries(FITTINGS).map(([k, v]) =>
                `<button class="cp-add" data-fitting="${k}">+ ${v.name}</button>`).join('')}
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
              <button class="btn btn-sm" id="cp-print">Print the plan</button>
            </div>
          </div>

          <div class="cp-summary" id="cp-summary"></div>

          <div class="cp-editor" id="cp-editor" hidden></div>
        </div>
      </div>

      <div class="cp-sheet" id="cp-sheet" aria-hidden="true"></div>`;

    /* ---------------- scene ---------------- */

    const mount  = container.querySelector('#cp-canvas');
    const viewer = new Viewer3D(mount, { background: 0xeceae6, ground: true, groundSize: 24, fov: 40 });
    this._viewer = viewer;

    const shell = new THREE.Group();
    viewer.scene.add(shell);

    const matCache = new Map();
    const M = (color, opts = {}) => {
      const key = `${color}|${JSON.stringify(opts)}`;
      if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({
          color, roughness: opts.rough ?? 0.78, metalness: opts.metal ?? 0.06,
          transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
          side: THREE.DoubleSide,
        }));
      }
      return matCache.get(key);
    };

    const WALL_T = 0.06;   // wall thickness, metres

    /* ---------------- geometry rebuild ---------------- */

    function clearGroup(g) {
      for (let i = g.children.length - 1; i >= 0; i--) {
        const c = g.children[i];
        c.traverse?.(n => { if (n.isMesh) n.geometry.dispose(); });
        g.remove(c);
      }
    }

    // Openings on a given wall, expressed in that wall's own 2D frame:
    // x runs along the wall from its left corner, y runs up from the floor.
    function holesFor(wallId) {
      return state.items
        .filter(it => it.kind === 'opening' && it.wall === wallId)
        .map(it => ({
          x0: it.along - it.w / 2, x1: it.along + it.w / 2,
          y0: it.sill, y1: it.sill + it.h,
        }));
    }

    function wallSpan(wallId) {
      return (wallId === 'front' || wallId === 'back') ? state.wid : state.len;
    }

    // Place a panel described in wall-space into world space.
    function placePanel(wallId, r, thickness, material) {
      const { len, wid, hgt } = state;
      const w = r.x1 - r.x0;
      const h = r.y1 - r.y0;
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function buildShell() {
      clearGroup(shell);
      viewer.pickables.length = 0;

      const { len, wid, hgt } = state;
      const shellHex = SHELL_COLORS.find(c => c.id === state.color).hex;

      // --- Floor ---
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(len + WALL_T * 2, 0.08, wid + WALL_T * 2),
        M(0x8b8378, { rough: 0.95 })
      );
      floor.position.y = -0.04;
      floor.receiveShadow = true;
      floor.name = '__floor';
      shell.add(floor);

      const inner = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), M(0xb9ac97, { rough: 1 }));
      inner.rotation.x = -Math.PI / 2;
      inner.position.y = 0.002;
      inner.receiveShadow = true;
      inner.name = '__floorface';
      shell.add(inner);

      // --- Walls, cut around their openings ---
      for (const wall of WALLS) {
        let rects = [{ x0: 0, x1: wallSpan(wall.id), y0: 0, y1: hgt }];
        for (const hole of holesFor(wall.id)) rects = subtractRect(rects, hole);
        for (const r of rects) shell.add(placePanel(wall.id, r, WALL_T, M(shellHex)));
      }

      // --- Roof ---
      if (state.showRoof) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(len + WALL_T * 2, 0.07, wid + WALL_T * 2),
          M(shellHex, { rough: 0.7 })
        );
        roof.position.y = hgt + 0.035;
        roof.castShadow = true;
        roof.name = '__roof';
        shell.add(roof);
      }

      // --- Corner castings, the detail that makes it read as a container ---
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
          // A thin panel filling the hole: glass for windows, a leaf for doors.
          const isGlass = it.type.includes('window');
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, it.h, it.w),
            M(spec.color, isGlass ? { opacity: 0.42, rough: 0.15, metal: 0.1 } : { rough: 0.6 })
          );
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
          body.castShadow = true;
          body.receiveShadow = true;
          group.add(body);
        }

        shell.add(group);
        viewer.registerPickable(group);
      }

      // Re-apply the selection highlight after a rebuild.
      const sel = state.selected != null
        ? shell.children.find(c => c.userData.item?.key === state.selected)
        : null;
      viewer.selected = null;
      viewer.select(sel || null);
    }

    /* ---------------- summary ---------------- */

    const summaryEl = container.querySelector('#cp-summary');

    function usableArea() {
      const gross = state.len * state.wid;
      const taken = state.items
        .filter(it => it.kind === 'fitting')
        .reduce((sum, it) => {
          const s = FITTINGS[it.type];
          return sum + s.w * s.d;
        }, 0);
      return { gross, taken, free: Math.max(gross - taken, 0) };
    }

    function updateSummary() {
      const u = state.unit;
      const { gross, free } = usableArea();
      const doors   = state.items.filter(i => i.kind === 'opening' && i.type.includes('door')).length;
      const windows = state.items.filter(i => i.kind === 'opening' && i.type.includes('window')).length;

      summaryEl.innerHTML = `
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.len, u)}</span><span class="cp-stat-l">Length</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.wid, u)}</span><span class="cp-stat-l">Width</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtLen(state.hgt, u)}</span><span class="cp-stat-l">Height</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtArea(gross, u)}</span><span class="cp-stat-l">Floor area</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtArea(free, u)}</span><span class="cp-stat-l">Floor left</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${fmtVol(gross * state.hgt, u)}</span><span class="cp-stat-l">Volume</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${doors}</span><span class="cp-stat-l">Doors</span></div>
        <div class="cp-stat"><span class="cp-stat-v">${windows}</span><span class="cp-stat-l">Windows</span></div>`;
    }

    /* ---------------- item list & editor ---------------- */

    const itemsEl  = container.querySelector('#cp-items');
    const editorEl = container.querySelector('#cp-editor');

    function itemName(it) {
      return it.kind === 'opening' ? OPENINGS[it.type].name : FITTINGS[it.type].name;
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
        const span = wallSpan(it.wall);
        editorEl.innerHTML = `
          <div class="cp-editor-head">
            <h4>${itemName(it)}</h4>
            <button class="btn btn-sm cp-delete" id="cp-del">Remove this</button>
          </div>
          <div class="cp-editor-grid">
            <label class="cp-field"><span>Which wall</span>
              <select class="tool-select" data-prop="wall">
                ${WALLS.map(w => `<option value="${w.id}"${w.id === it.wall ? ' selected' : ''}>${w.name}</option>`).join('')}
              </select></label>
            <label class="cp-field"><span>Distance from the left corner (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="along" step="${step}" min="0"
                     max="${toDisplay(span)}" value="${toDisplay(it.along)}"></label>
            <label class="cp-field"><span>Width (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="w" step="${step}" min="0.1" value="${toDisplay(it.w)}"></label>
            <label class="cp-field"><span>Height (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="h" step="${step}" min="0.1" value="${toDisplay(it.h)}"></label>
            <label class="cp-field"><span>Height off the floor (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="sill" step="${step}" min="0" value="${toDisplay(it.sill)}"></label>
          </div>
          <p class="cp-hint">The opening is measured from the left-hand corner as you look at that wall from outside.</p>`;
      } else {
        editorEl.innerHTML = `
          <div class="cp-editor-head">
            <h4>${itemName(it)}</h4>
            <div class="cp-editor-actions">
              <button class="btn btn-sm" id="cp-rotate">Turn 90°</button>
              <button class="btn btn-sm cp-delete" id="cp-del">Remove this</button>
            </div>
          </div>
          <div class="cp-editor-grid">
            <label class="cp-field"><span>Distance from the back end (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="x" step="${step}" min="0"
                     max="${toDisplay(state.len)}" value="${toDisplay(it.x)}"></label>
            <label class="cp-field"><span>Distance from the left side (${unitWord})</span>
              <input type="number" class="tool-input" data-prop="z" step="${step}" min="0"
                     max="${toDisplay(state.wid)}" value="${toDisplay(it.z)}"></label>
          </div>
          <p class="cp-hint">Measured to the centre of the item.</p>`;
      }
    }

    function refresh({ geometry = true } = {}) {
      if (geometry) buildShell(); else updateSummary();
      renderItems();
      renderEditor();
    }

    /* ---------------- adding ---------------- */

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
      refresh();
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
      refresh();
    }

    container.querySelector('#cp-add-openings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-opening]');
      if (b) addOpening(b.dataset.opening);
    });

    container.querySelector('#cp-add-fittings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fitting]');
      if (b) addFitting(b.dataset.fitting);
    });

    /* ---------------- editing ---------------- */

    itemsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]');
      if (!b) return;
      state.selected = Number(b.dataset.key);
      refresh({ geometry: false });
      const sel = shell.children.find(c => c.userData.item?.key === state.selected);
      viewer.select(sel || null);
    });

    editorEl.addEventListener('input', (e) => {
      const prop = e.target.dataset.prop;
      if (!prop) return;
      const it = state.items.find(i => i.key === state.selected);
      if (!it) return;

      if (prop === 'wall') {
        it.wall = e.target.value;
        it.along = Math.min(it.along, wallSpan(it.wall) - it.w / 2);
      } else {
        const raw = parseFloat(e.target.value);
        if (!Number.isFinite(raw)) return;
        it[prop] = state.unit === 'm' ? raw : raw * M_PER_FT;
      }
      buildShell();
      renderItems();
    });

    editorEl.addEventListener('click', (e) => {
      const it = state.items.find(i => i.key === state.selected);
      if (!it) return;
      if (e.target.id === 'cp-del') {
        state.items = state.items.filter(i => i.key !== it.key);
        state.selected = null;
        refresh();
      } else if (e.target.id === 'cp-rotate') {
        it.rot = (it.rot + 1) % 4;
        refresh();
      }
    });

    viewer.onSelect((obj) => {
      state.selected = obj?.userData.item?.key ?? null;
      renderItems();
      renderEditor();
    });

    /* ---------------- size, unit, colour ---------------- */

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
      for (const el of [lenIn, widIn, hgtIn]) {
        el.previousElementSibling; // labels already carry the unit word
      }
      customBox.querySelectorAll('.cp-field > span').forEach((s, i) => {
        s.textContent = ['Length', 'Width', 'Height'][i] + (state.unit === 'm' ? ' (metres)' : ' (feet)');
      });
    }

    // Keep every item inside the shell after a resize.
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

    presetSel.addEventListener('change', () => {
      state.preset = presetSel.value;
      if (state.preset === 'custom') {
        customBox.hidden = false;
      } else {
        customBox.hidden = true;
        const p = PRESETS.flatMap(g => g.items).find(p => p.id === state.preset);
        Object.assign(state, { len: p.len, wid: p.wid, hgt: p.hgt });
      }
      syncCustomInputs();
      clampItems();
      refresh();
      frameShell();
    });

    for (const el of [lenIn, widIn, hgtIn]) {
      el.addEventListener('input', () => {
        const f = state.unit === 'm' ? 1 : M_PER_FT;
        const v = { [el.id]: parseFloat(el.value) };
        if (!Number.isFinite(Object.values(v)[0])) return;
        if (el === lenIn) state.len = Math.max(parseFloat(el.value) * f, 1);
        if (el === widIn) state.wid = Math.max(parseFloat(el.value) * f, 1);
        if (el === hgtIn) state.hgt = Math.max(parseFloat(el.value) * f, 1.5);
        clampItems();
        refresh();
      });
    }

    container.querySelector('#cp-unit').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unit]');
      if (!b) return;
      for (const x of container.querySelectorAll('#cp-unit .btn')) x.classList.toggle('is-active', x === b);
      state.unit = b.dataset.unit;
      syncCustomInputs();
      refresh({ geometry: false });
    });

    container.querySelector('#cp-colors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      for (const x of container.querySelectorAll('.cp-swatch')) x.classList.toggle('is-active', x === b);
      state.color = b.dataset.color;
      buildShell();
    });

    container.querySelector('#cp-roof').addEventListener('change', (e) => {
      state.showRoof = e.target.checked;
      buildShell();
    });

    /* ---------------- views ---------------- */

    function frameShell() {
      const span = Math.max(state.len, state.wid, state.hgt);
      viewer.controls.target.set(0, state.hgt / 2, 0);
      viewer.camera.position.set(span * 0.85, span * 0.72, span * 1.05);
      viewer.controls.update();
      viewer.frame(shell, 1.25);
    }

    container.querySelector('#cp-views').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      for (const x of container.querySelectorAll('#cp-views .btn')) x.classList.toggle('is-active', x === b);
      const v = b.dataset.view;
      if (v === 'iso') { frameShell(); return; }
      viewer.setView(v, shell);
    });

    /* ---------------- print ---------------- */

    const sheetEl = container.querySelector('#cp-sheet');

    container.querySelector('#cp-print').addEventListener('click', () => {
      const u = state.unit;
      const { gross, free } = usableArea();
      const presetName = state.preset === 'custom'
        ? 'Custom size'
        : PRESETS.flatMap(g => g.items).find(p => p.id === state.preset).name;

      const openings = state.items.filter(i => i.kind === 'opening');
      const fittings = state.items.filter(i => i.kind === 'fitting');

      sheetEl.innerHTML = `
        <h1>${presetName} — layout plan</h1>
        <p class="cp-sheet-date">Prepared ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <h2>Overall size</h2>
        <table>
          <tr><th>Length</th><td>${fmtLen(state.len, u)}</td>
              <th>Width</th><td>${fmtLen(state.wid, u)}</td></tr>
          <tr><th>Height</th><td>${fmtLen(state.hgt, u)}</td>
              <th>Floor area</th><td>${fmtArea(gross, u)}</td></tr>
          <tr><th>Volume</th><td>${fmtVol(gross * state.hgt, u)}</td>
              <th>Free floor</th><td>${fmtArea(free, u)}</td></tr>
        </table>

        <h2>Doors, windows and vents (${openings.length})</h2>
        ${openings.length ? `<table class="cp-sheet-list">
          <tr><th>Item</th><th>Wall</th><th>From left corner</th><th>Width</th><th>Height</th><th>Off floor</th></tr>
          ${openings.map(o => `<tr>
            <td>${OPENINGS[o.type].name}</td>
            <td>${WALLS.find(w => w.id === o.wall).name}</td>
            <td>${fmtLen(o.along, u)}</td>
            <td>${fmtLen(o.w, u)}</td>
            <td>${fmtLen(o.h, u)}</td>
            <td>${fmtLen(o.sill, u)}</td></tr>`).join('')}
        </table>` : '<p>None.</p>'}

        <h2>Walls and furniture (${fittings.length})</h2>
        ${fittings.length ? `<table class="cp-sheet-list">
          <tr><th>Item</th><th>From back end</th><th>From left side</th><th>Size</th><th>Turned</th></tr>
          ${fittings.map(f => {
            const s = FITTINGS[f.type];
            return `<tr>
              <td>${s.name}</td>
              <td>${fmtLen(f.x, u)}</td>
              <td>${fmtLen(f.z, u)}</td>
              <td>${fmtLen(s.w, u)} × ${fmtLen(s.d, u)}</td>
              <td>${f.rot * 90}°</td></tr>`;
          }).join('')}
        </table>` : '<p>None.</p>'}

        <p class="cp-sheet-foot">All measurements are to the centre of each item unless stated.
        Made with Toolbox.</p>`;

      window.print();
    });

    /* ---------------- go ---------------- */

    syncCustomInputs();
    refresh();
    frameShell();
    viewer.controls.maxPolarAngle = Math.PI / 2 - 0.02;   // never look up from below ground
  },

  destroy() {
    this._alive = false;
    this._viewer?.dispose();
    this._viewer = null;
  },
};
