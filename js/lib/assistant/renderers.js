/* ============================================================
   TOOLBOX — Assistant cards for the capability pack

   Registers renderers for the result types produced by
   js/lib/assistant/extra-tools.js (and the Notes tools):
     task-plan · chess-board · device-list · device-compare ·
     vehicle · vehicle-controls · vehicle-part · car-injury · svg-illustration · note · container-design · structure-model · lab3d-object ·
     invoice-card · invoice-list ·
     construction-estimate
   Each renderer receives the plain result object and returns
   the card element it appended. Cards size themselves with
   container queries, so they fit the chat column at any width.
   ============================================================ */

import { registerResultRenderer } from '../assistant-result-renderer.js';
import { pieceSvg } from '../chess/pieces.js';
import { sanitizeSvg } from './extra-tools.js';
import { renderContainerDesign } from './container-design-card.js';
import { renderStructureModel } from './structure-card.js';
import { renderLab3dObject } from './lab3d-card.js';
import { controlsFor } from '../automobile/vehicle-controls.js';
import { mountControlPanel } from '../automobile/control-panel.js';
import { safetyFor, INJURIES, DISCLAIMER } from '../automobile/injury-data.js';
import { safetyHtml, injuryHtml, richText, installInjuryLinks } from '../automobile/injury-render.js';
import { icon as uiIcon } from '../icons.js';
import { fileAttrs } from '../file-surface.js';

installInjuryLinks();

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
    actions: data.package ? btn('Open Vehicle Guide', I.external, 'data-act="guide"') : '',
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
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="guide"]')) openGuideOn({}, data.package?.id); });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Car injuries — signs, first aid, treatment, prevention
   ============================================================ */

export function renderCarInjury(data, container) {
  const injuries = (data.injuries || []).map(id => INJURIES[id] && { id, ...INJURIES[id] }).filter(Boolean);
  const el = card('car-injury', {
    icon: I.car,
    title: data.part ? `${data.part.label}: injuries and prevention` : 'Car-related injuries',
    sub: esc(data.query || ''),
  });
  el.querySelector('.astc-body').innerHTML = `<section class="inj">
    ${data.part ? `<p class="inj-hazard">${richText(data.part.hazard)}</p>` : ''}
    ${injuries.map((inj, i) => injuryHtml(inj, { open: i === 0 })).join('')}
    ${data.part?.prevention?.length ? `<h5 class="inj-h2">Prevention</h5><ul class="inj-prevent">${data.part.prevention.map(p => `<li>${richText(p)}</li>`).join('')}</ul>` : ''}
    <p class="inj-disclaimer">${esc(DISCLAIMER)}</p>
  </section>`;
  container.appendChild(el);
  return el;
}

/* ============================================================
   Car part — where it is, its data, "Show in 3D"
   ============================================================ */

const openGuideOn = (focus, vehicleId = 'toyota-corolla-2014-2016') => {
  try { localStorage.setItem('toolbox.automobile.focus', JSON.stringify({ vehicleId, ...focus })); } catch { /* storage unavailable: the guide still opens */ }
  window.location.hash = '#automobile-guide';
};

export function renderVehiclePart(data, container) {
  const c = data.component || {};
  const el = card('vehicle-part', {
    icon: I.car,
    title: c.label || 'Part',
    sub: `${esc(c.category || '')}${c.category ? ' · ' : ''}${esc(data.vehicle || 'Toyota Corolla 2014–2016')}`,
    actions: btn('Show in 3D', I.external, 'data-act="part3d"'),
  });
  const specs = c.specs && typeof c.specs === 'object' ? Object.entries(c.specs) : c.specs ? [['Specification', c.specs]] : [];
  const rows = [
    ['Where', c.location], ['What it does', c.description],
    ...specs.map(([k, v]) => [humanKey(k), typeof v === 'object' ? JSON.stringify(v) : v]),
    ['Maintenance', c.maintenance], ['Common failures', c.failures],
  ].filter(([, v]) => v);
  el.querySelector('.astc-body').innerHTML = `
    ${data.mismatch || (data.mismatch === undefined && data.askedAbout && !/corolla/i.test(data.askedAbout)) ? `<p class="astc-muted astc-vc-caveat">From the ${esc(data.vehicle || '2014–2016 Corolla')}. Your ${esc(data.askedAbout)} may differ.</p>` : ''}
    <div class="astc-sheet"><section><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
    ${data.specRows?.length ? `<section><h5>Spec sheet</h5><dl>${data.specRows.map(([, k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}</div>
    ${c.accuracyNote ? `<p class="astc-muted astc-vp-note">${esc(c.accuracyNote)}</p>` : ''}
    ${c.sources?.length ? `<p class="astc-muted astc-vp-note">Sources: ${c.sources.map(s => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label || s.url)}</a>` : esc(s.label)).join(' · ')}</p>` : ''}
    ${data.alternatives?.length ? `<div class="astc-vc-alts"><span>Nearby</span>${data.alternatives.map(a => `<button type="button" data-vp-part="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    ${safetyHtml(safetyFor(c.id, { kind: data.kind === 'aircraft' ? 'aircraft' : 'car' }))}`;
  el.addEventListener('click', (e) => {
    const alt = e.target.closest('[data-vp-part]');
    if (alt) { openGuideOn({ component: alt.dataset.vpPart }, data.vehicleId); return; }
    if (e.target.closest('[data-act="part3d"]')) openGuideOn({ component: c.id }, data.vehicleId);
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Car controls — "One of these?"
   ============================================================ */

export function renderVehicleControls(data, container) {
  const CAR_CLUSTER = controlsFor(data.vehicleId || 'toyota-corolla-2014-2016').byId;
  let clusterId = CAR_CLUSTER[data.cluster] ? data.cluster : null;
  const el = card('vehicle-controls', {
    icon: I.car,
    title: 'One of these?',
    sub: esc(data.vehicle || 'Toyota Corolla 2014–2016'),
    actions: btn('Open in Vehicle Guide', I.external, 'data-act="guide"'),
  });
  const body = el.querySelector('.astc-body');
  let panel = null, selected = data.control || null;
  const paint = () => {
    const cl = CAR_CLUSTER[clusterId];
    if (!cl) { body.innerHTML = `<p class="astc-muted">${esc(data.message || 'Nothing to show.')}</p>`; return; }
    const others = (data.alternatives || []).filter(a => CAR_CLUSTER[a.id] && a.id !== clusterId);
    const back = clusterId !== data.cluster && CAR_CLUSTER[data.cluster] ? [{ id: data.cluster, name: CAR_CLUSTER[data.cluster].name }] : [];
    body.innerHTML = `
      <p class="astc-vc-where"><strong>${esc(cl.name)}</strong> · ${esc(cl.where)}</p>
      ${data.mismatch || (data.mismatch === undefined && data.askedAbout && !/corolla/i.test(data.askedAbout)) ? `<p class="astc-muted astc-vc-caveat">Drawn from the ${esc(data.vehicle || '2014–2016 Corolla')}. The symbols are standard, but your ${esc(data.askedAbout)} may lay them out differently.</p>` : ''}
      <div class="astc-vc-panel"></div>
      ${[...back, ...others].length ? `<div class="astc-vc-alts"><span>Not it? Try</span>${[...back, ...others].map(a => `<button type="button" data-vc-cluster="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div>` : ''}`;
    panel?.destroy();
    panel = mountControlPanel(body.querySelector('.astc-vc-panel'), cl, {
      selected: clusterId === data.cluster ? selected : null,
      hinted: clusterId === data.cluster && data.control ? [data.control] : [],
      onSelect: (ctl) => { if (clusterId === data.cluster) selected = ctl?.id || null; },
    });
  };
  paint();
  el.addEventListener('click', (e) => {
    const alt = e.target.closest('[data-vc-cluster]');
    if (alt) { clusterId = alt.dataset.vcCluster; paint(); return; }
    if (e.target.closest('[data-act="guide"]')) {
      openGuideOn({ cluster: clusterId, control: clusterId === data.cluster ? selected : null }, data.vehicleId);
    }
  });
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
    ? `<figure class="astc-figure" ${fileAttrs({ name: `${slug(data.title)}.svg`, type: 'image/svg+xml', text: markup, from: 'assistant', fromLabel: 'Illustration by the Assistant' })}>${markup}</figure>`
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
   Invoices (create_invoice / list_invoices)
   ============================================================ */

const INVOICE_ICON = '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>';

async function openInvoice(id, view = 'doc') {
  try {
    const { getStore } = await import('../invoicing/store.js');
    const store = getStore();
    store.setPending({ open: view, id });
    if (window.location.hash === '#invoice-generator') return;
    window.location.hash = '#invoice-generator';
  } catch { window.location.hash = '#invoice-generator'; }
}

function renderInvoiceCard(data, container) {
  const inv = data.invoice || {};
  const d = inv.display || {};
  const isQuote = inv.type === 'quote';
  const el = card('invoice', {
    icon: INVOICE_ICON,
    title: `${isQuote ? 'Quote' : 'Invoice'} ${inv.number || ''}`,
    sub: `${esc(inv.client || 'No client')} &middot; ${esc(inv.statusLabel || 'Draft')}${inv.dueDate ? ` &middot; ${isQuote ? 'valid to' : 'due'} ${esc(inv.dueDateText || inv.dueDate)}` : ''}`,
    actions: btn(isQuote ? 'Open quote' : 'Open invoice', I.external, 'data-act="open"'),
  });
  const items = Array.isArray(inv.items) ? inv.items : [];
  el.querySelector('.astc-body').innerHTML = `
    <ul class="astc-inv-items">
      ${items.slice(0, 6).map(i => `<li><span>${esc(i.description)}</span><span class="u-num">${esc(i.qty)}${i.unit ? ` ${esc(i.unit)}` : ''} &times; ${esc(Number(i.rate).toLocaleString('en-US', { maximumFractionDigits: 2 }))}</span></li>`).join('')}
      ${items.length > 6 ? `<li class="astc-muted">and ${items.length - 6} more</li>` : ''}
    </ul>
    <dl class="astc-inv-tot">
      <div><dt>Subtotal</dt><dd>${esc(d.subtotal)}</dd></div>
      ${inv.vatRate ? `<div><dt>VAT ${esc(inv.vatRate)}%</dt><dd>${esc(d.vat)}</dd></div>` : ''}
      <div class="is-total"><dt>Total</dt><dd>${esc(d.total)}</dd></div>
      ${inv.wht && !isQuote ? `<div><dt>Less WHT ${esc(inv.whtRate)}%</dt><dd>(${esc(d.wht)})</dd></div><div class="is-key"><dt>Amount payable</dt><dd>${esc(d.payable)}</dd></div>` : ''}
    </dl>
    ${inv.amountInWords ? `<p class="astc-inv-words">${esc(inv.amountInWords)}</p>` : ''}`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) openInvoice(inv.id); });
  container.appendChild(el);
  return el;
}

function renderInvoiceList(data, container) {
  const rows = Array.isArray(data.invoices) ? data.invoices : [];
  const sum = data.summary || {};
  const isQuote = data.docType === 'quote';
  const el = card('invoice-list', {
    icon: INVOICE_ICON,
    title: `${isQuote ? 'Quotes' : 'Invoices'}${data.filter && data.filter !== 'all' ? `: ${data.filter}` : ''}${data.client ? ` for ${data.client}` : ''}`,
    sub: `<span class="u-num">${esc(data.count ?? rows.length)}</span> found`,
    actions: btn('Open Invoices', I.external, 'data-act="open-all"'),
  });
  el.querySelector('.astc-body').innerHTML = `
    ${isQuote ? '' : `<div class="astc-inv-stats">
      <div><span>Outstanding</span><strong>${esc(sum.outstanding)}</strong></div>
      <div${sum.overdueCount ? ' data-tone="bad"' : ''}><span>Overdue</span><strong>${esc(sum.overdue)}</strong></div>
      <div><span>Paid this month</span><strong>${esc(sum.paidThisMonth)}</strong></div>
    </div>`}
    ${rows.length ? `<ul class="astc-inv-rows">${rows.map(r => `
      <li><button type="button" data-open="${esc(r.id)}">
        <span class="astc-inv-num">${esc(r.number)}</span>
        <span class="astc-inv-client">${esc(r.client || 'No client')}</span>
        <span class="astc-inv-amt u-num">${esc(r.balance > 0 && !isQuote ? r.display?.balance : r.display?.total)}</span>
        <span class="astc-inv-st" data-s="${esc(r.status)}">${esc(r.statusLabel)}</span>
      </button></li>`).join('')}</ul>` : `<p class="astc-muted">${esc(data.message || 'Nothing to show.')}</p>`}`;
  el.addEventListener('click', (e) => {
    const row = e.target.closest('[data-open]');
    if (row) openInvoice(row.dataset.open);
    else if (e.target.closest('[data-act="open-all"]')) window.location.hash = '#invoice-generator';
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Registration
   ============================================================ */

/* ============================================================
   Construction estimate (estimate_construction)
   ============================================================ */

const CE_ICON = '<path d="M3 20h18"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>';
const ngn = (v) => (Number.isFinite(Number(v)) ? `₦${Math.round(Number(v)).toLocaleString('en-US')}` : '—');
const ngnShort = (v) => { const x = Number(v) || 0; return x >= 1e6 ? `₦${(x / 1e6).toFixed(x >= 1e8 ? 0 : 2)}m` : ngn(x); };

function renderConstructionEstimate(data, container) {
  const sections = data.sections || [];
  const shop = data.shopping || [];
  const el = card('construction', {
    icon: CE_ICON,
    title: data.project?.name || 'Construction estimate',
    sub: `${sections.length} section${sections.length === 1 ? '' : 's'} · ${esc(data.region || 'Lagos')} rates, editable estimates`,
    actions: btn('Open in Construction Estimator', I.external, 'data-act="open"'),
  });
  const max = Math.max(1, ...sections.map(s => s.subtotal || 0));
  const top = [...sections].sort((a, b) => b.subtotal - a.subtotal);
  const SHOW = 6;
  const keyShop = shop.filter(s => s.label !== 'All reinforcement' && s.unit !== 'L');
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-ce-hero">
      <div><small>Estimated total</small><strong class="u-num">${ngn(data.total)}</strong>
        <span class="u-num">${data.costPerM2 ? `${ngn(data.costPerM2)} per m² · ${Math.round(data.floorArea)} m²` : ''}</span></div>
      <dl class="astc-ce-split">
        <div><dt>Materials</dt><dd class="u-num">${ngnShort(data.materials)}</dd></div>
        <div><dt>Labour</dt><dd class="u-num">${ngnShort(data.labour)}</dd></div>
        <div><dt>Contingency ${esc(data.contingencyPct)}%</dt><dd class="u-num">${ngnShort(data.contingency)}</dd></div>
        <div><dt>VAT</dt><dd class="u-num">${data.vatOn ? ngnShort(data.vat) : 'Not added'}</dd></div>
      </dl>
    </div>
    <div class="astc-ce-cols">
      <section><h5>Bill by section</h5><ol class="astc-ce-secs">${top.map((s, i) => `
        <li class="${i >= SHOW ? 'is-more' : ''}"><span>${esc(s.name)}</span><b class="u-num">${ngnShort(s.subtotal)}</b><i style="width:${(s.subtotal / max * 100).toFixed(1)}%"></i></li>`).join('')}</ol></section>
      <section><h5>Shopping list</h5><ul class="astc-ce-shop">${keyShop.map((s, i) => `
        <li class="${i >= SHOW + 2 ? 'is-more' : ''}"><b class="u-num">${Number(s.qty).toLocaleString('en-US')}</b><em>${esc(s.unit)}</em><span>${esc(s.label)}${s.detail ? `<small>${esc(s.detail)}</small>` : ''}</span></li>`).join('')}</ul></section>
    </div>
    ${(sections.length > SHOW || keyShop.length > SHOW + 2) ? '<button type="button" class="astc-more" data-act="more">Show everything</button>' : ''}
    <p class="astc-ce-note">Rates dated ${esc(String(data.ratesDate || '').slice(0, 7))}. Prices move; confirm with suppliers before quoting.</p>`;
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'more') { el.classList.toggle('show-all'); t.textContent = el.classList.contains('show-all') ? 'Show less' : 'Show everything'; }
    if (t.dataset.act === 'open') {
      try { localStorage.setItem('toolbox_construction_handoff', JSON.stringify({ project: data.project, at: Date.now() })); } catch { /* storage blocked */ }
      window.location.hash = '#concrete-estimator';
    }
  });
  container.appendChild(el);
  return el;
}

/* ============================================================
   Music (music_library · music_theory), Business (business_calc),
   Networking (network_tool)
   ============================================================ */

const PLAY_ICON = '<path d="M7 4.5v15l12.5-7.5z"/>';
const MUSIC_ICON = '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>';
const BIZ_ICON = '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>';
const NET_ICON = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';

const openMusic = (focus) => {
  try { localStorage.setItem('toolbox.music.focus', JSON.stringify(focus)); } catch { /* storage blocked: the library still opens */ }
  window.location.hash = '#music-theory-library';
};
const openTool = (id) => { window.location.hash = `#${id}`; };
const sheet = (rows) => `<div class="astc-sheet"><section><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section></div>`;

export function renderMusicLibrary(data, container) {
  const isInst = data.kind === 'instrument', isTerm = data.kind === 'term';
  const el = card('music', {
    icon: MUSIC_ICON,
    title: isTerm ? data.term : data.title,
    sub: esc(isTerm ? 'Glossary · Music Theory Library' : isInst ? `${data.family} · instrument guide` : `${data.section}${data.level ? ` · ${data.level}` : ''}`),
    actions: btn('Open in library', I.external, 'data-act="open"'),
  });
  const chips = (list) => (list?.length ? `<div class="astc-ml-related"><span>Related</span>${list.map(r => `<button type="button" data-ml-go="${esc(r.id)}" data-ml-kind="${esc(r.kind)}">${esc(r.title)}</button>`).join('')}</div>` : '');
  let body = '';
  if (isTerm) body = `<p class="astc-ml-lead">${esc(data.def)}</p>`;
  else if (isInst) {
    body = `<p class="astc-ml-lead">${esc(data.summary)}</p>
      ${sheet([['Tuning', data.tuning], ['Range', data.range]].filter(([, v]) => v))}
      ${data.howToPlay?.length ? `<h5 class="astc-ml-h">How to play</h5><ol class="astc-ml-steps">${data.howToPlay.map(h => `<li><strong>${esc(h.h)}.</strong> ${esc(h.text)}</li>`).join('')}</ol>` : ''}
      ${data.roadmap?.length ? `<h5 class="astc-ml-h">Roadmap</h5><ol class="astc-ml-road">${data.roadmap.map(r => `<li><span>${esc(r.stage)}</span>${esc(r.goals.join(' · '))}</li>`).join('')}</ol>` : ''}`;
  } else {
    body = `<p class="astc-ml-lead">${esc(data.summary)}</p>${data.simple ? `<p class="astc-ml-text">${esc(data.simple.length > 600 ? `${data.simple.slice(0, 600).replace(/\s+\S*$/, '')}…` : data.simple)}</p>` : ''}`;
  }
  el.querySelector('.astc-body').innerHTML = `${body}${data.terms?.length && !isTerm ? `<dl class="astc-ml-terms">${data.terms.map(t => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd></div>`).join('')}</dl>` : ''}${chips(data.related)}`;
  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-ml-go]');
    if (go) { openMusic(go.dataset.mlKind === 'instrument' ? { instrument: go.dataset.mlGo } : { topic: go.dataset.mlGo }); return; }
    if (e.target.closest('[data-act="open"]')) openMusic(data.open || { query: data.title || data.term });
  });
  container.appendChild(el);
  return el;
}

export function renderMusicTheory(data, container) {
  const el = card('music', {
    icon: MUSIC_ICON,
    title: data.title,
    sub: esc(data.formula ? `Formula ${data.formula}` : data.signature || data.intervalName || (data.mode === 'progression' ? 'Progression' : '')),
    actions: `${btn('Play', PLAY_ICON, 'data-act="play"')}${btn('Open lab', I.external, 'data-act="open"')}`,
  });
  const body = el.querySelector('.astc-body');
  body.innerHTML = '<p class="astc-muted">Drawing…</p>';
  let W = null, A = null, T = null;
  (async () => {
    [W, A, T] = await Promise.all([import('../music/widgets.js'), import('../music/audio.js'), import('../music/theory.js')]);
    const P = (s) => T.parseNote(s);
    const piano = (names) => {
      const ms = names.map(n => T.midi(P(n)));
      const lo = Math.min(...ms), hi = Math.max(...ms);
      const from = Math.floor(lo / 12) * 12, to = Math.max(from + 23, Math.ceil((hi + 1) / 12) * 12 - 1);
      return W.pianoSvg({ from, to, marks: new Map(ms.map((m, i) => [m, { tone: i === 0 ? 'root' : 'on', label: T.noteName(P(names[i])) }])) });
    };
    if (data.mode === 'progression' || data.mode === 'key') {
      const chords = data.chords || [];
      body.innerHTML = `${data.mode === 'key' ? `<div class="astc-ml-scroll">${W.staffSvg(data.notes, { labels: data.names })}</div>${sheet([['Key signature', data.signature], ['Relative key', data.relative], ['Scale', (data.names || []).join(' ')]])}` : ''}
        <div class="astc-ml-chords">${chords.map((c, i) => `<button type="button" data-chord="${i}"><b>${esc(c.numeral)}</b><span>${esc(c.symbol)}</span><small>${esc(c.names.join(' '))}</small></button>`).join('')}</div>
        ${data.mode === 'progression' ? `<div class="astc-ml-scroll">${W.staffSvg(chords.map(c => c.notes))}</div>` : ''}`;
    } else {
      body.innerHTML = `<div class="astc-ml-scroll">${W.staffSvg(data.mode === 'chord' ? [data.notes] : data.notes, { labels: data.mode === 'chord' ? [] : data.names })}</div>
        <div class="astc-ml-scroll">${piano(data.notes)}</div>
        ${data.candidates?.length > 1 ? `<p class="astc-muted">Also: ${data.candidates.slice(1).map(c => esc(c.symbol)).join(', ')}</p>` : ''}`;
    }
  })().catch(() => { body.innerHTML = `<p>${esc((data.names || []).join(' '))}</p>`; });
  const playChord = (c) => A.playChord(c.notes.map(n => T.midi(T.parseNote(n))));
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="open"]')) { openMusic(data.open || { query: data.title }); return; }
    if (!A) return;
    const ch = e.target.closest('[data-chord]');
    if (ch) { playChord(data.chords[+ch.dataset.chord]); return; }
    const key = e.target.closest('[data-midi]');
    if (key) { A.playChord([+key.dataset.midi], { dur: 0.9 }); return; }
    if (e.target.closest('[data-act="play"]')) {
      A.stopAll();
      if (data.chords?.length) A.playProgression(data.chords.map(c => c.notes.map(n => T.midi(T.parseNote(n)))), { tempo: 84, beatsEach: 2 });
      else {
        const ms = data.notes.map(n => T.midi(T.parseNote(n)));
        if (data.mode === 'chord') A.playArpeggioChord(ms); else A.playSequence(ms);
      }
    }
  });
  container.appendChild(el);
  return el;
}

export function renderBusinessCalc(data, container) {
  const el = card('biz', { icon: BIZ_ICON, title: data.title, sub: 'Business &amp; Finance', actions: btn('Open tool', I.external, 'data-act="open"') });
  el.querySelector('.astc-body').innerHTML = `${sheet(data.rows || [])}${data.note ? `<p class="astc-muted astc-biz-note">${esc(data.note)}</p>` : ''}`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) openTool(data.toolId); });
  container.appendChild(el);
  return el;
}

export function renderNetworkResult(data, container) {
  const el = card('net', { icon: NET_ICON, title: data.title, sub: 'Networking', actions: btn('Open tool', I.external, 'data-act="open"') });
  el.querySelector('.astc-body').innerHTML = `${data.rows?.length ? sheet(data.rows) : ''}${data.pre ? `<pre class="astc-net-pre">${esc(data.pre)}</pre>` : ''}`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) openTool(data.toolId); });
  container.appendChild(el);
  return el;
}

const AUTO_ICON = '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>';
export function renderAutomations(data, container) {
  const list = Array.isArray(data.automations) ? data.automations : [];
  const el = card('auto', { icon: AUTO_ICON, title: list.length === 1 ? list[0].name : 'Automations', sub: list.length === 1 ? esc(list[0].schedule) : `${list.length} automation${list.length === 1 ? '' : 's'}`, actions: btn('Open Automations', I.external, 'data-act="open"') });
  el.querySelector('.astc-body').innerHTML = list.length
    ? list.slice(0, 12).map(a => sheet([
      ...(list.length > 1 ? [['Name', a.name], ['When', a.schedule]] : []),
      ['Steps', a.steps || '—'],
      ['Next run', a.enabled ? (a.nextRun || '—') : 'Paused'],
      ...(a.lastRun ? [['Last run', `${a.lastRun}${a.lastResult && a.lastResult !== 'ok' ? ` (${a.lastResult})` : ''}`]] : []),
    ])).join('')
    : '<p class="astc-muted">No automations yet.</p>';
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) openTool('automations'); });
  container.appendChild(el);
  return el;
}

registerResultRenderer('automations', renderAutomations);

/* Mail. Email text comes from other people: it is only ever inserted escaped. */
const MAIL_ICON = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>';
export function renderMailList(data, container) {
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  const el = card('mail', { icon: MAIL_ICON, title: data.query ? `Mail: ${data.query}` : 'Inbox', sub: `${msgs.length} message${msgs.length === 1 ? '' : 's'}`, actions: btn('Open Mail', I.external, 'data-act="open"') });
  el.querySelector('.astc-body').innerHTML = msgs.length
    ? `<ul class="astc-mail-list">${msgs.map(m => `<li class="${m.unread ? 'is-unread' : ''}" data-mail-id="${esc(m.id)}" data-thread-id="${esc(m.threadId || '')}" tabindex="0" role="button" aria-label="Open ${esc(m.subject)} in Mail">
        <div class="astc-mail-top"><span class="astc-mail-from">${esc(m.from)}</span><span class="astc-mail-date">${esc(m.date)}</span></div>
        <div class="astc-mail-subj">${m.starred ? `${uiIcon('star-fill', { className: 'astc-star', label: 'Starred' })} ` : ''}${esc(m.subject)}${m.attachments ? ' <span class="astc-muted">· attachment</span>' : ''}</div>
        <div class="astc-mail-snip">${esc(m.snippet)}</div></li>`).join('')}</ul>`
    : '<p class="astc-muted">No messages.</p>';
  const openRow = (li) => openInMail({ type: 'open', id: li.dataset.mailId, threadId: li.dataset.threadId });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="open"]')) { openTool('mail'); return; }
    const li = e.target.closest('[data-mail-id]');
    if (li) openRow(li);
  });
  el.addEventListener('keydown', (e) => { const li = e.target.closest('[data-mail-id]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(li); } });
  container.appendChild(el);
  return el;
}
function openInMail(intent) {
  import('../mail-provider.js').then(({ setMailIntent }) => { setMailIntent(intent); openTool('mail'); }).catch(() => openTool('mail'));
}
export function renderMailMessage(data, container) {
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  const last = msgs[msgs.length - 1];
  const el = card('mail', { icon: MAIL_ICON, title: data.subject || 'Email', sub: msgs.length > 1 ? `${msgs.length} messages` : esc(msgs[0]?.from || ''), actions: `${btn('Reply', I.pen, 'data-act="reply"')}${btn('Open in Mail', I.external, 'data-act="open"')}` });
  el.querySelector('.astc-body').innerHTML = msgs.map(m => `<article class="astc-mail-msg">
      <div class="astc-mail-top"><span class="astc-mail-from">${esc(m.from)}</span><span class="astc-mail-date">${esc(m.date)}</span></div>
      ${m.to ? `<div class="astc-muted astc-mail-to">To ${esc(m.to)}</div>` : ''}
      <div class="astc-mail-body">${esc(m.body)}</div>
      ${m.attachments?.length ? `<div class="astc-muted">Attachments: ${esc(m.attachments.join(', '))}</div>` : ''}
    </article>`).join('');
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'open' && last?.id) openInMail({ type: 'open', id: last.id });
    if (act === 'reply' && last?.id) openInMail({ type: 'compose', replyToId: last.id, mode: 'reply', body: '' });
  });
  container.appendChild(el);
  return el;
}
registerResultRenderer('mail-list', renderMailList);
registerResultRenderer('mail-message', renderMailMessage);

/* A site or app the Assistant built: a live preview in a sandboxed frame (scripts run, but it
   cannot reach Toolbox's storage, cookies or the page around it), with the project's files. */
const CODE_ICON = '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>';
export function renderIdeProject(data, container) {
  const files = Array.isArray(data.files) ? data.files : [];
  const ok = data.status !== 'error';
  const el = card('ide', {
    icon: CODE_ICON,
    title: data.project || 'Project',
    sub: ok ? (data.htmlBundle ? 'Live preview' : 'Code Playground project') : 'Build failed',
    actions: `${data.htmlBundle ? btn('Full screen', I.external, 'data-act="full"') : ''}${btn('Open in Code Playground', I.external, 'data-act="ide"')}`,
  });
  const body = el.querySelector('.astc-body');
  if (data.htmlBundle) {
    const frame = document.createElement('iframe');
    frame.className = 'astc-ide-frame';
    frame.title = `${data.project || 'Project'} preview`;
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals');
    frame.setAttribute('loading', 'lazy');
    frame.srcdoc = data.htmlBundle;
    body.appendChild(frame);
  }
  if (data.diagnostics?.length) {
    const list = document.createElement('ul');
    list.className = 'astc-ide-diag';
    list.innerHTML = data.diagnostics.slice(0, 8).map(d => `<li><strong>${esc(d.file)}</strong> ${esc(d.message)}</li>`).join('');
    body.appendChild(list);
  }
  if (files.length) {
    const p = document.createElement('p');
    p.className = 'astc-muted astc-ide-files';
    p.textContent = files.join(' · ');
    body.appendChild(p);
  }
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'ide') openTool('code-playground');
    // Full screen keeps the site in its sandboxed frame: opened as a page of its own it would
    // run on Toolbox's origin, with access to the person's session.
    if (act === 'full') el.querySelector('.astc-ide-frame')?.requestFullscreen?.().catch(() => {});
  });
  container.appendChild(el);
  return el;
}
registerResultRenderer('ide-preview', renderIdeProject);
registerResultRenderer('ide-project', renderIdeProject);
registerResultRenderer('music-library', renderMusicLibrary);
registerResultRenderer('music-theory', renderMusicTheory);
registerResultRenderer('business-calc', renderBusinessCalc);
registerResultRenderer('network-result', renderNetworkResult);

registerResultRenderer('task-plan', renderPlan);
registerResultRenderer('chess-board', renderChess, { match: d => typeof d?.fen === 'string' && Array.isArray(d?.legalMoves) });
registerResultRenderer('device-list', renderDeviceList);
registerResultRenderer('device-compare', renderDeviceCompare);
registerResultRenderer('vehicle', renderVehicle);
registerResultRenderer('vehicle-controls', renderVehicleControls);
registerResultRenderer('vehicle-part', renderVehiclePart);
registerResultRenderer('car-injury', renderCarInjury);
registerResultRenderer('construction-estimate', renderConstructionEstimate);
registerResultRenderer('svg-illustration', renderIllustration);
registerResultRenderer('container-design', renderContainerDesign, { match: d => Boolean(d?.design?.modules && d?.design?.levels) });
registerResultRenderer('structure-model', renderStructureModel, { match: d => Boolean(d?.spec?.objects) });
registerResultRenderer('lab3d-object', renderLab3dObject, { match: d => d?.type === 'lab3d-object' && Array.isArray(d?.spec?.items) });
registerResultRenderer('note', renderNote, { match: d => Boolean(d?.noteId && typeof d?.title === 'string' && d?.status !== 'error') });
registerResultRenderer('invoice-card', renderInvoiceCard);
registerResultRenderer('invoice-list', renderInvoiceList);

/* ============================================================
   Legal (analyze_legal_document · parse_citations · case_digest)
   ============================================================ */

const LG_ICON = '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>';
const LG_NOTE = '<p class="astc-lg-note">Extracted by pattern matching. Check against the source before relying on it.</p>';
const lgSev = (s) => `<span class="astc-lg-sev" data-sev="${esc(s)}">${esc(s)}</span>`;
const lgPill = (o) => (o ? `<span class="astc-lg-pill" data-tone="${{ allowed: 'good', dismissed: 'bad', 'struck out': 'bad', 'partly allowed': 'mid' }[o] || ''}">${esc(o[0].toUpperCase() + o.slice(1))}</span>` : '');

function renderLegalContract(data, container) {
  const risks = data.risks || [], obs = (data.obligations || []).filter(o => o.due || o.deadline).sort((x, y) => String(x.due || '9').localeCompare(String(y.due || '9')));
  const el = card('legal', { icon: LG_ICON, title: data.title || 'Document review', sub: esc([data.docType, (data.parties || []).map(p => `${p.name} (${p.role})`).join(' · ')].filter(Boolean).join(' — ')), actions: btn('Open analyzer', I.external, 'data-act="open"') });
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-lg-stats"><div data-tone="${data.counts?.high ? 'bad' : ''}"><b>${esc(data.counts?.high ?? 0)}</b><span>High</span></div><div data-tone="${data.counts?.medium ? 'mid' : ''}"><b>${esc(data.counts?.medium ?? 0)}</b><span>Medium</span></div><div><b>${esc(data.counts?.clauses ?? 0)}</b><span>Clauses</span></div><div><b>${esc(data.counts?.obligations ?? 0)}</b><span>Obligations</span></div></div>
    ${risks.length ? `<h5 class="astc-lg-h">Risk flags</h5><ul class="astc-lg-list">${risks.slice(0, 6).map(r => `<li>${lgSev(r.severity)}<div><strong>${esc(r.title)}</strong>${r.where ? `<small>${esc(r.where)}</small>` : ''}</div></li>`).join('')}${risks.length > 6 ? `<li class="astc-muted">and ${risks.length - 6} more</li>` : ''}</ul>` : '<p class="astc-muted">No risk flags raised.</p>'}
    ${obs.length ? `<h5 class="astc-lg-h">Deadlines</h5><ul class="astc-lg-list">${obs.slice(0, 5).map(o => `<li><span class="astc-lg-date">${esc(o.due || '—')}</span><div><strong>${esc(o.party)}</strong><small>${esc(o.action)}</small></div></li>`).join('')}</ul>` : ''}
    ${(data.missing || []).filter(m => m.required).length ? `<h5 class="astc-lg-h">Not found</h5><div class="astc-lg-chips">${data.missing.filter(m => m.required).map(m => `<span>${esc(m.label)}</span>`).join('')}</div>` : ''}
    ${LG_NOTE}`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) window.location.hash = '#legal-document-analyzer'; });
  container.appendChild(el);
  return el;
}

function renderLegalCitations(data, container) {
  const cases = data.cases || [];
  const toa = [...cases.map(c => `${c.title || 'Unnamed case'} ${c.citations.join('; ')}${c.court ? ` (${c.court})` : ''}`), ...(data.statutes || []).map(s => `${s.name}${s.provisions.length ? `: ${s.provisions.join(', ')}` : ''}`)].join('\n');
  const el = card('legal', { icon: LG_ICON, title: 'Table of authorities', sub: `${cases.length} case${cases.length === 1 ? '' : 's'} · ${(data.statutes || []).length} statute${(data.statutes || []).length === 1 ? '' : 's'} · weight before the ${esc(data.forum || 'HC')}`, actions: btn('Copy', I.copy, 'data-act="copy"') });
  el.querySelector('.astc-body').innerHTML = `
    ${cases.length ? `<ul class="astc-lg-list">${cases.slice(0, 12).map(c => `<li><div><strong><em>${esc(c.title || 'Unnamed case')}</em></strong><code>${esc(c.citations.join('; '))}</code><small>${esc([c.court ? `${c.court}${c.courtInferred ? ' (inferred)' : ''}` : 'Court not stated', c.weight, c.pinpoints?.length ? `at ${c.pinpoints.join(', ')}` : '', c.treatments?.length ? c.treatments.join(', ') : ''].filter(Boolean).join(' · '))}</small></div></li>`).join('')}</ul>` : '<p class="astc-muted">No case citations recognised.</p>'}
    ${(data.statutes || []).length ? `<h5 class="astc-lg-h">Statutes</h5><ul class="astc-lg-list">${data.statutes.map(s => `<li><div><strong>${esc(s.name)}</strong>${s.provisions.length ? `<small>${esc(s.provisions.join(', '))}</small>` : ''}</div></li>`).join('')}</ul>` : ''}
    ${LG_NOTE}`;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-act="copy"]'); if (b) copy(toa, b); });
  container.appendChild(el);
  return el;
}

function renderLegalDigest(data, container) {
  const el = card('legal', { icon: LG_ICON, title: data.title || 'Case digest', sub: esc([data.court, data.suitNo, data.date].filter(Boolean).join(' · ')), actions: btn('Open Case Digest', I.external, 'data-act="open"') });
  const list = (h, items, n = 5) => (items?.length ? `<h5 class="astc-lg-h">${h}</h5><ol class="astc-lg-ol">${items.slice(0, n).map(x => `<li>${esc(x.text)}${x.resolution ? `<small>${esc(x.resolution)}</small>` : ''}</li>`).join('')}</ol>` : '');
  el.querySelector('.astc-body').innerHTML = `
    <div class="astc-lg-cite">${lgPill(data.outcome)}<code>${esc(data.citation)}</code><button type="button" class="astc-btn" data-act="cite">${svg(I.copy, 14)}<span>Copy</span></button></div>
    ${list('Issues', data.issues)}${list('Ratio decidendi (candidates)', data.ratio, 3)}${list('Orders', data.orders, 4)}
    ${data.authorities?.length ? `<p class="astc-muted">${data.authorities.length} case${data.authorities.length === 1 ? '' : 's'} and ${data.statutes?.length || 0} statute${data.statutes?.length === 1 ? '' : 's'} cited.</p>` : ''}
    ${LG_NOTE}`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b?.dataset.act === 'cite') copy(data.citation, b);
    if (b?.dataset.act === 'open') window.location.hash = '#case-digest';
  });
  container.appendChild(el);
  return el;
}

registerResultRenderer('legal-contract', renderLegalContract);
registerResultRenderer('legal-citations', renderLegalCitations);
registerResultRenderer('legal-digest', renderLegalDigest);
