/* ============================================================
   TOOLBOX — Assistant evaluation runner

   Runs the cases in cases.js straight through the Assistant engine
   (streamChatCompletion, no chat UI), in the signed-in browser, and
   scores each reply. See README.md in this folder.

     const m = await toolboxEvalLoad();
     const r = await m.run({ categories: ['math'] });
     console.table(m.table(r));

   While a run is active:
   - confirmation dialogs are answered "Don't allow" automatically;
   - tools that navigate the app (open_toolbox_tool, chess_open_board,
     the Automobile Guide) are stubbed, and the page hash is restored;
   - the Assistant memory is restored to what it was before the run.
   ============================================================ */

import { streamChatCompletion, setConfirmOverride, STORAGE_AI_MEMORY } from '../../ai-provider.js';
import { executeExtraTool } from '../extra-tools.js';
import { CASES, CATEGORIES } from './cases.js';

export const cases = CASES;
export const categories = CATEGORIES;

const DEFAULTS = { concurrency: 2, mode: 'auto', timeoutMs: 60000, delayMs: 1500, retries: 1 };
const RETRYABLE = /network|failed to fetch|load failed|502|503|504|429|rate|closed the connection|unexpected format|stopped unexpectedly/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* ---------------- request observer ----------------
   update_memory and load_tools are handled inside the engine without the
   onToolCall callbacks, so every tool call is also read from the requests
   the engine sends (each carries our turnId). */

let observed = null;            // turnId → { requests, calls: Map(id → {name,args}), bytes, statuses }
let realFetch = null;

function installObserver() {
  if (observed) return;
  observed = new Map();
  realFetch = window.fetch;
  const orig = realFetch;
  window.fetch = async function evalFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    let rec = null;
    if (/\/api\/assistant\/v2\/chat/.test(url) && typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        rec = body.turnId && observed?.get(body.turnId);
        if (rec) {
          rec.requests++;
          rec.bytes += init.body.length;
          rec.toolCount = Array.isArray(body.tools) ? body.tools.length : 0;
          for (const m of body.messages || []) {
            for (const tc of m.tool_calls || []) {
              if (rec.calls.has(tc.id)) continue;
              let args = {};
              try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = { raw: tc.function?.arguments }; }
              rec.calls.set(tc.id, { name: tc.function?.name, args });
            }
          }
        }
      } catch { /* not ours */ }
    }
    const res = await orig.apply(this, arguments);
    if (rec) rec.statuses.push(res.status);
    return res;
  };
}

function removeObserver() {
  if (realFetch) window.fetch = realFetch;
  realFetch = null;
  observed = null;
}

/* ---------------- tool guard: no navigation during eval ---------------- */

const NAVIGATING = new Set(['open_toolbox_tool', 'chess_open_board']);

async function evalToolExecutor(name, args) {
  if (NAVIGATING.has(name)) {
    return { status: 'success', evalStub: true, message: `Opened ${args?.tool_id || 'the board'} for the person.` };
  }
  if (name === 'vehicle_lookup' && args?.open_guide) return executeExtraTool(name, { ...args, open_guide: false });
  return undefined;   // run the real tool
}

/* ---------------- scoring ---------------- */

function rx(src) {
  try { return new RegExp(src, 'iu'); } catch { /* not valid with u */ }
  try { return new RegExp(src, 'i'); } catch { return null; }
}

/** Every number in the text, tolerant of 1,234.5 / 1 234 / LaTeX 1{,}234 / "8.8 million". */
export function extractNumbers(text) {
  const t = String(text || '')
    .replace(/\{,\}/g, ',').replace(/\\[,;!]/g, '')
    .replace(/(\d)[   ](?=\d{3}\b)/g, '$1')
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
  const out = [];
  for (const m of t.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(\s*(?:million|m\b|billion|bn\b|k\b))?/gi)) {
    let n = Number(m[0].replace(m[1] || '', ''));
    if (!Number.isFinite(n)) continue;
    out.push(n);
    const unit = (m[1] || '').trim().toLowerCase();
    if (unit === 'million' || unit === 'm') out.push(n * 1e6);
    else if (unit === 'billion' || unit === 'bn') out.push(n * 1e9);
    else if (unit === 'k') out.push(n * 1e3);
    if (n < 0) out.push(-n);
  }
  return out;
}

export function scoreCase(testCase, run) {
  const e = testCase.expect || {};
  const checks = [];
  const add = (check, pass, detail = '') => checks.push({ check, pass: Boolean(pass), detail });
  const names = run.tools.map(t => t.name);
  const distinct = [...new Set(names)];
  const counted = distinct.filter(n => n !== 'load_tools');
  const text = run.text || '';

  add('completed', !run.error && !run.timedOut, run.timedOut ? `timed out after ${run.totalMs} ms` : run.error || '');
  add('answered', text.trim().length > 0 || (e.declined?.length > 0), text.trim() ? '' : 'empty reply');
  if (e.tools) for (const t of e.tools) add(`tool:${t}`, names.includes(t), names.includes(t) ? '' : `not called (called: ${counted.join(', ') || 'none'})`);
  if (e.anyTool) {
    const hit = e.anyTool.find(t => names.includes(t));
    add(`anyTool:${e.anyTool.join('|')}`, hit, hit ? hit : `none called (called: ${counted.join(', ') || 'none'})`);
  }
  if (e.noTools) add('noTools', counted.length === 0, counted.length ? `called ${counted.join(', ')}` : '');
  if (e.notTools) for (const t of e.notTools) add(`notTool:${t}`, !names.includes(t), names.includes(t) ? 'was called' : '');
  if (e.minTools) {
    const n = counted.filter(x => x !== 'update_plan').length;
    add(`minTools:${e.minTools}`, n >= e.minTools, `${n} distinct tools (excluding plan)`);
  }
  if (e.args) {
    for (const [tool, pattern] of Object.entries(e.args)) {
      const r = rx(pattern);
      const calls = run.tools.filter(t => tool === '*' || t.name === tool);
      const ok = r && calls.some(t => r.test(JSON.stringify(t.args || {})));
      add(`args:${tool}~/${pattern}/`, ok, ok ? '' : calls.length ? `args: ${calls.map(t => JSON.stringify(t.args)).join(' ; ').slice(0, 300)}` : 'tool not called');
    }
  }
  if (e.declined) for (const t of e.declined) add(`declined:${t}`, run.declined.includes(t), run.declined.includes(t) ? '' : `not attempted (called: ${counted.join(', ') || 'none'})`);
  for (const p of e.textIncludes || []) {
    const r = rx(p);
    add(`includes:/${p}/`, r && r.test(text), r ? '' : 'bad regex');
  }
  for (const p of e.textExcludes || []) {
    const r = rx(p);
    const m = r && text.match(r);
    add(`excludes:/${p}/`, r && !m, m ? `found "${m[0]}"` : '');
  }
  if (e.numbers?.length) {
    const found = extractNumbers(text);
    for (const spec of e.numbers) {
      const value = typeof spec === 'number' ? spec : spec.value;
      const tol = typeof spec === 'object' && spec.tol != null ? spec.tol : Math.max(0.01, Math.abs(value) * 0.001);
      const ok = found.some(n => Math.abs(n - value) <= tol);
      add(`number:${value}±${+tol.toPrecision(3)}`, ok, ok ? '' : `not in text (numbers seen: ${found.slice(0, 12).join(', ')})`);
    }
  }
  if (e.maxMs) add(`maxMs:${e.maxMs}`, run.totalMs <= e.maxMs, `${run.totalMs} ms`);
  const failed = checks.filter(x => !x.pass);
  return { passed: failed.length === 0, checks, reasons: failed.map(x => `${x.check}${x.detail ? ` — ${x.detail}` : ''}`) };
}

/* ---------------- one case ---------------- */

async function runOnce(testCase, opts, attempt) {
  const turnId = `eval_${testCase.id}_${Date.now().toString(36)}_${attempt}`;
  const rec = { requests: 0, bytes: 0, toolCount: 0, calls: new Map(), statuses: [] };
  observed?.set(turnId, rec);
  const controller = new AbortController();
  const outer = opts.signal;
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener?.('abort', onOuterAbort);

  const started = now();
  let firstAt = null;
  const mark = () => { if (firstAt == null) firstAt = now(); };
  const started_ = new Map();     // call id → { name, args }
  const results = new Map();      // call id → result
  const order = [];
  const run = { text: '', thinking: '', provider: null, model: null, fixes: [], error: null, timedOut: false };
  let streamedText = '';

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { run.timedOut = true; controller.abort(); resolve('timeout'); }, opts.timeoutMs);
  });
  try {
    const history = [...(testCase.history || []), { role: 'user', content: testCase.prompt }];
    const res = await Promise.race([
      streamChatCompletion({
        mode: testCase.mode || opts.mode,
        history,
        turnId,
        idempotencyKey: turnId,
        signal: controller.signal,
        toolExecutor: evalToolExecutor,
        onToken: (t) => { mark(); streamedText += t; },
        onThinking: () => {},
        onToolCallStart: (name, args, id) => { mark(); const key = id || `${name}_${order.length}`; started_.set(key, { name, args }); order.push(key); },
        onToolCallResult: (name, result, id) => { results.set(id || `${name}_${order.length - 1}`, result); },
        onProvider: (p) => { run.provider = p?.label || p?.provider || null; run.model = p?.model || null; },
      }),
      // A hung tool can outlive the abort; give it 5 s more, then give up.
      timeout.then(() => sleep(5000)).then(() => ({ __timeout: true })),
    ]);
    if (res && !res.__timeout) {
      run.text = res.text || '';
      run.thinking = res.thinking || '';
      run.fixes = res.fixes || [];
      run.provider = res.provider || run.provider;
      run.model = res.model || run.model;
    } else {
      run.text = streamedText;
    }
  } catch (err) {
    run.text = streamedText;
    if (!run.timedOut) { run.error = err?.message || String(err); run.errorStatus = err?.status || null; }
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener?.('abort', onOuterAbort);
    observed?.delete(turnId);
  }
  run.totalMs = Math.round(now() - started);
  run.ttftMs = firstAt == null ? null : Math.round(firstAt - started);

  // Tools: those the engine reported, plus any seen only in the requests (update_memory, load_tools).
  const tools = [];
  const seen = new Set();
  for (const key of order) {
    const s = started_.get(key);
    const r = results.get(key);
    seen.add(key);
    tools.push({ name: s.name, args: s.args || {}, status: r?.status || (r ? 'success' : 'no result'), error: r && (r.status === 'error' || (r.success === false && r.status !== 'cancelled')) ? (r.error || r.message || 'failed') : null });
  }
  for (const [id, call] of rec.calls) {
    if (seen.has(id)) continue;
    const dup = tools.find(t => t.name === call.name && JSON.stringify(t.args) === JSON.stringify(call.args));
    if (dup) continue;
    tools.push({ name: call.name, args: call.args, status: 'handled in engine', error: null });
  }
  run.tools = tools;
  run.toolErrors = tools.filter(t => t.error).map(t => ({ name: t.name, error: String(t.error).slice(0, 300) }));
  run.declined = tools.filter(t => t.status === 'cancelled').map(t => t.name);
  run.requests = rec.requests;
  run.requestBytes = rec.bytes;
  run.toolsSent = rec.toolCount;
  run.httpStatuses = rec.statuses;
  return run;
}

async function runCase(testCase, opts) {
  let run;
  let attempts = 0;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    attempts++;
    run = await runOnce(testCase, opts, attempt);
    const retryable = run.error && !opts.signal?.aborted && (RETRYABLE.test(run.error) || [429, 500, 502, 503, 504].includes(run.errorStatus));
    if (!retryable || attempt === opts.retries) break;
    await sleep(run.errorStatus === 429 || /429|rate/i.test(run.error) ? 8000 : 2500);
  }
  const score = scoreCase(testCase, run);
  return {
    id: testCase.id,
    category: testCase.category,
    prompt: testCase.prompt,
    passed: score.passed,
    reasons: score.reasons,
    checks: score.checks,
    attempts,
    provider: run.provider,
    model: run.model,
    ttftMs: run.ttftMs,
    totalMs: run.totalMs,
    timedOut: run.timedOut,
    error: run.error,
    tools: run.tools,
    toolNames: run.tools.map(t => t.name),
    toolErrors: run.toolErrors,
    declined: run.declined,
    fixes: run.fixes,
    requests: run.requests,
    requestKB: Math.round((run.requestBytes || 0) / 1024),
    toolsSent: run.toolsSent,
    text: run.text,
  };
}

/* ---------------- summary ---------------- */

function pct(list, p) {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

export function summarize(results, extra = {}) {
  const ms = results.map(r => r.totalMs).filter(Number.isFinite);
  const ttft = results.map(r => r.ttftMs).filter(Number.isFinite);
  const byCategory = {};
  const providers = {};
  const models = {};
  for (const r of results) {
    const c = byCategory[r.category] || (byCategory[r.category] = { total: 0, passed: 0, failed: 0, avgMs: 0 });
    c.total++; r.passed ? c.passed++ : c.failed++;
    c.avgMs += r.totalMs;
    const p = r.provider || (r.error ? 'error' : 'unknown');
    providers[p] = (providers[p] || 0) + 1;
    if (r.model) models[r.model] = (models[r.model] || 0) + 1;
  }
  for (const c of Object.values(byCategory)) { c.avgMs = Math.round(c.avgMs / c.total); c.passRate = +(c.passed / c.total * 100).toFixed(1); }
  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? +(passed / results.length * 100).toFixed(1) : 0,
    errors: results.filter(r => r.error).length,
    timeouts: results.filter(r => r.timedOut).length,
    toolErrors: results.reduce((n, r) => n + r.toolErrors.length, 0),
    figureFixes: results.reduce((n, r) => n + (r.fixes?.length || 0), 0),
    retried: results.filter(r => r.attempts > 1).length,
    avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
    p50Ms: pct(ms, 50),
    p90Ms: pct(ms, 90),
    avgTtftMs: ttft.length ? Math.round(ttft.reduce((a, b) => a + b, 0) / ttft.length) : null,
    p90TtftMs: pct(ttft, 90),
    byCategory,
    providers,
    models,
    ...extra,
  };
}

/** Rows for console.table. */
export function table(report) {
  return (report?.results || []).map(r => ({
    id: r.id, cat: r.category, pass: r.passed ? 'PASS' : 'FAIL', ms: r.totalMs, ttft: r.ttftMs,
    provider: r.provider, tools: r.toolNames.join(','), why: r.reasons.join(' | ').slice(0, 160),
  }));
}

/* ---------------- run ---------------- */

export function selectCases({ ids, categories: cats, exclude } = {}) {
  let list = CASES;
  if (ids?.length) list = list.filter(x => ids.includes(x.id));
  if (cats?.length) list = list.filter(x => cats.includes(x.category));
  if (exclude?.length) list = list.filter(x => !exclude.includes(x.id) && !exclude.includes(x.category));
  return list;
}

let running = false;

/**
 * run({ ids?, categories?, exclude?, cases?, concurrency=2, mode='auto', timeoutMs=60000,
 *       delayMs=1500, retries=1, signal?, onProgress? }) → { summary, results }
 */
export async function run(options = {}) {
  if (running) throw new Error('An evaluation is already running.');
  const opts = { ...DEFAULTS, ...options };
  const list = options.cases || selectCases(options);
  if (!list.length) throw new Error('No cases match.');
  running = true;
  const startedAt = new Date();
  const t0 = now();
  const hash = window.location.hash;
  let memory = null;
  try { memory = localStorage.getItem(STORAGE_AI_MEMORY); } catch { /* storage blocked */ }
  const declinedLog = [];
  setConfirmOverride((name, args, question) => { declinedLog.push({ name, args, question }); return false; });
  installObserver();

  const results = new Array(list.length);
  let next = 0, done = 0;
  const worker = async (slot) => {
    if (slot) await sleep(slot * Math.min(opts.delayMs, 1000));   // stagger the first requests
    while (next < list.length && !opts.signal?.aborted) {
      const i = next++;
      const r = await runCase(list[i], opts);
      results[i] = r;
      done++;
      if (window.location.hash !== hash) { try { history.replaceState(null, '', hash || window.location.pathname + window.location.search); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch { /* ignore */ } }
      try { opts.onProgress?.({ done, total: list.length, result: r }); } catch { /* caller's problem */ }
      if (opts.log !== false) console.log(`[eval] ${done}/${list.length} ${r.passed ? 'PASS' : 'FAIL'} ${r.id} ${r.totalMs}ms ${r.provider || ''} ${r.toolNames.join(',')}${r.passed ? '' : ` — ${r.reasons.join(' | ').slice(0, 200)}`}`);
      if (next < list.length && opts.delayMs) await sleep(opts.delayMs);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, list.length)) }, (_, k) => worker(k)));
  } finally {
    setConfirmOverride(null);
    removeObserver();
    try {
      if (memory == null) localStorage.removeItem(STORAGE_AI_MEMORY); else localStorage.setItem(STORAGE_AI_MEMORY, memory);
      window.dispatchEvent(new CustomEvent('toolbox:assistant-memory', { detail: { memory: JSON.parse(memory || '[]') } }));
    } catch { /* storage blocked */ }
    running = false;
  }
  const finished = results.filter(Boolean);
  const report = {
    summary: summarize(finished, {
      mode: opts.mode,
      startedAt: startedAt.toISOString(),
      wallMs: Math.round(now() - t0),
      aborted: Boolean(opts.signal?.aborted),
      confirmationsDeclined: declinedLog.length,
      origin: window.location.origin,
    }),
    results: finished,
  };
  window.__toolboxEvalLast = report;
  return report;
}

export default { run, cases, categories, table, summarize, scoreCase, extractNumbers, selectCases };
