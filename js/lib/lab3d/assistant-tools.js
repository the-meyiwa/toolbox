/* ============================================================
   3D Lab — Assistant tools

   create_3d_object  builds objects for the chat card (and the 3D Lab):
                     library models by name, shapes, objects composed
                     from shapes or a custom mesh, and online models.
   search_3d_models  searches the free online sources.
   ============================================================ */

import { MODEL_INDEX, SHAPE_INDEX } from './library-index.js';

const MATERIAL_NAMES = 'plastic, matte-plastic, glossy-plastic, polymer, rubber, metal, steel, brushed-steel, gunmetal, aluminium, anodized, titanium, chrome, gold, copper, brass, glass, tinted-glass, frosted-glass, screen, lens, ceramic, porcelain, wood, walnut, oak, fabric, velvet, leather, mesh, knurled, paint, car-paint, marble, concrete, stone, foliage, bark, paper, wax, emissive, light';
const shapeList = () => SHAPE_INDEX.map(([id, params]) => `${id} {${params.join(', ')}}`).join('; ');
const modelList = () => Object.entries(MODEL_INDEX).map(([cat, ids]) => `${cat}: ${ids.join(', ')}`).join(' | ');

export const LAB3D_TOOL_DECLARATIONS = [
  {
    name: 'create_3d_object',
    description: `Create and show 3D objects the person can orbit, recolour, export (GLB, OBJ, STL, PLY, USDZ, PNG) and open in the 3D Lab. Use it for products, gadgets, furniture, props, vehicles, sport items and mathematical shapes (buildings, bridges and trusses use model_3d).
Library models (real size, detailed; pass their options in params): ${modelList()}.
Model options: colours accept names or #hex (iphone colours: "cosmic orange", "deep blue", "silver"…); office-chair {color, frame: black|white|grey, base: nylon|aluminium, headrest, arms}; ak-47 {furniture: wood|plum|black|fde, magazine: steel|bakelite|polymer}; mp5 {stock: fixed|collapsing, furniture: black|fde}; laptop {color, angle}; monitor {size in inches}; sofa {seats, material, color}.
The simplest call is {request: "an iPhone 17 Pro in deep blue and an office chair"}; it picks the models and options itself.
For something not in the library, compose it in items from shapes — ${shapeList()} — each with at [x,y,z] metres (y up; each shape rests on y = 0 at its own position, so add the height to stack), rotate [deg], scale, material (${MATERIAL_NAMES}) and color; or a custom mesh {type:"custom", vertices, faces}; or an online model from search_3d_models {type:"online", source, id}. Use real proportions.`,
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'What to create, in words, e.g. "AK-47 with a bakelite magazine" or "red torus knot and a klein bottle". Resolved against the library.' },
        items: { type: 'array', description: 'Explicit items: {model, params} | {shape, params, material, color} | {type:"online", source, id} | {type:"custom", vertices, faces} | {prompt}; each may take at, rotate, scale, name.', items: { type: 'object' } },
        title: { type: 'string' },
      },
    },
  },
  {
    name: 'search_3d_models',
    description: 'Search free downloadable 3D models online (Khronos glTF samples; Poly Haven CC0 furniture, props and plants). Returns ids to pass to create_3d_object as {type:"online", source, id}. Use when the library has no match and composing from shapes would look poor.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to look for, e.g. "armchair", "lantern", "helmet".' } }, required: ['query'] },
  },
];

export const LAB3D_TOOL_NAMES = new Set(LAB3D_TOOL_DECLARATIONS.map(d => d.name));

function splitRequest(text, resolveObject) {
  const q = String(text || '').trim();
  const parts = q.split(/\s*(?:,|;|\+|\band\b|\bplus\b|\balongside\b)\s*/i).filter(p => p.trim().length > 1);
  const whole = resolveObject(q);
  if (parts.length > 1) {
    const each = parts.map(p => ({ text: p, hit: resolveObject(p) }));
    if (each.every(x => x.hit)) return each;
  }
  return [{ text: q, hit: whole }];
}

const r3 = (n) => Math.round(n * 1000) / 1000;

export async function create3dObject(args = {}) {
  const [{ normalizeSpec, buildItem, sizeOf, titleFor, labelFor }, { resolveObject }] = await Promise.all([import('./scene.js'), import('./catalog.js')]);
  let raw = Array.isArray(args.items) && args.items.length ? args.items : null;
  const missing = [];
  if (!raw && args.request) {
    raw = [];
    for (const p of splitRequest(args.request, resolveObject)) {
      if (p.hit) raw.push({ type: p.hit.kind, [p.hit.kind]: p.hit.id, params: p.hit.params });
      else missing.push(p.text);
    }
  }
  if (!raw?.length) {
    return {
      status: 'not_found',
      message: `"${missing.join(', ') || args.request || ''}" is not in the 3D library. Build it with create_3d_object items composed from shapes (cube, cylinder, sphere, capsule, torus, cone, rounded-box, prism, lathe-like vase, tube…) at real proportions, a custom mesh, or search_3d_models for a free online model. Library: ${Object.values(MODEL_INDEX).flat().join(', ')}.`,
    };
  }
  const spec = normalizeSpec({ title: args.title, items: raw });
  if (!spec.items.length) return { status: 'error', message: `Nothing could be built: ${spec.warnings.join(' ')}` };
  const objects = [];
  const warnings = [...spec.warnings];
  for (const item of spec.items) {
    if (item.type === 'online') { objects.push({ name: labelFor(item), kind: 'online', source: item.source, id: item.id }); continue; }
    try {
      const o = await buildItem(item);
      const s = sizeOf(o);
      let tris = 0;
      o.traverse(m => { if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
      objects.push({ name: labelFor(item), kind: item.type, id: item.model || item.shape, params: item.params, size_m: { width: r3(s.x), height: r3(s.y), depth: r3(s.z) }, triangles: Math.round(tris) });
      o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); for (const mm of [].concat(m.material)) mm?.dispose?.(); } });
    } catch (err) { warnings.push(`${labelFor(item)}: ${err.message}`); }
  }
  const title = args.title || spec.title || titleFor(spec.items);
  const list = objects.map(o => `${o.name}${o.size_m ? ` (${Math.round(o.size_m.width * 1000)} × ${Math.round(o.size_m.height * 1000)} × ${Math.round(o.size_m.depth * 1000)} mm)` : ''}`).join('; ');
  return {
    status: 'success', renderer: 'lab3d-object', type: 'lab3d-object', title,
    spec: { title, environment: spec.environment, items: spec.items },
    objects, warnings, not_found: missing,
    message: `Shown in a 3D card the person can orbit, recolour, export (GLB, OBJ, STL, PLY, USDZ) and open in the 3D Lab: ${list}.${missing.length ? ` Not in the library: ${missing.join(', ')} — offer to compose it from shapes or search_3d_models.` : ''}${warnings.length ? ` Notes: ${warnings.join(' ')}` : ''} Describe what you made in a sentence; mention they can export or open it in the 3D Lab. Don't list these numbers unless asked.`,
  };
}

export async function search3dModels(args = {}) {
  const { searchOnline } = await import('./online.js');
  const q = String(args.query || '').trim();
  if (!q) return { status: 'error', message: 'Say what to search for.' };
  try {
    const { results, errors } = await searchOnline(q, { limit: 10 });
    return {
      status: results.length ? 'success' : 'not_found', query: q,
      results: results.map(r => ({ source: r.source, id: r.id, name: r.name, license: r.license, page: r.page })),
      unreachable: errors.map(e => e.source),
      message: results.length
        ? `Found ${results.length}. To show one: create_3d_object with items [{type:"online", source, id}]. Credit the source; Poly Haven is CC0.`
        : `No free online model matches "${q}". Compose it from shapes with create_3d_object instead.`,
    };
  } catch (err) {
    return { status: 'error', message: `Online model search failed: ${err.message}` };
  }
}

export { MATERIAL_NAMES };
