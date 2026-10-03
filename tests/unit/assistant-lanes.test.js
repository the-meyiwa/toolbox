/* ============================================================
   Assistant lanes.

   Every message takes the lightest lane that can do the job and
   moves up only when that lane falls short:
     instant → light → quick → focused → agent → deep
   These tests pin the router, the instant answers, the escalation
   gate and how the engine behaves in each lane.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
try { globalThis.window.location.hostname = 'localhost'; } catch { /* read-only */ }
if (!globalThis.window.location?.hostname) globalThis.window.location = { hostname: 'localhost', origin: 'http://localhost', hash: '' };

const requests = [];
let script = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).includes('/api/assistant/v2/chat')) return realFetch ? realFetch(url, opts) : new Response('{}', { status: 404 });
  requests.push(JSON.parse(opts.body));
  const step = script.shift() || { text: 'Done.' };
  const events = [`event: provider\ndata: ${JSON.stringify({ provider: 'test', model: 'test' })}\n\n`];
  if (step.calls) {
    events.push(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: step.calls.map(([name, args], index) => ({ index, id: `c${requests.length}_${index}`, function: { name, arguments: JSON.stringify(args) } })) } }] })}\n\n`);
  } else {
    for (const piece of step.chunks || [step.text]) events.push(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
  }
  events.push('data: [DONE]\n\n');
  return new Response(events.join(''), { headers: { 'content-type': 'text/event-stream' } });
};

const { streamChatCompletion } = await import('../../js/lib/ai-provider.js');
const { routeTurn, escalateFrom, ESCALATE_SENTINEL, laneRank, LANES } = await import('../../js/lib/assistant/lanes.js');
const { instantAnswer } = await import('../../js/lib/assistant/instant.js');
const { createEscalationGate, QUICK_SYSTEM, leanPromptFor, FOCUSED_CORE } = await import('../../js/lib/assistant/lane-prompts.js');
const { laneStats, recordLane, clearLaneLog, laneLog } = await import('../../js/lib/assistant/lane-log.js');

const lane = (text, extra = {}) => routeTurn({ text, history: [{ role: 'user', content: text }], ...extra }).lane;
const kb = (o) => JSON.stringify(o).length / 1024;

async function run(history, steps, opts = {}) {
  requests.length = 0;
  script = steps.slice();
  const tokens = [];
  const statuses = [];
  const result = await streamChatCompletion({ history, onToken: (t) => tokens.push(t), onStatus: (s) => statuses.push(s), ...opts });
  return { result, requests: requests.slice(), tokens, statuses };
}

/* ---------------- instant ---------------- */

test('instant: sums, percentages, VAT, units and the clock are answered exactly, with no model', () => {
  const now = new Date('2026-10-03T14:05:00');
  const say = (t) => instantAnswer(t, { now })?.text;
  assert.match(say('Calculate 1837 × 492'), /903,804/);
  assert.match(say('12 plus 8 times 2'), /\*\*28\*\*/);
  assert.match(say('(12+8)/4'), /\*\*5\*\*/);
  assert.match(say('0.1+0.2'), /\*\*0\.3\*\*/, 'floating point noise is removed');
  assert.match(say('2^10'), /1,024/);
  assert.match(say('What is 15% of ₦850,000?'), /₦127,500/);
  assert.match(say('What is 7.5% VAT on ₦2,500,000, and the total including VAT?'), /₦187,500[\s\S]*₦2,687,500/);
  assert.match(say('remove 7.5% vat from 107500'), /100,000[\s\S]*7,500/);
  assert.match(say('12 is what percent of 48'), /25%/);
  assert.match(say('Convert 100 km to miles'), /62\.137/);
  assert.match(say('How many metres is 40 feet?'), /12\.192/);
  assert.match(say('Convert 98.6 °F to Celsius'), /\*\*37 °C\*\*/);
  assert.match(say('How many MB in 2.5 GB?'), /2,500[\s\S]*2,560/);
  assert.match(say('what is today\'s date'), /Saturday, October 3, 2026/);
  assert.match(say('10 / 0'), /undefined/);
});

test('instant: anything it is not sure of goes on to a model', () => {
  for (const t of ['5', 'hello', '2024-05-06', '10:30', 'solve x^2-5x+6=0', 'what is 5 apples + 3', '2(3+4)', '99999999999*99999999999',
    'convert 5 kg to metres', 'What is the capital of Nigeria?', 'A container weighs 3,750 kg. What is that in pounds?', '', null, 'x'.repeat(500)]) {
    assert.equal(instantAnswer(t), null, String(t).slice(0, 40));
  }
});

/* ---------------- router ---------------- */

test('router: each message takes the lightest lane that can do the job', () => {
  assert.equal(lane('1837 × 492'), 'instant');
  assert.equal(lane('Good morning'), 'light');
  assert.equal(lane('What is the capital of Nigeria? One word.'), 'quick');
  assert.equal(lane('Make this sound more professional: "we go deliver the container next week, abeg pay balance"'), 'quick');
  assert.equal(lane('Explain an indemnity clause in plain English'), 'quick');
  assert.equal(lane('Solve x^2 - 5x + 6 = 0'), 'focused');
  assert.equal(lane('Specs of the Google Pixel 9'), 'focused');
  assert.equal(lane('Read John 3:16'), 'focused');
  assert.equal(lane('Summarise https://en.wikipedia.org/wiki/Intermodal_container'), 'focused');
  assert.equal(lane('Latest news on Nigerian import duty'), 'focused');
  assert.equal(lane('Design a 20ft site office for 3 staff with a toilet'), 'agent');
  assert.equal(lane('Create a note titled "Site visit" with: measure plot'), 'focused', 'one tool, one job');
  assert.equal(lane('Add "Delivery" to my calendar tomorrow at 10am'), 'focused');
  assert.equal(lane('Send that to Tunde'), 'agent', 'acts on their things with no obvious tool');
});

test('router: files, modes and caller-supplied tools override the message', () => {
  assert.equal(lane('What is in this?', { hasFile: true }), 'agent');
  assert.equal(lane('Prove that sqrt(2) is irrational, step by step', { mode: 'reasoning' }), 'deep');
  assert.equal(lane('What is the capital of Nigeria?', { mode: 'reasoning' }), 'deep');
  assert.equal(lane('Design a site office', { mode: 'fast' }), 'focused', 'fast mode caps at focused');
  assert.equal(lane('Explain this', { mode: 'code' }), 'quick', 'build mode does not make a plain question heavy');
  assert.equal(lane('Read John 3:16', { scope: 'study' }), 'agent', 'other scopes bring their own tools');
  assert.equal(lane('Read John 3:16', { custom: true }), 'agent');
  const deep = lane('Prove the inequality, derive the bound step by step, then critique the assumptions and finally compare with the alternative approach in depth.');
  assert.equal(deep, 'deep');
});

test('router: a follow-up to tool work keeps the tools that made it', () => {
  const history = [
    { role: 'user', content: 'Find welding supply shops in Ikeja' },
    { role: 'assistant', content: 'Here they are.', toolResults: [{ toolName: 'search_places_nearby' }] },
    { role: 'user', content: 'which one is closest' },
  ];
  const r = routeTurn({ text: 'which one is closest', history });
  assert.notEqual(r.lane, 'quick');
  assert.ok(r.groups.has('places'));
});

test('router: lanes only ever move up', () => {
  assert.equal(escalateFrom('quick', new Set()), 'agent');
  assert.equal(escalateFrom('quick', new Set(['math'])), 'focused');
  assert.equal(escalateFrom('focused'), 'agent');
  assert.equal(escalateFrom('agent'), null);
  assert.equal(escalateFrom('deep'), null);
  assert.ok(laneRank('instant') < laneRank('light') && laneRank('light') < laneRank('quick') && laneRank('quick') < laneRank('focused') && laneRank('focused') < laneRank('agent') && laneRank('agent') < laneRank('deep'));
  assert.equal(LANES.quick.tools, 'none');
});

/* ---------------- escalation gate ---------------- */

test('escalation gate: normal text flows at once; the sentinel never reaches the person', () => {
  const out = [];
  const g = createEscalationGate((t) => out.push(t));
  g.push('The capital'); g.push(' is Abuja.');
  assert.equal(out.join(''), 'The capital is Abuja.');
  assert.equal(g.escalated, false);

  const hidden = [];
  const e = createEscalationGate((t) => hidden.push(t));
  for (const piece of ['[[ESC', 'ALATE', ']]']) e.push(piece);
  e.end();
  assert.equal(e.escalated, true);
  assert.deepEqual(hidden, []);

  const near = [];
  const n = createEscalationGate((t) => near.push(t));
  n.push('[[not it'); n.end();
  assert.equal(near.join(''), '[[not it', 'text that only starts like the sentinel is released');

  const short = [];
  const s = createEscalationGate((t) => short.push(t));
  s.push('[['); s.end();
  assert.equal(short.join(''), '[[', 'a short reply held at the end is released');
});

test('prompts: quick and focused are a fraction of the agent prompt', () => {
  assert.ok(QUICK_SYSTEM.includes(ESCALATE_SENTINEL));
  assert.ok(QUICK_SYSTEM.length < 1400);
  assert.ok(leanPromptFor([]).length < 1800);
  assert.ok(FOCUSED_CORE.includes('load_tools') && !FOCUSED_CORE.includes('update_plan'));
});

/* ---------------- engine ---------------- */

test('engine: an instant message never reaches the gateway', async () => {
  const { result, requests: r, tokens, statuses } = await run([{ role: 'user', content: 'What is 15% of ₦850,000?' }], []);
  assert.equal(r.length, 0, 'no model request');
  assert.match(result.text, /₦127,500/);
  assert.equal(tokens.join(''), result.text);
  assert.equal(result.lane, 'instant');
  assert.ok(statuses.some(s => s.type === 'lane' && s.lane === 'instant'));
});

test('engine: a plain question is one small request with no tools on the quick lane', async () => {
  const { result, requests: r } = await run([{ role: 'user', content: 'What is the capital of Nigeria? One word.' }], [{ text: 'Abuja.' }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].mode, 'quick');
  assert.equal(r[0].tools, undefined);
  assert.ok(kb(r[0]) < 3, `quick request is ${kb(r[0]).toFixed(1)} KB (budget 3 KB)`);
  assert.equal(result.text, 'Abuja.');
  assert.deepEqual(result.laneTrail, ['quick']);
});

test('engine: a quick answer that needs more moves up a lane, and the sentinel is never shown', async () => {
  const { result, requests: r, tokens, statuses } = await run(
    [{ role: 'user', content: 'Explain how the new import duty rules affect my container business' }],
    [{ chunks: ['[[ESC', 'ALATE]]'] }, { text: 'Here is what applies.' }]);
  assert.equal(r.length, 2);
  assert.equal(r[0].mode, 'quick');
  assert.notEqual(r[1].mode, 'quick');
  assert.ok(Array.isArray(r[1].tools) && r[1].tools.length > 0, 'the second request carries tools');
  assert.equal(tokens.join(''), 'Here is what applies.');
  assert.ok(!result.text.includes('ESCALATE'));
  assert.deepEqual(result.laneTrail.slice(0, 1), ['quick']);
  assert.ok(result.laneTrail.length >= 2);
  assert.ok(statuses.some(s => s.type === 'lane' && s.escalated === true));
});

test('engine: the focused lane sends only the tools its groups need', async () => {
  const exec = async () => ({ status: 'success', message: 'Found 3 shops.' });
  const { result, requests: r } = await run([{ role: 'user', content: 'Find welding supply shops in Ikeja' }],
    [{ calls: [['search_places_nearby', { query: 'welding supply', location: 'Ikeja' }]] }, { text: 'Three shops found.' }], { toolExecutor: exec });
  assert.equal(r.length, 2);
  assert.equal(r[0].mode, 'fast', 'focused runs on the fast models');
  const names = r[0].tools.map(t => t.function.name);
  assert.ok(names.includes('search_places_nearby') && names.includes('load_tools'));
  assert.ok(!names.includes('update_plan'), 'no planning tool for a one-tool job');
  assert.ok(names.length < 25, `${names.length} tools sent`);
  assert.equal(result.lane, 'focused');
  assert.ok(r[0].messages[0].content.length < 4500, 'lean system prompt');
});

test('engine: a focused job that runs out of steps is handed to the agent, not cut short', async () => {
  const exec = async () => ({ status: 'success', message: 'ok' });
  const calls = Array.from({ length: LANES.focused.steps }, (_, i) => ({ calls: [['search_places_nearby', { query: `shop ${i}`, location: 'Ikeja' }]] }));
  const { result, requests: r } = await run([{ role: 'user', content: 'Find welding supply shops in Ikeja' }], [...calls, { text: 'All done.' }], { toolExecutor: exec });
  assert.equal(r.length, LANES.focused.steps + 1);
  assert.equal(r[0].mode, 'fast');
  const last = r[r.length - 1];
  assert.equal(last.mode, 'auto', 'the agent takes over');
  assert.ok(last.tools.map(t => t.function.name).includes('update_plan'), 'with the full tool set');
  assert.deepEqual(result.laneTrail, ['focused', 'agent']);
  assert.equal(result.text.trim().endsWith('All done.'), true);
});

test('engine: two failing tools in a focused job hand it to the agent', async () => {
  const exec = async () => ({ status: 'error', success: false, error: 'bad input', message: 'did not work' });
  const { result, requests: r } = await run([{ role: 'user', content: 'Find welding supply shops in Ikeja' }],
    [{ calls: [['search_places_nearby', { query: 'a', location: 'b' }], ['find_place', { query: 'c' }]] }, { text: 'Could not find them.' }], { toolExecutor: exec });
  assert.deepEqual(result.laneTrail, ['focused', 'agent']);
  assert.equal(r[r.length - 1].mode, 'auto');
});

test('engine: deep thinking mode asks for the reasoning models', async () => {
  const { result, requests: r } = await run([{ role: 'user', content: 'Why is the sky blue?' }], [{ text: 'Rayleigh scattering.' }], { mode: 'reasoning' });
  assert.equal(r[0].mode, 'reasoning');
  assert.equal(result.lane, 'deep');
});

test('engine: small talk is still a light turn, and the lane is recorded', async () => {
  clearLaneLog();
  const { r = null } = {};
  const { requests: reqs } = await run([{ role: 'user', content: 'hi' }], [{ text: 'Hello!' }]);
  assert.equal(reqs[0].mode, 'light');
  const log = laneLog();
  assert.equal(log.at(-1).lane, 'light');
  assert.ok(log.at(-1).totalMs >= 0);
  assert.equal(r, null);
});

/* ---------------- telemetry ---------------- */

test('lane log: summarises time to first word and escalations per starting lane', () => {
  clearLaneLog();
  recordLane({ lane: 'quick', trail: ['quick'], firstMs: 300, totalMs: 900 });
  recordLane({ lane: 'quick', trail: ['quick'], firstMs: 500, totalMs: 1100 });
  recordLane({ lane: 'agent', trail: ['quick', 'agent'], firstMs: 2500, totalMs: 6000, steps: 3 });
  recordLane({ lane: 'instant', trail: ['instant'], firstMs: 0, totalMs: 1 });
  const stats = laneStats();
  assert.equal(stats.quick.turns, 3);
  assert.equal(stats.quick.escalated, 1);
  assert.equal(stats.instant.turns, 1);
  assert.ok(stats.quick.firstP50 >= 300);
  clearLaneLog();
  assert.equal(laneLog().length, 0);
});
