'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {createHarness}=require('./harness.js');
const root=path.resolve(__dirname,'..');
const archive=process.env.MILPLAY_ARCHIVE_DIR||path.resolve(root,'../milthm-archive/code/chart/js');
const source=fs.readFileSync(path.join(archive,'Special_Algebra.js'),'utf8');
const h=createHarness(root);
h.context.__hudSource=source;
const ready=h.run('parseText(__hudSource,"Special_Algebra.js")').then(({chart})=>{
  h.context.__hudChart=chart;
  h.run('window.__hudRuntime=makeRuntime(__hudChart);state.runtime=__hudRuntime;state.duration=__hudRuntime.duration;state.appMode="play";state.playing=false;window.__hudTexts=[];ctx.fillText=(s)=>__hudTexts.push(String(s));');
  return chart;
});
function draw(sec){
  h.context.__hudSec=sec;
  return h.run('__hudTexts.length=0;drawCombo(state.runtime,__hudSec,1920,1080);__hudTexts.slice()');
}

test('real Algebra has no negative animation binding or extra HUD binding',async()=>{
  const chart=await ready;
  assert.equal(chart.meta.UITheme,0);
  assert.ok(chart.animations.length>0);
  assert.deepEqual([...new Set(chart.animations.map(a=>a.data))].sort(),[0,1,2]);
  assert.ok(chart.animations.every(a=>a.i1>=0));
  assert.deepEqual(Object.keys(chart.meta).sort(),[
    'AudioFile','BeatmapUID','Beatmapper','Composer','Difficulty','DifficultyValue',
    'FormatVersionCode','IllustrationFile','Illustrator','PreviewTime','Title','UITheme'
  ].sort());
});

test('real beats1 plateau includes 45s and 49s, outside it alpha is zero',async()=>{
  await ready;
  for(const [sec,alpha]of [[40,0],[45,1],[49,1],[51,0]]){
    h.context.__hudSec=sec;
    assert.equal(h.run('__hudRuntime.sbValue(__hudRuntime.storyboards.find(s=>s.data==="beats1.png"),TRANSPARENCY,__hudSec)'),alpha);
  }
});

test('shipped compressed Algebra contains the same script as the archive',()=>{
  const file=path.resolve(root,'../milthm_unpack/Assets/Beatmaps/Runtime/(Special)Algebra - Function Phantom.bytes');
  assert.equal(zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8').trim(),source.trim());
});

test('ordinary opaque storyboard still draws HUD',async()=>{
  await ready;
  h.run('state.runtime=makeRuntime({meta:{UITheme:0},bpms:[{start:0,bpm:120}],lines:[],storyboardObjects:[{type:0,data:"ordinary-background.png",layer:0}],animations:[{fromBeat:0,toBeat:0,key:2,fv:1,tv:1,data:2,i1:0}]});');
  assert.ok(draw(1).some(s=>/^\d{7}$/.test(s)));
});

// These are executable acceptance failures, not a claim that hiding is implemented.
// Remove TODO only after an authored, general visibility mechanism is established.
test('Algebra beats1 hides combo and score at 45s',{todo:'HUD trigger is not present in the supplied chart or reference renderer'},async()=>{
  await ready;h.run('state.runtime=__hudRuntime');
  assert.equal(draw(45).length,0);
});

test('paused seek refreshes state.hudVisible before drawing',{todo:'MilHud visibility contract is not implemented'},async()=>{
  await ready;h.run('state.runtime=__hudRuntime;state.duration=__hudRuntime.duration;state.playing=false;seek(45)');
  assert.equal(h.run('state.hudVisible'),false);
  h.run('seek(40)');assert.equal(h.run('state.hudVisible'),true);
  h.run('seek(49)');assert.equal(h.run('state.hudVisible'),false);
});

test('switching from hidden Algebra to ordinary storyboard resets visibility',{todo:'MilHud visibility contract is not implemented'},async()=>{
  await ready;h.run('state.runtime=__hudRuntime;state.currentTime=45;render()');
  assert.equal(h.run('state.hudVisible'),false);
  h.run('state.runtime=makeRuntime({meta:{UITheme:0},bpms:[{start:0,bpm:120}],lines:[],animations:[],storyboardObjects:[{type:1,data:"ordinary",layer:2}]});state.currentTime=1;render()');
  assert.equal(h.run('state.hudVisible'),true);
  assert.ok(draw(1).some(s=>/^\d{7}$/.test(s)));
});
