/* ============================================================
   Anatomy Explorer — High-Performance 3D Human Anatomy Atlas.

   Geometry: BodyParts3D (© 2008 DBCLS, CC BY-SA 2.1 JP), converted
   to Draco-compressed GLB. Real-time 60 FPS spatial raycasting,
   virtual-scrolled structure list (handles 1000+ items without DOM
   bloat), search token pre-index, shared system materials, raycast
   suppression during OrbitControls drag, pill region filters, and
   rich clinical ontology with innervation, blood supply, and relations.
   ============================================================ */

import { anatomyService, ANATOMICAL_REGIONS, stemWord } from '../lib/anatomy-data.js';

const ROOT  = import.meta.env?.BASE_URL ?? '/';
const BASE  = `${ROOT}anatomy/`.replace(/\/{2,}/g, '/');
const DRACO = `${ROOT}draco/`.replace(/\/{2,}/g, '/');

/* ── virtual scroller ──────────────────────────────────────── */

/**
 * Lightweight virtual scroller.  Only the visible rows (plus a small
 * overscan buffer) are in the DOM at any time; the rest is filled by a
 * single transparent spacer element so the scrollbar stays correct.
 *
 * Usage:
 *   const vs = new VirtualScroller(containerEl, itemHeight, renderRow);
 *   vs.setItems(array);          // initial population or filter update
 *   vs.scrollToId('FMA12345');   // scroll a particular id into view
 */
class VirtualScroller {
  constructor(container, itemHeight, renderRow) {
    this._el        = container;
    this._ih        = itemHeight;
    this._render    = renderRow;
    this._items     = [];
    this._pool      = [];  // recycled DOM nodes
    this._nodes     = new Map(); // index → DOM node
    this._overscan  = 4;

    this._spacer    = document.createElement('div');
    this._spacer.style.cssText = 'pointer-events:none;';
    this._el.appendChild(this._spacer);

    this._el.addEventListener('scroll', () => this._update(), { passive: true });
  }

  setItems(items) {
    this._items = items;
    // clear existing rendered nodes
    for (const [, node] of this._nodes) this._recycle(node);
    this._nodes.clear();
    this._spacer.style.height = `${items.length * this._ih}px`;
    this._update();
  }

  _update() {
    const scrollTop = this._el.scrollTop;
    const height    = this._el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / this._ih) - this._overscan);
    const end   = Math.min(this._items.length, Math.ceil((scrollTop + height) / this._ih) + this._overscan);

    // remove nodes scrolled out of view
    for (const [i, node] of this._nodes) {
      if (i < start || i >= end) {
        this._recycle(node);
        this._nodes.delete(i);
      }
    }

    // create/update nodes now in view
    for (let i = start; i < end; i++) {
      if (this._nodes.has(i)) continue;
      const node = this._acquire();
      node.style.position  = 'absolute';
      node.style.top       = `${i * this._ih}px`;
      node.style.width     = '100%';
      this._render(node, this._items[i], i);
      this._el.appendChild(node);
      this._nodes.set(i, node);
    }
  }

  _acquire() {
    return this._pool.length ? this._pool.pop() : document.createElement('div');
  }

  _recycle(node) {
    node.remove();
    this._pool.push(node);
  }

  scrollToId(id) {
    const idx = this._items.findIndex(s => s.id === id);
    if (idx === -1) return;
    this._el.scrollTop = Math.max(0, idx * this._ih - 40);
  }

  markSelected(id) {
    for (const [i, node] of this._nodes) {
      const item = this._items[i];
      node.firstChild?.classList.toggle('is-selected', item?.id === id);
    }
  }
}

/* ── search index ──────────────────────────────────────────── */

/**
 * Pre-built token index for fast O(1) filtered lookup.
 * Built once after the structure list is loaded; each search hit is a
 * pre-lowercased concatenation of the structure name + common name so
 * we don't call anatomyService.getDetail() on every keystroke.
 */
function buildSearchIndex(structures) {
  return structures.map(s => {
    const detail = anatomyService.getDetail(s.name, s.system);
    return {
      ...s,
      _idx: `${s.name} ${detail.commonName || ''}`.toLowerCase(),
      // index.json carries a region measured from the geometry; the
      // name-based guess is only a fallback for older catalogs.
      _region: s.region || detail.region,
    };
  });
}

const regionLabel = id => ANATOMICAL_REGIONS.find(r => r.id === id)?.label ?? id;

/* ── main export ───────────────────────────────────────────── */

export default {
  async render(container) {
    this._alive = true;

    container.innerHTML = `
      <div class="t3d-loading"><div class="t3d-spinner"></div><p>Loading the anatomy viewer…</p></div>`;

    let THREE, Viewer3D, GLTFLoader, DRACOLoader, index;
    try {
      const [viewerMod, gltfMod, dracoMod, indexRes] = await Promise.all([
        import('../lib/viewer3d.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        fetch(`${BASE}index.json`),
      ]);
      ({ Viewer3D, THREE } = viewerMod);
      ({ GLTFLoader }      = gltfMod);
      ({ DRACOLoader }     = dracoMod);
      if (!indexRes.ok) throw new Error(`anatomy index missing (HTTP ${indexRes.status})`);
      index = await indexRes.json();
    } catch (err) {
      container.innerHTML = `<div class="no-results">
        <p class="no-results-title">Could not start the anatomy viewer</p>
        <p class="no-results-text">${err.message}</p></div>`;
      return;
    }
    if (!this._alive) return;

    const systemKeys = Object.keys(index.systems).sort(
      (a, b) => index.systems[a].order - index.systems[b].order,
    );
    const byId = new Map(index.structures.map(s => [s.id, s]));
    const hex  = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const kb   = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

    /* ── shared materials (one per system instead of one per mesh) ── */
    // Populated lazily when a system is loaded; avoids cloning materials
    // per mesh which explodes WebGL draw calls with 900+ structures.
    const systemMats   = {};   // key → THREE.MeshStandardMaterial (base)
    const hoverMat     = {};   // key → THREE.MeshStandardMaterial (under the pointer)
    const highlightMat = {};   // key → THREE.MeshStandardMaterial (selected)
    const allMats = () => [systemMats, hoverMat, highlightMat].flatMap(Object.values);

    /* ── layout ──────────────────────────────────────────────────── */

    container.innerHTML = `
      <div class="t3d">
        <aside class="t3d-panel">
          <section class="t3d-block">
            <h3 class="t3d-h">Systems</h3>
            <div id="an-systems" class="t3d-toggles"></div>
            <p class="biz-hint">Each system downloads on demand the first time you toggle it.</p>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Display &amp; Cut Plane</h3>
            <label class="t3d-slider-row"><span>Opacity</span>
              <input type="range" id="an-opacity" min="15" max="100" value="100" class="tool-range">
              <output id="an-opacity-out">100%</output></label>
            <label class="tool-checkbox"><input type="checkbox" id="an-isolate"> <span>Isolate selection</span></label>

            <div style="margin-top:10px;">
              <span class="tool-label" style="margin-bottom:4px; font-size:0.75rem;">Cross-section Plane:</span>
              <div class="btn-group t3d-seg" id="an-plane">
                <button class="btn btn-sm is-active" data-plane="none">Off</button>
                <button class="btn btn-sm" data-plane="z">Coronal</button>
                <button class="btn btn-sm" data-plane="x">Sagittal</button>
                <button class="btn btn-sm" data-plane="y">Axial</button>
              </div>
              <label class="t3d-slider-row" id="an-plane-row" hidden style="margin-top:6px;"><span>Depth</span>
                <input type="range" id="an-plane-pos" min="0" max="100" value="50" class="tool-range">
                <output id="an-plane-out">50%</output></label>
              <label class="tool-checkbox" id="an-flip-row" hidden>
                <input type="checkbox" id="an-flip"> <span>Flip side</span></label>
            </div>
          </section>

          <section class="t3d-block">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
              <h3 class="t3d-h" style="margin:0;">Structures</h3>
              <span id="an-count" class="t3d-count"></span>
            </div>

            <!-- Pill region filters -->
            <div id="an-region-pills" class="an-pill-filters" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
              ${ANATOMICAL_REGIONS.map((r, i) =>
                `<button class="an-pill${i === 0 ? ' is-active' : ''}" data-region="${r.id}">${r.label}</button>`
              ).join('')}
            </div>

            <input type="text" id="an-filter" class="tool-input t3d-filter"
                   placeholder="Search structures, organs, bones…"
                   autocomplete="off" spellcheck="false">
            <!-- Virtual-scrolled list: position:relative so absolute children work -->
            <div id="an-list" class="t3d-list" style="position:relative; overflow-y:auto;"></div>
          </section>
        </aside>

        <div class="t3d-stage">
          <div class="t3d-canvas" id="an-canvas" style="position:relative;">
            <div class="an-progress" id="an-progress" hidden><span id="an-progress-text"></span></div>
            <!-- In-viewport Clinical HUD Badge -->
            <div class="an-render-badge" id="an-render-badge" style="display:none;"></div>
          </div>

          <div class="t3d-toolbar">
            <div class="btn-group t3d-seg" id="an-views">
              <button class="btn btn-sm" data-view="front">Front</button>
              <button class="btn btn-sm" data-view="back">Back</button>
              <button class="btn btn-sm" data-view="left">Left</button>
              <button class="btn btn-sm" data-view="right">Right</button>
              <button class="btn btn-sm" data-view="top">Top</button>
              <button class="btn btn-sm is-active" data-view="iso">3/4</button>
            </div>
            <div class="t3d-toolbar-right">
              <label class="tool-checkbox"><input type="checkbox" id="an-spin"> <span>Spin</span></label>
              <button class="btn btn-sm" id="an-hide">Hide selected</button>
              <button class="btn btn-sm" id="an-reset">Reset</button>
            </div>
          </div>

          <!-- Structured Clinical Information Panel -->
          <div class="t3d-info" id="an-info" style="max-height:38vh; overflow-y:auto;">
            <div class="t3d-info-empty">
              <strong>Click any anatomical structure in 3D to explore</strong>
              <span>Left-drag to rotate · scroll to zoom · right-drag to pan</span>
            </div>
          </div>

          <p class="an-credit">Model: <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noopener">BodyParts3D</a>,
            © 2008 Database Center for Life Science (DBCLS), licensed
            <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 JP</a>.
            Ontology mapped to Terminologia Anatomica &amp; Foundational Model of Anatomy (FMA).</p>
        </div>
      </div>`;

    /* ── scene ───────────────────────────────────────────────────── */

    const mount  = container.querySelector('#an-canvas');
    const viewer = new Viewer3D(mount, { background: 0x000000, ground: false, fov: 40 });
    this._viewer = viewer;

    const dracoLoader = new DRACOLoader().setDecoderPath(DRACO);
    const gltfLoader  = new GLTFLoader().setDRACOLoader(dracoLoader);
    this._draco = dracoLoader;

    const root = new THREE.Group();
    viewer.scene.add(root);

    const HOME = { target: [0, 0.85, 0], position: [1.30, 1.50, 2.40] };
    viewer.controls.target.set(...HOME.target);
    viewer.camera.position.set(...HOME.position);
    viewer.controls.minDistance = 0.12;
    viewer.controls.maxDistance = 8;
    viewer.controls.update();

    const loaded  = new Map();   // system key → THREE.Group
    const visible = Object.fromEntries(systemKeys.map(k => [k, false]));
    const hidden  = new Set();   // structure ids hidden by the user
    let opacity = 1;
    let isolate = false;
    let selectedRegion = 'all';
    this._loaded = loaded;

    /* ── hover / selection highlight ─────────────────────────────── */
    // Materials are shared per system, so the viewer's default highlight
    // (editing the material's emissive) would light up the whole system.
    // Swap the structure's meshes to the system's hover/selected material.
    viewer.setEmphasisHandler((obj, { hovered, selected }) => {
      const key = obj.userData.structure?.system;
      if (!systemMats[key]) return;
      const mat = selected ? highlightMat[key] : hovered ? hoverMat[key] : systemMats[key];
      obj.traverse(n => { if (n.isMesh) n.material = mat; });
    });

    /* ── loading ─────────────────────────────────────────────────── */

    const progressEl   = container.querySelector('#an-progress');
    const progressText = container.querySelector('#an-progress-text');
    const showProgress = msg => { progressEl.hidden = false; progressText.textContent = msg; };
    const hideProgress = ()  => { progressEl.hidden = true; };

    async function loadSystem(key) {
      if (loaded.has(key)) return loaded.get(key);
      const meta = index.systems[key];
      showProgress(`Loading ${meta.label.toLowerCase()} — ${kb(meta.bytes)}…`);

      // Create shared materials for this system once
      if (!systemMats[key]) {
        systemMats[key] = new THREE.MeshStandardMaterial({
          color: new THREE.Color(...meta.color),
          roughness: 0.72,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        hoverMat[key] = systemMats[key].clone();
        hoverMat[key].emissive = new THREE.Color(0x404040);
        highlightMat[key] = systemMats[key].clone();
        highlightMat[key].emissive = new THREE.Color(0x0ea5e9);
        for (const m of [systemMats[key], hoverMat[key], highlightMat[key]]) {
          m.clippingPlanes = viewer.clipPlanes?.length ? viewer.clipPlanes : null;
          setOpacity(m);
        }
      }

      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.load(
          `${BASE}${meta.file}`,
          resolve,
          evt => {
            if (evt.total) showProgress(`Loading ${meta.label.toLowerCase()} — ${Math.round(evt.loaded / evt.total * 100)}%`);
          },
          reject,
        );
      });

      const group = gltf.scene;
      group.name = `system:${key}`;
      const sharedMat = systemMats[key];
      for (const child of group.children) {
        child.userData.structure = byId.get(child.name) || { id: child.name, name: child.name, system: key };
        child.traverse(n => {
          if (!n.isMesh) return;
          n.castShadow    = false;
          n.receiveShadow = false;
          // Use shared material — no clone(), which is the key perf win.
          n.material = sharedMat;
        });
        viewer.registerPickable(child);
      }
      root.add(group);
      loaded.set(key, group);
      hideProgress();
      return group;
    }

    /* ── appearance ──────────────────────────────────────────────── */

    let appliedOpacity = 1;

    function setOpacity(m) {
      m.transparent = opacity < 1;
      m.depthWrite  = opacity > 0.85;
      m.opacity     = opacity;
      m.needsUpdate = true;
    }

    function applyAppearance() {
      const selId = viewer.selected?.userData.structure?.id ?? null;

      if (appliedOpacity !== opacity) {
        appliedOpacity = opacity;
        for (const m of allMats()) setOpacity(m);
      }

      for (const [key, group] of loaded) {
        group.visible = visible[key];
        if (!visible[key]) continue;
        for (const child of group.children) {
          const id = child.userData.structure?.id;
          child.visible = !hidden.has(id) && (!isolate || !selId || id === selId);
        }
      }
    }

    /* ── system toggles ──────────────────────────────────────────── */

    const systemsEl = container.querySelector('#an-systems');
    systemsEl.innerHTML = systemKeys.map(k => {
      const s = index.systems[k];
      return `<label class="t3d-toggle">
        <input type="checkbox" data-system="${k}">
        <span class="t3d-dot" style="background:${hex(s.color)}"></span>
        <span class="t3d-toggle-name">${s.label}</span>
        <span class="t3d-count">${s.count} · ${kb(s.bytes)}</span>
      </label>`;
    }).join('');

    systemsEl.addEventListener('change', async e => {
      const key = e.target.dataset.system;
      if (!key) return;
      const on = e.target.checked;
      e.target.disabled = true;
      try {
        if (on) await loadSystem(key);
        if (!this._alive) return;
        visible[key] = on;
        if (!on && viewer.selected?.userData.structure?.system === key) viewer.select(null);
        applyAppearance();
        renderList();
        // Frame the system just switched on. Framing the whole body left small
        // systems (the nervous system is only the brain) as a speck off-centre.
        if (on) viewer.frame(loaded.get(key), 1.15);
      } catch (err) {
        e.target.checked = false;
        showProgress(`Could not load ${key}: ${err.message}`);
        setTimeout(hideProgress, 4000);
      } finally {
        e.target.disabled = false;
      }
    });

    /* ── display controls ────────────────────────────────────────── */

    const opacityEl = container.querySelector('#an-opacity');
    opacityEl.addEventListener('input', () => {
      opacity = Number(opacityEl.value) / 100;
      container.querySelector('#an-opacity-out').textContent = `${opacityEl.value}%`;
      applyAppearance();
    });

    container.querySelector('#an-isolate').addEventListener('change', e => {
      isolate = e.target.checked;
      applyAppearance();
    });

    container.querySelector('#an-hide').addEventListener('click', () => {
      const id = viewer.selected?.userData.structure?.id;
      if (!id) return;
      hidden.add(id);
      viewer.select(null);
      applyAppearance();
      renderList();
    });

    /* ── cross-section ───────────────────────────────────────────── */

    const RANGE  = { x: [-0.5, 0.5], y: [0, 1.9], z: [-0.4, 0.4] };
    let planeAxis = null;
    const planeRow  = container.querySelector('#an-plane-row');
    const flipRow   = container.querySelector('#an-flip-row');
    const planePos  = container.querySelector('#an-plane-pos');
    const flipInput = container.querySelector('#an-flip');

    const applyPlane = () => {
      if (!planeAxis) viewer.setClipPlane(null);
      else {
        const [lo, hi] = RANGE[planeAxis];
        viewer.setClipPlane(planeAxis, lo + (hi - lo) * (Number(planePos.value) / 100), flipInput.checked);
      }
      // The viewer only clips materials currently on a mesh; the hover and
      // selected variants are swapped in later, so clip them too.
      for (const m of allMats()) { m.clippingPlanes = viewer.clipPlanes; m.needsUpdate = true; }
    };

    container.querySelector('#an-plane').addEventListener('click', e => {
      const btn = e.target.closest('[data-plane]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#an-plane .btn')) b.classList.toggle('is-active', b === btn);
      planeAxis = btn.dataset.plane === 'none' ? null : btn.dataset.plane;
      planeRow.hidden = flipRow.hidden = !planeAxis;
      applyPlane();
    });
    planePos.addEventListener('input', () => {
      container.querySelector('#an-plane-out').textContent = `${planePos.value}%`;
      applyPlane();
    });
    flipInput.addEventListener('change', applyPlane);

    /* ── search index + virtual list ─────────────────────────────── */

    // Pre-build search index once (O(n) single pass at startup).
    const searchIndex = buildSearchIndex(index.structures);

    const ITEM_HEIGHT = 34; // px — must match CSS .t3d-list-item height
    const listEl   = container.querySelector('#an-list');
    const filterEl = container.querySelector('#an-filter');
    const countEl  = container.querySelector('#an-count');

    // Render a single row into a recycled node
    function renderRow(node, s) {
      const isOff = !visible[s.system];
      const isHid = hidden.has(s.id);
      const isSel = viewer.selected?.userData.structure?.id === s.id;
      node.innerHTML = `<button class="t3d-list-item${isSel ? ' is-selected' : ''}${isOff ? ' is-off' : ''}"
              data-id="${s.id}" data-system="${s.system}" data-name="${s.name}" title="${s.name}">
        <span class="t3d-dot" style="background:${hex(index.systems[s.system].color)}"></span>
        <span class="an-item-name">${s.name}</span>
        ${isHid ? '<span class="an-item-tag">hidden</span>' : ''}
      </button>`;
    }

    const scroller = new VirtualScroller(listEl, ITEM_HEIGHT, renderRow);

    let filterTimeout;
    function renderList() {
      const q     = filterEl.value.trim().toLowerCase();
      const qStem = stemWord(q);

      const rows = searchIndex.filter(s => {
        if (q) {
          const hit = s._idx.includes(q) || (qStem && s._idx.includes(qStem));
          if (!hit) return false;
        }
        if (selectedRegion !== 'all' && s._region !== selectedRegion) return false;
        return true;
      });

      countEl.textContent = `${rows.length}`;
      scroller.setItems(rows);
    }

    /* ── pill region filter ──────────────────────────────────────── */

    container.querySelector('#an-region-pills').addEventListener('click', e => {
      const btn = e.target.closest('.an-pill');
      if (!btn) return;
      for (const b of container.querySelectorAll('.an-pill')) b.classList.remove('is-active');
      btn.classList.add('is-active');
      selectedRegion = btn.dataset.region;
      renderList();
    });

    /* ── list click (delegated) ──────────────────────────────────── */

    listEl.addEventListener('click', async e => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const { id, system } = btn.dataset;

      if (!visible[system]) {
        const cb = systemsEl.querySelector(`[data-system="${system}"]`);
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        for (let i = 0; i < 200 && !loaded.has(system); i++) await new Promise(r => setTimeout(r, 50));
      }
      hidden.delete(id);
      const obj = loaded.get(system)?.children.find(c => c.userData.structure?.id === id);
      if (obj) {
        applyAppearance();
        viewer.select(obj);
        focusOn(obj);
      }
    });

    filterEl.addEventListener('input', () => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(renderList, 120);
    });

    /* ── info panel ──────────────────────────────────────────────── */

    const infoEl = container.querySelector('#an-info');

    function focusOn(obj) {
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) return;
      const centre = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3()).length();
      const dir    = viewer.camera.position.clone().sub(viewer.controls.target).normalize();
      viewer.controls.target.copy(centre);
      viewer.camera.position.copy(centre).add(dir.multiplyScalar(Math.max(size * 2.2, 0.2)));
      viewer.controls.update();
    }

    viewer.onSelect(obj => {
      const badgeEl = container.querySelector('#an-render-badge');
      const s = obj?.userData.structure;
      if (!s) {
        if (badgeEl) badgeEl.style.display = 'none';
        infoEl.innerHTML = `<div class="t3d-info-empty">
          <strong>Click any anatomical structure in 3D to explore</strong>
          <span>Left-drag to rotate · scroll to zoom · right-drag to pan</span></div>`;
      } else {
        const detail = anatomyService.getDetail(s.name, s.system);
        const region = regionLabel(s.region || detail.region);
        const sys    = index.systems[s.system] || { label: s.system, color: [0.5, 0.5, 0.5] };
        const fmaUrl = (s.fma || detail.fma)
          ? `https://bioportal.bioontology.org/ontologies/FMA?p=classes&conceptid=http%3A%2F%2Fpurl.org%2Fsig%2Font%2Ffma%2Ffma${s.fma || detail.fma}`
          : null;

        // HUD badge
        if (badgeEl) {
          badgeEl.style.display = 'flex';
          badgeEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; width:100%;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="t3d-dot" style="background:${hex(sys.color)}; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
                <span style="font-size:0.75rem; font-weight:700; color:var(--text);">${sys.label}</span>
                <span style="font-size:0.68rem; padding:1px 6px; border-radius:999px; background:var(--bg-subtle); color:var(--text-secondary); border:1px solid var(--border); font-family:var(--mono);">${region}</span>
              </div>
              <button type="button" class="btn btn-secondary btn-circle" id="an-badge-close" title="Close" aria-label="Close" style="--circle-size:22px; flex-shrink:0; font-size:12px; line-height:1;">&times;</button>
            </div>
            <h4 style="margin:6px 0 2px; font-size:0.96rem; font-weight:700; color:var(--text); line-height:1.2;">${s.name}</h4>
            ${detail.commonName && detail.commonName.toLowerCase() !== s.name.toLowerCase() ? `<div style="font-size:0.76rem; color:var(--text-secondary); margin-bottom:4px;">Common: ${detail.commonName}</div>` : ''}
            <p style="margin:2px 0 6px; font-size:0.78rem; line-height:1.4; color:var(--text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${detail.functionDesc || detail.clinicalNotes || 'Anatomical structure'}</p>
            <div style="display:flex; justify-content:flex-end; align-items:center; width:100%; border-top:1px solid var(--border); padding-top:6px; margin-top:4px;">
              <button type="button" id="an-badge-show-more" class="btn btn-primary btn-sm" style="font-size:0.72rem; padding:3px 10px; border-radius:9999px;">
                Show more details &darr;
              </button>
            </div>
          `;
          badgeEl.querySelector('#an-badge-close')?.addEventListener('click', e => {
            e.stopPropagation();
            badgeEl.style.display = 'none';
          });
          badgeEl.querySelector('#an-badge-show-more')?.addEventListener('click', e => {
            e.stopPropagation();
            infoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }

        infoEl.innerHTML = `
          <div class="t3d-info-head" style="align-items:flex-start; margin-bottom:10px;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; flex-wrap:wrap;">
                <span class="t3d-dot" style="background:${hex(sys.color)}"></span>
                <span class="t3d-info-system" style="margin:0;">${sys.label}</span>
                <span style="font-size:0.72rem; padding:1px 6px; border-radius:999px; background:var(--g150); color:var(--g700);">${region}</span>
                ${fmaUrl ? `<a class="an-fma" href="${fmaUrl}" target="_blank" rel="noopener" style="font-size:0.72rem;">FMA ${s.fma || detail.fma}</a>` : ''}
              </div>
              <h3 style="margin:0; font-size:1.15rem; color:var(--black);">${s.name}</h3>
              ${detail.commonName && detail.commonName.toLowerCase() !== s.name.toLowerCase() ? `<div style="font-size:0.8rem; color:var(--g600); margin-top:2px;">Common: ${detail.commonName}</div>` : ''}
            </div>
          </div>

          <!-- Function & Physiology -->
          <div style="margin-bottom:8px;">
            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--g600); letter-spacing:0.04em;">Function</span>
            <p style="margin:2px 0 0; font-size:0.82rem; line-height:1.45; color:var(--g800);">${detail.functionDesc}</p>
          </div>

          <!-- Clinical Pearls -->
          <div style="margin-bottom:8px; background:rgba(239,68,68,0.05); border-left:3px solid var(--danger); padding:6px 10px; border-radius:0 6px 6px 0;">
            <span style="font-size:0.74rem; font-weight:700; text-transform:uppercase; color:var(--danger); letter-spacing:0.04em;">Clinical Pearls &amp; Pathology</span>
            <p style="margin:2px 0 0; font-size:0.8rem; line-height:1.4; color:#7f1d1d;">${detail.clinicalNotes}</p>
          </div>

          <!-- Neurovascular Details -->
          ${(detail.innervation || detail.bloodSupply) ? `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; font-size:0.78rem;">
              ${detail.innervation ? `
                <div style="background:var(--g100); padding:6px 8px; border-radius:6px;">
                  <b style="color:var(--g800);">Innervation:</b>
                  <div style="color:var(--g700); margin-top:2px;">${detail.innervation}</div>
                </div>` : ''}
              ${detail.bloodSupply ? `
                <div style="background:var(--g100); padding:6px 8px; border-radius:6px;">
                  <b style="color:var(--g800);">Blood Supply:</b>
                  <div style="color:var(--g700); margin-top:2px;">${detail.bloodSupply}</div>
                </div>` : ''}
            </div>` : ''}

          <!-- Articulations / Related Structures -->
          ${(detail.relations && detail.relations.length) ? `
            <div style="margin-top:6px;">
              <span style="font-size:0.74rem; font-weight:700; text-transform:uppercase; color:var(--g600);">Articulations / Related</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                ${detail.relations.map(rel => `<span style="font-size:0.74rem; background:var(--white); border:1px solid var(--g200); padding:2px 6px; border-radius:4px; color:var(--g800);">${rel}</span>`).join('')}
              </div>
            </div>` : ''}
        `;
      }

      if (isolate) applyAppearance();
      scroller.markSelected(s?.id ?? null);
      if (s?.id) scroller.scrollToId(s.id);
    });

    /* ── toolbar ─────────────────────────────────────────────────── */

    container.querySelector('#an-views').addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#an-views .btn')) b.classList.toggle('is-active', b === btn);
      const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.001], iso: [0.6, 0.25, 1] };
      const dist = viewer.camera.position.distanceTo(viewer.controls.target);
      viewer.camera.position.copy(viewer.controls.target)
        .add(new THREE.Vector3(...dirs[btn.dataset.view]).normalize().multiplyScalar(dist));
      viewer.controls.update();
    });

    container.querySelector('#an-spin').addEventListener('change', e => { viewer.controls.autoRotate = e.target.checked; });

    container.querySelector('#an-reset').addEventListener('click', () => {
      hidden.clear();
      isolate = false;
      container.querySelector('#an-isolate').checked = false;
      opacityEl.value = 100;
      opacity = 1;
      container.querySelector('#an-opacity-out').textContent = '100%';
      viewer.select(null);
      applyAppearance();
      renderList();
      viewer.controls.target.set(...HOME.target);
      viewer.camera.position.set(...HOME.position);
      viewer.controls.update();
      if (loaded.size) viewer.frame(root, 1.15);
    });

    /* ── start ───────────────────────────────────────────────────── */

    renderList();
    // Don't auto-load all systems — let the user select.
    // Auto-load skeletal only as the default starting point.
    const skeletalCb = systemsEl.querySelector('[data-system="skeletal"]');
    if (skeletalCb) {
      skeletalCb.checked = true;
      skeletalCb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },

  destroy() {
    this._alive = false;
    this._draco?.dispose();
    this._viewer?.dispose();
    this._viewer = null;
    this._loaded = null;
  },
};
