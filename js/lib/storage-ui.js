/* ============================================================
   TOOLBOX — Browser Storage Inspector & File Manager
   Allows users to inspect, export, and manage on-device browser
   storage, saved file artifacts, and offline caches.
   ============================================================ */

import * as artifacts from './artifacts.js';
import { kindLabel } from '../registry/kinds.js';

let modalEl = null;
let isOpen = false;

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function getStorageStats() {
  let usage = 0;
  let quota = 0;

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage || 0;
      quota = estimate.quota || 0;
    } catch {}
  }

  // Calculate localStorage footprint
  let localBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || '';
      localBytes += (key.length + val.length) * 2;
    }
  } catch {}

  const files = artifacts.list();
  const fileBytes = files.reduce((acc, f) => acc + (f.bytes || 0), 0);

  return {
    totalUsage: Math.max(usage, localBytes + fileBytes),
    quota: quota || (50 * 1024 * 1024), // fallback estimate ~50MB
    localBytes,
    fileBytes,
    files,
  };
}

function createModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement('div');
  modalEl.id = 'storage-modal';
  modalEl.className = 'settings-modal-backdrop';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'storage-modal-title');
  modalEl.style.display = 'none';

  modalEl.innerHTML = `
    <div class="settings-modal-window storage-modal-window">
      <div class="settings-modal-header">
        <div class="settings-title-wrap">
          <div class="settings-title-icon" style="background:var(--black); color:var(--white);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <h2 id="storage-modal-title" class="settings-modal-title">Browser Storage & Files</h2>
            <p class="settings-modal-subtitle">Inspect the files and state Toolbox stores locally on this device.</p>
          </div>
        </div>
        <button type="button" class="settings-modal-close" id="close-storage" aria-label="Close Storage Manager">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body" id="storage-modal-body">
        <div class="storage-loading" style="padding:40px; text-align:center; color:var(--g400);">Scanning browser storage…</div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector('#close-storage').addEventListener('click', closeStorageModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeStorageModal();
  });

  return modalEl;
}

async function renderStorageContent() {
  const body = modalEl.querySelector('#storage-modal-body');
  const stats = await getStorageStats();
  const pct = stats.quota ? Math.min(100, Math.max(1, (stats.totalUsage / stats.quota) * 100)) : 1;

  body.innerHTML = `
    <!-- Storage Gauge -->
    <div class="storage-overview-card">
      <div class="storage-overview-header">
        <div>
          <span class="storage-used-val">${formatBytes(stats.totalUsage)}</span>
          <span class="storage-total-val">used on this device</span>
        </div>
        <span class="storage-badge-pill">${stats.files.length} saved files</span>
      </div>
      <div class="storage-progress-track">
        <div class="storage-progress-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="storage-overview-footer">
        <span>Estimated browser quota: ${formatBytes(stats.quota)}</span>
        <span>${pct.toFixed(2)}% used</span>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="storage-stats-grid">
      <div class="storage-stat-box">
        <span class="storage-stat-label">Saved Files & Artifacts</span>
        <span class="storage-stat-val">${formatBytes(stats.fileBytes)}</span>
      </div>
      <div class="storage-stat-box">
        <span class="storage-stat-label">Preferences & Session Data</span>
        <span class="storage-stat-val">${formatBytes(stats.localBytes)}</span>
      </div>
      <div class="storage-stat-box">
        <span class="storage-stat-label">Storage Privacy</span>
        <span class="storage-stat-val" style="color:var(--black);">100% Local</span>
      </div>
    </div>

    <!-- Files Section -->
    <section class="storage-files-section">
      <div class="storage-files-header">
        <h3 class="settings-section-title">Saved Files on this Browser</h3>
        <span class="settings-section-hint">${stats.files.length} items</span>
      </div>

      ${stats.files.length === 0 ? `
        <div class="storage-empty-state">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>No saved files currently in this browser.</p>
          <span>Use the "Save" action inside tools to keep work across sessions.</span>
        </div>
      ` : `
        <div class="storage-file-list">
          ${stats.files.map(f => `
            <div class="storage-file-row" data-file-id="${escapeHtml(f.id)}">
              <div class="storage-file-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div class="storage-file-info">
                <span class="storage-file-name">${escapeHtml(f.name || 'Untitled')}</span>
                <span class="storage-file-meta">${escapeHtml(kindLabel(f.kind))} · ${formatBytes(f.bytes || 0)} · ${new Date(f.updatedAt || f.createdAt || Date.now()).toLocaleDateString()}</span>
              </div>
              <div class="storage-file-actions">
                <button type="button" class="btn btn-sm btn-file-download" data-id="${escapeHtml(f.id)}" title="Download real file">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export
                </button>
                <button type="button" class="btn btn-sm btn-file-delete" data-id="${escapeHtml(f.id)}" title="Delete from browser">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </section>

    <!-- Global Storage Actions -->
    <div class="storage-danger-zone">
      <div class="storage-danger-info">
        <span class="storage-danger-title">Maintenance & Backup</span>
        <span class="storage-danger-desc">Export a complete backup or clear cached browser data.</span>
      </div>
      <div class="storage-danger-buttons">
        <button type="button" class="btn btn-sm btn-secondary" id="storage-export-all">Export All Work</button>
        <button type="button" class="btn btn-sm btn-secondary" id="storage-clear-all" style="color:#b3261e; border-color:rgba(179,38,30,0.3);">Clear Storage</button>
      </div>
    </div>
  `;

  // Wire event handlers
  body.querySelectorAll('.btn-file-download').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const item = await artifacts.get(id);
      if (item) {
        artifacts.exportOne(item);
      }
    });
  });

  body.querySelectorAll('.btn-file-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this file from your browser?')) {
        await artifacts.remove(id);
        renderStorageContent();
      }
    });
  });

  const exportAllBtn = body.querySelector('#storage-export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', async () => {
      const all = artifacts.list();
      if (!all.length) {
        alert('No files to export.');
        return;
      }
      const data = JSON.stringify(all, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toolbox-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const clearAllBtn = body.querySelector('#storage-clear-all');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all saved files and preferences from this browser? This action cannot be undone.')) {
        for (const file of artifacts.list()) {
          await artifacts.remove(file.id);
        }
        localStorage.clear();
        alert('Storage cleared successfully.');
        location.reload();
      }
    });
  }
}

export function openStorageModal() {
  createModal();
  renderStorageContent();
  modalEl.style.display = 'flex';
  requestAnimationFrame(() => {
    modalEl.classList.add('is-open');
  });
  isOpen = true;
}

export function closeStorageModal() {
  if (!modalEl || !isOpen) return;
  modalEl.classList.remove('is-open');
  setTimeout(() => {
    modalEl.style.display = 'none';
    isOpen = false;
  }, 200);
}
