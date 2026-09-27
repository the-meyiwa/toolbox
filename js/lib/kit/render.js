/* Small HTML builders for rich text-tool results. Everything is escaped. */

import { esc } from './form.js';

export function table(head, rows, { numeric = [] } = {}) {
  const num = new Set(numeric);
  return `<div class="kit-table-wrap"><table class="kit-table"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c, i) => `<td${num.has(i) ? ' class="num"' : ''}>${c && typeof c === 'object' && 'html' in c ? c.html : esc(c)}</td>`).join('')}</tr>`).join('')
  }</tbody></table></div>`;
}

export function kv(pairs) {
  return `<dl class="kit-kv">${pairs.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) =>
    `<dt>${esc(k)}</dt><dd>${v && typeof v === 'object' && 'html' in v ? v.html : esc(v)}</dd>`).join('')}</dl>`;
}

export const heading = (t) => `<h4 class="kit-h">${esc(t)}</h4>`;
export const badge = (t, tone = '') => ({ html: `<span class="kit-badge${tone ? ` is-${tone}` : ''}">${esc(t)}</span>` });
export const code = (t) => ({ html: `<code>${esc(t)}</code>` });
export const raw = (html) => ({ html });
