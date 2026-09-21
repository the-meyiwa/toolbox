// A deliberately simple renderer test asset, NOT a vehicle-specific model.
import { Document, NodeIO } from '@gltf-transform/core';
import { BoxGeometry, CylinderGeometry } from 'three';
import { mkdir } from 'node:fs/promises';

const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Technical renderer test assembly');
function add(id,name,geometry,position){
  const primitive=doc.createPrimitive();
  for(const [attr,semantic] of [['position','POSITION'],['normal','NORMAL']]){
    primitive.setAttribute(semantic,doc.createAccessor().setType('VEC3').setArray(geometry.attributes[attr].array).setBuffer(buffer));
  }
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
  const mesh=doc.createMesh(name).addPrimitive(primitive);
  scene.addChild(doc.createNode(id).setMesh(mesh).setTranslation(position).setExtras({component:{id,name,category:'Development fixture',description:'Simplified test geometry for line rendering and selection. Not a real vehicle component.'}}));
  geometry.dispose();
}
add('base','Test base',new BoxGeometry(4.6,.38,1.8),[0,.15,0]);
add('upper','Test enclosure',new BoxGeometry(2.4,.95,1.55),[0,.81,0]);
add('internal','Internal test block',new BoxGeometry(.65,.6,.6),[0,.72,0]);
for(const x of [-1.48,1.48])for(const z of [-1,1]){
  const wheel=new CylinderGeometry(.47,.47,.28,48);wheel.rotateX(Math.PI/2);
  add(`cylinder-${x}-${z}`,'Test cylinder',wheel,[x,0,z]);
}
await mkdir('public/automobile',{recursive:true});
await new NodeIO().write('public/automobile/development.glb',doc);
