/* ============================================================
   Container & Modular Conversion Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveQuantities, buildQuote, totalsFor } from '../../js/lib/container-quote.js';
import { ELEMENTS, defaultRateBook } from '../../js/lib/container-catalog.js';

test('Container: shell options in catalog', () => {
  const shell = ELEMENTS.find(e => e.id === 'shell');
  assert.ok(shell);
  const buy20 = shell.options.find(o => o.id === 'buy-20');
  assert.ok(buy20);
  assert.equal(buy20.unit, 'each');
  assert.ok(buy20.rate > 0);
});

test('Container: deriveQuantities computes geometric parameters', () => {
  const mockState = {
    len: 6.0,
    wid: 2.4,
    hgt: 2.6,
    items: [
      { kind: 'opening', type: 'single-door', w: 0.9, h: 2.0 },
      { kind: 'opening', type: 'window-std', w: 1.0, h: 1.0 },
      { kind: 'fitting', type: 'partition' },
    ],
  };

  const q = deriveQuantities(mockState);
  assert.equal(q.floorArea, 6.0 * 2.4);
  assert.equal(q.perimeter, 2 * (6.0 + 2.4));
  assert.equal(q.openingCount, 2);
  assert.equal(q.openingArea, (0.9 * 2.0) + (1.0 * 1.0));
  assert.ok(q.exteriorArea < q.grossWallArea);
});

test('Container: buildQuote calculates bill of quantities', () => {
  const mockState = {
    len: 6.0,
    wid: 2.4,
    hgt: 2.6,
    items: [
      { kind: 'opening', type: 'single-door', w: 0.9, h: 2.0 },
    ],
    spec: {
      wall_lining: 'plasterboard',
      insulation: 'rockwool-50',
    },
    commercial: {
      overheadPct: 10,
      profitPct: 15,
      vatPct: 7.5,
    },
  };

  const rateBook = defaultRateBook();
  const quote = buildQuote(mockState, rateBook);

  assert.ok(quote.lines.length > 0);
  assert.ok(quote.totals.grandTotal > 0);
  assert.ok(quote.totals.material > 0);
});
