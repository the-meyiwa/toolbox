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
    <div class="tool-content" style="max-width:960px; margin:0 auto; padding:20px;">
      <!-- Header -->
      <div style="margin-bottom:24px;">
        <h2 style="font-size:1.6rem; font-weight:800; color:var(--text, #0f172a); margin:0 0 6px 0;">Diseases & Pathology Database</h2>
        <p style="font-size:0.9rem; color:var(--g600, #64748b); margin:0;">
          Explore 80,000+ conditions across WHO ICD-11, Orphanet, and clinical medicine indexed by global epidemiological commodity.
        </p>
      </div>

      <!-- Search & Filters -->
      <div style="background:var(--white, #fff); border:1px solid var(--g200, #e2e8f0); border-radius:16px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.04); margin-bottom:20px;">
        <div style="position:relative; margin-bottom:14px;">
          <input
            type="search"
            id="dis-search-input"
            class="tool-input"
            placeholder="Search by disease name, symptom (e.g. 'chest pain', 'hay fever', 'cephalitis'), or ICD-11 code..."
            style="width:100%; height:46px; border-radius:9999px; padding:0 20px; font-size:0.92rem; border:1.5px solid var(--g300, #cbd5e1); outline:none; box-sizing:border-box;"
          />
        </div>

        <!-- Filter Pills -->
        <div id="dis-filter-pills" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;">
          <button type="button" class="btn btn-sm dis-pill active" data-system="all" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; background:var(--black, #0f172a); color:#fff; cursor:pointer;">All Conditions</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="cardiovascular" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Cardiovascular</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="respiratory" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Respiratory</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="neurological" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Neurological</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="gastrointestinal" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Gastrointestinal</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="endocrine" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Endocrine</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="musculoskeletal" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Musculoskeletal</button>
          <button type="button" class="btn btn-secondary btn-sm dis-pill" data-system="infectious" style="border-radius:9999px; padding:5px 14px; font-size:0.8rem; font-weight:700; white-space:nowrap; cursor:pointer;">Infectious</button>
        </div>
      </div>

      <!-- Results Count Bar -->
      <div id="dis-status-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:0.82rem; color:var(--g600, #64748b); font-weight:600;">
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
        <div style="padding:48px 20px; text-align:center; background:var(--white, #fff); border:1px solid var(--g200, #e2e8f0); border-radius:16px; color:var(--g500, #64748b);">
          <div style="font-size:1.1rem; font-weight:700; color:var(--text, #0f172a); margin-bottom:6px;">No matching conditions found</div>
          <div style="font-size:0.86rem;">Try searching for symptoms like "cough", "headache", or broad categories like "cardiovascular".</div>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = '';

    for (const d of items) {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.style.cssText = 'border:1px solid var(--g200, #e2e8f0); border-radius:16px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.03); overflow:hidden; display:flex; flex-direction:column;';

      // Header
      const cardHeader = document.createElement('div');
      cardHeader.style.cssText = 'padding:14px 18px; background:var(--g50, #f8fafc); border-bottom:1px solid var(--g200, #e2e8f0); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';

      const headLeft = document.createElement('div');
      headLeft.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';

      const nameText = document.createElement('strong');
      nameText.textContent = d.name;
      nameText.style.cssText = 'font-size:1.05rem; color:var(--text, #0f172a); font-weight:800;';

      const icdBadge = document.createElement('span');
      icdBadge.textContent = `ICD-11: ${d.icd11}`;
      icdBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--primary-light, #eff6ff); color:var(--primary, #2563eb); font-weight:700;';

      const commodityBadge = document.createElement('span');
      commodityBadge.textContent = `Commodity ${d.commodity}/100`;
      commodityBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:#f0fdf4; color:#15803d; font-weight:700;';

      headLeft.appendChild(nameText);
      headLeft.appendChild(icdBadge);
      headLeft.appendChild(commodityBadge);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-secondary btn-sm';
      saveBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">Save to Work</span>`;
      saveBtn.style.cssText = 'font-size:0.78rem; padding:5px 14px; border-radius:9999px; cursor:pointer; font-weight:700;';
      saveBtn.addEventListener('click', async () => {
        try {
          await saveArtifactFile({
            name: `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_clinical_summary.txt`,
            content: `DISEASE: ${d.name}\nICD-11: ${d.icd11}\nPREVALENCE: ${d.prevalence}\n\nPATHOPHYSIOLOGY:\n${d.pathophysiology}\n\nSYMPTOMS:\n${(d.symptoms||[]).join('\n- ')}\n\nDIAGNOSTIC CRITERIA:\n${d.diagnosticCriteria}\n\nMANAGEMENT:\n${(d.management||[]).join('\n- ')}`,
            kind: 'text',
            destination: 'cloud',
            from: 'diseases-database'
          });
          saveBtn.textContent = '✓ Saved';
          saveBtn.disabled = true;
          saveBtn.style.background = '#f0fdf4';
          saveBtn.style.color = '#15803d';
        } catch {}
      });

      cardHeader.appendChild(headLeft);
      cardHeader.appendChild(saveBtn);
      card.appendChild(cardHeader);

      // Body
      const cardBody = document.createElement('div');
      cardBody.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:12px; font-size:0.88rem; line-height:1.55; color:var(--text, #0f172a);';

      if (d.prevalence) {
        const prevDiv = document.createElement('div');
        prevDiv.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--g500, #64748b); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Epidemiology & Prevalence</span>${escapeHtml(d.prevalence)}`;
        cardBody.appendChild(prevDiv);
      }

      if (d.pathophysiology) {
        const pathDiv = document.createElement('div');
        pathDiv.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--g500, #64748b); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Etiology & Pathophysiology</span>${escapeHtml(d.pathophysiology)}`;
        cardBody.appendChild(pathDiv);
      }

      if (d.symptoms && d.symptoms.length) {
        const sympDiv = document.createElement('div');
        sympDiv.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--g500, #64748b); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Clinical Signs & Symptoms</span><ul style="margin:4px 0 0 16px; padding:0;">${d.symptoms.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
        cardBody.appendChild(sympDiv);
      }

      if (d.diagnosticCriteria) {
        const diagDiv = document.createElement('div');
        diagDiv.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--g500, #64748b); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">Diagnostic Evaluation</span>${escapeHtml(d.diagnosticCriteria)}`;
        cardBody.appendChild(diagDiv);
      }

      if (d.management && d.management.length) {
        const mgmtDiv = document.createElement('div');
        mgmtDiv.style.cssText = 'padding:10px 14px; background:var(--g50, #f8fafc); border-radius:10px; border-left:3.5px solid var(--primary, #2563eb);';
        mgmtDiv.innerHTML = `<span style="font-size:0.75rem; font-weight:700; color:var(--primary, #2563eb); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">First-Line Medical Management</span><ul style="margin:0 0 0 16px; padding:0;">${d.management.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
        cardBody.appendChild(mgmtDiv);
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
      pill.style.background = 'var(--black, #0f172a)';
      pill.style.color = '#fff';
      activeSystem = pill.dataset.system;
      renderList();
    });
  });

    // Initial render
    renderList();
  },
  destroy() {}
};
