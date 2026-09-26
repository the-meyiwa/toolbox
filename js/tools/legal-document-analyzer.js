/* ============================================================
   Legal Document Analyzer — contract review for Nigerian practice.

   Upload a PDF, Word or text agreement and get: parties, a
   clause map with missing clauses, risk flags with explanations
   and suggested redlines, an execution check, stamp duty and
   registration reminders, defined terms, and obligations with
   deadlines that can be added to the Calendar or saved as .ics.
   All on-device; flags are prompts for review, not advice.
   ============================================================ */

import { analyzeContract, contractMarkdown, redlineSummary, DOC_TYPES } from '../lib/legal/contract.js';
import { obligationToEvent } from '../lib/legal/obligations.js';
import { formatDate } from '../lib/legal/text.js';
import { esc, icon, pageChip, note, sourceCard, bindSource, download, slug, copyToClipboard, printMarkdown, plural } from '../lib/legal/view.js';
import { addEvent, loadEvents, exportToICS } from '../lib/calendar-store.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { showToast } from '../utils.js';

const ID = 'legal-document-analyzer';
const SEV_LABEL = { high: 'High', medium: 'Medium', low: 'Low', info: 'Note' };
const STATUS_ICON = { ok: 'check', warn: 'alert', missing: 'x', info: 'info' };

export default {
  render(container, { analytics, artifact } = {}) {
    this.cleanup = [];
    this.prefs = getToolSettings(ID);
    container.innerHTML = `
      <div class="lg lg-analyzer">
        <section class="lg-card lg-input">
          ${sourceCard('lda', { label: 'Agreement, lease or deed', placeholder: 'Paste the agreement: title, parties, recitals, clauses and the execution block…', hint: 'PDF, Word (.docx) or text' })}
          <div class="lg-bar">
            <div class="lg-bar-main">
              <button type="button" class="btn btn-primary" id="lda-run">Review document</button>
              <button type="button" class="btn btn-ghost" id="lda-clear">Clear</button>
            </div>
            <label class="lg-inline">Document type
              <select class="tool-select" id="lda-type"><option value="auto">Detect</option>${Object.entries(DOC_TYPES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('')}</select>
            </label>
          </div>
        </section>
        <div id="lda-out" class="lg-out" hidden></div>
      </div>`;
    const $ = (s) => container.querySelector(s);
    const out = $('#lda-out');
    const src = bindSource(container, 'lda', { onLoaded: () => run() });
    this.cleanup.push(src.off);
    let a = null;
    let tab = 'review';
    let anchors = {};
    const picked = new Set();
    const dates = {};

    const run = (keepAnchors = false) => {
      const text = src.textarea.value.trim();
      if (text.length < 80) { src.setStatus('Paste or drop an agreement first.', 'warn'); return; }
      if (!keepAnchors) { anchors = {}; picked.clear(); for (const k of Object.keys(dates)) delete dates[k]; }
      analytics?.started?.();
      const type = $('#lda-type').value;
      a = analyzeContract(text, { state: this.prefs.state, docType: type === 'auto' ? null : type, anchors });
      if (!keepAnchors) for (const o of a.obligations) if (o.deadline?.due) picked.add(o.id);
      render();
      analytics?.completed?.();
    };

    const flagHTML = (f) => `
      <li class="lg-flag" data-sev="${f.severity}">
        <div class="lg-flag-head"><strong>${esc(f.title)}</strong><span class="lg-sev" data-sev="${f.severity}">${SEV_LABEL[f.severity]}</span></div>
        ${f.where || f.page ? `<span class="lg-where">${esc(f.where || '')}${pageChip(f.page)}</span>` : ''}
        <p>${esc(f.why)}</p>
        ${f.evidence ? `<blockquote>${esc(f.evidence)}</blockquote>` : ''}
        ${f.suggestion ? `<p class="lg-suggest"><b>Suggested:</b> ${esc(f.suggestion)}</p>` : ''}
      </li>`;

    const render = () => {
      const flags = a.flags.filter(f => this.prefs.showInfo || f.severity !== 'info');
      const issues = flags.filter(f => f.category !== 'missing' || f.severity !== 'info');
      const flagsByClause = {};
      for (const f of a.flags) { const m = (f.where || '').match(/^Clause (\d+)/); if (m && f.severity !== 'info') (flagsByClause[m[1]] ||= []).push(f); }
      const obs = a.obligations;
      const dueOf = (o) => dates[o.id] ?? o.deadline?.due ?? '';
      out.innerHTML = `
        <section class="lg-card lg-head">
          <div class="lg-kicker"><span class="lg-badge">${esc(a.docTypeLabel)}</span>${a.pages ? `<span>${plural(a.pages, 'page')}</span>` : ''}${src.file ? `<span>${esc(src.file)}</span>` : ''}</div>
          <h2 class="lg-title">${esc(a.title)}</h2>
          ${a.parties.length ? `<div class="lg-parties">${a.parties.map(p => `<div class="lg-party-card"><small>${esc(p.role)}</small><strong>${esc(p.name)}</strong><span>${esc([p.type === 'company' ? `Company${p.rc ? `, RC ${p.rc}` : ''}` : 'Individual', p.address].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>` : '<p class="lg-empty">Parties were not identified. Check the opening words ("BETWEEN … AND …").</p>'}
          <div class="lg-stats">
            <div class="lg-stat" data-tone="${a.counts.high ? 'high' : ''}"><b>${a.counts.high}</b><span>High risks</span></div>
            <div class="lg-stat" data-tone="${a.counts.medium ? 'medium' : ''}"><b>${a.counts.medium}</b><span>Medium risks</span></div>
            <div class="lg-stat"><b>${a.counts.clauses}</b><span>Clauses</span></div>
            <div class="lg-stat"><b>${a.counts.obligations}</b><span>Obligations</span></div>
            <div class="lg-stat"><b>${a.counts.defined}</b><span>Defined terms</span></div>
          </div>
          <div class="lg-head-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-act="copy-redline">${icon('copy', 14)}<span>Copy negotiation points</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="md">${icon('download', 14)}<span>Markdown report</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="print">${icon('print', 14)}<span>Print / PDF</span></button>
          </div>
        </section>
        <div class="lg-tabs" role="tablist">
          ${[['review', `Risks <small>${issues.filter(f => f.severity !== 'info').length}</small>`], ['clauses', `Clause map <small>${a.clauses.length}</small>`], ['obligations', `Obligations <small>${obs.length}</small>`], ['terms', `Defined terms <small>${a.defined.length}</small>`], ['redline', 'Redline summary']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
        </div>

        <div class="lg-panel" data-panel="review" ${tab === 'review' ? '' : 'hidden'}>
          <div class="lg-grid">
            <div class="lg-main">
              <section class="lg-card">
                <header class="lg-sec-head"><h3>Risk flags</h3><span class="lg-sec-sub">Most serious first</span></header>
                ${flags.length ? `<ul class="lg-flags">${flags.map(flagHTML).join('')}</ul>` : '<p class="lg-empty">No risk flags were raised. That does not mean the document is safe: read it in full.</p>'}
              </section>
            </div>
            <aside class="lg-aside">
              <section class="lg-card lg-facts">
                <h3 class="lg-aside-title">Execution check</h3>
                <ul class="lg-checks">${a.execution.map(x => `<li><span class="lg-dot" data-s="${x.status}">${icon(STATUS_ICON[x.status] || 'info', 12)}</span><span><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></span></li>`).join('')}</ul>
              </section>
              <section class="lg-card lg-facts">
                <h3 class="lg-aside-title">Stamp duty &amp; registration</h3>
                <ul class="lg-checks">${a.reminders.map(r => `<li><span class="lg-dot">${icon('info', 12)}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.why)}</small></span></li>`).join('')}</ul>
              </section>
            </aside>
          </div>
        </div>

        <div class="lg-panel" data-panel="clauses" ${tab === 'clauses' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Expected in a ${esc(a.docTypeLabel.toLowerCase())}</h3><span class="lg-sec-sub">${a.coverage.filter(c => c.present).length} of ${a.coverage.length} found</span></header>
            <div class="lg-cov">${a.coverage.map(c => `<span class="${c.present ? '' : `is-missing${c.required ? '' : ' is-optional'}`}" title="${c.present ? 'Found' : c.required ? 'Missing' : 'Optional, not found'}">${esc(c.label)}</span>`).join('')}</div>
            <header class="lg-sec-head"><h3>Clauses</h3><span class="lg-sec-sub">Classified by heading and wording</span></header>
            ${a.clauses.length ? `<ul class="lg-clauses">${a.clauses.map(c => {
              const fl = flagsByClause[c.number] || [];
              const hi = fl.filter(f => f.severity === 'high').length;
              return `<li class="lg-clause"><span class="lg-clause-no">${esc(c.number)}</span>
                <div class="lg-clause-main"><strong>${esc(c.heading || c.typeLabel)}${pageChip(c.page)}</strong><p>${esc(c.summary)}</p></div>
                <div class="lg-clause-tags"><span class="lg-type">${esc(c.typeLabel)}</span>${c.tags.slice(0, 2).map(t => `<span class="lg-tag">${esc(tagLabel(t))}</span>`).join('')}${fl.length ? `<span class="lg-flagcount${hi ? '' : ' is-medium'}">${plural(fl.length, 'flag')}</span>` : ''}</div></li>`;
            }).join('')}</ul>` : '<p class="lg-empty">No numbered clauses were found.</p>'}
          </section>
        </div>

        <div class="lg-panel" data-panel="obligations" ${tab === 'obligations' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Who must do what, by when</h3><span class="lg-sec-sub">Relative deadlines are worked out from the dates below</span></header>
            <div class="lg-anchors">
              ${['execution', 'commencement', 'expiry'].map(k => `<label class="lg-anchor">${esc({ execution: 'Date of agreement', commencement: 'Commencement', expiry: 'Expiry of term' }[k])}
                <input type="date" class="tool-input" data-anchor="${k}" value="${esc(a.anchors[k]?.date || '')}"><span>${a.anchors[k] ? esc(a.anchors[k].source) : 'Not stated'}</span></label>`).join('')}
            </div>
            ${obs.length ? `<div class="lg-table-wrap"><table class="lg-obs"><thead><tr><th></th><th>Party</th><th>Obligation</th><th>Deadline in the text</th><th>Due date</th></tr></thead><tbody>
              ${obs.map(o => `<tr class="${o.kind === 'prohibition' ? 'is-prohibition' : ''}">
                <td><input type="checkbox" data-pick="${o.id}" ${picked.has(o.id) ? 'checked' : ''} ${dueOf(o) ? '' : 'disabled'} aria-label="Add to calendar"></td>
                <td class="lg-party">${esc(o.party)}</td>
                <td>${esc(o.action)}${o.clause ? `<small class="lg-sub">Clause ${esc(o.clause.number)}${o.clause.heading ? ` · ${esc(o.clause.heading)}` : ''}${o.page ? ` · p. ${o.page}` : ''}</small>` : ''}</td>
                <td class="lg-deadline">${o.deadline ? `${esc(o.deadline.text)}${o.deadline.recurrence ? `<em>Repeats ${esc(o.deadline.recurrence)}</em>` : ''}${o.deadline.assumed ? '<em>Assumes the defined date</em>' : ''}${o.deadline.type === 'relative' && !o.deadline.resolved ? `<em>Needs the date of ${esc(o.deadline.anchor || 'the trigger event')}</em>` : ''}` : '<span class="lg-muted">Continuing</span>'}</td>
                <td><input type="date" class="tool-input" data-due="${o.id}" value="${esc(dueOf(o))}" aria-label="Due date"></td>
              </tr>`).join('')}</tbody></table></div>
              <div class="lg-cal-bar"><p>${plural(picked.size, 'deadline')} selected${Number(this.prefs.leadDays) ? ` · a reminder ${this.prefs.leadDays} day${this.prefs.leadDays === '1' ? '' : 's'} before each` : ''}. Check each date against the document.</p>
                <div class="lg-bar-main"><button type="button" class="btn btn-secondary btn-sm" data-act="ics" ${picked.size ? '' : 'disabled'}>${icon('download', 14)}<span>.ics file</span></button><button type="button" class="btn btn-primary btn-sm" data-act="calendar" ${picked.size ? '' : 'disabled'}>${icon('cal', 14)}<span>Add to Calendar</span></button></div></div>`
              : '<p class="lg-empty">No obligations of the form "the [party] shall …" were found.</p>'}
          </section>
        </div>

        <div class="lg-panel" data-panel="terms" ${tab === 'terms' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Defined terms</h3><span class="lg-sec-sub">${a.counts.unused ? `${plural(a.counts.unused, 'term')} defined but not used again` : 'Each is used after it is defined'}</span></header>
            ${a.defined.length ? `<div class="lg-terms">${a.defined.map(d => `<div class="lg-term${d.count ? '' : ' is-unused'}"><strong>${esc(d.term)}<small>${d.count ? `used ${d.count}×` : 'not used again'}</small></strong><p>${esc(d.definition)}</p></div>`).join('')}</div>` : '<p class="lg-empty">No defined terms ("X" means …) were found.</p>'}
          </section>
        </div>

        <div class="lg-panel" data-panel="redline" ${tab === 'redline' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Redline summary</h3><button type="button" class="btn btn-secondary btn-sm" data-act="copy-redline">${icon('copy', 14)}<span>Copy</span></button></header>
            <pre class="lg-redline">${esc(redlineSummary(a))}</pre>
          </section>
        </div>
        ${note('Reviewed on your device by pattern matching. Flags are prompts for a lawyer\'s review, not legal advice; check each point against the document and current law.')}`;
      out.hidden = false;
    };

    const selectedEvents = () => {
      const lead = Number(this.prefs.leadDays) || 0;
      return a.obligations.filter(o => picked.has(o.id)).flatMap(o => obligationToEvent(o, { date: dates[o.id] ?? o.deadline?.due, source: src.file || a.title, leadDays: lead }) || []);
    };

    out.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        out.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === t)));
        out.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b || !a) return;
      const act = b.dataset.act;
      if (act === 'copy-redline') copyToClipboard(redlineSummary(a), b);
      if (act === 'md') { download(`${slug(a.title)}-review.md`, contractMarkdown(a)); analytics?.downloaded?.({ fileCount: 1 }); }
      if (act === 'print') printMarkdown(`${a.title} — review`, contractMarkdown(a));
      if (act === 'ics') download(`${slug(a.title)}-deadlines.ics`, exportToICS(selectedEvents().map((ev, i) => ({ ...ev, id: `lda-${i}`, startTime: '', endTime: '', location: '', createdAt: Date.now(), updatedAt: Date.now() }))), 'text/calendar');
      if (act === 'calendar') {
        const existing = new Set(loadEvents().map(ev => `${ev.title}|${ev.date}`));
        let added = 0, skipped = 0;
        for (const ev of selectedEvents()) {
          if (existing.has(`${ev.title}|${ev.date}`)) { skipped++; continue; }
          try { addEvent(ev); added++; } catch { skipped++; }
        }
        showToast(`${plural(added, 'event')} added to Calendar${skipped ? ` (${skipped} already there)` : ''}.`, added ? 'success' : 'info');
      }
    });
    out.addEventListener('change', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { if (pick.checked) picked.add(pick.dataset.pick); else picked.delete(pick.dataset.pick); render(); return; }
      const due = e.target.closest('[data-due]');
      if (due) { dates[due.dataset.due] = due.value; if (due.value) picked.add(due.dataset.due); render(); return; }
      const an = e.target.closest('[data-anchor]');
      if (an) { anchors[an.dataset.anchor] = an.value; run(true); }
    });
    $('#lda-run').addEventListener('click', () => run());
    $('#lda-type').addEventListener('change', () => { if (a) run(true); });
    $('#lda-clear').addEventListener('click', () => { src.textarea.value = ''; delete src.textarea.dataset.file; src.setStatus('PDF, Word (.docx) or text'); out.hidden = true; a = null; });
    this.cleanup.push(onToolSettings(ID, (p) => { this.prefs = p; if (a) run(true); }));
    if (artifact?.text) { src.textarea.value = artifact.text; run(); }
    this._text = () => src.textarea.value;
  },

  getArtifact() { return { kind: 'text', text: this._text?.() || '' }; },

  destroy() {
    for (const fn of this.cleanup || []) { try { fn(); } catch { /* ignore */ } }
    this.cleanup = [];
  },
};

const TAG_LABELS = { serviceCharge: 'Service charge', forceMajeure: 'Force majeure', nonCompete: 'Restrictive covenants', antiBribery: 'Anti-bribery', ip: 'IP' };
const tagLabel = (t) => TAG_LABELS[t] || t.replace(/^./, c => c.toUpperCase());
void formatDate;
