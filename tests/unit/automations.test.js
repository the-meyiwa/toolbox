/* ============================================================
   Automations: engine, schedules, catch-up, Assistant tools.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
if (typeof globalThis.window === 'undefined') globalThis.window = { dispatchEvent: () => true };
if (typeof globalThis.CustomEvent === 'undefined') globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o?.detail; } };

const A = await import('../../js/lib/automations.js');
const { triggerFrom, executeAutomationTool } = await import('../../js/lib/assistant/automation-tools.js');

const ran = [];
A.setActionRunners({
  notify: async (a, prev) => { ran.push(['notify', a.message.replace('{{previous}}', prev)]); return a.message.replace('{{previous}}', prev); },
  assistant: async (a) => { ran.push(['assistant', a.prompt]); return `answer to ${a.prompt}`; },
  note: async (a, prev) => { ran.push(['note', prev]); return prev; },
  tool: async () => { throw new Error('tool exploded'); },
  open: async () => '',
});

test.beforeEach(() => { store.clear(); ran.length = 0; });

test('Automations: presets become cron lines and read back in plain English', () => {
  assert.equal(A.cronFromPreset({ every: 'weekday', time: '08:30' }), '30 8 * * 1-5');
  assert.equal(A.cronFromPreset({ every: 'week', time: '16:00', weekday: 5 }), '0 16 * * 5');
  assert.equal(A.cronFromPreset({ every: 'month', time: '09:15', monthDay: 31 }), '15 9 28 * *', 'month days are capped at 28 so every month has one');
  assert.equal(A.cronFromPreset({ every: 'minutes', minutes: 1 }), '*/5 * * * *', 'no faster than every 5 minutes');
  assert.match(A.describeTrigger({ type: 'cron', cron: '0 8 * * 1-5' }), /Monday to Friday/);
  assert.equal(A.describeTrigger({ type: 'app-open' }), 'Whenever Toolbox opens');
});

test('Automations: invalid recipes are refused with a readable reason', () => {
  assert.throws(() => A.createAutomation({ name: 'x', trigger: { type: 'cron', cron: '* * * * *' }, actions: [{ type: 'notify', message: 'hi' }] }), /every 5 minutes/);
  assert.throws(() => A.createAutomation({ name: 'x', trigger: { type: 'cron', cron: 'not cron' }, actions: [{ type: 'notify', message: 'hi' }] }), /Expected 5 fields/);
  assert.throws(() => A.createAutomation({ name: 'x', trigger: { type: 'cron', cron: '0 8 * * *' }, actions: [] }), /at least one action/);
  assert.throws(() => A.createAutomation({ name: 'x', trigger: { type: 'cron', cron: '*/10 * * * *' }, actions: [{ type: 'assistant', prompt: 'hi' }] }), /once an hour/);
  assert.throws(() => A.createAutomation({ name: 'x', trigger: { type: 'once', at: 'someday' }, actions: [{ type: 'notify' }] }), /date and time/);
  assert.equal(A.loadAutomations().length, 0);
});

test('Automations: steps run in order and pass {{previous}} along', async () => {
  const auto = A.createAutomation({ name: 'Briefing', trigger: { type: 'cron', cron: '0 7 * * *' }, actions: [
    { type: 'assistant', prompt: 'brief me' },
    { type: 'note', title: 'Brief' },
    { type: 'notify', title: 'Ready', message: 'Got: {{previous}}' },
  ] });
  const entry = await A.runAutomation(auto.id);
  assert.equal(entry.ok, true);
  assert.deepEqual(ran.map(r => r[0]), ['assistant', 'note', 'notify']);
  assert.equal(ran[2][1], 'Got: answer to brief me');
  const saved = A.loadAutomations()[0];
  assert.equal(saved.log.length, 1);
  assert.ok(saved.lastRun);
});

test('Automations: a failing step stops the run and is logged', async () => {
  const auto = A.createAutomation({ name: 'Broken', trigger: { type: 'app-open' }, actions: [{ type: 'tool', toolId: 'word-counter' }, { type: 'notify', message: 'never' }] });
  const entry = await A.runAutomation(auto.id);
  assert.equal(entry.ok, false);
  assert.match(entry.summary, /tool exploded/);
  assert.deepEqual(ran, [], 'later steps do not run');
});

test('Automations: each scheduled time runs once, missed runs catch up within a day, older ones are skipped', async () => {
  const t0 = new Date(2026, 0, 5, 7, 30).getTime();   // a Monday, 07:30
  const auto = A.createAutomation({ name: 'Daily', trigger: { type: 'cron', cron: '0 8 * * *' }, actions: [{ type: 'notify', message: 'ding' }] });
  A.updateAutomation(auto.id, {});
  // Pretend it was created at t0.
  const list = A.loadAutomations(); list[0].lastDue = t0; list[0].createdAt = t0; localStorage.setItem(A.STORAGE_KEY_AUTOMATIONS, JSON.stringify(list));

  assert.equal((await A.runDue({ now: t0 + 20 * 60_000 })).length, 0, 'not due at 07:50');
  const at8 = await A.runDue({ now: t0 + 30 * 60_000 + 5_000 });
  assert.equal(at8.length, 1);
  assert.equal(at8[0].reason, 'scheduled');
  assert.equal((await A.runDue({ now: t0 + 31 * 60_000 })).length, 0, 'the same time does not run twice');

  // Closed all day: opened next day at 10:00, the 08:00 run catches up once.
  const next = await A.runDue({ now: t0 + 26.5 * 3600_000 });
  assert.equal(next.length, 1);
  assert.equal(next[0].reason, 'caught up');

  // Closed for a week: nothing piles up.
  assert.equal((await A.runDue({ now: t0 + 8 * 24 * 3600_000 })).length, 0);
  assert.equal(ran.length, 2);
});

test('Automations: once runs a single time and then switches itself off; paused ones never run', async () => {
  const now = Date.now();
  const once = A.createAutomation({ name: 'Once', trigger: { type: 'once', at: now + 60_000 }, actions: [{ type: 'notify', message: 'once' }] });
  const paused = A.createAutomation({ name: 'Paused', trigger: { type: 'once', at: now + 60_000 }, actions: [{ type: 'notify', message: 'no' }] });
  A.updateAutomation(paused.id, { enabled: false });
  assert.equal((await A.runDue({ now: now + 2 * 60_000 })).length, 1);
  assert.equal((await A.runDue({ now: now + 3 * 60_000 })).length, 0);
  const saved = A.loadAutomations().find(a => a.id === once.id);
  assert.equal(saved.enabled, false);
  assert.deepEqual(ran.map(r => r[1]), ['once']);
});

test('Automations: app-open runs on opening, not on every reload', async () => {
  A.createAutomation({ name: 'Hello', trigger: { type: 'app-open' }, actions: [{ type: 'notify', message: 'welcome' }] });
  const now = Date.now();
  assert.equal((await A.runDue({ now, opening: true })).length, 1);
  assert.equal((await A.runDue({ now: now + 60_000, opening: true })).length, 0);
  assert.equal((await A.runDue({ now: now + 11 * 60_000 })).length, 0, 'only when opening');
  assert.equal((await A.runDue({ now: now + 11 * 60_000, opening: true })).length, 1);
});

test('Automations: corrupt storage and junk actions are survived', () => {
  localStorage.setItem(A.STORAGE_KEY_AUTOMATIONS, '{"not":"a list"}');
  assert.deepEqual(A.loadAutomations(), []);
  localStorage.setItem(A.STORAGE_KEY_AUTOMATIONS, JSON.stringify([null, 5, { id: 'a1', name: 'x', trigger: { type: 'cron', cron: '0 8 * * *' }, actions: [{ type: 'rm -rf' }, { type: 'notify', message: 'ok' }, null] }]));
  const [a] = A.loadAutomations();
  assert.equal(a.actions.length, 1);
  assert.equal(a.actions[0].type, 'notify');
});

test('Assistant: create, list, pause, run and delete automations by name', async () => {
  assert.deepEqual(triggerFrom({ every: 'weekday', time: '08:00' }), { type: 'cron', cron: '0 8 * * 1-5' });
  assert.deepEqual(triggerFrom('app-open'), { type: 'app-open' });
  assert.equal(triggerFrom({ at: '2030-01-01T09:00' }).type, 'once');

  const made = await executeAutomationTool('create_automation', { name: 'Water', trigger: { every: 'day', time: '10:00' }, actions: [{ type: 'notify', title: 'Water', message: 'Drink' }] });
  assert.equal(made.status, 'success');
  assert.equal(made.type, 'automations');
  assert.match(made.message, /Created "Water"/);

  const bad = await executeAutomationTool('create_automation', { name: 'Spam', trigger: { cron: '* * * * *' }, actions: [{ type: 'notify', message: 'x' }] });
  assert.equal(bad.status, 'error');

  const listed = await executeAutomationTool('list_automations', {});
  assert.equal(listed.automations.length, 1);
  assert.equal(listed.automations[0].steps, 'notify');

  const paused = await executeAutomationTool('update_automation', { automation: 'water', enabled: false });
  assert.match(paused.message, /paused/);
  assert.equal(A.loadAutomations()[0].enabled, false);

  const run = await executeAutomationTool('run_automation', { automation: 'Water' });
  assert.equal(run.status, 'success');

  const missing = await executeAutomationTool('delete_automation', { automation: 'nope' });
  assert.equal(missing.status, 'error');
  const del = await executeAutomationTool('delete_automation', { automation: 'Water' });
  assert.equal(del.status, 'success');
  assert.equal(A.loadAutomations().length, 0);
});

test('Automations: dynamic variable resolution handles today, time, clipboard and custom vars', () => {
  const ctx = {
    previous: 'world',
    clipboard: 'clipped text',
    vars: { myName: 'Alice', counter: '42' },
  };
  const filled = A.fill('Hello {{previous}}! Your name is {{vars.myName}} with {{counter}}. Copied: {{clipboard}}. Date: {{today}}', 'world', ctx);
  assert.match(filled, /Hello world! Your name is Alice with 42\. Copied: clipped text\. Date: \d{4}-\d{2}-\d{2}/);
});

test('Automations: manual trigger, duplication, and step disabling work as expected', async () => {
  const manual = A.createAutomation({
    name: 'Quick Action',
    icon: 'bolt',
    color: 'emerald',
    trigger: { type: 'manual' },
    actions: [
      { type: 'notify', title: 'Hello', message: 'First' },
      { type: 'notify', title: 'Skipped', message: 'Second', disabled: true },
    ],
  });

  assert.equal(manual.trigger.type, 'manual');
  assert.equal(A.describeTrigger(manual.trigger), 'On demand (tap to run)');
  assert.equal(A.nextRunOf(manual), null, 'manual triggers do not have a scheduled next run');

  // Duplication
  const copy = A.duplicateAutomation(manual.id);
  assert.equal(copy.name, 'Quick Action (Copy)');
  assert.equal(copy.color, 'emerald');
  assert.equal(copy.actions.length, 2);

  // Run with step callbacks
  const events = [];
  const entry = await A.runAutomation(manual.id, {
    onStepStart: (idx) => events.push(`start-${idx}`),
    onStepComplete: (idx, action, res) => events.push(`complete-${idx}-${res.ok}`),
  });

  assert.equal(entry.ok, true);
  assert.equal(entry.steps.length, 2);
  assert.equal(entry.steps[1].skipped, true);
  assert.ok(events.includes('start-0'));
  assert.ok(events.includes('complete-0-true'));
});

test('Automations: default action runners execute math, text transforms, variables, and conditions', async () => {
  // Temporarily reset runners to default
  A.setActionRunners(null);

  const calcAuto = A.createAutomation({
    name: 'Math and Transform',
    trigger: { type: 'manual' },
    actions: [
      { type: 'calc', expression: '10 * 5 + 2' },
      { type: 'variable', varName: 'resultNum', value: '{{previous}}' },
      { type: 'transform', op: 'uppercase', input: 'result is {{vars.resultNum}}' },
      { type: 'condition', left: '{{previous}}', op: 'contains', right: '52', ifFalse: 'stop' },
    ],
  });

  const entry = await A.runAutomation(calcAuto.id);
  assert.equal(entry.ok, true);
  assert.equal(entry.steps[0].output, '52');
  assert.equal(entry.steps[2].output, 'RESULT IS 52');
});

