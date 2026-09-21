// Browser regression runner: requires Puppeteer and a running Vite server.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TOOLBOX_TEST_URL||'http://127.0.0.1:3000';
const out='.workspaces/automobile-audit';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});
const errors=[];
try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:900});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|vehicle\.glb|manifest\.json/i.test(message.text()))errors.push(message.text());});
  await page.goto(base+'/tests/browser/automobile-viewer.html');
  await page.waitForFunction(()=>window.guide?.viewer?.asset);
  const capture=async(id)=>{
    await page.evaluate(async vehicleId=>{
      const {autoClient}=await import('/js/lib/automotive-data.js');
      const vehicle=(await autoClient.searchVehicles('')).find(item=>item.id===vehicleId);
      await guide.selectVehicle(vehicle);
      while(!guide.viewer?.asset?.metadata?.label?.includes(vehicle.model))await new Promise(resolve=>setTimeout(resolve,30));
    },id);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const pixels=await page.evaluate(()=>{
      const v=guide.viewer;v.pipeline.render(v.scene,v.camera,v.asset.registry,{mode:v.mode,selectedId:v.selectedId});
      const gl=v.pipeline.renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
      let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]>100)bright++;
      return{bright,error:gl.getError(),parts:v.asset.registry.list().length,triangles:v.asset.statistics.triangles,label:v.asset.metadata.label};
    });
    assert.ok(pixels.bright>1000,`${id} must draw visible geometry`);assert.equal(pixels.error,0);assert.ok(pixels.parts>5);
    await page.screenshot({path:`${out}/${id}.png`});return pixels;
  };
  const packages={};
  for(const id of ['toyota-corolla-2014-2016','toyota-corolla-2013'])packages[id]=await capture(id);
  // Desktop toggles: right-click a door, choose its action, and confirm the articulation ran.
  await page.evaluate(async()=>{const {autoClient}=await import('/js/lib/automotive-data.js');await guide.selectVehicle((await autoClient.searchVehicles('corolla 2015'))[0]);});
  await page.waitForFunction(()=>guide.viewer?.articulation?.size>50);
  const door=await page.evaluate(()=>{const v=guide.viewer,m=v.asset.registry.get('door_front_right_outer_panel').meshes[0];m.geometry.computeBoundingBox();const c=m.geometry.boundingBox.getCenter(new m.position.constructor());m.localToWorld(c);c.project(v.camera);const r=v.canvas.getBoundingClientRect();return{x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height};});
  await page.mouse.move(door.x,door.y);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  await page.waitForSelector('#toolbox-context-menu [role="menuitem"]');
  assert.match(await page.$eval('#toolbox-context-menu',el=>el.textContent),/Open door/);
  await page.click('#toolbox-context-menu [role="menuitem"]');
  await page.waitForFunction(()=>guide.viewer.articulation.isActive('door_front_right')&&!guide.viewer.articulation.isMoving());
  await page.evaluate(()=>{guide.viewer.articulate('hood',true);guide.viewer.articulate('wheel_front_left',true);});
  await page.waitForFunction(()=>!guide.viewer.articulation.isMoving());
  await page.screenshot({path:`${out}/corolla-toggles.png`});
  for(const id of ['ford-mustang-gt-2005','tesla-model-3-2018','bmw-m4-competition'])packages[id]=await capture(id);
  await page.type('#ag-component-search','wheel');
  assert.match(await page.$eval('#ag-nav-list',el=>el.textContent),/wheel/i);
  await page.click('#ag-nav-list [data-component-id]');await page.click('[data-view="isolate"]');
  assert.ok(await page.evaluate(()=>guide.viewer.selectedId));await page.screenshot({path:`${out}/isolate.png`});
  await page.click('[data-view="xray"]');await page.screenshot({path:`${out}/xray.png`});
  assert.match(await page.$eval('#ag-asset-attribution',el=>el.textContent),/CC BY 4\.0/);
  assert.match(await page.$eval('#ag-asset-attribution',el=>el.textContent),/Unavailable: mechanical/);
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await page.reload();
  await page.waitForFunction(()=>guide?.viewer?.asset);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.evaluate(()=>guide.viewer.canvas.width*guide.viewer.canvas.height<=650000));
  await page.screenshot({path:`${out}/mobile.png`});
  // Mobile toggles: tap a part, use the Toggle button in its info panel.
  const hood=await page.evaluate(()=>{const v=guide.viewer,m=v.asset.registry.get('hood').meshes[0];m.geometry.computeBoundingBox();const c=m.geometry.boundingBox.getCenter(new m.position.constructor());m.localToWorld(c);c.project(v.camera);const r=v.canvas.getBoundingClientRect();return{x:r.left+(c.x+1)/2*r.width,y:r.top+(1-c.y)/2*r.height};});
  await page.touchscreen.tap(hood.x,hood.y);
  await page.waitForSelector('#ag-selection-chip [data-open-toggle]:not([hidden])');
  await page.tap('#ag-selection-chip [data-open-toggle]');
  await page.waitForSelector('#ag-sheet-body [data-articulation="hood"]');
  await page.tap('#ag-sheet-body [data-articulation="hood"]');
  await page.waitForFunction(()=>guide.viewer.articulation.isActive('hood')&&!guide.viewer.articulation.isMoving());
  await page.screenshot({path:`${out}/mobile-toggle.png`});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,packages,screenshots:out},null,2));
}finally{await browser.close();}
