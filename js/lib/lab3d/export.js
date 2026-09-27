/* ============================================================
   3D Lab — exporters

   GLB / glTF (materials and textures, metres), OBJ (+ MTL colours),
   STL (binary, millimetres by default — what slicers expect), PLY
   (with vertex colours), USDZ (AR Quick Look on iPhone and iPad) and
   the scene JSON. PNG snapshots come from the viewer.
   ============================================================ */

import * as THREE from 'three';

export const FORMATS = [
  { id: 'glb', label: 'GLB', hint: 'Blender, Unity, Unreal, web, Windows 3D Viewer', mime: 'model/gltf-binary', ext: 'glb' },
  { id: 'gltf', label: 'glTF', hint: 'Text glTF with embedded buffers', mime: 'model/gltf+json', ext: 'gltf' },
  { id: 'obj', label: 'OBJ + MTL', hint: 'Almost every 3D app (zipped with its material file)', mime: 'application/zip', ext: 'zip' },
  { id: 'stl', label: 'STL', hint: '3D printing: binary, in millimetres', mime: 'model/stl', ext: 'stl' },
  { id: 'ply', label: 'PLY', hint: 'Meshes with vertex colours (MeshLab, CloudCompare)', mime: 'application/octet-stream', ext: 'ply' },
  { id: 'usdz', label: 'USDZ', hint: 'AR Quick Look on iPhone / iPad, Reality Composer', mime: 'model/vnd.usdz+zip', ext: 'usdz' },
];

export const slug = (s) => String(s || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'model';

/** A copy of `root` without helpers (gizmos, selection boxes), with transforms kept. */
function exportable(root) {
  const copy = root.clone(true);
  const drop = [];
  copy.traverse(o => { if (o.userData?.helper || o.isLight || o.isCamera || o.type?.endsWith('Helper')) drop.push(o); });
  for (const o of drop) o.parent?.remove(o);
  copy.updateMatrixWorld(true);
  return copy;
}

/** Bakes world transforms into cloned geometry (for formats that ignore the node tree). */
function bakedMeshes(root, scale = 1) {
  const out = new THREE.Group();
  root.updateMatrixWorld(true);
  const S = new THREE.Matrix4().makeScale(scale, scale, scale);
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(S, o.matrixWorld));
    const m = new THREE.Mesh(g, Array.isArray(o.material) ? o.material[0] : o.material);
    m.name = o.name || o.parent?.name || 'part';
    out.add(m);
  });
  return out;
}

function mtlFor(group) {
  const seen = new Map();
  let i = 0;
  group.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!seen.has(m)) seen.set(m, `mat_${i++}_${slug(m.name || 'material')}`);
    o.material = m.clone();
    o.material.name = seen.get(m);
  });
  const lines = ['# Toolbox 3D Lab'];
  for (const [m, name] of seen) {
    const c = m.color || new THREE.Color(0xcccccc);
    lines.push(`newmtl ${name}`, `Kd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}`, `Ks ${(m.metalness ?? 0).toFixed(3)} ${(m.metalness ?? 0).toFixed(3)} ${(m.metalness ?? 0).toFixed(3)}`, `Ns ${Math.round((1 - (m.roughness ?? 0.5)) * 900 + 10)}`, `d ${(m.transparent ? m.opacity : 1).toFixed(3)}`, 'illum 2', '');
  }
  return lines.join('\n');
}

/** Vertex colours from each mesh's material, for PLY viewers. */
function addVertexColors(group) {
  group.traverse(o => {
    if (!o.isMesh) return;
    const c = o.material?.color || new THREE.Color(0xcccccc);
    const n = o.geometry.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  });
}

/** Exports `root` as `format`. Returns { blob, filename }. */
export async function exportObject(root, format, { name = 'model', stlUnits = 'mm' } = {}) {
  const base = slug(name);
  const obj = exportable(root);
  switch (format) {
    case 'glb': case 'gltf': {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const out = await new GLTFExporter().parseAsync(obj, { binary: format === 'glb', onlyVisible: true, maxTextureSize: 2048 });
      return format === 'glb'
        ? { blob: new Blob([out], { type: 'model/gltf-binary' }), filename: `${base}.glb` }
        : { blob: new Blob([JSON.stringify(out)], { type: 'model/gltf+json' }), filename: `${base}.gltf` };
    }
    case 'obj': {
      const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
      const baked = bakedMeshes(obj);
      const mtl = mtlFor(baked);
      let text = new OBJExporter().parse(baked);
      // OBJExporter writes "usemtl <name>" per mesh; point the file at its MTL.
      text = `# Toolbox 3D Lab\nmtllib ${base}.mtl\n${text}`;
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      zip.file(`${base}.obj`, text);
      zip.file(`${base}.mtl`, mtl);
      return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), filename: `${base}-obj.zip` };
    }
    case 'stl': {
      const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
      const k = stlUnits === 'm' ? 1 : stlUnits === 'cm' ? 100 : 1000;
      const data = new STLExporter().parse(bakedMeshes(obj, k), { binary: true });
      return { blob: new Blob([data], { type: 'model/stl' }), filename: `${base}.stl` };
    }
    case 'ply': {
      const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');
      const baked = bakedMeshes(obj);
      addVertexColors(baked);
      const data = await new Promise((resolve) => new PLYExporter().parse(baked, resolve, { binary: true }));
      return { blob: new Blob([data], { type: 'application/octet-stream' }), filename: `${base}.ply` };
    }
    case 'usdz': {
      const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
      const data = await new USDZExporter().parseAsync(obj, { quickLookCompatible: true });
      return { blob: new Blob([data], { type: 'model/vnd.usdz+zip' }), filename: `${base}.usdz` };
    }
    default: throw new Error(`Unknown export format "${format}".`);
  }
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
