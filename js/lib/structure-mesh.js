/* ============================================================
   TOOLBOX — Structure modeller: expanded model → three.js

   Turns the output of structure-model.js expandStructure() into a
   three.js group with the shared architectural materials:
   - members become instanced meshes (one draw call per section shape
     and material), oriented from end to end with their depth kept
     vertical, so thousands of truss or frame members stay fast;
   - joint nodes become instanced spheres;
   - primitives (boxes, cylinders, extrusions, lathes, tubes, meshes,
     vaults, shells) become ordinary meshes.
   ============================================================ */

import * as THREE from 'three';
import { material } from './render-materials.js';

const UP = new THREE.Vector3(0, 1, 0);

function matFor(kind, color, opts = {}) {
  return material(kind || 'paint', color || null, opts);
}

/** Unit-length section geometry along +Z (length 1, centred), width along X, depth along Y. */
function sectionGeometry(shape) {
  if (shape === 'round') return new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1).rotateX(Math.PI / 2);
  if (shape === 'I') {
    // I-section of unit width and depth: 12% flanges, 8% web.
    const s = new THREE.Shape();
    const f = 0.12, w = 0.08;
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, -0.5 + f); s.lineTo(w / 2, -0.5 + f); s.lineTo(w / 2, 0.5 - f);
    s.lineTo(0.5, 0.5 - f); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5); s.lineTo(-0.5, 0.5 - f); s.lineTo(-w / 2, 0.5 - f);
    s.lineTo(-w / 2, -0.5 + f); s.lineTo(-0.5, -0.5 + f); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  }
  return new THREE.BoxGeometry(1, 1, 1);
}

/** Orientation that points +Z along `dir` and keeps the section's depth (+Y) as vertical as possible. */
function orient(dir) {
  const z = dir.clone().normalize();
  let x = new THREE.Vector3().crossVectors(UP, z);
  if (x.lengthSq() < 1e-8) x = new THREE.Vector3(1, 0, 0);   // vertical member: width along X
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

function primMesh(p) {
  const P = p.params;
  const segs = (d) => Math.max(6, Math.min(96, Math.round(Number(P.segments) || d)));
  let geo;
  const opts = { side: /glass|water/.test(p.material || '') || p.shape === 'mesh' || p.shape === 'surface' || p.shape === 'vault' ? 'double' : undefined };
  switch (p.shape) {
    case 'box': geo = new THREE.BoxGeometry(...P.size); break;
    case 'cylinder': geo = new THREE.CylinderGeometry(P.radiusTop ?? P.radius, P.radius, P.height, segs(24)); break;
    case 'cone': geo = new THREE.CylinderGeometry(P.radiusTop ?? 0, P.radius, P.height, segs(24)); break;
    case 'sphere':
      geo = P.hemisphere
        ? new THREE.SphereGeometry(P.radius, segs(32), segs(16), 0, Math.PI * 2, 0, Math.PI / 2)
        : new THREE.SphereGeometry(P.radius, segs(24), segs(16));
      if (P.hemisphere) opts.side = 'double';
      break;
    case 'torus': geo = new THREE.TorusGeometry(P.radius, P.tube, 12, 48, (P.arc ?? 360) * Math.PI / 180); break;
    case 'extrude': {
      const shape = new THREE.Shape(P.points.map(([x, z]) => new THREE.Vector2(x, -z)));
      for (const h of P.holes || []) if (Array.isArray(h) && h.length >= 3) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(Number(x), -Number(z)))));
      geo = new THREE.ExtrudeGeometry(shape, { depth: P.height, bevelEnabled: false }).rotateX(-Math.PI / 2);
      break;
    }
    case 'lathe': geo = new THREE.LatheGeometry(P.profile.map(([r, y]) => new THREE.Vector2(r, y)), segs(48)); opts.side = 'double'; break;
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(P.path.map(q => new THREE.Vector3(...q)), P.closed, 'centripetal');
      geo = new THREE.TubeGeometry(curve, Math.min(600, P.path.length * 8), P.radius, 10, P.closed);
      break;
    }
    case 'mesh': {
      geo = new THREE.BufferGeometry();
      const pos = [];
      for (const f of P.faces) {
        for (let k = 1; k < f.length - 1; k++) for (const i of [f[0], f[k], f[k + 1]]) { const v = P.vertices[i]; if (v) pos.push(...v); else pos.push(0, 0, 0); }
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      break;
    }
    case 'vault': {
      // Arch centreline swept along Z into a shell.
      const shape = new THREE.Shape();
      P.path.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
      for (let i = P.path.length - 1; i >= 0; i--) { const [x, y] = P.path[i]; shape.lineTo(x, Math.max(0, y - P.thickness)); }
      geo = new THREE.ExtrudeGeometry(shape, { depth: P.length, bevelEnabled: false }).translate(0, 0, -P.length / 2);
      break;
    }
    case 'surface': {
      const [X, Zs] = P.size;
      const n = segs(40);
      geo = new THREE.PlaneGeometry(X, Zs, n, n).rotateX(-Math.PI / 2).translate(X / 2, 0, Zs / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / X * 2 - 1, v = pos.getZ(i) / Zs * 2 - 1;
        const y = P.kind === 'wave' ? P.rise * Math.sin(u * Math.PI) * Math.cos(v * Math.PI / 2) : P.kind === 'saddle' ? P.rise * (u * u - v * v) : P.rise * u * v;
        pos.setY(i, y);
      }
      geo.computeVertexNormals();
      break;
    }
    default: geo = new THREE.BoxGeometry(1, 1, 1);
  }
  const mesh = new THREE.Mesh(geo, matFor(p.material, p.color, { ...opts, ...(p.opacity != null ? { opacity: p.opacity } : {}) }));
  mesh.applyMatrix4(new THREE.Matrix4().fromArray(p.matrix));
  mesh.castShadow = !/glass|water/.test(p.material || '');
  mesh.receiveShadow = true;
  if (p.name) mesh.name = p.name;
  if (P.corrugated && p.shape === 'mesh') mesh.material = matFor(p.material, p.color, { side: 'double' });
  return mesh;
}

/**
 * Builds the three.js group. Returns { group, labels: [{ text, position }] }.
 */
export function buildStructure(model) {
  const group = new THREE.Group();
  group.name = 'structure';

  // Members, instanced per section shape + material + colour.
  const buckets = new Map();
  for (const m of model.members) {
    const key = `${m.section.shape}|${m.material}|${m.color || ''}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }
  const tmp = new THREE.Matrix4(), S = new THREE.Matrix4(), T = new THREE.Matrix4();
  for (const [key, list] of buckets) {
    const [shape, mat, color] = key.split('|');
    const inst = new THREE.InstancedMesh(sectionGeometry(shape), matFor(mat, color || null), list.length);
    list.forEach((m, i) => {
      const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const R = orient(dir);
      S.makeScale(m.section.w, m.section.h, len);
      T.makeTranslation((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      tmp.copy(T).multiply(R).multiply(S);
      inst.setMatrixAt(i, tmp);
    });
    inst.castShadow = true; inst.receiveShadow = true;
    inst.userData.members = list.length;
    inst.computeBoundingSphere();
    inst.computeBoundingBox?.();
    group.add(inst);
  }

  // Joint nodes.
  const nodeBuckets = new Map();
  for (const nd of model.nodes) {
    const key = `${nd.material}|${nd.color || ''}`;
    if (!nodeBuckets.has(key)) nodeBuckets.set(key, []);
    nodeBuckets.get(key).push(nd);
  }
  for (const [key, list] of nodeBuckets) {
    const [mat, color] = key.split('|');
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), matFor(mat === 'paint' ? 'steel' : mat, color || null), list.length);
    list.forEach((nd, i) => { tmp.compose(new THREE.Vector3(...nd.p), new THREE.Quaternion(), new THREE.Vector3(nd.radius, nd.radius, nd.radius)); inst.setMatrixAt(i, tmp); });
    inst.castShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  for (const p of model.prims) {
    try { group.add(primMesh(p)); } catch { /* one bad primitive should not lose the model */ }
  }

  return { group, labels: model.labels.map(l => ({ text: l.text, position: new THREE.Vector3(...l.p) })) };
}

