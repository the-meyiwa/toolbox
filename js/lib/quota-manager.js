/* Assistant usage display. The server validates identity and enforces message limits.
   Browser counters are only a temporary UI estimate while the server is unavailable. */
import { getCurrentUser } from './supabase.js';
import { authHeader } from './model-gateway.js';

const LIMITS = Object.freeze({
  DAILY_MESSAGES: 40, BURST_PER_MINUTE: 8, MAX_OUTPUT_TOKENS: 4000,
  HEAVY_TASKS_DAILY: 25, LARGE_FILES_DAILY: 20,
});
const serverQuota = new Map();
const pending = new Map();
const today = () => new Date().toISOString().slice(0, 10);
const userId = () => getCurrentUser()?.id || null;
const storageKey = () => `toolbox_usage_quota_v2:${userId() || 'guest'}`;

function load() {
  let value;
  try { value = JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch { value = {}; }
  if (value.date !== today()) value = { date: today(), messageCount: 0, recentMessageTimestamps: [], heavyTaskCount: 0, largeFileCount: 0 };
  value.recentMessageTimestamps = (Array.isArray(value.recentMessageTimestamps) ? value.recentMessageTimestamps : [])
    .filter(at => Number.isFinite(at) && Date.now() - at < 60_000);
  for (const key of ['messageCount', 'heavyTaskCount', 'largeFileCount']) {
    value[key] = Number.isSafeInteger(value[key]) && value[key] >= 0 ? value[key] : 0;
  }
  return value;
}
function save(value) {
  try { localStorage.setItem(storageKey(), JSON.stringify(value)); } catch {}
  try { window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: value })); } catch {}
}
function currentServerQuota() {
  const id = userId();
  const entry = id && serverQuota.get(id);
  return entry && entry.day === today() ? entry.data : null;
}
export function isUserUnlimited() { return currentServerQuota()?.isUnlimited === true; }

export const QuotaManager = {
  LIMITS,
  isUserUnlimited,
  async refreshServerQuota({ force = false } = {}) {
    const id = userId();
    if (!id) return null;
    const cached = serverQuota.get(id);
    if (!force && cached && Date.now() - cached.at < 30_000) return cached.data;
    if (pending.has(id)) return pending.get(id);
    const job = (async () => {
      try {
        const res = await fetch('/api/assistant/v2/quota', { headers: await authHeader(), cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        if (userId() !== id || typeof data.messagesUsed !== 'number') return null;
        serverQuota.set(id, { at: Date.now(), day: today(), data });
        try { window.dispatchEvent(new CustomEvent('toolbox:quotachange', { detail: data })); } catch {}
        return data;
      } catch { return null; }
      finally { pending.delete(id); }
    })();
    pending.set(id, job);
    return job;
  },
  resetQuotas() {
    throw new Error('Assistant message limits are managed by the server and cannot be reset in this browser.');
  },
  canSendMessage() {
    const quota = currentServerQuota();
    if (!quota || quota.isUnlimited) return { allowed: true, remaining: quota?.isUnlimited ? Infinity : undefined, isUnlimited: Boolean(quota?.isUnlimited) };
    if (quota.messagesRemaining <= 0) return { allowed: false, reason: 'Daily Assistant message limit reached. It resets at midnight UTC.' };
    return { allowed: true, remaining: quota.messagesRemaining };
  },
  recordMessage() {
    const state = load();
    state.messageCount++;
    state.recentMessageTimestamps.push(Date.now());
    save(state);
    const id = userId();
    if (id) serverQuota.delete(id);
    return state.messageCount;
  },
  canRunHeavyTask() {
    const state = load();
    return state.heavyTaskCount >= LIMITS.HEAVY_TASKS_DAILY
      ? { allowed: false, reason: 'Daily heavy task limit reached.' }
      : { allowed: true, remaining: LIMITS.HEAVY_TASKS_DAILY - state.heavyTaskCount };
  },
  recordHeavyTask() { const state = load(); state.heavyTaskCount++; save(state); return state.heavyTaskCount; },
  canAnalyzeLargeFile() {
    const state = load();
    return state.largeFileCount >= LIMITS.LARGE_FILES_DAILY
      ? { allowed: false, reason: 'Daily large file analysis limit reached.' }
      : { allowed: true, remaining: LIMITS.LARGE_FILES_DAILY - state.largeFileCount };
  },
  recordLargeFile() { const state = load(); state.largeFileCount++; save(state); return state.largeFileCount; },
  getQuotaSummary() {
    const state = load();
    const server = currentServerQuota();
    const unlimited = server?.isUnlimited === true;
    return {
      isUnlimited: unlimited,
      messagesUsed: server?.messagesUsed ?? state.messageCount,
      messagesLimit: unlimited ? 'Unlimited' : LIMITS.DAILY_MESSAGES,
      messagesRemaining: unlimited ? 'Unlimited' : server?.messagesRemaining ?? Math.max(0, LIMITS.DAILY_MESSAGES - state.messageCount),
      burstLimit: unlimited ? 'Unlimited' : LIMITS.BURST_PER_MINUTE,
      maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS,
      heavyTasksUsed: state.heavyTaskCount,
      heavyTasksLimit: LIMITS.HEAVY_TASKS_DAILY,
      largeFilesUsed: state.largeFileCount,
      largeFilesLimit: LIMITS.LARGE_FILES_DAILY,
      source: server ? 'server' : 'local-estimate',
    };
  },
};
