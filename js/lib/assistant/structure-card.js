/* ============================================================
   TOOLBOX — 3D structure card (Assistant model_3d results)

   Shows a model from structure-model.js in the realistic viewer:
   orbit / zoom / pan, quarter-turn buttons, a horizontal section
   cut, labels, the model's size, member count, steel tonnage and a
   takeoff table, and downloads (PNG, GLB for Blender/SketchUp and
   the JSON description to edit or reuse).
   ============================================================ */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (p, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  cube: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
  rotL: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  rotR: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  frame: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  cut: '<path d="M3 12h18"/><path d="M6 8V5h12v3M6 16v3h12v-3"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  warn: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
};
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const slug = (s) => String(s || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'model';
const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString();

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function renderStructureModel(data, container) {
  const spec = data.spec || data.model || data;
  const el = document.createElement('section');
  el.className = 'astc astc-sm';
  el.innerHTML = `
    <header class="astc-head">
      <span class="astc-icon">${svg(I.cube, 16)}</span>
      <div class="astc-titles"><h4 class="astc-title">${esc(spec.title || data.title || '3D model')}</h4><p class="astc-sub" data-sub>Building the model…</p></div>
    </header>
    <div class="astc-sm-stage">
      <div class="astc-sm-canvas"><div class="astc-cd-loading">Building the 3D model…</div></div>
      <div class="astc-cd-ctrl">
        <div class="astc-cd-grp">
          <button type="button" class="astc-cd-ib" data-act="rotl" aria-label="Turn left" title="Turn left">${svg(I.rotL)}</button>
          <button type="button" class="astc-cd-ib" data-act="rotr" aria-label="Turn right" title="Turn right">${svg(I.rotR)}</button>
          <button type="button" class="astc-cd-ib" data-act="fit" aria-label="Fit to view" title="Fit to view">${svg(I.frame)}</button>
        </div>
        <div class="astc-cd-grp">
          <button type="button" class="astc-cd-chip" data-act="labels" aria-pressed="true" hidden>${svg(I.tag, 14)}<span>Labels</span></button>
          <label class="astc-sm-cut" title="Cut the model horizontally to look inside">${svg(I.cut, 14)}<input type="range" min="0" max="1000" value="1000" data-act="cut" aria-label="Section cut height"></label>
        </div>
      </div>
    </div>
    ${spec.description ? `<p class="astc-sm-desc">${esc(spec.description)}</p>` : ''}
    <dl class="astc-cd-stats" data-stats></dl>
    <div data-extra></div>
    <footer class="astc-cd-foot">
      <div class="astc-cd-acts">
        <button type="button" class="astc-btn" data-act="png">${svg(I.download, 14)}<span>PNG</span></button>
        <button type="button" class="astc-btn" data-act="glb">${svg(I.download, 14)}<span>GLB</span></button>
        <button type="button" class="astc-btn" data-act="json">${svg(I.download, 14)}<span>JSON</span></button>
      </div>
      <p class="astc-cd-hint">Drag to orbit, scroll or pinch to zoom. To change it, just ask — “make it 40 m tall”, “add a glass roof”.</p>
    </footer>`;
  container.appendChild(el);

  const stage = el.querySelector('.astc-sm-canvas');
  let viewer = null, group = null, labelsOn = true, bounds = null;

  const build = async () => {
    const [{ Viewer3D, THREE }, { expandStructure }, { buildStructure }] = await Promise.all([
      import('../viewer3d.js'), import('../structure-model.js'), import('../structure-mesh.js'),
    ]);
    const model = expandStructure(spec);
    const dark = isDark();
    stage.innerHTML = '';
    viewer = new Viewer3D(stage, { realism: true, environment: model.environment, dark, ground: true, fov: 38 });
    viewer.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    const built = buildStructure(model);
    group = built.group;
    // Anything modelled below ground level is lifted so it sits on the ground.
    if (model.bounds.min[1] < -0.01) group.position.y = -model.bounds.min[1];
    viewer.scene.add(group);
    for (const l of built.labels) {
      const a = new THREE.Object3D();
      a.position.copy(l.position);
      group.add(a);
      viewer.addLabel(l.text, a);
    }
    el.querySelector('[data-act="labels"]').hidden = !built.labels.length;
    const s = model.bounds.size;
    const c = [(model.bounds.min[0] + model.bounds.max[0]) / 2, (model.bounds.min[2] + model.bounds.max[2]) / 2];
    // A three-quarter view about 22° above the horizon, whatever the model's proportions; frame() sets the distance.
    viewer.controls.target.set(c[0], s[1] / 2 + group.position.y, c[1]);
    viewer.camera.position.set(c[0] + 1, s[1] / 2 + group.position.y + 0.55, c[1] + 1.2);
    viewer.frame(group, 1.12);
    bounds = model.bounds;

    const st = model.stats;
    el.querySelector('[data-sub]').textContent = `${fmt(s[0])} × ${fmt(s[2])} × ${fmt(s[1])} m${st.members ? ` · ${st.members.toLocaleString()} members` : ''}${st.steelT ? ` · ${fmt(st.steelT)} t steel` : ''}`;
    el.querySelector('[data-stats]').innerHTML = [
      ['Width × depth', `${fmt(s[0])} × ${fmt(s[2])} m`],
      ['Height', `${fmt(s[1])} m`],
      st.members ? ['Members', `${st.members.toLocaleString()} · ${fmt(st.memberLengthM, 0)} m`] : null,
      st.steelT ? ['Steel', `${fmt(st.steelT)} t`] : null,
      st.solids ? ['Solid parts', st.solids.toLocaleString()] : null,
    ].filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="u-num">${esc(v)}</dd></div>`).join('');
    const rows = st.takeoff.slice(0, 14).map(r => `<tr><th scope="row">${esc(r.section)}<small>${esc(r.material)}</small></th><td class="u-num">${r.count}</td><td class="u-num">${fmt(r.lengthM, 1)} m</td><td class="u-num">${fmt(r.massKg / 1000, 2)} t</td></tr>`).join('');
    el.querySelector('[data-extra]').innerHTML = `
      ${rows ? `<details class="astc-cd-notes"><summary>Member takeoff</summary><div class="astc-table-wrap"><table class="astc-table"><thead><tr><th>Section</th><th>No.</th><th>Length</th><th>Mass</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : ''}
      ${model.warnings.length ? `<details class="astc-cd-notes"><summary>${model.warnings.length} note${model.warnings.length > 1 ? 's' : ''}</summary><ul>${model.warnings.map(w => `<li data-level="info">${svg(I.warn, 14)}<span>${esc(w)}</span></li>`).join('')}</ul></details>` : ''}`;
  };

  const watch = setInterval(() => { if (!el.isConnected) { viewer?.dispose(); viewer = null; clearInterval(watch); } }, 4000);
  const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); return; } if (viewer) { viewer.dispose(); viewer = null; stage.innerHTML = ''; build().catch(fail); } });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const fail = (err) => { stage.innerHTML = `<div class="astc-cd-loading">Could not show the 3D model here: ${esc(err?.message || 'WebGL is unavailable')}.</div>`; };
  build().catch(fail);

  el.addEventListener('input', (e) => {
    if (e.target.dataset.act !== 'cut' || !viewer || !bounds) return;
    const t = Number(e.target.value) / 1000;
    if (t >= 0.999) viewer.setClipPlane(null);
    else viewer.setClipPlane('y', (group?.position.y || 0) + bounds.min[1] + (bounds.size[1] + 0.01) * t, true);
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || !viewer) return;
    switch (b.dataset.act) {
      case 'rotl': case 'rotr': {
        const t = viewer.controls.target;
        const off = viewer.camera.position.clone().sub(t);
        off.applyAxisAngle(new off.constructor(0, 1, 0), (b.dataset.act === 'rotl' ? -1 : 1) * Math.PI / 2);   // off is a THREE.Vector3
        viewer.camera.position.copy(t).add(off);
        viewer.controls.update();
        break;
      }
      case 'fit': viewer.frame(group, 1.12); break;
      case 'labels': labelsOn = !labelsOn; viewer.setLabelsVisible(labelsOn); b.setAttribute('aria-pressed', String(labelsOn)); break;
      case 'png': {
        if (viewer.composer) viewer.composer.render(); else viewer.renderer.render(viewer.scene, viewer.camera);
        viewer.renderer.domElement.toBlob(blob => blob && download(blob, `${slug(spec.title)}.png`), 'image/png');
        break;
      }
      case 'glb': {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        new GLTFExporter().parse(group, (out) => download(new Blob([out], { type: 'model/gltf-binary' }), `${slug(spec.title)}.glb`), () => {}, { binary: true });
        break;
      }
      case 'json': download(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), `${slug(spec.title)}.json`); break;
      default:
    }
  });
  return el;
}
