/* CSV to JSON.

   A proper RFC 4180 reader: quoted fields may contain commas, line breaks
   and doubled quotes, and CRLF is treated the same as LF. */

import { copyText } from '../utils.js';

/** Split CSV text into rows of raw string cells. */
export function parseCSV(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;                       // CRLF and LF both end a row
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }

  row.push(cell);
  rows.push(row);

  // A trailing newline leaves one empty row behind; nothing else is dropped.
  return rows.filter((r, i) => i < rows.length - 1 || r.length > 1 || r[0] !== '');
}

/** Comma is the default, but semicolon and tab files are just as common. */
export function detectDelimiter(text) {
  const firstLine = text.split('\n', 1)[0];
  const counts = [',', ';', '\t'].map(d => [d, firstLine.split(d).length - 1]);
  const [best, n] = counts.sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

/** Turn a cell into a number or boolean where that is unambiguous. */
export function coerce(value) {
  const v = value.trim();
  if (v === '') return '';

  const lower = v.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return null;

  // A leading zero, a plus sign or a stray space means an identifier, a
  // phone number or a product code — never a quantity — so it stays text.
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) return v;

  const n = Number(v);
  // Past 2^53 the number would come back different from what was typed.
  if (Number.isInteger(n) && !Number.isSafeInteger(n)) return v;
  return n;
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label" for="csv-input">CSV data</label>
        <textarea class="tool-textarea" id="csv-input" rows="10" spellcheck="false"
          placeholder="id,name,role&#10;1,Ada Achebe,Staff Engineer&#10;2,Bala Nwosu,Designer"></textarea>
      </div>
      <div class="tool-section">
        <label class="tool-label">JSON output</label>
        <div class="tool-output" id="csv-output" style="min-height:200px; padding:0;">
          <button class="copy-btn" id="csv-copy" style="position:absolute; top:8px; right:8px; z-index:10;">Copy</button>
          <pre style="margin:0; padding:14px; overflow:auto; max-height:400px;" id="csv-result"></pre>
        </div>
      </div>
      <div id="csv-status" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    const input = container.querySelector('#csv-input');
    const result = container.querySelector('#csv-result');
    const status = container.querySelector('#csv-status');

    function convert() {
      const text = input.value.trim();
      if (!text) {
        result.textContent = '';
        status.textContent = '';
        return;
      }

      const delimiter = detectDelimiter(text);
      const rows = parseCSV(text, delimiter);

      if (rows.length < 2) {
        result.textContent = '';
        status.textContent = 'A header row and at least one row of data are needed.';
        return;
      }

      const headers = rows[0].map((h, i) => h.trim() || `column${i + 1}`);
      const objects = rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, i) => {
          const raw = row[i] ?? '';
          obj[header] = coerce(raw);
        });
        return obj;
      });

      result.textContent = JSON.stringify(objects, null, 2);

      const named = { ',': 'comma', ';': 'semicolon', '\t': 'tab' }[delimiter];
      status.textContent = `${objects.length} row${objects.length === 1 ? '' : 's'} · `
        + `${headers.length} column${headers.length === 1 ? '' : 's'} · ${named} separated`;
    }

    input.addEventListener('input', convert);

    container.querySelector('#csv-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();

    this._read = () => result.textContent;
    this._write = (text) => { input.value = text; convert(); };
  },

  getArtifact() { return { kind: 'json', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; },
};
