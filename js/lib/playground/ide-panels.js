/* ============================================================
   Sidebar panels: Search (find & replace in files) and Source Control
   (git status, stage/unstage/discard, commit, branches, push/pull).
   ============================================================ */

import { basename, dirname } from './paths.js';
import { isBinaryPath, langInfo, languageOf } from './languages.js';
import { toText } from './vfs.js';
import { unifiedDiff } from './commands-core.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fileIcon(path, type = 'file', open = false) {
  if (type === 'dir') {
    return `<svg class="cpg-ico cpg-ico-dir" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">${open ? '<path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/><path d="M3 19l2.5-8h16L19 19z"/>' : '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'}</svg>`;
  }
  const info = langInfo(languageOf(path));
  const abbr = info.abbr || '·';
  return `<span class="cpg-ico cpg-ico-file" style="--c:${info.color}" aria-hidden="true">${esc(abbr.length > 3 ? abbr.slice(0, 3) : abbr)}</span>`;
}

/* ============================================================
   Search
   ============================================================ */

export class SearchPanel {
  constructor(el, { vfs, openAt }) {
    this.el = el;
    this.vfs = vfs;
    this.openAt = openAt;
    this.opts = { regex: false, caseSensitive: false, word: false };
    el.innerHTML = `
      <div class="cpg-panel-head"><span>Search</span></div>
      <div class="cpg-search-form">
        <div class="cpg-search-row">
          <input type="search" class="cpg-input" id="cpg-search-q" placeholder="Search" aria-label="Search in files">
          <button type="button" class="cpg-toggle" data-opt="caseSensitive" title="Match case">Aa</button>
          <button type="button" class="cpg-toggle" data-opt="word" title="Match whole word"><u>ab</u></button>
          <button type="button" class="cpg-toggle" data-opt="regex" title="Use regular expression">.*</button>
        </div>
        <div class="cpg-search-row">
          <input type="text" class="cpg-input" id="cpg-search-r" placeholder="Replace" aria-label="Replace with">
          <button type="button" class="cpg-btn-sm" id="cpg-search-replace-all" title="Replace all">Replace all</button>
        </div>
        <input type="text" class="cpg-input" id="cpg-search-inc" placeholder="Files to include (e.g. src/**/*.js)" aria-label="Files to include">
      </div>
      <div class="cpg-search-summary" id="cpg-search-summary"></div>
      <div class="cpg-search-results" id="cpg-search-results"></div>`;
    this.q = el.querySelector('#cpg-search-q');
    this.r = el.querySelector('#cpg-search-r');
    this.inc = el.querySelector('#cpg-search-inc');
    this.results = el.querySelector('#cpg-search-results');
    this.summary = el.querySelector('#cpg-search-summary');
    const run = () => { clearTimeout(this.t); this.t = setTimeout(() => this.search(), 200); };
    this.q.addEventListener('input', run);
    this.inc.addEventListener('input', run);
    el.querySelectorAll('.cpg-toggle').forEach((b) => b.addEventListener('click', () => {
      this.opts[b.dataset.opt] = !this.opts[b.dataset.opt];
      b.classList.toggle('on', this.opts[b.dataset.opt]);
      this.search();
    }));
    el.querySelector('#cpg-search-replace-all').addEventListener('click', () => this.replaceAll());
    this.results.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-line]');
      if (hit) this.openAt(hit.dataset.file, Number(hit.dataset.line), Number(hit.dataset.col));
      const rep = e.target.closest('[data-replace-file]');
      if (rep) { e.stopPropagation(); this.replaceAll(rep.dataset.replaceFile); }
    });
  }

  focus(text) {
    if (text) this.q.value = text;
    this.q.focus();
    this.q.select();
    this.search();
  }

  regex() {
    const q = this.q.value;
    if (!q) return null;
    let src = this.opts.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (this.opts.word) src = `\\b${src}\\b`;
    try { return new RegExp(src, this.opts.caseSensitive ? 'g' : 'gi'); } catch { return null; }
  }

  search() {
    const re = this.regex();
    if (!re) { this.results.innerHTML = ''; this.summary.textContent = this.q.value && this.opts.regex ? 'Invalid regular expression' : ''; return; }
    const inc = this.inc.value.trim();
    const incRe = inc ? new RegExp(`^${inc.split(',').map((g) => g.trim().replace(/[.+^$()|\\]/g, '\\$&').replace(/\*\*\/?/g, '§').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/§/g, '(?:.*/)?')).join('|')}$`) : null;
    let total = 0;
    let fileCount = 0;
    const html = [];
    for (const f of this.vfs.listFiles()) {
      if (/(^|\/)(node_modules|\.git|dist)\//.test(f) || isBinaryPath(f)) continue;
      if (incRe && !incRe.test(f) && !incRe.test(basename(f))) continue;
      const lines = this.vfs.readFile(f).split('\n');
      const hits = [];
      lines.forEach((l, i) => {
        re.lastIndex = 0;
        const m = re.exec(l);
        if (m) hits.push({ line: i + 1, col: m.index + 1, text: l, len: m[0].length || 1 });
      });
      if (!hits.length) continue;
      fileCount++;
      total += hits.length;
      html.push(`<div class="cpg-search-file"><div class="cpg-search-file-head">${fileIcon(f)}<b>${esc(basename(f))}</b><span class="cpg-dim">${esc(dirname(f))}</span><span class="cpg-badge">${hits.length}</span>${this.r.value || this.r.value === '' ? `<button type="button" class="cpg-icon-btn" data-replace-file="${esc(f)}" title="Replace in this file">⇄</button>` : ''}</div>`);
      for (const h of hits.slice(0, 200)) {
        const start = Math.max(0, h.col - 40);
        const before = h.text.slice(start, h.col - 1);
        const match = h.text.slice(h.col - 1, h.col - 1 + h.len);
        const after = h.text.slice(h.col - 1 + h.len, h.col - 1 + h.len + 80);
        html.push(`<div class="cpg-search-hit" data-file="${esc(f)}" data-line="${h.line}" data-col="${h.col}"><span class="cpg-dim">${h.line}</span> ${start ? '…' : ''}${esc(before.trimStart())}<mark>${esc(match)}</mark>${esc(after)}</div>`);
      }
      html.push('</div>');
      if (total > 2000) break;
    }
    this.summary.textContent = total ? `${total} result${total === 1 ? '' : 's'} in ${fileCount} file${fileCount === 1 ? '' : 's'}` : 'No results found.';
    this.results.innerHTML = html.join('');
  }

  replaceAll(onlyFile = null) {
    const re = this.regex();
    if (!re) return;
    let n = 0;
    for (const f of onlyFile ? [onlyFile] : this.vfs.listFiles()) {
      if (/(^|\/)(node_modules|\.git)\//.test(f) || isBinaryPath(f)) continue;
      const text = this.vfs.readFile(f);
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      const next = text.replace(re, () => { n++; return this.r.value; });
      this.vfs.writeFile(f, next);
    }
    this.summary.textContent = `Replaced ${n} occurrence${n === 1 ? '' : 's'}.`;
    setTimeout(() => this.search(), 50);
  }
}

/* ============================================================
   Source control
   ============================================================ */

export class GitPanel {
  /**
   * @param {HTMLElement} el
   * @param {object} o  { git: GitStore, vfs, run(cmd), openDiff({title, diff}), openFile(path), author() }
   */
  constructor(el, o) {
    this.el = el;
    this.o = o;
    this.render = this.render.bind(this);
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('keydown', (e) => {
      if (e.target.id === 'cpg-git-msg' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.commit(); }
    });
  }

  root() { return this.o.git.findRoot(this.o.cwd?.() || '') ?? this.o.git.findRoot(''); }

  async render() {
    const git = this.o.git;
    const root = this.root();
    if (root === null) {
      this.el.innerHTML = `
        <div class="cpg-panel-head"><span>Source Control</span></div>
        <div class="cpg-empty">
          <p>This workspace isn't a Git repository yet. Git tracks every version of your code and lets you publish it to GitHub.</p>
          <button type="button" class="cpg-btn cpg-btn-primary" data-git="init">Initialize Repository</button>
          <button type="button" class="cpg-btn" data-git="clone">Clone from GitHub…</button>
        </div>`;
      return;
    }
    const repo = git.repo(root);
    let st;
    try { st = await git.status(root); } catch (err) { this.el.innerHTML = `<div class="cpg-empty">${esc(err.message)}</div>`; return; }
    const log = await git.log(repo, git.headCommitId(repo), 8).catch(() => []);
    const remote = Object.keys(repo.remotes)[0];
    const row = (p, kind, actions, group) => `
      <div class="cpg-scm-row" data-path="${esc(p)}" data-group="${group}">
        ${fileIcon(p)}<span class="cpg-scm-name" title="${esc(p)}">${esc(basename(p))}</span><span class="cpg-dim cpg-scm-dir">${esc(dirname(p))}</span>
        <span class="cpg-scm-actions">${actions}</span>
        <span class="cpg-scm-kind cpg-scm-${kind[0]}" title="${kind}">${kind === 'new file' || kind === 'untracked' ? 'U' : kind === 'deleted' ? 'D' : 'M'}</span>
      </div>`;
    const unstagedAll = [...st.unstaged.map((u) => ({ path: u.path, kind: u.kind })), ...st.untracked.map((p) => ({ path: p, kind: 'untracked' }))];
    this.el.innerHTML = `
      <div class="cpg-panel-head"><span>Source Control</span>
        <span class="cpg-panel-actions">
          <button type="button" class="cpg-icon-btn" data-git="refresh" title="Refresh">⟳</button>
          <button type="button" class="cpg-icon-btn" data-git="pull" title="Pull${remote ? ` from ${remote}` : ''}">↓</button>
          <button type="button" class="cpg-icon-btn" data-git="push" title="Push${remote ? ` to ${remote}` : ''}">↑</button>
        </span>
      </div>
      <div class="cpg-scm-branch"><button type="button" class="cpg-link" data-git="branch" title="Switch branch">⎇ ${esc(repo.head.detached ? repo.head.detached.slice(0, 7) : repo.head.branch)}</button>${remote ? `<span class="cpg-dim" title="${esc(repo.remotes[remote])}">${esc(remote)}: ${esc(repo.remotes[remote].replace(/^https:\/\/github\.com\//, ''))}</span>` : '<button type="button" class="cpg-link" data-git="remote">+ Add GitHub remote</button>'}</div>
      ${repo.merging ? '<div class="cpg-scm-warn">Merge in progress — resolve conflicts, stage the files, then commit.</div>' : ''}
      <textarea id="cpg-git-msg" class="cpg-input cpg-scm-msg" rows="2" placeholder="Message (Ctrl+Enter to commit on '${esc(repo.head.branch)}')"></textarea>
      <button type="button" class="cpg-btn cpg-btn-primary cpg-scm-commit" data-git="commit">✓ Commit${st.staged.length ? '' : unstagedAll.length ? ' all' : ''}</button>
      ${st.staged.length ? `<div class="cpg-scm-group"><div class="cpg-scm-group-head">Staged Changes <span class="cpg-badge">${st.staged.length}</span><button type="button" class="cpg-icon-btn" data-git="unstage-all" title="Unstage all">−</button></div>${st.staged.map((s) => row(s.path, s.kind, '<button type="button" class="cpg-icon-btn" data-git="unstage" title="Unstage">−</button>', 'staged')).join('')}</div>` : ''}
      <div class="cpg-scm-group"><div class="cpg-scm-group-head">Changes <span class="cpg-badge">${unstagedAll.length}</span>${unstagedAll.length ? '<button type="button" class="cpg-icon-btn" data-git="stage-all" title="Stage all">+</button>' : ''}</div>
        ${unstagedAll.length ? unstagedAll.map((u) => row(u.path, u.kind, `${u.kind !== 'untracked' ? '<button type="button" class="cpg-icon-btn" data-git="discard" title="Discard changes">↺</button>' : ''}<button type="button" class="cpg-icon-btn" data-git="stage" title="Stage">+</button>`, 'changes')).join('') : '<div class="cpg-dim cpg-pad">No changes</div>'}
      </div>
      <div class="cpg-scm-group"><div class="cpg-scm-group-head">History</div>
        ${log.length ? log.map((c) => `<div class="cpg-scm-commit-row" title="${esc(c.message)}"><code>${c.id.slice(0, 7)}</code> ${esc(c.message.split('\n')[0])} <span class="cpg-dim">${timeAgo(c.date)}</span></div>`).join('') : '<div class="cpg-dim cpg-pad">No commits yet</div>'}
      </div>`;
  }

  async onClick(e) {
    const btn = e.target.closest('[data-git]');
    const rowEl = e.target.closest('.cpg-scm-row');
    const git = this.o.git;
    const root = this.root();
    if (!btn && rowEl) { this.showDiff(rowEl.dataset.path, rowEl.dataset.group); return; }
    if (!btn) return;
    const action = btn.dataset.git;
    const path = rowEl?.dataset.path;
    const abs = (p) => (root ? `${root}/${p}` : p);
    try {
      switch (action) {
        case 'init': await this.o.run('git init'); break;
        case 'clone': this.o.cloneDialog?.(); return;
        case 'refresh': break;
        case 'push': await this.o.run('git push'); break;
        case 'pull': await this.o.run('git pull'); break;
        case 'branch': {
          const repo = git.repo(root);
          const name = await this.o.ask(`Switch to branch (existing: ${Object.keys(repo.branches).join(', ')}), or type a new name:`, repo.head.branch);
          if (!name || name === repo.head.branch) return;
          await this.o.run(name in repo.branches ? `git switch ${name}` : `git switch -c ${name}`);
          break;
        }
        case 'remote': {
          const url = await this.o.ask('GitHub repository URL (https://github.com/you/repo.git):', '');
          if (url) await this.o.run(`git remote add origin ${url}`);
          break;
        }
        case 'commit': await this.commit(); return;
        case 'stage': await git.add(root, [path]); break;
        case 'stage-all': await git.add(root, [], { all: true }); break;
        case 'unstage': case 'unstage-all': {
          const repo = git.repo(root);
          const head = await git.commitTree(git.headCommitId(repo));
          const targets = action === 'unstage' ? [path] : Object.keys({ ...repo.index, ...head });
          for (const p of targets) { if (head[p]) repo.index[p] = head[p]; else delete repo.index[p]; }
          await git.saveMeta();
          break;
        }
        case 'discard': {
          if (!(await this.o.confirm(`Discard changes to ${path}? This can't be undone.`))) return;
          const repo = git.repo(root);
          const h = repo.index[path];
          if (h) this.o.vfs.writeFile(abs(path), await git.getObject(h));
          break;
        }
        default: break;
      }
    } catch (err) {
      this.o.toast?.(err.message || String(err));
    }
    this.render();
  }

  async commit() {
    const git = this.o.git;
    const root = this.root();
    const msgEl = this.el.querySelector('#cpg-git-msg');
    const msg = msgEl?.value.trim();
    if (!msg) { msgEl?.focus(); this.o.toast?.('Type a commit message first.'); return; }
    const st = await git.status(root);
    if (!st.staged.length) {
      if (!st.unstaged.length && !st.untracked.length) { this.o.toast?.('Nothing to commit.'); return; }
      await git.add(root, [], { all: true });
    }
    const repo = git.repo(root);
    const parents = repo.merging ? [git.headCommitId(repo), repo.merging.theirs].filter(Boolean) : null;
    await git.commit(root, msg, { author: this.o.author(), parentsOverride: parents });
    delete repo.merging;
    await git.saveMeta();
    this.o.toast?.('Committed.');
    this.o.onCommitted?.();
    this.render();
  }

  async showDiff(path, group) {
    const git = this.o.git;
    const root = this.root();
    const repo = git.repo(root);
    const abs = root ? `${root}/${path}` : path;
    const head = await git.commitTree(git.headCommitId(repo));
    let before = '';
    let after = '';
    if (group === 'staged') {
      before = head[path] ? toText(await git.getObject(head[path])) : '';
      after = repo.index[path] ? toText(await git.getObject(repo.index[path])) : '';
    } else {
      before = repo.index[path] ? toText(await git.getObject(repo.index[path])) : '';
      after = this.o.vfs.isFile(abs) ? this.o.vfs.readFile(abs) : '';
    }
    this.o.openDiff({ title: `${path} ${group === 'staged' ? '(staged)' : '(working tree)'}`, diff: unifiedDiff(before, after, `a/${path}`, `b/${path}`) || 'No differences.', path: abs });
  }
}

export function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Render a unified diff as HTML lines. */
export function diffHtml(diff) {
  return String(diff).split('\n').map((l) => {
    const cls = l.startsWith('+++') || l.startsWith('---') ? 'hd' : l.startsWith('@@') ? 'hunk' : l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : '';
    return `<div class="cpg-diff-line ${cls}">${esc(l) || '&nbsp;'}</div>`;
  }).join('');
}
