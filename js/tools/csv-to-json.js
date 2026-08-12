import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">CSV Data</label>
        <textarea class="tool-textarea" id="csv-input" placeholder="id,name,age\\n1,John,30\\n2,Jane,25" rows="10"></textarea>
      </div>
      <div class="tool-controls">
        <button class="btn btn-primary" id="csv-convert">Convert to JSON</button>
      </div>
      <div class="tool-section">
        <label class="tool-label">JSON Output</label>
        <div class="tool-output" id="csv-output" style="min-height:200px; padding:0;">
          <button class="copy-btn" id="csv-copy" style="z-index:10; top:8px; right:8px; position:absolute;">Copy</button>
          <pre style="margin:0; padding:14px; overflow:auto; max-height:400px;" id="csv-result"></pre>
        </div>
      </div>
      <div id="csv-error" style="color:var(--g600); font-size:0.8rem; margin-top:8px;"></div>
    `;

    const input = container.querySelector('#csv-input');
    const result = container.querySelector('#csv-result');
    const errorEl = container.querySelector('#csv-error');

    function parseCSV(text) {
      let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
      for (l of text) {
          if ('"' === l) {
              if (s && l === p) row[i] += l;
              s = !s;
          } else if (',' === l && s) l = row[++i] = '';
          else if ('\\n' === l && s) {
              if ('\\r' === p) row[i] = row[i].slice(0, -1);
              row = ret[++r] = [l = '']; i = 0;
          } else row[i] += l;
          p = l;
      }
      return ret.filter(r => r.length > 1 || r[0] !== '');
    }

    function convert() {
      errorEl.textContent = '';
      const text = input.value.trim();
      if (!text) {
        result.textContent = '';
        return;
      }

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          errorEl.textContent = 'CSV must have a header row and at least one data row.';
          return;
        }

        const headers = rows[0].map(h => h.trim());
        const json = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const obj = {};
          for (let j = 0; j < headers.length; j++) {
            let val = row[j] !== undefined ? row[j].trim() : '';
            // Auto-convert numbers
            if (val !== '' && !isNaN(val)) val = Number(val);
            // Auto-convert booleans
            if (val.toString().toLowerCase() === 'true') val = true;
            if (val.toString().toLowerCase() === 'false') val = false;
            
            obj[headers[j]] = val;
          }
          json.push(obj);
        }

        result.textContent = JSON.stringify(json, null, 2);
      } catch (err) {
        errorEl.textContent = 'Failed to parse CSV: ' + err.message;
      }
    }

    container.querySelector('#csv-convert').addEventListener('click', convert);

    container.querySelector('#csv-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });
  },
  destroy() {}
};
