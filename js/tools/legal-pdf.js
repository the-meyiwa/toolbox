/* ============================================================
   Legal PDF Bundle & Stamping — court bundle builder.

   Add pleadings, exhibits and correspondence (PDF, JPG, PNG),
   order them, and build one filing-ready PDF: an index with
   tabs, dates and page ranges (linked, with bookmarks), divider
   pages, continuous pagination, Bates numbers, CERTIFIED TRUE
   COPY and EXHIBIT stamps (with the affidavit jurat), true
   redaction (the page is re-rendered with the regions burnt in)
   and an e-filing size cap. Everything runs on this device.
   ============================================================ */

import { buildBundle, findTextRegions, exhibitLabel } from '../lib/legal/bundle.js';
import { loadPdfjs } from '../lib/legal/doc-text.js';
import { attachFileInput, downloadBlob, humanBytes } from '../lib/file-engine.js';
import { esc, icon, note, plural } from '../lib/legal/view.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';

const ID = 'legal-pdf';
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const POS = [['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-right', 'Top right'], ['top-center', 'Top centre']];
const opts = (list, v) => list.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
const sw = (id, on, label) => `<span class="lg-switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><i></i></span>`;
const field = (label, html, wide = false) => `<label class="lg-field${wide ? ' is-wide' : ''}"><span>${esc(label)}</span>${html}</label>`;

export default {
  render(container, { analytics } = {}) {
    this.cleanup = [];
    this.prefs = getToolSettings(ID);
    const P = this.prefs;
    container.innerHTML = `
      <div class="lg lg-bundle">
        <section class="lg-card lg-input">
          <div class="lg-source-head"><span class="lg-label">Documents</span><span class="lg-source-status" id="lp-status">PDF, JPG or PNG · in bundle order</span></div>
          <div class="lg-drop" id="lp-zone" role="button" tabindex="0" aria-label="Add documents">
            <input type="file" id="lp-zone-input" accept="${ACCEPT}" multiple hidden>
            <span class="lg-drop-icon">${icon('upload', 18)}</span>
            <span class="lg-drop-text"><strong>Add pleadings, exhibits and correspondence</strong><small>Drop several files at once · read on this device, never uploaded</small></span>
          </div>
          <ul class="lg-docs" id="lp-docs"></ul>
          <div class="lg-redact" id="lp-redact" hidden></div>
        </section>

        <section class="lg-card">
          <header class="lg-sec-head"><h3>Bundle settings</h3><span class="lg-sec-sub">Applied across the whole bundle</span></header>
          <div class="lg-set-grid">
            <div class="lg-set" data-set="index">
              <header><h4>Index &amp; cover</h4>${sw('lp-index', true, 'Index page')}</header>
              <div class="lg-fields">
                ${field('Court', '<input class="tool-input" id="lp-court" placeholder="In the High Court of Lagos State">', true)}
                ${field('Division', '<input class="tool-input" id="lp-division" placeholder="In the Ikeja Judicial Division">')}
                ${field('Suit / appeal no.', '<input class="tool-input" id="lp-suit" placeholder="ID/1234/2024">')}
                ${field('Parties (one per line; BETWEEN / AND on their own lines)', '<textarea class="tool-textarea" id="lp-parties" rows="4" placeholder="BETWEEN\nAdewale Okonkwo-Bello ........ Claimant\nAND\nSahel Trust Bank Plc ........ Defendant"></textarea>', true)}
                ${field('Index title', '<input class="tool-input" id="lp-title" value="INDEX TO BUNDLE OF DOCUMENTS">', true)}
                <label class="lg-toggle"><input type="checkbox" id="lp-dividers" checked> Divider page before each document</label>
                <label class="lg-toggle"><input type="checkbox" id="lp-bookmarks" checked> Bookmarks and index links</label>
              </div>
            </div>
            <div class="lg-set" data-set="pages">
              <header><h4>Page numbers</h4>${sw('lp-pn', true, 'Page numbers')}</header>
              <div class="lg-fields">
                ${field('Position', `<select class="tool-select" id="lp-pn-pos">${opts(POS, P.pagePosition)}</select>`)}
                ${field('Format', `<select class="tool-select" id="lp-pn-fmt">${opts([['n', '1, 2, 3'], ['of', 'Page 1 of 20'], ['dash', '- 1 -']], 'n')}</select>`)}
                ${field('Start at', '<input class="tool-input" id="lp-pn-start" type="number" min="1" value="1">')}
              </div>
              <header><h4>Bates numbers</h4>${sw('lp-bates', false, 'Bates numbers')}</header>
              <div class="lg-fields" id="lp-bates-fields">
                ${field('Prefix', '<input class="tool-input" id="lp-bates-prefix" placeholder="OKB-">')}
                ${field('Start', '<input class="tool-input" id="lp-bates-start" type="number" min="1" value="1">')}
                ${field('Digits', `<select class="tool-select" id="lp-bates-digits">${opts([['4', '4'], ['5', '5'], ['6', '6'], ['8', '8']], '6')}</select>`)}
                ${field('Position', `<select class="tool-select" id="lp-bates-pos">${opts(POS, 'bottom-right')}</select>`)}
              </div>
            </div>
            <div class="lg-set" data-set="stamps">
              <header><h4>Exhibits &amp; certified copies</h4></header>
              <div class="lg-fields">
                ${field('Exhibit marks', `<select class="tool-select" id="lp-ex-scheme">${opts([['letters', 'A, B, C'], ['numbers', '1, 2, 3'], ['initials', "Deponent's initials + number"]], P.exhibitScheme)}</select>`)}
                ${field('Initials', '<input class="tool-input" id="lp-ex-initials" placeholder="AOB" maxlength="5">')}
                ${field('Deponent (adds the jurat to each exhibit stamp)', '<input class="tool-input" id="lp-ex-deponent" placeholder="Adewale Okonkwo-Bello">', true)}
                ${field('CTC stamp text', '<input class="tool-input" id="lp-ctc-text" value="CERTIFIED TRUE COPY">')}
                ${field('Certifying officer', '<input class="tool-input" id="lp-ctc-officer" placeholder="Leave blank to sign by hand">')}
                ${field('CTC date', '<input class="tool-input" id="lp-ctc-date" placeholder="dd/mm/yyyy">')}
                ${field('Designation', '<input class="tool-input" id="lp-ctc-desig" placeholder="Registrar">')}
              </div>
            </div>
            <div class="lg-set" data-set="file">
              <header><h4>Redaction &amp; e-filing</h4></header>
              <div class="lg-fields">
                ${field('Redact these words everywhere (comma separated)', '<input class="tool-input" id="lp-terms" placeholder="account number, BVN, 08031234567">', true)}
                ${field('Redaction quality', `<select class="tool-select" id="lp-dpi">${opts([['110', 'Standard (110 dpi)'], ['150', 'High (150 dpi)'], ['200', 'Very high (200 dpi)']], '150')}</select>`)}
                ${field('Size cap (MB, 0 = none)', `<input class="tool-input" id="lp-cap" type="number" min="0" max="200" value="${Number(P.capMB) || 0}">`)}
                ${field('If over the cap', `<select class="tool-select" id="lp-compress">${opts([['auto', 'Compress to fit'], ['none', 'Keep as is and warn']], 'auto')}</select>`)}
                <label class="lg-toggle"><input type="checkbox" id="lp-gray"> Greyscale when compressing</label>
              </div>
            </div>
          </div>
        </section>

        <section class="lg-card">
          <div class="lg-bar">
            <div class="lg-bar-main"><button type="button" class="btn btn-primary" id="lp-build" disabled>Build bundle</button><span class="lg-source-status" id="lp-summary">Add documents to begin</span></div>
          </div>
          <div class="lg-progress" id="lp-progress" hidden><div class="lg-progress-bar"><i></i></div><span></span></div>
          <div id="lp-result" hidden></div>
        </section>
        ${note('Redacted pages are re-rendered as images so the hidden text is removed, not just covered; check each redacted page before filing. Stamps are placed in the margins; confirm they do not cover content.')}
      </div>`;
    const $ = (s) => container.querySelector(s);
    const docs = [];
    let editing = null;
    const pdfjsDocs = new Map();

    const getPdfjs = async (d) => {
      if (!pdfjsDocs.has(d)) {
        const lib = await loadPdfjs();
        pdfjsDocs.set(d, lib.getDocument({ data: d.bytes.slice() }).promise);
      }
      return pdfjsDocs.get(d);
    };

    const exhibitIndex = (i) => docs.slice(0, i).filter(d => d.exhibit).length;
    const renderDocs = () => {
      const scheme = $('#lp-ex-scheme').value, initials = $('#lp-ex-initials').value;
      $('#lp-docs').innerHTML = docs.map((d, i) => {
        const ex = d.exhibit ? exhibitLabel(exhibitIndex(i), scheme, initials) : null;
        const nRed = Object.values(d.redactions).reduce((s, r) => s + r.length, 0);
        return `<li class="lg-doc" data-i="${i}">
          <span class="lg-doc-tab" title="${ex ? `Exhibit ${ex}` : `Tab ${i + 1}`}">${esc(ex || String(i + 1))}</span>
          <div class="lg-doc-fields">
            <input class="tool-input" data-f="title" value="${esc(d.title)}" aria-label="Document title">
            <input class="tool-input" data-f="date" value="${esc(d.date)}" placeholder="Date" aria-label="Document date">
            <div class="lg-doc-meta"><span>${esc(d.name)} · ${plural(d.pages, 'page')} · ${humanBytes(d.bytes.length)}</span>
              <label class="lg-toggle"><input type="checkbox" data-f="exhibit" ${d.exhibit ? 'checked' : ''}> Exhibit</label>
              <label class="lg-toggle"><input type="checkbox" data-f="ctc" ${d.ctc ? 'checked' : ''}> CTC</label>
              <label class="lg-toggle"><input type="checkbox" data-f="divider" ${d.divider ? 'checked' : ''}> Divider</label>
              ${nRed ? `<span>${plural(nRed, 'redaction')}</span>` : ''}</div>
          </div>
          <div class="lg-doc-actions">
            <button type="button" class="btn btn-icon btn-sm" data-a="up" ${i ? '' : 'disabled'} aria-label="Move up">${icon('up', 16)}</button>
            <button type="button" class="btn btn-icon btn-sm" data-a="down" ${i < docs.length - 1 ? '' : 'disabled'} aria-label="Move down">${icon('down', 16)}</button>
            ${d.kind === 'pdf' ? `<button type="button" class="btn btn-icon btn-sm${editing === d ? ' is-on' : ''}" data-a="redact" title="Mark areas to redact" aria-label="Redact">${icon('redact', 16)}</button>` : ''}
            <button type="button" class="btn btn-icon btn-sm" data-a="remove" aria-label="Remove">${icon('trash', 16)}</button>
          </div></li>`;
      }).join('');
      const total = docs.reduce((s, d) => s + d.pages, 0);
      $('#lp-summary').textContent = docs.length ? `${plural(docs.length, 'document')} · ${plural(total, 'page')} · ${humanBytes(docs.reduce((s, d) => s + d.bytes.length, 0))}` : 'Add documents to begin';
      $('#lp-build').disabled = !docs.length;
    };

    const addFiles = async (files) => {
      const status = $('#lp-status');
      for (const f of files) {
        status.textContent = `Reading ${f.name}…`;
        const bytes = new Uint8Array(await f.arrayBuffer());
        const isImg = /^image\//.test(f.type) || /\.(jpe?g|png)$/i.test(f.name);
        let pages = 1;
        if (!isImg) {
          try {
            const { PDFDocument } = await import('pdf-lib');
            pages = (await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
          } catch (err) { status.textContent = `${f.name}: not a readable PDF (${err.message})`; continue; }
        }
        const title = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
        docs.push({ name: f.name, title: title.charAt(0).toUpperCase() + title.slice(1), date: '', kind: isImg ? 'image' : 'pdf', mime: f.type, bytes, pages, exhibit: false, ctc: false, divider: true, redactions: {} });
      }
      status.textContent = 'PDF, JPG or PNG · in bundle order';
      renderDocs();
    };
    this.cleanup.push(attachFileInput($('#lp-zone'), $('#lp-zone-input'), addFiles, { accept: ACCEPT }));

    /* ---- redaction editor ---- */
    const openRedact = async (d) => {
      const box = $('#lp-redact');
      if (editing === d) { editing = null; box.hidden = true; renderDocs(); return; }
      editing = d;
      renderDocs();
      box.hidden = false;
      box.innerHTML = `<div class="lg-redact-bar"><span class="lg-label">Redact: ${esc(d.title)}</span><span class="lg-source-status">Drag across text to black it out · click a box to remove it</span></div><div class="lg-redact-pages" id="lp-pages"></div>`;
      const wrap = box.querySelector('#lp-pages');
      const pdf = await getPdfjs(d);
      for (let n = 0; n < pdf.numPages && n < 60; n++) {
        if (editing !== d) return;
        const page = await pdf.getPage(n + 1);
        const vp0 = page.getViewport({ scale: 1 });
        const scale = 220 / vp0.width;
        const vp = page.getViewport({ scale: scale * 2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.width = `${vp.width / 2}px`; canvas.style.height = `${vp.height / 2}px`;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const pg = document.createElement('div');
        pg.className = 'lg-redact-page';
        pg.dataset.page = n;
        pg.append(canvas);
        pg.insertAdjacentHTML('beforeend', `<em>${n + 1}</em>`);
        wrap.append(pg);
        drawRects(pg, d, n);
      }
    };
    const drawRects = (pg, d, n) => {
      pg.querySelectorAll('b').forEach(b => b.remove());
      (d.redactions[n] || []).forEach((r, k) => {
        const b = document.createElement('b');
        b.dataset.k = k;
        b.title = 'Click to remove';
        Object.assign(b.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
        pg.append(b);
      });
    };
    let drag = null;
    const onDown = (e) => {
      const pg = e.target.closest('.lg-redact-page');
      if (!pg || !editing) return;
      const n = Number(pg.dataset.page);
      if (e.target.tagName === 'B') { editing.redactions[n].splice(Number(e.target.dataset.k), 1); drawRects(pg, editing, n); renderDocs(); return; }
      const rect = pg.getBoundingClientRect();
      drag = { pg, n, rect, x0: (e.clientX - rect.left) / rect.width, y0: (e.clientY - rect.top) / rect.height, el: document.createElement('b') };
      pg.append(drag.el);
      pg.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!drag) return;
      const x = Math.min(1, Math.max(0, (e.clientX - drag.rect.left) / drag.rect.width)), y = Math.min(1, Math.max(0, (e.clientY - drag.rect.top) / drag.rect.height));
      drag.box = { x: Math.min(x, drag.x0), y: Math.min(y, drag.y0), w: Math.abs(x - drag.x0), h: Math.abs(y - drag.y0) };
      Object.assign(drag.el.style, { left: `${drag.box.x * 100}%`, top: `${drag.box.y * 100}%`, width: `${drag.box.w * 100}%`, height: `${drag.box.h * 100}%` });
    };
    const onUp = () => {
      if (!drag) return;
      const { pg, n, box } = drag;
      drag.el.remove();
      drag = null;
      if (box && box.w > 0.01 && box.h > 0.005) { (editing.redactions[n] ||= []).push(box); renderDocs(); }
      drawRects(pg, editing, n);
    };
    const red = $('#lp-redact');
    red.addEventListener('pointerdown', onDown);
    red.addEventListener('pointermove', onMove);
    red.addEventListener('pointerup', onUp);

    /* ---- list events ---- */
    $('#lp-docs').addEventListener('input', (e) => {
      const li = e.target.closest('[data-i]'); const f = e.target.dataset.f;
      if (li && (f === 'title' || f === 'date')) docs[li.dataset.i][f] = e.target.value;
    });
    $('#lp-docs').addEventListener('change', (e) => {
      const li = e.target.closest('[data-i]'); const f = e.target.dataset.f;
      if (li && ['exhibit', 'ctc', 'divider'].includes(f)) { docs[li.dataset.i][f] = e.target.checked; renderDocs(); }
    });
    $('#lp-docs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const i = Number(b.closest('[data-i]').dataset.i);
      const a = b.dataset.a;
      if (a === 'up' && i > 0) [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]];
      if (a === 'down' && i < docs.length - 1) [docs[i + 1], docs[i]] = [docs[i], docs[i + 1]];
      if (a === 'remove') { const [d] = docs.splice(i, 1); if (editing === d) { editing = null; $('#lp-redact').hidden = true; } pdfjsDocs.delete(d); }
      if (a === 'redact') { openRedact(docs[i]); return; }
      renderDocs();
    });
    for (const id of ['#lp-ex-scheme', '#lp-ex-initials']) $(id).addEventListener('input', renderDocs);
    const syncSets = () => {
      container.querySelector('[data-set="index"]').dataset.off = String(!$('#lp-index').checked);
      $('#lp-bates-fields').classList.toggle('is-off', !$('#lp-bates').checked);
      container.querySelector('[data-set="pages"] .lg-fields').classList.toggle('is-off', !$('#lp-pn').checked);
    };
    for (const id of ['#lp-index', '#lp-bates', '#lp-pn']) $(id).addEventListener('change', syncSets);
    syncSets();

    /* ---- raster for redaction / compression ---- */
    const raster = async ({ doc, pageIndex, rects, dpi, quality, grayscale }) => {
      const pdf = await getPdfjs(doc);
      const page = await pdf.getPage(pageIndex + 1);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(dpi / 72, 4000 / Math.max(vp1.width, vp1.height));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      ctx.fillStyle = '#000';
      for (const r of rects) ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
      if (grayscale) {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const px = img.data;
        for (let i = 0; i < px.length; i += 4) { const g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114; px[i] = px[i + 1] = px[i + 2] = g; }
        ctx.putImageData(img, 0, 0);
      }
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality ?? 0.85));
      canvas.width = canvas.height = 0;
      page.cleanup?.();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width: vp1.width, height: vp1.height };
    };

    /* ---- build ---- */
    let lastUrl = null;
    $('#lp-build').addEventListener('click', async () => {
      const btn = $('#lp-build'), prog = $('#lp-progress'), res = $('#lp-result');
      btn.disabled = true; prog.hidden = false; res.hidden = true;
      const bar = prog.querySelector('i'), label = prog.querySelector('span');
      const setP = (frac, msg) => { bar.style.width = `${Math.round(frac * 100)}%`; label.textContent = msg; };
      analytics?.started?.();
      try {
        const terms = $('#lp-terms').value.split(',').map(s => s.trim()).filter(Boolean);
        const input = [];
        for (let i = 0; i < docs.length; i++) {
          const d = docs[i];
          const redactions = {};
          for (const [k, v] of Object.entries(d.redactions)) redactions[k] = [...v];
          if (terms.length && d.kind === 'pdf') {
            setP(0.02, `Searching ${d.name} for words to redact`);
            const found = await findTextRegions(await getPdfjs(d), terms);
            for (const [k, v] of Object.entries(found)) (redactions[k] ||= []).push(...v);
          }
          input.push({ ...d, redactions });
        }
        const out = await buildBundle(input, {
          title: $('#lp-title').value.trim() || 'INDEX', court: $('#lp-court').value.trim(), division: $('#lp-division').value.trim(), suitNo: $('#lp-suit').value.trim(), parties: $('#lp-parties').value,
          index: $('#lp-index').checked, dividers: $('#lp-dividers').checked, bookmarks: $('#lp-bookmarks').checked,
          pageNumbers: { on: $('#lp-pn').checked, position: $('#lp-pn-pos').value, format: $('#lp-pn-fmt').value, start: Number($('#lp-pn-start').value) || 1 },
          bates: { on: $('#lp-bates').checked, prefix: $('#lp-bates-prefix').value, start: Number($('#lp-bates-start').value) || 1, digits: Number($('#lp-bates-digits').value), position: $('#lp-bates-pos').value },
          exhibits: { scheme: $('#lp-ex-scheme').value, initials: $('#lp-ex-initials').value, deponent: $('#lp-ex-deponent').value.trim() },
          ctc: { text: $('#lp-ctc-text').value.trim() || 'CERTIFIED TRUE COPY', officer: $('#lp-ctc-officer').value.trim(), date: $('#lp-ctc-date').value.trim(), designation: $('#lp-ctc-desig').value.trim() },
          redaction: { dpi: Number($('#lp-dpi').value) },
          efiling: { capMB: Number($('#lp-cap').value) || 0, compress: $('#lp-compress').value, grayscale: $('#lp-gray').checked },
        }, { raster, onProgress: (p) => setP(p.phase === 'pages' ? 0.05 + 0.85 * (p.done / p.total) : p.phase === 'save' ? 0.95 : p.phase === 'compress' ? 0.5 : 0.03, p.message) });
        setP(1, 'Done');
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        const blob = new Blob([out.bytes], { type: 'application/pdf' });
        lastUrl = URL.createObjectURL(blob);
        const name = `${($('#lp-suit').value.trim() || 'court-bundle').replace(/[^a-z0-9]+/gi, '-')}-bundle.pdf`;
        res.innerHTML = `<div class="lg-result"><div><strong>${esc(name)}</strong><span>${plural(out.pages, 'page')} · ${humanBytes(out.size)}${out.compressed ? ` · compressed at ${out.compressed.dpi} dpi` : ''}${out.overCap ? ' · over the size cap' : ''}</span></div>
          <div class="lg-bar-main"><a class="btn btn-secondary btn-sm" href="${lastUrl}" target="_blank" rel="noopener">${icon('ext', 14)}<span>Open</span></a><button type="button" class="btn btn-primary btn-sm" id="lp-dl">${icon('download', 14)}<span>Download</span></button></div></div>
          ${out.warnings.length ? `<ul class="lg-warns">${out.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
        res.hidden = false;
        res.querySelector('#lp-dl').addEventListener('click', () => { downloadBlob(blob, name); analytics?.downloaded?.({ fileCount: 1 }); });
        this._last = { size: out.size, pages: out.pages };
        analytics?.completed?.({ pages: out.pages });
      } catch (err) {
        label.textContent = `Could not build the bundle: ${err.message}`;
      } finally {
        btn.disabled = !docs.length;
        setTimeout(() => { if (!res.hidden) prog.hidden = true; }, 600);
      }
    });
    this.cleanup.push(onToolSettings(ID, (p) => { this.prefs = p; }));
    this.cleanup.push(() => { if (lastUrl) URL.revokeObjectURL(lastUrl); for (const p of pdfjsDocs.values()) p.then(d => d.destroy?.()).catch(() => {}); });
    renderDocs();
  },

  destroy() {
    for (const fn of this.cleanup || []) { try { fn(); } catch { /* ignore */ } }
    this.cleanup = [];
  },
};
