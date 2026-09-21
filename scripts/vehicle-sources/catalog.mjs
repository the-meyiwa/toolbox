/** Upsert vehicle entries into public/automobile/catalog.json with a stable order. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ORDER = ['toyota-corolla-2014-2016', 'toyota-corolla-2013'];

export function mergeCatalog(catalog, entries) {
  const ids = new Set(entries.map(entry => entry.id));
  const vehicles = [...entries, ...catalog.vehicles.filter(vehicle => !ids.has(vehicle.id))];
  const rank = id => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  vehicles.sort((a, b) => rank(a.id) - rank(b.id));
  return { ...catalog, defaultVehicleId: ORDER[0], vehicles };
}

export async function updateCatalog(root, entries, { write = true } = {}) {
  const file = path.join(root, 'public/automobile/catalog.json');
  const next = mergeCatalog(JSON.parse(await readFile(file, 'utf8')), entries);
  const text = JSON.stringify(next, null, 2) + '\n';
  if (write) await writeFile(file, text);
  return { file, text };
}
