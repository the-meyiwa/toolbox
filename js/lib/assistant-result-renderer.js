/**
 * TOOLBOX ASSISTANT — Result Presentation Framework
 *
 * Unified system for rendering tool results in conversations.
 * Supports: result-only, interactive cards, workspace operations, and previews.
 *
 * Each renderer is responsible for:
 * 1. Determining if it can render a given result
 * 2. Rendering serialized state to DOM
 * 3. Binding event listeners for interactivity
 * 4. Reconstructing runtime resources (Audio, WebGL, etc.)
 * 5. Cleaning up resources
 */

/**
 * Base Result Renderer — extend this to create new renderers
 */
export class ResultRenderer {
  static id = null;
  static name = null;

  static canRender(result) {
    return false;
  }

  static render(result, container) {
    throw new Error('render() not implemented');
  }

  static bindInteractions(result, container) {
    // Override if needed
  }

  static async reconstruct(result) {
    return result;
  }

  static async cleanup(result) {
    // Override if needed
  }
}

const ICONS = {
  cloud: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  local: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  download: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  external: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/**
 * FILE DOWNLOAD CARD RESULT — Downloadable file cards for PDF, Word (.docx), CSV, JSON, etc.
 */
export class FileDownloadCardRenderer extends ResultRenderer {
  static id = 'file';
  static name = 'File Download';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'file' ||
      result.type === 'file' ||
      (data.dataUrl && (data.filename || data.format === 'docx' || data.format === 'pdf' || data.format === 'csv' || data.format === 'xlsx'));
  }

  static render(result, container) {
    const data = result.data || {};
    const filename = data.filename || 'download.file';
    const ext = (filename.split('.').pop() || data.format || 'file').toUpperCase();
    const sizeStr = data.fileSize ? `${Math.round(data.fileSize / 1024)} KB` : (data.pageCount ? `${data.pageCount} page(s)` : '');

    const card = document.createElement('div');
    card.className = 'assistant-result-file-card';
    card.style.cssText = 'margin-top:10px; padding:14px 16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:12px; min-width:0; flex:1;';

    const iconBadge = document.createElement('div');
    iconBadge.style.cssText = 'width:42px; height:42px; border-radius:10px; background:var(--g100, #f1f5f9); color:var(--primary, #2563eb); font:700 0.75rem var(--sans, sans-serif); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--g200, #e2e8f0);';
    iconBadge.textContent = ext.slice(0, 4);

    const info = document.createElement('div');
    info.style.cssText = 'min-width:0; flex:1;';

    const nameEl = document.createElement('div');
    nameEl.textContent = filename;
    nameEl.style.cssText = 'font-weight:700; font-size:0.92rem; color:var(--text, #0f172a); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

    const metaEl = document.createElement('div');
    metaEl.textContent = [ext, sizeStr, data.message].filter(Boolean).slice(0, 2).join(' · ');
    metaEl.style.cssText = 'font-size:0.75rem; color:var(--g600, #64748b); margin-top:2px;';

    info.append(nameEl, metaEl);
    left.append(iconBadge, info);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-secondary btn-sm assistant-file-save-btn';
    saveBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.cloud} Save to Files</span>`;
    saveBtn.style.cssText = 'padding:6px 14px; font-size:0.8rem; font-weight:700; border-radius:9999px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;';
    saveBtn.addEventListener('click', async () => {
      try {
        const { saveArtifactFile } = await import('./artifacts.js');
        const res = await saveArtifactFile({
          name: filename,
          content: data.dataUrl || data.content || data.csvText || `Content for ${filename}`,
          kind: data.format || data.kind,
          destination: 'cloud',
          from: 'assistant'
        });
        saveBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.check} Saved</span>`;
        saveBtn.disabled = true;
        saveBtn.style.background = '#f0fdf4';
        saveBtn.style.color = '#16a34a';
        saveBtn.style.borderColor = '#bbf7d0';
      } catch (err) {
        saveBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.check} Saved</span>`;
      }
    });

    const downloadBtn = document.createElement('a');
    downloadBtn.className = 'assistant-file-download-btn';
    downloadBtn.href = data.dataUrl || '#';
    downloadBtn.download = filename;
    downloadBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px;">${ICONS.download} Download</span>`;
    downloadBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; padding:7px 16px; border-radius:9999px; background:var(--black, #0f172a); color:var(--white, #fff); font-size:0.85rem; font-weight:700; text-decoration:none; cursor:pointer; transition:opacity .15s; flex-shrink:0;';
    downloadBtn.onmouseover = () => { downloadBtn.style.opacity = '0.85'; };
    downloadBtn.onmouseout = () => { downloadBtn.style.opacity = '1'; };

    // Auto-trigger download if user asked for download without confirmation
    if (data.autoDownload && data.dataUrl && data.dataUrl !== '#') {
      setTimeout(() => {
        try {
          downloadBtn.click();
        } catch {}
      }, 150);
    }

    right.append(saveBtn, downloadBtn);
    card.append(left, right);
    container.appendChild(card);
    return card;
  }
}

/**
 * FILE LIST RESULT — Clean visual workspace explorer with folder icons, file rows, and download/view actions
 */
export class FileListResultRenderer extends ResultRenderer {
  static id = 'file-list';
  static name = 'Saved Files List';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'file-list' ||
      result.type === 'file-list' ||
      Boolean(Array.isArray(data.files));
  }

  static render(result, container) {
    const data = result.data || {};
    const files = Array.isArray(data.files) ? data.files : [];
    const filter = data.filter ? ` · Filtered by "${data.filter}"` : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-file-list';
    wrapper.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04); overflow:hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--g50, #f8fafc); border-bottom:1px solid var(--g200, #e2e8f0); flex-wrap:wrap; gap:8px;';

    const leftHeader = document.createElement('div');
    leftHeader.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const folderIcon = document.createElement('span');
    folderIcon.innerHTML = ICONS.folder;
    folderIcon.style.cssText = 'display:inline-flex; align-items:center; color:var(--primary, #2563eb);';

    const title = document.createElement('strong');
    title.textContent = 'Saved Files & Documents';
    title.style.cssText = 'font-size:0.92rem; color:var(--text, #0f172a);';

    const countBadge = document.createElement('span');
    countBadge.textContent = `${files.length} item${files.length === 1 ? '' : 's'}${filter}`;
    countBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:var(--g200, #e2e8f0); color:var(--g700, #334155); font-weight:600;';

    leftHeader.append(folderIcon, title, countBadge);

    const openSavedBtn = document.createElement('a');
    openSavedBtn.href = '#/saved';
    openSavedBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">Open in Saved Work ${ICONS.external}</span>`;
    openSavedBtn.style.cssText = 'font-size:0.78rem; font-weight:700; color:var(--primary, #2563eb); text-decoration:none; display:inline-flex; align-items:center; gap:4px;';

    header.append(leftHeader, openSavedBtn);
    wrapper.appendChild(header);

    // File list container
    const listBody = document.createElement('div');
    listBody.style.cssText = 'display:flex; flex-direction:column; max-height:340px; overflow-y:auto;';

    if (files.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.style.cssText = 'padding:24px; text-align:center; color:var(--g500, #64748b); font-size:0.85rem;';
      emptyBox.innerHTML = '<div style="margin-bottom:6px; color:var(--g400, #94a3b8);">' + ICONS.folder + '</div>No saved files found in your workspace.';
      listBody.appendChild(emptyBox);
    } else {
      for (const file of files) {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--g100, #f1f5f9); gap:12px; transition:background .15s;';
        itemRow.onmouseover = () => { itemRow.style.background = 'var(--g50, #f8fafc)'; };
        itemRow.onmouseout = () => { itemRow.style.background = 'transparent'; };

        const itemLeft = document.createElement('div');
        itemLeft.style.cssText = 'display:flex; align-items:center; gap:10px; min-width:0; flex:1;';

        const itemIcon = document.createElement('span');
        itemIcon.innerHTML = ICONS.file;
        itemIcon.style.cssText = 'display:inline-flex; align-items:center; color:var(--g500, #64748b); flex-shrink:0;';

        const itemMeta = document.createElement('div');
        itemMeta.style.cssText = 'min-width:0; flex:1;';

        const itemName = document.createElement('div');
        itemName.textContent = file.name;
        itemName.style.cssText = 'font-size:0.86rem; font-weight:700; color:var(--text, #0f172a); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

        const itemSub = document.createElement('div');
        const sizeStr = file.bytes ? (file.bytes > 1048576 ? `${(file.bytes/1048576).toFixed(1)} MB` : `${Math.round(file.bytes/1024)} KB`) : 'Text file';
        const syncIcon = file.isCloudSynced ? ICONS.cloud : ICONS.local;
        itemSub.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${(file.kind || 'file').toUpperCase()} · ${sizeStr} · <span title="${file.isCloudSynced ? 'Cloud' : 'Local'}" style="display:inline-flex; align-items:center;">${syncIcon}</span></span>`;
        itemSub.style.cssText = 'font-size:0.72rem; color:var(--g500, #64748b); margin-top:1px;';

        itemMeta.append(itemName, itemSub);
        itemLeft.append(itemIcon, itemMeta);

        const itemActions = document.createElement('div');
        itemActions.style.cssText = 'display:flex; align-items:center; gap:6px; flex-shrink:0;';

        const viewLink = document.createElement('a');
        viewLink.href = `#/saved?id=${encodeURIComponent(file.id)}`;
        viewLink.textContent = 'View';
        viewLink.className = 'btn btn-secondary btn-sm';
        viewLink.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; text-decoration:none; cursor:pointer;';

        const downloadAction = document.createElement('button');
        downloadAction.type = 'button';
        downloadAction.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.download} Download</span>`;
        downloadAction.className = 'btn btn-sm';
        downloadAction.style.cssText = 'font-size:0.75rem; padding:4px 12px; background:var(--black, #0f172a); color:#fff; border-radius:9999px; cursor:pointer;';
        downloadAction.addEventListener('click', async () => {
          try {
            const { get } = await import('./artifacts.js');
            const fullItem = get(file.id);
            if (fullItem) {
              const mime = file.kind === 'csv' ? 'text/csv' : (file.kind === 'json' ? 'application/json' : 'text/plain');
              const dataUrl = fullItem.dataUrl || `data:${mime};charset=utf-8,${encodeURIComponent(fullItem.text || '')}`;
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = file.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          } catch {}
        });

        itemActions.append(viewLink, downloadAction);
        itemRow.append(itemLeft, itemActions);
        listBody.appendChild(itemRow);
      }
    }

    wrapper.appendChild(listBody);
    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * IMAGE & QR CODE RESULT — Displays rendered QR codes and graphics directly with actions
 */
export class ImageResultRenderer extends ResultRenderer {
  static id = 'image';
  static name = 'Image / QR Code';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'image' ||
      result.type === 'image' ||
      (data.dataUrl && (typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/')));
  }

  static render(result, container) {
    const data = result.data || {};
    const imgUrl = data.dataUrl;
    const filename = data.filename || `image_${Date.now()}.png`;

    const el = document.createElement('div');
    el.className = 'assistant-result-image-card';
    el.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04); max-width:420px;';

    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = 'display:flex; justify-content:center; align-items:center; background:var(--g50, #f8fafc); border-radius:10px; padding:16px; border:1px solid var(--g200, #e2e8f0);';

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = data.text || filename;
    img.style.cssText = 'max-width:100%; max-height:280px; height:auto; object-fit:contain; border-radius:6px;';
    imgWrapper.appendChild(img);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; gap:8px; flex-wrap:wrap;';

    const caption = document.createElement('div');
    caption.textContent = data.text || data.message || filename;
    caption.style.cssText = 'font-size:0.8rem; color:var(--g600, #64748b); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;';

    const downloadLink = document.createElement('a');
    downloadLink.href = imgUrl;
    downloadLink.download = filename;
    downloadLink.textContent = 'Save Image';
    downloadLink.style.cssText = 'padding:6px 12px; border-radius:7px; background:var(--black, #0f172a); color:var(--white, #fff); font-size:0.78rem; font-weight:700; text-decoration:none; cursor:pointer;';

    footer.append(caption, downloadLink);
    el.append(imgWrapper, footer);
    container.appendChild(el);
    return el;
  }
}

/**
 * CHART RESULT — Canvas data visualization (Line, Bar, Area, Fibonacci series, Distributions)
 */
export class ChartResultRenderer extends ResultRenderer {
  static id = 'chart';
  static name = 'Chart Visualization';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'chart' ||
      result.type === 'chart' ||
      Boolean(data.chartType || data.datasets || data.labels);
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'Chart Visualization';
    const chartType = (data.chartType || 'line').toLowerCase();
    const labels = data.labels || [];
    const dataset = data.datasets?.[0] || { label: title, data: [] };
    const values = dataset.data || [];

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-chart';
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04); min-height:260px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a);';

    const badge = document.createElement('span');
    badge.textContent = `${chartType.toUpperCase()} (${values.length} points)`;
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100, #f1f5f9); color:var(--g700, #334155); font-weight:700;';

    header.append(titleEl, badge);
    wrapper.appendChild(header);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 240;
    canvas.style.cssText = 'width:100%; height:240px; display:block;';
    wrapper.appendChild(canvas);

    // Draw canvas chart
    setTimeout(() => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const padL = 48, padR = 24, padT = 20, padB = 36;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        ctx.clearRect(0, 0, w, h);

        if (!values.length) {
          ctx.fillStyle = '#64748b';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('No data points to render', w / 2, h / 2);
          return;
        }

        const maxVal = Math.max(...values, 1);
        const minVal = Math.min(...values, 0);
        const range = (maxVal - minVal) || 1;

        // Draw grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';

        for (let i = 0; i <= 4; i++) {
          const y = padT + (plotH / 4) * i;
          const val = maxVal - (range / 4) * i;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.stroke();
          ctx.fillText(Number(val).toLocaleString(undefined, { maximumFractionDigits: 1 }), padL - 6, y + 3);
        }

        // Plot points
        const count = values.length;
        const stepX = plotW / Math.max(1, count - (chartType === 'bar' ? 0 : 1));

        if (chartType === 'bar') {
          const barW = Math.max(6, Math.min(32, (plotW / count) * 0.7));
          ctx.fillStyle = dataset.backgroundColor || 'rgba(59, 130, 246, 0.65)';
          ctx.strokeStyle = dataset.borderColor || '#2563eb';
          ctx.lineWidth = 1.5;

          values.forEach((v, i) => {
            const x = padL + (i * (plotW / count)) + ((plotW / count) - barW) / 2;
            const barH = ((v - minVal) / range) * plotH;
            const y = padT + plotH - barH;

            ctx.fillRect(x, y, barW, barH);
            ctx.strokeRect(x, y, barW, barH);

            // Label
            if (labels[i] && count <= 15) {
              ctx.fillStyle = '#64748b';
              ctx.textAlign = 'center';
              ctx.fillText(String(labels[i]), x + barW / 2, h - 12);
            }
          });
        } else {
          // Line or Area chart
          const points = values.map((v, i) => ({
            x: padL + i * stepX,
            y: padT + plotH - (((v - minVal) / range) * plotH)
          }));

          // Fill area
          ctx.beginPath();
          ctx.moveTo(points[0].x, padT + plotH);
          points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.lineTo(points[points.length - 1].x, padT + plotH);
          ctx.closePath();
          ctx.fillStyle = dataset.backgroundColor || 'rgba(59, 130, 246, 0.15)';
          ctx.fill();

          // Draw line
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.strokeStyle = dataset.borderColor || '#3b82f6';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Draw dots
          points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = dataset.borderColor || '#3b82f6';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (labels[i] && count <= 15) {
              ctx.fillStyle = '#64748b';
              ctx.textAlign = 'center';
              ctx.fillText(String(labels[i]), p.x, h - 12);
            }
          });
        }
      } catch (err) {
        console.warn('Canvas chart render failed:', err);
      }
    }, 10);

    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * LOGIC LAB CIRCUIT RESULT — Renders logic gate schematic (SVG) and truth table
 */
export class CircuitResultRenderer extends ResultRenderer {
  static id = 'circuit';
  static name = 'Logic Lab Circuit';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'circuit' ||
      result.type === 'circuit' ||
      Boolean(data.circuit);
  }

  static render(result, container) {
    const data = result.data || {};
    const circuit = data.circuit || { nodes: [], wires: [] };
    const title = data.title || circuit.name || 'Logic Gate Circuit';
    const truthTable = data.truthTable;

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-circuit';
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a);';
    const badge = document.createElement('span');
    badge.textContent = 'Logic Lab';
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:#dbeafe; color:#1e40af; font-weight:700;';
    header.append(titleEl, badge);
    wrapper.appendChild(header);

    // SVG Schematic View
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 720 320');
    svg.style.cssText = 'width:100%; max-height:300px; background:#0f172a; border-radius:10px; display:block;';

    // Grid dots
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <pattern id="gridDots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="#334155"/>
      </pattern>
    `;
    svg.appendChild(defs);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'url(#gridDots)');
    svg.appendChild(rect);

    // Map nodes by id
    const nodeMap = new Map();
    (circuit.nodes || []).forEach(n => nodeMap.set(n.id, n));

    // Draw Wires
    (circuit.wires || []).forEach(w => {
      const fromNode = nodeMap.get(w.from);
      const toNode = nodeMap.get(w.to);
      if (fromNode && toNode) {
        const x1 = (fromNode.x || 50) + 60;
        const y1 = (fromNode.y || 50) + 20;
        const x2 = toNode.x || 200;
        const y2 = (toNode.y || 50) + 20 + ((w.toPort || 0) * 12);
        const midX = (x1 + x2) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
        path.setAttribute('stroke', '#38bdf8');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }
    });

    // Draw Nodes (Gates & I/O)
    (circuit.nodes || []).forEach(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${n.x || 50}, ${n.y || 50})`);

      const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      box.setAttribute('width', '64');
      box.setAttribute('height', '36');
      box.setAttribute('rx', '6');
      box.setAttribute('fill', n.type === 'input' ? '#1e293b' : n.type === 'output' ? '#047857' : '#1e3a8a');
      box.setAttribute('stroke', n.type === 'input' ? '#475569' : n.type === 'output' ? '#10b981' : '#3b82f6');
      box.setAttribute('stroke-width', '1.5');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '32');
      text.setAttribute('y', '22');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'sans-serif');
      text.textContent = (n.label || n.type || '').toUpperCase();

      g.append(box, text);
      svg.appendChild(g);
    });

    wrapper.appendChild(svg);

    // Truth Table (rendered ONCE as clean table)
    if (truthTable && truthTable.headers && truthTable.rows) {
      const tableSection = document.createElement('div');
      tableSection.style.cssText = 'margin-top:14px;';

      const tableTitle = document.createElement('div');
      tableTitle.textContent = 'Truth Table';
      tableTitle.style.cssText = 'font-weight:700; font-size:0.82rem; color:var(--g700, #334155); margin-bottom:6px;';
      tableSection.appendChild(tableTitle);

      const tbl = document.createElement('table');
      tbl.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.8rem; font-family:var(--mono, monospace); text-align:center;';

      const thead = document.createElement('thead');
      const htr = document.createElement('tr');
      truthTable.headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = 'padding:6px 10px; background:var(--g100, #f1f5f9); border:1px solid var(--g300, #cbd5e1); font-weight:700;';
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      tbl.appendChild(thead);

      const tbody = document.createElement('tbody');
      truthTable.rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        tr.style.background = ri % 2 === 0 ? 'var(--white, #fff)' : 'var(--g50, #f8fafc)';
        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          td.style.cssText = 'padding:5px 8px; border:1px solid var(--g300, #cbd5e1);';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      tableSection.appendChild(tbl);
      wrapper.appendChild(tableSection);
    }

    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * FLOWCHART RESULT — Visual nested diagram of algorithms and control flow
 */
export class FlowchartResultRenderer extends ResultRenderer {
  static id = 'flowchart';
  static name = 'Visual Flowchart';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'flowchart' ||
      result.type === 'flowchart' ||
      Boolean(data.nodes && Array.isArray(data.nodes));
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'Algorithm Flowchart';
    const nodes = data.nodes || [];
    const generatedCode = data.generatedCode || {};
    const pythonCode = generatedCode.python || data.code || '';
    const jsCode = generatedCode.javascript || '';

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-flowchart';
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;';
    
    const leftHeader = document.createElement('div');
    leftHeader.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a);';
    const badge = document.createElement('span');
    badge.textContent = 'Flowchart & Code';
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:#eff6ff; color:#1e40af; font-weight:700;';
    leftHeader.append(titleEl, badge);

    const rightActions = document.createElement('div');
    rightActions.style.cssText = 'display:flex; align-items:center; gap:6px;';

    const openToolBtn = document.createElement('button');
    openToolBtn.type = 'button';
    openToolBtn.className = 'btn btn-secondary btn-sm';
    openToolBtn.textContent = 'Open in Flowchart Tool ↗';
    openToolBtn.style.cssText = 'font-size:0.75rem; font-weight:700; padding:4px 10px; cursor:pointer;';
    openToolBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox_flowchart_import', JSON.stringify({ nodes, lang: 'python' }));
      } catch {}
      window.location.hash = '#flowchart';
    });

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary btn-sm';
    copyBtn.textContent = 'Copy Code';
    copyBtn.style.cssText = 'font-size:0.75rem; font-weight:600; padding:4px 10px; cursor:pointer;';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(pythonCode || jsCode);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = original; }, 2000);
    });

    rightActions.append(openToolBtn, copyBtn);
    header.append(leftHeader, rightActions);
    wrapper.appendChild(header);

    // Tab Switcher: [Flowchart Diagram] | [Python Code] | [JavaScript Code]
    const tabNav = document.createElement('div');
    tabNav.style.cssText = 'display:flex; gap:6px; margin-bottom:12px; border-bottom:1px solid var(--g200, #e2e8f0); padding-bottom:6px;';

    const tabChart = document.createElement('button');
    tabChart.textContent = 'Flowchart Diagram';
    tabChart.style.cssText = 'padding:4px 12px; border-radius:6px; border:none; background:#0f172a; color:#fff; font-size:0.78rem; font-weight:700; cursor:pointer;';

    const tabPy = document.createElement('button');
    tabPy.textContent = 'Python Code';
    tabPy.style.cssText = 'padding:4px 12px; border-radius:6px; border:1px solid var(--g300, #cbd5e1); background:#fff; color:#334155; font-size:0.78rem; font-weight:600; cursor:pointer;';

    const tabJs = document.createElement('button');
    tabJs.textContent = 'JavaScript Code';
    tabJs.style.cssText = 'padding:4px 12px; border-radius:6px; border:1px solid var(--g300, #cbd5e1); background:#fff; color:#334155; font-size:0.78rem; font-weight:600; cursor:pointer;';

    tabNav.append(tabChart, tabPy, tabJs);
    wrapper.appendChild(tabNav);

    // Chart Canvas Container
    const chartBox = document.createElement('div');
    chartBox.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:8px; padding:18px 12px; background:var(--g50, #f8fafc); border-radius:10px; border:1px solid var(--g200, #e2e8f0); overflow-x:auto;';

    // Code View Container (hidden by default)
    const codeBox = document.createElement('pre');
    codeBox.style.cssText = 'display:none; margin:0; padding:16px; border-radius:10px; background:#0f172a; color:#f8fafc; font-family:var(--mono, monospace); font-size:0.84rem; line-height:1.6; overflow-x:auto;';

    // Tab Switch Behavior
    const activateTab = (activeBtn, showChart, codeContent) => {
      [tabChart, tabPy, tabJs].forEach(b => {
        b.style.background = '#fff';
        b.style.color = '#334155';
        b.style.border = '1px solid var(--g300, #cbd5e1)';
        b.style.fontWeight = '600';
      });
      activeBtn.style.background = '#0f172a';
      activeBtn.style.color = '#fff';
      activeBtn.style.border = 'none';
      activeBtn.style.fontWeight = '700';

      if (showChart) {
        chartBox.style.display = 'flex';
        codeBox.style.display = 'none';
      } else {
        chartBox.style.display = 'none';
        codeBox.style.display = 'block';
        codeBox.textContent = codeContent;
      }
    };

    tabChart.addEventListener('click', () => activateTab(tabChart, true, ''));
    tabPy.addEventListener('click', () => activateTab(tabPy, false, pythonCode));
    tabJs.addEventListener('click', () => activateTab(tabJs, false, jsCode || pythonCode));

    // Helper to render nodes recursively
    const renderNodeItem = (n) => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%;';

      const kind = n.kind || n.type || '';
      const isTerminal = kind === 'start' || kind === 'end';
      const isDecision = kind === 'if' || kind === 'while' || kind === 'for';

      const box = document.createElement('div');
      box.style.cssText = `
        padding: 8px 16px;
        border-radius: ${isTerminal ? '20px' : isDecision ? '6px' : '8px'};
        background: ${isTerminal ? '#3b82f6' : isDecision ? '#f59e0b' : kind === 'output' ? '#10b981' : '#ffffff'};
        color: ${isTerminal || isDecision || kind === 'output' ? '#ffffff' : '#0f172a'};
        border: 1.5px solid ${isTerminal ? '#2563eb' : isDecision ? '#d97706' : kind === 'output' ? '#059669' : '#cbd5e1'};
        font-weight: 700;
        font-size: 0.82rem;
        text-align: center;
        max-width: 340px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      `;

      let text = kind;
      if (kind === 'declare') text = `Declare ${n.name} (${n.dataType || 'Integer'})`;
      else if (kind === 'assign') text = `${n.name} = ${n.expr}`;
      else if (kind === 'output') text = `🖨️ Output: ${n.expr}`;
      else if (kind === 'input') text = `📥 Input: ${n.name}`;
      else if (kind === 'if') text = `Decision: If (${n.cond})`;
      else if (kind === 'while') text = `Loop: While (${n.cond})`;
      else if (kind === 'for') text = `Loop: For (${n.name} = ${n.from} to ${n.to})`;
      else if (kind === 'comment') text = `// ${n.text}`;
      box.textContent = text;
      item.appendChild(box);

      // Render nested branches for if conditions
      if (kind === 'if' && (n.then?.length || n.else?.length)) {
        const branchContainer = document.createElement('div');
        branchContainer.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%; max-width:440px; margin-top:8px;';

        const trueCol = document.createElement('div');
        trueCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px;';
        const trueLabel = document.createElement('span');
        trueLabel.textContent = 'True';
        trueLabel.style.cssText = 'font-size:0.72rem; font-weight:800; color:#16a34a; margin-bottom:6px;';
        trueCol.appendChild(trueLabel);
        (n.then || []).forEach(child => trueCol.appendChild(renderNodeItem(child)));

        const falseCol = document.createElement('div');
        falseCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px;';
        const falseLabel = document.createElement('span');
        falseLabel.textContent = 'False';
        falseLabel.style.cssText = 'font-size:0.72rem; font-weight:800; color:#dc2626; margin-bottom:6px;';
        falseCol.appendChild(falseLabel);
        (n.else || []).forEach(child => falseCol.appendChild(renderNodeItem(child)));

        branchContainer.append(trueCol, falseCol);
        item.appendChild(branchContainer);
      }

      // Render nested loop body for while / for
      if ((kind === 'while' || kind === 'for') && n.body?.length) {
        const bodyCol = document.createElement('div');
        bodyCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%; max-width:380px; margin-top:8px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:8px;';
        const bodyLabel = document.createElement('span');
        bodyLabel.textContent = 'Loop Body';
        bodyLabel.style.cssText = 'font-size:0.72rem; font-weight:800; color:#475569; margin-bottom:6px;';
        bodyCol.appendChild(bodyLabel);
        n.body.forEach(child => bodyCol.appendChild(renderNodeItem(child)));
        item.appendChild(bodyCol);
      }

      // Down arrow
      const arrow = document.createElement('div');
      arrow.textContent = '↓';
      arrow.style.cssText = 'color:#94a3b8; font-weight:bold; margin:2px 0;';
      item.appendChild(arrow);

      return item;
    };

    // Terminal Start
    const startNode = renderNodeItem({ kind: 'start' });
    chartBox.appendChild(startNode);

    // Nodes
    nodes.forEach(n => {
      chartBox.appendChild(renderNodeItem(n));
    });

    // Terminal End
    const endBox = document.createElement('div');
    endBox.textContent = 'End';
    endBox.style.cssText = 'padding:8px 24px; border-radius:20px; background:#10b981; color:#fff; font-weight:700; font-size:0.82rem; border:1.5px solid #059669;';
    chartBox.appendChild(endBox);

    wrapper.append(chartBox, codeBox);
    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * CODE EXECUTION RESULT — Separates source code block from dark terminal console output
 */
export class CodeExecutionResultRenderer extends ResultRenderer {
  static id = 'code-execution';
  static name = 'Code & Execution Output';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'code-execution' ||
      result.type === 'code-execution' ||
      (data.language && (data.code || data.output !== undefined));
  }

  static render(result, container) {
    const data = result.data || {};
    const lang = data.language || 'javascript';
    const codeText = data.code || '';
    const outputText = data.error || data.output || 'Execution complete.';
    const execTime = data.executionTimeMs ? `${data.executionTimeMs} ms` : 'Done';
    const isError = Boolean(data.error);

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-code-execution';
    wrapper.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; overflow:hidden; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    // 1. Source Code Block
    if (codeText) {
      const codeHeader = document.createElement('div');
      codeHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:var(--g100, #f1f5f9); border-bottom:1px solid var(--g200, #e2e8f0); font-size:0.75rem;';
      const langBadge = document.createElement('strong');
      langBadge.textContent = lang.toUpperCase();
      langBadge.style.cssText = 'color:var(--g700, #334155);';

      const copyCodeBtn = document.createElement('button');
      copyCodeBtn.textContent = 'Copy Code';
      copyCodeBtn.style.cssText = 'border:0; background:transparent; color:var(--primary, #2563eb); font-weight:700; cursor:pointer; font-size:0.72rem;';
      copyCodeBtn.onclick = () => {
        navigator.clipboard.writeText(codeText);
        copyCodeBtn.textContent = 'Copied ✓';
        setTimeout(() => copyCodeBtn.textContent = 'Copy Code', 1500);
      };

      codeHeader.append(langBadge, copyCodeBtn);
      wrapper.appendChild(codeHeader);

      const codePre = document.createElement('pre');
      codePre.style.cssText = 'margin:0; padding:12px 14px; overflow-x:auto; font:12px/1.55 var(--mono, monospace); background:var(--white, #fff); color:var(--text, #0f172a);';
      codePre.textContent = codeText;
      wrapper.appendChild(codePre);
    }

    // 2. Terminal Output Console
    const consoleSection = document.createElement('div');
    consoleSection.style.cssText = 'background:#0f172a; color:#f8fafc; border-top:1px solid #1e293b;';

    const consoleHeader = document.createElement('div');
    consoleHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:7px 14px; background:#1e293b; font-size:0.72rem;';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = isError ? '❌ Execution Error' : '⚡ Output Console';
    statusLabel.style.cssText = `font-weight:700; color:${isError ? '#f87171' : '#38bdf8'};`;

    const timeBadge = document.createElement('span');
    timeBadge.textContent = execTime;
    timeBadge.style.color = '#94a3b8';

    consoleHeader.append(statusLabel, timeBadge);
    consoleSection.appendChild(consoleHeader);

    const outputPre = document.createElement('pre');
    outputPre.style.cssText = `margin:0; padding:12px 14px; overflow-x:auto; white-space:pre-wrap; font:12px/1.55 var(--mono, monospace); color:${isError ? '#fca5a5' : '#4ade80'};`;
    outputPre.textContent = outputText;
    consoleSection.appendChild(outputPre);

    wrapper.appendChild(consoleSection);
    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * TRANSFORM RESULT — Clean, dedicated copyable result box for slugs, hashes, base64, clean text
 */
export class TransformResultRenderer extends ResultRenderer {
  static id = 'transform';
  static name = 'Transformation Result';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'transform' ||
      result.type === 'transform' ||
      Boolean(data.operation && data.resultText);
  }

  static render(result, container) {
    const data = result.data || {};
    const op = data.operation || 'Result';
    const resultText = data.resultText || data.output || '';

    const el = document.createElement('div');
    el.className = 'assistant-result-transform';
    el.style.cssText = 'margin-top:10px; padding:14px 16px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';

    const opBadge = document.createElement('span');
    opBadge.textContent = op.toUpperCase();
    opBadge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100, #f1f5f9); color:var(--g700, #334155); font-weight:700;';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'assistant-transform-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'padding:4px 10px; border-radius:6px; border:1px solid var(--g300, #cbd5e1); background:var(--white, #fff); font-size:0.75rem; font-weight:700; cursor:pointer;';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(resultText);
      copyBtn.textContent = 'Copied ✓';
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = '#ffffff';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.style.background = 'var(--white, #fff)';
        copyBtn.style.color = 'inherit';
      }, 1500);
    };

    header.append(opBadge, copyBtn);
    el.appendChild(header);

    const box = document.createElement('div');
    box.style.cssText = 'padding:10px 12px; background:var(--g50, #f8fafc); border:1px solid var(--g200, #e2e8f0); border-radius:8px; font:700 0.95rem var(--mono, monospace); color:var(--text, #0f172a); word-break:break-all; user-select:all;';
    box.textContent = resultText;
    el.appendChild(box);

    container.appendChild(el);
    return el;
  }
}

/**
 * JSON RESULT — Interactive formatted JSON viewer with copy and download
 */
export class JsonResultRenderer extends ResultRenderer {
  static id = 'json';
  static name = 'JSON Viewer';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'json' ||
      result.type === 'json' ||
      data.json !== undefined ||
      data.jsonString !== undefined;
  }

  static render(result, container) {
    const data = result.data || {};
    const rawObj = data.json !== undefined ? data.json : data;
    const jsonStr = data.jsonString || JSON.stringify(rawObj, null, 2);

    const el = document.createElement('div');
    el.className = 'assistant-result-json';
    el.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; overflow:hidden; background:#0f172a; color:#e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#1e293b; font-size:0.75rem;';
    const label = document.createElement('strong');
    label.textContent = `JSON (${data.rowCount ? `${data.rowCount} items` : 'Object'})`;
    label.style.color = '#38bdf8';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:8px;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy JSON';
    copyBtn.style.cssText = 'border:0; background:transparent; color:#e2e8f0; font-weight:700; font-size:0.72rem; cursor:pointer;';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(jsonStr);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => copyBtn.textContent = 'Copy JSON', 1500);
    };

    actions.appendChild(copyBtn);
    header.append(label, actions);
    el.appendChild(header);

    const pre = document.createElement('pre');
    pre.style.cssText = 'margin:0; padding:12px 14px; max-height:320px; overflow:auto; font:12px/1.55 var(--mono, monospace); white-space:pre;';
    pre.textContent = jsonStr;
    el.appendChild(pre);

    container.appendChild(el);
    return el;
  }
}

/**
 * TABLE RESULT — Structured tabular view with row numbering and copy
 */
export class TableResultRenderer extends ResultRenderer {
  static id = 'table';
  static name = 'Table';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'table' ||
      result.type === 'table' ||
      Boolean(data.rows && (data.headers || data.columns));
  }

  static render(result, container) {
    const data = result.data || {};
    const headers = data.headers || data.columns || [];
    const rows = data.rows || [];

    const el = document.createElement('div');
    el.className = 'assistant-result-table';
    el.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; overflow:hidden; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const scrollBox = document.createElement('div');
    scrollBox.style.cssText = 'overflow-x:auto; max-height:360px;';

    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left;';

    if (headers.length) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = typeof h === 'object' ? h.label || h.name : String(h);
        th.style.cssText = 'padding:8px 12px; background:var(--g100, #f1f5f9); border-bottom:1px solid var(--g300, #cbd5e1); font-weight:700; color:var(--text, #0f172a); position:sticky; top:0;';
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    rows.forEach((row, ri) => {
      const tr = document.createElement('tr');
      tr.style.background = ri % 2 === 0 ? 'var(--white, #fff)' : 'var(--g50, #f8fafc)';
      const cells = Array.isArray(row) ? row : Object.values(row);
      cells.forEach(c => {
        const td = document.createElement('td');
        td.textContent = c !== null && c !== undefined ? String(c) : '';
        td.style.cssText = 'padding:6px 12px; border-bottom:1px solid var(--g200, #e2e8f0); color:var(--g800, #1e293b);';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scrollBox.appendChild(table);
    el.appendChild(scrollBox);

    container.appendChild(el);
    return el;
  }
}

/**
 * SPEED TEST RESULT
 */
export class SpeedTestResultRenderer extends ResultRenderer {
  static id = 'speed-test';
  static name = 'Speed Test';
  static canRender(result) {
    return result.renderer === 'speed-test' || typeof result.data?.downloadSpeedMbps !== 'undefined';
  }
  static render(result, container) {
    const data = result.data || {};
    const el = document.createElement('section');
    el.className = 'assistant-result-speed-test';
    el.style.cssText = 'margin-top:10px; padding:14px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;';
    const title = document.createElement('strong');
    title.textContent = 'Network Speed Test';
    const location = document.createElement('span');
    location.textContent = data.city || data.country || 'Online';
    location.style.cssText = 'font-size:.75rem; color:var(--g600, #64748b);';
    header.append(title, location);

    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px;';
    for (const [label, value, unit] of [
      ['Download', data.downloadSpeedMbps, 'Mbps'],
      ['Latency', data.latencyMs, 'ms'],
      ['Jitter', data.jitterMs, 'ms']
    ]) {
      const metric = document.createElement('div');
      metric.style.cssText = 'padding:9px 8px; border:1px solid var(--g200, #e2e8f0); border-radius:9px; background:var(--g50, #f8fafc); text-align:center;';
      const name = document.createElement('div');
      name.textContent = label;
      name.style.cssText = 'font-size:.65rem; color:var(--g600, #64748b); font-weight:700; text-transform:uppercase;';
      const number = document.createElement('div');
      number.textContent = `${value ?? '—'} ${unit}`;
      number.style.cssText = 'margin-top:3px; font:700 1rem var(--mono, monospace); color:var(--text, #0f172a);';
      metric.append(name, number);
      metrics.appendChild(metric);
    }

    const footer = document.createElement('div');
    footer.textContent = [data.isp, data.ip, data.verdict].filter(Boolean).join(' · ');
    footer.style.cssText = 'margin-top:10px; font-size:.75rem; color:var(--g600, #64748b);';

    el.append(header, metrics, footer);
    container.appendChild(el);
    return el;
  }
}

/**
 * AUDIO PLAYER RESULT
 */
export class AudioPlayerResultRenderer extends ResultRenderer {
  static id = 'audio-player';
  static name = 'Audio Player';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'audio-player' || (data.url && data.audioId);
  }

  static render(result, container) {
    const data = result.data || {};
    const el = document.createElement('div');
    el.className = 'assistant-result-audio-player';
    el.setAttribute('data-audio-id', data.audioId);
    el.style.cssText = 'margin-top:10px; padding:14px; background:var(--white, #fff); border:1px solid var(--g300, #e2e8f0); border-radius:14px; box-shadow:0 2px 8px rgba(0,0,0,.05);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px; min-width:0;';
    if (data.artworkUrl) {
      const artwork = document.createElement('img');
      artwork.src = data.artworkUrl;
      artwork.alt = '';
      artwork.style.cssText = 'width:40px; height:40px; border-radius:9px; object-fit:cover; flex:0 0 auto;';
      header.appendChild(artwork);
    }
    const labels = document.createElement('div');
    labels.style.cssText = 'min-width:0; flex:1;';
    const title = document.createElement('div');
    title.textContent = data.title || 'Audio';
    title.style.cssText = 'font-weight:750; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    const artist = document.createElement('div');
    artist.textContent = data.artist || 'Toolbox Audio';
    artist.style.cssText = 'font-size:.76rem; color:var(--g600, #64748b); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    labels.append(title, artist);
    header.appendChild(labels);
    el.appendChild(header);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:8px;';

    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-action', 'play');
    playBtn.textContent = 'Play';
    playBtn.style.cssText = 'border:0; border-radius:8px; padding:7px 12px; background:var(--black, #0f172a); color:var(--white, #fff); font-weight:700; cursor:pointer;';
    controls.appendChild(playBtn);

    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-action', 'stop');
    stopBtn.textContent = 'Stop';
    stopBtn.style.cssText = 'border:1px solid var(--g300, #cbd5e1); border-radius:8px; padding:7px 12px; background:var(--white, #fff); color:#b91c1c; cursor:pointer;';
    controls.appendChild(stopBtn);

    el.appendChild(controls);
    container.appendChild(el);
    return el;
  }
}

/**
 * ERROR RESULT
 */
export class ErrorResultRenderer extends ResultRenderer {
  static id = 'error';
  static name = 'Error';

  static canRender(result) {
    return result.success === false || Boolean(result.error);
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-error';
    el.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; font-size:0.85rem; font-weight:600;';
    el.textContent = result.error || (typeof result.data === 'string' ? result.data : result.data?.message) || 'Operation failed.';
    container.appendChild(el);
    return el;
  }
}

/**
 * FILE SAVED RESULT — Rendered when Assistant or user explicitly saves a file to Cloud / Local Saved Work
 */
export class FileSavedResultRenderer extends ResultRenderer {
  static id = 'file-saved';
  static name = 'Saved File';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'file-saved' ||
      result.type === 'file-saved' ||
      Boolean(data.artifactId && (data.filename || data.isCloudSynced !== undefined));
  }

  static render(result, container) {
    const data = result.data || {};
    const filename = data.filename || 'saved_file.txt';
    const isCloud = data.destination === 'cloud' || data.isCloudSynced;

    const card = document.createElement('div');
    card.className = 'assistant-result-saved-card';
    card.style.cssText = 'margin-top:8px; padding:8px 14px; border:1px solid var(--g200, #e2e8f0); border-radius:10px; background:var(--g50, #f8fafc); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:0.85rem;';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:8px; min-width:0;';

    const icon = document.createElement('span');
    icon.innerHTML = isCloud ? ICONS.cloud : ICONS.local;
    icon.title = isCloud ? 'Saved to Cloud' : 'Saved Locally';
    icon.style.cssText = 'display:inline-flex; align-items:center; color:var(--primary, #2563eb); flex-shrink:0;';

    const nameEl = document.createElement('strong');
    nameEl.textContent = filename;
    nameEl.style.cssText = 'color:var(--text, #0f172a); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:280px;';

    left.append(icon, nameEl);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex; align-items:center; gap:8px; margin-left:auto;';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'assistant-saved-link';
    viewBtn.href = data.artifactId ? `#/saved?id=${data.artifactId}` : '#/saved';
    viewBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">View in Saved Work ${ICONS.external}</span>`;
    viewBtn.style.cssText = 'font-size:0.78rem; font-weight:700; color:var(--primary, #2563eb); text-decoration:none; padding:4px 12px; border-radius:9999px; background:var(--white, #fff); border:1px solid var(--g300, #cbd5e1); transition:all .15s; white-space:nowrap;';
    viewBtn.onmouseover = () => { viewBtn.style.background = 'var(--g100, #f1f5f9)'; };
    viewBtn.onmouseout = () => { viewBtn.style.background = 'var(--white, #fff)'; };

    right.appendChild(viewBtn);
    card.append(left, right);
    container.appendChild(card);
    return card;
  }
}

/**
 * 3D ANATOMY EXPLORER RESULT — Renders isolated 3D anatomical structures with interactive 360 controls & clinical cards
 */
export class Anatomy3DResultRenderer extends ResultRenderer {
  static id = 'anatomy-3d';
  static name = '3D Anatomy Explorer';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'anatomy-3d' ||
      result.type === 'anatomy-3d' ||
      Boolean(data.structureIds && data.systems);
  }

  static render(result, container) {
    const data = result.data || {};
    const query = data.query || 'Human Anatomy';
    const systems = data.systems || ['skeletal'];
    const structureIds = new Set(data.structureIds || []);
    const structures = data.structures || [];
    const details = data.details || [];

    const card = document.createElement('div');
    card.className = 'assistant-result-anatomy-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 3px 12px rgba(0,0,0,.06); overflow:hidden;';

    // 1. Header with title and system badges
    const header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--g200, #e2e8f0); background:var(--g50, #f8fafc); flex-wrap:wrap; gap:8px;';

    const titleBox = document.createElement('div');
    const titleText = document.createElement('strong');
    titleText.textContent = `3D Anatomy: ${query.charAt(0).toUpperCase() + query.slice(1)}`;
    titleText.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a); display:block;';
    const subText = document.createElement('span');
    subText.textContent = `${structures.length} isolated structure(s) across: ${systems.map(s => s.toUpperCase()).join(' · ')}`;
    subText.style.cssText = 'font-size:0.75rem; color:var(--g600, #64748b); font-weight:600;';
    titleBox.append(titleText, subText);

    const bridgeBtn = document.createElement('a');
    bridgeBtn.className = 'btn btn-secondary btn-sm';
    bridgeBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">Open in Anatomy Explorer ${ICONS.external}</span>`;
    bridgeBtn.style.cssText = 'font-size:0.78rem; font-weight:700; padding:6px 14px; border-radius:9999px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;';
    bridgeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        sessionStorage.setItem('toolbox_anatomy_import', JSON.stringify({
          systems,
          structureIds: Array.from(structureIds)
        }));
      } catch {}
      window.location.hash = '#anatomy-explorer';
    });

    header.append(titleBox, bridgeBtn);
    card.appendChild(header);

    // 2. 3D Canvas Mount
    const stage = document.createElement('div');
    stage.style.cssText = 'position:relative; width:100%; height:320px; background:#090d16; overflow:hidden;';

    const canvasMount = document.createElement('div');
    canvasMount.style.cssText = 'width:100%; height:100%;';
    stage.appendChild(canvasMount);

    // Loading overlay
    const loaderOverlay = document.createElement('div');
    loaderOverlay.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#090d16; color:#94a3b8; font-size:0.85rem; font-weight:600; gap:8px; z-index:2; transition:opacity .3s;';
    loaderOverlay.innerHTML = `<div class="t3d-spinner" style="width:28px; height:28px; border:3px solid #334155; border-top-color:#38bdf8; border-radius:50%; animation:spin 1s linear infinite;"></div><span>Loading 3D Anatomy Model…</span>`;
    stage.appendChild(loaderOverlay);

    // Floating toolbar overlay
    const overlayToolbar = document.createElement('div');
    overlayToolbar.style.cssText = 'position:absolute; bottom:10px; left:10px; right:10px; display:flex; justify-content:space-between; align-items:center; pointer-events:none; z-index:3;';

    const leftControls = document.createElement('div');
    leftControls.style.cssText = 'display:flex; gap:6px; pointer-events:auto;';

    const spinBtn = document.createElement('button');
    spinBtn.type = 'button';
    spinBtn.className = 'btn btn-sm';
    spinBtn.textContent = 'Auto-Spin';
    spinBtn.style.cssText = 'background:rgba(15,23,42,0.8); color:#f8fafc; border:1px solid #334155; font-size:0.75rem; padding:5px 12px; border-radius:9999px; backdrop-filter:blur(4px); cursor:pointer;';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-sm';
    resetBtn.textContent = 'Reset View';
    resetBtn.style.cssText = 'background:rgba(15,23,42,0.8); color:#f8fafc; border:1px solid #334155; font-size:0.75rem; padding:5px 12px; border-radius:9999px; backdrop-filter:blur(4px); cursor:pointer;';

    leftControls.append(spinBtn, resetBtn);

    const hint = document.createElement('span');
    hint.textContent = 'Left-drag to rotate · Scroll to zoom';
    hint.style.cssText = 'font-size:0.72rem; color:#94a3b8; background:rgba(15,23,42,0.6); padding:3px 8px; border-radius:9999px; backdrop-filter:blur(4px);';

    overlayToolbar.append(leftControls, hint);
    stage.appendChild(overlayToolbar);
    card.appendChild(stage);

    // 3. Structured Clinical Information Section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = 'padding:16px; background:var(--white, #fff); max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;';

    if (details.length) {
      for (const d of details) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px; border-radius:10px; background:var(--g50, #f8fafc); border:1px solid var(--g200, #e2e8f0);';

        const itemHeader = document.createElement('div');
        itemHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; flex-wrap:wrap; gap:6px;';

        const nameLabel = document.createElement('strong');
        nameLabel.textContent = d.commonName || d.name;
        nameLabel.style.cssText = 'font-size:0.92rem; color:var(--text, #0f172a);';

        const latinName = document.createElement('em');
        latinName.textContent = d.name !== d.commonName ? d.name : '';
        latinName.style.cssText = 'font-size:0.78rem; color:var(--g500, #64748b); margin-left:6px;';
        nameLabel.appendChild(latinName);

        const badge = document.createElement('span');
        badge.textContent = (d.system || 'anatomy').toUpperCase();
        badge.style.cssText = 'font-size:0.7rem; padding:2px 8px; border-radius:9999px; background:var(--primary-light, #eff6ff); color:var(--primary, #2563eb); font-weight:700;';

        itemHeader.append(nameLabel, badge);
        item.appendChild(itemHeader);

        if (d.functionDesc) {
          const fn = document.createElement('p');
          fn.style.cssText = 'font-size:0.82rem; line-height:1.45; color:var(--text, #0f172a); margin:0 0 6px 0;';
          fn.innerHTML = `<strong>Function:</strong> ${d.functionDesc}`;
          item.appendChild(fn);
        }

        if (d.clinicalNotes) {
          const cl = document.createElement('p');
          cl.style.cssText = 'font-size:0.8rem; line-height:1.45; color:var(--g700, #334155); margin:0; background:var(--white, #fff); padding:6px 10px; border-radius:6px; border-left:3px solid var(--primary, #2563eb);';
          cl.innerHTML = `<strong>Clinical Pearls:</strong> ${d.clinicalNotes}`;
          item.appendChild(cl);
        }

        infoSection.appendChild(item);
      }
    } else {
      const emptyNote = document.createElement('div');
      emptyNote.style.cssText = 'font-size:0.82rem; color:var(--g600, #64748b);';
      emptyNote.textContent = data.summary || 'Anatomical model isolated.';
      infoSection.appendChild(emptyNote);
    }

    card.appendChild(infoSection);
    container.appendChild(card);

    // 4. Asynchronous Three.js 3D Model Hydration
    setTimeout(async () => {
      try {
        if (typeof window === 'undefined' || typeof fetch === 'undefined' || !canvasMount.appendChild) return;

        const [viewerMod, gltfMod, dracoMod] = await Promise.all([
          import('./viewer3d.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js')
        ]);

        const { Viewer3D, THREE } = viewerMod;
        const { GLTFLoader } = gltfMod;
        const { DRACOLoader } = dracoMod;

        const rootPath = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
        const BASE = `${rootPath}anatomy/`.replace(/\/{2,}/g, '/');
        const DRACO = `${rootPath}draco/`.replace(/\/{2,}/g, '/');

        const indexRes = await fetch(`${BASE}index.json`);
        if (!indexRes.ok) throw new Error('Anatomy index missing');
        const index = await indexRes.json();

        const viewer = new Viewer3D(canvasMount, { background: 0x090d16, ground: false, fov: 38 });
        const dracoLoader = new DRACOLoader().setDecoderPath(DRACO);
        const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

        const sceneRoot = new THREE.Group();
        viewer.scene.add(sceneRoot);

        let isSpinning = false;
        spinBtn.addEventListener('click', () => {
          isSpinning = !isSpinning;
          viewer.controls.autoRotate = isSpinning;
          spinBtn.style.background = isSpinning ? '#2563eb' : 'rgba(15,23,42,0.8)';
          spinBtn.textContent = isSpinning ? 'Pause Spin' : 'Auto-Spin';
        });

        // Load all requested system GLB files
        const systemPromises = systems.map(async (sysKey) => {
          const meta = index.systems[sysKey];
          if (!meta) return;

          const gltf = await new Promise((resolve, reject) => {
            gltfLoader.load(`${BASE}${meta.file}`, resolve, undefined, reject);
          });

          const group = gltf.scene;

          for (const child of group.children) {
            const isTarget = structureIds.size === 0 || structureIds.has(child.name);
            child.visible = isTarget;

            if (isTarget) {
              child.traverse(n => {
                if (n.isMesh) {
                  n.material = n.material.clone();
                  n.castShadow = n.receiveShadow = false;
                }
              });
              viewer.registerPickable(child);
            }
          }

          sceneRoot.add(group);
        });

        await Promise.all(systemPromises);

        // Frame and center on the isolated structures
        const box = new THREE.Box3().setFromObject(sceneRoot);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          viewer.controls.target.copy(center);

          const maxDim = Math.max(size.x, size.y, size.z, 0.25);
          const camDist = maxDim * 1.8;
          viewer.camera.position.set(center.x + camDist * 0.4, center.y + camDist * 0.2, center.z + camDist);
          viewer.controls.minDistance = 0.05;
          viewer.controls.maxDistance = 10;
          viewer.controls.update();

          resetBtn.addEventListener('click', () => {
            viewer.controls.target.copy(center);
            viewer.camera.position.set(center.x + camDist * 0.4, center.y + camDist * 0.2, center.z + camDist);
            viewer.controls.update();
          });
        }

        loaderOverlay.style.opacity = '0';
        setTimeout(() => loaderOverlay.remove(), 300);
      } catch (err) {
        console.warn('3D Anatomy Canvas load:', err);
        loaderOverlay.innerHTML = `<span style="color:#ef4444;">3D preview unavailable (${err.message}). View in Anatomy Explorer.</span>`;
      }
    }, 10);

    return card;
  }
}

/**
 * ASSISTANT ILLUSTRATOR RESULT — Renders vector process chains, cycles, hierarchies, matrices, and concepts with image export
 */
export class IllustrationResultRenderer extends ResultRenderer {
  static id = 'illustration';
  static name = 'Visual Illustration';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'illustration' ||
      result.type === 'illustration' ||
      Boolean(data.diagramType && data.steps);
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'Concept Diagram';
    const diagramType = data.diagramType || 'sequence';
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const summary = data.summary || '';

    const card = document.createElement('div');
    card.className = 'assistant-result-illustration-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 3px 12px rgba(0,0,0,.05); overflow:hidden;';

    // 1. Header with Title & Export Actions
    const header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px; background:var(--g50, #f8fafc); border-bottom:1px solid var(--g200, #e2e8f0); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headerLeft = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a); display:block;';
    const typeBadge = document.createElement('span');
    typeBadge.textContent = `${diagramType.toUpperCase()} DIAGRAM · ${steps.length} STAGE${steps.length === 1 ? '' : 'S'}`;
    typeBadge.style.cssText = 'font-size:0.7rem; color:var(--primary, #2563eb); font-weight:700;';
    headerLeft.append(titleEl, typeBadge);

    const headerActions = document.createElement('div');
    headerActions.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;';

    const savePngBtn = document.createElement('button');
    savePngBtn.type = 'button';
    savePngBtn.className = 'btn btn-secondary btn-sm';
    savePngBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.download} Save PNG</span>`;
    savePngBtn.style.cssText = 'font-size:0.75rem; padding:5px 12px; border-radius:9999px; cursor:pointer; font-weight:600;';

    const saveSvgBtn = document.createElement('button');
    saveSvgBtn.type = 'button';
    saveSvgBtn.className = 'btn btn-secondary btn-sm';
    saveSvgBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.download} Save SVG</span>`;
    saveSvgBtn.style.cssText = 'font-size:0.75rem; padding:5px 12px; border-radius:9999px; cursor:pointer; font-weight:600;';

    const saveWorkBtn = document.createElement('button');
    saveWorkBtn.type = 'button';
    saveWorkBtn.className = 'btn btn-sm';
    saveWorkBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.cloud} Save to Work</span>`;
    saveWorkBtn.style.cssText = 'font-size:0.75rem; padding:5px 14px; border-radius:9999px; background:var(--black, #0f172a); color:#fff; cursor:pointer; font-weight:700;';

    headerActions.append(savePngBtn, saveSvgBtn, saveWorkBtn);
    header.append(headerLeft, headerActions);
    card.appendChild(header);

    // 2. Visual Diagram Canvas Container
    const diagramWrapper = document.createElement('div');
    diagramWrapper.style.cssText = 'padding:24px 16px; background:linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); overflow-x:auto; border-bottom:1px solid var(--g200, #e2e8f0);';

    const diagramInner = document.createElement('div');
    diagramInner.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:10px; min-width:min-content; margin:0 auto; flex-wrap:wrap;';

    // Render Steps / Nodes
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      const nodeBox = document.createElement('div');
      nodeBox.style.cssText = 'display:flex; flex-direction:column; align-items:center; text-align:center; min-width:130px; max-width:170px; padding:14px 12px; background:var(--white, #fff); border:1.5px solid var(--g300, #cbd5e1); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,.04); position:relative;';

      const stepBadge = document.createElement('span');
      stepBadge.textContent = step.badge || `Stage ${i + 1}`;
      stepBadge.style.cssText = 'font-size:0.68rem; font-weight:800; color:var(--primary, #2563eb); background:var(--primary-light, #eff6ff); padding:2px 8px; border-radius:9999px; margin-bottom:6px;';

      const nodeTitle = document.createElement('div');
      nodeTitle.textContent = step.label;
      nodeTitle.style.cssText = 'font-size:0.88rem; font-weight:700; color:var(--text, #0f172a); margin-bottom:4px; line-height:1.3;';

      nodeBox.append(stepBadge, nodeTitle);

      if (step.description) {
        const nodeDesc = document.createElement('div');
        nodeDesc.textContent = step.description;
        nodeDesc.style.cssText = 'font-size:0.72rem; color:var(--g600, #64748b); line-height:1.35; margin-top:2px;';
        nodeBox.appendChild(nodeDesc);
      }

      diagramInner.appendChild(nodeBox);

      // Add directional arrow between sequential steps
      if (i < steps.length - 1) {
        const arrow = document.createElement('div');
        arrow.style.cssText = 'display:flex; align-items:center; justify-content:center; color:var(--primary, #2563eb); flex-shrink:0; padding:0 2px;';
        arrow.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
        diagramInner.appendChild(arrow);
      }
    }

    diagramWrapper.appendChild(diagramInner);
    card.appendChild(diagramWrapper);

    // 3. Summary & Educational Walkthrough
    if (summary) {
      const summaryBox = document.createElement('div');
      summaryBox.style.cssText = 'padding:16px; background:var(--white, #fff); font-size:0.86rem; line-height:1.6; color:var(--text, #0f172a);';
      const summaryHeader = document.createElement('div');
      summaryHeader.style.cssText = 'font-weight:700; color:var(--g700, #334155); margin-bottom:6px; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;';
      summaryHeader.textContent = 'Concept Breakdown & Analysis';

      const summaryText = document.createElement('div');
      summaryText.textContent = summary;
      summaryText.style.cssText = 'color:var(--text, #0f172a);';

      summaryBox.append(summaryHeader, summaryText);
      card.appendChild(summaryBox);
    }

    // 4. Export Listeners
    saveSvgBtn.addEventListener('click', () => {
      const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#ffffff"/><text x="40" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${title}</text>${steps.map((s, i) => `<g transform="translate(${50 + i * 180}, 120)"><rect width="140" height="120" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/><text x="70" y="30" font-family="sans-serif" font-size="11" font-weight="bold" fill="#2563eb" text-anchor="middle">${s.badge || `Stage ${i+1}`}</text><text x="70" y="60" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">${s.label}</text></g>`).join('')}</svg>`;
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_diagram.svg`;
      a.click();
    });

    savePngBtn.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1600, 800);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(title, 60, 90);
      ctx.fillStyle = '#64748b';
      ctx.font = '22px sans-serif';
      ctx.fillText(`Generated by Toolbox Assistant Illustrator · ${steps.length} Steps`, 60, 130);

      const nodeWidth = 240;
      const nodeHeight = 180;
      const gap = 60;
      const startX = 60;
      const startY = 240;

      for (let i = 0; i < steps.length; i++) {
        const x = startX + i * (nodeWidth + gap);
        if (x + nodeWidth > 1560) break;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, startY, nodeWidth, nodeHeight, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(steps[i].badge || `Stage ${i+1}`, x + nodeWidth / 2, startY + 40);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(steps[i].label, x + nodeWidth / 2, startY + 80);

        if (steps[i].description) {
          ctx.fillStyle = '#64748b';
          ctx.font = '16px sans-serif';
          ctx.fillText(steps[i].description.slice(0, 24), x + nodeWidth / 2, startY + 120);
        }

        if (i < steps.length - 1 && x + nodeWidth + gap < 1560) {
          ctx.fillStyle = '#2563eb';
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText('➔', x + nodeWidth + gap / 2, startY + nodeHeight / 2 + 10);
        }
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_diagram.png`;
        a.click();
      });
    });

    saveWorkBtn.addEventListener('click', async () => {
      try {
        const { saveArtifactFile } = await import('./artifacts.js');
        const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_diagram.json`;
        await saveArtifactFile({
          name: filename,
          content: JSON.stringify({ title, diagramType, steps, summary }, null, 2),
          kind: 'flowchart',
          destination: 'cloud',
          from: 'assistant'
        });
        saveWorkBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.check} Saved</span>`;
        saveWorkBtn.disabled = true;
      } catch {}
    });

    container.appendChild(card);
    return card;
  }
}

/**
 * DISEASES DATABASE RESULT — Renders rich clinical pathology cards stratified by commodity
 */
export class DiseaseResultRenderer extends ResultRenderer {
  static id = 'disease-list';
  static name = 'Diseases Database';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'disease-list' ||
      result.type === 'disease-list' ||
      Boolean(Array.isArray(data.diseases));
  }

  static render(result, container) {
    const data = result.data || {};
    const query = data.query || 'Clinical Pathology';
    const diseases = Array.isArray(data.diseases) ? data.diseases : [];

    const wrapper = document.createElement('div');
    wrapper.className = 'assistant-result-diseases';
    wrapper.style.cssText = 'margin-top:10px; display:flex; flex-direction:column; gap:12px;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px; background:var(--g50, #f8fafc); border:1px solid var(--g300, #e2e8f0); border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headerLeft = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Diseases & Pathology: "${query}"`;
    title.style.cssText = 'font-size:0.92rem; color:var(--text, #0f172a); display:block;';
    const sub = document.createElement('span');
    sub.textContent = `${diseases.length} condition(s) indexed by epidemiological commodity & WHO ICD-11`;
    sub.style.cssText = 'font-size:0.74rem; color:var(--g600, #64748b);';
    headerLeft.append(title, sub);

    header.appendChild(headerLeft);
    wrapper.appendChild(header);

    for (const d of diseases) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--g300, #e2e8f0); border-radius:14px; background:var(--white, #fff); box-shadow:0 2px 8px rgba(0,0,0,.04); overflow:hidden;';

      const cardHead = document.createElement('div');
      cardHead.style.cssText = 'padding:12px 16px; background:var(--g50, #f8fafc); border-bottom:1px solid var(--g200, #e2e8f0); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

      const headTitle = document.createElement('div');
      const dName = document.createElement('strong');
      dName.textContent = d.name;
      dName.style.cssText = 'font-size:0.95rem; color:var(--text, #0f172a); margin-right:8px;';

      const icdBadge = document.createElement('span');
      icdBadge.textContent = `ICD-11: ${d.icd11}`;
      icdBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:var(--primary-light, #eff6ff); color:var(--primary, #2563eb); font-weight:700;';

      const commodityBadge = document.createElement('span');
      commodityBadge.textContent = `Commodity ${d.commodity}/100`;
      commodityBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:#f0fdf4; color:#15803d; font-weight:700; margin-left:6px;';

      headTitle.append(dName, icdBadge, commodityBadge);

      const saveNoteBtn = document.createElement('button');
      saveNoteBtn.type = 'button';
      saveNoteBtn.className = 'btn btn-secondary btn-sm';
      saveNoteBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.file} Save to Notes</span>`;
      saveNoteBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer;';
      saveNoteBtn.addEventListener('click', async () => {
        try {
          const { saveArtifactFile } = await import('./artifacts.js');
          await saveArtifactFile({
            name: `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_clinical_summary.txt`,
            content: `DISEASE: ${d.name}\nICD-11: ${d.icd11}\nPREVALENCE: ${d.prevalence}\n\nPATHOPHYSIOLOGY:\n${d.pathophysiology}\n\nSYMPTOMS:\n${(d.symptoms||[]).join('\n- ')}\n\nDIAGNOSTIC CRITERIA:\n${d.diagnosticCriteria}\n\nMANAGEMENT:\n${(d.management||[]).join('\n- ')}`,
            kind: 'text',
            destination: 'cloud',
            from: 'assistant'
          });
          saveNoteBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.check} Saved</span>`;
          saveNoteBtn.disabled = true;
        } catch {}
      });

      cardHead.append(headTitle, saveNoteBtn);
      card.appendChild(cardHead);

      const cardBody = document.createElement('div');
      cardBody.style.cssText = 'padding:14px 16px; display:flex; flex-direction:column; gap:10px; font-size:0.84rem; line-height:1.5; color:var(--text, #0f172a);';

      if (d.pathophysiology) {
        const pathBlock = document.createElement('div');
        pathBlock.innerHTML = `<strong>Pathophysiology:</strong> ${d.pathophysiology}`;
        cardBody.appendChild(pathBlock);
      }

      if (d.symptoms && d.symptoms.length) {
        const sympBlock = document.createElement('div');
        sympBlock.innerHTML = `<strong>Key Symptoms & Signs:</strong> ${d.symptoms.join(', ')}`;
        cardBody.appendChild(sympBlock);
      }

      if (d.diagnosticCriteria) {
        const diagBlock = document.createElement('div');
        diagBlock.innerHTML = `<strong>Diagnostic Criteria:</strong> ${d.diagnosticCriteria}`;
        cardBody.appendChild(diagBlock);
      }

      if (d.management && d.management.length) {
        const mgmtBlock = document.createElement('div');
        mgmtBlock.style.cssText = 'padding:8px 12px; background:var(--g50, #f8fafc); border-radius:8px; border-left:3px solid var(--primary, #2563eb);';
        mgmtBlock.innerHTML = `<strong>First-line Management:</strong><br>${d.management.map(m => `• ${m}`).join('<br>')}`;
        cardBody.appendChild(mgmtBlock);
      }

      card.appendChild(cardBody);
      wrapper.appendChild(card);
    }

    container.appendChild(wrapper);
    return wrapper;
  }
}

/**
 * TEXT RESULT — Clean fallback text output
 */
export class TextResultRenderer extends ResultRenderer {
  static id = 'text';
  static name = 'Text Output';

  static canRender(result) {
    return true; // Catch-all fallback
  }

  static render(result, container) {
    const data = result.data || {};
    const text = typeof data === 'string' ? data : (data.message || data.output || '');
    if (!text) return null;

    const el = document.createElement('div');
    el.className = 'assistant-result-text';
    el.style.cssText = 'margin-top:6px; font-size:0.88rem; line-height:1.5; color:var(--text, #0f172a);';
    el.textContent = text;
    container.appendChild(el);
    return el;
  }
}

/**
 * REGISTRY OF ALL RESULT RENDERERS
 */
export const RESULT_RENDERERS = [
  ErrorResultRenderer,
  Anatomy3DResultRenderer,
  IllustrationResultRenderer,
  DiseaseResultRenderer,
  FileListResultRenderer,
  FileSavedResultRenderer,
  FileDownloadCardRenderer,
  ImageResultRenderer,
  ChartResultRenderer,
  CircuitResultRenderer,
  FlowchartResultRenderer,
  CodeExecutionResultRenderer,
  TransformResultRenderer,
  JsonResultRenderer,
  TableResultRenderer,
  SpeedTestResultRenderer,
  AudioPlayerResultRenderer,
  TextResultRenderer
];

/**
 * Find appropriate renderer for a result
 */
export function selectRenderer(result) {
  for (const Renderer of RESULT_RENDERERS) {
    if (Renderer.canRender(result)) {
      return Renderer;
    }
  }
  return TextResultRenderer;
}

/**
 * Render a tool result to DOM
 */
export async function renderToolResult(result, container) {
  try {
    if (result.success === false || result.error) {
      return ErrorResultRenderer.render(result, container);
    }

    const Renderer = selectRenderer(result);
    if (result.type === 'interactive') {
      result = await Renderer.reconstruct(result);
    }

    const el = Renderer.render(result, container);

    if (result.type === 'interactive') {
      Renderer.bindInteractions(result, container);
    }

    return el;
  } catch (err) {
    console.error('Failed to render result:', err);
    return ErrorResultRenderer.render({
      success: false,
      error: `Failed to render result: ${err.message}`
    }, container);
  }
}

/**
 * Clean up a rendered result
 */
export async function cleanupToolResult(result, container) {
  try {
    const Renderer = selectRenderer(result);
    await Renderer.cleanup(result);
  } catch (err) {
    console.error('Failed to cleanup result:', err);
  }
}
