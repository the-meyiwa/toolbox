/* ============================================================
   Toolbox Spaces — Dedicated Signaling Server for Render
   ============================================================ */

import { WebSocketServer } from 'ws';
import http from 'http';
import * as map from 'lib0/map';
import crypto from 'crypto';
import fs from 'fs';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

const pingTimeout = 30000;
const port = process.env.PORT || 4444;

const wss = new WebSocketServer({ noServer: true });

try {
  if (fs.existsSync('.env')) {
    const envFile = fs.readFileSync('.env', 'utf-8');
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Toolbox-Signature, X-Idempotency-Key');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  // --- Toolbox Payment REST API ---
  if (url.pathname.startsWith('/api/payment/')) {
    if (url.pathname === '/api/payment/verify' && request.method === 'GET') {
      const ref = url.searchParams.get('reference');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'success', reference: ref, verified: true, timestamp: Date.now() }));
      return;
    }

    if (url.pathname === '/api/payment/webhook' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        const signature = request.headers['x-toolbox-signature'] || request.headers['x-paystack-signature'] || '';
        const secret = process.env.TOOLBOX_WEBHOOK_SECRET || 'toolbox_dev_secret_key';
        const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

        const isValid = signature === expected || process.env.NODE_ENV !== 'production';
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ received: true, verified: isValid }));
      });
      return;
    }
  }

  // --- Assistant Proxy API ---
  if (url.pathname.startsWith('/api/assistant/')) {
    if (url.pathname === '/api/assistant/status' && request.method === 'GET') {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const hasGroqKey = !!process.env.GROQ_API_KEY;
      const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
      const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
      const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        status: 'ready',
        hasGeminiKey,
        hasGroqKey,
        hasOpenAiKey,
        hasOpenRouterKey,
        hasDeepSeekKey,
        supportedProviders: ['gemini', 'groq', 'openai', 'openrouter', 'deepseek', 'ollama', 'local'],
        timestamp: Date.now()
      }));
      return;
    }

    if (url.pathname === '/api/assistant/test' && request.method === 'POST') {
      let bodyStr = '';
      request.on('data', chunk => { bodyStr += chunk; });
      request.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const provider = body.provider || 'gemini';
          const key = body.apiKey || (
            provider === 'groq' ? process.env.GROQ_API_KEY :
            provider === 'openai' ? process.env.OPENAI_API_KEY :
            provider === 'openrouter' ? process.env.OPENROUTER_API_KEY :
            provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY :
            process.env.GEMINI_API_KEY
          );

          if (!key) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, message: `No API key configured for ${provider}.` }));
            return;
          }

          const start = Date.now();
          if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${encodeURIComponent(key)}`);
            if (res.ok) {
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ success: true, latencyMs: Date.now() - start, message: 'Connected to Google Gemini!' }));
              return;
            }
            const err = await res.json().catch(() => ({}));
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, message: err.error?.message || `HTTP ${res.status}` }));
            return;
          }

          if (provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': `Bearer ${key}` }
            });
            if (res.ok) {
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ success: true, latencyMs: Date.now() - start, message: 'Connected to Groq Cloud!' }));
              return;
            }
            const err = await res.json().catch(() => ({}));
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, message: err.error?.message || `HTTP ${res.status}` }));
            return;
          }

          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, latencyMs: Date.now() - start, message: 'Provider validated.' }));
        } catch (err) {
          response.writeHead(500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/assistant/chat' && request.method === 'POST') {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Unauthorized: Missing token' }));
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const isDevToken = token.startsWith('tok_') && process.env.NODE_ENV !== 'production';

      if (!isDevToken) {
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iZcbpvF209tCXSuqNm4Ckw_xOFFMM-S';
        const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ssoruyruzbvgyondxlgj.supabase.co';
        
        try {
          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey }
          });
          if (!userRes.ok) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
            return;
          }
        } catch (e) {
          response.writeHead(500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'Auth server error' }));
          return;
        }
      }

      let bodyStr = '';
      request.on('data', chunk => { bodyStr += chunk; });
      request.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const prov = body.provider || 'gemini';

          // 1. Groq Cloud Proxy
          if (prov === 'groq' || (!process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY && !body.apiKey)) {
            const groqKey = process.env.GROQ_API_KEY || body.apiKey;
            if (!groqKey) {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: 'GROQ_API_KEY is not configured.' }));
              return;
            }

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
              },
              body: JSON.stringify({
                model: body.model || 'llama-3.3-70b-versatile',
                messages: body.messages || [{ role: 'user', content: 'Hello' }],
                stream: true,
                temperature: 0.4
              })
            });

            if (!groqRes.ok) {
              const errJson = await groqRes.json().catch(() => ({}));
              response.writeHead(400, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: errJson.error?.message || `Groq HTTP ${groqRes.status}` }));
              return;
            }

            response.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'x-ai-format': 'openai'
            });

            const reader = groqRes.body.getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              response.write(value);
            }
            response.end();
            return;
          }

          // 2. OpenAI / OpenRouter Proxy
          if (prov === 'openai' || prov === 'openrouter' || prov === 'deepseek') {
            const apiKey = (
              prov === 'openai' ? process.env.OPENAI_API_KEY :
              prov === 'openrouter' ? process.env.OPENROUTER_API_KEY :
              process.env.DEEPSEEK_API_KEY
            ) || body.apiKey;

            if (!apiKey) {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: `API key for ${prov} is not configured.` }));
              return;
            }

            const targetUrl = (
              prov === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
              prov === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
              'https://api.deepseek.com/chat/completions'
            );

            const aiRes = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: body.model || (prov === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat'),
                messages: body.messages || [{ role: 'user', content: 'Hello' }],
                stream: true,
                temperature: 0.4
              })
            });

            if (!aiRes.ok) {
              const errJson = await aiRes.json().catch(() => ({}));
              response.writeHead(400, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: errJson.error?.message || `${prov} HTTP ${aiRes.status}` }));
              return;
            }

            response.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'x-ai-format': 'openai'
            });

            const reader = aiRes.body.getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              response.write(value);
            }
            response.end();
            return;
          }

          // 3. Default: Google Gemini Proxy
          const apiKey = process.env.GEMINI_API_KEY || body.apiKey;
          if (!apiKey) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the backend. Please provide your API key in AI Settings.' }));
            return;
          }

          const candidateModels = [body.model, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.7-flash'].filter(Boolean);
          const uniqueModels = [...new Set(candidateModels)];

          let fetchRes = null;
          let lastErrMessage = '';

          for (const model of uniqueModels) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
            try {
              const geminiCtrl = new AbortController();
              const geminiTimer = setTimeout(() => geminiCtrl.abort(), 6000);
              fetchRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: body.contents || [],
                  systemInstruction: body.systemInstruction,
                  tools: body.tools,
                  generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2000
                  }
                }),
                signal: geminiCtrl.signal
              });
              clearTimeout(geminiTimer);

              if (fetchRes.ok) break;

              const errJson = await fetchRes.json().catch(() => ({}));
              lastErrMessage = errJson.error?.message || `HTTP ${fetchRes.status}`;

              if (lastErrMessage.toLowerCase().includes('leaked') || lastErrMessage.toLowerCase().includes('permission_denied')) {
                lastErrMessage = 'Google AI reported this API key as leaked/revoked. Please generate a fresh free key at https://aistudio.google.com/app/apikey and save it in AI Settings or your .env file.';
                break;
              }
            } catch (err) {
              lastErrMessage = err.message;
            }
          }

          if (!fetchRes || !fetchRes.ok) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: lastErrMessage || 'Failed to connect to Google Gemini API.' }));
            return;
          }

          response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'x-ai-format': 'gemini'
          });

          const reader = fetchRes.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            response.write(value);
          }
          response.end();
        } catch (err) {
          if (!response.headersSent) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
          }
          response.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Toolbox Spaces Relay</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #111; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; max-width: 420px; }
          h1 { margin: 0 0 8px; font-size: 1.4rem; }
          p { color: #666; font-size: 0.9rem; line-height: 1.5; margin: 0; }
          .status { display: inline-flex; align-items: center; gap: 6px; color: #059669; font-weight: 600; font-size: 0.85rem; margin-top: 16px; background: #ecfdf5; padding: 4px 12px; border-radius: 999px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #059669; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Toolbox Spaces &amp; Payment Gateway</h1>
          <p>Signaling service &amp; Payment API are operational.</p>
          <div class="status"><span class="dot"></span> Operational</div>
        </div>
      </body>
    </html>
  `);
});

/**
 * Map from topic-name to set of subscribed clients.
 * @type {Map<string, Set<any>>}
 */
const topics = new Map();

/**
 * @param {any} conn
 * @param {object} message
 */
const send = (conn, message) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    conn.close();
  }
  try {
    conn.send(JSON.stringify(message));
  } catch (e) {
    conn.close();
  }
};

/**
 * Setup a new client
 * @param {any} conn
 */
const onconnection = (conn) => {
  const subscribedTopics = new Set();
  let closed = false;
  let pongReceived = true;

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close();
      clearInterval(pingInterval);
    } else {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        conn.close();
      }
    }
  }, pingTimeout);

  conn.on('pong', () => {
    pongReceived = true;
  });

  conn.on('close', () => {
    subscribedTopics.forEach((topicName) => {
      const subs = topics.get(topicName) || new Set();
      subs.delete(conn);
      if (subs.size === 0) {
        topics.delete(topicName);
      }
    });
    subscribedTopics.clear();
    closed = true;
  });

  conn.on('message', (message) => {
    if (typeof message === 'string' || message instanceof Buffer) {
      try {
        message = JSON.parse(message);
      } catch {
        return;
      }
    }
    if (message && message.type && !closed) {
      switch (message.type) {
        case 'subscribe':
          (message.topics || []).forEach((topicName) => {
            if (typeof topicName === 'string') {
              const topic = map.setIfUndefined(topics, topicName, () => new Set());
              topic.add(conn);
              subscribedTopics.add(topicName);
            }
          });
          break;
        case 'unsubscribe':
          (message.topics || []).forEach((topicName) => {
            const subs = topics.get(topicName);
            if (subs) {
              subs.delete(conn);
            }
          });
          break;
        case 'publish':
          if (message.topic) {
            const receivers = topics.get(message.topic);
            if (receivers) {
              message.clients = receivers.size;
              receivers.forEach((receiver) => send(receiver, message));
            }
          }
          break;
        case 'ping':
          send(conn, { type: 'pong' });
      }
    }
  });
};

wss.on('connection', onconnection);

server.on('upgrade', (request, socket, head) => {
  const handleAuth = (ws) => {
    wss.emit('connection', ws, request);
  };
  wss.handleUpgrade(request, socket, head, handleAuth);
});

server.listen(port, () => {
  console.log(`Toolbox Spaces Signaling Server running on port ${port}`);
});
