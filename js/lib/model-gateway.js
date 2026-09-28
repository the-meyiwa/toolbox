/* ============================================================
   Model gateway client.

   Talks to the Toolbox server's multi-provider gateway
   (/api/assistant/v2/chat), which answers with whichever configured
   model responds first (Gemini, Groq, OpenRouter, OpenAI, DeepSeek)
   and fails over when one is out of quota, rate limited or silent.
   Shared by the Assistant and the Code Playground agent.
   ============================================================ */

import { getCurrentUser, refreshUserSession } from './supabase.js';


export async function authHeader(forceRefresh = false) {
  let user = getCurrentUser();
  if (forceRefresh && user?.refreshToken) user = await refreshUserSession();
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}

export class GatewayError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

let lastWarm = 0;
/**
 * Wakes the Assistant service before the person sends anything: the server may be asleep
 * (free hosting), their session check and the model providers' connections all take time on
 * the first message. Cheap and throttled, so it can be called on focus or open.
 */
export function warmGateway() {
  const now = Date.now();
  if (now - lastWarm < 90_000 || typeof fetch !== 'function' || typeof window === 'undefined') return;
  lastWarm = now;
  authHeader().then(headers => fetch('/api/assistant/v2/warm', { method: 'POST', headers, keepalive: true })).catch(() => {});
}

export async function openGateway(body, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('/api/assistant/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(attempt > 0)) },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok && res.body) {
      if (!/event-stream/i.test(res.headers.get('content-type') || '')) {
        const txt = await res.text().catch(() => '');
        let msg = '';
        try { msg = JSON.parse(txt).error || ''; } catch { /* not JSON */ }
        throw new GatewayError(msg || 'The Toolbox server answered in an unexpected format. Redeploy the API on Render so it has the new Assistant service.', 502);
      }
      return res;
    }
    const payload = await res.json().catch(() => ({}));
    if (res.status === 401 && attempt === 0 && getCurrentUser()?.refreshToken) continue;
    if (res.status === 404) throw new GatewayError('The Assistant service is not available on this server yet. Redeploy the Toolbox API.', 404);
    const reason = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    throw new GatewayError(reason || `The Assistant service answered with ${res.status}.`, res.status);
  }
  throw new GatewayError('Sign in to Toolbox to use the Assistant.', 401);
}

/**
 * Reads one streamed model turn.
 * Returns { text, thinking, toolCalls, finish, provider }.
 */
export async function readTurn(res, { onText, onThinking, onProvider, signal }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let text = '', thinking = '', finish = null, provider = null;
  const calls = [];
  let inThought = false, pending = '';   // Gemini wraps thoughts in <thought>…</thought> inside content

  const emitContent = (chunk) => {
    pending += chunk;
    for (;;) {
      if (!inThought) {
        const at = pending.indexOf('<thought>');
        if (at === -1) {
          // Hold back a partial "<thought" at the end of the chunk.
          const keep = partialTagTail(pending, '<thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { text += out; onText(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { text += out; onText(out); }
        pending = pending.slice(at + 9);
        inThought = true;
      } else {
        const at = pending.indexOf('</thought>');
        if (at === -1) {
          const keep = partialTagTail(pending, '</thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { thinking += out; onThinking(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { thinking += out; onThinking(out); }
        pending = pending.slice(at + 10);
        inThought = false;
      }
    }
  };

  const handle = (evt, data) => {
    if (data === '[DONE]') return;
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (evt === 'provider') { provider = json; onProvider(json); return; }
    if (evt === 'error' || (json.error && !json.choices)) {
      throw new GatewayError(json.error?.message || json.error || 'The model stopped unexpectedly.', 502);
    }
    const choice = json.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || choice.message || {};
    const reasoning = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
    if (typeof reasoning === 'string' && reasoning) { thinking += reasoning; onThinking(reasoning); }
    if (typeof delta.content === 'string' && delta.content) emitContent(delta.content);
    for (const tc of delta.tool_calls || []) {
      const idx = typeof tc.index === 'number' ? tc.index : calls.length;
      const slot = calls[idx] || (calls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
      if (tc.extra_content) slot.extra_content = tc.extra_content;   // Gemini thought signatures
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line) { event = 'message'; continue; }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
        if (line.startsWith('data:')) handle(event, line.slice(5).trim());
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  if (pending) {
    if (inThought) { thinking += pending; onThinking(pending); } else { text += pending; onText(pending); }
  }
  if (!provider && !text && !thinking && !calls.length && !signal?.aborted) {
    throw new GatewayError('The model service closed the connection without answering. Try again in a moment.', 502);
  }
  const toolCalls = calls.filter(c => c && c.function.name).map((c, i) => ({ ...c, id: c.id || `call_${Date.now().toString(36)}_${i}` }));
  return { text, thinking, toolCalls, finish, provider };
}

function partialTagTail(s, tag) {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

/**
 * One complete model turn for callers that run their own tool loop.
 * `messages` and `tools` use the OpenAI chat format.
 * Resolves to { text, thinking, toolCalls, finish, provider }.
 */
export async function gatewayTurn({ messages, tools, mode = 'auto', provider, signal }) {
  const res = await openGateway({ messages, tools, mode, provider }, signal);
  const noop = () => {};
  return readTurn(res, { onText: noop, onThinking: noop, onProvider: noop, signal });
}
