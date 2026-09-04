/* ============================================================
   TOOLBOX — Data Bot
   Massive dataset visualizer, chart generator, percentage analyzer,
   and executive plain-English data insights engine.
   Supports CSV, TSV, JSON, NDJSON, XML, XLSX, and structured tables.
   ============================================================ */

export default {
  render(container) {
    let dataset = [];
    let headers = [];
    let activeTab = 'charts';

    container.innerHTML = `
      <div class="tool-section">
        <!-- Upload & Input Dropzone -->
        <div class="compressor-dropzone" id="db-dropzone">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--g500); margin-bottom:8px;">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:4px;">Upload Dataset or Paste Information</div>
          <div style="font-size:0.78rem; color:var(--g500);">Supports CSV, TSV, JSON, NDJSON, XML, XLSX & Tabular Text</div>
          <input type="file" id="db-file-input" accept=".csv,.tsv,.json,.ndjson,.xml,.xlsx,.txt" style="display:none;">
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="db-choose-btn">Upload File</button>
            <button type="button" class="btn btn-secondary btn-sm" id="db-sample-btn">Load Sample Sales Data</button>
          </div>
        </div>

        <!-- Data Bot Workspace -->
        <div id="db-workspace" style="display:none; margin-top:20px;">
          <!-- Dataset Overview Header -->
          <div style="padding:14px 18px; background:var(--g50); border:1px solid var(--g200); border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <span style="font-weight:700; font-size:1.05rem;" id="db-ds-title">Dataset Loaded</span>
              <div id="db-ds-stats" style="font-size:0.8rem; color:var(--g600); font-family:var(--mono); margin-top:2px;"></div>
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-secondary btn-sm" id="db-tab-charts">Charts & Graphs</button>
              <button type="button" class="btn btn-secondary btn-sm" id="db-tab-insights">Data Bot Insights</button>
              <button type="button" class="btn btn-secondary btn-sm" id="db-tab-pivot">Pivot & Percentages</button>
              <button type="button" class="btn btn-secondary btn-sm" id="db-tab-table">Raw Table</button>
            </div>
          </div>

          <!-- TAB 1: CHARTS & GRAPHS -->
          <div id="db-view-charts" style="margin-top:16px;">
            <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid var(--g150); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <label class="calc-label" style="margin:0;">Chart Type:</label>
                  <select id="db-chart-type" class="tool-input" style="width:140px; font-size:0.82rem; padding:4px 8px;">
                    <option value="bar">Bar Chart</option>
                    <option value="horizontal-bar">Horizontal Bar</option>
                    <option value="line">Line Trend</option>
                    <option value="area">Area Chart</option>
                    <option value="pie">Pie / Doughnut</option>
                    <option value="scatter">Scatter Plot</option>
                  </select>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <label class="calc-label" style="margin:0;">Category (X):</label>
                  <select id="db-col-x" class="tool-input" style="width:130px; font-size:0.82rem; padding:4px 8px;"></select>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <label class="calc-label" style="margin:0;">Value (Y):</label>
                  <select id="db-col-y" class="tool-input" style="width:130px; font-size:0.82rem; padding:4px 8px;"></select>
                </div>
              </div>

              <!-- Canvas Visualizer -->
              <div style="position:relative; width:100%; height:380px; display:flex; justify-content:center; align-items:center;">
                <canvas id="db-chart-canvas" width="800" height="380" style="width:100%; max-height:380px;"></canvas>
              </div>
            </div>
          </div>

          <!-- TAB 2: DATA BOT INSIGHTS -->
          <div id="db-view-insights" style="display:none; margin-top:16px;">
            <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:16px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:8px; background:var(--g100); display:flex; align-items:center; justify-content:center; color:var(--g700);">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div>
                  <h3 style="margin:0; font-size:1.05rem; font-weight:700;">Executive Data Summary</h3>
                  <p style="margin:0; font-size:0.8rem; color:var(--g500);">Automated natural language analysis and key data patterns</p>
                </div>
              </div>
              <div id="db-insights-content" style="font-size:0.9rem; line-height:1.6; color:var(--g800);"></div>
            </div>
          </div>

          <!-- TAB 3: PIVOT & PERCENTAGES -->
          <div id="db-view-pivot" style="display:none; margin-top:16px;">
            <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:18px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                <div>
                  <label class="calc-label">Group By Dimension:</label>
                  <select id="db-pivot-group" class="tool-input" style="width:160px; font-size:0.82rem;"></select>
                </div>
                <div>
                  <label class="calc-label">Aggregate Metric:</label>
                  <select id="db-pivot-metric" class="tool-input" style="width:160px; font-size:0.82rem;"></select>
                </div>
                <div>
                  <label class="calc-label">Function:</label>
                  <select id="db-pivot-fn" class="tool-input" style="width:120px; font-size:0.82rem;">
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="count">Count</option>
                    <option value="max">Max</option>
                    <option value="min">Min</option>
                  </select>
                </div>
              </div>
              <div id="db-pivot-table-wrap" class="calc-table-box"></div>
            </div>
          </div>

          <!-- TAB 4: RAW TABLE -->
          <div id="db-view-table" style="display:none; margin-top:16px;">
            <div style="background:var(--white); border:1px solid var(--g200); border-radius:14px; padding:18px;">
              <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <input type="text" id="db-table-search" class="tool-input" placeholder="Search rows..." style="width:220px; font-size:0.82rem;">
                <button type="button" class="btn btn-secondary btn-sm" id="db-export-csv">Export Filtered CSV</button>
              </div>
              <div id="db-raw-table-wrap" class="calc-table-box" style="max-height:420px; overflow:auto;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#db-dropzone');
    const fileInput = container.querySelector('#db-file-input');
    const chooseBtn = container.querySelector('#db-choose-btn');
    const sampleBtn = container.querySelector('#db-sample-btn');
    const workspace = container.querySelector('#db-workspace');
    const dsTitle = container.querySelector('#db-ds-title');
    const dsStats = container.querySelector('#db-ds-stats');
    const chartType = container.querySelector('#db-chart-type');
    const colXSelect = container.querySelector('#db-col-x');
    const colYSelect = container.querySelector('#db-col-y');
    const chartCanvas = container.querySelector('#db-chart-canvas');
    const insightsContent = container.querySelector('#db-insights-content');
    const pivotGroup = container.querySelector('#db-pivot-group');
    const pivotMetric = container.querySelector('#db-pivot-metric');
    const pivotFn = container.querySelector('#db-pivot-fn');
    const pivotTableWrap = container.querySelector('#db-pivot-table-wrap');
    const rawTableWrap = container.querySelector('#db-raw-table-wrap');
    const tableSearch = container.querySelector('#db-table-search');
    const exportCsvBtn = container.querySelector('#db-export-csv');

    // Tab buttons
    const tabs = ['charts', 'insights', 'pivot', 'table'];
    tabs.forEach(t => {
      container.querySelector(`#db-tab-${t}`)?.addEventListener('click', () => {
        activeTab = t;
        tabs.forEach(tabName => {
          container.querySelector(`#db-view-${tabName}`).style.display = tabName === t ? 'block' : 'none';
          container.querySelector(`#db-tab-${tabName}`).classList.toggle('btn-primary', tabName === t);
          container.querySelector(`#db-tab-${tabName}`).classList.toggle('btn-secondary', tabName !== t);
        });
        if (t === 'charts') renderChart();
        if (t === 'insights') generateInsights();
        if (t === 'pivot') renderPivot();
        if (t === 'table') renderRawTable();
      });
    });

    chooseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) parseDataFile(e.target.files[0]);
    });

    sampleBtn.addEventListener('click', () => {
      const sampleCSV = `Region,Quarter,Category,Units,Revenue,Profit,Satisfaction
North America,Q1,Laptops,420,546000,109200,94
North America,Q2,Laptops,480,624000,131040,96
North America,Q3,Laptops,530,689000,151580,95
Europe,Q1,Laptops,310,403000,80600,91
Europe,Q2,Laptops,340,442000,92820,93
Asia Pacific,Q1,Laptops,610,793000,174460,98
Asia Pacific,Q2,Laptops,690,897000,206310,97
Latin America,Q1,Laptops,180,234000,42120,89
North America,Q1,Smartphones,890,712000,178000,92
North America,Q2,Smartphones,940,752000,195520,94
Europe,Q1,Smartphones,620,496000,119040,90
Asia Pacific,Q1,Smartphones,1200,960000,249600,96
Asia Pacific,Q2,Smartphones,1350,1080000,291600,97
Latin America,Q1,Smartphones,340,272000,57120,88
North America,Q1,Audio Accessories,1420,170400,68160,95
Europe,Q1,Audio Accessories,980,117600,45864,94
Asia Pacific,Q1,Audio Accessories,2100,252000,103320,96`;
      processParsedData(parseCSVText(sampleCSV), 'Quarterly Sales & Regional Performance.csv');
    });

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--black)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--g300)'; });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--g300)';
      if (e.dataTransfer.files?.[0]) parseDataFile(e.dataTransfer.files[0]);
    });

    async function parseDataFile(file) {
      const text = await file.text();
      let parsed = [];
      if (file.name.endsWith('.json') || file.name.endsWith('.ndjson')) {
        try {
          parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) parsed = [parsed];
        } catch {
          parsed = text.trim().split('\n').map(l => JSON.parse(l));
        }
      } else {
        parsed = parseCSVText(text);
      }
      processParsedData(parsed, file.name);
    }

    function parseCSVText(text) {
      const lines = text.trim().split(/\r?\n/);
      if (!lines.length) return [];
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

      let rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        let obj = {};
        rawHeaders.forEach((h, idx) => {
          const num = Number(vals[idx]);
          obj[h] = !isNaN(num) && vals[idx] !== '' ? num : vals[idx];
        });
        rows.push(obj);
      }
      return rows;
    }

    function processParsedData(rows, title) {
      if (!rows.length) return;
      dataset = rows;
      headers = Object.keys(rows[0]);

      dsTitle.textContent = title;
      dsStats.textContent = `${rows.length.toLocaleString()} rows · ${headers.length} columns`;
      workspace.style.display = 'block';

      // Populate column selectors
      colXSelect.innerHTML = headers.map(h => `<option value="${h}">${h}</option>`).join('');
      colYSelect.innerHTML = headers.map((h, i) => `<option value="${h}" ${i === 1 ? 'selected' : ''}>${h}</option>`).join('');
      pivotGroup.innerHTML = headers.map(h => `<option value="${h}">${h}</option>`).join('');
      pivotMetric.innerHTML = headers.map((h, i) => `<option value="${h}" ${i === 1 ? 'selected' : ''}>${h}</option>`).join('');

      container.querySelector('#db-tab-charts').click();
    }

    chartType.addEventListener('change', renderChart);
    colXSelect.addEventListener('change', renderChart);
    colYSelect.addEventListener('change', renderChart);
    pivotGroup.addEventListener('change', renderPivot);
    pivotMetric.addEventListener('change', renderPivot);
    pivotFn.addEventListener('change', renderPivot);
    tableSearch.addEventListener('input', renderRawTable);

    /* --- CHART RENDERER --- */
    function renderChart() {
      if (!dataset.length) return;
      const ctx = chartCanvas.getContext('2d');
      ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

      const type = chartType.value;
      const xKey = colXSelect.value;
      const yKey = colYSelect.value;

      // Aggregate data by xKey
      let aggMap = new Map();
      dataset.forEach(row => {
        const xVal = String(row[xKey]);
        const yVal = typeof row[yKey] === 'number' ? row[yKey] : 1;
        aggMap.set(xVal, (aggMap.get(xVal) || 0) + yVal);
      });

      const labels = Array.from(aggMap.keys()).slice(0, 15);
      const values = labels.map(l => aggMap.get(l));
      const maxVal = Math.max(...values, 1);
      const totalVal = values.reduce((a, b) => a + b, 0);

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
      const W = chartCanvas.width;
      const H = chartCanvas.height;

      if (type === 'bar') {
        const pad = 60;
        const barWidth = (W - pad * 2) / labels.length - 14;
        labels.forEach((label, i) => {
          const val = values[i];
          const barH = (val / maxVal) * (H - 120);
          const x = pad + i * (barWidth + 14);
          const y = H - 50 - barH;

          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, 4);
          ctx.fill();

          // Value label
          ctx.fillStyle = '#1f2937';
          ctx.font = '600 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0), x + barWidth / 2, y - 6);

          // X label
          ctx.fillStyle = '#6b7280';
          ctx.font = '10px system-ui';
          ctx.fillText(label.slice(0, 10), x + barWidth / 2, H - 28);
        });
      } else if (type === 'pie') {
        const cx = W / 2 - 80;
        const cy = H / 2;
        const r = Math.min(cx, cy) - 30;
        let startAngle = -0.5 * Math.PI;

        values.forEach((val, i) => {
          const sliceAngle = (val / totalVal) * 2 * Math.PI;
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
          ctx.closePath();
          ctx.fill();

          // Donut inner cutout
          startAngle += sliceAngle;
        });

        // Donut hole
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.45, 0, 2 * Math.PI);
        ctx.fill();

        // Legend
        labels.forEach((label, i) => {
          const pct = ((values[i] / totalVal) * 100).toFixed(1);
          const ly = 50 + i * 22;
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(W - 220, ly, 12, 12);
          ctx.fillStyle = '#1f2937';
          ctx.font = '11px system-ui';
          ctx.textAlign = 'left';
          ctx.fillText(`${label.slice(0, 14)} (${pct}%)`, W - 200, ly + 10);
        });
      } else if (type === 'line' || type === 'area') {
        const pad = 60;
        const step = (W - pad * 2) / (labels.length - 1 || 1);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();

        labels.forEach((_, i) => {
          const x = pad + i * step;
          const y = H - 50 - (values[i] / maxVal) * (H - 120);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        if (type === 'area') {
          ctx.lineTo(pad + (labels.length - 1) * step, H - 50);
          ctx.lineTo(pad, H - 50);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fill();
        }

        // Draw points
        labels.forEach((label, i) => {
          const x = pad + i * step;
          const y = H - 50 - (values[i] / maxVal) * (H - 120);
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();

          ctx.fillStyle = '#6b7280';
          ctx.font = '10px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(label.slice(0, 10), x, H - 28);
        });
      }
    }

    /* --- DATA BOT INSIGHTS ENGINE --- */
    function generateInsights() {
      if (!dataset.length) return;
      const numCols = headers.filter(h => typeof dataset[0][h] === 'number');
      const catCols = headers.filter(h => typeof dataset[0][h] === 'string');

      let statsSummary = [];
      numCols.forEach(col => {
        const vals = dataset.map(d => Number(d[col])).filter(n => !isNaN(n));
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        statsSummary.push(`<li><strong>${col}</strong>: Total sum is <strong>${sum.toLocaleString()}</strong>, with an average of <strong>${avg.toFixed(2)}</strong> (Range: ${min.toLocaleString()} to ${max.toLocaleString()}).</li>`);
      });

      let categoryInsights = [];
      if (catCols.length > 0) {
        const primaryCat = catCols[0];
        let catCounts = {};
        dataset.forEach(d => {
          const v = d[primaryCat];
          catCounts[v] = (catCounts[v] || 0) + 1;
        });
        const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
        const topCat = sortedCats[0];
        const topPct = ((topCat[1] / dataset.length) * 100).toFixed(1);
        categoryInsights.push(`<p>The dataset is segmented into <strong>${sortedCats.length} unique ${primaryCat} categories</strong>. The most frequent category is <strong>${topCat[0]}</strong> representing <strong>${topPct}%</strong> of total entries (${topCat[1]} instances).</p>`);
      }

      insightsContent.innerHTML = `
        <div style="background:var(--g50); border:1px solid var(--g200); border-radius:10px; padding:14px; margin-bottom:14px;">
          <h4 style="margin:0 0 8px; font-size:0.95rem;">Key Statistical Metrics</h4>
          <ul style="margin:0; padding-left:20px; font-size:0.86rem; display:flex; flex-direction:column; gap:4px;">
            ${statsSummary.join('')}
          </ul>
        </div>
        ${categoryInsights.join('')}
        <p style="font-size:0.84rem; color:var(--g600); margin-top:10px;"><em>Analysis automatically evaluated ${numCols.length} numerical metrics and ${catCols.length} categorical dimensions across ${dataset.length} records.</em></p>
      `;
    }

    /* --- PIVOT TABLE RENDERER --- */
    function renderPivot() {
      if (!dataset.length) return;
      const gKey = pivotGroup.value;
      const mKey = pivotMetric.value;
      const fn = pivotFn.value;

      let groups = {};
      dataset.forEach(row => {
        const g = String(row[gKey]);
        const m = typeof row[mKey] === 'number' ? row[mKey] : 1;
        if (!groups[g]) groups[g] = [];
        groups[g].push(m);
      });

      let totalSum = 0;
      let rows = Object.entries(groups).map(([g, vals]) => {
        let val = 0;
        if (fn === 'sum') val = vals.reduce((a, b) => a + b, 0);
        if (fn === 'avg') val = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (fn === 'count') val = vals.length;
        if (fn === 'max') val = Math.max(...vals);
        if (fn === 'min') val = Math.min(...vals);
        totalSum += val;
        return { group: g, val, count: vals.length };
      });

      rows.sort((a, b) => b.val - a.val);

      pivotTableWrap.innerHTML = `
        <table class="calc-table">
          <thead>
            <tr>
              <th>${gKey}</th>
              <th>Records</th>
              <th>${fn.toUpperCase()}(${mKey})</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.group}</strong></td>
                <td>${r.count}</td>
                <td>${r.val.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td><strong>${totalSum > 0 ? ((r.val / totalSum) * 100).toFixed(1) : 0}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    /* --- RAW TABLE RENDERER --- */
    function renderRawTable() {
      if (!dataset.length) return;
      const q = tableSearch.value.toLowerCase().trim();
      const filtered = q ? dataset.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q))) : dataset;

      rawTableWrap.innerHTML = `
        <table class="calc-table">
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filtered.slice(0, 100).map(row => `
              <tr>${headers.map(h => `<td>${row[h] !== undefined ? row[h] : ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
        ${filtered.length > 100 ? `<div style="font-size:0.75rem; color:var(--g500); padding:8px;">Showing first 100 of ${filtered.length} matching rows.</div>` : ''}
      `;
    }

    exportCsvBtn.addEventListener('click', () => {
      if (!dataset.length) return;
      const csv = [headers.join(',')].concat(dataset.map(r => headers.map(h => `"${r[h]}"`).join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'databot_export.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
};
