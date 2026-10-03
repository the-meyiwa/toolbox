/* ============================================================
   Study — a private tool

   Sessions (workspaces) in a sidebar, each with optional context
   files. Two ways to study in a session:

     Multiple choice   ask the Assistant for a quiz; it is written
                       from your files and animates into view, one
                       question at a time, marked as you go
     Assistant quiz    the Assistant examines you live, one question
                       at a time, marking each answer and adapting

   The landing page is your progress: accuracy, streak, the last 30
   days, weak topics. Study opens to a new session by default
   (Settings → Tools → Study can change that). Ctrl/Cmd+K opens the
   Assistant with this session as context, and it can make quizzes
   here (js/lib/study/assistant.js).

   Motion is transform and opacity only, aimed at 120fps.
   ============================================================ */

import { createStudyStore, progressOf } from '../lib/study/store.js';
import { generateQuiz, examine } from '../lib/study/quiz.js';
import { readNote } from '../lib/study/extract.js';
import { NotesUI } from '../lib/study/notes-ui.js';
import { studyBridge, OPEN_SESSION_KEY } from '../lib/study/assistant.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { getCurrentUser } from '../lib/supabase.js';
import { tbConfirm, tbPrompt } from '../lib/dialog.js';
import { showToast } from '../utils.js';

const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';
const SPRING = 'cubic-bezier(.22, 1, .36, 1)';
// No motion where the person asked for less, or where the page cannot animate at all.
const reduced = () => typeof document === 'undefined' || typeof document.body?.animate !== 'function'
  || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (p, s = 18, w = 1.8) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  cap: '<path d="M3 7.5 12 4l9 3.5-9 3.5z"/><path d="M7 9.3v4.4c0 1.4 2.2 2.8 5 2.8s5-1.4 5-2.8V9.3"/><path d="M21 7.5v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  retry: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const when = (t) => {
  const d = (Date.now() - t) / 86400000;
  if (d < 1 && new Date(t).getDate() === new Date().getDate()) return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d < 7) return new Date(t).toLocaleDateString([], { weekday: 'short' });
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
};
const scoreOf = (qz) => {
  const ids = qz.questions.map(q => q.id);
  const answered = ids.filter(id => qz.answers?.[id]);
  return { answered: answered.length, right: answered.filter(id => qz.answers[id].correct).length, total: ids.length };
};
const sessionScore = (s) => {
  let a = 0, r = 0;
  for (const qz of s.quizzes || []) { const sc = scoreOf(qz); a += sc.answered; r += sc.right; }
  for (const t of [...(s.live?.archived || []), ...(s.live?.turns || [])]) if (t.role === 'grade' && t.correct != null) { a++; if (t.correct) r++; }
  return { answered: a, right: r };
};

/** Elements rise into place, a step apart. */
function cascade(els, { y = 12, step = 56, dur = 420, delay = 0, scale = 1 } = {}) {
  if (reduced()) return [];
  return [...els].filter(Boolean).map((el, i) => el.animate(
    [{ opacity: 0, transform: `translateY(${y}px)${scale !== 1 ? ` scale(${scale})` : ''}` }, { opacity: 1, transform: 'none' }],
    { duration: dur, delay: delay + i * step, easing: GLIDE, fill: 'backwards', tempo: false }));
}

function countUp(el, to, { suffix = '', dur = 600 } = {}) {
  if (!el) return;
  const target = Number(to) || 0;
  if (reduced() || target < 2) { el.textContent = `${target}${suffix}`; return; }
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = `${Math.round(target * (1 - Math.pow(1 - k, 3)))}${suffix}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export default {
  async render(container) {
    this.root = container;
    this.store = createStudyStore(getCurrentUser()?.id || 'local');
    this.prefs = getToolSettings('study');
    this.offPrefs = onToolSettings('study', (p) => { this.prefs = p; this.paintComposerChips(); });
    this.sessions = [];
    this.session = null;
    this.quizId = null;
    this.qIndex = 0;
    this.view = 'session';
    container.innerHTML = `
      <div class="st" data-view="session" data-drawer="closed">
        <aside class="st-side" aria-label="Study sessions">
          <div class="st-side-head">
            <span class="st-mark">${ico(I.cap, 18)}</span><strong>Study</strong>
            <button type="button" class="st-icon" data-act="new" aria-label="New session" title="New session">${ico(I.plus, 18)}</button>
          </div>
          <button type="button" class="st-nav" data-act="progress">${ico(I.chart, 17)}<span>Progress</span></button>
          <p class="st-side-label">Sessions</p>
          <ul class="st-sessions" role="list"></ul>
        </aside>
        <div class="st-scrim" data-act="drawer-close"></div>
        <main class="st-main">
          <header class="st-top">
            <button type="button" class="st-icon st-menu" data-act="drawer" aria-label="Sessions">${ico(I.menu, 19)}</button>
            <div class="st-top-title"></div>
            <div class="st-modes" role="tablist" aria-label="How to study">
              <span class="st-modes-pill" aria-hidden="true"></span>
              <button type="button" role="tab" class="st-mode" data-mode="mcq">${ico(I.list, 16)}<span>Multiple choice</span></button>
              <button type="button" role="tab" class="st-mode" data-mode="live">${ico(I.chat, 16)}<span>Assistant quiz</span></button>
              <button type="button" role="tab" class="st-mode" data-mode="notes">${ico(I.note, 16)}<span>Notes</span></button>
            </div>
          </header>
          <div class="st-view"></div>
        </main>
        <input type="file" class="st-file-input" multiple hidden accept=".pdf,.txt,.md,.markdown,.docx,.pptx,.csv,.json,.html,.htm,.tex,.rtf,.png,.jpg,.jpeg,.webp,.gif,text/*,application/pdf,image/*">
      </div>`;
    this.el = container.querySelector('.st');
    this.viewEl = container.querySelector('.st-view');
    this.listEl = container.querySelector('.st-sessions');
    this.topTitle = container.querySelector('.st-top-title');
    this.fileInput = container.querySelector('.st-file-input');
    this.bind();
    studyBridge.active = this;

    this.sessions = await this.store.list().catch(() => []);
    if (this.dead) return;
    let wanted = null;
    try { wanted = sessionStorage.getItem(OPEN_SESSION_KEY); sessionStorage.removeItem(OPEN_SESSION_KEY); } catch { /* ignore */ }
    const target = wanted && this.sessions.find(s => s.id === wanted);
    if (target) this.openSession(target, { first: true, quiz: target.quizzes.at(-1)?.id });
    else if (this.prefs.openTo === 'progress') this.showProgress({ first: true });
    else if (this.prefs.openTo === 'last' && this.sessions[0]) this.openSession(this.sessions[0], { first: true });
    else this.openSession(this.store.blank(), { first: true });
    this.paintList({ first: true });
  },

  destroy() {
    this.dead = true;
    this.abort?.abort();
    this.offPrefs?.();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    if (studyBridge.active === this) studyBridge.active = null;
  },

  bind() {
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('submit', (e) => { e.preventDefault(); if (e.target.matches('.st-composer')) this.send(); });
    this.el.addEventListener('keydown', (e) => {
      if (e.target.matches('.st-input') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.send(); }
    });
    this.el.addEventListener('input', (e) => {
      if (e.target.matches('.st-input')) this.grow(e.target);
    });
    this.el.addEventListener('change', (e) => {
      if (e.target === this.fileInput) { this.addFiles([...this.fileInput.files]); this.fileInput.value = ''; }
      if (e.target.matches('.st-title-input')) this.rename(e.target.value);
    });
    // Files dropped anywhere on a session become its context.
    let depth = 0;
    const carries = (e) => { const t = [...(e.dataTransfer?.types || [])]; return t.includes('Files') || t.includes('application/toolbox-path'); };
    this.el.addEventListener('dragenter', (e) => { if (this.view !== 'session' || !carries(e)) return; e.preventDefault(); depth++; this.el.classList.add('is-drop'); });
    this.el.addEventListener('dragover', (e) => { if (this.view === 'session' && carries(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.el.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) this.el.classList.remove('is-drop'); });
    this.el.addEventListener('drop', (e) => {
      depth = 0; this.el.classList.remove('is-drop');
      if (this.view !== 'session' || !carries(e)) return;
      e.preventDefault();
      const paths = (e.dataTransfer.getData('application/toolbox-path') || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (paths.length) this.addFromToolboxFiles(paths); else this.addFiles([...e.dataTransfer.files]);
    });
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.placeModePill(true);
    window.addEventListener('resize', this.onResize);
  },

  /* ================= sidebar ================= */

  paintList({ first = false, added = null } = {}) {
    const items = [...this.sessions];
    if (this.session && !items.some(s => s.id === this.session.id)) items.unshift(this.session);
    const before = new Map([...this.listEl.children].map(li => [li.dataset.id, li.getBoundingClientRect().top]));
    this.listEl.innerHTML = items.map(s => {
      const sc = sessionScore(s);
      const draft = !this.sessions.some(x => x.id === s.id);
      return `<li class="st-sess${s.id === this.session?.id && this.view === 'session' ? ' is-on' : ''}${draft ? ' is-draft' : ''}" data-id="${esc(s.id)}">
        <button type="button" class="st-sess-open" data-act="open" title="${esc(s.title)}">
          <span class="st-sess-title">${esc(s.title)}</span>
          <span class="st-sess-meta">${draft ? 'Not started' : `${sc.answered ? `${pct(sc.right / sc.answered)} · ` : ''}${(s.files || []).length ? `${s.files.length} file${s.files.length === 1 ? '' : 's'} · ` : ''}${when(s.updatedAt)}`}</span>
        </button>
        ${draft ? '' : `<span class="st-sess-tools">
          <button type="button" class="st-icon is-sm" data-act="rename" aria-label="Rename ${esc(s.title)}">${ico(I.pen, 14)}</button>
          <button type="button" class="st-icon is-sm" data-act="delete" aria-label="Delete ${esc(s.title)}">${ico(I.trash, 14)}</button>
        </span>`}
      </li>`;
    }).join('') || '<li class="st-sess-empty">Your sessions appear here.</li>';
    if (reduced()) return;
    if (first) { cascade(this.listEl.children, { y: 6, step: 31, delay: 60 }); return; }
    // Rows that moved glide to their new place; a new one slides in from the top.
    for (const li of this.listEl.children) {
      const was = before.get(li.dataset.id);
      if (was == null) { if (li.dataset.id === added || before.size) li.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 370, easing: GLIDE, tempo: false }); continue; }
      const dy = was - li.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 370, easing: GLIDE, tempo: false });
    }
  },

  /** A draft session is saved the first time something happens in it. */
  async commit() {
    const s = this.session;
    if (!s) return;
    const isNew = !this.sessions.some(x => x.id === s.id);
    await this.store.save(s);
    this.sessions = [s, ...this.sessions.filter(x => x.id !== s.id)];
    this.paintList({ added: isNew ? s.id : null });
  },

  async rename(title) {
    const t = String(title || '').trim().slice(0, 80);
    if (!this.session || !t || t === this.session.title) return;
    this.session.title = t;
    await this.commit();
  },

  /* ================= views ================= */

  swapView(html, { dir = 0, first = false } = {}) {
    const old = this.viewEl.firstElementChild;
    const next = document.createElement('div');
    next.className = 'st-viewport';
    next.innerHTML = html;
    if (!old || reduced() || first) { this.viewEl.innerHTML = ''; this.viewEl.appendChild(next); return next; }
    old.classList.add('is-leaving');
    old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${dir * -16}px)` }], { duration: 220, easing: 'ease-in', fill: 'forwards', tempo: false })
      .finished.then(() => old.remove(), () => old.remove());
    this.viewEl.appendChild(next);
    next.animate([{ opacity: 0, transform: `translateX(${dir * 18}px)` }, { opacity: 1, transform: 'none' }], { duration: 370, delay: 60, easing: GLIDE, fill: 'backwards', tempo: false });
    return next;
  },

  closeDrawer() { this.el.dataset.drawer = 'closed'; },

  async showProgress({ first = false } = {}) {
    this.abort?.abort();
    this.view = 'progress';
    this.el.dataset.view = 'progress';
    this.closeDrawer();
    this.topTitle.innerHTML = '<h2 class="st-h">Progress</h2>';
    const p = progressOf(this.sessions);
    const max = Math.max(1, ...p.last30.map(d => d.n));
    const empty = !p.answered;
    const page = this.swapView(`
      <div class="st-prog">
        <header class="st-prog-head">
          <div><h2>${empty ? 'Ready when you are' : 'How you are doing'}</h2>
          <p>${empty ? 'Start a session, add your notes if you have them, and ask for a quiz. Every answer shows up here.' : `${p.answered.toLocaleString()} answers across ${p.sessions} session${p.sessions === 1 ? '' : 's'}.`}</p></div>
          <button type="button" class="st-btn is-ink" data-act="new">${ico(I.plus, 16)}<span>New session</span></button>
        </header>
        <div class="st-stats">
          <div class="st-stat"><strong data-n="${p.accuracy == null ? 0 : Math.round(p.accuracy * 100)}" data-suffix="%">${p.accuracy == null ? '—' : '0%'}</strong><span>Accuracy</span></div>
          <div class="st-stat"><strong data-n="${p.answered}">0</strong><span>Questions answered</span></div>
          <div class="st-stat"><strong data-n="${p.streak}">0</strong><span>Day streak</span></div>
          <div class="st-stat"><strong data-n="${p.finished}">0</strong><span>Quizzes finished</span></div>
        </div>
        <section class="st-panel">
          <h3>Last 30 days</h3>
          <div class="st-days" role="img" aria-label="Questions answered per day, last 30 days">${p.last30.map(d => `<span class="st-day" title="${esc(d.day)}: ${d.n} answered, ${d.ok} right"><i class="st-day-all" style="--h:${(d.n / max).toFixed(3)}"></i><i class="st-day-ok" style="--h:${(d.ok / max).toFixed(3)}"></i></span>`).join('')}</div>
          <p class="st-legend"><span><i class="is-ok"></i>Right</span><span><i></i>Answered</span></p>
        </section>
        <div class="st-cols">
          <section class="st-panel">
            <h3>Topics to work on</h3>
            ${p.weak.length ? `<ul class="st-topics">${p.weak.map(t => `<li><span class="st-topic-name">${esc(t.topic)}</span><span class="st-topic-bar"><i style="--w:${Math.max(0.04, t.rate).toFixed(3)}"></i></span><span class="st-topic-rate">${pct(t.rate)}</span></li>`).join('')}</ul>` : '<p class="st-muted">Answer a few more questions and the topics you find hardest show up here.</p>'}
          </section>
          <section class="st-panel">
            <h3>Recent sessions</h3>
            ${p.recent.length ? `<ul class="st-recent">${p.recent.map(r => `<li><button type="button" data-act="open-id" data-id="${esc(r.id)}"><span>${esc(r.title)}</span><span class="st-muted">${r.correct}/${r.answered} · ${pct(r.correct / r.answered)}</span></button></li>`).join('')}</ul>` : '<p class="st-muted">Nothing yet.</p>'}
          </section>
        </div>
      </div>`, { dir: -1, first });
    this.paintList();
    if (reduced()) { page.querySelectorAll('[data-n]').forEach(el => { if (el.textContent !== '—') el.textContent = `${el.dataset.n}${el.dataset.suffix || ''}`; }); return; }
    cascade(page.querySelectorAll('.st-prog-head, .st-stat, .st-panel'), { step: 56, delay: first ? 80 : 120 });
    page.querySelectorAll('[data-n]').forEach(el => { if (el.textContent !== '—') countUp(el, el.dataset.n, { suffix: el.dataset.suffix || '' }); });
    page.querySelectorAll('.st-day i').forEach((b, i) => b.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 560, delay: 260 + (i % 30) * 9, easing: GLIDE, fill: 'backwards', tempo: false }));
    page.querySelectorAll('.st-topic-bar i').forEach((b, i) => b.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 650, delay: 360 + i * 60, easing: GLIDE, fill: 'backwards', tempo: false }));
  },

  openSession(session, { first = false, quiz = null } = {}) {
    this.abort?.abort();
    this.busy = false;
    const was = this.view;
    this.view = 'session';
    this.el.dataset.view = 'session';
    this.session = session;
    this.quizId = quiz || null;
    this.qIndex = 0;
    if (this.quizId) this.qIndex = this.firstOpen(this.currentQuiz());
    this.closeDrawer();
    this.topTitle.innerHTML = `<input class="st-title-input" value="${esc(session.title)}" aria-label="Session name" maxlength="80" spellcheck="false">`;
    const page = this.swapView(`
      <div class="st-session">
        <div class="st-files"></div>
        <div class="st-stage" tabindex="-1"></div>
        <form class="st-composer">
          <div class="st-comp-chips"></div>
          <div class="st-comp-row">
            <button type="button" class="st-icon" data-act="attach" aria-label="Add context files" title="Add context files">${ico(I.clip, 18)}</button>
            <textarea class="st-input" rows="1" maxlength="4000" spellcheck="true"></textarea>
            <button type="submit" class="st-send" aria-label="Send">${ico(I.send, 18, 2)}</button>
          </div>
        </form>
      </div>`, { dir: was === 'progress' ? 1 : 0, first });
    this.stage = page.querySelector('.st-stage');
    this.filesEl = page.querySelector('.st-files');
    this.input = page.querySelector('.st-input');
    this.setMode(session.mode || 'mcq', { quiet: true });
    this.paintFiles();
    this.paintComposerChips();
    this.paintStage({ first: true });
    this.paintList();
    if (!first && window.innerWidth > 760) setTimeout(() => this.input?.focus({ preventScroll: true }), 80);
  },

  /* ================= mode ================= */

  setMode(mode, { quiet = false } = {}) {
    if (!this.session) return;
    const changed = this.session.mode !== mode;
    this.prevMode = this.session.mode;
    this.session.mode = mode;
    this.el.querySelectorAll('.st-mode').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    this.placeModePill(quiet);
    if (this.input) this.input.placeholder = this.placeholder();
    this.paintComposerChips();
    if (!quiet && changed) {
      this.abort?.abort();
      this.busy = false;
      const order = ['mcq', 'live', 'notes'];
      this.paintStage({ dir: Math.sign(order.indexOf(mode) - order.indexOf(this.prevMode || 'mcq')) || 1 });
      if (this.sessions.some(s => s.id === this.session.id)) this.store.save(this.session, { quiet: true });
    }
  },

  placeModePill(instant = false) {
    const on = this.el.querySelector('.st-mode[aria-selected="true"]');
    const pill = this.el.querySelector('.st-modes-pill');
    if (!on || !pill || !on.offsetWidth) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  },

  placeholder() {
    const narrow = window.innerWidth <= 760;
    if (this.session?.mode === 'notes') return (this.session.files || []).length ? 'Ask about your notes…' : 'Add notes above to read and study them';
    if (narrow && this.session?.mode !== 'live') return 'Ask for a quiz…';
    if (this.session?.mode === 'live') {
      const last = this.session.live?.turns?.at(-1);
      return last?.role === 'ask' ? 'Your answer…' : 'What should the Assistant quiz you on?';
    }
    return (this.session?.files || []).length ? 'Ask for a quiz on your files… e.g. “10 hard questions on chapter 3”' : 'Ask for a quiz… e.g. “Quiz me on cell respiration”';
  },

  paintComposerChips() {
    const box = this.el?.querySelector('.st-comp-chips');
    if (!box || !this.session) return;
    if (this.session.mode === 'notes') { box.innerHTML = ''; return; }
    if (this.session.mode === 'live') {
      const last = this.session.live?.turns?.at(-1);
      box.innerHTML = last?.role === 'ask' ? `<button type="button" class="st-chip" data-act="live-quick" data-text="I don't know">I don't know</button><button type="button" class="st-chip" data-act="live-quick" data-text="Can I have a hint?">Hint</button>` : '';
      return;
    }
    const n = this.count || this.prefs.quizLength || '10';
    const d = this.difficulty || this.prefs.difficulty || 'mixed';
    box.innerHTML = `
      <span class="st-seg" role="group" aria-label="Questions">${['5', '10', '15', '20'].map(v => `<button type="button" data-act="count" data-v="${v}" aria-pressed="${v === String(n)}">${v}</button>`).join('')}</span>
      <span class="st-seg" role="group" aria-label="Difficulty">${[['easy', 'Easy'], ['mixed', 'Mixed'], ['hard', 'Hard']].map(([v, l]) => `<button type="button" data-act="difficulty" data-v="${v}" aria-pressed="${v === d}">${l}</button>`).join('')}</span>`;
  },

  grow(t) { t.style.height = 'auto'; t.style.height = `${Math.min(160, t.scrollHeight)}px`; },

  /* ================= files ================= */

  paintFiles({ added = null } = {}) {
    const files = this.session?.files || [];
    this.filesEl.innerHTML = `${files.map(f => `
      <span class="st-file${f.chars ? '' : ' is-empty'}" data-id="${esc(f.id)}" title="${esc(f.name)}${f.chars ? ` · ${f.chars.toLocaleString()} characters` : ' · no readable text found'}">
        ${ico(I.file, 14)}<span class="st-file-name">${esc(f.name)}</span>
        <button type="button" class="st-file-x" data-act="file-remove" aria-label="Remove ${esc(f.name)}">${ico(I.x, 12, 2)}</button>
      </span>`).join('')}
      <span class="st-file-add">
        <button type="button" class="st-file-addbtn" data-act="files-menu" aria-haspopup="true" aria-expanded="false">${ico(I.plus, 14, 2)}<span>${files.length ? 'Add' : 'Add context files'}</span></button>
        <span class="st-pop" role="menu" hidden>
          <button type="button" role="menuitem" data-act="attach">${ico(I.file, 15)}From this device</button>
          <button type="button" role="menuitem" data-act="from-files">${ico(I.folder, 15)}From Toolbox Files</button>
          <button type="button" role="menuitem" data-act="paste-note">${ico(I.note, 15)}Paste notes</button>
        </span>
      </span>
      ${files.length ? '' : '<span class="st-files-hint">Optional. Quizzes then come from your material.</span>'}`;
    if (added && !reduced()) {
      const chip = this.filesEl.querySelector(`[data-id="${CSS.escape(added)}"]`);
      chip?.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 370, easing: SPRING, tempo: false });
    }
  },

  async addFiles(list) {
    if (!list?.length || !this.session) return;
    for (const file of list.slice(0, 12)) {
      try {
        const { text, images } = await readNote(file);
        const meta = await this.store.addFile(this.session, { name: file.name || 'Notes', type: file.type, size: file.size || text.length, text, images });
        if (!this.sessions.some(s => s.id === this.session.id)) await this.commit();
        else { this.sessions = [this.session, ...this.sessions.filter(x => x.id !== this.session.id)]; this.paintList(); }
        this.paintFiles({ added: meta.id });
        if (!text && !images.length) showToast(`No readable text in ${file.name}. A scanned PDF needs text recognition first.`, 'info', 5000);
        if (this.session.mode === 'notes') { this.noteId = meta.id; this.paintStage(); }
      } catch (err) {
        showToast(`Could not read ${file.name}: ${err?.message || err}`, 'error', 5000);
      }
    }
    if (this.input) this.input.placeholder = this.placeholder();
    if (this.session.mode === 'mcq' && !this.currentQuiz()) this.paintStage();
  },

  async addFromToolboxFiles(paths) {
    const { fs } = await import('../lib/filesystem.js');
    const metas = await fs.listAllMeta();
    const files = [];
    for (const p of paths) {
      const m = metas.find(x => x.path === p && !x.isDirectory);
      if (!m) continue;
      const blob = await fs.readFile(m.path, { encoding: 'blob' });
      files.push(new File([blob], m.name, { type: m.mimeType || blob.type || '' }));
    }
    this.addFiles(files);
  },

  async pickFromToolboxFiles(anchor) {
    const { fs } = await import('../lib/filesystem.js');
    const metas = (await fs.listAllMeta().catch(() => [])).filter(f => !f.isDirectory && /\.(pdf|txt|md|markdown|docx|pptx|csv|json|html?|tex|rtf|png|jpe?g|webp|gif)$/i.test(f.name || ''));
    const pop = anchor.closest('.st-file-add').querySelector('.st-pop');
    pop.innerHTML = metas.length
      ? `<span class="st-pop-label">Toolbox Files</span>${metas.slice(0, 40).map(f => `<button type="button" role="menuitem" data-act="pick-path" data-path="${esc(f.path)}">${ico(I.file, 15)}<span>${esc(f.name)}</span></button>`).join('')}`
      : '<span class="st-pop-label">No documents in Toolbox Files yet.</span>';
    pop.hidden = false;
  },

  async pasteNote() {
    const text = await tbPrompt('Paste or type the notes to study from.', '', { title: 'Paste notes', confirmText: 'Add', placeholder: 'Your notes…' });
    if (!text || !String(text).trim()) return;
    const n = (this.session.files || []).filter(f => /^Notes/.test(f.name)).length + 1;
    this.addFiles([new File([String(text)], `Notes ${n}.txt`, { type: 'text/plain' })]);
  },

  async removeFile(id) {
    const chip = this.filesEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (chip && !reduced()) await chip.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 220, easing: 'ease-in', fill: 'forwards', tempo: false }).finished.catch(() => {});
    await this.store.removeFile(this.session, id);
    this.paintFiles();
    if (this.input) this.input.placeholder = this.placeholder();
  },

  /* ================= stage ================= */

  currentQuiz() { return this.session?.quizzes?.find(q => q.id === this.quizId) || null; },
  firstOpen(qz) {
    if (!qz) return 0;
    const i = qz.questions.findIndex(q => !qz.answers?.[q.id]);
    return i < 0 ? qz.questions.length : i;
  },

  /** What the stage shows, for layout (phones hide the quiz settings while a quiz is played). */
  markStage() {
    const box = this.stage?.closest('.st-session');
    if (!box) return;
    const qz = this.currentQuiz();
    box.dataset.stage = this.session.mode === 'live' ? 'live' : this.session.mode === 'notes' ? 'notes' : !qz ? 'empty' : this.qIndex >= qz.questions.length ? 'results' : 'quiz';
  },

  paintStage({ first = false, dir = 0 } = {}) {
    if (!this.stage) return;
    const mode = this.session.mode;
    const html = mode === 'live' ? this.liveHtml() : mode === 'notes' ? this.notesHtml() : this.mcqHtml();
    this.stage.innerHTML = html;
    this.markStage();
    if (mode === 'notes') this.mountNotes({ first: true });
    if (this.input) this.input.placeholder = this.placeholder();
    this.paintComposerChips();
    if (reduced()) return;
    if (dir) this.stage.firstElementChild?.animate([{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 370, easing: GLIDE, tempo: false });
    else cascade(this.stage.querySelectorAll('.st-empty > *, .st-quizbar, .st-q, .st-results > *'), { step: 48, delay: first ? 100 : 0 });
    if (this.session.mode === 'live') this.scrollLive(true);
  },

  quizBar() {
    const qs = this.session.quizzes || [];
    if (!qs.length) return '';
    return `<nav class="st-quizbar" aria-label="Quizzes in this session">${qs.map((qz, i) => {
      const sc = scoreOf(qz);
      return `<button type="button" class="st-qtab${qz.id === this.quizId ? ' is-on' : ''}" data-act="quiz" data-id="${esc(qz.id)}" title="${esc(qz.title)}">
        <span>${esc(qz.title || `Quiz ${i + 1}`)}</span><small>${sc.answered === sc.total ? `${sc.right}/${sc.total}` : `${sc.answered}/${sc.total}`}</small></button>`;
    }).join('')}</nav>`;
  },

  mcqHtml() {
    const qz = this.currentQuiz();
    if (!qz) {
      const files = this.session.files || [];
      const ideas = files.length
        ? [`10 questions on ${files[0].name.replace(/\.[^.]+$/, '')}`, 'Hard questions on the key ideas', 'A quick 5-question check']
        : ['Quiz me on cell respiration', 'The causes of World War I', 'Solving quadratic equations'];
      return `${this.quizBar()}<div class="st-empty">
        <span class="st-empty-mark">${ico(I.list, 26)}</span>
        <h3>${this.session.quizzes?.length ? 'Another quiz?' : 'Make a quiz'}</h3>
        <p>Ask below for any topic${files.length ? ', or let it come from your files' : '. Add your notes first and it will come from them'}. Questions arrive one at a time and are marked as you answer.</p>
        <div class="st-ideas">${ideas.map(t => `<button type="button" class="st-chip" data-act="idea" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      </div>`;
    }
    if (this.qIndex >= qz.questions.length) return `${this.quizBar()}${this.resultsHtml(qz)}`;
    return `${this.quizBar()}${this.playerHtml(qz)}`;
  },

  playerHtml(qz) {
    const n = qz.questions.length;
    const q = qz.questions[this.qIndex];
    return `<div class="st-quiz" data-quiz="${esc(qz.id)}">
      <header class="st-quiz-head"><h3>${esc(qz.title)}</h3><span class="st-quiz-count"><b>${this.qIndex + 1}</b> / ${n}</span></header>
      <div class="st-track" aria-hidden="true"><i style="transform: scaleX(${(this.qIndex / n).toFixed(4)})"></i></div>
      <div class="st-qwrap">${this.questionHtml(qz, q)}</div>
    </div>`;
  },

  questionHtml(qz, q) {
    const a = qz.answers?.[q.id];
    const showWhy = a && (this.prefs.explain !== false);
    return `<article class="st-q${a ? ' is-answered' : ''}" data-q="${esc(q.id)}">
      ${q.topic ? `<span class="st-topic">${esc(q.topic)}</span>` : ''}
      <h4 class="st-q-text">${esc(q.q)}</h4>
      <ol class="st-choices" role="list">${q.choices.map((c, i) => {
        const cls = a ? (i === q.answer ? ' is-answer' : i === a.choice ? ' is-wrong' : ' is-dim') : '';
        return `<li><button type="button" class="st-choice${cls}" data-act="choose" data-i="${i}" ${a ? 'aria-disabled="true"' : ''}>
          <span class="st-key">${LETTERS[i]}</span><span class="st-choice-text">${esc(c)}</span><span class="st-choice-mark" aria-hidden="true">${a && i === q.answer ? ico(I.check, 16, 2.4) : a && i === a.choice ? ico(I.x, 15, 2.4) : ''}</span>
        </button></li>`;
      }).join('')}</ol>
      <div class="st-why"${showWhy ? '' : ' hidden'}><strong>${a?.correct ? 'Right.' : 'Not quite.'}</strong> ${esc(q.explanation || '')}</div>
      <footer class="st-q-foot"${a ? '' : ' hidden'}>
        <button type="button" class="st-btn is-ink st-next" data-act="next">${this.qIndex + 1 >= qz.questions.length ? 'See results' : 'Next question'}${ico(I.send, 16, 2)}</button>
      </footer>
    </article>`;
  },

  resultsHtml(qz) {
    const sc = scoreOf(qz);
    const rate = sc.total ? sc.right / sc.total : 0;
    const missed = qz.questions.filter(q => qz.answers?.[q.id] && !qz.answers[q.id].correct);
    const topics = new Map();
    for (const q of qz.questions) {
      const a = qz.answers?.[q.id]; if (!a || !q.topic) continue;
      const t = topics.get(q.topic) || { n: 0, ok: 0 }; t.n++; if (a.correct) t.ok++; topics.set(q.topic, t);
    }
    const say = rate === 1 ? 'Every one right.' : rate >= 0.8 ? 'Strong. A couple to tidy up.' : rate >= 0.5 ? 'Getting there. Go over the ones you missed.' : 'Worth another pass: review the explanations, then retry.';
    const C = 2 * Math.PI * 52;
    return `<div class="st-results">
      <div class="st-ring" style="--c:${C.toFixed(2)};--p:${rate.toFixed(4)}">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="st-ring-bg"/><circle cx="60" cy="60" r="52" class="st-ring-fg"/></svg>
        <strong data-n="${Math.round(rate * 100)}">${Math.round(rate * 100)}%</strong>
      </div>
      <h3>${sc.right} of ${sc.total} right</h3>
      <p class="st-muted">${say}</p>
      <div class="st-res-actions">
        ${missed.length ? `<button type="button" class="st-btn is-ink" data-act="retry-missed">${ico(I.retry, 16)}<span>Retry the ${missed.length} missed</span></button>` : ''}
        <button type="button" class="st-btn" data-act="review">Review answers</button>
        <button type="button" class="st-btn" data-act="again">${ico(I.spark, 16)}<span>New quiz like this</span></button>
      </div>
      ${topics.size > 1 ? `<ul class="st-topics">${[...topics].map(([t, v]) => `<li><span class="st-topic-name">${esc(t)}</span><span class="st-topic-bar"><i style="--w:${Math.max(0.04, v.ok / v.n).toFixed(3)}"></i></span><span class="st-topic-rate">${v.ok}/${v.n}</span></li>`).join('')}</ul>` : ''}
      ${missed.length ? `<section class="st-missed"><h4>What you missed</h4>${missed.map(q => `
        <article class="st-miss"><p class="st-miss-q">${esc(q.q)}</p>
          <p><span class="st-tag is-wrong">You said</span>${esc(q.choices[qz.answers[q.id].choice])}</p>
          <p><span class="st-tag is-right">Answer</span>${esc(q.choices[q.answer])}</p>
          ${q.explanation ? `<p class="st-muted">${esc(q.explanation)}</p>` : ''}</article>`).join('')}</section>` : ''}
    </div>`;
  },

  /* ---------- the quiz arrives ---------- */

  composingHtml(n = 0, total = 10) {
    return `<div class="st-composing" role="status">
      <span class="st-composing-mark">${ico(I.spark, 22)}</span>
      <div><strong>Writing your quiz</strong><span class="st-composing-n">${n ? `${n} of ${total} questions` : 'Reading your request…'}</span></div>
      <span class="st-composing-track"><i style="transform:scaleX(${Math.max(0.04, n / total).toFixed(3)})"></i></span>
    </div>`;
  },

  async makeQuiz(request) {
    if (this.busy) return;
    const count = Number(this.count || this.prefs.quizLength || 10);
    const difficulty = this.difficulty || this.prefs.difficulty || 'mixed';
    this.busy = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const qb = this.stage.querySelector('.st-quizbar');
    this.stage.innerHTML = `${qb ? qb.outerHTML : ''}${this.composingHtml(0, count)}`;
    const card = this.stage.querySelector('.st-composing');
    if (!reduced()) card.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: GLIDE, tempo: false });
    this.setSending(true);
    try {
      const files = await this.store.fileTexts(this.session);
      const quiz = await generateQuiz({
        request, files, count, difficulty, signal,
        idFor: (i) => `q${Date.now().toString(36)}${i}`,
        onProgress: (n) => {
          const el = card.querySelector('.st-composing-n'); if (el) el.textContent = `${Math.min(n, count)} of ${count} questions`;
          const bar = card.querySelector('.st-composing-track i'); if (bar) bar.style.transform = `scaleX(${Math.min(1, n / count).toFixed(3)})`;
        },
      });
      if (signal.aborted || this.dead) return;
      await this.addQuiz(quiz, { prompt: request, difficulty, from: 'study', card });
    } catch (err) {
      if (signal.aborted || this.dead) return;
      this.busy = false;
      this.paintStage();
      showToast(err?.message || 'Could not write the quiz.', 'error', 6000);
    } finally {
      this.busy = false;
      this.setSending(false);
    }
  },

  /** Adds a quiz to this session (from Study's composer or the Assistant) and brings it into view. */
  async addQuiz(quiz, { prompt = '', difficulty = this.prefs.difficulty, from = 'study', card = null } = {}) {
    if (this.view !== 'session' || !this.session) this.openSession(this.store.blank(quiz.title));
    if (this.session.mode !== 'mcq') this.setMode('mcq', { quiet: true });
    const now = Date.now();
    const qz = { id: this.store.uid('qz'), title: quiz.title, createdAt: now, prompt, difficulty, from, questions: quiz.questions.map((q, i) => ({ ...q, id: q.id || `q${now.toString(36)}${i}` })), answers: {}, finishedAt: null };
    this.session.quizzes = [...(this.session.quizzes || []), qz];
    if (this.session.title === 'New session') { this.session.title = quiz.title.slice(0, 80); const ti = this.el.querySelector('.st-title-input'); if (ti) ti.value = this.session.title; }
    await this.commit();
    this.quizId = qz.id;
    this.qIndex = 0;
    card = card || this.stage.querySelector('.st-composing');
    if (card && !reduced()) await card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px) scale(.97)' }], { duration: 250, easing: 'ease-in', fill: 'forwards', tempo: false }).finished.catch(() => {});
    this.stage.innerHTML = this.mcqHtml();
    this.stage.scrollTop = 0;
    this.markStage();
    this.arriveQuiz();
  },

  /** Everything about a new quiz comes into view in order: its tab, title, progress line, question, choices. */
  arriveQuiz() {
    if (this.input) this.input.placeholder = this.placeholder();
    if (reduced()) return;
    const s = this.stage;
    const tab = s.querySelector('.st-qtab.is-on');
    tab?.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: SPRING, tempo: false });
    cascade([s.querySelector('.st-quiz-head h3'), s.querySelector('.st-quiz-count')], { y: 8, step: 70, delay: 40 });
    s.querySelector('.st-track')?.animate([{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 560, delay: 90, easing: GLIDE, fill: 'backwards', tempo: false });
    s.querySelector('.st-q')?.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 140, easing: GLIDE, fill: 'backwards', tempo: false });
    cascade(s.querySelectorAll('.st-topic, .st-q-text'), { y: 6, step: 56, delay: 200 });
    cascade(s.querySelectorAll('.st-choice'), { y: 10, step: 63, delay: 260 });
  },

  /* ---------- answering ---------- */

  async choose(i) {
    const qz = this.currentQuiz();
    const q = qz?.questions[this.qIndex];
    if (!q || qz.answers?.[q.id]) return;
    const correct = i === q.answer;
    qz.answers = { ...(qz.answers || {}), [q.id]: { choice: i, correct, at: Date.now() } };
    if (qz.questions.every(x => qz.answers[x.id])) qz.finishedAt = Date.now();
    const art = this.stage.querySelector('.st-q');
    const fresh = document.createElement('div');
    fresh.innerHTML = this.questionHtml(qz, q);
    const next = fresh.firstElementChild;
    art.replaceWith(next);
    this.paintQuizTab(qz);
    this.store.save(this.session, { quiet: true }).then(() => this.paintListMeta());
    if (reduced()) return;
    const picked = next.querySelector(`.st-choice[data-i="${i}"]`);
    const right = next.querySelector('.st-choice.is-answer');
    if (correct) picked.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'none' }], { duration: 460, easing: SPRING, tempo: false });
    else picked.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 500, easing: 'ease-out', tempo: false });
    next.querySelectorAll('.st-choice-mark svg').forEach(m => m.animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'none' }], { duration: 430, delay: 60, easing: SPRING, fill: 'backwards', tempo: false }));
    right?.querySelector('.st-fill')?.remove();
    const why = next.querySelector('.st-why:not([hidden])');
    cascade([why, next.querySelector('.st-q-foot')], { y: 8, step: 84, delay: 120 });
    next.querySelector('.st-next')?.focus({ preventScroll: true });
    this.reveal(next.querySelector('.st-q-foot'));
  },

  /** Brings an element fully into the stage's view with one smooth scroll (no jump if already visible). */
  reveal(el) {
    if (!el || !this.stage) return;
    const s = this.stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    const over = r.bottom + 12 - s.bottom;
    if (over > 0) this.stage.scrollTo({ top: this.stage.scrollTop + over, behavior: reduced() ? 'auto' : 'smooth' });
  },

  paintQuizTab(qz) {
    const tab = this.stage.querySelector(`.st-qtab[data-id="${CSS.escape(qz.id)}"] small`);
    if (tab) { const sc = scoreOf(qz); tab.textContent = sc.answered === sc.total ? `${sc.right}/${sc.total}` : `${sc.answered}/${sc.total}`; }
  },
  paintListMeta() {
    const li = this.listEl.querySelector(`[data-id="${CSS.escape(this.session.id)}"] .st-sess-meta`);
    if (!li) return;
    const sc = sessionScore(this.session), s = this.session;
    li.textContent = `${sc.answered ? `${pct(sc.right / sc.answered)} · ` : ''}${(s.files || []).length ? `${s.files.length} file${s.files.length === 1 ? '' : 's'} · ` : ''}${when(s.updatedAt)}`;
  },

  /** The next question slides in from the right as the answered one leaves to the left. */
  async next() {
    const qz = this.currentQuiz();
    if (!qz) return;
    const old = this.stage.querySelector('.st-q');
    this.qIndex++;
    const done = this.qIndex >= qz.questions.length;
    if (!reduced() && old) await old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-28px)' }], { duration: 230, easing: 'ease-in', fill: 'forwards', tempo: false }).finished.catch(() => {});
    if (done) { this.stage.innerHTML = this.mcqHtml(); this.stage.scrollTop = 0; this.markStage(); this.arriveResults(); return; }
    const wrap = this.stage.querySelector('.st-qwrap');
    wrap.innerHTML = this.questionHtml(qz, qz.questions[this.qIndex]);
    this.stage.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    const n = qz.questions.length;
    this.stage.querySelector('.st-quiz-count').innerHTML = `<b>${this.qIndex + 1}</b> / ${n}`;
    const bar = this.stage.querySelector('.st-track i');
    if (bar) bar.style.transform = `scaleX(${(this.qIndex / n).toFixed(4)})`;
    if (reduced()) return;
    this.stage.querySelector('.st-quiz-count b')?.animate([{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: GLIDE, tempo: false });
    wrap.firstElementChild.animate([{ opacity: 0, transform: 'translateX(32px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: GLIDE, tempo: false });
    cascade(wrap.querySelectorAll('.st-choice'), { y: 8, step: 49, delay: 90 });
  },

  arriveResults() {
    if (reduced()) return;
    const r = this.stage.querySelector('.st-results');
    if (!r) return;
    const fg = r.querySelector('.st-ring-fg');
    const ring = r.querySelector('.st-ring');
    const C = parseFloat(ring.style.getPropertyValue('--c')), p = parseFloat(ring.style.getPropertyValue('--p'));
    fg.animate([{ strokeDashoffset: C }, { strokeDashoffset: C * (1 - p) }], { duration: 1400, delay: 120, easing: GLIDE, fill: 'backwards', tempo: false });
    countUp(r.querySelector('.st-ring strong'), r.querySelector('.st-ring strong').dataset.n, { suffix: '%', dur: 900 });
    ring.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SPRING, tempo: false });
    cascade([...r.children].slice(1), { step: 70, delay: 160 });
    r.querySelectorAll('.st-topic-bar i').forEach((b, i) => b.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 650, delay: 420 + i * 60, easing: GLIDE, fill: 'backwards', tempo: false }));
  },

  retryMissed() {
    const qz = this.currentQuiz();
    if (!qz) return;
    const missed = qz.questions.filter(q => qz.answers?.[q.id] && !qz.answers[q.id].correct);
    if (!missed.length) return;
    // The same questions, choices reshuffled so the position is not remembered.
    const shuffled = missed.map(q => {
      const order = q.choices.map((_, i) => i).sort(() => Math.random() - 0.5);
      return { q: q.q, choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer), explanation: q.explanation, topic: q.topic };
    });
    this.addQuiz({ title: `${qz.title.replace(/^Retry: /, '')} · retry`.replace(/ · retry · retry$/, ' · retry'), questions: shuffled }, { prompt: `Retry of ${qz.title}`, from: 'retry' });
  },

  review() {
    const qz = this.currentQuiz();
    if (!qz) return;
    const body = qz.questions.map((q, n) => {
      const a = qz.answers?.[q.id];
      return `<article class="st-miss${a?.correct ? ' is-ok' : ''}"><p class="st-miss-q">${n + 1}. ${esc(q.q)}</p>
        ${a ? `<p><span class="st-tag ${a.correct ? 'is-right' : 'is-wrong'}">You said</span>${esc(q.choices[a.choice])}</p>` : ''}
        ${!a?.correct ? `<p><span class="st-tag is-right">Answer</span>${esc(q.choices[q.answer])}</p>` : ''}
        ${q.explanation ? `<p class="st-muted">${esc(q.explanation)}</p>` : ''}</article>`;
    }).join('');
    const sec = this.stage.querySelector('.st-missed') || this.stage.querySelector('.st-results').appendChild(Object.assign(document.createElement('section'), { className: 'st-missed' }));
    sec.innerHTML = `<h4>Every answer</h4>${body}`;
    cascade(sec.querySelectorAll('.st-miss'), { step: 35 });
    sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  },

  /* ================= live (Assistant quiz) ================= */

  liveHtml() {
    const live = this.session.live || (this.session.live = { turns: [], asked: 0, correct: 0 });
    const turns = live.turns || [];
    const graded = turns.filter(t => t.role === 'grade' && t.correct != null);
    const right = graded.filter(t => t.correct).length;
    if (!turns.length) {
      return `<div class="st-empty">
        <span class="st-empty-mark">${ico(I.chat, 26)}</span>
        <h3>The Assistant as your examiner</h3>
        <p>It asks one question at a time${(this.session.files || []).length ? ' from your files' : ''}, marks each answer, and goes harder or circles back depending on how you do. Tell it what to cover below.</p>
        <div class="st-ideas"><button type="button" class="st-chip" data-act="live-start" data-text="">${(this.session.files || []).length ? 'Start on my files' : 'Surprise me'}</button></div>
      </div>`;
    }
    return `<div class="st-live">
      <div class="st-live-bar"><span><b>${graded.length}</b> asked</span><span><b>${right}</b> right</span>${graded.length ? `<span>${pct(right / graded.length)}</span>` : ''}
        <button type="button" class="st-btn is-sm" data-act="live-reset">${ico(I.retry, 14)}<span>Start over</span></button></div>
      <ol class="st-thread" role="log" aria-live="polite">${turns.map((t, i) => this.turnHtml(t, i === turns.length - 1)).join('')}</ol>
    </div>`;
  },

  turnHtml(t, isLast) {
    if (t.role === 'ask') {
      return `<li class="st-turn st-ask">
        ${t.topic ? `<span class="st-topic">${esc(t.topic)}</span>` : ''}
        <p class="st-ask-q">${esc(t.question)}</p>
        ${t.choices && isLast ? `<div class="st-ask-choices">${t.choices.map((c, i) => `<button type="button" class="st-choice is-sm" data-act="live-choice" data-text="${esc(c)}"><span class="st-key">${LETTERS[i]}</span><span class="st-choice-text">${esc(c)}</span></button>`).join('')}</div>` : ''}
      </li>`;
    }
    if (t.role === 'answer') return `<li class="st-turn st-ans"><p>${esc(t.text)}</p></li>`;
    if (t.role === 'grade') return `<li class="st-turn st-grade${t.correct === true ? ' is-right' : t.correct === false ? ' is-wrong' : ''}"><span class="st-grade-mark">${t.correct === true ? ico(I.check, 15, 2.4) : t.correct === false ? ico(I.x, 14, 2.4) : ico(I.spark, 14)}</span><p>${esc(t.feedback)}</p></li>`;
    return '';
  },

  scrollLive(instant = false) {
    const st = this.stage;
    if (!st) return;
    st.scrollTo({ top: st.scrollHeight, behavior: instant || reduced() ? 'auto' : 'smooth' });
  },

  async liveTurn({ request = '', answer = null } = {}) {
    if (this.busy) return;
    const live = this.session.live || (this.session.live = { turns: [], asked: 0, correct: 0 });
    if (!live.turns.length && !this.stage.querySelector('.st-live')) {
      this.stage.innerHTML = `<div class="st-live"><div class="st-live-bar"><span><b>0</b> asked</span><span><b>0</b> right</span></div><ol class="st-thread" role="log" aria-live="polite"></ol></div>`;
      if (!reduced()) this.stage.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 310, tempo: false });
    }
    const thread = this.stage.querySelector('.st-thread');
    thread.querySelectorAll('.st-ask-choices').forEach(c => c.remove());
    if (answer != null) {
      live.turns.push({ role: 'answer', text: answer, at: Date.now() });
      thread.insertAdjacentHTML('beforeend', this.turnHtml(live.turns.at(-1), false));
      const li = thread.lastElementChild;
      if (!reduced()) li.animate([{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: GLIDE, tempo: false });
    }
    if (request) live.request = request;
    thread.insertAdjacentHTML('beforeend', '<li class="st-turn st-thinking" aria-label="The Assistant is thinking"><i></i><i></i><i></i></li>');
    const dots = thread.lastElementChild;
    if (!reduced()) dots.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 310, easing: GLIDE, tempo: false });
    this.scrollLive();
    this.busy = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.setSending(true);
    try {
      const files = await this.store.fileTexts(this.session);
      const turn = await examine({ files, turns: live.turns, request: live.request || '', difficulty: this.difficulty || this.prefs.difficulty || 'mixed', signal });
      if (signal.aborted || this.dead) return;
      const lastAsk = [...live.turns].reverse().find(t => t.role === 'ask');
      const answered = live.turns.at(-1)?.role === 'answer';
      const added = [];
      if (answered && (turn.feedback || turn.correct != null)) added.push({ role: 'grade', correct: turn.correct, feedback: turn.feedback || (turn.correct ? 'Right.' : 'Not quite.'), topic: lastAsk?.topic || '', at: Date.now() });
      added.push({ role: 'ask', question: turn.question, choices: turn.choices, topic: turn.topic, at: Date.now() });
      live.turns.push(...added);
      if (live.turns.length > 400) live.turns = live.turns.slice(-400);
      if (!this.sessions.some(s => s.id === this.session.id) || this.session.title === 'New session') {
        if (this.session.title === 'New session') { this.session.title = (live.request || turn.topic || 'Assistant quiz').slice(0, 60); const ti = this.el.querySelector('.st-title-input'); if (ti) ti.value = this.session.title; }
        await this.commit();
      } else { await this.store.save(this.session, { quiet: true }); this.paintListMeta(); }
      dots.remove();
      added.forEach((t, i) => {
        thread.insertAdjacentHTML('beforeend', this.turnHtml(t, i === added.length - 1));
        const li = thread.lastElementChild;
        if (reduced()) return;
        li.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: i * 140, easing: GLIDE, fill: 'backwards', tempo: false });
        li.querySelectorAll('.st-grade-mark svg').forEach(m => m.animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'none' }], { duration: 460, delay: i * 140 + 80, easing: SPRING, fill: 'backwards', tempo: false }));
        cascade(li.querySelectorAll('.st-choice'), { y: 8, step: 56, delay: i * 140 + 160 });
      });
      this.paintLiveBar();
      this.paintComposerChips();
      if (this.input) this.input.placeholder = this.placeholder();
      this.scrollLive();
    } catch (err) {
      dots.remove();
      if (signal.aborted || this.dead) return;
      showToast(err?.message || 'The Assistant could not continue.', 'error', 6000);
    } finally {
      this.busy = false;
      this.setSending(false);
    }
  },

  paintLiveBar() {
    const bar = this.stage.querySelector('.st-live-bar');
    if (!bar) return;
    const g = this.session.live.turns.filter(t => t.role === 'grade' && t.correct != null);
    const r = g.filter(t => t.correct).length;
    bar.innerHTML = `<span><b>${g.length}</b> asked</span><span><b>${r}</b> right</span>${g.length ? `<span>${pct(r / g.length)}</span>` : ''}
      <button type="button" class="st-btn is-sm" data-act="live-reset">${ico(I.retry, 14)}<span>Start over</span></button>`;
  },

  /* ================= composer ================= */

  setSending(on) {
    const btn = this.el.querySelector('.st-send');
    if (!btn) return;
    btn.classList.toggle('is-stop', on);
    btn.setAttribute('aria-label', on ? 'Stop' : 'Send');
    btn.innerHTML = on ? ico(I.stop, 16, 2) : ico(I.send, 18, 2);
  },

  send() {
    if (this.busy) { this.abort?.abort(); this.busy = false; this.setSending(false); this.paintStage(); return; }
    const text = (this.input?.value || '').trim();
    if (!getCurrentUser()) { showToast('Sign in to use the Assistant.', 'info'); return; }
    if (this.session.mode === 'notes') {
      if (!text || !(this.session.files || []).length) { this.input?.focus(); return; }
      this.input.value = ''; this.grow(this.input);
      this.askNotes(text);
      return;
    }
    if (this.session.mode === 'live') {
      const last = this.session.live?.turns?.at(-1);
      if (!text && last?.role === 'ask') return;
      this.input.value = ''; this.grow(this.input);
      if (last?.role === 'ask') this.liveTurn({ answer: text });
      else this.liveTurn({ request: text });
      return;
    }
    if (!text && !(this.session.files || []).length) { this.input?.focus(); return; }
    this.input.value = ''; this.grow(this.input);
    this.makeQuiz(text);
  },

  /* ================= Assistant context (Ctrl/Cmd+K) ================= */

  /** What the Assistant sees about this workspace when opened over it. */
  async getAssistantContext() {
    const d = await this.describe({ includeText: true, limit: 12000 });
    const lines = [`Study (the person's private study tool). ${d.view === 'progress' ? 'They are on the Progress page.' : `Open session: "${d.title}", mode: ${d.mode === 'live' ? 'Assistant quiz (live examining)' : 'multiple choice'}.`}`];
    if (d.files?.length) lines.push(`Context files: ${d.files.map(f => `${f.name} (${f.chars.toLocaleString()} chars)`).join(', ')}.`);
    if (d.current) lines.push(`On screen now: question ${d.current.number} of ${d.current.of} in "${d.current.quiz}": ${d.current.question}${d.current.choices ? ` Choices: ${d.current.choices.join(' | ')}.` : ''}${d.current.answered ? ` They answered ${d.current.correct ? 'correctly' : 'incorrectly'}.` : ' Not answered yet: do not give the answer away unless asked.'}`);
    if (d.quizzes?.length) lines.push(`Quizzes so far: ${d.quizzes.map(q => `${q.title} (${q.right}/${q.total})`).join('; ')}.`);
    lines.push('To make a quiz for them here, call study_create_quiz; read the files with study_session_info.');
    const text = d.files?.filter(f => f.text).map(f => `### ${f.name}\n${f.text}`).join('\n\n') || '';
    return { toolId: 'study', label: d.view === 'progress' ? 'Study · Progress' : `Study · ${d.title}`, summary: lines.join(' '), text };
  },

  async describe({ includeText = true, limit = 30000 } = {}) {
    const s = this.session;
    if (this.view !== 'session' || !s) {
      const p = progressOf(this.sessions);
      return { view: 'progress', sessions: this.sessions.length, answered: p.answered, accuracy: p.accuracy, weakTopics: p.weak.map(t => t.topic) };
    }
    const files = includeText ? await this.store.fileTexts(s) : (s.files || []);
    const share = files.length ? Math.floor(limit / files.length) : 0;
    const qz = this.currentQuiz();
    const q = qz && this.qIndex < qz.questions.length ? qz.questions[this.qIndex] : null;
    const a = q ? qz.answers?.[q.id] : null;
    const lastAsk = s.mode === 'live' ? [...(s.live?.turns || [])].reverse().find(t => t.role === 'ask') : null;
    return {
      view: 'session', title: s.title, mode: s.mode,
      files: files.map(f => ({ name: f.name, chars: f.chars || 0, ...(includeText ? { text: (f.text || '').slice(0, share) } : {}) })),
      quizzes: (s.quizzes || []).map(x => { const sc = scoreOf(x); return { title: x.title, total: sc.total, answered: sc.answered, right: sc.right, missed: x.questions.filter(y => x.answers?.[y.id] && !x.answers[y.id].correct).map(y => y.q) }; }),
      current: q ? { quiz: qz.title, number: this.qIndex + 1, of: qz.questions.length, question: q.q, choices: q.choices, answered: !!a, correct: a?.correct ?? null }
        : lastAsk ? { quiz: 'Assistant quiz', number: (s.live.turns.filter(t => t.role === 'ask').length), of: '…', question: lastAsk.question, choices: lastAsk.choices, answered: s.live.turns.at(-1)?.role !== 'ask', correct: null } : null,
    };
  },

  /* ================= events ================= */

  async onClick(e) {
    const t = e.target.closest('[data-act]');
    // Clicking away closes the add-files menu.
    if (!e.target.closest('.st-file-add')) this.el.querySelectorAll('.st-pop').forEach(p => { p.hidden = true; p.previousElementSibling?.setAttribute('aria-expanded', 'false'); });
    const mode = e.target.closest('.st-mode');
    if (mode) { this.setMode(mode.dataset.mode); return; }
    if (!t) return;
    const act = t.dataset.act;
    const li = t.closest('.st-sess');
    switch (act) {
      case 'new': { const s = this.store.blank(); this.openSession(s); return; }
      case 'progress': this.showProgress(); return;
      case 'open': { const s = this.sessions.find(x => x.id === li.dataset.id) || (this.session?.id === li.dataset.id ? this.session : null); if (s && (s !== this.session || this.view !== 'session')) this.openSession(s, { quiz: s.quizzes?.at(-1)?.id }); else this.closeDrawer(); return; }
      case 'open-id': { const s = this.sessions.find(x => x.id === t.dataset.id); if (s) this.openSession(s, { quiz: s.quizzes?.at(-1)?.id }); return; }
      case 'rename': {
        const s = this.sessions.find(x => x.id === li.dataset.id);
        const name = await tbPrompt('Name this session.', s.title, { title: 'Rename', confirmText: 'Rename' });
        if (name && name.trim()) { s.title = name.trim().slice(0, 80); await this.store.save(s); if (s === this.session) { const ti = this.el.querySelector('.st-title-input'); if (ti) ti.value = s.title; } this.paintList(); }
        return;
      }
      case 'delete': {
        const s = this.sessions.find(x => x.id === li.dataset.id);
        if (!(await tbConfirm(`Delete “${s.title}”, its files and its answers? This cannot be undone.`, { title: 'Delete session', confirmText: 'Delete', destructive: true }))) return;
        if (!reduced()) await li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-16px)' }], { duration: 250, easing: 'ease-in', fill: 'forwards', tempo: false }).finished.catch(() => {});
        await this.store.remove(s.id);
        this.sessions = this.sessions.filter(x => x.id !== s.id);
        if (this.session?.id === s.id) this.openSession(this.store.blank());
        else this.paintList();
        return;
      }
      case 'drawer': this.el.dataset.drawer = this.el.dataset.drawer === 'open' ? 'closed' : 'open'; return;
      case 'drawer-close': this.closeDrawer(); return;
      case 'attach': this.el.querySelectorAll('.st-pop').forEach(p => { p.hidden = true; }); this.fileInput.click(); return;
      case 'files-menu': {
        const pop = t.nextElementSibling;
        if (!pop.querySelector('[data-act="attach"]')) { this.paintFiles(); }
        const p2 = this.filesEl.querySelector('.st-pop');
        p2.hidden = !p2.hidden;
        this.filesEl.querySelector('.st-file-addbtn').setAttribute('aria-expanded', String(!p2.hidden));
        if (!p2.hidden && !reduced()) p2.animate([{ opacity: 0, transform: 'translateY(-4px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: GLIDE, tempo: false });
        return;
      }
      case 'from-files': this.pickFromToolboxFiles(t); return;
      case 'pick-path': this.el.querySelectorAll('.st-pop').forEach(p => { p.hidden = true; }); this.addFromToolboxFiles([t.dataset.path]); return;
      case 'paste-note': this.el.querySelectorAll('.st-pop').forEach(p => { p.hidden = true; }); this.pasteNote(); return;
      case 'file-remove': this.removeFile(t.closest('.st-file').dataset.id); return;
      case 'count': this.count = t.dataset.v; this.paintComposerChips(); return;
      case 'difficulty': this.difficulty = t.dataset.v; this.paintComposerChips(); return;
      case 'idea': this.input.value = t.dataset.text; this.send(); return;
      case 'quiz': {
        if (this.busy) return;
        this.quizId = t.dataset.id;
        this.qIndex = this.firstOpen(this.currentQuiz());
        this.stage.innerHTML = this.mcqHtml();
        this.stage.scrollTop = 0;
        this.markStage();
        if (this.qIndex >= this.currentQuiz().questions.length) this.arriveResults(); else this.arriveQuiz();
        return;
      }
      case 'choose': this.choose(Number(t.dataset.i)); return;
      case 'next': this.next(); return;
      case 'retry-missed': this.retryMissed(); return;
      case 'review': this.review(); return;
      case 'again': { const qz = this.currentQuiz(); this.makeQuiz(qz?.prompt && !/^Retry of|Made by/.test(qz.prompt) ? qz.prompt : `Another quiz like "${qz?.title}", different questions`); return; }
      case 'note': {
        if (t.dataset.id === this.noteId) return;
        this.noteId = t.dataset.id;
        this.stage.querySelectorAll('.st-note-tab').forEach(b => b.classList.toggle('is-on', b === t));
        const reader = this.stage.querySelector('.st-reader');
        if (reader && !reduced()) await reader.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }).finished.catch(() => {});
        reader?.getAnimations().forEach(a => a.cancel());
        this.mountNotes();
        return;
      }
      case 'note-teach': this.noteActions('teach', t); return;
      case 'note-summarize': this.noteActions('summarize', t); return;
      case 'note-simplify': this.noteActions('simplify', t); return;
      case 'note-explain-menu': this.noteActions('explain-menu', t); return;
      case 'insight-remove': this.removeInsight(t.closest('.st-ins')); return;
      case 'insights-close': this.closeInsights(); return;
      case 'insights-open': this.openInsights(); return;
      case 'live-start': this.liveTurn({ request: t.dataset.text || '' }); return;
      case 'live-choice': this.liveTurn({ answer: t.dataset.text }); return;
      case 'live-quick': this.liveTurn({ answer: t.dataset.text }); return;
      case 'live-reset': {
        if (!(await tbConfirm('Start the Assistant quiz over? Your answers so far still count in Progress.', { title: 'Start over', confirmText: 'Start over' }))) return;
        // Answers stay in progress: kept as graded turns, the conversation itself is cleared.
        this.session.live.archived = [...(this.session.live.archived || []), ...this.session.live.turns.filter(x => x.role === 'grade')].slice(-500);
        this.session.live.turns = [];
        await this.store.save(this.session, { quiet: true });
        this.paintStage({ dir: -1 });
        return;
      }
      default:
    }
  },

  ...NotesUI,

  key(e) {
    if (this.dead || this.view !== 'session' || this.session?.mode !== 'mcq') return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target.closest?.('input, textarea, [contenteditable="true"]');
    if (typing) return;
    const qz = this.currentQuiz();
    if (!qz || this.qIndex >= qz.questions.length) return;
    const q = qz.questions[this.qIndex];
    const k = e.key.toLowerCase();
    const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    if (idx >= 0 && idx < q.choices.length && !qz.answers?.[q.id]) { e.preventDefault(); this.choose(idx); }
    else if ((k === 'enter' || k === 'arrowright') && qz.answers?.[q.id]) { e.preventDefault(); this.next(); }
  },
};
