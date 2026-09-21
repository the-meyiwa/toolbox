import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ComponentRegistry } from '../../js/lib/automobile/component-registry.js';
import { VehicleLoader, disposeObject } from '../../js/lib/automobile/vehicle-loader.js';
import { VisualProvider } from '../../js/lib/automotive-provider.js';

function mesh(name) { const result=new Mesh(new BoxGeometry(),new MeshBasicMaterial());result.name=name;return result; }

test('semantic registry groups assembly meshes and accepts external and vehicle mappings',()=>{
  const root=new Group(),assembly=new Group();assembly.name='Assembly';assembly.userData.component={id:'assembly',name:'Assembly'};
  assembly.add(mesh('a'),mesh('b'));root.add(assembly,mesh('c'),mesh('d'),mesh('unknown'));
  const registry=new ComponentRegistry(root,{c:{id:'external',name:'Mapped part'}},[{id:'data',meshName:'d',name:'Database part',description:'Supplied facts'},{id:'assembly',description:'Assembly facts'}]);
  assert.equal(registry.get('assembly').meshes.length,2);
  assert.equal(registry.metadata('assembly').description,'Assembly facts');
  assert.equal(registry.metadata('external').name,'Mapped part');
  assert.equal(registry.metadata('data').description,'Supplied facts');
  const unknown=registry.list().find(p=>p.name==='unknown');assert.equal(unknown.category,'Unmapped geometry');assert.equal(unknown.description,undefined);
  assert.equal(new Set(registry.list().map(p=>p.numericId)).size,4);
  assert.doesNotThrow(()=>JSON.stringify(registry.metadata('assembly')));
  assert.equal(registry.metadata('missing'),null);disposeObject(root);
});

test('committed GLB loads through GLTFLoader with authored semantic metadata',async()=>{
  const bytes=await readFile(new URL('../../public/automobile/development.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const registry=new ComponentRegistry(gltf.scene);assert.equal(registry.list().length,7);
  assert.equal(registry.metadata('internal').category,'Development fixture');
  const loader=new VehicleLoader();loader.loader={loadAsync:async()=>gltf};
  const asset=await loader.load({modelUrl:'fixture',metadata:{accuracy:'development'}});
  assert.equal(asset.metadata.accuracy,'development');assert.ok(asset.root.scale.x>0);disposeObject(asset.root);
});

test('loader rejects missing or empty geometry with useful errors',async()=>{
  const loader=new VehicleLoader();await assert.rejects(loader.load({}),/No 3D asset/);
  loader.loader={loadAsync:async()=>({scene:new Group()})};
  await assert.rejects(loader.load({modelUrl:'empty'}),/no usable geometry/);
});

test('shared geometries, materials and textures are each disposed once',()=>{
  const root=new Group(),geometry=new BoxGeometry(),texture=new Texture(),material=new MeshBasicMaterial({map:texture});
  root.add(new Mesh(geometry,material),new Mesh(geometry,material));
  const counts={geometry:0,material:0,texture:0};
  for(const [key,obj] of Object.entries({geometry,material,texture}))obj.addEventListener('dispose',()=>counts[key]++);
  disposeObject(root);assert.deepEqual(counts,{geometry:1,material:1,texture:1});
});

test('asset resolver labels development fallbacks and keeps supplied metadata',async(t)=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  globalThis.fetch=async()=>({ok:true,json:async()=>({vehicles:{specific:{modelUrl:'exact.glb',metadata:{accuracy:'exact'},components:[{id:'hood',name:'Hood'}]}},representative:{sedan:{modelUrl:'sedan.glb'}},development:{modelUrl:'fixture.glb',metadata:{accuracy:'development'}}})});
  const exact=await VisualProvider.getVehicleAsset({id:'specific',components:[{id:'engine'}]});
  assert.equal(exact.metadata.accuracy,'exact');assert.equal(exact.components.length,2);
  assert.equal((await VisualProvider.getVehicleAsset({bodyStyle:'Sedan'})).metadata.accuracy,'representative');
  const fallback=await VisualProvider.getVehicleAsset({id:'unknown',components:[{id:'real-part'}]});
  assert.equal(fallback.metadata.accuracy,'development');assert.deepEqual(fallback.components,[]);
  globalThis.fetch=async()=>({ok:false});await assert.rejects(VisualProvider.getVehicleAsset(null),/catalog/);
});

test('loader enforces its triangle budget and disposes rejected resources',async()=>{
  const root=new Group(),part=mesh('oversized');root.add(part);let disposed=false;
  part.geometry.addEventListener('dispose',()=>disposed=true);
  const loader=new VehicleLoader({maxTriangles:1});loader.loader={loadAsync:async()=>({scene:root})};
  await assert.rejects(loader.load({modelUrl:'oversized'}),/geometry budget/);assert.ok(disposed);
});

test('external mapping JSON merges with explicit inline overrides',async(t)=>{
  const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  globalThis.fetch=async()=>({ok:true,json:async()=>({part:{id:'mapped',name:'External name'}})});
  const root=new Group();root.add(mesh('part'));
  const loader=new VehicleLoader();loader.loader={loadAsync:async()=>({scene:root})};
  const result=await loader.load({modelUrl:'fixture',componentMapUrl:'mapping.json',componentMap:{part:{id:'inline',name:'Inline name'}}});
  assert.equal(result.registry.metadata('inline').name,'Inline name');assert.equal(result.registry.get('mapped'),undefined);disposeObject(result.root);
});
