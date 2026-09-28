/**
 * Shared shape of per-package reference data: component families matched by
 * id, turned into manifest component entries with their sources.
 */

export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "…_left" / "…_right" (and front/rear, inboard/outboard) as words. */
export function sideOf(id) {
  const m = id.match(/_(left|right)$/);
  return m ? m[1] : null;
}

/**
 * families: [{ test: RegExp, data: (id, m) => ({ label, category, layer, description, location, specs?, maintenance?, failures?, accuracyNote?, sources? }) }]
 * First match wins. Returns describe(id) → manifest component.
 */
export function makeDescriber({ families, sources, defaultSources, accuracyNote }) {
  return function describe(id) {
    const family = families.find(f => f.test.test(id));
    if (!family) throw new Error(`No reference metadata for component ${id}`);
    const d = family.data(id, id.match(family.test));
    const keys = [...new Set([...(d.sources || []), ...defaultSources])];
    for (const k of keys) if (!sources[k]) throw new Error(`Unknown source ${k} for ${id}`);
    const out = {
      id, label: d.label, category: d.category, layer: d.layer, availability: 'available',
      description: d.description, location: d.location,
      ...(d.parentAssembly ? { parentAssembly: d.parentAssembly } : {}),
      ...(d.specs ? { specs: Object.fromEntries(Object.entries(d.specs).filter(([, v]) => v)) } : {}),
      ...(d.maintenance ? { maintenance: d.maintenance } : {}),
      ...(d.failures ? { failures: d.failures } : {}),
      accuracyNote: d.accuracyNote || accuracyNote,
      sources: keys.map(k => sources[k])
    };
    if (out.specs && !Object.keys(out.specs).length) delete out.specs;
    for (const f of ['label', 'category', 'layer', 'description', 'location']) if (!out[f]) throw new Error(`${id} is missing ${f}`);
    return out;
  };
}

/** Grouped spec sheet: groups [{ title, rows: [[label, value]] }]. */
export function makeSheet({ vehicle, generation, groups, sources, sourceKeys, disclaimer }) {
  return {
    schemaVersion: 1, vehicle, generation,
    groups: groups.map(g => ({ ...g, rows: g.rows.filter(([, v]) => v) })),
    sources: sourceKeys.map(k => { if (!sources[k]) throw new Error(`Unknown source ${k}`); return sources[k]; }),
    disclaimer
  };
}
