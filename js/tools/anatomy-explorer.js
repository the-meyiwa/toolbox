/* ============================================================
   Anatomy Explorer — interactive 3D human body.

   Three.js and the model are loaded on demand, so opening any
   other tool never pays for them.
   ============================================================ */

export default {
  async render(container) {
    this._alive = true;

    container.innerHTML = `
      <div class="t3d-loading" id="an-loading">
        <div class="t3d-spinner"></div>
        <p>Building the model…</p>
      </div>`;

    let THREE, Viewer3D, AnatomyModel, SYSTEMS;
    try {
      const [viewerMod, modelMod] = await Promise.all([
        import('../lib/viewer3d.js'),
        import('../lib/anatomy-model.js'),
      ]);
      ({ Viewer3D, THREE } = viewerMod);
      ({ AnatomyModel, SYSTEMS } = modelMod);
    } catch (err) {
      container.innerHTML = `<div class="no-results">
        <p class="no-results-title">Could not start the 3D viewer</p>
        <p class="no-results-text">${err.message}</p></div>`;
      return;
    }

    if (!this._alive) return;   // tool was closed while loading

    /* ---------------- layout ---------------- */

    const systemKeys = Object.keys(SYSTEMS).sort((a, b) => SYSTEMS[a].order - SYSTEMS[b].order);

    container.innerHTML = `
      <div class="t3d">
        <aside class="t3d-panel">
          <section class="t3d-block">
            <h3 class="t3d-h">Systems</h3>
            <div id="an-systems" class="t3d-toggles"></div>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Body surface</h3>
            <label class="t3d-slider-row">
              <span>Opacity</span>
              <input type="range" id="an-skin" min="0" max="60" value="20" class="tool-range">
              <output id="an-skin-out">20%</output>
            </label>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Cross-section</h3>
            <div class="btn-group t3d-seg" id="an-plane">
              <button class="btn btn-sm is-active" data-plane="none">Off</button>
              <button class="btn btn-sm" data-plane="z">Coronal</button>
              <button class="btn btn-sm" data-plane="x">Sagittal</button>
              <button class="btn btn-sm" data-plane="y">Axial</button>
            </div>
            <label class="t3d-slider-row" id="an-plane-row" hidden>
              <span>Depth</span>
              <input type="range" id="an-plane-pos" min="0" max="100" value="50" class="tool-range">
              <output id="an-plane-out">50%</output>
            </label>
            <label class="tool-checkbox" id="an-flip-row" hidden>
              <input type="checkbox" id="an-flip"> <span>Flip side</span>
            </label>
          </section>

          <section class="t3d-block">
            <h3 class="t3d-h">Structures</h3>
            <input type="text" id="an-filter" class="tool-input t3d-filter" placeholder="Filter structures…" autocomplete="off" spellcheck="false">
            <div id="an-list" class="t3d-list"></div>
          </section>
        </aside>

        <div class="t3d-stage">
          <div class="t3d-canvas" id="an-canvas"></div>

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
              <label class="tool-checkbox"><input type="checkbox" id="an-labels"> <span>Labels</span></label>
              <label class="tool-checkbox"><input type="checkbox" id="an-spin"> <span>Spin</span></label>
              <button class="btn btn-sm" id="an-reset">Reset</button>
            </div>
          </div>

          <div class="t3d-info" id="an-info">
            <div class="t3d-info-empty">
              <strong>Click any structure</strong>
              <span>Drag to rotate · scroll to zoom · right-drag to pan</span>
            </div>
          </div>
        </div>
      </div>`;

    /* ---------------- build scene ---------------- */

    const mount  = container.querySelector('#an-canvas');
    const viewer = new Viewer3D(mount, { background: 0xf2f2f0, ground: false, fov: 38 });
    const model  = new AnatomyModel();

    this._viewer = viewer;
    this._model  = model;

    viewer.scene.add(model.root);
    for (const part of model.parts) {
      if (part.object.userData.pickable !== false) viewer.registerPickable(part.object);
    }

    // Frame the whole body head-to-foot. Targeting mid-thigh rather than the
    // chest keeps the feet inside the viewport at this field of view.
    viewer.controls.target.set(0, 0.88, 0);
    viewer.camera.position.set(1.25, 1.50, 2.45);
    viewer.controls.update();
    viewer.controls.minDistance = 0.35;
    viewer.controls.maxDistance = 8;

    // Sensible opening state: surface on and faint, skeleton visible,
    // everything else off so the model does not open as a jumble.
    const visible = {
      surface: true, skeletal: true, muscular: false, nervous: false,
      circulatory: false, respiratory: false, digestive: false, urinary: false,
    };
    for (const k of systemKeys) model.setSystemVisible(k, visible[k]);
    model.setSystemOpacity('surface', 0.20);

    /* ---------------- labels ---------------- */

    for (const part of model.parts) {
      if (!part.labelAt) continue;
      const anchor = new THREE.Object3D();
      anchor.position.set(...part.labelAt);
      model.root.add(anchor);
      const label = viewer.addLabel(part.name, anchor);
      label.el.dataset.system = part.system;
      part.label = label;
    }
    viewer.setLabelsVisible(false);

    const syncLabels = () => {
      for (const part of model.parts) {
        if (!part.label) continue;
        part.label.el.style.visibility = visible[part.system] ? '' : 'hidden';
      }
    };
    syncLabels();

    /* ---------------- system toggles ---------------- */

    const systemsEl = container.querySelector('#an-systems');
    systemsEl.innerHTML = systemKeys.map(k => `
      <label class="t3d-toggle">
        <input type="checkbox" data-system="${k}" ${visible[k] ? 'checked' : ''}>
        <span class="t3d-dot" style="background:#${SYSTEMS[k].color.toString(16).padStart(6, '0')}"></span>
        <span class="t3d-toggle-name">${SYSTEMS[k].label}</span>
        <span class="t3d-count">${model.partsBySystem(k).length}</span>
      </label>`).join('');

    systemsEl.addEventListener('change', (e) => {
      const key = e.target.dataset.system;
      if (!key) return;
      visible[key] = e.target.checked;
      model.setSystemVisible(key, visible[key]);
      if (!visible[key] && viewer.selected?.userData.part?.system === key) viewer.select(null);
      syncLabels();
      renderList();
    });

    /* ---------------- surface opacity ---------------- */

    const skin = container.querySelector('#an-skin');
    const skinOut = container.querySelector('#an-skin-out');
    skin.addEventListener('input', () => {
      const v = Number(skin.value);
      skinOut.textContent = `${v}%`;
      model.setSystemOpacity('surface', v / 100);
      const on = v > 0;
      if (on !== visible.surface) {
        visible.surface = on;
        model.setSystemVisible('surface', on);
        systemsEl.querySelector('[data-system="surface"]').checked = on;
      }
    });

    /* ---------------- cross-section ---------------- */

    // Body extents used to map the 0–100 slider onto world coordinates.
    const RANGE = { x: [-0.45, 0.45], y: [0, 1.80], z: [-0.35, 0.35] };
    let planeAxis = null;

    const planeRow  = container.querySelector('#an-plane-row');
    const flipRow   = container.querySelector('#an-flip-row');
    const planePos  = container.querySelector('#an-plane-pos');
    const planeOut  = container.querySelector('#an-plane-out');
    const flipInput = container.querySelector('#an-flip');

    const applyPlane = () => {
      if (!planeAxis) { viewer.setClipPlane(null); return; }
      const [lo, hi] = RANGE[planeAxis];
      const amount = lo + (hi - lo) * (Number(planePos.value) / 100);
      viewer.setClipPlane(planeAxis, amount, flipInput.checked);
    };

    container.querySelector('#an-plane').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plane]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#an-plane .btn')) b.classList.toggle('is-active', b === btn);
      planeAxis = btn.dataset.plane === 'none' ? null : btn.dataset.plane;
      planeRow.hidden = flipRow.hidden = !planeAxis;
      applyPlane();
    });

    planePos.addEventListener('input', () => { planeOut.textContent = `${planePos.value}%`; applyPlane(); });
    flipInput.addEventListener('change', applyPlane);

    /* ---------------- structure list ---------------- */

    const listEl   = container.querySelector('#an-list');
    const filterEl = container.querySelector('#an-filter');

    function renderList() {
      const q = filterEl.value.trim().toLowerCase();
      const rows = model.parts
        .filter(p => p.object.userData.pickable !== false)
        .filter(p => visible[p.system])
        .filter(p => !q || p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q));

      if (!rows.length) {
        listEl.innerHTML = `<p class="t3d-list-empty">${q ? 'Nothing matches that.' : 'No systems shown — turn one on above.'}</p>`;
        return;
      }

      listEl.innerHTML = rows.map(p => `
        <button class="t3d-list-item${viewer.selected === p.object ? ' is-selected' : ''}" data-id="${p.id}">
          <span class="t3d-dot" style="background:#${SYSTEMS[p.system].color.toString(16).padStart(6, '0')}"></span>
          ${p.name}
        </button>`).join('');
    }

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const part = model.getPart(btn.dataset.id);
      if (part) viewer.select(part.object);
    });

    filterEl.addEventListener('input', renderList);
    renderList();

    /* ---------------- info panel ---------------- */

    const infoEl = container.querySelector('#an-info');

    viewer.onSelect((obj) => {
      const part = obj?.userData.part;
      if (!part) {
        infoEl.innerHTML = `<div class="t3d-info-empty">
          <strong>Click any structure</strong>
          <span>Drag to rotate · scroll to zoom · right-drag to pan</span></div>`;
      } else {
        infoEl.innerHTML = `
          <div class="t3d-info-head">
            <span class="t3d-dot" style="background:#${SYSTEMS[part.system].color.toString(16).padStart(6, '0')}"></span>
            <h3>${part.name}</h3>
            <span class="t3d-info-system">${SYSTEMS[part.system].label}</span>
          </div>
          <p class="t3d-info-note">${part.note}</p>`;
      }
      for (const b of listEl.querySelectorAll('.t3d-list-item')) {
        b.classList.toggle('is-selected', b.dataset.id === part?.id);
      }
      listEl.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
    });

    /* ---------------- toolbar ---------------- */

    container.querySelector('#an-views').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#an-views .btn')) b.classList.toggle('is-active', b === btn);
      const dirs = {
        front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0],
        right: [-1, 0, 0], top: [0, 1, 0.001], iso: [0.55, 0.28, 1],
      };
      const dist = viewer.camera.position.distanceTo(viewer.controls.target);
      viewer.camera.position.copy(viewer.controls.target)
        .add(new THREE.Vector3(...dirs[btn.dataset.view]).normalize().multiplyScalar(dist));
      viewer.controls.update();
    });

    container.querySelector('#an-labels').addEventListener('change', (e) => {
      viewer.setLabelsVisible(e.target.checked);
    });

    container.querySelector('#an-spin').addEventListener('change', (e) => {
      viewer.controls.autoRotate = e.target.checked;
    });

    container.querySelector('#an-reset').addEventListener('click', () => {
      viewer.controls.target.set(0, 0.88, 0);
      viewer.camera.position.set(1.25, 1.50, 2.45);
      viewer.controls.update();
      viewer.select(null);
    });
  },

  destroy() {
    this._alive = false;
    this._viewer?.dispose();
    this._viewer = null;
    this._model = null;
  },
};
