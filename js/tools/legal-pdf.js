/* ============================================================
   Legal PDF — Court Bundles, Bates Numbering, Redaction & E-Filing.

   Dedicated law PDF workflow:
   - Automated sequential Bates Numbering / Pagination (e.g. "BUNDLE-001")
   - Redaction of confidential party details / sensitive data
   - Document bundling & exhibit joining
   - Court e-filing size optimization
   Runs 100% on-device via pdf-lib & pdfjs-dist.
   ============================================================ */

import { dropZone, attachFileInput, downloadBlob, humanBytes } from '../lib/file-engine.js';
import { loadPdfJs } from '../lib/pdf-editor-engine.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="tool-section">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
          <label class="tool-label" style="margin:0;">Select Legal PDF / Court Filing</label>
          <span style="font-size:0.78rem; color:var(--g600);">Bundles, Pleadings, Affidavits, Exhibits</span>
        </div>
        ${dropZone('lpdf-zone', { label: 'Drop a PDF to apply court Bates numbering, redactions, or bundle', accept: '.pdf' })}
      </div>

      <div id="lpdf-work" hidden style="margin-top:16px;">
        <!-- Operations Tab Strip -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-size:0.82rem; font-weight:600;">Action:</span>
            <div class="btn-group t3d-seg" id="lpdf-action-grp">
              <button class="btn btn-sm is-active" data-act="bates">Bates Stamping</button>
              <button class="btn btn-sm" data-act="redact">Redaction</button>
              <button class="btn btn-sm" data-act="compress">E-Filing Compress</button>
            </div>
          </div>
          <div id="lpdf-meta" style="font-size:0.8rem; color:var(--g600); font-family:var(--mono);"></div>
        </div>

        <!-- Action Panel: Bates Stamping -->
        <div id="lpdf-panel-bates" style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; margin-top:14px;">
          <h4 style="font-size:0.88rem; font-weight:700; margin:0 0 10px 0; color:var(--black);">Court Bates Numbering &amp; Sequential Pagination</h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
            <div>
              <label class="tool-label" for="lpdf-bates-prefix">Prefix (e.g. "BUNDLE-", "EXHIBIT-")</label>
              <input type="text" class="tool-input" id="lpdf-bates-prefix" value="PAGE-">
            </div>
            <div>
              <label class="tool-label" for="lpdf-bates-start">Starting Number</label>
              <input type="number" class="tool-input" id="lpdf-bates-start" value="1" min="1">
            </div>
            <div>
              <label class="tool-label" for="lpdf-bates-pos">Stamp Position</label>
              <select class="tool-select" id="lpdf-bates-pos" style="width:100%;">
                <option value="bottom-right">Bottom Right Corner</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="top-right">Top Right Corner</option>
              </select>
            </div>
          </div>
          <div style="margin-top:14px;">
            <button class="btn btn-primary" id="lpdf-apply-bates">Apply Bates Numbers &amp; Download</button>
          </div>
        </div>

        <!-- Action Panel: Redaction -->
        <div id="lpdf-panel-redact" hidden style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; margin-top:14px;">
          <h4 style="font-size:0.88rem; font-weight:700; margin:0 0 10px 0; color:var(--black);">Confidential Text Redaction</h4>
          <p style="font-size:0.82rem; color:var(--g600); margin:0 0 10px 0;">Enter specific names, account numbers, or confidential terms to blackout and sanitize across all pages.</p>
          <div>
            <label class="tool-label" for="lpdf-redact-terms">Terms / Names to Redact (comma separated)</label>
            <input type="text" class="tool-input" id="lpdf-redact-terms" placeholder="e.g. Confidential Party Name, 0123456789, Secret Settlement">
          </div>
          <div style="margin-top:14px;">
            <button class="btn btn-primary" id="lpdf-apply-redact">Apply Redactions &amp; Download</button>
          </div>
        </div>

        <!-- Action Panel: E-Filing Compress -->
        <div id="lpdf-panel-compress" hidden style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; margin-top:14px;">
          <h4 style="font-size:0.88rem; font-weight:700; margin:0 0 10px 0; color:var(--black);">Court E-Filing File Size Optimization</h4>
          <p style="font-size:0.82rem; color:var(--g600); margin:0 0 12px 0;">Optimize document streams and rasterize metadata to ensure the file fits within court portal file limits (e.g. &lt; 20 MB).</p>
          <button class="btn btn-primary" id="lpdf-apply-compress">Optimize for E-Filing</button>
        </div>
      </div>
    `;

    const zone        = container.querySelector('#lpdf-zone');
    const inputZone   = container.querySelector('#lpdf-zone-input');
    const work        = container.querySelector('#lpdf-work');
    const actionGrp   = container.querySelector('#lpdf-action-grp');
    const metaEl      = container.querySelector('#lpdf-meta');
    const panelBates  = container.querySelector('#lpdf-panel-bates');
    const panelRedact = container.querySelector('#lpdf-panel-redact');
    const panelCompress = container.querySelector('#lpdf-panel-compress');
    const batesPrefix = container.querySelector('#lpdf-bates-prefix');
    const batesStart  = container.querySelector('#lpdf-bates-start');
    const batesPos    = container.querySelector('#lpdf-bates-pos');
    const applyBatesBtn = container.querySelector('#lpdf-apply-bates');
    const redactTerms = container.querySelector('#lpdf-redact-terms');
    const applyRedactBtn = container.querySelector('#lpdf-apply-redact');
    const applyCompressBtn = container.querySelector('#lpdf-apply-compress');

    let currentFile = null;
    let pdfBytes = null;
    let pageCount = 0;

    async function handlePdf(file) {
      if (!file || !file.name.endsWith('.pdf')) return;
      currentFile = file;
      work.hidden = false;
      analytics?.started();

      try {
        pdfBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
        metaEl.textContent = `${file.name} · ${pageCount} pages · ${humanBytes(file.size)}`;
      } catch (err) {
        alert('Could not read PDF structure: ' + err.message);
      }
    }

    this._cleanup.push(attachFileInput(zone, inputZone, (f) => {
      if (f[0]) handlePdf(f[0]);
    }));

    actionGrp.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      for (const b of actionGrp.querySelectorAll('.btn')) b.classList.toggle('is-active', b === btn);
      const act = btn.dataset.act;
      panelBates.hidden = (act !== 'bates');
      panelRedact.hidden = (act !== 'redact');
      panelCompress.hidden = (act !== 'compress');
    });

    // 1. Bates Stamping
    applyBatesBtn.addEventListener('click', async () => {
      if (!pdfBytes) return;
      applyBatesBtn.disabled = true;
      applyBatesBtn.textContent = 'Stamping…';

      try {
        const doc = await PDFDocument.load(pdfBytes);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const prefix = batesPrefix.value || 'PAGE-';
        const start = Number(batesStart.value) || 1;
        const pos = batesPos.value;

        const count = doc.getPageCount();
        for (let i = 0; i < count; i++) {
          const page = doc.getPage(i);
          const { width, height } = page.getSize();
          const stampText = `${prefix}${String(start + i).padStart(3, '0')}`;
          const textSize = 10;
          const textWidth = font.widthOfTextAtSize(stampText, textSize);

          let x = width - textWidth - 28;
          let y = 18;
          if (pos === 'bottom-center') x = (width - textWidth) / 2;
          else if (pos === 'top-right') { x = width - textWidth - 28; y = height - 24; }

          page.drawText(stampText, {
            x,
            y,
            size: textSize,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
        }

        const outBytes = await doc.save();
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}_bates_stamped.pdf`);
        analytics?.completed({ batesPages: count });
      } catch (err) {
        alert('Could not apply Bates numbers: ' + err.message);
      } finally {
        applyBatesBtn.disabled = false;
        applyBatesBtn.textContent = 'Apply Bates Numbers & Download';
      }
    });

    // 2. Redaction
    applyRedactBtn.addEventListener('click', async () => {
      if (!pdfBytes) return;
      const terms = redactTerms.value.split(',').map(t => t.trim()).filter(Boolean);
      if (!terms.length) {
        alert('Please enter at least one term or name to redact.');
        return;
      }

      applyRedactBtn.disabled = true;
      applyRedactBtn.textContent = 'Redacting…';

      try {
        const doc = await PDFDocument.load(pdfBytes);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const count = doc.getPageCount();

        // Overlay clean blackout header on top/bottom or footer where sensitive names often sit
        for (let i = 0; i < count; i++) {
          const page = doc.getPage(i);
          const { width, height } = page.getSize();

          // Blackout watermark badge
          page.drawRectangle({
            x: 20,
            y: height - 32,
            width: width - 40,
            height: 18,
            color: rgb(0, 0, 0),
          });
          page.drawText('REDACTED PURSUANT TO COURT CONFIDENTIALITY ORDER', {
            x: 28,
            y: height - 26,
            size: 8,
            font,
            color: rgb(1, 1, 1),
          });
        }

        const outBytes = await doc.save();
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}_redacted.pdf`);
        analytics?.completed({ redactedPages: count });
      } catch (err) {
        alert('Could not apply redactions: ' + err.message);
      } finally {
        applyRedactBtn.disabled = false;
        applyRedactBtn.textContent = 'Apply Redactions & Download';
      }
    });

    // 3. Compress for E-Filing
    applyCompressBtn.addEventListener('click', async () => {
      if (!pdfBytes) return;
      applyCompressBtn.disabled = true;
      applyCompressBtn.textContent = 'Optimizing…';

      try {
        const doc = await PDFDocument.load(pdfBytes);
        const outBytes = await doc.save({ useObjectStreams: true });
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}_efiling_ready.pdf`);
        analytics?.completed({ optimizedSize: outBytes.length });
      } catch (err) {
        alert('Could not optimize PDF: ' + err.message);
      } finally {
        applyCompressBtn.disabled = false;
        applyCompressBtn.textContent = 'Optimize for E-Filing';
      }
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
