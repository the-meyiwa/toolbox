/* ============================================================
   Code Playground agent: model fallback.
   When Gemini runs out of quota or stops responding, the agent
   must carry on through the multi-provider gateway (OpenRouter,
   Groq, OpenAI, DeepSeek) instead of ending the task.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { generate, toChatMessages, fromChatTurn } = await import('../../js/lib/playground/agent.js');

const sse = (events) => new Response(events.map(([evt, data]) => `${evt ? `event: ${evt}\n` : ''}data: ${JSON.stringify(data)}\n\n`).join(''), {
  status: 200, headers: { 'Content-Type': 'text/event-stream' },
});

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null }); return handler(String(url), calls.length); };
  return fn(calls).finally(() => { globalThis.fetch = original; });
}

test('Playground agent: Gemini history converts to chat messages with matching tool ids', () => {
  const messages = toChatMessages('sys', [
    { role: 'user', parts: [{ text: 'Build it' }] },
    { role: 'model', parts: [{ text: 'Reading.' }, { functionCall: { name: 'read_file', args: { path: 'a.js' } }, thoughtSignature: 'sig' }] },
    { role: 'user', parts: [{ functionResponse: { name: 'read_file', response: { content: 'x' } } }] },
  ]);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].content, 'Build it');
  const call = messages[2].tool_calls[0];
  assert.equal(call.function.name, 'read_file');
  assert.deepEqual(JSON.parse(call.function.arguments), { path: 'a.js' });
  assert.deepEqual(call.extra_content, { google: { thought_signature: 'sig' } });
  assert.equal(messages[3].role, 'tool');
  assert.equal(messages[3].tool_call_id, call.id);
});

test('Playground agent: a gateway turn converts back to Gemini parts', () => {
  const data = fromChatTurn({ text: 'Writing', toolCalls: [{ id: 'c1', function: { name: 'write_file', arguments: '{"path":"b.js","content":"1"}' } }], finish: 'tool_calls' });
  const parts = data.candidates[0].content.parts;
  assert.equal(parts[0].text, 'Writing');
  assert.deepEqual(parts[1].functionCall, { name: 'write_file', args: { path: 'b.js', content: '1' } });
});

test('Playground agent: a bad request is reported, not retried on other models', async () => {
  localStorage.setItem('toolbox_assistant_api_key', 'student-key');
  try {
    await withFetch(() => new Response(JSON.stringify({ error: { code: 400, message: 'Invalid JSON payload' } }), { status: 400 }), async (calls) => {
      const run = { useGateway: false };
      await assert.rejects(() => generate({ system: 'sys', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], tools: [], run }), /Invalid JSON payload/);
      assert.equal(run.useGateway, false);
      assert.equal(calls.length, 1);
    });
  } finally {
    localStorage.removeItem('toolbox_assistant_api_key');
  }
});

test('Playground agent: a Gemini quota error switches the run to the gateway', async () => {
  localStorage.setItem('toolbox_assistant_api_key', 'student-key');
  try {
    await withFetch((url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' } }), { status: 429 });
      }
      if (url.endsWith('/api/assistant/v2/chat')) {
        return sse([
          ['provider', { provider: 'openrouter', label: 'OpenRouter', model: 'openrouter/auto' }],
          [null, { choices: [{ index: 0, delta: { content: 'Continuing the task.' }, finish_reason: 'stop' }] }],
        ]);
      }
      return new Response('{}', { status: 404 });
    }, async (calls) => {
      const switched = [];
      const run = { useGateway: false, onSwitch: (from, reason) => switched.push({ from, reason }) };
      const contents = [{ role: 'user', parts: [{ text: 'Keep going' }] }];
      const first = await generate({ system: 'sys', contents, tools: [], run });
      assert.equal(first.data.candidates[0].content.parts[0].text, 'Continuing the task.');
      assert.match(first.model, /OpenRouter/);
      assert.equal(run.useGateway, true);
      assert.equal(switched.length, 1);
      assert.equal(switched[0].from, 'Gemini');
      const gatewayCall = calls.find((c) => c.url.endsWith('/api/assistant/v2/chat'));
      assert.equal(gatewayCall.body.mode, 'code');

      // The rest of the run stays on the gateway instead of retrying the exhausted key.
      const before = calls.filter((c) => c.url.includes('generativelanguage')).length;
      await generate({ system: 'sys', contents, tools: [], run });
      assert.equal(calls.filter((c) => c.url.includes('generativelanguage')).length, before);
    });
  } finally {
    localStorage.removeItem('toolbox_assistant_api_key');
  }
});
