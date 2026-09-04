/* ============================================================
   PDF engine.

   A thin, honest layer over pdf-lib. pdf-lib is ~350 kB, so it is
   imported dynamically and only when a PDF tool is actually opened —
   nobody pays for it by visiting the home page.

   Like the image engine, everything happens locally. A PDF is often the
   most sensitive thing a person owns (contracts, bank statements, IDs),
   which is exactly why these tools must never upload one.
   ============================================================ */

let pdfLibPromise = null;

/** Load pdf-lib once, shared by every PDF tool in the session. */
export function loadPdfLib() {
  pdfLibPromise ??= import('pdf-lib');
  return pdfLibPromise;
}

export const PAGE_SIZES = {
  a4:     { label: 'A4',        width: 595.28, height: 841.89 },
  letter: { label: 'US Letter', width: 612,    height: 792 },
  a3:     { label: 'A3',        width: 841.89, height: 1190.55 },
  a5:     { label: 'A5',        width: 419.53, height: 595.28 },
};

/**
 * Read a PDF and report what is in it, without modifying anything.
 * @param {File} file
 */
export async function inspectPdf(file) {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  // Encrypted files throw on load; ignoreEncryption lets us read page
  // counts for the common "owner password only" case.
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages().map((p, i) => {
    const { width, height } = p.getSize();
    return { index: i, width: Math.round(width), height: Math.round(height), rotation: p.getRotation().angle };
  });
  return {
    name: file.name,
    size: file.size,
    pageCount: pages.length,
    pages,
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    encrypted: doc.isEncrypted ?? false,
  };
}

const safe = (fn) => { try { return fn() || ''; } catch { return ''; } };

/**
 * Concatenate PDFs in the given order.
 * @param {File[]} files
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfs(files) {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();

  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const page of copied) out.addPage(page);
  }

  out.setProducer('Toolbox');
  out.setCreationDate(new Date());
  return out.save();
}

/**
 * Build a new PDF from a subset of pages, optionally rotated.
 * @param {File} file
 * @param {number[]} pageIndices zero-based, in output order
 * @param {Record<number, number>} [rotations] index → degrees to add
 */
export async function extractPages(file, pageIndices, rotations = {}) {
  const { PDFDocument, degrees } = await loadPdfLib();
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();

  const copied = await out.copyPages(src, pageIndices);
  copied.forEach((page, i) => {
    const extra = rotations[pageIndices[i]] ?? 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });

  out.setProducer('Toolbox');
  return out.save();
}

/**
 * Lay images out as PDF pages.
 * @param {Array<{bytes: ArrayBuffer, type: string}>} images
 * @param {object} opts
 */
export async function imagesToPdf(images, { pageSize = 'a4', orientation = 'auto', margin = 24, fit = 'contain' } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const size = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4;

  for (const image of images) {
    // pdf-lib embeds JPEG and PNG only; the caller converts anything else.
    const embedded = /jpe?g/.test(image.type)
      ? await doc.embedJpg(image.bytes)
      : await doc.embedPng(image.bytes);

    let pw = size.width;
    let ph = size.height;
    const landscape = orientation === 'landscape'
      || (orientation === 'auto' && embedded.width > embedded.height);
    if (landscape) [pw, ph] = [ph, pw];

    const page = doc.addPage([pw, ph]);
    const availW = pw - margin * 2;
    const availH = ph - margin * 2;

    const scale = fit === 'cover'
      ? Math.max(availW / embedded.width, availH / embedded.height)
      : Math.min(availW / embedded.width, availH / embedded.height);

    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }

  doc.setProducer('Toolbox');
  doc.setCreationDate(new Date());
  return doc.save();
}

export function pdfBlob(bytes) {
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Parse "1-3, 5, 8-" into zero-based indices, clamped to the document.
 * Invalid fragments are ignored rather than throwing, because this is
 * parsed live as the user types.
 */
export function parsePageRange(spec, pageCount) {
  const out = [];
  const seen = new Set();
  for (const part of String(spec).split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const m = chunk.match(/^(\d+)?\s*(?:-\s*(\d+)?)?$/);
    if (!m) continue;

    if (m[0].includes('-')) {
      const start = m[1] ? parseInt(m[1], 10) : 1;
      const end = m[2] ? parseInt(m[2], 10) : pageCount;
      for (let p = start; p <= Math.min(end, pageCount); p++) {
        if (p >= 1 && !seen.has(p)) { seen.add(p); out.push(p - 1); }
      }
    } else if (m[1]) {
      const p = parseInt(m[1], 10);
      if (p >= 1 && p <= pageCount && !seen.has(p)) { seen.add(p); out.push(p - 1); }
    }
  }
  return out;
}
