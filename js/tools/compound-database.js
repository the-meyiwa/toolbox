/* ============================================================
   Chemical Compound Database — Comprehensive Scientific & Drug Reference.

   Searchable database of pharmaceuticals, biomolecules, inorganic minerals,
   and organic chemicals with IUPAC names, molecular formulas, CAS numbers,
   pharmacological/industrial indications, GHS hazards, and live formula parsing.
   ============================================================ */

import { COMMON_COMPOUNDS } from '../lib/chemistry-data.js';
import { calculateMolarMass } from '../lib/chemistry-engine.js';
import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    let activeCategory = 'all';

    container.innerHTML = `
      <div class="tool-section">
        <div class="biz-explain" style="margin-bottom:14px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <span>Chemical &amp; Drug Reference Database: Search medicines, biomolecules, inorganic reagents, and organic formulas with IUPAC nomenclature and safety sheets.</span>
        </div>

        <!-- Controls & Category Strip -->
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:14px;">
          <!-- Category Filter Tabs -->
          <div class="btn-group t3d-seg" id="cd-cat-group">
            <button class="btn btn-sm is-active" data-cat="all">All</button>
            <button class="btn btn-sm" data-cat="Pharmaceutical">💊 Medicines &amp; Drugs</button>
            <button class="btn btn-sm" data-cat="Biochemical">🧬 Biochemistry</button>
            <button class="btn btn-sm" data-cat="Inorganic">🧪 Inorganic</button>
            <button class="btn btn-sm" data-cat="Organic">🌿 Organic</button>
            <button class="btn btn-sm" data-cat="Material">⚡ Materials</button>
          </div>

          <!-- Search Input -->
          <div style="flex:1; min-width:260px;">
            <input type="text" id="cd-search" class="tool-input" placeholder="Search drug, formula (e.g. C8H9NO2), name, CAS # (e.g. 50-78-2)…" style="font-size:0.88rem; width:100%;">
          </div>
        </div>

        <div id="cd-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:14px;"></div>
      </div>
    `;

    const catGroup = container.querySelector('#cd-cat-group');
    const searchIn = container.querySelector('#cd-search');
    const gridEl   = container.querySelector('#cd-grid');

    catGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      for (const b of catGroup.querySelectorAll('.btn')) b.classList.toggle('is-active', b === btn);
      activeCategory = btn.dataset.cat;
      renderCompounds();
    });

    function renderCompounds() {
      const q = searchIn.value.trim().toLowerCase();

      const filtered = COMMON_COMPOUNDS.filter(c => {
        if (activeCategory !== 'all' && c.category !== activeCategory) return false;
        if (!q) return true;
        return c.formula.toLowerCase().includes(q) ||
               c.name.toLowerCase().includes(q) ||
               c.iupac.toLowerCase().includes(q) ||
               (c.medicalUse && c.medicalUse.toLowerCase().includes(q)) ||
               c.cas.toLowerCase().includes(q);
      });

      if (!filtered.length) {
        // Try on-the-fly calculation if the user entered a custom molecular formula!
        try {
          const calc = calculateMolarMass(searchIn.value.trim());
          gridEl.innerHTML = `
            <div style="background:var(--white); border:2px solid var(--black); border-radius:10px; padding:18px; grid-column:1/-1;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                <span style="font-family:var(--mono); font-size:1.6rem; font-weight:900; color:var(--black);">${searchIn.value.trim()}</span>
                <span style="font-family:var(--mono); font-size:1.15rem; font-weight:700; color:var(--g700);">${calc.molarMass.toFixed(3)} g/mol</span>
              </div>
              <p style="font-size:0.84rem; color:var(--g600); margin:0 0 12px;">Custom chemical formula parsed and calculated on-the-fly.</p>

              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
                ${calc.composition.map(it => `
                  <span style="font-size:0.8rem; background:var(--g100); border:1px solid var(--g200); padding:4px 10px; border-radius:6px;">
                    <strong>${it.name} (${it.symbol}):</strong> ${it.percent.toFixed(1)}% (${it.count} atom${it.count > 1 ? 's' : ''})
                  </span>
                `).join('')}
              </div>

              <div style="display:flex; gap:8px;">
                <a href="#chemical-equation-balancer" class="btn btn-primary btn-sm">Use in Equation Balancer</a>
                <a href="#stoichiometry-calculator" class="btn btn-secondary btn-sm">Open in Stoichiometry</a>
              </div>
            </div>
          `;
          return;
        } catch {
          gridEl.innerHTML = `<p style="grid-column:1/-1; color:var(--g500); font-size:0.84rem; text-align:center; padding:32px 0;">No matching compounds found for "${escapeHtml(searchIn.value)}".</p>`;
          return;
        }
      }

      const getCatBadge = (cat) => {
        const colors = {
          Pharmaceutical: { bg: '#eff6ff', text: '#1d4ed8' },
          Biochemical: { bg: '#f0fdf4', text: '#15803d' },
          Inorganic: { bg: '#fef3c7', text: '#b45309' },
          Organic: { bg: '#f5f3ff', text: '#6d28d9' },
          Material: { bg: '#ecfeff', text: '#0e7490' },
        };
        const conf = colors[cat] || { bg: '#f1f5f9', text: '#334155' };
        return `<span style="font-size:0.7rem; font-weight:700; background:${conf.bg}; color:${conf.text}; padding:2px 8px; border-radius:999px;">${cat}</span>`;
      };

      gridEl.innerHTML = filtered.map(c => `
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
              <div>
                <span style="font-family:var(--mono); font-size:1.35rem; font-weight:900; color:var(--black);">${c.formula}</span>
                <div style="font-size:0.82rem; color:var(--g600); font-weight:600; font-family:var(--mono);">${c.molarMass} g/mol</div>
              </div>
              ${getCatBadge(c.category)}
            </div>

            <h4 style="margin:4px 0 2px; font-size:1.05rem; font-weight:800; color:var(--black);">${c.name}</h4>
            <div style="font-size:0.74rem; color:var(--g500); font-style:italic; margin-bottom:8px; line-height:1.3;">IUPAC: ${escapeHtml(c.iupac)}</div>

            ${c.medicalUse ? `
              <div style="font-size:0.78rem; background:rgba(37, 99, 235, 0.06); border-left:3px solid #2563eb; padding:4px 8px; border-radius:0 4px 4px 0; margin-bottom:8px; color:#1e40af;">
                <strong>Clinical / Therapeutic Class:</strong> ${escapeHtml(c.medicalUse)}
              </div>
            ` : ''}

            <p style="font-size:0.8rem; line-height:1.45; color:var(--g800); margin:0 0 10px;">${escapeHtml(c.summary)}</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.74rem; margin-bottom:12px; background:var(--g50); padding:8px; border-radius:6px;">
              <div><strong>CAS:</strong> <span style="font-family:var(--mono);">${c.cas}</span></div>
              <div><strong>Density:</strong> ${c.density}</div>
              <div><strong>Melting:</strong> ${c.melt}</div>
              <div><strong>Boiling:</strong> ${c.boil}</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--g150); padding-top:8px; flex-wrap:wrap; gap:6px;">
            <span style="font-size:0.72rem; color:${c.hazard.includes('Non-hazardous') ? '#16a34a' : '#dc2626'}; font-weight:700; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(c.hazard)}">
              ${escapeHtml(c.hazard)}
            </span>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-secondary btn-sm cd-copy-formula" data-formula="${c.formula}" style="font-size:0.72rem; padding:2px 8px;">Copy</button>
              <a href="#chemical-equation-balancer" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:2px 8px;">Balance</a>
            </div>
          </div>
        </div>
      `).join('');

      gridEl.querySelectorAll('.cd-copy-formula').forEach(btn => {
        btn.addEventListener('click', (e) => {
          copyText(btn.dataset.formula, e.target);
        });
      });
    }

    searchIn.addEventListener('input', renderCompounds);
    renderCompounds();
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
