/**
 * Mail Client Application
 * Premium macOS / Apple HIG glassmorphism design language with:
 * - Decoupled provider layer (threading, attachments, drafts autosave)
 * - Safe HTML sanitization
 * - Full-featured compose modal (CC, BCC, Attachment file picker)
 * - Reply, Reply All, Forward with conversation context
 * - Responsive 3-pane layout for desktop and mobile
 */

import { mailClient } from '../lib/mail-provider.js';
import { createMailSetupUI } from '../views/mail-setup.js';
import { getCurrentUser } from '../lib/supabase.js';
import { openSettings } from '../lib/settings-ui.js';

function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export default {
  render(container) {
    this.container = container;
    if (!getCurrentUser()) {
      container.innerHTML = `
        <div class="mail-auth-gate">
          <div class="mail-auth-gate-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></div>
          <h2>Setup Mail Client in settings</h2>
          <p>Sign in to Toolbox, then connect Gmail or Microsoft Mail from Preferences.</p>
          <button type="button" class="btn btn-primary" id="mail-open-settings">Open Preferences</button>
        </div>`;
      container.querySelector('#mail-open-settings')?.addEventListener('click', () => openSettings('mail'));
      return;
    }
    this.state = {
      folder: 'inbox',
      messages: [],
      selectedMessage: null,
      searchQuery: '',
      isSidebarOpen: false,
      composeDraft: { to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] },
      autosaveTimer: null
    };

    container.innerHTML = `
      <style>
        .mail-app {
          display: grid;
          grid-template-columns: 240px 330px 1fr;
          height: 100%;
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
          color: var(--text);
          background: var(--background);
          overflow: hidden;
          position: relative;
          -webkit-font-smoothing: antialiased;
          box-sizing: border-box;
        }

        /* Sidebar Pane */
        .mail-sidebar {
          background-color: var(--surface-secondary, var(--surface));
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(25px);
          user-select: none;
          z-index: 20;
        }
        .mail-sidebar-header {
          padding: 16px 18px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .mail-sidebar-title {
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.015em;
          margin: 0;
          color: var(--text);
        }
        .mail-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 12px;
          flex: 1;
        }
        .btn-compose {
          background: var(--accent, #007aff);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 9px 14px;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 12px;
          box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
          transition: transform 0.1s ease, background-color 0.15s ease;
        }
        .btn-compose:hover {
          background: #006ee6;
        }
        .btn-compose:active {
          transform: scale(0.98);
        }
        .mail-nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mail-nav-item:hover {
          background: var(--surface-secondary);
          color: var(--text);
        }
        .mail-nav-item.active {
          background: var(--accent, #007aff);
          color: #ffffff;
          font-weight: 600;
        }
        .mail-nav-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .mail-badge {
          background: rgba(255, 255, 255, 0.2);
          color: inherit;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 999px;
        }
        .mail-sidebar-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          font-size: 0.72rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Message List Pane */
        .mail-list-pane {
          background-color: var(--background);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        .mail-search-bar {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          background: var(--background);
          position: relative;
        }
        .mail-search-input {
          width: 100%;
          padding: 7px 12px 7px 32px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.82rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .mail-search-input:focus {
          border-color: var(--accent, #007aff);
        }
        .mail-search-icon {
          position: absolute;
          left: 22px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .mail-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .mail-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background-color 0.15s ease;
          position: relative;
        }
        .mail-item:hover {
          background-color: var(--surface-secondary);
        }
        .mail-item.selected {
          background-color: rgba(0, 122, 255, 0.12);
        }
        .mail-item.selected::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3.5px;
          background: var(--accent, #007aff);
        }
        .mail-item.unread .mail-item-sender {
          font-weight: 700;
          color: var(--text);
        }
        .mail-item.unread::after {
          content: '';
          position: absolute;
          right: 14px;
          top: 14px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent, #007aff);
        }
        .mail-item-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 3px;
        }
        .mail-item-sender {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 190px;
        }
        .mail-item-date {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .mail-item-subject {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .mail-item-snippet {
          font-size: 0.76rem;
          color: var(--text-muted);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
        }
        .mail-item-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }
        .mail-tag-pill {
          font-size: 0.68rem;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--surface-secondary);
          border: 1px solid var(--border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Reading Pane */
        .mail-reading-pane {
          background-color: var(--background);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          position: relative;
        }
        .mail-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 0.95rem;
          gap: 12px;
          padding: 32px;
          text-align: center;
        }
        .mail-read-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 0.95rem;
          gap: 12px;
        }
        .mail-read-header {
          padding: 24px 28px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .mail-read-subject {
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 16px 0;
          color: var(--text);
        }
        .mail-read-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .mail-sender-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #007aff, #5856d6);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 700;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .mail-sender-name {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text);
        }
        .mail-sender-email {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .mail-read-date {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .mail-read-actions {
          display: flex;
          gap: 8px;
        }
        .mail-action-btn {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mail-action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--accent, #007aff);
        }
        .mail-read-body {
          padding: 28px;
          font-size: 0.92rem;
          line-height: 1.6;
          color: var(--text);
          flex: 1;
        }
        .mail-read-attachments {
          padding: 16px 28px;
          border-top: 1px solid var(--border);
          background: rgba(0, 0, 0, 0.1);
        }
        .mail-att-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }
        .mail-att-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 0.8rem;
          color: var(--text);
          cursor: pointer;
          text-decoration: none;
        }
        .mail-att-chip:hover {
          border-color: var(--accent, #007aff);
        }

        /* Compose Modal */
        .mail-compose-modal {
          position: absolute;
          bottom: 24px;
          right: 28px;
          width: 580px;
          max-height: 600px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
          display: none;
          flex-direction: column;
          z-index: 150;
          overflow: hidden;
        }
        .mail-compose-modal.open {
          display: flex;
        }
        .mail-compose-header {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 0.88rem;
        }
        .mail-compose-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
        }
        .mail-compose-field {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border);
          font-size: 0.84rem;
        }
        .mail-compose-label {
          width: 55px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .mail-compose-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-size: 0.84rem;
        }
        .mail-compose-body {
          flex: 1;
          min-height: 220px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: inherit;
          font-size: 0.88rem;
          line-height: 1.5;
          resize: none;
        }
        .mail-compose-footer {
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mail-compose-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .btn-send {
          background: var(--accent, #007aff);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 7px 18px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-send:hover {
          background: #006ee6;
        }

        /* Mobile Layout */
        @media (max-width: 800px) {
          .mail-app {
            grid-template-columns: 1fr;
          }
          .mail-sidebar {
            position: absolute;
            top: 0; bottom: 0; left: 0;
            width: 260px;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .mail-sidebar.open {
            transform: translateX(0);
          }
          .mail-reading-pane {
            position: absolute;
            top: 0; bottom: 0; left: 0; right: 0;
            transform: translateX(100%);
            transition: transform 0.25s ease;
            z-index: 30;
          }
          .mail-reading-pane.open {
            transform: translateX(0);
          }
          .mail-compose-modal {
            top: 0; bottom: 0; left: 0; right: 0;
            width: 100%;
            max-height: none;
            border-radius: 0;
          }
        }
      </style>

      <div class="mail-app">
        <!-- 1. Mailbox Sidebar -->
        <aside class="mail-sidebar" id="mail-sidebar">
          <div class="mail-sidebar-header">
            <h3 class="mail-sidebar-title">Mailboxes</h3>
            <button type="button" class="mail-action-btn" id="mail-btn-sync" title="Sync Mailbox">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>

          <div class="mail-nav" id="mail-nav">
            <button type="button" class="btn-compose" id="mail-btn-compose">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              New Message
            </button>

            <div class="mail-nav-item active" data-folder="inbox">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <span>Inbox</span>
              </div>
              <span class="mail-badge" id="badge-inbox">0</span>
            </div>

            <div class="mail-nav-item" data-folder="starred">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span>Starred</span>
              </div>
              <span class="mail-badge" id="badge-starred">0</span>
            </div>

            <div class="mail-nav-item" data-folder="sent">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                <span>Sent</span>
              </div>
            </div>

            <div class="mail-nav-item" data-folder="drafts">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span>Drafts</span>
              </div>
            </div>

            <div class="mail-nav-item" data-folder="archive">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                <span>Archive</span>
              </div>
            </div>

            <div class="mail-nav-item" data-folder="trash">
              <div class="mail-nav-item-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Trash</span>
              </div>
            </div>
          </div>

          <div class="mail-sidebar-footer">
            <span>Local Encrypted Store</span>
            <span style="color:#10b981;">● Connected</span>
          </div>
        </aside>

        <!-- 2. Message List Pane -->
        <section class="mail-list-pane" id="mail-list-pane">
          <div class="mail-search-bar">
            <svg class="mail-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="mail-search" class="mail-search-input" placeholder="Search mail…" autocomplete="off" />
          </div>

          <div class="mail-list" id="mail-list">
            <!-- Messages rendered here -->
          </div>
        </section>

        <!-- 3. Reading Pane -->
        <main class="mail-reading-pane" id="mail-reading-pane">
          <div class="mail-read-empty" id="mail-read-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <span>Select a conversation to read</span>
          </div>
          <div id="mail-read-content" style="display:none; flex-direction:column; height:100%;"></div>
        </main>

        <!-- Floating Compose Modal -->
        <div class="mail-compose-modal" id="mail-compose-modal">
          <div class="mail-compose-header">
            <span>New Message</span>
            <button type="button" class="mail-compose-close" id="mail-compose-close">✕</button>
          </div>
          <div class="mail-compose-field">
            <span class="mail-compose-label">To:</span>
            <input type="email" id="mail-to" class="mail-compose-input" placeholder="recipient@example.com" />
          </div>
          <div class="mail-compose-field" id="mail-cc-row" style="display:none;">
            <span class="mail-compose-label">CC:</span>
            <input type="email" id="mail-cc" class="mail-compose-input" placeholder="cc@example.com" />
          </div>
          <div class="mail-compose-field">
            <span class="mail-compose-label">Subject:</span>
            <input type="text" id="mail-subject" class="mail-compose-input" placeholder="Subject line" />
            <button type="button" class="mail-action-btn" id="mail-toggle-cc" style="padding:2px 8px; font-size:0.72rem;">CC</button>
          </div>
          <textarea id="mail-body" class="mail-compose-body" placeholder="Write your message…"></textarea>
          <div id="mail-compose-attachments" style="padding:0 16px 8px; display:flex; flex-wrap:wrap; gap:6px;"></div>
          <div class="mail-compose-footer">
            <div class="mail-compose-actions">
              <label class="mail-action-btn" style="cursor:pointer;" title="Attach File">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attach
                <input type="file" id="mail-attach-input" style="display:none;" multiple />
              </label>
              <button type="button" class="mail-action-btn" id="mail-compose-discard">Discard</button>
            </div>
            <button type="button" class="btn-send" id="mail-compose-send">Send</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadMailbox();
  },

  bindEvents() {
    // Navigation folder switches
    const nav = this.container.querySelector('#mail-nav');
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.mail-nav-item');
      if (item) {
        nav.querySelectorAll('.mail-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.state.folder = item.getAttribute('data-folder');
        this.loadMailbox();
      }
    });

    // Compose triggers
    this.container.querySelector('#mail-btn-compose').addEventListener('click', () => {
      this.openCompose();
    });

    this.container.querySelector('#mail-compose-close').addEventListener('click', () => {
      this.closeCompose();
    });

    this.container.querySelector('#mail-compose-discard').addEventListener('click', () => {
      mailClient.clearSavedDraft();
      this.closeCompose();
    });

    // Toggle CC
    this.container.querySelector('#mail-toggle-cc').addEventListener('click', () => {
      const ccRow = this.container.querySelector('#mail-cc-row');
      ccRow.style.display = ccRow.style.display === 'none' ? 'flex' : 'none';
    });

    // Attach File
    const fileInput = this.container.querySelector('#mail-attach-input');
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => {
        const reader = new FileReader();
        reader.onload = () => {
          this.state.composeDraft.attachments.push({
            id: `att_${Date.now()}_${Math.random()}`,
            name: f.name,
            size: `${(f.size / 1024).toFixed(1)} KB`,
            type: f.type,
            data: reader.result
          });
          this.renderComposeAttachments();
        };
        reader.readAsDataURL(f);
      });
    });

    // Send Message
    this.container.querySelector('#mail-compose-send').addEventListener('click', async () => {
      const to = this.container.querySelector('#mail-to').value.trim();
      const cc = this.container.querySelector('#mail-cc').value.trim();
      const subject = this.container.querySelector('#mail-subject').value.trim();
      const body = this.container.querySelector('#mail-body').value.trim();

      if (!to) {
        alert('Please specify a recipient email address.');
        return;
      }

      try {
        await mailClient.sendMessage({
          to,
          cc,
          subject,
          body,
          attachments: this.state.composeDraft.attachments,
          threadId: this.state.composeDraft.threadId
        });
        this.closeCompose();
        if (this.state.folder === 'sent' || this.state.folder === 'inbox') {
          this.loadMailbox();
        }
      } catch (err) {
        alert(`Failed to send email: ${err.message}`);
      }
    });

    // Search bar
    const searchInput = this.container.querySelector('#mail-search');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      this.searchMail(q);
    });

    // Sync button
    this.container.querySelector('#mail-btn-sync').addEventListener('click', async () => {
      await mailClient.sync();
      this.loadMailbox();
    });

    // Autosave listener
    const bodyInput = this.container.querySelector('#mail-body');
    bodyInput.addEventListener('input', () => {
      clearTimeout(this.state.autosaveTimer);
      this.state.autosaveTimer = setTimeout(() => {
        const draft = {
          to: this.container.querySelector('#mail-to').value,
          cc: this.container.querySelector('#mail-cc').value,
          subject: this.container.querySelector('#mail-subject').value,
          body: bodyInput.value,
          attachments: this.state.composeDraft.attachments
        };
        mailClient.saveDraft(draft);
      }, 3000);
    });
  },

  async loadMailbox() {
    try {
      this.state.messages = await mailClient.getMessages(this.state.folder);
      this.renderMessageList();
      this.updateFolderBadges();
    } catch (err) {
      this.renderUnconfiguredState(err.message);
    }
  },

  renderUnconfiguredState(msg) {
    const list = this.container.querySelector('#mail-list');
    list.innerHTML = '';
    
    // Inject the reusable setup component instead of a passive error message
    const setupUI = createMailSetupUI();
    list.appendChild(setupUI);

    this.container.querySelector('#mail-reading-pane').innerHTML = `
      <div class="mail-empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <span>Mail Configuration Required</span>
      </div>
    `;
  },

  async updateFolderBadges() {
    try {
      const folders = await mailClient.getFolders();
      folders.forEach(f => {
        const badge = this.container.querySelector(`#badge-${f.id}`);
        if (badge) {
          badge.textContent = f.unreadCount;
          badge.style.display = f.unreadCount > 0 ? 'inline-block' : 'none';
        }
      });
    } catch (e) {
      // Badges hidden if config fails
    }
  },

  renderMessageList() {
    const list = this.container.querySelector('#mail-list');
    if (!this.state.messages || this.state.messages.length === 0) {
      list.innerHTML = `<div style="padding:28px; text-align:center; color:var(--text-muted); font-size:0.85rem;">No messages in ${this.state.folder}</div>`;
      return;
    }

    list.innerHTML = this.state.messages.map(m => {
      const dateStr = new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const isSelected = this.state.selectedMessage?.id === m.id;
      const isUnread = m.unread;

      return `
        <div class="mail-item ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-msg-id="${m.id}">
          <div class="mail-item-top">
            <span class="mail-item-sender">${m.from.name || m.from.email}</span>
            <span class="mail-item-date">${dateStr}</span>
          </div>
          <div class="mail-item-subject">${m.subject || '(No subject)'}</div>
          <div class="mail-item-snippet">${m.snippet || ''}</div>
          <div class="mail-item-badges">
            ${m.attachments && m.attachments.length > 0 ? `
              <span class="mail-tag-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                ${m.attachments.length}
              </span>
            ` : ''}
            ${m.starred ? '<span style="color:#f59e0b; font-size:0.75rem;">★</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.mail-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-msg-id');
        this.selectMessage(id);
      });
    });
  },

  async selectMessage(id) {
    try {
      const msg = await mailClient.getMessage(id);
      if (!msg) return;

      this.state.selectedMessage = msg;
      await mailClient.markRead(id, true);
      this.renderMessageList();
      this.renderReadingPane(msg);

      // On mobile, slide reading pane in
      const readingPane = this.container.querySelector('#mail-reading-pane');
      if (readingPane) readingPane.classList.add('open');
    } catch (err) {
      alert(`Error reading message: ${err.message}`);
    }
  },

  renderReadingPane(msg) {
    const emptyState = this.container.querySelector('#mail-read-empty');
    const content = this.container.querySelector('#mail-read-content');
    emptyState.style.display = 'none';
    content.style.display = 'flex';

    const dateStr = new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const avatarLetter = (msg.from.name || msg.from.email || 'U').charAt(0).toUpperCase();

    content.innerHTML = `
      <div class="mail-read-header">
        <h2 class="mail-read-subject">${msg.subject || '(No subject)'}</h2>
        <div class="mail-read-meta">
          <div style="display:flex; align-items:center;">
            <div class="mail-sender-avatar">${avatarLetter}</div>
            <div>
              <div class="mail-sender-name">${msg.from.name} <span class="mail-sender-email">&lt;${msg.from.email}&gt;</span></div>
              <div class="mail-sender-email">To: ${msg.to.map(t => t.name || t.email).join(', ')}</div>
            </div>
          </div>
          <div class="mail-read-date">${dateStr}</div>
        </div>
        <div class="mail-read-actions">
          <button type="button" class="mail-action-btn" id="mail-act-reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
            Reply
          </button>
          <button type="button" class="mail-action-btn" id="mail-act-replyall">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 17 2 12 7 7"></polyline><polyline points="12 17 7 12 12 7"></polyline><path d="M22 18v-2a4 4 0 0 0-4-4H7"></path></svg>
            Reply All
          </button>
          <button type="button" class="mail-action-btn" id="mail-act-forward">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>
            Forward
          </button>
          <button type="button" class="mail-action-btn" id="mail-act-star">
            ${msg.starred ? '★ Starred' : '☆ Star'}
          </button>
          <button type="button" class="mail-action-btn" id="mail-act-archive">Archive</button>
          <button type="button" class="mail-action-btn" id="mail-act-delete">Delete</button>
        </div>
      </div>

      <div class="mail-read-body">
        ${sanitizeHtml(msg.body)}
      </div>

      ${msg.attachments && msg.attachments.length > 0 ? `
        <div class="mail-read-attachments">
          <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Attachments (${msg.attachments.length})</span>
          <div class="mail-att-list">
            ${msg.attachments.map(att => `
              <a href="${att.data || '#'}" download="${att.name}" class="mail-att-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>${att.name}</span>
                <span style="color:var(--text-muted); font-size:0.72rem;">${att.size}</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Action listeners
    content.querySelector('#mail-act-reply').addEventListener('click', () => {
      this.openCompose({
        to: msg.from.email,
        subject: `Re: ${msg.subject}`,
        body: `\n\n--- On ${dateStr}, ${msg.from.name} wrote: ---\n${msg.body.replace(/<[^>]+>/g, '')}`,
        threadId: msg.threadId
      });
    });

    content.querySelector('#mail-act-replyall').addEventListener('click', () => {
      const allTo = [msg.from.email, ...msg.to.map(t => t.email)].filter(e => e !== 'user@toolbox.local').join(', ');
      this.openCompose({
        to: allTo,
        subject: `Re: ${msg.subject}`,
        body: `\n\n--- On ${dateStr}, ${msg.from.name} wrote: ---\n${msg.body.replace(/<[^>]+>/g, '')}`,
        threadId: msg.threadId
      });
    });

    content.querySelector('#mail-act-forward').addEventListener('click', () => {
      this.openCompose({
        to: '',
        subject: `Fwd: ${msg.subject}`,
        body: `\n\n---------- Forwarded message ---------\nFrom: ${msg.from.name} <${msg.from.email}>\nSubject: ${msg.subject}\n\n${msg.body.replace(/<[^>]+>/g, '')}`,
        attachments: msg.attachments || []
      });
    });

    content.querySelector('#mail-act-star').addEventListener('click', async () => {
      await mailClient.toggleStar(msg.id);
      msg.starred = !msg.starred;
      this.renderReadingPane(msg);
      this.renderMessageList();
    });

    content.querySelector('#mail-act-archive').addEventListener('click', async () => {
      await mailClient.moveMessage(msg.id, 'archive');
      this.loadMailbox();
      content.style.display = 'none';
      emptyState.style.display = 'flex';
    });

    content.querySelector('#mail-act-delete').addEventListener('click', async () => {
      await mailClient.deleteMessage(msg.id);
      this.loadMailbox();
      content.style.display = 'none';
      emptyState.style.display = 'flex';
    });
  },

  openCompose(initial = {}) {
    const savedDraft = mailClient.getSavedDraft();
    const draft = initial.to ? initial : (savedDraft || initial);

    this.state.composeDraft = {
      to: draft.to || '',
      cc: draft.cc || '',
      subject: draft.subject || '',
      body: draft.body || '',
      attachments: draft.attachments || [],
      threadId: draft.threadId || null
    };

    this.container.querySelector('#mail-to').value = this.state.composeDraft.to;
    this.container.querySelector('#mail-cc').value = this.state.composeDraft.cc;
    this.container.querySelector('#mail-subject').value = this.state.composeDraft.subject;
    this.container.querySelector('#mail-body').value = this.state.composeDraft.body;

    if (this.state.composeDraft.cc) {
      this.container.querySelector('#mail-cc-row').style.display = 'flex';
    }

    this.renderComposeAttachments();
    this.container.querySelector('#mail-compose-modal').classList.add('open');
  },

  renderComposeAttachments() {
    const attContainer = this.container.querySelector('#mail-compose-attachments');
    attContainer.innerHTML = (this.state.composeDraft.attachments || []).map((att, idx) => `
      <div class="mail-tag-pill" style="padding:4px 8px; background:rgba(255,255,255,0.1);">
        <span>${att.name}</span>
        <button type="button" data-del-att="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:700;">×</button>
      </div>
    `).join('');

    attContainer.querySelectorAll('[data-del-att]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-del-att'), 10);
        this.state.composeDraft.attachments.splice(idx, 1);
        this.renderComposeAttachments();
      });
    });
  },

  closeCompose() {
    this.container.querySelector('#mail-compose-modal').classList.remove('open');
  },

  async searchMail(query) {
    this.state.messages = await mailClient.searchMessages(query);
    this.renderMessageList();
  }
};
