/* ============================================================
   Case Digest — structured digest of a Nigerian judgment.

   Court, parties, appeal/suit number, date, coram and lead
   judgment; facts, issues (with how each was resolved),
   arguments, holding, candidate ratio decidendi and obiter,
   orders; a table of authorities with pinpoints, pages and the
   weight of each case before a chosen court; a copyable
   citation. Everything is extracted from the text on-device.
   ============================================================ */

import { extractJudgment, digestMarkdown } from '../lib/legal/judgment.js';
import { buildAuthorities, authoritiesMarkdown } from '../lib/legal/authorities.js';
import { COURTS, LEVEL_LABEL, FORUMS } from '../lib/legal/courts.js';
import { esc, icon, pageChip, note, sourceCard, bindSource, toaHTML, download, slug, copyToClipboard, printMarkdown, plural } from '../lib/legal/view.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';

const ID = 'case-digest';

export default {
  render(container, { analytics, artifact } = {}) {
    this.cleanup = [];
    this.prefs = getToolSettings(ID);
    container.innerHTML = `
      <div class="lg lg-digest">
        <section class="lg-card lg-input">
          ${sourceCard('cd', { label: 'Judgment or ruling', placeholder: 'Paste the judgment, from the heading (court, parties, appeal number) to the orders…', hint: 'PDF, Word (.docx) or text' })}
          <div class="lg-bar">
            <div class="lg-bar-main">
              <button type="button" class="btn btn-primary" id="cd-run">Digest judgment</button>
              <button type="button" class="btn btn-ghost" id="cd-clear">Clear</button>
            </div>
            <label class="lg-inline">Weigh authorities before
              <select class="tool-select" id="cd-forum">${FORUMS.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select>
            </label>
          </div>
        </section>
        <div id="cd-out" class="lg-out" hidden></div>
      </div>`;
    const $ = (s) => container.querySelector(s);
    const out = $('#cd-out');
    const forumSel = $('#cd-forum');
    forumSel.value = this.prefs.forum || 'HC';
    const src = bindSource(container, 'cd', { onLoaded: () => run() });
    this.cleanup.push(src.off);
    let digest = null;
    let tab = 'digest';

    const run = () => {
      const text = src.textarea.value.trim();
      if (text.length < 80) { src.setStatus('Paste or drop a judgment first (at least a few paragraphs).', 'warn'); return; }
      analytics?.started?.();
      digest = extractJudgment(text, { forum: forumSel.value });
      render();
      analytics?.completed?.();
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const itemList = (list, { numbered = false, empty = 'Not found in the text.' } = {}) => (list.length
      ? `<${numbered ? 'ol' : 'ul'} class="lg-items${numbered ? ' is-numbered' : ''}">${list.map(x => `<li><p>${esc(x.text)}${this.prefs.pages ? pageChip(x.page) : ''}</p>${x.resolution ? `<span class="lg-res" data-side="${esc(x.favours || '')}">${esc(x.resolution)}${this.prefs.pages ? pageChip(x.resolutionPage) : ''}</span>` : ''}</li>`).join('')}</${numbered ? 'ol' : 'ul'}>`
      : `<p class="lg-empty">${esc(empty)}</p>`);
    const sec = (title, body, sub = '') => `<section class="lg-sec"><header class="lg-sec-head"><h3>${esc(title)}</h3>${sub ? `<span class="lg-sec-sub">${sub}</span>` : ''}</header>${body}</section>`;

    const render = () => {
      const d = digest;
      const c = d.court;
      const toa = d.authorities;
      const outcomeTone = { allowed: 'good', dismissed: 'bad', 'partly allowed': 'mid', 'struck out': 'bad' }[d.outcome?.label] || 'none';
      const roleA = d.parties?.roleA ? cap(d.parties.roleA) : 'Appellant / claimant';
      const roleB = d.parties?.roleB ? cap(d.parties.roleB) : 'Respondent / defendant';
      out.innerHTML = `
        <section class="lg-card lg-head">
          <div class="lg-kicker">
            ${c ? `<span class="lg-badge">${esc(c.name)}</span><span>${esc([LEVEL_LABEL[c.level], c.division ? `${c.division} Division` : '', c.seat ? `Holden at ${c.seat}` : '', c.source !== 'heading' ? `identified from ${c.source}` : ''].filter(Boolean).join(' · '))}</span>` : '<span class="lg-badge is-muted">Court not identified</span>'}
          </div>
          <h2 class="lg-title">${esc(d.title)}</h2>
          <p class="lg-meta">${[d.suitNo && `${/^S?C/.test(d.suitNo) ? 'Appeal' : 'Suit'} No. ${esc(d.suitNo)}`, d.date && `Delivered ${esc(d.date.text)}`, d.lead && `Lead judgment: ${esc(d.lead)}`].filter(Boolean).join('<i></i>') || 'Heading details not found'}</p>
          <div class="lg-cite"><code id="cd-citation">${esc(d.citation)}</code><button type="button" class="btn btn-secondary btn-sm" data-act="cite">${icon('copy', 14)}<span>Copy citation</span></button></div>
          <div class="lg-head-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-act="copy">${icon('copy', 14)}<span>Copy digest</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="md">${icon('download', 14)}<span>Markdown</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="print">${icon('print', 14)}<span>Print / PDF</span></button>
          </div>
        </section>
        <div class="lg-tabs" role="tablist">
          ${[['digest', 'Digest'], ['toa', `Authorities <small>${toa.counts.cases + toa.counts.statutes + toa.counts.rules}</small>`], ['timeline', `Timeline <small>${d.timeline.length}</small>`]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
        </div>
        <div class="lg-panel" data-panel="digest" ${tab === 'digest' ? '' : 'hidden'}>
          <div class="lg-grid">
            <div class="lg-main">
              ${sec('Facts', d.facts.length ? `<div class="lg-prose">${d.facts.map(f => `<p>${esc(f.text)}${this.prefs.pages ? pageChip(f.page) : ''}</p>`).join('')}</div>` : '<p class="lg-empty">No facts section found. Look for "the facts of this case" in the judgment.</p>')}
              ${sec('Issues for determination', itemList(d.issues, { numbered: true, empty: 'No issues found. Nigerian judgments usually list them as "1. Whether …".' }), d.issues.length ? plural(d.issues.length, 'issue') : '')}
              ${sec('Arguments of counsel', (d.arguments.a.length || d.arguments.b.length) ? `<div class="lg-two">
                  <div><h4 class="lg-h4">${esc(roleA)}</h4>${itemList(d.arguments.a, { empty: 'Not found.' })}</div>
                  <div><h4 class="lg-h4">${esc(roleB)}</h4>${itemList(d.arguments.b, { empty: 'Not found.' })}</div></div>` : itemList(d.arguments.other, { empty: 'No arguments of counsel found.' }))}
              ${sec('Holding', `${d.outcome ? `<p class="lg-outcome" data-tone="${outcomeTone}"><strong>${esc(cap(d.outcome.label))}</strong><span>${esc(d.outcome.text)}${this.prefs.pages ? pageChip(d.outcome.page) : ''}</span></p>` : ''}${itemList(d.holdings, { empty: d.outcome ? 'No "I hold that" findings found.' : 'No holding found.' })}`)}
              ${sec('Ratio decidendi', itemList(d.ratio, { empty: 'No statement of principle found.' }), 'Candidates · confirm each is necessary to the decision')}
              ${sec('Obiter dicta', itemList(d.obiter, { empty: 'None flagged.' }), 'Candidates')}
              ${sec('Orders', itemList(d.orders, { numbered: true, empty: 'No orders found.' }))}
            </div>
            <aside class="lg-aside">
              <section class="lg-card lg-facts">
                <h3 class="lg-aside-title">At a glance</h3>
                <dl class="lg-dl">
                  <div><dt>Outcome</dt><dd>${d.outcome ? `<span class="lg-pill" data-tone="${outcomeTone}">${esc(cap(d.outcome.label))}</span>` : '—'}</dd></div>
                  <div><dt>Court</dt><dd>${c ? esc(c.short || c.name) : '—'}</dd></div>
                  <div><dt>Delivered</dt><dd>${d.date ? esc(d.date.text) : '—'}</dd></div>
                  <div><dt>Issues</dt><dd>${d.issues.length || '—'}</dd></div>
                  <div><dt>Authorities</dt><dd>${plural(toa.counts.cases, 'case')}, ${plural(toa.counts.statutes, 'statute')}</dd></div>
                  ${d.pages ? `<div><dt>Pages</dt><dd>${d.pages}</dd></div>` : ''}
                </dl>
                ${d.coram.length ? `<h4 class="lg-h4">Coram</h4><ul class="lg-plain">${d.coram.map(j => `<li>${esc(j)}${d.lead && j === d.lead ? ' <span class="lg-tag">lead</span>' : ''}${(d.concurring.find(x => x.judge === j)?.view === 'dissenting') ? ' <span class="lg-tag">dissent</span>' : ''}</li>`).join('')}</ul>` : ''}
                ${d.counsel.length ? `<h4 class="lg-h4">Counsel</h4><ul class="lg-plain">${d.counsel.map(x => `<li>${esc(x.name)} <small class="lg-sub">for the ${esc(x.for)}</small></li>`).join('')}</ul>` : ''}
                ${d.lowerCourtNumbers.length ? `<h4 class="lg-h4">Courts below</h4><ul class="lg-plain">${d.lowerCourtNumbers.map(x => `<li><code>${esc(x.normalised)}</code>${x.court ? ` <small class="lg-sub">${esc(COURTS[x.court.id]?.short || x.court.name)}</small>` : ''}</li>`).join('')}</ul>` : ''}
              </section>
            </aside>
          </div>
        </div>
        <div class="lg-panel" data-panel="toa" ${tab === 'toa' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Table of authorities</h3>
              <div class="lg-sec-tools"><span class="lg-sec-sub">Weight shown before the ${esc(COURTS[forumSel.value]?.short || '')}</span>
              <button type="button" class="btn btn-secondary btn-sm" data-act="copy-toa">${icon('copy', 14)}<span>Copy</span></button></div></header>
            ${toaHTML(toa)}
          </section>
        </div>
        <div class="lg-panel" data-panel="timeline" ${tab === 'timeline' ? '' : 'hidden'}>
          <section class="lg-card">
            <header class="lg-sec-head"><h3>Dates in the judgment</h3><span class="lg-sec-sub">In date order, with the sentence each appears in</span></header>
            ${d.timeline.length ? `<ol class="lg-timeline">${d.timeline.map(t => `<li><time datetime="${t.date}">${esc(t.dateText)}</time><p>${esc(t.context)}${this.prefs.pages ? pageChip(t.page) : ''}</p></li>`).join('')}</ol>` : '<p class="lg-empty">No dates found.</p>'}
          </section>
        </div>
        ${note()}`;
      out.hidden = false;
    };

    const md = () => digestMarkdown(digest, { authorities: this.prefs.exportToa !== false });

    out.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        out.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === t)));
        out.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a || !digest) return;
      const act = a.dataset.act;
      if (act === 'cite') copyToClipboard(digest.citation, a);
      if (act === 'copy') { copyToClipboard(md(), a); analytics?.copied?.({ outputKind: 'text' }); }
      if (act === 'copy-toa') copyToClipboard(authoritiesMarkdown(digest.authorities, { heading: `Table of authorities: ${digest.title}` }), a);
      if (act === 'md') { download(`${slug(digest.title)}-digest.md`, md()); analytics?.downloaded?.({ fileCount: 1 }); }
      if (act === 'print') printMarkdown(`${digest.title} — digest`, md());
    });

    forumSel.addEventListener('change', () => {
      if (!digest) return;
      digest.authorities = buildAuthorities(src.textarea.value, { forum: forumSel.value, selfCourt: digest.court });
      render();
    });
    $('#cd-run').addEventListener('click', run);
    $('#cd-clear').addEventListener('click', () => { src.textarea.value = ''; delete src.textarea.dataset.file; src.setStatus('PDF, Word (.docx) or text'); out.hidden = true; digest = null; });
    this.cleanup.push(onToolSettings(ID, (p) => { this.prefs = p; if (digest) render(); }));

    if (artifact?.text) { src.textarea.value = artifact.text; run(); }
    this._text = () => src.textarea.value;
  },

  getArtifact() { return { kind: 'text', text: this._text?.() || '' }; },

  destroy() {
    for (const fn of this.cleanup || []) { try { fn(); } catch { /* ignore */ } }
    this.cleanup = [];
  },
};

const cap = (s) => String(s || '').toLowerCase().replace(/^./, c => c.toUpperCase());
