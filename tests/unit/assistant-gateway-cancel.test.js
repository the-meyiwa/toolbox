import test from 'node:test';
import assert from 'node:assert/strict';

for (const key of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']) delete process.env[key];
process.env.GEMINI_API_KEY = 'offline-test-key';
const { handleAssistantGateway } = await import('../../server-assistant.js');
const { assistantQuotaSummary, clearAssistantQuotaForTests } = await import('../../server-assistant-quota.js');

test('Stopping a reply while providers are pending returns promptly and refunds quota', async () => {
  clearAssistantQuotaForTests();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Promise(() => {});
  let close = () => {};
  const body = JSON.stringify({ turnId: 'turn_cancel_1', messages: [{ role: 'user', content: 'A difficult question' }] });
  const request = {
    method: 'POST', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() { yield body; },
  };
  const response = {
    headersSent: false,
    on(event, callback) { if (event === 'close') close = callback; },
    writeHead() { this.headersSent = true; },
    write() { queueMicrotask(close); return true; },
    end() {},
  };
  try {
    await Promise.race([
      handleAssistantGateway(request, response, new URL('http://localhost/api/assistant/v2/chat')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cancellation hung')), 500)),
    ]);
    assert.equal(assistantQuotaSummary({ id: 'local-development', email: '' }).messagesUsed, 0);
  } finally { globalThis.fetch = original; }
});
