/* Scripted model replies exercise the real Assistant tool loop without contacting
   an AI provider or spending credits. The scenarios run hardest to easiest. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
window.location.hostname = 'localhost';
window.location.origin = 'http://localhost:3000';
const { streamChatCompletion, setConfirmOverride } = await import('../../js/lib/ai-provider.js');

const declaration = (name, properties = {}, required = []) => ({
  name, description: name, parameters: { type: 'object', properties, required },
});
const textArg = { type: 'string' };
const numberArg = { type: 'number' };

function turn({ text, calls = [] }) {
  const events = [
    'event: provider\ndata: {"provider":"scripted","label":"Offline scripted model","model":"offline"}\n\n',
    `data: ${JSON.stringify({ choices: [{ delta: { ...(text ? { content: text } : {}), ...(calls.length ? { tool_calls: calls.map(([name, args], index) => ({ index, id: `call_${index}`, type: 'function', function: { name, arguments: JSON.stringify(args) } })) } : {}) }, finish_reason: calls.length ? 'tool_calls' : 'stop' }] })}\n\n`,
    'data: [DONE]\n\n',
  ];
  return new Response(events.join(''), { headers: { 'content-type': 'text/event-stream' } });
}

async function scenario({ prompt, declarations, turns, executor, verify, maxSteps = 12 }) {
  const original = globalThis.fetch;
  const requests = [];
  let count = 0;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/api/assistant/v2/chat', `Unexpected network request: ${url}`);
    const body = JSON.parse(options.body);
    requests.push(body);
    assert.ok(count < turns.length, 'Assistant made extra model requests');
    return turn(turns[count++]);
  };
  try {
    const events = [];
    const result = await streamChatCompletion({
      scope: 'test', history: [{ role: 'user', content: prompt }],
      toolDeclarations: declarations, toolExecutor: executor,
      turnId: 'turn_offline_stress', maxSteps,
      onToolCallResult: (name, value) => events.push([name, value]),
    });
    assert.equal(count, turns.length);
    await verify({ result, requests, events });
  } finally {
    globalThis.fetch = original;
    setConfirmOverride(null);
  }
}

test('hardest: vague multi-step request recovers from a failed write and verifies the result', async () => {
  const calls = [];
  let saveAttempts = 0;
  await scenario({
    prompt: 'Make sense of the upcoming work, put a useful summary somewhere, and make sure it stuck.',
    declarations: [
      declaration('find_work', { query: textArg }, ['query']),
      declaration('summarize_work', { items: textArg }, ['items']),
      declaration('save_summary', { title: textArg, body: textArg }, ['title', 'body']),
      declaration('verify_summary', { title: textArg }, ['title']),
    ],
    turns: [
      { calls: [['find_work', { query: 'upcoming work' }]] },
      { calls: [['summarize_work', { items: 'two deadlines and one blocked project' }]] },
      { calls: [['save_summary', { title: 'Upcoming work', body: 'Two deadlines; resolve blocked project.' }]] },
      { calls: [['save_summary', { title: 'Upcoming work', body: 'Two deadlines; resolve blocked project.' }]] },
      { calls: [['verify_summary', { title: 'Upcoming work' }]] },
      { text: 'I saved and verified the upcoming work summary.' },
    ],
    executor: async (name, args) => {
      calls.push([name, args]);
      if (name === 'save_summary' && ++saveAttempts === 1) return { status: 'error', success: false, message: 'Temporary storage error' };
      return { status: 'success', message: name === 'verify_summary' ? 'Saved summary found.' : 'Done.' };
    },
    verify: ({ result, requests }) => {
      assert.equal(saveAttempts, 2, 'A failed write must be retried rather than served from cache');
      assert.deepEqual(calls.map(([name]) => name), ['find_work', 'summarize_work', 'save_summary', 'save_summary', 'verify_summary']);
      assert.match(requests[3].messages.at(-1).content, /Temporary storage error/);
      assert.equal(result.toolResults.length, 5);
      assert.match(result.text, /saved and verified/i);
    },
  });
});

test('hard: malformed tool arguments are reported, then corrected without executing an unsafe call', async () => {
  const calls = [];
  await scenario({
    prompt: 'Work out what each crew member gets from this total and check the units.',
    declarations: [declaration('divide_budget', { total: numberArg, people: numberArg }, ['total', 'people'])],
    turns: [
      { calls: [['divide_budget', { total: '₦1,500' }]] },
      { calls: [['divide_budget', { total: '₦1,500', people: '3' }]] },
      { text: 'Each of the three people gets ₦500.' },
    ],
    executor: async (name, args) => { calls.push(args); return { status: 'success', amount: args.total / args.people, message: '₦500 each.' }; },
    verify: ({ result, requests, events }) => {
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0], { total: 1500, people: 3 });
      assert.match(events[0][1].message, /needs people/i);
      assert.match(requests[1].messages.at(-1).content, /missing_arguments/);
      assert.match(result.text, /500/);
    },
  });
});

test('medium: a destructive tool is never executed after the person declines', async () => {
  let executed = false;
  setConfirmOverride(() => false);
  await scenario({
    prompt: 'Clean up that old file.',
    declarations: [declaration('delete_file', { path: textArg }, ['path'])],
    turns: [{ calls: [['delete_file', { path: '/old.txt' }]] }, { text: 'I did not delete the file.' }],
    executor: async () => { executed = true; return { status: 'success' }; },
    verify: ({ result, events }) => {
      assert.equal(executed, false);
      assert.equal(events[0][1].status, 'cancelled');
      assert.match(result.text, /did not delete/i);
    },
  });
});

test('medium: approved deletion passes an explicit confirmation flag to the tool', async () => {
  let received = null;
  setConfirmOverride(() => true);
  await scenario({
    prompt: 'Delete the old file after asking me.',
    declarations: [declaration('delete_file', { path: textArg }, ['path'])],
    turns: [{ calls: [['delete_file', { path: '/old.txt' }]] }, { text: 'I deleted the old file.' }],
    executor: async (_name, args) => { received = args; return { status: 'success', message: 'Deleted.' }; },
    verify: () => assert.deepEqual(received, { path: '/old.txt', confirmed: true }),
  });
});

test('medium: repeating a declined action never prompts the person twice', async () => {
  let prompts = 0;
  setConfirmOverride(() => { prompts++; return false; });
  await scenario({
    prompt: 'Delete the old file only if I approve.',
    declarations: [declaration('delete_file', { path: textArg }, ['path'])],
    turns: [
      { calls: [['delete_file', { path: '/old.txt' }]] },
      { calls: [['delete_file', { path: '/old.txt' }]] },
      { text: 'I left the file alone.' },
    ],
    executor: async () => { throw new Error('A declined action must not execute'); },
    verify: () => assert.equal(prompts, 1),
  });
});

test('medium: an invented tool name is refused without dispatching any real operation', async () => {
  let executed = false;
  await scenario({
    prompt: 'Find my old work.',
    declarations: [declaration('find_work', { query: textArg }, ['query'])],
    turns: [{ calls: [['invented_super_search', { query: 'old work' }]] }, { text: 'I could not run that search.' }],
    executor: async () => { executed = true; },
    verify: ({ events }) => {
      assert.equal(executed, false);
      assert.equal(events[0][1].error, 'unknown_tool');
    },
  });
});

test('easy: a single useful tool call returns a concrete answer', async () => {
  await scenario({
    prompt: 'Split 84 equally among 7 people.',
    declarations: [declaration('divide', { total: numberArg, people: numberArg }, ['total', 'people'])],
    turns: [{ calls: [['divide', { total: '84', people: 7 }]] }, { text: 'Each person gets 12.' }],
    executor: async (_name, args) => ({ status: 'success', result: args.total / args.people, message: '12' }),
    verify: ({ result }) => { assert.match(result.text, /12/); assert.equal(result.toolResults[0].result, 12); },
  });
});

test('easiest: simple chat does not call a tool', async () => {
  await scenario({
    prompt: 'Thanks.',
    declarations: [declaration('unused_tool')],
    turns: [{ text: 'You are welcome.' }],
    executor: async () => { throw new Error('No tool should run'); },
    verify: ({ result }) => { assert.equal(result.toolResults.length, 0); assert.match(result.text, /welcome/i); },
  });
});

test('Reaching the tool step limit keeps the final answer in the original quota turn', async () => {
  await scenario({
    prompt:'Do what you can and give a summary.',maxSteps:1,
    declarations:[declaration('find_work')],
    turns:[{ calls:[['find_work',{}]] },{ text:'I found the work and reached the step limit.' }],
    executor:async () => ({ status:'success',message:'Work found' }),
    verify:({ requests,result }) => {
      assert.equal(requests[0].turnId,requests[1].turnId);
      assert.deepEqual(requests[0].messages.filter(m => m.role==='user'),requests[1].messages.filter(m => m.role==='user'));
      assert.match(requests[1].messages[0].content,/available tool steps/);
      assert.match(result.text,/step limit/);
    },
  });
});
