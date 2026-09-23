/* ============================================================
   TOOLBOX — Assistant capability pack

   Tools the Assistant can call on top of the core set in
   assistant-tools.js: chess (analysis, playing, opening in the
   board), the device-specs database, vehicles, notes editing,
   drawing SVG illustrations, a visible task plan for multi-step
   work, and discovery/running of any Toolbox tool.

   Each result carries `renderer` so the chat can draw a card,
   plus plain fields the model reads back.
   ============================================================ */

import { TOOLS } from '../../registry/index.js';

const lower = (v) => String(v ?? '').toLowerCase().trim();

/* ---------------- declarations (JSON Schema, lowercase types) ---------------- */

export const EXTRA_TOOL_DECLARATIONS = [
  {
    name: 'update_plan',
    description: 'Show the user a live checklist for a multi-step task. Call it at the start of any task that needs 3+ steps or several tools, then again as steps finish (mark them done), so the user can follow progress. Keep step titles short.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short name for the overall task.' },
        steps: {
          type: 'array',
          description: 'Every step in order, with its current status.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'active', 'done', 'failed', 'skipped'] },
            },
            required: ['title', 'status'],
          },
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'chess_analyze',
    description: 'Analyse a chess position with the Toolbox chess engine: evaluation, best move, principal variation, whose turn, check/checkmate/stalemate, legal moves and the opening name. Give either a FEN, a PGN, or a list of moves from the start position. Also use it to judge whether a move was a blunder by passing the moves before it and `move_to_judge`.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string', description: 'Position in FEN.' },
        pgn: { type: 'string', description: 'A game in PGN (analyses the final position).' },
        moves: { type: 'array', items: { type: 'string' }, description: 'Moves from the start position, SAN or UCI, e.g. ["e4","e5","Nf3"].' },
        move_to_judge: { type: 'string', description: 'Optional move (SAN/UCI) to classify from the given position: best / good / inaccuracy / mistake / blunder.' },
        depth: { type: 'string', enum: ['fast', 'normal', 'deep'], description: 'How long to think (default normal).' },
      },
    },
  },
  {
    name: 'chess_play',
    description: 'Play a chess move and (optionally) get the engine reply, returning the new board. Use this to play a game against the user in chat or to demonstrate lines. Illegal moves are rejected with the list of legal ones.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string', description: 'Current position FEN (default: start position).' },
        moves: { type: 'array', items: { type: 'string' }, description: 'Moves already played from the start (alternative to fen).' },
        move: { type: 'string', description: 'The move to play now (SAN or UCI). Omit to let the engine move.' },
        engine_reply: { type: 'boolean', description: 'After the move, let the engine answer (default true).' },
        level: { type: 'number', description: 'Engine strength 1-10 (default 6).' },
      },
    },
  },
  {
    name: 'chess_open_board',
    description: 'Open the Toolbox Chess board with a position or game loaded for analysis, so the user can continue on the full board.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string' },
        pgn: { type: 'string' },
        moves: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'device_specs',
    description: 'Look up specifications from the Toolbox device database (1,300+ phones, tablets, laptops, mobile chips, processors, graphics cards, smartwatches, headphones/earbuds, consoles). Returns specs, benchmark scores and Toolbox scores. Use for any question about a specific device\'s specs or for "best X" rankings.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Device name, e.g. "iPhone 17 Pro", "RTX 4070", "Snapdragon 8 Elite".' },
        category: { type: 'string', enum: ['phones', 'tablets', 'laptops', 'socs', 'cpus', 'gpus', 'watches', 'audio', 'consoles'], description: 'Optional category to search.' },
        rank_by: { type: 'string', description: 'Optional: return the top devices in the category sorted by this (score, price, battery, gb6m, timespy …) instead of searching.' },
        limit: { type: 'number', description: 'Max results (default 5, max 15).' },
      },
    },
  },
  {
    name: 'device_compare',
    description: 'Compare two devices head to head (scores, reasons each wins, key specs) and show a comparison card. Opens nicely in Tech Device Comparisons.',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'string', description: 'First device name.' },
        b: { type: 'string', description: 'Second device name.' },
        category: { type: 'string', description: 'Optional category if ambiguous.' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'vehicle_lookup',
    description: 'Find information about a car or vehicle: decode a VIN (NHTSA), list models for a make/model search with an encyclopedia summary and photo, and any detailed Toolbox vehicle package (3D model and spec sheet) that exists. Use for automotive specifics.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Make and model, e.g. "Toyota Corolla 2020", or a 17-character VIN.' },
        open_guide: { type: 'boolean', description: 'Also open the Automobile Guide (3D) if a package exists.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_note',
    description: 'Edit an existing note in Notes: replace its title/body or append text. Find it by id or title.',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Note id or (part of) its title.' },
        title: { type: 'string', description: 'New title (optional).' },
        body: { type: 'string', description: 'New full body (replaces). Markdown-style text is fine.' },
        append: { type: 'string', description: 'Text to add at the end instead of replacing.' },
      },
      required: ['note'],
    },
  },
  {
    name: 'draw_illustration',
    description: 'Show an illustration, diagram, icon, chart or scene you drew as SVG. Write complete, self-contained SVG markup (viewBox set, no scripts, no external images). Use it whenever the user asks you to draw, sketch, illustrate, design a logo/icon, or visualise something that is not plain data.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        svg: { type: 'string', description: 'The SVG markup.' },
        caption: { type: 'string' },
      },
      required: ['svg'],
    },
  },
  {
    name: 'find_toolbox_tools',
    description: 'Search the 130+ Toolbox tools by what they do. Returns ids, names and descriptions. Use before run_toolbox_tool or open_toolbox_tool when unsure which tool fits.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'run_toolbox_tool',
    description: 'Run a Toolbox tool headlessly on text input (e.g. word-counter, case-converter, text-diff, json-formatter, base64-codec, hash-generator, markdown-preview, csv-to-json). Returns its output. If the tool cannot run headlessly it is opened instead.',
    parameters: {
      type: 'object',
      properties: {
        tool_id: { type: 'string', description: 'Tool id from find_toolbox_tools, e.g. "json-formatter".' },
        input: { type: 'string', description: 'The text to process.' },
        options: { type: 'object', description: 'Optional tool-specific options.' },
      },
      required: ['tool_id'],
    },
  },
  {
    name: 'open_toolbox_tool',
    description: 'Open a Toolbox tool for the user (navigates the app). Use when the user wants to work in a tool themselves, or after preparing something they should continue in the full tool.',
    parameters: {
      type: 'object',
      properties: { tool_id: { type: 'string' } },
      required: ['tool_id'],
    },
  },
];

/* ---------------- chess (engine in a worker so the chat stays smooth) ---------------- */

let chessModules = null;
async function chess() {
  if (!chessModules) {
    const [engine] = await Promise.all([import('../chess/engine.js')]);
    chessModules = { engine };
  }
  return chessModules;
}

function chessWorker() {
  return new Worker(new URL('../chess/worker.js', import.meta.url), { type: 'module' });
}

function askWorker(msg, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const w = chessWorker();
    const t = setTimeout(() => { w.terminate(); reject(new Error('The chess engine took too long.')); }, timeout);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || 'Chess engine error')); };
    w.postMessage({ id: 1, ...msg });
  });
}

/** Build a position from fen / pgn / moves. Returns { pos, startFen, uci[] } */
async function positionFrom({ fen, pgn, moves }) {
  const { engine } = await chess();
  const { Position, START_FEN, parsePgn } = engine;
  let startFen = START_FEN;
  let list = [];
  if (pgn && String(pgn).trim()) {
    const parsed = parsePgn(pgn);
    startFen = parsed.startFen;
    const p = new Position(startFen);
    for (const m of parsed.moves) { list.push(p.toUci(m)); p.make(m); }
  } else {
    if (fen && String(fen).trim() && !/^start/i.test(fen)) startFen = new Position(fen).fen();
    const p = new Position(startFen);
    for (const raw of moves || []) {
      const m = p.fromSan(String(raw).trim());
      if (!m) throw new Error(`"${raw}" is not a legal move in that position (${p.fen()}).`);
      list.push(p.toUci(m)); p.make(m);
    }
  }
  const pos = new Position(startFen);
  const sans = [];
  for (const u of list) { const m = pos.fromSan(u); sans.push(pos.toSan(m)); pos.make(m); }
  return { pos, startFen, uci: list, sans };
}

function describeStatus(pos, st) {
  const side = pos.turn === 0 ? 'White' : 'Black';
  if (st.over) {
    if (st.reason === 'checkmate') return `Checkmate — ${side === 'White' ? 'Black' : 'White'} wins.`;
    return `Draw (${st.reason}).`;
  }
  return `${side} to move${st.check ? ', in check' : ''}.`;
}

const fmtEval = (cp, mate) => mate ? `mate in ${Math.abs(mate)} for ${mate > 0 ? 'White' : 'Black'}` : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)} (White's view)`;

async function chessAnalyze(args) {
  const { pos, startFen, uci, sans } = await positionFrom(args);
  const st = pos.status();
  const time = { fast: 500, normal: 1500, deep: 3500 }[args.depth] || 1500;
  const result = {
    status: 'success', renderer: 'chess-board', type: 'chess-board',
    fen: pos.fen(), startFen, moves: sans, turn: pos.turn === 0 ? 'white' : 'black',
    check: st.check, gameOver: st.over, result: st.result || null, reason: st.reason || null,
    legalMoves: st.moves.map(m => pos.toSan(m, st.moves)).slice(0, 60),
    summary: describeStatus(pos, st),
  };
  if (!st.over) {
    const a = await askWorker({ type: 'analyse', startFen, moves: uci, timeMs: time }, time + 15000);
    Object.assign(result, {
      evaluation: a.score, mate: a.mate || 0, evalText: fmtEval(a.score, a.mate),
      bestMove: a.san, bestMoveUci: a.move, principalVariation: a.pvSan?.slice(0, 8) || [], depth: a.depth,
      arrows: a.move ? [{ from: a.move.slice(0, 2), to: a.move.slice(2, 4), kind: 'best' }] : [],
    });
  }
  if (args.move_to_judge && !st.over) {
    const m = pos.fromSan(String(args.move_to_judge));
    if (!m) throw new Error(`"${args.move_to_judge}" is not legal here. Legal moves: ${result.legalMoves.join(', ')}`);
    const r = await askWorker({ type: 'review', startFen, moves: uci, played: pos.toUci(m), timeMs: time }, time * 2 + 15000);
    const loss = r.loss;
    const verdict = r.forced ? 'only move' : r.isBest ? 'best move' : loss < 0.02 ? 'excellent' : loss < 0.05 ? 'good' : loss < 0.1 ? 'inaccuracy' : loss < 0.2 ? 'mistake' : 'blunder';
    result.judgement = {
      move: pos.toSan(m), verdict, bestMove: r.best?.san, bestLine: r.best?.pvSan?.slice(0, 6),
      evalBefore: fmtEval(r.bestScore, r.best?.mate), evalAfter: fmtEval(r.playedScore, r.after?.mate),
      refutation: r.after?.pvSan?.slice(0, 4) || [], winChanceLost: Math.round(loss * 100),
    };
  }
  let opening = null;
  try {
    if (startFen === (await chess()).engine.START_FEN && sans.length) {
      const { buildBook, posKey } = await import('../chess/book.js');
      const book = new Map(buildBook().positions.map(([k, eco, name]) => [k, [eco, name]]));
      const { engine } = await chess();
      const p = new engine.Position();
      for (const u of uci) { p.make(p.fromSan(u)); const hit = book.get(posKey(p)); if (hit) opening = { eco: hit[0], name: hit[1] }; }
    }
  } catch { /* book is optional */ }
  result.opening = opening;
  result.message = `${result.summary}${result.bestMove ? ` Best move: ${result.bestMove} (${result.evalText}).` : ''}`;
  return result;
}

async function chessPlay(args) {
  const { pos, startFen, uci } = await positionFrom(args);
  const played = [];
  let st = pos.status();
  if (args.move && !st.over) {
    const m = pos.fromSan(String(args.move).trim());
    if (!m) {
      const legal = st.moves.map(x => pos.toSan(x, st.moves));
      return { status: 'error', message: `${args.move} is not legal here. ${describeStatus(pos, st)} Legal moves: ${legal.join(', ')}` };
    }
    played.push({ by: pos.turn === 0 ? 'white' : 'black', san: pos.toSan(m) });
    uci.push(pos.toUci(m)); pos.make(m); st = pos.status();
  }
  const wantReply = args.engine_reply !== false;
  if ((wantReply || !args.move) && !st.over) {
    const r = await askWorker({ type: 'play', startFen, moves: uci, level: Math.max(1, Math.min(10, Number(args.level) || 6)) });
    const m = pos.fromSan(r.move);
    played.push({ by: pos.turn === 0 ? 'white' : 'black', san: pos.toSan(m), engine: true });
    uci.push(pos.toUci(m)); pos.make(m); st = pos.status();
  }
  const { engine } = await chess();
  const replay = new engine.Position(startFen); const sans = [];
  for (const u of uci) { const m = replay.fromSan(u); sans.push(replay.toSan(m)); replay.make(m); }
  const last = uci[uci.length - 1];
  return {
    status: 'success', renderer: 'chess-board', type: 'chess-board',
    fen: pos.fen(), startFen, moves: sans, played, turn: pos.turn === 0 ? 'white' : 'black',
    check: st.check, gameOver: st.over, result: st.result || null, reason: st.reason || null,
    lastMove: last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null,
    summary: describeStatus(pos, st),
    message: `${played.map(p => `${p.by === 'white' ? 'White' : 'Black'} played ${p.san}${p.engine ? ' (engine)' : ''}`).join('. ')}. ${describeStatus(pos, st)} FEN: ${pos.fen()}`,
  };
}

async function chessOpenBoard(args) {
  const { startFen, uci, sans } = await positionFrom(args);
  const game = {
    id: Date.now(), mode: 'analysis', human: 'w', startFen,
    moves: uci.map((u, i) => ({ uci: u, san: sans[i] })), cursor: uci.length, result: null, flipped: false, clock: null,
  };
  try { localStorage.setItem('toolbox_chess_game_v1', JSON.stringify(game)); } catch { /* storage full */ }
  window.location.hash = '#chess';
  return { status: 'success', openedToolId: 'chess', message: `Opened the Chess board with ${uci.length ? `${uci.length} moves` : 'the position'} loaded for analysis.` };
}

/* ---------------- devices ---------------- */

async function devicesDb() { return import('../devices/db.js'); }

async function findDevice(name, category) {
  const db = await devicesDb();
  const cats = category && db.CATEGORIES[category] ? [category] : db.CATEGORY_ORDER;
  let best = null;
  for (const c of cats) {
    const data = await db.loadCategory(c);
    const hits = db.searchDevices(data, name, 3);
    if (!hits.length) continue;
    const h = hits[0];
    const exact = lower(h.name) === lower(name) || lower(`${h.brand} ${h.name}`) === lower(name);
    const score = (exact ? 100 : 0) + (lower(h.name).startsWith(lower(name)) ? 20 : 0) + (h._score || 0) / 10;
    if (!best || score > best.score) best = { score, device: h, data, category: c };
  }
  return best;
}

function keySpecs(db, category, d, max = 18) {
  const def = db.CATEGORIES[category];
  const out = {};
  for (const f of def.fields) {
    if (/Id$/.test(f.key) || d[f.key] == null) continue;
    out[f.label] = db.formatValue(f, d[f.key], 'metric');
    if (Object.keys(out).length >= max) break;
  }
  return out;
}

async function deviceSpecs({ query = '', category, rank_by: rankBy, limit = 5 }) {
  const db = await devicesDb();
  const n = Math.max(1, Math.min(15, Number(limit) || 5));
  if (rankBy && category && db.CATEGORIES[category]) {
    const data = await db.loadCategory(category);
    const field = db.CATEGORIES[category].fields.find(f => f.key === rankBy);
    const sub = data.scores.find(s => s.key === rankBy);
    const val = (d) => rankBy === 'score' ? d._score : sub ? d._scores[rankBy] : d[rankBy];
    let list = data.devices.filter(d => val(d) != null && (!query || d._search.includes(lower(query))));
    list.sort((a, b) => (field?.better === 'low' ? val(a) - val(b) : val(b) - val(a)));
    list = list.slice(0, n);
    return {
      status: 'success', renderer: 'device-list', type: 'device-list', category, rankBy,
      devices: list.map(d => ({ id: d.id, name: d.name, brand: d.brand, released: d.released, price: d.price, score: d._score, value: field ? db.formatValue(field, d[rankBy], 'metric') : val(d) })),
      message: `Top ${list.length} ${db.CATEGORIES[category].label.toLowerCase()} by ${field?.label || rankBy}.`,
    };
  }
  if (!query) return { status: 'error', message: 'Give a device name, or a category with rank_by.' };
  const cats = category && db.CATEGORIES[category] ? [category] : db.CATEGORY_ORDER;
  const results = [];
  for (const c of cats) {
    const data = await db.loadCategory(c);
    for (const d of db.searchDevices(data, query, n)) results.push({ d, c });
  }
  results.sort((x, y) => (lower(y.d.name).includes(lower(query)) - lower(x.d.name).includes(lower(query))) || (y.d._score || 0) - (x.d._score || 0));
  const top = results.slice(0, n);
  if (!top.length) return { status: 'error', message: `No device matching "${query}" in the Toolbox database. Try browse_web for very new or niche devices.` };
  return {
    status: 'success', renderer: 'device-list', type: 'device-list',
    devices: top.map(({ d, c }) => ({
      id: d.id, category: c, name: d.name, brand: d.brand, released: d.released, price: d.price,
      score: d._score, rank: d._rank, subScores: d._scores, specs: keySpecs(db, c, d),
    })),
    message: `Found ${top.length} device(s) for "${query}".`,
  };
}

async function deviceCompare({ a, b, category }) {
  const db = await devicesDb();
  const A = await findDevice(a, category);
  if (!A) return { status: 'error', message: `Could not find "${a}" in the device database.` };
  const B = await findDevice(b, category || A.category);
  if (!B) return { status: 'error', message: `Could not find "${b}" in the device database.` };
  if (A.category !== B.category) return { status: 'error', message: `${A.device.name} is in ${A.category} but ${B.device.name} is in ${B.category}; they can't be compared directly.` };
  const c = A.category, x = A.device, y = B.device;
  try {
    const store = JSON.parse(localStorage.getItem('toolbox_devices_v2') || '{}');
    store.cat = c; store.view = 'compare'; store.pairs = { ...(store.pairs || {}), [c]: [x.id, y.id] };
    localStorage.setItem('toolbox_devices_v2', JSON.stringify(store));
  } catch { /* storage unavailable */ }
  const specRows = db.CATEGORIES[c].fields.filter(f => !/Id$/.test(f.key) && (x[f.key] != null || y[f.key] != null)).slice(0, 40)
    .map(f => ({ label: f.label, a: db.formatValue(f, x[f.key], 'metric') || '—', b: db.formatValue(f, y[f.key], 'metric') || '—', winner: db.winner(f, x[f.key], y[f.key]) }));
  return {
    status: 'success', renderer: 'device-compare', type: 'device-compare', category: c,
    a: { id: x.id, name: x.name, brand: x.brand, score: x._score, rank: x._rank, subScores: x._scores, released: x.released, price: x.price },
    b: { id: y.id, name: y.name, brand: y.brand, score: y._score, rank: y._rank, subScores: y._scores, released: y.released, price: y.price },
    subScoreLabels: Object.fromEntries(A.data.scores.map(s => [s.key, s.label])),
    whyA: db.reasons(c, x, y, 'metric', 6).map(r => `${r.title}${r.detail ? ` (${r.detail})` : ''}`),
    whyB: db.reasons(c, y, x, 'metric', 6).map(r => `${r.title}${r.detail ? ` (${r.detail})` : ''}`),
    specs: specRows,
    openHash: '#tech-device-comparisons',
    message: `${x.name} scores ${x._score ?? '—'} and ${y.name} scores ${y._score ?? '—'} out of 100 in Toolbox's ${db.CATEGORIES[c].label.toLowerCase()} ranking.`,
  };
}

/* ---------------- vehicles ---------------- */

async function vehicleLookup({ query = '', open_guide: openGuide }) {
  const q = String(query).trim();
  const out = { status: 'success', renderer: 'vehicle', type: 'vehicle', query: q };
  if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(q)) {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(q)}?format=json`);
    const data = await res.json();
    const r = data.Results?.[0] || {};
    const pick = ['Make', 'Model', 'ModelYear', 'Trim', 'Series', 'BodyClass', 'VehicleType', 'DriveType', 'EngineCylinders', 'DisplacementL', 'EngineHP', 'FuelTypePrimary', 'TransmissionStyle', 'TransmissionSpeeds', 'Doors', 'Seats', 'PlantCountry', 'PlantCity', 'Manufacturer', 'GVWR', 'ErrorText'];
    out.vin = q.toUpperCase();
    out.decoded = Object.fromEntries(pick.filter(k => r[k] && r[k] !== 'Not Applicable').map(k => [k, r[k]]));
    out.title = [r.ModelYear, r.Make, r.Model, r.Trim].filter(Boolean).join(' ') || 'Unknown vehicle';
    out.message = `VIN ${out.vin} decodes to ${out.title}.`;
    return out;
  }
  try {
    const res = await fetch(`/api/automotive/resolve?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    out.models = (data.results || []).slice(0, 25).map(m => `${m.Make_Name} ${m.Model_Name}`);
    out.summary = data.meta?.extract || null;
    out.image = data.meta?.image || null;
    out.title = data.meta?.title || q;
  } catch { out.title = q; }
  try {
    const { autoClient } = await import('../automotive-data.js');
    const pkgs = await autoClient.searchVehicles(q);
    if (pkgs.length) {
      const p = pkgs[0];
      out.package = { id: p.id, name: `${p.manufacturer} ${p.model}`, years: p.years };
      const specs = await autoClient.getVehicleDetails(p.id, p.manufacturer, p.model);
      if (specs?.specSheet?.groups) {
        out.specSheet = specs.specSheet.groups.slice(0, 8).map(g => ({ group: g.title || g.name, rows: (g.rows || g.items || []).slice(0, 10) }));
      } else if (specs && Object.keys(specs).length) out.specifications = specs;
      if (openGuide) window.location.hash = '#automobile-guide';
    }
  } catch { /* packages are optional */ }
  out.message = [out.summary ? out.summary.slice(0, 900) : '', out.models?.length ? `Models found: ${out.models.slice(0, 12).join(', ')}.` : '', out.package ? `A detailed 3D package exists in the Automobile Guide: ${out.package.name}.` : ''].filter(Boolean).join('\n') || `No vehicle data found for "${q}".`;
  return out;
}

/* ---------------- notes ---------------- */

function updateNote({ note, title, body, append }) {
  const KEY = 'toolbox_notes_v1';
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* empty */ }
  const key = lower(note);
  const match = notes.find(n => lower(n.id) === key) || notes.find(n => lower(n.title) === key) || notes.find(n => lower(n.title).includes(key));
  if (!match) return { status: 'error', message: `No note matches "${note}".` };
  if (title) match.title = String(title).trim();
  if (typeof body === 'string') match.body = body;
  if (append) match.body = `${match.body || ''}${match.body ? '\n\n' : ''}${append}`;
  match.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent('toolbox:notes-changed', { detail: { id: match.id } }));
  return { status: 'success', renderer: 'note', type: 'note', noteId: match.id, title: match.title, body: match.body, folder: match.folder, message: `Updated note "${match.title}".` };
}

/* ---------------- illustration ---------------- */

export function sanitizeSvg(svg) {
  let s = String(svg || '').trim();
  const start = s.indexOf('<svg');
  const end = s.lastIndexOf('</svg>');
  if (start < 0 || end < 0) throw new Error('The drawing must be SVG markup starting with <svg and ending with </svg>.');
  s = s.slice(start, end + 6);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript:|https?:|data:text)[^"']*\2/gi, '');
  if (!/viewBox=/i.test(s)) {
    const w = /\swidth="(\d+(?:\.\d+)?)/.exec(s)?.[1] || 400, h = /\sheight="(\d+(?:\.\d+)?)/.exec(s)?.[1] || 300;
    s = s.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
  }
  return s;
}

/* ---------------- Toolbox tools ---------------- */

function findTools(query) {
  const terms = lower(query).split(/\s+/).filter(Boolean);
  const scored = TOOLS.map(t => {
    const hay = lower([t.id, t.name, t.description, ...(t.keywords || []), ...(t.synonyms || []), ...(t.intents || [])].join(' '));
    const s = terms.reduce((a, w) => a + (hay.includes(w) ? 1 : 0) + (lower(t.name).includes(w) ? 1 : 0), 0);
    return { t, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
  return {
    status: 'success',
    tools: scored.map(({ t }) => ({ id: t.id, name: t.name, description: t.description, category: t.category })),
    message: scored.length ? `Matching tools: ${scored.map(x => x.t.id).join(', ')}` : 'No matching tools.',
  };
}

async function runTool({ tool_id: id, input = '', options = {} }) {
  const tool = TOOLS.find(t => t.id === id || t.id === String(id).replace(/_/g, '-'));
  if (!tool) return { status: 'error', message: `No tool "${id}". Use find_toolbox_tools.` };
  try {
    const modules = import.meta.glob('../../tools/*.js');
    const loader = modules[`../../tools/${tool.id}.js`];
    const instance = loader ? (await loader()).default : null;
    if (instance?.setArtifact && instance?.getArtifact) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;visibility:hidden';
      document.body.appendChild(host);
      try {
        await instance.render(host, {});
        instance.setArtifact({ kind: 'text', text: String(input), name: 'input', ...options });
        await new Promise(r => setTimeout(r, 60));
        const out = instance.getArtifact();
        if (out) return { status: 'success', renderer: 'transform', type: 'transform', operation: tool.name, output: out.text ?? JSON.stringify(out), resultText: out.text ?? JSON.stringify(out), message: `Ran ${tool.name}.` };
      } finally { try { instance.destroy?.(); } catch { /* ignore */ } host.remove(); }
    }
  } catch (e) { /* fall through to opening the tool */ console.warn('Headless run failed', e); }
  window.location.hash = `#${tool.id}`;
  return { status: 'success', openedToolId: tool.id, message: `${tool.name} can't run inside chat, so it was opened for the user.` };
}

/* ---------------- dispatcher ---------------- */

export const EXTRA_TOOL_NAMES = new Set(EXTRA_TOOL_DECLARATIONS.map(d => d.name));

export async function executeExtraTool(name, args = {}) {
  switch (name) {
    case 'update_plan': {
      const steps = (args.steps || []).map(s => ({ title: String(s.title || ''), status: s.status || 'pending' }));
      const done = steps.filter(s => s.status === 'done').length;
      return { status: 'success', renderer: 'task-plan', type: 'task-plan', title: args.title || 'Plan', steps, message: `Plan: ${done}/${steps.length} steps done.` };
    }
    case 'chess_analyze': return chessAnalyze(args);
    case 'chess_play': return chessPlay(args);
    case 'chess_open_board': return chessOpenBoard(args);
    case 'device_specs': return deviceSpecs(args);
    case 'device_compare': return deviceCompare(args);
    case 'vehicle_lookup': return vehicleLookup(args);
    case 'update_note': return updateNote(args);
    case 'draw_illustration': {
      const svg = sanitizeSvg(args.svg);
      return { status: 'success', renderer: 'svg-illustration', type: 'svg-illustration', title: args.title || 'Illustration', caption: args.caption || '', svg, message: 'Illustration shown to the user.' };
    }
    case 'find_toolbox_tools': return findTools(args.query || '');
    case 'run_toolbox_tool': return runTool(args);
    case 'open_toolbox_tool': {
      const tool = TOOLS.find(t => t.id === args.tool_id || t.id === String(args.tool_id).replace(/_/g, '-'));
      if (!tool) return { status: 'error', message: `No tool "${args.tool_id}".` };
      window.location.hash = `#${tool.id}`;
      return { status: 'success', openedToolId: tool.id, message: `Opened ${tool.name}.` };
    }
    default: return undefined;
  }
}
