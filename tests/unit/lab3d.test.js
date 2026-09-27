/* ============================================================
   3D Lab: shapes, procedural models, the prompt resolver, the scene
   format, exporters and the Assistant's create_3d_object tool.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const shapes = await import('../../js/lib/lab3d/shapes.js');
const catalog = await import('../../js/lib/lab3d/catalog.js');
const scene = await import('../../js/lib/lab3d/scene.js');
const index = await import('../../js/lib/lab3d/library-index.js');
const tools = await import('../../js/lib/lab3d/assistant-tools.js');

const finite = (geo) => [...geo.attributes.position.array].every(Number.isFinite);

test('every shape builds finite geometry resting on the floor', () => {
  assert.ok(shapes.SHAPES.length >= 40);
  for (const s of shapes.SHAPES) {
    const g = shapes.buildShapeGeometry(s.id, {});
    assert.ok(g.attributes.position.count > 0, s.id);
    assert.ok(finite(g), `${s.id} has non-finite vertices`);
    assert.ok(Math.abs(g.boundingBox.min.y) < 1e-6, `${s.id} should sit on y = 0`);
  }
  for (const lvl of ['basic', 'intermediate', 'advanced']) assert.ok(shapes.SHAPES.filter(s => s.level === lvl).length >= 10, lvl);
});

test('shape parameters are clamped to their ranges', () => {
  assert.deepEqual(shapes.clampParams('menger-sponge', { level: 9, size: 'x' }), { level: 3 });
  assert.equal(shapes.clampParams('gear', { teeth: 2 }).teeth, 6);
});

test('every model builds at a plausible real size', () => {
  const expect = {
    'iphone-17-pro': [[0.07, 0.076], [0.149, 0.152]],
    'office-chair': [[0.6, 0.8], [1.1, 1.4]],
    'ak-47': [[0.85, 0.97], [0.25, 0.35]],
    mp5: [[0.62, 0.74], [0.24, 0.33]],
  };
  for (const m of catalog.MODELS) {
    const g = m.build(catalog.modelDefaults(m.id));
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    let meshes = 0;
    g.traverse(o => { if (o.isMesh) { meshes++; assert.ok(finite(o.geometry), `${m.id}/${o.name}`); } });
    assert.ok(meshes > 0, m.id);
    assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${m.id} has a size`);
    const e = expect[m.id];
    if (e) {
      // phones are measured along x (width) and y (height); long props along x and y too
      assert.ok(size.x >= e[0][0] && size.x <= e[0][1], `${m.id} width ${size.x}`);
      assert.ok(size.y >= e[1][0] && size.y <= e[1][1], `${m.id} height ${size.y}`);
    }
  }
});

test('the prompt resolver finds models, variants and options', () => {
  const r = (q) => catalog.resolveObject(q);
  assert.equal(r('generate a 3d model of an office chair').id, 'office-chair');
  assert.equal(r('ofice chair').id, 'office-chair');
  assert.equal(r('iPhone 17 Pro').id, 'iphone-17-pro');
  assert.equal(r('iphone 17 pro max in deep blue').id, 'iphone-17-pro-max');
  assert.equal(r('iphone 17 pro max in deep blue').params.color, '#2e3c5c');
  assert.equal(r('ak47').id, 'ak-47');
  assert.equal(r('AK-47 with bakelite magazine').params.magazine, 'bakelite');
  assert.equal(r('kalashnikov').id, 'ak-47');
  assert.equal(r('mp5 with collapsing stock').params.stock, 'collapsing');
  assert.equal(r('office chair without headrest').params.headrest, false);
  assert.equal(r('32 inch monitor').params.size, 32);
  assert.deepEqual([r('menger sponge level 3').kind, r('menger sponge level 3').params.level], ['shape', 3]);
  assert.equal(r('klein bottle').id, 'klein-bottle');
  assert.equal(r('hello world'), null);
  assert.equal(r('air fryer'), null);
});

test('the Assistant library index matches the catalogue', () => {
  const cats = catalog.describeLibrary();
  assert.deepEqual(index.MODEL_INDEX, cats);
  assert.deepEqual(index.SHAPE_INDEX, shapes.SHAPES.map(s => [s.id, Object.keys(s.params)]));
});

test('scene items are validated and normalised', () => {
  const spec = scene.normalizeSpec({ items: [
    { prompt: 'office chair' },
    { type: 'torus-knot', material: 'chrome', at: [1, 0, 0] },
    { model: 'nope' },
    { shape: 'cube', color: 'red', rotate: [0, 45, 0], scale: 2 },
    { type: 'online', url: 'http://insecure.example/model.glb' },
    { type: 'custom', vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] },
  ] });
  assert.equal(spec.items.length, 4);
  assert.equal(spec.items[0].model, 'office-chair');
  assert.equal(spec.items[1].shape, 'torus-knot');
  assert.equal(spec.items[2].color, '#c1272d');
  assert.equal(spec.warnings.length, 2);
});

test('scenes build, lay out side by side and serialise back', async () => {
  const { objects, root } = await scene.buildScene({ items: [{ model: 'iphone-17-pro' }, { model: 'mug' }, { shape: 'sphere', at: [5, 0, 0] }] });
  assert.equal(objects.length, 3);
  assert.ok(objects[0].position.x < objects[1].position.x, 'free items are laid out in a row');
  assert.equal(objects[2].position.x, 5);
  const box = new THREE.Box3().setFromObject(root);
  assert.ok(box.min.y > -1e-3, 'everything rests on the floor');
  const back = scene.serialize(objects);
  assert.equal(back.items.length, 3);
  assert.deepEqual(back.items[2].at, [5, 0, 0]);
  const again = scene.normalizeSpec(back);
  assert.equal(again.warnings.length, 0);
  // the phone's own size ignores the way it is turned for display
  const s = scene.sizeOf(objects[0]);
  assert.ok(Math.abs(s.x - 0.0735) < 0.004 && Math.abs(s.y - 0.1503) < 0.002, `${s.x} × ${s.y}`);
});

test('exporters: OBJ (zipped with MTL) and STL in millimetres', async () => {
  const ex = await import('../../js/lib/lab3d/export.js');
  const { root } = await scene.buildScene({ items: [{ shape: 'cube', params: { width: 0.1, height: 0.1, depth: 0.1 } }] });
  const stl = await ex.exportObject(root, 'stl', { name: 'Cube test' });
  assert.equal(stl.filename, 'cube-test.stl');
  const buf = new DataView(await stl.blob.arrayBuffer());
  assert.equal(buf.getUint32(80, true), 12, 'a cube is 12 triangles');
  const xs = [];
  for (let t = 0; t < 12; t++) for (let v = 0; v < 3; v++) xs.push(buf.getFloat32(84 + t * 50 + 12 + v * 12, true));
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 100) < 1e-3, 'STL is written in millimetres');
  const obj = await ex.exportObject(root, 'obj', { name: 'cube' });
  assert.equal(obj.filename, 'cube-obj.zip');
  assert.ok(obj.blob.size > 200);
});

test('Assistant: create_3d_object builds from words, reports sizes and asks for help when unknown', async () => {
  const ok = await tools.create3dObject({ request: 'an iPhone 17 Pro in cosmic orange and an office chair' });
  assert.equal(ok.status, 'success');
  assert.equal(ok.renderer, 'lab3d-object');
  assert.deepEqual(ok.objects.map(o => o.id), ['iphone-17-pro', 'office-chair']);
  assert.equal(ok.spec.items[0].params.color, '#d9722e');
  assert.ok(ok.objects[1].size_m.height > 1);

  const guns = await tools.create3dObject({ request: 'AK-47 and an MP5' });
  assert.deepEqual(guns.objects.map(o => o.id), ['ak-47', 'mp5']);

  const composed = await tools.create3dObject({ title: 'Lamp', items: [{ shape: 'cylinder', params: { radius: 0.05, height: 0.3 } }, { shape: 'sphere', at: [0, 0.3, 0], material: 'glass' }] });
  assert.equal(composed.status, 'success');
  assert.equal(composed.title, 'Lamp');

  const missing = await tools.create3dObject({ request: 'a spaceship' });
  assert.equal(missing.status, 'not_found');
  assert.match(missing.message, /compos|shapes/i);
});

test('Assistant: the 3D tools are declared and grouped', async () => {
  const { EXTRA_TOOL_NAMES } = await import('../../js/lib/assistant/extra-tools.js');
  assert.ok(EXTRA_TOOL_NAMES.has('create_3d_object'));
  assert.ok(EXTRA_TOOL_NAMES.has('search_3d_models'));
  const { TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');
  assert.ok(TOOL_GROUPS.modelling.tools.includes('create_3d_object'));
  assert.match('generate a 3d model of an ak47', TOOL_GROUPS.modelling.match);
});
