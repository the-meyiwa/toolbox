/* ============================================================
   PDF operations for the Assistant's `pdf_process` tool.

   Each operation takes the attached PDF(s) and returns a result the
   Assistant's file card can offer for download: { status, type: 'file',
   renderer: 'file', filename, dataUrl, format, fileSize, message }.
   Uses the same engine as the PDF tools, so behaviour matches.
   ============================================================ */

import {
  toBytes, bytesToDataUrl, baseName, openPdfLib, savePdf, parseRange, parseRangeGroups,
  planEvery, planEach, planBookmarks, partNames, readOutline, mergePdfBytes, splitPdfBytes,
  applyWatermark, applyHeaderFooter, compressPdfBytes, normRot, isPdfBytes, humanBytes, inspectPdfBytes,
} from './core.js';
import { createZip } from './zip.js';

export const PDF_OPERATIONS = ['inspect', 'merge', 'split', 'extract_pages', 'delete_pages', 'rotate', 'compress', 'extract_text', 'watermark', 'page_numbers', 'to_images'];

const ALIASES = {
  page_count: 'inspect', info: 'inspect', stamp_watermark: 'watermark', add_watermark: 'watermark',
  number_pages: 'page_numbers', add_page_numbers: 'page_numbers', bates: 'page_numbers',
  text: 'extract_text', to_text: 'extract_text', to_markdown: 'extract_text',
  images: 'to_images', to_png: 'to_images', to_jpeg: 'to_images', pages_to_images: 'to_images',
  combine: 'merge', join: 'merge', extract: 'extract_pages', keep_pages: 'extract_pages', remove_pages: 'delete_pages',
  optimize: 'compress', shrink: 'compress',
};

function fileResult(bytes, filename, mime, extra = {}) {
  return {
    status: 'success', type: 'file', renderer: 'file',
    format: filename.split('.').pop(), filename, fileSize: bytes.length,
    dataUrl: bytesToDataUrl(bytes, mime), ...extra,
  };
}

async function pdfInputs(files) {
  const out = [];
  for (const f of files || []) {
    if (!f) continue;
    const src = f.bytes || f.dataUrl || f.base64 || f.content || f.blob;
    if (!src) continue;
    const isPdf = /pdf/i.test(f.type || f.mimeType || '') || /\.pdf$/i.test(f.name || '') || String(f.dataUrl || '').startsWith('data:application/pdf');
    let bytes;
    try { bytes = await toBytes(src); } catch { continue; }
    if (!isPdf && !isPdfBytes(bytes)) continue;
    out.push({ name: f.name || f.filename || `document-${out.length + 1}.pdf`, bytes });
  }
  return out;
}

/**
 * @param {string} operation
 * @param {object} args  operation options (see pdf_process declaration)
 * @param {{files: Array<{name, dataUrl?, base64?, bytes?, type?}>}} ctx  first file is the main one
 */
export async function runPdfOperation(operation, args = {}, { files = [] } = {}) {
  const op = ALIASES[String(operation || 'inspect').toLowerCase()] || String(operation || 'inspect').toLowerCase();
  if (!PDF_OPERATIONS.includes(op)) {
    return { status: 'error', message: `Unknown PDF operation "${operation}". Available: ${PDF_OPERATIONS.join(', ')}.` };
  }
  const pdfs = await pdfInputs(files);
  if (!pdfs.length) return { status: 'needs_file', message: 'Attach the PDF to work on (drag it into the chat), then ask again.' };
  const main = pdfs[0];
  const base = baseName(main.name);

  try {
    switch (op) {
      case 'inspect': {
        const info = await inspectPdfBytes(main.bytes);
        return { status: 'success', operation: op, ...info, pages: undefined, message: `"${main.name}" has ${info.pageCount} page(s)${info.encrypted ? ' and is encrypted' : ''}${info.formFields ? `, ${info.formFields} form field(s)` : ''}.` };
      }

      case 'merge': {
        if (pdfs.length < 2) return { status: 'needs_file', message: 'Merging needs at least two PDFs. Attach the other file(s) too.' };
        const ranges = Array.isArray(args.fileRanges) ? args.fileRanges : [];
        const bytes = await mergePdfBytes(pdfs.map((p, i) => ({ bytes: p.bytes, name: p.name, range: ranges[i] || '' })), { bookmarks: args.bookmarks !== false });
        const pages = (await openPdfLib(bytes)).getPageCount();
        return fileResult(bytes, args.filename || `${base}-merged.pdf`, 'application/pdf', { operation: op, pageCount: pages, message: `Merged ${pdfs.length} PDFs into one document of ${pages} pages.` });
      }

      case 'split': {
        const doc = await openPdfLib(main.bytes);
        const count = doc.getPageCount();
        let groups, titles = [];
        if (args.ranges || args.pages) {
          const r = parseRangeGroups(args.ranges || args.pages, count);
          if (r.errors.length && !r.groups.length) return { status: 'error', message: `Could not read the ranges "${args.ranges || args.pages}". Use a form like "1-3, 5, 8-".` };
          groups = r.groups;
        } else if (args.mode === 'bookmarks') {
          const parts = planBookmarks(await readOutline(doc), count);
          if (!parts.length) return { status: 'error', message: 'This PDF has no bookmarks to split by. Give page ranges instead.' };
          groups = parts.map(p => p.pages); titles = parts.map(p => p.title);
        } else if (args.everyN || args.mode === 'every') {
          groups = planEvery(count, args.everyN || 1);
        } else groups = planEach(count);
        const parts = await splitPdfBytes(main.bytes, groups);
        const names = partNames(base, groups, titles);
        if (parts.length === 1) return fileResult(parts[0], names[0], 'application/pdf', { operation: op, pageCount: groups[0].length, message: `Extracted ${groups[0].length} page(s).` });
        const zip = createZip(parts.map((data, i) => ({ name: names[i], data })));
        return fileResult(zip, `${base}-split.zip`, 'application/zip', { operation: op, parts: parts.length, message: `Split into ${parts.length} PDFs (${names.slice(0, 4).join(', ')}${names.length > 4 ? ', ...' : ''}), packed as a ZIP.` });
      }

      case 'extract_pages':
      case 'delete_pages': {
        const doc = await openPdfLib(main.bytes);
        const count = doc.getPageCount();
        const chosen = parseRange(args.pages || args.ranges || '', count);
        if (!chosen.length) return { status: 'error', message: 'Say which pages, for example "1-3, 7".' };
        const keep = op === 'extract_pages' ? chosen : Array.from({ length: count }, (_, i) => i).filter(i => !chosen.includes(i));
        if (!keep.length) return { status: 'error', message: 'That would remove every page.' };
        const [bytes] = await splitPdfBytes(main.bytes, [keep]);
        return fileResult(bytes, `${base}-${op === 'extract_pages' ? 'extract' : 'trimmed'}.pdf`, 'application/pdf', { operation: op, pageCount: keep.length, message: `${op === 'extract_pages' ? 'Extracted' : 'Kept'} ${keep.length} of ${count} pages.` });
      }

      case 'rotate': {
        const { degrees } = await import('pdf-lib');
        const doc = await openPdfLib(main.bytes);
        if (doc.isEncrypted) throw new Error('This PDF is encrypted; open it in the PDF Editor with its password first.');
        const count = doc.getPageCount();
        const angle = normRot(args.angle ?? args.degrees ?? 90);
        const pages = args.pages ? parseRange(args.pages, count) : Array.from({ length: count }, (_, i) => i);
        for (const i of pages) {
          const p = doc.getPage(i);
          p.setRotation(degrees(normRot(p.getRotation().angle + angle)));
        }
        const bytes = await savePdf(doc);
        return fileResult(bytes, `${base}-rotated.pdf`, 'application/pdf', { operation: op, pageCount: count, message: `Rotated ${pages.length} page(s) by ${angle} degrees.` });
      }

      case 'compress': {
        let bytes;
        let how = 'lossless re-save';
        if (args.dpi && typeof document !== 'undefined') {
          const { rasterizePdf } = await import('./raster.js');
          bytes = await rasterizePdf(main.bytes, { dpi: Math.max(50, Math.min(300, Number(args.dpi))), quality: args.quality || 0.72 });
          how = `pages re-rendered at ${args.dpi} dpi (text is no longer selectable)`;
        } else bytes = await compressPdfBytes(main.bytes, { strip: Boolean(args.stripMetadata) });
        if (bytes.length >= main.bytes.length && !args.dpi) bytes = main.bytes;
        const saved = main.bytes.length - bytes.length;
        return fileResult(bytes, `${base}-compressed.pdf`, 'application/pdf', {
          operation: op,
          message: saved > 0
            ? `Compressed from ${humanBytes(main.bytes.length)} to ${humanBytes(bytes.length)} (${Math.round(saved / main.bytes.length * 100)}% smaller, ${how}).`
            : `This PDF is already compact (${humanBytes(bytes.length)}); a lossless re-save did not make it smaller. Ask for a lower dpi to downsample.`,
        });
      }

      case 'extract_text': {
        const { openPdfJs } = await import('./pdfjs-loader.js');
        const { extractText, pagesToText, pagesToMarkdown } = await import('./text.js');
        const { doc } = await openPdfJs(main.bytes, { password: args.password || '' });
        try {
          const pages = args.pages ? parseRange(args.pages, doc.numPages) : null;
          const extracted = await extractText(doc, { pages });
          const md = /^m(ark)?d(own)?$/i.test(args.format || '') || operation === 'to_markdown';
          const text = md ? pagesToMarkdown(extracted, { title: base }) : pagesToText(extracted);
          const bytes = new TextEncoder().encode(text);
          const empty = text.replace(/--- Page \d+ ---/g, '').trim().length < 20;
          return fileResult(bytes, `${base}.${md ? 'md' : 'txt'}`, md ? 'text/markdown' : 'text/plain', {
            operation: op, pageCount: extracted.length, text: text.slice(0, 6000), truncated: text.length > 6000,
            message: empty ? 'Little or no text was found; this PDF is probably scanned images (OCR is needed).' : `Extracted text from ${extracted.length} page(s) as ${md ? 'Markdown' : 'plain text'}.`,
          });
        } finally { doc.destroy?.(); }
      }

      case 'watermark': {
        const doc = await openPdfLib(main.bytes);
        if (doc.isEncrypted) throw new Error('This PDF is encrypted; open it in the PDF Editor with its password first.');
        const count = doc.getPageCount();
        const text = String(args.text || args.watermarkText || 'CONFIDENTIAL').slice(0, 80);
        await applyWatermark(doc, {
          text, opacity: args.opacity ?? 0.18, angle: Number.isFinite(args.angle) ? args.angle : 45,
          layout: args.layout === 'tile' ? 'tile' : 'center', color: args.color,
          pages: args.pages ? parseRange(args.pages, count) : null,
        });
        const bytes = await savePdf(doc);
        return fileResult(bytes, `${base}-watermarked.pdf`, 'application/pdf', { operation: op, pageCount: count, watermarkText: text, message: `Stamped "${text}" on ${args.pages ? 'the chosen' : `all ${count}`} pages.` });
      }

      case 'page_numbers': {
        const doc = await openPdfLib(main.bytes);
        if (doc.isEncrypted) throw new Error('This PDF is encrypted; open it in the PDF Editor with its password first.');
        const count = doc.getPageCount();
        const bates = args.batesPrefix || args.bates ? { prefix: args.batesPrefix || (typeof args.bates === 'string' ? args.bates : ''), start: args.start || 1, digits: args.digits || 6 } : null;
        await applyHeaderFooter(doc, {
          template: args.template || (bates ? '{bates}' : 'Page {n} of {total}'),
          position: args.position || (bates ? 'bottom-right' : 'bottom-center'),
          startAt: bates ? 1 : (args.start || 1), bates, size: args.size || 10, file: main.name,
          pages: args.pages ? parseRange(args.pages, count) : null,
        });
        const bytes = await savePdf(doc);
        return fileResult(bytes, `${base}-numbered.pdf`, 'application/pdf', { operation: op, pageCount: count, message: bates ? `Added Bates numbers ${bates.prefix}${String(bates.start).padStart(bates.digits, '0')} onwards.` : `Numbered ${count} pages.` });
      }

      case 'to_images': {
        if (typeof document === 'undefined') return { status: 'error', message: 'Rendering pages to images needs the browser.' };
        const { openPdfJs } = await import('./pdfjs-loader.js');
        const { pagesToImages } = await import('./raster.js');
        const { doc } = await openPdfJs(main.bytes, { password: args.password || '' });
        try {
          const indices = args.pages ? parseRange(args.pages, doc.numPages) : Array.from({ length: Math.min(doc.numPages, 100) }, (_, i) => i);
          const format = /jpe?g/i.test(args.format || '') ? 'jpeg' : 'png';
          const images = await pagesToImages(doc, indices, { format, dpi: Math.max(36, Math.min(300, Number(args.dpi) || 144)), base });
          if (images.length === 1) return fileResult(images[0].data, images[0].name, format === 'png' ? 'image/png' : 'image/jpeg', { operation: op, message: 'Rendered the page as an image.' });
          const zip = createZip(images);
          return fileResult(zip, `${base}-${format}.zip`, 'application/zip', { operation: op, pageCount: images.length, message: `Rendered ${images.length} pages as ${format.toUpperCase()} images${doc.numPages > 100 && !args.pages ? ' (first 100 pages)' : ''}, packed as a ZIP.` });
        } finally { doc.destroy?.(); }
      }
    }
  } catch (err) {
    return { status: 'error', operation: op, message: `Could not ${op.replace(/_/g, ' ')}: ${err?.message || err}` };
  }
  return { status: 'error', message: 'Nothing to do.' };
}
