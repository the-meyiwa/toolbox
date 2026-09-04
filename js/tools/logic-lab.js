/* Logic Lab — wire gates together and watch the signals move.

   Live wires carry colour, so a circuit that is wrong is visibly wrong.
   The truth table and the Boolean expression are generated from the same
   model the canvas draws, so they cannot disagree with what is on screen. */

import { GATES, evaluate, truthTable, expressionFor, sumOfProducts, inputsOf, outputsOf, EXAMPLES, newId } from '../lib/logic.js';
import { escapeHtml } from '../lib/biz.js';

const W = 92, H = 56;                     // gate box
const portY = (i, n) => (H / (n + 1)) * (i + 1);

export default {
  render(container, { analytics } = {}) {
    const state = {
      circuit: EXAMPLES.halfAdder.build(),
      inputs: {},                         // input node id → 0|1
      selected: null,
      pending: null,                       // { from } while dragging a wire
      example: 'halfAdder',
    };

    container.innerHTML = `
      <div class="lgl">
        <div class="lgl-bar">
          <select class="tool-select" id="lg-example" aria-label="Example circuit">
            ${Object.entries(EXAMPLES).map(([id, e]) =>
              `<option value="${id}">${e.name}</option>`).join('')}
          </select>
          <div class="lgl-palette" id="lg-palette">
            ${['input', 'output', 'not', 'and', 'or', 'nand', 'nor', 'xor', 'xnor']
              .map(t => `<button class="btn btn-sm" data-add="${t}">+ ${GATES[t].label}</button>`).join('')}
          </div>
          <div class="lgl-bar-right">
            <button class="btn btn-sm" id="lg-delete" disabled>Delete</button>
            <button class="btn btn-sm" id="lg-clear">Clear</button>
          </div>
        </div>

        <p class="lgl-about" id="lg-about"></p>

        <div class="lgl-canvas-wrap">
          <svg class="lgl-canvas" id="lg-canvas" viewBox="0 0 820 400" preserveAspectRatio="xMidYMin meet">
            <g id="lg-wires"></g>
            <g id="lg-nodes"></g>
            <path id="lg-ghost" class="lgl-ghost" hidden></path>
          </svg>
          <p class="lgl-hint" id="lg-hint"></p>
        </div>

        <div class="lgl-results">
          <div class="lgl-expr">
            <h3 class="cq-h">Boolean expression</h3>
            <div id="lg-expressions"></div>
          </div>
          <div class="lgl-truth">
            <h3 class="cq-h">Truth table</h3>
            <div id="lg-table"></div>
          </div>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const svg = $('lg-canvas'), nodesG = $('lg-nodes'), wiresG = $('lg-wires'), ghost = $('lg-ghost');

    /* ---------------- geometry ---------------- */

    const nodeById = (id) => state.circuit.nodes.find(n => n.id === id);

    function outPos(node) {
      return { x: node.x + (node.type === 'input' ? 54 : W), y: node.y + (node.type === 'input' ? 18 : H / 2) };
    }
    function inPos(node, port) {
      const def = GATES[node.type];
      if (node.type === 'output') return { x: node.x, y: node.y + 18 };
      return { x: node.x, y: node.y + portY(port, def.ins) };
    }

    /* ---------------- drawing ---------------- */

    function render() {
      const { values, cycle, missing } = evaluate(state.circuit, state.inputs);

      // wires first, so gates sit on top of them
      wiresG.innerHTML = state.circuit.wires.map(w => {
        const a = nodeById(w.from), b = nodeById(w.to);
        if (!a || !b) return '';
        const p1 = outPos(a), p2 = inPos(b, w.toPort);
        const dx = Math.max(36, Math.abs(p2.x - p1.x) * 0.45);
        const v = values.get(w.from);
        return `<path class="lgl-wire${v === 1 ? ' is-on' : v === null ? ' is-unknown' : ''}"
                      data-wire="${w.id}"
                      d="M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}"/>`;
      }).join('');

      nodesG.innerHTML = state.circuit.nodes.map(n => {
        const def = GATES[n.type];
        const v = values.get(n.id);
        const sel = state.selected === n.id ? ' is-selected' : '';

        if (n.type === 'input') {
          const on = state.inputs[n.id] === 1;
          return `<g class="lgl-node lgl-io${sel}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
            <rect class="lgl-box${on ? ' is-on' : ''}" width="54" height="36" rx="18"/>
            <text class="lgl-label" x="27" y="23">${escapeHtml(n.label || 'IN')}</text>
            <circle class="lgl-port lgl-out" cx="54" cy="18" r="6" data-port-out="${n.id}"/>
            <text class="lgl-bit" x="27" y="-6">${on ? '1' : '0'}</text>
          </g>`;
        }

        if (n.type === 'output') {
          return `<g class="lgl-node lgl-io${sel}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
            <circle class="lgl-port lgl-in" cx="0" cy="18" r="6" data-port-in="${n.id}" data-port-index="0"/>
            <rect class="lgl-box lgl-out-box${v === 1 ? ' is-on' : ''}" x="10" width="60" height="36" rx="8"/>
            <text class="lgl-label" x="40" y="23">${escapeHtml(n.label || 'OUT')}</text>
            <text class="lgl-bit" x="40" y="-6">${v === null || v === undefined ? '?' : v}</text>
          </g>`;
        }

        const ports = Array.from({ length: def.ins }, (_, i) =>
          `<circle class="lgl-port lgl-in" cx="0" cy="${portY(i, def.ins)}" r="6"
                   data-port-in="${n.id}" data-port-index="${i}"/>`).join('');

        return `<g class="lgl-node${sel}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
          ${ports}
          <rect class="lgl-box lgl-gate" width="${W}" height="${H}" rx="8"/>
          <text class="lgl-label" x="${W / 2}" y="${H / 2 + 5}">${def.label}</text>
          <circle class="lgl-port lgl-out" cx="${W}" cy="${H / 2}" r="6" data-port-out="${n.id}"/>
          <text class="lgl-bit" x="${W + 14}" y="${H / 2 - 8}">${v === null || v === undefined ? '' : v}</text>
        </g>`;
      }).join('');

      // Problems worth naming, rather than a silently blank truth table.
      const hint = $('lg-hint');
      if (cycle) hint.textContent = 'This circuit feeds back on itself. Combinational logic cannot contain a loop — remove the wire that closes it.';
      else if (missing.length) hint.textContent = `Unconnected: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`;
      else hint.textContent = state.pending
        ? 'Now click an input dot to finish the wire, or click empty space to cancel.'
        : 'Drag gates to move them. Click an output dot then an input dot to wire. Click an input pill to toggle it.';

      renderResults();
    }

    function renderResults() {
      const outs = outputsOf(state.circuit);
      const ins = inputsOf(state.circuit);

      $('lg-expressions').innerHTML = outs.length
        ? outs.map((o, i) => `
            <div class="lgl-expr-row">
              <span class="lgl-expr-name">${escapeHtml(o.label || 'OUT')}</span>
              <code>${escapeHtml(expressionFor(state.circuit, o.id))}</code>
            </div>
            <div class="lgl-expr-row lgl-sop">
              <span class="lgl-expr-name">sum of products</span>
              <code>${escapeHtml(sumOfProducts(state.circuit, i) ?? '—')}</code>
            </div>`).join('')
        : '<p class="cp-empty">Add an output to see its expression.</p>';

      const t = truthTable(state.circuit);
      if (t.tooMany) {
        $('lg-table').innerHTML = `<p class="cp-empty">${ins.length} inputs would make ${2 ** ins.length} rows. Ten inputs is the limit.</p>`;
        return;
      }
      if (!t.rows.length) {
        $('lg-table').innerHTML = '<p class="cp-empty">Add at least one input and one output.</p>';
        return;
      }

      const current = t.ins.map(n => state.inputs[n.id] ?? 0).join('');
      $('lg-table').innerHTML = `
        <div class="biz-table-wrap lgl-table-wrap">
          <table class="biz-table">
            <thead><tr>
              ${t.ins.map(n => `<th>${escapeHtml(n.label || 'IN')}</th>`).join('')}
              ${t.outs.map(n => `<th class="lgl-out-col">${escapeHtml(n.label || 'OUT')}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${t.rows.map(r => `
                <tr class="${r.inputs.join('') === current ? 'is-emphasis' : ''}">
                  ${r.inputs.map(v => `<td>${v}</td>`).join('')}
                  ${r.outputs.map(v => `<td class="lgl-out-col">${v === null ? '?' : v}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    /* ---------------- interaction ---------------- */

    const svgPoint = (e) => {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      return {
        x: (e.clientX - r.left) / r.width * vb.width,
        y: (e.clientY - r.top) / r.height * vb.height,
      };
    };

    let drag = null;

    svg.addEventListener('pointerdown', (e) => {
      const outPort = e.target.closest('[data-port-out]');
      const inPort = e.target.closest('[data-port-in]');
      const nodeEl = e.target.closest('[data-node]');

      if (outPort) {
        state.pending = { from: outPort.dataset.portOut };
        render();
        e.preventDefault();
        return;
      }

      if (inPort && state.pending) {
        const to = inPort.dataset.portIn;
        const toPort = Number(inPort.dataset.portIndex);
        // One wire per input: connecting a second replaces the first,
        // which is what the hardware would do anyway.
        state.circuit.wires = state.circuit.wires.filter(w => !(w.to === to && w.toPort === toPort));
        if (state.pending.from !== to) {
          state.circuit.wires.push({ id: newId(), from: state.pending.from, to, toPort });
        }
        state.pending = null;
        ghost.hidden = true;
        render();
        analytics?.started();
        e.preventDefault();
        return;
      }

      if (nodeEl) {
        const node = nodeById(nodeEl.dataset.node);
        state.selected = node.id;
        $('lg-delete').disabled = false;
        const p = svgPoint(e);
        drag = { id: node.id, dx: p.x - node.x, dy: p.y - node.y, moved: false };
        svg.setPointerCapture?.(e.pointerId);
        render();
        e.preventDefault();
        return;
      }

      // empty space
      state.pending = null;
      state.selected = null;
      $('lg-delete').disabled = true;
      ghost.hidden = true;
      render();
    });

    svg.addEventListener('pointermove', (e) => {
      if (drag) {
        const p = svgPoint(e);
        const node = nodeById(drag.id);
        node.x = Math.max(0, Math.min(p.x - drag.dx, 820 - W));
        node.y = Math.max(10, Math.min(p.y - drag.dy, 400 - H));
        drag.moved = true;
        render();
        return;
      }
      if (state.pending) {
        const from = nodeById(state.pending.from);
        if (!from) return;
        const p1 = outPos(from), p2 = svgPoint(e);
        const dx = Math.max(36, Math.abs(p2.x - p1.x) * 0.45);
        ghost.setAttribute('d', `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`);
        ghost.hidden = false;
      }
    });

    svg.addEventListener('pointerup', (e) => {
      // A click that did not move an input node toggles it.
      if (drag && !drag.moved) {
        const node = nodeById(drag.id);
        if (node?.type === 'input') {
          state.inputs[node.id] = state.inputs[node.id] === 1 ? 0 : 1;
          render();
        }
      }
      drag = null;
    });

    // Clicking a wire removes it — the quickest way to undo a mis-wire.
    svg.addEventListener('dblclick', (e) => {
      const wire = e.target.closest('[data-wire]');
      if (!wire) return;
      state.circuit.wires = state.circuit.wires.filter(w => w.id !== wire.dataset.wire);
      render();
    });

    /* ---------------- palette & controls ---------------- */

    $('lg-palette').addEventListener('click', (e) => {
      const type = e.target.dataset.add;
      if (!type) return;
      const count = state.circuit.nodes.filter(n => n.type === type).length;
      const label = type === 'input'
        ? String.fromCharCode(65 + state.circuit.nodes.filter(n => n.type === 'input').length)
        : type === 'output' ? `Y${count || ''}` : '';
      state.circuit.nodes.push({
        id: newId(), type, label,
        // Stagger new gates so they do not land on top of each other.
        x: 60 + (state.circuit.nodes.length % 5) * 130,
        y: 40 + (state.circuit.nodes.length % 4) * 82,
      });
      render();
      analytics?.started();
    });

    $('lg-delete').addEventListener('click', () => {
      if (!state.selected) return;
      const id = state.selected;
      state.circuit.nodes = state.circuit.nodes.filter(n => n.id !== id);
      state.circuit.wires = state.circuit.wires.filter(w => w.from !== id && w.to !== id);
      delete state.inputs[id];
      state.selected = null;
      $('lg-delete').disabled = true;
      render();
    });

    $('lg-clear').addEventListener('click', () => {
      state.circuit = { nodes: [], wires: [] };
      state.inputs = {};
      state.selected = null;
      $('lg-delete').disabled = true;
      $('lg-about').textContent = EXAMPLES.blank.about;
      render();
    });

    $('lg-example').addEventListener('change', (e) => {
      state.example = e.target.value;
      state.circuit = EXAMPLES[state.example].build();
      state.inputs = {};
      state.selected = null;
      state.pending = null;
      $('lg-delete').disabled = true;
      $('lg-about').textContent = EXAMPLES[state.example].about;
      render();
      analytics?.completed({ resultCount: state.circuit.nodes.length });
    });

    $('lg-about').textContent = EXAMPLES.halfAdder.about;
    render();
  },

  destroy() {},
};
