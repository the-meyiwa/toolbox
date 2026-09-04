export class SpreadsheetEngine {
  constructor(rows = 50, cols = 10) {
    this.rows = rows;
    this.cols = cols;
    
    // Map of cellId -> { raw: value, op: { type, sources }, value: computedValue, error: null }
    this.cells = new Map();
    this.listeners = new Set();
  }

  static parseRef(ref) {
    if (!ref) return null;
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { r: parseInt(rowStr, 10) - 1, c: col - 1 };
  }

  static toRef(r, c) {
    let colStr = '';
    let col = c + 1;
    while (col > 0) {
      let rem = (col - 1) % 26;
      colStr = String.fromCharCode(65 + rem) + colStr;
      col = Math.floor((col - 1) / 26);
    }
    return `${colStr}${r + 1}`;
  }

  resolveRange(rangeStr) {
    if (!rangeStr.includes(':')) return [rangeStr];
    
    const [start, end] = rangeStr.split(':');
    const s = SpreadsheetEngine.parseRef(start);
    const e = SpreadsheetEngine.parseRef(end);
    if (!s || !e) return [];

    const minR = Math.min(s.r, e.r);
    const maxR = Math.max(s.r, e.r);
    const minC = Math.min(s.c, e.c);
    const maxC = Math.max(s.c, e.c);

    const refs = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        refs.push(SpreadsheetEngine.toRef(r, c));
      }
    }
    return refs;
  }

  getValuesFromSources(sources) {
    const refs = sources.flatMap(src => this.resolveRange(src));
    return refs.map(ref => {
      const cell = this.cells.get(ref);
      return cell ? cell.value : '';
    });
  }

  evaluate(cellId) {
    const cell = this.cells.get(cellId);
    if (!cell) return;

    if (!cell.op) {
      // It's a raw cell
      // Let's try to infer if it's a number for calculations, but store display value
      const parsed = parseFloat(cell.raw);
      cell.value = !isNaN(parsed) && String(parsed) === String(cell.raw).trim() ? parsed : cell.raw;
      cell.error = null;
      return;
    }

    try {
      const values = this.getValuesFromSources(cell.op.sources);
      const nums = values.map(v => {
        if (typeof v === 'string' && v.startsWith('$')) v = v.substring(1); // naive currency strip
        return parseFloat(v);
      }).filter(v => !isNaN(v));

      switch (cell.op.type) {
        case 'sum':
          cell.value = nums.reduce((a, b) => a + b, 0);
          break;
        case 'subtract':
          if (nums.length === 0) cell.value = 0;
          else cell.value = nums.slice(1).reduce((acc, val) => acc - val, nums[0]);
          break;
        case 'avg':
          cell.value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          break;
        case 'count':
          cell.value = values.filter(v => v !== '' && v !== null && v !== undefined).length;
          break;
        case 'min':
          cell.value = nums.length ? Math.min(...nums) : 0;
          break;
        case 'max':
          cell.value = nums.length ? Math.max(...nums) : 0;
          break;
        case 'percentage':
          if (nums.length >= 2 && nums[1] !== 0) cell.value = (nums[0] / nums[1]) * 100;
          else { cell.error = 'Div/0'; cell.value = 0; }
          break;
        case 'compare':
          if (nums.length >= 2) cell.value = nums[0] - nums[1];
          else cell.value = 0;
          break;
        default:
          cell.value = cell.raw;
      }
      cell.error = null;
    } catch (e) {
      cell.error = 'Err';
      cell.value = '#ERROR';
    }
  }

  recalculate() {
    const graph = new Map();
    const indegree = new Map();
    
    for (const [id, cell] of this.cells) {
      if (!graph.has(id)) graph.set(id, []);
      if (!indegree.has(id)) indegree.set(id, 0);
    }

    for (const [id, cell] of this.cells) {
      if (cell.op) {
        const deps = cell.op.sources.flatMap(src => this.resolveRange(src));
        for (const dep of deps) {
          if (!graph.has(dep)) {
            graph.set(dep, []);
            indegree.set(dep, 0);
          }
          graph.get(dep).push(id);
          indegree.set(id, (indegree.get(id) || 0) + 1);
        }
      }
    }

    const queue = [];
    for (const [id, degree] of indegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);
      
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        indegree.set(neighbor, indegree.get(neighbor) - 1);
        if (indegree.get(neighbor) === 0) queue.push(neighbor);
      }
    }

    for (const id of sorted) {
      this.evaluate(id);
    }
    
    if (sorted.length < this.cells.size) {
      for (const [id, cell] of this.cells) {
        if (!sorted.includes(id)) {
          cell.error = 'Cycle';
          cell.value = '#CYCLE';
        }
      }
    }

    this.notify();
  }

  setRaw(id, raw) {
    if (!this.cells.has(id)) this.cells.set(id, {});
    const cell = this.cells.get(id);
    cell.raw = raw;
    cell.op = null;
    this.recalculate();
  }

  setOperation(id, type, sources) {
    if (!this.cells.has(id)) this.cells.set(id, {});
    const cell = this.cells.get(id);
    cell.op = { type, sources };
    cell.raw = ''; // Displayed raw is empty for formulas
    this.recalculate();
  }
  
  clearCell(id) {
    this.cells.delete(id);
    this.recalculate();
  }

  getCell(id) {
    return this.cells.get(id) || { raw: '', value: '', error: null, op: null };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) listener();
  }
  
  exportCSV() {
    let csv = '';
    for (let r = 0; r < this.rows; r++) {
      const rowData = [];
      for (let c = 0; c < this.cols; c++) {
        const id = SpreadsheetEngine.toRef(r, c);
        const cell = this.cells.get(id);
        let val = cell ? cell.value : '';
        val = String(val).replace(/"/g, '""');
        if (val.includes(',') || val.includes('"') || val.includes('\\n')) val = `"${val}"`;
        rowData.push(val);
      }
      csv += rowData.join(',') + '\n';
    }
    return csv;
  }
}
