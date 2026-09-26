/* ============================================================
   Spreadsheet formulas for Ledger.

   A small, self-contained evaluator: references (A1, $A$1, A1:B9,
   Sheet2!A1, 'My sheet'!A1:C3), arithmetic, comparison, text joining,
   and the functions people reach for most. Anything it does not know
   evaluates to #NAME?, and Ledger then shows the value the file was
   saved with instead, so an unfamiliar function never blanks a cell.
   ============================================================ */

export class FormulaError {
  constructor(code) { this.code = code; }
  toString() { return this.code; }
}
const ERR = {
  DIV0: new FormulaError('#DIV/0!'), VALUE: new FormulaError('#VALUE!'), REF: new FormulaError('#REF!'),
  NAME: new FormulaError('#NAME?'), NA: new FormulaError('#N/A'), NUM: new FormulaError('#NUM!'), CIRC: new FormulaError('#CIRC!'),
};
export const ERRORS = ERR;
export const isError = (v) => v instanceof FormulaError;

/* ---------------- references ---------------- */

export function colToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function parseRef(ref) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(ref).trim());
  if (!m) return null;
  return { r: parseInt(m[2], 10) - 1, c: colToIndex(m[1]) };
}

export const refName = (r, c) => `${indexToCol(c)}${r + 1}`;

/* ---------------- tokenizer ---------------- */

const TOKEN = /\s*(?:("(?:[^"]|"")*")|('(?:[^']|'')+'!|[A-Za-z_][\w.]*!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![\w(])|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][\w.]*)\s*(\()|(TRUE|FALSE)\b|(<>|<=|>=|[-+*/^&=<>%(),:;]))/iy;

function tokenize(src) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw ERR.NAME;
    pos = TOKEN.lastIndex;
    if (m[1] != null) tokens.push({ t: 'str', v: m[1].slice(1, -1).replace(/""/g, '"') });
    else if (m[3] != null) {
      let sheet = null;
      if (m[2]) sheet = m[2].slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'");
      tokens.push({ t: 'ref', v: m[3].replace(/\$/g, '').toUpperCase(), sheet });
    } else if (m[4] != null) tokens.push({ t: 'num', v: parseFloat(m[4]) });
    else if (m[5] != null) tokens.push({ t: 'fn', v: m[5].toUpperCase() });
    else if (m[7] != null) tokens.push({ t: 'bool', v: m[7].toUpperCase() === 'TRUE' });
    else if (m[8] != null) tokens.push({ t: 'op', v: m[8] === ';' ? ',' : m[8] });
  }
  return tokens;
}

/* ---------------- parser (precedence climbing) ---------------- */

function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expect = (v) => { const t = next(); if (!t || t.v !== v) throw ERR.VALUE; };

  const primary = () => {
    const t = next();
    if (!t) throw ERR.VALUE;
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'bool') return { k: 'bool', v: t.v };
    if (t.t === 'ref') return { k: 'ref', v: t.v, sheet: t.sheet };
    if (t.t === 'fn') {
      const args = [];
      if (peek()?.v !== ')') {
        do { args.push(peek()?.v === ',' || peek()?.v === ')' ? { k: 'empty' } : expr(0)); } while (peek()?.v === ',' && next());
      }
      expect(')');
      return { k: 'call', name: t.v, args };
    }
    if (t.v === '(') { const e = expr(0); expect(')'); return e; }
    if (t.v === '-') return { k: 'neg', e: expr(6) };
    if (t.v === '+') return expr(6);
    throw ERR.VALUE;
  };

  const BIN = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  const expr = (minPrec) => {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t?.v === '%' && t.t === 'op') { next(); left = { k: 'pct', e: left }; continue; }
      const prec = t?.t === 'op' ? BIN[t.v] : undefined;
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = expr(prec + 1); // Left-associative throughout, as spreadsheets do (2^3^2 = 64).
      left = { k: 'bin', op: t.v, a: left, b: right };
    }
    return left;
  };

  const tree = expr(0);
  if (i < tokens.length) throw ERR.VALUE;
  return tree;
}

const cache = new Map();
export function compile(formula) {
  const src = String(formula).replace(/^=/, '');
  if (cache.has(src)) return cache.get(src);
  let tree;
  try { tree = parse(tokenize(src)); } catch (e) { tree = { k: 'err', e: isError(e) ? e : ERR.VALUE }; }
  if (cache.size > 5000) cache.clear();
  cache.set(src, tree);
  return tree;
}

/* ---------------- evaluation ---------------- */

class Range {
  constructor(values) { this.values = values; } // 2D
  flat() { return this.values.flat(); }
}

const num = (v) => {
  if (isError(v)) throw v;
  if (v instanceof Range) v = v.values[0]?.[0];
  if (v === '' || v == null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime() / 86400000 + 25569;
  const n = Number(String(v).replace(/,/g, '').trim());
  if (Number.isNaN(n)) throw ERR.VALUE;
  return n;
};
const str = (v) => {
  if (isError(v)) throw v;
  if (v instanceof Range) v = v.values[0]?.[0];
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
  return String(v);
};
const bool = (v) => {
  if (isError(v)) throw v;
  if (v instanceof Range) v = v.values[0]?.[0];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') { if (/^true$/i.test(v)) return true; if (/^false$/i.test(v) || v === '') return false; }
  if (v == null) return false;
  throw ERR.VALUE;
};
/** Numbers in arguments, the way SUM counts them: ranges skip text and blanks. */
const numbers = (args) => {
  const out = [];
  for (const a of args) {
    if (a instanceof Range) { for (const v of a.flat()) { if (isError(v)) throw v; if (typeof v === 'number') out.push(v); } }
    else out.push(num(a));
  }
  return out;
};
const values = (args) => args.flatMap(a => (a instanceof Range ? a.flat() : [a]));

function criteria(test) {
  if (typeof test === 'number') return (v) => typeof v === 'number' ? v === test : String(v) === String(test);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(String(test ?? ''));
  const op = m[1] || '=';
  const rhs = m[2];
  const n = rhs !== '' && !Number.isNaN(Number(rhs)) ? Number(rhs) : null;
  const pattern = n == null && /[*?]/.test(rhs) ? new RegExp(`^${rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i') : null;
  return (v) => {
    if (n != null && typeof v === 'number') {
      return { '=': v === n, '<>': v !== n, '<': v < n, '>': v > n, '<=': v <= n, '>=': v >= n }[op];
    }
    const s = String(v ?? '').toLowerCase();
    const r = rhs.toLowerCase();
    if (op === '=') return pattern ? pattern.test(String(v ?? '')) : s === r;
    if (op === '<>') return pattern ? !pattern.test(String(v ?? '')) : s !== r;
    if (n != null) return false;
    return { '<': s < r, '>': s > r, '<=': s <= r, '>=': s >= r }[op];
  };
}

const round = (v, d, mode) => {
  const f = 10 ** d;
  const x = v * f;
  const r = mode === 'up' ? Math.sign(x) * Math.ceil(Math.abs(x) - 1e-9) : mode === 'down' ? Math.trunc(x) : Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
  return r / f;
};

const FUNCS = {
  SUM: (a) => numbers(a).reduce((s, v) => s + v, 0),
  PRODUCT: (a) => numbers(a).reduce((s, v) => s * v, 1),
  AVERAGE: (a) => { const n = numbers(a); if (!n.length) throw ERR.DIV0; return n.reduce((s, v) => s + v, 0) / n.length; },
  MIN: (a) => { const n = numbers(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = numbers(a); return n.length ? Math.max(...n) : 0; },
  MEDIAN: (a) => { const n = numbers(a).sort((x, y) => x - y); if (!n.length) throw ERR.NUM; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
  COUNT: (a) => values(a).filter(v => typeof v === 'number').length,
  COUNTA: (a) => values(a).filter(v => v !== '' && v != null).length,
  COUNTBLANK: (a) => values(a).filter(v => v === '' || v == null).length,
  COUNTIF: ([range, test]) => { const ok = criteria(test instanceof Range ? test.values[0][0] : test); return values([range]).filter(ok).length; },
  SUMIF: ([range, test, sumRange]) => {
    const ok = criteria(test instanceof Range ? test.values[0][0] : test);
    const r = values([range]); const s = sumRange ? values([sumRange]) : r;
    return r.reduce((t, v, i) => (ok(v) && typeof s[i] === 'number' ? t + s[i] : t), 0);
  },
  AVERAGEIF: ([range, test, avgRange]) => {
    const ok = criteria(test instanceof Range ? test.values[0][0] : test);
    const r = values([range]); const s = avgRange ? values([avgRange]) : r;
    const hits = r.map((v, i) => (ok(v) && typeof s[i] === 'number' ? s[i] : null)).filter(v => v != null);
    if (!hits.length) throw ERR.DIV0;
    return hits.reduce((t, v) => t + v, 0) / hits.length;
  },
  SUMPRODUCT: (a) => {
    const arrays = a.map(x => values([x]));
    const len = arrays[0]?.length ?? 0;
    if (arrays.some(x => x.length !== len)) throw ERR.VALUE;
    let t = 0;
    for (let i = 0; i < len; i++) t += arrays.reduce((p, arr) => p * (typeof arr[i] === 'number' ? arr[i] : 0), 1);
    return t;
  },
  ABS: ([v]) => Math.abs(num(v)),
  SQRT: ([v]) => { const n = num(v); if (n < 0) throw ERR.NUM; return Math.sqrt(n); },
  POWER: ([a, b]) => num(a) ** num(b),
  MOD: ([a, b]) => { const d = num(b); if (d === 0) throw ERR.DIV0; const n = num(a); return n - d * Math.floor(n / d); },
  INT: ([v]) => Math.floor(num(v)),
  ROUND: ([v, d]) => round(num(v), d == null ? 0 : num(d)),
  ROUNDUP: ([v, d]) => round(num(v), d == null ? 0 : num(d), 'up'),
  ROUNDDOWN: ([v, d]) => round(num(v), d == null ? 0 : num(d), 'down'),
  CEILING: ([v, s]) => { const st = s == null ? 1 : num(s); return st ? Math.ceil(num(v) / st) * st : 0; },
  FLOOR: ([v, s]) => { const st = s == null ? 1 : num(s); return st ? Math.floor(num(v) / st) * st : 0; },
  PI: () => Math.PI,
  RAND: () => Math.random(),
  IF: ([c, a, b]) => (bool(c) ? (a === undefined ? true : a) : (b === undefined ? false : b)),
  IFERROR: ([v, alt]) => (isError(v) ? alt : v),
  AND: (a) => values(a).every(v => bool(v)),
  OR: (a) => values(a).some(v => bool(v)),
  NOT: ([v]) => !bool(v),
  ISBLANK: ([v]) => v === '' || v == null || (v instanceof Range && (v.values[0][0] === '' || v.values[0][0] == null)),
  ISNUMBER: ([v]) => typeof (v instanceof Range ? v.values[0][0] : v) === 'number',
  ISTEXT: ([v]) => typeof (v instanceof Range ? v.values[0][0] : v) === 'string' && (v instanceof Range ? v.values[0][0] : v) !== '',
  ISERROR: ([v]) => isError(v),
  LEN: ([v]) => str(v).length,
  UPPER: ([v]) => str(v).toUpperCase(),
  LOWER: ([v]) => str(v).toLowerCase(),
  PROPER: ([v]) => str(v).toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, a, b) => a + b.toUpperCase()),
  TRIM: ([v]) => str(v).trim().replace(/ {2,}/g, ' '),
  LEFT: ([v, n]) => str(v).slice(0, n == null ? 1 : num(n)),
  RIGHT: ([v, n]) => { const s = str(v); const k = n == null ? 1 : num(n); return k ? s.slice(-k) : ''; },
  MID: ([v, s, n]) => str(v).substr(num(s) - 1, num(n)),
  CONCAT: (a) => values(a).map(str).join(''),
  CONCATENATE: (a) => values(a).map(str).join(''),
  TEXTJOIN: ([sep, skip, ...rest]) => values(rest).filter(v => !(bool(skip) && (v === '' || v == null))).map(str).join(str(sep)),
  VALUE: ([v]) => num(v),
  TODAY: () => Math.floor(Date.now() / 86400000) + 25569,
  NOW: () => Date.now() / 86400000 + 25569,
  VLOOKUP: ([key, table, col, approx]) => {
    if (!(table instanceof Range)) throw ERR.REF;
    const k = key instanceof Range ? key.values[0][0] : key;
    const ci = num(col) - 1;
    const exact = approx !== undefined && !bool(approx);
    let hit = -1;
    table.values.forEach((row, i) => {
      if (hit >= 0 && exact) return;
      const v = row[0];
      if (exact ? String(v).toLowerCase() === String(k).toLowerCase() : (typeof v === typeof k && v <= k)) hit = i;
    });
    if (hit < 0) throw ERR.NA;
    const out = table.values[hit][ci];
    if (out === undefined) throw ERR.REF;
    return out;
  },
  INDEX: ([table, r, c]) => {
    if (!(table instanceof Range)) return table;
    const ri = r == null ? 0 : num(r) - 1;
    const ci = c == null ? 0 : num(c) - 1;
    const rows = table.values;
    if (rows.length === 1 && c == null) return rows[0][ri] ?? (() => { throw ERR.REF; })();
    const v = rows[ri]?.[ci];
    if (v === undefined) throw ERR.REF;
    return v;
  },
  MATCH: ([key, range, type]) => {
    const k = key instanceof Range ? key.values[0][0] : key;
    const list = values([range]);
    const t = type == null ? 1 : num(type);
    if (t === 0) { const i = list.findIndex(v => String(v).toLowerCase() === String(k).toLowerCase()); if (i < 0) throw ERR.NA; return i + 1; }
    let hit = -1;
    list.forEach((v, i) => { if (t > 0 ? v <= k : v >= k) hit = i; });
    if (hit < 0) throw ERR.NA;
    return hit + 1;
  },
};
// Functions whose arguments may be errors without failing the call.
const LAZY_ERRORS = new Set(['IFERROR', 'ISERROR']);

/**
 * Evaluate a formula.
 * @param {string} formula with or without the leading "="
 * @param {{ cell(sheet: string|null, r: number, c: number): any }} ctx
 */
export function evaluate(formula, ctx) {
  const tree = compile(formula);
  try {
    let v = ev(tree, ctx);
    if (v instanceof Range) v = v.values[0]?.[0];
    if (v === undefined || v === null) return 0;
    return v;
  } catch (e) {
    if (isError(e)) return e;
    return ERR.VALUE;
  }
}

function ev(n, ctx) {
  switch (n.k) {
    case 'err': throw n.e;
    case 'num': case 'str': case 'bool': return n.v;
    case 'empty': return undefined;
    case 'ref': {
      const [a, b] = n.v.split(':');
      const p = parseRef(a);
      if (!p) throw ERR.REF;
      if (!b) { const v = ctx.cell(n.sheet, p.r, p.c); return v === undefined ? '' : v; }
      const q = parseRef(b);
      if (!q) throw ERR.REF;
      const r0 = Math.min(p.r, q.r), r1 = Math.max(p.r, q.r), c0 = Math.min(p.c, q.c), c1 = Math.max(p.c, q.c);
      if ((r1 - r0 + 1) * (c1 - c0 + 1) > 1_000_000) throw ERR.REF;
      const rows = [];
      for (let r = r0; r <= r1; r++) {
        const row = [];
        for (let c = c0; c <= c1; c++) { const v = ctx.cell(n.sheet, r, c); row.push(v === undefined ? '' : v); }
        rows.push(row);
      }
      return new Range(rows);
    }
    case 'neg': return -num(ev(n.e, ctx));
    case 'pct': return num(ev(n.e, ctx)) / 100;
    case 'bin': {
      const a = ev(n.a, ctx), b = ev(n.b, ctx);
      switch (n.op) {
        case '+': return num(a) + num(b);
        case '-': return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': { const d = num(b); if (d === 0) throw ERR.DIV0; return num(a) / d; }
        case '^': return num(a) ** num(b);
        case '&': return str(a) + str(b);
        default: {
          const x = a instanceof Range ? a.values[0][0] : a;
          const y = b instanceof Range ? b.values[0][0] : b;
          if (isError(x)) throw x;
          if (isError(y)) throw y;
          let cmp;
          if (typeof x === 'number' && typeof y === 'number') cmp = x - y;
          else if (typeof x === 'number' && (y === '' || y == null)) cmp = x;
          else if (typeof y === 'number' && (x === '' || x == null)) cmp = -y;
          else { const s = str(x).toLowerCase(), t = str(y).toLowerCase(); cmp = s < t ? -1 : s > t ? 1 : 0; }
          return { '=': cmp === 0, '<>': cmp !== 0, '<': cmp < 0, '>': cmp > 0, '<=': cmp <= 0, '>=': cmp >= 0 }[n.op];
        }
      }
    }
    case 'call': {
      const fn = FUNCS[n.name.replace(/^_XLFN\./, '')];
      if (!fn) throw ERR.NAME;
      if (n.name === 'IF') {
        // Only the branch taken is evaluated.
        const c = ev(n.args[0], ctx);
        const pick = bool(c) ? n.args[1] : n.args[2];
        if (!pick || pick.k === 'empty') return bool(c);
        return ev(pick, ctx);
      }
      const args = n.args.map(a => {
        if (!LAZY_ERRORS.has(n.name)) return ev(a, ctx);
        try { return ev(a, ctx); } catch (e) { if (isError(e)) return e; throw e; }
      });
      return fn(args);
    }
    default: throw ERR.VALUE;
  }
}

export const SUPPORTED_FUNCTIONS = Object.keys(FUNCS).sort();
