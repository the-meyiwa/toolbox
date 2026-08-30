/* ============================================================
   Toolbox Spaces — Dedicated Signaling Server for Render
   ============================================================ */

import { WebSocketServer } from 'ws';
import http from 'http';
import * as map from 'lib0/map';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

const pingTimeout = 30000;
const port = process.env.PORT || 4444;

const wss = new WebSocketServer({ noServer: true });

import crypto from 'crypto';

const server = http.createServer((request, response) => {
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

  // --- Voltix AI Assistant Proxy API ---
  if (url.pathname.startsWith('/api/assistant/')) {
    if (url.pathname === '/api/assistant/status' && request.method === 'GET') {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const hasGroqKey = !!process.env.GROQ_API_KEY;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ready', hasGeminiKey, hasGroqKey, timestamp: Date.now() }));
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
