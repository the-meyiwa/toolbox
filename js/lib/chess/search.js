/* ============================================================
   TOOLBOX — Chess search & evaluation

   Alpha-beta (PVS) with iterative deepening, a transposition
   table, quiescence search, check extensions, null-move pruning,
   late-move reductions, killer and history move ordering, and
   repetition / 50-move awareness. Evaluation is tapered between
   middlegame and endgame: material, piece-square tables, pawn
   structure (passed, doubled, isolated), bishop pair, rooks on
   open files, king shelter, mobility and a mop-up term that
   drives a lone king to the edge so won endgames get converted.

   Runs inside a Web Worker (worker.js) so the board never freezes.
   ============================================================ */

import {
  Position, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  F_CAPTURE, F_PROMO, typeOf, colorOf, sqFile, sqRank,
} from './engine.js';

export const MATE = 30000;
export const MATE_BOUND = MATE - 512;
const INF = 32000;

/* ---------- evaluation tables ---------- */
const MG_VAL = [0, 100, 320, 330, 500, 900, 0];
const EG_VAL = [0, 120, 300, 320, 530, 950, 0];
const PHASE_W = [0, 0, 1, 1, 2, 4, 0];

// Written from White's point of view, rank 8 first (as you'd look at a diagram).
const T = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20],
};
const KING_MG = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20];
const KING_EG = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50];
const PASSED_MG = [0, 5, 10, 15, 25, 40, 60, 0];
const PASSED_EG = [0, 10, 20, 35, 60, 90, 130, 0];

/** Table index for a piece of `color` on 0x88 square `s`. */
const idx = (s, color) => color === WHITE ? (7 - sqRank(s)) * 8 + sqFile(s) : sqRank(s) * 8 + sqFile(s);

const B_DIRS = [15, 17, -15, -17], R_DIRS = [16, 1, -16, -1], N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];

function slide(b, s, dirs) {
  let n = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let t = s + dirs[i]; (t & 0x88) === 0; t += dirs[i]) { n++; if (b[t]) break; }
  }
  return n;
}

/** Static evaluation in centipawns from the side to move's point of view. */
export function evaluate(pos) {
  const b = pos.board;
  let mg = [0, 0], eg = [0, 0], phase = 0;
  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const bishops = [0, 0], nonPawn = [0, 0], pawnCount = [0, 0];
  const pawns = [[], []], rooks = [[], []];

  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s];
    if (!p) continue;
    const t = typeOf(p), c = colorOf(p) === WHITE ? 0 : 1, color = c ? BLACK : WHITE;
    const i = idx(s, color);
    phase += PHASE_W[t];
    if (t === KING) { mg[c] += KING_MG[i]; eg[c] += KING_EG[i]; continue; }
    mg[c] += MG_VAL[t] + T[t][i];
    eg[c] += EG_VAL[t] + (t === PAWN ? 0 : T[t][i]);
    if (t === PAWN) { pawnFiles[c][sqFile(s)]++; pawns[c].push(s); pawnCount[c]++; }
    else {
      nonPawn[c] += MG_VAL[t];
      if (t === BISHOP) { bishops[c]++; const m = slide(b, s, B_DIRS); mg[c] += (m - 6) * 3; eg[c] += (m - 6) * 3; }
      else if (t === ROOK) { rooks[c].push(s); const m = slide(b, s, R_DIRS); mg[c] += (m - 7) * 2; eg[c] += (m - 7) * 4; }
      else if (t === QUEEN) { const m = slide(b, s, B_DIRS) + slide(b, s, R_DIRS); mg[c] += (m - 13); eg[c] += (m - 13) * 2; }
      else if (t === KNIGHT) {
        let m = 0;
        for (let k = 0; k < 8; k++) { const d = s + N_OFF[k]; if ((d & 0x88) === 0 && (!b[d] || colorOf(b[d]) !== colorOf(p))) m++; }
        mg[c] += (m - 4) * 4; eg[c] += (m - 4) * 4;
      }
    }
  }

  for (let c = 0; c < 2; c++) {
    const o = 1 - c, dir = c === 0 ? 16 : -16;
    if (bishops[c] >= 2) { mg[c] += 30; eg[c] += 50; }
    // pawn structure
    for (let f = 0; f < 8; f++) {
      const n = pawnFiles[c][f];
      if (n > 1) { mg[c] -= 12 * (n - 1); eg[c] -= 20 * (n - 1); }
      if (n && !(f > 0 && pawnFiles[c][f - 1]) && !(f < 7 && pawnFiles[c][f + 1])) { mg[c] -= 12 * n; eg[c] -= 16 * n; }
    }
    for (const s of pawns[c]) {
      let passed = true;
      const f = sqFile(s);
      for (let t = s + dir; (t & 0x88) === 0 && passed; t += dir) {
        for (const df of [-1, 0, 1]) {
          const u = t + df;
          if (f + df < 0 || f + df > 7) continue;
          if (b[u] === (PAWN | (o ? BLACK : WHITE))) { passed = false; break; }
        }
      }
      if (passed) {
        const rel = c === 0 ? sqRank(s) : 7 - sqRank(s);
        mg[c] += PASSED_MG[rel]; eg[c] += PASSED_EG[rel];
        // a passer the enemy king cannot catch is worth even more in pawn endings
        if (nonPawn[o] === 0) {
          const promo = c === 0 ? 0x70 + f : f;
          const ek = pos.kings[o], dist = Math.max(Math.abs(sqFile(ek) - f), Math.abs(sqRank(ek) - sqRank(promo)));
          const toGo = 7 - rel - (rel === 1 ? 1 : 0);
          if (dist - (pos.turn === (o ? BLACK : WHITE) ? 1 : 0) > toGo) eg[c] += 400;
        }
      } else {
        eg[c] += (c === 0 ? sqRank(s) : 7 - sqRank(s)) * 4;
      }
    }
    // rooks on open / semi-open files
    for (const s of rooks[c]) {
      const f = sqFile(s);
      if (!pawnFiles[c][f]) { const bonus = pawnFiles[o][f] ? 10 : 22; mg[c] += bonus; eg[c] += bonus / 2; }
      const rel = c === 0 ? sqRank(s) : 7 - sqRank(s);
      if (rel === 6) { mg[c] += 15; eg[c] += 25; }
    }
    // king shelter (middlegame only)
    const k = pos.kings[c], kf = sqFile(k);
    let shield = 0;
    for (let df = -1; df <= 1; df++) {
      const ff = kf + df;
      if (ff < 0 || ff > 7) continue;
      for (let r = 1; r <= 2; r++) {
        const s = k + dir * r + df;
        if ((s & 0x88) === 0 && b[s] === (PAWN | (c ? BLACK : WHITE))) { shield += r === 1 ? 12 : 6; break; }
      }
      if (!pawnFiles[c][ff]) shield -= 10;
    }
    mg[c] += shield;
  }

  const p = Math.min(phase, 24);
  let score = ((mg[0] - mg[1]) * p + (eg[0] - eg[1]) * (24 - p)) / 24;

  // Mop-up: with a decisive material edge and no pawns for the defender, herd the king to a corner.
  const matW = nonPawn[0] + pawnCount[0] * 100, matB = nonPawn[1] + pawnCount[1] * 100;
  for (const [c, lead] of [[0, matW - matB], [1, matB - matW]]) {
    if (lead < 300 || p > 12) continue;
    const loser = pos.kings[1 - c], winner = pos.kings[c];
    const cf = sqFile(loser), cr = sqRank(loser);
    const centre = Math.max(3 - cf, cf - 4) + Math.max(3 - cr, cr - 4);
    const dist = Math.abs(sqFile(winner) - cf) + Math.abs(sqRank(winner) - cr);
    const bonus = centre * 12 + (14 - dist) * 5;
    score += c === 0 ? bonus : -bonus;
  }

  // Drawish material: the stronger side cannot win without pawns and more than a minor piece up.
  if (score > 0 && pawnCount[0] === 0 && nonPawn[0] - nonPawn[1] <= 330) score /= 8;
  if (score < 0 && pawnCount[1] === 0 && nonPawn[1] - nonPawn[0] <= 330) score /= 8;

  score = Math.round(score);
  return (pos.turn === WHITE ? score : -score) + 10;   // small tempo bonus
}

/* ---------- transposition table ---------- */
const TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;

class TT {
  constructor() {
    this.key = new Int32Array(TT_SIZE);
    this.move = new Int32Array(TT_SIZE);
    this.score = new Int16Array(TT_SIZE);
    this.depth = new Int8Array(TT_SIZE);
    this.flag = new Uint8Array(TT_SIZE);
  }
  clear() { this.flag.fill(0); }
}

const MVV = [0, 100, 300, 310, 500, 900, 2000];

export class Searcher {
  constructor() {
    this.tt = new TT();
    this.history = new Int32Array(16 * 128);
    this.killers = [];
    this.nodes = 0;
    this.stopAt = Infinity;
    this.stopped = false;
  }

  newGame() { this.tt.clear(); this.history.fill(0); }

  timeUp() {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.stopAt) this.stopped = true;
    return this.stopped;
  }

  isRepetition(pos) {
    const h = pos.history, k = h[h.length - 1];
    const stop = Math.max(0, h.length - 1 - pos.halfmove);
    for (let i = h.length - 3; i >= stop; i -= 2) if (h[i] === k) return true;
    return false;
  }

  orderMoves(pos, moves, ttMove, ply) {
    const b = pos.board, scores = new Int32Array(moves.length);
    const k = this.killers[ply] || [0, 0];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const from = m & 127, to = (m >> 7) & 127, flags = (m >> 17) & 31, promo = (m >> 14) & 7;
      let s;
      if (m === ttMove) s = 10000000;
      else if (flags & F_CAPTURE) s = 1000000 + MVV[typeOf(b[to]) || PAWN] * 10 - MVV[typeOf(b[from])] / 10;
      else if (flags & F_PROMO) s = promo === QUEEN ? 950000 : 0;
      else if (m === k[0]) s = 900000;
      else if (m === k[1]) s = 800000;
      else s = this.history[b[from] * 128 + to];
      scores[i] = s;
    }
    // insertion sort, descending (move lists are short)
    for (let i = 1; i < moves.length; i++) {
      const m = moves[i], s = scores[i];
      let j = i - 1;
      while (j >= 0 && scores[j] < s) { moves[j + 1] = moves[j]; scores[j + 1] = scores[j]; j--; }
      moves[j + 1] = m; scores[j + 1] = s;
    }
    return moves;
  }

  quiesce(pos, alpha, beta, ply, qdepth) {
    if (this.timeUp()) return 0;
    const inCheck = pos.inCheck();
    let best = -INF;
    if (!inCheck) {
      const stand = evaluate(pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
      if (qdepth > 10) return stand;
    } else if (qdepth > 6) return evaluate(pos);
    const moves = this.orderMoves(pos, pos.pseudoMoves([], !inCheck), 0, 63);
    const us = pos.turn;
    let legal = 0;
    for (const m of moves) {
      pos.make(m);
      if (pos.inCheck(us)) { pos.unmake(); continue; }
      legal++;
      const score = -this.quiesce(pos, -beta, -alpha, ply + 1, qdepth + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) best = score;
      if (score > alpha) { alpha = score; if (alpha >= beta) break; }
    }
    if (inCheck && !legal) return -MATE + ply;
    return best;
  }

  negamax(pos, depth, alpha, beta, ply, allowNull) {
    if (ply > 0) {
      if (pos.halfmove >= 100 || this.isRepetition(pos)) return 0;
      // mate-distance pruning
      alpha = Math.max(alpha, -MATE + ply);
      beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(pos, alpha, beta, ply, 0);
    if (this.timeUp()) return 0;

    const tt = this.tt, slot = pos.hashA & TT_MASK;
    let ttMove = 0;
    const pvNode = beta - alpha > 1;
    if (tt.key[slot] === pos.hashB && tt.flag[slot]) {
      ttMove = tt.move[slot];
      if (!pvNode && ply > 0 && tt.depth[slot] >= depth) {
        let s = tt.score[slot];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = tt.flag[slot];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    // null move: give the opponent a free move; if we are still above beta, this node is not worth searching
    if (allowNull && !pvNode && !inCheck && depth >= 3 && ply > 0) {
      let material = 0;
      for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.board[s]; if (p && colorOf(p) === pos.turn && typeOf(p) > PAWN && typeOf(p) < KING) material++; }
      if (material > 0 && evaluate(pos) >= beta) {
        pos.makeNull();
        const r = depth > 6 ? 3 : 2;
        const score = -this.negamax(pos, depth - 1 - r, -beta, -beta + 1, ply + 1, false);
        pos.unmakeNull();
        if (this.stopped) return 0;
        if (score >= beta && score < MATE_BOUND) return beta;
      }
    }

    const moves = this.orderMoves(pos, pos.pseudoMoves([]), ttMove, ply);
    const us = pos.turn, alpha0 = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      if (pos.inCheck(us)) { pos.unmake(); continue; }
      legal++;
      const quiet = !(((m >> 17) & 31) & (F_CAPTURE | F_PROMO));
      const givesCheck = pos.inCheck();
      let score;
      if (legal === 1) {
        score = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        // late-move reduction for quiet moves searched late
        let reduce = 0;
        if (depth >= 3 && quiet && !inCheck && !givesCheck && legal > 3) reduce = legal > 10 ? 2 : 1;
        score = -this.negamax(pos, depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && reduce) score = -this.negamax(pos, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) { best = score; bestMove = m; }
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (quiet) {
            const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
            if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
            const hIdx = pos.board[m & 127] * 128 + ((m >> 7) & 127);
            this.history[hIdx] = Math.min(700000, this.history[hIdx] + depth * depth);
          }
          break;
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    let stored = best;
    if (stored > MATE_BOUND) stored += ply; else if (stored < -MATE_BOUND) stored -= ply;
    tt.key[slot] = pos.hashB; tt.move[slot] = bestMove; tt.score[slot] = stored;
    tt.depth[slot] = depth; tt.flag[slot] = best >= beta ? LOWER : best > alpha0 ? EXACT : UPPER;
    return best;
  }

  /** Follow the transposition table to recover the principal variation. */
  pv(pos, first, max = 12) {
    const line = [];
    const seen = new Set();
    let m = first, made = 0;
    while (m && line.length < max) {
      const legal = pos.legalMoves();
      if (!legal.includes(m)) break;
      line.push(m); pos.make(m); made++;
      if (seen.has(pos.key())) break;
      seen.add(pos.key());
      const slot = pos.hashA & TT_MASK;
      m = this.tt.key[slot] === pos.hashB && this.tt.flag[slot] ? this.tt.move[slot] : 0;
    }
    while (made--) pos.unmake();
    return line;
  }

  /**
   * Iterative deepening. Returns { move, score, depth, pv, nodes, mate }.
   * `exclude` limits the root to one move (used to score a specific move).
   */
  search(pos, { maxDepth = 64, timeMs = 1000, only = null, onDepth = null } = {}) {
    this.nodes = 0; this.stopped = false; this.killers = [];
    this.stopAt = Date.now() + timeMs;
    let rootMoves = pos.legalMoves();
    if (only) rootMoves = rootMoves.filter(m => m === only);
    if (!rootMoves.length) {
      return { move: 0, score: pos.inCheck() ? -MATE : 0, depth: 0, pv: [], nodes: 0 };
    }
    let result = { move: rootMoves[0], score: 0, depth: 0, pv: [rootMoves[0]], nodes: 0 };
    if (rootMoves.length === 1 && !only && maxDepth > 2) maxDepth = Math.min(maxDepth, 4);

    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF, beta = INF, best = -INF, bestMove = 0;
      const slot = pos.hashA & TT_MASK;
      const ttMove = this.tt.key[slot] === pos.hashB ? this.tt.move[slot] : result.move;
      const ordered = this.orderMoves(pos, rootMoves.slice(), ttMove, 0);
      const us = pos.turn;
      let i = 0;
      for (const m of ordered) {
        pos.make(m);
        let score;
        if (i === 0) score = -this.negamax(pos, depth - 1, -beta, -alpha, 1, true);
        else {
          score = -this.negamax(pos, depth - 1, -alpha - 1, -alpha, 1, true);
          if (score > alpha && !this.stopped) score = -this.negamax(pos, depth - 1, -beta, -alpha, 1, true);
        }
        pos.unmake();
        void us;
        if (this.stopped) break;
        if (score > best) { best = score; bestMove = m; }
        if (score > alpha) alpha = score;
        i++;
      }
      if (this.stopped && depth > 1) {
        // keep a partially searched iteration only if it already found something better
        if (bestMove && best > result.score && i > 0) { result.move = bestMove; result.score = best; }
        break;
      }
      result = { move: bestMove, score: best, depth, pv: [], nodes: this.nodes };
      // store root in TT so the PV starts from it
      this.tt.key[slot] = pos.hashB; this.tt.move[slot] = bestMove; this.tt.flag[slot] = EXACT;
      this.tt.depth[slot] = depth; this.tt.score[slot] = best;
      result.pv = this.pv(pos, bestMove);
      onDepth?.(result);
      if (Math.abs(best) > MATE_BOUND && depth > 2) {
        const matePly = MATE - Math.abs(best);
        if (depth > matePly + 1) break;
      }
      if (Date.now() > this.stopAt) break;
      // do not start an iteration that surely cannot finish
      if (depth > 4 && Date.now() + (Date.now() - (this.stopAt - timeMs)) * 1.5 > this.stopAt) break;
    }
    if (!result.pv.length) result.pv = [result.move];
    result.nodes = this.nodes;
    result.mate = Math.abs(result.score) > MATE_BOUND ? Math.sign(result.score) * Math.ceil((MATE - Math.abs(result.score)) / 2) : 0;
    return result;
  }

  /** Scores every root move at a shallow depth (for weaker levels that sometimes pick a lesser move). */
  scoreRootMoves(pos, depth) {
    this.stopped = false; this.stopAt = Date.now() + 5000; this.killers = [];
    const out = [];
    for (const m of pos.legalMoves()) {
      pos.make(m);
      const s = -this.negamax(pos, depth - 1, -INF, INF, 1, true);
      pos.unmake();
      out.push({ move: m, score: s });
    }
    return out.sort((a, b) => b.score - a.score);
  }
}

/* ---------- strength levels ---------- */
export const LEVELS = [
  null,
  { depth: 1, time: 150, noise: 220 },
  { depth: 2, time: 200, noise: 150 },
  { depth: 2, time: 250, noise: 90 },
  { depth: 3, time: 300, noise: 50 },
  { depth: 4, time: 400, noise: 25 },
  { depth: 5, time: 700, noise: 10 },
  { depth: 7, time: 1000, noise: 0 },
  { depth: 9, time: 1500, noise: 0 },
  { depth: 14, time: 2200, noise: 0 },
  { depth: 64, time: 3000, noise: 0 },
];

export const REVIEW_TIME = { fast: 250, balanced: 700, deep: 1600 };

/** Chance of winning (0..1) for a centipawn score, as in common review tools. */
export function winChance(cp) {
  if (cp > MATE_BOUND) return 1;
  if (cp < -MATE_BOUND) return 0;
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

export function positionFrom(startFen, uciMoves) {
  const pos = new Position(startFen);
  for (const u of uciMoves) {
    const m = pos.fromSan(u);
    if (!m) throw new Error(`Illegal move ${u}`);
    pos.make(m);
  }
  return pos;
}

export { WHITE, BLACK };
