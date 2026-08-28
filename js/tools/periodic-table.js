/* ============================================================
   Periodic Table of the Elements — Interactive Scientific Explorer.

   High-density responsive periodic table with real IUPAC data,
   property heatmaps (electronegativity, density, melt/boil points),
   category filters, electron shell visualizer, and element comparisons.
   ============================================================ */

import { ELEMENTS, ELEMENT_CATEGORIES } from '../lib/chemistry-data.js';

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    let selectedElement = ELEMENTS[0]; // Hydrogen default
    let activeCategory = 'all';
    let activeHeatmap = 'none'; // 'none' | 'electronegativity' | 'density' | 'melt' | 'boil' | 'atomicRadius'

    container.innerHTML = `
      <div class="pt-wrap" style="display:flex; flex-direction:column; gap:14px;">
        <!-- Top Toolbar & Controls Strip -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <!-- Category Filter Pills -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-size:0.82rem; font-weight:700;">Filter:</span>
            <select id="pt-cat-filter" class="tool-select" style="font-size:0.78rem; padding:4px 8px;">
              ${ELEMENT_CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </div>

          <!-- Heatmap Property Selector -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-size:0.82rem; font-weight:700;">Property Heatmap:</span>
            <select id="pt-heatmap-select" class="tool-select" style="font-size:0.78rem; padding:4px 8px;">
              <option value="none">Standard Categories</option>
              <option value="electronegativity">Electronegativity (Pauling)</option>
              <option value="density">Density (g/cm³)</option>
              <option value="melt">Melting Point (K)</option>
              <option value="boil">Boiling Point (K)</option>
              <option value="atomicRadius">Atomic Radius (pm)</option>
            </select>
          </div>

          <!-- Search Input -->
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" id="pt-search" class="tool-input" placeholder="Search element, symbol, Z…" style="font-size:0.82rem; width:180px; padding:4px 10px;">
          </div>
        </div>

        <!-- Periodic Table Grid Container -->
        <div class="pt-grid-container" style="overflow-x:auto; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:14px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
          <div id="pt-table-grid" style="display:grid; grid-template-columns:repeat(18, minmax(42px, 1fr)); gap:4px; min-width:840px;"></div>
        </div>

        <!-- Element Detail Inspector Card -->
        <div id="pt-detail-card" class="tool-section" style="background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:18px;"></div>
      </div>
    `;

    const catFilter    = container.querySelector('#pt-cat-filter');
    const heatmapSelect= container.querySelector('#pt-heatmap-select');
    const searchIn     = container.querySelector('#pt-search');
    const gridEl       = container.querySelector('#pt-table-grid');
    const detailEl     = container.querySelector('#pt-detail-card');

    function getCategoryColor(catId) {
      const c = ELEMENT_CATEGORIES.find(it => it.id === catId);
      return c ? c.color : '#94a3b8';
    }

    function getHeatmapColor(el, prop) {
      const val = el[prop];
      if (val == null) return '#e2e8f0';

      const ranges = {
        electronegativity: [0.7, 4.0],
        density: [0.1, 22.6],
        melt: [14, 3800],
        boil: [20, 5800],
        atomicRadius: [30, 260],
      };

      const [min, max] = ranges[prop] || [0, 100];
      const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
      // High values: warm vibrant red/orange, Low values: cool blue/cyan
      const hue = (1 - norm) * 240; // 240 (blue) -> 0 (red)
      return `hsl(${hue}, 85%, 62%)`;
    }

    function renderGrid() {
      const query = searchIn.value.trim().toLowerCase();

      // Build 18 columns x 7 rows standard matrix + lanthanide/actinide rows
      const cells = [];

      for (let period = 1; period <= 7; period++) {
        for (let group = 1; group <= 18; group++) {
          const el = ELEMENTS.find(e => e.period === period && e.group === group);
          if (el) {
            cells.push({ el, period, group });
          } else {
            // Check if placeholder for Lanthanides (Period 6, Group 3) or Actinides (Period 7, Group 3)
            if (period === 6 && group === 3) {
              cells.push({ placeholder: '57-71', label: 'La-Lu', category: 'lanthanide', period, group });
            } else if (period === 7 && group === 3) {
              cells.push({ placeholder: '89-103', label: 'Ac-Lr', category: 'actinide', period, group });
            } else {
              cells.push({ empty: true, period, group });
            }
          }
        }
      }

      gridEl.innerHTML = cells.map(cell => {
        if (cell.empty) {
          return `<div style="aspect-ratio:1/1;"></div>`;
        }

        if (cell.placeholder) {
          return `
            <div style="aspect-ratio:1/1; border:1px dashed var(--g300); border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--g50); font-size:0.7rem; color:var(--g600); user-select:none;">
              <span style="font-weight:700;">${cell.label}</span>
              <span style="font-size:0.6rem;">${cell.placeholder}</span>
            </div>
          `;
        }

        const el = cell.el;
        const matchesCategory = activeCategory === 'all' || el.category === activeCategory;
        const matchesSearch = !query || el.name.toLowerCase().includes(query) || el.symbol.toLowerCase() === query || String(el.number) === query;
        const isDimmed = !matchesCategory || !matchesSearch;
        const isSelected = selectedElement && selectedElement.number === el.number;

        let bg = getCategoryColor(el.category);
        if (activeHeatmap !== 'none') {
          bg = getHeatmapColor(el, activeHeatmap);
        }

        return `
          <button class="pt-cell${isSelected ? ' is-selected' : ''}" data-z="${el.number}" style="
            aspect-ratio:1/1.08;
            border:2px solid ${isSelected ? 'var(--black)' : 'transparent'};
            border-radius:6px;
            background:${bg};
            color:${activeHeatmap !== 'none' ? '#0f172a' : '#ffffff'};
            display:flex;
            flex-direction:column;
            justify-content:space-between;
            padding:3px;
            cursor:pointer;
            transition:transform 0.1s, opacity 0.15s, box-shadow 0.15s;
            opacity:${isDimmed ? 0.25 : 1.0};
            box-shadow:${isSelected ? '0 0 0 2px var(--black), 0 4px 12px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.08)'};
            user-select:none;
            position:relative;
            text-align:left;
          " title="${el.name} (Z=${el.number})">
            <span style="font-size:0.62rem; font-family:var(--mono); font-weight:700; opacity:0.9;">${el.number}</span>
            <span style="font-size:0.95rem; font-weight:800; text-align:center; line-height:1;">${el.symbol}</span>
            <span style="font-size:0.56rem; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0.95;">${el.weight.toFixed(1)}</span>
          </button>
        `;
      }).join('');

      gridEl.querySelectorAll('[data-z]').forEach(btn => {
        btn.addEventListener('click', () => {
          const z = parseInt(btn.dataset.z, 10);
          const found = ELEMENTS.find(e => e.number === z);
          if (found) {
            selectedElement = found;
            renderGrid();
            renderDetail(found);
            analytics?.completed({ element: found.symbol });
          }
        });
      });
    }

    function renderDetail(el) {
      if (!el) return;

      const catObj = ELEMENT_CATEGORIES.find(c => c.id === el.category);
      const catLabel = catObj ? catObj.label : el.category;
      const catColor = catObj ? catObj.color : '#3b82f6';

      detailEl.innerHTML = `
        <div style="display:grid; grid-template-columns:minmax(240px, 320px) 1fr; gap:20px; align-items:start;" class="pt-detail-grid">
          <!-- Large Element Tile -->
          <div style="background:var(--g50); border:1px solid var(--g200); border-radius:10px; padding:16px; text-align:center; border-top:5px solid ${catColor};">
            <div style="display:flex; justify-content:space-between; align-items:baseline; font-family:var(--mono); color:var(--g600); font-size:0.85rem;">
              <span>Z = ${el.number}</span>
              <span>Period ${el.period}, Grp ${el.group}</span>
            </div>

            <div style="font-size:3.5rem; font-weight:900; line-height:1.1; margin:8px 0 2px; color:var(--black); font-family:var(--mono);">${el.symbol}</div>
            <h3 style="font-size:1.3rem; font-weight:800; margin:0; color:var(--black);">${el.name}</h3>
            <div style="font-size:0.88rem; font-family:var(--mono); font-weight:600; color:var(--g700); margin:4px 0 8px;">${el.weight.toFixed(4)} u</div>

            <div style="display:inline-block; font-size:0.75rem; font-weight:700; background:${catColor}; color:#fff; padding:2px 8px; border-radius:999px; margin-bottom:10px;">
              ${catLabel}
            </div>

            <div style="background:var(--white); border:1px solid var(--g200); border-radius:6px; padding:8px; font-family:var(--mono); font-size:0.78rem; text-align:left;">
              <div style="color:var(--g600); font-size:0.7rem; margin-bottom:2px;">Electron Configuration:</div>
              <div style="font-weight:700; color:var(--black);">${el.electronConfig}</div>
            </div>
          </div>

          <!-- Scientific Properties Matrix -->
          <div>
            <div style="margin-bottom:14px;">
              <h4 style="margin:0 0 4px; font-size:1.05rem; font-weight:800; color:var(--black);">Scientific Description &amp; Summary</h4>
              <p style="margin:0; font-size:0.85rem; line-height:1.5; color:var(--g800);">${el.summary}</p>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; font-size:0.82rem;">
              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Phase at 298.15 K</div>
                <div style="font-weight:700; text-transform:capitalize; margin-top:2px;">${el.phase}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Electronegativity</div>
                <div style="font-weight:700; margin-top:2px;">${el.electronegativity != null ? `${el.electronegativity} (Pauling)` : '—'}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Density</div>
                <div style="font-weight:700; margin-top:2px;">${el.density != null ? `${el.density} g/cm³` : '—'}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Melting Point</div>
                <div style="font-weight:700; margin-top:2px;">${el.melt != null ? `${el.melt} K (${(el.melt - 273.15).toFixed(1)} °C)` : '—'}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Boiling Point</div>
                <div style="font-weight:700; margin-top:2px;">${el.boil != null ? `${el.boil} K (${(el.boil - 273.15).toFixed(1)} °C)` : '—'}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Oxidation States</div>
                <div style="font-weight:700; margin-top:2px;">${el.oxidationStates.map(o => (o > 0 ? `+${o}` : o)).join(', ')}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">1st Ionization Energy</div>
                <div style="font-weight:700; margin-top:2px;">${el.ionizationEnergy != null ? `${el.ionizationEnergy} kJ/mol` : '—'}</div>
              </div>

              <div style="background:var(--g50); padding:8px 10px; border-radius:6px; border:1px solid var(--g150);">
                <div style="color:var(--g600); font-size:0.72rem; font-weight:700; text-transform:uppercase;">Discovery</div>
                <div style="font-weight:700; margin-top:2px;">${el.discoverer || 'Ancient'} (${el.year || 'Antiquity'})</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    catFilter.addEventListener('change', (e) => {
      activeCategory = e.target.value;
      renderGrid();
    });

    heatmapSelect.addEventListener('change', (e) => {
      activeHeatmap = e.target.value;
      renderGrid();
    });

    searchIn.addEventListener('input', () => {
      renderGrid();
    });

    renderGrid();
    renderDetail(selectedElement);
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
