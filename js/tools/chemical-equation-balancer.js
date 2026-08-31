/* ============================================================
   Chemical Equation Balancer — Mathematical Null-Space Solver.

   Solves elemental conservation via exact Gaussian elimination
   over rational numbers. Handles polyatomic groups, hydrates,
   subscripts, and step-by-step matrix balance derivation.
   ============================================================ */

import { balanceChemicalEquation, calculateMolarMass } from '../lib/chemistry-engine.js';
import { copyText } from '../utils.js';

const SAMPLE_REACTIONS = [
  { label: 'Propane Combustion', eq: 'C3H8 + O2 -> CO2 + H2O' },
  { label: 'Calcium Phosphate Precipitation', eq: 'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O' },
  { label: 'Redox: Permanganate & Hydrochloric Acid', eq: 'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2' },
  { label: 'Haber-Bosch Ammonia Synthesis', eq: 'N2 + H2 -> NH3' },
  { label: 'Thermite Reaction', eq: 'Al + Fe2O3 -> Al2O3 + Fe' },
  { label: 'Photosynthesis Overall', eq: 'CO2 + H2O -> C6H12O6 + O2' },
];

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="tool-section">
        <div class="biz-explain" style="margin-bottom:14px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          <span>Exact Mathematical Conservation Solver: Balances chemical reactions using integer null-space matrix Gaussian elimination.</span>
        </div>

        <!-- Preset Reaction Buttons -->
        <div style="margin-bottom:14px;">
          <label class="tool-label" style="margin-bottom:6px;">Sample Reactions</label>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${SAMPLE_REACTIONS.map((s, i) => `
              <button class="btn btn-secondary btn-sm" data-sample-idx="${i}" style="font-size:0.78rem;">
                ${s.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Input Formula -->
        <div style="margin-bottom:14px;">
          <label class="tool-label" for="eq-in">Unbalanced Chemical Equation</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="eq-in" class="tool-input" value="C3H8 + O2 -> CO2 + H2O" placeholder="e.g. Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O" style="font-family:var(--mono); font-size:1.05rem; font-weight:700;">
            <button class="btn btn-primary" id="eq-balance-btn">Balance</button>
          </div>
        </div>

        <!-- Results Display Stage -->
        <div id="eq-result-stage" style="display:none; margin-top:16px;">
          <!-- Balanced Equation Banner -->
          <div style="background:var(--g50); border:2px solid var(--black); border-radius:10px; padding:18px; text-align:center; margin-bottom:16px;">
            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--g600); letter-spacing:0.04em;">Balanced Stoichiometric Equation</span>
            <div id="eq-balanced-str" style="font-family:var(--mono); font-size:1.4rem; font-weight:900; color:var(--black); margin:8px 0;"></div>
            <div style="display:flex; justify-content:center; gap:8px; margin-top:10px;">
              <button class="btn btn-secondary btn-sm" id="eq-copy-btn">Copy Equation</button>
              <button class="btn btn-secondary btn-sm" id="eq-stoich-btn">Open in Stoichiometry Calculator </button>
            </div>
          </div>

          <!-- Molar Mass Table of Species -->
          <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:14px; margin-bottom:16px;">
            <h4 style="margin:0 0 10px; font-size:0.95rem; font-weight:800; color:var(--black);">Stoichiometric Mass &amp; Species Summary</h4>
            <div id="eq-species-table" style="overflow-x:auto;"></div>
          </div>
        </div>

        <div id="eq-error-box" style="display:none; margin-top:14px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; color:#991b1b; font-size:0.85rem;"></div>
      </div>
    `;

    const inputEl      = container.querySelector('#eq-in');
    const balanceBtn   = container.querySelector('#eq-balance-btn');
    const resultStage  = container.querySelector('#eq-result-stage');
    const balancedStrEl= container.querySelector('#eq-balanced-str');
    const copyBtn      = container.querySelector('#eq-copy-btn');
    const stoichBtn    = container.querySelector('#eq-stoich-btn');
    const speciesTable = container.querySelector('#eq-species-table');
    const errorBox     = container.querySelector('#eq-error-box');

    let currentResult = null;

    function runBalance() {
      const raw = inputEl.value.trim();
      if (!raw) return;

      errorBox.style.display = 'none';
      try {
        const res = balanceChemicalEquation(raw);
        currentResult = res;

        balancedStrEl.textContent = res.balancedString;
        resultStage.style.display = 'block';

        // Render species table
        const allSpecies = [
          ...res.reactants.map(r => ({ ...r, role: 'Reactant' })),
          ...res.products.map(p => ({ ...p, role: 'Product' })),
        ];

        speciesTable.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--g200); text-align:left; color:var(--g600);">
                <th style="padding:6px 8px;">Role</th>
                <th style="padding:6px 8px;">Coefficient</th>
                <th style="padding:6px 8px;">Formula</th>
                <th style="padding:6px 8px; text-align:right;">Molar Mass (g/mol)</th>
              </tr>
            </thead>
            <tbody>
              ${allSpecies.map(s => {
                const mm = calculateMolarMass(s.formula).molarMass;
                return `
                  <tr style="border-bottom:1px solid var(--g100);">
                    <td style="padding:6px 8px; font-weight:600; color:${s.role === 'Reactant' ? '#2563eb' : '#16a34a'};">${s.role}</td>
                    <td style="padding:6px 8px; font-family:var(--mono); font-weight:700;">${s.coeff}</td>
                    <td style="padding:6px 8px; font-family:var(--mono); font-weight:700;">${s.formula}</td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--mono);">${mm.toFixed(3)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;

        analytics?.completed({ equation: raw });
      } catch (err) {
        resultStage.style.display = 'none';
        errorBox.style.display = 'block';
        errorBox.textContent = `Balancing Error: ${err.message}`;
      }
    }

    balanceBtn.addEventListener('click', runBalance);
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') runBalance(); });

    container.querySelectorAll('[data-sample-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.sampleIdx, 10);
        inputEl.value = SAMPLE_REACTIONS[idx].eq;
        runBalance();
      });
    });

    copyBtn.addEventListener('click', (e) => {
      if (currentResult) {
        copyText(currentResult.balancedString, e.target);
      }
    });

    stoichBtn.addEventListener('click', () => {
      if (currentResult) {
        window.location.hash = `#stoichiometry-calculator?eq=${encodeURIComponent(inputEl.value.trim())}`;
      }
    });

    runBalance();
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
