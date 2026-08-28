/* ============================================================
   Chemical Compound Database — IUPAC & Physical Reference.

   Searchable database of essential chemical compounds with IUPAC
   names, molecular weights, CAS numbers, physical densities,
   melting/boiling points, solubilities, and GHS hazard data.
   ============================================================ */

import { COMMON_COMPOUNDS } from '../lib/chemistry-data.js';
import { calculateMolarMass } from '../lib/chemistry-engine.js';
import { escapeHtml } from '../lib/biz.js';

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="tool-section">
        <div class="biz-explain" style="margin-bottom:14px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <span>Chemical Compound Database: Search IUPAC names, CAS numbers, molecular formulas, and safety properties.</span>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:14px;">
          <input type="text" id="cd-search" class="tool-input" placeholder="Search formula (e.g. H2SO4), name, CAS # (e.g. 7664-93-9)…" style="font-size:0.9rem;">
        </div>

        <div id="cd-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px;"></div>
      </div>
    `;

    const searchIn = container.querySelector('#cd-search');
    const gridEl   = container.querySelector('#cd-grid');

    function renderCompounds() {
      const q = searchIn.value.trim().toLowerCase();

      const filtered = COMMON_COMPOUNDS.filter(c => {
        if (!q) return true;
        return c.formula.toLowerCase().includes(q) ||
               c.name.toLowerCase().includes(q) ||
               c.iupac.toLowerCase().includes(q) ||
               c.cas.toLowerCase().includes(q);
      });

      if (!filtered.length) {
        // Try on-the-fly calculation if the user entered a custom molecular formula!
        try {
          const calc = calculateMolarMass(searchIn.value.trim());
          gridEl.innerHTML = `
            <div style="background:var(--white); border:2px solid var(--black); border-radius:10px; padding:16px; grid-column:1/-1;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                <span style="font-family:var(--mono); font-size:1.4rem; font-weight:900; color:var(--black);">${searchIn.value.trim()}</span>
                <span style="font-family:var(--mono); font-size:1.05rem; font-weight:700; color:var(--g700);">${calc.molarMass.toFixed(3)} g/mol</span>
              </div>
              <p style="font-size:0.82rem; color:var(--g600); margin:0 0 10px;">Calculated on-the-fly from elemental mass stoichiometry.</p>

              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${calc.composition.map(it => `
                  <span style="font-size:0.75rem; background:var(--g100); padding:3px 8px; border-radius:4px;">
                    <strong>${it.symbol}:</strong> ${it.percent.toFixed(1)}% (${it.count} atom${it.count > 1 ? 's' : ''})
                  </span>
                `).join('')}
              </div>
            </div>
          `;
          return;
        } catch {
          gridEl.innerHTML = `<p style="grid-column:1/-1; color:var(--g500); font-size:0.84rem;">No matching compounds found.</p>`;
          return;
        }
      }

      gridEl.innerHTML = filtered.map(c => `
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
              <span style="font-family:var(--mono); font-size:1.3rem; font-weight:900; color:var(--black);">${c.formula}</span>
              <span style="font-family:var(--mono); font-size:0.82rem; color:var(--g600); font-weight:600;">${c.molarMass} g/mol</span>
            </div>

            <h4 style="margin:0 0 2px; font-size:1rem; font-weight:800; color:var(--black);">${c.name}</h4>
            <div style="font-size:0.75rem; color:var(--g500); font-style:italic; margin-bottom:10px;">IUPAC: ${escapeHtml(c.iupac)}</div>

            <p style="font-size:0.8rem; line-height:1.45; color:var(--g800); margin:0 0 12px;">${escapeHtml(c.summary)}</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.75rem; margin-bottom:12px; background:var(--g50); padding:8px; border-radius:6px;">
              <div><strong>CAS:</strong> <span style="font-family:var(--mono);">${c.cas}</span></div>
              <div><strong>Density:</strong> ${c.density}</div>
              <div><strong>Melting:</strong> ${c.melt}</div>
              <div><strong>Boiling:</strong> ${c.boil}</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--g150); padding-top:8px;">
            <span style="font-size:0.72rem; color:${c.hazard.includes('Non-hazardous') ? '#16a34a' : '#dc2626'}; font-weight:700;">
              ${escapeHtml(c.hazard)}
            </span>
            <a href="#chemical-equation-balancer" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:2px 8px;">Use in Equation</a>
          </div>
        </div>
      `).join('');
    }

    searchIn.addEventListener('input', renderCompounds);
    renderCompounds();
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
