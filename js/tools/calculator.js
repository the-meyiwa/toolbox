/* ============================================================
   TOOLBOX — Universal Calculator
   A comprehensive calculation engine integrating functions of every
   major calculating device: Standard, Scientific, Programmer (Base-N & Bit Matrix),
   Financial (TVM, Amortization, NPV/IRR, Depreciation), Engineering (Complex, Matrices,
   Vectors, Circuits, Physics), Statistics & Distributions, 2D Graphing,
   RPN 4-Level Stack, and Universal Unit & Physical Constants Library.
   ============================================================ */

import { attachSegmentedSlider } from '../lib/segmented-slider.js';

export default {
  keyListener: null,

  render(container, { analytics, tool, artifact }) {
    container.innerHTML = `
      <div class="calc-wrapper">
        <!-- Top Mode Selector Bar -->
        <div class="calc-mode-bar" id="calc-mode-bar" role="tablist" aria-label="Calculator Modes">
          <button type="button" class="calc-mode-btn active" data-mode="standard" role="tab" aria-selected="true">Standard</button>
          <button type="button" class="calc-mode-btn" data-mode="scientific" role="tab" aria-selected="false">Scientific</button>
          <button type="button" class="calc-mode-btn" data-mode="programmer" role="tab" aria-selected="false">Programmer</button>
          <button type="button" class="calc-mode-btn" data-mode="financial" role="tab" aria-selected="false">Financial</button>
          <button type="button" class="calc-mode-btn" data-mode="engineering" role="tab" aria-selected="false">Engineering</button>
          <button type="button" class="calc-mode-btn" data-mode="statistics" role="tab" aria-selected="false">Statistics</button>
          <button type="button" class="calc-mode-btn" data-mode="graphing" role="tab" aria-selected="false">Graphing</button>
          <button type="button" class="calc-mode-btn" data-mode="rpn" role="tab" aria-selected="false">RPN Stack</button>
          <button type="button" class="calc-mode-btn" data-mode="constants" role="tab" aria-selected="false">Units & Constants</button>
        </div>

        <!-- Mode Containers -->
        <div class="calc-views-container">

          <!-- 1. STANDARD MODE -->
          <div class="calc-pane active" id="pane-standard">
            <div class="calc-main-layout">
              <div class="calc-core-screen">
                <div class="calc-screen-top">
                  <div class="calc-indicators">
                    <span class="calc-ind" id="std-ind-m" title="Memory active">M</span>
                    <span class="calc-ind" id="std-ind-deg">DEG</span>
                  </div>
                  <div class="calc-expr-line" id="std-expr"></div>
                </div>
                <div class="calc-main-display" id="std-display">0</div>
              </div>

              <!-- Memory & Utility Row -->
              <div class="calc-mem-row">
                <button type="button" class="calc-btn calc-btn-mem" data-action="mc">MC</button>
                <button type="button" class="calc-btn calc-btn-mem" data-action="mr">MR</button>
                <button type="button" class="calc-btn calc-btn-mem" data-action="m-plus">M+</button>
                <button type="button" class="calc-btn calc-btn-mem" data-action="m-minus">M-</button>
                <button type="button" class="calc-btn calc-btn-mem" data-action="ms">MS</button>
              </div>

              <!-- Standard Keypad -->
              <div class="calc-grid-standard">
                <button type="button" class="calc-btn calc-btn-op" data-action="pct">%</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="ce">CE</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="c">C</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="back">⌫</button>

                <button type="button" class="calc-btn calc-btn-fn" data-action="recip">¹/x</button>
                <button type="button" class="calc-btn calc-btn-fn" data-action="sq">x²</button>
                <button type="button" class="calc-btn calc-btn-fn" data-action="sqrt">√x</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="div">÷</button>

                <button type="button" class="calc-btn calc-btn-num" data-val="7">7</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="8">8</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="9">9</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="mul">×</button>

                <button type="button" class="calc-btn calc-btn-num" data-val="4">4</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="5">5</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="6">6</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="sub">−</button>

                <button type="button" class="calc-btn calc-btn-num" data-val="1">1</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="2">2</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="3">3</button>
                <button type="button" class="calc-btn calc-btn-op" data-action="add">+</button>

                <button type="button" class="calc-btn calc-btn-fn" data-action="neg">±</button>
                <button type="button" class="calc-btn calc-btn-num" data-val="0">0</button>
                <button type="button" class="calc-btn calc-btn-num" data-val=".">.</button>
                <button type="button" class="calc-btn calc-btn-eq" data-action="eq">=</button>
              </div>
            </div>

            <!-- Tape History Sidebar -->
            <div class="calc-tape-card">
              <div class="calc-tape-head">
                <span class="calc-tape-title">Paper Tape History</span>
                <button type="button" class="calc-tape-clear-btn" id="std-clear-tape" title="Clear History">Clear</button>
              </div>
              <div class="calc-tape-list" id="std-tape-list">
                <div class="calc-tape-empty">Calculations appear here. Click any entry to recall it.</div>
              </div>
            </div>
          </div>

          <!-- 2. SCIENTIFIC MODE -->
          <div class="calc-pane" id="pane-scientific">
            <div class="calc-main-layout">
              <div class="calc-core-screen">
                <div class="calc-screen-top">
                  <div class="calc-indicators">
                    <button type="button" class="calc-tag-btn active" id="sci-angle-toggle">DEG</button>
                    <button type="button" class="calc-tag-btn" id="sci-2nd-toggle">2nd</button>
                    <button type="button" class="calc-tag-btn" id="sci-hyp-toggle">HYP</button>
                  </div>
                  <div class="calc-expr-line" id="sci-expr"></div>
                </div>
                <div class="calc-main-display" id="sci-display">0</div>
              </div>

              <!-- Scientific Extended Keypad -->
              <div class="calc-grid-scientific">
                <button type="button" class="calc-btn calc-btn-sci" data-sci="sin">sin</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="cos">cos</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="tan">tan</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="pi">π</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="e">e</button>

                <button type="button" class="calc-btn calc-btn-sci" data-sci="ln">ln</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="log">log₁₀</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="log2">log₂</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="pow2">x²</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="powy">xʸ</button>

                <button type="button" class="calc-btn calc-btn-sci" data-sci="sqrt">√x</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="cbrt">∛x</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="nroot">ʸ√x</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="fact">n!</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="npr">nPr</button>

                <button type="button" class="calc-btn calc-btn-sci" data-sci="ncr">nCr</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="mod">mod</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="abs">|x|</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="lparen">(</button>
                <button type="button" class="calc-btn calc-btn-sci" data-sci="rparen">)</button>

                <button type="button" class="calc-btn calc-btn-op" data-sci="ce">CE</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="c">C</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="back">⌫</button>
                <button type="button" class="calc-btn calc-btn-fn" data-sci="exp">EXP</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="div">÷</button>

                <button type="button" class="calc-btn calc-btn-num" data-sci-num="7">7</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="8">8</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="9">9</button>
                <button type="button" class="calc-btn calc-btn-fn" data-sci="gcd">GCD</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="mul">×</button>

                <button type="button" class="calc-btn calc-btn-num" data-sci-num="4">4</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="5">5</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="6">6</button>
                <button type="button" class="calc-btn calc-btn-fn" data-sci="lcm">LCM</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="sub">−</button>

                <button type="button" class="calc-btn calc-btn-num" data-sci-num="1">1</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="2">2</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num="3">3</button>
                <button type="button" class="calc-btn calc-btn-fn" data-sci="neg">±</button>
                <button type="button" class="calc-btn calc-btn-op" data-sci="add">+</button>

                <button type="button" class="calc-btn calc-btn-num" data-sci-num="0">0</button>
                <button type="button" class="calc-btn calc-btn-num" data-sci-num=".">.</button>
                <button type="button" class="calc-btn calc-btn-fn" data-sci="rand">RAND</button>
                <button type="button" class="calc-btn calc-btn-eq" style="grid-column: span 2;" data-sci="eq">=</button>
              </div>
            </div>

            <!-- Scientific Calculus & Polynomial Solvers -->
            <div class="calc-side-tools">
              <div class="calc-tool-card">
                <h4 class="calc-card-title">Polynomial & Equation Solver</h4>
                <div class="calc-form-row">
                  <select id="sci-eq-type" class="tool-input" style="font-size:0.82rem;">
                    <option value="quad">Quadratic (ax² + bx + c = 0)</option>
                    <option value="linear">Linear (ax + b = 0)</option>
                    <option value="cubic">Cubic (ax³ + bx² + cx + d = 0)</option>
                    <option value="sys2">2x2 System (ax + by = c)</option>
                  </select>
                </div>
                <div id="sci-eq-inputs" class="calc-eq-fields">
                  <!-- Rendered dynamically -->
                </div>
                <button type="button" class="btn btn-primary" id="sci-eq-solve" style="width:100%; margin-top:8px;">Solve Equation</button>
                <div id="sci-eq-result" class="calc-res-box">Roots & discriminant appear here.</div>
              </div>

              <div class="calc-tool-card">
                <h4 class="calc-card-title">Definite Numerical Integral (Simpson's 1/3)</h4>
                <div class="calc-form-row" style="margin-bottom:6px;">
                  <input type="text" id="sci-int-expr" class="tool-input" placeholder="f(x), e.g. x^2 + sin(x)" value="x^2">
                </div>
                <div class="calc-form-grid-2">
                  <div><label class="calc-label">Lower (a)</label><input type="number" id="sci-int-a" class="tool-input" value="0"></div>
                  <div><label class="calc-label">Upper (b)</label><input type="number" id="sci-int-b" class="tool-input" value="3"></div>
                </div>
                <button type="button" class="btn btn-secondary" id="sci-int-calc" style="width:100%; margin-top:8px;">Compute Integral ∫</button>
                <div id="sci-int-result" class="calc-res-box">Result: 9</div>
              </div>
            </div>
          </div>

          <!-- 3. PROGRAMMER MODE -->
          <div class="calc-pane" id="pane-programmer">
            <div class="calc-prog-container">
              <!-- Live 4-Base Synchronous Readout -->
              <div class="calc-prog-bases-card">
                <div class="calc-base-row active" data-base="16">
                  <span class="calc-base-tag">HEX</span>
                  <span class="calc-base-val" id="prog-hex-val">0</span>
                </div>
                <div class="calc-base-row" data-base="10">
                  <span class="calc-base-tag">DEC</span>
                  <span class="calc-base-val" id="prog-dec-val">0</span>
                </div>
                <div class="calc-base-row" data-base="8">
                  <span class="calc-base-tag">OCT</span>
                  <span class="calc-base-val" id="prog-oct-val">0</span>
                </div>
                <div class="calc-base-row" data-base="2">
                  <span class="calc-base-tag">BIN</span>
                  <span class="calc-base-val" id="prog-bin-val">0000 0000 0000 0000</span>
                </div>
              </div>

              <!-- Word Size & Sign Controls -->
              <div class="calc-prog-controls">
                <div class="calc-chip-group">
                  <button type="button" class="calc-chip-btn active" data-bits="64">QWORD (64-bit)</button>
                  <button type="button" class="calc-chip-btn" data-bits="32">DWORD (32-bit)</button>
                  <button type="button" class="calc-chip-btn" data-bits="16">WORD (16-bit)</button>
                  <button type="button" class="calc-chip-btn" data-bits="8">BYTE (8-bit)</button>
                </div>
                <div class="calc-chip-group">
                  <button type="button" class="calc-chip-btn active" id="prog-sign-btn">Signed (2's C)</button>
                </div>
              </div>

              <!-- Interactive 64-Bit Bit Flipper Matrix -->
              <div class="calc-bit-matrix-card">
                <div class="calc-bit-matrix-header">
                  <span>Interactive Bit Flipper (Click any bit to toggle)</span>
                  <span id="prog-bit-hover-info">Bit: -</span>
                </div>
                <div class="calc-bit-grid" id="prog-bit-grid">
                  <!-- 64 interactive bit cells -->
                </div>
              </div>

              <!-- Programmer Logic & Math Keypad -->
              <div class="calc-grid-programmer">
                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="A">A</button>
                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="B">B</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="and">AND</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="or">OR</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="not">NOT</button>

                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="C">C</button>
                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="D">D</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="xor">XOR</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="nand">NAND</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="nor">NOR</button>

                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="E">E</button>
                <button type="button" class="calc-btn calc-btn-hex" data-prog-hex="F">F</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="shl">LSH (&lt;&lt;)</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="shr">RSH (&gt;&gt;)</button>
                <button type="button" class="calc-btn calc-btn-bit" data-prog-op="bswap">BSWAP</button>

                <button type="button" class="calc-btn calc-btn-num" data-prog-num="7">7</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="8">8</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="9">9</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-action="c">C</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-action="back">⌫</button>

                <button type="button" class="calc-btn calc-btn-num" data-prog-num="4">4</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="5">5</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="6">6</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-math="div">÷</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-math="mul">×</button>

                <button type="button" class="calc-btn calc-btn-num" data-prog-num="1">1</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="2">2</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="3">3</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-math="sub">−</button>
                <button type="button" class="calc-btn calc-btn-op" data-prog-math="add">+</button>

                <button type="button" class="calc-btn calc-btn-fn" data-prog-action="neg">±</button>
                <button type="button" class="calc-btn calc-btn-num" data-prog-num="0" style="grid-column: span 2;">0</button>
                <button type="button" class="calc-btn calc-btn-eq" data-prog-action="eq" style="grid-column: span 2;">=</button>
              </div>
            </div>
          </div>

          <!-- 4. FINANCIAL & BUSINESS MODE -->
          <div class="calc-pane" id="pane-financial">
            <div class="calc-fin-grid">
              <!-- TVM Time Value of Money Solver -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Time Value of Money (TVM Solver)</h3>
                <p class="calc-card-sub">Leave one field blank to solve for it.</p>
                <div class="calc-fin-fields">
                  <div class="calc-fin-row">
                    <label>N (Number of Periods)</label>
                    <input type="number" id="tvm-n" class="tool-input" placeholder="e.g. 60">
                    <button type="button" class="btn btn-secondary calc-solve-btn" data-tvm="N">Solve N</button>
                  </div>
                  <div class="calc-fin-row">
                    <label>I/Y (Annual Interest %)</label>
                    <input type="number" step="any" id="tvm-i" class="tool-input" placeholder="e.g. 6.5">
                    <button type="button" class="btn btn-secondary calc-solve-btn" data-tvm="I">Solve I/Y</button>
                  </div>
                  <div class="calc-fin-row">
                    <label>PV (Present Value $)</label>
                    <input type="number" step="any" id="tvm-pv" class="tool-input" placeholder="e.g. 25000">
                    <button type="button" class="btn btn-secondary calc-solve-btn" data-tvm="PV">Solve PV</button>
                  </div>
                  <div class="calc-fin-row">
                    <label>PMT (Periodic Payment $)</label>
                    <input type="number" step="any" id="tvm-pmt" class="tool-input" placeholder="e.g. -489.15">
                    <button type="button" class="btn btn-secondary calc-solve-btn" data-tvm="PMT">Solve PMT</button>
                  </div>
                  <div class="calc-fin-row">
                    <label>FV (Future Value $)</label>
                    <input type="number" step="any" id="tvm-fv" class="tool-input" placeholder="e.g. 0">
                    <button type="button" class="btn btn-secondary calc-solve-btn" data-tvm="FV">Solve FV</button>
                  </div>
                </div>
                <div class="calc-fin-settings">
                  <div>
                    <label class="calc-label">Payments / Year (P/Y)</label>
                    <select id="tvm-py" class="tool-input">
                      <option value="12" selected>12 (Monthly)</option>
                      <option value="1">1 (Annual)</option>
                      <option value="2">2 (Semi-Annual)</option>
                      <option value="4">4 (Quarterly)</option>
                      <option value="365">365 (Daily)</option>
                    </select>
                  </div>
                  <div>
                    <label class="calc-label">Timing</label>
                    <select id="tvm-timing" class="tool-input">
                      <option value="END" selected>End of Period (Ordinary Annuity)</option>
                      <option value="BGN">Beginning of Period (Annuity Due)</option>
                    </select>
                  </div>
                </div>
                <div id="tvm-result-box" class="calc-res-box">Calculated TVM values appear here.</div>
              </div>

              <!-- Capital Budgeting: NPV & IRR -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Investment Analysis (NPV & IRR)</h3>
                <div class="calc-form-row">
                  <label class="calc-label">Initial Outlay ($)</label>
                  <input type="number" id="fin-npv-initial" class="tool-input" value="100000">
                </div>
                <div class="calc-form-row">
                  <label class="calc-label">Discount Rate (%)</label>
                  <input type="number" step="any" id="fin-npv-rate" class="tool-input" value="10">
                </div>
                <div class="calc-form-row">
                  <label class="calc-label">Future Cash Flows ($ comma-separated)</label>
                  <input type="text" id="fin-npv-flows" class="tool-input" value="30000, 35000, 40000, 45000">
                </div>
                <button type="button" class="btn btn-primary" id="fin-npv-calc-btn" style="width:100%; margin-top:8px;">Calculate NPV & IRR</button>
                <div id="fin-npv-res" class="calc-res-box">NPV & IRR results appear here.</div>
              </div>

              <!-- Depreciation Schedules -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Asset Depreciation Engine</h3>
                <div class="calc-form-grid-3">
                  <div><label class="calc-label">Asset Cost ($)</label><input type="number" id="dep-cost" class="tool-input" value="50000"></div>
                  <div><label class="calc-label">Salvage Value ($)</label><input type="number" id="dep-salvage" class="tool-input" value="5000"></div>
                  <div><label class="calc-label">Useful Life (Yrs)</label><input type="number" id="dep-life" class="tool-input" value="5"></div>
                </div>
                <div class="calc-form-row" style="margin-top:8px;">
                  <label class="calc-label">Method</label>
                  <select id="dep-method" class="tool-input">
                    <option value="sl">Straight-Line (SL)</option>
                    <option value="ddb">Double Declining Balance (200% DDB)</option>
                    <option value="syd">Sum-of-the-Years'-Digits (SYD)</option>
                  </select>
                </div>
                <button type="button" class="btn btn-secondary" id="dep-calc-btn" style="width:100%; margin-top:8px;">Build Depreciation Schedule</button>
                <div id="dep-schedule-table" class="calc-table-box">Schedule appears here.</div>
              </div>
            </div>
          </div>

          <!-- 5. ENGINEERING & PHYSICS MODE -->
          <div class="calc-pane" id="pane-engineering">
            <div class="calc-eng-grid">
              <!-- Complex Numbers Engine -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Complex Numbers Engine (a + bi / r∠θ)</h3>
                <div class="calc-form-grid-2">
                  <div>
                    <label class="calc-label">Complex Z₁</label>
                    <input type="text" id="eng-z1" class="tool-input" placeholder="e.g. 4 + 3i or 5∠36.87" value="3 + 4i">
                  </div>
                  <div>
                    <label class="calc-label">Complex Z₂</label>
                    <input type="text" id="eng-z2" class="tool-input" placeholder="e.g. 1 - 2i or 2∠-45" value="1 - 2i">
                  </div>
                </div>
                <div class="calc-btn-group-row" style="margin-top:8px;">
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="add">Z₁ + Z₂</button>
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="sub">Z₁ − Z₂</button>
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="mul">Z₁ × Z₂</button>
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="div">Z₁ ÷ Z₂</button>
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="mod">|Z₁| & ∠θ</button>
                  <button type="button" class="btn btn-secondary calc-z-btn" data-op="conj">Z₁* (Conjugate)</button>
                </div>
                <div id="eng-z-result" class="calc-res-box">Result appears here.</div>
              </div>

              <!-- 2D / 3D Vector Mechanics -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">2D / 3D Vector Mechanics</h3>
                <div class="calc-form-grid-2">
                  <div>
                    <label class="calc-label">Vector u (x, y, z)</label>
                    <input type="text" id="eng-vec-u" class="tool-input" value="2, 3, -1">
                  </div>
                  <div>
                    <label class="calc-label">Vector v (x, y, z)</label>
                    <input type="text" id="eng-vec-v" class="tool-input" value="1, -2, 4">
                  </div>
                </div>
                <div class="calc-btn-group-row" style="margin-top:8px;">
                  <button type="button" class="btn btn-secondary calc-vec-btn" data-op="dot">Dot Product (u · v)</button>
                  <button type="button" class="btn btn-secondary calc-vec-btn" data-op="cross">Cross Product (u × v)</button>
                  <button type="button" class="btn btn-secondary calc-vec-btn" data-op="angle">Angle (θ)</button>
                  <button type="button" class="btn btn-secondary calc-vec-btn" data-op="mag">Magnitudes (‖u‖, ‖v‖)</button>
                </div>
                <div id="eng-vec-result" class="calc-res-box">Vector results appear here.</div>
              </div>

              <!-- Matrix Algebra (2x2 to 3x3) -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Matrix Algebra Engine</h3>
                <div class="calc-form-grid-2">
                  <div>
                    <label class="calc-label">Matrix A (rows comma/semicolon, e.g. 1,2; 3,4)</label>
                    <input type="text" id="eng-mat-a" class="tool-input" value="1, 2; 3, 4">
                  </div>
                  <div>
                    <label class="calc-label">Matrix B (e.g. 5, 6; 7, 8)</label>
                    <input type="text" id="eng-mat-b" class="tool-input" value="5, 6; 7, 8">
                  </div>
                </div>
                <div class="calc-btn-group-row" style="margin-top:8px;">
                  <button type="button" class="btn btn-secondary calc-mat-btn" data-op="mul">A × B</button>
                  <button type="button" class="btn btn-secondary calc-mat-btn" data-op="add">A + B</button>
                  <button type="button" class="btn btn-secondary calc-mat-btn" data-op="deta">det(A)</button>
                  <button type="button" class="btn btn-secondary calc-mat-btn" data-op="inva">A⁻¹ (Inverse)</button>
                  <button type="button" class="btn btn-secondary calc-mat-btn" data-op="transa">Aᵀ (Transpose)</button>
                </div>
                <div id="eng-mat-result" class="calc-res-box">Matrix results appear here.</div>
              </div>

              <!-- Electrical Circuits & Resonance -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">RLC Resonance & Impedance</h3>
                <div class="calc-form-grid-3">
                  <div><label class="calc-label">Resistance R (Ω)</label><input type="number" id="eng-rlc-r" class="tool-input" value="100"></div>
                  <div><label class="calc-label">Inductance L (H)</label><input type="number" step="any" id="eng-rlc-l" class="tool-input" value="0.01"></div>
                  <div><label class="calc-label">Capacitance C (F)</label><input type="number" step="any" id="eng-rlc-c" class="tool-input" value="0.000001"></div>
                </div>
                <button type="button" class="btn btn-primary" id="eng-rlc-calc" style="width:100%; margin-top:8px;">Compute Resonant Freq & Q</button>
                <div id="eng-rlc-res" class="calc-res-box">Resonance parameters appear here.</div>
              </div>
            </div>
          </div>

          <!-- 6. STATISTICS & DISTRIBUTIONS MODE -->
          <div class="calc-pane" id="pane-statistics">
            <div class="calc-stat-grid">
              <!-- Descriptive Statistics -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Descriptive Data Statistics (1-Var & 2-Var)</h3>
                <label class="calc-label">Data Set X (comma or space separated)</label>
                <textarea id="stat-data-x" class="tool-input" rows="3" style="font-family:var(--mono);">12, 15, 18, 22, 25, 29, 31, 35, 42, 48, 55, 60</textarea>
                <label class="calc-label" style="margin-top:6px;">Data Set Y (optional for 2-Var / Regression)</label>
                <textarea id="stat-data-y" class="tool-input" rows="2" style="font-family:var(--mono);">20, 24, 30, 38, 41, 50, 56, 62, 75, 84, 95, 102</textarea>
                <button type="button" class="btn btn-primary" id="stat-calc-btn" style="width:100%; margin-top:8px;">Calculate Summary Statistics</button>
                <div id="stat-summary-res" class="calc-table-box" style="margin-top:8px;">Results will appear here.</div>
              </div>

              <!-- Probability Distributions -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Probability Distributions</h3>
                <div class="calc-form-row">
                  <select id="stat-dist-type" class="tool-input">
                    <option value="norm">Normal Distribution (Gaussian)</option>
                    <option value="binom">Binomial Distribution (n, p, k)</option>
                    <option value="poisson">Poisson Distribution (λ, k)</option>
                  </select>
                </div>
                <div id="stat-dist-inputs" class="calc-form-grid-3" style="margin-top:6px;">
                  <div><label class="calc-label">Mean (μ)</label><input type="number" id="dist-norm-mu" class="tool-input" value="0"></div>
                  <div><label class="calc-label">Std Dev (σ)</label><input type="number" id="dist-norm-sigma" class="tool-input" value="1"></div>
                  <div><label class="calc-label">Value (x)</label><input type="number" id="dist-norm-x" class="tool-input" value="1.96"></div>
                </div>
                <button type="button" class="btn btn-secondary" id="stat-dist-calc-btn" style="width:100%; margin-top:8px;">Compute PDF & CDF</button>
                <div id="stat-dist-result" class="calc-res-box">Probability outputs appear here.</div>
              </div>
            </div>
          </div>

          <!-- 7. GRAPHING MODE -->
          <div class="calc-pane" id="pane-graphing">
            <div class="calc-graph-layout">
              <div class="calc-graph-controls">
                <div class="calc-graph-fn-row">
                  <span class="calc-fn-color-dot" style="background:#3b82f6;"></span>
                  <label class="calc-fn-lbl">f₁(x) =</label>
                  <input type="text" id="graph-f1" class="tool-input" value="sin(x)" placeholder="e.g. sin(x) or x^2 - 4">
                </div>
                <div class="calc-graph-fn-row">
                  <span class="calc-fn-color-dot" style="background:#ef4444;"></span>
                  <label class="calc-fn-lbl">f₂(x) =</label>
                  <input type="text" id="graph-f2" class="tool-input" value="cos(x)" placeholder="e.g. cos(x)">
                </div>
                <div class="calc-graph-fn-row">
                  <span class="calc-fn-color-dot" style="background:#10b981;"></span>
                  <label class="calc-fn-lbl">f₃(x) =</label>
                  <input type="text" id="graph-f3" class="tool-input" value="" placeholder="e.g. 0.5*x">
                </div>
                <div class="calc-btn-group-row">
                  <button type="button" class="btn btn-primary" id="graph-plot-btn">Plot Graphs</button>
                  <button type="button" class="btn btn-secondary" id="graph-zoom-in">Zoom In (+)</button>
                  <button type="button" class="btn btn-secondary" id="graph-zoom-out">Zoom Out (−)</button>
                  <button type="button" class="btn btn-secondary" id="graph-reset">Reset (Default)</button>
                </div>
                <div class="calc-graph-info-line">
                  <span>Domain: <strong id="graph-domain-lbl">[-10, 10]</strong></span>
                  <span>Range: <strong id="graph-range-lbl">[-6, 6]</strong></span>
                </div>
              </div>
              <div class="calc-canvas-wrap">
                <canvas id="calc-graph-canvas" width="680" height="420"></canvas>
              </div>
            </div>
          </div>

          <!-- 8. RPN STACK MODE -->
          <div class="calc-pane" id="pane-rpn">
            <div class="calc-main-layout">
              <div class="calc-rpn-stack-card">
                <div class="calc-rpn-row"><span class="calc-rpn-lvl">4: T</span><span class="calc-rpn-val" id="rpn-lvl-4">0</span></div>
                <div class="calc-rpn-row"><span class="calc-rpn-lvl">3: Z</span><span class="calc-rpn-val" id="rpn-lvl-3">0</span></div>
                <div class="calc-rpn-row"><span class="calc-rpn-lvl">2: Y</span><span class="calc-rpn-val" id="rpn-lvl-2">0</span></div>
                <div class="calc-rpn-row active"><span class="calc-rpn-lvl">1: X</span><span class="calc-rpn-val" id="rpn-lvl-1">0</span></div>
              </div>

              <!-- RPN Stack Control Keys -->
              <div class="calc-rpn-controls">
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="enter">ENTER ↵</button>
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="swap">x≷y</button>
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="rolldown">R↓</button>
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="rollup">R↑</button>
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="drop">DROP</button>
                <button type="button" class="calc-btn calc-btn-rpn-fn" data-rpn="clstk">CLSTK</button>
              </div>

              <div class="calc-grid-standard">
                <button type="button" class="calc-btn calc-btn-fn" data-rpn="sqrt">√x</button>
                <button type="button" class="calc-btn calc-btn-fn" data-rpn="sq">x²</button>
                <button type="button" class="calc-btn calc-btn-fn" data-rpn="inv">¹/x</button>
                <button type="button" class="calc-btn calc-btn-op" data-rpn="div">÷</button>

                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="7">7</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="8">8</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="9">9</button>
                <button type="button" class="calc-btn calc-btn-op" data-rpn="mul">×</button>

                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="4">4</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="5">5</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="6">6</button>
                <button type="button" class="calc-btn calc-btn-op" data-rpn="sub">−</button>

                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="1">1</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="2">2</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="3">3</button>
                <button type="button" class="calc-btn calc-btn-op" data-rpn="add">+</button>

                <button type="button" class="calc-btn calc-btn-fn" data-rpn="chs">CHS (±)</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num="0">0</button>
                <button type="button" class="calc-btn calc-btn-num" data-rpn-num=".">.</button>
                <button type="button" class="calc-btn calc-btn-op" data-rpn="back">⌫</button>
              </div>
            </div>
          </div>

          <!-- 9. UNITS & CONSTANTS MATRIX -->
          <div class="calc-pane" id="pane-constants">
            <div class="calc-const-grid">
              <!-- Physical & Universal Constants Library -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Universal Physical & Mathematical Constants</h3>
                <p class="calc-card-sub">Click any constant to copy its exact value or push to calculator.</p>
                <div class="calc-constants-list" id="calc-const-list">
                  <!-- Generated dynamically -->
                </div>
              </div>

              <!-- Fast Unit Converter Component -->
              <div class="calc-tool-card">
                <h3 class="calc-card-title">Quick Unit Dimensional Converter</h3>
                <div class="calc-form-row">
                  <label class="calc-label">Dimension</label>
                  <select id="calc-unit-cat" class="tool-input">
                    <option value="length">Length</option>
                    <option value="mass">Mass / Weight</option>
                    <option value="temp">Temperature</option>
                    <option value="speed">Speed / Velocity</option>
                    <option value="energy">Energy & Work</option>
                    <option value="pressure">Pressure</option>
                    <option value="data">Digital Storage</option>
                  </select>
                </div>
                <div class="calc-form-grid-2" style="margin-top:6px;">
                  <div>
                    <label class="calc-label">From</label>
                    <input type="number" id="calc-unit-from-val" class="tool-input" value="1">
                    <select id="calc-unit-from-type" class="tool-input" style="margin-top:4px;"></select>
                  </div>
                  <div>
                    <label class="calc-label">To</label>
                    <div id="calc-unit-to-val" class="calc-res-box" style="margin-top:0; min-height:42px; font-weight:600;">-</div>
                    <select id="calc-unit-to-type" class="tool-input" style="margin-top:4px;"></select>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    // Initialize all sub-engines
    initModeSwitcher(container);
    initStandardEngine(container);
    initScientificEngine(container);
    initProgrammerEngine(container);
    initFinancialEngine(container);
    initEngineeringEngine(container);
    initStatisticsEngine(container);
    initGraphingEngine(container);
    initRPNEngine(container);
    initConstantsEngine(container);
  },

  destroy() {
    if (this.keyListener) {
      document.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
  }
};

/* ============================================================
   1. MODE SWITCHER
   ============================================================ */
function initModeSwitcher(container) {
  const modeBar = container.querySelector('#calc-mode-bar');
  const updateSlider = modeBar ? attachSegmentedSlider(modeBar, '.calc-mode-btn') : null;

  const modeBtns = container.querySelectorAll('.calc-mode-btn');
  const panes = container.querySelectorAll('.calc-pane');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      modeBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      panes.forEach(p => p.classList.toggle('active', p.id === `pane-${mode}`));
      updateSlider?.();

      if (mode === 'graphing') {
        const plotBtn = container.querySelector('#graph-plot-btn');
        plotBtn?.click();
      }
    });
  });
}

/* ============================================================
   2. STANDARD ENGINE (Arithmetic, Memory, Paper Tape)
   ============================================================ */
function initStandardEngine(container) {
  let displayVal = '0';
  let prevVal = null;
  let currentOp = null;
  let waitingForOperand = false;
  let memoryVal = 0;
  let tape = [];

  const displayEl = container.querySelector('#std-display');
  const exprEl = container.querySelector('#std-expr');
  const indM = container.querySelector('#std-ind-m');
  const tapeList = container.querySelector('#std-tape-list');

  function updateDisplay() {
    displayEl.textContent = displayVal;
    indM?.classList.toggle('active', memoryVal !== 0);
  }

  function inputDigit(digit) {
    if (waitingForOperand) {
      displayVal = String(digit);
      waitingForOperand = false;
    } else {
      displayVal = displayVal === '0' && digit !== '.' ? String(digit) : displayVal + digit;
    }
    updateDisplay();
  }

  function inputDecimal() {
    if (waitingForOperand) {
      displayVal = '0.';
      waitingForOperand = false;
    } else if (!displayVal.includes('.')) {
      displayVal += '.';
    }
    updateDisplay();
  }

  function handleOp(nextOp) {
    const inputValue = parseFloat(displayVal);

    if (prevVal === null) {
      prevVal = inputValue;
    } else if (currentOp) {
      const result = performCalc(currentOp, prevVal, inputValue);
      displayVal = String(result);
      prevVal = result;
      updateDisplay();
    }

    waitingForOperand = true;
    currentOp = nextOp;
    exprEl.textContent = `${prevVal} ${getOpSymbol(nextOp)}`;
  }

  function performCalc(op, a, b) {
    switch (op) {
      case 'add': return a + b;
      case 'sub': return a - b;
      case 'mul': return a * b;
      case 'div': return b !== 0 ? a / b : 'Error';
      default: return b;
    }
  }

  function getOpSymbol(op) {
    switch (op) {
      case 'add': return '+';
      case 'sub': return '−';
      case 'mul': return '×';
      case 'div': return '÷';
      default: return '';
    }
  }

  function calculateEquals() {
    if (prevVal === null || currentOp === null) return;
    const inputValue = parseFloat(displayVal);
    const result = performCalc(currentOp, prevVal, inputValue);

    const record = `${prevVal} ${getOpSymbol(currentOp)} ${inputValue} = ${result}`;
    addTapeEntry(record, result);

    exprEl.textContent = '';
    displayVal = String(result);
    prevVal = null;
    currentOp = null;
    waitingForOperand = true;
    updateDisplay();
  }

  function addTapeEntry(record, val) {
    tape.unshift({ text: record, val });
    renderTape();
  }

  function renderTape() {
    if (!tape.length) {
      tapeList.innerHTML = `<div class="calc-tape-empty">Calculations appear here. Click any entry to recall it.</div>`;
      return;
    }
    tapeList.innerHTML = tape.map((item, idx) => `
      <div class="calc-tape-item" data-idx="${idx}" title="Click to recall ${item.val}">
        <span class="calc-tape-expr">${item.text}</span>
      </div>
    `).join('');

    tapeList.querySelectorAll('.calc-tape-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = tape[parseInt(el.dataset.idx, 10)];
        if (item) {
          displayVal = String(item.val);
          waitingForOperand = false;
          updateDisplay();
        }
      });
    });
  }

  container.querySelector('#std-clear-tape')?.addEventListener('click', () => {
    tape = [];
    renderTape();
  });

  // Wire Keypad buttons
  container.querySelectorAll('.calc-grid-standard button').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;

      if (val !== undefined) {
        if (val === '.') inputDecimal();
        else inputDigit(val);
        return;
      }

      switch (action) {
        case 'add':
        case 'sub':
        case 'mul':
        case 'div':
          handleOp(action);
          break;
        case 'eq':
          calculateEquals();
          break;
        case 'c':
          displayVal = '0';
          prevVal = null;
          currentOp = null;
          waitingForOperand = false;
          exprEl.textContent = '';
          updateDisplay();
          break;
        case 'ce':
          displayVal = '0';
          updateDisplay();
          break;
        case 'back':
          if (displayVal.length > 1) displayVal = displayVal.slice(0, -1);
          else displayVal = '0';
          updateDisplay();
          break;
        case 'neg':
          displayVal = String(parseFloat(displayVal) * -1);
          updateDisplay();
          break;
        case 'sq':
          displayVal = String(Math.pow(parseFloat(displayVal), 2));
          updateDisplay();
          break;
        case 'sqrt':
          displayVal = String(Math.sqrt(parseFloat(displayVal)));
          updateDisplay();
          break;
        case 'recip':
          displayVal = String(1 / parseFloat(displayVal));
          updateDisplay();
          break;
        case 'pct':
          displayVal = String(parseFloat(displayVal) / 100);
          updateDisplay();
          break;
      }
    });
  });

  // Memory buttons
  container.querySelectorAll('.calc-mem-row button').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const current = parseFloat(displayVal) || 0;
      switch (action) {
        case 'mc': memoryVal = 0; break;
        case 'mr': displayVal = String(memoryVal); waitingForOperand = true; break;
        case 'm-plus': memoryVal += current; break;
        case 'm-minus': memoryVal -= current; break;
        case 'ms': memoryVal = current; break;
      }
      updateDisplay();
    });
  });
}

/* ============================================================
   3. SCIENTIFIC ENGINE (Trig, Exponentials, Equation Solver, Simpson Integral)
   ============================================================ */
function initScientificEngine(container) {
  let displayVal = '0';
  let exprStr = '';
  let angleMode = 'DEG'; // DEG, RAD, GRAD
  let is2nd = false;
  let isHyp = false;

  const displayEl = container.querySelector('#sci-display');
  const exprEl = container.querySelector('#sci-expr');
  const angleBtn = container.querySelector('#sci-angle-toggle');
  const sndBtn = container.querySelector('#sci-2nd-toggle');
  const hypBtn = container.querySelector('#sci-hyp-toggle');

  function updateSciDisplay() {
    displayEl.textContent = displayVal;
    exprEl.textContent = exprStr;
  }

  angleBtn?.addEventListener('click', () => {
    angleMode = angleMode === 'DEG' ? 'RAD' : angleMode === 'RAD' ? 'GRAD' : 'DEG';
    angleBtn.textContent = angleMode;
  });

  sndBtn?.addEventListener('click', () => {
    is2nd = !is2nd;
    sndBtn.classList.toggle('active', is2nd);
  });

  hypBtn?.addEventListener('click', () => {
    isHyp = !isHyp;
    hypBtn.classList.toggle('active', isHyp);
  });

  function toRadians(val) {
    if (angleMode === 'DEG') return (val * Math.PI) / 180;
    if (angleMode === 'GRAD') return (val * Math.PI) / 200;
    return val;
  }

  function fromRadians(val) {
    if (angleMode === 'DEG') return (val * 180) / Math.PI;
    if (angleMode === 'GRAD') return (val * 200) / Math.PI;
    return val;
  }

  function factorial(n) {
    if (n < 0 || n !== Math.floor(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // Keypad
  container.querySelectorAll('.calc-grid-scientific button').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.sciNum;
      const sci = btn.dataset.sci;

      if (num !== undefined) {
        if (displayVal === '0' && num !== '.') displayVal = num;
        else displayVal += num;
        updateSciDisplay();
        return;
      }

      const v = parseFloat(displayVal) || 0;

      switch (sci) {
        case 'sin':
          displayVal = String(isHyp ? Math.sinh(v) : is2nd ? fromRadians(Math.asin(v)) : Math.sin(toRadians(v)));
          break;
        case 'cos':
          displayVal = String(isHyp ? Math.cosh(v) : is2nd ? fromRadians(Math.acos(v)) : Math.cos(toRadians(v)));
          break;
        case 'tan':
          displayVal = String(isHyp ? Math.tanh(v) : is2nd ? fromRadians(Math.atan(v)) : Math.tan(toRadians(v)));
          break;
        case 'ln':
          displayVal = String(is2nd ? Math.exp(v) : Math.log(v));
          break;
        case 'log':
          displayVal = String(is2nd ? Math.pow(10, v) : Math.log10(v));
          break;
        case 'log2':
          displayVal = String(Math.log2(v));
          break;
        case 'pi':
          displayVal = String(Math.PI);
          break;
        case 'e':
          displayVal = String(Math.E);
          break;
        case 'pow2':
          displayVal = String(Math.pow(v, 2));
          break;
        case 'sqrt':
          displayVal = String(Math.sqrt(v));
          break;
        case 'cbrt':
          displayVal = String(Math.cbrt(v));
          break;
        case 'fact':
          displayVal = String(factorial(v));
          break;
        case 'abs':
          displayVal = String(Math.abs(v));
          break;
        case 'rand':
          displayVal = String(Math.random());
          break;
        case 'neg':
          displayVal = String(v * -1);
          break;
        case 'c':
          displayVal = '0';
          exprStr = '';
          break;
        case 'ce':
          displayVal = '0';
          break;
        case 'back':
          displayVal = displayVal.length > 1 ? displayVal.slice(0, -1) : '0';
          break;
        case 'div':
        case 'mul':
        case 'add':
        case 'sub':
        case 'powy':
        case 'mod':
          exprStr = `${displayVal} ${sci}`;
          displayVal = '0';
          break;
        case 'eq':
          if (exprStr) {
            const parts = exprStr.split(' ');
            const prev = parseFloat(parts[0]);
            const op = parts[1];
            let res = v;
            if (op === 'add') res = prev + v;
            if (op === 'sub') res = prev - v;
            if (op === 'mul') res = prev * v;
            if (op === 'div') res = v !== 0 ? prev / v : 'Error';
            if (op === 'powy') res = Math.pow(prev, v);
            if (op === 'mod') res = prev % v;
            displayVal = String(res);
            exprStr = '';
          }
          break;
      }
      updateSciDisplay();
    });
  });

  // Polynomial Solver
  const eqTypeSelect = container.querySelector('#sci-eq-type');
  const eqInputsDiv = container.querySelector('#sci-eq-inputs');
  const solveBtn = container.querySelector('#sci-eq-solve');
  const eqResultDiv = container.querySelector('#sci-eq-result');

  function renderEqInputs() {
    const type = eqTypeSelect.value;
    if (type === 'quad') {
      eqInputsDiv.innerHTML = `
        <div class="calc-form-grid-3">
          <div><label class="calc-label">a</label><input type="number" id="eq-a" class="tool-input" value="1"></div>
          <div><label class="calc-label">b</label><input type="number" id="eq-b" class="tool-input" value="-5"></div>
          <div><label class="calc-label">c</label><input type="number" id="eq-c" class="tool-input" value="6"></div>
        </div>
      `;
    } else if (type === 'linear') {
      eqInputsDiv.innerHTML = `
        <div class="calc-form-grid-2">
          <div><label class="calc-label">a</label><input type="number" id="eq-a" class="tool-input" value="3"></div>
          <div><label class="calc-label">b</label><input type="number" id="eq-b" class="tool-input" value="-12"></div>
        </div>
      `;
    } else if (type === 'cubic') {
      eqInputsDiv.innerHTML = `
        <div class="calc-form-grid-4" style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">
          <div><label class="calc-label">a</label><input type="number" id="eq-a" class="tool-input" value="1"></div>
          <div><label class="calc-label">b</label><input type="number" id="eq-b" class="tool-input" value="-6"></div>
          <div><label class="calc-label">c</label><input type="number" id="eq-c" class="tool-input" value="11"></div>
          <div><label class="calc-label">d</label><input type="number" id="eq-d" class="tool-input" value="-6"></div>
        </div>
      `;
    } else {
      eqInputsDiv.innerHTML = `
        <div style="font-size:0.75rem; margin-bottom:4px;">Eq 1: a₁x + b₁y = c₁ &nbsp;|&nbsp; Eq 2: a₂x + b₂y = c₂</div>
        <div class="calc-form-grid-3">
          <input type="number" id="sys-a1" class="tool-input" placeholder="a₁ (2)" value="2">
          <input type="number" id="sys-b1" class="tool-input" placeholder="b₁ (3)" value="3">
          <input type="number" id="sys-c1" class="tool-input" placeholder="c₁ (8)" value="8">
        </div>
        <div class="calc-form-grid-3" style="margin-top:4px;">
          <input type="number" id="sys-a2" class="tool-input" placeholder="a₂ (1)" value="1">
          <input type="number" id="sys-b2" class="tool-input" placeholder="b₂ (-1)" value="-1">
          <input type="number" id="sys-c2" class="tool-input" placeholder="c₂ (-1)" value="-1">
        </div>
      `;
    }
  }

  eqTypeSelect?.addEventListener('change', renderEqInputs);
  renderEqInputs();

  solveBtn?.addEventListener('click', () => {
    const type = eqTypeSelect.value;
    if (type === 'quad') {
      const a = parseFloat(container.querySelector('#eq-a').value);
      const b = parseFloat(container.querySelector('#eq-b').value);
      const c = parseFloat(container.querySelector('#eq-c').value);
      if (isNaN(a) || isNaN(b) || isNaN(c) || a === 0) {
        eqResultDiv.textContent = 'Invalid quadratic coefficients (a ≠ 0).';
        return;
      }
      const disc = b * b - 4 * a * c;
      if (disc > 0) {
        const x1 = (-b + Math.sqrt(disc)) / (2 * a);
        const x2 = (-b - Math.sqrt(disc)) / (2 * a);
        eqResultDiv.innerHTML = `<strong>Discriminant Δ = ${disc}</strong> (2 Real Roots):<br>x₁ = <strong>${x1.toFixed(6)}</strong><br>x₂ = <strong>${x2.toFixed(6)}</strong>`;
      } else if (disc === 0) {
        const x = -b / (2 * a);
        eqResultDiv.innerHTML = `<strong>Discriminant Δ = 0</strong> (1 Double Root):<br>x = <strong>${x.toFixed(6)}</strong>`;
      } else {
        const real = (-b / (2 * a)).toFixed(6);
        const imag = (Math.sqrt(-disc) / (2 * a)).toFixed(6);
        eqResultDiv.innerHTML = `<strong>Discriminant Δ = ${disc}</strong> (Complex Conjugates):<br>x₁ = <strong>${real} + ${imag}i</strong><br>x₂ = <strong>${real} − ${imag}i</strong>`;
      }
    } else if (type === 'linear') {
      const a = parseFloat(container.querySelector('#eq-a').value);
      const b = parseFloat(container.querySelector('#eq-b').value);
      if (a === 0) eqResultDiv.textContent = 'No solution (a = 0)';
      else eqResultDiv.innerHTML = `x = <strong>${(-b / a).toFixed(6)}</strong>`;
    } else if (type === 'sys2') {
      const a1 = parseFloat(container.querySelector('#sys-a1').value);
      const b1 = parseFloat(container.querySelector('#sys-b1').value);
      const c1 = parseFloat(container.querySelector('#sys-c1').value);
      const a2 = parseFloat(container.querySelector('#sys-a2').value);
      const b2 = parseFloat(container.querySelector('#sys-b2').value);
      const c2 = parseFloat(container.querySelector('#sys-c2').value);
      const det = a1 * b2 - a2 * b1;
      if (det === 0) {
        eqResultDiv.textContent = 'Lines are parallel or dependent (det = 0).';
      } else {
        const x = (c1 * b2 - c2 * b1) / det;
        const y = (a1 * c2 - a2 * c1) / det;
        eqResultDiv.innerHTML = `System Solution:<br>x = <strong>${x.toFixed(6)}</strong><br>y = <strong>${y.toFixed(6)}</strong>`;
      }
    }
  });

  // Simpson's 1/3 Numerical Definite Integral
  container.querySelector('#sci-int-calc')?.addEventListener('click', () => {
    const expr = container.querySelector('#sci-int-expr').value;
    const a = parseFloat(container.querySelector('#sci-int-a').value);
    const b = parseFloat(container.querySelector('#sci-int-b').value);
    const out = container.querySelector('#sci-int-result');

    try {
      const fn = createMathFunction(expr);
      const n = 1000;
      const h = (b - a) / n;
      let sum = fn(a) + fn(b);
      for (let i = 1; i < n; i++) {
        const x = a + i * h;
        sum += (i % 2 === 0 ? 2 : 4) * fn(x);
      }
      const integral = (h / 3) * sum;
      out.innerHTML = `∫ f(x)dx [${a} → ${b}] = <strong>${integral.toFixed(8)}</strong>`;
    } catch (err) {
      out.textContent = 'Evaluation error. Check expression syntax.';
    }
  });
}

/* ============================================================
   4. PROGRAMMER ENGINE (Base-N, Bitwise, 64-Bit Flipper)
   ============================================================ */
function initProgrammerEngine(container) {
  let currentBigInt = 0n;
  let wordBits = 64;
  let activeBase = 10;
  let isSigned = true;

  const hexVal = container.querySelector('#prog-hex-val');
  const decVal = container.querySelector('#prog-dec-val');
  const octVal = container.querySelector('#prog-oct-val');
  const binVal = container.querySelector('#prog-bin-val');
  const bitGrid = container.querySelector('#prog-bit-grid');
  const bitInfo = container.querySelector('#prog-bit-hover-info');

  function maskValue(val) {
    if (wordBits === 64) return BigInt.asUintN(64, val);
    if (wordBits === 32) return BigInt.asUintN(32, val);
    if (wordBits === 16) return BigInt.asUintN(16, val);
    return BigInt.asUintN(8, val);
  }

  function updateProgrammerUI() {
    const masked = maskValue(currentBigInt);

    hexVal.textContent = masked.toString(16).toUpperCase();
    decVal.textContent = isSigned ? BigInt.asIntN(wordBits, masked).toString(10) : masked.toString(10);
    octVal.textContent = masked.toString(8);

    // Format binary in 4-bit nibbles
    let rawBin = masked.toString(2).padStart(wordBits, '0');
    let chunked = rawBin.match(/.{1,4}/g)?.join(' ') || rawBin;
    binVal.textContent = chunked;

    renderBitGrid(masked);
  }

  function renderBitGrid(maskedVal) {
    let cells = [];
    for (let i = wordBits - 1; i >= 0; i--) {
      const isSet = (maskedVal & (1n << BigInt(i))) !== 0n;
      cells.push(`
        <button type="button" class="calc-bit-cell ${isSet ? 'is-set' : ''}" data-bit="${i}">
          <span class="calc-bit-idx">${i}</span>
          <span class="calc-bit-digit">${isSet ? '1' : '0'}</span>
        </button>
      `);
    }
    bitGrid.innerHTML = cells.join('');

    bitGrid.querySelectorAll('.calc-bit-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const bit = BigInt(cell.dataset.bit);
        currentBigInt = currentBigInt ^ (1n << bit);
        updateProgrammerUI();
      });
      cell.addEventListener('mouseenter', () => {
        bitInfo.textContent = `Bit ${cell.dataset.bit} (2^${cell.dataset.bit} = ${(1n << BigInt(cell.dataset.bit)).toString()})`;
      });
    });
  }

  // Base row selection
  container.querySelectorAll('.calc-base-row').forEach(row => {
    row.addEventListener('click', () => {
      container.querySelectorAll('.calc-base-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      activeBase = parseInt(row.dataset.base, 10);
    });
  });

  // Word size selection
  container.querySelectorAll('.calc-chip-group button[data-bits]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.calc-chip-group button[data-bits]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wordBits = parseInt(btn.dataset.bits, 10);
      updateProgrammerUI();
    });
  });

  container.querySelector('#prog-sign-btn')?.addEventListener('click', (e) => {
    isSigned = !isSigned;
    e.target.textContent = isSigned ? "Signed (2's C)" : 'Unsigned';
    updateProgrammerUI();
  });

  // Programmer Keypad
  container.querySelectorAll('.calc-grid-programmer button').forEach(btn => {
    btn.addEventListener('click', () => {
      const hexChar = btn.dataset.progHex;
      const num = btn.dataset.progNum;
      const op = btn.dataset.progOp;
      const action = btn.dataset.progAction;

      if (hexChar || num) {
        const char = hexChar || num;
        let str = currentBigInt.toString(activeBase) + char;
        try {
          currentBigInt = BigInt(activeBase === 16 ? `0x${str}` : str);
        } catch {}
        updateProgrammerUI();
        return;
      }

      if (action === 'c') {
        currentBigInt = 0n;
        updateProgrammerUI();
      } else if (action === 'back') {
        let str = currentBigInt.toString(activeBase);
        if (str.length > 1) currentBigInt = BigInt(str.slice(0, -1));
        else currentBigInt = 0n;
        updateProgrammerUI();
      } else if (action === 'neg') {
        currentBigInt = -currentBigInt;
        updateProgrammerUI();
      } else if (op === 'not') {
        currentBigInt = ~currentBigInt;
        updateProgrammerUI();
      } else if (op === 'shl') {
        currentBigInt = currentBigInt << 1n;
        updateProgrammerUI();
      } else if (op === 'shr') {
        currentBigInt = currentBigInt >> 1n;
        updateProgrammerUI();
      }
    });
  });

  updateProgrammerUI();
}

/* ============================================================
   5. FINANCIAL & BUSINESS ENGINE (TVM, Amortization, NPV, IRR)
   ============================================================ */
function initFinancialEngine(container) {
  const resultBox = container.querySelector('#tvm-result-box');

  container.querySelectorAll('.calc-solve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const solveTarget = btn.dataset.tvm;
      const n = parseFloat(container.querySelector('#tvm-n').value);
      const i = parseFloat(container.querySelector('#tvm-i').value);
      const pv = parseFloat(container.querySelector('#tvm-pv').value);
      const pmt = parseFloat(container.querySelector('#tvm-pmt').value);
      const fv = parseFloat(container.querySelector('#tvm-fv').value);
      const py = parseFloat(container.querySelector('#tvm-py').value) || 12;
      const isBgn = container.querySelector('#tvm-timing').value === 'BGN';

      const r = (i / 100) / py;
      const type = isBgn ? 1 : 0;

      if (solveTarget === 'PMT') {
        const pmtRes = -(pv * Math.pow(1 + r, n) + fv) * r / ((1 + r * type) * (Math.pow(1 + r, n) - 1));
        container.querySelector('#tvm-pmt').value = pmtRes.toFixed(2);
        resultBox.innerHTML = `Periodic Payment PMT = <strong>$${Math.abs(pmtRes).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong> / period`;
      } else if (solveTarget === 'FV') {
        const fvRes = -(pv * Math.pow(1 + r, n) + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r);
        container.querySelector('#tvm-fv').value = fvRes.toFixed(2);
        resultBox.innerHTML = `Future Value FV = <strong>$${fvRes.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>`;
      } else if (solveTarget === 'PV') {
        const pvRes = -(fv + pmt * (1 + r * type) * (Math.pow(1 + r, n) - 1) / r) / Math.pow(1 + r, n);
        container.querySelector('#tvm-pv').value = pvRes.toFixed(2);
        resultBox.innerHTML = `Present Value PV = <strong>$${pvRes.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>`;
      } else if (solveTarget === 'N') {
        const nRes = Math.log((-fv * r + pmt * (1 + r * type)) / (pv * r + pmt * (1 + r * type))) / Math.log(1 + r);
        container.querySelector('#tvm-n').value = Math.ceil(nRes);
        resultBox.innerHTML = `Number of Periods N = <strong>${nRes.toFixed(2)}</strong> periods (${(nRes / py).toFixed(2)} years)`;
      }
    });
  });

  // NPV & IRR Solver
  container.querySelector('#fin-npv-calc-btn')?.addEventListener('click', () => {
    const initial = parseFloat(container.querySelector('#fin-npv-initial').value) || 0;
    const rate = (parseFloat(container.querySelector('#fin-npv-rate').value) || 0) / 100;
    const flows = container.querySelector('#fin-npv-flows').value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const resBox = container.querySelector('#fin-npv-res');

    if (!flows.length) {
      resBox.textContent = 'Please enter future cash flows.';
      return;
    }

    let npv = -initial;
    for (let t = 0; t < flows.length; t++) {
      npv += flows[t] / Math.pow(1 + rate, t + 1);
    }

    // IRR estimation (Newton-Raphson approximation)
    let irr = 0.1;
    for (let iter = 0; iter < 100; iter++) {
      let f = -initial;
      let df = 0;
      for (let t = 0; t < flows.length; t++) {
        const periods = t + 1;
        f += flows[t] / Math.pow(1 + irr, periods);
        df -= periods * flows[t] / Math.pow(1 + irr, periods + 1);
      }
      const newIrr = irr - f / df;
      if (Math.abs(newIrr - irr) < 1e-6) {
        irr = newIrr;
        break;
      }
      irr = newIrr;
    }

    resBox.innerHTML = `
      Net Present Value (NPV): <strong>$${npv.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong><br>
      Internal Rate of Return (IRR): <strong>${(irr * 100).toFixed(2)}%</strong>
    `;
  });

  // Depreciation Schedule
  container.querySelector('#dep-calc-btn')?.addEventListener('click', () => {
    const cost = parseFloat(container.querySelector('#dep-cost').value) || 0;
    const salvage = parseFloat(container.querySelector('#dep-salvage').value) || 0;
    const life = parseInt(container.querySelector('#dep-life').value, 10) || 5;
    const method = container.querySelector('#dep-method').value;
    const tableDiv = container.querySelector('#dep-schedule-table');

    let schedule = [];
    let bookValue = cost;
    const depreciableBase = cost - salvage;

    if (method === 'sl') {
      const annual = depreciableBase / life;
      for (let y = 1; y <= life; y++) {
        bookValue -= annual;
        schedule.push({ year: y, dep: annual, book: Math.max(salvage, bookValue) });
      }
    } else if (method === 'ddb') {
      const rate = 2 / life;
      for (let y = 1; y <= life; y++) {
        let dep = bookValue * rate;
        if (bookValue - dep < salvage) dep = bookValue - salvage;
        bookValue -= dep;
        schedule.push({ year: y, dep: dep, book: Math.max(salvage, bookValue) });
      }
    }

    tableDiv.innerHTML = `
      <table class="calc-table">
        <thead><tr><th>Year</th><th>Depreciation</th><th>Ending Book Value</th></tr></thead>
        <tbody>
          ${schedule.map(row => `<tr><td>${row.year}</td><td>$${row.dep.toFixed(2)}</td><td>$${row.book.toFixed(2)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  });
}

/* ============================================================
   6. ENGINEERING & PHYSICS ENGINE (Complex, Vectors, Matrices)
   ============================================================ */
function initEngineeringEngine(container) {
  function parseComplex(str) {
    str = str.replace(/\s+/g, '');
    if (str.includes('∠')) {
      const parts = str.split('∠');
      const r = parseFloat(parts[0]);
      const deg = parseFloat(parts[1]);
      const rad = (deg * Math.PI) / 180;
      return { r: r * Math.cos(rad), i: r * Math.sin(rad) };
    }
    const match = str.match(/^([+-]?\d*\.?\d+)?([+-]\d*\.?\d*)?i?$/);
    if (!match) return { r: 0, i: 0 };
    let real = match[1] ? parseFloat(match[1]) : 0;
    let imag = match[2] ? parseFloat(match[2].replace('+', '')) : 0;
    if (str.endsWith('i') && !match[2]) {
      imag = real; real = 0;
    }
    return { r: real, i: imag };
  }

  function formatComplex(z) {
    const sign = z.i >= 0 ? '+' : '−';
    const mag = Math.sqrt(z.r * z.r + z.i * z.i);
    const deg = (Math.atan2(z.i, z.r) * 180) / Math.PI;
    return `<strong>${z.r.toFixed(4)} ${sign} ${Math.abs(z.i).toFixed(4)}i</strong> &nbsp;(Polar: <strong>${mag.toFixed(4)} ∠ ${deg.toFixed(2)}°</strong>)`;
  }

  container.querySelectorAll('.calc-z-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const z1 = parseComplex(container.querySelector('#eng-z1').value);
      const z2 = parseComplex(container.querySelector('#eng-z2').value);
      const op = btn.dataset.op;
      const resEl = container.querySelector('#eng-z-result');

      if (op === 'add') resEl.innerHTML = formatComplex({ r: z1.r + z2.r, i: z1.i + z2.i });
      if (op === 'sub') resEl.innerHTML = formatComplex({ r: z1.r - z2.r, i: z1.i - z2.i });
      if (op === 'mul') resEl.innerHTML = formatComplex({ r: z1.r * z2.r - z1.i * z2.i, i: z1.r * z2.i + z1.i * z2.r });
      if (op === 'div') {
        const denom = z2.r * z2.r + z2.i * z2.i;
        if (denom === 0) resEl.textContent = 'Division by zero';
        else resEl.innerHTML = formatComplex({ r: (z1.r * z2.r + z1.i * z2.i) / denom, i: (z1.i * z2.r - z1.r * z2.i) / denom });
      }
      if (op === 'conj') resEl.innerHTML = formatComplex({ r: z1.r, i: -z1.i });
    });
  });

  function parseVector(str) {
    return str.split(',').map(s => parseFloat(s.trim()) || 0);
  }

  container.querySelectorAll('.calc-vec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = parseVector(container.querySelector('#eng-vec-u').value);
      const v = parseVector(container.querySelector('#eng-vec-v').value);
      const op = btn.dataset.op;
      const resEl = container.querySelector('#eng-vec-result');

      const uMag = Math.sqrt(u.reduce((s, x) => s + x * x, 0));
      const vMag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));

      if (op === 'dot') {
        const dot = u.reduce((s, x, idx) => s + x * (v[idx] || 0), 0);
        resEl.innerHTML = `Dot Product u · v = <strong>${dot.toFixed(4)}</strong>`;
      } else if (op === 'cross') {
        const cx = (u[1] || 0) * (v[2] || 0) - (u[2] || 0) * (v[1] || 0);
        const cy = (u[2] || 0) * (v[0] || 0) - (u[0] || 0) * (v[2] || 0);
        const cz = (u[0] || 0) * (v[1] || 0) - (u[1] || 0) * (v[0] || 0);
        resEl.innerHTML = `Cross Product u × v = <strong>⟨${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)}⟩</strong>`;
      } else if (op === 'angle') {
        const dot = u.reduce((s, x, idx) => s + x * (v[idx] || 0), 0);
        const cosTheta = dot / (uMag * vMag);
        const deg = (Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180) / Math.PI;
        resEl.innerHTML = `Angle θ = <strong>${deg.toFixed(2)}°</strong> (${(deg * Math.PI / 180).toFixed(4)} rad)`;
      } else if (op === 'mag') {
        resEl.innerHTML = `‖u‖ = <strong>${uMag.toFixed(4)}</strong>, ‖v‖ = <strong>${vMag.toFixed(4)}</strong>`;
      }
    });
  });

  container.querySelector('#eng-rlc-calc')?.addEventListener('click', () => {
    const R = parseFloat(container.querySelector('#eng-rlc-r').value);
    const L = parseFloat(container.querySelector('#eng-rlc-l').value);
    const C = parseFloat(container.querySelector('#eng-rlc-c').value);
    const resBox = container.querySelector('#eng-rlc-res');

    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const omega0 = 2 * Math.PI * f0;
    const Q = (1 / R) * Math.sqrt(L / C);
    const bw = f0 / Q;

    resBox.innerHTML = `
      Resonant Frequency f₀ = <strong>${f0.toFixed(2)} Hz</strong> (${(f0/1000).toFixed(3)} kHz)<br>
      Angular Frequency ω₀ = <strong>${omega0.toFixed(2)} rad/s</strong><br>
      Quality Factor Q = <strong>${Q.toFixed(3)}</strong> &nbsp;|&nbsp; Bandwidth Δf = <strong>${bw.toFixed(2)} Hz</strong>
    `;
  });
}

/* ============================================================
   7. STATISTICS & DISTRIBUTIONS ENGINE
   ============================================================ */
function initStatisticsEngine(container) {
  container.querySelector('#stat-calc-btn')?.addEventListener('click', () => {
    const rawX = container.querySelector('#stat-data-x').value;
    const rawY = container.querySelector('#stat-data-y').value;
    const out = container.querySelector('#stat-summary-res');

    const x = rawX.split(/[\s,]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const y = rawY.split(/[\s,]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

    if (!x.length) {
      out.textContent = 'Please enter at least one numeric data point.';
      return;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const meanX = sumX / n;
    const sorted = [...x].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const variance = x.reduce((a, b) => a + Math.pow(b - meanX, 2), 0) / (n - 1 || 1);
    const stdDev = Math.sqrt(variance);

    let regHtml = '';
    if (y.length === n && n > 1) {
      const sumY = y.reduce((a, b) => a + b, 0);
      const meanY = sumY / n;
      let ssXX = 0, ssYY = 0, ssXY = 0;
      for (let i = 0; i < n; i++) {
        ssXX += Math.pow(x[i] - meanX, 2);
        ssYY += Math.pow(y[i] - meanY, 2);
        ssXY += (x[i] - meanX) * (y[i] - meanY);
      }
      const slope = ssXY / ssXX;
      const intercept = meanY - slope * meanX;
      const r = ssXY / Math.sqrt(ssXX * ssYY);
      regHtml = `
        <div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--g200);">
          <strong>Linear Regression (y = mx + b):</strong><br>
          Line of Best Fit: <strong>y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}</strong><br>
          Pearson Correlation (r): <strong>${r.toFixed(4)}</strong> (R² = ${(r * r).toFixed(4)})
        </div>
      `;
    }

    out.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.84rem;">
        <div>Count (N): <strong>${n}</strong></div>
        <div>Mean (x̄): <strong>${meanX.toFixed(4)}</strong></div>
        <div>Median: <strong>${median.toFixed(4)}</strong></div>
        <div>Sample Std Dev (s): <strong>${stdDev.toFixed(4)}</strong></div>
        <div>Sample Variance (s²): <strong>${variance.toFixed(4)}</strong></div>
        <div>Min / Max: <strong>${sorted[0]} / ${sorted[n - 1]}</strong></div>
      </div>
      ${regHtml}
    `;
  });

  container.querySelector('#stat-dist-calc-btn')?.addEventListener('click', () => {
    const mu = parseFloat(container.querySelector('#dist-norm-mu').value) || 0;
    const sigma = parseFloat(container.querySelector('#dist-norm-sigma').value) || 1;
    const x = parseFloat(container.querySelector('#dist-norm-x').value) || 0;
    const resBox = container.querySelector('#stat-dist-result');

    const z = (x - mu) / sigma;
    const pdf = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    const cdf = z > 0 ? 1 - p : p;

    resBox.innerHTML = `
      Z-Score: <strong>${z.toFixed(4)}</strong><br>
      Probability Density PDF f(x): <strong>${pdf.toFixed(6)}</strong><br>
      Cumulative Distribution CDF P(X ≤ ${x}): <strong>${(cdf * 100).toFixed(4)}%</strong>
    `;
  });
}

/* ============================================================
   8. 2D GRAPHING ENGINE (Interactive HTML5 Canvas)
   ============================================================ */
function initGraphingEngine(container) {
  const canvas = container.querySelector('#calc-graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let xMin = -10, xMax = 10;
  let yMin = -6, yMax = 6;

  function renderGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      const cx = ((x - xMin) / (xMax - xMin)) * width;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      const cy = height - ((y - yMin) / (yMax - yMin)) * height;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }

    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    const originX = ((0 - xMin) / (xMax - xMin)) * width;
    const originY = height - ((0 - yMin) / (yMax - yMin)) * height;

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    const f1Str = container.querySelector('#graph-f1').value;
    const f2Str = container.querySelector('#graph-f2').value;
    const f3Str = container.querySelector('#graph-f3').value;

    if (f1Str) plotFunction(f1Str, '#3b82f6');
    if (f2Str) plotFunction(f2Str, '#ef4444');
    if (f3Str) plotFunction(f3Str, '#10b981');
  }

  function plotFunction(expr, color) {
    try {
      const fn = createMathFunction(expr);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let started = false;
      const step = 2;
      for (let px = 0; px <= canvas.width; px += step) {
        const x = xMin + (px / canvas.width) * (xMax - xMin);
        const y = fn(x);
        if (isNaN(y) || !isFinite(y)) {
          started = false;
          continue;
        }
        const py = canvas.height - ((y - yMin) / (yMax - yMin)) * canvas.height;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    } catch {}
  }

  container.querySelector('#graph-plot-btn')?.addEventListener('click', renderGraph);
  container.querySelector('#graph-zoom-in')?.addEventListener('click', () => {
    xMin *= 0.7; xMax *= 0.7; yMin *= 0.7; yMax *= 0.7;
    renderGraph();
  });
  container.querySelector('#graph-zoom-out')?.addEventListener('click', () => {
    xMin *= 1.4; xMax *= 1.4; yMin *= 1.4; yMax *= 1.4;
    renderGraph();
  });
  container.querySelector('#graph-reset')?.addEventListener('click', () => {
    xMin = -10; xMax = 10; yMin = -6; yMax = 6;
    renderGraph();
  });

  renderGraph();
}

/* ============================================================
   9. RPN STACK ENGINE (HP 4-Level Stack)
   ============================================================ */
function initRPNEngine(container) {
  let stack = [0, 0, 0, 0];
  let entryStr = '';

  const l1 = container.querySelector('#rpn-lvl-1');
  const l2 = container.querySelector('#rpn-lvl-2');
  const l3 = container.querySelector('#rpn-lvl-3');
  const l4 = container.querySelector('#rpn-lvl-4');

  function updateRPNUI() {
    l1.textContent = entryStr !== '' ? entryStr : String(stack[0]);
    l2.textContent = String(stack[1]);
    l3.textContent = String(stack[2]);
    l4.textContent = String(stack[3]);
  }

  function commitEntry() {
    if (entryStr !== '') {
      stack[0] = parseFloat(entryStr);
      entryStr = '';
    }
  }

  container.querySelectorAll('#pane-rpn button').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.rpnNum;
      const rpn = btn.dataset.rpn;

      if (num !== undefined) {
        entryStr += num;
        updateRPNUI();
        return;
      }

      commitEntry();

      switch (rpn) {
        case 'enter':
          stack[3] = stack[2];
          stack[2] = stack[1];
          stack[1] = stack[0];
          break;
        case 'swap':
          const tmp = stack[0];
          stack[0] = stack[1];
          stack[1] = tmp;
          break;
        case 'rolldown':
          const bot = stack[0];
          stack[0] = stack[1];
          stack[1] = stack[2];
          stack[2] = stack[3];
          stack[3] = bot;
          break;
        case 'drop':
          stack[0] = stack[1];
          stack[1] = stack[2];
          stack[2] = stack[3];
          stack[3] = 0;
          break;
        case 'clstk':
          stack = [0, 0, 0, 0];
          break;
        case 'add':
          stack[0] = stack[1] + stack[0];
          stack[1] = stack[2]; stack[2] = stack[3];
          break;
        case 'sub':
          stack[0] = stack[1] - stack[0];
          stack[1] = stack[2]; stack[2] = stack[3];
          break;
        case 'mul':
          stack[0] = stack[1] * stack[0];
          stack[1] = stack[2]; stack[2] = stack[3];
          break;
        case 'div':
          stack[0] = stack[0] !== 0 ? stack[1] / stack[0] : 0;
          stack[1] = stack[2]; stack[2] = stack[3];
          break;
        case 'sqrt':
          stack[0] = Math.sqrt(stack[0]);
          break;
        case 'sq':
          stack[0] = Math.pow(stack[0], 2);
          break;
        case 'inv':
          stack[0] = 1 / stack[0];
          break;
        case 'chs':
          stack[0] = -stack[0];
          break;
      }
      updateRPNUI();
    });
  });

  updateRPNUI();
}

/* ============================================================
   10. UNITS & CONSTANTS ENGINE
   ============================================================ */
function initConstantsEngine(container) {
  const CONSTANTS = [
    { name: 'Speed of Light in Vacuum (c)', val: 299792458, unit: 'm/s' },
    { name: 'Planck Constant (h)', val: 6.62607015e-34, unit: 'J·s' },
    { name: 'Reduced Planck Constant (ℏ)', val: 1.054571817e-34, unit: 'J·s' },
    { name: 'Gravitational Constant (G)', val: 6.67430e-11, unit: 'm³/(kg·s²)' },
    { name: 'Avogadro Constant (Nₐ)', val: 6.02214076e23, unit: 'mol⁻¹' },
    { name: 'Boltzmann Constant (k_B)', val: 1.380649e-23, unit: 'J/K' },
    { name: 'Molar Gas Constant (R)', val: 8.314462618, unit: 'J/(mol·K)' },
    { name: 'Elementary Electric Charge (e)', val: 1.602176634e-19, unit: 'C' },
    { name: 'Electron Rest Mass (m_e)', val: 9.1093837015e-31, unit: 'kg' },
    { name: 'Proton Rest Mass (m_p)', val: 1.67262192369e-27, unit: 'kg' },
    { name: 'Vacuum Permittivity (ε₀)', val: 8.8541878128e-12, unit: 'F/m' },
    { name: 'Vacuum Permeability (μ₀)', val: 1.25663706212e-6, unit: 'N/A²' },
    { name: 'Stefan-Boltzmann Constant (σ)', val: 5.670374419e-8, unit: 'W/(m²·K⁴)' },
    { name: 'Standard Acceleration of Gravity (g)', val: 9.80665, unit: 'm/s²' },
    { name: 'Golden Ratio (φ)', val: 1.618033988749895, unit: '' },
    { name: 'Euler-Mascheroni Constant (γ)', val: 0.5772156649, unit: '' },
  ];

  const listEl = container.querySelector('#calc-const-list');
  if (listEl) {
    listEl.innerHTML = CONSTANTS.map(c => `
      <div class="calc-const-item">
        <div>
          <span class="calc-const-name">${c.name}</span>
          <span class="calc-const-val">${c.val.toExponential ? (c.val < 0.001 || c.val > 1000000 ? c.val.toExponential(6) : c.val) : c.val} ${c.unit}</span>
        </div>
        <button type="button" class="btn btn-secondary calc-copy-const" data-val="${c.val}">Copy</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.calc-copy-const').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.val);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  const UNIT_MAP = {
    length: { 'Meters (m)': 1, 'Kilometers (km)': 1000, 'Centimeters (cm)': 0.01, 'Miles (mi)': 1609.344, 'Feet (ft)': 0.3048, 'Inches (in)': 0.0254 },
    mass: { 'Kilograms (kg)': 1, 'Grams (g)': 0.001, 'Pounds (lb)': 0.45359237, 'Ounces (oz)': 0.0283495, 'Metric Tonnes (t)': 1000 },
    temp: { 'Celsius (°C)': 'C', 'Fahrenheit (°F)': 'F', 'Kelvin (K)': 'K' },
    speed: { 'Meters/sec (m/s)': 1, 'Km/hour (km/h)': 0.277778, 'Miles/hour (mph)': 0.44704, 'Knots (kn)': 0.514444 },
    energy: { 'Joules (J)': 1, 'Kilojoules (kJ)': 1000, 'Calories (cal)': 4.184, 'Kilocalories (kcal)': 4184, 'Watt-hours (Wh)': 3600, 'Kilowatt-hours (kWh)': 3600000, 'Electron-volts (eV)': 1.602176634e-19 },
    pressure: { 'Pascals (Pa)': 1, 'Kilopascals (kPa)': 1000, 'Bar': 100000, 'Atmospheres (atm)': 101325, 'PSI (lbf/in²)': 6894.76, 'mmHg (Torr)': 133.322 },
    data: { 'Bytes (B)': 1, 'Kilobytes (KB)': 1024, 'Megabytes (MB)': 1048576, 'Gigabytes (GB)': 1073741824, 'Terabytes (TB)': 1099511627776 },
  };

  const catSelect = container.querySelector('#calc-unit-cat');
  const fromSelect = container.querySelector('#calc-unit-from-type');
  const toSelect = container.querySelector('#calc-unit-to-type');
  const fromInput = container.querySelector('#calc-unit-from-val');
  const toValDiv = container.querySelector('#calc-unit-to-val');

  function updateUnitOptions() {
    const cat = catSelect.value;
    const units = Object.keys(UNIT_MAP[cat] || {});
    fromSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    toSelect.innerHTML = units.map((u, i) => `<option value="${u}" ${i === 1 ? 'selected' : ''}>${u}</option>`).join('');
    recalcUnit();
  }

  function recalcUnit() {
    const cat = catSelect.value;
    const val = parseFloat(fromInput.value) || 0;
    const fromU = fromSelect.value;
    const toU = toSelect.value;

    if (cat === 'temp') {
      let celsius = val;
      if (fromU.includes('°F')) celsius = (val - 32) * 5 / 9;
      if (fromU.includes('K')) celsius = val - 273.15;

      let res = celsius;
      if (toU.includes('°F')) res = (celsius * 9 / 5) + 32;
      if (toU.includes('K')) res = celsius + 273.15;
      toValDiv.textContent = `${res.toFixed(4)} ${toU.split(' ')[1] || ''}`;
      return;
    }

    const fromFactor = UNIT_MAP[cat]?.[fromU] || 1;
    const toFactor = UNIT_MAP[cat]?.[toU] || 1;
    const base = val * fromFactor;
    const res = base / toFactor;
    toValDiv.textContent = `${res.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${toU.split(' ')[1] || ''}`;
  }

  catSelect?.addEventListener('change', updateUnitOptions);
  fromSelect?.addEventListener('change', recalcUnit);
  toSelect?.addEventListener('change', recalcUnit);
  fromInput?.addEventListener('input', recalcUnit);
  updateUnitOptions();
}

/* ============================================================
   MATH HELPER: Expression evaluator for graphing / calculus
   ============================================================ */
function createMathFunction(expr) {
  let cleaned = expr
    .replace(/\^/g, '**')
    .replace(/sin/g, 'Math.sin')
    .replace(/cos/g, 'Math.cos')
    .replace(/tan/g, 'Math.tan')
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/cbrt/g, 'Math.cbrt')
    .replace(/abs/g, 'Math.abs')
    .replace(/log/g, 'Math.log10')
    .replace(/ln/g, 'Math.log')
    .replace(/exp/g, 'Math.exp')
    .replace(/pi|PI/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');

  cleaned = cleaned.replace(/(\d)([a-zA-Z(])/g, '$1*$2');

  return new Function('x', `try { return ${cleaned}; } catch { return NaN; }`);
}
