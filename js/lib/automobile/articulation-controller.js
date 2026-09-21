/**
 * Articulation controller for Toolbox Vehicle Packages.
 *
 * A package declares articulations (open a door, remove a wheel, pull the
 * dipstick …) as transforms on named pivot nodes. Each pivot keeps its
 * authored rest transform; every frame the controller recomposes the pivot
 * from all articulations that act on it, so combinations such as "steer
 * left" + "remove wheel" stay exact and fully reversible.
 */
import { Quaternion, Vector3 } from 'three';

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = v => Math.min(1, Math.max(0, v));

export class ArticulationController {
  constructor(root, definitions = [], { onChange = () => {}, reducedMotion = false } = {}) {
    this.onChange = onChange;
    this.reducedMotion = reducedMotion;
    this.definitions = new Map();
    this.state = new Map();
    this.nodes = new Map();
    this.byComponent = new Map();
    this.missing = [];
    this._q = new Quaternion();
    this._v = new Vector3();
    for (const def of definitions) {
      const transforms = [];
      for (const transform of def.transforms || []) {
        const object = root.getObjectByName(transform.node);
        if (!object) { this.missing.push(transform.node); continue; }
        if (!this.nodes.has(object)) this.nodes.set(object, { position: object.position.clone(), quaternion: object.quaternion.clone(), entries: [] });
        const axis = transform.rotate ? new Vector3(...transform.rotate.axis).normalize() : null;
        const offset = transform.translate ? new Vector3(...transform.translate) : null;
        transforms.push({ ...transform, object, axis, offset });
      }
      if (!transforms.length) continue;
      const entry = { ...def, transforms, duration: def.duration ?? 900 };
      for (const t of transforms) this.nodes.get(t.object).entries.push({ entry, t });
      this.definitions.set(def.id, entry);
      this.state.set(def.id, { value: 0, target: 0 });
      for (const componentId of def.components || []) {
        if (!this.byComponent.has(componentId)) this.byComponent.set(componentId, []);
        this.byComponent.get(componentId).push(entry);
      }
    }
  }

  get size() { return this.definitions.size; }
  list() { return [...this.definitions.values()]; }
  get(id) { return this.definitions.get(id) || null; }
  isActive(id) { return this.state.get(id)?.target === 1; }
  isMoving() { for (const s of this.state.values()) if (s.value !== s.target) return true; return false; }

  /** Articulations offered for a component, in manifest order. */
  forComponent(componentId) { return this.byComponent.get(componentId) || []; }

  /** Whether an articulation can change state now, and why not. */
  availability(id) {
    const def = this.definitions.get(id);
    if (!def) return { enabled: false, reason: 'Not available for this vehicle.' };
    const next = !this.isActive(id);
    for (const requirement of def.requires || []) {
      // A requirement only guards the transition away from the rest state
      // when the requirement is positive; negative requirements guard both.
      if (!next && requirement.state === true) continue;
      if (this.isActive(requirement.id) !== requirement.state) return { enabled: false, reason: requirement.reason || 'Another part must be moved first.' };
    }
    return { enabled: true, reason: '' };
  }

  /** Label for the next action (e.g. "Open door" while closed). */
  actionLabel(id) {
    const def = this.definitions.get(id);
    if (!def) return '';
    return this.isActive(id) ? def.actions?.off || `Reset ${def.label}` : def.actions?.on || `Move ${def.label}`;
  }

  set(id, active, { force = false } = {}) {
    const def = this.definitions.get(id), state = this.state.get(id);
    if (!def || !state) return false;
    const target = active ? 1 : 0;
    if (state.target === target) return true;
    if (!force && !this.availability(id).enabled) return false;
    if (active && def.exclusive) {
      for (const other of this.definitions.values()) if (other !== def && other.exclusive === def.exclusive) this.state.get(other.id).target = 0;
    }
    // Closing something returns every part that depends on it being open
    // (e.g. closing the bonnet reinserts the dipstick and refits the caps).
    if (!active) for (const dependant of this.dependants(id)) if (this.isActive(dependant.id)) this.set(dependant.id, false, { force: true });
    state.target = target;
    if (this.reducedMotion) { for (const s of this.state.values()) s.value = s.target; this.apply(); }
    this.onChange({ id, active, definition: def });
    return true;
  }

  toggle(id) { return this.set(id, !this.isActive(id)); }

  dependants(id) {
    return [...this.definitions.values()].filter(def => (def.requires || []).some(r => r.id === id && r.state === true));
  }

  /** Return every articulation to rest, dependants first so requirements hold. */
  resetAll() {
    let changed = true, guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      for (const id of this.definitions.keys()) if (this.isActive(id) && this.set(id, false)) changed = true;
    }
    for (const id of this.definitions.keys()) if (this.isActive(id)) this.set(id, false, { force: true });
  }

  /** Activate or deactivate every articulation in a group (e.g. "Doors"). */
  setGroup(group, active) {
    let count = 0;
    for (const def of this.definitions.values()) if (def.group === group && this.set(def.id, active)) count++;
    return count;
  }

  /** Advance animations. Returns true while anything is still moving. */
  update(deltaMs) {
    let moving = false;
    for (const [id, state] of this.state) {
      if (state.value === state.target) continue;
      const duration = this.reducedMotion ? 0 : this.definitions.get(id).duration;
      const step = duration > 0 ? deltaMs / duration : 1;
      state.value = state.target > state.value ? Math.min(state.target, state.value + step) : Math.max(state.target, state.value - step);
      if (state.value !== state.target) moving = true;
    }
    this.apply();
    return moving;
  }

  apply() {
    for (const [object, node] of this.nodes) {
      object.position.copy(node.position);
      object.quaternion.copy(node.quaternion);
      for (const { entry, t } of node.entries) {
        const raw = this.state.get(entry.id).value;
        if (!raw) continue;
        const delay = t.delay || 0;
        const e = easeInOut(clamp01((raw - delay) / (1 - delay)));
        if (t.offset) object.position.addScaledVector(t.offset, e);
        if (t.axis) object.quaternion.multiply(this._q.setFromAxisAngle(t.axis, (t.rotate.degrees * Math.PI / 180) * e));
      }
    }
  }

  dispose() { this.nodes.clear(); this.definitions.clear(); this.state.clear(); this.byComponent.clear(); }
}
