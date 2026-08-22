/* ============================================================
   Anatomy Explorer — real 3D human anatomy.

   Geometry is BodyParts3D (© 2008 DBCLS, CC BY-SA 2.1 JP), converted
   to Draco-compressed GLB by scripts/anatomy-build.mjs. Each body
   system is a separate file loaded only when it is switched on, so
   opening the tool costs a few hundred kilobytes rather than five
   megabytes.

   See public/anatomy/ATTRIBUTION.md for licence obligations.
   ============================================================ */

import { noteFor } from '../lib/anatomy-notes.js';

const ROOT   = import.meta.env?.BASE_URL ?? '/';
const BASE   = `${ROOT}anatomy/`.replace(/\/{2,}/g, '/');
const DRACO  = `${ROOT}draco/`.replace(/\/{2,}/g, '/');

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
      ({ GLTFLoader } = gltfMod);
      ({ DRACOLoader } = dracoMod);
      if (!indexRes.ok) throw new Error(`anatomy index missing (HTTP ${indexRes.status})`);
      index = await indexRes.json();
    } catch (err) {
      container.innerHTML = `<div class="no-results">
        <p class="no-results-title">Could not start the anatomy viewer</p>
        <p class="no-results-text">${err.message}</p></div>`;
      return;
    }
    if (!this._alive) return;

    const systemKeys = Object.keys(index.systems).sort((a, b) => index.systems[a].order - index.systems[b].order);
    const byId = new Map(index.structures.map(s => [s.id, s]));
    const hex = (c) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const kb  = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

    /* ---------------- layout ---------------- */

    container.innerHTML = `
      <div class="t3d">
        <aside class="t3d-panel">
          <section class="t3d-block">
            <h3 class="t3d-h">Systems</h3>
            <div id="an-systems" class="t3d-toggles"></div>
            <p class="biz-hint">Each system downloads the first time you switch it on.</p>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Display</h3>
            <label class="t3d-slider-row"><span>Opacity</span>
              <input type="range" id="an-opacity" min="15" max="100" value="100" class="tool-range">
              <output id="an-opacity-out">100%</output></label>
            <label class="tool-checkbox"><input type="checkbox" id="an-isolate"> <span>Isolate selection</span></label>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Cross-section</h3>
            <div class="btn-group t3d-seg" id="an-plane">
              <button class="btn btn-sm is-active" data-plane="none">Off</button>
              <button class="btn btn-sm" data-plane="z">Coronal</button>
              <button class="btn btn-sm" data-plane="x">Sagittal</button>
              <button class="btn btn-sm" data-plane="y">Axial</button>
            </div>
            <label class="t3d-slider-row" id="an-plane-row" hidden><span>Depth</span>
              <input type="range" id="an-plane-pos" min="0" max="100" value="50" class="tool-range">
              <output id="an-plane-out">50%</output></label>
            <label class="tool-checkbox" id="an-flip-row" hidden>
              <input type="checkbox" id="an-flip"> <span>Flip side</span></label>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Structures <span id="an-count" class="t3d-count"></span></h3>
            <input type="text" id="an-filter" class="tool-input t3d-filter" placeholder="Search structures…" autocomplete="off" spellcheck="false">
            <div id="an-list" class="t3d-list"></div>
          </section>
        </aside>

        <div class="t3d-stage">
          <div class="t3d-canvas" id="an-canvas">
            <div class="an-progress" id="an-progress" hidden><span id="an-progress-text"></span></div>
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

          <div class="t3d-info" id="an-info">
            <div class="t3d-info-empty">
              <strong>Click any structure to identify it</strong>
              <span>Drag to rotate · scroll to zoom · right-drag to pan</span>
            </div>
          </div>

          <p class="an-credit">Model: <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noopener">BodyParts3D</a>,
            © 2008 Database Center for Life Science, licensed
            <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 JP</a>.
            A single adult male dataset — not a substitute for a clinical atlas.</p>
        </div>
      </div>`;

    /* ---------------- scene ---------------- */

    const mount  = container.querySelector('#an-canvas');
    const viewer = new Viewer3D(mount, { background: 0xf2f2f0, ground: false, fov: 40 });
    this._viewer = viewer;

    const dracoLoader = new DRACOLoader().setDecoderPath(DRACO);
    const gltfLoader  = new GLTFLoader().setDRACOLoader(dracoLoader);
    this._draco = dracoLoader;

    const root = new THREE.Group();
    viewer.scene.add(root);

    // The build bakes the source's Z-up axes into glTF's Y-up, centred
    // laterally with the feet on y = 0, so a standing adult occupies
    // roughly y 0 → 1.7. This is the fallback framing; the first system
    // to load re-frames to whatever is actually on screen.
    const HOME = { target: [0, 0.85, 0], position: [1.30, 1.50, 2.40] };
    viewer.controls.target.set(...HOME.target);
    viewer.camera.position.set(...HOME.position);
    viewer.controls.minDistance = 0.12;
    viewer.controls.maxDistance = 8;
    viewer.controls.update();

    const loaded  = new Map();      // system key -> THREE.Group
    const visible = Object.fromEntries(systemKeys.map(k => [k, false]));
    const hidden  = new Set();      // structure ids the user has hidden
    let opacity = 1;
    let isolate = false;
    this._loaded = loaded;

    /* ---------------- loading ---------------- */

    const progressEl   = container.querySelector('#an-progress');
    const progressText = container.querySelector('#an-progress-text');
    const showProgress = (msg) => { progressEl.hidden = false; progressText.textContent = msg; };
    const hideProgress = () => { progressEl.hidden = true; };

    async function loadSystem(key) {
      if (loaded.has(key)) return loaded.get(key);
      const meta = index.systems[key];
      showProgress(`Loading ${meta.label.toLowerCase()} — ${kb(meta.bytes)}…`);

      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.load(
          `${BASE}${meta.file}`,
          resolve,
          (evt) => {
            if (evt.total) showProgress(`Loading ${meta.label.toLowerCase()} — ${Math.round(evt.loaded / evt.total * 100)}%`);
          },
          reject,
        );
      });

      const group = gltf.scene;
      group.name = `system:${key}`;
      for (const child of group.children) {
        child.userData.structure = byId.get(child.name) || { id: child.name, name: child.name, system: key };
        child.traverse(n => {
          if (!n.isMesh) return;
          n.castShadow = n.receiveShadow = false;
          // A material per structure, so one can be faded or hidden
          // without dragging the rest of the system with it.
          n.material = n.material.clone();
        });
        viewer.registerPickable(child);
      }
      root.add(group);
      loaded.set(key, group);
      hideProgress();
      return group;
    }

    /* ---------------- appearance ---------------- */

    let prevOpacity = 1;
    function applyAppearance() {
      const selId = viewer.selected?.userData.structure?.id ?? null;
      const isTransparent = opacity < 1;
      const opacityChanged = prevOpacity !== opacity;
      prevOpacity = opacity;

      for (const [key, group] of loaded) {
        group.visible = visible[key];
        if (!visible[key]) continue;
        for (const child of group.children) {
          const id = child.userData.structure?.id;
          const shouldBeVisible = !hidden.has(id) && (!isolate || !selId || id === selId);
          if (child.visible !== shouldBeVisible) {
            child.visible = shouldBeVisible;
          }
          if (opacityChanged) {
            child.traverse(n => {
              if (!n.isMesh || !n.material) return;
              if (n.material.transparent !== isTransparent) {
                n.material.transparent = isTransparent;
                n.material.depthWrite = opacity > 0.85;
                n.material.needsUpdate = true;
              }
              n.material.opacity = opacity;
            });
          }
        }
      }
    }

    /* ---------------- system toggles ---------------- */

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

    systemsEl.addEventListener('change', async (e) => {
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
        if (on && loaded.size === 1) viewer.frame(root, 1.15);
      } catch (err) {
        e.target.checked = false;
        showProgress(`Could not load ${key}: ${err.message}`);
        setTimeout(hideProgress, 4000);
      } finally {
        e.target.disabled = false;
      }
    });

    /* ---------------- display controls ---------------- */

    const opacityEl = container.querySelector('#an-opacity');
    opacityEl.addEventListener('input', () => {
      opacity = Number(opacityEl.value) / 100;
      container.querySelector('#an-opacity-out').textContent = `${opacityEl.value}%`;
      applyAppearance();
    });

    container.querySelector('#an-isolate').addEventListener('change', (e) => {
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

    /* ---------------- cross-section ---------------- */

    const RANGE = { x: [-0.5, 0.5], y: [0, 1.9], z: [-0.4, 0.4] };
    let planeAxis = null;
    const planeRow  = container.querySelector('#an-plane-row');
    const flipRow   = container.querySelector('#an-flip-row');
    const planePos  = container.querySelector('#an-plane-pos');
    const flipInput = container.querySelector('#an-flip');

    const applyPlane = () => {
      if (!planeAxis) { viewer.setClipPlane(null); return; }
      const [lo, hi] = RANGE[planeAxis];
      viewer.setClipPlane(planeAxis, lo + (hi - lo) * (Number(planePos.value) / 100), flipInput.checked);
    };

    container.querySelector('#an-plane').addEventListener('click', (e) => {
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

    /* ---------------- structure list ---------------- */

    const listEl   = container.querySelector('#an-list');
    const filterEl = container.querySelector('#an-filter');
    container.querySelector('#an-count').textContent = `${index.structures.length}`;

    let filterTimeout;
    function renderList() {
      const q = filterEl.value.trim().toLowerCase();
      // Search the whole catalogue, not only what is loaded — finding a
      // structure should tell you which system to switch on.
      const rows = index.structures
        .filter(s => !q || s.name.toLowerCase().includes(q))
        .slice(0, 300);

      if (!rows.length) {
        listEl.innerHTML = `<p class="t3d-list-empty">Nothing matches that.</p>`;
        return;
      }

      const selId = viewer.selected?.userData.structure?.id;
      listEl.innerHTML = rows.map(s => `
        <button class="t3d-list-item${s.id === selId ? ' is-selected' : ''}${visible[s.system] ? '' : ' is-off'}"
                data-id="${s.id}" data-system="${s.system}" title="${s.name}">
          <span class="t3d-dot" style="background:${hex(index.systems[s.system].color)}"></span>
          <span class="an-item-name">${s.name}</span>
          ${hidden.has(s.id) ? '<span class="an-item-tag">hidden</span>' : ''}
        </button>`).join('');
    }

    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const { id, system } = btn.dataset;

      if (!visible[system]) {
        const cb = systemsEl.querySelector(`[data-system="${system}"]`);
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        // Wait for the system to finish loading before trying to select in it.
        for (let i = 0; i < 200 && !loaded.has(system); i++) await new Promise(r => setTimeout(r, 50));
      }
      hidden.delete(id);
      const obj = loaded.get(system)?.children.find(c => c.userData.structure?.id === id);
      if (obj) { applyAppearance(); viewer.select(obj); focusOn(obj); }
    });

    filterEl.addEventListener('input', () => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(renderList, 150);
    });

    /* ---------------- info panel ---------------- */

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

    viewer.onSelect((obj) => {
      const s = obj?.userData.structure;
      if (!s) {
        infoEl.innerHTML = `<div class="t3d-info-empty">
          <strong>Click any structure to identify it</strong>
          <span>Drag to rotate · scroll to zoom · right-drag to pan</span></div>`;
      } else {
        const note = noteFor(s.name);
        const sys  = index.systems[s.system];
        const fmaUrl = s.fma
          ? `https://bioportal.bioontology.org/ontologies/FMA?p=classes&conceptid=http%3A%2F%2Fpurl.org%2Fsig%2Font%2Ffma%2Ffma${s.fma}`
          : null;
        infoEl.innerHTML = `
          <div class="t3d-info-head">
            <span class="t3d-dot" style="background:${hex(sys.color)}"></span>
            <h3>${s.name}</h3>
            <span class="t3d-info-system">${sys.label}</span>
            ${fmaUrl ? `<a class="an-fma" href="${fmaUrl}" target="_blank" rel="noopener">FMA ${s.fma}</a>` : ''}
          </div>
          ${note
            ? `<p class="t3d-info-note">${note}</p>`
            : `<p class="t3d-info-note an-nonote">No teaching note for this structure yet. The name above is its
               Terminologia Anatomica term, and the FMA link opens its formal ontology entry.</p>`}`;
      }
      if (isolate) applyAppearance();
      renderList();
      listEl.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
    });

    /* ---------------- toolbar ---------------- */

    container.querySelector('#an-views').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#an-views .btn')) b.classList.toggle('is-active', b === btn);
      const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.001], iso: [0.6, 0.25, 1] };
      const dist = viewer.camera.position.distanceTo(viewer.controls.target);
      viewer.camera.position.copy(viewer.controls.target)
        .add(new THREE.Vector3(...dirs[btn.dataset.view]).normalize().multiplyScalar(dist));
      viewer.controls.update();
    });

    container.querySelector('#an-spin').addEventListener('change', (e) => { viewer.controls.autoRotate = e.target.checked; });

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
      // Re-fit to whatever is loaded rather than trusting the fallback.
      if (loaded.size) viewer.frame(root, 1.15);
    });

    /* ---------------- start ---------------- */

    renderList();
    // Skeleton first: the smallest useful system, and the one that gives
    // the others something to sit inside.
    const first = systemsEl.querySelector('[data-system="skeletal"]');
    if (first) { first.checked = true; first.dispatchEvent(new Event('change', { bubbles: true })); }
  },

  destroy() {
    this._alive = false;
    this._draco?.dispose();
    this._viewer?.dispose();
    this._viewer = null;
    this._loaded = null;
  },
};
