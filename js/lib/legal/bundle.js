/* ============================================================
   Legal engine — court bundle builder

   Builds one PDF from many documents, on-device, with pdf-lib:
   · an index (table of contents) with tab numbers, dates and
     page ranges, linked to each document, plus PDF bookmarks
   · optional divider (tab) pages
   · continuous pagination and/or Bates numbers (prefix, start,
     digits, position), placed correctly on rotated pages
   · "CERTIFIED TRUE COPY" and "EXHIBIT A" stamps (letters,
     numbers or deponent's initials, with the affidavit jurat)
   · redaction: marked regions are burnt into a raster of the
     page, so the text under them is gone, not just covered
   · e-filing size cap: pages are re-rendered as JPEG at lower
     resolution until the file fits (or the best effort is shown)

   Rasterising needs pdf.js and a canvas, so the caller passes a
   `raster` function; without it, redaction and compression are
   skipped and reported.
   ============================================================ */

import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFHexString, PDFNumber } from 'pdf-lib';

export const A4 = [595.28, 841.89];
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.72, 0.72, 0.72);

/** Standard PDF fonts only speak WinAnsi: replace what they cannot draw. */
export function safe(s) {
  return String(s ?? '')
    .replace(/₦/g, 'N').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export const toRoman = (n) => {
  const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
};

/** "A".."Z", "AA".. for letters; numbers; or initials + number ("OA1"). */
export function exhibitLabel(i, scheme = 'letters', initials = '', start = 1) {
  const n = i + Number(start || 1);
  if (scheme === 'numbers') return String(n);
  if (scheme === 'initials') return `${String(initials || '').toUpperCase().replace(/[^A-Z]/g, '')}${n}`;
  let s = '', k = n;
  while (k > 0) { const r = (k - 1) % 26; s = String.fromCharCode(65 + r) + s; k = Math.floor((k - 1) / 26); }
  return s;
}

export const batesLabel = (n, prefix = '', digits = 6) => `${prefix}${String(n).padStart(Math.max(1, Math.min(10, Number(digits) || 6)), '0')}`;

/* ---------------- geometry on rotated pages ---------------- */

/** Visual page size and a mapper from visual coordinates (origin bottom-left as seen) to user space. */
function frame(page) {
  const { width: W, height: H, x: ox = 0, y: oy = 0 } = page.getMediaBox ? page.getMediaBox() : { ...page.getSize(), x: 0, y: 0 };
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const vw = rot === 90 || rot === 270 ? H : W;
  const vh = rot === 90 || rot === 270 ? W : H;
  const map = (vx, vy) => {
    if (rot === 90) return { x: ox + W - vy, y: oy + vx };
    if (rot === 180) return { x: ox + W - vx, y: oy + H - vy };
    if (rot === 270) return { x: ox + vy, y: oy + H - vx };
    return { x: ox + vx, y: oy + vy };
  };
  return { vw, vh, rot, map };
}

function drawTextV(page, text, vx, vy, opts) {
  const f = frame(page);
  const p = f.map(vx, vy);
  page.drawText(safe(text), { ...opts, x: p.x, y: p.y, rotate: degrees(f.rot) });
}

function drawRectV(page, vx, vy, w, h, opts) {
  const f = frame(page);
  // Map the rectangle's origin corner; pdf-lib rotates around it.
  const p = f.map(vx, vy);
  page.drawRectangle({ ...opts, x: p.x, y: p.y, width: w, height: h, rotate: degrees(f.rot) });
}

function place(position, vw, vh, tw, th, margin = 22) {
  const [v, h] = String(position || 'bottom-right').split('-');
  const x = h === 'left' ? margin : h === 'center' ? (vw - tw) / 2 : vw - tw - margin;
  const y = v === 'top' ? vh - margin - th : margin;
  return { x, y };
}

function wrap(text, font, size, width) {
  const words = safe(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------------- stamps ---------------- */

function stampExhibit(page, fonts, label, opts) {
  const f = frame(page);
  const lines = [`EXHIBIT "${label}"`];
  const small = [];
  if (opts.deponent) {
    small.push(`referred to in the affidavit of ${opts.deponent}`, 'sworn before me this ____ day of __________ 20__', '', '____________________________', 'COMMISSIONER FOR OATHS');
  }
  const w = Math.max(fonts.bold.widthOfTextAtSize(safe(lines[0]), 12), ...small.map(s => fonts.reg.widthOfTextAtSize(safe(s), 7))) + 16;
  const h = 22 + small.length * 9;
  const x = f.vw - w - 18, y = f.vh - h - 18;
  drawRectV(page, x, y, w, h, { color: rgb(1, 1, 1), opacity: 0.94, borderColor: INK, borderWidth: 1.2 });
  drawTextV(page, lines[0], x + 8, y + h - 16, { size: 12, font: fonts.bold, color: INK });
  small.forEach((s, i) => drawTextV(page, s, x + 8, y + h - 28 - i * 9, { size: 7, font: fonts.reg, color: INK }));
}

function stampCTC(page, fonts, opts) {
  const f = frame(page);
  const title = safe(opts.text || 'CERTIFIED TRUE COPY');
  const rows = [`Name: ${opts.officer ? safe(opts.officer) : '______________________'}`, 'Signature: _________________', `Date: ${opts.date ? safe(opts.date) : '____/____/________'}`];
  if (opts.designation) rows.push(safe(opts.designation));
  const w = Math.max(fonts.bold.widthOfTextAtSize(title, 10.5), ...rows.map(r => fonts.reg.widthOfTextAtSize(r, 7.5))) + 18;
  const h = 20 + rows.length * 10;
  // Bottom-left, above the footer line, where pleadings and letters rarely carry text.
  const x = 18, y = opts.position === 'top-left' ? f.vh - h - 18 : 40;
  drawRectV(page, x, y, w, h, { color: rgb(1, 1, 1), opacity: 0.94, borderColor: INK, borderWidth: 1.4 });
  drawRectV(page, x + 3, y + 3, w - 6, h - 6, { borderColor: INK, borderWidth: 0.5 });
  drawTextV(page, title, x + 9, y + h - 15, { size: 10.5, font: fonts.bold, color: INK });
  rows.forEach((r, i) => drawTextV(page, r, x + 9, y + h - 27 - i * 10, { size: 7.5, font: fonts.reg, color: INK }));
}

function stampFooter(page, fonts, { pageLabel, bates, pagePos, batesPos }) {
  const f = frame(page);
  const size = 9;
  if (pageLabel) {
    const tw = fonts.reg.widthOfTextAtSize(safe(pageLabel), size);
    const p = place(pagePos, f.vw, f.vh, tw, size);
    drawRectV(page, p.x - 3, p.y - 3, tw + 6, size + 5, { color: rgb(1, 1, 1), opacity: 0.85 });
    drawTextV(page, pageLabel, p.x, p.y, { size, font: fonts.reg, color: INK });
  }
  if (bates) {
    const tw = fonts.bold.widthOfTextAtSize(safe(bates), size);
    const same = batesPos === pagePos && pageLabel;
    const p = place(batesPos, f.vw, f.vh, tw, size, same ? 36 : 22);
    drawRectV(page, p.x - 3, p.y - 3, tw + 6, size + 5, { color: rgb(1, 1, 1), opacity: 0.85 });
    drawTextV(page, bates, p.x, p.y, { size, font: fonts.bold, color: INK });
  }
}

/* ---------------- index & dividers ---------------- */

const ROWS_FIRST = 18, ROWS_NEXT = 26;
export function indexPageCount(n) { return n <= ROWS_FIRST ? 1 : 1 + Math.ceil((n - ROWS_FIRST) / ROWS_NEXT); }

function drawIndexHeader(page, fonts, o) {
  const [W, H] = [page.getWidth(), page.getHeight()];
  let y = H - 64;
  const center = (t, size, font, dy = 0) => { const s = safe(t); page.drawText(s, { x: (W - font.widthOfTextAtSize(s, size)) / 2, y: y - dy, size, font, color: INK }); };
  if (o.court) { for (const line of wrap(o.court.toUpperCase(), fonts.tbold, 12, W - 140)) { center(line, 12, fonts.tbold); y -= 16; } }
  if (o.division) { center(o.division.toUpperCase(), 10.5, fonts.treg); y -= 16; }
  if (o.suitNo) { const s = safe(o.suitNo); page.drawText(s, { x: W - 60 - fonts.tbold.widthOfTextAtSize(s, 10.5), y: y - 4, size: 10.5, font: fonts.tbold, color: INK }); y -= 20; }
  if (o.parties) {
    y -= 4;
    for (const raw of String(o.parties).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8)) {
      if (/^(between|and)$/i.test(raw)) { page.drawText(safe(raw.toUpperCase()), { x: 60, y, size: 10, font: fonts.tbold, color: INK }); y -= 14; continue; }
      for (const line of wrap(raw, fonts.treg, 10.5, W - 160)) { page.drawText(line, { x: 110, y, size: 10.5, font: fonts.treg, color: INK }); y -= 14; }
    }
  }
  y -= 14;
  center(o.title || 'INDEX', 13, fonts.tbold); y -= 6;
  const tw = fonts.tbold.widthOfTextAtSize(safe(o.title || 'INDEX'), 13);
  page.drawLine({ start: { x: (W - tw) / 2, y: y - 2 }, end: { x: (W + tw) / 2, y: y - 2 }, thickness: 0.8, color: INK });
  return y - 22;
}

function drawIndexTable(page, fonts, rows, top, isFirst) {
  const W = page.getWidth();
  const L = 50, R = W - 50;
  const cols = [{ k: 'tab', w: 50, t: 'TAB' }, { k: 'desc', w: R - L - 50 - 90 - 70, t: 'DESCRIPTION OF DOCUMENT' }, { k: 'date', w: 90, t: 'DATE' }, { k: 'pages', w: 70, t: 'PAGE(S)' }];
  let y = top;
  let x = L;
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 20, color: rgb(0.93, 0.93, 0.93) });
  for (const c of cols) { page.drawText(c.t, { x: x + 6, y, size: 8.5, font: fonts.bold, color: INK }); x += c.w; }
  y -= 12;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.8, color: INK });
  const links = [];
  for (const r of rows) {
    const lines = wrap(r.desc, fonts.treg, 10, cols[1].w - 12).slice(0, 3);
    const h = Math.max(22, 10 + lines.length * 12);
    const rowTop = y;
    x = L;
    page.drawText(safe(r.tab), { x: x + 6, y: rowTop - 15, size: 10, font: fonts.tbold, color: INK });
    x += cols[0].w;
    lines.forEach((ln, i) => page.drawText(ln, { x: x + 6, y: rowTop - 15 - i * 12, size: 10, font: fonts.treg, color: INK }));
    x += cols[1].w;
    page.drawText(safe(r.date || ''), { x: x + 6, y: rowTop - 15, size: 9.5, font: fonts.treg, color: INK });
    x += cols[2].w;
    page.drawText(safe(r.pages), { x: x + 6, y: rowTop - 15, size: 10, font: fonts.treg, color: INK });
    y -= h;
    page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.4, color: RULE });
    links.push({ rect: [L, y, R, rowTop], target: r.target });
  }
  // Vertical rules.
  x = L;
  for (let i = 0; i <= cols.length; i++) { page.drawLine({ start: { x, y: top + 14 }, end: { x, y }, thickness: 0.4, color: RULE }); x += cols[i]?.w || 0; }
  return links;
}

function drawDivider(page, fonts, { tab, exhibit, title, date, bundleTitle }) {
  const [W, H] = [page.getWidth(), page.getHeight()];
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: INK, borderWidth: 1 });
  const big = safe(exhibit ? `EXHIBIT "${exhibit}"` : `TAB ${tab}`);
  const size = 34;
  page.drawText(big, { x: (W - fonts.tbold.widthOfTextAtSize(big, size)) / 2, y: H / 2 + 40, size, font: fonts.tbold, color: INK });
  let y = H / 2 - 4;
  for (const line of wrap(title, fonts.treg, 15, W - 160).slice(0, 4)) { page.drawText(line, { x: (W - fonts.treg.widthOfTextAtSize(line, 15)) / 2, y, size: 15, font: fonts.treg, color: INK }); y -= 20; }
  if (date) { const d = safe(date); page.drawText(d, { x: (W - fonts.treg.widthOfTextAtSize(d, 11)) / 2, y: y - 6, size: 11, font: fonts.treg, color: MUTED }); }
  if (bundleTitle) { const t = safe(bundleTitle).toUpperCase(); page.drawText(t, { x: (W - fonts.reg.widthOfTextAtSize(t, 8)) / 2, y: 52, size: 8, font: fonts.reg, color: MUTED }); }
}

/* ---------------- outline & links ---------------- */

function addLink(pdf, page, rect, targetRef) {
  const ctx = pdf.context;
  const annot = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect.map(n => PDFNumber.of(n)), Border: [0, 0, 0], Dest: [targetRef, PDFName.of('Fit')] });
  page.node.addAnnot(ctx.register(annot));
}

function addOutline(pdf, items) {
  if (!items.length) return;
  const ctx = pdf.context;
  const rootRef = ctx.nextRef();
  const refs = items.map(() => ctx.nextRef());
  items.forEach((it, i) => {
    const d = { Title: PDFHexString.fromText(it.title), Parent: rootRef, Dest: [it.ref, PDFName.of('Fit')] };
    if (i > 0) d.Prev = refs[i - 1];
    if (i < items.length - 1) d.Next = refs[i + 1];
    ctx.assign(refs[i], ctx.obj(d));
  });
  ctx.assign(rootRef, ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: items.length }));
  pdf.catalog.set(PDFName.of('Outlines'), rootRef);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

/* ---------------- build ---------------- */

const yieldTick = () => new Promise(r => setTimeout(r, 0));

/**
 * docs: [{ name, title, date, kind: 'pdf'|'image', bytes: Uint8Array, mime, divider, exhibit, ctc, redactions: { [pageIndex]: [{x,y,w,h}] (fractions, top-left origin) } }]
 * options: see DEFAULT_OPTIONS.
 * raster: async ({ doc, docIndex, pageIndex, rects, dpi, quality, grayscale }) => { bytes: Uint8Array (JPEG), width, height } in points
 */
export const DEFAULT_OPTIONS = {
  title: 'INDEX', court: '', division: '', suitNo: '', parties: '',
  index: true, dividers: true, bookmarks: true,
  pageNumbers: { on: true, position: 'bottom-center', format: 'n', start: 1 },
  bates: { on: false, prefix: '', start: 1, digits: 6, position: 'bottom-right' },
  exhibits: { scheme: 'letters', initials: '', start: 1, deponent: '' },
  ctc: { text: 'CERTIFIED TRUE COPY', officer: '', date: '', designation: '' },
  redaction: { dpi: 150 },
  efiling: { capMB: 0, compress: 'auto', grayscale: false },
};

export async function buildBundle(docs, options = {}, { raster = null, onProgress = () => {} } = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options, pageNumbers: { ...DEFAULT_OPTIONS.pageNumbers, ...options.pageNumbers }, bates: { ...DEFAULT_OPTIONS.bates, ...options.bates }, exhibits: { ...DEFAULT_OPTIONS.exhibits, ...options.exhibits }, ctc: { ...DEFAULT_OPTIONS.ctc, ...options.ctc }, redaction: { ...DEFAULT_OPTIONS.redaction, ...options.redaction }, efiling: { ...DEFAULT_OPTIONS.efiling, ...options.efiling } };
  const warnings = [];
  onProgress({ phase: 'read', done: 0, total: docs.length, message: 'Reading documents' });
  const sources = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    if (d.kind === 'image') { sources.push({ doc: null, count: 1 }); continue; }
    try {
      const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true, updateMetadata: false });
      sources.push({ doc: src, count: src.getPageCount() });
    } catch (err) {
      throw new Error(`${d.name}: ${err.message || 'could not be read as a PDF'}`);
    }
    onProgress({ phase: 'read', done: i + 1, total: docs.length, message: `Read ${d.name}` });
  }

  const attempt = async (rasterAll) => {
    const pdf = await PDFDocument.create();
    const fonts = {
      reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      treg: await pdf.embedFont(StandardFonts.TimesRoman), tbold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    };
    pdf.setTitle(safe(o.title && o.title !== 'INDEX' ? o.title : (o.suitNo ? `Bundle ${o.suitNo}` : 'Court bundle')));
    pdf.setProducer('Toolbox Legal PDF (on-device)');
    pdf.setCreator('Toolbox');

    // Layout first so the index can state page ranges.
    const exhibitIdx = { n: 0 };
    const layout = [];
    let pageNo = Number(o.pageNumbers.start) || 1;
    docs.forEach((d, i) => {
      const count = sources[i].count;
      const tab = String(i + 1);
      const exhibit = d.exhibit ? exhibitLabel(exhibitIdx.n++, o.exhibits.scheme, o.exhibits.initials, o.exhibits.start) : null;
      const divider = o.dividers && d.divider !== false;
      const first = pageNo;
      pageNo += count + (divider ? 1 : 0);
      layout.push({ tab, exhibit, divider, first, last: pageNo - 1, count });
    });
    const totalPages = pageNo - (Number(o.pageNumbers.start) || 1);
    const nIndex = o.index ? indexPageCount(docs.length) : 0;
    const indexPages = [];
    for (let k = 0; k < nIndex; k++) indexPages.push(pdf.addPage(A4));

    const outline = [];
    let seq = 0; // running bundle page (for labels)
    let batesN = Number(o.bates.start) || 1;
    const label = (n) => (o.pageNumbers.format === 'of' ? `Page ${n} of ${totalPages + (Number(o.pageNumbers.start) || 1) - 1}` : o.pageNumbers.format === 'dash' ? `- ${n} -` : String(n));
    const stampNumbers = (page) => {
      const n = (Number(o.pageNumbers.start) || 1) + seq;
      seq++;
      stampFooter(page, fonts, { pageLabel: o.pageNumbers.on ? label(n) : null, bates: o.bates.on ? batesLabel(batesN++, o.bates.prefix, o.bates.digits) : null, pagePos: o.pageNumbers.position, batesPos: o.bates.position });
    };
    const targets = [];
    let rendered = 0;
    const totalWork = layout.reduce((s, l) => s + l.count, 0);

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i], L = layout[i], src = sources[i];
      let firstRef = null;
      if (L.divider) {
        const dp = pdf.addPage(A4);
        drawDivider(dp, fonts, { tab: L.tab, exhibit: L.exhibit, title: d.title || d.name, date: d.date, bundleTitle: o.suitNo || '' });
        stampNumbers(dp);
        firstRef = dp.ref;
      }
      for (let p = 0; p < L.count; p++) {
        const rects = d.redactions?.[p] || [];
        let page;
        if (d.kind === 'image') {
          const img = /png/i.test(d.mime || d.name) ? await pdf.embedPng(d.bytes) : await pdf.embedJpg(d.bytes);
          const [W, H] = A4;
          const scale = Math.min((W - 72) / img.width, (H - 96) / img.height, 1.5);
          page = pdf.addPage(A4);
          page.drawImage(img, { x: (W - img.width * scale) / 2, y: (H - img.height * scale) / 2, width: img.width * scale, height: img.height * scale });
          if (rects.length) {
            for (const r of rects) page.drawRectangle({ x: (W - img.width * scale) / 2 + r.x * img.width * scale, y: (H + img.height * scale) / 2 - (r.y + r.h) * img.height * scale, width: r.w * img.width * scale, height: r.h * img.height * scale, color: rgb(0, 0, 0) });
            warnings.push(`${d.name}: image redaction is drawn over the picture; the original pixels are not embedded separately.`);
          }
        } else if ((rects.length || rasterAll) && raster) {
          const q = rasterAll || { dpi: o.redaction.dpi, quality: 0.85, grayscale: o.efiling.grayscale };
          const r = await raster({ doc: d, docIndex: i, pageIndex: p, rects, dpi: rects.length ? Math.max(q.dpi, 110) : q.dpi, quality: q.quality, grayscale: q.grayscale });
          const img = await pdf.embedJpg(r.bytes);
          page = pdf.addPage([r.width, r.height]);
          page.drawImage(img, { x: 0, y: 0, width: r.width, height: r.height });
        } else {
          if (rects.length && !raster) warnings.push(`${d.name}, page ${p + 1}: redaction needs the page renderer and was not applied.`);
          const [copied] = await pdf.copyPages(src.doc, [p]);
          page = pdf.addPage(copied);
        }
        if (p === 0 && L.exhibit) stampExhibit(page, fonts, L.exhibit, { deponent: o.exhibits.deponent });
        if (d.ctc) stampCTC(page, fonts, o.ctc);
        stampNumbers(page);
        if (!firstRef) firstRef = page.ref;
        rendered++;
        if (rendered % 4 === 0 || rendered === totalWork) { onProgress({ phase: 'pages', done: rendered, total: totalWork, message: `Page ${rendered} of ${totalWork}` }); await yieldTick(); }
      }
      targets.push(firstRef);
      outline.push({ title: `${L.exhibit ? `Exhibit ${L.exhibit}` : `Tab ${L.tab}`}: ${safe(d.title || d.name)}`, ref: firstRef });
    }

    if (o.index) {
      const rows = docs.map((d, i) => ({ tab: layout[i].exhibit ? `${layout[i].tab} (${layout[i].exhibit})` : layout[i].tab, desc: d.title || d.name, date: d.date || '', pages: layout[i].first === layout[i].last ? String(layout[i].first) : `${layout[i].first} - ${layout[i].last}`, target: targets[i] }));
      let r0 = 0;
      indexPages.forEach((pg, k) => {
        const top = k === 0 ? drawIndexHeader(pg, fonts, o) : pg.getHeight() - 64;
        const take = k === 0 ? ROWS_FIRST : ROWS_NEXT;
        const links = drawIndexTable(pg, fonts, rows.slice(r0, r0 + take), top, k === 0);
        r0 += take;
        for (const l of links) addLink(pdf, pg, l.rect, l.target);
        if (o.pageNumbers.on) { const s = toRoman(k + 1); pg.drawText(s, { x: (pg.getWidth() - fonts.reg.widthOfTextAtSize(s, 9)) / 2, y: 22, size: 9, font: fonts.reg, color: INK }); }
      });
      if (o.bookmarks) outline.unshift({ title: 'Index', ref: indexPages[0].ref });
    }
    if (o.bookmarks) addOutline(pdf, outline);
    onProgress({ phase: 'save', done: 0, total: 1, message: 'Saving' });
    const bytes = await pdf.save({ useObjectStreams: true });
    return { bytes, layout, pages: pdf.getPageCount(), totalPages };
  };

  let result = await attempt(null);
  const capBytes = (Number(o.efiling.capMB) || 0) * 1024 * 1024;
  let compressed = null;
  if (capBytes && result.bytes.length > capBytes && o.efiling.compress !== 'none') {
    if (!raster) warnings.push('The bundle is over the size cap, but pages could not be re-rendered here to compress it.');
    else {
      const ladder = [{ dpi: 150, quality: 0.72 }, { dpi: 120, quality: 0.62 }, { dpi: 96, quality: 0.55 }, { dpi: 80, quality: 0.5 }];
      for (const step of ladder) {
        onProgress({ phase: 'compress', done: 0, total: 1, message: `Compressing at ${step.dpi} dpi` });
        const r = await attempt({ ...step, grayscale: o.efiling.grayscale });
        compressed = step;
        result = r;
        if (r.bytes.length <= capBytes) break;
      }
      if (result.bytes.length > capBytes) warnings.push(`Even at ${compressed.dpi} dpi the bundle is ${(result.bytes.length / 1048576).toFixed(1)} MB, above the ${o.efiling.capMB} MB cap. Split it into volumes (for example by tab) and file them separately.`);
      else warnings.push(`Pages were re-rendered at ${compressed.dpi} dpi to meet the ${o.efiling.capMB} MB cap; the text in them is no longer selectable.`);
    }
  }
  return { ...result, warnings: [...new Set(warnings)], compressed, size: result.bytes.length, overCap: Boolean(capBytes && result.bytes.length > capBytes) };
}

/* ---------------- text search for redaction (pdf.js document) ---------------- */

/** Finds the regions of each term on every page. Returns { [pageIndex]: [{x,y,w,h}] } as fractions, top-left origin. */
export async function findTextRegions(pdfjsDoc, terms, { onProgress } = {}) {
  const wanted = terms.map(t => String(t).trim()).filter(Boolean);
  const out = {};
  if (!wanted.length) return out;
  for (let n = 1; n <= pdfjsDoc.numPages; n++) {
    const page = await pdfjsDoc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!it.str) continue;
      const lower = it.str.toLowerCase();
      for (const term of wanted) {
        let from = 0;
        const t = term.toLowerCase();
        for (let k; (k = lower.indexOf(t, from)) >= 0; from = k + t.length) {
          const [a, b, , d, e, f] = it.transform;
          const fontH = Math.hypot(b, d) || Math.abs(d) || 10;
          const charW = it.width / Math.max(1, it.str.length);
          // Convert the item's baseline box through the viewport transform.
          // Glyph widths vary: pad by a character either side so nothing peeks out.
          const x0 = e + charW * (k - 0.6), x1 = e + charW * (k + t.length + 0.9);
          const p0 = vp.convertToViewportPoint(x0, f - fontH * 0.25);
          const p1 = vp.convertToViewportPoint(x1, f + fontH * 0.95);
          const x = Math.min(p0[0], p1[0]), y = Math.min(p0[1], p1[1]);
          const w = Math.abs(p1[0] - p0[0]), h = Math.abs(p1[1] - p0[1]);
          (out[n - 1] ||= []).push({ x: Math.max(0, x / vp.width - 0.002), y: Math.max(0, y / vp.height - 0.002), w: w / vp.width + 0.004, h: h / vp.height + 0.004, term });
          void a;
        }
      }
    }
    onProgress?.(n, pdfjsDoc.numPages);
  }
  return out;
}
