/* ============================================================
   TOOLBOX — Dedicated Messaging Tool
   Authoritative standalone messaging tool for direct conversations,
   channels, code snippet sharing, and file handoffs.
   Local-first, direct-connection, zero technical jargon.
   ============================================================ */

import { SpaceEngine, listJoinedSpaces, saveJoinedSpace, getUserProfile, saveUserProfile, prewarmSignaling } from '../lib/space-engine.js';
import { tbAlert, tbPrompt, tbConfirm } from '../lib/dialog.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderMessageContent(text) {
  if (!text) return '';
  
  // Format code blocks ```lang ... ```
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="msg-code-block"><div class="msg-code-head"><span>${lang || 'code'}</span></div><pre><code>${code.trim()}</code></pre></div>`;
  });

  // Format inline `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="msg-inline-code">$1</code>');

  // Format newlines
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

export default {
  _unmount: null,

  render(container, state) {
    this.destroy();
    prewarmSignaling();

    let engine = new SpaceEngine();
    let currentRoomCode = state?.roomCode || null;
    let pendingAttachment = null;

    // Check if there is an existing conversation or pick the first recent one
    const recentSpaces = listJoinedSpaces();
    if (!currentRoomCode && recentSpaces.length > 0) {
      currentRoomCode = recentSpaces[0].id;
    }

    container.innerHTML = `
      <div class="messaging-app" id="messaging-app">
        <!-- LEFT: Conversations Sidebar -->
        <aside class="msg-sidebar" id="msg-sidebar">
          <div class="msg-sidebar-header">
            <div class="msg-sidebar-title-row">
              <h2 class="msg-sidebar-title">Messaging</h2>
              <div class="msg-sidebar-actions">
                <button type="button" class="btn btn-primary btn-sm msg-btn-new" id="msg-new-btn" title="New Conversation">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>New</span>
                </button>
              </div>
            </div>
            <div class="msg-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="msg-search-icon"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" id="msg-search-input" class="tool-input msg-search-input" placeholder="Search conversations…" autocomplete="off" spellcheck="false">
            </div>
          </div>

          <div class="msg-conv-list" id="msg-conv-list"></div>

          <div class="msg-sidebar-footer">
            <button type="button" class="btn btn-secondary btn-sm msg-join-btn" id="msg-join-btn" style="width:100%; justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              <span>Join with Code</span>
            </button>
          </div>
        </aside>

        <!-- RIGHT: Active Chat View -->
        <main class="msg-main" id="msg-main">
          <!-- Active Header -->
          <header class="msg-chat-header" id="msg-chat-header">
            <div class="msg-header-left">
              <button type="button" class="btn btn-secondary btn-sm msg-back-btn" id="msg-back-btn" aria-label="Back to conversations">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div class="msg-room-avatar" id="msg-room-avatar">#</div>
              <div class="msg-room-info">
                <div class="msg-room-name-row">
                  <h3 class="msg-room-title" id="msg-room-title">Select a Conversation</h3>
                  <span class="msg-status-pill" id="msg-status-pill">Offline</span>
                </div>
                <span class="msg-room-members" id="msg-room-members">0 members</span>
              </div>
            </div>

            <div class="msg-header-right">
              <button type="button" class="btn btn-secondary btn-sm msg-code-copy-btn" id="msg-code-btn" title="Copy conversation code">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span id="msg-code-text">Code</span>
              </button>
            </div>
          </header>

          <!-- Messages Stream -->
          <div class="msg-stream" id="msg-stream">
            <div class="msg-stream-placeholder" id="msg-placeholder">
              <div class="msg-empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h4 style="margin:0 0 6px; font-weight:700; color:var(--text);">Direct &amp; Group Messaging</h4>
              <p style="margin:0; font-size:0.84rem; color:var(--text-muted); max-width:360px;">Select a conversation or start a new direct channel with a code.</p>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div class="msg-typing-indicator" id="msg-typing-bar"></div>

          <!-- Attachment Preview Bar (Hidden when empty) -->
          <div class="msg-attachment-bar" id="msg-attachment-bar" style="display:none;">
            <div class="msg-attachment-preview">
              <span class="msg-attachment-name" id="msg-attachment-name"></span>
              <button type="button" class="msg-attachment-remove" id="msg-attachment-remove" aria-label="Remove attachment">&times;</button>
            </div>
          </div>

          <!-- Composer Bar -->
          <footer class="msg-composer-wrap" id="msg-composer-wrap">
            <form class="msg-composer-form" id="msg-composer-form">
              <button type="button" class="msg-icon-action-btn" id="msg-attach-btn" title="Attach file or code snippet" aria-label="Attach file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <input type="file" id="msg-file-input" style="display:none;">

              <textarea class="msg-composer-input" id="msg-composer-input" placeholder="Type a message… (Enter to send, Shift+Enter for newline)" rows="1"></textarea>

              <button type="submit" class="btn btn-primary msg-send-btn" id="msg-send-btn" aria-label="Send message">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </footer>
        </main>
      </div>
    `;

    // References
    const sidebar = container.querySelector('#msg-sidebar');
    const convList = container.querySelector('#msg-conv-list');
    const searchInput = container.querySelector('#msg-search-input');
    const roomTitle = container.querySelector('#msg-room-title');
    const roomAvatar = container.querySelector('#msg-room-avatar');
    const roomMembers = container.querySelector('#msg-room-members');
    const statusPill = container.querySelector('#msg-status-pill');
    const codeBtn = container.querySelector('#msg-code-btn');
    const codeText = container.querySelector('#msg-code-text');
    const stream = container.querySelector('#msg-stream');
    const typingBar = container.querySelector('#msg-typing-bar');
    const composerInput = container.querySelector('#msg-composer-input');
    const composerForm = container.querySelector('#msg-composer-form');
    const fileInput = container.querySelector('#msg-file-input');
    const attachBtn = container.querySelector('#msg-attach-btn');
    const attachmentBar = container.querySelector('#msg-attachment-bar');
    const attachmentName = container.querySelector('#msg-attachment-name');
    const attachmentRemove = container.querySelector('#msg-attachment-remove');
    const backBtn = container.querySelector('#msg-back-btn');
    const newBtn = container.querySelector('#msg-new-btn');
    const joinBtn = container.querySelector('#msg-join-btn');

    // Update conversation sidebar list
    const renderConvList = () => {
      const q = searchInput.value.toLowerCase().trim();
      const allSpaces = listJoinedSpaces();
      const filtered = allSpaces.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));

      if (filtered.length === 0) {
        convList.innerHTML = `
          <div style="padding:20px 16px; text-align:center; color:var(--text-muted); font-size:0.8rem;">
            ${allSpaces.length === 0 ? 'No conversations yet.<br>Click <strong>New</strong> to begin.' : 'No conversations found.'}
          </div>
        `;
        return;
      }

      convList.innerHTML = filtered.map(s => {
        const isCurrent = s.id === currentRoomCode;
        const initials = (s.name || s.id).slice(0, 2).toUpperCase();
        return `
          <button type="button" class="msg-conv-item ${isCurrent ? 'is-active' : ''}" data-code="${escapeHtml(s.id)}">
            <div class="msg-conv-avatar">${escapeHtml(initials)}</div>
            <div class="msg-conv-meta">
              <div class="msg-conv-name-row">
                <span class="msg-conv-name">${escapeHtml(s.name || 'Conversation ' + s.id)}</span>
                <span class="msg-conv-code">${escapeHtml(s.id)}</span>
              </div>
              <span class="msg-conv-snippet">${escapeHtml(s.description || 'Direct channel')}</span>
            </div>
          </button>
        `;
      }).join('');

      convList.querySelectorAll('.msg-conv-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          if (code && code !== currentRoomCode) {
            connectToRoom(code);
          }
          if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-collapsed');
          }
        });
      });
    };

    // Render messages in stream
    const renderMessages = () => {
      const msgs = engine.chat ? engine.chat.toArray() : [];
      const myId = engine.user.id;

      if (!msgs.length) {
        stream.innerHTML = `
          <div class="msg-stream-placeholder">
            <div class="msg-empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h4 style="margin:0 0 6px; font-weight:700; color:var(--text);">Start of conversation</h4>
            <p style="margin:0; font-size:0.84rem; color:var(--text-muted); max-width:360px;">Send a message, code snippet, or file to members in <strong>${escapeHtml(engine.spaceName || currentRoomCode || '')}</strong>.</p>
          </div>
        `;
        return;
      }

      let lastDate = null;
      let html = '';

      msgs.forEach((m) => {
        const msgDate = formatDate(m.time);
        if (msgDate !== lastDate) {
          html += `<div class="msg-date-separator"><span>${escapeHtml(msgDate)}</span></div>`;
          lastDate = msgDate;
        }

        const isSelf = m.from === myId;
        const initial = (m.name || 'A').slice(0, 1).toUpperCase();
        const authorColor = m.color || 'var(--accent)';

        html += `
          <div class="msg-row ${isSelf ? 'is-self' : ''}">
            ${!isSelf ? `
              <div class="msg-bubble-avatar" style="background:${authorColor};">${escapeHtml(initial)}</div>
            ` : ''}
            <div class="msg-bubble-wrap">
              <div class="msg-bubble-header">
                <span class="msg-bubble-author" style="color:${authorColor};">${escapeHtml(m.name || 'Member')}</span>
                <time class="msg-bubble-time">${escapeHtml(formatTime(m.time))}</time>
              </div>
              <div class="msg-bubble-body">
                ${renderMessageContent(m.text)}
              </div>
              ${isSelf ? `<div class="msg-bubble-status">Delivered</div>` : ''}
            </div>
          </div>
        `;
      });

      stream.innerHTML = html;
      stream.scrollTop = stream.scrollHeight;
    };

    // Update connection & members UI
    const updateHeader = () => {
      if (!currentRoomCode) {
        roomTitle.textContent = 'Select a Conversation';
        roomAvatar.textContent = '#';
        roomMembers.textContent = '0 members';
        statusPill.textContent = 'Offline';
        statusPill.className = 'msg-status-pill';
        codeBtn.style.display = 'none';
        return;
      }

      const name = engine.spaceName || `Room ${currentRoomCode}`;
      roomTitle.textContent = name;
      roomAvatar.textContent = name.slice(0, 2).toUpperCase();
      codeBtn.style.display = 'inline-flex';
      codeText.textContent = currentRoomCode;

      const online = engine.onlineMembers;
      const count = online.size || 1;
      roomMembers.textContent = `${count} active member${count === 1 ? '' : 's'}`;

      if (engine.provider?.connected) {
        statusPill.textContent = 'Direct connection';
        statusPill.className = 'msg-status-pill is-online';
      } else {
        statusPill.textContent = 'Connecting…';
        statusPill.className = 'msg-status-pill is-connecting';
      }
    };

    // Update typing banner
    const updateTyping = () => {
      const typing = Array.from(engine.onlineMembers.values())
        .filter(p => p.typing && !p.isSelf)
        .map(p => p.name);

      if (typing.length === 0) {
        typingBar.textContent = '';
      } else if (typing.length === 1) {
        typingBar.innerHTML = `<span class="msg-typing-dots"><span></span><span></span><span></span></span> <em>${escapeHtml(typing[0])} is typing…</em>`;
      } else {
        typingBar.innerHTML = `<span class="msg-typing-dots"><span></span><span></span><span></span></span> <em>Several people are typing…</em>`;
      }
    };

    // Connect to room code
    const connectToRoom = async (code) => {
      if (!code) return;
      currentRoomCode = code.toUpperCase();
      renderConvList();

      engine.leave();
      engine = new SpaceEngine();

      const profile = getUserProfile();
      const displayName = profile.name || 'Member ' + Math.floor(100 + Math.random() * 900);

      engine.on('chat-update', renderMessages);
      engine.on('peer-update', () => {
        updateHeader();
        updateTyping();
      });
      engine.on('members-update', updateHeader);
      engine.on('connected', updateHeader);
      engine.on('disconnected', updateHeader);

      await engine.join(currentRoomCode, displayName);
      updateHeader();
      renderMessages();
    };

    // Start New Conversation
    const handleNewConversation = async () => {
      const name = await tbPrompt('Enter a title for this conversation or channel:', {
        title: 'New Conversation',
        placeholder: 'e.g. Project Alpha, Design Sprint, Catch-up'
      });

      if (name && name.trim()) {
        const profile = getUserProfile();
        const displayName = profile.name || 'Host';
        engine.leave();
        engine = new SpaceEngine();

        engine.on('chat-update', renderMessages);
        engine.on('peer-update', () => {
          updateHeader();
          updateTyping();
        });
        engine.on('members-update', updateHeader);
        engine.on('connected', updateHeader);
        engine.on('disconnected', updateHeader);

        const code = await engine.create(name.trim(), 'Direct channel', displayName);
        currentRoomCode = code;
        renderConvList();
        updateHeader();
        renderMessages();

        if (window.innerWidth <= 768) {
          sidebar.classList.add('mobile-collapsed');
        }
      }
    };

    // Join with Code
    const handleJoinWithCode = async () => {
      const code = await tbPrompt('Enter the 6-character room code:', {
        title: 'Join Conversation',
        placeholder: 'e.g. X7K2MP'
      });

      if (code && code.trim()) {
        await connectToRoom(code.trim());
        if (window.innerWidth <= 768) {
          sidebar.classList.add('mobile-collapsed');
        }
      }
    };

    // Copy Code button
    codeBtn.addEventListener('click', async () => {
      if (!currentRoomCode) return;
      try {
        await navigator.clipboard.writeText(currentRoomCode);
        const prev = codeText.textContent;
        codeText.textContent = 'Copied!';
        setTimeout(() => { codeText.textContent = prev; }, 1500);
      } catch (err) {
        tbAlert(`Conversation Code: ${currentRoomCode}`, 'Conversation Code');
      }
    });

    // Mobile back to sidebar
    backBtn.addEventListener('click', () => {
      sidebar.classList.remove('mobile-collapsed');
    });

    // Send Message
    const handleSendMessage = (e) => {
      e?.preventDefault();
      let text = composerInput.value.trim();

      if (pendingAttachment) {
        text = (text ? text + '\n\n' : '') + '📎 **Attachment: ' + pendingAttachment.name + '**\n```\n' + pendingAttachment.content + '\n```';
        pendingAttachment = null;
        attachmentBar.style.display = 'none';
        attachmentName.textContent = '';
      }

      if (!text) return;
      if (!currentRoomCode) {
        tbAlert('Please start or select a conversation first.', 'Messaging');
        return;
      }

      engine.sendChat(text);
      composerInput.value = '';
      composerInput.style.height = 'auto';
      engine.setTyping(false);
    };

    composerForm.addEventListener('submit', handleSendMessage);

    // Composer typing listener + auto-resize + Enter to send
    let typingTimer;
    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    composerInput.addEventListener('input', () => {
      // Auto-resize
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';

      engine.setTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => engine.setTyping(false), 2000);
    });

    // Attach File
    attachBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        pendingAttachment = {
          name: file.name,
          content: evt.target.result.slice(0, 8000)
        };
        attachmentName.textContent = `Attached: ${file.name}`;
        attachmentBar.style.display = 'flex';
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    attachmentRemove.addEventListener('click', () => {
      pendingAttachment = null;
      attachmentBar.style.display = 'none';
      attachmentName.textContent = '';
    });

    searchInput.addEventListener('input', renderConvList);
    newBtn.addEventListener('click', handleNewConversation);
    joinBtn.addEventListener('click', handleJoinWithCode);

    // Initial render
    renderConvList();
    if (currentRoomCode) {
      connectToRoom(currentRoomCode);
    } else {
      updateHeader();
    }

    this._unmount = () => {
      clearTimeout(typingTimer);
      engine.leave();
    };
  },

  destroy() {
    if (typeof this._unmount === 'function') {
      this._unmount();
      this._unmount = null;
    }
  }
};
