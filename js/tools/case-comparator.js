/* ============================================================
   Case Comparator — two judgments side by side.

   Which court is superior and whether either decision binds the
   other's court, which came first and whether the later one
   cites the earlier (and how), issues aligned by wording,
   authorities in common (flagging different treatment), and
   facts, holdings, ratio and orders next to each other.
   ============================================================ */

import { compareJudgments, comparisonMarkdown } from '../lib/legal/compare.js';
import { LEVEL_LABEL } from '../lib/legal/courts.js';
import { esc, icon, pageChip, note, sourceCard, bindSource, download, copyToClipboard, printMarkdown, plural } from '../lib/legal/view.js';

const cap = (s) => String(s || '').toLowerCase().replace(/^./, c => c.toUpperCase());
const TONE = { allowed: 'good', dismissed: 'bad', 'partly allowed': 'mid', 'struck out': 'bad' };

export default {
  render(container, { analytics } = {}) {
    this.cleanup = [];
    container.innerHTML = `
      <div class="lg lg-compare">
        <section class="lg-card lg-input">
          <div class="lg-sources2">
            ${sourceCard('cmpa', { label: 'Case A', placeholder: 'Paste the first judgment…', rows: 8, compact: true })}
            ${sourceCard('cmpb', { label: 'Case B', placeholder: 'Paste the second judgment…', rows: 8, compact: true })}
          </div>
          <div class="lg-bar">
            <div class="lg-bar-main">
              <button type="button" class="btn btn-primary" id="cmp-run">Compare judgments</button>
              <button type="button" class="btn btn-ghost" id="cmp-swap">Swap A and B</button>
              <button type="button" class="btn btn-ghost" id="cmp-clear">Clear</button>
            </div>
          </div>
        </section>
        <div id="cmp-out" class="lg-out" hidden></div>
      </div>`;
    const $ = (s) => container.querySelector(s);
    const out = $('#cmp-out');
    const A = bindSource(container, 'cmpa'), B = bindSource(container, 'cmpb');
    this.cleanup.push(A.off, B.off);
    let result = null;

    const run = () => {
      const ta = A.textarea.value.trim(), tb = B.textarea.value.trim();
      if (ta.length < 80 || tb.length < 80) { (ta.length < 80 ? A : B).setStatus('Add the judgment text first.', 'warn'); return; }
      analytics?.started?.();
      result = compareJudgments(ta, tb);
      render();
      analytics?.completed?.();
    };

    const heroCard = (k, d, isSup) => `
      <section class="lg-card lg-vs-card${isSup ? ' is-superior' : ''}">
        <div class="lg-kicker"><span class="lg-side ${k}">${k.toUpperCase()}</span>${d.court ? `<span class="lg-badge">${esc(d.court.short || d.court.name)}</span>` : '<span class="lg-badge is-muted">Court not identified</span>'}${d.court ? `<span>${esc(LEVEL_LABEL[d.court.level] || '')}</span>` : ''}</div>
        <h2 class="lg-title">${esc(d.title)}</h2>
        <p class="lg-meta">${[d.suitNo && esc(d.suitNo), d.date && esc(d.date.text)].filter(Boolean).join('<i></i>') || '—'}</p>
        ${d.outcome ? `<p class="lg-meta"><span class="lg-pill" data-tone="${TONE[d.outcome.label] || 'none'}">${esc(cap(d.outcome.label))}</span></p>` : ''}
      </section>`;
    const auth = (list, cls = '') => (list.length ? `<ul class="lg-auth-list">${list.map(c => `<li class="${cls}"><em>${esc(c.title || 'Unnamed case')}</em>${c.isOther ? ` <span class="lg-tag">this is Case ${c.isOther}</span>` : ''}<code>${esc(c.citations.join('; '))}</code></li>`).join('')}</ul>` : '<p class="lg-empty">None.</p>');
    const cell = (x) => (x ? `${esc(x.text)}${pageChip(x.page)}${x.resolution ? `<span class="lg-sub">${esc(x.resolution)}</span>` : ''}` : '<span class="lg-muted">No matching issue</span>');
    const joinItems = (list, n = 3) => (list.length ? list.slice(0, n).map(x => `<p class="lg-cellp">${esc(x.text)}${pageChip(x.page)}</p>`).join('') : '<span class="lg-muted">Not found</span>');

    const render = () => {
      const r = result, a = r.a, b = r.b;
      const supText = r.superior === 'a' ? `A — ${a.court.short}` : r.superior === 'b' ? `B — ${b.court.short}` : r.superior === 'equal' ? 'Coordinate courts' : 'Unknown';
      const citeLine = r.cites.bCitesA ? `B cites A${r.cites.bCitesA.treatment ? ` and ${r.cites.bCitesA.treatment === 'referred to' ? 'refers to' : r.cites.bCitesA.treatment} it` : ''}` : r.cites.aCitesB ? `A cites B${r.cites.aCitesB.treatment ? ` and ${r.cites.aCitesB.treatment} it` : ''}` : 'Neither cites the other';
      out.innerHTML = `
        <div class="lg-vs">${heroCard('a', a, r.superior === 'a')}<div class="lg-vs-mid">VS</div>${heroCard('b', b, r.superior === 'b')}</div>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Precedent</h3>
            <div class="lg-sec-tools">
              <button type="button" class="btn btn-secondary btn-sm" data-act="copy">${icon('copy', 14)}<span>Copy</span></button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="md">${icon('download', 14)}<span>Markdown</span></button>
              <button type="button" class="btn btn-secondary btn-sm" data-act="print">${icon('print', 14)}<span>Print / PDF</span></button>
            </div></header>
          <div class="lg-rel">
            <div><small>Superior court</small><strong>${esc(supText)}</strong><p>${r.superior && r.superior !== 'equal' ? esc(`${LEVEL_LABEL[(r.superior === 'a' ? a : b).court.level]}.`) : r.superior === 'equal' ? 'Same level in the hierarchy.' : 'Identify both courts to compare them.'}</p></div>
            <div><small>A before B's court</small><strong>${esc(r.aOnB?.label || '—')}</strong><p>${esc(r.aOnB?.reason || 'Court of one or both judgments not identified.')}</p></div>
            <div><small>B before A's court</small><strong>${esc(r.bOnA?.label || '—')}</strong><p>${esc(r.bOnA?.reason || '')}</p></div>
            <div><small>Date order</small><strong>${esc(r.order ? r.order.text.split(' (')[0] : 'Dates not found')}</strong><p>${esc(citeLine)}.${r.order && r.superior && r.superior !== 'equal' && r.order.later !== r.superior && r.order.later !== 'same' ? ' The later decision is from the lower court: it should follow the earlier one unless it distinguishes it.' : ''}</p></div>
          </div>
        </section>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Issues aligned</h3><span class="lg-sec-sub">Matched by wording · ${plural(r.issues.filter(x => x.a && x.b).length, 'pair')}</span></header>
          ${r.issues.length ? `<table class="lg-align"><thead><tr><th>Case A</th><th class="lg-sim">Match</th><th>Case B</th></tr></thead><tbody>
            ${r.issues.map(row => `<tr><td data-label="Case A">${cell(row.a)}</td><td class="lg-sim" data-label="Match">${row.a && row.b ? `${row.score}%<span class="lg-meter"><i style="width:${Math.min(100, row.score)}%"></i></span>` : '—'}</td><td data-label="Case B">${cell(row.b)}</td></tr>`).join('')}
          </tbody></table>` : '<p class="lg-empty">No issues for determination were found in either judgment.</p>'}
        </section>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Authorities</h3><span class="lg-sec-sub">${plural(r.shared.length, 'case')} in common${r.conflicts ? ` · ${plural(r.conflicts, 'case')} treated differently` : ''}</span></header>
          <div class="lg-auth-cols">
            <div><h4 class="lg-h4">Relied on by both</h4>${r.shared.length ? `<ul class="lg-auth-list">${r.shared.map(s => `<li class="${s.conflict ? 'is-conflict' : ''}"><em>${esc(s.title || s.citations[0])}</em><code>${esc(s.citations.join('; '))}</code><span class="lg-sub">A: ${esc(s.treatmentA.join(', ') || 'cited')} · B: ${esc(s.treatmentB.join(', ') || 'cited')}${s.conflict ? ' · treated differently' : ''}</span></li>`).join('')}</ul>` : '<p class="lg-empty">None.</p>'}
              ${r.sharedStatutes.length ? `<h4 class="lg-h4">Statutes in common</h4><ul class="lg-auth-list">${r.sharedStatutes.map(s => `<li>${esc(s.name)}${s.provisions.length ? `<code>${esc(s.provisions.join(', '))}</code>` : ''}</li>`).join('')}</ul>` : ''}</div>
            <div><h4 class="lg-h4">Only in A</h4>${auth(r.onlyA)}</div>
            <div><h4 class="lg-h4">Only in B</h4>${auth(r.onlyB)}</div>
          </div>
        </section>
        <section class="lg-card">
          <header class="lg-sec-head"><h3>Side by side</h3></header>
          <table class="lg-align"><thead><tr><th class="lg-rowhead"></th><th>Case A</th><th>Case B</th></tr></thead><tbody>
            <tr><td data-label=""><strong>Facts</strong></td><td data-label="Case A">${joinItems(a.facts, 1)}</td><td data-label="Case B">${joinItems(b.facts, 1)}</td></tr>
            <tr><td data-label=""><strong>Holding</strong></td><td data-label="Case A">${a.outcome ? `<p class="lg-cellp"><b>${esc(cap(a.outcome.label))}.</b></p>` : ''}${joinItems(a.holdings, 2)}</td><td data-label="Case B">${b.outcome ? `<p class="lg-cellp"><b>${esc(cap(b.outcome.label))}.</b></p>` : ''}${joinItems(b.holdings, 2)}</td></tr>
            <tr><td data-label=""><strong>Ratio (candidates)</strong></td><td data-label="Case A">${joinItems(a.ratio)}</td><td data-label="Case B">${joinItems(b.ratio)}</td></tr>
            <tr><td data-label=""><strong>Orders</strong></td><td data-label="Case A">${joinItems(a.orders, 4)}</td><td data-label="Case B">${joinItems(b.orders, 4)}</td></tr>
          </tbody></table>
        </section>
        ${note('Compared on your device by pattern matching. Issue matching is by wording only; read both judgments before treating one as following or conflicting with the other.')}`;
      out.hidden = false;
    };

    out.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a || !result) return;
      const md = comparisonMarkdown(result);
      if (a.dataset.act === 'copy') copyToClipboard(md, a);
      if (a.dataset.act === 'md') download('case-comparison.md', md);
      if (a.dataset.act === 'print') printMarkdown('Case comparison', md);
    });
    $('#cmp-run').addEventListener('click', run);
    $('#cmp-swap').addEventListener('click', () => { const t = A.textarea.value; A.textarea.value = B.textarea.value; B.textarea.value = t; if (result) run(); });
    $('#cmp-clear').addEventListener('click', () => { A.textarea.value = ''; B.textarea.value = ''; out.hidden = true; result = null; });
  },

  destroy() {
    for (const fn of this.cleanup || []) { try { fn(); } catch { /* ignore */ } }
    this.cleanup = [];
  },
};
