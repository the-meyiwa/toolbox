/* Opening book index, built inside the engine worker (it walks ~2,000
   positions, which is too much work for the page's main thread). */
import { Position, PAWN, moveFrom, moveTo, movePromo, moveFlags, F_CAPTURE, F_CASTLE, sqName, sqFile, sqRank, typeOf } from './engine.js';
import OPENINGS from './openings.js';

export const posKey = (p) => p.fen().split(' ').slice(0, 4).join(' ');

function sanBare(pos, m, legal) {
  // SAN without the check suffix — cheap enough to run across the whole book
  const from = moveFrom(m), to = moveTo(m), flags = moveFlags(m), promo = movePromo(m);
  if (flags & F_CASTLE) return to > from ? 'O-O' : 'O-O-O';
  const piece = pos.board[from], t = typeOf(piece), cap = (flags & F_CAPTURE) !== 0;
  if (t === PAWN) return (cap ? 'abcdefgh'[sqFile(from)] + 'x' : '') + sqName(to) + (promo ? '=' + ' PNBRQK'[promo] : '');
  const rivals = legal.filter(o => o !== m && moveTo(o) === to && pos.board[moveFrom(o)] === piece);
  let dis = '';
  if (rivals.length) {
    if (!rivals.some(o => sqFile(moveFrom(o)) === sqFile(from))) dis = 'abcdefgh'[sqFile(from)];
    else if (!rivals.some(o => sqRank(moveFrom(o)) === sqRank(from))) dis = String(sqRank(from) + 1);
    else dis = sqName(from);
  }
  return ' PNBRQK'[t] + dis + (cap ? 'x' : '') + sqName(to);
}
/** → { positions: [[key, eco, name]], seen: [key] } */
export function buildBook() {
  const BOOK_POS = new Map(), BOOK_SEEN = new Set();
  const root = { kids: new Map(), end: null };
  for (const [eco, name, line] of OPENINGS) {
    let node = root;
    for (const san of line.split(' ')) {
      const key = san.replace(/[+#]$/, '');
      if (!node.kids.has(key)) node.kids.set(key, { kids: new Map(), end: null });
      node = node.kids.get(key);
    }
    if (!node.end) node.end = [eco, name];
  }
  const pos = new Position();
  const walk = (node) => {
    const legal = pos.legalMoves();
    const bySan = new Map(legal.map(m => [sanBare(pos, m, legal), m]));
    for (const [san, child] of node.kids) {
      const m = bySan.get(san);
      if (!m) continue;
      pos.make(m);
      const k = posKey(pos);
      BOOK_SEEN.add(k);
      if (child.end && !BOOK_POS.has(k)) BOOK_POS.set(k, child.end);
      walk(child);
      pos.unmake();
    }
  };
  walk(root);
  return { positions: [...BOOK_POS].map(([k, v]) => [k, ...v]), seen: [...BOOK_SEEN] };
}
