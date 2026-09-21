import { Scene, PerspectiveCamera, Raycaster, Vector2, Vector3, Spherical, Box3, Sphere } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VehicleLoader, disposeObject } from './vehicle-loader.js';
import { TechnicalRenderer } from './technical-renderer.js';

const CAMERA_KEYS = ['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export class AutomobileViewer {
  constructor(host, { onSelect = () => {}, onStatus = () => {} } = {}) {
    this.host = host;
    this.onSelect = onSelect;
    this.onStatus = onStatus;
    this.generation = 0;
    this.mode = 'technical';
    this.disposed = false;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(36, 1, .05, 100);
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'Interactive technical model. Arrow keys orbit; plus and minus zoom; Home resets. Choose parts from the component list.');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.pipeline = new TechnicalRenderer(this.canvas, { mobile: matchMedia('(max-width:900px)').matches });
    host.replaceChildren(this.canvas);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 30;
    this.invalidate = () => this.requestRender();
    this.controls.addEventListener('change', this.invalidate);
    window.addEventListener('toolbox:themechange', this.invalidate);
    this.onVisible=()=>{if(!document.hidden)this.requestRender();};
    document.addEventListener('visibilitychange', this.onVisible);
    this.loader = new VehicleLoader({ maxTriangles: this.pipeline.mobile ? 250000 : 500000 });
    this.raycaster = new Raycaster();
    this.pointers = new Set();

    this.events = {
      pointerdown: event => {
        this.pointers.add(event.pointerId);
        this.start = this.pointers.size === 1 ? { x: event.clientX, y: event.clientY } : null;
      },
      pointerup: event => {
        if (this.start && Math.hypot(event.clientX - this.start.x, event.clientY - this.start.y) < 5) {
          this.select(this.pick(event)?.id || null);
        }
        this.start = null;
        this.pointers.delete(event.pointerId);
      },
      pointermove: event => {
        if (event.pointerType === 'touch' || event.buttons) return;
        const id = this.pick(event)?.id || null;
        if (id !== this.hoverId) { this.hoverId = id; this.requestRender(); }
      },
      keydown: event => this.onKey(event),
      webglcontextlost: event => {
        event.preventDefault();
        this.contextLost = true;
        this.onStatus('Graphics interrupted. Waiting for recovery; reload this page if it does not resume.');
      },
      webglcontextrestored: () => {
        this.contextLost = false;
        this.onStatus('Graphics restored. Drag to orbit or choose a component.');
        this.requestRender();
      }
    };
    this.events.pointerleave = this.events.pointercancel = event => {
      this.pointers.delete(event.pointerId);
      this.hoverId = null;
      this.start = null;
      this.requestRender();
    };
    for (const [name, handler] of Object.entries(this.events)) this.canvas.addEventListener(name, handler);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.reset();
  }

  onKey(event) {
    if (!CAMERA_KEYS.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') this.reset();
    else if (event.key === '+' || event.key === '=') this.zoom(.2);
    else if (event.key === '-') this.zoom(-.2);
    else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new Spherical().setFromVector3(offset);
      spherical.theta += event.key === 'ArrowLeft' ? .12 : event.key === 'ArrowRight' ? -.12 : 0;
      spherical.phi += event.key === 'ArrowUp' ? -.12 : event.key === 'ArrowDown' ? .12 : 0;
      spherical.makeSafe();
      this.camera.position.copy(this.controls.target).add(new Vector3().setFromSpherical(spherical));
      this.controls.update();
    }
  }

  resize() {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const distance = this.fittedDistance();
    // Preserve the user's relative zoom and pan when orientation changes.
    if (this.fitDistance) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(distance / this.fitDistance);
      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.maxDistance = Math.max(30, distance * 3);
      this.controls.update();
    }
    this.fitDistance = distance;
    this.pipeline.resize(width, height, devicePixelRatio || 1);
    this.requestRender();
  }

  async loadVehicle(descriptor) {
    this.clear();
    const generation = this.generation;
    this.onStatus('Loading 3D geometry…');
    try {
      const loaded = await this.loader.load(descriptor);
      if (this.disposed || generation !== this.generation) { disposeObject(loaded.root); return null; }
      this.asset = loaded;
      this.radius = new Box3().setFromObject(loaded.root).getBoundingSphere(new Sphere()).radius;
      this.scene.add(loaded.root);
      this.reset();
      return loaded;
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.onStatus(error.message);
      throw error;
    }
  }

  clear() {
    ++this.generation;
    if (this.asset) {
      this.scene.remove(this.asset.root);
      disposeObject(this.asset.root);
      this.asset = null;
    }
    this.pipeline.resetParts();
    this.selectedId = null;
    this.hoverId = null;
    this.requestRender();
  }

  pick(event) {
    if (!this.asset) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1
    ), this.camera);
    const entries = this.asset.registry.list().filter(part => this.mode !== 'isolate' || !this.selectedId || part.id === this.selectedId);
    const hit = this.raycaster.intersectObjects(entries.flatMap(part => part.meshes), false)[0];
    return hit ? this.asset.registry.byMesh.get(hit.object) : null;
  }

  select(id) {
    this.selectedId = this.asset?.registry.get(id) ? id : null;
    this.onSelect(this.asset?.registry.metadata(this.selectedId) || null);
    this.requestRender();
  }

  setMode(mode) {
    if (!['technical', 'xray', 'isolate'].includes(mode)) return;
    this.mode = mode;
    this.requestRender();
  }

  zoom(delta) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, offset.length() * Math.exp(-delta))));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.requestRender();
  }

  fittedDistance() {
    const angle = Math.atan(Math.tan(this.camera.fov * Math.PI / 360) * Math.min(1, this.camera.aspect));
    return (this.radius || 2.7) / Math.sin(angle) * 1.12;
  }

  reset() {
    this.fitDistance = this.fittedDistance();
    this.controls.maxDistance = Math.max(30, this.fitDistance * 3);
    this.camera.position.set(7, 4.5, 7).setLength(this.fitDistance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  requestRender() {
    if (this.disposed || this.contextLost || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.disposed || this.contextLost) return;
      if (this.asset) {
        this.pipeline.render(this.scene, this.camera, this.asset.registry, {
          mode: this.mode, selectedId: this.selectedId, hoverId: this.hoverId
        });
      } else {
        this.pipeline.renderer.setClearColor(this.pipeline.settings.background);
        this.pipeline.renderer.clear();
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.removeEventListener('change', this.invalidate);
    window.removeEventListener('toolbox:themechange', this.invalidate);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.controls.dispose();
    for (const [name, handler] of Object.entries(this.events)) this.canvas.removeEventListener(name, handler);
    this.clear();
    this.pipeline.dispose();
    this.canvas.remove();
  }
}
