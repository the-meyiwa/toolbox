import { escapeHtml } from '../lib/biz.js';

/* Produces a signature built from tables and inline styles, because
   that is the only thing Outlook renders reliably. Copy is done from a
   live contenteditable node so the rich formatting survives the paste. */

const TEMPLATES = [
  { id: 'classic',  name: 'Classic' },
  { id: 'compact',  name: 'Compact' },
  { id: 'bar',      name: 'Accent bar' },
];

export default {
  render(container) {
    const state = {
      name: 'Meyiwa Edun',
      title: 'Software Engineer',
      company: 'Toolbox',
      email: 'name@company.com',
      phone: '+44 7700 900000',
      website: 'company.com',
      address: '',
      accent: '#111111',
      template: 'classic',
      showDisclaimer: false,
      disclaimer: 'This email and any attachments are confidential and intended solely for the addressee.',
    };

    const f = (label, id, value, type = 'text') => `
      <div class="biz-field">
        <label class="tool-label" for="sig-${id}">${label}</label>
        <input type="${type}" class="tool-input" id="sig-${id}" value="${escapeHtml(value)}" autocomplete="off">
      </div>`;

    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          ${f('Full name', 'name', state.name)}
          ${f('Job title', 'title', state.title)}
          ${f('Company', 'company', state.company)}
          ${f('Email', 'email', state.email, 'email')}
          ${f('Phone', 'phone', state.phone, 'tel')}
          ${f('Website', 'website', state.website)}
          ${f('Address (optional)', 'address', state.address)}

          <div class="biz-field">
            <label class="tool-label">Layout</label>
            <div class="btn-group t3d-seg" id="sig-templates">
              ${TEMPLATES.map(t => `<button class="btn btn-sm${t.id === state.template ? ' is-active' : ''}" data-tpl="${t.id}">${t.name}</button>`).join('')}
            </div>
          </div>

          <div class="biz-field">
            <label class="tool-label" for="sig-accent">Accent colour</label>
            <input type="color" class="tool-input sig-color" id="sig-accent" value="${state.accent}">
          </div>

          <label class="tool-checkbox" style="margin-top:6px;">
            <input type="checkbox" id="sig-show-disc"> <span>Add a confidentiality notice</span>
          </label>
          <div class="biz-field" id="sig-disc-f" hidden>
            <textarea class="tool-textarea" id="sig-disclaimer" rows="3">${escapeHtml(state.disclaimer)}</textarea>
          </div>
        </div>

        <div class="tool-section">
          <label class="tool-label">Preview</label>
          <div class="sig-preview" id="sig-preview" contenteditable="false"></div>

          <div class="tool-controls" style="margin-top:16px;">
            <button class="btn btn-primary btn-sm" id="sig-copy">Copy signature</button>
            <button class="btn btn-secondary btn-sm" id="sig-copy-html">Copy HTML source</button>
          </div>

          <div class="tool-output biz-explain" style="margin-top:16px;">
            <strong>How to use it:</strong> click <em>Copy signature</em>, then paste into
            Gmail (Settings → Signature) or Outlook (File → Options → Mail → Signatures).
            The formatting comes with it.
            <br><br>
            Built with tables and inline styles on purpose — it is the only markup Outlook
            renders consistently. No images are used, so nothing breaks when a recipient
            blocks remote content.
          </div>

          <details class="sig-source">
            <summary>View HTML source</summary>
            <pre id="sig-html"></pre>
          </details>
        </div>
      </div>`;

    const preview = container.querySelector('#sig-preview');
    const htmlEl  = container.querySelector('#sig-html');

    function read() {
      for (const k of ['name', 'title', 'company', 'email', 'phone', 'website', 'address']) {
        state[k] = container.querySelector(`#sig-${k}`).value;
      }
      state.accent = container.querySelector('#sig-accent').value;
      state.showDisclaimer = container.querySelector('#sig-show-disc').checked;
      state.disclaimer = container.querySelector('#sig-disclaimer').value;
      container.querySelector('#sig-disc-f').hidden = !state.showDisclaimer;
    }

    function build() {
      const e = escapeHtml;
      const a = state.accent;
      const base = 'font-family:Arial,Helvetica,sans-serif;';
      const link = (href, text) => `<a href="${e(href)}" style="color:${e(a)};text-decoration:none;">${e(text)}</a>`;

      const contactBits = [
        state.email   && link(`mailto:${state.email}`, state.email),
        state.phone   && link(`tel:${state.phone.replace(/\s+/g, '')}`, state.phone),
        state.website && link(state.website.startsWith('http') ? state.website : `https://${state.website}`, state.website),
      ].filter(Boolean);

      const roleLine = [state.title, state.company].filter(Boolean).map(e).join(' · ');

      let body;
      if (state.template === 'compact') {
        body = `
          <tr><td style="${base}font-size:13px;line-height:1.5;color:#222;">
            <strong style="color:${e(a)};">${e(state.name)}</strong>${roleLine ? ` — ${roleLine}` : ''}<br>
            ${contactBits.join(' &nbsp;·&nbsp; ')}
            ${state.address ? `<br><span style="color:#777;font-size:12px;">${e(state.address)}</span>` : ''}
          </td></tr>`;
      } else if (state.template === 'bar') {
        body = `
          <tr>
            <td style="width:3px;background:${e(a)};"></td>
            <td style="padding-left:14px;${base}font-size:13px;line-height:1.6;color:#222;">
              <div style="font-size:16px;font-weight:bold;color:#111;">${e(state.name)}</div>
              ${roleLine ? `<div style="color:#666;">${roleLine}</div>` : ''}
              <div style="padding-top:6px;">${contactBits.join('<br>')}</div>
              ${state.address ? `<div style="color:#888;font-size:12px;padding-top:4px;">${e(state.address)}</div>` : ''}
            </td>
          </tr>`;
      } else {
        body = `
          <tr><td style="${base}font-size:16px;font-weight:bold;color:#111;padding-bottom:2px;">${e(state.name)}</td></tr>
          ${roleLine ? `<tr><td style="${base}font-size:13px;color:#666;padding-bottom:8px;">${roleLine}</td></tr>` : ''}
          <tr><td style="border-top:2px solid ${e(a)};padding-top:8px;${base}font-size:13px;line-height:1.7;color:#222;">
            ${contactBits.join('<br>')}
            ${state.address ? `<br><span style="color:#888;font-size:12px;">${e(state.address)}</span>` : ''}
          </td></tr>`;
      }

      const disclaimer = state.showDisclaimer && state.disclaimer.trim()
        ? `<tr><td colspan="2" style="${base}font-size:10px;color:#999;line-height:1.45;padding-top:12px;">${e(state.disclaimer)}</td></tr>`
        : '';

      return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${body}${disclaimer}</table>`;
    }

    function refresh() {
      read();
      const html = build();
      preview.innerHTML = html;
      htmlEl.textContent = html;
    }

    container.addEventListener('input', refresh);
    container.addEventListener('change', refresh);

    container.querySelector('#sig-templates').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tpl]');
      if (!b) return;
      for (const x of container.querySelectorAll('#sig-templates .btn')) x.classList.toggle('is-active', x === b);
      state.template = b.dataset.tpl;
      refresh();
    });

    async function flash(btn, text) {
      const prev = btn.textContent;
      btn.textContent = text;
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = prev; btn.classList.remove('copied'); }, 1400);
    }

    container.querySelector('#sig-copy').addEventListener('click', async (e) => {
      const html = build();
      try {
        // Rich clipboard write keeps the formatting when pasted into a mail client.
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([preview.innerText], { type: 'text/plain' }),
        })]);
        flash(e.target, 'Copied ✓');
      } catch {
        // Older browsers: select the rendered node and use execCommand.
        const range = document.createRange();
        range.selectNodeContents(preview);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();
        flash(e.target, 'Copied ✓');
      }
    });

    container.querySelector('#sig-copy-html').addEventListener('click', (e) => {
      navigator.clipboard.writeText(build()).then(() => flash(e.target, 'Copied ✓'));
    });

    refresh();
  },
  destroy() {},
};
