/* ============================================================
   TOOLBOX — Automations

   A powerful workflow studio tailored for the Toolbox ecosystem.
   Visual block builder, live execution highlights, one-tap quick
   runs, variable chips, curated templates, and deep integrations
   across Mind, Calendar, Notes, AI, and 130+ Toolbox tools.
   ============================================================ */

import {
  loadAutomations, createAutomation, updateAutomation, deleteAutomation,
  duplicateAutomation, runAutomation, describeTrigger, nextRunOf, cronFromPreset,
  TEMPLATES, ACTION_TYPES, AUTOMATION_COLORS, AUTOMATION_ICONS, playChime,
} from '../lib/automations.js';
import { parseCron, nextRuns, describeCron } from './cron-parser.js';
import { TOOLS } from '../registry/index.js';
import { icon } from '../lib/icons.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ACTION_META = {
  assistant: { label: 'Ask Assistant', cat: 'ai', icon: 'sparkles', color: 'purple', desc: 'Ask the Assistant for answers, synthesis, or summaries' },
  tool: { label: 'Run Toolbox Tool', cat: 'tool', icon: 'bolt', color: 'blue', desc: 'Execute any of the 130+ Toolbox tools directly' },
  mind: { label: 'Add to Mind Palace', cat: 'mind', icon: 'brain', color: 'purple', desc: 'Save an idea, memory, or knowledge unit into Mind' },
  note: { label: 'Save Note', cat: 'docs', icon: 'note', color: 'emerald', desc: 'Create or append to a note in Notes' },
  calendar: { label: 'Calendar', cat: 'cal', icon: 'calendar', color: 'cyan', desc: 'Check today’s agenda or schedule a new calendar event' },
  clipboard: { label: 'Clipboard', cat: 'device', icon: 'clipboard', color: 'slate', desc: 'Read from or copy results to the system clipboard' },
  transform: { label: 'Transform Text', cat: 'logic', icon: 'sparkles', color: 'indigo', desc: 'Change case, trim, regex replace, slugify, or count length' },
  calc: { label: 'Calculate', cat: 'logic', icon: 'bolt', color: 'amber', desc: 'Evaluate arithmetic expressions on numbers' },
  variable: { label: 'Set Variable', cat: 'logic', icon: 'code', color: 'indigo', desc: 'Store a named value to use in later steps' },
  condition: { label: 'If Condition', cat: 'logic', icon: 'check', color: 'rose', desc: 'Branch or stop workflow based on text or numbers' },
  delay: { label: 'Wait / Delay', cat: 'cal', icon: 'clock', color: 'slate', desc: 'Pause execution for 1 to 30 seconds' },
  speak: { label: 'Speak Aloud', cat: 'media', icon: 'sparkles', color: 'amber', desc: 'Read text aloud using device speech synthesis' },
  sound: { label: 'Play Chime', cat: 'media', icon: 'bell', color: 'amber', desc: 'Play a pleasant audio chime (bell, ping, success)' },
  fetch: { label: 'Web Request', cat: 'web', icon: 'globe', color: 'blue', desc: 'Fetch API data or trigger external webhooks' },
  notify: { label: 'Send Notification', cat: 'alert', icon: 'bell', color: 'amber', desc: 'Deliver an in-app alert, chime, or system notification' },
  open: { label: 'Open Tool', cat: 'tool', icon: 'bolt', color: 'blue', desc: 'Create a notification that launches a tool when tapped' },
};

const CATEGORIES = [
  { id: 'all', label: 'All Actions' },
  { id: 'ai', label: 'Intelligence' },
  { id: 'tool', label: 'Toolbox Tools' },
  { id: 'mind', label: 'Mind & Knowledge' },
  { id: 'docs', label: 'Documents & Notes' },
  { id: 'cal', label: 'Calendar & Time' },
  { id: 'device', label: 'Clipboard & Device' },
  { id: 'media', label: 'Audio & Speech' },
  { id: 'logic', label: 'Logic & Transforms' },
  { id: 'web', label: 'Web & API' },
  { id: 'alert', label: 'Alerts' },
];

const when = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

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

export default {
  render(container) {
    let currentTab = 'automations'; // 'automations' | 'templates' | 'history'
    let editing = null;             // active automation being edited
    let activeFilter = 'all';       // 'all' | 'manual' | 'scheduled' | 'paused'
    let searchQuery = '';
    let galleryFilter = 'all';
    let openPickerIndex = null;     // if action library modal is open to add after index
    let runningAutomationId = null;
    let liveStepStatus = {};        // { [stepIndex]: { status: 'running'|'done'|'error', ms, output, error } }

    container.innerHTML = `<div class="au-app" role="region" aria-label="Automations">
      <header class="au-navbar">
        <div class="au-navbar-left">
          <div class="au-badge-icon" aria-hidden="true">${icon('bolt', { size: 20 })}</div>
          <div>
            <h1 class="au-app-title">Automations</h1>
            <p class="au-app-sub">Recipes and workflows that run on their own or on tap</p>
          </div>
        </div>
        <div class="au-navbar-right">
          <nav class="au-tabs" role="tablist" aria-label="Sections">
            <button type="button" class="au-tab is-active" data-view="automations" role="tab" aria-selected="true">Automations</button>
            <button type="button" class="au-tab" data-view="templates" role="tab" aria-selected="false">Templates</button>
            <button type="button" class="au-tab" data-view="history" role="tab" aria-selected="false">History</button>
          </nav>
          <div class="au-head-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="au-import-btn" title="Import automation from JSON">Import</button>
            <button type="button" class="btn btn-secondary btn-sm" id="au-export-all-btn" title="Export all automations">Export</button>
            <button type="button" class="btn btn-primary" id="au-new-btn">${icon('plus', { size: 14 })} New automation</button>
          </div>
        </div>
      </header>

      <div class="au-notifications-bar" id="au-alerts" hidden></div>
      <div class="au-view-container" id="au-view-container"></div>
      <div class="au-modal-scrim" id="au-modal-scrim" hidden></div>
      <input type="file" id="au-file-input" accept=".json" hidden>
    </div>`;

    const $ = (s) => container.querySelector(s);

    function renderAlerts() {
      const box = $('#au-alerts');
      const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
      if (perm === 'granted' || perm === 'unsupported') { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = `<div class="au-alert-content">
        <span class="au-alert-icon" aria-hidden="true">${icon('info', { size: 16 })}</span>
        <p>${perm === 'denied'
          ? 'System alerts are disabled in site permissions; notifications will appear inside the Toolbox bell.'
          : 'Turn on system alerts so background automations can notify you when Toolbox is minimized.'}</p>
      </div>
      ${perm === 'default' ? '<button type="button" class="btn btn-secondary btn-sm" id="au-allow">Enable Alerts</button>' : ''}`;
    }

    function renderActiveView() {
      if (editing) {
        renderEditor();
        return;
      }
      const view = $('#au-view-container');
      if (currentTab === 'automations') {
        renderAutomationsGrid(view);
      } else if (currentTab === 'templates') {
        renderTemplatesView(view);
      } else if (currentTab === 'history') {
        renderHistory(view);
      }
    }

    /* ---------------- 1. Automations Dashboard Grid ---------------- */

    function renderAutomationsGrid(view) {
      const list = loadAutomations();
      const filtered = list.filter(a => {
        if (activeFilter === 'manual' && a.trigger.type !== 'manual') return false;
        if (activeFilter === 'scheduled' && a.trigger.type !== 'cron' && a.trigger.type !== 'once' && a.trigger.type !== 'app-open') return false;
        if (activeFilter === 'paused' && a.enabled) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = a.name.toLowerCase().includes(q);
          const matchTags = a.tags?.some(t => t.toLowerCase().includes(q));
          const matchSteps = a.actions?.some(s => s.type.toLowerCase().includes(q));
          if (!matchName && !matchTags && !matchSteps) return false;
        }
        return true;
      });

      view.innerHTML = `<div class="au-dashboard">
        <div class="au-filter-toolbar">
          <div class="au-search-box">
            <span class="au-search-icon" aria-hidden="true">${icon('sparkle', { size: 14 })}</span>
            <input type="search" class="au-search-input" id="au-search-input" placeholder="Search automations, tools, steps…" value="${esc(searchQuery)}">
          </div>
          <div class="au-segmented-pills">
            <button type="button" class="au-pill ${activeFilter === 'all' ? 'is-active' : ''}" data-filter="all">All (${list.length})</button>
            <button type="button" class="au-pill ${activeFilter === 'manual' ? 'is-active' : ''}" data-filter="manual">On Tap</button>
            <button type="button" class="au-pill ${activeFilter === 'scheduled' ? 'is-active' : ''}" data-filter="scheduled">Scheduled</button>
            <button type="button" class="au-pill ${activeFilter === 'paused' ? 'is-active' : ''}" data-filter="paused">Paused</button>
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div class="au-empty-state">
            <div class="au-empty-icon">${icon('bolt', { size: 36 })}</div>
            <h3>${list.length === 0 ? 'No automations yet' : 'No matching automations'}</h3>
            <p>${list.length === 0 ? 'Create your first custom workflow or explore Templates for starter recipes.' : 'Try adjusting your search terms or filters.'}</p>
            ${list.length === 0 ? `<div class="au-empty-actions">
              <button type="button" class="btn btn-primary" id="au-empty-new">${icon('plus', { size: 14 })} Create automation</button>
              <button type="button" class="btn btn-secondary" id="au-empty-gallery">Browse Templates</button>
            </div>` : ''}
          </div>
        ` : `
          <div class="au-grid">
            ${filtered.map(a => renderAutomationCard(a)).join('')}
          </div>
        `}
      </div>`;
    }

    function renderAutomationCard(a) {
      const isRunning = runningAutomationId === a.id;
      const next = nextRunOf(a);
      const last = a.log?.[0];
      const color = a.color || 'indigo';
      const glyph = a.icon || 'bolt';

      return `<article class="au-tile au-color-${esc(color)} ${a.enabled ? '' : 'is-disabled'} ${isRunning ? 'is-running' : ''}" data-id="${esc(a.id)}">
        <div class="au-tile-header">
          <div class="au-tile-icon-badge" aria-hidden="true">
            ${icon(glyph, { size: 20 })}
          </div>
          <div class="au-tile-top-actions">
            <label class="au-switch-sm" title="${a.enabled ? 'Pause automation' : 'Enable automation'}">
              <input type="checkbox" class="switch" data-act="toggle" ${a.enabled ? 'checked' : ''} aria-label="Toggle ${esc(a.name)}">
            </label>
            <button type="button" class="au-run-btn" data-act="run" title="Run now" ${isRunning ? 'disabled' : ''}>
              ${isRunning ? `<span class="au-spinner"></span>` : icon('play', { size: 14 })}
            </button>
          </div>
        </div>

        <div class="au-tile-body">
          <h3 class="au-tile-title">${esc(a.name)}</h3>
          ${a.description ? `<p class="au-tile-desc">${esc(a.description)}</p>` : ''}
          <div class="au-tile-trigger-badge">
            <span class="au-trigger-dot"></span>
            <span>${esc(describeTrigger(a.trigger))}</span>
          </div>
          <div class="au-step-flow">
            ${a.actions.map(st => `<span class="au-step-pill">${esc(ACTION_META[st.type]?.label || st.type)}</span>`).join(`<span class="au-flow-arrow" aria-hidden="true">${icon('chevron-right', { size: 10 })}</span>`)}
          </div>
        </div>

        <div class="au-tile-footer">
          <span class="au-tile-status">
            ${a.enabled ? (next ? `Next: ${when(next)}` : a.trigger.type === 'manual' ? 'On tap' : 'Awaiting trigger') : 'Paused'}
            ${last ? ` · <span class="au-run-indicator ${last.ok ? 'is-ok' : 'is-fail'}" title="${last.ok ? 'Last run succeeded' : 'Last run failed'}"></span>` : ''}
          </span>
          <div class="au-tile-menu-buttons">
            <button type="button" class="au-icon-btn" data-act="edit" title="Edit automation">${icon('pencil', { size: 13 })}</button>
            <button type="button" class="au-icon-btn" data-act="duplicate" title="Duplicate automation">${icon('plus', { size: 13 })}</button>
            <button type="button" class="au-icon-btn" data-act="export" title="Export JSON">${icon('save', { size: 13 })}</button>
            <button type="button" class="au-icon-btn au-btn-danger" data-act="delete" title="Delete automation">${icon('trash', { size: 13 })}</button>
          </div>
        </div>
      </article>`;
    }

    /* ---------------- 2. Templates Gallery View ---------------- */

    function renderTemplatesView(view) {
      const templates = TEMPLATES.filter(t => {
        if (galleryFilter === 'all') return true;
        return t.tags?.map(x => x.toLowerCase()).includes(galleryFilter.toLowerCase());
      });

      view.innerHTML = `<div class="au-gallery">
        <div class="au-gallery-hero">
          <h2>Automation Templates</h2>
          <p>Curated recipes crafted to connect your tools, automate routines, and power up productivity.</p>
          <div class="au-segmented-pills">
            ${['all', 'Daily', 'Productivity', 'Writing', 'Mind', 'Utilities', 'Wellbeing'].map(cat => `
              <button type="button" class="au-pill ${galleryFilter.toLowerCase() === cat.toLowerCase() ? 'is-active' : ''}" data-gfilter="${cat}">
                ${cat === 'all' ? 'All Packs' : cat}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="au-gallery-grid">
          ${templates.map((tpl, i) => `
            <div class="au-gallery-card au-color-${esc(tpl.color || 'indigo')}">
              <div class="au-gallery-card-top">
                <div class="au-gallery-icon-box">${icon(tpl.icon || 'bolt', { size: 22 })}</div>
                <div class="au-gallery-tags">
                  ${(tpl.tags || []).map(tg => `<span class="au-tag-chip">${esc(tg)}</span>`).join('')}
                </div>
              </div>
              <h3 class="au-gallery-title">${esc(tpl.name)}</h3>
              <p class="au-gallery-desc">${esc(tpl.description || '')}</p>
              <div class="au-step-flow">
                ${tpl.actions.map(st => `<span class="au-step-pill">${esc(ACTION_META[st.type]?.label || st.type)}</span>`).join(`<span class="au-flow-arrow" aria-hidden="true">${icon('chevron-right', { size: 10 })}</span>`)}
              </div>
              <div class="au-gallery-card-footer">
                <span class="au-gallery-when">${esc(describeTrigger(tpl.trigger))}</span>
                <button type="button" class="btn btn-secondary btn-sm" data-add-template="${i}">
                  ${icon('plus', { size: 13 })} Add Automation
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    /* ---------------- 3. Global History View ---------------- */

    function renderHistory(view) {
      const list = loadAutomations();
      const allRuns = [];
      list.forEach(a => {
        (a.log || []).forEach(e => {
          allRuns.push({ ...e, automationName: a.name, automationId: a.id, icon: a.icon || 'bolt', color: a.color || 'indigo' });
        });
      });
      allRuns.sort((a, b) => b.at - a.at);

      view.innerHTML = `<div class="au-history">
        <div class="au-history-head">
          <div>
            <h2>Run History</h2>
            <p>Chronological execution log across all your automations.</p>
          </div>
          ${allRuns.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" id="au-clear-all-history">Clear history</button>` : ''}
        </div>

        ${allRuns.length === 0 ? `
          <div class="au-empty-state">
            <p>No recorded executions yet. Run an automation to see detailed step logs here.</p>
          </div>
        ` : `
          <ol class="au-history-list">
            ${allRuns.map(run => `
              <li class="au-history-item ${run.ok ? 'is-ok' : 'is-fail'}">
                <div class="au-history-summary">
                  <span class="au-history-dot ${run.ok ? 'is-ok' : 'is-fail'}" aria-hidden="true"></span>
                  <div class="au-history-meta">
                    <strong>${esc(run.automationName)}</strong>
                    <small>${when(run.at)} · Reason: ${esc(run.reason)}</small>
                  </div>
                  <span class="au-history-result-pill ${run.ok ? 'is-ok' : 'is-fail'}">
                    ${run.ok ? 'Succeeded' : 'Failed'}
                  </span>
                </div>
                <div class="au-history-output">
                  <p class="au-history-summary-text">${esc(run.summary)}</p>
                  ${run.steps?.length ? `
                    <div class="au-history-steps">
                      ${run.steps.map((st, si) => `
                        <div class="au-history-step-row ${st.ok ? '' : 'is-error'}">
                          <span class="au-hstep-num">${si + 1}</span>
                          <span class="au-hstep-name">${esc(ACTION_META[st.type]?.label || st.type)}</span>
                          <span class="au-hstep-ms">${st.ms ? `${st.ms}ms` : ''}</span>
                          <span class="au-hstep-out">${esc(st.error || st.output || 'Done')}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </li>
            `).join('')}
          </ol>
        `}
      </div>`;
    }

    /* ---------------- 4. Visual Workflow Editor ---------------- */

    function openEditor(source = null) {
      const base = source || {
        name: 'My New Automation',
        description: '',
        icon: 'bolt',
        color: 'indigo',
        trigger: { type: 'manual' },
        actions: [
          { type: 'assistant', prompt: 'Write an inspiring thought for today' },
          { type: 'notify', title: 'Thought of the day', message: '{{previous}}' },
        ],
      };

      editing = {
        id: source?.id || null,
        name: base.name || '',
        description: base.description || '',
        icon: base.icon || 'bolt',
        color: base.color || 'indigo',
        trigger: { ...base.trigger },
        actions: base.actions.map(a => ({ ...a })),
        preset: base.trigger.type === 'cron'
          ? { time: '08:00', weekday: 1, monthDay: 1, minutes: 30, ...presetOf(base.trigger.cron) }
          : { every: 'day', time: '08:00', weekday: 1, monthDay: 1, minutes: 30 },
        error: '',
        testOutput: null,
      };

      liveStepStatus = {};
      renderActiveView();
      $('#au-editor-canvas')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function scheduleCron() {
      return editing.preset.every === 'custom' ? (editing.trigger.cron || '') : cronFromPreset(editing.preset);
    }

    function previewSchedule() {
      const t = editing.trigger;
      if (t.type === 'manual') return 'Runs manually when you tap the Run button or widget.';
      if (t.type === 'app-open') return 'Runs automatically each time Toolbox opens in your browser.';
      if (t.type === 'once') return t.at ? `Runs once on ${when(Date.parse(t.at) || t.at)}.` : 'Pick date and time.';
      try {
        const cron = scheduleCron();
        const s = parseCron(cron);
        return `${describeCron(s, cron)}. Next: ${nextRuns(s, new Date(), 2).map(d => when(d.getTime())).join(', ')}.`;
      } catch (err) { return err.message; }
    }

    function variablePills(stepIndex) {
      const vars = ['{{previous}}', '{{clipboard}}', '{{today}}', '{{now}}', '{{date}}', '{{time}}'];
      for (let j = 0; j < stepIndex; j++) {
        if (editing.actions[j].type === 'variable' && editing.actions[j].varName) {
          vars.push(`{{vars.${editing.actions[j].varName}}}`);
        }
      }
      return `<div class="au-var-bar">
        <span class="au-var-label">Insert:</span>
        ${vars.map(v => `<button type="button" class="au-var-chip" data-var="${esc(v)}" tabindex="-1">${esc(v)}</button>`).join('')}
      </div>`;
    }

    function renderEditor() {
      const view = $('#au-view-container');
      const t = editing.trigger;
      const p = editing.preset;
      const onceValue = t.type === 'once' && t.at
        ? (() => { const d = new Date(typeof t.at === 'number' ? t.at : Date.parse(t.at)); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()
        : '';

      view.innerHTML = `<div class="au-editor-canvas" id="au-editor-canvas">
        <div class="au-editor-header au-color-${esc(editing.color)}">
          <div class="au-editor-meta-left">
            <div class="au-icon-picker-anchor" id="au-icon-picker-btn" title="Choose icon & color">
              <span class="au-editor-icon">${icon(editing.icon, { size: 24 })}</span>
              <span class="au-color-dot au-bg-${esc(editing.color)}"></span>
            </div>
            <div class="au-editor-titles">
              <input type="text" class="au-editor-name-input" id="au-name" value="${esc(editing.name)}" placeholder="Automation name" maxlength="120">
              <input type="text" class="au-editor-desc-input" id="au-desc" value="${esc(editing.description)}" placeholder="Add optional description…">
            </div>
          </div>
          <div class="au-editor-header-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="au-test-run-btn">
              ${icon('play', { size: 14 })} Test Run
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="au-save-btn">Save</button>
            <button type="button" class="btn btn-ghost btn-sm" id="au-cancel-btn">Cancel</button>
          </div>
        </div>

        <div class="au-editor-content">
          <!-- Trigger Section -->
          <section class="au-block au-trigger-block">
            <div class="au-block-header">
              <div class="au-step-badge">${icon('clock', { size: 16 })}</div>
              <div>
                <h4 class="au-block-title">Trigger</h4>
                <p class="au-block-desc">${esc(previewSchedule())}</p>
              </div>
            </div>
            <div class="au-block-body">
              <div class="au-field-row">
                <label class="au-form-field">
                  <span>When to run</span>
                  <select class="tool-input" id="au-ttype">
                    <option value="manual" ${t.type === 'manual' ? 'selected' : ''}>On Tap (Run on demand)</option>
                    <option value="cron" ${t.type === 'cron' ? 'selected' : ''}>On a schedule (Recurring)</option>
                    <option value="once" ${t.type === 'once' ? 'selected' : ''}>Once at specific date & time</option>
                    <option value="app-open" ${t.type === 'app-open' ? 'selected' : ''}>Whenever Toolbox opens</option>
                  </select>
                </label>

                ${t.type === 'cron' ? `
                  <label class="au-form-field">
                    <span>Frequency</span>
                    <select class="tool-input" id="au-every">
                      ${[['day', 'Every day'], ['weekday', 'Every weekday (Mon–Fri)'], ['week', 'Every week'], ['month', 'Every month'], ['hour', 'Every hour'], ['minutes', 'Every few minutes'], ['custom', 'Custom cron expression']].map(([v, l]) => `<option value="${v}" ${p.every === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                  </label>
                  ${['day', 'weekday', 'week', 'month'].includes(p.every) ? `
                    <label class="au-form-field">
                      <span>Time</span>
                      <input type="time" class="tool-input" id="au-time" value="${esc(p.time)}">
                    </label>
                  ` : ''}
                  ${p.every === 'week' ? `
                    <label class="au-form-field">
                      <span>Day</span>
                      <select class="tool-input" id="au-weekday">${DAYS.map((d, i) => `<option value="${i}" ${Number(p.weekday) === i ? 'selected' : ''}>${d}</option>`).join('')}</select>
                    </label>
                  ` : ''}
                  ${p.every === 'month' ? `
                    <label class="au-form-field">
                      <span>Day of month</span>
                      <input type="number" class="tool-input" id="au-monthday" min="1" max="28" value="${esc(p.monthDay)}">
                    </label>
                  ` : ''}
                  ${p.every === 'minutes' ? `
                    <label class="au-form-field">
                      <span>Interval (minutes)</span>
                      <input type="number" class="tool-input" id="au-minutes" min="5" max="59" value="${esc(p.minutes)}">
                    </label>
                  ` : ''}
                  ${p.every === 'custom' ? `
                    <label class="au-form-field au-field-wide">
                      <span>Cron expression (minute hour day month weekday)</span>
                      <input type="text" class="tool-input au-mono" id="au-cron" value="${esc(t.cron || '')}" placeholder="0 8 * * 1-5" spellcheck="false">
                    </label>
                  ` : ''}
                ` : ''}

                ${t.type === 'once' ? `
                  <label class="au-form-field">
                    <span>Date & time</span>
                    <input type="datetime-local" class="tool-input" id="au-at" value="${esc(onceValue)}">
                  </label>
                ` : ''}
              </div>
            </div>
          </section>

          <!-- Connected Action Stack -->
          <div class="au-connector-flow-line" aria-hidden="true"></div>

          <div class="au-action-stack">
            ${editing.actions.map((act, i) => renderActionCard(act, i)).join(`
              <div class="au-step-flow-joint">
                <span class="au-joint-dot"></span>
                <button type="button" class="au-joint-add-btn" data-insert-after="${0}" title="Insert step here">
                  ${icon('plus', { size: 12 })}
                </button>
              </div>
            `)}
          </div>

          <div class="au-add-step-zone">
            <button type="button" class="btn btn-secondary" id="au-add-action-btn">
              ${icon('plus', { size: 14 })} Add Action
            </button>
          </div>

          ${editing.error ? `<div class="au-editor-error" role="alert">${esc(editing.error)}</div>` : ''}

          <!-- Live Step Execution Inspector Drawer -->
          <div class="au-test-console" id="au-test-console" ${editing.testOutput ? '' : 'hidden'}>
            <div class="au-test-console-head">
              <strong>${icon('sparkles', { size: 14 })} Test Run Output</strong>
              <button type="button" class="au-icon-btn" id="au-close-console">${icon('x', { size: 14 })}</button>
            </div>
            <pre class="au-test-console-body" id="au-test-console-body">${esc(editing.testOutput || '')}</pre>
          </div>
        </div>
      </div>`;
    }

    function renderActionCard(a, i) {
      const meta = ACTION_META[a.type] || { label: a.type, color: 'indigo', icon: 'bolt' };
      const status = liveStepStatus[i];

      return `<div class="au-block au-action-block ${a.disabled ? 'is-disabled' : ''} ${status?.status ? `is-live-${status.status}` : ''}" data-step-index="${i}">
        <div class="au-block-header">
          <div class="au-step-badge au-badge-${esc(meta.color)}">${i + 1}</div>
          <div class="au-block-meta-title">
            <select class="tool-input au-action-type-select" data-i="${i}" aria-label="Step ${i + 1} type">
              ${ACTION_TYPES.map(ty => `<option value="${ty}" ${a.type === ty ? 'selected' : ''}>${ACTION_META[ty]?.label || ty}</option>`).join('')}
            </select>
            ${status?.ms ? `<span class="au-live-ms">${status.ms}ms</span>` : ''}
          </div>
          <div class="au-block-controls">
            <button type="button" class="au-control-btn" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Move up">${icon('chevron-up', { size: 13 })}</button>
            <button type="button" class="au-control-btn" data-move="1" data-i="${i}" ${i === editing.actions.length - 1 ? 'disabled' : ''} title="Move down">${icon('chevron-down', { size: 13 })}</button>
            <button type="button" class="au-control-btn" data-duplicate-step="${i}" title="Duplicate step">${icon('plus', { size: 13 })}</button>
            <button type="button" class="au-control-btn au-btn-danger" data-remove-step="${i}" ${editing.actions.length === 1 ? 'disabled' : ''} title="Delete step">${icon('trash', { size: 13 })}</button>
          </div>
        </div>

        <div class="au-block-body">
          ${actionFields(a, i)}
          ${variablePills(i)}
          ${status?.output ? `<div class="au-step-live-result"><span class="au-res-tag">Output:</span> ${esc(status.output)}</div>` : ''}
          ${status?.error ? `<div class="au-step-live-error"><span class="au-res-tag">Error:</span> ${esc(status.error)}</div>` : ''}
        </div>
      </div>`;
    }

    function actionFields(a, i) {
      const f = (k, label, val, { area = false, ph = '' } = {}) => `
        <label class="au-form-field ${area ? 'au-field-wide' : ''}">
          <span>${label}</span>
          ${area
            ? `<textarea class="tool-input au-auto-expand" data-i="${i}" data-k="${k}" rows="2" placeholder="${esc(ph)}">${esc(val)}</textarea>`
            : `<input type="text" class="tool-input" data-i="${i}" data-k="${k}" value="${esc(val)}" placeholder="${esc(ph)}">`}
        </label>`;

      switch (a.type) {
        case 'assistant':
          return f('prompt', 'Prompt for Assistant', a.prompt, { area: true, ph: 'Synthesize today’s briefing in 3 bullets…' });

        case 'tool': {
          const sortedTools = [...TOOLS].sort((x, y) => x.name.localeCompare(y.name));
          return `
            <label class="au-form-field au-field-wide">
              <span>Choose Toolbox Tool</span>
              <select class="tool-input" data-i="${i}" data-k="toolId">
                <option value="">Select a tool…</option>
                ${sortedTools.map(t => `<option value="${t.id}" ${a.toolId === t.id ? 'selected' : ''}>${esc(t.name)} (${esc(t.category)})</option>`).join('')}
              </select>
            </label>
            ${f('input', 'Tool Input', a.input, { area: true, ph: '{{previous}}' })}`;
        }

        case 'mind':
          return `
            <div class="au-field-row">
              ${f('name', 'Entity / Memory Name', a.name, { ph: 'Evening Reflection' })}
              <label class="au-form-field">
                <span>Kind</span>
                <select class="tool-input" data-i="${i}" data-k="mindType">
                  ${['Idea', 'Memory', 'Note', 'Project', 'Task', 'Person'].map(k => `<option value="${k}" ${a.mindType === k ? 'selected' : ''}>${k}</option>`).join('')}
                </select>
              </label>
            </div>
            ${f('content', 'Content to Remember', a.content, { area: true, ph: '{{previous}}' })}`;

        case 'note':
          return `
            <div class="au-field-row">
              ${f('title', 'Note Title', a.title, { ph: 'Daily Standup' })}
              <label class="au-form-field">
                <span>Mode</span>
                <select class="tool-input" data-i="${i}" data-k="mode">
                  <option value="create" ${a.mode !== 'append' ? 'selected' : ''}>Create New Note</option>
                  <option value="append" ${a.mode === 'append' ? 'selected' : ''}>Append to Existing Note</option>
                </select>
              </label>
            </div>
            ${f('content', 'Content', a.content, { area: true, ph: '{{previous}}' })}`;

        case 'calendar':
          return `
            <div class="au-field-row">
              <label class="au-form-field">
                <span>Action</span>
                <select class="tool-input" data-i="${i}" data-k="calAction">
                  <option value="today" ${a.calAction === 'today' ? 'selected' : ''}>Get Today’s Schedule</option>
                  <option value="add" ${a.calAction !== 'today' ? 'selected' : ''}>Create Calendar Event</option>
                </select>
              </label>
              ${a.calAction !== 'today' ? `
                ${f('title', 'Event Title', a.title, { ph: 'Meeting' })}
                ${f('date', 'Date', a.date || '{{today}}', { ph: '{{today}} or YYYY-MM-DD' })}
                ${f('time', 'Time', a.time || '09:00', { ph: 'HH:MM' })}
                ${f('duration', 'Duration (mins)', a.duration || '30', { ph: '30' })}
              ` : ''}
            </div>`;

        case 'clipboard':
          return `
            <div class="au-field-row">
              <label class="au-form-field">
                <span>Clipboard Action</span>
                <select class="tool-input" data-i="${i}" data-k="clipAction">
                  <option value="copy" ${a.clipAction !== 'read' ? 'selected' : ''}>Copy to Clipboard</option>
                  <option value="read" ${a.clipAction === 'read' ? 'selected' : ''}>Read from Clipboard</option>
                </select>
              </label>
              ${a.clipAction !== 'read' ? f('text', 'Text to Copy', a.text, { area: true, ph: '{{previous}}' }) : ''}
            </div>`;

        case 'transform':
          return `
            <div class="au-field-row">
              <label class="au-form-field">
                <span>Operation</span>
                <select class="tool-input" data-i="${i}" data-k="op">
                  <option value="uppercase" ${a.op === 'uppercase' ? 'selected' : ''}>UPPERCASE</option>
                  <option value="lowercase" ${a.op === 'lowercase' ? 'selected' : ''}>lowercase</option>
                  <option value="titlecase" ${a.op === 'titlecase' ? 'selected' : ''}>Title Case</option>
                  <option value="trim" ${a.op === 'trim' ? 'selected' : ''}>Trim Whitespace</option>
                  <option value="slug" ${a.op === 'slug' ? 'selected' : ''}>Slugify (kebab-case)</option>
                  <option value="length" ${a.op === 'length' ? 'selected' : ''}>Character Count</option>
                  <option value="replace" ${a.op === 'replace' ? 'selected' : ''}>Find & Replace</option>
                </select>
              </label>
              ${a.op === 'replace' ? `
                ${f('find', 'Find text', a.find, { ph: 'old' })}
                ${f('replaceWith', 'Replace with', a.replaceWith, { ph: 'new' })}
              ` : ''}
            </div>
            ${f('input', 'Input text', a.input, { area: true, ph: '{{previous}}' })}`;

        case 'calc':
          return f('expression', 'Math Expression', a.expression, { ph: '2 * {{previous}} + 10' });

        case 'variable':
          return `
            <div class="au-field-row">
              ${f('varName', 'Variable Name', a.varName, { ph: 'myResult' })}
              ${f('value', 'Value to Store', a.value, { area: true, ph: '{{previous}}' })}
            </div>`;

        case 'condition':
          return `
            <div class="au-field-row">
              ${f('left', 'Value to Test', a.left, { ph: '{{previous}}' })}
              <label class="au-form-field">
                <span>Condition</span>
                <select class="tool-input" data-i="${i}" data-k="op">
                  <option value="contains" ${a.op === 'contains' ? 'selected' : ''}>Contains</option>
                  <option value="equals" ${a.op === 'equals' ? 'selected' : ''}>Equals</option>
                  <option value="greater" ${a.op === 'greater' ? 'selected' : ''}>Greater than</option>
                  <option value="less" ${a.op === 'less' ? 'selected' : ''}>Less than</option>
                  <option value="empty" ${a.op === 'empty' ? 'selected' : ''}>Is Empty</option>
                  <option value="not_empty" ${a.op === 'not_empty' ? 'selected' : ''}>Is Not Empty</option>
                </select>
              </label>
              ${f('right', 'Comparison Value', a.right, { ph: 'target text' })}
              <label class="au-form-field">
                <span>If false</span>
                <select class="tool-input" data-i="${i}" data-k="ifFalse">
                  <option value="stop" ${a.ifFalse === 'stop' ? 'selected' : ''}>Stop Workflow</option>
                  <option value="skip" ${a.ifFalse !== 'stop' ? 'selected' : ''}>Skip Next Step</option>
                </select>
              </label>
            </div>`;

        case 'delay':
          return `
            <label class="au-form-field">
              <span>Wait seconds (1 to 30)</span>
              <input type="number" class="tool-input" data-i="${i}" data-k="seconds" min="1" max="30" value="${esc(a.seconds || 1)}">
            </label>`;

        case 'speak':
          return f('text', 'Text to Speak Aloud', a.text, { area: true, ph: '{{previous}}' });

        case 'sound':
          return `
            <div class="au-field-row">
              <label class="au-form-field">
                <span>Chime Tone</span>
                <select class="tool-input" data-i="${i}" data-k="chime">
                  <option value="bell" ${a.chime === 'bell' ? 'selected' : ''}>Gentle Bell</option>
                  <option value="ping" ${a.chime === 'ping' ? 'selected' : ''}>Modern Ping</option>
                  <option value="success" ${a.chime === 'success' ? 'selected' : ''}>Success Melody</option>
                  <option value="alert" ${a.chime === 'alert' ? 'selected' : ''}>Alert Chime</option>
                </select>
              </label>
              <button type="button" class="btn btn-secondary btn-sm au-test-chime-btn" data-chime="${esc(a.chime || 'bell')}">
                ${icon('play', { size: 12 })} Preview Tone
              </button>
            </div>`;

        case 'fetch':
          return `
            <div class="au-field-row">
              ${f('url', 'Endpoint URL', a.url, { ph: 'https://api.example.com/data' })}
              <label class="au-form-field">
                <span>Method</span>
                <select class="tool-input" data-i="${i}" data-k="method">
                  <option value="GET" ${a.method !== 'POST' ? 'selected' : ''}>GET</option>
                  <option value="POST" ${a.method === 'POST' ? 'selected' : ''}>POST</option>
                </select>
              </label>
            </div>
            ${a.method === 'POST' ? f('body', 'Request Body (JSON or text)', a.body, { area: true, ph: '{"text": "{{previous}}"}' }) : ''}`;

        case 'notify':
          return `
            <div class="au-field-row">
              ${f('title', 'Notification Title', a.title, { ph: 'Automation Finished' })}
            </div>
            ${f('message', 'Message Text', a.message, { area: true, ph: '{{previous}}' })}`;

        case 'open':
          return `
            <div class="au-field-row">
              ${f('toolId', 'Tool ID or URL', a.toolId, { ph: 'calendar' })}
              ${f('message', 'Alert Message', a.message, { ph: 'Tap to open' })}
            </div>`;

        default:
          return '';
      }
    }

    /* ---------------- Action Library Modal ---------------- */

    function openActionPicker(insertIndex = null) {
      openPickerIndex = insertIndex;
      const scrim = $('#au-modal-scrim');
      scrim.hidden = false;
      scrim.innerHTML = `<div class="au-picker-modal" role="dialog" aria-modal="true" aria-label="Action Library">
        <div class="au-picker-head">
          <div class="au-picker-search">
            <span class="au-search-icon">${icon('sparkle', { size: 14 })}</span>
            <input type="search" class="au-search-input" id="au-picker-search-input" placeholder="Search actions (AI, Notes, Mind, Tools…)">
          </div>
          <button type="button" class="au-icon-btn" id="au-picker-close">${icon('x', { size: 16 })}</button>
        </div>
        <div class="au-picker-categories">
          ${CATEGORIES.map(c => `<button type="button" class="au-picker-cat-btn ${c.id === 'all' ? 'is-active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="au-picker-list" id="au-picker-list">
          ${renderActionPickerItems('all', '')}
        </div>
      </div>`;
      $('#au-picker-search-input')?.focus();
    }

    function renderActionPickerItems(cat = 'all', query = '') {
      const q = query.toLowerCase().trim();
      return ACTION_TYPES.filter(type => {
        const meta = ACTION_META[type];
        if (!meta) return false;
        if (cat !== 'all' && meta.cat !== cat) return false;
        if (q && !meta.label.toLowerCase().includes(q) && !meta.desc.toLowerCase().includes(q)) return false;
        return true;
      }).map(type => {
        const meta = ACTION_META[type];
        return `<button type="button" class="au-picker-item" data-add-type="${type}">
          <div class="au-picker-item-icon au-badge-${esc(meta.color)}">${icon(meta.icon, { size: 18 })}</div>
          <div class="au-picker-item-text">
            <strong>${esc(meta.label)}</strong>
            <small>${esc(meta.desc)}</small>
          </div>
          <span class="au-picker-add-glyph">${icon('plus', { size: 14 })}</span>
        </button>`;
      }).join('');
    }

    function closeActionPicker() {
      openPickerIndex = null;
      $('#au-modal-scrim').hidden = true;
      $('#au-modal-scrim').innerHTML = '';
    }

    /* ---------------- Icon / Color Picker Modal ---------------- */

    function openIconPicker() {
      const scrim = $('#au-modal-scrim');
      scrim.hidden = false;
      scrim.innerHTML = `<div class="au-icon-modal" role="dialog" aria-modal="true" aria-label="Customize Appearance">
        <div class="au-picker-head">
          <h3>Automation Appearance</h3>
          <button type="button" class="au-icon-btn" id="au-picker-close">${icon('x', { size: 16 })}</button>
        </div>
        <div class="au-icon-modal-section">
          <label>Theme Color</label>
          <div class="au-color-swatches">
            ${AUTOMATION_COLORS.map(c => `
              <button type="button" class="au-color-swatch au-bg-${c} ${editing.color === c ? 'is-selected' : ''}" data-pick-color="${c}" title="${c}"></button>
            `).join('')}
          </div>
        </div>
        <div class="au-icon-modal-section">
          <label>Icon Glyph</label>
          <div class="au-glyph-grid">
            ${AUTOMATION_ICONS.map(ic => `
              <button type="button" class="au-glyph-btn ${editing.icon === ic ? 'is-selected' : ''}" data-pick-icon="${ic}" title="${ic}">
                ${icon(ic, { size: 20 })}
              </button>
            `).join('')}
          </div>
        </div>
      </div>`;
    }

    /* ---------------- Input Reading & State Sync ---------------- */

    function readInputs() {
      if (!editing) return;
      const v = (id) => $(id)?.value;
      if ($('#au-name')) editing.name = v('#au-name');
      if ($('#au-desc')) editing.description = v('#au-desc');
      if ($('#au-minutes')) editing.preset.minutes = Number(v('#au-minutes'));
      if ($('#au-time')) editing.preset.time = v('#au-time') || '08:00';
      if ($('#au-weekday')) editing.preset.weekday = Number(v('#au-weekday'));
      if ($('#au-monthday')) editing.preset.monthDay = Number(v('#au-monthday'));
      if ($('#au-cron')) editing.trigger.cron = v('#au-cron');
      if ($('#au-at')) editing.trigger.at = v('#au-at');

      container.querySelectorAll('.au-action-block [data-k]').forEach(el => {
        const i = Number(el.dataset.i);
        const k = el.dataset.k;
        if (editing.actions[i]) editing.actions[i][k] = el.value;
      });

      if (editing.trigger.type === 'cron' && editing.preset.every !== 'custom') {
        editing.trigger.cron = cronFromPreset(editing.preset);
      }
    }

    function saveCurrentAutomation() {
      readInputs();
      const trigger = editing.trigger.type === 'cron' ? { type: 'cron', cron: scheduleCron() }
        : editing.trigger.type === 'once' ? { type: 'once', at: editing.trigger.at ? new Date(editing.trigger.at).getTime() : null }
        : editing.trigger.type === 'app-open' ? { type: 'app-open' }
        : { type: 'manual' };

      const recipe = {
        name: editing.name.trim() || 'Untitled automation',
        description: editing.description.trim(),
        icon: editing.icon,
        color: editing.color,
        trigger,
        actions: editing.actions,
      };

      try {
        if (editing.id) {
          updateAutomation(editing.id, recipe);
        } else {
          createAutomation(recipe);
        }
        editing = null;
        renderActiveView();
      } catch (err) {
        editing.error = err?.message || 'That automation is not valid.';
        renderEditor();
      }
    }

    /* ---------------- Event Listeners ---------------- */

    const onClick = async (e) => {
      const t = e.target;

      // Header navigation tabs
      const tabBtn = t.closest('.au-tab');
      if (tabBtn) {
        currentTab = tabBtn.dataset.view;
        editing = null;
        container.querySelectorAll('.au-tab').forEach(b => {
          const on = b === tabBtn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        renderActiveView();
        return;
      }

      // New automation
      if (t.closest('#au-new-btn') || t.closest('#au-empty-new')) {
        openEditor();
        return;
      }

      // Empty gallery jump
      if (t.closest('#au-empty-gallery')) {
        currentTab = 'templates';
        container.querySelectorAll('.au-tab').forEach(b => {
          const on = b.dataset.view === 'templates';
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        renderActiveView();
        return;
      }

      // Import button
      if (t.closest('#au-import-btn')) {
        $('#au-file-input')?.click();
        return;
      }

      // Export all button
      if (t.closest('#au-export-all-btn')) {
        const list = loadAutomations();
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toolbox-automations-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Permissions alert allow
      if (t.closest('#au-allow')) {
        const { NotificationEngine } = await import('../lib/notifications.js');
        await NotificationEngine.enableBrowserNotifications();
        renderAlerts();
        return;
      }

      // Filter pills
      const filterPill = t.closest('[data-filter]');
      if (filterPill) {
        activeFilter = filterPill.dataset.filter;
        renderActiveView();
        return;
      }

      // Templates category filter
      const gFilter = t.closest('[data-gfilter]');
      if (gFilter) {
        galleryFilter = gFilter.dataset.gfilter;
        renderActiveView();
        return;
      }

      // Add template from gallery
      const addTplBtn = t.closest('[data-add-template]');
      if (addTplBtn) {
        const idx = Number(addTplBtn.dataset.addTemplate);
        const tpl = TEMPLATES[idx];
        if (tpl) {
          createAutomation({
            name: tpl.name,
            description: tpl.description,
            icon: tpl.icon,
            color: tpl.color,
            tags: tpl.tags ? [...tpl.tags] : [],
            trigger: { ...tpl.trigger },
            actions: tpl.actions.map(a => ({ ...a })),
          });
          currentTab = 'automations';
          container.querySelectorAll('.au-tab').forEach(b => {
            const on = b.dataset.view === 'automations';
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', String(on));
          });
          renderActiveView();
        }
        return;
      }

      // Clear history
      if (t.closest('#au-clear-all-history')) {
        const list = loadAutomations();
        list.forEach(a => { a.log = []; });
        try { localStorage.setItem('toolbox_automations_v1', JSON.stringify(list)); } catch {}
        renderActiveView();
        return;
      }

      // Editor Actions
      if (t.closest('#au-save-btn')) { saveCurrentAutomation(); return; }
      if (t.closest('#au-cancel-btn')) { editing = null; renderActiveView(); return; }

      // Icon & Color picker open
      if (t.closest('#au-icon-picker-btn')) { openIconPicker(); return; }

      // Pick Color
      const colorSwatch = t.closest('[data-pick-color]');
      if (colorSwatch) {
        editing.color = colorSwatch.dataset.pickColor;
        closeActionPicker();
        renderEditor();
        return;
      }

      // Pick Icon
      const glyphBtn = t.closest('[data-pick-icon]');
      if (glyphBtn) {
        editing.icon = glyphBtn.dataset.pickIcon;
        closeActionPicker();
        renderEditor();
        return;
      }

      // Add Action button
      if (t.closest('#au-add-action-btn')) {
        readInputs();
        openActionPicker(editing.actions.length);
        return;
      }

      // Joint add step button
      const jointAdd = t.closest('[data-insert-after]');
      if (jointAdd) {
        readInputs();
        openActionPicker(Number(jointAdd.dataset.insertAfter) + 1);
        return;
      }

      // Action Picker Category
      const pCatBtn = t.closest('[data-cat]');
      if (pCatBtn) {
        container.querySelectorAll('.au-picker-cat-btn').forEach(b => b.classList.toggle('is-active', b === pCatBtn));
        const cat = pCatBtn.dataset.cat;
        const q = $('#au-picker-search-input')?.value || '';
        $('#au-picker-list').innerHTML = renderActionPickerItems(cat, q);
        return;
      }

      // Add selected action from picker
      const addTypeBtn = t.closest('[data-add-type]');
      if (addTypeBtn) {
        const ty = addTypeBtn.dataset.addType;
        const insIdx = openPickerIndex != null ? openPickerIndex : editing.actions.length;
        const newAct = { type: ty, ...(ty === 'notify' ? { title: '', message: '{{previous}}' } : {}) };
        editing.actions.splice(insIdx, 0, newAct);
        closeActionPicker();
        renderEditor();
        return;
      }

      // Close modal / scrim
      if (t.closest('#au-picker-close') || t.id === 'au-modal-scrim') {
        closeActionPicker();
        return;
      }

      // Test Chime Preview Button
      const chimeBtn = t.closest('.au-test-chime-btn');
      if (chimeBtn) {
        playChime(chimeBtn.dataset.chime || 'bell');
        return;
      }

      // Duplicate step
      const dupStep = t.closest('[data-duplicate-step]');
      if (dupStep) {
        readInputs();
        const i = Number(dupStep.dataset.duplicateStep);
        editing.actions.splice(i + 1, 0, { ...editing.actions[i] });
        renderEditor();
        return;
      }

      // Remove step
      const rmStep = t.closest('[data-remove-step]');
      if (rmStep) {
        readInputs();
        const i = Number(rmStep.dataset.removeStep);
        editing.actions.splice(i, 1);
        renderEditor();
        return;
      }

      // Move step
      const mvStep = t.closest('[data-move]');
      if (mvStep) {
        readInputs();
        const i = Number(mvStep.dataset.i), j = i + Number(mvStep.dataset.move);
        if (j >= 0 && j < editing.actions.length) {
          [editing.actions[i], editing.actions[j]] = [editing.actions[j], editing.actions[i]];
          renderEditor();
        }
        return;
      }

      // Variable chip insertion into input
      const varChip = t.closest('[data-var]');
      if (varChip) {
        const token = varChip.dataset.var;
        const card = varChip.closest('.au-action-block');
        const targetInput = card?.querySelector('textarea, input[type="text"]');
        if (targetInput) {
          const start = targetInput.selectionStart ?? targetInput.value.length;
          const end = targetInput.selectionEnd ?? targetInput.value.length;
          const val = targetInput.value;
          targetInput.value = val.slice(0, start) + token + val.slice(end);
          targetInput.selectionStart = targetInput.selectionEnd = start + token.length;
          targetInput.focus();
          readInputs();
        }
        return;
      }

      // Test Run in Editor with Live Highlights
      if (t.closest('#au-test-run-btn')) {
        readInputs();
        saveCurrentAutomation();
        const testBtn = $('#au-test-run-btn');
        testBtn.disabled = true;
        testBtn.innerHTML = `<span class="au-spinner"></span> Running…`;
        liveStepStatus = {};
        $('#au-test-console').hidden = false;
        $('#au-test-console-body').textContent = 'Executing automation steps…\n';

        try {
          const target = editing?.id ? loadAutomations().find(x => x.id === editing.id) : loadAutomations()[0];
          if (!target) throw new Error('Save automation first.');

          await runAutomation(target.id, {
            reason: 'test',
            onStepStart: (idx, action) => {
              liveStepStatus[idx] = { status: 'running' };
              const card = container.querySelector(`[data-step-index="${idx}"]`);
              if (card) {
                card.classList.add('is-live-running');
                card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            },
            onStepComplete: (idx, action, res) => {
              liveStepStatus[idx] = { status: res.ok ? 'done' : 'error', ms: res.ms, output: res.output, error: res.error };
              const card = container.querySelector(`[data-step-index="${idx}"]`);
              if (card) {
                card.classList.remove('is-live-running');
                card.classList.add(res.ok ? 'is-live-done' : 'is-live-error');
              }
              const con = $('#au-test-console-body');
              if (con) {
                con.textContent += `[Step ${idx + 1}: ${ACTION_META[action.type]?.label || action.type}] ${res.ok ? '✓' : '✕'} ${res.ms}ms\n${res.error || res.output || ''}\n\n`;
              }
            },
          });
        } catch (err) {
          const con = $('#au-test-console-body');
          if (con) con.textContent += `Error: ${err.message}\n`;
        } finally {
          testBtn.disabled = false;
          testBtn.innerHTML = `${icon('play', { size: 14 })} Test Run`;
        }
        return;
      }

      if (t.closest('#au-close-console')) {
        $('#au-test-console').hidden = true;
        return;
      }

      // Automation Tile Actions
      const tile = t.closest('.au-tile');
      const act = t.closest('[data-act]')?.dataset.act;
      if (!tile || !act || act === 'toggle') return;
      const id = tile.dataset.id;
      const auto = loadAutomations().find(a => a.id === id);
      if (!auto) { renderActiveView(); return; }

      if (act === 'edit') {
        openEditor(auto);
      } else if (act === 'duplicate') {
        duplicateAutomation(id);
        renderActiveView();
      } else if (act === 'export') {
        const blob = new Blob([JSON.stringify(auto, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${auto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (act === 'delete') {
        const { tbConfirm } = await import('../lib/dialog.js');
        if (await tbConfirm(`Delete automation “${auto.name}”?`, { title: 'Delete automation', confirmText: 'Delete', destructive: true })) {
          deleteAutomation(id);
          renderActiveView();
        }
      } else if (act === 'run') {
        runningAutomationId = id;
        renderActiveView();
        try {
          await runAutomation(id, { reason: 'manual' });
        } finally {
          runningAutomationId = null;
          renderActiveView();
        }
      }
    };

    const onChange = (e) => {
      const t = e.target;
      if (t.matches('[data-act="toggle"]')) {
        const id = t.closest('.au-tile')?.dataset.id;
        try { updateAutomation(id, { enabled: t.checked }); } catch {}
        renderActiveView();
        return;
      }

      if (!editing) return;

      if (t.id === 'au-ttype') {
        readInputs();
        editing.trigger = {
          type: t.value,
          cron: editing.trigger.cron || cronFromPreset(editing.preset),
          at: editing.trigger.at,
        };
        renderEditor();
      } else if (t.id === 'au-every') {
        readInputs();
        editing.preset.every = t.value;
        if (t.value === 'custom' && !editing.trigger.cron) editing.trigger.cron = '0 8 * * 1-5';
        renderEditor();
      } else if (t.classList.contains('au-action-type-select')) {
        readInputs();
        const i = Number(t.dataset.i);
        const newType = t.value;
        editing.actions[i] = { type: newType, ...(newType === 'notify' ? { message: '{{previous}}' } : {}) };
        renderEditor();
      }
    };

    const onInput = (e) => {
      const t = e.target;
      if (t.id === 'au-search-input') {
        searchQuery = t.value;
        renderAutomationsGrid($('#au-view-container'));
        return;
      }
      if (t.id === 'au-picker-search-input') {
        const activeCat = container.querySelector('.au-picker-cat-btn.is-active')?.dataset.cat || 'all';
        $('#au-picker-list').innerHTML = renderActionPickerItems(activeCat, t.value);
        return;
      }
      if (editing && t.closest('.au-editor-canvas')) {
        readInputs();
        const preview = container.querySelector('.au-trigger-block .au-block-desc');
        if (preview) preview.textContent = previewSchedule();
      }
    };

    const onFileImport = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item && item.actions) createAutomation(item);
            });
          } else if (parsed && parsed.actions) {
            createAutomation(parsed);
          }
          renderActiveView();
        } catch (err) {
          alert('Could not import automation: invalid JSON.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    const onUpdated = () => {
      if (!container.isConnected) return;
      if (!editing) renderActiveView();
    };

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);
    $('#au-file-input')?.addEventListener('change', onFileImport);
    window.addEventListener('toolbox:automations-updated', onUpdated);

    const refresh = setInterval(() => { if (!editing && currentTab === 'automations') renderActiveView(); }, 60_000);

    renderAlerts();
    renderActiveView();

    this._cleanup = () => {
      clearInterval(refresh);
      window.removeEventListener('toolbox:automations-updated', onUpdated);
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      $('#au-file-input')?.removeEventListener('change', onFileImport);
    };
  },

  destroy() {
    this._cleanup?.();
    this._cleanup = null;
  },
};
