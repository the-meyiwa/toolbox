/* ============================================================
   TOOLBOX — Chess

   Play the computer, a friend on the same device, or analyse freely.
   Every rule of chess is enforced by lib/chess/engine.js (checks,
   pins, castling rights, en passant, promotion, checkmate, stalemate,
   the 50/75-move rules, threefold/fivefold repetition, insufficient
   material, time forfeits). The engine searches in a Web Worker.

   Coaching — best-move hints, move judgements (blunder, mistake…),
   the evaluation bar — only appears when Preferences → Tools → Chess
   allows it. This file never renders its own settings.
   ============================================================ */

import {
  Position, START_FEN, WHITE, BLACK, KING, PAWN, typeOf, colorOf,
  moveFrom, moveTo, movePromo, moveFlags, F_CAPTURE, F_CASTLE, F_PROMO,
  sqName, sqFromName, sqFile, sqRank, toPgn, parsePgn,
} from '../lib/chess/engine.js';
import { pieceSvg, PIECE_NAMES } from '../lib/chess/pieces.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { copyText, showToast } from '../utils.js';

const STORE = 'toolbox_chess_game_v1';
const TYPE_CHAR = ' pnbrqk';
const REVIEW_TIME = { fast: 250, balanced: 650, deep: 1500 };
const MATE_BOUND = 30000 - 512;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- opening book ----------
   Indexed by position rather than move order, so transpositions are named
   correctly (1.e4 Nc6 2.Nf3 e5 is a King's Knight Opening, whatever order
   the moves came in). Lines share prefixes, so the book is walked as a trie
   and each shared position is visited once. */
let BOOK_POS = null;   // position key → [eco, name]; filled by the worker
let BOOK_SEEN = null;  // every position that occurs inside a book line
const posKey = (p) => p.fen().split(' ').slice(0, 4).join(' ');
let bookLoading = false;
function book() { return Boolean(BOOK_POS); }
/** Name of the deepest book position reached in this game so far. */
function openingFor(keys) {
  if (!book()) return null;
  for (let i = Math.min(keys.length, 40) - 1; i >= 0; i--) {
    const hit = BOOK_POS.get(keys[i]);
    if (hit) return hit;
  }
  return null;
}

/* ---------- move judgement ---------- */
const JUDGEMENTS = {
  book:       { label: 'Book move',  glyph: '', tone: 'neutral' },
  forced:     { label: 'Only move',  glyph: '□', tone: 'neutral' },
  best:       { label: 'Best move',  glyph: '★', tone: 'good' },
  excellent:  { label: 'Excellent',  glyph: '!', tone: 'good' },
  good:       { label: 'Good',       glyph: '', tone: 'neutral' },
  inaccuracy: { label: 'Inaccuracy', glyph: '?!', tone: 'warn' },
  mistake:    { label: 'Mistake',    glyph: '?', tone: 'warn' },
  blunder:    { label: 'Blunder',    glyph: '??', tone: 'bad' },
  missedMate: { label: 'Missed mate', glyph: '?', tone: 'warn' },
};
function judge(r, isBook) {
  if (isBook) return 'book';
  if (r.forced) return 'forced';
  if (r.isBest) return 'best';
  const moverSign = r.mover === 'w' ? 1 : -1;
  const best = r.bestScore * moverSign, played = r.playedScore * moverSign;
  if (best > MATE_BOUND && played < MATE_BOUND && played > 300) return 'missedMate';
  const loss = r.loss;
  if (loss < 0.02) return 'excellent';
  if (loss < 0.05) return 'good';
  if (loss < 0.10) return 'inaccuracy';
  if (loss < 0.20) return 'mistake';
  return 'blunder';
}
function fmtScore(cp, mate) {
  if (mate) return `${mate > 0 ? '' : '−'}M${Math.abs(mate)}`;
  if (Math.abs(cp) > MATE_BOUND) return cp > 0 ? 'M' : '−M';
  const v = Math.round(cp / 10) / 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
}

/* ---------- small sound kit ---------- */
let audioCtx = null;
function tick(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const f = { move: 520, capture: 360, check: 760, end: 300 }[kind] || 520;
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'end' ? 0.4 : 0.11));
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.45);
  } catch { /* no audio */ }
}

/* ---------- engine worker wrapper ---------- */
class Engine {
  constructor() { this.worker = null; this.seq = 0; this.pending = new Map(); }
  spawn() {
    this.worker = new Worker(new URL('../lib/chess/worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error));
    };
    this.worker.onerror = (e) => { for (const p of this.pending.values()) p.reject(new Error(e.message || 'Engine error')); this.pending.clear(); };
  }
  ask(msg) {
    if (!this.worker) this.spawn();
    const id = ++this.seq;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.worker.postMessage({ ...msg, id }); });
  }
  /** Stop whatever it is doing (terminate; a fresh worker starts on the next request). */
  cancel() {
    if (!this.worker) return;
    this.worker.terminate(); this.worker = null;
    for (const p of this.pending.values()) p.reject(Object.assign(new Error('cancelled'), { cancelled: true }));
    this.pending.clear();
  }
  dispose() { this.cancel(); }
}

/* ============================================================ */

export default {
  render(container) {
    this.container = container;
    this.prefs = getToolSettings('chess');
    this.player = new Engine();     // plays moves
    this.coach = new Engine();      // hints, reviews, evaluation
    this.coachQueue = Promise.resolve();
    this.selected = -1;
    this.marks = { arrows: [], circles: new Set() };
    this.hintArrow = null;
    this.betterArrow = null;
    this.eval = null;               // { score (white cp), mate }
    this.thinking = false;
    this.editing = false;
    this.clockTimer = 0;
    this.game = this.loadGame() || this.freshGame({ mode: 'computer', human: 'w' });
    this.rebuild();
    this.renderShell();
    this.renderAll();
    this.offPrefs = onToolSettings('chess', (p) => this.applyPrefs(p));
    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.startClock();
    if (!BOOK_POS && !bookLoading) {
      // a short-lived worker of its own, so cancelling a search never loses the book
      bookLoading = true;
      const w = new Engine();
      w.ask({ type: 'book' }).then((b) => {
        BOOK_POS = new Map(b.positions.map(([k, eco, name]) => [k, [eco, name]]));
        BOOK_SEEN = new Set(b.seen);
        if (this.container) { this.renderStatus(); this.renderMoves(); }
      }).catch(() => {}).finally(() => { bookLoading = false; w.dispose(); });
    }
    this.maybeEngineMove();
    if (this.prefs.evalBar && !this.game.result) this.requestEval();
  },

  destroy() {
    this.saveGame();
    this.player?.dispose(); this.coach?.dispose();
    this.offPrefs?.();
    window.removeEventListener('keydown', this.onKey);
    clearInterval(this.clockTimer);
    this.resizeObs?.disconnect();
    this.container = null;
  },

  /* ---------------- game state ---------------- */
  freshGame({ mode, human, startFen = START_FEN }) {
    const tc = this.prefs.timeControl;
    const [mins, inc] = tc === 'none' || mode === 'analysis' ? [0, 0] : tc.split('+').map(Number);
    return {
      id: Date.now(), mode, human, startFen,
      moves: [],                 // { uci, san, review? }
      cursor: 0,                 // ply being viewed
      result: null,              // { result, reason, text }
      flipped: human === 'b',
      clock: mins ? { base: mins * 60000, inc: inc * 1000, w: mins * 60000, b: mins * 60000, running: false } : null,
    };
  },
  loadGame() {
    try {
      const g = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!g || !Array.isArray(g.moves)) return null;
      // validate by replaying
      const p = new Position(g.startFen);
      for (const m of g.moves) { const mv = p.fromSan(m.uci); if (!mv) return null; p.make(mv); }
      g.cursor = g.moves.length;
      if (g.clock) g.clock.running = false;
      return g;
    } catch { return null; }
  },
  saveGame() {
    try { localStorage.setItem(STORE, JSON.stringify(this.game)); } catch { /* private mode */ }
  },
  /** Rebuild the live position from the move list up to the cursor. */
  rebuild() {
    const g = this.game;
    this.pos = new Position(g.startFen);
    this.sans = [];
    this.keys = [];
    for (let i = 0; i < g.cursor; i++) {
      const m = this.pos.fromSan(g.moves[i].uci);
      this.sans.push(g.moves[i].san);
      this.pos.make(m);
      this.keys.push(posKey(this.pos));
    }
    this.legal = this.pos.legalMoves();
  },
  atLive() { return this.game.cursor === this.game.moves.length; },
  humanToMove() {
    const g = this.game;
    if (g.result || !this.atLive()) return g.mode === 'analysis';
    if (g.mode !== 'computer') return true;
    return (this.pos.turn === WHITE ? 'w' : 'b') === g.human;
  },
  canMoveColor(color) {
    const g = this.game;
    if (g.mode === 'analysis') return !this.editing;
    if (g.result || !this.atLive() || this.thinking) return false;
    if (g.mode === 'computer') return color === (g.human === 'w' ? WHITE : BLACK) && this.pos.turn === color;
    return this.pos.turn === color;
  },

  /* ---------------- shell ---------------- */
  renderShell() {
    const c = this.container;
    c.innerHTML = `
      <div class="chs" data-board="${esc(this.prefs.boardStyle)}">
        <div class="chs-main">
          <div class="chs-player" data-side="top"></div>
          <div class="chs-boardrow">
            <div class="chs-evalbar" aria-hidden="true"><div class="chs-evalfill"></div><span class="chs-evaltext"></span></div>
            <div class="chs-boardwrap">
              <div class="chs-board" tabindex="0" role="application" aria-label="Chessboard. Use arrow keys to move the cursor and Enter to pick up or drop a piece.">
                <div class="chs-squares"></div>
                <div class="chs-pieces"></div>
                <svg class="chs-arrows" viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden="true"></svg>
                <div class="chs-promo" hidden></div>
                <div class="chs-banner" hidden></div>
              </div>
            </div>
          </div>
          <div class="chs-player" data-side="bottom"></div>
        </div>

        <aside class="chs-side">
          <div class="chs-card chs-status-card">
            <div class="chs-status" role="status" aria-live="polite"></div>
            <div class="chs-opening"></div>
          </div>

          <div class="chs-card chs-coach" hidden></div>

          <div class="chs-card chs-moves-card">
            <div class="chs-moves-head">
              <span>Moves</span>
              <div class="chs-nav">
                <button type="button" class="btn-icon btn-ghost" data-nav="start" title="First move" aria-label="First move">${icon('first')}</button>
                <button type="button" class="btn-icon btn-ghost" data-nav="prev" title="Previous move (←)" aria-label="Previous move">${icon('prev')}</button>
                <button type="button" class="btn-icon btn-ghost" data-nav="next" title="Next move (→)" aria-label="Next move">${icon('next')}</button>
                <button type="button" class="btn-icon btn-ghost" data-nav="end" title="Latest move" aria-label="Latest move">${icon('last')}</button>
              </div>
            </div>
            <ol class="chs-moves" aria-label="Move list"></ol>
            <form class="chs-typein" autocomplete="off">
              <input type="text" class="tool-input" name="move" placeholder="Type a move — e4, Nf3, O-O, e7e8q" aria-label="Type a move" spellcheck="false">
            </form>
          </div>

          <div class="chs-actions">
            <button type="button" class="btn btn-secondary" data-act="hint">${icon('bulb')}<span>Hint</span></button>
            <button type="button" class="btn btn-secondary" data-act="undo">${icon('undo')}<span>Take back</span></button>
            <button type="button" class="btn btn-secondary" data-act="flip">${icon('flip')}<span>Flip</span></button>
            <button type="button" class="btn btn-secondary" data-act="draw">${icon('hand')}<span>Draw</span></button>
            <button type="button" class="btn btn-secondary" data-act="resign">${icon('flag')}<span>Resign</span></button>
            <button type="button" class="btn btn-secondary" data-act="more" aria-expanded="false">${icon('dots')}<span>Game</span></button>
          </div>

          <div class="chs-card chs-new">
            <div class="chs-new-row">
              <div class="chs-seg" role="radiogroup" aria-label="Opponent" data-group="mode">
                <button type="button" role="radio" data-value="computer">Computer</button>
                <button type="button" role="radio" data-value="local">Two players</button>
                <button type="button" role="radio" data-value="analysis">Analysis</button>
              </div>
            </div>
            <div class="chs-new-row" data-for="computer">
              <div class="chs-seg" role="radiogroup" aria-label="Play as" data-group="side">
                <button type="button" role="radio" data-value="w">White</button>
                <button type="button" role="radio" data-value="b">Black</button>
                <button type="button" role="radio" data-value="random">Random</button>
              </div>
              <span class="chs-level"></span>
            </div>
            <div class="chs-new-row chs-new-foot">
              <button type="button" class="btn btn-primary" data-act="new">New game</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="prefs">${icon('sliders')}<span>Chess preferences</span></button>
            </div>
          </div>

          <div class="chs-card chs-io" hidden>
            <div class="chs-io-row">
              <button type="button" class="btn btn-secondary btn-sm" data-act="copy-pgn">Copy PGN</button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="copy-fen">Copy FEN</button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="download">Download PGN</button>
            </div>
            <label class="chs-io-label" for="chs-import">Load a position or game</label>
            <textarea id="chs-import" class="tool-textarea" rows="3" placeholder="Paste a FEN or a PGN"></textarea>
            <div class="chs-io-row">
              <button type="button" class="btn btn-primary btn-sm" data-act="import">Load</button>
              <span class="chs-io-msg" role="status"></span>
            </div>
          </div>
        </aside>
      </div>`;

    this.el = {
      root: c.querySelector('.chs'),
      board: c.querySelector('.chs-board'),
      squares: c.querySelector('.chs-squares'),
      pieces: c.querySelector('.chs-pieces'),
      arrows: c.querySelector('.chs-arrows'),
      promo: c.querySelector('.chs-promo'),
      banner: c.querySelector('.chs-banner'),
      evalbar: c.querySelector('.chs-evalbar'),
      evalfill: c.querySelector('.chs-evalfill'),
      evaltext: c.querySelector('.chs-evaltext'),
      status: c.querySelector('.chs-status'),
      opening: c.querySelector('.chs-opening'),
      coach: c.querySelector('.chs-coach'),
      moves: c.querySelector('.chs-moves'),
      top: c.querySelector('[data-side="top"]'),
      bottom: c.querySelector('[data-side="bottom"]'),
      io: c.querySelector('.chs-io'),
      level: c.querySelector('.chs-level'),
    };
    this.newChoice = { mode: this.game.mode, side: this.game.human === 'b' ? 'b' : 'w' };
    this.cursorSq = 0x14;
    this.bindEvents();
  },

  renderAll(animateMove = 0) {
    this.el.root.dataset.board = this.prefs.boardStyle;
    this.el.root.classList.toggle('no-coords', !this.prefs.coordinates);
    this.el.root.classList.toggle('has-eval', Boolean(this.prefs.evalBar));
    this.renderSquares();
    this.renderPieces(animateMove);
    this.renderArrows();
    this.renderPlayers();
    this.renderStatus();
    this.renderMoves();
    this.renderCoach();
    this.renderEval();
    this.renderControls();
    this.fitBoard();
  },

  /* ---------------- board ---------------- */
  sqXY(sq) {
    const f = sqFile(sq), r = sqRank(sq);
    return this.game.flipped ? [7 - f, r] : [f, 7 - r];
  },
  renderSquares() {
    const g = this.game, pos = this.pos;
    const last = g.cursor > 0 && pos.stack.length ? pos.stack[pos.stack.length - 1].m : 0;
    const lastFrom = last ? moveFrom(last) : -1, lastTo = last ? moveTo(last) : -1;
    const checkSq = pos.inCheck() ? pos.kings[pos.turn === WHITE ? 0 : 1] : -1;
    const targets = new Map();
    if (this.selected >= 0 && this.prefs.legalMoves) {
      for (const m of this.legal) if (moveFrom(m) === this.selected) targets.set(moveTo(m), (moveFlags(m) & F_CAPTURE) !== 0);
    }
    let html = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const f = g.flipped ? 7 - x : x, r = g.flipped ? y : 7 - y;
      const sq = r * 16 + f;
      const cls = ['chs-sq', (f + r) % 2 ? 'light' : 'dark'];
      if (this.prefs.lastMove && (sq === lastFrom || sq === lastTo)) cls.push('last');
      if (sq === this.selected) cls.push('sel');
      if (sq === checkSq) cls.push('check');
      if (targets.has(sq)) cls.push(targets.get(sq) ? 'cap' : 'dot');
      if (this.marks.circles.has(sq)) cls.push('mark');
      if (this.kbActive && sq === this.cursorSq) cls.push('cursor');
      const coordFile = y === 7 ? `<span class="chs-coord f">${'abcdefgh'[f]}</span>` : '';
      const coordRank = x === 0 ? `<span class="chs-coord r">${r + 1}</span>` : '';
      html += `<div class="${cls.join(' ')}" data-sq="${sq}">${coordRank}${coordFile}</div>`;
    }
    this.el.squares.innerHTML = html;
  },
  renderPieces(animateMove = 0) {
    const b = this.pos.board;
    let html = '';
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p) continue;
      const [x, y] = this.sqXY(s);
      const color = colorOf(p) === WHITE ? 'w' : 'b', type = TYPE_CHAR[typeOf(p)];
      html += `<div class="chs-piece" data-sq="${s}" data-color="${color}" style="transform:translate(${x * 100}%,${y * 100}%)" aria-label="${color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[type]} on ${sqName(s)}">${pieceSvg(color, type)}</div>`;
    }
    this.el.pieces.innerHTML = html;
    if (animateMove && this.prefs.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const slide = (from, to) => {
        const el = this.el.pieces.querySelector(`.chs-piece[data-sq="${to}"]`);
        if (!el) return;
        const [fx, fy] = this.sqXY(from), [tx, ty] = this.sqXY(to);
        el.style.transition = 'none';
        el.style.transform = `translate(${fx * 100}%,${fy * 100}%)`;
        el.getBoundingClientRect();
        el.style.transition = '';
        el.style.transform = `translate(${tx * 100}%,${ty * 100}%)`;
      };
      const from = moveFrom(animateMove), to = moveTo(animateMove);
      slide(from, to);
      if (moveFlags(animateMove) & F_CASTLE) {
        const kingSide = to > from;
        slide(kingSide ? from + 3 : from - 4, kingSide ? from + 1 : from - 1);
      }
    }
  },
  renderArrows() {
    const arrows = [...this.marks.arrows.map(a => ({ ...a, kind: 'user' }))];
    if (this.hintArrow) arrows.push({ ...this.hintArrow, kind: 'hint' });
    if (this.betterArrow && this.game.cursor === this.betterArrow.ply) arrows.push({ ...this.betterArrow, kind: 'better' });
    this.el.arrows.innerHTML = `<defs>${['user', 'hint', 'better'].map(k => `<marker id="chs-head-${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0 0L10 5L0 10z" class="chs-head ${k}"/></marker>`).join('')}</defs>` +
      arrows.map(a => {
        const [x1, y1] = this.sqXY(a.from), [x2, y2] = this.sqXY(a.to);
        const cx1 = x1 + 0.5, cy1 = y1 + 0.5, cx2 = x2 + 0.5, cy2 = y2 + 0.5;
        const len = Math.hypot(cx2 - cx1, cy2 - cy1) || 1;
        const ex = cx2 - (cx2 - cx1) / len * 0.32, ey = cy2 - (cy2 - cy1) / len * 0.32;
        return `<line x1="${cx1}" y1="${cy1}" x2="${ex}" y2="${ey}" class="chs-arrow ${a.kind}" marker-end="url(#chs-head-${a.kind})"/>`;
      }).join('');
  },

  /* ---------------- side panels ---------------- */
  renderPlayers() {
    const g = this.game, bottomColor = g.flipped ? 'b' : 'w', topColor = bottomColor === 'w' ? 'b' : 'w';
    const mat = this.material();
    const name = (c) => {
      if (g.mode === 'computer') return c === g.human ? 'You' : `Computer · level ${this.prefs.strength}`;
      if (g.mode === 'analysis') return c === 'w' ? 'White' : 'Black';
      return c === 'w' ? 'White' : 'Black';
    };
    const strip = (c) => {
      const caps = mat.captured[c];   // pieces this side has captured
      const diff = mat.diff * (c === 'w' ? 1 : -1);
      const toMove = !g.result && (this.pos.turn === WHITE ? 'w' : 'b') === c;
      const clock = g.clock ? `<span class="chs-clock${toMove && g.clock.running ? ' running' : ''}${g.clock[c] < 20000 ? ' low' : ''}" data-clock="${c}">${fmtClock(g.clock[c])}</span>` : '';
      return `<span class="chs-avatar ${c}" aria-hidden="true"></span>
        <span class="chs-pname">${esc(name(c))}${toMove && this.thinking && g.mode === 'computer' && c !== g.human ? '<span class="chs-thinking" aria-label="thinking"><i></i><i></i><i></i></span>' : ''}</span>
        <span class="chs-caps">${caps.map(t => `<span class="chs-cap">${pieceSvg(c === 'w' ? 'b' : 'w', t)}</span>`).join('')}${diff > 0 ? `<span class="chs-diff">+${diff}</span>` : ''}</span>
        ${clock}`;
    };
    this.el.top.innerHTML = strip(topColor);
    this.el.bottom.innerHTML = strip(bottomColor);
    this.el.top.classList.toggle('to-move', !g.result && (this.pos.turn === WHITE ? 'w' : 'b') === topColor);
    this.el.bottom.classList.toggle('to-move', !g.result && (this.pos.turn === WHITE ? 'w' : 'b') === bottomColor);
  },
  material() {
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let sum = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.pos.board[s];
      if (!p || typeOf(p) === KING) continue;
      const c = colorOf(p) === WHITE ? 'w' : 'b', t = TYPE_CHAR[typeOf(p)];
      have[c][t]++;
      sum += (c === 'w' ? 1 : -1) * val[t];
    }
    const captured = { w: [], b: [] };
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      // promotions can push a count above the starting number; clamp at zero
      for (let i = 0; i < Math.max(0, start[t] - have.b[t]); i++) captured.w.push(t);
      for (let i = 0; i < Math.max(0, start[t] - have.w[t]); i++) captured.b.push(t);
    }
    return { captured, diff: sum };
  },
  renderStatus() {
    const g = this.game, pos = this.pos;
    let title, detail = '';
    const side = pos.turn === WHITE ? 'White' : 'Black';
    if (g.result && this.atLive()) {
      title = g.result.text;
      detail = g.result.detail || '';
    } else if (!this.atLive()) {
      title = `Viewing move ${Math.ceil(g.cursor / 2) || 0}${g.cursor % 2 ? '' : g.cursor ? '…' : ''}`;
      detail = g.mode === 'analysis' ? 'Move a piece to start a new line from here.' : 'Press → or End to return to the game.';
    } else {
      const st = pos.status();
      if (g.mode === 'computer') title = this.thinking ? 'Computer is thinking…' : this.humanToMove() ? 'Your move' : `${side} to move`;
      else title = `${side} to move`;
      if (st.check) { title = `${title.replace(/…$/, '')} · Check`; detail = `${side}'s king is in check.`; }
      if (st.claimable) detail = `A draw can be claimed (${st.claimable}).`;
    }
    this.el.status.innerHTML = `<strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}`;
    const op = this.prefs.showOpening && this.game.startFen === START_FEN ? openingFor(this.keys) : null;
    this.el.opening.hidden = !op;
    if (op) this.el.opening.innerHTML = `<span class="chs-eco">${esc(op[0])}</span><span>${esc(op[1])}</span>`;

    // banner on the board when the game has ended
    const showBanner = g.result && this.atLive() && !this.bannerDismissed;
    this.el.banner.hidden = !showBanner;
    if (showBanner) {
      this.el.banner.innerHTML = `<div class="chs-banner-card"><strong>${esc(g.result.text)}</strong><span>${esc(g.result.detail || '')}</span>
        <div class="chs-banner-actions"><button type="button" class="btn btn-primary btn-sm" data-act="new">New game</button><button type="button" class="btn btn-ghost btn-sm" data-act="banner-close">View board</button></div></div>`;
    }
  },
  renderMoves() {
    const g = this.game;
    const rows = [];
    const startPos = new Position(g.startFen);
    let num = startPos.fullmove, whiteToMove = startPos.turn === WHITE;
    let i = 0;
    const cell = (idx) => {
      if (idx >= g.moves.length) return '<span class="chs-mv empty"></span>';
      const m = g.moves[idx];
      const j = this.prefs.review && m.review ? JUDGEMENTS[m.review.kind] : null;
      return `<button type="button" class="chs-mv${idx + 1 === g.cursor ? ' current' : ''}${j ? ` tone-${j.tone}` : ''}" data-ply="${idx + 1}" ${j ? `title="${esc(j.label)}"` : ''}>${esc(m.san)}${j && j.glyph ? `<em>${esc(j.glyph)}</em>` : ''}</button>`;
    };
    if (!whiteToMove && g.moves.length) { rows.push(`<li><span class="chs-num">${num}.</span><span class="chs-mv empty">…</span>${cell(0)}</li>`); i = 1; num++; }
    for (; i < g.moves.length; i += 2) rows.push(`<li><span class="chs-num">${num++}.</span>${cell(i)}${cell(i + 1)}</li>`);
    if (g.result) rows.push(`<li class="chs-result">${esc(g.result.result)}</li>`);
    this.el.moves.innerHTML = rows.join('') || '<li class="chs-empty">No moves yet.</li>';
    // scroll only the list, never the page
    const list = this.el.moves, cur = list.querySelector('.current');
    if (cur) {
      const top = cur.offsetTop, bottom = top + cur.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    } else list.scrollTop = list.scrollHeight;
  },
  renderCoach() {
    const c = this.el.coach;
    const g = this.game;
    const ply = g.cursor;
    const m = ply > 0 ? g.moves[ply - 1] : null;
    if (!this.prefs.review || !m) { c.hidden = !this.coachMsg; if (this.coachMsg) c.innerHTML = this.coachMsg; return; }
    if (m.pending) { c.hidden = false; c.innerHTML = `<div class="chs-judge tone-neutral"><span class="chs-judge-badge">…</span><div><strong>Checking ${esc(m.san)}</strong><span>The coach is looking at this move.</span></div></div>`; return; }
    if (!m.review) { c.hidden = !this.coachMsg; if (this.coachMsg) c.innerHTML = this.coachMsg; return; }
    const r = m.review, j = JUDGEMENTS[r.kind];
    let text = '';
    if (r.kind === 'book') text = 'A known opening move.';
    else if (r.kind === 'forced') text = 'The only legal move.';
    else if (r.kind === 'best') text = 'The engine\'s first choice.';
    else if (r.kind === 'excellent' || r.kind === 'good') text = r.bestSan && r.bestSan !== m.san ? `${r.bestSan} was slightly more precise.` : 'A solid move.';
    else {
      text = `${esc(r.bestSan)} was better (${fmtScore(r.bestEval, r.bestMate)}).`;
      if (r.refutation) text += ` After ${esc(m.san)}, ${esc(r.refutation)} ${r.kind === 'blunder' ? 'punishes it' : 'is strong'}.`;
    }
    c.hidden = false;
    c.innerHTML = `<div class="chs-judge tone-${j.tone}">
      <span class="chs-judge-badge">${esc(j.glyph || (r.kind === 'book' ? '≡' : '✓'))}</span>
      <div><strong>${esc(m.san)} · ${esc(j.label)}</strong><span>${text}</span></div>
      ${['inaccuracy', 'mistake', 'blunder', 'missedMate'].includes(r.kind) && r.best ? `<button type="button" class="btn btn-ghost btn-sm" data-act="show-better">Show</button>` : ''}
    </div>`;
  },
  renderEval() {
    const bar = this.el.evalbar;
    bar.hidden = !this.prefs.evalBar;
    if (!this.prefs.evalBar) return;
    let e = this.eval;
    const m = this.game.cursor > 0 ? this.game.moves[this.game.cursor - 1] : null;
    if (m?.review) e = { score: m.review.afterEval, mate: m.review.afterMate };
    if (this.game.result && this.atLive()) {
      const r = this.game.result.result;
      e = { score: r === '1-0' ? 99999 : r === '0-1' ? -99999 : 0, mate: 0, final: true };
    }
    if (!e) { this.el.evalfill.style.height = '50%'; this.el.evaltext.textContent = ''; return; }
    const pct = e.mate ? (e.mate > 0 ? 100 : 0) : Math.abs(e.score) > 90000 ? (e.score > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-0.004 * e.score)) - 1);
    // the fill is White's share; when the board is flipped White is at the top
    bar.classList.toggle('flipped', this.game.flipped);
    this.el.evalfill.style.height = `${pct}%`;
    this.el.evaltext.textContent = e.final ? this.game.result.result : fmtScore(e.score, e.mate);
    this.el.evaltext.classList.toggle('on-white', pct >= 50);
  },
  renderControls() {
    const g = this.game, root = this.container;
    const q = (s) => root.querySelector(s);
    q('[data-act="hint"]').hidden = !this.prefs.hints;
    q('[data-act="hint"]').disabled = Boolean(g.result) || !this.humanToMove() || this.thinking;
    q('[data-act="undo"]').disabled = !g.moves.length || this.thinking;
    q('[data-act="draw"]').hidden = g.mode === 'analysis';
    q('[data-act="resign"]').hidden = g.mode === 'analysis';
    const st = this.pos.status();
    const drawBtn = q('[data-act="draw"]');
    drawBtn.disabled = Boolean(g.result);
    drawBtn.querySelector('span').textContent = st.claimable && this.atLive() ? 'Claim draw' : g.mode === 'computer' ? 'Offer draw' : 'Agree draw';
    q('[data-act="resign"]').disabled = Boolean(g.result);
    q('[data-nav="start"]').disabled = q('[data-nav="prev"]').disabled = g.cursor === 0;
    q('[data-nav="end"]').disabled = q('[data-nav="next"]').disabled = this.atLive();
    // new-game chooser
    root.querySelectorAll('[data-group="mode"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === this.newChoice.mode)));
    root.querySelectorAll('[data-group="side"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === this.newChoice.side)));
    q('[data-for="computer"]').hidden = this.newChoice.mode !== 'computer';
    this.el.level.textContent = `Level ${this.prefs.strength} of 10`;
    q('.chs-typein input').disabled = !this.humanToMove() || Boolean(g.result && this.atLive());
  },

  /* ---------------- preferences ---------------- */
  applyPrefs(p) {
    const before = this.prefs;
    this.prefs = p;
    if (!p.hints) this.hintArrow = null;
    if (!p.review) this.betterArrow = null;
    this.renderAll();
    if (p.evalBar && !before.evalBar) this.requestEval();
    if (p.review && !before.review) this.reviewMissing();
  },

  /* ---------------- events ---------------- */
  bindEvents() {
    const board = this.el.board;
    board.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    board.addEventListener('focus', () => { this.kbActive = false; });

    this.container.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) return this.navigate(nav.dataset.nav);
      const mv = e.target.closest('.chs-mv[data-ply]');
      if (mv) return this.goTo(Number(mv.dataset.ply));
      const seg = e.target.closest('.chs-seg button');
      if (seg) {
        this.newChoice[seg.parentElement.dataset.group] = seg.dataset.value;
        return this.renderControls();
      }
      const act = e.target.closest('[data-act]');
      if (act) this.action(act.dataset.act, act);
    });

    this.container.querySelector('.chs-typein').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.move;
      const text = input.value.trim();
      if (!text) return;
      const m = this.pos.fromSan(text);
      if (!m) { input.setCustomValidity('Not a legal move here'); input.reportValidity(); setTimeout(() => input.setCustomValidity(''), 1500); return; }
      if (!this.canMoveColor(this.pos.turn)) return;
      input.value = '';
      this.playMove(m);
    });

    // keep the board square in the available space
    this.resizeObs = new ResizeObserver(() => this.fitBoard());
    this.resizeObs.observe(this.el.root);
    this.fitBoard();
  },
  fitBoard() {
    const row = this.el.board.closest('.chs-boardrow');
    if (!row || !row.clientWidth) return;
    const barW = this.prefs.evalBar ? (window.innerWidth <= 560 ? 10 : 18) + 12 : 0;
    const w = row.clientWidth - barW;
    const avail = window.innerHeight - (row.getBoundingClientRect().top + window.scrollY) - 64;
    const size = Math.floor(Math.max(260, Math.min(w, Math.max(avail, 340), 760)) / 8) * 8;
    this.el.root.style.setProperty('--bsz', `${size}px`);
    this.el.root.style.setProperty('--bar', `${barW}px`);
  },

  squareAt(clientX, clientY) {
    const rect = this.el.board.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * 8), y = Math.floor((clientY - rect.top) / rect.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    const f = this.game.flipped ? 7 - x : x, r = this.game.flipped ? y : 7 - y;
    return r * 16 + f;
  },

  onPointerDown(e) {
    if (e.target.closest('.chs-promo, .chs-banner')) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    if (sq < 0) return;
    if (e.button === 2) return this.startMark(e, sq);
    if (e.button !== 0) return;
    // a plain click clears drawn marks
    if (this.marks.arrows.length || this.marks.circles.size) { this.marks = { arrows: [], circles: new Set() }; this.renderArrows(); }
    if (!this.atLive() && this.game.mode !== 'analysis') { this.goTo(this.game.moves.length); return; }

    const p = this.pos.board[sq];
    // second click on a target square completes a click-move
    if (this.selected >= 0 && sq !== this.selected) {
      const tries = this.legal.filter(m => moveFrom(m) === this.selected && moveTo(m) === sq);
      if (tries.length) { this.tryMove(this.selected, sq); return; }
    }
    if (p && this.canMoveColor(colorOf(p)) && colorOf(p) === this.pos.turn) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.renderSquares();
      this.startDrag(e, sq, wasSelected);
    } else if (this.selected >= 0) {
      this.selected = -1;
      this.renderSquares();
    }
  },

  startDrag(e, sq, wasSelected) {
    const el = this.el.pieces.querySelector(`.chs-piece[data-sq="${sq}"]`);
    if (!el) return;
    const rect = this.el.board.getBoundingClientRect();
    const size = rect.width / 8;
    let moved = false;
    this.el.board.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      el.classList.add('dragging');
      const x = ev.clientX - rect.left - size / 2, y = ev.clientY - rect.top - size / 2;
      el.style.transform = `translate(${x / size * 100}%, ${y / size * 100}%)`;
      const over = this.squareAt(ev.clientX, ev.clientY);
      this.el.squares.querySelectorAll('.hover').forEach(n => n.classList.remove('hover'));
      if (over >= 0) this.el.squares.querySelector(`[data-sq="${over}"]`)?.classList.add('hover');
    };
    const up = (ev) => {
      this.el.board.removeEventListener('pointermove', move);
      this.el.board.removeEventListener('pointerup', up);
      this.el.board.removeEventListener('pointercancel', up);
      this.el.squares.querySelectorAll('.hover').forEach(n => n.classList.remove('hover'));
      el.classList.remove('dragging');
      if (!moved) {
        // click on an already-selected piece deselects it
        if (wasSelected) { this.selected = -1; this.renderSquares(); }
        return;
      }
      const to = this.squareAt(ev.clientX, ev.clientY);
      const [x, y] = this.sqXY(sq);
      if (to >= 0 && to !== sq && this.legal.some(m => moveFrom(m) === sq && moveTo(m) === to)) {
        el.style.transition = 'none';
        const [tx, ty] = this.sqXY(to);
        el.style.transform = `translate(${tx * 100}%,${ty * 100}%)`;
        this.tryMove(sq, to, true);
      } else {
        el.style.transform = `translate(${x * 100}%,${y * 100}%)`;
      }
    };
    this.el.board.addEventListener('pointermove', move);
    this.el.board.addEventListener('pointerup', up);
    this.el.board.addEventListener('pointercancel', up);
  },

  startMark(e, from) {
    const up = (ev) => {
      this.el.board.removeEventListener('pointerup', up);
      const to = this.squareAt(ev.clientX, ev.clientY);
      if (to < 0) return;
      if (to === from) {
        this.marks.circles.has(from) ? this.marks.circles.delete(from) : this.marks.circles.add(from);
        this.renderSquares();
      } else {
        const i = this.marks.arrows.findIndex(a => a.from === from && a.to === to);
        i >= 0 ? this.marks.arrows.splice(i, 1) : this.marks.arrows.push({ from, to });
        this.renderArrows();
      }
    };
    this.el.board.addEventListener('pointerup', up);
  },

  tryMove(from, to, dropped = false) {
    const options = this.legal.filter(m => moveFrom(m) === from && moveTo(m) === to);
    if (!options.length) return;
    if (options.length > 1 && (moveFlags(options[0]) & F_PROMO)) {
      if (this.prefs.autoQueen) return this.playMove(options.find(m => movePromo(m) === 5), dropped);
      return this.askPromotion(options, to, dropped);
    }
    this.playMove(options[0], dropped);
  },

  askPromotion(options, to, dropped) {
    const color = this.pos.turn === WHITE ? 'w' : 'b';
    const [x, y] = this.sqXY(to);
    const down = y !== 0;   // picker grows away from the edge the pawn reached
    const el = this.el.promo;
    el.hidden = false;
    el.style.left = `${x * 12.5}%`;
    el.style.top = down ? 'auto' : '0';
    el.style.bottom = down ? '0' : 'auto';
    el.classList.toggle('from-bottom', down);
    el.innerHTML = [5, 2, 4, 3].map(t => `<button type="button" data-promo="${t}" aria-label="Promote to ${PIECE_NAMES[TYPE_CHAR[t]]}">${pieceSvg(color, TYPE_CHAR[t])}</button>`).join('') +
      `<button type="button" class="chs-promo-cancel" data-promo="0" aria-label="Cancel">×</button>`;
    el.querySelector('button').focus();
    el.onclick = (e) => {
      const b = e.target.closest('[data-promo]');
      if (!b) return;
      el.hidden = true;
      const t = Number(b.dataset.promo);
      if (!t) { this.selected = -1; this.renderAll(); return; }
      this.playMove(options.find(m => movePromo(m) === t), dropped);
    };
  },

  /* ---------------- making moves ---------------- */
  playMove(m, dropped = false) {
    const g = this.game;
    if (!m) return;
    // analysis: moving while viewing the past starts a new line from there
    if (!this.atLive()) {
      if (g.mode !== 'analysis') return;
      g.moves.length = g.cursor;
      g.result = null;
    }
    const san = this.pos.toSan(m, this.legal);
    const uci = this.pos.toUci(m);
    const beforeMoves = g.moves.map(x => x.uci);
    const moverColor = this.pos.turn;
    const flags = moveFlags(m);
    this.pos.make(m);
    this.sans.push(san);
    this.keys.push(posKey(this.pos));
    g.moves.push({ uci, san });
    g.cursor = g.moves.length;
    this.legal = this.pos.legalMoves();
    this.selected = -1;
    this.hintArrow = null;
    this.coachMsg = '';
    this.bannerDismissed = false;

    // clock
    if (g.clock && g.mode !== 'analysis') {
      const c = moverColor === WHITE ? 'w' : 'b';
      if (g.clock.running) g.clock[c] += g.clock.inc;
      g.clock.running = true;
      g.clock.stamp = Date.now();
    }

    const st = this.pos.status();
    if (st.over) this.finish(st.result, st.reason);

    if (this.prefs.sounds) tick(st.over ? 'end' : st.check ? 'check' : (flags & F_CAPTURE) ? 'capture' : 'move');
    if (this.prefs.autoFlip && g.mode === 'local' && !g.result) g.flipped = this.pos.turn === BLACK;

    this.renderAll(dropped ? 0 : m);
    this.saveGame();

    // coaching on the move just made
    const reviewThis = this.prefs.review && (g.mode !== 'computer' || (moverColor === WHITE ? 'w' : 'b') === g.human);
    if (reviewThis) this.review(g.moves.length - 1, beforeMoves, uci);
    else if (this.prefs.evalBar) this.requestEval();

    this.maybeEngineMove();
  },

  finish(result, reason, extra = {}) {
    const g = this.game;
    const winner = result === '1-0' ? 'White' : result === '0-1' ? 'Black' : null;
    const you = g.mode === 'computer' ? (result === '1/2-1/2' ? null : (winner === 'White') === (g.human === 'w')) : null;
    const texts = {
      checkmate: `Checkmate. ${winner} wins.`,
      stalemate: 'Stalemate. It\'s a draw.',
      'insufficient material': 'Draw. Neither side can checkmate.',
      'fivefold repetition': 'Draw by fivefold repetition.',
      '75-move rule': 'Draw by the 75-move rule.',
      'threefold repetition': 'Draw by threefold repetition.',
      '50-move rule': 'Draw by the 50-move rule.',
      resignation: `${extra.loser} resigned. ${winner} wins.`,
      time: `${extra.loser} ran out of time. ${winner} wins.`,
      'time-draw': `${extra.loser} ran out of time, but ${winner || 'the opponent'} can't checkmate. Draw.`,
      agreement: 'Draw agreed.',
    };
    const detail = you === true ? 'Well played — you won.' : you === false ? 'The computer won this one.' : '';
    g.result = { result, reason, text: texts[reason] || `Game over (${reason}).`, detail };
    if (g.clock) g.clock.running = false;
    this.player.cancel();
    this.thinking = false;
  },

  maybeEngineMove() {
    const g = this.game;
    if (g.mode !== 'computer' || g.result || !this.atLive()) return;
    const engineColor = g.human === 'w' ? BLACK : WHITE;
    if (this.pos.turn !== engineColor || this.thinking) return;
    this.thinking = true;
    this.renderPlayers(); this.renderStatus(); this.renderControls();
    const gameId = g.id, ply = g.moves.length;
    const started = Date.now();
    this.player.ask({ type: 'play', startFen: g.startFen, moves: g.moves.map(m => m.uci), level: this.prefs.strength })
      .then(async (r) => {
        // a short pause so an instant reply still reads as a move
        const wait = 350 - (Date.now() - started);
        if (wait > 0) await new Promise(res => setTimeout(res, wait));
        if (!this.container || this.game.id !== gameId || this.game.moves.length !== ply) return;
        this.thinking = false;
        const m = this.pos.fromSan(r.move);
        if (m) this.playMove(m);
      })
      .catch((err) => { if (!err.cancelled) { this.thinking = false; showToast('The engine stopped unexpectedly. Try the move again.'); this.renderAll(); } });
  },

  /* ---------------- coaching ---------------- */
  queueCoach(job) {
    const run = this.coachQueue.then(job, job);
    this.coachQueue = run.catch(() => {});
    return run;
  },
  review(index, beforeMoves, uci) {
    const g = this.game, gameId = g.id;
    const entry = g.moves[index];
    entry.pending = true;
    this.renderCoach();
    const isBook = book() && g.startFen === START_FEN && index < 30 && BOOK_SEEN.has(this.keys[index]);
    const timeMs = REVIEW_TIME[this.prefs.reviewDepth] || 650;
    this.queueCoach(() => this.coach.ask({ type: 'review', startFen: g.startFen, moves: beforeMoves, played: uci, timeMs }))
      .then((r) => {
        if (!this.container || this.game.id !== gameId || this.game.moves[index] !== entry) return;
        delete entry.pending;
        const kind = judge(r, isBook);
        const bestSan = r.best.san;
        const refutation = r.after?.pvSan?.slice(0, 2).join(' ');
        // every score here is from White's point of view
        entry.review = {
          kind, bestSan, best: r.best.move, bestEval: r.bestScore, bestMate: r.best.mate,
          afterEval: r.playedScore, afterMate: r.after?.mate || 0,
          refutation: ['mistake', 'blunder', 'missedMate'].includes(kind) ? refutation : '',
        };
        this.saveGame();
        this.renderMoves(); this.renderCoach(); this.renderEval();
        if (kind === 'blunder' && this.game.cursor === index + 1) {
          this.el.coach.classList.add('pulse');
          setTimeout(() => this.el.coach?.classList.remove('pulse'), 900);
        }
      })
      .catch((err) => {
        if (err.cancelled) return;
        delete entry.pending;
        this.renderCoach();
      });
  },
  reviewMissing() {
    const g = this.game;
    g.moves.forEach((m, i) => {
      if (m.review || m.pending) return;
      const mover = (new Position(g.startFen).turn === WHITE) === (i % 2 === 0) ? 'w' : 'b';
      if (g.mode === 'computer' && mover !== g.human) return;
      this.review(i, g.moves.slice(0, i).map(x => x.uci), m.uci);
    });
  },
  requestEval() {
    if (!this.prefs.evalBar) return;
    const g = this.game, gameId = g.id, cursor = g.cursor;
    const moves = g.moves.slice(0, cursor).map(m => m.uci);
    if (this.pos.status().over) { this.eval = null; this.renderEval(); return; }
    this.queueCoach(() => this.coach.ask({ type: 'analyse', startFen: g.startFen, moves, timeMs: 300 }))
      .then((r) => {
        if (!this.container || this.game.id !== gameId || this.game.cursor !== cursor) return;
        this.eval = { score: r.score, mate: r.mate };
        this.renderEval();
      }).catch(() => {});
  },
  hint() {
    if (!this.prefs.hints) return;
    const g = this.game, gameId = g.id, ply = g.moves.length;
    const btn = this.container.querySelector('[data-act="hint"]');
    btn.disabled = true; btn.classList.add('busy');
    this.coach.cancel();
    this.coachQueue = Promise.resolve();
    this.coach.ask({ type: 'analyse', startFen: g.startFen, moves: g.moves.slice(0, g.cursor).map(m => m.uci), timeMs: Math.max(600, REVIEW_TIME[this.prefs.reviewDepth] * 1.5) })
      .then((r) => {
        if (!this.container || this.game.id !== gameId || this.game.moves.length !== ply) return;
        this.hintArrow = { from: sqFromName(r.move.slice(0, 2)), to: sqFromName(r.move.slice(2, 4)) };
        this.coachMsg = `<div class="chs-judge tone-good"><span class="chs-judge-badge">${icon('bulb')}</span><div><strong>Try ${esc(r.san)}</strong><span>Engine line: ${esc(r.pvSan.slice(0, 5).join(' '))} · ${fmtScore(r.score, r.mate)}</span></div></div>`;
        this.eval = { score: r.score, mate: r.mate };
        this.renderArrows(); this.renderCoach(); this.renderEval();
      })
      .catch(() => {})
      .finally(() => { btn.classList.remove('busy'); this.renderControls(); });
  },

  /* ---------------- actions ---------------- */
  action(act, el) {
    const g = this.game;
    switch (act) {
      case 'hint': return this.hint();
      case 'flip': g.flipped = !g.flipped; this.saveGame(); return this.renderAll();
      case 'undo': return this.takeBack();
      case 'resign': {
        if (g.result) return;
        const loserColor = g.mode === 'computer' ? g.human : (this.pos.turn === WHITE ? 'w' : 'b');
        this.finish(loserColor === 'w' ? '0-1' : '1-0', 'resignation', { loser: loserColor === 'w' ? 'White' : 'Black' });
        this.saveGame(); return this.renderAll();
      }
      case 'draw': return this.drawAction();
      case 'new': return this.newGame();
      case 'banner-close': this.bannerDismissed = true; return this.renderStatus();
      case 'prefs': return openSettings('tool:chess');
      case 'more': {
        const open = this.el.io.hidden;
        this.el.io.hidden = !open;
        el.setAttribute('aria-expanded', String(open));
        return;
      }
      case 'copy-pgn': copyText(this.pgn()); return showToast('PGN copied');
      case 'copy-fen': copyText(this.pos.fen()); return showToast('FEN copied');
      case 'download': {
        const blob = new Blob([this.pgn()], { type: 'application/x-chess-pgn' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `toolbox-chess-${new Date().toISOString().slice(0, 10)}.pgn`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return;
      }
      case 'import': return this.importText();
      case 'show-better': {
        const m = g.moves[g.cursor - 1];
        if (!m?.review?.best) return;
        this.goTo(g.cursor - 1);
        this.betterArrow = { from: sqFromName(m.review.best.slice(0, 2)), to: sqFromName(m.review.best.slice(2, 4)), ply: g.cursor };
        return this.renderArrows();
      }
      default: return undefined;
    }
  },
  pgn() {
    const g = this.game;
    const name = (c) => g.mode === 'computer' ? (c === g.human ? 'You' : `Toolbox engine (level ${this.prefs.strength})`) : c === 'w' ? 'White' : 'Black';
    return toPgn({ sans: g.moves.map(m => m.san), result: g.result?.result || '*', white: name('w'), black: name('b'), startFen: g.startFen });
  },
  takeBack() {
    const g = this.game;
    if (!g.moves.length) return;
    this.player.cancel(); this.thinking = false;
    let n = 1;
    if (g.mode === 'computer') {
      // take back to the last position where it was the human's turn
      const startTurn = new Position(g.startFen).turn === WHITE ? 'w' : 'b';
      const turnAt = (ply) => ((ply % 2 === 0) === (startTurn === 'w') ? 'w' : 'b');
      n = 0;
      do { n++; } while (g.moves.length - n > 0 && turnAt(g.moves.length - n) !== g.human);
      if (turnAt(g.moves.length - n) !== g.human) n = g.moves.length;
    }
    g.moves.splice(g.moves.length - n, n);
    g.cursor = g.moves.length;
    g.result = null;
    if (g.clock) g.clock.running = g.moves.length > 0;
    this.hintArrow = this.betterArrow = null; this.coachMsg = '';
    this.rebuild(); this.renderAll(); this.saveGame();
    if (this.prefs.evalBar) this.requestEval();
    this.maybeEngineMove();
  },
  drawAction() {
    const g = this.game;
    if (g.result) return;
    const st = this.pos.status();
    if (st.claimable && this.atLive()) {
      this.finish('1/2-1/2', st.claimable); this.saveGame(); return this.renderAll();
    }
    if (g.mode === 'local') { this.finish('1/2-1/2', 'agreement'); this.saveGame(); return this.renderAll(); }
    // the computer accepts when the position is level and the game is not young
    this.coach.ask({ type: 'analyse', startFen: g.startFen, moves: g.moves.map(m => m.uci), timeMs: 400 }).then((r) => {
      const engineIsWhite = g.human === 'b';
      const forEngine = engineIsWhite ? r.score : -r.score;
      if (g.moves.length >= 30 && forEngine <= 40 && !r.mate) {
        this.finish('1/2-1/2', 'agreement'); this.saveGame(); this.renderAll();
      } else {
        this.coachMsg = `<div class="chs-judge tone-neutral"><span class="chs-judge-badge">${icon('hand')}</span><div><strong>Draw declined</strong><span>${g.moves.length < 30 ? 'The computer wants to play on — it\'s early.' : 'The computer thinks it still has chances.'}</span></div></div>`;
        this.renderCoach();
      }
    }).catch(() => {});
  },
  newGame() {
    const choice = this.newChoice;
    const human = choice.mode !== 'computer' ? 'w' : choice.side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : choice.side;
    this.player.cancel(); this.coach.cancel(); this.coachQueue = Promise.resolve();
    this.thinking = false;
    this.game = this.freshGame({ mode: choice.mode, human });
    this.player.ask({ type: 'newgame' }).catch(() => {});
    this.hintArrow = this.betterArrow = null; this.coachMsg = ''; this.eval = null;
    this.marks = { arrows: [], circles: new Set() };
    this.rebuild(); this.renderAll(); this.saveGame();
    this.maybeEngineMove();
  },
  importText() {
    const text = this.container.querySelector('#chs-import').value.trim();
    const msg = this.container.querySelector('.chs-io-msg');
    if (!text) return;
    try {
      let startFen = START_FEN, uci = [];
      if (/^\s*([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]/.test(text)) {
        startFen = new Position(text).fen();
      } else {
        const parsed = parsePgn(text);
        startFen = parsed.startFen;
        const p = new Position(startFen);
        for (const m of parsed.moves) { uci.push(p.toUci(m)); p.make(m); }
      }
      const mode = 'analysis';
      this.player.cancel(); this.coach.cancel(); this.coachQueue = Promise.resolve();
      this.game = this.freshGame({ mode, human: 'w', startFen });
      const p = new Position(startFen);
      for (const u of uci) { const m = p.fromSan(u); this.game.moves.push({ uci: u, san: p.toSan(m) }); p.make(m); }
      this.game.cursor = this.game.moves.length;
      const st = p.status();
      if (st.over) this.finish(st.result, st.reason);
      this.newChoice.mode = 'analysis';
      this.rebuild(); this.renderAll(); this.saveGame();
      msg.textContent = uci.length ? `Loaded ${uci.length} moves for analysis.` : 'Position loaded for analysis.';
      if (this.prefs.evalBar) this.requestEval();
    } catch (err) {
      msg.textContent = err.message;
    }
  },

  /* ---------------- navigation ---------------- */
  goTo(ply) {
    const g = this.game;
    ply = Math.max(0, Math.min(g.moves.length, ply));
    if (ply === g.cursor) return;
    const step = ply === g.cursor + 1 ? g.moves[g.cursor] : null;
    g.cursor = ply;
    this.selected = -1; this.hintArrow = null;
    if (this.betterArrow && this.betterArrow.ply !== ply) this.betterArrow = null;
    this.rebuild();
    const m = step ? this.pos.stack[this.pos.stack.length - 1]?.m : 0;
    this.renderAll(m || 0);
    if (this.prefs.evalBar && !g.moves[ply - 1]?.review) this.requestEval();
  },
  navigate(where) {
    const g = this.game;
    if (where === 'start') this.goTo(0);
    else if (where === 'prev') this.goTo(g.cursor - 1);
    else if (where === 'next') this.goTo(g.cursor + 1);
    else this.goTo(g.moves.length);
  },
  handleKey(e) {
    if (!this.container || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('.settings-modal-backdrop.is-open')) return;
    const onBoard = document.activeElement === this.el.board;
    if (onBoard && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      this.kbActive = true;
      let f = sqFile(this.cursorSq), r = sqRank(this.cursorSq);
      const dir = this.game.flipped ? -1 : 1;
      if (e.key === 'ArrowUp') r = Math.min(7, Math.max(0, r + dir));
      if (e.key === 'ArrowDown') r = Math.min(7, Math.max(0, r - dir));
      if (e.key === 'ArrowLeft') f = Math.min(7, Math.max(0, f - dir));
      if (e.key === 'ArrowRight') f = Math.min(7, Math.max(0, f + dir));
      this.cursorSq = r * 16 + f;
      if (e.key === 'Enter' || e.key === ' ') {
        const sq = this.cursorSq, p = this.pos.board[sq];
        if (this.selected >= 0 && this.legal.some(m => moveFrom(m) === this.selected && moveTo(m) === sq)) this.tryMove(this.selected, sq);
        else if (p && colorOf(p) === this.pos.turn && this.canMoveColor(colorOf(p))) this.selected = sq;
        else this.selected = -1;
      }
      this.renderSquares();
      const name = sqName(this.cursorSq), p = this.pos.board[this.cursorSq];
      this.el.board.setAttribute('aria-label', `${name}${p ? `, ${colorOf(p) === WHITE ? 'white' : 'black'} ${PIECE_NAMES[TYPE_CHAR[typeOf(p)]]}` : ', empty'}${this.selected >= 0 ? `. Selected ${sqName(this.selected)}` : ''}`);
      return;
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.navigate('prev'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.navigate('next'); }
    else if (e.key === 'Home') { e.preventDefault(); this.navigate('start'); }
    else if (e.key === 'End') { e.preventDefault(); this.navigate('end'); }
    else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) this.action('flip');
  },

  /* ---------------- clock ---------------- */
  startClock() {
    clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => {
      const g = this.game;
      if (!g?.clock || !g.clock.running || g.result || !this.container) return;
      const c = this.pos && this.atLive() ? (this.pos.turn === WHITE ? 'w' : 'b') : null;
      if (!c) return;
      const now = Date.now();
      g.clock[c] -= now - (g.clock.stamp || now);
      g.clock.stamp = now;
      if (g.clock[c] <= 0) {
        g.clock[c] = 0;
        // a flag loses unless the opponent has no way to ever checkmate
        const opp = c === 'w' ? BLACK : WHITE;
        const canMate = this.sideCanMate(opp);
        const loser = c === 'w' ? 'White' : 'Black';
        if (canMate) this.finish(c === 'w' ? '0-1' : '1-0', 'time', { loser });
        else this.finish('1/2-1/2', 'time-draw', { loser });
        this.saveGame(); this.renderAll();
        if (this.prefs.sounds) tick('end');
        return;
      }
      const el = this.container.querySelector(`[data-clock="${c}"]`);
      if (el) { el.textContent = fmtClock(g.clock[c]); el.classList.toggle('low', g.clock[c] < 20000); }
    }, 200);
  },
  sideCanMate(color) {
    const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.pos.board[s];
      if (p && colorOf(p) === color && typeOf(p) !== KING) counts[TYPE_CHAR[typeOf(p)]]++;
    }
    return counts.p + counts.r + counts.q > 0 || counts.n + counts.b >= 2;
  },
};

function fmtClock(ms) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  if (ms < 10000) return `0:${(ms / 1000).toFixed(1).padStart(4, '0')}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function icon(name) {
  const p = {
    first: '<path d="M6 5v14M18 6l-7 6 7 6z"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    last: '<path d="M18 5v14M6 6l7 6-7 6z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    flip: '<path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    sliders: '<line x1="4" y1="7" x2="14" y2="7"/><circle cx="16" cy="7" r="2"/><line x1="10" y1="17" x2="20" y2="17"/><circle cx="8" cy="17" r="2"/>',
  }[name];
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
