import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://auth.example.test';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.GROQ_API_KEY = 'offline-test-key';
const { handleAssistantGateway } = await import('../../server-assistant.js');

function response() {
  return {
    status: 0, body: '', headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(value = '') { this.body += value; },
  };
}
async function quota(token) {
  const request = { method: 'GET', headers: { authorization: token ? `Bearer ${token}` : '' }, socket: { remoteAddress: '203.0.113.10' } };
  const reply = response();
  await handleAssistantGateway(request, reply, new URL('https://toolbox.example.test/api/assistant/v2/quota'));
  return reply;
}

async function chat(payload) {
  const request = {
    method: 'POST', headers: { authorization: 'Bearer ordinary-user' },
    socket: { remoteAddress: '203.0.113.10' },
    async *[Symbol.asyncIterator]() { yield JSON.stringify(payload); },
  };
  const reply = response();
  await handleAssistantGateway(request, reply, new URL('https://toolbox.example.test/api/assistant/v2/chat'));
  return reply;
}

test('Assistant quota identity comes from the authenticated server response', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://auth.example.test/auth/v1/user');
    if (options.headers.Authorization === 'Bearer verified-owner') return new Response(JSON.stringify({ id: 'owner-1', email: 'meyigbenee@gmail.com' }), { status: 200 });
    if (options.headers.Authorization === 'Bearer ordinary-user') return new Response(JSON.stringify({ id: 'regular-1', email: 'regular@example.com' }), { status: 200 });
    return new Response('{}', { status: 401 });
  };
  try {
    const owner = await quota('verified-owner');
    assert.equal(owner.status, 200);
    assert.equal(JSON.parse(owner.body).isUnlimited, true);
    const ordinary = await quota('ordinary-user');
    assert.equal(ordinary.status, 200);
    assert.equal(JSON.parse(ordinary.body).isUnlimited, false);
    const rejected = await quota('forged-owner');
    assert.equal(rejected.status, 401);
  } finally { globalThis.fetch = original; }
});

test('Malformed Assistant messages and oversized tool lists fail before reaching a provider', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://auth.example.test/auth/v1/user');
    return new Response(JSON.stringify({ id: 'regular-2', email: 'regular@example.com' }), { status: 200 });
  };
  try {
    assert.equal((await chat({ messages: [null] })).status, 400);
    assert.equal((await chat({ messages: [{ role: 'user', content: 'hello' }], tools: Array(129).fill({}) })).status, 400);
  } finally { globalThis.fetch = original; }
});
