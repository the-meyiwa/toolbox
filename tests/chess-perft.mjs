// Move-generator self test: node tests/chess-perft.mjs
import { Position, perft } from '../js/lib/chess/engine.js';

const CASES = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

let failed = 0;
for (const [fen, expected] of CASES) {
  const pos = new Position(fen);
  expected.forEach((want, i) => {
    const got = perft(pos, i + 1);
    if (got !== want) { failed++; console.error(`FAIL ${fen} depth ${i + 1}: ${got} (expected ${want})`); }
  });
}
console.log(failed ? `${failed} perft checks failed` : 'All perft checks passed');
process.exit(failed ? 1 : 0);
