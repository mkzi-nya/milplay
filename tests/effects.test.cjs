'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./harness.js');
const setup=()=>createHarness(path.resolve(__dirname,'..'));

test('burst stays on its judgement-line landing point while the line moves and after resize',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0}]}],animations:[{fromBeat:1,toBeat:3,key:POS_X,fv:0,tv:600,data:BEARER_LINE,i1:0},{fromBeat:1,toBeat:3,key:POS_Y,fv:0,tv:300,data:BEARER_LINE,i1:0}]});state.appMode='edit';window.n=state.runtime.notes[0];window.rings=[];__plu100DrawRingMask=(...args)=>rings.push(args);`);
  const hit=h.run('__pluEffectLinePoint(n,1,1280,720,state.runtime)');
  const moved=h.run('__pluEffectLinePoint(n,1.3,1280,720,state.runtime)');
  assert.notEqual(hit.x,moved.x);assert.notEqual(hit.y,moved.y);
  h.run('__pluDrawHitRing(state.runtime,n,1.3,transformLine(state.runtime,0,1.3,1280,720),1280,720)');
  assert.equal(h.run('rings[0][0]'),hit.x);assert.equal(h.run('rings[0][1]'),hit.y);
  const resized=h.run('__pluEffectLinePoint(n,1,640,720,state.runtime)');
  h.run('__pluDrawHitRing(state.runtime,n,1.3,transformLine(state.runtime,0,1.3,640,720),640,720)');
  assert.equal(h.run('rings[1][0]'),resized.x);assert.equal(h.run('rings[1][1]'),resized.y);
});

test('manual hit proxy keeps its event anchor and lightning events stay bounded',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0},{startTime:2,endTime:2,type:2}]}],animations:[]});state.appMode='play';state.playing=true;__gpTest.fresh();window.n=state.runtime.notes[0];window.e=__gpTest.gp.entries.get(n.key)||null;`);
  h.run(`__gpTest.touchStart('key',{x:0,y:0},true,1);state.currentTime=1.1;__gpDrawManualEffects(state.runtime,1.1,1280,720);`);
  assert.equal(h.run('__gpTest.gp.effectKeys.size'),1);
  const proxy=h.run('__gpTest.gp.entries.get(n.key).fxProxy');
  h.run('__gpDrawManualEffects(state.runtime,1.2,1280,720)');
  assert.equal(h.run('__gpTest.gp.entries.get(n.key).fxProxy'),proxy);
  h.run(`window.newRt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0},{startTime:2,endTime:2,type:2}]}],animations:[]});state.runtime=newRt;__gpRebindRuntime(newRt);__gpDrawManualEffects(newRt,1.2,1280,720);`);
  assert.notEqual(h.run('__gpTest.gp.entries.get(n.key).fxProxy'),proxy);
  assert.equal(h.run('__gpTest.gp.entries.get(n.key).fxProxy.__pluEffectSource'),h.run('newRt.notes[0]'));
  h.run(`__gpTest.updateAt(2.2);__gpDrawLightningEffects(state.runtime,2.2,1280,720)`);
  assert.ok(h.run('__gpTest.gp.lightningEffects.length')<=1);
});

test('early hold judgement projects the note onto the judgement line',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:2,type:0}]}],animations:[]});window.n=state.runtime.notes[0];window.proxy=Object.create(n);proxy.startSec=.98;proxy.__pluEffectSource=n;`);
  const actual=h.run('transformLine(state.runtime,0,.98,1280,720).center.y');
  const anchor=h.run('__pluAnchorEffectNote(proxy,.98,1280,720,state.runtime).y');
  const airborne=h.run('__pluNoteFrame(state.runtime,n,.98,transformLine(state.runtime,0,.98,1280,720),1280,720).center.y');
  assert.equal(anchor,actual);assert.notEqual(anchor,airborne);
});

test('hold particles follow the moving judgement line while the initial ring stays fixed',()=>{
  const h=setup();
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:3,type:0}]}],animations:[{fromBeat:1,toBeat:3,key:POS_Y,fv:0,tv:300,data:BEARER_LINE,i1:0}]});state.appMode='edit';window.n=state.runtime.notes[0];window.origins=[];__pluDrawOneParticle=(a,n,sec,emission,i,w,h)=>origins.push({x:a.x,y:a.y});window.rings=[];__plu100DrawRingMask=(...args)=>rings.push(args);`);
  h.run('__pluDrawParticles(state.runtime,n,1.3,transformLine(state.runtime,0,1.3,1280,720),1280,720)');
  const first=h.run('origins[0].y');
  assert.equal(first,h.run('__pluEffectLinePoint(n,1.3,1280,720,state.runtime).y'));
  h.run('origins.length=0;__pluDrawParticles(state.runtime,n,1.4,transformLine(state.runtime,0,1.4,1280,720),1280,720)');
  const second=h.run('origins[0].y');
  assert.equal(second,h.run('__pluEffectLinePoint(n,1.4,1280,720,state.runtime).y'));
  assert.notEqual(first,second);
  h.run('__pluDrawHitRing(state.runtime,n,1.4,transformLine(state.runtime,0,1.4,1280,720),1280,720)');
  assert.equal(h.run('rings[0][1]'),h.run('__pluEffectLinePoint(n,1,1280,720,state.runtime).y'));
});
