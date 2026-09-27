/* ============================================================
   Viewer3D — shared Three.js scene wrapper for Toolbox's 3D tools.

   Handles the parts every 3D tool needs and none of the parts
   that differ between them: renderer setup, orbit controls,
   lighting, resize, raycast picking, HTML labels anchored to
   world positions, cross-section clipping, and teardown.

   Tools supply their own geometry and their own UI.

   `realism: true` turns on the architectural look used by the
   container and structure viewers: filmic tone mapping, an
   environment map for reflections, a sun with shadows fitted to the
   model, a sky dome with distance fog, a contact shadow under the
   model and (on capable devices) screen-space ambient occlusion.
   `environment: 'outdoor' | 'studio'` picks the backdrop.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DEFAULTS = {
  background: 0xf7f7f7,
  fov: 42,
  near: 0.1,
  far: 2000,
  ground: true,
  groundSize: 40,
  autoRotate: false,
  realism: false,
  environment: 'outdoor',   // realism backdrop: 'outdoor' (sky, soil) or 'studio' (neutral sweep)
  dark: false,              // realism: darker studio/dusk palette for dark themes
  grid: undefined,          // realism: draw the faint measuring grid (default off)
  ambientOcclusion: true,   // realism: GTAO when the device can afford it
};

// Backdrop palettes for realism mode: sky zenith, horizon, ground.
const BACKDROPS = {
  outdoor: { top: 0x9fbcd6, horizon: 0xe9e6df, ground: 0xc9c2b4, sun: 0xfff1dc, sky: 0xd8e6f2, bounce: 0x8a7f6c },
  studio: { top: 0xdedcd8, horizon: 0xefeeeb, ground: 0xe4e2de, sun: 0xffffff, sky: 0xf2f2f2, bounce: 0xa9a6a0 },
  'outdoor-dark': { top: 0x1b2433, horizon: 0x3a3f47, ground: 0x2c2e31, sun: 0xffe2c0, sky: 0x8aa0bd, bounce: 0x3b3833 },
  'studio-dark': { top: 0x15171a, horizon: 0x24272b, ground: 0x1d1f22, sun: 0xffffff, sky: 0x9aa3ad, bounce: 0x2a2a2a },
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
    const modestDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, modestDevice ? 1.25 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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

    this.modestDevice = modestDevice;
    if (this.opts.realism) {
      this._buildRealism();
    } else {
      this._buildLights();
      if (this.opts.ground) this._buildGround();
    }

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
    this._pickRootMap = new WeakMap();
    this._rootMeshCache = new WeakMap();
    this.hovered     = null;
    this.selected    = null;
    this._pickHandlers = { hover: null, select: null };
    this._bindPointer();

    // --- Resize ---
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(mount);
    this.resize();

    this._tick = this._tick.bind(this);
    this._visible = true;
    this._syncAnimation = () => {
      this.renderer.setAnimationLoop(!this.disposed && this._visible && !document.hidden ? this._tick : null);
    };
    document.addEventListener('visibilitychange', this._syncAnimation);
    if (typeof IntersectionObserver !== 'undefined') {
      this._intersection = new IntersectionObserver(entries => {
        this._visible = entries[0]?.isIntersecting !== false;
        this._syncAnimation();
      });
      this._intersection.observe(mount);
    }
    this._syncAnimation();
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

  /* ---------------- realism ---------------- */

  _buildRealism() {
    const o = this.opts;
    const pal = BACKDROPS[`${o.environment}${o.dark ? '-dark' : ''}`] || BACKDROPS.outdoor;
    this.backdrop = pal;
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = o.dark ? 1.0 : 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.type = THREE.PCFShadowMap;

    // Soft studio reflections so metal, paint and glass read as materials.
    // (An enhancement: a limited WebGL implementation just renders without it.)
    try {
      const pmrem = new THREE.PMREMGenerator(r);
      const room = new RoomEnvironment();
      this._envTarget = pmrem.fromScene(room, 0.04);
      room.traverse?.(n => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
      pmrem.dispose();
      this.scene.environment = this._envTarget.texture;
      this.scene.environmentIntensity = o.environment === 'studio' ? 0.55 : 0.4;
    } catch { this._envTarget = null; }

    // Sky dome: zenith to horizon to ground, so the model sits in a place, not a void.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(pal.top) }, horizon: { value: new THREE.Color(pal.horizon) }, ground: { value: new THREE.Color(pal.ground) } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; varying vec3 vDir;
          void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.85, h), 0.7)) : mix(horizon, ground, smoothstep(0.0, 0.08, -h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`,
      }),
    );
    dome.name = '__sky';
    dome.frustumCulled = false;
    dome.renderOrder = -1;
    this.scene.add(dome);
    this.sky = dome;
    this.scene.background = new THREE.Color(pal.horizon);
    this.scene.fog = new THREE.Fog(pal.horizon, 40, 160);

    // Light: sky/ground bounce plus a warm sun that casts the shadows.
    const hemi = new THREE.HemisphereLight(pal.sky, pal.bounce, o.dark ? 0.9 : 1.1);
    this.scene.add(hemi);
    this.hemiLight = hemi;
    const sun = new THREE.DirectionalLight(pal.sun, o.dark ? 2.2 : 2.6);
    sun.position.set(9, 15, 7);
    sun.castShadow = true;
    const map = this.modestDevice ? 1024 : 2048;
    sun.shadow.mapSize.set(map, map);
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.06;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.keyLight = sun;
    const rim = new THREE.DirectionalLight(pal.sky, 0.35);
    rim.position.set(-10, 6, -8);
    this.scene.add(rim);

    if (this.opts.ground) {
      const groundMat = new THREE.MeshStandardMaterial({ color: pal.ground, roughness: 1, metalness: 0 });
      groundMat.onBeforeCompile = (shader) => {
        // Faint large-scale variation so the ground reads as a surface, not a flat fill.
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vWorldPos;
          float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(gHash(i), gHash(i+vec2(1,0)), f.x), mix(gHash(i+vec2(0,1)), gHash(i+vec2(1,1)), f.x), f.y); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
          float gv = gNoise(vWorldPos.xz * 0.35) * 0.6 + gNoise(vWorldPos.xz * 2.1) * 0.4;
          diffuseColor.rgb *= 0.93 + gv * 0.12;`);
      };
      const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.name = '__ground';
      this.scene.add(ground);
      this.groundMesh = ground;

      // Contact shadow: a soft dark pool under the model that grounds it even where the sun misses.
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(0,0,0,0.55)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: o.dark ? 0.8 : 0.55, toneMapped: false }));
        contact.rotation.x = -Math.PI / 2;
        contact.position.y = 0.004;
        contact.renderOrder = 1;
        contact.name = '__contact';
        this.scene.add(contact);
        this.contactShadow = contact;
      } catch { this.contactShadow = null; }

      if (o.grid) {
        const size = o.groundSize;
        const grid = new THREE.GridHelper(size * 2, size * 2, 0x9a958c, 0xb9b4aa);
        grid.material.transparent = true;
        grid.material.opacity = o.dark ? 0.12 : 0.22;
        grid.material.depthWrite = false;
        grid.position.y = 0.002;
        grid.name = '__grid';
        this.scene.add(grid);
        this.grid = grid;
      }
    }

    if (o.ambientOcclusion && !this.modestDevice) this._buildComposer();
  }

  async _buildComposer() {
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/GTAOPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);
      if (this.disposed) return;
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const gtao = new GTAOPass(this.scene, this.camera, 512, 512);
      gtao.blendIntensity = 0.75;   // subtle: darkens creases and contact, not everything
      gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(gtao);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.aoPass = gtao;
      this.resize();
    } catch { /* post-processing is an enhancement; plain rendering still works */ }
  }

  // Fit the sun's shadow box, the contact shadow and the fog to what is on show.
  _fitEnvironment(box) {
    if (!this.opts.realism || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.75 + 1;
    const sun = this.keyLight;
    const dir = new THREE.Vector3(0.55, 0.9, 0.42).normalize();
    sun.position.copy(center).add(dir.multiplyScalar(radius * 3));
    sun.target.position.copy(center);
    sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    Object.assign(cam, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.5, far: radius * 7 });
    cam.updateProjectionMatrix();
    if (this.contactShadow) {
      this.contactShadow.position.set(center.x, box.min.y > 0.5 ? 0.004 : Math.min(0.004, box.min.y + 0.004), center.z);
      this.contactShadow.scale.set(size.x * 1.35 + 0.8, size.z * 1.35 + 0.8, 1);
    }
    if (this.sky) this.sky.scale.setScalar(Math.max(300, radius * 30));
    if (this.scene.fog) { this.scene.fog.near = radius * 6; this.scene.fog.far = radius * 26 + 60; }
    if (this.aoPass) this.aoPass.updateGtaoMaterial({ radius: Math.min(1.2, Math.max(0.25, radius * 0.06)) });
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

    el.addEventListener('pointermove', this._onMove, { passive: true });
    el.addEventListener('pointerdown', this._onDown, { passive: true });
    el.addEventListener('pointerup', this._onUp, { passive: true });
    el.addEventListener('pointerleave', this._onLeave, { passive: true });
  }

  _raycast() {
    if (!this.pickables.length) return null;
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Fast filter: only visible objects whose parent hierarchy is visible
    const visible = [];
    for (let i = 0; i < this.pickables.length; i++) {
      const obj = this.pickables[i];
      if (obj.visible && obj.parent?.visible !== false && obj.userData.pickable !== false) {
        visible.push(obj);
      }
    }
    if (!visible.length) return null;

    const hits = this.raycaster.intersectObjects(visible, true);
    for (let i = 0; i < hits.length; i++) {
      const target = this._pickRoot(hits[i].object);
      if (target) return { object: target, point: hits[i].point };
    }
    return null;
  }

  // Fast WeakMap-cached ancestor lookup
  _pickRoot(obj) {
    if (!obj) return null;
    if (this._pickRootMap.has(obj)) return this._pickRootMap.get(obj);

    let node = obj;
    while (node) {
      if (this.pickables.includes(node)) {
        this._pickRootMap.set(obj, node);
        return node;
      }
      node = node.parent;
    }
    this._pickRootMap.set(obj, null);
    return null;
  }

  registerPickable(obj) {
    if (!this.pickables.includes(obj)) {
      this.pickables.push(obj);
      // Pre-cache mesh descendants for instant emissive / outline updates
      const meshes = [];
      obj.traverse(n => {
        if (n.isMesh) meshes.push(n);
      });
      this._rootMeshCache.set(obj, meshes);
    }
  }

  onHover(fn)  { this._pickHandlers.hover = fn; }
  onSelect(fn) { this._pickHandlers.select = fn; }

  // Replace the default emissive hover/selection highlight. Tools that share
  // one material across many meshes pass a handler that swaps materials
  // instead, because editing a shared material's emissive lights up every
  // mesh using it. Called as fn(root, { hovered, selected }).
  setEmphasisHandler(fn) { this._emphasisHandler = fn; }

  _setHovered(obj) {
    if (this.hovered === obj) return;
    if (this.hovered) this._applyEmphasis(this.hovered, false);
    this.hovered = obj;
    if (obj) this._applyEmphasis(obj, true);
    this.renderer.domElement.style.cursor = obj ? 'pointer' : '';
    this._pickHandlers.hover?.(obj);
  }

  select(obj) {
    if (this.selected === obj) return;
    if (this.selected) this._applyOutline(this.selected, false);
    this.selected = obj;
    if (obj) this._applyOutline(obj, true);
    this._pickHandlers.select?.(obj);
  }

  _applyEmphasis(root, on) {
    if (this._emphasisHandler) {
      this._emphasisHandler(root, { hovered: on, selected: this.selected === root });
      return;
    }
    const meshes = this._rootMeshCache.get(root) || [];
    for (let i = 0; i < meshes.length; i++) {
      const node = meshes[i];
      if (!node.material?.emissive || node.userData._isSelected) continue;
      if (on) {
        node.userData._emissiveWas ??= node.material.emissive.getHex();
        node.material.emissive.setHex(0x404040);
      } else if (node.userData._emissiveWas !== undefined) {
        node.material.emissive.setHex(node.userData._emissiveWas);
        delete node.userData._emissiveWas;
      }
    }
  }

  _applyOutline(root, on) {
    if (this._emphasisHandler) {
      this._emphasisHandler(root, { hovered: this.hovered === root, selected: on });
      return;
    }
    const meshes = this._rootMeshCache.get(root) || [];
    for (let i = 0; i < meshes.length; i++) {
      const node = meshes[i];
      if (!node.material) continue;
      if (on) {
        if (node.userData._isSelected) continue;
        node.userData._isSelected = true;
        if (node.material.emissive) {
          node.userData._selEmissiveWas ??= node.material.emissive.getHex();
          node.material.emissive.setHex(0x0ea5e9);
        }
      } else if (node.userData._isSelected) {
        node.userData._isSelected = false;
        if (node.userData._selEmissiveWas !== undefined && node.material.emissive) {
          node.material.emissive.setHex(node.userData._selEmissiveWas);
          delete node.userData._selEmissiveWas;
        }
      }
    }
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
    target.updateMatrixWorld(true);
    target.traverse(o => { if (o.isMesh && o.visible && !o.name.startsWith('__')) box.expandByObject(o); });
    if (box.isEmpty()) return;

    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();

    // Exact fit: the closest distance at which every corner of the box is
    // inside the view (both field-of-view axes), times the padding.
    const tanV = Math.tan((this.camera.fov * Math.PI / 180) / 2) / padding;
    const tanH = tanV * (this.camera.aspect || 1);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    let dist = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).sub(center);
      const depth = p.dot(dir);                 // towards the camera
      dist = Math.max(dist, depth + Math.abs(p.dot(right)) / tanH, depth + Math.abs(p.dot(up)) / tanV);
    }
    if (!Number.isFinite(dist) || dist <= 0) dist = (maxDim / 2) / Math.tan((this.camera.fov * Math.PI / 180) / 2) * padding;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(0.05, dist / 200);
    this.camera.far  = Math.max(dist * 20, this.opts.realism ? (this.sky?.scale.x || 300) * 1.5 : 0);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this._fitEnvironment(box);
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
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick() {
    if (this.disposed) return;
    this.controls.update();
    // Skip hover picking while a button is held: that is an orbit or pan
    // drag, and raycasting large scenes every frame makes it stutter.
    if (this._pointerMoved && !this._downAt) {
      const hit = this._raycast();
      this._setHovered(hit ? hit.object : null);
      this._pointerMoved = false;
    }
    this._updateLabels();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this._syncAnimation);
    this._intersection?.disconnect();
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
    this.composer?.dispose?.();
    this.aoPass?.dispose?.();
    this._envTarget?.dispose();
    this.renderer.dispose();
    el.remove();
  }
}

export { THREE };
