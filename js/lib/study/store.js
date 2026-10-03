/* ============================================================
   Study — storage and progress

   Sessions and their context files live in this browser
   (IndexedDB), one database per Toolbox account, so files of any
   size stay on the device. A session holds its quizzes, every
   answer given, and the live (Assistant) quiz conversation.

   session = { id, title, createdAt, updatedAt, mode: 'mcq'|'live',
               files: [{ id, name, type, size, chars }],
               quizzes: [quiz], live: { turns: [...], asked, correct } }
   quiz    = { id, title, createdAt, prompt, difficulty,
               questions: [{ id, q, choices[], answer, explanation, topic }],
               answers: { [qid]: { choice, correct, at } }, finishedAt }
   file text is stored apart from the session ({ id, sessionId, text }).
   ============================================================ */

const VERSION = 1;
const uid = (p = 's') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function open(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' }).createIndex('session', 'sessionId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
const result = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export function createStudyStore(accountId = 'local') {
  let dbp = null;
  const db = () => (dbp ||= open(`toolbox_study_${String(accountId).replace(/[^a-zA-Z0-9_-]/g, '')}`));
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

  return {
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    uid,

    async list() {
      const d = await db();
      const all = await result(d.transaction('sessions').objectStore('sessions').getAll());
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) { const d = await db(); return result(d.transaction('sessions').objectStore('sessions').get(id)); },

    async save(session, { quiet = false } = {}) {
      session.updatedAt = Date.now();
      const d = await db();
      const tx = d.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(session);
      await done(tx);
      if (!quiet) emit();
      return session;
    },

    blank(title = 'New session') {
      const now = Date.now();
      return { id: uid('ses'), title, createdAt: now, updatedAt: now, mode: 'mcq', files: [], quizzes: [], live: { turns: [], asked: 0, correct: 0 } };
    },

    async remove(id) {
      const d = await db();
      const tx = d.transaction(['sessions', 'files'], 'readwrite');
      tx.objectStore('sessions').delete(id);
      const idx = tx.objectStore('files').index('session');
      const keys = await result(idx.getAllKeys(id));
      keys.forEach(k => tx.objectStore('files').delete(k));
      await done(tx);
      emit();
    },

    async addFile(session, { name, type, size, text }) {
      const meta = { id: uid('f'), name, type, size, chars: text.length };
      const d = await db();
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').put({ id: meta.id, sessionId: session.id, text });
      await done(tx);
      session.files = [...(session.files || []), meta];
      await this.save(session);
      return meta;
    },
    async removeFile(session, fileId) {
      const d = await db();
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').delete(fileId);
      await done(tx);
      session.files = (session.files || []).filter(f => f.id !== fileId);
      await this.save(session);
    },
    async fileTexts(session) {
      const d = await db();
      const store = d.transaction('files').objectStore('files');
      const rows = await Promise.all((session.files || []).map(f => result(store.get(f.id))));
      return (session.files || []).map((f, i) => ({ ...f, text: rows[i]?.text || '' }));
    },
  };
}

/* ---------- progress ---------- */

const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Everything the progress page shows, worked out from the sessions themselves. */
export function progressOf(sessions, now = Date.now()) {
  let answered = 0, correct = 0, quizzes = 0, finished = 0;
  const days = new Map();
  const topics = new Map();
  const perSession = [];
  const bump = (at, ok) => { const k = dayKey(at); const d = days.get(k) || { n: 0, ok: 0 }; d.n++; if (ok) d.ok++; days.set(k, d); };
  for (const s of sessions) {
    let sa = 0, sc = 0;
    for (const qz of s.quizzes || []) {
      quizzes++;
      if (qz.finishedAt) finished++;
      for (const q of qz.questions || []) {
        const a = qz.answers?.[q.id];
        if (!a) continue;
        answered++; sa++;
        if (a.correct) { correct++; sc++; }
        bump(a.at || qz.createdAt, a.correct);
        const t = (q.topic || '').trim();
        if (t) { const r = topics.get(t) || { topic: t, n: 0, ok: 0 }; r.n++; if (a.correct) r.ok++; topics.set(t, r); }
      }
    }
    for (const turn of [...(s.live?.archived || []), ...(s.live?.turns || [])]) {
      if (turn.role !== 'grade' || turn.correct == null) continue;
      answered++; sa++;
      if (turn.correct) { correct++; sc++; }
      bump(turn.at || s.updatedAt, turn.correct);
      const t = (turn.topic || '').trim();
      if (t) { const r = topics.get(t) || { topic: t, n: 0, ok: 0 }; r.n++; if (turn.correct) r.ok++; topics.set(t, r); }
    }
    if (sa) perSession.push({ id: s.id, title: s.title, answered: sa, correct: sc, updatedAt: s.updatedAt });
  }
  // Streak: consecutive days with at least one answer, ending today or yesterday.
  let streak = 0;
  for (let i = 0; ; i++) {
    const k = dayKey(now - i * 86400000);
    if (days.has(k)) streak++;
    else if (i > 0 || streak) break;
    if (i > 400) break;
  }
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const t = now - (29 - i) * 86400000;
    const d = days.get(dayKey(t)) || { n: 0, ok: 0 };
    return { day: dayKey(t), n: d.n, ok: d.ok };
  });
  const weak = [...topics.values()].filter(t => t.n >= 2).map(t => ({ ...t, rate: t.ok / t.n })).sort((a, b) => a.rate - b.rate || b.n - a.n).slice(0, 5);
  return {
    sessions: sessions.length, quizzes, finished, answered, correct,
    accuracy: answered ? correct / answered : null,
    streak, last30, weak,
    recent: perSession.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
  };
}
