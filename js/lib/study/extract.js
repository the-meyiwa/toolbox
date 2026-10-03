/* ============================================================
   Study — reading context files as text

   Notes, Markdown, code and data are read as they are; PDFs page by
   page (pdf.js); Word documents from their XML. Everything stays on
   the device. Returns '' for files with no readable text (a scanned
   PDF, an image), which the session shows as "no text found".

   readNote() also collects the pictures in a note (Word and
   PowerPoint media, PDF pages that contain images, image files
   themselves), scaled down, so they can be shown and selected in
   Study's reader and explained by the Assistant.
   ============================================================ */

const TEXT = /^(text\/|application\/(json|xml|x-yaml|javascript|x-tex|csv))/;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|tex|rtf|js|ts|py|java|c|cpp|cs|go|rb|php|sql|ini|log|srt|vtt)$/i;
export const MAX_FILE_CHARS = 400000;

const decodeXml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export async function readFileText(file) {
  const name = file.name || '';
  const type = file.type || '';
  if (TEXT.test(type) || TEXT_EXT.test(name)) {
    const raw = await file.text();
    return (/\.html?$/i.test(name) ? raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ') : raw).slice(0, MAX_FILE_CHARS);
  }
  if (/pdf/i.test(type) || /\.pdf$/i.test(name)) {
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = '';
    for (let n = 1; n <= doc.numPages && out.length < MAX_FILE_CHARS; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      out += `\n\n[Page ${n}]\n${content.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]{2,}/g, ' ').trim()}`;
    }
    return out.trim().slice(0, MAX_FILE_CHARS);
  }
  if (/wordprocessingml/.test(type) || /\.docx$/i.test(name)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('string') || '';
    return decodeXml(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''))
      .replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_FILE_CHARS);
  }
  if (/presentationml/.test(type) || /\.pptx$/i.test(name)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    const parts = [];
    for (const k of slides) parts.push(`[Slide ${k.match(/\d+/)[0]}]\n${decodeXml((await zip.file(k).async('string')).replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, ''))}`);
    return parts.join('\n\n').trim().slice(0, MAX_FILE_CHARS);
  }
  return '';
}

/* ---------- pictures ---------- */

const MAX_IMAGES = 24;
const MAX_SIDE = 1600;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}

/** A picture scaled to at most MAX_SIDE on its long edge, as a data URL. */
async function shrink(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (k === 1 && blob.size < 900_000) { bmp.close?.(); return { src: await blobToDataUrl(blob), w: bmp.width, h: bmp.height }; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return { src: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height };
  } catch { return null; }
}

async function zipImages(file, folder) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter(k => k.startsWith(folder) && IMAGE_EXT.test(k)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, MAX_IMAGES);
  const out = [];
  for (const n of names) {
    const ext = n.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
    const img = await shrink(new Blob([await zip.file(n).async('uint8array')], { type: `image/${ext}` }));
    if (img) out.push({ ...img, label: n.split('/').pop() });
  }
  return out;
}

/** PDF pages that draw pictures, rendered as images (text-only pages are left as text). */
async function pdfPictures(file) {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const draws = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject].filter(Boolean));
  const out = [];
  for (let n = 1; n <= doc.numPages && out.length < MAX_IMAGES && n <= 60; n++) {
    const page = await doc.getPage(n);
    const ops = await page.getOperatorList();
    if (!ops.fnArray.some(f => draws.has(f))) continue;
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 1200 / base.width) });
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    out.push({ src: c.toDataURL('image/jpeg', 0.84), w: c.width, h: c.height, label: `Page ${n}`, page: n });
  }
  return out;
}

/** A note's text and the pictures in it. Pictures are best effort: a failure leaves the text. */
export async function readNote(file) {
  const name = file.name || '';
  const type = file.type || '';
  if (/^image\//.test(type) || IMAGE_EXT.test(name)) {
    const img = await shrink(file);
    return { text: '', images: img ? [{ ...img, label: name }] : [] };
  }
  const text = await readFileText(file);
  let images = [];
  try {
    if (/wordprocessingml/.test(type) || /\.docx$/i.test(name)) images = await zipImages(file, 'word/media/');
    else if (/presentationml/.test(type) || /\.pptx$/i.test(name)) images = await zipImages(file, 'ppt/media/');
    else if (/pdf/i.test(type) || /\.pdf$/i.test(name)) images = await pdfPictures(file);
  } catch { images = []; }
  return { text, images };
}
