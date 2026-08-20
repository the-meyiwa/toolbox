/* ============================================================
   Space Activities — Desk, Artifacts, Discussion, Tasks, Sessions.

   Swiss-inspired, calm, restrained collaboration components.
   ============================================================ */

import * as store from './artifacts.js';
import { kindLabel, kindExt } from '../registry/kinds.js';
import { toolsAccepting, BY_ID } from '../registry/index.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

/* ============================================================
   1. DESK OVERVIEW (Home view of the Space)
   ============================================================ */

export function mountDeskOverview(container, engine) {
  const render = () => {
    const activityList = engine.activity ? engine.activity.toArray() : [];
    const artifactsMap = engine.artifacts ? Array.from(engine.artifacts.values()) : [];
    const tasksMap = engine.tasks ? Array.from(engine.tasks.values()) : [];
    const onlineCount = engine.onlineMembers.size;

    const openTasks = tasksMap.filter(t => t.status !== 'done').length;

    container.innerHTML = `
      <div class="sp-desk">
        <!-- Space Summary banner -->
        <div class="sp-desk-summary">
          <div class="sp-desk-hero">
            <h2 class="sp-desk-name">${escapeHtml(engine.spaceName)}</h2>
            <p class="sp-desk-desc">${escapeHtml(engine.spaceDescription || 'A shared desk for collaboration in Toolbox.')}</p>
          </div>
          <div class="sp-desk-stats">
            <div class="sp-stat-item">
              <span class="sp-stat-num">${onlineCount}</span>
              <span class="sp-stat-label">Active now</span>
            </div>
            <div class="sp-stat-item">
              <span class="sp-stat-num">${artifactsMap.length}</span>
              <span class="sp-stat-label">Artifact${artifactsMap.length === 1 ? '' : 's'}</span>
            </div>
            <div class="sp-stat-item">
              <span class="sp-stat-num">${openTasks}</span>
              <span class="sp-stat-label">Open task${openTasks === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div class="sp-desk-grid">
          <!-- Recent Activity Stream -->
          <div class="sp-desk-main">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Recent Activity</h3>
              <span class="sp-section-sub">Chronological events</span>
            </div>
            <div class="sp-activity-stream">
              ${activityList.length ? activityList.slice(0, 15).map(act => `
                <div class="sp-act-row">
                  <div class="sp-act-bullet"></div>
                  <div class="sp-act-content">
                    <span class="sp-act-actor">${escapeHtml(act.actorName)}</span>
                    <span class="sp-act-text">${escapeHtml(act.text)}</span>
                  </div>
                  <time class="sp-act-time">${formatDate(act.timestamp)}</time>
                </div>
              `).join('') : '<p class="sp-empty-hint">No recent activity yet. Share an artifact, post a task, or start a discussion.</p>'}
            </div>
          </div>

          <!-- Desk Side: Quick Shortcuts & Highlights -->
          <div class="sp-desk-side">
            <div class="sp-section-head">
              <h3 class="sp-section-title">Quick Actions</h3>
            </div>
            <div class="sp-quick-actions">
              <a href="#tools" class="sp-quick-link">
                <span class="sp-quick-icon">🔨</span>
                <div>
                  <strong>Open a Toolbox Tool</strong>
                  <p>Create work and use "Share to Space"</p>
                </div>
              </a>
              <button class="sp-quick-link" data-go-tab="artifacts">
                <span class="sp-quick-icon">📁</span>
                <div>
                  <strong>View Shared Artifacts</strong>
                  <p>${artifactsMap.length} item${artifactsMap.length === 1 ? '' : 's'} available</p>
                </div>
              </button>
              <button class="sp-quick-link" data-go-tab="live">
                <span class="sp-quick-icon">📝</span>
                <div>
                  <strong>Collaborative Notepad</strong>
                  <p>Live synchronized text editor</p>
                </div>
              </button>
            </div>

            <!-- Recent Artifacts Peek -->
            <div class="sp-section-head" style="margin-top:20px;">
              <h3 class="sp-section-title">Latest Artifacts</h3>
            </div>
            <div class="sp-mini-artifacts">
              ${artifactsMap.slice(0, 4).map(art => `
                <div class="sp-mini-art-card" data-open-art="${art.id}">
                  <span class="sp-badge">${escapeHtml(kindLabel(art.kind))}</span>
                  <strong>${escapeHtml(art.name)}</strong>
                  <small>${formatSize(art.size)} · ${escapeHtml(art.createdBy)}</small>
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
      <div class="sp-artifacts-pane">
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
            <button class="btn btn-secondary btn-sm" data-act="upload-file">Share a file</button>
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
                  <pre>${escapeHtml(art.text.slice(0, 240))}${art.text.length > 240 ? '…' : ''}</pre>
                </div>
                <div class="sp-art-meta">
                  <span>${formatSize(art.size)} · By <strong>${escapeHtml(art.createdBy)}</strong></span>
                </div>
                <div class="sp-art-actions">
                  ${targets.length ? `
                    <button class="btn btn-primary btn-sm" data-open-tool="${targets[0].id}" data-art-id="${art.id}">
                      Open in ${escapeHtml(targets[0].name)}
                    </button>
                  ` : ''}
                  <button class="btn btn-secondary btn-sm" data-act="download-art" data-art-id="${art.id}">Download</button>
                  ${engine.canEdit ? `<button class="btn btn-secondary btn-sm sp-del-btn" data-act="del-art" data-art-id="${art.id}">Delete</button>` : ''}
                </div>
              </div>
            `;
          }).join('')}

          ${rawFiles.map(f => `
            <div class="sp-art-card sp-file-card" data-file-id="${f.id}">
              <div class="sp-art-card-top">
                <span class="sp-badge">File</span>
                <time class="sp-art-time">${formatDate(f.createdAt)}</time>
              </div>
              <h4 class="sp-art-title">${escapeHtml(f.name)}</h4>
              <div class="sp-art-meta" style="margin-top:12px;">
                <span>${formatSize(f.size)} · Shared by <strong>${escapeHtml(f.createdBy)}</strong></span>
              </div>
              <div class="sp-art-actions" style="margin-top:16px;">
                <button class="btn btn-primary btn-sm" data-act="download-file" data-file-id="${f.id}">Download file</button>
                ${engine.canEdit ? `<button class="btn btn-secondary btn-sm sp-del-btn" data-act="del-file" data-file-id="${f.id}">Delete</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${!artifacts.length && !rawFiles.length ? `
          <div class="sp-empty-pane">
            <p class="sp-empty-title">No artifacts in this space yet</p>
            <p class="sp-empty-desc">Open any Toolbox tool, click "Share to Space" on the artifact strip, and it will appear here for all members.</p>
            <a href="#tools" class="btn btn-primary btn-sm">Explore tools</a>
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
   3. DISCUSSION (Lightweight messaging)
   ============================================================ */

export function mountDiscussionView(container, engine) {
  container.innerHTML = `
    <div class="sp-chat">
      <div class="sp-chat-messages"></div>
      <div class="sp-typing"></div>
      <form class="sp-chat-input-row">
        <input type="text" class="tool-input sp-chat-input" placeholder="Type a message to the space..." autocomplete="off">
        <button type="submit" class="btn btn-primary sp-chat-send">Send</button>
      </form>
    </div>
  `;

  const messagesDiv = container.querySelector('.sp-chat-messages');
  const input = container.querySelector('.sp-chat-input');
  const form = container.querySelector('form');
  const typingDiv = container.querySelector('.sp-typing');

  const renderMessages = () => {
    const msgs = engine.chat ? engine.chat.toArray() : [];
    const myId = engine.user.id;

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
      typingDiv.textContent = `${typing[0]} is typing…`;
    } else {
      typingDiv.textContent = 'Several people are typing…';
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
      <div class="sp-tasks-pane">
        <div class="sp-pane-header">
          <div class="sp-filter-bar">
            <button class="sp-filter-btn ${activeTab === 'all' ? 'is-active' : ''}" data-task-tab="all">All (${allTasks.length})</button>
            <button class="sp-filter-btn ${activeTab === 'todo' ? 'is-active' : ''}" data-task-tab="todo">To Do</button>
            <button class="sp-filter-btn ${activeTab === 'doing' ? 'is-active' : ''}" data-task-tab="doing">In Progress</button>
            <button class="sp-filter-btn ${activeTab === 'done' ? 'is-active' : ''}" data-task-tab="done">Completed</button>
          </div>
          ${engine.canEdit ? `
            <button class="btn btn-primary btn-sm" data-act="toggle-task-form">${showForm ? 'Cancel' : '+ New Task'}</button>
          ` : ''}
        </div>

        ${showForm ? `
          <form class="sp-task-form" id="sp-new-task-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Task Title</label>
              <input type="text" class="tool-input" id="task-title" placeholder="What needs to be done?" required>
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Description (Optional)</label>
              <input type="text" class="tool-input" id="task-desc" placeholder="Details or context">
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
            <button type="submit" class="btn btn-primary btn-sm" style="margin-top:8px;">Add Task</button>
          </form>
        ` : ''}

        <!-- Task List -->
        <div class="sp-task-list">
          ${tasks.map(t => `
            <div class="sp-task-card ${t.status === 'done' ? 'is-done' : ''}" data-task-id="${t.id}">
              <div class="sp-task-check" data-act="cycle-status" data-id="${t.id}" title="Click to change status">
                ${t.status === 'done' ? '✓' : (t.status === 'doing' ? '◐' : '○')}
              </div>
              <div class="sp-task-info">
                <div class="sp-task-title">${escapeHtml(t.title)}</div>
                ${t.description ? `<div class="sp-task-desc">${escapeHtml(t.description)}</div>` : ''}
                <div class="sp-task-meta">
                  <span class="sp-status-badge is-${t.status}">${t.status === 'done' ? 'Done' : (t.status === 'doing' ? 'In Progress' : 'To Do')}</span>
                  ${t.assigneeName ? `<span class="sp-task-assignee">👤 ${escapeHtml(t.assigneeName)}</span>` : ''}
                  ${t.dueDate ? `<span class="sp-task-due">📅 ${t.dueDate}</span>` : ''}
                  <span class="sp-task-creator">by ${escapeHtml(t.createdBy)}</span>
                </div>
              </div>
              ${engine.canEdit ? `
                <div class="sp-task-actions">
                  <button class="sp-task-del" data-act="del-task" data-id="${t.id}" title="Delete task">×</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
          ${!tasks.length ? '<p class="sp-empty-hint">No tasks in this view.</p>' : ''}
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
      <div class="sp-sessions-pane">
        <div class="sp-sub-tabs">
          <button class="sp-sub-tab ${subTab === 'notepad' ? 'is-active' : ''}" data-sub="notepad">Shared Notepad</button>
          <button class="sp-sub-tab ${subTab === 'polls' ? 'is-active' : ''}" data-sub="polls">Live Polls</button>
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
    <div class="sp-notepad">
      <div class="sp-notepad-info">
        <span>Real-time collaborative text document. Synchronizes live across all active peers.</span>
      </div>
      <textarea class="tool-input sp-notepad-area" placeholder="Start typing shared notes, meeting minutes, drafts..."></textarea>
    </div>
  `;
  const area = container.querySelector('.sp-notepad-area');
  let isFocused = false;

  const updateArea = () => {
    if (!isFocused && engine.notepad) {
      area.value = engine.notepad.toString();
    }
  };

  if (engine.notepad) {
    engine.notepad.observe(updateArea);
    updateArea();
  }

  area.addEventListener('focus', () => { isFocused = true; });
  area.addEventListener('blur', () => { isFocused = false; });
  area.addEventListener('input', () => {
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
      <div class="sp-poll-container">
        <div class="sp-pane-header">
          <h3 class="sp-section-title">Active Polls</h3>
          ${engine.canEdit ? `
            <button class="btn btn-secondary btn-sm" data-act="toggle-poll-form">${showCreate ? 'Cancel' : '+ Create Poll'}</button>
          ` : ''}
        </div>

        ${showCreate ? `
          <form class="sp-poll-form" id="sp-new-poll-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Question</label>
              <input type="text" class="tool-input" id="poll-q" placeholder="What would you like to ask?" required>
            </div>
            <div class="sp-poll-options-inputs" id="poll-opts-wrap">
              <input type="text" class="tool-input sp-poll-opt" placeholder="Option 1" required>
              <input type="text" class="tool-input sp-poll-opt" placeholder="Option 2" required>
            </div>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <button type="button" class="btn btn-secondary btn-sm" id="poll-add-opt">+ Add option</button>
              <button type="submit" class="btn btn-primary btn-sm">Post Poll</button>
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
                  <span>${totalVotes} vote${totalVotes === 1 ? '' : 's'} · Created by ${escapeHtml(p.createdBy)}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${!polls.length && !showCreate ? '<p class="sp-empty-hint">No active polls. Create one to vote with the room.</p>' : ''}
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
      if (wrap && wrap.children.length < 6) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'tool-input sp-poll-opt';
        inp.placeholder = `Option ${wrap.children.length + 1}`;
        inp.required = true;
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
      <div class="sp-challenges-pane">
        <div class="sp-pane-header">
          <div>
            <h3 class="sp-section-title">Group Challenges</h3>
            <p class="sp-section-sub">Prompts, exercises, and shared goals for the space</p>
          </div>
          ${engine.canEdit ? `
            <button class="btn btn-secondary btn-sm" data-act="toggle-ch-form">${showCreate ? 'Cancel' : '+ New Challenge'}</button>
          ` : ''}
        </div>

        ${showCreate ? `
          <form class="sp-challenge-form" id="sp-new-challenge-form">
            <div class="sp-form-group">
              <label class="sp-form-label">Challenge Title</label>
              <input type="text" class="tool-input" id="ch-title" placeholder="e.g. Build a 3D Model, Summarize a topic" required>
            </div>
            <div class="sp-form-group">
              <label class="sp-form-label">Prompt / Instructions</label>
              <textarea class="tool-input" id="ch-prompt" placeholder="Explain the challenge, criteria, or goal..." rows="3" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-top:6px;">Launch Challenge</button>
          </form>
        ` : ''}

        <div class="sp-challenge-list">
          ${challenges.map(ch => {
            const submissions = ch.submissions || {};
            const mySubmission = submissions[myId];
            const subCount = Object.keys(submissions).length;

            return `
              <div class="sp-challenge-card" data-id="${ch.id}">
                <h4 class="sp-challenge-title">${escapeHtml(ch.title)}</h4>
                <p class="sp-challenge-prompt">${escapeHtml(ch.prompt)}</p>
                <div class="sp-challenge-meta">
                  <span>${subCount} submission${subCount === 1 ? '' : 's'} · Created by ${escapeHtml(ch.createdBy)}</span>
                </div>

                <!-- Submit answer -->
                <div class="sp-ch-submit-area">
                  ${mySubmission ? `
                    <div class="sp-ch-my-sub">
                      <strong>Your entry:</strong>
                      <p>${escapeHtml(mySubmission.text)}</p>
                    </div>
                  ` : `
                    <form class="sp-ch-sub-form" data-ch-id="${ch.id}">
                      <textarea class="tool-input" placeholder="Write your submission or answer..." rows="2" required></textarea>
                      <button type="submit" class="btn btn-primary btn-sm" style="margin-top:6px;">Submit Entry</button>
                    </form>
                  `}
                </div>

                <!-- Submissions preview -->
                ${subCount ? `
                  <details class="sp-ch-details">
                    <summary>${subCount} Member Submission${subCount === 1 ? '' : 's'}</summary>
                    <div class="sp-ch-subs-list">
                      ${Object.entries(submissions).map(([, sub]) => `
                        <div class="sp-ch-sub-item">
                          <strong>${escapeHtml(sub.userName)}</strong>
                          <p>${escapeHtml(sub.text)}</p>
                        </div>
                      `).join('')}
                    </div>
                  </details>
                ` : ''}
              </div>
            `;
          }).join('')}
          ${!challenges.length && !showCreate ? '<p class="sp-empty-hint">No challenges running yet. Launch one for the room!</p>' : ''}
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
      <div class="sp-members-pane">
        <!-- Invite Banner -->
        <div class="sp-invite-banner">
          <div>
            <h3>Invite Members</h3>
            <p>Share this 6-character room code or the direct join link.</p>
          </div>
          <div class="sp-code-pill-wrap">
            <span class="sp-code-pill">${engine.roomCode}</span>
            <button class="btn btn-secondary btn-sm" data-act="copy-invite">Copy Invite Link</button>
          </div>
        </div>

        <div class="sp-section-head" style="margin-top:24px;">
          <h3 class="sp-section-title">Members in this Space</h3>
          <span class="sp-section-sub">${onlineMap.size} online now</span>
        </div>

        <div class="sp-members-list">
          ${allMembersMap.map(m => {
            const isOnline = Array.from(onlineMap.values()).some(o => o.id === m.id);
            const isSelf = m.id === engine.user.id;

            return `
              <div class="sp-member-row">
                <div class="sp-member-info">
                  <span class="sp-presence-dot ${isOnline ? 'is-online' : 'is-offline'}" style="background:${m.color || '#000'}"></span>
                  <strong>${escapeHtml(m.name)}</strong>
                  ${isSelf ? '<span class="sp-badge">(You)</span>' : ''}
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
          ${!allMembersMap.length ? '<p class="sp-empty-hint">Waiting for members to join...</p>' : ''}
        </div>
      </div>
    `;
  };

  const onClick = (e) => {
    const copyBtn = e.target.closest('[data-act="copy-invite"]');
    if (copyBtn) {
      const link = window.location.origin + window.location.pathname + '#spaces/' + engine.roomCode;
      navigator.clipboard.writeText(link);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Invite Link'; }, 2000);
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
