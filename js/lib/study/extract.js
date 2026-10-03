/* ============================================================
   Study — reading context files as text

   Notes, Markdown, code and data are read as they are; PDFs page by
   page (pdf.js); Word documents from their XML. Everything stays on
   the device. Returns '' for files with no readable text (a scanned
   PDF, an image), which the session shows as "no text found".
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
