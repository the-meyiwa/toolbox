/* ============================================================
   Structure modeller: sections, generators, takeoff, limits
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSection, expandStructure, trussMembers, LIMITS } from '../../js/lib/structure-model.js';

const kgm = (s) => { const p = parseSection(s); return p.kgm ?? p.area * 7850; };

test('Structure model: section masses are close to the steel tables', () => {
  const near = (v, want, tol) => assert.ok(Math.abs(v - want) / want < tol, `${v} vs ${want}`);
  near(kgm('RHS 100x50x4'), 8.59, 0.08);
  near(kgm('SHS 60x3'), 5.19, 0.08);
  near(kgm('CHS 114.3x5'), 13.5, 0.05);
  assert.equal(kgm('UB 305x165x40'), 40);
  assert.equal(parseSection('UB 305x165x40').shape, 'I');
  assert.equal(parseSection('rod 20').shape, 'round');
  assert.deepEqual([parseSection('300x600').w, parseSection('300x600').h], [0.3, 0.6]);
});

test('Structure model: a Pratt truss has the right members', () => {
  const { members, top, bottom } = trussMembers({ kind: 'pratt', span: 12, height: 1.5, panels: 6 });
  const count = (r) => members.filter(m => m[2] === r).length;
  assert.equal(count('bottom chord'), 6);
  assert.equal(count('top chord'), 6);
  assert.equal(count('vertical'), 7);
  assert.equal(count('diagonal'), 6);
  assert.equal(top.length, 7);
  assert.equal(bottom.length, 7);
});

test('Structure model: generators build real structures with sensible sizes', () => {
  const dome = expandStructure({ objects: [{ type: 'dome', radius: 10, frequency: 3 }] });
  assert.ok(dome.members.length > 100);
  assert.ok(Math.abs(dome.bounds.size[1] - 10) < 0.6, `dome height ${dome.bounds.size[1]}`);
  assert.ok(Math.abs(dome.bounds.size[0] - 20) < 0.8);

  const frame = expandStructure({ objects: [{ type: 'frame', bays: [3, 2], bay: [6, 6], storeys: 4, storey_height: 3.5 }] });
  assert.equal(frame.members.filter(m => m.role === 'column').length, 4 * 4 * 3);
  assert.ok(Math.abs(frame.bounds.size[1] - 14) < 1.5);
  assert.ok(frame.stats.steelT > 5);

  const bridge = expandStructure({ objects: [{ type: 'bridge', kind: 'suspension', span: 200, width: 12 }] });
  assert.ok(bridge.members.some(m => m.role === 'main cable') && bridge.members.some(m => m.role === 'hanger'));
  assert.ok(bridge.bounds.size[0] >= 200 && bridge.bounds.size[0] < 215);

  for (const type of ['space_frame', 'tower', 'stair', 'arch', 'hypar', 'wall', 'roof', 'tree', 'person', 'column_grid']) {
    const r = expandStructure({ objects: [{ type }] });
    assert.ok(r.prims.length + r.members.length > 0, type);
    assert.equal(r.warnings.length, 0, `${type}: ${r.warnings}`);
  }
});

test('Structure model: arrays, transforms and takeoff', () => {
  const r = expandStructure({ objects: [{ type: 'array', count: 4, step: [5, 0, 0], item: { type: 'member', from: [0, 0, 0], to: [0, 3, 0], section: 'UC 203x203x46' }, at: [10, 0, 0] }] });
  assert.equal(r.members.length, 4);
  assert.deepEqual(r.members[3].a, [25, 0, 0]);
  assert.equal(r.stats.takeoff[0].count, 4);
  assert.ok(Math.abs(r.stats.takeoff[0].massKg - 4 * 3 * 46) < 1);
  const polar = expandStructure({ objects: [{ type: 'array', count: 6, around: { center: [0, 0, 0], angle: 360 }, item: { type: 'box', size: [1, 1, 1], at: [5, 0.5, 0] } }] });
  assert.equal(polar.prims.length, 6);
  assert.ok(Math.abs(polar.bounds.size[0] - 11) < 0.2);
});

test('Structure model: bad input is reported, not thrown, and huge models are capped', () => {
  const r = expandStructure({ objects: [{ type: 'teleporter' }, { type: 'extrude', points: [[0, 0]] }] });
  assert.ok(r.warnings.some(w => /teleporter/.test(w)));
  assert.ok(r.warnings.some(w => /three outline points/.test(w)));
  const huge = expandStructure({ objects: [{ type: 'array', count: 600, step: [0, 0, 1], item: { type: 'space_frame', size: [30, 30], grid: 1 } }] });
  assert.ok(huge.members.length <= LIMITS.members);
  assert.ok(huge.warnings.some(w => /capped/.test(w)));
});

test('Structure model: the model_3d tool reports size and steel, and rejects empty models', async () => {
  const { executeExtraTool } = await import('../../js/lib/assistant/extra-tools.js');
  const ok = await executeExtraTool('model_3d', { title: 'Shed', objects: [{ type: 'frame', bays: [2, 1], bay: 6, storeys: 1 }, { type: 'roof', kind: 'gable', size: [12, 6], at: [6, 3.5, 3] }] });
  assert.equal(ok.status, 'success');
  assert.equal(ok.renderer, 'structure-model');
  assert.ok(ok.size_m.width >= 12 && ok.stats.members > 0);
  const bad = await executeExtraTool('model_3d', { objects: [] });
  assert.equal(bad.status, 'error');
});
