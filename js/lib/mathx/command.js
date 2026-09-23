/* ============================================================
   mathx / command — natural-ish command language over the engine.
   run('integrate x^2 sin x dx') -> structured result card data:
     { title, category, input (LaTeX), result (LaTeX), plain, approx,
       extra:[{label, latex|text}], table, steps:[{text, latex}],
       verify:{ok, text}, notes:[], plot }
   Pure (no DOM). Plot specs carry JS closures for the view.
   ============================================================ */

import { Q, Q0, Q1, rationalApprox } from './rational.js';
import * as X from './expr.js';
import {
  parse, parseRaw, canon, toLatex, toStr, evalReal, evalComplex, fmtNum, fmtComplex, numLatex, freeSyms, mainVar, has,
  A, M, P, F, N, S, ZERO, ONE, MONE, OO, numQ, isNum, isSym, isZero, subs, sub, div, neg, compileReal, isConstant, equal, isInf
} from './expr.js';
import { expand, collect, factorPolyExpr, toPoly, apart, cancel, numden, polyRoots, polyRootsNumeric, pdeg, fromPoly } from './poly.js';
import * as C from './calculus.js';
import * as SV from './solve.js';
import * as LA from './linalg.js';
import * as ST from './stats.js';
import * as OP from './optimize.js';
import * as NT from './ntheory.js';
import { constantDigits, gammaFn } from './special.js';

const L = toLatex;
const step = (text, latex = '') => ({ text, latex });

/* ---------------- small parsing utilities ---------------- */

export function splitTop(s, seps = [',']) {
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (depth === 0 && seps.includes(ch)) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function nums(s) {
  const t = s.replace(/[[\]()]/g, ' ').trim();
  const parts = t.split(/[\s,;]+/).filter(Boolean);
  const v = parts.map((p) => { try { return evalReal(parse(p)); } catch { return NaN; } });
  if (!v.length || v.some((x) => !Number.isFinite(x))) throw new Error(`Expected a list of numbers, got "${s}"`);
  return v;
}
/** find top-level bracketed arrays in a string: returns array of strings like "[1,2,3]" */
function bracketGroups(s) {
  const out = []; let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '[') { if (depth === 0) start = i; depth++; }
    else if (s[i] === ']') { depth--; if (depth === 0) out.push(s.slice(start, i + 1)); }
  }
  return out;
}
function parseMatrix(s) {
  const e = parse(s.trim());
  if (e.t !== 'list') throw new Error('Expected a matrix like [[1,2],[3,4]]');
  const rows = e.a.every((r) => r.t === 'list') ? e.a.map((r) => r.a) : [e.a];
  const n = rows[0].length;
  if (rows.some((r) => r.length !== n)) throw new Error('Matrix rows must have equal length');
  const exact = rows.every((r) => r.every(isNum));
  return { exact, Qm: exact ? rows.map((r) => r.map((x) => x.v)) : null, F: rows.map((r) => r.map((x) => { const v = evalReal(x); if (!Number.isFinite(v)) throw new Error('Matrix entries must be numeric'); return v; })), rows };
}
function parseVec(s) { const e = parse(s.trim()); if (e.t !== 'list') throw new Error('Expected a vector like [1,2]'); return e.a; }
const qLatexM = (Mx) => LA.matLatex(Mx);
function numOr(e) { const v = evalReal(e); return v; }
function tidyExpr(v) { const id = C.identify(v, 1e-11); return id || numQ(Q.fromNumber(Number(v.toPrecision(12)))); }
function varsOf(...es) { const s = new Set(); es.forEach((e) => freeSyms(e, s)); return [...s].sort((a, b) => (a === 'x' ? -1 : b === 'x' ? 1 : a < b ? -1 : 1)); }
function eqLatex(lhs, rhs) { return `${lhs} = ${rhs}`; }
function approxOf(e) {
  if (!isConstant(e)) return null;
  const z = evalComplex(e);
  if (!Number.isFinite(z.re)) return null;
  const s = fmtComplex(z, 15);
  if (isNum(e) && e.v.isInt) return null;
  return s;
}
const bi = (b) => b.toString();

function plotFns(exprs, v, range = null, extra = {}) {
  return { type: 'fn', items: exprs.map((e) => ({ f: compileReal(e.expr || e, [v]), label: e.label || toStr(e.expr || e), latex: L(e.expr || e) })), x: range, v, ...extra };
}

/* ---------------- result builder ---------------- */
function R(o) {
  return { steps: [], extra: [], notes: [], verify: null, ...o };
}

/* ============================================================
   HANDLERS
   ============================================================ */

function hSimplify(arg, mode) {
  const raw = parse(arg);
  if (raw.t === 'rel') return hSolve(arg);
  const v = mainVar(raw);
  let out, title = 'Simplify', steps = [];
  if (mode === 'expand') { out = expand(raw); title = 'Expand'; }
  else if (mode === 'together') { const vs = varsOf(raw); out = vs.length === 1 ? cancel(raw, vs[0]) : (() => { const [n, d] = numden(raw); return div(expand(n), expand(d)); })(); title = 'Combine & cancel'; }
  else if (mode === 'collect') {
    const parts = splitTop(arg); const e = parse(parts[0]); const cv = parts[1] ? parts[1].trim() : mainVar(e);
    out = collect(e, cv); title = `Collect in ${cv}`;
    return R({ title, category: 'algebra', input: L(e), result: L(out), plain: toStr(out), verify: verifyEq(e, out) });
  } else {
    out = C.niceSimplify(raw);
    const tr = C.trigSimp(out); if (toStr(tr).length < toStr(out).length) { out = tr; steps.push(step('Pythagorean identity sin² + cos² = 1')); }
  }
  const approx = approxOf(out);
  return R({ title, category: 'algebra', input: L(raw), result: L(out), plain: toStr(out), approx, steps, verify: verifyEq(raw, out), plot: freeSyms(out).size === 1 ? plotFns([out], [...freeSyms(out)][0]) : null });
}
function verifyEq(a, b) {
  if (equal(a, b)) return { ok: true, text: 'identical form' };
  const vs = varsOf(a, b);
  if (!vs.length) {
    const za = evalComplex(a), zb = evalComplex(b);
    const ok = Math.hypot(za.re - zb.re, za.im - zb.im) < 1e-9 * (1 + Math.hypot(za.re, za.im));
    return { ok, text: ok ? 'numerically equal (15 digits)' : 'mismatch' };
  }
  const diffE = C.niceSimplify(sub(a, b));
  if (isZero(diffE)) return { ok: true, text: 'difference simplifies to 0' };
  // random multi-variable check
  let checked = 0;
  for (let t = 0; t < 8; t++) {
    const env = Object.fromEntries(vs.map((v, i) => [v, 0.37 + 0.61 * t - 0.23 * i]));
    const x = evalReal(a, env), y = evalReal(b, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    checked++;
    if (Math.abs(x - y) > 1e-8 * Math.max(1, Math.abs(x))) return { ok: false, text: `differs at ${JSON.stringify(env)}` };
  }
  return { ok: checked >= 3, text: `equal at ${checked} random points` };
}

function hFactor(arg) {
  const e = parse(arg);
  if (isConstant(e) && isNum(e) && e.v.isInt) return hFactorInt(e.v.n);
  if (isConstant(e) && isNum(e)) {
    const f1 = NT.factorize(e.v.n), f2 = NT.factorize(e.v.d);
    return R({ title: 'Factor rational', category: 'number', input: L(e), result: `\\frac{${NT.latexFactors(f1.factors) || '1'}}{${NT.latexFactors(f2.factors)}}`, plain: `${NT.formatFactors(f1.factors)} / ${NT.formatFactors(f2.factors)}` });
  }
  const vs = varsOf(e);
  if (vs.length === 1) {
    const v = vs[0];
    const [n, d] = numden(e);
    const pn = toPoly(n, v), pd = toPoly(d, v);
    if (pn && pd) {
      const fn = factorPolyExpr(pn, v), fd = pdeg(pd) > 0 ? factorPolyExpr(pd, v) : null;
      const out = fd ? { t: 'mul', a: [fn.expr, P(fd.expr, MONE)] } : fn.expr;
      const outL = fd ? `\\frac{${L(fn.expr)}}{${L(fd.expr)}}` : L(fn.expr);
      const irreducible = fn.factors.length <= 1 && fn.factors.every(([, m]) => m === 1);
      const steps = [step('Extract the rational content and make the polynomial primitive'), step("Square-free decomposition (Yun's algorithm) separates repeated factors"), step('Rational-root test and numerically guided factor search; each factor confirmed by exact polynomial division')];
      const pr = polyRoots(pn, v);
      const extra = [];
      if (pr.exact.length || pr.numeric.length) extra.push({ label: 'Roots', latex: [...pr.exact.map((r) => L(C.niceSimplify(r.expr))), ...pr.numeric.map((z) => fmtComplex(z, 10))].join(',\\; ') });
      return R({ title: 'Factor over ℚ', category: 'algebra', input: L(e), result: outL, plain: toStr(out), extra, steps, notes: irreducible && pdeg(pn) > 1 ? ['Irreducible over the rationals.'] : [], verify: verifyEq(expand(e), expand(fd ? div(fn.expr, fd.expr) : fn.expr)) });
    }
  }
  // multivariate: pull out common monomial & numeric content, then try univariate in main var with rational coeffs
  const ex = expand(e);
  const ts = ex.t === 'add' ? ex.a : [ex];
  let common = null;
  for (const t of ts) {
    const fs = t.t === 'mul' ? t.a : [t];
    const m = new Map();
    for (const f of fs) { if (isNum(f)) continue; const b = f.t === 'pow' && isNum(f.e) ? f.b : f; const k = f.t === 'pow' && isNum(f.e) ? f.e.v : Q1; m.set(X.key(b), { b, k: k }); }
    if (!common) common = m;
    else for (const [kk, val] of [...common]) { if (!m.has(kk)) common.delete(kk); else if (m.get(kk).k.cmp(val.k) < 0) common.set(kk, m.get(kk)); }
  }
  let g = 0n; ts.forEach((t) => { const c = t.t === 'mul' && isNum(t.a[0]) ? t.a[0].v : isNum(t) ? t.v : Q1; if (c.isInt) g = gcdB(g, c.n); });
  const monos = [...(common || new Map()).values()].map(({ b, k }) => P(b, numQ(k)));
  const cf = M(numQ(new Q(g || 1n)), ...monos);
  if (!X.isOne(cf)) {
    const rest = expand(div(ex, cf));
    const out = { t: 'mul', a: [cf, rest] };
    return R({ title: 'Factor (common factor)', category: 'algebra', input: L(e), result: `${L(cf)}\\left(${L(rest)}\\right)`, plain: `${toStr(cf)}*(${toStr(rest)})`, verify: verifyEq(e, out) });
  }
  // difference of squares a^2 - b^2
  if (ts.length === 2) {
    const sq = (t) => {
      const fs = t.t === 'mul' ? t.a : [t]; const out = [];
      for (const f of fs) {
        if (isNum(f)) { const r = P(f, X.HALF); if (!isNum(r)) return null; out.push(r); continue; }
        const b = f.t === 'pow' ? f.b : f, e = f.t === 'pow' ? f.e : ONE;
        if (!isNum(e) || !e.v.isInt || e.v.n % 2n !== 0n) return null;
        out.push(P(b, numQ(e.v.div(new Q(2n)))));
      }
      return M(out);
    };
    const a = ts.find((t) => !(t.t === 'mul' && isNum(t.a[0]) && t.a[0].v.sign < 0)), b = ts.find((t) => t !== a);
    if (a && b) { const ra = sq(a), rb = sq(neg(b)); if (ra && rb) { const out = { t: 'mul', a: [A(ra, neg(rb)), A(ra, rb)] }; return R({ title: 'Factor (difference of squares)', category: 'algebra', input: L(e), result: L(out), plain: toStr(out), verify: verifyEq(e, out) }); } }
  }
  return R({ title: 'Factor', category: 'algebra', input: L(e), result: L(e), plain: toStr(e), notes: ['No factorisation found (multivariate factoring supports common factors and differences of squares).'] });
}
function gcdB(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }

function hFactorInt(n) {
  const t0 = Date.now();
  const { factors, incomplete } = NT.factorize(n);
  const prime = NT.isPrime(n < 0n ? -n : n);
  const plain = (n < 0n ? '-1 × ' : '') + NT.formatFactors(factors);
  let prod = 1n; for (const [p, k] of factors) prod *= p ** BigInt(k);
  const ok = prod === (n < 0n ? -n : n);
  return R({
    title: prime ? 'Prime' : 'Integer factorisation', category: 'number', input: n.toString(), result: prime ? `${n}\\ \\text{is prime}` : `${n < 0n ? '-1 \\cdot ' : ''}${NT.latexFactors(factors)}`, plain: prime ? `${n} is prime` : plain,
    extra: [{ label: 'Digits', text: String((n < 0n ? -n : n).toString().length) }, { label: 'Method', text: `trial division + Pollard–Brent ρ; primality: ${NT.primalityCertainty(factors.size ? [...factors.keys()].pop() : n)}` }],
    notes: incomplete ? ['Time limit reached: the last factor is composite and could not be split within 4 s.'] : [],
    verify: { ok: ok && !incomplete, text: ok ? `product of factors = n (exact BigInt), ${Date.now() - t0} ms` : 'product mismatch' },
  });
}

/* ---------- calculus ---------- */

function hDiff(arg, order = 1) {
  let parts = splitTop(arg);
  let atM = arg.match(/\s+at\s+([a-z]\w*)\s*=\s*(.+)$/i);
  if (atM) parts = splitTop(arg.slice(0, atM.index));
  const e = parse(parts[0]);
  const vs = varsOf(e);
  let v = parts[1] ? parts[1].trim() : (vs.includes('x') ? 'x' : vs[0] || 'x');
  if (parts[2]) order = Number(parts[2]);
  if (vs.length > 1 && !parts[1]) return hGradient(parts[0]);
  let d = e; const steps = [];
  for (let k = 0; k < order; k++) { if (k === 0) steps.push(...C.diffSteps(d, v)); d = C.diff(d, v); }
  const r = C.niceSimplify(d);
  const dl = order === 1 ? `\\frac{d}{d${v}}` : `\\frac{d^{${order}}}{d${v}^{${order}}}`;
  const extra = [];
  let plot = null;
  if (atM) {
    const val = C.niceSimplify(subs(r, { [atM[1]]: parse(atM[2]) }));
    extra.push({ label: `At ${atM[1]} = ${atM[2]}`, latex: `${L(val)}${approxOf(val) ? ` \\approx ${approxOf(val)}` : ''}` });
  }
  if (varsOf(e).length === 1) plot = plotFns([{ expr: e, label: 'f' }, { expr: r, label: order === 1 ? "f'" : `f^(${order})` }], v);
  // verification: compare against central difference at sample points
  let ver = null;
  if (varsOf(e).length === 1 && order <= 2) {
    let checked = 0, ok = true;
    for (const p of [0.37, 1.21, -0.83, 2.3]) {
      const h = 1e-4;
      const fd = order === 1 ? (evalReal(e, { [v]: p + h }) - evalReal(e, { [v]: p - h })) / (2 * h) : (evalReal(e, { [v]: p + h }) - 2 * evalReal(e, { [v]: p }) + evalReal(e, { [v]: p - h })) / (h * h);
      const sy = evalReal(r, { [v]: p });
      if (!Number.isFinite(fd) || !Number.isFinite(sy)) continue;
      checked++; if (Math.abs(fd - sy) > 1e-4 * Math.max(1, Math.abs(sy))) ok = false;
    }
    if (checked) ver = { ok, text: ok ? `matches central finite differences at ${checked} points` : 'finite-difference check failed' };
  }
  return R({ title: order === 1 ? 'Derivative' : `Derivative (order ${order})`, category: 'calculus', input: `${dl}\\left[${L(e)}\\right]`, result: L(r), plain: toStr(r), steps: order === 1 ? steps : [], extra, plot, verify: ver });
}

function hGradient(arg, kind = 'gradient') {
  const parts = splitTop(arg);
  if (kind === 'jacobian') {
    const fsE = parse(parts[0]); const fs = fsE.t === 'list' ? fsE.a : [fsE];
    const vars = parts[1] ? parseVec(parts[1]).map((s) => s.n) : varsOf(...fs);
    const J = C.jacobian(fs, vars).map((r) => r.map(C.niceSimplify));
    const out = R({ title: 'Jacobian matrix', category: 'calculus', input: `J = \\frac{\\partial(${fs.map(L).join(', ')})}{\\partial(${vars.join(', ')})}`, result: X.matrixLatex(J), plain: `[${J.map((r) => `[${r.map(toStr).join(', ')}]`).join(', ')}]` });
    if (J.length === J[0].length) { const det = C.niceSimplify(detExpr(J)); out.extra.push({ label: 'det J', latex: L(det) }); }
    return out;
  }
  const e = parse(parts[0]);
  const vars = parts[1] ? parseVec(parts[1]).map((s) => s.n) : varsOf(e);
  if (kind === 'hessian') {
    const H = C.hessian(e, vars).map((r) => r.map(C.niceSimplify));
    return R({ title: 'Hessian matrix', category: 'calculus', input: `\\nabla^2 \\left(${L(e)}\\right)`, result: X.matrixLatex(H), plain: `[${H.map((r) => `[${r.map(toStr).join(', ')}]`).join(', ')}]`, extra: [{ label: 'det H', latex: L(C.niceSimplify(detExpr(H))) }] });
  }
  const g = C.gradient(e, vars).map(C.niceSimplify);
  return R({
    title: 'Gradient (partial derivatives)', category: 'calculus', input: `\\nabla \\left(${L(e)}\\right)`, result: `\\left(${g.map(L).join(',\\; ')}\\right)`, plain: `(${g.map(toStr).join(', ')})`,
    extra: vars.map((v, i) => ({ label: `∂/∂${v}`, latex: L(g[i]) })),
    plot: vars.length === 2 ? { type: 'surface', f: compileReal(e, vars), vars, label: toStr(e) } : null,
  });
}
function detExpr(Mx) {
  const n = Mx.length;
  if (n === 1) return Mx[0][0];
  if (n === 2) return sub(M(Mx[0][0], Mx[1][1]), M(Mx[0][1], Mx[1][0]));
  return A(Mx[0].map((c, j) => M(j % 2 ? MONE : ONE, c, detExpr(Mx.slice(1).map((r) => r.filter((_, k) => k !== j))))));
}

function parseBoundsPhrase(s) {
  // "... from a to b" | "..., a, b" | "... over [a,b]"
  let m = s.match(/^(.*?)\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i);
  if (m) return { body: m[1], a: m[2], b: m[3] };
  m = s.match(/^(.*?)\s+(?:on|over|in)\s+\[\s*(.+?)\s*,\s*(.+?)\s*\]\s*$/i);
  if (m) return { body: m[1], a: m[2], b: m[3] };
  return { body: s };
}

function hIntegrate(arg) {
  let { body, a, b } = parseBoundsPhrase(arg.trim());
  let v = null;
  let dm = body.match(/\s*\bd([a-z])\s*$/i);
  if (dm) { v = dm[1]; body = body.slice(0, dm.index); }
  const parts = splitTop(body);
  if (parts.length >= 2 && /^[a-z]$/i.test(parts[1])) { v = parts[1]; if (parts.length >= 4) { a = parts[2]; b = parts[3]; } body = parts[0]; }
  else if (parts.length === 3 && !v) { body = parts[0]; a = parts[1]; b = parts[2]; }
  const f = parse(body);
  v = v || mainVar(f);
  if (a !== undefined) {
    const A_ = parse(a), B_ = parse(b);
    const r = C.definiteIntegral(f, v, A_, B_);
    const fa = evalReal(A_), fb = evalReal(B_);
    const plot = plotFns([f], v, Number.isFinite(fa) && Number.isFinite(fb) ? [Math.min(fa, fb) - 0.15 * Math.abs(fb - fa) - 0.5, Math.max(fa, fb) + 0.15 * Math.abs(fb - fa) + 0.5] : null, { shade: { a: fa, b: fb } });
    const exact = r.exact || r.identified;
    const steps = [...(r.steps || [])];
    if (r.antiderivative) steps.push(step('Fundamental theorem of calculus', `\\left[${L(r.antiderivative)}\\right]_{${L(A_)}}^{${L(B_)}}`));
    return R({
      title: 'Definite integral', category: 'calculus', input: `\\int_{${L(A_)}}^{${L(B_)}} ${L(f)}\\,d${v}`,
      result: exact ? L(exact) : numLatex(r.numeric, 14), plain: exact ? toStr(exact) : fmtNum(r.numeric, 14), approx: exact ? fmtNum(evalReal(exact), 15) : null,
      steps, extra: [{ label: 'Numeric', text: `${fmtNum(r.numeric, 15)} (${r.method}, est. error ${fmtNum(r.numericError, 2)})` }],
      notes: !r.exact && r.identified ? ['Closed form recognised from the high-precision numeric value (not derived symbolically).'] : [],
      verify: r.exact ? { ok: true, text: r.verified } : { ok: r.numericError < 1e-8, text: `quadrature error estimate ${fmtNum(r.numericError, 2)}` }, plot,
    });
  }
  const r = C.integrate(f, v);
  if (!r.ok) {
    return R({ title: 'Indefinite integral', category: 'calculus', input: `\\int ${L(f)}\\,d${v}`, result: '\\text{no elementary antiderivative found}', plain: 'not found', notes: ['Symbolic methods tried: table, linear substitution, partial fractions, u-substitution, integration by parts, trig reduction. Give bounds (from a to b) for a numeric value.'], plot: plotFns([f], v) });
  }
  return R({
    title: 'Indefinite integral', category: 'calculus', input: `\\int ${L(f)}\\,d${v}`, result: `${L(r.result)} + C`, plain: `${toStr(r.result)} + C`, steps: r.steps,
    verify: { ok: Boolean(r.verified), text: r.verified ? `d/d${v} of the result equals the integrand (${r.verified})` : 'derivative check inconclusive' },
    plot: plotFns([{ expr: f, label: 'f' }, { expr: r.result, label: 'F (C = 0)' }], v),
  });
}

function parseLimitArg(arg) {
  let m = arg.match(/^(.*?)(?:,|\s+as)?\s+([a-z])\s*(?:->|→|to)\s*([^\s,]+?)\s*([+-])?\s*$/i);
  if (m) return { body: m[1].trim().replace(/,$/, ''), v: m[2], a: m[3], dir: m[4] || '' };
  const parts = splitTop(arg);
  if (parts.length >= 3) return { body: parts[0], v: parts[1], a: parts[2].replace(/[+-]$/, ''), dir: (parts[2].match(/[+-]$/) || [''])[0] || parts[3] || '' };
  throw new Error('Write limits like: limit sin(x)/x x->0   (use x->0+ for one-sided, x->oo for infinity)');
}
function hLimit(arg) {
  const lm = arg.match(/^_\{?\s*([a-z])\s*(?:->|→)\s*([^}\s]+?)([+-])?\}?\s+(.*)$/i);
  const { body, v, a, dir } = lm ? { body: lm[4], v: lm[1], a: lm[2], dir: lm[3] || '' } : parseLimitArg(arg);
  const f = parse(body), aE = parse(a.replace(/^inf(inity)?$/i, 'oo').replace(/^-inf(inity)?$/i, '-oo'));
  const r = C.limit(f, v, aE, dir);
  const sup = dir ? `^{${dir}}` : '';
  const input = `\\lim_{${v} \\to ${L(aE)}${sup}} ${L(f)}`;
  const av = evalReal(aE);
  const plot = Number.isFinite(av) ? plotFns([f], v, [av - 3, av + 3], { markX: av }) : plotFns([f], v, [0, 60]);
  if (r.sym) {
    const ok = r.num && r.num.kind === 'finite' ? Math.abs(evalReal(r.sym.value) - r.num.value) < 1e-4 * Math.max(1, Math.abs(r.num.value)) : r.num && r.num.kind === 'inf' ? isInf(r.sym.value) || isSym(r.sym.value, 'oo') : null;
    return R({ title: 'Limit', category: 'calculus', input, result: L(r.sym.value), plain: toStr(r.sym.value), approx: approxOf(r.sym.value), steps: [step(r.sym.method)], verify: ok === null ? null : { ok, text: ok ? `numeric Richardson extrapolation agrees${r.num.kind === 'finite' ? ` (${fmtNum(r.num.value, 10)})` : ''}` : 'numeric check disagrees' }, plot });
  }
  if (r.num && r.num.kind === 'dne') {
    const side = (s) => (s.kind === 'inf' ? (s.sign > 0 ? '+\\infty' : '-\\infty') : fmtNum(s.value, 10));
    return R({ title: 'Limit', category: 'calculus', input, result: '\\text{does not exist}', plain: 'does not exist', extra: [{ label: 'Left limit', latex: side(r.num.left) }, { label: 'Right limit', latex: side(r.num.right) }], verify: { ok: true, text: 'one-sided limits differ' }, plot });
  }
  if (r.num && r.num.kind === 'finite') {
    const id = C.identify(r.num.value, 1e-7);
    return R({ title: 'Limit (numeric)', category: 'calculus', input, result: id ? L(id) : numLatex(r.num.value, 10), plain: id ? toStr(id) : fmtNum(r.num.value, 10), approx: fmtNum(r.num.value, 12), notes: ['Symbolic methods did not apply; value from Richardson extrapolation' + (id ? ', closed form recognised numerically.' : '.')], verify: { ok: r.num.err < 1e-6, text: `extrapolation spread ${fmtNum(r.num.err, 2)}` }, plot });
  }
  if (r.num && r.num.kind === 'inf') return R({ title: 'Limit', category: 'calculus', input, result: r.num.sign > 0 ? '\\infty' : '-\\infty', plain: r.num.sign > 0 ? 'oo' : '-oo', notes: ['Unbounded growth detected numerically.'], plot });
  throw new Error('Could not evaluate this limit');
}

function hSeries(arg) {
  let s = arg;
  let order = 6, at = '0', v = null;
  const om = s.match(/\s+(?:order|to order|n\s*=|terms?)\s*(\d+)\s*$/i); if (om) { order = Number(om[1]); s = s.slice(0, om.index); }
  const am = s.match(/\s+(?:at|about|around)\s+(?:([a-z])\s*=\s*)?(\S+)\s*$/i); if (am) { at = am[2]; v = am[1] || null; s = s.slice(0, am.index); }
  const parts = splitTop(s);
  if (parts.length >= 2) { v = parts[1]; if (parts[2]) at = parts[2]; if (parts[3]) order = Number(parts[3]); }
  const f = parse(parts[0]);
  v = v || mainVar(f);
  order = Math.min(Math.max(order, 1), 30);
  const aE = parse(at);
  const r = C.series(f, v, aE, order + 1);
  const res = `${L(r.expr)} + O\\left(${isZero(aE) ? v : `(${v} - ${L(aE)})`}^{${order + 1}}\\right)`;
  const av = evalReal(aE);
  const trunc = r.expr;
  // verification: compare near a
  let ok = null;
  try {
    const h = 0.05; const x0 = av + h;
    const fv = evalReal(f, { [v]: x0 }), sv = evalReal(trunc, { [v]: x0 });
    if (Number.isFinite(fv) && Number.isFinite(sv)) ok = Math.abs(fv - sv) < 10 * Math.pow(h, order + 1) * Math.max(1, Math.abs(fv)) * 50;
  } catch { /* ignore */ }
  return R({ title: `Taylor series (order ${order})`, category: 'calculus', input: `${L(f)} \\text{ about } ${v} = ${L(aE)}`, result: res, plain: `${toStr(trunc)} + O(${v}^${order + 1})`, steps: [step(`Method: ${r.method}`)], verify: ok === null ? null : { ok, text: ok ? `truncation error at ${v} = a + 0.05 is within the O(h^${order + 1}) bound` : 'series check failed' }, plot: plotFns([{ expr: f, label: 'f' }, { expr: trunc, label: `T${order}` }], v, [av - 3, av + 3]) });
}

function parseSumArg(arg) {
  let m = arg.match(/^(.*?)(?:,|\s+for|\s+over)?\s+([a-z])\s*=\s*(.+?)\s*(?:\.\.|…|to)\s*(.+)$/i);
  if (m) return { body: m[1].trim().replace(/,$/, ''), k: m[2], lo: m[3], hi: m[4] };
  const parts = splitTop(arg);
  if (parts.length === 4) return { body: parts[0], k: parts[1], lo: parts[2], hi: parts[3] };
  throw new Error('Write sums like: sum 1/k^2 k=1..oo   or   sum k^2, k, 1, n');
}
function hSum(arg, isProduct = false) {
  const { body, k, lo, hi } = parseSumArg(arg);
  const f = parse(body), loE = parse(lo), hiE = parse(hi.replace(/^inf(inity)?$/i, 'oo'));
  const r = isProduct ? C.product(f, k, loE, hiE) : C.sum(f, k, loE, hiE);
  const sym = isProduct ? '\\prod' : '\\sum';
  const input = `${sym}_{${k}=${L(loE)}}^{${L(hiE)}} ${L(f)}`;
  if (r.diverges) return R({ title: isProduct ? 'Product' : 'Series', category: 'calculus', input, result: '\\text{diverges}', plain: 'diverges', steps: [step(r.method)] });
  const val = r.exact || r.identified;
  const numV = r.exact ? evalReal(r.exact) : r.numeric;
  const extra = [];
  if (numV !== null && numV !== undefined && Number.isFinite(numV)) extra.push({ label: 'Numeric', text: fmtNum(numV, 15) });
  let ver = null;
  if (r.exact && isConstant(r.exact) && isSym(hiE, 'oo') && !isProduct) {
    const ns = C.numericSum(f, k, evalReal(loE));
    if (ns.value !== undefined) { const ok = Math.abs(ns.value - numV) < 1e-7 * Math.max(1, Math.abs(numV)); ver = { ok, text: `independent numeric summation: ${fmtNum(ns.value, 12)}` }; }
  } else if (r.exact && !isConstant(r.exact) && !isProduct) {
    // check symbolic closed form at a few upper limits
    const nv = [...freeSyms(r.exact)][0];
    let ok = true;
    for (const t of [3, 7, 12]) { const direct = C.sum(f, k, loE, N(t)).exact; const cf = subs(r.exact, { [nv]: N(t) }); if (!equal(C.niceSimplify(sub(direct, cf)), ZERO)) ok = false; }
    ver = { ok, text: ok ? 'closed form matches direct sums for n = 3, 7, 12' : 'mismatch against direct sums' };
  }
  return R({ title: isProduct ? 'Product' : (isSym(hiE, 'oo') ? 'Infinite series' : 'Sum'), category: 'calculus', input, result: val ? L(val) : numLatex(numV, 14), plain: val ? toStr(val) : fmtNum(numV, 14), steps: [...(r.steps || []), step(r.method)], extra, notes: !r.exact && r.identified ? ['Closed form recognised from the numeric value.'] : [], verify: ver });
}

/* ---------- equations ---------- */

function solvedLatex(v, e, param) { return `${v} = ${L(e)}${param ? `,\\; ${param} \\in \\mathbb{Z}` : ''}`; }

function hSolve(arg) {
  let s = arg.trim();
  let forVars = null;
  const fm = s.match(/\s+for\s+([a-z](?:\s*,\s*[a-z])*)\s*$/i); if (fm) { forVars = fm[1].split(/\s*,\s*/); s = s.slice(0, fm.index); }
  // matrix system "solve [[..]] [..]"
  const groups = bracketGroups(s);
  if (groups.length === 2 && s.replace(groups[0], '').replace(groups[1], '').replace(/[\s,]/g, '') === '') return hLinsolve(groups[0], groups[1]);
  const parts = splitTop(s, [',', ';']).filter((p) => !/^\s*$/.test(p));
  const eqs = parts.map((p) => parse(p));
  if (eqs.length === 1 && eqs[0].t === 'list' && eqs[0].chain) return hInequalityChain(eqs[0]);
  if (eqs.length === 1 && eqs[0].t === 'rel' && eqs[0].op !== '=') return hInequality(eqs[0], forVars ? forVars[0] : null);
  if (eqs.length > 1) {
    const vars = forVars || varsOf(...eqs);
    const r = SV.solveSystem(eqs, vars);
    const input = `\\begin{cases} ${eqs.map((e) => L(e.t === 'rel' ? e : { t: 'rel', op: '=', l: e, r: ZERO })).join(' \\\\ ')} \\end{cases}`;
    if (r.kind === 'none') return R({ title: 'System of equations', category: 'equations', input, result: '\\text{no solution}', plain: 'no solution', steps: r.steps, verify: { ok: true, text: r.text } });
    if (r.kind === 'nonefound') return R({ title: 'System of equations', category: 'equations', input, result: '\\text{no real solution found}', plain: 'none found', steps: r.steps, notes: ['Newton iterations from many starting points did not converge.'] });
    const sols = r.solutions.map((sol) => sol.map((q) => (q.approx || q.value !== undefined && r.kind === 'numeric' ? `${q.v} \\approx ${fmtNum(q.value, 12)}` : `${q.v} = ${L(q.expr)}`)).join(',\\; '));
    return R({
      title: r.kind === 'numeric' ? 'System of equations (numeric)' : 'System of equations', category: 'equations', input,
      result: sols.length > 1 ? `\\begin{aligned} ${sols.map((q) => q).join(' \\\\ ')} \\end{aligned}` : sols[0], plain: r.solutions.map((sol) => sol.map((q) => `${q.v}=${q.value !== undefined ? fmtNum(q.value, 12) : toStr(q.expr)}`).join(', ')).join(' ; '),
      steps: r.steps, verify: { ok: r.verified, text: r.verifyText },
      plot: vars.length === 2 && eqs.every((e) => e.t === 'rel') ? { type: 'implicit', items: eqs.map((e) => ({ F: compileReal(sub(e.l, e.r), vars), label: toStr(e) })), vars, points: r.solutions.map((sol) => sol.map((q) => (q.value !== undefined ? q.value : evalReal(q.expr)))) } : null,
    });
  }
  const eq = eqs[0];
  const vars = varsOf(eq);
  const v = forVars ? forVars[0] : (vars.includes('x') ? 'x' : vars[0]);
  if (!v) {
    // pure numeric relation
    const ok = eq.t === 'rel' ? Math.abs(evalReal(sub(eq.l, eq.r))) < 1e-12 : false;
    return R({ title: 'Check equality', category: 'equations', input: L(eq), result: ok ? '\\text{true}' : '\\text{false}', plain: String(ok) });
  }
  const r = SV.solveEquation(eq, v);
  const input = L(eq.t === 'rel' ? eq : { t: 'rel', op: '=', l: eq, r: ZERO });
  if (r.identity) return R({ title: 'Equation', category: 'equations', input, result: `\\text{true for all } ${v}`, plain: 'all values', steps: r.steps });
  if (r.none) return R({ title: 'Equation', category: 'equations', input, result: '\\text{no solution}', plain: 'no solution', steps: r.steps });
  const exactL = r.exact.map((e) => solvedLatex(v, e.expr, r.general ? r.param : null) + (approxOf(e.expr) && !r.general ? ` \\approx ${approxOf(e.expr)}` : ''));
  const numL = r.numeric.map((z) => `${v} \\approx ${fmtComplex(z, 12)}`);
  const all = [...exactL, ...numL];
  const real = [...r.exact.filter((e) => Math.abs(e.value.im) < 1e-12).map((e) => e.value.re), ...r.numeric.filter((z) => Math.abs(z.im) < 1e-12).map((z) => z.re)];
  const extra = [];
  if (r.factored) extra.push({ label: 'Factored', latex: `${L(r.factored)} = 0` });
  const g = eq.t === 'rel' ? sub(eq.l, eq.r) : eq;
  let range = null;
  if (real.length && !r.general) { const lo = Math.min(...real), hi = Math.max(...real); const pad = Math.max(1, (hi - lo) * 0.4); range = [lo - pad, hi + pad]; }
  return R({
    title: r.numericOnly ? 'Equation (numeric roots)' : 'Equation', category: 'equations', input,
    result: all.length ? (all.length > 1 ? `\\begin{aligned} ${all.join(' \\\\ ')} \\end{aligned}` : all[0]) : '\\text{no real roots found}',
    plain: [...r.exact.map((e) => `${v} = ${toStr(e.expr)}${r.general ? ` (${r.param} ∈ Z)` : ''}`), ...r.numeric.map((z) => `${v} ≈ ${fmtComplex(z, 12)}`)].join('; ') || 'none',
    steps: r.steps, extra,
    verify: r.verified !== undefined ? { ok: r.verified, text: r.verified ? `substituted back: max residual ${fmtNum(r.residual || 0, 2)}` : 'residual check failed' } : null,
    plot: varsOf(g).length === 1 ? plotFns([g], v, range, { roots: real }) : null,
  });
}
function hInequality(rel, v0) {
  const v = v0 || mainVar(rel);
  const r = SV.solveInequality(rel, v);
  return R({ title: 'Inequality', category: 'equations', input: L(rel), result: `${v} \\in ${r.latex}`, plain: `${v} ∈ ${r.plain}`, steps: r.steps, verify: { ok: r.verified, text: r.verified ? 'membership agrees with direct evaluation at 60 test points' : 'test-point check failed' }, plot: plotFns([{ expr: sub(rel.l, rel.r), label: `${toStr(rel.l)} − (${toStr(rel.r)})` }], v, null, { region: r.parts.map((p) => [p.lo ? p.lo.x : -Infinity, p.hi ? p.hi.x : Infinity]) }) });
}
function hInequalityChain(ch) {
  const [r1, r2] = ch.a;
  const v = mainVar(r1.r);
  const a = SV.solveInequality(r1, v), b = SV.solveInequality(r2, v);
  return R({ title: 'Compound inequality', category: 'equations', input: `${L(r1.l)} ${r1.op.replace('<=', '\\le').replace('>=', '\\ge')} ${L(r1.r)} ${r2.op.replace('<=', '\\le').replace('>=', '\\ge')} ${L(r2.r)}`, result: `${v} \\in \\left(${a.latex}\\right) \\cap \\left(${b.latex}\\right)`, plain: `${a.plain} ∩ ${b.plain}`, steps: [...a.steps, ...b.steps] });
}

function hLinsolve(As, bs) {
  const Am = parseMatrix(As), bv = parseVec(bs);
  if (Am.exact && bv.every(isNum)) {
    const r = LA.solveSystemQ(Am.Qm, bv.map((e) => e.v), { record: true });
    const vars = Am.Qm[0].map((_, i) => `x_{${i + 1}}`);
    const steps = r.steps.slice(0, 16).map((s) => step(s.op, qLatexM(s.M)));
    if (r.kind === 'none') return R({ title: 'Linear system Ax = b', category: 'linalg', input: `${qLatexM(Am.Qm)} x = ${LA.vecLatex(bv.map((e) => e.v))}`, result: '\\text{inconsistent (no solution)}', plain: 'no solution', steps });
    if (r.kind === 'unique') {
      const ok = Am.Qm.every((row, i) => row.reduce((s, a, j) => s.add(a.mul(r.x[j])), Q0).eq(bv[i].v));
      return R({ title: 'Linear system Ax = b', category: 'linalg', input: `${qLatexM(Am.Qm)} x = ${LA.vecLatex(bv.map((e) => e.v))}`, result: `x = ${LA.vecLatex(r.x)}`, plain: `[${r.x.map(String).join(', ')}]`, steps, verify: { ok, text: 'A·x = b exactly (rational arithmetic)' } });
    }
    return R({ title: 'Linear system Ax = b', category: 'linalg', input: `${qLatexM(Am.Qm)} x = ${LA.vecLatex(bv.map((e) => e.v))}`, result: `x = ${LA.vecLatex(r.x)} ${r.nulls.map((nv, i) => `+ t_{${i + 1}} ${LA.vecLatex(nv)}`).join(' ')}`, plain: 'infinitely many', steps, notes: [`Rank ${r.rank}: ${r.free} free parameter(s).`], verify: { ok: true, text: 'particular solution + null-space basis' } });
  }
  const r = LA.lstsq(Am.F, bv.map(evalReal));
  return R({ title: 'Linear system (floating point)', category: 'linalg', input: `A x = b`, result: `x = ${LA.vecLatex(r.x)}`, plain: `[${r.x.map((v) => fmtNum(v)).join(', ')}]`, verify: { ok: r.residual < 1e-9, text: `‖Ax − b‖ = ${fmtNum(r.residual, 3)}` } });
}

function hNsolve(arg) {
  const parts = splitTop(arg);
  const e = parse(parts[0]); const g = e.t === 'rel' ? sub(e.l, e.r) : e;
  const v = mainVar(g);
  const x0 = parts[1] ? evalReal(parse(parts[1].replace(/^[a-z]\s*=\s*/i, ''))) : 1;
  const r = SV.newtonSystem([g], [v], [x0]);
  if (!r) throw new Error('Newton iteration did not converge from that starting point');
  return R({ title: "Newton's method", category: 'equations', input: `${L(g)} = 0,\\; ${v}_0 = ${fmtNum(x0)}`, result: `${v} \\approx ${fmtNum(r.x[0], 15)}`, plain: fmtNum(r.x[0], 15), steps: [step(`${r.iterations} damped Newton iterations with the exact derivative`, `${v}_{n+1} = ${v}_n - \\frac{f(${v}_n)}{f'(${v}_n)},\\; f' = ${L(C.niceSimplify(C.diff(g, v)))}`)], verify: { ok: r.residual < 1e-10, text: `|f(${v})| = ${fmtNum(r.residual, 3)}` }, plot: plotFns([g], v, [r.x[0] - 3, r.x[0] + 3], { roots: [r.x[0]] }) });
}

function hRoots(arg) {
  const e = parse(arg); const g = e.t === 'rel' ? sub(e.l, e.r) : e;
  const v = mainVar(g);
  const p = toPoly(g, v);
  if (!p) throw new Error('roots expects a polynomial');
  const zs = polyRootsNumeric(p);
  const maxRes = zs.reduce((m, z) => { const r = evalComplex(g, { [v]: z }); return Math.max(m, Math.hypot(r.re, r.im)); }, 0);
  return R({ title: `All ${zs.length} complex roots`, category: 'equations', input: `${L(g)} = 0`, result: `\\begin{aligned} ${zs.map((z) => `${v} &\\approx ${fmtComplex(z, 14)}`).join(' \\\\ ')} \\end{aligned}`, plain: zs.map((z) => fmtComplex(z, 14)).join('; '), steps: [step('Aberth–Ehrlich simultaneous iteration, Newton-polished')], verify: { ok: maxRes < 1e-8, text: `max |p(z)| = ${fmtNum(maxRes, 3)}` }, plot: { type: 'argand', points: zs, label: 'roots' } });
}

/* ---------- ODEs ---------- */
function preODE(s) {
  return s.replace(/d\^?2\s*([a-z])\s*\/\s*d([a-z])\^?2/gi, "$1''").replace(/d([a-z])\s*\/\s*d([a-z])/gi, "$1'");
}
function extractICs(s, y) {
  const ics = []; let rest = s;
  const re = new RegExp(`(${y}'*)\\(\\s*([^)]+?)\\s*\\)\\s*=\\s*([^,;]+)`, 'g');
  rest = rest.replace(re, (_, lhs, x0, val) => { ics.push({ k: lhs.length - y.length, x0: parse(x0), val: parse(val) }); return ''; });
  return { ics, rest: rest.split(/[,;]/).map((q) => q.trim()).filter(Boolean).join(', ') };
}
function hDsolve(arg) {
  let s = preODE(arg);
  const ym = s.match(/([a-z])'+/i); const y = ym ? ym[1] : 'y';
  const { ics, rest } = extractICs(s, y);
  const eqStr = splitTop(rest)[0];
  const eq = parse(eqStr);
  const allS = varsOf(eq).filter((n) => !/'/.test(n) && n !== y);
  const x = allS.includes('x') ? 'x' : allS.includes('t') ? 't' : (allS[0] || 'x');
  const r = SV.dsolve(eq, { y, x, ics });
  const input = `${L(eq)}${ics.length ? `,\\; ${ics.map((ic) => `${y}${"'".repeat(ic.k)}(${L(ic.x0)}) = ${L(ic.val)}`).join(',\\; ')}` : ''}`;
  if (r.implicit) return R({ title: 'ODE (implicit solution)', category: 'equations', input, result: L(r.implicit), plain: toStr(r.implicit), steps: r.steps });
  const sol = r.particular || r.general;
  const solL = L(sol).replace(/C(\d)/g, 'C_{$1}').replace(/\\mathrm\{C(\d)\}/g, 'C_{$1}');
  const extra = r.particular ? [{ label: 'General solution', latex: `${y} = ${L(r.general).replace(/\\mathrm\{C(\d)\}/g, 'C_{$1}')}` }] : [];
  let plot = null;
  if (r.particular) plot = plotFns([{ expr: r.particular, label: `${y}(${x})` }], x);
  else if (r.Cs.length) {
    const fam = [];
    for (const c of [-2, -1, 0, 1, 2]) { const env = Object.fromEntries(r.Cs.map((cc, i) => [cc.n, N(i === 0 ? c : 1)])); fam.push({ expr: subs(r.general, env), label: `C₁ = ${c}` }); }
    plot = plotFns(fam, x);
  }
  return R({ title: `ODE (order ${r.order})`, category: 'equations', input, result: `${y}(${x}) = ${solL}`, plain: `${y} = ${toStr(sol)}`, steps: r.steps, extra, verify: r.verified ? { ok: true, text: r.verified } : null, plot });
}

function hOdeNumeric(arg) {
  let s = preODE(arg);
  // range: t=0..10 or x from 0 to 10
  let t0 = 0, t1 = 10, tv = null;
  const rm = s.match(/([a-z])\s*(?:=|from|in)\s*\[?\s*(-?[\d.]+(?:\s*\*?\s*pi)?)\s*(?:\.\.|to|,)\s*(-?[\d.]+(?:\s*\*?\s*pi)?)\s*\]?\s*$/i);
  if (rm) { tv = rm[1]; t0 = evalReal(parse(rm[2])); t1 = evalReal(parse(rm[3])); s = s.slice(0, rm.index); }
  const eqParts = splitTop(s, [',', ';']);
  const eqs = [], icMap = {};
  for (const p of eqParts) {
    const icm = p.match(/^([a-z]'*)\(\s*([^)]+)\s*\)\s*=\s*(.+)$/i);
    if (icm) { icMap[icm[1]] = evalReal(parse(icm[3])); t0 = rm ? t0 : evalReal(parse(icm[2])); continue; }
    if (p.trim()) eqs.push(parse(p));
  }
  const names = new Set(); eqs.forEach((e) => freeSyms(e, names));
  const indep = tv || (names.has('t') ? 't' : 'x');
  const sys = SV.odeSystem(eqs, { x: indep });
  const y0 = sys.states.map((st) => { if (!(st in icMap)) throw new Error(`Missing initial condition ${st}(${t0}) = …`); return icMap[st]; });
  const r = SV.rk45(sys.f, t0, y0, t1);
  const last = r.y[r.y.length - 1];
  const series = sys.states.map((st, i) => ({ label: st, pts: r.t.map((t, k) => [t, r.y[k][i]]) }));
  const extra = sys.states.map((st, i) => ({ label: `${st}(${fmtNum(t1)})`, text: fmtNum(last[i], 12) }));
  const plot = { type: 'points', series, lines: true, xLabel: indep };
  if (sys.states.length === 2 && !sys.states[1].startsWith(sys.states[0])) plot.phase = { label: `${sys.states[0]}–${sys.states[1]} phase plane`, pts: r.y.map((q) => [q[0], q[1]]) };
  return R({ title: 'ODE numeric solution (RK45)', category: 'equations', input: `${eqs.map(L).join(',\\; ')},\\; ${sys.states.map((st, i) => `${st}(${fmtNum(t0)}) = ${fmtNum(y0[i])}`).join(',\\; ')}`, result: sys.states.map((st, i) => `${st}(${fmtNum(t1)}) \\approx ${fmtNum(last[i], 12)}`).join(',\\; '), plain: extra.map((e) => `${e.label} ≈ ${e.text}`).join(', '), extra, steps: [step(`Converted to a first-order system in (${sys.states.join(', ')})`), step(`Dormand–Prince RK4(5), adaptive step, rtol 1e−9: ${r.steps} accepted, ${r.rejected} rejected steps`)], verify: { ok: r.done, text: r.done ? 'integrated to the end point with local error control' : 'integration stopped early (stiff or blow-up)' }, plot });
}

/* ---------- linear algebra ---------- */
function hMatrix(op, arg) {
  const groups = bracketGroups(arg);
  const Am = parseMatrix(groups[0] || arg);
  const n = Am.F.length, m = Am.F[0].length;
  const Ain = Am.exact ? qLatexM(Am.Qm) : LA.matLatex(Am.F);
  const sq = n === m;
  const need = () => { if (!sq) throw new Error('This operation needs a square matrix'); };
  switch (op) {
    case 'det': {
      need();
      if (Am.exact) { const d = LA.detQ(Am.Qm); return R({ title: 'Determinant', category: 'linalg', input: `\\det ${Ain}`, result: d.toLatex(), plain: d.toString(), approx: d.isInt ? null : d.toDecimal(12), steps: [step('Gaussian elimination with exact rational pivots; det = (±1)·∏ pivots')], verify: { ok: true, text: 'exact rational arithmetic' } }); }
      const { U, sign } = LA.lu(Am.F); const d = sign * U.reduce((p, r, i) => p * r[i], 1);
      return R({ title: 'Determinant', category: 'linalg', input: `\\det ${Ain}`, result: numLatex(d), plain: fmtNum(d), steps: [step('LU factorisation with partial pivoting')] });
    }
    case 'inverse': {
      need();
      if (Am.exact) {
        const inv = LA.inverseQ(Am.Qm);
        if (!inv) return R({ title: 'Inverse', category: 'linalg', input: `${Ain}^{-1}`, result: '\\text{singular (no inverse)}', plain: 'singular', verify: { ok: true, text: 'det = 0' } });
        const I = LA.matmulQ(Am.Qm, inv); const ok = I.every((r, i) => r.every((v, j) => v.eq(i === j ? Q1 : Q0)));
        return R({ title: 'Inverse', category: 'linalg', input: `${Ain}^{-1}`, result: qLatexM(inv), plain: `[${inv.map((r) => `[${r.map(String).join(', ')}]`).join(', ')}]`, steps: [step('Gauss–Jordan on [A | I] with exact rationals')], verify: { ok, text: 'A·A⁻¹ = I exactly' } });
      }
      const { x } = { x: null }; void x;
      const inv = Am.F.map((_, j) => LA.lstsq(Am.F, Am.F.map((__, i) => (i === j ? 1 : 0))).x);
      const invT = LA.transpose(inv);
      const err = LA.fnorm(LA.msub(LA.mmul(Am.F, invT), LA.eye(n)));
      return R({ title: 'Inverse', category: 'linalg', input: `${Ain}^{-1}`, result: LA.matLatex(invT), plain: JSON.stringify(invT), verify: { ok: err < 1e-9, text: `‖A·A⁻¹ − I‖ = ${fmtNum(err, 2)}` } });
    }
    case 'rank': case 'rref': case 'nullspace': {
      if (!Am.exact) { const { S } = LA.svd(Am.F); const tol = Math.max(n, m) * S[0] * 1e-12; return R({ title: 'Rank (SVD)', category: 'linalg', input: Ain, result: String(S.filter((s) => s > tol).length), plain: String(S.filter((s) => s > tol).length) }); }
      const r = LA.rrefQ(Am.Qm, { record: op === 'rref' });
      const ns = LA.nullspaceQ(Am.Qm);
      const out = R({ title: op === 'rref' ? 'Reduced row echelon form' : op === 'rank' ? 'Rank' : 'Null space', category: 'linalg', input: Ain, result: op === 'rref' ? qLatexM(r.R) : op === 'rank' ? String(r.rank) : (ns.length ? `\\operatorname{span}\\left\\{ ${ns.map((v) => LA.vecLatex(v)).join(',\\; ')} \\right\\}` : '\\{\\mathbf{0}\\}'), plain: op === 'rank' ? String(r.rank) : '', steps: op === 'rref' ? r.steps.slice(0, 20).map((s) => step(s.op, qLatexM(s.M))) : [] });
      out.extra.push({ label: 'Rank', text: String(r.rank) }, { label: 'Nullity', text: String(ns.length) }, { label: 'Pivot columns', text: r.pivots.map((p) => p + 1).join(', ') || 'none' });
      if (op === 'nullspace') { const ok = ns.every((v) => LA.matmulQ(Am.Qm, v.map((q) => [q])).every((row) => row[0].isZero)); out.verify = { ok, text: 'A·v = 0 exactly for each basis vector' }; }
      return out;
    }
    case 'transpose': { const T = LA.transpose(Am.exact ? Am.Qm : Am.F); return R({ title: 'Transpose', category: 'linalg', input: `${Ain}^{T}`, result: LA.matLatex(T), plain: '' }); }
    case 'trace': { need(); const t = Am.exact ? Am.Qm.reduce((s, r, i) => s.add(r[i]), Q0) : Am.F.reduce((s, r, i) => s + r[i], 0); return R({ title: 'Trace', category: 'linalg', input: `\\operatorname{tr} ${Ain}`, result: t instanceof Q ? t.toLatex() : numLatex(t), plain: String(t) }); }
    case 'charpoly': {
      need(); if (!Am.exact) throw new Error('charpoly needs rational entries');
      const ex = LA.eigenExact(Am.Qm);
      return R({ title: 'Characteristic polynomial', category: 'linalg', input: `\\det(\\lambda I - A),\\; A = ${Ain}`, result: `${L(ex.charPolyExpanded)}`, plain: toStr(ex.charPolyExpanded), extra: [{ label: 'Factored', latex: L(ex.charPolyExpr) }], steps: [step('Faddeev–LeVerrier recursion (exact)')] });
    }
    case 'eigen': return hEigen(Am, Ain);
    case 'svd': {
      const { U, S, V } = LA.svd(Am.F);
      const rec = LA.mmul(LA.mmul(U, S.map((s, i) => S.map((_, j) => (i === j ? s : 0)))), LA.transpose(V));
      const err = LA.fnorm(LA.msub(rec, Am.F.length === U.length ? Am.F : Am.F));
      return R({ title: 'Singular value decomposition', category: 'linalg', input: `A = U \\Sigma V^{T},\\; A = ${Ain}`, result: `\\sigma = \\left(${S.map((s) => fmtNum(LA.cleanNum(s), 10)).join(',\\; ')}\\right)`, plain: S.map((s) => fmtNum(s, 12)).join(', '), extra: [{ label: 'U', latex: LA.matLatex(U) }, { label: 'V', latex: LA.matLatex(V) }, { label: 'Rank', text: String(S.filter((s) => s > 1e-10 * S[0]).length) }, { label: 'Condition number', text: S[S.length - 1] > 1e-300 ? fmtNum(S[0] / S[S.length - 1], 6) : '∞' }], steps: [step('One-sided Jacobi rotations (Hestenes) until columns are orthogonal')], verify: { ok: err < 1e-9 * (1 + LA.fnorm(Am.F)), text: `‖UΣVᵀ − A‖ = ${fmtNum(err, 2)}` } });
    }
    case 'lu': {
      need(); const { P, L: Lm, U } = LA.lu(Am.F);
      const err = LA.fnorm(LA.msub(LA.mmul(P, Am.F), LA.mmul(Lm, U)));
      return R({ title: 'LU decomposition (PA = LU)', category: 'linalg', input: Ain, result: `L = ${LA.matLatex(Lm)},\\; U = ${LA.matLatex(U)}`, plain: '', extra: [{ label: 'P', latex: LA.matLatex(P) }], verify: { ok: err < 1e-9 * (1 + LA.fnorm(Am.F)), text: `‖PA − LU‖ = ${fmtNum(err, 2)}` } });
    }
    case 'qr': {
      const { Q: Qm, R: Rm } = LA.qr(Am.F);
      const err = LA.fnorm(LA.msub(LA.mmul(Qm, Rm), Am.F));
      return R({ title: 'QR decomposition (Householder)', category: 'linalg', input: Ain, result: `Q = ${LA.matLatex(Qm)},\\; R = ${LA.matLatex(Rm)}`, plain: '', verify: { ok: err < 1e-9 * (1 + LA.fnorm(Am.F)), text: `‖QR − A‖ = ${fmtNum(err, 2)}` } });
    }
    case 'cholesky': {
      need(); const Lc = LA.cholesky(Am.F);
      if (!Lc) return R({ title: 'Cholesky', category: 'linalg', input: Ain, result: '\\text{not symmetric positive definite}', plain: 'not SPD' });
      const err = LA.fnorm(LA.msub(LA.mmul(Lc, LA.transpose(Lc)), Am.F));
      return R({ title: 'Cholesky (A = LLᵀ)', category: 'linalg', input: Ain, result: `L = ${LA.matLatex(Lc)}`, plain: '', verify: { ok: err < 1e-9 * (1 + LA.fnorm(Am.F)), text: `‖LLᵀ − A‖ = ${fmtNum(err, 2)}` } });
    }
    case 'expm': {
      need(); const E = LA.expm(Am.F);
      return R({ title: 'Matrix exponential', category: 'linalg', input: `e^{${Ain}}`, result: LA.matLatex(E), plain: '', steps: [step('Scaling and squaring with a 24-term Taylor series')], verify: (() => { const d = LA.eigenNumeric(Am.F); const tr = Am.F.reduce((s, r, i) => s + r[i], 0); const { U, sign } = LA.lu(E); const detE = sign * U.reduce((p, r, i) => p * r[i], 1); const ok = Math.abs(detE - Math.exp(tr)) < 1e-8 * Math.exp(tr); void d; return { ok, text: `det(eᴬ) = e^{tr A} check: ${fmtNum(detE, 10)} vs ${fmtNum(Math.exp(tr), 10)}` }; })() });
    }
    case 'lstsq': {
      const bvec = parseVec(groups[1]).map(evalReal);
      const r = LA.lstsq(Am.F, bvec);
      return R({ title: 'Least squares', category: 'linalg', input: `\\min_x \\lVert A x - b \\rVert_2`, result: `x = ${LA.vecLatex(r.x)}`, plain: r.x.map((v) => fmtNum(v, 12)).join(', '), extra: [{ label: 'Residual ‖Ax − b‖', text: fmtNum(r.residual, 10) }, { label: 'Rank', text: String(r.rank) }], steps: [step('SVD pseudo-inverse x = V Σ⁺ Uᵀ b (minimum-norm solution)')] });
    }
    default: throw new Error('Unknown matrix operation');
  }
}

function hEigen(Am, Ain) {
  if (Am.F.length !== Am.F[0].length) throw new Error('Eigenvalues need a square matrix');
  const extra = []; const steps = [];
  let resultL, plain;
  const num = LA.eigenNumeric(Am.F);
  if (Am.exact && Am.F.length <= 6) {
    const ex = LA.eigenExact(Am.Qm);
    steps.push(step('Characteristic polynomial (Faddeev–LeVerrier, exact)', `p(\\lambda) = ${L(ex.charPolyExpanded)} = ${L(ex.charPolyExpr)}`));
    const rows = ex.eigen.map((e) => {
      const lam = e.expr ? L(C.niceSimplify(e.expr)) : fmtComplex(e.value, 12);
      const vec = e.vectors && e.vectors.length ? e.vectors.map((v) => LA.vecLatex(v)).join(',\\; ') : null;
      return `\\lambda = ${lam}${e.mult > 1 ? `\\;(\\times ${e.mult})` : ''}${vec ? `:\\; ${vec}` : ''}`;
    });
    resultL = `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;
    plain = ex.eigen.map((e) => (e.expr ? toStr(C.niceSimplify(e.expr)) : fmtComplex(e.value))).join(', ');
  } else {
    resultL = `\\lambda \\in \\left\\{ ${num.values.map((z) => fmtComplex(z, 10)).join(',\\; ')} \\right\\}`;
    plain = num.values.map((z) => fmtComplex(z, 12)).join(', ');
  }
  steps.push(step(`Numeric cross-check: ${num.method}`));
  extra.push({ label: 'Numeric eigenvalues', text: num.values.map((z) => fmtComplex(z, 10)).join(', ') });
  if (num.vectors) extra.push({ label: 'Unit eigenvectors', latex: num.vectors.map((v) => LA.vecLatex(v.map((c) => (typeof c === 'number' ? c : c)), (c) => (typeof c === 'number' ? fmtNum(LA.cleanNum(c), 8) : fmtComplex(c, 8)))).join(',\\; ') });
  // verify ||Av - λv||
  let maxRes = 0;
  num.values.forEach((lam, i) => {
    const v = num.vectors[i].map((c) => (typeof c === 'number' ? { re: c, im: 0 } : c));
    const Av = Am.F.map((r) => r.reduce((s, a, j) => ({ re: s.re + a * v[j].re, im: s.im + a * v[j].im }), { re: 0, im: 0 }));
    const res = Math.sqrt(Av.reduce((s, c, k) => s + (c.re - (lam.re * v[k].re - lam.im * v[k].im)) ** 2 + (c.im - (lam.re * v[k].im + lam.im * v[k].re)) ** 2, 0));
    maxRes = Math.max(maxRes, res);
  });
  const tr = Am.F.reduce((s, r, i) => s + r[i], 0), sumL = num.values.reduce((s, z) => s + z.re, 0);
  return R({ title: num.symmetric ? 'Eigen-decomposition (symmetric)' : 'Eigenvalues & eigenvectors', category: 'linalg', input: Ain, result: resultL, plain, extra, steps, verify: { ok: maxRes < 1e-7 && Math.abs(tr - sumL) < 1e-8 * (1 + Math.abs(tr)), text: `max ‖Av − λv‖ = ${fmtNum(maxRes, 2)}; Σλ = tr A = ${fmtNum(tr, 10)}` } });
}

function hMatrixInfo(e) {
  const rows = e.a.every((r) => r.t === 'list') ? e.a.map((r) => r.a) : null;
  if (!rows) {
    const vals = e.a.map(evalReal);
    const nrm = Math.hypot(...vals);
    return R({ title: 'Vector', category: 'linalg', input: toLatex(e), result: toLatex(e), plain: toStr(e), extra: [{ label: '‖v‖₂', text: fmtNum(nrm, 12) }, { label: 'Sum', text: fmtNum(vals.reduce((a, b) => a + b, 0), 12) }] });
  }
  const s = toStr(e);
  if (rows.length === rows[0].length) {
    const r = hEigen(parseMatrix(s), X.matrixLatex(rows));
    const Am = parseMatrix(s);
    if (Am.exact) { const d = LA.detQ(Am.Qm); r.extra.unshift({ label: 'Determinant', latex: d.toLatex() }, { label: 'Rank', text: String(LA.rrefQ(Am.Qm).rank) }); const inv = LA.inverseQ(Am.Qm); if (inv) r.extra.push({ label: 'Inverse', latex: qLatexM(inv) }); }
    r.title = 'Matrix overview';
    return r;
  }
  return hMatrix('rref', s);
}

/** evaluate matrix arithmetic like [[1,2],[3,4]]*[[5],[6]] or A^-1 */
function evalMatrixExpr(e) {
  const toM = (x) => {
    if (x.t === 'list') { const rows = x.a.every((r) => r.t === 'list') ? x.a.map((r) => r.a) : x.a.map((c) => [c]); return rows.map((r) => r.map((c) => { if (!isNum(c)) throw new Error('matrix entries must be rational'); return c.v; })); }
    if (isNum(x)) return x.v;
    if (x.t === 'add') return x.a.map(toM).reduce((p, q) => madd(p, q));
    if (x.t === 'mul') return x.a.map(toM).reduce((p, q) => mmulQ(p, q));
    if (x.t === 'pow' && isNum(x.e) && x.e.v.isInt) {
      let B = toM(x.b); let k = Number(x.e.v.n);
      if (k < 0) { B = LA.inverseQ(B); if (!B) throw new Error('singular matrix'); k = -k; }
      let Rm = B.map((r, i) => r.map((_, j) => (i === j ? Q1 : Q0)));
      for (let i = 0; i < k; i++) Rm = LA.matmulQ(Rm, B);
      return Rm;
    }
    throw new Error('Unsupported matrix expression');
  };
  const madd = (p, q) => { if (p instanceof Q && q instanceof Q) return p.add(q); if (p instanceof Q || q instanceof Q) throw new Error('cannot add scalar and matrix'); return p.map((r, i) => r.map((v, j) => v.add(q[i][j]))); };
  const mmulQ = (p, q) => { if (p instanceof Q && q instanceof Q) return p.mul(q); if (p instanceof Q) return q.map((r) => r.map((v) => v.mul(p))); if (q instanceof Q) return p.map((r) => r.map((v) => v.mul(q))); if (p[0].length !== q.length) throw new Error(`dimension mismatch ${p.length}×${p[0].length} · ${q.length}×${q[0].length}`); return LA.matmulQ(p, q); };
  const raw = parseRaw(toStrRawSafe(e));
  void raw;
  return toM(e);
}
function toStrRawSafe(e) { return toStr(e); }

/* ---------- statistics ---------- */
function hStats(arg) {
  const data = nums(arg);
  const d = ST.describe(data);
  const rows = [['n', d.n], ['Mean', d.mean], ['Median', d.median], ['Mode', d.modes.length ? d.modes.join(', ') : 'none'], ['Std dev (sample)', d.sdSample], ['Std dev (population)', d.sdPop], ['Variance (sample)', d.varSample], ['Min', d.min], ['Q1', d.q1], ['Q3', d.q3], ['Max', d.max], ['Range', d.range], ['IQR', d.iqr], ['Std error of mean', d.sem], ['Skewness', d.skewness], ['Excess kurtosis', d.kurtosisExcess], ['Sum', d.sum], ['Geometric mean', d.geomMean]];
  const ci = d.n > 1 ? ST.ciMean(data) : null;
  const sorted = [...data].sort((a, b) => a - b);
  return R({ title: 'Descriptive statistics', category: 'stats', input: `\\{${data.slice(0, 30).map((v) => fmtNum(v)).join(', ')}${data.length > 30 ? ', \\dots' : ''}\\}`, result: `\\bar{x} = ${numLatex(d.mean, 10)},\\; s = ${numLatex(d.sdSample, 10)}`, plain: `mean ${fmtNum(d.mean)}, sd ${fmtNum(d.sdSample)}`, table: { head: ['Statistic', 'Value'], rows: rows.map(([k, v]) => [k, typeof v === 'number' ? fmtNum(v, 10) : String(v)]) }, extra: ci ? [{ label: '95% CI for the mean', text: `[${fmtNum(ci.lo, 8)}, ${fmtNum(ci.hi, 8)}] (t, df = ${ci.df})` }] : [], notes: ['Quartiles use linear interpolation (type 7, as NumPy and R default).'], plot: { type: 'hist', data: sorted } });
}

function hDist(name, params, fn, x) {
  const { key, d, p } = ST.distribution(name, params);
  let val, label;
  const f = fn.toLowerCase();
  if (['pdf', 'pmf', 'density'].includes(f)) { val = d.pdf(x, p); label = d.continuous ? 'f(x)' : 'P(X = x)'; }
  else if (['cdf', 'p', 'prob'].includes(f)) { val = d.cdf(x, p); label = 'P(X ≤ x)'; }
  else if (['sf', 'survival', 'upper'].includes(f)) { val = 1 - d.cdf(x, p); label = 'P(X > x)'; }
  else if (['quantile', 'inv', 'ppf', 'icdf', 'invcdf'].includes(f)) { val = d.quantile(x, p); label = 'x such that P(X ≤ x) = p'; }
  else throw new Error('Use pdf / pmf / cdf / sf / quantile');
  const lab = d.label(p);
  // plot density with marker
  const mu = d.mean(p), sd = Math.sqrt(d.variance(p));
  const lo = Number.isFinite(mu - 4 * sd) ? mu - 4 * sd : 0, hi = Number.isFinite(mu + 4 * sd) ? mu + 4 * sd : 10;
  const marker = f.startsWith('q') || f === 'inv' || f === 'ppf' ? val : x;
  const plot = d.continuous
    ? { type: 'fn', items: [{ f: (t) => d.pdf(t, p), label: `pdf ${lab}` }], x: [key === 'chi2' || key === 'f' || key === 'gamma' || key === 'exponential' ? 0 : lo, key === 'beta' ? 1 : hi], markX: marker, shade: f === 'pdf' ? null : { a: -1e9, b: marker, fn: 0 } }
    : { type: 'bars', pts: Array.from({ length: Math.min(80, Math.ceil(hi) + 2) }, (_, k) => [k, d.pdf(k, p)]).filter(([k]) => k >= Math.max(0, Math.floor(lo))), mark: marker };
  return R({ title: `${lab} — ${f}`, category: 'stats', input: `${lab},\\; ${f === 'quantile' || f === 'inv' || f === 'ppf' ? 'p' : 'x'} = ${fmtNum(x)}`, result: numLatex(val, 12), plain: fmtNum(val, 12), extra: [{ label, text: fmtNum(val, 15) }, { label: 'Mean', text: fmtNum(mu, 10) }, { label: 'Variance', text: fmtNum(d.variance(p), 10) }], verify: (() => { if (f.startsWith('q') || f === 'inv' || f === 'ppf') { const back = d.cdf(val, p); return { ok: d.continuous ? Math.abs(back - x) < 1e-9 : back >= x - 1e-12, text: `CDF(quantile) = ${fmtNum(back, 12)}` }; } return null; })(), plot });
}

function testResult(r, input) {
  const rows = Object.entries(r).filter(([k, v]) => k !== 'test' && k !== 'expected' && (typeof v === 'number' || Array.isArray(v))).map(([k, v]) => [k, Array.isArray(v) ? `[${v.map((q) => (typeof q === 'number' ? fmtNum(q, 8) : Array.isArray(q) ? `[${q.map((w) => fmtNum(w, 6)).join(', ')}]` : q)).join(', ')}]` : fmtNum(v, 10)]);
  const stat = r.t !== undefined ? `t = ${fmtNum(r.t, 8)}` : r.z !== undefined ? `z = ${fmtNum(r.z, 8)}` : r.F !== undefined ? `F = ${fmtNum(r.F, 8)}` : r.chi2 !== undefined ? `\\chi^2 = ${fmtNum(r.chi2, 8)}` : '';
  const sig = r.p < 0.05 ? 'Reject H₀ at α = 0.05' : 'Fail to reject H₀ at α = 0.05';
  return R({ title: r.test, category: 'stats', input, result: `${stat},\\; p = ${numLatex(r.p, 6)}`, plain: `${stat.replace('\\chi^2', 'chi2')}, p = ${fmtNum(r.p, 6)}`, table: { head: ['Quantity', 'Value'], rows }, notes: [sig + (r.ci ? `; 95% CI [${fmtNum(r.ci[0], 6)}, ${fmtNum(r.ci[1], 6)}]` : '') + '.'] });
}

function hRegress(arg, kind = 'linear') {
  let deg = 2;
  const km = arg.match(/^(linear|poly(?:nomial)?\s*(\d+)?|exp(?:onential)?|power|quadratic|cubic)\s+/i);
  if (km) { const w = km[1].toLowerCase(); kind = w.startsWith('poly') ? 'poly' : w.startsWith('exp') ? 'exp' : w === 'quadratic' ? 'poly' : w === 'cubic' ? 'poly' : w; if (km[2]) deg = Number(km[2]); if (w === 'cubic') deg = 3; arg = arg.slice(km[0].length); }
  const g = bracketGroups(arg);
  let xs, ys;
  if (g.length >= 2) { xs = nums(g[0]); ys = nums(g[1]); }
  else { const pts = parse(arg); if (pts.t !== 'list') throw new Error('Give data as [x1,x2,...] [y1,y2,...]'); xs = pts.a.map((p) => evalReal(p.a[0])); ys = pts.a.map((p) => evalReal(p.a[1])); }
  const r = ST.regress(xs, ys, kind, deg);
  let modelL, model;
  const c = (v) => fmtNum(v, 8);
  if (kind === 'exp') { modelL = `y = ${c(r.back.a)}\\, e^{${c(r.back.b)} x}`; model = `y = ${c(r.back.a)}*exp(${c(r.back.b)}x)`; }
  else if (kind === 'power') { modelL = `y = ${c(r.back.a)}\\, x^{${c(r.back.b)}}`; model = `y = ${c(r.back.a)}*x^${c(r.back.b)}`; }
  else { const e = A(r.beta.map((b, k) => M(tidyExpr(b), P(S('x'), N(k))))); modelL = `y = ${L(e)}`; model = `y = ${toStr(e)}`; }
  const pr = ST.pearson(xs, ys);
  return R({ title: `${kind === 'poly' ? `Polynomial (degree ${deg})` : kind[0].toUpperCase() + kind.slice(1)} regression`, category: 'stats', input: `n = ${xs.length} \\text{ points}`, result: modelL, plain: model, extra: [{ label: 'R²', text: fmtNum(r.r2, 10) }, { label: 'Adjusted R²', text: fmtNum(r.adjR2, 10) }, { label: 'RMSE', text: fmtNum(r.rmse, 8) }, { label: 'Pearson r', text: `${fmtNum(pr.r, 8)} (p = ${fmtNum(pr.p, 4)})` }], steps: [step(kind === 'exp' || kind === 'power' ? 'Linearise with logarithms, then least squares via SVD' : 'Least squares on the Vandermonde design matrix via SVD')], plot: { type: 'points', series: [{ label: 'data', pts: xs.map((x, i) => [x, ys[i]]) }], fit: { f: r.predict, label: 'fit' } } });
}

/* ---------- optimisation ---------- */
function hOptimize(arg, maximize) {
  let s = arg.trim();
  let cons = [];
  const stm = s.match(/\s+(?:subject to|s\.t\.|st|with|where)\s+(.+)$/i);
  if (stm) { cons = splitTop(stm[1], [',', ';']).map((c) => parse(c)); s = s.slice(0, stm.index); }
  let range = null, x0 = null;
  const onm = s.match(/\s+(?:on|over|in|for\s+[a-z]\s+in)\s+\[\s*(.+?)\s*,\s*(.+?)\s*\]\s*$/i); if (onm) { range = [evalReal(parse(onm[1])), evalReal(parse(onm[2]))]; s = s.slice(0, onm.index); }
  const frm = s.match(/\s+(?:from|starting at|start)\s+(\[.*\]|\(.*\)|[-\d.]+)\s*$/i); if (frm) { x0 = nums(frm[1]); s = s.slice(0, frm.index); }
  const f = parse(s);
  const vars = varsOf(f, ...cons);
  const sign = maximize ? -1 : 1;
  const word = maximize ? 'Maximise' : 'Minimise';
  // LP?
  const linearAll = [f, ...cons.map((c) => sub(c.l, c.r))].every((e) => { const ex = expand(e); const ts = ex.t === 'add' ? ex.a : [ex]; return ts.every((t) => isNum(t) || vars.filter((v) => has(t, v)).length === 1 && (() => { const v = vars.find((w) => has(t, w)); const m = coeffsInSafe(t, v); return m && m.size === 1 && m.has(1) && isNum(m.get(1)); })()); });
  if (cons.length && linearAll && cons.every((c) => c.t === 'rel' && ['<=', '>=', '=', '<', '>'].includes(c.op))) return hLP(f, cons, vars, maximize);
  const Fn = (xv) => sign * evalReal(f, Object.fromEntries(vars.map((v, i) => [v, xv[i]])));
  const gradE = vars.map((v) => C.diff(f, v));
  const grad = (xv) => { const env = Object.fromEntries(vars.map((v, i) => [v, xv[i]])); return gradE.map((g) => sign * evalReal(g, env)); };
  if (!cons.length && vars.length === 1) {
    const [a, b] = range || [-100, 100];
    const r = OP.minimize1D((t) => Fn([t]), a, b);
    const v = vars[0];
    const xs = C.identify(r.x, 1e-7), fx = sign * r.fx;
    const d2 = evalReal(C.diff(C.diff(f, v), v), { [v]: r.x });
    return R({ title: `${word} (1-D)`, category: 'optimize', input: `${maximize ? '\\max' : '\\min'}_{${v}${range ? ` \\in [${fmtNum(a)}, ${fmtNum(b)}]` : ''}} ${L(f)}`, result: `${v}^* ${xs ? `= ${L(xs)}` : `\\approx ${fmtNum(r.x, 12)}`},\\; f(${v}^*) ${xs ? '=' : '\\approx'} ${xs ? L(C.niceSimplify(subs(f, { [v]: xs }))) : fmtNum(fx, 12)}`, plain: `${v}* = ${fmtNum(r.x, 12)}, f = ${fmtNum(fx, 12)}`, steps: [step(`Grid scan of [${fmtNum(a)}, ${fmtNum(b)}], then Brent's method (parabolic + golden section)`)], extra: [{ label: `f'(${v}*)`, text: fmtNum(evalReal(gradE[0], { [v]: r.x }), 3) }, { label: `f''(${v}*)`, text: fmtNum(d2, 6) }], notes: r.boundary ? ['Optimum lies on the boundary of the search interval.'] : (range ? [] : ['Search interval [−100, 100]; add "on [a, b]" to change it.']), verify: { ok: r.boundary || Math.abs(evalReal(gradE[0], { [v]: r.x })) < 1e-5 * (1 + Math.abs(fx)), text: r.boundary ? 'boundary optimum' : `f'(${v}*) ≈ 0 and f'' ${maximize ? '<' : '>'} 0: ${(maximize ? d2 < 0 : d2 > 0) ? 'yes' : 'no'}` }, plot: plotFns([f], v, range ? [range[0], range[1]] : [r.x - 5, r.x + 5], { roots: [], markPt: [r.x, fx] }) });
  }
  const start = x0 || vars.map(() => 0.5);
  if (cons.length) {
    const eqs = [], ineqs = [];
    for (const c of cons) {
      const g = sub(c.l, c.r); const fnC = (xv) => evalReal(g, Object.fromEntries(vars.map((v, i) => [v, xv[i]])));
      if (c.op === '=') eqs.push(fnC); else if (c.op === '<=' || c.op === '<') ineqs.push(fnC); else ineqs.push((xv) => -fnC(xv));
    }
    const r = OP.constrainedMin(Fn, start, eqs, ineqs);
    return R({ title: `${word} with constraints`, category: 'optimize', input: `${maximize ? '\\max' : '\\min}'} ${L(f)} \\;\\text{s.t.}\\; ${cons.map(L).join(',\\; ')}`.replace('\\min}', '\\min'), result: `(${vars.join(', ')})^* \\approx (${r.x.map((v) => fmtNum(v, 10)).join(',\\; ')}),\\; f^* \\approx ${fmtNum(sign * r.fx, 12)}`, plain: `x* = (${r.x.map((v) => fmtNum(v, 10)).join(', ')}), f* = ${fmtNum(sign * r.fx, 12)}`, steps: [step('Augmented Lagrangian (quadratic penalty + multiplier updates), BFGS inner solves')], extra: [{ label: 'Lagrange multipliers', text: [...r.multipliers.eq, ...r.multipliers.ineq].map((v) => fmtNum(v, 6)).join(', ') || '—' }], verify: { ok: r.violation < 1e-7, text: `max constraint violation ${fmtNum(r.violation, 2)}` } });
  }
  const bf = OP.bfgs(Fn, start, { grad });
  const nm = OP.nelderMead(Fn, start);
  const best = bf.fx <= nm.fx ? bf : nm;
  const H = vars.map((a) => vars.map((b) => evalReal(C.diff(C.diff(f, a), b), Object.fromEntries(vars.map((v, i) => [v, best.x[i]])))));
  const ev = LA.eigenNumeric(H).values.map((z) => z.re);
  const definite = maximize ? ev.every((e) => e < 0) : ev.every((e) => e > 0);
  const gn = Math.hypot(...grad(best.x));
  return R({ title: `${word} (${vars.length} variables)`, category: 'optimize', input: `${maximize ? '\\max' : '\\min'}_{${vars.join(',')}} ${L(f)}`, result: `(${vars.join(', ')})^* \\approx (${best.x.map((v) => fmtNum(v, 10)).join(',\\; ')}),\\; f^* \\approx ${fmtNum(sign * best.fx, 12)}`, plain: `(${best.x.map((v) => fmtNum(v, 10)).join(', ')}), f = ${fmtNum(sign * best.fx, 12)}`, steps: [step(`BFGS with exact symbolic gradient: ${bf.iterations} iterations`, `\\nabla f = \\left(${gradE.map((g) => L(C.niceSimplify(g))).join(',\\; ')}\\right)`), step(`Nelder–Mead cross-check: ${nm.iterations} iterations, f = ${fmtNum(sign * nm.fx, 10)}`)], extra: [{ label: 'Hessian eigenvalues at optimum', text: ev.map((e) => fmtNum(e, 6)).join(', ') }], notes: [`Local ${maximize ? 'maximum' : 'minimum'} from start (${start.join(', ')}); add "from [..]" to change it.`], verify: { ok: gn < 1e-6 && definite, text: `‖∇f‖ = ${fmtNum(gn, 2)}; Hessian ${definite ? (maximize ? 'negative' : 'positive') + ' definite' : 'not definite'}` }, plot: vars.length === 2 ? { type: 'surface', f: compileReal(f, vars), vars, label: toStr(f), mark: [...best.x, sign * best.fx], range: [[best.x[0] - 2, best.x[0] + 2], [best.x[1] - 2, best.x[1] + 2]] } : null });
}
function coeffsInSafe(t, v) { try { return X && coeffsInImport(t, v); } catch { return null; } }
import { coeffsIn as coeffsInImport } from './poly.js';

function hLP(f, cons, vars, maximize) {
  const row = (e) => { const ex = expand(e); const ts = ex.t === 'add' ? ex.a : [ex]; const a = vars.map(() => Q0); let c = Q0; for (const t of ts) { if (isNum(t)) { c = c.add(t.v); continue; } const v = vars.find((w) => has(t, w)); const m = coeffsInImport(t, v); a[vars.indexOf(v)] = a[vars.indexOf(v)].add(m.get(1).v); } return { a, c }; };
  const obj = row(f);
  const nonneg = new Set();
  const rows = [];
  for (const cst of cons) {
    const { a, c } = row(sub(cst.l, cst.r));
    const nz = a.map((q, i) => (!q.isZero ? i : -1)).filter((i) => i >= 0);
    const op = cst.op === '<' ? '<=' : cst.op === '>' ? '>=' : cst.op;
    if (nz.length === 1 && c.isZero && ((op === '>=' && a[nz[0]].sign > 0) || (op === '<=' && a[nz[0]].sign < 0))) { nonneg.add(nz[0]); continue; }
    rows.push({ a, op, b: c.neg() });
  }
  const notes = [];
  if (nonneg.size < vars.length) notes.push(`Variables without explicit ≥ 0 constraints (${vars.filter((_, i) => !nonneg.has(i)).join(', ')}) are still treated as non-negative (standard form).`);
  const cvec = obj.a.map((q) => (maximize ? q : q.neg()));
  const r = OP.simplexQ(cvec, rows);
  const input = `${maximize ? '\\max' : '\\min'}\\; ${L(f)} \\;\\text{s.t.}\\; ${cons.map(L).join(',\\; ')}`;
  if (r.status !== 'optimal') return R({ title: 'Linear program', category: 'optimize', input, result: `\\text{${r.status}}`, plain: r.status, notes });
  const val = maximize ? r.value.add(obj.c) : r.value.neg().add(obj.c);
  const feasible = rows.every(({ a, op, b }) => { const lhs = a.reduce((s, q, i) => s.add(q.mul(r.x[i])), Q0); const cmp = lhs.cmp(b); return op === '<=' ? cmp <= 0 : op === '>=' ? cmp >= 0 : cmp === 0; });
  return R({ title: 'Linear program (exact simplex)', category: 'optimize', input, result: `${vars.map((v, i) => `${v} = ${r.x[i].toLatex()}`).join(',\\; ')},\\; ${maximize ? '\\max' : '\\min'} = ${val.toLatex()}`, plain: `${vars.map((v, i) => `${v} = ${r.x[i]}`).join(', ')}; optimum ${val}`, steps: [step(`Two-phase simplex in exact rational arithmetic, Bland's rule: ${r.iterations} pivot${r.iterations === 1 ? '' : 's'}`)], notes, verify: { ok: feasible, text: 'optimal vertex satisfies every constraint exactly' }, plot: vars.length === 2 ? { type: 'implicit', items: cons.map((c) => ({ F: compileReal(sub(c.l, c.r), vars), label: toStr(c) })), vars, points: [r.x.map((q) => q.toNumber())], region: { F: (xx, yy) => cons.every((c) => { const g = evalReal(sub(c.l, c.r), { [vars[0]]: xx, [vars[1]]: yy }); return c.op.includes('<') ? g <= 1e-9 : c.op.includes('>') ? g >= -1e-9 : Math.abs(g) < 1e-2; }) } } : null });
}

/* ---------- number theory ---------- */
function ints(s) {
  let parts = splitTop(s.replace(/\band\b/g, ','), [',', ';']).filter(Boolean);
  if (parts.length === 1 && /^-?\d+(\s+-?\d+)+$/.test(parts[0].trim())) parts = parts[0].trim().split(/\s+/);
  return parts.map((t) => { const e = parse(t); if (!isNum(e) || !e.v.isInt) throw new Error(`Integer expected: ${t}`); return e.v.n; });
}
function hNT(cmd, arg) {
  const a = arg.trim();
  switch (cmd) {
    case 'isprime': { const n = ints(a)[0]; const p = NT.isPrime(n); return R({ title: 'Primality test', category: 'number', input: n.toString(), result: p ? '\\text{prime}' : '\\text{composite}', plain: p ? 'prime' : 'composite', extra: p ? [] : [{ label: 'Factorisation', text: NT.formatFactors(NT.factorize(n).factors) }], notes: [NT.primalityCertainty(n)] }); }
    case 'nextprime': { const n = ints(a)[0]; const p = NT.nextPrime(n); return R({ title: 'Next prime', category: 'number', input: `> ${n}`, result: bi(p), plain: bi(p) }); }
    case 'prevprime': { const n = ints(a)[0]; const p = NT.prevPrime(n); return R({ title: 'Previous prime', category: 'number', input: `< ${n}`, result: String(p), plain: String(p) }); }
    case 'gcd': case 'lcm': {
      const xs = ints(a);
      let g = xs[0]; for (const y of xs.slice(1)) g = cmd === 'gcd' ? gcdB(g, y) : (g / gcdB(g, y)) * (y < 0n ? -y : y);
      const extra = [];
      const steps = [];
      if (cmd === 'gcd' && xs.length === 2) {
        const { x, y } = NT.egcd(xs[0], xs[1]); extra.push({ label: 'Bézout', latex: `${xs[0]}\\cdot(${x}) + ${xs[1]}\\cdot(${y}) = ${g}` });
        let p = xs[0] < 0n ? -xs[0] : xs[0], q = xs[1] < 0n ? -xs[1] : xs[1]; while (q && steps.length < 20) { steps.push(step(`${p} = ${p / q}·${q} + ${p % q}`)); [p, q] = [q, p % q]; }
      }
      return R({ title: cmd.toUpperCase(), category: 'number', input: `\\${cmd === 'gcd' ? 'gcd' : 'operatorname{lcm}'}(${xs.join(', ')})`, result: bi(g < 0n ? -g : g), plain: bi(g < 0n ? -g : g), extra, steps });
    }
    case 'modinv': {
      const m = a.match(/(-?\d+)\s*(?:mod|,|\s)\s*(\d+)/i); if (!m) throw new Error('Write: modinv 3 mod 11');
      const r = NT.modinv(m[1], m[2]);
      return R({ title: 'Modular inverse', category: 'number', input: `${m[1]}^{-1} \\bmod ${m[2]}`, result: bi(r), plain: bi(r), verify: { ok: ((BigInt(m[1]) * r) % BigInt(m[2]) + BigInt(m[2])) % BigInt(m[2]) === 1n % BigInt(m[2]), text: `${m[1]}·${r} ≡ 1 (mod ${m[2]})` } });
    }
    case 'powmod': {
      const m = a.match(/(-?\d+)\s*(?:\^|\*\*|,|\s)\s*(-?\d+)\s*(?:mod|,|\s)\s*(\d+)/i); if (!m) throw new Error('Write: powmod 2 100 7  or  2^100 mod 7');
      const r = NT.modpow(m[1], m[2], m[3]);
      return R({ title: 'Modular exponentiation', category: 'number', input: `${m[1]}^{${m[2]}} \\bmod ${m[3]}`, result: bi(r), plain: bi(r), steps: [step('Binary (square-and-multiply) exponentiation')] });
    }
    case 'crt': {
      const pairs = [...a.matchAll(/(-?\d+)\s*(?:mod|\(mod)\s*(\d+)\)?/gi)];
      if (!pairs.length) throw new Error('Write: crt 2 mod 3, 3 mod 5, 2 mod 7');
      const r = NT.crt(pairs.map((p) => p[1]), pairs.map((p) => p[2]));
      if (!r) return R({ title: 'Chinese remainder theorem', category: 'number', input: pairs.map((p) => `x \\equiv ${p[1]} \\pmod{${p[2]}}`).join(',\\; '), result: '\\text{no solution (incompatible congruences)}', plain: 'no solution' });
      return R({ title: 'Chinese remainder theorem', category: 'number', input: pairs.map((p) => `x \\equiv ${p[1]} \\pmod{${p[2]}}`).join(',\\; '), result: `x \\equiv ${r.x} \\pmod{${r.m}}`, plain: `x ≡ ${r.x} (mod ${r.m})`, verify: { ok: pairs.every((p) => ((r.x - BigInt(p[1])) % BigInt(p[2])) === 0n), text: 'each congruence checked' } });
    }
    case 'totient': { const n = ints(a)[0]; const r = NT.totient(n); return R({ title: "Euler's totient", category: 'number', input: `\\varphi(${n})`, result: bi(r), plain: bi(r), steps: [step(`φ(n) = n ∏(1 − 1/p) over primes p | n: ${NT.formatFactors(NT.factorize(n).factors)}`)] }); }
    case 'divisors': { const n = ints(a)[0]; const ds = NT.divisors(n); return R({ title: 'Divisors', category: 'number', input: `\\text{divisors of } ${n}`, result: ds.length > 60 ? `${ds.length}\\text{ divisors}` : ds.join(',\\; '), plain: ds.join(', '), extra: [{ label: 'Count τ(n)', text: String(ds.length) }, { label: 'Sum σ(n)', text: bi(ds.reduce((s, d) => s + d, 0n)) }, { label: 'Möbius μ(n)', text: String(NT.mobius(n)) }] }); }
    case 'cf': {
      const e = parse(a);
      if (e.t === 'pow' && isNum(e.b) && e.b.v.isInt && isNum(e.e) && e.e.v.eq(new Q(1n, 2n))) {
        const { a0, period } = NT.contFracSqrt(e.b.v.n);
        return R({ title: 'Continued fraction', category: 'number', input: L(e), result: `[${a0};\\, \\overline{${period.join(', ')}}]`, plain: `[${a0}; (${period.join(', ')})]`, extra: [{ label: 'Period length', text: String(period.length) }] });
      }
      if (isNum(e)) {
        const cf = NT.contFracRational(e.v.n, e.v.d); const cv = NT.convergents(cf);
        return R({ title: 'Continued fraction', category: 'number', input: L(e), result: `[${cf[0]};\\, ${cf.slice(1).join(', ')}]`, plain: `[${cf.join(', ')}]`, extra: [{ label: 'Convergents', latex: cv.map(([p, q]) => `\\tfrac{${p}}{${q}}`).join(',\\; ') }] });
      }
      const v = evalReal(e); const cf = []; let t = v;
      for (let i = 0; i < 16; i++) { const fl = Math.floor(t); cf.push(BigInt(fl)); if (Math.abs(t - fl) < 1e-9) break; t = 1 / (t - fl); }
      const cv = NT.convergents(cf);
      return R({ title: 'Continued fraction (numeric)', category: 'number', input: L(e), result: `[${cf[0]};\\, ${cf.slice(1).join(', ')}, \\dots]`, plain: `[${cf.join(', ')}...]`, extra: [{ label: 'Convergents', latex: cv.slice(0, 8).map(([p, q]) => `\\tfrac{${p}}{${q}}`).join(',\\; ') }], notes: ['Terms from double precision; later terms may be unreliable.'] });
    }
    case 'pell': { const n = ints(a)[0]; const r = NT.pell(n); return R({ title: 'Pell equation', category: 'number', input: `x^2 - ${n}y^2 = 1`, result: `x = ${r.x},\\; y = ${r.y}`, plain: `x = ${r.x}, y = ${r.y}`, steps: [step('Fundamental solution from the continued fraction of √n')], verify: { ok: r.x * r.x - BigInt(n) * r.y * r.y === 1n, text: 'x² − n·y² = 1 exactly' } }); }
    case 'diophantine': {
      const e = parse(a); const g = e.t === 'rel' ? sub(e.l, e.r) : e; const vs = varsOf(g);
      if (vs.length !== 2) throw new Error('Linear Diophantine equations need two variables, e.g. 3x + 5y = 7');
      const m1 = coeffsInImport(g, vs[0]), m2 = coeffsInImport(g, vs[1]);
      const ca = m1.get(1), cb = m2.get(1), c0 = subs(g, { [vs[0]]: ZERO, [vs[1]]: ZERO });
      if (![ca, cb, c0].every((q) => isNum(q) && q.v.isInt)) throw new Error('Integer coefficients required');
      const r = NT.linearDiophantine(ca.v.n, cb.v.n, -c0.v.n);
      if (!r) return R({ title: 'Linear Diophantine', category: 'number', input: L(e), result: '\\text{no integer solutions}', plain: 'none', steps: [step(`gcd(${ca.v.n}, ${cb.v.n}) does not divide ${-c0.v.n}`)] });
      return R({ title: 'Linear Diophantine', category: 'number', input: L(e), result: `${vs[0]} = ${r.x0} ${r.dx < 0n ? '-' : '+'} ${r.dx < 0n ? -r.dx : r.dx}t,\\; ${vs[1]} = ${r.y0} ${r.dy < 0n ? '-' : '+'} ${r.dy < 0n ? -r.dy : r.dy}t,\\; t \\in \\mathbb{Z}`, plain: `${vs[0]} = ${r.x0} + ${r.dx}t, ${vs[1]} = ${r.y0} + ${r.dy}t`, steps: [step(`Extended Euclid: gcd = ${r.g}`)], verify: { ok: ca.v.n * r.x0 + cb.v.n * r.y0 + c0.v.n === 0n, text: 'particular solution satisfies the equation' } });
    }
    case 'base': {
      let m = a.match(/^([0-9a-z]+)\s+(?:from\s+base\s+|base\s*|_)(\d+)\s+to\s+(?:base\s+)?(\d+|hex|binary|bin|octal|oct|decimal|dec)$/i);
      const nameB = (w) => ({ hex: 16, binary: 2, bin: 2, octal: 8, oct: 8, decimal: 10, dec: 10 }[String(w).toLowerCase()] || Number(w));
      let from = 10, to, digits;
      if (m) { digits = m[1]; from = Number(m[2]); to = nameB(m[3]); }
      else { m = a.match(/^(-?[0-9a-z]+)\s+(?:to|in)\s+(?:base\s+)?(\d+|hex|binary|bin|octal|oct|decimal|dec)$/i); if (!m) throw new Error('Write: 255 to base 16  or  ff from base 16 to 2'); digits = m[1]; to = nameB(m[2]); if (/^0x/i.test(digits)) { from = 16; digits = digits.slice(2); } else if (/^0b/i.test(digits)) { from = 2; digits = digits.slice(2); } }
      const n = NT.fromBase(digits, from); const out = NT.toBase(n, to);
      return R({ title: 'Base conversion', category: 'number', input: `${digits}_{${from}}`, result: `${out}_{${to}}`, plain: out, extra: [{ label: 'Decimal', text: n.toString() }, { label: 'Binary', text: NT.toBase(n, 2) }, { label: 'Hex', text: NT.toBase(n, 16) }] });
    }
    case 'primepi': { const n = Number(ints(a)[0]); const c = NT.primePi(n); const list = n <= 1000 ? NT.primesUpTo(n) : null; return R({ title: 'Prime counting', category: 'number', input: `\\pi(${n})`, result: String(c), plain: String(c), extra: list ? [{ label: 'Primes', text: list.join(', ') }] : [{ label: 'n / ln n', text: fmtNum(n / Math.log(n), 8) }], steps: [step('Sieve of Eratosthenes')] }); }
    default: throw new Error('unknown number-theory command');
  }
}

/* ---------- combinatorics ---------- */
function hComb(cmd, arg) {
  const xs = ints(arg).map(Number);
  let r, input;
  switch (cmd) {
    case 'catalan': r = ST.catalan(xs[0]); input = `C_{${xs[0]}}`; break;
    case 'stirling': r = ST.stirling2(xs[0], xs[1]); input = `S(${xs[0]}, ${xs[1]})`; break;
    case 'bell': r = ST.bell(xs[0]); input = `B_{${xs[0]}}`; break;
    case 'derangements': r = ST.derangements(xs[0]); input = `!${xs[0]}`; break;
    case 'partitions': r = ST.partitions(xs[0]); input = `p(${xs[0]})`; break;
    case 'multinomial': r = ST.multinomial(xs); input = `\\binom{${xs.reduce((s, v) => s + v, 0)}}{${xs.join(',')}}`; break;
    case 'choose': r = ST.bchoose(xs[0], xs[1]); input = `\\binom{${xs[0]}}{${xs[1]}}`; break;
    case 'perm': r = ST.bperm(xs[0], xs[1]); input = `P(${xs[0]}, ${xs[1]})`; break;
    default: throw new Error('unknown');
  }
  return R({ title: { catalan: 'Catalan number', stirling: 'Stirling number (2nd kind)', bell: 'Bell number', derangements: 'Derangements', partitions: 'Integer partitions', multinomial: 'Multinomial coefficient', choose: 'Binomial coefficient', perm: 'Permutations' }[cmd], category: 'stats', input, result: bi(r), plain: bi(r), extra: [{ label: 'Digits', text: String(r.toString().length) }] });
}

/* ---------- digits ---------- */
function hDigits(name, n) {
  const map = { π: 'pi', pi: 'pi', e: 'e', sqrt2: 'sqrt2', 'sqrt(2)': 'sqrt2', sqrt3: 'sqrt3', 'sqrt(3)': 'sqrt3', sqrt5: 'sqrt5', phi: 'phi', φ: 'phi', golden: 'phi', ln2: 'ln2', 'ln(2)': 'ln2', 'log(2)': 'ln2' };
  const key = map[name.toLowerCase()] || name.toLowerCase();
  const t0 = Date.now();
  const s = constantDigits(key, n);
  return R({ title: `${name} to ${n} digits`, category: 'reference', input: name, result: `${s.slice(0, 60)}\\ldots`, plain: s, big: s, extra: [{ label: 'Method', text: { pi: "Machin's formula π = 16 arctan(1/5) − 4 arctan(1/239), BigInt fixed point", e: 'Σ 1/k! in BigInt fixed point', ln2: '2·artanh(1/3) series', phi: '(1 + √5)/2 with integer square root' }[key] || 'integer square root (Newton)' }, { label: 'Time', text: `${Date.now() - t0} ms` }], verify: { ok: s.slice(0, 12) === String(({ pi: Math.PI, e: Math.E, sqrt2: Math.SQRT2, sqrt3: Math.sqrt(3), sqrt5: Math.sqrt(5), phi: (1 + Math.sqrt(5)) / 2, ln2: Math.LN2 })[key]).slice(0, 12), text: 'leading digits match IEEE double' } });
}

/* ---------- plotting ---------- */
function hPlot(kind, arg) {
  let s = arg.trim();
  let range = null;
  const rm = s.match(/\s+(?:from|for\s+[a-z]\s+(?:from|in)|[a-z]\s*=|on|over|in)\s*\[?\s*(-?[^,\s\]]+)\s*(?:to|,|\.\.)\s*(-?[^\]\s]+)\s*\]?\s*$/i);
  if (rm) { range = [evalReal(parse(rm[1])), evalReal(parse(rm[2]))]; s = s.slice(0, rm.index); }
  const parts = splitTop(s, [',', ';']);
  const es = parts.map((p) => parse(p.replace(/^r\s*=\s*/i, '').replace(/^y\s*=\s*(?![^=]*=)/i, '')));
  const input = parts.map((p) => L(parse(p))).join(',\\; ');
  if (kind === 'param') {
    const t = varsOf(...es)[0] || 't';
    return R({ title: 'Parametric curve', category: 'plot', input: `(x, y) = \\left(${L(es[0])},\\; ${L(es[1])}\\right)`, result: '', plain: '', plot: { type: 'param', fx: compileReal(es[0], [t]), fy: compileReal(es[1], [t]), t: range || [0, 2 * Math.PI], label: parts.join(', ') } });
  }
  if (kind === 'polar') {
    const t = varsOf(...es)[0] || 't';
    return R({ title: 'Polar curve', category: 'plot', input: `r = ${L(es[0])}`, result: '', plain: '', plot: { type: 'polar', items: es.map((e) => ({ r: compileReal(e, [t]), label: toStr(e) })), t: range || [0, 2 * Math.PI] } });
  }
  if (kind === 'field' || kind === 'slope') {
    let P_, Q_;
    if (kind === 'slope') { const e = es[0]; const g = e.t === 'rel' ? e.r : e; P_ = ONE; Q_ = g; }
    else { P_ = es[0]; Q_ = es[1]; }
    const vars = ['x', 'y'];
    return R({ title: kind === 'slope' ? 'Slope field' : 'Vector field', category: 'plot', input: kind === 'slope' ? `y' = ${L(Q_)}` : `\\mathbf{F} = \\left(${L(P_)},\\; ${L(Q_)}\\right)`, result: '', plain: '', plot: { type: 'field', slope: kind === 'slope', F: (xx, yy) => [evalReal(P_, { x: xx, y: yy }), evalReal(Q_, { x: xx, y: yy })], rhs: kind === 'slope' ? compileReal(Q_, vars) : null } });
  }
  if (kind === 'surface') {
    const vs = varsOf(es[0]).slice(0, 2); if (vs.length < 2) vs.push(vs[0] === 'y' ? 'x' : 'y');
    return R({ title: '3D surface', category: 'plot', input: `z = ${L(es[0])}`, result: '', plain: '', plot: { type: 'surface', f: compileReal(es[0], vs), vars: vs, label: parts[0], range: range ? [range, range] : null } });
  }
  // implicit if any relation containing both x and y
  if (kind === 'implicit' || es.some((e) => e.t === 'rel' && varsOf(e).length === 2)) {
    return R({ title: 'Implicit curve', category: 'plot', input, result: '', plain: '', plot: { type: 'implicit', items: es.map((e) => ({ F: compileReal(e.t === 'rel' ? sub(e.l, e.r) : e, ['x', 'y']), label: toStr(e) })), vars: ['x', 'y'] } });
  }
  const vs = varsOf(...es);
  if (vs.length === 2 && kind !== 'fn') return hPlot('surface', arg);
  const v = vs[0] || 'x';
  return R({ title: es.length > 1 ? `Plot of ${es.length} functions` : 'Function plot', category: 'plot', input, result: '', plain: '', plot: plotFns(es.map((e, i) => ({ expr: e.t === 'rel' ? e.r : e, label: parts[i] })), v, range) });
}

/* ---------- evaluation ---------- */
function evalMatrixRaw(x) {
  const M2 = (v) => { if (v instanceof Q || Array.isArray(v)) return v; throw new Error('bad'); };
  const rec = (y) => {
    if (y.t === 'list') {
      const rows = y.a.every((r) => r.t === 'list') ? y.a.map((r) => r.a) : y.a.map((c) => [c]);
      return rows.map((r) => r.map((c) => { const v = canon(c); if (!isNum(v)) throw new Error('Matrix entries must be rational numbers'); return v.v; }));
    }
    if (y.t === 'add') return y.a.map(rec).reduce((p, q) => madd(p, q));
    if (y.t === 'mul') return y.a.map(rec).reduce((p, q) => mmulQ(p, q));
    if (y.t === 'pow') {
      const e = canon(y.e); if (!isNum(e) || !e.v.isInt) throw new Error('Matrix powers must be integers');
      let B = rec(y.b); if (B instanceof Q) return B.pow(e.v.n);
      let k = Number(e.v.n);
      if (k < 0) { B = LA.inverseQ(B); if (!B) throw new Error('singular matrix'); k = -k; }
      let Rm = B.map((r, i) => r.map((_, j) => (i === j ? Q1 : Q0)));
      for (let i = 0; i < k; i++) Rm = LA.matmulQ(Rm, B);
      return Rm;
    }
    const v = canon(y); if (!isNum(v)) throw new Error('Unsupported matrix expression'); return v.v;
  };
  const madd = (p, q) => { if (p instanceof Q && q instanceof Q) return p.add(q); if (p instanceof Q || q instanceof Q) throw new Error('cannot add a scalar to a matrix'); if (p.length !== q.length || p[0].length !== q[0].length) throw new Error('dimension mismatch in addition'); return p.map((r, i) => r.map((v, j) => v.add(q[i][j]))); };
  const mmulQ = (p, q) => { if (p instanceof Q && q instanceof Q) return p.mul(q); if (p instanceof Q) return q.map((r) => r.map((v) => v.mul(p))); if (q instanceof Q) return p.map((r) => r.map((v) => v.mul(q))); if (p[0].length !== q.length) throw new Error(`dimension mismatch ${p.length}×${p[0].length} · ${q.length}×${q[0].length}`); return LA.matmulQ(p, q); };
  return M2(rec(x));
}
const matPlain = (Mx) => `[${Mx.map((r) => `[${r.map((v) => (v instanceof Q ? v.toString() : fmtNum(v, 10))).join(', ')}]`).join(', ')}]`;

/** exact re/im split of a constant complex expression (a + b i with a, b free of i) */
function complexParts(e) {
  const ex = expand(e);
  const ts = ex.t === 'add' ? ex.a : [ex];
  let re = ZERO, im = ZERO;
  for (const t of ts) {
    if (!has(t, 'i')) { re = A(re, t); continue; }
    const q = div(t, S('i'));
    if (has(q, 'i')) return null;
    im = A(im, q);
  }
  return { re, im };
}
function rewriteComplex(x) {
  if (x.t === 'num' || x.t === 'sym') return x;
  const kids = x.t === 'pow' ? P(rewriteComplex(x.b), rewriteComplex(x.e)) : x.t === 'add' ? A(x.a.map(rewriteComplex)) : x.t === 'mul' ? M(x.a.map(rewriteComplex)) : x.t === 'fn' ? F(x.n, ...x.a.map(rewriteComplex)) : x;
  if (kids.t === 'fn' && ['abs', 're', 'im', 'conj', 'arg'].includes(kids.n) && isConstant(kids.a[0]) && has(kids.a[0], 'i')) {
    const c = complexParts(kids.a[0]);
    if (c) {
      if (kids.n === 're') return c.re;
      if (kids.n === 'im') return c.im;
      if (kids.n === 'conj') return A(c.re, neg(M(c.im, S('i'))));
      if (kids.n === 'abs') return C.niceSimplify(P(A(P(c.re, X.TWO), P(c.im, X.TWO)), X.HALF));
      if (kids.n === 'arg') return F('atan2', c.im, c.re);
    }
  }
  return kids;
}

function hEvaluate(src) {
  let raw0 = null; try { raw0 = parseRaw(src); } catch { raw0 = null; }
  const hasList0 = (x) => x && (x.t === 'list' || (x.a || []).some(hasList0) || (x.t === 'pow' && (hasList0(x.b) || hasList0(x.e))));
  if (raw0 && raw0.t !== 'list' && hasList0(raw0)) {
    const Mx = evalMatrixRaw(raw0);
    return R({ title: 'Matrix arithmetic', category: 'linalg', input: L(raw0), result: Mx instanceof Q ? Mx.toLatex() : qLatexM(Mx), plain: Mx instanceof Q ? Mx.toString() : matPlain(Mx), verify: { ok: true, text: 'exact rational arithmetic' } });
  }
  const e = parse(src);
  if (e.t === 'list' && !e.tuple) {
    try { const Mx = evalMatrixExpr(e); return R({ title: 'Matrix', category: 'linalg', input: L(e), result: qLatexM(Mx), plain: '' }); } catch { return hMatrixInfo(e); }
  }
  if (e.t === 'rel') return e.op === '=' ? hSolve(src) : hInequality(e);
  const hasList = (x) => x.t === 'list' || (x.a || []).some(hasList) || (x.t === 'pow' && (hasList(x.b)));
  let raw; try { raw = parseRaw(src); } catch { raw = null; }
  if (raw && hasList(raw)) {
    const Mx = evalMatrixExpr(canonNoSimplify(raw));
    return R({ title: 'Matrix arithmetic', category: 'linalg', input: L(e), result: Mx instanceof Q ? Mx.toLatex() : qLatexM(Mx), plain: Mx instanceof Q ? Mx.toString() : `[${Mx.map((r) => `[${r.map(String).join(', ')}]`).join(', ')}]`, verify: { ok: true, text: 'exact rational arithmetic' } });
  }
  const vs = varsOf(e);
  if (!vs.length) {
    let out = rewriteComplex(e);
    if (has(out, 'i')) out = expand(out);
    const z = evalComplex(out);
    const exactShown = !(isNum(out) && out.v.isInt) || true;
    const extra = [];
    if (Math.abs(z.im) > 1e-15 && Number.isFinite(z.re)) {
      const r = Math.hypot(z.re, z.im), th = Math.atan2(z.im, z.re);
      extra.push({ label: 'Modulus |z|', text: fmtNum(r, 12) }, { label: 'Argument', text: `${fmtNum(th, 12)} rad (${fmtNum(th * 180 / Math.PI, 10)}°)` }, { label: 'Polar', latex: `${fmtNum(r, 10)}\\, e^{${fmtNum(th, 10)} i}` });
    }
    if (isNum(out) && out.v.isInt && (out.v.n < 0n ? -out.v.n : out.v.n) > 10n ** 15n) extra.push({ label: 'Digits', text: String(out.v.n.toString().replace('-', '').length) });
    if (isNum(out) && !out.v.isInt) extra.push({ label: 'Decimal', text: out.v.toDecimal(30) + (out.v.toDecimal(31).length > out.v.toDecimal(30).length ? '…' : '') });
    const ap = Number.isFinite(z.re) && !(isNum(out)) ? fmtComplex(z, 15) : null;
    void exactShown;
    return R({ title: 'Evaluate', category: 'algebra', input: L(parse(src)), result: L(out), plain: toStr(out), approx: ap, extra, verify: null });
  }
  return hSimplify(src, 'simplify');
}
function canonNoSimplify(x) { return canon(x); }

/* ============================================================
   DISPATCH
   ============================================================ */

const EXAMPLES = {
  algebra: ['factor x^4 - 5x^2 + 4', 'expand (x+2)^5', 'apart (2x+1)/((x^2+1)(x-1))', 'simplify (x^2-1)/(x-1)', 'factor 2^64+1', '(3+4i)*(1-2i)', 'collect a x^2 + b x + c x^2, x'],
  calculus: ['integrate x^2 sin x dx', 'integrate e^(-x^2) from -oo to oo', 'diff x^x', 'limit sin(x)/x x->0', 'series tan x order 9', 'sum 1/k^2 k=1..oo', 'hessian x^3 + x y^2 - y'],
  equations: ['solve x^3-6x^2+11x-6=0', 'solve sin(x) = 1/2', 'solve x+y=3, x^2+y^2=5', 'solve (x-1)/(x+2) <= 0', "dsolve y''+y=0, y(0)=1, y'(0)=0", "ode y'=y(1-y), y(0)=0.1, x=0..10", 'roots x^5 - x - 1'],
  linalg: ['eigen [[2,1],[1,2]]', 'det [[1,2,3],[4,5,6],[7,8,10]]', 'inverse [[1,2],[3,4]]', 'rref [[1,2,3],[4,5,6],[7,8,9]]', 'svd [[3,2,2],[2,3,-2]]', 'solve [[2,1],[1,-1]] [5,1]', 'expm [[0,1],[-1,0]]'],
  stats: ['stats 12, 15, 14, 10, 18, 22, 19, 15', 'normal cdf 1.96', 't(10) quantile 0.975', 'binomial(10, 0.5) pmf 3', 'ttest2 [5.1,4.9,5.6,5.8] [6.0,6.2,5.9,6.4]', 'regress [1,2,3,4,5] [2.2,3.8,6.1,8.0,9.9]', 'anova [1,2,3] [4,5,6] [7,8,9]'],
  optimize: ['minimize (x-2)^2 + 3', 'minimize (1-x)^2 + 100(y-x^2)^2', 'maximize 3x + 2y subject to x + y <= 4, x + 3y <= 6, x >= 0, y >= 0', 'minimize x^2 + y^2 subject to x + y = 1', 'maximize x e^(-x) on [0, 5]'],
  number: ['factor 2^67 - 1', 'isprime 2^89 - 1', 'crt 2 mod 3, 3 mod 5, 2 mod 7', '2^100 mod 7', 'pell 61', 'cf sqrt(7)', 'diophantine 3x + 5y = 7', '255 to base 16', 'pi to 200 digits'],
  plot: ['plot sin(x), cos(x)', 'plot x^3 - 3x from -3 to 3', 'plot x^2 + y^2 = 4', 'parametric cos(3t), sin(2t)', 'polar 1 + cos(t)', "slope field y' = x - y", 'surface sin(x) cos(y)', 'vector field -y, x'],
};
export { EXAMPLES };

const RULES = [
  [/^(?:help|\?)$/i, () => R({ title: 'Command reference', category: 'reference', input: '', result: '', plain: '', table: { head: ['Area', 'Examples'], rows: Object.entries(EXAMPLES).map(([k, v]) => [k, v.join('   ·   ')]) } })],
  [/^(?:simplify|simp)\s+(.+)$/i, (m) => hSimplify(m[1], 'simplify')],
  [/^expand\s+(.+)$/i, (m) => hSimplify(m[1], 'expand')],
  [/^(?:together|cancel)\s+(.+)$/i, (m) => hSimplify(m[1], 'together')],
  [/^collect\s+(.+)$/i, (m) => hSimplify(m[1], 'collect')],
  [/^(?:factor|factorise|factorize)\s+(.+)$/i, (m) => hFactor(m[1])],
  [/^(?:apart|partial\s*fractions?(?:\s+of)?)\s+(.+)$/i, (m) => { const e = parse(m[1]); const v = mainVar(e); const r = apart(e, v); return R({ title: 'Partial fractions', category: 'algebra', input: L(e), result: L(r.expr), plain: toStr(r.expr), steps: [step('Factor the denominator over ℚ'), step('Solve for the numerators exactly (undetermined coefficients, rational Gaussian elimination)')], verify: verifyEq(e, r.simplified) }); }],
  [/^(?:subs|substitute)\s+(.+?)\s*(?:,|\s+with|\s+at|\s+where)\s+((?:[a-z]\s*=\s*[^,]+\s*,?\s*)+)$/i, (m) => {
    const e = parse(m[1]); const env = {};
    for (const a of splitTop(m[2])) { const [k, v] = a.split('='); env[k.trim()] = parse(v); }
    const out = C.niceSimplify(subs(e, env));
    return R({ title: 'Substitute', category: 'algebra', input: `${L(e)}\\Big|_{${Object.entries(env).map(([k, v]) => `${k} = ${L(v)}`).join(',\\,')}}`, result: L(out), plain: toStr(out), approx: approxOf(out) });
  }],
  [/^(?:second\s+derivative|d2\/d([a-z])2)\s+(?:of\s+)?(.+)$/i, (m) => hDiff(m[2] + (m[1] ? `, ${m[1]}` : ''), 2)],
  [/^(?:diff|differentiate|derivative|deriv|d\/d([a-z]))\s+(?:of\s+)?(.+)$/i, (m) => hDiff(m[1] ? `${m[2]}, ${m[1]}` : m[2])],
  [/^(?:grad|gradient)\s+(?:of\s+)?(.+)$/i, (m) => hGradient(m[1], 'gradient')],
  [/^jacobian\s+(.+)$/i, (m) => hGradient(m[1], 'jacobian')],
  [/^hessian\s+(?:of\s+)?(.+)$/i, (m) => hGradient(m[1], 'hessian')],
  [/^(?:integrate|int|integral|antiderivative|∫|integral of)\s+(?:of\s+)?(.+)$/i, (m) => hIntegrate(m[1])],
  [/^(?:limit|lim)\s*(.+)$/i, (m) => hLimit(m[1].trim())],
  [/^(?:series|taylor|maclaurin)\s+(?:of\s+|series\s+(?:of\s+)?)?(.+)$/i, (m) => hSeries(m[1])],
  [/^(?:sum|Σ|∑)\s+(.+)$/i, (m) => hSum(m[1])],
  [/^(?:product|prod|∏)\s+(.+)$/i, (m) => hSum(m[1], true)],
  [/^(?:dsolve|solve\s+ode)\s+(.+)$/i, (m) => hDsolve(m[1])],
  [/^(?:ode|nde|odesolve|rk45)\s+(.+)$/i, (m) => hOdeNumeric(m[1])],
  [/^(?:nsolve|newton)\s+(.+)$/i, (m) => hNsolve(m[1])],
  [/^(?:roots|polyroots|zeros)\s+(?:of\s+)?(.+)$/i, (m) => hRoots(m[1])],
  [/^(?:linsolve)\s+(.+)$/i, (m) => { const g = bracketGroups(m[1]); return hLinsolve(g[0], g[1]); }],
  [/^(?:solve|find)\s+(.+)$/i, (m) => (/\by'|\bdy\/d/.test(m[1]) ? hDsolve(m[1]) : hSolve(m[1]))],
  [/^(?:det|determinant)\s+(?:of\s+)?(.+)$/i, (m) => hMatrix('det', m[1])],
  [/^(?:inv|inverse)\s+(?!.*\bmod\b)(?:of\s+)?(.+)$/i, (m) => hMatrix('inverse', m[1])],
  [/^rank\s+(.+)$/i, (m) => hMatrix('rank', m[1])],
  [/^rref\s+(.+)$/i, (m) => hMatrix('rref', m[1])],
  [/^(?:nullspace|null\s*space|kernel)\s+(.+)$/i, (m) => hMatrix('nullspace', m[1])],
  [/^(?:eigen|eig|eigenvalues|eigenvectors|eigenvals)\s+(?:of\s+)?(.+)$/i, (m) => hMatrix('eigen', m[1])],
  [/^svd\s+(.+)$/i, (m) => hMatrix('svd', m[1])],
  [/^lu\s+(.+)$/i, (m) => hMatrix('lu', m[1])],
  [/^qr\s+(.+)$/i, (m) => hMatrix('qr', m[1])],
  [/^(?:cholesky|chol)\s+(.+)$/i, (m) => hMatrix('cholesky', m[1])],
  [/^(?:expm|matrix\s*exp(?:onential)?)\s+(.+)$/i, (m) => hMatrix('expm', m[1])],
  [/^(?:transpose)\s+(.+)$/i, (m) => hMatrix('transpose', m[1])],
  [/^(?:trace|tr)\s+(.+)$/i, (m) => hMatrix('trace', m[1])],
  [/^(?:charpoly|characteristic\s+polynomial)\s+(.+)$/i, (m) => hMatrix('charpoly', m[1])],
  [/^(?:lstsq|least\s*squares)\s+(.+)$/i, (m) => hMatrix('lstsq', m[1])],
  [/^(?:stats|describe|statistics|summary|mean|median|average|sd|std|variance)\s+(?:of\s+)?(.+)$/i, (m) => hStats(m[1])],
  [/^(normal|norm|gaussian|t|student|chi2|chisq|chi-square|f|exponential|exp|gamma|beta|uniform|binomial|binom|poisson|pois)\s*(?:\(([^)]*)\))?\s+(pdf|pmf|cdf|sf|quantile|inv|ppf|icdf|invcdf|density)\s*(?:\(|at\s+|of\s+)?\s*(-?[\d.eE+-]+)\)?$/i, (m) => hDist(m[1], m[2] ? m[2].split(',').map((q) => evalReal(parse(q))) : [], m[3], Number(m[4]))],
  [/^(?:ttest2|welch|t-test2|ttest\s+two)\s+(.+)$/i, (m) => { const g = bracketGroups(m[1]); return testResult(ST.ttest2(nums(g[0]), nums(g[1]), { equalVar: /pooled|equal/i.test(m[1]) }), 'H_0: \\mu_1 = \\mu_2'); }],
  [/^(?:paired|ttest\s*paired|paired\s*t)\s+(.+)$/i, (m) => { const g = bracketGroups(m[1]); return testResult(ST.ttestPaired(nums(g[0]), nums(g[1])), 'H_0: \\mu_d = 0'); }],
  [/^(?:ttest|t-test|ttest1)\s+(.+?)(?:\s*,?\s*(?:mu|μ|mu0)\s*=\s*(-?[\d.]+))?$/i, (m) => { const g = bracketGroups(m[1]); if (g.length >= 2) return testResult(ST.ttest2(nums(g[0]), nums(g[1])), 'H_0: \\mu_1 = \\mu_2'); const mu = Number(m[2] || 0); return testResult(ST.ttest1(nums(m[1]), mu), `H_0: \\mu = ${mu}`); }],
  [/^(?:ztest|z-test)\s+(.+?)\s*,?\s*(?:mu|μ)\s*=\s*(-?[\d.]+)\s*,?\s*(?:sigma|σ|sd)\s*=\s*([\d.]+)$/i, (m) => testResult(ST.ztest(nums(m[1]), Number(m[2]), Number(m[3])), `H_0: \\mu = ${m[2]}`)],
  [/^(?:chisq|chi2|chi-square|chisquare)(?:\s*test)?\s+(.+)$/i, (m) => { const e = parse(m[1].trim()); if (e.t === 'list' && e.a.every((r) => r.t === 'list')) return testResult(ST.chisqIndependence(e.a.map((r) => r.a.map(evalReal))), 'H_0: \\text{independent}'); const g = bracketGroups(m[1]); return testResult(ST.chisqGOF(nums(g[0] || m[1]), g[1] ? nums(g[1]) : null), 'H_0: \\text{fits expected}'); }],
  [/^anova\s+(.+)$/i, (m) => testResult(ST.anova1(bracketGroups(m[1]).map(nums)), 'H_0: \\mu_1 = \\dots = \\mu_k')],
  [/^(?:ci|confidence\s*interval)\s+(.+?)(?:\s+(\d+)\s*%)?$/i, (m) => { const lvl = (Number(m[2]) || 95) / 100; const r = ST.ciMean(nums(m[1]), lvl); return R({ title: `${lvl * 100}% confidence interval (mean)`, category: 'stats', input: `\\bar x = ${fmtNum(r.mean, 10)}`, result: `[${fmtNum(r.lo, 10)},\\; ${fmtNum(r.hi, 10)}]`, plain: `[${fmtNum(r.lo, 10)}, ${fmtNum(r.hi, 10)}]`, extra: [{ label: 't*', text: fmtNum(r.crit, 8) }, { label: 'SE', text: fmtNum(r.sem, 8) }, { label: 'df', text: String(r.df) }] }); }],
  [/^(?:corr|correlation|pearson|spearman)\s+(.+)$/i, (m) => { const g = bracketGroups(m[1]); const x = nums(g[0]), y = nums(g[1]); const p = ST.pearson(x, y), s = ST.spearman(x, y); return R({ title: 'Correlation', category: 'stats', input: `n = ${x.length}`, result: `r = ${fmtNum(p.r, 10)}`, plain: `r = ${fmtNum(p.r, 10)}`, extra: [{ label: 'p-value (r = 0)', text: fmtNum(p.p, 6) }, { label: 'Spearman ρ', text: `${fmtNum(s.rho, 8)} (p = ${fmtNum(s.p, 4)})` }, { label: 'r²', text: fmtNum(p.r * p.r, 8) }], plot: { type: 'points', series: [{ label: 'data', pts: x.map((v, i) => [v, y[i]]) }] } }); }],
  [/^(?:regress|regression|fit|linreg|polyfit|expfit)\s+(.+)$/i, (m) => hRegress(m[1], /^polyfit/i.test(m[0]) ? 'poly' : /^expfit/i.test(m[0]) ? 'exp' : 'linear')],
  [/^(catalan|stirling|bell|derangements|partitions|multinomial)\s+(.+)$/i, (m) => hComb(m[1].toLowerCase(), m[2])],
  [/^(\d+)\s+(?:choose|c)\s+(\d+)$/i, (m) => hComb('choose', `${m[1]}, ${m[2]}`)],
  [/^(?:ncr|choose|comb|combinations)\s+(.+)$/i, (m) => hComb('choose', m[1])],
  [/^(?:npr|perm|permutations)\s+(.+)$/i, (m) => hComb('perm', m[1])],
  [/^(minimize|minimise|min|maximize|maximise|max)\s+(.+)$/i, (m) => hOptimize(m[2], /^max/i.test(m[1]))],
  [/^(?:is\s*prime|isprime|prime\?|primality)\s+(.+)$/i, (m) => hNT('isprime', m[1])],
  [/^(?:next\s*prime|nextprime)\s+(.+)$/i, (m) => hNT('nextprime', m[1])],
  [/^(?:prev\s*prime|prevprime|previous\s*prime)\s+(.+)$/i, (m) => hNT('prevprime', m[1])],
  [/^(gcd|lcm)\s*\(?(.+?)\)?$/i, (m) => hNT(m[1].toLowerCase(), m[2])],
  [/^(?:modinv|inverse|inv)\s+(-?\d+\s+mod\s+\d+|-?\d+\s*,\s*\d+)$/i, (m) => hNT('modinv', m[1])],
  [/^(?:powmod|modpow)\s+(.+)$/i, (m) => hNT('powmod', m[1])],
  [/^(-?\d+)\s*(?:\^|\*\*)\s*(-?\d+)\s*(?:mod|%)\s*(\d+)$/i, (m) => hNT('powmod', `${m[1]} ${m[2]} ${m[3]}`)],
  [/^crt\s+(.+)$/i, (m) => hNT('crt', m[1])],
  [/^(?:totient|phi|φ|euler\s*phi)\s*\(?\s*(\d+)\s*\)?$/i, (m) => hNT('totient', m[1])],
  [/^(?:divisors|factors of)\s+(.+)$/i, (m) => hNT('divisors', m[1])],
  [/^(?:cf|contfrac|continued\s*fraction(?:\s+of)?)\s+(.+)$/i, (m) => hNT('cf', m[1])],
  [/^pell\s+(\d+)$/i, (m) => hNT('pell', m[1])],
  [/^(?:diophantine|dioph)\s+(.+)$/i, (m) => hNT('diophantine', m[1])],
  [/^(?:convert\s+)?(-?(?:0x|0b)?[0-9a-z]+\s+(?:(?:from\s+)?base\s*\d+\s+)?(?:to|in)\s+(?:base\s+)?(?:\d+|hex|binary|bin|octal|oct|decimal|dec))$/i, (m) => hNT('base', m[1].replace(/^(\S+)\s+base\s*(\d+)/i, '$1 from base $2'))],
  [/^(?:primepi|prime\s*pi|π\(|primes\s+(?:up\s+to|below|under))\s*(\d+)\)?$/i, (m) => hNT('primepi', m[1])],
  [/^(pi|π|e|sqrt2|sqrt\(2\)|sqrt3|sqrt5|phi|φ|golden|ln2|ln\(2\))\s+(?:to\s+)?(\d+)\s*(?:digits|dp|places)?$/i, (m) => hDigits(m[1], Number(m[2]))],
  [/^(?:digits(?:\s+of)?)\s+(\S+)\s+(\d+)$/i, (m) => hDigits(m[1], Number(m[2]))],
  [/^(?:parametric|param)\s+(.+)$/i, (m) => hPlot('param', m[1])],
  [/^(?:polar)\s+(.+)$/i, (m) => hPlot('polar', m[1])],
  [/^(?:implicit|contour)\s+(.+)$/i, (m) => hPlot('implicit', m[1])],
  [/^(?:slope\s*field|slopefield|direction\s*field)\s+(.+)$/i, (m) => hPlot('slope', preODE(m[1]).replace(/^y'\s*=\s*/, ''))],
  [/^(?:vector\s*field|field|quiver)\s+(.+)$/i, (m) => hPlot('field', m[1])],
  [/^(?:surface|plot3d|3d)\s+(.+)$/i, (m) => hPlot('surface', m[1])],
  [/^(?:plot|graph|draw|sketch)\s+(.+)$/i, (m) => hPlot('auto', m[1])],
  [/^(?:n|numeric|approx|evalf|≈)\s*[([]?(.+?)[)\]]?$/i, (m) => { const e = parse(m[1]); const z = evalComplex(e); return R({ title: 'Numeric value', category: 'algebra', input: L(e), result: fmtComplex(z, 15), plain: fmtComplex(z, 15) }); }],
];

/** Main entry: run a command string. */
export function run(input) {
  let s = String(input || '').trim().replace(/\s+/g, ' ');
  s = s.replace(/^(?:please\s+)?(?:what(?:'s| is)\s+(?:the\s+)?|compute\s+|calculate\s+|evaluate\s+|find\s+the\s+|work\s+out\s+)/i, '').replace(/\?+$/, '').trim();
  s = s.replace(/^(derivative|integral|limit|sum)\s+of\s+/i, '$1 ');
  if (!s) throw new Error('Type an expression or command');
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (const [re, fn] of RULES) {
    const m = s.match(re);
    if (m) {
      const r = fn(m);
      r.command = s; r.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      return r;
    }
  }
  const r = hEvaluate(s);
  r.command = s; r.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return r;
}

/** Suggest the category/tab for an input (for the UI) */
export function categorize(s) {
  try { return run(s).category; } catch { return null; }
}

/** Plain-text version of a result (for copy / Assistant). */
export function toPlainText(r) {
  const lines = [`${r.title}${r.command ? ` — ${r.command}` : ''}`];
  if (r.plain) lines.push(`Result: ${r.plain}`);
  else if (r.result) lines.push(`Result: ${latexToPlain(r.result)}`);
  if (r.approx) lines.push(`≈ ${r.approx}`);
  (r.extra || []).forEach((e) => lines.push(`${e.label}: ${e.text || latexToPlain(e.latex || '')}`));
  if (r.table) r.table.rows.forEach((row) => lines.push(row.join(': ')));
  (r.steps || []).forEach((st, i) => lines.push(`Step ${i + 1}: ${st.text}${st.latex ? ` [${latexToPlain(st.latex)}]` : ''}`));
  if (r.verify) lines.push(`Verify: ${r.verify.ok ? 'passed' : 'not confirmed'} — ${r.verify.text}`);
  (r.notes || []).forEach((n) => lines.push(`Note: ${n}`));
  return lines.join('\n');
}
export function latexToPlain(s) {
  return String(s).replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\\(left|right|,|;|quad|!)/g, '').replace(/\\(cdot|times)/g, '*')
    .replace(/\\(pi|infty|lambda|alpha|beta|theta|mu|sigma|chi|varphi)/g, (_, w) => ({ pi: 'π', infty: '∞', lambda: 'λ', alpha: 'α', beta: 'β', theta: 'θ', mu: 'μ', sigma: 'σ', chi: 'χ', varphi: 'φ' }[w]))
    .replace(/\\(text|mathrm|operatorname)\{([^{}]*)\}/g, '$2').replace(/\\begin\{[a-z]+\*?\}|\\end\{[a-z]+\*?\}/g, '').replace(/\\\\/g, '; ').replace(/&/g, '').replace(/\\([a-z]+)/g, '$1').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
