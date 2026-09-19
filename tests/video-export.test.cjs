'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/20-video-export.js'),'utf8');
function harness(mode){
  let click,ticks=0,stops=0,downloads=0;const statuses=[],seeks=[];
  const btn={classList:{add(){},remove(){}},addEventListener(_,f){click=f}};
  const track={stop(){stops++}};
  const state={appMode:'play',runtime:{duration:1},chart:{},duration:1,currentTime:.4,playing:false,rate:1};
  class Recorder{
    static isTypeSupported(){return true}
    constructor(){this.handlers={};this.state='inactive';if(mode==='constructor')throw Error('constructor failed')}
    addEventListener(k,f){this.handlers[k]=f}
    start(){this.state='recording';if(mode==='error')this.handlers.error({error:Error('encoder failed')})}
    stop(){this.state='inactive';this.handlers.dataavailable({data:new Blob(['video'])});this.handlers.stop()}
  }
  const context={state,window:{MediaRecorder:Recorder},MediaRecorder:Recorder,MediaStream:class{},Blob,
    HTMLCanvasElement:{prototype:{captureStream(){}}},
    document:{getElementById:id=>id==='exportVideoBtn'?btn:{},body:{appendChild(){}},createElement:()=>({click(){downloads++},remove(){}})},
    URL:{createObjectURL:()=>'',revokeObjectURL(){}},console:{error(){},warn(){}},
    els:{stage:{width:100,height:100,captureStream:()=>({getTracks:()=>[track]})},audioPlayer:{playbackRate:1}},
    performance:{now:()=>ticks},setTimeout(f,ms){if(ms===200){ticks+=200;state.currentTime=1;if(mode==='switch')state.chart={};}queueMicrotask(f)},
    setPlaying(v){state.playing=v},seek(t){state.currentTime=t;seeks.push(t)},render(){},updateControls(){},syncMediaToChart(){},safeName:s=>s,setStatus:s=>statuses.push(s)};
  vm.runInNewContext(source,context);
  return {run:()=>click(),state,statuses,seeks,get stops(){return stops},get downloads(){return downloads}};
}
test('export observes synchronous stop and restores original playhead',async()=>{
  const h=harness();await h.run();assert.equal(h.downloads,1);assert.equal(h.stops,1);assert.deepEqual(h.seeks,[0,.4]);assert.equal(h.statuses.length,0);
});
test('encoder errors abort and release capture tracks',async()=>{
  const h=harness('error');await h.run();assert.match(h.statuses[0],/encoder failed/);assert.equal(h.downloads,0);assert.equal(h.stops,1);
});
test('constructor failures release tracks created before recorder',async()=>{
  const h=harness('constructor');await h.run();assert.equal(h.stops,1);assert.equal(h.downloads,0);
});
test('chart switch at end does not download or seek into new chart',async()=>{
  const h=harness('switch');await h.run();assert.match(h.statuses[0],/谱面已切换/);assert.equal(h.downloads,0);assert.deepEqual(h.seeks,[0]);
});
test('zero duration is rejected before recording',async()=>{
  const h=harness();h.state.duration=0;h.state.runtime.duration=0;await h.run();assert.match(h.statuses[0],/时长无效/);assert.deepEqual(h.seeks,[]);
});
