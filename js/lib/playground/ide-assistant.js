/* ============================================================
   Assistant panel UI for the Code Playground agent.
   Shows the agent's plan, every file it reads or edits, every command
   it runs (with output), what it saw in the preview, and a review of
   all changes with per-file diffs, revert and "Undo all".
   ============================================================ */

import { PlaygroundAgent } from './agent.js';
import { esc, diffHtml, fileIcon } from './ide-panels.js';

const QUICK = {
  debug: 'Find and fix the bugs in this project. Run it (and its tests, if any) to reproduce the problem, fix the cause, and run it again to confirm it works.',
  tests: 'Write unit tests for the active file (or the most important logic in this project), run them, and fix anything that fails.',
  build: 'Help me build the next feature for this app. Look at what exists, propose a short plan, then implement it and verify it runs.',
  examine: 'Explain how this project is structured and how it works, then point out bugs, risks and the most valuable improvements. Do not change any files.',
};

export class AssistantPanel {
  /**
   * @param {HTMLElement} el  the #cpg-assistant-panel element
   * @param {object} o { vfs, ide (tool integration), renderMarkdown, openFile, openDiff, onClose, insertAtCursor, toast }
   */
  constructor(el, o) {
    this.el = el;
    this.o = o;
    this.agent = new PlaygroundAgent({ vfs: o.vfs, ide: o.ide, onEvent: (e) => this.onEvent(e) });
    this.mode = 'agent';
    el.innerHTML = `
      <div class="cpg-ast-head">
        <div class="cpg-ast-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/></svg>
          <span>Code Assistant</span>
        </div>
        <div class="cpg-ast-head-actions">
          <select id="cpg-ast-mode" class="cpg-select-sm" aria-label="Assistant mode" title="Agent edits files and runs commands; Ask only reads and explains">
            <option value="agent">Agent</option>
            <option value="ask">Ask</option>
          </select>
          <button type="button" class="cpg-icon-btn" id="cpg-ast-new" title="New conversation">＋</button>
          <button type="button" class="cpg-icon-btn" id="cpg-assistant-close-btn" title="Close assistant">✕</button>
        </div>
      </div>
      <div class="cpg-ast-chips">
        <button type="button" class="cpg-ast-chip" id="cpg-ast-debug" title="Reproduce, fix and verify bugs">Debug &amp; Fix</button>
        <button type="button" class="cpg-ast-chip" id="cpg-ast-tests" title="Write and run tests">Write Tests</button>
        <button type="button" class="cpg-ast-chip" id="cpg-ast-build" title="Plan and implement a feature">Build Feature</button>
        <button type="button" class="cpg-ast-chip" id="cpg-ast-examine" title="Explain and review the code">Examine Code</button>
      </div>
      <div id="cpg-ast-chat-log" class="cpg-ast-log" aria-live="polite">
        <div class="cpg-ast-welcome">
          <strong>Your coding agent</strong>
          <p>Describe what you want to build or fix. The agent plans the work, edits files, runs your code and tests in its own terminal, checks the preview, and fixes what breaks. You can review or undo every change.</p>
          <p class="cpg-dim">Try: “Add a dark-mode toggle”, “Why does my loop never end?”, “Make this an Express API with a /users route and tests”.</p>
        </div>
      </div>
      <div class="cpg-ast-composer">
        <textarea id="cpg-ast-input" rows="2" placeholder="Ask the agent to build, fix or explain…  (Enter to send, Shift+Enter for a new line)"></textarea>
        <div class="cpg-ast-composer-row">
          <span class="cpg-dim cpg-ast-ctx" id="cpg-ast-ctx"></span>
          <button type="button" class="cpg-btn cpg-btn-danger" id="cpg-ast-stop" hidden>Stop</button>
          <button type="button" class="cpg-btn cpg-btn-primary" id="cpg-ast-send">Send</button>
        </div>
      </div>`;
    this.log = el.querySelector('#cpg-ast-chat-log');
    this.input = el.querySelector('#cpg-ast-input');
    this.sendBtn = el.querySelector('#cpg-ast-send');
    this.stopBtn = el.querySelector('#cpg-ast-stop');
    el.querySelector('#cpg-assistant-close-btn').addEventListener('click', () => o.onClose?.());
    el.querySelector('#cpg-ast-new').addEventListener('click', () => this.newChat());
    el.querySelector('#cpg-ast-mode').addEventListener('change', (e) => { this.mode = e.target.value; });
    for (const [k, prompt] of Object.entries(QUICK)) {
      el.querySelector(`#cpg-ast-${k}`).addEventListener('click', () => {
        if (k === 'examine') { this.mode = 'ask'; el.querySelector('#cpg-ast-mode').value = 'ask'; }
        this.send(prompt);
      });
    }
    this.sendBtn.addEventListener('click', () => this.send(this.input.value));
    this.stopBtn.addEventListener('click', () => this.agent.stop());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.send(this.input.value); }
    });
    this.input.addEventListener('input', () => { this.input.style.height = 'auto'; this.input.style.height = `${Math.min(180, this.input.scrollHeight)}px`; });
    this.log.addEventListener('click', (e) => this.onLogClick(e));
  }

  focus(prefill) {
    if (prefill) { this.input.value = prefill; this.input.dispatchEvent(new Event('input')); }
    this.input.focus();
  }

  updateContext(text) {
    const el = this.el.querySelector('#cpg-ast-ctx');
    if (el) el.textContent = text || '';
  }

  newChat() {
    if (this.agent.running) this.agent.stop();
    this.agent.reset();
    this.log.innerHTML = '<div class="cpg-ast-welcome"><strong>New conversation</strong><p>The agent starts fresh but still sees your whole workspace.</p></div>';
  }

  async send(text) {
    const prompt = String(text || '').trim();
    if (!prompt || this.agent.running) return;
    this.input.value = '';
    this.input.style.height = '';
    this.log.querySelector('.cpg-ast-welcome')?.remove();
    const user = document.createElement('div');
    user.className = 'cpg-ast-msg cpg-ast-user';
    user.textContent = prompt;
    this.log.appendChild(user);
    this.turn = document.createElement('div');
    this.turn.className = 'cpg-ast-msg cpg-ast-bot';
    this.turn.innerHTML = '<div class="cpg-ast-status"><span class="cpg-spinner"></span><span class="cpg-ast-status-text">Thinking…</span></div>';
    this.log.appendChild(this.turn);
    this.scroll();
    this.cards = new Map();
    this.sendBtn.hidden = true;
    this.stopBtn.hidden = false;
    await this.agent.send(prompt, { mode: this.mode });
    this.sendBtn.hidden = false;
    this.stopBtn.hidden = true;
  }

  scroll() { this.log.scrollTop = this.log.scrollHeight; }

  status(text) {
    const s = this.turn?.querySelector('.cpg-ast-status');
    if (!s) return;
    if (text === null) { s.remove(); return; }
    s.querySelector('.cpg-ast-status-text').textContent = text;
    this.turn.appendChild(s); // keep it last
  }

  onEvent(e) {
    const t = this.turn;
    if (!t) return;
    switch (e.type) {
      case 'thinking': this.status(e.step > 1 ? `Working… (step ${e.step})` : 'Thinking…'); break;
      case 'text': {
        const div = document.createElement('div');
        div.className = 'cpg-ast-text cpg-md';
        div.innerHTML = this.o.renderMarkdown(e.text);
        this.decorateCode(div);
        t.insertBefore(div, t.querySelector('.cpg-ast-status'));
        break;
      }
      case 'plan': {
        let card = t.querySelector('.cpg-ast-plan');
        if (!card) {
          card = document.createElement('div');
          card.className = 'cpg-ast-plan';
          t.insertBefore(card, t.querySelector('.cpg-ast-status'));
        }
        card.innerHTML = `<div class="cpg-ast-plan-head">Plan${e.note ? ` <span class="cpg-dim">· ${esc(e.note)}</span>` : ''}</div>${(e.steps || []).map((s) => `<div class="cpg-ast-step is-${esc(s.status)}"><span class="cpg-ast-step-box">${s.status === 'done' ? '✓' : s.status === 'in_progress' ? '●' : ''}</span>${esc(s.title)}</div>`).join('')}`;
        break;
      }
      case 'tool-start': {
        if (e.name === 'update_plan') break;
        const card = document.createElement('details');
        card.className = 'cpg-ast-tool is-running';
        card.innerHTML = `<summary><span class="cpg-spinner"></span><span class="cpg-ast-tool-label">${toolLabel(e.name, e.args)}</span></summary><div class="cpg-ast-tool-body"></div>`;
        t.insertBefore(card, t.querySelector('.cpg-ast-status'));
        this.cards.set(e.id, card);
        break;
      }
      case 'tool-result': {
        if (e.name === 'update_plan') break;
        const card = this.cards.get(e.id);
        if (!card) break;
        const r = e.result || {};
        const failed = Boolean(r.error) || (e.name === 'run_command' && r.exit_code && r.exit_code !== 0);
        card.classList.remove('is-running');
        card.classList.add(failed ? 'is-failed' : 'is-ok');
        card.querySelector('summary').innerHTML = `<span class="cpg-ast-tool-icon">${failed ? '✕' : '✓'}</span><span class="cpg-ast-tool-label">${toolLabel(e.name, e.args, r)}</span>`;
        card.querySelector('.cpg-ast-tool-body').innerHTML = toolBody(e.name, e.args, r);
        break;
      }
      case 'done': case 'stopped': case 'error': {
        this.status(null);
        if (e.type === 'error') {
          const div = document.createElement('div');
          div.className = 'cpg-ast-error';
          div.textContent = e.message;
          t.appendChild(div);
        }
        if (e.type === 'stopped') {
          const div = document.createElement('div');
          div.className = 'cpg-dim';
          div.textContent = 'Stopped.';
          t.appendChild(div);
        }
        this.renderChanges(t, e.checkpoint);
        break;
      }
      default: break;
    }
    this.scroll();
  }

  renderChanges(turn, checkpointId) {
    const changes = this.agent.changesFor(checkpointId);
    if (!changes.length) return;
    const card = document.createElement('div');
    card.className = 'cpg-ast-changes';
    card.dataset.checkpoint = checkpointId;
    card.innerHTML = `<div class="cpg-ast-changes-head"><b>${changes.length} file${changes.length === 1 ? '' : 's'} changed</b><span><button type="button" class="cpg-btn-sm" data-act="undo-all" title="Put every file back the way it was before this request">Undo all</button></span></div>${changes.map((c) => `
      <div class="cpg-ast-change" data-path="${esc(c.path)}">
        ${fileIcon(c.path)}<button type="button" class="cpg-link" data-act="open">${esc(c.path)}</button>
        <span class="cpg-ast-stat"><span class="add">+${c.added}</span> <span class="del">−${c.removed}</span></span>
        <span class="cpg-ast-change-actions"><button type="button" class="cpg-btn-sm" data-act="diff">Diff</button><button type="button" class="cpg-btn-sm" data-act="revert">Revert</button></span>
      </div>`).join('')}`;
    turn.appendChild(card);
  }

  onLogClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) {
      const open = e.target.closest('[data-open-file]');
      if (open) this.o.openFile(open.dataset.openFile, Number(open.dataset.line || 0));
      return;
    }
    const card = btn.closest('.cpg-ast-changes');
    const cp = card?.dataset.checkpoint;
    const row = btn.closest('.cpg-ast-change');
    const path = row?.dataset.path;
    switch (btn.dataset.act) {
      case 'open': this.o.openFile(path); break;
      case 'diff': {
        const c = this.agent.changesFor(cp).find((x) => x.path === path);
        this.o.openDiff({ title: `${path} — agent changes`, diff: c ? c.diff : 'No differences (already reverted).', path });
        break;
      }
      case 'revert': {
        this.agent.revert(cp, path);
        row.classList.add('is-reverted');
        row.querySelector('.cpg-ast-change-actions').innerHTML = '<span class="cpg-dim">reverted</span>';
        this.o.toast?.(`Reverted ${path}`);
        break;
      }
      case 'undo-all': {
        const n = this.agent.revert(cp);
        card.querySelectorAll('.cpg-ast-change').forEach((r) => { r.classList.add('is-reverted'); r.querySelector('.cpg-ast-change-actions').innerHTML = '<span class="cpg-dim">reverted</span>'; });
        btn.disabled = true;
        this.o.toast?.(`Undid changes to ${n} file${n === 1 ? '' : 's'}`);
        break;
      }
      case 'copy': {
        const code = btn.closest('pre')?.querySelector('code')?.textContent || '';
        navigator.clipboard?.writeText(code).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1200); });
        break;
      }
      case 'insert': {
        const code = btn.closest('pre')?.querySelector('code')?.textContent || '';
        this.o.insertAtCursor?.(code);
        break;
      }
      default: break;
    }
  }

  decorateCode(root) {
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.cpg-code-actions')) return;
      const bar = document.createElement('div');
      bar.className = 'cpg-code-actions';
      bar.innerHTML = '<button type="button" class="cpg-btn-sm" data-act="copy">Copy</button><button type="button" class="cpg-btn-sm" data-act="insert" title="Insert at the editor cursor">Insert</button>';
      pre.prepend(bar);
    });
  }
}

function code(s) { return `<code>${esc(s)}</code>`; }

function toolLabel(name, a = {}, r = null) {
  switch (name) {
    case 'list_files': return `Listed files${a.path ? ` in ${code(a.path)}` : ''}`;
    case 'read_file': return `Read ${code(a.path)}${a.start_line ? ` lines ${a.start_line}–${a.end_line || ''}` : ''}`;
    case 'write_file': return r && !r.error ? `${r.created ? 'Created' : 'Wrote'} ${code(a.path)} <span class="cpg-ast-stat"><span class="add">+${r.added ?? 0}</span> <span class="del">−${r.removed ?? 0}</span></span>` : `Writing ${code(a.path)}`;
    case 'edit_file': return r && !r.error ? `Edited ${code(a.path)} <span class="cpg-ast-stat"><span class="add">+${r.added ?? 0}</span> <span class="del">−${r.removed ?? 0}</span></span>` : `Editing ${code(a.path)}`;
    case 'delete_path': return `Deleted ${code(a.path)}`;
    case 'move_path': return `Moved ${code(a.from)} → ${code(a.to)}`;
    case 'search_code': return `Searched for ${code(a.query)}${r && !r.error ? ` · ${r.matches} match${r.matches === 1 ? '' : 'es'}` : ''}`;
    case 'run_command': return r ? `Ran ${code(a.command)} <span class="cpg-dim">· ${r.timed_out ? 'still running' : `exit ${r.exit_code}`}</span>` : `Running ${code(a.command)}`;
    case 'get_problems': return r ? `Checked problems · ${r.count ?? 0}` : 'Checking problems';
    case 'open_preview': return `Opened preview${a.port ? ` localhost:${a.port}` : a.path ? ` ${code(a.path)}` : ''}`;
    case 'interact_with_preview': return `Tested the page (${(a.actions || []).length} action${(a.actions || []).length === 1 ? '' : 's'})`;
    default: return esc(name);
  }
}

function toolBody(name, a = {}, r = {}) {
  if (r.error) return `<div class="cpg-ast-error">${esc(r.error)}</div>${r.hint ? `<pre>${esc(r.hint)}</pre>` : ''}`;
  switch (name) {
    case 'run_command': return `<pre class="cpg-ast-out">${esc(r.output || '(no output)')}</pre>`;
    case 'read_file': return `<button type="button" class="cpg-link" data-open-file="${esc(a.path)}" data-line="${a.start_line || 1}">Open ${esc(a.path)}</button>`;
    case 'write_file': case 'edit_file': return `<button type="button" class="cpg-link" data-open-file="${esc(a.path)}">Open ${esc(a.path)}</button>`;
    case 'search_code': return `<pre class="cpg-ast-out">${esc(r.results || '')}</pre>`;
    case 'list_files': return `<pre class="cpg-ast-out">${esc(r.files || '')}</pre>`;
    case 'get_problems': return `<pre class="cpg-ast-out">${esc(r.problems || '')}</pre>`;
    case 'open_preview': case 'interact_with_preview': {
      const parts = [];
      if (r.title) parts.push(`<div><b>${esc(r.title)}</b></div>`);
      if (r.results) parts.push(`<div>${r.results.map((x) => `${x.ok ? '✓' : '✕'} ${esc(x.action)} ${esc(x.selector || x.key || '')}${x.error ? ` — ${esc(x.error)}` : ''}`).join('<br>')}</div>`);
      if (r.console) parts.push(`<pre class="cpg-ast-out">${esc(r.console)}</pre>`);
      if (r.text) parts.push(`<pre class="cpg-ast-out">${esc(r.text.slice(0, 1500))}</pre>`);
      return parts.join('') || '<span class="cpg-dim">No output</span>';
    }
    default: return `<pre class="cpg-ast-out">${esc(JSON.stringify(r, null, 2).slice(0, 3000))}</pre>`;
  }
}

export { diffHtml };
