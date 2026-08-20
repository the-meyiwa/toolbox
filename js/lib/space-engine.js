/* ============================================================
   Spaces — real-time collaboration rooms
   ============================================================ */

let yjsPromise = null;
let ywebrtcPromise = null;

function loadYjs() {
  yjsPromise ??= import('yjs');
  return yjsPromise;
}

function loadYWebRTC() {
  ywebrtcPromise ??= import('y-webrtc');
  return ywebrtcPromise;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

export class SpaceEngine {
  constructor() {
    this.doc = null;
    this.provider = null;
    this.roomCode = null;
    this.displayName = null;
    this.isHost = false;
    this._listeners = new Map();
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  async _initDoc(roomCode, displayName) {
    const Y = await loadYjs();
    const { WebrtcProvider } = await loadYWebRTC();
    
    this.roomCode = roomCode;
    this.displayName = displayName;
    
    this.doc = new Y.Doc();
    const roomName = `toolbox-space-${roomCode}`;
    
    this.provider = new WebrtcProvider(roomName, this.doc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com', 'wss://y-webrtc-signaling-us.herokuapp.com']
    });

    const awareness = this.provider.awareness;
    awareness.setLocalStateField('user', {
      name: displayName,
      color: this.color,
      joinedAt: Date.now()
    });

    awareness.on('change', () => {
      this._emit('peer-update');
    });
    
    this.provider.on('status', event => {
      if (event.status === 'connected') {
        this._emit('connected');
      } else if (event.status === 'disconnected') {
        this._emit('disconnected');
      }
    });

    this.chat.observe(() => this._emit('chat-update'));
    this.polls.observe(() => this._emit('poll-update'));
    this.notepad.observe(() => this._emit('notepad-update'));
  }

  async create({ spaceName, displayName, isPublic }) {
    this.isHost = true;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await this._initDoc(roomCode, displayName);
    
    const meta = this.doc.getMap('metadata');
    meta.set('spaceName', spaceName);
    meta.set('isPublic', isPublic);
    meta.set('createdAt', Date.now());
    
    return roomCode;
  }

  async join({ roomCode, displayName }) {
    this.isHost = false;
    await this._initDoc(roomCode.toUpperCase(), displayName);
  }

  leave() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.roomCode = null;
    this._emit('disconnected');
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  off(event, fn) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(fn);
    }
  }

  _emit(event, data) {
    if (this._listeners.has(event)) {
      for (const fn of this._listeners.get(event)) {
        fn(data);
      }
    }
  }

  get participants() {
    if (!this.provider) return new Map();
    const states = this.provider.awareness.getStates();
    const map = new Map();
    for (const [clientId, state] of states.entries()) {
      if (state.user) {
        map.set(clientId, {
          name: state.user.name,
          color: state.user.color,
          joinedAt: state.user.joinedAt,
          isSelf: clientId === this.provider.awareness.clientID,
          typing: state.user.typing
        });
      }
    }
    return map;
  }

  get chat() {
    return this.doc?.getArray('chat');
  }

  get polls() {
    return this.doc?.getMap('polls');
  }

  get notepad() {
    return this.doc?.getText('notepad');
  }

  get spaceName() {
    return this.doc?.getMap('metadata').get('spaceName') || 'Untitled Space';
  }

  sendChat(text) {
    if (!text.trim() || !this.chat) return;
    this.chat.push([{
      id: crypto.randomUUID(),
      from: this.provider.awareness.clientID,
      name: this.displayName,
      text: text.trim(),
      time: Date.now()
    }]);
  }
  
  setTyping(isTyping) {
    if (!this.provider) return;
    this.provider.awareness.setLocalStateField('user', {
      ...this.provider.awareness.getLocalState().user,
      typing: isTyping
    });
  }

  createPoll(question, options) {
    if (!this.polls) return;
    const pollId = crypto.randomUUID();
    this.polls.set(pollId, {
      question,
      options,
      votes: {},
      createdBy: this.displayName
    });
  }

  votePoll(pollId, optionIndex) {
    if (!this.polls) return;
    const poll = this.polls.get(pollId);
    if (!poll) return;
    
    const updated = JSON.parse(JSON.stringify(poll));
    updated.votes[this.provider.awareness.clientID] = optionIndex;
    this.polls.set(pollId, updated);
  }
}
