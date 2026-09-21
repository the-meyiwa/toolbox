/** Shared helpers for the Corolla generator modules. */
import { mirrorZ } from './geometry.mjs';

export const SIDES = [
  { key: 'right', s: 1, short: 'r', label: 'Right' },
  { key: 'left', s: -1, short: 'l', label: 'Left' }
];
export const deg = d => d * Math.PI / 180;
/** Geometry authored on the right (+Z) side, mirrored for the left. */
export const handed = (g, s) => (s > 0 ? g : mirrorZ(g));
