/* ============================================================
   Stoichiometry & Reaction Calculator.

   Solves reaction yields, identifies limiting reagents, calculates
   excess amounts, mass-mole-volume conversions, and solution molarity.
   ============================================================ */

import {
  balanceChemicalEquation, calculateMolarMass, calculateStoichiometry,
} from '../lib/chemistry-engine.js';

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="tool-section">
        <div class="biz-explain" style="margin-bottom:14px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Stoichiometric Yield &amp; Limiting Reagent Calculator: Enter a chemical reaction and given quantities to compute theoretical yield, limiting reactant, and excess remaining.</span>
        </div>

        <!-- Equation Input -->
        <div style="margin-bottom:14px;">
          <label class="tool-label" for="st-eq">Chemical Reaction Equation</label>
          <input type="text" id="st-eq" class="tool-input" value="C3H8 + 5 O2 -> 3 CO2 + 4 H2O" placeholder="e.g. 2 H2 + O2 -> 2 H2O" style="font-family:var(--mono); font-size:1.05rem; font-weight:700;">
        </div>

        <!-- Reactant Inputs Stage -->
        <div style="background:var(--g50); border:1px solid var(--g200); border-radius:10px; padding:16px; margin-bottom:16px;">
          <h4 style="margin:0 0 10px; font-size:0.95rem; font-weight:800; color:var(--black);">Given Reactant Quantities</h4>
          <div id="st-reactant-inputs" style="display:flex; flex-direction:column; gap:10px;"></div>
          <button class="btn btn-primary btn-sm" id="st-calc-btn" style="margin-top:12px;">Calculate Theoretical Yield &amp; Limiting Reactant</button>
        </div>

        <!-- Results Display Stage -->
        <div id="st-results-stage" style="display:none;">
          <!-- Limiting Reactant Banner -->
          <div style="background:#f0fdf4; border:2px solid #22c55e; border-radius:10px; padding:14px; margin-bottom:16px; text-align:center;">
            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#15803d;">Limiting Reagent</span>
            <div id="st-limiting-badge" style="font-size:1.35rem; font-weight:900; color:#14532d; margin-top:2px;"></div>
          </div>

          <!-- Product Yields Table -->
          <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:14px; margin-bottom:16px;">
            <h4 style="margin:0 0 10px; font-size:0.95rem; font-weight:800; color:var(--black);">Theoretical Product Yields</h4>
            <div id="st-products-table" style="overflow-x:auto;"></div>
          </div>

          <!-- Excess Reactants Table -->
          <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:14px;">
            <h4 style="margin:0 0 10px; font-size:0.95rem; font-weight:800; color:var(--black);">Reactant Consumption &amp; Excess Remaining</h4>
            <div id="st-excess-table" style="overflow-x:auto;"></div>
          </div>
        </div>

        <!-- Error Box -->
        <div id="st-error-box" style="display:none; margin-top:14px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; color:#991b1b; font-size:0.85rem;"></div>
      </div>
    `;

    const eqInput      = container.querySelector('#st-eq');
    const inputsWrap   = container.querySelector('#st-reactant-inputs');
    const calcBtn      = container.querySelector('#st-calc-btn');
    const resultsStage = container.querySelector('#st-results-stage');
    const limitingBadge= container.querySelector('#st-limiting-badge');
    const productsTable= container.querySelector('#st-products-table');
    const excessTable  = container.querySelector('#st-excess-table');
    const errorBox     = container.querySelector('#st-error-box');

    let balancedData = null;

    function parseAndSetupInputs() {
      const raw = eqInput.value.trim();
      if (!raw) return;

      errorBox.style.display = 'none';
      try {
        balancedData = balanceChemicalEquation(raw);

        inputsWrap.innerHTML = balancedData.reactants.map((r, i) => `
          <div style="display:grid; grid-template-columns:120px 1fr 100px; gap:8px; align-items:center;">
            <span style="font-family:var(--mono); font-weight:700; font-size:0.95rem;">${r.coeff > 1 ? r.coeff + ' ' : ''}${r.formula}</span>
            <input type="number" class="tool-input st-amt-input" data-formula="${r.formula}" value="${i === 0 ? '44.1' : '160.0'}" min="0" step="any" placeholder="Amount">
            <select class="tool-select st-unit-select" data-formula="${r.formula}">
              <option value="g">grams (g)</option>
              <option value="mol">moles (mol)</option>
              <option value="L">liters (L @ STP)</option>
            </select>
          </div>
        `).join('');

        runCalculation();
      } catch (err) {
        resultsStage.style.display = 'none';
        errorBox.style.display = 'block';
        errorBox.textContent = `Reaction Error: ${err.message}`;
      }
    }

    function runCalculation() {
      if (!balancedData) return;

      const given = {};
      inputsWrap.querySelectorAll('.st-amt-input').forEach(inp => {
        const formula = inp.dataset.formula;
        const amt = parseFloat(inp.value) || 0;
        const unit = inputsWrap.querySelector(`.st-unit-select[data-formula="${formula}"]`).value;
        given[formula] = { amount: amt, unit };
      });

      try {
        const stoich = calculateStoichiometry(balancedData, given);

        limitingBadge.textContent = `${stoich.limitingReactant} (Completely Consumed)`;

        productsTable.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--g200); text-align:left; color:var(--g600);">
                <th style="padding:6px 8px;">Product</th>
                <th style="padding:6px 8px; text-align:right;">Moles (mol)</th>
                <th style="padding:6px 8px; text-align:right;">Mass (g)</th>
                <th style="padding:6px 8px; text-align:right;">Volume (L @ STP)</th>
                <th style="padding:6px 8px; text-align:right;">Molecules</th>
              </tr>
            </thead>
            <tbody>
              ${stoich.productYields.map(p => `
                <tr style="border-bottom:1px solid var(--g100);">
                  <td style="padding:6px 8px; font-family:var(--mono); font-weight:700; color:#16a34a;">${p.formula}</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono); font-weight:700;">${p.moles.toFixed(4)}</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono); font-weight:700;">${p.grams.toFixed(2)} g</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono);">${p.litersSTP.toFixed(2)} L</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono);">${p.molecules.toExponential(3)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        excessTable.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--g200); text-align:left; color:var(--g600);">
                <th style="padding:6px 8px;">Reactant</th>
                <th style="padding:6px 8px; text-align:right;">Moles Used</th>
                <th style="padding:6px 8px; text-align:right;">Moles Remaining</th>
                <th style="padding:6px 8px; text-align:right;">Mass Remaining (g)</th>
                <th style="padding:6px 8px; text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${stoich.excessAnalysis.map(e => `
                <tr style="border-bottom:1px solid var(--g100);">
                  <td style="padding:6px 8px; font-family:var(--mono); font-weight:700;">${e.formula}</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono);">${e.molesUsed.toFixed(4)}</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono);">${e.molesRemaining.toFixed(4)}</td>
                  <td style="padding:6px 8px; text-align:right; font-family:var(--mono); font-weight:700;">${e.gramsRemaining.toFixed(2)} g</td>
                  <td style="padding:6px 8px; text-align:center;">
                    <span style="font-size:0.72rem; font-weight:700; padding:1px 6px; border-radius:999px; background:${e.isLimiting ? '#fee2e2' : '#fef3c7'}; color:${e.isLimiting ? '#991b1b' : '#92400e'};">
                      ${e.isLimiting ? 'Limiting Reagent' : 'In Excess'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        resultsStage.style.display = 'block';
        analytics?.completed({ limiting: stoich.limitingReactant });
      } catch (err) {
        resultsStage.style.display = 'none';
        errorBox.style.display = 'block';
        errorBox.textContent = `Calculation Error: ${err.message}`;
      }
    }

    eqInput.addEventListener('change', parseAndSetupInputs);
    calcBtn.addEventListener('click', runCalculation);

    // Deep link support from equation balancer (#stoichiometry-calculator?eq=...)
    const hash = window.location.hash || '';
    if (hash.includes('eq=')) {
      const match = hash.match(/eq=([^&]+)/);
      if (match && match[1]) {
        eqInput.value = decodeURIComponent(match[1]);
      }
    }

    parseAndSetupInputs();
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
