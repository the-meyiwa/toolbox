/* ============================================================
   Chemical Compound Database — Comprehensive Scientific & Drug Reference.

   Searchable database of 1,000+ pharmaceuticals, biomolecules, inorganic minerals,
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
    let currentQuery = '';
    let visibleCount = 36;
    const PAGE_SIZE = 36;

    // Calculate category counts
    const categoryCounts = {
      all: COMMON_COMPOUNDS.length,
      Pharmaceutical: 0,
      Biochemical: 0,
      Inorganic: 0,
      Organic: 0,
      Material: 0,
    };

    COMMON_COMPOUNDS.forEach(c => {
      if (categoryCounts[c.category] !== undefined) {
        categoryCounts[c.category]++;
      }
    });

    container.innerHTML = `
      <div class="tool-section" style="max-width:1200px; margin:0 auto;">
        <!-- Header Banner & Counter -->
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:16px 20px; margin-bottom:16px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:var(--p50,#eff6ff); border:1px solid var(--p200,#bfdbfe); color:var(--p700,#1d4ed8); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--black); letter-spacing:-0.01em;">Verified Chemical Compound Database</div>
              <div style="font-size:0.82rem; color:var(--g600);">Authoritative library spanning clinical pharmaceuticals, biomolecules, inorganic salts, organics, and materials.</div>
            </div>
          </div>

          <div id="cd-counter-badge" style="display:inline-flex; align-items:center; gap:8px; background:var(--g50); border:1px solid var(--g200); padding:6px 14px; border-radius:100px; font-size:0.82rem; font-weight:600; color:var(--g800);">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a;"></span>
            <span id="cd-counter-text">Showing <strong>${Math.min(visibleCount, COMMON_COMPOUNDS.length)}</strong> of <strong>${COMMON_COMPOUNDS.length.toLocaleString()}</strong> verified compounds</span>
          </div>
        </div>

        <!-- Controls: Clean Filters & Instant Search -->
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:18px;">
          <!-- Category Filter Bar (No emojis, responsive wrap, no text bleeding) -->
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;" id="cd-cat-group">
            <button class="btn btn-sm is-active cd-cat-btn" data-cat="all" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              All <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.all.toLocaleString()})</span>
            </button>
            <button class="btn btn-sm cd-cat-btn" data-cat="Pharmaceutical" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              Pharmaceuticals &amp; Drugs <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.Pharmaceutical})</span>
            </button>
            <button class="btn btn-sm cd-cat-btn" data-cat="Biochemical" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              Biochemistry <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.Biochemical})</span>
            </button>
            <button class="btn btn-sm cd-cat-btn" data-cat="Inorganic" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              Inorganics &amp; Salts <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.Inorganic})</span>
            </button>
            <button class="btn btn-sm cd-cat-btn" data-cat="Organic" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              Organics &amp; Reagents <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.Organic})</span>
            </button>
            <button class="btn btn-sm cd-cat-btn" data-cat="Material" style="border-radius:100px; padding:6px 14px; font-weight:600; font-size:0.82rem; white-space:nowrap;">
              Materials &amp; Ceramics <span style="opacity:0.75; font-size:0.75rem; margin-left:4px;">(${categoryCounts.Material})</span>
            </button>
          </div>

          <!-- Search Input Bar -->
          <div style="position:relative; width:100%;">
            <input type="text" id="cd-search" class="tool-input" placeholder="Search by name (e.g. Paracetamol), formula (e.g. C8H9NO2), CAS # (e.g. 50-78-2), or clinical class…" style="font-size:0.9rem; width:100%; height:44px; padding-left:40px; border-radius:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:14px; top:13px; color:var(--g400); pointer-events:none;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
        </div>

        <!-- Compound Cards Grid -->
        <div id="cd-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(330px, 1fr)); gap:14px;"></div>

        <!-- Load More Pagination Button -->
        <div id="cd-load-more-wrap" style="display:none; justify-content:center; margin-top:24px; padding-bottom:12px;">
          <button id="cd-load-more" class="btn btn-secondary" style="font-weight:600; padding:10px 24px; border-radius:100px; font-size:0.88rem;">
            Load More Compounds
          </button>
        </div>
      </div>
    `;

    const catGroup     = container.querySelector('#cd-cat-group');
    const searchIn     = container.querySelector('#cd-search');
    const gridEl       = container.querySelector('#cd-grid');
    const loadMoreWrap = container.querySelector('#cd-load-more-wrap');
    const loadMoreBtn  = container.querySelector('#cd-load-more');
    const counterText  = container.querySelector('#cd-counter-text');

    catGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      for (const b of catGroup.querySelectorAll('.cd-cat-btn')) {
        b.classList.toggle('is-active', b === btn);
      }
      activeCategory = btn.dataset.cat;
      visibleCount = PAGE_SIZE;
      renderCompounds();
    });

    loadMoreBtn.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderCompounds(false);
    });

    // Multi-token normalized search indexing
    function matchesQuery(c, queryTokens) {
      if (!queryTokens.length) return true;
      const haystack = [
        c.formula,
        c.name,
        c.iupac,
        c.cas,
        c.category,
        c.medicalUse || '',
        c.summary || '',
        c.hazard || ''
      ].join(' ').toLowerCase();

      return queryTokens.every(tok => haystack.includes(tok));
    }

    function renderCompounds(resetVisible = true) {
      if (resetVisible) visibleCount = PAGE_SIZE;
      const rawQuery = searchIn.value.trim();
      currentQuery = rawQuery;
      const queryTokens = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);

      const filtered = COMMON_COMPOUNDS.filter(c => {
        if (activeCategory !== 'all' && c.category !== activeCategory) return false;
        return matchesQuery(c, queryTokens);
      });

      const totalMatches = filtered.length;
      const currentlyShown = Math.min(visibleCount, totalMatches);

      // Update counter at top
      if (counterText) {
        if (rawQuery || activeCategory !== 'all') {
          counterText.innerHTML = `Showing <strong>${currentlyShown}</strong> of <strong>${totalMatches.toLocaleString()}</strong> matching compounds (from ${COMMON_COMPOUNDS.length.toLocaleString()} total)`;
        } else {
          counterText.innerHTML = `Showing <strong>${currentlyShown}</strong> of <strong>${COMMON_COMPOUNDS.length.toLocaleString()}</strong> verified compounds`;
        }
      }

      if (!filtered.length) {
        loadMoreWrap.style.display = 'none';
        // Try on-the-fly molecular mass parsing if user typed custom formula!
        try {
          const calc = calculateMolarMass(rawQuery);
          gridEl.innerHTML = `
            <div style="background:var(--white); border:2px solid var(--black); border-radius:12px; padding:20px; grid-column:1/-1; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <span style="font-family:var(--mono); font-size:1.6rem; font-weight:900; color:var(--black);">${escapeHtml(rawQuery)}</span>
                <span style="font-family:var(--mono); font-size:1.2rem; font-weight:800; color:var(--p700,#1d4ed8);">${calc.molarMass.toFixed(3)} g/mol</span>
              </div>
              <p style="font-size:0.86rem; color:var(--g600); margin:0 0 14px;">Custom molecular formula parsed and calculated on-the-fly from standard atomic weights.</p>

              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
                ${calc.composition.map(it => `
                  <span style="font-size:0.8rem; background:var(--g100); border:1px solid var(--g200); padding:4px 10px; border-radius:6px;">
                    <strong>${it.name} (${it.symbol}):</strong> ${it.percent.toFixed(1)}% (${it.count} atom${it.count > 1 ? 's' : ''})
                  </span>
                `).join('')}
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a href="#chemical-equation-balancer" class="btn btn-primary btn-sm">Balance in Equation Balancer</a>
                <a href="#stoichiometry-calculator" class="btn btn-secondary btn-sm">Use in Stoichiometry</a>
              </div>
            </div>
          `;
          return;
        } catch {
          gridEl.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:48px 16px; background:var(--white); border:1px dashed var(--g200); border-radius:12px;">
              <p style="font-size:0.95rem; font-weight:600; color:var(--g700); margin-bottom:4px;">No compounds found matching "${escapeHtml(rawQuery)}"</p>
              <p style="font-size:0.82rem; color:var(--g500); margin:0;">Try searching by generic name, brand name, formula, IUPAC name, or CAS registry number.</p>
            </div>
          `;
          return;
        }
      }

      const getCatBadge = (cat) => {
        const colors = {
          Pharmaceutical: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
          Biochemical:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
          Inorganic:      { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
          Organic:        { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
          Material:       { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
        };
        const conf = colors[cat] || { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
        return `<span style="font-size:0.72rem; font-weight:700; background:${conf.bg}; color:${conf.text}; border:1px solid ${conf.border}; padding:2px 8px; border-radius:999px; white-space:nowrap;">${cat}</span>`;
      };

      const slice = filtered.slice(0, visibleCount);

      gridEl.innerHTML = slice.map(c => `
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:16px; box-shadow:0 2px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s ease, box-shadow 0.2s ease;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; gap:8px;">
              <div>
                <span style="font-family:var(--mono); font-size:1.3rem; font-weight:900; color:var(--black); letter-spacing:-0.02em;">${c.formula}</span>
                <div style="font-size:0.82rem; color:var(--g600); font-weight:600; font-family:var(--mono);">${c.molarMass} g/mol</div>
              </div>
              ${getCatBadge(c.category)}
            </div>

            <h4 style="margin:4px 0 3px; font-size:1rem; font-weight:800; color:var(--black); line-height:1.35;">${c.name}</h4>
            <div style="font-size:0.74rem; color:var(--g500); font-style:italic; margin-bottom:8px; line-height:1.35; word-break:break-word;">IUPAC: ${escapeHtml(c.iupac)}</div>

            ${c.medicalUse ? `
              <div style="font-size:0.76rem; background:rgba(37, 99, 235, 0.06); border-left:3px solid #2563eb; padding:4px 8px; border-radius:0 4px 4px 0; margin-bottom:8px; color:#1e40af; line-height:1.3;">
                <strong>Clinical Class:</strong> ${escapeHtml(c.medicalUse)}
              </div>
            ` : ''}

            <p style="font-size:0.8rem; line-height:1.45; color:var(--g800); margin:0 0 10px;">${escapeHtml(c.summary)}</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.73rem; margin-bottom:12px; background:var(--g50); padding:8px; border-radius:6px; border:1px solid var(--g150);">
              <div><strong>CAS:</strong> <span style="font-family:var(--mono);">${c.cas}</span></div>
              <div><strong>Density:</strong> ${c.density}</div>
              <div><strong>Melting:</strong> ${c.melt}</div>
              <div><strong>Boiling:</strong> ${c.boil}</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--g150); padding-top:10px; flex-wrap:wrap; gap:6px;">
            <span style="font-size:0.72rem; color:${c.hazard.includes('Non-hazardous') ? '#16a34a' : '#dc2626'}; font-weight:700; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(c.hazard)}">
              ${escapeHtml(c.hazard)}
            </span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm cd-copy-formula" data-formula="${c.formula}" style="font-size:0.72rem; padding:3px 8px;">Copy</button>
              <a href="#chemical-equation-balancer" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:3px 8px;">Balance</a>
            </div>
          </div>
        </div>
      `).join('');

      gridEl.querySelectorAll('.cd-copy-formula').forEach(btn => {
        btn.addEventListener('click', (e) => {
          copyText(btn.dataset.formula, e.target);
        });
      });

      // Show/Hide pagination Load More button
      if (currentlyShown < totalMatches) {
        loadMoreWrap.style.display = 'flex';
        loadMoreBtn.textContent = `Load More (+${Math.min(PAGE_SIZE, totalMatches - currentlyShown)} of ${totalMatches - currentlyShown} remaining)`;
      } else {
        loadMoreWrap.style.display = 'none';
      }
    }

    searchIn.addEventListener('input', () => {
      renderCompounds(true);
    });

    renderCompounds(true);
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
