'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./harness.js');
const root=path.resolve(__dirname,'..');

function geometryHarness(){
  const h=createHarness(root);
  h.run('window.draws=[];__milDrawRotTinted=(img,x,y,w,h,rotation,alpha,color)=>draws.push({x,y,w,h,rotation,alpha,color});window.sb={index:0,type:0,layer:1,data:"arbitrary.png"};window.values={0:96,1:54,6:96,7:54,2:.5,3:3,4:30,10:-2,11:.25,22:0x80402080};window.rt={storyboards:[sb],sbValue:(s,k)=>values[k]??0};');
  return h;
}

test('natural dimensions survive sampling; SIZE/WIDTH/HEIGHT, signs and offsets are independent',()=>{
  const h=geometryHarness();
  h.run('const image=document.createElement("canvas");image.width=2560;image.height=1440;storyCache.set(sb.data,{drawable:image,sourceWidth:4096,sourceHeight:2304})');
  for(const [w,height]of [[1920,1080],[1280,720],[1080,1920]]){
    h.context.viewport=[w,height];
    const d=h.run('draws.length=0;drawStoryboardLayer(rt,1,0,...viewport);draws[0]');
    assert.equal(d.w,4096*w/1920*3*-2);assert.equal(d.h,2304*w/1920*3*.25);
    assert.equal(d.x,w*.6);assert.equal(d.y,height*.4);assert.equal(d.rotation,-30);
    assert.deepEqual(Array.from(d.color),[128,64,32,64]);
  }
  h.run('values[10]=0;draws.length=0;drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('draws.length'),0);
});

test('unresampled image uses natural dimensions, not DOM display dimensions',()=>{
  const h=geometryHarness();
  h.run('const image=new Image();image.ready(1920,1080);image.width=100;image.height=100;storyCache.set(sb.data,{img:image});drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.deepEqual(Array.from(h.run('[draws[0].w,draws[0].h]')),[-11520,810]);
});

test('COLOR interpolates channels and multiplies authored transparency without an alpha cutoff',()=>{
  const h=geometryHarness();
  assert.deepEqual(Array.from(h.run('rgbaFromUint(eventValue({key:COLOR,fv:0xff0000ff,tv:0x00ff0080,startSec:0,endSec:1,ease:0,press:0,custom:""},0,.5))')),[127,127,0,191]);
  h.run('const image=document.createElement("canvas");image.width=100;image.height=100;storyCache.set(sb.data,{drawable:image});values[2]=.0005;drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('draws[0].color[3]'),128*.0005);
  h.run('window.fills=[];ctx.fillRect=()=>fills.push(ctx.globalAlpha);sb.data="builtin.rect";drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('fills.length'),1);assert.equal(h.run('fills[0]'),128*.0005/255);
});

test('foreground follows all gameplay layers and precedes HUD; layer and authored ordering are stable',()=>{
  const h=createHarness(root);
  h.run(`
    state.appMode='edit';state.currentTime=1;
    const n={lineIdx:0,startSec:1,activeFrom:0,activeTo:2};
    state.runtime={duration:100,lineCount:1,notes:[n],storyboards:[],__pluNonHoldStarts:[n],__pluHolds:[],__pluLayerNotes:[[n],[n],[n]]};
    window.order=[];drawBg=()=>order.push('background');drawBackgroundDim=()=>order.push('dim');
    drawStoryboardLayer=(rt,layer)=>order.push('story'+layer);transformLine=()=>({});drawLineState=()=>order.push('line');
    __pluDrawHitRing=()=>order.push('ring');__pluDrawParticles=()=>order.push('particle');
    window.__gpDrawManualEffects=()=>{};drawNote=()=>order.push('note');drawCombo=()=>order.push('HUD');drawOverlay=()=>{};render();
  `);
  assert.deepEqual(Array.from(h.run('order')),['background','story0','dim','story1','ring','particle','note','note','note','line','story2','HUD']);
  const g=geometryHarness();
  g.run('const image=document.createElement("canvas");image.width=100;image.height=100;storyCache.set(sb.data,{drawable:image});rt.storyboards=[{...sb,index:8,layer:2},{...sb,index:3,layer:1},{...sb,index:1,layer:2}];rt.sbValue=(s,k)=>k===POS_X?s.index:values[k]??0;drawStoryboardLayer(rt,2,0,1920,1080)');
  assert.deepEqual(Array.from(g.run('draws.map(d=>d.x)')),[1064,1057]);
});

test('ordinary notes travel through the judgement line during their fade-out, while holds keep their head anchored',()=>{
  const h=createHarness(root);
  h.run(`
    state.flowSpeed=1;
    window.frameRt={noteValue:()=>1};
    window.frameSt={scale:1,rotation:0,flow:1,floor:10.05,wholeAlpha:1,visible:999999,center:{x:640,y:360}};
    window.tap={hasSize:false,hasRot:false,hasFlow:false,hasTrans:false,hasPosY:false,hasPosX:false,hasRelX:false,hasRelY:false,isHold:false,startSec:10,endSec:10,floorStart:10,floorEnd:10,lineIdx:0};
    window.hold={...tap,isHold:true,endSec:12,floorEnd:12};
  `);
  const tap=h.run('__pluNoteFrame(frameRt,tap,10.05,frameSt,1280,720)');
  const hold=h.run('__pluNoteFrame(frameRt,hold,10.05,frameSt,1280,720)');
  assert.ok(tap.floorHead<0,'tap has crossed to the far side of the judgement line');
  assert.equal(hold.floorHead,0,'hold head stays on the judgement line');
  assert.ok(hold.floorTail>0,'hold tail remains behind the line before its end');
});
