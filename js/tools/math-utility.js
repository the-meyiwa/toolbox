/* ============================================================
   TOOLBOX — Math Utility
   Comprehensive mathematical knowledge, reference, computation,
   and deterministic verification layer.

   Modules:
   1. Mathematical Knowledge Library (24 categories, theorems, laws, formulas, proof status)
   2. Deterministic Solver & Lab (Equations, calculus, matrices, number theory, combinatorics)
   3. Collatz & Sequence Explorer (Deterministic Collatz with unproven conjecture tag, Fibonacci)
   4. Four-Figure Tables & Mathematical Constants (Table approximations vs Machine values)
   ============================================================ */

import {
  MATH_CATEGORIES,
  PROOF_STATUS,
  MATHEMATICAL_CONSTANTS,
  searchMathKnowledge,
  getMathematicalConstant,
  lookupFourFigureTable
} from '../lib/math-knowledge.js';

import {
  renderMath,
  renderMathInText
} from '../lib/math-renderer.js';

import {
  calculateMath,
  solveQuadratic,
  solveLinear,
  calculateCollatz,
  calculateDerivative,
  calculateIntegral,
  calculateMatrixDeterminant,
  calculateMatrixInverse,
  calculateGcd,
  calculateLcm,
  calculateTotient,
  isPrime,
  primeFactors,
  generateFibonacci,
  calculatePermutations,
  calculateCombinations,
  calculateNewtonRaphson,
  solveOdeInitialValue,
  calculateComplex,
  calculateEigenvalues2x2,
  solveLinearSystem,
  calculateModularArithmetic,
  calculateLinearRegression,
  calculateSequenceTerm,
  generateSequenceRange,
  analyzeCollatz,
  compareSequences,
  listAllSequences,
  formatSequenceValue
} from '../lib/math-engine.js';

import { copyText } from '../utils.js';

function escapeHtml(str) {
  if (!str) return '';
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
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  table: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
};

export default {
  _cleanup: [],

  render(container, { analytics, tool, artifact } = {}) {
    this.destroy();
    this._cleanup = [];

    container.innerHTML = `
      <div class="math-utility-wrapper" style="display:flex; flex-direction:column; gap:16px; font-family:var(--sans, sans-serif); color:var(--black);">

        <!-- Top Tab Bar -->
        <div class="tool-controls" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--border); padding-bottom:12px;">
          <div class="math-tab-nav" role="tablist" aria-label="Math Utility Views">
            <button type="button" class="math-tab-btn active" data-tab="knowledge">
              ${SVG_ICONS.book} Knowledge Library
            </button>
            <button type="button" class="math-tab-btn" data-tab="solver">
              ${SVG_ICONS.play} Solver & Computation Lab
            </button>
            <button type="button" class="math-tab-btn" data-tab="collatz">
              ${SVG_ICONS.sigma} Collatz & Sequences
            </button>
            <button type="button" class="math-tab-btn" data-tab="tables">
              ${SVG_ICONS.table} 4-Figure Tables & Constants
            </button>
          </div>
        </div>

        <!-- 1. TAB: KNOWLEDGE LIBRARY -->
        <div class="math-pane active" id="pane-knowledge" style="display:flex; flex-direction:column; gap:14px;">
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
          <div id="math-lib-results-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px;"></div>
        </div>

        <!-- 2. TAB: SOLVER & COMPUTATION LAB -->
        <div class="math-pane" id="pane-solver" style="display:none; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
            <!-- Left: Operation Selector & Input Form -->
            <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Deterministic Solver</span>
              </div>

              <div>
                <label class="tool-label" style="font-size:0.75rem; font-weight:700; margin-bottom:4px; display:block;">Operation</label>
                <select id="math-solver-op" class="tool-select" style="width:100%; font-size:0.85rem; padding:7px 10px;">
                  <option value="evaluate">Evaluate Expression (Arithmetic / Scientific)</option>
                  <option value="solve_quadratic">Solve Quadratic Equation (ax² + bx + c = 0)</option>
                  <option value="solve_linear">Solve Linear Equation (ax + b = 0)</option>
                  <option value="newton_raphson">Numerical Methods: Newton-Raphson Root Finder</option>
                  <option value="ode_rk4">Differential Equations: 4th-Order Runge-Kutta (RK4)</option>
                  <option value="complex">Complex Numbers: Arithmetic & Polar Form</option>
                  <option value="derivative">Calculus: Derivative d/dx f(x)</option>
                  <option value="integral">Calculus: Definite / Indefinite Integral</option>
                  <option value="matrix_det">Linear Algebra: Matrix Determinant</option>
                  <option value="matrix_inv">Linear Algebra: Matrix Inverse</option>
                  <option value="eigenvalues">Linear Algebra: 2×2 Characteristic Polynomial & Eigenvalues</option>
                  <option value="solve_system">Linear Systems: Gaussian Elimination (Ax = b)</option>
                  <option value="gcd">Number Theory: GCD & Bézout Identity</option>
                  <option value="lcm">Number Theory: LCM</option>
                  <option value="totient">Number Theory: Euler's Totient φ(n)</option>
                  <option value="prime_factors">Number Theory: Prime Factorization</option>
                  <option value="is_prime">Number Theory: Primality Test</option>
                  <option value="modular_arithmetic">Number Theory: Modular Inverse & CRT</option>
                  <option value="combinatorics">Combinatorics: P(n, r) and C(n, r)</option>
                  <option value="linear_regression">Statistics: Ordinary Least Squares Linear Regression</option>
                  <option value="statistics">Descriptive Statistics</option>
                </select>
              </div>

              <!-- Dynamic Input Fields Container -->
              <div id="math-solver-dynamic-inputs" style="display:flex; flex-direction:column; gap:10px;"></div>

              <button type="button" id="math-solver-exec-btn" class="tool-btn" style="background:var(--black); color:var(--white); font-weight:700; font-size:0.85rem; padding:8px 14px; border-radius:8px; border:none; cursor:pointer; margin-top:4px;">
                Calculate & Verify
              </button>
            </div>

            <!-- Right: Structured Result Presentation -->
            <div style="padding:16px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; flex-direction:column;">
              <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:12px;">Authoritative Output</span>
              <div id="math-solver-result-container" style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                <!-- Honest Empty State -->
                <div id="math-solver-empty" style="text-align:center; padding:40px 16px; color:var(--text-muted); font-size:0.85rem;">
                  <div style="font-size:1.5rem; margin-bottom:8px; color:var(--text-muted);">${SVG_ICONS.sigma}</div>
                  <div style="font-weight:600; color:var(--text);">No Calculation Executed</div>
                  <div style="margin-top:4px; font-size:0.78rem;">Select an operation, input parameters, and run deterministic computation.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. TAB: COLLATZ & SEQUENCES -->
        <div class="math-pane" id="pane-collatz" style="display:none; flex-direction:column; gap:14px;">
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

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; align-items:flex-end;">
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
        <div class="math-pane" id="pane-tables" style="display:none; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
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
    `;

    // 1. Setup Tab Switching
    const tabBtns = container.querySelectorAll('.math-tab-btn');
    const panes = container.querySelectorAll('.math-pane');

    tabBtns.forEach(btn => {
      const handler = () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        panes.forEach(p => {
          const isActive = p.id === `pane-${target}`;
          p.style.display = isActive ? 'flex' : 'none';
        });
      };
      btn.addEventListener('click', handler);
      this._cleanup.push(() => btn.removeEventListener('click', handler));
    });

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

        const renderedFormula = entry.formula ? renderMath(entry.formula, { displayMode: true }) : '';
        const renderedStatement = renderMathInText(entry.statement || entry.definition || '');

        return `
          <article class="math-knowledge-card">
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

    // 3. Setup Solver & Dynamic Inputs
    const opSelect = container.querySelector('#math-solver-op');
    const dynamicInputs = container.querySelector('#math-solver-dynamic-inputs');
    const execBtn = container.querySelector('#math-solver-exec-btn');
    const resultContainer = container.querySelector('#math-solver-result-container');

    const updateSolverInputs = () => {
      const op = opSelect.value;
      if (op === 'solve_quadratic') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">a (x²)</label>
              <input type="number" step="any" id="solver-a" class="tool-input" value="1" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">b (x)</label>
              <input type="number" step="any" id="solver-b" class="tool-input" value="-5" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">c (const)</label>
              <input type="number" step="any" id="solver-c" class="tool-input" value="6" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'solve_linear') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">a (x)</label>
              <input type="number" step="any" id="solver-a" class="tool-input" value="2" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">b (const)</label>
              <input type="number" step="any" id="solver-b" class="tool-input" value="-8" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'newton_raphson') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Non-Linear Function f(x) = 0</label>
            <input type="text" id="solver-expr" class="tool-input" value="cos(x) - x" style="width:100%; font-family:var(--mono, monospace);">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Initial Guess (x₀)</label>
              <input type="number" step="any" id="solver-x0" class="tool-input" value="0.5" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Max Steps</label>
              <input type="number" id="solver-steps" class="tool-input" value="25" min="1" max="100" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'ode_rk4') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">First-Order ODE dy/dx = f(x, y)</label>
            <input type="text" id="solver-expr" class="tool-input" value="x + y" style="width:100%; font-family:var(--mono, monospace);">
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Initial x₀</label>
              <input type="number" step="any" id="solver-x0" class="tool-input" value="0" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Initial y₀</label>
              <input type="number" step="any" id="solver-y0" class="tool-input" value="1" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Target xEnd</label>
              <input type="number" step="any" id="solver-xend" class="tool-input" value="1" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Method</label>
              <select id="solver-method" class="tool-select" style="width:100%; font-size:0.82rem;">
                <option value="rk4">Runge-Kutta 4th Order (RK4)</option>
                <option value="euler">Euler Method</option>
              </select>
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Steps</label>
              <input type="number" id="solver-steps" class="tool-input" value="20" min="2" max="1000" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'complex') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">First Complex (z₁)</label>
              <input type="text" id="solver-z1" class="tool-input" value="3 + 4i" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Second Complex (z₂)</label>
              <input type="text" id="solver-z2" class="tool-input" value="1 - 2i" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Operation</label>
              <select id="solver-subop" class="tool-select" style="width:100%; font-size:0.82rem;">
                <option value="add">Addition (z₁ + z₂)</option>
                <option value="subtract">Subtraction (z₁ - z₂)</option>
                <option value="multiply">Multiplication (z₁ × z₂)</option>
                <option value="divide">Division (z₁ / z₂)</option>
                <option value="polar">Polar & Modulus/Arg (z₁)</option>
                <option value="power">De Moivre Power (z₁ⁿ)</option>
              </select>
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Power n (if power)</label>
              <input type="number" id="solver-power-n" class="tool-input" value="3" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'derivative') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Function Expression f(x)</label>
            <input type="text" id="solver-expr" class="tool-input" value="x^3" style="width:100%; font-family:var(--mono, monospace);">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Variable</label>
              <input type="text" id="solver-var" class="tool-input" value="x" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Evaluate at point (optional)</label>
              <input type="number" step="any" id="solver-at" class="tool-input" placeholder="e.g. 2" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'integral') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Integrand f(x)</label>
            <input type="text" id="solver-expr" class="tool-input" value="2x" style="width:100%; font-family:var(--mono, monospace);">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Lower Bound a (optional)</label>
              <input type="number" step="any" id="solver-from" class="tool-input" placeholder="e.g. 0" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Upper Bound b (optional)</label>
              <input type="number" step="any" id="solver-to" class="tool-input" placeholder="e.g. 5" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'matrix_det' || op === 'matrix_inv') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Square Matrix (JSON format)</label>
            <textarea id="solver-matrix" class="tool-input" rows="3" style="width:100%; font-family:var(--mono, monospace); font-size:0.85rem;">[[1, 2], [3, 4]]</textarea>
          </div>
        `;
      } else if (op === 'eigenvalues') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">2×2 Square Matrix (JSON format)</label>
            <textarea id="solver-matrix" class="tool-input" rows="2" style="width:100%; font-family:var(--mono, monospace); font-size:0.85rem;">[[4, 1], [2, 3]]</textarea>
          </div>
        `;
      } else if (op === 'solve_system') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Coefficient Matrix A (n×n JSON)</label>
            <textarea id="solver-matrix" class="tool-input" rows="3" style="width:100%; font-family:var(--mono, monospace); font-size:0.85rem;">[[2, 1], [1, -1]]</textarea>
          </div>
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Constant Vector b (JSON array)</label>
            <input type="text" id="solver-vector" class="tool-input" value="[5, 1]" style="width:100%; font-family:var(--mono, monospace); font-size:0.85rem;">
          </div>
        `;
      } else if (op === 'gcd' || op === 'lcm') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">First Integer (a)</label>
              <input type="number" id="solver-a" class="tool-input" value="48" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Second Integer (b)</label>
              <input type="number" id="solver-b" class="tool-input" value="18" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'totient' || op === 'prime_factors' || op === 'is_prime') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Positive Integer (n)</label>
            <input type="number" id="solver-n" class="tool-input" value="60" min="1" style="width:100%; font-family:var(--mono, monospace);">
          </div>
        `;
      } else if (op === 'modular_arithmetic') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Operation</label>
              <select id="solver-subop" class="tool-select" style="width:100%; font-size:0.82rem;">
                <option value="inverse">Modular Inverse a⁻¹ mod m</option>
                <option value="mod_exp">Modular Exponentiation a^b mod m</option>
                <option value="crt">Chinese Remainder Theorem</option>
              </select>
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Modulus m / Moduli [m₁, m₂...]</label>
              <input type="text" id="solver-mod" class="tool-input" value="26" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">a / Base / Remainders [r₁, r₂...]</label>
              <input type="text" id="solver-a" class="tool-input" value="7" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">b / Exponent (if mod exp)</label>
              <input type="text" id="solver-b" class="tool-input" value="1" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'combinatorics') {
        dynamicInputs.innerHTML = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Total Elements (n)</label>
              <input type="number" id="solver-n" class="tool-input" value="5" min="0" style="width:100%; font-family:var(--mono, monospace);">
            </div>
            <div>
              <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Subset Size (r)</label>
              <input type="number" id="solver-r" class="tool-input" value="2" min="0" style="width:100%; font-family:var(--mono, monospace);">
            </div>
          </div>
        `;
      } else if (op === 'linear_regression') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Independent Variable X (comma-separated)</label>
            <input type="text" id="solver-x-data" class="tool-input" value="1, 2, 3, 4, 5" style="width:100%; font-family:var(--mono, monospace);">
          </div>
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Dependent Variable Y (comma-separated)</label>
            <input type="text" id="solver-y-data" class="tool-input" value="2.2, 3.8, 6.1, 8.0, 9.9" style="width:100%; font-family:var(--mono, monospace);">
          </div>
        `;
      } else if (op === 'statistics') {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Data Values (comma-separated)</label>
            <input type="text" id="solver-data" class="tool-input" value="12, 15, 14, 10, 18, 22, 19, 15" style="width:100%; font-family:var(--mono, monospace);">
          </div>
        `;
      } else {
        dynamicInputs.innerHTML = `
          <div>
            <label class="tool-label" style="font-size:0.72rem; font-weight:700;">Expression or Equation</label>
            <input type="text" id="solver-expr" class="tool-input" value="1837 * 492" style="width:100%; font-family:var(--mono, monospace);">
          </div>
        `;
      }
    };

    opSelect.addEventListener('change', updateSolverInputs);
    this._cleanup.push(() => opSelect.removeEventListener('change', updateSolverInputs));
    updateSolverInputs();

    // Execute computation in Solver & Lab
    const handleExecute = () => {
      const op = opSelect.value;
      try {
        let res;
        if (op === 'solve_quadratic') {
          const a = Number(container.querySelector('#solver-a').value);
          const b = Number(container.querySelector('#solver-b').value);
          const c = Number(container.querySelector('#solver-c').value);
          res = solveQuadratic(a, b, c);
        } else if (op === 'solve_linear') {
          const a = Number(container.querySelector('#solver-a').value);
          const b = Number(container.querySelector('#solver-b').value);
          res = solveLinear(a, b);
        } else if (op === 'newton_raphson') {
          const expr = container.querySelector('#solver-expr').value;
          const x0 = Number(container.querySelector('#solver-x0').value);
          const steps = Number(container.querySelector('#solver-steps').value);
          res = calculateNewtonRaphson(expr, { x0, maxSteps: steps });
        } else if (op === 'ode_rk4') {
          const expr = container.querySelector('#solver-expr').value;
          const x0 = Number(container.querySelector('#solver-x0').value);
          const y0 = Number(container.querySelector('#solver-y0').value);
          const xEnd = Number(container.querySelector('#solver-xend').value);
          const method = container.querySelector('#solver-method').value;
          const steps = Number(container.querySelector('#solver-steps').value);
          res = solveOdeInitialValue(expr, x0, y0, xEnd, { steps, method });
        } else if (op === 'complex') {
          const z1Str = container.querySelector('#solver-z1').value;
          const z2Str = container.querySelector('#solver-z2').value;
          const subOp = container.querySelector('#solver-subop').value;
          const powerN = Number(container.querySelector('#solver-power-n').value);
          res = calculateComplex(subOp, z1Str, z2Str, { power: powerN });
        } else if (op === 'derivative') {
          const expr = container.querySelector('#solver-expr').value;
          const v = container.querySelector('#solver-var').value || 'x';
          const atVal = container.querySelector('#solver-at').value;
          res = calculateDerivative(expr, v, atVal !== '' ? atVal : null);
        } else if (op === 'integral') {
          const expr = container.querySelector('#solver-expr').value;
          const fromVal = container.querySelector('#solver-from').value;
          const toVal = container.querySelector('#solver-to').value;
          res = calculateIntegral(expr, {
            from: fromVal !== '' ? fromVal : null,
            to: toVal !== '' ? toVal : null
          });
        } else if (op === 'matrix_det') {
          const mStr = container.querySelector('#solver-matrix').value;
          const mat = JSON.parse(mStr);
          res = calculateMatrixDeterminant(mat);
        } else if (op === 'matrix_inv') {
          const mStr = container.querySelector('#solver-matrix').value;
          const mat = JSON.parse(mStr);
          res = calculateMatrixInverse(mat);
        } else if (op === 'eigenvalues') {
          const mStr = container.querySelector('#solver-matrix').value;
          const mat = JSON.parse(mStr);
          res = calculateEigenvalues2x2(mat);
        } else if (op === 'solve_system') {
          const mStr = container.querySelector('#solver-matrix').value;
          const vStr = container.querySelector('#solver-vector').value;
          const mat = JSON.parse(mStr);
          const vec = JSON.parse(vStr);
          res = solveLinearSystem(mat, vec);
        } else if (op === 'gcd') {
          const a = Number(container.querySelector('#solver-a').value);
          const b = Number(container.querySelector('#solver-b').value);
          res = calculateGcd(a, b);
        } else if (op === 'lcm') {
          const a = Number(container.querySelector('#solver-a').value);
          const b = Number(container.querySelector('#solver-b').value);
          res = calculateLcm(a, b);
        } else if (op === 'totient') {
          const n = Number(container.querySelector('#solver-n').value);
          res = calculateTotient(n);
        } else if (op === 'prime_factors') {
          const n = Number(container.querySelector('#solver-n').value);
          const factors = primeFactors(n);
          res = {
            operation: 'prime_factors',
            input: n,
            factors,
            formatted: factors.map(f => `${f.prime}^${f.power}`).join(' × '),
            message: `${n} = ${factors.map(f => `${f.prime}^${f.power}`).join(' × ')}`
          };
        } else if (op === 'is_prime') {
          const n = Number(container.querySelector('#solver-n').value);
          const prime = isPrime(n);
          res = {
            operation: 'is_prime',
            input: n,
            isPrime: prime,
            message: `${n} is ${prime ? 'a prime number' : 'composite / not prime'}.`
          };
        } else if (op === 'modular_arithmetic') {
          const subOp = container.querySelector('#solver-subop').value;
          const aVal = container.querySelector('#solver-a').value;
          const bVal = container.querySelector('#solver-b').value;
          const modVal = container.querySelector('#solver-mod').value;
          if (subOp === 'crt') {
            const moduli = JSON.parse(modVal.startsWith('[') ? modVal : `[${modVal}]`);
            const remainders = JSON.parse(aVal.startsWith('[') ? aVal : `[${aVal}]`);
            res = calculateModularArithmetic({ subOp: 'crt', moduli, remainders });
          } else if (subOp === 'mod_exp') {
            res = calculateModularArithmetic({ subOp: 'mod_exp', a: Number(aVal), b: Number(bVal), m: Number(modVal) });
          } else {
            res = calculateModularArithmetic({ subOp: 'inverse', a: Number(aVal), m: Number(modVal) });
          }
        } else if (op === 'combinatorics') {
          const n = Number(container.querySelector('#solver-n').value);
          const r = Number(container.querySelector('#solver-r').value);
          const perm = calculatePermutations(n, r);
          const comb = calculateCombinations(n, r);
          res = {
            operation: 'combinatorics',
            n, r,
            permutations: perm.result,
            combinations: comb.result,
            steps: [perm.formula, comb.formula],
            message: `P(${n}, ${r}) = ${perm.result} | C(${n}, ${r}) = ${comb.result}`
          };
        } else if (op === 'linear_regression') {
          const xStr = container.querySelector('#solver-x-data').value;
          const yStr = container.querySelector('#solver-y-data').value;
          const xArr = xStr.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
          const yArr = yStr.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
          res = calculateLinearRegression(xArr, yArr);
        } else {
          const expr = container.querySelector('#solver-expr').value;
          res = calculateMath({ expression: expr });
        }

        renderSolverOutput(res);
      } catch (err) {
        resultContainer.innerHTML = `
          <div style="padding:12px; border-radius:8px; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text); font-size:0.85rem;">
            <strong>Computation Error:</strong> ${escapeHtml(err.message)}
          </div>
        `;
      }
    };

    execBtn.addEventListener('click', handleExecute);
    this._cleanup.push(() => execBtn.removeEventListener('click', handleExecute));

    const renderSolverOutput = (data) => {
      let mainContent = '';
      if (data.roots) {
        const rootsList = data.roots.map((r, i) => `x<sub>${i + 1}</sub> = <strong>${r}</strong>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Roots</div>
          <div style="font-family:var(--mono, monospace); font-size:1.25rem; margin-top:4px; color:var(--text);">${rootsList}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">${escapeHtml(data.nature)} (D = ${data.discriminant})</div>
        `;
      } else if (data.operation === 'newton_raphson') {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Numerical Root (Newton-Raphson)</div>
          <div style="font-family:var(--mono, monospace); font-size:1.3rem; margin-top:4px; color:var(--text);">
            Root x* = <strong>${data.root}</strong>
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
            Residual |f(x*)| = ${data.residual} | Steps: ${data.iterationCount} | Initial x₀ = ${data.x0}
          </div>
        `;
      } else if (data.operation === 'ode_rk4' || data.operation === 'ode_euler') {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">ODE Solution (${escapeHtml(data.method || 'RK4')})</div>
          <div style="font-family:var(--mono, monospace); font-size:1.3rem; margin-top:4px; color:var(--text);">
            y(${data.xEnd}) = <strong>${data.yEnd}</strong>
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
            Initial: y(${data.x0}) = ${data.y0} | Step size h = ${data.stepSize} (${data.stepsCount} steps)
          </div>
        `;
      } else if (data.operation === 'complex' && data.rectangular) {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Complex Result</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:6px; margin-top:6px;">
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Cartesian</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.rectangular)}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Polar</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--primary, #2563eb);">${escapeHtml(data.polar?.notation || '')}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Modulus |z|</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.modulus)}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Arg θ</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.polar?.degrees)}°</div>
            </div>
          </div>
        `;
      } else if (data.operation === 'eigenvalues') {
        const e1 = data.eigenvalues?.lambda1;
        const e2 = data.eigenvalues?.lambda2;
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Characteristic Polynomial & Eigenvalues</div>
          <div style="font-family:var(--mono, monospace); font-size:0.9rem; margin-top:4px; color:var(--text);">p(λ) = ${escapeHtml(data.characteristicPolynomial)} = 0</div>
          <div style="font-family:var(--mono, monospace); font-size:1.15rem; font-weight:700; margin-top:6px; color:var(--text);">
            λ₁ = ${escapeHtml(e1?.formatted || e1?.val || '')} &nbsp;|&nbsp; λ₂ = ${escapeHtml(e2?.formatted || e2?.val || '')}
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Trace τ = ${escapeHtml(data.trace)} | Determinant Δ = ${escapeHtml(data.determinant)} | Residual = ${escapeHtml(data.residual)}</div>
        `;
      } else if (data.operation === 'solve_system') {
        const solText = Array.isArray(data.solution) ? data.solution.map((v, i) => `x<sub>${i + 1}</sub> = <strong>${v}</strong>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;') : '';
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Linear System Solution (Ax = b)</div>
          <div style="font-family:var(--mono, monospace); font-size:1.2rem; margin-top:4px; color:var(--text);">${solText}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Rank: ${data.rank} | Residual ||Ax - b|| = ${data.residual}</div>
        `;
      } else if (data.operation === 'linear_regression') {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Linear Regression (OLS)</div>
          <div style="font-family:var(--mono, monospace); font-size:1.25rem; font-weight:700; margin-top:4px; color:var(--primary, #2563eb);">
            ${escapeHtml(data.equation)}
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:6px; margin-top:8px;">
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Slope (m)</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.slope)}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Intercept (c)</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.intercept)}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">Pearson (r)</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.correlationR)}</div>
            </div>
            <div style="padding:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.65rem; color:var(--text-muted);">R²</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; color:var(--text);">${escapeHtml(data.rSquared)}</div>
            </div>
          </div>
        `;
      } else if (data.operation === 'modular_arithmetic') {
        const val = data.inverse !== undefined ? `Inverse = ${data.inverse}` : (data.crtSolution !== undefined ? `x ≡ ${data.crtSolution} (mod ${data.modulusProduct})` : data.result);
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Modular Arithmetic (${escapeHtml(data.subOp || 'Computation')})</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.25rem; margin-top:4px; color:var(--text);">${escapeHtml(val)}</div>
        `;
      } else if (data.root !== undefined) {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Root</div>
          <div style="font-family:var(--mono, monospace); font-size:1.25rem; margin-top:4px; color:var(--text);">${data.variable || 'x'} = <strong>${data.root}</strong></div>
        `;
      } else if (data.determinant !== undefined) {
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Determinant</div>
          <div style="font-family:var(--mono, monospace); font-size:1.3rem; margin-top:4px; color:var(--text);">det(A) = <strong>${data.determinant}</strong></div>
        `;
      } else if (data.inverse) {
        const invRows = data.inverse.map(r => `[ ${r.join(', ')} ]`).join('\n');
        mainContent = `
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Inverse Matrix A⁻¹</div>
          <pre style="margin:6px 0 0 0; padding:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; font-family:var(--mono, monospace); font-size:0.85rem; color:var(--text);">${escapeHtml(invRows)}</pre>
        `;
      } else if (data.permutations !== undefined) {
        mainContent = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div style="padding:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted);">Permutations P(${data.n}, ${data.r})</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; margin-top:2px; color:var(--text);">${data.permutations}</div>
            </div>
            <div style="padding:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; text-align:center;">
              <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted);">Combinations C(${data.n}, ${data.r})</div>
              <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; margin-top:2px; color:var(--text);">${data.combinations}</div>
            </div>
          </div>
        `;
      } else {
        const val = data.result !== undefined ? data.result : (data.gcd || data.lcm || data.phi || data.message);
        mainContent = `
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.25rem; color:var(--text);">${escapeHtml(val)}</div>
        `;
      }

      resultContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <span style="font-weight:700; font-size:0.85rem; color:var(--text);">${escapeHtml(data.operation || 'Result')}</span>
            ${data.verified !== undefined ? `
              <span class="math-proof-badge ${data.verified ? 'math-badge-proven' : 'math-badge-conjecture'}">
                ${data.verified ? 'VERIFIED' : 'UNVERIFIED'}
              </span>
            ` : ''}
          </div>

          <div style="padding:12px; border-radius:8px; background:var(--bg-subtle); border:1px solid var(--border);">
            ${mainContent}
          </div>

          ${Array.isArray(data.steps) && data.steps.length > 0 ? `
            <div style="border:1px solid var(--border); border-radius:8px; padding:8px 10px; background:var(--bg-card);">
              <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Verification & Steps:</div>
              <ol style="margin:0 0 0 16px; padding:0; font-family:var(--mono, monospace); font-size:0.75rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:2px;">
                ${data.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
              </ol>
            </div>
          ` : ''}
        </div>
      `;
    };

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
            copyBtn.addEventListener('click', () => copyText(String(res.termValue)));
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
    if (Array.isArray(this._cleanup)) {
      this._cleanup.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    }
    this._cleanup = [];
  }
};
