/* ============================================================
   Option forms from a schema.

   The text, PDF and media shells all describe their options the same
   way, so a tool is a list of fields and a function, never markup:

     { key: 'level', label: 'Level', type: 'select', options: [['1','Fast'], …], value: '3' }

   Types: select, seg, number, text, textarea, checkbox, range, color,
   date, datetime, time. `show(values)` hides a field that does not
   apply; `hint` is one line under it.
   ============================================================ */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function control(f, id, v) {
  const a = `id="${id}" data-key="${esc(f.key)}"`;
  switch (f.type) {
    case 'select':
      return `<select class="tool-select" ${a}>${f.options.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    case 'seg':
      return `<div class="pw-seg" role="radiogroup" ${a} aria-label="${esc(f.label || f.key)}">${f.options.map(([k, l]) =>
        `<button type="button" role="radio" data-v="${esc(k)}" aria-checked="${String(k) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    case 'checkbox':
      return `<label class="tool-checkbox"><input type="checkbox" ${a}${v ? ' checked' : ''}><span>${esc(f.label)}</span></label>`;
    case 'textarea':
      return `<textarea class="tool-input" rows="${f.rows || 3}" ${a} placeholder="${esc(f.placeholder || '')}" spellcheck="false">${esc(v)}</textarea>`;
    case 'range':
      return `<div class="kit-range"><input type="range" class="tool-range" ${a} min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${esc(v)}"><output>${esc(v)}${esc(f.unit || '')}</output></div>`;
    case 'number':
      return `<input type="number" class="tool-input" ${a} value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.step ?? 'any'}">`;
    case 'color':
      return `<input type="color" class="kit-color" ${a} value="${esc(v)}">`;
    case 'date': case 'time':
      return `<input type="${f.type}" class="tool-input" ${a} value="${esc(v)}">`;
    case 'datetime':
      return `<input type="datetime-local" class="tool-input" ${a} value="${esc(v)}" step="1">`;
    default:
      return `<input type="text" class="tool-input" ${a} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" spellcheck="false" autocomplete="off">`;
  }
}

export function resolveDefault(f) { return typeof f.value === 'function' ? f.value() : (f.value ?? (f.type === 'checkbox' ? false : '')); }

/**
 * Render fields into `host` and keep a live values object.
 * @returns {{ values: object, set(key, v): void, refresh(): void, destroy(): void }}
 */
export function mountForm(host, fields, { prefix = 'kf', initial = {}, onChange = () => {} } = {}) {
  const values = {};
  for (const f of fields) values[f.key] = initial[f.key] ?? resolveDefault(f);

  host.innerHTML = fields.map((f, i) => {
    const id = `${prefix}-${i}`;
    const body = control(f, id, values[f.key]);
    const wide = f.wide || f.type === 'textarea' ? ' is-wide' : '';
    if (f.type === 'checkbox') return `<div class="kit-field is-check${wide}" data-field="${esc(f.key)}">${body}${f.hint ? `<p class="kit-hint">${esc(f.hint)}</p>` : ''}</div>`;
    return `<div class="kit-field${wide}" data-field="${esc(f.key)}"><label for="${id}">${esc(f.label || '')}</label>${body}${f.hint ? `<p class="kit-hint">${esc(f.hint)}</p>` : ''}</div>`;
  }).join('');

  const read = (el) => {
    const f = fields.find((x) => x.key === el.dataset.key);
    if (!f) return;
    if (f.type === 'checkbox') values[f.key] = el.checked;
    else if (f.type === 'number' || f.type === 'range') values[f.key] = el.value === '' ? '' : Number(el.value);
    else values[f.key] = el.value;
    if (f.type === 'range') { const o = el.parentElement.querySelector('output'); if (o) o.textContent = `${el.value}${f.unit || ''}`; }
  };

  const boxOf = (key) => [...host.querySelectorAll('[data-field]')].find((el) => el.dataset.field === key);
  const controlOf = (key) => [...host.querySelectorAll('[data-key]')].find((el) => el.dataset.key === key);
  const refresh = () => {
    for (const f of fields) {
      const box = boxOf(f.key);
      if (box) box.hidden = f.show ? !f.show(values) : false;
    }
  };

  const onInput = (e) => {
    const el = e.target.closest('[data-key]');
    if (!el || el.classList.contains('pw-seg')) return;
    read(el); refresh(); onChange(el.dataset.key, values);
  };
  const onClick = (e) => {
    const b = e.target.closest('.pw-seg[data-key] > button');
    if (!b) return;
    const group = b.parentElement;
    for (const x of group.children) x.setAttribute('aria-checked', String(x === b));
    values[group.dataset.key] = b.dataset.v;
    refresh(); onChange(group.dataset.key, values);
  };
  host.addEventListener('input', onInput);
  host.addEventListener('change', onInput);
  host.addEventListener('click', onClick);
  refresh();

  return {
    values,
    set(key, v) {
      values[key] = v;
      const el = controlOf(key);
      if (!el) return;
      if (el.classList.contains('pw-seg')) for (const x of el.children) x.setAttribute('aria-checked', String(x.dataset.v === String(v)));
      else if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
      refresh();
    },
    refresh,
    destroy() {
      host.removeEventListener('input', onInput);
      host.removeEventListener('change', onInput);
      host.removeEventListener('click', onClick);
    },
  };
}

/** A segmented control for choosing a mode, wired to a callback. */
export function modeSwitch(host, modes, value, onPick) {
  if (modes.length < 2) { host.hidden = true; return { set() {} }; }
  host.innerHTML = `<div class="pw-seg kit-modes" role="radiogroup" aria-label="Mode">${modes.map((m) =>
    `<button type="button" role="radio" data-v="${esc(m.id)}" aria-checked="${m.id === value}">${esc(m.label)}</button>`).join('')}</div>`;
  const seg = host.firstElementChild;
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of seg.children) x.setAttribute('aria-checked', String(x === b));
    onPick(b.dataset.v);
  });
  return { set(v) { for (const x of seg.children) x.setAttribute('aria-checked', String(x.dataset.v === v)); } };
}

/** Save a Blob under a filename. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function humanBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`;
}

/** Default values for a field list, overridden by whatever is given. */
export function defaults(fields, given = {}) {
  const v = {};
  for (const f of fields) v[f.key] = given[f.key] !== undefined ? given[f.key] : resolveDefault(f);
  return v;
}

/** A compact description of fields, for the Assistant. */
export function describeFields(fields) {
  return fields.map((f) => ({
    key: f.key, label: f.label || f.key, type: f.type || 'text', default: resolveDefault(f),
    ...(f.options ? { options: f.options.map(([k]) => k) } : {}),
    ...(f.hint ? { hint: f.hint } : {}),
  }));
}
