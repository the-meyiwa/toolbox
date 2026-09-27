/* ============================================================
   TOOLBOX — 3D object card (Assistant create_3d_object results)

   Live preview in the studio viewer (orbit, turn, frame, turntable),
   quick colour swatches for a single library model, exports (GLB,
   OBJ, STL, USDZ, PNG) and "Open in 3D Lab", which hands the scene
   to the Lab (a new tab, or the Lab already open under the pop-up).
   ============================================================ */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (p, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  cube: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
  rotL: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  rotR: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  frame: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  spin: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
};
const HANDOFF = 'toolbox_3dlab_handoff';
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const mm = (m) => (m >= 1 ? `${Math.round(m * 100) / 100} m` : `${Math.round(m * 1000)} mm`);

export function openInLab(spec) {
  const detail = { spec, replace: false };
  if (/^#3d-lab\b/.test(window.location.hash)) { window.dispatchEvent(new CustomEvent('toolbox:lab3d-open', { detail })); return; }
  try { localStorage.setItem(HANDOFF, JSON.stringify(detail)); } catch { /* storage full */ }
  const w = window.open(`${window.location.pathname}${window.location.search}#3d-lab`, '_blank');
  if (w) { try { w.opener = null; } catch { /* ignore */ } } else window.location.hash = '#3d-lab';
}

export function renderLab3dObject(data, container) {
  let spec = data.spec;
  const objs = Array.isArray(data.objects) ? data.objects : [];
  const el = document.createElement('section');
  el.className = 'astc astc-sm astc-lab';
  const sub = objs.map(o => `${o.name}${o.size_m ? ` · ${mm(o.size_m.width)} × ${mm(o.size_m.height)} × ${mm(o.size_m.depth)}` : ''}`).join('  ·  ');
  el.innerHTML = `
    <header class="astc-head">
      <span class="astc-icon">${svg(I.cube, 16)}</span>
      <div class="astc-titles"><h4 class="astc-title">${esc(data.title || spec?.title || '3D object')}</h4><p class="astc-sub">${esc(sub || 'Building…')}</p></div>
    </header>
    <div class="astc-sm-stage">
      <div class="astc-sm-canvas"><div class="astc-cd-loading">Building the 3D object…</div></div>
      <div class="astc-cd-ctrl">
        <div class="astc-cd-grp">
          <button type="button" class="astc-cd-ib" data-act="rotl" aria-label="Turn left" title="Turn left">${svg(I.rotL)}</button>
          <button type="button" class="astc-cd-ib" data-act="rotr" aria-label="Turn right" title="Turn right">${svg(I.rotR)}</button>
          <button type="button" class="astc-cd-ib" data-act="fit" aria-label="Fit to view" title="Fit to view">${svg(I.frame)}</button>
          <button type="button" class="astc-cd-ib" data-act="spin" aria-label="Turntable" title="Turntable" aria-pressed="false">${svg(I.spin)}</button>
        </div>
        <div class="astc-cd-grp astc-lab-swatches" data-role="swatches"></div>
      </div>
    </div>
    <footer class="astc-cd-foot">
      <div class="astc-cd-acts">
        <button type="button" class="astc-btn astc-btn-primary" data-act="lab">${svg(I.open, 14)}<span>Open in 3D Lab</span></button>
        ${['glb', 'obj', 'stl', 'usdz', 'png'].map(f => `<button type="button" class="astc-btn" data-export="${f}">${svg(I.download, 14)}<span>${f.toUpperCase()}</span></button>`).join('')}
      </div>
      <p class="astc-cd-hint">Drag to orbit, scroll or pinch to zoom. Ask for changes — “make it deep blue”, “add a desk” — or edit it in the 3D Lab.</p>
    </footer>`;
  container.appendChild(el);

  const stage = el.querySelector('.astc-sm-canvas');
  let viewer = null, root = null;

  const build = async () => {
    const [{ Viewer3D, THREE }, scene] = await Promise.all([import('../viewer3d.js'), import('../lab3d/scene.js')]);
    const built = await scene.buildScene(spec);
    stage.innerHTML = '';
    viewer?.dispose();
    viewer = new Viewer3D(stage, { realism: true, environment: spec.environment || 'studio', dark: isDark(), ground: true, fov: 32, renderOnDemand: true });
    viewer.controls.minDistance = 0.03;
    viewer.setEmphasisHandler(() => {});
    root = built.root;
    viewer.scene.add(root);
    const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    viewer.controls.target.copy(c);
    viewer.camera.position.set(c.x + s.length() * 0.6, c.y + s.length() * 0.35, c.z + s.length() * 0.9);
    viewer.frame(root, 1.18);
    renderSwatches();
  };

  // One library model with a colour option: quick recolour in place.
  function renderSwatches() {
    const box = el.querySelector('[data-role="swatches"]');
    const only = spec.items.length === 1 && spec.items[0].type === 'model' ? spec.items[0] : null;
    if (!only) { box.hidden = true; return; }
    import('../lab3d/catalog.js').then(({ MODEL_BY_ID }) => {
      const def = MODEL_BY_ID.get(only.model);
      const [key, p] = Object.entries(def?.params || {}).find(([, d]) => d.type === 'color' && d.swatches) || [];
      if (!p) { box.hidden = true; return; }
      const cur = only.params?.[key] || p.default;
      box.innerHTML = p.swatches.map(([hex, name]) => `<button type="button" class="astc-lab-sw" style="--c:${hex}" data-color="${hex}" data-key="${key}" title="${esc(name)}" aria-label="${esc(name)}" aria-pressed="${hex.toLowerCase() === String(cur).toLowerCase()}"></button>`).join('');
    });
  }

  const fail = (err) => { stage.innerHTML = `<div class="astc-cd-loading">Could not show it here: ${esc(err?.message || 'WebGL is unavailable')}.</div>`; };
  const watch = setInterval(() => { if (!el.isConnected) { viewer?.dispose(); viewer = null; clearInterval(watch); } }, 4000);
  const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); return; } if (viewer) build().catch(fail); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  build().catch(fail);

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.color) {
      const it = { ...spec.items[0], params: { ...(spec.items[0].params || {}), [b.dataset.key]: b.dataset.color } };
      spec = { ...spec, items: [it] };
      await build().catch(fail);
      return;
    }
    if (b.dataset.act === 'lab') { openInLab(spec); return; }
    if (!viewer) return;
    if (b.dataset.export) {
      const { exportObject, downloadBlob, slug } = await import('../lab3d/export.js');
      const name = data.title || spec.title || 'model';
      if (b.dataset.export === 'png') {
        if (viewer.composer) viewer.composer.render(); else viewer.renderer.render(viewer.scene, viewer.camera);
        viewer.renderer.domElement.toBlob(blob => blob && downloadBlob(blob, `${slug(name)}.png`), 'image/png');
        return;
      }
      const label = b.querySelector('span');
      const was = label.textContent;
      label.textContent = '…';
      b.disabled = true;
      try { const { blob, filename } = await exportObject(root, b.dataset.export, { name }); downloadBlob(blob, filename); }
      catch (err) { label.textContent = 'Failed'; setTimeout(() => { label.textContent = was; }, 1800); console.warn(err); return; }
      finally { b.disabled = false; }
      label.textContent = was;
      return;
    }
    switch (b.dataset.act) {
      case 'rotl': case 'rotr': {
        const t = viewer.controls.target;
        const off = viewer.camera.position.clone().sub(t);
        off.applyAxisAngle(new off.constructor(0, 1, 0), (b.dataset.act === 'rotl' ? -1 : 1) * Math.PI / 2);
        viewer.camera.position.copy(t).add(off);
        viewer.controls.update();
        viewer.invalidate(300);
        break;
      }
      case 'fit': viewer.frame(root, 1.18); break;
      case 'spin': { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); viewer.controls.autoRotate = on; viewer.invalidate(); break; }
      default:
    }
  });
  return el;
}
