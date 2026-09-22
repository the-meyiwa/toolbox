/* ============================================================
   TOOLBOX — Chess rules engine

   Complete FIDE rules: legal move generation (pins, checks and
   discovered checks), castling through/out of/into check, en passant
   (including the horizontal-pin case), promotion to any piece,
   checkmate, stalemate, the 50- and 75-move rules, threefold and
   fivefold repetition, and insufficient material. FEN and SAN in and
   out, PGN export. Verified by perft against the standard test
   positions (tests/chess-perft.mjs).

   Board: 0x88. Square = rank * 16 + file, rank 0 = White's first rank.
   Piece = type | colour, type 1..6 (P N B R Q K), colour 0 White, 8 Black.
   Move = from | to << 7 | promo << 14 | flags << 17 (all small ints).
   ============================================================ */

export const WHITE = 0, BLACK = 8;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const EMPTY = 0;

export const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8, F_PROMO = 16;

const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const B_OFF = [15, 17, -15, -17];
const R_OFF = [16, 1, -16, -1];
const K_OFF = [15, 16, 17, 1, -15, -16, -17, -1];

const PIECE_CHARS = ' pnbrqk';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const typeOf = (p) => p & 7;
export const colorOf = (p) => p & 8;
export const sqFile = (s) => s & 7;
export const sqRank = (s) => s >> 4;
export const onBoard = (s) => (s & 0x88) === 0;

export const moveFrom = (m) => m & 127;
export const moveTo = (m) => (m >> 7) & 127;
export const movePromo = (m) => (m >> 14) & 7;
export const moveFlags = (m) => (m >> 17) & 31;
export const makeMove = (from, to, promo = 0, flags = 0) => from | (to << 7) | (promo << 14) | (flags << 17);

export function sqName(s) { return 'abcdefgh'[s & 7] + ((s >> 4) + 1); }
export function sqFromName(n) {
  if (!/^[a-h][1-8]$/.test(n)) return -1;
  return (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
}
/** 0x88 square → 0..63 index (a1 = 0). */
export const to64 = (s) => (s >> 4) * 8 + (s & 7);
export const from64 = (i) => (i >> 3) * 16 + (i & 7);

/* ---------- Zobrist hashing (two 32-bit halves) ---------- */
let seed = 0x9E3779B9;
function rnd32() {
  // xorshift32 — deterministic so hashes agree across the page and the worker.
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed | 0;
}
const Z_PIECE_A = new Int32Array(16 * 128), Z_PIECE_B = new Int32Array(16 * 128);
for (let i = 0; i < Z_PIECE_A.length; i++) { Z_PIECE_A[i] = rnd32(); Z_PIECE_B[i] = rnd32(); }
const Z_CASTLE_A = new Int32Array(16), Z_CASTLE_B = new Int32Array(16);
for (let i = 0; i < 16; i++) { Z_CASTLE_A[i] = rnd32(); Z_CASTLE_B[i] = rnd32(); }
const Z_EP_A = new Int32Array(8), Z_EP_B = new Int32Array(8);
for (let i = 0; i < 8; i++) { Z_EP_A[i] = rnd32(); Z_EP_B[i] = rnd32(); }
const Z_SIDE_A = rnd32(), Z_SIDE_B = rnd32();

/* Castling-rights mask per square: moving from/to these squares clears rights. */
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0x00] = 15 & ~CASTLE_WQ; CASTLE_MASK[0x07] = 15 & ~CASTLE_WK; CASTLE_MASK[0x04] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[0x70] = 15 & ~CASTLE_BQ; CASTLE_MASK[0x77] = 15 & ~CASTLE_BK; CASTLE_MASK[0x74] = 15 & ~(CASTLE_BK | CASTLE_BQ);

export class Position {
  constructor(fen = START_FEN) {
    this.board = new Int8Array(128);
    this.kings = [0, 0];            // index 0 white, 1 black
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.hashA = 0; this.hashB = 0;
    this.stack = [];                // undo records
    this.history = [];              // hash keys of every position reached, for repetition
    this.load(fen);
  }

  clone() {
    const p = Object.create(Position.prototype);
    p.board = this.board.slice();
    p.kings = this.kings.slice();
    p.turn = this.turn; p.castling = this.castling; p.ep = this.ep;
    p.halfmove = this.halfmove; p.fullmove = this.fullmove;
    p.hashA = this.hashA; p.hashB = this.hashB;
    p.stack = [];
    p.history = this.history.slice();
    return p;
  }

  /* ---------- FEN ---------- */
  load(fen) {
    const parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('A FEN needs at least four fields.');
    const [placement, side, castle, ep, half = '0', full = '1'] = parts;
    const ranks = placement.split('/');
    if (ranks.length !== 8) throw new Error('A FEN board needs eight ranks.');
    this.board.fill(0);
    let wk = 0, bk = 0;
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of ranks[r]) {
        if (/[1-8]/.test(ch)) { f += +ch; continue; }
        const t = PIECE_CHARS.indexOf(ch.toLowerCase());
        if (t < 1 || f > 7) throw new Error(`Unexpected "${ch}" in the FEN board.`);
        const color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const sq = (7 - r) * 16 + f;
        this.board[sq] = t | color;
        if (t === KING) { if (color === WHITE) { wk++; this.kings[0] = sq; } else { bk++; this.kings[1] = sq; } }
        f++;
      }
      if (f !== 8) throw new Error(`Rank ${8 - r} does not have eight squares.`);
    }
    if (wk !== 1 || bk !== 1) throw new Error('Each side needs exactly one king.');
    if (side !== 'w' && side !== 'b') throw new Error('Side to move must be "w" or "b".');
    this.turn = side === 'w' ? WHITE : BLACK;
    this.castling = 0;
    if (castle !== '-') for (const c of castle) {
      const bit = { K: CASTLE_WK, Q: CASTLE_WQ, k: CASTLE_BK, q: CASTLE_BQ }[c];
      if (!bit) throw new Error('Castling field must use K, Q, k, q or "-".');
      this.castling |= bit;
    }
    // Drop rights the board cannot support.
    if (this.board[0x04] !== (KING | WHITE)) this.castling &= ~(CASTLE_WK | CASTLE_WQ);
    if (this.board[0x07] !== (ROOK | WHITE)) this.castling &= ~CASTLE_WK;
    if (this.board[0x00] !== (ROOK | WHITE)) this.castling &= ~CASTLE_WQ;
    if (this.board[0x74] !== (KING | BLACK)) this.castling &= ~(CASTLE_BK | CASTLE_BQ);
    if (this.board[0x77] !== (ROOK | BLACK)) this.castling &= ~CASTLE_BK;
    if (this.board[0x70] !== (ROOK | BLACK)) this.castling &= ~CASTLE_BQ;
    this.ep = ep === '-' ? -1 : sqFromName(ep);
    this.halfmove = Math.max(0, parseInt(half, 10) || 0);
    this.fullmove = Math.max(1, parseInt(full, 10) || 1);
    // A king the side to move could capture is not a legal position.
    const them = this.turn ^ 8;
    if (this.isAttacked(this.kings[them === WHITE ? 0 : 1], this.turn)) throw new Error('The side not to move is in check — that position cannot occur.');
    this.computeHash();
    this.stack = [];
    this.history = [this.key()];
    return this;
  }

  fen() {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        const ch = PIECE_CHARS[typeOf(p)];
        out += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    let c = '';
    if (this.castling & CASTLE_WK) c += 'K';
    if (this.castling & CASTLE_WQ) c += 'Q';
    if (this.castling & CASTLE_BK) c += 'k';
    if (this.castling & CASTLE_BQ) c += 'q';
    return `${out} ${this.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${this.epForFen()} ${this.halfmove} ${this.fullmove}`;
  }

  /** En-passant square only when a capture there is actually possible (keeps FEN and repetition exact). */
  epForFen() { return this.epCapturable() ? sqName(this.ep) : '-'; }
  epCapturable() {
    if (this.ep < 0) return false;
    const us = this.turn, pawn = PAWN | us;
    const dir = us === WHITE ? -16 : 16;
    for (const d of [dir - 1, dir + 1]) {
      const s = this.ep + d;
      if (onBoard(s) && this.board[s] === pawn) return true;
    }
    return false;
  }

  computeHash() {
    let a = 0, b = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s];
      if (p) { a ^= Z_PIECE_A[p * 128 + s]; b ^= Z_PIECE_B[p * 128 + s]; }
    }
    a ^= Z_CASTLE_A[this.castling]; b ^= Z_CASTLE_B[this.castling];
    if (this.epCapturable()) { a ^= Z_EP_A[this.ep & 7]; b ^= Z_EP_B[this.ep & 7]; }
    if (this.turn === BLACK) { a ^= Z_SIDE_A; b ^= Z_SIDE_B; }
    this.hashA = a; this.hashB = b;
  }
  key() { return `${this.hashA >>> 0}:${this.hashB >>> 0}`; }

  /* ---------- attacks ---------- */
  /** Is square `sq` attacked by any piece of colour `by`? */
  isAttacked(sq, by) {
    const b = this.board;
    // pawns
    if (by === WHITE) {
      if (onBoard(sq - 15) && b[sq - 15] === (PAWN | WHITE)) return true;
      if (onBoard(sq - 17) && b[sq - 17] === (PAWN | WHITE)) return true;
    } else {
      if (onBoard(sq + 15) && b[sq + 15] === (PAWN | BLACK)) return true;
      if (onBoard(sq + 17) && b[sq + 17] === (PAWN | BLACK)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const s = sq + N_OFF[i];
      if (onBoard(s) && b[s] === (KNIGHT | by)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const s = sq + K_OFF[i];
      if (onBoard(s) && b[s] === (KING | by)) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = B_OFF[i];
      for (let s = sq + d; onBoard(s); s += d) {
        const p = b[s];
        if (!p) continue;
        if (colorOf(p) === by && (typeOf(p) === BISHOP || typeOf(p) === QUEEN)) return true;
        break;
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = R_OFF[i];
      for (let s = sq + d; onBoard(s); s += d) {
        const p = b[s];
        if (!p) continue;
        if (colorOf(p) === by && (typeOf(p) === ROOK || typeOf(p) === QUEEN)) return true;
        break;
      }
    }
    return false;
  }

  inCheck(color = this.turn) {
    return this.isAttacked(this.kings[color === WHITE ? 0 : 1], color ^ 8);
  }

  /* ---------- move generation ---------- */
  /** Pseudo-legal moves (may leave own king in check). `capturesOnly` for quiescence. */
  pseudoMoves(out = [], capturesOnly = false) {
    const b = this.board, us = this.turn, them = us ^ 8;
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) { from += 7; continue; }
      const p = b[from];
      if (!p || colorOf(p) !== us) continue;
      const t = typeOf(p);
      if (t === PAWN) {
        const fwd = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const promoRank = us === WHITE ? 7 : 0;
        const one = from + fwd;
        if (onBoard(one) && !b[one]) {
          if (sqRank(one) === promoRank) {
            for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(makeMove(from, one, pr, F_PROMO));
          } else if (!capturesOnly) {
            out.push(makeMove(from, one));
            const two = one + fwd;
            if (sqRank(from) === startRank && !b[two]) out.push(makeMove(from, two, 0, F_DOUBLE));
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const to = from + d;
          if (!onBoard(to)) continue;
          const target = b[to];
          if (target && colorOf(target) === them) {
            if (sqRank(to) === promoRank) {
              for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(makeMove(from, to, pr, F_CAPTURE | F_PROMO));
            } else out.push(makeMove(from, to, 0, F_CAPTURE));
          } else if (to === this.ep && !target) {
            out.push(makeMove(from, to, 0, F_CAPTURE | F_EP));
          }
        }
      } else if (t === KNIGHT || t === KING) {
        const offs = t === KNIGHT ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const to = from + offs[i];
          if (!onBoard(to)) continue;
          const target = b[to];
          if (!target) { if (!capturesOnly) out.push(makeMove(from, to)); }
          else if (colorOf(target) === them) out.push(makeMove(from, to, 0, F_CAPTURE));
        }
        if (t === KING && !capturesOnly) this.castleMoves(from, out);
      } else {
        const dirs = t === BISHOP ? B_OFF : t === ROOK ? R_OFF : K_OFF;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i];
          for (let to = from + d; onBoard(to); to += d) {
            const target = b[to];
            if (!target) { if (!capturesOnly) out.push(makeMove(from, to)); continue; }
            if (colorOf(target) === them) out.push(makeMove(from, to, 0, F_CAPTURE));
            break;
          }
        }
      }
    }
    return out;
  }

  castleMoves(from, out) {
    const b = this.board, us = this.turn, them = us ^ 8;
    if (us === WHITE && from === 0x04) {
      if ((this.castling & CASTLE_WK) && !b[0x05] && !b[0x06] && b[0x07] === (ROOK | WHITE)
        && !this.isAttacked(0x04, them) && !this.isAttacked(0x05, them) && !this.isAttacked(0x06, them))
        out.push(makeMove(0x04, 0x06, 0, F_CASTLE));
      if ((this.castling & CASTLE_WQ) && !b[0x03] && !b[0x02] && !b[0x01] && b[0x00] === (ROOK | WHITE)
        && !this.isAttacked(0x04, them) && !this.isAttacked(0x03, them) && !this.isAttacked(0x02, them))
        out.push(makeMove(0x04, 0x02, 0, F_CASTLE));
    } else if (us === BLACK && from === 0x74) {
      if ((this.castling & CASTLE_BK) && !b[0x75] && !b[0x76] && b[0x77] === (ROOK | BLACK)
        && !this.isAttacked(0x74, them) && !this.isAttacked(0x75, them) && !this.isAttacked(0x76, them))
        out.push(makeMove(0x74, 0x76, 0, F_CASTLE));
      if ((this.castling & CASTLE_BQ) && !b[0x73] && !b[0x72] && !b[0x71] && b[0x70] === (ROOK | BLACK)
        && !this.isAttacked(0x74, them) && !this.isAttacked(0x73, them) && !this.isAttacked(0x72, them))
        out.push(makeMove(0x74, 0x72, 0, F_CASTLE));
    }
  }

  legalMoves() {
    const pseudo = this.pseudoMoves([]);
    const legal = [];
    const us = this.turn;
    for (const m of pseudo) {
      this.make(m);
      if (!this.inCheck(us)) legal.push(m);
      this.unmake();
    }
    return legal;
  }

  /* ---------- make / unmake ---------- */
  make(m) {
    const b = this.board;
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = (m >> 17) & 31;
    const piece = b[from], us = this.turn, them = us ^ 8;
    let captured = b[to], capSq = to;
    if (flags & F_EP) { capSq = us === WHITE ? to - 16 : to + 16; captured = b[capSq]; }

    this.stack.push({ m, captured, capSq, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashA: this.hashA, hashB: this.hashB });

    let a = this.hashA, h = this.hashB;
    // remove old ep / castling contributions
    if (this.epCapturable()) { a ^= Z_EP_A[this.ep & 7]; h ^= Z_EP_B[this.ep & 7]; }
    a ^= Z_CASTLE_A[this.castling]; h ^= Z_CASTLE_B[this.castling];

    if (captured) { b[capSq] = 0; a ^= Z_PIECE_A[captured * 128 + capSq]; h ^= Z_PIECE_B[captured * 128 + capSq]; }
    b[from] = 0; a ^= Z_PIECE_A[piece * 128 + from]; h ^= Z_PIECE_B[piece * 128 + from];
    const placed = promo ? (promo | us) : piece;
    b[to] = placed; a ^= Z_PIECE_A[placed * 128 + to]; h ^= Z_PIECE_B[placed * 128 + to];

    if (flags & F_CASTLE) {
      let rf, rt;
      if (to === from + 2) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      const rook = b[rf];
      b[rf] = 0; b[rt] = rook;
      a ^= Z_PIECE_A[rook * 128 + rf] ^ Z_PIECE_A[rook * 128 + rt];
      h ^= Z_PIECE_B[rook * 128 + rf] ^ Z_PIECE_B[rook * 128 + rt];
    }
    if (typeOf(piece) === KING) this.kings[us === WHITE ? 0 : 1] = to;

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = (flags & F_DOUBLE) ? (from + to) >> 1 : -1;
    this.halfmove = (typeOf(piece) === PAWN || captured) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = them;

    a ^= Z_CASTLE_A[this.castling]; h ^= Z_CASTLE_B[this.castling];
    a ^= Z_SIDE_A; h ^= Z_SIDE_B;
    this.hashA = a; this.hashB = h;
    if (this.epCapturable()) { this.hashA ^= Z_EP_A[this.ep & 7]; this.hashB ^= Z_EP_B[this.ep & 7]; }
    this.history.push(this.key());
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return;
    this.history.pop();
    const b = this.board, m = u.m;
    const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = (m >> 17) & 31;
    this.turn ^= 8;
    const us = this.turn;
    const moved = b[to];
    b[from] = promo ? (PAWN | us) : moved;
    b[to] = 0;
    if (u.captured) b[u.capSq] = u.captured;
    if (flags & F_CASTLE) {
      let rf, rt;
      if (to === from + 2) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (typeOf(b[from]) === KING) this.kings[us === WHITE ? 0 : 1] = from;
    this.castling = u.castling; this.ep = u.ep; this.halfmove = u.halfmove;
    if (us === BLACK) this.fullmove--;
    this.hashA = u.hashA; this.hashB = u.hashB;
  }

  /** Null move for search (pass the turn). */
  makeNull() {
    this.stack.push({ m: 0, nul: true, captured: 0, capSq: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashA: this.hashA, hashB: this.hashB });
    if (this.epCapturable()) { this.hashA ^= Z_EP_A[this.ep & 7]; this.hashB ^= Z_EP_B[this.ep & 7]; }
    this.ep = -1;
    this.turn ^= 8;
    this.hashA ^= Z_SIDE_A; this.hashB ^= Z_SIDE_B;
    this.history.push(this.key());
  }
  unmakeNull() {
    const u = this.stack.pop();
    this.history.pop();
    this.turn ^= 8;
    this.ep = u.ep; this.halfmove = u.halfmove; this.castling = u.castling;
    this.hashA = u.hashA; this.hashB = u.hashB;
  }

  /* ---------- game-state queries ---------- */
  repetitionCount() {
    const k = this.history[this.history.length - 1];
    let n = 0;
    // Only positions since the last irreversible move can repeat.
    const start = Math.max(0, this.history.length - 1 - this.halfmove);
    for (let i = this.history.length - 1; i >= start; i -= 1) if (this.history[i] === k) n++;
    return n;
  }

  insufficientMaterial() {
    const minors = []; // [type, squareColour]
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s];
      if (!p) continue;
      const t = typeOf(p);
      if (t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push([t, colorOf(p), (sqFile(s) + sqRank(s)) & 1]);
    }
    if (minors.length === 0) return true;                       // K v K
    if (minors.length === 1) return true;                       // K+N v K, K+B v K
    // Any number of bishops, all on the same square colour, and nothing else: no mate is possible.
    if (minors.every(m => m[0] === BISHOP) && minors.every(m => m[2] === minors[0][2])) return true;
    return false;
  }

  /**
   * Full game status.
   * over: automatic end. claimable: a draw the player may claim (50-move, threefold).
   */
  status() {
    const moves = this.legalMoves();
    const check = this.inCheck();
    if (!moves.length) {
      return check
        ? { over: true, result: this.turn === WHITE ? '0-1' : '1-0', reason: 'checkmate', check, moves }
        : { over: true, result: '1/2-1/2', reason: 'stalemate', check, moves };
    }
    if (this.insufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient material', check, moves };
    const reps = this.repetitionCount();
    if (reps >= 5) return { over: true, result: '1/2-1/2', reason: 'fivefold repetition', check, moves };
    if (this.halfmove >= 150) return { over: true, result: '1/2-1/2', reason: '75-move rule', check, moves };
    const claimable = reps >= 3 ? 'threefold repetition' : this.halfmove >= 100 ? '50-move rule' : null;
    return { over: false, check, moves, claimable };
  }

  /* ---------- notation ---------- */
  toSan(m, legal = this.legalMoves()) {
    const from = moveFrom(m), to = moveTo(m), flags = moveFlags(m), promo = movePromo(m);
    const piece = this.board[from], t = typeOf(piece);
    let san;
    if (flags & F_CASTLE) san = to > from ? 'O-O' : 'O-O-O';
    else {
      const cap = (flags & F_CAPTURE) !== 0;
      if (t === PAWN) {
        san = (cap ? 'abcdefgh'[sqFile(from)] + 'x' : '') + sqName(to);
        if (promo) san += '=' + 'NBRQ'[[KNIGHT, BISHOP, ROOK, QUEEN].indexOf(promo)];
      } else {
        const letter = ' PNBRQK'[t];
        const rivals = legal.filter(o => o !== m && moveTo(o) === to && this.board[moveFrom(o)] === piece);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some(o => sqFile(moveFrom(o)) === sqFile(from));
          const sameRank = rivals.some(o => sqRank(moveFrom(o)) === sqRank(from));
          if (!sameFile) dis = 'abcdefgh'[sqFile(from)];
          else if (!sameRank) dis = String(sqRank(from) + 1);
          else dis = sqName(from);
        }
        san = letter + dis + (cap ? 'x' : '') + sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck()) san += this.legalMoves().length ? '+' : '#';
    this.unmake();
    return san;
  }

  /** Parse SAN (tolerant: accepts "e8Q", "0-0", missing +/#, "Nb1c3"). Returns a move or 0. */
  fromSan(text) {
    const s = String(text).trim().replace(/[+#?!]+$/g, '').replace(/0/g, 'O');
    const legal = this.legalMoves();
    for (const m of legal) {
      const san = this.toSan(m, legal).replace(/[+#]$/, '');
      if (san === s || san.replace('=', '') === s.replace('=', '')) return m;
    }
    // long algebraic / UCI fallback: e2e4, e7e8q
    const uci = /^([a-h][1-8])-?([a-h][1-8])([qrbnQRBN]?)$/.exec(s);
    if (uci) {
      const from = sqFromName(uci[1]), to = sqFromName(uci[2]);
      const pr = uci[3] ? ' pnbrqk'.indexOf(uci[3].toLowerCase()) : 0;
      return legal.find(m => moveFrom(m) === from && moveTo(m) === to && (!movePromo(m) || movePromo(m) === (pr || QUEEN))) || 0;
    }
    // piece move with explicit origin: Ng1f3
    const long = /^([NBRQK])([a-h][1-8])x?([a-h][1-8])$/.exec(s);
    if (long) {
      const from = sqFromName(long[2]), to = sqFromName(long[3]);
      return legal.find(m => moveFrom(m) === from && moveTo(m) === to) || 0;
    }
    return 0;
  }

  toUci(m) {
    const p = movePromo(m);
    return sqName(moveFrom(m)) + sqName(moveTo(m)) + (p ? ' pnbrqk'[p] : '');
  }

  materialCount() {
    const vals = [0, 1, 3, 3, 5, 9, 0];
    const m = { w: 0, b: 0, pieces: { w: [], b: [] } };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s];
      if (!p) continue;
      const side = colorOf(p) === WHITE ? 'w' : 'b';
      m[side] += vals[typeOf(p)];
      m.pieces[side].push(typeOf(p));
    }
    return m;
  }

  pieceAt(sq) { return this.board[sq]; }
}

/* ---------- perft (move-generator self test) ---------- */
export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = pos.pseudoMoves([]);
  const us = pos.turn;
  let n = 0;
  for (const m of moves) {
    pos.make(m);
    if (!pos.inCheck(us)) n += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

/* ---------- PGN ---------- */
export function toPgn({ sans, result = '*', white = 'White', black = 'Black', startFen = START_FEN, date = new Date() }) {
  const d = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  const tags = [
    ['Event', 'Toolbox game'], ['Site', 'Toolbox'], ['Date', d], ['Round', '-'],
    ['White', white], ['Black', black], ['Result', result],
  ];
  if (startFen !== START_FEN) tags.push(['SetUp', '1'], ['FEN', startFen]);
  const head = tags.map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const startPos = new Position(startFen);
  let num = startPos.fullmove, black_ = startPos.turn === BLACK;
  let body = '';
  sans.forEach((san, i) => {
    if (i === 0 && black_) body += `${num}... `;
    else if (!black_) body += `${num}. `;
    body += san + ' ';
    if (black_) num++;
    black_ = !black_;
  });
  // wrap at 80 columns
  const words = (body + result).split(' ');
  const lines = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).length > 80) { lines.push(line.trim()); line = ''; } line += ' ' + w; }
  lines.push(line.trim());
  return `${head}\n\n${lines.join('\n')}\n`;
}

/** Parse PGN movetext → { startFen, sans, tags }. Ignores comments, NAGs and variations. */
export function parsePgn(text) {
  const tags = {};
  for (const m of String(text).matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) tags[m[1]] = m[2];
  let body = String(text).replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  // strip variations (nested)
  let prev;
  do { prev = body; body = body.replace(/\([^()]*\)/g, ' '); } while (body !== prev);
  body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ');
  const tokens = body.split(/\s+/).filter(Boolean);
  const startFen = tags.FEN || START_FEN;
  const pos = new Position(startFen);
  const moves = [];
  for (const tok of tokens) {
    const m = pos.fromSan(tok);
    if (!m) throw new Error(`"${tok}" is not a legal move in that position.`);
    moves.push(m);
    pos.make(m);
  }
  return { startFen, moves, tags };
}
