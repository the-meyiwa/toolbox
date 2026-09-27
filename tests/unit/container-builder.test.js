/* ============================================================
   Container Builder: parts library, presets, multi-unit quote
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, PART, PRESETS, CATEGORIES, UNIT_TYPE, EXT, unitRect, layoutUnits, adjoiningPairs, partNotes, extOf } from '../../js/lib/container-library.js';
import { buildQuote } from '../../js/lib/container-quote.js';
import { defaultRateBook } from '../../js/lib/container-catalog.js';
import { designContainer, builderLayout } from '../../js/lib/container-design.js';

const spec = { shell: 'buy-20', prep: 'full', exterior: 'paint', insulation: 'pu25', framing: 'steel40', interior: 'ply9', ceiling: 'pvc', floor: 'vinyl', subfloor: 'marine18', paint: 'emulsion', roofing: 'coating', foundation: 'pads', glazing: 'lowe' };
const unitsOf = (p) => p.units.map((u, i) => ({ ...u, id: `u${i}`, len: UNIT_TYPE[u.preset].len, wid: UNIT_TYPE[u.preset].wid, hgt: UNIT_TYPE[u.preset].hgt }));

test('Container Builder: every part is well formed, priced and filed', () => {
  const book = defaultRateBook();
  const cats = new Set(CATEGORIES.map(c => c.id));
  assert.ok(PARTS.length >= 80);
  for (const p of PARTS) {
    assert.ok(cats.has(p.cat), `${p.id} category`);
    assert.ok(['opening', 'fitting', 'facade', 'roof', 'site'].includes(p.kind), p.id);
    assert.ok(p.w > 0 && (p.kind === 'opening' || p.kind === 'facade' ? p.h > 0 : p.d > 0), `${p.id} size`);
    assert.ok(book[`${p.kind}:${p.id}`], `${p.id} has a rate`);
  }
  // Modern parts the builder promised.
  for (const id of ['sliding-door', 'bifold', 'fold-down-deck', 'box-window', 'clerestory', 'wall-removal', 'mezzanine', 'spiral-in', 'slat-screen', 'green-roof', 'solar', 'roof-deck', 'ext-stair', 'pergola']) assert.ok(PART[id], id);
});

test('Container Builder: presets use real ISO sizes, known parts and openings that fit their walls', () => {
  assert.ok(PRESETS.length >= 12);
  for (const pr of PRESETS) {
    const units = unitsOf(pr);
    for (const u of units) {
      assert.ok(EXT[u.preset], `${pr.id}: ${u.preset} is an ISO size`);
      for (const it of u.items) {
        const p = PART[it.type];
        assert.ok(p && p.kind === it.kind, `${pr.id}: ${it.kind} ${it.type}`);
        if (it.kind === 'opening') {
          const span = it.wall === 'front' || it.wall === 'back' ? u.wid : u.len;
          const w = it.w ?? p.w;
          assert.ok(it.along - w / 2 >= -0.01 && it.along + w / 2 <= span + 0.01, `${pr.id}: ${it.type} on ${it.wall} at ${it.along}`);
          assert.ok((it.h ?? p.h) <= u.hgt, `${pr.id}: ${it.type} taller than the unit`);
        }
      }
    }
    for (const s of pr.site || []) assert.ok(PART[s.type], `${pr.id}: site ${s.type}`);
    // No two units on one level overlap.
    for (let i = 0; i < units.length; i++) for (let k = i + 1; k < units.length; k++) {
      if ((units[i].level || 0) !== (units[k].level || 0)) continue;
      const a = unitRect(units[i]), b = unitRect(units[k]);
      const ov = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
      assert.ok(ov < 0.05, `${pr.id}: units ${i} and ${k} overlap`);
    }
    // Every upper unit bears on something.
    const L = layoutUnits(units);
    for (const u of units) assert.ok(L.get(u.id).supported, `${pr.id}: ${u.id} unsupported`);
  }
});

test('Container Builder: stacking, cantilevers and joints are measured', () => {
  const byId = Object.fromEntries(PRESETS.map(p => [p.id, unitsOf(p)]));
  const stack = layoutUnits(byId.stack2);
  assert.ok(stack.get('u1').aligned);
  assert.ok(Math.abs(stack.get('u1').elev - EXT['40hc'].hgt) < 1e-6);
  assert.equal(layoutUnits(byId.cantilever).get('u1').overhang, 3);
  assert.ok(Math.abs(layoutUnits(byId.bridge).get('u2').overhang - (12.192 - 8 - 2.438)) < 0.01, 'bridge overhang is only what projects past the supports');
  assert.equal(adjoiningPairs(byId.double40).length, 1);
  assert.equal(adjoiningPairs(byId.ushape).length, 2);
});

test('Container Builder: a multi-unit build prices every unit, part and connection', () => {
  const pr = PRESETS.find(p => p.id === 'stack2');
  const units = unitsOf(pr);
  const q = buildQuote({ units, site: pr.site, spec, services: {}, logistics: {}, commercial: { profitPct: 20, vatPct: 7.5 } }, {});
  const ids = new Set(q.lines.map(l => l.id));
  assert.ok(ids.has('shell:buy-40hc'));
  assert.equal(q.lines.find(l => l.id === 'shell:buy-40hc').qty, 2);
  for (const id of ['works:stack', 'works:railing', 'roof:roof-deck', 'roof:solar', 'site:ext-stair', 'site:spiral', 'opening:sliding-door', 'glazing:lowe', 'roofing:coating', 'foundation:pads']) assert.ok(ids.has(id), id);
  assert.equal(q.quantities.supports, 6, 'only the ground unit sits on footings');
  assert.ok(Math.abs(q.quantities.roofArea - 12.032 * 2.352) < 0.01, 'the covered roof is not waterproofed');
  assert.equal(q.lines.find(l => l.id === 'logistics:offload').qty, 2, 'a stacked build needs a second crane lift');
  assert.ok(q.totals.grandTotal > 0);
  // Single-unit states (the Assistant's design engine) still price as before.
  const one = buildQuote({ len: 5.898, wid: 2.352, hgt: 2.393, items: [], spec: { shell: 'buy-20' } }, {});
  assert.equal(one.lines[0].id, 'shell:buy-20');
});

test('Container Builder: design checks call out lofts that are too low', () => {
  const hc = { hgt: 2.698, wid: 2.352 };
  assert.ok(partNotes({ type: 'mezzanine', deck: 2.15 }, hc).some(n => /mattress/.test(n)));
  assert.ok(partNotes({ type: 'mezzanine', deck: 1.4 }, hc).some(n => /Headroom under/.test(n)));
  assert.ok(partNotes({ kind: 'opening', type: 'bifold', wall: 'left', w: 3.6 }, hc).some(n => /portal frame/.test(n)));
  assert.deepEqual(extOf({ preset: '40hc' }), EXT['40hc']);
});

test('Container Builder: the Assistant hands over every unit of a design', () => {
  const d = designContainer({ brief: { use: 'home', containers: 2, levels: 2, arrangement: 'stacked' }, extras: { deck: true } });
  const h = builderLayout(d);
  assert.equal(h.units.length, d.modules.length);
  assert.ok(h.units.some(u => u.level === 1));
  assert.ok(h.site.some(s => s.type === 'ext-stair'));
  for (const u of h.units) for (const it of u.items) assert.ok(PART[it.type], it.type);
  const upper = h.units.find(u => u.level === 1), lower = h.units.find(u => u.level === 0);
  assert.ok(Math.abs(upper.cx - lower.cx) < 0.01 && Math.abs(upper.cz - lower.cz) < 0.01, 'stacked units share a centre');
});
