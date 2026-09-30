/* ============================================================
   Gateway: "fast" asks Gemini not to think, and a model that
   rejects that steps down to "low" (remembered), not to no
   reasoning options at all.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

for (const k of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'SUPABASE_URL', 'VITE_SUPABASE_URL']) delete process.env[k];
process.env.GEMINI_API_KEY = 'test-key';
process.env.ASSISTANT_GEMINI_MODEL = 'gemini-test';

const sent = [];
globalThis.fetch = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : {};
  sent.push(body);
  if (body.model !== 'gemini-test') return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 });
  if (body.reasoning_effort === 'none') {
    return new Response(JSON.stringify({ error: { message: "Invalid value for 'reasoning_effort': none is not supported for this model." } }), { status: 400 });
  }
  const sse = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
  return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
};

const { handleAssistantGateway } = await import('../../server-assistant.js');

async function chat(mode) {
  const payload = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], mode });
  const request = { method: 'POST', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield payload; } };
  let out = '';
  const response = { headersSent: false, writeHead() { this.headersSent = true; }, write(c) { out += c; return true; }, end(c) { if (c) out += c; }, on() {} };
  await handleAssistantGateway(request, response, new URL('http://localhost/api/assistant/v2/chat'));
  return out;
}

test('Gateway: fast mode steps down from "none" to "low" and remembers it', async () => {
  const first = await chat('fast');
  assert.match(first, /"content":"hi"/);
  const efforts = sent.filter(b => b.model === 'gemini-test').map(b => b.reasoning_effort);
  assert.deepEqual(efforts.slice(0, 2), ['none', 'low'], 'tried none, then low (not plain)');
  sent.length = 0;
  await chat('fast');
  assert.deepEqual(sent.filter(b => b.model === 'gemini-test').map(b => b.reasoning_effort), ['low'], 'the refusal is remembered');
  sent.length = 0;
  await chat('auto');
  assert.deepEqual(sent.filter(b => b.model === 'gemini-test').map(b => b.reasoning_effort), ['low'], 'other modes keep low');
});
