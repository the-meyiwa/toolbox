/* ============================================================
   Toolbox Assistant — model gateway

   POST /api/assistant/v2/chat
     body: { messages, tools, mode, provider? }
     Streams Server-Sent Events in the OpenAI chat-completions
     format, straight from whichever model provider answered.

   Every provider below speaks the OpenAI chat-completions
   protocol (Gemini through its OpenAI-compatible endpoint), so
   the browser runs one tool-calling loop whatever model is used.
   Providers are tried in order; if one fails before it starts
   streaming, the next one takes over.

   Keys never leave the server. Only signed-in Toolbox users can
   use the gateway, so the deployment's keys are not an open proxy.

   Model names can be overridden per provider with environment
   variables (ASSISTANT_GEMINI_MODEL, ASSISTANT_OPENAI_MODEL, …).
   ============================================================ */

const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    key: () => process.env.GEMINI_API_KEY,
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: () => [process.env.ASSISTANT_GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean),
    reasoning: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    key: () => process.env.OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/chat/completions',
    models: () => [process.env.ASSISTANT_OPENAI_MODEL, 'gpt-5-mini', 'gpt-4.1-mini'].filter(Boolean),
    reasoning: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    key: () => process.env.DEEPSEEK_API_KEY,
    url: 'https://api.deepseek.com/chat/completions',
    models: () => [process.env.ASSISTANT_DEEPSEEK_MODEL, 'deepseek-chat'].filter(Boolean),
  },
  {
    id: 'groq',
    label: 'Groq',
    key: () => process.env.GROQ_API_KEY,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: () => [process.env.ASSISTANT_GROQ_MODEL, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'].filter(Boolean),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    key: () => process.env.OPENROUTER_API_KEY,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: () => [process.env.ASSISTANT_OPENROUTER_MODEL, 'openrouter/auto'].filter(Boolean),
    headers: { 'HTTP-Referer': 'https://toolbox.meyigbenee.workers.dev', 'X-Title': 'Toolbox' },
  },
];

const MAX_BODY = 12_000_000;           // images arrive as data URLs
const authCache = new Map();           // token → expiry, so each turn does not re-hit Supabase

export function assistantProviders() {
  return PROVIDERS.filter(p => p.key()).map(p => ({ id: p.id, label: p.label, model: p.models()[0] }));
}

async function authorised(request) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return true;            // local development without Supabase
  const header = request.headers.authorization || '';
  if (!/^Bearer [\w.-]+$/.test(header)) return false;
  const now = Date.now();
  const cached = authCache.get(header);
  if (cached && cached > now) return true;
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: header }, signal: AbortSignal.timeout(12000) });
  if (!who.ok) return false;
  authCache.set(header, now + 5 * 60_000);
  if (authCache.size > 500) authCache.delete(authCache.keys().next().value);
  return true;
}

function providerBody(provider, model, { messages, tools, mode }, plain = false) {
  const body = { model, messages, stream: true };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  if (plain) return body;
  if (provider.id === 'gemini') {
    body.reasoning_effort = mode === 'reasoning' ? 'high' : mode === 'fast' ? 'low' : 'medium';
    body.extra_body = { google: { thinking_config: { include_thoughts: true } } };
  } else if (provider.id === 'openai') {
    body.reasoning_effort = mode === 'reasoning' ? 'high' : mode === 'fast' ? 'minimal' : 'low';
    body.stream_options = { include_usage: false };
  } else if (provider.id === 'openrouter') {
    body.reasoning = { effort: mode === 'reasoning' ? 'high' : 'medium' };
  }
  return body;
}

/** Try one provider/model. Resolves to the upstream Response when it starts streaming, or throws. */
async function open(provider, model, payload, signal, plain = false) {
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key()}`, ...(provider.headers || {}) },
    body: JSON.stringify(providerBody(provider, model, payload, plain)),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let message = text.slice(0, 400);
    try { const j = JSON.parse(text); message = j.error?.message || j[0]?.error?.message || j.message || message; } catch { /* plain text */ }
    // Reasoning options differ between model generations; retry once without them.
    if (!plain && res.status === 400 && /thinking|reasoning|extra_body|unknown name|unrecognized|invalid.*param/i.test(message)) {
      return open(provider, model, payload, signal, true);
    }
    const err = new Error(`${provider.label} (${model}): ${message || res.status}`);
    err.status = res.status;
    // A request the model cannot take (bad schema, too large) will fail on every provider;
    // a missing model or an outage will not.
    err.retryable = res.status !== 400 || /model|not found|unsupported|deprecat/i.test(message);
    throw err;
  }
  return res;
}

export async function handleAssistantGateway(request, response, url) {
  if (url.pathname === '/api/assistant/v2/providers' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ providers: assistantProviders() }));
    return true;
  }
  if (url.pathname !== '/api/assistant/v2/chat' || request.method !== 'POST') return false;

  const fail = (status, error) => {
    if (!response.headersSent) response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error }));
    return true;
  };

  try {
    if (!(await authorised(request))) return fail(401, 'Sign in to Toolbox to use the Assistant.');
  } catch {
    return fail(503, 'Could not verify your Toolbox session. Try again.');
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > MAX_BODY) return fail(413, 'That conversation is too large to send. Start a new chat or remove attachments.');
  }
  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { return fail(400, 'Invalid request.'); }
  if (!Array.isArray(payload.messages) || !payload.messages.length) return fail(400, 'No messages to answer.');

  const configured = PROVIDERS.filter(p => p.key());
  if (!configured.length) return fail(503, 'No Assistant model provider is configured on this server.');
  const ordered = payload.provider
    ? [...configured.filter(p => p.id === payload.provider), ...configured.filter(p => p.id !== payload.provider)]
    : configured;

  const controller = new AbortController();
  response.on('close', () => controller.abort());

  const errors = [];
  for (const provider of ordered) {
    for (const model of [...new Set(provider.models())]) {
      if (controller.signal.aborted) return true;
      let upstream;
      try {
        upstream = await open(provider, model, payload, controller.signal);
      } catch (err) {
        errors.push(err.message);
        if (err.retryable === false) return fail(400, err.message);
        continue;
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.write(`event: provider\ndata: ${JSON.stringify({ provider: provider.id, label: provider.label, model })}\n\n`);
      try {
        const reader = upstream.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          response.write(Buffer.from(value));
        }
      } catch (err) {
        if (!controller.signal.aborted) response.write(`event: error\ndata: ${JSON.stringify({ error: `The model connection dropped: ${err.message}` })}\n\n`);
      }
      response.end();
      return true;
    }
  }
  return fail(502, `No model provider could answer. ${errors.slice(-3).join(' · ')}`);
}
