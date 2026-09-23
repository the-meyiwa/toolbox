/* ============================================================
   TOOLBOX — Assistant cards for the capability pack

   Registers renderers for the result types produced by
   js/lib/assistant/extra-tools.js (and the Notes tools):
     task-plan · chess-board · device-list · device-compare ·
     vehicle · svg-illustration · note · container-design
   Each renderer receives the plain result object and returns
   the card element it appended. Cards size themselves with
   container queries, so they fit the chat column at any width.
   ============================================================ */

import { registerResultRenderer } from '../assistant-result-renderer.js';
import { pieceSvg } from '../chess/pieces.js';
import { sanitizeSvg } from './extra-tools.js';
import { renderContainerDesign } from './container-design-card.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const I = {
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5"/><path d="m3.5 12 1.5 1.5L7.5 11"/><circle cx="5" cy="18" r="1.4"/>',
  chess: '<path d="M8 21h8M9 17h6l1 4H8z"/><path d="M9.5 17c0-3 -1.5-4.5-1.5-7.5A4 4 0 0 1 12 5.5c2.5 0 4 1.8 4 4.2 0 1.4-.6 2.3-1.8 2.8L15 17"/><path d="M12 5.5V3"/>',
  device: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  compare: '<rect x="3" y="4" width="7.5" height="16" rx="2"/><rect x="13.5" y="4" width="7.5" height="16" rx="2"/>',
  car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3 12h18v4.5H3z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/>',
};
const svg = (paths, size = 16, sw = 1.8) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

function card(type, { icon, title, sub = '', actions = '' }) {
  const el = document.createElement('section');
  el.className = `astc astc-${type}`;
  el.innerHTML = `
    <header class="astc-head">
      <span class="astc-icon">${svg(icon, 16)}</span>
      <div class="astc-titles"><h4 class="astc-title">${esc(title)}</h4>${sub ? `<p class="astc-sub">${sub}</p>` : ''}</div>
      ${actions ? `<div class="astc-actions">${actions}</div>` : ''}
    </header>
    <div class="astc-body"></div>`;
  return el;
}
const btn = (label, icon, attrs = '') => `<button type="button" class="astc-btn" ${attrs}>${icon ? svg(icon, 14) : ''}<span>${esc(label)}</span></button>`;

function flash(button, text) {
  const span = button.querySelector('span');
  const prev = span?.textContent;
  if (span) span.textContent = text;
  button.classList.add('is-done');
  setTimeout(() => { if (span) span.textContent = prev; button.classList.remove('is-done'); }, 1400);
}

function copy(text, button) {
  navigator.clipboard?.writeText(text).then(() => button && flash(button, 'Copied')).catch(() => {});
}

/* ============================================================
   Plan
   ============================================================ */

const STEP_ICON = {
  done: svg(I.check, 12, 2.4),
  failed: svg(I.x, 12, 2.4),
  skipped: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M7 12h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  active: '',
  pending: '',
};

function renderPlan(data, container) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const done = steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const el = card('plan', {
    icon: I.plan,
    title: data.title || 'Plan',
    sub: `<span class="u-num">${done} of ${steps.length}</span> steps done`,
  });
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <ol class="astc-steps">
      ${steps.map((s, i) => {
        const status = ['pending', 'active', 'done', 'failed', 'skipped'].includes(s.status) ? s.status : 'pending';
        return `<li class="astc-step" data-status="${status}" style="--i:${i}"><span class="astc-step-dot">${STEP_ICON[status]}</span><span class="astc-step-title">${esc(s.title)}</span></li>`;
      }).join('')}
    </ol>`;
  container.appendChild(el);
  return el;
}

/* ============================================================
   Chess
   ============================================================ */

function parseFenBoard(fen) {
  const rows = String(fen || '').split(' ')[0].split('/');
  const board = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (const ch of rows[r] || '8') {
      if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k++) row.push(null);
      else row.push({ color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase() });
    }
    while (row.length < 8) row.push(null);
    board.push(row.slice(0, 8));
  }
  return board;   // board[0] = rank 8
}

const sqIndex = (sq) => ({ f: 'abcdefgh'.indexOf(sq[0]), r: 8 - Number(sq[1]) });   // r = row from top

function winChance(cp, mate) {
  if (mate) return mate > 0 ? 1 : 0;
  return 1 / (1 + Math.pow(10, -(Number(cp) || 0) / 400));
}

function evalLabel(cp, mate) {
  if (mate) return `${mate > 0 ? '' : '−'}M${Math.abs(mate)}`;
  const v = (Number(cp) || 0) / 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
}

const VERDICT = {
  'best move': { label: 'Best move', tone: 'good' },
  'only move': { label: 'Only move', tone: 'good' },
  excellent: { label: 'Excellent', tone: 'good' },
  good: { label: 'Good', tone: 'good' },
  inaccuracy: { label: 'Inaccuracy', tone: 'warn', mark: '?!' },
  mistake: { label: 'Mistake', tone: 'warn', mark: '?' },
  blunder: { label: 'Blunder', tone: 'bad', mark: '??' },
};

function boardSvgOverlay(arrows = []) {
  if (!arrows.length) return '';
  const parts = arrows.map((a) => {
    if (!a?.from || !a?.to) return '';
    const f = sqIndex(a.from), t = sqIndex(a.to);
    const x1 = f.f + 0.5, y1 = f.r + 0.5, x2 = t.f + 0.5, y2 = t.r + 0.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const hx = x2 - ux * 0.34, hy = y2 - uy * 0.34;
    const px = -uy * 0.22, py = ux * 0.22;
    return `<line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" class="astc-arrow"/><polygon points="${x2 - ux * 0.02},${y2 - uy * 0.02} ${hx + px},${hy + py} ${hx - px},${hy - py}" class="astc-arrow-head"/>`;
  }).join('');
  return `<svg class="astc-arrows" viewBox="0 0 8 8" aria-hidden="true">${parts}</svg>`;
}

function renderChess(data, container) {
  const board = parseFenBoard(data.fen);
  const turn = data.turn === 'black' ? 'Black' : 'White';
  const hasEval = data.evaluation != null || data.mate;
  const wc = winChance(data.evaluation, data.mate);
  const opening = data.opening?.name ? `${data.opening.eco ? `${esc(data.opening.eco)} · ` : ''}${esc(data.opening.name)}` : '';
  const last = data.lastMove || null;
  const arrows = (data.arrows || []).filter(a => a?.from && a?.to);
  let kingInCheck = null;
  if (data.check) {
    const c = data.turn === 'black' ? 'b' : 'w';
    board.forEach((row, r) => row.forEach((p, f) => { if (p && p.type === 'k' && p.color === c) kingInCheck = { r, f }; }));
  }
  const lastSq = last ? [sqIndex(last.from), sqIndex(last.to)] : [];
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const light = (r + f) % 2 === 0;
      const p = board[r][f];
      const cls = ['astc-sq', light ? 'l' : 'd'];
      if (lastSq.some(s => s.r === r && s.f === f)) cls.push('last');
      if (kingInCheck && kingInCheck.r === r && kingInCheck.f === f) cls.push('check');
      const coordR = f === 0 ? `<i class="astc-co r">${8 - r}</i>` : '';
      const coordF = r === 7 ? `<i class="astc-co f">${'abcdefgh'[f]}</i>` : '';
      squares.push(`<div class="${cls.join(' ')}">${coordR}${coordF}${p ? `<span class="astc-pc">${pieceSvg(p.color, p.type)}</span>` : ''}</div>`);
    }
  }

  const status = data.gameOver
    ? esc(data.summary || 'Game over')
    : `${turn} to move${data.check ? ' · check' : ''}`;
  const pv = (data.principalVariation || []).slice(0, 8);
  const j = data.judgement;
  const v = j ? (VERDICT[j.verdict] || { label: j.verdict, tone: 'warn' }) : null;
  const moves = data.moves || [];
  const moveList = moves.length
    ? moves.map((m, i) => `${i % 2 === 0 ? `<span class="astc-mn">${Math.floor(i / 2) + 1}.</span>` : ''}<span class="astc-mv">${esc(m)}</span>`).join(' ')
    : '';

  const el = card('chess', {
    icon: I.chess,
    title: data.gameOver ? 'Game over' : 'Position analysis',
    sub: opening || esc(status),
    actions: btn('Open in Chess', I.external, 'data-act="open-chess"'),
  });
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-chess-grid">
      <div class="astc-board-wrap">
        ${hasEval ? `<div class="astc-evalbar" aria-label="Evaluation ${evalLabel(data.evaluation, data.mate)}"><i style="height:${(wc * 100).toFixed(1)}%"></i></div>` : ''}
        <div class="astc-board" role="img" aria-label="Chess board, ${esc(status)}">
          <div class="astc-squares">${squares.join('')}</div>
          ${boardSvgOverlay(arrows)}
        </div>
      </div>
      <div class="astc-chess-info">
        ${hasEval ? `
          <div class="astc-evalrow">
            <div class="astc-eval u-num">${evalLabel(data.evaluation, data.mate)}</div>
            <div class="astc-evalmeta"><span>${esc(status)}</span>${data.depth ? `<span>Depth ${esc(data.depth)}</span>` : ''}</div>
          </div>` : `<div class="astc-evalrow"><div class="astc-evalmeta"><span>${esc(data.summary || status)}</span></div></div>`}
        ${data.bestMove ? `
          <div class="astc-kv"><span>Best move</span><strong class="astc-move">${esc(data.bestMove)}</strong></div>
          ${pv.length > 1 ? `<div class="astc-line">${pv.map((m, i) => `<span class="${i === 0 ? 'is-first' : ''}">${esc(m)}</span>`).join('')}</div>` : ''}` : ''}
        ${opening ? `<div class="astc-kv"><span>Opening</span><strong>${opening}</strong></div>` : ''}
        ${j ? `
          <div class="astc-judge" data-tone="${v.tone}">
            <div class="astc-judge-head"><strong>${esc(j.move)}${v.mark ? `<sup>${v.mark}</sup>` : ''}</strong><span class="astc-badge">${esc(v.label)}</span></div>
            <p>${j.bestMove && j.verdict !== 'best move' ? `Best was <strong>${esc(j.bestMove)}</strong>. ` : ''}${j.winChanceLost ? `Win chance lost: ${esc(j.winChanceLost)}%.` : ''}</p>
            ${j.refutation?.length ? `<div class="astc-line">${j.refutation.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
          </div>` : ''}
        ${moveList ? `<details class="astc-moves"><summary>Moves <span class="u-num">(${moves.length})</span></summary><div>${moveList}</div></details>` : ''}
        <div class="astc-fen"><code title="${esc(data.fen)}">${esc(data.fen)}</code>${btn('Copy FEN', I.copy, 'data-act="copy-fen"')}</div>
      </div>
    </div>`;

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy-fen') copy(data.fen, b);
    if (b.dataset.act === 'open-chess') {
      try {
        const { Position, START_FEN } = await import('../chess/engine.js');
        const startFen = data.startFen || START_FEN;
        const p = new Position(startFen);
        const list = [];
        for (const san of data.moves || []) {
          const m = p.fromSan(san);
          if (!m) break;
          list.push({ uci: p.toUci(m), san: p.toSan(m) });
          p.make(m);
        }
        const useFen = list.length !== (data.moves || []).length;
        const game = {
          id: Date.now(), mode: 'analysis', human: 'w', startFen: useFen ? data.fen : startFen,
          moves: useFen ? [] : list, cursor: useFen ? 0 : list.length, result: null, flipped: false, clock: null,
        };
        localStorage.setItem('toolbox_chess_game_v1', JSON.stringify(game));
      } catch { /* the board still opens */ }
      window.location.hash = '#chess';
    }
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Devices
   ============================================================ */

const CAT_LABEL = { phones: 'phones', tablets: 'tablets', laptops: 'laptops', socs: 'mobile chips', cpus: 'processors', gpus: 'graphics cards', watches: 'smartwatches', audio: 'headphones', consoles: 'consoles', tvs: 'TVs', monitors: 'monitors' };
const money = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? `$${v.toLocaleString()}` : esc(v));
const year = (v) => (v ? esc(String(v).slice(0, 10)) : '');

function scoreBar(score, win = false) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  return `<span class="astc-score ${win ? 'is-win' : ''}"><b class="u-num">${score == null ? '—' : Math.round(score)}</b><i><em style="width:${s}%"></em></i></span>`;
}

function openDevices() { window.location.hash = '#tech-device-comparisons'; }

function renderDeviceList(data, container) {
  const devices = data.devices || [];
  const title = data.rankBy
    ? `Top ${devices.length} ${CAT_LABEL[data.category] || data.category || 'devices'}`
    : devices.length === 1 ? devices[0].name : `${devices.length} devices`;
  const el = card('devices', {
    icon: I.device,
    title,
    sub: data.rankBy ? `Ranked by ${esc(data.rankBy)}` : 'From the Toolbox device database',
    actions: btn('Compare', I.external, 'data-act="open"'),
  });
  el.querySelector('.astc-body').innerHTML = `
    <ol class="astc-devlist">
      ${devices.map((d, i) => {
        const specs = Object.entries(d.specs || {}).slice(0, 12);
        const meta = [d.brand, year(d.released), money(d.price)].filter(Boolean).join(' · ');
        return `<li class="astc-dev">
          <details ${devices.length === 1 ? 'open' : ''}>
            <summary>
              <span class="astc-rank u-num">${d.rank && !data.rankBy ? `#${esc(d.rank)}` : i + 1}</span>
              <span class="astc-dev-name"><strong>${esc(d.name)}</strong><small>${meta}</small></span>
              ${d.value != null && data.rankBy && data.rankBy !== 'score' ? `<span class="astc-dev-val u-num">${esc(d.value)}</span>` : ''}
              ${scoreBar(d.score, i === 0 && data.rankBy)}
            </summary>
            ${specs.length ? `<dl class="astc-specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
          </details>
        </li>`;
      }).join('')}
    </ol>`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) openDevices(); });
  container.appendChild(el);
  return el;
}

function renderDeviceCompare(data, container) {
  const a = data.a || {}, b = data.b || {};
  const sa = Number(a.score) || 0, sb = Number(b.score) || 0;
  const win = sa === sb ? null : sa > sb ? 'a' : 'b';
  const specs = data.specs || [];
  const aWins = specs.filter(s => s.winner === 1).length;
  const bWins = specs.filter(s => s.winner === -1).length;
  const subs = Object.entries(data.subScoreLabels || {}).filter(([k]) => a.subScores?.[k] != null || b.subScores?.[k] != null);
  const el = card('compare', {
    icon: I.compare,
    title: `${a.name || 'A'} vs ${b.name || 'B'}`,
    sub: `${esc(CAT_LABEL[data.category] || data.category || 'devices')} · Toolbox score out of 100`,
    actions: btn('Open comparison', I.external, 'data-act="open"'),
  });
  const side = (d, key, score) => `
    <div class="astc-vs-side ${win === key ? 'is-win' : ''}">
      ${win === key ? `<span class="astc-winner">${svg(I.trophy, 12)}Better tech</span>` : ''}
      <small>${esc(d.brand || '')}</small>
      <strong>${esc(d.name || '')}</strong>
      <span class="astc-vs-meta">${[year(d.released), money(d.price)].filter(Boolean).join(' · ')}</span>
      <div class="astc-vs-score u-num">${score ? Math.round(score) : '—'}</div>
    </div>`;
  const ROWS = 10;
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-vs">${side(a, 'a', sa)}<span class="astc-vs-mid">vs</span>${side(b, 'b', sb)}</div>
    ${(data.betterTech || data.betterBuy) ? `<div class="astc-verdicts">${[['Better tech', data.betterTech], ['Better buy', data.betterBuy]].filter(([, v]) => v).map(([label, v]) => `
      <div class="astc-verdict"><small>${label}</small><strong>${esc(v.headline || v.winner || '—')}</strong>${v.explanation ? `<p>${esc(v.explanation)}</p>` : ''}</div>`).join('')}
      ${data.sameWinner ? '<p class="astc-verdict-note">The same device wins on both specs and value.</p>' : ''}</div>` : ''}
    ${subs.length ? `<div class="astc-subs">${subs.map(([k, label]) => {
      const x = Number(a.subScores?.[k]) || 0, y = Number(b.subScores?.[k]) || 0;
      return `<div class="astc-sub-row"><span class="u-num ${x > y ? 'is-win' : ''}">${Math.round(x)}</span><div class="astc-sub-bars"><i class="a ${x > y ? 'is-win' : ''}" style="width:${Math.min(100, x)}%"></i><em>${esc(label)}</em><i class="b ${y > x ? 'is-win' : ''}" style="width:${Math.min(100, y)}%"></i></div><span class="u-num ${y > x ? 'is-win' : ''}">${Math.round(y)}</span></div>`;
    }).join('')}</div>` : ''}
    ${(data.whyA?.length || data.whyB?.length) ? `<div class="astc-why">
      <div><h5>Why ${esc(a.name)}</h5><ul>${(data.whyA || []).map(r => `<li>${esc(r)}</li>`).join('') || '<li class="is-empty">No clear advantages</li>'}</ul></div>
      <div><h5>Why ${esc(b.name)}</h5><ul>${(data.whyB || []).map(r => `<li>${esc(r)}</li>`).join('') || '<li class="is-empty">No clear advantages</li>'}</ul></div>
    </div>` : ''}
    ${specs.length ? `
      <div class="astc-table-wrap"><table class="astc-table astc-cmp-table">
        <thead><tr><th>Spec</th><th>${esc(a.name)} <small class="u-num">${aWins} wins</small></th><th>${esc(b.name)} <small class="u-num">${bWins} wins</small></th></tr></thead>
        <tbody>${specs.map((s, i) => `<tr class="${i >= ROWS ? 'is-more' : ''}"><th scope="row">${esc(s.label)}</th><td class="${s.winner === 1 ? 'is-win' : ''}">${esc(s.a)}</td><td class="${s.winner === -1 ? 'is-win' : ''}">${esc(s.b)}</td></tr>`).join('')}</tbody>
      </table></div>
      ${specs.length > ROWS ? `<button type="button" class="astc-more" data-act="more">Show all ${specs.length} specs</button>` : ''}` : ''}`;
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'open') openDevices();
    if (t.dataset.act === 'more') { el.classList.toggle('show-all'); t.textContent = el.classList.contains('show-all') ? 'Show fewer specs' : `Show all ${specs.length} specs`; }
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Vehicle
   ============================================================ */

function rowPair(row) {
  if (Array.isArray(row)) return [row[0], row[1]];
  if (row && typeof row === 'object') return [row.label ?? row.name ?? row.key ?? row.title, row.value ?? row.val ?? row.text ?? row.detail];
  return [String(row ?? ''), ''];
}

function humanKey(k) { return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()); }

function renderVehicle(data, container) {
  const el = card('vehicle', {
    icon: I.car,
    title: data.title || data.query || 'Vehicle',
    sub: data.vin ? `VIN <code>${esc(data.vin)}</code>` : data.package ? `3D package: ${esc(data.package.name)}` : 'Vehicle information',
    actions: data.package ? btn('Open Automobile Guide', I.external, 'data-act="guide"') : '',
  });
  const groups = [];
  if (data.decoded && Object.keys(data.decoded).length) groups.push({ group: 'Decoded from VIN', rows: Object.entries(data.decoded).filter(([k]) => k !== 'ErrorText').map(([k, v]) => [humanKey(k), v]) });
  for (const g of data.specSheet || []) groups.push({ group: g.group, rows: (g.rows || []).map(rowPair) });
  if (!groups.length && data.specifications && typeof data.specifications === 'object') {
    const flat = Object.entries(data.specifications).filter(([, v]) => v != null && typeof v !== 'object').slice(0, 20);
    if (flat.length) groups.push({ group: 'Specifications', rows: flat.map(([k, v]) => [humanKey(k), v]) });
  }
  el.querySelector('.astc-body').innerHTML = `
    ${data.image || data.summary ? `<div class="astc-veh-hero">
      ${data.image ? `<img src="${esc(data.image)}" alt="${esc(data.title || '')}" loading="lazy" referrerpolicy="no-referrer">` : ''}
      ${data.summary ? `<p>${esc(String(data.summary).slice(0, 520))}${String(data.summary).length > 520 ? '…' : ''}</p>` : ''}
    </div>` : ''}
    ${groups.length ? `<div class="astc-sheet">${groups.map(g => `
      <section><h5>${esc(g.group || 'Specifications')}</h5><dl>${g.rows.filter(([k]) => k).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v ?? '—')}</dd></div>`).join('')}</dl></section>`).join('')}
    </div>` : ''}
    ${data.models?.length ? `<div class="astc-chips">${data.models.slice(0, 18).map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
    ${!groups.length && !data.summary && !data.models?.length ? `<p class="astc-muted">${esc(data.message || 'No details found.')}</p>` : ''}`;
  el.querySelector('img')?.addEventListener('error', (e) => e.target.remove());
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="guide"]')) window.location.hash = '#automobile-guide'; });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Illustration
   ============================================================ */

function slug(s) { return String(s || 'illustration').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'illustration'; }

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function svgToPng(markup, scale = 2) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  const vb = (root.getAttribute('viewBox') || '0 0 800 600').split(/[\s,]+/).map(Number);
  const w = Number(root.getAttribute('width')) || vb[2] || 800;
  const h = Number(root.getAttribute('height')) || vb[3] || 600;
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', w); root.setAttribute('height', h);
  const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.max(1, Math.min(scale, 4096 / Math.max(w, h)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

function renderIllustration(data, container) {
  let markup = '';
  try { markup = sanitizeSvg(data.svg); } catch { markup = ''; }
  const el = card('illustration', {
    icon: I.pen,
    title: data.title || 'Illustration',
    sub: data.caption ? esc(data.caption) : 'Drawn as SVG',
    actions: markup ? `${btn('SVG', I.download, 'data-act="svg" aria-label="Download SVG"')}${btn('PNG', I.download, 'data-act="png" aria-label="Download PNG"')}` : '',
  });
  el.querySelector('.astc-body').innerHTML = markup
    ? `<figure class="astc-figure">${markup}</figure>`
    : `<p class="astc-muted">This drawing could not be displayed.</p>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const name = slug(data.title);
    if (b.dataset.act === 'svg') downloadBlob(new Blob([markup], { type: 'image/svg+xml' }), `${name}.svg`);
    if (b.dataset.act === 'png') {
      try { const png = await svgToPng(markup); if (png) downloadBlob(png, `${name}.png`); } catch { flash(b, 'Failed'); }
    }
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Note
   ============================================================ */

function renderNote(data, container) {
  const body = String(data.body || '');
  const el = card('note', {
    icon: I.note,
    title: data.title || 'Note',
    sub: `${/updated/i.test(data.message || '') ? 'Updated' : 'Saved'} in Notes${data.folder ? ` · ${esc(data.folder)}` : ''}`,
    actions: btn('Open in Notes', I.external, 'data-act="open"'),
  });
  el.querySelector('.astc-body').innerHTML = body
    ? `<div class="astc-note-body">${esc(body.slice(0, 1600))}${body.length > 1600 ? '…' : ''}</div>`
    : '<p class="astc-muted">Empty note.</p>';
  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="open"]')) return;
    // Notes opens its first note; put this one first so it opens directly.
    try {
      const KEY = 'toolbox_notes_v1';
      const notes = JSON.parse(localStorage.getItem(KEY) || '[]');
      const i = notes.findIndex(n => n.id === data.noteId);
      if (i > 0) { const [n] = notes.splice(i, 1); notes.unshift(n); localStorage.setItem(KEY, JSON.stringify(notes)); }
    } catch { /* storage unavailable */ }
    window.location.hash = '#notes';
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Registration
   ============================================================ */

registerResultRenderer('task-plan', renderPlan);
registerResultRenderer('chess-board', renderChess, { match: d => typeof d?.fen === 'string' && Array.isArray(d?.legalMoves) });
registerResultRenderer('device-list', renderDeviceList);
registerResultRenderer('device-compare', renderDeviceCompare);
registerResultRenderer('vehicle', renderVehicle);
registerResultRenderer('svg-illustration', renderIllustration);
registerResultRenderer('container-design', renderContainerDesign, { match: d => Boolean(d?.design?.modules && d?.design?.levels) });
registerResultRenderer('note', renderNote, { match: d => Boolean(d?.noteId && typeof d?.title === 'string' && d?.status !== 'error') });
