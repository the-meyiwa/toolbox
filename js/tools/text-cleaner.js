/* Text Cleaner — strip what came along for the ride.

   Text copied out of Word, a PDF or a chat window arrives carrying smart
   quotes, non-breaking spaces, soft hyphens and zero-width characters
   that break search, code and CSVs while looking completely normal.
   This finds them, says what it found, and removes them. */

import { copyText } from '../utils.js';

/* Each fix reports how many times it fired, so the tool can tell you
   what was actually wrong rather than silently rewriting your text. */
const FIXES = [
  {
    id: 'invisible',
    label: 'Invisible characters',
    hint: 'Zero-width spaces and joiners, byte-order marks, soft hyphens',
    on: true,
    apply: (t) => t.replace(/[​-‍⁠﻿­]/g, ''),
  },
  {
    id: 'nbsp',
    label: 'Non-breaking spaces',
    hint: 'Look like spaces, behave differently, break code and CSV parsing',
    on: true,
    apply: (t) => t.replace(/[   ]/g, ' '),
  },
  {
    id: 'quotes',
    label: 'Smart quotes and dashes',
    hint: 'Curly quotes, en and em dashes, ellipses to plain equivalents',
    on: true,
    apply: (t) => t
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/[–—―]/g, '-')
      .replace(/…/g, '...'),
  },
  {
    id: 'spaces',
    label: 'Repeated spaces',
    hint: 'Collapses runs of spaces and tabs into one',
    on: true,
    apply: (t) => t.replace(/[ \t]{2,}/g, ' '),
  },
  {
    id: 'trailing',
    label: 'Trailing whitespace',
    hint: 'Spaces left at the end of lines',
    on: true,
    apply: (t) => t.replace(/[ \t]+$/gm, ''),
  },
  {
    id: 'blanklines',
    label: 'Extra blank lines',
    hint: 'More than one empty line in a row',
    on: false,
    apply: (t) => t.replace(/\n{3,}/g, '\n\n'),
  },
  {
    id: 'linebreaks',
    label: 'Line breaks inside paragraphs',
    hint: 'Rejoins text that was hard-wrapped by a PDF or email client',
    on: false,
    apply: (t) => t.replace(/([^\n])\n(?!\n)([^\n\s])/g, '$1 $2'),
  },
  {
    id: 'crlf',
    label: 'Windows line endings',
    hint: 'Converts CRLF to LF',
    on: true,
    apply: (t) => t.replace(/\r\n?/g, '\n'),
  },
  {
    id: 'emoji',
    label: 'Emoji and pictographs',
    hint: 'Off by default — only when you need plain text',
    on: false,
    apply: (t) => t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, ''),
  },
];

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label" for="tc-in">Paste your text</label>
        <textarea class="tool-textarea" id="tc-in" rows="8" spellcheck="false"
          placeholder="Paste from Word, a PDF, an email — anywhere text picks up hidden characters."></textarea>
      </div>

      <div class="tc-fixes" id="tc-fixes">
        ${FIXES.map(f => `
          <label class="tc-fix">
            <input type="checkbox" data-fix="${f.id}"${f.on ? ' checked' : ''}>
            <span class="tc-fix-body">
              <span class="tc-fix-label">${f.label}<b class="tc-count" data-count="${f.id}"></b></span>
              <span class="tc-fix-hint">${f.hint}</span>
            </span>
          </label>`).join('')}
      </div>

      <div class="tool-section">
        <div class="tool-row" style="justify-content:space-between; align-items:baseline;">
          <label class="tool-label" for="tc-out">Cleaned</label>
          <span class="fz-meta" id="tc-summary"></span>
        </div>
        <textarea class="tool-textarea" id="tc-out" rows="8" readonly spellcheck="false"></textarea>
      </div>

      <div class="tool-controls">
        <button class="btn btn-primary" id="tc-copy">Copy cleaned text</button>
        <button class="btn btn-secondary btn-sm" id="tc-replace">Replace input with result</button>
        <button class="btn btn-secondary btn-sm" id="tc-clear">Clear</button>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const inEl = $('tc-in'), outEl = $('tc-out');
    let started = false;

    function run() {
      const source = inEl.value;
      let text = source;
      let totalChanges = 0;

      for (const fix of FIXES) {
        const box = container.querySelector(`[data-fix="${fix.id}"]`);
        const countEl = container.querySelector(`[data-count="${fix.id}"]`);

        // Count what this fix would change even when it is switched off,
        // so the label tells you the text has a problem you are ignoring.
        const probe = fix.apply(text);
        const changed = probe === text ? 0 : Math.abs(text.length - probe.length) || 1;
        countEl.textContent = changed ? ` ${changed}` : '';
        countEl.classList.toggle('is-hot', changed > 0 && !box.checked);

        if (box.checked && probe !== text) {
          text = probe;
          totalChanges += changed;
        }
      }

      outEl.value = text;

      const removed = source.length - text.length;
      $('tc-summary').textContent = source
        ? (removed === 0 && totalChanges === 0
            ? 'Nothing to clean — this text is already plain'
            : `${source.length.toLocaleString()} → ${text.length.toLocaleString()} characters${removed > 0 ? ` · ${removed.toLocaleString()} removed` : ''}`)
        : '';

      if (source && !started) { started = true; analytics?.started(); }
      if (source && totalChanges) analytics?.completed({ resultCount: totalChanges });
    }

    inEl.addEventListener('input', run);
    $('tc-fixes').addEventListener('change', run);
    $('tc-copy').addEventListener('click', (e) => {
      if (!outEl.value) return;
      copyText(outEl.value, e.target);
      analytics?.copied({ outputKind: 'text' });
    });
    $('tc-replace').addEventListener('click', () => { inEl.value = outEl.value; run(); });
    $('tc-clear').addEventListener('click', () => { inEl.value = ''; run(); inEl.focus(); });

    inEl.focus();
    run();
  },

  destroy() {},
};
