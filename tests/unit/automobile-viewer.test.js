import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { ComponentRegistry } from '../../js/lib/automobile/component-registry.js';
import { VehicleLoader, disposeObject } from '../../js/lib/automobile/vehicle-loader.js';
import { validateVehiclePackage, loadVehiclePackage } from '../../js/lib/automobile/vehicle-package.js';

function mesh(name) { const result=new Mesh(new BoxGeometry(),new MeshBasicMaterial());result.name=name;return result; }

test('semantic registry groups assembly meshes and accepts package mappings',()=>{
  const root=new Group(),assembly=new Group();assembly.name='Assembly';assembly.userData.component={id:'assembly',name:'Assembly'};
  assembly.add(mesh('a'),mesh('b'));root.add(assembly,mesh('c'),mesh('unknown'));
  const registry=new ComponentRegistry(root,{c:{id:'mapped',name:'Mapped part'}},[{id:'assembly',description:'Assembly facts'}]);
  assert.equal(registry.get('assembly').meshes.length,2);
  assert.equal(registry.metadata('assembly').description,'Assembly facts');
  assert.equal(registry.metadata('mapped').name,'Mapped part');
  assert.equal(registry.list().find(part=>part.name==='unknown').category,'Unmapped geometry');
  assert.doesNotThrow(()=>JSON.stringify(registry.metadata('assembly')));disposeObject(root);
});

test('all committed Toolbox Vehicle Package manifests pass the runtime contract',async()=>{
  for(const id of ['ford-mustang-gt-2005','tesla-model-3-2018','bmw-m4-competition']){
    const manifest=JSON.parse(await readFile(new URL(`../../public/automobile/packages/${id}/manifest.json`,import.meta.url),'utf8'));
    assert.equal(validateVehiclePackage(manifest),manifest);
    assert.ok(manifest.layers.some(layer=>layer.available));
    assert.ok(manifest.layers.some(layer=>layer.available===false));
    assert.ok(manifest.components.length>5);
    assert.ok(manifest.license.attribution);
  }
});

test('package resolver creates a generic local asset descriptor',async(t)=>{
  const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.window=originalWindow;});
  globalThis.window={location:{href:'https://toolbox.test/guide'}};
  const manifest=JSON.parse(await readFile(new URL('../../public/automobile/packages/ford-mustang-gt-2005/manifest.json',import.meta.url),'utf8'));
  globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
  const descriptor=await loadVehiclePackage('/automobile/packages/ford-mustang-gt-2005/manifest.json');
  assert.equal(descriptor.metadata.accuracy,'generation');
  assert.match(descriptor.modelUrl,/vehicle\.glb$/);
  assert.equal(descriptor.componentMap.tbx_body_shell_1.id,'body_shell');
  assert.deepEqual(descriptor.metadata.unavailableLayers,['mechanical']);
});

test('runtime contract rejects fabricated or incomplete package references',()=>{
  const base={schemaVersion:1,packageVersion:'1',vehicle:{id:'x',make:'X',model:'Y',displayName:'X Y',accuracy:'exact'},license:{spdx:'CC0-1.0',creator:'A',sourceUrl:'https://example.test',licenseUrl:'https://example.test/license'},layers:[{id:'exterior',available:true,glb:'vehicle.glb'}],components:[{id:'body',label:'Body'}],meshMappings:{mesh:'missing'}};
  assert.throws(()=>validateVehiclePackage(base),/unknown component/);
  assert.throws(()=>validateVehiclePackage({...base,vehicle:{...base.vehicle,accuracy:'guessed'}}),/invalid accuracy/);
});

test('loader rejects missing, empty, and over-budget geometry',async()=>{
  const loader=new VehicleLoader({maxTriangles:1});await assert.rejects(loader.load({}),/No 3D asset/);
  loader.loader={loadAsync:async()=>({scene:new Group()})};
  await assert.rejects(loader.load({modelUrl:'empty'}),/no usable geometry/);
  const root=new Group(),part=mesh('oversized');root.add(part);let disposed=false;
  part.geometry.addEventListener('dispose',()=>disposed=true);loader.loader={loadAsync:async()=>({scene:root})};
  await assert.rejects(loader.load({modelUrl:'oversized'}),/geometry budget/);assert.ok(disposed);
});

test('shared geometries, materials and textures are each disposed once',()=>{
  const root=new Group(),geometry=new BoxGeometry(),texture=new Texture(),material=new MeshBasicMaterial({map:texture});
  root.add(new Mesh(geometry,material),new Mesh(geometry,material));const counts={geometry:0,material:0,texture:0};
  for(const [key,obj] of Object.entries({geometry,material,texture}))obj.addEventListener('dispose',()=>counts[key]++);
  disposeObject(root);assert.deepEqual(counts,{geometry:1,material:1,texture:1});
});

/* ---------------------------------------------- Procedural Corolla packages -- */
import { execFileSync } from 'node:child_process';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ArticulationController } from '../../js/lib/automobile/articulation-controller.js';
import { validateArticulations } from '../../js/lib/automobile/vehicle-package.js';

const COROLLAS = [
  { id: 'toyota-corolla-2014-2016', length: 182.6, width: 69.9, height: 57.3, wheelbase: 106.3, trackF: 60.3 },
  { id: 'toyota-corolla-2013', length: 179.3, width: 69.3, height: 57.7, wheelbase: 102.4, trackF: 60.2 }
];
const IN = 0.0254;
const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
async function loadGlb(id) {
  const bytes = await readFile(new URL(`../../public/automobile/packages/${id}/vehicle.glb`, import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
}

test('procedural Corolla packages pass the runtime contract with complete reference data', async () => {
  for (const { id } of COROLLAS) {
    const manifest = await readJson(`../../public/automobile/packages/${id}/manifest.json`);
    assert.equal(validateVehiclePackage(manifest), manifest);
    assert.equal(manifest.vehicle.accuracy, 'representative', 'procedural geometry must not claim exactness');
    assert.ok(manifest.components.length > 200, `${id} should model body, cabin and mechanical parts`);
    assert.ok(manifest.articulations.length >= 50);
    const layers = new Set(manifest.layerGroups.map(layer => layer.id));
    for (const component of manifest.components) {
      assert.ok(component.description && component.location, `${component.id} needs a description and location`);
      assert.ok(layers.has(component.layer), `${component.id} must belong to a declared layer`);
      assert.ok(component.sources?.every(source => /^https:\/\//.test(source.url)), `${component.id} sources must be links`);
    }
    for (const needed of ['engine_block', 'transaxle', 'radiator', 'battery_12v', 'steering_wheel', 'instrument_cluster', 'seat_back_front_left', 'rear_torsion_beam', 'brake_disc_front_left', 'fuel_tank', 'spare_tyre']) {
      assert.ok(manifest.components.some(c => c.id === needed), `${id} is missing ${needed}`);
    }
    const specs = await readJson(`../../public/automobile/packages/${id}/specs.json`);
    assert.ok(specs.groups.length >= 5 && specs.sources.length >= 3);
  }
});

test('Corolla geometry follows the published exterior dimensions', async () => {
  for (const dims of COROLLAS) {
    const manifest = await readJson(`../../public/automobile/packages/${dims.id}/manifest.json`);
    const gltf = await loadGlb(dims.id);
    const layerOf = new Map(manifest.components.map(c => [c.id, c.layer]));
    const body = new Box3();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node => {
      if (node.isMesh && ['body', 'glass'].includes(layerOf.get(manifest.meshMappings[node.name]))) body.expandByObject(node);
    });
    const size = body.getSize(new Vector3());
    assert.ok(Math.abs(size.x - dims.length * IN) < 0.03, `${dims.id} length ${size.x}`);
    assert.ok(Math.abs(size.z - dims.width * IN) < 0.03, `${dims.id} width ${size.z}`);
    assert.ok(Math.abs(body.max.y - dims.height * IN) < 0.015, `${dims.id} height ${body.max.y}`);
    const pivot = name => gltf.scene.getObjectByName(name).getWorldPosition(new Vector3());
    assert.ok(Math.abs(pivot('tbx_pivot_wheel_front_left').x - pivot('tbx_pivot_wheel_rear_left').x - dims.wheelbase * IN) < 0.002, 'wheelbase');
    assert.ok(Math.abs(pivot('tbx_pivot_wheel_front_right').z - pivot('tbx_pivot_wheel_front_left').z - dims.trackF * IN) < 0.002, 'front track');
  }
});

test('every Corolla mesh is mapped and every articulation resolves to a pivot', async () => {
  for (const { id } of COROLLAS) {
    const manifest = await readJson(`../../public/automobile/packages/${id}/manifest.json`);
    const gltf = await loadGlb(id);
    let meshes = 0, triangles = 0;
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      meshes++; triangles += node.geometry.index.count / 3;
      assert.ok(manifest.meshMappings[node.name], `unmapped mesh ${node.name}`);
    });
    assert.equal(triangles, manifest.layers[0].triangles);
    assert.ok(meshes > 200 && triangles < 250000, 'must fit the mobile geometry budget');
    const controller = new ArticulationController(gltf.scene, manifest.articulations);
    assert.deepEqual(controller.missing, []);
    assert.equal(controller.size, manifest.articulations.length);
  }
});

test('articulations open, close, respect requirements and cascade', async () => {
  const manifest = await readJson('../../public/automobile/packages/toyota-corolla-2014-2016/manifest.json');
  const gltf = await loadGlb('toyota-corolla-2014-2016');
  const c = new ArticulationController(gltf.scene, manifest.articulations, { reducedMotion: true });
  const door = gltf.scene.getObjectByName('tbx_pivot_door_front_left');
  const rest = door.quaternion.clone();
  assert.ok(c.set('door_front_left', true));
  assert.ok(door.quaternion.angleTo(rest) > 1, 'door swings open');
  assert.ok(c.set('door_front_left', false));
  assert.ok(door.quaternion.angleTo(rest) < 1e-6, 'door closes exactly');
  // Service items need the bonnet; closing the bonnet refits them.
  assert.equal(c.availability('oil_dipstick').enabled, false);
  assert.match(c.availability('oil_dipstick').reason, /bonnet/i);
  c.set('hood', true); c.set('oil_dipstick', true); c.set('ignition_coils', true); c.set('spark_plugs', true);
  assert.ok(c.isActive('spark_plugs'));
  assert.equal(c.availability('ignition_coils').enabled, false, 'coils cannot go back over removed plugs');
  c.set('hood', false);
  for (const id of ['oil_dipstick', 'ignition_coils', 'spark_plugs']) assert.equal(c.isActive(id), false, `${id} refitted`);
  // Wheels: tyre and caliper need the wheel off; the wheel cannot go back without the caliper.
  assert.equal(c.set('tyre_front_right', true), false);
  c.set('wheel_front_right', true); c.set('caliper_front_right', true);
  assert.equal(c.availability('wheel_front_right').enabled, false);
  c.set('caliper_front_right', false); c.set('tyre_front_right', true);
  assert.ok(c.set('wheel_front_right', false));
  assert.equal(c.isActive('tyre_front_right'), false, 'refitting the wheel remounts the tyre');
  // Steering lock is exclusive and composes with wheel removal on the same pivot.
  c.set('steer_left', true); c.set('steer_right', true);
  assert.equal(c.isActive('steer_left'), false);
  c.set('wheel_front_left', true);
  const wheel = gltf.scene.getObjectByName('tbx_pivot_wheel_front_left');
  assert.ok(wheel.position.z < -0.9, 'removed wheel moves outboard');
  c.resetAll();
  assert.equal(c.list().filter(def => c.isActive(def.id)).length, 0);
  assert.ok(wheel.quaternion.angleTo(new wheel.quaternion.constructor()) < 1e-6);
});

test('articulation validation rejects malformed or dangling definitions', () => {
  const ids = new Set(['door']);
  assert.throws(() => validateArticulations([{ id: 'a', label: 'A', transforms: [] }], ids), /no transforms/);
  assert.throws(() => validateArticulations([{ id: 'a', label: 'A', transforms: [{ node: 'n', rotate: { axis: [0, 1], degrees: 3 } }] }], ids), /invalid rotation/);
  assert.throws(() => validateArticulations([{ id: 'a', label: 'A', components: ['wing'], transforms: [{ node: 'n', translate: [0, 1, 0] }] }], ids), /unknown component/);
  assert.throws(() => validateArticulations([{ id: 'a', label: 'A', requires: [{ id: 'b', state: true }], transforms: [{ node: 'n', translate: [0, 1, 0] }] }], ids), /unknown articulation/);
  assert.doesNotThrow(() => validateArticulations(undefined, ids));
});

test('procedural generator is deterministic and committed packages are current', () => {
  const output = execFileSync(process.execPath, [new URL('../../scripts/build-procedural-vehicle.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  assert.match(output, /up to date/);
});
