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

import { AssistantAudioManager } from './assistant-audio.js';
import { sanitizeUserFacingText } from '../utils.js';
import { renderMath, renderMathInText } from './math-renderer.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
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
    card.style.cssText = 'margin-top:10px; padding:14px 16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:12px; min-width:0; flex:1;';

    const iconBadge = document.createElement('div');
    iconBadge.style.cssText = 'width:42px; height:42px; border-radius:10px; background:var(--g100); color:var(--primary, #2563eb); font:700 0.75rem var(--sans, sans-serif); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--g200);';
    iconBadge.textContent = ext.slice(0, 4);

    const info = document.createElement('div');
    info.style.cssText = 'min-width:0; flex:1;';

    const nameEl = document.createElement('div');
    nameEl.textContent = filename;
    nameEl.style.cssText = 'font-weight:700; font-size:0.92rem; color:var(--black); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

    const metaEl = document.createElement('div');
    metaEl.textContent = [ext, sizeStr, data.message].filter(Boolean).slice(0, 2).join(' · ');
    metaEl.style.cssText = 'font-size:0.75rem; color:var(--g600); margin-top:2px;';

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
    downloadBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; padding:7px 16px; border-radius:9999px; background:var(--black); color:var(--white); font-size:0.85rem; font-weight:700; text-decoration:none; cursor:pointer; transition:opacity .15s; flex-shrink:0;';
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
    wrapper.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); overflow:hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--g50); border-bottom:1px solid var(--g200); flex-wrap:wrap; gap:8px;';

    const leftHeader = document.createElement('div');
    leftHeader.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const folderIcon = document.createElement('span');
    folderIcon.innerHTML = ICONS.folder;
    folderIcon.style.cssText = 'display:inline-flex; align-items:center; color:var(--primary, #2563eb);';

    const title = document.createElement('strong');
    title.textContent = 'Saved Files & Documents';
    title.style.cssText = 'font-size:0.92rem; color:var(--black);';

    const countBadge = document.createElement('span');
    countBadge.textContent = `${files.length} item${files.length === 1 ? '' : 's'}${filter}`;
    countBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:var(--g200); color:var(--g700); font-weight:600;';

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
      emptyBox.style.cssText = 'padding:24px; text-align:center; color:var(--g500); font-size:0.85rem;';
      emptyBox.innerHTML = '<div style="margin-bottom:6px; color:var(--g400);">' + ICONS.folder + '</div>No saved files found in your workspace.';
      listBody.appendChild(emptyBox);
    } else {
      for (const file of files) {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--g100); gap:12px; transition:background .15s;';
        itemRow.onmouseover = () => { itemRow.style.background = 'var(--g50)'; };
        itemRow.onmouseout = () => { itemRow.style.background = 'transparent'; };

        const itemLeft = document.createElement('div');
        itemLeft.style.cssText = 'display:flex; align-items:center; gap:10px; min-width:0; flex:1;';

        const itemIcon = document.createElement('span');
        itemIcon.innerHTML = ICONS.file;
        itemIcon.style.cssText = 'display:inline-flex; align-items:center; color:var(--g500); flex-shrink:0;';

        const itemMeta = document.createElement('div');
        itemMeta.style.cssText = 'min-width:0; flex:1;';

        const itemName = document.createElement('div');
        itemName.textContent = file.name;
        itemName.style.cssText = 'font-size:0.86rem; font-weight:700; color:var(--black); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

        const itemSub = document.createElement('div');
        const sizeStr = file.bytes ? (file.bytes > 1048576 ? `${(file.bytes/1048576).toFixed(1)} MB` : `${Math.round(file.bytes/1024)} KB`) : 'Text file';
        const syncIcon = file.isCloudSynced ? ICONS.cloud : ICONS.local;
        itemSub.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${(file.kind || 'file').toUpperCase()} · ${sizeStr} · <span title="${file.isCloudSynced ? 'Cloud' : 'Local'}" style="display:inline-flex; align-items:center;">${syncIcon}</span></span>`;
        itemSub.style.cssText = 'font-size:0.72rem; color:var(--g500); margin-top:1px;';

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
        downloadAction.style.cssText = 'font-size:0.75rem; padding:4px 12px; background:var(--black); color:var(--white); border-radius:9999px; cursor:pointer;';
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
 * FILE DELETION CONFIRMATION RESULT — Interactive card requiring user confirmation before files are deleted
 */
export class FileDeletionConfirmationRenderer extends ResultRenderer {
  static id = 'file-deletion-confirmation';
  static name = 'File Deletion Confirmation';

  static canRender(result) {
    const data = result?.data || result || {};
    return result?.renderer === 'file-deletion-confirmation' ||
      result?.type === 'file-deletion-confirmation' ||
      data?.renderer === 'file-deletion-confirmation' ||
      data?.type === 'file-deletion-confirmation';
  }

  static render(result, container) {
    const data = result?.data || result || {};
    const files = Array.isArray(data.files) ? data.files : (Array.isArray(result.files) ? result.files : []);
    const paths = Array.isArray(data.paths) ? data.paths : (Array.isArray(result.paths) ? result.paths : files.map(f => f.path || f));

    const card = document.createElement('div');
    card.className = 'assistant-result-delete-confirm-card';
    card.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--border-color, #e2e8f0); border-left:4px solid #ef4444; border-radius:12px; background:var(--bg-surface, var(--white, #ffffff)); box-shadow:0 2px 10px rgba(0,0,0,0.06); max-width:540px;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:10px;';
    header.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary, #0f172a);">Confirm File Deletion</span>
      <span style="font-size:0.75rem; padding:2px 8px; border-radius:9999px; background:#fef2f2; color:#b91c1c; font-weight:600; border:1px solid #fecaca;">Action Required</span>
    `;
    card.appendChild(header);

    // Explanatory prompt
    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:0.85rem; color:var(--text-secondary, #475569); margin:0 0 12px 0; line-height:1.4;';
    desc.textContent = `The assistant is requesting to permanently delete ${paths.length} file${paths.length === 1 ? '' : 's'}. This cannot be undone:`;
    card.appendChild(desc);

    // List of files targeted
    const fileListBox = document.createElement('div');
    fileListBox.style.cssText = 'background:var(--bg-elevated, var(--g50, #f8fafc)); border:1px solid var(--border-color, #e2e8f0); border-radius:8px; padding:8px 12px; margin-bottom:14px; max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;';

    paths.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:0.82rem; font-family:var(--mono, monospace); color:var(--text-primary, #1e293b);';
      const label = typeof p === 'string' ? p : (p.name || p.path || JSON.stringify(p));
      row.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(label)}</span>
      `;
      fileListBox.appendChild(row);
    });
    card.appendChild(fileListBox);

    // Actions
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex; align-items:center; gap:10px;';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-sm btn-danger';
    confirmBtn.style.cssText = 'padding:6px 16px; border-radius:8px; background:#dc2626; color:#ffffff; font-size:0.82rem; font-weight:700; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 0.15s;';
    confirmBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Confirm Delete
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-sm btn-secondary';
    cancelBtn.style.cssText = 'padding:6px 14px; border-radius:8px; background:var(--bg-elevated, var(--g100, #f1f5f9)); color:var(--text-secondary, #475569); font-size:0.82rem; font-weight:600; border:1px solid var(--border-color, #e2e8f0); cursor:pointer;';
    cancelBtn.textContent = 'Cancel';

    const statusMsg = document.createElement('span');
    statusMsg.style.cssText = 'font-size:0.8rem; font-weight:600; display:none;';

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmBtn.style.opacity = '0.6';
      confirmBtn.textContent = 'Deleting...';
      try {
        const { executeAssistantTool } = await import('./assistant-tools.js');
        const targetPaths = paths.map(p => typeof p === 'string' ? p : (p.path || p.name));
        const res = await executeAssistantTool('delete_file', { paths: targetPaths, confirmed: true });
        
        card.style.borderColor = '#22c55e';
        card.style.borderLeftColor = '#22c55e';
        header.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary, #0f172a);">Files Deleted</span>
        `;
        desc.textContent = res.message || `Successfully deleted ${targetPaths.length} file(s).`;
        desc.style.color = '#15803d';
        fileListBox.style.opacity = '0.5';
        actionRow.innerHTML = '';
        const doneBadge = document.createElement('span');
        doneBadge.style.cssText = 'font-size:0.8rem; color:#16a34a; font-weight:700; display:inline-flex; align-items:center; gap:4px;';
        doneBadge.innerHTML = '✓ Operation Complete';
        actionRow.appendChild(doneBadge);
      } catch (err) {
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.textContent = 'Confirm Delete';
        statusMsg.textContent = `Error: ${err.message}`;
        statusMsg.style.color = '#dc2626';
        statusMsg.style.display = 'inline';
      }
    });

    cancelBtn.addEventListener('click', () => {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      card.style.opacity = '0.7';
      desc.textContent = 'Deletion cancelled by user.';
      desc.style.color = 'var(--text-muted, #64748b)';
      actionRow.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted, #64748b); font-style:italic;">Cancelled</span>';
    });

    actionRow.append(confirmBtn, cancelBtn, statusMsg);
    card.appendChild(actionRow);
    container.appendChild(card);
    return card;
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
    el.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); max-width:420px;';

    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = 'display:flex; justify-content:center; align-items:center; background:var(--g50); border-radius:10px; padding:16px; border:1px solid var(--g200);';

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = data.text || filename;
    img.style.cssText = 'max-width:100%; max-height:280px; height:auto; object-fit:contain; border-radius:6px;';
    imgWrapper.appendChild(img);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; gap:8px; flex-wrap:wrap;';

    const caption = document.createElement('div');
    caption.textContent = data.text || data.message || filename;
    caption.style.cssText = 'font-size:0.8rem; color:var(--g600); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;';

    const downloadLink = document.createElement('a');
    downloadLink.href = imgUrl;
    downloadLink.download = filename;
    downloadLink.textContent = 'Save Image';
    downloadLink.style.cssText = 'padding:6px 12px; border-radius:9999px; background:var(--black); color:var(--white); font-size:0.78rem; font-weight:700; text-decoration:none; cursor:pointer;';

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
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); min-height:260px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';

    const badge = document.createElement('span');
    badge.textContent = `${chartType.toUpperCase()} (${values.length} points)`;
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100); color:var(--g700); font-weight:700;';

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
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const badge = document.createElement('span');
    badge.textContent = 'Logic Lab';
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
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
      tableTitle.style.cssText = 'font-weight:700; font-size:0.82rem; color:var(--g700); margin-bottom:6px;';
      tableSection.appendChild(tableTitle);

      const tbl = document.createElement('table');
      tbl.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.8rem; font-family:var(--mono, monospace); text-align:center; color:var(--black);';

      const thead = document.createElement('thead');
      const htr = document.createElement('tr');
      truthTable.headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = 'padding:6px 10px; background:var(--g100); border:1px solid var(--g200); font-weight:700; color:var(--black);';
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      tbl.appendChild(thead);

      const tbody = document.createElement('tbody');
      truthTable.rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        tr.style.background = ri % 2 === 0 ? 'var(--white)' : 'var(--g50)';
        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          td.style.cssText = 'padding:5px 8px; border:1px solid var(--g200); color:var(--black);';
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
    wrapper.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;';
    
    const leftHeader = document.createElement('div');
    leftHeader.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const badge = document.createElement('span');
    badge.textContent = 'Flowchart & Code';
    badge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    leftHeader.append(titleEl, badge);

    const rightActions = document.createElement('div');
    rightActions.style.cssText = 'display:flex; align-items:center; gap:6px;';

    const openToolBtn = document.createElement('button');
    openToolBtn.type = 'button';
    openToolBtn.className = 'btn btn-secondary btn-sm';
    openToolBtn.textContent = 'Open in Flowchart Tool ↗';
    openToolBtn.style.cssText = 'font-size:0.75rem; font-weight:700; padding:4px 10px; cursor:pointer; border-radius:9999px;';
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
    copyBtn.style.cssText = 'font-size:0.75rem; font-weight:600; padding:4px 10px; cursor:pointer; border-radius:9999px;';
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
    tabNav.style.cssText = 'display:flex; gap:6px; margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:6px;';

    const tabChart = document.createElement('button');
    tabChart.textContent = 'Flowchart Diagram';
    tabChart.style.cssText = 'padding:4px 12px; border-radius:9999px; border:none; background:var(--black); color:var(--white); font-size:0.78rem; font-weight:700; cursor:pointer;';

    const tabPy = document.createElement('button');
    tabPy.textContent = 'Python Code';
    tabPy.style.cssText = 'padding:4px 12px; border-radius:9999px; border:1px solid var(--g200); background:var(--white); color:var(--g700); font-size:0.78rem; font-weight:600; cursor:pointer;';

    const tabJs = document.createElement('button');
    tabJs.textContent = 'JavaScript Code';
    tabJs.style.cssText = 'padding:4px 12px; border-radius:9999px; border:1px solid var(--g200); background:var(--white); color:var(--g700); font-size:0.78rem; font-weight:600; cursor:pointer;';

    tabNav.append(tabChart, tabPy, tabJs);
    wrapper.appendChild(tabNav);

    // Chart Canvas Container
    const chartBox = document.createElement('div');
    chartBox.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:8px; padding:18px 12px; background:var(--g50); border-radius:10px; border:1px solid var(--g200); overflow-x:auto;';

    // Code View Container (hidden by default)
    const codeBox = document.createElement('pre');
    codeBox.style.cssText = 'display:none; margin:0; padding:16px; border-radius:10px; background:#0f172a; color:#f8fafc; font-family:var(--mono, monospace); font-size:0.84rem; line-height:1.6; overflow-x:auto;';

    // Tab Switch Behavior
    const activateTab = (activeBtn, showChart, codeContent) => {
      [tabChart, tabPy, tabJs].forEach(b => {
        b.style.background = 'var(--white)';
        b.style.color = 'var(--g700)';
        b.style.border = '1px solid var(--g200)';
        b.style.fontWeight = '600';
      });
      activeBtn.style.background = 'var(--black)';
      activeBtn.style.color = 'var(--white)';
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
        background: ${isTerminal ? '#3b82f6' : isDecision ? '#f59e0b' : kind === 'output' ? '#10b981' : 'var(--white)'};
        color: ${isTerminal || isDecision || kind === 'output' ? '#ffffff' : 'var(--black)'};
        border: 1.5px solid ${isTerminal ? '#2563eb' : isDecision ? '#d97706' : kind === 'output' ? '#059669' : 'var(--g200)'};
        font-weight: 700;
        font-size: 0.82rem;
        text-align: center;
        max-width: 340px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      `;

      let text = kind;
      if (kind === 'declare') text = `Declare ${n.name} (${n.dataType || 'Integer'})`;
      else if (kind === 'assign') text = `${n.name} = ${n.expr}`;
      else if (kind === 'output') text = `Output: ${n.expr}`;
      else if (kind === 'input') text = `Input: ${n.name}`;
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
        trueCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px; padding:8px;';
        const trueLabel = document.createElement('span');
        trueLabel.textContent = 'True';
        trueLabel.style.cssText = 'font-size:0.72rem; font-weight:800; color:#16a34a; margin-bottom:6px;';
        trueCol.appendChild(trueLabel);
        (n.then || []).forEach(child => trueCol.appendChild(renderNodeItem(child)));

        const falseCol = document.createElement('div');
        falseCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:8px;';
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
        bodyCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:100%; max-width:380px; margin-top:8px; background:var(--g50); border:1px dashed var(--g200); border-radius:8px; padding:8px;';
        const bodyLabel = document.createElement('span');
        bodyLabel.textContent = 'Loop Body';
        bodyLabel.style.cssText = 'font-size:0.72rem; font-weight:800; color:var(--g600); margin-bottom:6px;';
        bodyCol.appendChild(bodyLabel);
        n.body.forEach(child => bodyCol.appendChild(renderNodeItem(child)));
        item.appendChild(bodyCol);
      }

      // Down arrow
      const arrow = document.createElement('div');
      arrow.textContent = '↓';
      arrow.style.cssText = 'color:var(--g400); font-weight:bold; margin:2px 0;';
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
    wrapper.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:14px; overflow:hidden; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    // 1. Source Code Block
    if (codeText) {
      const codeHeader = document.createElement('div');
      codeHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:var(--g100); border-bottom:1px solid var(--g200); font-size:0.75rem;';
      const langBadge = document.createElement('strong');
      langBadge.textContent = lang.toUpperCase();
      langBadge.style.cssText = 'color:var(--black);';

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
      codePre.style.cssText = 'margin:0; padding:12px 14px; overflow-x:auto; font:12px/1.55 var(--mono, monospace); background:var(--white); color:var(--black);';
      codePre.textContent = codeText;
      wrapper.appendChild(codePre);
    }

    // 2. Terminal Output Console
    const consoleSection = document.createElement('div');
    consoleSection.style.cssText = 'background:#0f172a; color:#f8fafc; border-top:1px solid #1e293b;';

    const consoleHeader = document.createElement('div');
    consoleHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:7px 14px; background:#1e293b; font-size:0.72rem;';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = isError ? 'Execution Error' : 'Output Console';
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
    el.style.cssText = 'margin-top:10px; padding:14px 16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';

    const opBadge = document.createElement('span');
    opBadge.textContent = op.toUpperCase();
    opBadge.style.cssText = 'font-size:0.72rem; padding:3px 8px; border-radius:6px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'assistant-transform-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'padding:4px 12px; border-radius:9999px; border:1px solid var(--g200); background:var(--white); font-size:0.75rem; font-weight:700; cursor:pointer; color:var(--black);';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(resultText);
      copyBtn.textContent = 'Copied ✓';
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = '#ffffff';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.style.background = 'var(--white)';
        copyBtn.style.color = 'var(--black)';
      }, 1500);
    };

    header.append(opBadge, copyBtn);
    el.appendChild(header);

    const box = document.createElement('div');
    box.style.cssText = 'padding:10px 12px; background:var(--g50); border:1px solid var(--g200); border-radius:8px; font:700 0.95rem var(--mono, monospace); color:var(--black); word-break:break-all; user-select:all;';
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
    el.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:14px; overflow:hidden; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04);';

    const scrollBox = document.createElement('div');
    scrollBox.style.cssText = 'overflow-x:auto; max-height:360px;';

    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left; color:var(--black);';

    if (headers.length) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = typeof h === 'object' ? h.label || h.name : String(h);
        th.style.cssText = 'padding:8px 12px; background:var(--g100); border-bottom:1px solid var(--g200); font-weight:700; color:var(--black); position:sticky; top:0;';
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    rows.forEach((row, ri) => {
      const tr = document.createElement('tr');
      tr.style.background = ri % 2 === 0 ? 'var(--white)' : 'var(--g50)';
      const cells = Array.isArray(row) ? row : Object.values(row);
      cells.forEach(c => {
        const td = document.createElement('td');
        td.textContent = c !== null && c !== undefined ? String(c) : '';
        td.style.cssText = 'padding:6px 12px; border-bottom:1px solid var(--g200); color:var(--black);';
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
    el.style.cssText = 'margin-top:10px; padding:14px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); color:var(--black);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;';
    const title = document.createElement('strong');
    title.textContent = 'Network Speed Test';
    title.style.color = 'var(--black)';
    const location = document.createElement('span');
    location.textContent = data.city || data.country || 'Online';
    location.style.cssText = 'font-size:.75rem; color:var(--g600);';
    header.append(title, location);

    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px;';
    for (const [label, value, unit] of [
      ['Download', data.downloadSpeedMbps, 'Mbps'],
      ['Latency', data.latencyMs, 'ms'],
      ['Jitter', data.jitterMs, 'ms']
    ]) {
      const metric = document.createElement('div');
      metric.style.cssText = 'padding:9px 8px; border:1px solid var(--g200); border-radius:9px; background:var(--g50); text-align:center;';
      const name = document.createElement('div');
      name.textContent = label;
      name.style.cssText = 'font-size:.65rem; color:var(--g600); font-weight:700; text-transform:uppercase;';
      const number = document.createElement('div');
      number.textContent = `${value ?? '—'} ${unit}`;
      number.style.cssText = 'margin-top:3px; font:700 1rem var(--mono, monospace); color:var(--black);';
      metric.append(name, number);
      metrics.appendChild(metric);
    }

    const footer = document.createElement('div');
    footer.textContent = [data.isp, data.ip, data.verdict].filter(Boolean).join(' · ');
    footer.style.cssText = 'margin-top:10px; font-size:.75rem; color:var(--g600);';

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
    const data = result?.data || result || {};
    return result?.renderer === 'audio-player' ||
      result?.type === 'audio-player' ||
      result?.type === 'audio' ||
      data?.renderer === 'audio-player' ||
      data?.type === 'audio-player' ||
      data?.type === 'audio' ||
      Boolean(data?.url && data?.audioId) ||
      Boolean(result?.audioId);
  }

  static render(result, container) {
    const data = result?.data || result || {};
    const audioId = data.audioId || result?.audioId;
    const title = data.title || result?.title || 'Audio Sample';
    const artist = data.artist || result?.artist || 'Toolbox Audio';
    const artworkUrl = data.artworkUrl || result?.artworkUrl || '';
    const duration = Math.max(1, Math.round(data.duration || result?.duration || 30));

    const card = document.createElement('div');
    card.className = 'assistant-result-audio-player ast-audio-player-card';
    card.setAttribute('data-audio-id', audioId);
    card.style.cssText = 'margin-top:10px; padding:14px 16px; background:var(--white); border:1px solid var(--g200); border-radius:14px; box-shadow:0 2px 10px rgba(0,0,0,0.05); color:var(--black); font-family:var(--sans);';

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const rem = Math.floor(s % 60);
      return `${m}:${rem < 10 ? '0' : ''}${rem}`;
    };

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;';

    const info = document.createElement('div');
    info.style.cssText = 'display:flex; align-items:center; gap:10px; overflow:hidden; min-width:0;';

    if (artworkUrl) {
      const img = document.createElement('img');
      img.src = artworkUrl;
      img.alt = '';
      img.style.cssText = 'width:42px; height:42px; border-radius:8px; object-fit:cover; flex-shrink:0;';
      info.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:42px; height:42px; border-radius:8px; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;';
      placeholder.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      info.appendChild(placeholder);
    }

    const labels = document.createElement('div');
    labels.style.cssText = 'overflow:hidden; min-width:0;';
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-weight:700; font-size:0.9rem; color:var(--black); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    const artistEl = document.createElement('div');
    artistEl.textContent = artist;
    artistEl.style.cssText = 'font-size:0.75rem; color:var(--g600); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    labels.append(titleEl, artistEl);
    info.appendChild(labels);
    header.appendChild(info);

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'btn btn-secondary btn-sm ast-audio-btn-stop';
    stopBtn.textContent = 'Stop';
    stopBtn.style.cssText = 'font-size:0.72rem; padding:4px 10px; color:#ef4444; border-radius:9999px; cursor:pointer; font-weight:700; flex-shrink:0; border:1px solid var(--g200);';
    stopBtn.addEventListener('click', () => {
      AssistantAudioManager.stop(audioId);
    });
    header.appendChild(stopBtn);
    card.appendChild(header);

    // Controls: Play/Pause, Seek bar, Time, Volume
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; align-items:center; gap:10px;';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ast-audio-btn-toggle';
    toggleBtn.style.cssText = 'width:36px; height:36px; border-radius:50%; background:var(--black); color:var(--white); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;';
    toggleBtn.innerHTML = `
      <svg class="ast-audio-icon-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:none;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <svg class="ast-audio-icon-pause" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    `;

    const iconPlay = toggleBtn.querySelector('.ast-audio-icon-play');
    const iconPause = toggleBtn.querySelector('.ast-audio-icon-pause');

    toggleBtn.addEventListener('click', () => {
      const inst = AssistantAudioManager.getInstance(audioId);
      if (inst) {
        if (inst.isPlaying) {
          AssistantAudioManager.pause(audioId);
        } else {
          AssistantAudioManager.resume(audioId);
        }
      }
    });
    controls.appendChild(toggleBtn);

    const seekWrap = document.createElement('div');
    seekWrap.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:4px;';

    const seekInput = document.createElement('input');
    seekInput.type = 'range';
    seekInput.className = 'ast-audio-seek';
    seekInput.min = '0';
    seekInput.max = String(duration);
    seekInput.step = '0.1';
    seekInput.value = '0';
    seekInput.style.cssText = 'width:100%; cursor:pointer; accent-color:var(--black);';

    let isSeeking = false;
    seekInput.addEventListener('mousedown', () => { isSeeking = true; });
    seekInput.addEventListener('touchstart', () => { isSeeking = true; });
    seekInput.addEventListener('change', () => {
      isSeeking = false;
      AssistantAudioManager.seek(audioId, parseFloat(seekInput.value));
    });

    const timeRow = document.createElement('div');
    timeRow.style.cssText = 'display:flex; justify-content:space-between; font-size:0.7rem; font-family:var(--mono); color:var(--g600);';
    const curTimeEl = document.createElement('span');
    curTimeEl.className = 'ast-audio-time-cur';
    curTimeEl.textContent = '0:00';
    const durTimeEl = document.createElement('span');
    durTimeEl.className = 'ast-audio-time-dur';
    durTimeEl.textContent = formatTime(duration);
    timeRow.append(curTimeEl, durTimeEl);

    seekWrap.append(seekInput, timeRow);
    controls.appendChild(seekWrap);

    // Volume Slider
    const volWrap = document.createElement('div');
    volWrap.style.cssText = 'display:flex; align-items:center; gap:4px; margin-left:4px;';
    volWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--g500);"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    const volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.className = 'ast-audio-volume';
    volInput.min = '0';
    volInput.max = '1';
    volInput.step = '0.05';
    volInput.value = '1';
    volInput.style.cssText = 'width:45px; cursor:pointer; accent-color:var(--black);';
    volInput.addEventListener('input', () => {
      AssistantAudioManager.setVolume(audioId, parseFloat(volInput.value));
    });
    volWrap.appendChild(volInput);
    controls.appendChild(volWrap);

    card.appendChild(controls);

    // Subscribe to live audio updates for this card
    AssistantAudioManager.subscribe((event, inst) => {
      if (!inst || inst.id !== audioId) return;
      if (iconPlay && iconPause) {
        iconPlay.style.display = inst.isPlaying ? 'none' : 'block';
        iconPause.style.display = inst.isPlaying ? 'block' : 'none';
      }
      if (!isSeeking && seekInput) {
        if (inst.duration) seekInput.max = String(inst.duration);
        seekInput.value = String(inst.currentTime || 0);
      }
      if (curTimeEl) curTimeEl.textContent = formatTime(inst.currentTime || 0);
      if (durTimeEl && inst.duration) durTimeEl.textContent = formatTime(inst.duration);
      if (volInput && typeof inst.volume === 'number') volInput.value = String(inst.volume);
    });

    const currentInst = AssistantAudioManager.getInstance(audioId);
    if (currentInst) {
      if (iconPlay && iconPause) {
        iconPlay.style.display = currentInst.isPlaying ? 'none' : 'block';
        iconPause.style.display = currentInst.isPlaying ? 'block' : 'none';
      }
      if (currentInst.duration && seekInput) seekInput.max = String(currentInst.duration);
      if (durTimeEl && currentInst.duration) durTimeEl.textContent = formatTime(currentInst.duration);
    }

    container.appendChild(card);
    return card;
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
    el.style.cssText = 'margin-top:8px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#dc2626; font-size:0.85rem; font-weight:600;';
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
    card.style.cssText = 'margin-top:8px; padding:8px 14px; border:1px solid var(--g200); border-radius:10px; background:var(--g50); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:0.85rem; color:var(--black);';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:8px; min-width:0;';

    const icon = document.createElement('span');
    icon.innerHTML = isCloud ? ICONS.cloud : ICONS.local;
    icon.title = isCloud ? 'Saved to Cloud' : 'Saved Locally';
    icon.style.cssText = 'display:inline-flex; align-items:center; color:var(--primary, #2563eb); flex-shrink:0;';

    const nameEl = document.createElement('strong');
    nameEl.textContent = filename;
    nameEl.style.cssText = 'color:var(--black); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:280px;';

    left.append(icon, nameEl);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex; align-items:center; gap:8px; margin-left:auto;';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'assistant-saved-link';
    viewBtn.href = data.artifactId ? `#/saved?id=${data.artifactId}` : '#/saved';
    viewBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">View in Saved Work ${ICONS.external}</span>`;
    viewBtn.style.cssText = 'font-size:0.78rem; font-weight:700; color:var(--primary, #2563eb); text-decoration:none; padding:4px 12px; border-radius:9999px; background:var(--white); border:1px solid var(--g200); transition:all .15s; white-space:nowrap;';
    viewBtn.onmouseover = () => { viewBtn.style.background = 'var(--g100)'; };
    viewBtn.onmouseout = () => { viewBtn.style.background = 'var(--white)'; };

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
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 3px 12px rgba(0,0,0,.06); overflow:hidden;';

    // 1. Header with title and system badges
    const header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--g200); background:var(--g50); flex-wrap:wrap; gap:8px;';

    const titleBox = document.createElement('div');
    const titleText = document.createElement('strong');
    titleText.textContent = `3D Anatomy: ${query.charAt(0).toUpperCase() + query.slice(1)}`;
    titleText.style.cssText = 'font-size:0.95rem; color:var(--black); display:block;';
    const subText = document.createElement('span');
    subText.textContent = `${structures.length} isolated structure(s) across: ${systems.map(s => s.toUpperCase()).join(' · ')}`;
    subText.style.cssText = 'font-size:0.75rem; color:var(--g600); font-weight:600;';
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
    infoSection.style.cssText = 'padding:16px; background:var(--white); max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;';

    if (details.length) {
      for (const d of details) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';

        const itemHeader = document.createElement('div');
        itemHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; flex-wrap:wrap; gap:6px;';

        const nameLabel = document.createElement('strong');
        nameLabel.textContent = d.commonName || d.name;
        nameLabel.style.cssText = 'font-size:0.92rem; color:var(--black);';

        const latinName = document.createElement('em');
        latinName.textContent = d.name !== d.commonName ? d.name : '';
        latinName.style.cssText = 'font-size:0.78rem; color:var(--g500); margin-left:6px;';
        nameLabel.appendChild(latinName);

        const badge = document.createElement('span');
        badge.textContent = (d.system || 'anatomy').toUpperCase();
        badge.style.cssText = 'font-size:0.7rem; padding:2px 8px; border-radius:9999px; background:var(--primary-light, #eff6ff); color:var(--primary, #2563eb); font-weight:700;';

        itemHeader.append(nameLabel, badge);
        item.appendChild(itemHeader);

        if (d.functionDesc) {
          const fn = document.createElement('p');
          fn.style.cssText = 'font-size:0.82rem; line-height:1.45; color:var(--black); margin:0 0 6px 0;';
          fn.innerHTML = `<strong>Function:</strong> ${d.functionDesc}`;
          item.appendChild(fn);
        }

        if (d.clinicalNotes) {
          const cl = document.createElement('p');
          cl.style.cssText = 'font-size:0.8rem; line-height:1.45; color:var(--g700); margin:0; background:var(--white); padding:6px 10px; border-radius:6px; border-left:3px solid var(--primary, #2563eb); border:1px solid var(--g200);';
          cl.innerHTML = `<strong>Clinical Pearls:</strong> ${d.clinicalNotes}`;
          item.appendChild(cl);
        }

        infoSection.appendChild(item);
      }
    } else {
      const emptyNote = document.createElement('div');
      emptyNote.style.cssText = 'font-size:0.82rem; color:var(--g600);';
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

        const byId = new Map((index.structures || []).map(s => [s.id?.toLowerCase(), s]));
        const byName = new Map((index.structures || []).map(s => [s.name?.toLowerCase(), s]));

        const targetIdSet = new Set(Array.from(structureIds).map(id => String(id).toLowerCase().trim()));
        const targetNamesLower = structures.map(s => String(s.name || '').toLowerCase().trim()).filter(Boolean);
        const queryLower = String(query || '').toLowerCase().trim();
        const hasSpecificTargets = targetIdSet.size > 0 || targetNamesLower.length > 0;
        const visibleMeshes = [];

        function matchStructure(nodeName) {
          if (!hasSpecificTargets) return true;
          const nLower = String(nodeName || '').toLowerCase().trim();
          if (!nLower) return false;

          // 1. Direct ID match
          if (targetIdSet.has(nLower)) return true;
          for (const tid of targetIdSet) {
            if (nLower === tid || nLower.includes(tid) || tid.includes(nLower)) return true;
          }

          // 2. Lookup in index catalog by node name
          const meta = byId.get(nLower) || byName.get(nLower);
          const metaName = meta ? (meta.name || '').toLowerCase() : '';
          const metaId = meta ? (meta.id || '').toLowerCase() : '';

          if (metaId && targetIdSet.has(metaId)) return true;

          // 3. Match against target names
          for (const tName of targetNamesLower) {
            if (tName.length >= 3) {
              if (nLower.includes(tName) || tName.includes(nLower)) return true;
              if (metaName && (metaName.includes(tName) || tName.includes(metaName))) return true;
            }
          }

          // 4. Query keywords match (e.g. "c1", "atlas", "lung", "heart", "vertebra")
          if (queryLower.length >= 3) {
            if (nLower.includes(queryLower) || queryLower.includes(nLower)) return true;
            if (metaName && (metaName.includes(queryLower) || queryLower.includes(metaName))) return true;
          }

          return false;
        }

        // Load all requested system GLB files
        const systemPromises = systems.map(async (sysKey) => {
          const meta = index.systems[sysKey];
          if (!meta) return;

          const gltf = await new Promise((resolve, reject) => {
            gltfLoader.load(`${BASE}${meta.file}`, resolve, undefined, reject);
          });

          const group = gltf.scene;

          // Direct children of group represent individual anatomical structures in BodyParts3D GLTF
          for (const child of group.children) {
            const isTarget = matchStructure(child.name);
            child.visible = isTarget;

            child.traverse((node) => {
              if (node.isMesh) {
                const meshTarget = isTarget || matchStructure(node.name);
                node.visible = meshTarget;

                if (meshTarget) {
                  node.material = node.material.clone();
                  node.castShadow = node.receiveShadow = false;
                  viewer.registerPickable(node);
                  visibleMeshes.push(node);
                }
              }
            });
          }

          sceneRoot.add(group);
        });

        await Promise.all(systemPromises);

        // Frame and tightly center on the isolated target structures
        const box = new THREE.Box3();
        if (visibleMeshes.length > 0) {
          visibleMeshes.forEach(m => box.expandByObject(m));
        } else {
          box.setFromObject(sceneRoot);
        }

        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          viewer.controls.target.copy(center);

          const maxDim = Math.max(size.x, size.y, size.z, 0.05);
          const camDist = Math.min(Math.max(maxDim * 1.5, 0.12), 3.5);
          viewer.camera.position.set(center.x + camDist * 0.35, center.y + camDist * 0.15, center.z + camDist);
          viewer.controls.minDistance = 0.01;
          viewer.controls.maxDistance = 10;
          viewer.controls.update();

          resetBtn.addEventListener('click', () => {
            viewer.controls.target.copy(center);
            viewer.camera.position.set(center.x + camDist * 0.35, center.y + camDist * 0.15, center.z + camDist);
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
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 3px 12px rgba(0,0,0,.05); overflow:hidden;';

    // 1. Header with Title & Export Actions
    const header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headerLeft = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black); display:block;';
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
    saveWorkBtn.style.cssText = 'font-size:0.75rem; padding:5px 14px; border-radius:9999px; background:var(--black); color:var(--white); cursor:pointer; font-weight:700;';

    headerActions.append(savePngBtn, saveSvgBtn, saveWorkBtn);
    header.append(headerLeft, headerActions);
    card.appendChild(header);

    // 2. Visual Diagram Canvas Container
    const diagramWrapper = document.createElement('div');
    diagramWrapper.style.cssText = 'padding:24px 16px; background:var(--g50); overflow-x:auto; border-bottom:1px solid var(--g200);';

    const diagramInner = document.createElement('div');
    diagramInner.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:10px; min-width:min-content; margin:0 auto; flex-wrap:wrap;';

    // Render Steps / Nodes
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      const nodeBox = document.createElement('div');
      nodeBox.style.cssText = 'display:flex; flex-direction:column; align-items:center; text-align:center; min-width:130px; max-width:170px; padding:14px 12px; background:var(--white); border:1.5px solid var(--g200); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,.04); position:relative;';

      const stepBadge = document.createElement('span');
      stepBadge.textContent = step.badge || `Stage ${i + 1}`;
      stepBadge.style.cssText = 'font-size:0.68rem; font-weight:800; color:var(--primary, #2563eb); background:var(--primary-light, rgba(37,99,235,0.12)); padding:2px 8px; border-radius:9999px; margin-bottom:6px;';

      const nodeTitle = document.createElement('div');
      nodeTitle.textContent = step.label;
      nodeTitle.style.cssText = 'font-size:0.88rem; font-weight:700; color:var(--black); margin-bottom:4px; line-height:1.3;';

      nodeBox.append(stepBadge, nodeTitle);

      if (step.description) {
        const nodeDesc = document.createElement('div');
        nodeDesc.textContent = step.description;
        nodeDesc.style.cssText = 'font-size:0.72rem; color:var(--g600); line-height:1.35; margin-top:2px;';
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
      summaryBox.style.cssText = 'padding:16px; background:var(--white); font-size:0.86rem; line-height:1.6; color:var(--black);';
      const summaryHeader = document.createElement('div');
      summaryHeader.style.cssText = 'font-weight:700; color:var(--g700); margin-bottom:6px; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;';
      summaryHeader.textContent = 'Concept Breakdown & Analysis';

      const summaryText = document.createElement('div');
      summaryText.textContent = summary;
      summaryText.style.cssText = 'color:var(--black);';

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
    header.style.cssText = 'padding:12px 16px; background:var(--g50); border:1px solid var(--g200); border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headerLeft = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Diseases & Pathology: "${query}"`;
    title.style.cssText = 'font-size:0.92rem; color:var(--black); display:block;';
    const sub = document.createElement('span');
    sub.textContent = `${diseases.length} condition(s) indexed by epidemiological commodity & WHO ICD-11`;
    sub.style.cssText = 'font-size:0.74rem; color:var(--g600);';
    headerLeft.append(title, sub);

    header.appendChild(headerLeft);
    wrapper.appendChild(header);

    for (const d of diseases) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

      const cardHead = document.createElement('div');
      cardHead.style.cssText = 'padding:12px 16px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

      const headTitle = document.createElement('div');
      const dName = document.createElement('strong');
      dName.textContent = d.name;
      dName.style.cssText = 'font-size:0.95rem; color:var(--black); margin-right:8px;';

      const icdBadge = document.createElement('span');
      icdBadge.textContent = `ICD-11: ${d.icd11}`;
      icdBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:var(--primary-light, rgba(37,99,235,0.12)); color:var(--primary, #2563eb); font-weight:700;';

      const commodityBadge = document.createElement('span');
      commodityBadge.textContent = `Commodity ${d.commodity}/100`;
      commodityBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:9999px; background:rgba(34,197,94,0.12); color:#16a34a; font-weight:700; margin-left:6px;';

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
      cardBody.style.cssText = 'padding:14px 16px; display:flex; flex-direction:column; gap:10px; font-size:0.84rem; line-height:1.5; color:var(--black);';

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
        mgmtBlock.style.cssText = 'padding:8px 12px; background:var(--g50); border-radius:8px; border-left:3px solid var(--primary, #2563eb); border:1px solid var(--g200);';
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
 * INVOICE RESULT — Renders professional financial invoices with PDF download & handoff
 */
export class InvoiceResultRenderer extends ResultRenderer {
  static id = 'invoice';
  static name = 'Invoice';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'invoice' ||
      result.type === 'invoice' ||
      Boolean(data.invoice);
  }

  static render(result, container) {
    const data = result.data || {};
    const inv = data.invoice || data;
    const client = inv.client || 'Client';
    const number = inv.number || 'INV-001';
    const currency = inv.currency || 'NGN';
    const lines = Array.isArray(inv.lines) ? inv.lines : [];
    const sym = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '₦'));

    const card = document.createElement('div');
    card.className = 'assistant-result-invoice-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black); font-family:var(--sans);';

    // Header
    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const numBadge = document.createElement('span');
    numBadge.textContent = number;
    numBadge.style.cssText = 'font-weight:800; font-size:0.95rem; color:var(--black);';
    const statusBadge = document.createElement('span');
    statusBadge.textContent = 'Invoice';
    statusBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(numBadge);
    headLeft.appendChild(statusBadge);

    const headActions = document.createElement('div');
    headActions.style.cssText = 'display:flex; align-items:center; gap:6px;';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-sm';
    editBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Edit in Builder</span>`;
    editBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    editBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox.invoice.handoff', JSON.stringify(inv));
        window.location.hash = '#invoice-generator';
      } catch {}
    });

    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'btn btn-primary btn-sm';
    printBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.download} Download PDF</span>`;
    printBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    printBtn.addEventListener('click', () => {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`
          <!DOCTYPE html><html><head><title>${number}</title>
          <style>body{font-family:sans-serif;padding:40px;color:#000;} table{width:100%;border-collapse:collapse;margin:20px 0;} th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left;} th{background:#f5f5f5;} .total{font-size:1.2rem;font-weight:bold;text-align:right;}</style>
          </head><body>
          <h2>INVOICE: ${number}</h2>
          <p><strong>Billed To:</strong><br>${client.replace(/\n/g, '<br>')}</p>
          <p><strong>Issued:</strong> ${inv.issued || ''} · <strong>Due:</strong> ${inv.due || ''}</p>
          <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
          ${lines.map(l => `<tr><td>${l.description}</td><td>${l.qty}</td><td>${sym}${l.price.toLocaleString()}</td><td>${sym}${(l.qty * l.price).toLocaleString()}</td></tr>`).join('')}
          </tbody></table>
          <p class="total">Total Due: ${sym}${(inv.total || 0).toLocaleString()}</p>
          <p style="margin-top:30px;font-size:0.85rem;color:#666;">${(inv.notes || '').replace(/\n/g, '<br>')}</p>
          <script>window.print();<\/script></body></html>
        `);
        w.document.close();
      }
    });

    headActions.appendChild(editBtn);
    headActions.appendChild(printBtn);
    head.appendChild(headLeft);
    head.appendChild(headActions);
    card.appendChild(head);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:12px; font-size:0.85rem;';

    // Client/Dates Info Bar
    const metaBar = document.createElement('div');
    metaBar.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; padding:10px 14px; background:var(--g50); border-radius:10px; border:1px solid var(--g150);';
    metaBar.innerHTML = `
      <div><span style="font-size:0.72rem; color:var(--g600); text-transform:uppercase; font-weight:700; display:block;">Billed To</span><strong style="color:var(--black);">${client.split('\n')[0]}</strong></div>
      <div><span style="font-size:0.72rem; color:var(--g600); text-transform:uppercase; font-weight:700; display:block;">Issued Date</span><span>${inv.issued || 'Today'}</span></div>
      <div><span style="font-size:0.72rem; color:var(--g600); text-transform:uppercase; font-weight:700; display:block;">Due Date</span><span>${inv.due || 'Net 30'}</span></div>
    `;
    body.appendChild(metaBar);

    // Table
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow-x:auto; margin-top:4px;';
    tableWrap.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:0.84rem; text-align:left;">
        <thead>
          <tr style="border-bottom:1.5px solid var(--g200); color:var(--g600); font-size:0.75rem; text-transform:uppercase;">
            <th style="padding:6px 8px;">Description</th>
            <th style="padding:6px 8px; text-align:center;">Qty</th>
            <th style="padding:6px 8px; text-align:right;">Price</th>
            <th style="padding:6px 8px; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map(l => `
            <tr style="border-bottom:1px solid var(--g150);">
              <td style="padding:8px; font-weight:600; color:var(--black);">${l.description}</td>
              <td style="padding:8px; text-align:center; color:var(--g700);">${l.qty}</td>
              <td style="padding:8px; text-align:right; font-family:var(--mono); color:var(--g700);">${sym}${l.price.toLocaleString()}</td>
              <td style="padding:8px; text-align:right; font-weight:700; font-family:var(--mono); color:var(--black);">${sym}${(l.qty * l.price).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    body.appendChild(tableWrap);

    // Total summary
    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:6px; padding:10px 14px; background:var(--g50); border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
    summary.innerHTML = `
      <div style="font-size:0.75rem; color:var(--g600);">${inv.notes || 'Net 30 payment terms.'}</div>
      <div style="text-align:right;">
        <span style="font-size:0.78rem; color:var(--g600); margin-right:8px;">Total Due:</span>
        <strong style="font-size:1.15rem; font-family:var(--mono); color:var(--black);">${sym}${(inv.total || 0).toLocaleString()}</strong>
      </div>
    `;
    body.appendChild(summary);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * UML DIAGRAM RESULT — Renders interactive Mermaid UML diagrams with vector export
 */
export class UmlDiagramResultRenderer extends ResultRenderer {
  static id = 'uml-diagram';
  static name = 'UML Diagram';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'uml-diagram' ||
      result.type === 'uml-diagram' ||
      Boolean(data.code && data.diagramType);
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'UML Diagram';
    const diagramType = (data.diagramType || 'diagram').toUpperCase();
    const code = data.code || '';

    const card = document.createElement('div');
    card.className = 'assistant-result-uml-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    // Header
    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const typeBadge = document.createElement('span');
    typeBadge.textContent = diagramType;
    typeBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(typeBadge);

    const headRight = document.createElement('div');
    headRight.style.cssText = 'display:flex; align-items:center; gap:6px;';

    const openStudioBtn = document.createElement('button');
    openStudioBtn.type = 'button';
    openStudioBtn.className = 'btn btn-secondary btn-sm';
    openStudioBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open in UML Studio</span>`;
    openStudioBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openStudioBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox.uml.handoff', JSON.stringify({ code, diagramType }));
        window.location.hash = '#uml-diagram';
      } catch {}
    });

    const saveSvgBtn = document.createElement('button');
    saveSvgBtn.type = 'button';
    saveSvgBtn.className = 'btn btn-primary btn-sm';
    saveSvgBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.download} Save SVG</span>`;
    saveSvgBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    saveSvgBtn.addEventListener('click', () => {
      const svgEl = card.querySelector('svg');
      if (svgEl) {
        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });

    headRight.appendChild(openStudioBtn);
    headRight.appendChild(saveSvgBtn);
    head.appendChild(headLeft);
    head.appendChild(headRight);
    card.appendChild(head);

    // Canvas Container
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'padding:20px; background:var(--white); overflow:auto; display:flex; justify-content:center; align-items:center; min-height:180px;';

    const stageId = `mermaid-stage-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const stage = document.createElement('div');
    stage.id = stageId;
    stage.style.cssText = 'width:100%; display:flex; justify-content:center;';

    // Code fallback / rendering
    const codeBlock = document.createElement('pre');
    codeBlock.style.cssText = 'font-family:var(--mono); font-size:0.8rem; background:var(--g50); padding:12px; border-radius:8px; border:1px solid var(--g200); width:100%; overflow-x:auto; margin:0;';
    codeBlock.textContent = code;
    stage.appendChild(codeBlock);
    canvasWrap.appendChild(stage);
    card.appendChild(canvasWrap);

    // Render Mermaid if library loaded
    if (typeof window !== 'undefined') {
      import('https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs').then(m => {
        try {
          m.default.initialize({ startOnLoad: false, theme: 'neutral' });
          m.default.render(`${stageId}-svg`, code).then(({ svg }) => {
            stage.innerHTML = svg;
          }).catch(() => {});
        } catch {}
      }).catch(() => {});
    }

    container.appendChild(card);
    return card;
  }
}

/**
 * ALGORITHM SIMULATION RESULT — Step-by-step playback scrubber for sorting/searching
 */
export class AlgorithmResultRenderer extends ResultRenderer {
  static id = 'algorithm-simulation';
  static name = 'Algorithm Simulation';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'algorithm-simulation' ||
      result.type === 'algorithm-simulation' ||
      Boolean(data.frames && data.algorithm);
  }

  static render(result, container) {
    const data = result.data || {};
    const name = data.name || 'Algorithm';
    const frames = Array.isArray(data.frames) && data.frames.length ? data.frames : [];
    const complexity = data.complexity || { time: 'O(N²)', space: 'O(1)' };

    let currentFrameIdx = 0;
    let isPlaying = false;
    let playInterval = null;

    const card = document.createElement('div');
    card.className = 'assistant-result-algo-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    // Header
    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = name;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const compBadge = document.createElement('span');
    compBadge.textContent = `Time: ${complexity.time} · Space: ${complexity.space}`;
    compBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(compBadge);

    const openAlgoBtn = document.createElement('button');
    openAlgoBtn.type = 'button';
    openAlgoBtn.className = 'btn btn-secondary btn-sm';
    openAlgoBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open in Algorithm Lab</span>`;
    openAlgoBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openAlgoBtn.addEventListener('click', () => {
      window.location.hash = '#algorithm-lab';
    });

    head.appendChild(headLeft);
    head.appendChild(openAlgoBtn);
    card.appendChild(head);

    // Visual Stage
    const stage = document.createElement('div');
    stage.style.cssText = 'padding:20px; background:var(--white); display:flex; flex-direction:column; gap:14px;';

    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'height:120px; display:flex; align-items:flex-end; gap:6px; justify-content:center; padding:10px; background:var(--g50); border-radius:10px; border:1px solid var(--g150);';

    const noteEl = document.createElement('div');
    noteEl.style.cssText = 'font-size:0.8rem; color:var(--g700); text-align:center; min-height:20px;';

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-primary btn-sm';
    playBtn.textContent = '▶ Play';
    playBtn.style.cssText = 'border-radius:9999px; padding:4px 14px; font-size:0.78rem; font-weight:700; cursor:pointer;';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn-secondary btn-sm';
    prevBtn.textContent = '◀ Step';
    prevBtn.style.cssText = 'border-radius:9999px; padding:4px 10px; font-size:0.78rem; cursor:pointer;';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-secondary btn-sm';
    nextBtn.textContent = 'Step ▶';
    nextBtn.style.cssText = 'border-radius:9999px; padding:4px 10px; font-size:0.78rem; cursor:pointer;';

    const scrub = document.createElement('input');
    scrub.type = 'range';
    scrub.min = '0';
    scrub.max = String(Math.max(0, frames.length - 1));
    scrub.value = '0';
    scrub.style.cssText = 'width:140px; cursor:pointer;';

    const frameCounter = document.createElement('span');
    frameCounter.style.cssText = 'font-size:0.75rem; font-family:var(--mono); color:var(--g600); min-width:60px; text-align:center;';

    function renderFrame(idx) {
      if (!frames.length) return;
      currentFrameIdx = Math.max(0, Math.min(frames.length - 1, idx));
      const f = frames[currentFrameIdx];
      scrub.value = String(currentFrameIdx);
      frameCounter.textContent = `${currentFrameIdx + 1} / ${frames.length}`;
      noteEl.textContent = f.note || '';

      const maxVal = Math.max(...(f.data || [100]));
      barContainer.innerHTML = '';
      (f.data || []).forEach((val, i) => {
        const bar = document.createElement('div');
        const hPct = Math.max(10, Math.round((val / maxVal) * 100));
        const isFocus = f.a === i || f.b === i || f.mid === i;
        const isDone = Array.isArray(f.sorted) && f.sorted.includes(i);
        bar.style.cssText = `flex:1; max-width:24px; height:${hPct}%; border-radius:4px 4px 0 0; background:${isFocus ? 'var(--primary, #2563eb)' : (isDone ? '#10b981' : 'var(--g300)')}; transition:all 0.15s ease; display:flex; align-items:flex-end; justify-content:center;`;
        bar.innerHTML = `<span style="font-size:0.6rem; color:var(--white); margin-bottom:2px; font-weight:700;">${val}</span>`;
        barContainer.appendChild(bar);
      });
    }

    playBtn.addEventListener('click', () => {
      if (isPlaying) {
        clearInterval(playInterval);
        isPlaying = false;
        playBtn.textContent = '▶ Play';
      } else {
        isPlaying = true;
        playBtn.textContent = '⏸ Pause';
        playInterval = setInterval(() => {
          if (currentFrameIdx >= frames.length - 1) {
            clearInterval(playInterval);
            isPlaying = false;
            playBtn.textContent = '▶ Play';
          } else {
            renderFrame(currentFrameIdx + 1);
          }
        }, 300);
      }
    });

    prevBtn.addEventListener('click', () => {
      clearInterval(playInterval);
      isPlaying = false;
      playBtn.textContent = '▶ Play';
      renderFrame(currentFrameIdx - 1);
    });

    nextBtn.addEventListener('click', () => {
      clearInterval(playInterval);
      isPlaying = false;
      playBtn.textContent = '▶ Play';
      renderFrame(currentFrameIdx + 1);
    });

    scrub.addEventListener('input', (e) => {
      clearInterval(playInterval);
      isPlaying = false;
      playBtn.textContent = '▶ Play';
      renderFrame(Number(e.target.value));
    });

    controls.appendChild(prevBtn);
    controls.appendChild(playBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(scrub);
    controls.appendChild(frameCounter);

    stage.appendChild(barContainer);
    stage.appendChild(noteEl);
    stage.appendChild(controls);
    card.appendChild(stage);

    renderFrame(0);
    container.appendChild(card);
    return card;
  }
}

/**
 * METRONOME RESULT — Web Audio ticking metronome widget inside chat
 */
export class MetronomeResultRenderer extends ResultRenderer {
  static id = 'metronome';
  static name = 'Metronome';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'metronome' ||
      result.type === 'metronome' ||
      Boolean(data.bpm && data.beats);
  }

  static render(result, container) {
    const data = result.data || {};
    let bpm = Number(data.bpm || 120);
    const beats = Number(data.beats || 4);
    let isRunning = false;
    let timer = null;
    let beatIdx = 0;
    let audioCtx = null;

    const card = document.createElement('div');
    card.className = 'assistant-result-metronome-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = 'Metronome';
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const beatsBadge = document.createElement('span');
    beatsBadge.textContent = `${beats}/4 Time`;
    beatsBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(beatsBadge);

    const openMetBtn = document.createElement('button');
    openMetBtn.type = 'button';
    openMetBtn.className = 'btn btn-secondary btn-sm';
    openMetBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open Metronome</span>`;
    openMetBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openMetBtn.addEventListener('click', () => {
      window.location.hash = '#metronome';
    });

    head.appendChild(headLeft);
    head.appendChild(openMetBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:20px; display:flex; flex-direction:column; align-items:center; gap:16px;';

    const bpmDisplay = document.createElement('div');
    bpmDisplay.style.cssText = 'display:flex; align-items:baseline; gap:6px;';
    bpmDisplay.innerHTML = `<span class="met-bpm-val" style="font-size:2.2rem; font-weight:800; font-family:var(--mono); color:var(--black);">${bpm}</span><span style="font-size:0.8rem; color:var(--g600); font-weight:700;">BPM</span>`;

    const dotsWrap = document.createElement('div');
    dotsWrap.style.cssText = 'display:flex; gap:10px;';
    for (let i = 0; i < beats; i++) {
      const dot = document.createElement('div');
      dot.className = `met-dot met-dot-${i}`;
      dot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:var(--g200); border:1.5px solid var(--g300); transition:all 0.08s ease;';
      dotsWrap.appendChild(dot);
    }

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '30';
    slider.max = '280';
    slider.value = String(bpm);
    slider.style.cssText = 'width:200px; cursor:pointer;';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-primary btn-sm';
    toggleBtn.textContent = '▶ Start Metronome';
    toggleBtn.style.cssText = 'border-radius:9999px; padding:6px 20px; font-size:0.85rem; font-weight:700; cursor:pointer;';

    function clickSound(isAccent) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = isAccent ? 1600 : 900;
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } catch {}
    }

    function tick() {
      const dots = dotsWrap.querySelectorAll('.met-dot');
      dots.forEach((d, i) => {
        if (i === beatIdx) {
          d.style.background = i === 0 ? 'var(--primary, #2563eb)' : 'var(--black)';
          d.style.transform = 'scale(1.25)';
        } else {
          d.style.background = 'var(--g200)';
          d.style.transform = 'scale(1)';
        }
      });

      clickSound(beatIdx === 0);
      beatIdx = (beatIdx + 1) % beats;
    }

    toggleBtn.addEventListener('click', () => {
      if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        toggleBtn.textContent = '▶ Start Metronome';
        const dots = dotsWrap.querySelectorAll('.met-dot');
        dots.forEach(d => { d.style.background = 'var(--g200)'; d.style.transform = 'scale(1)'; });
      } else {
        isRunning = true;
        toggleBtn.textContent = '⏸ Stop Metronome';
        beatIdx = 0;
        tick();
        timer = setInterval(tick, (60 / bpm) * 1000);
      }
    });

    slider.addEventListener('input', (e) => {
      bpm = Number(e.target.value);
      bpmDisplay.querySelector('.met-bpm-val').textContent = String(bpm);
      if (isRunning) {
        clearInterval(timer);
        timer = setInterval(tick, (60 / bpm) * 1000);
      }
    });

    body.appendChild(bpmDisplay);
    body.appendChild(dotsWrap);
    body.appendChild(slider);
    body.appendChild(toggleBtn);
    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * SOUND EFFECT RESULT — Web Audio synthesized foley and sound effects
 */
export class SoundEffectResultRenderer extends ResultRenderer {
  static id = 'sound-effect';
  static name = 'Sound Effect';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'sound-effect' ||
      result.type === 'sound-effect' ||
      Boolean(data.sfxType);
  }

  static render(result, container) {
    const data = result.data || {};
    const name = data.name || 'Sound Effect';
    const sfxType = data.sfxType || 'fanfare';
    const duration = Number(data.duration || 1.2);

    const card = document.createElement('div');
    card.className = 'assistant-result-sfx-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black); padding:16px 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;';

    const info = document.createElement('div');
    info.style.cssText = 'display:flex; align-items:center; gap:12px;';
    const waveIcon = document.createElement('div');
    waveIcon.style.cssText = 'width:40px; height:40px; border-radius:50%; background:var(--g100); border:1px solid var(--g200); display:flex; align-items:center; justify-content:center; color:var(--primary, #2563eb);';
    waveIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5v14M7 9v6M22 10v4M2 10v4"/></svg>`;

    const textWrap = document.createElement('div');
    textWrap.innerHTML = `
      <strong style="font-size:0.92rem; color:var(--black); display:block;">${name}</strong>
      <span style="font-size:0.75rem; color:var(--g600);">${sfxType.toUpperCase()} Audio · ${duration}s</span>
    `;
    info.appendChild(waveIcon);
    info.appendChild(textWrap);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-primary btn-sm';
    playBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">▶ Play Sound</span>`;
    playBtn.style.cssText = 'border-radius:9999px; padding:5px 16px; font-size:0.78rem; font-weight:700; cursor:pointer;';
    playBtn.addEventListener('click', () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = sfxType === 'laser' ? 'sawtooth' : 'sine';
        if (sfxType === 'laser') {
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + duration);
        } else {
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {}
    });

    const openLibBtn = document.createElement('button');
    openLibBtn.type = 'button';
    openLibBtn.className = 'btn btn-secondary btn-sm';
    openLibBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Sound Effects</span>`;
    openLibBtn.style.cssText = 'border-radius:9999px; padding:5px 14px; font-size:0.78rem; cursor:pointer; font-weight:700;';
    openLibBtn.addEventListener('click', () => {
      window.location.hash = '#sound-effects';
    });

    actions.appendChild(playBtn);
    actions.appendChild(openLibBtn);
    card.appendChild(info);
    card.appendChild(actions);
    container.appendChild(card);
    return card;
  }
}

/**
 * ELEMENTS COMPARISON RESULT — Periodic table atomic properties & Bohr models
 */
export class ElementsResultRenderer extends ResultRenderer {
  static id = 'elements-comparison';
  static name = 'Periodic Elements';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'elements-comparison' ||
      result.type === 'elements-comparison' ||
      Boolean(data.elements && Array.isArray(data.elements));
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'Periodic Table Elements Study';
    const elements = Array.isArray(data.elements) ? data.elements : [];

    const card = document.createElement('div');
    card.className = 'assistant-result-elements-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const countBadge = document.createElement('span');
    countBadge.textContent = `${elements.length} Elements`;
    countBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(countBadge);

    const openPtBtn = document.createElement('button');
    openPtBtn.type = 'button';
    openPtBtn.className = 'btn btn-secondary btn-sm';
    openPtBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open Periodic Table</span>`;
    openPtBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openPtBtn.addEventListener('click', () => {
      window.location.hash = '#periodic-table';
    });

    head.appendChild(headLeft);
    head.appendChild(openPtBtn);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.style.cssText = 'padding:16px 18px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;';

    elements.forEach(el => {
      const elBox = document.createElement('div');
      elBox.style.cssText = 'padding:12px; background:var(--g50); border:1px solid var(--g200); border-radius:12px; display:flex; flex-direction:column; gap:6px;';
      elBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:var(--mono); font-size:0.75rem; color:var(--g600);">Z = ${el.number || '—'}</span>
          <span style="font-size:0.7rem; padding:2px 6px; border-radius:9999px; background:var(--g200); font-weight:700;">${el.category || 'Element'}</span>
        </div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <strong style="font-size:1.4rem; font-family:var(--mono); color:var(--black);">${el.symbol}</strong>
          <span style="font-weight:700; font-size:0.9rem;">${el.name}</span>
        </div>
        <div style="font-size:0.76rem; color:var(--g700); line-height:1.4;">
          <div><strong>Atomic Mass:</strong> ${el.atomic_mass ? Number(el.atomic_mass).toFixed(3) : '—'} u</div>
          <div><strong>Electronegativity:</strong> ${el.electronegativity_pauling || '—'}</div>
          <div><strong>Electron Shells:</strong> ${(el.shells || []).join(', ') || '—'}</div>
        </div>
      `;
      grid.appendChild(elBox);
    });

    card.appendChild(grid);
    container.appendChild(card);
    return card;
  }
}

/**
 * CONTAINER QUOTE BUILDER RESULT — 3D CAD preview & Bill of Quantities costing
 */
export class ContainerQuoteResultRenderer extends ResultRenderer {
  static id = 'container-quote';
  static name = 'Container Quote';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'container-quote' ||
      result.type === 'container-quote' ||
      Boolean(data.quote && data.size);
  }

  static render(result, container) {
    const data = result.data || {};
    const size = data.size || '20ft';
    const usage = data.usage || 'Converted Unit';
    const quote = data.quote || { total: 18500, materials: 12000, labour: 6500 };
    const model = data.model || {};

    const card = document.createElement('div');
    card.className = 'assistant-result-container-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = `${size.toUpperCase()} ${usage}`;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const cadBadge = document.createElement('span');
    cadBadge.textContent = 'CAD Model';
    cadBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(cadBadge);

    const openCpBtn = document.createElement('button');
    openCpBtn.type = 'button';
    openCpBtn.className = 'btn btn-secondary btn-sm';
    openCpBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open in Planner</span>`;
    openCpBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openCpBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox.container.handoff', JSON.stringify(model));
        window.location.hash = '#container-planner';
      } catch {}
    });

    head.appendChild(headLeft);
    head.appendChild(openCpBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:14px;';

    // Canvas CAD Preview Box
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'height:140px; background:var(--g50); border-radius:12px; border:1px solid var(--g200); display:flex; align-items:center; justify-content:center; position:relative;';
    canvasWrap.innerHTML = `
      <svg width="240" height="100" viewBox="0 0 240 100" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--primary, #2563eb);">
        <polygon points="30,30 190,30 220,15 60,15" fill="rgba(37,99,235,0.06)"/>
        <polygon points="30,30 30,80 190,80 190,30" fill="rgba(37,99,235,0.12)"/>
        <polygon points="190,30 190,80 220,65 220,15" fill="rgba(37,99,235,0.18)"/>
        <rect x="50" y="40" width="30" height="30" stroke="var(--black)" stroke-width="1.5" fill="rgba(0,0,0,0.05)"/>
        <rect x="110" y="35" width="22" height="45" stroke="var(--black)" stroke-width="1.5" fill="rgba(0,0,0,0.05)"/>
      </svg>
      <span style="position:absolute; bottom:8px; right:12px; font-size:0.72rem; color:var(--g600); font-family:var(--mono);">3D Geometry · ${(model.len || 6).toFixed(1)}m × ${(model.wid || 2.4).toFixed(1)}m</span>
    `;
    body.appendChild(canvasWrap);

    // BoQ Summary Bar
    const boq = document.createElement('div');
    boq.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; padding:12px 14px; background:var(--g50); border-radius:10px; border:1px solid var(--g150);';
    boq.innerHTML = `
      <div><span style="font-size:0.72rem; color:var(--g600); font-weight:700; text-transform:uppercase; display:block;">Materials</span><strong style="font-family:var(--mono);">₦${(quote.materials || 0).toLocaleString()}</strong></div>
      <div><span style="font-size:0.72rem; color:var(--g600); font-weight:700; text-transform:uppercase; display:block;">Labour</span><strong style="font-family:var(--mono);">₦${(quote.labour || 0).toLocaleString()}</strong></div>
      <div><span style="font-size:0.72rem; color:var(--g600); font-weight:700; text-transform:uppercase; display:block;">Total Estimated</span><strong style="font-size:1.1rem; color:var(--primary, #2563eb); font-family:var(--mono);">₦${(quote.total || 0).toLocaleString()}</strong></div>
    `;
    body.appendChild(boq);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * FLOOR PLAN RESULT — 2D vector architectural floor plan blueprint
 */
export class FloorPlanResultRenderer extends ResultRenderer {
  static id = 'floor-plan';
  static name = 'Floor Plan';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'floor-plan' ||
      result.type === 'floor-plan' ||
      Boolean(data.rooms && data.squareMeters);
  }

  static render(result, container) {
    const data = result.data || {};
    const title = result.title || data.title || 'Floor Plan';
    const squareMeters = Number(result.squareMeters || data.squareMeters || 85);
    const rooms = Array.isArray(result.rooms) && result.rooms.length
      ? result.rooms
      : (Array.isArray(data.rooms) && data.rooms.length
          ? data.rooms
          : [
              { name: 'Living Room', width: 5.5, length: 6.0, x: 0, y: 0, color: '#3b82f6' },
              { name: 'Master Bedroom', width: 4.0, length: 3.8, x: 5.5, y: 0, color: '#10b981' },
              { name: 'Kitchen & Bath', width: 4.0, length: 2.2, x: 5.5, y: 3.8, color: '#f59e0b' }
            ]);

    const card = document.createElement('div');
    card.className = 'assistant-result-floorplan-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const areaBadge = document.createElement('span');
    areaBadge.textContent = `${squareMeters} m² Area`;
    areaBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(areaBadge);

    const openArchBtn = document.createElement('button');
    openArchBtn.type = 'button';
    openArchBtn.className = 'btn btn-secondary btn-sm';
    openArchBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Edit in Architecture Studio</span>`;
    openArchBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openArchBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox.arch.handoff', JSON.stringify({ rooms, title, squareMeters }));
        window.location.hash = '#architecture-editor';
      } catch {}
    });

    head.appendChild(headLeft);
    head.appendChild(openArchBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:14px;';

    // Dynamic Vector Blueprint SVG scaled to viewBox
    const maxX = Math.max(...rooms.map(r => (r.x || 0) + (r.width || 4)), 8);
    const maxY = Math.max(...rooms.map(r => (r.y || 0) + (r.length || r.height || 4)), 6);
    const svgW = 320;
    const svgH = 180;
    const pad = 16;
    const s = Math.min((svgW - pad * 2) / maxX, (svgH - pad * 2) / maxY);
    const offX = (svgW - maxX * s) / 2;
    const offY = (svgH - maxY * s) / 2;

    const roomSvgs = rooms.map(r => {
      const rx = offX + (r.x || 0) * s;
      const ry = offY + (r.y || 0) * s;
      const rw = (r.width || 4) * s;
      const rh = (r.length || r.height || 4) * s;
      const fillCol = r.color ? `${r.color}15` : 'rgba(59,130,246,0.08)';
      return `
        <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" stroke="var(--black)" stroke-width="2" fill="${fillCol}"/>
        <text x="${rx + rw / 2}" y="${ry + rh / 2 + 3}" font-size="8" font-family="sans-serif" font-weight="600" fill="var(--black)" text-anchor="middle">${r.name}</text>
      `;
    }).join('');

    const svgWrap = document.createElement('div');
    svgWrap.style.cssText = 'height:180px; background:var(--g50); border-radius:12px; border:1px solid var(--g200); display:flex; align-items:center; justify-content:center; overflow:hidden;';
    svgWrap.innerHTML = `
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" fill="none" stroke="currentColor" style="color:var(--black);">
        ${roomSvgs}
      </svg>
    `;
    body.appendChild(svgWrap);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * LOGIC CIRCUIT RESULT — Interactive digital circuit schematic with live signal toggles
 */
export class LogicCircuitResultRenderer extends ResultRenderer {
  static id = 'logic-circuit';
  static name = 'Logic Circuit';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'logic-circuit' ||
      result.type === 'logic-circuit' ||
      Boolean(data.gates && data.connections);
  }

  static render(result, container) {
    const data = result.data || {};
    const name = data.name || 'Digital Logic Circuit';
    const expression = data.expression || 'Y = A · B';
    const inputs = Array.isArray(data.inputs) ? data.inputs : ['A', 'B'];

    const inputState = {};
    inputs.forEach(inp => { inputState[inp] = 0; });

    const card = document.createElement('div');
    card.className = 'assistant-result-logic-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = name;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const gatesBadge = document.createElement('span');
    gatesBadge.textContent = 'Logic Gates';
    gatesBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(gatesBadge);

    const openLogicBtn = document.createElement('button');
    openLogicBtn.type = 'button';
    openLogicBtn.className = 'btn btn-secondary btn-sm';
    openLogicBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open in Logic Lab</span>`;
    openLogicBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openLogicBtn.addEventListener('click', () => {
      window.location.hash = '#logic-lab';
    });

    head.appendChild(headLeft);
    head.appendChild(openLogicBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:14px;';

    // Interactive Input Toggles
    const toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex; align-items:center; gap:12px; flex-wrap:wrap;';
    toggleWrap.innerHTML = `<span style="font-size:0.78rem; font-weight:700; color:var(--g600);">Interactive Inputs:</span>`;

    const outDisplay = document.createElement('span');
    outDisplay.style.cssText = 'font-size:0.78rem; font-family:var(--mono); font-weight:700; padding:3px 10px; border-radius:9999px; background:var(--g100); border:1px solid var(--g200); margin-left:auto;';
    outDisplay.textContent = 'Output: 0';

    inputs.forEach(inp => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.style.cssText = 'font-size:0.75rem; font-family:var(--mono); font-weight:700; border-radius:9999px; padding:3px 12px; cursor:pointer;';
      btn.textContent = `${inp} = 0`;
      btn.addEventListener('click', () => {
        inputState[inp] = inputState[inp] === 0 ? 1 : 0;
        btn.textContent = `${inp} = ${inputState[inp]}`;
        btn.style.background = inputState[inp] === 1 ? 'var(--black)' : '';
        btn.style.color = inputState[inp] === 1 ? 'var(--white)' : '';
        // Evaluate simple sum
        const sum = Object.values(inputState).reduce((a, b) => a ^ b, 0);
        outDisplay.textContent = `Output (Sum): ${sum}`;
      });
      toggleWrap.appendChild(btn);
    });
    toggleWrap.appendChild(outDisplay);
    body.appendChild(toggleWrap);

    // Expression summary
    const exprBox = document.createElement('div');
    exprBox.style.cssText = 'padding:10px 14px; background:var(--g50); border-radius:10px; border-left:3.5px solid var(--primary, #2563eb); font-size:0.82rem; font-family:var(--mono); color:var(--black);';
    exprBox.innerHTML = `<strong>Formula:</strong> ${expression}`;
    body.appendChild(exprBox);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * MAP RESULT — Interactive visual vector/tile map with markers and routes
 */
export class MapResultRenderer extends ResultRenderer {
  static id = 'map-view';
  static name = 'Map View';

  static canRender(result) {
    const data = result?.data || result || {};
    return result?.renderer === 'map-view' ||
      result?.type === 'map-view' ||
      data?.renderer === 'map-view' ||
      data?.type === 'map-view' ||
      Boolean(data?.markers && Array.isArray(data?.markers)) ||
      Boolean(result?.markers && Array.isArray(result?.markers)) ||
      Boolean(data?.places && Array.isArray(data?.places));
  }

  static render(result, container) {
    const data = (result?.data && (result.data.markers || result.data.places || result.data.title)) ? result.data : (result || {});
    const rawTitle = data.title || result?.title || 'Geographic Map';
    const title = sanitizeUserFacingText(rawTitle);
    let markers = Array.isArray(data.markers) ? data.markers : (Array.isArray(result?.markers) ? result.markers : []);
    const places = Array.isArray(data.places) ? data.places : (Array.isArray(result?.places) ? result.places : []);
    const distanceKm = Number(data.distanceKm || result?.distanceKm || 0);

    // If places are provided but markers are empty, construct markers from places
    if ((!markers || markers.length === 0) && places.length > 0) {
      markers = places.map(p => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        description: `${p.address || ''} ${p.phone ? '· ' + p.phone : ''}`
      }));
    }

    const card = document.createElement('div');
    card.className = 'assistant-result-map-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black); font-family:var(--sans);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    headLeft.appendChild(titleEl);

    // Only show route distance badge on header if places list is empty (e.g. waypoint route)
    if (distanceKm > 0 && places.length === 0) {
      const distBadge = document.createElement('span');
      distBadge.textContent = `${distanceKm.toLocaleString()} km`;
      distBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
      headLeft.appendChild(distBadge);
    }

    const openMapBtn = document.createElement('button');
    openMapBtn.type = 'button';
    openMapBtn.className = 'btn btn-secondary btn-sm';
    openMapBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open Interactive Map</span>`;
    openMapBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700; border:1px solid var(--g200);';
    openMapBtn.addEventListener('click', () => {
      try {
        sessionStorage.setItem('toolbox.map.handoff', JSON.stringify({ title, markers, distanceKm }));
        window.location.hash = '#interactive-map';
      } catch {}
    });

    head.appendChild(headLeft);
    head.appendChild(openMapBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px; display:flex; flex-direction:column; gap:10px;';

    // Visual Map Preview Canvas
    const mapStage = document.createElement('div');
    const mapStageId = `ast-map-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`;
    mapStage.id = mapStageId;
    mapStage.style.cssText = 'width:100%; height:180px; border-radius:12px; background:#0f172a; border:1px solid var(--g200); position:relative; overflow:hidden; z-index:1;';

    const userLoc = data.userLocation || result?.userLocation || null;
    const hasUserLocation = Boolean(
      userLoc &&
      typeof userLoc.lat === 'number' &&
      typeof userLoc.lng === 'number' &&
      !isNaN(userLoc.lat) &&
      !isNaN(userLoc.lng) &&
      Math.abs(userLoc.lat) <= 90 &&
      Math.abs(userLoc.lng) <= 180 &&
      !(userLoc.lat === 0 && userLoc.lng === 0)
    );

    if (markers.length > 0 || hasUserLocation) {
      const validMarkers = markers.filter(m => typeof m.lat === 'number' && typeof m.lng === 'number' && !isNaN(m.lat) && !isNaN(m.lng) && !(m.lat === 0 && m.lng === 0));
      const markersToUse = validMarkers;

      const lats = markersToUse.map(m => m.lat);
      const lngs = markersToUse.map(m => m.lng);
      if (hasUserLocation) {
        lats.push(userLoc.lat);
        lngs.push(userLoc.lng);
      }

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Authentic geographic projection (equirectangular with latitude cosine compensation)
      const cosLat = Math.cos(centerLat * Math.PI / 180);
      const latSpan = Math.max(maxLat - minLat, 0.012);
      const lngSpan = Math.max(maxLng - minLng, 0.012);

      // Canvas dimensions 600x180: available plot box 480x120 centered at (300, 90)
      const scaleLat = 120 / latSpan;
      const scaleLng = 480 / (lngSpan * Math.max(cosLat, 0.3));
      const geoScale = Math.min(scaleLat, scaleLng);

      const points = markersToUse.map((m, idx) => {
        const x = Math.round(300 + (m.lng - centerLng) * cosLat * geoScale);
        const y = Math.round(90 - (m.lat - centerLat) * geoScale);
        const rank = m.rank || (idx + 1);
        return { x, y, name: m.name, rank, lat: m.lat, lng: m.lng };
      });

      // Distinct User Location Marker (Origin)
      let userMarkerHtml = '';
      if (hasUserLocation) {
        const userX = Math.round(300 + (userLoc.lng - centerLng) * cosLat * geoScale);
        const userY = Math.round(90 - (userLoc.lat - centerLat) * geoScale);
        userMarkerHtml = `
          <g class="map-user-location-marker" role="img" aria-label="Your location">
            <circle cx="${userX}" cy="${userY}" r="16" fill="#06b6d4" fill-opacity="0.2"/>
            <circle cx="${userX}" cy="${userY}" r="8" fill="#0ea5e9" stroke="#ffffff" stroke-width="2.5"/>
            <circle cx="${userX}" cy="${userY}" r="3" fill="#ffffff"/>
            <text x="${userX}" y="${userY + 18}" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="700" letter-spacing="0.2px">Your location</text>
          </g>
        `;
      }

      // True metric scale bar: 1 deg lat ~= 111.32 km
      const pxPerKm = geoScale / 111.32;
      const scaleCandidates = [1, 2, 5, 10, 20, 50];
      const scaleKm = scaleCandidates.find(c => (c * pxPerKm) >= 40) || 5;
      const scaleBarWidth = Math.min(180, Math.max(30, Math.round(scaleKm * pxPerKm)));

      // ONLY draw polyline if an explicit continuous route was requested (not for independent places)
      const polylineHtml = (points.length > 1 && Array.isArray(data.route) && data.route.length > 1)
        ? `<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="5,5" fill="none"/>`
        : '';

      const markersHtml = points.map(p => `
        <g>
          <circle cx="${p.x}" cy="${p.y}" r="12" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
          <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold">${p.rank}</text>
          <text x="${p.x}" y="${p.y - 15}" text-anchor="middle" fill="#f1f5f9" font-size="9.5" font-weight="600">${escapeHtml(p.name.length > 24 ? p.name.slice(0, 22) + '…' : p.name)}</text>
        </g>
      `).join('');

      mapStage.innerHTML = `
        <svg viewBox="0 0 600 180" style="width:100%; height:100%; display:block; background:#0f172a; border-radius:12px;">
          <defs>
            <pattern id="geoGrid-${mapStageId}" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#0f172a"/>
          <rect width="100%" height="100%" fill="url(#geoGrid-${mapStageId})"/>

          <!-- Geographic coordinates & North indicator -->
          <g transform="translate(568, 24)">
            <circle cx="0" cy="0" r="11" fill="#1e293b" stroke="#334155" stroke-width="1"/>
            <path d="M0 -6 L3 3 L0 1 L-3 3 Z" fill="#38bdf8"/>
            <text x="0" y="-8" text-anchor="middle" fill="#94a3b8" font-size="7.5" font-weight="bold">N</text>
          </g>

          <!-- Geographic center label -->
          <text x="20" y="24" fill="#64748b" font-size="9.5" font-weight="600" font-family="sans-serif">
            Coordinates: ${centerLat.toFixed(3)}°N, ${centerLng.toFixed(3)}°E
          </text>

          <!-- Metric Scale Bar -->
          <g transform="translate(20, 162)">
            <line x1="0" y1="0" x2="${scaleBarWidth}" y2="0" stroke="#94a3b8" stroke-width="1.8"/>
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#94a3b8" stroke-width="1.8"/>
            <line x1="${scaleBarWidth}" y1="-3" x2="${scaleBarWidth}" y2="3" stroke="#94a3b8" stroke-width="1.8"/>
            <text x="${scaleBarWidth / 2}" y="-4" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" font-family="sans-serif">${scaleKm} km</text>
          </g>

          ${polylineHtml}
          ${userMarkerHtml}
          ${markersHtml}
        </svg>
      `;
    } else {
      mapStage.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8; font-size:0.85rem;">Interactive Map Visualizer</div>`;
    }

    body.appendChild(mapStage);

    // Detailed Places Cards (if places array provided)
    if (places.length > 0) {
      const placesWrap = document.createElement('div');
      placesWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:2px;';

      places.forEach((p, i) => {
        const pCard = document.createElement('div');
        pCard.style.cssText = 'padding:10px 14px; background:var(--g50); border-radius:10px; border:1px solid var(--g200); display:flex; flex-direction:column; gap:4px;';

        const pName = sanitizeUserFacingText(p.name || 'Place');
        const rawAddress = sanitizeUserFacingText(p.address || '');
        const pPhone = sanitizeUserFacingText(p.phone || '');
        const pDist = p.distanceKm ? `${p.distanceKm} km` : (p.distance ? `${p.distance}` : '');

        // Strip repeated business name from start of address
        let displayAddress = rawAddress;
        if (displayAddress.toLowerCase().startsWith(pName.toLowerCase() + ',')) {
          displayAddress = displayAddress.slice(pName.length + 1).trim();
        }

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;';
        
        const topRowLeft = document.createElement('div');
        topRowLeft.innerHTML = `
          <strong style="color:var(--black); font-size:0.88rem;">${i + 1}. ${escapeHtml(pName)}</strong>
          ${p.certified ? `<div style="font-size:0.72rem; color:#16a34a; font-weight:700; margin-top:2px;">Verified: ${escapeHtml(p.certified)}</div>` : ''}
        `;
        topRow.appendChild(topRowLeft);

        const topRowRight = document.createElement('div');
        topRowRight.style.cssText = 'display:flex; align-items:center; gap:6px;';
        if (pDist) {
          topRowRight.innerHTML += `<span style="font-size:0.75rem; font-weight:700; background:var(--g100); color:var(--g700); padding:3px 10px; border-radius:9999px; border:1px solid var(--g200);">${escapeHtml(pDist)}</span>`;
        }
        if (p.pricing) {
          topRowRight.innerHTML += `<span style="font-size:0.75rem; font-weight:750; background:var(--g100); color:var(--black); padding:3px 10px; border-radius:9999px; border:1px solid var(--g200);">${escapeHtml(p.pricing)}</span>`;
        }
        topRow.appendChild(topRowRight);
        pCard.appendChild(topRow);

        if (displayAddress || pPhone) {
          const infoRow = document.createElement('div');
          infoRow.style.cssText = 'font-size:0.76rem; color:var(--g600); display:flex; gap:12px; flex-wrap:wrap; margin-top:2px;';
          if (displayAddress) {
            infoRow.innerHTML += `<span style="display:inline-flex; align-items:center; gap:5px;">${ICONS.pin}<span>${escapeHtml(displayAddress)}</span></span>`;
          }
          if (pPhone) {
            infoRow.innerHTML += `<span style="display:inline-flex; align-items:center; gap:5px;">${ICONS.phone}<span>${escapeHtml(pPhone)}</span></span>`;
          }
          pCard.appendChild(infoRow);
        }

        const cleanDesc = sanitizeUserFacingText(p.description || '').trim();
        const isDuplicateAddress = cleanDesc && displayAddress && (
          cleanDesc.toLowerCase() === displayAddress.toLowerCase() ||
          cleanDesc.toLowerCase().includes(displayAddress.toLowerCase()) ||
          displayAddress.toLowerCase().includes(cleanDesc.toLowerCase())
        );
        const isBoilerplate = cleanDesc.toLowerCase().includes('verified') && (cleanDesc.toLowerCase().includes('location near') || cleanDesc.toLowerCase().includes('coordinates in'));

        if (cleanDesc && !isDuplicateAddress && !isBoilerplate) {
          const descRow = document.createElement('div');
          descRow.style.cssText = 'font-size:0.74rem; color:var(--g700); line-height:1.4; margin-top:2px;';
          descRow.textContent = cleanDesc;
          pCard.appendChild(descRow);
        }

        placesWrap.appendChild(pCard);
      });

      body.appendChild(placesWrap);
    } else if (markers.length > 0) {
      // Marker waypoints list
      const markersList = document.createElement('div');
      markersList.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:2px;';
      markers.forEach((m, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 14px; background:var(--g50); border-radius:10px; border:1px solid var(--g150); display:flex; justify-content:space-between; align-items:center; font-size:0.84rem;';
        const mName = sanitizeUserFacingText(m.name || 'Waypoint');
        const mDesc = sanitizeUserFacingText(m.description || '');
        row.innerHTML = `
          <div>
            <strong style="color:var(--black); font-size:0.86rem;">${i + 1}. ${escapeHtml(mName)}</strong>
            ${mDesc ? `<div style="font-size:0.75rem; color:var(--g600); margin-top:2px;">${escapeHtml(mDesc)}</div>` : ''}
          </div>
          <span style="font-family:var(--mono); font-size:0.74rem; color:var(--g600); background:var(--g100); padding:3px 8px; border-radius:9999px;">${Number(m.lat || 0).toFixed(4)}°, ${Number(m.lng || 0).toFixed(4)}°</span>
        `;
        markersList.appendChild(row);
      });
      body.appendChild(markersList);
    }

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * LOCATION COORDINATES RESULT — Visual GPS location pill card
 */
export class LocationCoordinatesResultRenderer extends ResultRenderer {
  static id = 'location-coordinates';
  static name = 'Location Coordinates';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'location-coordinates' ||
      result.type === 'location-coordinates' ||
      Boolean(data.latitude !== undefined && data.longitude !== undefined);
  }

  static render(result, container) {
    const data = result.data || {};
    const lat = Number(data.latitude || 0);
    const lng = Number(data.longitude || 0);
    const area = data.area || 'Current Location';
    const accuracy = Number(data.accuracy || 0);

    const card = document.createElement('div');
    card.className = 'assistant-result-location-card';
    card.style.cssText = 'margin-top:8px; padding:10px 16px; border:1px solid var(--g200); border-radius:9999px; background:var(--g50); display:inline-flex; align-items:center; gap:10px; color:var(--black); font-family:var(--sans); box-shadow:0 2px 8px rgba(0,0,0,.03);';

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'width:28px; height:28px; border-radius:50%; background:var(--primary, #2563eb); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;';
    iconWrap.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>`;

    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'display:flex; align-items:baseline; gap:6px; font-size:0.84rem;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = `GPS Location: ${area}`;
    titleEl.style.cssText = 'color:var(--black); font-weight:700;';
    const coordsEl = document.createElement('span');
    coordsEl.textContent = `(${lat.toFixed(4)}°, ${lng.toFixed(4)}°)${accuracy > 0 ? ` ±${Math.round(accuracy)}m` : ''}`;
    coordsEl.style.cssText = 'font-size:0.74rem; color:var(--g600); font-family:var(--mono);';
    textWrap.appendChild(titleEl);
    textWrap.appendChild(coordsEl);

    card.appendChild(iconWrap);
    card.appendChild(textWrap);
    container.appendChild(card);
    return card;
  }
}

/**
 * TUNER PITCH RESULT — Harmonic instrument string frequency reference
 */
export class TunerPitchResultRenderer extends ResultRenderer {
  static id = 'tuner-pitch';
  static name = 'Instrument Tuner Pitch';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'tuner-pitch' ||
      result.type === 'tuner-pitch' ||
      Boolean(data.strings && data.tuningName);
  }

  static render(result, container) {
    const data = result.data || {};
    const instrument = data.instrument || 'Guitar';
    const tuningName = data.tuningName || 'Standard E';
    const strings = Array.isArray(data.strings) ? data.strings : [];
    let audioCtx = null;

    const card = document.createElement('div');
    card.className = 'assistant-result-tuner-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = `${instrument} Tuner`;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const tuneBadge = document.createElement('span');
    tuneBadge.textContent = tuningName;
    tuneBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(tuneBadge);

    const openTunerBtn = document.createElement('button');
    openTunerBtn.type = 'button';
    openTunerBtn.className = 'btn btn-primary btn-sm';
    openTunerBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Launch Live Mic Tuner</span>`;
    openTunerBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openTunerBtn.addEventListener('click', () => {
      window.location.hash = '#tuner';
    });

    head.appendChild(headLeft);
    head.appendChild(openTunerBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:12px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.78rem; color:var(--g600); font-weight:700;';
    label.textContent = 'Click any string to hear reference pitch tone:';
    body.appendChild(label);

    const stringButtons = document.createElement('div');
    stringButtons.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px;';

    strings.forEach(st => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.style.cssText = 'display:flex; flex-direction:column; align-items:center; padding:8px 10px; border-radius:12px; cursor:pointer;';
      btn.innerHTML = `
        <strong style="font-size:1.05rem; font-family:var(--mono); color:var(--black);">${st.note}${st.octave || ''}</strong>
        <span style="font-size:0.72rem; color:var(--g600);">${st.freqHz.toFixed(1)} Hz</span>
      `;
      btn.addEventListener('click', () => {
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(st.freqHz, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.8);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 2.0);
        } catch {}
      });
      stringButtons.appendChild(btn);
    });
    body.appendChild(stringButtons);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * PDF ANNOTATION RESULT — Visual preview of document markup and redactions
 */
export class PdfAnnotationResultRenderer extends ResultRenderer {
  static id = 'pdf-annotation';
  static name = 'PDF Annotation';

  static canRender(result) {
    const data = result.data || {};
    return result.renderer === 'pdf-annotation' ||
      result.type === 'pdf-annotation' ||
      Boolean(data.annotations && data.title);
  }

  static render(result, container) {
    const data = result.data || {};
    const title = data.title || 'Document Markup';
    const summary = data.summary || 'Proposed document annotations and redactions.';
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];

    const card = document.createElement('div');
    card.className = 'assistant-result-pdfannot-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--g200); border-radius:16px; background:var(--white); box-shadow:0 2px 10px rgba(0,0,0,.04); overflow:hidden; color:var(--black);';

    const head = document.createElement('div');
    head.style.cssText = 'padding:14px 18px; background:var(--g50); border-bottom:1px solid var(--g200); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.95rem; color:var(--black);';
    const countBadge = document.createElement('span');
    countBadge.textContent = `${annotations.length} Directives`;
    countBadge.style.cssText = 'font-size:0.72rem; padding:3px 10px; border-radius:9999px; background:var(--g100); color:var(--black); font-weight:700; border:1px solid var(--g200);';
    headLeft.appendChild(titleEl);
    headLeft.appendChild(countBadge);

    const openPdeBtn = document.createElement('button');
    openPdeBtn.type = 'button';
    openPdeBtn.className = 'btn btn-secondary btn-sm';
    openPdeBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${ICONS.external} Open in PDF Editor</span>`;
    openPdeBtn.style.cssText = 'font-size:0.75rem; padding:4px 12px; border-radius:9999px; cursor:pointer; font-weight:700;';
    openPdeBtn.addEventListener('click', () => {
      window.location.hash = '#pdf-editor';
    });

    head.appendChild(headLeft);
    head.appendChild(openPdeBtn);
    card.appendChild(head);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px; display:flex; flex-direction:column; gap:10px;';

    const sumEl = document.createElement('div');
    sumEl.style.cssText = 'font-size:0.84rem; color:var(--g700); line-height:1.5;';
    sumEl.textContent = summary;
    body.appendChild(sumEl);

    const annotList = document.createElement('div');
    annotList.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
    annotations.forEach(a => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:8px 12px; background:var(--g50); border-radius:8px; border:1px solid var(--g150); display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;';
      const isRedact = a.type === 'redact';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.7rem; padding:2px 8px; border-radius:9999px; background:${isRedact ? '#fee2e2' : 'var(--g200)'}; color:${isRedact ? '#b91c1c' : 'var(--black)'}; font-weight:700;">${a.type.toUpperCase()}</span>
          <strong style="color:var(--black);">${a.label}</strong>
        </div>
        <span style="font-size:0.74rem; color:var(--g600);">Page ${a.page || 1}</span>
      `;
      annotList.appendChild(row);
    });
    body.appendChild(annotList);

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

/**
 * CALENDAR CARD RESULT — Interactive visual card for scheduled events and agenda lists
 */
export class CalendarCardRenderer extends ResultRenderer {
  static id = 'calendar-card';
  static name = 'Calendar Event';

  static canRender(result) {
    return result.renderer === 'calendar-card' ||
      result.type === 'calendar-event' ||
      result.type === 'calendar-list';
  }

  static render(result, container) {
    const data = result?.data || result || {};
    const card = document.createElement('div');
    card.className = 'ast-calendar-card';
    card.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:16px; margin:8px 0; box-shadow:0 4px 16px rgba(0,0,0,0.04); font-family:var(--sans);';

    if (data.type === 'calendar-list' || data.action === 'list' || result.type === 'calendar-list' || result.action === 'list') {
      const events = data.events || result.events || [];
      const safeQuery = String(data.query || result.query || 'Upcoming');
      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:28px; height:28px; border-radius:8px; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <strong style="font-size:0.92rem; color:var(--text);">Scheduled Events (${events.length})</strong>
          </div>
          <a href="#calendar" class="btn btn-secondary btn-sm" style="height:28px; padding:0 12px; font-size:0.75rem; text-decoration:none;">Open Calendar →</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${events.length === 0 ? `
            <div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No events found for ${safeQuery}.</div>
          ` : events.map(e => `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-subtle); padding:8px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:0.75rem; font-family:var(--mono); color:var(--text-muted);">${e.date}</span>
                <span style="font-weight:600; font-size:0.86rem; color:var(--text);">${String(e.title || '')}</span>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${e.isAllDay ? '(All day)' : `${e.startTime} – ${e.endTime}`}</span>
              </div>
              <span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; padding:2px 7px; border-radius:999px; background:rgba(59,130,246,0.12); color:#3b82f6;">${e.category || 'event'}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const evt = data.event || result.event || {};
      const isCancelled = (data.action || result.action) === 'cancelled';
      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:32px; height:32px; border-radius:8px; background:${isCancelled ? '#ef4444' : 'var(--black)'}; color:var(--white); display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text);">${String(evt.title || data.message || result.message || 'Calendar Event')}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${isCancelled ? 'Event cancelled from schedule' : 'Event confirmed & scheduled'}</div>
            </div>
          </div>
          <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; padding:3px 9px; border-radius:999px; background:${isCancelled ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; color:${isCancelled ? '#ef4444' : '#10b981'};">
            ${isCancelled ? 'Cancelled' : 'Scheduled'}
          </span>
        </div>
        ${!isCancelled ? `
          <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:10px; padding:12px 14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; font-size:0.8rem;">
            <div><span style="color:var(--text-muted); display:block; font-size:0.7rem; text-transform:uppercase;">Date</span><strong style="color:var(--text);">${evt.date || 'Today'}</strong></div>
            <div><span style="color:var(--text-muted); display:block; font-size:0.7rem; text-transform:uppercase;">Time</span><strong style="color:var(--text);">${evt.isAllDay ? 'All-day' : `${evt.startTime} – ${evt.endTime}`}</strong></div>
            <div><span style="color:var(--text-muted); display:block; font-size:0.7rem; text-transform:uppercase;">Category</span><strong style="color:var(--text); text-transform:capitalize;">${evt.category || 'Personal'}</strong></div>
            ${evt.location ? `<div><span style="color:var(--text-muted); display:block; font-size:0.7rem; text-transform:uppercase;">Location</span><strong style="color:var(--text);">${String(evt.location)}</strong></div>` : ''}
          </div>
          ${evt.description ? `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:10px; padding:0 2px;">${String(evt.description)}</div>` : ''}
        ` : ''}
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          <a href="#calendar" class="btn btn-secondary btn-sm" style="font-size:0.76rem; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>View in Calendar</span>
          </a>
        </div>
      `;
    }

    container.appendChild(card);
    return card;
  }
}

/**
 * BROWSER CARD RESULT — Interactive browser preview card with address bar and sandbox launcher
 */
export class BrowserCardRenderer extends ResultRenderer {
  static id = 'browser-card';
  static name = 'Web Browser';

  static canRender(result) {
    const data = result?.data || result || {};
    return result?.renderer === 'browser-card' ||
      data?.renderer === 'browser-card' ||
      result?.type === 'browser-preview' ||
      data?.type === 'browser-preview' ||
      result?.type === 'browser-error' ||
      data?.type === 'browser-error';
  }

  static render(result, container) {
    const card = document.createElement('div');
    card.className = 'ast-browser-card';
    card.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; margin:10px 0; box-shadow:0 4px 18px rgba(0,0,0,0.05); font-family:var(--sans);';

    const data = result?.data || result || {};
    const rawUrl = data.url || data.finalUrl || data.source || result.url || '';
    const url = String(rawUrl || '').trim();
    let displayHostname = '';
    try {
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        displayHostname = new URL(url).hostname;
      }
    } catch {}

    const title = String(data.title || result.title || data.query || displayHostname || 'Web Research');
    const excerpt = String(data.excerpt || data.aboutExcerpt || data.description || data.snippet || (data.text ? data.text.slice(0, 320) : '') || result.excerpt || '');
    const browserToolLink = url ? `#browser?url=${encodeURIComponent(url)}` : '#browser';

    card.innerHTML = `
      <!-- Window Chrome -->
      <div style="background:var(--bg-subtle); border-bottom:1px solid var(--border); padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="width:9px; height:9px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
          <span style="width:9px; height:9px; border-radius:50%; background:#f59e0b; display:inline-block;"></span>
          <span style="width:9px; height:9px; border-radius:50%; background:#10b981; display:inline-block;"></span>
          <span style="font-size:0.75rem; font-weight:700; color:var(--text); margin-left:6px;">Browser</span>
        </div>
        <!-- Address pill -->
        <div style="flex:1; max-width:460px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:3px 10px; font-family:var(--mono); font-size:0.75rem; color:var(--text); display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#10b981" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span style="overflow:hidden; text-overflow:ellipsis;">${url || 'Web Search'}</span>
        </div>
        <span style="font-size:0.7rem; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Isolated</span>
      </div>

      <!-- Content Preview -->
      <div style="padding:16px 18px;">
        <h3 style="margin:0 0 8px; font-size:1.05rem; font-weight:700; color:var(--text);">${title}</h3>
        ${excerpt ? `<p style="margin:0 0 14px; font-size:0.86rem; line-height:1.6; color:var(--text-secondary);">${excerpt}</p>` : ''}
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid var(--border-subtle); padding-top:12px;">
          <div style="display:flex; gap:8px;">
            <a href="${browserToolLink}" class="btn btn-primary btn-sm" style="font-size:0.76rem; text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:600;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Open in Browser</span>
            </a>
            ${url ? `
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size:0.76rem; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                <span>Visit Site</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ` : ''}
          </div>
          ${url ? `<button type="button" class="btn btn-secondary btn-sm brw-card-copy-btn" data-url="${url}" style="font-size:0.75rem; padding:4px 8px;">Copy URL</button>` : ''}
        </div>
      </div>
    `;

    const copyBtn = card.querySelector('.brw-card-copy-btn');
    if (copyBtn && url) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => {
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
        });
      });
    }

    container.appendChild(card);
    return card;
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
    el.style.cssText = 'margin-top:6px; font-size:0.88rem; line-height:1.5; color:var(--black);';
    el.textContent = text;
    container.appendChild(el);
    return el;
  }
}

/**
 * Deterministic SVG Line Plot renderer for Collatz trajectories and numerical functions
 */
function renderSvgLineChart(chartData, title = '') {
  if (!chartData) return '';
  const dataset = chartData.datasets?.[0] || {};
  const data = dataset.data || chartData.data || [];
  const labels = chartData.labels || [];
  const n = data.length;
  if (n < 2) return '';

  const width = 560;
  const height = 180;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const validVals = data.filter(v => typeof v === 'number' && !isNaN(v));
  if (validVals.length < 2) return '';
  let maxVal = Math.max(...validVals);
  let minVal = Math.min(...validVals);
  if (maxVal === minVal) {
    maxVal += 1;
    minVal -= 1;
  }

  const getX = (idx) => padLeft + (idx / (n - 1)) * plotW;
  const getY = (val) => padTop + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

  const points = data.map((val, idx) => `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`).join(' ');

  let peakIdx = 0;
  let peakVal = data[0];
  data.forEach((v, i) => {
    if (v > peakVal) {
      peakVal = v;
      peakIdx = i;
    }
  });

  const peakX = getX(peakIdx).toFixed(1);
  const peakY = getY(peakVal).toFixed(1);
  const areaPoints = `${points} ${getX(n - 1).toFixed(1)},${padTop + plotH} ${getX(0).toFixed(1)},${padTop + plotH}`;

  const chartId = `svg-chart-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:10px; padding:12px; margin-top:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">
        <span>${escapeHtml(title || dataset.label || 'Trajectory Plot')}</span>
        <span>Peak: ${peakVal} (Step ${peakIdx}) · Points: ${n}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block; overflow:visible;">
        <defs>
          <linearGradient id="${chartId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" stroke="var(--border)" stroke-dasharray="3,3" stroke-width="1"/>
        <line x1="${padLeft}" y1="${padTop + plotH / 2}" x2="${width - padRight}" y2="${padTop + plotH / 2}" stroke="var(--border)" stroke-dasharray="3,3" stroke-width="1"/>
        <line x1="${padLeft}" y1="${padTop + plotH}" x2="${width - padRight}" y2="${padTop + plotH}" stroke="var(--border)" stroke-width="1.2"/>
        <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="var(--border)" stroke-width="1.2"/>

        <text x="${padLeft - 6}" y="${padTop + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end" font-family="monospace">${typeof maxVal === 'number' && maxVal % 1 !== 0 ? maxVal.toFixed(2) : maxVal}</text>
        <text x="${padLeft - 6}" y="${padTop + plotH / 2 + 3}" font-size="10" fill="var(--text-muted)" text-anchor="end" font-family="monospace">${typeof minVal === 'number' && ((maxVal + minVal) / 2) % 1 !== 0 ? ((maxVal + minVal) / 2).toFixed(2) : Math.round((maxVal + minVal) / 2)}</text>
        <text x="${padLeft - 6}" y="${padTop + plotH}" font-size="10" fill="var(--text-muted)" text-anchor="end" font-family="monospace">${typeof minVal === 'number' && minVal % 1 !== 0 ? minVal.toFixed(2) : minVal}</text>

        <polygon points="${areaPoints}" fill="url(#${chartId})"/>
        <polyline fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>

        <circle cx="${peakX}" cy="${peakY}" r="4" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
        <text x="${peakX}" y="${Math.max(14, peakY - 8)}" font-size="10" font-weight="700" fill="#ef4444" text-anchor="middle" font-family="monospace">Peak: ${peakVal}</text>

        <text x="${padLeft}" y="${padTop + plotH + 18}" font-size="10" fill="var(--text-muted)" text-anchor="middle" font-family="monospace">${labels[0] || '0'}</text>
        <text x="${width - padRight}" y="${padTop + plotH + 18}" font-size="10" fill="var(--text-muted)" text-anchor="middle" font-family="monospace">${labels[n - 1] || (n - 1)}</text>
      </svg>
    </div>
  `;
}

/**
 * MATHEMATICAL RESULT RENDERER — Deterministic computation, verification, and working steps
 */
export class MathResultRenderer extends ResultRenderer {
  static id = 'math-result';
  static name = 'Mathematical Utility Result';

  static canRender(result) {
    const data = result.data || result;
    return result.type === 'math-result' ||
      result.renderer === 'math-result' ||
      data.type === 'math-result' ||
      Boolean(data.chart) ||
      (data.operation && (
        data.sequence !== undefined ||
        data.roots !== undefined ||
        data.root !== undefined ||
        data.discriminant !== undefined ||
        data.determinant !== undefined ||
        data.eigenvalues !== undefined ||
        data.odeSolution !== undefined ||
        data.polar !== undefined ||
        data.solutionVector !== undefined ||
        data.regressionLine !== undefined ||
        data.inverseModulo !== undefined ||
        data.crtSolution !== undefined ||
        data.tableValue !== undefined ||
        data.bezoutCoefficients !== undefined ||
        data.factors !== undefined ||
        data.phi !== undefined ||
        data.operation === 'collatz' ||
        data.operation === 'graph' ||
        data.operation === 'plot'
      ));
  }

  static render(result, container) {
    const data = result.data || result;
    const card = document.createElement('section');
    card.className = 'assistant-result-math-card';
    card.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); color:var(--black); font-family:var(--sans, sans-serif);';

    // Top Header: Operation type and status badge
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;';

    const opTitle = document.createElement('div');
    opTitle.style.cssText = 'display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.95rem; color:var(--black);';

    const sigmaIcon = document.createElement('span');
    sigmaIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #2563eb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4H6l6 8-6 8h12"/></svg>';
    sigmaIcon.style.display = 'inline-flex';

    const titleText = document.createElement('span');
    titleText.textContent = getOperationTitle(data.operation);
    opTitle.append(sigmaIcon, titleText);

    // Badges container (Proof Status / Verification)
    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;';

    if (data.conjectureStatus) {
      const conjBadge = document.createElement('span');
      conjBadge.className = 'math-proof-badge math-badge-conjecture';
      conjBadge.textContent = data.conjectureStatus;
      badges.appendChild(conjBadge);
    }

    if (data.verified !== undefined) {
      const verBadge = document.createElement('span');
      verBadge.className = `math-proof-badge ${data.verified ? 'math-badge-proven' : 'math-badge-conjecture'}`;
      verBadge.textContent = data.verified ? 'VERIFIED' : 'UNVERIFIED';
      badges.appendChild(verBadge);
    }

    header.append(opTitle, badges);
    card.appendChild(header);

    // Body content according to operation
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

    // 1. COLLATZ
    if (data.operation === 'collatz' && Array.isArray(data.sequence)) {
      const metricGrid = document.createElement('div');
      metricGrid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px;';

      for (const [label, val] of [
        ['Input', data.input],
        ['Steps to 1', data.steps],
        ['Peak Excursion', data.maximum_value],
        ['Terminates', data.reached_one ? 'Yes (reached 1)' : 'No']
      ]) {
        const m = document.createElement('div');
        m.style.cssText = 'padding:8px 10px; border:1px solid var(--g200); border-radius:8px; background:var(--g50); text-align:center;';
        m.innerHTML = `<div style="font-size:0.65rem; text-transform:uppercase; color:var(--g600); font-weight:700;">${escapeHtml(label)}</div><div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.05rem; margin-top:2px; color:var(--black);">${escapeHtml(val)}</div>`;
        metricGrid.appendChild(m);
      }
      body.appendChild(metricGrid);

      // Sequence pills track
      const seqLabel = document.createElement('div');
      seqLabel.style.cssText = 'font-size:0.75rem; font-weight:700; color:var(--g600); margin-top:4px;';
      seqLabel.textContent = `Generated Sequence (${data.sequence.length} elements):`;
      body.appendChild(seqLabel);

      const seqTrack = document.createElement('div');
      seqTrack.style.cssText = 'display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; font-family:var(--mono, monospace); font-size:0.85rem; align-items:center; scrollbar-width:thin;';

      data.sequence.forEach((num, idx) => {
        const item = document.createElement('span');
        item.style.cssText = 'padding:3px 8px; border-radius:6px; background:var(--g100); border:1px solid var(--g200); flex-shrink:0;';
        if (num === data.maximum_value) {
          item.style.background = 'var(--primary, #2563eb)';
          item.style.color = '#ffffff';
          item.title = 'Peak maximum excursion';
        }
        item.textContent = num;
        seqTrack.appendChild(item);

        if (idx < data.sequence.length - 1) {
          const arrow = document.createElement('span');
          arrow.textContent = '→';
          arrow.style.color = 'var(--g600)';
          seqTrack.appendChild(arrow);
        }
      });
      body.appendChild(seqTrack);

      // Render SVG trajectory graph if chart data or sequence is present
      const chartHtml = renderSvgLineChart(data.chart || {
        labels: data.sequence.map((_, i) => String(i)),
        datasets: [{ label: `Collatz Trajectory (n = ${data.input})`, data: data.sequence }]
      }, `Collatz Trajectory (n = ${data.input})`);

      if (chartHtml) {
        const chartWrapper = document.createElement('div');
        chartWrapper.innerHTML = chartHtml;
        body.appendChild(chartWrapper);
      }

      // Proof Status Disclaimer
      const notice = document.createElement('div');
      notice.style.cssText = 'padding:10px 12px; border-radius:8px; background:var(--g50); border:1px solid var(--g200); font-size:0.75rem; color:var(--g700); line-height:1.4;';
      notice.innerHTML = '<strong>Mathematical Notice:</strong> The Collatz (3n + 1) Conjecture is an <strong>UNPROVEN</strong> open problem in number theory. Empirical termination at 1 for specific inputs does not constitute a mathematical proof for all natural numbers.';
      body.appendChild(notice);

    // 2. EQUATIONS (QUADRATIC & LINEAR)
    } else if (data.operation === 'solve_quadratic' || data.operation === 'solve_linear') {
      const rootCard = document.createElement('div');
      rootCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';

      const rootsText = Array.isArray(data.roots)
        ? data.roots.map((r, i) => `${data.variable || 'x'}<sub>${i + 1}</sub> = <strong>${escapeHtml(r)}</strong>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;')
        : `${data.variable || 'x'} = <strong>${escapeHtml(data.root)}</strong>`;

      rootCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Solution Roots</div>
        <div style="font-family:var(--mono, monospace); font-size:1.15rem; margin-top:4px; color:var(--black);">${rootsText}</div>
        ${data.nature ? `<div style="font-size:0.75rem; color:var(--g600); margin-top:4px;">Nature of roots: ${escapeHtml(data.nature)} (Discriminant D = ${escapeHtml(data.discriminant)})</div>` : ''}
      `;
      body.appendChild(rootCard);

    // 3. NEWTON-RAPHSON ROOT FINDING
    } else if (data.operation === 'newton_raphson') {
      const nrCard = document.createElement('div');
      nrCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';
      nrCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Numerical Root Solution</div>
        <div style="font-family:var(--mono, monospace); font-size:1.2rem; font-weight:700; margin-top:4px; color:var(--black);">
          Root x* = <strong>${escapeHtml(data.root)}</strong>
        </div>
        <div style="font-size:0.75rem; color:var(--g600); margin-top:4px;">
          Residual |f(x*)| = ${escapeHtml(data.residual)} | Iterations: ${escapeHtml(data.iterationCount)} | Initial x₀ = ${escapeHtml(data.x0)}
        </div>
      `;
      body.appendChild(nrCard);

      if (Array.isArray(data.iterations) && data.iterations.length > 0) {
        const iterDetails = document.createElement('details');
        iterDetails.style.cssText = 'margin-top:4px; font-size:0.8rem; border:1px solid var(--g200); border-radius:8px; padding:6px 10px; background:var(--white);';
        iterDetails.innerHTML = `
          <summary style="cursor:pointer; font-weight:600; color:var(--g700); outline:none;">Iteration Progression (${data.iterations.length} steps)</summary>
          <div style="overflow-x:auto; margin-top:8px;">
            <table style="width:100%; border-collapse:collapse; font-family:var(--mono, monospace); font-size:0.75rem; text-align:right;">
              <thead>
                <tr style="border-bottom:1px solid var(--g200); color:var(--g600);">
                  <th style="padding:4px 6px; text-align:left;">n</th>
                  <th style="padding:4px 6px;">xₙ</th>
                  <th style="padding:4px 6px;">f(xₙ)</th>
                  <th style="padding:4px 6px;">f'(xₙ)</th>
                  <th style="padding:4px 6px;">|Δx|</th>
                </tr>
              </thead>
              <tbody>
                ${data.iterations.map(it => `
                  <tr style="border-bottom:1px solid var(--g100);">
                    <td style="padding:4px 6px; text-align:left;">${it.step}</td>
                    <td style="padding:4px 6px;">${it.x}</td>
                    <td style="padding:4px 6px;">${it.fx}</td>
                    <td style="padding:4px 6px;">${it.fPrime}</td>
                    <td style="padding:4px 6px;">${it.error}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        body.appendChild(iterDetails);
      }

    // 4. ODE SOLVERS (RK4 / EULER)
    } else if (data.operation === 'ode_rk4' || data.operation === 'ode_euler') {
      const odeCard = document.createElement('div');
      odeCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';
      odeCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">ODE Initial Value Solution (${escapeHtml(data.method || 'RK4')})</div>
        <div style="font-family:var(--mono, monospace); font-size:1.2rem; font-weight:700; margin-top:4px; color:var(--black);">
          y(${escapeHtml(data.xEnd)}) = <strong>${escapeHtml(data.yEnd)}</strong>
        </div>
        <div style="font-size:0.75rem; color:var(--g600); margin-top:4px;">
          Initial Condition: y(${escapeHtml(data.x0)}) = ${escapeHtml(data.y0)} | Step Size h = ${escapeHtml(data.stepSize)} (${escapeHtml(data.stepsCount)} steps)
        </div>
      `;
      body.appendChild(odeCard);

    // 5. COMPLEX NUMBERS
    } else if (data.operation === 'complex' && data.rectangular) {
      const compCard = document.createElement('div');
      compCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';
      compCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Complex Number Representation</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-top:6px;">
          <div style="padding:6px 8px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Cartesian Form</div>
            <div style="font-family:var(--mono, monospace); font-size:1.05rem; font-weight:700; margin-top:2px;">${escapeHtml(data.rectangular)}</div>
          </div>
          <div style="padding:6px 8px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Polar Form</div>
            <div style="font-family:var(--mono, monospace); font-size:1.05rem; font-weight:700; margin-top:2px; color:var(--primary, #2563eb);">${escapeHtml(data.polar?.notation || '')}</div>
          </div>
          <div style="padding:6px 8px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Modulus |z|</div>
            <div style="font-family:var(--mono, monospace); font-size:1.05rem; font-weight:700; margin-top:2px;">${escapeHtml(data.modulus)}</div>
          </div>
          <div style="padding:6px 8px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Argument θ</div>
            <div style="font-family:var(--mono, monospace); font-size:1.05rem; font-weight:700; margin-top:2px;">${escapeHtml(data.polar?.degrees)}°</div>
          </div>
        </div>
      `;
      body.appendChild(compCard);

    // 6. MATRICES (DETERMINANT, INVERSE, EIGENVALUES, LINEAR SYSTEM)
    } else if (data.operation === 'matrix_determinant' || data.operation === 'matrix_inverse' || data.operation === 'eigenvalues' || data.operation === 'solve_system') {
      const matCard = document.createElement('div');
      matCard.style.cssText = 'padding:12px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';

      if (data.operation === 'matrix_determinant') {
        matCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Matrix Determinant (${escapeHtml(data.dimensions)})</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">det(A) = ${escapeHtml(data.determinant)}</div>
        `;
      } else if (data.operation === 'matrix_inverse' && Array.isArray(data.inverse)) {
        let matrixRows = data.inverse.map(row => `[ ${row.join(', ')} ]`).join('\n');
        matCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Matrix Inverse A⁻¹ (${escapeHtml(data.dimensions)})</div>
          <pre style="margin:6px 0 0 0; padding:8px 10px; background:var(--white); border:1px solid var(--g200); border-radius:6px; font-family:var(--mono, monospace); font-size:0.85rem; overflow-x:auto;">${escapeHtml(matrixRows)}</pre>
          <div style="font-size:0.72rem; color:var(--g600); margin-top:4px;">Invertible det(A) = ${escapeHtml(data.determinant)} | Maximum A·A⁻¹ residual = ${escapeHtml(data.residual)}</div>
        `;
      } else if (data.operation === 'eigenvalues') {
        const e1 = data.eigenvalues?.lambda1;
        const e2 = data.eigenvalues?.lambda2;
        matCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">2×2 Characteristic Polynomial & Eigenvalues</div>
          <div style="font-family:var(--mono, monospace); font-size:0.9rem; margin-top:4px; color:var(--black);">
            p(λ) = ${escapeHtml(data.characteristicPolynomial)} = 0
          </div>
          <div style="display:flex; gap:12px; margin-top:8px; font-family:var(--mono, monospace); font-size:1.1rem; font-weight:700;">
            <div>λ₁ = ${escapeHtml(e1?.formatted || e1?.val || '')}</div>
            <div>λ₂ = ${escapeHtml(e2?.formatted || e2?.val || '')}</div>
          </div>
          <div style="font-size:0.72rem; color:var(--g600); margin-top:4px;">Trace τ = ${escapeHtml(data.trace)} | Determinant Δ = ${escapeHtml(data.determinant)} | Residual = ${escapeHtml(data.residual)}</div>
        `;
      } else if (data.operation === 'solve_system') {
        const solText = Array.isArray(data.solution) ? data.solution.map((v, i) => `x<sub>${i + 1}</sub> = <strong>${escapeHtml(v)}</strong>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;') : '';
        matCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Linear System Solution (Ax = b)</div>
          <div style="font-family:var(--mono, monospace); font-size:1.15rem; margin-top:4px; color:var(--black);">${solText}</div>
          <div style="font-size:0.72rem; color:var(--g600); margin-top:4px;">Rank = ${escapeHtml(data.rank)} | Residual ||Ax - b|| = ${escapeHtml(data.residual)}</div>
        `;
      }
      body.appendChild(matCard);

    // 7. LINEAR REGRESSION
    } else if (data.operation === 'linear_regression') {
      const regCard = document.createElement('div');
      regCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';
      regCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Ordinary Least Squares Linear Regression</div>
        <div style="font-family:var(--mono, monospace); font-size:1.25rem; font-weight:700; margin-top:4px; color:var(--primary, #2563eb);">
          ${escapeHtml(data.equation)}
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:6px; margin-top:8px;">
          <div style="padding:6px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Slope (m)</div>
            <div style="font-family:var(--mono, monospace); font-weight:700;">${escapeHtml(data.slope)}</div>
          </div>
          <div style="padding:6px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Intercept (c)</div>
            <div style="font-family:var(--mono, monospace); font-weight:700;">${escapeHtml(data.intercept)}</div>
          </div>
          <div style="padding:6px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">Pearson (r)</div>
            <div style="font-family:var(--mono, monospace); font-weight:700;">${escapeHtml(data.correlationR)}</div>
          </div>
          <div style="padding:6px; background:var(--white); border:1px solid var(--g200); border-radius:6px; text-align:center;">
            <div style="font-size:0.65rem; color:var(--g600); font-weight:700;">R-Squared (R²)</div>
            <div style="font-family:var(--mono, monospace); font-weight:700;">${escapeHtml(data.rSquared)}</div>
          </div>
        </div>
      `;
      body.appendChild(regCard);

    // 8. FOUR-FIGURE TABLE LOOKUP
    } else if (data.tableValue !== undefined && data.machineValue !== undefined) {
      const tableCard = document.createElement('div');
      tableCard.style.cssText = 'border:1px solid var(--g200); border-radius:10px; overflow:hidden;';

      const tableGrid = document.createElement('div');
      tableGrid.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); background:var(--g50); text-align:center; padding:10px; gap:8px;';

      tableGrid.innerHTML = `
        <div>
          <div style="font-size:0.65rem; font-weight:700; color:var(--g600); text-transform:uppercase;">4-Figure Table Value</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--black); margin-top:2px;">${escapeHtml(data.tableValue)}</div>
          <div style="font-size:0.68rem; color:var(--g600);">Table Approximation</div>
        </div>
        <div>
          <div style="font-size:0.65rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Direct Machine Value</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--black); margin-top:2px;">${escapeHtml(Number(data.machineValue).toFixed(6))}</div>
          <div style="font-size:0.68rem; color:var(--g600);">Full Floating Precision</div>
        </div>
        <div>
          <div style="font-size:0.65rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Approximation Error</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.1rem; color:var(--black); margin-top:2px;">${escapeHtml(data.difference)}</div>
          <div style="font-size:0.68rem; color:var(--g600);">|Table - Machine|</div>
        </div>
      `;
      tableCard.appendChild(tableGrid);
      body.appendChild(tableCard);

    // 9. NUMBER THEORY & MODULAR ARITHMETIC
    } else if (data.operation === 'gcd' || data.operation === 'lcm' || data.operation === 'totient' || data.operation === 'prime_factors' || data.operation === 'modular_arithmetic') {
      const ntCard = document.createElement('div');
      ntCard.style.cssText = 'padding:12px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';

      if (data.operation === 'gcd') {
        ntCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Greatest Common Divisor</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">GCD(${data.a}, ${data.b}) = ${data.gcd}</div>
          <div style="font-size:0.75rem; color:var(--g600); margin-top:4px;">Bézout Identity: (${data.a})(${data.bezoutCoefficients?.x}) + (${data.b})(${data.bezoutCoefficients?.y}) = ${data.gcd}</div>
        `;
      } else if (data.operation === 'lcm') {
        ntCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Least Common Multiple</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">LCM(${data.a}, ${data.b}) = ${data.lcm}</div>
        `;
      } else if (data.operation === 'totient') {
        ntCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Euler's Totient Function</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">φ(${data.n}) = ${data.phi}</div>
        `;
      } else if (data.operation === 'prime_factors') {
        ntCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Prime Factorization</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">${data.input} = ${escapeHtml(data.formatted)}</div>
        `;
      } else if (data.operation === 'modular_arithmetic') {
        const val = data.inverse !== undefined ? `Inverse = ${data.inverse}` : (data.crtSolution !== undefined ? `x ≡ ${data.crtSolution} (mod ${data.modulusProduct})` : data.result);
        ntCard.innerHTML = `
          <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">Modular Arithmetic (${escapeHtml(data.subOp || 'Computation')})</div>
          <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.2rem; margin-top:4px; color:var(--black);">${escapeHtml(val)}</div>
        `;
      }
      body.appendChild(ntCard);

    // 10. CONSTANTS
    } else if (data.operation === 'constant') {
      const cCard = document.createElement('div');
      cCard.style.cssText = 'padding:12px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';
      cCard.innerHTML = `
        <div style="font-size:0.75rem; font-weight:700; color:var(--g600); text-transform:uppercase;">${escapeHtml(data.domain || 'Mathematical Constant')}</div>
        <div style="display:flex; align-items:baseline; gap:10px; margin-top:4px;">
          <span style="font-family:var(--mono, monospace); font-size:1.3rem; font-weight:700; color:var(--black);">${escapeHtml(data.symbol)}</span>
          <span style="font-family:var(--mono, monospace); font-size:1rem; color:var(--primary, #2563eb); font-weight:600;">${escapeHtml(data.displayValue)}</span>
        </div>
        <div style="font-size:0.78rem; color:var(--g700); margin-top:6px;">${escapeHtml(data.description)}</div>
      `;
      body.appendChild(cCard);

    // 11. GENERAL ARITHMETIC / EVALUATE / CALCULUS
    } else {
      const resCard = document.createElement('div');
      resCard.style.cssText = 'padding:12px 14px; border-radius:10px; background:var(--g50); border:1px solid var(--g200);';

      const mainVal = data.result !== undefined ? data.result : (data.value !== undefined ? data.value : data.message);
      resCard.innerHTML = `
        ${data.expression ? `<div style="font-size:0.75rem; color:var(--g600); font-family:var(--mono, monospace);">${escapeHtml(data.expression)} =</div>` : ''}
        <div style="font-family:var(--mono, monospace); font-weight:700; font-size:1.3rem; margin-top:2px; color:var(--black);">${escapeHtml(mainVal)}</div>
        ${data.symbolic && data.result !== data.symbolic ? `<div style="font-size:0.75rem; color:var(--g600); margin-top:4px;">Symbolic: ${escapeHtml(data.symbolic)}</div>` : ''}
      `;
      if (data.chart) {
        const chartHtml = renderSvgLineChart(data.chart, data.title || data.expression);
        if (chartHtml) {
          const chartDiv = document.createElement('div');
          chartDiv.innerHTML = chartHtml;
          resCard.appendChild(chartDiv);
        }
      }
      body.appendChild(resCard);
    }

    // Working Steps Accordion (if present)
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      const details = document.createElement('details');
      details.style.cssText = 'margin-top:4px; font-size:0.8rem; border:1px solid var(--g200); border-radius:8px; padding:6px 10px; background:var(--white);';

      const summary = document.createElement('summary');
      summary.style.cssText = 'cursor:pointer; font-weight:600; color:var(--g700); outline:none; user-select:none;';
      summary.textContent = `Mathematical Working & Steps (${data.steps.length})`;
      details.appendChild(summary);

      const stepList = document.createElement('ol');
      stepList.style.cssText = 'margin:8px 0 0 16px; padding:0; display:flex; flex-direction:column; gap:4px; font-family:var(--mono, monospace); font-size:0.75rem; color:var(--g700);';

      data.steps.forEach(st => {
        const li = document.createElement('li');
        li.textContent = st;
        stepList.appendChild(li);
      });
      details.appendChild(stepList);
      body.appendChild(details);
    }

    card.appendChild(body);
    container.appendChild(card);
    return card;
  }
}

function getOperationTitle(op) {
  if (!op) return 'Mathematical Computation';
  switch (op.toLowerCase()) {
    case 'collatz': return 'Collatz Sequence Explorer';
    case 'solve_quadratic': return 'Quadratic Equation Solver';
    case 'solve_linear': return 'Linear Equation Solver';
    case 'derivative': return 'Calculus: Differentiation';
    case 'definite_integral': return 'Calculus: Definite Integral';
    case 'indefinite_integral': return 'Calculus: Indefinite Integral';
    case 'matrix_determinant': return 'Linear Algebra: Determinant';
    case 'matrix_inverse': return 'Linear Algebra: Matrix Inverse';
    case 'eigenvalues': return 'Linear Algebra: 2×2 Characteristic Polynomial & Eigenvalues';
    case 'solve_system': return 'Linear Systems: Gaussian Elimination (Ax = b)';
    case 'newton_raphson': return 'Numerical Analysis: Newton-Raphson Root Finding';
    case 'ode_rk4': return 'Differential Equations: Runge-Kutta 4th Order (RK4)';
    case 'ode_euler': return 'Differential Equations: Euler\'s Method';
    case 'complex': return 'Complex Analysis: Arithmetic & Polar Form';
    case 'modular_arithmetic': return 'Number Theory: Modular Arithmetic & Congruences';
    case 'linear_regression': return 'Statistics: Ordinary Least Squares Linear Regression';
    case 'gcd': return 'Number Theory: Greatest Common Divisor';
    case 'lcm': return 'Number Theory: Least Common Multiple';
    case 'totient': return 'Number Theory: Euler\'s Totient';
    case 'prime_factors': return 'Number Theory: Prime Factorization';
    case 'is_prime': return 'Number Theory: Primality Test';
    case 'fibonacci': return 'Sequence: Fibonacci Numbers';
    case 'permutations': return 'Combinatorics: Permutations';
    case 'combinations': return 'Combinatorics: Combinations';
    case 'four_figure_table': return 'Four-Figure Table Reference';
    case 'constant': return 'Mathematical Constant';
    case 'statistics': return 'Descriptive Statistics';
    default: return 'Deterministic Calculation';
  }
}

/**
 * MATHEMATICAL KNOWLEDGE RESULT RENDERER — Definitions, theorems, formulas, proof status
 */
export class MathKnowledgeResultRenderer extends ResultRenderer {
  static id = 'math-knowledge';
  static name = 'Mathematical Knowledge Reference';

  static canRender(result) {
    const data = result.data || result;
    return result.type === 'math-knowledge' ||
      result.renderer === 'math-knowledge' ||
      data.type === 'math-knowledge' ||
      (Array.isArray(data.entries) && data.query !== undefined);
  }

  static render(result, container) {
    const data = result.data || result;
    const entries = Array.isArray(data.entries) ? data.entries : (data.entry ? [data.entry] : []);

    const card = document.createElement('section');
    card.className = 'assistant-result-math-knowledge-card';
    card.style.cssText = 'margin-top:10px; padding:16px; border:1px solid var(--g200); border-radius:14px; background:var(--white); box-shadow:0 2px 8px rgba(0,0,0,.04); color:var(--black); font-family:var(--sans, sans-serif);';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;';

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.95rem; color:var(--black);';
    titleDiv.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #2563eb)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Mathematical Knowledge Reference';

    const countSpan = document.createElement('span');
    countSpan.style.cssText = 'font-size:0.75rem; color:var(--g600);';
    countSpan.textContent = `${entries.length} result(s)`;

    header.append(titleDiv, countSpan);
    card.appendChild(header);

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.85rem; color:var(--text-muted); padding:8px 0;';
      empty.textContent = `No exact mathematical entries found matching "${data.query || ''}".`;
      card.appendChild(empty);
      container.appendChild(card);
      return card;
    }

    const list = document.createElement('div');
    list.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

    entries.forEach(entry => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--bg-subtle);';

      let badgeClass = 'math-badge-axiom';
      if (entry.proofStatus?.includes('PROVEN') || entry.proofStatus?.includes('THEOREM') || entry.proofStatus?.includes('LEMMA') || entry.proofStatus?.includes('COROLLARY')) {
        badgeClass = 'math-badge-proven';
      } else if (entry.proofStatus?.includes('CONJECTURE') || entry.proofStatus?.includes('OPEN')) {
        badgeClass = 'math-badge-conjecture';
      } else if (entry.proofStatus?.includes('IDENTITY')) {
        badgeClass = 'math-badge-identity';
      }

      const renderedFormula = entry.formula ? renderMath(entry.formula, { displayMode: true }) : '';
      const renderedStatement = renderMathInText(entry.statement || entry.definition || '');

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--text);">${escapeHtml(entry.title)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(entry.categoryName || entry.category || '')}</div>
          </div>
          <span class="math-proof-badge ${badgeClass}">
            ${escapeHtml(entry.proofStatus || 'REFERENCE')}
          </span>
        </div>
        ${renderedFormula}
        <div style="margin-top:8px; font-size:0.82rem; line-height:1.5; color:var(--text-secondary);">${renderedStatement}</div>
        ${entry.computationalOp ? `<div style="margin-top:8px; font-size:0.72rem; color:var(--text-muted); padding-top:6px; border-top:1px solid var(--border-subtle);">Computable via Math Utility operation: <code>${escapeHtml(entry.computationalOp)}</code></div>` : ''}
      `;
      list.appendChild(item);
    });

    card.appendChild(list);
    container.appendChild(card);
    return card;
  }
}

/**
 * IMAGE GALLERY RESULT — Visual grid for scraped, discovered, or informational images
 */
export class ImageGalleryResultRenderer extends ResultRenderer {
  static id = 'image-gallery';
  static name = 'Image Gallery';

  static canRender(result) {
    const data = result.data || result;
    return result.renderer === 'image-gallery' ||
      result.type === 'image-gallery' ||
      (Array.isArray(data.images) && data.images.length > 0 && typeof data.images[0] === 'object');
  }

  static render(result, container) {
    const data = result.data || result;
    const images = Array.isArray(data.images) ? data.images : [];
    const title = data.title || result.title || `Images (${images.length})`;
    const sourceUrl = data.url || data.sourceUrl || '';

    const card = document.createElement('div');
    card.className = 'assistant-result-gallery-card';
    card.style.cssText = 'margin-top:10px; border:1px solid var(--border); border-radius:14px; background:var(--bg-card); box-shadow:0 4px 16px rgba(0,0,0,0.04); overflow:hidden; font-family:var(--sans);';

    // Header
    const head = document.createElement('div');
    head.style.cssText = 'padding:12px 16px; background:var(--bg-subtle); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const countBadge = document.createElement('span');
    countBadge.textContent = `${images.length} Image${images.length === 1 ? '' : 's'}`;
    countBadge.style.cssText = 'font-size:0.72rem; padding:2px 8px; border-radius:999px; background:var(--bg-card); color:var(--text); font-weight:700; border:1px solid var(--border);';

    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:0.92rem; color:var(--text);';

    titleWrap.append(titleEl, countBadge);
    head.appendChild(titleWrap);

    const actionsWrap = document.createElement('div');
    actionsWrap.style.cssText = 'display:flex; align-items:center; gap:8px;';

    const saveFilesBtn = document.createElement('button');
    saveFilesBtn.type = 'button';
    saveFilesBtn.textContent = 'Save All to Files';
    saveFilesBtn.style.cssText = 'font-size:0.75rem; padding:4px 10px; border-radius:6px; background:var(--primary); color:#fff; border:none; font-weight:600; cursor:pointer;';
    saveFilesBtn.onclick = async () => {
      saveFilesBtn.disabled = true;
      saveFilesBtn.textContent = 'Saving...';
      try {
        const { fs } = await import('./filesystem.js');
        const folder = '/Images/Scraped';
        await fs.mkdir(folder);
        let count = 0;
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img.url) continue;
          let ext = 'jpg';
          if (img.url.endsWith('.png')) ext = 'png';
          else if (img.url.endsWith('.webp')) ext = 'webp';
          const imgName = `scraped_${String(i + 1).padStart(2, '0')}.${ext}`;
          try {
            const res = await fetch(`/api/assistant/browser/fetch-binary?url=${encodeURIComponent(img.url)}`);
            if (res.ok) {
              const blob = await res.blob();
              await fs.writeFile(`${folder}/${imgName}`, blob);
              count++;
              continue;
            }
          } catch {}
          await fs.writeFile(`${folder}/${imgName}.url`, img.url);
          count++;
        }
        saveFilesBtn.textContent = `Saved (${count}) to Files`;
        saveFilesBtn.style.background = '#22c55e';
      } catch (err) {
        saveFilesBtn.textContent = 'Save Failed';
        console.error(err);
      }
    };
    actionsWrap.appendChild(saveFilesBtn);

    if (sourceUrl) {
      const srcLink = document.createElement('a');
      srcLink.href = sourceUrl;
      srcLink.target = '_blank';
      srcLink.rel = 'noopener noreferrer';
      srcLink.style.cssText = 'font-size:0.75rem; color:var(--text-secondary); text-decoration:none; display:inline-flex; align-items:center; gap:4px;';
      srcLink.innerHTML = `<span>Source</span> ${ICONS.external}`;
      actionsWrap.appendChild(srcLink);
    }
    head.appendChild(actionsWrap);
    card.appendChild(head);

    // Gallery Grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; padding:14px;';

    images.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = 'ast-gallery-item';
      item.style.cssText = 'background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s ease, border-color 0.15s ease;';

      const imgBox = document.createElement('div');
      imgBox.style.cssText = 'height:105px; width:100%; overflow:hidden; background:rgba(0,0,0,0.03); display:flex; align-items:center; justify-content:center; position:relative;';

      const imageEl = document.createElement('img');
      imageEl.src = img.url;
      imageEl.alt = img.alt || `Image ${idx + 1}`;
      imageEl.loading = 'lazy';
      imageEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
      imageEl.onerror = () => {
        imgBox.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); text-align:center; padding:10px;">Image unavailable</div>';
      };
      imgBox.appendChild(imageEl);

      const footer = document.createElement('div');
      footer.style.cssText = 'padding:6px 8px; font-size:0.7rem; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border-top:1px solid var(--border-subtle);';

      const dim = (img.width && img.height) ? `${img.width}×${img.height}` : (img.type || 'img');
      const dimEl = document.createElement('span');
      dimEl.textContent = dim;
      dimEl.style.cssText = 'font-family:var(--mono); font-size:0.65rem; color:var(--text-muted);';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.style.cssText = 'border:none; background:none; cursor:pointer; color:var(--text); font-size:0.68rem; font-weight:600; padding:1px 4px;';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(img.url);
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });

      footer.append(dimEl, copyBtn);
      item.append(imgBox, footer);
      grid.appendChild(item);
    });

    card.appendChild(grid);
    container.appendChild(card);
    return card;
  }
}

/**
 * REGISTRY OF ALL RESULT RENDERERS
 */
export const RESULT_RENDERERS = [
  ErrorResultRenderer,
  MathResultRenderer,
  MathKnowledgeResultRenderer,
  InvoiceResultRenderer,
  UmlDiagramResultRenderer,
  AlgorithmResultRenderer,
  MetronomeResultRenderer,
  SoundEffectResultRenderer,
  ElementsResultRenderer,
  ContainerQuoteResultRenderer,
  FloorPlanResultRenderer,
  LogicCircuitResultRenderer,
  MapResultRenderer,
  LocationCoordinatesResultRenderer,
  TunerPitchResultRenderer,
  PdfAnnotationResultRenderer,
  Anatomy3DResultRenderer,
  IllustrationResultRenderer,
  DiseaseResultRenderer,
  FileDeletionConfirmationRenderer,
  FileListResultRenderer,
  FileSavedResultRenderer,
  FileDownloadCardRenderer,
  ImageResultRenderer,
  ImageGalleryResultRenderer,
  ChartResultRenderer,
  CircuitResultRenderer,
  FlowchartResultRenderer,
  CodeExecutionResultRenderer,
  TransformResultRenderer,
  JsonResultRenderer,
  TableResultRenderer,
  SpeedTestResultRenderer,
  AudioPlayerResultRenderer,
  CalendarCardRenderer,
  BrowserCardRenderer,
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
    if (result?.silent === true || result?.type === 'map-view-ref') {
      return null;
    }
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
