/* ============================================================
   Gateway: the quick lane.

   Plain questions and writing go out with no tools, a capped
   reply and the quick models. The server re-checks every quick
   request, so it can never be a cheap way to run real work.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

for (const k of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'SUPABASE_URL', 'VITE_SUPABASE_URL']) delete process.env[k];
process.env.TOOLBOX_LOCAL_DEV_USER = '1';
process.env.GEMINI_API_KEY = 'test-key';
delete process.env.ASSISTANT_GEMINI_MODEL;

const sent = [];
globalThis.fetch = async (url, opts = {}) => {
  sent.push(JSON.parse(opts.body || '{}'));
  return new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
};

const { handleAssistantGateway } = await import('../../server-assistant.js');

async function chat(payload) {
  const text = JSON.stringify(payload);
  const request = { method: 'POST', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield text; } };
  let out = '';
  const response = { headersSent: false, writeHead() { this.headersSent = true; }, write(c) { out += c; return true; }, end(c) { if (c) out += c; }, on() {}, setHeader() {} };
  await handleAssistantGateway(request, response, new URL('http://localhost/api/assistant/v2/chat'));
  return out;
}
const TOOL = [{ type: 'function', function: { name: 'browse_web', description: 'x', parameters: { type: 'object', properties: {} } } }];
const user = (content) => ({ role: 'user', content });

test('Gateway quick: no tools, a capped reply, the quick models, no deep reasoning', async () => {
  sent.length = 0;
  const out = await chat({ mode: 'quick', messages: [user('Explain VAT briefly')], tools: TOOL });
  assert.match(out, /"content":"hi"/);
  const body = sent[0];
  assert.equal(body.tools, undefined, 'tools are stripped from a quick request');
  assert.ok(body.max_tokens > 0 && body.max_tokens <= 2000, `reply capped (${body.max_tokens})`);
  assert.equal(body.model, 'gemini-flash-lite-latest', 'the quick model leads');
  assert.notEqual(body.reasoning_effort, 'high');
});

test('Gateway quick: heavy or tool-shaped requests are demoted to the normal lane', async () => {
  // Images: not a plain chat.
  sent.length = 0;
  await chat({ mode: 'quick', messages: [{ role: 'user', content: [{ type: 'text', text: 'what is this' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] }], tools: TOOL });
  assert.ok(sent[0].tools, 'an image request keeps its tools: it was not treated as quick');
  assert.equal(sent[0].max_tokens, undefined);
  // A long conversation.
  sent.length = 0;
  const long = Array.from({ length: 30 }, (_, i) => (i % 2 ? { role: 'assistant', content: 'ok' } : user('q')));
  await chat({ mode: 'quick', messages: [...long, user('last')], tools: TOOL });
  assert.equal(sent[0].max_tokens, undefined);
  // A tool turn.
  sent.length = 0;
  await chat({ mode: 'quick', messages: [user('go'), { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'browse_web', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'a', content: '{}' }, user('and?')], tools: TOOL });
  assert.equal(sent[0].max_tokens, undefined);
  // A huge request.
  sent.length = 0;
  await chat({ mode: 'quick', messages: [user('x'.repeat(60_000))], tools: TOOL });
  assert.equal(sent[0].max_tokens, undefined);
});

test('Gateway quick: normal modes are unchanged', async () => {
  sent.length = 0;
  await chat({ mode: 'auto', messages: [user('Explain VAT briefly')], tools: TOOL });
  assert.ok(sent[0].tools, 'auto keeps its tools');
  assert.equal(sent[0].max_tokens, undefined);
  assert.equal(sent[0].model, 'gemini-flash-latest');
});
