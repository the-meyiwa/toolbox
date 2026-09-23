/* ============================================================
   TOOLBOX — Math Utility
   A computational maths workbench: the toolkit frontier models
   reach for (SymPy / NumPy / SciPy-style), in the browser,
   deterministic and verified.

   - One command bar ("integrate x^2 sin x dx", "eigen [[2,1],[1,2]]")
     with live LaTeX preview, mode rail, examples and syntax help
   - Engine: js/lib/mathx/* (exact BigInt rationals, CAS, calculus,
     equations & ODEs, linear algebra, statistics, optimisation,
     number theory, special functions) — DOM-free, node-testable
   - Results as cards: LaTeX input/result, steps, verification line,
     interactive monochrome plots, copy as LaTeX / plain text
   - Reference: knowledge library, sequences & Collatz, four-figure
     tables and constants (kept from the previous version)
   ============================================================ */

import {
  MATH_CATEGORIES,
  PROOF_STATUS,
  MATHEMATICAL_CONSTANTS,
  searchMathKnowledge,
  lookupFourFigureTable
} from '../lib/math-knowledge.js';

import { renderMath, renderMathInText } from '../lib/math-renderer.js';

import {
  calculateCollatz,
  generateFibonacci,
  calculateSequenceTerm,
  generateSequenceRange,
  compareSequences,
  listAllSequences
} from '../lib/math-engine.js';

import { run as runCommand, toPlainText, EXAMPLES } from '../lib/mathx/command.js';
import { parse as parseExpr, toLatex as exprLatex } from '../lib/mathx/expr.js';
import { mountPlot } from '../lib/mathx/plot-view.js';

import { copyText } from '../utils.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const SVG_ICONS = {
  sigma: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4H6l6 8-6 8h12"/></svg>',
  book: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  table: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  run: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  redo: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  warn: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.5"/></svg>',
  chart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15c2-6 4-6 6-2s4 3 6-4"/></svg>',
  cmd: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-5-6-5"/><path d="M12 19h8"/></svg>'
};

const MODES = [
  { id: 'algebra', label: 'Algebra', icon: '<path d="M4 7h7M7.5 3.5v7M13 17h7"/><path d="M4 20l6-6M4 14l6 6"/>' },
  { id: 'calculus', label: 'Calculus', icon: '<path d="M9 21c-1.5 0-2-1-2-2.5V5.5C7 4 7.5 3 9 3"/><path d="M13 17c1.5-4 4.5-4 6-10"/>' },
  { id: 'equations', label: 'Equations', icon: '<path d="M5 9h14M5 15h14"/>' },
  { id: 'linalg', label: 'Linear algebra', icon: '<path d="M7 4H5v16h2M17 4h2v16h-2"/><path d="M10 9h.01M14 9h.01M10 15h.01M14 15h.01"/>' },
  { id: 'stats', label: 'Statistics', icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  { id: 'optimize', label: 'Optimisation', icon: '<path d="M3 5c4 0 5 14 9 14s5-14 9-14"/><circle cx="12" cy="19" r="1.4"/>' },
  { id: 'number', label: 'Number theory', icon: '<path d="M9 3 7 21M17 3l-2 18M4 8h17M3 16h17"/>' },
  { id: 'plot', label: 'Plot', icon: '<path d="M3 3v18h18"/><path d="M7 15c2-6 4-6 6-2s4 3 6-4"/>' },
  { id: 'reference', label: 'Reference', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' }
];

const SYNTAX = {
  algebra: [['simplify E', 'canonical form, cancels, trig identities'], ['expand E', 'multiply out'], ['factor E', 'over ℚ; integers via Pollard ρ'], ['apart E', 'partial fractions'], ['collect E, x', 'group powers of x'], ['subs E, x=2', 'substitute'], ['(3+4i)/(1-2i)', 'exact complex & surd arithmetic']],
  calculus: [['diff E [, x, n]', 'derivative, steps, finite-difference check'], ['integrate E dx', 'antiderivative, verified by differentiation'], ['integrate E from a to b', 'exact + adaptive quadrature (±oo ok)'], ['limit E x->a[+|-]', "L'Hôpital, degree rule, Richardson"], ['series E at a order n', 'Taylor / Maclaurin'], ['sum E k=1..oo', 'closed forms, telescoping, ζ'], ['grad / hessian / jacobian', 'multivariable']],
  equations: [['solve E = F', 'exact roots, surds, general trig solutions'], ['solve e1, e2 [for x, y]', 'exact linear / substitution / Newton'], ['solve E < F', 'sign-chart inequality'], ['roots p(x)', 'all complex roots (Aberth)'], ["dsolve y''+y=0, y(0)=1", 'symbolic ODE + IVP'], ["ode x'=y, y'=-x, x(0)=1, y(0)=0, t=0..10", 'adaptive RK45 + plot'], ['nsolve E, x0', "Newton's method"]],
  linalg: [['det / inverse / rank A', 'exact rational'], ['rref A', 'row operations shown'], ['eigen A', 'exact via char. poly + QR / Jacobi'], ['svd / lu / qr / cholesky A', 'factorisations with residual'], ['nullspace A', 'exact basis'], ['solve A b', 'Ax = b, exact'], ['expm A · lstsq A b', 'matrix exponential, least squares']],
  stats: [['stats 1, 2, 3, …', 'descriptive statistics + CI'], ['normal(μ,σ) cdf x', 'also t(ν) chi2(k) f(a,b) binomial(n,p) poisson(λ) gamma beta'], ['… pdf | cdf | sf | quantile', 'density, CDF, tail, inverse'], ['ttest [..] mu=0 · ttest2 [..] [..]', 't-tests (Welch)'], ['chisq [[..],[..]] · anova [..] [..]', 'χ², one-way ANOVA'], ['regress [x] [y]', 'linear · poly 3 · exp · power'], ['corr [x] [y] · ci [..] 95%', 'Pearson/Spearman, intervals']],
  optimize: [['minimize E [on [a,b]]', '1-D Brent'], ['minimize E(x,y) [from [..]]', 'BFGS + Nelder–Mead'], ['maximize c·x subject to …', 'exact simplex (LP)'], ['minimize E subject to g = 0', 'augmented Lagrangian'], ['catalan / stirling / partitions n', 'combinatorics (BigInt)']],
  number: [['factor n', 'Pollard–Brent ρ, Miller–Rabin'], ['isprime n · nextprime n', 'deterministic < 3.3·10²⁴'], ['gcd a, b · lcm a, b', 'with Bézout'], ['a^b mod m · modinv a mod m', 'modular arithmetic'], ['crt 2 mod 3, 3 mod 5', 'Chinese remainder'], ['cf sqrt(7) · pell 61', 'continued fractions, Pell'], ['255 to base 2 · pi to 500 digits', 'bases, constants']],
  plot: [['plot f, g [from a to b]', 'zoom with wheel / pinch, drag to pan'], ['plot x^2 + y^2 = 4', 'implicit curves'], ['parametric x(t), y(t)', 'parametric'], ['polar r(t)', 'polar'], ["slope field y' = f(x, y)", 'click to trace solutions'], ['vector field P, Q', 'vector fields'], ['surface f(x, y)', '3D, drag to rotate']]
};

const HISTORY_KEY = 'toolbox.math.history.v2';
const KATEX_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist';
let katexPromise = null;
function ensureKatex() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.katex) return Promise.resolve(window.katex);
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = `${KATEX_BASE}/katex.min.css`; link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = `${KATEX_BASE}/katex.min.js`; s.crossOrigin = 'anonymous'; s.async = true;
    const timer = setTimeout(() => resolve(null), 12000);
    s.onload = () => { clearTimeout(timer); resolve(window.katex || null); if (window.katex) window.dispatchEvent(new CustomEvent('toolbox:katex-ready')); };
    s.onerror = () => { clearTimeout(timer); resolve(null); };
    document.head.appendChild(s);
  });
  return katexPromise;
}
function renderTex(el, tex, display = true) {
  if (!el) return;
  el.dataset.tex = tex;
  el.dataset.display = display ? '1' : '0';
  if (!tex) { el.innerHTML = ''; return; }
  if (window.katex) {
    try { window.katex.render(tex, el, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }); return; } catch { /* fall back */ }
  }
  el.innerHTML = renderMath(fallbackTex(tex), { displayMode: display });
}
/** Rewrite constructs the built-in MathML fallback does not know (used only when KaTeX is unavailable). */
function fallbackTex(tex) {
  // column vectors -> (a, b)^T so they can nest inside aligned rows
  tex = tex.replace(/\\begin\{pmatrix\}((?:(?!\\begin|\\end|&).)*?)\\end\{pmatrix\}/g, (m, body) => (/\\\\/.test(body) ? `\\left(${body.split('\\\\').map((q) => q.trim()).join(',\\, ')}\\right)^{T}` : m));
  // true minus signs outside \text{…}
  tex = tex.split(/(\\text\{[^}]*\})/).map((part, i) => (i % 2 ? part : part.replace(/-/g, '−'))).join('');
  return tex
    .replace(/\\[td]frac/g, '\\frac')
    .replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, '\\begin{pmatrix} $1 \\\\ $2 \\end{pmatrix}')
    .replace(/\\begin\{array\}\{[^}]*\}/g, '\\begin{matrix}').replace(/\\end\{array\}/g, '\\end{matrix}')
    .replace(/\\overline\{([^{}]*)\}/g, '\\left($1\\right)')
    .replace(/\\[lr]Vert/g, '‖').replace(/\\lfloor/g, '⌊').replace(/\\rfloor/g, '⌋').replace(/\\lceil/g, '⌈').replace(/\\rceil/g, '⌉')
    .replace(/\\tilde\\infty/g, '\\infty').replace(/\\Big(?=[|(\[])/g, '').replace(/\\bmod/g, '\\text{ mod }')
    .replace(/\\;/g, '\\,').replace(/\\!/g, '')
    .replace(/\\(sin|cos|tan|ln|log|exp|arcsin|arccos|arctan|sinh|cosh|tanh)((?:\^\{[^}]*\})?)\s+(?=[A-Za-z0-9\\])/g, '\\$1$2\\,');
}
function rerenderTex(root) {
  root.querySelectorAll('[data-tex]').forEach((el) => renderTex(el, el.dataset.tex, el.dataset.display === '1'));
}

function loadHistory() {
  try { const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30))); } catch { /* storage unavailable */ }
}
function serialise(r) {
  const { plot, ...rest } = r;
  return { ...rest, hadPlot: Boolean(plot), big: r.big ? r.big.slice(0, 12000) : undefined };
}

/** best-effort LaTeX preview of what the user is typing */
function previewLatex(src) {
  const s = src.trim();
  if (!s) return '';
  const tryParse = (t) => { try { return exprLatex(parseExpr(t)); } catch { return null; } };
  let t = s.replace(/^(simplify|expand|factor|apart|together|cancel|diff|derivative|integrate|int|limit|lim|series|taylor|sum|product|solve|dsolve|ode|roots|nsolve|det|inverse|inv|rank|rref|eigen|svd|lu|qr|cholesky|expm|nullspace|plot|graph|surface|polar|parametric|implicit|minimize|maximize|min|max|isprime|collect|grad|gradient|hessian|jacobian)\s+(of\s+)?/i, '');
  t = t.replace(/\s+d[a-z]\s*$/i, '').replace(/\s+(from|on|over|at|order|subject to|s\.t\.|for)\s+.*$/i, '').replace(/\s+[a-z]\s*(->|→).*$/i, '').replace(/\s+[a-z]\s*=\s*[^,]*\.\..*$/i, '');
  const parts = t.split(/,(?![^[(]*[\])])/);
  const first = tryParse(t) || tryParse(parts[0]);
  return first;
}

export default {
  _cleanup: [],
  _plots: [],

  render(container) {
    this.destroy();
    this._cleanup = [];
    this._plots = [];
    const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); this._cleanup.push(() => el.removeEventListener(ev, fn, opts)); };

    container.innerHTML = `
      <div class="mx" data-mode="calculus">
        <form class="mx-bar" autocomplete="off" novalidate>
          <label class="visually-hidden" for="mx-input">Ask or type an expression</label>
          <div class="mx-bar-field">
            <span class="mx-bar-icon" aria-hidden="true">${SVG_ICONS.cmd}</span>
            <input id="mx-input" class="mx-input" type="text" spellcheck="false" autocapitalize="off" enterkeyhint="go"
              placeholder="Ask or type an expression — e.g. integrate x^2 sin x dx">
            <button type="submit" class="mx-run" aria-label="Run">${SVG_ICONS.run}<span>Run</span></button>
          </div>
          <div class="mx-preview" aria-live="polite"><span class="mx-preview-label">Preview</span><span class="mx-preview-tex"></span></div>
        </form>

        <nav class="mx-modes" role="tablist" aria-label="Math areas">
          ${MODES.map((m) => `<button type="button" role="tab" class="mx-mode" data-mode="${m.id}" aria-selected="${m.id === 'calculus'}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.icon}</svg>${m.label}</button>`).join('')}
        </nav>

        <div class="mx-work">
          <section class="mx-feed-col" aria-label="Results">
            <div class="mx-feed-head">
              <h3>Results</h3>
              <button type="button" class="btn btn-ghost mx-clear" hidden>Clear</button>
            </div>
            <div class="mx-feed" aria-live="polite"></div>
          </section>
          <aside class="mx-aside" aria-label="Examples and syntax">
            <div class="mx-card mx-examples">
              <div class="mx-aside-title">Try</div>
              <div class="mx-chips"></div>
            </div>
            <details class="mx-card mx-syntax" open>
              <summary class="mx-aside-title">Syntax</summary>
              <dl class="mx-syntax-list"></dl>
            </details>
            <div class="mx-card mx-about">
              <div class="mx-aside-title">How answers are checked</div>
              <p>Exact arithmetic uses BigInt rationals. Every result carries a verification line: derivatives against finite differences, integrals by differentiating back and by adaptive quadrature, roots by substitution, matrix factorisations by reconstruction.</p>
            </div>
          </aside>
        </div>

        <section class="mx-reference" hidden>
          <nav class="mx-subtabs" role="tablist" aria-label="Reference sections">
            <button type="button" role="tab" class="mx-subtab" data-ref="knowledge" aria-selected="true">${SVG_ICONS.book} Knowledge library</button>
            <button type="button" role="tab" class="mx-subtab" data-ref="collatz" aria-selected="false">${SVG_ICONS.sigma} Sequences &amp; Collatz</button>
            <button type="button" role="tab" class="mx-subtab" data-ref="tables" aria-selected="false">${SVG_ICONS.table} Tables &amp; constants</button>
          </nav>
          <div class="math-utility-wrapper">
        <!-- 1. TAB: KNOWLEDGE LIBRARY -->
        <div class="math-pane active" id="pane-knowledge" style="display:flex; flex-direction:column; gap:20px;">
          <!-- Filter Controls Strip -->
          <div class="math-controls-bar">
            <div style="position:relative; flex:1; min-width:220px; display:flex; align-items:center;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="position:absolute; left:12px; color:var(--text-muted); pointer-events:none;">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input type="text" id="math-lib-search" class="math-search-input" placeholder="Search theorems, formulas, identities, conjectures…" autocomplete="off" spellcheck="false">
            </div>

            <div class="math-control-group">
              <select id="math-lib-cat-filter" class="math-select-control" aria-label="Filter by Mathematical Domain">
                <option value="all">All Domains (${MATH_CATEGORIES.length})</option>
                ${MATH_CATEGORIES.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>

              <button type="button" id="math-eng-filter-btn" class="math-chip-btn" title="Toggle Engineering Mathematics Filter">
                ${SVG_ICONS.check} Engineering Math
              </button>
            </div>

            <div class="math-control-group">
              <select id="math-lib-status-filter" class="math-select-control" aria-label="Filter by Proof Status">
                <option value="all">All Statuses</option>
                ${Object.values(PROOF_STATUS).map(s => `<option value="${s}">${escapeHtml(s)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Knowledge Cards Grid -->
          <div id="math-lib-results-grid" class="dynamic-tile-grid"></div>
        </div>
        <!-- 3. TAB: COLLATZ & SEQUENCES -->
        <div class="math-pane" id="pane-collatz" style="display:none; flex-direction:column; gap:20px;">
          <!-- Mathematical Sequence Engine (50+ Sequences) -->
          <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-weight:700; font-size:1rem; color:var(--text);">Mathematical Sequence Suite (50+ Deterministic Sequences)</span>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Arbitrary-precision BigInt arithmetic, recurrence relations, closed forms, and growth plots</div>
              </div>
              <span class="math-proof-badge math-badge-proven">
                DETERMINISTIC
              </span>
            </div>

            <div class="math-seq-controls">
              <div>
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Sequence</label>
                <select id="seq-select" class="tool-select" style="width:100%; font-size:0.85rem; padding:6px 10px;">
                  <!-- Populated dynamically from listAllSequences() -->
                </select>
              </div>

              <div>
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Mode</label>
                <select id="seq-mode" class="tool-select" style="width:100%; font-size:0.85rem; padding:6px 10px;">
                  <option value="term">Single Term at Index (n)</option>
                  <option value="range">Range of Terms (from … to)</option>
                  <option value="compare">Compare Two Sequences</option>
                </select>
              </div>

              <div id="seq-term-group">
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Term Index (n)</label>
                <input type="number" id="seq-n" class="tool-input" value="10" min="0" max="1000" style="width:100%; font-size:0.9rem; padding:6px 10px; font-family:var(--mono, monospace);">
              </div>

              <div id="seq-range-group" style="display:none;">
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Range (from – to)</label>
                <div style="display:flex; gap:6px;">
                  <input type="number" id="seq-from" class="tool-input" value="1" min="0" max="500" style="width:50%; font-size:0.9rem; padding:6px 8px; font-family:var(--mono, monospace);">
                  <input type="number" id="seq-to" class="tool-input" value="20" min="1" max="500" style="width:50%; font-size:0.9rem; padding:6px 8px; font-family:var(--mono, monospace);">
                </div>
              </div>

              <div id="seq-compare-group" style="display:none;">
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Compare With</label>
                <select id="seq-compare-select" class="tool-select" style="width:100%; font-size:0.85rem; padding:6px 10px;">
                </select>
              </div>

              <div style="display:flex; gap:8px;">
                <button type="button" id="seq-run-btn" class="tool-btn" style="background:var(--black); color:var(--white); font-weight:700; font-size:0.85rem; padding:7px 16px; border-radius:8px; border:none; cursor:pointer; flex:1;">
                  Calculate
                </button>
              </div>
            </div>

            <!-- Sequence Result Zone -->
            <div id="seq-result-zone" style="margin-top:4px;"></div>
          </div>

          <!-- Collatz Card -->
          <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-weight:700; font-size:1rem; color:var(--text);">Collatz (3n + 1) Trajectory Explorer</span>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Deterministic trajectory tracking, peak excursion, and stopping time metrics</div>
              </div>
              <span class="math-proof-badge math-badge-conjecture">
                CONJECTURE (UNPROVEN)
              </span>
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
              <div style="flex:1; min-width:180px;">
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Starting Positive Integer (n)</label>
                <input type="number" id="collatz-input" class="tool-input" value="27" min="1" max="100000000" style="width:100%; font-size:0.9rem; padding:6px 10px; font-family:var(--mono, monospace);">
              </div>
              <button type="button" id="collatz-run-btn" class="tool-btn" style="background:var(--black); color:var(--white); font-weight:700; font-size:0.85rem; padding:7px 16px; border-radius:8px; border:none; cursor:pointer;">
                Compute Trajectory
              </button>
            </div>

            <!-- Collatz Result Zone -->
            <div id="collatz-result-zone" style="margin-top:8px;"></div>
          </div>

          <!-- Legacy Fibonacci Card (Retained for quick inspection) -->
          <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
            <span style="font-weight:700; font-size:1rem; color:var(--text);">Quick Fibonacci Sequence Generator</span>
            <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
              <div style="flex:1; min-width:180px;">
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Sequence Length (count)</label>
                <input type="number" id="fib-input" class="tool-input" value="15" min="1" max="100" style="width:100%; font-size:0.9rem; padding:6px 10px; font-family:var(--mono, monospace);">
              </div>
              <button type="button" id="fib-run-btn" class="tool-btn" style="background:var(--black); color:var(--white); font-weight:700; font-size:0.85rem; padding:7px 16px; border-radius:8px; border:none; cursor:pointer;">
                Generate Fibonacci
              </button>
            </div>
            <div id="fib-result-zone" style="margin-top:4px;"></div>
          </div>
        </div>
        <!-- 4. TAB: FOUR-FIGURE TABLES & CONSTANTS -->
        <div class="math-pane" id="pane-tables" style="display:none; flex-direction:column; gap:20px;">
          <div class="math-split-grid">
            <!-- Four-Figure Table Lookup Card -->
            <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
              <div>
                <span style="font-weight:700; font-size:1rem; color:var(--text);">Four-Figure Mathematical Tables</span>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Traditional 4-figure table lookup with direct comparison against full machine precision</div>
              </div>

              <div>
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Reference Table</label>
                <select id="table-select" class="tool-select" style="width:100%; font-size:0.85rem; padding:6px 10px;">
                  <option value="log">Common Logarithms (Base 10)</option>
                  <option value="antilog">Antilogarithms</option>
                  <option value="ln">Natural Logarithms (Base e)</option>
                  <option value="sin">Natural Sines (Degrees)</option>
                  <option value="cos">Natural Cosines (Degrees)</option>
                  <option value="tan">Natural Tangents (Degrees)</option>
                  <option value="sqrt">Square Roots (√x)</option>
                  <option value="cbrt">Cube Roots (∛x)</option>
                  <option value="reciprocal">Reciprocals (1/x)</option>
                  <option value="squares">Squares (x²)</option>
                  <option value="cubes">Cubes (x³)</option>
                </select>
              </div>

              <div>
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Input Argument (x)</label>
                <input type="number" step="any" id="table-input" class="tool-input" value="3.456" style="width:100%; font-size:0.9rem; padding:6px 10px; font-family:var(--mono, monospace);">
              </div>

              <button type="button" id="table-lookup-btn" class="tool-btn" style="background:var(--black); color:var(--white); font-weight:700; font-size:0.85rem; padding:7px 14px; border-radius:8px; border:none; cursor:pointer;">
                Lookup Table & Compare
              </button>

              <div id="table-output-zone" style="margin-top:6px;"></div>
            </div>

            <!-- Mathematical Constants Directory -->
            <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
              <div>
                <span style="font-weight:700; font-size:1rem; color:var(--text);">Fundamental Mathematical Constants</span>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Universal constants with precision classifications, domains, and values</div>
              </div>

              <div style="display:flex; flex-direction:column; gap:8px; max-height:420px; overflow-y:auto; padding-right:4px;">
                ${MATHEMATICAL_CONSTANTS.map(c => `
                  <div style="padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div>
                      <div style="display:flex; align-items:baseline; gap:8px;">
                        <span style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--text);">${escapeHtml(c.symbol)}</span>
                        <span style="font-weight:600; font-size:0.85rem; color:var(--text);">${escapeHtml(c.name)}</span>
                      </div>
                      <div style="font-family:var(--mono, monospace); font-size:0.8rem; color:var(--text); margin-top:3px; font-weight:600;">${escapeHtml(c.displayValue)}</div>
                      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">${escapeHtml(c.domain)} &bull; ${escapeHtml(c.precision)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
          </div>
        </section>
      </div>
    `;

    const root = container.querySelector('.mx');
    const form = root.querySelector('.mx-bar');
    const input = root.querySelector('#mx-input');
    const previewTex = root.querySelector('.mx-preview-tex');
    const previewRow = root.querySelector('.mx-preview');
    const feed = root.querySelector('.mx-feed');
    const clearBtn = root.querySelector('.mx-clear');
    const chips = root.querySelector('.mx-chips');
    const syntaxList = root.querySelector('.mx-syntax-list');
    const work = root.querySelector('.mx-work');
    const reference = root.querySelector('.mx-reference');

    let history = loadHistory();
    let recall = -1;

    /* ---------- mode rail ---------- */
    const setMode = (mode) => {
      root.dataset.mode = mode;
      root.querySelectorAll('.mx-mode').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
      const isRef = mode === 'reference';
      reference.hidden = !isRef;
      work.hidden = isRef;
      form.hidden = isRef;
      if (isRef) return;
      const ex = EXAMPLES[mode] || [];
      chips.innerHTML = ex.map((e) => `<button type="button" class="mx-chip" data-cmd="${escapeHtml(e)}">${escapeHtml(e)}</button>`).join('');
      syntaxList.innerHTML = (SYNTAX[mode] || []).map(([k, v]) => `<dt><code>${escapeHtml(k)}</code></dt><dd>${escapeHtml(v)}</dd>`).join('');
      try { localStorage.setItem('toolbox.math.mode', mode); } catch { /* ignore */ }
    };
    root.querySelectorAll('.mx-mode').forEach((b) => on(b, 'click', () => setMode(b.dataset.mode)));
    on(chips, 'click', (e) => {
      const c = e.target.closest('[data-cmd]'); if (!c) return;
      input.value = c.dataset.cmd; updatePreview(); execute(c.dataset.cmd);
    });

    /* ---------- preview ---------- */
    let pvTimer = null;
    const updatePreview = () => {
      const tex = previewLatex(input.value);
      previewRow.classList.toggle('is-empty', !tex);
      renderTex(previewTex, tex || '', false);
    };
    on(input, 'input', () => { clearTimeout(pvTimer); pvTimer = setTimeout(updatePreview, 120); recall = -1; });
    on(input, 'keydown', (e) => {
      const cmds = history.map((h) => h.command).filter(Boolean);
      if (e.key === 'ArrowUp' && cmds.length) { e.preventDefault(); recall = Math.min(cmds.length - 1, recall + 1); input.value = cmds[recall]; updatePreview(); }
      else if (e.key === 'ArrowDown' && recall >= 0) { e.preventDefault(); recall -= 1; input.value = recall >= 0 ? cmds[recall] : ''; updatePreview(); }
    });

    /* ---------- result cards ---------- */
    const CAT_LABEL = { algebra: 'Algebra', calculus: 'Calculus', equations: 'Equations', linalg: 'Linear algebra', stats: 'Statistics', optimize: 'Optimisation', number: 'Number theory', plot: 'Plot', reference: 'Reference' };
    const cardHtml = (r, id) => {
      const steps = r.steps || [];
      const hasResult = r.result && r.result.trim();
      return `
        <article class="mx-result" data-id="${id}">
          <header class="mx-result-head">
            <div class="mx-result-titles">
              <span class="mx-result-cat">${escapeHtml(CAT_LABEL[r.category] || 'Result')}</span>
              <h4 class="mx-result-title">${escapeHtml(r.title || 'Result')}</h4>
            </div>
            <div class="mx-result-actions">
              ${hasResult ? `<button type="button" class="mx-act" data-act="latex" title="Copy LaTeX">${SVG_ICONS.copy}<span>LaTeX</span></button>` : ''}
              <button type="button" class="mx-act" data-act="text" title="Copy as plain text">${SVG_ICONS.copy}<span>Text</span></button>
              <button type="button" class="mx-act mx-act-icon" data-act="edit" title="Edit command" aria-label="Edit command">${SVG_ICONS.redo}</button>
              <button type="button" class="mx-act mx-act-icon" data-act="remove" title="Remove" aria-label="Remove result">${SVG_ICONS.x}</button>
            </div>
          </header>
          <div class="mx-cmd"><code>${escapeHtml(r.command || '')}</code>${r.ms !== undefined ? `<span>${r.ms} ms</span>` : ''}</div>
          ${r.input ? `<div class="mx-input-tex" data-tex="${escapeHtml(r.input)}" data-display="1"></div>` : ''}
          ${hasResult ? `<div class="mx-answer"><div class="mx-answer-tex" data-tex="${escapeHtml(r.result)}" data-display="1"></div>${r.approx ? `<div class="mx-approx">≈ ${escapeHtml(r.approx)}</div>` : ''}</div>` : ''}
          ${r.big ? `<div class="mx-big"><code>${escapeHtml(r.big)}</code></div>` : ''}
          ${r.extra && r.extra.length ? `<dl class="mx-extra">${r.extra.map((e) => `<div${e.latex && e.latex.length > 40 ? ' class="is-wide"' : ''}><dt>${escapeHtml(e.label)}</dt><dd>${e.latex ? `<span data-tex="${escapeHtml(e.latex)}" data-display="0"></span>` : `<span class="u-mono">${escapeHtml(e.text)}</span>`}</dd></div>`).join('')}</dl>` : ''}
          ${r.table ? `<div class="mx-table-wrap"><table class="mx-table"><thead><tr>${r.table.head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${r.table.rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
          ${r.plot ? '<div class="mx-plot-host"></div>' : (r.hadPlot ? `<button type="button" class="mx-act mx-showplot" data-act="plot">${SVG_ICONS.chart}<span>Show plot</span></button>` : '')}
          ${steps.length ? `<details class="mx-steps"${steps.length <= 4 ? ' open' : ''}><summary>Working · ${steps.length} step${steps.length === 1 ? '' : 's'}</summary><ol>${steps.map((st) => `<li><span class="mx-step-text">${escapeHtml(st.text)}</span>${st.latex ? `<div class="mx-step-tex" data-tex="${escapeHtml(st.latex)}" data-display="1"></div>` : ''}</li>`).join('')}</ol></details>` : ''}
          ${r.verify ? `<div class="mx-verify ${r.verify.ok ? 'ok' : 'warn'}">${r.verify.ok ? SVG_ICONS.check : SVG_ICONS.warn}<span><strong>${r.verify.ok ? 'Verified' : 'Not verified'}</strong> — ${escapeHtml(r.verify.text || '')}</span></div>` : ''}
          ${(r.notes || []).map((n) => `<p class="mx-note">${escapeHtml(n)}</p>`).join('')}
        </article>`;
    };
    const errorHtml = (cmd, msg, id) => `
      <article class="mx-result mx-error" data-id="${id}">
        <header class="mx-result-head"><div class="mx-result-titles"><span class="mx-result-cat">Could not evaluate</span><h4 class="mx-result-title">${escapeHtml(msg)}</h4></div>
        <div class="mx-result-actions"><button type="button" class="mx-act mx-act-icon" data-act="edit" aria-label="Edit command">${SVG_ICONS.redo}</button><button type="button" class="mx-act mx-act-icon" data-act="remove" aria-label="Remove">${SVG_ICONS.x}</button></div></header>
        <div class="mx-cmd"><code>${escapeHtml(cmd)}</code></div>
        <p class="mx-note">Check the syntax panel for the command forms, or press a Try chip for a working example.</p>
      </article>`;

    const emptyHtml = () => `
      <div class="mx-empty">
        <div class="mx-empty-mark" aria-hidden="true">${SVG_ICONS.sigma}</div>
        <h4>A verified maths workbench</h4>
        <p>Exact algebra, calculus, equations and ODEs, linear algebra, statistics, optimisation and number theory — every answer shows its working and how it was checked.</p>
        <div class="mx-empty-chips">${['integrate x^2 sin x dx', 'solve x^3-6x^2+11x-6=0', 'eigen [[2,1],[1,2]]', 'factor 2^64+1', 'plot sin(x), cos(x)'].map((e) => `<button type="button" class="mx-chip" data-cmd="${escapeHtml(e)}">${escapeHtml(e)}</button>`).join('')}</div>
      </div>`;

    const results = new Map(); // id -> result (live, may contain plot)
    let seq = 0;
    const mountCardPlot = (card, r) => {
      const host = card.querySelector('.mx-plot-host');
      if (!host || !r.plot) return;
      try { const destroy = mountPlot(host, r.plot); this._plots.push(destroy); } catch (err) { host.innerHTML = `<p class="mx-note">Plot unavailable: ${escapeHtml(err.message)}</p>`; }
    };
    const addCard = (r, { prepend = true, save = true } = {}) => {
      const id = `r${++seq}`;
      results.set(id, r);
      const tmp = document.createElement('div');
      tmp.innerHTML = r.error ? errorHtml(r.command, r.error, id) : cardHtml(r, id);
      const card = tmp.firstElementChild;
      const empty = feed.querySelector('.mx-empty'); if (empty) empty.remove();
      if (prepend) feed.prepend(card); else feed.appendChild(card);
      rerenderTex(card);
      mountCardPlot(card, r);
      if (save) {
        history.unshift(r.error ? { command: r.command, error: r.error } : serialise(r));
        history = history.slice(0, 30);
        saveHistory(history);
      }
      clearBtn.hidden = false;
      return card;
    };
    const execute = (cmd) => {
      const c = String(cmd || '').trim();
      if (!c) { input.focus(); return; }
      let r;
      try { r = runCommand(c); } catch (err) { r = { command: c, error: err.message || String(err) }; }
      const card = addCard(r);
      card.classList.add('is-new');
      if (window.matchMedia('(max-width: 900px)').matches) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recall = -1;
    };
    on(form, 'submit', (e) => { e.preventDefault(); execute(input.value); });

    on(feed, 'click', (e) => {
      const chip = e.target.closest('[data-cmd]');
      if (chip) { input.value = chip.dataset.cmd; updatePreview(); execute(chip.dataset.cmd); return; }
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('.mx-result'); const id = card && card.dataset.id; const r = results.get(id);
      const act = btn.dataset.act;
      if (act === 'remove') {
        const idx = [...feed.querySelectorAll('.mx-result')].indexOf(card);
        card.remove(); results.delete(id);
        if (idx >= 0) { history.splice(idx, 1); saveHistory(history); }
        if (!feed.querySelector('.mx-result')) { feed.innerHTML = emptyHtml(); clearBtn.hidden = true; }
      } else if (act === 'edit' && r) { input.value = r.command || ''; updatePreview(); input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (act === 'latex' && r) copyTo(btn, `${r.input ? `${r.input} \\;\\Rightarrow\\; ` : ''}${r.result}`);
      else if (act === 'text' && r) copyTo(btn, r.error ? `${r.command}: ${r.error}` : toPlainText(r));
      else if (act === 'plot' && r) {
        try { const fresh = runCommand(r.command); if (fresh.plot) { const host = document.createElement('div'); host.className = 'mx-plot-host'; btn.replaceWith(host); results.set(id, fresh); mountCardPlot(card, fresh); } } catch { btn.remove(); }
      }
    });
    const copyTo = (btn, text) => {
      const label = btn.querySelector('span');
      try { copyText(text, label || btn); } catch { /* ignore */ }
    };
    on(clearBtn, 'click', () => {
      this._plots.forEach((d) => { try { d(); } catch { /* ignore */ } });
      this._plots = []; results.clear(); history = []; saveHistory(history);
      feed.innerHTML = emptyHtml(); clearBtn.hidden = true;
    });

    // restore history (oldest last)
    if (history.length) {
      history.forEach((h) => addCard(h.error ? { command: h.command, error: h.error } : h, { prepend: false, save: false }));
    } else feed.innerHTML = emptyHtml();

    let startMode = 'calculus';
    try { const m = localStorage.getItem('toolbox.math.mode'); if (m && MODES.some((x) => x.id === m)) startMode = m; } catch { /* ignore */ }
    setMode(startMode);
    if (window.matchMedia('(max-width: 900px)').matches) root.querySelector('.mx-syntax').open = false;
    updatePreview();

    ensureKatex().then((k) => { if (k && root.isConnected) rerenderTex(root); });

    /* ---------- reference sub-tabs ---------- */
    const refPanes = { knowledge: container.querySelector('#pane-knowledge'), collatz: container.querySelector('#pane-collatz'), tables: container.querySelector('#pane-tables') };
    root.querySelectorAll('.mx-subtab').forEach((b) => on(b, 'click', () => {
      root.querySelectorAll('.mx-subtab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      Object.entries(refPanes).forEach(([k, p]) => { if (p) p.style.display = k === b.dataset.ref ? 'flex' : 'none'; });
    }));

    // 2. Setup Knowledge Library Search & Filtering
    const searchInput = container.querySelector('#math-lib-search');
    const catFilter = container.querySelector('#math-lib-cat-filter');
    const statusFilter = container.querySelector('#math-lib-status-filter');
    const resultsGrid = container.querySelector('#math-lib-results-grid');
    const engFilterBtn = container.querySelector('#math-eng-filter-btn');

    const renderKnowledgeList = () => {
      const q = searchInput.value;
      const cat = catFilter.value;
      const status = statusFilter.value;

      const entries = searchMathKnowledge(q, {
        category: cat !== 'all' ? cat : null,
        proofStatus: status !== 'all' ? status : null,
        limit: 150
      });

      if (entries.length === 0) {
        resultsGrid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:40px 16px; color:var(--text-muted); font-size:0.85rem;">
            No mathematical knowledge entries found matching the filter criteria.
          </div>
        `;
        return;
      }

      resultsGrid.innerHTML = entries.map(entry => {
        let badgeClass = 'math-badge-axiom';
        if (entry.proofStatus?.includes('PROVEN') || entry.proofStatus?.includes('THEOREM') || entry.proofStatus?.includes('LEMMA') || entry.proofStatus?.includes('COROLLARY')) {
          badgeClass = 'math-badge-proven';
        } else if (entry.proofStatus?.includes('CONJECTURE') || entry.proofStatus?.includes('OPEN')) {
          badgeClass = 'math-badge-conjecture';
        } else if (entry.proofStatus?.includes('IDENTITY')) {
          badgeClass = 'math-badge-identity';
        } else if (entry.proofStatus?.includes('ALGORITHM') || entry.proofStatus?.includes('METHOD')) {
          badgeClass = 'math-badge-algorithm';
        }

        const formulaLen = entry.formula ? entry.formula.length : 0;
        const textLen = (entry.statement || entry.definition || '').length;
        const isWide = (formulaLen > 70 || textLen > 240);
        const tileClass = isWide ? 'tile-wide' : 'tile-standard';

        const renderedFormula = entry.formula ? renderMath(entry.formula, { displayMode: true }) : '';
        const renderedStatement = renderMathInText(entry.statement || entry.definition || '');

        return `
          <article class="math-knowledge-card ${tileClass}">
            <header class="math-card-header">
              <h3 class="math-card-title">${escapeHtml(entry.title)}</h3>
              <span class="math-proof-badge ${badgeClass}">
                ${escapeHtml(entry.proofStatus)}
              </span>
            </header>
            <div class="math-card-subdomain">${escapeHtml(entry.categoryName || entry.category || '')}</div>

            ${renderedFormula}

            <p class="math-card-statement">
              ${renderedStatement}
            </p>

            ${entry.computationalOp ? `
              <footer class="math-card-computable">
                <span>Computable:</span> <code>${escapeHtml(entry.computationalOp)}</code>
              </footer>
            ` : ''}
          </article>
        `;
      }).join('');
    };

    searchInput.addEventListener('input', renderKnowledgeList);
    catFilter.addEventListener('change', () => {
      if (engFilterBtn) {
        engFilterBtn.classList.toggle('active', catFilter.value === 'engineering-math');
      }
      renderKnowledgeList();
    });
    statusFilter.addEventListener('change', renderKnowledgeList);

    if (engFilterBtn) {
      const toggleEng = () => {
        const isEng = catFilter.value === 'engineering-math';
        if (isEng) {
          catFilter.value = 'all';
          engFilterBtn.classList.remove('active');
        } else {
          catFilter.value = 'engineering-math';
          engFilterBtn.classList.add('active');
        }
        renderKnowledgeList();
      };
      engFilterBtn.addEventListener('click', toggleEng);
      this._cleanup.push(() => engFilterBtn.removeEventListener('click', toggleEng));
    }

    this._cleanup.push(() => {
      searchInput.removeEventListener('input', renderKnowledgeList);
      statusFilter.removeEventListener('change', renderKnowledgeList);
    });

    renderKnowledgeList();
    // 4. Setup Mathematical Sequence Suite (50+ Sequences)
    const seqSelect = container.querySelector('#seq-select');
    const seqCompareSelect = container.querySelector('#seq-compare-select');
    const seqMode = container.querySelector('#seq-mode');
    const seqTermGroup = container.querySelector('#seq-term-group');
    const seqRangeGroup = container.querySelector('#seq-range-group');
    const seqCompareGroup = container.querySelector('#seq-compare-group');
    const seqN = container.querySelector('#seq-n');
    const seqFrom = container.querySelector('#seq-from');
    const seqTo = container.querySelector('#seq-to');
    const seqRunBtn = container.querySelector('#seq-run-btn');
    const seqZone = container.querySelector('#seq-result-zone');

    const allSeqs = listAllSequences();
    if (seqSelect && seqCompareSelect) {
      const optionsHtml = allSeqs.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.category)})</option>`).join('');
      seqSelect.innerHTML = optionsHtml;
      seqCompareSelect.innerHTML = optionsHtml;
      if (allSeqs.length > 1) {
        try {
          seqCompareSelect.value = allSeqs[1].id;
        } catch (_) {}
      }
    }

    const updateSeqModeUI = () => {
      const mode = seqMode.value;
      seqTermGroup.style.display = mode === 'term' ? 'block' : 'none';
      seqRangeGroup.style.display = mode === 'range' ? 'block' : 'none';
      seqCompareGroup.style.display = mode === 'compare' ? 'block' : 'none';
    };
    seqMode.addEventListener('change', updateSeqModeUI);
    this._cleanup.push(() => seqMode.removeEventListener('change', updateSeqModeUI));

    const runSeq = () => {
      try {
        const sId = seqSelect.value;
        const mode = seqMode.value;

        if (mode === 'term') {
          const nVal = seqN.value;
          const res = calculateSequenceTerm(sId, nVal);
          seqZone.innerHTML = `
            <div style="padding:14px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <span style="font-weight:700; font-size:0.95rem; color:var(--text);">${escapeHtml(res.sequenceName)} &bull; Term a(${res.termIndex})</span>
                <span class="math-proof-badge math-badge-proven">BigInt Exact</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; background:var(--bg-card); padding:10px 12px; border-radius:6px; border:1px solid var(--border);">
                <div style="font-family:var(--mono, monospace); font-size:1.15rem; font-weight:700; color:var(--text); word-break:break-all; flex:1;">
                  ${escapeHtml(res.formatted)}
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="copy-seq-val" style="padding:4px 8px; font-size:0.75rem;">
                  ${SVG_ICONS.copy} Copy
                </button>
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                <div><strong>Recurrence:</strong> <code>${escapeHtml(res.recurrence)}</code></div>
                <div><strong>Definition:</strong> ${escapeHtml(res.definition)}</div>
                ${res.properties && res.properties.length > 0 ? `<div><strong>Properties:</strong> ${res.properties.map(p => `<span style="display:inline-block; padding:1px 6px; border-radius:4px; background:var(--border); font-size:0.7rem; margin-right:4px;">${escapeHtml(p)}</span>`).join('')}</div>` : ''}
              </div>
            </div>
          `;
          const copyBtn = seqZone.querySelector('#copy-seq-val');
          if (copyBtn) {
            copyBtn.addEventListener('click', () => copyText(String(res.termValue), copyBtn));
          }
        } else if (mode === 'range') {
          const fromVal = Number(seqFrom.value) || 1;
          const toVal = Number(seqTo.value) || 20;
          const res = generateSequenceRange(sId, { from: fromVal, to: toVal });

          const maxVal = Math.max(...res.chartData.map(d => d.y), 1);
          const w = 560;
          const h = 120;
          const pad = { top: 10, right: 12, bottom: 20, left: 45 };
          const plotW = w - pad.left - pad.right;
          const plotH = h - pad.top - pad.bottom;
          const pts = res.chartData.map((d, i) => ({
            x: pad.left + (i / Math.max(1, res.chartData.length - 1)) * plotW,
            y: pad.top + plotH - (Math.min(d.y, maxVal) / maxVal) * plotH
          }));
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

          seqZone.innerHTML = `
            <div style="padding:14px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.95rem; color:var(--text);">${escapeHtml(res.sequenceName)} (${res.from} to ${res.to})</span>
                <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--mono, monospace);">${res.count} terms</span>
              </div>
              <div style="border:1px solid var(--border); border-radius:6px; background:var(--bg-card); padding:8px;">
                <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block;">
                  <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${h - pad.bottom}" stroke="var(--border)" stroke-width="1" />
                  <line x1="${pad.left}" y1="${h - pad.bottom}" x2="${w - pad.right}" y2="${h - pad.bottom}" stroke="var(--border)" stroke-width="1" />
                  <path d="${pathD}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linejoin="round" />
                  ${pts.length <= 25 ? pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--text)" />`).join('') : ''}
                  <text x="${pad.left}" y="${h - 4}" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">n=${res.from}</text>
                  <text x="${w - pad.right}" y="${h - 4}" font-size="9" fill="var(--text-muted)" text-anchor="end" font-family="var(--mono, monospace)">n=${res.to}</text>
                </svg>
              </div>
              <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; font-family:var(--mono, monospace); font-size:0.82rem;">
                ${res.terms.map(t => `<span style="padding:3px 8px; border-radius:6px; background:var(--bg-card); border:1px solid var(--border); flex-shrink:0;">a(${t.n}) = <strong>${escapeHtml(t.formatted)}</strong></span>`).join('')}
              </div>
            </div>
          `;
        } else if (mode === 'compare') {
          const sId2 = seqCompareSelect.value;
          const res = compareSequences(sId, sId2, 15);
          seqZone.innerHTML = `
            <div style="padding:14px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); display:flex; flex-direction:column; gap:8px;">
              <span style="font-weight:700; font-size:0.95rem; color:var(--text);">Comparison: ${escapeHtml(res.sequenceA.name)} vs ${escapeHtml(res.sequenceB.name)}</span>
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.8rem; font-family:var(--mono, monospace);">
                  <thead>
                    <tr style="border-bottom:1px solid var(--border); text-align:left;">
                      <th style="padding:6px;">n</th>
                      <th style="padding:6px;">${escapeHtml(res.sequenceA.name)}</th>
                      <th style="padding:6px;">${escapeHtml(res.sequenceB.name)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${res.comparison.map(row => `
                      <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:5px 6px; color:var(--text-muted);">${row.index}</td>
                        <td style="padding:5px 6px; font-weight:600;">${escapeHtml(row[res.sequenceA.name])}</td>
                        <td style="padding:5px 6px; font-weight:600;">${escapeHtml(row[res.sequenceB.name])}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }
      } catch (err) {
        seqZone.innerHTML = `<div style="color:var(--text); font-size:0.8rem;">${escapeHtml(err.message)}</div>`;
      }
    };

    seqRunBtn.addEventListener('click', runSeq);
    this._cleanup.push(() => seqRunBtn.removeEventListener('click', runSeq));
    runSeq();

    // 5. Setup Collatz Explorer
    const collatzInput = container.querySelector('#collatz-input');
    const collatzRunBtn = container.querySelector('#collatz-run-btn');
    const collatzZone = container.querySelector('#collatz-result-zone');

    const runCollatz = () => {
      try {
        const val = collatzInput.value;
        const res = calculateCollatz(val);

        const w = 560;
        const h = 130;
        const pad = { top: 12, right: 16, bottom: 20, left: 45 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;
        const max = Math.max(1, res.maximum_value);

        const pts = res.sequence.map((v, i) => ({
          x: pad.left + (i / Math.max(1, res.sequence.length - 1)) * plotW,
          y: pad.top + plotH - (v / max) * plotH
        }));
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const peakPt = pts[res.peakStep] || pts[0];

        collatzZone.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:8px;">
              <div style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); text-align:center;">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Input</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1rem; margin-top:2px; color:var(--text);">${res.input}</div>
              </div>
              <div style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); text-align:center;">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Steps to 1</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1rem; margin-top:2px; color:var(--text);">${res.steps}</div>
              </div>
              <div style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); text-align:center;">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Peak Excursion</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1rem; margin-top:2px; color:var(--text);">${res.maximum_value}</div>
              </div>
              <div style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); text-align:center;">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Peak Step</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1rem; margin-top:2px; color:var(--text);">${res.peakStep}</div>
              </div>
              <div style="padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); text-align:center;">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Reached 1</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1rem; margin-top:2px; color:var(--text);">${res.reached_one ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <!-- SVG Trajectory Plot -->
            <div style="border:1px solid var(--border); border-radius:8px; background:var(--bg-subtle); padding:8px;">
              <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; font-weight:600;">
                <span>Trajectory Shape (Peak: ${res.maximum_value} at step ${res.peakStep})</span>
                <span>${res.steps} steps</span>
              </div>
              <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block;">
                <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${h - pad.bottom}" stroke="var(--border)" stroke-width="1" />
                <line x1="${pad.left}" y1="${h - pad.bottom}" x2="${w - pad.right}" y2="${h - pad.bottom}" stroke="var(--border)" stroke-width="1" />
                <path d="${pathD}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linejoin="round" />
                <circle cx="${peakPt.x.toFixed(1)}" cy="${peakPt.y.toFixed(1)}" r="4" fill="var(--black)" stroke="var(--white)" stroke-width="1.5" />
                <text x="${peakPt.x.toFixed(1)}" y="${Math.max(pad.top + 10, peakPt.y - 6).toFixed(1)}" font-size="9" font-family="var(--mono, monospace)" fill="var(--text)" text-anchor="middle">Peak (${res.maximum_value})</text>
                <text x="${pad.left}" y="${h - 4}" font-size="9" fill="var(--text-muted)" font-family="var(--mono, monospace)">0</text>
                <text x="${w - pad.right}" y="${h - 4}" font-size="9" fill="var(--text-muted)" text-anchor="end" font-family="var(--mono, monospace)">${res.steps} steps</text>
              </svg>
            </div>

            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-top:4px;">Sequence Track (${res.sequence.length} terms):</div>
            <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; font-family:var(--mono, monospace); font-size:0.85rem; align-items:center;">
              ${res.sequence.map((num, i) => `
                <span style="padding:3px 8px; border-radius:6px; background:${num === res.maximum_value ? 'var(--black)' : 'var(--bg-card)'}; color:${num === res.maximum_value ? 'var(--white)' : 'var(--text)'}; border:1px solid var(--border); flex-shrink:0;">
                  ${num}
                </span>
                ${i < res.sequence.length - 1 ? '<span style="color:var(--text-muted);">→</span>' : ''}
              `).join('')}
            </div>

            <div style="padding:10px 12px; border-radius:8px; background:var(--bg-subtle); border:1px solid var(--border); font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">
              <strong style="color:var(--text);">Mathematical Proof Status:</strong> The Collatz conjecture states that this process will eventually reach 1 for any positive integer. Although computationally verified up to 2⁶⁸, it remains an <strong>unproven mathematical conjecture</strong>. Empirical evaluation of individual starting numbers does not establish general proof.
            </div>
          </div>
        `;
      } catch (err) {
        collatzZone.innerHTML = `<div style="color:var(--text); font-size:0.8rem;">${escapeHtml(err.message)}</div>`;
      }
    };

    collatzRunBtn.addEventListener('click', runCollatz);
    this._cleanup.push(() => collatzRunBtn.removeEventListener('click', runCollatz));
    runCollatz();

    // 6. Setup Fibonacci Explorer
    const fibInput = container.querySelector('#fib-input');
    const fibRunBtn = container.querySelector('#fib-run-btn');
    const fibZone = container.querySelector('#fib-result-zone');

    const runFib = () => {
      try {
        const val = fibInput.value;
        const res = generateFibonacci(val);
        fibZone.innerHTML = `
          <div style="font-family:var(--mono, monospace); font-size:0.85rem; background:var(--bg-subtle); padding:10px; border:1px solid var(--border); border-radius:8px; line-height:1.6; word-break:break-all; color:var(--text);">
            ${res.sequence.join(', ')}
          </div>
        `;
      } catch (err) {
        fibZone.innerHTML = `<div style="color:var(--text); font-size:0.8rem;">${escapeHtml(err.message)}</div>`;
      }
    };

    fibRunBtn.addEventListener('click', runFib);
    this._cleanup.push(() => fibRunBtn.removeEventListener('click', runFib));
    runFib();

    // 6. Setup Four-Figure Table Lookup
    const tableSelect = container.querySelector('#table-select');
    const tableInput = container.querySelector('#table-input');
    const tableLookupBtn = container.querySelector('#table-lookup-btn');
    const tableOutput = container.querySelector('#table-output-zone');

    const runTableLookup = () => {
      try {
        const tbl = tableSelect.value;
        const x = Number(tableInput.value);
        const res = lookupFourFigureTable(tbl, x);

        tableOutput.innerHTML = `
          <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-top:8px;">
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); background:var(--bg-subtle); text-align:center; padding:10px; gap:6px;">
              <div>
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Table Lookup</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--text); margin-top:2px;">${res.tableValue}</div>
                <div style="font-size:0.65rem; color:var(--text-secondary);">Table Approximation</div>
              </div>
              <div>
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Direct Machine Exact</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--text); margin-top:2px;">${res.machineValue.toFixed(6)}</div>
                <div style="font-size:0.65rem; color:var(--text-secondary);">Full Precision</div>
              </div>
              <div>
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Difference</div>
                <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--text); margin-top:2px;">${res.difference}</div>
                <div style="font-size:0.65rem; color:var(--text-secondary);">|Table - Machine|</div>
              </div>
            </div>
            <div style="padding:8px 10px; font-size:0.75rem; color:var(--text-secondary); border-top:1px solid var(--border); background:var(--bg-card);">
              ${escapeHtml(res.description)}
            </div>
          </div>
        `;
      } catch (err) {
        tableOutput.innerHTML = `<div style="color:var(--text); font-size:0.8rem; margin-top:6px;">${escapeHtml(err.message)}</div>`;
      }
    };

    tableLookupBtn.addEventListener('click', runTableLookup);
    this._cleanup.push(() => tableLookupBtn.removeEventListener('click', runTableLookup));
    runTableLookup();
  },

  destroy() {
    if (Array.isArray(this._plots)) this._plots.forEach((d) => { try { d(); } catch (e) { /* ignore */ } });
    this._plots = [];
    if (Array.isArray(this._cleanup)) {
      this._cleanup.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    }
    this._cleanup = [];
  }
};
