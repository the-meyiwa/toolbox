/* ============================================================
   3D Lab — online models and file import

   Two free, keyless sources the browser can load directly (both send
   CORS headers):
   - Khronos glTF Sample Assets (GitHub): ~40 showcase models — sofas,
     chairs, lamps, a car, a chess set, helmets, a camera, a watch.
     Licences vary per model (mostly CC BY 4.0 / CC0); each result
     links its folder, which carries the licence.
   - Poly Haven: hundreds of CC0 scanned and modelled props, furniture
     and plants.
   Local files: GLB, glTF (embedded), OBJ, STL, PLY, FBX, 3MF, DAE, USDZ.
   ============================================================ */

import * as THREE from 'three';

const KHRONOS_BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
const KHRONOS_PAGE = 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models';
const POLY_API = 'https://api.polyhaven.com';

export const SOURCES = {
  khronos: { name: 'Khronos glTF samples', license: 'See the model folder (mostly CC BY 4.0 or CC0)', home: KHRONOS_PAGE },
  polyhaven: { name: 'Poly Haven', license: 'CC0 (public domain)', home: 'https://polyhaven.com/models' },
};

const memo = new Map();
async function cachedJson(key, url, { signal } = {}) {
  if (memo.has(key)) return memo.get(key);
  try {
    const raw = sessionStorage.getItem(`lab3d:${key}`);
    if (raw) { const v = JSON.parse(raw); memo.set(key, v); return v; }
  } catch { /* storage unavailable */ }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  const v = await res.json();
  memo.set(key, v);
  try { sessionStorage.setItem(`lab3d:${key}`, JSON.stringify(v)); } catch { /* quota */ }
  return v;
}

const words = (s) => String(s || '').toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^a-z0-9]+/).filter(Boolean);
function score(query, fields) {
  const q = words(query);
  if (!q.length) return 1;
  const hay = fields.flatMap(words);
  let s = 0;
  for (const t of q) {
    if (hay.includes(t)) s += 3;
    else if (hay.some(h => h.startsWith(t) || (t.length > 3 && h.includes(t)))) s += 1.5;
    else if (t.endsWith('s') && hay.includes(t.slice(0, -1))) s += 2.5;
    else return 0;
  }
  return s;
}

async function searchKhronos(query, opts) {
  const index = await cachedJson('khronos', `${KHRONOS_BASE}/model-index.json`, opts);
  const out = [];
  for (const m of index) {
    const test = (m.tags || []).some(t => /test/.test(t));
    const s = score(query, [m.name, m.label, ...(m.tags || [])]);
    if (!s || (test && !query)) continue;
    const variant = m.variants?.['glTF-Binary'] ? 'glTF-Binary' : m.variants?.glTF ? 'glTF' : null;
    if (!variant) continue;
    out.push({
      source: 'khronos', id: m.name, name: m.label || m.name, score: s - (test ? 2 : 0),
      thumb: m.screenshot ? `${KHRONOS_BASE}/${m.name}/${m.screenshot}` : null,
      url: `${KHRONOS_BASE}/${m.name}/${variant}/${m.variants[variant]}`,
      page: `${KHRONOS_PAGE}/${m.name}`, license: SOURCES.khronos.license,
    });
  }
  return out;
}

async function searchPolyHaven(query, opts) {
  const all = await cachedJson('polyhaven', `${POLY_API}/assets?t=models`, opts);
  const out = [];
  for (const [id, a] of Object.entries(all)) {
    const s = score(query, [id, a.name, ...(a.categories || []), ...(a.tags || [])]);
    if (!s) continue;
    out.push({
      source: 'polyhaven', id, name: a.name || id, score: s + Math.min(1, (a.download_count || 0) / 50000),
      thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=256`,
      page: `https://polyhaven.com/a/${id}`, license: SOURCES.polyhaven.license,
    });
  }
  return out;
}

/** Searches every source; a source that fails (offline, blocked) is reported, not thrown. */
export async function searchOnline(query, { signal, limit = 40 } = {}) {
  const tasks = [['khronos', searchKhronos], ['polyhaven', searchPolyHaven]];
  const settled = await Promise.allSettled(tasks.map(([, fn]) => fn(query, { signal })));
  const results = [], errors = [];
  settled.forEach((r, i) => (r.status === 'fulfilled' ? results.push(...r.value) : errors.push({ source: tasks[i][0], message: r.reason?.message || 'unreachable' })));
  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { results: results.slice(0, limit), errors };
}

async function polyHavenUrl(id) {
  const files = await cachedJson(`ph:${id}`, `${POLY_API}/files/${encodeURIComponent(id)}`);
  const gltf = files.gltf || {};
  const res = gltf['1k'] || gltf['2k'] || Object.values(gltf)[0];
  const url = res?.gltf?.url;
  if (!url) throw new Error('Poly Haven has no glTF for this model.');
  return url;
}

const loaded = new Map();

/** Loads an online item { source, id, url? } into a THREE.Group (downloads are reused this session). */
export async function loadOnline(item) {
  const key = item.url || `${item.source}:${item.id}`;
  if (!loaded.has(key)) {
    loaded.set(key, (async () => {
      const url = item.url || (item.source === 'polyhaven' ? await polyHavenUrl(item.id) : null);
      if (!url) throw new Error('No download address for this model.');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error('The model file has no scene.');
      return root;
    })().catch((err) => { loaded.delete(key); throw err; }));
  }
  const root = await loaded.get(key);
  const copy = root.clone(true);
  copy.userData.shared = true;
  return prepareImported(copy);
}

/** Loads a local file into a THREE.Group. */
export async function loadFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const buf = await file.arrayBuffer();
  const text = () => new TextDecoder().decode(buf);
  let root;
  switch (ext) {
    case 'glb': case 'gltf': {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().parseAsync(ext === 'glb' ? buf : text(), '');
      root = gltf.scene;
      break;
    }
    case 'obj': { const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js'); root = new OBJLoader().parse(text()); break; }
    case 'stl': { const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js'); root = meshFromGeometry(new STLLoader().parse(buf)); break; }
    case 'ply': { const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js'); root = meshFromGeometry(new PLYLoader().parse(buf)); break; }
    case 'fbx': { const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js'); root = new FBXLoader().parse(buf, ''); break; }
    case '3mf': { const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js'); root = new ThreeMFLoader().parse(buf); break; }
    case 'dae': { const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js'); root = new ColladaLoader().parse(text(), '').scene; break; }
    case 'usdz': case 'usda': case 'usdc': case 'usd': { const { USDLoader } = await import('three/examples/jsm/loaders/USDLoader.js'); root = new USDLoader().parse(buf); break; }
    default: throw new Error(`.${ext} files are not supported. Use GLB, glTF, OBJ, STL, PLY, FBX, 3MF, DAE or USDZ.`);
  }
  const { object, note } = normaliseScale(prepareImported(root), ext);
  return { object, note };
}

function meshFromGeometry(geo) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: geo.attributes.color ? 0xffffff : 0xb8bcc2, vertexColors: !!geo.attributes.color, roughness: 0.55, metalness: 0.1 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, m));
  return g;
}

function prepareImported(root) {
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g = new THREE.Group();
  g.add(root);
  return g;
}

/** Files drawn in millimetres or centimetres come in huge; bring them to metres. */
function normaliseScale(obj, ext) {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max === 0) return { object: obj, note: null };
  if (max > 60) {
    const unit = max > 6000 ? 1000 : 100;
    obj.scale.multiplyScalar(1 / unit);
    return { object: obj, note: `Scaled from ${unit === 1000 ? 'millimetres' : 'centimetres'} to metres (${ext.toUpperCase()} files carry no units).` };
  }
  return { object: obj, note: null };
}
