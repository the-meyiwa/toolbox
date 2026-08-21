/* ============================================================
   Spaces Engine — Real-time collaboration core.

   "Local by default. Shared by intention."
   Built on WebRTC DataChannels + Yjs CRDTs. Data synchronizes
   peer-to-peer across members without requiring a central database.
   ============================================================ */

let yjsPromise = null;
let ywebrtcPromise = null;

export function loadYjs() {
  yjsPromise ??= import('yjs');
  return yjsPromise;
}

export function loadYWebRTC() {
  ywebrtcPromise ??= import('y-webrtc');
  return ywebrtcPromise;
}

export function prewarmSignaling() {
  try {
    fetch('https://toolbox-signaling.onrender.com/health', { mode: 'no-cors' }).catch(() => {});
  } catch { /* ignore */ }
}

// Prefetch in background during idle time so click interactions are instantaneous (<16ms INP)
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      loadYjs();
      loadYWebRTC();
      prewarmSignaling();
    }, { timeout: 3000 });
  } else {
    setTimeout(() => {
      loadYjs();
      loadYWebRTC();
      prewarmSignaling();
    }, 1500);
  }
}

const COLORS = [
  '#000000', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0891b2', '#4f46e5', '#ea580c'
];

const SPACES_KEY = 'toolbox.spaces.v1';
const USER_KEY = 'toolbox.user_profile.v1';

/* ---------------- User Profile ---------------- */

export function getUserProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (raw && raw.name) return raw;
  } catch { /* ignore */ }

  const defaultUser = {
    id: 'u_' + Math.random().toString(36).slice(2, 10),
    name: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultUser));
  } catch { /* ignore */ }
  return defaultUser;
}

export function saveUserProfile(patch) {
  const current = getUserProfile();
  const updated = { ...current, ...patch };
  if (!updated.color) {
    updated.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

/* ---------------- Local Spaces Registry ---------------- */

export function listJoinedSpaces() {
  try {
    const raw = localStorage.getItem(SPACES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getJoinedSpace(code) {
  const upper = code.toUpperCase();
  return listJoinedSpaces().find(s => s.id === upper) || null;
}

export function saveJoinedSpace(summary) {
  try {
    const list = listJoinedSpaces();
    const upper = summary.id.toUpperCase();
    const existingIdx = list.findIndex(s => s.id === upper);
    const item = {
      id: upper,
      name: summary.name || 'Space ' + upper,
      description: summary.description || '',
      role: summary.role || 'member',
      lastActive: Date.now(),
      isPublic: summary.isPublic ?? true,
      ownerName: summary.ownerName || '',
    };
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...item };
    } else {
      list.unshift(item);
    }
    localStorage.setItem(SPACES_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save space bookmark', err);
  }
}

export function removeJoinedSpace(code) {
  try {
    const upper = code.toUpperCase();
    const list = listJoinedSpaces().filter(s => s.id !== upper);
    localStorage.setItem(SPACES_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

/* ---------------- Space Engine Class ---------------- */

export class SpaceEngine {
  constructor() {
    this.doc = null;
    this.provider = null;
    this.roomCode = null;
    this.displayName = '';
    this.user = getUserProfile();
    this.role = 'member'; // 'owner' | 'admin' | 'member' | 'viewer'
    this._listeners = new Map();
    this._observers = [];
  }

  async _initDoc(roomCode, displayName, initialRole = 'member') {
    const Y = await loadYjs();
    const { WebrtcProvider } = await loadYWebRTC();

    this.roomCode = roomCode.toUpperCase();
    this.displayName = displayName.trim() || 'Anonymous';
    this.role = initialRole;

    // Update user profile
    this.user = saveUserProfile({ name: this.displayName });

    this.doc = new Y.Doc();
    const roomName = `toolbox-space-${this.roomCode}`;

    // All peers must connect to the exact same dedicated signaling server on Render
    this.provider = new WebrtcProvider(roomName, this.doc, {
      signaling: ['wss://toolbox-signaling.onrender.com'],
      peerOpts: {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      },
      maxConns: 30,
      filterBcConns: true,
    });

    const awareness = this.provider.awareness;
    awareness.setLocalStateField('user', {
      id: this.user.id,
      name: this.displayName,
      color: this.user.color,
      role: this.role,
      joinedAt: Date.now(),
      typing: false,
    });

    awareness.on('change', () => {
      this._updateMembersMap();
      this._emit('peer-update');
      this._emit('members-update');
    });

    this.provider.on('status', event => {
      if (event.status === 'connected') {
        this._emit('connected');
      } else if (event.status === 'disconnected') {
        this._emit('disconnected');
      }
    });

    this.provider.on('synced', () => {
      this._emit('sync-update');
      this._emit('meta-update');
      this._emit('peer-update');
      this._emit('chat-update');
      this._emit('tasks-update');
      this._emit('artifacts-update');
      this._emit('activity-update');
    });

    // When remote CRDT updates arrive over WebRTC, trigger all relevant UI updates
    this.doc.on('update', () => {
      const name = this.metadata?.get('spaceName');
      if (name) {
        saveJoinedSpace({
          id: this.roomCode,
          name,
          description: this.spaceDescription,
          role: this.role,
        });
      }
      this._emit('meta-update');
      this._emit('chat-update');
      this._emit('artifacts-update');
      this._emit('files-update');
      this._emit('tasks-update');
      this._emit('poll-update');
      this._emit('challenges-update');
      this._emit('activity-update');
      this._emit('notepad-update');
      this._emit('members-update');
    });

    // Wire CRDT observers
    this._wireObserver(this.chat, 'chat-update');
    this._wireObserver(this.polls, 'poll-update');
    this._wireObserver(this.artifacts, 'artifacts-update');
    this._wireObserver(this.files, 'files-update');
    this._wireObserver(this.tasks, 'tasks-update');
    this._wireObserver(this.challenges, 'challenges-update');
    this._wireObserver(this.activity, 'activity-update');
    this._wireObserver(this.metadata, 'meta-update');
    this._wireObserver(this.members, 'members-update');
    this._wireObserver(this.notepad, 'notepad-update');

    // Register into local persistence
    saveJoinedSpace({
      id: this.roomCode,
      name: this.spaceName,
      description: this.spaceDescription,
      role: this.role,
      joinedAt: Date.now(),
      isPublic: this.isPublic,
    });
  }

  _wireObserver(target, eventName) {
    if (!target) return;
    const obs = () => this._emit(eventName);
    target.observe(obs);
    this._observers.push({ target, obs });
  }

  _updateMembersMap() {
    if (!this.provider || !this.doc) return;
    const states = this.provider.awareness.getStates();
    const membersMap = this.doc.getMap('members');
    for (const [, state] of states.entries()) {
      if (state.user?.id) {
        membersMap.set(state.user.id, {
          id: state.user.id,
          name: state.user.name,
          color: state.user.color,
          role: state.user.role || 'member',
          lastSeen: Date.now(),
        });
      }
    }
  }

  /* --------------- Lifecycle --------------- */

  async create({ spaceName, description = '', displayName, isPublic = true }) {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await this._initDoc(roomCode, displayName, 'owner');

    const meta = this.doc.getMap('metadata');
    meta.set('spaceName', spaceName.trim() || 'Untitled Space');
    meta.set('description', description.trim());
    meta.set('isPublic', isPublic);
    meta.set('createdAt', Date.now());
    meta.set('createdBy', this.displayName);
    meta.set('ownerId', this.user.id);
    meta.set('pinnedItemIds', []);

    this.addActivity('space_created', `created the space "${spaceName}"`);

    saveJoinedSpace({
      id: roomCode,
      name: spaceName,
      description,
      role: 'owner',
      joinedAt: Date.now(),
      isPublic,
      ownerName: this.displayName,
    });

    return roomCode;
  }

  async join({ roomCode, displayName }) {
    const code = roomCode.trim().toUpperCase();
    const existing = getJoinedSpace(code);
    const role = existing ? existing.role : 'member';
    await this._initDoc(code, displayName, role);

    this.addActivity('member_joined', `${displayName} joined the space`);

    // Sync saved space name
    setTimeout(() => {
      saveJoinedSpace({
        id: code,
        name: this.spaceName,
        description: this.spaceDescription,
        role: this.role,
        isPublic: this.isPublic,
      });
    }, 1000);
  }

  leave() {
    this.addActivity('member_left', `${this.displayName} left the session`);
    for (const { target, obs } of this._observers) {
      try { target.unobserve(obs); } catch { /* ignore */ }
    }
    this._observers = [];
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

  /* --------------- Event system --------------- */

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
        try { fn(data); } catch (err) { console.error('Space listener error', err); }
      }
    }
  }

  /* --------------- State Getters --------------- */

  get metadata() { return this.doc?.getMap('metadata'); }
  get members() { return this.doc?.getMap('members'); }
  get activity() { return this.doc?.getArray('activity'); }
  get artifacts() { return this.doc?.getMap('artifacts'); }
  get files() { return this.doc?.getMap('files'); }
  get tasks() { return this.doc?.getMap('tasks'); }
  get challenges() { return this.doc?.getMap('challenges'); }
  get chat() { return this.doc?.getArray('chat'); }
  get polls() { return this.doc?.getMap('polls'); }
  get notepad() { return this.doc?.getText('notepad'); }

  get spaceName() {
    const metaName = this.metadata?.get('spaceName');
    if (metaName && typeof metaName === 'string' && metaName.trim()) return metaName.trim();
    const saved = getJoinedSpace(this.roomCode);
    if (saved && saved.name) return saved.name;
    return this.roomCode ? `Space ${this.roomCode}` : 'Space Desk';
  }
  get spaceDescription() { return this.metadata?.get('description') || ''; }
  get isPublic() { return this.metadata?.get('isPublic') ?? true; }
  get ownerId() { return this.metadata?.get('ownerId') || ''; }
  get isOwner() { return this.role === 'owner' || this.ownerId === this.user.id; }
  get isAdmin() { return this.isOwner || this.role === 'admin'; }
  get canEdit() { return this.role !== 'viewer'; }

  get onlineMembers() {
    if (!this.provider) return new Map();
    const states = this.provider.awareness.getStates();
    const map = new Map();
    for (const [clientId, state] of states.entries()) {
      if (state.user) {
        map.set(clientId, {
          clientId,
          id: state.user.id,
          name: state.user.name,
          color: state.user.color,
          role: state.user.role,
          joinedAt: state.user.joinedAt,
          isSelf: state.user.id === this.user.id,
          typing: state.user.typing,
        });
      }
    }
    return map;
  }

  /* --------------- Actions --------------- */

  addActivity(type, text, meta = {}) {
    if (!this.activity) return;
    this.activity.unshift([{
      id: 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type,
      text,
      actorName: this.displayName,
      actorId: this.user.id,
      timestamp: Date.now(),
      meta,
    }]);
  }

  // --- Artifacts & Files ---
  shareArtifact({ name, kind, text, from = '' }) {
    if (!this.artifacts || !this.canEdit) return null;
    const id = 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const item = {
      id,
      name: name || `artifact.${kind || 'txt'}`,
      kind: kind || 'text',
      from: from || '',
      text: text || '',
      size: new Blob([text || '']).size,
      createdBy: this.displayName,
      actorId: this.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    this.artifacts.set(id, item);
    this.addActivity('artifact_shared', `shared "${item.name}" from ${from || 'tool'}`, { kind, artifactId: id });
    return item;
  }

  deleteArtifact(artifactId) {
    if (!this.artifacts || !this.canEdit) return;
    const art = this.artifacts.get(artifactId);
    if (art) {
      this.artifacts.delete(artifactId);
      this.addActivity('artifact_deleted', `removed "${art.name}"`);
    }
  }

  shareFile({ name, type, size, data }) {
    if (!this.files || !this.canEdit) return null;
    const id = 'file_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const item = {
      id,
      name,
      type,
      size,
      data,
      createdBy: this.displayName,
      actorId: this.user.id,
      createdAt: Date.now(),
    };
    this.files.set(id, item);
    this.addActivity('file_shared', `shared file "${name}"`, { fileId: id });
    return item;
  }

  deleteFile(fileId) {
    if (!this.files || !this.canEdit) return;
    const f = this.files.get(fileId);
    if (f) {
      this.files.delete(fileId);
      this.addActivity('file_deleted', `removed file "${f.name}"`);
    }
  }

  // --- Tasks ---
  createTask({ title, description = '', assignee = '', assigneeName = '', dueDate = null }) {
    if (!this.tasks || !this.canEdit) return;
    const id = 'tsk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const task = {
      id,
      title: title.trim(),
      description: description.trim(),
      assignee,
      assigneeName,
      status: 'todo', // 'todo' | 'doing' | 'done'
      dueDate,
      createdBy: this.displayName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.set(id, task);
    this.addActivity('task_created', `created task "${task.title}"`);
    return task;
  }

  updateTask(taskId, updates) {
    if (!this.tasks || !this.canEdit) return;
    const current = this.tasks.get(taskId);
    if (!current) return;
    const updated = { ...current, ...updates, updatedAt: Date.now() };
    this.tasks.set(taskId, updated);
    if (updates.status && updates.status !== current.status) {
      this.addActivity('task_status', `marked "${current.title}" as ${updates.status}`);
    }
  }

  deleteTask(taskId) {
    if (!this.tasks || !this.canEdit) return;
    const current = this.tasks.get(taskId);
    if (current) {
      this.tasks.delete(taskId);
      this.addActivity('task_deleted', `deleted task "${current.title}"`);
    }
  }

  // --- Challenges ---
  createChallenge({ title, prompt, deadline = null }) {
    if (!this.challenges || !this.canEdit) return;
    const id = 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const challenge = {
      id,
      title: title.trim(),
      prompt: prompt.trim(),
      deadline,
      submissions: {},
      createdBy: this.displayName,
      createdAt: Date.now(),
    };
    this.challenges.set(id, challenge);
    this.addActivity('challenge_created', `started challenge "${title}"`);
    return challenge;
  }

  submitChallenge(challengeId, text) {
    if (!this.challenges || !this.canEdit) return;
    const current = this.challenges.get(challengeId);
    if (!current) return;
    const updated = JSON.parse(JSON.stringify(current));
    updated.submissions[this.user.id] = {
      text: text.trim(),
      userName: this.displayName,
      submittedAt: Date.now(),
    };
    this.challenges.set(challengeId, updated);
    this.addActivity('challenge_submission', `submitted an entry for "${current.title}"`);
  }

  // --- Communication ---
  sendChat(text) {
    if (!text.trim() || !this.chat) return;
    this.chat.push([{
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      from: this.user.id,
      name: this.displayName,
      color: this.user.color,
      text: text.trim(),
      time: Date.now(),
      pinned: false,
    }]);
  }

  togglePinMessage(messageId) {
    if (!this.chat || !this.isAdmin) return;
    const arr = this.chat.toArray();
    const idx = arr.findIndex(m => m.id === messageId);
    if (idx >= 0) {
      const msg = { ...arr[idx], pinned: !arr[idx].pinned };
      this.chat.delete(idx, 1);
      this.chat.insert(idx, [msg]);
    }
  }

  setTyping(isTyping) {
    if (!this.provider) return;
    this.provider.awareness.setLocalStateField('user', {
      ...this.provider.awareness.getLocalState().user,
      typing: isTyping,
    });
  }

  // --- Polls ---
  createPoll(question, options) {
    if (!this.polls || !this.canEdit) return;
    const pollId = 'pol_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.polls.set(pollId, {
      id: pollId,
      question: question.trim(),
      options: options.map(o => o.trim()).filter(Boolean),
      votes: {},
      createdBy: this.displayName,
      createdAt: Date.now(),
    });
    this.addActivity('poll_created', `created poll "${question}"`);
  }

  votePoll(pollId, optionIndex) {
    if (!this.polls) return;
    const poll = this.polls.get(pollId);
    if (!poll) return;
    const updated = JSON.parse(JSON.stringify(poll));
    updated.votes[this.user.id] = optionIndex;
    this.polls.set(pollId, updated);
  }

  // --- Members & Roles ---
  updateMemberRole(targetUserId, newRole) {
    if (!this.isAdmin || !this.members) return;
    const member = this.members.get(targetUserId);
    if (member) {
      this.members.set(targetUserId, { ...member, role: newRole });
      this.addActivity('role_changed', `changed ${member.name}'s role to ${newRole}`);
    }
  }
}
