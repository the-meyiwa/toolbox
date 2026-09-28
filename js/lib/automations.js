/* ============================================================
   TOOLBOX — Automations

   Recipes that run on their own: a trigger (a schedule, a single
   time, or "when Toolbox opens") and a list of actions run in
   order. Each action can use what the one before it produced
   through {{previous}}, so "every weekday at 8, ask the Assistant
   for a briefing, save it as a note and notify me" is one recipe.

   Actions
     notify     title, message          → the notification bell (and a system alert)
     assistant  prompt                  → asks the Assistant; its answer is the output
     tool       toolId, input, options  → runs any Toolbox tool through the Assistant bridge
     note       title, content          → saves a note
     open       toolId                  → a notification that opens that tool when tapped

   Schedules are five-field cron expressions (the Cron Parser's
   reader), so "every weekday at 08:00" is `0 8 * * 1-5`. The
   builder in the Automations tool writes them for the person.

   Automations run in the browser, so they run while Toolbox is
   open in a tab. A run missed while it was closed (within the
   last day) runs once when Toolbox is next opened, marked as
   caught up; older ones are skipped, not piled up.
   ============================================================ */

import { parseCron, nextRuns, describeCron } from '../tools/cron-parser.js';

export const STORAGE_KEY_AUTOMATIONS = 'toolbox_automations_v1';
export const ACTION_TYPES = ['notify', 'assistant', 'tool', 'note', 'open'];
const MAX_AUTOMATIONS = 50;
const MAX_ACTIONS = 8;
const MAX_LOG = 20;
const CATCH_UP_MS = 24 * 60 * 60_000;
// Assistant actions use the model quota; they may not run more often than this.
export const MIN_ASSISTANT_INTERVAL_MS = 60 * 60_000;
const MIN_INTERVAL_MS = 5 * 60_000;

const memory = { list: null };

export function loadAutomations() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTOMATIONS) || '[]');
    return Array.isArray(raw) ? raw.filter(a => a && typeof a.id === 'string').map(sanitize).filter(Boolean) : [];
  } catch { return memory.list ? memory.list.slice() : []; }
}

function save(list) {
  const limited = list.slice(0, MAX_AUTOMATIONS);
  memory.list = limited;
  try { localStorage.setItem(STORAGE_KEY_AUTOMATIONS, JSON.stringify(limited)); } catch { /* session only */ }
  try { window.dispatchEvent(new CustomEvent('toolbox:automations-updated')); } catch { /* no window */ }
  return limited;
}

const str = (v, max = 2000) => (v == null ? '' : String(v)).slice(0, max);

/* ---------------- schedules ---------------- */

/** Validates a trigger; returns a clean trigger or throws with a message worth showing. */
export function normalizeTrigger(trigger = {}) {
  const type = trigger.type || (trigger.cron ? 'cron' : trigger.at ? 'once' : 'cron');
  if (type === 'cron') {
    const cron = str(trigger.cron, 120).trim();
    if (!cron) throw new Error('A schedule needs a cron expression, e.g. "0 8 * * 1-5" for weekdays at 08:00.');
    const schedule = parseCron(cron);
    const [a, b] = nextRuns(schedule, new Date(), 2);
    if (!a) throw new Error('That schedule never runs.');
    if (b && b - a < MIN_INTERVAL_MS) throw new Error('Automations can run at most every 5 minutes.');
    return { type, cron };
  }
  if (type === 'once') {
    const at = typeof trigger.at === 'number' ? trigger.at : Date.parse(trigger.at);
    if (!Number.isFinite(at)) throw new Error('Give the date and time to run at.');
    return { type, at };
  }
  if (type === 'app-open') return { type };
  throw new Error(`Unknown trigger "${type}". Use cron, once or app-open.`);
}

/** Next time an automation is due after `from` (ms), or null. */
export function nextRunOf(auto, from = Date.now()) {
  const t = auto.trigger;
  if (!auto.enabled || !t) return null;
  if (t.type === 'once') return auto.lastRun ? null : t.at;
  if (t.type === 'cron') {
    try { return nextRuns(parseCron(t.cron), new Date(from), 1)[0]?.getTime() ?? null; } catch { return null; }
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
/** Plain-English schedule. */
export function describeTrigger(trigger) {
  if (!trigger) return 'No trigger';
  if (trigger.type === 'app-open') return 'Whenever Toolbox opens';
  if (trigger.type === 'once') {
    const d = new Date(trigger.at);
    return `Once, on ${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  try { return describeCron(parseCron(trigger.cron), trigger.cron); } catch { return trigger.cron; }
}

/** The schedule builder's presets → cron. */
export function cronFromPreset({ every = 'day', time = '08:00', weekday = 1, monthDay = 1, minutes = 30 } = {}) {
  const [h, m] = String(time || '08:00').split(':').map(n => Math.max(0, Number(n) || 0));
  const hh = Math.min(23, h), mm = Math.min(59, m);
  switch (every) {
    case 'minutes': return `*/${Math.min(59, Math.max(5, Math.round(minutes) || 30))} * * * *`;
    case 'hour': return `${mm} * * * *`;
    case 'weekday': return `${mm} ${hh} * * 1-5`;
    case 'week': return `${mm} ${hh} * * ${Math.min(6, Math.max(0, Number(weekday) || 0))}`;
    case 'month': return `${mm} ${hh} ${Math.min(28, Math.max(1, Number(monthDay) || 1))} * *`;
    default: return `${mm} ${hh} * * *`;
  }
}

/* ---------------- recipes ---------------- */

function sanitizeAction(a) {
  if (!a || !ACTION_TYPES.includes(a.type)) return null;
  const out = { type: a.type };
  if (a.type === 'notify') { out.title = str(a.title, 120) || 'Automation'; out.message = str(a.message, 1000); }
  if (a.type === 'assistant') { out.prompt = str(a.prompt, 4000); if (!out.prompt.trim()) return null; }
  if (a.type === 'tool') {
    out.toolId = str(a.toolId || a.tool_id, 80);
    if (!out.toolId) return null;
    out.input = str(a.input, 20000);
    out.options = a.options && typeof a.options === 'object' && !Array.isArray(a.options) ? a.options : {};
  }
  if (a.type === 'note') { out.title = str(a.title, 120) || 'Automation note'; out.content = str(a.content, 20000) || '{{previous}}'; }
  if (a.type === 'open') { out.toolId = str(a.toolId || a.tool_id, 80); if (!out.toolId) return null; out.message = str(a.message, 300); }
  return out;
}

function sanitize(a) {
  if (!a || typeof a !== 'object') return null;
  let trigger;
  try { trigger = normalizeTrigger(a.trigger); } catch { trigger = a.trigger?.type ? { ...a.trigger } : { type: 'app-open' }; }
  return {
    id: str(a.id, 60),
    name: str(a.name, 120) || 'Untitled automation',
    enabled: a.enabled !== false,
    trigger,
    actions: (Array.isArray(a.actions) ? a.actions : []).map(sanitizeAction).filter(Boolean).slice(0, MAX_ACTIONS),
    createdAt: Number(a.createdAt) || Date.now(),
    lastRun: Number(a.lastRun) || null,
    lastDue: Number(a.lastDue) || null,
    running: false,
    log: Array.isArray(a.log) ? a.log.slice(0, MAX_LOG) : [],
  };
}

function check(auto) {
  if (!auto.actions.length) throw new Error('Add at least one action (notify, assistant, tool, note or open).');
  if (auto.actions.some(a => a.type === 'assistant') && auto.trigger.type === 'cron') {
    const [a, b] = nextRuns(parseCron(auto.trigger.cron), new Date(), 2);
    if (a && b && b - a < MIN_ASSISTANT_INTERVAL_MS) throw new Error('Automations that ask the Assistant can run at most once an hour, to protect your message quota.');
  }
}

const newId = () => `auto_${globalThis.crypto?.randomUUID?.().slice(0, 12) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`}`;

/** Creates an automation. Throws with a readable message when the recipe is not valid. */
export function createAutomation({ name, trigger, actions, enabled = true } = {}) {
  const list = loadAutomations();
  if (list.length >= MAX_AUTOMATIONS) throw new Error(`You can keep up to ${MAX_AUTOMATIONS} automations. Delete one first.`);
  const auto = sanitize({ id: newId(), name, enabled, trigger: normalizeTrigger(trigger), actions, createdAt: Date.now() });
  check(auto);
  // A schedule starts counting from now: nothing "missed" before it existed.
  auto.lastDue = Date.now();
  save([auto, ...list]);
  return auto;
}

export function updateAutomation(id, changes = {}) {
  const list = loadAutomations();
  const i = list.findIndex(a => a.id === id);
  if (i < 0) throw new Error('That automation no longer exists.');
  const merged = { ...list[i], ...changes, id };
  if (changes.trigger) { merged.trigger = normalizeTrigger(changes.trigger); merged.lastDue = Date.now(); }
  const auto = sanitize(merged);
  check(auto);
  if (changes.enabled === true && !list[i].enabled) auto.lastDue = Date.now();
  list[i] = auto;
  save(list);
  return auto;
}

export function deleteAutomation(id) {
  const list = loadAutomations();
  const next = list.filter(a => a.id !== id);
  save(next);
  return next.length !== list.length;
}

/** Finds an automation by id or (part of) its name. */
export function findAutomation(ref) {
  const q = String(ref || '').trim().toLowerCase();
  if (!q) return null;
  const list = loadAutomations();
  return list.find(a => a.id === ref) || list.find(a => a.name.toLowerCase() === q) || list.find(a => a.name.toLowerCase().includes(q)) || null;
}

/* ---------------- running ---------------- */

const fill = (text, previous) => String(text || '').replace(/\{\{\s*previous\s*\}\}/gi, previous || '');
const textOf = (result) => {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  return String(result.text ?? result.output ?? result.content ?? result.result ?? result.message ?? '');
};

const defaultRunners = {
  async notify(action, previous, auto) {
    const { NotificationEngine } = await import('./notifications.js');
    const message = fill(action.message, previous) || previous || 'Done.';
    await NotificationEngine.addNotification(fill(action.title, previous) || auto.name, message.slice(0, 600), 'automation', '#automations', null, { automationId: auto.id });
    return message;
  },
  async assistant(action, previous) {
    const { generateIntelligentResponse } = await import('./ai-provider.js');
    const res = await generateIntelligentResponse(fill(action.prompt, previous), { mode: 'fast', maxSteps: 4 });
    return textOf(res).trim();
  },
  async tool(action, previous) {
    const { executeExtraTool } = await import('./assistant/extra-tools.js');
    const res = await executeExtraTool('run_toolbox_tool', { tool_id: action.toolId, input: fill(action.input, previous) || previous, options: action.options }, {});
    if (res?.status === 'error' || res?.success === false) throw new Error(res.message || res.error || 'The tool failed.');
    return textOf(res);
  },
  async note(action, previous) {
    const { executeAssistantTool } = await import('./assistant-tools.js');
    const res = await executeAssistantTool('create_note', { title: fill(action.title, previous), content: fill(action.content, previous) || previous || '' }, {});
    if (res?.status === 'error') throw new Error(res.message || 'Could not save the note.');
    return previous;
  },
  async open(action, previous, auto) {
    const { NotificationEngine } = await import('./notifications.js');
    await NotificationEngine.addNotification(auto.name, fill(action.message, previous) || `Tap to open ${action.toolId}.`, 'automation', `#${action.toolId}`, null, { automationId: auto.id });
    return previous;
  },
};

let runners = defaultRunners;
/** Test hook: replace how actions run. */
export function setActionRunners(overrides) { runners = overrides ? { ...defaultRunners, ...overrides } : defaultRunners; }

const inFlight = new Set();

/** Runs one automation now. Resolves to its log entry. */
export async function runAutomation(id, { reason = 'manual', now = Date.now() } = {}) {
  const auto = loadAutomations().find(a => a.id === id);
  if (!auto) throw new Error('That automation no longer exists.');
  if (inFlight.has(id)) return { at: now, ok: false, reason, summary: 'Already running.' };
  inFlight.add(id);
  const entry = { at: now, reason, ok: true, steps: [] };
  let previous = '';
  try {
    for (const action of auto.actions) {
      const started = Date.now();
      try {
        const out = await runners[action.type](action, previous, auto);
        previous = typeof out === 'string' ? out : textOf(out);
        entry.steps.push({ type: action.type, ok: true, ms: Date.now() - started, output: previous.slice(0, 600) });
      } catch (err) {
        entry.ok = false;
        entry.steps.push({ type: action.type, ok: false, ms: Date.now() - started, error: String(err?.message || err).slice(0, 300) });
        break;
      }
    }
  } finally {
    inFlight.delete(id);
  }
  entry.summary = entry.ok ? (previous.slice(0, 200) || 'Done.') : `Stopped at step ${entry.steps.length}: ${entry.steps.at(-1).error}`;
  // Re-read before writing: the person may have edited it while it ran.
  const list = loadAutomations();
  const i = list.findIndex(a => a.id === id);
  if (i >= 0) {
    list[i].lastRun = now;
    list[i].log = [entry, ...(list[i].log || [])].slice(0, MAX_LOG);
    if (list[i].trigger.type === 'once') list[i].enabled = false;
    save(list);
  }
  if (!entry.ok) {
    try {
      const { NotificationEngine } = await import('./notifications.js');
      await NotificationEngine.addNotification(`Automation failed: ${auto.name}`, entry.summary, 'error', '#automations', null, { automationId: id });
    } catch { /* the log still has it */ }
  }
  return entry;
}

/**
 * Runs what is due. `lastDue` is the last scheduled time already handled, so each scheduled
 * time runs once, and a second tab ticking at the same moment sees it claimed.
 */
export async function runDue({ now = Date.now(), opening = false } = {}) {
  const list = loadAutomations();
  const due = [];
  for (const auto of list) {
    if (!auto.enabled || !auto.actions.length) continue;
    const t = auto.trigger;
    if (t.type === 'app-open') {
      // At most once every 10 minutes (an hour when it asks the Assistant), so reloads do not repeat it.
      const gap = auto.actions.some(a => a.type === 'assistant') ? MIN_ASSISTANT_INTERVAL_MS : 10 * 60_000;
      if (opening && (!auto.lastRun || now - auto.lastRun > gap)) due.push({ auto, reason: 'opened' });
      continue;
    }
    const from = auto.lastDue || auto.createdAt || now;
    const next = t.type === 'once' ? (auto.lastRun ? null : t.at) : nextRunOf(auto, from - 1);
    if (next == null || next > now) continue;
    auto.lastDue = now;   // claim it (and every earlier missed time)
    if (now - next > CATCH_UP_MS) continue;   // missed long ago: skip, do not pile up
    due.push({ auto, reason: now - next > 90_000 ? 'caught up' : 'scheduled' });
  }
  if (due.length) save(list);
  const results = [];
  for (const { auto, reason } of due) {
    try { results.push(await runAutomation(auto.id, { reason, now })); } catch { /* deleted meanwhile */ }
  }
  return results;
}

let clock = null;
/** Starts the automation clock (every 30 s, and when the tab comes back). */
export function startAutomationClock() {
  if (clock || typeof window === 'undefined') return;
  const tick = () => { runDue().catch(() => {}); };
  clock = setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setTimeout(() => { runDue({ opening: true }).catch(() => {}); }, 4000);
}

/** Recipes the Automations tool offers as starting points. */
export const TEMPLATES = [
  { name: 'Morning briefing', trigger: { type: 'cron', cron: '0 7 * * 1-5' }, actions: [
    { type: 'assistant', prompt: 'Give me a short morning briefing: today\'s calendar events and reminders, and anything I should prepare for. Keep it under 120 words.' },
    { type: 'notify', title: 'Morning briefing', message: '{{previous}}' }] },
  { name: 'Drink water', trigger: { type: 'cron', cron: '0 9-17/2 * * 1-5' }, actions: [
    { type: 'notify', title: 'Drink some water', message: 'Time for a glass of water and a stretch.' }] },
  { name: 'Weekly review', trigger: { type: 'cron', cron: '0 16 * * 5' }, actions: [
    { type: 'assistant', prompt: 'Write a short weekly review template for me with headings: Done, Blocked, Next week.' },
    { type: 'note', title: 'Weekly review', content: '{{previous}}' },
    { type: 'notify', title: 'Weekly review ready', message: 'Your weekly review note is in Notes.' }] },
  { name: 'Open my calendar each morning', trigger: { type: 'cron', cron: '30 8 * * *' }, actions: [
    { type: 'open', toolId: 'calendar', message: 'Tap to see today\'s calendar.' }] },
];
