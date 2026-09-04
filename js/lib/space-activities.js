/* ============================================================
   Space Activities — Desk, Artifacts, Discussion, Tasks, Sessions.

   Swiss-inspired, high-polish, restrained collaboration components.
   ============================================================ */

import * as store from './artifacts.js';
import { kindLabel, kindExt } from '../registry/kinds.js';
import { toolsAccepting } from '../registry/index.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

/* ============================================================
   1. DESK OVERVIEW (Home view of the Space)
   ============================================================ */

export function mountDeskOverview(container, engine) {
  const render = () => {
    const activityList = engine.activity ? engine.activity.toArray() : [];
    const artifactsMap = engine.artifacts ? Array.from(engine.artifacts.values()) : [];
    const tasksMap = engine.tasks ? Array.from(engine.tasks.values()) : [];
    const onlineMembers = Array.from(engine.onlineMembers.values());
    const onlineCount = onlineMembers.length;

    const completedTasks = tasksMap.filter(t => t.status === 'done').length;
    const totalTasks = tasksMap.length;
    const taskPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    container.innerHTML = `
      <div class="sp-desk fade-in">
        <!-- Desk Metrics Strip -->
        <div class="sp-desk-summary">
          <div class="sp-desk-hero">
            <span class="sp-desk-eyebrow">Shared Desk</span>
            <h2 class="sp-desk-name">${escapeHtml(engine.spaceName)}</h2>
            <p class="sp-desk-desc">${escapeHtml(engine.spaceDescription || 'A collaborative workspace in Toolbox for sharing artifacts, tasks, and live sessions.')}</p>
          </div>

          <div class="sp-desk-stats">
            <div class="sp-stat-item">
              <div class="sp-stat-top">
                <span class="sp-stat-num">${onlineCount}</span>
                <span class="sp-dot-live"></span>
              </div>
              <span class="sp-stat-label">Active Peers</span>
            </div>
            <div class="sp-stat-item">
              <div class="sp-stat-top">
                <span class="sp-stat-num">${artifactsMap.length}</span>
              </div>
              <span class="sp-stat-label">Artifacts</span>
            </div>
            <div class="sp-stat-item">
              <div class="sp-stat-top">
                <span class="sp-stat-num">${totalTasks ? `${completedTasks}/${totalTasks}` : '0'}</span>
              </div>
              <span class="sp-stat-label">Tasks Done</span>
            </div>
          </div>
        </div>

        <div class="sp-desk-grid">
          <!-- Main Stream (Activity Feed) -->
          <div class="sp-desk-main">
            <div class="sp-section-head">
              <div>
                <h3 class="sp-section-title">Activity Feed</h3>
                <span class="sp-section-sub">Live chronological event stream</span>
              </div>
            </div>

            <div class="sp-activity-stream">
              ${activityList.length ? activityList.slice(0, 15).map(act => {
                let iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle></svg>';
                if (act.type === 'artifact_shared') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
                } else if (act.type === 'file_shared') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
                } else if (act.type === 'member_joined') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>';
                } else if (act.type === 'task_created' || act.type === 'task_status') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>';
                } else if (act.type === 'poll_created') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>';
                } else if (act.type === 'challenge_created' || act.type === 'challenge_submission') {
                  iconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>';
                }

                return `
                  <div class="sp-act-row">
                    <div class="sp-act-icon">${iconSvg}</div>
                    <div class="sp-act-content">
                      <span class="sp-act-actor">${escapeHtml(act.actorName)}</span>
                      <span class="sp-act-text">${escapeHtml(act.text)}</span>
                    </div>
                    <time class="sp-act-time">${formatDate(act.timestamp)}</time>
                  </div>
                `;
              }).join('') : `
                <div class="sp-empty-stream">
                  <div class="sp-empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                  <p>No activity yet. Share an artifact from any tool, create a task, or start a discussion.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Desk Side: Quick Actions & Latest Artifacts -->
          <div class="sp-desk-side">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Quick Actions</h3>
            </div>

            <div class="sp-quick-actions">
              <a href="#tools" class="sp-quick-link">
                <span class="sp-quick-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                </span>
                <div class="sp-quick-info">
                  <strong>Open a Tool</strong>
                  <p>Create work and click "Share to Space"</p>
                </div>
                <span class="sp-quick-arr">→</span>
              </a>
              <button class="sp-quick-link" data-go-tab="live">
                <span class="sp-quick-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </span>
                <div class="sp-quick-info">
                  <strong>Shared Notepad</strong>
                  <p>Real-time collaborative text editor</p>
                </div>
                <span class="sp-quick-arr">→</span>
              </button>
              <button class="sp-quick-link" data-go-tab="tasks">
                <span class="sp-quick-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </span>
                <div class="sp-quick-info">
                  <strong>Task Board</strong>
                  <p>Track team goals &amp; deliverables</p>
                </div>
                <span class="sp-quick-arr">→</span>
              </button>
            </div>

            <!-- Online Peers Strip -->
            <div class="sp-section-head" style="margin-top:24px;">
              <h3 class="sp-section-title">Online Members</h3>
              <span class="sp-section-sub">${onlineCount} connected</span>
            </div>
            <div class="sp-online-roster">
              ${onlineMembers.map(m => `
                <div class="sp-roster-pill" title="${escapeHtml(m.name)} (${m.role})">
                  <span class="sp-avatar-circle" style="background:${m.color || '#000'}">${getInitials(m.name)}</span>
                  <span class="sp-roster-name">${escapeHtml(m.name)}</span>
                  ${m.isSelf ? '<span class="sp-you-badge">you</span>' : ''}
                </div>
              `).join('')}
            </div>

            <!-- Latest Artifacts Peek -->
            <div class="sp-section-head" style="margin-top:24px;">
              <h3 class="sp-section-title">Latest Artifacts</h3>
              <button class="sp-link-btn" data-go-tab="artifacts">View all</button>
            </div>
            <div class="sp-mini-artifacts">
              ${artifactsMap.slice(0, 3).map(art => `
                <div class="sp-mini-art-card" data-open-art="${art.id}" data-go-tab="artifacts">
                  <div class="sp-mini-art-top">
                    <span class="sp-badge">${escapeHtml(kindLabel(art.kind))}</span>
                    <small>${formatSize(art.size)}</small>
                  </div>
                  <strong>${escapeHtml(art.name)}</strong>
                  <span class="sp-mini-art-by">By ${escapeHtml(art.createdBy)}</span>
                </div>
              `).join('')}
              ${!artifactsMap.length ? '<p class="sp-empty-hint">No artifacts shared yet.</p>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const onUpdate = () => render();
  engine.on('activity-update', onUpdate);
  engine.on('artifacts-update', onUpdate);
  engine.on('tasks-update', onUpdate);
  engine.on('peer-update', onUpdate);

  render();

  return () => {
    engine.off('activity-update', onUpdate);
    engine.off('artifacts-update', onUpdate);
    engine.off('tasks-update', onUpdate);
    engine.off('peer-update', onUpdate);
  };
}

/* ============================================================
   2. ARTIFACTS & SHARED FILES
   ============================================================ */

export function mountArtifactsView(container, engine) {
  let activeFilter = 'all';

  const render = () => {
    const rawArtifacts = engine.artifacts ? Array.from(engine.artifacts.values()) : [];
    const rawFiles = engine.files ? Array.from(engine.files.values()) : [];

    const artifacts = rawArtifacts.filter(a => activeFilter === 'all' || a.kind === activeFilter);

    container.innerHTML = `
      <div class="sp-artifacts-pane fade-in">
        <!-- Action Header -->
        <div class="sp-pane-header">
          <div class="sp-filter-bar">
            <button class="sp-filter-btn ${activeFilter === 'all' ? 'is-active' : ''}" data-filter="all">All (${rawArtifacts.length})</button>
            <button class="sp-filter-btn ${activeFilter === 'markdown' ? 'is-active' : ''}" data-filter="markdown">Markdown</button>
            <button class="sp-filter-btn ${activeFilter === 'json' ? 'is-active' : ''}" data-filter="json">JSON</button>
            <button class="sp-filter-btn ${activeFilter === 'code' ? 'is-active' : ''}" data-filter="code">Code</button>
            <button class="sp-filter-btn ${activeFilter === 'uml' ? 'is-active' : ''}" data-filter="uml">Diagrams</button>
            <button class="sp-filter-btn ${activeFilter === 'text' ? 'is-active' : ''}" data-filter="text">Text</button>
          </div>
          <div class="sp-header-acts">
            <button class="btn btn-secondary btn-sm" data-act="upload-file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Share a File
            </button>
          </div>
        </div>

        <input type="file" id="sp-file-upload-input" style="display:none">

        <!-- Artifacts Grid -->
        <div class="sp-artifacts-grid">
          ${artifacts.map(art => {
            const targets = toolsAccepting(art.kind);
            return `
              <div class="sp-art-card" data-id="${art.id}">
                <div class="sp-art-card-top">
                  <span class="sp-badge">${escapeHtml(kindLabel(art.kind))}</span>
                  <time class="sp-art-time">${formatDate(art.createdAt)}</time>
                </div>
                <h4 class="sp-art-title">${escapeHtml(art.name)}</h4>
                <div class="sp-art-preview">
                  <pre><code>${escapeHtml(art.text.slice(0, 260))}${art.text.length > 260 ? '…' : ''}</code></pre>
                </div>
                <div class="sp-art-meta">
                  <span class="sp-art-meta-item">${formatSize(art.size)}</span>
                  <span class="sp-art-meta-item">·</span>
                  <span class="sp-art-meta-item">by <strong>${escapeHtml(art.createdBy)}</strong></span>
                </div>
                <div class="sp-art-actions">
                  ${targets.length ? `
                    <button class="btn btn-primary btn-sm sp-art-open-btn" data-open-tool="${targets[0].id}" data-art-id="${art.id}">
                      Open in ${escapeHtml(targets[0].name)}
                    </button>
                  ` : ''}
                  <button class="btn btn-secondary btn-sm" data-act="download-art" data-art-id="${art.id}" title="Download file">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </button>
                  ${engine.canEdit ? `
                    <button class="sp-icon-del-btn" data-act="del-art" data-art-id="${art.id}" title="Delete artifact">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

          ${rawFiles.map(f => `
            <div class="sp-art-card sp-file-card" data-file-id="${f.id}">
              <div class="sp-art-card-top">
                <span class="sp-badge is-file">File</span>
                <time class="sp-art-time">${formatDate(f.createdAt)}</time>
              </div>
              <h4 class="sp-art-title">${escapeHtml(f.name)}</h4>
              <div class="sp-art-meta" style="margin-top:14px;">
                <span>${formatSize(f.size)} · Shared by <strong>${escapeHtml(f.createdBy)}</strong></span>
              </div>
              <div class="sp-art-actions" style="margin-top:16px;">
                <button class="btn btn-primary btn-sm" data-act="download-file" data-file-id="${f.id}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download File
                </button>
                ${engine.canEdit ? `
                  <button class="sp-icon-del-btn" data-act="del-file" data-file-id="${f.id}" title="Delete file">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${!artifacts.length && !rawFiles.length ? `
          <div class="sp-empty-pane">
            <div class="sp-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <p class="sp-empty-title">No artifacts in this space yet</p>
            <p class="sp-empty-desc">Use any Toolbox tool (Markdown, JSON, Code, Diagrams), click <strong>"Share to Space"</strong> on the artifact strip, and it will appear here for all members.</p>
            <a href="#tools" class="btn btn-primary btn-sm">Explore Tools →</a>
          </div>
        ` : ''}
      </div>
    `;
  };

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  container.appendChild(fileInput);

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      alert('File too large. Please select a file under 2 MB for peer sharing.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      engine.shareFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result,
      });
      fileInput.value = '';
    };
    reader.readAsDataURL(file);
  });

  const onClick = (e) => {
    const filterBtn = e.target.closest('.sp-filter-btn');
    if (filterBtn) {
      activeFilter = filterBtn.dataset.filter;
      render();
      return;
    }

    const uploadBtn = e.target.closest('[data-act="upload-file"]');
    if (uploadBtn) {
      fileInput.click();
      return;
    }

    const openToolBtn = e.target.closest('[data-open-tool]');
    if (openToolBtn) {
      const toolId = openToolBtn.dataset.openTool;
      const artId = openToolBtn.dataset.artId;
      const art = engine.artifacts.get(artId);
      if (art) {
        store.handOff({
          name: art.name,
          kind: art.kind,
          text: art.text,
          from: 'spaces',
        });
        window.location.hash = `#${toolId}`;
      }
      return;
    }

    const downloadBtn = e.target.closest('[data-act="download-art"]');
    if (downloadBtn) {
      const artId = downloadBtn.dataset.artId;
      const art = engine.artifacts.get(artId);
      if (art) store.exportOne(art);
      return;
    }

    const delArtBtn = e.target.closest('[data-act="del-art"]');
    if (delArtBtn) {
      const artId = delArtBtn.dataset.artId;
      if (confirm('Remove this artifact from the Space?')) {
        engine.deleteArtifact(artId);
      }
      return;
    }

    const downloadFileBtn = e.target.closest('[data-act="download-file"]');
    if (downloadFileBtn) {
      const fileId = downloadFileBtn.dataset.fileId;
      const f = engine.files.get(fileId);
      if (f && f.data) {
        const a = document.createElement('a');
        a.href = f.data;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return;
    }

    const delFileBtn = e.target.closest('[data-act="del-file"]');
    if (delFileBtn) {
      const fileId = delFileBtn.dataset.fileId;
      if (confirm('Remove this file from the Space?')) {
        engine.deleteFile(fileId);
      }
      return;
    }
  };

  container.addEventListener('click', onClick);

  const onUpdate = () => render();
  engine.on('artifacts-update', onUpdate);
  engine.on('files-update', onUpdate);

  render();

  return () => {
    container.removeEventListener('click', onClick);
    engine.off('artifacts-update', onUpdate);
    engine.off('files-update', onUpdate);
  };
}

/* ============================================================
   3. DISCUSSION (Realtime room messaging)
   ============================================================ */

export function mountDiscussionView(container, engine) {
  container.innerHTML = `
    <div class="sp-chat fade-in">
      <div class="sp-chat-messages"></div>
      <div class="sp-typing"></div>
      <form class="sp-chat-input-row" id="sp-chat-form">
        <input type="text" class="tool-input sp-chat-input" placeholder="Type a message to the space…" autocomplete="off" spellcheck="false">
        <button type="submit" class="btn btn-primary sp-chat-send">
          <span>Send</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>
  `;

  const messagesDiv = container.querySelector('.sp-chat-messages');
  const input = container.querySelector('.sp-chat-input');
  const form = container.querySelector('#sp-chat-form');
  const typingDiv = container.querySelector('.sp-typing');

  const renderMessages = () => {
    const msgs = engine.chat ? engine.chat.toArray() : [];
    const myId = engine.user.id;

    if (!msgs.length) {
      messagesDiv.innerHTML = `
        <div class="sp-empty-chat">
          <div class="sp-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <p>This is the start of the discussion for <strong>${escapeHtml(engine.spaceName)}</strong>.</p>
        </div>
      `;
      return;
    }

    messagesDiv.innerHTML = msgs.map(m => {
      const isSelf = m.from === myId;
      return `
        <div class="sp-chat-msg ${isSelf ? 'is-self' : ''}">
          <div class="sp-chat-msg-header">
            <span class="sp-chat-msg-name" style="color:${m.color || 'inherit'}">${escapeHtml(m.name)}</span>
            <time class="sp-chat-msg-time">${formatTime(m.time)}</time>
          </div>
          <div class="sp-chat-msg-text">${escapeHtml(m.text)}</div>
        </div>
      `;
    }).join('');

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const renderTyping = () => {
    const typing = Array.from(engine.onlineMembers.values())
      .filter(p => p.typing && !p.isSelf)
      .map(p => p.name);

    if (typing.length === 0) {
      typingDiv.textContent = '';
    } else if (typing.length === 1) {
      typingDiv.innerHTML = `<span class="sp-typing-dots"><span></span><span></span><span></span></span> ${escapeHtml(typing[0])} is typing…`;
    } else {
      typingDiv.innerHTML = `<span class="sp-typing-dots"><span></span><span></span><span></span></span> Several people are typing…`;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) {
      engine.sendChat(input.value.trim());
      input.value = '';
      engine.setTyping(false);
    }
  });

  let typingTimeout;
  input.addEventListener('input', () => {
    engine.setTyping(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => engine.setTyping(false), 2000);
  });

  const onChat = () => renderMessages();
  const onPeer = () => renderTyping();

  engine.on('chat-update', onChat);
  engine.on('peer-update', onPeer);

  renderMessages();
  renderTyping();

  return () => {
    engine.off('chat-update', onChat);
    engine.off('peer-update', onPeer);
    clearTimeout(typingTimeout);
    engine.setTyping(false);
  };
}

/* ============================================================
   4. TASKS (Lightweight group task list)
   ============================================================ */

export function mountTasksView(container, engine) {
  let showForm = false;
  let activeTab = 'all'; // 'all' | 'todo' | 'doing' | 'done'

  const render = () => {
    const allTasks = engine.tasks ? Array.from(engine.tasks.values()) : [];
    const members = engine.members ? Array.from(engine.members.values()) : [];

    const tasks = allTasks.filter(t => activeTab === 'all' || t.status === activeTab);

    container.innerHTML = `
      <div class="sp-tasks-pane fade-in">
        <div class="sp-pane-header">
          <div class="sp-filter-bar">
            <button class="sp-filter-btn ${activeTab === 'all' ? 'is-active' : ''}" data-task-tab="all">All (${allTasks.length})</button>
            <button class="sp-filter-btn ${activeTab === 'todo' ? 'is-active' : ''}" data-task-tab="todo">To Do</button>
            <button class="sp-filter-btn ${activeTab === 'doing' ? 'is-active' : ''}" data-task-tab="doing">In Progress</button>
            <button class="sp-filter-btn ${activeTab === 'done' ? 'is-active' : ''}" data-task-tab="done">Completed</button>
          </div>
          ${engine.canEdit ? `
            <button class="btn btn-primary btn-sm" data-act="toggle-task-form">
              ${showForm ? 'Cancel' : '+ New Task'}
            </button>
          ` : ''}
        </div>

        ${showForm ? `
          <form class="sp-task-form fade-in" id="sp-new-task-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Task Title</label>
              <input type="text" class="tool-input" id="task-title" placeholder="What needs to be done?" required autocomplete="off">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Description (Optional)</label>
              <input type="text" class="tool-input" id="task-desc" placeholder="Add details or acceptance criteria" autocomplete="off">
            </div>
            <div class="sp-form-row">
              <div class="sp-form-group" style="flex:1;">
                <label class="sp-form-label">Assignee</label>
                <select class="tool-input" id="task-assignee">
                  <option value="">Unassigned</option>
                  ${members.map(m => `<option value="${m.id}" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
                </select>
              </div>
              <div class="sp-form-group" style="flex:1;">
                <label class="sp-form-label">Due Date</label>
                <input type="date" class="tool-input" id="task-due">
              </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:4px;">
              <button type="submit" class="btn btn-primary btn-sm">Add Task</button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="toggle-task-form">Cancel</button>
            </div>
          </form>
        ` : ''}

        <!-- Task List -->
        <div class="sp-task-list">
          ${tasks.map(t => `
            <div class="sp-task-card ${t.status === 'done' ? 'is-done' : ''}" data-task-id="${t.id}">
              <div class="sp-task-check is-${t.status}" data-act="cycle-status" data-id="${t.id}" title="Click to cycle status (Todo → Doing → Done)">
                ${t.status === 'done' ? '✓' : (t.status === 'doing' ? '●' : '')}
              </div>
              <div class="sp-task-info">
                <div class="sp-task-title">${escapeHtml(t.title)}</div>
                ${t.description ? `<div class="sp-task-desc">${escapeHtml(t.description)}</div>` : ''}
                <div class="sp-task-meta">
                  <span class="sp-status-badge is-${t.status}">${t.status === 'done' ? 'Done' : (t.status === 'doing' ? 'In Progress' : 'To Do')}</span>
                  ${t.assigneeName ? `
                    <span class="sp-task-assignee">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      ${escapeHtml(t.assigneeName)}
                    </span>
                  ` : ''}
                  ${t.dueDate ? `
                    <span class="sp-task-due">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      ${t.dueDate}
                    </span>
                  ` : ''}
                  <span class="sp-task-creator">by ${escapeHtml(t.createdBy)}</span>
                </div>
              </div>
              ${engine.canEdit ? `
                <button class="sp-icon-del-btn" data-act="del-task" data-id="${t.id}" title="Delete task">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : ''}
            </div>
          `).join('')}
          ${!tasks.length && !showForm ? `
            <div class="sp-empty-pane" style="padding:32px 16px;">
              <p class="sp-empty-title">No tasks in this view</p>
              <p class="sp-empty-desc">Create a task to assign action items to group members.</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  const onClick = (e) => {
    const tabBtn = e.target.closest('[data-task-tab]');
    if (tabBtn) {
      activeTab = tabBtn.dataset.taskTab;
      render();
      return;
    }

    const toggleFormBtn = e.target.closest('[data-act="toggle-task-form"]');
    if (toggleFormBtn) {
      showForm = !showForm;
      render();
      return;
    }

    const cycleBtn = e.target.closest('[data-act="cycle-status"]');
    if (cycleBtn) {
      const taskId = cycleBtn.dataset.id;
      const task = engine.tasks.get(taskId);
      if (task) {
        const nextStatus = task.status === 'todo' ? 'doing' : (task.status === 'doing' ? 'done' : 'todo');
        engine.updateTask(taskId, { status: nextStatus });
      }
      return;
    }

    const delBtn = e.target.closest('[data-act="del-task"]');
    if (delBtn) {
      const taskId = delBtn.dataset.id;
      engine.deleteTask(taskId);
      return;
    }
  };

  const onSubmit = (e) => {
    if (e.target.id === 'sp-new-task-form') {
      e.preventDefault();
      const title = container.querySelector('#task-title').value;
      const description = container.querySelector('#task-desc').value;
      const assigneeSelect = container.querySelector('#task-assignee');
      const assignee = assigneeSelect.value;
      const assigneeName = assigneeSelect.selectedOptions[0]?.dataset.name || '';
      const dueDate = container.querySelector('#task-due').value || null;

      if (title.trim()) {
        engine.createTask({ title, description, assignee, assigneeName, dueDate });
        showForm = false;
        render();
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);

  const onUpdate = () => render();
  engine.on('tasks-update', onUpdate);

  render();

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    engine.off('tasks-update', onUpdate);
  };
}

/* ============================================================
   5. LIVE SESSIONS (Collaborative Notepad & Live Polls)
   ============================================================ */

export function mountLiveSessionsView(container, engine) {
  let subTab = 'notepad'; // 'notepad' | 'polls'

  const render = () => {
    container.innerHTML = `
      <div class="sp-sessions-pane fade-in">
        <div class="sp-sub-tabs">
          <button class="sp-sub-tab ${subTab === 'notepad' ? 'is-active' : ''}" data-sub="notepad">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Shared Notepad
          </button>
          <button class="sp-sub-tab ${subTab === 'polls' ? 'is-active' : ''}" data-sub="polls">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Live Polls
          </button>
        </div>
        <div class="sp-session-body"></div>
      </div>
    `;

    const body = container.querySelector('.sp-session-body');
    if (subTab === 'notepad') {
      mountNotepad(body, engine);
    } else {
      mountPolls(body, engine);
    }
  };

  const onClick = (e) => {
    const subBtn = e.target.closest('[data-sub]');
    if (subBtn && subBtn.dataset.sub !== subTab) {
      subTab = subBtn.dataset.sub;
      render();
    }
  };

  container.addEventListener('click', onClick);
  render();

  return () => {
    container.removeEventListener('click', onClick);
  };
}

function mountNotepad(container, engine) {
  container.innerHTML = `
    <div class="sp-notepad fade-in">
      <div class="sp-notepad-info">
        <div class="sp-notepad-badge">
          <span class="sp-dot-live"></span>
          <span>Live Synchronized Document</span>
        </div>
        <span class="sp-notepad-counter" id="sp-note-count">0 words · 0 chars</span>
      </div>
      <textarea class="sp-notepad-area" placeholder="Start typing shared notes, drafts, minutes... Keystrokes synchronize in real-time across peers." spellcheck="false"></textarea>
    </div>
  `;
  const area = container.querySelector('.sp-notepad-area');
  const countEl = container.querySelector('#sp-note-count');
  let isFocused = false;

  const updateCounts = (text) => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    if (countEl) countEl.textContent = `${words} word${words === 1 ? '' : 's'} · ${chars} char${chars === 1 ? '' : 's'}`;
  };

  const updateArea = () => {
    if (!isFocused && engine.notepad) {
      const val = engine.notepad.toString();
      area.value = val;
      updateCounts(val);
    }
  };

  if (engine.notepad) {
    engine.notepad.observe(updateArea);
    updateArea();
  }

  area.addEventListener('focus', () => { isFocused = true; });
  area.addEventListener('blur', () => { isFocused = false; });
  area.addEventListener('input', () => {
    updateCounts(area.value);
    if (isFocused && engine.notepad) {
      const ytext = engine.notepad;
      ytext.delete(0, ytext.length);
      ytext.insert(0, area.value);
    }
  });

  return () => {
    if (engine.notepad) engine.notepad.unobserve(updateArea);
  };
}

function mountPolls(container, engine) {
  let showCreate = false;

  const render = () => {
    const polls = engine.polls ? Array.from(engine.polls.values()) : [];
    const myId = engine.user.id;

    container.innerHTML = `
      <div class="sp-poll-container fade-in">
        <div class="sp-pane-header">
          <div>
            <h3 class="sp-section-title">Live Polls</h3>
            <span class="sp-section-sub">Anonymous group voting</span>
          </div>
          ${engine.canEdit ? `
            <button class="btn btn-secondary btn-sm" data-act="toggle-poll-form">${showCreate ? 'Cancel' : '+ Create Poll'}</button>
          ` : ''}
        </div>

        ${showCreate ? `
          <form class="sp-poll-form fade-in" id="sp-new-poll-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Poll Question</label>
              <input type="text" class="tool-input" id="poll-q" placeholder="What should the group vote on?" required autocomplete="off">
            </div>
            <div class="sp-poll-options-inputs" id="poll-opts-wrap">
              <label class="sp-form-label">Options</label>
              <input type="text" class="tool-input sp-poll-opt" placeholder="Option 1" required autocomplete="off">
              <input type="text" class="tool-input sp-poll-opt" placeholder="Option 2" required autocomplete="off">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="poll-add-opt">+ Add Option</button>
              <button type="submit" class="btn btn-primary btn-sm">Post Poll →</button>
            </div>
          </form>
        ` : ''}

        <div class="sp-poll-list">
          ${polls.map(p => {
            const votes = p.votes || {};
            const myVote = votes[myId];
            const hasVoted = myVote !== undefined;
            const voteCounts = (p.options || []).map((_, i) => Object.values(votes).filter(v => v === i).length);
            const totalVotes = Object.keys(votes).length;

            return `
              <div class="sp-poll" data-id="${p.id}">
                <div class="sp-poll-question">${escapeHtml(p.question)}</div>
                <div class="sp-poll-options">
                  ${(p.options || []).map((opt, i) => {
                    if (hasVoted) {
                      const count = voteCounts[i];
                      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                      const isMyPick = myVote === i;
                      return `
                        <div class="sp-poll-bar ${isMyPick ? 'is-my-pick' : ''}">
                          <div class="sp-poll-bar-fill" style="width: ${pct}%"></div>
                          <span class="sp-poll-bar-label">${escapeHtml(opt)} ${isMyPick ? '✓' : ''}</span>
                          <span class="sp-poll-bar-count">${count} (${pct}%)</span>
                        </div>`;
                    } else {
                      return `<button class="sp-poll-option" data-act="vote" data-poll-id="${p.id}" data-idx="${i}">${escapeHtml(opt)}</button>`;
                    }
                  }).join('')}
                </div>
                <div class="sp-poll-footer">
                  <span>${totalVotes} vote${totalVotes === 1 ? '' : 's'} · Created by <strong>${escapeHtml(p.createdBy)}</strong></span>
                </div>
              </div>
            `;
          }).join('')}
          ${!polls.length && !showCreate ? `
            <div class="sp-empty-pane" style="padding:32px 16px;">
              <p class="sp-empty-title">No active polls</p>
              <p class="sp-empty-desc">Create a quick poll to gather feedback or make decisions together.</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  const onClick = (e) => {
    const toggleBtn = e.target.closest('[data-act="toggle-poll-form"]');
    if (toggleBtn) {
      showCreate = !showCreate;
      render();
      return;
    }

    const addOptBtn = e.target.closest('#poll-add-opt');
    if (addOptBtn) {
      const wrap = container.querySelector('#poll-opts-wrap');
      if (wrap && wrap.querySelectorAll('.sp-poll-opt').length < 6) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'tool-input sp-poll-opt';
        inp.placeholder = `Option ${wrap.querySelectorAll('.sp-poll-opt').length + 1}`;
        inp.required = true;
        inp.style.marginTop = '6px';
        wrap.appendChild(inp);
      }
      return;
    }

    const voteBtn = e.target.closest('[data-act="vote"]');
    if (voteBtn) {
      const pollId = voteBtn.dataset.pollId;
      const idx = parseInt(voteBtn.dataset.idx, 10);
      engine.votePoll(pollId, idx);
    }
  };

  const onSubmit = (e) => {
    if (e.target.id === 'sp-new-poll-form') {
      e.preventDefault();
      const q = container.querySelector('#poll-q').value;
      const opts = Array.from(container.querySelectorAll('.sp-poll-opt')).map(i => i.value).filter(v => v.trim());
      if (q && opts.length >= 2) {
        engine.createPoll(q, opts);
        showCreate = false;
        render();
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);

  const onUpdate = () => render();
  engine.on('poll-update', onUpdate);

  render();

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    engine.off('poll-update', onUpdate);
  };
}

/* ============================================================
   6. CHALLENGES (Collaborative group challenges)
   ============================================================ */

export function mountChallengesView(container, engine) {
  let showCreate = false;

  const render = () => {
    const challenges = engine.challenges ? Array.from(engine.challenges.values()) : [];
    const myId = engine.user.id;

    container.innerHTML = `
      <div class="sp-challenges-pane fade-in">
        <div class="sp-pane-header">
          <div>
            <h3 class="sp-section-title">Group Challenges</h3>
            <span class="sp-section-sub">Collaborative exercises, prompts, and shared goals</span>
          </div>
          ${engine.canEdit ? `
            <button class="btn btn-secondary btn-sm" data-act="toggle-ch-form">${showCreate ? 'Cancel' : '+ New Challenge'}</button>
          ` : ''}
        </div>

        ${showCreate ? `
          <form class="sp-challenge-form fade-in" id="sp-new-challenge-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Challenge Title</label>
              <input type="text" class="tool-input" id="ch-title" placeholder="e.g. Build a 3D Model, Design a flow chart" required autocomplete="off">
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Prompt / Criteria</label>
              <textarea class="tool-input" id="ch-prompt" placeholder="Explain the prompt, goal, or constraints..." rows="3" required></textarea>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="submit" class="btn btn-primary btn-sm">Post Challenge</button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="toggle-ch-form">Cancel</button>
            </div>
          </form>
        ` : ''}

        <div class="sp-challenge-list">
          ${challenges.map(ch => {
            const submissions = ch.submissions || {};
            const mySubmission = submissions[myId];
            const subCount = Object.keys(submissions).length;

            return `
              <div class="sp-challenge-card" data-id="${ch.id}">
                <div class="sp-challenge-head">
                  <h4 class="sp-challenge-title">${escapeHtml(ch.title)}</h4>
                  <span class="sp-badge">${subCount} submission${subCount === 1 ? '' : 's'}</span>
                </div>
                <div class="sp-challenge-prompt-box">
                  <p class="sp-challenge-prompt">${escapeHtml(ch.prompt)}</p>
                </div>
                <div class="sp-challenge-meta">
                  <span>Created by <strong>${escapeHtml(ch.createdBy)}</strong></span>
                </div>

                <!-- Submit answer -->
                <div class="sp-ch-submit-area">
                  ${mySubmission ? `
                    <div class="sp-ch-my-sub">
                      <strong>✓ Your Submission</strong>
                      <p>${escapeHtml(mySubmission.text)}</p>
                    </div>
                  ` : `
                    <form class="sp-ch-sub-form" data-ch-id="${ch.id}">
                      <textarea class="tool-input" placeholder="Type your answer, solution, or output..." rows="2" required></textarea>
                      <button type="submit" class="btn btn-primary btn-sm" style="margin-top:6px;">Submit Entry →</button>
                    </form>
                  `}
                </div>

                <!-- Submissions preview -->
                ${subCount ? `
                  <details class="sp-ch-details">
                    <summary>View ${subCount} Member Submission${subCount === 1 ? '' : 's'}</summary>
                    <div class="sp-ch-subs-list">
                      ${Object.entries(submissions).map(([, sub]) => `
                        <div class="sp-ch-sub-item">
                          <span class="sp-ch-sub-user">${escapeHtml(sub.userName)}</span>
                          <p>${escapeHtml(sub.text)}</p>
                        </div>
                      `).join('')}
                    </div>
                  </details>
                ` : ''}
              </div>
            `;
          }).join('')}
          ${!challenges.length && !showCreate ? `
            <div class="sp-empty-pane" style="padding:32px 16px;">
              <p class="sp-empty-title">No challenges running yet</p>
              <p class="sp-empty-desc">Create a challenge prompt for your group to collaborate on.</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  const onClick = (e) => {
    const toggleBtn = e.target.closest('[data-act="toggle-ch-form"]');
    if (toggleBtn) {
      showCreate = !showCreate;
      render();
    }
  };

  const onSubmit = (e) => {
    if (e.target.id === 'sp-new-challenge-form') {
      e.preventDefault();
      const title = container.querySelector('#ch-title').value;
      const prompt = container.querySelector('#ch-prompt').value;
      if (title.trim() && prompt.trim()) {
        engine.createChallenge({ title, prompt });
        showCreate = false;
        render();
      }
      return;
    }

    const subForm = e.target.closest('.sp-ch-sub-form');
    if (subForm) {
      e.preventDefault();
      const chId = subForm.dataset.chId;
      const text = subForm.querySelector('textarea').value;
      if (text.trim()) {
        engine.submitChallenge(chId, text);
        render();
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);

  const onUpdate = () => render();
  engine.on('challenges-update', onUpdate);

  render();

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    engine.off('challenges-update', onUpdate);
  };
}

/* ============================================================
   7. MEMBERS & ROLES
   ============================================================ */

export function mountMembersView(container, engine) {
  const render = () => {
    const onlineMap = engine.onlineMembers;
    const allMembersMap = engine.members ? Array.from(engine.members.values()) : [];

    container.innerHTML = `
      <div class="sp-members-pane fade-in">
        <!-- Invite Card -->
        <div class="sp-invite-banner">
          <div>
            <h3>Invite Collaborators</h3>
            <p>Anyone with the 6-character room code or direct link can join immediately.</p>
          </div>
          <div class="sp-code-pill-wrap">
            <span class="sp-code-pill">${engine.roomCode}</span>
            <button class="btn btn-primary btn-sm" data-act="copy-invite">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Copy Link
            </button>
          </div>
        </div>

        <div class="sp-section-head" style="margin-top:28px;">
          <div>
            <h3 class="sp-section-title">Members Roster</h3>
            <span class="sp-section-sub">${onlineMap.size} online now</span>
          </div>
        </div>

        <div class="sp-members-list">
          ${allMembersMap.map(m => {
            const isOnline = Array.from(onlineMap.values()).some(o => o.id === m.id);
            const isSelf = m.id === engine.user.id;

            return `
              <div class="sp-member-row">
                <div class="sp-member-info">
                  <div class="sp-avatar-circle" style="background:${m.color || '#000'}">${getInitials(m.name)}</div>
                  <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <strong>${escapeHtml(m.name)}</strong>
                      ${isSelf ? '<span class="sp-badge">(You)</span>' : ''}
                    </div>
                    <span class="sp-presence-status">
                      <span class="sp-presence-dot ${isOnline ? 'is-online' : 'is-offline'}"></span>
                      ${isOnline ? 'Active now' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div class="sp-member-role-area">
                  <span class="sp-role-pill is-${m.role || 'member'}">${m.role || 'member'}</span>
                  ${engine.isAdmin && !isSelf ? `
                    <select class="tool-input sp-role-select" data-member-id="${m.id}">
                      <option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option>
                      <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
                      <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                    </select>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
          ${!allMembersMap.length ? '<p class="sp-empty-hint">Waiting for members to connect…</p>' : ''}
        </div>
      </div>
    `;
  };

  const onClick = (e) => {
    const copyBtn = e.target.closest('[data-act="copy-invite"]');
    if (copyBtn) {
      const link = window.location.origin + window.location.pathname + '#spaces/' + engine.roomCode;
      navigator.clipboard.writeText(link);
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `<span>Copied link!</span>`;
      setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
    }
  };

  const onChange = (e) => {
    const select = e.target.closest('.sp-role-select');
    if (select) {
      const memberId = select.dataset.memberId;
      const newRole = select.value;
      engine.updateMemberRole(memberId, newRole);
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);

  const onUpdate = () => render();
  engine.on('members-update', onUpdate);
  engine.on('peer-update', onUpdate);

  render();

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('change', onChange);
    engine.off('members-update', onUpdate);
    engine.off('peer-update', onUpdate);
  };
}
