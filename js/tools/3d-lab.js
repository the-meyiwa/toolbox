/* ============================================================
   TOOLBOX — 3D Lab

   Build 3D scenes from a library of real-size models (phones,
   furniture, props, vehicles…), basic-to-advanced shapes, free online
   models (Khronos samples, Poly Haven) and your own files; arrange
   them with move / rotate / scale gizmos; tune each object's options;
   export GLB, glTF, OBJ, STL, PLY, USDZ, PNG or the scene JSON.

   Describe box: "iPhone 17 Pro in deep blue, office chair and an MP5"
   resolves locally against the catalogue. Anything it cannot place is
   handed to the Assistant, whose create_3d_object results open here.

   Storage: toolbox_3dlab_v1 (the scene, without imported files) and
   toolbox_3dlab_handoff (a scene sent from the Assistant, applied once).
   ============================================================ */

import { MODELS, MODEL_BY_ID, MODEL_CATEGORIES, modelDefaults, resolveObject } from '../lib/lab3d/catalog.js';
import { SHAPES, SHAPE_BY_ID, SHAPE_LEVELS, shapeDefaults, buildShapeGeometry } from '../lib/lab3d/shapes.js';
import { MATERIALS, MATERIAL_LABELS, mat } from '../lib/lab3d/materials.js';
import { normalizeItem, buildItem, serialize, labelFor, applyTransform, groundContent, sizeOf, boundsOf } from '../lib/lab3d/scene.js';
import { thumbnail, cancelThumbnails } from '../lib/lab3d/thumbs.js';
import { showToast } from '../utils.js';

const STORE = 'toolbox_3dlab_v1';
export const LAB_HANDOFF = 'toolbox_3dlab_handoff';
const HISTORY_MAX = 60;
const DEG = Math.PI / 180;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  cube: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
  shapes: '<circle cx="7" cy="7" r="4"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M17 3l4 7h-8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  select: '<path d="M5 3l14 8-6 2-2 6z"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
  scale: '<path d="M4 20 20 4"/><path d="M14 4h6v6"/><path d="M10 20H4v-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  grid: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  wire: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7l17 10M20.5 7l-17 10M12 2.5v19"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  spin: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  floor: '<path d="M3 20h18"/><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  insp: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const fmtLen = (m) => (m >= 1 ? `${(Math.round(m * 100) / 100).toLocaleString()} m` : m >= 0.01 ? `${Math.round(m * 1000) / 10} cm` : `${Math.round(m * 10000) / 10} mm`);
const QUICK = ['iPhone 17 Pro', 'Office chair', 'AK-47', 'MP5', 'Gaming PC', 'Torus knot', 'Klein bottle', 'Menger sponge'];

export default {
  render(container) {
    this.lab = mountLab(container);
  },
  destroy() {
    this.lab?.destroy();
    this.lab = null;
  },
};

function mountLab(container) {
  const L = {
    title: 'Untitled scene', objects: [], selected: null, mode: 'translate', snap: false,
    env: 'studio', grid: true, wire: false, spin: false,
    history: [], future: [], files: new Map(), libTab: 'models', busy: 0, dead: false,
  };
  let viewer = null, THREE = null, tc = null, selBox = null, gridHelper = null, root = null;
  let saveTimer = null, onlineTimer = null, onlineCtl = null;
  const disposers = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); disposers.push(() => t.removeEventListener(ev, fn, o)); };

  container.innerHTML = `
    <div class="lab" data-side="open" data-insp="open" data-narrow="false" tabindex="-1">
      <aside class="lab-side" aria-label="Library">
        <div class="lab-libtabs" role="tablist">
          ${[['models', 'Models', I.cube], ['shapes', 'Shapes', I.shapes], ['online', 'Online', I.globe], ['import', 'Import', I.upload]].map(([id, n, ic]) => `<button type="button" role="tab" data-lib="${id}" aria-selected="${id === 'models'}">${svg(ic, 15)}<span>${n}</span></button>`).join('')}
          <span class="lab-libtabs-ind" aria-hidden="true"></span>
        </div>
        <label class="lab-search">${svg(I.search, 15)}<input type="search" data-role="lib-q" placeholder="Search models" aria-label="Search the library" autocomplete="off"></label>
        <div class="lab-lib" data-role="lib"></div>
      </aside>
      <div class="lab-scrim" data-act="close-drawers"></div>

      <section class="lab-main">
        <header class="lab-bar">
          <button type="button" class="lab-ib lab-side-toggle" data-act="toggle-side" aria-label="Library" title="Library">${svg(I.side)}</button>
          <input class="lab-title" data-role="title" value="${esc(L.title)}" aria-label="Scene name" spellcheck="false">
          <form class="lab-describe" data-role="describe" autocomplete="off">
            <span class="lab-describe-icon">${svg(I.spark, 15)}</span>
            <input type="text" data-role="prompt" placeholder="Describe it — “iPhone 17 Pro in deep blue and an office chair”" aria-label="Describe an object to build">
            <button type="submit" class="lab-describe-go" aria-label="Build">${svg(I.arrow, 15)}</button>
          </form>
          <div class="lab-bar-right">
            <button type="button" class="lab-ib" data-act="undo" aria-label="Undo" title="Undo (Ctrl+Z)">${svg(I.undo)}</button>
            <button type="button" class="lab-ib" data-act="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${svg(I.redo)}</button>
            <button type="button" class="lab-export-btn" data-act="export" aria-haspopup="menu" aria-expanded="false">${svg(I.download, 15)}<span>Export</span></button>
            <button type="button" class="lab-ib lab-insp-toggle" data-act="toggle-insp" aria-label="Scene and properties" title="Scene and properties">${svg(I.insp)}</button>
          </div>
        </header>
        <div class="lab-suggest" data-role="suggest" hidden></div>

        <div class="lab-body">
          <div class="lab-stage" data-role="stage">
            <div class="lab-canvas" data-role="canvas"></div>
            <div class="lab-empty" data-role="empty">
              <div class="lab-empty-mark">${svg(I.cube, 30)}</div>
              <h3>Start a 3D scene</h3>
              <p>Pick a model or shape from the library, drop in a file, or describe what you want above.</p>
              <div class="lab-chips">${QUICK.map((q, i) => `<button type="button" class="lab-chip" data-quick="${esc(q)}" style="--i:${i}">${esc(q)}</button>`).join('')}</div>
            </div>
            <div class="lab-float lab-float-left">
              <div class="lab-seg" role="group" aria-label="Tool" data-role="modes">
                ${[['select', 'Select (Q)', I.select], ['translate', 'Move (W)', I.move], ['rotate', 'Rotate (E)', I.rotate], ['scale', 'Scale (R)', I.scale]].map(([m, t, ic]) => `<button type="button" data-mode="${m}" title="${t}" aria-label="${t}" aria-pressed="${m === 'translate'}">${svg(ic, 15)}</button>`).join('')}
                <span class="lab-seg-ind" aria-hidden="true"></span>
              </div>
              <button type="button" class="lab-pill" data-act="snap" aria-pressed="false" title="Snap to grid and 15° steps">${svg(I.magnet, 14)}<span>Snap</span></button>
            </div>
            <div class="lab-float lab-float-right">
              <div class="lab-seg lab-seg-views" role="group" aria-label="View">
                ${[['iso', '3D'], ['front', 'Front'], ['right', 'Side'], ['top', 'Top']].map(([v, n]) => `<button type="button" data-view="${v}">${n}</button>`).join('')}
              </div>
              <button type="button" class="lab-pill lab-pill-icon" data-act="fit" title="Frame all (F)" aria-label="Frame all">${svg(I.fit, 15)}</button>
              <button type="button" class="lab-pill lab-pill-icon" data-act="grid" title="Grid" aria-label="Grid" aria-pressed="true">${svg(I.grid, 15)}</button>
              <button type="button" class="lab-pill lab-pill-icon" data-act="wire" title="Wireframe" aria-label="Wireframe" aria-pressed="false">${svg(I.wire, 15)}</button>
              <button type="button" class="lab-pill lab-pill-icon" data-act="env" title="Studio / outdoor light" aria-label="Switch lighting">${svg(I.sun, 15)}</button>
              <button type="button" class="lab-pill lab-pill-icon" data-act="spin" title="Turntable" aria-label="Turntable" aria-pressed="false">${svg(I.spin, 15)}</button>
              <button type="button" class="lab-pill lab-pill-icon" data-act="png" title="Snapshot (PNG)" aria-label="Save a PNG snapshot">${svg(I.camera, 15)}</button>
            </div>
            <div class="lab-busy" data-role="busy" hidden><span class="lab-spinner"></span><span data-role="busy-text">Building…</span></div>
            <div class="lab-drop" data-role="drop" hidden><div>${svg(I.upload, 28)}<strong>Drop to add</strong><span>GLB · glTF · OBJ · STL · PLY · FBX · 3MF · DAE · USDZ</span></div></div>
          </div>
          <aside class="lab-insp" aria-label="Scene and properties">
            <section class="lab-outline">
              <header><h4>Scene</h4><span class="lab-count" data-role="count">0</span></header>
              <ul data-role="outline" role="listbox" aria-label="Objects in the scene"></ul>
            </section>
            <section class="lab-props" data-role="props"></section>
          </aside>
        </div>
        <footer class="lab-status"><span data-role="status-sel">Nothing selected</span><span data-role="status-tris"></span></footer>
      </section>
      <div class="lab-menu" data-role="menu" role="menu" hidden></div>
    </div>`;

  const $ = (sel) => container.querySelector(sel);
  const el = {
    lab: $('.lab'), lib: $('[data-role="lib"]'), libQ: $('[data-role="lib-q"]'), stage: $('[data-role="stage"]'), canvas: $('[data-role="canvas"]'),
    empty: $('[data-role="empty"]'), outline: $('[data-role="outline"]'), props: $('[data-role="props"]'), count: $('[data-role="count"]'),
    busy: $('[data-role="busy"]'), busyText: $('[data-role="busy-text"]'), drop: $('[data-role="drop"]'), menu: $('[data-role="menu"]'),
    title: $('[data-role="title"]'), prompt: $('[data-role="prompt"]'), describe: $('[data-role="describe"]'), suggest: $('[data-role="suggest"]'),
    statusSel: $('[data-role="status-sel"]'), statusTris: $('[data-role="status-tris"]'), modes: $('[data-role="modes"]'),
  };

  /* ---------------- viewer ---------------- */

  async function createViewer() {
    const [{ Viewer3D, THREE: T }, { TransformControls }] = await Promise.all([
      import('../lib/viewer3d.js'), import('three/examples/jsm/controls/TransformControls.js'),
    ]);
    if (L.dead) return;
    THREE = T;
    const camState = viewer ? { p: viewer.camera.position.clone(), t: viewer.controls.target.clone() } : null;
    if (viewer) {
      viewer.scene.remove(root);
      tc?.detach(); tc?.dispose?.();
      viewer.dispose();
    }
    root = root || Object.assign(new THREE.Group(), { name: 'Scene' });
    viewer = new Viewer3D(el.canvas, { realism: true, environment: L.env, dark: isDark(), ground: true, fov: 35, renderOnDemand: true, grid: false });
    viewer.controls.minDistance = 0.03;
    viewer.controls.maxDistance = 900;
    viewer.controls.autoRotate = L.spin;
    viewer.setEmphasisHandler(() => {});
    viewer.onSelect((o) => { if (tc?.axis || tc?.dragging) return; selectObj(o); });
    viewer.scene.add(root);
    for (const o of L.objects) viewer.registerPickable(o);

    tc = new TransformControls(viewer.camera, viewer.renderer.domElement);
    tc.setSize(0.85);
    const helper = tc.getHelper();
    helper.userData.helper = true;
    viewer.scene.add(helper);
    tc.addEventListener('change', () => { viewer.invalidate(); updateSelBox(); });
    tc.addEventListener('dragging-changed', (e) => {
      viewer.controls.enabled = !e.value;
      if (!e.value) { if (tc.object) keepOnFloor(tc.object); commit(); renderProps(); renderStatus(); }
    });
    tc.addEventListener('objectChange', () => fillTransformFields());
    applySnap();
    selBox = new THREE.BoxHelper(undefined, 0x2f7df6);
    selBox.userData.helper = true;
    selBox.visible = false;
    selBox.material.depthTest = false;
    selBox.material.transparent = true;
    selBox.renderOrder = 10;
    viewer.scene.add(selBox);
    gridHelper = null;
    updateGrid();
    if (L.wire) setWire(true);
    if (L.selected) selectObj(L.selected, { quiet: true });
    if (camState) { viewer.camera.position.copy(camState.p); viewer.controls.target.copy(camState.t); viewer.controls.update(); }
    else if (L.objects.length) frameAll();
    viewer.invalidate();
  }

  function updateGrid() {
    if (!viewer || !THREE) return;
    if (gridHelper) { viewer.scene.remove(gridHelper); gridHelper.geometry.dispose(); gridHelper.material.dispose(); gridHelper = null; }
    if (!L.grid) { viewer.invalidate(); return; }
    const s = L.objects.length ? boundsOf(root) : new THREE.Vector3(1, 1, 1);
    const span = Math.max(0.5, Math.max(s.x, s.z) * 3);
    const step = Math.pow(10, Math.floor(Math.log10(span / 10)));
    const size = Math.ceil(span / step) * step;
    gridHelper = new THREE.GridHelper(size, Math.round(size / step), isDark() ? 0x5a5f66 : 0x9aa0a6, isDark() ? 0x33373c : 0xd4d6d8);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.55;
    gridHelper.position.y = 0.0005;
    gridHelper.userData.helper = true;
    gridHelper.name = '__grid';
    viewer.scene.add(gridHelper);
    viewer.invalidate();
  }

  function frameAll(target = null) {
    if (!viewer) return;
    const t = target || (L.objects.length ? root : null);
    if (!t) return;
    viewer.frame(t, target ? 1.6 : 1.25);
    viewer.invalidate(400);
  }

  function setWire(onW) {
    root?.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { if (m) m.wireframe = onW; } });
    viewer?.invalidate();
  }

  function applySnap() {
    if (!tc) return;
    tc.setTranslationSnap(L.snap ? 0.01 : null);
    tc.setRotationSnap(L.snap ? 15 * DEG : null);
    tc.setScaleSnap(L.snap ? 0.1 : null);
  }

  function updateSelBox() {
    if (!selBox) return;
    if (L.selected && L.selected.visible) { selBox.setFromObject(L.selected); selBox.visible = true; } else selBox.visible = false;
  }

  /** Nothing sinks below the floor after a move. */
  function keepOnFloor(obj) {
    const b = new THREE.Box3().setFromObject(obj);
    if (b.min.y < -1e-4) obj.position.y -= b.min.y;
  }

  /* ---------------- objects ---------------- */

  function setBusy(onB, text = 'Building…') {
    L.busy = Math.max(0, L.busy + (onB ? 1 : -1));
    el.busy.hidden = L.busy === 0;
    if (onB) el.busyText.textContent = text;
  }

  function placeBeside(obj) {
    if (!L.objects.length) { obj.position.set(0, obj.position.y, 0); return; }
    const box = new THREE.Box3().setFromObject(root);
    const s = boundsOf(obj);
    const gap = Math.max(0.03, Math.max(s.x, s.z, box.max.x - box.min.x) * 0.12);
    obj.position.x = box.max.x + gap + s.x / 2;
    obj.position.z = (box.min.z + box.max.z) / 2;
  }

  async function addItem(raw, { select = true, commitNow = true, frame = null } = {}) {
    const item = raw.type === 'file' ? raw : normalizeItem(raw);
    if (item.error) { showToast(item.error, 'error'); return null; }
    setBusy(true, `Building ${labelFor(item)}…`);
    try {
      const obj = await buildItem(item);
      if (L.dead) return null;
      if (!item.at) placeBeside(obj);
      insert(obj);
      if (commitNow) commit();
      if (select) selectObj(obj);
      if (frame ?? true) frameAll();
      return obj;
    } catch (err) {
      showToast(`${labelFor(item)}: ${err.message || 'could not be built'}`, 'error');
      return null;
    } finally { setBusy(false); }
  }

  function insert(obj, index = L.objects.length) {
    root.add(obj);
    L.objects.splice(index, 0, obj);
    viewer?.registerPickable(obj);
    if (L.wire) setWire(true);
    refresh();
  }

  function disposeObj(obj) {
    const shared = obj.userData.lab?.type === 'online' || obj.userData.lab?.type === 'file';
    if (shared) return;
    obj.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); for (const m of [].concat(o.material)) { if (!m) continue; for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); } } });
  }

  function removeObj(obj, { commitNow = true } = {}) {
    const i = L.objects.indexOf(obj);
    if (i < 0) return;
    if (L.selected === obj) selectObj(null);
    L.objects.splice(i, 1);
    root.remove(obj);
    if (viewer) viewer.pickables = viewer.pickables.filter(p => p !== obj);
    disposeObj(obj);
    refresh();
    if (commitNow) commit();
  }

  async function replaceObj(old, item) {
    setBusy(true, `Updating ${labelFor(item)}…`);
    try {
      const obj = await buildItem(item);
      if (L.dead) return;
      obj.position.copy(old.position); obj.rotation.copy(old.rotation); obj.scale.copy(old.scale);
      obj.name = old.name;
      const i = L.objects.indexOf(old);
      removeObj(old, { commitNow: false });
      insert(obj, Math.max(0, i));
      selectObj(obj);
      commit();
    } catch (err) { showToast(err.message || 'Could not update it.', 'error'); }
    finally { setBusy(false); }
  }

  function duplicate(obj) {
    if (!obj) return;
    const s = boundsOf(obj);
    const copy = obj.clone(true);
    copy.userData = { ...obj.userData, lab: { ...obj.userData.lab } };
    copy.traverse(o => { if (o.isMesh) o.material = [].concat(o.material).length > 1 ? o.material.map(m => m.clone()) : o.material.clone(); });
    copy.position.x += s.x + Math.max(0.02, s.x * 0.15);
    insert(copy);
    selectObj(copy);
    commit();
  }

  function selectObj(obj, { quiet = false } = {}) {
    if (obj && !L.objects.includes(obj)) obj = null;
    L.selected = obj;
    if (tc) {
      if (obj && L.mode !== 'select') { tc.attach(obj); tc.setMode(L.mode); } else tc.detach();
    }
    updateSelBox();
    viewer?.invalidate();
    if (!quiet) { renderOutline(); renderProps(); renderStatus(); }
  }

  function refresh() {
    el.empty.hidden = L.objects.length > 0;
    el.lab.classList.toggle('has-objects', L.objects.length > 0);
    updateGrid();
    renderOutline();
    renderProps();
    renderStatus();
  }

  /* ---------------- history and storage ---------------- */

  const snapshot = () => JSON.stringify(serialize(L.objects, { title: L.title, environment: L.env, includeFiles: true }));

  function commit() {
    const s = snapshot();
    if (L.history[L.history.length - 1] === s) return;
    L.history.push(s);
    if (L.history.length > HISTORY_MAX) L.history.shift();
    L.future = [];
    syncUndo();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(serialize(L.objects, { title: L.title, environment: L.env }))); } catch { /* quota or private mode */ }
  }

  async function restore(json) {
    const spec = typeof json === 'string' ? JSON.parse(json) : json;
    for (const o of [...L.objects]) removeObj(o, { commitNow: false });
    L.title = spec.title || L.title;
    el.title.value = L.title;
    setBusy(true, 'Loading the scene…');
    try {
      for (const it of spec.items || []) {
        if (it.type === 'file') {
          const src = L.files.get(it.key);
          if (!src) continue;
          const o = src.clone(true);
          o.userData = { lab: { ...it } };
          applyTransform(o, it);
          insert(o);
          continue;
        }
        const n = normalizeItem(it);
        if (n.error) continue;
        try { const o = await buildItem(n); if (L.dead) return; insert(o); } catch { /* skip unavailable item */ }
      }
    } finally { setBusy(false); }
  }

  async function undo() {
    if (L.history.length < 2) return;
    L.future.push(L.history.pop());
    await restore(L.history[L.history.length - 1]);
    syncUndo(); persist();
  }
  async function redo() {
    if (!L.future.length) return;
    const s = L.future.pop();
    L.history.push(s);
    await restore(s);
    syncUndo(); persist();
  }
  function syncUndo() {
    $('[data-act="undo"]').disabled = L.history.length < 2;
    $('[data-act="redo"]').disabled = !L.future.length;
  }

  /* ---------------- describe box ---------------- */

  async function describe(text) {
    const q = text.trim();
    if (!q) return;
    const parts = q.split(/\s*(?:,|;|\+|\band\b|\bplus\b|\bwith an?\b)\s*/i).filter(p => p.trim().length > 1);
    const whole = resolveObject(q);
    const pieces = parts.length > 1 ? parts.map(p => ({ text: p, hit: resolveObject(p) })) : [{ text: q, hit: whole }];
    // "AK-47 with a bakelite magazine" is one object: keep it whole when the parts don't each resolve.
    const list = pieces.every(p => p.hit) ? pieces : [{ text: q, hit: whole }];
    const missing = list.filter(p => !p.hit);
    let added = 0;
    for (const p of list.filter(x => x.hit)) {
      if (await addItem({ type: p.hit.kind, [p.hit.kind]: p.hit.id, params: p.hit.params }, { frame: false })) added++;
    }
    if (added) { frameAll(); el.prompt.value = ''; }
    showSuggest(missing.map(m => m.text), added);
  }

  function showSuggest(missing, added) {
    if (!missing.length) { el.suggest.hidden = true; return; }
    const what = missing.join(', ');
    el.suggest.innerHTML = `
      <span>${added ? 'Added the rest. ' : ''}<strong>${esc(what)}</strong> isn’t in the model library yet.</span>
      <button type="button" class="lab-link" data-suggest="online" data-q="${esc(missing[0])}">${svg(I.globe, 14)}Search free online models</button>
      <button type="button" class="lab-link" data-suggest="assistant" data-q="${esc(what)}">${svg(I.spark, 14)}Ask the Assistant to build it</button>
      <button type="button" class="lab-ib lab-ib-sm" data-suggest="close" aria-label="Dismiss">${svg(I.close, 14)}</button>`;
    el.suggest.hidden = false;
  }

  /* ---------------- library ---------------- */

  function renderLibrary() {
    const q = el.libQ.value.trim().toLowerCase();
    cancelThumbnails();
    if (L.libTab === 'models') {
      el.libQ.placeholder = 'Search models';
      const match = (m) => !q || [m.name, m.category, ...(m.aliases || [])].some(s => s.toLowerCase().includes(q));
      el.lib.innerHTML = MODEL_CATEGORIES.map(cat => {
        const list = MODELS.filter(m => m.category === cat && match(m));
        if (!list.length) return '';
        return `<section class="lab-libsec"><h5>${esc(cat)}</h5><div class="lab-cards">${list.map((m, i) => card('model', m.id, m.name, i)).join('')}</div></section>`;
      }).join('') || `<p class="lab-lib-empty">No models match “${esc(q)}”. Try the Online tab.</p>`;
      loadThumbs();
    } else if (L.libTab === 'shapes') {
      el.libQ.placeholder = 'Search shapes';
      const match = (s) => !q || [s.name, s.level, ...(s.aliases || [])].some(x => x.toLowerCase().includes(q));
      el.lib.innerHTML = SHAPE_LEVELS.map(([lvl, label]) => {
        const list = SHAPES.filter(s => s.level === lvl && match(s));
        if (!list.length) return '';
        return `<section class="lab-libsec"><h5>${label}</h5><div class="lab-cards">${list.map((s, i) => card('shape', s.id, s.name, i)).join('')}</div></section>`;
      }).join('') || `<p class="lab-lib-empty">No shapes match “${esc(q)}”.</p>`;
      loadThumbs();
    } else if (L.libTab === 'online') {
      el.libQ.placeholder = 'Search free online models';
      el.lib.innerHTML = `<p class="lab-lib-note">Free models from <a href="https://github.com/KhronosGroup/glTF-Sample-Assets" target="_blank" rel="noopener">Khronos glTF samples</a> and <a href="https://polyhaven.com/models" target="_blank" rel="noopener">Poly Haven</a> (CC0). Each result links its licence.</p><div class="lab-online" data-role="online"><div class="lab-skel">${'<span></span>'.repeat(6)}</div></div>`;
      clearTimeout(onlineTimer);
      onlineTimer = setTimeout(() => searchOnlineNow(q), 220);
    } else {
      el.libQ.placeholder = 'Search';
      el.lib.innerHTML = `
        <label class="lab-dropzone" tabindex="0">
          <input type="file" data-role="file" multiple accept=".glb,.gltf,.obj,.stl,.ply,.fbx,.3mf,.dae,.usdz,.usda,.usdc,.json" hidden>
          ${svg(I.upload, 26)}
          <strong>Drop 3D files here</strong>
          <span>or click to choose</span>
          <small>GLB · glTF · OBJ · STL · PLY · FBX · 3MF · DAE · USDZ · Lab scene JSON</small>
        </label>
        <p class="lab-lib-note">Files stay in this browser. Imported meshes are kept for this session; export the scene as GLB to keep them.</p>`;
    }
  }

  function card(kind, id, name, i) {
    return `<button type="button" class="lab-card" data-add-kind="${kind}" data-add-id="${id}" draggable="true" style="--i:${Math.min(i, 12)}" title="${esc(name)}">
      <span class="lab-card-img"><img alt="" data-thumb="${kind}:${id}" hidden></span><span class="lab-card-name">${esc(name)}</span></button>`;
  }

  function loadThumbs() {
    for (const img of el.lib.querySelectorAll('img[data-thumb]')) {
      const [kind, id] = img.dataset.thumb.split(':');
      const build = kind === 'model'
        ? () => { const d = MODEL_BY_ID.get(id); const g = d.build(modelDefaults(id)); if (d.present?.rotate) g.rotation.set(...d.present.rotate.map(x => x * DEG)); return g; }
        : () => { const S = SHAPE_BY_ID.get(id); const m = new THREE.Mesh(buildShapeGeometry(id, shapeDefaults(id)), mat('plastic', '#d0d4da', S.doubleSided ? { side: 'double' } : {})); return m; };
      thumbnail(`${kind}:${id}:v1`, build).then(url => { if (url && img.isConnected) { img.src = url; img.hidden = false; img.parentElement.classList.add('is-ready'); } });
    }
  }

  async function searchOnlineNow(q) {
    const box = container.querySelector('[data-role="online"]');
    if (!box) return;
    onlineCtl?.abort();
    onlineCtl = new AbortController();
    try {
      const { searchOnline } = await import('../lib/lab3d/online.js');
      const { results, errors } = await searchOnline(q, { signal: onlineCtl.signal, limit: 48 });
      if (!box.isConnected) return;
      box.innerHTML = `${results.length ? `<div class="lab-cards">${results.map((r, i) => `
        <button type="button" class="lab-card lab-card-online" data-online='${esc(JSON.stringify({ source: r.source, id: r.id, url: r.url, label: r.name }))}' style="--i:${Math.min(i, 12)}" title="${esc(r.name)} · ${esc(r.license)}">
          <span class="lab-card-img is-ready">${r.thumb ? `<img alt="" loading="lazy" src="${esc(r.thumb)}">` : svg(I.cube, 24)}</span>
          <span class="lab-card-name">${esc(r.name)}</span><span class="lab-card-src">${r.source === 'polyhaven' ? 'Poly Haven · CC0' : 'Khronos'}</span></button>`).join('')}</div>`
        : `<p class="lab-lib-empty">${q ? `No free models match “${esc(q)}”.` : 'Nothing to show.'}</p>`}
        ${errors.map(e => `<p class="lab-lib-warn">${e.source === 'polyhaven' ? 'Poly Haven' : 'Khronos'} is unreachable right now (${esc(e.message)}).</p>`).join('')}`;
    } catch (err) {
      if (err.name !== 'AbortError' && box.isConnected) box.innerHTML = `<p class="lab-lib-warn">Online search failed: ${esc(err.message)}</p>`;
    }
  }

  async function importFiles(files) {
    const { loadFile } = await import('../lib/lab3d/online.js');
    for (const file of files) {
      if (/\.json$/i.test(file.name)) {
        try { const spec = JSON.parse(await file.text()); await applySpec(spec, { replace: false }); } catch (err) { showToast(`${file.name}: ${err.message}`, 'error'); }
        continue;
      }
      setBusy(true, `Importing ${file.name}…`);
      try {
        const { object, note } = await loadFile(file);
        const key = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const pivot = new THREE.Group();
        pivot.name = file.name.replace(/\.[^.]+$/, '');
        pivot.add(object);
        groundContent(pivot, object);
        pivot.userData.lab = { type: 'file', key, name: pivot.name };
        L.files.set(key, pivot.clone(true));
        placeBeside(pivot);
        insert(pivot);
        selectObj(pivot);
        commit();
        frameAll();
        if (note) showToast(note);
      } catch (err) { showToast(`${file.name}: ${err.message}`, 'error'); }
      finally { setBusy(false); }
    }
  }

  /** Adds (or replaces the scene with) a scene description. */
  async function applySpec(spec, { replace = false } = {}) {
    if (replace) { for (const o of [...L.objects]) removeObj(o, { commitNow: false }); }
    if (spec.title && (replace || !L.objects.length)) { L.title = spec.title; el.title.value = L.title; }
    for (const it of spec.items || []) await addItem(it, { commitNow: false, select: false, frame: false });
    commit();
    if (L.objects.length) selectObj(L.objects[L.objects.length - 1]);
    frameAll();
  }

  /* ---------------- outline, properties, status ---------------- */

  function typeIcon(lab) {
    return lab?.type === 'shape' ? I.shapes : lab?.type === 'online' ? I.globe : lab?.type === 'file' ? I.upload : I.cube;
  }

  function renderOutline() {
    el.count.textContent = String(L.objects.length);
    el.outline.innerHTML = L.objects.map((o, i) => `
      <li role="option" aria-selected="${o === L.selected}" data-obj="${i}" class="${o.visible ? '' : 'is-hidden'}">
        <span class="lab-ol-icon">${svg(typeIcon(o.userData.lab), 14)}</span>
        <span class="lab-ol-name">${esc(o.name)}</span>
        <button type="button" class="lab-ib lab-ib-sm" data-vis="${i}" aria-label="${o.visible ? 'Hide' : 'Show'} ${esc(o.name)}">${svg(o.visible ? I.eye : I.eyeOff, 14)}</button>
      </li>`).join('') || '<li class="lab-ol-empty">No objects yet.</li>';
  }

  function num(label, key, value, step, unit = '') {
    return `<label class="lab-num"><span>${label}</span><input type="number" data-tf="${key}" value="${value}" step="${step}" inputmode="decimal">${unit ? `<em>${unit}</em>` : ''}</label>`;
  }

  function fillTransformFields() {
    const o = L.selected;
    if (!o) return;
    const r = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d);
    const vals = { px: r(o.position.x), py: r(o.position.y), pz: r(o.position.z), rx: r(o.rotation.x / DEG, 1), ry: r(o.rotation.y / DEG, 1), rz: r(o.rotation.z / DEG, 1), s: r(o.scale.x, 3) };
    for (const [k, v] of Object.entries(vals)) { const inp = el.props.querySelector(`[data-tf="${k}"]`); if (inp && document.activeElement !== inp) inp.value = v; }
    const sz = el.props.querySelector('[data-role="size"]');
    if (sz) { const s = sizeOf(o); sz.textContent = `${fmtLen(s.x)} × ${fmtLen(s.y)} × ${fmtLen(s.z)}`; }
    updateSelBox();
  }

  function paramControl(k, def, value) {
    const v = value ?? def.default;
    if (def.type === 'color') {
      return `<div class="lab-field"><span class="lab-field-label">${esc(def.label)}</span><div class="lab-swatches">
        ${(def.swatches || []).map(([hex, name]) => `<button type="button" class="lab-swatch" style="--c:${hex}" data-param="${k}" data-value="${hex}" aria-label="${esc(name)}" title="${esc(name)}" aria-pressed="${String(hex).toLowerCase() === String(v).toLowerCase()}"></button>`).join('')}
        <label class="lab-color" title="Custom colour"><input type="color" data-param="${k}" value="${esc(v)}" aria-label="${esc(def.label)} colour"></label></div></div>`;
    }
    if (def.type === 'select') {
      return def.options.length <= 3
        ? `<div class="lab-field"><span class="lab-field-label">${esc(def.label)}</span><div class="lab-opts">${def.options.map(([val, label]) => `<button type="button" data-param="${k}" data-value="${esc(val)}" aria-pressed="${val === v}">${esc(label)}</button>`).join('')}</div></div>`
        : `<label class="lab-field"><span class="lab-field-label">${esc(def.label)}</span><select data-param="${k}">${def.options.map(([val, label]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
    }
    if (def.type === 'toggle') {
      return `<label class="lab-field lab-toggle"><span class="lab-field-label">${esc(def.label)}</span><input type="checkbox" role="switch" data-param="${k}"${v ? ' checked' : ''}><span class="lab-switch" aria-hidden="true"></span></label>`;
    }
    const step = def.step ?? 0.01;
    return `<label class="lab-field lab-range"><span class="lab-field-label">${esc(def.label)}<output>${esc(v)}${def.unit ? ` ${esc(def.unit)}` : ''}</output></span><input type="range" data-param="${k}" min="${def.min}" max="${def.max}" step="${step}" value="${esc(v)}"></label>`;
  }

  function renderProps() {
    const o = L.selected;
    if (!o) {
      const s = L.objects.length ? boundsOf(root) : null;
      el.props.innerHTML = `<div class="lab-props-empty">${L.objects.length ? `<p>Click an object to move it, change its options or export it on its own.</p><p class="lab-dim">Scene: ${s ? `${fmtLen(s.x)} × ${fmtLen(s.y)} × ${fmtLen(s.z)}` : ''}</p>` : '<p>Objects you add appear here.</p>'}
        <dl class="lab-keys"><div><dt>W E R</dt><dd>Move · rotate · scale</dd></div><div><dt>F</dt><dd>Frame</dd></div><div><dt>Ctrl D</dt><dd>Duplicate</dd></div><div><dt>Del</dt><dd>Delete</dd></div></dl></div>`;
      return;
    }
    const lab = o.userData.lab || {};
    let params = '';
    if (lab.type === 'model') {
      const def = MODEL_BY_ID.get(lab.model);
      params = Object.entries(def.params || {}).map(([k, d]) => paramControl(k, d, lab.params?.[k])).join('');
      if (def.description) params = `<p class="lab-desc">${esc(def.description)}</p>${params}`;
    } else if (lab.type === 'shape') {
      const def = SHAPE_BY_ID.get(lab.shape);
      params = Object.entries(def.params).map(([k, d]) => paramControl(k, { ...d, type: 'range' }, lab.params?.[k])).join('')
        + `<label class="lab-field"><span class="lab-field-label">Material</span><select data-item="material">${MATERIALS.map(m => `<option value="${m}"${m === (lab.material || 'plastic') ? ' selected' : ''}>${esc(MATERIAL_LABELS[m] || m)}</option>`).join('')}</select></label>`
        + `<div class="lab-field"><span class="lab-field-label">Colour</span><label class="lab-color lab-color-wide"><input type="color" data-item="color" value="${esc(lab.color || '#d0d4da')}"></label></div>`;
    } else if (lab.type === 'online') {
      params = `<p class="lab-desc">${lab.source === 'polyhaven' ? 'Poly Haven model (CC0).' : 'Khronos glTF sample model — see its folder for the licence.'} ${lab.source !== 'url' ? `<a href="${lab.source === 'polyhaven' ? `https://polyhaven.com/a/${encodeURIComponent(lab.id)}` : `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${encodeURIComponent(lab.id)}`}" target="_blank" rel="noopener">Source</a>` : ''}</p>`;
    } else if (lab.type === 'file') {
      params = '<p class="lab-desc">Imported file. It stays in this session; export as GLB to keep it.</p>';
    }
    const r = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
    el.props.innerHTML = `
      <header class="lab-props-head">
        <span class="lab-props-icon">${svg(typeIcon(lab), 16)}</span>
        <input class="lab-name" data-role="name" value="${esc(o.name)}" aria-label="Object name" spellcheck="false">
      </header>
      <p class="lab-size" data-role="size"></p>
      <div class="lab-tf">
        <div class="lab-tf-row"><span class="lab-tf-label">Position</span>${num('X', 'px', r(o.position.x), 0.01)}${num('Y', 'py', r(o.position.y), 0.01)}${num('Z', 'pz', r(o.position.z), 0.01)}</div>
        <div class="lab-tf-row"><span class="lab-tf-label">Rotation</span>${num('X', 'rx', r(o.rotation.x / DEG, 1), 5)}${num('Y', 'ry', r(o.rotation.y / DEG, 1), 5)}${num('Z', 'rz', r(o.rotation.z / DEG, 1), 5)}</div>
        <div class="lab-tf-row"><span class="lab-tf-label">Scale</span>${num('×', 's', r(o.scale.x), 0.05)}<button type="button" class="lab-mini" data-act="real-size" title="Back to real size">1:1</button></div>
      </div>
      ${params ? `<div class="lab-params">${params}</div>` : ''}
      <div class="lab-actions">
        <button type="button" class="lab-act" data-act="duplicate">${svg(I.copy, 15)}<span>Duplicate</span></button>
        <button type="button" class="lab-act" data-act="floor">${svg(I.floor, 15)}<span>To floor</span></button>
        <button type="button" class="lab-act" data-act="focus">${svg(I.fit, 15)}<span>Focus</span></button>
        <button type="button" class="lab-act lab-act-danger" data-act="delete">${svg(I.trash, 15)}<span>Delete</span></button>
      </div>`;
    fillTransformFields();
  }

  function renderStatus() {
    let tris = 0;
    root?.traverse(o => { if (o.isMesh && o.visible) { const g = o.geometry; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } });
    el.statusTris.textContent = L.objects.length ? `${L.objects.length} object${L.objects.length === 1 ? '' : 's'} · ${Math.round(tris).toLocaleString()} triangles` : '';
    const o = L.selected;
    el.statusSel.textContent = o ? `${o.name} · ${(() => { const s = sizeOf(o); return `${fmtLen(s.x)} × ${fmtLen(s.y)} × ${fmtLen(s.z)}`; })()}` : 'Nothing selected';
  }

  /* ---------------- export ---------------- */

  async function openExportMenu(btn) {
    const { FORMATS } = await import('../lib/lab3d/export.js');
    const sel = L.selected;
    el.menu.innerHTML = `
      <div class="lab-menu-head"><strong>Export</strong>${sel ? `<label class="lab-menu-scope"><input type="checkbox" data-role="only-sel"> Only “${esc(sel.name)}”</label>` : ''}</div>
      ${FORMATS.map(f => `<button type="button" role="menuitem" data-export="${f.id}"><b>${f.label}</b><span>${esc(f.hint)}</span></button>`).join('')}
      <button type="button" role="menuitem" data-export="png"><b>PNG</b><span>Snapshot of the view</span></button>
      <button type="button" role="menuitem" data-export="json"><b>Scene JSON</b><span>Reopen or edit later, or give to the Assistant</span></button>
      <label class="lab-menu-units">STL units <select data-role="stl-units"><option value="mm">millimetres</option><option value="cm">centimetres</option><option value="m">metres</option></select></label>`;
    el.menu.hidden = false;
    const r = btn.getBoundingClientRect(), host = el.lab.getBoundingClientRect();
    el.menu.style.top = `${r.bottom - host.top + 6}px`;
    el.menu.style.right = `${host.right - r.right}px`;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => el.menu.classList.add('is-open'));
    el.menu.querySelector('[role="menuitem"]')?.focus();
  }
  function closeMenu() {
    if (el.menu.hidden) return;
    el.menu.classList.remove('is-open');
    el.menu.hidden = true;
    $('[data-act="export"]').setAttribute('aria-expanded', 'false');
  }

  async function doExport(fmt) {
    const onlySel = !!el.menu.querySelector('[data-role="only-sel"]')?.checked && L.selected;
    const units = el.menu.querySelector('[data-role="stl-units"]')?.value || 'mm';
    closeMenu();
    if (!L.objects.length && fmt !== 'json') { showToast('Add something to the scene first.'); return; }
    const { exportObject, downloadBlob, slug } = await import('../lib/lab3d/export.js');
    const name = onlySel ? L.selected.name : L.title;
    if (fmt === 'png') { snapshotPng(slug(name)); return; }
    if (fmt === 'json') {
      downloadBlob(new Blob([JSON.stringify(serialize(onlySel ? [L.selected] : L.objects, { title: name, environment: L.env }), null, 2)], { type: 'application/json' }), `${slug(name)}.json`);
      return;
    }
    setBusy(true, `Exporting ${fmt.toUpperCase()}…`);
    const hidden = [];
    try {
      // Export only what is visible (and only the selection when asked).
      for (const o of L.objects) if ((onlySel && o !== L.selected) || !o.visible) { hidden.push([o, o.visible]); o.visible = false; }
      if (L.wire) setWire(false);
      const { blob, filename } = await exportObject(root, fmt, { name, stlUnits: units });
      downloadBlob(blob, filename);
      showToast(`Saved ${filename}`, 'success');
    } catch (err) { showToast(`Export failed: ${err.message}`, 'error'); }
    finally {
      for (const [o, v] of hidden) o.visible = v;
      if (L.wire) setWire(true);
      setBusy(false);
      viewer?.invalidate();
    }
  }

  function snapshotPng(base) {
    if (!viewer) return;
    const wasSel = selBox?.visible, helper = tc?.getHelper(), wasHelper = helper?.visible;
    if (selBox) selBox.visible = false;
    if (helper) helper.visible = false;
    if (viewer.composer) viewer.composer.render(); else viewer.renderer.render(viewer.scene, viewer.camera);
    viewer.renderer.domElement.toBlob(async (blob) => {
      if (blob) (await import('../lib/lab3d/export.js')).downloadBlob(blob, `${base}.png`);
    }, 'image/png');
    if (selBox) selBox.visible = !!wasSel;
    if (helper) helper.visible = wasHelper !== false;
    viewer.invalidate();
  }

  /* ---------------- events ---------------- */

  function setMode(m) {
    L.mode = m;
    for (const b of el.modes.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    placeInd(el.modes, '.lab-seg-ind', `[data-mode="${m}"]`);
    selectObj(L.selected, { quiet: true });
  }

  function placeInd(host, indSel, btnSel) {
    const ind = host.querySelector(indSel), b = host.querySelector(btnSel);
    if (!ind || !b || !b.offsetWidth) return;
    ind.style.width = `${b.offsetWidth}px`;
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
    ind.classList.add('is-ready');
  }

  function setLibTab(tab) {
    const order = ['models', 'shapes', 'online', 'import'];
    const dir = order.indexOf(tab) > order.indexOf(L.libTab) ? 1 : -1;
    L.libTab = tab;
    for (const b of container.querySelectorAll('[data-lib]')) b.setAttribute('aria-selected', String(b.dataset.lib === tab));
    placeInd($('.lab-libtabs'), '.lab-libtabs-ind', `[data-lib="${tab}"]`);
    el.libQ.value = '';
    el.lib.classList.remove('slide-l', 'slide-r');
    void el.lib.offsetWidth;
    el.lib.classList.add(dir > 0 ? 'slide-r' : 'slide-l');
    renderLibrary();
    el.libQ.closest('.lab-search').hidden = tab === 'import';
  }

  on(container, 'click', async (e) => {
    const t = e.target;
    if (!t.closest('.lab-menu') && !t.closest('[data-act="export"]')) closeMenu();
    const lib = t.closest('[data-lib]');
    if (lib) { setLibTab(lib.dataset.lib); return; }
    const addBtn = t.closest('[data-add-kind]');
    if (addBtn) { await addItem({ type: addBtn.dataset.addKind, [addBtn.dataset.addKind]: addBtn.dataset.addId }); if (el.lab.dataset.narrow === 'true') setDrawer(null); return; }
    const online = t.closest('[data-online]');
    if (online) { await addItem({ type: 'online', ...JSON.parse(online.dataset.online) }); if (el.lab.dataset.narrow === 'true') setDrawer(null); return; }
    const quick = t.closest('[data-quick]');
    if (quick) { await describe(quick.dataset.quick); return; }
    const sug = t.closest('[data-suggest]');
    if (sug) {
      el.suggest.hidden = true;
      if (sug.dataset.suggest === 'online') { setDrawer('side'); setLibTab('online'); el.libQ.value = sug.dataset.q; clearTimeout(onlineTimer); searchOnlineNow(sug.dataset.q.toLowerCase()); }
      if (sug.dataset.suggest === 'assistant') {
        const { openAssistant } = await import('../lib/assistant-popup.js');
        openAssistant({ prompt: `Build a 3D model of ${sug.dataset.q} in the 3D Lab.` });
      }
      return;
    }
    const exp = t.closest('[data-export]');
    if (exp) { doExport(exp.dataset.export); return; }
    const vis = t.closest('[data-vis]');
    if (vis) { const o = L.objects[Number(vis.dataset.vis)]; if (o) { o.visible = !o.visible; if (!o.visible && L.selected === o) selectObj(null); viewer?.invalidate(); renderOutline(); renderStatus(); } return; }
    const row = t.closest('[data-obj]');
    if (row) { selectObj(L.objects[Number(row.dataset.obj)]); return; }
    const mode = t.closest('[data-mode]');
    if (mode) { setMode(mode.dataset.mode); return; }
    const view = t.closest('[data-view]');
    if (view && viewer) { viewer.setView(view.dataset.view, L.objects.length ? root : viewer.scene); return; }
    const opt = t.closest('button[data-param]');
    if (opt) { setParam(opt.dataset.param, opt.dataset.value); return; }
    const act = t.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const sel = L.selected;
    switch (act) {
      case 'toggle-side': setDrawer(el.lab.dataset.narrow === 'true' ? (el.lab.dataset.drawer === 'side' ? null : 'side') : null, 'side'); break;
      case 'toggle-insp': setDrawer(el.lab.dataset.narrow === 'true' ? (el.lab.dataset.drawer === 'insp' ? null : 'insp') : null, 'insp'); break;
      case 'close-drawers': setDrawer(null); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'export': el.menu.hidden ? openExportMenu(t.closest('[data-act]')) : closeMenu(); break;
      case 'fit': frameAll(); break;
      case 'grid': L.grid = !L.grid; t.closest('button').setAttribute('aria-pressed', String(L.grid)); updateGrid(); break;
      case 'wire': L.wire = !L.wire; t.closest('button').setAttribute('aria-pressed', String(L.wire)); setWire(L.wire); break;
      case 'spin': L.spin = !L.spin; t.closest('button').setAttribute('aria-pressed', String(L.spin)); if (viewer) { viewer.controls.autoRotate = L.spin; viewer.invalidate(); } break;
      case 'snap': L.snap = !L.snap; t.closest('button').setAttribute('aria-pressed', String(L.snap)); applySnap(); break;
      case 'env': L.env = L.env === 'studio' ? 'outdoor' : 'studio'; await createViewer(); persist(); break;
      case 'png': snapshotPng((await import('../lib/lab3d/export.js')).slug(L.title)); break;
      case 'duplicate': duplicate(sel); break;
      case 'delete': if (sel) removeObj(sel); break;
      case 'floor': if (sel) { const b = new THREE.Box3().setFromObject(sel); sel.position.y -= b.min.y; fillTransformFields(); commit(); viewer.invalidate(); } break;
      case 'focus': if (sel) frameAll(sel); break;
      case 'real-size': if (sel) { sel.scale.setScalar(1); keepOnFloor(sel); fillTransformFields(); commit(); viewer.invalidate(); } break;
      default:
    }
  });

  async function setParam(key, value) {
    const o = L.selected;
    const lab = o?.userData.lab;
    if (!lab || lab.type !== 'model' && lab.type !== 'shape') return;
    const def = lab.type === 'model' ? MODEL_BY_ID.get(lab.model).params[key] : SHAPE_BY_ID.get(lab.shape).params[key];
    let v = value;
    if (def?.type === 'toggle') v = !!value;
    else if (def && def.type !== 'color' && def.type !== 'select') v = Number(value);
    await replaceObj(o, { ...lab, params: { ...(lab.params || {}), [key]: v } });
  }

  on(container, 'input', (e) => {
    const t = e.target;
    if (t === el.libQ) { if (L.libTab === 'online') { clearTimeout(onlineTimer); onlineTimer = setTimeout(() => searchOnlineNow(el.libQ.value.trim()), 350); } else renderLibrary(); return; }
    const o = L.selected;
    if (t.dataset.tf && o) {
      const v = Number(t.value);
      if (!Number.isFinite(v)) return;
      const k = t.dataset.tf;
      if (k[0] === 'p') o.position[k[1]] = v;
      else if (k[0] === 'r') o.rotation[k[1]] = v * DEG;
      else if (k === 's' && v > 0) o.scale.setScalar(v);
      updateSelBox(); viewer?.invalidate();
      return;
    }
    if (t.type === 'range' && t.dataset.param) { const out = t.closest('.lab-range')?.querySelector('output'); if (out) out.textContent = `${t.value}${out.textContent.replace(/^[\d.\-]+/, '')}`; }
    if (t.dataset.role === 'name' && o) { o.name = t.value.slice(0, 80) || labelFor(o.userData.lab || {}); renderOutlineName(o); }
  });

  function renderOutlineName(o) {
    const li = el.outline.querySelector(`[data-obj="${L.objects.indexOf(o)}"] .lab-ol-name`);
    if (li) li.textContent = o.name;
  }

  on(container, 'change', (e) => {
    const t = e.target;
    if (t.dataset.tf) { if (L.selected) keepOnFloor(L.selected); fillTransformFields(); commit(); renderStatus(); return; }
    if (t.dataset.param) { setParam(t.dataset.param, t.type === 'checkbox' ? t.checked : t.value); return; }
    if (t.dataset.item && L.selected) { const lab = L.selected.userData.lab; replaceObj(L.selected, { ...lab, [t.dataset.item]: t.value }); return; }
    if (t.dataset.role === 'name') { commit(); renderStatus(); return; }
    if (t.dataset.role === 'title') { L.title = t.value.trim() || 'Untitled scene'; commit(); persist(); return; }
    if (t.dataset.role === 'file') { importFiles([...t.files]); t.value = ''; }
  });

  on(el.describe, 'submit', (e) => { e.preventDefault(); describe(el.prompt.value); });

  // Keyboard shortcuts (not while typing)
  on(el.lab, 'keydown', (e) => {
    if (e.key === 'Escape') { if (!el.menu.hidden) { closeMenu(); return; } if (el.lab.dataset.drawer) { setDrawer(null); return; } selectObj(null); return; }
    if (e.target.closest('input, select, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(L.selected); return; }
    if (mod) return;
    const k = e.key.toLowerCase();
    if (k === 'q') setMode('select');
    else if (k === 'w') setMode('translate');
    else if (k === 'e') setMode('rotate');
    else if (k === 'r') setMode('scale');
    else if (k === 'f') frameAll(L.selected || null);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && L.selected) { e.preventDefault(); removeObj(L.selected); }
  });

  // Drag library cards and files onto the stage
  on(container, 'dragstart', (e) => {
    const c = e.target.closest?.('[data-add-kind]');
    if (c) e.dataTransfer.setData('application/x-lab3d', JSON.stringify({ type: c.dataset.addKind, [c.dataset.addKind]: c.dataset.addId }));
  });
  let dragDepth = 0;
  on(el.stage, 'dragenter', (e) => { e.preventDefault(); dragDepth++; el.drop.hidden = false; });
  on(el.stage, 'dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.drop.hidden = true; });
  on(el.stage, 'dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  on(el.stage, 'drop', async (e) => {
    e.preventDefault(); dragDepth = 0; el.drop.hidden = true;
    const data = e.dataTransfer.getData('application/x-lab3d');
    if (data) {
      const item = JSON.parse(data);
      const p = floorPoint(e);
      if (p) item.at = [p.x, 0, p.z];
      await addItem(item, { frame: !L.objects.length });
      return;
    }
    if (e.dataTransfer.files?.length) importFiles([...e.dataTransfer.files]);
  });
  on(container, 'dragover', (e) => { if (e.target.closest?.('.lab-dropzone')) { e.preventDefault(); e.target.closest('.lab-dropzone').classList.add('is-over'); } });
  on(container, 'dragleave', (e) => e.target.closest?.('.lab-dropzone')?.classList.remove('is-over'));
  on(container, 'drop', (e) => { const z = e.target.closest?.('.lab-dropzone'); if (z) { e.preventDefault(); z.classList.remove('is-over'); importFiles([...(e.dataTransfer.files || [])]); } });

  function floorPoint(e) {
    if (!viewer) return null;
    const r = viewer.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, viewer.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  /* ---------------- layout: drawers on narrow screens ---------------- */

  function setDrawer(which, desktopToggle) {
    if (el.lab.dataset.narrow !== 'true') {
      if (desktopToggle === 'side') el.lab.dataset.side = el.lab.dataset.side === 'open' ? 'closed' : 'open';
      if (desktopToggle === 'insp') el.lab.dataset.insp = el.lab.dataset.insp === 'open' ? 'closed' : 'open';
      setTimeout(() => viewer?.resize(), 320);
      return;
    }
    if (which) el.lab.dataset.drawer = which; else delete el.lab.dataset.drawer;
  }

  const ro = new ResizeObserver(() => {
    const narrow = el.lab.clientWidth < 900;
    if (String(narrow) !== el.lab.dataset.narrow) { el.lab.dataset.narrow = String(narrow); if (!narrow) delete el.lab.dataset.drawer; }
    placeInd($('.lab-libtabs'), '.lab-libtabs-ind', `[data-lib="${L.libTab}"]`);
    placeInd(el.modes, '.lab-seg-ind', `[data-mode="${L.mode}"]`);
  });
  ro.observe(el.lab);
  disposers.push(() => ro.disconnect());

  const themeMo = new MutationObserver(() => { if (viewer) createViewer(); });
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  disposers.push(() => themeMo.disconnect());

  // A scene sent from the Assistant while the Lab is open
  on(window, 'toolbox:lab3d-open', async (e) => { const spec = e.detail?.spec; if (spec) { try { localStorage.removeItem(LAB_HANDOFF); } catch { /* ignore */ } await applySpec(spec, { replace: !!e.detail.replace }); } });

  /* ---------------- start ---------------- */

  (async () => {
    await createViewer();
    if (L.dead) return;
    renderLibrary();
    setMode(L.mode);
    let handoff = null, saved = null;
    try { handoff = JSON.parse(localStorage.getItem(LAB_HANDOFF) || 'null'); localStorage.removeItem(LAB_HANDOFF); } catch { /* ignore */ }
    try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* ignore */ }
    if (saved?.environment === 'outdoor') { L.env = 'outdoor'; await createViewer(); }
    if (saved?.items?.length && !(handoff?.replace)) { L.title = saved.title || L.title; el.title.value = L.title; await restore(saved); }
    L.history = [snapshot()];
    // A scene from the Assistant lands on top of the saved one, as an undoable step.
    if (handoff?.spec) await applySpec(handoff.spec, { replace: !!handoff.replace });
    syncUndo();
    refresh();
    if (L.objects.length) frameAll();
  })().catch((err) => {
    el.canvas.innerHTML = `<div class="lab-fail">3D is unavailable here: ${esc(err?.message || 'WebGL could not start')}.</div>`;
  });

  return {
    destroy() {
      L.dead = true;
      clearTimeout(saveTimer); clearTimeout(onlineTimer);
      onlineCtl?.abort();
      cancelThumbnails();
      persist();
      disposers.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      try { tc?.detach(); tc?.dispose?.(); } catch { /* ignore */ }
      viewer?.dispose();
      viewer = null;
      container.innerHTML = '';
    },
  };
}
