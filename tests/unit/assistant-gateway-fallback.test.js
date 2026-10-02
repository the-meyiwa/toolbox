import test from 'node:test';
import assert from 'node:assert/strict';

for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'SUPABASE_URL', 'VITE_SUPABASE_URL']) delete process.env[key];
process.env.TOOLBOX_LOCAL_DEV_USER = '1'; // the explicit local stand-in account
process.env.GROQ_API_KEY = 'test-groq';
process.env.GEMINI_API_KEY = 'test-gemini';
process.env.ASSISTANT_GROQ_MODEL = 'groq-test';
process.env.ASSISTANT_GEMINI_MODEL = 'gemini-test';
delete process.env.ASSISTANT_ALLOW_CROSS_PROVIDER_FALLBACK;

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push(new URL(url).host);
  if (String(url).includes('groq.com'))
    return new Response(JSON.stringify({ error: { message: 'Rate limited' } }), { status: 429 });
  return new Response('data: {"choices":[{"delta":{"content":"answered"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
};

const { handleAssistantGateway } = await import('../../server-assistant.js');
async function chat(extra = {}) {
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], mode: 'fast', ...extra });
  const request = { method: 'POST', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield body; } };
  let output = '';
  const response = { headersSent: false, writeHead() { this.headersSent = true; }, write(chunk) { output += chunk; return true; }, end(chunk) { if (chunk) output += chunk; }, on() {} };
  await handleAssistantGateway(request, response, new URL('http://localhost/api/assistant/v2/chat'));
  return output;
}

test('automatic provider affinity falls through to another configured provider', async () => {
  const output = await chat({ preferredProvider: 'groq' });
  assert.match(output, /"content":"answered"/);
  assert.equal(calls[0], 'api.groq.com');
  assert.ok(calls.includes('generativelanguage.googleapis.com'));
});

test('an explicitly selected provider remains fixed', async () => {
  calls.length = 0;
  const output = await chat({ provider: 'groq' });
  assert.match(output, /No model provider could answer/);
  assert.ok(calls.every(host => host === 'api.groq.com'));
});
