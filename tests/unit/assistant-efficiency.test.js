/* ============================================================
   Assistant efficiency budgets.

   Free model tiers (Gemini's especially) are limited by requests
   per day and tokens per minute. These tests fail if a request
   grows back or a common job takes more model round trips:
   - "hi" sends a small prompt and a handful of tools;
   - a website is built in one tool step (two requests in all);
   - earlier steps of a long job are compacted, not resent whole;
   - groups are picked from the person's words, not the
     Assistant's own long replies.
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
    events.push(`data: ${JSON.stringify({ choices: [{ delta: { content: step.text } }] })}\n\n`);
  }
  events.push('data: [DONE]\n\n');
  return new Response(events.join(''), { headers: { 'content-type': 'text/event-stream' } });
};

const { streamChatCompletion, compactEarlierSteps, systemPromptFor, GROUP_PROMPTS } = await import('../../js/lib/ai-provider.js');
const { selectGroups, TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');
const { projectFilesFrom } = await import('../../js/lib/assistant-tools.js');
const { findPassages } = await import('../../js/lib/assistant/life-tools.js');

const kb = (o) => JSON.stringify(o).length / 1024;
async function run(history, steps, opts = {}) {
  requests.length = 0;
  script = steps.slice();
  const result = await streamChatCompletion({ history, ...opts });
  return { result, requests: requests.slice() };
}

test('Efficiency: a greeting is a small request', async () => {
  const { requests: r } = await run([{ role: 'user', content: 'hi' }], [{ text: 'Hello!' }]);
  assert.equal(r.length, 1);
  assert.ok(kb(r[0]) < 10, `"hi" request is ${kb(r[0]).toFixed(1)} KB (budget 10 KB)`);
  assert.ok(r[0].tools.length <= 8, `${r[0].tools.length} tools sent for "hi"`);
});

test('Efficiency: a website is built in one tool step', async () => {
  const files = [
    { path: 'index.html', content: `<!doctype html><html><head><title>Bakery</title></head><body><h1>Fresh bread</h1>${'<p>Our loaves.</p>'.repeat(120)}</body></html>` },
    { path: 'style.css', content: `body{font-family:sans-serif}${'.x{color:red}'.repeat(150)}` },
    { path: 'app.js', content: 'document.querySelector("h1").addEventListener("click",()=>{});' },
  ];
  const { result, requests: r } = await run(
    [{ role: 'user', content: 'Build me a small landing page website for a bakery' }],
    [{ calls: [['ide_create_project', { name: 'efficiency-bakery', files }]] }, { text: 'Your bakery site is ready.' }],
    { mode: 'code' },
  );
  assert.equal(r.length, 2, 'one step to build, one to answer');
  const built = result.toolResults[0];
  assert.equal(built.status, 'success', built.message);
  assert.equal(built.type, 'ide-preview');
  assert.deepEqual(built.files, ['index.html', 'style.css', 'app.js']);
  assert.match(built.htmlBundle, /Fresh bread/);
  // The preview bundle is for the person, not the model.
  const toolMsg = r[1].messages.find(m => m.role === 'tool');
  assert.ok(!toolMsg.content.includes('Our loaves'), 'the built HTML is not sent back to the model');
  const total = r.reduce((s, x) => s + kb(x), 0);
  assert.ok(total < 60, `website job sent ${total.toFixed(1)} KB (budget 60 KB)`);
  const names = r[0].tools.map(t => t.function.name);
  assert.ok(names.includes('ide_create_project'));
  assert.ok(!names.includes('design_container') && !names.includes('estimate_construction'), '"build a website" does not load the construction tools');
  assert.ok(!names.includes('pdf_process'), '"landing page" does not load the PDF tools');
});

test('Efficiency: earlier steps are compacted, the last two stay whole', () => {
  const big = 'x'.repeat(5000);
  const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }];
  for (let i = 0; i < 4; i++) {
    msgs.push({ role: 'assistant', content: null, tool_calls: [{ id: `c${i}`, type: 'function', function: { name: 'ide_write_file', arguments: JSON.stringify({ path: `/p/${i}.js`, content: big }) } }] });
    msgs.push({ role: 'tool', tool_call_id: `c${i}`, content: `result ${i} ${big}` });
  }
  compactEarlierSteps(msgs);
  const args = (i) => JSON.parse(msgs[2 + i * 2].tool_calls[0].function.arguments);
  assert.equal(args(0).path, '/p/0.js', 'short values are kept');
  assert.match(args(0).content, /5000 characters, already sent/);
  assert.match(args(1).content, /already sent/);
  assert.equal(args(2).content, big, 'recent steps are untouched');
  assert.equal(args(3).content, big);
  assert.ok(msgs[3].content.length < 1700);
  assert.equal(msgs[9].content.length, `result 3 ${big}`.length);
  // Idempotent, and no extra keys that providers would reject.
  compactEarlierSteps(msgs);
  assert.ok(msgs.every(m => !('compacted' in m)));
});

test('Efficiency: the system prompt carries only the loaded groups\' rules', () => {
  const core = systemPromptFor([]);
  assert.ok(core.length < 3200, `core prompt is ${core.length} characters`);
  assert.ok(!core.includes('vehicle_part'));
  const withVehicles = systemPromptFor(['vehicles']);
  assert.ok(withVehicles.includes('vehicle_part'));
  for (const id of Object.keys(GROUP_PROMPTS)) assert.ok(TOOL_GROUPS[id], `prompt for unknown group "${id}"`);
});

test('Efficiency: groups come from the person\'s words, not the Assistant\'s replies', () => {
  const history = [
    { role: 'user', content: 'what is the capital of France?' },
    { role: 'assistant', content: 'Paris. I can also build websites, analyse data, draw charts, read PDF documents and design container buildings.' },
    { role: 'user', content: 'thanks' },
  ];
  const groups = selectGroups({ history });
  for (const g of ['code', 'data', 'documents', 'building']) assert.ok(!groups.has(g), `${g} was loaded from the Assistant's own text`);
  assert.ok(selectGroups({ history: [{ role: 'user', content: 'every weekday at 8 send me a briefing' }] }).has('automation'));
  const vaguePlanning = selectGroups({ history: [{ role: 'user', content: 'What should I focus on this week? Turn my action items into a note.' }] });
  assert.ok(vaguePlanning.has('calendar') && vaguePlanning.has('notes'), 'vague personal planning needs calendar and notes tools');
  assert.ok(selectGroups({ history: [{ role: 'user', content: 'Help me make sense of my day.' }] }).has('calendar'));
});

test('Efficiency: tool schemas are trimmed', async () => {
  const { requests: r } = await run([{ role: 'user', content: 'solve x^2 - 5x + 6 = 0' }], [{ text: 'x = 2 or 3' }]);
  for (const t of r[0].tools) {
    assert.ok(t.function.description.length <= 490, `${t.function.name} description is ${t.function.description.length} characters`);
    for (const [k, p] of Object.entries(t.function.parameters.properties || {})) {
      assert.ok(!p.description || p.description.length <= 270, `${t.function.name}.${k} description is ${p.description?.length}`);
    }
  }
});

test('Projects: file lists stay inside the project', () => {
  const files = projectFilesFrom([
    { path: '../../etc/passwd', content: 'x' },
    { path: '/Projects/other/index.html', content: 'ok' },
    { path: 'src/./app.js', content: 'a' },
    { path: '', content: 'skip' },
    { path: 'data.json', content: { a: 1 } },
  ]);
  assert.deepEqual(files.map(f => f[0]), ['etc/passwd', 'index.html', 'src/app.js', 'data.json']);
  assert.equal(files[3][1], '{\n  "a": 1\n}');
  assert.deepEqual(projectFilesFrom({ 'index.html': '<p>' }), [['index.html', '<p>']]);
  assert.deepEqual(projectFilesFrom('nonsense'), []);
});

test('Documents: find returns only the passages that mention the words, with pages', () => {
  const text = '[Page 1]\nThis lease is between A and B.\n\n[Page 2]\nRent is ₦2,000,000 a year, payable in advance.\n\nThe tenant keeps the garden.\n\n[Page 3]\nTermination needs three months notice.';
  const hit = findPassages(text, 'rent payable');
  assert.equal(hit.matches, 1);
  assert.match(hit.content, /\(page 2\) Rent is ₦2,000,000/);
  assert.ok(!hit.content.includes('garden'));
  assert.equal(findPassages(text, 'the a'), null, 'stop words alone are not a search');
});
