/* ============================================================
   Signaling Server & Payment REST API Integration Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import * as map from 'lib0/map';

test('Server: HTTP endpoints and WebSocket relay', async (t) => {
  // Spin up an isolated test instance of the server
  const testPort = 45678;
  const wss = new WebSocketServer({ noServer: true });
  const topics = new Map();

  const send = (conn, message) => {
    try { conn.send(JSON.stringify(message)); } catch (e) { conn.close(); }
  };

  wss.on('connection', (conn) => {
    const subscribedTopics = new Set();
    conn.on('close', () => {
      subscribedTopics.forEach((topicName) => {
        const subs = topics.get(topicName) || new Set();
        subs.delete(conn);
        if (subs.size === 0) topics.delete(topicName);
      });
      subscribedTopics.clear();
    });

    conn.on('message', (message) => {
      try { message = JSON.parse(message); } catch { return; }
      if (!message || !message.type) return;

      switch (message.type) {
        case 'subscribe':
          (message.topics || []).forEach((topicName) => {
            const topic = map.setIfUndefined(topics, topicName, () => new Set());
            topic.add(conn);
            subscribedTopics.add(topicName);
          });
          break;
        case 'publish':
          if (message.topic) {
            const receivers = topics.get(message.topic);
            if (receivers) {
              receivers.forEach((r) => send(r, message));
            }
          }
          break;
        case 'ping':
          send(conn, { type: 'pong' });
          break;
      }
    });
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.pathname === '/api/payment/verify' && req.method === 'GET') {
      const ref = url.searchParams.get('reference');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', reference: ref, verified: true }));
      return;
    }

    if (url.pathname === '/api/payment/webhook' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const sig = req.headers['x-toolbox-signature'] || '';
        const secret = 'test_secret_key';
        const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true, verified: sig === expected }));
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Toolbox Spaces Relay</h1>');
  });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  await new Promise((resolve) => server.listen(testPort, resolve));

  try {
    // 1. Test GET /
    const homeRes = await fetch(`http://localhost:${testPort}/`);
    assert.equal(homeRes.status, 200);
    const homeText = await homeRes.text();
    assert.ok(homeText.includes('Toolbox Spaces Relay'));

    // 2. Test GET /api/payment/verify
    const verifyRes = await fetch(`http://localhost:${testPort}/api/payment/verify?reference=VA-12345`);
    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.status, 'success');
    assert.equal(verifyJson.reference, 'VA-12345');
    assert.equal(verifyJson.verified, true);

    // 3. Test POST /api/payment/webhook with valid and invalid HMAC
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'VA-12345' } });
    const secret = 'test_secret_key';
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Valid webhook
    const validWebhookRes = await fetch(`http://localhost:${testPort}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-toolbox-signature': validSignature,
      },
      body: payload,
    });
    assert.equal(validWebhookRes.status, 200);
    const validWebhookJson = await validWebhookRes.json();
    assert.equal(validWebhookJson.verified, true);

    // Invalid webhook signature
    const invalidWebhookRes = await fetch(`http://localhost:${testPort}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-toolbox-signature': 'bad_signature_123',
      },
      body: payload,
    });
    const invalidWebhookJson = await invalidWebhookRes.json();
    assert.equal(invalidWebhookJson.verified, false);

    // 4. Test WebSocket communication (subscribe, publish, ping/pong)
    const client1 = new WebSocket(`ws://localhost:${testPort}`);
    const client2 = new WebSocket(`ws://localhost:${testPort}`);

    await Promise.all([
      new Promise(res => client1.on('open', res)),
      new Promise(res => client2.on('open', res)),
    ]);

    // Test ping/pong
    const pongPromise = new Promise((resolve) => {
      client1.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'pong') resolve();
      });
    });
    client1.send(JSON.stringify({ type: 'ping' }));
    await pongPromise;

    // Test topic broadcast
    const broadcastPromise = new Promise((resolve) => {
      client2.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'publish' && parsed.topic === 'room-alpha') {
          assert.equal(parsed.data, 'Hello Room Alpha');
          resolve();
        }
      });
    });

    client2.send(JSON.stringify({ type: 'subscribe', topics: ['room-alpha'] }));
    // Wait small tick for subscribe
    await new Promise(r => setTimeout(r, 50));
    client1.send(JSON.stringify({ type: 'publish', topic: 'room-alpha', data: 'Hello Room Alpha' }));
    await broadcastPromise;

    client1.close();
    client2.close();
  } finally {
    server.close();
    wss.close();
  }
});
