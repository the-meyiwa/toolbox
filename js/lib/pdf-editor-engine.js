/* ============================================================
   PDF Editor Engine.
   Dynamically imports pdfjs-dist and heavy conversion libraries.
   Optimized with event-loop yielding for smooth 60fps & low INP.
   ============================================================ */

let pdfJsPromise = null;

export async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then(pdfjsLib => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

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

export async function renderPageThumbnail(pdfDoc, pageIndex, canvas, maxHeight = 150) {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxHeight / viewport.height;
  return renderPageToCanvas(pdfDoc, pageIndex, canvas, scale);
}

export async function flattenAnnotations(pdfLibDoc, annotations) {
  const { rgb } = await import('pdf-lib');
  const pages = pdfLibDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.page];
    if (!page) continue;

    const { height } = page.getSize();
    const y = height - ann.y;

    if (ann.type === 'text') {
      page.drawText(ann.text || '', { x: ann.x, y: y - (ann.size || 12), size: ann.size || 12, color: rgb(0, 0, 0) });
    } else if (ann.type === 'highlight') {
      page.drawRectangle({
        x: ann.x,
        y: y - ann.h,
        width: ann.w,
        height: ann.h,
        color: rgb(1, 1, 0),
        opacity: 0.4,
      });
    } else if (ann.type === 'shape') {
      if (ann.shape === 'rect') {
        page.drawRectangle({
          x: ann.x,
          y: y - ann.h,
          width: ann.w,
          height: ann.h,
          borderColor: rgb(1, 0, 0),
          borderWidth: 2,
        });
      } else if (ann.shape === 'circle') {
        page.drawEllipse({
          x: ann.x + ann.w / 2,
          y: y - ann.h / 2,
          xScale: ann.w / 2,
          yScale: ann.h / 2,
          borderColor: rgb(1, 0, 0),
          borderWidth: 2,
        });
      }
    } else if (ann.type === 'image') {
      try {
        const res = await fetch(ann.src);
        const bytes = await res.arrayBuffer();
        const isPng = ann.src.includes('png') || ann.src.startsWith('data:image/png');
        const embedded = isPng ? await pdfLibDoc.embedPng(bytes) : await pdfLibDoc.embedJpg(bytes);
        page.drawImage(embedded, { x: ann.x, y: y - ann.h, width: ann.w, height: ann.h });
      } catch (e) {
        console.error('Failed to embed image annotation', e);
      }
    }
  }
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
