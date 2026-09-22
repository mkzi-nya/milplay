'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./harness.js');
const setup=()=>createHarness(path.resolve(__dirname,'..'));
function lightning(){
  const h=setup();h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:2},{startTime:2,endTime:2,type:2,isFake:true},{startTime:3,endTime:3,type:2}]}],animations:[]});state.duration=state.runtime.duration;state.playing=true;__gpTest.fresh();`);return h;
}
test('lightning avoids, triggers once, excludes fake and ordinary score; rewind resets',()=>{
  const h=lightning();h.run('__gpTest.updateAt(1.2)');
  assert.deepEqual({...h.run('__gpLightningStats()')},{total:2,passed:1,missed:0,pending:1});
  h.run('__gpTest.touchStart("key",{x:0,y:0},true,3);__gpTest.updateAt(3.01);__gpTest.updateAt(3.2)');
  assert.equal(h.run('__gpLightningStats().missed'),1);
  assert.equal(h.run('__gpTest.gp.judgeSequence.length'),0);
  assert.equal(h.run('__gpScoreBreakdown().noteAmount'),0);
  h.run('__gpTest.rebuild(0)');assert.equal(h.run('__gpLightningStats().pending'),2);
  h.run('__gpTest.gp.autoplay=true');assert.equal(h.run('__gpLightningStats(4).passed'),2);
});
test('long stalls resolve lightning and do not repeat results',()=>{
  const h=lightning();h.run('__gpTest.sweep(0,100);__gpTest.sweep(0,100)');
  assert.equal(h.run('__gpLightningStats().passed'),2);
});
test('stage env follows CSS dimensions independent of DPR, and can be replayed deterministically',async()=>{
  const h=setup();h.get('stage').getBoundingClientRect=()=>({width:400,height:900});h.context.devicePixelRatio=3;
  const chart=await h.run('milizeJsToJson(`m.withProperty("w",env("stage.width"));m.withProperty("h",env("stage.height"));m.withProperty("seed",env("time"));m.line()`,{"time":"42"})');
  assert.deepEqual({...chart.meta},{w:'400',h:'900',seed:'42'});
});
test('low-memory mode lowers canvas and storyboard budgets',()=>{
  const h=setup();h.get('stage').getBoundingClientRect=()=>({width:1920,height:1080});h.context.devicePixelRatio=3;
  h.run('state.lowMemory=true;markStageResize();resizeCanvas()');
  assert.deepEqual([h.get('stage').width,h.get('stage').height],[960,540]);
  assert.deepEqual({...h.run('window.__milStoryboardSampleSize(4096,2304)')},{width:1280,height:720});
});
test('four-corner picture uses two clipped triangles; collapsed geometry is skipped',()=>{
  const h=setup();h.run(`window.transforms=[];window.clips=0;ctx.transform=(...a)=>transforms.push(a);ctx.clip=()=>clips++;window.sb={index:0,type:0,data:'builtin.rect',layer:1,distorted:true};window.rt={storyboards:[sb],sbValue:(s,k)=>k===TRANSPARENCY?1:SB_DEFAULTS[k]??0};drawStoryboardLayer(rt,1,0,1920,1080);`);
  assert.equal(h.run('clips'),2);assert.equal(h.run('transforms.every(a=>a.every(Number.isFinite))'),true);
  h.run('clips=0;rt.sbValue=(s,k)=>SB_DISTORT_KEYS.has(k)?0:k===TRANSPARENCY?1:SB_DEFAULTS[k]??0;drawStoryboardLayer(rt,1,0,1920,1080)');assert.equal(h.run('clips'),0);
});
test('resize recompiles aspect-dependent JS with a stable seed and preserves judged notes',async()=>{
  const h=setup();h.context.source=`m.withProperty('seed',env('time'));m.timing(0,120);m.line();m.note(0,0,1,1,0,false,false);m.animation(0,0,0,0,Number(env('stage.width')),Number(env('stage.width')),0,0,0,0,false,'');`;
  h.context.chart=await h.run('milizeJsToJson(source,{time:"123"})');
  h.run('prepare(chart,"aspect.js");state.playing=true;__gpTest.touchStart("key",{x:0,y:0},true,1);state.currentTime=1;');
  h.get('stage').getBoundingClientRect=()=>({width:540,height:960});
  await h.run('__milRefreshStageEnvironment()');
  assert.equal(h.run('state.runtime.lineValue(0,0,1)'),540);
  assert.equal(h.run('state.chart.meta.seed'),'123');
  assert.equal(h.run('__gpTest.gp.judgeSequence.join("")'),'e');
  assert.equal(h.run('state.currentTime'),1);
  assert.equal(h.run('state.playing'),true);
});
test('interval index stores each long note once and retains very early notes',()=>{
  const h=setup();h.run(`window.rt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:100000,endTime:100000,type:2}]}],animations:[]});`);
  assert.equal(h.run('__pluActiveNotesAt(rt,2,0).length'),1);
  assert.equal(h.run('rt.__pluActiveBuckets'),undefined);
  assert.equal(h.run('__pluActiveNotesAt(rt,2,100001).length'),0);
});
test('extremely long holds do not allocate a bucket for every second',()=>{
  const h=setup();h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:100000,type:0}]}],animations:[]});__gpTest.fresh();`);
  assert.equal(h.run('state.runtime.__pluHoldFxBuckets.size'),0);
  assert.equal(h.run('__gpTest.gp.timeBuckets.size'),0);
  assert.equal(h.run('__gpTest.gp.longNotes.length'),1);
});
test('backward seeks preserve overlapping track transitions and extended easings',()=>{
  const h=setup();h.run(`window.rt=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[]}],animations:[{data:0,i1:0,key:0,fromBeat:0,toBeat:10,fv:0,tv:10},{data:0,i1:0,key:0,fromBeat:2,toBeat:3,fv:20,tv:30},{data:0,i1:0,key:0,fromBeat:4,toBeat:5,fv:40,tv:50}]});`);
  for(const t of [11,1,6,10,2]){h.context.t=t;assert.equal(h.run('rt.lineValue(0,0,t)'),t>=10?50:t)}
  assert.equal(h.run('eventValue({key:0,startSec:0,endSec:1,fv:0,tv:1,press:14,ease:0},0,.25)'),.5);
});
test('result judge groups retain the parenthesized large-G count at zero',()=>{
  const h=setup();
  h.run(`state.appMode='play';state.runtime={meta:{Title:'Test'},duration:1};state.duration=1;state.currentTime=1;state.playing=false;window.__gpScoreBreakdown=()=>({finalScore:1000000,noteAmount:1,counts:{e:1,p:0,g:0,n:0,b:0,m:0},totalAccScore:1000000});__gpShowResult();`);
  assert.equal(h.get('gameResultPerfect').textContent,'1(1)');
  assert.equal(h.get('gameResultGood').textContent,'0(0)');
});
test('an explicitly dismissed result remains dismissed after stage runtime rebind',()=>{
  const h=setup();
  h.run(`window.resultScore=1000000;state.appMode='play';state.runtime={meta:{Title:'Test'},duration:1};state.duration=1;state.currentTime=1;state.playing=false;window.__gpScoreBreakdown=()=>({finalScore:resultScore,noteAmount:1,counts:{e:1},totalAccScore:1000000});__gpShowResult();__gpHideResult(true);const old=state.runtime;state.runtime={meta:{Title:'Test'},duration:1};__gpRebindResultRuntime(old,state.runtime);resultScore=900000;__gpShowResult();`);
  assert.equal(h.get('gameResultScore').textContent,'1000000');
});
