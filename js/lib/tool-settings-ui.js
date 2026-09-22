/* Preferences → Tools: renders every tool's settings from its schema. */

import { listToolSettings, getToolSettings, setToolSetting, resetToolSettings } from './tool-settings.js';
import { TOOLS } from '../registry/tools.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fieldHtml(toolId, field, value) {
  const id = `tp-${toolId}-${field.key}`;
  const copy = `<span class="tp-copy"><label for="${id}" class="tp-label">${esc(field.label)}</label>${field.help ? `<small class="tp-help">${esc(field.help)}</small>` : ''}</span>`;
  const data = `data-tool="${esc(toolId)}" data-key="${esc(field.key)}" data-type="${field.type}"`;
  switch (field.type) {
    case 'toggle':
      return `<div class="tp-row">${copy}<input type="checkbox" class="switch" id="${id}" ${data} ${value ? 'checked' : ''}></div>`;
    case 'range': {
      const shown = field.format ? field.format(value) : value;
      return `<div class="tp-row tp-row-stack">${copy}<div class="tp-range"><input type="range" class="tool-range" id="${id}" ${data} min="${field.min}" max="${field.max}" step="${field.step || 1}" value="${value}"><output class="tp-range-value" for="${id}">${esc(shown)}</output></div></div>`;
    }
    case 'segmented':
      return `<div class="tp-row tp-row-stack">${copy}<div class="tp-seg" role="radiogroup" aria-label="${esc(field.label)}" id="${id}" ${data}>${field.options.map(o =>
        `<button type="button" role="radio" aria-checked="${String(o.value) === String(value)}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div></div>`;
    case 'select': {
      const opts = typeof field.options === 'function' ? null : field.options;
      return `<div class="tp-row">${copy}<select class="tool-select tp-select" id="${id}" ${data} ${opts ? '' : 'data-async="1" disabled'}>${opts
        ? opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')
        : '<option>Loading…</option>'}</select></div>`;
    }
    default: return '';
  }
}

function coerce(field, raw) {
  if (field.type === 'toggle') return Boolean(raw);
  if (field.type === 'range') return Number(raw);
  const sample = field.default;
  return typeof sample === 'number' ? Number(raw) : String(raw);
}

export function renderToolPreferences(container, focusId = null) {
  if (!container) return;
  const tools = listToolSettings();
  const meta = new Map(TOOLS.map(t => [t.id, t]));
  container.innerHTML = `<div class="tp-list">${tools.map(t => {
    const values = getToolSettings(t.id);
    const icon = meta.get(t.id)?.icon || '';
    return `<article class="tp-card${focusId === t.id ? ' is-focused' : ''}" id="tp-card-${esc(t.id)}" data-tool-card="${esc(t.id)}">
      <header class="tp-card-head">
        <span class="tp-card-icon" aria-hidden="true">${icon}</span>
        <span class="tp-card-title"><strong>${esc(t.title)}</strong><small>${esc(t.hint || '')}</small></span>
        <button type="button" class="btn btn-ghost btn-sm tp-reset" data-reset="${esc(t.id)}">Reset</button>
      </header>
      ${t.groups.map(g => `<section class="tp-group">
        <h4 class="tp-group-title">${esc(g.title)}</h4>${g.hint ? `<p class="tp-group-hint">${esc(g.hint)}</p>` : ''}
        <div class="tp-rows">${g.fields.map(f => fieldHtml(t.id, f, values[f.key])).join('')}</div>
      </section>`).join('')}
    </article>`;
  }).join('')}</div>`;

  const fieldOf = (toolId, key) => tools.find(t => t.id === toolId)?.groups.flatMap(g => g.fields).find(f => f.key === key);

  // async option lists (e.g. Quran translations come from its API)
  container.querySelectorAll('select[data-async]').forEach(async (sel) => {
    const field = fieldOf(sel.dataset.tool, sel.dataset.key);
    try {
      const options = await field.options();
      const value = getToolSettings(sel.dataset.tool)[field.key];
      sel.innerHTML = options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      sel.disabled = false;
    } catch {
      sel.innerHTML = '<option>Available when online</option>';
    }
  });

  container.onchange = (e) => {
    const el = e.target.closest('[data-key]');
    if (!el || el.dataset.type === 'segmented') return;
    const field = fieldOf(el.dataset.tool, el.dataset.key);
    const raw = el.type === 'checkbox' ? el.checked : el.value;
    setToolSetting(el.dataset.tool, el.dataset.key, coerce(field, raw));
  };
  container.oninput = (e) => {
    const el = e.target;
    if (el.type !== 'range' || !el.dataset.key) return;
    const field = fieldOf(el.dataset.tool, el.dataset.key);
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = field.format ? field.format(Number(el.value)) : el.value;
  };
  container.onclick = (e) => {
    const seg = e.target.closest('.tp-seg button');
    if (seg) {
      const group = seg.parentElement;
      group.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === seg)));
      const field = fieldOf(group.dataset.tool, group.dataset.key);
      setToolSetting(group.dataset.tool, group.dataset.key, coerce(field, seg.dataset.value));
      return;
    }
    const reset = e.target.closest('[data-reset]');
    if (reset) {
      resetToolSettings(reset.dataset.reset);
      renderToolPreferences(container, reset.dataset.reset);
    }
  };

  if (focusId) {
    requestAnimationFrame(() => {
      const card = container.querySelector(`#tp-card-${CSS.escape(focusId)}`);
      card?.scrollIntoView({ block: 'start', behavior: 'instant' });
      setTimeout(() => card?.classList.remove('is-focused'), 1600);
    });
  }
}
