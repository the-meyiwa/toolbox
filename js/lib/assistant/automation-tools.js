/* ============================================================
   TOOLBOX — Assistant tools for Automations

   create_automation, list_automations, update_automation,
   delete_automation and run_automation drive js/lib/automations.js,
   so "every weekday at 8, send me a briefing" is one tool call.
   ============================================================ */

import { registerToolPack } from './tool-packs.js';
import {
  createAutomation, updateAutomation, deleteAutomation, runAutomation, loadAutomations,
  findAutomation, describeTrigger, nextRunOf, cronFromPreset,
} from '../automations.js';

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['notify', 'assistant', 'tool', 'note', 'open'], description: 'notify (bell + system alert), assistant (ask the Assistant; its answer feeds the next step), tool (run a Toolbox tool), note (save a note), open (a notification that opens a tool).' },
    title: { type: 'string', description: 'notify/note title.' },
    message: { type: 'string', description: 'notify text; {{previous}} is the previous step\'s output.' },
    prompt: { type: 'string', description: 'assistant: what to ask.' },
    toolId: { type: 'string', description: 'tool/open: the Toolbox tool id (find_toolbox_tools).' },
    input: { type: 'string', description: 'tool: input text; {{previous}} allowed.' },
    content: { type: 'string', description: 'note: body; {{previous}} allowed (default).' },
  },
  required: ['type'],
};

const TRIGGER_SCHEMA = {
  type: 'object',
  description: 'When it runs. Either cron (five-field, local time) or a preset: every = minutes | hour | day | weekday | week | month with time "HH:MM", weekday 0–6 (0 = Sunday), monthDay, minutes. Or type "once" with at (ISO date-time), or type "app-open".',
  properties: {
    type: { type: 'string', enum: ['cron', 'once', 'app-open'] },
    cron: { type: 'string' },
    every: { type: 'string', enum: ['minutes', 'hour', 'day', 'weekday', 'week', 'month'] },
    time: { type: 'string' },
    weekday: { type: 'number' },
    monthDay: { type: 'number' },
    minutes: { type: 'number' },
    at: { type: 'string' },
  },
};

export const AUTOMATION_DECLARATIONS = [
  {
    name: 'create_automation',
    description: 'Creates an automation that runs on its own while Toolbox is open: on a schedule, once at a time, or when Toolbox opens. Actions run in order and each can use the previous one\'s output as {{previous}} (e.g. assistant → note → notify). Use for "every morning…", "each Friday remind me…", "every 2 hours notify me…".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name, e.g. "Morning briefing".' },
        trigger: TRIGGER_SCHEMA,
        actions: { type: 'array', items: ACTION_SCHEMA, description: 'Steps in order.' },
      },
      required: ['name', 'trigger', 'actions'],
    },
  },
  {
    name: 'list_automations',
    description: 'Lists the person\'s automations with their schedules, next run and last result.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'update_automation',
    description: 'Changes an automation: pause or resume it (enabled), rename it, or give it a new trigger or actions.',
    parameters: {
      type: 'object',
      properties: {
        automation: { type: 'string', description: 'Its id or name.' },
        enabled: { type: 'boolean' },
        name: { type: 'string' },
        trigger: TRIGGER_SCHEMA,
        actions: { type: 'array', items: ACTION_SCHEMA },
      },
      required: ['automation'],
    },
  },
  {
    name: 'delete_automation',
    description: 'Deletes an automation.',
    parameters: { type: 'object', properties: { automation: { type: 'string', description: 'Its id or name.' } }, required: ['automation'] },
  },
  {
    name: 'run_automation',
    description: 'Runs an automation now, once, and reports what each step did.',
    parameters: { type: 'object', properties: { automation: { type: 'string', description: 'Its id or name.' } }, required: ['automation'] },
  },
];

/** Accepts a cron trigger, a preset ({every, time…}), a bare cron string or a once/app-open trigger. */
export function triggerFrom(raw) {
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'app-open' ? { type: 'app-open' } : { type: 'cron', cron: raw };
  const t = raw && typeof raw === 'object' ? raw : {};
  if (t.type === 'once' || (t.at && !t.cron && !t.every)) return { type: 'once', at: t.at };
  if (t.type === 'app-open') return { type: 'app-open' };
  if (t.cron) return { type: 'cron', cron: t.cron };
  if (t.every) return { type: 'cron', cron: cronFromPreset(t) };
  throw new Error('Say when it should run: a schedule (e.g. every day at 08:00), a date and time, or when Toolbox opens.');
}

const when = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

function view(a) {
  return {
    id: a.id,
    name: a.name,
    enabled: a.enabled,
    schedule: describeTrigger(a.trigger),
    nextRun: when(nextRunOf(a)),
    steps: a.actions.map(x => x.type).join(' → '),
    lastRun: when(a.lastRun),
    lastResult: a.log?.[0] ? (a.log[0].ok ? 'ok' : a.log[0].summary) : null,
  };
}

const card = (list, message) => ({ status: 'success', type: 'automations', renderer: 'automations', automations: list.map(view), message, link: '#automations' });

async function execute(name, args = {}) {
  try {
    if (name === 'list_automations') {
      const list = loadAutomations();
      return card(list, list.length ? `${list.length} automation${list.length === 1 ? '' : 's'}.` : 'No automations yet.');
    }
    if (name === 'create_automation') {
      const auto = createAutomation({ name: args.name, trigger: triggerFrom(args.trigger), actions: args.actions });
      const v = view(auto);
      return { ...card([auto], `Created "${auto.name}": ${v.schedule.charAt(0).toLowerCase()}${v.schedule.slice(1)}${v.nextRun ? `; next run ${v.nextRun}` : ''}. It runs while Toolbox is open in a tab.`), automation: v };
    }
    const target = findAutomation(args.automation || args.id || args.name);
    if (!target) return { status: 'error', success: false, message: `No automation called "${args.automation || ''}". list_automations shows them.` };
    if (name === 'delete_automation') {
      deleteAutomation(target.id);
      return { status: 'success', message: `Deleted "${target.name}".` };
    }
    if (name === 'update_automation') {
      const changes = {};
      if (typeof args.enabled === 'boolean') changes.enabled = args.enabled;
      if (args.name && args.name !== args.automation) changes.name = args.name;
      if (args.trigger) changes.trigger = triggerFrom(args.trigger);
      if (Array.isArray(args.actions)) changes.actions = args.actions;
      const auto = updateAutomation(target.id, changes);
      return card([auto], `Updated "${auto.name}"${typeof args.enabled === 'boolean' ? (args.enabled ? ' (resumed)' : ' (paused)') : ''}.`);
    }
    if (name === 'run_automation') {
      const entry = await runAutomation(target.id, { reason: 'asked' });
      return { status: entry.ok ? 'success' : 'error', success: entry.ok, steps: entry.steps, message: entry.ok ? `Ran "${target.name}": ${entry.summary}` : `"${target.name}" ${entry.summary}` };
    }
  } catch (err) {
    return { status: 'error', success: false, message: err?.message || 'That did not work.' };
  }
  return undefined;
}

registerToolPack({
  id: 'automations',
  declarations: AUTOMATION_DECLARATIONS,
  execute,
  groups: {
    automation: {
      label: 'Automations: things that run on a schedule (daily briefings, recurring reminders, weekly notes)',
      tools: AUTOMATION_DECLARATIONS.map(d => d.name),
      match: /\b(automat\w*|every (day|morning|evening|night|week|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|month|hour|\d+ (minutes|hours))|each (day|morning|week|month)|daily|weekly|monthly|hourly|recurring|on a schedule|schedule (a|an|it)|routine|workflow)\b/i,
    },
  },
});

export { execute as executeAutomationTool };
