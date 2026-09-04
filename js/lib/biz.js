/* ============================================================
   Shared kit for the Business & Finance tools.

   Sixteen tools all need the same handful of things: a currency
   picker, money and percentage formatting, a numeric field, a stat
   row, a results table, and CSV export. Keeping them here means the
   tools stay short and stay consistent with each other.
   ============================================================ */

export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'NGN', label: 'Nigerian Naira (₦)' },
  { code: 'CAD', label: 'Canadian Dollar ($)' },
  { code: 'AUD', label: 'Australian Dollar ($)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'KES', label: 'Kenyan Shilling (KSh)' },
  { code: 'GHS', label: 'Ghanaian Cedi (₵)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
];

const DEFAULT_CURRENCY = 'USD';

/* ---------------- formatting ---------------- */

export function money(value, code = DEFAULT_CURRENCY, { compact = false, dp, locale = 'en-US' } = {}) {
  if (!Number.isFinite(value)) return '—';
  const curr = (code && typeof code === 'string' && code.trim()) ? code.trim().toUpperCase() : DEFAULT_CURRENCY;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: curr,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: dp ?? (compact ? 1 : (Math.abs(value) >= 1000 ? 0 : 2)),
    minimumFractionDigits: dp ?? 0,
  }).format(value);
}

export function num(value, dp = 0) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(value);
}

export function pct(value, dp = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(dp)}%`;
}

/* Reads a numeric input, tolerating commas, spaces and currency symbols
   pasted in from a spreadsheet. */
export function parseNum(el, fallback = 0) {
  const raw = typeof el === 'string' ? el : el?.value ?? '';
  const cleaned = String(raw).replace(/[^0-9.\-eE]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function months(n) {
  if (n === Infinity) return 'indefinite';
  if (!Number.isFinite(n)) return '—';
  const y = Math.floor(n / 12);
  const m = Math.round(n % 12);
  if (y && m) return `${y}y ${m}m`;
  if (y) return `${y} year${y === 1 ? '' : 's'}`;
  return `${m} month${m === 1 ? '' : 's'}`;
}

/* ---------------- markup helpers ---------------- */

export function currencySelect(id, selected = DEFAULT_CURRENCY) {
  return `<select class="tool-select biz-currency" id="${id}">
    ${CURRENCIES.map(c => `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${c.code} — ${c.label}</option>`).join('')}
  </select>`;
}

export function field(label, id, value, opts = {}) {
  const { type = 'number', step = 'any', min, max, suffix, hint, placeholder } = opts;
  return `
    <div class="biz-field">
      <label class="tool-label" for="${id}">${label}</label>
      <div class="biz-input-wrap${suffix ? ' has-suffix' : ''}">
        <input type="${type}" class="tool-input" id="${id}" value="${value ?? ''}"
               step="${step}"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}
               ${placeholder ? `placeholder="${placeholder}"` : ''} autocomplete="off">
        ${suffix ? `<span class="biz-suffix">${suffix}</span>` : ''}
      </div>
      ${hint ? `<p class="biz-hint">${hint}</p>` : ''}
    </div>`;
}

export function selectField(label, id, options, selected) {
  return `
    <div class="biz-field">
      <label class="tool-label" for="${id}">${label}</label>
      <select class="tool-select" id="${id}">
        ${options.map(o => {
          const val = o.value ?? o;
          const text = o.label ?? o;
          return `<option value="${val}"${String(val) === String(selected) ? ' selected' : ''}>${text}</option>`;
        }).join('')}
      </select>
    </div>`;
}

/* A row of headline numbers. `tone` accents a figure: 'good' | 'bad' | 'hero'. */
export function statGrid(stats) {
  return `<div class="biz-stats">${stats.map(s => `
    <div class="biz-stat${s.tone ? ` is-${s.tone}` : ''}">
      <span class="biz-stat-value">${s.value}</span>
      <span class="biz-stat-label">${s.label}</span>
      ${s.sub ? `<span class="biz-stat-sub">${s.sub}</span>` : ''}
    </div>`).join('')}</div>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* `columns` entries may be a string, or { label, align, width }. */
export function dataTable(columns, rows, { caption, maxHeight } = {}) {
  const cols = columns.map(c => (typeof c === 'string' ? { label: c } : c));
  return `
    <div class="biz-table-wrap"${maxHeight ? ` style="max-height:${maxHeight};overflow-y:auto"` : ''}>
      <table class="biz-table">
        ${caption ? `<caption>${caption}</caption>` : ''}
        <thead><tr>${cols.map(c => `<th${c.align ? ` class="ta-${c.align}"` : ''}>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr${r.emphasis ? ' class="is-emphasis"' : ''}>${
          (r.cells ?? r).map((cell, i) =>
            `<td${cols[i]?.align ? ` class="ta-${cols[i].align}"` : ''}>${cell}</td>`).join('')
        }</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

/* ---------------- CSV ---------------- */

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = String(v ?? '').replace(/<[^>]*>/g, '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(typeof c === 'string' ? c : c.label)).join(',');
  const body = rows.map(r => (r.cells ?? r).map(esc).join(',')).join('\n');
  return `${head}\n${body}`;
}

export function downloadCSV(filename, columns, rows) {
  const blob = new Blob([toCSV(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- wiring ---------------- */

/* Recompute whenever any input inside `root` changes. Returns the
   handler so a tool can call it once to paint the initial state. */
export function liveCompute(root, compute) {
  const run = () => compute();
  root.addEventListener('input', run);
  root.addEventListener('change', run);
  run();
  return run;
}
