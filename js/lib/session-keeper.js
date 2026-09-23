/* ============================================================
   TOOLBOX — Session keeper

   Supabase access tokens last an hour. The app keeps the token
   in localStorage and many modules read it directly, so an open
   tab (or one woken from sleep) used to send expired tokens and
   get "JWT expired" back — in Messages, avatar saves, Mail and
   the Assistant.

   This module:
   - refreshes the token a few minutes before it expires, on a
     timer and whenever the tab becomes visible again;
   - wraps fetch so any request carrying the stored token is sent
     with a fresh one, and retried once after a refresh if the
     server still answers 401 / "JWT expired".
   ============================================================ */

import { getCurrentUser, refreshUserSession } from './supabase.js';

const EARLY_MS = 5 * 60_000;      // refresh this long before expiry
let inflight = null;

function expiryOf(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return 0;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return (json.exp || 0) * 1000;
  } catch { return 0; }
}

const isJwt = (t) => typeof t === 'string' && t.split('.').length === 3;

/** Returns a user whose token is valid for at least a few minutes (refreshing if needed). */
export async function ensureFreshSession({ force = false } = {}) {
  const user = getCurrentUser();
  if (!user?.token || !isJwt(user.token) || !user.refreshToken) return user;
  const exp = expiryOf(user.token);
  if (!force && exp && exp - Date.now() > EARLY_MS) return user;
  if (!inflight) {
    const before = user.token;
    inflight = (async () => {
      // Another tab may have refreshed already (refresh tokens rotate; reusing one can end the session).
      const latest = getCurrentUser();
      if (latest?.token && latest.token !== before && expiryOf(latest.token) - Date.now() > EARLY_MS) return latest;
      return refreshUserSession();
    })().finally(() => { setTimeout(() => { inflight = null; }, 0); });
  }
  return inflight;
}

export function currentToken() {
  return getCurrentUser()?.token || '';
}

function tokenFromHeaders(headers) {
  const h = headers instanceof Headers ? headers.get('Authorization') : headers?.Authorization || headers?.authorization;
  const m = /^Bearer\s+(.+)$/.exec(h || '');
  return m ? m[1] : '';
}

function withToken(input, init, token) {
  if (input instanceof Request && !init?.headers) {
    const req = new Request(input, init);
    req.headers.set('Authorization', `Bearer ${token}`);
    return [req, undefined];
  }
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('Authorization', `Bearer ${token}`);
  return [input, { ...(init || {}), headers }];
}

let installed = false;

export function installSessionKeeper() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const user = getCurrentUser();
    const stored = user?.token;
    const sent = tokenFromHeaders(init?.headers || (input instanceof Request ? input.headers : null));
    // Only requests that carry this user's session token are touched.
    if (!stored || !sent || sent !== stored || !isJwt(stored) || !user.refreshToken) return nativeFetch(input, init);

    const url = String(input instanceof Request ? input.url : input);
    const isRefreshCall = url.includes('/auth/v1/token');
    if (isRefreshCall) return nativeFetch(input, init);

    let body = init?.body;
    const replayable = body == null || typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams || body instanceof ArrayBuffer;

    let fresh = await ensureFreshSession();
    let [i, o] = fresh?.token && fresh.token !== sent ? withToken(input, init, fresh.token) : [input, init];
    const res = await nativeFetch(i, o);
    if (res.status !== 401 || !replayable || input instanceof Request) return res;

    const text = await res.clone().text().catch(() => '');
    if (!/jwt|expired|token|unauthori[sz]ed|invalid claim/i.test(text)) return res;
    fresh = await ensureFreshSession({ force: true });
    if (!fresh?.token || fresh.token === (o?.headers ? tokenFromHeaders(o.headers) : sent)) return res;
    [i, o] = withToken(input, init, fresh.token);
    return nativeFetch(i, o);
  };

  const tick = () => { ensureFreshSession().catch(() => {}); };
  setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  tick();
}

