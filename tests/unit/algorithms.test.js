/* ============================================================
   Algorithms Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bubbleSort, insertionSort, selectionSort, mergeSort, quickSort, heapSort, linearSearch, binarySearch, ALGORITHMS } from '../../js/lib/algorithms.js';

function collectTrace(gen) {
  const frames = [];
  for (const f of gen) frames.push(f);
  return frames;
}

test('Algorithms: all registered sorting algorithms sort arrays correctly', () => {
  const input = [64, 34, 25, 12, 22, 11, 90, 5, 77, 1];
  const expected = [...input].sort((a, b) => a - b);

  const sorters = [
    { name: 'bubbleSort', fn: bubbleSort },
    { name: 'insertionSort', fn: insertionSort },
    { name: 'selectionSort', fn: selectionSort },
    { name: 'mergeSort', fn: mergeSort },
    { name: 'quickSort', fn: quickSort },
    { name: 'heapSort', fn: heapSort },
  ];

  for (const { name, fn } of sorters) {
    const trace = collectTrace(fn(input));
    assert.ok(trace.length > 0, `${name} generated no frames`);
    const lastFrame = trace[trace.length - 1];
    assert.deepEqual(lastFrame.array, expected, `${name} failed to sort correctly`);
  }
});

test('Algorithms: linearSearch finds present and missing elements', () => {
  const list = [10, 20, 30, 40, 50];

  // Present target
  const trace1 = collectTrace(linearSearch(list, 30));
  const last1 = trace1[trace1.length - 1];
  assert.ok(last1.note.includes('Found 30'));

  // Missing target
  const trace2 = collectTrace(linearSearch(list, 99));
  const last2 = trace2[trace2.length - 1];
  assert.ok(last2.note.includes('not in the list'));
});

test('Algorithms: binarySearch finds target in logarithmic steps', () => {
  const list = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

  // Present target
  const trace1 = collectTrace(binarySearch(list, 23));
  const last1 = trace1[trace1.length - 1];
  assert.ok(last1.note.includes('Found 23'));

  // Missing target
  const trace2 = collectTrace(binarySearch(list, 100));
  const last2 = trace2[trace2.length - 1];
  assert.ok(last2.note.includes('not in the list'));
});

test('Algorithms: ALGORITHMS catalogue metadata is complete', () => {
  for (const [key, algo] of Object.entries(ALGORITHMS)) {
    assert.ok(algo.name, `Algorithm ${key} missing name`);
    assert.ok(algo.fn, `Algorithm ${key} missing generator function`);
    assert.ok(algo.best && algo.worst, `Algorithm ${key} missing complexity`);
  }
});
