import { mailClient } from '../lib/mail-provider.js';

export default {
  render(container) {
    this.container = container;
    this.state = {
      folder: 'inbox',
      messages: [],
      selectedMessage: null,
      isComposing: false,
      composeDraft: { to: '', subject: '', body: '' },
      searchQuery: '',
      isSidebarOpen: false // for mobile
    };

    container.innerHTML = \`
      <style>
        .mail-app { 
          display: grid; 
          grid-template-columns: 240px 320px 1fr; 
          height: 100%; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          color: var(--text); 
          background: var(--bg); 
          overflow: hidden; 
          position: relative; 
          -webkit-font-smoothing: antialiased;
        }
        
        /* Sidebar */
        .mail-sidebar { 
          border-right: 1px solid var(--border); 
          background-color: var(--bg-glass, rgba(255, 255, 255, 0.5));
          backdrop-filter: blur(30px) saturate(190%);
          -webkit-backdrop-filter: blur(30px) saturate(190%);
          display: flex; 
          flex-direction: column; 
          z-index: 120;
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        [data-theme*="night"] .mail-sidebar, [data-theme="dark"] .mail-sidebar, .dark-theme .mail-sidebar {
          background-color: rgba(30, 30, 30, 0.4);
        }
        
        .mail-sidebar-header { 
          padding: 20px 16px 12px; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
        }
        .mail-sidebar-header h3 {
          margin: 0; font-size: 1.15rem; font-weight: 600; letter-spacing: -0.02em;
        }
        .mail-nav { 
          flex: 1; 
          overflow-y: auto; 
          padding: 8px 12px; 
          display: flex; 
          flex-direction: column; 
          gap: 2px; 
        }
        .mail-nav-item { 
          display: flex; 
          align-items: center; 
          gap: 10px;
          padding: 8px 12px; 
          border-radius: 8px; 
          cursor: pointer; 
          color: var(--text); 
          font-size: 0.9rem; 
          font-weight: 500; 
          transition: background-color 0.15s ease;
        }
        .mail-nav-item:hover { 
          background: var(--bg-subtle, rgba(0,0,0,0.05)); 
        }
        .mail-nav-item.active { 
          background: var(--accent, #007aff); 
          color: #fff; 
          font-weight: 600; 
        }
        
        .btn-compose { 
          background: var(--bg-card); 
          color: var(--accent, #007aff); 
          border: 1px solid var(--border); 
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border-radius: 8px; 
          padding: 8px 12px; 
          font-weight: 600; 
          font-size: 0.85rem; 
          cursor: pointer; 
          margin-bottom: 16px; 
          width: 100%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 8px; 
          transition: all 0.2s ease;
        }
        .btn-compose:hover { 
          background: var(--bg-subtle); 
        }

        /* Main List */
        .mail-list-pane { 
          border-right: 1px solid var(--border); 
          display: flex; 
          flex-direction: column; 
          background: var(--bg-card, #fff); 
        }
        .mail-list-header { 
          padding: 16px 16px 12px; 
          border-bottom: 1px solid var(--border); 
          display: flex; 
          flex-direction: column; 
          gap: 12px; 
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 10;
        }
        .mail-search-bar { 
          width: 100%; 
          padding: 8px 12px 8px 32px; 
          border-radius: 8px; 
          border: 1px solid var(--border); 
          background: var(--bg-subtle) url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%238e8e93" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>') no-repeat 10px center;
          font-size: 0.85rem; 
          outline: none; 
          color: var(--text); 
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .mail-search-bar:focus {
          border-color: var(--accent, #007aff);
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
        }
        .mail-list { 
          flex: 1; 
          overflow-y: auto; 
          -webkit-overflow-scrolling: touch;
        }
        .mail-item { 
          padding: 14px 16px 14px 24px; 
          border-bottom: 1px solid var(--border); 
          cursor: pointer; 
          position: relative; 
          transition: background-color 0.1s ease;
        }
        .mail-item:hover { 
          background: var(--bg-subtle, #f9f9f9); 
        }
        .mail-item.selected { 
          background: var(--accent, #007aff); 
          color: #fff;
          border-bottom-color: transparent;
        }
        .mail-item.unread::after { 
          content: ''; 
          position: absolute; 
          left: 8px; 
          top: 20px; 
          width: 8px; 
          height: 8px; 
          border-radius: 50%; 
          background: var(--accent, #007aff); 
        }
        .mail-item.selected.unread::after {
          background: #fff;
        }
        .mail-item-sender { 
          font-size: 0.95rem; 
          font-weight: 600; 
          margin-bottom: 2px; 
          display: flex; 
          justify-content: space-between; 
          align-items: baseline; 
        }
        .mail-item.unread .mail-item-sender { font-weight: 700; }
        .mail-item-date { 
          font-size: 0.75rem; 
          color: var(--text-muted); 
          font-weight: 400; 
        }
        .mail-item.selected .mail-item-date,
        .mail-item.selected .mail-item-snippet,
        .mail-item.selected .mail-item-subject { 
          color: rgba(255,255,255,0.9); 
        }
        .mail-item-subject { 
          font-size: 0.85rem; 
          font-weight: 600; 
          margin-bottom: 4px; 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
        }
        .mail-item-snippet { 
          font-size: 0.85rem; 
          color: var(--text-muted, #8e8e93); 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          font-weight: 400; 
          line-height: 1.4;
        }

        /* Reading Pane */
        .mail-reading-pane { 
          flex: 1; 
          display: flex; 
          flex-direction: column; 
          background: var(--bg); 
          overflow: hidden; 
        }
        .mail-read-empty { 
          flex: 1; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          color: var(--text-muted); 
          font-size: 1rem; 
          font-weight: 500;
        }
        .mail-read-header { 
          padding: 24px 32px 20px; 
          border-bottom: 1px solid var(--border); 
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
        }
        .mail-read-subject { 
          font-size: 1.5rem; 
          font-weight: 700; 
          margin: 0 0 20px 0; 
          letter-spacing: -0.02em;
        }
        .mail-read-meta { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
        }
        .mail-sender-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--accent, #007aff); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600; font-size: 1rem; margin-right: 12px;
          flex-shrink: 0;
        }
        .mail-read-sender { 
          font-size: 0.95rem; 
          font-weight: 600; 
        }
        .mail-read-email { 
          font-size: 0.85rem; 
          color: var(--text-muted); 
          font-weight: 400; 
        }
        .mail-read-date { 
          font-size: 0.85rem; 
          color: var(--text-muted); 
        }
        .mail-read-actions { 
          margin-top: 16px; 
          display: flex; 
          gap: 8px; 
        }
        .mail-action-btn { 
          background: transparent; 
          border: 1px solid var(--border); 
          padding: 6px 14px; 
          border-radius: 6px; 
          font-size: 0.85rem; 
          font-weight: 500;
          cursor: pointer; 
          color: var(--text); 
          display: flex; align-items: center; gap: 6px;
          transition: background-color 0.15s ease;
        }
        .mail-action-btn:hover { 
          background: var(--bg-subtle); 
        }
        .mail-read-body { 
          padding: 32px; 
          flex: 1; 
          overflow-y: auto; 
          font-size: 0.95rem; 
          line-height: 1.6; 
          color: var(--text);
        }

        /* Compose Window */
        .mail-compose-modal { 
          position: absolute; 
          bottom: 0; 
          right: 32px; 
          width: 460px; 
          height: 560px; 
          max-height: calc(100% - 16px); 
          background: var(--bg-glass); 
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border: 1px solid var(--border); 
          border-radius: 12px 12px 0 0; 
          box-shadow: 0 -8px 32px rgba(0,0,0,0.15); 
          display: flex; 
          flex-direction: column; 
          z-index: 150; 
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
          transform: translateY(100%); 
        }
        .mail-compose-modal.open { 
          transform: translateY(0); 
        }
        .mail-compose-header { 
          padding: 12px 16px; 
          background: rgba(0,0,0,0.03); 
          border-bottom: 1px solid var(--border); 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-radius: 12px 12px 0 0; 
          font-weight: 600; 
          font-size: 0.9rem; 
        }
        [data-theme*="night"] .mail-compose-header, [data-theme="dark"] .mail-compose-header {
          background: rgba(255,255,255,0.03);
        }
        .mail-compose-close { 
          background: var(--bg-card); 
          border: 1px solid var(--border); 
          cursor: pointer; 
          color: var(--text-muted); 
          padding: 4px; 
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          transition: color 0.2s, border-color 0.2s;
        }
        .mail-compose-close:hover {
          color: var(--text);
          border-color: var(--text-muted);
        }
        .mail-compose-field { 
          border-bottom: 1px solid var(--border); 
          padding: 10px 16px; 
          display: flex; 
          align-items: center; 
        }
        .mail-compose-label { 
          width: 60px; 
          font-size: 0.85rem; 
          color: var(--text-muted); 
          font-weight: 500;
        }
        .mail-compose-input { 
          flex: 1; 
          border: none; 
          background: transparent; 
          font-size: 0.95rem; 
          color: var(--text); 
          outline: none; 
        }
        .mail-compose-body { 
          flex: 1; 
          padding: 16px; 
          border: none; 
          background: transparent; 
          font-size: 0.95rem; 
          color: var(--text); 
          outline: none; 
          resize: none; 
          font-family: inherit; 
          line-height: 1.5;
        }
        .mail-compose-footer { 
          padding: 12px 16px; 
          border-top: 1px solid var(--border); 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
        }
        .btn-send {
          background: var(--accent, #007aff);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-send:hover { opacity: 0.9; }

        /* Mobile Layout */
        .mobile-header-toggle { 
          display: none; 
          background: none; 
          border: none; 
          color: var(--text); 
          cursor: pointer; 
          padding: 8px; 
        }
        @media (max-width: 800px) {
          .mail-app { 
            display: flex; 
            flex-direction: column; 
          }
          .mail-sidebar { 
            position: absolute; 
            top: 0; bottom: 0; left: 0; 
            transform: translateX(-100%); 
            width: 260px; 
            box-shadow: 4px 0 24px rgba(0,0,0,0.15); 
          }
          .mail-sidebar.open { 
            transform: translateX(0); 
          }
          .mail-list-pane { 
            width: 100%; 
            flex: 1; 
            border-right: none; 
          }
          .mobile-header-toggle { 
            display: block; 
          }
          .mail-reading-pane { 
            position: absolute; 
            top: 0; bottom: 0; left: 0; right: 0; 
            z-index: 130; 
            transform: translateX(100%); 
            transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
          }
          .mail-reading-pane.open { 
            transform: translateX(0); 
          }
          .mail-compose-modal { 
            right: 0; 
            width: 100%; 
            height: 100%; 
            border-radius: 0; 
            bottom: 0; 
            max-height: none;
          }
          .mail-compose-header { 
            border-radius: 0; 
          }
        }
      </style>

      <div class="mail-app">
        <!-- Sidebar -->
        <div class="mail-sidebar" id="mail-sidebar">
          <div class="mail-sidebar-header">
            <h3 style="margin:0; font-size:1.1rem; font-weight:700;">Mail</h3>
            <button type="button" class="mobile-header-toggle" id="mail-sidebar-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="mail-nav" id="mail-nav">
            <button type="button" class="btn-compose" id="mail-btn-compose">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              New Message
            </button>
            <div class="mail-nav-item active" data-folder="inbox">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              Inbox
            </div>
            <div class="mail-nav-item" data-folder="sent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              Sent
            </div>
            <div class="mail-nav-item" data-folder="drafts">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Drafts
            </div>
            <div class="mail-nav-item" data-folder="archive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
              Archive
            </div>
            <div class="mail-nav-item" data-folder="trash">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Trash
            </div>
          </div>
        </div>

        <!-- Message List -->
        <div class="mail-list-pane">
          <div class="mail-list-header">
            <div style="display:flex; align-items:center; gap:12px;">
              <button type="button" class="mobile-header-toggle" id="mail-sidebar-open"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
              <h3 id="mail-folder-title" style="margin:0; font-size:1.25rem; font-weight:700; text-transform: capitalize; letter-spacing: -0.02em;">Inbox</h3>
            </div>
            <input type="text" id="mail-search" class="mail-search-bar" placeholder="Search">
          </div>
          <div class="mail-list" id="mail-list"></div>
        </div>

        <!-- Reading Pane -->
        <div class="mail-reading-pane" id="mail-reading-pane">
          <div class="mail-read-empty">No Message Selected</div>
        </div>

        <!-- Compose Modal -->
        <div class="mail-compose-modal" id="mail-compose-modal">
          <div class="mail-compose-header">
            <span>New Message</span>
            <button type="button" class="mail-compose-close" id="mail-compose-close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="mail-compose-field">
            <span class="mail-compose-label">To:</span>
            <input type="email" id="mail-compose-to" class="mail-compose-input" placeholder="recipient@example.com">
          </div>
          <div class="mail-compose-field">
            <span class="mail-compose-label">Subject:</span>
            <input type="text" id="mail-compose-subject" class="mail-compose-input" placeholder="Subject">
          </div>
          <textarea id="mail-compose-body" class="mail-compose-body" placeholder="Write something..."></textarea>
          <div class="mail-compose-footer">
            <button type="button" class="mail-action-btn" id="mail-compose-discard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button type="button" class="btn-send" id="mail-compose-send">Send</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadMessages();
  },

  bindEvents() {
    this.container.addEventListener('click', async (e) => {
      // Compose open
      if (e.target.closest('#mail-btn-compose')) {
        this.openCompose();
        this.container.querySelector('#mail-sidebar').classList.remove('open');
        return;
      }
      
      // Compose close / discard
      if (e.target.closest('#mail-compose-close') || e.target.closest('#mail-compose-discard')) {
        this.container.querySelector('#mail-compose-modal').classList.remove('open');
        return;
      }
      
      // Compose send
      if (e.target.closest('#mail-compose-send')) {
        const to = this.container.querySelector('#mail-compose-to').value;
        const subject = this.container.querySelector('#mail-compose-subject').value;
        const body = this.container.querySelector('#mail-compose-body').value;
        if (!to) return alert('Please specify a recipient');
        
        await mailClient.sendMessage({ to, subject, body });
        this.container.querySelector('#mail-compose-modal').classList.remove('open');
        if (this.state.folder === 'sent') this.loadMessages();
        return;
      }
      
      // Mobile back button
      if (e.target.closest('#mail-read-back')) {
        this.container.querySelector('#mail-reading-pane').classList.remove('open');
        return;
      }
      
      // Mobile toggles
      if (e.target.closest('#mail-sidebar-open')) {
        this.container.querySelector('#mail-sidebar').classList.add('open');
        return;
      }
      if (e.target.closest('#mail-sidebar-close')) {
        this.container.querySelector('#mail-sidebar').classList.remove('open');
        return;
      }
      
      // Navigation
      const navItem = e.target.closest('.mail-nav-item');
      if (navItem) {
        this.container.querySelectorAll('.mail-nav-item').forEach(el => el.classList.remove('active'));
        navItem.classList.add('active');
        this.state.folder = navItem.getAttribute('data-folder');
        this.container.querySelector('#mail-folder-title').textContent = this.state.folder;
        this.state.selectedMessage = null;
        this.renderReadingPane();
        this.loadMessages();
        this.container.querySelector('#mail-sidebar').classList.remove('open');
        return;
      }
      
      // Message Selection
      const mailItem = e.target.closest('.mail-item');
      if (mailItem) {
        const id = mailItem.getAttribute('data-id');
        this.state.selectedMessage = await mailClient.getMessage(id);
        
        if (this.state.selectedMessage && this.state.selectedMessage.unread) {
          await mailClient.markAsRead(id);
          this.state.selectedMessage.unread = false;
          mailItem.classList.remove('unread');
        }
        
        this.container.querySelectorAll('.mail-item').forEach(el => el.classList.remove('selected'));
        mailItem.classList.add('selected');
        
        this.renderReadingPane();
        this.container.querySelector('#mail-reading-pane').classList.add('open');
        return;
      }
      
      // Reading Pane Actions
      if (this.state.selectedMessage) {
        const id = this.state.selectedMessage.id;
        if (e.target.closest('.action-delete')) {
          await mailClient.deleteMessage(id);
          this.state.selectedMessage = null;
          this.renderReadingPane();
          this.loadMessages();
          return;
        }
        if (e.target.closest('.action-archive')) {
          await mailClient.moveMessage(id, 'archive');
          this.state.selectedMessage = null;
          this.renderReadingPane();
          this.loadMessages();
          return;
        }
        if (e.target.closest('.action-reply')) {
          this.openCompose({
            to: this.state.selectedMessage.from.email,
            subject: 'Re: ' + this.state.selectedMessage.subject,
            body: `\n\n--- Original Message ---\nFrom: ${this.state.selectedMessage.from.name}\nDate: ${new Date(this.state.selectedMessage.date).toLocaleString()}\n\n`
          });
          return;
        }
      }
    });

    // Search
    let searchTimer;
    this.container.querySelector('#mail-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.state.searchQuery = e.target.value.trim();
        this.loadMessages();
      }, 300);
    });
  },

  async loadMessages() {
    let msgs = [];
    if (this.state.searchQuery) {
      msgs = await mailClient.searchMessages(this.state.searchQuery);
    } else {
      msgs = await mailClient.getMessages(this.state.folder);
    }
    
    this.state.messages = msgs;
    this.renderList();
  },

  renderList() {
    const list = this.container.querySelector('#mail-list');
    if (this.state.messages.length === 0) {
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No messages</div>';
      return;
    }
    
    list.innerHTML = this.state.messages.map(m => {
      const date = new Date(m.date);
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const isSelected = this.state.selectedMessage && this.state.selectedMessage.id === m.id;
      return `
        <div class="mail-item ${m.unread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-id="${m.id}">
          <div class="mail-item-sender">
            <span>${m.from.name}</span>
            <span class="mail-item-date">${dateStr}</span>
          </div>
          <div class="mail-item-subject">${m.subject || '(No subject)'}</div>
          <div class="mail-item-snippet">${m.snippet}</div>
        </div>
      `;
    }).join('');
  },

  renderReadingPane() {
    const pane = this.container.querySelector('#mail-reading-pane');
    const msg = this.state.selectedMessage;
    
    if (!msg) {
      pane.innerHTML = '<div class="mail-read-empty">Select a message to read</div>';
      pane.classList.remove('open');
      return;
    }
    
    const dateStr = new Date(msg.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    
    pane.innerHTML = \`
      <div class="mail-read-header">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button type="button" class="mobile-header-toggle" id="mail-read-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <h2 class="mail-read-subject" style="margin:0;">\${msg.subject || '(No subject)'}</h2>
        </div>
        <div class="mail-read-meta">
          <div style="display:flex; align-items:center;">
            <div class="mail-sender-avatar">\${msg.from.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="mail-read-sender">\${msg.from.name} <span class="mail-read-email">&lt;\${msg.from.email}&gt;</span></div>
              <div class="mail-read-email" style="margin-top:2px;">to \${msg.to.map(t=>t.name).join(', ')}</div>
            </div>
          </div>
          <div class="mail-read-date">\${dateStr}</div>
        </div>
        <div class="mail-read-actions">
          <button type="button" class="mail-action-btn action-reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
            Reply
          </button>
          <button type="button" class="mail-action-btn action-archive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
            Archive
          </button>
          <button type="button" class="mail-action-btn action-delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
          </button>
        </div>
      </div>
      <div class="mail-read-body">
        \${msg.body.replace(/\\n/g, '<br>')}
      </div>
    \`;
  },

  openCompose(initialData = { to: '', subject: '', body: '' }) {
    this.container.querySelector('#mail-compose-to').value = initialData.to;
    this.container.querySelector('#mail-compose-subject').value = initialData.subject;
    this.container.querySelector('#mail-compose-body').value = initialData.body;
    this.container.querySelector('#mail-compose-modal').classList.add('open');
  }
};
