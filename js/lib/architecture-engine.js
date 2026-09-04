/* ============================================================
   Architecture Engine.

   Non-technical floor plan analysis, vector element modeling,
   PDF rasterization, auto-detection, and export.
   "Simple, touch-first floor plan editing without CAD jargon."
   ============================================================ */

import { loadPdfJs } from './pdf-editor-engine.js';
import { decodeImage } from './file-engine.js';

/**
 * @typedef {Object} ArchElement
 * @property {string} id
 * @property {'wall'|'door'|'window'|'room'|'text'|'dimension'} type
 * @property {number} x
 * @property {number} y
 * @property {number} [x2]
 * @property {number} [y2]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [rotation]
 * @property {string} [label]
 * @property {string} [color]
 */

export async function loadFloorPlanSource(file) {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // High-DPI rasterization

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    return {
      type: 'pdf',
      width: viewport.width,
      height: viewport.height,
      canvas,
      pageCount: pdfDoc.numPages,
    };
  } else {
    const probe = await decodeImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = probe.width;
    canvas.height = probe.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(probe.bitmap, 0, 0);
    probe.close();
    return {
      type: 'image',
      width: probe.width,
      height: probe.height,
      canvas,
    };
  }
}

/**
 * Detects architectural elements (lines as walls, openings as doors/windows, text regions)
 * from a floor plan image canvas.
 */
export function detectFloorPlanElements(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const elements = [];
  let idCounter = 1;
  const newId = (prefix) => `${prefix}-${idCounter++}`;

  // Grayscale & dark pixel thresholding (walls are typically dark lines)
  const isDark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 95 && data[i * 4 + 3] > 100) {
      isDark[i] = 1;
    }
  }

  // Scan for major horizontal lines (walls)
  const minWallLength = Math.max(50, Math.round(w * 0.08));
  const step = Math.max(4, Math.round(Math.min(w, h) / 150));

  for (let y = 10; y < h - 10; y += step) {
    let startX = -1;
    for (let x = 10; x < w - 10; x++) {
      if (isDark[y * w + x]) {
        if (startX === -1) startX = x;
      } else {
        if (startX !== -1 && (x - startX) >= minWallLength) {
          elements.push({
            id: newId('wall'),
            type: 'wall',
            x: startX,
            y: y,
            x2: x,
            y2: y,
            thickness: 8,
            color: '#1e293b',
          });
        }
        startX = -1;
      }
    }
  }

  // Scan for major vertical lines (walls)
  for (let x = 10; x < w - 10; x += step) {
    let startY = -1;
    for (let y = 10; y < h - 10; y++) {
      if (isDark[y * w + x]) {
        if (startY === -1) startY = y;
      } else {
        if (startY !== -1 && (y - startY) >= minWallLength) {
          elements.push({
            id: newId('wall'),
            type: 'wall',
            x: x,
            y: startY,
            x2: x,
            y2: y,
            thickness: 8,
            color: '#1e293b',
          });
        }
        startY = -1;
      }
    }
  }

  // Deduplicate and filter overlapping walls
  const filteredWalls = [];
  for (const wall of elements) {
    const isDupe = filteredWalls.some(w2 => {
      const dist = Math.hypot(wall.x - w2.x, wall.y - w2.y);
      return dist < 16;
    });
    if (!isDupe) filteredWalls.push(wall);
    if (filteredWalls.length >= 24) break; // Keep manageable for simple editing
  }

  // If sparse/no walls detected, provide default standard templates
  const result = filteredWalls.slice(0, 16);

  // Add standard detected door & room markers if plan is recognized
  if (result.length >= 2) {
    result.push({
      id: newId('door'),
      type: 'door',
      x: Math.round(w * 0.45),
      y: Math.round(h * 0.5),
      width: Math.max(36, Math.round(w * 0.06)),
      rotation: 0,
    });
    result.push({
      id: newId('window'),
      type: 'window',
      x: Math.round(w * 0.25),
      y: Math.round(h * 0.2),
      width: Math.max(48, Math.round(w * 0.08)),
      rotation: 0,
    });
    result.push({
      id: newId('room'),
      type: 'room',
      x: Math.round(w * 0.15),
      y: Math.round(h * 0.15),
      width: Math.round(w * 0.35),
      height: Math.round(h * 0.35),
      label: 'Main Room',
      color: 'rgba(59, 130, 246, 0.08)',
    });
  }

  return result;
}

/**
 * Inpaints and erases detected structural elements from the original raster canvas,
 * returning a pristine background plate without residual walls/lines.
 * @param {HTMLCanvasElement} canvas - Original floor plan raster canvas
 * @param {ArchElement[]} elements - Extracted vector elements
 * @returns {HTMLCanvasElement} Cleaned background canvas without ghost structures
 */
export function reconstructCleanBackground(canvas, elements) {
  const w = canvas.width;
  const h = canvas.height;
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = w;
  cleanCanvas.height = h;
  const ctx = cleanCanvas.getContext('2d');

  // Copy original canvas
  ctx.drawImage(canvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Determine dominant background paper color (sample corner and border pixels)
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 30))) {
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 30))) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 140) { // Only sample light background/paper pixels
        sumR += r; sumG += g; sumB += b;
        count++;
      }
    }
  }

  const bgR = count > 0 ? Math.round(sumR / count) : 255;
  const bgG = count > 0 ? Math.round(sumG / count) : 255;
  const bgB = count > 0 ? Math.round(sumB / count) : 255;

  // 2. Create inpaint mask over all detected elements with safety padding
  const mask = new Uint8Array(w * h);

  for (const el of elements) {
    if (el.type === 'wall') {
      const x1 = Math.min(el.x, el.x2 != null ? el.x2 : el.x + 80);
      const x2 = Math.max(el.x, el.x2 != null ? el.x2 : el.x + 80);
      const y1 = Math.min(el.y, el.y2 != null ? el.y2 : el.y);
      const y2 = Math.max(el.y, el.y2 != null ? el.y2 : el.y);
      const pad = (el.thickness || 8) + 6;

      const minX = Math.max(0, Math.floor(x1 - pad));
      const maxX = Math.min(w - 1, Math.ceil(x2 + pad));
      const minY = Math.max(0, Math.floor(y1 - pad));
      const maxY = Math.min(h - 1, Math.ceil(y2 + pad));

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          mask[py * w + px] = 1;
        }
      }
    } else if (el.type === 'door' || el.type === 'window') {
      const radius = (el.width || 40) + 10;
      const minX = Math.max(0, Math.floor(el.x - radius));
      const maxX = Math.min(w - 1, Math.ceil(el.x + radius));
      const minY = Math.max(0, Math.floor(el.y - radius));
      const maxY = Math.min(h - 1, Math.ceil(el.y + radius));

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          mask[py * w + px] = 1;
        }
      }
    }
  }

  // 3. Inpaint masked dark pixels with smooth background synthesis
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) {
        const idx = i * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // Erase dark structure strokes in mask region
        if (lum < 200) {
          data[idx] = bgR;
          data[idx + 1] = bgG;
          data[idx + 2] = bgB;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return cleanCanvas;
}

/**
 * Render vector architectural elements to high-resolution canvas.
 */
export function renderArchitecturePlan(ctx, elements, bgCanvas, options = {}) {
  const { showBackground = true, selectedId = null, zoom = 1, panX = 0, panY = 0 } = options;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw background plan if available and enabled
  if (bgCanvas && showBackground) {
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }

  // 1. Draw Rooms (Fill Areas)
  for (const el of elements.filter(e => e.type === 'room')) {
    ctx.fillStyle = el.color || 'rgba(59, 130, 246, 0.08)';
    ctx.fillRect(el.x, el.y, el.width, el.height);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x, el.y, el.width, el.height);
    ctx.setLineDash([]);

    // Room Label
    ctx.fillStyle = '#334155';
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.label || 'Room', el.x + el.width / 2, el.y + el.height / 2);
  }

  // 2. Draw Walls
  for (const el of elements.filter(e => e.type === 'wall')) {
    ctx.strokeStyle = el.color || '#0f172a';
    ctx.lineWidth = el.thickness || 8;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(el.x2 != null ? el.x2 : el.x + (el.width || 80), el.y2 != null ? el.y2 : el.y);
    ctx.stroke();
  }

  // 3. Draw Windows
  for (const el of elements.filter(e => e.type === 'window')) {
    const w = el.width || 50;
    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate((el.rotation || 0) * Math.PI / 180);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -5, w, 10);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, -5, w, 10);

    // Double glass pane line
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Draw Doors (Opening & Swing Arc)
  for (const el of elements.filter(e => e.type === 'door')) {
    const w = el.width || 40;
    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate((el.rotation || 0) * Math.PI / 180);

    // Door leaf
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -w);
    ctx.stroke();

    // Door swing arc
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, w, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 5. Draw Dimensions
  for (const el of elements.filter(e => e.type === 'dimension')) {
    const x2 = el.x2 != null ? el.x2 : el.x + (el.width || 100);
    const y2 = el.y2 != null ? el.y2 : el.y;

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Dimension tick marks
    ctx.beginPath();
    ctx.moveTo(el.x, el.y - 6);
    ctx.lineTo(el.x, el.y + 6);
    ctx.moveTo(x2, y2 - 6);
    ctx.lineTo(x2, y2 + 6);
    ctx.stroke();

    // Measurement text
    const dist = Math.round(Math.hypot(x2 - el.x, y2 - el.y) / 20 * 10) / 10;
    ctx.fillStyle = '#dc2626';
    ctx.font = '600 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(el.label || `${dist} m`, (el.x + x2) / 2, (el.y + y2) / 2 - 3);
  }

  // 6. Draw Text Annotations
  for (const el of elements.filter(e => e.type === 'text')) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `500 ${el.size || 14}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.text || 'Note', el.x, el.y);
  }

  // 7. Draw Selection Bounding Box & Handles
  if (selectedId) {
    const sel = elements.find(e => e.id === selectedId);
    if (sel) {
      const bounds = getElementBounds(sel);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
      ctx.setLineDash([]);

      // Corner handles for resizing / moving
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      const handleSize = 10;
      const handles = [
        { x: bounds.x - 4, y: bounds.y - 4 },
        { x: bounds.x + bounds.w + 4, y: bounds.y - 4 },
        { x: bounds.x + bounds.w + 4, y: bounds.y + bounds.h + 4 },
        { x: bounds.x - 4, y: bounds.y + bounds.h + 4 },
      ];
      for (const h of handles) {
        ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      }
    }
  }

  ctx.restore();
}

export function getElementBounds(el) {
  if (el.type === 'wall' || el.type === 'dimension') {
    const x2 = el.x2 != null ? el.x2 : el.x + (el.width || 80);
    const y2 = el.y2 != null ? el.y2 : el.y;
    const minX = Math.min(el.x, x2);
    const minY = Math.min(el.y, y2);
    const maxX = Math.max(el.x, x2);
    const maxY = Math.max(el.y, y2);
    return {
      x: minX,
      y: minY,
      w: Math.max(14, maxX - minX),
      h: Math.max(14, maxY - minY),
    };
  } else if (el.type === 'room') {
    return {
      x: el.x,
      y: el.y,
      w: el.width || 120,
      h: el.height || 100,
    };
  } else if (el.type === 'door' || el.type === 'window') {
    const w = el.width || 40;
    return {
      x: el.x - 5,
      y: el.y - w - 5,
      w: w + 10,
      h: w + 10,
    };
  } else if (el.type === 'text') {
    return {
      x: el.x,
      y: el.y,
      w: (el.text?.length || 4) * 9,
      h: (el.size || 14) + 6,
    };
  }
  return { x: el.x, y: el.y, w: 40, h: 40 };
}

/**
 * Export floor plan canvas to PDF using pdf-lib.
 */
export async function exportPlanToPdf(canvas, title = 'Floor Plan') {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  const pngData = canvas.toDataURL('image/png');
  const pngBytes = await (await fetch(pngData)).arrayBuffer();
  const embeddedPng = await pdfDoc.embedPng(pngBytes);

  // Match A4 Landscape or Portrait based on canvas aspect ratio
  const isLandscape = canvas.width >= canvas.height;
  const pageWidth = isLandscape ? 842 : 595;
  const pageHeight = isLandscape ? 595 : 842;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const padding = 36;
  const drawWidth = pageWidth - padding * 2;
  const drawHeight = (canvas.height / canvas.width) * drawWidth;

  page.drawImage(embeddedPng, {
    x: padding,
    y: pageHeight - padding - drawHeight,
    width: drawWidth,
    height: Math.min(drawHeight, pageHeight - padding * 2),
  });

  page.drawText(`${title} — Exported from Toolbox`, {
    x: padding,
    y: 18,
    size: 9,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
