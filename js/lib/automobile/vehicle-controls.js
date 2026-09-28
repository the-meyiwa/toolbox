/* ============================================================
   Controls libraries by vehicle, for the Vehicle Guide's Exterior
   and Interior (flight deck / cockpit) modes and the Assistant's
   "One of these?" answers.
   ============================================================ */

import * as corolla from './corolla-controls.js';
import * as gx470 from './gx470-controls.js';
import * as b737 from './b737-controls.js';
import * as c172 from './c172-controls.js';

const LIBRARIES = [corolla, gx470, b737, c172];

const NONE = { vehicleId: null, clusters: [], byId: {}, find: () => null, hints: {}, spaces: {}, note: '' };

/** The controls library for a package id (empty for packages without one). */
export function controlsFor(vehicleId) {
  const lib = LIBRARIES.find(l => l.VEHICLE_ID === vehicleId);
  if (!lib) return { ...NONE, vehicleId };
  return { vehicleId, clusters: lib.CLUSTERS, byId: lib.CLUSTER, find: lib.findControls, hints: lib.HINTS || {}, spaces: lib.SPACES || {}, note: lib.OPERATING_NOTE || '' };
}

export const CONTROL_VEHICLES = LIBRARIES.map(l => l.VEHICLE_ID);

/** Package id named by free text ("my GX 470", "737 flight deck", "Cessna"); null when none is named. */
export function vehicleFromText(text) {
  const q = String(text || '').toLowerCase();
  if (/\b(737|b73[78]|boeing|airliner)\b/.test(q)) return 'boeing-737-800';
  if (/\b(cessna|c?172s?|skyhawk)\b/.test(q)) return 'cessna-172s';
  if (/\b(lexus|gx ?470|gx|uzj120|land cruiser prado)\b/.test(q)) return 'lexus-gx-470-2008';
  if (/\b(corolla|toyota)\b/.test(q)) return 'toyota-corolla-2014-2016';
  return null;
}
