/* File Checksum — verify a download actually is what it claims to be.

   Every "check the SHA256 of your download" instruction on the internet
   assumes you have a terminal. This does it in the browser, without the
   file leaving the device — which matters, because the whole point is
   that you do not yet trust the file. */

import { humanBytes, attachFileInput, dropZone } from '../lib/file-engine.js';
import { copyText } from '../utils.js';

// SubtleCrypto offers exactly these. MD5 is absent by design — it is
// broken for verification, and saying so is more useful than shipping it.
const ALGOS = ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'];

const toHex = (buf) =>
  [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export default {
  render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      ${dropZone('fh-zone', { label: 'Drop a file to fingerprint', hint: 'or click to choose · nothing is uploaded', accept: '*/*' })}

      <div class="tool-controls fz-controls">
        <label class="fz-ctl"><span>Algorithm</span>
          <select class="tool-select" id="fh-algo">
            ${ALGOS.map(a => `<option value="${a}"${a === 'SHA-256' ? ' selected' : ''}>${a}</option>`).join('')}
          </select></label>
        <label class="fz-ctl" style="flex:2; min-width:240px;"><span>Compare against (optional)</span>
          <input type="text" class="tool-input" id="fh-expect" placeholder="Paste the published checksum" spellcheck="false"></label>
      </div>

      <div id="fh-out"></div>

      <p class="biz-hint" style="margin-top:18px;">
        A checksum proves a file arrived intact and unaltered. Paste the value published
        alongside the download and this will tell you plainly whether they match.
        MD5 is deliberately not offered — it can be forged, so it proves nothing about tampering.
      </p>`;

    const zone   = container.querySelector('#fh-zone');
    const input  = container.querySelector('#fh-zone-input');
    const algoEl = container.querySelector('#fh-algo');
    const expect = container.querySelector('#fh-expect');
    const out    = container.querySelector('#fh-out');

    let current = null;   // { file, digests: Map<algo, hex> }

    function compare() {
      if (!current) return;
      const algo = algoEl.value;
      const hash = current.digests.get(algo);
      const want = expect.value.trim().toLowerCase().replace(/\s+/g, '');

      let verdict = '';
      if (want && hash) {
        const match = want === hash;
        verdict = match
          ? `<div class="fh-verdict fh-ok"><strong>Match</strong><span>This file is exactly what the checksum describes.</span></div>`
          : `<div class="fh-verdict fh-no"><strong>No match</strong><span>This file is not the one that checksum came from. Do not trust it — re-download and check again.</span></div>`;
      }

      out.innerHTML = `
        <div class="fz-row fz-row-block">
          <div class="fz-name">
            <strong>${current.file.name}</strong>
            <span class="fz-meta">${humanBytes(current.file.size)}${current.file.type ? ' · ' + current.file.type : ''}</span>
          </div>
        </div>
        ${verdict}
        <div class="fh-hashes">
          ${[...current.digests].map(([a, h]) => `
            <div class="fh-row${a === algo ? ' is-active' : ''}">
              <span class="fh-algo">${a}</span>
              <code class="fh-value">${h}</code>
              <button class="btn btn-sm" data-copy="${a}">Copy</button>
            </div>`).join('')}
        </div>`;
    }

    async function handle(files) {
      const file = files[0];
      if (!file) return;
      analytics?.started();

      out.innerHTML = `<div class="fz-row"><span class="fz-meta">Reading ${file.name}…</span></div>`;

      try {
        // SubtleCrypto has no streaming digest, so the file is read whole.
        // Fine for the sizes people actually verify; honest if it is not.
        const buf = await file.arrayBuffer();
        const digests = new Map();
        for (const algo of ALGOS) {
          digests.set(algo, toHex(await crypto.subtle.digest(algo, buf)));
        }
        current = { file, digests };
        compare();
        analytics?.completed({ fileCount: 1, bytesIn: file.size });
      } catch (err) {
        current = null;
        out.innerHTML = `<div class="fz-row fz-row-error"><span class="fz-err">${
          err.name === 'RangeError' || /allocat/i.test(err.message)
            ? 'That file is too large for this browser to hold in memory all at once.'
            : `Could not read that file: ${err.message}`
        }</span></div>`;
        analytics?.error('hash_failed');
      }
    }

    this._cleanup.push(attachFileInput(zone, input, handle, { accept: null }));

    algoEl.addEventListener('change', compare);
    expect.addEventListener('input', compare);

    out.addEventListener('click', (e) => {
      const algo = e.target.dataset.copy;
      if (!algo || !current) return;
      copyText(current.digests.get(algo), e.target);
      analytics?.copied({ outputKind: 'text' });
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
