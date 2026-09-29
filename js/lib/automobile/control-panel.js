/* ============================================================
   Vehicle control panel — draws one cluster of controls
   (door switches, stalks, warning lamps, …) as an SVG panel of
   real-looking switches with their symbols, and explains whichever
   one is tapped. Shared by the Vehicle Guide and the Assistant.
   Styles: css/vehicle-controls.css
   ============================================================ */

import { symbolAt } from './vehicle-symbols.js';

const SIZE = {
  button: [64, 48], round: [52, 52], rocker: [50, 82], knob: [68, 68], dial: [92, 92], lamp: [52, 44],
  pad: [80, 80], lever: [360, 88], handle: [60, 96], port: [58, 36], screen: [176, 100], tile: [104, 58],
};
const GAP = 14, PAD = 18, CAP = 30;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Symbol marks on dials, drawn as line icons rather than text glyphs (❄ and ☀ turn into colour
   emoji on some systems). Cold is blue and hot red, as printed on the real climate knobs. */
const MARK_ICONS = {
  '❄': ['vc-mark-cold', '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>'],
  '☀': ['vc-mark-hot', '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'],
};
const markAt = (m, x, y) => {
  const icon = MARK_ICONS[m];
  if (!icon) return `<text class="vc-mark" x="${x}" y="${y}" text-anchor="middle">${esc(m)}</text>`;
  return `<g class="vc-mark-icon ${icon[0]}" transform="translate(${x - 5.5} ${y - 9.5}) scale(0.46)">${icon[1]}</g>`;
};

/** Break a caption into at most two lines of about `n` characters. */
function lines(text, n) {
  const w = String(text).split(/\s+/);
  const out = [''];
  for (const word of w) {
    if ((out[out.length - 1] + ' ' + word).trim().length > n && out[out.length - 1] && out.length < 2) out.push(word);
    else out[out.length - 1] = (out[out.length - 1] + ' ' + word).trim();
  }
  return out;
}

function drawControl(ctl, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  const sym = (id, px, py, s) => symbolAt(id, px, py, s);
  switch (ctl.kind) {
    case 'round':
      return `<circle class="vc-key" cx="${cx}" cy="${cy}" r="${w / 2 - 1}"/>${sym(ctl.sym, cx, cy, 24)}`;
    case 'rocker':
      return `<rect class="vc-key" x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/><path class="vc-line" d="M${x + 8} ${cy}H${x + w - 8}"/>${sym(ctl.sym, cx, y + h * 0.27, 22)}${sym(ctl.sym2 || ctl.sym, cx, y + h * 0.73, 22)}`;
    case 'knob': {
      const marks = (ctl.marks || []).map((m, i, a) => {
        const ang = Math.PI * (1.15 + (a.length > 1 ? i / (a.length - 1) : 0.5) * 0.7);
        return markAt(m, cx + Math.cos(ang) * (w / 2 + 2), cy + Math.sin(ang) * (w / 2 + 2) + 3);
      }).join('');
      return `<circle class="vc-bezel" cx="${cx}" cy="${cy + 4}" r="${w / 2 - 6}"/><circle class="vc-key" cx="${cx}" cy="${cy + 4}" r="${w / 2 - 14}"/>${sym(ctl.sym, cx, cy + 4, 20)}${marks}`;
    }
    case 'dial': {
      const r = w / 2 - 2;
      const marks = (ctl.marks || []).map((m, i, a) => {
        const ang = Math.PI * (0.75 + (a.length > 1 ? i / (a.length - 1) : 0.5) * 1.5);
        const lx = cx + Math.cos(ang) * (r - 9), ly = cy + Math.sin(ang) * (r - 9) + 3;
        return m ? markAt(m, lx, ly) : `<circle class="vc-tick" cx="${lx}" cy="${ly - 3}" r="1.5"/>`;
      }).join('');
      return `<circle class="vc-bezel" cx="${cx}" cy="${cy}" r="${r}"/><circle class="vc-key" cx="${cx}" cy="${cy}" r="${r - 20}"/><path class="vc-pointer" d="M${cx} ${cy - (r - 22)}v8"/>${sym(ctl.sym, cx, cy + 2, 20)}${marks}`;
    }
    case 'lamp':
      return `<rect class="vc-lampbox" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><g class="vc-lamp vc-lamp-${ctl.color || 'amber'}">${sym(ctl.sym, cx, cy, 26)}</g>`;
    case 'lever': {
      const marks = (ctl.marks || []);
      const chips = marks.map((m, i) => {
        const mx = x + w * 0.42 + i * (w * 0.5 / Math.max(1, marks.length - 1));
        return /^[a-z-]+$/.test(m) && m.length > 3
          ? `<g class="vc-chip"><rect x="${mx - 17}" y="${cy - 30}" width="34" height="22" rx="6"/>${sym(m, mx, cy - 19, 17)}</g>`
          : `<g class="vc-chip"><rect x="${mx - 20}" y="${cy - 30}" width="40" height="22" rx="6"/><text class="vc-mark vc-mark-in" x="${mx}" y="${cy - 15}" text-anchor="middle">${esc(m)}</text></g>`;
      }).join('');
      return `<rect class="vc-key" x="${x + 6}" y="${cy - 2}" width="${w - 12}" height="24" rx="12"/><rect class="vc-bezel" x="${x + w * 0.36}" y="${cy}" width="${w * 0.58}" height="20" rx="10"/><circle class="vc-key" cx="${x + w - 14}" cy="${cy + 10}" r="14"/>${sym(ctl.sym, x + 28, cy + 10, 18)}${chips}`;
    }
    case 'handle': {
      const marks = (ctl.marks || []).join(' · ');
      return `<rect class="vc-bezel" x="${cx - 18}" y="${y + 18}" width="36" height="${h - 18}" rx="12"/><rect class="vc-key" x="${cx - 12}" y="${y + 24}" width="24" height="${h - 30}" rx="9"/><circle class="vc-key" cx="${cx}" cy="${y + 16}" r="15"/>${sym(ctl.sym, cx, y + 16, 20)}${marks ? `<text class="vc-mark" x="${cx}" y="${y + h - 10}" text-anchor="middle">${esc(marks)}</text>` : ''}`;
    }
    case 'pad': {
      // Four-way switch with a centre button (cursor switch).
      const r = w / 2 - 1, ch = (dx, dy) => `<path class="vc-chev" d="M${cx + dx * r * 0.72 - dy * 5} ${cy + dy * r * 0.72 - dx * 5}L${cx + dx * r * 0.84} ${cy + dy * r * 0.84}L${cx + dx * r * 0.72 + dy * 5} ${cy + dy * r * 0.72 + dx * 5}"/>`;
      return `<circle class="vc-key" cx="${cx}" cy="${cy}" r="${r}"/><circle class="vc-bezel" cx="${cx}" cy="${cy}" r="${r * 0.42}"/>${ch(0, -1)}${ch(0, 1)}${ch(-1, 0)}${ch(1, 0)}${sym(ctl.sym, cx, cy, 16)}`;
    }
    case 'port':
      return `<rect class="vc-key" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>${sym(ctl.sym, cx, cy, 20)}`;
    case 'screen':
      return `<rect class="vc-screen" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>${sym(ctl.sym, cx, cy - 8, 26)}<text class="vc-mark vc-mark-screen" x="${cx}" y="${cy + 24}" text-anchor="middle">${esc(ctl.screenText ?? 'Touchscreen')}</text>`;
    case 'tile':
      return `<rect class="vc-tile" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>${sym(ctl.sym, cx, cy, 26)}`;
    default:
      return `<rect class="vc-key" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>${sym(ctl.sym, cx, cy, 24)}`;
  }
}

/** The cluster as an SVG string, controls marked with data-ctl for interaction. */
export function clusterSvg(cluster, { selected = null, hinted = [] } = {}) {
  const rows = cluster.rows.map(row => {
    const cells = row.map(ctl => {
      const [w, h] = SIZE[ctl.kind] || SIZE.button;
      const cw = Math.max(w, ctl.kind === 'lever' ? w : 84);
      return { ctl, w, h, cw };
    });
    const width = cells.reduce((s, c) => s + c.cw, 0) + GAP * (cells.length - 1);
    const height = Math.max(...cells.map(c => c.h)) + CAP;
    return { cells, width, height };
  });
  const W = Math.max(...rows.map(r => r.width)) + PAD * 2;
  const H = rows.reduce((s, r) => s + r.height, 0) + GAP * (rows.length - 1) + PAD * 2;
  let y = PAD;
  let body = '';
  for (const row of rows) {
    let x = (W - row.width) / 2;
    for (const cell of row.cells) {
      const { ctl, w, h, cw } = cell;
      const bx = x + (cw - w) / 2, by = y + (row.height - CAP - h) / 2;
      const cap = lines(ctl.label, Math.max(12, Math.floor(cw / 6.2)));
      const cls = `vc-ctl${selected === ctl.id ? ' is-selected' : ''}${hinted.includes(ctl.id) ? ' is-hinted' : ''}`;
      body += `<g class="${cls}" data-ctl="${esc(ctl.id)}" tabindex="0" role="button" aria-label="${esc(ctl.label)}" aria-pressed="${selected === ctl.id}">
        <rect class="vc-hit" x="${x - 4}" y="${y - 4}" width="${cw + 8}" height="${row.height + 4}" rx="12"/>
        ${drawControl(ctl, bx, by, w, h)}
        ${cap.map((t, i) => `<text class="vc-cap" x="${x + cw / 2}" y="${y + row.height - CAP + 14 + i * 12}" text-anchor="middle">${esc(t)}</text>`).join('')}
      </g>`;
      x += cw + GAP;
    }
    y += row.height + GAP;
  }
  return `<svg class="vc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="group" aria-label="${esc(cluster.name)}"><rect class="vc-panel" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18"/>${body}</svg>`;
}

function detailHtml(cluster, ctl) {
  if (!ctl) {
    return `<p class="vc-hint">Tap any ${cluster.zone === 'interior' ? 'switch or light' : 'part'} to see what it does.</p>${cluster.note ? `<p class="vc-note">${esc(cluster.note)}</p>` : ''}`;
  }
  return `<h5 class="vc-d-title">${esc(ctl.label)}</h5>
    <p class="vc-d-what">${esc(ctl.what)}</p>
    ${ctl.how ? `<p class="vc-d-how"><strong>How to use it.</strong> ${esc(ctl.how)}</p>` : ''}
    ${ctl.note ? `<p class="vc-d-note">${esc(ctl.note)}</p>` : ''}
    ${ctl.trim ? `<p class="vc-d-trim">${esc(ctl.trim)}</p>` : ''}`;
}

/**
 * Renders a cluster into `el` with its explanation pane. Returns { select(id), destroy() }.
 * opts: { selected, hinted: [ids], onSelect(ctl) }
 */
export function mountControlPanel(el, cluster, opts = {}) {
  let selected = opts.selected || null;
  const hinted = opts.hinted || [];
  const byId = Object.fromEntries(cluster.rows.flat().map(x => [x.id, x]));
  el.classList.add('vc');
  const paint = () => {
    el.innerHTML = `
      <div class="vc-stage">${clusterSvg(cluster, { selected, hinted })}</div>
      <div class="vc-detail" aria-live="polite">${detailHtml(cluster, byId[selected])}</div>`;
  };
  const choose = (id) => {
    selected = selected === id ? null : id;
    paint();
    const g = el.querySelector(`[data-ctl="${CSS.escape(id)}"]`);
    if (g && selected) g.focus({ preventScroll: true });
    opts.onSelect?.(byId[selected] || null);
  };
  const onClick = (e) => { const g = e.target.closest('[data-ctl]'); if (g) choose(g.dataset.ctl); };
  const onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-ctl]')) { e.preventDefault(); choose(e.target.closest('[data-ctl]').dataset.ctl); }
  };
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  paint();
  return {
    select(id) { selected = id; paint(); },
    destroy() { el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKey); el.innerHTML = ''; },
  };
}
