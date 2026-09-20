/* ============================================================
   TOOLBOX — Dedicated Messaging Tool (Super-Expanded)
   Authoritative standalone messaging tool for direct conversations,
   channels, Skype-style user lookup, file sharing, interactive polls,
   peer-to-peer chess, and AI assistant integration.
   ============================================================ */

import { SpaceEngine, listJoinedSpaces, saveJoinedSpace, getUserProfile, saveUserProfile, prewarmSignaling } from '../lib/space-engine.js';
import { tbAlert, tbPrompt, tbConfirm } from '../lib/dialog.js';
import { getMyProfile, updateMyProfile, getPublicProfiles, searchPublicProfiles } from '../lib/profile-system.js';
import { getFileTypeIcon, detectFileCategory } from '../lib/file-icons.js';
import { saveArtifactFile } from '../lib/artifacts.js';
import { generateIntelligentResponse } from '../lib/ai-provider.js';


const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="msg-code-block"><div class="msg-code-head"><span>${lang || 'code'}</span></div><pre><code>${code.trim()}</code></pre></div>`;
  });
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="msg-inline-code">$1</code>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// Initial chess board setup (Unicode pieces)
// White: uppercase, Black: lowercase
const INITIAL_CHESS_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const CHESS_PIECES_UNICODE = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

export default {
  _unmount: null,
  _lastMsgCount: undefined,

  render(container, state) {
    this.destroy();
    prewarmSignaling();

    let engine = new SpaceEngine();
    let currentRoomCode = state?.roomCode || null;
    let pendingAttachment = null;
    let activeSidebarTab = 'chats'; // 'chats' | 'people'
    let selectedChessSquare = null; // { msgIdx, r, c }

    const recentSpaces = listJoinedSpaces();
    if (!currentRoomCode && recentSpaces.length > 0) {
      currentRoomCode = recentSpaces[0].id;
    }

    container.innerHTML = `
      <div class="messaging-app" id="messaging-app">
        <!-- LEFT: Conversations & Directory Sidebar -->
        <aside class="msg-sidebar" id="msg-sidebar">
          <div class="msg-sidebar-header">
            <div class="msg-sidebar-title-row">
              <h2 class="msg-sidebar-title">Messaging</h2>
              <div class="msg-sidebar-actions">
                <button type="button" class="btn btn-primary btn-sm msg-btn-new" id="msg-new-btn" title="New Conversation or Group">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>New</span>
                </button>
              </div>
            </div>
            <div class="msg-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="msg-search-icon"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" id="msg-search-input" class="tool-input msg-search-input" placeholder="Search people or chats…" autocomplete="off" spellcheck="false">
            </div>
          </div>

          <!-- Skype-style Navigation Tabs (Chats / People) -->
          <div class="msg-search-tabs">
            <button type="button" class="msg-search-tab-btn is-active" id="tab-btn-chats">Chats</button>
            <button type="button" class="msg-search-tab-btn" id="tab-btn-people">People</button>
          </div>

          <!-- Main List Container -->
          <div class="msg-conv-list" id="msg-conv-list"></div>

          <div class="msg-sidebar-footer" style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm msg-discover-btn" id="msg-discover-btn" style="width:100%; justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              <span>My Profile &amp; Directory</span>
            </button>
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
              <p style="margin:0; font-size:0.84rem; color:var(--text-muted); max-width:360px;">Select a conversation or find a colleague in the directory to begin.</p>
            </div>
          </div>
          
          <div class="msg-discover-view" id="msg-discover-view" style="display:none; flex:1; overflow-y:auto; padding:24px; background:var(--background);">
          </div>

          <!-- Typing Indicator -->
          <div class="msg-typing-indicator" id="msg-typing-bar"></div>

          <!-- Attachment Preview Bar -->
          <div class="msg-attachment-bar" id="msg-attachment-bar" style="display:none;">
            <div class="msg-attachment-preview">
              <span class="msg-attachment-name" id="msg-attachment-name"></span>
              <button type="button" class="msg-attachment-remove" id="msg-attachment-remove" aria-label="Remove attachment">&times;</button>
            </div>
          </div>

          <!-- Composer Bar -->
          <footer class="msg-composer-wrap" id="msg-composer-wrap">
            <form class="msg-composer-form" id="msg-composer-form">
              <!-- File Attachment -->
              <button type="button" class="msg-icon-action-btn" id="msg-attach-btn" title="Attach file or image" aria-label="Attach file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <input type="file" id="msg-file-input" style="display:none;">

              <!-- Create Poll -->
              <button type="button" class="msg-icon-action-btn" id="msg-poll-btn" title="Create a Poll" aria-label="Create poll">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </button>

              <!-- Play Chess -->
              <button type="button" class="msg-icon-action-btn" id="msg-chess-btn" title="Start a Chess Game" aria-label="Play chess">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5v-2a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2z"/><path d="M12 4a3 3 0 0 1 3 3c0 1.5-1 3-3 4-2-1-3-2.5-3-4a3 3 0 0 1 3-3z"/></svg>
              </button>

              <!-- Ask Assistant -->
              <button type="button" class="msg-icon-action-btn" id="msg-ast-btn" title="Ask Assistant (@assistant)" aria-label="Ask assistant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </button>

              <textarea class="msg-composer-input" id="msg-composer-input" placeholder="Type a message… (Enter to send, @assistant to ask AI)" rows="1"></textarea>

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
    const tabBtnChats = container.querySelector('#tab-btn-chats');
    const tabBtnPeople = container.querySelector('#tab-btn-people');
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
    const pollBtn = container.querySelector('#msg-poll-btn');
    const chessBtn = container.querySelector('#msg-chess-btn');
    const astBtn = container.querySelector('#msg-ast-btn');
    const attachmentBar = container.querySelector('#msg-attachment-bar');
    const attachmentName = container.querySelector('#msg-attachment-name');
    const attachmentRemove = container.querySelector('#msg-attachment-remove');
    const backBtn = container.querySelector('#msg-back-btn');
    const newBtn = container.querySelector('#msg-new-btn');
    const joinBtn = container.querySelector('#msg-join-btn');
    const discoverBtn = container.querySelector('#msg-discover-btn');
    const discoverView = container.querySelector('#msg-discover-view');
    const chatHeader = container.querySelector('#msg-chat-header');
    const composerWrap = container.querySelector('#msg-composer-wrap');

    // Deterministic DM Room Code generator
    const getDmRoomCode = (myHandle, otherHandle) => {
      const handles = [myHandle.toLowerCase().trim(), otherHandle.toLowerCase().trim()].sort();
      const raw = `DM_${handles[0]}_${handles[1]}`.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      return raw.slice(0, 24);
    };

    // Render Skype-style People Directory in sidebar
    const renderPeopleList = () => {
      const q = searchInput.value.trim();
      const results = searchPublicProfiles(q);
      const myProfile = getMyProfile();

      if (results.length === 0) {
        convList.innerHTML = `
          <div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:0.82rem;">
            No users found matching "${escapeHtml(q)}".
          </div>
        `;
        return;
      }

      convList.innerHTML = `
        <div class="msg-people-list">
          ${results.map(p => {
            const isMe = p.username === myProfile.username;
            return `
              <button type="button" class="msg-people-item" data-username="${escapeHtml(p.username)}" data-name="${escapeHtml(p.name)}">
                <div class="msg-people-avatar">${escapeHtml(p.avatar || p.name.slice(0, 2).toUpperCase())}</div>
                <div class="msg-people-info">
                  <div class="msg-people-name-row">
                    <span class="msg-people-name">${escapeHtml(p.name)}</span>
                    <span class="msg-people-handle">@${escapeHtml(p.username)}</span>
                  </div>
                  <div class="msg-people-role">${escapeHtml(p.affiliation || p.bio || 'Toolbox Member')}${isMe ? ' (You)' : ''}</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      `;

      convList.querySelectorAll('.msg-people-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const username = btn.dataset.username;
          const name = btn.dataset.name;
          const dmCode = getDmRoomCode(myProfile.username, username);
          connectToRoom(dmCode, `Chat with ${name}`);
          if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-collapsed');
          }
        });
      });
    };

    // Render Conversation List in sidebar
    const renderConvList = () => {
      if (activeSidebarTab === 'people') {
        renderPeopleList();
        return;
      }

      const q = searchInput.value.toLowerCase().trim();
      const assistantSpace = { id: 'TOOLBOX_ASSISTANT', name: 'Toolbox Assistant', description: 'Ask about tools, files, code, math, or research' };
      const allSpaces = [assistantSpace, ...listJoinedSpaces().filter(space => space.id !== assistantSpace.id)];
      const filtered = allSpaces.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));

      if (filtered.length === 0) {
        convList.innerHTML = `
          <div style="padding:20px 16px; text-align:center; color:var(--text-muted); font-size:0.8rem;">
            ${allSpaces.length === 0 ? 'No conversations yet.<br>Click <strong>New</strong> or <strong>People</strong> to begin.' : 'No conversations found.'}
          </div>
        `;
        return;
      }

      convList.innerHTML = filtered.map(s => {
        const isCurrent = s.id === currentRoomCode;
        const isAssistantSpace = s.id === 'TOOLBOX_ASSISTANT';
        const initials = isAssistantSpace ? 'AI' : (s.name || s.id).slice(0, 2).toUpperCase();
        return `
          <button type="button" class="msg-conv-item ${isCurrent ? 'is-active' : ''}" data-code="${escapeHtml(s.id)}">
            <div class="msg-conv-avatar ${isAssistantSpace ? 'is-assistant' : ''}">${escapeHtml(initials)}</div>
            <div class="msg-conv-meta">
              <div class="msg-conv-name-row">
                <span class="msg-conv-name">${escapeHtml(s.name || 'Conversation ' + s.id)}</span>
                <span class="msg-conv-code">${escapeHtml(s.id)}</span>
              </div>
              <span class="msg-conv-snippet">${escapeHtml(s.description || 'Active channel')}</span>
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

    // Render rich messages in stream (including Polls, Chess & Files)
    const renderMessages = () => {
      const msgs = engine.chat ? engine.chat.toArray() : [];
      const myId = engine.user.id;
      const myProfile = getMyProfile();

      if (!msgs.length) {
        stream.innerHTML = `
          <div class="msg-stream-placeholder">
            <div class="msg-empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h4 style="margin:0 0 6px; font-weight:700; color:var(--text);">Start of conversation</h4>
            <p style="margin:0; font-size:0.84rem; color:var(--text-muted); max-width:360px;">Send a message, file, poll, or start a chess game in <strong>${escapeHtml(engine.spaceName || currentRoomCode || '')}</strong>.</p>
          </div>
        `;
        return;
      }

      let lastDate = null;
      let html = '';

      msgs.forEach((m, idx) => {
        const msgDate = formatDate(m.time);
        if (msgDate !== lastDate) {
          html += `<div class="msg-date-separator"><span>${escapeHtml(msgDate)}</span></div>`;
          lastDate = msgDate;
        }

        const isSelf = m.from === myId;
        const isAssistant = m.from === 'bot_assistant';
        const initial = (m.name || 'A').slice(0, 1).toUpperCase();
        const authorColor = isAssistant ? 'var(--accent)' : (m.color || 'var(--accent)');

        // 1. Render Poll Card
        let pollHtml = '';
        if (m.type === 'poll' && m.poll) {
          const totalVotes = m.poll.options.reduce((acc, opt) => acc + (opt.votes ? opt.votes.length : 0), 0);
          pollHtml = `
            <div class="msg-poll-card" data-msg-idx="${idx}">
              <div class="msg-poll-title">${escapeHtml(m.poll.question)}</div>
              <div class="msg-poll-options">
                ${m.poll.options.map(opt => {
                  const votesCount = opt.votes ? opt.votes.length : 0;
                  const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                  const hasVoted = opt.votes && opt.votes.includes(myId);
                  return `
                    <button type="button" class="msg-poll-option ${hasVoted ? 'voted' : ''}" data-opt-id="${opt.id}">
                      <div class="msg-poll-bar" style="width: ${pct}%;"></div>
                      <span class="msg-poll-opt-text">${escapeHtml(opt.text)}</span>
                      <span class="msg-poll-opt-votes">${votesCount} (${pct}%)</span>
                    </button>
                  `;
                }).join('')}
              </div>
              <div class="msg-poll-footer">
                <span>${totalVotes} total vote${totalVotes === 1 ? '' : 's'}</span>
                <span>Click option to vote</span>
              </div>
            </div>
          `;
        }

        // 2. Render Chess Game Card
        let chessHtml = '';
        if (m.type === 'chess' && m.chess) {
          const game = m.chess;
          const board = game.board || INITIAL_CHESS_BOARD;
          const isWhiteTurn = game.turn === 'w';
          const isWhitePlayer = game.white?.id === myId;
          const isBlackPlayer = game.black?.id === myId;
          const isMyTurn = (isWhiteTurn && isWhitePlayer) || (!isWhiteTurn && isBlackPlayer);

          let statusText = 'White to move';
          if (!game.black) {
            statusText = 'Waiting for opponent';
          } else {
            statusText = isWhiteTurn ? `White (${game.white?.name || 'P1'}) to move` : `Black (${game.black?.name || 'P2'}) to move`;
          }

          chessHtml = `
            <div class="msg-chess-card" data-msg-idx="${idx}">
              <div class="msg-chess-header">
                <span class="msg-chess-title">Chess Match</span>
                <span class="msg-chess-status">${escapeHtml(statusText)}</span>
              </div>
              <div class="msg-chess-board" data-msg-idx="${idx}">
                ${board.map((row, r) => row.map((cell, c) => {
                  const isDark = (r + c) % 2 === 1;
                  const pieceChar = CHESS_PIECES_UNICODE[cell] || '';
                  const isSelected = selectedChessSquare && selectedChessSquare.msgIdx === idx && selectedChessSquare.r === r && selectedChessSquare.c === c;
                  return `
                    <div class="msg-chess-square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}" data-r="${r}" data-c="${c}">
                      ${pieceChar}
                    </div>
                  `;
                }).join('')).join('')}
              </div>
              <div class="msg-chess-actions">
                ${!game.black && !isWhitePlayer ? `
                  <button type="button" class="btn btn-primary btn-sm msg-chess-join-btn" data-msg-idx="${idx}">Join as Black</button>
                ` : `
                  <span style="font-size:0.72rem; color:var(--text-muted);">${isMyTurn ? 'Your turn to move' : 'Opponent thinking'}</span>
                `}
                <button type="button" class="btn btn-secondary btn-sm msg-chess-reset-btn" data-msg-idx="${idx}" style="font-size:0.7rem; padding:2px 8px;">Reset Board</button>
              </div>
            </div>
          `;
        }

        // 3. Render File Attachment Card
        let fileHtml = '';
        if (m.attachment) {
          const att = m.attachment;
          const isImage = att.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name);
          fileHtml = `
            <div class="msg-file-wrapper" data-msg-idx="${idx}">
              ${isImage && att.data ? `
                <img src="${escapeHtml(att.data)}" class="msg-file-card-img" alt="${escapeHtml(att.name)}" />
              ` : ''}
              <div class="msg-file-card">
                <div class="msg-file-icon">
                  ${getFileTypeIcon(att.name, detectFileCategory(att.name), 20)}
                </div>
                <div class="msg-file-info">
                  <div class="msg-file-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</div>
                  <div class="msg-file-size">${formatBytes(att.size)}</div>
                </div>
                <div class="msg-file-actions">
                  <button type="button" class="msg-file-action-btn msg-file-dl-btn" data-name="${escapeHtml(att.name)}" data-idx="${idx}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                  <button type="button" class="msg-file-action-btn msg-file-save-btn" data-name="${escapeHtml(att.name)}" data-idx="${idx}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save
                  </button>
                </div>
              </div>
            </div>
          `;
        }

        html += `
          <div class="msg-row ${isSelf ? 'is-self' : ''}">
            ${!isSelf ? `
              <div class="msg-bubble-avatar" style="background:${authorColor};">${escapeHtml(initial)}</div>
            ` : ''}
            <div class="msg-bubble-wrap">
              <div class="msg-bubble-header">
                <span class="msg-bubble-author" style="color:${authorColor};">
                  ${escapeHtml(m.name || 'Member')}
                  ${isAssistant ? '<span class="msg-assistant-tag">AI</span>' : ''}
                </span>
                <time class="msg-bubble-time">${escapeHtml(formatTime(m.time))}</time>
              </div>
              ${m.text ? `<div class="msg-bubble-body">${renderMessageContent(m.text)}</div>` : ''}
              ${fileHtml}
              ${pollHtml}
              ${chessHtml}
              ${isSelf ? `<div class="msg-bubble-status">Delivered</div>` : ''}
            </div>
          </div>
        `;
      });

      stream.innerHTML = html;
      stream.scrollTop = stream.scrollHeight;

      // Wire File Action Buttons
      stream.querySelectorAll('.msg-file-dl-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const msg = msgs[idx];
          if (!msg || !msg.attachment) return;
          const att = msg.attachment;
          const a = document.createElement('a');
          a.href = att.data || ('data:text/plain;charset=utf-8,' + encodeURIComponent(att.text || ''));
          a.download = att.name || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
      });

      stream.querySelectorAll('.msg-file-save-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const msg = msgs[idx];
          if (!msg || !msg.attachment) return;
          const att = msg.attachment;
          try {
            await saveArtifactFile({
              name: att.name,
              content: att.data || att.text || '',
              kind: detectFileCategory(att.name),
              from: 'messaging'
            });
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!`;
            btn.style.color = 'var(--success, #10b981)';
          } catch (err) {
            tbAlert(err.message, 'Save Error');
          }
        });
      });

      // Wire Poll Voting
      stream.querySelectorAll('.msg-poll-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('.msg-poll-card');
          const msgIdx = parseInt(card.dataset.msgIdx, 10);
          const optId = parseInt(btn.dataset.optId, 10);
          const msg = msgs[msgIdx];
          if (!msg || !msg.poll || !engine.chat) return;

          // Clone poll and update vote
          const poll = JSON.parse(JSON.stringify(msg.poll));
          poll.options.forEach(opt => {
            opt.votes = opt.votes || [];
            opt.votes = opt.votes.filter(v => v !== myId);
            if (opt.id === optId) {
              opt.votes.push(myId);
            }
          });

          // Transact update on CRDT array
          engine.doc?.transact(() => {
            const updated = { ...msg, poll };
            engine.chat.delete(msgIdx, 1);
            engine.chat.insert(msgIdx, [updated]);
          });
        });
      });

      // Wire Chess Moves and Actions
      stream.querySelectorAll('.msg-chess-join-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const msgIdx = parseInt(btn.dataset.msgIdx, 10);
          const msg = msgs[msgIdx];
          if (!msg || !msg.chess || !engine.chat) return;
          const chess = JSON.parse(JSON.stringify(msg.chess));
          chess.black = { id: myId, name: myProfile.name || 'Player 2' };
          engine.doc?.transact(() => {
            engine.chat.delete(msgIdx, 1);
            engine.chat.insert(msgIdx, [{ ...msg, chess }]);
          });
        });
      });

      stream.querySelectorAll('.msg-chess-reset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const msgIdx = parseInt(btn.dataset.msgIdx, 10);
          const msg = msgs[msgIdx];
          if (!msg || !msg.chess || !engine.chat) return;
          const chess = {
            id: 'chess_' + Date.now(),
            board: INITIAL_CHESS_BOARD,
            turn: 'w',
            white: { id: myId, name: myProfile.name || 'Player 1' },
            black: null,
            history: []
          };
          engine.doc?.transact(() => {
            engine.chat.delete(msgIdx, 1);
            engine.chat.insert(msgIdx, [{ ...msg, chess }]);
          });
        });
      });

      stream.querySelectorAll('.msg-chess-square').forEach(sq => {
        sq.addEventListener('click', () => {
          const card = sq.closest('.msg-chess-card');
          const msgIdx = parseInt(card.dataset.msgIdx, 10);
          const r = parseInt(sq.dataset.r, 10);
          const c = parseInt(sq.dataset.c, 10);
          const msg = msgs[msgIdx];
          if (!msg || !msg.chess || !engine.chat) return;

          const game = msg.chess;
          const board = JSON.parse(JSON.stringify(game.board || INITIAL_CHESS_BOARD));
          const clickedPiece = board[r][c];

          // If a square was already selected
          if (selectedChessSquare && selectedChessSquare.msgIdx === msgIdx) {
            const fromR = selectedChessSquare.r;
            const fromC = selectedChessSquare.c;
            const movingPiece = board[fromR][fromC];

            // If clicked destination is different square
            if (fromR !== r || fromC !== c) {
              board[r][c] = movingPiece;
              board[fromR][fromC] = '';
              const nextTurn = game.turn === 'w' ? 'b' : 'w';
              const nextGame = { ...game, board, turn: nextTurn };
              selectedChessSquare = null;

              engine.doc?.transact(() => {
                engine.chat.delete(msgIdx, 1);
                engine.chat.insert(msgIdx, [{ ...msg, chess: nextGame }]);
              });
              return;
            } else {
              selectedChessSquare = null;
              renderMessages();
              return;
            }
          }

          // Selecting a piece
          if (clickedPiece) {
            selectedChessSquare = { msgIdx, r, c };
            renderMessages();
          }
        });
      });
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
        statusPill.className = 'msg-status-pill';
      }
    };

    // Update typing indicator
    const updateTyping = () => {
      const typingMembers = [];
      const online = engine.onlineMembers;
      for (const m of online.values()) {
        if (!m.isSelf && m.typing) {
          typingMembers.push(m.name || 'Someone');
        }
      }

      if (typingMembers.length > 0) {
        typingBar.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="msg-typing-dots"><span></span><span></span><span></span></div>
            <span>${escapeHtml(typingMembers.join(', '))} is typing…</span>
          </div>
        `;
      } else {
        typingBar.innerHTML = '';
      }
    };

    const showStream = () => {
      stream.style.display = 'flex';
      chatHeader.style.display = 'flex';
      composerWrap.style.display = 'block';
      discoverView.style.display = 'none';
    };

    // Full Directory & Profile View
    const showDiscover = () => {
      stream.style.display = 'none';
      chatHeader.style.display = 'none';
      composerWrap.style.display = 'none';
      discoverView.style.display = 'block';
      
      const myProfile = getMyProfile();
      const publics = getPublicProfiles();

      discoverView.innerHTML = `
        <div style="max-width:680px; margin:0 auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="font-weight:700; margin:0; font-size:1.4rem; color:var(--text);">User Directory &amp; Profile</h2>
            <button type="button" class="btn btn-secondary btn-sm" id="prof-back-chat">Back to Chat</button>
          </div>

          <!-- My Profile Card -->
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:20px; margin-bottom:30px; box-shadow:var(--shadow-xs);">
            <div style="font-size:0.76rem; text-transform:uppercase; font-weight:700; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:12px;">My Account Profile</div>
            <div style="display:flex; gap:16px; align-items:center;">
              <div style="width:54px; height:54px; border-radius:50%; background:var(--accent); color:var(--accent-contrast, #ffffff); display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:700; flex-shrink:0;">${escapeHtml(myProfile.avatar || 'ME')}</div>
              <div style="flex:1;">
                <input type="text" id="prof-name" class="tool-input" value="${escapeHtml(myProfile.name)}" style="font-size:1.05rem; font-weight:700; margin-bottom:6px; width:100%;" placeholder="Display Name">
                <input type="text" id="prof-username" class="tool-input" value="${escapeHtml(myProfile.username)}" style="font-size:0.84rem; color:var(--text-muted); width:100%;" placeholder="username">
              </div>
            </div>
            <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
              <input type="text" id="prof-affiliation" class="tool-input" value="${escapeHtml(myProfile.affiliation)}" placeholder="Role / Affiliation" style="flex:1; min-width:160px;">
              <input type="text" id="prof-bio" class="tool-input" value="${escapeHtml(myProfile.bio)}" placeholder="Status message or bio" style="flex:2; min-width:220px;">
              <button class="btn btn-primary" id="prof-save-btn">Save Profile</button>
            </div>
          </div>

          <!-- Organization Directory Search -->
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px;">
            <h3 style="font-weight:700; font-size:1.1rem; color:var(--text); margin:0;">Colleague Directory</h3>
            <span style="font-size:0.75rem; color:var(--text-muted);">${publics.length} registered members</span>
          </div>

          <div style="margin-bottom:16px;">
            <input type="text" id="prof-dir-search" class="tool-input" placeholder="Filter colleagues by name, @username, or role…" style="width:100%;">
          </div>

          <div id="prof-dir-results" style="display:flex; flex-direction:column; gap:10px;">
          </div>
        </div>
      `;

      const dirResultsContainer = discoverView.querySelector('#prof-dir-results');
      const dirSearchInput = discoverView.querySelector('#prof-dir-search');

      const renderDirResults = () => {
        const query = dirSearchInput.value.trim();
        const matches = searchPublicProfiles(query);
        dirResultsContainer.innerHTML = matches.map(p => `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 18px; display:flex; gap:16px; align-items:center; box-shadow:var(--shadow-xs);">
            <div style="width:42px; height:42px; border-radius:50%; background:var(--surface-secondary); color:var(--accent); display:flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0;">${escapeHtml(p.avatar || p.name.slice(0, 2).toUpperCase())}</div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:0.92rem; color:var(--text);">${escapeHtml(p.name)} <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">@${escapeHtml(p.username)}</span></div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(p.affiliation || '')}</div>
              ${p.bio ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${escapeHtml(p.bio)}</div>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm msg-dir-chat-btn" data-username="${escapeHtml(p.username)}" data-name="${escapeHtml(p.name)}">Message</button>
          </div>
        `).join('');

        dirResultsContainer.querySelectorAll('.msg-dir-chat-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            const name = btn.dataset.name;
            const dmCode = getDmRoomCode(myProfile.username, username);
            connectToRoom(dmCode, `Chat with ${name}`);
            if (window.innerWidth <= 768) {
              sidebar.classList.add('mobile-collapsed');
            }
          });
        });
      };

      renderDirResults();
      dirSearchInput.addEventListener('input', renderDirResults);

      discoverView.querySelector('#prof-back-chat').addEventListener('click', showStream);

      discoverView.querySelector('#prof-save-btn').addEventListener('click', () => {
        updateMyProfile({
          name: discoverView.querySelector('#prof-name').value,
          username: discoverView.querySelector('#prof-username').value,
          affiliation: discoverView.querySelector('#prof-affiliation').value,
          bio: discoverView.querySelector('#prof-bio').value
        });
        tbAlert('Your profile has been updated.', 'Profile Saved');
      });
    };

    // Connect to room code
    const connectToRoom = async (code, customTitle = '') => {
      showStream();
      if (!code) return;
      currentRoomCode = code.toUpperCase();
      renderConvList();

      engine.leave();
      engine = new SpaceEngine();

      const profile = getMyProfile();
      const displayName = profile.name || 'Member';

      engine.on('chat-update', renderMessages);
      engine.on('peer-update', () => {
        updateHeader();
        updateTyping();
      });
      engine.on('members-update', updateHeader);
      engine.on('connected', updateHeader);
      engine.on('disconnected', updateHeader);

      try {
        await engine.join(currentRoomCode, displayName);
        if (customTitle && engine.metadata) {
          engine.metadata.set('spaceName', customTitle);
        }
        saveJoinedSpace({
          id: currentRoomCode,
          name: customTitle || engine.spaceName,
          description: customTitle ? 'Direct Conversation' : 'Group Channel',
          role: 'member'
        });
      } catch (err) {
        console.error('Failed to join room', err);
      }

      updateHeader();
      renderConvList();
      composerInput.focus();
    };

    // Start New Conversation or Group Dialog
    const handleNewConversation = async () => {
      const choice = await tbConfirm('Would you like to create a Group Conversation or start a 1:1 Direct Chat?', {
        title: 'New Conversation',
        okLabel: 'Group Conversation',
        cancelLabel: 'Find Colleague'
      });

      if (!choice) {
        // User chose Find Colleague -> switch to people tab
        activeSidebarTab = 'people';
        tabBtnPeople.classList.add('is-active');
        tabBtnChats.classList.remove('is-active');
        searchInput.focus();
        renderConvList();
        return;
      }

      // Group conversation creation
      const name = await tbPrompt('Enter a name for this Group Conversation:', {
        title: 'New Group Conversation',
        placeholder: 'e.g. Engineering Squad, Sprint Planning, Design Review'
      });

      if (name && name.trim()) {
        const profile = getMyProfile();
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

        const newCode = await engine.create({
          spaceName: name.trim(),
          description: 'Group Conversation',
          displayName
        });

        currentRoomCode = newCode;
        activeSidebarTab = 'chats';
        tabBtnChats.classList.add('is-active');
        tabBtnPeople.classList.remove('is-active');
        updateHeader();
        renderConvList();
        showStream();
        composerInput.focus();
      }
    };

    // Join with Code
    const handleJoinWithCode = async () => {
      const code = await tbPrompt('Enter the 6-character room code or DM channel:', {
        title: 'Join Conversation',
        placeholder: 'e.g. AB12CD or DM_ALICE_BOB'
      });
      if (code && code.trim()) {
        connectToRoom(code.trim().toUpperCase());
      }
    };

    // Handle Poll Creation
    const handleCreatePoll = async () => {
      if (!engine.chat) {
        tbAlert('Please connect to a conversation before creating a poll.', 'Messaging');
        return;
      }
      const question = await tbPrompt('What is the poll question?', {
        title: 'Create Poll',
        placeholder: 'e.g. Which design direction do you prefer?'
      });
      if (!question || !question.trim()) return;

      const opt1 = await tbPrompt('Enter Option 1:', { title: 'Poll Option 1', placeholder: 'Option A' });
      if (!opt1 || !opt1.trim()) return;

      const opt2 = await tbPrompt('Enter Option 2:', { title: 'Poll Option 2', placeholder: 'Option B' });
      if (!opt2 || !opt2.trim()) return;

      const myProfile = getMyProfile();
      const pollMessage = {
        id: 'poll_' + Date.now(),
        from: engine.user.id,
        name: myProfile.name || engine.displayName,
        color: engine.user.color,
        time: Date.now(),
        type: 'poll',
        text: `📊 Created a poll: "${question.trim()}"`,
        poll: {
          id: 'p_' + Date.now(),
          question: question.trim(),
          options: [
            { id: 0, text: opt1.trim(), votes: [] },
            { id: 1, text: opt2.trim(), votes: [] }
          ]
        }
      };

      engine.chat.push([pollMessage]);
    };

    // Handle Chess Creation
    const handleStartChess = async () => {
      if (!engine.chat) {
        tbAlert('Please connect to a conversation before starting a game.', 'Messaging');
        return;
      }
      const myProfile = getMyProfile();
      const chessMessage = {
        id: 'chess_' + Date.now(),
        from: engine.user.id,
        name: myProfile.name || engine.displayName,
        color: engine.user.color,
        time: Date.now(),
        type: 'chess',
        text: '♟ Started a chess match!',
        chess: {
          id: 'ch_' + Date.now(),
          board: INITIAL_CHESS_BOARD,
          turn: 'w',
          white: { id: engine.user.id, name: myProfile.name || 'White' },
          black: null,
          history: []
        }
      };

      engine.chat.push([chessMessage]);
    };

    // Send Message / Slash Commands
    const handleSendMessage = async (e) => {
      if (e) e.preventDefault();
      const text = composerInput.value.trim();
      if (!text && !pendingAttachment) return;

      if (!engine.chat) {
        tbAlert('Please select or create a conversation first.', 'Messaging');
        return;
      }

      const myProfile = getMyProfile();

      // Check for Slash Commands
      if (text.startsWith('/poll')) {
        composerInput.value = '';
        handleCreatePoll();
        return;
      }
      if (text.startsWith('/chess')) {
        composerInput.value = '';
        handleStartChess();
        return;
      }

      const isAssistantConversation = currentRoomCode === 'TOOLBOX_ASSISTANT';
      const isAskingAssistant = isAssistantConversation || text.startsWith('@assistant') || text.startsWith('/ai');
      const cleanPrompt = isAskingAssistant ? text.replace(/^(@assistant|\/ai)\s*/i, '').trim() : '';

      const msg = {
        id: 'msg_' + Date.now() + Math.random().toString(36).substring(2, 6),
        from: engine.user.id,
        name: myProfile.name || engine.displayName,
        color: engine.user.color,
        text,
        time: Date.now(),
        attachment: pendingAttachment ? { ...pendingAttachment } : null
      };

      engine.chat.push([msg]);

      composerInput.value = '';
      composerInput.style.height = 'auto';
      pendingAttachment = null;
      attachmentBar.style.display = 'none';

      // Reset typing status
      if (engine.provider) {
        engine.provider.awareness.setLocalStateField('user', {
          ...engine.user,
          name: engine.displayName,
          typing: false
        });
      }

      // If user addressed the Assistant, fetch and push AI response
      if (isAskingAssistant && cleanPrompt) {
        typingBar.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="msg-typing-dots"><span></span><span></span><span></span></div>
            <span>Toolbox Assistant is thinking…</span>
          </div>
        `;

        try {
          let assistantReply = '';
          await generateIntelligentResponse(cleanPrompt, {
            onToken: (token) => { assistantReply += token; }
          });

          if (!assistantReply) {
            assistantReply = 'I am here to assist with calculations, code, diagrams, and files in Toolbox.';
          }

          const botMsg = {
            id: 'ast_' + Date.now(),
            from: 'bot_assistant',
            name: 'Toolbox Assistant',
            color: 'var(--accent)',
            text: assistantReply,
            time: Date.now()
          };
          engine.chat.push([botMsg]);
        } catch (err) {
          const errReply = {
            id: 'ast_' + Date.now(),
            from: 'bot_assistant',
            name: 'Toolbox Assistant',
            color: 'var(--accent)',
            text: `I encountered an issue connecting to AI services: ${err.message || 'Check network or API settings'}.`,
            time: Date.now()
          };
          engine.chat.push([errReply]);
        } finally {
          typingBar.innerHTML = '';
        }
      }
    };

    // Auto-resize composer textarea & Broadcast Typing Status
    let typingTimer = null;
    composerInput.addEventListener('input', () => {
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + 'px';

      if (engine.provider) {
        engine.provider.awareness.setLocalStateField('user', {
          ...engine.user,
          name: engine.displayName,
          typing: true
        });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          if (engine.provider) {
            engine.provider.awareness.setLocalStateField('user', {
              ...engine.user,
              name: engine.displayName,
              typing: false
            });
          }
        }, 2000);
      }
    });

    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    composerForm.addEventListener('submit', handleSendMessage);

    // Attach File
    attachBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');

      reader.onload = (evt) => {
        pendingAttachment = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: evt.target.result // Data URL or text
        };
        attachmentName.textContent = `${file.name} (${formatBytes(file.size)})`;
        attachmentBar.style.display = 'flex';
      };

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }
    });

    attachmentRemove.addEventListener('click', () => {
      pendingAttachment = null;
      fileInput.value = '';
      attachmentBar.style.display = 'none';
    });

    // Action buttons in composer
    pollBtn.addEventListener('click', handleCreatePoll);
    chessBtn.addEventListener('click', handleStartChess);
    astBtn.addEventListener('click', () => {
      composerInput.value = '@assistant ' + composerInput.value;
      composerInput.focus();
    });

    // Copy Code Button
    codeBtn.addEventListener('click', async () => {
      if (!currentRoomCode) return;
      try {
        await navigator.clipboard.writeText(currentRoomCode);
        const orig = codeText.textContent;
        codeText.textContent = 'Copied!';
        setTimeout(() => { codeText.textContent = orig; }, 1500);
      } catch {
        tbAlert(`Conversation code: ${currentRoomCode}`, 'Conversation Code');
      }
    });

    // Search Tabs (Chats / People)
    tabBtnChats.addEventListener('click', () => {
      activeSidebarTab = 'chats';
      tabBtnChats.classList.add('is-active');
      tabBtnPeople.classList.remove('is-active');
      renderConvList();
    });

    tabBtnPeople.addEventListener('click', () => {
      activeSidebarTab = 'people';
      tabBtnPeople.classList.add('is-active');
      tabBtnChats.classList.remove('is-active');
      renderConvList();
    });

    // Live search input
    searchInput.addEventListener('input', () => {
      renderConvList();
    });

    // Back Button (Mobile)
    backBtn.addEventListener('click', () => {
      sidebar.classList.remove('mobile-collapsed');
    });

    newBtn.addEventListener('click', handleNewConversation);
    joinBtn.addEventListener('click', handleJoinWithCode);
    discoverBtn.addEventListener('click', () => {
      showDiscover();
      if (window.innerWidth <= 768) {
        sidebar.classList.add('mobile-collapsed');
      }
    });

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

  getContextMenu() {
    return [
      { label: 'New Conversation', action: () => document.getElementById('msg-new-btn')?.click() },
      { label: 'Join with Code', action: () => document.getElementById('msg-join-btn')?.click() }
    ];
  },

  destroy() {
    if (typeof this._unmount === 'function') {
      this._unmount();
    }
    this._unmount = null;
    this._lastMsgCount = undefined;
  }
};
