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

    container.innerHTML = `
      <style>
        .mail-app { display: flex; height: 100%; font-family: var(--font-sans); color: var(--text); background: var(--bg); overflow: hidden; position: relative; }
        
        /* Sidebar */
        .mail-sidebar { width: 240px; border-right: 1px solid var(--border); background: var(--bg-subtle); display: flex; flex-direction: column; transition: transform 0.2s ease; z-index: 120; }
        .mail-sidebar-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .mail-nav { flex: 1; overflow-y: auto; padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; }
        .mail-nav-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .mail-nav-item:hover { background: var(--bg-card); color: var(--text); }
        .mail-nav-item.active { background: var(--text); color: var(--bg); font-weight: 600; }
        
        .btn-compose { background: var(--accent, #3b82f6); color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 600; font-size: 0.9rem; cursor: pointer; margin-bottom: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-compose:hover { opacity: 0.9; }

        /* Main List */
        .mail-list-pane { width: 320px; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--bg-card); }
        .mail-list-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; }
        .mail-search-bar { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-subtle); font-size: 0.85rem; outline: none; color: var(--text); }
        .mail-list { flex: 1; overflow-y: auto; }
        .mail-item { padding: 14px 16px; border-bottom: 1px solid var(--border); cursor: pointer; position: relative; }
        .mail-item:hover { background: var(--bg-subtle); }
        .mail-item.selected { background: var(--bg-subtle); border-left: 3px solid var(--accent, #3b82f6); }
        .mail-item.unread { font-weight: 700; }
        .mail-item.unread::after { content: ''; position: absolute; left: 8px; top: 20px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent, #3b82f6); }
        .mail-item-sender { font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
        .mail-item-date { font-size: 0.7rem; color: var(--text-muted); font-weight: 400; }
        .mail-item-subject { font-size: 0.85rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mail-item-snippet { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 400; }

        /* Reading Pane */
        .mail-reading-pane { flex: 1; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
        .mail-read-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.9rem; }
        .mail-read-header { padding: 20px 24px; border-bottom: 1px solid var(--border); }
        .mail-read-subject { font-size: 1.25rem; font-weight: 700; margin: 0 0 16px 0; }
        .mail-read-meta { display: flex; justify-content: space-between; align-items: flex-start; }
        .mail-read-sender { font-size: 0.9rem; font-weight: 600; }
        .mail-read-email { font-size: 0.8rem; color: var(--text-muted); font-weight: 400; }
        .mail-read-date { font-size: 0.8rem; color: var(--text-muted); }
        .mail-read-actions { margin-top: 16px; display: flex; gap: 8px; }
        .mail-action-btn { background: var(--bg-subtle); border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; color: var(--text); }
        .mail-action-btn:hover { background: var(--bg-card); }
        .mail-read-body { padding: 24px; flex: 1; overflow-y: auto; font-size: 0.95rem; line-height: 1.5; }

        /* Compose Window */
        .mail-compose-modal { position: absolute; bottom: 0; right: 24px; width: 400px; height: 500px; max-height: calc(100% - 16px); background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px 12px 0 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.15); display: flex; flex-direction: column; z-index: 150; transition: transform 0.2s ease; transform: translateY(100%); }
        .mail-compose-modal.open { transform: translateY(0); }
        .mail-compose-header { padding: 12px 16px; background: var(--bg-subtle); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0; font-weight: 600; font-size: 0.9rem; }
        .mail-compose-close { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; }
        .mail-compose-field { border-bottom: 1px solid var(--border); padding: 8px 16px; display: flex; align-items: center; }
        .mail-compose-label { width: 50px; font-size: 0.85rem; color: var(--text-muted); }
        .mail-compose-input { flex: 1; border: none; background: transparent; font-size: 0.9rem; color: var(--text); outline: none; }
        .mail-compose-body { flex: 1; padding: 16px; border: none; background: transparent; font-size: 0.95rem; color: var(--text); outline: none; resize: none; font-family: inherit; }
        .mail-compose-footer { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }

        /* Mobile Layout */
        .mobile-header-toggle { display: none; background: none; border: none; color: var(--text); cursor: pointer; padding: 8px; }
        @media (max-width: 768px) {
          .mail-app { flex-direction: column; }
          .mail-sidebar { position: absolute; top: 0; bottom: 0; left: 0; transform: translateX(-100%); width: 260px; box-shadow: 4px 0 16px rgba(0,0,0,0.1); }
          .mail-sidebar.open { transform: translateX(0); }
          .mail-list-pane { width: 100%; flex: 1; border-right: none; }
          .mobile-header-toggle { display: block; }
          .mail-reading-pane { position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 130; transform: translateX(100%); transition: transform 0.2s ease; }
          .mail-reading-pane.open { transform: translateX(0); }
          .mail-compose-modal { right: 0; width: 100%; height: 100%; border-radius: 0; bottom: 0; }
          .mail-compose-header { border-radius: 0; }
        }
      </style>

      <div class="mail-app">
        <div class="mail-sidebar" id="mail-sidebar">
          <div class="mail-sidebar-header">
            <h3 style="margin:0; font-size:1.1rem;">Mailbox</h3>
            <button type="button" class="mobile-header-toggle" id="mail-sidebar-close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
          <div class="mail-nav" id="mail-nav">
            <button type="button" class="btn-compose" id="mail-btn-compose">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Compose
            </button>
            <div class="mail-nav-item active" data-folder="inbox">Inbox</div>
            <div class="mail-nav-item" data-folder="sent">Sent</div>
            <div class="mail-nav-item" data-folder="drafts">Drafts</div>
            <div class="mail-nav-item" data-folder="archive">Archive</div>
            <div class="mail-nav-item" data-folder="trash">Trash</div>
          </div>
        </div>

        <div class="mail-list-pane">
          <div class="mail-list-header">
            <div style="display:flex; align-items:center; gap:12px;">
              <button type="button" class="mobile-header-toggle" id="mail-sidebar-open"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
              <h3 id="mail-folder-title" style="margin:0; font-size:1.1rem; text-transform: capitalize;">Inbox</h3>
            </div>
            <input type="text" id="mail-search" class="mail-search-bar" placeholder="Search mail...">
          </div>
          <div class="mail-list" id="mail-list"></div>
        </div>

        <div class="mail-reading-pane" id="mail-reading-pane">
          <!-- Content injected here -->
          <div class="mail-read-empty">Select a message to read</div>
        </div>

        <!-- Compose Modal -->
        <div class="mail-compose-modal" id="mail-compose-modal">
          <div class="mail-compose-header">
            <span>New Message</span>
            <button type="button" class="mail-compose-close" id="mail-compose-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
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
            <button type="button" class="mail-action-btn" id="mail-compose-discard">Discard</button>
            <button type="button" class="btn-compose" id="mail-compose-send" style="margin:0; width:auto; padding:8px 20px;">Send</button>
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
    
    pane.innerHTML = `
      <div class="mail-read-header">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button type="button" class="mobile-header-toggle" id="mail-read-back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button>
          <h2 class="mail-read-subject" style="margin:0;">${msg.subject || '(No subject)'}</h2>
        </div>
        <div class="mail-read-meta">
          <div>
            <div class="mail-read-sender">${msg.from.name} <span class="mail-read-email">&lt;${msg.from.email}&gt;</span></div>
            <div class="mail-read-email" style="margin-top:2px;">to ${msg.to.map(t=>t.name).join(', ')}</div>
          </div>
          <div class="mail-read-date">${dateStr}</div>
        </div>
        <div class="mail-read-actions">
          <button type="button" class="mail-action-btn action-reply">Reply</button>
          <button type="button" class="mail-action-btn action-archive">Archive</button>
          <button type="button" class="mail-action-btn action-delete">Delete</button>
        </div>
      </div>
      <div class="mail-read-body">
        ${msg.body}
      </div>
    `;
  },

  openCompose(initialData = { to: '', subject: '', body: '' }) {
    this.container.querySelector('#mail-compose-to').value = initialData.to;
    this.container.querySelector('#mail-compose-subject').value = initialData.subject;
    this.container.querySelector('#mail-compose-body').value = initialData.body;
    this.container.querySelector('#mail-compose-modal').classList.add('open');
  }
};
