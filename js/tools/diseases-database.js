/* ============================================================
   TOOLBOX — Diseases Database & Clinical Pathology Explorer
   Interactive tool for searching 80,000+ WHO ICD-11 diseases,
   clinical pathophysiology, diagnostic criteria, and management
   stratified by epidemiological commodity.
   ============================================================ */

import { searchDiseases, ICD11_CHAPTERS } from '../lib/diseases-data.js';
import { saveArtifactFile } from '../lib/artifacts.js';

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  render(container) {
    let activeSystem = 'all';
    let searchQuery = '';

    container.innerHTML = `
    <div class="tool-content dis-database-wrapper" style="max-width:960px; margin:0 auto; padding:20px;">
      <!-- Header -->
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.6rem; font-weight:800; color:var(--text, var(--text)); margin:0 0 6px 0;">Diseases & Pathology Database</h2>
        <p style="font-size:0.9rem; color:var(--g600, var(--text-2)); margin:0;">
          Explore 80,000+ conditions across WHO ICD-11, Orphanet, and clinical medicine indexed by global epidemiological commodity.
        </p>
      </div>

      <!-- Search & Filters -->
      <div style="background:var(--white, var(--surface)); border:1px solid var(--g200, var(--line)); border-radius:16px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.04); margin-bottom:20px;">
        <div style="position:relative; margin-bottom:14px;">
          <input
            type="search"
            id="dis-search-input"
            class="tool-input"
            placeholder="Search by disease name, symptom (e.g. 'chest pain', 'hay fever', 'cephalitis'), or ICD-11 code..."
            style="width:100%; height:46px; border-radius:9999px; padding:0 20px; font-size:0.92rem; border:1.5px solid var(--g300, #cbd5e1); outline:none; box-sizing:border-box;"
          />
        </div>

        <!-- Filter Pills with Scroll Edge Fades -->
        <div class="dis-filter-wrapper" style="position:relative; width:100%; overflow:hidden;">
          <div class="dis-fade dis-fade-left" id="dis-fade-left" style="opacity:0;"></div>
          <div id="dis-filter-pills" class="dis-filter-pills" style="display:flex; gap:8px; overflow-x:auto; padding:4px 0; scrollbar-width:none; -webkit-overflow-scrolling:touch;">
            <button type="button" class="btn btn-sm dis-pill active" data-system="all" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; background:var(--black); color:var(--white); cursor:pointer;">All Conditions</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="cardiovascular" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Cardiovascular</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="respiratory" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Respiratory</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="neurological" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Neurological</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="gastrointestinal" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Gastrointestinal</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="endocrine" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Endocrine</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="musculoskeletal" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Musculoskeletal</button>
            <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="infectious" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Infectious</button>
          </div>
          <div class="dis-fade dis-fade-right" id="dis-fade-right" style="opacity:1;"></div>
        </div>
      </div>

      <!-- Results Count Bar -->
      <div id="dis-status-bar" class="dis-status-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:0.82rem; color:var(--g600, var(--text-2)); font-weight:600;">
        <span id="dis-count-label">Showing high-commodity conditions</span>
        <span>WHO ICD-11 & Orphanet Engine</span>
      </div>

      <!-- Results Grid -->
      <div id="dis-results-container" style="display:flex; flex-direction:column; gap:16px;"></div>
    </div>
  `;

  const searchInput = container.querySelector('#dis-search-input');
  const filterPills = container.querySelectorAll('.dis-pill');
  const resultsContainer = container.querySelector('#dis-results-container');
  const countLabel = container.querySelector('#dis-count-label');

  function renderList() {
    const sysOpt = activeSystem === 'all' ? null : activeSystem;
    const items = searchDiseases(searchQuery, { system: sysOpt, limit: 12 });

    countLabel.textContent = `Showing ${items.length} condition(s)${searchQuery ? ` for "${searchQuery}"` : ''}${activeSystem !== 'all' ? ` in ${activeSystem}` : ''}`;

    if (items.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding:48px 20px; text-align:center; background:var(--white, var(--surface)); border:1px solid var(--g200, var(--line)); border-radius:16px; color:var(--g500, var(--text-2));">
          <div style="font-size:1.1rem; font-weight:700; color:var(--text, var(--text)); margin-bottom:6px;">No matching conditions found</div>
          <div style="font-size:0.86rem;">Try searching for symptoms like "cough", "headache", or broad categories like "cardiovascular".</div>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = '';

    for (const d of items) {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.style.cssText = 'border:1px solid var(--border); border-radius:14px; background:var(--bg-card); overflow:hidden; display:flex; flex-direction:column;';

      // Header
      const cardHeader = document.createElement('div');
      cardHeader.style.cssText = 'padding:12px 18px; background:var(--bg-subtle); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';

      const headLeft = document.createElement('div');
      headLeft.style.cssText = 'display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;';

      const nameText = document.createElement('strong');
      nameText.textContent = d.name;
      nameText.style.cssText = 'font-size:1.02rem; color:var(--text); font-weight:700;';

      const icdBadge = document.createElement('span');
      icdBadge.textContent = `ICD-11: ${d.icd11}`;
      icdBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-muted); font-family:var(--mono); font-weight:600;';

      headLeft.appendChild(nameText);
      headLeft.appendChild(icdBadge);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-secondary btn-sm';
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = 'font-size:0.76rem; padding:4px 12px; cursor:pointer; font-weight:600;';
      saveBtn.addEventListener('click', async () => {
        try {
          await saveArtifactFile({
            name: `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_clinical_summary.txt`,
            content: `DISEASE: ${d.name}\nICD-11: ${d.icd11}\nPREVALENCE: ${d.prevalence || ''}\n\nPATHOPHYSIOLOGY:\n${d.pathophysiology || ''}\n\nSYMPTOMS:\n${(d.symptoms||[]).join('\n- ')}\n\nDIAGNOSTIC CRITERIA:\n${d.diagnosticCriteria || ''}\n\nMANAGEMENT:\n${(d.management||[]).join('\n- ')}`,
            kind: 'text',
            destination: 'cloud',
            from: 'diseases-database'
          });
          saveBtn.textContent = '✓ Saved';
          saveBtn.disabled = true;
        } catch {}
      });

      cardHeader.appendChild(headLeft);
      cardHeader.appendChild(saveBtn);
      card.appendChild(cardHeader);

      // Body
      const cardBody = document.createElement('div');
      cardBody.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:14px; font-size:0.88rem; line-height:1.5; color:var(--text);';

      if (d.pathophysiology || d.prevalence) {
        const pathDiv = document.createElement('div');
        pathDiv.innerHTML = `
          <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Clinical Overview</span>
          <p style="margin:0; color:var(--text); font-size:0.86rem; line-height:1.5;">${escapeHtml(d.pathophysiology || d.prevalence)}</p>
        `;
        cardBody.appendChild(pathDiv);
      }

      if ((d.symptoms && d.symptoms.length) || d.diagnosticCriteria || (d.management && d.management.length)) {
        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;';
        gridDiv.className = 'dis-details-grid';

        if (d.symptoms && d.symptoms.length) {
          const sympDiv = document.createElement('div');
          sympDiv.style.cssText = 'background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; padding:12px 14px;';
          sympDiv.innerHTML = `
            <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">Key Symptoms</span>
            <ul style="margin:0 0 0 16px; padding:0; color:var(--text); font-size:0.84rem; line-height:1.45;">
              ${d.symptoms.slice(0, 6).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
          `;
          gridDiv.appendChild(sympDiv);
        }

        if (d.diagnosticCriteria || (d.management && d.management.length)) {
          const diagDiv = document.createElement('div');
          diagDiv.style.cssText = 'background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; padding:12px 14px;';
          diagDiv.innerHTML = `
            <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">Diagnosis & Management</span>
            ${d.diagnosticCriteria ? `<p style="margin:0 0 6px; font-size:0.84rem; color:var(--text); line-height:1.4;">${escapeHtml(d.diagnosticCriteria)}</p>` : ''}
            ${d.management && d.management.length ? `
              <ul style="margin:0 0 0 16px; padding:0; color:var(--text); font-size:0.84rem; line-height:1.45;">
                ${d.management.slice(0, 3).map(m => `<li>${escapeHtml(m)}</li>`).join('')}
              </ul>
            ` : ''}
          `;
          gridDiv.appendChild(diagDiv);
        }

        cardBody.appendChild(gridDiv);
      }

      card.appendChild(cardBody);
      resultsContainer.appendChild(card);
    }
  }

  // Events
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.classList.add('btn-secondary');
        p.style.background = '';
        p.style.color = '';
      });
      pill.classList.add('active');
      pill.classList.remove('btn-secondary');
      pill.style.background = 'var(--black)';
      pill.style.color = 'var(--white)';
      activeSystem = pill.dataset.system;
      renderList();
    });
  });


  // Reactive Edge Fades for Filter Pills
  const pillsEl = container.querySelector('#dis-filter-pills');
  const fadeLeft = container.querySelector('#dis-fade-left');
  const fadeRight = container.querySelector('#dis-fade-right');

  function updateEdgeFades() {
    if (!pillsEl || !fadeLeft || !fadeRight) return;
    const { scrollLeft, scrollWidth, clientWidth } = pillsEl;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 2) {
      fadeLeft.style.opacity = '0';
      fadeRight.style.opacity = '0';
      return;
    }
    fadeLeft.style.opacity = scrollLeft > 6 ? '1' : '0';
    fadeRight.style.opacity = scrollLeft < maxScroll - 6 ? '1' : '0';
  }

  pillsEl?.addEventListener('scroll', updateEdgeFades, { passive: true });
  window.addEventListener('resize', updateEdgeFades, { passive: true });
  setTimeout(updateEdgeFades, 40);

    // Initial render
    renderList();
  },
  destroy() {}
};
