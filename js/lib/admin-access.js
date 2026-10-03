/* ============================================================
   TOOLBOX — Private tools and Toolbox Admin access

   Some tools are private (`admin: true` in the registry). They show
   up only for the Toolbox owner and for the Toolbox users the owner
   has given them to in Toolbox Admin; for everyone else they do not
   exist (grid, search, Spotlight, the Assistant, links).

   The database decides (supabase/admin.sql): it checks the caller's
   own verified session for every admin read and every grant. What
   this module keeps is only the answer, so the right tools are on
   screen at once on the next visit.
   ============================================================ */

import { getCurrentUser, getSupabaseConfig, refreshUserSession, MADSELKIE_EMAILS } from './supabase.js';
import { setToolGate } from '../registry/index.js';

const KEY = 'toolbox_admin_access_v1';
const EMPTY = Object.freeze({ owner: false, tools: Object.freeze([]), userId: null });
let access = EMPTY;
let inflight = null;

export const isOwnerEmail = (email) => MADSELKIE_EMAILS.includes(String(email || '').toLowerCase().trim());

/** The owner, as far as this browser can tell. The database re-checks every admin action. */
export function isOwner(user = getCurrentUser()) {
  return !!user && (isOwnerEmail(user.email) || (access.userId === user.id && access.owner));
}

export function adminAccess() { return access; }

/** True when the signed-in person may open this private tool. */
export function canUseAdminTool(id) {
  const user = getCurrentUser();
  if (!user) return false;
  if (isOwner(user)) return true;
  if (id === 'toolbox-admin') return false;
  return access.userId === user.id && access.tools.includes(id);
}

function set(next) {
  const before = JSON.stringify(access);
  access = Object.freeze({ owner: !!next.owner, tools: Object.freeze([...new Set(next.tools || [])].sort()), userId: next.userId || null });
  try { if (access.userId) localStorage.setItem(KEY, JSON.stringify(access)); else localStorage.removeItem(KEY); } catch { /* storage off */ }
  if (JSON.stringify(access) !== before && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toolbox:admin-access', { detail: access }));
  }
}

function restore() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.userId === user.id) access = Object.freeze({ owner: !!saved.owner, tools: Object.freeze(saved.tools || []), userId: saved.userId });
  } catch { /* ignore */ }
}

export class AdminError extends Error {
  constructor(message, { status = 0, setup = false } = {}) { super(message); this.status = status; this.setup = setup; }
}

/** Calls one of the admin database functions as the signed-in person. */
export async function adminRpc(name, args = {}) {
  const { url, anonKey } = getSupabaseConfig();
  let user = getCurrentUser();
  if (!user?.token) throw new AdminError('Sign in to Toolbox first.', { status: 401 });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(args),
    });
    if (res.ok) return res.status === 204 ? null : res.json();
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && attempt === 0 && user.refreshToken) { user = (await refreshUserSession().catch(() => null)) || user; continue; }
    // PostgREST: the function does not exist yet.
    if (res.status === 404 || body.code === 'PGRST202' || body.code === '42883') {
      throw new AdminError('Toolbox Admin is not set up in the database yet. Run supabase/admin.sql in the Supabase SQL editor.', { status: 404, setup: true });
    }
    throw new AdminError(body.message || body.hint || `The database answered ${res.status}.`, { status: res.status });
  }
  throw new AdminError('Your session has expired. Sign in again.', { status: 401 });
}

/** Asks the database what this person may open. Safe to call often; one request at a time. */
export function refreshAdminAccess() {
  const user = getCurrentUser();
  if (!user) { set(EMPTY); return Promise.resolve(access); }
  if (inflight) return inflight;
  // The owner's own tools appear straight away; the database confirms (and adds grants) after.
  if (isOwnerEmail(user.email) && access.userId !== user.id) set({ owner: true, tools: [], userId: user.id });
  inflight = adminRpc('my_admin_access')
    .then((r) => { set({ owner: !!r?.owner || isOwnerEmail(user.email), tools: Array.isArray(r?.tools) ? r.tools : [], userId: user.id }); return access; })
    .catch(() => access)
    .finally(() => { inflight = null; });
  return inflight;
}

export function installAdminAccess() {
  restore();
  setToolGate(canUseAdminTool);
  if (typeof window === 'undefined') return;
  window.addEventListener('toolbox:authchange', () => { access = EMPTY; restore(); refreshAdminAccess(); window.dispatchEvent(new CustomEvent('toolbox:admin-access', { detail: access })); });
  // Access given or taken away while Toolbox is open shows up when the person comes back to it.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAdminAccess(); });
  refreshAdminAccess();
}
