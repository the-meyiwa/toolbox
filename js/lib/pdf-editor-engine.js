/* ============================================================
   PDF Editor Engine.
   Dynamically imports pdfjs-dist and heavy conversion libraries.
   Optimized with event-loop yielding for smooth 60fps & low INP.
   ============================================================ */

// pdf.js loading (worker URL, Map upsert polyfill) is shared with the PDF workspace.
export { loadPdfJs } from './pdf/pdfjs-loader.js';

const yieldFrame = () => new Promise(resolve => {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  } else {
    setTimeout(resolve, 0);
  }
});

export async function renderPageToCanvas(pdfDoc, pageIndex, canvas, scale = 1) {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };
  await page.render(renderContext).promise;
  return viewport;
}

export async function convertToDocx(pdfDoc, pageCount) {
  await yieldFrame();
  const docx = await import('docx');
  const sections = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');

    sections.push({
      properties: {},
      children: [new docx.Paragraph({ children: [new docx.TextRun(text)] })],
    });
    await yieldFrame();
  }

  const doc = new docx.Document({ sections });
  return docx.Packer.toBlob(doc);
}

export async function convertToPptx(pdfDoc, pageCount, renderFn) {
  await yieldFrame();
  const { default: pptxgen } = await import('pptxgenjs');
  const pres = new pptxgen();

  for (let i = 0; i < pageCount; i++) {
    const dataUrl = await renderFn(i);
    const slide = pres.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
    await yieldFrame();
  }

  const buffer = await pres.write('arraybuffer');
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

export async function convertToXlsx(pdfDoc, pageCount) {
  await yieldFrame();
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    sheet.addRow([text]);
    await yieldFrame();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
