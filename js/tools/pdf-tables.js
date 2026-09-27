/* ============================================================
   PDF Tables to CSV / Excel — find the tables in a text-based PDF
   (statements, reports, price lists) and export them.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { extractTables, outName } from '../lib/pdf/ops.js';
import { writeCsvRows } from '../lib/transforms/table-ops.js';
import { table } from '../lib/kit/render.js';

export default makeFileTool({
  id: 'pdf-tables',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF with tables',
  action: 'Find tables',
  note: 'Works on PDFs with real text. For scans, run OCR PDF first.',
  fields: [
    { key: 'minRows', label: 'Smallest table (rows)', type: 'number', value: 3, min: 2 },
    { key: 'output', label: 'Save as', type: 'seg', options: [['xlsx', 'Excel workbook'], ['csv', 'CSV files'], ['one', 'One CSV']], value: 'xlsx' },
  ],
  async run([f], v, { signal, progress }) {
    const tables = await extractTables(await f.bytes(), { minRows: Number(v.minRows) || 3 }, { signal, onProgress: progress });
    if (!tables.length) return { note: 'No tables found. If this is a scanned document, run OCR PDF first.' };
    let files;
    if (v.output === 'xlsx') {
      const XLSX = await import('@e965/xlsx');
      const wb = XLSX.utils.book_new();
      tables.forEach((t) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.rows), `Page ${t.page}${t.index > 1 ? ` (${t.index})` : ''}`.slice(0, 31)));
      files = [{ name: outName(f.name, 'tables', 'xlsx'), data: new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })) }];
    } else if (v.output === 'one') {
      files = [{ name: outName(f.name, 'tables', 'csv'), data: new TextEncoder().encode(tables.map((t) => writeCsvRows(t.rows)).join('\n\n')) }];
    } else files = tables.map((t) => ({ name: outName(f.name, `page${t.page}-table${t.index}`, 'csv'), data: new TextEncoder().encode(writeCsvRows(t.rows)) }));
    const preview = tables.slice(0, 5).map((t) => `<h4 class="kit-h">Page ${t.page} · table ${t.index} · ${t.rows.length} rows</h4>${table(t.rows[0], t.rows.slice(1, 15))}`).join('');
    return { files, html: preview, note: `Found ${tables.length} table${tables.length === 1 ? '' : 's'}.`, zipName: outName(f.name, 'tables', 'zip') };
  },
});
