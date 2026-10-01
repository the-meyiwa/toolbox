import crypto from 'node:crypto';

// This is an instance-local safety limit. A shared store is required for a
// deployment with multiple gateway instances or for persistence across restarts.
export const ASSISTANT_QUOTA_LIMITS = Object.freeze({
  daily: 50, burst: 10, burstWindowMs: 60_000,
  requestsDaily: 400, requestsPerMinute: 40,
  turnWindowMs: 30 * 60_000, maxStepsPerTurn: 32,
});
const usage = new Map();
const ownerEmails = new Set(['meyigbenee@gmail.com', 'meyigbenee@icloud.com']);

function isUnlimited(user) {
  const configured = String(process.env.ASSISTANT_UNLIMITED_EMAILS || '').split(',').map(value => value.trim().toLowerCase());
  return ownerEmails.has(String(user?.email || '').toLowerCase()) || configured.includes(String(user?.email || '').toLowerCase()) && Boolean(user?.email);
}

function stateFor(user, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  let state = usage.get(user.id);
  if (!state || state.day !== day) {
    state = { day, count: 0, recent: [], requests: 0, recentRequests: [], turns: new Map() };
    usage.set(user.id, state);
  }
  state.recent = state.recent.filter(at => now - at < ASSISTANT_QUOTA_LIMITS.burstWindowMs);
  state.recentRequests = state.recentRequests.filter(at => now - at < ASSISTANT_QUOTA_LIMITS.burstWindowMs);
  for (const [key, turn] of state.turns) if (now - turn.at >= ASSISTANT_QUOTA_LIMITS.turnWindowMs) state.turns.delete(key);
  if (usage.size > 10_000) {
    for (const [id, old] of usage) if (old.day !== day) usage.delete(id);
  }
  return state;
}

export function assistantQuotaSummary(user, now = Date.now()) {
  const state = stateFor(user, now);
  const unlimited = isUnlimited(user);
  return {
    isUnlimited: unlimited,
    messagesUsed: state.count,
    messagesLimit: unlimited ? null : ASSISTANT_QUOTA_LIMITS.daily,
    messagesRemaining: unlimited ? null : Math.max(0, ASSISTANT_QUOTA_LIMITS.daily - state.count),
    burstRemaining: unlimited ? null : Math.max(0, ASSISTANT_QUOTA_LIMITS.burst - state.recent.length),
    requestsRemaining: unlimited ? null : Math.max(0, ASSISTANT_QUOTA_LIMITS.requestsDaily - state.requests),
    resetsAt: new Date(Date.parse(state.day + 'T00:00:00Z') + 86_400_000).toISOString(),
  };
}

function promptFingerprint(messages) {
  const firstCurrentToolCall = messages.findIndex(message => message?.role === 'assistant' && message?.tool_calls?.length);
  const current = firstCurrentToolCall < 0 ? messages : messages.slice(0, firstCurrentToolCall);
  const lastUser = [...current].reverse().find(message => message?.role === 'user');
  return crypto.createHash('sha256').update(JSON.stringify(lastUser?.content ?? '')).digest('hex');
}

/** Reserves one logical user turn. Model round trips within that turn do not spend extra messages. */
export function reserveAssistantTurn(user, payload, now = Date.now()) {
  const state = stateFor(user, now);
  const unlimited = isUnlimited(user);
  const id = typeof payload.turnId === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(payload.turnId) ? payload.turnId : null;
  const key = id ? `${id}:${promptFingerprint(payload.messages)}` : null;
  const previous = key && state.turns.get(key);
  if (!unlimited && state.requests >= ASSISTANT_QUOTA_LIMITS.requestsDaily)
    return { allowed: false, status: 429, reason: 'Daily Assistant work limit reached. It resets at midnight UTC.', retryAfter: Math.ceil((Date.parse(state.day + 'T00:00:00Z') + 86_400_000 - now) / 1000) };
  if (!unlimited && state.recentRequests.length >= ASSISTANT_QUOTA_LIMITS.requestsPerMinute)
    return { allowed: false, status: 429, reason: 'The Assistant is handling too many steps. Please wait a minute and try again.', retryAfter: Math.ceil((state.recentRequests[0] + ASSISTANT_QUOTA_LIMITS.burstWindowMs - now) / 1000) };
  if (previous) {
    if (previous.steps >= ASSISTANT_QUOTA_LIMITS.maxStepsPerTurn)
      return { allowed: false, status: 429, reason: 'This Assistant task has used its available steps. Start a new message.', retryAfter: 0 };
    previous.steps++;
    previous.at = now;
    state.requests++;
    state.recentRequests.push(now);
    return { allowed: true, charged: false, key, at: now, summary: assistantQuotaSummary(user, now) };
  }
  if (!unlimited && state.count >= ASSISTANT_QUOTA_LIMITS.daily)
    return { allowed: false, status: 429, reason: 'Daily Assistant message limit reached. It resets at midnight UTC.', retryAfter: Math.ceil((Date.parse(state.day + 'T00:00:00Z') + 86_400_000 - now) / 1000) };
  if (!unlimited && state.recent.length >= ASSISTANT_QUOTA_LIMITS.burst)
    return { allowed: false, status: 429, reason: 'Too many Assistant messages in one minute. Please wait and try again.', retryAfter: Math.ceil((state.recent[0] + ASSISTANT_QUOTA_LIMITS.burstWindowMs - now) / 1000) };
  state.count++;
  state.recent.push(now);
  state.requests++;
  state.recentRequests.push(now);
  if (key) state.turns.set(key, { at: now, steps: 1 });
  return { allowed: true, charged: true, key, at: now, summary: assistantQuotaSummary(user, now) };
}

/** A provider failure must not consume a user's message allowance. */
export function releaseAssistantTurn(user, reservation, now = Date.now()) {
  if (!reservation?.allowed) return;
  const state = stateFor(user, now);
  state.requests = Math.max(0, state.requests - 1);
  const requestIndex = state.recentRequests.lastIndexOf(reservation.at);
  if (requestIndex >= 0) state.recentRequests.splice(requestIndex, 1);
  if (reservation.charged) {
    state.count = Math.max(0, state.count - 1);
    const index = state.recent.lastIndexOf(reservation.at);
    if (index >= 0) state.recent.splice(index, 1);
    if (reservation.key) state.turns.delete(reservation.key);
  } else if (reservation.key) {
    const turn = state.turns.get(reservation.key);
    if (turn) turn.steps = Math.max(1, turn.steps - 1);
  }
}

export function clearAssistantQuotaForTests() { usage.clear(); }
