/* ============================================================
   Combinational logic.

   A circuit is nodes plus wires. Evaluation resolves each output by
   walking backwards through its inputs, memoising as it goes, and
   refusing to loop forever if the user has wired a feedback path —
   which is easy to do by accident and produces a hang rather than an
   error if you do not check for it.

   Kept separate from the UI so the truth table, the expression and the
   canvas all agree by construction: they are three views of one model.
   ============================================================ */

/** Gate definitions: how many inputs, and what they do. */
export const GATES = {
  input:  { label: 'Input',  ins: 0, outs: 1, kind: 'io' },
  output: { label: 'Output', ins: 1, outs: 0, kind: 'io' },
  not:    { label: 'NOT',  ins: 1, outs: 1, kind: 'gate', op: ([a]) => a ? 0 : 1, sym: '¬' },
  and:    { label: 'AND',  ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a && b) ? 1 : 0, sym: '·' },
  or:     { label: 'OR',   ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a || b) ? 1 : 0, sym: '+' },
  nand:   { label: 'NAND', ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a && b) ? 0 : 1, sym: '⊼' },
  nor:    { label: 'NOR',  ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a || b) ? 0 : 1, sym: '⊽' },
  xor:    { label: 'XOR',  ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a ^ b) ? 1 : 0, sym: '⊕' },
  xnor:   { label: 'XNOR', ins: 2, outs: 1, kind: 'gate', op: ([a, b]) => (a ^ b) ? 0 : 1, sym: '⊙' },
};

/**
 * Resolve every node's value for one set of input states.
 * @param {{nodes: Array, wires: Array}} circuit
 * @param {Record<string, 0|1>} inputValues node id → state
 * @returns {{values: Map<string, 0|1|null>, cycle: boolean, missing: string[]}}
 */
export function evaluate(circuit, inputValues) {
  const byId = new Map(circuit.nodes.map(n => [n.id, n]));
  // For each node input port, which node feeds it.
  const feed = new Map();
  for (const w of circuit.wires) feed.set(`${w.to}:${w.toPort}`, w.from);

  const values = new Map();
  const visiting = new Set();
  let cycle = false;
  const missing = [];

  function resolve(id) {
    if (values.has(id)) return values.get(id);
    if (visiting.has(id)) { cycle = true; return null; }

    const node = byId.get(id);
    if (!node) return null;

    if (node.type === 'input') {
      const v = inputValues[id] ?? 0;
      values.set(id, v);
      return v;
    }

    visiting.add(id);
    const def = GATES[node.type];
    const args = [];
    for (let port = 0; port < def.ins; port++) {
      const src = feed.get(`${id}:${port}`);
      if (!src) { missing.push(`${node.label || def.label} input ${port + 1}`); args.push(null); continue; }
      args.push(resolve(src));
    }
    visiting.delete(id);

    // An unconnected or unresolved input makes the whole gate undefined
    // rather than silently defaulting to 0, which would hide the mistake.
    const value = args.some(a => a === null) ? null : (def.op ? def.op(args) : args[0]);
    values.set(id, value);
    return value;
  }

  for (const n of circuit.nodes) resolve(n.id);
  return { values, cycle, missing: [...new Set(missing)] };
}

/** Input nodes in a stable order, so the truth table columns do not jump. */
export const inputsOf = (c) => c.nodes.filter(n => n.type === 'input')
  .sort((a, b) => (a.label || '').localeCompare(b.label || '') || a.id.localeCompare(b.id));

export const outputsOf = (c) => c.nodes.filter(n => n.type === 'output')
  .sort((a, b) => (a.label || '').localeCompare(b.label || '') || a.id.localeCompare(b.id));

/**
 * Every input combination and the resulting outputs.
 * Capped because 2^n rows stops being a truth table and starts being a
 * denial of service somewhere around n = 12.
 */
export function truthTable(circuit, maxInputs = 10) {
  const ins = inputsOf(circuit);
  const outs = outputsOf(circuit);
  if (!ins.length || !outs.length) return { ins, outs, rows: [], tooMany: false };
  if (ins.length > maxInputs) return { ins, outs, rows: [], tooMany: true };

  const rows = [];
  const total = 2 ** ins.length;
  for (let mask = 0; mask < total; mask++) {
    const assign = {};
    ins.forEach((n, i) => {
      // Most-significant bit is the leftmost column, which is how anyone
      // reading a truth table expects it to count.
      assign[n.id] = (mask >> (ins.length - 1 - i)) & 1;
    });
    const { values } = evaluate(circuit, assign);
    rows.push({
      inputs: ins.map(n => assign[n.id]),
      outputs: outs.map(n => values.get(n.id)),
    });
  }
  return { ins, outs, rows, tooMany: false };
}

/** Boolean expression for one output, built by walking its input tree. */
export function expressionFor(circuit, outputId) {
  const byId = new Map(circuit.nodes.map(n => [n.id, n]));
  const feed = new Map();
  for (const w of circuit.wires) feed.set(`${w.to}:${w.toPort}`, w.from);
  const seen = new Set();

  function build(id, depth = 0) {
    if (!id || depth > 40 || seen.has(id)) return '…';
    const node = byId.get(id);
    if (!node) return '?';
    if (node.type === 'input') return node.label || 'x';

    seen.add(id);
    const def = GATES[node.type];
    const parts = [];
    for (let port = 0; port < def.ins; port++) parts.push(build(feed.get(`${id}:${port}`), depth + 1));
    seen.delete(id);

    switch (node.type) {
      case 'output': return parts[0];
      case 'not':  return `¬${wrap(parts[0])}`;
      case 'and':  return `${wrap(parts[0])} · ${wrap(parts[1])}`;
      case 'or':   return `${wrap(parts[0])} + ${wrap(parts[1])}`;
      case 'xor':  return `${wrap(parts[0])} ⊕ ${wrap(parts[1])}`;
      case 'nand': return `¬(${parts[0]} · ${parts[1]})`;
      case 'nor':  return `¬(${parts[0]} + ${parts[1]})`;
      case 'xnor': return `¬(${parts[0]} ⊕ ${parts[1]})`;
      default: return '?';
    }
  }
  // Only bracket compound terms, so simple expressions stay readable.
  const wrap = (s) => /[·+⊕]/.test(s) ? `(${s})` : s;

  return build(feed.get(`${outputId}:0`));
}

/**
 * Sum-of-products from the truth table — the canonical form students are
 * asked for, and a useful sanity check against the wired expression.
 */
export function sumOfProducts(circuit, outputIndex = 0) {
  const { ins, rows, tooMany } = truthTable(circuit);
  if (tooMany || !rows.length) return null;

  const terms = rows
    .filter(r => r.outputs[outputIndex] === 1)
    .map(r => ins.map((n, i) => (r.inputs[i] ? '' : '¬') + (n.label || 'x')).join('·'));

  if (!terms.length) return '0 (always false)';
  if (terms.length === rows.length) return '1 (always true)';
  return terms.join('  +  ');
}

/* ---------------- ready-made circuits ---------------- */

let seq = 0;
const nid = () => `n${++seq}`;

/** Build a circuit from a compact description. */
function make(spec) {
  const ids = {};
  const nodes = spec.nodes.map(([key, type, x, y, label]) => {
    const id = nid();
    ids[key] = id;
    return { id, type, x, y, label };
  });
  const wires = spec.wires.map(([from, to, toPort]) => ({
    id: nid(), from: ids[from], to: ids[to], toPort,
  }));
  return { nodes, wires };
}

export const EXAMPLES = {
  halfAdder: {
    name: 'Half adder',
    about: 'Adds two bits. Sum is A XOR B; carry is A AND B. The building block every adder is made from.',
    build: () => make({
      nodes: [
        ['a', 'input', 60, 90, 'A'], ['b', 'input', 60, 190, 'B'],
        ['x', 'xor', 250, 100], ['n', 'and', 250, 210],
        ['s', 'output', 430, 110, 'Sum'], ['c', 'output', 430, 220, 'Carry'],
      ],
      wires: [['a', 'x', 0], ['b', 'x', 1], ['a', 'n', 0], ['b', 'n', 1], ['x', 's', 0], ['n', 'c', 0]],
    }),
  },
  mux: {
    name: '2-to-1 multiplexer',
    about: 'Picks input A or B depending on the select line. The core of any data path.',
    build: () => make({
      nodes: [
        ['a', 'input', 50, 60, 'A'], ['b', 'input', 50, 160, 'B'], ['s', 'input', 50, 260, 'S'],
        ['ns', 'not', 190, 265], ['g1', 'and', 320, 70], ['g2', 'and', 320, 190],
        ['o', 'or', 470, 130], ['y', 'output', 610, 140, 'Y'],
      ],
      wires: [
        ['s', 'ns', 0], ['a', 'g1', 0], ['ns', 'g1', 1],
        ['b', 'g2', 0], ['s', 'g2', 1], ['g1', 'o', 0], ['g2', 'o', 1], ['o', 'y', 0],
      ],
    }),
  },
  xorFromNand: {
    name: 'XOR from NAND gates',
    about: 'NAND is functionally complete — every other gate can be built from it, which is why chips are full of them.',
    build: () => make({
      nodes: [
        ['a', 'input', 50, 90, 'A'], ['b', 'input', 50, 210, 'B'],
        ['n1', 'nand', 200, 140], ['n2', 'nand', 350, 70], ['n3', 'nand', 350, 200],
        ['n4', 'nand', 500, 135], ['y', 'output', 650, 145, 'Y'],
      ],
      wires: [
        ['a', 'n1', 0], ['b', 'n1', 1],
        ['a', 'n2', 0], ['n1', 'n2', 1],
        ['n1', 'n3', 0], ['b', 'n3', 1],
        ['n2', 'n4', 0], ['n3', 'n4', 1], ['n4', 'y', 0],
      ],
    }),
  },
  majority: {
    name: 'Majority vote',
    about: 'Outputs 1 when at least two of three inputs are 1 — the pattern behind fault-tolerant voting circuits.',
    build: () => make({
      nodes: [
        ['a', 'input', 50, 60, 'A'], ['b', 'input', 50, 170, 'B'], ['c', 'input', 50, 280, 'C'],
        ['ab', 'and', 220, 70], ['bc', 'and', 220, 190], ['ac', 'and', 220, 310],
        ['o1', 'or', 390, 120], ['o2', 'or', 540, 210], ['y', 'output', 690, 220, 'Y'],
      ],
      wires: [
        ['a', 'ab', 0], ['b', 'ab', 1],
        ['b', 'bc', 0], ['c', 'bc', 1],
        ['a', 'ac', 0], ['c', 'ac', 1],
        ['ab', 'o1', 0], ['bc', 'o1', 1],
        ['o1', 'o2', 0], ['ac', 'o2', 1], ['o2', 'y', 0],
      ],
    }),
  },
  blank: { name: 'Empty canvas', about: 'Start from nothing. Add gates from the palette, then drag from an output dot to an input dot to wire them.', build: () => ({ nodes: [], wires: [] }) },
};

export const newId = nid;
