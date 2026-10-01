/* ============================================================
   TOOLBOX — Automations & Shortcuts Engine

   A modular workflow engine modeled after Apple Shortcuts, built
   for the Toolbox ecosystem.

   Recipes run either:
     1. On demand / manual tap (Shortcuts tile)
     2. On a schedule (cron expression with natural builder)
     3. Once at a specific date and time
     4. Whenever Toolbox opens

   Actions:
     Intelligence & AI:
       assistant  prompt, mode              → ask the Assistant (fast mode)
     Toolbox Tools:
       tool       toolId, input, options    → run any of the 130+ Toolbox tools
       open       toolId, message           → notification or button that opens a tool
     Personal Knowledge & Docs:
       note       title, content, mode      → create or append to Notes
       mind       name, content, mindType   → save memory/idea/thought to Mind palace
     Time & Calendar:
       calendar   calAction, title, date    → check today's events or add event
       delay      seconds                   → pause workflow for 1-30 seconds
     Device & Media:
       clipboard  clipAction, text          → read or copy to clipboard
       speak      text                      → text-to-speech voice read aloud
       sound      chime                     → audio chime (bell, ping, success, alert)
     Data & Transforms:
       transform  op, input, find, replace  → case, trim, slug, regex replace, length
       calc       expression                → arithmetic calculation
     Logic & Variables:
       variable   varName, value            → store custom variable for later steps
       condition  left, op, right, ifFalse  → if condition (contains, equals, >/<, empty)
     Web & Network:
       fetch      url, method, headers, body → HTTP GET/POST API request or webhook
     Alerts:
       notify     title, message            → notification bell, toast, system alert

   Variables:
     {{previous}}   → output of the preceding step
     {{clipboard}}  → current clipboard text
     {{today}}      → YYYY-MM-DD
     {{now}}        → HH:MM
     {{time}}       → HH:MM:SS
     {{date}}       → Human-formatted date
     {{timestamp}}  → Epoch ms
     {{random}}     → Random integer (0-999)
     {{vars.name}}  → User-defined variable from a variable step

   Automations run entirely client-side in the browser.
   ============================================================ */

import { parseCron, nextRuns, describeCron } from '../tools/cron-parser.js';

export const STORAGE_KEY_AUTOMATIONS = 'toolbox_automations_v1';
export const ACTION_TYPES = [
  'notify', 'assistant', 'tool', 'note', 'open',
  'mind', 'calendar', 'clipboard', 'fetch', 'transform',
  'calc', 'variable', 'condition', 'delay', 'speak', 'sound',
];

export const AUTOMATION_COLORS = ['indigo', 'blue', 'cyan', 'emerald', 'amber', 'rose', 'purple', 'slate'];
export const AUTOMATION_ICONS = ['sparkles', 'brain', 'calendar', 'clipboard', 'bell', 'bolt', 'note', 'code', 'globe', 'clock', 'check', 'star', 'sun', 'moon'];
export const SHORTCUT_COLORS = AUTOMATION_COLORS;
export const SHORTCUT_ICONS = AUTOMATION_ICONS;

const MAX_AUTOMATIONS = 50;
const MAX_ACTIONS = 16;
const MAX_LOG = 20;
const CATCH_UP_MS = 24 * 60 * 60_000;
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

/* ---------------- variables & formatting ---------------- */

/** Replaces dynamic tokens in text: {{previous}}, {{clipboard}}, {{today}}, {{vars.name}}, etc. */
export function fill(text, previous = '', context = {}) {
  let s = String(text ?? '');
  const prev = typeof previous === 'string' ? previous : (context.previous ?? '');
  const vars = (context && typeof context === 'object' && context.vars) ? context.vars : {};
  const clip = (context && typeof context === 'object' && context.clipboard) ? context.clipboard : '';

  s = s.replace(/\{\{\s*previous\s*\}\}/gi, prev);
  s = s.replace(/\{\{\s*clipboard\s*\}\}/gi, clip);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  s = s.replace(/\{\{\s*today\s*\}\}/gi, `${yyyy}-${mm}-${dd}`);
  s = s.replace(/\{\{\s*now\s*\}\}/gi, `${hh}:${min}`);
  s = s.replace(/\{\{\s*time\s*\}\}/gi, `${hh}:${min}:${ss}`);
  s = s.replace(/\{\{\s*date\s*\}\}/gi, now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
  s = s.replace(/\{\{\s*timestamp\s*\}\}/gi, String(now.getTime()));
  s = s.replace(/\{\{\s*random\s*\}\}/gi, String(Math.floor(Math.random() * 1000)));

  // Custom variables: {{vars.foo}} or {{foo}}
  s = s.replace(/\{\{\s*(?:vars\.)?([a-zA-Z0-9_]+)\s*\}\}/gi, (match, key) => {
    if (key in vars) return String(vars[key] ?? '');
    return match;
  });

  return s;
}

export function playChime(type = 'bell') {
  if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'ping') {
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'alert') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    }
    setTimeout(() => { ctx.close().catch(() => {}); }, 1200);
  } catch { /* audio gesture restricted */ }
}

/* ---------------- triggers & schedules ---------------- */

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
  if (type === 'manual') return { type };
  throw new Error(`Unknown trigger "${type}". Use cron, once, app-open or manual.`);
}

export function nextRunOf(auto, from = Date.now()) {
  const t = auto.trigger;
  if (!auto.enabled || !t) return null;
  if (t.type === 'manual') return null;
  if (t.type === 'once') return auto.lastRun ? null : t.at;
  if (t.type === 'cron') {
    try { return nextRuns(parseCron(t.cron), new Date(from), 1)[0]?.getTime() ?? null; } catch { return null; }
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

export function describeTrigger(trigger) {
  if (!trigger) return 'No trigger';
  if (trigger.type === 'manual') return 'On demand (tap to run)';
  if (trigger.type === 'app-open') return 'Whenever Toolbox opens';
  if (trigger.type === 'once') {
    const d = new Date(trigger.at);
    return `Once, on ${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  try { return describeCron(parseCron(trigger.cron), trigger.cron); } catch { return trigger.cron; }
}

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

/* ---------------- recipes & sanitization ---------------- */

function sanitizeAction(a) {
  if (!a || !ACTION_TYPES.includes(a.type)) return null;
  const out = { type: a.type, disabled: a.disabled === true };

  if (a.type === 'notify') {
    out.title = str(a.title, 120) || 'Automation';
    out.message = str(a.message, 1000);
  }
  if (a.type === 'assistant') {
    out.prompt = str(a.prompt, 4000);
    if (!out.prompt.trim()) return null;
  }
  if (a.type === 'tool') {
    out.toolId = str(a.toolId || a.tool_id, 80);
    if (!out.toolId) return null;
    out.input = str(a.input, 20000);
    out.options = a.options && typeof a.options === 'object' && !Array.isArray(a.options) ? a.options : {};
  }
  if (a.type === 'note') {
    out.title = str(a.title, 120) || 'Automation note';
    out.content = str(a.content, 20000) || '{{previous}}';
    out.mode = a.mode === 'append' ? 'append' : 'create';
  }
  if (a.type === 'open') {
    out.toolId = str(a.toolId || a.tool_id, 80);
    if (!out.toolId) return null;
    out.message = str(a.message, 300);
  }
  if (a.type === 'mind') {
    out.name = str(a.name, 120) || 'Thought from Automation';
    out.content = str(a.content, 20000) || '{{previous}}';
    out.mindType = ['Idea', 'Memory', 'Note', 'Project', 'Task', 'Person'].includes(a.mindType) ? a.mindType : 'Idea';
    out.memoryType = ['explicit', 'learned', 'episodic'].includes(a.memoryType) ? a.memoryType : 'explicit';
  }
  if (a.type === 'calendar') {
    out.calAction = a.calAction === 'today' ? 'today' : 'add';
    out.title = str(a.title, 120) || 'Automation Event';
    out.date = str(a.date, 30) || '{{today}}';
    out.time = str(a.time, 10) || '09:00';
    out.duration = Math.max(5, Math.min(720, Number(a.duration) || 30));
  }
  if (a.type === 'clipboard') {
    out.clipAction = a.clipAction === 'read' ? 'read' : 'copy';
    out.text = str(a.text, 20000) || '{{previous}}';
  }
  if (a.type === 'fetch') {
    out.url = str(a.url, 1000);
    if (!out.url) return null;
    out.method = a.method === 'POST' ? 'POST' : 'GET';
    out.headers = a.headers && typeof a.headers === 'object' ? a.headers : {};
    out.body = str(a.body, 10000);
  }
  if (a.type === 'transform') {
    out.op = ['uppercase', 'lowercase', 'titlecase', 'trim', 'slug', 'length', 'replace'].includes(a.op) ? a.op : 'trim';
    out.input = str(a.input, 20000) || '{{previous}}';
    out.find = str(a.find, 500);
    out.replaceWith = str(a.replaceWith, 500);
  }
  if (a.type === 'calc') {
    out.expression = str(a.expression, 500) || '{{previous}}';
  }
  if (a.type === 'variable') {
    out.varName = str(a.varName, 60).replace(/[^a-zA-Z0-9_]/g, '') || 'result';
    out.value = str(a.value, 20000) || '{{previous}}';
  }
  if (a.type === 'condition') {
    out.left = str(a.left, 5000) || '{{previous}}';
    out.op = ['contains', 'equals', 'greater', 'less', 'empty', 'not_empty'].includes(a.op) ? a.op : 'contains';
    out.right = str(a.right, 5000);
    out.ifFalse = a.ifFalse === 'stop' ? 'stop' : 'skip';
  }
  if (a.type === 'delay') {
    out.seconds = Math.max(1, Math.min(30, Number(a.seconds) || 1));
  }
  if (a.type === 'speak') {
    out.text = str(a.text, 1000) || '{{previous}}';
  }
  if (a.type === 'sound') {
    out.chime = ['bell', 'ping', 'success', 'alert'].includes(a.chime) ? a.chime : 'bell';
  }
  return out;
}

function sanitize(a) {
  if (!a || typeof a !== 'object') return null;
  let trigger;
  try { trigger = normalizeTrigger(a.trigger); } catch { trigger = a.trigger?.type ? { ...a.trigger } : { type: 'manual' }; }

  return {
    id: str(a.id, 60),
    name: str(a.name, 120) || 'Untitled automation',
    description: str(a.description, 240) || '',
    icon: AUTOMATION_ICONS.includes(a.icon) ? a.icon : 'bolt',
    color: AUTOMATION_COLORS.includes(a.color) ? a.color : 'indigo',
    tags: Array.isArray(a.tags) ? a.tags.map(t => str(t, 30)).filter(Boolean).slice(0, 5) : [],
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
  if (!auto.actions.length) throw new Error('Add at least one action.');
  if (auto.actions.some(a => a.type === 'assistant') && auto.trigger.type === 'cron') {
    const [a, b] = nextRuns(parseCron(auto.trigger.cron), new Date(), 2);
    if (a && b && b - a < MIN_ASSISTANT_INTERVAL_MS) throw new Error('Automations that ask the Assistant can run at most once an hour, to protect your message quota.');
  }
}

const newId = () => `auto_${globalThis.crypto?.randomUUID?.().slice(0, 12) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`}`;

export function createAutomation({ name, description, icon, color, tags, trigger, actions, enabled = true } = {}) {
  const list = loadAutomations();
  if (list.length >= MAX_AUTOMATIONS) throw new Error(`You can keep up to ${MAX_AUTOMATIONS} automations. Delete one first.`);
  const auto = sanitize({
    id: newId(),
    name,
    description,
    icon,
    color,
    tags,
    enabled,
    trigger: normalizeTrigger(trigger),
    actions,
    createdAt: Date.now(),
  });
  check(auto);
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

export function duplicateAutomation(id) {
  const list = loadAutomations();
  const source = list.find(a => a.id === id);
  if (!source) throw new Error('That automation no longer exists.');
  return createAutomation({
    name: `${source.name} (Copy)`,
    description: source.description,
    icon: source.icon,
    color: source.color,
    tags: source.tags ? [...source.tags] : [],
    trigger: { ...source.trigger },
    actions: source.actions.map(a => ({ ...a })),
    enabled: source.enabled,
  });
}

export function findAutomation(ref) {
  const q = String(ref || '').trim().toLowerCase();
  if (!q) return null;
  const list = loadAutomations();
  return list.find(a => a.id === ref) || list.find(a => a.name.toLowerCase() === q) || list.find(a => a.name.toLowerCase().includes(q)) || null;
}

/* ---------------- running ---------------- */

const textOf = (result) => {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  return String(result.text ?? result.output ?? result.content ?? result.result ?? result.message ?? '');
};

const defaultRunners = {
  async notify(action, previous, auto, ctx) {
    const { NotificationEngine } = await import('./notifications.js');
    const message = fill(action.message, previous, ctx) || previous || 'Done.';
    await NotificationEngine.addNotification(fill(action.title, previous, ctx) || auto.name, message.slice(0, 600), 'automation', '#automations', null, { automationId: auto.id });
    return message;
  },
  async assistant(action, previous, auto, ctx) {
    const { generateIntelligentResponse } = await import('./ai-provider.js');
    const res = await generateIntelligentResponse(fill(action.prompt, previous, ctx), { mode: 'fast', maxSteps: 4 });
    return textOf(res).trim();
  },
  async tool(action, previous, auto, ctx) {
    const { executeExtraTool } = await import('./assistant/extra-tools.js');
    const res = await executeExtraTool('run_toolbox_tool', { tool_id: action.toolId, input: fill(action.input, previous, ctx) || previous, options: action.options }, {});
    if (res?.status === 'error' || res?.success === false) throw new Error(res.message || res.error || 'The tool failed.');
    return textOf(res);
  },
  async note(action, previous, auto, ctx) {
    const title = fill(action.title, previous, ctx) || 'Automation note';
    const content = fill(action.content, previous, ctx) || previous || '';
    if (action.mode === 'append') {
      const STORAGE_KEY = 'toolbox_notes_v1';
      let notes = [];
      try { notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}
      const target = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
      if (target) {
        target.body = (target.body ? target.body + '\n\n' : '') + content;
        target.updatedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        try { window.dispatchEvent(new CustomEvent('toolbox:notes-changed', { detail: { id: target.id } })); } catch {}
        return content;
      }
    }
    const { executeAssistantTool } = await import('./assistant-tools.js');
    const res = await executeAssistantTool('create_note', { title, content }, {});
    if (res?.status === 'error') throw new Error(res.message || 'Could not save the note.');
    return previous;
  },
  async open(action, previous, auto, ctx) {
    const { NotificationEngine } = await import('./notifications.js');
    await NotificationEngine.addNotification(auto.name, fill(action.message, previous, ctx) || `Tap to open ${action.toolId}.`, 'automation', `#${action.toolId}`, null, { automationId: auto.id });
    return previous;
  },
  async mind(action, previous, auto, ctx) {
    const { upsertMindEntity } = await import('./mind-store.js');
    const name = fill(action.name, previous, ctx) || 'Thought from Automation';
    const content = fill(action.content, previous, ctx) || previous;
    const entity = upsertMindEntity({
      name,
      type: action.mindType || 'Idea',
      memoryType: action.memoryType || 'explicit',
      content,
    });
    return `Saved to Mind: ${entity.name}`;
  },
  async calendar(action, previous, auto, ctx) {
    if (action.calAction === 'today') {
      const { loadStoredEvents, isEventOnDate } = await import('./calendar-store.js');
      const now = new Date();
      const events = loadStoredEvents().filter(e => isEventOnDate(e, now));
      if (!events.length) return 'No events scheduled for today.';
      return events.map(e => `• ${e.startTime || 'All day'}: ${e.title}`).join('\n');
    }
    const { addEvent } = await import('./calendar-store.js');
    const title = fill(action.title, previous, ctx) || 'New Event';
    const date = fill(action.date, previous, ctx) || new Date().toISOString().slice(0, 10);
    const time = fill(action.time, previous, ctx) || '09:00';
    const evt = addEvent({
      title,
      date,
      startTime: time,
      durationMinutes: Number(action.duration) || 30,
      category: 'work',
    });
    return `Created event "${evt.title}" on ${evt.date} at ${evt.startTime}`;
  },
  async clipboard(action, previous, auto, ctx) {
    if (action.clipAction === 'read') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          const txt = await navigator.clipboard.readText();
          return txt || '';
        }
      } catch {}
      return ctx?.clipboard || previous;
    }
    const val = fill(action.text, previous, ctx) || previous;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(val);
      }
    } catch {}
    return val;
  },
  async fetch(action, previous, auto, ctx) {
    const url = fill(action.url, previous, ctx);
    if (!url) throw new Error('URL is required for web request.');
    const method = action.method || 'GET';
    const headers = { ...action.headers };
    let body = undefined;
    if (method === 'POST' && action.body) {
      body = fill(action.body, previous, ctx);
      if (!headers['Content-Type'] && (body.startsWith('{') || body.startsWith('['))) {
        headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(url, { method, headers, body });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return typeof data === 'object' ? JSON.stringify(data, null, 2) : text;
    } catch {
      return text;
    }
  },
  async transform(action, previous, auto, ctx) {
    const input = fill(action.input, previous, ctx) || previous;
    switch (action.op) {
      case 'uppercase': return input.toUpperCase();
      case 'lowercase': return input.toLowerCase();
      case 'titlecase': return input.replace(/\b\w/g, c => c.toUpperCase());
      case 'trim': return input.trim();
      case 'slug': return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      case 'length': return String(input.length);
      case 'replace': {
        const find = fill(action.find, previous, ctx);
        const rep = fill(action.replaceWith, previous, ctx);
        return input.split(find).join(rep);
      }
      default: return input;
    }
  },
  async calc(action, previous, auto, ctx) {
    const expr = fill(action.expression, previous, ctx);
    const sanitized = expr.replace(/[^0-9+\-*/().%^ eE]/g, '');
    if (!sanitized.trim()) throw new Error('Invalid calculation expression.');
    const res = Function(`"use strict"; return (${sanitized});`)();
    if (!Number.isFinite(res)) throw new Error('Calculation did not produce a number.');
    return String(res);
  },
  async variable(action, previous, auto, ctx) {
    const name = action.varName || 'var';
    const val = fill(action.value, previous, ctx) || previous;
    if (ctx && typeof ctx === 'object' && ctx.vars) {
      ctx.vars[name] = val;
    }
    return val;
  },
  async condition(action, previous, auto, ctx) {
    const left = String(fill(action.left, previous, ctx));
    const right = String(fill(action.right, previous, ctx));
    let match = false;
    switch (action.op) {
      case 'contains': match = left.toLowerCase().includes(right.toLowerCase()); break;
      case 'equals': match = left.trim().toLowerCase() === right.trim().toLowerCase(); break;
      case 'greater': match = Number(left) > Number(right); break;
      case 'less': match = Number(left) < Number(right); break;
      case 'empty': match = !left.trim(); break;
      case 'not_empty': match = !!left.trim(); break;
    }
    return match ? left : (action.ifFalse === 'stop' ? '__STOP__' : '__SKIP__');
  },
  async delay(action) {
    const sec = Math.min(30, Math.max(1, Number(action.seconds) || 1));
    await new Promise(r => setTimeout(r, sec * 1000));
    return `Waited ${sec}s`;
  },
  async speak(action, previous, auto, ctx) {
    const text = fill(action.text, previous, ctx) || previous;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text.slice(0, 500));
        window.speechSynthesis.speak(utt);
      } catch {}
    }
    return text;
  },
  async sound(action) {
    playChime(action.chime || 'bell');
    return 'Chime played';
  },
};

let runners = defaultRunners;
export function setActionRunners(overrides) { runners = overrides ? { ...defaultRunners, ...overrides } : defaultRunners; }

const inFlight = new Set();

/** Runs one automation now. Resolves to its log entry. */
export async function runAutomation(id, { reason = 'manual', now = Date.now(), onStepStart = null, onStepComplete = null } = {}) {
  const auto = loadAutomations().find(a => a.id === id);
  if (!auto) throw new Error('That automation no longer exists.');
  if (inFlight.has(id)) return { at: now, ok: false, reason, summary: 'Already running.' };
  inFlight.add(id);

  const entry = { at: now, reason, ok: true, steps: [] };
  const context = { previous: '', vars: {}, clipboard: '' };
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      context.clipboard = await navigator.clipboard.readText().catch(() => '');
    }
  } catch {}

  let previous = '';

  try {
    for (let idx = 0; idx < auto.actions.length; idx++) {
      const action = auto.actions[idx];
      if (action.disabled) {
        entry.steps.push({ type: action.type, ok: true, skipped: true, ms: 0, output: 'Step disabled' });
        continue;
      }

      onStepStart?.(idx, action);
      const started = Date.now();

      try {
        const out = await runners[action.type](action, previous, auto, context);
        if (out === '__STOP__') {
          entry.steps.push({ type: action.type, ok: true, ms: Date.now() - started, output: 'Condition ended workflow' });
          onStepComplete?.(idx, action, { ok: true, ms: Date.now() - started, output: 'Condition ended workflow' });
          break;
        }
        if (out === '__SKIP__') {
          entry.steps.push({ type: action.type, ok: true, ms: Date.now() - started, output: 'Condition skipped' });
          onStepComplete?.(idx, action, { ok: true, ms: Date.now() - started, output: 'Condition skipped' });
          continue;
        }

        previous = typeof out === 'string' ? out : textOf(out);
        context.previous = previous;
        const ms = Date.now() - started;
        entry.steps.push({ type: action.type, ok: true, ms, output: previous.slice(0, 600) });
        onStepComplete?.(idx, action, { ok: true, ms, output: previous.slice(0, 600) });
      } catch (err) {
        entry.ok = false;
        const errMsg = String(err?.message || err).slice(0, 300);
        entry.steps.push({ type: action.type, ok: false, ms: Date.now() - started, error: errMsg });
        onStepComplete?.(idx, action, { ok: false, ms: Date.now() - started, error: errMsg });
        break;
      }
    }
  } finally {
    inFlight.delete(id);
  }

  entry.summary = entry.ok ? (previous.slice(0, 200) || 'Done.') : `Stopped at step ${entry.steps.length}: ${entry.steps.at(-1)?.error || 'Failed'}`;

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
    } catch { /* log preserved */ }
  }
  return entry;
}

export async function runDue({ now = Date.now(), opening = false } = {}) {
  const list = loadAutomations();
  const due = [];
  for (const auto of list) {
    if (!auto.enabled || !auto.actions.length) continue;
    const t = auto.trigger;
    if (t.type === 'manual') continue;
    if (t.type === 'app-open') {
      const gap = auto.actions.some(a => a.type === 'assistant') ? MIN_ASSISTANT_INTERVAL_MS : 10 * 60_000;
      if (opening && (!auto.lastRun || now - auto.lastRun > gap)) due.push({ auto, reason: 'opened' });
      continue;
    }
    const from = auto.lastDue || auto.createdAt || now;
    const next = t.type === 'once' ? (auto.lastRun ? null : t.at) : nextRunOf(auto, from - 1);
    if (next == null || next > now) continue;
    auto.lastDue = now;
    if (now - next > CATCH_UP_MS) continue;
    due.push({ auto, reason: now - next > 90_000 ? 'caught up' : 'scheduled' });
  }
  if (due.length) save(list);
  const results = [];
  for (const { auto, reason } of due) {
    try { results.push(await runAutomation(auto.id, { reason, now })); } catch { /* deleted */ }
  }
  return results;
}

let clock = null;
export function startAutomationClock() {
  if (clock || typeof window === 'undefined') return;
  const tick = () => { runDue().catch(() => {}); };
  clock = setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setTimeout(() => { runDue({ opening: true }).catch(() => {}); }, 4000);
}

/* ---------------- curated gallery starter shortcuts ---------------- */

export const TEMPLATES = [
  {
    name: 'Morning Executive Briefing',
    description: 'Get today’s calendar events, synthesize top priorities, speak summary aloud, and save a briefing note.',
    icon: 'sun',
    color: 'amber',
    tags: ['Daily', 'Productivity'],
    trigger: { type: 'cron', cron: '0 7 * * 1-5' },
    actions: [
      { type: 'calendar', calAction: 'today' },
      { type: 'assistant', prompt: 'Here is today\'s schedule:\n{{previous}}\nGive me a crisp 3-bullet morning briefing with key focus areas and preparation tips. Keep it under 100 words.' },
      { type: 'speak', text: 'Good morning. Here is your daily briefing: {{previous}}' },
      { type: 'note', title: 'Daily Briefing ({{today}})', content: '## Schedule\n{{previous}}', mode: 'create' },
      { type: 'notify', title: 'Morning briefing ready', message: '{{previous}}' },
    ],
  },
  {
    name: 'Smart Clipboard Purifier & Word Count',
    description: 'Cleans whitespace from clipboard text, runs word counter statistics, and copies result back.',
    icon: 'clipboard',
    color: 'blue',
    tags: ['Writing', 'Utilities'],
    trigger: { type: 'manual' },
    actions: [
      { type: 'clipboard', clipAction: 'read' },
      { type: 'transform', op: 'trim', input: '{{previous}}' },
      { type: 'tool', toolId: 'word-counter', input: '{{previous}}' },
      { type: 'notify', title: 'Clipboard stats', message: '{{previous}}' },
      { type: 'sound', chime: 'ping' },
    ],
  },
  {
    name: 'Evening Mind Palace Reflection',
    description: 'Asks the Assistant for a thoughtful daily reflection question and records your reflection as an episodic memory.',
    icon: 'brain',
    color: 'purple',
    tags: ['Mind', 'Daily'],
    trigger: { type: 'cron', cron: '0 21 * * *' },
    actions: [
      { type: 'assistant', prompt: 'Give me one concise, thoughtful reflection question for tonight based on growth, creativity, or gratitude. Just the single question.' },
      { type: 'mind', name: 'Evening Reflection ({{today}})', content: 'Prompt: {{previous}}', mindType: 'Memory', memoryType: 'episodic' },
      { type: 'notify', title: 'Time for evening reflection', message: '{{previous}}' },
    ],
  },
  {
    name: 'Hourly Hydration & Posture Chime',
    description: 'Plays a gentle bell chime and prompts a 60-second stretch and water break every 2 hours.',
    icon: 'bell',
    color: 'cyan',
    tags: ['Wellbeing'],
    trigger: { type: 'cron', cron: '0 9-17/2 * * 1-5' },
    actions: [
      { type: 'sound', chime: 'bell' },
      { type: 'notify', title: 'Hydration & Posture', message: 'Time for a fresh glass of water and a quick stretch.' },
    ],
  },
  {
    name: 'Daily Standup Note Starter',
    description: 'Creates a clean markdown daily standup note in Notes with Done, Blocked, and Up Next sections.',
    icon: 'note',
    color: 'emerald',
    tags: ['Work', 'Productivity'],
    trigger: { type: 'manual' },
    actions: [
      { type: 'note', title: 'Daily Standup — {{today}}', content: '### Done Yesterday\n- \n\n### Today\n- \n\n### Blockers\n- None', mode: 'create' },
      { type: 'sound', chime: 'success' },
      { type: 'notify', title: 'Standup note created', message: 'Daily note ready in Notes.' },
    ],
  },
  {
    name: 'Quick Math Evaluator',
    description: 'Evaluates an arithmetic expression, plays a confirmation sound, and stores the answer in clipboard.',
    icon: 'bolt',
    color: 'indigo',
    tags: ['Utilities'],
    trigger: { type: 'manual' },
    actions: [
      { type: 'clipboard', clipAction: 'read' },
      { type: 'calc', expression: '{{previous}}' },
      { type: 'clipboard', clipAction: 'copy', text: '{{previous}}' },
      { type: 'sound', chime: 'ping' },
      { type: 'notify', title: 'Calculation result', message: 'Result: {{previous}} (copied to clipboard)' },
    ],
  },
  {
    name: 'Case Converter to Title Case',
    description: 'Reads clipboard text, transforms it to Title Case, and saves it back to clipboard.',
    icon: 'sparkles',
    color: 'rose',
    tags: ['Writing'],
    trigger: { type: 'manual' },
    actions: [
      { type: 'clipboard', clipAction: 'read' },
      { type: 'transform', op: 'titlecase', input: '{{previous}}' },
      { type: 'clipboard', clipAction: 'copy', text: '{{previous}}' },
      { type: 'sound', chime: 'ping' },
      { type: 'notify', title: 'Title Case applied', message: '{{previous}}' },
    ],
  },
  {
    name: 'Open Calendar Each Morning',
    description: 'Sends a reminder when your day begins that opens the Calendar tool in one tap.',
    icon: 'calendar',
    color: 'slate',
    tags: ['Daily'],
    trigger: { type: 'cron', cron: '30 8 * * 1-5' },
    actions: [
      { type: 'open', toolId: 'calendar', message: 'Tap to see today’s calendar schedule.' },
    ],
  },
];
