import crypto from 'node:crypto';

export const ASSISTANT_QUOTA_LIMITS = Object.freeze({
  daily: 50, burst: 10, burstWindowMs: 60_000,
  requestsDaily: 400, requestsPerMinute: 40,
  turnWindowMs: 30 * 60_000, maxStepsPerTurn: 32, reservationMs: 15 * 60_000,
});

export function assistantTurnKey(payload) {
  const id = typeof payload.turnId === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(payload.turnId) ? payload.turnId : null;
  // Old assistant/tool messages are history. The latest user message identifies this task.
  const lastUser = [...payload.messages].reverse().find(message => message?.role === 'user');
  return id ? `${id}:${crypto.createHash('sha256').update(JSON.stringify(lastUser?.content ?? '')).digest('hex')}` : null;
}

/** Local development/test store. Authenticated deployments always use PostgreSQL. */
export function createMemoryAssistantQuotaStore() {
  const usage = new Map();
  const limits = ASSISTANT_QUOTA_LIMITS;
  const unlimited = user => ['meyigbenee@gmail.com', 'meyigbenee@icloud.com'].includes(String(user.email || '').toLowerCase());
  function settle(state, receipt, success) {
    if (!receipt || receipt.status === 'failed' || success && receipt.status !== 'pending') return false;
    if (success) { receipt.status = 'succeeded'; return true; }
    receipt.status = 'failed';
    const turn = state.turns.get(receipt.turnId);
    if (turn && --turn.steps === 0 && turn.counted) {
      turn.counted = false;
      if (turn.day === state.day) state.count = Math.max(0, state.count - 1);
    }
    // Work limits include failed attempts: repeatedly provoking errors must not bypass them.
    return true;
  }
  function stateFor(user, now) {
    const day = new Date(now).toISOString().slice(0, 10);
    let state = usage.get(user.id);
    if (!state) { state = { day, count: 0, requests: 0, turns: new Map(), receipts: new Map() }; usage.set(user.id, state); }
    if (state.day !== day) { state.day = day; state.count = 0; state.requests = 0; }
    for (const [id, receipt] of state.receipts) {
      if (receipt.status === 'pending' && now - receipt.at >= limits.reservationMs) settle(state, receipt, false);
      if (now - receipt.at > 2 * 86_400_000) state.receipts.delete(id);
    }
    for (const [id, turn] of state.turns) if (now - turn.lastAt > 2 * 86_400_000) state.turns.delete(id);
    return state;
  }
  function summary(user, now = Date.now()) {
    const state = stateFor(user, now);
    const free = unlimited(user);
    const recent = [...state.turns.values()].filter(turn => turn.counted && now - turn.at < limits.burstWindowMs);
    return {
      isUnlimited: free, messagesUsed: state.count, messagesLimit: free ? null : limits.daily,
      messagesRemaining: free ? null : Math.max(0, limits.daily - state.count),
      burstRemaining: free ? null : Math.max(0, limits.burst - recent.length),
      requestsUsed: state.requests, requestsRemaining: free ? null : Math.max(0, limits.requestsDaily - state.requests),
      resetsAt: new Date(Date.parse(state.day + 'T00:00:00Z') + 86_400_000).toISOString(), storage: 'development',
    };
  }
  return {
    summary,
    reserve(user, payload, now = Date.now()) {
      const state = stateFor(user, now);
      const free = unlimited(user);
      const key = assistantTurnKey(payload);
      const turns = [...state.turns.values()];
      const previous = key && turns.find(turn => turn.key === key && turn.day === state.day && turn.counted && now - turn.lastAt < limits.turnWindowMs);
      const recent = turns.filter(turn => turn.counted && now - turn.at < limits.burstWindowMs);
      const requests = [...state.receipts.values()].filter(receipt => now - receipt.at < limits.burstWindowMs);
      const untilMidnight = Math.ceil((Date.parse(state.day + 'T00:00:00Z') + 86_400_000 - now) / 1000);
      const denied = (reason, retryAfter = 0) => ({ allowed: false, status: 429, reason, retryAfter });
      if (!free && state.requests >= limits.requestsDaily) return denied('Daily Assistant work limit reached. It resets at midnight UTC.', untilMidnight);
      if (!free && requests.length >= limits.requestsPerMinute) return denied('The Assistant is handling too many steps. Please wait a minute and try again.', Math.ceil((Math.min(...requests.map(r => r.at)) + limits.burstWindowMs - now) / 1000));
      // The owner has no limits at all; for everyone else one task cannot run forever on one charge.
      if (!free && previous && previous.steps >= limits.maxStepsPerTurn) return denied('This Assistant task has used its available steps. Start a new message.');
      if (!previous && !free && state.count >= limits.daily) return denied('Daily Assistant message limit reached. It resets at midnight UTC.', untilMidnight);
      if (!previous && !free && recent.length >= limits.burst) return denied('Too many Assistant messages in one minute. Please wait and try again.', Math.ceil((Math.min(...recent.map(t => t.at)) + limits.burstWindowMs - now) / 1000));
      const turn = previous || { id: crypto.randomUUID(), day: state.day, key, at: now, lastAt: now, steps: 0, counted: true };
      if (!previous) { state.turns.set(turn.id, turn); state.count++; }
      turn.steps++; turn.lastAt = now; state.requests++;
      const receipt = { reservationId: crypto.randomUUID(), turnId: turn.id, at: now, status: 'pending', charged: !previous };
      state.receipts.set(receipt.reservationId, receipt);
      return { allowed: true, charged: receipt.charged, reservationId: receipt.reservationId, summary: summary(user, now) };
    },
    release(user, reservation, now = Date.now()) { const state = stateFor(user, now); return settle(state, state.receipts.get(reservation?.reservationId), false); },
    commit(user, reservation, now = Date.now()) { const state = stateFor(user, now); return settle(state, state.receipts.get(reservation?.reservationId), true); },
    clear() { usage.clear(); },
  };
}

export class AssistantQuotaError extends Error {
  constructor(message = 'Assistant usage could not be checked. Please try again shortly.', status = 503) { super(message); this.status = status; }
}

/** Each client uses the existing verified session. The database chooses the user, clock and limits. */
export function createSharedAssistantQuotaStore({ env = process.env, authorization, fetcher = (...args) => fetch(...args) } = {}) {
  const clean = value => String(value || '').trim().replace(/^["']|["']$/g, '');
  const url = clean(env.SUPABASE_URL || env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const key = clean(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  async function rpc(name, body, authenticated = true) {
    if (!url || !key || authenticated && !/^Bearer [\w.-]+$/.test(authorization || '')) throw new AssistantQuotaError();
    // The same reservation id is retried after an ambiguous timeout; SQL reserves/refunds once.
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await fetcher(`${url}/rest/v1/rpc/${name}`, {
          method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(authenticated ? { Authorization: authorization } : {}) },
          body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
        });
      } catch { if (attempt === 0) continue; throw new AssistantQuotaError(); }
      if (response.ok) { try { return await response.json(); } catch { if (attempt === 0) continue; throw new AssistantQuotaError(); } }
      await response.body?.cancel?.().catch(() => {});
      if (response.status >= 500 && attempt === 0) continue;
      if (response.status === 401 && authenticated) throw new AssistantQuotaError('Your Toolbox session expired. Sign in again.', 401);
      if (response.status === 404) console.warn('[assistant-quota] Apply supabase/assistant-quotas.sql to the configured Supabase project.');
      // No fallback to instance-local quotas when the shared database is unavailable.
      throw new AssistantQuotaError();
    }
  }
  async function settle(reservation, success) {
    if (!reservation?.allowed || !reservation.reservationId) return false;
    try {
      // A private, random capability settles this exact reservation even if the JWT expires
      // during a long reply. It is never included in the browser response or logs.
      return (await rpc('toolbox_assistant_quota_settle', { p_reservation_id: reservation.reservationId, p_success: success }, false)) === true;
    } catch {
      console.warn('[assistant-quota] Could not settle a reservation; its pending lease will expire.');
      return false;
    }
  }
  return {
    async summary() {
      const value = await rpc('toolbox_assistant_quota', { p_action: 'summary' });
      if (!Number.isInteger(value?.messagesUsed) || value.messagesUsed < 0 || typeof value.isUnlimited !== 'boolean') throw new AssistantQuotaError();
      return value;
    },
    async reserve(_user, payload) {
      const reservationId = crypto.randomUUID();
      const value = await rpc('toolbox_assistant_quota', { p_action: 'reserve', p_reservation_id: reservationId, p_turn_key: assistantTurnKey(payload) });
      if (typeof value?.allowed !== 'boolean' || value.allowed && value.reservationId !== reservationId || !value.allowed && value.status !== 429) throw new AssistantQuotaError();
      return value;
    },
    release: (_user, reservation) => settle(reservation, false),
    commit: (_user, reservation) => settle(reservation, true),
  };
}

const development = createMemoryAssistantQuotaStore();
function storeFor(user, request) {
  if (user.id === 'local-development' && !process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL && process.env.NODE_ENV !== 'production') return development;
  return createSharedAssistantQuotaStore({ authorization: request?.headers?.authorization });
}
export const assistantQuotaSummary = (user, request) => storeFor(user, request).summary(user);
export const reserveAssistantTurn = (user, payload, request) => storeFor(user, request).reserve(user, payload);
export const releaseAssistantTurn = (user, reservation, request) => storeFor(user, request).release(user, reservation);
export const commitAssistantTurn = (user, reservation, request) => storeFor(user, request).commit(user, reservation);
export function clearAssistantQuotaForTests() { development.clear(); }
