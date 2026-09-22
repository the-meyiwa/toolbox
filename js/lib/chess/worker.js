/* Chess engine worker. One request at a time; the page terminates and
   replaces the worker to cancel, so there is no cooperative-abort plumbing. */

import { Position } from './engine.js';
import { Searcher, LEVELS, MATE_BOUND, winChance } from './search.js';
import { buildBook } from './book.js';

const searcher = new Searcher();

function build(startFen, moves) {
  const pos = new Position(startFen);
  for (const u of moves) {
    const m = pos.fromSan(u);
    if (!m) throw new Error(`Illegal move ${u}`);
    pos.make(m);
  }
  return pos;
}

const uciLine = (pos, line) => line.map(m => pos.toUci(m));
const sanLine = (pos, line) => {
  const q = pos.clone(), out = [];
  for (const m of line) { out.push(q.toSan(m)); q.make(m); }
  return out;
};
/** Score from White's point of view. */
const white = (pos, s) => (pos.turn === 0 ? s : -s);

function info(pos, r) {
  return {
    move: r.move ? pos.toUci(r.move) : null,
    san: r.move ? pos.toSan(r.move) : null,
    score: white(pos, r.score),
    mate: r.mate ? (pos.turn === 0 ? r.mate : -r.mate) : 0,
    depth: r.depth,
    nodes: r.nodes,
    pv: uciLine(pos, r.pv),
    pvSan: sanLine(pos, r.pv),
  };
}

self.onmessage = (e) => {
  const { id, type, startFen, moves = [], level = 5, timeMs = 700 } = e.data;
  try {
    if (type === 'book') { self.postMessage({ id, ok: true, result: buildBook() }); return; }
    if (type === 'newgame') { searcher.newGame(); self.postMessage({ id, ok: true }); return; }
    const pos = build(startFen, moves);

    if (type === 'play') {
      // Computer move at a given strength.
      const L = LEVELS[Math.max(1, Math.min(10, level))];
      let chosen;
      if (L.noise) {
        const scored = searcher.scoreRootMoves(pos, L.depth);
        const noisy = scored.map(x => ({ ...x, n: x.score + (Math.random() * 2 - 1) * L.noise }));
        // never blunder into a forced mate the engine can see, and always take a mate it can see
        const mateNow = scored.find(x => x.score > MATE_BOUND);
        chosen = mateNow || noisy.filter(x => x.score > -MATE_BOUND || scored.every(y => y.score <= -MATE_BOUND)).sort((a, b) => b.n - a.n)[0];
        self.postMessage({ id, ok: true, result: { move: pos.toUci(chosen.move), san: pos.toSan(chosen.move), score: white(pos, chosen.score), depth: L.depth } });
        return;
      }
      const r = searcher.search(pos, { maxDepth: L.depth, timeMs: L.time });
      self.postMessage({ id, ok: true, result: info(pos, r) });
      return;
    }

    if (type === 'analyse') {
      const r = searcher.search(pos, { timeMs });
      self.postMessage({ id, ok: true, result: info(pos, r) });
      return;
    }

    if (type === 'review') {
      // Judge the move `played` made from this position.
      const played = pos.fromSan(e.data.played);
      const legalCount = pos.legalMoves().length;
      const best = searcher.search(pos, { timeMs });
      const bestInfo = info(pos, best);
      const mover = pos.turn;
      let playedScore, afterInfo = null;
      pos.make(played);
      const after = searcher.search(pos, { timeMs: Math.max(150, timeMs * 0.8) });
      afterInfo = info(pos, after);
      playedScore = -after.score;               // from the mover's point of view
      if (!after.move) playedScore = pos.inCheck() ? 30000 : 0;   // the move mated or stalemated
      pos.unmake();
      const bestScore = played === best.move ? playedScore : Math.max(best.score, playedScore);
      const loss = winChance(bestScore) - winChance(playedScore);
      self.postMessage({
        id, ok: true,
        result: {
          mover: mover === 0 ? 'w' : 'b',
          played: pos.toUci(played),
          best: bestInfo,
          after: afterInfo,
          bestScore: white(pos, bestScore),
          playedScore: white(pos, playedScore),
          loss,
          forced: legalCount === 1,
          isBest: played === best.move || bestScore - playedScore <= 5,
        },
      });
      return;
    }
    throw new Error(`Unknown request ${type}`);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};
