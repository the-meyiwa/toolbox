/* ============================================================
   Toolbox Assistant — model gateway

   POST /api/assistant/v2/chat
     body: { messages, tools, mode, provider? }
     Streams Server-Sent Events in the OpenAI chat-completions
     format, straight from whichever model provider answered.
   GET  /api/assistant/v2/providers   configured providers
   GET  /api/assistant/v2/diagnose    tries every provider/model and reports why any fail

   Every provider speaks the OpenAI chat-completions protocol
   (Gemini through its OpenAI-compatible endpoint), so the
   browser runs one tool-calling loop whatever model answers.

   Speed:
   - Providers are ordered per job: fast chat goes to the fastest
     model, deep reasoning to the strongest, images only to models
     that can see.
   - The gateway remembers what failed (bad key, no credit, model
     gone, schema rejected, request too big) and skips it for a
     while instead of paying for the same failure on every message.
   - It remembers which request shape each model accepts, so a
     "retry without reasoning options" happens once, not every time.
   - Hedging: if the first model has not started answering after a
     few seconds, the next one is started too and whichever answers
     first wins; the other is cancelled.

   Keys never leave the server. Only signed-in Toolbox users can
   use the gateway, so the deployment's keys are not an open proxy.
   Model names can be overridden per provider with environment
   variables (ASSISTANT_GEMINI_MODEL, ASSISTANT_OPENAI_MODEL, …).
   ============================================================ */

import { isLocalDevelopmentRequest, sessionCacheKey, safeProviderError } from './server-security.js';
import { assistantQuotaSummary, reserveAssistantTurn, releaseAssistantTurn } from './server-assistant-quota.js';

const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    key: () => process.env.GEMINI_API_KEY,
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: () => [process.env.ASSISTANT_GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest'].filter(Boolean),
    vision: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    key: () => process.env.OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/chat/completions',
    models: () => [process.env.ASSISTANT_OPENAI_MODEL, 'gpt-5-mini', 'gpt-4.1-mini'].filter(Boolean),
    vision: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    key: () => process.env.DEEPSEEK_API_KEY,
    url: 'https://api.deepseek.com/chat/completions',
    models: () => [process.env.ASSISTANT_DEEPSEEK_MODEL, 'deepseek-chat'].filter(Boolean),
    vision: false,
  },
  {
    id: 'groq',
    label: 'Groq',
    key: () => process.env.GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: () => [process.env.ASSISTANT_GROQ_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'].filter(Boolean),
    vision: false,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    key: () => process.env.OPENROUTER_API_KEY,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: () => [process.env.ASSISTANT_OPENROUTER_MODEL, 'openrouter/auto'].filter(Boolean),
    headers: { 'HTTP-Referer': 'https://toolbox.meyigbenee.workers.dev', 'X-Title': 'Toolbox' },
    vision: true,
  },
];

// Which provider to try first for each kind of job.
const ORDER = {
  // Groq leads everyday chat: it is the fastest and its free tier is the most generous.
  fast: ['groq', 'gemini', 'openrouter', 'openai', 'deepseek'],
  auto: ['groq', 'gemini', 'openrouter', 'openai', 'deepseek'],
  reasoning: ['gemini', 'groq', 'openai', 'deepseek', 'openrouter'],
  // Code Playground agent: long tool-calling runs; OpenRouter is the first fallback when Gemini runs out.
  code: ['gemini', 'openrouter', 'openai', 'groq', 'deepseek'],
};
// How long the first model gets to start answering before a second one is started alongside it.
const HEDGE_MS = { fast: 3500, auto: 5000, reasoning: 9000, code: 8000 };
const HEDGE_MAX_BYTES = 24_000;
// How long any one model gets to start answering at all.
const FIRST_TOKEN_TIMEOUT_MS = { fast: 25_000, auto: 40_000, reasoning: 90_000, code: 90_000 };

const MAX_BODY = 12_000_000;           // images arrive as data URLs
const authCache = new Map();           // hashed token → verified user and expiry

/* ---------------- memory of what works ---------------- */

const health = new Map();              // key → { until, reason }
const variants = new Map();            // provider:model → 'full' | 'plain'
const sizeLimit = new Map();           // provider:model → largest request (bytes) known to be too big

const hkey = (p, m, tools) => `${p.id}:${m}${tools ? ':tools' : ''}`;

function cooling(p, m, tools, bytes) {
  const now = Date.now();
  for (const k of [hkey(p, m, false), ...(tools ? [hkey(p, m, true)] : [])]) {
    const h = health.get(k);
    if (h && h.until > now) return h.reason;
  }
  const limit = sizeLimit.get(`${p.id}:${m}`);
  if (limit && limit.until > now && bytes >= limit.bytes * 0.9) return `request too large (${Math.round(limit.bytes / 1024)} KB failed)`;
  return null;
}

/** Decides how long to stop sending requests to a model after a failure. */
function remember(p, m, err, { tools, bytes }) {
  const msg = String(err?.message || '');
  const status = err?.status || 0;
  const minutes = (n) => Date.now() + n * 60_000;
  let key = hkey(p, m, false);
  let until = minutes(2);
  const retryIn = /retry in ([\d.]+)s/i.exec(msg);
  if (/no credits|insufficient balance|add credits|billing details|payment required/i.test(msg) && !retryIn) {
    until = minutes(360);            // an account with no credit stays that way until someone pays
  } else if (retryIn) {
    until = Date.now() + Math.min(Number(retryIn[1]) * 1000 + 1000, 6 * 60 * 60_000);   // free-tier quota: the provider says when
  } else if (status === 401 || status === 403 || status === 402 || /quota|billing|credit|insufficient|balance|payment|exceeded your current/i.test(msg)) {
    until = minutes(30);
  } else if (status === 404 || /model.*(not found|does not exist|not supported|deprecat|decommission)/i.test(msg)) {
    until = minutes(360);
  } else if (status === 413 || /too large|request.*size|tokens per minute|TPM|context length|maximum context/i.test(msg)) {
    sizeLimit.set(`${p.id}:${m}`, { bytes, until: minutes(30) });
    return;
  } else if (status === 429 || /rate limit|too many requests/i.test(msg)) {
    until = Date.now() + 45_000;
  } else if (status === 400 && tools) {
    key = hkey(p, m, true);            // it can chat, but rejects this tool list
    until = minutes(30);
  } else if (/empty answer/i.test(msg)) {
    until = minutes(1);
  }
  health.set(key, { until, reason: msg.slice(0, 240) });
}

/* ---------------- warm-up ---------------- */

let warmedAt = 0;
/** Opens a keep-alive connection to each configured provider (no key sent, nothing billed). */
export function warmProviders() {
  const now = Date.now();
  if (now - warmedAt < 60_000) return;
  warmedAt = now;
  const origins = new Set(PROVIDERS.filter(p => p.key()).map(p => new URL(p.url).origin));
  for (const origin of origins) {
    fetch(origin, { method: 'HEAD', signal: AbortSignal.timeout(8000) }).then(r => r.body?.cancel?.()).catch(() => {});
  }
}

/* ---------------- helpers ---------------- */

export function assistantProviders() {
  return PROVIDERS.filter(p => p.key()).map(p => ({ id: p.id, label: p.label, model: p.models()[0], vision: p.vision }));
}

export async function authenticatedUser(request) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return isLocalDevelopmentRequest(request) ? { id: 'local-development', email: '' } : null;
  const header = request.headers.authorization || '';
  if (!/^Bearer [\w.-]+$/.test(header)) return null;
  const now = Date.now();
  const cacheKey = sessionCacheKey(header);
  const cached = authCache.get(cacheKey);
  if (cached && cached.until > now) return cached.user;
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: header }, signal: AbortSignal.timeout(12000) });
  if (!who.ok) return null;
  const user = await who.json();
  if (!user?.id) return null;
  const expiry = (() => { try { return JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64url')).exp * 1000; } catch { return 0; } })();
  const verified = { id: String(user.id), email: String(user.email || '').toLowerCase().trim() };
  authCache.set(cacheKey, { user: verified, until: Math.min(now + 60_000, expiry || now) });
  if (authCache.size > 500) authCache.delete(authCache.keys().next().value);
  return verified;
}

export async function authorised(request) { return Boolean(await authenticatedUser(request)); }

const hasImages = (messages) => messages.some(m => Array.isArray(m.content) && m.content.some(c => c?.type === 'image_url'));

// "fast" asks Gemini not to think at all, which gets the first token out sooner. Models that
// reject "none" step down to "low" (remembered per model), never straight to no options.
const noneRejected = new Set();       // provider:model that refused reasoning_effort "none"
const wantsNone = (provider, mode) => provider.id === 'gemini' && mode === 'fast';

function providerBody(provider, model, { messages, tools, mode }, plain = false, low = false) {
  const body = { model, messages, stream: true };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  if (plain) return body;
  if (provider.id === 'gemini') {
    // Gemini takes either reasoning_effort or a thinking_config, not both.
    body.reasoning_effort = mode === 'reasoning' ? 'high' : (wantsNone(provider, mode) && !low ? 'none' : 'low');
  } else if (provider.id === 'openai') {
    body.reasoning_effort = mode === 'reasoning' ? 'high' : mode === 'fast' ? 'minimal' : 'low';
  } else if (provider.id === 'groq' && /gpt-oss/.test(model)) {
    body.reasoning_effort = mode === 'reasoning' ? 'high' : 'low';
  } else if (provider.id === 'openrouter') {
    body.reasoning = { effort: mode === 'reasoning' ? 'high' : 'low' };
  }
  return body;
}

/** Sends one request. Resolves to the upstream Response when it is accepted, or throws. */
async function open(provider, model, payload, signal) {
  const vkey = `${provider.id}:${model}`;
  let plain = variants.get(vkey) === 'plain';
  let low = noneRejected.has(vkey);
  for (;;) {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key()}`, ...(provider.headers || {}) },
      body: JSON.stringify(providerBody(provider, model, payload, plain, low)),
      signal,
    });
    if (res.ok && res.body) {
      if (!variants.has(vkey)) variants.set(vkey, plain ? 'plain' : 'full');
      return res;
    }
    const text = await res.text().catch(() => '');
    let message = text.slice(0, 400);
    try { const j = JSON.parse(text); message = j.error?.message || j[0]?.error?.message || j.message || message; } catch { /* plain text */ }
    // Reasoning options differ between model generations; retry once without them and remember.
    const optionRejected = res.status === 400 && /thinking|reasoning|effort|extra_body|unknown name|unrecognized|unsupported (parameter|value)|invalid.*param/i.test(message);
    if (optionRejected && !plain && !low && wantsNone(provider, payload.mode)) {
      low = true;
      noneRejected.add(vkey);
      continue;
    }
    if (!plain && optionRejected) {
      plain = true;
      variants.set(vkey, 'plain');
      continue;
    }
    const err = new Error(`${provider.label} (${model}): ${message || res.status}`);
    err.status = res.status;
    throw err;
  }
}

/** Looks at the start of an SSE stream: 'ok' once there is content, reasoning or a tool call; an Error if the stream reports one. */
function inspect(text) {
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let json;
    try { json = JSON.parse(data); } catch { continue; }   // partial line; wait for more
    if (json.error) return new Error(json.error.message || JSON.stringify(json.error).slice(0, 200));
    const choice = json.choices?.[0];
    const delta = choice?.delta || choice?.message || {};
    if (delta.tool_calls?.length) return 'ok';
    if (typeof delta.content === 'string' && delta.content.trim()) return 'ok';
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim()) return 'ok';
    if (choice?.finish_reason && !['stop', 'tool_calls', 'length'].includes(choice.finish_reason)) {
      return new Error(`stopped (${choice.finish_reason})`);
    }
  }
  return null;
}

/**
 * Opens a model and reads until it has clearly started answering.
 * Resolves { reader, held } (the chunks read so far) or throws.
 */
async function attempt(c, payload, signal, timeoutMs) {
  const timer = AbortSignal.timeout(timeoutMs);
  const both = AbortSignal.any ? AbortSignal.any([signal, timer]) : signal;
  const res = await open(c.provider, c.model, payload, both);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const held = [];
  let text = '';
  let verdict = null;
  try {
    while (!verdict) {
      const { value, done } = await reader.read();
      if (done) break;
      held.push(value);
      text += decoder.decode(value, { stream: true });
      verdict = inspect(text);
    }
  } catch (err) {
    verdict = timer.aborted ? new Error(`no answer within ${Math.round(timeoutMs / 1000)}s`) : err;
  }
  if (verdict === 'ok') return { reader, held };
  try { reader.cancel(); } catch { /* closed */ }
  const err = verdict instanceof Error ? verdict : new Error('returned an empty answer');
  if (!/^\w+ \(/.test(err.message)) err.message = `${c.provider.label} (${c.model}): ${err.message}`;
  throw err;
}

/**
 * Races candidates: starts the first, and if it has not begun answering within the hedge
 * delay, starts the next one alongside it. The first to answer wins; the others are cancelled.
 * Failures start the next candidate immediately.
 */
function race(candidates, payload, { signal, hedgeMs, timeoutMs, bytes, onError }) {
  if (signal.aborted) return Promise.resolve(null);
  const queue = candidates.slice();
  const running = new Set();
  let winner = null;
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(null), { once: true });
    const settleIfDone = () => { if (!winner && (signal.aborted || !running.size && !queue.length)) resolve(null); };
    const launch = (hedging = false) => {
      if (winner || signal.aborted) return;
      // A hedge goes to a different provider: another model from a slow provider is usually slow too.
      let idx = 0;
      if (hedging) {
        const busy = new Set([...running].map(r => r.c.provider.id));
        idx = queue.findIndex(q => !busy.has(q.provider.id));
        if (idx < 0) return;
      }
      const [c] = queue.splice(idx, 1);
      if (!c) { settleIfDone(); return; }
      const ctrl = new AbortController();
      let hedge = null;
      const onAbort = () => { clearTimeout(hedge); ctrl.abort(); };
      signal.addEventListener('abort', onAbort, { once: true });
      const entry = { c, ctrl, started: Date.now() };
      running.add(entry);
      // A hedge bills the whole prompt a second time, so only small requests are hedged;
      // big ones (long chats, documents, code) wait for the first model or its failure.
      hedge = bytes > HEDGE_MAX_BYTES ? null : setTimeout(() => { if (!winner && running.size < 2) launch(true); }, hedgeMs);
      attempt(c, payload, ctrl.signal, timeoutMs).then((won) => {
        clearTimeout(hedge);
        running.delete(entry);
        signal.removeEventListener('abort', onAbort);
        if (winner) { try { won.reader.cancel(); } catch { /* closed */ } return; }
        winner = { ...won, c, ms: Date.now() - entry.started };
        for (const other of running) other.ctrl.abort();
        running.clear();
        resolve(winner);
      }).catch((err) => {
        clearTimeout(hedge);
        running.delete(entry);
        signal.removeEventListener('abort', onAbort);
        if (winner || ctrl.signal.aborted && !/no answer within/.test(err.message)) { settleIfDone(); return; }
        remember(c.provider, c.model, err, { tools: Boolean(payload.tools?.length), bytes });
        onError(err);
        if (!running.size) launch();
        settleIfDone();
      });
    };
    launch();
  });
}

function candidatesFor(payload, bytes) {
  const mode = ORDER[payload.mode] ? payload.mode : 'auto';
  const needsVision = hasImages(payload.messages);
  const tools = Boolean(payload.tools?.length);
  let ids = ORDER[mode].slice();
  // A user-selected provider stays fixed. The provider that answered an earlier
  // step is only an affinity hint: tool follow-ups still need working fallbacks.
  if (payload.provider && ids.includes(payload.provider)) ids = [payload.provider];
  else if (process.env.ASSISTANT_ALLOW_CROSS_PROVIDER_FALLBACK === '0') ids = ids.filter(id => PROVIDERS.find(p => p.id === id)?.key()).slice(0, 1);
  else if (payload.preferredProvider && ids.includes(payload.preferredProvider)) ids = [payload.preferredProvider, ...ids.filter(id => id !== payload.preferredProvider)];
  const all = [];
  const skipped = [];
  for (const id of ids) {
    const provider = PROVIDERS.find(p => p.id === id);
    if (!provider?.key()) continue;
    if (needsVision && !provider.vision) continue;
    for (const model of [...new Set(provider.models())]) {
      const why = cooling(provider, model, tools, bytes);
      (why ? skipped : all).push({ provider, model, why });
    }
  }
  // If everything is cooling down, try anyway rather than refuse.
  return { list: all.length ? all : skipped, skipped: all.length ? skipped : [] };
}

/* ---------------- diagnostics ---------------- */

async function probeStream(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let verdict = null;
  const deadline = Date.now() + 45_000;
  while (!verdict && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    verdict = inspect(text);
  }
  try { reader.cancel(); } catch { /* closed */ }
  if (verdict === 'ok') return { ok: true, toolCall: /"tool_calls"/.test(text) };
  return { ok: false, error: verdict instanceof Error ? verdict.message : 'empty answer', sample: text.slice(0, 300) };
}

/**
 * GET /api/assistant/v2/diagnose — tries every configured provider and model,
 * once without tools and once with a single simple tool, and reports what failed and why.
 */
async function diagnose(request, response) {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body, null, 2));
    return true;
  };
  if (!isLocalDevelopmentRequest(request)) return send(403, { error: 'Provider diagnostics are available only on the local development server.' });
  try {
    if (!(await authorised(request))) return send(401, { error: 'Sign in to Toolbox first.' });
  } catch { return send(503, { error: 'Could not verify your Toolbox session.' }); }
  const tool = { type: 'function', function: { name: 'calculate', description: 'Evaluate an arithmetic expression and return the result.', parameters: { type: 'object', properties: { expression: { type: 'string', description: 'For example 12*7' } }, required: ['expression'] } } };
  const messages = [{ role: 'user', content: 'What is 12*7? If a calculate tool is available, call it.' }];
  const results = [];
  const jobs = [];
  for (const provider of PROVIDERS) {
    if (!provider.key()) { results.push({ provider: provider.id, configured: false }); continue; }
    for (const model of [...new Set(provider.models())]) {
      for (const withTools of [false, true]) {
        jobs.push((async () => {
          const started = Date.now();
          const row = { provider: provider.id, model, tools: withTools };
          try {
            const res = await open(provider, model, { messages, tools: withTools ? [tool] : undefined, mode: 'fast' }, AbortSignal.timeout(50_000));
            Object.assign(row, await probeStream(res));
          } catch (err) {
            Object.assign(row, { ok: false, status: err.status, error: err.message });
          }
          row.ms = Date.now() - started;
          row.variant = variants.get(`${provider.id}:${model}`) || null;
          results.push(row);
        })());
      }
    }
  }
  await Promise.all(jobs);
  results.sort((a, b) => `${a.provider}${a.model}${a.tools}`.localeCompare(`${b.provider}${b.model}${b.tools}`));
  const now = Date.now();
  const coolingDown = [...health.entries()].filter(([, h]) => h.until > now).map(([k, h]) => ({ key: k, forSeconds: Math.round((h.until - now) / 1000), reason: h.reason }));
  return send(200, { checkedAt: new Date().toISOString(), results, coolingDown });
}

/* ---------------- chat ---------------- */

export async function handleAssistantGateway(request, response, url) {
  if (url.pathname === '/api/assistant/v2/quota' && request.method === 'GET') {
    let user;
    try { user = await authenticatedUser(request); } catch { /* fail closed */ }
    response.writeHead(user ? 200 : 401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(user ? assistantQuotaSummary(user) : { error: 'Sign in to Toolbox first.' }));
    return true;
  }
  if (url.pathname === '/api/assistant/v2/providers' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ providers: assistantProviders() }));
    return true;
  }
  if (url.pathname === '/api/assistant/v2/diagnose' && request.method === 'GET') {
    return diagnose(request, response);
  }
  if (url.pathname === '/api/assistant/v2/warm' && (request.method === 'GET' || request.method === 'POST')) {
    // Called when the person opens the Assistant or starts typing: wakes this server, checks and
    // caches their session (so the first message skips that round trip), and opens the TLS
    // connections to the model providers so the first request does not pay for the handshake.
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    response.end();
    warmProviders();
    authorised(request).catch(() => {});
    return true;
  }
  if (url.pathname !== '/api/assistant/v2/chat' || request.method !== 'POST') return false;

  let heartbeat = null;
  const fail = (status, error) => {
    clearInterval(heartbeat);
    if (response.headersSent) {
      response.end(`event: error\ndata: ${JSON.stringify({ error, status })}\n\n`);
      return true;
    }
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error }));
    return true;
  };

  const received = Date.now();
  let raw = '';
  // Read the body and check the session at the same time.
  const authing = authenticatedUser(request).catch(() => undefined);
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > MAX_BODY) return fail(413, 'That conversation is too large to send. Start a new chat or remove attachments.');
  }
  const user = await authing;
  if (user === undefined) return fail(503, 'Could not verify your Toolbox session. Try again.');
  if (!user) return fail(401, 'Sign in to Toolbox to use the Assistant.');

  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { return fail(400, 'Invalid request.'); }
  if (!Array.isArray(payload.messages) || !payload.messages.length) return fail(400, 'No messages to answer.');
  if (payload.messages.length > 240 || payload.messages.some(message =>
    !message || typeof message !== 'object' || !['system', 'user', 'assistant', 'tool'].includes(message.role) ||
    !(message.content == null || typeof message.content === 'string' || Array.isArray(message.content)))) {
    return fail(400, 'The conversation contains an invalid message.');
  }
  if (payload.tools !== undefined && (!Array.isArray(payload.tools) || payload.tools.length > 128)) {
    return fail(400, 'The tool list is invalid or too large.');
  }
  if (!PROVIDERS.some(p => p.key())) return fail(503, 'No Assistant model provider is configured on this server.');
  const reservation = reserveAssistantTurn(user, payload);
  if (!reservation.allowed) {
    response.setHeader?.('Retry-After', String(Math.max(0, reservation.retryAfter || 0)));
    return fail(reservation.status, reservation.reason);
  }

  const mode = ORDER[payload.mode] ? payload.mode : 'auto';
  const bytes = raw.length;
  const { list, skipped } = candidatesFor(payload, bytes);
  if (!list.length) { releaseAssistantTurn(user, reservation); return fail(503, 'No model that can read images is configured on this server.'); }

  const controller = new AbortController();
  response.on('close', () => { clearInterval(heartbeat); controller.abort(); });

  // Open the stream now and keep it alive while models think or fail over,
  // so proxies (Cloudflare, Render) never see an idle connection.
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.write(': open\n\n');
  heartbeat = setInterval(() => { try { response.write(': ping\n\n'); } catch { /* closed */ } }, 10_000);

  const errors = [];
  const winner = await race(list, payload, {
    signal: controller.signal,
    hedgeMs: HEDGE_MS[mode],
    timeoutMs: FIRST_TOKEN_TIMEOUT_MS[mode],
    bytes,
    onError: (err) => { const message = safeProviderError('Assistant provider', err); errors.push(message); console.warn('[assistant]', message); },
  });
  if (controller.signal.aborted) { releaseAssistantTurn(user, reservation); return true; }
  if (!winner) { releaseAssistantTurn(user, reservation); return fail(502, `No model provider could answer. ${errors.slice(-3).join(' · ')}`); }

  clearInterval(heartbeat);
  const { c, reader, held } = winner;
  const failed = [...skipped.map(s => `${s.provider.label}: temporarily unavailable.`), ...errors].slice(-8);
  if (failed.length) response.write(`event: attempts\ndata: ${JSON.stringify({ failed })}\n\n`);
  response.write(`event: provider\ndata: ${JSON.stringify({ provider: c.provider.id, label: c.provider.label, model: c.model, firstTokenMs: Date.now() - received })}\n\n`);
  for (const chunk of held) response.write(Buffer.from(chunk));
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      response.write(Buffer.from(value));
    }
  } catch (err) {
    if (!controller.signal.aborted) response.write(`event: error\ndata: ${JSON.stringify({ error: 'The model connection dropped. Please try again.' })}\n\n`);
  }
  response.end();
  return true;
}
