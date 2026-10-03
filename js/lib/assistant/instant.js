/* ============================================================
   TOOLBOX — Instant answers

   "1837 × 492", "15% of ₦850,000", "add VAT to 2,500,000" and "what
   time is it" have exactly one right answer that a few lines of
   code can give in a millisecond. Sending them to a model costs a
   round trip, tokens and a share of the shared AI allowance, and
   the model can still get the sum wrong.

   This lane answers only what it is certain of. Anything it does
   not recognise in full, or whose result could lose precision,
   returns null and goes on to the model lanes. It never throws.

   Pure: no DOM, no network, no storage. Shared by the browser
   and by tests.
   ============================================================ */

import { convertUnits } from './instant-units.js';

const SAFE = 9e15;                           // beyond this a double stops being exact
const CURRENCY = /[₦$€£]/;
const NUM = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

const WORD_OPS = [
  [/\b(?:multiplied by|times)\b/g, '*'],
  [/\bdivided by\b|\bover\b/g, '/'],
  [/\bplus\b/g, '+'],
  [/\bminus\b/g, '-'],
  [/\bto the power of\b|\bto the power\b|\braised to\b/g, '^'],
  [/\bsquared\b/g, '^2'],
  [/\bcubed\b/g, '^3'],
];

/** Plain-language lead-ins that carry no meaning for the sum. */
const LEAD = /^(?:(?:please|pls|hey|hi|ok|okay)[\s,]+)?(?:(?:can|could) you\s+)?(?:(?:what(?:'s|s| is| are)|how much (?:is|are)|calculate|compute|work out|evaluate|find|tell me|give me|solve|whats)\s+)?(?:the\s+(?:value|result|answer|total|sum)\s+of\s+)?/;

function clean(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/[?!]+\s*$/, '')
    .replace(/[\s=]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "2,500,000" → "2500000". Commas are thousands separators only when they group three digits. */
const stripGroups = (s) => s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');

function format(n) {
  if (!Number.isFinite(n)) return null;
  const r = Number(n.toPrecision(14));
  if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) return null;
  return r.toLocaleString('en-US', { maximumFractionDigits: 10 });
}
const money = (n, sym) => {
  const f = format(Math.abs(n));
  return f == null ? null : `${n < 0 ? '-' : ''}${sym}${f}`;
};

/* ---------------- arithmetic ---------------- */

function tokenize(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    const num = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(s.slice(i));
    if (num) { out.push({ t: 'n', v: Number(num[0]), raw: num[0] }); i += num[0].length; continue; }
    if ('+-*/^()'.includes(ch)) { out.push({ t: ch }); i++; continue; }
    if (s.startsWith('sqrt', i)) { out.push({ t: 'f', v: 'sqrt' }); i += 4; continue; }
    return null;
  }
  return out;
}

/** Evaluates a token list with the usual precedence. Returns null for anything it cannot do exactly. */
function evaluate(tokens) {
  let p = 0;
  let ok = true;
  const peek = () => tokens[p]?.t;
  const bad = () => { ok = false; return NaN; };
  const checked = (v) => (Number.isFinite(v) && Math.abs(v) < SAFE ? v : bad());

  function expr() {
    let v = term();
    while (ok && (peek() === '+' || peek() === '-')) {
      const op = tokens[p++].t;
      const r = term();
      v = checked(op === '+' ? v + r : v - r);
    }
    return v;
  }
  function term() {
    let v = power();
    while (ok && (peek() === '*' || peek() === '/')) {
      const op = tokens[p++].t;
      const r = power();
      if (op === '/' && r === 0) { divideByZero = true; return bad(); }
      v = checked(op === '*' ? v * r : v / r);
    }
    return v;
  }
  function power() {
    const base = unary();
    if (ok && peek() === '^') {
      p++;
      const e = power();                      // right-associative
      if (!ok) return NaN;
      if (Math.abs(e) > 1000 || (base < 0 && !Number.isInteger(e))) return bad();
      return checked(base ** e);
    }
    return base;
  }
  function unary() {
    if (peek() === '-') { p++; return -unary(); }
    if (peek() === '+') { p++; return unary(); }
    return primary();
  }
  function primary() {
    const tok = tokens[p++];
    if (!tok) return bad();
    if (tok.t === 'n') return checked(tok.v);
    if (tok.t === 'f') {
      if (peek() !== '(') return bad();
      p++;
      const v = expr();
      if (peek() !== ')') return bad();
      p++;
      return v < 0 ? bad() : checked(Math.sqrt(v));
    }
    if (tok.t === '(') {
      const v = expr();
      if (peek() !== ')') return bad();
      p++;
      return v;
    }
    return bad();
  }

  let divideByZero = false;
  const value = expr();
  if (!ok || p !== tokens.length) return divideByZero ? { error: 'divide-by-zero' } : null;
  return { value };
}

function show(tokens) {
  return tokens.map((t, i) => {
    if (t.t === 'n') return format(t.v) ?? t.raw;
    if (t.t === 'f') return '√';
    const sym = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', '(': '(', ')': ')' }[t.t];
    const prev = tokens[i - 1];
    // Binary operators get spaces; a sign in front of a number or bracket does not.
    const unaryMinus = (t.t === '-' || t.t === '+') && (!prev || ['+', '-', '*', '/', '^', '('].includes(prev.t));
    return t.t === '(' || t.t === ')' || t.t === '^' || unaryMinus ? sym : ` ${sym} `;
  }).join('').replace(/√\(/g, '√(').replace(/\s+/g, ' ').trim();
}

function arithmetic(raw) {
  let s = clean(raw);
  const symbol = (s.match(CURRENCY) || [''])[0];
  s = s.replace(/[₦$€£]/g, '');
  s = s.replace(LEAD, '');
  // Dates, versions and phone numbers look like sums ("2024-05-06"); never treat them as one.
  if (/\d[-/.]\d+[-/.]\d+/.test(s.replace(/\s/g, '')) && !/\s[-+*/^]\s/.test(s)) return null;
  s = s.replace(/\bsquare root of\s+(.+)$/, 'sqrt($1)');
  s = stripGroups(s).replace(/×|·|⋅|∗/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^');
  s = s.replace(/(\d|\))\s*x\s*(?=[\d(.])/g, '$1*');
  for (const [re, to] of WORD_OPS) s = s.replace(re, to);
  if (/[a-z%]/.test(s.replace(/sqrt/g, ''))) return null;
  const tokens = tokenize(s);
  if (!tokens || tokens.length < 3 && !tokens.some(t => t.t === 'f')) return null;
  // A sum needs a real operator or function; "5" or "(5)" is not a question.
  if (!tokens.some(t => t.t === 'f' || ['+', '-', '*', '/', '^'].includes(t.t) && tokens.indexOf(t) > 0)) return null;
  if (tokens.some(t => t.t === 'n' && !Number.isSafeInteger(Math.round(t.v)))) return null;
  const result = evaluate(tokens);
  if (!result) return null;
  if (result.error) return { kind: 'arithmetic', text: `${show(tokens)} is undefined: it divides by zero.` };
  const value = symbol ? money(result.value, symbol) : format(result.value);
  if (value == null) return null;
  return { kind: 'arithmetic', text: `${show(tokens)} = **${value}**` };
}

/* ---------------- percentages and VAT ---------------- */

const amountOf = (s) => {
  const symbol = (s.match(CURRENCY) || [''])[0];
  const body = stripGroups(s.replace(/[₦$€£]/g, '').replace(/\s/g, ''));
  if (!new RegExp(`^${NUM}$`).test(body)) return null;
  const value = Number(body);
  return Number.isFinite(value) && value < SAFE ? { value, symbol } : null;
};

function percent(raw) {
  const s = clean(raw).replace(LEAD, '');
  let m = new RegExp(`^(${NUM})\\s*(?:%|percent|per cent)\\s+of\\s+(.+)$`).exec(s);
  if (m) {
    const base = amountOf(m[2]);
    if (!base) return null;
    const pct = Number(m[1]);
    const out = base.symbol ? money(pct / 100 * base.value, base.symbol) : format(pct / 100 * base.value);
    const baseText = base.symbol ? money(base.value, base.symbol) : format(base.value);
    return out && baseText ? { kind: 'percent', text: `${format(pct)}% of ${baseText} = **${out}**` } : null;
  }
  const ask = new RegExp(`^(.+?)\\s+is\\s+what\\s+(?:%|percent|per cent)\\s+of\\s+(.+)$`).exec(s);
  const rev = new RegExp(`^what\\s+(?:%|percent|per cent)\\s+of\\s+(.+?)\\s+is\\s+(.+)$`).exec(s);
  const pair = ask ? [ask[1], ask[2]] : rev ? [rev[2], rev[1]] : null;     // [part, whole]
  if (pair) {
    const part = amountOf(pair[0]);
    const whole = amountOf(pair[1]);
    if (!part || !whole || whole.value === 0) return null;
    const pct = format(part.value / whole.value * 100);
    return pct ? { kind: 'percent', text: `${format(part.value)} is **${pct}%** of ${format(whole.value)}.` } : null;
  }
  return null;
}

const VAT_RATE = 7.5;     // Nigeria
function vat(raw) {
  // "…, and the total including VAT" asks for what the answer already gives.
  const s = clean(raw).replace(LEAD, '').replace(/,?\s*(?:and\s+)?(?:what(?:'s| is)\s+)?(?:the\s+)?(?:grand\s+)?(?:total|sum)(?:\s+(?:including|with|incl\.?)\s+vat)?$/, '');
  const rate = (t) => (t ? Number(t) : VAT_RATE);
  let m = new RegExp(`^(?:add\\s+|include\\s+|apply\\s+|calculate\\s+|work out\\s+)?(?:the\\s+)?(?:(${NUM})\\s*%\\s*)?vat\\s+(?:on|to|for|of)\\s+(.+)$`).exec(s);
  let mode = 'add';
  if (!m) {
    const rev = new RegExp(`^(?:remove|strip|extract|exclude|take out)\\s+(?:(${NUM})\\s*%\\s*)?vat\\s+from\\s+(.+)$`).exec(s);
    if (rev) { m = rev; mode = 'remove'; }
  }
  if (!m) {
    const tail = new RegExp(`^(.+?)\\s*(?:\\+|plus|with|and)\\s*(?:(${NUM})\\s*%\\s*)?vat$`).exec(s);
    if (tail) m = [tail[0], tail[2], tail[1]];
  }
  if (!m) return null;
  const r = rate(m[1]);
  const base = amountOf(m[2]);
  if (!base || !(r >= 0 && r <= 100)) return null;
  const sym = base.symbol || '';
  const f = (n) => (sym ? money(n, sym) : format(n));
  if (mode === 'remove') {
    const net = base.value / (1 + r / 100);
    const tax = base.value - net;
    const [a, b, c] = [f(net), f(tax), f(base.value)];
    return a && b && c ? { kind: 'vat', text: `Taking ${format(r)}% VAT out of ${c}: the price before VAT is **${a}** and the VAT is **${b}**.` } : null;
  }
  const tax = base.value * r / 100;
  const total = base.value + tax;
  const [a, b, c] = [f(base.value), f(tax), f(total)];
  return a && b && c ? { kind: 'vat', text: `VAT at ${format(r)}% on ${a} is **${b}**, so the total including VAT is **${c}**.` } : null;
}

function units(raw) {
  return convertUnits(stripGroups(clean(raw).replace(LEAD, '')));
}

/* ---------------- date and time ---------------- */

function clock(raw, now) {
  const s = clean(raw);
  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  if (/^(?:what(?:'s| is) the (?:current )?time(?: now| right now)?|what time is it(?: now| right now)?|current time|time now|the time)$/.test(s)) {
    return { kind: 'datetime', text: `It is **${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}**${zone ? ` (${zone})` : ''}.` };
  }
  if (/^(?:what(?:'s| is)(?: the)? (?:today'?s )?date(?: today)?|today'?s date|what day is (?:it|today)|what is today|date today|the date)$/.test(s)) {
    return { kind: 'datetime', text: `Today is **${now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}**.` };
  }
  return null;
}

/**
 * The answer to a message that has exactly one computable answer, or null.
 * Returns { text, kind } where kind is 'arithmetic', 'percent', 'vat' or 'datetime'.
 */
export function instantAnswer(text, { now = new Date() } = {}) {
  try {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    if (!t || t.length > 120) return null;
    return clock(t, now) || vat(t) || percent(t) || units(t) || arithmetic(t);
  } catch {
    return null;
  }
}
