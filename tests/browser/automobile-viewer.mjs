// Optional browser regression runner: requires Puppeteer and a running Vite server.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TOOLBOX_TEST_URL || 'http://127.0.0.1:3000';
const out='.workspaces/automobile-audit';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});
const errors=[];
const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGL|shader|THREE/.test(message.text()))errors.push(message.text());});
  await page.goto(base+'/tests/browser/automobile-viewer.html');
  await page.waitForFunction(()=>window.guide?.viewer?.asset);
  const pixels=()=>page.evaluate(()=>{
    const v=guide.viewer;v.pipeline.render(v.scene,v.camera,v.asset.registry,{mode:v.mode,selectedId:v.selectedId});
    const gl=v.pipeline.renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let sum=0,bright=0;for(let i=0;i<data.length;i+=4){sum+=data[i];if(data[i]>100)bright++;}return{sum,bright,error:gl.getError(),size:[gl.drawingBufferWidth,gl.drawingBufferHeight],camera:v.camera.position.toArray(),selected:v.selectedId};
  });
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await wait();const technical=await pixels();assert.ok(technical.bright>1000);assert.equal(technical.error,0);
  await page.screenshot({path:out+'/technical.png'});
  await page.click('[data-view="xray"]');const xray=await pixels();assert.ok(xray.sum>technical.sum,'X-Ray adds obscured outlines');
  await page.screenshot({path:out+'/xray.png'});
  await page.click('[data-component-id="internal"]');assert.equal(await page.$eval('[data-component-id="internal"]',el=>el.getAttribute('aria-pressed')),'true');
  await page.click('[data-view="isolate"]');const isolate=await pixels();assert.ok(isolate.bright<technical.bright);
  await page.screenshot({path:out+'/isolate.png'});
  await page.click('[data-clear-selection]');await page.click('[data-view="technical"]');
  const bounds=await page.$eval('canvas',el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
  const camera=()=>page.evaluate(()=>guide.viewer.camera.position.toArray());
  const initial=await camera();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.56,{steps:8});await page.mouse.up();assert.notDeepEqual(await camera(),initial);
  await page.click('#ag-zoom-in');assert.notDeepEqual(await camera(),initial);await page.click('#ag-zoom-reset');assert.ok((await camera()).every((value,index)=>Math.abs(value-initial[index])<1e-8));
  // Find a visible surface with the real raycaster, then use an actual pointer click.
  const point=await page.evaluate(()=>{const v=guide.viewer,r=v.canvas.getBoundingClientRect();for(let y=.25;y<.8;y+=.05)for(let x=.25;x<.8;x+=.05){const event={clientX:r.x+r.width*x,clientY:r.y+r.height*y};if(v.pick(event))return event;}});
  assert.ok(point);await page.mouse.click(point.clientX,point.clientY);assert.ok(await page.evaluate(()=>guide.viewer.selectedId));
  await page.click('[data-clear-selection]');await page.focus('canvas');await page.keyboard.press('ArrowLeft');assert.notDeepEqual(await camera(),initial);await page.keyboard.press('Home');assert.ok((await camera()).every((value,index)=>Math.abs(value-initial[index])<1e-8));
  const lifecycle=await page.evaluate(async()=>{
    const v=guide.viewer,descriptor=await(await fetch('/automobile/assets.json')).json(),mem=[];let disposed=0;
    for(let i=0;i<5;i++){
      for(const part of v.asset.registry.list())for(const mesh of part.meshes)mesh.geometry.addEventListener('dispose',()=>disposed++);
      await v.loadVehicle(descriptor.development);v.pipeline.render(v.scene,v.camera,v.asset.registry);mem.push({...v.pipeline.renderer.info.memory});
    }
    let failure='';try{await v.loadVehicle({modelUrl:'/automobile/not-a-model.glb'});}catch(e){failure=e.message;}
    const cleared=!v.asset;await v.loadVehicle(descriptor.development);
    // Complete an older request after a clear: it must be discarded and disposed.
    const load=v.loader.load.bind(v.loader);let resolve;v.loader.load=()=>new Promise(r=>resolve=r);
    const pending=v.loadVehicle(descriptor.development);v.clear();resolve(await load(descriptor.development));const stale=await pending;
    v.loader.load=load;await v.loadVehicle(descriptor.development);return{mem,disposed,failure,cleared,stale:stale===null};
  });
  assert.ok(lifecycle.disposed>=35);assert.ok(lifecycle.failure);assert.ok(lifecycle.cleared&&lifecycle.stale);assert.deepEqual(lifecycle.mem[0],lifecycle.mem[4]);
  const idle=await page.evaluate(async()=>{const v=guide.viewer;await new Promise(r=>setTimeout(r,100));const frame=v.pipeline.renderer.info.render.frame;await new Promise(r=>setTimeout(r,200));return frame===v.pipeline.renderer.info.render.frame;});assert.ok(idle,'idle viewer must not render continuously');
  await page.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});await page.reload();await page.waitForFunction(()=>guide.viewer?.asset);await wait();
  assert.ok(await page.evaluate(()=>guide.viewer.canvas.width*guide.viewer.canvas.height<=650000));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:out+'/mobile.png'});
  await page.click('[data-mob-tab="specs"]');await page.click('#ag-sheet-body [data-component-id="internal"]');
  await page.click('[data-mob-tab="inspector"]');assert.match(await page.$eval('#ag-sheet-body',el=>el.textContent),/Internal test block/);
  await page.screenshot({path:out+'/mobile-inspector.png'});await page.click('[data-mob-tab="diag"]');
  const client=await page.createCDPSession();const touchRect=await page.$eval('canvas',el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width*.5,y:r.y+r.height*.5};});
  const beforeTouch=await camera();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchRect,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchRect.x+50,y:touchRect.y+20,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notDeepEqual(await camera(),beforeTouch);
  const beforePinch=await page.evaluate(()=>guide.viewer.camera.position.distanceTo(guide.viewer.controls.target));
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchRect.x-25,y:touchRect.y,id:1},{x:touchRect.x+25,y:touchRect.y,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchRect.x-50,y:touchRect.y,id:1},{x:touchRect.x+70,y:touchRect.y+10,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await page.evaluate(()=>guide.viewer.camera.position.distanceTo(guide.viewer.controls.target)),beforePinch);
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});await wait();assert.ok(await page.evaluate(()=>guide.viewer.camera.aspect>1));
  await page.evaluate(()=>guide.destroy());assert.equal(await page.$('canvas'),null);
  // Theme changes and idle browser repaints must retain the technical drawing.
  await page.setViewport({width:1440,height:950,isMobile:false,hasTouch:false});
  await page.goto(base+'/#automobile-guide');
  await page.waitForFunction(()=>document.querySelector('#ag-asset-label')?.textContent.includes('DEVELOPMENT'));
  for(const theme of ['default','white-on-black','claude','ubuntu','cyberpunk','neon-tokyo','cyberpunk-amber']){
    await page.evaluate(async name=>(await import('/js/lib/theme.js')).applyTheme(name),theme);
    await new Promise(resolve=>setTimeout(resolve,500));
    const bright=await page.evaluate(()=>{
      const canvas=document.querySelector('#ag-viewer-host canvas'),gl=canvas.getContext('webgl2');
      const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
      let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>100)count++;return count;
    });
    assert.ok(bright>1000,'Technical lines survive '+theme+' repaint');
    await page.screenshot({path:out+'/theme-'+theme+'.png'});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,technical,xray,isolate,lifecycle,checks:'GLB, WebGL, 3 modes, selection/picking, mouse orbit, keyboard, zoom/reset, resize, touch orbit/pinch, mobile sheets, load failure, stale load, disposal, bounded memory, demand rendering, all 7 themes in full Toolbox route',screenshots:out},null,2));
}finally{await browser.close();}
