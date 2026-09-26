/* ============================================================
   TOOLBOX — Invoicing UI kit
   Small pieces shared by the Invoice Generator and the Timesheet:
   icons, status pills, a modal, money inputs and printing.
   ============================================================ */

import { STATUS_LABEL, formatMoney, toMinor } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  quote: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.2-1.8-1-1 .8a4 4 0 0 1-2.5-2.5l.8-1-1-1.8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  invoice: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
};
export const icon = (name, size = 16, sw = 1.9) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const pill = (status) => `<span class="iv-pill" data-s="${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>`;

/** Money formatter bound to the user's number-format preference. */
export const moneyFmt = (format = 'standard') => (minor, currency) => formatMoney(minor, currency, { format });

/** Show a money amount in an input: 1500000 -> "15,000" (no .00 when whole). */
export function minorToInput(minor) {
  const v = (Number(minor) || 0) / 100;
  return v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}
export const inputToMinor = (value) => toMinor(value);

/* ---------------- modal ---------------- */

let openModalEl = null;
export function openModal({ title, body = '', actions = '', wide = false, onOpen } = {}) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'iv-modal-back';
  back.innerHTML = `
    <div class="iv-modal${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="iv-modal-head"><h3>${esc(title)}</h3><button type="button" class="iv-icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></header>
      <div class="iv-modal-body">${body}</div>
      ${actions ? `<footer class="iv-modal-foot">${actions}</footer>` : ''}
    </div>`;
  const prevFocus = document.activeElement;
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (openModalEl === back) openModalEl = null;
    try { prevFocus?.focus?.(); } catch { /* element gone */ }
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  openModalEl = back;
  back.close = close;
  onOpen?.(back.querySelector('.iv-modal'), close);
  setTimeout(() => back.querySelector('input:not([type=hidden]):not([type=file]), select, textarea')?.focus(), 30);
  return { el: back.querySelector('.iv-modal'), close };
}
export function closeModal() { openModalEl?.close?.(); }

/* ---------------- print ---------------- */

/** Print one element on its own A4 page(s), without the app around it. */
export function printElement(el, { title = '' } = {}) {
  const host = document.createElement('div');
  host.id = 'iv-print-host';
  const clone = el.cloneNode(true);
  clone.style.transform = 'none';
  host.appendChild(clone);
  const style = document.createElement('style');
  style.id = 'iv-print-style';
  style.textContent = '@page { size: A4; margin: 0; }';
  document.head.appendChild(style);
  document.body.appendChild(host);
  document.body.classList.add('iv-printing');
  const prevTitle = document.title;
  if (title) document.title = title;          // becomes the suggested PDF file name
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    host.remove(); style.remove();
    document.body.classList.remove('iv-printing');
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => { window.print(); setTimeout(cleanup, 500); }, 60);
}

/* ---------------- files ---------------- */

export function downloadText(text, name, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Read an image file and scale it down to a compact PNG data URL. */
export function imageToDataURL(file, maxW = 480, maxH = 240) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Choose an image file (PNG, JPG or SVG).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const k = Math.min(1, maxW / img.width, maxH / img.height);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
