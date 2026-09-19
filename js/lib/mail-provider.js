/**
 * Mail Provider Abstraction
 * Simulates a real mail service API with local persistence for the demo.
 */

const MOCK_MESSAGES = [
  {
    id: 'm1',
    threadId: 't1',
    folder: 'inbox',
    from: { name: 'Sarah Jenkins', email: 'sarah@example.com' },
    to: [{ name: 'Me', email: 'me@toolbox.local' }],
    subject: 'Project update for Q3',
    snippet: 'Hey, I wanted to share the latest numbers...',
    body: '<p>Hey,</p><p>I wanted to share the latest numbers for Q3. We are up 15% across the board.</p><p>Best,<br>Sarah</p>',
    date: new Date(Date.now() - 3600000).toISOString(),
    unread: true,
    starred: false,
    attachments: []
  },
  {
    id: 'm2',
    threadId: 't2',
    folder: 'inbox',
    from: { name: 'Toolbox Team', email: 'updates@toolbox.local' },
    to: [{ name: 'Me', email: 'me@toolbox.local' }],
    subject: 'Welcome to the Mail Client',
    snippet: 'We are thrilled to have you...',
    body: '<p>Welcome!</p><p>This is a fully functional mail client inside Toolbox. You can compose, reply, and archive.</p>',
    date: new Date(Date.now() - 86400000).toISOString(),
    unread: false,
    starred: true,
    attachments: []
  }
];

export class MailProvider {
  constructor() {
    this._load();
  }

  _load() {
    try {
      const stored = localStorage.getItem('tb_mail_data');
      if (stored) {
        this.messages = JSON.parse(stored);
      } else {
        this.messages = [...MOCK_MESSAGES];
        this._save();
      }
    } catch (e) {
      this.messages = [...MOCK_MESSAGES];
    }
  }

  _save() {
    try {
      localStorage.setItem('tb_mail_data', JSON.stringify(this.messages));
    } catch (e) {}
  }

  async getMessages(folder = 'inbox') {
    await new Promise(r => setTimeout(r, 100)); // Simulate network
    return this.messages.filter(m => m.folder === folder).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async searchMessages(query) {
    await new Promise(r => setTimeout(r, 100));
    const lower = query.toLowerCase();
    return this.messages.filter(m => 
      m.subject.toLowerCase().includes(lower) || 
      m.from.name.toLowerCase().includes(lower) || 
      m.from.email.toLowerCase().includes(lower) ||
      m.body.toLowerCase().includes(lower)
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getMessage(id) {
    await new Promise(r => setTimeout(r, 50));
    return this.messages.find(m => m.id === id);
  }

  async markAsRead(id) {
    const msg = this.messages.find(m => m.id === id);
    if (msg && msg.unread) {
      msg.unread = false;
      this._save();
    }
  }

  async toggleStar(id) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.starred = !msg.starred;
      this._save();
    }
    return msg;
  }

  async moveMessage(id, folder) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      msg.folder = folder;
      this._save();
    }
  }

  async deleteMessage(id) {
    const msg = this.messages.find(m => m.id === id);
    if (msg) {
      if (msg.folder === 'trash') {
        this.messages = this.messages.filter(m => m.id !== id);
      } else {
        msg.folder = 'trash';
      }
      this._save();
    }
  }

  async sendMessage(draft) {
    await new Promise(r => setTimeout(r, 300));
    const newMsg = {
      id: 'm_' + Date.now(),
      threadId: draft.threadId || 't_' + Date.now(),
      folder: 'sent',
      from: { name: 'Me', email: 'me@toolbox.local' },
      to: [{ name: draft.to, email: draft.to }],
      subject: draft.subject,
      snippet: draft.body.substring(0, 50).replace(/<[^>]+>/g, ''),
      body: draft.body,
      date: new Date().toISOString(),
      unread: false,
      starred: false,
      attachments: []
    };
    this.messages.push(newMsg);
    this._save();
    return newMsg;
  }
}

export const mailClient = new MailProvider();
