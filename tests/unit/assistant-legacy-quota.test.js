import test from 'node:test';
import assert from 'node:assert/strict';

for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']) delete process.env[key];
process.env.GEMINI_API_KEY = 'offline-test-key';
const { handleApiRequest } = await import('../../server-handler.js');
const { clearAssistantQuotaForTests } = await import('../../server-assistant-quota.js');

async function chat() {
  const body = JSON.stringify({ history: [{ role: 'user', content: 'A separate short question' }] });
  const request = {
    method: 'POST', url: '/api/assistant/chat',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() { yield body; },
  };
  const response = {
    status: 0, body: '', setHeader() {},
    writeHead(status) { this.status = status; },
    end(value = '') { this.body += value; },
  };
  await handleApiRequest(request, response);
  return response;
}

test('Legacy Assistant API shares the authenticated burst quota', async () => {
  clearAssistantQuotaForTests();
  const original = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async url => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    providerCalls++;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Okay.' }] } }] }), { status: 200 });
  };
  try {
    for (let i = 0; i < 10; i++) assert.equal((await chat()).status, 200);
    const blocked = await chat();
    assert.equal(blocked.status, 429);
    assert.equal(providerCalls, 10);
  } finally { globalThis.fetch = original; }
});
