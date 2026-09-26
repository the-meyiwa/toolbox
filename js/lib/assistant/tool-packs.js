/* ============================================================
   TOOLBOX — Assistant tool packs

   A tool pack is a self-contained set of Assistant tools: its
   declarations, one executor, and the tool group(s) that load
   them. Registering a pack is all a new area needs; the engine
   (ai-provider.js) picks the declarations up, routes the calls
   and loads the groups by keyword like any built-in group.

     registerToolPack({
       id: 'maps',
       declarations: [{ name: 'get_directions', description, parameters }],
       execute: async (name, args, ctx) => ({ status: 'success', message }),
       groups: { places: { tools: ['get_directions'], match: /\b(directions?)\b/i } },
     });

   A group that already exists gains the pack's tools (its label
   and keyword pattern are kept unless the pack gives new ones);
   a new group is added as is.
   ============================================================ */

import { addToolGroup } from './tool-groups.js';

const packs = new Map();
const owner = new Map();
let version = 0;

export function registerToolPack({ id, declarations = [], execute, groups = {} } = {}) {
  if (!id || typeof execute !== 'function') throw new Error('A tool pack needs an id and an execute function.');
  const prev = packs.get(id);
  if (prev) for (const d of prev.declarations) owner.delete(d.name);
  const pack = { id, declarations: declarations.filter(d => d?.name), execute };
  packs.set(id, pack);
  for (const d of pack.declarations) owner.set(d.name, pack);
  for (const [groupId, g] of Object.entries(groups)) addToolGroup(groupId, g);
  version++;
  return pack;
}

/** Bumps whenever a pack is (re)registered, so cached tool lists know to rebuild. */
export const packVersion = () => version;

export const packDeclarations = () => [...packs.values()].flatMap(p => p.declarations);

export const isPackTool = (name) => owner.has(name);

export async function executePackTool(name, args, ctx) {
  const pack = owner.get(name);
  return pack ? pack.execute(name, args || {}, ctx || {}) : undefined;
}
