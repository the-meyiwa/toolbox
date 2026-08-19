/* ============================================================
   Viewer3D — shared Three.js scene wrapper for Toolbox's 3D tools.

   Handles the parts every 3D tool needs and none of the parts
   that differ between them: renderer setup, orbit controls,
   lighting, resize, raycast picking, HTML labels anchored to
   world positions, cross-section clipping, and teardown.

   Tools supply their own geometry and their own UI.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEFAULTS = {
  background: 0xf7f7f7,
  fov: 42,
  near: 0.1,
  far: 2000,
  ground: true,
  groundSize: 40,
  autoRotate: false,
};

export class Viewer3D {
  constructor(mount, options = {}) {
    this.opts   = { ...DEFAULTS, ...options };
    this.mount  = mount;
    this.disposed = false;

    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.opts.background);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(this.opts.fov, 1, this.opts.near, this.opts.far);
    this.camera.position.set(6, 5, 10);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    mount.appendChild(this.renderer.domElement);

    // --- Controls ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = this.opts.autoRotate;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 400;

    this._buildLights();
    if (this.opts.ground) this._buildGround();

    // --- Label layer (HTML over canvas) ---
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'v3d-labels';
    mount.appendChild(this.labelLayer);
    this.labels = [];

    // --- Picking ---
    this.raycaster   = new THREE.Raycaster();
    // Default Line/Points thresholds are 1 world unit, which is enormous
    // next to a 1.75 m body — shrink them so stray helper geometry cannot
    // swallow picks meant for solid meshes.
    this.raycaster.params.Line.threshold   = 0.001;
    this.raycaster.params.Points.threshold = 0.001;
    this.pointer     = new THREE.Vector2();
    this.pickables   = [];
    this.hovered     = null;
    this.selected    = null;
    this._pickHandlers = { hover: null, select: null };
    this._bindPointer();

    // --- Resize ---
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(mount);
    this.resize();

    this._tick = this._tick.bind(this);
    this.renderer.setAnimationLoop(this._tick);
  }

  /* ---------------- setup helpers ---------------- */

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a6, 2.1));

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(8, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    const d = 22;
    Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
    key.shadow.bias = -0.0006;
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-9, 5, -7);
    this.scene.add(fill);
  }

  _buildGround() {
    const size = this.opts.groundSize;

    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 2, size * 2),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.receiveShadow = true;
    shadowCatcher.name = '__ground';
    this.scene.add(shadowCatcher);

    const grid = new THREE.GridHelper(size * 2, size * 2, 0xbbbbbb, 0xdddddd);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.name = '__grid';
    this.scene.add(grid);
    this.grid = grid;
  }

  /* ---------------- picking ---------------- */

  _bindPointer() {
    const el = this.renderer.domElement;

    this._onMove = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this._pointerMoved = true;
    };

    // Distinguish a click from an orbit drag, so rotating the model
    // does not also fire a selection.
    this._onDown = (e) => { this._downAt = { x: e.clientX, y: e.clientY }; };
    this._onUp = (e) => {
      if (!this._downAt) return;
      const moved = Math.hypot(e.clientX - this._downAt.x, e.clientY - this._downAt.y);
      this._downAt = null;
      if (moved > 5) return;
      this._onMove(e);
      const hit = this._raycast();
      this.select(hit ? hit.object : null);
    };

    this._onLeave = () => {
      this.pointer.set(-10, -10);
      this._setHovered(null);
    };

    el.addEventListener('pointermove', this._onMove);
    el.addEventListener('pointerdown', this._onDown);
    el.addEventListener('pointerup', this._onUp);
    el.addEventListener('pointerleave', this._onLeave);
  }

  _raycast() {
    if (!this.pickables.length) return null;
    // World matrices are normally refreshed by render(). A pick can arrive
    // before the first frame (or while rAF is throttled in a hidden tab),
    // so refresh them here rather than raycasting against stale transforms.
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visible = this.pickables.filter(o => o.visible && o.parent && o.userData.pickable !== false);
    const hits = this.raycaster.intersectObjects(visible, true);
    for (const hit of hits) {
      const target = this._pickRoot(hit.object);
      if (target) return { object: target, point: hit.point };
    }
    return null;
  }

  // Walk up to the nearest ancestor that was registered as pickable,
  // so a multi-mesh part selects as one unit.
  _pickRoot(obj) {
    let node = obj;
    while (node) {
      if (this.pickables.includes(node)) return node;
      node = node.parent;
    }
    return null;
  }

  registerPickable(obj) {
    if (!this.pickables.includes(obj)) this.pickables.push(obj);
  }

  onHover(fn)  { this._pickHandlers.hover = fn; }
  onSelect(fn) { this._pickHandlers.select = fn; }

  _setHovered(obj) {
    if (this.hovered === obj) return;
    if (this.hovered) this._applyEmphasis(this.hovered, false);
    this.hovered = obj;
    if (obj) this._applyEmphasis(obj, true);
    this.renderer.domElement.style.cursor = obj ? 'pointer' : '';
    this._pickHandlers.hover?.(obj);
  }

  select(obj) {
    if (this.selected) this._applyOutline(this.selected, false);
    this.selected = obj;
    if (obj) this._applyOutline(obj, true);
    this._pickHandlers.select?.(obj);
  }

  _applyEmphasis(root, on) {
    root.traverse(node => {
      if (!node.isMesh || !node.material?.emissive) return;
      if (on) {
        node.userData._emissiveWas ??= node.material.emissive.getHex();
        node.material.emissive.setHex(0x333333);
      } else if (node.userData._emissiveWas !== undefined) {
        node.material.emissive.setHex(node.userData._emissiveWas);
      }
    });
  }

  _applyOutline(root, on) {
    root.traverse(node => {
      if (!node.isMesh) return;
      if (on) {
        if (node.userData._outline) return;
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(node.geometry, 25),
          new THREE.LineBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.85 })
        );
        edges.renderOrder = 999;
        edges.name = '__outline';
        edges.raycast = () => {};   // decoration only — must never intercept a pick
        node.add(edges);
        node.userData._outline = edges;
      } else if (node.userData._outline) {
        node.remove(node.userData._outline);
        node.userData._outline.geometry.dispose();
        node.userData._outline.material.dispose();
        delete node.userData._outline;
      }
    });
  }

  /* ---------------- labels ---------------- */

  addLabel(text, anchorObject, offset = new THREE.Vector3()) {
    const el = document.createElement('div');
    el.className = 'v3d-label';
    el.textContent = text;
    this.labelLayer.appendChild(el);
    const label = { el, anchorObject, offset, visible: true };
    this.labels.push(label);
    return label;
  }

  clearLabels() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
  }

  setLabelsVisible(on) {
    this.labelLayer.style.display = on ? '' : 'none';
  }

  _updateLabels() {
    if (!this.labels.length || this.labelLayer.style.display === 'none') return;
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    const v = new THREE.Vector3();

    for (const label of this.labels) {
      const obj = label.anchorObject;
      if (!obj || !obj.visible || !this._ancestorsVisible(obj)) {
        label.el.style.display = 'none';
        continue;
      }
      obj.getWorldPosition(v).add(label.offset);
      v.project(this.camera);
      if (v.z > 1) { label.el.style.display = 'none'; continue; }
      label.el.style.display = '';
      label.el.style.transform =
        `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  _ancestorsVisible(obj) {
    let n = obj.parent;
    while (n) { if (!n.visible) return false; n = n.parent; }
    return true;
  }

  /* ---------------- camera ---------------- */

  // Fit the camera to a bounding box, keeping the current view direction.
  frame(target = this.scene, padding = 1.35) {
    const box = new THREE.Box3();
    target.traverse(o => { if (o.isMesh && o.visible && !o.name.startsWith('__')) box.expandByObject(o); });
    if (box.isEmpty()) return;

    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist   = (maxDim / 2) / Math.tan((this.camera.fov * Math.PI / 180) / 2) * padding;

    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(0.05, dist / 200);
    this.camera.far  = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  setView(name, target = this.scene) {
    const dirs = {
      front:  [0, 0, 1], back: [0, 0, -1],
      left:   [-1, 0, 0], right: [1, 0, 0],
      top:    [0, 1, 0.001], bottom: [0, -1, 0.001],
      iso:    [0.8, 0.6, 1],
    };
    const d = dirs[name] || dirs.iso;
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.camera.position.copy(this.controls.target)
      .add(new THREE.Vector3(...d).normalize().multiplyScalar(dist));
    this.controls.update();
    this.frame(target);
  }

  /* ---------------- cross-section ---------------- */

  // axis: 'x' | 'y' | 'z' | null. `amount` is a world-space coordinate.
  setClipPlane(axis, amount, flip = false) {
    if (!axis) { this.clipPlanes = []; this._applyClip([]); return; }
    const normals = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const n = new THREE.Vector3(...normals[axis]).multiplyScalar(flip ? -1 : 1);
    const plane = new THREE.Plane(n, flip ? amount : -amount);
    this.clipPlanes = [plane];
    this._applyClip(this.clipPlanes);
  }

  _applyClip(planes) {
    this.scene.traverse(o => {
      if (!o.isMesh || o.name.startsWith('__')) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { if (m) { m.clippingPlanes = planes; m.needsUpdate = true; } }
    });
  }

  /* ---------------- loop & teardown ---------------- */

  resize() {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick() {
    if (this.disposed) return;
    this.controls.update();
    if (this._pointerMoved) {
      const hit = this._raycast();
      this._setHovered(hit ? hit.object : null);
      this._pointerMoved = false;
    }
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();

    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this._onMove);
    el.removeEventListener('pointerdown', this._onDown);
    el.removeEventListener('pointerup', this._onUp);
    el.removeEventListener('pointerleave', this._onLeave);

    this.controls.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    });
    this.clearLabels();
    this.labelLayer.remove();
    this.renderer.dispose();
    el.remove();
  }
}

export { THREE };
