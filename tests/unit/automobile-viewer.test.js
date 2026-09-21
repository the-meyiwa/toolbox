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
