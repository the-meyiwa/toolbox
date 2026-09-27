/* ============================================================
   Text tool shell.

   Most text, data and developer tools are the same machine: input,
   a mode, a few options, output. This builds that machine from a
   definition so each tool is only its logic:

   makeTextTool({
     id: 'list-tools',
     inputLabel, outputLabel, placeholder, sample,
     inputKind: 'text', outputKind: 'text',
     fields: [...],                  // shared by every mode
     modes: [{ id, label, fields?, run(input, values) → string | Result, noInput? }],
   })

   Result = { text?, html?, stats?: [[label, value]], kind?, error? }.
   `run` may be async. Errors thrown by `run` are shown, not swallowed.
   ============================================================ */

import { mountForm, modeSwitch, esc, saveBlob } from './form.js';
import { copyText } from '../../utils.js';
import { kindExt, kindMime } from '../../registry/kinds.js';

export function makeTextTool(def) {
  const modes = def.modes?.length ? def.modes : [{ id: 'run', label: 'Run', run: def.run, fields: [] }];

  return {
    render(container) {
      let mode = modes[0];
      let form = null;
      let lastText = '';
      let lastKind = def.outputKind || 'text';
      let token = 0;
      let timer = 0;

      container.innerHTML = `
        <div class="kit" data-kit="${esc(def.id)}">
          <div class="kit-modebar" data-el="modes"></div>
          <div class="kit-form" data-el="form"></div>
          <div class="kit-io${def.stacked ? ' is-stacked' : ''}">
            <section class="kit-pane" data-el="in-pane">
              <div class="kit-pane-head">
                <label class="tool-label" for="${esc(def.id)}-in">${esc(def.inputLabel || 'Input')}</label>
                <div class="kit-pane-actions">
                  ${def.sample ? '<button type="button" class="btn btn-ghost btn-sm" data-act="sample">Sample</button>' : ''}
                  <button type="button" class="btn btn-ghost btn-sm" data-act="open">Open file</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-act="clear">Clear</button>
                </div>
              </div>
              <textarea class="tool-textarea kit-text" id="${esc(def.id)}-in" rows="${def.rows || 12}" spellcheck="false" placeholder="${esc(def.placeholder || 'Paste or type here…')}"></textarea>
            </section>
            <section class="kit-pane">
              <div class="kit-pane-head">
                <span class="tool-label">${esc(def.outputLabel || 'Result')}</span>
                <div class="kit-pane-actions">
                  <button type="button" class="btn btn-ghost btn-sm" data-act="use" title="Use the result as the input">Use as input</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-act="download">Download</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-act="copy">Copy</button>
                </div>
              </div>
              <div class="kit-out" data-el="out" aria-live="polite"></div>
            </section>
          </div>
          <div class="kit-stats" data-el="stats"></div>
        </div>`;

      const $ = (s) => container.querySelector(`[data-el="${s}"]`);
      const input = container.querySelector('.kit-text');
      const out = $('out');
      const stats = $('stats');

      const show = (res) => {
        if (res == null) res = '';
        if (typeof res === 'string') res = { text: res };
        lastText = res.text ?? '';
        lastKind = res.kind || mode.outputKind || def.outputKind || 'text';
        out.classList.toggle('is-error', !!res.error);
        if (res.error) out.innerHTML = `<p class="kit-error">${esc(res.error)}</p>`;
        else if (res.html != null) out.innerHTML = res.html;
        else out.innerHTML = lastText ? `<pre class="kit-pre">${esc(lastText)}</pre>` : '<p class="kit-empty">The result appears here.</p>';
        stats.innerHTML = (res.stats || []).map(([l, v]) => `<span><b>${esc(v)}</b> ${esc(l)}</span>`).join('');
      };

      const run = async () => {
        const my = ++token;
        const text = input.value;
        if (!text && !mode.noInput) { show(''); return; }
        try {
          const res = await mode.run(text, form.values);
          if (my === token) show(res);
        } catch (err) {
          if (my === token) show({ error: err?.message || String(err) });
        }
      };
      const schedule = () => { clearTimeout(timer); timer = setTimeout(run, def.delay ?? 120); };

      const mountFields = () => {
        form?.destroy();
        const prior = form?.values || {};
        form = mountForm($('form'), [...(def.fields || []), ...(mode.fields || [])], { prefix: `${def.id}-f`, initial: prior, onChange: schedule });
        $('form').hidden = !((def.fields || []).length + (mode.fields || []).length);
        container.querySelector('[data-el="in-pane"]').hidden = !!mode.noInput;
        container.querySelector('.kit-io').classList.toggle('is-single', !!mode.noInput);
      };

      modeSwitch($('modes'), modes, mode.id, (id) => { mode = modes.find((m) => m.id === id) || modes[0]; mountFields(); run(); });
      mountFields();

      input.addEventListener('input', schedule);
      container.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'sample') { input.value = typeof def.sample === 'function' ? def.sample(mode.id) : def.sample; run(); }
        if (act === 'clear') { input.value = ''; run(); input.focus(); }
        if (act === 'copy' && lastText) copyText(lastText, e.target.closest('button'));
        if (act === 'use' && lastText) { input.value = lastText; run(); }
        if (act === 'download' && lastText) saveBlob(new Blob([lastText], { type: kindMime(lastKind) }), `${def.id}-result.${def.ext || kindExt(lastKind)}`);
        if (act === 'open') {
          const pick = document.createElement('input');
          pick.type = 'file';
          if (def.accept) pick.accept = def.accept;
          pick.onchange = async () => { const f = pick.files?.[0]; if (f) { input.value = await f.text(); run(); } };
          pick.click();
        }
      });

      show('');
      if (mode.noInput) run();
      this._read = () => lastText || input.value;
      this._kind = () => lastKind;
      this._write = (t) => { input.value = t; run(); };
      this._run = run;
      this._cleanup = () => { clearTimeout(timer); form?.destroy(); };
      def.mounted?.(container, { input, run, get values() { return form.values; }, get mode() { return mode.id; } });
    },

    getArtifact() {
      const text = this._read?.() ?? '';
      const kind = this._kind?.() || def.outputKind || 'text';
      return text ? { kind: (def.produces || [kind]).includes(kind) ? kind : (def.produces?.[0] || 'text'), text } : null;
    },
    setArtifact(a) { if (a?.text != null) this._write?.(a.text); },
    destroy() { this._cleanup?.(); this._read = this._write = this._run = null; },
  };
}
