/* ============================================================
   Images → PDF.

   JPEG and PNG files are embedded as they are (no re-encoding, no
   quality loss). A phone photo's EXIF orientation is honoured by the
   placement matrix rather than by re-drawing pixels, so a sideways
   JPEG comes out upright and still byte-identical inside the PDF.
   Everything else (WebP, GIF, BMP, AVIF, HEIC where the browser can
   decode it) is drawn to a canvas first.
   ============================================================ */

import { loadPdfLib, checkAbort, tick, PAGE_SIZES } from './core.js';

/* ---------------- header parsing (pure) ---------------- */

/** EXIF orientation (1–8) from JPEG bytes; 1 when absent. */
export function readJpegOrientation(bytes) {
  const b = bytes;
  if (!(b[0] === 0xff && b[1] === 0xd8)) return 1;
  let p = 2;
  while (p + 4 < b.length) {
    if (b[p] !== 0xff) return 1;
    const marker = b[p + 1];
    const len = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const t = p + 10;                                   // TIFF header
      const little = b[t] === 0x49;
      const u16 = (o) => little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
      const u32 = (o) => little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > b.length) break;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if (marker === 0xda || marker === 0xd9) return 1;     // image data: no EXIF before it
    p += 2 + len;
  }
  return 1;
}

/** Pixel size stored in a JPEG's SOF segment (before orientation). */
export function readJpegSize(b) {
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) { p++; continue; }
    const m = b[p + 1];
    const len = (b[p + 2] << 8) | b[p + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { width: (b[p + 7] << 8) | b[p + 8], height: (b[p + 5] << 8) | b[p + 6] };
    }
    p += 2 + len;
  }
  return null;
}

export function readPngSize(b) {
  if (b[0] !== 0x89 || b[1] !== 0x50) return null;
  const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  return { width: u32(16), height: u32(20) };
}

export function sniffImageType(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return /hei|hev|mif1|msf1/.test(brand) ? 'heic' : brand.startsWith('avi') ? 'avif' : 'isobmff';
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  return 'unknown';
}

/* ---------------- orientation matrices (pure) ---------------- */

/*
 * Unit-square maps [a b c d e f] taking the raw image (as a PDF image
 * XObject draws it) to its upright form, one per EXIF orientation.
 * Derived in PDF coordinates (y up). Orientation 6 is "rotate 90° clockwise".
 */
const UNIT = {
  1: [1, 0, 0, 1, 0, 0],
  2: [-1, 0, 0, 1, 1, 0],
  3: [-1, 0, 0, -1, 1, 1],
  4: [1, 0, 0, -1, 0, 1],
  5: [0, -1, -1, 0, 1, 1],
  6: [0, -1, 1, 0, 0, 1],
  7: [0, 1, 1, 0, 0, 0],
  8: [0, 1, -1, 0, 1, 0],
};

/** m1 ∘ m2 (apply m2 first). */
export function mulMatrix(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
}

/** Orientation plus extra clockwise quarter turns → unit matrix and whether width/height swap. */
export function orientationUnit(orientation = 1, quarterTurns = 0) {
  let m = UNIT[orientation] || UNIT[1];
  const q = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < q; i++) m = mulMatrix(UNIT[6], m);
  return { matrix: m.map(v => Math.round(v * 1e6) / 1e6), swap: Math.abs(m[0]) < 0.5 };
}

/** Upright display size of a raw w×h image. */
export function displaySize(w, h, orientation = 1, quarterTurns = 0) {
  return orientationUnit(orientation, quarterTurns).swap ? { width: h, height: w } : { width: w, height: h };
}

/** Full placement matrix: unit map, scaled to the drawn box and moved to (x, y). */
export function placementMatrix(orientation, quarterTurns, x, y, w, h) {
  const [a, b, c, d, e, f] = orientationUnit(orientation, quarterTurns).matrix;
  return [w * a, h * b, w * c, h * d, w * e + x, h * f + y];
}

/* ---------------- layout (pure) ---------------- */

/**
 * Where an image of (upright) size imgW×imgH pixels goes.
 * @param {object} o {pageSize: 'a4'|'letter'|…|'fit', orientation: 'auto'|'portrait'|'landscape', margin, fit: 'contain'|'cover'|'actual'}
 */
export function layoutImagePage(imgW, imgH, o = {}) {
  const margin = Math.max(0, Number(o.margin) || 0);
  if (o.pageSize === 'fit') {
    // Page follows the image: 96 dpi, longest side capped at 20 inches.
    let w = imgW * 0.75, h = imgH * 0.75;
    const cap = 1440 / Math.max(w, h);
    if (cap < 1) { w *= cap; h *= cap; }
    return { pageW: w + margin * 2, pageH: h + margin * 2, x: margin, y: margin, w, h };
  }
  const size = PAGE_SIZES[o.pageSize] || PAGE_SIZES.a4;
  let pw = size.width, ph = size.height;
  const landscape = o.orientation === 'landscape' || (o.orientation !== 'portrait' && imgW > imgH);
  if (landscape) [pw, ph] = [ph, pw];
  const aw = Math.max(1, pw - margin * 2), ah = Math.max(1, ph - margin * 2);
  let scale;
  if (o.fit === 'cover') scale = Math.max(aw / imgW, ah / imgH);
  else if (o.fit === 'actual') scale = Math.min(0.75, aw / imgW, ah / imgH);
  else scale = Math.min(aw / imgW, ah / imgH);
  const w = imgW * scale, h = imgH * scale;
  return { pageW: pw, pageH: ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h };
}

/* ---------------- building (pdf-lib) ---------------- */

/**
 * @param {Array<{bytes: Uint8Array, type: 'jpeg'|'png', width: number, height: number, orientation?: number, turns?: number}>} images
 *   width/height are the raw pixel size (before orientation).
 */
export async function buildImagesPdf(images, opts = {}, { signal, onProgress } = {}) {
  const lib = await loadPdfLib();
  const { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject, PDFName, rectangle, clip, endPath } = lib;
  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    checkAbort(signal);
    const im = images[i];
    const embedded = im.type === 'jpeg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes);
    const rawW = im.width || embedded.width, rawH = im.height || embedded.height;
    const o = im.orientation || 1;
    const turns = im.turns || 0;
    const up = displaySize(rawW, rawH, o, turns);
    const L = layoutImagePage(up.width, up.height, opts);
    const page = doc.addPage([L.pageW, L.pageH]);
    const name = page.node.newXObject('Im', embedded.ref);
    const m = placementMatrix(o, turns, L.x, L.y, L.w, L.h);
    const ops = [pushGraphicsState()];
    if (opts.fit === 'cover') ops.push(rectangle(opts.margin || 0, opts.margin || 0, L.pageW - 2 * (opts.margin || 0), L.pageH - 2 * (opts.margin || 0)), clip(), endPath());
    ops.push(concatTransformationMatrix(...m), drawObject(name), popGraphicsState());
    page.pushOperators(...ops);
    void PDFName;
    onProgress?.((i + 1) / images.length);
    if (i % 4 === 3) await tick();
  }
  doc.setProducer('Toolbox');
  doc.setCreator('Toolbox Image to PDF');
  doc.setCreationDate(new Date());
  if (opts.title) doc.setTitle(opts.title);
  return doc.save({ useObjectStreams: true });
}

/* ---------------- browser-side preparation ---------------- */

export const QUALITY_PRESETS = {
  original: { label: 'Original', max: 0, q: 1 },
  high:     { label: 'High',     max: 3200, q: 0.9 },
  balanced: { label: 'Balanced', max: 2200, q: 0.82 },
  small:    { label: 'Small',    max: 1500, q: 0.72 },
};

async function canvasBlob(canvas, type, q) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality: q });
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Encoding failed'))), type, q));
}

function hasAlpha(ctx, w, h) {
  // Sample a grid rather than every pixel.
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
  return false;
}

/**
 * Turn a File into something buildImagesPdf can embed.
 * @param {File|Blob} file
 * @param {{quality?: keyof QUALITY_PRESETS}} o
 * @returns {Promise<{bytes, type, width, height, orientation, displayW, displayH, source: string}>}
 */
export async function prepareImage(file, { quality = 'original' } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes);
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.original;

  if (preset.max === 0 && kind === 'jpeg') {
    const size = readJpegSize(bytes);
    if (size) {
      const orientation = readJpegOrientation(bytes);
      const up = displaySize(size.width, size.height, orientation);
      return { bytes, type: 'jpeg', width: size.width, height: size.height, orientation, displayW: up.width, displayH: up.height, source: 'original' };
    }
  }
  if (preset.max === 0 && kind === 'png') {
    const size = readPngSize(bytes);
    if (size) return { bytes, type: 'png', width: size.width, height: size.height, orientation: 1, displayW: size.width, displayH: size.height, source: 'original' };
  }

  // Decode with the browser (applies EXIF orientation), redraw, re-encode.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (kind === 'heic') throw new Error('This browser cannot decode HEIC photos. Safari can; elsewhere, export the photo as JPEG first.');
    throw new Error('This image format could not be decoded by the browser.');
  }
  let w = bitmap.width, h = bitmap.height;
  if (preset.max && Math.max(w, h) > preset.max) {
    const s = preset.max / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const alpha = kind === 'png' || kind === 'webp' || kind === 'gif' ? hasAlpha(ctx, w, h) : false;
  let type = alpha ? 'png' : 'jpeg';
  if (!alpha && preset.max === 0) type = kind === 'jpeg' ? 'jpeg' : 'png';
  if (type === 'jpeg') {
    // JPEG has no alpha: flatten onto white.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  const blob = await canvasBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', preset.max ? preset.q : 0.92);
  if (canvas.width) { canvas.width = 0; canvas.height = 0; }
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type, width: w, height: h, orientation: 1, displayW: w, displayH: h, source: 'converted' };
}
