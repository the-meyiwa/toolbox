/* ============================================================
   Clean Text — Invisible Character & Unicode Sanitizer.

   Detects and strips zero-width characters, invisible markers,
   unusual Unicode whitespaces, and hidden formatting artifacts.
   Normalizes text for reliable searching, coding, parsing & storage.
   Positions as text sanitization & hygiene, not AI detection bypass.
   ============================================================ */

import { copyText } from '../utils.js';
import { dropZone, attachFileInput, downloadBlob } from '../lib/file-engine.js';

const SANITIZATION_RULES = [
  {
    id: 'invisible',
    label: 'Zero-Width & Invisible Characters',
    hint: 'Removes ZWSP (\\u200B), ZWJ, ZWNJ, BOM (\\uFEFF), soft hyphens (\\u00AD), LTR/RTL marks, and invisible separators',
    on: true,
    apply: (t) => t.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060-\u2064\u206A-\u206F\uFFF9-\uFFFB]/g, ''),
    countMatch: (t) => (t.match(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060-\u2064\u206A-\u206F\uFFF9-\uFFFB]/g) || []).length,
  },
  {
    id: 'control',
    label: 'Non-Printable Control Characters',
    hint: 'Strips null bytes and unprintable ASCII control characters (\\u0000-\\u0008, \\u000B, \\u000C, \\u000E-\\u001F)',
    on: true,
    apply: (t) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ''),
    countMatch: (t) => (t.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g) || []).length,
  },
  {
    id: 'unicode-spaces',
    label: 'Unusual Unicode Whitespaces',
    hint: 'Normalizes NBSP (\\u00A0), en-space, em-space, thin space, hair space, and ideographic spaces into standard space',
    on: true,
    apply: (t) => t.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' '),
    countMatch: (t) => (t.match(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g) || []).length,
  },
  {
    id: 'quotes-dashes',
    label: 'Smart Quotes, Dashes & Ellipses',
    hint: 'Converts curly quotes (‘’ “”), backticks/primes, en/em dashes (– —), and ellipses (…) to plain ASCII equivalents',
    on: true,
    apply: (t) => t
      .replace(/[‘’‚‛`]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/[–—―]/g, '-')
      .replace(/…/g, '...'),
    countMatch: (t) => (t.match(/[‘’‚‛`“”„‟–—―…]/g) || []).length,
  },
  {
    id: 'repeated-spaces',
    label: 'Repeated Spaces & Tabs',
    hint: 'Collapses consecutive space and tab runs into a single clean space',
    on: true,
    apply: (t) => t.replace(/[ \t]{2,}/g, ' '),
    countMatch: (t) => {
      const matches = t.match(/[ \t]{2,}/g) || [];
      return matches.reduce((acc, m) => acc + (m.length - 1), 0);
    },
  },
  {
    id: 'trailing-space',
    label: 'Trailing Line Whitespace',
    hint: 'Removes unnecessary whitespace at the end of lines',
    on: true,
    apply: (t) => t.replace(/[ \t]+$/gm, ''),
    countMatch: (t) => (t.match(/[ \t]+$/gm) || []).length,
  },
  {
    id: 'line-endings',
    label: 'Normalize Line Endings (CRLF → LF)',
    hint: 'Standardizes Windows \\r\\n line endings to standard Unix \\n line feeds',
    on: true,
    apply: (t) => t.replace(/\r\n?/g, '\n'),
    countMatch: (t) => (t.match(/\r\n?/g) || []).length,
  },
  {
    id: 'extra-blank-lines',
    label: 'Excessive Blank Lines',
    hint: 'Collapses more than 2 consecutive blank lines into one',
    on: false,
    apply: (t) => t.replace(/\n{3,}/g, '\n\n'),
    countMatch: (t) => (t.match(/\n{3,}/g) || []).length,
  },
];

export default {
  render(container, { analytics, artifact } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <!-- Notice Strip -->
      <div class="biz-explain" style="margin-bottom:14px; font-size:0.82rem; display:flex; align-items:center; gap:8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Text Sanitization &amp; Clipboard Hygiene: Strips invisible Unicode artifacts that corrupt search, CSVs, code, and databases.</span>
      </div>

      <!-- Upload / Paste Section -->
      <div class="tool-section">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
          <label class="tool-label" for="tc-in" style="margin:0;">Source Text or File</label>
          <span style="font-size:0.78rem; color:var(--g600);">Paste text or drop .txt, .md, .csv, .json</span>
        </div>
        ${dropZone('tc-zone', { label: 'Drop a text file to clean (.txt, .md, .csv, .json, .log)', accept: '.txt,.md,.csv,.json,.log,.text' })}
        <textarea class="tool-textarea" id="tc-in" rows="7" spellcheck="false"
          placeholder="Paste text from PDFs, Word documents, emails, or chat windows..." style="margin-top:8px; font-family:var(--mono); font-size:0.84rem;"></textarea>
      </div>

      <!-- Sanitization Rules Toggles -->
      <div class="tc-fixes" id="tc-fixes" style="margin-top:12px;">
        ${SANITIZATION_RULES.map(r => `
          <label class="tc-fix">
            <input type="checkbox" data-fix="${r.id}"${r.on ? ' checked' : ''}>
            <span class="tc-fix-body">
              <span class="tc-fix-label">${r.label}<b class="tc-count" data-count="${r.id}"></b></span>
              <span class="tc-fix-hint">${r.hint}</span>
            </span>
          </label>`).join('')}
      </div>

      <!-- Stats Summary Strip -->
      <div id="tc-stats-strip" style="margin-top:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span id="tc-summary" class="fz-meta" style="font-weight:600; font-size:0.84rem; color:var(--g800);"></span>
        <div id="tc-pills" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
      </div>

      <!-- Output Section -->
      <div class="tool-section" style="margin-top:14px;">
        <div class="tool-row" style="justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <label class="tool-label" for="tc-out" style="margin:0;">Cleaned Text</label>
          <span id="tc-out-meta" style="font-size:0.78rem; color:var(--g600); font-family:var(--mono);"></span>
        </div>
        <textarea class="tool-textarea" id="tc-out" rows="7" readonly spellcheck="false" style="font-family:var(--mono); font-size:0.84rem;"></textarea>
      </div>

      <!-- Action Controls -->
      <div class="tool-controls" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="tc-copy">Copy Cleaned Text</button>
          <button class="btn btn-secondary btn-sm" id="tc-download">Download File</button>
          <button class="btn btn-secondary btn-sm" id="tc-replace">Replace Input with Result</button>
        </div>
        <button class="btn btn-secondary btn-sm" id="tc-clear">Clear</button>
      </div>
    `;

    const zone      = container.querySelector('#tc-zone');
    const inputZone = container.querySelector('#tc-zone-input');
    const inEl      = container.querySelector('#tc-in');
    const outEl     = container.querySelector('#tc-out');
    const fixesEl   = container.querySelector('#tc-fixes');
    const summaryEl = container.querySelector('#tc-summary');
    const pillsEl   = container.querySelector('#tc-pills');
    const outMetaEl = container.querySelector('#tc-out-meta');
    const copyBtn   = container.querySelector('#tc-copy');
    const downloadBtn = container.querySelector('#tc-download');
    const replaceBtn= container.querySelector('#tc-replace');
    const clearBtn  = container.querySelector('#tc-clear');

    let currentFileName = 'cleaned_text.txt';
    let started = false;

    this._cleanup.push(attachFileInput(zone, inputZone, (files) => {
      if (files[0]) {
        currentFileName = `cleaned_${files[0].name}`;
        files[0].text().then(t => {
          inEl.value = t;
          run();
        });
      }
    }));

    function run() {
      const source = inEl.value;
      let text = source;
      let totalModifications = 0;
      const statPills = [];

      for (const rule of SANITIZATION_RULES) {
        const box = fixesEl.querySelector(`[data-fix="${rule.id}"]`);
        const countEl = fixesEl.querySelector(`[data-count="${rule.id}"]`);

        const detectedCount = rule.countMatch(text);
        countEl.textContent = detectedCount ? ` ${detectedCount}` : '';
        countEl.classList.toggle('is-hot', detectedCount > 0 && !box.checked);

        if (detectedCount > 0) {
          statPills.push({ label: rule.label.split(' ')[0], count: detectedCount, active: box.checked });
        }

        if (box.checked) {
          const applied = rule.apply(text);
          if (applied !== text) {
            totalModifications += detectedCount || 1;
            text = applied;
          }
        }
      }

      outEl.value = text;

      const charDiff = source.length - text.length;
      if (!source) {
        summaryEl.textContent = '';
        pillsEl.innerHTML = '';
        outMetaEl.textContent = '';
      } else if (charDiff === 0 && totalModifications === 0) {
        summaryEl.textContent = ' Clean — no invisible characters or formatting artifacts found';
        pillsEl.innerHTML = '';
        outMetaEl.textContent = `${text.length.toLocaleString()} chars`;
      } else {
        summaryEl.textContent = `${source.length.toLocaleString()} → ${text.length.toLocaleString()} chars (${charDiff >= 0 ? `${charDiff.toLocaleString()} removed` : `${Math.abs(charDiff)} normalized`})`;
        outMetaEl.textContent = `${text.length.toLocaleString()} chars`;
        pillsEl.innerHTML = statPills.map(p => `
          <span style="font-size:0.74rem; font-weight:600; padding:2px 7px; border-radius:999px; background:${p.active ? 'var(--g100)' : '#fef3c7'}; color:${p.active ? 'var(--g800)' : '#92400e'}; border:1px solid ${p.active ? 'var(--g200)' : '#fde68a'};">
            ${p.count} ${p.label}
          </span>
        `).join('');
      }

      if (source && !started) { started = true; analytics?.started(); }
      if (source && totalModifications) analytics?.completed({ resultCount: totalModifications });
    }

    inEl.addEventListener('input', run);
    fixesEl.addEventListener('change', run);

    copyBtn.addEventListener('click', (e) => {
      if (!outEl.value) return;
      copyText(outEl.value, e.target);
      analytics?.copied({ outputKind: 'text' });
    });

    downloadBtn.addEventListener('click', () => {
      if (!outEl.value) return;
      downloadBlob(new Blob([outEl.value], { type: 'text/plain;charset=utf-8' }), currentFileName);
      analytics?.downloaded({ fileCount: 1 });
    });

    replaceBtn.addEventListener('click', () => { inEl.value = outEl.value; run(); });
    clearBtn.addEventListener('click', () => { inEl.value = ''; run(); inEl.focus(); });

    inEl.focus();
    run();

    if (artifact?.text) {
      inEl.value = artifact.text;
      run();
    }

    this._read = () => outEl.value || inEl.value;
    this._write = (text) => { inEl.value = text; run(); };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._read = this._write = null;
    this._cleanup = [];
  },
};
