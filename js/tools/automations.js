/* ============================================================
   Automations — recipes that run on their own.

   A list of the person's automations (schedule, next run, steps,
   last result, on/off), an editor that builds the schedule from
   plain choices (every day / weekday / week / month / hour / N
   minutes, once, when Toolbox opens, or a cron line), and
   starting templates. The engine is js/lib/automations.js; the
   Assistant manages the same recipes with create_automation.
   Styles live in css/automations.css.
   ============================================================ */

import {
  loadAutomations, createAutomation, updateAutomation, deleteAutomation, runAutomation,
  describeTrigger, nextRunOf, cronFromPreset, TEMPLATES, ACTION_TYPES,
} from '../lib/automations.js';
import { parseCron, nextRuns, describeCron } from './cron-parser.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACTION_LABEL = { notify: 'Notify me', assistant: 'Ask the Assistant', tool: 'Run a tool', note: 'Save a note', open: 'Open a tool' };
const when = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/** Reads a cron line back into the builder's preset, when it is one of them. */
function presetOf(cron) {
  const p = String(cron || '').trim().split(/\s+/);
  if (p.length !== 5) return { every: 'custom' };
  const [m, h, dom, mon, dow] = p;
  const num = (x) => /^\d+$/.test(x);
  const time = num(h) && num(m) ? `${pad(h)}:${pad(m)}` : '08:00';
  if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return { every: 'minutes', minutes: Number(m.slice(2)) };
  if (num(m) && h === '*' && dom === '*' && mon === '*' && dow === '*') return { every: 'hour', time: `00:${pad(m)}` };
  if (num(m) && num(h) && mon === '*') {
    if (dom === '*' && dow === '*') return { every: 'day', time };
    if (dom === '*' && dow === '1-5') return { every: 'weekday', time };
    if (dom === '*' && /^[0-6]$/.test(dow)) return { every: 'week', time, weekday: Number(dow) };
    if (num(dom) && dow === '*') return { every: 'month', time, monthDay: Number(dom) };
  }
  return { every: 'custom' };
}

function actionFields(a, i) {
  const f = (name, label, value, { area = false, ph = '' } = {}) => `<label class="au-field${area ? ' au-field-wide' : ''}"><span>${label}</span>${area
    ? `<textarea class="tool-input" data-i="${i}" data-k="${name}" rows="3" placeholder="${esc(ph)}">${esc(value)}</textarea>`
    : `<input class="tool-input" data-i="${i}" data-k="${name}" value="${esc(value)}" placeholder="${esc(ph)}">`}</label>`;
  switch (a.type) {
    case 'notify': return f('title', 'Title', a.title, { ph: 'Drink water' }) + f('message', 'Message', a.message, { area: true, ph: '{{previous}} inserts the previous step’s result' });
    case 'assistant': return f('prompt', 'Ask', a.prompt, { area: true, ph: 'Summarise today’s calendar in three lines' });
    case 'tool': return f('toolId', 'Tool id', a.toolId, { ph: 'word-counter' }) + f('input', 'Input', a.input, { area: true, ph: '{{previous}}' });
    case 'note': return f('title', 'Note title', a.title, { ph: 'Weekly review' }) + f('content', 'Content', a.content ?? '{{previous}}', { area: true });
    case 'open': return f('toolId', 'Tool id', a.toolId, { ph: 'calendar' }) + f('message', 'Message', a.message, { ph: 'Tap to open' });
    default: return '';
  }
}

export default {
  render(container) {
    let editing = null;          // { id|null, name, trigger, actions, preset }
    let openLog = null;

    container.innerHTML = `<div class="au" role="region" aria-label="Automations">
      <header class="au-head">
        <div class="au-head-copy">
          <h2 class="au-title">Automations</h2>
          <p class="au-sub">Recipes that run on their own while Toolbox is open in a tab. A run missed while it was closed runs when you come back (up to a day late).</p>
        </div>
        <button type="button" class="btn btn-primary" id="au-new">New automation</button>
      </header>
      <div class="au-alerts" id="au-alerts" hidden></div>
      <div class="au-templates" id="au-templates"></div>
      <div class="au-editor" id="au-editor" hidden></div>
      <div class="au-list" id="au-list" aria-live="polite"></div>
    </div>`;
    const $ = (s) => container.querySelector(s);

    function renderAlerts() {
      const box = $('#au-alerts');
      const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
      if (perm === 'granted' || perm === 'unsupported') { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = perm === 'denied'
        ? '<p>System notifications are blocked for Toolbox in your browser’s site settings, so automations only reach the bell.</p>'
        : '<p>Turn on system notifications so automations can reach you when Toolbox is in the background.</p><button type="button" class="btn btn-secondary btn-sm" id="au-allow">Turn on</button>';
    }

    function renderTemplates() {
      $('#au-templates').innerHTML = `<span class="au-templates-label">Start from</span>${TEMPLATES.map((t, i) => `<button type="button" class="au-chip" data-template="${i}">${esc(t.name)}</button>`).join('')}`;
    }

    function renderList() {
      const list = loadAutomations();
      if (!list.length) {
        $('#au-list').innerHTML = '<div class="au-empty"><p><strong>No automations yet.</strong></p><p>Create one, start from a template above, or ask the Assistant: “every weekday at 8, send me a briefing”.</p></div>';
        return;
      }
      $('#au-list').innerHTML = list.map(a => {
        const next = nextRunOf(a);
        const last = a.log?.[0];
        return `<article class="au-card${a.enabled ? '' : ' is-off'}" data-id="${esc(a.id)}">
          <div class="au-card-main">
            <div class="au-card-copy">
              <h3 class="au-card-title">${esc(a.name)}</h3>
              <p class="au-card-when">${esc(describeTrigger(a.trigger))}</p>
              <p class="au-steps">${a.actions.map(x => `<span class="au-step">${esc(ACTION_LABEL[x.type] || x.type)}</span>`).join('<span class="au-arrow" aria-hidden="true">→</span>')}</p>
              <p class="au-meta">${a.enabled ? (next ? `Next: ${esc(when(next))}` : a.trigger.type === 'app-open' ? 'Next: when Toolbox opens' : 'No upcoming run') : 'Paused'}${last ? ` · Last: ${esc(when(last.at))} <span class="au-dot ${last.ok ? 'is-ok' : 'is-bad'}" aria-label="${last.ok ? 'succeeded' : 'failed'}"></span>` : ''}</p>
            </div>
            <label class="au-switch" title="${a.enabled ? 'Pause' : 'Resume'}"><input type="checkbox" class="switch" data-act="toggle" ${a.enabled ? 'checked' : ''} aria-label="${a.enabled ? 'Pause' : 'Resume'} ${esc(a.name)}"></label>
          </div>
          <div class="au-card-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-act="run">Run now</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="log" aria-expanded="${openLog === a.id}">History${a.log?.length ? ` (${a.log.length})` : ''}</button>
            <button type="button" class="btn btn-ghost btn-sm au-danger" data-act="delete">Delete</button>
          </div>
          ${openLog === a.id ? `<ol class="au-log">${(a.log || []).map(e => `<li class="${e.ok ? 'is-ok' : 'is-bad'}"><span>${esc(when(e.at))} · ${esc(e.reason)}</span><span>${esc(e.summary)}</span></li>`).join('') || '<li>No runs yet.</li>'}</ol>` : ''}
        </article>`;
      }).join('');
    }

    /* ---------------- editor ---------------- */

    function openEditor(source = null) {
      const base = source || { name: '', trigger: { type: 'cron', cron: '0 8 * * *' }, actions: [{ type: 'notify', title: '', message: '' }] };
      editing = {
        id: source?.id || null,
        name: base.name || '',
        trigger: { ...base.trigger },
        actions: base.actions.map(a => ({ ...a })),
        preset: base.trigger.type === 'cron' ? { time: '08:00', weekday: 1, monthDay: 1, minutes: 30, ...presetOf(base.trigger.cron) } : { every: 'day', time: '08:00', weekday: 1, monthDay: 1, minutes: 30 },
        error: '',
      };
      renderEditor();
      $('#au-editor').scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      $('#au-name')?.focus({ preventScroll: true });
    }

    function scheduleCron() {
      return editing.preset.every === 'custom' ? (editing.trigger.cron || '') : cronFromPreset(editing.preset);
    }

    function preview() {
      const t = editing.trigger;
      if (t.type === 'app-open') return 'Runs each time Toolbox opens (at most every 10 minutes).';
      if (t.type === 'once') return t.at ? `Runs once, ${when(Date.parse(t.at) || t.at)}.` : 'Pick a date and time.';
      try {
        const cron = scheduleCron();
        const s = parseCron(cron);
        return `${describeCron(s, cron)}. Next: ${nextRuns(s, new Date(), 3).map(d => when(d.getTime())).join(', ')}.`;
      } catch (err) { return err.message; }
    }

    function renderEditor() {
      const box = $('#au-editor');
      if (!editing) { box.hidden = true; box.innerHTML = ''; return; }
      const t = editing.trigger, p = editing.preset;
      const onceValue = t.type === 'once' && t.at ? (() => { const d = new Date(typeof t.at === 'number' ? t.at : Date.parse(t.at)); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })() : '';
      box.hidden = false;
      box.innerHTML = `<form class="au-form" novalidate>
        <h3 class="au-form-title">${editing.id ? 'Edit automation' : 'New automation'}</h3>
        <label class="au-field au-field-wide"><span>Name</span><input class="tool-input" id="au-name" value="${esc(editing.name)}" placeholder="Morning briefing" maxlength="120"></label>
        <fieldset class="au-group"><legend>When</legend>
          <div class="au-row">
            <label class="au-field"><span>Trigger</span><select class="tool-input" id="au-ttype">
              <option value="cron" ${t.type === 'cron' ? 'selected' : ''}>On a schedule</option>
              <option value="once" ${t.type === 'once' ? 'selected' : ''}>Once</option>
              <option value="app-open" ${t.type === 'app-open' ? 'selected' : ''}>When Toolbox opens</option>
            </select></label>
            ${t.type === 'cron' ? `<label class="au-field"><span>Every</span><select class="tool-input" id="au-every">
              ${[['minutes', 'Few minutes'], ['hour', 'Hour'], ['day', 'Day'], ['weekday', 'Weekday (Mon–Fri)'], ['week', 'Week'], ['month', 'Month'], ['custom', 'Custom (cron)']].map(([v, l]) => `<option value="${v}" ${p.every === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
            ${p.every === 'minutes' ? `<label class="au-field"><span>Minutes</span><input class="tool-input" type="number" id="au-minutes" min="5" max="59" value="${esc(p.minutes)}"></label>` : ''}
            ${['day', 'weekday', 'week', 'month'].includes(p.every) ? `<label class="au-field"><span>At</span><input class="tool-input" type="time" id="au-time" value="${esc(p.time)}"></label>` : ''}
            ${p.every === 'hour' ? `<label class="au-field"><span>Minute past</span><input class="tool-input" type="number" id="au-minute" min="0" max="59" value="${esc(Number(String(p.time).split(':')[1]) || 0)}"></label>` : ''}
            ${p.every === 'week' ? `<label class="au-field"><span>On</span><select class="tool-input" id="au-weekday">${DAYS.map((d, i) => `<option value="${i}" ${Number(p.weekday) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
            ${p.every === 'month' ? `<label class="au-field"><span>Day</span><input class="tool-input" type="number" id="au-monthday" min="1" max="28" value="${esc(p.monthDay)}"></label>` : ''}
            ${p.every === 'custom' ? `<label class="au-field au-field-wide"><span>Cron (minute hour day month weekday)</span><input class="tool-input au-mono" id="au-cron" value="${esc(t.cron || '')}" placeholder="0 8 * * 1-5" spellcheck="false"></label>` : ''}` : ''}
            ${t.type === 'once' ? `<label class="au-field"><span>Date and time</span><input class="tool-input" type="datetime-local" id="au-at" value="${esc(onceValue)}"></label>` : ''}
          </div>
          <p class="au-preview" id="au-preview" role="status">${esc(preview())}</p>
        </fieldset>
        <fieldset class="au-group"><legend>Then</legend>
          <ol class="au-actions">${editing.actions.map((a, i) => `<li class="au-action">
            <div class="au-action-head">
              <span class="au-action-n">${i + 1}</span>
              <select class="tool-input au-action-type" data-i="${i}" aria-label="Step ${i + 1} type">${ACTION_TYPES.map(ty => `<option value="${ty}" ${a.type === ty ? 'selected' : ''}>${ACTION_LABEL[ty]}</option>`).join('')}</select>
              <span class="au-action-tools">
                <button type="button" class="btn btn-ghost btn-sm" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move step ${i + 1} up">↑</button>
                <button type="button" class="btn btn-ghost btn-sm" data-move="1" data-i="${i}" ${i === editing.actions.length - 1 ? 'disabled' : ''} aria-label="Move step ${i + 1} down">↓</button>
                <button type="button" class="btn btn-ghost btn-sm" data-remove="${i}" ${editing.actions.length === 1 ? 'disabled' : ''} aria-label="Remove step ${i + 1}">Remove</button>
              </span>
            </div>
            <div class="au-action-body">${actionFields(a, i)}</div>
          </li>`).join('')}</ol>
          ${editing.actions.length < 8 ? '<button type="button" class="btn btn-secondary btn-sm" id="au-add">Add step</button>' : ''}
          <p class="au-hint">Each step can use what the one before it produced by writing {{previous}}. Steps that ask the Assistant can run at most once an hour.</p>
        </fieldset>
        ${editing.error ? `<p class="au-error" role="alert">${esc(editing.error)}</p>` : ''}
        <div class="au-form-actions">
          <button type="submit" class="btn btn-primary">${editing.id ? 'Save' : 'Create'}</button>
          <button type="button" class="btn btn-ghost" id="au-cancel">Cancel</button>
        </div>
      </form>`;
    }

    // Keep typed values without re-rendering (so focus and the caret stay put).
    function readInputs() {
      if (!editing) return;
      const v = (id) => $(id)?.value;
      if ($('#au-name')) editing.name = v('#au-name');
      if ($('#au-minutes')) editing.preset.minutes = Number(v('#au-minutes'));
      if ($('#au-time')) editing.preset.time = v('#au-time') || '08:00';
      if ($('#au-minute')) editing.preset.time = `00:${pad(Math.min(59, Math.max(0, Number(v('#au-minute')) || 0)))}`;
      if ($('#au-weekday')) editing.preset.weekday = Number(v('#au-weekday'));
      if ($('#au-monthday')) editing.preset.monthDay = Number(v('#au-monthday'));
      if ($('#au-cron')) editing.trigger.cron = v('#au-cron');
      if ($('#au-at')) editing.trigger.at = v('#au-at');
      container.querySelectorAll('.au-action-body [data-k]').forEach(el => { editing.actions[Number(el.dataset.i)][el.dataset.k] = el.value; });
      if (editing.trigger.type === 'cron' && editing.preset.every !== 'custom') editing.trigger.cron = cronFromPreset(editing.preset);
    }

    function save() {
      readInputs();
      const trigger = editing.trigger.type === 'cron' ? { type: 'cron', cron: scheduleCron() }
        : editing.trigger.type === 'once' ? { type: 'once', at: editing.trigger.at ? new Date(editing.trigger.at).getTime() : null }
          : { type: 'app-open' };
      const recipe = { name: editing.name.trim() || 'Untitled automation', trigger, actions: editing.actions };
      try {
        if (editing.id) updateAutomation(editing.id, recipe); else createAutomation(recipe);
        editing = null;
        renderEditor();
        renderList();
      } catch (err) {
        editing.error = err?.message || 'That automation is not valid.';
        renderEditor();
      }
    }

    /* ---------------- events ---------------- */

    const onClick = async (e) => {
      const t = e.target;
      if (t.closest('#au-new')) { openEditor(); return; }
      if (t.closest('#au-allow')) {
        const { NotificationEngine } = await import('../lib/notifications.js');
        await NotificationEngine.enableBrowserNotifications();
        renderAlerts();
        return;
      }
      const tpl = t.closest('[data-template]');
      if (tpl) { const x = TEMPLATES[Number(tpl.dataset.template)]; openEditor({ ...x, actions: x.actions.map(a => ({ ...a })) }); return; }
      if (t.closest('#au-cancel')) { editing = null; renderEditor(); return; }
      if (t.closest('#au-add')) { readInputs(); editing.actions.push({ type: 'notify', title: '', message: '{{previous}}' }); renderEditor(); return; }
      const rm = t.closest('[data-remove]');
      if (rm) { readInputs(); editing.actions.splice(Number(rm.dataset.remove), 1); renderEditor(); return; }
      const mv = t.closest('[data-move]');
      if (mv) {
        readInputs();
        const i = Number(mv.dataset.i), j = i + Number(mv.dataset.move);
        [editing.actions[i], editing.actions[j]] = [editing.actions[j], editing.actions[i]];
        renderEditor();
        return;
      }
      const cardEl = t.closest('.au-card');
      const act = t.closest('[data-act]')?.dataset.act;
      if (!cardEl || !act || act === 'toggle') return;
      const id = cardEl.dataset.id;
      const auto = loadAutomations().find(a => a.id === id);
      if (!auto) { renderList(); return; }
      if (act === 'edit') openEditor(auto);
      else if (act === 'log') { openLog = openLog === id ? null : id; renderList(); }
      else if (act === 'delete') {
        const { tbConfirm } = await import('../lib/dialog.js');
        if (await tbConfirm(`Delete “${auto.name}”?`, { title: 'Delete automation', confirmText: 'Delete', destructive: true })) { deleteAutomation(id); renderList(); }
      } else if (act === 'run') {
        const b = t.closest('button');
        b.disabled = true; b.textContent = 'Running…';
        try { await runAutomation(id); } finally { openLog = id; renderList(); }
      }
    };

    const onChange = (e) => {
      const t = e.target;
      if (t.matches('[data-act="toggle"]')) {
        const id = t.closest('.au-card')?.dataset.id;
        try { updateAutomation(id, { enabled: t.checked }); } catch { /* deleted */ }
        renderList();
        return;
      }
      if (!editing) return;
      if (t.id === 'au-ttype') {
        readInputs();
        editing.trigger = { type: t.value, cron: editing.trigger.cron || cronFromPreset(editing.preset), at: editing.trigger.at };
        renderEditor();
      } else if (t.id === 'au-every') {
        readInputs();
        editing.preset.every = t.value;
        if (t.value === 'custom' && !editing.trigger.cron) editing.trigger.cron = '0 8 * * *';
        renderEditor();
      } else if (t.classList.contains('au-action-type')) {
        readInputs();
        const i = Number(t.dataset.i);
        editing.actions[i] = { type: t.value, ...(i > 0 ? { message: '{{previous}}', content: '{{previous}}' } : {}) };
        renderEditor();
      }
    };

    const onInput = (e) => {
      if (!editing || !e.target.closest('.au-form')) return;
      readInputs();
      const out = $('#au-preview');
      if (out) out.textContent = preview();
    };
    const onSubmit = (e) => { if (e.target.closest('.au-form')) { e.preventDefault(); save(); } };
    const onUpdated = () => { if (!container.isConnected) return; renderList(); };

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);
    container.addEventListener('submit', onSubmit);
    window.addEventListener('toolbox:automations-updated', onUpdated);
    // Relative times ("Next: …") stay current.
    const refresh = setInterval(() => { if (!editing) renderList(); }, 60_000);

    renderAlerts();
    renderTemplates();
    renderList();

    this._cleanup = () => {
      clearInterval(refresh);
      window.removeEventListener('toolbox:automations-updated', onUpdated);
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('submit', onSubmit);
    };
  },
  destroy() {
    this._cleanup?.();
    this._cleanup = null;
  },
};
