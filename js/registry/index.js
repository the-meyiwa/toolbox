/* ============================================================
   Registry access layer.

   Everything that needs to know about tools goes through here, so the
   raw array is never walked ad hoc across the app.
   ============================================================ */

import { TOOLS } from './tools.js';
import { CATEGORIES, ALIASES, validateRegistry } from './schema.js';

export { TOOLS, CATEGORIES, ALIASES };

/** @type {Map<string, import('./schema.js').Tool>} */
export const BY_ID = new Map(TOOLS.map(t => [t.id, t]));

/** Category id → display label, for search scoring and headings. */
export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/** Categories in display order, each with the tools whose primary home it is. */
export function categorised(tools = TOOLS) {
  const byCat = new Map();
  for (const t of tools) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category).push(t);
  }
  return CATEGORIES
    .filter(c => byCat.has(c.id))
    .sort((a, b) => a.order - b.order)
    .map(c => ({
      ...c,
      // Heavier tools first so a category leads with what people use most.
      tools: byCat.get(c.id).sort((a, b) => (b.weight ?? 50) - (a.weight ?? 50) || a.name.localeCompare(b.name)),
    }));
}

/** Tools listing a category as primary or secondary. */
export function inCategory(categoryId) {
  return TOOLS.filter(t => t.category === categoryId || (t.secondary ?? []).includes(categoryId));
}

/** The most-used tools, for the home page shortcut row. */
export function popular(n = 8) {
  return [...TOOLS].sort((a, b) => (b.weight ?? 50) - (a.weight ?? 50)).slice(0, n);
}

/**
 * Resolve a URL hash to a live tool id, following retirements.
 * @returns {{id: string|null, redirected: boolean}}
 */
export function resolveId(rawId) {
  if (!rawId) return { id: null, redirected: false };
  if (BY_ID.has(rawId)) return { id: rawId, redirected: false };
  const target = ALIASES[rawId];
  if (target && BY_ID.has(target)) return { id: target, redirected: true };
  return { id: null, redirected: false };
}

/** Tools that never touch the network — the ones safe to use offline. */
export const OFFLINE_TOOLS = TOOLS.filter(t => t.offline !== false);

/* Structural problems surface loudly in dev and quietly in production:
   a malformed entry should never take the whole app down. */
const problems = validateRegistry(TOOLS);
if (problems.length) {
  const message = `Tool registry has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`;
  if (import.meta.env?.DEV) throw new Error(message);
  console.error(message);
}
