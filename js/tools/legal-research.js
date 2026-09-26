/* ============================================================
   Legal Research Planner — issues, threshold points, doctrines,
   statutes, Boolean queries for LawPavilion, LegalPedia,
   NigeriaLII and Google Scholar, an authority matrix and a
   research log. Plans are saved in this browser (localStorage)
   and export as Markdown.

   The planner names statutes and doctrines only; authorities
   are entered by the researcher, then parsed and weighed
   against the court where the matter is.
   ============================================================ */

import { buildPlan, assessAuthority, planMarkdown, AREAS } from '../lib/legal/research.js';
import { FORUMS, COURTS } from '../lib/legal/courts.js';
import { esc, icon, note, download, slug, copyToClipboard, printMarkdown, plural } from '../lib/legal/view.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { tbConfirm } from '../lib/dialog.js';

const ID = 'legal-research';
const KEY = 'toolbox_legal_research_v1';
const STATUS = [['to find', 'To find'], ['to verify', 'To verify'], ['supports', 'Supports'], ['against', 'Against'], ['distinguishable', 'Distinguishable'], ['read', 'Read in full']];
const WEIGHT_TONE = { binding: 'strong', self: 'strong', statute: 'strong', coordinate: 'mid', persuasive: 'soft', 'not-binding': 'soft', unknown: 'none' };

function loadStore() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object' && s.projects) return s; } catch { /* storage blocked */ }
  return { current: null, projects: {} };
}
function saveStore(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

export default {
  render(container, { analytics } = {}) {
    this.cleanup = [];
    this.prefs = getToolSettings(ID);
    const store = loadStore();
    container.innerHTML = `
      <div class="lg lg-research">
        <section class="lg-card lg-input">
          <div class="lg-bar">
            <div class="lg-proj">
              <select class="tool-select" id="lr-projects" aria-label="Saved research"></select>
              <button type="button" class="btn btn-secondary btn-sm" id="lr-new">${icon('plus', 14)}<span>New</span></button>
              <button type="button" class="btn btn-ghost btn-sm" id="lr-delete">${icon('trash', 14)}<span>Delete</span></button>
            </div>
            <span class="lg-source-status">Saved in this browser</span>
          </div>
          <label class="lg-field"><span>Research question or facts</span>
            <textarea class="tool-textarea lg-textarea" id="lr-question" rows="4" placeholder="e.g. Whether a mortgagee can sell mortgaged land by private treaty without the Governor's consent and without first serving a notice of demand"></textarea></label>
          <div class="lg-form-grid">
            <label class="lg-field"><span>Area of law</span><select class="tool-select" id="lr-area"><option value="auto">Detect from the question</option>${Object.entries(AREAS).map(([k, a]) => `<option value="${k}">${esc(a.label)}</option>`).join('')}</select></label>
            <label class="lg-field"><span>Court where the matter is</span><select class="tool-select" id="lr-forum">${FORUMS.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select></label>
            <label class="lg-field"><span>Stage</span><select class="tool-select" id="lr-stage"><option value="">Detect</option><option value="civil">Civil trial</option><option value="criminal">Criminal trial</option><option value="appeal">Appeal</option></select></label>
          </div>
          <div class="lg-bar"><div class="lg-bar-main"><button type="button" class="btn btn-primary" id="lr-build">Build research plan</button></div></div>
        </section>
        <div id="lr-out" class="lg-out" hidden></div>
      </div>`;
    const $ = (s) => container.querySelector(s);
    const out = $('#lr-out');
    $('#lr-forum').value = this.prefs.forum || 'HC';
    let proj = store.current ? store.projects[store.current] : null;

    const persist = () => { if (proj) { proj.updatedAt = Date.now(); store.projects[proj.id] = proj; store.current = proj.id; } saveStore(store); fillProjects(); };
    const fillProjects = () => {
      const list = Object.values(store.projects).sort((a, b) => b.updatedAt - a.updatedAt);
      $('#lr-projects').innerHTML = list.length ? list.map(p => `<option value="${p.id}" ${proj && p.id === proj.id ? 'selected' : ''}>${esc(p.plan.question.slice(0, 80))}${p.plan.question.length > 80 ? '…' : ''}</option>`).join('') : '<option value="">No saved research yet</option>';
      $('#lr-delete').disabled = !proj;
    };

    const build = () => {
      const q = $('#lr-question').value.trim();
      if (q.length < 12) { $('#lr-question').focus(); return; }
      analytics?.started?.();
      const plan = buildPlan(q, { area: $('#lr-area').value, forum: $('#lr-forum').value, stage: $('#lr-stage').value || undefined });
      if (!this.prefs.scholar) plan.queries = plan.queries.filter(x => x.db !== 'scholar');
      // Keep work already done on the same question.
      const same = proj && proj.plan.question === plan.question ? proj : null;
      if (same) {
        for (const r of plan.matrix) { const old = same.plan.matrix.find(x => x.id === r.id); if (old) Object.assign(r, { authority: old.authority, proposition: old.proposition, status: old.status }); }
        proj = { ...same, plan };
      } else proj = { id: `r${Date.now().toString(36)}`, plan, checks: {}, log: [], updatedAt: Date.now() };
      reassess();
      persist();
      render();
      analytics?.completed?.();
    };
    const reassess = () => { for (const r of proj.plan.matrix) r.assessment = r.authority ? assessAuthority(r.authority, proj.plan.forum) : null; };

    const assessHTML = (a) => (a ? `<span class="lg-assess">${a.ok ? `<span class="lg-weight" data-tone="${WEIGHT_TONE[a.weightStatus] || 'none'}" title="${esc(a.reason || '')}">${esc(a.weight)}</span>${esc([a.court, a.kind === 'case' ? a.normalised : ''].filter(Boolean).join(' · '))}${a.warnings?.length ? ` · ${esc(a.warnings.join('; '))}` : ''}` : esc(a.note)}</span>` : '');

    const render = () => {
      if (!proj) { out.hidden = true; return; }
      const p = proj.plan;
      $('#lr-question').value = p.question;
      $('#lr-area').value = p.area;
      $('#lr-forum').value = p.forum;
      const found = p.matrix.filter(r => r.authority).length;
      out.innerHTML = `
        <section class="lg-card lg-head">
          <div class="lg-kicker"><span class="lg-badge">${esc(p.areaLabel)}</span><span>Before the ${esc(COURTS[p.forum]?.short || p.forum)} · ${esc({ civil: 'civil trial', criminal: 'criminal trial', appeal: 'appeal' }[p.stage] || p.stage)}</span></div>
          <h2 class="lg-title">${esc(p.issues[0].text)}</h2>
          <div class="lg-stats">
            <div class="lg-stat"><b>${p.issues.length}</b><span>Issues</span></div>
            <div class="lg-stat"><b>${p.statutes.length}</b><span>Provisions to read</span></div>
            <div class="lg-stat"><b>${found}/${p.matrix.length}</b><span>Matrix slots filled</span></div>
            <div class="lg-stat"><b>${proj.log.length}</b><span>Searches logged</span></div>
          </div>
          <div class="lg-head-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-act="copy">${icon('copy', 14)}<span>Copy plan</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="md">${icon('download', 14)}<span>Markdown</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="print">${icon('print', 14)}<span>Print / PDF</span></button>
          </div>
        </section>
        <div class="lg-grid">
          <div class="lg-main">
            <section class="lg-sec"><header class="lg-sec-head"><h3>Issues</h3><span class="lg-sec-sub">Reframe them to fit your facts</span></header>
              <ol class="lg-items is-numbered">${p.issues.map(i => `<li><p>${esc(i.text)}</p></li>`).join('')}</ol></section>
            <section class="lg-sec"><header class="lg-sec-head"><h3>Doctrines and provisions</h3><span class="lg-sec-sub">Read the current text of each provision</span></header>
              ${p.doctrines.length ? `<ul class="lg-doctrines">${p.doctrines.map(d => `<li><strong>${esc(d.label)}</strong>${d.statutes.length ? `<span class="lg-provs">${d.statutes.map(s => `<code>${esc(s)}</code>`).join('')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="lg-empty">Add more detail to the question to match doctrines.</p>'}</section>
            <section class="lg-sec"><header class="lg-sec-head"><h3>Search queries</h3><span class="lg-sec-sub">Copy, run, then log what you found</span></header>
              <div class="lg-queries">${p.queries.map((q, i) => `<div class="lg-query"><strong>${esc(q.label)}<small>${esc(q.note)}</small></strong><code>${esc(q.query)}</code>
                <span class="lg-query-actions"><button type="button" class="btn btn-icon btn-sm" data-copyq="${i}" title="Copy query" aria-label="Copy query">${icon('copy', 14)}</button>${q.url ? `<a class="btn btn-icon btn-sm" href="${esc(q.url)}" target="_blank" rel="noopener" title="Open search" aria-label="Open ${esc(q.label)}">${icon('ext', 14)}</a>` : ''}<button type="button" class="btn btn-icon btn-sm" data-logq="${i}" title="Log this search" aria-label="Log this search">${icon('plus', 14)}</button></span></div>`).join('')}</div></section>
          </div>
          <aside class="lg-aside">
            <section class="lg-card lg-facts"><h3 class="lg-aside-title">Threshold points</h3>
              <ul class="lg-checklist">${p.threshold.map(t => `<li><label><input type="checkbox" data-check="${t.id}" ${proj.checks[t.id] ? 'checked' : ''}><span>${esc(t.text)}</span></label></li>`).join('')}</ul></section>
          </aside>
        </div>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Authority matrix</h3><span class="lg-sec-sub">Type a citation: it is normalised and weighed before the ${esc(COURTS[p.forum]?.short || '')}</span></header>
          <div class="lg-table-wrap"><table class="lg-matrix"><thead><tr><th>Slot</th><th>Authority</th><th>Proposition</th><th>Status</th></tr></thead><tbody>
            ${p.issues.map((iss, n) => `<tr class="lg-issue-row"><td colspan="4">${n + 1}. ${esc(iss.text.length > 140 ? `${iss.text.slice(0, 139)}…` : iss.text)}</td></tr>${p.matrix.filter(r => r.issue === iss.id).map(r => `
              <tr><td class="lg-slot">${esc(r.label)}</td>
                <td><input class="tool-input" data-row="${r.id}" data-field="authority" value="${esc(r.authority)}" placeholder="${r.kind === 'statute' ? 'Act and section' : 'e.g. (2019) 10 NWLR (Pt. 1680) 1'}">${assessHTML(r.assessment)}</td>
                <td><input class="tool-input" data-row="${r.id}" data-field="proposition" value="${esc(r.proposition)}" placeholder="What it decides"></td>
                <td><select class="tool-select" data-row="${r.id}" data-field="status">${STATUS.map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}`).join('')}
          </tbody></table></div>
        </section>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Research log</h3><span class="lg-sec-sub">${plural(proj.log.length, 'entry', 'entries')}</span></header>
          <form class="lg-log-form" id="lr-log-form">
            <select class="tool-select" name="db" aria-label="Database">${['LawPavilion', 'LegalPedia', 'NigeriaLII', 'Google Scholar', 'Law report (print)', 'Library', 'Other'].map(d => `<option>${d}</option>`).join('')}</select>
            <input class="tool-input" name="query" placeholder="Query or book searched" aria-label="Query">
            <input class="tool-input" name="note" placeholder="What you found" aria-label="Result">
            <button type="submit" class="btn btn-secondary btn-sm">Add</button>
          </form>
          ${proj.log.length ? `<ul class="lg-log">${proj.log.slice().reverse().map((e, i) => `<li><time>${esc(new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</time><strong>${esc(e.db)}</strong><div><code>${esc(e.query)}</code>${e.note ? `<p>${esc(e.note)}</p>` : ''}</div><button type="button" class="btn btn-icon btn-sm" data-dellog="${proj.log.length - 1 - i}" aria-label="Remove entry">${icon('x', 14)}</button></li>`).join('')}</ul>` : ''}
        </section>
        ${note('The plan names statutes and doctrines from the question only. It never suggests cases: find, read and verify every authority yourself before citing it.')}`;
      out.hidden = false;
    };

    out.addEventListener('click', (e) => {
      const cq = e.target.closest('[data-copyq]');
      if (cq) { copyToClipboard(proj.plan.queries[cq.dataset.copyq].query, cq); return; }
      const lq = e.target.closest('[data-logq]');
      if (lq) { const q = proj.plan.queries[lq.dataset.logq]; const f = out.querySelector('#lr-log-form'); f.db.value = [...f.db.options].some(o => o.value === q.label) ? q.label : 'Other'; f.query.value = q.query; f.note.focus(); return; }
      const dl = e.target.closest('[data-dellog]');
      if (dl) { proj.log.splice(Number(dl.dataset.dellog), 1); persist(); render(); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const md = planMarkdown(proj.plan, proj.log);
      if (a.dataset.act === 'copy') copyToClipboard(md, a);
      if (a.dataset.act === 'md') { download(`research-${slug(proj.plan.question.slice(0, 50))}.md`, md); analytics?.downloaded?.({ fileCount: 1 }); }
      if (a.dataset.act === 'print') printMarkdown('Research plan', md);
    });
    out.addEventListener('change', (e) => {
      const c = e.target.closest('[data-check]');
      if (c) { proj.checks[c.dataset.check] = c.checked; persist(); return; }
      const f = e.target.closest('[data-row]');
      if (f) {
        const row = proj.plan.matrix.find(r => r.id === f.dataset.row);
        row[f.dataset.field] = f.value;
        if (f.dataset.field === 'authority') { row.assessment = f.value ? assessAuthority(f.value, proj.plan.forum) : null; if (f.value && row.status === 'to find') row.status = 'to verify'; persist(); render(); }
        else persist();
      }
    });
    out.addEventListener('submit', (e) => {
      if (e.target.id !== 'lr-log-form') return;
      e.preventDefault();
      const f = e.target;
      if (!f.query.value.trim()) { f.query.focus(); return; }
      proj.log.push({ at: new Date().toISOString(), db: f.db.value, query: f.query.value.trim(), note: f.note.value.trim() });
      persist(); render();
    });
    $('#lr-build').addEventListener('click', build);
    $('#lr-new').addEventListener('click', () => { proj = null; store.current = null; saveStore(store); fillProjects(); $('#lr-question').value = ''; out.hidden = true; $('#lr-question').focus(); });
    $('#lr-delete').addEventListener('click', async () => {
      if (!proj) return;
      const ok = await tbConfirm('Delete this research plan and its log?', { title: 'Delete research', confirmText: 'Delete', destructive: true });
      if (!ok) return;
      delete store.projects[proj.id]; proj = null; store.current = null; saveStore(store); fillProjects(); out.hidden = true; $('#lr-question').value = '';
    });
    $('#lr-projects').addEventListener('change', (e) => { proj = store.projects[e.target.value] || null; store.current = proj?.id || null; saveStore(store); if (proj) { reassess(); render(); } });
    this.cleanup.push(onToolSettings(ID, (p) => { this.prefs = p; }));
    fillProjects();
    if (proj) { reassess(); render(); }
  },

  destroy() {
    for (const fn of this.cleanup || []) { try { fn(); } catch { /* ignore */ } }
    this.cleanup = [];
  },
};
