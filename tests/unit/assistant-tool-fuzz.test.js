/* ============================================================
   Assistant tool fuzz.

   Every tool the Assistant can call is run the way the engine
   runs it (arguments coerced to the tool's schema first) with
   the inputs models really produce when they go wrong: nothing,
   numbers for strings, objects for text, hostile strings and
   very long ones. A tool may refuse, but it must answer in
   words: no raw JavaScript errors ("x.trim is not a function",
   "Cannot read properties of null"), no "undefined", "NaN" or
   "[object Object]" leaking into its message, and no hang.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();

const { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } = await import('../../js/lib/assistant-tools.js');
const { EXTRA_TOOL_DECLARATIONS, EXTRA_TOOL_NAMES, executeExtraTool } = await import('../../js/lib/assistant/extra-tools.js');
const { KNOWLEDGE_TOOL_DECLARATIONS, KNOWLEDGE_TOOL_NAMES, executeKnowledgeTool } = await import('../../js/lib/assistant/knowledge-tools.js');
await import('../../js/lib/ai-provider.js');
const { packDeclarations, isPackTool, executePackTool } = await import('../../js/lib/assistant/tool-packs.js');
const { coerceArgs, missingArgsResult } = await import('../../js/lib/assistant/args.js');

const decls = new Map();
for (const d of [...ASSISTANT_TOOL_DECLARATIONS, ...EXTRA_TOOL_DECLARATIONS, ...KNOWLEDGE_TOOL_DECLARATIONS, ...packDeclarations()]) {
  if (d?.name && !decls.has(d.name)) decls.set(d.name, d);
}

// Network-only or browser-only (Web Workers, audio devices) tools are covered in the browser runs.
const SKIP = new Set(['ide_git_push', 'run_speed_test', 'chess_analyze', 'chess_play', 'code_execute', 'play_sound']);

async function call(name, raw) {
  const schema = decls.get(name)?.parameters;
  const fixed = coerceArgs(raw, schema);
  if (fixed.missing.length) return missingArgsResult(name, fixed.missing, schema);
  const args = fixed.args;
  let r;
  if (isPackTool(name)) r = await executePackTool(name, args, {});
  if (r === undefined && KNOWLEDGE_TOOL_NAMES.has(name)) r = await executeKnowledgeTool(name, args);
  if (r === undefined && EXTRA_TOOL_NAMES.has(name)) r = await executeExtraTool(name, args, {});
  if (r === undefined) r = await executeAssistantTool(name, args, {});
  return r;
}

const RAW_JS = /Cannot read propert|is not a function|is not defined|is not iterable|Cannot destructure|Maximum call stack|Invalid array length/;
const LEAK = /\bundefined\b|\bNaN\b|\[object Object\]/;
const CASES = [
  ['nothing', () => ({})],
  ['numbers', (keys) => Object.fromEntries(keys.map(k => [k, -1]))],
  ['objects', (keys) => Object.fromEntries(keys.map(k => [k, { a: { b: null } }]))],
  ['hostile text', (keys) => Object.fromEntries(keys.map(k => [k, '😀‮<script>x</script> ../../etc']))],
  ['long text', (keys) => Object.fromEntries(keys.map(k => [k, 'x'.repeat(20000)]))],
];
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`no answer within ${ms} ms`)), ms))]);

test('Assistant tools answer bad arguments in words, never with crashes or leaks', { timeout: 600_000 }, async () => {
  const failures = [];
  let calls = 0;
  assert.ok(decls.size >= 120, `only ${decls.size} tools declared`);
  for (const [name, d] of decls) {
    if (SKIP.has(name)) continue;
    calls += CASES.length;
    const keys = Object.keys(d.parameters?.properties || {});
    for (const [label, make] of CASES) {
      try {
        const r = await withTimeout(call(name, make(keys)), 8000);
        const text = [r?.message, r?.error, r?.summary].filter(x => typeof x === 'string').join(' | ');
        if (RAW_JS.test(text) || LEAK.test(text)) failures.push(`${name} [${label}]: ${text.slice(0, 160)}`);
      } catch (err) {
        const msg = String(err?.message || err);
        // A thrown, plainly worded refusal is caught by the engine and shown as such; a raw JS error or a hang is a bug.
        if (RAW_JS.test(msg) || /no answer within/.test(msg)) failures.push(`${name} [${label}] threw: ${msg.slice(0, 160)}`);
      }
    }
  }
  assert.ok(calls >= 600, `only ${calls} calls made`);
  assert.deepEqual(failures, [], `\n${failures.join('\n')}`);
});
