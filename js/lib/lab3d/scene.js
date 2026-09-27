/* ============================================================
   3D Lab — scene description

   One JSON format shared by the 3D Lab, the Assistant and saved
   scenes:

   { title, environment: 'studio'|'outdoor', items: [
       { type: 'model',  model: 'office-chair', params: { color: '#3f4a5c' } },
       { type: 'shape',  shape: 'torus-knot', params: { p: 3, q: 7 }, material: 'chrome', color: '#…' },
       { type: 'online', source: 'khronos'|'polyhaven', id: 'SheenChair', url? },
       { type: 'custom', vertices: [[x,y,z]…], faces: [[a,b,c]…], material, color },
     ] }

   Every item also takes at [x,y,z] (metres), rotate [rx,ry,rz]
   (degrees), scale (number or [sx,sy,sz]) and name. Items without
   `at` are laid out side by side. Each object rests on the floor.
   ============================================================ */

import * as THREE from 'three';
import { MODEL_BY_ID, modelDefaults, cleanModelParams, resolveObject } from './catalog.js';
import { SHAPE_BY_ID, buildShapeGeometry, shapeDefaults, clampParams } from './shapes.js';
import { mat, MATERIALS, colorFromWords } from './materials.js';

const DEG = Math.PI / 180;
const MAX_ITEMS = 60;
const vec3 = (v, d) => (Array.isArray(v) && v.length === 3 && v.every(n => Number.isFinite(Number(n))) ? v.map(Number) : d);

/** Validates one raw item into the canonical form, or returns { error }. */
export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Item is not an object.' };
  let type = raw.type;
  if (!type) type = raw.model ? 'model' : raw.shape ? 'shape' : (raw.url || raw.source) ? 'online' : raw.vertices ? 'custom' : raw.prompt || raw.object ? 'prompt' : null;
  if (type && !['model', 'shape', 'online', 'custom', 'prompt'].includes(type)) {
    // { type: 'office-chair' } or { type: 'torus-knot' }
    if (MODEL_BY_ID.has(type)) { raw = { ...raw, model: type }; type = 'model'; }
    else if (SHAPE_BY_ID.has(type)) { raw = { ...raw, shape: type }; type = 'shape'; }
    else { raw = { ...raw, prompt: raw.prompt || type }; type = 'prompt'; }
  }
  if (type === 'prompt') {
    const r = resolveObject(raw.prompt || raw.object || '');
    if (!r) return { error: `Nothing in the library matches "${raw.prompt || raw.object}".` };
    raw = { ...raw, [r.kind]: r.id, params: { ...r.params, ...(raw.params || {}) } };
    type = r.kind;
  }
  const base = { type, name: raw.name ? String(raw.name).slice(0, 80) : undefined };
  if (raw.at != null) base.at = vec3(raw.at, undefined);
  if (raw.rotate != null) base.rotate = vec3(raw.rotate, undefined);
  if (raw.scale != null) base.scale = Number.isFinite(Number(raw.scale)) ? Math.max(0.001, Number(raw.scale)) : vec3(raw.scale, undefined);
  if (type === 'model') {
    const id = String(raw.model || '').toLowerCase();
    if (!MODEL_BY_ID.has(id)) return { error: `Unknown model "${raw.model}".` };
    return { ...base, model: id, params: cleanModelParams(id, raw.params || {}) };
  }
  if (type === 'shape') {
    const id = String(raw.shape || '').toLowerCase();
    if (!SHAPE_BY_ID.has(id)) return { error: `Unknown shape "${raw.shape}".` };
    const color = raw.color ? (/^#?[0-9a-f]{6}$/i.test(raw.color) ? `#${String(raw.color).replace('#', '')}` : colorFromWords(raw.color)) : undefined;
    return { ...base, shape: id, params: clampParams(id, raw.params || {}), material: MATERIALS.includes(raw.material) ? raw.material : 'plastic', color: color || undefined };
  }
  if (type === 'online') {
    const source = raw.source === 'polyhaven' ? 'polyhaven' : raw.source === 'khronos' ? 'khronos' : raw.url ? 'url' : null;
    if (!source) return { error: 'Online items need a source (khronos or polyhaven) and id, or a url.' };
    if (raw.url && !/^https:\/\//.test(raw.url)) return { error: 'Online model URLs must be https.' };
    return { ...base, source, id: raw.id ? String(raw.id) : undefined, url: raw.url || undefined, label: raw.label || raw.name };
  }
  if (type === 'custom') {
    const v = Array.isArray(raw.vertices) ? raw.vertices.filter(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) : [];
    const f = Array.isArray(raw.faces) ? raw.faces.filter(t => Array.isArray(t) && t.length >= 3 && t.every(i => Number.isInteger(i) && i >= 0 && i < v.length)) : [];
    if (v.length < 3 || !f.length) return { error: 'Custom meshes need vertices [[x,y,z]…] and faces [[a,b,c]…].' };
    if (v.length > 20000) return { error: 'Custom meshes are limited to 20,000 vertices.' };
    return { ...base, vertices: v, faces: f, material: MATERIALS.includes(raw.material) ? raw.material : 'plastic', color: raw.color };
  }
  return { error: 'Each item needs a model, shape, online source, custom mesh or prompt.' };
}

export function normalizeSpec(raw = {}) {
  const items = [], warnings = [];
  for (const it of (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS)) {
    const n = normalizeItem(it);
    if (n.error) warnings.push(n.error); else items.push(n);
  }
  if (Array.isArray(raw.items) && raw.items.length > MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} items were used.`);
  return { title: String(raw.title || '').slice(0, 120) || titleFor(items), environment: raw.environment === 'outdoor' ? 'outdoor' : 'studio', items, warnings };
}

export function titleFor(items) {
  if (!items.length) return '3D scene';
  const first = labelFor(items[0]);
  return items.length === 1 ? first : `${first} and ${items.length - 1} more`;
}

export function labelFor(item) {
  if (item.name) return item.name;
  if (item.type === 'model') return MODEL_BY_ID.get(item.model)?.name || item.model;
  if (item.type === 'shape') return SHAPE_BY_ID.get(item.shape)?.name || item.shape;
  if (item.type === 'online') return item.label || item.id || 'Online model';
  return 'Custom mesh';
}

/* ---------------- building ---------------- */

function customMesh(item) {
  const pos = [];
  for (const f of item.faces) for (let i = 1; i + 1 < f.length; i++) for (const k of [f[0], f[i], f[i + 1]]) pos.push(...item.vertices[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(item.material, item.color, { side: 'double' }));
  m.castShadow = m.receiveShadow = true;
  const grp = new THREE.Group();
  grp.add(m);
  return grp;
}

async function buildContent(item) {
  if (item.type === 'model') {
    const def = MODEL_BY_ID.get(item.model);
    return def.build({ ...modelDefaults(item.model), ...item.params });
  }
  if (item.type === 'shape') {
    const s = SHAPE_BY_ID.get(item.shape);
    const m = new THREE.Mesh(buildShapeGeometry(item.shape, item.params), mat(item.material, item.color, s.doubleSided ? { side: 'double' } : {}));
    m.castShadow = m.receiveShadow = true;
    m.name = s.name;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }
  if (item.type === 'online') {
    const { loadOnline } = await import('./online.js');
    return loadOnline(item);
  }
  return customMesh(item);
}

/**
 * Builds one item: a pivot (carrying the item's transform) around content
 * that is centred on x/z and rests on y = 0.
 */
export async function buildItem(item) {
  const content = await buildContent(item);
  const pivot = new THREE.Group();
  pivot.name = labelFor(item);
  const present = item.type === 'model' ? MODEL_BY_ID.get(item.model)?.present : null;
  if (present?.rotate) content.rotation.set(...present.rotate.map(d => d * DEG));
  pivot.add(content);
  groundContent(pivot, content);
  applyTransform(pivot, item);
  pivot.userData.lab = item;
  return pivot;
}

export function groundContent(pivot, content) {
  content.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(content);
  if (box.isEmpty()) return;
  content.position.x -= (box.min.x + box.max.x) / 2;
  content.position.z -= (box.min.z + box.max.z) / 2;
  content.position.y -= box.min.y;
}

export function applyTransform(obj, item) {
  if (item.at) obj.position.set(...item.at);
  if (item.rotate) obj.rotation.set(...item.rotate.map(d => d * DEG));
  if (item.scale != null) Array.isArray(item.scale) ? obj.scale.set(...item.scale) : obj.scale.setScalar(item.scale);
}

/** Places items that have no position side by side along x, centred on the origin. */
export function layoutRow(objects) {
  const free = objects.filter(o => !o.userData.lab?.at);
  if (!free.length) return;
  const sizes = free.map(boundsOf);
  const gap = Math.max(0.03, Math.max(...sizes.map(s => Math.max(s.x, s.z))) * 0.25);
  const total = sizes.reduce((t, s) => t + s.x, 0) + gap * (free.length - 1);
  let x = -total / 2;
  free.forEach((o, i) => { o.position.x = x + sizes[i].x / 2; x += sizes[i].x + gap; });
}

/** Builds a whole scene; failed items are reported in `warnings`. */
export async function buildScene(rawSpec) {
  const spec = normalizeSpec(rawSpec);
  const root = new THREE.Group();
  root.name = spec.title;
  const objects = [];
  const warnings = [...spec.warnings];
  for (const item of spec.items) {
    try { const o = await buildItem(item); objects.push(o); root.add(o); }
    catch (err) { warnings.push(`${labelFor(item)}: ${err.message || 'could not be built'}.`); }
  }
  layoutRow(objects);
  return { spec, root, objects, warnings };
}

/** Reads the current transform of built objects back into a spec. */
export function serialize(objects, { title, environment, includeFiles = false } = {}) {
  const r = (n) => Math.round(n * 1e4) / 1e4;
  const items = objects.filter(o => o.userData.lab && (includeFiles || o.userData.lab.type !== 'file')).map(o => {
    const it = { ...o.userData.lab };
    it.at = o.position.toArray().map(r);
    const rot = [o.rotation.x, o.rotation.y, o.rotation.z].map(v => r(v / DEG));
    if (rot.some(Boolean)) it.rotate = rot; else delete it.rotate;
    const s = o.scale.toArray().map(r);
    if (s.every(v => v === s[0])) { if (s[0] !== 1) it.scale = s[0]; else delete it.scale; } else it.scale = s;
    if (o.name && o.name !== labelFor({ ...it, name: undefined })) it.name = o.name; else delete it.name;
    return it;
  });
  return { title: title || titleFor(items), environment: environment || 'studio', items };
}

/** World-space bounding size of an object in metres. */
export function boundsOf(obj) {
  return new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
}

/** The object's own width × height × depth (ignoring how it is turned), in metres. */
export function sizeOf(obj) {
  const saved = [];
  obj.traverse(o => { if (o === obj || o.parent === obj) { saved.push([o, o.rotation.clone()]); o.rotation.set(0, 0, 0); } });
  const pos = obj.position.clone();
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  for (const [o, r] of saved) o.rotation.copy(r);
  obj.position.copy(pos);
  obj.updateMatrixWorld(true);
  return s;
}

export { shapeDefaults };
