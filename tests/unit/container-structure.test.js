/* ============================================================
   Container structure: ISO data, structural checks, 3D model size
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ISO, RATINGS, FLOOR_DEPTH, ROOF_DEPTH, externalDims, checkStructure, sizeBeam } from '../../js/lib/container-structure.js';
import { SIZES, designContainer } from '../../js/lib/container-design.js';

test('Container structure: ISO 668 external sizes agree with the internal sizes', () => {
  for (const [id, iso] of Object.entries(ISO)) {
    const inner = SIZES[id];
    assert.ok(inner, id);
    // ends ~80 mm each, sides ~43 mm each, floor + roof = 198 mm
    assert.ok(Math.abs(iso.ext.len - inner.len - 0.16) < 0.01, `${id} length`);
    assert.ok(Math.abs(iso.ext.wid - inner.wid - 0.086) < 0.005, `${id} width`);
    assert.ok(Math.abs(iso.ext.hgt - inner.hgt - (FLOOR_DEPTH + ROOF_DEPTH)) < 0.002, `${id} height`);
  }
  assert.equal(ISO['20ft'].ext.len, 6.058);
  assert.equal(ISO['40hc'].ext.hgt, 2.896);
  assert.equal(RATINGS.stackingKg, 192000);
  assert.deepEqual(externalDims({ size: '20ft', len: 5.898, wid: 2.352, hgt: 2.393 }), ISO['20ft'].ext);
});

test('Container structure: beams are sized from the table and get heavier with span', () => {
  const a = sizeBeam(1.5, 10), b = sizeBeam(4, 10);
  assert.match(a.section, /RHS/);
  assert.ok(a.utilisation <= 1 && b.utilisation <= 1);
  assert.ok(b.requiredZcm3 > a.requiredZcm3);
  assert.match(sizeBeam(30, 200).section, /engineer/);
});

test('Container structure: every design carries a structural check', () => {
  const d = designContainer({ brief: { use: 'office', headcount: 4, size: '20ft' } });
  assert.ok(d.structure);
  const m = d.structure.modules[0];
  assert.equal(m.iso.code, '22G1');
  assert.ok(m.racking.transverse.capacityKn > 0 && m.racking.longitudinal.demandKn > 0);
  assert.ok(m.footings && m.footings.padSideM >= 0.6);
  assert.match(d.summary, /Structure \(preliminary/);
});

test('Container structure: stacked units load the corner posts well under the ISO rating', () => {
  const d = designContainer({ brief: { use: 'office', containers: 2, levels: 2, arrangement: 'stacked' } });
  const bottom = d.structure.modules.find(m => m.stacking);
  assert.ok(bottom, 'the ground unit reports what is stacked on it');
  assert.equal(bottom.stacking.unitsAbove, 1);
  assert.ok(bottom.stacking.utilisation > 0 && bottom.stacking.utilisation < 0.1);
  assert.equal(bottom.stacking.aligned, true);
  // floor to floor is the true external height
  const upper = d.modules.find(m => m.level === 1);
  assert.ok(Math.abs(upper.elev - (2.393 + FLOOR_DEPTH + ROOF_DEPTH)) < 0.002);
});

test('Container structure: cutting away most of a long wall is flagged and wide cuts get lintels', () => {
  const unit = (openings) => ({ modules: [{ id: 'm1', name: 'Unit', size: '40ft', len: 12.032, wid: 2.352, hgt: 2.393, x: 0, z: 0, rot: 0, level: 0, items: openings.map(o => ({ kind: 'opening', sill: 0, h: 2.1, ...o })) }], roofs: [] });
  const cut = checkStructure(unit([{ type: 'glass-wall', wall: 'left', along: 6, w: 8 }]));
  assert.ok(cut.warnings.some(w => /cut away/.test(w.text)));
  assert.ok(cut.modules[0].lintels.length >= 1);
  assert.ok(cut.modules[0].racking.longitudinal.capacityKn < RATINGS.longitudinalRackingKn);
  const small = checkStructure(unit([{ type: 'window', wall: 'left', along: 6, w: 1.2, sill: 0.95, h: 1 }]));
  assert.equal(small.modules[0].lintels.length, 0);
  assert.ok(!small.warnings.some(w => /cut away/.test(w.text)));
});

test('Container structure: auto-placed side openings keep 300 mm clear of the corner posts', () => {
  for (const brief of [{ use: 'office', headcount: 6, size: '40ft' }, { use: 'cafe', size: '20ft', style: ['glass front'] }, { use: 'home', size: '40hc' }]) {
    const d = designContainer({ brief });
    for (const m of d.modules) {
      for (const o of m.items.filter(i => i.kind === 'opening' && (i.wall === 'left' || i.wall === 'right'))) {
        assert.ok(o.along - o.w / 2 >= 0.29 && m.len - (o.along + o.w / 2) >= 0.29, `${brief.use}: ${o.type} at ${o.along}`);
      }
    }
  }
});

test('Container structure: the 3D model has the ISO external size and cuts openings cleanly', async () => {
  const THREE = await import('three');
  const { buildUnit, corrugatedGeometry } = await import('../../js/lib/container-mesh.js');
  const { group, ext } = buildUnit({ size: '20ft', len: 5.898, wid: 2.352, hgt: 2.393, color: 0x3f6b52, openings: [] });   // window sills may stand proud; the bare shell must not
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - ext.len) < 0.02, `length ${size.x}`);
  assert.ok(Math.abs(size.y - ext.hgt) < 0.02, `height ${size.y}`);
  assert.ok(Math.abs(size.z - ext.wid) < 0.02, `width ${size.z}`);
  // A hole in a corrugated sheet leaves no triangle inside it.
  const g = corrugatedGeometry({ O: new THREE.Vector3(), U: new THREE.Vector3(1, 0, 0), Vd: new THREE.Vector3(0, 1, 0), N: new THREE.Vector3(0, 0, 1), uLen: 3, vLen: 2, profile: { pitch: 0.278, depth: 0.036, outer: 0.072, inner: 0.068 }, holes: [{ u0: 1, u1: 2, v0: 0.5, v1: 1.5 }] });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    assert.ok(!(cx > 1.001 && cx < 1.999 && cy > 0.501 && cy < 1.499), `triangle inside the hole at ${cx}, ${cy}`);
  }
});
