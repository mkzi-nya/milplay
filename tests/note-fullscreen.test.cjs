'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{createHarness}=require('./harness.js');
const setup=()=>createHarness(root);

test('a judged Tap vanishes immediately while Hold remains visible',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0},{startTime:2,endTime:3,type:0}]}],animations:[]});state.appMode='play';state.playing=true;__gpTest.fresh();window.rt=state.runtime;window.tap=rt.notes[0];window.hold=rt.notes[1];window.draws=[];state.images.tap={naturalWidth:100,naturalHeight:80};state.images.hold={naturalWidth:100,naturalHeight:80};__milDrawRotTinted=()=>draws.push('tap');__milTintSlice=()=>draws.push('hold');`);
  h.run('drawNote(rt,tap,1,transformLine(rt,0,1,1280,720),1280,720)');
  assert.equal(h.run('draws.length'),1);
  h.run(`draws.length=0;__gpTest.touchStart('key',{x:0,y:0},true,1);drawNote(rt,tap,1.01,transformLine(rt,0,1.01,1280,720),1280,720)`);
  assert.equal(h.run('draws.length'),0);
  h.run(`__gpTest.touchStart('hold-key',{x:0,y:0},true,2);drawNote(rt,hold,2.01,transformLine(rt,0,2.01,1280,720),1280,720)`);
  assert.ok(h.run('draws.length')>0);
});

test('autoplay hides non-Hold notes at contact, fake notes retain chart rendering',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0},{startTime:2,endTime:2,type:1},{startTime:3,endTime:3,type:2},{startTime:4,endTime:4,type:0,isFake:true},{startTime:5,endTime:6,type:0}]}],animations:[]});state.appMode='play';__gpTest.fresh();__gpTest.gp.autoplay=true;window.ns=state.runtime.notes;`);
  assert.equal(h.run('ns.slice(0,3).every(n=>__gpNoteShouldHide(n,n.startSec))'),true);
  assert.equal(h.run('__gpNoteShouldHide(ns[3],ns[3].startSec)'),false);
  assert.equal(h.run('__gpNoteShouldHide(ns[4],ns[4].startSec)'),false);
});

test('fullscreen fills the display by default and preserves explicit ratio',()=>{
  const normal=fs.readFileSync(path.join(root,'css/final-fullscreen.css'),'utf8'),expanded=fs.readFileSync(path.join(root,'css/play-enlarged.css'),'utf8');
  assert.match(normal,/width:100vw!important;height:100vh!important;height:100dvh!important/);
  assert.match(expanded,/\.stageWrap\.playExpanded \.stageInner\{[\s\S]*?width:100vw!important;[\s\S]*?height:100dvh!important/);
  assert.match(normal,/\.stageWrap\.customStageRatio\.nativePlayFullscreen \.stageInner[\s\S]*?width:min\(100vw/);
  const h=setup();h.context.innerWidth=1000;h.context.innerHeight=1700;h.context.document.fullscreenElement=h.get('stageWrap');
  h.run('__milSyncLegacyFullscreenSize()');
  assert.deepEqual([h.get('stageInner').style.width,h.get('stageInner').style.height],['1000px','1700px']);
  h.get('ratioLengthInput').value='16';h.get('ratioWidthInput').value='9';h.run('__milApplyStageRatio()');
  assert.deepEqual([h.get('stageInner').style.width,h.get('stageInner').style.height],['1000px','562.5px']);
});
