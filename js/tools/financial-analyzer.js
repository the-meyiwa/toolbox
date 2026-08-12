import { SpreadsheetEngine } from '../spreadsheet-engine.js';

export default {
  render(container) {
    const ROWS = 50;
    const COLS = 10;
    const engine = new SpreadsheetEngine(ROWS, COLS);

    // Initial schema for Financial Analysis
    engine.setRaw('A1', 'Date');
    engine.setRaw('B1', 'Label');
    engine.setRaw('C1', 'Income');
    engine.setRaw('D1', 'Expense');
    engine.setRaw('E1', 'Notes');

    engine.setRaw('G2', 'Total Income');
    engine.setOperation('H2', 'sum', ['C2:C50']);
    
    engine.setRaw('G3', 'Total Expense');
    engine.setOperation('H3', 'sum', ['D2:D50']);
    
    engine.setRaw('G4', 'Net Flow');
    engine.setOperation('H4', 'compare', ['H2', 'H3']);

    engine.setRaw('G6', 'Highest Income');
    engine.setOperation('H6', 'max', ['C2:C50']);
    
    engine.setRaw('G7', 'Highest Expense');
    engine.setOperation('H7', 'max', ['D2:D50']);

    let isSelecting = false;
    let pendingOp = null; // { type, targetCell }
    let selectionStart = null; // cell id
    let currentSelection = []; // array of cell ids

    container.innerHTML = `
      <style>
        .sheet-wrapper {
          overflow: auto;
          max-height: 600px;
          border: 1px solid var(--g200);
          border-radius: 12px;
          position: relative;
        }
        .sheet-table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
          background: var(--white);
        }
        .sheet-table th, .sheet-table td {
          border: 1px solid var(--g200);
          padding: 0;
          height: 32px;
          position: relative;
        }
        .sheet-table th {
          background: var(--g50);
          font-family: var(--sans);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--g500);
          text-align: center;
          user-select: none;
        }
        .sheet-table th:first-child { width: 40px; }
        .cell-input {
          width: 100%;
          height: 100%;
          border: none;
          padding: 0 8px;
          font-family: var(--sans);
          font-size: 0.85rem;
          background: transparent;
          outline: none;
        }
        .cell-input:focus {
          box-shadow: inset 0 0 0 2px var(--black);
          z-index: 10;
        }
        .cell-input.is-formula {
          color: var(--black);
          font-weight: 600;
          background: #fdfbf7;
        }
        .cell-input.is-error {
          color: #D32F2F;
        }
        .cell-hover-menu {
          position: absolute;
          right: 2px;
          top: 2px;
          width: 24px;
          height: 24px;
          background: var(--white);
          border: 1px solid var(--g200);
          border-radius: 4px;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 20;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .sheet-table td:hover .cell-hover-menu {
          display: flex;
        }
        
        .op-menu {
          position: absolute;
          background: var(--white);
          border: 1px solid var(--g200);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          z-index: 100;
          display: none;
          flex-direction: column;
          min-width: 200px;
          padding: 8px 0;
        }
        .op-menu.active { display: flex; }
        .op-item {
          padding: 8px 16px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .op-item:hover {
          background: var(--g50);
        }
        
        .selection-banner {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          background: var(--black);
          color: var(--white);
          padding: 12px 20px;
          font-size: 0.9rem;
          display: none;
          justify-content: space-between;
          align-items: center;
          z-index: 50;
        }
        .selection-banner.active { display: flex; }
        
        .cell-selected {
          background: rgba(0, 0, 0, 0.1) !important;
          box-shadow: inset 0 0 0 1px var(--black);
        }
      </style>

      <div class="tool-controls" style="margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" id="btn-export">Export CSV</button>
      </div>

      <div class="sheet-wrapper">
        <div class="selection-banner" id="sel-banner">
          <span id="sel-text">Select range...</span>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="btn-cancel-sel" style="background:var(--white); color:var(--black);">Cancel</button>
            <button class="btn btn-primary btn-sm" id="btn-confirm-sel" style="background:var(--white); color:var(--black);">Confirm</button>
          </div>
        </div>
        <table class="sheet-table" id="sheet-table">
          <thead>
            <tr id="sheet-head"></tr>
          </thead>
          <tbody id="sheet-body"></tbody>
        </table>
        <div class="op-menu" id="op-menu">
          <div class="op-item" data-op="sum">Add numbers from...</div>
          <div class="op-item" data-op="subtract">Subtract numbers from...</div>
          <div class="op-item" data-op="avg">Calculate the average of...</div>
          <div class="op-item" data-op="count">Count values from...</div>
          <div class="op-item" data-op="max">Find the highest value in...</div>
          <div class="op-item" data-op="min">Find the lowest value in...</div>
          <div class="op-item" data-op="percentage">Calculate the percentage of...</div>
          <div class="op-item" data-op="compare">Compare with...</div>
          <hr style="border:none; border-top:1px solid var(--g150); margin:4px 0;">
          <div class="op-item" data-op="clear" style="color:#D32F2F;">Clear operation</div>
        </div>
      </div>
    `;

    const thead = container.querySelector('#sheet-head');
    const tbody = container.querySelector('#sheet-body');
    const opMenu = container.querySelector('#op-menu');
    const selBanner = container.querySelector('#sel-banner');
    const selText = container.querySelector('#sel-text');

    // Build header
    let ths = '<th></th>';
    for (let c = 0; c < COLS; c++) {
      ths += `<th>${String.fromCharCode(65 + c)}</th>`;
    }
    thead.innerHTML = ths;

    // Build body
    let trs = '';
    for (let r = 0; r < ROWS; r++) {
      let tr = `<tr><th>${r + 1}</th>`;
      for (let c = 0; c < COLS; c++) {
        const id = SpreadsheetEngine.toRef(r, c);
        tr += `
          <td data-id="${id}">
            <input type="text" class="cell-input" data-id="${id}">
            <div class="cell-hover-menu" data-id="${id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </div>
          </td>`;
      }
      tr += '</tr>';
      trs += tr;
    }
    tbody.innerHTML = trs;

    const inputs = container.querySelectorAll('.cell-input');

    // Update UI from engine state
    const syncUI = () => {
      inputs.forEach(input => {
        const id = input.dataset.id;
        const cell = engine.getCell(id);
        
        // If it's active focus, don't overwrite raw unless it's a formula
        if (document.activeElement !== input) {
          if (cell.op) {
            input.value = cell.error ? cell.value : cell.value;
            input.classList.add('is-formula');
          } else {
            input.value = cell.raw || '';
            input.classList.remove('is-formula');
          }
          if (cell.error) input.classList.add('is-error');
          else input.classList.remove('is-error');
        }
      });
    };

    engine.subscribe(syncUI);
    syncUI();

    // Input handlers
    tbody.addEventListener('input', (e) => {
      if (e.target.classList.contains('cell-input')) {
        const id = e.target.dataset.id;
        engine.setRaw(id, e.target.value);
      }
    });

    // 3-dot menu handlers
    let activeMenuCell = null;
    tbody.addEventListener('click', (e) => {
      const menuBtn = e.target.closest('.cell-hover-menu');
      if (menuBtn) {
        activeMenuCell = menuBtn.dataset.id;
        const rect = menuBtn.getBoundingClientRect();
        const wrapperRect = container.querySelector('.sheet-wrapper').getBoundingClientRect();
        
        opMenu.style.top = (rect.bottom - wrapperRect.top + container.querySelector('.sheet-wrapper').scrollTop) + 'px';
        opMenu.style.left = (rect.left - wrapperRect.left) + 'px';
        opMenu.classList.add('active');
        e.stopPropagation();
      }
    });

    document.addEventListener('click', (e) => {
      if (!opMenu.contains(e.target)) {
        opMenu.classList.remove('active');
      }
    });

    // Operation selection
    opMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.op-item');
      if (item && activeMenuCell) {
        const op = item.dataset.op;
        opMenu.classList.remove('active');
        
        if (op === 'clear') {
          engine.setRaw(activeMenuCell, '');
        } else {
          startSelection(activeMenuCell, op);
        }
      }
    });

    // Selection Mode Logic
    function startSelection(cellId, op) {
      isSelecting = true;
      pendingOp = { type: op, targetCell: cellId };
      selectionStart = null;
      currentSelection = [];
      selBanner.classList.add('active');
      selText.textContent = `Select range for: ${op.toUpperCase()} -> ${cellId}`;
      clearSelectionHighlights();
    }

    function clearSelectionHighlights() {
      container.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected'));
    }

    function highlightRange(startRef, endRef) {
      clearSelectionHighlights();
      const s = SpreadsheetEngine.parseRef(startRef);
      const e = SpreadsheetEngine.parseRef(endRef);
      if (!s || !e) return;
      
      const minR = Math.min(s.r, e.r);
      const maxR = Math.max(s.r, e.r);
      const minC = Math.min(s.c, e.c);
      const maxC = Math.max(s.c, e.c);

      currentSelection = [`${SpreadsheetEngine.toRef(minR, minC)}:${SpreadsheetEngine.toRef(maxR, maxC)}`];

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const ref = SpreadsheetEngine.toRef(r, c);
          const td = container.querySelector(`td[data-id="${ref}"]`);
          if (td) td.classList.add('cell-selected');
        }
      }
    }

    let isDragging = false;
    tbody.addEventListener('mousedown', (e) => {
      if (!isSelecting) return;
      const td = e.target.closest('td[data-id]');
      if (td) {
        isDragging = true;
        selectionStart = td.dataset.id;
        highlightRange(selectionStart, selectionStart);
        e.preventDefault();
      }
    });

    tbody.addEventListener('mouseover', (e) => {
      if (!isDragging || !isSelecting) return;
      const td = e.target.closest('td[data-id]');
      if (td) {
        highlightRange(selectionStart, td.dataset.id);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });

    container.querySelector('#btn-cancel-sel').addEventListener('click', () => {
      isSelecting = false;
      pendingOp = null;
      selBanner.classList.remove('active');
      clearSelectionHighlights();
    });

    container.querySelector('#btn-confirm-sel').addEventListener('click', () => {
      if (isSelecting && pendingOp && currentSelection.length > 0) {
        engine.setOperation(pendingOp.targetCell, pendingOp.type, currentSelection);
      }
      isSelecting = false;
      pendingOp = null;
      selBanner.classList.remove('active');
      clearSelectionHighlights();
    });

    container.querySelector('#btn-export').addEventListener('click', () => {
      const csv = engine.exportCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'financial_analysis.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  },
  destroy() {}
};
