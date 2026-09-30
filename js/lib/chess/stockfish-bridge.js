import { Position } from './engine.js';
import { winChance } from './search.js';

/** One UCI session per bridge. Work is serialized because UCI has no request ids. */
export class StockfishBridge {
  constructor() { this.worker = null; this.queue = Promise.resolve(); this.pending = null; this.ready = null; }
  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker('/stockfish/stockfish-19-lite-single.js');
      this.worker = worker;
      const fail = error => { clearTimeout(timeout); this.startReject = null; reject(error); };
      this.startReject = fail;
      const timeout = setTimeout(() => fail(new Error('Stockfish did not start')), 12000);
      worker.onmessage = ({ data }) => {
        for (const line of String(data).split(/\r?\n/)) {
          if (line === 'uciok') { worker.postMessage('isready'); continue; }
          if (line === 'readyok') { clearTimeout(timeout); this.startReject = null; resolve(); continue; }
          this.onLine(line);
        }
      };
      worker.onerror = e => { const error = new Error(e.message || 'Stockfish failed'); fail(error); this.pending?.reject(error); this.pending = null; };
      worker.postMessage('uci');
    });
    return this.ready;
  }
  onLine(line) {
    const p = this.pending;
    if (!p) return;
    if (line.startsWith('info ') && /\bscore (cp|mate) -?\d+/.test(line)) {
      const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
      const depth = /\bdepth (\d+)/.exec(line);
      const nodes = /\bnodes (\d+)/.exec(line);
      const pv = /\bpv (.+)$/.exec(line);
      p.info = { scoreType: score[1], score: Number(score[2]), depth: Number(depth?.[1] || 0), nodes: Number(nodes?.[1] || 0), pv: pv?.[1]?.split(' ') || [] };
    }
    if (!line.startsWith('bestmove ')) return;
    clearTimeout(p.timeout);
    this.pending = null;
    const uci = line.split(' ')[1];
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) { p.reject(new Error('Stockfish found no move')); return; }
    const info = p.info || { scoreType: 'cp', score: 0, depth: 0, nodes: 0, pv: [] };
    const move = p.pos.fromSan(uci);
    const variation = p.pos.clone(), pvSan = [];
    for (const step of info.pv) { const m = variation.fromSan(step); if (!m) break; pvSan.push(variation.toSan(m)); variation.make(m); }
    const sign = p.pos.turn === 0 ? 1 : -1;
    p.resolve({ move: uci, san: move ? p.pos.toSan(move) : uci, score: info.scoreType === 'cp' ? info.score * sign : (info.score > 0 ? 30000 : -30000) * sign, mate: info.scoreType === 'mate' ? info.score * sign : 0, depth: info.depth, nodes: info.nodes, pv: info.pv, pvSan });
  }
  ask(message) {
    const run = () => message.type === 'review' ? this.review(message) : this.search(message);
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }
  async search({ startFen, moves = [], type, level = 5, timeMs = 700 }) {
    await this.start();
    const pos = new Position(startFen);
    for (const uci of moves) { const m = pos.fromSan(uci); if (!m) throw new Error(`Illegal move ${uci}`); pos.make(m); }
    const ms = type === 'play' ? Math.max(90, Math.min(1800, 100 + level * 115)) : Math.max(100, Math.min(5000, timeMs));
    this.worker.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(level * 2)))}`);
    this.worker.postMessage(`position fen ${pos.fen()}`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending = null; this.worker?.postMessage('stop'); reject(new Error('Stockfish timed out')); }, ms + 8000);
      this.pending = { resolve, reject, timeout, pos, info: null };
      this.worker.postMessage(`go movetime ${ms}`);
    });
  }
  async review({ startFen, moves = [], played, timeMs = 650 }) {
    const pos = new Position(startFen);
    for (const uci of moves) { const m = pos.fromSan(uci); if (!m) throw new Error(`Illegal move ${uci}`); pos.make(m); }
    const move = pos.fromSan(played);
    if (!move) throw new Error(`Illegal move ${played}`);
    const legalCount = pos.legalMoves().length, mover = pos.turn === 0 ? 'w' : 'b';
    const best = await this.search({ startFen, moves, type: 'analyse', level: 10, timeMs });
    pos.make(move);
    const after = pos.status().over ? null : await this.search({ startFen, moves: [...moves, played], type: 'analyse', level: 10, timeMs: Math.max(150, timeMs * .8) });
    const sign = mover === 'w' ? 1 : -1;
    const playedForMover = after ? after.score * sign : pos.inCheck() ? 30000 : 0;
    const bestForMover = Math.max(best.score * sign, playedForMover);
    return { mover, played, best, after, bestScore: bestForMover * sign, playedScore: playedForMover * sign, loss: winChance(bestForMover) - winChance(playedForMover), forced: legalCount === 1, isBest: played === best.move || bestForMover - playedForMover <= 5 };
  }
  cancel() {
    this.startReject?.(Object.assign(new Error('cancelled'), { cancelled: true }));
    if (this.pending) { clearTimeout(this.pending.timeout); this.pending.reject(Object.assign(new Error('cancelled'), { cancelled: true })); this.pending = null; }
    this.worker?.terminate(); this.worker = null; this.ready = null; this.queue = Promise.resolve();
  }
}
