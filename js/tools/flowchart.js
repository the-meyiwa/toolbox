/* Flowchart — draw the logic, get the code.

   Blocks nest rather than float, which is what makes the generated code
   real rather than a rough sketch: a nested structure maps cleanly onto
   any block-structured language, an arbitrary graph of arrows does not.

   Edit the chart on the left, watch seven languages update on the right. */

import { NODE_TYPES, DATA_TYPES, LANGUAGES, EXAMPLES, makeNode, generateCode } from '../lib/flowchart.js';
import { escapeHtml } from '../lib/biz.js';
import { copyText } from '../utils.js';
import { handOff } from '../lib/artifacts.js';

const STORE = 'toolbox.flowchart';

/* File extension per generated language, for naming what gets handed on. */
const EXT = { javascript: 'js', python: 'py', c: 'c', java: 'java', csharp: 'cs' };

export default {
  render(container, { analytics } = {}) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { /* ignore */ }

    const state = {
      nodes: EXAMPLES.fizzbuzz.build(),
      lang: LANGUAGES[saved.lang] ? saved.lang : 'python',
      example: 'fizzbuzz',
      selected: null,
    };

    container.innerHTML = `
      <div class="flw">
        <div class="flw-bar">
          <select class="tool-select" id="fl-example" aria-label="Example">
            ${Object.entries(EXAMPLES).map(([id, e]) => `<option value="${id}">${e.name}</option>`).join('')}
          </select>
          <div class="flw-palette" id="fl-palette">
            ${Object.entries(NODE_TYPES).map(([k, t]) =>
              `<button class="btn btn-sm" data-add="${k}" title="${escapeHtml(t.hint)}">+ ${t.label}</button>`).join('')}
          </div>
        </div>

        <p class="flw-about" id="fl-about"></p>

        <div class="flw-split">
          <div class="flw-chart-wrap">
            <div class="flw-chart" id="fl-chart"></div>
          </div>

          <div class="flw-code-wrap">
            <div class="flw-code-bar">
              <select class="tool-select" id="fl-lang" aria-label="Language">
                ${Object.entries(LANGUAGES).map(([id, l]) =>
                  `<option value="${id}"${id === state.lang ? ' selected' : ''}>${l.name}</option>`).join('')}
              </select>
              <button class="btn btn-sm" id="fl-copy">Copy code</button>
              <button class="btn btn-sm" id="fl-run" title="Open this in the Code Playground">Run it</button>
            </div>
            <pre class="flw-code" id="fl-code"></pre>
          </div>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);

    /* ---------------- chart rendering ----------------
       The chart is drawn as nested HTML rather than absolutely-positioned
       boxes, so branches grow with their contents and nothing ever
       overlaps. */

    function renderChart() {
      $('fl-chart').innerHTML = `
        <div class="flw-terminal">Start</div>
        ${renderList(state.nodes, [])}
        <div class="flw-terminal">End</div>`;
    }

    /** @param {number[]} path index trail to this list, for editing */
    function renderList(list, path) {
      const items = (list ?? []).map((node, i) => renderNode(node, [...path, i])).join('');
      return `<div class="flw-list" data-path="${path.join('.')}">
        ${items || `<div class="flw-empty-slot">Nothing here yet</div>`}
      </div>`;
    }

    function renderNode(node, path) {
      const p = path.join('.');
      const sel = state.selected === p ? ' is-selected' : '';
      const controls = `
        <span class="flw-node-tools">
          <button data-move="${p}:-1" aria-label="Move up">↑</button>
          <button data-move="${p}:1" aria-label="Move down">↓</button>
          <button data-del="${p}" aria-label="Delete">×</button>
        </span>`;

      if (node.kind === 'if') {
        return `
          <div class="flw-node flw-branch${sel}" data-node="${p}">
            <div class="flw-diamond">
              <span class="flw-kind">If</span>
              <span class="flw-text">${escapeHtml(node.cond || '…')}</span>
              ${controls}
            </div>
            <div class="flw-branches">
              <div class="flw-branch-col">
                <span class="flw-branch-label is-true">True</span>
                ${renderList(node.then, [...path, 'then'])}
              </div>
              <div class="flw-branch-col">
                <span class="flw-branch-label is-false">False</span>
                ${renderList(node.else, [...path, 'else'])}
              </div>
            </div>
          </div>`;
      }

      if (node.kind === 'while' || node.kind === 'for') {
        const head = node.kind === 'while'
          ? `While ${escapeHtml(node.cond || '…')}`
          : `For ${escapeHtml(node.name || 'i')} = ${escapeHtml(node.from)} to ${escapeHtml(node.to)}${node.step !== '1' ? ` step ${escapeHtml(node.step)}` : ''}`;
        return `
          <div class="flw-node flw-loop${sel}" data-node="${p}">
            <div class="flw-diamond">
              <span class="flw-kind">${node.kind === 'while' ? 'Loop' : 'Count'}</span>
              <span class="flw-text">${head}</span>
              ${controls}
            </div>
            <div class="flw-loop-body">${renderList(node.body, [...path, 'body'])}</div>
          </div>`;
      }

      const label = {
        declare: `Declare ${node.dataType} ${node.name || '…'}`,
        assign: `${node.name || '…'} = ${node.expr || '…'}`,
        output: `Output ${node.expr || '…'}`,
        input: `Input ${node.name || '…'}`,
        comment: node.text || '…',
      }[node.kind] ?? node.kind;

      const shape = NODE_TYPES[node.kind]?.shape ?? 'rect';
      return `
        <div class="flw-node${sel}" data-node="${p}">
          <div class="flw-box flw-${shape}">
            <span class="flw-kind">${NODE_TYPES[node.kind]?.label ?? node.kind}</span>
            <span class="flw-text">${escapeHtml(label)}</span>
            ${controls}
          </div>
        </div>`;
    }

    /* ---------------- path helpers ----------------
       A node's address is its trail through the tree: "0.then.1" is the
       second statement of the first node's true branch. */

    function resolveList(path) {
      let list = state.nodes;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (key === 'then' || key === 'else' || key === 'body') list = list[key];
        else list = list[Number(key)];
        if (Array.isArray(list) === false && list) {
          // stepping through a node, next key selects its branch
          continue;
        }
      }
      return list;
    }

    /** Walk to the container array and index for a path string. */
    function locate(pathStr) {
      const parts = pathStr.split('.');
      let list = state.nodes;
      let node = null;
      for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        if (key === 'then' || key === 'else' || key === 'body') {
          list = node[key];
        } else {
          const idx = Number(key);
          if (i === parts.length - 1) return { list, index: idx, node: list[idx] };
          node = list[Number(key)];
        }
      }
      return { list, index: -1, node: null };
    }

    /* ---------------- editing ---------------- */

    function commit() {
      renderChart();
      renderCode();
      persist();
    }

    const persist = () => {
      try { localStorage.setItem(STORE, JSON.stringify({ lang: state.lang })); } catch { /* private */ }
    };

    $('fl-palette').addEventListener('click', (e) => {
      const kind = e.target.dataset.add;
      if (!kind) return;
      // New blocks go inside the selected container when one is chosen,
      // which is how you build a loop body without dragging.
      let target = state.nodes;
      if (state.selected) {
        const { node } = locate(state.selected);
        if (node?.kind === 'if') target = node.then;
        else if (node?.body) target = node.body;
      }
      target.push(makeNode(kind, kind === 'for' ? { name: 'i' } : {}));
      commit();
      analytics?.started();
    });

    $('fl-chart').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        const { list, index } = locate(del.dataset.del);
        list.splice(index, 1);
        state.selected = null;
        commit();
        return;
      }

      const move = e.target.closest('[data-move]');
      if (move) {
        const [p, dir] = move.dataset.move.split(':');
        const { list, index } = locate(p);
        const to = index + Number(dir);
        if (to >= 0 && to < list.length) {
          const [item] = list.splice(index, 1);
          list.splice(to, 0, item);
          commit();
        }
        return;
      }

      const node = e.target.closest('[data-node]');
      if (node) {
        state.selected = state.selected === node.dataset.node ? null : node.dataset.node;
        renderChart();
        renderEditor();
      }
    });

    /* Clicking a block opens its fields underneath the chart. */
    function renderEditor() {
      const existing = container.querySelector('.flw-editor');
      existing?.remove();
      if (!state.selected) return;

      const { node } = locate(state.selected);
      if (!node) return;

      const fields = NODE_TYPES[node.kind]?.fields ?? [];
      const label = { name: 'Variable', expr: 'Expression', cond: 'Condition', dataType: 'Type',
                      from: 'From', to: 'To', step: 'Step', text: 'Text' };

      const panel = document.createElement('div');
      panel.className = 'flw-editor';
      panel.innerHTML = `
        <span class="flw-editor-title">${NODE_TYPES[node.kind]?.label ?? node.kind}</span>
        ${fields.map(f => f === 'dataType'
          ? `<label class="fz-ctl"><span>${label[f]}</span>
               <select class="tool-select" data-field="${f}">
                 ${DATA_TYPES.map(t => `<option value="${t}"${t === node[f] ? ' selected' : ''}>${t}</option>`).join('')}
               </select></label>`
          : `<label class="fz-ctl"><span>${label[f] ?? f}</span>
               <input type="text" class="tool-input" data-field="${f}" value="${escapeHtml(node[f] ?? '')}"></label>`
        ).join('')}
        <button class="btn btn-sm" id="fl-done">Done</button>`;

      $('fl-chart').insertAdjacentElement('afterend', panel);

      panel.addEventListener('input', (e) => {
        const f = e.target.dataset.field;
        if (!f) return;
        node[f] = e.target.value;
        renderCode();
        // The chart label updates without rebuilding the panel, so the
        // field keeps focus while typing.
        const box = container.querySelector(`[data-node="${state.selected}"] .flw-text`);
        if (box) {
          const fresh = document.createElement('div');
          fresh.innerHTML = renderNode(node, state.selected.split('.'));
          box.textContent = fresh.querySelector('.flw-text').textContent;
        }
      });
      panel.querySelector('#fl-done').addEventListener('click', () => {
        state.selected = null;
        renderChart();
        panel.remove();
      });
      panel.querySelector('input, select')?.focus();
    }

    /* ---------------- code ---------------- */

    function renderCode() {
      try {
        const code = generateCode(state.nodes, state.lang);
        $('fl-code').textContent = code;
        analytics?.completed({ outputKind: 'code' });
      } catch (err) {
        $('fl-code').textContent = `// ${err.message}`;
        analytics?.error('generate_failed');
      }
    }

    $('fl-lang').addEventListener('change', (e) => { state.lang = e.target.value; renderCode(); persist(); });

    $('fl-copy').addEventListener('click', (e) => {
      copyText($('fl-code').textContent, e.target);
      analytics?.copied({ outputKind: 'code' });
    });

    /* The generated code is a real program, so handing it to the runner
       is the obvious next step rather than a novelty. */
    $('fl-run').addEventListener('click', () => {
      const map = { javascript: 'javascript', python: 'python', c: 'c', java: 'java', csharp: 'csharp' };
      const target = map[state.lang];
      if (!target) {
        $('fl-code').insertAdjacentHTML('beforebegin',
          `<p class="flw-note">${LANGUAGES[state.lang].name} is not one of the languages the playground runs. Copy it instead.</p>`);
        setTimeout(() => container.querySelector('.flw-note')?.remove(), 4000);
        return;
      }
      // Handed over through the artifact layer. This used to write straight
      // into the playground's own storage key, which meant one tool had to
      // know another tool's internals; now neither knows the other exists.
      handOff({
        kind: 'code',
        name: `${state.example}.${EXT[target] ?? 'txt'}`,
        text: $('fl-code').textContent,
        from: 'flowchart',
        lang: target,
      });
      window.location.hash = '#code-playground';
    });

    $('fl-example').addEventListener('change', (e) => {
      state.example = e.target.value;
      state.nodes = EXAMPLES[state.example].build();
      state.selected = null;
      $('fl-about').textContent = EXAMPLES[state.example].about;
      container.querySelector('.flw-editor')?.remove();
      commit();
    });

    $('fl-about').textContent = EXAMPLES.fizzbuzz.about;
    commit();
    analytics?.started();

    this._read = () => $('fl-code').textContent;
  },

  getArtifact() { return { kind: 'code', text: this._read?.() ?? '' }; },

  destroy() { this._read = null; },
};
