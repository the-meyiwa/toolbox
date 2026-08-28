/* ============================================================
   Combinational Logic Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GATES, evaluate, truthTable, expressionFor, sumOfProducts, EXAMPLES } from '../../js/lib/logic.js';

test('Logic: GATES primitives evaluate standard truth values', () => {
  // NOT
  assert.equal(GATES.not.op([0]), 1);
  assert.equal(GATES.not.op([1]), 0);

  // AND
  assert.equal(GATES.and.op([0, 0]), 0);
  assert.equal(GATES.and.op([1, 0]), 0);
  assert.equal(GATES.and.op([1, 1]), 1);

  // OR
  assert.equal(GATES.or.op([0, 0]), 0);
  assert.equal(GATES.or.op([0, 1]), 1);
  assert.equal(GATES.or.op([1, 1]), 1);

  // XOR
  assert.equal(GATES.xor.op([0, 0]), 0);
  assert.equal(GATES.xor.op([0, 1]), 1);
  assert.equal(GATES.xor.op([1, 1]), 0);

  // NAND
  assert.equal(GATES.nand.op([1, 1]), 0);
  assert.equal(GATES.nand.op([0, 1]), 1);
});

test('Logic: Half Adder circuit evaluation', () => {
  const circuit = EXAMPLES.halfAdder.build();
  const table = truthTable(circuit);

  assert.equal(table.ins.length, 2); // A, B
  assert.equal(table.outs.length, 2); // Sum, Carry
  assert.equal(table.rows.length, 4);

  // Outputs are sorted alphabetically by label: [Carry, Sum]
  // 0 + 0 = Carry: 0, Sum: 0
  assert.deepEqual(table.rows[0].inputs, [0, 0]);
  assert.deepEqual(table.rows[0].outputs, [0, 0]);

  // 0 + 1 = Carry: 0, Sum: 1
  assert.deepEqual(table.rows[1].inputs, [0, 1]);
  assert.deepEqual(table.rows[1].outputs, [0, 1]);

  // 1 + 0 = Carry: 0, Sum: 1
  assert.deepEqual(table.rows[2].inputs, [1, 0]);
  assert.deepEqual(table.rows[2].outputs, [0, 1]);

  // 1 + 1 = Carry: 1, Sum: 0
  assert.deepEqual(table.rows[3].inputs, [1, 1]);
  assert.deepEqual(table.rows[3].outputs, [1, 0]);
});

test('Logic: 2-to-1 Multiplexer circuit evaluation', () => {
  const mux = EXAMPLES.mux.build();
  const { values } = evaluate(mux, {
    // Select S=0 -> Output should be A
    [mux.nodes.find(n => n.label === 'A').id]: 1,
    [mux.nodes.find(n => n.label === 'B').id]: 0,
    [mux.nodes.find(n => n.label === 'S').id]: 0,
  });

  const outNode = mux.nodes.find(n => n.label === 'Y');
  assert.equal(values.get(outNode.id), 1);
});

test('Logic: expression generation and sum of products', () => {
  const halfAdder = EXAMPLES.halfAdder.build();
  const sumNode = halfAdder.nodes.find(n => n.label === 'Sum');
  const expr = expressionFor(halfAdder, sumNode.id);
  assert.ok(expr.includes('⊕') || expr.includes('A') || expr.includes('B'));

  const sop = sumOfProducts(halfAdder, 0);
  assert.ok(sop.length > 0);
});
